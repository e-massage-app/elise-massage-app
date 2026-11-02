// Fonction Supabase « sauvegarde-hebdo » (v1.2.0.0) : chaque lundi, toute la base part par e-mail
// dans un fichier JSON au format de l'export de l'app : il se re-importe tel quel
// (bouton « Importer » de l'app). Format et liste des tables : js/core/persistance.js (les garder alignes).
//
// Appelee par pg_cron (scripts/migration-sauvegarde-hebdo.sql), sans session : deployee avec
// verify_jwt = false, elle exige l'en-tete x-sauvegarde-secret egal au secret SAUVEGARDE_SECRET
// (401 sinon). Secrets : RESEND_API_KEY, SAUVEGARDE_DESTINATAIRE, SAUVEGARDE_SECRET ; SUPABASE_URL
// et SUPABASE_SERVICE_ROLE_KEY sont fournis par Supabase.
// Application a une seule utilisatrice : toutes les lignes de chaque table sont lues (service_role).
// Si la sauvegarde echoue, un e-mail le dit (une sauvegarde qui s'arrete sans bruit ne sert a rien).

import { createClient } from 'npm:@supabase/supabase-js@2';

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? '';
const DESTINATAIRE = Deno.env.get('SAUVEGARDE_DESTINATAIRE') ?? '';
const SECRET = Deno.env.get('SAUVEGARDE_SECRET') ?? '';
const EXPEDITEUR = 'Elise Massage <onboarding@resend.dev>';

const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false },
});

// Meme liste et meme ordre que TABLES_SAUVEGARDE (js/core/persistance.js). brut = lignes telles
// quelles (Gestion) ; sinon converties en objets de l'app (snake_case -> camelCase).
const TABLES: { cle: string; table: string; libelle: string; brut?: boolean }[] = [
  { cle: 'clients', table: 'clients', libelle: 'Clientes' },
  { cle: 'prospects', table: 'prospects', libelle: 'Prospects' },
  { cle: 'collaborateurs', table: 'collaborateurs', libelle: 'Collaborateurs' },
  { cle: 'prestations', table: 'prestations', libelle: 'Prestations' },
  { cle: 'rdv', table: 'rdv', libelle: 'Rendez-vous' },
  { cle: 'depenses', table: 'depenses', libelle: 'Dépenses' },
  { cle: 'bonsCadeaux', table: 'bons_cadeaux', libelle: 'Cartes cadeaux' },
  { cle: 'relances', table: 'relances', libelle: 'Relances' },
  { cle: 'gestion_mouvements', table: 'gestion_mouvements', libelle: 'Gestion : mouvements', brut: true },
  { cle: 'gestion_recurrents', table: 'gestion_recurrents', libelle: 'Gestion : lignes fixes', brut: true },
  { cle: 'gestion_mois', table: 'gestion_mois', libelle: 'Gestion : mois', brut: true },
  { cle: 'gestion_soldes', table: 'gestion_soldes', libelle: 'Gestion : soldes', brut: true },
];

// La connexion Google Ads vit cote serveur : ni sauvegardee ni restauree (comme dans l'app)
const CLES_CONNEXION_GOOGLE = ['googleAdsTokens', 'googleAdsConnected', 'googleAdsConnectedAt'];

// Supabase renvoie au plus 1000 lignes par requete : lecture par pages, triee sur id
const TAILLE_PAGE = 1000;

type Ligne = Record<string, unknown>;

async function lireTable(table: string): Promise<Ligne[]> {
  const lignes: Ligne[] = [];
  for (let debut = 0; ; debut += TAILLE_PAGE) {
    const { data, error } = await admin.from(table).select('*').order('id').range(debut, debut + TAILLE_PAGE - 1);
    if (error) throw new Error(`lecture de la table « ${table} » impossible (${error.message})`);
    lignes.push(...(data ?? []));
    if (!data || data.length < TAILLE_PAGE) return lignes;
  }
}

// Les mapXxxFromDb de l'app sont des renommages snake_case -> camelCase. Une conversion generique
// suit toute nouvelle colonne sans qu'on pense a la reporter ici ; l'import de l'app ne garde que
// les champs qu'il connait (mapXxxToDb).
function versApp(ligne: Ligne): Ligne {
  const objet: Ligne = {};
  for (const [colonne, valeur] of Object.entries(ligne)) {
    if (colonne === 'user_id') continue;
    objet[colonne.replace(/_([a-z0-9])/g, (_, c: string) => c.toUpperCase())] = valeur;
  }
  return objet;
}

async function construireSauvegarde(le: string) {
  const lectures = await Promise.all([...TABLES.map((t) => lireTable(t.table)), lireTable('parametres')]);
  const sauvegarde: Record<string, unknown> = { _sauvegarde: { format: 2, le, source: 'sauvegarde-hebdo' } };
  const compte: { libelle: string; n: number }[] = [];
  TABLES.forEach((t, i) => {
    sauvegarde[t.cle] = t.brut ? lectures[i] : lectures[i].map(versApp);
    compte.push({ libelle: t.libelle, n: lectures[i].length });
  });
  const parametres: Ligne = {};
  for (const ligne of lectures[TABLES.length]) {
    const cle = String(ligne.cle);
    if (!CLES_CONNEXION_GOOGLE.includes(cle)) parametres[cle] = ligne.valeur;
  }
  sauvegarde.parametres = parametres;
  compte.push({ libelle: 'Réglages', n: Object.keys(parametres).length });
  return { sauvegarde, compte };
}

function base64(texte: string): string {
  const octets = new TextEncoder().encode(texte);
  let binaire = '';
  for (let i = 0; i < octets.length; i += 0x8000) {
    binaire += String.fromCharCode(...octets.subarray(i, i + 0x8000));
  }
  return btoa(binaire);
}

// Comparaison a duree constante : on compare les empreintes (meme longueur, quel que soit l'essai)
async function secretValide(recu: string): Promise<boolean> {
  const empreinte = async (s: string) =>
    new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)));
  const [a, b] = await Promise.all([empreinte(recu), empreinte(SECRET)]);
  let difference = 0;
  for (let i = 0; i < a.length; i++) difference |= a[i] ^ b[i];
  return difference === 0;
}

async function envoyer(sujet: string, texte: string, pieceJointe?: { filename: string; content: string }) {
  const rep = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: EXPEDITEUR,
      to: [DESTINATAIRE],
      subject: sujet,
      text: texte,
      ...(pieceJointe ? { attachments: [pieceJointe] } : {}),
    }),
  });
  if (!rep.ok) throw new Error(`envoi de l'e-mail refusé par Resend (${rep.status} : ${await rep.text()})`);
}

function reponse(statut: number, corps: unknown): Response {
  return new Response(JSON.stringify(corps), { status: statut, headers: { 'Content-Type': 'application/json' } });
}

Deno.serve(async (req: Request) => {
  if (!SECRET) return reponse(500, { error: 'SAUVEGARDE_SECRET manquant' });
  if (!(await secretValide(req.headers.get('x-sauvegarde-secret') ?? ''))) return reponse(401, { error: 'Non autorisé' });
  if (req.method !== 'POST') return reponse(405, { error: 'POST attendu' });
  if (!RESEND_API_KEY || !DESTINATAIRE) return reponse(500, { error: 'RESEND_API_KEY ou SAUVEGARDE_DESTINATAIRE manquant' });

  const maintenant = new Date();
  const jour = new Intl.DateTimeFormat('fr-CA', { timeZone: 'Europe/Paris' }).format(maintenant); // AAAA-MM-JJ
  const jourLisible = new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', dateStyle: 'full' }).format(maintenant);

  try {
    const { sauvegarde, compte } = await construireSauvegarde(maintenant.toISOString());
    const nomFichier = `sauvegarde-elise-massage-${jour}.json`;
    const lignes = compte.map((c) => `- ${c.libelle} : ${c.n}`).join('\n');
    await envoyer(
      `Sauvegarde Elise Massage du ${jour}`,
      `Bonjour Elise,\n\n` +
        `Voici la sauvegarde automatique de tes données du ${jourLisible}, en pièce jointe (${nomFichier}).\n` +
        `Garde cet e-mail : en cas de problème, ce fichier remet tout en place depuis l'application ` +
        `(bouton « Importer » en haut, ou menu ☰ > Importer des données sur le téléphone).\n\n` +
        `Contenu :\n${lignes}\n\nÀ lundi prochain !`,
      { filename: nomFichier, content: base64(JSON.stringify(sauvegarde, null, 2)) },
    );
    return reponse(200, { ok: true, fichier: nomFichier, compte });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error('sauvegarde-hebdo :', message);
    try {
      await envoyer(
        `Sauvegarde Elise Massage du ${jour} : ÉCHEC`,
        `Bonjour,\n\nLa sauvegarde automatique de cette semaine n'a pas pu être faite.\n\nDétail : ${message}\n\n` +
          `En attendant, une sauvegarde manuelle est possible depuis l'application (bouton « Exporter »).`,
      );
    } catch (e2) {
      console.error('sauvegarde-hebdo, e-mail d\'échec :', e2 instanceof Error ? e2.message : e2);
    }
    return reponse(500, { error: message });
  }
});
