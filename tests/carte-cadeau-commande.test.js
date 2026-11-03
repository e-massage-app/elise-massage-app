// Carte cadeau payee sur le site (v1.3.0.0) : js/core/carte-cadeau-commande.js
const assert = require('node:assert/strict');
const test = require('node:test');
const K = require('../js/core/carte-cadeau-commande.js');

// Liste fictive au format de tarifs-carte-cadeau.json (le site la publie depuis src/data/soins.ts)
const TARIFS = {
  minimum: 50,
  montantAuChoix: 'Un montant au choix',
  options: [
    { valeur: 'Massage Signature 60 min : 80 €', nom: 'Massage Signature 60 min', prix: 80 },
    { valeur: 'Rituel douceur 90 min : 110 €', nom: 'Rituel douceur 90 min', prix: 110 }
  ]
};

const formulaire = (modif = {}) => ({
  beneficiaire: { prenom: 'Camille', nom: 'Martin', telephone: '' },
  prestation: 'Massage Signature 60 min : 80 €',
  montant: '',
  message: 'Joyeux anniversaire ! ❤',
  papier: false,
  acheteur: { prenom: 'Paul', nom: 'Durand', email: 'paul@exemple.fr', telephone: '06 00 00 00 00' },
  emailReception: '',
  remarques: '',
  ...modif
});

test('le prix vient de la liste du site, pas du navigateur', () => {
  const { commande } = K.lireCommande(formulaire({ montant: 1 }), TARIFS);
  assert.equal(commande.montant, 80);
  assert.equal(commande.soin, 'Massage Signature 60 min');
});

test('textes du bon : comme l\'apercu du site (prenoms, soin sans prix, message)', () => {
  const { commande } = K.lireCommande(formulaire(), TARIFS);
  assert.deepEqual(commande.carte, {
    offertPar: 'Paul', pour: 'Camille', soin: 'Massage Signature 60 min', message: 'Joyeux anniversaire ! ❤'
  });
});

test('montant au choix : 50 € minimum, en euros entiers, imprime « Bon d\'une valeur de »', () => {
  const ok = K.lireCommande(formulaire({ prestation: 'Un montant au choix', montant: '120' }), TARIFS);
  assert.equal(ok.commande.montant, 120);
  assert.equal(ok.commande.soin, 'Bon d’une valeur de 120 €'); // espace insecable, comme l'app
  for (const montant of ['49', '75.5', '', 'abc', '-80']) {
    const r = K.lireCommande(formulaire({ prestation: 'Un montant au choix', montant }), TARIFS);
    assert.deepEqual(r.erreurs.map(e => e.champ), ['montant'], `montant ${montant}`);
  }
});

test('une prestation hors liste (ou un prix modifie) est refusee', () => {
  for (const prestation of ['Massage Signature 60 min : 10 €', 'Épilation jambes', '']) {
    const r = K.lireCommande(formulaire({ prestation }), TARIFS);
    assert.deepEqual(r.erreurs.map(e => e.champ), ['prestation']);
  }
  assert.deepEqual(K.lireCommande(formulaire(), null).erreurs.map(e => e.champ), ['prestation']);
});

test('le bon part a l\'acheteur, ou a l\'adresse de reception choisie', () => {
  assert.equal(K.lireCommande(formulaire(), TARIFS).commande.emailReception, 'paul@exemple.fr');
  const autre = K.lireCommande(formulaire({ emailReception: ' paul.pro@exemple.fr ' }), TARIFS);
  assert.equal(autre.commande.emailReception, 'paul.pro@exemple.fr');
  assert.deepEqual(K.lireCommande(formulaire({ emailReception: 'paul@' }), TARIFS).erreurs.map(e => e.champ), ['emailReception']);
});

test('champs obligatoires, longueurs et telephones verifies', () => {
  const r = K.lireCommande(formulaire({
    beneficiaire: { prenom: '  ', nom: 'Martin', telephone: 'appelle-moi' },
    acheteur: { prenom: 'Paul', nom: 'x'.repeat(61), email: 'pas-une-adresse', telephone: '' },
    message: 'x'.repeat(161)
  }), TARIFS);
  assert.deepEqual(r.erreurs.map(e => e.champ).sort(),
    ['acheteurEmail', 'acheteurNom', 'beneficiairePrenom', 'beneficiaireTelephone', 'message']);
  assert.ok(K.lireCommande(null, TARIFS).erreurs.length > 0);
});

test('papier : seulement si coche explicitement', () => {
  assert.equal(K.lireCommande(formulaire({ papier: true }), TARIFS).commande.papier, true);
  assert.equal(K.lireCommande(formulaire({ papier: 'oui' }), TARIFS).commande.papier, false);
});

test('statut SumUp : paye seulement si montant, devise et reference concordent', () => {
  const commande = { id: 'cc_1', montant: 80 };
  const paiement = (modif) => ({ checkout_reference: 'cc_1', amount: 80, currency: 'EUR', status: 'PAID', ...modif });
  assert.equal(K.statutSumup(paiement(), commande), 'payee');
  assert.equal(K.statutSumup(paiement({ amount: 80.0 }), { id: 'cc_1', montant: '80' }), 'payee');
  assert.equal(K.statutSumup(paiement({ amount: 8 }), commande), 'anomalie');
  assert.equal(K.statutSumup(paiement({ currency: 'USD' }), commande), 'anomalie');
  assert.equal(K.statutSumup(paiement({ checkout_reference: 'cc_2' }), commande), 'anomalie');
  assert.equal(K.statutSumup(paiement({ status: 'FAILED' }), commande), 'echouee');
  assert.equal(K.statutSumup(paiement({ status: 'EXPIRED' }), commande), 'expiree');
  assert.equal(K.statutSumup(paiement({ status: 'PENDING' }), commande), 'en_attente');
  assert.equal(K.statutSumup(null, commande), 'anomalie');
});

test('adresse masquee sur la page « Merci »', () => {
  assert.equal(K.masquerEmail('paul@exemple.fr'), 'pa•••@exemple.fr');
  assert.equal(K.masquerEmail('p@exemple.fr'), 'p•••@exemple.fr');
  assert.equal(K.masquerEmail(''), '');
});

test('reference de commande : prefixe, horodatage et partie aleatoire', () => {
  assert.match(K.nouvelleReference('abc123'), /^cc_[0-9a-z]+_abc123$/);
});
