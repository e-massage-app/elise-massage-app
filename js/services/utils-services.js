// ===== js/services/utils-services.js =====
// Export/Import, Analytics Chart.js, Migration et utilitaires avancés

// ===== CACHE DES DISTANCES =====
let distanceCache = new Map();

// ===== GESTION CLÉ API OPENROUTESERVICE =====

async function testOpenRouteServiceKey(apiKey) {
  if (!apiKey || apiKey.trim() === '') {
    return { success: false, error: 'Clé API vide' };
  }
  
  try {
    // Test simple avec géocodage d'Ajaccio
    const url = `https://api.openrouteservice.org/geocode/search?api_key=${apiKey}&text=Ajaccio&boundary.country=FR&size=1`;
    const response = await fetch(url);
    
    if (response.ok) {
      const data = await response.json();
      if (data.features && data.features.length > 0) {
        return { success: true, message: 'Clé API valide ✅' };
      }
    } else if (response.status === 401) {
      return { success: false, error: 'Clé API invalide ❌' };
    } else if (response.status === 429) {
      return { success: false, error: 'Quota dépassé (réessayez plus tard)' };
    }
    
    return { success: false, error: `Erreur ${response.status}` };
    
  } catch (error) {
    return { success: false, error: `Erreur réseau: ${error.message}` };
  }
}

async function saveAndTestApiKey() {
  const keyInput = document.getElementById('openroute-api-key');
  const statusDiv = document.getElementById('api-key-status');
  
  if (!keyInput || !statusDiv) return;
  
  const apiKey = keyInput.value.trim();
  
  // Afficher le test en cours
  statusDiv.innerHTML = '<span style="color: #f39c12;">🔄 Test en cours...</span>';
  
  // Tester la clé
  const result = await testOpenRouteServiceKey(apiKey);
  
  if (result.success) {
    // Sauvegarder la clé
    const parametres = DataManager.getParametres();
    parametres.openRouteServiceKey = apiKey;
    DataManager.saveParametres(parametres);
    DataManager.saveData();
    
    statusDiv.innerHTML = `<span style="color: #27ae60;">${result.message}</span>`;
    showTemporaryMessage('🔑 Clé API sauvegardée et testée !', 'success');
  } else {
    statusDiv.innerHTML = `<span style="color: #e74c3c;">${result.error}</span>`;
  }
}

function clearApiKey() {
  const keyInput = document.getElementById('openroute-api-key');
  const statusDiv = document.getElementById('api-key-status');
  
  if (keyInput) keyInput.value = '';
  if (statusDiv) statusDiv.innerHTML = '';
  
  // Supprimer de la config
  const parametres = DataManager.getParametres();
  delete parametres.openRouteServiceKey;
  DataManager.saveParametres(parametres);
  DataManager.saveData();
  
  showTemporaryMessage('🗑️ Clé API supprimée', 'info');
}

function clearDistanceCache() {
  distanceCache.clear();
  showTemporaryMessage('Cache des distances vidé', 'info');
}

function getDistanceFromCache(address1, address2) {
  const cacheKey = `${address1}|${address2}`;
  return distanceCache.get(cacheKey);
}

function setDistanceInCache(address1, address2, distance) {
  const cacheKey = `${address1}|${address2}`;
  distanceCache.set(cacheKey, distance);
}

function generateApiKeySection() {
  const parametres = DataManager.getParametres();
  const currentKey = parametres.openRouteServiceKey || '';
  const maskedKey = currentKey ? currentKey.slice(0, 4) + '***' + currentKey.slice(-4) : '';
  
  return `
    <div class="api-key-section" style="background: #f8f9fa; padding: 1.5rem; border-radius: 8px; border-left: 4px solid #2196f3; margin: 1rem 0;">
      <h4 style="margin: 0 0 1rem 0; color: #2196f3;">🗺️ OpenRouteService (distances précises)</h4>
      
      <div style="margin-bottom: 1rem;">
        <p style="margin: 0 0 0.5rem 0; font-size: 0.9rem; color: #666;">
          <strong>Gratuit :</strong> 2000 calculs/jour • 
          <a href="https://openrouteservice.org/dev/#/signup" target="_blank" style="color: #2196f3;">Créer un compte</a>
        </p>
      </div>
      
      <div style="display: flex; gap: 1rem; align-items: center; flex-wrap: wrap;">
        <div style="flex: 1; min-width: 200px;">
          <label for="openroute-api-key" style="display: block; margin-bottom: 0.25rem; font-weight: 600;">Clé API :</label>
          <input type="password" 
                 id="openroute-api-key" 
                 placeholder="Collez votre clé API OpenRouteService"
                 value="${currentKey}"
                 style="width: 100%; padding: 0.5rem; border: 1px solid #ddd; border-radius: 4px; font-family: monospace;">
        </div>
        
        <div style="display: flex; gap: 0.5rem;">
          <button type="button" onclick="saveAndTestApiKey()" class="btn-primary" style="white-space: nowrap;">
            🔍 Tester & Sauver
          </button>
          <button type="button" onclick="clearApiKey()" class="btn-secondary" style="white-space: nowrap;">
            🗑️ Effacer
          </button>
        </div>
      </div>
      
      <div id="api-key-status" style="margin-top: 0.5rem; font-size: 0.9rem;">
        ${currentKey ? `<span style="color: #27ae60;">✅ Clé configurée : ${maskedKey}</span>` : '<span style="color: #666;">Aucune clé configurée</span>'}
      </div>
      
      <div style="margin-top: 1rem; padding: 0.75rem; background: #e8f5e8; border-radius: 4px; font-size: 0.85rem;">
        <strong>💡 Avantages :</strong> Distances routières précises au lieu d'approximations • 
        Temps de trajet estimé • Calcul automatique pour tous vos déplacements
      </div>
    </div>
  `;
}

// ===== EXPORT/IMPORT COMPLET =====

async function exportDataUI() {
  try {
    const result = await DataManager.exportData();
    if (result.success) {
      showCustomAlert('✅ Données exportées avec succès !', 'success');
    } else {
      showCustomAlert('❌ Erreur lors de l\'exportation', 'error');
    }
  } catch (error) {
    showCustomAlert('❌ Erreur: ' + error.message, 'error');
  }
}

async function importDataUI() {
  const confirmed = await showCustomConfirm('⚠️ L\'importation remplacera toutes vos données actuelles. Continuer ?');
  if (!confirmed) return;
  
  try {
    const result = await DataManager.importData();
    if (result.success) {
      // Mettre à jour toutes les vues
      ViewManager.updateDashboard();
      ViewManager.updateCalendar();
      ViewManager.updatePrestationsTable();
      ViewManager.updateClientsDisplay();
      updateAnalytics();
      ViewManager.updateDepensesDisplay();
      
      showCustomAlert('✅ Données importées avec succès !', 'success');
    } else {
      showCustomAlert('❌ Erreur lors de l\'importation', 'error');
    }
  } catch (error) {
    showCustomAlert('❌ Erreur: ' + error.message, 'error');
  }
}

function exportCalendar() {
  try {
    const icsContent = BusinessServices.generateICSCalendar();
    
    // Télécharger le fichier
    const blob = new Blob([icsContent], { type: 'text/calendar' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `agenda-massage-${new Date().toISOString().split('T')[0]}.ics`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    showTemporaryMessage('📅 Calendrier exporté !');
  } catch (error) {
    showCustomAlert('❌ Erreur export calendrier: ' + error.message, 'error');
  }
}

// ===== MIGRATION DES FRAIS DE DÉPLACEMENT =====

async function executerMigration() {
  const confirmed = await showCustomConfirm('🔄 Migrer automatiquement tous les frais de déplacement existants vers les dépenses Transport ?');
  if (!confirmed) return;
  
  try {
    const result = BusinessServices.migrerToutesPrestationsExistantes();
    
    // Mettre à jour l'interface
    ViewManager.updateDashboard();
    updateAnalytics();
    ViewManager.updateDepensesDisplay();
    
    // Message de résultat détaillé
    showCustomAlert(`✅ Migration terminée !
    
📋 ${result.prestationsMigrees} prestations avec frais trouvées
✅ ${result.depensesCreees} dépenses transport créées
⚠️ ${result.depensesIgnorees} déjà existantes (ignorées)

💡 Vos analytics reflètent maintenant la rentabilité réelle !`, 'success');
  } catch (error) {
    showCustomAlert(`❌ Erreur lors de la migration: ${error.message}`, 'error');
  }
}

// ===== ANALYTICS CHART.JS INTERACTIFS =====

let revenueChart = null;
let prestationsChart = null;
let dureesChart = null;

// v1.0.7.0 : slugify pour generer des IDs HTML stables
function slugifyGroupe(name) {
  return (name || '').toString()
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

// v1.0.7.0 : icone par defaut selon le nom de groupe (heuristique)
function getGroupeIcon(name) {
  const n = (name || '').toLowerCase();
  if (n.includes('headspa') || n.includes('head spa')) return '💆‍♀️';
  if (n.includes('massage') || n.includes('rituel') || n.includes('soins du monde')) return '💆';
  if (n.includes('épil') || n.includes('epil')) return '✨';
  if (n.includes('soin')) return '🌸';
  return '🌿';
}

// v1.0.7.0 : genere les filter-pills par groupe (Massages, HeadSpa, + custom).
// Idempotent : sait rebuilder si appele plusieurs fois.
function renderGroupesPills() {
  const container = document.getElementById('filter-pills-groupes');
  if (!container || typeof DataManager === 'undefined' || !DataManager.getGroupesCategories) return;

  const groupes = DataManager.getGroupesCategories();
  // Ordre : Massages d'abord, HeadSpa ensuite, puis les autres par ordre alpha
  const ordered = [];
  const massages = groupes.find(g => g.nom === 'Massages');
  const headspa = groupes.find(g => g.nom === 'HeadSpa');
  if (massages) ordered.push(massages);
  else ordered.push({ nom: 'Massages', couleur: null });
  if (headspa) ordered.push(headspa);
  else ordered.push({ nom: 'HeadSpa', couleur: null });
  groupes
    .filter(g => g.nom !== 'Massages' && g.nom !== 'HeadSpa')
    .sort((a, b) => a.nom.localeCompare(b.nom))
    .forEach(g => ordered.push(g));

  // Memoriser les etats actuels (pour rester sur "checked" si l'utilisateur a coche)
  const previousStates = {};
  container.querySelectorAll('input[type="checkbox"]').forEach(cb => {
    previousStates[cb.id] = cb.checked;
  });

  container.innerHTML = ordered.map(g => {
    const isMassages = g.nom === 'Massages';
    const isHeadspa = g.nom === 'HeadSpa';
    const inputId = isMassages ? 'filter-massages' : (isHeadspa ? 'filter-headspa' : `filter-groupe-${slugifyGroupe(g.nom)}`);
    const amountId = isMassages ? 'massages-amount' : (isHeadspa ? 'headspa-amount' : `amount-groupe-${slugifyGroupe(g.nom)}`);
    const checked = previousStates[inputId] !== undefined ? previousStates[inputId] : true;
    const icon = getGroupeIcon(g.nom);
    // v1.0.7.1 : retire la bordure coloree, jugee disgracieuse - on garde juste le pill standard
    return `
      <label class="filter-pill ${checked ? 'active' : ''}" data-groupe="${g.nom.replace(/"/g, '&quot;')}">
        <input type="checkbox" id="${inputId}" ${checked ? 'checked' : ''}>
        <span class="pill-content">${icon} ${g.nom}</span>
        <span class="pill-amount" id="${amountId}">0€</span>
      </label>
    `;
  }).join('');

  // Recabler les events change (re-run setupDynamicFilters re-listera tout)
  setupDynamicFilters();
}

function updateAnalytics() {
  // v1.0.7.0 : (re)generer les pills par groupe avant de tout calculer
  renderGroupesPills();
  updateFilterAmountsDisplay();
  setupYearSelector();
  setupDynamicFilters();
  updateRevenueChart();
  updatePrestationsChart();
  updateDureesChart();
  updateMoyensPaiementChart();
  updateCanalsChart();
  updateCanauxRevenusTable();
  updateGenreChart();
  updateKeyStats();
  updateGoogleAdsAnalytics();
  setupGlobalAnalyticsControls();
}

function setupGlobalAnalyticsControls() {
  const globalYearSelector = document.getElementById('global-year-selector');
  const globalMonthSelector = document.getElementById('global-month-selector');
  
  if (!globalYearSelector) return;
  
  globalYearSelector.innerHTML = '<option value="current">Année actuelle</option>';
  
  const years = DataManager.getYearsFromData();
  years.forEach(year => {
    const option = document.createElement('option');
    option.value = year;
    option.textContent = year;
    globalYearSelector.appendChild(option);
  });
  
  globalYearSelector.addEventListener('change', updateAllAnalyticsCharts);
  if (globalMonthSelector) {
    globalMonthSelector.addEventListener('change', updateAllAnalyticsCharts);
  }
}

function updateAllAnalyticsCharts() {
  const selectedYear = document.getElementById('global-year-selector')?.value || 'current';
  const selectedMonth = document.getElementById('global-month-selector')?.value || '';
  
  updatePrestationsChart(selectedYear, selectedMonth);
  updateDureesChart(selectedYear, selectedMonth);
  updateMoyensPaiementChart(selectedYear, selectedMonth);
  updateCanalsChart(selectedYear, selectedMonth);
  updateGenreChart(selectedYear, selectedMonth);
  updateCanauxRevenusTable(selectedYear, selectedMonth);
  updateKeyStats(selectedYear, selectedMonth);
  updatePrestationsStats(selectedYear, selectedMonth);
  updateDureesStats(selectedYear, selectedMonth);
}

// Dans utils-services.js, ajoutez cette fonction
function updateCanauxRevenusStats(selectedYear = 'current', selectedMonth = '') {
  const analytics = ClientServices.getCanalAnalyticsFiltered ? 
    ClientServices.getCanalAnalyticsFiltered(selectedYear, selectedMonth) :
    ClientServices.getCanalAnalytics();
    
  // Mettre à jour les statistiques du header si elles existent
  const headerStats = document.querySelector('#canaux-revenus-table .chart-stats');
  if (headerStats) {
    headerStats.innerHTML = `<span>${analytics.totalClients} clients • ${analytics.totalRevenus.toFixed(0)}€ revenus</span>`;
  }
}

function updatePrestationsStats(selectedYear = 'current', selectedMonth = '') {
  const appData = DataManager.getAppData();
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
  
  const totalElement = document.querySelector('.total-prestations');
  if (totalElement) {
    totalElement.textContent = `${prestationsFiltered.length} prestations`;
  }
}

function updateDureesStats(selectedYear = 'current', selectedMonth = '') {
  const appData = DataManager.getAppData();
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
  
  const avgDuration = prestationsFiltered.length > 0 
    ? prestationsFiltered.reduce((sum, p) => sum + (p.duree || 60), 0) / prestationsFiltered.length 
    : 0;
    
  const avgElement = document.querySelector('.avg-duration');
  if (avgElement) {
    avgElement.textContent = `${avgDuration.toFixed(0)} min moyenne`;
  }
}

// Ajoutez ces fonctions dans utils-services.js

function updateMoyensPaiementStats(selectedYear = 'current', selectedMonth = '') {
  const chartData = getMoyensPaiementChartData(selectedYear, selectedMonth);
  const totalPaiements = chartData.data.reduce((sum, count) => sum + count, 0);
  const totalTypes = chartData.labels.length;
  
  const statsElement = document.querySelector('.total-paiements');
  if (statsElement) {
    statsElement.textContent = `${totalTypes} ${totalTypes > 1 ? 'types' : 'type'} • ${totalPaiements} paiement${totalPaiements > 1 ? 's' : ''}`;
  }
}

function updateCanalsStats(selectedYear = 'current', selectedMonth = '') {
  const chartData = getCanauxChartData(selectedYear, selectedMonth);
  const totalCanaux = chartData.labels.length;
  const totalClients = chartData.data.reduce((sum, count) => sum + count, 0);
  
  const statsElement = document.querySelector('.total-canaux');
  if (statsElement) {
    statsElement.textContent = `${totalCanaux} ${totalCanaux > 1 ? 'canaux' : 'canal'} • ${totalClients} client${totalClients > 1 ? 's' : ''}`;
  }
}

function updateGenreStats(selectedYear = 'current', selectedMonth = '') {
  const statsGenre = ClientServices.getStatsParSexe(selectedYear, selectedMonth);
  const totalGenre = statsGenre.totaux.clients;
  
  const statsElement = document.querySelector('.total-genre');
  if (statsElement) {
    statsElement.textContent = `${totalGenre} client${totalGenre > 1 ? 's' : ''}`;
  }
}

function updateFilterAmountsDisplay() {
  // Récupérer la période et l'année actuelle
  const activePeriodBtn = document.querySelector('.period-btn.active');
  const period = activePeriodBtn ? (activePeriodBtn.dataset.period === 'current-month' ? 'current-month' : parseInt(activePeriodBtn.dataset.period)) : 12;
  const selectedYear = document.getElementById('year-selector') ? document.getElementById('year-selector').value : 'current';
  
  // Utiliser la fonction qui calcule selon la période
  const data = Calculations.calculateFilterAmountsForPeriod(period, selectedYear);
  
  // Mettre à jour les montants dans les pills
  const elements = {
    'massages-amount': data.amounts.massages,
    'headspa-amount': data.amounts.headspa,
    'bons-cadeaux-amount': data.amounts.bonsCadeaux,
    'tips-amount': data.amounts.tips,
    'huiles-amount': data.amounts.huiles,
    'materiel-amount': data.amounts.materiel,
    'formation-amount': data.amounts.formation,
    'transport-amount': data.amounts.transport,
    'marketing-amount': data.amounts.marketing,
    'loyer-amount': data.amounts.loyer,
    'autre-amount': data.amounts.autre
  };

  Object.entries(elements).forEach(([id, value]) => {
    const element = document.getElementById(id);
    if (element) {
      element.textContent = `${value.toFixed(0)}€`;
    }
  });

  // v1.0.7.0 : mettre a jour les montants des pills custom groupes (Epilation et autres)
  if (data.amounts.groupes) {
    Object.entries(data.amounts.groupes).forEach(([nom, montant]) => {
      if (nom === 'Massages' || nom === 'HeadSpa') return; // deja gere ci-dessus
      const id = `amount-groupe-${slugifyGroupe(nom)}`;
      const el = document.getElementById(id);
      if (el) el.textContent = `${(montant || 0).toFixed(0)}€`;
    });
  }
  
  // Mettre à jour les stats des autres graphiques
  const totalPrestations = period === 'current-month' ? 
    calculatePrestationsForPeriod(period, selectedYear) : 
    Calculations.calculateFilterAmounts().totalPrestations;
  
  const totalElement = document.querySelector('.total-prestations');
  const avgElement = document.querySelector('.avg-duration');
  
  if (totalElement) {
    totalElement.textContent = `${totalPrestations} prestations`;
  }
  if (avgElement) {
    avgElement.textContent = `${Calculations.calculateFilterAmounts().avgDuration.toFixed(0)} min moyenne`;
  }
}

function updateGenreChart(selectedYear = 'current', selectedMonth = '') {
  const ctx = document.getElementById('genre-chart');
  if (!ctx) return;

  const statsGenre = ClientServices.getStatsParSexe(selectedYear, selectedMonth);

  // Mettre à jour les stats affichées
  const totalGenre = statsGenre.totaux.clients;
  const statsElement = document.querySelector('.total-genre');
  if (statsElement) {
    statsElement.textContent = `${totalGenre} client${totalGenre > 1 ? 's' : ''}`;
  }

  if (window.genreChart && typeof window.genreChart.destroy === 'function') {
    window.genreChart.destroy();
  }
  ctx.innerHTML = '';

  const genreData = [statsGenre.hommes.clients, statsGenre.femmes.clients, statsGenre.nonPrecise.clients];
  const genreTotal = genreData.reduce((a, b) => a + b, 0);
  if (genreTotal === 0) return;

  window.genreChart = new ApexCharts(ctx, {
    chart: {
      type: 'donut',
      height: CHART_DEFAULTS.height,
      fontFamily: CHART_DEFAULTS.fontFamily,
      animations: { enabled: true, speed: CHART_DEFAULTS.animSpeed }
    },
    series: genreData,
    labels: ['Hommes', 'Femmes', 'Non pr\u00e9cis\u00e9'],
    colors: [CHART_PALETTE.blue, CHART_PALETTE.pink, CHART_PALETTE.grey],
    stroke: { width: 3, colors: ['#fff'] },
    plotOptions: {
      pie: {
        donut: {
          size: '60%',
          labels: {
            show: true,
            name: { show: true, fontSize: '13px', fontWeight: 600, color: '#555' },
            value: {
              show: true, fontSize: '22px', fontWeight: 700, color: '#333',
              formatter: function(val) { return val; }
            },
            total: {
              show: true, label: 'Total', fontSize: '12px', fontWeight: 500, color: '#999',
              formatter: function(w) { return w.globals.seriesTotals.reduce((a, b) => a + b, 0); }
            }
          }
        }
      }
    },
    legend: {
      position: 'bottom', fontSize: '12px', fontWeight: 500,
      markers: { size: 8, shape: 'circle', offsetX: -4 },
      itemMargin: { horizontal: 12, vertical: 4 },
      formatter: function(seriesName, opts) {
        const val = opts.w.globals.series[opts.seriesIndex];
        const pct = genreTotal > 0 ? ((val / genreTotal) * 100).toFixed(0) : 0;
        return seriesName + ' : ' + pct + '%';
      }
    },
    tooltip: {
      y: {
        formatter: function(val) {
          const pct = genreTotal > 0 ? ((val / genreTotal) * 100).toFixed(1) : 0;
          return val + ' client' + (val > 1 ? 's' : '') + ' (' + pct + '%)';
        }
      }
    },
    dataLabels: { enabled: false }
  });
  window.genreChart.render();
}

function calculatePrestationsForPeriod(period, selectedYear) {
  const appData = DataManager.getAppData();
  
  if (period === 'current-month') {
    const today = new Date();
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth();
    const todayDate = today.getDate();
    
    let count = 0;
    for (let day = 1; day <= todayDate; day++) {
      const dateString = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const prestationsJour = appData.prestations.filter(p => p.date === dateString);
      count += prestationsJour.length;
    }
    return count;
  } else {
    const actualPeriod = period;
    let count = 0;
    
    for (let i = actualPeriod - 1; i >= 0; i--) {
      const date = selectedYear === 'current' ? new Date() : new Date(parseInt(selectedYear), 11, 31);
      date.setMonth(date.getMonth() - i);
      const monthStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      
      const prestationsMois = appData.prestations.filter(p => p.date.startsWith(monthStr));
      count += prestationsMois.length;
    }
    return count;
  }
}

function setupDynamicFilters() {
  // Event listeners pour les filtres
  document.querySelectorAll('.filter-pill input[type="checkbox"]').forEach(checkbox => {
    checkbox.removeEventListener('change', handleFilterChange);
    checkbox.addEventListener('change', handleFilterChange);
  });
  
  // Setup period selector
  document.querySelectorAll('.period-btn').forEach(btn => {
    btn.removeEventListener('click', handlePeriodChange);
    btn.addEventListener('click', handlePeriodChange);
  });
}

function setupYearSelector() {
  const yearSelector = document.getElementById('year-selector');
  if (!yearSelector) return;
  
  const years = DataManager.getYearsFromData();
  const currentSelection = yearSelector.value || 'current';
  
  // Vider et reconstruire
  yearSelector.innerHTML = '<option value="current">Année actuelle</option>';
  
  // Ajouter toutes les années trouvées
  years.forEach(year => {
    const option = document.createElement('option');
    option.value = year;
    option.textContent = year;
    yearSelector.appendChild(option);
  });
  
  // Restaurer sélection
  yearSelector.value = currentSelection;
  
  // Event listener
  yearSelector.removeEventListener('change', handleYearChange);
  yearSelector.addEventListener('change', handleYearChange);
}

function handleYearChange() {
  updateFilteredAnalytics();
}

function handleFilterChange(event) {
  const pill = event.target.closest('.filter-pill');
  if (event.target.checked) {
    pill.classList.add('active');
  } else {
    pill.classList.remove('active');
  }
  
  // Mise à jour immédiate du graphique
  updateFilteredAnalytics();
}

function handlePeriodChange(event) {
  document.querySelectorAll('.period-btn').forEach(btn => btn.classList.remove('active'));
  event.target.classList.add('active');
  
  // Actualiser les filtres ET le graphique
  updateFilterAmountsDisplay();
  updateFilteredAnalytics();
}

function updateFilteredAnalytics() {
  // v1.0.7.0 : lecture dynamique des filtres par groupe (Massages/HeadSpa + custom)
  const groupesFilters = {};
  document.querySelectorAll('#filter-pills-groupes input[type="checkbox"]').forEach(cb => {
    const label = cb.closest('label');
    const groupeName = label && label.dataset.groupe ? label.dataset.groupe : null;
    if (groupeName) groupesFilters[groupeName] = cb.checked;
  });

  const filters = {
    massages: document.getElementById('filter-massages')?.checked || false,
    headspa: document.getElementById('filter-headspa')?.checked || false,
    groupes: groupesFilters,
    bonsCadeaux: document.getElementById('filter-bons-cadeaux')?.checked || false,
    tips: document.getElementById('filter-tips')?.checked || false,
    depensesHuiles: document.getElementById('filter-depenses-huiles')?.checked || false,
    depensesMateriel: document.getElementById('filter-depenses-materiel')?.checked || false,
    depensesFormation: document.getElementById('filter-depenses-formation')?.checked || false,
    depensesTransport: document.getElementById('filter-depenses-transport')?.checked || false,
    depensesMarketing: document.getElementById('filter-depenses-marketing')?.checked || false,
    depensesLoyer: document.getElementById('filter-depenses-loyer')?.checked || false,
    depensesAutre: document.getElementById('filter-depenses-autre')?.checked || false
  };
  
  const activePeriodBtn = document.querySelector('.period-btn.active');
  const period = activePeriodBtn ? 
    (activePeriodBtn.dataset.period === 'current-month' ? 'current-month' : parseInt(activePeriodBtn.dataset.period)) : 
    12;
  const selectedYear = document.getElementById('year-selector')?.value || 'current';
  
  // NOUVEAU : Utiliser aussi les filtres globaux
  const globalSelectedYear = document.getElementById('global-year-selector')?.value || selectedYear;
  const globalSelectedMonth = document.getElementById('global-month-selector')?.value || '';

  updateRevenueChart(filters, period, globalSelectedYear, globalSelectedMonth);
}

// === PALETTE HARMONISÉE ===
const CHART_PALETTE = {
  primary: '#c9956b',     // beige doré principal
  secondary: '#a07850',   // brun chaud
  accent1: '#e8c4a0',     // beige clair
  accent2: '#7c5e3c',     // brun foncé
  accent3: '#d4a574',     // beige moyen
  accent4: '#f0dcc8',     // crème
  purple: '#8b6f9e',      // violet doux
  orange: '#d4874d',      // orange chaud
  green: '#6b9e7c',       // vert sauge
  red: '#c47a6e',         // rouge doux
  blue: '#6b8ea5',        // bleu doux
  pink: '#c48b9e',        // rose poudré
  grey: '#9e9e9e'         // gris neutre
};

const CHART_DEFAULTS = {
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  animSpeed: 800,
  height: 320
};

function updateRevenueChart(filters = null, period = 12, selectedYear = 'current', selectedMonth = '') {
  const el = document.getElementById('revenue-chart');
  if (!el) return;

  if (revenueChart && typeof revenueChart.destroy === 'function') {
    revenueChart.destroy();
  }
  el.innerHTML = '';

  const chartData = Calculations.getRevenueChartData(filters, period, selectedYear, selectedMonth);

  // v1.0.7.0 : injection des series par groupe (Massages + HeadSpa restent les principaux,
  // chaque autre groupe genere automatiquement sa propre serie avec sa couleur).
  const baseSeries = [
    { name: 'Massages', data: chartData.revenues, color: CHART_PALETTE.primary },
    { name: 'HeadSpa', data: chartData.headSpaRevenues, color: CHART_PALETTE.purple }
  ];
  const extraGroupesPalette = [CHART_PALETTE.pink, CHART_PALETTE.blue, CHART_PALETTE.accent3, CHART_PALETTE.accent2, CHART_PALETTE.grey];
  const extraSeries = [];
  if (chartData.groupesRevenues && typeof window.DataManager !== 'undefined') {
    const groupes = (DataManager.getGroupesCategories ? DataManager.getGroupesCategories() : []);
    let paletteIdx = 0;
    Object.keys(chartData.groupesRevenues).forEach(name => {
      if (name === 'Massages' || name === 'HeadSpa') return;
      const meta = groupes.find(g => g.nom === name);
      const couleur = (meta && meta.couleur) ? meta.couleur : extraGroupesPalette[paletteIdx % extraGroupesPalette.length];
      paletteIdx++;
      extraSeries.push({ name: name, data: chartData.groupesRevenues[name], color: couleur });
    });
  }
  const trailingSeries = [
    { name: 'Bons Cadeaux', data: chartData.bonsCadeauxRevenues, color: CHART_PALETTE.orange },
    { name: 'Tips', data: chartData.tips, color: CHART_PALETTE.green },
    { name: 'Coûts', data: chartData.costs, color: CHART_PALETTE.red }
  ];
  const allSeries = baseSeries.concat(extraSeries).concat(trailingSeries);

  const options = {
    chart: {
      type: 'area',
      height: 360,
      fontFamily: CHART_DEFAULTS.fontFamily,
      toolbar: { show: false },
      zoom: { enabled: false },
      animations: { enabled: true, easing: 'easeinout', speed: CHART_DEFAULTS.animSpeed },
      dropShadow: { enabled: true, top: 3, left: 0, blur: 6, opacity: 0.08 }
    },
    series: allSeries.map(s => ({ name: s.name, data: s.data })),
    colors: allSeries.map(s => s.color),
    fill: {
      type: 'gradient',
      gradient: { shadeIntensity: 1, opacityFrom: 0.35, opacityTo: 0.02, stops: [0, 85, 100] }
    },
    stroke: { curve: 'smooth', width: 2.5 },
    markers: { size: 4, strokeWidth: 2, strokeColors: '#fff', hover: { sizeOffset: 3 } },
    xaxis: {
      categories: chartData.months,
      labels: { style: { fontSize: '11px', fontWeight: 500, colors: '#888' } },
      axisBorder: { show: false },
      axisTicks: { show: false }
    },
    yaxis: {
      labels: {
        formatter: function(val) { return val.toFixed(0) + ' \u20ac'; },
        style: { fontSize: '11px', fontWeight: 500, colors: ['#888'] }
      }
    },
    grid: { borderColor: '#f0f0f0', strokeDashArray: 3, padding: { left: 10, right: 10 } },
    legend: {
      position: 'bottom', fontSize: '12px', fontWeight: 600,
      markers: { size: 6, shape: 'circle', offsetX: -4 },
      itemMargin: { horizontal: 14, vertical: 6 }
    },
    tooltip: {
      shared: true,
      intersect: false,
      style: { fontSize: '12px' },
      y: { formatter: function(val) { return val.toFixed(2) + ' \u20ac'; } }
    },
    dataLabels: { enabled: false }
  };

  revenueChart = new ApexCharts(el, options);
  revenueChart.render();
}

function updatePrestationsChart(selectedYear = 'current', selectedMonth = '') {
  const el = document.getElementById('prestations-chart');
  if (!el) return;

  if (prestationsChart && typeof prestationsChart.destroy === 'function') {
    prestationsChart.destroy();
  }
  el.innerHTML = '';

  const chartData = Calculations.getPrestationsTypeChart(selectedYear, selectedMonth);
  const total = chartData.data.reduce((a, b) => a + b, 0);

  // Trier par valeur décroissante, filtrer les catégories vides sauf si total = 0
  const sorted = chartData.labels.map((label, i) => ({ label, value: chartData.data[i] }))
    .sort((a, b) => b.value - a.value);

  // Garder les catégories avec des prestations + les vides pour montrer la carte
  const hasData = sorted.some(s => s.value > 0);
  const displayed = hasData ? sorted : sorted.filter((s, i) => i < 6); // Max 6 si tout est vide

  if (displayed.length === 0) return;

  const barColors = [CHART_PALETTE.primary, CHART_PALETTE.purple, CHART_PALETTE.orange, CHART_PALETTE.blue, CHART_PALETTE.green, CHART_PALETTE.pink, CHART_PALETTE.secondary, CHART_PALETTE.accent2];
  const details = chartData.details || {};

  // Labels dans l'axe Y : "Massage Signature · 152"
  const categoriesWithValues = displayed.map(s => s.label + '  \u00b7  ' + s.value);

  prestationsChart = new ApexCharts(el, {
    chart: {
      type: 'bar',
      height: Math.max(CHART_DEFAULTS.height, displayed.length * 42 + 30),
      fontFamily: CHART_DEFAULTS.fontFamily,
      toolbar: { show: false },
      animations: { enabled: true, speed: CHART_DEFAULTS.animSpeed }
    },
    series: [{ name: 'Prestations', data: displayed.map(s => s.value) }],
    colors: barColors,
    plotOptions: {
      bar: {
        horizontal: true,
        borderRadius: 6,
        barHeight: '55%',
        distributed: true
      }
    },
    xaxis: {
      categories: categoriesWithValues,
      labels: { show: false },
      axisBorder: { show: false },
      axisTicks: { show: false }
    },
    yaxis: {
      labels: {
        style: { fontSize: '11px', fontWeight: 600, colors: ['#555'] },
        maxWidth: 250
      }
    },
    grid: { borderColor: '#f0f0f0', strokeDashArray: 3, xaxis: { lines: { show: false } }, yaxis: { lines: { show: false } } },
    legend: { show: false },
    tooltip: {
      custom: function({ series, seriesIndex, dataPointIndex, w }) {
        const item = displayed[dataPointIndex];
        const pct = total > 0 ? ((item.value / total) * 100).toFixed(1) : 0;
        let html = '<div style="padding: 8px 12px; font-size: 12px;">' +
          '<strong>' + item.label + '</strong> \u2014 ' + item.value + ' prestation' + (item.value > 1 ? 's' : '') + ' (' + pct + '%)';
        // Détail des soins dans cette catégorie
        const catDetails = details[item.label];
        if (catDetails && Object.keys(catDetails).length > 0) {
          html += '<br><span style="color: #999; font-size: 11px;">';
          const detailLines = Object.entries(catDetails)
            .sort((a, b) => b[1] - a[1])
            .map(([nom, count]) => nom + ' : ' + count);
          html += detailLines.join('<br>');
          html += '</span>';
        }
        html += '</div>';
        return html;
      }
    },
    dataLabels: { enabled: false }
  });
  prestationsChart.render();
}

function updateDureesChart(selectedYear = 'current', selectedMonth = '') {
  const el = document.getElementById('durees-chart');
  if (!el) return;

  if (dureesChart && typeof dureesChart.destroy === 'function') {
    dureesChart.destroy();
  }
  el.innerHTML = '';

  const chartData = Calculations.getDureesChart(selectedYear, selectedMonth);
  if (!chartData.data || chartData.data.length === 0) return;

  // Trier par valeur décroissante
  const sorted = chartData.labels.map((label, i) => ({ label, value: chartData.data[i] }))
    .sort((a, b) => b.value - a.value);

  const dureeColors = [CHART_PALETTE.primary, CHART_PALETTE.secondary, CHART_PALETTE.accent1, CHART_PALETTE.orange, CHART_PALETTE.green, CHART_PALETTE.blue, CHART_PALETTE.purple, CHART_PALETTE.pink];

  // Labels dans l'axe Y : "60 min · 103"
  const categoriesWithValues = sorted.map(s => s.label + '  \u00b7  ' + s.value);

  dureesChart = new ApexCharts(el, {
    chart: {
      type: 'bar',
      height: Math.max(CHART_DEFAULTS.height, sorted.length * 42 + 30),
      fontFamily: CHART_DEFAULTS.fontFamily,
      toolbar: { show: false },
      animations: { enabled: true, speed: CHART_DEFAULTS.animSpeed }
    },
    series: [{ name: 'S\u00e9ances', data: sorted.map(s => s.value) }],
    colors: dureeColors,
    plotOptions: {
      bar: {
        horizontal: true,
        borderRadius: 6,
        barHeight: '55%',
        distributed: true
      }
    },
    xaxis: {
      categories: categoriesWithValues,
      labels: { show: false },
      axisBorder: { show: false },
      axisTicks: { show: false }
    },
    yaxis: {
      labels: {
        style: { fontSize: '11px', fontWeight: 600, colors: ['#555'] },
        maxWidth: 160
      }
    },
    grid: { borderColor: '#f0f0f0', strokeDashArray: 3, xaxis: { lines: { show: false } }, yaxis: { lines: { show: false } } },
    legend: { show: false },
    tooltip: {
      y: { formatter: function(val) { return val + ' s\u00e9ance' + (val > 1 ? 's' : ''); } }
    },
    dataLabels: { enabled: false }
  });
  dureesChart.render();
}

function updateKeyStats(selectedYear = 'current', selectedMonth = '') {
  const container = document.getElementById('key-stats');
  if (!container) return;
  
  const stats = Calculations.calculateKeyStats(selectedYear, selectedMonth);
  
  // DÉTERMINER LE TEXTE DE LA PÉRIODE
  const isFiltered = selectedYear !== 'current' || selectedMonth !== '';
  const periodText = isFiltered ? 
    (selectedMonth !== '' ? `${getMonthName(selectedMonth)} ${selectedYear}` : selectedYear) :
    'Cette année';
  
  // TOTAL CLIENTS DYNAMIQUE
  const totalClientsText = isFiltered ? 
    `${stats.filteredClientsCount} clients (période)` : // NOUVEAU : stats.filteredClientsCount
    `${stats.totalClients} clients`;
  
  // PIC D'ACTIVITÉ CONDITIONNEL
  const picActiviteText = isFiltered && selectedMonth !== '' ? '-' : stats.picMois;
  
  container.innerHTML = `
    <div class="stat-item">
      <span class="stat-label">Taux de retour clients</span>
      <span class="stat-value">${stats.tauxRetour.toFixed(1)}%</span>
    </div>
    <div class="stat-item">
      <span class="stat-label">Durée moyenne des séances</span>
      <span class="stat-value">${stats.dureeMoyenne.toFixed(0)} min</span>
    </div>
    <div class="stat-item">
      <span class="stat-label">Pic d'activité mensuel</span>
      <span class="stat-value">${picActiviteText}</span>
    </div>
    <div class="stat-item">
      <span class="stat-label">${totalClientsText}</span>
      <span class="stat-value">${isFiltered ? stats.filteredClientsCount : stats.totalClients}</span>
    </div>
    <div class="stat-item">
      <span class="stat-label">Total prospects</span>
      <span class="stat-value">${stats.totalProspects}</span>
    </div>
  `;
  
  // METTRE À JOUR LE TEXTE DE LA PÉRIODE DANS LE HEADER
  const statsHeader = document.querySelector('.stats-period');
  if (statsHeader) {
    statsHeader.textContent = periodText;
  }
}

function getMonthName(monthNumber) {
  const months = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 
                  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
  return months[parseInt(monthNumber) - 1] || '';
}

// ===== AFFICHAGE PRESTATION DEPUIS DÉPENSE =====
function showPrestationFromDepense(prestationId) {
  const prestation = DataManager.getPrestationById(prestationId);
  if (!prestation) {
    showCustomAlert('❌ Prestation introuvable (peut-être supprimée)', 'error');
    return;
  }
  
  const appData = DataManager.getAppData();
  const client = appData.clients.find(c => c.id === prestation.clientId);
  // Gestion partenariats
  const isPartnership = DataManager.isPartnershipSoin(prestation.soinId || prestation.type);
  const clientNom = isPartnership ? DataManager.getDisplayNameForType(prestation.soinId || prestation.type) : (client ? `${client.prenom} ${client.nom}` : 'Client inconnu');

  // Calcul de la marge
  const prix = prestation.prix || 0;
  const fraisDeplacement = prestation.fraisDeplacement || 0;
  const marge = prix - fraisDeplacement;
  const margeStyle = marge >= 0 ? 'color: var(--beige-dore); font-weight: 600;' : 'color: #e74c3c; font-weight: 600;';

  // Affichage des frais de déplacement
  const fraisHtml = prestation.adresseMassage ? `
    <p><strong>📍 Adresse massage:</strong> ${prestation.adresseMassage}</p>
    ${prestation.distanceKm > 0 ? `
      <p><strong>📏 Distance:</strong> ${prestation.distanceKm} km (A/R)</p>
      <p><strong>💰 Frais déplacement:</strong> ${fraisDeplacement.toFixed(2)} €</p>
      <p><strong>💵 Marge nette:</strong> <span style="${margeStyle}">${marge.toFixed(2)} €</span></p>
    ` : ''}
  ` : '<p><strong>📍 Lieu:</strong> Salon (pas de frais)</p>';
  
  const modalHTML = `
    <h3>🔗 Prestation liée à cette dépense transport</h3>
    <div style="margin: 1rem 0; padding: 1rem; background: #e8f5e8; border-radius: 8px; border-left: 4px solid var(--beige-dore);">
      <p><strong>👤 Client:</strong> ${clientNom}</p>
      <p><strong>📅 Date:</strong> ${DataManager.formatDate(prestation.date)} à ${prestation.heure}</p>
      <p><strong>💆‍♀️ Type:</strong> ${DataManager.getDisplayNameForType(prestation.soinId || prestation.type)}</p>
      <p><strong>⏱️ Durée:</strong> ${prestation.duree || 60} minutes</p>
      <p><strong>💶 Prix facturé:</strong> ${prix.toFixed(2)} €</p>
      ${fraisHtml}
      ${prestation.notes ? `<p><strong>📝 Notes:</strong> ${prestation.notes}</p>` : ''}
      
      <div style="margin-top: 1rem; padding: 0.75rem; background: #fff3cd; border-radius: 6px; border: 1px solid #ffeaa7;">
        <strong>ℹ️ Info:</strong> Cette dépense transport a été générée automatiquement lors de la création/migration de cette prestation.
      </div>
    </div>
    <div class="rdv-actions">
      <button class="btn-secondary" onclick="editPrestation('${prestation.id}')">✏️ Modifier la prestation</button>
      <button class="btn-primary" onclick="ClientServices.showClientDetails('${prestation.clientId}')">👤 Voir le client</button>
    </div>
    <div class="modal-actions" style="margin-top: 1rem;">
      <button type="button" class="btn-secondary" onclick="closeModal()">Fermer</button>
    </div>
  `;
  
  ModalManager.showModal('rdv-modal', modalHTML);
}

// ===== MESSAGES ET ALERTES PERSONNALISÉES =====

function showCustomAlert(message, type = 'info') {
  return new Promise((resolve) => {
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
    `;
    
    const modal = document.createElement('div');
    modal.style.cssText = `
      background: white;
      padding: 2rem;
      border-radius: 12px;
      box-shadow: 0 8px 32px rgba(0,0,0,0.3);
      max-width: 500px;
      width: 90%;
      text-align: center;
    `;
    
    const iconMap = {
      success: '✅',
      error: '❌',
      warning: '⚠️',
      info: 'ℹ️'
    };
    
    const colorMap = {
      success: '#27ae60',
      error: '#e74c3c',
      warning: '#f39c12',
      info: '#3498db'
    };
    
    modal.innerHTML = `
      <div style="font-size: 3rem; margin-bottom: 1rem;">${iconMap[type] || iconMap.info}</div>
      <h3 style="margin: 0 0 1rem 0; color: ${colorMap[type] || colorMap.info};">
        ${type === 'success' ? 'Succès' : type === 'error' ? 'Erreur' : type === 'warning' ? 'Attention' : 'Information'}
      </h3>
      <div style="margin: 0 0 2rem 0; color: #666; line-height: 1.5; white-space: pre-line;">${message}</div>
      <div style="display: flex; justify-content: center;">
        <button id="custom-ok" class="btn-primary">OK</button>
      </div>
    `;
    
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    
    document.getElementById('custom-ok').onclick = () => {
      overlay.remove();
      resolve();
    };
    
    overlay.onclick = (e) => {
      if (e.target === overlay) {
        overlay.remove();
        resolve();
      }
    };
  });
}

function showCustomConfirm(message) {
  return new Promise((resolve) => {
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
    `;
    
    const modal = document.createElement('div');
    modal.style.cssText = `
      background: white;
      padding: 2rem;
      border-radius: 12px;
      box-shadow: 0 8px 32px rgba(0,0,0,0.3);
      max-width: 500px;
      width: 90%;
      text-align: center;
    `;
    
    modal.innerHTML = `
      <div style="font-size: 3rem; margin-bottom: 1rem;">❓</div>
      <h3 style="margin: 0 0 1rem 0; color: #f39c12;">Confirmation</h3>
      <div style="margin: 0 0 2rem 0; color: #666; line-height: 1.5;">${message}</div>
      <div style="display: flex; justify-content: center; gap: 1rem;">
        <button id="custom-cancel" class="btn-secondary">Annuler</button>
        <button id="custom-confirm" class="btn-primary">Confirmer</button>
      </div>
    `;
    
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    
    document.getElementById('custom-confirm').onclick = () => {
      overlay.remove();
      resolve(true);
    };
    
    document.getElementById('custom-cancel').onclick = () => {
      overlay.remove();
      resolve(false);
    };
    
    overlay.onclick = (e) => {
      if (e.target === overlay) {
        overlay.remove();
        resolve(false);
      }
    };
  });
}

function showTemporaryMessage(message, type = 'success') {
  const messageDiv = document.createElement('div');
  
  const colorMap = {
    success: 'var(--beige-dore)',
    error: '#e74c3c',
    warning: '#f39c12',
    info: '#3498db'
  };
  
  messageDiv.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: ${colorMap[type] || colorMap.success};
    color: white;
    padding: 1rem 2rem;
    border-radius: 8px;
    z-index: 9999;
    font-weight: 600;
    box-shadow: 0 4px 8px rgba(0,0,0,0.2);
    animation: slideIn 0.3s ease;
    max-width: 300px;
  `;
  messageDiv.textContent = message;
  
  const style = document.createElement('style');
  style.textContent = `
    @keyframes slideIn {
      from { transform: translateX(100%); opacity: 0; }
      to { transform: translateX(0); opacity: 1; }
    }
  `;
  document.head.appendChild(style);
  
  document.body.appendChild(messageDiv);
  
  setTimeout(() => {
    messageDiv.style.animation = 'slideIn 0.3s ease reverse';
    setTimeout(() => {
      messageDiv.remove();
      style.remove();
    }, 300);
  }, 3000);
}

// ===== VALIDATION AVANCÉE =====

function validateFormData(formData, requiredFields) {
  const errors = [];
  
  requiredFields.forEach(field => {
    if (!formData[field] || (typeof formData[field] === 'string' && formData[field].trim() === '')) {
      errors.push(`Le champ "${field}" est requis`);
    }
  });
  
  // Validation email
  if (formData.email && formData.email.trim() !== '') {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      errors.push('Format email invalide');
    }
  }
  
  // Validation téléphone
  if (formData.telephone && formData.telephone.trim() !== '') {
    const phoneRegex = /^[0-9\s\-\+\(\)\.]{8,}$/;
    if (!phoneRegex.test(formData.telephone)) {
      errors.push('Format téléphone invalide');
    }
  }
  
  // Validation prix/montant
  if (formData.prix !== undefined || formData.montant !== undefined) {
    const amount = formData.prix || formData.montant;
    if (amount < 0) {
      errors.push('Le montant ne peut pas être négatif');
    }
  }
  
  return errors;
}

// ===== RECHERCHE AVANCÉE =====

function performGlobalSearch(query) {
  const appData = DataManager.getAppData();
  const results = {
    clients: [],
    prospects: [],
    rdv: [],
    prestations: [],
    depenses: []
  };
  
  const searchTerm = query.toLowerCase().trim();
  
  // Recherche dans les clients
  results.clients = appData.clients.filter(client => 
    client.nom.toLowerCase().includes(searchTerm) ||
    client.prenom.toLowerCase().includes(searchTerm) ||
    (client.societe && client.societe.toLowerCase().includes(searchTerm)) ||
    (client.email && client.email.toLowerCase().includes(searchTerm))
  );
  
  // Recherche dans les prospects
  results.prospects = appData.prospects.filter(prospect => 
    prospect.nom.toLowerCase().includes(searchTerm) ||
    prospect.prenom.toLowerCase().includes(searchTerm) ||
    (prospect.societe && prospect.societe.toLowerCase().includes(searchTerm))
  );
  
  // Recherche dans les RDV
  results.rdv = appData.rdv.filter(rdv => {
    const client = appData.clients.find(c => c.id === rdv.clientId);
    const clientName = client ? `${client.prenom} ${client.nom}` : '';
    return clientName.toLowerCase().includes(searchTerm) ||
           rdv.type.toLowerCase().includes(searchTerm) ||
           (rdv.notes && rdv.notes.toLowerCase().includes(searchTerm));
  });
  
  // Recherche dans les prestations
  results.prestations = appData.prestations.filter(prestation => {
    const client = appData.clients.find(c => c.id === prestation.clientId);
    const clientName = client ? `${client.prenom} ${client.nom}` : '';
    return clientName.toLowerCase().includes(searchTerm) ||
           prestation.type.toLowerCase().includes(searchTerm) ||
           (prestation.notes && prestation.notes.toLowerCase().includes(searchTerm));
  });
  
  // Recherche dans les dépenses
  if (appData.depenses) {
    results.depenses = appData.depenses.filter(depense => 
      (depense.description && depense.description.toLowerCase().includes(searchTerm)) ||
      (depense.fournisseur && depense.fournisseur.toLowerCase().includes(searchTerm)) ||
      (depense.categorie && depense.categorie.toLowerCase().includes(searchTerm))
    );
  }
  
  return results;
}

// ===== STATISTIQUES AVANCÉES =====

function generateBusinessReport() {
  const appData = DataManager.getAppData();
  const now = new Date();
  const currentYear = now.getFullYear();
  
  // Calculs avancés
  const prestationsAnnee = appData.prestations.filter(p =>
    new Date(p.date).getFullYear() === currentYear
  );

  // Revenus prestations (hors bons cadeaux utilisés)
  const prestationsClassiques = prestationsAnnee.filter(p => p.moyenPaiement !== 'Bon cadeau' && !p.bonCadeauId);
  const revenusPrestations = prestationsClassiques.reduce((sum, p) => sum + (p.prix || 0), 0);

  // Revenus bons cadeaux vendus cette année
  const bonsCadeauxAnnee = (appData.bonsCadeaux || []).filter(bon =>
    new Date(bon.dateAchat).getFullYear() === currentYear && bon.statut !== 'rembourse'
  );
  const revenusBonsCadeaux = bonsCadeauxAnnee.reduce((sum, bon) => sum + (bon.montant || 0), 0);

  const revenusTotal = revenusPrestations + revenusBonsCadeaux;
  const coutsTotal = appData.depenses ?
    appData.depenses.filter(d => new Date(d.date).getFullYear() === currentYear)
                    .reduce((sum, d) => sum + (d.montant || 0), 0) : 0;

  const margeAnnuelle = revenusTotal - coutsTotal;
  const tauxMargeAnnuel = revenusTotal > 0 ? (margeAnnuelle / revenusTotal * 100) : 0;

  // Client le plus rentable (prestations classiques uniquement)
  const clientsRevenus = {};
  prestationsClassiques.forEach(p => {
    clientsRevenus[p.clientId] = (clientsRevenus[p.clientId] || 0) + (p.prix || 0);
  });

  const topClientId = Object.keys(clientsRevenus).length > 0
    ? Object.keys(clientsRevenus).reduce((a, b) => clientsRevenus[a] > clientsRevenus[b] ? a : b)
    : null;
  const topClient = topClientId ? appData.clients.find(c => c.id === topClientId) : null;

  // Évolution mensuelle (prestations + bons cadeaux)
  const evolution = {};
  prestationsClassiques.forEach(p => {
    const mois = new Date(p.date).getMonth();
    evolution[mois] = (evolution[mois] || 0) + (p.prix || 0);
  });
  bonsCadeauxAnnee.forEach(bon => {
    const mois = new Date(bon.dateAchat).getMonth();
    evolution[mois] = (evolution[mois] || 0) + (bon.montant || 0);
  });
  
  return {
    periode: `Année ${currentYear}`,
    revenusTotal,
    coutsTotal,
    margeAnnuelle,
    tauxMargeAnnuel,
    nbPrestations: prestationsAnnee.length,
    nbClients: appData.clients.length,
    topClient: topClient ? `${topClient.prenom} ${topClient.nom}` : 'N/A',
    topClientRevenus: topClientId ? clientsRevenus[topClientId] : 0,
    evolution
  };
}

function updateMoyensPaiementChart(selectedYear = 'current', selectedMonth = '') {
  const el = document.getElementById('moyens-paiement-chart');
  if (!el) return;

  if (window.moyensPaiementChart && typeof window.moyensPaiementChart.destroy === 'function') {
    window.moyensPaiementChart.destroy();
  }
  el.innerHTML = '';

  const chartData = getMoyensPaiementChartData(selectedYear, selectedMonth);

  // Calculer les totaux
  const totalPaiements = chartData.data.reduce((sum, count) => sum + count, 0);
  const totalMontant = chartData.montants.reduce((sum, montant) => sum + montant, 0);

  // Mettre à jour les stats avec le montant total
  const statsElement = document.querySelector('.total-paiements');
  if (statsElement) {
    statsElement.textContent = `${totalPaiements} paiement${totalPaiements > 1 ? 's' : ''} • ${totalMontant.toFixed(2)} €`;
  }

  const montantsParLabel = chartData.montantsParLabel;
  if (totalPaiements === 0) return;

  // Trier par montant décroissant
  const sorted = chartData.labels.map((label, i) => ({
    label, count: chartData.data[i], montant: chartData.montants[i]
  })).sort((a, b) => b.montant - a.montant);

  const barColors = [CHART_PALETTE.primary, CHART_PALETTE.secondary, CHART_PALETTE.orange, CHART_PALETTE.green, CHART_PALETTE.blue, CHART_PALETTE.purple, CHART_PALETTE.pink, CHART_PALETTE.accent2, CHART_PALETTE.accent1];

  // Labels dans l'axe Y : "Liquide · 10 621 €"
  const categoriesWithValues = sorted.map(s => s.label + '  \u00b7  ' + s.montant.toFixed(0) + ' \u20ac');

  window.moyensPaiementChart = new ApexCharts(el, {
    chart: {
      type: 'bar',
      height: Math.max(CHART_DEFAULTS.height, sorted.length * 42 + 30),
      fontFamily: CHART_DEFAULTS.fontFamily,
      toolbar: { show: false },
      animations: { enabled: true, speed: CHART_DEFAULTS.animSpeed }
    },
    series: [{ name: 'Montant', data: sorted.map(s => parseFloat(s.montant.toFixed(2))) }],
    colors: barColors,
    plotOptions: {
      bar: {
        horizontal: true,
        borderRadius: 6,
        barHeight: '55%',
        distributed: true
      }
    },
    xaxis: {
      categories: categoriesWithValues,
      labels: { show: false },
      axisBorder: { show: false },
      axisTicks: { show: false }
    },
    yaxis: {
      labels: {
        style: { fontSize: '11px', fontWeight: 600, colors: ['#555'] },
        maxWidth: 250
      }
    },
    grid: { borderColor: '#f0f0f0', strokeDashArray: 3, xaxis: { lines: { show: false } }, yaxis: { lines: { show: false } } },
    legend: { show: false },
    tooltip: {
      custom: function({ series, seriesIndex, dataPointIndex, w }) {
        const item = sorted[dataPointIndex];
        const pct = totalMontant > 0 ? ((item.montant / totalMontant) * 100).toFixed(1) : 0;
        return '<div style="padding: 8px 12px; font-size: 12px;">' +
          '<strong>' + item.label + '</strong><br>' +
          item.count + ' paiement' + (item.count > 1 ? 's' : '') + '<br>' +
          item.montant.toFixed(2) + ' \u20ac (' + pct + '%)</div>';
      }
    },
    dataLabels: { enabled: false }
  });
  window.moyensPaiementChart.render();
}

function getMoyensPaiementChartData(selectedYear = 'current', selectedMonth = '') {
  const appData = DataManager.getAppData();

  // Filtrage des prestations par année/mois
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

  // Filtrage des bons cadeaux par année/mois (date d'achat)
  const bonsCadeauxFiltered = (appData.bonsCadeaux || []).filter(b => {
    const date = new Date(b.dateAchat);
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

  const moyensCounts = {};
  const moyensMontants = {};

  // Comptabiliser les prestations (hors "Bon cadeau" car c'est une utilisation, pas un paiement)
  prestationsFiltered.forEach(p => {
    // Ignorer les prestations payées par bon cadeau (le revenu vient de la vente du bon)
    if (p.moyenPaiement === 'Bon cadeau' || p.bonCadeauId) {
      return;
    }
    const moyen = p.moyenPaiement || 'Non renseigné';
    moyensCounts[moyen] = (moyensCounts[moyen] || 0) + 1;
    moyensMontants[moyen] = (moyensMontants[moyen] || 0) + (parseFloat(p.prix) || 0);
  });

  // Comptabiliser les bons cadeaux vendus (séparés par moyen de paiement)
  bonsCadeauxFiltered.forEach(b => {
    const moyenBon = b.moyenPaiement || 'Non renseigné';
    const labelBon = `Bon cadeau (${moyenBon})`;
    moyensCounts[labelBon] = (moyensCounts[labelBon] || 0) + 1;
    moyensMontants[labelBon] = (moyensMontants[labelBon] || 0) + (parseFloat(b.montant) || 0);
  });

  return {
    labels: Object.keys(moyensCounts),
    data: Object.values(moyensCounts),
    montants: Object.values(moyensMontants),
    montantsParLabel: moyensMontants
  };
}

// ===== ✅ NOUVEAU : GRAPHIQUE CANAUX D'ACQUISITION =====
function updateCanalsChart(selectedYear = 'current', selectedMonth = '') {
  const el = document.getElementById('canaux-chart');
  if (!el) return;

  if (window.canauxChart && typeof window.canauxChart.destroy === 'function') {
    window.canauxChart.destroy();
  }
  el.innerHTML = '';

  const chartData = getCanauxChartData(selectedYear, selectedMonth);

  // Mettre à jour les stats affichées
  const totalCanaux = chartData.labels.length;
  const totalClients = chartData.data.reduce((sum, count) => sum + count, 0);
  const statsElement = document.querySelector('.total-canaux');
  if (statsElement) {
    statsElement.textContent = `${totalCanaux} ${totalCanaux > 1 ? 'canaux' : 'canal'} • ${totalClients} client${totalClients > 1 ? 's' : ''}`;
  }

  if (totalClients === 0) return;

  // Trier par valeur décroissante
  const sorted = chartData.labels.map((label, i) => ({ label, value: chartData.data[i] }))
    .sort((a, b) => b.value - a.value);

  const canauxColors = [CHART_PALETTE.primary, CHART_PALETTE.secondary, CHART_PALETTE.orange, CHART_PALETTE.green, CHART_PALETTE.blue, CHART_PALETTE.purple, CHART_PALETTE.pink, CHART_PALETTE.accent2];

  // Labels dans l'axe Y : "Google Ads · 40"
  const categoriesWithValues = sorted.map(s => s.label + '  \u00b7  ' + s.value);

  const options = {
    chart: {
      type: 'bar',
      height: Math.max(CHART_DEFAULTS.height, sorted.length * 42 + 30),
      fontFamily: CHART_DEFAULTS.fontFamily,
      toolbar: { show: false },
      animations: { enabled: true, speed: CHART_DEFAULTS.animSpeed }
    },
    series: [{ name: 'Clients', data: sorted.map(s => s.value) }],
    colors: canauxColors,
    plotOptions: {
      bar: {
        horizontal: true,
        borderRadius: 6,
        barHeight: '55%',
        distributed: true
      }
    },
    xaxis: {
      categories: categoriesWithValues,
      labels: { show: false },
      axisBorder: { show: false },
      axisTicks: { show: false }
    },
    yaxis: {
      labels: {
        style: { fontSize: '11px', fontWeight: 600, colors: ['#555'] },
        maxWidth: 250
      }
    },
    grid: { borderColor: '#f0f0f0', strokeDashArray: 3, xaxis: { lines: { show: false } }, yaxis: { lines: { show: false } } },
    legend: { show: false },
    tooltip: {
      y: {
        formatter: function(val) {
          const pct = totalClients > 0 ? ((val / totalClients) * 100).toFixed(1) : 0;
          return val + ' client' + (val > 1 ? 's' : '') + ' (' + pct + '%)';
        }
      }
    },
    dataLabels: { enabled: false }
  };

  window.canauxChart = new ApexCharts(el, options);
  window.canauxChart.render();
}

function getCanauxChartData(selectedYear = 'current', selectedMonth = '') {
  // AJOUTEZ LE CODE DE FILTRAGE COMME DANS VOTRE updateAllAnalyticsCharts ligne 275-285
  const appData = DataManager.getAppData();
  const labels = [];
  const data = [];
  
  let clientsFiltered = appData.clients;
  if (selectedYear !== 'current' || selectedMonth !== '') {
    clientsFiltered = appData.clients.filter(client => {
      const clientPrestations = appData.prestations.filter(p => p.clientId === client.id);
      return clientPrestations.some(p => {
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
    });
  }
  
  const canalCounts = {};
  clientsFiltered.forEach(client => {
    const canal = client.canalAcquisition || 'non-renseigne';
    canalCounts[canal] = (canalCounts[canal] || 0) + 1;
  });
  
  const canaux = ClientServices.getAvailableCanaux();
  canaux.forEach(canal => {
    if (canalCounts[canal.id] > 0) {
      labels.push(canal.label);
      data.push(canalCounts[canal.id]);
    }
  });
  
  return { labels, data };
}

// Fonction de recherche et filtrage des dépenses
function setupDepensesSearch() {
  const searchInput = document.getElementById('depenses-search');
  const clearBtn = document.getElementById('clear-depenses-search');
  const resultCount = document.getElementById('depenses-results-count');
  
  if (!searchInput) return;
  
  searchInput.addEventListener('input', (e) => {
    const query = e.target.value.toLowerCase().trim();
    
    if (query === '') {
      clearBtn.style.display = 'none';
      resultCount.textContent = '';
      applyDepensesFilters(); // Appliquer juste les autres filtres
      return;
    }
    
    clearBtn.style.display = 'block';
    applyDepensesFilters();
  });
  
  clearBtn.addEventListener('click', () => {
    searchInput.value = '';
    clearBtn.style.display = 'none';
    resultCount.textContent = '';
    applyDepensesFilters();
    searchInput.focus();
  });
  
  // Event listeners pour les filtres
  const filters = ['depenses-filter-categorie', 'depenses-filter-periode', 'depenses-filter-montant'];
  filters.forEach(filterId => {
    const filter = document.getElementById(filterId);
    if (filter) {
      filter.addEventListener('change', applyDepensesFilters);
    }
  });
  
  // Bouton reset
  const resetBtn = document.getElementById('reset-depenses-filters');
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      searchInput.value = '';
      clearBtn.style.display = 'none';
      filters.forEach(filterId => {
        const filter = document.getElementById(filterId);
        if (filter) filter.value = '';
      });
      resultCount.textContent = '';
      ViewManager.updateDepensesDisplay();
    });
  }
}

function applyDepensesFilters() {
  const appData = DataManager.getAppData();
  if (!appData.depenses) return;
  
  const searchQuery = document.getElementById('depenses-search')?.value.toLowerCase().trim() || '';
  const categorieFilter = document.getElementById('depenses-filter-categorie')?.value || '';
  const periodeFilter = document.getElementById('depenses-filter-periode')?.value || '';
  const montantFilter = document.getElementById('depenses-filter-montant')?.value || '';
  
  let filteredDepenses = appData.depenses.filter(depense => {
    // Recherche textuelle
    if (searchQuery) {
      const matchesSearch = 
        (depense.description && depense.description.toLowerCase().includes(searchQuery)) ||
        (depense.fournisseur && depense.fournisseur.toLowerCase().includes(searchQuery)) ||
        (depense.categorie && depense.categorie.toLowerCase().includes(searchQuery)) ||
        (depense.notes && depense.notes.toLowerCase().includes(searchQuery)) ||
        depense.montant.toString().includes(searchQuery);
      
      if (!matchesSearch) return false;
    }
    
    // Filtre catégorie
    if (categorieFilter && depense.categorie !== categorieFilter) {
      return false;
    }
    
    // Filtre période
    if (periodeFilter) {
      const depenseDate = new Date(depense.date);
      const today = new Date();
      const currentMonth = today.getMonth();
      const currentYear = today.getFullYear();
      
      switch (periodeFilter) {
        case 'ce-mois':
          if (depenseDate.getMonth() !== currentMonth || depenseDate.getFullYear() !== currentYear) {
            return false;
          }
          break;
        case 'mois-dernier':
          const lastMonth = new Date(currentYear, currentMonth - 1);
          if (depenseDate.getMonth() !== lastMonth.getMonth() || depenseDate.getFullYear() !== lastMonth.getFullYear()) {
            return false;
          }
          break;
        case '3-mois':
          const threeMonthsAgo = new Date(currentYear, currentMonth - 3);
          if (depenseDate < threeMonthsAgo) {
            return false;
          }
          break;
        case 'cette-annee':
          if (depenseDate.getFullYear() !== currentYear) {
            return false;
          }
          break;
      }
    }
    
    // Filtre montant
    if (montantFilter) {
      const montant = depense.montant || 0;
      switch (montantFilter) {
        case '0-50':
          if (montant < 0 || montant > 50) return false;
          break;
        case '50-100':
          if (montant < 50 || montant > 100) return false;
          break;
        case '100-200':
          if (montant < 100 || montant > 200) return false;
          break;
        case '200+':
          if (montant < 200) return false;
          break;
      }
    }
    
    return true;
  });
  
  // Afficher les résultats filtrés
  displayFilteredDepenses(filteredDepenses);

  // Mettre a jour le resume avec les depenses filtrees
  updateDepensesResumeFiltered(filteredDepenses);

  // Mettre à jour le compteur
  const resultCount = document.getElementById('depenses-results-count');
  if (resultCount) {
    if (filteredDepenses.length !== appData.depenses.length) {
      resultCount.innerHTML = `<span style="color: var(--beige-dore);">📊 ${filteredDepenses.length} résultat${filteredDepenses.length > 1 ? 's' : ''} trouvé${filteredDepenses.length > 1 ? 's' : ''}</span>`;
    } else {
      resultCount.textContent = '';
    }
  }
}

function updateDepensesResumeFiltered(filteredDepenses) {
  const container = document.getElementById('depenses-resume');
  if (!container) return;

  const total = filteredDepenses.reduce((sum, d) => sum + (d.montant || 0), 0);

  const parCategorie = {};
  filteredDepenses.forEach(dep => {
    const cat = dep.categorie || 'Autre';
    parCategorie[cat] = (parCategorie[cat] || 0) + (dep.montant || 0);
  });

  container.innerHTML = `
    <div class="resume-total">
      <strong>Total des d\u00e9penses: ${total.toFixed(2)}\u20ac</strong>
    </div>
    <div class="resume-categories">
      ${Object.entries(parCategorie).map(([cat, montant]) =>
        `<div class="resume-item">${cat}: ${montant.toFixed(2)}\u20ac</div>`
      ).join('')}
    </div>
  `;
}

function displayFilteredDepenses(depenses) {
  const tbody = document.querySelector('#depenses-table tbody');
  if (!tbody) return;
  
  if (depenses.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 2rem; color: var(--text-light);">Aucune dépense trouvée</td></tr>';
    return;
  }
  
  // Trier par date décroissante
  depenses.sort((a, b) => new Date(b.date) - new Date(a.date));
  
  tbody.innerHTML = depenses.map(depense => `
    <tr>
      <td>${DataManager.formatDate(depense.date)}</td>
      <td><span class="categorie-badge categorie-${depense.categorie ? depense.categorie.toLowerCase().replace(/\s+/g, '-') : ''}">${depense.categorie || 'Non définie'}</span></td>
      <td>${depense.description}</td>
      <td>${depense.fournisseur || '-'}</td>
      <td style="text-align: right; font-weight: 600; color: var(--beige-dore);">${depense.montant.toFixed(2)} €</td>
      <td style="max-width: 200px; overflow: hidden; text-overflow: ellipsis;" title="${depense.notes || ''}">${depense.notes || '-'}</td>
      <td style="text-align: center;">
        <button class="btn-secondary" onclick="FormManager.editDepense('${depense.id}')" style="padding: 0.25rem 0.5rem; font-size: 0.8rem; margin-right: 0.25rem;">✏️</button>
        <button class="btn-danger" onclick="FormManager.deleteDepense('${depense.id}')" style="padding: 0.25rem 0.5rem; font-size: 0.8rem;">🗑️</button>
        ${depense.prestationId ? `<button class="btn-info" onclick="showPrestationFromDepense('${depense.prestationId}')" style="padding: 0.25rem 0.5rem; font-size: 0.8rem; margin-left: 0.25rem;" title="Voir la prestation liée">🔗</button>` : ''}
      </td>
    </tr>
  `).join('');
}

// ===== ✅ NOUVEAU : TABLEAU REVENUS PAR CANAL =====
function updateCanauxRevenusTable(selectedYear = 'current', selectedMonth = '') {
  const tbody = document.querySelector('#canaux-revenus-table tbody');
  if (!tbody) return;

  // UTILISEZ LES DONNÉES FILTRÉES
  const analytics = selectedYear !== 'current' || selectedMonth !== '' ?
    ClientServices.getCanalAnalyticsFiltered(selectedYear, selectedMonth) :
    ClientServices.getCanalAnalytics();

  // Calculer les revenus partenariat séparément
  const headSpaStats = calculatePartnershipRevenue(selectedYear, selectedMonth);

  if (analytics.totalClients === 0 && headSpaStats.revenus === 0) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 2rem; color: var(--text-light);">Aucune donnée disponible</td></tr>';
    return;
  }

  let rows = analytics.sorted.map(canal => {
    const revenuMoyen = canal.clients > 0 ? (canal.revenus / canal.clients) : 0;
    const total = canal.clients + canal.prospects;

    // Ne pas afficher les canaux sans clients ni prospects
    if (total === 0) return '';

    return `
      <tr>
        <td style="font-weight: 600;">${canal.label}</td>
        <td style="text-align: center;">
          <span class="badge badge-primary">${canal.clients}</span>
        </td>
        <td style="text-align: center;">
          <span class="badge badge-secondary">${canal.prospects}</span>
        </td>
        <td style="text-align: right; font-weight: 600; color: var(--beige-dore);">
          ${canal.revenus.toFixed(2)} €
        </td>
        <td style="text-align: right; color: var(--text-light);">
          ${canal.clients > 0 ? revenuMoyen.toFixed(2) + ' €' : '-'}
        </td>
      </tr>
    `;
  }).filter(row => row !== '').join('');

  // Ajouter la ligne Partenariats si des revenus existent
  if (headSpaStats.revenus > 0 || headSpaStats.prestations > 0) {
    rows += `
      <tr style="background: linear-gradient(135deg, #faf6f2, #f5ede6); border-top: 2px solid var(--beige-dore);">
        <td style="font-weight: 600; color: var(--beige-dore);">💆 Partenariats</td>
        <td style="text-align: center;">
          <span class="badge" style="background: var(--rose-poudre); color: var(--text-dark);">${headSpaStats.prestations}</span>
        </td>
        <td style="text-align: center;">
          <span class="badge badge-secondary">-</span>
        </td>
        <td style="text-align: right; font-weight: 600; color: var(--beige-dore);">
          ${headSpaStats.revenus.toFixed(2)} €
        </td>
        <td style="text-align: right; color: var(--text-light);">
          ${headSpaStats.prestations > 0 ? (headSpaStats.revenus / headSpaStats.prestations).toFixed(2) + ' €/presta' : '-'}
        </td>
      </tr>
    `;
  }

  tbody.innerHTML = rows;
}

// Calculer les revenus des soins partenariat
function calculatePartnershipRevenue(selectedYear = 'current', selectedMonth = '') {
  const appData = DataManager.getAppData();

  // Filtrer les prestations partenariat selon l'année/mois
  const prestationsPartnership = appData.prestations.filter(p => {
    if (!DataManager.isPartnershipSoin(p.soinId || p.type)) return false;

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

  const revenus = prestationsPartnership.reduce((sum, p) => sum + (p.prix || 0), 0);
  const tips = prestationsPartnership.reduce((sum, p) => sum + (p.tips || 0), 0);

  return {
    prestations: prestationsPartnership.length,
    revenus: revenus + tips,
    revenusHT: revenus,
    tips: tips
  };
}

function updateGoogleAdsAnalytics() {
  console.log('📊 === MISE À JOUR ANALYTICS GOOGLE ADS ===');
  
  const parametres = DataManager.getParametres();
  const isConnected = parametres.googleAdsConnected;
  const selectedCampaigns = parametres.googleAdsSelectedCampaigns || [];
  
  const container = document.getElementById('google-ads-analytics');
  if (!container) {
    console.warn('⚠️ Container google-ads-analytics non trouvé');
    return;
  }
  
  if (!isConnected || selectedCampaigns.length === 0) {
    container.innerHTML = generateEmptyGoogleAdsSection();
    return;
  }
  
  // Calculer les métriques avec données cachées
  const metrics = calculateGoogleAdsMetrics();
  
  // ✅ AFFICHER IMMÉDIATEMENT avec placeholder
  container.innerHTML = generateGoogleAdsSection(metrics);
  
  // ✅ CHARGER LES SÉLECTEURS DE FAÇON ASYNCHRONE
  setTimeout(async () => {
    const selectorsDiv = document.getElementById('campaign-period-selectors');
    if (selectorsDiv && typeof generateCampaignPeriodSelector !== 'undefined') {
      const selectorsHTML = await generateCampaignPeriodSelector();
      selectorsDiv.innerHTML = selectorsHTML;
      
      // ✅ Initialiser la sélection par défaut après chargement du selector
      setTimeout(() => {
        if (typeof initializeDefaultSelection === 'function') {
          initializeDefaultSelection();
        }
      }, 500);
    }
  }, 100);
  
  // ✅ CHARGER LES VRAIES DONNÉES EN ARRIÈRE-PLAN
  setTimeout(() => {
    loadAndDisplayCampaignsData();
  }, 200);
}

function generateEmptyGoogleAdsSection() {
  return `
    <div style="background: white; padding: 1.5rem; border-radius: var(--border-radius, 8px); margin: 1.5rem 0; text-align: center; border: 1px solid var(--border-color, #e8e3d8); box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
      <div style="padding: 1rem 1.5rem; border-bottom: 1px solid var(--border-color, #e8e3d8); background: var(--beige-clair, #faf8f5); border-radius: var(--border-radius, 8px) var(--border-radius, 8px) 0 0; margin: -1.5rem -1.5rem 1.5rem -1.5rem;">
        <h4 style="margin: 0; color: var(--text-dark, #333); font-size: 1rem; font-weight: 600; display: flex; align-items: center; gap: 0.5rem;">
          📊 Analytics Google Ads
        </h4>
      </div>
      <div style="font-size: 2rem; margin-bottom: 1rem; color: var(--text-light, #6c757d);">📊</div>
      <p style="color: var(--text-light, #6c757d); font-size: 0.9rem; margin: 0;">Connectez-vous et sélectionnez des campagnes pour voir les analytics</p>
    </div>
  `;
}

function generateGoogleAdsSection(metrics) {
  return `
    <div style="background: white; border: 1px solid var(--border-color, #e8e3d8); border-radius: var(--border-radius, 8px); margin: 1.5rem 0; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
      
      <!-- Header du bloc -->
      <div style="padding: 1rem 1.5rem; border-bottom: 1px solid var(--border-color, #e8e3d8); background: var(--beige-clair, #faf8f5); border-radius: var(--border-radius, 8px) var(--border-radius, 8px) 0 0; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem;">
        <h4 style="margin: 0; color: var(--text-dark, #333); font-size: 1rem; font-weight: 600; display: flex; align-items: center; gap: 0.5rem;">
          📊 Analytics Google Ads
          <span style="font-size: 0.75rem; background: white; color: var(--beige-dore, #d4af37); padding: 0.25rem 0.5rem; border-radius: 12px; font-weight: 500; border: 1px solid var(--border-color, #e8e3d8);">
            ${metrics.campaignsCount} campagne(s)
          </span>
        </h4>
        <div id="campaign-period-selectors" style="display: flex; gap: 0.5rem;">
          <!-- Sélecteurs chargés dynamiquement -->
        </div>
      </div>
      
      <!-- Contenu du bloc -->
      <div style="padding: 1.5rem;">
        
        <!-- 🎯 Métriques en ligne -->
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 1rem; margin-bottom: 1.5rem;">
          
          <!-- ROI Total -->
          <div style="background: var(--beige-clair, #faf8f5); border: 1px solid var(--border-color, #e8e3d8); border-radius: var(--border-radius, 6px); padding: 1rem; text-align: center;">
            <div style="font-size: 0.8rem; color: var(--text-light, #666); margin-bottom: 0.5rem; font-weight: 500;">ROI Total</div>
            <div style="font-size: 1.4rem; font-weight: 700; color: #28a745; margin-bottom: 0.25rem;">${metrics.roi >= 0 ? '+' : ''}${metrics.roiMoney.toFixed(0)}€</div>
            <div style="font-size: 0.7rem; color: var(--text-light, #888);">(${metrics.roi >= 0 ? '+' : ''}${metrics.roi.toFixed(1)}%)</div>
          </div>
          
          <!-- Coût Total -->
          <div style="background: var(--beige-clair, #faf8f5); border: 1px solid var(--border-color, #e8e3d8); border-radius: var(--border-radius, 6px); padding: 1rem; text-align: center;">
            <div style="font-size: 0.8rem; color: var(--text-light, #666); margin-bottom: 0.5rem; font-weight: 500;">Coût Total</div>
            <div style="font-size: 1.4rem; font-weight: 700; color: var(--beige-dore, #d4af37); margin-bottom: 0.25rem;">${metrics.totalCost.toFixed(0)}€</div>
            <div style="font-size: 0.7rem; color: var(--text-light, #888);">Depuis le début</div>
          </div>
          
          <!-- Revenus Générés -->
          <div style="background: var(--beige-clair, #faf8f5); border: 1px solid var(--border-color, #e8e3d8); border-radius: var(--border-radius, 6px); padding: 1rem; text-align: center;">
            <div style="font-size: 0.8rem; color: var(--text-light, #666); margin-bottom: 0.5rem; font-weight: 500;">Revenus Générés</div>
            <div style="font-size: 1.4rem; font-weight: 700; color: #4285f4; margin-bottom: 0.25rem;">${metrics.totalRevenue.toFixed(0)}€</div>
            <div style="font-size: 0.7rem; color: var(--text-light, #888);">${metrics.prestationsCount} prestation(s)</div>
          </div>
          
          <!-- Clients Acquis -->
          <div style="background: var(--beige-clair, #faf8f5); border: 1px solid var(--border-color, #e8e3d8); border-radius: var(--border-radius, 6px); padding: 1rem; text-align: center;">
            <div style="font-size: 0.8rem; color: var(--text-light, #666); margin-bottom: 0.5rem; font-weight: 500;">Clients Acquis</div>
            <div id="google-ads-kpi-clients-count" style="font-size: 1.4rem; font-weight: 700; color: #6f42c1; margin-bottom: 0.25rem;">${metrics.clientsCount}</div>
            <div style="font-size: 0.7rem; color: var(--text-light, #888);">Via Google Ads</div>
          </div>
        </div>

        <!-- 📋 Performance par Campagne AVEC SÉLECTEUR CORRIGÉ -->
        <div style="background: var(--beige-clair, #faf8f5); border: 1px solid var(--border-color, #e8e3d8); border-radius: var(--border-radius, 6px); margin-bottom: 1.5rem; padding: 1rem;">
          
          <!-- Header avec sélecteur de période CORRIGÉ -->
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; flex-wrap: wrap; gap: 1rem;">
            <h5 style="margin: 0; color: var(--text-dark, #333); font-size: 0.9rem; font-weight: 600; display: flex; align-items: center; gap: 0.5rem;">
              📋 Performance par Campagne
            </h5>
            
            <!-- Sélecteur de période CORRIGÉ avec "Depuis le début" par défaut -->
            <div style="display: flex; align-items: center; gap: 0.75rem;">
              <select id="campaign-period-selector" onchange="changeCampaignPeriod()" style="padding: 0.4rem 0.8rem; border: 1px solid var(--border-color, #e8e3d8); border-radius: var(--border-radius, 4px); background: white; font-size: 0.8rem; color: var(--text-dark, #333);">
                <option value="all" selected>📅 Depuis le début</option>
                <option value="THIS_MONTH">📅 Ce mois-ci</option>
                <option value="7">📅 7 derniers jours</option>
              </select>
            </div>
          </div>
          
          <div id="campaigns-performance-section">
            <div style="text-align: center; padding: 1.5rem; color: var(--text-light, #666);">
              <div style="font-size: 1.5rem; margin-bottom: 0.5rem;">🔄</div>
              <p style="margin: 0; font-size: 0.85rem;">Chargement des données...</p>
            </div>
          </div>
        </div>

        <!-- 👥 Clients Google Ads -->
        <div style="background: var(--beige-clair, #faf8f5); border: 1px solid var(--border-color, #e8e3d8); border-radius: var(--border-radius, 6px); padding: 1rem;">
          <div onclick="toggleGoogleAdsClients()" style="cursor: pointer; display: flex; justify-content: space-between; align-items: center; user-select: none;">
            <h5 id="google-ads-clients-title" style="margin: 0; color: var(--text-dark, #333); font-size: 0.9rem; font-weight: 600; display: flex; align-items: center; gap: 0.5rem;">
              👥 Clients Google Ads de cette période
            </h5>
            <span id="google-ads-clients-arrow" style="font-size: 1.2rem; color: var(--beige-dore, #d4af37); transition: transform 0.3s;">▼</span>
          </div>
          
          <div id="google-ads-clients-content" style="display: none; margin-top: 1rem; border-top: 1px solid var(--border-color, #e8e3d8); padding-top: 1rem;">
            <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 1rem;">
              ${generateGoogleAdsClientsCards(metrics.clientsData)}
            </div>
          </div>
        </div>
        
      </div>
    </div>
  `;
}

async function loadAndDisplayCampaignsData() {
  const performanceSection = document.getElementById('campaigns-performance-section');
  if (!performanceSection) {
    console.warn('⚠️ Section campaigns-performance-section non trouvée');
    return;
  }

  try {
    
    // ✅ AFFICHAGE IMMÉDIAT DU LOADING
    performanceSection.innerHTML = `
      <div style="text-align: center; padding: 1.5rem; color: var(--text-light, #666);">
        <div style="font-size: 1.5rem; margin-bottom: 0.5rem;">🔄</div>
        <p style="margin: 0; font-size: 0.85rem;">Récupération depuis l'API Google Ads...</p>
      </div>
    `;
    
    // ✅ VÉRIFIER LA CONNEXION
    const parametres = DataManager.getParametres();
    const selectedCampaigns = parametres.googleAdsSelectedCampaigns || [];
    
    if (selectedCampaigns.length === 0) {
      performanceSection.innerHTML = `
        <div style="text-align: center; padding: 1.5rem; color: var(--text-light, #666);">
          <div style="font-size: 1.5rem; margin-bottom: 0.5rem;">📊</div>
          <p style="margin: 0; font-size: 0.85rem;">Aucune campagne sélectionnée</p>
          <button onclick="showCampaignManagementModal()" style="margin-top: 1rem; background: var(--beige-dore, #d4af37); color: white; border: none; padding: 0.5rem 1rem; border-radius: var(--border-radius, 6px); cursor: pointer;">
            📊 Sélectionner des campagnes
          </button>
        </div>
      `;
      return;
    }
    
    // ✅ RÉCUPÉRER LES TOKENS (utilise les fonctions qui marchent déjà)
    const tokens = await getValidTokens();
    if (!tokens) {
      performanceSection.innerHTML = `
        <div style="text-align: center; padding: 1.5rem; color: #e74c3c;">
          <div style="font-size: 1.5rem; margin-bottom: 0.5rem;">🔑</div>
          <p style="margin: 0; font-size: 0.85rem;">Token d'accès non disponible</p>
        </div>
      `;
      return;
    }
    
    // ✅ RÉCUPÉRER LES COMPTES (utilise les fonctions qui marchent déjà)
    const customersResult = await testAccessibleCustomers(tokens.access_token);
    if (!customersResult.success) {
      performanceSection.innerHTML = `
        <div style="text-align: center; padding: 1.5rem; color: #e74c3c;">
          <div style="font-size: 1.5rem; margin-bottom: 0.5rem;">❌</div>
          <p style="margin: 0; font-size: 0.85rem;">Erreur API: ${customersResult.error}</p>
        </div>
      `;
      return;
    }
    
    // ✅ RÉCUPÉRER TOUTES LES CAMPAGNES AVEC PÉRIODE "all" (DEPUIS LE DÉBUT)
    const allCampaigns = [];
    for (const customerId of customersResult.customers) {
      try {
        const campaigns = await getCampaignsForCustomerWithPeriod(tokens.access_token, customerId, 'all');
        allCampaigns.push(...campaigns);
        // Campagnes récupérées silencieusement
      } catch (error) {
        console.error(`❌ Erreur compte ${customerId}:`, error);
      }
    }
    
    // ✅ FILTRER LES CAMPAGNES SÉLECTIONNÉES
    const selectedCampaignsData = allCampaigns.filter(campaign => 
      selectedCampaigns.includes(campaign.id)
    );
    
    // Campagnes filtrées
    
    // ✅ AFFICHER LE TABLEAU FINAL AVEC PÉRIODE "all"
    if (selectedCampaignsData.length > 0) {
      const tableHTML = generateFinalCampaignsTableWithPeriod(selectedCampaignsData, 'all');
      performanceSection.innerHTML = tableHTML;
      // Tableau généré
      
      // ✅ METTRE À JOUR LE NOMBRE DE CLIENTS UNIQUES
      const uniqueClientsCount = calculateUniqueCampaignClients(selectedCampaignsData, 'all');
      
      // Mettre à jour le KPI
      const kpiClientsCount = document.getElementById('google-ads-kpi-clients-count');
      if (kpiClientsCount) {
        kpiClientsCount.textContent = uniqueClientsCount;
      }
      
      console.log(`✅ Clients uniques mis à jour (initial): ${uniqueClientsCount}`);
      
      // ✅ METTRE À JOUR LE CACHE SILENCIEUSEMENT (SANS régénérer pour éviter boucle infinie)
      const realTotalCost = selectedCampaignsData.reduce((sum, c) => sum + (c.cost || 0), 0);
      const appData = DataManager.getAppData();
      const clientsGoogleAds = appData.clients.filter(client => client.canalAcquisition === 'google-ads');
      const prestationsGoogleAds = appData.prestations.filter(prestation => {
        const client = appData.clients.find(c => c.id === prestation.clientId);
        return client && client.canalAcquisition === 'google-ads';
      });
      const totalRevenue = prestationsGoogleAds.reduce((sum, p) => sum + (p.prix || 0) + (p.tips || 0), 0);
      
      // Mettre à jour le cache dans les paramètres
      parametres.googleAdsCachedCosts = {
        total: realTotalCost,
        revenue: totalRevenue,
        clientsCount: clientsGoogleAds.length,
        prestationsCount: prestationsGoogleAds.length,
        lastUpdate: new Date().toISOString()
      };
      DataManager.saveParametres(parametres);
      
      console.log(`✅ Cache mis à jour : Coût ${realTotalCost.toFixed(0)}€`);
      
      // ✅ METTRE À JOUR LES KPIS DU DOM DIRECTEMENT (sans régénérer toute la section)
      setTimeout(() => {
        const roi = realTotalCost > 0 ? ((totalRevenue - realTotalCost) / realTotalCost) * 100 : 0;
        const roiMoney = totalRevenue - realTotalCost;
        
        console.log(`📊 Valeurs calculées : ROI ${roiMoney.toFixed(0)}€ (${roi.toFixed(1)}%), Coût ${realTotalCost.toFixed(0)}€`);
        
        // Trouver les KPIs dans le DOM avec un sélecteur différent
        const googleAdsSection = document.getElementById('google-ads-analytics');
        if (!googleAdsSection) {
          console.error('❌ Section google-ads-analytics non trouvée');
          return;
        }
        
        // Trouver TOUS les divs avec grid
        const gridContainers = googleAdsSection.querySelectorAll('[style*="grid-template-columns"]');
        console.log(`🔍 Trouvé ${gridContainers.length} grid containers`);
        
        if (gridContainers.length > 0) {
          // Prendre le PREMIER grid (celui des KPIs)
          const kpisGrid = gridContainers[0];
          const allKpiBoxes = kpisGrid.querySelectorAll('div[style*="background: var(--beige-clair"]');
          console.log(`📦 Trouvé ${allKpiBoxes.length} KPI boxes dans le premier grid`);
          
          if (allKpiBoxes.length >= 2) {
            // KPI 1: ROI Total
            const roiBox = allKpiBoxes[0];
            const roiLabel = roiBox.querySelector('div:first-child');
            console.log(`🏷️ KPI 1 label:`, roiLabel ? roiLabel.textContent : 'non trouvé');
            
            const roiValueDiv = roiBox.querySelector('div:nth-child(2)');
            const roiPercentDiv = roiBox.querySelector('div:nth-child(3)');
            
            if (roiValueDiv) {
              console.log(`💰 Ancienne valeur ROI:`, roiValueDiv.textContent);
              roiValueDiv.textContent = `${roiMoney >= 0 ? '+' : ''}${roiMoney.toFixed(0)}€`;
              roiValueDiv.style.color = roiMoney >= 0 ? '#28a745' : '#e74c3c';
              console.log(`✅ Nouvelle valeur ROI:`, roiValueDiv.textContent);
            }
            if (roiPercentDiv) {
              console.log(`📈 Ancien % ROI:`, roiPercentDiv.textContent);
              roiPercentDiv.textContent = `(${roi >= 0 ? '+' : ''}${roi.toFixed(1)}%)`;
              console.log(`✅ Nouveau % ROI:`, roiPercentDiv.textContent);
            }
            
            // KPI 2: Coût Total
            const costBox = allKpiBoxes[1];
            const costLabel = costBox.querySelector('div:first-child');
            console.log(`🏷️ KPI 2 label:`, costLabel ? costLabel.textContent : 'non trouvé');
            
            const costValueDiv = costBox.querySelector('div:nth-child(2)');
            if (costValueDiv) {
              console.log(`💵 Ancienne valeur Coût:`, costValueDiv.textContent);
              costValueDiv.textContent = `${realTotalCost.toFixed(0)}€`;
              console.log(`✅ Nouvelle valeur Coût:`, costValueDiv.textContent);
            }
            
            console.log(`✅ KPIs DOM mis à jour : ROI ${roiMoney.toFixed(0)}€, Coût ${realTotalCost.toFixed(0)}€`);
          } else {
            console.warn(`⚠️ Pas assez de KPI boxes : ${allKpiBoxes.length}`);
          }
        } else {
          console.warn('⚠️ Aucun grid container trouvé');
        }
      }, 200);
    } else {
      performanceSection.innerHTML = `
        <div style="text-align: center; padding: 1.5rem; color: var(--text-light, #666);">
          <div style="font-size: 1.5rem; margin-bottom: 0.5rem;">⚠️</div>
          <p style="margin: 0; font-size: 0.85rem;">Campagnes sélectionnées non trouvées dans l'API</p>
          <div style="margin-top: 0.5rem; font-size: 0.8rem; color: var(--text-light, #888);">
            IDs recherchés: ${selectedCampaigns.join(', ')}<br>
            Campagnes API trouvées: ${allCampaigns.length}
          </div>
        </div>
      `;
    }
    
  } catch (error) {
    console.error('❌ Erreur loadAndDisplayCampaignsData:', error);
    performanceSection.innerHTML = `
      <div style="text-align: center; padding: 1.5rem; color: #e74c3c;">
        <div style="font-size: 1.5rem; margin-bottom: 0.5rem;">💥</div>
        <p style="margin: 0; font-size: 0.85rem;">Erreur: ${error.message}</p>
        <button onclick="reloadCampaignsNow()" style="margin-top: 1rem; background: var(--beige-dore, #d4af37); color: white; border: none; padding: 0.5rem 1rem; border-radius: var(--border-radius, 6px); cursor: pointer;">
          🔄 Réessayer
        </button>
      </div>
    `;
  }
}

function generateFinalCampaignsTable(campaignsData) {
  console.log('📋 Génération tableau final avec', campaignsData.length, 'campagnes (version par défaut)');
  
  if (!campaignsData || campaignsData.length === 0) {
    return `
      <div style="text-align: center; padding: 1.5rem; color: var(--text-light, #666);">
        <div style="font-size: 1.5rem; margin-bottom: 0.5rem;">📭</div>
        <p style="margin: 0; font-size: 0.85rem;">Aucune donnée de campagne</p>
      </div>
    `;
  }
  
  return `
    <div style="overflow-x: auto; border: 1px solid var(--border-color, #e8e3d8); border-radius: var(--border-radius, 4px); background: white;">
      <table style="width: 100%; border-collapse: collapse; font-size: 0.85rem;">
        <thead>
          <tr style="background: var(--beige-dore, #d4af37); color: white;">
            <th style="padding: 0.75rem; text-align: left; font-weight: 600; font-size: 0.8rem;">Campagne</th>
            <th style="padding: 0.75rem; text-align: center; font-weight: 600; font-size: 0.8rem;">Statut</th>
            <th style="padding: 0.75rem; text-align: center; font-weight: 600; font-size: 0.8rem;">Coût (Depuis le début)</th>
            <th style="padding: 0.75rem; text-align: center; font-weight: 600; font-size: 0.8rem;">Impressions</th>
            <th style="padding: 0.75rem; text-align: center; font-weight: 600; font-size: 0.8rem;">Clics</th>
            <th style="padding: 0.75rem; text-align: center; font-weight: 600; font-size: 0.8rem;">CTR</th>
          </tr>
        </thead>
        <tbody>
          ${campaignsData.map((campaign, index) => {
            const statusColor = campaign.status === 'ENABLED' ? '#28a745' : 
                               campaign.status === 'PAUSED' ? '#ffc107' : '#6c757d';
            const statusText = campaign.status === 'ENABLED' ? 'Active' : 
                              campaign.status === 'PAUSED' ? 'En pause' : 
                              campaign.status || 'Inconnu';
            
            return `
              <tr style="border-bottom: 1px solid var(--border-color, #f0f0f0); ${index % 2 === 0 ? 'background: #fafafa;' : 'background: white;'}">
                <td style="padding: 0.75rem; font-weight: 500; color: var(--text-dark, #333); max-width: 200px; overflow: hidden; text-overflow: ellipsis;" title="${campaign.name || 'Nom indisponible'}">
                  ${campaign.name || `Campagne ${campaign.id}`}
                </td>
                <td style="padding: 0.75rem; text-align: center;">
                  <span style="padding: 0.2rem 0.4rem; border-radius: 10px; font-size: 0.7rem; font-weight: 600; background: ${statusColor}20; color: ${statusColor};">
                    ${statusText}
                  </span>
                </td>
                <td style="padding: 0.75rem; text-align: center; font-weight: 600; color: var(--beige-dore, #d4af37);">
                  ${(campaign.cost || 0).toFixed(2)}€
                </td>
                <td style="padding: 0.75rem; text-align: center; color: var(--text-dark, #333);">
                  ${(campaign.impressions || 0).toLocaleString()}
                </td>
                <td style="padding: 0.75rem; text-align: center; color: var(--text-dark, #333);">
                  ${(campaign.clicks || 0).toLocaleString()}
                </td>
                <td style="padding: 0.75rem; text-align: center; color: var(--text-dark, #333);">
                  ${campaign.ctr ? campaign.ctr.toFixed(2) + '%' : '0.00%'}
                </td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
      
      <!-- Résumé en bas du tableau CORRIGÉ pour "Depuis le début" -->
      <div style="padding: 1rem; background: #f8f9fa; border-top: 1px solid var(--border-color, #e8e3d8); display: flex; justify-content: space-between; align-items: center;">
        <div style="font-size: 0.9rem; color: var(--text-dark, #333);">
          <strong>${campaignsData.length} campagne(s) • Coût total: ${campaignsData.reduce((sum, c) => sum + (c.cost || 0), 0).toFixed(2)}€</strong>
        </div>
        <div style="font-size: 0.8rem; color: var(--text-light, #666);">
          📅 Depuis le début
        </div>
      </div>
    </div>
  `;
}

function calculateGoogleAdsMetrics() {
  const appData = DataManager.getAppData();
  const parametres = appData.parametres || {};
  
  // Prestations Google Ads d'abord
  const prestationsGoogleAds = appData.prestations.filter(prestation => {
    const client = appData.clients.find(c => c.id === prestation.clientId);
    return client && client.canalAcquisition === 'google-ads';
  });
  
  // ✅ FIX : Clients Google Ads AVEC PRESTATIONS uniquement
  const clientsGoogleAds = appData.clients.filter(client => {
    if (client.canalAcquisition !== 'google-ads') return false;
    // Vérifier qu'il a au moins 1 prestation
    return prestationsGoogleAds.some(p => p.clientId === client.id);
  });
  
  const totalRevenue = prestationsGoogleAds.reduce((sum, p) => sum + (p.prix || 0) + (p.tips || 0), 0);
  const cachedCosts = parametres.googleAdsCachedCosts || {};
  const totalCost = cachedCosts.total || 0;
  const roi = totalCost > 0 ? ((totalRevenue - totalCost) / totalCost) * 100 : 0;
  const roiMoney = totalRevenue - totalCost;
  
  // Données par client
  const clientsData = clientsGoogleAds.map(client => {
    const clientPrestations = prestationsGoogleAds.filter(p => p.clientId === client.id);
    const clientRevenue = clientPrestations.reduce((sum, p) => sum + (p.prix || 0) + (p.tips || 0), 0);
    
    return {
      client,
      prestationsCount: clientPrestations.length,
      revenue: clientRevenue,
      avgSession: clientPrestations.length > 0 ? clientRevenue / clientPrestations.length : 0,
      lastSession: clientPrestations.length > 0 ? 
        Math.max(...clientPrestations.map(p => new Date(p.date).getTime())) : null
    };
  }).sort((a, b) => b.revenue - a.revenue);
  
  return {
    clientsCount: clientsGoogleAds.length,
    prestationsCount: prestationsGoogleAds.length,
    totalRevenue,
    totalCost,
    roi,
    roiMoney,
    campaignsCount: parametres.googleAdsSelectedCampaigns?.length || 0,
    clientsData
  };
}

function generateGoogleAdsClientsCards(clientsData) {
  if (clientsData.length === 0) {
    return `
      <div style="grid-column: 1/-1; text-align: center; padding: 1.5rem; color: var(--text-light, #666);">
        <div style="font-size: 1.5rem; margin-bottom: 0.5rem;">🎯</div>
        <p style="margin: 0 0 0.25rem 0; font-size: 0.9rem;">Aucun client Google Ads trouvé</p>
        <p style="margin: 0; font-size: 0.8rem; color: var(--text-light, #888);">Les clients acquis via Google Ads apparaîtront ici</p>
      </div>
    `;
  }
  
  return clientsData.map(clientData => {
    const { client, prestationsCount, revenue, avgSession, lastSession } = clientData;
    const lastSessionText = lastSession ? 
      new Date(lastSession).toLocaleDateString('fr-FR') : 'Jamais';
    
    return `
      <div style="background: white; border: 1px solid var(--border-color, #e8e3d8); border-radius: var(--border-radius, 4px); padding: 0.875rem; transition: all 0.2s;">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.5rem;">
          <div>
            <div style="font-weight: 600; color: var(--text-dark, #333); font-size: 0.9rem;">${client.prenom} ${client.nom}</div>
            ${client.societe ? `<div style="font-size: 0.75rem; color: var(--text-light, #666); margin-top: 0.2rem;">${client.societe}</div>` : ''}
          </div>
          <div style="text-align: right;">
            <div style="font-weight: 700; color: #28a745; font-size: 0.9rem;">${revenue.toFixed(0)}€</div>
            <div style="font-size: 0.75rem; color: var(--text-light, #666);">${prestationsCount} séance(s)</div>
          </div>
        </div>
        <div style="display: flex; justify-content: space-between; font-size: 0.75rem; color: var(--text-light, #888); padding-top: 0.5rem; border-top: 1px solid var(--border-color, #e8e3d8);">
          <span>Moy: ${avgSession.toFixed(0)}€</span>
          <span>Dernier: ${lastSessionText}</span>
        </div>
      </div>
    `;
  }).join('');
}

function toggleGoogleAdsClients() {
  const content = document.getElementById('google-ads-clients-content');
  const arrow = document.getElementById('google-ads-clients-arrow');
  
  if (!content || !arrow) return;
  
  if (content.style.display === 'none') {
    content.style.display = 'block';
    arrow.style.transform = 'rotate(180deg)';
    arrow.textContent = '▲';
  } else {
    content.style.display = 'none';
    arrow.style.transform = 'rotate(0deg)';
    arrow.textContent = '▼';
  }
}

function reloadCampaignsNow() {
  console.log('🔄 Reload forcé des campagnes');
  loadAndDisplayCampaignsData();
}

function changeCampaignPeriod() {
  const selector = document.getElementById('campaign-period-selector');
  if (!selector) return;
  
  const selectedPeriod = selector.value;
  const periodText = selector.options[selector.selectedIndex].text;
  
  console.log('📅 Changement de période:', selectedPeriod, periodText);
  
  // Afficher un message de changement
  const performanceSection = document.getElementById('campaigns-performance-section');
  if (performanceSection) {
    performanceSection.innerHTML = `
      <div style="text-align: center; padding: 1.5rem; color: var(--text-light, #666);">
        <div style="font-size: 1.5rem; margin-bottom: 0.5rem;">📅</div>
        <p style="margin: 0; font-size: 0.85rem;">Chargement des données pour : ${periodText.replace('📅 ', '')}</p>
      </div>
    `;
  }
  
  // Recharger avec la nouvelle période
  setTimeout(() => {
    loadAndDisplayCampaignsDataWithPeriod(selectedPeriod);
  }, 500);
}

async function loadAndDisplayCampaignsDataWithPeriod(period = '30') {
  const performanceSection = document.getElementById('campaigns-performance-section');
  if (!performanceSection) {
    console.warn('⚠️ Section campaigns-performance-section non trouvée');
    return;
  }

  try {
    
    // ✅ AFFICHAGE IMMÉDIAT DU LOADING
    performanceSection.innerHTML = `
      <div style="text-align: center; padding: 1.5rem; color: var(--text-light, #666);">
        <div style="font-size: 1.5rem; margin-bottom: 0.5rem;">🔄</div>
        <p style="margin: 0; font-size: 0.85rem;">Récupération depuis l'API Google Ads (${period === 'all' ? 'depuis le début' : period + ' jours'})...</p>
      </div>
    `;
    
    // ✅ VÉRIFIER LA CONNEXION
    const parametres = DataManager.getParametres();
    const selectedCampaigns = parametres.googleAdsSelectedCampaigns || [];
    
    if (selectedCampaigns.length === 0) {
      performanceSection.innerHTML = `
        <div style="text-align: center; padding: 1.5rem; color: var(--text-light, #666);">
          <div style="font-size: 1.5rem; margin-bottom: 0.5rem;">📊</div>
          <p style="margin: 0; font-size: 0.85rem;">Aucune campagne sélectionnée</p>
          <button onclick="showCampaignManagementModal()" style="margin-top: 1rem; background: var(--beige-dore, #d4af37); color: white; border: none; padding: 0.5rem 1rem; border-radius: var(--border-radius, 6px); cursor: pointer;">
            📊 Sélectionner des campagnes
          </button>
        </div>
      `;
      return;
    }
    
    // ✅ RÉCUPÉRER LES TOKENS
    const tokens = await getValidTokens();
    if (!tokens) {
      performanceSection.innerHTML = `
        <div style="text-align: center; padding: 1.5rem; color: #e74c3c;">
          <div style="font-size: 1.5rem; margin-bottom: 0.5rem;">🔑</div>
          <p style="margin: 0; font-size: 0.85rem;">Token d'accès non disponible</p>
        </div>
      `;
      return;
    }
    
    // ✅ RÉCUPÉRER LES COMPTES ET CAMPAGNES AVEC LA PÉRIODE
    const customersResult = await testAccessibleCustomers(tokens.access_token);
    if (!customersResult.success) {
      performanceSection.innerHTML = `
        <div style="text-align: center; padding: 1.5rem; color: #e74c3c;">
          <div style="font-size: 1.5rem; margin-bottom: 0.5rem;">❌</div>
          <p style="margin: 0; font-size: 0.85rem;">Erreur API: ${customersResult.error}</p>
        </div>
      `;
      return;
    }
    
    // ✅ RÉCUPÉRER TOUTES LES CAMPAGNES AVEC LA PÉRIODE
    const allCampaigns = [];
    for (const customerId of customersResult.customers) {
      try {
        const campaigns = await getCampaignsForCustomerWithPeriod(tokens.access_token, customerId, period);
        allCampaigns.push(...campaigns);
        // Campagnes récupérées
      } catch (error) {
        console.error(`❌ Erreur compte ${customerId}:`, error);
      }
    }
    
    // ✅ FILTRER LES CAMPAGNES SÉLECTIONNÉES
    const selectedCampaignsData = allCampaigns.filter(campaign => 
      selectedCampaigns.includes(campaign.id)
    );
    
    // Campagnes filtrées
    
    // ✅ AFFICHER LE TABLEAU AVEC INDICATION DE PÉRIODE
    if (selectedCampaignsData.length > 0) {
      const tableHTML = generateFinalCampaignsTableWithPeriod(selectedCampaignsData, period);
      performanceSection.innerHTML = tableHTML;
      
      // ✅ METTRE À JOUR LE NOMBRE DE CLIENTS PAR CAMPAGNE (DÉDUPLICATION)
      const uniqueClientsCount = calculateUniqueCampaignClients(selectedCampaignsData, period);
      
      // Mettre à jour le KPI
      const kpiClientsCount = document.getElementById('google-ads-kpi-clients-count');
      if (kpiClientsCount) {
        kpiClientsCount.textContent = uniqueClientsCount;
      }
      
      console.log(`✅ Clients uniques mis à jour: ${uniqueClientsCount}`);
    } else {
      performanceSection.innerHTML = `
        <div style="text-align: center; padding: 1.5rem; color: var(--text-light, #666);">
          <div style="font-size: 1.5rem; margin-bottom: 0.5rem;">⚠️</div>
          <p style="margin: 0; font-size: 0.85rem;">Campagnes sélectionnées non trouvées dans l'API</p>
        </div>
      `;
    }
    
  } catch (error) {
    console.error('❌ Erreur loadAndDisplayCampaignsDataWithPeriod:', error);
    performanceSection.innerHTML = `
      <div style="text-align: center; padding: 1.5rem; color: #e74c3c;">
        <div style="font-size: 1.5rem; margin-bottom: 0.5rem;">💥</div>
        <p style="margin: 0; font-size: 0.85rem;">Erreur: ${error.message}</p>
        <button onclick="changeCampaignPeriod()" style="margin-top: 1rem; background: var(--beige-dore, #d4af37); color: white; border: none; padding: 0.5rem 1rem; border-radius: var(--border-radius, 6px); cursor: pointer;">
          🔄 Réessayer
        </button>
      </div>
    `;
  }
}

function updateGoogleAdsMetricsDisplay(metrics) {
  // Mettre à jour les KPIs sans reconstruire tout le HTML
  const roiElement = document.querySelector('#google-ads-analytics .grid-template-columns div:nth-child(1) div:nth-child(2)');
  const costElement = document.querySelector('#google-ads-analytics .grid-template-columns div:nth-child(2) div:nth-child(2)');
  
  // Sélecteurs plus robustes
  const containers = document.querySelectorAll('#google-ads-analytics [style*="grid-template-columns"] > div');
  
  if (containers.length >= 4) {
    // ROI Total
    const roiContainer = containers[0];
    const roiValue = roiContainer.querySelector('[style*="font-size: 1.4rem"]');
    const roiPercent = roiContainer.querySelector('[style*="font-size: 0.7rem"]');
    if (roiValue) roiValue.textContent = `${metrics.roiMoney >= 0 ? '+' : ''}${metrics.roiMoney.toFixed(0)}€`;
    if (roiPercent) roiPercent.textContent = `(${metrics.roi >= 0 ? '+' : ''}${metrics.roi.toFixed(1)}%)`;
    
    // Coût Total
    const costContainer = containers[1];
    const costValue = costContainer.querySelector('[style*="font-size: 1.4rem"]');
    if (costValue) costValue.textContent = `${metrics.totalCost.toFixed(0)}€`;
    
    // Revenus restent identiques (données globales)
    // Clients restent identiques (données globales)
  }
}

function calculateGoogleAdsMetricsForPeriod(campaignsData, period) {
  const appData = DataManager.getAppData();
  const parametres = appData.parametres || {};
  
  // Clients Google Ads (données globales)
  const clientsGoogleAds = appData.clients.filter(client => 
    client.canalAcquisition === 'google-ads'
  );
  
  // Prestations Google Ads (données globales)
  const prestationsGoogleAds = appData.prestations.filter(prestation => {
    const client = appData.clients.find(c => c.id === prestation.clientId);
    return client && client.canalAcquisition === 'google-ads';
  });
  
  const totalRevenue = prestationsGoogleAds.reduce((sum, p) => sum + (p.prix || 0) + (p.tips || 0), 0);
  
  // ✅ CORRECTION : Utiliser les données de campagne pour le coût de la période
  const totalCost = campaignsData ? campaignsData.reduce((sum, c) => sum + (c.cost || 0), 0) : 0;
  
  const roi = totalCost > 0 ? ((totalRevenue - totalCost) / totalCost) * 100 : 0;
  const roiMoney = totalRevenue - totalCost;
  
  // Données par client
  const clientsData = clientsGoogleAds.map(client => {
    const clientPrestations = prestationsGoogleAds.filter(p => p.clientId === client.id);
    const clientRevenue = clientPrestations.reduce((sum, p) => sum + (p.prix || 0) + (p.tips || 0), 0);
    
    return {
      client,
      prestationsCount: clientPrestations.length,
      revenue: clientRevenue,
      avgSession: clientPrestations.length > 0 ? clientRevenue / clientPrestations.length : 0,
      lastSession: clientPrestations.length > 0 ? 
        Math.max(...clientPrestations.map(p => new Date(p.date).getTime())) : null
    };
  }).sort((a, b) => b.revenue - a.revenue);
  
  return {
    clientsCount: clientsGoogleAds.length,
    prestationsCount: prestationsGoogleAds.length,
    totalRevenue,
    totalCost, // ✅ Coût spécifique à la période
    roi,
    roiMoney,
    campaignsCount: parametres.googleAdsSelectedCampaigns?.length || 0,
    clientsData,
    period: period
  };
}

async function getCampaignsForCustomerWithPeriod(accessToken, customerId, period = 'all') {
  try {
    // Récupération campagnes API
    
    // ✅ CORRECTION : Construire la clause WHERE selon la période avec support THIS_MONTH
    let whereClause;
    if (period === 'all') {
      whereClause = '';
    } else if (period === 'THIS_MONTH') {
      // ✅ NOUVEAU : Support officiel Google Ads pour "Ce mois-ci" calendaire
      whereClause = `WHERE segments.date DURING THIS_MONTH`;
    } else if (period === 'LAST_MONTH') {
      whereClause = `WHERE segments.date DURING LAST_MONTH`;
    } else if (period === 'YESTERDAY') {
      whereClause = `WHERE segments.date DURING YESTERDAY`;
    } else if (period === 'TODAY') {
      whereClause = `WHERE segments.date DURING TODAY`;
    } else {
      // Période numérique (7, 30, etc.)
      whereClause = `WHERE segments.date DURING LAST_${period}_DAYS`;
    }
    
    const query = `
      SELECT 
        campaign.id,
        campaign.name,
        campaign.status,
        metrics.cost_micros,
        metrics.clicks,
        metrics.impressions
      FROM campaign
      ${whereClause}
      ORDER BY campaign.name
      LIMIT 50
    `;
    
    // Requête GAQL prête
    
    const response = await fetch(`https://googleads.googleapis.com/v20/customers/${customerId}/googleAds:searchStream`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'developer-token': 'tZ0KGweXjUnyQubimDfCsQ',
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'User-Agent': 'Elise-Massage-App/1.0'
      },
      body: JSON.stringify({ query: query })
    });
    
    if (response.ok) {
      const data = await response.json();
      // Réponse API reçue
      
      const campaigns = [];
      
      // ✅ CORRECTION : La structure est data[0].results
      let results = [];
      
      if (Array.isArray(data) && data.length > 0 && data[0].results) {
        results = data[0].results;
        // Résultats analysés
      } else {
        // Aucun résultat
        return [];
      }
      
      // ✅ TRAITEMENT CORRIGÉ DES RÉSULTATS
      results.forEach((result, index) => {
        // Analyse résultat
        
        if (result && result.campaign && result.campaign.resourceName && result.campaign.name) {
          try {
            // ✅ CORRECTION : Extraire l'ID depuis resourceName
            const campaignId = result.campaign.resourceName.split('/').pop();
            
            // Conversion sécurisée des micros en euros
            const costMicros = result.metrics?.costMicros || 0;
            const costEuros = parseInt(costMicros) / 1000000;
            
            const campaign = {
              id: campaignId,  // ✅ ID extrait du resourceName
              name: result.campaign.name,
              status: result.campaign.status || 'UNKNOWN',
              customerId: customerId,
              cost: isNaN(costEuros) ? 0 : costEuros,
              impressions: parseInt(result.metrics?.impressions || 0),
              clicks: parseInt(result.metrics?.clicks || 0),
              cpc: 0,
              ctr: 0,
              period: period // ✅ NOUVEAU : Ajouter la période
            };
            
            // Calculs dérivés sécurisés
            if (campaign.clicks > 0 && campaign.cost > 0) {
              campaign.cpc = campaign.cost / campaign.clicks;
            }
            if (campaign.impressions > 0 && campaign.clicks > 0) {
              campaign.ctr = (campaign.clicks / campaign.impressions) * 100;
            }
            
            campaigns.push(campaign);
            // Campagne ajoutée
            
          } catch (parseError) {
            console.error(`❌ Erreur parsing résultat ${index} (${period}):`, parseError);
          }
        } else {
          // Résultat ignoré
        }
      });
      
      // Campagnes parsées
      return campaigns;
      
    } else {
      const errorText = await response.text();
      console.error(`❌ Erreur HTTP ${response.status} pour ${customerId} (${period}):`, errorText);
      
      // Gestion spéciale compte manager
      if (response.status === 400 && errorText.includes('REQUESTED_METRICS_FOR_MANAGER')) {
        // Compte manager ignoré
        return [];
      }
      
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }
    
  } catch (error) {
    console.error(`❌ Erreur getCampaignsForCustomerWithPeriod ${customerId} (${period}):`, error);
    throw error;
  }
}

function generateFinalCampaignsTableWithPeriod(campaignsData, period = 'all') {
  // Génération du tableau
  
  if (!campaignsData || campaignsData.length === 0) {
    return `
      <div style="text-align: center; padding: 1.5rem; color: var(--text-light, #666);">
        <div style="font-size: 1.5rem; margin-bottom: 0.5rem;">📭</div>
        <p style="margin: 0; font-size: 0.85rem;">Aucune donnée de campagne pour cette période</p>
      </div>
    `;
  }
  
  // ✅ CORRECTION : Déterminer le texte de la période avec support THIS_MONTH
  const periodText = period === 'all' ? 'Depuis le début' :
                    period === 'THIS_MONTH' ? 'Ce mois-ci (calendaire)' :
                    period === 'LAST_MONTH' ? 'Le mois dernier' :
                    period === 'TODAY' ? 'Aujourd\'hui' :
                    period === 'YESTERDAY' ? 'Hier' :
                    period === '7' ? '7 derniers jours' :
                    period === '90' ? '90 derniers jours' :
                    `${period} derniers jours`;
  
  return `
    <div style="overflow-x: auto; border: 1px solid var(--border-color, #e8e3d8); border-radius: var(--border-radius, 4px); background: white;">
      <table style="width: 100%; border-collapse: collapse; font-size: 0.85rem;">
        <thead>
          <tr style="background: var(--beige-dore, #d4af37); color: white;">
            <th style="padding: 0.75rem; text-align: left; font-weight: 600; font-size: 0.8rem;">Campagne</th>
            <th style="padding: 0.75rem; text-align: center; font-weight: 600; font-size: 0.8rem;">Statut</th>
            <th style="padding: 0.75rem; text-align: center; font-weight: 600; font-size: 0.8rem;">Coût (${periodText})</th>
            <th style="padding: 0.75rem; text-align: center; font-weight: 600; font-size: 0.8rem;">Impressions</th>
            <th style="padding: 0.75rem; text-align: center; font-weight: 600; font-size: 0.8rem;">Clics</th>
            <th style="padding: 0.75rem; text-align: center; font-weight: 600; font-size: 0.8rem;">CTR</th>
          </tr>
        </thead>
        <tbody>
          ${campaignsData.map((campaign, index) => {
            const statusColor = campaign.status === 'ENABLED' ? '#28a745' : 
                               campaign.status === 'PAUSED' ? '#ffc107' : '#6c757d';
            const statusText = campaign.status === 'ENABLED' ? 'Active' : 
                              campaign.status === 'PAUSED' ? 'En pause' : 
                              campaign.status || 'Inconnu';
            
            return `
              <tr style="border-bottom: 1px solid var(--border-color, #f0f0f0); ${index % 2 === 0 ? 'background: #fafafa;' : 'background: white;'}">
                <td style="padding: 0.75rem; font-weight: 500; color: var(--text-dark, #333); max-width: 200px; overflow: hidden; text-overflow: ellipsis;" title="${campaign.name || 'Nom indisponible'}">
                  ${campaign.name || `Campagne ${campaign.id}`}
                </td>
                <td style="padding: 0.75rem; text-align: center;">
                  <span style="padding: 0.2rem 0.4rem; border-radius: 10px; font-size: 0.7rem; font-weight: 600; background: ${statusColor}20; color: ${statusColor};">
                    ${statusText}
                  </span>
                </td>
                <td style="padding: 0.75rem; text-align: center; font-weight: 600; color: var(--beige-dore, #d4af37);">
                  ${(campaign.cost || 0).toFixed(2)}€
                </td>
                <td style="padding: 0.75rem; text-align: center; color: var(--text-dark, #333);">
                  ${(campaign.impressions || 0).toLocaleString()}
                </td>
                <td style="padding: 0.75rem; text-align: center; color: var(--text-dark, #333);">
                  ${(campaign.clicks || 0).toLocaleString()}
                </td>
                <td style="padding: 0.75rem; text-align: center; color: var(--text-dark, #333);">
                  ${campaign.ctr ? campaign.ctr.toFixed(2) + '%' : '0.00%'}
                </td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
      
      <!-- Résumé en bas du tableau avec période -->
      <div style="padding: 1rem; background: #f8f9fa; border-top: 1px solid var(--border-color, #e8e3d8); display: flex; justify-content: space-between; align-items: center;">
        <div style="font-size: 0.9rem; color: var(--text-dark, #333);">
          <strong>${campaignsData.length} campagne(s) • Coût total: ${campaignsData.reduce((sum, c) => sum + (c.cost || 0), 0).toFixed(2)}€</strong>
        </div>
        <div style="font-size: 0.8rem; color: var(--text-light, #666);">
          📅 ${periodText}
        </div>
      </div>
    </div>
  `;
}

// ===== 🔧 FIX CACHE - Une seule fois pour synchroniser =====

// AJOUTER cette fonction temporaire dans utils-services.js :
async function syncGoogleAdsCacheOnce() {
  try {
    console.log('🔄 Synchronisation une fois du cache Google Ads...');
    
    const parametres = DataManager.getParametres();
    const selectedCampaigns = parametres.googleAdsSelectedCampaigns || [];
    
    if (selectedCampaigns.length === 0) {
      console.log('❌ Aucune campagne sélectionnée');
      return;
    }
    
    // Récupérer les tokens
    const tokens = await getValidTokens();
    if (!tokens) {
      console.log('❌ Pas de tokens disponibles');
      return;
    }
    
    // Récupérer les comptes
    const customersResult = await testAccessibleCustomers(tokens.access_token);
    if (!customersResult.success) {
      console.log('❌ Comptes non accessibles');
      return;
    }
    
    // Récupérer TOUTES les campagnes (depuis le début)
    const allCampaigns = [];
    for (const customerId of customersResult.customers) {
      try {
        const campaigns = await getCampaignsForCustomerWithPeriod(tokens.access_token, customerId, 'all');
        allCampaigns.push(...campaigns);
      } catch (error) {
        console.error(`❌ Erreur compte ${customerId}:`, error);
      }
    }
    
    // Filtrer les campagnes sélectionnées
    const selectedCampaignsData = allCampaigns.filter(campaign => 
      selectedCampaigns.includes(campaign.id)
    );
    
    if (selectedCampaignsData.length > 0) {
      const totalCost = selectedCampaignsData.reduce((sum, c) => sum + (c.cost || 0), 0);
      
      // Calculer les revenus
      const appData = DataManager.getAppData();
      const clientsGoogleAds = appData.clients.filter(client => 
        client.canalAcquisition === 'google-ads'
      );
      const prestationsGoogleAds = appData.prestations.filter(prestation => {
        const client = appData.clients.find(c => c.id === prestation.clientId);
        return client && client.canalAcquisition === 'google-ads';
      });
      const totalRevenue = prestationsGoogleAds.reduce((sum, p) => sum + (p.prix || 0) + (p.tips || 0), 0);
      
      // METTRE À JOUR LE CACHE avec les vraies données
      parametres.googleAdsCachedCosts = {
        total: totalCost, // ✅ VRAIES données API (253€ et quelques)
        revenue: totalRevenue,
        clientsCount: clientsGoogleAds.length,
        prestationsCount: prestationsGoogleAds.length,
        currentMonth: totalCost / 4,
        lastUpdate: new Date().toISOString()
      };
      
      DataManager.saveParametres(parametres);
      await DataManager.saveData();
      
      console.log('✅ Cache mis à jour avec:', totalCost + '€');
      
      // Rafraîchir l'affichage
      updateGoogleAdsAnalytics();
      
    } else {
      console.log('❌ Aucune campagne trouvée dans l\'API');
    }
    
  } catch (error) {
    console.error('❌ Erreur sync cache:', error);
  }
}

// ✅ Fonction pour calculer le nombre de clients UNIQUES par campagne (DÉDUPLICATION)
function calculateUniqueCampaignClients(campaignsData, period = 'all') {
  if (!campaignsData || campaignsData.length === 0) return 0;
  
  const appData = DataManager.getAppData();
  const uniqueClientIds = new Set();
  
  // Calculer les dates limites selon la période
  let startDate = null;
  let endDate = new Date();
  
  if (period !== 'all') {
    if (period === 'THIS_MONTH') {
      // Début du mois actuel
      startDate = new Date(endDate.getFullYear(), endDate.getMonth(), 1);
    } else if (period === 'LAST_MONTH') {
      // Mois dernier
      startDate = new Date(endDate.getFullYear(), endDate.getMonth() - 1, 1);
      endDate = new Date(endDate.getFullYear(), endDate.getMonth(), 0);
    } else if (period === 'TODAY') {
      startDate = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate());
    } else if (period === 'YESTERDAY') {
      startDate = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate() - 1);
      endDate = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate() - 1, 23, 59, 59);
    } else {
      // Période numérique (7, 30, etc.)
      const days = parseInt(period);
      startDate = new Date();
      startDate.setDate(startDate.getDate() - days);
    }
  }
  
  // Filtrer les clients Google Ads avec prestations dans la période
  const clientsGoogleAds = appData.clients.filter(client => {
    // Vérifier si le client a le canal google-ads
    if (client.canalAcquisition !== 'google-ads') return false;
    
    // Vérifier si le client a des prestations dans la période
    const clientPrestations = appData.prestations.filter(p => {
      if (p.clientId !== client.id) return false;
      
      // Si période = 'all', compter toutes les prestations
      if (period === 'all') return true;
      
      const prestationDate = new Date(p.date);
      
      if (startDate && prestationDate < startDate) return false;
      if (endDate && prestationDate > endDate) return false;
      
      return true;
    });
    
    return clientPrestations.length > 0;
  });
  
  // Ajouter les IDs au Set (déduplication automatique)
  clientsGoogleAds.forEach(client => uniqueClientIds.add(client.id));
  
  console.log(`📊 Clients uniques calculés: ${uniqueClientIds.size} clients pour ${campaignsData.length} campagne(s) [période: ${period}]`);
  return uniqueClientIds.size;
}

// ===== ARTEFACT 1 : Fonction à ajouter dans utils-services.js =====

// ✅ Fonction pour récupérer les coûts Google Ads du mois calendaire (THIS_MONTH)
async function getGoogleAdsCostsThisMonth() {
  try {
    console.log('💰 Récupération coûts Google Ads THIS_MONTH...');
    
    const parametres = DataManager.getParametres();
    const selectedCampaigns = parametres.googleAdsSelectedCampaigns || [];
    
    if (selectedCampaigns.length === 0 || !parametres.googleAdsConnected) {
      console.log('❌ Google Ads non connecté ou pas de campagnes');
      return 0;
    }
    
    // Récupérer les tokens
    const tokens = await getValidTokens();
    if (!tokens) {
      console.warn('⚠️ Pas de tokens Google Ads disponibles');
      return 0;
    }
    
    // Récupérer les comptes
    const customersResult = await testAccessibleCustomers(tokens.access_token);
    if (!customersResult.success) {
      console.warn('⚠️ Comptes Google Ads non accessibles');
      return 0;
    }
    
    // Récupérer les campagnes avec THIS_MONTH
    const allCampaigns = [];
    for (const customerId of customersResult.customers) {
      try {
        const campaigns = await getCampaignsForCustomerWithPeriod(tokens.access_token, customerId, 'THIS_MONTH');
        allCampaigns.push(...campaigns);
      } catch (error) {
        console.error(`❌ Erreur récupération campagnes ${customerId}:`, error);
      }
    }
    
    // Filtrer les campagnes sélectionnées
    const selectedCampaignsData = allCampaigns.filter(campaign => 
      selectedCampaigns.includes(campaign.id)
    );
    
    // Calculer le coût total
    const totalCostThisMonth = selectedCampaignsData.reduce((sum, c) => sum + (c.cost || 0), 0);
    
    console.log(`✅ Coûts Google Ads THIS_MONTH: ${totalCostThisMonth.toFixed(2)}€`);
    
    return totalCostThisMonth;
    
  } catch (error) {
    console.error('❌ Erreur getGoogleAdsCostsThisMonth:', error);
    return 0; // Retourner 0 en cas d'erreur
  }
}

// ===== EXPORTS GLOBAUX =====
window.UtilsServices = {
  // OpenRouteService
  testOpenRouteServiceKey,
  saveAndTestApiKey,
  clearApiKey,
  clearDistanceCache,
  generateApiKeySection,
  
  // Export/Import
  exportDataUI,
  importDataUI,
  exportCalendar,
  
  // Migration
  executerMigration,
  
  // Analytics
  updateAnalytics,
  updateFilterAmountsDisplay,
  setupDynamicFilters,
  setupYearSelector,
  updateRevenueChart,
  updatePrestationsChart,
  updateDureesChart,
  updateKeyStats,
  updateMoyensPaiementChart,
  updateCanalsChart,
  updateCanauxRevenusTable,
  updateGoogleAdsAnalytics,
  updateGenreChart,
  
  // Google Ads Analytics avec période
loadAndDisplayCampaignsDataWithPeriod,
getCampaignsForCustomerWithPeriod,
generateFinalCampaignsTableWithPeriod,
  getGoogleAdsCostsThisMonth,
  
  // Prestation depuis dépense
  showPrestationFromDepense,
  
  // Messages
  showCustomAlert,
  showCustomConfirm,
  showTemporaryMessage,
  
  // Validation
  validateFormData,
  
  // Recherche
  performGlobalSearch,
  
  // Rapports
  generateBusinessReport,
  
  setupDepensesSearch
};

// Fonctions globales pour l'HTML
window.exportDataUI = exportDataUI;
window.importDataUI = importDataUI;
window.exportCalendar = exportCalendar;
window.executerMigration = executerMigration;
window.showPrestationFromDepense = showPrestationFromDepense;
window.showCustomAlert = showCustomAlert;
window.showCustomConfirm = showCustomConfirm;
window.showTemporaryMessage = showTemporaryMessage;
window.saveAndTestApiKey = saveAndTestApiKey;
window.clearApiKey = clearApiKey;
window.clearDistanceCache = clearDistanceCache;
window.toggleGoogleAdsClients = toggleGoogleAdsClients;
window.loadAndDisplayCampaignsData = loadAndDisplayCampaignsData;
window.reloadCampaignsNow = reloadCampaignsNow;
window.changeCampaignPeriod = changeCampaignPeriod;
window.loadAndDisplayCampaignsDataWithPeriod = loadAndDisplayCampaignsDataWithPeriod;
window.getCampaignsForCustomerWithPeriod = getCampaignsForCustomerWithPeriod;
window.generateFinalCampaignsTableWithPeriod = generateFinalCampaignsTableWithPeriod;
window.syncGoogleAdsCacheOnce = syncGoogleAdsCacheOnce;

console.log('✅ UtilsServices chargé avec', Object.keys(window.UtilsServices).length, 'fonctions');