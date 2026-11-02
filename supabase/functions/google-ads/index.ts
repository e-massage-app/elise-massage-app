// Fonction Supabase « google-ads » (v1.1.1.0) : relais en LECTURE SEULE vers l'API Google Ads.
//
// Les cles (jeton developpeur, identifiant et secret OAuth) sont des secrets Supabase, jamais dans le
// depot ni dans le navigateur. La connexion Google (refresh token) est rangee dans la table
// google_ads_connexion, que seul ce code lit et ecrit (cle service_role) : RLS sans politique.
//
// Routes, toutes avec la session Supabase de l'utilisatrice (en-tete Authorization) :
//   POST oauth/lien        { redirectUri }  -> { url }              lien de connexion Google
//   POST oauth/connecter   { code, state }  -> { connecte, email }  retour de Google
//   GET  oauth/etat                         -> { connecte, email, connecteLe }
//   POST oauth/deconnecter                  -> { connecte: false }
//   GET  v24/customers:listAccessibleCustomers              relais Google, reponse telle quelle
//   POST v24/customers/{id}/googleAds:searchStream|search   relais Google, reponse telle quelle
// Toute autre adresse Google (modification de campagne, etc.) est refusee : regle de Jordan,
// Google Ads en lecture seule.

import { createClient } from 'npm:@supabase/supabase-js@2';

const CLIENT_ID = Deno.env.get('GOOGLE_ADS_CLIENT_ID') ?? '';
const CLIENT_SECRET = Deno.env.get('GOOGLE_ADS_CLIENT_SECRET') ?? '';
const DEVELOPER_TOKEN = Deno.env.get('GOOGLE_ADS_DEVELOPER_TOKEN') ?? '';

const ORIGINES = ['https://app.elise-massage.fr', 'https://e-massage-app.github.io', 'http://localhost:3457'];
// Doivent etre les « URI de redirection autorises » du client OAuth « Elise Massage App (web) »
const RETOURS = ['https://app.elise-massage.fr/google-ads-retour.html', 'http://localhost:3457/google-ads-retour.html'];
const SCOPES = 'https://www.googleapis.com/auth/adwords https://www.googleapis.com/auth/userinfo.email';

const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false },
});

type Connexion = {
  refresh_token: string | null;
  access_token: string | null;
  expire_le: string | null;
  email: string | null;
  etat_oauth: string | null;
  redirect_uri: string | null;
  connecte_le: string | null;
};

function entetesCors(req: Request): Record<string, string> {
  const origine = req.headers.get('Origin') ?? '';
  return {
    'Access-Control-Allow-Origin': ORIGINES.includes(origine) ? origine : ORIGINES[0],
    'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Vary': 'Origin',
  };
}

function reponse(req: Request, statut: number, corps: unknown): Response {
  return new Response(JSON.stringify(corps), {
    status: statut,
    headers: { ...entetesCors(req), 'Content-Type': 'application/json' },
  });
}

async function lireConnexion(userId: string): Promise<Connexion | null> {
  const { data, error } = await admin.from('google_ads_connexion').select('*').eq('user_id', userId).maybeSingle();
  if (error) throw error;
  return data;
}

async function ecrireConnexion(userId: string, champs: Partial<Connexion>): Promise<void> {
  const { error } = await admin.from('google_ads_connexion')
    .upsert({ user_id: userId, ...champs, maj_le: new Date().toISOString() }, { onConflict: 'user_id' });
  if (error) throw error;
}

// Les cles de `parametres` que l'app lit deja pour savoir si Google Ads est connecte
async function majParametres(userId: string, connecte: boolean): Promise<void> {
  const lignes = [
    { user_id: userId, cle: 'googleAdsConnected', valeur: connecte },
    { user_id: userId, cle: 'googleAdsConnectedAt', valeur: connecte ? new Date().toISOString() : '' },
    { user_id: userId, cle: 'googleAdsTokens', valeur: '' }, // anciens jetons du navigateur : plus utilises
  ];
  const { error } = await admin.from('parametres').upsert(lignes, { onConflict: 'user_id,cle' });
  if (error) throw error;
}

async function demanderJeton(parametres: Record<string, string>) {
  const rep = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: CLIENT_ID, client_secret: CLIENT_SECRET, ...parametres }),
  });
  return { ok: rep.ok, data: await rep.json().catch(() => ({})) };
}

/** Jeton d'acces Google valide (renouvele si besoin), ou null si la connexion n'existe plus. */
async function jetonAcces(userId: string): Promise<string | null> {
  const c = await lireConnexion(userId);
  if (!c?.refresh_token) return null;
  if (c.access_token && c.expire_le && new Date(c.expire_le).getTime() - Date.now() > 60_000) return c.access_token;
  const { ok, data } = await demanderJeton({ grant_type: 'refresh_token', refresh_token: c.refresh_token });
  if (!ok || !data.access_token) {
    // Revoquee ou expiree : on l'oublie. googleAdsConnected reste vrai pour que l'app affiche
    // « connexion expiree, reconnecte-toi ».
    if (data.error === 'invalid_grant') await ecrireConnexion(userId, { refresh_token: null, access_token: null, expire_le: null });
    return null;
  }
  await ecrireConnexion(userId, {
    access_token: data.access_token,
    expire_le: new Date(Date.now() + (data.expires_in ?? 3600) * 1000).toISOString(),
  });
  return data.access_token;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: entetesCors(req) });

  try {
    const jwt = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
    const { data: { user } } = await admin.auth.getUser(jwt);
    if (!user) return reponse(req, 401, { error: 'Session expirée : reconnecte-toi à l\'app' });
    const chemin = new URL(req.url).pathname.replace(/^.*?\/google-ads\/?/, '');

    if (chemin === 'oauth/etat' && req.method === 'GET') {
      const jeton = await jetonAcces(user.id);
      const c = await lireConnexion(user.id);
      return reponse(req, 200, { connecte: !!jeton, email: c?.email ?? null, connecteLe: c?.connecte_le ?? null });
    }

    if (chemin === 'oauth/lien' && req.method === 'POST') {
      const { redirectUri } = await req.json();
      if (!RETOURS.includes(redirectUri)) return reponse(req, 400, { error: 'Adresse de retour non autorisée' });
      const etatOauth = crypto.randomUUID();
      await ecrireConnexion(user.id, { etat_oauth: etatOauth, redirect_uri: redirectUri });
      const url = 'https://accounts.google.com/o/oauth2/v2/auth?' + new URLSearchParams({
        client_id: CLIENT_ID,
        redirect_uri: redirectUri,
        response_type: 'code',
        scope: SCOPES,
        access_type: 'offline',
        prompt: 'consent',
        state: etatOauth,
      });
      return reponse(req, 200, { url });
    }

    if (chemin === 'oauth/connecter' && req.method === 'POST') {
      const { code, state } = await req.json();
      const c = await lireConnexion(user.id);
      if (!code || !state || !c?.etat_oauth || c.etat_oauth !== state || !c.redirect_uri) {
        return reponse(req, 400, { error: 'Ce lien de connexion n\'est plus valable : recommence depuis l\'app' });
      }
      const { ok, data } = await demanderJeton({ grant_type: 'authorization_code', code, redirect_uri: c.redirect_uri });
      if (!ok || !data.refresh_token) {
        return reponse(req, 400, { error: data.error_description || data.error || 'Google n\'a pas donné d\'accès durable' });
      }
      let email: string | null = null;
      try {
        const u = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', { headers: { Authorization: `Bearer ${data.access_token}` } });
        if (u.ok) email = (await u.json()).email ?? null;
      } catch { /* l'adresse e-mail n'est qu'informative */ }
      await ecrireConnexion(user.id, {
        refresh_token: data.refresh_token,
        access_token: data.access_token,
        expire_le: new Date(Date.now() + (data.expires_in ?? 3600) * 1000).toISOString(),
        email,
        etat_oauth: null,
        connecte_le: new Date().toISOString(),
      });
      await majParametres(user.id, true);
      return reponse(req, 200, { connecte: true, email });
    }

    if (chemin === 'oauth/deconnecter' && req.method === 'POST') {
      const c = await lireConnexion(user.id);
      if (c?.refresh_token) {
        try {
          await fetch('https://oauth2.googleapis.com/revoke?token=' + encodeURIComponent(c.refresh_token), { method: 'POST' });
        } catch { /* deja revoque : rien a faire */ }
      }
      await ecrireConnexion(user.id, { refresh_token: null, access_token: null, expire_le: null });
      await majParametres(user.id, false);
      return reponse(req, 200, { connecte: false });
    }

    // Relais Google Ads : lectures seulement
    const lecture = (req.method === 'GET' && /^v\d+\/customers:listAccessibleCustomers$/.test(chemin))
      || (req.method === 'POST' && /^v\d+\/customers\/\d+\/googleAds:search(Stream)?$/.test(chemin));
    if (!lecture) return reponse(req, 403, { error: 'Seules les lectures Google Ads sont permises' });

    const jeton = await jetonAcces(user.id);
    if (!jeton) return reponse(req, 401, { error: { message: 'Google Ads n\'est pas connecté' } });

    // Google n'exige plus le jeton developpeur (Centre API, 2026-11-02) : envoye seulement s'il est renseigne
    const entetesGoogle: Record<string, string> = {
      'Authorization': `Bearer ${jeton}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };
    if (DEVELOPER_TOKEN) entetesGoogle['developer-token'] = DEVELOPER_TOKEN;
    const rep = await fetch(`https://googleads.googleapis.com/${chemin}`, {
      method: req.method,
      headers: entetesGoogle,
      body: req.method === 'POST' ? await req.text() : undefined,
    });
    return new Response(await rep.text(), {
      status: rep.status,
      headers: { ...entetesCors(req), 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('google-ads :', e);
    return reponse(req, 500, { error: e instanceof Error ? e.message : String(e) });
  }
});
