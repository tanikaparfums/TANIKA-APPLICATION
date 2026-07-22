// Fonction Netlify — reçoit les événements Stripe liés à l'abonnement
// et aux réservations d'ateliers, et met à jour la base en conséquence.
// Ne fait confiance qu'aux requêtes signées par Stripe.

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

async function majProfil(SUPABASE_URL, SERVICE_ROLE_KEY, userId, champs) {
  await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      Prefer: 'return=minimal'
    },
    body: JSON.stringify(champs)
  });
}

async function traiterReservationAtelier(SUPABASE_URL, SERVICE_ROLE_KEY, session) {
  const { atelier_id, user_id } = session.metadata || {};
  if (!atelier_id || !user_id) return;

  // Vérification finale des places avant d'enregistrer (sécurité anti-survente)
  const [reponseAtelier, reponseReservations] = await Promise.all([
    fetch(`${SUPABASE_URL}/rest/v1/ateliers?id=eq.${atelier_id}&select=*`, {
      headers: { apikey: SERVICE_ROLE_KEY, Authorization: `Bearer ${SERVICE_ROLE_KEY}` }
    }),
    fetch(`${SUPABASE_URL}/rest/v1/atelier_reservations?atelier_id=eq.${atelier_id}&select=id`, {
      headers: { apikey: SERVICE_ROLE_KEY, Authorization: `Bearer ${SERVICE_ROLE_KEY}` }
    })
  ]);
  const ateliersTrouves = await reponseAtelier.json();
  const atelier = ateliersTrouves[0];
  const reservationsExistantes = await reponseReservations.json();
  const placesPrises = Array.isArray(reservationsExistantes) ? reservationsExistantes.length : 0;

  if (atelier && atelier.places_max != null && placesPrises >= atelier.places_max) {
    // Complet entre-temps : on rembourse automatiquement le paiement
    console.error('Atelier complet au moment de la confirmation, remboursement en cours', atelier_id);
    try {
      if (session.payment_intent) {
        await stripe.refunds.create({ payment_intent: session.payment_intent });
      }
    } catch (e) {
      console.error('Échec du remboursement automatique', e);
    }
    return;
  }

  await fetch(`${SUPABASE_URL}/rest/v1/atelier_reservations`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      Prefer: 'return=minimal'
    },
    body: JSON.stringify({
      atelier_id, user_id,
      stripe_session_id: session.id,
      email_client: (session.customer_details && session.customer_details.email) || null
    })
  });
}

exports.handler = async function (event) {
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const sig = event.headers['stripe-signature'];

  let stripeEvent;
  try {
    const corpsBrut = event.isBase64Encoded ? Buffer.from(event.body, 'base64') : event.body;
    stripeEvent = stripe.webhooks.constructEvent(corpsBrut, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('Signature webhook invalide', err.message);
    return { statusCode: 400, body: `Webhook Error: ${err.message}` };
  }

  try {
    if (stripeEvent.type === 'checkout.session.completed') {
      const session = stripeEvent.data.object;
      const meta = session.metadata || {};

      if (meta.type === 'atelier') {
        await traiterReservationAtelier(SUPABASE_URL, SERVICE_ROLE_KEY, session);
      } else if (meta.user_id) {
        await majProfil(SUPABASE_URL, SERVICE_ROLE_KEY, meta.user_id, {
          abonnement_actif: true,
          abonnement_periode: meta.periode || null,
          stripe_customer_id: session.customer || null,
          stripe_subscription_id: session.subscription || null
        });
      }
    }

    if (stripeEvent.type === 'customer.subscription.deleted') {
      const subscription = stripeEvent.data.object;
      const { user_id } = subscription.metadata || {};
      if (user_id) {
        await majProfil(SUPABASE_URL, SERVICE_ROLE_KEY, user_id, { abonnement_actif: false });
      }
    }

    if (stripeEvent.type === 'customer.subscription.updated') {
      const subscription = stripeEvent.data.object;
      const { user_id } = subscription.metadata || {};
      if (user_id) {
        const actif = ['active', 'trialing'].includes(subscription.status);
        await majProfil(SUPABASE_URL, SERVICE_ROLE_KEY, user_id, { abonnement_actif: actif });
      }
    }
  } catch (e) {
    console.error('Erreur traitement webhook', e);
    return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
  }

  return { statusCode: 200, body: JSON.stringify({ received: true }) };
};
