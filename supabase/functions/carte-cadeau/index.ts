// Fonction Supabase « carte-cadeau » (v1.3.0.0) : carte cadeau payee par carte bancaire sur le site,
// bon PDF envoye aussitot par e-mail. Plan et decisions : tasks/todo-carte-cadeau-en-ligne.md.
//
// Routes, sans session (deployee avec verify_jwt = false) :
//   POST commande               formulaire du site -> { url } de la page de paiement SumUp (hosted checkout)
//   GET  statut?commande=...    page « Merci » du site -> { statut, email, papier, essai }
//   POST sumup                  notification SumUp (CHECKOUT_STATUS_CHANGED, seulement l'id du paiement)
//   POST relancer               pg_cron toutes les 10 min (en-tete x-sauvegarde-secret) : filet de securite
//   GET  etat                   la cle SumUp repond-elle ? compte de test ou reel ?
// Une notification ne prouve rien : le statut est TOUJOURS redemande a SumUp avec la cle secrete.
//
// Au paiement : le bon est cree dans bons_cadeaux (compte SumUp de test : marque [ESSAI], a supprimer
// apres verification ; demande de Jordan, pour tout verifier jusqu'au logiciel), le PDF est fait avec le
// MEME code que le bouton 🖨️ de l'app (js/core/bon-cadeau-carte.js : modele, polices et regles), puis
// envoye a l'acheteur SEULEMENT (Elise est prevenue a part). Rejouable sans doublon : un seul envoi a
// la fois (statut + tentative_le), id du bon fixe des la commande, cle d'idempotence chez Resend. Si
// l'envoi echoue, la notification repond 500 : SumUp la renvoie (1 min, 5 min, 20 min, 2 h).
//
// Secrets : SUMUP_API_KEY (compte de test d'abord), RESEND_API_KEY, SAUVEGARDE_DESTINATAIRE (l'adresse
// d'Elise) et SAUVEGARDE_SECRET (route relancer), les memes que les sauvegardes. SUPABASE_URL et
// SUPABASE_SERVICE_ROLE_KEY : fournis par Supabase.
// Au deploiement, joindre les trois fichiers js/core importes ci-dessous (memes chemins relatifs).

import { createClient } from 'npm:@supabase/supabase-js@2';
import * as PDFLib from 'npm:pdf-lib@1.17.1';
import fontkit from 'npm:@pdf-lib/fontkit@1.1.1';
// Regles partagees avec l'app (scripts classiques : ils se rangent dans globalThis)
import '../../../js/core/bon-cadeau-carte.js';
import '../../../js/core/bons-cadeaux.js';
import '../../../js/core/carte-cadeau-commande.js';

// deno-lint-ignore no-explicit-any
const G = globalThis as any;
const C = G.BonCadeauCarte;
const BonsCadeaux = G.BonsCadeaux;
const K = G.CarteCadeauCommande;

const SUMUP_API_KEY = Deno.env.get('SUMUP_API_KEY') ?? '';
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? '';
const ELISE = Deno.env.get('SAUVEGARDE_DESTINATAIRE') ?? '';
const UTILISATRICE = 'a202db6e-2f5c-4c33-9ce7-8b14dde15327'; // compte d'Elise dans le logiciel
// Expediteur no-reply (decision de Jordan) ; les reponses vont a contact@ (reply_to) : Resend deconseille
// un no-reply sans adresse de reponse (risque de courriers indesirables), Jordan d'accord le 2026-11-03
const EXPEDITEUR = 'Elise Massage <no-reply@elise-massage.fr>';
const SUMUP = 'https://api.sumup.com';
const ICI = `${Deno.env.get('SUPABASE_URL')}/functions/v1/carte-cadeau`;
// Modele et polices du bon : ceux de l'app publiee (meme fichiers que le bouton 🖨️)
const MODELE = 'https://app.elise-massage.fr/assets/bon-cadeau/';

const INSTITUT = {
  telephone: '06 37 49 76 25',
  email: 'contact@elise-massage.fr',
  adresse: '3 Cours Général Leclerc, 20000 Ajaccio (à l’étage du salon « La Bouclette »)',
};

// Le site en ligne. Qui peut payer avec quel compte SumUp : K.refusPaiement (js/core/carte-cadeau-commande.js)
const SITES = ['https://www.elise-massage.fr', 'https://elise-massage.fr'];

const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false },
});

type Commande = Record<string, any>; // une ligne de commandes_carte_cadeau

// ---------- Petits outils ----------

function entetes(req: Request): Record<string, string> {
  const origine = req.headers.get('Origin') ?? '';
  return {
    'Access-Control-Allow-Origin': K.origineConnue(origine) ? origine : SITES[0],
    'Access-Control-Allow-Headers': 'content-type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Vary': 'Origin',
  };
}

function reponse(req: Request, statut: number, corps: unknown): Response {
  return new Response(JSON.stringify(corps), { status: statut, headers: { ...entetes(req), 'Content-Type': 'application/json' } });
}

const message = (e: unknown) => (e instanceof Error ? e.message : String(e));
const aleatoire = (octets: number) =>
  Array.from(crypto.getRandomValues(new Uint8Array(octets)), (o) => o.toString(16).padStart(2, '0')).join('');
// Jour 'AAAA-MM-JJ' a Ajaccio (les dates de l'app sont des chaines locales)
const jourParis = (d: Date) => new Intl.DateTimeFormat('fr-CA', { timeZone: 'Europe/Paris' }).format(d);
const dateLisible = (jour: string) =>
  new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long', timeZone: 'UTC' }).format(new Date(`${jour}T00:00:00Z`));
const euros = (m: number) => `${Number.isInteger(Number(m)) ? m : Number(m).toFixed(2).replace('.', ',')} €`;
const html = (v: unknown) => String(v ?? '').replace(/[&<>"']/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

// ---------- SumUp ----------

async function sumup(chemin: string, init: RequestInit = {}) {
  const rep = await fetch(SUMUP + chemin, {
    ...init,
    headers: { 'Authorization': `Bearer ${SUMUP_API_KEY}`, 'Content-Type': 'application/json' },
  });
  const corps = await rep.text();
  if (!rep.ok) throw new Error(`SumUp ${init.method ?? 'GET'} ${chemin} : ${rep.status} ${corps.slice(0, 300)}`);
  return corps ? JSON.parse(corps) : null;
}

// Le compte que designe la cle : son code marchand, et s'il s'agit du compte de test (bac a sable)
let compte: Promise<{ code: string; essai: boolean }> | null = null;
function compteSumup() {
  compte ??= (async () => {
    const moi = await sumup('/v0.1/me');
    const code = moi?.merchant_profile?.merchant_code;
    if (!code) throw new Error('SumUp : code marchand introuvable (/v0.1/me)');
    const marchand = await sumup(`/v1/merchants/${encodeURIComponent(code)}`);
    return { code, essai: marchand?.sandbox === true };
  })().catch((e) => { compte = null; throw e; });
  return compte;
}

// ---------- Tarifs du site ----------

// Prix : la liste publiee par le site a chaque construction (src/data/soins.ts, seule source des prix),
// lue sur le deploiement Cloudflare d'ou vient la commande : celui de production pour
// www.elise-massage.fr ; pour le serveur de developpement, la branche d'essai
// (node scripts/publier.mjs --branche=essai, dans le depot du site)
function adresseTarifs(origine: string) {
  if (/^https:\/\/([a-z0-9-]+\.)?elise-massage\.pages\.dev$/.test(origine)) return `${origine}/tarifs-carte-cadeau.json`;
  if (SITES.includes(origine)) return 'https://elise-massage.pages.dev/tarifs-carte-cadeau.json';
  return 'https://essai.elise-massage.pages.dev/tarifs-carte-cadeau.json';
}

const tarifs = new Map<string, { valeur: Promise<unknown>; lu: number }>();
function lireTarifs(origine: string) {
  const adresse = adresseTarifs(origine);
  const connu = tarifs.get(adresse);
  if (connu && Date.now() - connu.lu < 5 * 60 * 1000) return connu.valeur;
  const valeur = fetch(adresse).then((r) => {
    if (!r.ok) throw new Error(`liste des prix du site illisible (${adresse} : ${r.status})`);
    return r.json();
  });
  tarifs.set(adresse, { valeur, lu: Date.now() });
  valeur.catch(() => tarifs.delete(adresse));
  return valeur;
}

// ---------- Le bon en PDF ----------

// GitHub Pages repond parfois 503 un court instant (constate le 2026-11-03) : 3 essais espaces
async function lire(nom: string): Promise<Uint8Array> {
  for (let essai = 1; ; essai++) {
    try {
      const r = await fetch(MODELE + nom);
      if (!r.ok) throw new Error(`${nom} introuvable (${r.status})`);
      return new Uint8Array(await r.arrayBuffer());
    } catch (e) {
      if (essai >= 3) throw e;
      await new Promise((ok) => setTimeout(ok, 700 * essai));
    }
  }
}

let ressources: Promise<Record<string, any>> | null = null;
function chargerRessources() {
  ressources ??= (async () => {
    const [modele, semi, fin, emoji] = await Promise.all(
      ['bon-vierge.pdf', 'BonCadeauSans-SemiBold.ttf', 'BonCadeauSans-Regular.ttf', 'BonCadeauEmoji.ttf'].map(lire));
    const texte = fontkit.create(semi);
    const dessins = fontkit.create(emoji);
    const couvre = (car: string, estEmoji: boolean) => (estEmoji ? dessins : texte).hasGlyphForCodePoint(car.codePointAt(0));
    return { modele, semi, fin, emoji, couvre };
  })().catch((e) => { ressources = null; throw e; });
  return ressources;
}

// Ce qui empeche d'imprimer la carte, rapporte aux champs du formulaire du site
const CHAMP_DU_FORMULAIRE: Record<string, { champ: string; libelle: string }> = {
  offertPar: { champ: 'acheteurPrenom', libelle: 'Votre prénom' },
  pour: { champ: 'beneficiairePrenom', libelle: 'Prénom du bénéficiaire' },
  soin: { champ: 'prestation', libelle: 'Prestation' },
  message: { champ: 'message', libelle: 'Message' },
};

async function problemesImpression(carte: Record<string, string>) {
  const r = await chargerRessources();
  const doc = await PDFLib.PDFDocument.create();
  doc.registerFontkit(fontkit);
  const semi = await doc.embedFont(r.semi, { subset: true });
  const emoji = await doc.embedFont(r.emoji, { subset: true });
  const compo = C.composer(carte, (t: string, taille: number, e: boolean) => (e ? emoji : semi).widthOfTextAtSize(t, taille));
  return C.problemes(compo, r.couvre).map((p: Record<string, any>) => {
    const f = CHAMP_DU_FORMULAIRE[p.cle];
    return {
      champ: f.champ,
      message: p.raison === 'tropLong'
        ? `${f.libelle} : trop long pour tenir sur la carte, raccourcissez-le.`
        : `${f.libelle} : ces caractères ne s'impriment pas sur la carte : ${p.caracteres.join(' ')}`,
    };
  });
}

async function pdfDuBon(carte: Record<string, string>) {
  return C.creerPdf({ PDFLib, fontkit }, await chargerRessources(), carte) as Promise<Uint8Array>;
}

function base64(octets: Uint8Array): string {
  let binaire = '';
  for (let i = 0; i < octets.length; i += 0x8000) binaire += String.fromCharCode(...octets.subarray(i, i + 0x8000));
  return btoa(binaire);
}

// ---------- E-mails (Resend) ----------

async function envoyer(courriel: Record<string, unknown>, idempotence: string) {
  const rep = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
      'Idempotency-Key': idempotence, // un envoi rejoue ne part pas deux fois
    },
    body: JSON.stringify({ from: EXPEDITEUR, ...courriel }),
  });
  if (!rep.ok) throw new Error(`e-mail refusé par Resend (${rep.status} : ${(await rep.text()).slice(0, 300)})`);
}

const prefixe = (c: Commande) => (c.essai ? '[ESSAI] ' : '');
// Compte SumUp de test : rien ne part chez Elise, tout va a l'adresse saisie dans le formulaire
const adresseElise = (c: Commande) => (c.essai ? c.email_reception : ELISE);
const nomComplet = (prenom: string, nom: string) => `${prenom} ${nom}`.trim();

function courrielAcheteur(c: Commande, fin: string, transaction: string, piece: Record<string, string>) {
  const lignes: [string, string][] = [
    ['Pour', nomComplet(c.beneficiaire_prenom, c.beneficiaire_nom)],
    ['Soin', c.soin],
    ['Montant payé', `${euros(c.montant)} par carte bancaire`],
    ['Valable jusqu’au', dateLisible(fin)],
    ...(transaction ? [['Référence du paiement', transaction] as [string, string]] : []),
  ];
  const papier = c.papier
    ? 'Le bon imprimé vous attend aussi à l’institut : passez le retirer quand vous le souhaitez, c’est offert.'
    : 'Vous préférez un bon imprimé ? Passez le retirer à l’institut quand vous le souhaitez, c’est offert.';
  const reserver = `Pour réserver, ${c.beneficiaire_prenom} m’appelle au ${INSTITUT.telephone}, ou réserve directement sur Planity si le délai le permet.`;
  const pied = `Une question ? Répondez simplement à cet e-mail, ou appelez-moi au ${INSTITUT.telephone}.`;

  const texte = [
    `Bonjour ${c.acheteur_prenom},`, '',
    `Merci pour votre achat ! Voici la carte cadeau pour ${c.beneficiaire_prenom}, en pièce jointe (PDF) : à imprimer ou à lui transférer.`, '',
    ...lignes.map(([k, v]) => `${k} : ${v}`), '',
    papier, reserver, `L’institut : ${INSTITUT.adresse}.`, '',
    'À très bientôt,', 'Elise', '', '--', pied,
  ].join('\n');

  const corps = `<!doctype html><html lang="fr"><body style="margin:0;background:#f6efec;padding:24px 12px;font-family:Helvetica,Arial,sans-serif;color:#2a2a2c">
<div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:16px;padding:32px 28px">
<p style="margin:0 0 6px;color:#a8665a;font-size:12px;letter-spacing:.08em;text-transform:uppercase">Elise Massage &amp; Bien-être</p>
<h1 style="margin:0 0 20px;font-size:24px;font-weight:600;line-height:1.25">Votre carte cadeau pour ${html(c.beneficiaire_prenom)}</h1>
<p style="margin:0 0 16px;line-height:1.55">Bonjour ${html(c.acheteur_prenom)},</p>
<p style="margin:0 0 20px;line-height:1.55">Merci pour votre achat&#8239;! Voici la carte cadeau, en pièce jointe (PDF)&#8239;: à imprimer ou à lui transférer.</p>
<table role="presentation" style="width:100%;border-collapse:collapse;margin:0 0 20px;background:#f6efec;border-radius:12px">
${lignes.map(([k, v]) => `<tr><td style="padding:10px 14px;color:#6b6b70;font-size:14px;white-space:nowrap;vertical-align:top">${html(k)}</td><td style="padding:10px 14px;font-size:14px;font-weight:600">${html(v)}</td></tr>`).join('\n')}
</table>
<p style="margin:0 0 12px;line-height:1.55">${html(papier)}</p>
<p style="margin:0 0 12px;line-height:1.55">${html(reserver)}</p>
<p style="margin:0 0 20px;line-height:1.55;color:#6b6b70;font-size:14px">L’institut&#8239;: ${html(INSTITUT.adresse)}.</p>
<p style="margin:0;line-height:1.55">À très bientôt,<br>Elise</p>
</div>
<p style="max-width:560px;margin:16px auto 0;color:#6b6b70;font-size:12px;line-height:1.5;text-align:center">${html(pied)}</p>
</body></html>`;

  return {
    to: [c.email_reception],
    reply_to: INSTITUT.email,
    subject: `${prefixe(c)}Votre carte cadeau pour ${c.beneficiaire_prenom} 🎁`,
    text: texte,
    html: corps,
    attachments: [piece],
  };
}

function courrielElise(c: Commande, fin: string, transaction: string, piece: Record<string, string>) {
  const texte = [
    'Bonjour Elise,', '',
    `Une carte cadeau vient d’être payée en ligne sur le site (${euros(c.montant)}, carte bancaire).`,
    c.essai
      ? 'ESSAI (compte SumUp de test) : rien n’a été payé pour de vrai. Le bon d’essai est dans le logiciel (marqué [ESSAI]) : à supprimer après vérification.'
      : 'Le bon est déjà dans le logiciel (Bons cadeaux, payé en Carte bleue). Le PDF ci-joint a été envoyé au client.',
    ...(c.papier ? ['', '➡️ Version papier demandée : à imprimer, le client passera la retirer à l’institut.'] : []),
    '',
    `Soin : ${c.soin}`,
    `Pour : ${nomComplet(c.beneficiaire_prenom, c.beneficiaire_nom)}${c.beneficiaire_telephone ? ` (${c.beneficiaire_telephone})` : ''}`,
    `Offert par : ${nomComplet(c.acheteur_prenom, c.acheteur_nom)}, ${c.acheteur_email}${c.acheteur_telephone ? `, ${c.acheteur_telephone}` : ''}`,
    `Bon envoyé à : ${c.email_reception}`,
    `Valable jusqu’au : ${dateLisible(fin)}`,
    ...(c.message ? [`Message : ${c.message}`] : []),
    ...(c.remarques ? [`Remarques : ${c.remarques}`] : []),
    `Paiement SumUp : ${transaction || c.sumup_checkout_id}`,
    `Commande : ${c.id}`,
  ].join('\n');
  return {
    to: [adresseElise(c)],
    reply_to: c.acheteur_email, // Elise repond directement au client
    subject: `${prefixe(c)}🎁 Carte cadeau payée en ligne : ${c.soin} pour ${c.beneficiaire_prenom}`,
    text: texte,
    attachments: [piece],
  };
}

async function alerterElise(c: Commande, erreur: string) {
  await envoyer({
    to: [adresseElise(c)],
    reply_to: c.acheteur_email,
    subject: `${prefixe(c)}⚠️ Carte cadeau payée mais pas encore envoyée (${c.beneficiaire_prenom})`,
    text: [
      'Bonjour Elise,', '',
      `Une carte cadeau a été payée en ligne (${euros(c.montant)}), mais son envoi automatique a échoué :`,
      erreur, '',
      'Le système réessaie tout seul pendant quelques heures. Si tu ne reçois pas ensuite l’e-mail',
      '« Carte cadeau payée en ligne », crée le bon dans le logiciel et envoie-le au client toi-même (bouton 🖨️).', '',
      `Soin : ${c.soin}`,
      `Pour : ${nomComplet(c.beneficiaire_prenom, c.beneficiaire_nom)}`,
      `Offert par : ${nomComplet(c.acheteur_prenom, c.acheteur_nom)}, ${c.acheteur_email}${c.acheteur_telephone ? `, ${c.acheteur_telephone}` : ''}`,
      `Bon à envoyer à : ${c.email_reception}`,
      `Commande : ${c.id}`,
    ].join('\n'),
  }, `carte-cadeau/${c.id}/alerte`);
}

// ---------- Le bon dans le logiciel ----------

async function validiteMois(): Promise<number> {
  const { data } = await admin.from('parametres').select('valeur')
    .eq('user_id', UTILISATRICE).eq('cle', 'validiteBonsCadeauxMois').maybeSingle();
  const mois = Number(data?.valeur);
  return Number.isInteger(mois) && mois > 0 ? mois : 6; // comme l'app (calculerDateExpiration)
}

async function creerBon(c: Commande, jour: string, fin: string, transaction: string) {
  const notes = [
    ...(c.essai ? ['ESSAI (compte SumUp de test, aucun argent réel) : bon à supprimer après vérification.'] : []),
    `Payé en ligne sur le site (carte bancaire, SumUp) le ${dateLisible(jour)}${transaction ? `, transaction ${transaction}` : ''}.`,
    `Bon PDF envoyé par e-mail à ${c.email_reception}.`,
    ...(c.papier ? ['Version papier demandée : bon imprimé à retirer à l’institut.'] : []),
    ...(c.beneficiaire_telephone ? [`Téléphone du bénéficiaire : ${c.beneficiaire_telephone}`] : []),
    ...(c.remarques ? [`Remarques : ${c.remarques}`] : []),
    `Commande en ligne ${c.id}.`,
  ].join('\n');
  const carte = Object.fromEntries(C.CLES.map((cle: string) => [cle, C.typographier(c.carte[cle], C.CHAMPS[cle].multi)]));
  const { error } = await admin.from('bons_cadeaux').upsert({
    id: c.bon_cadeau_id,
    user_id: UTILISATRICE,
    montant: c.montant,
    date_achat: jour,
    date_debut: jour,
    date_expiration: fin,
    statut: 'actif',
    acheteur_nom: nomComplet(c.acheteur_prenom, c.acheteur_nom),
    acheteur_telephone: c.acheteur_telephone || null,
    acheteur_email: c.acheteur_email,
    beneficiaire_nom: nomComplet(c.beneficiaire_prenom, c.beneficiaire_nom),
    description: `${c.essai ? '[ESSAI] ' : ''}${c.soin}`,
    // « Carte bleue » : un des moyens de l'app, compte dans les encaissements (js/core/encaissements.js)
    moyen_paiement: 'Carte bleue',
    notes,
    carte,
  }, { onConflict: 'id', ignoreDuplicates: true });
  if (error) throw new Error(`bon non créé dans le logiciel (${error.message})`);
}

// ---------- Suivi d'une commande ----------

async function relire(id: string): Promise<Commande | null> {
  const { data, error } = await admin.from('commandes_carte_cadeau').select('*').eq('id', id).maybeSingle();
  if (error) throw new Error(`commande illisible (${error.message})`);
  return data;
}

/** Bon + PDF + e-mails, une seule fois : la commande est d'abord « prise » (statut payee + tentative_le). */
async function livrer(c: Commande, paiement: Record<string, any>) {
  const maintenant = new Date();
  const transaction = paiement.transactions?.find((t: Record<string, string>) => t.status === 'SUCCESSFUL')?.transaction_code
    ?? paiement.transaction_code ?? '';
  // Un envoi interrompu (plus de 2 min) peut etre repris ; jamais deux en meme temps
  const limite = new Date(maintenant.getTime() - 2 * 60 * 1000).toISOString();
  const { data: prise, error } = await admin.from('commandes_carte_cadeau')
    .update({
      statut: 'payee',
      paye_le: c.paye_le ?? maintenant.toISOString(),
      tentative_le: maintenant.toISOString(),
      sumup_transaction_code: transaction || null,
    })
    .eq('id', c.id)
    .or(`statut.in.(en_attente,echouee),and(statut.eq.payee,tentative_le.lt."${limite}")`)
    .select('*').maybeSingle();
  if (error) throw new Error(`commande non mise à jour (${error.message})`);
  if (!prise) return relire(c.id); // deja envoyee, ou un envoi est en cours ailleurs

  try {
    const jour = jourParis(new Date(prise.paye_le));
    const fin = BonsCadeaux.ajouterMois(jour, await validiteMois());
    await creerBon(prise, jour, fin, transaction);
    const pdf = await pdfDuBon(prise.carte);
    const piece = { filename: C.nomDeFichier(prise.carte.pour, jour), content: base64(pdf) };
    await envoyer(courrielAcheteur(prise, fin, transaction, piece), `carte-cadeau/${prise.id}/acheteur`);
    await envoyer(courrielElise(prise, fin, transaction, piece), `carte-cadeau/${prise.id}/elise`);
    const { data: envoyee } = await admin.from('commandes_carte_cadeau')
      .update({ statut: 'envoyee', envoye_le: new Date().toISOString(), erreur: null })
      .eq('id', prise.id).select('*').maybeSingle();
    return envoyee ?? prise;
  } catch (e) {
    const erreur = message(e);
    console.error('carte-cadeau, envoi :', prise.id, erreur);
    await admin.from('commandes_carte_cadeau').update({ erreur }).eq('id', prise.id);
    if (!prise.alerte_le) {
      try {
        await alerterElise(prise, erreur);
        await admin.from('commandes_carte_cadeau').update({ alerte_le: new Date().toISOString() }).eq('id', prise.id);
      } catch (e2) {
        console.error('carte-cadeau, alerte :', prise.id, message(e2));
      }
    }
    throw e;
  }
}

/** Redemande le statut a SumUp et agit : envoi si paye, sinon note l'echec ou l'expiration. */
async function suivre(c: Commande): Promise<Commande | null> {
  if (!c.sumup_checkout_id || c.statut === 'envoyee' || c.statut === 'expiree') return c;
  const paiement = await sumup(`/v0.1/checkouts/${encodeURIComponent(c.sumup_checkout_id)}`);
  const etat = K.statutSumup(paiement, c);
  if (etat === 'payee') return livrer(c, paiement);
  if (etat === 'anomalie') {
    console.error('carte-cadeau, paiement non conforme :', c.id, JSON.stringify(paiement).slice(0, 500));
    await admin.from('commandes_carte_cadeau').update({ erreur: 'Paiement SumUp non conforme à la commande (montant, devise ou référence)' }).eq('id', c.id);
    return relire(c.id);
  }
  if ((etat === 'echouee' || etat === 'expiree') && etat !== c.statut && c.statut !== 'payee') {
    await admin.from('commandes_carte_cadeau').update({ statut: etat }).eq('id', c.id).in('statut', ['en_attente', 'echouee']);
    return relire(c.id);
  }
  return c;
}

// ---------- Routes ----------

async function commander(req: Request, origine: string) {
  const brut = await req.text();
  if (brut.length > 20000) return reponse(req, 413, { erreur: 'Formulaire trop long.' });
  let corps: Record<string, any>;
  try { corps = JSON.parse(brut); } catch { return reponse(req, 400, { erreur: 'Formulaire illisible.' }); }
  if (corps.botcheck) return reponse(req, 400, { erreur: 'Formulaire refusé.' }); // pot de miel du site

  // Un client ne tombe jamais sur la page de paiement de test (site publie avant la vraie cle), et le
  // serveur de developpement ne paie jamais pour de vrai
  const { code, essai } = await compteSumup();
  const refus = K.refusPaiement(origine, essai);
  if (refus) {
    return reponse(req, 403, {
      erreur: refus === 'test'
        ? `Le paiement par carte en ligne ouvre bientôt : choisissez le virement ou le paiement sur place, ou appelez-moi au ${INSTITUT.telephone}.`
        : 'Paiement refusé depuis cette adresse.',
    });
  }
  const lu = K.lireCommande(corps, await lireTarifs(origine));
  if (lu.erreurs) return reponse(req, 400, { erreurs: lu.erreurs });
  const k = lu.commande;
  const impression = await problemesImpression(k.carte);
  if (impression.length) return reponse(req, 400, { erreurs: impression });

  const id = K.nouvelleReference(aleatoire(12));
  const { error } = await admin.from('commandes_carte_cadeau').insert({
    id,
    user_id: UTILISATRICE,
    essai,
    origine,
    montant: k.montant,
    prestation: k.prestation,
    soin: k.soin,
    beneficiaire_prenom: k.beneficiairePrenom,
    beneficiaire_nom: k.beneficiaireNom,
    beneficiaire_telephone: k.beneficiaireTelephone || null,
    acheteur_prenom: k.acheteurPrenom,
    acheteur_nom: k.acheteurNom,
    acheteur_email: k.acheteurEmail,
    acheteur_telephone: k.acheteurTelephone || null,
    email_reception: k.emailReception,
    message: k.message || null,
    papier: k.papier,
    remarques: k.remarques || null,
    carte: k.carte,
    // Meme forme que les id de l'app (DataManager.generateId)
    bon_cadeau_id: `id_${Date.now()}_${aleatoire(5).slice(0, 9)}`,
  });
  if (error) throw new Error(`commande non enregistrée (${error.message})`);

  try {
    const paiement = await sumup('/v0.1/checkouts', {
      method: 'POST',
      body: JSON.stringify({
        checkout_reference: id,
        amount: k.montant,
        currency: 'EUR',
        merchant_code: code,
        description: `Carte cadeau Elise Massage : ${k.soin}`.slice(0, 255),
        return_url: `${ICI}/sumup`,
        redirect_url: `${origine}/carte-cadeau-merci?commande=${id}`,
        hosted_checkout: { enabled: true },
      }),
    });
    if (!paiement?.hosted_checkout_url) throw new Error('SumUp : pas de page de paiement dans la réponse');
    await admin.from('commandes_carte_cadeau').update({ sumup_checkout_id: paiement.id }).eq('id', id);
    return reponse(req, 200, { url: paiement.hosted_checkout_url, commande: id });
  } catch (e) {
    await admin.from('commandes_carte_cadeau').update({ statut: 'echouee', erreur: message(e) }).eq('id', id);
    throw e;
  }
}

async function statut(req: Request) {
  const id = new URL(req.url).searchParams.get('commande') ?? '';
  if (!/^cc_[0-9a-z]+_[0-9a-f]{24}$/.test(id)) return reponse(req, 400, { erreur: 'Commande inconnue.' });
  let c = await relire(id);
  if (!c) return reponse(req, 404, { erreur: 'Commande inconnue.' });
  // Le client revient parfois avant la notification de SumUp : on redemande nous-memes
  try { c = (await suivre(c)) ?? c; } catch (e) { console.error('carte-cadeau, statut :', id, message(e)); c = (await relire(id)) ?? c; }
  return reponse(req, 200, { statut: c.statut, email: K.masquerEmail(c.email_reception), papier: c.papier, essai: c.essai });
}

async function notification(req: Request) {
  let corps: Record<string, string> = {};
  try { corps = await req.json(); } catch { /* corps vide : ignore */ }
  // Evenement inconnu : ignore sans erreur (recommandation de SumUp)
  if (corps.event_type !== 'CHECKOUT_STATUS_CHANGED' || !corps.id) return new Response(null, { status: 204 });
  const { data: c } = await admin.from('commandes_carte_cadeau').select('*').eq('sumup_checkout_id', corps.id).maybeSingle();
  if (!c) return new Response(null, { status: 204 });
  // Une erreur, ou un envoi pas encore fini (fait ailleurs en ce moment) -> 500 : SumUp renverra la
  // notification (1 min, 5 min, 20 min, 2 h) jusqu'a ce que la commande soit envoyee
  const apres = await suivre(c);
  if (apres?.statut === 'payee') return new Response(null, { status: 500 });
  return new Response(null, { status: 204 });
}

// Comparaison a duree constante (comme sauvegarde-hebdo) : on compare les empreintes
async function secretValide(recu: string): Promise<boolean> {
  const secret = Deno.env.get('SAUVEGARDE_SECRET') ?? '';
  if (!secret) return false;
  const empreinte = async (s: string) => new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)));
  const [a, b] = await Promise.all([empreinte(recu), empreinte(secret)]);
  let difference = 0;
  for (let i = 0; i < a.length; i++) difference |= a[i] ^ b[i];
  return difference === 0;
}

/**
 * Filet de securite (pg_cron, toutes les 10 min, scripts/migration-carte-cadeau-en-ligne.sql) : si la
 * notification de SumUp n'arrive jamais et que le client ne revient pas sur le site, la commande payee
 * est quand meme envoyee. Commandes des dernieres 24 h pas encore envoyees.
 */
async function relancer(req: Request) {
  if (!(await secretValide(req.headers.get('x-sauvegarde-secret') ?? ''))) return reponse(req, 401, { erreur: 'Non autorisé' });
  const depuis = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const { data, error } = await admin.from('commandes_carte_cadeau').select('*')
    .in('statut', ['en_attente', 'echouee', 'payee']).gte('cree_le', depuis).not('sumup_checkout_id', 'is', null);
  if (error) throw new Error(`commandes illisibles (${error.message})`);
  const bilan: Record<string, string> = {};
  for (const c of data ?? []) {
    try { bilan[c.id] = (await suivre(c))?.statut ?? '?'; } catch (e) { bilan[c.id] = `erreur : ${message(e)}`; }
  }
  return reponse(req, 200, { suivies: Object.keys(bilan).length, bilan });
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: entetes(req) });
  const route = new URL(req.url).pathname.replace(/^.*?\/carte-cadeau\/?/, '');
  const origine = req.headers.get('Origin') ?? '';
  try {
    if (!SUMUP_API_KEY || !RESEND_API_KEY || !ELISE) return reponse(req, 500, { erreur: 'Paiement en ligne pas encore configuré.' });
    if (route === 'sumup' && req.method === 'POST') return await notification(req);
    if (route === 'relancer' && req.method === 'POST') return await relancer(req);
    if (route === 'statut' && req.method === 'GET') return await statut(req);
    if (route === 'etat' && req.method === 'GET') {
      const { essai } = await compteSumup();
      return reponse(req, 200, { sumup: 'ok', essai });
    }
    if (route === 'commande' && req.method === 'POST') {
      if (!K.origineConnue(origine)) return reponse(req, 403, { erreur: 'Origine refusée.' });
      return await commander(req, origine);
    }
    return reponse(req, 404, { erreur: 'Adresse inconnue.' });
  } catch (e) {
    console.error('carte-cadeau :', route, message(e));
    return reponse(req, 500, {
      erreur: `Le paiement en ligne est momentanément indisponible. Réessayez dans quelques minutes, ou appelez-moi au ${INSTITUT.telephone}.`,
    });
  }
});
