// ===== js/ui/modal-manager.js =====
// Gestion des modales et templates avec système de duplication

console.log('🔄 Chargement de modal-manager.js...');

// ===== HELPERS CARTE DES SOINS DYNAMIQUE =====

function generateTypeOptions(selectedSoinId, selectedLegacyType) {
  const carte = DataManager.getCarteSoins();
  if (!carte) {
    // Fallback si carte pas encore migrée
    return `
      <option value="Massage sur mesure" ${selectedLegacyType === 'Massage sur mesure' ? 'selected' : ''}>Massage sur mesure</option>
      <option value="Les Rituels" ${selectedLegacyType === 'Les Rituels' ? 'selected' : ''}>Les Rituels</option>
      <option value="HeadSpa" ${selectedLegacyType === 'HeadSpa' ? 'selected' : ''}>HeadSpa</option>
    `;
  }

  const grouped = DataManager.getSoinsGroupedByCategorie();
  let html = '';

  grouped.forEach(cat => {
    html += `<optgroup label="${cat.nom}">`;
    cat.soins.forEach(soin => {
      const isSelected = (selectedSoinId && soin.id === selectedSoinId) ||
                         (!selectedSoinId && selectedLegacyType && soin.nom === selectedLegacyType);
      html += `<option value="${soin.id}" ${isSelected ? 'selected' : ''}>${soin.nom}</option>`;
    });
    html += `</optgroup>`;
  });

  return html;
}

function generateDureeOptions(soinId, selectedDuree) {
  const soin = soinId ? DataManager.getSoinById(soinId) : null;

  if (soin && soin.variantes && soin.variantes.length > 0) {
    let html = '';
    soin.variantes.forEach(v => {
      const isSelected = parseInt(selectedDuree) === v.duree;
      html += `<option value="${v.duree}" ${isSelected ? 'selected' : ''}>${v.duree} minutes</option>`;
    });
    return html;
  }

  // Fallback générique
  const defaultDurees = [30, 45, 60, 90, 120];
  let html = '';
  defaultDurees.forEach(d => {
    const isSelected = parseInt(selectedDuree) === d || (!selectedDuree && d === 60);
    html += `<option value="${d}" ${isSelected ? 'selected' : ''}>${d} minutes</option>`;
  });
  html += `<option value="autre" ${selectedDuree && !defaultDurees.includes(parseInt(selectedDuree)) ? 'selected' : ''}>Autre</option>`;
  return html;
}

function handleTypeChange(prefix) {
  const typeSelect = document.getElementById(`${prefix}-type`);
  const clientSearch = document.getElementById(`${prefix}-client-search`);
  const clientHidden = document.getElementById(`${prefix}-client`);
  const dureeSelect = document.getElementById(`${prefix}-duree`);
  const prixInput = document.getElementById(`${prefix}-prix`);
  const dureeAutre = document.getElementById(`${prefix}-duree-autre`);
  const dureeValue = document.getElementById(`${prefix}-duree-value`);

  if (!typeSelect) return;

  const soinId = typeSelect.value;
  const soin = DataManager.getSoinById(soinId);

  if (!soin) return;

  const isPartnership = soin.isPartnership === true;

  // --- Gestion client partenariat (auto-remplir collaborateur) ---
  if (isPartnership && soin.partenaireCollaborateurId) {
    const collab = DataManager.getCollaborateurById(soin.partenaireCollaborateurId);
    if (collab && clientSearch) {
      clientSearch.value = `${collab.prenom} ${collab.nom || ''} - ${collab.entreprise || ''}`.trim();
      clientSearch.disabled = true;
      clientSearch.style.backgroundColor = '#f5f5f5';
      clientSearch.style.cursor = 'not-allowed';
    }
    if (collab && clientHidden) {
      clientHidden.value = collab.id;
    }
  } else {
    // Réactiver le champ client si on sort d'un partenariat
    if (clientSearch && clientSearch.disabled) {
      clientSearch.disabled = false;
      clientSearch.style.backgroundColor = '';
      clientSearch.style.cursor = '';
      // Vider le client seulement si c'était un collaborateur
      const currentClientId = clientHidden ? clientHidden.value : '';
      const collab = currentClientId ? DataManager.getCollaborateurById(currentClientId) : null;
      if (collab) {
        clientSearch.value = '';
        if (clientHidden) clientHidden.value = '';
      }
    }
  }

  // --- Mise à jour des durées ---
  if (dureeSelect && soin.variantes && soin.variantes.length > 0) {
    const currentDuree = dureeSelect.value;
    dureeSelect.innerHTML = generateDureeOptions(soinId, currentDuree);

    // Sélectionner la première durée si l'actuelle n'est plus disponible
    if (!dureeSelect.querySelector(`option[value="${currentDuree}"]`)) {
      dureeSelect.selectedIndex = 0;
    }

    // Masquer le champ "autre" puisque les durées sont définies par le soin
    if (dureeAutre) dureeAutre.style.display = 'none';

    // Mettre à jour le hidden value
    if (dureeValue) {
      dureeValue.value = dureeSelect.value;
    }
  }

  // --- Mise à jour automatique du prix ---
  updatePrixFromSoin(prefix);

  // --- Listener pour mise à jour du prix quand la durée change ---
  if (dureeSelect) {
    dureeSelect.onchange = function() {
      if (dureeValue) dureeValue.value = dureeSelect.value;
      updatePrixFromSoin(prefix);
    };
  }
}

function updatePrixFromSoin(prefix) {
  const typeSelect = document.getElementById(`${prefix}-type`);
  const dureeSelect = document.getElementById(`${prefix}-duree`);
  const prixInput = document.getElementById(`${prefix}-prix`);

  if (!typeSelect || !dureeSelect) return;

  const soinId = typeSelect.value;
  const duree = parseInt(dureeSelect.value);

  if (!soinId || !duree) return;

  const prix = DataManager.getPrixForSoinVariante(soinId, duree);

  if (prix !== null && prixInput) {
    prixInput.value = prix;
  }
}

// ===== FONCTION GÉNÉRATION BONS DE TEST (définie tôt pour être disponible) =====
window.genererBonsTest = function() {
  if (!confirm('Générer 3 bons cadeaux de test ? (1 actif, 1 expirant bientôt, 1 expiré)')) {
    return;
  }

  const today = new Date();
  const appData = DataManager.getAppData();

  // Bon 1 : Actif normal
  const bon1 = {
    id: 'bc_test_' + Date.now() + '_1',
    dateAchat: today.toISOString().split('T')[0],
    dateDebut: today.toISOString().split('T')[0],
    dateExpiration: DataManager.calculerDateExpiration(today.toISOString().split('T')[0]),
    acheteurNom: 'Test Acheteur',
    acheteurClientId: null,
    acheteurTelephone: '06 00 00 00 01',
    acheteurEmail: 'test@exemple.com',
    beneficiaireNom: 'Test Bénéficiaire',
    beneficiaireClientId: null,
    description: 'Massage Aromathérapie 60min',
    montant: 70,
    moyenPaiement: 'Carte bleue',
    statut: 'actif',
    prestationId: null,
    dateUtilisation: null,
    forceUtilise: false,
    notes: 'Bon de test généré automatiquement',
    createdAt: new Date().toISOString()
  };

  // Bon 2 : Expire dans 10 jours
  const dateExpireBientot = new Date();
  dateExpireBientot.setDate(dateExpireBientot.getDate() + 10);
  const bon2 = {
    id: 'bc_test_' + Date.now() + '_2',
    dateAchat: new Date(today.getTime() - 5 * 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    dateDebut: new Date(today.getTime() - 5 * 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    dateExpiration: dateExpireBientot.toISOString().split('T')[0],
    acheteurNom: 'Pierre Test',
    acheteurClientId: null,
    acheteurTelephone: '',
    acheteurEmail: '',
    beneficiaireNom: '',
    beneficiaireClientId: null,
    description: 'Massage sur mesure 90min',
    montant: 130,
    moyenPaiement: 'Liquide',
    statut: 'actif',
    prestationId: null,
    dateUtilisation: null,
    forceUtilise: false,
    notes: 'Expire bientôt - BON DE TEST',
    createdAt: new Date().toISOString()
  };

  // Bon 3 : Expiré
  const dateExpiree = new Date();
  dateExpiree.setMonth(dateExpiree.getMonth() - 1);
  const bon3 = {
    id: 'bc_test_' + Date.now() + '_3',
    dateAchat: new Date(today.getTime() - 7 * 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    dateDebut: new Date(today.getTime() - 7 * 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    dateExpiration: dateExpiree.toISOString().split('T')[0],
    acheteurNom: 'Client Ancien Test',
    acheteurClientId: null,
    acheteurTelephone: '',
    acheteurEmail: '',
    beneficiaireNom: 'Test Expiré',
    beneficiaireClientId: null,
    description: 'Les Rituels 120min',
    montant: 200,
    moyenPaiement: 'Carte bleue',
    statut: 'expire',
    prestationId: null,
    dateUtilisation: null,
    forceUtilise: false,
    notes: 'Bon expiré - BON DE TEST',
    createdAt: new Date().toISOString()
  };

  if (!appData.bonsCadeaux) appData.bonsCadeaux = [];
  appData.bonsCadeaux.push(bon1, bon2, bon3);

  DataManager.saveData();
  if (typeof ViewManager !== 'undefined' && ViewManager.updateBonsCadeauxDisplay) {
    ViewManager.updateBonsCadeauxDisplay();
  }
  if (typeof showTemporaryMessage === 'function') {
    showTemporaryMessage('3 bons de test générés !');
  } else {
    alert('3 bons de test générés !');
  }
};

console.log('✅ genererBonsTest défini');

// ===== GESTION DES MODALES =====
function showModal(modalId, content = null) {
  console.log('📝 showModal appelée:', modalId);

  const overlay = document.getElementById('modal-overlay');

  // Desactiver et supprimer les modales precedentes (swap sans flash)
  const previousModals = overlay.querySelectorAll('.modal.active');
  previousModals.forEach(m => {
    m.classList.remove('active');
    m.remove();
  });
  // Supprimer aussi les modales inactives du meme id
  const existingModal = document.getElementById(modalId);
  if (existingModal && content) {
    existingModal.remove();
  }

  // Créer la nouvelle modale avec le contenu
  let modal;
  if (content) {
    modal = createDynamicModal(modalId, content);
  } else {
    modal = document.getElementById(modalId);
    if (!modal) {
      modal = createDynamicModal(modalId, content);
    }
  }

  overlay.classList.add('active');
  modal.classList.add('active');

  // Activer les inputs pour Electron
  setTimeout(() => {
    const allInputs = modal.querySelectorAll('input, textarea, select');
    allInputs.forEach(input => {
      input.removeAttribute('readonly');
      input.removeAttribute('disabled');
      input.style.pointerEvents = 'auto';
      input.style.cursor = 'text';
    });

    // Focus sur le premier input
    const firstInput = modal.querySelector('input:not([type="hidden"]), textarea, select');
    if (firstInput) {
      firstInput.focus();
      firstInput.click();
    }
  }, 100);
}

// Stack de navigation modale pour retour contextuel
let modalNavigationStack = [];

function closeModal() {
  console.log('❌ closeModal appelée');

  // Si on est dans une sous-modale parametres, retour au hub
  const activeModal = document.querySelector('.modal.active');
  if (activeModal) {
    const activeId = activeModal.id || '';
    if (activeId.startsWith('parametres-') && activeId !== 'parametres-modal') {
      showParametresModal();
      return;
    }
  }

  const overlay = document.getElementById('modal-overlay');
  const modals = document.querySelectorAll('.modal');

  // Animation de fermeture
  overlay.classList.remove('active');
  modals.forEach(modal => {
    modal.classList.remove('active');
  });

  // Vérification sécurisée
  if (typeof DataManager !== 'undefined' && DataManager.setEditingId) {
    DataManager.setEditingId(null);
  }

  // Reset navigation stack
  modalNavigationStack = [];

  // Supprimer les modales dynamiques après l'animation (300ms)
  setTimeout(() => {
    const dynamicModals = overlay.querySelectorAll('.modal');
    dynamicModals.forEach(modal => {
      if (!modal.classList.contains('active')) {
        modal.remove();
      }
    });
  }, 350);
}

function closeModalCompletely() {
  // Fermeture forcee sans retour au hub
  const overlay = document.getElementById('modal-overlay');
  const modals = document.querySelectorAll('.modal');

  overlay.classList.remove('active');
  modals.forEach(modal => {
    modal.classList.remove('active');
  });

  if (typeof DataManager !== 'undefined' && DataManager.setEditingId) {
    DataManager.setEditingId(null);
  }

  modalNavigationStack = [];

  setTimeout(() => {
    const dynamicModals = overlay.querySelectorAll('.modal');
    dynamicModals.forEach(modal => {
      if (!modal.classList.contains('active')) {
        modal.remove();
      }
    });
  }, 350);
}

function createDynamicModal(modalId, content) {
  const overlay = document.getElementById('modal-overlay');

  const modal = document.createElement('div');
  modal.id = modalId;
  modal.className = 'modal';
  modal.innerHTML = `
    <div class="modal-content">
      <button class="modal-close" onclick="closeModalCompletely()" title="Fermer" aria-label="Fermer la modal">
        ✕
      </button>
      ${content || '<p>Contenu modal</p>'}
    </div>
  `;

  overlay.appendChild(modal);
  return modal;
}

// ===== GESTIONNAIRE DE DUPLICATION RDV =====
window.RdvDuplication = {
  async saveAndDuplicate() {
    try {
      console.log('🔄 RdvDuplication.saveAndDuplicate démarré');
      
      // 1. Vérifications
      const clientId = document.getElementById('rdv-client').value;
      if (!clientId) {
        this.showNotification('⚠️ Veuillez sélectionner un client', 'warning');
        return;
      }
      
      const heure = document.getElementById('rdv-heure').value;
      if (!heure) {
        this.showNotification('⚠️ Veuillez saisir une heure', 'warning');
        return;
      }
      
      // 2. Récupérer les données du formulaire
      const formData = this.getFormData();
      this.showNotification('💾 Sauvegarde en cours...', 'info');
      
      // 3. Sauvegarder avec vérifications
      if (typeof BusinessServices !== 'undefined' && BusinessServices.createRdv) {
        BusinessServices.createRdv(formData);
        if (typeof DataManager !== 'undefined' && DataManager.saveData) {
          await DataManager.saveData();
        }
      } else {
        console.warn('⚠️ BusinessServices non disponible');
      }
      
      // 4. Calculer la nouvelle heure
      const newHour = this.calculateNextHour(formData.heure, formData.duree);
      
      // 5. Fermer modal et ouvrir nouvelle
      closeModal();
      
      setTimeout(() => {
        const clientSearch = document.getElementById('rdv-client-search')?.value || '';
        showAddRdvModalWithData({
          ...formData,
          heure: newHour,
          clientNom: clientSearch,
          id: null,
          adresseMassage: '', // ✅ VIDER L'ADRESSE
          distanceKm: 0,      // ✅ REMETTRE À 0
          fraisDeplacement: 0  // ✅ REMETTRE À 0
        });
        this.showNotification('✅ RDV sauvegardé ! Nouveau RDV créé pour ' + newHour, 'success');
      }, 300);
      
      // 6. Mettre à jour les vues avec vérifications
      if (typeof ViewManager !== 'undefined') {
        if (ViewManager.updateCalendar) ViewManager.updateCalendar();
        if (ViewManager.updateDashboard) ViewManager.updateDashboard();
      }
      
    } catch (error) {
      console.error('❌ Erreur duplication RDV:', error);
      this.showNotification('❌ Erreur lors de la sauvegarde', 'error');
    }
  },
  
  getFormData() {
    return {
      id: document.getElementById('rdv-id').value,
      clientId: document.getElementById('rdv-client').value,
      date: document.getElementById('rdv-date').value,
      heure: document.getElementById('rdv-heure').value,
      type: document.getElementById('rdv-type').value,
      duree: this.getDuree(),
      statut: document.getElementById('rdv-statut').value,
      notes: document.getElementById('rdv-notes').value,
      adresseMassage: document.getElementById('rdv-adresse-massage').value,
      distanceKm: parseFloat(document.getElementById('rdv-distance').value) || 0,
      fraisDeplacement: parseFloat(document.getElementById('rdv-frais').value) || 0,
      sexe: document.getElementById('rdv-sexe').value || ''
    };
  },
  
  getDuree() {
    const select = document.getElementById('rdv-duree');
    const inputAutre = document.getElementById('rdv-duree-autre');
    
    if (select.value === 'autre' && inputAutre.value) {
      return parseInt(inputAutre.value);
    }
    return parseInt(select.value) || 60;
  },
  
  calculateNextHour(currentHour, duration) {
    const [hours, minutes] = currentHour.split(':').map(Number);
    const totalMinutes = hours * 60 + minutes + duration;
    const newHours = Math.floor(totalMinutes / 60);
    const newMinutes = totalMinutes % 60;
    
    if (newHours >= 24) {
      this.showNotification('⏰ Attention : dépassement de minuit !', 'warning');
      return currentHour;
    }
    
    return `${newHours.toString().padStart(2, '0')}:${newMinutes.toString().padStart(2, '0')}`;
  },
  
  showNotification(message, type = 'info') {
    // Supprimer les anciennes notifications
    const existingNotifs = document.querySelectorAll('.duplication-notification');
    existingNotifs.forEach(notif => notif.remove());
    
    const notification = document.createElement('div');
    notification.className = 'duplication-notification';
    
    const colors = {
      success: '#28a745',
      error: '#dc3545', 
      warning: '#ffc107',
      info: '#17a2b8'
    };
    
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: ${colors[type]};
      color: white;
      padding: 1rem 1.5rem;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.2);
      z-index: 10000;
      font-weight: 600;
      max-width: 300px;
      transform: translateX(100%);
      transition: transform 0.3s ease;
    `;
    
    notification.textContent = message;
    document.body.appendChild(notification);
    
    // Animation d'entrée
    setTimeout(() => {
      notification.style.transform = 'translateX(0)';
    }, 100);
    
    // Animation de sortie
    setTimeout(() => {
      notification.style.transform = 'translateX(100%)';
      setTimeout(() => {
        if (notification.parentNode) {
          notification.parentNode.removeChild(notification);
        }
      }, 300);
    }, 3000);
  }
};

// ===== GESTIONNAIRE DE DUPLICATION PRESTATIONS =====
window.PrestationDuplication = {
  async saveAndDuplicate() {
    try {
      console.log('🔄 PrestationDuplication.saveAndDuplicate démarré');
      
      // 1. Vérifications
      const clientId = document.getElementById('prestation-client').value;
      if (!clientId) {
        this.showNotification('⚠️ Veuillez sélectionner un client', 'warning');
        return;
      }
      
      const heure = document.getElementById('prestation-heure').value;
      const prix = document.getElementById('prestation-prix').value;
      if (!heure || !prix) {
        this.showNotification('⚠️ Veuillez remplir tous les champs requis', 'warning');
        return;
      }
      
      // 2. Récupérer les données du formulaire
      const formData = this.getFormData();
      this.showNotification('💾 Sauvegarde en cours...', 'info');
      
      // 3. Sauvegarder avec vérifications
      if (typeof BusinessServices !== 'undefined' && BusinessServices.createPrestation) {
        BusinessServices.createPrestation(formData);
        if (typeof DataManager !== 'undefined' && DataManager.saveData) {
          await DataManager.saveData();
        }
      } else {
        console.warn('⚠️ BusinessServices non disponible');
      }
      
      // 4. Calculer la nouvelle heure
      const newHour = this.calculateNextHour(formData.heure, formData.duree);
      
      // 5. Fermer modal et ouvrir nouvelle
      closeModal();
      
      setTimeout(() => {
        const clientSearch = document.getElementById('prestation-client-search')?.value || '';
        showAddPrestationModalWithData({
          ...formData,
          heure: newHour,
          clientNom: clientSearch,
          id: null,
          adresseMassage: '',  // ✅ VIDER L'ADRESSE
          distanceKm: 0,       // ✅ REMETTRE À 0
          fraisDeplacement: 0   // ✅ REMETTRE À 0
        });
        this.showNotification('✅ Prestation sauvegardée ! Nouvelle prestation créée pour ' + newHour, 'success');
      }, 300);
      
      // 6. Mettre à jour les vues avec vérifications
      if (typeof ViewManager !== 'undefined') {
        if (ViewManager.updatePrestationsTable) ViewManager.updatePrestationsTable();
        if (ViewManager.updateDashboard) ViewManager.updateDashboard();
        if (ViewManager.updateCalendar) ViewManager.updateCalendar();
      }
      if (typeof UtilsServices !== 'undefined' && UtilsServices.updateAnalytics) {
        UtilsServices.updateAnalytics();
      }
      
    } catch (error) {
      console.error('❌ Erreur duplication prestation:', error);
      this.showNotification('❌ Erreur lors de la sauvegarde', 'error');
    }
  },
  
  getFormData() {
    return {
      id: document.getElementById('prestation-id').value,
      date: document.getElementById('prestation-date').value,
      heure: document.getElementById('prestation-heure').value,
      clientId: document.getElementById('prestation-client').value,
      type: document.getElementById('prestation-type').value,
      duree: this.getDuree(),
      prix: parseFloat(document.getElementById('prestation-prix').value) || 0,
      tips: parseFloat(document.getElementById('prestation-tips').value) || 0,
      moyenPaiement: document.getElementById('prestation-moyen-paiement').value,
      notes: document.getElementById('prestation-notes').value,
      adresseMassage: document.getElementById('prestation-adresse-massage').value,
      distanceKm: parseFloat(document.getElementById('prestation-distance').value) || 0,
      fraisDeplacement: parseFloat(document.getElementById('prestation-frais').value) || 0
    };
  },
  
  getDuree() {
    const select = document.getElementById('prestation-duree');
    const inputAutre = document.getElementById('prestation-duree-autre');
    
    if (select.value === 'autre' && inputAutre.value) {
      return parseInt(inputAutre.value);
    }
    return parseInt(select.value) || 60;
  },
  
  calculateNextHour(currentHour, duration) {
    const [hours, minutes] = currentHour.split(':').map(Number);
    const totalMinutes = hours * 60 + minutes + duration;
    const newHours = Math.floor(totalMinutes / 60);
    const newMinutes = totalMinutes % 60;
    
    if (newHours >= 24) {
      this.showNotification('⏰ Attention : dépassement de minuit !', 'warning');
      return currentHour;
    }
    
    return `${newHours.toString().padStart(2, '0')}:${newMinutes.toString().padStart(2, '0')}`;
  },
  
  showNotification(message, type = 'info') {
    // Réutiliser la même logique que RdvDuplication
    RdvDuplication.showNotification(message, type);
  }
};

// ===== FONCTIONS MODALES PRINCIPALES =====

function showAddRdvModal(selectedDate = null) {
  console.log('🔄 showAddRdvModal appelée');
  const dateValue = selectedDate || new Date().toISOString().split('T')[0];
  
  const modalHTML = `
    <h3>Nouveau RDV</h3>
    <form id="rdv-form">
      <input type="hidden" id="rdv-id">
      <div class="form-group">
        <label>Client</label>
        <input type="text" id="rdv-client-search" placeholder="Rechercher un client..." required style="width: 100%; padding: 0.75rem; border: 1px solid #ddd; border-radius: 6px;">
        <input type="hidden" id="rdv-client" required>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Date</label>
          <input type="date" id="rdv-date" required value="${dateValue}">
        </div>
        <div class="form-group">
          <label>Heure</label>
          <input type="time" id="rdv-heure" required>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Type de soin</label>
          <select id="rdv-type" required onchange="handleTypeChange('rdv')">
            ${generateTypeOptions(null, null)}
          </select>
        </div>
        <div class="form-group">
          <label>Durée</label>
          <select id="rdv-duree" required>
            ${generateDureeOptions(null, 60)}
          </select>
          <input type="number" id="rdv-duree-autre" placeholder="Durée en minutes" style="display: none; margin-top: 0.5rem;" min="1">
        </div>
      </div>

      <div class="form-row">
        <div class="form-group">
          <label>Statut</label>
          <select id="rdv-statut" required>
            <option value="confirmé">Confirmé</option>
            <option value="en attente">En attente</option>
            <option value="annulé">Annulé</option>
          </select>
        </div>
        <div class="form-group">
          <label>Sexe (pour statistiques)</label>
          <select id="rdv-sexe" style="width: 100%; padding: 0.75rem; border: 1px solid #ddd; border-radius: 6px;">
            <option value="">-- Non précisé --</option>
            <option value="H">Homme</option>
            <option value="F">Femme</option>
          </select>
          <small style="color: #666; font-size: 0.8rem;">💡 Pré-rempli depuis la fiche client</small>
        </div>
      </div>
      
      <div class="form-group">
        <label>Adresse du massage</label>
        <div style="position: relative;">
          <input type="text" id="rdv-adresse-massage" placeholder="Salon ou adresse du client..." style="width: 100%; padding: 0.75rem; border: 1px solid #ddd; border-radius: 6px;">
          <button type="button" onclick="if(typeof BusinessServices !== 'undefined' && BusinessServices.calculateDistanceAndCost) BusinessServices.calculateDistanceAndCost('rdv-adresse-massage', 'rdv-distance', 'rdv-frais')" style="position: absolute; right: 0.5rem; top: 50%; transform: translateY(-50%); background: var(--beige-dore); color: white; border: none; padding: 0.25rem 0.5rem; border-radius: 4px; font-size: 0.8rem; cursor: pointer;">📍 Calculer</button>
        </div>
        <input type="hidden" id="rdv-distance">
        <input type="hidden" id="rdv-frais">
        <div id="rdv-adresse-massage-result" style="margin-top: 0.5rem; font-size: 0.85rem;"></div>
        <small style="color: #666; font-size: 0.8rem;">💡 Si pas complété, aucun frais de route calculé</small>
      </div>
      
      <div class="form-group">
        <label>Notes</label>
        <textarea id="rdv-notes"></textarea>
      </div>
      
      <div class="modal-actions">
        <button type="button" class="btn-secondary" onclick="closeModal()">Annuler</button>
        <button type="submit" class="btn-primary">Enregistrer</button>
      </div>
      <div style="display: flex; justify-content: flex-end; padding-top: 1rem;">
        <button type="button" onclick="RdvDuplication.saveAndDuplicate()" style="background: var(--beige-dore); color: white; padding: 0.75rem 1.5rem; border-radius: var(--border-radius); border: none; cursor: pointer; font-weight: 500; transition: all 0.3s ease; min-width: 220px;">
          Enregistrer et dupliquer
        </button>
      </div>
    </form>
  `;
  
  showModal('rdv-modal', modalHTML);

  setTimeout(() => {
    if (typeof createClientAutocomplete !== 'undefined') {
      createClientAutocomplete('rdv-client-search', 'rdv-client');
    }
    if (typeof BusinessServices !== 'undefined' && BusinessServices.setupAutoCalculateAddress) {
      BusinessServices.setupAutoCalculateAddress('rdv-adresse-massage', 'rdv-distance', 'rdv-frais');
    }
    if (typeof setupClientAddressAutofill !== 'undefined') {
      setupClientAddressAutofill('rdv-client', 'rdv-adresse-massage');
    }
    // Initialiser durées selon le type par défaut
    handleTypeChange('rdv');
  }, 200);
}

function showAddRdvModalWithData(data = {}) {
  console.log('🔄 showAddRdvModalWithData appelée:', data);
  
  const modalHTML = `
    <h3>${data.id ? 'Modifier RDV' : 'Nouveau RDV'} ${data.clientNom ? `(${data.clientNom})` : ''}</h3>
    <form id="rdv-form">
      <input type="hidden" id="rdv-id" value="${data.id || ''}">
      <div class="form-group">
        <label>Client</label>
        <input type="text" id="rdv-client-search" placeholder="Rechercher un client..." required style="width: 100%; padding: 0.75rem; border: 1px solid #ddd; border-radius: 6px;" value="${data.clientNom || ''}">
        <input type="hidden" id="rdv-client" required value="${data.clientId || ''}">
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Date</label>
          <input type="date" id="rdv-date" required value="${data.date || new Date().toISOString().split('T')[0]}">
        </div>
        <div class="form-group">
          <label>Heure</label>
          <input type="time" id="rdv-heure" required value="${data.heure || ''}">
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Type de soin</label>
          <select id="rdv-type" required onchange="handleTypeChange('rdv')">
            ${generateTypeOptions(data.soinId, data.type)}
          </select>
        </div>
        <div class="form-group">
          <label>Durée</label>
          <select id="rdv-duree" required>
            ${generateDureeOptions(data.soinId, data.duree)}
          </select>
          <input type="number" id="rdv-duree-autre" placeholder="Durée en minutes" style="display: none; margin-top: 0.5rem;" min="1">
        </div>
      </div>
      
      <div class="form-row">
        <div class="form-group">
          <label>Statut</label>
          <select id="rdv-statut" required>
            <option value="confirmé" ${data.statut === 'confirmé' ? 'selected' : ''}>Confirmé</option>
            <option value="en attente" ${data.statut === 'en attente' ? 'selected' : ''}>En attente</option>
            <option value="annulé" ${data.statut === 'annulé' ? 'selected' : ''}>Annulé</option>
          </select>
        </div>
        <div class="form-group">
          <label>Sexe (pour statistiques)</label>
          <select id="rdv-sexe" style="width: 100%; padding: 0.75rem; border: 1px solid #ddd; border-radius: 6px;">
            <option value="" ${!data.sexe || data.sexe === '' ? 'selected' : ''}>-- Non précisé --</option>
            <option value="H" ${data.sexe === 'H' ? 'selected' : ''}>Homme</option>
            <option value="F" ${data.sexe === 'F' ? 'selected' : ''}>Femme</option>
          </select>
          <small style="color: #666; font-size: 0.8rem;">💡 Pré-rempli depuis la fiche client</small>
        </div>
      </div>
      
      <div class="form-group">
        <label>Adresse du massage</label>
        <div style="position: relative;">
          <input type="text" id="rdv-adresse-massage" placeholder="Salon ou adresse du client..." style="width: 100%; padding: 0.75rem; border: 1px solid #ddd; border-radius: 6px;" value="${data.adresseMassage || ''}">
          <button type="button" onclick="if(typeof BusinessServices !== 'undefined' && BusinessServices.calculateDistanceAndCost) BusinessServices.calculateDistanceAndCost('rdv-adresse-massage', 'rdv-distance', 'rdv-frais')" style="position: absolute; right: 0.5rem; top: 50%; transform: translateY(-50%); background: var(--beige-dore); color: white; border: none; padding: 0.25rem 0.5rem; border-radius: 4px; font-size: 0.8rem; cursor: pointer;">📍 Calculer</button>
        </div>
        <input type="hidden" id="rdv-distance" value="${data.distanceKm || ''}">
        <input type="hidden" id="rdv-frais" value="${data.fraisDeplacement || ''}">
        <div id="rdv-adresse-massage-result" style="margin-top: 0.5rem; font-size: 0.85rem;">
          ${data.adresseMassage && data.distanceKm > 0 ? `
            <div style="background: var(--beige-clair); padding: 0.5rem; border-radius: 6px; border-left: 3px solid var(--beige-dore);">
              <div style="color: var(--beige-dore); font-weight: 600; font-size: 0.85rem;">📍 Distance: ${data.distanceKm} km</div>
              <div style="color: var(--text-dark); font-weight: 600; font-size: 0.85rem;">💰 Frais estimés: ${(data.fraisDeplacement || 0).toFixed(2)} € (A/R)</div>
            </div>
          ` : ''}
        </div>
        <small style="color: #666; font-size: 0.8rem;">💡 Si pas complété, aucun frais de route calculé</small>
      </div>
      
      <div class="form-group">
        <label>Notes</label>
        <textarea id="rdv-notes">${data.notes || ''}</textarea>
      </div>
      
      <div class="modal-actions">
        <button type="button" class="btn-secondary" onclick="closeModal()">Annuler</button>
        <button type="submit" class="btn-primary">Enregistrer</button>
      </div>
      <div style="display: flex; justify-content: flex-end; padding-top: 1rem;">
        <button type="button" onclick="RdvDuplication.saveAndDuplicate()" style="background: var(--beige-dore); color: white; padding: 0.75rem 1.5rem; border-radius: var(--border-radius); border: none; cursor: pointer; font-weight: 500; transition: all 0.3s ease; min-width: 220px;">
          Enregistrer et dupliquer
        </button>
      </div>
    </form>
  `;
  
  showModal('rdv-modal', modalHTML);

  setTimeout(() => {
    if (typeof createClientAutocomplete !== 'undefined') {
      createClientAutocomplete('rdv-client-search', 'rdv-client');
    }
    if (typeof BusinessServices !== 'undefined' && BusinessServices.setupAutoCalculateAddress) {
      BusinessServices.setupAutoCalculateAddress('rdv-adresse-massage', 'rdv-distance', 'rdv-frais');
    }
    if (typeof setupClientAddressAutofill !== 'undefined') {
      setupClientAddressAutofill('rdv-client', 'rdv-adresse-massage');
    }

    // Initialiser les durées et prix selon le type sélectionné
    const rdvTypeSelect = document.getElementById('rdv-type');
    if (rdvTypeSelect && rdvTypeSelect.value) {
      handleTypeChange('rdv');
      // Re-sélectionner la durée d'origine après handleTypeChange
      const rdvDureeSelect = document.getElementById('rdv-duree');
      if (rdvDureeSelect && data.duree) {
        const dureeOption = rdvDureeSelect.querySelector(`option[value="${data.duree}"]`);
        if (dureeOption) rdvDureeSelect.value = data.duree;
      }
    }
  }, 200);
}

function showAddPrestationModal() {
  console.log('🔄 showAddPrestationModal appelée');
  
  const modalHTML = `
    <h3>Nouvelle prestation</h3>
    <form id="prestation-form">
      <input type="hidden" id="prestation-id">
      <div class="form-group">
        <label>Client</label>
        <input type="text" id="prestation-client-search" placeholder="Rechercher un client..." required style="width: 100%; padding: 0.75rem; border: 1px solid #ddd; border-radius: 6px;">
        <input type="hidden" id="prestation-client" required>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Date</label>
          <input type="date" id="prestation-date" required value="${new Date().toISOString().split('T')[0]}">
        </div>
        <div class="form-group">
          <label>Heure</label>
          <input type="time" id="prestation-heure" required>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Type de soin</label>
          <select id="prestation-type" required onchange="handleTypeChange('prestation')">
            ${generateTypeOptions(null, null)}
          </select>
        </div>
        <div class="form-group">
          <label>Durée</label>
          <select id="prestation-duree" required>
            ${generateDureeOptions(null, 60)}
          </select>
          <input type="number" id="prestation-duree-autre" placeholder="Durée en minutes" style="display: none; margin-top: 0.5rem;" min="1">
          <input type="hidden" id="prestation-duree-value" value="60">
        </div>
      </div>
      
      <div class="form-group">
        <label>Adresse du massage</label>
        <div style="position: relative;">
          <input type="text" id="prestation-adresse-massage" placeholder="Salon ou adresse du client..." style="width: 100%; padding: 0.75rem; border: 1px solid #ddd; border-radius: 6px;">
          <button type="button" onclick="if(typeof BusinessServices !== 'undefined' && BusinessServices.calculateDistanceAndCost) BusinessServices.calculateDistanceAndCost('prestation-adresse-massage', 'prestation-distance', 'prestation-frais')" style="position: absolute; right: 0.5rem; top: 50%; transform: translateY(-50%); background: var(--beige-dore); color: white; border: none; padding: 0.25rem 0.5rem; border-radius: 4px; font-size: 0.8rem; cursor: pointer;">📍 Calculer</button>
        </div>
        <input type="hidden" id="prestation-distance">
        <input type="hidden" id="prestation-frais">
        <div id="prestation-adresse-massage-result" style="margin-top: 0.5rem; font-size: 0.85rem;"></div>
        <small style="color: #666; font-size: 0.8rem;">💡 Si pas complété, aucun frais de route calculé</small>
      </div>
      
      <div class="form-row">
        <div class="form-group">
          <label>Prix (€)</label>
          <input type="number" id="prestation-prix" step="0.01" min="0" required>
        </div>
        <div class="form-group">
          <label>Tips reçus (€)</label>
          <input type="number" id="prestation-tips" step="0.01" min="0" placeholder="0.00">
          <small style="color: #666; font-size: 0.8rem;">💸 Pourboires ou gratifications reçues</small>
        </div>
      </div>
      
      <div class="form-group">
        <label>💳 Moyen de paiement</label>
        <select id="prestation-moyen-paiement" required style="width: 100%; padding: 0.75rem; border: 1px solid #ddd; border-radius: 6px;" onchange="toggleBonCadeauSelector()">
          <option value="">-- Sélectionnez le moyen de paiement --</option>
          <option value="Liquide">💵 Liquide</option>
          <option value="Carte bleue">💳 Carte bleue</option>
          <option value="Bon cadeau">🎁 Bon cadeau</option>
        </select>
      </div>

      <div id="bon-cadeau-selector-container" class="form-group" style="display: none;">
        <label>🎁 Sélectionner le bon cadeau</label>
        <select id="prestation-bon-cadeau" style="width: 100%; padding: 0.75rem; border: 1px solid #ddd; border-radius: 6px;" onchange="fillFromBonCadeau()">
          <option value="">-- Sélectionnez un bon --</option>
        </select>
        <small id="bon-cadeau-info" style="color: #666; font-size: 0.8rem; display: block; margin-top: 0.5rem;"></small>
      </div>

      <div class="form-group">
        <label>Notes</label>
        <textarea id="prestation-notes"></textarea>
      </div>

      <div class="modal-actions">
        <button type="button" class="btn-secondary" onclick="closeModal()">Annuler</button>
        <button type="submit" class="btn-primary">Enregistrer</button>
      </div>
    </form>
  `;

  showModal('prestation-modal', modalHTML);

  setTimeout(() => {
    if (typeof createClientAutocomplete !== 'undefined') {
      createClientAutocomplete('prestation-client-search', 'prestation-client');
    }
    if (typeof BusinessServices !== 'undefined' && BusinessServices.setupAutoCalculateAddress) {
      BusinessServices.setupAutoCalculateAddress('prestation-adresse-massage', 'prestation-distance', 'prestation-frais');
    }
    if (typeof setupClientAddressAutofill !== 'undefined') {
      setupClientAddressAutofill('prestation-client', 'prestation-adresse-massage');
    }
    populateBonsCadeauxSelector();

    // Initialiser durées et prix selon le type par défaut
    handleTypeChange('prestation');
  }, 200);
}

function showAddPrestationModalWithData(data = {}) {
  console.log('🔄 showAddPrestationModalWithData appelée:', data);
  
  const modalHTML = `
    <h3>${data.id ? 'Modifier prestation' : 'Nouvelle prestation'} ${data.clientNom ? `(${data.clientNom})` : ''}</h3>
    <form id="prestation-form">
      <input type="hidden" id="prestation-id" value="${data.id || ''}">
      <div class="form-group">
        <label>Client</label>
        <input type="text" id="prestation-client-search" placeholder="Rechercher un client..." required style="width: 100%; padding: 0.75rem; border: 1px solid #ddd; border-radius: 6px;" value="${data.clientNom || ''}">
        <input type="hidden" id="prestation-client" required value="${data.clientId || ''}">
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Date</label>
          <input type="date" id="prestation-date" required value="${data.date || new Date().toISOString().split('T')[0]}">
        </div>
        <div class="form-group">
          <label>Heure</label>
          <input type="time" id="prestation-heure" required value="${data.heure || ''}">
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Type de soin</label>
          <select id="prestation-type" required onchange="handleTypeChange('prestation')">
            ${generateTypeOptions(data.soinId, data.type)}
          </select>
        </div>
        <div class="form-group">
          <label>Durée</label>
          <select id="prestation-duree" required>
            ${generateDureeOptions(data.soinId, data.duree)}
          </select>
          <input type="number" id="prestation-duree-autre" placeholder="Durée en minutes" style="display: none; margin-top: 0.5rem;" min="1">
          <input type="hidden" id="prestation-duree-value" value="${data.duree || 60}">
        </div>
      </div>
      
      <div class="form-group">
        <label>Adresse du massage</label>
        <div style="position: relative;">
          <input type="text" id="prestation-adresse-massage" placeholder="Salon ou adresse du client..." style="width: 100%; padding: 0.75rem; border: 1px solid #ddd; border-radius: 6px;" value="${data.adresseMassage || ''}">
          <button type="button" onclick="if(typeof BusinessServices !== 'undefined' && BusinessServices.calculateDistanceAndCost) BusinessServices.calculateDistanceAndCost('prestation-adresse-massage', 'prestation-distance', 'prestation-frais')" style="position: absolute; right: 0.5rem; top: 50%; transform: translateY(-50%); background: var(--beige-dore); color: white; border: none; padding: 0.25rem 0.5rem; border-radius: 4px; font-size: 0.8rem; cursor: pointer;">📍 Calculer</button>
        </div>
        <input type="hidden" id="prestation-distance" value="${data.distanceKm || ''}">
        <input type="hidden" id="prestation-frais" value="${data.fraisDeplacement || ''}">
        <div id="prestation-adresse-massage-result" style="margin-top: 0.5rem; font-size: 0.85rem;">
          ${data.adresseMassage && data.distanceKm > 0 ? `
            <div style="background: var(--beige-clair); padding: 0.5rem; border-radius: 6px; border-left: 3px solid var(--beige-dore);">
              <div style="color: var(--beige-dore); font-weight: 600; font-size: 0.85rem;">📍 Distance: ${data.distanceKm} km</div>
              <div style="color: var(--text-dark); font-weight: 600; font-size: 0.85rem;">💰 Frais estimés: ${(data.fraisDeplacement || 0).toFixed(2)} € (A/R)</div>
            </div>
          ` : ''}
        </div>
        <small style="color: #666; font-size: 0.8rem;">💡 Si pas complété, aucun frais de route calculé</small>
      </div>
      
      <div class="form-row">
        <div class="form-group">
          <label>Prix (€)</label>
          <input type="number" id="prestation-prix" step="0.01" min="0" required value="${data.prix || ''}">
        </div>
        <div class="form-group">
          <label>Tips reçus (€)</label>
          <input type="number" id="prestation-tips" step="0.01" min="0" placeholder="0.00" value="${data.tips || ''}">
          <small style="color: #666; font-size: 0.8rem;">💸 Pourboires</small>
        </div>
      </div>
      
      <div class="form-group">
        <label>💳 Moyen de paiement</label>
        <select id="prestation-moyen-paiement" required style="width: 100%; padding: 0.75rem; border: 1px solid #ddd; border-radius: 6px;" onchange="toggleBonCadeauSelector()">
          <option value="">-- Sélectionnez le moyen de paiement --</option>
          <option value="Liquide" ${data.moyenPaiement === 'Liquide' ? 'selected' : ''}>💵 Liquide</option>
          <option value="Carte bleue" ${data.moyenPaiement === 'Carte bleue' ? 'selected' : ''}>💳 Carte bleue</option>
          <option value="Bon cadeau" ${data.moyenPaiement === 'Bon cadeau' ? 'selected' : ''}>🎁 Bon cadeau</option>
        </select>
      </div>

      <div id="bon-cadeau-selector-container" class="form-group" style="display: ${data.moyenPaiement === 'Bon cadeau' ? 'block' : 'none'};">
        <label>🎁 Sélectionner le bon cadeau</label>
        <select id="prestation-bon-cadeau" style="width: 100%; padding: 0.75rem; border: 1px solid #ddd; border-radius: 6px;" onchange="fillFromBonCadeau()">
          <option value="">-- Sélectionnez un bon --</option>
        </select>
        <small id="bon-cadeau-info" style="color: #666; font-size: 0.8rem; display: block; margin-top: 0.5rem;"></small>
      </div>

      <div class="form-group">
        <label>Notes</label>
        <textarea id="prestation-notes">${data.notes || ''}</textarea>
      </div>

      <div class="modal-actions">
        <button type="button" class="btn-secondary" onclick="closeModal()">Annuler</button>
        <button type="submit" class="btn-primary">Enregistrer</button>
      </div>
      <div style="display: flex; justify-content: flex-end; padding-top: 1rem;">
        <button type="button" onclick="PrestationDuplication.saveAndDuplicate()" style="background: var(--beige-dore); color: white; padding: 0.75rem 1.5rem; border-radius: var(--border-radius); border: none; cursor: pointer; font-weight: 500; transition: all 0.3s ease; min-width: 220px;">
          Enregistrer et dupliquer
        </button>
      </div>
    </form>
  `;

  showModal('prestation-modal', modalHTML);

  setTimeout(() => {
    if (typeof createClientAutocomplete !== 'undefined') {
      createClientAutocomplete('prestation-client-search', 'prestation-client');
    }
    if (typeof BusinessServices !== 'undefined' && BusinessServices.setupAutoCalculateAddress) {
      BusinessServices.setupAutoCalculateAddress('prestation-adresse-massage', 'prestation-distance', 'prestation-frais');
    }
    if (typeof setupClientAddressAutofill !== 'undefined') {
      setupClientAddressAutofill('prestation-client', 'prestation-adresse-massage');
    }
    populateBonsCadeauxSelector(data.bonCadeauId);
    if (data.moyenPaiement === 'Bon cadeau') {
      toggleBonCadeauSelector();
    }

    // Initialiser les durées et prix selon le type sélectionné
    const prestaTypeSelect = document.getElementById('prestation-type');
    if (prestaTypeSelect && prestaTypeSelect.value) {
      handleTypeChange('prestation');
      // Re-sélectionner la durée d'origine après handleTypeChange
      const prestaDureeSelect = document.getElementById('prestation-duree');
      if (prestaDureeSelect && data.duree) {
        const dureeOption = prestaDureeSelect.querySelector(`option[value="${data.duree}"]`);
        if (dureeOption) prestaDureeSelect.value = data.duree;
      }
      // Re-appliquer le prix d'origine
      if (data.prix) {
        const prixInput = document.getElementById('prestation-prix');
        if (prixInput) prixInput.value = data.prix;
      }
    }
  }, 200);
}

// ===== AUTRES MODALES =====

function showAddClientModal() {
  console.log('📄 showAddClientModal appelée');
  
  const modalHTML = `
    <h3>Nouveau client</h3>
    <form id="client-form">
      <input type="hidden" id="client-id">
      <input type="hidden" id="client-type" value="client">
      <div class="form-row">
        <div class="form-group">
          <label>Nom *</label>
          <input type="text" id="client-nom" required>
        </div>
        <div class="form-group">
          <label>Prénom *</label>
          <input type="text" id="client-prenom" required>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Société</label>
          <input type="text" id="client-societe">
        </div>
        <div class="form-group">
          <label>Téléphone</label>
          <input type="tel" id="client-telephone">
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Email</label>
          <input type="email" id="client-email">
        </div>
        <div class="form-group">
          <label>Sexe (pour statistiques)</label>
          <select id="client-sexe" style="width: 100%; padding: 0.75rem; border: 1px solid #ddd; border-radius: 6px;">
            <option value="">-- Non précisé --</option>
            <option value="H">Homme</option>
            <option value="F">Femme</option>
          </select>
          <small style="color: #666; font-size: 0.8rem;">💡 Pour analyser votre clientèle</small>
        </div>
      </div>
      
      <div class="form-group">
        <label>📍 Ville</label>
        <select id="client-ville" style="width: 100%; padding: 0.75rem; border: 1px solid #ddd; border-radius: 6px;">
          <option value="">-- Non précisé --</option>
          <option value="Porto-Vecchio">Porto-Vecchio</option>
          <option value="Ajaccio">Ajaccio</option>
        </select>
        <small style="color: #666; font-size: 0.8rem;">💡 Pour filtrer dans l'annuaire</small>
      </div>
      
      <div class="form-group">
        <label>🤝 Parrain (optionnel)</label>
        <input type="text" id="client-parrain-search" placeholder="Rechercher un client parrain..." style="width: 100%; padding: 0.75rem; border: 1px solid #ddd; border-radius: 6px;">
        <input type="hidden" id="client-parrain">
        <small style="color: #666; font-size: 0.8rem;">💡 Le client qui a recommandé cette personne</small>
      </div>
      
      <div class="form-group">
        <label>📈 D'où vient le client ?</label>
        <select id="client-canal-acquisition" style="width: 100%; padding: 0.75rem; border: 1px solid #ddd; border-radius: 6px;">
          <option value="">-- Sélectionnez le canal --</option>
        </select>
        <small style="color: #666; font-size: 0.8rem;">💡 Calcul des canaux de diffusions</small>
      </div>
      
      <div class="form-group">
        <label>Adresse domicile</label>
        <div style="position: relative;">
          <textarea id="client-adresse" placeholder="Ex: 15 Avenue Napoléon, 20000 Ajaccio" style="min-height: 80px; width: 100%; padding: 0.75rem; border: 1px solid #ddd; border-radius: 6px;"></textarea>
          <button type="button" onclick="validateClientAddress()" style="position: absolute; top: 0.5rem; right: 0.5rem; background: var(--beige-dore); color: white; border: none; padding: 0.25rem 0.5rem; border-radius: 4px; font-size: 0.8rem; cursor: pointer;">🔍 Vérifier</button>
        </div>
        <div id="client-address-validation-result" style="margin-top: 0.5rem; font-size: 0.8rem;"></div>
        <small style="color: #666; font-size: 0.8rem;">💡 Cette adresse sera proposée automatiquement lors de la création de RDV/prestations</small>
      </div>
      <div id="client-preferences">
        <h4>Préférences</h4>
        <div class="form-group">
          <label>Huiles préférées</label>
          <input type="text" id="client-huiles">
        </div>
        <div class="form-group">
          <label>Zones sensibles</label>
          <input type="text" id="client-zones">
        </div>
        <div class="form-group">
          <label>Allergies</label>
          <input type="text" id="client-allergies">
        </div>
        <div class="form-group">
          <label>Pression préférée</label>
          <select id="client-pression">
            <option value="douce">Douce</option>
            <option value="moyenne" selected>Moyenne</option>
            <option value="forte">Forte</option>
          </select>
        </div>
      </div>
      <div class="form-group">
        <label>Notes</label>
        <textarea id="client-notes"></textarea>
      </div>
      <div class="modal-actions">
        <button type="button" class="btn-secondary" onclick="closeModal()">Annuler</button>
        <button type="submit" class="btn-primary">Enregistrer</button>
      </div>
    </form>
  `;
  
  showModal('client-modal', modalHTML);
  
  setTimeout(() => {
    if (typeof createParrainAutocomplete !== 'undefined') {
      createParrainAutocomplete('client-parrain-search', 'client-parrain');
    }
    // Populer le dropdown des canaux
    populateCanalDropdown();
  }, 200);
}

function showAddProspectModal() {
  console.log('🔄 showAddProspectModal appelée');
  
  const modalHTML = `
    <h3>Nouveau prospect</h3>
    <form id="client-form">
      <input type="hidden" id="client-id">
      <input type="hidden" id="client-type" value="prospect">
      <div class="form-row">
        <div class="form-group">
          <label>Nom *</label>
          <input type="text" id="client-nom" required>
        </div>
        <div class="form-group">
          <label>Prénom *</label>
          <input type="text" id="client-prenom" required>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Société</label>
          <input type="text" id="client-societe">
        </div>
        <div class="form-group">
          <label>Téléphone</label>
          <input type="tel" id="client-telephone">
        </div>
      </div>
      <div class="form-group">
        <label>Email</label>
        <input type="email" id="client-email">
      </div>
      
      <div class="form-group">
        <label>📍 Ville</label>
        <select id="client-ville" style="width: 100%; padding: 0.75rem; border: 1px solid #ddd; border-radius: 6px;">
          <option value="">-- Non précisé --</option>
          <option value="Porto-Vecchio">Porto-Vecchio</option>
          <option value="Ajaccio">Ajaccio</option>
        </select>
        <small style="color: #666; font-size: 0.8rem;">💡 Pour filtrer dans l'annuaire</small>
      </div>
      
      <div class="form-group">
        <label>🤝 Parrain (optionnel)</label>
        <input type="text" id="client-parrain-search" placeholder="Rechercher un client parrain..." style="width: 100%; padding: 0.75rem; border: 1px solid #ddd; border-radius: 6px;">
        <input type="hidden" id="client-parrain">
        <small style="color: #666; font-size: 0.8rem;">💡 Le client qui a recommandé ce prospect</small>
      </div>
      
      <div class="form-group">
        <label>📈 D'où vient le client ?</label>
        <select id="client-canal-acquisition" style="width: 100%; padding: 0.75rem; border: 1px solid #ddd; border-radius: 6px;">
          <option value="">-- Sélectionnez le canal --</option>
        </select>
        <small style="color: #666; font-size: 0.8rem;">💡 Calcul des canaux de diffusions</small>
      </div>
      
      <div class="form-group">
        <label>Adresse</label>
        <div style="position: relative;">
          <textarea id="client-adresse" placeholder="Ex: 15 Avenue Napoléon, 20000 Ajaccio" style="min-height: 80px; width: 100%; padding: 0.75rem; border: 1px solid #ddd; border-radius: 6px;"></textarea>
          <button type="button" onclick="validateClientAddress()" style="position: absolute; top: 0.5rem; right: 0.5rem; background: var(--beige-dore); color: white; border: none; padding: 0.25rem 0.5rem; border-radius: 4px; font-size: 0.8rem; cursor: pointer;">📍 Vérifier</button>
        </div>
        <div id="client-address-validation-result" style="margin-top: 0.5rem; font-size: 0.8rem;"></div>
        <small style="color: #666; font-size: 0.8rem;">💡 Cette adresse sera proposée automatiquement lors de la création de RDV/prestations</small>
      </div>
      <div class="form-group">
        <label>Statut prospect</label>
        <select id="prospect-statut">
          <option value="intérêt fort">Intérêt fort</option>
          <option value="intérêt moyen" selected>Intérêt moyen</option>
          <option value="intérêt faible">Intérêt faible</option>
        </select>
      </div>
      <div class="form-group">
        <label>Notes</label>
        <textarea id="client-notes"></textarea>
      </div>
      <div class="modal-actions">
        <button type="button" class="btn-secondary" onclick="closeModal()">Annuler</button>
        <button type="submit" class="btn-primary">Enregistrer</button>
      </div>
    </form>
  `;
  
  showModal('client-modal', modalHTML);
  
  setTimeout(() => {
    if (typeof createParrainAutocomplete !== 'undefined') {
      createParrainAutocomplete('client-parrain-search', 'client-parrain');
    }
    // ✅ NOUVEAU : Populer le dropdown des canaux
    populateCanalDropdown();
  }, 200);
}

function showAddDepenseModal() {
  console.log('🔄 showAddDepenseModal appelée');
  
  const modalHTML = `
    <h3>Nouvelle dépense</h3>
    <form id="depenses-form">
      <input type="hidden" id="depense-id">
      <div class="form-row">
        <div class="form-group">
          <label>Date *</label>
          <input type="date" id="depense-date" required value="${new Date().toISOString().split('T')[0]}">
        </div>
        <div class="form-group">
          <label>Montant (€) *</label>
          <input type="number" id="depense-montant" step="0.01" required>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Catégorie</label>
          <select id="depense-categorie">
            <option value="Huiles">Huiles</option>
            <option value="Matériel">Matériel</option>
            <option value="Formation">Formation</option>
            <option value="Transport">Transport</option>
            <option value="Marketing">Marketing</option>
            <option value="Abonnement">Abonnement</option>
            <option value="Loyer">Loyer</option>
            <option value="Autre">Autre</option>
          </select>
        </div>
        <div class="form-group">
          <label>Fournisseur</label>
          <input type="text" id="depense-fournisseur">
        </div>
      </div>
      <div class="form-group">
        <label>Description</label>
        <input type="text" id="depense-description" placeholder="Ex: Huile d'amande douce, Table de massage...">
      </div>
      <div class="form-group">
        <label>Notes</label>
        <textarea id="depense-notes"></textarea>
      </div>
      <div class="modal-actions">
        <button type="button" class="btn-secondary" onclick="closeModal()">Annuler</button>
        <button type="submit" class="btn-primary">Enregistrer</button>
      </div>
    </form>
  `;
  
  showModal('depenses-modal', modalHTML);
}

function showAddCollaborateurModal() {
  console.log('🔄 showAddCollaborateurModal appelée');
  
  const modalHTML = `
    <h3>🤝 Nouveau collaborateur</h3>
    <form id="collaborateur-form">
      <div class="form-row">
        <div class="form-group">
          <label>Prénom *</label>
          <input type="text" id="collaborateur-prenom" required>
        </div>
        <div class="form-group">
          <label>Nom *</label>
          <input type="text" id="collaborateur-nom" required>
        </div>
      </div>
      
      <div class="form-row">
        <div class="form-group">
          <label>Poste/Fonction</label>
          <input type="text" id="collaborateur-poste" placeholder="Ex: Masseur-kinésithérapeute">
        </div>
        <div class="form-group">
          <label>Entreprise/Cabinet</label>
          <input type="text" id="collaborateur-entreprise" placeholder="Ex: Cabinet Wellness">
        </div>
      </div>
      
      <div class="form-group">
        <label>Spécialités</label>
        <textarea id="collaborateur-specialites" placeholder="Ex: Massage thérapeutique, Réflexologie plantaire..."></textarea>
      </div>
      
      <div class="form-row">
        <div class="form-group">
          <label>Téléphone</label>
          <input type="tel" id="collaborateur-telephone">
        </div>
        <div class="form-group">
          <label>Email</label>
          <input type="email" id="collaborateur-email">
        </div>
      </div>
      
      <div class="form-group">
        <label>Adresse</label>
        <textarea id="collaborateur-adresse" placeholder="Adresse complète du cabinet/lieu de travail"></textarea>
      </div>
      
      <div class="form-group">
        <label>Notes</label>
        <textarea id="collaborateur-notes" placeholder="Notes personnelles, tarifs, disponibilités..."></textarea>
      </div>
      
      <div class="modal-actions">
        <button type="button" class="btn-secondary" onclick="closeModal()">Annuler</button>
        <button type="submit" class="btn-primary">🤝 Créer le collaborateur</button>
      </div>
    </form>
  `;
  
  showModal('collaborateur-modal', modalHTML);
}

function showParametresModal() {
  console.log('🔄 showParametresModal appelée');

  const appData = DataManager ? DataManager.getAppData() : {};
  const params = appData.parametres || {};

  // Statuts pour les badges
  const adresseOk = params.adresseSalon ? true : false;
  const backupOk = params.cheminSauvegardeAuto ? true : false;
  const apiKeyOk = params.openRouteServiceKey ? true : false;
  const carteSoinsCount = params.carteSoins?.soins?.filter(s => s.statut === 'actif').length || 0;

  const modalHTML = `
    <h3 style="text-align: center; font-family: 'Playfair Display', serif; font-size: 1.4rem; margin-bottom: 0.5rem;">Parametres</h3>
    <p style="text-align: center; color: var(--text-light); font-size: 0.9rem; margin-bottom: 1.5rem;">Configurez votre application</p>

    <div class="parametres-grid" style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">

      <!-- Mon salon -->
      <div class="parametres-card" onclick="showParametresSalonModal()" style="cursor: pointer; padding: 1.25rem; background: #fff; border-radius: 12px; border: 1px solid #eee; transition: all 0.2s ease; box-shadow: 0 2px 8px rgba(0,0,0,0.04);"
        <div style="display: flex; align-items: center; gap: 0.75rem; margin-bottom: 0.5rem;">
          <div style="width: 40px; height: 40px; border-radius: 10px; background: linear-gradient(135deg, var(--rose-poudre), var(--rose-accent)); display: flex; align-items: center; justify-content: center; font-size: 1.2rem;">
            🏠
          </div>
          <div style="flex: 1;">
            <div style="font-weight: 600; color: var(--text-dark); font-size: 0.95rem;">Mon salon</div>
          </div>
        </div>
        <p style="margin: 0; font-size: 0.8rem; color: var(--text-light);">Adresse et mode de calcul</p>
        <div style="margin-top: 0.5rem;">
          ${adresseOk
            ? '<span style="font-size: 0.75rem; color: #27ae60; font-weight: 500;">Configur\u00e9</span>'
            : '<span style="font-size: 0.75rem; color: #e67e22; font-weight: 500;">A configurer</span>'}
        </div>
      </div>

      <!-- Vehicule -->
      <div class="parametres-card" onclick="showParametresVehiculeModal()" style="cursor: pointer; padding: 1.25rem; background: #fff; border-radius: 12px; border: 1px solid #eee; transition: all 0.2s ease; box-shadow: 0 2px 8px rgba(0,0,0,0.04);"
        <div style="display: flex; align-items: center; gap: 0.75rem; margin-bottom: 0.5rem;">
          <div style="width: 40px; height: 40px; border-radius: 10px; background: linear-gradient(135deg, #e8f4fd, #bde0fe); display: flex; align-items: center; justify-content: center; font-size: 1.2rem;">
            🚗
          </div>
          <div style="flex: 1;">
            <div style="font-weight: 600; color: var(--text-dark); font-size: 0.95rem;">Deplacements</div>
          </div>
        </div>
        <p style="margin: 0; font-size: 0.8rem; color: var(--text-light);">Vehicule et frais kilom\u00e9triques</p>
        <div style="margin-top: 0.5rem;">
          <span style="font-size: 0.75rem; color: var(--text-light);">${params.consommation || 5.5} L/100km</span>
        </div>
      </div>

      <!-- Carte des soins -->
      <div class="parametres-card" onclick="showCarteSoinsModal()" style="cursor: pointer; padding: 1.25rem; background: #fff; border-radius: 12px; border: 1px solid #eee; transition: all 0.2s ease; box-shadow: 0 2px 8px rgba(0,0,0,0.04);"
        <div style="display: flex; align-items: center; gap: 0.75rem; margin-bottom: 0.5rem;">
          <div style="width: 40px; height: 40px; border-radius: 10px; background: linear-gradient(135deg, #fef3e2, #fdd89b); display: flex; align-items: center; justify-content: center; font-size: 1.2rem;">
            💆
          </div>
          <div style="flex: 1;">
            <div style="font-weight: 600; color: var(--text-dark); font-size: 0.95rem;">Carte des soins</div>
          </div>
        </div>
        <p style="margin: 0; font-size: 0.8rem; color: var(--text-light);">Soins, tarifs et categories</p>
        <div style="margin-top: 0.5rem;">
          <span style="font-size: 0.75rem; color: var(--beige-dore); font-weight: 500;">${carteSoinsCount} soins actifs</span>
        </div>
      </div>

      <!-- Google Ads -->
      <div class="parametres-card" onclick="showParametresGoogleAdsModal()" style="cursor: pointer; padding: 1.25rem; background: #fff; border-radius: 12px; border: 1px solid #eee; transition: all 0.2s ease; box-shadow: 0 2px 8px rgba(0,0,0,0.04);"
        <div style="display: flex; align-items: center; gap: 0.75rem; margin-bottom: 0.5rem;">
          <div style="width: 40px; height: 40px; border-radius: 10px; background: linear-gradient(135deg, #e8f0fe, #c2d7fe); display: flex; align-items: center; justify-content: center; font-size: 1.2rem;">
            📊
          </div>
          <div style="flex: 1;">
            <div style="font-weight: 600; color: var(--text-dark); font-size: 0.95rem;">Google Ads</div>
          </div>
        </div>
        <p style="margin: 0; font-size: 0.8rem; color: var(--text-light);">ROI et campagnes publicitaires</p>
        <div style="margin-top: 0.5rem;">
          <span style="font-size: 0.75rem; color: var(--text-light);">Connexion OAuth</span>
        </div>
      </div>

      <!-- Sauvegarde supprimee (geree par Supabase) -->

      <!-- Abonnements -->
      <div class="parametres-card" onclick="showParametresAbonnementsModal()" style="cursor: pointer; padding: 1.25rem; background: #fff; border-radius: 12px; border: 1px solid #eee; transition: all 0.2s ease; box-shadow: 0 2px 8px rgba(0,0,0,0.04);"
        <div style="display: flex; align-items: center; gap: 0.75rem; margin-bottom: 0.5rem;">
          <div style="width: 40px; height: 40px; border-radius: 10px; background: linear-gradient(135deg, #fce4ec, #f8bbd0); display: flex; align-items: center; justify-content: center; font-size: 1.2rem;">
            🔄
          </div>
          <div style="flex: 1;">
            <div style="font-weight: 600; color: var(--text-dark); font-size: 0.95rem;">Abonnements</div>
          </div>
        </div>
        <p style="margin: 0; font-size: 0.8rem; color: var(--text-light);">Depenses mensuelles recurrentes</p>
        <div style="margin-top: 0.5rem;">
          <span style="font-size: 0.75rem; color: var(--text-light);">${(params.abonnements || []).filter(a => a.actif).length} actif(s)</span>
        </div>
      </div>

      <!-- API OpenRoute -->
      <div class="parametres-card" onclick="showParametresApiModal()" style="cursor: pointer; padding: 1.25rem; background: #fff; border-radius: 12px; border: 1px solid #eee; transition: all 0.2s ease; box-shadow: 0 2px 8px rgba(0,0,0,0.04);"
        <div style="display: flex; align-items: center; gap: 0.75rem; margin-bottom: 0.5rem;">
          <div style="width: 40px; height: 40px; border-radius: 10px; background: linear-gradient(135deg, #e3f2fd, #90caf9); display: flex; align-items: center; justify-content: center; font-size: 1.2rem;">
            🗺️
          </div>
          <div style="flex: 1;">
            <div style="font-weight: 600; color: var(--text-dark); font-size: 0.95rem;">API Distances</div>
          </div>
        </div>
        <p style="margin: 0; font-size: 0.8rem; color: var(--text-light);">OpenRouteService</p>
        <div style="margin-top: 0.5rem;">
          ${apiKeyOk
            ? '<span style="font-size: 0.75rem; color: #27ae60; font-weight: 500;">Cl\u00e9 configur\u00e9e</span>'
            : '<span style="font-size: 0.75rem; color: var(--text-light);">Non configur\u00e9</span>'}
        </div>
      </div>

    </div>
  `;

  showModal('parametres-modal', modalHTML);
}

// ===== SOUS-MODALES PARAMETRES =====

function showParametresSalonModal() {
  const params = DataManager ? DataManager.getParametres() : {};

  const modalHTML = `
    <div style="display: flex; align-items: center; gap: 0.75rem; margin-bottom: 1.5rem;">
      <button type="button" onclick="showParametresModal();" style="background: none; border: none; cursor: pointer; font-size: 1.2rem; padding: 0.25rem; color: var(--text-light);">←</button>
      <h3 style="margin: 0; font-size: 1.2rem;">Mon salon</h3>
    </div>
    <form id="parametres-form" data-section="salon">
      <div class="form-group">
        <label>Adresse du salon *</label>
        <div style="position: relative;">
          <textarea id="parametres-adresse-salon" placeholder="Ex: 123 Rue de la Paix, 20000 Ajaccio" required style="min-height: 80px;">${params.adresseSalon || ''}</textarea>
          <button type="button" onclick="validateCurrentAddress()" style="position: absolute; top: 0.5rem; right: 0.5rem; background: var(--beige-dore); color: white; border: none; padding: 0.25rem 0.5rem; border-radius: 4px; font-size: 0.8rem; cursor: pointer;">Verifier</button>
        </div>
        <div id="address-validation-result" style="margin-top: 0.5rem; font-size: 0.8rem;"></div>
        <small style="color: #666; font-size: 0.8rem;">Point de depart pour le calcul des frais de deplacement</small>
      </div>

      <div class="form-group">
        <label>Mode de calcul des periodes</label>
        <select id="parametres-calcul-periode">
          <option value="mois-calendaire" ${params.calculPeriode === 'mois-calendaire' ? 'selected' : ''}>Mois calendaire (1er au 30/31)</option>
          <option value="periode-glissante" ${params.calculPeriode === 'periode-glissante' ? 'selected' : ''}>Periode glissante (30 derniers jours)</option>
        </select>
        <small style="color: #666; font-size: 0.8rem;">
          Calendaire = du 1er juillet au 31 juillet<br>
          Glissant = les 30 derniers jours a partir d'aujourd'hui
        </small>
      </div>

      <!-- Champs cachés pour garder les valeurs existantes -->
      <input type="hidden" id="parametres-consommation" value="${params.consommation || 5.5}">
      <input type="hidden" id="parametres-prix-carburant" value="${params.prixCarburant || 1.85}">
      <input type="hidden" id="parametres-cout-usure" value="${params.coutUsure || 0.15}">
      <input type="hidden" id="parametres-chemin-sauvegarde" value="${params.cheminSauvegardeAuto || ''}">
      <input type="hidden" id="google-ads-api-key" value="${params.googleAdsApiKey || ''}">

      <div class="modal-actions">
        <button type="button" class="btn-secondary" onclick="showParametresModal();">Retour</button>
        <button type="submit" class="btn-primary">Enregistrer</button>
      </div>
    </form>
  `;

  showModal('parametres-salon-modal', modalHTML);
}

function showParametresVehiculeModal() {
  const params = DataManager ? DataManager.getParametres() : {};

  const modalHTML = `
    <div style="display: flex; align-items: center; gap: 0.75rem; margin-bottom: 1.5rem;">
      <button type="button" onclick="showParametresModal();" style="background: none; border: none; cursor: pointer; font-size: 1.2rem; padding: 0.25rem; color: var(--text-light);">←</button>
      <h3 style="margin: 0; font-size: 1.2rem;">Deplacements</h3>
    </div>
    <form id="parametres-form" data-section="vehicule">
      <div class="form-group">
        <label>Consommation vehicule (L/100km)</label>
        <input type="number" id="parametres-consommation" step="0.1" min="0" placeholder="Ex: 5.5" value="${params.consommation || 5.5}">
      </div>

      <div class="form-group">
        <label>Prix du carburant (EUR/L)</label>
        <input type="number" id="parametres-prix-carburant" step="0.01" min="0" placeholder="Ex: 1.85" value="${params.prixCarburant || 1.85}">
      </div>

      <div class="form-group">
        <label>Cout usure/entretien (EUR/km)</label>
        <input type="number" id="parametres-cout-usure" step="0.01" min="0" placeholder="Ex: 0.15" value="${params.coutUsure || 0.15}">
        <small style="color: #666; font-size: 0.8rem;">Estimation usure, assurance, entretien par km</small>
      </div>

      <div style="margin: 1rem 0; padding: 1rem; background: #f8f9fa; border-radius: 8px;">
        <strong>Cout total estime par km :</strong>
        <div id="cout-km-calcule" style="font-size: 1.2rem; color: var(--beige-dore); font-weight: 600; margin-top: 0.5rem;">
          Calcul en cours...
        </div>
      </div>

      <!-- Champs cachés pour garder les valeurs existantes -->
      <input type="hidden" id="parametres-adresse-salon" value="${params.adresseSalon || ''}">
      <input type="hidden" id="parametres-calcul-periode" value="${params.calculPeriode || 'mois-calendaire'}">
      <input type="hidden" id="parametres-chemin-sauvegarde" value="${params.cheminSauvegardeAuto || ''}">
      <input type="hidden" id="google-ads-api-key" value="${params.googleAdsApiKey || ''}">

      <div class="modal-actions">
        <button type="button" class="btn-secondary" onclick="showParametresModal();">Retour</button>
        <button type="submit" class="btn-primary">Enregistrer</button>
      </div>
    </form>
  `;

  showModal('parametres-vehicule-modal', modalHTML);

  setTimeout(() => {
    updateCoutKmCalcule();
    ['parametres-consommation', 'parametres-prix-carburant', 'parametres-cout-usure'].forEach(id => {
      const element = document.getElementById(id);
      if (element) {
        element.addEventListener('input', updateCoutKmCalcule);
      }
    });
  }, 200);
}

function showParametresGoogleAdsModal() {
  const params = DataManager ? DataManager.getParametres() : {};

  const modalHTML = `
    <div style="display: flex; align-items: center; gap: 0.75rem; margin-bottom: 1.5rem;">
      <button type="button" onclick="showParametresModal();" style="background: none; border: none; cursor: pointer; font-size: 1.2rem; padding: 0.25rem; color: var(--text-light);">←</button>
      <h3 style="margin: 0; font-size: 1.2rem;">Google Ads</h3>
    </div>

    <p style="margin: 0 0 1rem 0; font-size: 0.9rem; color: #666;">
      Connexion securisee aux donnees de campagnes partagees pour le calcul du ROI automatique.
    </p>

    <div id="google-ads-status" style="margin-bottom: 1rem;">
    </div>

    <div style="display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap; margin-bottom: 1rem;">
      <button
        type="button"
        id="connect-google-ads"
        onclick="connectToGoogleAds()"
        class="btn-primary"
        style="background: #4285f4;"
      >
        Se connecter
      </button>

      <button
        type="button"
        id="disconnect-google-ads"
        onclick="disconnectFromGoogleAds()"
        class="btn-secondary"
        style="display: none;"
      >
        Se deconnecter
      </button>

      <button
        type="button"
        id="test-google-ads"
        onclick="testGoogleAdsConnection()"
        class="btn-secondary"
        style="display: none;"
      >
        Tester
      </button>

      <button
        type="button"
        id="manage-campaigns"
        onclick="showCampaignManagementModal()"
        class="btn-primary"
        style="background: var(--beige-dore); display: none;"
      >
        Gerer les campagnes
      </button>
    </div>

    <div id="campaigns-summary" style="display: none; background: #e8f5e8; padding: 1rem; border-radius: 6px; margin-bottom: 1rem;">
      <div style="font-weight: 600; color: #155724; margin-bottom: 0.5rem;">
        Campagnes selectionnees pour le ROI :
      </div>
      <div id="campaigns-list" style="color: #155724; font-size: 0.9rem;">
      </div>
    </div>

    <div style="margin-top: 1rem; padding: 0.75rem; background: #e3f2fd; border-radius: 4px; font-size: 0.85rem;">
      <strong>Securite :</strong> Vous vous connectez avec votre compte Google.
      Acces uniquement aux campagnes que Jordan a partagees avec vous.
    </div>

    <div class="modal-actions" style="margin-top: 1.5rem;">
      <button type="button" class="btn-secondary" onclick="showParametresModal();">Retour</button>
    </div>
  `;

  showModal('parametres-google-ads-modal', modalHTML);

  setTimeout(() => {
    updateGoogleAdsStatus();
  }, 200);
}

function showParametresSauvegardeModal() {
  const params = DataManager ? DataManager.getParametres() : {};
  const cheminSauvegardeAuto = params.cheminSauvegardeAuto || '';

  const modalHTML = `
    <div style="display: flex; align-items: center; gap: 0.75rem; margin-bottom: 1.5rem;">
      <button type="button" onclick="showParametresModal();" style="background: none; border: none; cursor: pointer; font-size: 1.2rem; padding: 0.25rem; color: var(--text-light);">←</button>
      <h3 style="margin: 0; font-size: 1.2rem;">Sauvegardes</h3>
    </div>

    <div style="margin-bottom: 1.5rem;">
      <h4 style="margin: 0 0 1rem 0; color: var(--text-dark); font-size: 1rem;">Sauvegarde automatique</h4>

      <div class="form-group" style="margin-bottom: 1rem;">
        <label>Dossier de sauvegarde</label>
        <div style="display: flex; gap: 0.5rem; align-items: flex-start;">
          <input
            type="text"
            id="parametres-chemin-sauvegarde"
            placeholder="Selectionnez un dossier..."
            readonly
            value="${cheminSauvegardeAuto}"
            style="flex: 1; background: #fff; border: 1px solid #ddd; padding: 0.75rem; border-radius: 6px;"
          >
          <button
            type="button"
            onclick="selectBackupFolder()"
            style="background: var(--beige-dore); color: white; border: none; padding: 0.75rem 1rem; border-radius: 6px; cursor: pointer; white-space: nowrap; font-size: 0.9rem;"
          >
            Parcourir
          </button>
        </div>
        <div id="backup-path-validation" style="margin-top: 0.5rem; font-size: 0.85rem;">
          ${cheminSauvegardeAuto ? `
            <div style="color: #27ae60; font-weight: 500;">Sauvegarde automatique configuree</div>
          ` : `
            <div style="color: #666;">Configurez un dossier pour activer la sauvegarde automatique</div>
          `}
        </div>
        <small style="color: #666; font-size: 0.8rem; display: block; margin-top: 0.5rem;">
          <strong>Fonctionnement :</strong><br>
          - Sauvegarde automatique a chaque fermeture du logiciel<br>
          - Format : backup_JJ-MM-YYYY_HH-MM-SS.json<br>
          - Nettoyage automatique des sauvegardes de plus de 30 jours
        </small>
      </div>
    </div>

    <hr style="border: none; border-top: 1px solid #eee; margin: 1.5rem 0;">

    <div>
      <h4 style="margin: 0 0 1rem 0; color: var(--text-dark); font-size: 1rem;">Export / Import manuel</h4>
      <div style="display: flex; gap: 0.75rem; flex-wrap: wrap;">
        <button type="button" onclick="exportDataUI()" class="btn-primary" style="background: var(--beige-dore);">
          Exporter les donnees
        </button>
        <button type="button" onclick="importDataUI()" class="btn-secondary">
          Importer des donnees
        </button>
      </div>
    </div>

    <div class="modal-actions" style="margin-top: 1.5rem;">
      <button type="button" class="btn-secondary" onclick="showParametresModal();">Retour</button>
    </div>
  `;

  showModal('parametres-sauvegarde-modal', modalHTML);

  setTimeout(() => {
    updateBackupPathStatus();
  }, 200);
}

function showParametresApiModal() {
  const params = DataManager ? DataManager.getParametres() : {};
  const currentKey = params.openRouteServiceKey || '';
  const maskedKey = currentKey ? currentKey.slice(0, 4) + '***' + currentKey.slice(-4) : '';

  const modalHTML = `
    <div style="display: flex; align-items: center; gap: 0.75rem; margin-bottom: 1.5rem;">
      <button type="button" onclick="showParametresModal();" style="background: none; border: none; cursor: pointer; font-size: 1.2rem; padding: 0.25rem; color: var(--text-light);">←</button>
      <h3 style="margin: 0; font-size: 1.2rem;">API Distances</h3>
    </div>

    <p style="margin: 0 0 1rem 0; font-size: 0.9rem; color: #666;">
      OpenRouteService permet de calculer des distances routieres precises pour vos deplacements.
    </p>

    <div style="margin-bottom: 1rem;">
      <p style="margin: 0 0 0.5rem 0; font-size: 0.9rem; color: #666;">
        <strong>Gratuit :</strong> 2000 calculs/jour -
        <a href="https://openrouteservice.org/dev/#/signup" target="_blank" style="color: #2196f3;">Creer un compte</a>
      </p>
    </div>

    <div style="display: flex; gap: 1rem; align-items: center; flex-wrap: wrap;">
      <div style="flex: 1; min-width: 200px;">
        <label for="openroute-api-key" style="display: block; margin-bottom: 0.25rem; font-weight: 600;">Cle API :</label>
        <input type="password"
               id="openroute-api-key"
               placeholder="Collez votre cle API OpenRouteService"
               value="${currentKey}"
               style="width: 100%; padding: 0.5rem; border: 1px solid #ddd; border-radius: 4px; font-family: monospace;">
      </div>

      <div style="display: flex; gap: 0.5rem;">
        <button type="button" onclick="saveAndTestApiKey()" class="btn-primary" style="white-space: nowrap;">
          Tester & Sauver
        </button>
        <button type="button" onclick="clearApiKey()" class="btn-secondary" style="white-space: nowrap;">
          Effacer
        </button>
      </div>
    </div>

    <div id="api-key-status" style="margin-top: 0.5rem; font-size: 0.9rem;">
      ${currentKey ? '<span style="color: #27ae60;">Cle configuree : ' + maskedKey + '</span>' : '<span style="color: #666;">Aucune cle configuree</span>'}
    </div>

    <div style="margin-top: 1rem; padding: 0.75rem; background: #e8f5e8; border-radius: 4px; font-size: 0.85rem;">
      <strong>Avantages :</strong> Distances routieres precises au lieu d'approximations.
      Temps de trajet estime. Calcul automatique pour tous vos deplacements.
    </div>

    <div class="modal-actions" style="margin-top: 1.5rem;">
      <button type="button" class="btn-secondary" onclick="showParametresModal();">Retour</button>
    </div>
  `;

  showModal('parametres-api-modal', modalHTML);
}

// ===== ABONNEMENTS (depenses recurrentes mensuelles) =====

function showParametresAbonnementsModal() {
  const params = DataManager ? DataManager.getParametres() : {};
  const abonnements = params.abonnements || [];

  let listHTML = '';
  if (abonnements.length === 0) {
    listHTML = '<p style="text-align: center; color: var(--text-light); padding: 1rem;">Aucun abonnement configure.</p>';
  } else {
    listHTML = abonnements.map((abo, index) => `
      <div style="display: flex; align-items: center; justify-content: space-between; padding: 0.75rem; background: ${abo.actif ? '#fff' : '#f8f8f8'}; border-radius: 8px; border: 1px solid #eee; margin-bottom: 0.5rem; ${abo.actif ? '' : 'opacity: 0.6;'}">
        <div style="flex: 1;">
          <div style="display: flex; align-items: center; gap: 0.5rem;">
            <strong style="font-size: 0.95rem;">${abo.nom}</strong>
            <span style="background: ${abo.actif ? '#27ae60' : '#e74c3c'}; color: white; padding: 0.1rem 0.4rem; border-radius: 8px; font-size: 0.65rem;">${abo.actif ? 'Actif' : 'Inactif'}</span>
          </div>
          <div style="font-size: 0.85rem; color: var(--text-light); margin-top: 0.15rem;">
            ${abo.montant.toFixed(2)} EUR/mois | Le ${abo.jourPrelevement || 1} du mois | ${abo.categorie} | ${abo.fournisseur || '-'}
          </div>
        </div>
        <div style="display: flex; gap: 0.25rem;">
          <button type="button" onclick="editAbonnement(${index})" style="background: none; border: none; cursor: pointer; font-size: 0.9rem;" title="Modifier">✏️</button>
          <button type="button" onclick="toggleAbonnement(${index})" style="background: none; border: none; cursor: pointer; font-size: 0.9rem;" title="${abo.actif ? 'Desactiver' : 'Activer'}">${abo.actif ? '⏸️' : '▶️'}</button>
          <button type="button" onclick="deleteAbonnement(${index})" style="background: none; border: none; cursor: pointer; font-size: 0.9rem;" title="Supprimer">🗑️</button>
        </div>
      </div>
    `).join('');
  }

  const modalHTML = `
    <div style="display: flex; align-items: center; gap: 0.75rem; margin-bottom: 1.5rem;">
      <button type="button" onclick="showParametresModal();" style="background: none; border: none; cursor: pointer; font-size: 1.2rem; padding: 0.25rem; color: var(--text-light);">←</button>
      <h3 style="margin: 0; font-size: 1.2rem;">Abonnements mensuels</h3>
    </div>

    <p style="margin: 0 0 1rem 0; font-size: 0.9rem; color: #666;">
      Les abonnements generent automatiquement une depense a la date de prelevement configuree (1 fois par mois max).
    </p>

    ${listHTML}

    <button type="button" onclick="showAddAbonnementModal()" class="btn-primary" style="width: 100%; margin-top: 1rem;">
      + Ajouter un abonnement
    </button>

    <div class="modal-actions" style="margin-top: 1.5rem;">
      <button type="button" class="btn-secondary" onclick="showParametresModal();">Retour</button>
    </div>
  `;

  showModal('parametres-abonnements-modal', modalHTML);
}

function showAddAbonnementModal(editIndex = null) {
  const params = DataManager ? DataManager.getParametres() : {};
  const abo = editIndex !== null ? (params.abonnements || [])[editIndex] : null;

  const modalHTML = `
    <div style="display: flex; align-items: center; gap: 0.75rem; margin-bottom: 1.5rem;">
      <button type="button" onclick="showParametresAbonnementsModal();" style="background: none; border: none; cursor: pointer; font-size: 1.2rem; padding: 0.25rem; color: var(--text-light);">←</button>
      <h3 style="margin: 0; font-size: 1.2rem;">${abo ? 'Modifier l\'abonnement' : 'Nouvel abonnement'}</h3>
    </div>

    <form onsubmit="event.preventDefault(); saveAbonnement(${editIndex !== null ? editIndex : -1});">
      <div class="form-group" style="margin-bottom: 1rem;">
        <label style="display: block; margin-bottom: 0.25rem; font-weight: 600;">Nom *</label>
        <input type="text" id="abo-nom" value="${abo ? abo.nom : ''}" required placeholder="Ex: Planity, Assurance..."
          style="width: 100%; padding: 0.5rem; border: 1px solid #ddd; border-radius: 6px;">
      </div>

      <div style="display: flex; gap: 1rem; margin-bottom: 1rem;">
        <div class="form-group" style="flex: 1;">
          <label style="display: block; margin-bottom: 0.25rem; font-weight: 600;">Montant mensuel (EUR) *</label>
          <input type="number" id="abo-montant" value="${abo ? abo.montant : ''}" required step="0.01" min="0"
            style="width: 100%; padding: 0.5rem; border: 1px solid #ddd; border-radius: 6px;">
        </div>
        <div class="form-group" style="flex: 0 0 120px;">
          <label style="display: block; margin-bottom: 0.25rem; font-weight: 600;">Jour de prelevement *</label>
          <input type="number" id="abo-jour" value="${abo && abo.jourPrelevement ? abo.jourPrelevement : 1}" required min="1" max="28"
            style="width: 100%; padding: 0.5rem; border: 1px solid #ddd; border-radius: 6px;">
        </div>
      </div>

      <div class="form-group" style="margin-bottom: 1rem;">
        <label style="display: block; margin-bottom: 0.25rem; font-weight: 600;">Categorie</label>
        <select id="abo-categorie" style="width: 100%; padding: 0.5rem; border: 1px solid #ddd; border-radius: 6px;">
          <option value="Abonnement" ${!abo || abo.categorie === 'Abonnement' ? 'selected' : ''}>Abonnement</option>
          <option value="Marketing" ${abo && abo.categorie === 'Marketing' ? 'selected' : ''}>Marketing</option>
          <option value="Loyer" ${abo && abo.categorie === 'Loyer' ? 'selected' : ''}>Loyer</option>
          <option value="Autre" ${abo && abo.categorie === 'Autre' ? 'selected' : ''}>Autre</option>
        </select>
      </div>

      <div class="form-group" style="margin-bottom: 1rem;">
        <label style="display: block; margin-bottom: 0.25rem; font-weight: 600;">Fournisseur</label>
        <input type="text" id="abo-fournisseur" value="${abo ? (abo.fournisseur || '') : ''}" placeholder="Ex: Planity SAS"
          style="width: 100%; padding: 0.5rem; border: 1px solid #ddd; border-radius: 6px;">
      </div>

      <div class="form-group" style="margin-bottom: 1rem;">
        <label style="display: block; margin-bottom: 0.25rem; font-weight: 600;">Description</label>
        <input type="text" id="abo-description" value="${abo ? (abo.description || '') : ''}" placeholder="Ex: Abonnement plateforme de reservation"
          style="width: 100%; padding: 0.5rem; border: 1px solid #ddd; border-radius: 6px;">
      </div>

      <div class="modal-actions" style="margin-top: 1.5rem;">
        <button type="button" class="btn-secondary" onclick="showParametresAbonnementsModal();">Annuler</button>
        <button type="submit" class="btn-primary">Enregistrer</button>
      </div>
    </form>
  `;

  showModal('parametres-add-abo-modal', modalHTML);
}

async function saveAbonnement(editIndex) {
  const nom = document.getElementById('abo-nom')?.value?.trim();
  const montant = parseFloat(document.getElementById('abo-montant')?.value) || 0;
  const jourPrelevement = parseInt(document.getElementById('abo-jour')?.value) || 1;
  const categorie = document.getElementById('abo-categorie')?.value || 'Abonnement';
  const fournisseur = document.getElementById('abo-fournisseur')?.value?.trim() || '';
  const description = document.getElementById('abo-description')?.value?.trim() || '';

  if (!nom || montant <= 0) {
    if (typeof UtilsServices !== 'undefined' && UtilsServices.showCustomAlert) {
      UtilsServices.showCustomAlert('Veuillez remplir le nom et un montant valide.', 'warning');
    }
    return;
  }

  const appData = DataManager.getAppData();
  if (!appData.parametres.abonnements) {
    appData.parametres.abonnements = [];
  }

  const aboData = { nom, montant, jourPrelevement, categorie, fournisseur, description, actif: true };

  if (editIndex >= 0 && editIndex < appData.parametres.abonnements.length) {
    // Conserver l'etat actif
    aboData.actif = appData.parametres.abonnements[editIndex].actif;
    appData.parametres.abonnements[editIndex] = aboData;
  } else {
    appData.parametres.abonnements.push(aboData);
  }

  await DataManager.saveData();
  showParametresAbonnementsModal();
}

async function toggleAbonnement(index) {
  const appData = DataManager.getAppData();
  if (appData.parametres.abonnements && appData.parametres.abonnements[index]) {
    appData.parametres.abonnements[index].actif = !appData.parametres.abonnements[index].actif;
    await DataManager.saveData();
    showParametresAbonnementsModal();
  }
}

async function deleteAbonnement(index) {
  if (!confirm('Supprimer cet abonnement ?')) return;
  const appData = DataManager.getAppData();
  if (appData.parametres.abonnements) {
    appData.parametres.abonnements.splice(index, 1);
    await DataManager.saveData();
    showParametresAbonnementsModal();
  }
}

function editAbonnement(index) {
  showAddAbonnementModal(index);
}

// Generation automatique des depenses d'abonnement pour le mois en cours
// Ne genere la depense QUE si on a atteint ou depasse le jour de prelevement configure
// Maximum 1 fois par mois par abonnement
async function genererDepensesAbonnements() {
  const appData = DataManager.getAppData();
  const abonnements = appData.parametres?.abonnements || [];
  const actifs = abonnements.filter(a => a.actif);

  if (actifs.length === 0) return;

  if (!appData.depenses) appData.depenses = [];

  const now = new Date();
  const jourActuel = now.getDate();
  const moisCourant = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  let count = 0;

  actifs.forEach(abo => {
    const jourPrelevement = abo.jourPrelevement || 1;

    // Ne generer que si on a atteint ou depasse le jour de prelevement
    if (jourActuel < jourPrelevement) return;

    // Verifier si la depense existe deja pour ce mois (max 1 fois)
    const dejaExiste = appData.depenses.some(d =>
      d.type === 'abonnement-auto' &&
      d.abonnementNom === abo.nom &&
      d.date.startsWith(moisCourant)
    );

    if (!dejaExiste) {
      const jour = String(jourPrelevement).padStart(2, '0');
      const dateDepense = `${moisCourant}-${jour}`;
      appData.depenses.push({
        id: DataManager.generateId(),
        date: dateDepense,
        montant: abo.montant,
        categorie: abo.categorie,
        fournisseur: abo.fournisseur || abo.nom,
        description: abo.description || `Abonnement ${abo.nom}`,
        notes: 'Genere automatiquement',
        type: 'abonnement-auto',
        abonnementNom: abo.nom
      });
      count++;
    }
  });

  if (count > 0) {
    await DataManager.saveData();
    console.log(`✅ ${count} depense(s) d'abonnement generee(s) pour ${moisCourant}`);
  }
}

// ===== UTILITAIRES =====

function toggleAutreDuree(type) {
  const select = document.getElementById(`${type}-duree`);
  const inputAutre = document.getElementById(`${type}-duree-autre`);
  const hiddenValue = document.getElementById(`${type}-duree-value`);
  
  if (select && select.value === 'autre') {
    if (inputAutre) {
      inputAutre.style.display = 'block';
      inputAutre.required = true;
    }
    if (hiddenValue) hiddenValue.value = inputAutre ? inputAutre.value || '' : '';
  } else {
    if (inputAutre) {
      inputAutre.style.display = 'none';
      inputAutre.required = false;
      inputAutre.value = '';
    }
    if (hiddenValue && select) hiddenValue.value = select.value;
  }
  
  // Event listener pour mettre à jour la valeur cachée
  if (inputAutre && hiddenValue) {
    inputAutre.addEventListener('input', () => {
      hiddenValue.value = inputAutre.value;
    });
  }
}

// ===== GESTION HEADSPA - AUTO-SÉLECTION JENNY =====

function handlePrestationTypeChange() {
  const typeSelect = document.getElementById('prestation-type');
  const clientSearch = document.getElementById('prestation-client-search');
  const clientHidden = document.getElementById('prestation-client');
  const dureeSelect = document.getElementById('prestation-duree');
  const prixInput = document.getElementById('prestation-prix');

  if (!typeSelect) return;

  const isHeadSpa = typeSelect.value === 'HeadSpa';

  if (isHeadSpa) {
    // Récupérer Jenny depuis DataManager
    const jenny = DataManager.getHeadSpaCollaborateur();

    if (jenny) {
      // Auto-remplir avec Jenny
      if (clientSearch) {
        clientSearch.value = `${jenny.prenom} ${jenny.nom || ''} - ${jenny.entreprise}`.trim();
        clientSearch.disabled = true;
        clientSearch.style.backgroundColor = '#f5f5f5';
        clientSearch.style.cursor = 'not-allowed';
      }
      if (clientHidden) {
        clientHidden.value = jenny.id;
      }
    }

    // Mettre à jour les durées disponibles pour HeadSpa (30, 45, 60)
    if (dureeSelect) {
      dureeSelect.innerHTML = `
        <option value="30">30 minutes</option>
        <option value="45">45 minutes</option>
        <option value="60">60 minutes</option>
      `;
      dureeSelect.value = '30'; // Par défaut 30 min
    }

    // Auto-remplir le prix
    updateHeadSpaPrix('prestation');

  } else {
    // Réactiver le champ client
    if (clientSearch) {
      clientSearch.disabled = false;
      clientSearch.style.backgroundColor = '';
      clientSearch.style.cursor = '';
      // Ne pas vider si c'est une édition
      if (clientSearch.value.includes('Jenny') && clientSearch.value.includes('Bouclette')) {
        clientSearch.value = '';
        if (clientHidden) clientHidden.value = '';
      }
    }

    // Remettre les durées standard
    if (dureeSelect) {
      dureeSelect.innerHTML = `
        <option value="45">45 minutes</option>
        <option value="60" selected>60 minutes</option>
        <option value="90">90 minutes</option>
        <option value="120">120 minutes</option>
        <option value="autre">Autre</option>
      `;
    }
  }
}

function handleRdvTypeChange() {
  const typeSelect = document.getElementById('rdv-type');
  const clientSearch = document.getElementById('rdv-client-search');
  const clientHidden = document.getElementById('rdv-client');
  const dureeSelect = document.getElementById('rdv-duree');

  if (!typeSelect) return;

  const isHeadSpa = typeSelect.value === 'HeadSpa';

  if (isHeadSpa) {
    // Récupérer Jenny depuis DataManager
    const jenny = DataManager.getHeadSpaCollaborateur();

    if (jenny) {
      // Auto-remplir avec Jenny
      if (clientSearch) {
        clientSearch.value = `${jenny.prenom} ${jenny.nom || ''} - ${jenny.entreprise}`.trim();
        clientSearch.disabled = true;
        clientSearch.style.backgroundColor = '#f5f5f5';
        clientSearch.style.cursor = 'not-allowed';
      }
      if (clientHidden) {
        clientHidden.value = jenny.id;
      }
    }

    // Mettre à jour les durées disponibles pour HeadSpa (30, 45, 60)
    if (dureeSelect) {
      dureeSelect.innerHTML = `
        <option value="30">30 minutes</option>
        <option value="45">45 minutes</option>
        <option value="60">60 minutes</option>
      `;
      dureeSelect.value = '30';
    }

  } else {
    // Réactiver le champ client
    if (clientSearch) {
      clientSearch.disabled = false;
      clientSearch.style.backgroundColor = '';
      clientSearch.style.cursor = '';
      if (clientSearch.value.includes('Jenny') && clientSearch.value.includes('Bouclette')) {
        clientSearch.value = '';
        if (clientHidden) clientHidden.value = '';
      }
    }

    // Remettre les durées standard
    if (dureeSelect) {
      dureeSelect.innerHTML = `
        <option value="45">45 minutes</option>
        <option value="60" selected>60 minutes</option>
        <option value="90">90 minutes</option>
        <option value="120">120 minutes</option>
        <option value="autre">Autre</option>
      `;
    }
  }
}

function updateHeadSpaPrix(prefix) {
  const dureeSelect = document.getElementById(`${prefix}-duree`);
  const prixInput = document.getElementById(`${prefix}-prix`);
  const typeSelect = document.getElementById(`${prefix}-type`);

  if (!dureeSelect || !prixInput || !typeSelect) return;
  if (typeSelect.value !== 'HeadSpa') return;

  const duree = parseInt(dureeSelect.value);
  const tarifs = DataManager.getParametres()?.tarifsMassage?.HeadSpa || { 30: 20, 45: 35, 60: 40 };

  if (tarifs[duree] !== undefined) {
    prixInput.value = tarifs[duree];
  }
}

// Ajouter un listener pour mettre à jour le prix quand la durée change (HeadSpa)
function setupHeadSpaDureeListener(prefix) {
  const dureeSelect = document.getElementById(`${prefix}-duree`);
  if (dureeSelect) {
    dureeSelect.addEventListener('change', () => updateHeadSpaPrix(prefix));
  }
}

function updateCoutKmCalcule() {
  const consommationField = document.getElementById('parametres-consommation');
  const carburantField = document.getElementById('parametres-prix-carburant');
  const usureField = document.getElementById('parametres-cout-usure');
  const resultField = document.getElementById('cout-km-calcule');
  
  if (!resultField) return;
  
  const consommation = consommationField ? parseFloat(consommationField.value) || 0 : 0;
  const prixCarburant = carburantField ? parseFloat(carburantField.value) || 0 : 0;
  const coutUsure = usureField ? parseFloat(usureField.value) || 0 : 0;
  
  if (consommation > 0 && prixCarburant > 0) {
    const coutCarburant = (consommation * prixCarburant) / 100;
    const coutTotal = coutCarburant + coutUsure;
    
    resultField.innerHTML = `
      <div>${coutTotal.toFixed(3)} €/km</div>
      <small style="color: #666; font-weight: normal;">
        Carburant: ${coutCarburant.toFixed(3)}€/km + Usure: ${coutUsure.toFixed(3)}€/km
      </small>
    `;
  } else {
    resultField.textContent = 'Saisissez les valeurs ci-dessus';
  }
}

async function validateCurrentAddress() {
  const address = document.getElementById('parametres-adresse-salon').value;
  const resultDiv = document.getElementById('address-validation-result');
  
  if (!address.trim()) {
    resultDiv.innerHTML = '<span style="color: #e74c3c;">❌ Veuillez saisir une adresse</span>';
    return;
  }
  
  resultDiv.innerHTML = '<span style="color: #f39c12;">🔄 Vérification en cours...</span>';
  
  if (typeof Calculations !== 'undefined' && Calculations.validateAddress) {
    const validation = await Calculations.validateAddress(address);
    
    if (validation.valid) {
      resultDiv.innerHTML = `<span style="color: #27ae60;">✅ Adresse valide</span><br><small style="color: #666;">${validation.formatted}</small>`;
    } else {
      resultDiv.innerHTML = `<span style="color: #e74c3c;">❌ ${validation.message}</span>`;
    }
  } else {
    resultDiv.innerHTML = '<span style="color: #f39c12;">⚠️ Service de validation non disponible</span>';
  }
}

async function validateClientAddress() {
  const address = document.getElementById('client-adresse').value;
  const resultDiv = document.getElementById('client-address-validation-result');
  
  if (!address.trim()) {
    resultDiv.innerHTML = '<span style="color: #e74c3c;">❌ Veuillez saisir une adresse</span>';
    return;
  }
  
  resultDiv.innerHTML = '<span style="color: #f39c12;">🔄 Vérification en cours...</span>';
  
  if (typeof Calculations !== 'undefined' && Calculations.validateAddress) {
    const validation = await Calculations.validateAddress(address);
    
    if (validation.valid) {
      resultDiv.innerHTML = `<span style="color: #27ae60;">✅ Adresse valide</span><br><small style="color: #666;">${validation.formatted}</small>`;
    } else {
      resultDiv.innerHTML = `<span style="color: #e74c3c;">❌ ${validation.message}</span>`;
    }
  } else {
    resultDiv.innerHTML = '<span style="color: #f39c12;">⚠️ Service de validation non disponible</span>';
  }
}

function selectBackupFolder() {
  console.log('🔄 selectBackupFolder appelée (placeholder)');
  alert('Fonction selectBackupFolder en cours de développement');
}

function updateBackupPathStatus() {
  console.log('🔄 updateBackupPathStatus appelée (placeholder)');
}

function migrerMoyensPaiement() {
  console.log('🔄 migrerMoyensPaiement appelée (placeholder)');
  alert('Fonction migrerMoyensPaiement en cours de développement');
}

// ✅ Fonction pour confirmation personnalisée (pour remplacer le confirm() basique)
function showCustomConfirm(message, type = 'question') {
  return new Promise((resolve) => {
    const confirmHTML = `
      <div style="text-align: center; padding: 1rem;">
        <div style="font-size: 3rem; margin-bottom: 1rem;">
          ${type === 'question' ? '❓' : type === 'warning' ? '⚠️' : '💳'}
        </div>
        <h3 style="margin: 0 0 1rem 0; color: var(--text-dark);">Migration des moyens de paiement</h3>
        <div style="text-align: left; background: #f8f9fa; padding: 1.5rem; border-radius: 8px; margin: 1rem 0; border-left: 4px solid #2196f3;">
          <p style="margin: 0 0 1rem 0; font-weight: 500;">Cette opération va ajouter "Liquide" comme moyen de paiement pour toutes les prestations qui n'en ont pas encore.</p>
          <p style="margin: 0 0 1rem 0; color: #666;">Les prestations ayant déjà un moyen de paiement ne seront pas modifiées.</p>
          <p style="margin: 0; font-weight: 600; color: #2196f3;">Continuer ?</p>
        </div>
        <div style="display: flex; gap: 1rem; justify-content: center; margin-top: 2rem;">
          <button 
            class="btn-secondary" 
            onclick="resolveCustomConfirm(false)"
            style="min-width: 120px;"
          >
            Annuler
          </button>
          <button 
            class="btn-primary" 
            onclick="resolveCustomConfirm(true)"
            style="min-width: 120px; background: #2196f3;"
          >
            💳 Migrer
          </button>
        </div>
      </div>
    `;
    
    // Stocker la fonction de résolution
    window.resolveCustomConfirm = (result) => {
      closeModal();
      delete window.resolveCustomConfirm;
      resolve(result);
    };
    
    showModal('custom-confirm-modal', confirmHTML);
  });
}

// ✅ Fonction pour alerte personnalisée
function showCustomAlert(message, type = 'info') {
  return new Promise((resolve) => {
    const icons = {
      success: '✅',
      error: '❌', 
      warning: '⚠️',
      info: 'ℹ️'
    };
    
    const colors = {
      success: '#28a745',
      error: '#dc3545',
      warning: '#ffc107',
      info: '#17a2b8'
    };
    
    const alertHTML = `
      <div style="text-align: center; padding: 1rem;">
        <div style="font-size: 3rem; margin-bottom: 1rem;">
          ${icons[type]}
        </div>
        <h3 style="margin: 0 0 1rem 0; color: ${colors[type]};">
          ${type === 'success' ? 'Migration terminée !' : 
            type === 'error' ? 'Erreur' : 
            type === 'warning' ? 'Attention' : 'Information'}
        </h3>
        <div style="text-align: left; background: #f8f9fa; padding: 1.5rem; border-radius: 8px; margin: 1rem 0; border-left: 4px solid ${colors[type]}; white-space: pre-line;">
          ${message}
        </div>
        <div style="margin-top: 2rem;">
          <button 
            class="btn-primary" 
            onclick="resolveCustomAlert()"
            style="min-width: 120px; background: ${colors[type]};"
          >
            OK
          </button>
        </div>
      </div>
    `;
    
    // Stocker la fonction de résolution
    window.resolveCustomAlert = () => {
      closeModal();
      delete window.resolveCustomAlert;
      resolve();
    };
    
    showModal('custom-alert-modal', alertHTML);
  });
}

function createClientAutocomplete(inputId, hiddenId) {
  console.log('🔄 createClientAutocomplete appelée:', inputId, hiddenId);
  
  const input = document.getElementById(inputId);
  const hidden = document.getElementById(hiddenId);
  
  if (!input || !hidden) {
    console.warn('⚠️ Éléments non trouvés pour autocomplete:', inputId, hiddenId);
    return;
  }
  
  input.removeAttribute('readonly');
  input.removeAttribute('disabled');
  input.style.pointerEvents = 'auto';
  input.style.cursor = 'text';
  
  const suggestionContainer = document.createElement('div');
  suggestionContainer.className = 'autocomplete-suggestions';
  suggestionContainer.style.cssText = `
    position: absolute;
    top: 100%;
    left: 0;
    right: 0;
    background: white;
    border: 1px solid #ddd;
    border-top: none;
    border-radius: 0 0 8px 8px;
    max-height: 200px;
    overflow-y: auto;
    z-index: 1000;
    display: none;
    box-shadow: 0 4px 6px rgba(0,0,0,0.1);
  `;
  
  input.parentElement.style.position = 'relative';
  input.parentElement.appendChild(suggestionContainer);
  
  let selectedIndex = -1;
  let filteredClients = [];
  
  input.addEventListener('input', (e) => {
    const query = e.target.value.toLowerCase().trim();
    hidden.value = '';
    selectedIndex = -1;
    
    if (query.length < 1) {
      suggestionContainer.style.display = 'none';
      return;
    }
    
    if (typeof DataManager !== 'undefined' && DataManager.getAppData) {
      const appData = DataManager.getAppData();
      if (appData.clients) {
        filteredClients = appData.clients.filter(client => {
          const normalizedQuery = query.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
          const numericQuery = query.replace(/[^0-9+]/g, '');
          const normalizedNom = (client.nom || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
          const normalizedPrenom = (client.prenom || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
          const normalizedSociete = (client.societe || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
          return normalizedNom.includes(normalizedQuery) ||
            normalizedPrenom.includes(normalizedQuery) ||
            normalizedSociete.includes(normalizedQuery) ||
            (numericQuery.length > 0 && client.telephone && client.telephone.replace(/[^0-9+]/g, '').includes(numericQuery));
        });
        
        if (filteredClients.length === 0) {
          suggestionContainer.innerHTML = '<div style="padding: 0.5rem; color: #999; font-style: italic;">Aucun client trouvé</div>';
          suggestionContainer.style.display = 'block';
          return;
        }
        
        suggestionContainer.innerHTML = filteredClients.map((client, index) => `
          <div class="autocomplete-item" data-index="${index}" style="
            padding: 0.75rem;
            cursor: pointer;
            border-bottom: 1px solid #f0f0f0;
            transition: background-color 0.2s;
          ">
            <div style="font-weight: 600; color: var(--beige-dore);">${client.prenom} ${client.nom}</div>
            ${client.societe ? `<div style="font-size: 0.85rem; color: #666;">🏢 ${client.societe}</div>` : ''}
            ${client.telephone ? `<div style="font-size: 0.85rem; color: #666;">📞 ${client.telephone}</div>` : ''}
          </div>
        `).join('');
        
        suggestionContainer.style.display = 'block';
        
        suggestionContainer.querySelectorAll('.autocomplete-item').forEach((item, index) => {
          item.addEventListener('click', () => selectClient(index));
        });
      }
    }
  });
  
  function selectClient(index) {
    const client = filteredClients[index];
    input.value = `${client.prenom} ${client.nom}`;
    hidden.value = client.id;
    suggestionContainer.style.display = 'none';
    selectedIndex = -1;
    
    hidden.dispatchEvent(new Event('change'));
  }
}

function createParrainAutocomplete(inputId, hiddenId) {
  console.log('🔄 createParrainAutocomplete appelée:', inputId, hiddenId);
  // Même logique que createClientAutocomplete mais pour les parrains
  createClientAutocomplete(inputId, hiddenId);
}

function setupClientAddressAutofill(clientHiddenId, addressInputId) {
  console.log('🔄 setupClientAddressAutofill appelée:', clientHiddenId, addressInputId);
  
  const clientHidden = document.getElementById(clientHiddenId);
  const addressInput = document.getElementById(addressInputId);
  
  if (!clientHidden || !addressInput) {
    console.warn('⚠️ Éléments non trouvés pour address autofill');
    return;
  }
  
  clientHidden.addEventListener('change', () => {
    const clientId = clientHidden.value;
    if (!clientId) return;
    
    if (typeof DataManager !== 'undefined' && DataManager.getAppData) {
      const appData = DataManager.getAppData();
      const client = appData.clients ? appData.clients.find(c => c.id === clientId) : null;
      
      if (client) {
        // ✅ AUTO-REMPLIR LE SEXE depuis la fiche client
        const sexeSelect = document.getElementById('rdv-sexe');
        if (sexeSelect && client.sexe) {
          sexeSelect.value = client.sexe;
          console.log(`✅ Sexe pré-rempli: ${client.sexe}`);
        }
        
        // Gestion de l'adresse (code existant)
        if (client.adresse && client.adresse.trim() !== '') {
          const addressResultDiv = document.getElementById(`${addressInputId}-result`);
          if (addressResultDiv) {
            addressResultDiv.innerHTML = `
              <div style="background: #e8f5e8; padding: 0.75rem; border-radius: 6px; border-left: 3px solid #28a745; margin-top: 0.5rem;">
                <div style="color: #155724; font-weight: 600; margin-bottom: 0.5rem;">📍 Adresse client disponible :</div>
                <div style="color: #155724; margin-bottom: 0.75rem; font-style: italic;">${client.adresse}</div>
                <button type="button" onclick="useClientAddress('${clientId}', '${addressInputId}')" style="background: #28a745; color: white; border: none; padding: 0.5rem 1rem; border-radius: 4px; font-size: 0.8rem; cursor: pointer;">
                  ✅ Utiliser cette adresse
                </button>
              </div>
            `;
          }
        }
      }
    }
  });
}

function useClientAddress(clientId, addressInputId) {
  console.log('🔄 useClientAddress appelée:', clientId, addressInputId);
  
  if (typeof DataManager !== 'undefined' && DataManager.getAppData) {
    const appData = DataManager.getAppData();
    const client = appData.clients ? appData.clients.find(c => c.id === clientId) : null;
    
    if (client && client.adresse) {
      const addressInput = document.getElementById(addressInputId);
      if (addressInput) {
        addressInput.value = client.adresse;
        
        // Calculer automatiquement la distance si possible
        if (addressInputId.includes('rdv') && typeof BusinessServices !== 'undefined' && BusinessServices.calculateDistanceAndCost) {
          BusinessServices.calculateDistanceAndCost('rdv-adresse-massage', 'rdv-distance', 'rdv-frais');
        } else if (addressInputId.includes('prestation') && typeof BusinessServices !== 'undefined' && BusinessServices.calculateDistanceAndCost) {
          BusinessServices.calculateDistanceAndCost('prestation-adresse-massage', 'prestation-distance', 'prestation-frais');
        }
      }
    }
  }
}

function populateCanalDropdown(selectedValue = '') {
  const dropdown = document.getElementById('client-canal-acquisition');
  if (!dropdown) return;
  
  // GARDEZ les éléments existants, ne changez QUE les options
  const existingOptions = dropdown.querySelectorAll('option');
  existingOptions.forEach(opt => opt.remove());
  
  // Ajouter l'option par défaut
  const defaultOption = document.createElement('option');
  defaultOption.value = '';
  defaultOption.textContent = '-- Sélectionnez le canal --';
  dropdown.appendChild(defaultOption);
  
  // Ajouter les canaux disponibles
  const canaux = ClientServices.getAvailableCanaux();
  canaux.forEach(canal => {
    const option = document.createElement('option');
    option.value = canal.id;
    option.textContent = canal.label;
    if (canal.id === selectedValue) {
      option.selected = true;
    }
    dropdown.appendChild(option);
  });
}

function showTemporaryMessage(message) {
  console.log('💬 Message temporaire:', message);
  
  const messageDiv = document.createElement('div');
  messageDiv.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: var(--beige-dore);
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

// ===== GESTION FORMULAIRES COLLABORATEURS =====

function handleCollaborateurFormSubmit(e) {
  e.preventDefault();
  console.log('🔄 handleCollaborateurFormSubmit démarré');
  
  const formData = {
    prenom: document.getElementById('collaborateur-prenom').value.trim(),
    nom: document.getElementById('collaborateur-nom').value.trim(),
    poste: document.getElementById('collaborateur-poste').value.trim(),
    entreprise: document.getElementById('collaborateur-entreprise').value.trim(),
    specialites: document.getElementById('collaborateur-specialites').value.trim(),
    telephone: document.getElementById('collaborateur-telephone').value.trim(),
    email: document.getElementById('collaborateur-email').value.trim(),
    adresse: document.getElementById('collaborateur-adresse').value.trim(),
    notes: document.getElementById('collaborateur-notes').value.trim(),
    tags: document.getElementById('collaborateur-tags')?.value.trim() || ''
  };
  
  // Validation
  if (!formData.prenom || !formData.nom) {
    alert('Le prénom et le nom sont obligatoires');
    return;
  }
  
  // Traitement des tags
  const tags = formData.tags ? formData.tags.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0) : [];
  
  // Créer l'objet collaborateur
  const collaborateur = {
    id: DataManager ? DataManager.generateId() : 'temp_' + Date.now(),
    prenom: formData.prenom,
    nom: formData.nom,
    poste: formData.poste || '',
    entreprise: formData.entreprise || '',
    specialites: formData.specialites || '',
    telephone: formData.telephone || '',
    email: formData.email || '',
    adresse: formData.adresse || '',
    notes: formData.notes || '',
    tags: tags,
    dateCreation: new Date().toISOString()
  };
  
  // Ajouter à la base de données
  if (typeof DataManager !== 'undefined' && DataManager.getAppData) {
    const appData = DataManager.getAppData();
    if (!appData.collaborateurs) {
      appData.collaborateurs = [];
    }
    appData.collaborateurs.push(collaborateur);
    
    // Sauvegarder
    DataManager.saveData().then(() => {
      // Rafraîchir l'affichage
      if (typeof ViewManager !== 'undefined' && ViewManager.updateClientsDisplay) {
        ViewManager.updateClientsDisplay();
      }
      
      // Fermer la modal
      closeModal();
      
      // Message de succès
      showTemporaryMessage(`🤝 ${collaborateur.prenom} ${collaborateur.nom} ajouté comme collaborateur !`);
    });
  }
}

function handleCollaborateurEditSubmit(e) {
  e.preventDefault();
  console.log('🔄 handleCollaborateurEditSubmit démarré');
  
  const collaborateurId = DataManager ? DataManager.getEditingId() : null;
  if (!collaborateurId) {
    alert('Erreur: ID du collaborateur non trouvé');
    return;
  }
  
  const formData = {
    prenom: document.getElementById('collaborateur-prenom').value.trim(),
    nom: document.getElementById('collaborateur-nom').value.trim(),
    poste: document.getElementById('collaborateur-poste').value.trim(),
    entreprise: document.getElementById('collaborateur-entreprise').value.trim(),
    specialites: document.getElementById('collaborateur-specialites').value.trim(),
    telephone: document.getElementById('collaborateur-telephone').value.trim(),
    email: document.getElementById('collaborateur-email').value.trim(),
    adresse: document.getElementById('collaborateur-adresse').value.trim(),
    notes: document.getElementById('collaborateur-notes').value.trim(),
    tags: document.getElementById('collaborateur-tags')?.value.trim() || ''
  };
  
  // Validation
  if (!formData.prenom || !formData.nom) {
    alert('Le prénom et le nom sont obligatoires');
    return;
  }
  
  // Traitement des tags
  const tags = formData.tags ? formData.tags.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0) : [];
  
  // Mettre à jour le collaborateur
  if (typeof DataManager !== 'undefined' && DataManager.getAppData) {
    const appData = DataManager.getAppData();
    const collaborateurIndex = appData.collaborateurs ? appData.collaborateurs.findIndex(c => c.id === collaborateurId) : -1;
    
    if (collaborateurIndex === -1) {
      alert('Collaborateur introuvable');
      return;
    }
    
    // Conserver la date de création et mettre à jour
    appData.collaborateurs[collaborateurIndex] = {
      ...appData.collaborateurs[collaborateurIndex],
      prenom: formData.prenom,
      nom: formData.nom,
      poste: formData.poste || '',
      entreprise: formData.entreprise || '',
      specialites: formData.specialites || '',
      telephone: formData.telephone || '',
      email: formData.email || '',
      adresse: formData.adresse || '',
      notes: formData.notes || '',
      tags: tags,
      dateModification: new Date().toISOString()
    };
    
    // Sauvegarder
    DataManager.saveData().then(() => {
      // Rafraîchir l'affichage
      if (typeof ViewManager !== 'undefined' && ViewManager.updateClientsDisplay) {
        ViewManager.updateClientsDisplay();
      }
      
      // Fermer la modal
      closeModal();
      
      // Réinitialiser l'ID d'édition
      if (DataManager.setEditingId) {
        DataManager.setEditingId(null);
      }
      
      // Message de succès
      showTemporaryMessage(`🤝 ${formData.prenom} ${formData.nom} mis à jour !`);
    });
  }
}

// ===== FONCTIONS DE GESTION DES TAGS COLLABORATEURS =====
function initCollaborateurTagsSystem() {
  const newTagInput = document.getElementById('collaborateur-new-tag');
  
  if (newTagInput) {
    // Ajout de tag avec Entrée
    newTagInput.addEventListener('keypress', function(e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        addTagToCollaborateur();
      }
    });
  }
}

function addTagToCollaborateur() {
  const newTagInput = document.getElementById('collaborateur-new-tag');
  const tagsContainer = document.getElementById('collaborateur-tags-container');
  const hiddenTagsInput = document.getElementById('collaborateur-tags');
  
  if (!newTagInput || !tagsContainer || !hiddenTagsInput) return;
  
  const newTag = newTagInput.value.trim();
  if (!newTag) return;
  
  // Récupérer les tags existants
  const existingTags = hiddenTagsInput.value ? hiddenTagsInput.value.split(',') : [];
  
  // Vérifier que le tag n'existe pas déjà
  if (existingTags.includes(newTag)) {
    alert('Ce tag existe déjà !');
    return;
  }
  
  // Ajouter le nouveau tag
  existingTags.push(newTag);
  hiddenTagsInput.value = existingTags.join(',');
  
  // Créer l'élément visuel du tag
  const tagElement = document.createElement('span');
  tagElement.className = 'tag-item';
  tagElement.style.cssText = 'display: inline-block; background: #e3f2fd; color: #1976d2; padding: 0.25rem 0.5rem; border-radius: 12px; font-size: 0.8rem; margin: 0.25rem 0.25rem 0 0; cursor: pointer;';
  tagElement.innerHTML = `${newTag} <span style="margin-left: 0.25rem; color: #1976d2; font-weight: bold;">×</span>`;
  tagElement.onclick = () => removeTagFromCollaborateur(newTag);
  
  tagsContainer.appendChild(tagElement);
  
  // Vider l'input
  newTagInput.value = '';
  newTagInput.focus();
}

function removeTagFromCollaborateur(tagToRemove) {
  const tagsContainer = document.getElementById('collaborateur-tags-container');
  const hiddenTagsInput = document.getElementById('collaborateur-tags');
  
  if (!tagsContainer || !hiddenTagsInput) return;
  
  // Mettre à jour les tags dans l'input caché
  const existingTags = hiddenTagsInput.value ? hiddenTagsInput.value.split(',') : [];
  const filteredTags = existingTags.filter(tag => tag !== tagToRemove);
  hiddenTagsInput.value = filteredTags.join(',');
  
  // Régénérer l'affichage des tags
  tagsContainer.innerHTML = filteredTags.map(tag => `
    <span class="tag-item" style="display: inline-block; background: #e3f2fd; color: #1976d2; padding: 0.25rem 0.5rem; border-radius: 12px; font-size: 0.8rem; margin: 0.25rem 0.25rem 0 0; cursor: pointer;" onclick="removeTagFromCollaborateur('${tag}')">
      ${tag} <span style="margin-left: 0.25rem; color: #1976d2; font-weight: bold;">×</span>
    </span>
  `).join('');
}

// ===== FONCTIONS DE SAUVEGARDE (VERSION PWA) =====
// Les sauvegardes sont gerees automatiquement par Supabase
// Ces fonctions sont conservees pour compatibilite d'interface

async function selectBackupFolder() {
  const validationDiv = document.getElementById('backup-path-validation');
  if (validationDiv) {
    validationDiv.innerHTML = `
      <div style="color: #27ae60; font-weight: 500;">
        Les sauvegardes sont gerees automatiquement par Supabase.
        <br><small style="color: #666;">Utilisez le bouton "Exporter" pour telecharger une copie manuelle de vos donnees.</small>
      </div>
    `;
  }
}

async function validateBackupPath(backupPath) {
  // Non pertinent en version PWA - sauvegardes gerees par Supabase
  return;
  /* ANCIEN CODE ELECTRON DESACTIVE
  try {
    console.log('VALIDATION CHEMIN');
    console.log('Chemin a valider:', backupPath);
    
    const validationDiv = document.getElementById('backup-path-validation');
    if (!validationDiv) {
      console.warn('⚠️ Element backup-path-validation non trouvé');
      return;
    }
    
    if (!backupPath || backupPath.trim() === '') {
      validationDiv.innerHTML = `<div style="color: #e74c3c;">❌ Veuillez saisir un chemin</div>`;
      return;
    }
    
    validationDiv.innerHTML = `<div style="color: #f39c12;">🔄 Vérification en cours...</div>`;
    
    // Essayer d'abord avec ipcRenderer
    try {
      const { ipcRenderer } = require('electron');
      console.log('📡 Validation via IPC...');
      
      const validation = await ipcRenderer.invoke('validate-backup-path', backupPath);
      console.log('✅ Résultat validation IPC:', validation);
      
      if (validation.valid) {
        validationDiv.innerHTML = `
          <div style="color: #27ae60; font-weight: 500;">✅ ${validation.message}</div>
        `;
      } else {
        validationDiv.innerHTML = `
          <div style="color: #e74c3c; font-weight: 500;">❌ ${validation.message}</div>
        `;
      }
      return;
      
    } catch (ipcError) {
      console.warn('⚠️ Validation IPC échouée, fallback validation locale:', ipcError.message);
    }
    
    // Fallback : validation basique côté client
    console.log('🔧 Validation locale...');
    const fs = require('fs');
    const path = require('path');
    
    try {
      // Vérifications basiques
      if (!fs.existsSync(backupPath)) {
        validationDiv.innerHTML = `
          <div style="color: #e74c3c;">❌ Le dossier n'existe pas</div>
          <small style="color: #666; display: block; margin-top: 0.5rem;">
            Vérifiez que le chemin est correct et que le dossier existe.
          </small>
        `;
        return;
      }
      
      const stats = fs.statSync(backupPath);
      if (!stats.isDirectory()) {
        validationDiv.innerHTML = `
          <div style="color: #e74c3c;">❌ Ce n'est pas un dossier</div>
          <small style="color: #666; display: block; margin-top: 0.5rem;">
            Le chemin indiqué pointe vers un fichier, pas un dossier.
          </small>
        `;
        return;
      }
      
      // Test d'écriture basique
      const testFile = path.join(backupPath, `test_write_${Date.now()}.tmp`);
      fs.writeFileSync(testFile, 'test de validation');
      fs.unlinkSync(testFile);
      
      console.log('✅ Validation locale réussie');
      validationDiv.innerHTML = `
        <div style="color: #27ae60; font-weight: 500;">✅ Dossier valide et accessible en écriture</div>
        <small style="color: #666; display: block; margin-top: 0.5rem;">
          Les sauvegardes automatiques seront créées dans ce dossier.
        </small>
      `;
      
    } catch (fsError) {
      console.error('❌ Erreur validation locale:', fsError);
      let errorMessage = 'Impossible d\'accéder au dossier';
      
      if (fsError.code === 'EACCES' || fsError.code === 'EPERM') {
        errorMessage = 'Accès refusé - permissions insuffisantes';
      } else if (fsError.code === 'ENOENT') {
        errorMessage = 'Le dossier n\'existe pas';
      } else if (fsError.code === 'ENOTDIR') {
        errorMessage = 'Ce n\'est pas un dossier valide';
      }
      
      validationDiv.innerHTML = `
        <div style="color: #e74c3c; font-weight: 500;">❌ ${errorMessage}</div>
        <small style="color: #666; display: block; margin-top: 0.5rem;">
          Code erreur: ${fsError.code || 'Inconnu'}
        </small>
      `;
    }
    
  } catch (error) {
    console.error('❌ Erreur générale validation chemin:', error);
    const validationDiv = document.getElementById('backup-path-validation');
    if (validationDiv) {
      validationDiv.innerHTML = `
        <div style="color: #e74c3c;">❌ Erreur de validation: ${error.message}</div>
        <small style="color: #666; display: block; margin-top: 0.5rem;">
          Consultez la console pour plus de details.
        </small>
      `;
    }
  }
  FIN ANCIEN CODE ELECTRON */
}

function updateBackupPathStatus() {
  // Version PWA : sauvegardes gerees par Supabase
  const validationDiv = document.getElementById('backup-path-validation');
  if (validationDiv) {
    validationDiv.innerHTML = '<div style="color: #27ae60; font-weight: 500;">Sauvegardes gerees automatiquement par Supabase</div>';
  }
}

// ===== FONCTION DE MIGRATION DES MOYENS DE PAIEMENT =====
// ✅ VERSION CORRIGÉE de migrerMoyensPaiement avec belle modal
async function migrerMoyensPaiement() {
  try {
    // ✅ Utiliser la belle confirmation personnalisée
    const confirmation = await showCustomConfirm(
      '💳 Migration des moyens de paiement\n\n' +
      'Cette opération va ajouter "Liquide" comme moyen de paiement pour toutes les prestations qui n\'en ont pas encore.\n\n' +
      'Les prestations ayant déjà un moyen de paiement ne seront pas modifiées.\n\n' +
      'Continuer ?'
    );
    
    if (!confirmation) return;
    
    if (typeof DataManager !== 'undefined' && DataManager.getAppData) {
      const appData = DataManager.getAppData();
      let prestationsMigrees = 0;
      let prestationsIgnorees = 0;
      
      // Parcourir toutes les prestations
      if (appData.prestations) {
        appData.prestations.forEach(prestation => {
          // Vérifier si la prestation n'a pas de moyen de paiement
          if (!prestation.moyenPaiement || prestation.moyenPaiement.trim() === '') {
            prestation.moyenPaiement = 'Liquide';
            prestationsMigrees++;
          } else {
            prestationsIgnorees++;
          }
        });
      }
      
      // Sauvegarder les modifications
      await DataManager.saveData();
      
      // ✅ Afficher le résultat avec la belle alerte personnalisée
      const message = `📋 ${prestationsMigrees} prestation${prestationsMigrees > 1 ? 's' : ''} mise${prestationsMigrees > 1 ? 's' : ''} à jour avec "Liquide"

⚠️ ${prestationsIgnorees} prestation${prestationsIgnorees > 1 ? 's' : ''} déjà renseignée${prestationsIgnorees > 1 ? 's' : ''} (non modifiée${prestationsIgnorees > 1 ? 's' : ''})

💡 Vos analytics reflètent maintenant les moyens de paiement !`;
      
      await showCustomAlert(message, 'success');
      
      // Fermer la modal des paramètres
      closeModal();
      
      // Rafraîchir les vues si nécessaire
      if (typeof ViewManager !== 'undefined') {
        if (ViewManager.updatePrestationsTable) {
          ViewManager.updatePrestationsTable();
        }
      }
      
      if (typeof UtilsServices !== 'undefined') {
        if (UtilsServices.updateAnalytics) {
          UtilsServices.updateAnalytics();
        }
      }
    }
    
  } catch (error) {
    console.error('Erreur lors de la migration des moyens de paiement:', error);
    await showCustomAlert('❌ Erreur lors de la migration: ' + error.message, 'error');
  }
}

// ===== GESTIONNAIRES D'ÉVÉNEMENTS =====

// Gestionnaire global des soumissions de formulaires
document.addEventListener('submit', function(e) {
  const form = e.target;
  console.log('📝 Soumission de formulaire détectée:', form.id);
  
  // Gestion du formulaire collaborateur
  if (form.id === 'collaborateur-form') {
    const isEdit = DataManager && DataManager.getEditingId ? !!DataManager.getEditingId() : false;
    
    if (isEdit) {
      handleCollaborateurEditSubmit(e);
    } else {
      handleCollaborateurFormSubmit(e);
    }
    return;
  }
  
  // Gestion du formulaire paramètres
  if (form.id === 'parametres-form') {
    handleParametresFormSubmit(e);
    return;
  }
    
  // Autres formulaires...
  console.log('📝 Formulaire non géré par modal-manager:', form.id);
});

async function handleParametresFormSubmit(e) {
  e.preventDefault();
  console.log('🔄 handleParametresFormSubmit démarré');

  const currentParams = DataManager ? DataManager.getParametres() : {};
  const section = e.target.dataset.section;

  let formData = {};

  if (section === 'salon') {
    formData = {
      adresseSalon: document.getElementById('parametres-adresse-salon').value.trim(),
      calculPeriode: document.getElementById('parametres-calcul-periode').value
    };
    if (!formData.adresseSalon) {
      alert('L\'adresse du salon est obligatoire');
      return;
    }
  } else if (section === 'vehicule') {
    formData = {
      consommation: document.getElementById('parametres-consommation').value,
      prixCarburant: document.getElementById('parametres-prix-carburant').value,
      coutUsure: document.getElementById('parametres-cout-usure').value
    };
  } else {
    // Fallback : ancien mode (tous les champs)
    formData = {
      adresseSalon: document.getElementById('parametres-adresse-salon')?.value?.trim() || currentParams.adresseSalon,
      consommation: document.getElementById('parametres-consommation')?.value || currentParams.consommation,
      prixCarburant: document.getElementById('parametres-prix-carburant')?.value || currentParams.prixCarburant,
      coutUsure: document.getElementById('parametres-cout-usure')?.value || currentParams.coutUsure,
      calculPeriode: document.getElementById('parametres-calcul-periode')?.value || currentParams.calculPeriode,
      cheminSauvegardeAuto: document.getElementById('parametres-chemin-sauvegarde')?.value?.trim() || currentParams.cheminSauvegardeAuto,
      googleAdsApiKey: document.getElementById('google-ads-api-key')?.value?.trim() || currentParams.googleAdsApiKey
    };
  }

  try {
    if (typeof DataManager !== 'undefined') {
      if (DataManager.saveParametres) {
        DataManager.saveParametres(formData);
      }
      if (DataManager.saveData) {
        await DataManager.saveData();
      }
    }

    showTemporaryMessage('Parametres sauvegardes !');

    if (typeof ViewManager !== 'undefined' && ViewManager.updateDashboard) {
      ViewManager.updateDashboard();
    }

    // Revenir au hub
    showParametresModal();

  } catch (error) {
    console.error('❌ Erreur sauvegarde paramètres:', error);
    alert('Erreur lors de la sauvegarde des paramètres');
  }
}

// ===== ✅ GOOGLE ADS OAUTH SIMPLIFIÉ =====

// ===== ✅ GOOGLE ADS OAUTH COMPLET - PRÊT À COPIER-COLLER =====

async function connectToGoogleAds() {
  try {
    console.log('🔗 Connexion Google Ads via Electron...');
    
    const statusDiv = document.getElementById('google-ads-status');
    const connectBtn = document.getElementById('connect-google-ads');
    
    if (statusDiv) statusDiv.innerHTML = '<span style="color: #f39c12;">🔄 Connexion en cours...</span>';
    if (connectBtn) connectBtn.disabled = true;
    
    // ✅ Configuration OAuth
    const clientId = '299743000252-n9eus4jp2e0tf7odskhiomcna402jn01.apps.googleusercontent.com';
    const redirectUri = 'urn:ietf:wg:oauth:2.0:oob';
    const scope = 'https://www.googleapis.com/auth/adwords https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile';
    
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
      `client_id=${encodeURIComponent(clientId)}&` +
      `redirect_uri=${encodeURIComponent(redirectUri)}&` +
      `scope=${encodeURIComponent(scope)}&` +
      `response_type=code&` +
      `access_type=offline&` +
      `prompt=consent`;
    
    console.log('🌐 URL OAuth:', authUrl);
    
    // Ouvrir l'URL OAuth dans un nouvel onglet
    window.open(authUrl, '_blank');
    
    // Afficher une modal pour que l'utilisateur colle le code
    const authCode = await showAuthCodeModal();
    
    if (authCode) {
      // Échanger le code contre un token
      const tokenResult = await exchangeAuthCode(authCode, clientId, redirectUri);
      
      if (tokenResult.success) {
        await saveGoogleAdsTokens(tokenResult.tokens);
        await updateGoogleAdsStatus();
        showTemporaryMessage('🎉 Google Ads connecté !', 'success');
      } else {
        if (statusDiv) statusDiv.innerHTML = `<span style="color: #e74c3c;">❌ ${tokenResult.error}</span>`;
      }
    } else {
      if (statusDiv) statusDiv.innerHTML = '<span style="color: #666;">Connexion annulée</span>';
    }
    
    if (connectBtn) connectBtn.disabled = false;
    
  } catch (error) {
    console.error('❌ Erreur connectToGoogleAds:', error);
    const statusDiv = document.getElementById('google-ads-status');
    if (statusDiv) statusDiv.innerHTML = `<span style="color: #e74c3c;">❌ ${error.message}</span>`;
    
    const connectBtn = document.getElementById('connect-google-ads');
    if (connectBtn) connectBtn.disabled = false;
  }
}

function showAuthCodeModal() {
  return new Promise((resolve) => {
    const modalHTML = `
      <h3>🔗 Authentification Google Ads</h3>
      <div style="margin: 1rem 0;">
        <p><strong>Étapes :</strong></p>
        <ol style="text-align: left; margin: 1rem 0;">
          <li>Une page Google s'est ouverte dans votre navigateur</li>
          <li>Connectez-vous et autorisez l'accès</li>
          <li>Google va afficher un <strong>code d'autorisation</strong></li>
          <li>Copiez ce code et collez-le ci-dessous</li>
        </ol>
      </div>
      
      <div class="form-group" style="margin: 1rem 0;">
        <label><strong>Code d'autorisation Google :</strong></label>
        <input 
          type="text" 
          id="auth-code-input" 
          placeholder="Collez le code ici..." 
          style="width: 100%; padding: 0.75rem; border: 1px solid #ddd; border-radius: 6px; font-family: monospace;"
        >
      </div>
      
      <div class="modal-actions" style="margin-top: 2rem;">
        <button type="button" class="btn-secondary" onclick="resolveAuthCode(null)">Annuler</button>
        <button type="button" class="btn-primary" onclick="submitAuthCode()">Valider</button>
      </div>
    `;
    
    // Fonctions pour gérer la modal
    window.resolveAuthCode = (code) => {
      closeModal();
      delete window.resolveAuthCode;
      delete window.submitAuthCode;
      resolve(code);
    };
    
    window.submitAuthCode = () => {
      const code = document.getElementById('auth-code-input').value.trim();
      if (code) {
        window.resolveAuthCode(code);
      } else {
        alert('Veuillez saisir le code d\'autorisation');
      }
    };
    
    showModal('auth-code-modal', modalHTML);
    
    // Focus sur l'input
    setTimeout(() => {
      const input = document.getElementById('auth-code-input');
      if (input) input.focus();
    }, 200);
  });
}

async function exchangeAuthCode(authCode, clientId, redirectUri) {
  try {
    console.log('🔄 Échange code → token...');
    
    // ✅ CORRIGÉ : Bon client secret
    const clientSecret = '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';
    
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        code: authCode
      })
    });
    
    const data = await response.json();
    console.log('📊 Réponse token:', data); // Pour debug
    
    if (response.ok && data.access_token) {
      return {
        success: true,
        tokens: {
          access_token: data.access_token,
          refresh_token: data.refresh_token,
          expires_in: data.expires_in,
          token_type: data.token_type,
          created_at: Date.now()
        }
      };
    } else {
      console.error('❌ Erreur échange token:', data);
      return { success: false, error: data.error_description || data.error || 'Erreur échange token' };
    }
    
  } catch (error) {
    console.error('❌ Erreur exchangeAuthCode:', error);
    return { success: false, error: error.message };
  }
}

async function saveGoogleAdsTokens(tokens) {
  try {
    const parametres = DataManager.getParametres();
    
    // Chiffrement basique des tokens
    const encryptedTokens = btoa(JSON.stringify(tokens));
    
    parametres.googleAdsTokens = encryptedTokens;
    parametres.googleAdsConnected = true;
    parametres.googleAdsConnectedAt = new Date().toISOString();
    
    DataManager.saveParametres(parametres);
    await DataManager.saveData();
    
  } catch (error) {
    console.error('❌ Erreur sauvegarde tokens:', error);
    throw error;
  }
}

async function disconnectFromGoogleAds() {
  try {
    const confirmation = await showCustomConfirm(
      '🔓 Déconnexion Google Ads\n\n' +
      'Voulez-vous vous déconnecter ?\n\n' +
      'Les données ROI ne seront plus mises à jour automatiquement.'
    );
    
    if (!confirmation) return;
    
    const parametres = DataManager.getParametres();
    delete parametres.googleAdsTokens;
    delete parametres.googleAdsConnected;
    delete parametres.googleAdsConnectedAt;
    
    DataManager.saveParametres(parametres);
    await DataManager.saveData();
    
    await updateGoogleAdsStatus();
    showTemporaryMessage('🔓 Déconnecté de Google Ads', 'info');
    
  } catch (error) {
    console.error('❌ Erreur déconnexion:', error);
    showTemporaryMessage('❌ Erreur déconnexion', 'error');
  }
}

async function testGoogleAdsConnection() {
  try {
    console.log('🧪 === TEST GOOGLE ADS UNIFIÉ ===');
    
    const statusDiv = document.getElementById('google-ads-status');
    if (statusDiv) statusDiv.innerHTML = '<span style="color: #f39c12;">🔄 Test en cours...</span>';
    
    // 1. Récupérer les tokens
    const tokens = await getValidTokens();
    if (!tokens) {
      if (statusDiv) statusDiv.innerHTML = '<span style="color: #e74c3c;">❌ Pas de token valide</span>';
      return;
    }
    console.log('✅ Tokens récupérés');
    
    // 2. Test OAuth simple
    const userTest = await testSimpleGoogleAPI(tokens.access_token);
    if (!userTest.success) {
      console.error('❌ OAuth échoué:', userTest.error);
      if (statusDiv) statusDiv.innerHTML = `<span style="color: #e74c3c;">❌ OAuth: ${userTest.error}</span>`;
      return;
    }
    console.log('✅ OAuth fonctionne pour:', userTest.email);
    
    // 3. Test Google Ads API
    const customersResult = await testAccessibleCustomers(tokens.access_token);
    
    if (customersResult.success && customersResult.customers.length > 0) {
      console.log('✅ Google Ads accessible !', customersResult.customers);
      
      // Afficher le succès
      if (statusDiv) {
        statusDiv.innerHTML = `
          <div style="color: #27ae60; font-weight: 600;">✅ ${customersResult.customers.length} compte(s) Google Ads accessible(s)</div>
          <div style="color: #666; font-size: 0.9rem;">Comptes: ${customersResult.customers.join(', ')}</div>
        `;
      }
      
      // 4. Test optionnel des données de campagne
      const firstCustomer = customersResult.customers[0];
      const campaignTest = await testCampaignData(tokens.access_token, firstCustomer);
      
      if (campaignTest.success) {
        console.log('🎉 API Google Ads complètement fonctionnelle !');
        showTemporaryMessage(`🎉 API Google Ads fonctionnelle ! ${campaignTest.campaigns} campagne(s)`, 'success');
      } else {
        console.log('⚠️ Comptes trouvés mais données campagne limitées');
        showTemporaryMessage('⚠️ Comptes trouvés, données limitées', 'warning');
      }
      
    } else {
      // Échec de l'accès Google Ads
      console.error('❌ Google Ads non accessible:', customersResult.error);
      if (statusDiv) {
        statusDiv.innerHTML = `<span style="color: #e74c3c;">❌ Google Ads: ${customersResult.error}</span>`;
      }
      
      // Messages d'aide selon l'erreur
      if (customersResult.error.includes('403') || customersResult.error.includes('PERMISSION_DENIED')) {
        showTemporaryMessage('❌ Demande d\'accès de base Google Ads requise', 'error');
      } else if (customersResult.error.includes('404') || customersResult.error.includes('ENDPOINT_NOT_FOUND')) {
        showTemporaryMessage('❌ Problème d\'URL ou de version API - URL corrigée', 'error');
      } else {
        showTemporaryMessage(`❌ ${customersResult.error}`, 'error');
      }
    }
    
  } catch (error) {
    console.error('❌ Erreur test Google Ads:', error);
    const statusDiv = document.getElementById('google-ads-status');
    if (statusDiv) statusDiv.innerHTML = `<span style="color: #e74c3c;">❌ ${error.message}</span>`;
  }
}

async function testAccessibleCustomers(accessToken) {
  try {
    console.log('📋 Test accès clients Google Ads...');
    
    // ✅ URL CORRECTE avec : au lieu de /
    const response = await fetch('https://googleads.googleapis.com/v20/customers:listAccessibleCustomers', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'developer-token': 'tZ0KGweXjUnyQubimDfCsQ', // ✅ BON TOKEN avec zéro
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'User-Agent': 'Elise-Massage-App/1.0'
      }
    });
    
    console.log('📊 Réponse status:', response.status);
    console.log('📊 Réponse headers:', [...response.headers.entries()]);
    
    if (response.ok) {
      const data = await response.json();
      console.log('✅ Données reçues:', data);
      
      const customers = data.resourceNames || [];
      return { 
        success: true, 
        customers: customers.map(name => name.replace('customers/', ''))
      };
    } else {
      const errorText = await response.text();
      console.error('❌ Erreur API détaillée:', response.status, errorText);
      
      let errorData;
      try {
        errorData = JSON.parse(errorText);
      } catch (e) {
        errorData = { message: errorText };
      }
      
      let friendlyError = `${response.status}: ${errorData.error?.message || errorData.message || 'Erreur inconnue'}`;
      
      if (response.status === 403) {
        friendlyError = 'PERMISSION_DENIED - Demande d\'accès de base Google Ads requise';
      } else if (response.status === 404) {
        friendlyError = 'ENDPOINT_NOT_FOUND - URL ou version API incorrecte';
      } else if (response.status === 401) {
        friendlyError = 'UNAUTHORIZED - Token d\'accès invalide ou expiré';
      }
      
      return { 
        success: false, 
        error: friendlyError,
        details: errorData
      };
    }
  } catch (error) {
    console.error('❌ Erreur réseau:', error);
    return { success: false, error: `Erreur réseau: ${error.message}` };
  }
}

async function testSimpleGoogleAPI(accessToken) {
  try {
    console.log('🧪 Test API Google simple...');
    
    // Test avec l'API userinfo (plus simple)
    const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json'
      }
    });
    
    if (response.ok) {
      const data = await response.json();
      console.log('✅ Infos utilisateur:', data);
      return { 
        success: true, 
        user: data.name || data.email,
        email: data.email 
      };
    } else {
      const errorText = await response.text();
      return { success: false, error: `${response.status}: ${errorText}` };
    }
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function testCampaignData(accessToken, customerId) {
  try {
    console.log('📊 Test données campagne pour:', customerId);
    
    const query = `
      SELECT 
        campaign.id,
        campaign.name,
        campaign.status
      FROM campaign 
      WHERE campaign.status = 'ENABLED'
      LIMIT 5
    `;
    
    // ✅ URL correcte v20
    const response = await fetch(`https://googleads.googleapis.com/v20/customers/${customerId}/googleAds:searchStream`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'developer-token': 'tZ0KGweXjUnyQubimDfCsQ', // ✅ BON TOKEN avec zéro
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'User-Agent': 'Elise-Massage-App/1.0'
      },
      body: JSON.stringify({ query: query })
    });
    
    console.log('📊 Réponse campagne status:', response.status);
    
    if (response.ok) {
      const data = await response.json();
      console.log('📊 Données campagne:', data);
      
      let campaignCount = 0;
      if (data.results) {
        campaignCount = data.results.length;
      }
      
      return {
        success: true,
        campaigns: campaignCount,
        message: `${campaignCount} campagne(s) active(s) trouvée(s)`
      };
      
    } else {
      const errorText = await response.text();
      console.error('❌ Erreur données campagne:', response.status, errorText);
      
      return { 
        success: false, 
        error: `${response.status}: Données campagne inaccessibles`
      };
    }
    
  } catch (error) {
    console.error('❌ Erreur testCampaignData:', error);
    return { success: false, error: `Erreur réseau: ${error.message}` };
  }
}

async function getValidTokens() {
  try {
    const parametres = DataManager.getParametres();
    const encryptedTokens = parametres.googleAdsTokens;
    
    if (!encryptedTokens) return null;
    
    const tokens = JSON.parse(atob(encryptedTokens));
    
    // Vérifier expiration
    const expiresAt = tokens.created_at + (tokens.expires_in * 1000);
    if (Date.now() < expiresAt) {
      return tokens;
    }
    
    // Rafraîchir le token si expiré
    if (tokens.refresh_token) {
      const refreshed = await refreshToken(tokens.refresh_token);
      if (refreshed.success) {
        await saveGoogleAdsTokens(refreshed.tokens);
        return refreshed.tokens;
      }
    }
    
    return null;
    
  } catch (error) {
    console.error('❌ Erreur getValidTokens:', error);
    return null;
  }
}

async function refreshToken(refreshToken) {
  try {
    console.log('🔄 Rafraîchissement token...');
    
    // ✅ CORRIGÉ : Bons identifiants
    const clientId = '299743000252-n9eus4jp2e0tf7odskhiomcna402jn01.apps.googleusercontent.com';
    const clientSecret = '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';
    
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken
      })
    });
    
    const data = await response.json();
    
    if (response.ok && data.access_token) {
      console.log('✅ Token rafraîchi');
      return {
        success: true,
        tokens: {
          access_token: data.access_token,
          refresh_token: refreshToken, // Garde l'ancien refresh token
          expires_in: data.expires_in,
          token_type: data.token_type,
          created_at: Date.now()
        }
      };
    } else {
      console.error('❌ Erreur refresh:', data);
      return { success: false, error: data.error_description || data.error };
    }
    
  } catch (error) {
    console.error('❌ Erreur refreshToken:', error);
    return { success: false, error: error.message };
  }
}

// ===== 🔄 FONCTION updateGoogleAdsStatus MISE À JOUR =====

async function updateGoogleAdsStatus() {
  const statusDiv = document.getElementById('google-ads-status');
  const connectBtn = document.getElementById('connect-google-ads');
  const disconnectBtn = document.getElementById('disconnect-google-ads');
  const testBtn = document.getElementById('test-google-ads');
  const manageCampaignsBtn = document.getElementById('manage-campaigns'); // ✅ NOUVEAU
  const campaignsSummaryDiv = document.getElementById('campaigns-summary'); // ✅ NOUVEAU
  
  if (!statusDiv) return;
  
  const parametres = DataManager.getParametres();
  const isConnected = parametres.googleAdsConnected;
  
  if (isConnected) {
    const date = new Date(parametres.googleAdsConnectedAt).toLocaleDateString('fr-FR');
    statusDiv.innerHTML = `<span style="color: #27ae60;">✅ Connecté depuis le ${date}</span>`;
    
    // Boutons de connexion
    if (connectBtn) connectBtn.style.display = 'none';
    if (disconnectBtn) disconnectBtn.style.display = 'inline-block';
    if (testBtn) testBtn.style.display = 'inline-block';
    if (manageCampaignsBtn) manageCampaignsBtn.style.display = 'inline-block'; // ✅ NOUVEAU
    
    // ✅ NOUVEAU : Afficher le résumé des campagnes sélectionnées
    const selectedCampaigns = parametres.googleAdsSelectedCampaigns || [];
    if (selectedCampaigns.length > 0 && campaignsSummaryDiv) {
      campaignsSummaryDiv.style.display = 'block';
      
      // Récupérer les détails des campagnes si possible
      try {
        const campaignsDetails = await getCampaignsDetails(selectedCampaigns);
        const totalCost = campaignsDetails.reduce((sum, c) => sum + (c.cost || 0), 0);
        
        const campaignsListDiv = document.getElementById('campaigns-list');
        if (campaignsListDiv) {
          campaignsListDiv.innerHTML = `
            <div style="margin-bottom: 0.5rem;">
              <strong>${selectedCampaigns.length} campagne(s) • Coût total: ${totalCost.toFixed(2)}€</strong>
            </div>
            ${campaignsDetails.map(campaign => `
              <div style="display: flex; justify-content: space-between; padding: 0.25rem 0; border-bottom: 1px solid rgba(21,87,36,0.1); font-size: 0.85rem;">
                <span>${campaign.name || `Campagne ${campaign.id}`}</span>
                <span style="font-weight: 600;">${(campaign.cost || 0).toFixed(2)}€</span>
              </div>
            `).join('')}
            <div style="margin-top: 0.5rem; font-size: 0.8rem; color: #666;">
              📅 Dernière mise à jour: ${parametres.googleAdsLastUpdate ? new Date(parametres.googleAdsLastUpdate).toLocaleDateString('fr-FR') : 'Jamais'}
            </div>
          `;
        }
      } catch (error) {
        console.error('❌ Erreur récupération détails campaigns:', error);
        const campaignsListDiv = document.getElementById('campaigns-list');
        if (campaignsListDiv) {
          campaignsListDiv.innerHTML = `${selectedCampaigns.length} campagne(s) sélectionnée(s)`;
        }
      }
    } else if (campaignsSummaryDiv) {
      campaignsSummaryDiv.style.display = 'none';
    }
    
  } else {
    statusDiv.innerHTML = '<span style="color: #666;">Non connecté</span>';
    
    // Boutons de connexion
    if (connectBtn) connectBtn.style.display = 'inline-block';
    if (disconnectBtn) disconnectBtn.style.display = 'none';
    if (testBtn) testBtn.style.display = 'none';
    if (manageCampaignsBtn) manageCampaignsBtn.style.display = 'none'; // ✅ NOUVEAU
    if (campaignsSummaryDiv) campaignsSummaryDiv.style.display = 'none'; // ✅ NOUVEAU
  }
}

// ✅ NOUVELLE FONCTION : Récupérer les détails des campagnes sélectionnées
async function getCampaignsDetails(selectedCampaignIds) {
  try {
    const tokens = await getValidTokens();
    if (!tokens) return [];
    
    // Récupérer tous les comptes accessibles
    const customersResult = await testAccessibleCustomers(tokens.access_token);
    if (!customersResult.success) return [];
    
    // Récupérer les détails de toutes les campagnes
    const allCampaigns = [];
    for (const customerId of customersResult.customers) {
      try {
        const campaigns = await getCampaignsForCustomer(tokens.access_token, customerId);
        allCampaigns.push(...campaigns);
      } catch (error) {
        console.error(`❌ Erreur compte ${customerId}:`, error);
      }
    }
    
    // Filtrer seulement les campagnes sélectionnées
    return allCampaigns.filter(campaign => selectedCampaignIds.includes(campaign.id));
    
  } catch (error) {
    console.error('❌ Erreur getCampaignsDetails:', error);
    return [];
  }
}

// ===== 🚀 GESTION CAMPAGNES GOOGLE ADS =====

async function showCampaignManagementModal() {
  try {
    console.log('🎯 Ouverture modal gestion campagnes...');
    
    // Récupérer les tokens
    const tokens = await getValidTokens();
    if (!tokens) {
      showTemporaryMessage('❌ Connectez-vous d\'abord à Google Ads', 'error');
      return;
    }
    
    // Récupérer tous les comptes accessibles
    const customersResult = await testAccessibleCustomers(tokens.access_token);
    if (!customersResult.success) {
      showTemporaryMessage('❌ Impossible d\'accéder aux comptes Google Ads', 'error');
      return;
    }
    
    // Afficher le modal avec loading
    const loadingHTML = `
      <h3>📊 Gestion des campagnes Google Ads</h3>
      <div style="text-align: center; padding: 2rem;">
        <div style="font-size: 2rem; margin-bottom: 1rem;">🔄</div>
        <p>Chargement des campagnes...</p>
        <p style="color: #666; font-size: 0.9rem;">Récupération depuis ${customersResult.customers.length} compte(s)</p>
      </div>
    `;
    
    showModal('campaign-management-modal', loadingHTML);
    
    // Récupérer toutes les campagnes de tous les comptes
    const allCampaigns = [];
    for (const customerId of customersResult.customers) {
      try {
        const campaigns = await getCampaignsForCustomer(tokens.access_token, customerId);
        allCampaigns.push(...campaigns);
      } catch (error) {
        console.error(`❌ Erreur compte ${customerId}:`, error);
      }
    }
    
    // Récupérer les campagnes actuellement sélectionnées
    const parametres = DataManager.getParametres();
    const selectedCampaigns = parametres.googleAdsSelectedCampaigns || [];
    
    // Générer le contenu de la modal
    const modalHTML = generateCampaignModalHTML(allCampaigns, selectedCampaigns);
    
    // Mettre à jour la modal
    showModal('campaign-management-modal', modalHTML);
    
setTimeout(() => {
  console.log('🔧 Configuration des checkboxes...');
  
  const parametres = DataManager.getParametres();
  const selectedCampaigns = parametres.googleAdsSelectedCampaigns || [];
  const checkboxes = document.querySelectorAll('input[type="checkbox"][data-campaign-id]');
  
  // 1. D'abord tout décocher
  checkboxes.forEach(cb => {
    cb.checked = false;
    const item = cb.closest('.campaign-item');
    if (item) item.style.background = 'white';
  });
  
  // 2. Cocher seulement les vraies sélections
  selectedCampaigns.forEach(campaignId => {
    const checkbox = document.querySelector(`input[data-campaign-id="${campaignId}"]`);
    if (checkbox) {
      checkbox.checked = true;
      const item = checkbox.closest('.campaign-item');
      if (item) item.style.background = '#e8f5e8';
    }
  });
  
  // 3. Ajouter les event listeners APRÈS
  checkboxes.forEach(cb => {
    cb.addEventListener('change', () => toggleCampaignSelection(cb.getAttribute('data-campaign-id')));
  });
  
  console.log('✅ Checkboxes configurées proprement');
}, 100);
    
  } catch (error) {
    console.error('❌ Erreur showCampaignManagementModal:', error);
    showTemporaryMessage('❌ Erreur lors du chargement des campagnes', 'error');
  }
}

async function getCampaignsForCustomer(accessToken, customerId) {
  try {
    console.log(`📊 Récupération campagnes pour ${customerId}...`);
    
    const query = `
      SELECT 
        campaign.id,
        campaign.name,
        campaign.status,
        metrics.cost_micros,
        metrics.clicks,
        metrics.impressions
      FROM campaign
      WHERE segments.date DURING LAST_30_DAYS
      ORDER BY campaign.name
      LIMIT 50
    `;
    
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
      console.log(`📊 Réponse brute pour ${customerId}:`, data);
      
      const campaigns = [];
      
      // ✅ CORRECTION : La structure est data[0].results
      let results = [];
      
      if (Array.isArray(data) && data.length > 0 && data[0].results) {
        results = data[0].results;
        console.log(`✅ Trouvé ${results.length} résultat(s) dans data[0].results`);
      } else {
        console.log('❌ Structure data[0].results non trouvée');
        return [];
      }
      
      // ✅ TRAITEMENT CORRIGÉ DES RÉSULTATS
      results.forEach((result, index) => {
        console.log(`🔍 Résultat ${index}:`, result);
        
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
              ctr: 0
            };
            
            // Calculs dérivés sécurisés
            if (campaign.clicks > 0 && campaign.cost > 0) {
              campaign.cpc = campaign.cost / campaign.clicks;
            }
            if (campaign.impressions > 0 && campaign.clicks > 0) {
              campaign.ctr = (campaign.clicks / campaign.impressions) * 100;
            }
            
            campaigns.push(campaign);
            console.log(`✅ Campagne ajoutée: ${campaign.name} (ID: ${campaign.id}, ${campaign.cost}€)`);
            
          } catch (parseError) {
            console.error(`❌ Erreur parsing résultat ${index}:`, parseError);
          }
        } else {
          console.log(`⚠️ Résultat ${index} ignoré - structure invalide:`, {
            hasResult: !!result,
            hasCampaign: !!(result && result.campaign),
            hasResourceName: !!(result && result.campaign && result.campaign.resourceName),
            hasName: !!(result && result.campaign && result.campaign.name)
          });
        }
      });
      
      console.log(`✅ FINAL: ${campaigns.length} campagne(s) parsée(s) pour ${customerId}`);
      return campaigns;
      
    } else {
      const errorText = await response.text();
      console.error(`❌ Erreur HTTP ${response.status} pour ${customerId}:`, errorText);
      
      // Gestion spéciale compte manager
      if (response.status === 400 && errorText.includes('REQUESTED_METRICS_FOR_MANAGER')) {
        console.log(`ℹ️ ${customerId} est un compte manager, ignoré`);
        return [];
      }
      
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }
    
  } catch (error) {
    console.error(`❌ Erreur getCampaignsForCustomer ${customerId}:`, error);
    throw error;
  }
}

function generateCampaignModalHTML(allCampaigns, selectedCampaigns) {
  if (allCampaigns.length === 0) {
    return `
      <h3>📊 Gestion des campagnes Google Ads</h3>
      <div style="text-align: center; padding: 2rem;">
        <div style="font-size: 2rem; margin-bottom: 1rem;">📭</div>
        <p>Aucune campagne trouvée</p>
        <p style="color: #666; font-size: 0.9rem;">Vérifiez vos comptes Google Ads ou la période de données</p>
      </div>
      <div class="modal-actions">
        <button type="button" class="btn-secondary" onclick="closeModal()">Fermer</button>
      </div>
    `;
  }
  
  // Grouper par compte
  const campaignsByAccount = {};
  allCampaigns.forEach(campaign => {
    if (!campaignsByAccount[campaign.customerId]) {
      campaignsByAccount[campaign.customerId] = [];
    }
    campaignsByAccount[campaign.customerId].push(campaign);
  });
  
  // Calculer les totaux
  const totalSelected = selectedCampaigns.length;
  const totalCost = allCampaigns
    .filter(c => selectedCampaigns.includes(c.id))
    .reduce((sum, c) => sum + c.cost, 0);
  
  return `
    <h3>📊 Gestion des campagnes Google Ads</h3>
    
    <!-- Résumé -->
    <div style="background: #f8f9fa; padding: 1rem; border-radius: 8px; margin-bottom: 1.5rem;">
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <div>
          <strong>${totalSelected} campagne(s) sélectionnée(s)</strong>
          <div style="color: #666; font-size: 0.9rem;">Coût total: <strong>${totalCost.toFixed(2)}€</strong></div>
        </div>
        <div style="display: flex; gap: 0.5rem;">
          <button type="button" onclick="selectAllCampaigns()" class="btn-secondary" style="font-size: 0.8rem; padding: 0.4rem 0.8rem;">
            ✅ Tout sélectionner
          </button>
          <button type="button" onclick="deselectAllCampaigns()" class="btn-secondary" style="font-size: 0.8rem; padding: 0.4rem 0.8rem;">
            ❌ Tout désélectionner
          </button>
        </div>
      </div>
    </div>
    
    <!-- Liste des campagnes par compte -->
    <div style="max-height: 400px; overflow-y: auto;">
      ${Object.entries(campaignsByAccount).map(([customerId, campaigns]) => `
        <div style="margin-bottom: 1.5rem;">
          <h4 style="margin: 0 0 0.75rem 0; color: var(--beige-dore); display: flex; align-items: center; gap: 0.5rem;">
            📈 Compte ${customerId}
            <span style="font-size: 0.8rem; font-weight: normal; color: #666;">(${campaigns.filter(c => c.status !== 'REMOVED').length} campagne(s))</span>
          </h4>
          
          ${campaigns.filter(campaign => campaign.status !== 'REMOVED').map(campaign => {
            const isSelected = selectedCampaigns.includes(campaign.id);
            const statusColor = campaign.status === 'ENABLED' ? '#28a745' : 
                               campaign.status === 'PAUSED' ? '#ffc107' : '#6c757d';
            const statusText = campaign.status === 'ENABLED' ? 'Active' : 
                              campaign.status === 'PAUSED' ? 'En pause' : campaign.status;
            
            return `
              <div class="campaign-item" style="
                display: flex; 
                align-items: center; 
                padding: 0.75rem; 
                border: 1px solid #e0e0e0; 
                border-radius: 6px; 
                margin-bottom: 0.5rem;
                background: ${isSelected ? '#e8f5e8' : 'white'};
                transition: all 0.2s ease;
              ">
                <label style="display: flex; align-items: center; flex: 1; cursor: pointer;">
                  <input 
                    type="checkbox" 
                    id="campaign-${campaign.id}"
                    value="${campaign.id}"
                    data-campaign-id="${campaign.id}"
                    style="margin-right: 0.75rem; transform: scale(1.2);"
                  >
                  
                  <div style="flex: 1;">
                    <div style="font-weight: 600; color: var(--text-dark); display: flex; justify-content: space-between; align-items: center;">
                      <span>${campaign.name}</span>
                      <button type="button" onclick="showCampaignPeriodsModal('${campaign.id}', '${campaign.name}')" class="btn-secondary" style="padding: 0.3rem 0.6rem; font-size: 0.75rem; margin-left: 0.5rem;">
                        📅 Périodes
                      </button>
                    </div>
                    <div style="font-size: 0.85rem; color: #666; display: flex; gap: 1rem; margin-top: 0.25rem; flex-wrap: wrap;">
                      <span style="color: ${statusColor};">● ${statusText}</span>
                      <span><strong>💰 ${campaign.cost.toFixed(2)}€</strong></span>
                      <span>👁️ ${campaign.impressions.toLocaleString()}</span>
                      <span>👆 ${campaign.clicks.toLocaleString()}</span>
                      ${campaign.ctr > 0 ? `<span>📊 CTR ${campaign.ctr.toFixed(2)}%</span>` : ''}
                    </div>
                  </div>
                </label>
              </div>
            `;
          }).join('')}
        </div>
      `).join('')}
    </div>
    
    <!-- Actions -->
    <div class="modal-actions" style="margin-top: 1.5rem;">
      <button type="button" class="btn-secondary" onclick="closeModal()">Annuler</button>
      <button type="button" class="btn-primary" onclick="saveCampaignSelection()">
        💾 Sauvegarder la sélection
      </button>
    </div>
  `;
}

function toggleCampaignSelection(campaignId) {
  console.log('🔄 Toggle campagne:', campaignId);
  
  const checkbox = document.getElementById(`campaign-${campaignId}`);
  const campaignItem = checkbox.closest('.campaign-item');
  
  // ✅ CORRECTION : Récupérer la liste actuelle depuis les paramètres
  const parametres = DataManager.getParametres();
  let selectedCampaigns = parametres.googleAdsSelectedCampaigns || [];
  
  if (checkbox.checked) {
    // Ajouter si pas déjà présent
    if (!selectedCampaigns.includes(campaignId)) {
      selectedCampaigns.push(campaignId);
    }
    campaignItem.style.background = '#e8f5e8';
  } else {
    // Supprimer de la liste
    selectedCampaigns = selectedCampaigns.filter(id => id !== campaignId);
    campaignItem.style.background = 'white';
  }
  
  // ✅ CORRECTION : Sauvegarder immédiatement la nouvelle liste
  parametres.googleAdsSelectedCampaigns = selectedCampaigns;
  DataManager.saveParametres(parametres);
  
  console.log(`✅ Liste mise à jour:`, selectedCampaigns);
  
  // Mettre à jour le résumé
  updateCampaignSummary();
}

function updateCampaignSummary() {
  const checkboxes = document.querySelectorAll('input[type="checkbox"][id^="campaign-"]:checked');
  const selectedCount = checkboxes.length;
  
  // Calculer le coût total des campagnes sélectionnées
  let totalCost = 0;
  checkboxes.forEach(checkbox => {
    const campaignItem = checkbox.closest('.campaign-item');
    const costText = campaignItem.querySelector('[style*="font-weight: 600"]');
    if (costText) {
      const costMatch = costText.textContent.match(/💰 ([\d.]+)€/);
      if (costMatch) {
        totalCost += parseFloat(costMatch[1]);
      }
    }
  });
  
  // Mettre à jour l'affichage du résumé
  const summaryDiv = document.querySelector('[style*="display: flex; justify-content: space-between"]');
  if (summaryDiv) {
    const textDiv = summaryDiv.querySelector('div:first-child');
    if (textDiv) {
      textDiv.innerHTML = `
        <strong>${selectedCount} campagne(s) sélectionnée(s)</strong>
        <div style="color: #666; font-size: 0.9rem;">Coût total: <strong>${totalCost.toFixed(2)}€</strong></div>
      `;
    }
  }
}

function selectAllCampaigns() {
  const checkboxes = document.querySelectorAll('input[type="checkbox"][id^="campaign-"]');
  checkboxes.forEach(checkbox => {
    checkbox.checked = true;
    const campaignItem = checkbox.closest('.campaign-item');
    campaignItem.style.background = '#e8f5e8';
  });
  updateCampaignSummary();
}

function deselectAllCampaigns() {
  const checkboxes = document.querySelectorAll('input[type="checkbox"][id^="campaign-"]');
  checkboxes.forEach(checkbox => {
    checkbox.checked = false;
    const campaignItem = checkbox.closest('.campaign-item');
    campaignItem.style.background = 'white';
  });
  updateCampaignSummary();
}

function updateCampaignSummary() {
  // Cette fonction sera appelée pour mettre à jour le résumé en temps réel
  // On l'implémentera dans la prochaine étape
  console.log('🔄 Mise à jour résumé campagnes...');
}

async function saveCampaignSelection() {
  try {
    console.log('💾 Sauvegarde sélection campagnes...');
    
    // ✅ Les campagnes sont déjà sauvegardées par toggleCampaignSelection
    // On récupère juste la liste actuelle
    const parametres = DataManager.getParametres();
    const selectedCampaigns = parametres.googleAdsSelectedCampaigns || [];
    
    // Mettre à jour la date de dernière mise à jour
    parametres.googleAdsLastUpdate = new Date().toISOString();
    DataManager.saveParametres(parametres);
    await DataManager.saveData();
    
    console.log(`✅ ${selectedCampaigns.length} campagne(s) confirmée(s)`);
    
    // Fermer la modal
    closeModal();
    
    // Message de succès
    showTemporaryMessage(`✅ ${selectedCampaigns.length} campagne(s) sélectionnée(s) !`, 'success');
    
    // Mettre à jour le dashboard si possible
    if (typeof ViewManager !== 'undefined' && ViewManager.updateDashboard) {
      ViewManager.updateDashboard();
    }
    
  } catch (error) {
    console.error('❌ Erreur sauvegarde campagnes:', error);
    showTemporaryMessage('❌ Erreur lors de la sauvegarde', 'error');
  }
}

// ✅ NOUVELLE FONCTION - À AJOUTER dans modal-manager.js
// Synchronisation du cache Google Ads en arrière-plan

async function updateGoogleAdsCache() {
  try {
    console.log('🔄 Mise à jour cache Google Ads...');
    
    const parametres = DataManager.getParametres();
    const selectedCampaigns = parametres.googleAdsSelectedCampaigns || [];
    
    if (selectedCampaigns.length === 0 || !parametres.googleAdsConnected) {
      console.log('ℹ️ Pas de campagnes sélectionnées ou pas connecté');
      return;
    }

    // Vérifier si mise à jour nécessaire (pas plus d'une fois par heure)
    const lastUpdate = parametres.googleAdsLastCacheUpdate;
    if (lastUpdate) {
      const lastUpdateTime = new Date(lastUpdate);
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      if (lastUpdateTime > oneHourAgo) {
        console.log('ℹ️ Cache Google Ads récent, pas de mise à jour nécessaire');
        return;
      }
    }

    let totalCost = 0;
    const tokens = await getValidTokens();
    
    if (tokens) {
      const customersResult = await testAccessibleCustomers(tokens.access_token);
      if (customersResult.success) {
        for (const customerId of customersResult.customers) {
          try {
            const campaigns = await getCampaignsForCustomer(tokens.access_token, customerId);
            const selectedCampaignsData = campaigns.filter(c => selectedCampaigns.includes(c.id));
            totalCost += selectedCampaignsData.reduce((sum, c) => sum + (c.cost || 0), 0);
          } catch (error) {
            console.error(`❌ Erreur récupération campagnes ${customerId}:`, error);
          }
        }
      }
    }

    // Mettre à jour le cache
    parametres.googleAdsCachedCost = totalCost;
    parametres.googleAdsLastCacheUpdate = new Date().toISOString();
    DataManager.saveParametres(parametres);
    await DataManager.saveData();
    
    console.log(`✅ Cache Google Ads mis à jour: ${totalCost.toFixed(2)}€`);

    // Rafraîchir le dashboard si affiché
    if (typeof ViewManager !== 'undefined' && ViewManager.updateDashboard) {
      ViewManager.updateDashboard();
    }

  } catch (error) {
    console.error('❌ Erreur mise à jour cache Google Ads:', error);
  }
}

// ✅ APPELER AU DÉMARRAGE ET PÉRIODIQUEMENT
// À ajouter dans l'initialisation de l'application
window.addEventListener('load', () => {
  // Mise à jour du cache au démarrage (sans attendre)
  setTimeout(() => {
    updateGoogleAdsCache();
  }, 2000);
  
  // Mise à jour périodique toutes les heures
  setInterval(() => {
    updateGoogleAdsCache();
  }, 60 * 60 * 1000); // 1 heure
});


// ===== GESTION PÉRIODES CAMPAGNES =====

async function showCampaignPeriodsModal(campaignId, campaignName) {
  const periods = DataManager.getCampaignPeriods(campaignId);
  
  const modalHTML = `
    <h3>📅 Périodes de campagne</h3>
    <p style="color: #666; margin-bottom: 1rem;">Campagne : <strong>${campaignName || campaignId}</strong></p>
    
    <div style="margin-bottom: 1.5rem;">
      <button onclick="showAddPeriodForm('${campaignId}')" class="btn-primary" style="width: 100%;">
        ➕ Nouvelle période
      </button>
    </div>
    
    <div style="max-height: 400px; overflow-y: auto;">
      ${periods.length === 0 ? `
        <div style="text-align: center; padding: 2rem; color: #666;">
          <div style="font-size: 2rem; margin-bottom: 1rem;">📭</div>
          <p>Aucune période définie</p>
          <small>Cliquez sur "Nouvelle période" pour commencer</small>
        </div>
      ` : periods.map(p => `
        <div style="border: 1px solid #ddd; padding: 1rem; margin-bottom: 0.5rem; border-radius: 6px; background: ${p.endDate ? '#f8f9fa' : '#e8f5e8'};">
          <div style="display: flex; justify-content: space-between; align-items: start;">
            <div style="flex: 1;">
              <div style="font-weight: 600; color: var(--beige-dore); margin-bottom: 0.5rem;">
                ${p.endDate ? '🔒' : '✅'} Période ${p.endDate ? 'terminée' : 'active'}
              </div>
              <div style="font-size: 0.9rem;">
                <strong>Du ${new Date(p.startDate).toLocaleDateString('fr-FR')}</strong>
                ${p.endDate ? ` au <strong>${new Date(p.endDate).toLocaleDateString('fr-FR')}</strong>` : ` à <strong>Aujourd'hui</strong>`}
              </div>
              ${p.frozenCost ? `
                <div style="margin-top: 0.5rem; color: var(--beige-dore); font-weight: 600;">
                  💰 Coût figé : ${p.frozenCost.toFixed(2)}€
                </div>
              ` : ''}
            </div>
            <div style="display: flex; gap: 0.5rem;">
              ${!p.endDate ? `
                <button onclick="endPeriodNow('${p.id}', '${campaignId}', '${campaignName}')" 
                  class="btn-secondary" style="padding: 0.4rem 0.8rem; font-size: 0.8rem;">
                  🔒 Clôturer
                </button>
              ` : ''}
              <button onclick="deletePeriodConfirm('${p.id}', '${campaignId}', '${campaignName}')" 
                class="btn-secondary" style="padding: 0.4rem 0.8rem; font-size: 0.8rem; background: #dc3545;">
                🗑️
              </button>
            </div>
          </div>
        </div>
      `).join('')}
    </div>
    
    <div class="modal-actions" style="margin-top: 1.5rem;">
      <button onclick="closeModal()" class="btn-secondary">Fermer</button>
    </div>
  `;
  
  showModal('periods-modal', modalHTML);
}

function showAddPeriodForm(campaignId) {
  const modalHTML = `
    <h3>➕ Nouvelle période</h3>
    <form id="add-period-form">
      <div class="form-group">
        <label>Date de début *</label>
        <input type="date" id="period-start-date" required value="${new Date().toISOString().split('T')[0]}">
      </div>
      
      <div class="form-group">
        <label>Date de fin (optionnel)</label>
        <input type="date" id="period-end-date">
        <small style="color: #666;">Laissez vide pour une période active jusqu'à aujourd'hui</small>
      </div>
      
      <div class="form-group">
        <label>Coût figé (optionnel)</label>
        <input type="number" id="period-frozen-cost" step="0.01" placeholder="0.00">
        <small style="color: #666;">Si vous connaissez déjà le coût de cette période</small>
      </div>
      
      <div class="modal-actions">
        <button type="button" onclick="showCampaignPeriodsModal('${campaignId}')" class="btn-secondary">Retour</button>
        <button type="submit" class="btn-primary">Créer</button>
      </div>
    </form>
  `;
  
  showModal('add-period-modal', modalHTML);
  
  setTimeout(() => {
    const form = document.getElementById('add-period-form');
    if (form) {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const startDate = document.getElementById('period-start-date').value;
        const endDate = document.getElementById('period-end-date').value || null;
        const frozenCost = parseFloat(document.getElementById('period-frozen-cost').value) || null;
        
        DataManager.addCampaignPeriod(campaignId, {
          startDate,
          endDate,
          frozenCost
        });
        
        await DataManager.saveData();
        showTemporaryMessage('✅ Période créée !', 'success');
        showCampaignPeriodsModal(campaignId);
      });
    }
  }, 100);
}

function endPeriodNow(periodId, campaignId, campaignName) {
  const modalHTML = `
    <h3>🔒 Clôturer la période</h3>
    <p>Cette action va :</p>
    <ul style="text-align: left; margin: 1rem 0;">
      <li>Fixer la date de fin à aujourd'hui</li>
      <li>Figer le coût actuel de la campagne</li>
      <li>Créer une nouvelle période active automatiquement</li>
    </ul>
    
    <form id="end-period-form">
      <div class="form-group">
        <label>Coût final de cette période *</label>
        <input type="number" id="final-cost" step="0.01" required placeholder="0.00">
      </div>
      
      <div class="modal-actions">
        <button type="button" onclick="showCampaignPeriodsModal('${campaignId}', '${campaignName}')" class="btn-secondary">Annuler</button>
        <button type="submit" class="btn-primary" style="background: #dc3545;">🔒 Clôturer</button>
      </div>
    </form>
  `;
  
  showModal('end-period-modal', modalHTML);
  
  setTimeout(() => {
    const form = document.getElementById('end-period-form');
    if (form) {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const finalCost = parseFloat(document.getElementById('final-cost').value);
        
        DataManager.endCampaignPeriod(periodId, finalCost);
        await DataManager.saveData();
        
        showTemporaryMessage('✅ Période clôturée !', 'success');
        showCampaignPeriodsModal(campaignId, campaignName);
      });
    }
  }, 100);
}

function deletePeriodConfirm(periodId, campaignId, campaignName) {
  const modalHTML = `
    <h3>⚠️ Supprimer la période</h3>
    <p style="margin: 1rem 0;">Êtes-vous sûr de vouloir supprimer cette période ?</p>
    <p style="color: #dc3545; font-weight: 600;">Cette action est irréversible !</p>
    
    <div class="modal-actions" style="margin-top: 2rem;">
      <button onclick="showCampaignPeriodsModal('${campaignId}', '${campaignName}')" class="btn-secondary">Annuler</button>
      <button onclick="confirmDeletePeriod('${periodId}', '${campaignId}', '${campaignName}')" class="btn-primary" style="background: #dc3545;">🗑️ Supprimer</button>
    </div>
  `;
  
  showModal('delete-period-modal', modalHTML);
}

function confirmDeletePeriod(periodId, campaignId, campaignName) {
  DataManager.deleteCampaignPeriod(periodId);
  DataManager.saveData();
  showTemporaryMessage('✅ Période supprimée', 'success');
  showCampaignPeriodsModal(campaignId, campaignName);
}

// ===== CARTE DES SOINS - MODALE DE GESTION =====

function showCarteSoinsModal() {
  const grouped = DataManager.getSoinsGroupedByCategorie({ allStatuts: true, includeArchived: true, includeEmpty: true });

  function renderSoinRow(soin) {
    const statutColor = soin.statut === 'actif' ? '#27ae60' : soin.statut === 'standby' ? '#f39c12' : '#e74c3c';
    const statutLabel = soin.statut === 'actif' ? 'Actif' : soin.statut === 'standby' ? 'Stand-by' : 'Archive';
    const partnerBadge = soin.isPartnership ? '<span style="background: #9b59b6; color: white; padding: 0.1rem 0.4rem; border-radius: 8px; font-size: 0.7rem; margin-left: 0.25rem;">Partenariat</span>' : '';

    const variantesText = soin.variantes.map(v => {
      if (soin.isPartnership && v.maPartFixe !== undefined) {
        return `${v.duree}min: ${v.prixTotal || v.prix}\u20ac (ma part: ${v.maPartFixe}\u20ac)`;
      }
      return `${v.duree}min: ${v.prix}\u20ac`;
    }).join(' | ');

    return `
      <div style="display: flex; align-items: center; justify-content: space-between; padding: 0.5rem 0.75rem; border-bottom: 1px solid #eee; ${soin.statut === 'archive' ? 'opacity: 0.6;' : ''}">
        <div style="flex: 1;">
          <div style="display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap;">
            <strong>${soin.nom}</strong>
            ${partnerBadge}
            <span style="background: ${statutColor}; color: white; padding: 0.1rem 0.4rem; border-radius: 8px; font-size: 0.65rem;">${statutLabel}</span>
          </div>
          <div style="font-size: 0.8rem; color: var(--text-light); margin-top: 0.15rem;">
            ${variantesText}
          </div>
        </div>
        <div style="display: flex; gap: 0.25rem;">
          <button type="button" onclick="showEditSoinModal('${soin.id}')" style="background: none; border: none; cursor: pointer; font-size: 0.9rem;" title="Modifier">\u270f\ufe0f</button>
          ${soin.statut === 'actif' ? `<button type="button" onclick="quickArchiveSoin('${soin.id}')" style="background: none; border: none; cursor: pointer; font-size: 0.9rem;" title="Archiver">\ud83d\udce6</button>` : ''}
          ${soin.statut === 'archive' ? `<button type="button" onclick="quickActiverSoin('${soin.id}')" style="background: none; border: none; cursor: pointer; font-size: 0.9rem;" title="Reactiver">\u267b\ufe0f</button>` : ''}
        </div>
      </div>
    `;
  }

  // Separer soins actifs et archives
  let activeSoinsHtml = '';
  let archivedSoinsHtml = '';
  let archivedCount = 0;

  if (grouped.length === 0) {
    activeSoinsHtml = '<p style="text-align: center; color: var(--text-light); padding: 2rem;">Aucun soin configure.</p>';
  } else {
    grouped.forEach(cat => {
      const catStatutBadge = cat.statut === 'archive' ? '<span style="background: #e74c3c; color: white; padding: 0.15rem 0.5rem; border-radius: 10px; font-size: 0.7rem; margin-left: 0.5rem;">Archivee</span>' : '';

      const activeSoins = cat.soins.filter(s => s.statut !== 'archive');
      const archivedSoins = cat.soins.filter(s => s.statut === 'archive');
      archivedCount += archivedSoins.length;

      // Section active (seulement si categorie non archivee ou a des soins actifs)
      if (cat.statut !== 'archive' && (activeSoins.length > 0 || cat.soins.length === 0)) {
        activeSoinsHtml += `
          <div style="margin-bottom: 1.25rem;">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.5rem; padding: 0.5rem; background: var(--beige-clair); border-radius: 6px;">
              <h4 style="margin: 0; color: var(--text-dark); font-size: 0.95rem;">${cat.nom}</h4>
              <button type="button" onclick="showEditCategorieModal('${cat.id}')" style="background: none; border: none; cursor: pointer; font-size: 0.85rem;" title="Modifier la categorie">\u270f\ufe0f</button>
            </div>
            ${activeSoins.length === 0 ? '<p style="color: var(--text-light); padding: 0.25rem 0.5rem; font-size: 0.85rem;">Aucun soin actif</p>' : activeSoins.map(renderSoinRow).join('')}
          </div>
        `;
      }

      // Collecter les archives
      if (archivedSoins.length > 0) {
        archivedSoinsHtml += archivedSoins.map(s => {
          const catName = cat.nom;
          return `
            <div style="display: flex; align-items: center; justify-content: space-between; padding: 0.4rem 0.75rem; border-bottom: 1px solid #f0f0f0; opacity: 0.6;">
              <div style="flex: 1;">
                <div style="display: flex; align-items: center; gap: 0.5rem;">
                  <strong style="font-size: 0.9rem;">${s.nom}</strong>
                  <span style="font-size: 0.7rem; color: var(--text-light);">${catName}</span>
                </div>
              </div>
              <div style="display: flex; gap: 0.25rem;">
                <button type="button" onclick="showEditSoinModal('${s.id}')" style="background: none; border: none; cursor: pointer; font-size: 0.85rem;" title="Modifier">\u270f\ufe0f</button>
                <button type="button" onclick="quickActiverSoin('${s.id}')" style="background: none; border: none; cursor: pointer; font-size: 0.85rem;" title="Reactiver">\u267b\ufe0f</button>
              </div>
            </div>
          `;
        }).join('');
      }

      // Categorie archivee entiere
      if (cat.statut === 'archive') {
        archivedSoinsHtml += cat.soins.map(s => `
          <div style="display: flex; align-items: center; justify-content: space-between; padding: 0.4rem 0.75rem; border-bottom: 1px solid #f0f0f0; opacity: 0.6;">
            <div style="flex: 1;">
              <div style="display: flex; align-items: center; gap: 0.5rem;">
                <strong style="font-size: 0.9rem;">${s.nom}</strong>
                <span style="font-size: 0.7rem; color: var(--text-light);">${cat.nom} (archivee)</span>
              </div>
            </div>
            <div style="display: flex; gap: 0.25rem;">
              <button type="button" onclick="quickActiverSoin('${s.id}')" style="background: none; border: none; cursor: pointer; font-size: 0.85rem;" title="Reactiver">\u267b\ufe0f</button>
            </div>
          </div>
        `).join('');
      }
    });
  }

  // Section archives repliable
  const archiveSection = archivedCount > 0 ? `
    <div style="margin-top: 1.5rem; border-top: 2px solid #eee; padding-top: 1rem;">
      <div onclick="document.getElementById('archived-soins-list').style.display = document.getElementById('archived-soins-list').style.display === 'none' ? 'block' : 'none'; this.querySelector('.archive-chevron').textContent = document.getElementById('archived-soins-list').style.display === 'none' ? '\u25b6' : '\u25bc';"
        style="cursor: pointer; display: flex; align-items: center; gap: 0.5rem; padding: 0.5rem; background: #f5f5f5; border-radius: 6px; margin-bottom: 0.5rem;">
        <span class="archive-chevron" style="font-size: 0.8rem; color: var(--text-light);">\u25b6</span>
        <span style="font-weight: 600; color: var(--text-light); font-size: 0.9rem;">Archives (${archivedCount})</span>
      </div>
      <div id="archived-soins-list" style="display: none;">
        ${archivedSoinsHtml}
      </div>
    </div>
  ` : '';

  const modalHTML = `
    <h3>Carte des soins</h3>
    <div style="display: flex; gap: 0.5rem; margin-bottom: 1rem;">
      <button type="button" onclick="showAddSoinModal()" class="btn-primary" style="background: var(--beige-dore);">+ Ajouter un soin</button>
      <button type="button" onclick="showAddCategorieModal()" class="btn-secondary">+ Categorie</button>
    </div>
    <div style="max-height: 60vh; overflow-y: auto;">
      ${activeSoinsHtml}
      ${archiveSection}
    </div>
    <div class="modal-actions" style="margin-top: 1rem;">
      <button type="button" class="btn-secondary" onclick="showParametresModal()">Retour</button>
    </div>
  `;

  showModal('carte-soins-modal', modalHTML);
}

function showEditSoinModal(soinId) {
  const soin = DataManager.getSoinById(soinId);
  if (!soin) return;

  const categories = DataManager.getCategories({ includeArchived: true });
  const catOptions = categories.map(c =>
    `<option value="${c.id}" ${c.id === soin.categorieId ? 'selected' : ''}>${c.nom}</option>`
  ).join('');

  let variantesHtml = '';
  (soin.variantes || []).forEach((v, i) => {
    if (soin.isPartnership) {
      variantesHtml += `
        <div class="variante-row" style="display: flex; gap: 0.5rem; align-items: center; margin-bottom: 0.5rem;">
          <input type="number" class="variante-duree" value="${v.duree}" min="1" style="width: 70px; padding: 0.4rem;" placeholder="min">
          <input type="number" class="variante-prix-total" value="${v.prixTotal || v.prix || 0}" step="0.01" min="0" style="width: 80px; padding: 0.4rem;" placeholder="Prix total">
          <input type="number" class="variante-ma-part" value="${v.maPartFixe || 0}" step="0.01" min="0" style="width: 80px; padding: 0.4rem;" placeholder="Ma part">
          <input type="text" class="variante-desc" value="${v.description || ''}" style="flex: 1; padding: 0.4rem;" placeholder="Description">
          <button type="button" onclick="this.parentElement.remove()" style="background: #e74c3c; color: white; border: none; border-radius: 4px; padding: 0.25rem 0.5rem; cursor: pointer;">-</button>
        </div>
      `;
    } else {
      variantesHtml += `
        <div class="variante-row" style="display: flex; gap: 0.5rem; align-items: center; margin-bottom: 0.5rem;">
          <input type="number" class="variante-duree" value="${v.duree}" min="1" style="width: 70px; padding: 0.4rem;" placeholder="min">
          <input type="number" class="variante-prix" value="${v.prix || 0}" step="0.01" min="0" style="width: 80px; padding: 0.4rem;" placeholder="Prix €">
          <input type="text" class="variante-desc" value="${v.description || ''}" style="flex: 1; padding: 0.4rem;" placeholder="Description">
          <button type="button" onclick="this.parentElement.remove()" style="background: #e74c3c; color: white; border: none; border-radius: 4px; padding: 0.25rem 0.5rem; cursor: pointer;">-</button>
        </div>
      `;
    }
  });

  const modalHTML = `
    <h3>Modifier le soin</h3>
    <form id="edit-soin-form" onsubmit="event.preventDefault(); saveEditSoin('${soinId}');">
      <div class="form-row">
        <div class="form-group">
          <label>Nom du soin *</label>
          <input type="text" id="soin-nom" value="${soin.nom}" required>
        </div>
        <div class="form-group">
          <label>Catégorie</label>
          <select id="soin-categorie">${catOptions}</select>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Statut</label>
          <select id="soin-statut">
            <option value="actif" ${soin.statut === 'actif' ? 'selected' : ''}>Actif</option>
            <option value="standby" ${soin.statut === 'standby' ? 'selected' : ''}>Stand-by</option>
            <option value="archive" ${soin.statut === 'archive' ? 'selected' : ''}>Archivé</option>
          </select>
        </div>
        <div class="form-group">
          <label><input type="checkbox" id="soin-partnership" ${soin.isPartnership ? 'checked' : ''}> Soin partenariat</label>
        </div>
      </div>
      <input type="hidden" id="soin-cout-huiles" value="0">
      <div class="form-row">
        <div class="form-group">
          <label>Couleur calendrier</label>
          <input type="color" id="soin-color" value="${soin.calendarColor || '#d4a574'}" style="width: 60px; height: 30px;">
        </div>
      </div>
      <div style="margin: 1rem 0;">
        <label style="font-weight: 600; margin-bottom: 0.5rem; display: block;">Variantes (durées et prix)</label>
        <div style="font-size: 0.75rem; color: var(--text-light); margin-bottom: 0.5rem;">
          ${soin.isPartnership ? 'Durée (min) | Prix total client | Ma part fixe | Description' : 'Durée (min) | Prix (€) | Description'}
        </div>
        <div id="variantes-container">
          ${variantesHtml}
        </div>
        <button type="button" onclick="addVarianteRow('${soinId}')" style="background: var(--beige-dore); color: white; border: none; padding: 0.4rem 0.8rem; border-radius: 4px; cursor: pointer; font-size: 0.85rem; margin-top: 0.5rem;">+ Ajouter une durée</button>
      </div>
      <div class="modal-actions">
        <button type="button" class="btn-secondary" onclick="showCarteSoinsModal()">Retour</button>
        <button type="submit" class="btn-primary">Enregistrer</button>
      </div>
    </form>
  `;

  showModal('edit-soin-modal', modalHTML);
}

function showAddSoinModal(categorieId) {
  const categories = DataManager.getCategories({ includeArchived: false });
  const catOptions = categories.map(c =>
    `<option value="${c.id}" ${c.id === categorieId ? 'selected' : ''}>${c.nom}</option>`
  ).join('');

  const modalHTML = `
    <h3>Nouveau soin</h3>
    <form id="add-soin-form" onsubmit="event.preventDefault(); saveNewSoin();">
      <div class="form-row">
        <div class="form-group">
          <label>Nom du soin *</label>
          <input type="text" id="soin-nom" required placeholder="Ex: Massage relaxant">
        </div>
        <div class="form-group">
          <label>Catégorie</label>
          <select id="soin-categorie">${catOptions}</select>
        </div>
      </div>
      <input type="hidden" id="soin-cout-huiles" value="0">
      <div class="form-row">
        <div class="form-group">
          <label><input type="checkbox" id="soin-partnership" onchange="togglePartnershipVariantes()"> Soin partenariat</label>
        </div>
      </div>
      <div style="margin: 1rem 0;">
        <label style="font-weight: 600; margin-bottom: 0.5rem; display: block;">Variantes (durees et prix)</label>
        <div id="variantes-header" style="font-size: 0.75rem; color: var(--text-light); margin-bottom: 0.5rem;">Duree (min) | Prix (EUR) | Description</div>
        <div id="variantes-container">
          <div class="variante-row" style="display: flex; gap: 0.5rem; align-items: center; margin-bottom: 0.5rem;">
            <input type="number" class="variante-duree" value="60" min="1" style="width: 70px; padding: 0.4rem;" placeholder="min">
            <input type="number" class="variante-prix" value="0" step="0.01" min="0" style="width: 80px; padding: 0.4rem;" placeholder="Prix">
            <input type="text" class="variante-desc" value="" style="flex: 1; padding: 0.4rem;" placeholder="Description">
            <button type="button" onclick="this.parentElement.remove()" style="background: #e74c3c; color: white; border: none; border-radius: 4px; padding: 0.25rem 0.5rem; cursor: pointer;">-</button>
          </div>
        </div>
        <button type="button" onclick="addVarianteRowNew()" style="background: var(--beige-dore); color: white; border: none; padding: 0.4rem 0.8rem; border-radius: 4px; cursor: pointer; font-size: 0.85rem; margin-top: 0.5rem;">+ Ajouter une duree</button>
      </div>
      <div class="modal-actions">
        <button type="button" class="btn-secondary" onclick="showCarteSoinsModal()">Retour</button>
        <button type="submit" class="btn-primary">Créer</button>
      </div>
    </form>
  `;

  showModal('add-soin-modal', modalHTML);
}

function addVarianteRow(soinId) {
  const container = document.getElementById('variantes-container');
  if (!container) return;

  const soin = soinId ? DataManager.getSoinById(soinId) : null;
  const isPartnership = soin ? soin.isPartnership === true : false;

  if (isPartnership) {
    container.insertAdjacentHTML('beforeend', `
      <div class="variante-row" style="display: flex; gap: 0.5rem; align-items: center; margin-bottom: 0.5rem;">
        <input type="number" class="variante-duree" value="" min="1" style="width: 70px; padding: 0.4rem;" placeholder="min">
        <input type="number" class="variante-prix-total" value="" step="0.01" min="0" style="width: 80px; padding: 0.4rem;" placeholder="Prix total">
        <input type="number" class="variante-ma-part" value="" step="0.01" min="0" style="width: 80px; padding: 0.4rem;" placeholder="Ma part">
        <input type="text" class="variante-desc" value="" style="flex: 1; padding: 0.4rem;" placeholder="Description">
        <button type="button" onclick="this.parentElement.remove()" style="background: #e74c3c; color: white; border: none; border-radius: 4px; padding: 0.25rem 0.5rem; cursor: pointer;">-</button>
      </div>
    `);
  } else {
    container.insertAdjacentHTML('beforeend', `
      <div class="variante-row" style="display: flex; gap: 0.5rem; align-items: center; margin-bottom: 0.5rem;">
        <input type="number" class="variante-duree" value="" min="1" style="width: 70px; padding: 0.4rem;" placeholder="min">
        <input type="number" class="variante-prix" value="" step="0.01" min="0" style="width: 80px; padding: 0.4rem;" placeholder="Prix €">
        <input type="text" class="variante-desc" value="" style="flex: 1; padding: 0.4rem;" placeholder="Description">
        <button type="button" onclick="this.parentElement.remove()" style="background: #e74c3c; color: white; border: none; border-radius: 4px; padding: 0.25rem 0.5rem; cursor: pointer;">-</button>
      </div>
    `);
  }
}

// Ajoute une variante en verifiant le checkbox partenariat (pour nouveau soin)
function addVarianteRowNew() {
  const isPartnership = document.getElementById('soin-partnership')?.checked || false;
  const container = document.getElementById('variantes-container');
  if (!container) return;

  if (isPartnership) {
    container.insertAdjacentHTML('beforeend', `
      <div class="variante-row" style="display: flex; gap: 0.5rem; align-items: center; margin-bottom: 0.5rem;">
        <input type="number" class="variante-duree" value="" min="1" style="width: 70px; padding: 0.4rem;" placeholder="min">
        <input type="number" class="variante-prix-total" value="" step="0.01" min="0" style="width: 80px; padding: 0.4rem;" placeholder="Prix total">
        <input type="number" class="variante-ma-part" value="" step="0.01" min="0" style="width: 80px; padding: 0.4rem;" placeholder="Ma part">
        <input type="text" class="variante-desc" value="" style="flex: 1; padding: 0.4rem;" placeholder="Description">
        <button type="button" onclick="this.parentElement.remove()" style="background: #e74c3c; color: white; border: none; border-radius: 4px; padding: 0.25rem 0.5rem; cursor: pointer;">-</button>
      </div>
    `);
  } else {
    container.insertAdjacentHTML('beforeend', `
      <div class="variante-row" style="display: flex; gap: 0.5rem; align-items: center; margin-bottom: 0.5rem;">
        <input type="number" class="variante-duree" value="" min="1" style="width: 70px; padding: 0.4rem;" placeholder="min">
        <input type="number" class="variante-prix" value="" step="0.01" min="0" style="width: 80px; padding: 0.4rem;" placeholder="Prix">
        <input type="text" class="variante-desc" value="" style="flex: 1; padding: 0.4rem;" placeholder="Description">
        <button type="button" onclick="this.parentElement.remove()" style="background: #e74c3c; color: white; border: none; border-radius: 4px; padding: 0.25rem 0.5rem; cursor: pointer;">-</button>
      </div>
    `);
  }
}

// Toggle partnership mode : reconstruit les variantes avec les bons champs
function togglePartnershipVariantes() {
  const isPartnership = document.getElementById('soin-partnership')?.checked || false;
  const container = document.getElementById('variantes-container');
  const header = document.getElementById('variantes-header');
  if (!container) return;

  // Sauvegarder les valeurs existantes
  const existingRows = container.querySelectorAll('.variante-row');
  const savedData = [];
  existingRows.forEach(row => {
    savedData.push({
      duree: row.querySelector('.variante-duree')?.value || '',
      prix: row.querySelector('.variante-prix')?.value || row.querySelector('.variante-prix-total')?.value || '',
      maPart: row.querySelector('.variante-ma-part')?.value || '',
      desc: row.querySelector('.variante-desc')?.value || ''
    });
  });

  // Vider le container
  container.innerHTML = '';

  // Mettre a jour le header
  if (header) {
    header.textContent = isPartnership
      ? 'Duree (min) | Prix total client | Ma part fixe | Description'
      : 'Duree (min) | Prix (EUR) | Description';
  }

  // Reconstruire avec les bons champs
  if (savedData.length === 0) savedData.push({ duree: '60', prix: '0', maPart: '', desc: '' });

  savedData.forEach(data => {
    if (isPartnership) {
      container.insertAdjacentHTML('beforeend', `
        <div class="variante-row" style="display: flex; gap: 0.5rem; align-items: center; margin-bottom: 0.5rem;">
          <input type="number" class="variante-duree" value="${data.duree}" min="1" style="width: 70px; padding: 0.4rem;" placeholder="min">
          <input type="number" class="variante-prix-total" value="${data.prix}" step="0.01" min="0" style="width: 80px; padding: 0.4rem;" placeholder="Prix total">
          <input type="number" class="variante-ma-part" value="${data.maPart}" step="0.01" min="0" style="width: 80px; padding: 0.4rem;" placeholder="Ma part">
          <input type="text" class="variante-desc" value="${data.desc}" style="flex: 1; padding: 0.4rem;" placeholder="Description">
          <button type="button" onclick="this.parentElement.remove()" style="background: #e74c3c; color: white; border: none; border-radius: 4px; padding: 0.25rem 0.5rem; cursor: pointer;">-</button>
        </div>
      `);
    } else {
      container.insertAdjacentHTML('beforeend', `
        <div class="variante-row" style="display: flex; gap: 0.5rem; align-items: center; margin-bottom: 0.5rem;">
          <input type="number" class="variante-duree" value="${data.duree}" min="1" style="width: 70px; padding: 0.4rem;" placeholder="min">
          <input type="number" class="variante-prix" value="${data.prix}" step="0.01" min="0" style="width: 80px; padding: 0.4rem;" placeholder="Prix">
          <input type="text" class="variante-desc" value="${data.desc}" style="flex: 1; padding: 0.4rem;" placeholder="Description">
          <button type="button" onclick="this.parentElement.remove()" style="background: #e74c3c; color: white; border: none; border-radius: 4px; padding: 0.25rem 0.5rem; cursor: pointer;">-</button>
        </div>
      `);
    }
  });
}

function collectVariantes() {
  const rows = document.querySelectorAll('.variante-row');
  const variantes = [];

  rows.forEach(row => {
    const duree = parseInt(row.querySelector('.variante-duree')?.value);
    if (!duree || duree <= 0) return;

    const prixEl = row.querySelector('.variante-prix');
    const prixTotalEl = row.querySelector('.variante-prix-total');
    const maPartEl = row.querySelector('.variante-ma-part');
    const descEl = row.querySelector('.variante-desc');

    if (prixTotalEl && maPartEl) {
      // Soin partenariat
      variantes.push({
        duree: duree,
        prixTotal: parseFloat(prixTotalEl.value) || 0,
        maPartFixe: parseFloat(maPartEl.value) || 0,
        description: descEl?.value || ''
      });
    } else {
      variantes.push({
        duree: duree,
        prix: parseFloat(prixEl?.value) || 0,
        description: descEl?.value || ''
      });
    }
  });

  return variantes;
}

async function saveEditSoin(soinId) {
  const variantes = collectVariantes();
  if (variantes.length === 0) {
    UtilsServices.showCustomAlert('Ajoutez au moins une variante (durée + prix)', 'error');
    return;
  }

  const updates = {
    nom: document.getElementById('soin-nom').value,
    categorieId: document.getElementById('soin-categorie').value,
    statut: document.getElementById('soin-statut').value,
    coutHuiles: parseFloat(document.getElementById('soin-cout-huiles').value) || 0,
    isPartnership: document.getElementById('soin-partnership').checked,
    calendarColor: document.getElementById('soin-color').value === '#d4a574' ? null : document.getElementById('soin-color').value,
    variantes: variantes
  };

  DataManager.updateSoin(soinId, updates);
  await DataManager.saveData();
  showCarteSoinsModal();
}

async function saveNewSoin() {
  const nom = document.getElementById('soin-nom').value;
  if (!nom) return;

  const variantes = collectVariantes();
  if (variantes.length === 0) {
    UtilsServices.showCustomAlert('Ajoutez au moins une variante (durée + prix)', 'error');
    return;
  }

  DataManager.addSoin({
    nom: nom,
    categorieId: document.getElementById('soin-categorie').value,
    coutHuiles: parseFloat(document.getElementById('soin-cout-huiles').value) || 0,
    isPartnership: document.getElementById('soin-partnership').checked,
    variantes: variantes
  });

  await DataManager.saveData();
  showCarteSoinsModal();
}

async function quickArchiveSoin(soinId) {
  DataManager.archiveSoin(soinId);
  await DataManager.saveData();
  showCarteSoinsModal();
}

async function quickActiverSoin(soinId) {
  DataManager.activerSoin(soinId);
  await DataManager.saveData();
  showCarteSoinsModal();
}

function showEditCategorieModal(categorieId) {
  const cat = DataManager.getCategorieById(categorieId);
  if (!cat) return;

  const modalHTML = `
    <h3>Modifier la catégorie</h3>
    <form onsubmit="event.preventDefault(); saveEditCategorie('${categorieId}');">
      <div class="form-group">
        <label>Nom *</label>
        <input type="text" id="cat-nom" value="${cat.nom}" required>
      </div>
      <div class="form-group">
        <label>Ordre</label>
        <input type="number" id="cat-ordre" value="${cat.ordre || 1}" min="1">
      </div>
      <div class="form-group">
        <label>Statut</label>
        <select id="cat-statut">
          <option value="actif" ${cat.statut === 'actif' ? 'selected' : ''}>Active</option>
          <option value="archive" ${cat.statut === 'archive' ? 'selected' : ''}>Archivée</option>
        </select>
      </div>
      <div class="modal-actions">
        <button type="button" class="btn-secondary" onclick="showCarteSoinsModal()">Retour</button>
        <button type="submit" class="btn-primary">Enregistrer</button>
      </div>
    </form>
  `;

  showModal('edit-categorie-modal', modalHTML);
}

function showAddCategorieModal() {
  const modalHTML = `
    <h3>Nouvelle catégorie</h3>
    <form onsubmit="event.preventDefault(); saveNewCategorie();">
      <div class="form-group">
        <label>Nom *</label>
        <input type="text" id="cat-nom" required placeholder="Ex: Soins du Monde">
      </div>
      <div class="modal-actions">
        <button type="button" class="btn-secondary" onclick="showCarteSoinsModal()">Retour</button>
        <button type="submit" class="btn-primary">Créer</button>
      </div>
    </form>
  `;

  showModal('add-categorie-modal', modalHTML);
}

async function saveEditCategorie(categorieId) {
  DataManager.updateCategorie(categorieId, {
    nom: document.getElementById('cat-nom').value,
    ordre: parseInt(document.getElementById('cat-ordre').value) || 1,
    statut: document.getElementById('cat-statut').value
  });
  await DataManager.saveData();
  showCarteSoinsModal();
}

async function saveNewCategorie() {
  const nom = document.getElementById('cat-nom').value;
  if (!nom) return;

  DataManager.addCategorie({ nom: nom });
  await DataManager.saveData();
  showCarteSoinsModal();
}

// ===== EXPORTS GLOBAUX COMPLETS =====
window.ModalManager = {
  showModal,
  closeModal,
  showParametresModal,
  showAddRdvModal,
  showAddRdvModalWithData,
  showAddPrestationModal,
  showAddPrestationModalWithData,
  showAddClientModal,
  showAddProspectModal,
  showAddDepenseModal,
  showAddCollaborateurModal,
  handleCollaborateurFormSubmit,
  handleCollaborateurEditSubmit
};

// Fonctions globales pour l'HTML
window.closeModal = closeModal;
window.closeModalCompletely = closeModalCompletely;
window.showParametresModal = showParametresModal;
window.showAddRdvModal = showAddRdvModal;
window.showAddPrestationModal = showAddPrestationModal;
window.showAddClientModal = showAddClientModal;
window.showAddProspectModal = showAddProspectModal;
window.showAddDepenseModal = showAddDepenseModal;
window.showAddCollaborateurModal = showAddCollaborateurModal;
window.updateCoutKmCalcule = updateCoutKmCalcule;
window.validateCurrentAddress = validateCurrentAddress;
window.validateClientAddress = validateClientAddress;
window.toggleAutreDuree = toggleAutreDuree;
window.handlePrestationTypeChange = handlePrestationTypeChange;
window.handleRdvTypeChange = handleRdvTypeChange;
window.updateHeadSpaPrix = updateHeadSpaPrix;
window.setupHeadSpaDureeListener = setupHeadSpaDureeListener;
window.handleTypeChange = handleTypeChange;
window.generateTypeOptions = generateTypeOptions;
window.generateDureeOptions = generateDureeOptions;
window.updatePrixFromSoin = updatePrixFromSoin;
window.showParametresSalonModal = showParametresSalonModal;
window.showParametresVehiculeModal = showParametresVehiculeModal;
window.showParametresGoogleAdsModal = showParametresGoogleAdsModal;
window.showParametresSauvegardeModal = showParametresSauvegardeModal;
window.showParametresApiModal = showParametresApiModal;
window.showParametresAbonnementsModal = showParametresAbonnementsModal;
window.showAddAbonnementModal = showAddAbonnementModal;
window.saveAbonnement = saveAbonnement;
window.toggleAbonnement = toggleAbonnement;
window.deleteAbonnement = deleteAbonnement;
window.editAbonnement = editAbonnement;
window.genererDepensesAbonnements = genererDepensesAbonnements;
window.showCarteSoinsModal = showCarteSoinsModal;
window.showEditSoinModal = showEditSoinModal;
window.showAddSoinModal = showAddSoinModal;
window.showEditCategorieModal = showEditCategorieModal;
window.showAddCategorieModal = showAddCategorieModal;
window.addVarianteRow = addVarianteRow;
window.addVarianteRowNew = addVarianteRowNew;
window.togglePartnershipVariantes = togglePartnershipVariantes;
window.saveEditSoin = saveEditSoin;
window.saveNewSoin = saveNewSoin;
window.quickArchiveSoin = quickArchiveSoin;
window.quickActiverSoin = quickActiverSoin;
window.saveEditCategorie = saveEditCategorie;
window.saveNewCategorie = saveNewCategorie;
window.createClientAutocomplete = createClientAutocomplete;
window.createParrainAutocomplete = createParrainAutocomplete;
window.setupClientAddressAutofill = setupClientAddressAutofill;
window.useClientAddress = useClientAddress;
window.showAddRdvModalWithData = showAddRdvModalWithData;
window.showAddPrestationModalWithData = showAddPrestationModalWithData;
window.showTemporaryMessage = showTemporaryMessage;
window.migrerMoyensPaiement = migrerMoyensPaiement;
window.selectBackupFolder = selectBackupFolder;
window.validateBackupPath = validateBackupPath;
window.updateBackupPathStatus = updateBackupPathStatus;
window.handleParametresFormSubmit = handleParametresFormSubmit;

// ✅ Google Ads OAuth
window.connectToGoogleAds = connectToGoogleAds;
window.disconnectFromGoogleAds = disconnectFromGoogleAds;
window.testGoogleAdsConnection = testGoogleAdsConnection;
window.updateGoogleAdsStatus = updateGoogleAdsStatus;
window.getValidTokens = getValidTokens;

window.showCampaignManagementModal = showCampaignManagementModal;
window.toggleCampaignSelection = toggleCampaignSelection;
window.selectAllCampaigns = selectAllCampaigns;
window.deselectAllCampaigns = deselectAllCampaigns;
window.saveCampaignSelection = saveCampaignSelection;
window.updateGoogleAdsCache = updateGoogleAdsCache;
// syncGoogleAdsCostsOnStartup et fetchGoogleAdsCostsSilent sont definis dans app.js

// ✅ NOUVEAU : Gestion des périodes de campagnes
window.showCampaignPeriodsModal = showCampaignPeriodsModal;
window.showAddPeriodForm = showAddPeriodForm;
window.endPeriodNow = endPeriodNow;
window.deletePeriodConfirm = deletePeriodConfirm;
window.confirmDeletePeriod = confirmDeletePeriod;

// ✅ NOUVEAU : Exports des fonctions de gestion des tags collaborateurs
window.addTagToCollaborateur = addTagToCollaborateur;
window.removeTagFromCollaborateur = removeTagFromCollaborateur;
window.initCollaborateurTagsSystem = initCollaborateurTagsSystem;
window.handleCollaborateurFormSubmit = handleCollaborateurFormSubmit;
window.handleCollaborateurEditSubmit = handleCollaborateurEditSubmit;
window.populateCanalDropdown = populateCanalDropdown;

// ===== BONS CADEAUX - MODALES =====

function showAddBonCadeauModal() {
  console.log('🎁 showAddBonCadeauModal appelée');

  const today = new Date().toISOString().split('T')[0];
  const validiteMois = DataManager.getValiditeBonsCadeauxMois();
  const dateExpiration = DataManager.calculerDateExpiration(today);

  const modalHTML = `
    <h3>🎁 Nouveau bon cadeau</h3>
    <form id="bon-cadeau-form">
      <input type="hidden" id="bon-cadeau-id">

      <div class="form-group">
        <label>Description du massage / prestation *</label>
        <input type="text" id="bon-cadeau-description" placeholder="Ex: Massage Aromathérapie 60min" required>
      </div>

      <div class="form-row">
        <div class="form-group">
          <label>Montant (€) *</label>
          <input type="number" id="bon-cadeau-montant" step="0.01" min="0" required placeholder="Ex: 70">
        </div>
        <div class="form-group">
          <label>Moyen de paiement *</label>
          <select id="bon-cadeau-moyen-paiement" required>
            <option value="">-- Sélectionnez --</option>
            <option value="Liquide">💵 Liquide</option>
            <option value="Carte bleue">💳 Carte bleue</option>
            <option value="Virement">🏦 Virement</option>
            <option value="Chèque">📝 Chèque</option>
          </select>
        </div>
      </div>

      <div class="form-row">
        <div class="form-group">
          <label>Date d'achat</label>
          <input type="date" id="bon-cadeau-date-achat" value="${today}" required onchange="syncBonDateAchatToDebut()">
        </div>
        <div class="form-group">
          <label>Début de validité</label>
          <input type="date" id="bon-cadeau-date-debut" value="${today}" onchange="updateBonExpirationPreview()">
          <small style="color: #666;">Validité : ${validiteMois} mois</small>
        </div>
      </div>

      <div id="bon-expiration-preview" style="margin: 0.5rem 0; padding: 0.5rem; background: #e8f5e8; border-radius: 4px; font-size: 0.85rem;">
        📅 Expire le : <strong>${new Date(dateExpiration).toLocaleDateString('fr-FR')}</strong>
      </div>

      <fieldset style="border: 1px solid #ddd; border-radius: 8px; padding: 1rem; margin: 1rem 0;">
        <legend style="font-weight: 600; color: var(--beige-dore);">👤 Acheteur (optionnel)</legend>
        <div class="form-group">
          <label>Client existant OU nom libre</label>
          <input type="text" id="bon-cadeau-acheteur-search" placeholder="Rechercher un client ou saisir un nom...">
          <input type="hidden" id="bon-cadeau-acheteur-client-id">
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>Téléphone</label>
            <input type="tel" id="bon-cadeau-acheteur-telephone" placeholder="06 12 34 56 78">
          </div>
          <div class="form-group">
            <label>Email</label>
            <input type="email" id="bon-cadeau-acheteur-email" placeholder="email@exemple.com">
          </div>
        </div>
      </fieldset>

      <fieldset style="border: 1px solid #ddd; border-radius: 8px; padding: 1rem; margin: 1rem 0;">
        <legend style="font-weight: 600; color: var(--beige-dore);">🎁 Bénéficiaire (optionnel)</legend>
        <div class="form-group">
          <label>Nom du bénéficiaire</label>
          <input type="text" id="bon-cadeau-beneficiaire-nom" placeholder="Nom de la personne qui recevra le bon">
          <small style="color: #666;">Peut être renseigné plus tard. Un client sera créé automatiquement.</small>
        </div>
      </fieldset>

      <div class="form-group">
        <label>Notes</label>
        <textarea id="bon-cadeau-notes" placeholder="Ex: Pour son anniversaire, cadeau de Noël..."></textarea>
      </div>

      <div class="modal-actions">
        <button type="button" class="btn-secondary" onclick="closeModal()">Annuler</button>
        <button type="submit" class="btn-primary">🎁 Créer le bon cadeau</button>
      </div>
    </form>
  `;

  showModal('bon-cadeau-modal', modalHTML);

  // Setup de l'autocomplete pour l'acheteur
  setTimeout(() => {
    setupBonCadeauAcheteurAutocomplete();

    // Setup des listeners pour les dates
    const dateAchatInput = document.getElementById('bon-cadeau-date-achat');
    const dateDebutInput = document.getElementById('bon-cadeau-date-debut');

    if (dateAchatInput) {
      dateAchatInput.addEventListener('change', function() {
        console.log('📅 Date achat changée:', this.value);
        if (dateDebutInput) {
          dateDebutInput.value = this.value;
          // Recalculer l'expiration
          const dateExpiration = DataManager.calculerDateExpiration(this.value);
          const preview = document.getElementById('bon-expiration-preview');
          if (preview) {
            preview.innerHTML = `📅 Expire le : <strong>${new Date(dateExpiration).toLocaleDateString('fr-FR')}</strong>`;
          }
        }
      });
    }

    if (dateDebutInput) {
      dateDebutInput.addEventListener('change', function() {
        console.log('📅 Date début changée:', this.value);
        const dateExpiration = DataManager.calculerDateExpiration(this.value);
        const preview = document.getElementById('bon-expiration-preview');
        if (preview) {
          preview.innerHTML = `📅 Expire le : <strong>${new Date(dateExpiration).toLocaleDateString('fr-FR')}</strong>`;
        }
      });
    }

    // Gestion du formulaire
    const form = document.getElementById('bon-cadeau-form');
    if (form) {
      form.addEventListener('submit', handleBonCadeauFormSubmit);
    }
  }, 200);
}

function showEditBonCadeauModal(bonId) {
  console.log('🎁 showEditBonCadeauModal appelée:', bonId);

  const bon = DataManager.getBonCadeauById(bonId);
  if (!bon) {
    alert('Bon cadeau introuvable');
    return;
  }

  const validiteMois = DataManager.getValiditeBonsCadeauxMois();

  // Récupérer les infos de l'acheteur si c'est un client existant
  let acheteurNom = bon.acheteurNom || '';
  if (bon.acheteurClientId) {
    const acheteur = DataManager.getClientById(bon.acheteurClientId);
    if (acheteur) acheteurNom = `${acheteur.prenom} ${acheteur.nom}`;
  }

  const modalHTML = `
    <h3>🎁 Modifier le bon cadeau</h3>
    <form id="bon-cadeau-form">
      <input type="hidden" id="bon-cadeau-id" value="${bon.id}">

      <div class="form-group">
        <label>Description du massage / prestation *</label>
        <input type="text" id="bon-cadeau-description" value="${bon.description || ''}" required>
      </div>

      <div class="form-row">
        <div class="form-group">
          <label>Montant (€) *</label>
          <input type="number" id="bon-cadeau-montant" step="0.01" min="0" required value="${bon.montant || ''}">
        </div>
        <div class="form-group">
          <label>Moyen de paiement *</label>
          <select id="bon-cadeau-moyen-paiement" required>
            <option value="">-- Sélectionnez --</option>
            <option value="Liquide" ${bon.moyenPaiement === 'Liquide' ? 'selected' : ''}>💵 Liquide</option>
            <option value="Carte bleue" ${bon.moyenPaiement === 'Carte bleue' ? 'selected' : ''}>💳 Carte bleue</option>
            <option value="Virement" ${bon.moyenPaiement === 'Virement' ? 'selected' : ''}>🏦 Virement</option>
            <option value="Chèque" ${bon.moyenPaiement === 'Chèque' ? 'selected' : ''}>📝 Chèque</option>
          </select>
        </div>
      </div>

      <div class="form-row">
        <div class="form-group">
          <label>Date d'achat</label>
          <input type="date" id="bon-cadeau-date-achat" value="${bon.dateAchat}" required onchange="syncBonDateAchatToDebut()">
        </div>
        <div class="form-group">
          <label>Début de validité</label>
          <input type="date" id="bon-cadeau-date-debut" value="${bon.dateDebut || bon.dateAchat}" onchange="updateBonExpirationPreview()">
          <small style="color: #666;">Validité : ${validiteMois} mois</small>
        </div>
      </div>

      <div id="bon-expiration-preview" style="margin: 0.5rem 0; padding: 0.5rem; background: #e8f5e8; border-radius: 4px; font-size: 0.85rem;">
        📅 Expire le : <strong>${new Date(bon.dateExpiration).toLocaleDateString('fr-FR')}</strong>
      </div>

      <fieldset style="border: 1px solid #ddd; border-radius: 8px; padding: 1rem; margin: 1rem 0;">
        <legend style="font-weight: 600; color: var(--beige-dore);">👤 Acheteur</legend>
        <div class="form-group">
          <label>Client existant OU nom libre</label>
          <input type="text" id="bon-cadeau-acheteur-search" value="${acheteurNom}" placeholder="Rechercher un client ou saisir un nom...">
          <input type="hidden" id="bon-cadeau-acheteur-client-id" value="${bon.acheteurClientId || ''}">
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>Téléphone</label>
            <input type="tel" id="bon-cadeau-acheteur-telephone" value="${bon.acheteurTelephone || ''}">
          </div>
          <div class="form-group">
            <label>Email</label>
            <input type="email" id="bon-cadeau-acheteur-email" value="${bon.acheteurEmail || ''}">
          </div>
        </div>
      </fieldset>

      <fieldset style="border: 1px solid #ddd; border-radius: 8px; padding: 1rem; margin: 1rem 0;">
        <legend style="font-weight: 600; color: var(--beige-dore);">🎁 Bénéficiaire</legend>
        <div class="form-group">
          <label>Nom du bénéficiaire</label>
          <input type="text" id="bon-cadeau-beneficiaire-nom" value="${bon.beneficiaireNom || ''}">
          <input type="hidden" id="bon-cadeau-beneficiaire-client-id" value="${bon.beneficiaireClientId || ''}">
        </div>
      </fieldset>

      <div class="form-group">
        <label>Notes</label>
        <textarea id="bon-cadeau-notes">${bon.notes || ''}</textarea>
      </div>

      <div class="modal-actions">
        <button type="button" class="btn-secondary" onclick="closeModal()">Annuler</button>
        <button type="button" class="btn-danger" onclick="deleteBonCadeau('${bon.id}')" style="margin-right: auto;">🗑️ Supprimer</button>
        <button type="submit" class="btn-primary">💾 Enregistrer</button>
      </div>
    </form>
  `;

  showModal('bon-cadeau-modal', modalHTML);

  setTimeout(() => {
    setupBonCadeauAcheteurAutocomplete();

    // Setup des listeners pour les dates (édition)
    const dateAchatInput = document.getElementById('bon-cadeau-date-achat');
    const dateDebutInput = document.getElementById('bon-cadeau-date-debut');

    if (dateAchatInput) {
      dateAchatInput.addEventListener('change', function() {
        console.log('📅 Date achat changée (edit):', this.value);
        if (dateDebutInput) {
          dateDebutInput.value = this.value;
          const dateExpiration = DataManager.calculerDateExpiration(this.value);
          const preview = document.getElementById('bon-expiration-preview');
          if (preview) {
            preview.innerHTML = `📅 Expire le : <strong>${new Date(dateExpiration).toLocaleDateString('fr-FR')}</strong>`;
          }
        }
      });
    }

    if (dateDebutInput) {
      dateDebutInput.addEventListener('change', function() {
        console.log('📅 Date début changée (edit):', this.value);
        const dateExpiration = DataManager.calculerDateExpiration(this.value);
        const preview = document.getElementById('bon-expiration-preview');
        if (preview) {
          preview.innerHTML = `📅 Expire le : <strong>${new Date(dateExpiration).toLocaleDateString('fr-FR')}</strong>`;
        }
      });
    }

    const form = document.getElementById('bon-cadeau-form');
    if (form) {
      form.addEventListener('submit', handleBonCadeauFormSubmit);
    }
  }, 200);
}

function showBonCadeauDetailsModal(bonId) {
  const bon = DataManager.getBonCadeauById(bonId);
  if (!bon) return;

  const appData = DataManager.getAppData();

  // Acheteur
  let acheteurDisplay = bon.acheteurNom || 'Non renseigné';
  if (bon.acheteurClientId) {
    const acheteur = appData.clients.find(c => c.id === bon.acheteurClientId);
    if (acheteur) acheteurDisplay = `${acheteur.prenom} ${acheteur.nom}`;
  }

  // Bénéficiaire
  let beneficiaireDisplay = bon.beneficiaireNom || 'Non renseigné';
  if (bon.beneficiaireClientId) {
    const beneficiaire = appData.clients.find(c => c.id === bon.beneficiaireClientId);
    if (beneficiaire) beneficiaireDisplay = `${beneficiaire.prenom} ${beneficiaire.nom}`;
  }

  // Statut
  let statutLabel = '';
  switch(bon.statut) {
    case 'actif': statutLabel = '🟢 Actif'; break;
    case 'utilise': statutLabel = '✅ Utilisé'; break;
    case 'expire': statutLabel = '❌ Expiré'; break;
    case 'rembourse': statutLabel = '💸 Remboursé'; break;
  }

  // Prestation liée
  let prestationInfo = '';
  if (bon.statut === 'utilise' && bon.prestationId) {
    const prestation = appData.prestations.find(p => p.id === bon.prestationId);
    if (prestation) {
      const client = appData.clients.find(c => c.id === prestation.clientId);
      const isPartnership = DataManager.isPartnershipSoin(prestation.soinId || prestation.type);
      const clientNomAffiche = isPartnership ? `${DataManager.getDisplayNameForType(prestation.soinId || prestation.type)} (Partenariat)` : (client ? `${client.prenom} ${client.nom}` : 'Client inconnu');
      prestationInfo = `
        <div style="margin-top: 1rem; padding: 1rem; background: #e8f5e9; border-radius: 8px; border-left: 3px solid #28a745;">
          <strong>✅ Prestation réalisée</strong><br>
          <small>
            📅 ${DataManager.formatDate(prestation.date)} à ${prestation.heure}<br>
            👤 ${clientNomAffiche}<br>
            💆 ${DataManager.getDisplayNameForType(prestation.soinId || prestation.type)} - ${prestation.duree || 60}min
            ${bon.forceUtilise ? '<br>⚠️ <em>Bon utilisé après expiration (forcé)</em>' : ''}
          </small>
        </div>
      `;
    }
  }

  const modalHTML = `
    <h3>🎁 Détails du bon cadeau</h3>
    <div style="margin: 1.5rem 0;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
        <div style="font-size: 2rem; font-weight: 700; color: var(--beige-dore);">${bon.montant.toFixed(2)} €</div>
        <span style="padding: 0.5rem 1rem; border-radius: 20px; font-weight: 600; background: ${bon.statut === 'actif' ? '#d4edda' : bon.statut === 'utilise' ? '#e2e3e5' : '#f8d7da'};">${statutLabel}</span>
      </div>

      <div style="font-size: 1.2rem; font-weight: 500; margin-bottom: 1rem;">
        🎁 ${bon.description || 'Bon cadeau'}
      </div>

      <div style="background: #f8f9fa; padding: 1rem; border-radius: 8px; margin-bottom: 1rem;">
        <p><strong>👤 Offert par:</strong> ${acheteurDisplay}</p>
        ${bon.acheteurTelephone ? `<p>📞 ${bon.acheteurTelephone}</p>` : ''}
        ${bon.acheteurEmail ? `<p>✉️ ${bon.acheteurEmail}</p>` : ''}
        <hr style="margin: 0.75rem 0; border: none; border-top: 1px solid #ddd;">
        <p><strong>🎁 Pour:</strong> ${beneficiaireDisplay}</p>
      </div>

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1rem;">
        <div style="background: #fff; padding: 0.75rem; border-radius: 6px; border: 1px solid #ddd;">
          <small style="color: #666;">Date d'achat</small>
          <div style="font-weight: 500;">${DataManager.formatDate(bon.dateAchat)}</div>
        </div>
        <div style="background: #fff; padding: 0.75rem; border-radius: 6px; border: 1px solid #ddd;">
          <small style="color: #666;">Expire le</small>
          <div style="font-weight: 500;">${DataManager.formatDate(bon.dateExpiration)}</div>
        </div>
      </div>

      <p><strong>💳 Moyen de paiement:</strong> ${bon.moyenPaiement || 'Non précisé'}</p>
      ${bon.notes ? `<p><strong>📝 Notes:</strong> ${bon.notes}</p>` : ''}

      ${prestationInfo}
    </div>

    <div class="modal-actions">
      <button type="button" class="btn-secondary" onclick="closeModal()">Fermer</button>
    </div>
  `;

  showModal('bon-cadeau-details-modal', modalHTML);
}

function setupBonCadeauAcheteurAutocomplete() {
  const searchInput = document.getElementById('bon-cadeau-acheteur-search');
  const clientIdInput = document.getElementById('bon-cadeau-acheteur-client-id');

  if (!searchInput) {
    console.log('❌ Input acheteur non trouvé');
    return;
  }

  const appData = DataManager.getAppData();
  const clients = appData.clients || [];
  console.log('🔍 Setup autocomplete avec', clients.length, 'clients');

  let autocompleteContainer = document.getElementById('bon-acheteur-autocomplete');
  if (!autocompleteContainer) {
    autocompleteContainer = document.createElement('div');
    autocompleteContainer.id = 'bon-acheteur-autocomplete';
    autocompleteContainer.style.cssText = 'position: absolute; background: white; border: 1px solid #ddd; border-radius: 6px; max-height: 200px; overflow-y: auto; z-index: 10000; width: 100%; box-shadow: 0 4px 12px rgba(0,0,0,0.15); display: none; top: 100%; left: 0;';
    searchInput.parentElement.style.position = 'relative';
    searchInput.parentElement.appendChild(autocompleteContainer);
  }

  // Utiliser event delegation sur le container
  autocompleteContainer.onclick = function(e) {
    const item = e.target.closest('.bon-autocomplete-item');
    if (item) {
      e.preventDefault();
      e.stopPropagation();
      const clientId = item.dataset.clientId;
      const clientNom = item.dataset.clientNom;
      console.log('✅ Clic autocomplete:', clientId, clientNom);

      // Remplir les champs
      searchInput.value = clientNom;
      clientIdInput.value = clientId;
      autocompleteContainer.style.display = 'none';

      // Remplir téléphone et email
      const client = clients.find(c => c.id === clientId);
      if (client) {
        const telInput = document.getElementById('bon-cadeau-acheteur-telephone');
        const emailInput = document.getElementById('bon-cadeau-acheteur-email');
        if (telInput && client.telephone) telInput.value = client.telephone;
        if (emailInput && client.email) emailInput.value = client.email;
      }
    }
  };

  searchInput.addEventListener('input', () => {
    const query = searchInput.value.toLowerCase().trim();
    clientIdInput.value = ''; // Reset client ID when typing

    if (query.length < 2) {
      autocompleteContainer.style.display = 'none';
      return;
    }

    const matches = clients.filter(c =>
      `${c.prenom} ${c.nom}`.toLowerCase().includes(query) ||
      (c.telephone && c.telephone.includes(query))
    ).slice(0, 5);

    if (matches.length === 0) {
      autocompleteContainer.style.display = 'none';
      return;
    }

    autocompleteContainer.innerHTML = matches.map(client => `
      <div class="bon-autocomplete-item"
           data-client-id="${client.id}"
           data-client-nom="${client.prenom} ${client.nom}"
           style="padding: 0.75rem; cursor: pointer; border-bottom: 1px solid #eee; transition: background 0.2s;"
>
        <strong>${client.prenom} ${client.nom}</strong>
        ${client.telephone ? `<br><small style="color: #666;">${client.telephone}</small>` : ''}
      </div>
    `).join('');

    autocompleteContainer.style.display = 'block';
  });

  // Fermer l'autocomplete si on clique ailleurs
  document.addEventListener('click', (e) => {
    if (!searchInput.contains(e.target) && !autocompleteContainer.contains(e.target)) {
      autocompleteContainer.style.display = 'none';
    }
  });
}

window.selectBonAcheteur = function(clientId, clientNom) {
  document.getElementById('bon-cadeau-acheteur-search').value = clientNom;
  document.getElementById('bon-cadeau-acheteur-client-id').value = clientId;
  document.getElementById('bon-acheteur-autocomplete').style.display = 'none';

  // Remplir le téléphone et email si disponibles
  const client = DataManager.getClientById(clientId);
  if (client) {
    const telInput = document.getElementById('bon-cadeau-acheteur-telephone');
    const emailInput = document.getElementById('bon-cadeau-acheteur-email');
    if (telInput && client.telephone) telInput.value = client.telephone;
    if (emailInput && client.email) emailInput.value = client.email;
  }
};

window.syncBonDateAchatToDebut = function() {
  const dateAchat = document.getElementById('bon-cadeau-date-achat').value;
  const dateDebutInput = document.getElementById('bon-cadeau-date-debut');

  if (dateAchat && dateDebutInput) {
    // Mettre à jour la date de début avec la date d'achat
    dateDebutInput.value = dateAchat;
    // Recalculer l'expiration
    updateBonExpirationPreview();
  }
};

window.updateBonExpirationPreview = function() {
  const dateDebut = document.getElementById('bon-cadeau-date-debut').value;
  if (dateDebut) {
    const dateExpiration = DataManager.calculerDateExpiration(dateDebut);
    const preview = document.getElementById('bon-expiration-preview');
    if (preview) {
      preview.innerHTML = `📅 Expire le : <strong>${new Date(dateExpiration).toLocaleDateString('fr-FR')}</strong>`;
    }
  }
};

function handleBonCadeauFormSubmit(e) {
  e.preventDefault();

  const bonId = document.getElementById('bon-cadeau-id').value;
  const isEdit = !!bonId;

  const formData = {
    id: bonId || DataManager.generateId(),
    description: document.getElementById('bon-cadeau-description').value,
    montant: parseFloat(document.getElementById('bon-cadeau-montant').value) || 0,
    moyenPaiement: document.getElementById('bon-cadeau-moyen-paiement').value,
    dateAchat: document.getElementById('bon-cadeau-date-achat').value,
    dateDebut: document.getElementById('bon-cadeau-date-debut').value,
    dateExpiration: DataManager.calculerDateExpiration(document.getElementById('bon-cadeau-date-debut').value),
    acheteurNom: document.getElementById('bon-cadeau-acheteur-search').value,
    acheteurClientId: document.getElementById('bon-cadeau-acheteur-client-id').value || null,
    acheteurTelephone: document.getElementById('bon-cadeau-acheteur-telephone').value,
    acheteurEmail: document.getElementById('bon-cadeau-acheteur-email').value,
    beneficiaireNom: document.getElementById('bon-cadeau-beneficiaire-nom').value,
    beneficiaireClientId: document.getElementById('bon-cadeau-beneficiaire-client-id')?.value || null,
    notes: document.getElementById('bon-cadeau-notes').value,
    statut: 'actif'
  };

  // Si bénéficiaire renseigné et pas de client ID, créer un client minimal
  if (formData.beneficiaireNom && !formData.beneficiaireClientId) {
    const newClient = BusinessServices.createClientMinimal(formData.beneficiaireNom);
    formData.beneficiaireClientId = newClient.id;
  }

  if (isEdit) {
    BusinessServices.updateBonCadeau(formData);
    showTemporaryMessage('Bon cadeau modifié avec succès');
  } else {
    BusinessServices.createBonCadeau(formData);
    showTemporaryMessage('Bon cadeau créé avec succès');
  }

  DataManager.saveData();
  closeModal();
  ViewManager.updateBonsCadeauxDisplay();
}

window.deleteBonCadeau = function(bonId) {
  if (confirm('Êtes-vous sûr de vouloir supprimer ce bon cadeau ? Cette action est irréversible.')) {
    BusinessServices.deleteBonCadeau(bonId);
    DataManager.saveData();
    closeModal();
    ViewManager.updateBonsCadeauxDisplay();
    showTemporaryMessage('Bon cadeau supprimé');
  }
};

// ===== ATTRIBUER RDV DEPUIS UN BON CADEAU =====
function showAttribuerRdvBonCadeauModal(bonId) {
  const bon = DataManager.getBonCadeauById(bonId);
  if (!bon) {
    alert('Bon cadeau introuvable');
    return;
  }

  // Si le bon est déjà utilisé
  if (bon.statut === 'utilise') {
    alert('Ce bon cadeau a déjà été utilisé.');
    return;
  }

  const today = new Date().toISOString().split('T')[0];
  const appData = DataManager.getAppData();

  // Info bénéficiaire
  let beneficiaireInfo = '';
  let beneficiaireClientId = bon.beneficiaireClientId || '';
  let beneficiaireNom = bon.beneficiaireNom || '';

  if (beneficiaireClientId) {
    const client = appData.clients.find(c => c.id === beneficiaireClientId);
    if (client) {
      beneficiaireNom = `${client.prenom} ${client.nom}`;
      beneficiaireInfo = `<div style="background: #e8f5e9; padding: 0.5rem; border-radius: 4px; margin-bottom: 1rem;">
        👤 Client sélectionné : <strong>${beneficiaireNom}</strong>
      </div>`;
    }
  }

  // Liste des clients pour sélection si pas de bénéficiaire
  const clientsOptions = appData.clients.map(c =>
    `<option value="${c.id}" ${c.id === beneficiaireClientId ? 'selected' : ''}>${c.prenom} ${c.nom}</option>`
  ).join('');

  // Liste des types de massage (depuis la carte des soins)
  const typesOptions = generateTypeOptions(null, null);

  // Durées par défaut (seront mises à jour au changement de type)
  const dureesOptions = generateDureeOptions(null, 60);

  const modalHTML = `
    <h3>📅 Attribuer un RDV à ce bon cadeau</h3>

    <div style="background: linear-gradient(135deg, var(--beige-dore-light) 0%, #fff 100%); padding: 1rem; border-radius: 8px; margin-bottom: 1.5rem; border-left: 4px solid var(--beige-dore);">
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <div>
          <strong>🎁 ${bon.description || 'Bon cadeau'}</strong>
          <div style="font-size: 1.3rem; font-weight: 700; color: var(--beige-dore); margin-top: 0.25rem;">${bon.montant.toFixed(2)} €</div>
        </div>
        <div style="text-align: right; font-size: 0.85rem; color: var(--text-light);">
          <div>Expire le : ${DataManager.formatDate(bon.dateExpiration)}</div>
          ${bon.acheteurNom ? `<div>Offert par : ${bon.acheteurNom}</div>` : ''}
        </div>
      </div>
    </div>

    ${beneficiaireInfo}

    <form id="attribuer-rdv-bon-form">
      <input type="hidden" id="attribuer-rdv-bon-id" value="${bonId}">

      ${!beneficiaireClientId ? `
      <div class="form-group">
        <label>Client bénéficiaire *</label>
        <select id="attribuer-rdv-client" required>
          <option value="">-- Sélectionnez un client --</option>
          ${clientsOptions}
        </select>
        <small style="color: #666;">
          ${beneficiaireNom ? `Nom indiqué sur le bon : <strong>${beneficiaireNom}</strong>` : 'Le bénéficiaire sera lié à ce bon'}
        </small>
      </div>
      ` : `<input type="hidden" id="attribuer-rdv-client" value="${beneficiaireClientId}">`}

      <div class="form-row">
        <div class="form-group">
          <label>Date du RDV *</label>
          <input type="date" id="attribuer-rdv-date" value="${today}" required min="${today}">
        </div>
        <div class="form-group">
          <label>Heure *</label>
          <input type="time" id="attribuer-rdv-heure" value="10:00" required>
        </div>
      </div>

      <div class="form-row">
        <div class="form-group">
          <label>Type de massage</label>
          <select id="attribuer-rdv-type" onchange="handleTypeChange('attribuer-rdv')">
            <option value="">-- Selon la description du bon --</option>
            ${typesOptions}
          </select>
        </div>
        <div class="form-group">
          <label>Durée</label>
          <select id="attribuer-rdv-duree" onchange="updatePrixFromSoin('attribuer-rdv')">
            ${dureesOptions}
          </select>
        </div>
      </div>

      <div class="form-group">
        <label>Lieu</label>
        <select id="attribuer-rdv-lieu">
          <option value="Salon">🏠 Au salon</option>
          <option value="Domicile">🏡 À domicile</option>
        </select>
      </div>

      <div class="form-group">
        <label>Notes</label>
        <textarea id="attribuer-rdv-notes" placeholder="Notes pour ce RDV...">${bon.notes ? 'Via bon cadeau : ' + bon.notes : ''}</textarea>
      </div>

      <div class="modal-actions">
        <button type="button" class="btn-secondary" onclick="closeModal()">Annuler</button>
        <button type="submit" class="btn-primary">📅 Créer le RDV</button>
      </div>
    </form>
  `;

  showModal('attribuer-rdv-bon-modal', modalHTML);

  // Setup du formulaire
  setTimeout(() => {
    const form = document.getElementById('attribuer-rdv-bon-form');
    if (form) {
      form.addEventListener('submit', handleAttribuerRdvBonSubmit);
    }
  }, 100);
}

function handleAttribuerRdvBonSubmit(e) {
  e.preventDefault();

  const bonId = document.getElementById('attribuer-rdv-bon-id').value;
  const clientId = document.getElementById('attribuer-rdv-client').value;
  const date = document.getElementById('attribuer-rdv-date').value;
  const heure = document.getElementById('attribuer-rdv-heure').value;
  const typeSelect = document.getElementById('attribuer-rdv-type');
  const soinId = typeSelect.value || null;
  const type = typeSelect.options[typeSelect.selectedIndex]?.text || typeSelect.value;
  const duree = parseInt(document.getElementById('attribuer-rdv-duree').value) || 60;
  const lieu = document.getElementById('attribuer-rdv-lieu').value;
  const notes = document.getElementById('attribuer-rdv-notes').value;

  if (!clientId) {
    alert('Veuillez sélectionner un client');
    return;
  }

  const bon = DataManager.getBonCadeauById(bonId);
  if (!bon) {
    alert('Bon cadeau introuvable');
    return;
  }

  // Créer le RDV
  const rdvId = DataManager.generateId();
  const rdvData = {
    id: rdvId,
    clientId: clientId,
    date: date,
    heure: heure,
    soinId: soinId,
    type: type || bon.description || 'Massage',
    duree: duree,
    lieu: lieu,
    statut: 'planifie',
    bonCadeauId: bonId,
    notes: notes,
    createdAt: new Date().toISOString()
  };

  // Ajouter le RDV
  const appData = DataManager.getAppData();
  if (!appData.rdv) appData.rdv = [];
  appData.rdv.push(rdvData);

  // Mettre à jour le bon avec le bénéficiaire si pas déjà défini
  if (!bon.beneficiaireClientId) {
    bon.beneficiaireClientId = clientId;
    // Mettre à jour le nom du bénéficiaire
    const client = appData.clients.find(c => c.id === clientId);
    if (client) {
      bon.beneficiaireNom = `${client.prenom} ${client.nom}`;
    }
  }

  DataManager.saveData();
  closeModal();

  // Rafraîchir l'affichage
  ViewManager.updateBonsCadeauxDisplay();

  // Afficher un message de confirmation
  showTemporaryMessage(`RDV créé pour le ${DataManager.formatDate(date)} à ${heure}`);
}

// Exports des fonctions bons cadeaux
window.showAddBonCadeauModal = showAddBonCadeauModal;
window.showEditBonCadeauModal = showEditBonCadeauModal;
window.showBonCadeauDetailsModal = showBonCadeauDetailsModal;
window.showAttribuerRdvBonCadeauModal = showAttribuerRdvBonCadeauModal;

// ===== FONCTIONS POUR INTÉGRATION BONS CADEAUX DANS PRESTATIONS =====

function toggleBonCadeauSelector() {
  const moyenPaiement = document.getElementById('prestation-moyen-paiement');
  const bonContainer = document.getElementById('bon-cadeau-selector-container');

  if (!moyenPaiement || !bonContainer) return;

  if (moyenPaiement.value === 'Bon cadeau') {
    bonContainer.style.display = 'block';
    populateBonsCadeauxSelector();
  } else {
    bonContainer.style.display = 'none';
    document.getElementById('bon-cadeau-info').innerHTML = '';
  }
}

function populateBonsCadeauxSelector(selectedBonId = null) {
  const select = document.getElementById('prestation-bon-cadeau');
  if (!select) return;

  // Récupérer le client sélectionné si disponible
  const clientId = document.getElementById('prestation-client')?.value;

  // Récupérer les bons actifs
  const bonsActifs = DataManager.getBonsCadeauxActifs();

  select.innerHTML = '<option value="">-- Sélectionnez un bon --</option>';

  if (bonsActifs.length === 0) {
    select.innerHTML += '<option value="" disabled>Aucun bon cadeau actif disponible</option>';
    return;
  }

  bonsActifs.forEach(bon => {
    const joursRestants = Math.ceil((new Date(bon.dateExpiration) - new Date()) / (1000 * 60 * 60 * 24));
    const expirationWarning = joursRestants <= 30 ? ` ⚠️ ${joursRestants}j` : '';

    // Infos bénéficiaire
    let beneficiaireInfo = '';
    if (bon.beneficiaireNom) {
      beneficiaireInfo = ` → ${bon.beneficiaireNom}`;
    }

    const isSelected = selectedBonId === bon.id ? 'selected' : '';

    select.innerHTML += `
      <option value="${bon.id}" ${isSelected}>
        🎁 ${bon.description} (${bon.montant}€)${beneficiaireInfo}${expirationWarning}
      </option>
    `;
  });
}

function fillFromBonCadeau() {
  const select = document.getElementById('prestation-bon-cadeau');
  const infoContainer = document.getElementById('bon-cadeau-info');
  const prixInput = document.getElementById('prestation-prix');

  if (!select || !select.value) {
    if (infoContainer) infoContainer.innerHTML = '';
    return;
  }

  const bonId = select.value;
  const bon = DataManager.getBonCadeauById(bonId);

  if (!bon) return;

  // Remplir le prix avec le montant du bon
  if (prixInput) {
    prixInput.value = bon.montant;
  }

  // Afficher les infos du bon
  if (infoContainer) {
    const joursRestants = Math.ceil((new Date(bon.dateExpiration) - new Date()) / (1000 * 60 * 60 * 24));

    let infoHtml = `
      <div style="background: #e8f5e9; padding: 0.75rem; border-radius: 6px; margin-top: 0.5rem;">
        <strong>🎁 ${bon.description}</strong><br>
        <small>
          💰 Montant: ${bon.montant}€<br>
          ${bon.acheteurNom ? `👤 Offert par: ${bon.acheteurNom}<br>` : ''}
          ${bon.beneficiaireNom ? `🎁 Pour: ${bon.beneficiaireNom}<br>` : ''}
          📅 Expire dans ${joursRestants} jour(s)
          ${bon.forceUtilise ? '<br>⚠️ Bon utilisé après expiration (forcé)' : ''}
        </small>
      </div>
    `;
    infoContainer.innerHTML = infoHtml;
  }

  // Si le bon a un bénéficiaire avec clientId, le sélectionner automatiquement
  if (bon.beneficiaireClientId) {
    const clientInput = document.getElementById('prestation-client');
    const clientSearchInput = document.getElementById('prestation-client-search');

    if (clientInput && clientSearchInput) {
      clientInput.value = bon.beneficiaireClientId;
      const client = DataManager.getClientById(bon.beneficiaireClientId);
      if (client) {
        clientSearchInput.value = `${client.prenom} ${client.nom}`;
      }
    }
  }
}

window.toggleBonCadeauSelector = toggleBonCadeauSelector;
window.populateBonsCadeauxSelector = populateBonsCadeauxSelector;
window.fillFromBonCadeau = fillFromBonCadeau;

console.log('✅ Modal Manager complet chargé avec toutes les vérifications de sécurité');