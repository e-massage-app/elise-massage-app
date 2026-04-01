// ===== js/core/calculations.js =====
// Tous les calculs : KPI, analytics, statistiques

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
  const currentMonthCost = cachedCosts.currentMonth || totalCost; // Fallback

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
if (cachedCosts.lastUpdateMonth) {
  const lastUpdate = new Date(cachedCosts.lastUpdateMonth);
  const now = new Date();
  const hoursSinceUpdate = (now - lastUpdate) / (1000 * 60 * 60);
  
  if (hoursSinceUpdate < 6) {
    // Cache valide (< 6h)
    googleAdsCostThisMonth = cachedCosts.currentMonth || 0;
    googleAdsLastUpdate = lastUpdate;
  } else {
    // Cache obsolète (> 6h)
    needsRefresh = true;
    googleAdsCostThisMonth = cachedCosts.currentMonth || 0; // Utiliser l'ancien en attendant
    googleAdsLastUpdate = lastUpdate;
  }
} else if (cachedCosts.currentMonth) {
  // Ancien cache sans date
  googleAdsCostThisMonth = cachedCosts.currentMonth;
  needsRefresh = true;
} else if (isGoogleAdsConnected && selectedCampaigns.length > 0) {
  // Pas de cache du tout
  needsRefresh = true;
}

// Lancer le refresh si nécessaire
if (needsRefresh && isGoogleAdsConnected && selectedCampaigns.length > 0 && !window.googleAdsApiInProgress) {
  window.googleAdsApiInProgress = true;
  
  if (window.UtilsServices && window.UtilsServices.getGoogleAdsCostsThisMonth) {
    window.UtilsServices.getGoogleAdsCostsThisMonth().then(cost => {
      window.googleAdsApiInProgress = false;
      
      if (cost > 0) {
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
  
  // Calcul des KPIs financiers AVEC frais de déplacement intégrés ET tips
  // Revenus prestations (hors bons cadeaux utilisés pour éviter double comptage)
  const prestationsClassiquesMois = prestationsMoisCourant
    .filter(p => p.moyenPaiement !== 'Bon cadeau' && !p.bonCadeauId);
  const revenusPrestations = prestationsClassiquesMois
    .reduce((sum, p) => sum + (p.prix || 0), 0);

  // Revenus séparés Massage vs HeadSpa (partenariat) du mois
  const revenusMassageMois = prestationsClassiquesMois
    .filter(p => !DataManager.isPartnershipSoin(p.soinId || p.type))
    .reduce((sum, p) => sum + (p.prix || 0), 0);
  const revenusHeadSpaMois = prestationsClassiquesMois
    .filter(p => DataManager.isPartnershipSoin(p.soinId || p.type))
    .reduce((sum, p) => sum + (p.prix || 0), 0);

  // Revenus des bons cadeaux VENDUS ce mois (encaissés à l'achat)
  const bonsCadeauxVendusMois = (appData.bonsCadeaux || []).filter(bon => {
    const dateAchat = new Date(bon.dateAchat);
    if (calculPeriode === 'mois-calendaire') {
      return dateAchat.getMonth() === currentMonth && dateAchat.getFullYear() === currentYear;
    } else {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      return dateAchat >= thirtyDaysAgo && dateAchat <= now;
    }
  });
  const revenusBonsCadeaux = bonsCadeauxVendusMois.reduce((sum, bon) => sum + (bon.montant || 0), 0);

  // Total revenus = prestations classiques + ventes de bons cadeaux
  const revenus = revenusPrestations + revenusBonsCadeaux;
  const tips = prestationsMoisCourant.reduce((sum, p) => sum + (p.tips || 0), 0);
  const coutsClassiques = depensesMoisCourant.reduce((sum, d) => sum + (d.montant || 0), 0);
  
  // ✅ CORRECTION : Utiliser les vrais coûts Google Ads du mois si disponibles
  const couts = coutsClassiques + googleAdsCostThisMonth;
  
  // La marge finale = revenus + tips - tous les coûts (y compris Google Ads)
  const marge = revenus + tips - couts;
  const tauxMarge = (revenus + tips) > 0 ? ((marge / (revenus + tips)) * 100) : 0;
  
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
  
  // Nb séparés du mois (massage vs HeadSpa)
  const nbMassagesMois = prestationsMoisCalendaire
    .filter(p => !DataManager.isPartnershipSoin(p.soinId || p.type)).length;
  const nbHeadSpaMois = prestationsMoisCalendaire
    .filter(p => DataManager.isPartnershipSoin(p.soinId || p.type)).length;

  // Nb séparés de l'année
  const nbMassagesAnnee = prestationsAnnee
    .filter(p => !DataManager.isPartnershipSoin(p.soinId || p.type)).length;
  const nbHeadSpaAnnee = prestationsAnnee
    .filter(p => DataManager.isPartnershipSoin(p.soinId || p.type)).length;

  // CA Total Année (prestations classiques + bons cadeaux vendus sur l'année en cours)
  const prestationsClassiquesAnnee = prestationsAnnee
    .filter(p => p.moyenPaiement !== 'Bon cadeau' && !p.bonCadeauId);
  const revenusPrestationsAnnee = prestationsClassiquesAnnee
    .reduce((sum, p) => sum + (p.prix || 0), 0);
  const bonsCadeauxVendusAnnee = (appData.bonsCadeaux || []).filter(bon => {
    const dateAchat = new Date(bon.dateAchat);
    return dateAchat.getFullYear() === currentYear && bon.statut !== 'rembourse';
  });
  const revenusBonsCadeauxAnnee = bonsCadeauxVendusAnnee.reduce((sum, bon) => sum + (bon.montant || 0), 0);
  const revenusAnnee = revenusPrestationsAnnee + revenusBonsCadeauxAnnee;

  // Revenus et coûts depuis le début (toutes données) AVEC frais déplacement ET tips
  // Revenus prestations totaux (hors bons cadeaux utilisés)
  const prestationsClassiquesTotal = appData.prestations
    .filter(p => p.moyenPaiement !== 'Bon cadeau' && !p.bonCadeauId);
  const revenusPrestationsTotal = prestationsClassiquesTotal
    .reduce((sum, p) => sum + (p.prix || 0), 0);

  // Revenus séparés totaux (all time)
  const revenusMassageTotal = prestationsClassiquesTotal
    .filter(p => !DataManager.isPartnershipSoin(p.soinId || p.type))
    .reduce((sum, p) => sum + (p.prix || 0), 0);
  const revenusHeadSpaTotal = prestationsClassiquesTotal
    .filter(p => DataManager.isPartnershipSoin(p.soinId || p.type))
    .reduce((sum, p) => sum + (p.prix || 0), 0);

  // Nb séparés totaux (all time)
  const nbMassagesTotal = appData.prestations
    .filter(p => !DataManager.isPartnershipSoin(p.soinId || p.type)).length;
  const nbHeadSpaTotal = appData.prestations
    .filter(p => DataManager.isPartnershipSoin(p.soinId || p.type)).length;

  // Revenus bons cadeaux vendus (tous, sauf remboursés)
  const revenusBonsCadeauxTotal = (appData.bonsCadeaux || [])
    .filter(bon => bon.statut !== 'rembourse')
    .reduce((sum, bon) => sum + (bon.montant || 0), 0);

  const revenusTotal = revenusPrestationsTotal + revenusBonsCadeauxTotal;
  const tipsTotal = appData.prestations.reduce((sum, p) => sum + (p.tips || 0), 0);
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
    prestations: appData.prestations.reduce((sum, p) => sum + (p.prix || 0), 0),
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

function getRevenueChartData(filters = null, period = 12, selectedYear = 'current', selectedMonth = '') {
  const appData = DataManager.getAppData();

  const isMoisCourant = period === 'current-month';
  const months = [];
  const revenues = [];
  const headSpaRevenues = [];
  const bonsCadeauxRevenues = [];
  const tips = [];
  const costs = [];

  if (isMoisCourant) {
    const today = new Date();
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth();
    const todayDate = today.getDate();

    for (let day = 1; day <= todayDate; day++) {
      const dateString = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

      months.push(day.toString());

      let revenuJour = 0;
      let headSpaJour = 0;
      let bonsCadeauxJour = 0;
      let tipsJour = 0;

      const prestationsJour = appData.prestations.filter(p => p.date === dateString);
      const prestationsClassiques = prestationsJour.filter(p => p.moyenPaiement !== 'Bon cadeau' && !p.bonCadeauId);

      // Massages (hors HeadSpa)
      if (!filters || filters.massages) {
        const prestationsMassages = prestationsClassiques.filter(p => !DataManager.isPartnershipSoin(p.soinId || p.type));
        revenuJour = prestationsMassages.reduce((sum, p) => sum + (p.prix || 0), 0);
      }

      // HeadSpa
      if (!filters || filters.headspa) {
        const prestationsHeadSpa = prestationsClassiques.filter(p => DataManager.isPartnershipSoin(p.soinId || p.type));
        headSpaJour = prestationsHeadSpa.reduce((sum, p) => sum + (p.prix || 0), 0);
      }

      // Bons Cadeaux vendus
      if (!filters || filters.bonsCadeaux) {
        const bonsJour = (appData.bonsCadeaux || []).filter(bon => bon.dateAchat === dateString);
        bonsCadeauxJour = bonsJour.reduce((sum, bon) => sum + (bon.montant || 0), 0);
      }

      // Tips
      if (!filters || filters.tips) {
        tipsJour = prestationsJour.reduce((sum, p) => sum + (p.tips || 0), 0);
      }

      let coutJour = 0;
      if (appData.depenses) {
        const depensesJour = appData.depenses.filter(d => d.date === dateString);
        coutJour = depensesJour.reduce((sum, d) => {
          if (!filters) return sum + (d.montant || 0);

          const cat = d.categorie || 'Autre';
          if ((cat === 'Huiles' && filters.depensesHuiles) ||
              (cat === 'Matériel' && filters.depensesMateriel) ||
              (cat === 'Formation' && filters.depensesFormation) ||
              (cat === 'Transport' && filters.depensesTransport) ||
              (cat === 'Marketing' && filters.depensesMarketing) ||
              (cat === 'Loyer' && filters.depensesLoyer) ||
              (cat === 'Autre' && filters.depensesAutre)) {
            return sum + (d.montant || 0);
          }
          return sum;
        }, 0);
      }

      revenues.push(revenuJour);
      headSpaRevenues.push(headSpaJour);
      bonsCadeauxRevenues.push(bonsCadeauxJour);
      tips.push(tipsJour);
      costs.push(coutJour);
    }
  } else {
    const actualPeriod = period;

    for (let i = actualPeriod - 1; i >= 0; i--) {
      const date = selectedYear === 'current' ? new Date() : new Date(parseInt(selectedYear), 11, 31);
      date.setMonth(date.getMonth() - i);

      if (selectedMonth !== '' && date.getMonth() + 1 !== parseInt(selectedMonth)) {
        continue;
      }

      const monthStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

      months.push(date.toLocaleDateString('fr-FR', {
        month: 'short',
        year: period > 6 ? 'numeric' : undefined
      }));

      let revenuMois = 0;
      let headSpaMois = 0;
      let bonsCadeauxMois = 0;
      let tipsMois = 0;

      const prestationsMois = appData.prestations.filter(p => p.date.startsWith(monthStr));
      const prestationsClassiques = prestationsMois.filter(p => p.moyenPaiement !== 'Bon cadeau' && !p.bonCadeauId);

      // Massages (hors HeadSpa)
      if (!filters || filters.massages) {
        const prestationsMassages = prestationsClassiques.filter(p => !DataManager.isPartnershipSoin(p.soinId || p.type));
        revenuMois = prestationsMassages.reduce((sum, p) => sum + (p.prix || 0), 0);
      }

      // HeadSpa
      if (!filters || filters.headspa) {
        const prestationsHeadSpa = prestationsClassiques.filter(p => DataManager.isPartnershipSoin(p.soinId || p.type));
        headSpaMois = prestationsHeadSpa.reduce((sum, p) => sum + (p.prix || 0), 0);
      }

      // Bons Cadeaux vendus
      if (!filters || filters.bonsCadeaux) {
        const bonsVendusMois = (appData.bonsCadeaux || []).filter(bon => bon.dateAchat.startsWith(monthStr));
        bonsCadeauxMois = bonsVendusMois.reduce((sum, bon) => sum + (bon.montant || 0), 0);
      }

      // Tips
      if (!filters || filters.tips) {
        tipsMois = prestationsMois.reduce((sum, p) => sum + (p.tips || 0), 0);
      }

      let coutMois = 0;
      if (appData.depenses) {
        const depensesMois = appData.depenses.filter(d => d.date.startsWith(monthStr));
        coutMois = depensesMois.reduce((sum, d) => {
          if (!filters) return sum + (d.montant || 0);

          const cat = d.categorie || 'Autre';
          if ((cat === 'Huiles' && filters.depensesHuiles) ||
              (cat === 'Matériel' && filters.depensesMateriel) ||
              (cat === 'Formation' && filters.depensesFormation) ||
              (cat === 'Transport' && filters.depensesTransport) ||
              (cat === 'Marketing' && filters.depensesMarketing) ||
              (cat === 'Loyer' && filters.depensesLoyer) ||
              (cat === 'Autre' && filters.depensesAutre)) {
            return sum + (d.montant || 0);
          }
          return sum;
        }, 0);
      }

      revenues.push(revenuMois);
      headSpaRevenues.push(headSpaMois);
      bonsCadeauxRevenues.push(bonsCadeauxMois);
      tips.push(tipsMois);
      costs.push(coutMois);
    }
  }

  return { months, revenues, headSpaRevenues, bonsCadeauxRevenues, tips, costs };
}


function getPrestationsTypeChart(selectedYear = 'current', selectedMonth = '') {
  const appData = DataManager.getAppData();

  // Filtrer les prestations selon l'année/mois
  const prestationsFiltered = appData.prestations.filter(p => {
    const date = new Date(p.date);
    const year = date.getFullYear();
    const month = date.getMonth() + 1;

    if (selectedYear !== 'current' && selectedYear !== '' && year !== parseInt(selectedYear)) {
      return false;
    }
    if (selectedMonth !== '' && month !== parseInt(selectedMonth)) {
      return false;
    }
    return true;
  });

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
  
  // Filtrer les prestations selon l'année/mois
  const prestationsFiltered = appData.prestations.filter(p => {
    const date = new Date(p.date);
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    
    if (selectedYear !== 'current' && selectedYear !== '' && year !== parseInt(selectedYear)) {
      return false;
    }
    if (selectedMonth !== '' && month !== parseInt(selectedMonth)) {
      return false;
    }
    return true;
  });
  
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

function calculateFilterAmountsForPeriod(period = 12, selectedYear = 'current') {
  const appData = DataManager.getAppData();
  const amounts = { massages: 0, headspa: 0, bonsCadeaux: 0, tips: 0, huiles: 0, materiel: 0, formation: 0, transport: 0, marketing: 0, loyer: 0, autre: 0 };

  const isMoisCourant = period === 'current-month';

  if (isMoisCourant) {
    const today = new Date();
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth();
    const todayDate = today.getDate();

    for (let day = 1; day <= todayDate; day++) {
      const dateString = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

      const prestationsJour = appData.prestations.filter(p => p.date === dateString);
      const prestationsClassiques = prestationsJour.filter(p => p.moyenPaiement !== 'Bon cadeau' && !p.bonCadeauId);

      // Massages (hors HeadSpa)
      const prestationsMassages = prestationsClassiques.filter(p => !DataManager.isPartnershipSoin(p.soinId || p.type));
      amounts.massages += prestationsMassages.reduce((sum, p) => sum + (p.prix || 0), 0);

      // HeadSpa
      const prestationsHeadSpa = prestationsClassiques.filter(p => DataManager.isPartnershipSoin(p.soinId || p.type));
      amounts.headspa += prestationsHeadSpa.reduce((sum, p) => sum + (p.prix || 0), 0);

      // Bons Cadeaux vendus
      const bonsJour = (appData.bonsCadeaux || []).filter(bon => bon.dateAchat === dateString);
      amounts.bonsCadeaux += bonsJour.reduce((sum, bon) => sum + (bon.montant || 0), 0);

      // Tips
      amounts.tips += prestationsJour.reduce((sum, p) => sum + (p.tips || 0), 0);

      if (appData.depenses) {
        const depensesJour = appData.depenses.filter(d => d.date === dateString);
        depensesJour.forEach(d => {
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
    }
  } else {
    const actualPeriod = period;

    for (let i = actualPeriod - 1; i >= 0; i--) {
      const date = selectedYear === 'current' ? new Date() : new Date(parseInt(selectedYear), 11, 31);
      date.setMonth(date.getMonth() - i);
      const monthStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

      const prestationsMois = appData.prestations.filter(p => p.date.startsWith(monthStr));
      const prestationsClassiques = prestationsMois.filter(p => p.moyenPaiement !== 'Bon cadeau' && !p.bonCadeauId);

      // Massages (hors HeadSpa)
      const prestationsMassages = prestationsClassiques.filter(p => !DataManager.isPartnershipSoin(p.soinId || p.type));
      amounts.massages += prestationsMassages.reduce((sum, p) => sum + (p.prix || 0), 0);

      // HeadSpa
      const prestationsHeadSpa = prestationsClassiques.filter(p => DataManager.isPartnershipSoin(p.soinId || p.type));
      amounts.headspa += prestationsHeadSpa.reduce((sum, p) => sum + (p.prix || 0), 0);

      // Bons Cadeaux vendus
      const bonsMois = (appData.bonsCadeaux || []).filter(bon => bon.dateAchat.startsWith(monthStr));
      amounts.bonsCadeaux += bonsMois.reduce((sum, bon) => sum + (bon.montant || 0), 0);

      // Tips
      amounts.tips += prestationsMois.reduce((sum, p) => sum + (p.tips || 0), 0);

      if (appData.depenses) {
        const depensesMois = appData.depenses.filter(d => d.date.startsWith(monthStr));
        depensesMois.forEach(d => {
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
    }
  }

  return { amounts, totalPrestations: 0, avgDuration: 0 };
}

function calculateKeyStats(selectedYear = 'current', selectedMonth = '') {
  const appData = DataManager.getAppData();
  
  let prestationsFiltered = appData.prestations;
  if (selectedYear !== 'current' || selectedMonth !== '') {
    prestationsFiltered = appData.prestations.filter(p => {
      const date = new Date(p.date);
      const year = date.getFullYear();
      const month = date.getMonth() + 1;
      
      if (selectedYear !== 'current' && selectedYear !== '' && year !== parseInt(selectedYear)) {
        return false;
      }
      if (selectedMonth !== '' && month !== parseInt(selectedMonth)) {
        return false;
      }
      return true;
    });
  }
  
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
  getRevenueChartData,
  getPrestationsTypeChart,
  getDureesChart,
  calculateFilterAmountsForPeriod,
  calculateKeyStats,
  
  // Distance
  validateAddress,
  calculateRealDistance,
  calculateDistance
};