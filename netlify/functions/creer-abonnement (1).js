// Fonction Netlify — crée une session d'abonnement Stripe (mensuel ou annuel)
// pour donner accès aux fonctionnalités payantes de l'app.

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const PRIX = {
  mensuel: { montant: 1999, intervalle: 'month', libelle: 'Abonnement mensuel — Olfactothèque Tanika' },
  annuel: { montant: 8800, intervalle: 'year', libelle: 'Abonnement annuel — Olfactothèque Tanika' }
};

exports.handler = async function (event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  if (!process.env.STRIPE_SECRET_KEY) {
    console.error('Clé STRIPE_SECRET_KEY manquante');
    return { statusCode: 500, body: JSON.stringify({ error: 'Configuration incomplète.' }) };
  }

  let corps;
  try {
    corps = JSON.parse(event.body);
  } catch (e) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Requête invalide.' }) };
  }

  const { user_id, email, periode } = corps;
  const choix = PRIX[periode];
  if (!user_id || !choix) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Paramètres manquants ou invalides.' }) };
  }

  try {
    const origin = event.headers.origin || `https://${event.headers.host}`;

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer_email: email || undefined,
      line_items: [{
        price_data: {
          currency: 'eur',
          product_data: { name: choix.libelle },
          unit_amount: choix.montant,
          recurring: { interval: choix.intervalle }
        },
        quantity: 1
      }],
      metadata: { user_id, periode },
      subscription_data: { metadata: { user_id, periode } },
      success_url: `${origin}/?abonnement=succes`,
      cancel_url: `${origin}/?abonnement=annule`
    });

    return { statusCode: 200, body: JSON.stringify({ url: session.url }) };
  } catch (e) {
    console.error('Erreur création abonnement', e);
    return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
  }
};
