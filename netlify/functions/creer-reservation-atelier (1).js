// Fonction Netlify — crée une session de paiement Stripe pour réserver
// une place à un atelier. Vérifie qu'il reste de la place avant de
// lancer le paiement (la vérification finale et définitive se fait
// dans le webhook, après paiement confirmé).

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

exports.handler = async function (event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!SUPABASE_URL || !SERVICE_ROLE_KEY || !process.env.STRIPE_SECRET_KEY) {
    console.error('Variables d\'environnement manquantes');
    return { statusCode: 500, body: JSON.stringify({ error: 'Configuration incomplète.' }) };
  }

  let corps;
  try {
    corps = JSON.parse(event.body);
  } catch (e) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Requête invalide.' }) };
  }

  const { atelier_id, user_id, email } = corps;
  if (!atelier_id || !user_id) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Paramètres manquants.' }) };
  }

  try {
    const reponseAtelier = await fetch(
      `${SUPABASE_URL}/rest/v1/ateliers?id=eq.${atelier_id}&select=*`,
      { headers: { apikey: SERVICE_ROLE_KEY, Authorization: `Bearer ${SERVICE_ROLE_KEY}` } }
    );
    const ateliersTrouves = await reponseAtelier.json();
    const atelier = ateliersTrouves[0];
    if (!atelier) {
      return { statusCode: 404, body: JSON.stringify({ error: 'Atelier introuvable.' }) };
    }

    // Vérifier les places restantes
    const reponsePlaces = await fetch(
      `${SUPABASE_URL}/rest/v1/atelier_reservations?atelier_id=eq.${atelier_id}&select=id`,
      { headers: { apikey: SERVICE_ROLE_KEY, Authorization: `Bearer ${SERVICE_ROLE_KEY}`, Prefer: 'count=exact' } }
    );
    const reservationsExistantes = await reponsePlaces.json();
    const placesPrises = Array.isArray(reservationsExistantes) ? reservationsExistantes.length : 0;

    if (atelier.places_max != null && placesPrises >= atelier.places_max) {
      return { statusCode: 409, body: JSON.stringify({ error: 'Cet atelier est complet.' }) };
    }

    // Déjà réservé par cette utilisatrice ?
    const reponseDejaReserve = await fetch(
      `${SUPABASE_URL}/rest/v1/atelier_reservations?atelier_id=eq.${atelier_id}&user_id=eq.${user_id}&select=id`,
      { headers: { apikey: SERVICE_ROLE_KEY, Authorization: `Bearer ${SERVICE_ROLE_KEY}` } }
    );
    const dejaReserve = await reponseDejaReserve.json();
    if (Array.isArray(dejaReserve) && dejaReserve.length) {
      return { statusCode: 409, body: JSON.stringify({ error: 'Tu es déjà inscrite à cet atelier.' }) };
    }

    const origin = event.headers.origin || `https://${event.headers.host}`;

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      customer_email: email || undefined,
      line_items: [{
        price_data: {
          currency: 'eur',
          product_data: {
            name: `Atelier — ${atelier.titre}`,
            description: atelier.description || undefined
          },
          unit_amount: atelier.prix_centimes
        },
        quantity: 1
      }],
      metadata: { type: 'atelier', atelier_id, user_id },
      success_url: `${origin}/?atelier=succes`,
      cancel_url: `${origin}/?atelier=annule`
    });

    return { statusCode: 200, body: JSON.stringify({ url: session.url }) };
  } catch (e) {
    console.error('Erreur création réservation atelier', e);
    return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
  }
};
