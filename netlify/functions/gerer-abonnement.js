// Fonction Netlify — annule ou réactive un abonnement Stripe.
// L'annulation se fait "à la fin de la période payée" : la cliente
// garde son accès jusqu'à la date déjà réglée, comme l'exige la loi
// (résiliation aussi simple que la souscription, sans pénaliser
// ce qui a déjà été payé).

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

exports.handler = async function (event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!SUPABASE_URL || !SERVICE_ROLE_KEY || !process.env.STRIPE_SECRET_KEY) {
    return { statusCode: 500, body: JSON.stringify({ error: 'Configuration incomplète.' }) };
  }

  let corps;
  try {
    corps = JSON.parse(event.body);
  } catch (e) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Requête invalide.' }) };
  }

  const { user_id, action } = corps; // action : 'annuler' ou 'reactiver'
  if (!user_id || !['annuler', 'reactiver'].includes(action)) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Paramètres manquants ou invalides.' }) };
  }

  try {
    const reponseProfil = await fetch(
      `${SUPABASE_URL}/rest/v1/profiles?id=eq.${user_id}&select=stripe_subscription_id`,
      { headers: { apikey: SERVICE_ROLE_KEY, Authorization: `Bearer ${SERVICE_ROLE_KEY}` } }
    );
    const profils = await reponseProfil.json();
    const subscriptionId = profils[0] && profils[0].stripe_subscription_id;

    if (!subscriptionId) {
      return { statusCode: 404, body: JSON.stringify({ error: 'Aucun abonnement actif trouvé.' }) };
    }

    await stripe.subscriptions.update(subscriptionId, {
      cancel_at_period_end: action === 'annuler'
    });

    await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${user_id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        apikey: SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
        Prefer: 'return=minimal'
      },
      body: JSON.stringify({ annulation_prevue: action === 'annuler' })
    });

    return { statusCode: 200, body: JSON.stringify({ ok: true }) };
  } catch (e) {
    console.error('Erreur annulation/réactivation abonnement', e);
    return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
  }
};
