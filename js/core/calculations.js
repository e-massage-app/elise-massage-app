// ===== js/core/calculations.js =====
// Tous les calculs : KPI, analytics, statistiques

// ===== OUTILS COMMUNS (v1.1.0.0) =====

// Jour local 'YYYY-MM-DD' (toISOString donnerait le jour UTC, decale la nuit).
function jourLocal(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// v1.1.0.0 : CA par groupe = lignes d'encaissement des prestations (regle
// Encaissements : prix + tips, tips seuls pour une carte cadeau). Les ventes de
// cartes cadeaux ne sont rattachables a aucun groupe : elles sont ignorees ici.
function repartirEncaissementsParGroupe(lignes) {
  const parGroupe = {};
  lignes.forEach(l => {
    if (l.source !== 'prestation' && l.source !== 'tips-bon') return;
    const g = getGroupeNameForPrestation(l.ref);
    parGroupe[g] = (parGroupe[g] || 0) + l.montant;
  });
  return parGroupe;
}

// v1.1.0.0 : filtres annee / mois d'Analytics. "Annee actuelle" ('current')
// = annee civile en cours. Avant, plusieurs widgets sautaient le filtre et
// affichaient TOUTES les annees sous ce libelle, contrairement a la tuile CA.
function bornesAnalytics(selectedYear, selectedMonth) {
  const annee = (selectedYear === 'current' || !selectedYear)
    ? new Date().getFullYear()
    : parseInt(selectedYear, 10);
  if (selectedMonth !== '' && selectedMonth !== null && selectedMonth !== undefined) {
    const mois = `${annee}-${String(parseInt(selectedMonth, 10)).padStart(2, '0')}`;
    return { debut: `${mois}-01`, fin: Encaissements.dernierJourDuMois(mois) };
  }
  return { debut: `${annee}-01-01`, fin: `${annee}-12-31` };
}

function estDansPeriodeAnalytics(dateStr, selectedYear, selectedMonth) {
  const jour = Encaissements.jourDe(dateStr);
  if (!jour) return false;
  const { debut, fin } = bornesAnalytics(selectedYear, selectedMonth);
  return jour >= debut && jour <= fin;
}

// ===== CALCULS DASHBOARD =====

function calculateGoogleAdsROI() {
  const appData = DataManager.getAppData();
  const parametres = appData.parametres || {};
  const selectedCampaigns = parametres.googleAdsSelectedCampaigns || [];
  
  if (selectedCampaigns.length === 0 || !parametres.googleAdsConnected) {
    return {
      hasGoogleAdsData: false,
      totalCost: 0,
      totalRevenue: 0,
      roi: 0,
      clientsCount: 0,
      currentMonthCost: 0,
      prestationsCount: 0
    };
  }

  // ✅ UTILISER LES DONNÉES CACHÉES (qui marchent dans Analytics)
  const cachedCosts = parametres.googleAdsCachedCosts || {};
  const totalCost = cachedCosts.total || 0;           // 234.158392
  const totalRevenue = cachedCosts.revenue || 0;      // 2240  
  const clientsCount = cachedCosts.clientsCount || 0; // 3
  // v1.1.0.0 : pas de repli sur le cout total (une estimation) : 0 si inconnu.
  const currentMonthCost = cachedCosts.currentMonth || 0;

  // ✅ CALCULER LE ROI AVEC LES DONNÉES CACHÉES
  let roi = 0;
  if (totalCost > 0) {
    roi = ((totalRevenue - totalCost) / totalCost) * 100;
  }

  // ✅ COMPTER LES PRESTATIONS MANUELLEMENT POUR CONFIRMATION
  const clientsGoogleAds = appData.clients.filter(client => 
    client.canalAcquisition === 'google-ads'
  );
  const prestationsGoogleAds = appData.prestations.filter(prestation => {
    const client = appData.clients.find(c => c.id === prestation.clientId);
    return client && client.canalAcquisition === 'google-ads';
  });

  return {
    hasGoogleAdsData: totalCost > 0 || clientsCount > 0,
    totalCost,
    totalRevenue,
    roi,
    clientsCount,
    prestationsCount: prestationsGoogleAds.length,
    currentMonthCost
  };
}

function calculateDashboardKPIs() {
  const appData = DataManager.getAppData();
  const now = new Date();
  const currentYear = now.getFullYear();
  
  // Filtrer les prestations de l'année en cours
  const prestationsAnnee = appData.prestations.filter(p => {
    const prestationDate = new Date(p.date);
    return prestationDate.getFullYear() === currentYear;
  });

  // Filtrer pour le mois en cours selon le mode choisi
  const calculPeriode = (appData.parametres && appData.parametres.calculPeriode) || 'mois-calendaire';
  let prestationsMoisCourant = [];
  let depensesMoisCourant = [];

  if (calculPeriode === 'mois-calendaire') {
    // Mode calendaire : du 1er au dernier jour du mois
    const currentMonth = now.getMonth();
    prestationsMoisCourant = prestationsAnnee.filter(p => {
      const prestationDate = new Date(p.date);
      return prestationDate.getMonth() === currentMonth;
    });
    
    if (appData.depenses) {
      depensesMoisCourant = appData.depenses.filter(d => {
        const depenseDate = new Date(d.date);
        return depenseDate.getFullYear() === currentYear && depenseDate.getMonth() === currentMonth;
      });
    }
  } else {
    // Mode glissant : 30 derniers jours
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    prestationsMoisCourant = appData.prestations.filter(p => {
      const prestationDate = new Date(p.date);
      return prestationDate >= thirtyDaysAgo && prestationDate <= now;
    });
    
    if (appData.depenses) {
      depensesMoisCourant = appData.depenses.filter(d => {
        const depenseDate = new Date(d.date);
        return depenseDate >= thirtyDaysAgo && depenseDate <= now;
      });
    }
  }
  
  // ✅ Prestations du mois calendaire seulement (pour le nouveau KPI)
  const currentMonth = now.getMonth();
  const prestationsMoisCalendaire = prestationsAnnee.filter(p => {
    const prestationDate = new Date(p.date);
    return prestationDate.getMonth() === currentMonth;
  });
  
  // RDV futurs (à venir)
  const rdvFuturs = appData.rdv.filter(rdv => {
    const rdvDate = new Date(`${rdv.date}T${rdv.heure}`);
    return rdvDate >= now && rdv.statut !== 'annulé';
  });
  
  // RDV annulés (toute l'année)
  const rdvAnnules = appData.rdv.filter(rdv => {
    const rdvDate = new Date(rdv.date);
    return rdvDate.getFullYear() === currentYear && rdv.statut === 'annulé';
  });
  
  // ✅ Paiements à venir (RDV confirmés non transformés)
  const rdvConfirmesNonTransformes = appData.rdv.filter(rdv => {
    return rdv.statut === 'confirmé' && !rdv.transformeEnPrestation;
  });
  
  // Calculer le montant total des paiements à venir
  const paiementsAVenir = rdvConfirmesNonTransformes.reduce((total, rdv) => {
    const prixEstime = estimerPrixRdv(rdv);
    return total + prixEstime;
  }, 0);
  
// ✅ CORRECTION : Récupérer les données Google Ads DIRECTEMENT depuis le cache
const parametresGA = appData.parametres || {};
const cachedCosts = parametresGA.googleAdsCachedCosts || {};
const selectedCampaigns = parametresGA.googleAdsSelectedCampaigns || [];
const isGoogleAdsConnected = parametresGA.googleAdsConnected;

// ✅ Données Google Ads (utiliser le cache qui fonctionne)
let googleAdsData = {
  hasGoogleAdsData: false,
  totalCost: 0,
  totalRevenue: 0,
  roi: 0,
  clientsCount: 0,
  prestationsCount: 0,
  currentMonthCost: 0
};

if (isGoogleAdsConnected && selectedCampaigns.length > 0 && cachedCosts.total) {
  const totalCost = cachedCosts.total;
  const totalRevenue = cachedCosts.revenue || 0;
  const clientsCount = cachedCosts.clientsCount || 0;
  const roi = totalCost > 0 ? ((totalRevenue - totalCost) / totalCost) * 100 : 0;
  
  // Compter les prestations pour info
  const clientsGoogleAds = appData.clients.filter(c => c.canalAcquisition === 'google-ads');
  const prestationsGoogleAds = appData.prestations.filter(p => {
    const client = appData.clients.find(c => c.id === p.clientId);
    return client && client.canalAcquisition === 'google-ads';
  });
  
  googleAdsData = {
    hasGoogleAdsData: true,
    totalCost,
    totalRevenue,
    roi,
    clientsCount,
    prestationsCount: prestationsGoogleAds.length,
    currentMonthCost: totalCost // Pour l'instant même valeur
  };
}

// ✅ NOUVEAU SYSTÈME : Cache intelligent avec refresh toutes les 6h
let googleAdsCostThisMonth = 0;
let googleAdsLastUpdate = null;
let needsRefresh = false;

// Vérifier l'âge du cache
// v1.1.0.0 : seul le vrai cout THIS_MONTH de l'API, date par lastUpdateMonth,
// fait foi. Un currentMonth sans date est une ancienne estimation (cout total
// / 12 au demarrage, / 4 dans la synchro manuelle) : on ne l'affiche plus. Une
// valeur datee d'un autre mois n'est pas le cout de ce mois : 0 en attendant.
if (cachedCosts.lastUpdateMonth) {
  const lastUpdate = new Date(cachedCosts.lastUpdateMonth);
  const now = new Date();
  const hoursSinceUpdate = (now - lastUpdate) / (1000 * 60 * 60);
  const memeMois = lastUpdate.getFullYear() === now.getFullYear() && lastUpdate.getMonth() === now.getMonth();

  if (hoursSinceUpdate < 6 && memeMois) {
    // Cache valide (< 6h)
    googleAdsCostThisMonth = cachedCosts.currentMonth || 0;
    googleAdsLastUpdate = lastUpdate;
  } else {
    // Cache obsolète (> 6h)
    needsRefresh = true;
    googleAdsCostThisMonth = memeMois ? (cachedCosts.currentMonth || 0) : 0; // Utiliser l'ancien en attendant
    googleAdsLastUpdate = lastUpdate;
  }
} else if (isGoogleAdsConnected && selectedCampaigns.length > 0) {
  // Pas de cout du mois date (pas de cache, ou ancienne estimation)
  needsRefresh = true;
}

// Lancer le refresh si nécessaire
if (needsRefresh && isGoogleAdsConnected && selectedCampaigns.length > 0 && !window.googleAdsApiInProgress) {
  window.googleAdsApiInProgress = true;
  
  if (window.UtilsServices && window.UtilsServices.getGoogleAdsCostsThisMonth) {
    window.UtilsServices.getGoogleAdsCostsThisMonth().then(cost => {
      window.googleAdsApiInProgress = false;

      // v1.1.0.0 : un vrai 0 (aucune depense ce mois) est une valeur et doit
      // etre enregistre ; null signale un echec de l'API (rien a ecrire).
      if (typeof cost === 'number' && Number.isFinite(cost) && cost >= 0) {
        // Mettre à jour le cache avec timestamp
        const parametres = DataManager.getParametres();
        if (!parametres.googleAdsCachedCosts) {
          parametres.googleAdsCachedCosts = {};
        }
        parametres.googleAdsCachedCosts.currentMonth = cost;
        parametres.googleAdsCachedCosts.lastUpdateMonth = new Date().toISOString();
        DataManager.saveParametres(parametres);
        DataManager.saveData();
        
        // Rafraîchir le dashboard automatiquement
        if (window.ViewManager && window.ViewManager.updateDashboard) {
          setTimeout(() => {
            window.ViewManager.updateDashboard();
            // Popup retirée pour ne pas gêner l'utilisateur
            // if (window.showTemporaryMessage) {
            //   showTemporaryMessage('✓ Données Google Ads actualisées');
            // }
          }, 500);
        }
      }
    }).catch(error => {
      window.googleAdsApiInProgress = false;
      console.warn('⚠️ Erreur récupération coûts Google Ads THIS_MONTH:', error);
    });
  }
}
  
  // v1.1.0.0 : CA = regle unique Encaissements (js/core/encaissements.js) :
  // prix + tips de chaque prestation (tips seuls si reglee par carte cadeau),
  // cartes cadeaux comptees a la vente, remboursements retires au mois du
  // remboursement. Avant : tips exclus du CA (rajoutes seulement dans la marge)
  // et cartes remboursees ignorees au mois mais exclues a l'annee.
  const aujourdhuiStr = jourLocal(now);
  let debutPeriodeCA, finPeriodeCA;
  if (calculPeriode === 'mois-calendaire') {
    debutPeriodeCA = `${aujourdhuiStr.slice(0, 7)}-01`;
    finPeriodeCA = Encaissements.dernierJourDuMois(aujourdhuiStr.slice(0, 7));
  } else {
    // 30 derniers jours, aujourd'hui compris : meme fenetre que les depenses ci-dessus
    const debut = new Date(now);
    debut.setDate(debut.getDate() - 29);
    debutPeriodeCA = jourLocal(debut);
    finPeriodeCA = aujourdhuiStr;
  }
  const encaissementsMois = Encaissements.encaissementsEntre(appData, debutPeriodeCA, finPeriodeCA);
  const totauxMois = Encaissements.totaliserEncaissements(encaissementsMois);

  // v1.0.7.0 : Revenus par groupe (Massages, HeadSpa, Epilation, ...) du mois.
  // L'alias historique Massages/HeadSpa pointe vers le groupe correspondant.
  const revenusParGroupeMois = repartirEncaissementsParGroupe(encaissementsMois);
  const revenusMassageMois = revenusParGroupeMois['Massages'] || 0;
  const revenusHeadSpaMois = revenusParGroupeMois['HeadSpa'] || 0;

  const revenus = totauxMois.total;
  const tips = totauxMois.tips; // deja compris dans revenus
  const coutsClassiques = depensesMoisCourant.reduce((sum, d) => sum + (d.montant || 0), 0);

  // ✅ CORRECTION : Utiliser les vrais coûts Google Ads du mois si disponibles
  const couts = coutsClassiques + googleAdsCostThisMonth;

  // v1.1.0.0 : les tips sont dans revenus, on ne les rajoute plus (double compte).
  const marge = revenus - couts;
  const tauxMarge = revenus > 0 ? ((marge / revenus) * 100) : 0;
  
  // Client du mois (le plus actif ce mois-ci)
  const currentMonthForClient = now.getMonth();
  const prestationsCeMois = prestationsAnnee.filter(p => {
    const prestationDate = new Date(p.date);
    return prestationDate.getMonth() === currentMonthForClient;
  });
  
  const clientsActivite = {};
  prestationsCeMois.forEach(p => {
    clientsActivite[p.clientId] = (clientsActivite[p.clientId] || 0) + 1;
  });
  
  let clientDuMois = null;
  let maxPrestations = 0;
  Object.entries(clientsActivite).forEach(([clientId, count]) => {
    if (count > maxPrestations) {
      maxPrestations = count;

      // Vérifier si c'est un soin partenariat (collaborateur)
      const prestationDuClient = prestationsCeMois.find(p => p.clientId === clientId);
      if (prestationDuClient && DataManager.isPartnershipSoin(prestationDuClient.soinId || prestationDuClient.type)) {
        clientDuMois = DataManager.getDisplayNameForType(prestationDuClient.soinId || prestationDuClient.type);
      } else {
        const client = appData.clients.find(c => c.id === clientId);
        if (client) {
          // Tronquer le nom s'il est trop long (garde prénom + première lettre du nom)
          let nomAffiche = `${client.prenom} ${client.nom}`;
          if (nomAffiche.length > 15) {
            nomAffiche = `${client.prenom} ${client.nom.charAt(0)}.`;
          }
          clientDuMois = nomAffiche;
        } else {
          // Vérifier si c'est un collaborateur
          const collaborateur = appData.collaborateurs?.find(c => c.id === clientId);
          if (collaborateur) {
            clientDuMois = `${collaborateur.prenom} ${collaborateur.nom || ''}`.trim();
          } else {
            clientDuMois = 'Client inconnu';
          }
        }
      }
    }
  });
  
  // v1.0.7.0 : Compte par groupe (Massages, HeadSpa, Epilation, ...) du mois.
  // v1.1.0.0 : meme fenetre que revenusParGroupeMois (le panier moyen d'un
  // groupe = CA / nombre ; identique en mode calendaire, coherent en glissant).
  const nbParGroupeMois = {};
  prestationsMoisCourant.forEach(p => {
    const g = getGroupeNameForPrestation(p);
    nbParGroupeMois[g] = (nbParGroupeMois[g] || 0) + 1;
  });
  const nbMassagesMois = nbParGroupeMois['Massages'] || 0;
  const nbHeadSpaMois = nbParGroupeMois['HeadSpa'] || 0;

  // v1.0.7.0 : Nb par groupe de l'annee
  const nbParGroupeAnnee = {};
  prestationsAnnee.forEach(p => {
    const g = getGroupeNameForPrestation(p);
    nbParGroupeAnnee[g] = (nbParGroupeAnnee[g] || 0) + 1;
  });
  const nbMassagesAnnee = nbParGroupeAnnee['Massages'] || 0;
  const nbHeadSpaAnnee = nbParGroupeAnnee['HeadSpa'] || 0;

  // CA Total Année : meme regle Encaissements que le mois (v1.1.0.0). Une carte
  // remboursee est retiree l'annee de son remboursement (avant : exclue d'office
  // a l'annee mais comptee au mois, d'ou un mois et une annee incoherents).
  const encaissementsAnnee = Encaissements.encaissementsEntre(appData, `${currentYear}-01-01`, `${currentYear}-12-31`);
  const revenusAnnee = Encaissements.totaliserEncaissements(encaissementsAnnee).total;

  // Revenus depuis le début (toutes données), meme regle
  const encaissementsTotal = Encaissements.encaissementsEntre(appData, '0000-01-01', '9999-12-31');
  const totauxTotal = Encaissements.totaliserEncaissements(encaissementsTotal);

  // v1.0.7.0 : Revenus par groupe (Massages, HeadSpa, Epilation, ...) all-time.
  const revenusParGroupeTotal = repartirEncaissementsParGroupe(encaissementsTotal);
  const revenusMassageTotal = revenusParGroupeTotal['Massages'] || 0;
  const revenusHeadSpaTotal = revenusParGroupeTotal['HeadSpa'] || 0;

  // v1.0.7.0 : Compte par groupe all-time.
  const nbParGroupeTotal = {};
  appData.prestations.forEach(p => {
    const g = getGroupeNameForPrestation(p);
    nbParGroupeTotal[g] = (nbParGroupeTotal[g] || 0) + 1;
  });
  const nbMassagesTotal = nbParGroupeTotal['Massages'] || 0;
  const nbHeadSpaTotal = nbParGroupeTotal['HeadSpa'] || 0;

  // v1.0.7.0 : Revenus par groupe sur l'annee en cours
  const revenusParGroupeAnnee = repartirEncaissementsParGroupe(encaissementsAnnee);

  const revenusTotal = totauxTotal.total;
  const tipsTotal = totauxTotal.tips;
  const coutsTotalClassiques = appData.depenses ? appData.depenses.reduce((sum, d) => sum + (d.montant || 0), 0) : 0;
  
  // Ajouter les coûts Google Ads totaux
  const coutsTotal = coutsTotalClassiques + (googleAdsData.totalCost || 0);

  // Bons cadeaux non utilisés
  const bonsNonUtilises = DataManager.getMontantBonsCadeauxNonUtilises();

  return {
    revenus,
    revenusMassageMois,
    revenusHeadSpaMois,
    nbMassagesMois,
    nbHeadSpaMois,
    nbMassagesAnnee,
    nbHeadSpaAnnee,
    tips,
    couts,
    marge,
    tauxMarge,
    massagesAVenir: rdvFuturs.length,
    massagesRealises: prestationsAnnee.length,
    massagesRealisesMois: prestationsMoisCalendaire.length,
    massagesAnnules: rdvAnnules.length,
    paiementsAVenir,
    bonsNonUtilises,
    clientDuMois: clientDuMois || 'Aucun',
    revenusAnnee,
    revenusTotal,
    revenusMassageTotal,
    revenusHeadSpaTotal,
    nbMassagesTotal,
    nbHeadSpaTotal,
    // v1.0.7.0 : dictionnaires par groupe (pour KPIs dynamiques par groupe)
    revenusParGroupeMois,
    nbParGroupeMois,
    revenusParGroupeAnnee,
    nbParGroupeAnnee,
    revenusParGroupeTotal,
    nbParGroupeTotal,
    tipsTotal,
    coutsTotal,
    // ROI Google Ads
    googleAdsROI: googleAdsData.roi,
    googleAdsCost: googleAdsData.totalCost,
    googleAdsRevenue: googleAdsData.totalRevenue,
    googleAdsClientsCount: googleAdsData.clientsCount,
    googleAdsPrestationsCount: googleAdsData.prestationsCount,
    hasGoogleAdsData: googleAdsData.hasGoogleAdsData,
    // Info de mise à jour pour affichage
    googleAdsLastUpdate: googleAdsLastUpdate
  };
}

// ✅ FONCTION : Estimer le prix d'un RDV selon les tarifs configurés
function estimerPrixRdv(rdv) {
  // Essayer d'abord via la carte des soins (nouveau système)
  const prixCarte = DataManager.getPrixForSoinVariante(rdv.soinId, rdv.duree);
  if (prixCarte !== null) {
    return prixCarte;
  }

  // Fallback : ancien système avec tarifsMassage
  const appData = DataManager.getAppData();
  const tarifs = appData.parametres?.tarifsMassage || {};

  const tarifsDefaut = {
    "Massage sur mesure": { 30: 50, 45: 60, 60: 80, 90: 110 },
    "Les Rituels": { 60: 80, 90: 110, 120: 150 },
    "HeadSpa": { 30: 20, 45: 35, 60: 40 }
  };

  const tarifsType = tarifs[rdv.type] || tarifsDefaut[rdv.type] || tarifsDefaut["Massage sur mesure"];
  const duree = rdv.duree || 60;

  if (tarifsType[duree]) {
    return tarifsType[duree];
  }

  // Si durée exacte pas trouvée, prendre la durée la plus proche
  const dureesDisponibles = Object.keys(tarifsType).map(Number).sort((a, b) => a - b);
  let dureePlusProche = dureesDisponibles[0];

  for (const d of dureesDisponibles) {
    if (Math.abs(d - duree) < Math.abs(dureePlusProche - duree)) {
      dureePlusProche = d;
    }
  }

  return tarifsType[dureePlusProche] || 100;
}

// ===== CALCULS CALENDRIER =====
function getCalendarData(year, month) {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const firstDayWeek = firstDay.getDay() || 7; // Lundi = 1
  const daysInMonth = lastDay.getDate();
  
  return {
    firstDay,
    lastDay,
    firstDayWeek,
    daysInMonth,
    prevMonth: new Date(year, month - 1, 0)
  };
}

// ===== CALCULS ANALYTICS =====
function calculateFilterAmounts() {
  const appData = DataManager.getAppData();
  const amounts = {
    prestations: appData.prestations.reduce((sum, p) => sum + Encaissements.encaissePrestation(p), 0),
    huiles: 0,
    materiel: 0,
    formation: 0,
    transport: 0,
    marketing: 0,
    loyer: 0,
    autre: 0
  };
  
  if (appData.depenses) {
    appData.depenses.forEach(d => {
      const cat = d.categorie || 'Autre';
      const montant = d.montant || 0;
      switch(cat) {
        case 'Huiles': amounts.huiles += montant; break;
        case 'Matériel': amounts.materiel += montant; break;
        case 'Formation': amounts.formation += montant; break;
        case 'Transport': amounts.transport += montant; break;
        case 'Marketing': amounts.marketing += montant; break;
        case 'Loyer': amounts.loyer += montant; break;
        default: amounts.autre += montant; break;
      }
    });
  }
  
  const totalPrestations = appData.prestations.length;
  const avgDuration = totalPrestations > 0 ? 
    appData.prestations.reduce((sum, p) => sum + (p.duree || 60), 0) / totalPrestations : 0;
  
  return {
    amounts,
    totalPrestations,
    avgDuration
  };
}


function getPrestationsTypeChart(selectedYear = 'current', selectedMonth = '') {
  const appData = DataManager.getAppData();

  // Filtrer les prestations selon l'année/mois (v1.1.0.0 : 'current' = annee en cours)
  const prestationsFiltered = appData.prestations.filter(p =>
    estDansPeriodeAnalytics(p.date, selectedYear, selectedMonth)
  );

  // Regrouper par CATEGORIE (pas par soin individuel)
  const categories = DataManager.getCategories ? DataManager.getCategories() : [];
  const catCounts = {};
  const catDetails = {}; // Détail des soins par catégorie pour le tooltip

  // Initialiser toutes les catégories actives (même à 0)
  categories.forEach(cat => {
    catCounts[cat.nom] = 0;
    catDetails[cat.nom] = {};
  });

  prestationsFiltered.forEach(p => {
    const soin = DataManager.resolveSoin ? DataManager.resolveSoin(p.soinId || p.type) : null;
    if (soin) {
      const cat = DataManager.getCategorieById ? DataManager.getCategorieById(soin.categorieId) : null;
      const catNom = cat ? cat.nom : 'Autre';
      // Si la catégorie est archivée, trouver la catégorie active correspondante
      if (cat && cat.statut !== 'actif') {
        // Chercher une catégorie active par défaut
        const activeCat = categories.find(c => c.id === soin.categorieId) || categories[0];
        const activeCatNom = activeCat ? activeCat.nom : 'Autre';
        catCounts[activeCatNom] = (catCounts[activeCatNom] || 0) + 1;
        catDetails[activeCatNom] = catDetails[activeCatNom] || {};
        catDetails[activeCatNom][soin.nom] = (catDetails[activeCatNom][soin.nom] || 0) + 1;
      } else {
        catCounts[catNom] = (catCounts[catNom] || 0) + 1;
        catDetails[catNom] = catDetails[catNom] || {};
        catDetails[catNom][soin.nom] = (catDetails[catNom][soin.nom] || 0) + 1;
      }
    } else {
      // Prestation sans soin résolu → regrouper sous "Autre"
      const catNom = 'Autre';
      catCounts[catNom] = (catCounts[catNom] || 0) + 1;
      catDetails[catNom] = catDetails[catNom] || {};
      const detailName = p.type || 'Inconnu';
      catDetails[catNom][detailName] = (catDetails[catNom][detailName] || 0) + 1;
    }
  });

  return {
    labels: Object.keys(catCounts),
    data: Object.values(catCounts),
    details: catDetails
  };
}

function getDureesChart(selectedYear = 'current', selectedMonth = '') {
  const appData = DataManager.getAppData();
  
  // Filtrer les prestations selon l'année/mois (v1.1.0.0 : 'current' = annee en cours)
  const prestationsFiltered = appData.prestations.filter(p =>
    estDansPeriodeAnalytics(p.date, selectedYear, selectedMonth)
  );

  const dureesCounts = {};
  prestationsFiltered.forEach(p => {
    const duree = p.duree || 60;
    dureesCounts[`${duree} min`] = (dureesCounts[`${duree} min`] || 0) + 1;
  });
  
  return {
    labels: Object.keys(dureesCounts),
    data: Object.values(dureesCounts)
  };
}

// v1.0.7.0 : determine le groupe d'analyse d'une prestation via sa categorie de soin.
// Fallback : si pas de groupe trouve, on utilise l'ancienne logique isPartnershipSoin.
function getGroupeNameForPrestation(p) {
  if (!p) return 'Massages';
  const soinKey = p.soinId || p.type;
  if (DataManager.getGroupeForSoinId) {
    const g = DataManager.getGroupeForSoinId(soinKey);
    if (g) return g;
  }
  // Fallback retrocompat : on conserve la dichotomie historique
  return DataManager.isPartnershipSoin(soinKey) ? 'HeadSpa' : 'Massages';
}

function calculateKeyStats(selectedYear = 'current', selectedMonth = '') {
  const appData = DataManager.getAppData();
  
  // v1.1.0.0 : 'current' = annee en cours (l'en-tete affiche deja "Cette annee")
  const prestationsFiltered = appData.prestations.filter(p =>
    estDansPeriodeAnalytics(p.date, selectedYear, selectedMonth)
  );

  const totalClients = appData.clients.length;
  const totalProspects = appData.prospects.length;
  
  const clientsAvecPrestations = new Set(prestationsFiltered.map(p => p.clientId));
  const clientsAvecPlusieursSeances = Array.from(clientsAvecPrestations).filter(clientId => {
    const seances = prestationsFiltered.filter(p => p.clientId === clientId);
    return seances.length > 1;
  }).length;
  
  const tauxRetour = clientsAvecPrestations.size > 0 ? ((clientsAvecPlusieursSeances / clientsAvecPrestations.size) * 100) : 0;
  
  const dureeMoyenne = prestationsFiltered.length > 0 
    ? prestationsFiltered.reduce((sum, p) => sum + (p.duree || 60), 0) / prestationsFiltered.length 
    : 0;
  
  const activiteMensuelle = {};
  prestationsFiltered.forEach(p => {
    const mois = new Date(p.date).getMonth();
    activiteMensuelle[mois] = (activiteMensuelle[mois] || 0) + 1;
  });
  
  const picMoisIndex = Object.keys(activiteMensuelle).length > 0 ? 
    Object.keys(activiteMensuelle).reduce((a, b) => 
      activiteMensuelle[a] > activiteMensuelle[b] ? a : b, 0) : 0;
  
  const moisNoms = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 
                   'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'];
  
  const filteredClientsCount = clientsAvecPrestations.size;
  
  return {
    tauxRetour,
    dureeMoyenne,
    picMois: moisNoms[picMoisIndex] || 'N/A',
    totalClients,
    totalProspects,
    filteredClientsCount  // NOUVEAU
  };
}

// ===== GÉOCODAGE MULTI-SERVICES =====
async function validateAddress(address) {
  if (!address || address.trim().length < 5) {
    return { valid: false, message: "Adresse trop courte" };
  }
  
  const nominatimResult = await tryNominatimPrecise(address);
  if (nominatimResult.valid && isAddressPrecise(nominatimResult, address)) {
    return nominatimResult;
  }
  
  const orsResult = await tryOpenRouteService(address);
  if (orsResult.valid && isAddressPrecise(orsResult, address)) {
    return orsResult;
  }
  
  const franceResult = await tryFranceGeocodingAPI(address);
  if (franceResult.valid && isAddressPrecise(franceResult, address)) {
    return franceResult;
  }
  
  const bestResult = [nominatimResult, orsResult, franceResult]
    .filter(r => r.valid)
    .sort((a, b) => calculatePrecisionScore(b, address) - calculatePrecisionScore(a, address))[0];
  
  if (bestResult) {
    return bestResult;
  }
  
  return { valid: false, message: "Aucun service de géocodage n'a trouvé cette adresse" };
}

async function tryNominatimPrecise(address) {
  try {
    const addressVariants = generateAddressVariants(address);
    
    for (const variant of addressVariants) {
      const url = `https://nominatim.openstreetmap.org/search?` + new URLSearchParams({
        format: 'json',
        q: variant,
        limit: 5,
        countrycodes: 'fr',
        addressdetails: 1,
        extratags: 1,
        namedetails: 1,
        'accept-language': 'fr'
      });
      
      const response = await fetch(url, {
        headers: { 'User-Agent': 'EliseMassageApp/1.0' }
      });
      
      if (response.ok) {
        const data = await response.json();
        
        if (data && data.length > 0) {
          const bestResult = findMostPreciseResult(data, address);
          if (bestResult) {
            return {
              valid: true,
              formatted: bestResult.display_name,
              coordinates: {
                lat: parseFloat(bestResult.lat),
                lon: parseFloat(bestResult.lon)
              },
              service: 'nominatim',
              precision: bestResult.type,
              originalAddress: address
            };
          }
        }
      }
      
      await new Promise(resolve => setTimeout(resolve, 200));
    }
  } catch (error) {
    // Erreur silencieuse
  }
  
  return { valid: false };
}

async function tryOpenRouteService(address) {
  const parametres = DataManager.getParametres();
  const apiKey = parametres.openRouteServiceKey;
  
  if (!apiKey || apiKey.trim() === '') {
    return { valid: false };
  }
  
  try {
    const addressVariants = generateAddressVariants(address);
    
    for (const variant of addressVariants) {
      const url = `https://api.openrouteservice.org/geocode/search?` + new URLSearchParams({
        api_key: apiKey,
        text: variant,
        'boundary.country': 'FR',
        size: 5,
        layers: 'address,street,venue'
      });
      
      const response = await fetch(url);
      
      if (response.ok) {
        const data = await response.json();
        
        if (data.features && data.features.length > 0) {
          const bestResult = data.features[0];
          
          return {
            valid: true,
            formatted: bestResult.properties.label,
            coordinates: {
              lat: bestResult.geometry.coordinates[1],
              lon: bestResult.geometry.coordinates[0]
            },
            service: 'openrouteservice',
            precision: bestResult.properties.layer,
            originalAddress: address
          };
        }
      }
      
      await new Promise(resolve => setTimeout(resolve, 200));
    }
  } catch (error) {
    // Erreur silencieuse
  }
  
  return { valid: false };
}

async function tryFranceGeocodingAPI(address) {
  try {
    const url = `https://api-adresse.data.gouv.fr/search/?` + new URLSearchParams({
      q: address,
      limit: 5,
      autocomplete: 0
    });
    
    const response = await fetch(url);
    
    if (response.ok) {
      const data = await response.json();
      
      if (data.features && data.features.length > 0) {
        const bestResult = data.features[0];
        
        return {
          valid: true,
          formatted: bestResult.properties.label,
          coordinates: {
            lat: bestResult.geometry.coordinates[1],
            lon: bestResult.geometry.coordinates[0]
          },
          service: 'api-adresse-france',
          precision: bestResult.properties.type,
          score: bestResult.properties.score,
          originalAddress: address
        };
      }
    }
  } catch (error) {
    // Erreur silencieuse
  }
  
  return { valid: false };
}

// ===== CALCUL DE DISTANCE ROUTIÈRE =====
async function calculateRealDistance(address1, address2) {
  const parametres = DataManager.getParametres();
  const apiKey = parametres.openRouteServiceKey;
  
  try {
    const addr1 = await validateAddress(address1);
    const addr2 = await validateAddress(address2);
    
    if (!addr1.valid || !addr2.valid) {
      return { error: "Une des adresses n'est pas valide" };
    }
    
    if (apiKey && apiKey.trim() !== '') {
      try {
        const requestBody = {
          coordinates: [
            [addr1.coordinates.lon, addr1.coordinates.lat],
            [addr2.coordinates.lon, addr2.coordinates.lat]
          ],
          format: "json",
          preference: "recommended",
          units: "m",
          language: "fr",
          geometry: false,
          instructions: false,
          elevation: false
        };
        
        const response = await fetch('https://api.openrouteservice.org/v2/directions/driving-car', {
          method: 'POST',
          headers: {
            'Accept': 'application/json',
            'Authorization': apiKey,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(requestBody)
        });
        
        if (response.ok) {
          const data = await response.json();
          
          if (data.routes && data.routes.length > 0) {
            const route = data.routes[0];
            const summary = route.summary;
            
            const distanceMeters = summary.distance;
            const dureeSecondes = summary.duration;
            
            const distanceKm = Math.round((distanceMeters / 1000) * 100) / 100;
            const dureeMinutes = Math.round(dureeSecondes / 60);
            
            return {
              success: true,
              distanceKm: distanceKm,
              dureeMinutes: dureeMinutes,
              fromFormatted: addr1.formatted,
              toFormatted: addr2.formatted,
              method: 'openrouteservice_route_réelle'
            };
          } else {
            return { error: "Aucune route trouvée entre ces deux points" };
          }
        } else {
          if (response.status === 401) {
            return { error: "Clé API OpenRouteService invalide" };
          } else if (response.status === 429) {
            return { error: "Quota OpenRouteService dépassé" };
          } else if (response.status === 400) {
            return { error: "Erreur dans les paramètres de la requête" };
          } else if (response.status === 404) {
            return { error: "Aucune route trouvée entre ces deux points" };
          } else {
            return { error: `Erreur OpenRouteService: ${response.status}` };
          }
        }
      } catch (apiError) {
        return { error: `Erreur technique: ${apiError.message}` };
      }
    } else {
      return { error: "Clé API OpenRouteService non configurée" };
    }
    
  } catch (error) {
    return { error: "Erreur calcul distance: " + error.message };
  }
}

// ===== FONCTIONS UTILITAIRES =====
function generateAddressVariants(address) {
  const variants = [address];
  
  if (!address.toLowerCase().includes('france')) {
    variants.push(`${address}, France`);
  }
  
  if (!address.toLowerCase().includes('corse')) {
    variants.push(`${address}, Corse, France`);
  }
  
  const codePostalMatch = address.match(/\b20\d{3}\b/);
  if (codePostalMatch) {
    const withoutCP = address.replace(/\b20\d{3}\b/, '').trim();
    variants.push(`${withoutCP}, ${codePostalMatch[0]}, France`);
  }
  
  return [...new Set(variants)];
}

function findMostPreciseResult(results, originalAddress) {
  const precisionOrder = ['house', 'building', 'yes', 'road', 'hamlet', 'village', 'town', 'city'];
  
  for (const precision of precisionOrder) {
    const match = results.find(r => r.type === precision || r.class === precision);
    if (match) return match;
  }
  
  return results[0];
}

function isAddressPrecise(result, originalAddress) {
  if (!result.valid) return false;
  
  const originalWords = originalAddress.toLowerCase().split(/\s+/);
  const resultWords = result.formatted.toLowerCase().split(/\s+/);
  
  const significantWords = originalWords.filter(w => w.length > 2);
  const matchingWords = significantWords.filter(w => 
    resultWords.some(rw => rw.includes(w) || w.includes(rw))
  );
  
  const matchRatio = matchingWords.length / significantWords.length;
  return matchRatio >= 0.4;
}

function calculatePrecisionScore(result, originalAddress) {
  if (!result.valid) return 0;
  
  let score = 0;
  
  const serviceScores = {
    'api-adresse-france': 10,
    'nominatim': 8,
    'openrouteservice': 6
  };
  score += serviceScores[result.service] || 0;
  
  const precisionScores = {
    'house': 10, 'building': 9, 'address': 9,
    'road': 7, 'street': 7,
    'hamlet': 5, 'village': 4, 'town': 3, 'city': 2
  };
  score += precisionScores[result.precision] || 0;
  
  if (result.score) {
    score += result.score * 10;
  }
  
  return score;
}

async function calculateDistance(address1, address2) {
  return await calculateRealDistance(address1, address2);
}

// ===== EXPORTS GLOBAUX =====
window.Calculations = {
  // Dashboard
  calculateDashboardKPIs,
  estimerPrixRdv,
  
  // Calendrier
  getCalendarData,
  
  // Analytics
  calculateFilterAmounts,
  getPrestationsTypeChart,
  getDureesChart,
  getGroupeNameForPrestation,
  calculateKeyStats,
  // v1.1.0.0 : filtres annee/mois, partages avec les services
  bornesAnalytics,
  estDansPeriodeAnalytics,

  // Distance
  validateAddress,
  calculateRealDistance,
  calculateDistance
};