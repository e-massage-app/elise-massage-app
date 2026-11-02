// ===== GOOGLE ADS : UNE SEULE DEFINITION DES CHIFFRES (v1.2.0.0) =====
// Avant cette version, trois ecrans comptaient Google Ads chacun a sa facon :
//  - le demarrage ecrivait dans le cache un cout des 30 derniers jours (LAST_30_DAYS),
//    l'ecran Analytics le cout depuis toujours : le meme `total` changeait de sens ;
//  - le tableau de bord comparait ce cout a des revenus de toutes les epoques, l'onglet
//    Google Ads a des revenus depuis le demarrage des campagnes ;
//  - l'onglet ignorait la Periode choisie en haut d'Analytics et affichait « custom:… ».
// Regle unique, ici :
//  - cout « depuis le debut » = cout de l'API sans borne de date (periode 'all') ;
//  - revenus = regle Encaissements des prestations des clientes au canal Google Ads,
//    sur la meme fenetre (« depuis le debut » = depuis le demarrage des campagnes) ;
//  - clientes = celles qui ont au moins une prestation dans la fenetre.
// Fonctions pures (ni DOM, ni DataManager, ni date du jour implicite) : tests/google-ads-calculs.test.js.

(function (racine) {

const Enc = racine.Encaissements || require('./encaissements.js');

const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const JOUR = /^\d{4}-\d{2}-\d{2}$/;

function deux(n) {
  return String(n).padStart(2, '0');
}

/** Jour local 'YYYY-MM-DD' (toISOString donnerait le jour UTC, decale la nuit). */
function jourLocal(d) {
  return `${d.getFullYear()}-${deux(d.getMonth() + 1)}-${deux(d.getDate())}`;
}

function versFr(jour) {
  return jour.split('-').reverse().join('/');
}

/**
 * Libelle lisible d'une plage : « novembre 2026 », « année 2025 », sinon « du 01/01/2026 au 02/11/2026 ».
 * Un mois (ou une annee) en cours, arrete a aujourd'hui, garde son nom.
 */
function libellePlage(debut, fin, aujourdhui) {
  const [a, m, j] = debut.split('-');
  const jusquAuBout = (finNormale) => fin === finNormale || (!!aujourdhui && fin === aujourdhui && fin < finNormale);
  if (j === '01' && fin.slice(0, 7) === debut.slice(0, 7) && jusquAuBout(Enc.dernierJourDuMois(debut.slice(0, 7)))) {
    return `${MOIS[Number(m) - 1]} ${a}`;
  }
  if (m === '01' && j === '01' && fin.slice(0, 4) === a && jusquAuBout(`${a}-12-31`)) return `année ${a}`;
  return `du ${versFr(debut)} au ${versFr(fin)}`;
}

/**
 * Plage { debut, fin, libelle } d'une periode du selecteur Google Ads :
 * 'THIS_MONTH', 'LAST_MONTH', un nombre de jours ('7', '30', '90') ou 'custom:YYYY-MM-DD:YYYY-MM-DD'.
 * null pour 'all' (aucune borne) ou une valeur inconnue.
 */
function plagePourPeriode(period, maintenant) {
  if (period === 'all' || period === undefined || period === null) return null;
  const aujourdhui = jourLocal(maintenant);

  if (typeof period === 'string' && period.startsWith('custom:')) {
    const [, debut, fin] = period.split(':');
    return (JOUR.test(debut) && JOUR.test(fin)) ? { debut, fin, libelle: libellePlage(debut, fin, aujourdhui) } : null;
  }
  if (period === 'THIS_MONTH') {
    const debut = `${aujourdhui.slice(0, 7)}-01`;
    return { debut, fin: aujourdhui, libelle: libellePlage(debut, aujourdhui, aujourdhui) };
  }
  if (period === 'LAST_MONTH') {
    const mois = Enc.decalerMois(aujourdhui.slice(0, 7), -1);
    const debut = `${mois}-01`;
    const fin = Enc.dernierJourDuMois(mois);
    return { debut, fin, libelle: libellePlage(debut, fin, aujourdhui) };
  }
  const jours = parseInt(period, 10);
  if (!isNaN(jours) && jours > 0) {
    const d = new Date(maintenant.getFullYear(), maintenant.getMonth(), maintenant.getDate() - jours);
    return { debut: jourLocal(d), fin: aujourdhui, libelle: `${jours} derniers jours` };
  }
  return null;
}

/**
 * Periode Google Ads qui suit les filtres du haut d'Analytics ('current' ou 'YYYY', '' ou '1'..'12').
 * Une annee ou un mois en cours s'arrete a aujourd'hui (« Annee actuelle » = 1er janvier -> aujourd'hui).
 */
function periodePourFiltres(annee, mois, aujourdhui) {
  const a = (annee === 'current' || !annee) ? aujourdhui.slice(0, 4) : String(parseInt(annee, 10));
  let debut, fin;
  if (mois !== '' && mois !== null && mois !== undefined) {
    const m = `${a}-${deux(parseInt(mois, 10))}`;
    debut = `${m}-01`;
    fin = Enc.dernierJourDuMois(m);
  } else {
    debut = `${a}-01-01`;
    fin = `${a}-12-31`;
  }
  if (debut <= aujourdhui && fin > aujourdhui) fin = aujourdhui;
  return `custom:${debut}:${fin}`;
}

/** Demarrage le plus ancien parmi les periodes des campagnes selectionnees ('YYYY-MM-DD' ou null). */
function debutCampagnes(parametres) {
  const p = parametres || {};
  const periodes = p.googleAdsCampaignPeriods || {};
  let mini = null;
  (p.googleAdsSelectedCampaigns || []).forEach(id => {
    (periodes[id] || []).forEach(per => {
      const jour = per && per.startDate ? String(per.startDate).slice(0, 10) : '';
      if (jour && (!mini || jour < mini)) mini = jour;
    });
  });
  return mini;
}

/**
 * « Depuis le debut » = depuis le demarrage des campagnes, pas depuis toujours : sans cette
 * borne, le cout d'UNE campagne etait compare aux revenus de toutes les epoques (y compris
 * avant son lancement). null si aucune periode n'est renseignee (tout l'historique).
 */
function plageDepuisLeDebut(parametres, aujourdhui) {
  const debut = debutCampagnes(parametres);
  return debut ? { debut, fin: aujourdhui, libelle: `depuis le ${versFr(debut)}` } : null;
}

/**
 * KPI Google Ads sur une plage (null = tout l'historique) pour un cout donne.
 * Une cliente compte si elle a au moins une prestation dans la plage ; seules ces
 * prestations font le chiffre (regle Encaissements, pourboires compris).
 */
function kpisPeriode(appData, plage, cout) {
  const clients = appData.clients || [];
  const idsGoogleAds = new Set(clients.filter(c => c.canalAcquisition === 'google-ads').map(c => c.id));
  const prestations = (appData.prestations || []).filter(p => {
    if (!idsGoogleAds.has(p.clientId) || !p.date) return false;
    if (!plage) return true;
    const jour = Enc.jourDe(p.date);
    return jour >= plage.debut && jour <= plage.fin;
  });

  const totalRevenue = prestations.reduce((s, p) => s + Enc.encaissePrestation(p), 0);
  const totalTips = prestations.reduce((s, p) => s + Enc.montant(p.tips), 0);
  const parClient = {};
  prestations.forEach(p => { (parClient[p.clientId] = parClient[p.clientId] || []).push(p); });

  const clientsData = Object.entries(parClient).map(([clientId, ps]) => {
    const client = clients.find(c => c.id === clientId) || { id: clientId, prenom: '?', nom: '' };
    const revenue = ps.reduce((s, p) => s + Enc.encaissePrestation(p), 0);
    return {
      client,
      prestationsCount: ps.length,
      revenue,
      avgSession: revenue / ps.length,
      lastSession: Math.max(...ps.map(p => new Date(p.date).getTime()))
    };
  }).sort((a, b) => b.revenue - a.revenue);

  const totalCost = typeof cout === 'number' && Number.isFinite(cout) ? cout : 0;
  return {
    clientsCount: clientsData.length,
    prestationsCount: prestations.length,
    totalRevenue,
    totalPrix: totalRevenue - totalTips,
    totalTips,
    totalCost,
    roi: totalCost > 0 ? ((totalRevenue - totalCost) / totalCost) * 100 : 0,
    roiMoney: totalRevenue - totalCost,
    clientsData
  };
}

/** Les chiffres « depuis le debut » : cout du cache, revenus et clientes recalcules. */
function kpisDepuisLeDebut(appData, aujourdhui) {
  const parametres = appData.parametres || {};
  const cache = parametres.googleAdsCachedCosts || {};
  const plage = plageDepuisLeDebut(parametres, aujourdhui);
  const kpis = kpisPeriode(appData, plage, Number(cache.total) || 0);
  kpis.libellePeriode = plage ? plage.libelle : 'Depuis le début';
  return kpis;
}

/**
 * Nouveau cache `googleAdsCachedCosts` apres une lecture du cout depuis le debut.
 * Le cout du MOIS (currentMonth), pose par le tableau de bord et date par lastUpdateMonth,
 * est garde ; les anciennes estimations (currentMonth non date, monthlyBreakdown) sont jetees.
 */
function cacheDepuisLeDebut(ancien, cout, kpis, maintenantIso) {
  const cache = Object.assign({}, ancien || {}, {
    total: cout,
    revenue: kpis.totalRevenue,
    clientsCount: kpis.clientsCount,
    prestationsCount: kpis.prestationsCount,
    lastUpdate: maintenantIso
  });
  delete cache.monthlyBreakdown;
  if (!cache.lastUpdateMonth) delete cache.currentMonth;
  return cache;
}

const GoogleAdsCalculs = {
  jourLocal,
  libellePlage,
  plagePourPeriode,
  periodePourFiltres,
  debutCampagnes,
  plageDepuisLeDebut,
  kpisPeriode,
  kpisDepuisLeDebut,
  cacheDepuisLeDebut
};

racine.GoogleAdsCalculs = GoogleAdsCalculs;
if (typeof module !== 'undefined' && module.exports) module.exports = GoogleAdsCalculs;

})(typeof window !== 'undefined' ? window : globalThis);
