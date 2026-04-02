// ===== js/ui/view-manager.js =====
// Gestion de l'affichage des vues : Dashboard, Calendar, Tables

// ===== HELPER : Nom à afficher selon le type de RDV/Prestation =====
// Pour les soins partenariat, affiche le nom du soin au lieu du nom du client
function getDisplayNameForRdvOrPrestation(item, client) {
  if (DataManager.isPartnershipSoin(item.soinId || item.type)) {
    return DataManager.getDisplayNameForType(item.soinId || item.type);
  }
  if (client) {
    return `${client.prenom} ${client.nom}`;
  }
  return 'Client inconnu';
}

// Version courte pour le calendrier (sans "inconnu")
function getDisplayNameForCalendar(item, client) {
  if (DataManager.isPartnershipSoin(item.soinId || item.type)) {
    return DataManager.getDisplayNameForType(item.soinId || item.type);
  }
  if (client) {
    return `${client.prenom} ${client.nom}`;
  }
  return 'Client';
}

// ===== VARIABLES GLOBALES UI =====
let currentDate = new Date();
let dashboardCustomMode = false;
let draggedElement = null;
let dragOverElement = null;

// ===== PRÉFÉRENCES DE VUE ANNUAIRE =====
let annuaireViewPrefs = {
  viewMode: 'grid',        // 'grid' ou 'list'
  showFideles: true,
  showNouveaux: true,
  showProspects: true,
  showCollaborateurs: true,
  sortMode: 'massages-desc' // massages-desc, massages-asc, ca-desc, ca-asc, nom-asc, nom-desc, dernier-desc, dernier-asc
};

// Configuration par défaut du dashboard avec Paiements à venir
const DEFAULT_DASHBOARD_CONFIG = [
  // --- Revenus du mois ---
  { id: 'kpi-revenus', label: 'CA total du mois', type: 'currency', visible: true, position: 0 },
  { id: 'kpi-revenus-massage-mois', label: 'CA Massages du mois', type: 'currency', visible: true, position: 1 },
  { id: 'kpi-revenus-headspa-mois', label: 'CA HeadSpa du mois', type: 'currency', visible: true, position: 2 },
  { id: 'kpi-tips', label: 'Tips du mois', type: 'currency', visible: true, position: 3 },
  { id: 'kpi-couts', label: 'Coûts du mois', type: 'currency', visible: true, position: 4 },
  { id: 'kpi-marge', label: 'Marge du mois', type: 'currency', visible: true, position: 5 },
  { id: 'kpi-taux', label: 'Taux de marge', type: 'percentage', visible: true, position: 6 },
  { id: 'kpi-paiements-avenir', label: 'Paiements à venir', type: 'currency', visible: true, position: 7 },
  { id: 'kpi-bons-non-utilises', label: 'Bons non utilisés', type: 'currency', visible: true, position: 8 },
  // --- Compteurs du mois ---
  { id: 'kpi-massages-avenir', label: 'RDV à venir', type: 'number', visible: true, position: 9 },
  { id: 'kpi-massages-realises-mois', label: 'Massages du mois', type: 'number', visible: true, position: 10 },
  { id: 'kpi-nb-headspa-mois', label: 'HeadSpa du mois', type: 'number', visible: true, position: 11 },
  { id: 'kpi-massages-annules', label: 'RDV annulés (année)', type: 'number', visible: true, position: 12 },
  { id: 'kpi-client-mois', label: 'Client du mois', type: 'text', visible: true, position: 13 },
  // --- Compteurs année ---
  { id: 'kpi-massages-realises', label: 'Massages réalisés (année)', type: 'number', visible: true, position: 14 },
  { id: 'kpi-nb-headspa-annee', label: 'HeadSpa réalisés (année)', type: 'number', visible: true, position: 15 },
  // --- Totaux année ---
  { id: 'kpi-revenus-annee', label: 'CA Total Année', type: 'currency', visible: true, position: 16 },
  // --- Totaux (all time) ---
  { id: 'kpi-revenus-total', label: 'CA total (global)', type: 'currency', visible: true, position: 17 },
  { id: 'kpi-revenus-massage-total', label: 'CA Massages (global)', type: 'currency', visible: true, position: 17 },
  { id: 'kpi-revenus-headspa-total', label: 'CA HeadSpa (global)', type: 'currency', visible: true, position: 18 },
  { id: 'kpi-nb-massages-total', label: 'Massages réalisés (global)', type: 'number', visible: true, position: 19 },
  { id: 'kpi-nb-headspa-total', label: 'HeadSpa réalisés (global)', type: 'number', visible: true, position: 20 },
  { id: 'kpi-tips-total', label: 'Tips (global)', type: 'currency', visible: true, position: 21 },
  { id: 'kpi-couts-total', label: 'Coûts (global)', type: 'currency', visible: true, position: 22 },
  // --- Google Ads ---
  { id: 'kpi-google-ads-roi', label: 'ROI Google Ads', type: 'percentage', visible: true, position: 23 },
  { id: 'kpi-google-ads-cost', label: 'Coût Google Ads', type: 'currency', visible: true, position: 24 },
  { id: 'kpi-google-ads-revenue', label: 'Revenus Google Ads', type: 'currency', visible: true, position: 25 },
  { id: 'kpi-google-ads-clients', label: 'Clients Google Ads', type: 'number', visible: true, position: 26 }
];

let currentDashboardConfig = [...DEFAULT_DASHBOARD_CONFIG];

// ===== NAVIGATION ENTRE ONGLETS =====
function showTab(tabName) {
  // Masquer tous les onglets
  document.querySelectorAll('.tab-content').forEach(tab => {
    tab.classList.remove('active');
  });
  
  // Désactiver tous les boutons de navigation
  document.querySelectorAll('.nav-tab').forEach(btn => {
    btn.classList.remove('active');
  });
  
  // Afficher l'onglet sélectionné
  document.getElementById(tabName).classList.add('active');
  event.target.classList.add('active');
  
  // Mettre à jour le contenu selon l'onglet
  switch(tabName) {
    case 'dashboard':
      updateDashboard();
      break;
    case 'calendrier':
      updateCalendar();
      break;
    case 'prestations':
      updatePrestationsTable();
      break;
    case 'bons-cadeaux':
      updateBonsCadeauxDisplay();
      break;
    case 'clients':
      updateClientsDisplay();
      break;
    case 'analytics':
      UtilsServices.updateAnalytics();
      break;
    case 'depenses':
      updateDepensesDisplay();
      break;
  }
}

// ===== DASHBOARD - AFFICHAGE =====
let dashboardConfigLoaded = false;

function updateDashboard() {
  const kpis = Calculations.calculateDashboardKPIs();

  // Charger la configuration sauvegardée UNE SEULE FOIS (sinon ça écrase les modifs en cours)
  if (!dashboardConfigLoaded) {
    loadDashboardConfig();
    dashboardConfigLoaded = true;
  }

  // Générer le dashboard personnalisable
  generateCustomizableDashboard(kpis);
  
  // Ajouter l'interaction Paiements à venir
  addPaiementsAVenirInteraction();
  
  // Affichage des prochains RDV
  updateProchainsRdvDisplay();
}

function generateCustomizableDashboard(kpis) {
  const container = document.querySelector('.dashboard-kpis');
  if (!container) return;
  
  // Construire le HTML avec header de contrôle
  let dashboardHTML = `
    <div class="dashboard-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
      <h2 style="margin: 0;">Tableau de bord</h2>
      <div class="dashboard-controls">
        <button id="customize-btn" class="btn-secondary" onclick="toggleCustomizeMode()" style="margin-right: 0.5rem;">
          ${dashboardCustomMode ? '❌ Annuler' : '✏️ Personnaliser'}
        </button>
        <button id="save-dashboard-btn" class="btn-primary" onclick="saveDashboardConfig()" style="display: ${dashboardCustomMode ? 'inline-block' : 'none'};">
          💾 Enregistrer
        </button>
      </div>
    </div>
    ${dashboardCustomMode ? `
      <div class="dashboard-help" style="background: #e3f2fd; padding: 1rem; border-radius: 8px; margin-bottom: 1rem; border-left: 4px solid #2196f3;">
        <strong>💡 Mode personnalisation activé :</strong><br>
        • Glissez-déposez les cartes pour les réorganiser<br>
        • Cliquez sur l'œil pour masquer/afficher une carte<br>
        • Cliquez "Enregistrer" pour sauvegarder vos modifications
      </div>
    ` : ''}
    <div id="dashboard-grid" class="kpis-grid ${dashboardCustomMode ? 'customize-mode' : ''}">
  `;
  
  // Trier les KPIs selon leur position
  const sortedKpis = [...currentDashboardConfig].sort((a, b) => a.position - b.position);
  
  // Générer les cartes KPI (seulement les visibles)
  sortedKpis.forEach(kpiConfig => {
  // En mode normal : afficher seulement les KPIs visibles
  // En mode personnalisation : afficher tous les KPIs
  if (!dashboardCustomMode && !kpiConfig.visible) {
    return; // Ne pas afficher les KPIs masqués en mode normal
  }
  
  const value = getKpiValue(kpis, kpiConfig.id, kpiConfig.type);
  const isVisible = kpiConfig.visible;
  
  dashboardHTML += `
    <div class="kpi-card ${dashboardCustomMode ? 'draggable' : ''} ${!isVisible ? 'hidden-kpi' : ''}" 
         data-kpi-id="${kpiConfig.id}"
         draggable="${dashboardCustomMode ? 'true' : 'false'}"
         ${dashboardCustomMode ? `
           ondragstart="handleDragStart(event)" 
           ondragover="handleDragOver(event)" 
           ondrop="handleDrop(event)"
           ondragend="handleDragEnd(event)"
         ` : ''}>
      ${dashboardCustomMode ? `
        <div class="kpi-controls">
          <button class="visibility-toggle" onclick="toggleKpiVisibility('${kpiConfig.id}')" title="${isVisible ? 'Masquer' : 'Afficher'}">
            ${isVisible ? '👁️' : '👁️‍🗨️'}
          </button>
          <div class="drag-handle" title="Glisser pour déplacer">⋮⋮</div>
        </div>
      ` : ''}
      <div class="kpi-content">
        <div class="kpi-label">${kpiConfig.label}</div>
        <div class="kpi-value" id="${kpiConfig.id}">${value}</div>
      </div>
    </div>
  `;
});
  
  dashboardHTML += '</div>';
  container.innerHTML = dashboardHTML;
}

// ===== PAIEMENTS À VENIR - INTERACTION =====
function addPaiementsAVenirInteraction() {
  // Ajouter l'interaction au clic sur le KPI Paiements à venir
  const paiementsKpi = document.querySelector('[data-kpi-id="kpi-paiements-avenir"]');
  if (paiementsKpi) {
    paiementsKpi.style.cursor = 'pointer';
    paiementsKpi.title = 'Cliquez pour voir le détail des paiements à venir';
    
    paiementsKpi.addEventListener('click', showPaiementsAVenirDetails);
  
  }
}

function showPaiementsAVenirDetails() {
  const appData = DataManager.getAppData();
  
  // Récupérer les RDV confirmés non transformés
  const rdvConfirmes = appData.rdv.filter(rdv => {
    return rdv.statut === 'confirmé' && !rdv.transformeEnPrestation;
  }).sort((a, b) => new Date(`${a.date}T${a.heure}`) - new Date(`${b.date}T${b.heure}`));
  
  if (rdvConfirmes.length === 0) {
    ModalManager.showModal('rdv-modal', `
      <h3>💰 Paiements à venir</h3>
      <div style="text-align: center; padding: 2rem; color: var(--text-light);">
        <div style="font-size: 3rem; margin-bottom: 1rem;">📋</div>
        <p>Aucun paiement en attente</p>
        <small>Tous vos RDV confirmés ont été transformés en prestations !</small>
      </div>
      <div class="modal-actions">
        <button type="button" class="btn-secondary" onclick="closeModal()">Fermer</button>
      </div>
    `);
    return;
  }
  
  let totalPaiements = 0;
  
  const rdvHtml = rdvConfirmes.map(rdv => {
    const client = appData.clients.find(c => c.id === rdv.clientId);
    // Utiliser le helper pour HeadSpa
    const clientNom = getDisplayNameForRdvOrPrestation(rdv, client);
    const prixEstime = Calculations.estimerPrixRdv(rdv);
    totalPaiements += prixEstime;
    
    const rdvDate = new Date(`${rdv.date}T${rdv.heure}`);
    const isToday = rdv.date === new Date().toISOString().split('T')[0];
    const isPast = rdvDate < new Date();
    
    const statusIcon = isPast ? '⏰' : isToday ? '🎯' : '📅';
    const statusText = isPast ? 'Massage effectué - À transformer' : '';
    
    return `
      <div style="
        padding: 1.25rem; 
        margin: 0.75rem 0; 
        border-radius: 12px; 
        cursor: pointer; 
        transition: all 0.3s ease; 
        border: 1px solid #e9ecef; 
        background: #fff;
        box-shadow: 0 2px 4px rgba(0,0,0,0.05);
      " 
      onclick="FormManager.showRdvDetails('${rdv.id}')"
      class="hover-card">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <div style="flex: 1;">
            <div style="font-weight: 600; color: var(--text-dark); font-size: 1rem; margin-bottom: 0.25rem; display: flex; align-items: center; gap: 0.5rem;">
              ${statusIcon} ${DataManager.formatDate(rdv.date)} à ${rdv.heure}
            </div>
            <div style="color: var(--text-light); font-size: 0.9rem; margin-bottom: 0.25rem;">
              ${clientNom} • ${DataManager.getDisplayNameForType(rdv.soinId || rdv.type)} (${rdv.duree || 60}min)
            </div>
            ${statusText ? `<div style="color: #856404; font-weight: 600; font-size: 0.8rem; background: #fff3cd; padding: 0.25rem 0.5rem; border-radius: 6px; display: inline-block; margin-top: 0.25rem;">⚠️ ${statusText}</div>` : ''}
          </div>
          <div style="text-align: right; min-width: 100px;">
            <div style="font-size: 1.3rem; font-weight: 700; color: #f39c12; margin-bottom: 0.25rem;">
              ${prixEstime.toFixed(2)} €
            </div>
            <div style="color: var(--text-light); font-size: 0.8rem; font-style: italic;">estimé</div>
          </div>
        </div>
      </div>
    `;
  }).join('');
  
  const modalHTML = `
    <div style="background: var(--white); border-radius: 16px; box-shadow: 0 20px 60px rgba(0,0,0,0.15); max-width: 650px; width: 95%; max-height: 85vh; overflow: hidden; border: 1px solid #e9ecef;">
      
      <div style="padding: 2rem 2rem 1rem 2rem; border-bottom: 1px solid #f0f0f0;">
        <h3 style="margin: 0 0 1.5rem 0; font-size: 1.4rem; font-weight: 600; color: var(--text-dark); display: flex; align-items: center; gap: 0.5rem;">
          💰 Paiements à venir
        </h3>
        
        <div style="background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%); padding: 1.5rem; border-radius: 12px; text-align: center; border: 1px solid #dee2e6;">
          <div style="font-size: 2rem; font-weight: 700; margin-bottom: 0.5rem; color: #f39c12;">
            ${totalPaiements.toFixed(2)} €
          </div>
          <div style="color: var(--text-light); font-size: 0.95rem; font-weight: 500;">
            Total estimé • ${rdvConfirmes.length} RDV confirmé${rdvConfirmes.length > 1 ? 's' : ''} en attente
          </div>
        </div>
      </div>
      
      <div style="padding: 1.5rem 2rem; max-height: 400px; overflow-y: auto;">
        ${rdvHtml}
        
        <div style="margin-top: 1.5rem; padding: 1.25rem; background: #f8fdf8; border-radius: 12px; border-left: 4px solid #28a745; border: 1px solid #d4edda;">
          <div style="display: flex; align-items: flex-start; gap: 0.75rem;">
            <span style="font-size: 1.2rem;">💡</span>
            <div>
              <strong style="color: #155724; font-weight: 600;">Conseil :</strong>
              <span style="color: #155724; line-height: 1.5;"> Transformez vos RDV effectués en prestations pour encaisser les paiements et mettre à jour vos statistiques.</span>
            </div>
          </div>
        </div>
      </div>
      
      <div style="padding: 1.5rem 2rem; background: #f8f9fa; border-top: 1px solid #e9ecef; display: flex; justify-content: space-between; gap: 1rem;">
        <button class="btn-secondary" onclick="closeModal()" style="background: #6c757d; color: white; border: none; padding: 0.75rem 1.5rem; border-radius: 8px; transition: all 0.3s ease;">Fermer</button>
        <button class="btn-primary" onclick="closeModal(); ViewManager.showTab('calendrier')" style="background: linear-gradient(135deg, var(--beige-dore) 0%, #c2956a 100%); border: none; padding: 0.75rem 1.5rem; border-radius: 8px; font-weight: 600; color: white;">📅 Voir le calendrier</button>
      </div>
    </div>
  `;
  
  ModalManager.showModal('rdv-modal', modalHTML);
}

// ===== DRAG & DROP FONCTIONS =====
function handleDragStart(e) {
  // Toujours cibler la .kpi-card, même si le drag commence sur un enfant
  draggedElement = e.target.closest('.kpi-card') || e.target;
  draggedElement.classList.add('dragging');
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/html', draggedElement.outerHTML);
}

function handleDragOver(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  
  const target = e.target.closest('.kpi-card');
  if (target && target !== draggedElement) {
    // Retirer l'ancienne classe
    document.querySelectorAll('.kpi-card').forEach(card => {
      card.classList.remove('drag-over');
    });
    
    // Ajouter la nouvelle classe
    target.classList.add('drag-over');
    dragOverElement = target;
  }
}

function handleDrop(e) {
  e.preventDefault();
  
  const target = e.target.closest('.kpi-card');
  if (target && target !== draggedElement && draggedElement) {
    const draggedId = draggedElement.dataset.kpiId;
    const targetId = target.dataset.kpiId;
    
    // Réorganiser la configuration
    reorderKpis(draggedId, targetId);
    
    // Rafraîchir l'affichage
    updateDashboard();
    
    // Notification visuelle
    showDashboardNotification('📋 Position mise à jour !');
  }
}

function handleDragEnd(e) {
  // Nettoyer les classes visuelles
  document.querySelectorAll('.kpi-card').forEach(card => {
    card.classList.remove('dragging', 'drag-over');
  });
  
  draggedElement = null;
  dragOverElement = null;
}

function reorderKpis(draggedId, targetId) {
  const draggedIndex = currentDashboardConfig.findIndex(kpi => kpi.id === draggedId);
  const targetIndex = currentDashboardConfig.findIndex(kpi => kpi.id === targetId);
  
  if (draggedIndex === -1 || targetIndex === -1) return;
  
  // Échange de positions au lieu d'insertion
  // Sauvegarder les positions actuelles
  const draggedPosition = currentDashboardConfig[draggedIndex].position;
  const targetPosition = currentDashboardConfig[targetIndex].position;
  
  // Échanger les positions
  currentDashboardConfig[draggedIndex].position = targetPosition;
  currentDashboardConfig[targetIndex].position = draggedPosition;
  
  // Trier le tableau selon les nouvelles positions
  currentDashboardConfig.sort((a, b) => a.position - b.position);
}

function toggleKpiVisibility(kpiId) {
  const kpi = currentDashboardConfig.find(k => k.id === kpiId);
  if (kpi) {
    kpi.visible = !kpi.visible;
    updateDashboard();
    
    const status = kpi.visible ? 'affiché' : 'masqué';
    showDashboardNotification(`👁️ KPI ${status} !`);
  }
}

function resetDashboardConfig() {
  if (confirm('Êtes-vous sûr de vouloir remettre le dashboard par défaut ?')) {
    currentDashboardConfig = [...DEFAULT_DASHBOARD_CONFIG];
    updateDashboard();
    showDashboardNotification('🔄 Dashboard remis par défaut !');
  }
}

function showDashboardNotification(message) {
  // Créer la notification
  const notification = document.createElement('div');
  notification.className = 'dashboard-notification';
  notification.textContent = message;
  notification.style.cssText = `
    position: fixed;
    top: 80px;
    right: 20px;
    background: var(--beige-dore);
    color: white;
    padding: 1rem 1.5rem;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.2);
    z-index: 1000;
    font-weight: 600;
    transform: translateX(300px);
    transition: transform 0.3s ease;
  `;
  
  document.body.appendChild(notification);
  
  // Animation d'entrée
  setTimeout(() => {
    notification.style.transform = 'translateX(0)';
  }, 100);
  
  // Animation de sortie et suppression
  setTimeout(() => {
    notification.style.transform = 'translateX(300px)';
    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    }, 300);
  }, 2500);
}

// ✅ MODIFICATION getKpiValue() dans view-manager.js

// ===== 🔧 CORRECTION getKpiValue() dans view-manager.js =====

// Dans votre view-manager.js, remplacez la fonction getKpiValue() (ligne ~239) par :

function getKpiValue(kpis, kpiId, type) {
  const mapping = {
    'kpi-revenus': kpis.revenus,
    'kpi-revenus-massage-mois': kpis.revenusMassageMois || 0,
    'kpi-revenus-headspa-mois': kpis.revenusHeadSpaMois || 0,
    'kpi-tips': kpis.tips,
    'kpi-couts': kpis.couts,
    'kpi-marge': kpis.marge,
    'kpi-taux': kpis.tauxMarge,
    'kpi-paiements-avenir': kpis.paiementsAVenir,
    'kpi-bons-non-utilises': kpis.bonsNonUtilises || 0,
    'kpi-massages-avenir': kpis.massagesAVenir,
    'kpi-massages-realises': kpis.nbMassagesAnnee || 0,
    'kpi-massages-realises-mois': kpis.nbMassagesMois || 0,
    'kpi-nb-headspa-mois': kpis.nbHeadSpaMois || 0,
    'kpi-nb-headspa-annee': kpis.nbHeadSpaAnnee || 0,
    'kpi-massages-annules': kpis.massagesAnnules,
    'kpi-client-mois': kpis.clientDuMois,
    'kpi-revenus-annee': kpis.revenusAnnee || 0,
    'kpi-revenus-total': kpis.revenusTotal,
    'kpi-revenus-massage-total': kpis.revenusMassageTotal || 0,
    'kpi-revenus-headspa-total': kpis.revenusHeadSpaTotal || 0,
    'kpi-nb-massages-total': kpis.nbMassagesTotal || 0,
    'kpi-nb-headspa-total': kpis.nbHeadSpaTotal || 0,
    'kpi-tips-total': kpis.tipsTotal,
    'kpi-couts-total': kpis.coutsTotal,
    // Google Ads mappings
    'kpi-google-ads-roi': kpis.googleAdsROI || 0,
    'kpi-google-ads-cost': kpis.googleAdsCost || 0,
    'kpi-google-ads-revenue': kpis.googleAdsRevenue || 0,
    'kpi-google-ads-clients': kpis.googleAdsClientsCount || 0
  };
  
  const value = mapping[kpiId];
  
  // ✅ CORRECTION : Vérifier si la valeur existe avant de l'utiliser
  if (value === undefined || value === null) {
    console.warn(`⚠️ KPI ${kpiId} introuvable dans les données:`, kpis);
    return type === 'currency' ? '0.00 €' : 
           type === 'percentage' ? '0.0 %' : 
           type === 'text' ? 'N/A' : '0';
  }
  
  switch(type) {
    case 'currency':
      // ✅ NOUVEAU : Ajouter la date de màj pour le KPI "Coûts du mois"
      if (kpiId === 'kpi-couts' && kpis.googleAdsLastUpdate) {
        const lastUpdate = new Date(kpis.googleAdsLastUpdate);
        const now = new Date();
        const hoursSince = (now - lastUpdate) / (1000 * 60 * 60);
        
        let timeText = '';
        if (hoursSince < 1) {
          timeText = `il y a ${Math.round(hoursSince * 60)}min`;
        } else if (hoursSince < 24) {
          timeText = `il y a ${Math.round(hoursSince)}h`;
        } else {
          const daysSince = Math.floor(hoursSince / 24);
          timeText = `il y a ${daysSince}j`;
        }
        
        return `
          <div style="display: flex; flex-direction: column; align-items: center;">
            <div class="kpi-value-main" style="font-weight: 700; line-height: 1;">
              ${value.toFixed(2)} &euro;
            </div>
            <div style="font-size: 0.65rem; color: #6c757d; margin-top: 2px;">
              Maj: ${timeText}
            </div>
          </div>
        `;
      }
      return `${value.toFixed(2)} €`;
    case 'percentage':
      // ✅ TRAITEMENT SPÉCIAL POUR LE ROI GOOGLE ADS
      if (kpiId === 'kpi-google-ads-roi') {
        const cost = kpis.googleAdsCost || 0;
        const revenue = kpis.googleAdsRevenue || 0;
        const margin = revenue - cost;
        const color = value >= 0 ? '#28a745' : '#dc3545';
        
        return `
          <div style="display: flex; flex-direction: column; align-items: center;">
            <div style="font-size: 1.5rem; font-weight: 700; color: ${color}; line-height: 1;">
              ${margin >= 0 ? '+' : ''}${margin.toFixed(0)} €
            </div>
            <div style="font-size: 0.8rem; color: ${color}; font-weight: 500; margin-top: 2px;">
              (${value >= 0 ? '+' : ''}${value.toFixed(1)}%)
            </div>
          </div>
        `;
      }
      return `${value.toFixed(1)} %`;
    case 'number':
      return value.toString();
    case 'text':
      return value || 'Aucun';
    default:
      return value.toString();
  }
}

function loadDashboardConfig() {
  const savedConfig = DataManager.loadDashboardLayoutFromCore();
  if (savedConfig && savedConfig.length > 0) {
    // Mapping des KPIs par défaut par ID (source de vérité pour labels/types)
    const defaultKpisMap = {};
    DEFAULT_DASHBOARD_CONFIG.forEach(kpi => {
      defaultKpisMap[kpi.id] = kpi;
    });

    const mergedConfig = [];

    // Garder les KPIs sauvegardés qui existent encore dans DEFAULT, avec labels à jour
    savedConfig.forEach(savedKpi => {
      if (defaultKpisMap[savedKpi.id]) {
        mergedConfig.push({
          ...savedKpi,
          label: defaultKpisMap[savedKpi.id].label,  // Toujours synchroniser le label
          type: defaultKpisMap[savedKpi.id].type      // Et le type
        });
      }
      // Les KPIs supprimés de DEFAULT sont ignorés (ex: kpi-nb-massages-mois)
    });

    // Ajouter les nouveaux KPIs qui n'existaient pas dans la sauvegarde
    const savedIds = new Set(savedConfig.map(k => k.id));
    DEFAULT_DASHBOARD_CONFIG.forEach(defaultKpi => {
      if (!savedIds.has(defaultKpi.id)) {
        mergedConfig.push({ ...defaultKpi });
      }
    });

    // Renormaliser les positions (0, 1, 2, ...) pour éviter les trous et doublons
    mergedConfig.sort((a, b) => a.position - b.position);
    mergedConfig.forEach((kpi, index) => {
      kpi.position = index;
    });

    currentDashboardConfig = mergedConfig;
  } else {
    currentDashboardConfig = [...DEFAULT_DASHBOARD_CONFIG];
  }
}

function toggleCustomizeMode() {
  dashboardCustomMode = !dashboardCustomMode;
  updateDashboard();
  
  if (dashboardCustomMode) {
    showDashboardNotification('✏️ Mode personnalisation activé !');
  }
}

function saveDashboardConfig() {
  DataManager.saveDashboardLayoutToCore(currentDashboardConfig);
  DataManager.saveData();
  dashboardCustomMode = false;
  updateDashboard();
  showDashboardNotification('💾 Configuration sauvegardée !');
}

function updateProchainsRdvDisplay() {
  const rdvFuturs = DataManager.getProchainsRdv();
  const container = document.getElementById('prochains-rdv');
  
  // Filtrer les RDV annulés pour l'affichage des prochains RDV
  const rdvFutursActifs = rdvFuturs.filter(rdv => rdv.statut !== 'annulé');
  
  if (rdvFutursActifs.length === 0) {
    container.innerHTML = '<div style="padding: 2rem; text-align: center; color: var(--text-light);">Aucun rendez-vous programmé</div>';
    return;
  }
  
  container.innerHTML = rdvFutursActifs.map(rdv => {
    const appData = DataManager.getAppData();
    const client = appData.clients.find(c => c.id === rdv.clientId);
    // Utiliser le helper pour HeadSpa
    const clientNom = getDisplayNameForRdvOrPrestation(rdv, client);

    return `
      <div class="rdv-item" onclick="FormManager.showRdvDetails('${rdv.id}')">
        <div class="rdv-date">${DataManager.formatDate(rdv.date)} à ${rdv.heure}</div>
        <div class="rdv-client">${clientNom}</div>
        <div class="rdv-type">${DataManager.getDisplayNameForType(rdv.soinId || rdv.type)} ${rdv.duree ? `(${rdv.duree}min)` : ''}</div>
        <div class="rdv-statut ${rdv.statut.replace(/\s+/g, '-')}">${rdv.statut}</div>
      </div>
    `;
  }).join('');
}

// ===== CALENDRIER - AFFICHAGE AVEC PRESTATIONS UNIFORMISÉES =====
function updateCalendar() {
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  
  // Mise à jour du titre
  document.getElementById('current-month-year').textContent = 
    currentDate.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
  
  // Génération du calendrier
  const calendarData = Calculations.getCalendarData(year, month);
  
  let calendarHTML = `
    <div class="calendar-header-row">
      <div class="calendar-header-cell">Lun</div>
      <div class="calendar-header-cell">Mar</div>
      <div class="calendar-header-cell">Mer</div>
      <div class="calendar-header-cell">Jeu</div>
      <div class="calendar-header-cell">Ven</div>
      <div class="calendar-header-cell">Sam</div>
      <div class="calendar-header-cell">Dim</div>
    </div>
    <div class="calendar-body">
  `;
  
  // Jours du mois précédent
  for (let i = calendarData.firstDayWeek - 1; i > 0; i--) {
    const day = calendarData.prevMonth.getDate() - i + 1;
    calendarHTML += `<div class="calendar-day other-month">${day}</div>`;
  }
  
  // Jours du mois courant
  for (let day = 1; day <= calendarData.daysInMonth; day++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const rdvDuJour = DataManager.getRdvForDate(dateStr);
    const prestationsDuJour = DataManager.getPrestationsForDate(dateStr);
    
    // Filtrer les prestations pour éviter les doublons avec les RDV
    const prestationsDirectes = prestationsDuJour.filter(prestation => {
      // Vérifier qu'il n'y a pas de RDV sur le même créneau (date + heure + client)
      const rdvCorrespondant = rdvDuJour.find(rdv => 
        rdv.heure === prestation.heure && 
        rdv.clientId === prestation.clientId
      );
      return !rdvCorrespondant; // Garder seulement si pas de RDV correspondant
    });
    
    // ✅ NOUVEAU : Vérifier si ce jour est coché "Institut"
    const isInstitut = DataManager.isJourInstitut(dateStr);
    
    const hasEvents = rdvDuJour.length > 0 || prestationsDirectes.length > 0;
    const isToday = dateStr === new Date().toISOString().split('T')[0];
    
    // Construire le contenu du jour
    let dayContent = `<div class="calendar-day-number">${day}</div>`;
    
    // Ajouter les RDV
    dayContent += rdvDuJour.map(rdv => {
      const appData = DataManager.getAppData();
      const client = appData.clients.find(c => c.id === rdv.clientId);
      const clientNom = getDisplayNameForCalendar(rdv, client);
      const statutClass = rdv.statut.replace(/\s+/g, '-').toLowerCase();

      const cssClass = rdv.transformeEnPrestation ? 'prestation' : statutClass;
      const calendarColor = DataManager.getCalendarColorForSoin(rdv.soinId || rdv.type);
      const headspaClass = DataManager.isPartnershipSoin(rdv.soinId || rdv.type) ? 'headspa' : '';

      // Vérifier si le RDV a été transformé en prestation payée par bon cadeau
      // OU si le RDV est lié à un bon cadeau (planifié)
      let rdvIcon = '';
      if (rdv.transformeEnPrestation) {
        const prestation = appData.prestations.find(p => p.rdvId === rdv.id);
        const isBonCadeau = prestation && (prestation.moyenPaiement === 'Bon cadeau' || prestation.bonCadeauId);
        rdvIcon = isBonCadeau ? ' 🎁' : ' ✓';
      } else if (rdv.bonCadeauId) {
        // RDV planifié avec bon cadeau
        rdvIcon = ' 🎁';
      }

      const colorStyle = calendarColor ? `style="background-color: ${calendarColor}; border-left-color: ${calendarColor};"` : '';
      return `
        <div class="calendar-rdv ${cssClass} ${headspaClass}" ${colorStyle} onclick="event.stopPropagation(); FormManager.showRdvDetails('${rdv.id}')">
          ${rdv.heure} - ${clientNom}
          ${rdv.duree ? ` (${rdv.duree}min)` : ''}
          ${rdvIcon}
        </div>
      `;
    }).join('');
    
    // Prestations directes avec même style que les RDV transformés
    dayContent += prestationsDirectes.map(prestation => {
      const appData = DataManager.getAppData();
      const client = appData.clients.find(c => c.id === prestation.clientId);
      const clientNom = getDisplayNameForCalendar(prestation, client);
      const isBonCadeau = prestation.moyenPaiement === 'Bon cadeau' || prestation.bonCadeauId;
      const calendarColorPresta = DataManager.getCalendarColorForSoin(prestation.soinId || prestation.type);
      const headspaClass = DataManager.isPartnershipSoin(prestation.soinId || prestation.type) ? 'headspa' : '';

      const colorStylePresta = calendarColorPresta ? `style="background-color: ${calendarColorPresta}; border-left-color: ${calendarColorPresta};"` : '';
      return `
        <div class="calendar-rdv prestation ${headspaClass}" ${colorStylePresta} onclick="event.stopPropagation(); FormManager.showPrestationDetails('${prestation.id}')">
          ${prestation.heure} - ${clientNom}
          ${prestation.duree ? ` (${prestation.duree}min)` : ''}
          ${isBonCadeau ? '🎁' : '✓'}
        </div>
      `;
    }).join('');
    
    // ✅ NOUVEAU : Badge Institut cliquable (sans checkbox) - VERSION COMPACTE
    dayContent += `
      <div class="institut-badge ${isInstitut ? 'actif' : ''}" 
           style="
             position: absolute;
             bottom: 2px;
             right: 2px;
             background: ${isInstitut ? '#d4a574' : '#f5f5f5'};
             color: ${isInstitut ? 'white' : '#999'};
             padding: 2px 4px;
             border-radius: 4px;
             font-size: 0.65rem;
             font-weight: 600;
             display: flex;
             align-items: center;
             gap: 2px;
             cursor: pointer;
             z-index: 10;
             transition: all 0.3s ease;
             border: 1px solid ${isInstitut ? '#c99456' : '#ddd'};
           "
           onclick="event.stopPropagation(); ViewManager.toggleJourInstitut('${dateStr}')">
        🏢${isInstitut ? ' +30€' : ''}
      </div>
    `;
    
    calendarHTML += `
      <div class="calendar-day ${hasEvents ? 'has-rdv' : ''} ${isInstitut ? 'jour-institut' : ''} ${isToday ? 'today' : ''}" onclick="FormManager.selectCalendarDay('${dateStr}')">
        ${dayContent}
      </div>
    `;
  }
  
  // Jours du mois suivant
  const remainingCells = 42 - (calendarData.firstDayWeek - 1) - calendarData.daysInMonth;
  for (let day = 1; day <= remainingCells; day++) {
    calendarHTML += `<div class="calendar-day other-month">${day}</div>`;
  }
  
  calendarHTML += '</div>';
  
  document.getElementById('calendar-grid').innerHTML = calendarHTML;
}

function previousMonth() {
  currentDate.setMonth(currentDate.getMonth() - 1);
  updateCalendar();
}

function nextMonth() {
  currentDate.setMonth(currentDate.getMonth() + 1);
  updateCalendar();
}

// ===== PRESTATIONS TABLE AVEC BOUTON DUPLIQUER =====
function updatePrestationsTable() {
  const tbody = document.querySelector('#prestations-table tbody');
  const prestations = DataManager.getSortedPrestations();
  
  if (prestations.length === 0) {
    tbody.innerHTML = '<tr><td colspan="9" style="text-align: center; padding: 2rem;">Aucune prestation enregistrée</td></tr>';
    return;
  }
  
  tbody.innerHTML = prestations.map(prestation => {
    const appData = DataManager.getAppData();
    const client = appData.clients.find(c => c.id === prestation.clientId);
    // Utiliser le helper pour HeadSpa
    const clientNom = getDisplayNameForRdvOrPrestation(prestation, client);

    const prix = prestation.prix || 0;
    const tips = prestation.tips || 0;
    const fraisDeplacement = prestation.fraisDeplacement || 0;
    const isBonCadeau = prestation.moyenPaiement === 'Bon cadeau' || prestation.bonCadeauId;

    // Calcul de la marge avec tips inclus
    // Pour les bons cadeaux, on récupère le montant du bon pour calculer la vraie marge
    let margeEffective = prix + tips - fraisDeplacement;
    let montantBonCadeau = 0;

    if (isBonCadeau && prestation.bonCadeauId) {
      const bonCadeau = appData.bonsCadeaux?.find(b => b.id === prestation.bonCadeauId);
      if (bonCadeau) {
        montantBonCadeau = bonCadeau.montant || 0;
        margeEffective = montantBonCadeau + tips - fraisDeplacement;
      }
    }

    const margeStyle = margeEffective >= 0 ? 'color: var(--beige-dore); font-weight: 600;' : 'color: #d63384; font-weight: 600;';

    // Affichage du prix avec tips et indication bon cadeau
    let prixDisplay = '';
    if (isBonCadeau) {
      if (montantBonCadeau > 0) {
        prixDisplay = `<span style="color: var(--beige-dore);">🎁 ${montantBonCadeau.toFixed(2)} €</span>`;
      } else {
        prixDisplay = `<span style="color: var(--beige-dore);">🎁 Offert</span>`;
      }
    } else {
      prixDisplay = `${prix.toFixed(2)} €`;
    }
    if (tips > 0) {
      prixDisplay += `<br><small style="color: #28a745; font-weight: 600;">+ ${tips.toFixed(2)} € tips</small>`;
    }

    // Affichage de la marge
    let margeDisplay = '';
    if (isBonCadeau) {
      margeDisplay = `<span title="Marge basée sur le montant du bon cadeau">${margeEffective.toFixed(2)} € 🎁</span>`;
    } else {
      margeDisplay = `${margeEffective.toFixed(2)} €`;
    }

    return `
      <tr>
        <td data-label="Date">${DataManager.formatDate(prestation.date)} ${prestation.heure}</td>
        <td data-label="Client">${clientNom}</td>
        <td data-label="Type">${DataManager.getDisplayNameForType(prestation.soinId || prestation.type)}</td>
        <td data-label="Duree">${prestation.duree || 60} min</td>
        <td data-label="Prix">${prixDisplay}</td>
        <td data-label="Frais route">${fraisDeplacement > 0 ? `${fraisDeplacement.toFixed(2)} €` : '-'}</td>
        <td data-label="Marge" style="${margeStyle}">${margeDisplay}</td>
        <td data-label="Notes">${prestation.notes || '-'}</td>
        <td data-label="Actions" style="min-width: 100px;">
          <div style="display: flex; flex-direction: column; gap: 0.25rem;">
            <button class="btn-secondary" onclick="FormManager.editPrestation('${prestation.id}')" style="padding: 0.3rem 0.6rem; font-size: 0.8rem; border-radius: 4px;">Editer</button>
            <button class="btn-secondary" onclick="duplicatePrestation('${prestation.id}')" style="padding: 0.3rem 0.6rem; font-size: 0.8rem; border-radius: 4px; background: var(--beige-dore); color: white; border: none; cursor: pointer;">Dupliquer</button>
            <button onclick="FormManager.deletePrestation('${prestation.id}')" style="padding: 0.3rem 0.6rem; font-size: 0.8rem; border-radius: 4px; background: #f8d7da; color: #721c24; border: none; cursor: pointer;">Suppr.</button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

// ===== FONCTION DUPLIQUER PRESTATION =====
function duplicatePrestation(prestationId) {
  const appData = DataManager.getAppData();
  const prestation = appData.prestations.find(p => p.id === prestationId);
  if (!prestation) {
    alert('Prestation introuvable');
    return;
  }
  
  const client = appData.clients.find(c => c.id === prestation.clientId);
  
  // Calculer la nouvelle heure
  const [heures, minutes] = prestation.heure.split(':').map(Number);
  const totalMinutes = heures * 60 + minutes + (prestation.duree || 60);
  const newHeures = Math.floor(totalMinutes / 60);
  const newMinutes = totalMinutes % 60;
  const newHeure = newHeures < 24 ? 
    `${newHeures.toString().padStart(2, '0')}:${newMinutes.toString().padStart(2, '0')}` : 
    prestation.heure;
  
  if (newHeures >= 24) {
    alert('⏰ Attention : la prestation suivante dépasserait minuit. Ajustez l\'heure manuellement.');
  }
  
  // Ouvrir la modal avec les données dupliquées
  ModalManager.showAddPrestationModalWithData({
    ...prestation,
    clientNom: client ? `${client.prenom} ${client.nom}` : '',
    heure: newHeure,
    id: null,
    adresseMassage: '',
    distanceKm: 0,
    fraisDeplacement: 0
  });
}

// ===== ✅ NOUVEAU : CLIENTS DISPLAY AVEC COLLABORATEURS =====
function updateClientsDisplay() {
  updateClientsList();
  updateProspectsList();
  updateCollaborateursList(); // ✅ NOUVEAU
}

function updateClientsList() {
  const clientsFidelesContainer = document.getElementById('clients-fideles-list');
  const clientsContainer = document.getElementById('clients-list');
  const appData = DataManager.getAppData();

  // Charger les préférences si pas encore fait
  loadAnnuaireViewPrefs();

  // Appliquer la visibilité des sections
  const fidelesSection = clientsFidelesContainer?.closest('.clients-section');
  const nouveauxSection = clientsContainer?.closest('.clients-section');
  if (fidelesSection) fidelesSection.classList.toggle('hidden', !annuaireViewPrefs.showFideles);
  if (nouveauxSection) nouveauxSection.classList.toggle('hidden', !annuaireViewPrefs.showNouveaux);

  if (appData.clients.length === 0) {
    clientsFidelesContainer.innerHTML = '<div style="text-align: center; padding: 1rem; color: var(--text-light);">Aucun client fidèle</div>';
    clientsContainer.innerHTML = '<div style="text-align: center; padding: 1rem; color: var(--text-light);">Aucun nouveau client</div>';
    return;
  }

  // Appliquer le filtre par ville
  const clientsFiltres = applyVilleFilter(appData.clients);

  // Séparer les clients fidèles (2+ massages) des nouveaux clients (1 massage)
  const clientsFideles = [];
  const nouveauxClients = [];

  clientsFiltres.forEach(client => {
    const prestationsClient = appData.prestations.filter(p => p.clientId === client.id);
    const rdvAnnules = appData.rdv.filter(r => r.clientId === client.id && r.statut === 'annulé').length;
    const totalMassages = prestationsClient.length;
    const revenusTotal = prestationsClient.reduce((sum, p) => sum + (p.prix || 0), 0);

    // Date du dernier massage
    const dernierMassage = prestationsClient.length > 0
      ? prestationsClient.sort((a, b) => new Date(b.date) - new Date(a.date))[0].date
      : null;

    const stats = { totalMassages, revenusTotal, rdvAnnules, dernierMassage };

    if (totalMassages >= 2) {
      clientsFideles.push({ client, stats });
    } else {
      nouveauxClients.push({ client, stats });
    }
  });

  // Appliquer le tri selon les préférences
  sortClients(clientsFideles);
  sortClients(nouveauxClients);

  const isListView = annuaireViewPrefs.viewMode === 'list';

  // ===== AFFICHAGE CLIENTS FIDÈLES =====
  if (clientsFideles.length === 0) {
    clientsFidelesContainer.innerHTML = '<div style="text-align: center; padding: 1rem; color: var(--text-light);">Aucun client fidèle encore</div>';
  } else {
    if (isListView) {
      // Vue Liste / Tableau
      clientsFidelesContainer.innerHTML = `
        <table class="clients-table">
          <thead>
            <tr>${generateSortableTableHeaders()}</tr>
          </thead>
          <tbody>
            ${clientsFideles.map(({ client, stats }) => generateClientTableRow(client, stats, true)).join('')}
          </tbody>
        </table>
      `;
      clientsFidelesContainer.classList.remove('clients-grid');
    } else {
      // Vue Grille compacte
      clientsFidelesContainer.innerHTML = `
        <div class="clients-grid-view">
          ${clientsFideles.map(({ client, stats }) => generateCompactClientCard(client, stats, true)).join('')}
        </div>
      `;
      clientsFidelesContainer.classList.remove('clients-grid');
    }
  }

  // ===== AFFICHAGE NOUVEAUX CLIENTS =====
  if (nouveauxClients.length === 0) {
    clientsContainer.innerHTML = '<div style="text-align: center; padding: 1rem; color: var(--text-light);">Aucun nouveau client</div>';
  } else {
    if (isListView) {
      // Vue Liste / Tableau
      clientsContainer.innerHTML = `
        <table class="clients-table">
          <thead>
            <tr>${generateSortableTableHeaders()}</tr>
          </thead>
          <tbody>
            ${nouveauxClients.map(({ client, stats }) => generateClientTableRow(client, stats, false)).join('')}
          </tbody>
        </table>
      `;
      clientsContainer.classList.remove('clients-grid');
    } else {
      // Vue Grille compacte
      clientsContainer.innerHTML = `
        <div class="clients-grid-view">
          ${nouveauxClients.map(({ client, stats }) => generateCompactClientCard(client, stats, false)).join('')}
        </div>
      `;
      clientsContainer.classList.remove('clients-grid');
    }
  }
}

function updateProspectsList() {
  const container = document.getElementById('prospects-list');
  if (!container) return;

  const appData = DataManager.getAppData();

  // Appliquer la visibilité de la section
  const prospectsSection = container?.closest('.prospects-section');
  if (prospectsSection) {
    prospectsSection.classList.toggle('hidden', !annuaireViewPrefs.showProspects);
  }

  if (appData.prospects.length === 0) {
    container.innerHTML = '<div style="text-align: center; padding: 2rem; color: var(--text-light);">Aucun prospect enregistré</div>';
    return;
  }

  // Vue grille ou liste selon les préférences
  if (annuaireViewPrefs.viewMode === 'grid') {
    container.className = 'clients-grid-view';
    container.innerHTML = appData.prospects.map(prospect => generateCompactProspectCard(prospect)).join('');
  } else {
    // Vue liste/tableau
    container.className = 'clients-table-view';
    container.innerHTML = `
      <table class="clients-table">
        <thead>
          <tr>
            <th>Nom</th>
            <th>Statut</th>
            <th>Téléphone</th>
            <th>Email</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          ${appData.prospects.map(prospect => `
            <tr>
              <td>
                <strong>${prospect.prenom} ${prospect.nom}</strong>
                ${prospect.societe ? `<br><small>🏢 ${prospect.societe}</small>` : ''}
              </td>
              <td><span class="badge badge-prospect">${prospect.statut || 'Prospect'}</span></td>
              <td>${prospect.telephone || '-'}</td>
              <td>${prospect.email || '-'}</td>
              <td>
                <div class="table-actions">
                  <button class="btn-primary btn-sm" onclick="FormManager.convertToClient('${prospect.id}')">→ Client</button>
                  <button class="btn-secondary btn-sm" onclick="FormManager.editProspect('${prospect.id}')">Éditer</button>
                  <button class="btn-danger btn-sm" onclick="FormManager.deleteProspect('${prospect.id}')">Suppr.</button>
                </div>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  }
}

function updateCollaborateursList() {
  const container = document.getElementById('collaborateurs-list');
  if (!container) return;

  const appData = DataManager.getAppData();

  // Appliquer la visibilité de la section
  const collabSection = container?.closest('.collaborateurs-section');
  if (collabSection) {
    collabSection.classList.toggle('hidden', !annuaireViewPrefs.showCollaborateurs);
  }

  if (!appData.collaborateurs || appData.collaborateurs.length === 0) {
    container.innerHTML = '<div style="text-align: center; padding: 2rem; color: var(--text-light);">Aucun collaborateur enregistré</div>';
    return;
  }

  const collaborateurs = DataManager.getSortedCollaborateurs();

  // Vue grille ou liste selon les préférences
  if (annuaireViewPrefs.viewMode === 'grid') {
    container.className = 'clients-grid-view';
    container.innerHTML = collaborateurs.map(collaborateur => generateCompactCollaborateurCard(collaborateur)).join('');
  } else {
    // Vue liste/tableau
    container.className = 'clients-table-view';
    container.innerHTML = `
      <table class="clients-table">
        <thead>
          <tr>
            <th>Nom</th>
            <th>Spécialités</th>
            <th>Téléphone</th>
            <th>Email</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          ${collaborateurs.map(collaborateur => `
            <tr>
              <td>
                <strong>${collaborateur.prenom} ${collaborateur.nom || ''}</strong>
                ${collaborateur.entreprise ? `<br><small>🏢 ${collaborateur.entreprise}</small>` : ''}
              </td>
              <td>${collaborateur.specialites || '-'}</td>
              <td>${collaborateur.telephone || '-'}</td>
              <td>${collaborateur.email || '-'}</td>
              <td>
                <div class="table-actions">
                  <button class="btn-secondary btn-sm" onclick="FormManager.editCollaborateur('${collaborateur.id}')">Éditer</button>
                  <button class="btn-danger btn-sm" onclick="FormManager.deleteCollaborateur('${collaborateur.id}')">Suppr.</button>
                </div>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  }

  // Ajouter la classe CSS pour la grille 2x2
  const clientsSections = document.querySelector('.clients-sections');
  if (clientsSections) {
    clientsSections.classList.add('with-collaborateurs');
  }
}

function generateFallbackTagsHTML(tags = []) {
  if (!tags || tags.length === 0) {
    return '<span style="color: #999; font-style: italic; font-size: 0.9rem;">Aucun tag</span>';
  }
  
  return tags.map(tag => {
    // Couleur par défaut pour les tags collaborateurs
    const color = getTagColor(tag);
    return `
      <span class="client-tag" style="background: ${color}; color: white; padding: 0.25rem 0.6rem; border-radius: 12px; font-size: 0.8rem; margin: 0.2rem 0.3rem 0.2rem 0; display: inline-block;">
        🏷️ ${tag}
      </span>
    `;
  }).join('');
}

function getTagColor(tag) {
  const tagLower = tag.toLowerCase();
  const colors = {
    'ostéopathe': '#2196f3',
    'ostéo': '#2196f3',
    'kinésithérapeute': '#4caf50',
    'kiné': '#4caf50',
    'réflexologue': '#9c27b0',
    'aromathérapeute': '#ff9800',
    'partenaire': '#f44336',
    'formateur': '#795548',
    'collaborateur': '#607d8b'
  };
  
  return colors[tagLower] || '#6c757d';
}

// ===== RECHERCHE CLIENTS AVEC SUPPRESSION =====
function displayFilteredClients(clientsFideles, nouveauxClients, prospects, collaborateurs) {
  const clientsFidelesContainer = document.getElementById('clients-fideles-list');
  const clientsContainer = document.getElementById('clients-list');
  const prospectsContainer = document.getElementById('prospects-list');
  const collaborateursContainer = document.getElementById('collaborateurs-list'); // ✅ NOUVEAU
  
  // Fonction helper pour générer le HTML d'un client
const generateClientHTML = (client, stats, isFidele = false) => {
  const borderStyle = isFidele ? 'border-left: 4px solid #d4a574;' : '';
  const cardClass = isFidele ? 'client-card client-fidele' : 'client-card';
  const badgeIcon = isFidele ? '⭐' : '';
  
  // ✅ NOUVEAU : Affichage du parrain
  const parrainInfo = client.parrain ? getParrainInfo(client.parrain) : null;
  const parrainDisplay = parrainInfo ? 
    `<div>🤝 <span style="color: #1976d2; cursor: pointer; text-decoration: underline;" onclick="showClientDetails('${parrainInfo.id}')" title="Cliquer pour voir la fiche du parrain">${parrainInfo.nom}</span></div>` : 
    '';
  
  return `
    <div class="${cardClass}" style="position: relative; ${borderStyle}">
      <div style="position: absolute; top: 0.5rem; right: 0.5rem; display: flex; gap: 0.25rem;">
        <div style="background: ${isFidele ? '#d4a574' : 'var(--beige-dore)'}; color: white; padding: 0.25rem 0.5rem; border-radius: 12px; font-size: 0.75rem; font-weight: 600;" title="Massages effectués">${badgeIcon} ${stats.totalMassages}</div>
        ${stats.rdvAnnules > 0 ? `<div style="background: #e74c3c; color: white; padding: 0.25rem 0.5rem; border-radius: 12px; font-size: 0.75rem; font-weight: 600;" title="RDV annulés">${stats.rdvAnnules}</div>` : ''}
      </div>
      <div class="client-header">
        <div class="client-name" onclick="showClientDetails('${client.id}')" style="cursor: pointer; color: var(--beige-dore);" title="Cliquer pour voir les détails">${client.prenom} ${client.nom}</div>
      </div>
      <div class="client-info">
        ${client.societe ? `<div><strong>🏢 ${client.societe}</strong></div>` : ''}
        ${client.telephone ? `<div>📞 ${client.telephone}</div>` : ''}
        ${client.email ? `<div>✉️ ${client.email}</div>` : ''}
        ${client.adresse ? `<div>📍 ${client.adresse}</div>` : ''}
        ${parrainDisplay}
        ${client.huiles ? `<div><strong>Huiles:</strong> ${client.huiles}</div>` : ''}
        ${client.allergies ? `<div><strong>Allergies:</strong> ${client.allergies}</div>` : ''}
        ${client.pression ? `<div><strong>Pression:</strong> ${client.pression}</div>` : ''}
        ${client.notes ? `<div><strong>Notes:</strong> ${client.notes}</div>` : ''}
      </div>
      <div class="client-actions">
        <button class="btn-primary" onclick="showClientDetails('${client.id}')">👁️ Consulter</button>
        <button class="btn-secondary" onclick="editClient('${client.id}')">Éditer</button>
        <button class="btn-danger" onclick="deleteClient('${client.id}')">Supprimer</button>
        <button class="btn-secondary" onclick="convertToProspect('${client.id}')">→ Prospect</button>
      </div>
    </div>
  `;
};
  
  // Afficher les clients fidèles filtrés
  if (clientsFideles.length === 0) {
    clientsFidelesContainer.innerHTML = '<div style="text-align: center; padding: 1rem; color: var(--text-light);">Aucun client fidèle trouvé</div>';
  } else {
    clientsFidelesContainer.innerHTML = clientsFideles.map(({ client, stats }) => 
      generateClientHTML(client, stats, true)
    ).join('');
  }
  
  // Afficher les nouveaux clients filtrés
  if (nouveauxClients.length === 0) {
    clientsContainer.innerHTML = '<div style="text-align: center; padding: 1rem; color: var(--text-light);">Aucun nouveau client trouvé</div>';
  } else {
    clientsContainer.innerHTML = nouveauxClients.map(({ client, stats }) => 
      generateClientHTML(client, stats, false)
    ).join('');
  }
  
  // Afficher les prospects filtrés
  if (prospects.length === 0) {
    prospectsContainer.innerHTML = '<div style="text-align: center; padding: 1rem; color: var(--text-light);">Aucun prospect trouvé</div>';
  } else {
    prospectsContainer.innerHTML = prospects.map(prospect => `
      <div class="client-card">
        <div class="client-header">
          <div class="client-name">${prospect.prenom} ${prospect.nom}</div>
          <div class="client-actions">
            <button class="btn-secondary" onclick="FormManager.editProspect('${prospect.id}')">Éditer</button>
            <button class="btn-danger" onclick="FormManager.deleteProspect('${prospect.id}')">Supprimer</button>
            <button class="btn-primary" onclick="FormManager.convertToClient('${prospect.id}')">→ Client</button>
          </div>
        </div>
        <div class="client-info">
          ${prospect.societe ? `<div><strong>🏢 ${prospect.societe}</strong></div>` : ''}
          ${prospect.telephone ? `<div>📞 ${prospect.telephone}</div>` : ''}
          ${prospect.email ? `<div>✉️ ${prospect.email}</div>` : ''}
          ${prospect.adresse ? `<div>📍 ${prospect.adresse}</div>` : ''}
          <div class="prospect-statut ${prospect.statut ? prospect.statut.replace(/\s+/g, '-') : ''}">${prospect.statut || 'Non défini'}</div>
          ${prospect.actions ? `<div><strong>Actions:</strong><br>${DataManager.formatActions(prospect.actions)}</div>` : ''}
          ${prospect.notes ? `<div><strong>Notes:</strong> ${prospect.notes}</div>` : ''}
        </div>
      </div>
    `).join('');
  }
  
  // ✅ COLLABORATEURS FILTRÉS AVEC SYSTÈME DE TAGS UNIFIÉ
  if (collaborateurs && collaborateurs.length === 0) {
    collaborateursContainer.innerHTML = '<div style="text-align: center; padding: 1rem; color: var(--text-light);">Aucun collaborateur trouvé</div>';
  } else if (collaborateurs) {
    collaborateursContainer.innerHTML = collaborateurs.map(collaborateur => {
      // ✅ UTILISATION DU SYSTÈME DE TAGS UNIFIÉ
      const tagsHtml = ClientServices.generateTagsHTML ? 
        ClientServices.generateTagsHTML(collaborateur.tags, true, collaborateur.id, 'collaborateur') : 
        generateFallbackTagsHTML(collaborateur.tags);
      
      return `
        <div class="client-card collaborateur-card" style="position: relative; border-left: 4px solid #2196f3;">
          <div style="position: absolute; top: 0.5rem; right: 0.5rem;">
            <div style="background: #2196f3; color: white; padding: 0.25rem 0.5rem; border-radius: 12px; font-size: 0.75rem; font-weight: 600;">🤝</div>
          </div>
          
          <div class="client-header">
            <div class="client-name" style="color: #2196f3; font-weight: 600;">${collaborateur.prenom} ${collaborateur.nom}</div>
            ${collaborateur.poste ? `<div style="font-size: 0.9rem; color: var(--text-light); font-style: italic;">${collaborateur.poste}</div>` : ''}
          </div>
          
          <div class="client-info">
            ${collaborateur.entreprise ? `<div><strong>🏢 ${collaborateur.entreprise}</strong></div>` : ''}
            ${collaborateur.specialites ? `<div><strong>💆‍♀️ Spécialités:</strong> ${collaborateur.specialites}</div>` : ''}
            ${collaborateur.telephone ? `<div>📞 ${collaborateur.telephone}</div>` : ''}
            ${collaborateur.email ? `<div>✉️ ${collaborateur.email}</div>` : ''}
            ${collaborateur.adresse ? `<div>📍 ${collaborateur.adresse}</div>` : ''}
            ${collaborateur.notes ? `<div><strong>Notes:</strong> ${collaborateur.notes}</div>` : ''}
            
            <div style="margin-top: 0.5rem;">
              <strong>🏷️ Tags:</strong><br>
              ${tagsHtml}
            </div>
          </div>
          
          <div class="client-actions">
            <button class="btn-secondary" onclick="FormManager.editCollaborateur('${collaborateur.id}')">✏️ Éditer</button>
            <button class="btn-danger" onclick="FormManager.deleteCollaborateur('${collaborateur.id}')">🗑️ Supprimer</button>
            <!-- ✅ PAS DE BOUTON APPELER POUR DESKTOP -->
          </div>
        </div>
      `;
    }).join('');
  }
}

// ===== DÉPENSES =====
function updateDepensesDisplay() {
  updateDepensesResume();
  updateDepensesTable();
}

function updateDepensesResume() {
  const container = document.getElementById('depenses-resume');
  const appData = DataManager.getAppData();
  
  const totalDepenses = appData.depenses ? appData.depenses.reduce((sum, d) => sum + (d.montant || 0), 0) : 0;
  
  // Grouper par catégorie
  const parCategorie = {};
  if (appData.depenses) {
    appData.depenses.forEach(dep => {
      const cat = dep.categorie || 'Autre';
      parCategorie[cat] = (parCategorie[cat] || 0) + (dep.montant || 0);
    });
  }
  
  container.innerHTML = `
    <div class="resume-total">
      <strong>Total des dépenses: ${totalDepenses.toFixed(2)}€</strong>
    </div>
    <div class="resume-categories">
      ${Object.entries(parCategorie).map(([cat, montant]) => 
        `<div class="resume-item">${cat}: ${montant.toFixed(2)}€</div>`
      ).join('')}
    </div>
  `;
}

function updateDepensesTable() {
  const tbody = document.querySelector('#depenses-table tbody');
  const depenses = DataManager.getSortedDepenses();
  
  if (depenses.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 2rem;">Aucune dépense enregistrée</td></tr>';
    return;
  }
  
  tbody.innerHTML = depenses.map(depense => {
    // Déterminer si c'est une dépense automatique
    const isAuto = depense.prestationId && depense.categorie === 'Transport';
    const rowClass = isAuto ? 'depense-auto' : '';
    
    // Générer le contenu des notes
    let notesContent = '-';
    if (isAuto && depense.prestationId) {
      // Pour les dépenses automatiques, créer un lien vers la prestation
      notesContent = `<span class="note-with-link" onclick="UtilsServices.showPrestationFromDepense('${depense.prestationId}')" title="Cliquer pour voir la prestation">🔗 Voir la prestation liée</span>`;
    } else if (depense.notes) {
      notesContent = depense.notes;
    }
    
    return `
      <tr class="${rowClass}">
        <td data-label="Date">${DataManager.formatDate(depense.date)}</td>
        <td data-label="Categorie">${depense.categorie || 'Autre'}</td>
        <td data-label="Description">${depense.description || '-'}</td>
        <td data-label="Fournisseur">${depense.fournisseur || '-'}</td>
        <td data-label="Montant">${(depense.montant || 0).toFixed(2)} &euro;</td>
        <td data-label="Notes">${notesContent}</td>
        <td data-label="Actions" style="min-width: 80px;">
          <div class="depenses-actions">
            <button class="btn-secondary" onclick="FormManager.editDepense('${depense.id}')">Editer</button>
            <button class="btn-danger" onclick="FormManager.deleteDepense('${depense.id}')">Suppr.</button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

// ===== FILTRE PAR VILLE =====
let currentVilleFilter = 'Ajaccio'; // Par défaut Ajaccio

function filterByVille(ville) {
  currentVilleFilter = ville;
  
  // Mettre à jour les styles des boutons
  document.querySelectorAll('.ville-filter-btn').forEach(btn => {
    if (btn.dataset.ville === ville) {
      btn.classList.add('active');
      btn.style.border = '2px solid var(--beige-dore)';
      btn.style.background = 'var(--beige-dore)';
      btn.style.color = 'white';
      btn.style.fontWeight = '600';
    } else {
      btn.classList.remove('active');
      btn.style.border = '2px solid #ddd';
      btn.style.background = 'white';
      btn.style.color = 'var(--text-dark)';
      btn.style.fontWeight = '500';
    }
  });
  
  // Appliquer le filtre
  updateClientsDisplay();
}

function applyVilleFilter(clients) {
  if (currentVilleFilter === 'Tous') {
    return clients;
  }
  
  return clients.filter(client => client.ville === currentVilleFilter);
}

// ✅ NOUVEAU : GESTION DES JOURS INSTITUT
async function toggleJourInstitut(dateStr) {
  const appData = DataManager.getAppData();
  
  // Initialiser le tableau si besoin
  if (!appData.parametres.joursInstitut) {
    appData.parametres.joursInstitut = [];
  }
  
  const index = appData.parametres.joursInstitut.indexOf(dateStr);
  
  if (index === -1) {
    // Cocher : ajouter le jour et créer la dépense
    appData.parametres.joursInstitut.push(dateStr);
    
    // Créer la dépense de loyer 30€
    const depenseLoyer = {
      id: DataManager.generateId(),
      date: dateStr,
      montant: 30,
      categorie: 'Loyer',
      description: 'Journée en institut',
      fournisseur: 'Institut',
      notes: '',
      type: 'loyer-institut' // Flag pour identifier cette dépense
    };
    
    if (!appData.depenses) {
      appData.depenses = [];
    }
    appData.depenses.push(depenseLoyer);
    
  } else {
    // Décocher : retirer le jour et supprimer la dépense
    appData.parametres.joursInstitut.splice(index, 1);
    
    // Supprimer la dépense correspondante
    if (appData.depenses) {
      const depenseIndex = appData.depenses.findIndex(
        d => d.date === dateStr && d.type === 'loyer-institut'
      );
      if (depenseIndex !== -1) {
        appData.depenses.splice(depenseIndex, 1);
      }
    }
  }
  
  // Sauvegarder
  await DataManager.saveData();
  
  // Rafraîchir l'affichage
  updateCalendar();
  updateDepensesDisplay();
  updateDashboard();
}

// ===== EXPORTS GLOBAUX =====
// ===== BONS CADEAUX - AFFICHAGE =====

let currentBonsFilter = 'tous';

function updateBonsCadeauxDisplay() {
  const container = document.getElementById('bons-cadeaux-list');
  const resumeContainer = document.getElementById('bons-cadeaux-resume');
  const alertContainer = document.getElementById('bons-expiration-alert');

  if (!container) {
    return;
  }

  // Récupérer les statistiques
  const stats = DataManager.getStatistiquesBonsCadeaux();

  // Afficher le résumé
  if (resumeContainer) {
    resumeContainer.innerHTML = `
      <div class="bons-resume-item">🟢 Actifs: <span class="value">${stats.actifs}</span></div>
      <div class="bons-resume-item">✅ Utilisés: <span class="value">${stats.utilises}</span></div>
      <div class="bons-resume-item">❌ Expirés: <span class="value">${stats.expires}</span></div>
      <div class="bons-resume-item" title="Montant total des bons actifs (payés, prestation non réalisée)">💰 À honorer: <span class="value">${stats.montantActifs.toFixed(2)} €</span></div>
    `;
  }

  // Alerte pour les bons expirant bientôt
  const bonsExpirantBientot = DataManager.getBonsCadeauxExpirantBientot(30);
  if (alertContainer) {
    if (bonsExpirantBientot.length > 0) {
      alertContainer.style.display = 'block';
      alertContainer.innerHTML = `
        <strong>⚠️ Attention !</strong> ${bonsExpirantBientot.length} bon(s) cadeau expire(nt) dans les 30 prochains jours :
        <ul style="margin: 0.5rem 0 0 1.5rem;">
          ${bonsExpirantBientot.map(bon => {
            const joursRestants = Math.ceil((new Date(bon.dateExpiration) - new Date()) / (1000 * 60 * 60 * 24));
            return `<li>${bon.description} (${bon.montant}€) - <strong>${joursRestants} jour(s)</strong> restants</li>`;
          }).join('')}
        </ul>
      `;
    } else {
      alertContainer.style.display = 'none';
    }
  }

  // Récupérer et filtrer les bons
  let bons = DataManager.getSortedBonsCadeaux();

  // Appliquer le filtre
  const filterValue = document.getElementById('bons-cadeaux-filter')?.value || 'tous';
  currentBonsFilter = filterValue;

  if (filterValue !== 'tous') {
    if (filterValue === 'expire-bientot') {
      bons = bonsExpirantBientot;
    } else {
      bons = bons.filter(bon => bon.statut === filterValue);
    }
  }

  // Appliquer la recherche
  const searchInput = document.getElementById('bons-cadeaux-search');
  const searchQuery = searchInput?.value?.toLowerCase().trim() || '';

  if (searchQuery) {
    bons = bons.filter(bon => {
      return (bon.description || '').toLowerCase().includes(searchQuery) ||
             (bon.acheteurNom || '').toLowerCase().includes(searchQuery) ||
             (bon.beneficiaireNom || '').toLowerCase().includes(searchQuery) ||
             (bon.notes || '').toLowerCase().includes(searchQuery);
    });
  }

  // Afficher les bons
  if (bons.length === 0) {
    container.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; padding: 3rem; color: var(--text-light);">
        <div style="font-size: 3rem; margin-bottom: 1rem;">🎁</div>
        <p>${searchQuery || filterValue !== 'tous' ? 'Aucun bon cadeau trouvé avec ces critères' : 'Aucun bon cadeau enregistré'}</p>
        ${!searchQuery && filterValue === 'tous' ? '<p>Cliquez sur "Nouveau bon cadeau" pour en créer un</p>' : ''}
      </div>
    `;
    return;
  }

  container.innerHTML = bons.map(bon => generateBonCadeauCard(bon, bonsExpirantBientot)).join('');

  // Setup de la recherche
  setupBonsCadeauxSearch();
}

function generateBonCadeauCard(bon, bonsExpirantBientot = []) {
  const isExpireBientot = bonsExpirantBientot.some(b => b.id === bon.id);
  const joursRestants = Math.ceil((new Date(bon.dateExpiration) - new Date()) / (1000 * 60 * 60 * 24));

  // Déterminer le statut d'affichage
  let statutClass = `statut-${bon.statut}`;
  let statutLabel = '';
  let statutBadge = '';

  switch(bon.statut) {
    case 'actif':
      statutLabel = '🟢 Actif';
      if (isExpireBientot) {
        statutClass += ' expire-bientot';
        statutBadge = `<span class="bon-expiration-badge">⚠️ ${joursRestants}j</span>`;
      }
      break;
    case 'utilise':
      statutLabel = '✅ Utilisé';
      break;
    case 'expire':
      statutLabel = '❌ Expiré';
      break;
    case 'rembourse':
      statutLabel = '💸 Remboursé';
      break;
  }

  // Classe d'expiration
  let expirationClass = '';
  if (bon.statut === 'actif') {
    if (joursRestants <= 7) expirationClass = 'danger';
    else if (joursRestants <= 30) expirationClass = 'warning';
  }

  // Infos client
  const appData = DataManager.getAppData();
  let acheteurDisplay = bon.acheteurNom || 'Non renseigné';
  if (bon.acheteurClientId) {
    const acheteur = appData.clients.find(c => c.id === bon.acheteurClientId);
    if (acheteur) acheteurDisplay = `${acheteur.prenom} ${acheteur.nom}`;
  }

  let beneficiaireDisplay = bon.beneficiaireNom || '<em>Non renseigné</em>';
  if (bon.beneficiaireClientId) {
    const beneficiaire = appData.clients.find(c => c.id === bon.beneficiaireClientId);
    if (beneficiaire) beneficiaireDisplay = `${beneficiaire.prenom} ${beneficiaire.nom}`;
  }

  // Info utilisation si utilisé
  let utilisationInfo = '';
  if (bon.statut === 'utilise' && bon.prestationId) {
    const prestation = appData.prestations.find(p => p.id === bon.prestationId);
    if (prestation) {
      utilisationInfo = `
        <div class="bon-utilisation-info">
          <strong>✅ Utilisé le ${DataManager.formatDate(bon.dateUtilisation || prestation.date)}</strong>
          ${bon.forceUtilise ? '<div class="bon-force-info">⚠️ Bon utilisé après expiration (forcé)</div>' : ''}
        </div>
      `;
    }
  }

  // Vérifier s'il y a un RDV planifié pour ce bon
  let rdvInfo = '';
  if (bon.statut === 'actif') {
    const rdvPlanifie = appData.rdv?.find(r => r.bonCadeauId === bon.id && r.statut === 'planifie');
    if (rdvPlanifie) {
      const clientRdv = appData.clients.find(c => c.id === rdvPlanifie.clientId);
      rdvInfo = `
        <div style="background: #e3f2fd; padding: 0.5rem; border-radius: 4px; margin-top: 0.5rem; font-size: 0.8rem; border-left: 3px solid #2196f3;">
          📅 <strong>RDV planifié</strong> : ${DataManager.formatDate(rdvPlanifie.date)} à ${rdvPlanifie.heure}
          ${clientRdv ? `<br>👤 ${clientRdv.prenom} ${clientRdv.nom}` : ''}
        </div>
      `;
    }
  }

  // Boutons d'action selon le statut
  let actionsHtml = '';
  if (bon.statut === 'actif') {
    actionsHtml = `
      <button class="btn-primary" onclick="attribuerRdvBonCadeau('${bon.id}')" style="background: var(--beige-dore);">📅 Attribuer RDV</button>
      <button class="btn-secondary" onclick="editBonCadeau('${bon.id}')">✏️</button>
      <button class="btn-secondary" onclick="rembourserBonCadeau('${bon.id}')">💸</button>
      <button class="btn-secondary" onclick="supprimerBonCadeau('${bon.id}')" style="color: #dc3545;" title="Supprimer">🗑️</button>
    `;
  } else if (bon.statut === 'expire') {
    actionsHtml = `
      <button class="btn-primary" onclick="forcerUtilisationBonCadeau('${bon.id}')" style="background: #ffc107; color: #000;">⚠️ Forcer utilisation</button>
      <button class="btn-secondary" onclick="editBonCadeau('${bon.id}')">✏️</button>
      <button class="btn-secondary" onclick="supprimerBonCadeau('${bon.id}')" style="color: #dc3545;" title="Supprimer">🗑️</button>
    `;
  } else {
    actionsHtml = `
      <button class="btn-secondary" onclick="showBonCadeauDetails('${bon.id}')">👁️ Détails</button>
      <button class="btn-secondary" onclick="supprimerBonCadeau('${bon.id}')" style="color: #dc3545;" title="Supprimer">🗑️</button>
    `;
  }

  return `
    <div class="bon-cadeau-card ${statutClass}" data-bon-id="${bon.id}">
      ${statutBadge}

      <div class="bon-cadeau-header">
        <div class="bon-cadeau-montant">${bon.montant.toFixed(2)} €</div>
        <span class="bon-cadeau-statut ${bon.statut}">${statutLabel}</span>
      </div>

      <div class="bon-cadeau-description">🎁 ${bon.description || 'Bon cadeau'}</div>

      <div class="bon-cadeau-info">
        <p><strong>Offert par:</strong> ${acheteurDisplay}</p>
        <p><strong>Pour:</strong> ${beneficiaireDisplay}</p>
        <p><strong>Paiement:</strong> ${bon.moyenPaiement || 'Non précisé'}</p>
        ${bon.notes ? `<p><strong>Notes:</strong> ${bon.notes}</p>` : ''}
      </div>

      <div class="bon-cadeau-dates">
        <span>Acheté le ${DataManager.formatDate(bon.dateAchat)}</span>
        <span class="bon-cadeau-expiration ${expirationClass}">
          ${bon.statut === 'actif' ? `Expire le ${DataManager.formatDate(bon.dateExpiration)}` :
            bon.statut === 'expire' ? `Expiré le ${DataManager.formatDate(bon.dateExpiration)}` :
            `Valide jusqu'au ${DataManager.formatDate(bon.dateExpiration)}`}
        </span>
      </div>

      ${utilisationInfo}
      ${rdvInfo}

      <div class="bon-cadeau-actions">
        ${actionsHtml}
      </div>
    </div>
  `;
}

function setupBonsCadeauxSearch() {
  const searchInput = document.getElementById('bons-cadeaux-search');
  const clearBtn = document.getElementById('clear-bons-search');
  const filterSelect = document.getElementById('bons-cadeaux-filter');

  if (searchInput && !searchInput.hasAttribute('data-listener-attached')) {
    searchInput.setAttribute('data-listener-attached', 'true');

    searchInput.addEventListener('input', () => {
      if (clearBtn) {
        clearBtn.style.display = searchInput.value ? 'block' : 'none';
      }
      updateBonsCadeauxDisplay();
    });
  }

  if (clearBtn && !clearBtn.hasAttribute('data-listener-attached')) {
    clearBtn.setAttribute('data-listener-attached', 'true');

    clearBtn.addEventListener('click', () => {
      searchInput.value = '';
      clearBtn.style.display = 'none';
      updateBonsCadeauxDisplay();
    });
  }

  if (filterSelect && !filterSelect.hasAttribute('data-listener-attached')) {
    filterSelect.setAttribute('data-listener-attached', 'true');

    filterSelect.addEventListener('change', () => {
      updateBonsCadeauxDisplay();
    });
  }
}

// Fonctions globales pour les bons cadeaux
window.editBonCadeau = function(bonId) {
  if (typeof showEditBonCadeauModal === 'function') {
    showEditBonCadeauModal(bonId);
  }
};

window.rembourserBonCadeau = function(bonId) {
  const appData = DataManager.getAppData();
  const bon = appData.bonsCadeaux?.find(b => b.id === bonId);
  if (!bon) return;

  showBonCadeauActionModal({
    title: '💸 Remboursement du bon cadeau',
    icon: '💸',
    accentColor: '#e67e22',
    bonInfo: {
      description: bon.description,
      montant: bon.montant,
      acheteur: bon.acheteurNom
    },
    message: 'Êtes-vous sûr de vouloir marquer ce bon comme remboursé ?',
    warning: 'Le montant sera déduit des revenus et le bon ne pourra plus être utilisé.',
    confirmText: 'Confirmer le remboursement',
    onConfirm: () => {
      if (typeof BusinessServices !== 'undefined' && BusinessServices.rembourserBonCadeau) {
        BusinessServices.rembourserBonCadeau(bonId);
        DataManager.saveData();
        updateBonsCadeauxDisplay();
        showTemporaryMessage('Bon cadeau marqué comme remboursé');
      }
    }
  });
};

window.forcerUtilisationBonCadeau = function(bonId) {
  const appData = DataManager.getAppData();
  const bon = appData.bonsCadeaux?.find(b => b.id === bonId);
  if (!bon) return;

  showBonCadeauActionModal({
    title: '⚠️ Forcer l\'utilisation',
    icon: '⚠️',
    accentColor: '#f39c12',
    bonInfo: {
      description: bon.description,
      montant: bon.montant,
      acheteur: bon.acheteurNom,
      dateExpiration: bon.dateExpiration
    },
    message: 'Ce bon est expiré. Voulez-vous quand même permettre son utilisation ?',
    warning: 'Cette action sera tracée. Le bon pourra être utilisé malgré son expiration.',
    confirmText: 'Autoriser l\'utilisation',
    onConfirm: () => {
      if (typeof BusinessServices !== 'undefined' && BusinessServices.forcerUtilisationBonExpire) {
        BusinessServices.forcerUtilisationBonExpire(bonId);
        DataManager.saveData();
        updateBonsCadeauxDisplay();
        showTemporaryMessage('Le bon peut maintenant être utilisé');
      }
    }
  });
};

// Modale d'action pour les bons cadeaux (remboursement, forçage, etc.)
function showBonCadeauActionModal(options) {
  const overlay = document.createElement('div');
  overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0,0,0,0.5);
    z-index: 10000;
    display: flex;
    align-items: center;
    justify-content: center;
    animation: fadeIn 0.2s ease;
  `;

  const modal = document.createElement('div');
  modal.style.cssText = `
    background: white;
    padding: 0;
    border-radius: 16px;
    box-shadow: 0 8px 32px rgba(0,0,0,0.3);
    max-width: 450px;
    width: 90%;
    overflow: hidden;
    animation: slideUp 0.3s ease;
  `;

  const expirationInfo = options.bonInfo.dateExpiration
    ? `<div style="color: #e74c3c; font-size: 0.85rem; margin-top: 0.25rem;">Expiré le ${new Date(options.bonInfo.dateExpiration).toLocaleDateString('fr-FR')}</div>`
    : '';

  modal.innerHTML = `
    <div style="background: linear-gradient(135deg, ${options.accentColor}, ${options.accentColor}dd); padding: 1.5rem; color: white; text-align: center;">
      <div style="font-size: 2.5rem; margin-bottom: 0.5rem;">${options.icon}</div>
      <h3 style="margin: 0; font-weight: 600;">${options.title}</h3>
    </div>

    <div style="padding: 1.5rem;">
      <div style="background: #f8f9fa; border-radius: 10px; padding: 1rem; margin-bottom: 1rem;">
        <div style="font-weight: 600; color: #333; margin-bottom: 0.5rem;">${options.bonInfo.description}</div>
        <div style="display: flex; justify-content: space-between; color: #666; font-size: 0.9rem;">
          <span>Montant : <strong style="color: ${options.accentColor};">${options.bonInfo.montant} €</strong></span>
          <span>Acheteur : ${options.bonInfo.acheteur}</span>
        </div>
        ${expirationInfo}
      </div>

      <p style="margin: 0 0 1rem 0; color: #333; line-height: 1.5; text-align: center;">${options.message}</p>

      <div style="background: #fff3cd; border: 1px solid #ffc107; border-radius: 8px; padding: 0.75rem; margin-bottom: 1.5rem;">
        <div style="display: flex; align-items: flex-start; gap: 0.5rem;">
          <span style="font-size: 1.1rem;">⚠️</span>
          <small style="color: #856404;">${options.warning}</small>
        </div>
      </div>

      <div style="display: flex; gap: 1rem; justify-content: center;">
        <button id="modal-cancel" class="btn-secondary" style="flex: 1; padding: 0.75rem 1.5rem; border-radius: 8px; font-size: 1rem;">Annuler</button>
        <button id="modal-confirm" class="btn-primary" style="flex: 1; padding: 0.75rem 1.5rem; border-radius: 8px; font-size: 1rem; background: ${options.accentColor}; border-color: ${options.accentColor};">${options.confirmText}</button>
      </div>
    </div>
  `;

  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  // Ajouter les animations CSS
  const style = document.createElement('style');
  style.textContent = `
    @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
    @keyframes slideUp { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
  `;
  document.head.appendChild(style);

  document.getElementById('modal-cancel').onclick = () => {
    overlay.remove();
    style.remove();
  };

  document.getElementById('modal-confirm').onclick = () => {
    overlay.remove();
    style.remove();
    options.onConfirm();
  };

  overlay.onclick = (e) => {
    if (e.target === overlay) {
      overlay.remove();
      style.remove();
    }
  };
}

window.showBonCadeauDetails = function(bonId) {
  if (typeof showBonCadeauDetailsModal === 'function') {
    showBonCadeauDetailsModal(bonId);
  }
};

window.supprimerBonCadeau = function(bonId) {
  const appData = DataManager.getAppData();
  const bon = appData.bonsCadeaux?.find(b => b.id === bonId);
  if (!bon) return;

  showBonCadeauActionModal({
    title: '🗑️ Supprimer le bon cadeau',
    icon: '🗑️',
    accentColor: '#dc3545',
    bonInfo: {
      description: bon.description,
      montant: bon.montant,
      acheteur: bon.acheteurNom
    },
    message: 'Êtes-vous sûr de vouloir supprimer définitivement ce bon cadeau ?',
    warning: 'Cette action est irréversible. Le bon sera supprimé de tous les rapports et statistiques.',
    confirmText: 'Supprimer définitivement',
    onConfirm: () => {
      if (typeof BusinessServices !== 'undefined' && BusinessServices.deleteBonCadeau) {
        BusinessServices.deleteBonCadeau(bonId);
        DataManager.saveData();
        updateBonsCadeauxDisplay();
        showTemporaryMessage('Bon cadeau supprimé');
      }
    }
  });
};

window.attribuerRdvBonCadeau = function(bonId) {
  if (typeof showAttribuerRdvBonCadeauModal === 'function') {
    showAttribuerRdvBonCadeauModal(bonId);
  }
};

// ===== GESTION DES VUES ANNUAIRE =====

function loadAnnuaireViewPrefs() {
  const appData = DataManager.getAppData();
  if (appData.parametres?.annuaireViewPrefs) {
    annuaireViewPrefs = { ...annuaireViewPrefs, ...appData.parametres.annuaireViewPrefs };
  }
}

function saveAnnuaireViewPrefs() {
  const appData = DataManager.getAppData();
  if (!appData.parametres) appData.parametres = {};
  appData.parametres.annuaireViewPrefs = annuaireViewPrefs;
  DataManager.saveData();
}

function initAnnuaireViewControls() {
  loadAnnuaireViewPrefs();

  // Appliquer les préférences aux contrôles UI
  const gridBtn = document.getElementById('view-grid-btn');
  const listBtn = document.getElementById('view-list-btn');
  const sortSelect = document.getElementById('client-sort-select');

  if (gridBtn && listBtn) {
    gridBtn.classList.toggle('active', annuaireViewPrefs.viewMode === 'grid');
    listBtn.classList.toggle('active', annuaireViewPrefs.viewMode === 'list');
  }

  if (sortSelect) {
    sortSelect.value = annuaireViewPrefs.sortMode;
  }

  // Checkboxes sections
  ['fideles', 'nouveaux', 'prospects', 'collaborateurs'].forEach(section => {
    const checkbox = document.getElementById(`toggle-${section}`);
    if (checkbox) {
      const key = `show${section.charAt(0).toUpperCase() + section.slice(1)}`;
      checkbox.checked = annuaireViewPrefs[key];
    }
  });

  // Appliquer le layout adaptatif initial
  setTimeout(() => {
    updateSectionsLayout();
    updateClientsDisplay();
  }, 100);
}

function setViewMode(mode) {
  annuaireViewPrefs.viewMode = mode;

  // Update boutons
  const gridBtn = document.getElementById('view-grid-btn');
  const listBtn = document.getElementById('view-list-btn');
  if (gridBtn && listBtn) {
    gridBtn.classList.toggle('active', mode === 'grid');
    listBtn.classList.toggle('active', mode === 'list');
  }

  saveAnnuaireViewPrefs();
  updateClientsDisplay();
}

function toggleSection(section, visible) {
  const key = `show${section.charAt(0).toUpperCase() + section.slice(1)}`;
  annuaireViewPrefs[key] = visible;

  // Appliquer la visibilité et gérer le layout adaptatif
  const sectionElements = {
    fideles: document.getElementById('clients-fideles-list')?.closest('.clients-section'),
    nouveaux: document.getElementById('clients-list')?.closest('.clients-section'),
    prospects: document.querySelector('.prospects-section'),
    collaborateurs: document.querySelector('.collaborateurs-section')
  };

  const element = sectionElements[section];
  if (element) {
    element.classList.toggle('hidden', !visible);
  }

  // Gérer le layout adaptatif (full-width si seul visible dans sa ligne)
  updateSectionsLayout();

  saveAnnuaireViewPrefs();
}

// Gère le layout adaptatif des sections (pleine largeur si seul visible sur la ligne)
function updateSectionsLayout() {
  const sectionElements = {
    fideles: document.querySelector('.fideles-section'),
    nouveaux: document.querySelector('.nouveaux-section'),
    prospects: document.querySelector('.prospects-section'),
    collaborateurs: document.querySelector('.collaborateurs-section')
  };

  // Ligne 1 : Fidèles + Nouveaux
  const fidelesVisible = annuaireViewPrefs.showFideles;
  const nouveauxVisible = annuaireViewPrefs.showNouveaux;

  if (sectionElements.fideles) {
    sectionElements.fideles.classList.toggle('hidden', !fidelesVisible);
    sectionElements.fideles.classList.toggle('full-width', fidelesVisible && !nouveauxVisible);
  }
  if (sectionElements.nouveaux) {
    sectionElements.nouveaux.classList.toggle('hidden', !nouveauxVisible);
    sectionElements.nouveaux.classList.toggle('full-width', nouveauxVisible && !fidelesVisible);
  }

  // Ligne 2 : Prospects + Collaborateurs
  const prospectsVisible = annuaireViewPrefs.showProspects;
  const collabVisible = annuaireViewPrefs.showCollaborateurs;

  if (sectionElements.prospects) {
    sectionElements.prospects.classList.toggle('hidden', !prospectsVisible);
    sectionElements.prospects.classList.toggle('full-width', prospectsVisible && !collabVisible);
  }
  if (sectionElements.collaborateurs) {
    sectionElements.collaborateurs.classList.toggle('hidden', !collabVisible);
    sectionElements.collaborateurs.classList.toggle('full-width', collabVisible && !prospectsVisible);
  }
}

function setSortMode(mode) {
  annuaireViewPrefs.sortMode = mode;
  saveAnnuaireViewPrefs();
  updateClientsDisplay();
}

// Génère les en-têtes de tableau cliquables pour le tri
function generateSortableTableHeaders() {
  const currentSort = annuaireViewPrefs.sortMode;

  const headers = [
    { key: 'nom', label: 'Nom', sortAsc: 'nom-asc', sortDesc: 'nom-desc' },
    { key: 'massages', label: 'Massages', sortAsc: 'massages-asc', sortDesc: 'massages-desc' },
    { key: 'ca', label: 'CA', sortAsc: 'ca-asc', sortDesc: 'ca-desc' },
    { key: 'recent', label: 'Ajouté', sortAsc: 'recent-asc', sortDesc: 'recent-desc' },
    { key: 'tel', label: 'Téléphone', sortAsc: null, sortDesc: null },
    { key: 'actions', label: 'Actions', sortAsc: null, sortDesc: null }
  ];

  return headers.map(h => {
    if (!h.sortAsc) {
      return `<th>${h.label}</th>`;
    }

    const isCurrentAsc = currentSort === h.sortAsc;
    const isCurrentDesc = currentSort === h.sortDesc;
    const nextSort = isCurrentDesc ? h.sortAsc : h.sortDesc;
    const arrow = isCurrentAsc ? ' ↑' : (isCurrentDesc ? ' ↓' : '');

    return `<th class="sortable${isCurrentAsc || isCurrentDesc ? ' active' : ''}" onclick="ViewManager.setSortMode('${nextSort}')">${h.label}${arrow}</th>`;
  }).join('');
}

// Extrait un timestamp numérique depuis createdAt ou l'ID du client
function getClientTimestamp(client) {
  // Si createdAt existe, le convertir en timestamp
  if (client.createdAt) {
    return new Date(client.createdAt).getTime();
  }
  // Sinon, extraire le timestamp de l'ID (format: id_TIMESTAMP_random)
  if (client.id && client.id.startsWith('id_')) {
    const parts = client.id.split('_');
    if (parts.length >= 2) {
      const ts = parseInt(parts[1], 10);
      if (!isNaN(ts)) return ts;
    }
  }
  // Fallback: retourne 0 (sera trié en dernier pour recent-desc)
  return 0;
}

// Fonction de tri des clients
function sortClients(clientsWithStats) {
  const mode = annuaireViewPrefs.sortMode;
  const appData = DataManager.getAppData();

  return clientsWithStats.sort((a, b) => {
    switch (mode) {
      case 'massages-desc':
        return b.stats.totalMassages - a.stats.totalMassages;
      case 'massages-asc':
        return a.stats.totalMassages - b.stats.totalMassages;
      case 'ca-desc':
        return b.stats.revenusTotal - a.stats.revenusTotal;
      case 'ca-asc':
        return a.stats.revenusTotal - b.stats.revenusTotal;
      case 'nom-asc':
        return `${a.client.prenom} ${a.client.nom}`.localeCompare(`${b.client.prenom} ${b.client.nom}`);
      case 'nom-desc':
        return `${b.client.prenom} ${b.client.nom}`.localeCompare(`${a.client.prenom} ${a.client.nom}`);
      case 'recent-desc':
        // Plus récent en premier (date de création décroissante)
        const tsB = getClientTimestamp(b.client);
        const tsA = getClientTimestamp(a.client);
        return tsB - tsA;
      case 'recent-asc':
        // Plus ancien en premier (date de création croissante)
        const tsA2 = getClientTimestamp(a.client);
        const tsB2 = getClientTimestamp(b.client);
        return tsA2 - tsB2;
      default:
        return b.stats.totalMassages - a.stats.totalMassages;
    }
  });
}

// Toggle expansion d'une card compacte
function toggleClientCard(cardElement) {
  // Fermer toutes les autres cards expandées
  document.querySelectorAll('.client-card-compact.expanded').forEach(card => {
    if (card !== cardElement) {
      card.classList.remove('expanded');
    }
  });

  cardElement.classList.toggle('expanded');
}

// Générer une card compacte pour un client
function generateCompactClientCard(client, stats, isFidele = false) {
  const tagsHtml = ClientServices.generateTagsHTML ? ClientServices.generateTagsHTML(client.tags, true, client.id, 'client') : '';
  const fideleClass = isFidele ? 'fidele' : 'nouveau';

  return `
    <div class="client-card-compact ${fideleClass}" onclick="ViewManager.toggleClientCard(this)">
      <div class="card-header">
        <span class="client-name">${client.prenom} ${client.nom}</span>
        <div class="badges">
          ${isFidele ? `<span class="badge badge-massages">⭐ ${stats.totalMassages}</span>` : `<span class="badge badge-massages">${stats.totalMassages}</span>`}
          ${stats.rdvAnnules > 0 ? `<span class="badge badge-annules" title="RDV annulés">${stats.rdvAnnules}</span>` : ''}
          <span class="expand-icon">▼</span>
        </div>
      </div>
      <div class="card-details">
        ${client.telephone ? `<div class="info-row">📞 ${client.telephone}</div>` : ''}
        ${client.email ? `<div class="info-row">✉️ ${client.email}</div>` : ''}
        ${client.societe ? `<div class="info-row">🏢 ${client.societe}</div>` : ''}
        ${client.notes ? `<div class="info-row"><em>${client.notes}</em></div>` : ''}
        <div class="info-row ca-value">💰 ${stats.revenusTotal.toFixed(2)} €</div>
        ${stats.dernierMassage ? `<div class="info-row">📅 Dernier : ${DataManager.formatDate(stats.dernierMassage)}</div>` : ''}
        <div class="info-row">🏷️ ${tagsHtml || '<span style="color:#999;">Aucun tag</span>'}</div>
        <div class="card-actions" onclick="event.stopPropagation();">
          <button class="btn-primary" onclick="ClientServices.showClientDetails('${client.id}')">👁️ Consulter</button>
          <button class="btn-secondary" onclick="FormManager.editClient('${client.id}')">Éditer</button>
          <button class="btn-danger" onclick="FormManager.deleteClient('${client.id}')">Supprimer</button>
        </div>
      </div>
    </div>
  `;
}

// Générer une ligne de tableau pour un client
function generateClientTableRow(client, stats, isFidele = false) {
  const fideleClass = isFidele ? 'fidele' : '';
  const badgeClass = isFidele ? 'badge-mini fidele' : 'badge-mini';

  return `
    <tr class="${fideleClass}">
      <td class="name-cell" onclick="ClientServices.showClientDetails('${client.id}')">${client.prenom} ${client.nom}</td>
      <td><span class="${badgeClass}">${isFidele ? '⭐ ' : ''}${stats.totalMassages}</span></td>
      <td class="ca-cell">${stats.revenusTotal.toFixed(2)} €</td>
      <td>${stats.dernierMassage ? DataManager.formatDate(stats.dernierMassage) : '-'}</td>
      <td>${client.telephone || '-'}</td>
      <td class="actions-cell">
        <button class="btn-primary" onclick="ClientServices.showClientDetails('${client.id}')">👁️</button>
        <button class="btn-secondary" onclick="FormManager.editClient('${client.id}')">✏️</button>
        <button class="btn-danger" onclick="FormManager.deleteClient('${client.id}')">🗑️</button>
      </td>
    </tr>
  `;
}

// Générer une card compacte pour un prospect
function generateCompactProspectCard(prospect) {
  const tagsHtml = ClientServices.generateTagsHTML ? ClientServices.generateTagsHTML(prospect.tags, true, prospect.id, 'prospect') : '';

  return `
    <div class="client-card-compact prospect" onclick="ViewManager.toggleClientCard(this)">
      <div class="card-header">
        <span class="client-name">${prospect.prenom} ${prospect.nom}</span>
        <div class="badges">
          <span class="badge badge-prospect">${prospect.statut || 'Prospect'}</span>
          <span class="expand-icon">▼</span>
        </div>
      </div>
      <div class="card-details">
        ${prospect.telephone ? `<div class="info-row">📞 ${prospect.telephone}</div>` : ''}
        ${prospect.email ? `<div class="info-row">✉️ ${prospect.email}</div>` : ''}
        ${prospect.societe ? `<div class="info-row">🏢 ${prospect.societe}</div>` : ''}
        ${prospect.notes ? `<div class="info-row"><em>${prospect.notes}</em></div>` : ''}
        <div class="info-row">🏷️ ${tagsHtml || '<span style="color:#999;">Aucun tag</span>'}</div>
        <div class="card-actions" onclick="event.stopPropagation();">
          <button class="btn-primary" onclick="FormManager.convertToClient('${prospect.id}')">→ Client</button>
          <button class="btn-secondary" onclick="FormManager.editProspect('${prospect.id}')">Éditer</button>
          <button class="btn-danger" onclick="FormManager.deleteProspect('${prospect.id}')">Supprimer</button>
        </div>
      </div>
    </div>
  `;
}

// Générer une card compacte pour un collaborateur
function generateCompactCollaborateurCard(collaborateur) {
  const tagsHtml = ClientServices.generateTagsHTML ? ClientServices.generateTagsHTML(collaborateur.tags, true, collaborateur.id, 'collaborateur') : '';

  return `
    <div class="client-card-compact collaborateur" onclick="ViewManager.toggleClientCard(this)">
      <div class="card-header">
        <span class="client-name">${collaborateur.prenom} ${collaborateur.nom || ''}</span>
        <div class="badges">
          ${collaborateur.entreprise ? `<span class="badge badge-collab">${collaborateur.entreprise}</span>` : ''}
          <span class="expand-icon">▼</span>
        </div>
      </div>
      <div class="card-details">
        ${collaborateur.specialites ? `<div class="info-row">🎯 ${collaborateur.specialites}</div>` : ''}
        ${collaborateur.telephone ? `<div class="info-row">📞 ${collaborateur.telephone}</div>` : ''}
        ${collaborateur.email ? `<div class="info-row">✉️ ${collaborateur.email}</div>` : ''}
        ${collaborateur.notes ? `<div class="info-row"><em>${collaborateur.notes}</em></div>` : ''}
        <div class="info-row">🏷️ ${tagsHtml || '<span style="color:#999;">Aucun tag</span>'}</div>
        <div class="card-actions" onclick="event.stopPropagation();">
          <button class="btn-secondary" onclick="FormManager.editCollaborateur('${collaborateur.id}')">Éditer</button>
          <button class="btn-danger" onclick="FormManager.deleteCollaborateur('${collaborateur.id}')">Supprimer</button>
        </div>
      </div>
    </div>
  `;
}

window.ViewManager = {
  // Navigation
  showTab,

  // Dashboard
  updateDashboard,
  toggleCustomizeMode,
  saveDashboardConfig,
  resetDashboardConfig,
  toggleKpiVisibility,

  // Drag & Drop
  handleDragStart,
  handleDragOver,
  handleDrop,
  handleDragEnd,

  // Calendrier
  updateCalendar,
  previousMonth,
  nextMonth,
  toggleJourInstitut,

  // Tables et vues
  updatePrestationsTable,
  updateClientsDisplay,
  updateDepensesDisplay,

  // Collaborateurs
  updateCollaborateursList,
  generateFallbackTagsHTML,
  getTagColor,

  // Recherche clients avec suppression
  displayFilteredClients,

  // Filtre par ville
  filterByVille,
  applyVilleFilter,

  // Bons Cadeaux
  updateBonsCadeauxDisplay,

  // Gestion des vues Annuaire
  initAnnuaireViewControls,
  setViewMode,
  toggleSection,
  setSortMode,
  toggleClientCard,
  generateSortableTableHeaders
};

// Fonctions globales
window.handleDragStart = handleDragStart;
window.handleDragOver = handleDragOver;
window.handleDrop = handleDrop;
window.handleDragEnd = handleDragEnd;
window.toggleKpiVisibility = toggleKpiVisibility;
window.duplicatePrestation = duplicatePrestation;

console.log('✅ View Manager avec collaborateurs propres (sans bouton Appeler + Tags unifié) chargé');