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
  
  const allClientsGoogleAds = appData.clients.filter(c => c.canalAcquisition === 'google-ads');
  const allPrestationsGoogleAds = appData.prestations.filter(p => {
    const client = appData.clients.find(c => c.id === p.clientId);
    return client && client.canalAcquisition === 'google-ads';
  });
  
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
  
  const allClientsGoogleAds = appData.clients.filter(c => c.canalAcquisition === 'google-ads');
  const allPrestationsGoogleAds = appData.prestations.filter(p => {
    const client = appData.clients.find(c => c.id === p.clientId);
    return client && client.canalAcquisition === 'google-ads';
  });
  
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
  
  // ✅ clientsData depuis roiData
  const clientsData = roiData.clients.map(c => ({
    client: { id: c.id, prenom: c.prenom, nom: c.nom },
    prestationsCount: 1,
    revenue: c.revenue,
    avgSession: c.revenue,
    lastSession: new Date(c.acquisitionDate).getTime()
  })).sort((a, b) => b.revenue - a.revenue);
  
  // Recalculer ROI avec le bon coût
  const roi = totalCost > 0 ? ((roiData.revenue - totalCost) / totalCost) * 100 : 0;
  const profit = roiData.revenue - totalCost;
  
  updateGoogleAdsKPIsDisplay({
    clientsCount: roiData.clientsCount,
    prestationsCount: roiData.clients.length,
    totalRevenue: roiData.revenue,
    totalCost: totalCost,
    roi: roi,
    roiMoney: profit,
    clientsData: clientsData
  });
}

function updateGoogleAdsKPIsDisplay(metrics) {
  const googleAdsSection = document.getElementById('google-ads-analytics');
  if (!googleAdsSection) return;
  
  const gridContainers = googleAdsSection.querySelectorAll('[style*="grid-template-columns"]');
  if (gridContainers.length === 0) return;
  
  const kpisGrid = gridContainers[0];
  const allKpiBoxes = kpisGrid.querySelectorAll('div[style*="background: var(--beige-clair"]');
  
  if (allKpiBoxes.length >= 4) {
    const roiBox = allKpiBoxes[0];
    const roiValueDiv = roiBox.querySelector('div:nth-child(2)');
    const roiPercentDiv = roiBox.querySelector('div:nth-child(3)');
    
    if (roiValueDiv) {
      roiValueDiv.textContent = `${metrics.roiMoney >= 0 ? '+' : ''}${metrics.roiMoney.toFixed(0)}€`;
      roiValueDiv.style.color = metrics.roiMoney >= 0 ? '#28a745' : '#e74c3c';
    }
    if (roiPercentDiv) {
      roiPercentDiv.textContent = `(${metrics.roi >= 0 ? '+' : ''}${metrics.roi.toFixed(1)}%)`;
    }
    
    const costBox = allKpiBoxes[1];
    const costValueDiv = costBox.querySelector('div:nth-child(2)');
    if (costValueDiv) {
      costValueDiv.textContent = `${metrics.totalCost.toFixed(0)}€`;
    }
    
    const revenueBox = allKpiBoxes[2];
    const revenueValueDiv = revenueBox.querySelector('div:nth-child(2)');
    const revenueSubDiv = revenueBox.querySelector('div:nth-child(3)');
    if (revenueValueDiv) {
      revenueValueDiv.textContent = `${metrics.totalRevenue.toFixed(0)}€`;
    }
    if (revenueSubDiv) {
      revenueSubDiv.textContent = `${metrics.prestationsCount} prestation(s)`;
    }
    
    const clientsBox = allKpiBoxes[3];
    const clientsValueDiv = clientsBox.querySelector('div:nth-child(2)');
    if (clientsValueDiv) {
      clientsValueDiv.textContent = `${metrics.clientsCount}`;
    }
  }
  
  // ✅ Mettre à jour la liste des clients
  if (metrics.clientsData) {
    // ✅ FORCE: Mettre à jour le titre IMMÉDIATEMENT
    const allH3 = document.querySelectorAll('#google-ads-analytics h3');
    allH3.forEach(h3 => {
      if (h3.textContent.includes('Clients Google Ads')) {
        h3.textContent = `👥 Clients Google Ads (${metrics.clientsCount})`;
      }
    });
    
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
  setTimeout(() => {
    const selector = document.getElementById('analytics-campaign-period-selector');
    if (selector && selector.value !== 'all') {
      console.log('🎯 Initialisation: Sélection automatique de la période active');
      updateAnalyticsBySelection();
    }
  }, 100);
}

window.initializeDefaultSelection = initializeDefaultSelection;

console.log('✅ Google Ads ROI chargé');

// ❌ NE PAS auto-initialiser au chargement
// waitForSelectorAndInitialize(); sera appelé manuellement depuis la page Analytics