// ===== CARTE CADEAU PAYEE SUR LE SITE : REGLES PURES (v1.3.0.0) =====
// Ce que la fonction Supabase « carte-cadeau » fait du formulaire du site, sans reseau ni base :
// verifier les champs, retrouver le prix dans la liste publiee par le site (jamais celui envoye par
// le navigateur), ecrire les textes du bon comme l'apercu du site, lire la reponse de SumUp.
// Teste sous Node (tests/carte-cadeau-commande.test.js). Plan : tasks/todo-carte-cadeau-en-ligne.md

(function (racine) {

const Carte = racine.BonCadeauCarte || (typeof require === 'function' ? require('./bon-cadeau-carte.js') : null);

const LIMITES = { nom: 60, email: 120, telephone: 30, message: 160, remarques: 1000 };
const EMAIL = /^[^\s@<>,;"]+@[^\s@<>,;"]+\.[^\s@<>,;"]+$/;
const TELEPHONE = /^[0-9+().\s-]*$/;

const texte = v => (typeof v === 'string' ? v.trim() : '');

/**
 * Formulaire du site -> { commande } ou { erreurs: [{ champ, message }] }.
 * tarifs : tarifs-carte-cadeau.json du site { minimum, montantAuChoix, options: [{ valeur, nom, prix }] }.
 * corps : { beneficiaire: { prenom, nom, telephone }, prestation, montant, message, papier,
 *           acheteur: { prenom, nom, email, telephone }, emailReception, remarques }
 */
function lireCommande(corps, tarifs) {
  const c = corps && typeof corps === 'object' ? corps : {};
  const b = c.beneficiaire || {};
  const a = c.acheteur || {};
  const erreurs = [];
  const exiger = (champ, valeur, libelle, max) => {
    if (!valeur) erreurs.push({ champ, message: `${libelle} : à remplir.` });
    else if (valeur.length > max) erreurs.push({ champ, message: `${libelle} : ${max} caractères au plus.` });
    return valeur;
  };
  const facultatif = (champ, valeur, libelle, max) => {
    if (valeur.length > max) erreurs.push({ champ, message: `${libelle} : ${max} caractères au plus.` });
    return valeur;
  };
  const telephone = (champ, valeur, libelle) => {
    if (valeur && (!TELEPHONE.test(valeur) || valeur.replace(/\D/g, '').length < 6)) {
      erreurs.push({ champ, message: `${libelle} : numéro invalide.` });
    }
    return facultatif(champ, valeur, libelle, LIMITES.telephone);
  };
  const email = (champ, valeur, libelle) => {
    if (!valeur) erreurs.push({ champ, message: `${libelle} : à remplir.` });
    else if (valeur.length > LIMITES.email || !EMAIL.test(valeur)) erreurs.push({ champ, message: `${libelle} : adresse invalide.` });
    return valeur;
  };

  const beneficiairePrenom = exiger('beneficiairePrenom', texte(b.prenom), 'Prénom du bénéficiaire', LIMITES.nom);
  const beneficiaireNom = exiger('beneficiaireNom', texte(b.nom), 'Nom du bénéficiaire', LIMITES.nom);
  const beneficiaireTelephone = telephone('beneficiaireTelephone', texte(b.telephone), 'Téléphone du bénéficiaire');
  const acheteurPrenom = exiger('acheteurPrenom', texte(a.prenom), 'Votre prénom', LIMITES.nom);
  const acheteurNom = exiger('acheteurNom', texte(a.nom), 'Votre nom', LIMITES.nom);
  const acheteurEmail = email('acheteurEmail', texte(a.email), 'Votre e-mail');
  const acheteurTelephone = telephone('acheteurTelephone', texte(a.telephone), 'Votre téléphone');
  // Le bon part a l'acheteur ; il peut choisir une autre adresse de reception (decision de Jordan)
  const emailReception = texte(c.emailReception)
    ? email('emailReception', texte(c.emailReception), 'Adresse de réception du bon')
    : acheteurEmail;
  const message = facultatif('message', texte(c.message), 'Message', LIMITES.message);
  const remarques = facultatif('remarques', texte(c.remarques), 'Remarques', LIMITES.remarques);

  // Le prix vient de la liste du site, jamais du navigateur
  const prestation = texte(c.prestation);
  let montant = 0;
  let soin = '';
  if (prestation && tarifs && prestation === tarifs.montantAuChoix) {
    montant = Number(c.montant);
    if (!Number.isInteger(montant) || montant < tarifs.minimum) {
      erreurs.push({ champ: 'montant', message: `Montant : ${tarifs.minimum} € minimum, en euros entiers.` });
    } else {
      soin = Carte.soinDeMontant(montant);
    }
  } else {
    const option = tarifs && (tarifs.options || []).find(o => o.valeur === prestation);
    if (!option) erreurs.push({ champ: 'prestation', message: 'Prestation : à choisir dans la liste.' });
    else { montant = option.prix; soin = option.nom; }
  }

  if (erreurs.length) return { erreurs };
  return {
    commande: {
      montant, prestation, soin,
      beneficiairePrenom, beneficiaireNom, beneficiaireTelephone,
      acheteurPrenom, acheteurNom, acheteurEmail, acheteurTelephone,
      emailReception, message, remarques,
      papier: c.papier === true,
      // Comme l'apercu du site (src/scripts/site.ts) : les prenoms, le soin sans son prix, le message
      carte: { offertPar: acheteurPrenom, pour: beneficiairePrenom, soin, message }
    }
  };
}

/**
 * Reponse de SumUp (GET /v0.1/checkouts/{id}) comparee a la commande :
 * 'payee' (paye, montant et reference conformes) | 'echouee' | 'expiree' | 'en_attente' | 'anomalie'.
 * Un paiement echoue peut encore reussir (nouvel essai sur la meme page) ; expire est definitif.
 */
function statutSumup(paiement, commande) {
  if (!paiement || paiement.checkout_reference !== commande.id) return 'anomalie';
  switch (paiement.status) {
    case 'PAID':
      return paiement.currency === 'EUR' && Math.round(Number(paiement.amount) * 100) === Math.round(Number(commande.montant) * 100)
        ? 'payee' : 'anomalie';
    case 'FAILED': return 'echouee';
    case 'EXPIRED': return 'expiree';
    default: return 'en_attente';
  }
}

// Qui peut demander un paiement, et avec quel compte SumUp :
// - le site en ligne (www) : compte reel seulement, un client ne voit jamais la page de paiement de test ;
// - Cloudflare (elise-massage.pages.dev et ses essais) : les deux (tests de Jordan avant la bascule,
//   puis vrai paiement de controle) ;
// - le serveur de developpement : compte de test seulement.
const ORIGINES = [
  { motif: /^https:\/\/(www\.)?elise-massage\.fr$/, reel: true, test: false },
  { motif: /^https:\/\/([a-z0-9-]+\.)?elise-massage\.pages\.dev$/, reel: true, test: true },
  { motif: /^http:\/\/(localhost|127\.0\.0\.1|192\.168\.\d{1,3}\.\d{1,3}):\d{2,5}$/, reel: false, test: true }
];

const origineConnue = origine => ORIGINES.some(o => o.motif.test(String(origine || '')));

/**
 * Pourquoi le paiement ne peut pas commencer : null s'il le peut ; 'origine' (site inconnu),
 * 'test' (compte de test depuis le site en ligne) ou 'reel' (vrai compte depuis le developpement).
 */
function refusPaiement(origine, essai) {
  const o = ORIGINES.find(x => x.motif.test(String(origine || '')));
  if (!o) return 'origine';
  if (essai && !o.test) return 'test';
  if (!essai && !o.reel) return 'reel';
  return null;
}

/** « jordan@exemple.fr » -> « jo•••@exemple.fr » (page « Merci » : rappeler l'adresse sans l'exposer). */
function masquerEmail(adresse) {
  const [nom, domaine] = String(adresse || '').split('@');
  if (!domaine) return '';
  return `${nom.slice(0, Math.min(2, Math.max(1, nom.length - 1)))}•••@${domaine}`;
}

/** Reference de commande : id du paiement chez SumUp et adresse de la page « Merci » (non devinable). */
function nouvelleReference(aleatoire) {
  return `cc_${Date.now().toString(36)}_${aleatoire}`;
}

const CarteCadeauCommande = {
  LIMITES, lireCommande, statutSumup, origineConnue, refusPaiement, masquerEmail, nouvelleReference
};

racine.CarteCadeauCommande = CarteCadeauCommande;
if (typeof module !== 'undefined' && module.exports) module.exports = CarteCadeauCommande;

})(typeof window !== 'undefined' ? window : globalThis);
