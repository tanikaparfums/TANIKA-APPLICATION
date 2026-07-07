// Fonction Netlify programmée — envoie l'affirmation du jour à toutes les personnes abonnées
// Se déclenche automatiquement chaque jour (voir netlify.toml pour l'heure)

const webpush = require('web-push');

// ═══ Copie simplifiée des intentions et mantras (doit rester alignée avec l'app) ═══
const INTENTIONS = [
  { cle: "amour", label: "Attirer l'amour", notes: "Rose de Damas, Ylang-Ylang, Fleur d'Oranger" },
  { cle: "confiance", label: "Gagner en confiance", notes: "Bergamote, Néroli, Agrumes solaires" },
  { cle: "abondance", label: "Attirer l'abondance", notes: "Patchouli, Vétiver, Ambre" },
  { cle: "clarte", label: "Clarté mentale", notes: "Encens Oliban, Menthe, Eucalyptus" },
  { cle: "creativite", label: "Stimuler ma créativité", notes: "Jasmin, Ylang-Ylang, Épices douces" },
  { cle: "ancrage", label: "Ancrage & stabilité", notes: "Santal, Cèdre de l'Atlas, Vétiver" },
  { cle: "expression", label: "Affirmer ma parole", notes: "Lavande Vraie, Eucalyptus Radié, Menthe" },
  { cle: "repos", label: "Repos & apaisement", notes: "Lavande, Camomille, Fleur d'Oranger" },
  { cle: "protection", label: "Protection énergétique", notes: "Encens, Myrrhe, Bois de Santal" },
  { cle: "guerison", label: "Guérison intérieure", notes: "Rose, Camomille, Néroli" },
  { cle: "pardon", label: "Pardon et libération", notes: "Fleur d'Oranger, Rose, Encens léger" },
  { cle: "lacherprise", label: "Lâcher-prise", notes: "Myrrhe, Lavande, Bois précieux" },
  { cle: "sommeil", label: "Sommeil réparateur", notes: "Lavande Vraie, Camomille, Vanille douce" },
  { cle: "seduction", label: "Séduction assumée", notes: "Jasmin Sambac, Ylang-Ylang, Musc" },
  { cle: "chance", label: "Attirer la chance", notes: "Bergamote, Cannelle, Agrumes" },
  { cle: "spiritualite", label: "Connexion spirituelle", notes: "Encens Oliban, Myrrhe, Oud" },
  { cle: "courage", label: "Puiser du courage", notes: "Poivre rose, Bergamote, Bois fumés" },
  { cle: "gratitude", label: "Cultiver la gratitude", notes: "Rose, Fleur d'Oranger, Vanille" },
  { cle: "intuition", label: "Affiner mon intuition", notes: "Encens, Iris, Bois de Santal" },
  { cle: "purification", label: "Purifier mon énergie", notes: "Eucalyptus, Sauge blanche, Agrumes" }
];

const MANTRAS = [
  { cle: "ancrage", txt: "Je suis la terre qui ne tremble pas. Rien ni personne ne déplace mon centre." },
  { cle: "amour", txt: "Je suis l'amour que je cherche ailleurs. Il commence ici, en moi, maintenant." },
  { cle: "confiance", txt: "Je rayonne sans permission. Mon soleil intérieur ne demande la validation de personne." },
  { cle: "expression", txt: "Ma voix est une arme sacrée. Je dis ma vérité sans trembler." },
  { cle: "intuition", txt: "Je sais avant de comprendre. Mon regard intérieur ne se trompe jamais." },
  { cle: "clarte", txt: "Le brouillard se lève. Ma vision est nette, mes décisions sont justes." },
  { cle: "creativite", txt: "Je crée par plaisir, jamais par peur. Mon élan créateur est infini." },
  { cle: "seduction", txt: "Ma sensualité est sacrée. Je l'habite sans honte et sans excuse." },
  { cle: "abondance", txt: "Je mérite de recevoir sans culpabilité. L'abondance me cherche autant que je la cherche." },
  { cle: "protection", txt: "Je suis entourée d'une lumière que rien de négatif ne peut traverser." },
  { cle: "guerison", txt: "Je me libère de ce qui ne m'appartient plus." },
  { cle: "pardon", txt: "Je pardonne pour me libérer, pas pour excuser." },
  { cle: "lacherprise", txt: "Je relâche ce que je ne contrôle pas." },
  { cle: "sommeil", txt: "Mon corps se dépose. Cette nuit m'appartient, et elle me répare entièrement." },
  { cle: "chance", txt: "Je suis alignée avec la bonne fortune." },
  { cle: "spiritualite", txt: "Je m'élève. Le sacré circule en moi." },
  { cle: "courage", txt: "La peur est présente, et j'avance quand même." },
  { cle: "gratitude", txt: "Je vois déjà tout ce qui va bien." },
  { cle: "purification", txt: "Je nettoie mon champ. Ce qui n'est plus aligné n'a plus sa place ici." },
  { cle: "repos", txt: "Je m'autorise à ne rien faire. Me reposer est un besoin sacré." }
];

function intentionDuJour() {
  const maintenant = new Date();
  const debutAnnee = new Date(maintenant.getFullYear(), 0, 0);
  const jourDeLAnnee = Math.floor((maintenant - debutAnnee) / 86400000);
  const intention = INTENTIONS[jourDeLAnnee % INTENTIONS.length];
  const mantra = MANTRAS.find(m => m.cle === intention.cle) || MANTRAS[0];
  return { intention, mantra };
}

exports.handler = async function () {
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY;
  const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;

  if (!SUPABASE_URL || !SERVICE_ROLE_KEY || !VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    console.error('Variables d\'environnement manquantes');
    return { statusCode: 500, body: 'Configuration incomplète' };
  }

  webpush.setVapidDetails('mailto:contact@tanikaparfums.fr', VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

  // Récupérer tous les abonnements via l'API REST Supabase (clé service_role = accès complet)
  const reponse = await fetch(`${SUPABASE_URL}/rest/v1/push_subscriptions?select=*`, {
    headers: {
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`
    }
  });
  const abonnements = await reponse.json();

  if (!Array.isArray(abonnements) || !abonnements.length) {
    return { statusCode: 200, body: 'Aucun abonnement à notifier.' };
  }

  const { intention, mantra } = intentionDuJour();
  const payload = JSON.stringify({
    titre: `✦ ${intention.label} ✦`,
    corps: `${mantra.txt} — Notes du jour : ${intention.notes}`,
    url: '/'
  });

  let envoyes = 0, expires = [];

  for (const abo of abonnements) {
    const subscription = {
      endpoint: abo.endpoint,
      keys: { p256dh: abo.p256dh, auth: abo.auth }
    };
    try {
      await webpush.sendNotification(subscription, payload);
      envoyes++;
    } catch (e) {
      if (e.statusCode === 404 || e.statusCode === 410) {
        expires.push(abo.id);
      } else {
        console.error('Échec envoi notification', e.message);
      }
    }
  }

  // Nettoyer les abonnements expirés
  if (expires.length) {
    await fetch(`${SUPABASE_URL}/rest/v1/push_subscriptions?id=in.(${expires.join(',')})`, {
      method: 'DELETE',
      headers: {
        apikey: SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SERVICE_ROLE_KEY}`
      }
    });
  }

  return { statusCode: 200, body: `${envoyes} notification(s) envoyée(s), ${expires.length} abonnement(s) expiré(s) nettoyé(s).` };
};
