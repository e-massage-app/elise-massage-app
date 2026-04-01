// ===== js/app.js =====
// Point d'entree principal de l'application - Version PWA

// ===== VARIABLES GLOBALES POUR DUPLICATION =====
window.lastRdvData = null;
window.lastPrestationData = null;

// ===== GESTION OFFLINE =====
function showOfflineOverlay() {
  if (document.getElementById('offline-overlay')) return;
  const overlay = document.createElement('div');
  overlay.id = 'offline-overlay';
  overlay.innerHTML = `
    <div style="text-align: center; padding: 2rem;">
      <div style="font-size: 3rem; margin-bottom: 1rem;">&#128268;</div>
      <h2 style="margin-bottom: 0.5rem; color: #d4a574;">Connexion internet requise</h2>
      <p style="margin-bottom: 1.5rem; color: rgba(245,240,232,0.7);">
        L'application necessite une connexion internet pour fonctionner.
        <br>Verifiez votre connexion et rechargez la page.
      </p>
      <button onclick="window.location.reload()" style="
        padding: 0.75rem 2rem; background: linear-gradient(135deg, #d4a574, #c4956a);
        color: #1a1a2e; border: none; border-radius: 8px; font-size: 1rem;
        font-weight: 600; cursor: pointer;">
        Recharger
      </button>
    </div>
  `;
  overlay.style.cssText = `
    position: fixed; top: 0; left: 0; width: 100%; height: 100%;
    background: rgba(26,26,46,0.97); z-index: 99999;
    display: flex; align-items: center; justify-content: center;
    font-family: 'Segoe UI', system-ui, sans-serif; color: #F5F0E8;
  `;
  document.body.appendChild(overlay);
}

function hideOfflineOverlay() {
  const overlay = document.getElementById('offline-overlay');
  if (overlay) overlay.remove();
}

window.addEventListener('offline', showOfflineOverlay);
window.addEventListener('online', hideOfflineOverlay);

// ===== SERVICE WORKER =====
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js')
    .then(() => console.log('Service Worker enregistre'))
    .catch(err => console.warn('Service Worker erreur:', err));
}

// ===== INITIALISATION =====
document.addEventListener('DOMContentLoaded', async () => {
  console.log('Initialisation de l\'application PWA...');

  // Verifier la connexion
  if (!navigator.onLine) {
    showOfflineOverlay();
    return;
  }

  // Verifier l'authentification
  try {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session) {
      window.location.href = 'login.html';
      return;
    }
  } catch (error) {
    console.error('Erreur verification session:', error);
    window.location.href = 'login.html';
    return;
  }

  try {
    // Chargement des donnees depuis Supabase
    const dataLoaded = await DataManager.loadData();
    if (dataLoaded) {
      console.log('Donnees chargees avec succes');

      // Synchronisation Google Ads au demarrage (silencieuse)
      await syncGoogleAdsCostsOnStartup();

      // Initialiser le dashboard par defaut
      ViewManager.updateDashboard();

      // Initialiser les analytics
      UtilsServices.updateAnalytics();

      // Setup de la recherche clients
      ClientServices.setupClientSearch();

      // Initialiser les controles de vue de l'annuaire
      ViewManager.initAnnuaireViewControls();

      UtilsServices.setupDepensesSearch();

      // Generation automatique des depenses d'abonnement
      if (typeof genererDepensesAbonnements === 'function') {
        await genererDepensesAbonnements();
      }

      // Setup des formulaires
      setupFormListeners();

      setTimeout(() => {
        document.body.style.opacity = '1';
        document.body.classList.add('loaded');
      }, 200);

    } else {
      console.error('Erreur lors du chargement des donnees');
    }
  } catch (error) {
    console.error('Erreur d\'initialisation:', error);
  }
});

async function syncGoogleAdsCostsOnStartup() {
  try {
    const parametres = DataManager.getParametres();
    if (!parametres.googleAdsConnected) return;

    const lastSync = parametres.googleAdsCostsLastSync;
    const today = new Date().toDateString();
    if (lastSync === today) return;

    console.log('Synchronisation des couts Google Ads...');
    const costs = await fetchGoogleAdsCostsSilent();

    if (costs.success) {
      parametres.googleAdsCachedCosts = costs.data;
      parametres.googleAdsCostsLastSync = today;
      DataManager.saveParametres(parametres);
      console.log('Couts Google Ads synchronises');
    }
  } catch (error) {
    console.error('Erreur sync Google Ads startup:', error);
  }
}

async function fetchGoogleAdsCostsSilent() {
  try {
    const parametres = DataManager.getParametres();
    const selectedCampaigns = parametres.googleAdsSelectedCampaigns || [];
    if (selectedCampaigns.length === 0) return { success: false, error: 'Aucune campagne selectionnee' };

    const tokens = await getValidTokens();
    if (!tokens) return { success: false, error: 'Tokens non disponibles' };

    const customersResult = await testAccessibleCustomers(tokens.access_token);
    if (!customersResult.success) return { success: false, error: 'Comptes non accessibles' };

    let totalCost = 0;
    let totalRevenue = 0;
    let currentMonthCost = 0;
    const monthlyBreakdown = {};

    for (const customerId of customersResult.customers) {
      try {
        const campaigns = await getCampaignsForCustomer(tokens.access_token, customerId);
        const selectedCampaignsData = campaigns.filter(c => selectedCampaigns.includes(c.id));
        selectedCampaignsData.forEach(campaign => {
          totalCost += campaign.cost || 0;
          const now = new Date();
          const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
          currentMonthCost += (campaign.cost || 0) / 12;
          if (!monthlyBreakdown[currentMonth]) monthlyBreakdown[currentMonth] = 0;
          monthlyBreakdown[currentMonth] += (campaign.cost || 0) / 12;
        });
      } catch (error) {
        console.error(`Erreur campagnes ${customerId}:`, error);
      }
    }

    const appData = DataManager.getAppData();
    const clientsGoogleAds = appData.clients.filter(client => client.canalAcquisition === 'google-ads');
    const prestationsGoogleAds = appData.prestations.filter(prestation => {
      const client = appData.clients.find(c => c.id === prestation.clientId);
      return client && client.canalAcquisition === 'google-ads';
    });
    totalRevenue = prestationsGoogleAds.reduce((sum, p) => sum + (p.prix || 0) + (p.tips || 0), 0);

    return {
      success: true,
      data: {
        total: totalCost, currentMonth: currentMonthCost, monthlyBreakdown,
        revenue: totalRevenue, clientsCount: clientsGoogleAds.length,
        prestationsCount: prestationsGoogleAds.length, lastUpdate: new Date().toISOString()
      }
    };
  } catch (error) {
    console.error('Erreur fetchGoogleAdsCostsSilent:', error);
    return { success: false, error: error.message };
  }
}


function captureFormData(type) {
  if (type === 'rdv') {
    const appData = DataManager.getAppData();
    const clientId = document.getElementById('rdv-client').value;
    const client = appData.clients.find(c => c.id === clientId);
    const rdvTypeEl = document.getElementById('rdv-type');
    window.lastRdvData = {
      clientId, clientNom: client ? `${client.prenom} ${client.nom}` : '',
      date: document.getElementById('rdv-date').value,
      heure: document.getElementById('rdv-heure').value,
      type: rdvTypeEl.options[rdvTypeEl.selectedIndex]?.text || rdvTypeEl.value,
      soinId: rdvTypeEl.value,
      duree: DataManager.getDureeValue('rdv'),
      statut: document.getElementById('rdv-statut').value,
      notes: document.getElementById('rdv-notes').value,
      adresseMassage: document.getElementById('rdv-adresse-massage').value,
      distanceKm: parseFloat(document.getElementById('rdv-distance').value) || 0,
      fraisDeplacement: parseFloat(document.getElementById('rdv-frais').value) || 0,
      sexe: document.getElementById('rdv-sexe').value || ''
    };
  } else if (type === 'prestation') {
    const appData = DataManager.getAppData();
    const clientId = document.getElementById('prestation-client').value;
    const client = appData.clients.find(c => c.id === clientId);
    const prestaTypeEl = document.getElementById('prestation-type');
    window.lastPrestationData = {
      clientId, clientNom: client ? `${client.prenom} ${client.nom}` : '',
      date: document.getElementById('prestation-date').value,
      heure: document.getElementById('prestation-heure').value,
      type: prestaTypeEl.options[prestaTypeEl.selectedIndex]?.text || prestaTypeEl.value,
      soinId: prestaTypeEl.value,
      duree: document.getElementById('prestation-duree-value') ?
             parseInt(document.getElementById('prestation-duree-value').value) :
             DataManager.getDureeValue('prestation'),
      prix: parseFloat(document.getElementById('prestation-prix').value) || 0,
      tips: parseFloat(document.getElementById('prestation-tips').value) || 0,
      notes: document.getElementById('prestation-notes').value,
      adresseMassage: document.getElementById('prestation-adresse-massage').value,
      distanceKm: parseFloat(document.getElementById('prestation-distance').value) || 0,
      fraisDeplacement: parseFloat(document.getElementById('prestation-frais').value) || 0
    };
  }
}

// ===== SETUP DES FORMULAIRES =====
function setupFormListeners() {
  document.addEventListener('submit', async (e) => {
    // RDV Form
    if (e.target.id === 'rdv-form') {
      e.preventDefault();
      const rdvTypeSelect = document.getElementById('rdv-type');
      const formData = {
        id: document.getElementById('rdv-id').value,
        clientId: document.getElementById('rdv-client').value,
        date: document.getElementById('rdv-date').value,
        heure: document.getElementById('rdv-heure').value,
        type: rdvTypeSelect.options[rdvTypeSelect.selectedIndex]?.text || rdvTypeSelect.value,
        soinId: rdvTypeSelect.value,
        duree: DataManager.getDureeValue('rdv'),
        statut: document.getElementById('rdv-statut').value,
        notes: document.getElementById('rdv-notes').value,
        adresseMassage: document.getElementById('rdv-adresse-massage').value,
        distanceKm: parseFloat(document.getElementById('rdv-distance').value) || 0,
        fraisDeplacement: parseFloat(document.getElementById('rdv-frais').value) || 0,
        sexe: document.getElementById('rdv-sexe').value || ''
      };
      captureFormData('rdv');
      BusinessServices.createRdv(formData);
      ModalManager.closeModal();
      ViewManager.updateCalendar();
      ViewManager.updateDashboard();
    }

    // Client Form
    if (e.target.id === 'client-form') {
      e.preventDefault();
      const type = document.getElementById('client-type').value;
      const formData = {
        id: document.getElementById('client-id').value,
        nom: document.getElementById('client-nom').value,
        prenom: document.getElementById('client-prenom').value,
        societe: document.getElementById('client-societe')?.value || '',
        telephone: document.getElementById('client-telephone')?.value || '',
        email: document.getElementById('client-email')?.value || '',
        sexe: document.getElementById('client-sexe')?.value || '',
        ville: document.getElementById('client-ville')?.value || '',
        adresse: document.getElementById('client-adresse')?.value || '',
        notes: document.getElementById('client-notes')?.value || '',
        parrain: document.getElementById('client-parrain')?.value || null,
        canalAcquisition: document.getElementById('client-canal-acquisition')?.value || 'non-renseigne',
        dateAcquisition: document.getElementById('client-id').value ? undefined : new Date().toISOString().split('T')[0]
      };

      if (type === 'client') {
        formData.huiles = document.getElementById('client-huiles').value;
        formData.zones = document.getElementById('client-zones').value;
        formData.allergies = document.getElementById('client-allergies').value;
        formData.pression = document.getElementById('client-pression').value;
      } else {
        formData.statut = document.getElementById('prospect-statut').value;
        formData.actions = {
          email: document.getElementById('prospect-email-fait')?.checked || false,
          emailDate: document.getElementById('prospect-email-date')?.value || '',
          telephone: document.getElementById('prospect-telephone-fait')?.checked || false,
          telephoneDate: document.getElementById('prospect-telephone-date')?.value || '',
          relance: document.getElementById('prospect-relance-fait')?.checked || false,
          relanceDate: document.getElementById('prospect-relance-date')?.value || ''
        };
      }

      const editingId = DataManager.getEditingId();
      if (editingId) {
        const appData = DataManager.getAppData();
        const collection = type === 'client' ? appData.clients : appData.prospects;
        const existingPerson = collection.find(p => p.id === editingId);
        if (existingPerson) {
          const originalTags = existingPerson.tags || [];
          Object.assign(existingPerson, formData);
          existingPerson.tags = originalTags;
          // Sauvegarder vers Supabase
          const table = type === 'client' ? 'clients' : 'prospects';
          const mapFn = type === 'client' ? DataManager.mapClientToDb : DataManager.mapProspectToDb;
          await DataManager.updateEntity(table, editingId, existingPerson, mapFn);
          DataManager.setEditingId(null);
          ModalManager.closeModal();
          ViewManager.updateClientsDisplay();
          return;
        }
      }

      ClientServices.createClient(formData, type);
      ModalManager.closeModal();
      ViewManager.updateClientsDisplay();
    }

    // Prestation Form
    if (e.target.id === 'prestation-form') {
      e.preventDefault();
      const rdvSourceId = document.getElementById('prestation-form').getAttribute('data-rdv-source');
      const moyenPaiement = document.getElementById('prestation-moyen-paiement').value;
      const bonCadeauId = moyenPaiement === 'Bon cadeau' ?
        (document.getElementById('prestation-bon-cadeau-id')?.value ||
         document.getElementById('prestation-bon-cadeau')?.value || null) : null;

      const prestaTypeSelect = document.getElementById('prestation-type');
      const formData = {
        id: document.getElementById('prestation-id').value,
        date: document.getElementById('prestation-date').value,
        heure: document.getElementById('prestation-heure').value,
        clientId: document.getElementById('prestation-client').value,
        type: prestaTypeSelect.options[prestaTypeSelect.selectedIndex]?.text || prestaTypeSelect.value,
        soinId: prestaTypeSelect.value,
        duree: document.getElementById('prestation-duree-value') ?
               parseInt(document.getElementById('prestation-duree-value').value) :
               DataManager.getDureeValue('prestation'),
        prix: parseFloat(document.getElementById('prestation-prix').value) || 0,
        tips: parseFloat(document.getElementById('prestation-tips').value) || 0,
        notes: document.getElementById('prestation-notes').value,
        isTransformed: !!rdvSourceId,
        adresseMassage: document.getElementById('prestation-adresse-massage').value,
        distanceKm: parseFloat(document.getElementById('prestation-distance').value) || 0,
        fraisDeplacement: parseFloat(document.getElementById('prestation-frais').value) || 0,
        moyenPaiement: moyenPaiement,
        bonCadeauId: bonCadeauId
      };

      if (rdvSourceId) {
        BusinessServices.transformRdvToPrestation(rdvSourceId);
        document.getElementById('prestation-form').removeAttribute('data-rdv-source');
      }

      captureFormData('prestation');
      const prestation = BusinessServices.createPrestation(formData);

      if (bonCadeauId && prestation) {
        BusinessServices.utiliserBonCadeau(bonCadeauId, prestation.id);
      }

      ModalManager.closeModal();
      ViewManager.updatePrestationsTable();
      ViewManager.updateDashboard();
      ViewManager.updateCalendar();
      UtilsServices.updateAnalytics();

      if (typeof ViewManager.updateBonsCadeauxDisplay === 'function') {
        ViewManager.updateBonsCadeauxDisplay();
      }
    }

    // Parametres Form
    if (e.target.id === 'parametres-form') {
      return;
    }

    // Depenses Form
    if (e.target.id === 'depenses-form') {
      e.preventDefault();
      const formData = {
        id: document.getElementById('depense-id').value,
        date: document.getElementById('depense-date').value,
        montant: parseFloat(document.getElementById('depense-montant').value) || 0,
        categorie: document.getElementById('depense-categorie').value,
        fournisseur: document.getElementById('depense-fournisseur').value,
        description: document.getElementById('depense-description').value,
        notes: document.getElementById('depense-notes').value
      };

      BusinessServices.createDepense(formData);
      ModalManager.closeModal();
      ViewManager.updateDepensesDisplay();
      ViewManager.updateDashboard();
      UtilsServices.updateAnalytics();
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      const activeModal = document.querySelector('.modal.active');
      if (activeModal) {
        ModalManager.closeModal();
      }
    }
  });
}

// ===== FONCTIONS GLOBALES EXPOSEES =====
window.showTab = ViewManager.showTab;
window.previousMonth = ViewManager.previousMonth;
window.nextMonth = ViewManager.nextMonth;
window.toggleCustomizeMode = ViewManager.toggleCustomizeMode;
window.saveDashboardConfig = ViewManager.saveDashboardConfig;
window.showParametresModal = ModalManager.showParametresModal;
window.showAddRdvModal = ModalManager.showAddRdvModal;
window.showAddPrestationModal = ModalManager.showAddPrestationModal;
window.showAddClientModal = ModalManager.showAddClientModal;
window.showAddProspectModal = ModalManager.showAddProspectModal;
window.showAddDepenseModal = ModalManager.showAddDepenseModal;
window.captureFormData = captureFormData;
window.exportDataUI = UtilsServices.exportDataUI;
window.importDataUI = UtilsServices.importDataUI;
window.exportCalendar = UtilsServices.exportCalendar;
window.executerMigration = UtilsServices.executerMigration;
window.closeModal = ModalManager.closeModal;

// Deconnexion
window.logout = async () => {
  if (confirm('Voulez-vous vous deconnecter ?')) {
    await Auth.logout();
  }
};

console.log('App.js PWA charge');
