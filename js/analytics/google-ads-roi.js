// ===== js/analytics/google-ads-roi.js =====
// Calcul du ROI Google Ads par période

console.log('🔄 Chargement de google-ads-roi.js...');

/**
 * Calcule le ROI pour toutes les périodes de toutes les campagnes
 * @returns {Object} Résultats par campagne et période
 */
function calculateAllCampaignsROI() {
  const parametres = DataManager.getParametres();
  const selectedCampaigns = parametres.googleAdsSelectedCampaigns || [];
  
  if (selectedCampaigns.length === 0) {
    console.log('ℹ️ Aucune campagne sélectionnée');
    return {};
  }
  
  const results = {};
  
  selectedCampaigns.forEach(campaignId => {
    const periods = DataManager.getCampaignPeriods(campaignId);
    
    if (periods.length === 0) {
      console.log(`ℹ️ Pas de périodes pour la campagne ${campaignId}`);
      return;
    }
    
    results[campaignId] = {
      periods: []
    };
    
    periods.forEach(period => {
      const roiData = calculatePeriodROI(campaignId, period);
      results[campaignId].periods.push(roiData);
    });
  });
  
  return results;
}

/**
 * Calcule le ROI pour une période spécifique
 * @param {string} campaignId - ID de la campagne
 * @param {Object} period - Objet période
 * @returns {Object} Données ROI de la période
 */
function calculatePeriodROI(campaignId, period) {
  console.log(`📊 Calcul ROI pour période ${period.id}...`);
  
  // 1. Récupérer les clients acquis pendant cette période
  const acquiredClients = getClientsAcquiredDuringPeriod(period);
  
  console.log(`✅ ${acquiredClients.length} client(s) acquis pendant cette période`);
  
  // 2. Calculer le revenu total généré par ces clients
  const totalRevenue = calculateClientsLifetimeRevenue(acquiredClients);
  
  console.log(`💰 Revenu total: ${totalRevenue.toFixed(2)}€`);
  
  // 3. Récupérer le coût de la période
  const cost = period.frozenCost || 0;
  
  console.log(`💸 Coût de la période: ${cost.toFixed(2)}€`);
  
  // 4. Calculer le ROI
  const roi = cost > 0 ? ((totalRevenue - cost) / cost) * 100 : 0;
  const profit = totalRevenue - cost;
  
  console.log(`📈 ROI: ${roi.toFixed(2)}%`);
  
  return {
    periodId: period.id,
    startDate: period.startDate,
    endDate: period.endDate,
    isActive: !period.endDate,
    clientsCount: acquiredClients.length,
    clients: acquiredClients.map(c => ({
      id: c.id,
      nom: c.nom,
      prenom: c.prenom,
      acquisitionDate: DataManager.getClientAcquisitionDate(c),
      revenue: calculateClientRevenue(c)
    })),
    cost: cost,
    revenue: totalRevenue,
    profit: profit,
    roi: roi
  };
}

/**
 * Récupère les clients acquis pendant une période donnée
 * @param {Object} period - Objet période
 * @returns {Array} Liste des clients
 */
function getClientsAcquiredDuringPeriod(period) {
  const allClients = DataManager.getAllClients();
  const acquiredClients = [];
  
  const periodStart = new Date(period.startDate);
  const periodEnd = period.endDate ? new Date(period.endDate) : new Date();
  
  allClients.forEach(client => {
    // ✅ FIX: Ne compter QUE les clients Google Ads
    if (client.canalAcquisition !== 'google-ads') return;
    
    const acquisitionDate = DataManager.getClientAcquisitionDate(client);
    
    if (!acquisitionDate) return; // Pas de prestations pour ce client
    
    const clientAcqDate = new Date(acquisitionDate);
    
    // Vérifier si le client a été acquis pendant cette période
    if (clientAcqDate >= periodStart && clientAcqDate <= periodEnd) {
      acquiredClients.push(client);
    }
  });
  
  return acquiredClients;
}

/**
 * Calcule le revenu lifetime total d'une liste de clients
 * @param {Array} clients - Liste des clients
 * @returns {number} Revenu total
 */
function calculateClientsLifetimeRevenue(clients) {
  let totalRevenue = 0;
  
  clients.forEach(client => {
    totalRevenue += calculateClientRevenue(client);
  });
  
  return totalRevenue;
}

/**
 * Calcule le revenu total généré par un client
 * @param {Object} client - Objet client
 * @returns {number} Revenu total
 */
function calculateClientRevenue(client) {
  const allPrestations = DataManager.getAllPrestations();
  const clientPrestations = allPrestations.filter(p => p.clientId === client.id);
  
  let totalRevenue = 0;
  
  clientPrestations.forEach(prestation => {
    totalRevenue += parseFloat(prestation.prix) || 0;
    totalRevenue += parseFloat(prestation.tips) || 0;
  });
  
  return totalRevenue;
}

/**
 * Génère un rapport HTML du ROI par campagne
 * @param {Object} roiData - Données ROI calculées
 * @returns {string} HTML du rapport
 */
function generateROIReport(roiData) {
  if (Object.keys(roiData).length === 0) {
    return '<div style="text-align: center; padding: 2rem; color: #666;">Aucune donnée ROI disponible</div>';
  }
  
  let html = '<div style="padding: 1rem;">';
  
  Object.entries(roiData).forEach(([campaignId, campaignData]) => {
    html += `<div style="margin-bottom: 2rem; border: 1px solid #ddd; border-radius: 8px; padding: 1rem;">`;
    html += `<h3 style="margin: 0 0 1rem 0; color: var(--beige-dore);">📊 Campagne ${campaignId}</h3>`;
    
    campaignData.periods.forEach(period => {
      const roiColor = period.roi > 0 ? '#28a745' : period.roi < 0 ? '#dc3545' : '#666';
      
      html += `
        <div style="background: ${period.isActive ? '#e8f5e8' : '#f8f9fa'}; padding: 1rem; border-radius: 6px; margin-bottom: 1rem;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
            <strong>${period.isActive ? '✅ Période active' : '🔒 Période terminée'}</strong>
            <span style="font-size: 0.9rem; color: #666;">
              Du ${new Date(period.startDate).toLocaleDateString('fr-FR')} 
              ${period.endDate ? `au ${new Date(period.endDate).toLocaleDateString('fr-FR')}` : `à aujourd'hui`}
            </span>
          </div>
          
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 1rem; margin: 1rem 0;">
            <div>
              <div style="font-size: 0.8rem; color: #666;">Clients acquis</div>
              <div style="font-size: 1.5rem; font-weight: 600;">${period.clientsCount}</div>
            </div>
            <div>
              <div style="font-size: 0.8rem; color: #666;">Coût pub</div>
              <div style="font-size: 1.5rem; font-weight: 600; color: #dc3545;">${period.cost.toFixed(2)}€</div>
            </div>
            <div>
              <div style="font-size: 0.8rem; color: #666;">Revenu généré</div>
              <div style="font-size: 1.5rem; font-weight: 600; color: #28a745;">${period.revenue.toFixed(2)}€</div>
            </div>
            <div>
              <div style="font-size: 0.8rem; color: #666;">Profit net</div>
              <div style="font-size: 1.5rem; font-weight: 600; color: ${roiColor};">${period.profit > 0 ? '+' : ''}${period.profit.toFixed(2)}€</div>
            </div>
            <div>
              <div style="font-size: 0.8rem; color: #666;">ROI</div>
              <div style="font-size: 1.5rem; font-weight: 600; color: ${roiColor};">${period.roi > 0 ? '+' : ''}${period.roi.toFixed(0)}%</div>
            </div>
          </div>
          
          ${period.clientsCount > 0 ? `
            <details style="margin-top: 1rem;">
              <summary style="cursor: pointer; font-weight: 600; color: var(--beige-dore);">
                📋 Voir les ${period.clientsCount} client(s)
              </summary>
              <div style="margin-top: 1rem;">
                ${period.clients.map(client => `
                  <div style="display: flex; justify-content: space-between; padding: 0.5rem; border-bottom: 1px solid #e0e0e0;">
                    <span><strong>${client.prenom} ${client.nom}</strong></span>
                    <span style="color: #666;">${new Date(client.acquisitionDate).toLocaleDateString('fr-FR')}</span>
                    <span style="color: #28a745; font-weight: 600;">${client.revenue.toFixed(2)}€</span>
                  </div>
                `).join('')}
              </div>
            </details>
          ` : ''}
        </div>
      `;
    });
    
    html += '</div>';
  });
  
  html += '</div>';
  
  return html;
}

/**
 * Affiche le modal avec le rapport ROI
 */
function showROIReportModal() {
  console.log('📊 Génération du rapport ROI...');
  
  const roiData = calculateAllCampaignsROI();
  const reportHTML = generateROIReport(roiData);
  
  const modalHTML = `
    <h3>📊 Rapport ROI Google Ads</h3>
    <div style="max-height: 500px; overflow-y: auto;">
      ${reportHTML}
    </div>
    <div class="modal-actions" style="margin-top: 1.5rem;">
      <button onclick="closeModal()" class="btn-secondary">Fermer</button>
    </div>
  `;
  
  showModal('roi-report-modal', modalHTML);
}

/**
 * Génère le sélecteur campagne+période pour Analytics
 */
async function generateCampaignPeriodSelector() {
  const parametres = DataManager.getParametres();
  const selectedCampaigns = parametres.googleAdsSelectedCampaigns || [];
  
  if (selectedCampaigns.length === 0) {
    return '';
  }
  
  // ✅ Récupérer TOUTES les campagnes (même REMOVED/En pause)
  const campaignNames = {};
  const allCampaigns = [];
  try {
    const tokens = await getValidTokens();
    if (tokens) {
      const customersResult = await testAccessibleCustomers(tokens.access_token);
      if (customersResult.success) {
        for (const customerId of customersResult.customers) {
          // ✅ Récupérer TOUTES les campagnes (pas seulement 'ENABLED')
          const campaigns = await getCampaignsForCustomerWithPeriod(tokens.access_token, customerId, 'all');
          campaigns.forEach(c => {
            allCampaigns.push(c);
            campaignNames[c.id] = c.name;
          });
        }
      }
    }
  } catch (error) {
    console.error('Erreur récupération noms:', error);
  }
  
  let options = '<option value="all">📊 Toutes les campagnes</option>';
  
  let firstActivePeriod = null; // Pour sélectionner automatiquement la première période active
  
  // ✅ Afficher TOUTES les campagnes SAUF les REMOVED
  allCampaigns.forEach(campaign => {
    // SKIP les campagnes REMOVED
    if (campaign.status === 'REMOVED') return;
    
    const campaignId = campaign.id;
    const campaignName = campaignNames[campaignId] || `Campagne ${campaignId}`;
    const periods = DataManager.getCampaignPeriods(campaignId);
    
    if (periods.length === 0) {
      options += `<option value="${campaignId}:all">📊 ${campaignName} (toutes périodes)</option>`;
    } else {
      periods.forEach(period => {
        const startDate = new Date(period.startDate).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
        const endDate = period.endDate ? 
          new Date(period.endDate).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : 
          "Aujourd'hui";
        const icon = period.endDate ? '🔒' : '✅';
        
        const isSelected = !period.endDate && !firstActivePeriod;
        if (isSelected) {
          firstActivePeriod = `${campaignId}:${period.id}`;
        }
        
        options += `<option value="${campaignId}:${period.id}" ${isSelected ? 'selected' : ''}>${icon} ${campaignName} • ${startDate} - ${endDate}</option>`;
      });
    }
  });
  
  return `
    <select id="analytics-campaign-period-selector" onchange="updateAnalyticsBySelection()" style="padding: 0.4rem 0.8rem; border: 1px solid #e8e3d8; border-radius: 4px; background: white; font-size: 0.8rem; min-width: 300px;">
      ${options}
    </select>
  `;
}

// ✅ FIX BUG 1: Afficher toutes les campagnes avec coûts figés + API
function showAllCampaignsMetrics() {
  const appData = DataManager.getAppData();
  const parametres = appData.parametres || {};
  
  const allPrestationsGoogleAds = appData.prestations.filter(p => {
    const client = appData.clients.find(c => c.id === p.clientId);
    return client && client.canalAcquisition === 'google-ads';
  });
  // v1.0.12.0 : ne compter que les clients ayant AU MOINS une prestation.
  // Avant, un client tague "google-ads" mais jamais venu gonflait le compteur
  // "Clients Acquis" sans rien apporter au chiffre d'affaires affiche a cote.
  const idsAvecPrestation = new Set(allPrestationsGoogleAds.map(p => p.clientId));
  const allClientsGoogleAds = appData.clients.filter(
    c => c.canalAcquisition === 'google-ads' && idsAvecPrestation.has(c.id)
  );
  
  const totalRevenue = allPrestationsGoogleAds.reduce((sum, p) => sum + (p.prix || 0) + (p.tips || 0), 0);
  
  // ✅ Coût = TOUTES les campagnes (même non sélectionnées) : périodes figées + API actif
  let totalCost = 0;
  let hasActiveCampaign = false;
  
  // Récupérer TOUTES les campagnes qui ont des périodes configurées
  const allCampaignIds = Object.keys(parametres.googleAdsCampaignPeriods || {});
  
  allCampaignIds.forEach(campaignId => {
    const periods = DataManager.getCampaignPeriods(campaignId);
    const activePeriod = periods.find(p => !p.endDate);
    const frozenPeriods = periods.filter(p => p.endDate);
    
    // Ajouter les coûts figés
    frozenPeriods.forEach(p => totalCost += p.frozenCost || 0);
    
    // Si il y a une période active, on ajoute l'API
    if (activePeriod) {
      hasActiveCampaign = true;
    }
  });
  
  // Ajouter le coût API UNE SEULE FOIS pour toutes les campagnes actives
  if (hasActiveCampaign) {
    const cachedCosts = parametres.googleAdsCachedCosts || {};
    const apiCost = cachedCosts.total || 0;
    console.log('📊 Coût API cached:', apiCost);
    totalCost += apiCost;
  }
  
  // ✅ clientsData
  const clientsData = allClientsGoogleAds.map(client => {
    const clientPrestations = allPrestationsGoogleAds.filter(p => p.clientId === client.id);
    const clientRevenue = clientPrestations.reduce((sum, p) => sum + (p.prix || 0) + (p.tips || 0), 0);
    return {
      client,
      prestationsCount: clientPrestations.length,
      revenue: clientRevenue,
      avgSession: clientPrestations.length > 0 ? clientRevenue / clientPrestations.length : 0,
      lastSession: clientPrestations.length > 0 ? Math.max(...clientPrestations.map(p => new Date(p.date).getTime())) : null
    };
  }).sort((a, b) => b.revenue - a.revenue);
  
  updateGoogleAdsKPIsDisplay({
    clientsCount: allClientsGoogleAds.length,
    prestationsCount: allPrestationsGoogleAds.length,
    totalRevenue: totalRevenue,
    totalCost: totalCost,
    roi: totalCost > 0 ? ((totalRevenue - totalCost) / totalCost) * 100 : 0,
    roiMoney: totalRevenue - totalCost,
    clientsData: clientsData
  });
}

function updateAnalyticsBySelection() {
  // v1.0.13.3 : ce selecteur ne pilote PLUS les cartes KPI ni la liste clients.
  // Ces zones suivent desormais uniquement le selecteur de periode de
  // "Performance par Campagne", conformement a la demande de Jordan.
  // Faire cohabiter deux pilotes garantissait une course : celui qui repondait
  // en dernier imposait SA periode, sans que rien ne l'indique a l'ecran.
  if (typeof rafraichirEcranGoogleAds === 'function') {
    rafraichirEcranGoogleAds();
    return;
  }

  const selector = document.getElementById('analytics-campaign-period-selector');
  if (!selector) return;
  
  const value = selector.value;
  
  if (value === 'all') {
    showAllCampaignsMetrics();
    return;
  }
  
  const [campaignId, periodId] = value.split(':');
  
  if (periodId === 'all') {
    filterAnalyticsByCampaign(campaignId);
  } else {
    filterAnalyticsByPeriod(campaignId, periodId);
  }
}

function filterAnalyticsByCampaign(campaignId) {
  
  const appData = DataManager.getAppData();
  const parametres = appData.parametres || {};
  
  const allPrestationsGoogleAds = appData.prestations.filter(p => {
    const client = appData.clients.find(c => c.id === p.clientId);
    return client && client.canalAcquisition === 'google-ads';
  });
  // v1.0.12.0 : ne compter que les clients ayant AU MOINS une prestation.
  // Avant, un client tague "google-ads" mais jamais venu gonflait le compteur
  // "Clients Acquis" sans rien apporter au chiffre d'affaires affiche a cote.
  const idsAvecPrestation = new Set(allPrestationsGoogleAds.map(p => p.clientId));
  const allClientsGoogleAds = appData.clients.filter(
    c => c.canalAcquisition === 'google-ads' && idsAvecPrestation.has(c.id)
  );
  
  const totalRevenue = allPrestationsGoogleAds.reduce((sum, p) => sum + (p.prix || 0) + (p.tips || 0), 0);
  
  // ✅ BUG 3 FIX: Coût = périodes figées (frozenCost) + API UNIQUEMENT pour période active
  const periods = DataManager.getCampaignPeriods(campaignId);
  const activePeriod = periods.find(p => !p.endDate);
  const frozenPeriods = periods.filter(p => p.endDate);
  
  let totalCost = 0;
  
  // Ajouter les coûts figés des périodes terminées
  frozenPeriods.forEach(p => totalCost += p.frozenCost || 0);
  
  // Ajouter le coût API UNIQUEMENT si c'est la période active
  if (activePeriod) {
    const cachedCosts = parametres.googleAdsCachedCosts || {};
    totalCost += cachedCosts.total || 0;
  }
  
  // ✅ clientsData
  const clientsData = allClientsGoogleAds.map(client => {
    const clientPrestations = allPrestationsGoogleAds.filter(p => p.clientId === client.id);
    const clientRevenue = clientPrestations.reduce((sum, p) => sum + (p.prix || 0) + (p.tips || 0), 0);
    return {
      client,
      prestationsCount: clientPrestations.length,
      revenue: clientRevenue,
      avgSession: clientPrestations.length > 0 ? clientRevenue / clientPrestations.length : 0,
      lastSession: clientPrestations.length > 0 ? Math.max(...clientPrestations.map(p => new Date(p.date).getTime())) : null
    };
  }).sort((a, b) => b.revenue - a.revenue);
  
  updateGoogleAdsKPIsDisplay({
    clientsCount: allClientsGoogleAds.length,
    prestationsCount: allPrestationsGoogleAds.length,
    totalRevenue: totalRevenue,
    totalCost: totalCost,
    roi: totalCost > 0 ? ((totalRevenue - totalCost) / totalCost) * 100 : 0,
    roiMoney: totalRevenue - totalCost,
    clientsData: clientsData
  });
}

function filterAnalyticsByPeriod(campaignId, periodId) {
  
  const periods = DataManager.getCampaignPeriods(campaignId);
  const period = periods.find(p => p.id === periodId);
  
  if (!period) return;
  
  const roiData = calculatePeriodROI(campaignId, period);
  
  // ✅ FIX: Si c'est la période active, utiliser l'API au lieu de frozenCost
  let totalCost = roiData.cost;
  if (!period.endDate) {
    const parametres = DataManager.getParametres();
    const cachedCosts = parametres.googleAdsCachedCosts || {};
    totalCost = cachedCosts.total || 0;
  }
  
  // v1.0.12.0 - CORRECTIF : le nombre de prestations etait faux.
  // Avant : prestationsCount valait 1 par client (code en dur), et le total
  // affiche etait roiData.clients.length, c'est-a-dire le nombre de CLIENTS.
  // Les cartes "Clients" et "Prestations" ne pouvaient donc jamais differer,
  // alors que 27 clients Google Ads sont revenus au moins deux fois.
  const toutesPrestations = DataManager.getAllPrestations();
  const clientsData = roiData.clients.map(c => {
    const ps = toutesPrestations.filter(p => p.clientId === c.id);
    return {
      client: { id: c.id, prenom: c.prenom, nom: c.nom },
      prestationsCount: ps.length,
      revenue: c.revenue,
      avgSession: ps.length > 0 ? c.revenue / ps.length : 0,
      lastSession: ps.length > 0
        ? Math.max(...ps.map(p => new Date(p.date).getTime()))
        : new Date(c.acquisitionDate).getTime()
    };
  }).sort((a, b) => b.revenue - a.revenue);

  const prestationsReelles = clientsData.reduce((t, c) => t + c.prestationsCount, 0);

  // Recalculer ROI avec le bon coût
  const roi = totalCost > 0 ? ((roiData.revenue - totalCost) / totalCost) * 100 : 0;
  const profit = roiData.revenue - totalCost;
  
  updateGoogleAdsKPIsDisplay({
    clientsCount: roiData.clientsCount,
    prestationsCount: prestationsReelles,
    totalRevenue: roiData.revenue,
    totalCost: totalCost,
    roi: roi,
    roiMoney: profit,
    clientsData: clientsData
  });
}

function updateGoogleAdsKPIsDisplay(metrics) {
  // v1.0.12.0 : ciblage par IDENTIFIANT.
  // Avant, les cartes etaient retrouvees en cherchant une chaine de style CSS
  // puis une position d'enfant (div:nth-child(2)). Si le DOM n'etait pas encore
  // rendu, la fonction sortait EN SILENCE : certaines cartes gardaient les
  // valeurs d'un calcul precedent, d'ou des affichages incoherents
  // (ex : un ROI de 10280 EUR affiche a cote de revenus de 6300 EUR).
  const ecrire = (id, texte, couleur) => {
    const el = document.getElementById(id);
    if (!el) return false;
    el.textContent = texte;
    if (couleur) el.style.color = couleur;
    return true;
  };

  const signe = (v) => (v >= 0 ? '+' : '');
  // v1.0.18.1 : meme format que le tableau des campagnes juste en dessous -
  // separateur de milliers francais, espace insecable, pas de centimes.
  const euro = (v) => Math.round(v).toLocaleString('fr-FR') + '\u00a0\u20ac';
  const ok = [
    ecrire('ga-kpi-roi-money', `${signe(metrics.roiMoney)}${euro(metrics.roiMoney)}`,
           metrics.roiMoney >= 0 ? '#28a745' : '#e74c3c'),
    ecrire('ga-kpi-roi-percent', `(${signe(metrics.roi)}${metrics.roi.toFixed(1)}%)`),
    ecrire('ga-kpi-cost', euro(metrics.totalCost)),
    ecrire('ga-kpi-revenue', euro(metrics.totalRevenue)),
    ecrire('ga-kpi-prestations',
           (typeof metrics.totalTips === 'number' && metrics.totalTips > 0)
             ? `${metrics.prestationsCount} prestation(s) · dont ${euro(metrics.totalTips)} de pourboires`
             : `${metrics.prestationsCount} prestation(s)`),
    ecrire('ga-kpi-clients', `${metrics.clientsCount}`)
  ];

  // Si le DOM n'est pas pret, on le DIT au lieu d'echouer silencieusement.
  if (ok.some(v => !v)) {
    console.warn('\u26a0\ufe0f Cartes KPI Google Ads : DOM incomplet, affichage partiel',
                 { ecrites: ok.filter(Boolean).length, attendues: ok.length });
  }

  // ✅ Mettre à jour la liste des clients
  if (metrics.clientsData) {
    // v1.0.12.0 - CORRECTIF : la recherche portait sur un <h3>, alors que le
    // gabarit utilise un <h5 id="google-ads-clients-title">. Le titre n'etait
    // donc JAMAIS mis a jour, et le libelle "de cette periode" restait affiche
    // meme quand la liste montrait tous les clients, toutes periodes confondues.
    const titre = document.getElementById('google-ads-clients-title');
    if (titre) {
      titre.textContent = `👥 Clients Google Ads (${metrics.clientsData.length})`;
    }
    
    const clientsContentDiv = document.getElementById('google-ads-clients-content');
    if (clientsContentDiv) {
      const clientsCardsHTML = metrics.clientsData.map(clientData => {
        const { client, prestationsCount, revenue, avgSession, lastSession } = clientData;
        const lastSessionText = lastSession ? new Date(lastSession).toLocaleDateString('fr-FR') : 'Jamais';
        
        return `
          <div style="background: white; border: 1px solid #e8e3d8; border-radius: 4px; padding: 0.875rem;">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.5rem;">
              <div>
                <div style="font-weight: 600; color: #333; font-size: 0.9rem;">${client.prenom} ${client.nom}</div>
              </div>
              <div style="text-align: right;">
                <div style="font-weight: 700; color: #28a745; font-size: 0.9rem;">${revenue.toFixed(0)}€</div>
                <div style="font-size: 0.75rem; color: #666;">${prestationsCount} séance(s)</div>
              </div>
            </div>
            <div style="display: flex; justify-content: space-between; font-size: 0.75rem; color: #888; padding-top: 0.5rem; border-top: 1px solid #e8e3d8;">
              <span>Moy: ${avgSession.toFixed(0)}€</span>
              <span>Dernier: ${lastSessionText}</span>
            </div>
          </div>
        `;
      }).join('');
      
      clientsContentDiv.innerHTML = `
        <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 1rem;">
          ${clientsCardsHTML}
        </div>
      `;
    }
  }
}

// Exports globaux
window.GoogleAdsROI = {
  calculateAllCampaignsROI,
  calculatePeriodROI,
  getClientsAcquiredDuringPeriod,
  calculateClientsLifetimeRevenue,
  calculateClientRevenue,
  generateROIReport,
  showROIReportModal,
  generateCampaignPeriodSelector,
  updateAnalyticsBySelection,
  initializeDefaultSelection
};

window.showROIReportModal = showROIReportModal;
window.generateCampaignPeriodSelector = generateCampaignPeriodSelector;
window.updateAnalyticsBySelection = updateAnalyticsBySelection;

// ✅ Fonction d'initialisation : sélectionner automatiquement la première période active
function initializeDefaultSelection() {
  // v1.0.12.0 - CORRECTIF : la condition "!== 'all'" empechait tout recalcul
  // quand le selecteur valait 'all' (le cas par defaut). Les cartes restaient
  // alors figees sur le rendu initial, et il fallait changer de campagne puis
  // revenir pour obtenir les bons chiffres.
  setTimeout(() => {
    if (typeof rafraichirEcranGoogleAds === 'function') {
      rafraichirEcranGoogleAds();
    } else {
      console.warn('⚠️ Point d entree Google Ads absent : KPIs non recalcules');
    }
  }, 100);
}

window.initializeDefaultSelection = initializeDefaultSelection;

console.log('✅ Google Ads ROI chargé');

// ❌ NE PAS auto-initialiser au chargement
// waitForSelectorAndInitialize(); sera appelé manuellement depuis la page Analytics