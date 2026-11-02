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
  
  // v1.1.0.0 : regle Encaissements (prix + tips ; tips seuls si carte cadeau)
  clientPrestations.forEach(prestation => {
    totalRevenue += Encaissements.encaissePrestation(prestation);
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

// v1.2.0.0 : le menu campagne + periode de l'en-tete d'Analytics est retire, avec la
// lecture de l'API qu'il faisait a chaque ouverture et ses trois calculs des cartes
// (showAllCampaignsMetrics, filterAnalyticsByCampaign, filterAnalyticsByPeriod). Il ne
// pilotait plus rien depuis la v1.0.13.3 : l'ecran suit la Periode du haut d'Analytics
// et le menu « Performance par Campagne » (utils-services.js, rafraichirEcranGoogleAds).

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
  showROIReportModal
};

window.showROIReportModal = showROIReportModal;

console.log('✅ Google Ads ROI chargé');

// ❌ NE PAS auto-initialiser au chargement
// waitForSelectorAndInitialize(); sera appelé manuellement depuis la page Analytics