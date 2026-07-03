// ===== js/services/client-services.js =====
// Gestion des clients et prospects avec système de parrainage

// ===== GESTION CLIENTS =====
function getClientStats(clientId) {
  const appData = DataManager.getAppData();
  const prestationsClient = appData.prestations.filter(p => p.clientId === clientId);
  const rdvClient = appData.rdv.filter(r => r.clientId === clientId);
  const rdvAnnules = rdvClient.filter(r => r.statut === 'annulé').length;
  const totalMassages = prestationsClient.length;
  
  // Calcul des revenus
  const revenusTotal = prestationsClient.reduce((sum, p) => sum + (p.prix || 0), 0);
  const revenuMoyen = totalMassages > 0 ? (revenusTotal / totalMassages) : 0;
  
  // Dernière visite
  const derniereVisite = prestationsClient.length > 0 
    ? prestationsClient.sort((a, b) => new Date(b.date) - new Date(a.date))[0].date
    : null;
  
  return {
    totalMassages,
    rdvAnnules,
    revenusTotal,
    revenuMoyen,
    derniereVisite
  };
}

async function createClient(formData, type = 'client') {
  const appData = DataManager.getAppData();

  const client = {
    id: formData.id || DataManager.generateId(),
    nom: formData.nom,
    prenom: formData.prenom,
    societe: formData.societe,
    telephone: formData.telephone,
    email: formData.email,
    adresse: formData.adresse,
    ville: formData.ville || '',
    notes: formData.notes,
    parrain: formData.parrain || null,
    canalAcquisition: formData.canalAcquisition || 'non-renseigne',
    dateAcquisition: formData.dateAcquisition || new Date().toISOString().split('T')[0],
    sexe: formData.sexe || '',
    createdAt: formData.createdAt || new Date().toISOString()
  };

  if (type === 'client') {
    client.huiles = formData.huiles;
    client.zones = formData.zones;
    client.allergies = formData.allergies;
    client.pression = formData.pression;

    if (formData.id && DataManager.getEditingId()) {
      const index = appData.clients.findIndex(c => c.id === DataManager.getEditingId());
      if (index !== -1) {
        appData.clients[index] = client;
        try { await DataManager.updateEntity('clients', client.id, client, DataManager.mapClientToDb); } catch(e) { console.error('Erreur update client:', e); }
      }
    } else {
      appData.clients.push(client);
      try { await DataManager.insertEntity('clients', client, DataManager.mapClientToDb); } catch(e) { console.error('Erreur insert client:', e); }
    }
  } else {
    client.statut = formData.statut;
    client.actions = formData.actions;

    if (formData.id && DataManager.getEditingId()) {
      const index = appData.prospects.findIndex(p => p.id === DataManager.getEditingId());
      if (index !== -1) {
        appData.prospects[index] = client;
        try { await DataManager.updateEntity('prospects', client.id, client, DataManager.mapProspectToDb); } catch(e) { console.error('Erreur update prospect:', e); }
      }
    } else {
      appData.prospects.push(client);
      try { await DataManager.insertEntity('prospects', client, DataManager.mapProspectToDb); } catch(e) { console.error('Erreur insert prospect:', e); }
    }
  }

  return client;
}

async function deleteClientById(clientId) {
  const appData = DataManager.getAppData();
  // Supprimer les RDV et prestations associes d'abord
  const rdvsToDelete = appData.rdv.filter(r => r.clientId === clientId);
  const prestationsToDelete = appData.prestations.filter(p => p.clientId === clientId);
  appData.clients = appData.clients.filter(c => c.id !== clientId);
  appData.rdv = appData.rdv.filter(r => r.clientId !== clientId);
  appData.prestations = appData.prestations.filter(p => p.clientId !== clientId);

  try {
    for (const r of rdvsToDelete) await DataManager.deleteEntity('rdv', r.id);
    for (const p of prestationsToDelete) await DataManager.deleteEntity('prestations', p.id);
    await DataManager.deleteEntity('clients', clientId);
  } catch(e) { console.error('Erreur delete client:', e); }
}

async function deleteProspectById(prospectId) {
  const appData = DataManager.getAppData();
  appData.prospects = appData.prospects.filter(p => p.id !== prospectId);
  try { await DataManager.deleteEntity('prospects', prospectId); } catch(e) { console.error('Erreur delete prospect:', e); }
}

async function convertProspectToClient(prospectId) {
  const appData = DataManager.getAppData();
  const prospect = appData.prospects.find(p => p.id === prospectId);
  if (!prospect) return null;

  const newClient = {
    id: DataManager.generateId(),
    nom: prospect.nom,
    prenom: prospect.prenom,
    societe: prospect.societe,
    telephone: prospect.telephone,
    email: prospect.email,
    adresse: prospect.adresse,
    notes: prospect.notes,
    parrain: prospect.parrain || null,
    huiles: '',
    zones: '',
    allergies: '',
    pression: 'moyenne'
  };

  appData.clients.push(newClient);
  appData.prospects = appData.prospects.filter(p => p.id !== prospectId);

  try {
    await DataManager.insertEntity('clients', newClient, DataManager.mapClientToDb);
    await DataManager.deleteEntity('prospects', prospectId);
  } catch(e) { console.error('Erreur conversion prospect->client:', e); }

  return newClient;
}

async function convertClientToProspect(clientId) {
  const appData = DataManager.getAppData();
  const client = appData.clients.find(c => c.id === clientId);
  if (!client) return null;

  const newProspect = {
    id: DataManager.generateId(),
    nom: client.nom,
    prenom: client.prenom,
    societe: client.societe,
    telephone: client.telephone,
    email: client.email,
    adresse: client.adresse,
    notes: client.notes,
    parrain: client.parrain || null,
    statut: 'interet moyen',
    actions: { email: false, emailDate: '', telephone: false, telephoneDate: '', relance: false, relanceDate: '' }
  };

  const rdvsToDelete = appData.rdv.filter(r => r.clientId === clientId);
  const prestationsToDelete = appData.prestations.filter(p => p.clientId === clientId);

  appData.prospects.push(newProspect);
  appData.clients = appData.clients.filter(c => c.id !== clientId);
  appData.rdv = appData.rdv.filter(r => r.clientId !== clientId);
  appData.prestations = appData.prestations.filter(p => p.clientId !== clientId);

  try {
    await DataManager.insertEntity('prospects', newProspect, DataManager.mapProspectToDb);
    for (const r of rdvsToDelete) await DataManager.deleteEntity('rdv', r.id);
    for (const p of prestationsToDelete) await DataManager.deleteEntity('prestations', p.id);
    await DataManager.deleteEntity('clients', clientId);
  } catch(e) { console.error('Erreur conversion client->prospect:', e); }

  return newProspect;
}

function getTopClients(limit = 10) {
  const appData = DataManager.getAppData();
  const clientsRevenus = appData.clients.map(client => {
    const stats = getClientStats(client.id);
    return {
      id: client.id,
      nom: `${client.prenom} ${client.nom}`,
      revenus: stats.revenusTotal,
      massages: stats.totalMassages,
      revenuMoyen: stats.revenuMoyen
    };
  });
  
  // Trier par revenus décroissants
  return clientsRevenus
    .filter(c => c.revenus > 0)
    .sort((a, b) => b.revenus - a.revenus)
    .slice(0, limit);
}

// ✅ NOUVELLES FONCTIONS : Gestion du parrainage
function getParrainInfo(parrainId) {
  if (!parrainId) return null;
  
  const appData = DataManager.getAppData();
  const parrain = appData.clients.find(c => c.id === parrainId);
  return parrain ? {
    id: parrain.id,
    nom: `${parrain.prenom} ${parrain.nom}`,
    prenom: parrain.prenom,
    nomComplet: parrain.nom
  } : null;
}

function getFilleuls(parrainId) {
  const appData = DataManager.getAppData();
  
  // Chercher dans les clients
  const filleulesClients = appData.clients.filter(c => c.parrain === parrainId);
  
  // Chercher dans les prospects
  const filleulesProspects = appData.prospects.filter(p => p.parrain === parrainId);
  
  return {
    clients: filleulesClients,
    prospects: filleulesProspects,
    total: filleulesClients.length + filleulesProspects.length
  };
}

function generateParrainageSection(client) {
  let html = '';
  
  // Affichage du parrain si présent
  if (client.parrain) {
    const parrainInfo = getParrainInfo(client.parrain);
    if (parrainInfo) {
      html += `
        <div style="margin: 1rem 0; padding: 0.75rem; background: #e3f2fd; border-radius: 8px; border-left: 3px solid #2196f3;">
          <strong>🤝 Parrain :</strong> 
          <span style="color: #1976d2; cursor: pointer; text-decoration: underline;" onclick="showClientDetails('${parrainInfo.id}')" title="Cliquer pour voir la fiche du parrain">
            ${parrainInfo.nom}
          </span>
        </div>
      `;
    }
  }
  
  // Affichage des filleuls si présents
  const filleuls = getFilleuls(client.id);
  if (filleuls.total > 0) {
    html += `
      <div style="margin: 1rem 0; padding: 0.75rem; background: #f3e5f5; border-radius: 8px; border-left: 3px solid #9c27b0;">
        <strong>👥 Filleuls parrainés (${filleuls.total}) :</strong>
        <div style="margin-top: 0.5rem;">
    `;
    
    // Filleuls clients
    if (filleuls.clients.length > 0) {
      html += `
        <div style="margin-bottom: 0.5rem;">
          <strong style="color: #7b1fa2;">Clients (${filleuls.clients.length}) :</strong>
          <div style="margin-left: 1rem;">
            ${filleuls.clients.map(filleul => `
              <span style="color: #7b1fa2; cursor: pointer; text-decoration: underline; margin-right: 1rem;" onclick="showClientDetails('${filleul.id}')" title="Cliquer pour voir la fiche">
                ${filleul.prenom} ${filleul.nom}
              </span>
            `).join('')}
          </div>
        </div>
      `;
    }
    
    // Filleuls prospects
    if (filleuls.prospects.length > 0) {
      html += `
        <div>
          <strong style="color: #7b1fa2;">Prospects (${filleuls.prospects.length}) :</strong>
          <div style="margin-left: 1rem;">
            ${filleuls.prospects.map(filleul => `
              <span style="color: #7b1fa2; cursor: pointer; text-decoration: underline; margin-right: 1rem;" onclick="showProspectDetails('${filleul.id}')" title="Cliquer pour voir la fiche">
                ${filleul.prenom} ${filleul.nom}
              </span>
            `).join('')}
          </div>
        </div>
      `;
    }
    
    html += `
        </div>
      </div>
    `;
  }
  
  return html;
}

// ===== RECHERCHE CLIENTS =====
function setupClientSearch() {
  const searchInput = document.getElementById('client-search');
  const clearBtn = document.getElementById('clear-search');
  const resultCount = document.getElementById('search-results-count');
  const canalFilter = document.getElementById('client-canal-filter');
  
  if (!searchInput) return;
  
  // Populer le dropdown des canaux
  if (canalFilter) {
    const canaux = ClientServices.getAvailableCanaux();
    canaux.forEach(canal => {
      const option = document.createElement('option');
      option.value = canal.id;
      option.textContent = canal.label;
      canalFilter.appendChild(option);
    });
    
    // Event listener pour le filtre canal
    canalFilter.addEventListener('change', () => {
      const query = searchInput.value.toLowerCase().trim();
      if (query === '' && canalFilter.value === '') {
        ViewManager.updateClientsDisplay();
        resultCount.textContent = '';
      } else {
        filterAndDisplayClients(query);
      }
    });
  }
  
  searchInput.addEventListener('input', (e) => {
    const query = e.target.value.toLowerCase().trim();
    
    if (query === '') {
      // Afficher tous les clients
      ViewManager.updateClientsDisplay();
      clearBtn.style.display = 'none';
      resultCount.textContent = '';
      return;
    }
    
    // Afficher le bouton clear
    clearBtn.style.display = 'block';
    
    // Filtrer et afficher les résultats
    filterAndDisplayClients(query);
  });
  
  clearBtn.addEventListener('click', () => {
    searchInput.value = '';
    clearBtn.style.display = 'none';
    resultCount.textContent = '';
    ViewManager.updateClientsDisplay();
    searchInput.focus();
  });
}

function filterAndDisplayClients(query) {
  const appData = DataManager.getAppData();
  
  // Récupérer le filtre canal
  const canalFilter = document.getElementById('client-canal-filter')?.value || '';
  
  // Filtrer tous les clients et prospects
  const matchingClients = appData.clients.filter(client => {
    // Normaliser la requête (minuscules + suppression accents)
    const normalizedQuery = query.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    
    // Normaliser les champs du client
    const normalizedNom = (client.nom || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    const normalizedPrenom = (client.prenom || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    const normalizedSociete = (client.societe || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    const normalizedEmail = (client.email || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    
    // Recherche textuelle
    const numericQuery = query.replace(/[^0-9+]/g, '');
    const matchesSearch = normalizedNom.includes(normalizedQuery) ||
      normalizedPrenom.includes(normalizedQuery) ||
      normalizedSociete.includes(normalizedQuery) ||
      (numericQuery.length > 0 && client.telephone && client.telephone.replace(/[^0-9+]/g, '').includes(numericQuery)) ||
      normalizedEmail.includes(normalizedQuery);

    // Filtre canal
    const matchesCanal = !canalFilter || client.canalAcquisition === canalFilter;

    return matchesSearch && matchesCanal;
  });

  const matchingProspects = appData.prospects.filter(prospect => {
    // Normaliser la requête
    const normalizedQuery = query.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    const numericQuery = query.replace(/[^0-9+]/g, '');

    // Normaliser les champs du prospect
    const normalizedNom = (prospect.nom || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    const normalizedPrenom = (prospect.prenom || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    const normalizedSociete = (prospect.societe || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    const normalizedEmail = (prospect.email || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

    // Recherche textuelle
    const matchesSearch = normalizedNom.includes(normalizedQuery) ||
      normalizedPrenom.includes(normalizedQuery) ||
      normalizedSociete.includes(normalizedQuery) ||
      (numericQuery.length > 0 && prospect.telephone && prospect.telephone.replace(/[^0-9+]/g, '').includes(numericQuery)) ||
      normalizedEmail.includes(normalizedQuery);
    
    // Filtre canal
    const matchesCanal = !canalFilter || prospect.canalAcquisition === canalFilter;
    
    return matchesSearch && matchesCanal;
  });
  
  // Filtrer les collaborateurs
  const matchingCollaborateurs = (appData.collaborateurs || []).filter(collaborateur => {
    const normalizedQuery = query.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    const numericQuery = query.replace(/[^0-9+]/g, '');
    const normalizedNom = (collaborateur.nom || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    const normalizedPrenom = (collaborateur.prenom || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    const normalizedEntreprise = (collaborateur.entreprise || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    const normalizedSpecialites = (collaborateur.specialites || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    const normalizedEmail = (collaborateur.email || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

    return normalizedNom.includes(normalizedQuery) ||
      normalizedPrenom.includes(normalizedQuery) ||
      normalizedEntreprise.includes(normalizedQuery) ||
      normalizedSpecialites.includes(normalizedQuery) ||
      (numericQuery.length > 0 && collaborateur.telephone && collaborateur.telephone.replace(/[^0-9+]/g, '').includes(numericQuery)) ||
      normalizedEmail.includes(normalizedQuery) ||
      (collaborateur.tags && collaborateur.tags.some(tag => 
        tag.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().includes(normalizedQuery)
      ));
  });
  
  // Séparer les clients trouvés en fidèles/nouveaux
  const clientsFidelesFiltered = [];
  const nouveauxClientsFiltered = [];
  
  matchingClients.forEach(client => {
    const stats = getClientStats(client.id);
    if (stats.totalMassages >= 2) {
      clientsFidelesFiltered.push({ client, stats });
    } else {
      nouveauxClientsFiltered.push({ client, stats });
    }
  });
  
  displayFilteredClients(clientsFidelesFiltered, nouveauxClientsFiltered, matchingProspects, matchingCollaborateurs);
  
  // Mettre à jour le compteur
  const totalResults = matchingClients.length + matchingProspects.length + matchingCollaborateurs.length;
  const resultCount = document.getElementById('search-results-count');
  if (totalResults === 0) {
    resultCount.innerHTML = '<span style="color: #e74c3c;">❌ Aucun résultat trouvé</span>';
  } else {
    resultCount.innerHTML = `<span style="color: var(--beige-dore);">📊 ${totalResults} résultat${totalResults > 1 ? 's' : ''} trouvé${totalResults > 1 ? 's' : ''}</span>`;
  }
}

function displayFilteredClients(clientsFideles, nouveauxClients, prospects, collaborateurs = []) {
  const clientsFidelesContainer = document.getElementById('clients-fideles-list');
  const clientsContainer = document.getElementById('clients-list');
  const prospectsContainer = document.getElementById('prospects-list');
  const collaborateursContainer = document.getElementById('collaborateurs-list'); // ✅ NOUVEAU
  
  // ... code existant pour clients fidèles et nouveaux clients ...
  
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
    prospectsContainer.innerHTML = prospects.map(prospect => {
      const parrainInfo = prospect.parrain ? getParrainInfo(prospect.parrain) : null;
      const parrainDisplay = parrainInfo ? 
        `<div>🤝 <span style="color: #1976d2; cursor: pointer; text-decoration: underline;" onclick="showClientDetails('${parrainInfo.id}')" title="Cliquer pour voir la fiche du parrain">${parrainInfo.nom}</span></div>` : 
        '';
      
      return `
        <div class="client-card">
          <div class="client-header">
            <div class="client-name">${prospect.prenom} ${prospect.nom}</div>
            <div class="client-actions">
              <button class="btn-secondary" onclick="editProspect('${prospect.id}')">Éditer</button>
              <button class="btn-danger" onclick="deleteProspect('${prospect.id}')">Supprimer</button>
              <button class="btn-primary" onclick="convertToClient('${prospect.id}')">→ Client</button>
            </div>
          </div>
          <div class="client-info">
            ${prospect.societe ? `<div><strong>🏢 ${prospect.societe}</strong></div>` : ''}
            ${prospect.telephone ? `<div>📞 ${prospect.telephone}</div>` : ''}
            ${prospect.email ? `<div>✉️ ${prospect.email}</div>` : ''}
            ${prospect.adresse ? `<div>📍 ${prospect.adresse}</div>` : ''}
            ${parrainDisplay}
            <div class="prospect-statut ${prospect.statut ? prospect.statut.replace(/\s+/g, '-') : ''}">${prospect.statut || 'Non défini'}</div>
            ${prospect.actions ? `<div><strong>Actions:</strong><br>${DataManager.formatActions(prospect.actions)}</div>` : ''}
            ${prospect.notes ? `<div><strong>Notes:</strong> ${prospect.notes}</div>` : ''}
          </div>
        </div>
      `;
    }).join('');
  }
  
  // ✅ NOUVEAU : Afficher les collaborateurs filtrés
  if (!collaborateursContainer) return; // Si pas de conteneur collaborateurs, sortir
  
if (collaborateurs.length === 0) {
  collaborateursContainer.innerHTML = '<div style="text-align: center; padding: 2rem; color: var(--text-light);">Aucun collaborateur trouvé</div>';
} else {
    collaborateursContainer.innerHTML = collaborateurs.map(collaborateur => {
      // Utiliser le système de tags unifié
      const tagsHtml = window.ClientServices && ClientServices.generateTagsHTML ? 
        ClientServices.generateTagsHTML(collaborateur.tags || [], true, collaborateur.id, 'collaborateur') : 
        generateFallbackTagsHTML(collaborateur.tags || []);
      
      return `
        <div class="collaborateur-card">
          <div class="collaborateur-header">
            <div>
              <div class="collaborateur-name">${collaborateur.prenom} ${collaborateur.nom}</div>
              ${collaborateur.specialites ? 
                `<div class="collaborateur-specialite">🎯 ${collaborateur.specialites}</div>` : 
                ''
              }
            </div>
          </div>
          
          <div class="collaborateur-info">
            ${collaborateur.entreprise ? `<div>🏢 ${collaborateur.entreprise}</div>` : ''}
            ${collaborateur.telephone ? `<div>📞 ${collaborateur.telephone}</div>` : ''}
            ${collaborateur.email ? `<div>✉️ ${collaborateur.email}</div>` : ''}
            ${collaborateur.adresse ? `<div>📍 ${collaborateur.adresse}</div>` : ''}
            ${collaborateur.tarif ? `<div>💶 ${collaborateur.tarif} €</div>` : ''}
            ${collaborateur.notes ? `<div><strong>Notes:</strong> ${collaborateur.notes}</div>` : ''}
          </div>
          
          <div class="collaborateur-tags">
            <strong>🏷️ Tags:</strong>
            ${tagsHtml}
          </div>
          
          <div class="collaborateur-actions">
            <button class="btn-secondary" onclick="FormManager.editCollaborateur('${collaborateur.id}')">
              ✏️ Éditer
            </button>
            <button class="btn-danger" onclick="FormManager.deleteCollaborateur('${collaborateur.id}')">
              🗑️ Supprimer
            </button>
          </div>
        </div>
      `;
    }).join('');
  }
}

// ===== DÉTAILS CLIENT =====
function showClientDetails(clientId) {
  const appData = DataManager.getAppData();
  const client = appData.clients.find(c => c.id === clientId);
  if (!client) return;

  const stats = getClientStats(clientId);

  // v1.0.9.0 : badge fidelite (palier non-vu) + info opt-out
  let fideliteBadge = '';
  if (client.sansFidelite) {
    fideliteBadge = `
      <div style="margin: 0.75rem 0; padding: 0.6rem 0.9rem; background: #f0f0f0; border-radius: 8px; font-size: 0.85rem; color: #666; border-left: 3px solid #999;">
        \u{1f6ab} Ce client est exclu du suivi fidélité (paramétrage sur sa fiche).
      </div>
    `;
  } else if (typeof DataManager.getFidelitePalierPourClient === 'function') {
    const palierNonVu = DataManager.getFidelitePalierPourClient(client.id, 0);
    if (palierNonVu) {
      fideliteBadge = `
        <div style="margin: 0.75rem 0; padding: 0.75rem 1rem; background: linear-gradient(135deg, #fff3e0, #ffe4b5); border-radius: 8px; border-left: 4px solid #b8860b; display: flex; align-items: center; justify-content: space-between; gap: 0.75rem; flex-wrap: wrap;">
          <div>
            <div style="font-weight: 600; color: #8b6914; margin-bottom: 0.2rem;">\u{1f381} ${palierNonVu}<sup>ème</sup> massage — à féliciter</div>
            <div style="font-size: 0.8rem; color: #8b6914;">Pense à lui offrir une réduction ou du temps supplémentaire.</div>
          </div>
          <div style="display: flex; gap: 0.4rem; flex-wrap: wrap;">
            <button type="button" onclick="markFideliteFromFiche('${client.id}', ${palierNonVu}, 'felicite')" class="btn-primary" style="background: linear-gradient(135deg, #b8860b, #d4a574); border: none; padding: 0.4rem 0.75rem; font-size: 0.85rem;">✨ Félicité</button>
            <button type="button" onclick="markFideliteFromFiche('${client.id}', ${palierNonVu}, 'ignore')" class="btn-secondary" style="padding: 0.4rem 0.75rem; font-size: 0.85rem;">\u{1f645} Passer</button>
          </div>
        </div>
      `;
    }
  }

  const modalHTML = `
    <h3>Fiche client</h3>
    ${fideliteBadge}
    <div style="margin: 1rem 0;">
      <p><strong>Nom:</strong> ${client.prenom} ${client.nom}</p>
      ${client.societe ? `<p><strong>Société:</strong> ${client.societe}</p>` : ''}
      ${client.telephone ? `<p><strong>Téléphone:</strong> ${client.telephone}</p>` : ''}
      ${client.email ? `<p><strong>Email:</strong> ${client.email}</p>` : ''}
      ${client.adresse ? `<p><strong>Adresse:</strong> ${client.adresse}</p>` : ''}
      ${client.huiles ? `<p><strong>Huiles préférées:</strong> ${client.huiles}</p>` : ''}
      ${client.allergies ? `<p><strong>Allergies:</strong> ${client.allergies}</p>` : ''}
      ${client.pression ? `<p><strong>Pression:</strong> ${client.pression}</p>` : ''}
      ${client.notes ? `<p><strong>Notes:</strong> ${client.notes}</p>` : ''}
      ${client.sexe ? `<p><strong>Sexe:</strong> ${client.sexe === 'H' ? 'Homme' : 'Femme'}</p>` : ''}
      
      ${generateParrainageSection(client)}
      
      <div style="margin-top: 1.5rem; padding: 1rem; background: #f8f9fa; border-radius: 8px;">
        <strong>📊 Statistiques & Revenus</strong><br>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-top: 0.5rem;">
          <div>
            <strong>Massages effectués:</strong> ${stats.totalMassages}<br>
            <strong>Revenus total:</strong> <span style="color: var(--beige-dore); font-weight: 600;">${stats.revenusTotal.toFixed(2)} €</span><br>
            <strong>Revenu moyen/séance:</strong> ${stats.revenuMoyen.toFixed(2)} €
          </div>
          <div>
            ${stats.rdvAnnules > 0 ? `<strong>RDV annulés:</strong> ${stats.rdvAnnules}<br>` : ''}
            ${stats.derniereVisite ? `<strong>Dernière visite:</strong> ${DataManager.formatDate(stats.derniereVisite)}` : '<em>Aucune visite enregistrée</em>'}
          </div>
        </div>
      </div>
      
      ${generateClientHistorique(clientId)}
    </div>
    <div class="modal-actions" style="margin-top: 1rem;">
      <button class="btn-secondary" onclick="editClient('${client.id}')">Éditer</button>
      <button class="btn-primary" onclick="showTopClientsModal()">Voir classement clients</button>
      <button type="button" class="btn-secondary" onclick="ModalManager.closeModal()">Fermer</button>
    </div>
    ${(client.fideliteAtteinte && client.fideliteAtteinte.length > 0) ? `
    <div style="margin-top: 0.75rem; padding-top: 0.75rem; border-top: 1px solid #eee; display: flex; align-items: center; justify-content: space-between; font-size: 0.8rem; color: var(--text-light);">
      <span>\u{1f381} Paliers fidélité déjà vus : ${client.fideliteAtteinte.join(', ')}</span>
      <button type="button" onclick="resetFideliteFromFiche('${client.id}')" style="background: none; border: none; color: #999; text-decoration: underline; cursor: pointer; font-size: 0.78rem;">Réinitialiser</button>
    </div>` : ''}
  `;

  // Utiliser le modal manager pour afficher
  if (window.ModalManager) {
    ModalManager.showModal('rdv-modal', modalHTML);
  } else {
    alert('Détails client: ' + client.prenom + ' ' + client.nom);
  }
}

// v1.0.9.0 : actions fidelite depuis la fiche client
async function markFideliteFromFiche(clientId, palier, action) {
  try {
    await DataManager.markFidelitePalierVu(clientId, palier);
    if (window.ViewManager && typeof window.ViewManager.updateDashboard === 'function') {
      window.ViewManager.updateDashboard();
    }
    showClientDetails(clientId); // reload la fiche
    const label = action === 'felicite' ? `✨ Palier ${palier} félicité !` : `\u{1f645} Palier ${palier} passé.`;
    if (typeof window.showTemporaryMessage === 'function') window.showTemporaryMessage(label);
  } catch (err) {
    console.error('markFideliteFromFiche error:', err);
    alert('Erreur lors du marquage du palier');
  }
}

async function resetFideliteFromFiche(clientId) {
  if (!confirm('Réinitialiser tous les paliers de fidélité vus pour ce client ? Les alertes des paliers déjà atteints se re-déclencheront.')) return;
  try {
    await DataManager.resetFideliteForClient(clientId);
    if (window.ViewManager && typeof window.ViewManager.updateDashboard === 'function') {
      window.ViewManager.updateDashboard();
    }
    showClientDetails(clientId);
    if (typeof window.showTemporaryMessage === 'function') window.showTemporaryMessage('\u{1f501} Fidélité réinitialisée.');
  } catch (err) {
    console.error('resetFideliteFromFiche error:', err);
    alert('Erreur lors de la réinitialisation');
  }
}

function showTopClientsModal() {
  const topClients = getTopClients(10);
  
  if (topClients.length === 0) {
    alert('Aucun client avec des revenus enregistrés.');
    return;
  }
  
  const modalHTML = `
    <h3>🏆 Top Clients par Revenus</h3>
    <div style="margin: 1rem 0;">
      <div class="top-clients-list">
        ${topClients.map((client, index) => `
          <div class="top-client-item ${index < 3 ? 'podium' : ''}" style="
            display: flex; 
            justify-content: space-between; 
            align-items: center; 
            padding: 0.75rem; 
            margin: 0.5rem 0; 
            background: ${index === 0 ? '#fff9e6' : index === 1 ? '#f0f8ff' : index === 2 ? '#f5f0ff' : '#f8f9fa'}; 
            border-radius: 8px;
            border-left: 4px solid ${index === 0 ? '#f39c12' : index === 1 ? '#3498db' : index === 2 ? '#9b59b6' : '#bdc3c7'};
          ">
            <div style="display: flex; align-items: center; gap: 0.5rem;">
              <span style="font-weight: 600; font-size: 1.1rem; color: ${index === 0 ? '#f39c12' : index === 1 ? '#3498db' : index === 2 ? '#9b59b6' : '#7f8c8d'};">
                ${index + 1}.
              </span>
              <span style="font-weight: 600;">${client.nom}</span>
            </div>
            <div style="text-align: right;">
              <div style="font-size: 1.1rem; font-weight: 600; color: var(--beige-dore);">
                ${client.revenus.toFixed(2)} €
              </div>
              <div style="font-size: 0.85rem; color: var(--text-light);">
                ${client.massages} séance${client.massages > 1 ? 's' : ''} • ${client.revenuMoyen.toFixed(2)} €/séance
              </div>
            </div>
          </div>
        `).join('')}
      </div>
      
      ${topClients.length > 0 ? `
        <div style="margin-top: 1.5rem; padding: 1rem; background: #e8f5e8; border-radius: 8px;">
          <strong>💡 Résumé:</strong><br>
          <small>
            • Meilleur client: <strong>${topClients[0].nom}</strong> avec ${topClients[0].revenus.toFixed(2)} €<br>
            • Revenus total top 3: <strong>${topClients.slice(0, 3).reduce((sum, c) => sum + c.revenus, 0).toFixed(2)} €</strong>
          </small>
        </div>
      ` : ''}
    </div>
    <div class="modal-actions" style="margin-top: 1rem;">
      <button type="button" class="btn-secondary" onclick="ModalManager.closeModal()">Fermer</button>
    </div>
  `;
  
  if (window.ModalManager) {
    ModalManager.showModal('rdv-modal', modalHTML);
  } else {
    console.log('Top clients:', topClients);
    alert('Top clients - voir console');
  }
}

// ===== HISTORIQUE CLIENT =====
function generateClientHistorique(clientId) {
  const appData = DataManager.getAppData();
  
  // Récupérer toutes les prestations du client
  const prestationsClient = appData.prestations
    .filter(p => p.clientId === clientId)
    .sort((a, b) => new Date(b.date + ' ' + b.heure) - new Date(a.date + ' ' + a.heure)); // Plus récent en premier
  
  if (prestationsClient.length === 0) {
    return `
      <div style="margin-top: 1.5rem; padding: 1rem; background: #fff3cd; border-radius: 8px; border: 1px solid #ffeaa7;">
        <strong>📋 Historique des prestations</strong><br>
        <div style="margin-top: 0.5rem; color: #856404; font-style: italic;">
          Aucune prestation enregistrée pour ce client
        </div>
      </div>
    `;
  }
  
  // Calculer les statistiques des tips
  const totalTips = prestationsClient.reduce((sum, p) => sum + (p.tips || 0), 0);
  const prestationsAvecTips = prestationsClient.filter(p => p.tips && p.tips > 0);
  const tipsStats = prestationsAvecTips.length > 0 ? {
    total: totalTips,
    count: prestationsAvecTips.length,
    moyenne: totalTips / prestationsAvecTips.length,
    pourcentage: (prestationsAvecTips.length / prestationsClient.length) * 100
  } : null;
  
  return `
    <div style="margin-top: 1.5rem; padding: 1rem; background: #e8f5e8; border-radius: 8px; border: 1px solid #c3e6cb;">
      <strong>📋 Historique des prestations (${prestationsClient.length})</strong>
      
      ${tipsStats ? `
        <div style="margin: 0.75rem 0; padding: 0.75rem; background: #f8f9fa; border-radius: 6px; border-left: 4px solid #28a745;">
          <strong>💸 Statistiques tips :</strong><br>
          <div style="font-size: 0.85rem; color: #155724; margin-top: 0.25rem;">
            • Total donné : <strong>${tipsStats.total.toFixed(2)} €</strong><br>
            • Tips donnés : <strong>${tipsStats.count}</strong> fois sur ${prestationsClient.length} séances (${tipsStats.pourcentage.toFixed(1)}%)<br>
            • Moyenne par tips : <strong>${tipsStats.moyenne.toFixed(2)} €</strong>
          </div>
        </div>
      ` : ''}
      
      <div style="margin-top: 0.75rem; max-height: 200px; overflow-y: auto;">
        ${prestationsClient.map(prestation => {
          const prix = prestation.prix || 0;
          const tips = prestation.tips || 0;
          const total = prix + tips;
          
          return `
            <div class="historique-item" onclick="showPrestationDetailsFromHistory('${prestation.id}')" style="
              display: flex; 
              justify-content: space-between; 
              align-items: center;
              padding: 0.4rem 0.6rem; 
              margin: 0.25rem 0; 
              background: white; 
              border-radius: 6px; 
              cursor: pointer;
              font-size: 0.85rem;
              border: 1px solid #e9ecef;
              transition: all 0.2s ease;
            ">
              <div style="display: flex; align-items: center; gap: 0.5rem;">
                <span style="font-weight: 600; color: var(--beige-dore);">${DataManager.formatDate(prestation.date)}</span>
                <span style="color: #495057;">${prestation.type}</span>
                <span style="color: #6c757d; font-size: 0.8rem;">${prestation.duree || 60}min</span>
              </div>
              <div style="text-align: right;">
                <div style="font-weight: 600; color: #28a745;">
                  ${prix.toFixed(2)} €${tips > 0 ? ` + ${tips.toFixed(2)} €` : ''}
                </div>
                ${tips > 0 ? `<div style="font-size: 0.7rem; color: #6c757d;">Total: ${total.toFixed(2)} €</div>` : ''}
              </div>
            </div>
          `;
        }).join('')}
      </div>
      <div style="margin-top: 0.5rem; padding-top: 0.5rem; border-top: 1px solid #c3e6cb; font-size: 0.8rem; color: #155724;">
        💡 Cliquez sur une ligne pour voir les détails de la prestation
      </div>
    </div>
  `;
}

function showPrestationDetailsFromHistory(prestationId) {
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
    <h3>💆‍♀️ Détails de la prestation</h3>
    <div style="margin: 1rem 0; padding: 1rem; background: #e8f5e8; border-radius: 8px; border-left: 4px solid var(--beige-dore);">
      <p><strong>👤 Client:</strong> ${clientNom}</p>
      <p><strong>📅 Date:</strong> ${DataManager.formatDate(prestation.date)} à ${prestation.heure}</p>
      <p><strong>💆‍♀️ Type:</strong> ${prestation.type}</p>
      <p><strong>⏱️ Durée:</strong> ${prestation.duree || 60} minutes</p>
      <p><strong>💶 Prix facturé:</strong> ${prix.toFixed(2)} €</p>
      ${fraisHtml}
      ${prestation.notes ? `<p><strong>📝 Notes:</strong> ${prestation.notes}</p>` : ''}
      
      ${prestation.isTransformed ? `
        <div style="margin-top: 1rem; padding: 0.75rem; background: #fff3cd; border-radius: 6px; border: 1px solid #ffeaa7;">
          <strong>ℹ️ Info:</strong> Cette prestation a été créée à partir d'un RDV transformé.
        </div>
      ` : ''}
    </div>
    <div class="rdv-actions">
      <button class="btn-secondary" onclick="editPrestationFromHistory('${prestation.id}')">✏️ Modifier la prestation</button>
      <button class="btn-danger" onclick="deletePrestationFromHistory('${prestation.id}')">🗑️ Supprimer la prestation</button>
      <button class="btn-secondary" onclick="closeModal(); ClientServices.showClientDetails('${prestation.clientId}')">👤 Retour au client</button>
    </div>
    <div class="modal-actions" style="margin-top: 1rem;">
      <button type="button" class="btn-secondary" onclick="closeModal()">Fermer</button>
    </div>
  `;
  
  ModalManager.showModal('prestation-details-modal', modalHTML);
}

function editPrestationFromHistory(prestationId) {
  closeModal(); // Fermer la modal actuelle
  
  // Ouvrir la modal d'édition de prestation
  setTimeout(() => {
    if (window.FormManager && typeof window.FormManager.editPrestation === 'function') {
      FormManager.editPrestation(prestationId);
    } else {
      // Fallback si FormManager n'est pas disponible
      showCustomAlert('❌ Impossible d\'éditer la prestation', 'error');
    }
  }, 200);
}

async function deletePrestationFromHistory(prestationId) {
  const prestation = DataManager.getPrestationById(prestationId);
  if (!prestation) return;

  if (confirm(`Supprimer cette prestation du ${DataManager.formatDate(prestation.date)} ?`)) {
    await BusinessServices.deletePrestationById(prestationId);
    
    // Fermer la modal et rafraîchir l'affichage
    closeModal();
    
    // Rafraîchir les vues
    if (window.ViewManager) {
      ViewManager.updatePrestationsTable();
      ViewManager.updateDashboard();
      ViewManager.updateCalendar();
    }
    
    showTemporaryMessage('Prestation supprimée');
    
    // Réouvrir les détails du client pour voir l'historique mis à jour
    setTimeout(() => {
      ClientServices.showClientDetails(prestation.clientId);
    }, 500);
  }
}

function editClient(clientId) {
  const appData = DataManager.getAppData();
  const client = appData.clients.find(c => c.id === clientId);
  if (!client) return;
  
  DataManager.setEditingId(clientId);
  
  // ✅ NOUVEAU : Récupérer le nom du parrain si présent
  const parrainInfo = client.parrain ? getParrainInfo(client.parrain) : null;
  const parrainNom = parrainInfo ? parrainInfo.nom : '';
  
  // Créer une modal d'édition personnalisée avec le champ parrain
  const modalHTML = `
    <h3>Modifier le client</h3>
    <form id="client-form">
      <input type="hidden" id="client-id" value="${client.id}">
      <input type="hidden" id="client-type" value="client">
      <div class="form-row">
        <div class="form-group">
          <label>Nom *</label>
          <input type="text" id="client-nom" required value="${client.nom || ''}">
        </div>
        <div class="form-group">
          <label>Prénom *</label>
          <input type="text" id="client-prenom" required value="${client.prenom || ''}">
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Société</label>
          <input type="text" id="client-societe" value="${client.societe || ''}">
        </div>
        <div class="form-group">
          <label>Téléphone</label>
          <input type="tel" id="client-telephone" value="${client.telephone || ''}">
        </div>
      </div>
      <div class="form-group">
        <label>Email</label>
        <input type="email" id="client-email" value="${client.email || ''}">
      </div>
      <div class="form-group">
    <label>Sexe (pour statistiques)</label>
    <select id="client-sexe" style="width: 100%; padding: 0.75rem; border: 1px solid #ddd; border-radius: 6px;">
      <option value="" ${!client.sexe ? 'selected' : ''}>-- Non précisé --</option>
      <option value="H" ${client.sexe === 'H' ? 'selected' : ''}>Homme</option>
      <option value="F" ${client.sexe === 'F' ? 'selected' : ''}>Femme</option>
    </select>
    <small style="color: #666; font-size: 0.8rem;">💡 Pour analyser votre clientèle</small>
  </div>
  
      <div class="form-group">
        <label>📍 Ville</label>
        <select id="client-ville" style="width: 100%; padding: 0.75rem; border: 1px solid #ddd; border-radius: 6px;">
          <option value="" ${!client.ville ? 'selected' : ''}>-- Non précisé --</option>
          <option value="Porto-Vecchio" ${client.ville === 'Porto-Vecchio' ? 'selected' : ''}>Porto-Vecchio</option>
          <option value="Ajaccio" ${client.ville === 'Ajaccio' ? 'selected' : ''}>Ajaccio</option>
        </select>
        <small style="color: #666; font-size: 0.8rem;">💡 Pour filtrer dans l'annuaire</small>
      </div>
      
      <div class="form-group">
        <label>🤝 Parrain (optionnel)</label>
        <input type="text" id="client-parrain-search" placeholder="Rechercher un client parrain..." style="width: 100%; padding: 0.75rem; border: 1px solid #ddd; border-radius: 6px;" value="${parrainNom}">
        <input type="hidden" id="client-parrain" value="${client.parrain || ''}">
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
          <textarea id="client-adresse" placeholder="Ex: 15 Avenue Napoléon, 20000 Ajaccio" style="min-height: 80px; width: 100%; padding: 0.75rem; border: 1px solid #ddd; border-radius: 6px;">${client.adresse || ''}</textarea>
          <button type="button" onclick="validateClientAddress()" style="position: absolute; top: 0.5rem; right: 0.5rem; background: var(--beige-dore); color: white; border: none; padding: 0.25rem 0.5rem; border-radius: 4px; font-size: 0.8rem; cursor: pointer;">📍 Vérifier</button>
        </div>
        <div id="client-address-validation-result" style="margin-top: 0.5rem; font-size: 0.8rem;"></div>
        <small style="color: #666; font-size: 0.8rem;">💡 Cette adresse sera proposée automatiquement lors de la création de RDV/prestations</small>
      </div>
      <div id="client-preferences">
        <h4>Préférences</h4>
        <div class="form-group">
          <label>Huiles préférées</label>
          <input type="text" id="client-huiles" value="${client.huiles || ''}">
        </div>
        <div class="form-group">
          <label>Zones sensibles</label>
          <input type="text" id="client-zones" value="${client.zones || ''}">
        </div>
        <div class="form-group">
          <label>Allergies</label>
          <input type="text" id="client-allergies" value="${client.allergies || ''}">
        </div>
        <div class="form-group">
          <label>Pression préférée</label>
          <select id="client-pression">
            <option value="douce" ${client.pression === 'douce' ? 'selected' : ''}>Douce</option>
            <option value="moyenne" ${client.pression === 'moyenne' || !client.pression ? 'selected' : ''}>Moyenne</option>
            <option value="forte" ${client.pression === 'forte' ? 'selected' : ''}>Forte</option>
          </select>
        </div>
      </div>
      <div class="form-group">
        <label>Notes</label>
        <textarea id="client-notes">${client.notes || ''}</textarea>
      </div>
      <!-- v1.0.9.0 : opt-out fidelite -->
      <div class="form-group" style="background: #fdfaf3; padding: 0.75rem; border-radius: 8px; border-left: 3px solid var(--beige-dore);">
        <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer; margin: 0;">
          <input type="checkbox" id="client-sans-fidelite" ${client.sansFidelite ? 'checked' : ''}>
          <span>🚫 Pas de suivi fidélité (collectif, retraite, groupe)</span>
        </label>
        <small style="display: block; margin-top: 0.35rem; color: var(--text-light); font-size: 0.8rem;">💡 À cocher si ce client représente en réalité plusieurs personnes différentes.</small>
      </div>
      <div class="modal-actions">
        <button type="button" class="btn-secondary" onclick="closeModal()">Annuler</button>
        <button type="submit" class="btn-primary">Modifier</button>
      </div>
    </form>
  `;
  
  if (window.ModalManager) {
    ModalManager.showModal('client-modal', modalHTML);
    
    setTimeout(() => {
  populateCanalDropdown(client.canalAcquisition || '');
  createParrainAutocomplete('client-parrain-search', 'client-parrain');
  // AJOUTEZ CETTE LIGNE :
  if (client.tags && client.tags.length > 0) {
    ClientServices.displayExistingTags(client.tags, 'modal-content');
  }
}, 200);
  }
}

function editProspect(prospectId) {
  const appData = DataManager.getAppData();
  const prospect = appData.prospects.find(p => p.id === prospectId);
  if (!prospect) return;
  
  DataManager.setEditingId(prospectId);
  
  // ✅ NOUVEAU : Récupérer le nom du parrain si présent
  const parrainInfo = prospect.parrain ? getParrainInfo(prospect.parrain) : null;
  const parrainNom = parrainInfo ? parrainInfo.nom : '';
  
  // Créer une modal d'édition personnalisée avec le champ parrain
  const modalHTML = `
    <h3>Modifier le prospect</h3>
    <form id="client-form">
      <input type="hidden" id="client-id" value="${prospect.id}">
      <input type="hidden" id="client-type" value="prospect">
      <div class="form-row">
        <div class="form-group">
          <label>Nom *</label>
          <input type="text" id="client-nom" required value="${prospect.nom || ''}">
        </div>
        <div class="form-group">
          <label>Prénom *</label>
          <input type="text" id="client-prenom" required value="${prospect.prenom || ''}">
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Société</label>
          <input type="text" id="client-societe" value="${prospect.societe || ''}">
        </div>
        <div class="form-group">
          <label>Téléphone</label>
          <input type="tel" id="client-telephone" value="${prospect.telephone || ''}">
        </div>
      </div>
      <div class="form-group">
        <label>Email</label>
        <input type="email" id="client-email" value="${prospect.email || ''}">
      </div>
      
      <div class="form-group">
        <label>📍 Ville</label>
        <select id="client-ville" style="width: 100%; padding: 0.75rem; border: 1px solid #ddd; border-radius: 6px;">
          <option value="" ${!prospect.ville ? 'selected' : ''}>-- Non précisé --</option>
          <option value="Porto-Vecchio" ${prospect.ville === 'Porto-Vecchio' ? 'selected' : ''}>Porto-Vecchio</option>
          <option value="Ajaccio" ${prospect.ville === 'Ajaccio' ? 'selected' : ''}>Ajaccio</option>
        </select>
        <small style="color: #666; font-size: 0.8rem;">💡 Pour filtrer dans l'annuaire</small>
      </div>
      
      <div class="form-group">
        <label>🤝 Parrain (optionnel)</label>
        <input type="text" id="client-parrain-search" placeholder="Rechercher un client parrain..." style="width: 100%; padding: 0.75rem; border: 1px solid #ddd; border-radius: 6px;" value="${parrainNom}">
        <input type="hidden" id="client-parrain" value="${prospect.parrain || ''}">
        <small style="color: #666; font-size: 0.8rem;">💡 Le client qui a recommandé ce prospect</small>
      </div>
      
      <div class="form-group">
        <label>📈 D'où vient le prospect ?</label>
        <select id="client-canal-acquisition" style="width: 100%; padding: 0.75rem; border: 1px solid #ddd; border-radius: 6px;">
          <option value="">-- Sélectionnez le canal --</option>
        </select>
        <small style="color: #666; font-size: 0.8rem;">💡 Calcul des canaux de diffusions</small>
      </div>
      
      <div class="form-group">
        <label>Adresse</label>
        <div style="position: relative;">
          <textarea id="client-adresse" placeholder="Ex: 15 Avenue Napoléon, 20000 Ajaccio" style="min-height: 80px; width: 100%; padding: 0.75rem; border: 1px solid #ddd; border-radius: 6px;">${prospect.adresse || ''}</textarea>
          <button type="button" onclick="validateClientAddress()" style="position: absolute; top: 0.5rem; right: 0.5rem; background: var(--beige-dore); color: white; border: none; padding: 0.25rem 0.5rem; border-radius: 4px; font-size: 0.8rem; cursor: pointer;">📍 Vérifier</button>
        </div>
        <div id="client-address-validation-result" style="margin-top: 0.5rem; font-size: 0.8rem;"></div>
        <small style="color: #666; font-size: 0.8rem;">💡 Cette adresse sera proposée automatiquement lors de la création de RDV/prestations</small>
      </div>
      <div class="form-group">
        <label>Statut prospect</label>
        <select id="prospect-statut">
          <option value="intérêt fort" ${prospect.statut === 'intérêt fort' ? 'selected' : ''}>Intérêt fort</option>
          <option value="intérêt moyen" ${prospect.statut === 'intérêt moyen' || !prospect.statut ? 'selected' : ''}>Intérêt moyen</option>
          <option value="intérêt faible" ${prospect.statut === 'intérêt faible' ? 'selected' : ''}>Intérêt faible</option>
        </select>
      </div>
      <div class="form-group">
        <label>Notes</label>
        <textarea id="client-notes">${prospect.notes || ''}</textarea>
      </div>
      <div class="modal-actions">
        <button type="button" class="btn-secondary" onclick="closeModal()">Annuler</button>
        <button type="submit" class="btn-primary">Modifier</button>
      </div>
    </form>
  `;
  
  if (window.ModalManager) {
    ModalManager.showModal('client-modal', modalHTML);
    
    setTimeout(() => {
  populateCanalDropdown(prospect.canalAcquisition || '');
  createParrainAutocomplete('client-parrain-search', 'client-parrain');
  // AJOUTEZ CETTE LIGNE :
  if (prospect.tags && prospect.tags.length > 0) {
    ClientServices.displayExistingTags(prospect.tags, 'modal-content');
  }
}, 200);
  }
}

async function deleteClient(clientId) {
  const appData = DataManager.getAppData();
  const client = appData.clients.find(c => c.id === clientId);
  if (!client) return;

  if (confirm(`Supprimer definitivement le client "${client.prenom} ${client.nom}" ?\n\nCela supprimera aussi tous ses RDV et prestations.`)) {
    await deleteClientById(clientId);
    ViewManager.updateClientsDisplay();
    ViewManager.updateDashboard();
  }
}

async function deleteProspect(prospectId) {
  const appData = DataManager.getAppData();
  const prospect = appData.prospects.find(p => p.id === prospectId);
  if (!prospect) return;

  if (confirm(`Supprimer definitivement le prospect "${prospect.prenom} ${prospect.nom}" ?`)) {
    await deleteProspectById(prospectId);
    ViewManager.updateClientsDisplay();
  }
}

async function convertToClient(prospectId) {
  if (confirm('Convertir ce prospect en client ?')) {
    const newClient = await convertProspectToClient(prospectId);
    if (newClient) {
      ViewManager.updateClientsDisplay();
      ViewManager.updateDashboard();
    }
  }
}

async function convertToProspect(clientId) {
  const appData = DataManager.getAppData();
  const client = appData.clients.find(c => c.id === clientId);
  if (!client) return;

  if (confirm(`Convertir "${client.prenom} ${client.nom}" en prospect ?\n\nCela supprimera tous ses RDV et prestations.`)) {
    const newProspect = await convertClientToProspect(clientId);
    if (newProspect) {
      ViewManager.updateClientsDisplay();
      ViewManager.updateDashboard();
    }
  }
}

// ===== GESTION DES TAGS =====
function getAvailableTags() {
  const appData = DataManager.getAppData();
  
  // Tags par défaut du système
  const defaultTags = [
    { id: 'vip', label: 'VIP', color: '#f39c12', icon: '⭐' },    
    { id: 'vacancier', label: 'Vacancière', color: '#d7e34d', icon: '🌴' },
    { id: 'residence-secondaire', label: 'Résidence secondaire', color: '#17a2b8', icon: '🏡' },
    { id: 'locaux', label: 'Locaux', color: '#6f42c1', icon: '🏪' },
    { id: 'partenariat', label: 'Partenariat', color: '#0c51da', icon: '🤝' },
    { id: 'reseaux', label: 'Réseaux Sociaux', color: '#6c757d', icon: '📱' },
    { id: 'fidele', label: 'Fidèle', color: '#27ae60', icon: '💚' },
    { id: 'blacklist', label: 'Blacklist', color: '#e74c3c', icon: '🚫' },
    { id: 'nouveau', label: 'Nouveau', color: '#3498db', icon: '🆕' },
    { id: 'potentiel', label: 'Potentiel élevé', color: '#9b59b6', icon: '🎯' }
  ];
  
  // Tags personnalisés créés par l'utilisateur
  const customTags = (appData.parametres && appData.parametres.customTags) || [];
  
  return [...defaultTags, ...customTags];
}

// ===== CANAUX D'ACQUISITION =====
// À ajouter APRÈS la fonction getAvailableTags()

function getAvailableCanaux() {
  return [
    { id: 'planity', label: '📅 Planity', trackCost: true },
    { id: 'google-ads', label: '🔍 Google Ads', trackCost: true },
    { id: 'reseaux-sociaux', label: '📱 Réseaux sociaux', trackCost: false },
    { id: 'bouche-a-oreille', label: '🗣️ Bouche à oreille', trackCost: false },
    { id: 'parrainage', label: '🤝 Parrainage client', trackCost: false },
    { id: 'partenaire', label: '💼 Partenaire professionnel', trackCost: false },
    { id: 'influenceuse', label: '🎬 Collaboration influenceuse', trackCost: false },
    { id: 'non-renseigne', label: '❓ Non renseigné', trackCost: false }
  ];
}

function getCanalInfo(canalId) {
  const canaux = getAvailableCanaux();
  return canaux.find(canal => canal.id === canalId) || null;
}

function isValidCanal(canalId) {
  const canaux = getAvailableCanaux();
  return canaux.some(canal => canal.id === canalId);
}

// Migration des clients/prospects existants vers le système de canaux
function migrerCanalAcquisition() {
  console.log('🔄 Migration canal d\'acquisition...');
  
  const appData = DataManager.getAppData();
  let clientsMigres = 0;
  let prospectsMigres = 0;
  
  try {
    // Migration clients
    if (appData.clients) {
      appData.clients.forEach(client => {
        if (!client.hasOwnProperty('canalAcquisition')) {
          client.canalAcquisition = 'non-renseigne';
          client.dateAcquisition = new Date().toISOString().split('T')[0];
          clientsMigres++;
        }
      });
    }
    
    // Migration prospects  
    if (appData.prospects) {
      appData.prospects.forEach(prospect => {
        if (!prospect.hasOwnProperty('canalAcquisition')) {
          prospect.canalAcquisition = 'non-renseigne';
          prospect.dateAcquisition = new Date().toISOString().split('T')[0];
          prospectsMigres++;
        }
      });
    }
    
    console.log(`✅ Migration terminée : ${clientsMigres} clients, ${prospectsMigres} prospects`);
    
    return {
      success: true,
      clientsMigres,
      prospectsMigres
    };
    
  } catch (error) {
    console.error('❌ Erreur migration:', error);
    return { success: false, error: error.message };
  }
}

function createCustomTag(label, color = '#95a5a6', icon = '🏷️') {
  const appData = DataManager.getAppData();

  if (!appData.parametres) appData.parametres = {};
  if (!appData.parametres.customTags) {
    appData.parametres.customTags = [];
  }

  const newTag = {
    id: 'custom_' + Date.now(),
    label: label.trim(),
    color: color,
    icon: icon,
    isCustom: true
  };

  appData.parametres.customTags.push(newTag);
  return newTag;
}

// Retourne la liste des clients/prospects affectes par la suppression
// pour permettre une persistance ciblee dans deleteTagConfirm.
function deleteCustomTag(tagId) {
  const appData = DataManager.getAppData();

  if (!appData.parametres || !appData.parametres.customTags) {
    return { ok: false, affectedClients: [], affectedProspects: [] };
  }

  appData.parametres.customTags = appData.parametres.customTags.filter(tag => tag.id !== tagId);

  const affectedClients = [];
  const affectedProspects = [];

  appData.clients.forEach(client => {
    if (client.tags && client.tags.includes(tagId)) {
      client.tags = client.tags.filter(t => t !== tagId);
      affectedClients.push(client);
    }
  });

  appData.prospects.forEach(prospect => {
    if (prospect.tags && prospect.tags.includes(tagId)) {
      prospect.tags = prospect.tags.filter(t => t !== tagId);
      affectedProspects.push(prospect);
    }
  });

  return { ok: true, affectedClients, affectedProspects };
}

async function addTagToClient(clientId, tagId, type = 'client') {
  const appData = DataManager.getAppData();
  const collection = type === 'client' ? appData.clients : appData.prospects;
  const person = collection.find(p => p.id === clientId);
  if (!person) return false;
  if (!person.tags) person.tags = [];
  if (!person.tags.includes(tagId)) {
    person.tags.push(tagId);
    const table = type === 'client' ? 'clients' : 'prospects';
    const mapFn = type === 'client' ? DataManager.mapClientToDb : DataManager.mapProspectToDb;
    try { await DataManager.updateEntity(table, person.id, person, mapFn); } catch(e) { console.error('Erreur addTag:', e); }
  }
  return true;
}

async function removeTagFromClient(clientId, tagId, type = 'client') {
  const appData = DataManager.getAppData();
  const collection = type === 'client' ? appData.clients : appData.prospects;
  const person = collection.find(p => p.id === clientId);
  if (!person || !person.tags) return false;
  person.tags = person.tags.filter(t => t !== tagId);
  const table = type === 'client' ? 'clients' : 'prospects';
  const mapFn = type === 'client' ? DataManager.mapClientToDb : DataManager.mapProspectToDb;
  try { await DataManager.updateEntity(table, person.id, person, mapFn); } catch(e) { console.error('Erreur removeTag:', e); }
  return true;
}

function getClientsByTag(tagId, type = 'both') {
  const appData = DataManager.getAppData();
  const results = [];
  
  if (type === 'both' || type === 'client') {
    const clients = appData.clients.filter(client => 
      client.tags && client.tags.includes(tagId)
    );
    results.push(...clients.map(c => ({ ...c, type: 'client' })));
  }
  
  if (type === 'both' || type === 'prospect') {
    const prospects = appData.prospects.filter(prospect => 
      prospect.tags && prospect.tags.includes(tagId)
    );
    results.push(...prospects.map(p => ({ ...p, type: 'prospect' })));
  }
  
  // ✅ NOUVEAU : Ajouter les collaborateurs
  if (type === 'both' || type === 'collaborateur') {
    const collaborateurs = (appData.collaborateurs || []).filter(collaborateur => 
      collaborateur.tags && (
        collaborateur.tags.includes(tagId) || 
        collaborateur.tags.some(tag => tag.toLowerCase() === tagId.toLowerCase())
      )
    );
    results.push(...collaborateurs.map(c => ({ ...c, type: 'collaborateur' })));
  }
  
  return results;
}

// 1. MODIFIER la fonction generateTagsHTML pour supporter les collaborateurs
function generateTagsHTML(personTags = [], isEditable = false, personId = null, personType = 'client') {
  const availableTags = getAvailableTags();
  
  if (!personTags || personTags.length === 0) {
    return isEditable ? 
      `<span class="tags-label-clickable" onclick="showTagSelector('${personId}', '${personType}')" style="color: #6c757d; cursor: pointer; text-decoration: underline; font-size: 0.9rem;" title="Cliquer pour ajouter des tags">
        Aucun tag - Cliquer pour ajouter
      </span>` : 
      '<span style="color: #999; font-style: italic; font-size: 0.9rem;">Aucun tag</span>';
  }
  
  const tagsHtml = personTags.map(tagId => {
    // ✅ NOUVEAU : Support pour les tags string des collaborateurs
    let tag;
    if (personType === 'collaborateur') {
      // Pour les collaborateurs, les tags peuvent être des strings simples
      if (typeof tagId === 'string') {
        // Chercher d'abord dans les tags système
        tag = availableTags.find(t => t.id === tagId || t.label.toLowerCase() === tagId.toLowerCase());
        
        // Si pas trouvé, créer un tag temporaire
        if (!tag) {
          tag = {
            id: tagId,
            label: tagId,
            color: '#6c757d',
            icon: '🏷️'
          };
        }
      } else {
        tag = availableTags.find(t => t.id === tagId);
      }
    } else {
      // Pour clients/prospects, utiliser le système existant
      tag = availableTags.find(t => t.id === tagId);
    }
    
    if (!tag) return '';
    
    return `
      <span class="client-tag" style="background: ${tag.color}; color: white; padding: 0.25rem 0.6rem; border-radius: 12px; font-size: 0.8rem; margin: 0.2rem 0.3rem 0.2rem 0; display: inline-block; white-space: nowrap;">
        ${tag.icon} ${tag.label}
        ${isEditable ? `<button onclick="event.stopPropagation(); removeTagFromPersonUI('${personId}', '${tagId}', '${personType}')" style="background: none; border: none; color: white; margin-left: 0.3rem; cursor: pointer; font-weight: bold; font-size: 0.9rem;">×</button>` : ''}
      </span>
    `;
  }).join('');
  
  return `
    <div class="tags-container" style="display: flex; flex-wrap: wrap; align-items: center; gap: 0.2rem;">
      ${tagsHtml}
      ${isEditable ? `<span class="add-tag-link" onclick="showTagSelector('${personId}', '${personType}')" style="color: var(--beige-dore); cursor: pointer; text-decoration: underline; font-size: 0.8rem; margin-left: 0.3rem;" title="Ajouter un tag">+ tag</span>` : ''}
    </div>
  `;
}

function showTagSelector(personId, personType) {
  const appData = DataManager.getAppData();
  let collection, person;
  
  // ✅ NOUVEAU : Support collaborateurs
  if (personType === 'collaborateur') {
    collection = appData.collaborateurs || [];
    person = collection.find(p => p.id === personId);
  } else {
    collection = personType === 'client' ? appData.clients : appData.prospects;
    person = collection.find(p => p.id === personId);
  }
  
  if (!person) return;
  
  const availableTags = getAvailableTags();
  const personTags = person.tags || [];
  
  const modalHTML = `
    <h3>🏷️ Gérer les tags - ${person.prenom} ${person.nom}</h3>
    
    <div style="margin-bottom: 2rem;">
      <h4>Tags disponibles</h4>
      <div class="tags-selector">
        ${availableTags.map(tag => {
          // ✅ NOUVEAU : Comparaison adaptée pour collaborateurs
          let isSelected;
          if (personType === 'collaborateur') {
            isSelected = personTags.includes(tag.id) || personTags.includes(tag.label) || personTags.includes(tag.label.toLowerCase());
          } else {
            isSelected = personTags.includes(tag.id);
          }
          
          return `
            <div class="tag-option" 
                 data-tag-id="${tag.id}" 
                 data-selected="${isSelected}"
                 style="
                   display: inline-block; 
                   margin: 0.5rem; 
                   padding: 0.5rem 1rem; 
                   border: 2px solid ${tag.color}; 
                   background: ${isSelected ? tag.color : 'white'}; 
                   color: ${isSelected ? 'white' : tag.color}; 
                   border-radius: 20px; 
                   cursor: pointer;
                   transition: all 0.3s ease;
                   user-select: none;
                 ">
              ${tag.icon} ${tag.label}
              ${tag.isCustom ? `<button type="button" onclick="event.stopPropagation(); deleteTagConfirm('${tag.id}')" style="background: none; border: none; color: inherit; margin-left: 0.5rem; font-weight: bold;" title="Supprimer ce tag personnalisé">🗑️</button>` : ''}
            </div>
          `;
        }).join('')}
      </div>
    </div>
        
    <div style="margin-bottom: 2rem; padding: 1rem; background: #f8f9fa; border-radius: 8px;">
      <h4>Créer un nouveau tag</h4>
      <div style="display: flex; gap: 1rem; align-items: end; flex-wrap: wrap;">
        <div style="flex: 1; min-width: 150px;">
          <label>Nom du tag</label>
          <input type="text" id="new-tag-label" placeholder="Ex: Client spécial" style="width: 100%; padding: 0.5rem; border: 1px solid #ddd; border-radius: 6px;">
        </div>
        <div>
          <label>Couleur</label>
          <input type="color" id="new-tag-color" value="#95a5a6" style="width: 50px; height: 38px; border: none; border-radius: 6px; cursor: pointer;">
        </div>
        <div>
          <label>Icône</label>
          <select id="new-tag-icon" style="padding: 0.5rem; border: 1px solid #ddd; border-radius: 6px;">
            <option value="🏷️">🏷️ Tag</option>
            <option value="⭐">⭐ Étoile</option>
            <option value="💎">💎 Diamant</option>
            <option value="🔥">🔥 Feu</option>
            <option value="💯">💯 Cent</option>
            <option value="🎯">🎯 Cible</option>
            <option value="💰">💰 Argent</option>
            <option value="👑">👑 Couronne</option>
            <option value="🚀">🚀 Fusée</option>
            <option value="💼">💼 Entreprise</option>
            <option value="🏥">🏥 Médical</option>
            <option value="🤝">🤝 Partenaire</option>
          </select>
        </div>
        <button type="button" onclick="createNewTagFromModal()" class="btn-secondary">Créer</button>
      </div>
    </div>
    
    <div class="modal-actions">
      <button type="button" class="btn-secondary" onclick="closeModal()">Annuler</button>
      <button type="button" class="btn-primary" onclick="saveTagsSelection('${personId}', '${personType}')">Enregistrer</button>
    </div>
  `;
  
  ModalManager.showModal('tags-modal', modalHTML);
  
  // Event listeners pour tags normaux
  setTimeout(() => {
    document.querySelectorAll('.tag-option').forEach(option => {
      option.addEventListener('click', function(e) {
        if (e.target.tagName === 'BUTTON') return;
        
        const currentlySelected = this.dataset.selected === 'true';
        const newState = !currentlySelected;
        
        this.dataset.selected = newState.toString();
        
        if (newState) {
          this.style.background = this.style.borderColor;
          this.style.color = 'white';
        } else {
          this.style.background = 'white';
          this.style.color = this.style.borderColor;
        }
      });
    });
    
  }, 200);
}

function createNewTagFromModal() {
  const label = document.getElementById('new-tag-label').value.trim();
  const color = document.getElementById('new-tag-color').value;
  const icon = document.getElementById('new-tag-icon').value;
  
  if (!label) {
    alert('Veuillez saisir un nom pour le tag');
    return;
  }
  
  const newTag = createCustomTag(label, color, icon);
  
  // Ajouter le nouveau tag à la liste dans la modal
  const tagsSelector = document.querySelector('.tags-selector');
  const newTagHTML = `
    <div class="tag-option" 
         data-tag-id="${newTag.id}" 
         data-selected="false"
         style="
           display: inline-block; 
           margin: 0.5rem; 
           padding: 0.5rem 1rem; 
           border: 2px solid ${newTag.color}; 
           background: white; 
           color: ${newTag.color}; 
           border-radius: 20px; 
           cursor: pointer;
           transition: all 0.3s ease;
           user-select: none;
         ">
      ${newTag.icon} ${newTag.label}
      <button type="button" onclick="event.stopPropagation(); deleteTagConfirm('${newTag.id}')" style="background: none; border: none; color: inherit; margin-left: 0.5rem; font-weight: bold;" title="Supprimer ce tag personnalisé">🗑️</button>
    </div>
  `;
  
  tagsSelector.insertAdjacentHTML('beforeend', newTagHTML);
  
  // ✅ FIX : Event listener corrigé pour le nouveau tag
  const newTagElement = tagsSelector.lastElementChild;
  newTagElement.addEventListener('click', function(e) {
    if (e.target.tagName === 'BUTTON') {
      return;
    }
    
    const currentlySelected = this.dataset.selected === 'true';
    const newState = !currentlySelected;
    
    this.dataset.selected = newState.toString();
    
    if (newState) {
      this.style.background = this.style.borderColor;
      this.style.color = 'white';
    } else {
      this.style.background = 'white';
      this.style.color = this.style.borderColor;
    }
  });
  
  // Reset du formulaire
  document.getElementById('new-tag-label').value = '';
  document.getElementById('new-tag-color').value = '#95a5a6';
  document.getElementById('new-tag-icon').value = '🏷️';
  
  showTemporaryMessage('✅ Tag créé !');
}

// 3. MODIFIER saveTagsSelection pour supporter les collaborateurs
async function saveTagsSelection(personId, personType) {
  const selectedTags = Array.from(document.querySelectorAll('.tag-option[data-selected="true"]'))
    .map(option => option.dataset.tagId);

  const appData = DataManager.getAppData();
  let collection, person;

  if (personType === 'collaborateur') {
    if (!appData.collaborateurs) appData.collaborateurs = [];
    collection = appData.collaborateurs;
    person = collection.find(p => p.id === personId);
  } else {
    collection = personType === 'client' ? appData.clients : appData.prospects;
    person = collection.find(p => p.id === personId);
  }

  if (person) {
    const previousTags = person.tags ? person.tags.slice() : [];
    person.tags = selectedTags;

    const table = personType === 'collaborateur' ? 'collaborateurs' : (personType === 'prospect' ? 'prospects' : 'clients');
    const mapFn = personType === 'collaborateur' ? DataManager.mapCollaborateurToDb : (personType === 'prospect' ? DataManager.mapProspectToDb : DataManager.mapClientToDb);
    try {
      await DataManager.updateEntity(table, person.id, person, mapFn);
    } catch (err) {
      console.error('Erreur save tags:', err);
      person.tags = previousTags;
      alert('Erreur lors de la sauvegarde des tags. Verifiez votre connexion.');
      return;
    }

    if (personType === 'collaborateur') {
      if (window.ViewManager && typeof ViewManager.updateCollaborateursDisplay === 'function') {
        ViewManager.updateCollaborateursDisplay();
      }
    } else {
      updateClientsDisplay();
    }

    closeModal();
    showTemporaryMessage('Tags mis a jour !');
  }
}

async function removeTagFromPersonUI(personId, tagId, personType) {
  const appData = DataManager.getAppData();
  let collection, person, table, mapFn;

  if (personType === 'collaborateur') {
    if (!appData.collaborateurs) return;
    collection = appData.collaborateurs;
    person = collection.find(p => p.id === personId);
    table = 'collaborateurs';
    mapFn = DataManager.mapCollaborateurToDb;
  } else if (personType === 'client') {
    collection = appData.clients;
    person = collection.find(p => p.id === personId);
    table = 'clients';
    mapFn = DataManager.mapClientToDb;
  } else {
    collection = appData.prospects;
    person = collection.find(p => p.id === personId);
    table = 'prospects';
    mapFn = DataManager.mapProspectToDb;
  }

  if (!person || !person.tags) return;

  const previousTags = person.tags.slice();
  if (personType === 'collaborateur') {
    person.tags = person.tags.filter(t => t !== tagId && t.toLowerCase() !== tagId.toLowerCase());
  } else {
    person.tags = person.tags.filter(t => t !== tagId);
  }

  try {
    await DataManager.updateEntity(table, person.id, person, mapFn);
  } catch (err) {
    console.error('Erreur removeTagFromPersonUI:', err);
    person.tags = previousTags;
    alert('Erreur lors de la suppression du tag. Verifiez votre connexion.');
    return;
  }

  if (personType === 'collaborateur') {
    if (window.ViewManager && typeof ViewManager.updateCollaborateursDisplay === 'function') {
      ViewManager.updateCollaborateursDisplay();
    }
  } else {
    updateClientsDisplay();
  }
  showTemporaryMessage('Tag supprime');
}

async function removeTagFromClientUI(personId, tagId, personType) {
  // removeTagFromClient persiste deja via updateEntity, donc on enleve le saveData no-op
  if (await removeTagFromClient(personId, tagId, personType)) {
    updateClientsDisplay();
    showTemporaryMessage('Tag supprime');
  }
}

async function deleteTagConfirm(tagId) {
  if (!confirm('Supprimer ce tag personnalise ? Il sera retire de tous les clients/prospects qui l\'utilisent.')) return;

  const result = deleteCustomTag(tagId);
  if (!result.ok) return;

  // Persister parametres (la liste des customTags) + chaque client/prospect impacte
  let echecs = 0;
  const okParam = await DataManager.saveParametresToDb();
  if (!okParam) echecs++;

  for (const client of result.affectedClients) {
    try { await DataManager.updateEntity('clients', client.id, client, DataManager.mapClientToDb); }
    catch (e) { console.error('Erreur update client deleteTag:', e); echecs++; }
  }
  for (const prospect of result.affectedProspects) {
    try { await DataManager.updateEntity('prospects', prospect.id, prospect, DataManager.mapProspectToDb); }
    catch (e) { console.error('Erreur update prospect deleteTag:', e); echecs++; }
  }

  closeModal();
  updateClientsDisplay();
  if (echecs > 0) {
    alert(`Tag supprime mais ${echecs} sauvegarde(s) ont echoue. Verifiez votre connexion et rechargez l'app.`);
  } else {
    showTemporaryMessage('Tag supprime');
  }
}

function showTagsManagementModal() {
  const availableTags = getAvailableTags();
  
  const modalHTML = `
    <h3>🏷️ Gestion des tags</h3>
    
    <div style="margin-bottom: 2rem;">
      <h4>Tags existants</h4>
      <div class="existing-tags">
        ${availableTags.map(tag => `
          <div class="tag-management-item" style="
            display: flex; 
            align-items: center; 
            justify-content: space-between; 
            padding: 0.75rem; 
            margin: 0.5rem 0; 
            border: 1px solid #dee2e6; 
            border-radius: 8px; 
            background: white;
          ">
            <div style="display: flex; align-items: center; gap: 1rem;">
              <span style="
                background: ${tag.color}; 
                color: white; 
                padding: 0.25rem 0.75rem; 
                border-radius: 12px; 
                font-size: 0.9rem;
              ">
                ${tag.icon} ${tag.label}
              </span>
              <span style="color: #6c757d; font-size: 0.8rem;">
                ${getClientsByTag(tag.id).length} utilisations
              </span>
            </div>
            <div>
              ${tag.isCustom ? `
                <button onclick="deleteTagConfirm('${tag.id}')" class="btn-danger" style="padding: 0.25rem 0.5rem; font-size: 0.8rem;">
                  🗑️ Supprimer
                </button>
              ` : `
                <span style="color: #6c757d; font-size: 0.8rem; font-style: italic;">Tag système</span>
              `}
            </div>
          </div>
        `).join('')}
      </div>
    </div>
    
    <div style="padding: 1rem; background: #f8f9fa; border-radius: 8px;">
      <h4>Créer un nouveau tag</h4>
      <div style="display: flex; gap: 1rem; align-items: end; flex-wrap: wrap;">
        <div style="flex: 1; min-width: 150px;">
          <label>Nom du tag</label>
          <input type="text" id="management-new-tag-label" placeholder="Ex: Client spécial" style="width: 100%; padding: 0.5rem; border: 1px solid #ddd; border-radius: 6px;">
        </div>
        <div>
          <label>Couleur</label>
          <input type="color" id="management-new-tag-color" value="#95a5a6" style="width: 50px; height: 38px; border: none; border-radius: 6px; cursor: pointer;">
        </div>
        <div>
          <label>Icône</label>
          <select id="management-new-tag-icon" style="padding: 0.5rem; border: 1px solid #ddd; border-radius: 6px;">
            <option value="🏷️">🏷️ Tag</option>
            <option value="⭐">⭐ Étoile</option>
            <option value="💎">💎 Diamant</option>
            <option value="🔥">🔥 Feu</option>
            <option value="💯">💯 Cent</option>
            <option value="🎯">🎯 Cible</option>
            <option value="💰">💰 Argent</option>
            <option value="👑">👑 Couronne</option>
            <option value="🚀">🚀 Fusée</option>
            <option value="💼">💼 Entreprise</option>
            <option value="🎨">🎨 Art</option>
            <option value="🌟">🌟 Brillant</option>
          </select>
        </div>
        <button type="button" onclick="createTagFromManagement()" class="btn-primary">Créer</button>
      </div>
    </div>
    
    <div class="modal-actions" style="margin-top: 2rem;">
      <button type="button" class="btn-secondary" onclick="closeModal()">Fermer</button>
    </div>
  `;
  
  ModalManager.showModal('tags-management-modal', modalHTML);
}

async function createTagFromManagement() {
  const label = document.getElementById('management-new-tag-label').value.trim();
  const color = document.getElementById('management-new-tag-color').value;
  const icon = document.getElementById('management-new-tag-icon').value;

  if (!label) {
    alert('Veuillez saisir un nom pour le tag');
    return;
  }

  const newTag = createCustomTag(label, color, icon);
  const ok = await DataManager.saveParametresToDb();
  if (!ok) {
    // Rollback : retirer le tag du cache
    const appData = DataManager.getAppData();
    if (appData.parametres && appData.parametres.customTags) {
      appData.parametres.customTags = appData.parametres.customTags.filter(t => t.id !== newTag.id);
    }
    alert('Erreur de sauvegarde du tag. Verifiez votre connexion.');
    return;
  }

  closeModal();
  setTimeout(() => showTagsManagementModal(), 100);
  showTemporaryMessage('Tag cree !');
}

// Filtrage par tags
function filterClientsByTags(selectedTags = []) {
  if (selectedTags.length === 0) {
    updateClientsDisplay();
    return;
  }
  
  const appData = DataManager.getAppData();
  
  // Filtrer les clients
  const filteredClients = appData.clients.filter(client => {
    if (!client.tags || client.tags.length === 0) return false;
    return selectedTags.some(tagId => client.tags.includes(tagId));
  });
  
  // Filtrer les prospects
  const filteredProspects = appData.prospects.filter(prospect => {
    if (!prospect.tags || prospect.tags.length === 0) return false;
    return selectedTags.some(tagId => prospect.tags.includes(tagId));
  });
  
  // ✅ NOUVEAU : Filtrer les collaborateurs
  const filteredCollaborateurs = (appData.collaborateurs || []).filter(collaborateur => {
    if (!collaborateur.tags || collaborateur.tags.length === 0) return false;
    return selectedTags.some(tagId => 
      collaborateur.tags.includes(tagId) || 
      collaborateur.tags.some(tag => tag.toLowerCase() === tagId.toLowerCase())
    );
  });
  
  // Séparer les clients fidèles des nouveaux
  const clientsFideles = [];
  const nouveauxClients = [];
  
  filteredClients.forEach(client => {
    const stats = getClientStats(client.id);
    if (stats.totalMassages >= 2) {
      clientsFideles.push({ client, stats });
    } else {
      nouveauxClients.push({ client, stats });
    }
  });
  
  // ✅ MODIFIER : Utiliser la fonction de mise à jour avec collaborateurs
  displayFilteredClients(clientsFideles, nouveauxClients, filteredProspects, filteredCollaborateurs);
  
  // ✅ MODIFIER : Mettre à jour le compteur de résultats avec collaborateurs
  const totalResults = filteredClients.length + filteredProspects.length + filteredCollaborateurs.length;
  const resultCount = document.getElementById('search-results-count');
  if (resultCount) {
    resultCount.innerHTML = `<span style="color: var(--beige-dore);">🏷️ ${totalResults} résultat${totalResults > 1 ? 's' : ''} avec ces tags</span>`;
  }
}

function showTagsFilter() {
  const availableTags = getAvailableTags();
  
  const modalHTML = `
    <h3>🏷️ Filtrer par tags</h3>
    
    <div style="margin-bottom: 1.5rem;">
      <p style="color: #6c757d;">Sélectionnez un ou plusieurs tags pour filtrer vos clients et prospects :</p>
    </div>
    
    <div class="tags-filter-selector">
      ${availableTags.map(tag => `
        <div class="tag-filter-option" 
             data-tag-id="${tag.id}"
             data-selected="false"
             style="
               display: inline-block; 
               margin: 0.5rem; 
               padding: 0.5rem 1rem; 
               border: 2px solid ${tag.color}; 
               background: white; 
               color: ${tag.color}; 
               border-radius: 20px; 
               cursor: pointer;
               transition: all 0.3s ease;
               user-select: none;
             ">
          ${tag.icon} ${tag.label}
          <span class="tag-count" style="
            background: ${tag.color}; 
            color: white; 
            font-size: 0.7rem; 
            padding: 0.1rem 0.4rem; 
            border-radius: 8px; 
            margin-left: 0.5rem;
          ">
            ${getClientsByTag(tag.id).length}
          </span>
        </div>
      `).join('')}
    </div>
    
    <!-- Aperçu dynamique des résultats -->
    <div id="filter-preview" style="
      margin-top: 1.5rem; 
      padding: 1rem; 
      background: #f8f9fa; 
      border-radius: 8px; 
      border-left: 4px solid var(--beige-dore);
      display: none;
    ">
      <strong>📊 Aperçu du filtre :</strong>
      <div id="filter-preview-content" style="margin-top: 0.5rem; color: #6c757d;"></div>
    </div>
    
    <div class="modal-actions" style="margin-top: 2rem;">
      <button type="button" class="btn-secondary" onclick="clearTagsFilter()">Effacer le filtre</button>
      <button type="button" class="btn-secondary" onclick="closeModal()">Annuler</button>
      <button type="button" class="btn-primary" onclick="applyTagsFilter()">Appliquer</button>
    </div>
  `;
  
  ModalManager.showModal('tags-filter-modal', modalHTML);
  
  // ✅ NOUVEAU : Event listeners avec aperçu dynamique
  setTimeout(() => {
    function updatePreview() {
      const selectedTags = Array.from(document.querySelectorAll('.tag-filter-option[data-selected="true"]'))
        .map(option => option.dataset.tagId);
      
      const preview = document.getElementById('filter-preview');
      const previewContent = document.getElementById('filter-preview-content');
      
      if (selectedTags.length === 0) {
        preview.style.display = 'none';
        return;
      }
      
      // Calculer les résultats
      const results = [];
      selectedTags.forEach(tagId => {
        const tagResults = getClientsByTag(tagId);
        results.push(...tagResults);
      });
      
      // Dédoublonner
      const uniqueResults = results.filter((result, index, self) => 
        index === self.findIndex(r => r.id === result.id && r.type === result.type)
      );
      
      const clientsCount = uniqueResults.filter(r => r.type === 'client').length;
      const prospectsCount = uniqueResults.filter(r => r.type === 'prospect').length;
      
      preview.style.display = 'block';
      previewContent.innerHTML = `
        ${uniqueResults.length} résultat${uniqueResults.length > 1 ? 's' : ''} trouvé${uniqueResults.length > 1 ? 's' : ''} :
        ${clientsCount > 0 ? `${clientsCount} client${clientsCount > 1 ? 's' : ''}` : ''}
        ${clientsCount > 0 && prospectsCount > 0 ? ' et ' : ''}
        ${prospectsCount > 0 ? `${prospectsCount} prospect${prospectsCount > 1 ? 's' : ''}` : ''}
      `;
    }
    
    document.querySelectorAll('.tag-filter-option').forEach(option => {
      option.addEventListener('click', function() {
        const currentlySelected = this.dataset.selected === 'true';
        const newState = !currentlySelected;
        
        this.dataset.selected = newState.toString();
        
        if (newState) {
          this.style.background = this.style.borderColor;
          this.style.color = 'white';
        } else {
          this.style.background = 'white';
          this.style.color = this.style.borderColor;
        }
        
        // ✅ NOUVEAU : Mise à jour dynamique de l'aperçu
        updatePreview();
      });
    });
  }, 200);
}

function applyTagsFilter() {
  // ✅ FIX : Utiliser data-selected
  const selectedTags = Array.from(document.querySelectorAll('.tag-filter-option[data-selected="true"]'))
    .map(option => option.dataset.tagId);
  
  closeModal();
  filterClientsByTags(selectedTags);
}

function clearTagsFilter() {
  closeModal();
  updateClientsDisplay();
  
  // Effacer le compteur de résultats
  const resultCount = document.getElementById('search-results-count');
  if (resultCount) {
    resultCount.textContent = '';
  }
}

// ===== ✅ NOUVEAU : FONCTIONS POUR LES CANAUX D'ACQUISITION =====

function getClientsByCanal(canalId) {
  const appData = DataManager.getAppData();
  const results = [];
  
  // Chercher dans les clients
  if (appData.clients) {
    const clients = appData.clients.filter(client => 
      client.canalAcquisition === canalId
    );
    results.push(...clients.map(c => ({ ...c, type: 'client' })));
  }
  
  // Chercher dans les prospects
  if (appData.prospects) {
    const prospects = appData.prospects.filter(prospect => 
      prospect.canalAcquisition === canalId
    );
    results.push(...prospects.map(p => ({ ...p, type: 'prospect' })));
  }
  
  return results;
}

function getClientsStatsParCanal() {
  const appData = DataManager.getAppData();
  const canaux = getAvailableCanaux();
  const stats = {};
  
  // Initialiser les stats pour chaque canal
  canaux.forEach(canal => {
    stats[canal.id] = {
      id: canal.id,
      label: canal.label,
      clients: 0,
      prospects: 0,
      revenus: 0
    };
  });
  
  // Compter les clients par canal
  if (appData.clients) {
    appData.clients.forEach(client => {
      const canal = client.canalAcquisition || 'non-renseigne';
      if (stats[canal]) {
        stats[canal].clients++;
        
        // Calculer les revenus de ce client
        const prestationsClient = appData.prestations.filter(p => p.clientId === client.id);
        const revenusClient = prestationsClient.reduce((sum, p) => sum + (p.prix || 0), 0);
        stats[canal].revenus += revenusClient;
      }
    });
  }
  
  // Compter les prospects par canal
  if (appData.prospects) {
    appData.prospects.forEach(prospect => {
      const canal = prospect.canalAcquisition || 'non-renseigne';
      if (stats[canal]) {
        stats[canal].prospects++;
      }
    });
  }
  
  return stats;
}

function getCanalAnalytics() {
  const stats = getClientsStatsParCanal();
  
  // Trier par revenus décroissants
  const sortedStats = Object.values(stats).sort((a, b) => b.revenus - a.revenus);
  
  return {
    parCanal: stats,
    sorted: sortedStats,
    totalClients: Object.values(stats).reduce((sum, s) => sum + s.clients, 0),
    totalProspects: Object.values(stats).reduce((sum, s) => sum + s.prospects, 0),
    totalRevenus: Object.values(stats).reduce((sum, s) => sum + s.revenus, 0)
  };
}

function getCanalAnalyticsFiltered(selectedYear = 'current', selectedMonth = '') {
  const appData = DataManager.getAppData();
  const canaux = getAvailableCanaux();
  const stats = {};
  
  canaux.forEach(canal => {
    stats[canal.id] = {
      id: canal.id,
      label: canal.label,
      clients: 0,
      prospects: 0,
      revenus: 0
    };
  });
  
  // Filtrer clients avec prestations dans la période
  if (appData.clients) {
    appData.clients.forEach(client => {
      const canal = client.canalAcquisition || 'non-renseigne';
      if (stats[canal]) {
        const clientPrestations = appData.prestations.filter(p => {
          if (p.clientId !== client.id) return false;
          
          if (selectedYear === 'current' && selectedMonth === '') return true;
          
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
        
        if (selectedYear === 'current' && selectedMonth === '' || clientPrestations.length > 0) {
          stats[canal].clients++;
          const revenusClient = clientPrestations.reduce((sum, p) => sum + (p.prix || 0), 0);
          stats[canal].revenus += revenusClient;
        }
      }
    });
  }
  
  // Prospects (pas de filtre temporel)
  if (appData.prospects && (selectedYear === 'current' && selectedMonth === '')) {
    appData.prospects.forEach(prospect => {
      const canal = prospect.canalAcquisition || 'non-renseigne';
      if (stats[canal]) {
        stats[canal].prospects++;
      }
    });
  }
  
  const sorted = Object.values(stats).sort((a, b) => b.revenus - a.revenus);
  
  return {
    parCanal: stats,
    sorted: sorted,
    totalClients: Object.values(stats).reduce((sum, s) => sum + s.clients, 0),
    totalProspects: Object.values(stats).reduce((sum, s) => sum + s.prospects, 0),
    totalRevenus: Object.values(stats).reduce((sum, s) => sum + s.revenus, 0)
  };
}

// Nouvelle fonction : Statistiques par sexe
function getStatsParSexe(selectedYear = 'current', selectedMonth = '') {
  const appData = DataManager.getAppData();
  
  // Filtrer les clients qui ont des prestations dans la période
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
  
  const stats = {
    hommes: { clients: 0 },
    femmes: { clients: 0 },
    nonPrecise: { clients: 0 },
    totaux: { clients: 0 }
  };
  
  clientsFiltered.forEach(client => {
    stats.totaux.clients++;

    // v1.0.7.1 : retrocompat 'M' (ancien format) et 'H' (nouveau format formulaire).
    // Accepte aussi 'Homme'/'Femme' au cas ou.
    const sexe = (client.sexe || '').toString().trim().toUpperCase();
    if (sexe === 'H' || sexe === 'M' || sexe === 'HOMME') {
      stats.hommes.clients++;
    } else if (sexe === 'F' || sexe === 'FEMME') {
      stats.femmes.clients++;
    } else {
      stats.nonPrecise.clients++;
    }
  });
  
  return stats;
}

// Mettre à jour les exports pour inclure les nouvelles fonctions
const newExports = {
  // ... exports existants
  
  // ✅ NOUVEAU : Tags
  getAvailableTags,
  createCustomTag,
  deleteCustomTag,
  addTagToClient,
  removeTagFromClient,
  getClientsByTag,
  generateTagsHTML,
  showTagSelector,
  createNewTagFromModal,
  saveTagsSelection,
  removeTagFromClientUI,
  deleteTagConfirm,
  showTagsManagementModal,
  createTagFromManagement,
  filterClientsByTags,
  showTagsFilter,
  applyTagsFilter,
  clearTagsFilter,
  getAvailableCanaux,
  getCanalInfo,
  isValidCanal,
  migrerCanalAcquisition
};

window.ClientServices = {
  // Gestion clients (existant)
  getClientStats,
  createClient,
  deleteClientById,
  deleteProspectById,
  convertProspectToClient,
  convertClientToProspect,
  getTopClients,
  getStatsParSexe,
  
  // Parrainage (existant)
  getParrainInfo,
  getFilleuls,
  generateParrainageSection,
  
  // Recherche (existant)
  setupClientSearch,
  filterAndDisplayClients,
  
  // Affichage (existant)
  showClientDetails,
  showTopClientsModal,
  generateClientHistorique,
  
  // Actions CRUD (existant)
  editClient,
  editProspect,
  deleteClient,
  deleteProspect,
  convertToClient,
  convertToProspect,
  
  // Tags (existant)
  getAvailableTags,
  createCustomTag,
  deleteCustomTag,
  addTagToClient,
  removeTagFromClient,
  getClientsByTag,
  generateTagsHTML,
  showTagSelector,
  createNewTagFromModal,
  saveTagsSelection,
  removeTagFromClientUI,
  deleteTagConfirm,
  showTagsManagementModal,
  createTagFromManagement,
  filterClientsByTags,
  showTagsFilter,
  applyTagsFilter,
  clearTagsFilter,
  removeTagFromPersonUI,

  // ✅ NOUVEAU : Canaux d'acquisition
  getAvailableCanaux,
  getCanalInfo,
  isValidCanal,
  migrerCanalAcquisition,
  
  // ✅ NOUVEAU : Canaux d'acquisition - ANALYTICS
  getClientsByCanal,
  getClientsStatsParCanal,
  getCanalAnalytics,
  getCanalAnalyticsFiltered,
  
  // ✅ NOUVEAU : Prestations depuis historique
  showPrestationDetailsFromHistory,
  editPrestationFromHistory,
  deletePrestationFromHistory
};

// Fonctions globales pour l'HTML
window.showClientDetails = showClientDetails;
// v1.0.9.0 : actions fidelite depuis la fiche
window.markFideliteFromFiche = markFideliteFromFiche;
window.resetFideliteFromFiche = resetFideliteFromFiche;
window.showTopClients = showTopClientsModal;
window.editClient = editClient;
window.editProspect = editProspect;
window.deleteClient = deleteClient;
window.deleteProspect = deleteProspect;
window.convertToClient = convertToClient;
window.convertToProspect = convertToProspect;
window.showTagSelector = showTagSelector;
window.createNewTagFromModal = createNewTagFromModal;
window.saveTagsSelection = saveTagsSelection;
window.removeTagFromClientUI = removeTagFromClientUI;
window.deleteTagConfirm = deleteTagConfirm;
window.createTagFromManagement = createTagFromManagement;
window.applyTagsFilter = applyTagsFilter;
window.clearTagsFilter = clearTagsFilter;
window.showPrestationDetailsFromHistory = showPrestationDetailsFromHistory;
window.editPrestationFromHistory = editPrestationFromHistory;
window.deletePrestationFromHistory = deletePrestationFromHistory;
window.removeTagFromPersonUI = removeTagFromPersonUI;
window.getAvailableCanaux = getAvailableCanaux;
window.getCanalInfo = getCanalInfo;
window.isValidCanal = isValidCanal;
window.migrerCanalAcquisition = migrerCanalAcquisition;

console.log('✅ Client Services avec système de parrainage complet chargé');