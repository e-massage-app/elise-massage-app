// ===== ENCAISSEMENTS : UNE SEULE REGLE POUR TOUTE L'APP (v1.1.0.0) =====
// Regle d'Elise : on compte ce que les clientes ont PAYE, au moment du paiement,
// tous moyens confondus, pourboires compris.
//  - Prestation : prix + tips. Le prix d'une prestation reglee avec une carte
//    cadeau ne compte pas (la carte a deja ete comptee a sa vente) ; ses tips,
//    eux, sont de l'argent recu.
//  - Carte cadeau : son montant compte au mois de la vente. Un remboursement
//    retire ce montant au mois du remboursement.
// Avant cette version, chaque ecran avait sa propre formule (avec ou sans tips,
// carte cadeau a la vente ou a l'utilisation) : les totaux ne collaient pas.
//
// Les dates de l'app sont des chaines 'YYYY-MM-DD' : on les compare telles
// quelles (pas de new Date(), qui decale selon le fuseau horaire).

(function (racine) {

const MOYENS_ENCAISSEMENT = ['Liquide', 'Carte bleue', 'Virement', 'Chèque'];

function estPayeeParBonCadeau(p) {
  return p.moyenPaiement === 'Bon cadeau' || !!p.bonCadeauId;
}

function jourDe(dateStr) {
  return typeof dateStr === 'string' ? dateStr.slice(0, 10) : '';
}

function moisDe(dateStr) {
  return typeof dateStr === 'string' ? dateStr.slice(0, 7) : '';
}

function montant(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

// Encaisse d'UNE prestation, hors notion de date : sert aux ecrans par
// cliente (fiche, annuaire, Google Ads, canaux) qui ne decoupent pas par
// periode. Meme regle que encaissementsEntre : prix + tips, ou tips seuls si
// la prestation est reglee par carte cadeau.
function encaissePrestation(p) {
  const tips = montant(p.tips);
  return estPayeeParBonCadeau(p) ? tips : montant(p.prix) + tips;
}

// Moyen « d'ou vient l'argent » : les tips d'une prestation reglee par carte
// cadeau, ou d'une prestation sans moyen renseigne, sont comptes en liquide.
function moyenNormalise(moyen) {
  return MOYENS_ENCAISSEMENT.includes(moyen) ? moyen : 'Liquide';
}

/**
 * Liste des encaissements entre deux jours inclus ('YYYY-MM-DD').
 * Chaque ligne : { date, montant, moyen, source, ref }.
 * source : 'prestation' | 'tips-bon' | 'bon-vendu' | 'bon-rembourse' (montant negatif).
 * filtrePrestation (optionnel) : restreint les prestations (groupe, canal...).
 * avecBons (defaut true) : inclure ventes et remboursements de cartes cadeaux.
 */
function encaissementsEntre(appData, debut, fin, { filtrePrestation = null, avecBons = true } = {}) {
  const dansPeriode = d => {
    const j = jourDe(d);
    return j !== '' && j >= debut && j <= fin;
  };
  const lignes = [];

  (appData.prestations || []).forEach(p => {
    if (!dansPeriode(p.date)) return;
    if (filtrePrestation && !filtrePrestation(p)) return;
    const tips = montant(p.tips);
    if (estPayeeParBonCadeau(p)) {
      if (tips > 0) lignes.push({ date: jourDe(p.date), montant: tips, moyen: 'Liquide', source: 'tips-bon', ref: p });
      return;
    }
    const total = montant(p.prix) + tips;
    if (total !== 0) lignes.push({ date: jourDe(p.date), montant: total, moyen: moyenNormalise(p.moyenPaiement), source: 'prestation', ref: p });
  });

  if (avecBons) {
    (appData.bonsCadeaux || []).forEach(b => {
      const m = montant(b.montant);
      if (dansPeriode(b.dateAchat)) {
        lignes.push({ date: jourDe(b.dateAchat), montant: m, moyen: moyenNormalise(b.moyenPaiement), source: 'bon-vendu', ref: b });
      }
      if (b.statut === 'rembourse' && dansPeriode(b.dateRemboursement)) {
        lignes.push({ date: jourDe(b.dateRemboursement), montant: -m, moyen: moyenNormalise(b.moyenPaiement), source: 'bon-rembourse', ref: b });
      }
    });
  }

  return lignes;
}

/** Totaux d'une liste d'encaissements : total, par moyen, prestations, tips, cartes cadeaux. */
function totaliserEncaissements(lignes) {
  const t = { total: 0, parMoyen: {}, prestations: 0, tips: 0, bonsVendus: 0, bonsRembourses: 0, carte: 0 };
  lignes.forEach(l => {
    t.total += l.montant;
    t.parMoyen[l.moyen] = (t.parMoyen[l.moyen] || 0) + l.montant;
    if (l.moyen === 'Carte bleue') t.carte += l.montant;
    if (l.source === 'prestation') {
      t.prestations += l.montant;
      t.tips += montant(l.ref.tips);
    } else if (l.source === 'tips-bon') {
      t.prestations += l.montant;
      t.tips += l.montant;
    } else if (l.source === 'bon-vendu') {
      t.bonsVendus += l.montant;
    } else if (l.source === 'bon-rembourse') {
      t.bonsRembourses += l.montant;
    }
  });
  return t;
}

function dernierJourDuMois(mois) {
  const [a, m] = mois.split('-').map(Number);
  const jours = new Date(Date.UTC(a, m, 0)).getUTCDate();
  return `${mois}-${String(jours).padStart(2, '0')}`;
}

/** Encaisse d'un mois 'YYYY-MM'. */
function encaisseDuMois(appData, mois, options) {
  return totaliserEncaissements(encaissementsEntre(appData, `${mois}-01`, dernierJourDuMois(mois), options));
}

/** Encaisse entre deux jours inclus. */
function encaisseEntre(appData, debut, fin, options) {
  return totaliserEncaissements(encaissementsEntre(appData, debut, fin, options));
}

/** Mois 'YYYY-MM' decale de n (n negatif = avant). Arithmetique sur les chaines. */
function decalerMois(mois, n) {
  const [a, m] = mois.split('-').map(Number);
  const index = a * 12 + (m - 1) + n;
  return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, '0')}`;
}

/** Les n derniers mois jusqu'a moisFin inclus, du plus ancien au plus recent. */
function derniersMois(moisFin, n) {
  const liste = [];
  for (let i = n - 1; i >= 0; i--) liste.push(decalerMois(moisFin, -i));
  return liste;
}

const Encaissements = {
  MOYENS: MOYENS_ENCAISSEMENT,
  estPayeeParBonCadeau,
  jourDe,
  moisDe,
  montant,
  encaissePrestation,
  encaissementsEntre,
  totaliserEncaissements,
  encaisseDuMois,
  encaisseEntre,
  dernierJourDuMois,
  decalerMois,
  derniersMois
};

// Portee fermee : rien d'autre que `Encaissements` ne devient global.
racine.Encaissements = Encaissements;
if (typeof module !== 'undefined' && module.exports) module.exports = Encaissements;

})(typeof window !== 'undefined' ? window : globalThis);
