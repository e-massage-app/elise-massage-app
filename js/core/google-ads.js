// ===== js/core/google-ads.js (v1.1.1.0) =====
// Google Ads passe par la fonction Supabase « google-ads » (supabase/functions/google-ads) : les cles
// (jeton developpeur, secret OAuth) et la connexion Google restent cote serveur, jamais dans le
// navigateur ni dans le depot. `appel()` renvoie la reponse de Google telle quelle (un objet Response,
// comme fetch) : le code existant qui lit ces reponses ne change pas. La fonction n'accepte que des
// lectures (liste des comptes, requetes de rapport).

(function (racine) {

const BASE = `${SUPABASE_CONFIG.url}/functions/v1/google-ads`;

async function entetes() {
  const { data: { session } } = await supabaseClient.auth.getSession();
  return {
    'Authorization': `Bearer ${session?.access_token || ''}`,
    'apikey': SUPABASE_CONFIG.anonKey,
    'Content-Type': 'application/json'
  };
}

/** Un appel a l'API Google Ads, ex. appel('v24/customers:listAccessibleCustomers'). */
async function appel(chemin, { method = 'GET', body } = {}) {
  return fetch(`${BASE}/${chemin}`, {
    method,
    headers: await entetes(),
    body: body === undefined ? undefined : (typeof body === 'string' ? body : JSON.stringify(body))
  });
}

async function json(chemin, options) {
  const rep = await appel(chemin, options);
  const data = await rep.json().catch(() => ({}));
  if (!rep.ok) throw new Error(data.error?.message || data.error || `Erreur ${rep.status}`);
  return data;
}

// Plusieurs ecrans demandent l'etat au demarrage : une seule question par minute au plus
let etatCache = null;

/** { connecte, email, connecteLe } : la connexion Google est-elle utilisable ? */
function etat({ forcer = false } = {}) {
  if (!forcer && etatCache && Date.now() - etatCache.le < 60000) return etatCache.promesse;
  const promesse = json('oauth/etat').catch(e => ({ connecte: false, erreur: e.message }));
  etatCache = { le: Date.now(), promesse };
  return promesse;
}

function adresseRetour() {
  return new URL('google-ads-retour.html', racine.location.href).href.split(/[?#]/)[0];
}

/** Part chez Google ; Google renvoie ensuite sur google-ads-retour.html, sans code a copier. */
async function connecter() {
  const { url } = await json('oauth/lien', { method: 'POST', body: { redirectUri: adresseRetour() } });
  racine.location.href = url;
}

/** Appele par google-ads-retour.html avec le code renvoye par Google. */
async function terminerConnexion(code, state) {
  etatCache = null;
  return json('oauth/connecter', { method: 'POST', body: { code, state } });
}

async function deconnecter() {
  etatCache = null;
  return json('oauth/deconnecter', { method: 'POST' });
}

racine.GoogleAdsApi = { appel, etat, connecter, terminerConnexion, deconnecter };

})(window);
