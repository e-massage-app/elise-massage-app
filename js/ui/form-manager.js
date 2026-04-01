// ===== js/ui/form-manager.js =====
// Gestion avancée des formulaires, édition, validation et interactions

// ===== GESTION DES FORMULAIRES D'ÉDITION =====

function editRdv(rdvId) {
  const rdv = DataManager.getRdvById(rdvId);
  if (!rdv) return;

  // Vérifier si c'est un soin partenariat
  const isPartnership = DataManager.isPartnershipSoin(rdv.soinId || rdv.type);

  const modalHTML = `
    <h3>Modifier rendez-vous</h3>
    <form id="rdv-form">
      <input type="hidden" id="rdv-id" value="${rdv.id}">
      <div class="form-group">
        <label>Client</label>
        <input type="text" id="rdv-client-search" placeholder="Rechercher un client..." required style="width: 100%; padding: 0.75rem; border: 1px solid #ddd; border-radius: 6px;">
        <input type="hidden" id="rdv-client" required value="${rdv.clientId}">
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Date</label>
          <input type="date" id="rdv-date" required value="${rdv.date}">
        </div>
        <div class="form-group">
          <label>Heure</label>
          <input type="time" id="rdv-heure" required value="${rdv.heure}">
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Type de soin</label>
          <select id="rdv-type" required onchange="handleTypeChange('rdv')">
            ${generateTypeOptions(rdv.soinId, rdv.type)}
          </select>
        </div>
        <div class="form-group">
          <label>Durée</label>
          <select id="rdv-duree" required>
            ${generateDureeOptions(rdv.soinId, rdv.duree)}
          </select>
          <input type="number" id="rdv-duree-autre" placeholder="Durée en minutes" style="display: none; margin-top: 0.5rem;" min="1">
        </div>
      </div>
      
      <div class="form-group">
        <label>Adresse du massage</label>
        <div style="position: relative;">
          <input type="text" id="rdv-adresse-massage" placeholder="Salon ou adresse du client..." style="width: 100%; padding: 0.75rem; border: 1px solid #ddd; border-radius: 6px;" value="${rdv.adresseMassage || ''}">
          <button type="button" onclick="BusinessServices.calculateDistanceAndCost('rdv-adresse-massage', 'rdv-distance', 'rdv-frais')" style="position: absolute; right: 0.5rem; top: 50%; transform: translateY(-50%); background: var(--beige-dore); color: white; border: none; padding: 0.25rem 0.5rem; border-radius: 4px; font-size: 0.8rem; cursor: pointer;">📍 Calculer</button>
        </div>
        <input type="hidden" id="rdv-distance" value="${rdv.distanceKm || 0}">
        <input type="hidden" id="rdv-frais" value="${rdv.fraisDeplacement || 0}">
        <div id="rdv-adresse-massage-result" style="margin-top: 0.5rem; font-size: 0.85rem;">
          ${rdv.adresseMassage && rdv.distanceKm > 0 ? `
            <div style="background: var(--beige-clair); padding: 0.5rem; border-radius: 6px; border-left: 3px solid var(--beige-dore);">
              <div style="color: var(--beige-dore); font-weight: 600; font-size: 0.85rem;">📍 Distance: ${rdv.distanceKm} km</div>
              <div style="color: var(--text-dark); font-weight: 600; font-size: 0.85rem;">💰 Frais estimés: ${(rdv.fraisDeplacement || 0).toFixed(2)} € (A/R)</div>
            </div>
          ` : ''}
        </div>
      </div>
      
      <div class="form-row">
        <div class="form-group">
          <label>Statut</label>
          <select id="rdv-statut">
            <option value="confirmé" ${rdv.statut === 'confirmé' ? 'selected' : ''}>Confirmé</option>
            <option value="en attente" ${rdv.statut === 'en attente' ? 'selected' : ''}>En attente</option>
            <option value="annulé" ${rdv.statut === 'annulé' ? 'selected' : ''}>Annulé</option>
          </select>
        </div>
        <div class="form-group">
          <label>Sexe (pour statistiques)</label>
          <select id="rdv-sexe" style="width: 100%; padding: 0.75rem; border: 1px solid #ddd; border-radius: 6px;">
            <option value="" ${!rdv.sexe || rdv.sexe === '' ? 'selected' : ''}>-- Non précisé --</option>
            <option value="H" ${rdv.sexe === 'H' ? 'selected' : ''}>Homme</option>
            <option value="F" ${rdv.sexe === 'F' ? 'selected' : ''}>Femme</option>
          </select>
          <small style="color: #666; font-size: 0.8rem;">💡 Pré-rempli depuis la fiche client</small>
        </div>
      </div>
      <div class="form-group">
        <label>Notes</label>
        <textarea id="rdv-notes">${rdv.notes || ''}</textarea>
      </div>
      <div class="modal-actions">
        <button type="button" class="btn-secondary" onclick="closeModal()">Annuler</button>
        <button type="submit" class="btn-primary">Enregistrer</button>
      </div>
    </form>
  `;
  
  ModalManager.showModal('rdv-modal', modalHTML);

  // Initialiser l'autocomplétion avec la valeur actuelle
  setTimeout(() => {
    const appData = DataManager.getAppData();

    // Pré-remplir le champ client
    const client = appData.clients.find(c => c.id === rdv.clientId);
    const collab = DataManager.getCollaborateurById(rdv.clientId);
    if (collab) {
      document.getElementById('rdv-client-search').value = `${collab.prenom} ${collab.nom || ''} - ${collab.entreprise || ''}`.trim();
    } else if (client) {
      document.getElementById('rdv-client-search').value = `${client.prenom} ${client.nom}`;
    }

    createClientAutocomplete('rdv-client-search', 'rdv-client');
    setupClientAddressAutofill('rdv-client', 'rdv-adresse-massage');
    BusinessServices.setupAutoCalculateAddress('rdv-adresse-massage', 'rdv-distance', 'rdv-frais');
    DataManager.setEditingId(rdvId);

    // Initialiser les comportements dynamiques selon le type
    handleTypeChange('rdv');
    // Re-sélectionner la durée d'origine
    const dureeSelect = document.getElementById('rdv-duree');
    if (dureeSelect && rdv.duree) {
      const opt = dureeSelect.querySelector(`option[value="${rdv.duree}"]`);
      if (opt) dureeSelect.value = rdv.duree;
    }
  }, 200);
}

function editPrestation(prestationId) {
  const prestation = DataManager.getPrestationById(prestationId);
  if (!prestation) return;
  
  const modalHTML = `
    <h3>Modifier prestation</h3>
    <form id="prestation-form">
      <input type="hidden" id="prestation-id" value="${prestation.id}">
      <div class="form-group">
        <label>Client</label>
        <input type="text" id="prestation-client-search" placeholder="Rechercher un client..." required style="width: 100%; padding: 0.75rem; border: 1px solid #ddd; border-radius: 6px;">
        <input type="hidden" id="prestation-client" required value="${prestation.clientId}">
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Date</label>
          <input type="date" id="prestation-date" required value="${prestation.date}">
        </div>
        <div class="form-group">
          <label>Heure</label>
          <input type="time" id="prestation-heure" required value="${prestation.heure}">
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Type de soin</label>
          <select id="prestation-type" required onchange="handleTypeChange('prestation')">
            ${generateTypeOptions(prestation.soinId, prestation.type)}
          </select>
        </div>
        <div class="form-group">
          <label>Durée</label>
          <select id="prestation-duree" required>
            ${generateDureeOptions(prestation.soinId, prestation.duree)}
          </select>
          <input type="number" id="prestation-duree-autre" placeholder="Durée en minutes" style="display: none; margin-top: 0.5rem;" min="1">
        </div>
      </div>
      
      <div class="form-group">
        <label>Adresse du massage</label>
        <div style="position: relative;">
          <input type="text" id="prestation-adresse-massage" placeholder="Salon ou adresse du client..." style="width: 100%; padding: 0.75rem; border: 1px solid #ddd; border-radius: 6px;" value="${prestation.adresseMassage || ''}">
          <button type="button" onclick="BusinessServices.calculateDistanceAndCost('prestation-adresse-massage', 'prestation-distance', 'prestation-frais')" style="position: absolute; right: 0.5rem; top: 50%; transform: translateY(-50%); background: var(--beige-dore); color: white; border: none; padding: 0.25rem 0.5rem; border-radius: 4px; font-size: 0.8rem; cursor: pointer;">📍 Calculer</button>
        </div>
        <input type="hidden" id="prestation-distance" value="${prestation.distanceKm || 0}">
        <input type="hidden" id="prestation-frais" value="${prestation.fraisDeplacement || 0}">
        <div id="prestation-adresse-massage-result" style="margin-top: 0.5rem; font-size: 0.85rem;">
          ${prestation.adresseMassage && prestation.distanceKm > 0 ? `
            <div style="background: var(--beige-clair); padding: 0.5rem; border-radius: 6px; border-left: 3px solid var(--beige-dore);">
              <div style="color: var(--beige-dore); font-weight: 600; font-size: 0.85rem;">📍 Distance: ${prestation.distanceKm} km</div>
              <div style="color: var(--text-dark); font-weight: 600; font-size: 0.85rem;">💰 Frais estimés: ${(prestation.fraisDeplacement || 0).toFixed(2)} € (A/R)</div>
            </div>
          ` : ''}
        </div>
      </div>
      
      <div class="form-row">
        <div class="form-group">
          <label>Prix (€)</label>
          <input type="number" id="prestation-prix" step="0.01" min="0" required value="${prestation.prix || ''}">
        </div>
        <div class="form-group">
          <label>Tips reçus (€)</label>
          <input type="number" id="prestation-tips" step="0.01" min="0" placeholder="0.00" value="${prestation.tips || ''}">
          <small style="color: #666; font-size: 0.8rem;">💸 Pourboires ou gratifications reçues</small>
        </div>
      </div>
      
      <div class="form-group">
        <label>💳 Moyen de paiement</label>
        <select id="prestation-moyen-paiement" required style="width: 100%; padding: 0.75rem; border: 1px solid #ddd; border-radius: 6px;">
          <option value="">-- Sélectionnez le moyen de paiement --</option>
          <option value="Liquide" ${prestation.moyenPaiement === 'Liquide' ? 'selected' : ''}>💵 Liquide</option>
          <option value="Carte bleue" ${prestation.moyenPaiement === 'Carte bleue' ? 'selected' : ''}>💳 Carte bleue</option>
        </select>
      </div>
      
      <div class="form-group">
        <label>Notes</label>
        <textarea id="prestation-notes">${prestation.notes || ''}</textarea>
      </div>
      
      <div class="modal-actions">
        <button type="button" class="btn-secondary" onclick="closeModal()">Annuler</button>
        <button type="submit" class="btn-primary">Enregistrer</button>
      </div>
    </form>
  `;
  
  window.ModalManager.showModal('prestation-modal', modalHTML);

  setTimeout(() => {
    const appData = DataManager.getAppData();
    const client = appData.clients.find(c => c.id === prestation.clientId);
    const collab = DataManager.getCollaborateurById(prestation.clientId);
    if (collab) {
      document.getElementById('prestation-client-search').value = `${collab.prenom} ${collab.nom || ''} - ${collab.entreprise || ''}`.trim();
    } else if (client) {
      document.getElementById('prestation-client-search').value = `${client.prenom} ${client.nom}`;
    }
    createClientAutocomplete('prestation-client-search', 'prestation-client');
    BusinessServices.setupAutoCalculateAddress('prestation-adresse-massage', 'prestation-distance', 'prestation-frais');
    setupClientAddressAutofill('prestation-client', 'prestation-adresse-massage');
    DataManager.setEditingId(prestationId);

    // Initialiser les comportements dynamiques selon le type
    handleTypeChange('prestation');
    // Re-sélectionner la durée et le prix d'origine
    const dureeSelect = document.getElementById('prestation-duree');
    if (dureeSelect && prestation.duree) {
      const opt = dureeSelect.querySelector(`option[value="${prestation.duree}"]`);
      if (opt) dureeSelect.value = prestation.duree;
    }
    const prixInput = document.getElementById('prestation-prix');
    if (prixInput && prestation.prix) prixInput.value = prestation.prix;
  }, 200);
}

// ===== ✅ NOUVEAU : GESTION DES COLLABORATEURS AVEC TAGS UNIFIÉ =====
function editCollaborateur(collaborateurId) {
  const collaborateur = DataManager.getCollaborateurById(collaborateurId);
  if (!collaborateur) return;
  
  const modalHTML = `
    <h3>🤝 Modifier collaborateur</h3>
    <form id="collaborateur-form">
      <input type="hidden" id="collaborateur-id" value="${collaborateur.id}">
      
      <div class="form-row">
        <div class="form-group">
          <label>Prénom *</label>
          <input type="text" id="collaborateur-prenom" required value="${collaborateur.prenom || ''}">
        </div>
        <div class="form-group">
          <label>Nom *</label>
          <input type="text" id="collaborateur-nom" required value="${collaborateur.nom || ''}">
        </div>
      </div>
      
      <div class="form-row">
        <div class="form-group">
          <label>Poste/Fonction</label>
          <input type="text" id="collaborateur-poste" placeholder="Ex: Masseur-kinésithérapeute" value="${collaborateur.poste || ''}">
        </div>
        <div class="form-group">
          <label>Entreprise/Cabinet</label>
          <input type="text" id="collaborateur-entreprise" placeholder="Ex: Cabinet Wellness" value="${collaborateur.entreprise || ''}">
        </div>
      </div>
      
      <div class="form-group">
        <label>Spécialités</label>
        <textarea id="collaborateur-specialites" placeholder="Ex: Massage thérapeutique, Réflexologie plantaire...">${collaborateur.specialites || ''}</textarea>
      </div>
      
      <div class="form-row">
        <div class="form-group">
          <label>Téléphone</label>
          <input type="tel" id="collaborateur-telephone" value="${collaborateur.telephone || ''}">
        </div>
        <div class="form-group">
          <label>Email</label>
          <input type="email" id="collaborateur-email" value="${collaborateur.email || ''}">
        </div>
      </div>
      
      <div class="form-group">
        <label>Adresse</label>
        <textarea id="collaborateur-adresse" placeholder="Adresse complète du cabinet/lieu de travail">${collaborateur.adresse || ''}</textarea>
      </div>
      
      <div class="form-group">
        <label>Notes</label>
        <textarea id="collaborateur-notes" placeholder="Notes personnelles, tarifs, disponibilités...">${collaborateur.notes || ''}</textarea>
      </div>
          
      <div class="modal-actions">
        <button type="button" class="btn-secondary" onclick="closeModal()">Annuler</button>
        <button type="submit" class="btn-primary">🤝 Enregistrer</button>
      </div>
    </form>
  `;
  
  ModalManager.showModal('collaborateur-modal', modalHTML);
  DataManager.setEditingId(collaborateurId);
  
  // Initialiser la gestion des tags après affichage de la modal
  setTimeout(() => {
    initCollaborateurTagsSystem();
  }, 200);
}

// ===== ✅ NOUVEAU : SYSTÈME DE GESTION DES TAGS POUR COLLABORATEURS =====
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

function editClient(clientId) {
  // Cette fonction devrait être dans client-services.js normalement
  // Mais on l'ajoute ici pour la compatibilité
  if (ClientServices && ClientServices.editClient) {
    ClientServices.editClient(clientId);
  } else {
    console.error('ClientServices.editClient not found');
  }
}

function editProspect(prospectId) {
  // Cette fonction devrait être dans client-services.js normalement
  // Mais on l'ajoute ici pour la compatibilité
  if (ClientServices && ClientServices.editProspect) {
    ClientServices.editProspect(prospectId);
  } else {
    console.error('ClientServices.editProspect not found');
  }
}

function editDepense(depenseId) {
  const depense = DataManager.getDepenseById(depenseId);
  if (!depense) return;
  
  const modalHTML = `
    <h3>Modifier dépense</h3>
    <form id="depenses-form">
      <input type="hidden" id="depense-id" value="${depense.id}">
      <div class="form-row">
        <div class="form-group">
          <label>Date *</label>
          <input type="date" id="depense-date" required value="${depense.date}">
        </div>
        <div class="form-group">
          <label>Montant (€) *</label>
          <input type="number" id="depense-montant" step="0.01" required value="${depense.montant}">
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Catégorie</label>
          <select id="depense-categorie">
            <option value="Huiles" ${depense.categorie === 'Huiles' ? 'selected' : ''}>Huiles</option>
            <option value="Matériel" ${depense.categorie === 'Matériel' ? 'selected' : ''}>Matériel</option>
            <option value="Formation" ${depense.categorie === 'Formation' ? 'selected' : ''}>Formation</option>
            <option value="Transport" ${depense.categorie === 'Transport' ? 'selected' : ''}>Transport</option>
            <option value="Marketing" ${depense.categorie === 'Marketing' ? 'selected' : ''}>Marketing</option>
            <option value="Abonnement" ${depense.categorie === 'Abonnement' ? 'selected' : ''}>Abonnement</option>
            <option value="Loyer" ${depense.categorie === 'Loyer' ? 'selected' : ''}>Loyer</option>
            <option value="Autre" ${depense.categorie === 'Autre' ? 'selected' : ''}>Autre</option>
          </select>
        </div>
        <div class="form-group">
          <label>Fournisseur</label>
          <input type="text" id="depense-fournisseur" value="${depense.fournisseur || ''}">
        </div>
      </div>
      <div class="form-group">
        <label>Description</label>
        <input type="text" id="depense-description" placeholder="Ex: Huile d'amande douce, Table de massage..." value="${depense.description || ''}">
      </div>
      <div class="form-group">
        <label>Notes</label>
        <textarea id="depense-notes">${depense.notes || ''}</textarea>
      </div>
      <div class="modal-actions">
        <button type="button" class="btn-secondary" onclick="closeModal()">Annuler</button>
        <button type="submit" class="btn-primary">Enregistrer</button>
      </div>
    </form>
  `;
  
  ModalManager.showModal('depenses-modal', modalHTML);
  DataManager.setEditingId(depenseId);
}

// ===== INTERACTIONS CALENDRIER =====
function selectCalendarDay(dateStr) {
  const rdvDuJour = DataManager.getRdvForDate(dateStr);
  
  if (rdvDuJour.length > 0) {
    // Si il y a des RDV, permettre de les éditer
    if (rdvDuJour.length === 1) {
      showRdvDetails(rdvDuJour[0].id);
    } else {
      // Multiple RDV - afficher une liste
      showRdvListModal(rdvDuJour);
    }
  } else {
    // Nouveau RDV pour cette date - utiliser showAddRdvModal de l'objet global
    if (window.showAddRdvModal) {
      window.showAddRdvModal(dateStr);
    } else {
      console.error('showAddRdvModal non disponible');
    }
  }
}

function showRdvListModal(rdvList) {
  const appData = DataManager.getAppData();
  
  const modalHTML = `
    <h3>Rendez-vous du jour</h3>
    <div style="margin: 1rem 0;">
      ${rdvList.map(rdv => {
        const client = appData.clients.find(c => c.id === rdv.clientId);
        // Gestion partenariat
        const isPartnershipRdv = DataManager.isPartnershipSoin(rdv.soinId || rdv.type);
        const clientNom = isPartnershipRdv ? DataManager.getDisplayNameForType(rdv.soinId || rdv.type) : (client ? `${client.prenom} ${client.nom}` : 'Client inconnu');

        return `
          <div class="rdv-item" style="background: var(--beige-clair); padding: 1rem; border-radius: 8px; margin: 0.5rem 0; cursor: pointer;" onclick="showRdvDetails('${rdv.id}')">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <div>
                <strong>${rdv.heure}</strong> - ${clientNom}<br>
                <small>${rdv.type} (${rdv.duree || 60}min) - ${rdv.statut}</small>
              </div>
              <button class="btn-secondary" onclick="event.stopPropagation(); editRdv('${rdv.id}')" style="padding: 0.25rem 0.5rem; font-size: 0.8rem;">Éditer</button>
            </div>
          </div>
        `;
      }).join('')}
    </div>
    <div class="modal-actions">
      <button class="btn-primary" onclick="closeModal(); ModalManager.showAddRdvModal('${rdvList[0].date}')">Nouveau RDV</button>
      <button type="button" class="btn-secondary" onclick="closeModal()">Fermer</button>
    </div>
  `;
  
  ModalManager.showModal('rdv-modal', modalHTML);
}

function showRdvDetails(rdvId) {
  const rdv = DataManager.getRdvById(rdvId);
  if (!rdv) return;

  const appData = DataManager.getAppData();
  const client = appData.clients.find(c => c.id === rdv.clientId);
  // Pour les partenariats, afficher le nom du soin au lieu du nom du client
  const isPartnershipDetail = DataManager.isPartnershipSoin(rdv.soinId || rdv.type);
  const clientNom = isPartnershipDetail ? DataManager.getDisplayNameForType(rdv.soinId || rdv.type) : (client ? `${client.prenom} ${client.nom}` : 'Client inconnu');
  
  // Affichage des frais de déplacement si existants
  const fraisHtml = rdv.adresseMassage ? `
    <p><strong>📍 Adresse massage:</strong> ${rdv.adresseMassage}</p>
    ${rdv.distanceKm > 0 ? `
      <p><strong>📏 Distance:</strong> ${rdv.distanceKm} km (A/R)</p>
      <p><strong>💰 Frais déplacement:</strong> ${(rdv.fraisDeplacement || 0).toFixed(2)} €</p>
    ` : ''}
  ` : '<p><strong>📍 Lieu:</strong> Salon (pas de frais)</p>';
  
  const modalHTML = `
    <h3>Détails du rendez-vous</h3>
    <div style="margin: 1rem 0;">
      <p><strong>👤 Client:</strong> ${clientNom}</p>
      <p><strong>📅 Date:</strong> ${DataManager.formatDate(rdv.date)} à ${rdv.heure}</p>
      <p><strong>💆‍♀️ Type:</strong> ${rdv.type}</p>
      <p><strong>⏱️ Durée:</strong> ${rdv.duree || 60} minutes</p>
      <p><strong>📊 Statut:</strong> <span class="rdv-statut ${rdv.statut.replace(/\s+/g, '-')}">${rdv.statut}</span></p>
      ${fraisHtml}
      ${rdv.notes ? `<p><strong>📝 Notes:</strong> ${rdv.notes}</p>` : ''}
    </div>
    <div class="rdv-actions">
      <button class="btn-secondary" onclick="editRdv('${rdv.id}')">✏️ Modifier</button>
      <button class="btn-danger" onclick="deleteRdv('${rdv.id}')">🗑️ Supprimer</button>
      ${!rdv.transformeEnPrestation ? 
        `<button class="btn-primary" onclick="transformerEnPrestation('${rdv.id}')">→ Prestation</button>` : 
        `<button class="btn-secondary" onclick="annulerTransformation('${rdv.id}')">↻ Annuler transformation</button>`
      }
      <button class="btn-secondary" onclick="ClientServices.showClientDetails('${rdv.clientId}')">👤 Voir client</button>
    </div>
    <div class="modal-actions" style="margin-top: 1rem;">
      <button type="button" class="btn-secondary" onclick="closeModal()">Fermer</button>
    </div>
  `;
  
  window.ModalManager.showModal('rdv-modal', modalHTML);
}

function showPrestationDetails(prestationId) {
  const prestation = DataManager.getPrestationById(prestationId);
  if (!prestation) return;

  const appData = DataManager.getAppData();
  const client = appData.clients.find(c => c.id === prestation.clientId);
  // Pour les partenariats, afficher le nom du soin au lieu du nom du client
  const isPartnershipPresta = DataManager.isPartnershipSoin(prestation.soinId || prestation.type);
  const clientNom = isPartnershipPresta ? DataManager.getDisplayNameForType(prestation.soinId || prestation.type) : (client ? `${client.prenom} ${client.nom}` : 'Client inconnu');
  
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
    <h3>Détails de la prestation</h3>
    <div style="margin: 1rem 0;">
      <p><strong>👤 Client:</strong> ${clientNom}</p>
      <p><strong>📅 Date:</strong> ${DataManager.formatDate(prestation.date)} à ${prestation.heure}</p>
      <p><strong>💆‍♀️ Type:</strong> ${prestation.type}</p>
      <p><strong>⏱️ Durée:</strong> ${prestation.duree || 60} minutes</p>
      <p><strong>💶 Prix facturé:</strong> ${prix.toFixed(2)} €</p>
      ${fraisHtml}
      ${prestation.notes ? `<p><strong>📝 Notes:</strong> ${prestation.notes}</p>` : ''}
    </div>
    <div class="rdv-actions">
      <button class="btn-secondary" onclick="editPrestation('${prestation.id}')">✏️ Modifier</button>
      <button class="btn-danger" onclick="deletePrestation('${prestation.id}')">🗑️ Supprimer</button>
      <button class="btn-secondary" onclick="ClientServices.showClientDetails('${prestation.clientId}')">👤 Voir client</button>
    </div>
    <div class="modal-actions" style="margin-top: 1rem;">
      <button type="button" class="btn-secondary" onclick="closeModal()">Fermer</button>
    </div>
  `;
  
  ModalManager.showModal('rdv-modal', modalHTML);
}

// ===== ACTIONS DE SUPPRESSION =====
async function deleteRdv(rdvId) {
  if (await showCustomConfirm('Êtes-vous sûr de vouloir supprimer ce rendez-vous ?')) {
    BusinessServices.deleteRdvById(rdvId);
    await DataManager.saveData();
    ViewManager.updateCalendar();
    ViewManager.updateDashboard();
    ModalManager.closeModal();
    showTemporaryMessage('Rendez-vous supprimé');
  }
}

async function deletePrestation(prestationId) {
  if (await showCustomConfirm('Êtes-vous sûr de vouloir supprimer cette prestation ?')) {
    BusinessServices.deletePrestationById(prestationId);
    await DataManager.saveData();
    ViewManager.updatePrestationsTable();
    ViewManager.updateDashboard();
    ViewManager.updateCalendar();
    ModalManager.closeModal();
    showTemporaryMessage('Prestation supprimée');
  }
}

async function deleteClient(clientId) {
  if (await showCustomConfirm('Êtes-vous sûr de vouloir supprimer ce client et tous ses RDV/prestations ?')) {
    ClientServices.deleteClientById(clientId);
    await DataManager.saveData();
    ViewManager.updateClientsDisplay();
    ViewManager.updateCalendar();
    ViewManager.updatePrestationsTable();
    ViewManager.updateDashboard();
    showTemporaryMessage('Client supprimé');
  }
}

async function deleteProspect(prospectId) {
  if (await showCustomConfirm('Êtes-vous sûr de vouloir supprimer ce prospect ?')) {
    ClientServices.deleteProspectById(prospectId);
    await DataManager.saveData();
    ViewManager.updateClientsDisplay();
    showTemporaryMessage('Prospect supprimé');
  }
}

// ===== ✅ NOUVEAU : SUPPRESSION COLLABORATEUR =====
async function deleteCollaborateur(collaborateurId) {
  if (await showCustomConfirm('Êtes-vous sûr de vouloir supprimer ce collaborateur ?')) {
    const appData = DataManager.getAppData();
    appData.collaborateurs = appData.collaborateurs.filter(c => c.id !== collaborateurId);
    await DataManager.saveData();
    ViewManager.updateClientsDisplay();
    showTemporaryMessage('Collaborateur supprimé');
  }
}

async function deleteDepense(depenseId) {
  if (await showCustomConfirm('Êtes-vous sûr de vouloir supprimer cette dépense ?')) {
    BusinessServices.deleteDepenseById(depenseId);
    await DataManager.saveData();
    ViewManager.updateDepensesDisplay();
    ViewManager.updateDashboard();
    ModalManager.closeModal();
    showTemporaryMessage('Dépense supprimée');
  }
}

// ===== TRANSFORMATIONS RDV ↔ PRESTATIONS =====
function transformerEnPrestation(rdvId) {
  const rdv = DataManager.getRdvById(rdvId);
  if (!rdv) return;

  // Fermer la modal RDV
  ModalManager.closeModal();

  // Ouvrir la modal prestation avec données pré-remplies
  setTimeout(() => {
    const appData = DataManager.getAppData();
    const isPartnership = DataManager.isPartnershipSoin(rdv.soinId || rdv.type);

    // Résoudre le client/collaborateur
    let client = appData.clients.find(c => c.id === rdv.clientId);
    let clientNom = '';
    let clientId = rdv.clientId;

    if (isPartnership) {
      const soin = DataManager.resolveSoin(rdv.soinId || rdv.type);
      const collabId = soin ? soin.partenaireCollaborateurId : null;
      const collab = collabId ? DataManager.getCollaborateurById(collabId) : null;
      if (collab) {
        clientNom = `${collab.prenom} ${collab.nom || ''} - ${collab.entreprise || ''}`.trim();
        clientId = collab.id;
      } else {
        clientNom = DataManager.getDisplayNameForType(rdv.soinId || rdv.type);
      }
    } else {
      clientNom = client ? `${client.prenom} ${client.nom}` : '';
    }

    // Calculer le prix auto depuis la carte des soins
    let prixAuto = '';
    const prix = DataManager.getPrixForSoinVariante(rdv.soinId, rdv.duree);
    if (prix !== null) {
      prixAuto = prix;
    }
    
    const modalHTML = `
      <h3>Transformer en prestation</h3>
      <form id="prestation-form" data-rdv-source="${rdvId}">
        <input type="hidden" id="prestation-id">
        <div class="form-group">
          <label>Client</label>
          <input type="text" id="prestation-client-search" placeholder="Rechercher un client..." required readonly value="${clientNom}" style="background: #f8f9fa;">
          <input type="hidden" id="prestation-client" required value="${clientId}">
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>Date</label>
            <input type="date" id="prestation-date" required value="${rdv.date}" readonly style="background: #f8f9fa;">
          </div>
          <div class="form-group">
            <label>Heure</label>
            <input type="time" id="prestation-heure" required value="${rdv.heure}" readonly style="background: #f8f9fa;">
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>Type de soin</label>
            <select id="prestation-type" required disabled style="background: #f8f9fa;">
              <option value="${rdv.soinId || rdv.type}" selected>${DataManager.getDisplayNameForType(rdv.soinId || rdv.type)}</option>
            </select>
          </div>
          <div class="form-group">
            <label>Durée</label>
            <input type="text" value="${rdv.duree || 60} minutes" readonly style="background: #f8f9fa; padding: 0.75rem; border: 2px solid var(--rose-poudre); border-radius: var(--border-radius);">
            <input type="hidden" id="prestation-duree-value" value="${rdv.duree || 60}">
          </div>
        </div>
        
        <div class="form-group">
          <label>Adresse du massage</label>
          <input type="text" id="prestation-adresse-massage" value="${rdv.adresseMassage || ''}" readonly style="background: #f8f9fa; padding: 0.75rem; border: 2px solid var(--rose-poudre); border-radius: var(--border-radius);">
          <input type="hidden" id="prestation-distance" value="${rdv.distanceKm || 0}">
          <input type="hidden" id="prestation-frais" value="${rdv.fraisDeplacement || 0}">
          ${rdv.adresseMassage && rdv.distanceKm > 0 ? `
            <div style="margin-top: 0.5rem; padding: 0.5rem; background: var(--beige-clair); border-radius: 6px; border-left: 3px solid var(--beige-dore);">
              <div style="color: var(--beige-dore); font-weight: 600; font-size: 0.85rem;">📍 Distance: ${rdv.distanceKm} km</div>
              <div style="color: var(--text-dark); font-weight: 600; font-size: 0.85rem;">💰 Frais estimés: ${(rdv.fraisDeplacement || 0).toFixed(2)} € (A/R)</div>
            </div>
          ` : ''}
        </div>
        
        <div class="form-group">
          <label style="color: var(--text-dark); font-weight: 500;">💳 Moyen de paiement *</label>
          <select id="prestation-moyen-paiement" required onchange="FormManager.handleMoyenPaiementChange()" style="padding: 0.75rem; border: 1px solid #ddd; border-radius: 6px; width: 100%; font-size: 1rem; background: white;">
            <option value="">-- Sélectionnez le moyen de paiement --</option>
            <option value="Liquide">💵 Liquide</option>
            <option value="Carte bleue">💳 Carte bleue</option>
            <option value="Bon cadeau" ${rdv.bonCadeauId ? 'selected' : ''}>🎁 Bon cadeau</option>
          </select>
          <input type="hidden" id="prestation-bon-cadeau-id" value="${rdv.bonCadeauId || ''}">
          ${rdv.bonCadeauId ? (() => {
            const bonCadeau = appData.bonsCadeaux?.find(b => b.id === rdv.bonCadeauId);
            return `
            <div id="bon-cadeau-info" style="margin-top: 0.5rem; padding: 0.75rem; background: linear-gradient(135deg, #fff9e6, #fff); border-radius: 8px; border-left: 4px solid var(--beige-dore);">
              <strong>🎁 Bon cadeau lié</strong><br>
              ${bonCadeau ? `<small style="color: var(--beige-dore); font-weight: 600;">Montant : ${bonCadeau.montant} €</small><br>` : ''}
              <small style="color: var(--text-light);">Le prix sera enregistré comme "offert" (bon cadeau déjà payé).</small>
            </div>
            `;
          })() : `<small style="color: var(--text-light); font-size: 0.8rem;">💡 Méthode utilisée par le client pour régler</small>`}
        </div>

        <div class="form-row">
          <div class="form-group" id="prix-container">
            <label style="color: var(--text-dark); font-weight: 500;">💶 Prix de la prestation (€) ${rdv.bonCadeauId ? '' : '*'}</label>
            <input type="number" id="prestation-prix" step="0.01" min="0" ${rdv.bonCadeauId ? '' : 'required'} placeholder="${rdv.bonCadeauId ? 'Offert (bon cadeau)' : 'Saisissez le prix facturé au client'}" value="${rdv.bonCadeauId ? '0' : (prixAuto || '')}" style="padding: 0.75rem; border: 1px solid #ddd; border-radius: 6px; width: 100%; font-size: 1rem; ${rdv.bonCadeauId ? 'background: #f8f9fa;' : ''}">
            <small id="prix-help" style="color: var(--text-light); font-size: 0.8rem;">${rdv.bonCadeauId ? '🎁 Offert via bon cadeau (déjà payé à l\'achat)' : (isPartnership ? '💡 Prix auto-calculé (votre part)' : '💡 Montant facturé au client')}</small>
          </div>
          <div class="form-group">
            <label style="color: var(--text-dark); font-weight: 500;">💸 Tips reçus (€)</label>
            <input type="number" id="prestation-tips" step="0.01" min="0" placeholder="0.00" style="padding: 0.75rem; border: 1px solid #ddd; border-radius: 6px; width: 100%; font-size: 1rem;">
            <small style="color: var(--text-light); font-size: 0.8rem;">💝 Pourboires (optionnel)</small>
          </div>
        </div>
        
        <div class="form-group">
          <label>Notes</label>
          <textarea id="prestation-notes" placeholder="Notes sur la prestation réalisée...">${rdv.notes || ''}</textarea>
        </div>
        
        <div style="background: #f8f9fa; padding: 1rem; border-radius: 8px; margin: 1rem 0; border-left: 4px solid var(--beige-dore);">
          <strong>ℹ️ Transformation RDV → Prestation</strong><br>
          <small style="color: var(--text-light);">Le RDV sera marqué comme "transformé" et apparaîtra différemment dans le calendrier. Vous pourrez annuler cette transformation si nécessaire.</small>
        </div>
        
        <div class="modal-actions">
          <button type="button" class="btn-secondary" onclick="closeModal()">Annuler</button>
          <button type="submit" class="btn-primary">💰 Valider la prestation</button>
        </div>
      </form>
    `;
    
    ModalManager.showModal('prestation-modal', modalHTML);
    
    // Focus sur le prix
    setTimeout(() => {
      document.getElementById('prestation-prix').focus();
    }, 200);
  }, 100);
}

async function annulerTransformation(rdvId) {
  if (await showCustomConfirm('Annuler la transformation en prestation ? Le RDV retrouvera son état normal.')) {
    const success = BusinessServices.annulerTransformationRdv(rdvId);
    if (success) {
      await DataManager.saveData();
      ViewManager.updateCalendar();
      ViewManager.updatePrestationsTable();
      ViewManager.updateDashboard();
      ModalManager.closeModal();
      showTemporaryMessage('Transformation annulée');
    }
  }
}

// ===== CONVERSIONS CLIENTS ↔ PROSPECTS =====
async function convertToClient(prospectId) {
  if (await showCustomConfirm('Convertir ce prospect en client ?')) {
    const newClient = ClientServices.convertProspectToClient(prospectId);
    if (newClient) {
      await DataManager.saveData();
      ViewManager.updateClientsDisplay();
      showTemporaryMessage(`${newClient.prenom} ${newClient.nom} est maintenant client !`);
    }
  }
}

async function convertToProspect(clientId) {
  if (await showCustomConfirm('Convertir ce client en prospect ? Cela supprimera ses RDV et prestations.')) {
    const newProspect = ClientServices.convertClientToProspect(clientId);
    if (newProspect) {
      await DataManager.saveData();
      ViewManager.updateClientsDisplay();
      ViewManager.updateCalendar();
      ViewManager.updatePrestationsTable();
      ViewManager.updateDashboard();
      showTemporaryMessage(`${newProspect.prenom} ${newProspect.nom} est maintenant prospect.`);
    }
  }
}

// ===== GESTION DYNAMIQUE MOYEN DE PAIEMENT =====
function handleMoyenPaiementChange() {
  const moyenPaiement = document.getElementById('prestation-moyen-paiement');
  const prixInput = document.getElementById('prestation-prix');
  const prixHelp = document.getElementById('prix-help');
  const prixLabel = document.querySelector('#prix-container label');

  if (!moyenPaiement || !prixInput) return;

  if (moyenPaiement.value === 'Bon cadeau') {
    // Paiement par bon cadeau : prix = 0 et non requis
    prixInput.value = '0';
    prixInput.removeAttribute('required');
    prixInput.placeholder = 'Offert (bon cadeau)';
    prixInput.style.background = '#f8f9fa';
    if (prixHelp) {
      prixHelp.innerHTML = '🎁 Offert via bon cadeau (déjà payé à l\'achat)';
      prixHelp.style.color = 'var(--beige-dore)';
    }
    if (prixLabel) {
      prixLabel.innerHTML = '💶 Prix de la prestation (€)';
    }
  } else {
    // Autre moyen de paiement : prix requis
    prixInput.setAttribute('required', 'required');
    prixInput.placeholder = 'Saisissez le prix facturé au client';
    prixInput.style.background = 'white';
    if (prixInput.value === '0') {
      prixInput.value = '';
    }
    if (prixHelp) {
      prixHelp.innerHTML = '💡 Montant facturé au client';
      prixHelp.style.color = 'var(--text-light)';
    }
    if (prixLabel) {
      prixLabel.innerHTML = '💶 Prix de la prestation (€) *';
    }
  }
}

// ===== UTILITAIRES UI =====
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
      max-width: 400px;
      width: 90%;
      text-align: center;
    `;
    
    modal.innerHTML = `
      <h3 style="margin: 0 0 1rem 0; color: #333;">Confirmation</h3>
      <p style="margin: 0 0 2rem 0; color: #666; line-height: 1.5;">${message}</p>
      <div style="display: flex; gap: 1rem; justify-content: center;">
        <button id="custom-cancel" class="btn-secondary">Annuler</button>
        <button id="custom-confirm" class="btn-primary">Confirmer</button>
      </div>
    `;
    
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    
    document.getElementById('custom-cancel').onclick = () => {
      overlay.remove();
      resolve(false);
    };
    
    document.getElementById('custom-confirm').onclick = () => {
      overlay.remove();
      resolve(true);
    };
    
    overlay.onclick = (e) => {
      if (e.target === overlay) {
        overlay.remove();
        resolve(false);
      }
    };
  });
}

function showTemporaryMessage(message) {
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

// ===== EXPORTS GLOBAUX =====
window.FormManager = {
  // Édition
  editRdv,
  editPrestation,
  editClient,
  editProspect,
  editCollaborateur, // ✅ NOUVEAU
  editDepense,
  
  // Interactions calendrier
  selectCalendarDay,
  showRdvDetails,
  showPrestationDetails,
  
  // Actions
  deleteRdv,
  deletePrestation,
  deleteClient,
  deleteProspect,
  deleteCollaborateur, // ✅ NOUVEAU
  deleteDepense,
  
  // Transformations
  transformerEnPrestation,
  annulerTransformation,
  convertToClient,
  convertToProspect,
  
  // Utilitaires
  showCustomConfirm,
  showTemporaryMessage,
  handleMoyenPaiementChange
};

// Fonctions globales pour l'HTML
window.editRdv = editRdv;
window.editPrestation = editPrestation;
window.editClient = editClient;
window.editProspect = editProspect;
window.editCollaborateur = editCollaborateur; // ✅ NOUVEAU
window.editDepense = editDepense;
window.selectCalendarDay = selectCalendarDay;
window.showRdvDetails = showRdvDetails;
window.showPrestationDetails = showPrestationDetails;
window.deleteRdv = deleteRdv;
window.deletePrestation = deletePrestation;
window.deleteClient = deleteClient;
window.deleteProspect = deleteProspect;
window.deleteCollaborateur = deleteCollaborateur; // ✅ NOUVEAU
window.deleteDepense = deleteDepense;
window.transformerEnPrestation = transformerEnPrestation;
window.annulerTransformation = annulerTransformation;
window.convertToClient = convertToClient;
window.convertToProspect = convertToProspect;
window.showCustomConfirm = showCustomConfirm;
window.showTemporaryMessage = showTemporaryMessage;

// ===== ✅ EXPORTS GLOBAUX POUR LES TAGS COLLABORATEURS =====
window.addTagToCollaborateur = addTagToCollaborateur;
window.removeTagFromCollaborateur = removeTagFromCollaborateur;
window.initCollaborateurTagsSystem = initCollaborateurTagsSystem;

