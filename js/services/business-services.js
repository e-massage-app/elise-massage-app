// ===== js/services/business-services.js =====
// Gestion des RDV et Prestations (logique metier)
// Version PWA : chaque mutation persiste dans Supabase

// ===== HELPER : persister silencieusement =====
async function _persist(table, action, data, mapFn) {
  try {
    if (action === 'insert') {
      await DataManager.insertEntity(table, data, mapFn);
    } else if (action === 'update') {
      await DataManager.updateEntity(table, data.id, data, mapFn);
    } else if (action === 'delete') {
      await DataManager.deleteEntity(table, data);
    }
  } catch (err) {
    console.error(`Erreur persistence ${table}/${action}:`, err);
  }
}

// ===== GESTION RDV =====
async function createRdv(formData) {
  const appData = DataManager.getAppData();

  const rdv = {
    id: formData.id || DataManager.generateId(),
    clientId: formData.clientId,
    date: formData.date,
    heure: formData.heure,
    type: formData.type,
    soinId: formData.soinId || null,
    duree: formData.duree,
    statut: formData.statut,
    notes: formData.notes,
    adresseMassage: formData.adresseMassage || '',
    distanceKm: formData.distanceKm || 0,
    fraisDeplacement: formData.fraisDeplacement || 0,
    sexe: formData.sexe || ''
  };

  const isEdit = formData.id && DataManager.getEditingId();
  if (isEdit) {
    const index = appData.rdv.findIndex(r => r.id === DataManager.getEditingId());
    if (index !== -1) {
      appData.rdv[index] = rdv;
      await _persist('rdv', 'update', rdv, DataManager.mapRdvToDb);
    }
  } else {
    appData.rdv.push(rdv);
    await _persist('rdv', 'insert', rdv, DataManager.mapRdvToDb);
  }

  return rdv;
}

async function deleteRdvById(rdvId) {
  const appData = DataManager.getAppData();
  appData.rdv = appData.rdv.filter(r => r.id !== rdvId);
  await _persist('rdv', 'delete', rdvId);
}

async function transformRdvToPrestation(rdvId) {
  const appData = DataManager.getAppData();
  const rdvIndex = appData.rdv.findIndex(r => r.id === rdvId);
  if (rdvIndex !== -1) {
    const rdv = appData.rdv[rdvIndex];

    // Supprimer prestations existantes sur ce creneau
    const prestsToRemove = appData.prestations.filter(p =>
      p.date === rdv.date && p.heure === rdv.heure && p.clientId === rdv.clientId
    );
    appData.prestations = appData.prestations.filter(p =>
      !(p.date === rdv.date && p.heure === rdv.heure && p.clientId === rdv.clientId)
    );
    for (const p of prestsToRemove) {
      await _persist('prestations', 'delete', p.id);
    }

    // Marquer le RDV comme transforme
    appData.rdv[rdvIndex].transformeEnPrestation = true;
    await _persist('rdv', 'update', appData.rdv[rdvIndex], DataManager.mapRdvToDb);
  }
}

async function annulerTransformationRdv(rdvId) {
  const appData = DataManager.getAppData();
  const rdvIndex = appData.rdv.findIndex(r => r.id === rdvId);
  if (rdvIndex !== -1) {
    const rdv = appData.rdv[rdvIndex];

    delete appData.rdv[rdvIndex].transformeEnPrestation;
    appData.rdv[rdvIndex].transformeEnPrestation = false;
    await _persist('rdv', 'update', appData.rdv[rdvIndex], DataManager.mapRdvToDb);

    // Supprimer depenses liees aux prestations
    const prestationsASupprimer = appData.prestations.filter(p => {
      const isSameSlot = p.date === rdv.date && p.heure === rdv.heure && p.clientId === rdv.clientId;
      return isSameSlot || (p.isTransformed && isSameSlot);
    });

    if (appData.depenses) {
      for (const prestation of prestationsASupprimer) {
        const depensesToRemove = appData.depenses.filter(d => d.prestationId === prestation.id);
        appData.depenses = appData.depenses.filter(d => d.prestationId !== prestation.id);
        for (const d of depensesToRemove) {
          await _persist('depenses', 'delete', d.id);
        }
      }
    }

    // Supprimer les prestations
    appData.prestations = appData.prestations.filter(p => {
      const isSameSlot = p.date === rdv.date && p.heure === rdv.heure && p.clientId === rdv.clientId;
      return !(isSameSlot || (p.isTransformed && isSameSlot));
    });
    for (const p of prestationsASupprimer) {
      await _persist('prestations', 'delete', p.id);
    }

    if (window.ViewManager) {
      if (typeof window.ViewManager.updateCalendar === 'function') window.ViewManager.updateCalendar();
      if (typeof window.ViewManager.updateDashboard === 'function') window.ViewManager.updateDashboard();
      if (typeof window.ViewManager.updateDepensesDisplay === 'function') window.ViewManager.updateDepensesDisplay();
      if (typeof window.ViewManager.updatePrestationsTable === 'function') window.ViewManager.updatePrestationsTable();
    }

    return true;
  }
  return false;
}

// ===== GESTION PRESTATIONS =====
async function createPrestation(formData) {
  const appData = DataManager.getAppData();

  const prestation = {
    id: formData.id || DataManager.generateId(),
    date: formData.date,
    heure: formData.heure,
    clientId: formData.clientId,
    type: formData.type,
    soinId: formData.soinId || null,
    duree: formData.duree,
    prix: formData.prix,
    tips: formData.tips || 0,
    notes: formData.notes,
    isTransformed: formData.isTransformed || false,
    adresseMassage: formData.adresseMassage || '',
    distanceKm: formData.distanceKm || 0,
    fraisDeplacement: formData.fraisDeplacement || 0,
    moyenPaiement: formData.moyenPaiement || ''
  };

  const isEdit = formData.id && DataManager.getEditingId();
  if (isEdit) {
    const index = appData.prestations.findIndex(p => p.id === DataManager.getEditingId());
    if (index !== -1) {
      appData.prestations[index] = prestation;
      await _persist('prestations', 'update', prestation, DataManager.mapPrestationToDb);
    }
  } else {
    appData.prestations.push(prestation);
    await _persist('prestations', 'insert', prestation, DataManager.mapPrestationToDb);
  }

  // Creer automatiquement une depense Transport si frais de deplacement
  if (formData.fraisDeplacement > 0) {
    await createAutomaticTransportDepense(prestation);
  }

  if (window.ViewManager) {
    if (typeof window.ViewManager.updateCalendar === 'function') window.ViewManager.updateCalendar();
    if (typeof window.ViewManager.updateDashboard === 'function') window.ViewManager.updateDashboard();
  }

  return prestation;
}

async function createAutomaticTransportDepense(prestation) {
  const appData = DataManager.getAppData();
  if (!appData.depenses) appData.depenses = [];

  const client = appData.clients.find(c => c.id === prestation.clientId);
  const clientNom = client ? `${client.prenom} ${client.nom}` : 'Client';

  const depenseTransport = {
    id: DataManager.generateId(),
    date: prestation.date,
    montant: prestation.fraisDeplacement,
    categorie: 'Transport',
    fournisseur: 'Frais kilometriques',
    description: `Deplacement ${prestation.type} - ${clientNom} (${prestation.distanceKm}km A/R)`,
    notes: `Genere automatiquement depuis prestation ${prestation.id}`,
    prestationId: prestation.id
  };

  appData.depenses.push(depenseTransport);
  await _persist('depenses', 'insert', depenseTransport, DataManager.mapDepenseToDb);
}

async function deletePrestationById(prestationId) {
  const appData = DataManager.getAppData();

  // Supprimer les depenses transport associees
  if (appData.depenses) {
    const depensesToRemove = appData.depenses.filter(d => d.prestationId === prestationId);
    appData.depenses = appData.depenses.filter(d => d.prestationId !== prestationId);
    for (const d of depensesToRemove) {
      await _persist('depenses', 'delete', d.id);
    }
  }

  appData.prestations = appData.prestations.filter(p => p.id !== prestationId);
  await _persist('prestations', 'delete', prestationId);

  if (window.ViewManager) {
    if (typeof window.ViewManager.updateCalendar === 'function') window.ViewManager.updateCalendar();
    if (typeof window.ViewManager.updateDashboard === 'function') window.ViewManager.updateDashboard();
    if (typeof window.ViewManager.updateDepensesDisplay === 'function') window.ViewManager.updateDepensesDisplay();
    if (typeof window.ViewManager.updatePrestationsTable === 'function') window.ViewManager.updatePrestationsTable();
  }
}

// Migration des frais de deplacement existants
async function migrerToutesPrestationsExistantes() {
  const appData = DataManager.getAppData();
  if (!appData.depenses) appData.depenses = [];

  let depensesCreees = 0;

  for (const prestation of appData.prestations) {
    if (prestation.fraisDeplacement && prestation.fraisDeplacement > 0) {
      const depenseExistante = appData.depenses.find(d =>
        d.prestationId === prestation.id && d.categorie === 'Transport'
      );

      if (!depenseExistante) {
        const client = appData.clients.find(c => c.id === prestation.clientId);
        const clientNom = client ? `${client.prenom} ${client.nom}` : 'Client';

        const nouvelleDepense = {
          id: DataManager.generateId(),
          date: prestation.date,
          categorie: 'Transport',
          description: `Deplacement ${prestation.type} - ${clientNom} (${prestation.distanceKm || '?'}km A/R)`,
          montant: prestation.fraisDeplacement,
          fournisseur: 'Frais kilometriques',
          prestationId: prestation.id,
          notes: `Genere automatiquement (migration)`
        };

        appData.depenses.push(nouvelleDepense);
        await _persist('depenses', 'insert', nouvelleDepense, DataManager.mapDepenseToDb);
        depensesCreees++;
      }
    }
  }

  return { depensesCreees };
}

// ===== GESTION DEPENSES =====
async function createDepense(formData) {
  const appData = DataManager.getAppData();

  const depense = {
    id: formData.id || DataManager.generateId(),
    date: formData.date,
    montant: formData.montant,
    categorie: formData.categorie,
    fournisseur: formData.fournisseur,
    description: formData.description,
    notes: formData.notes
  };

  if (!appData.depenses) appData.depenses = [];

  const isEdit = formData.id && DataManager.getEditingId();
  if (isEdit) {
    const index = appData.depenses.findIndex(d => d.id === DataManager.getEditingId());
    if (index !== -1) {
      appData.depenses[index] = depense;
      await _persist('depenses', 'update', depense, DataManager.mapDepenseToDb);
    }
  } else {
    appData.depenses.push(depense);
    await _persist('depenses', 'insert', depense, DataManager.mapDepenseToDb);
  }

  return depense;
}

async function deleteDepenseById(depenseId) {
  const appData = DataManager.getAppData();
  if (!appData.depenses) return;
  appData.depenses = appData.depenses.filter(d => d.id !== depenseId);
  await _persist('depenses', 'delete', depenseId);
}

// ===== CALCUL FRAIS DE DEPLACEMENT =====
async function calculateDistanceAndCost(inputId, distanceId, fraisId) {
  const adresseInput = document.getElementById(inputId);
  const distanceHidden = document.getElementById(distanceId);
  const fraisHidden = document.getElementById(fraisId);
  const resultDiv = document.getElementById(`${inputId}-result`);

  const adresseMassage = adresseInput.value.trim();

  if (!adresseMassage) {
    resultDiv.innerHTML = '<span style="color: #e74c3c;">Veuillez saisir une adresse</span>';
    return;
  }

  if (!DataManager.isAdresseSalonConfigured()) {
    resultDiv.innerHTML = '<span style="color: #e74c3c;">Adresse du salon non configuree dans les parametres</span>';
    return;
  }

  resultDiv.innerHTML = '<span style="color: #f39c12;">Calcul en cours...</span>';

  try {
    const adresseSalon = DataManager.getAdresseSalon();
    const distanceResult = await Calculations.calculateDistance(adresseSalon, adresseMassage);

    if (distanceResult.error) {
      resultDiv.innerHTML = `<span style="color: #e74c3c;">${distanceResult.error}</span>`;
      distanceHidden.value = '0';
      fraisHidden.value = '0';
      return;
    }

    const distanceKm = distanceResult.distanceKm;
    const fraisDeplacement = DataManager.calculateFraisDeplacement(distanceKm);

    distanceHidden.value = distanceKm;
    fraisHidden.value = fraisDeplacement;

    if (distanceKm === 0 || fraisDeplacement === 0) {
      resultDiv.innerHTML = '<span style="color: #27ae60;">Massage au salon (pas de frais)</span>';
    } else {
      const methodText = distanceResult.method === 'routing' ? 'Itineraire precis' : 'Estimation route';
      const dureeText = distanceResult.dureeMinutes ? ` (~${distanceResult.dureeMinutes}min)` : '';
      resultDiv.innerHTML = `
        <div style="background: #e8f5e8; padding: 0.5rem; border-radius: 6px; border: 1px solid #c3e6cb;">
          <div style="color: #27ae60; font-weight: 600;">Distance: ${distanceKm} km${dureeText}</div>
          <div style="color: var(--beige-dore); font-weight: 600;">Frais estimes: ${fraisDeplacement.toFixed(2)} &euro; (A/R)</div>
          <small style="color: #666;">${methodText}</small>
        </div>
      `;
    }
  } catch (error) {
    resultDiv.innerHTML = `<span style="color: #e74c3c;">Erreur: ${error.message}</span>`;
    distanceHidden.value = '0';
    fraisHidden.value = '0';
  }
}

function setupAutoCalculateAddress(inputId, distanceId, fraisId) {
  const input = document.getElementById(inputId);
  if (!input) return;
  let timeoutId;
  input.addEventListener('blur', () => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => {
      if (input.value.trim().length > 10) {
        calculateDistanceAndCost(inputId, distanceId, fraisId);
      }
    }, 500);
  });
}

// ===== CALENDAR UTILITIES =====
function generateICSCalendar() {
  const appData = DataManager.getAppData();
  const rdvFuturs = appData.rdv.filter(rdv => new Date(`${rdv.date}T${rdv.heure}`) >= new Date());

  let icsContent = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Elise Massage//Agenda//FR',
    'CALSCALE:GREGORIAN'
  ];

  rdvFuturs.forEach(rdv => {
    const client = appData.clients.find(c => c.id === rdv.clientId);
    const clientNom = client ? `${client.prenom} ${client.nom}` : 'Client';
    const startDate = new Date(`${rdv.date}T${rdv.heure}`);
    const endDate = new Date(startDate.getTime() + (rdv.duree || 60) * 60 * 1000);
    const formatIcsDate = (date) => date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';

    icsContent.push(
      'BEGIN:VEVENT',
      `UID:${rdv.id}@elisemassage.local`,
      `DTSTAMP:${formatIcsDate(new Date())}`,
      `DTSTART:${formatIcsDate(startDate)}`,
      `DTEND:${formatIcsDate(endDate)}`,
      `SUMMARY:${rdv.type} - ${clientNom}`,
      `DESCRIPTION:Type: ${rdv.type}\\nDuree: ${rdv.duree || 60}min\\nStatut: ${rdv.statut}${rdv.notes ? '\\nNotes: ' + rdv.notes : ''}`,
      `STATUS:${rdv.statut === 'confirme' ? 'CONFIRMED' : 'TENTATIVE'}`,
      'END:VEVENT'
    );
  });

  icsContent.push('END:VCALENDAR');
  return icsContent.join('\n');
}

// ===== BONS CADEAUX =====

async function createBonCadeau(bonData) {
  const appData = DataManager.getAppData();
  if (!appData.bonsCadeaux) appData.bonsCadeaux = [];

  const newBon = {
    id: bonData.id || DataManager.generateId(),
    dateAchat: bonData.dateAchat,
    dateDebut: bonData.dateDebut || bonData.dateAchat,
    dateExpiration: bonData.dateExpiration,
    acheteurNom: bonData.acheteurNom || '',
    acheteurClientId: bonData.acheteurClientId || null,
    acheteurTelephone: bonData.acheteurTelephone || '',
    acheteurEmail: bonData.acheteurEmail || '',
    beneficiaireNom: bonData.beneficiaireNom || '',
    beneficiaireClientId: bonData.beneficiaireClientId || null,
    description: bonData.description,
    montant: bonData.montant,
    moyenPaiement: bonData.moyenPaiement,
    statut: 'actif',
    prestationId: null,
    dateUtilisation: null,
    forceUtilise: false,
    notes: bonData.notes || '',
    createdAt: new Date().toISOString()
  };

  appData.bonsCadeaux.push(newBon);
  await _persist('bons_cadeaux', 'insert', newBon, DataManager.mapBonCadeauToDb);
  return newBon;
}

async function updateBonCadeau(bonData) {
  const appData = DataManager.getAppData();
  const index = appData.bonsCadeaux.findIndex(b => b.id === bonData.id);
  if (index === -1) return null;

  const existingBon = appData.bonsCadeaux[index];
  appData.bonsCadeaux[index] = {
    ...existingBon,
    dateAchat: bonData.dateAchat,
    dateDebut: bonData.dateDebut || bonData.dateAchat,
    dateExpiration: bonData.dateExpiration,
    acheteurNom: bonData.acheteurNom,
    acheteurClientId: bonData.acheteurClientId,
    acheteurTelephone: bonData.acheteurTelephone,
    acheteurEmail: bonData.acheteurEmail,
    beneficiaireNom: bonData.beneficiaireNom,
    beneficiaireClientId: bonData.beneficiaireClientId || existingBon.beneficiaireClientId,
    description: bonData.description,
    montant: bonData.montant,
    moyenPaiement: bonData.moyenPaiement,
    notes: bonData.notes,
    updatedAt: new Date().toISOString()
  };

  await _persist('bons_cadeaux', 'update', appData.bonsCadeaux[index], DataManager.mapBonCadeauToDb);
  return appData.bonsCadeaux[index];
}

async function deleteBonCadeau(bonId) {
  const appData = DataManager.getAppData();
  const index = appData.bonsCadeaux.findIndex(b => b.id === bonId);
  if (index !== -1) {
    appData.bonsCadeaux.splice(index, 1);
    await _persist('bons_cadeaux', 'delete', bonId);
    return true;
  }
  return false;
}

async function rembourserBonCadeau(bonId) {
  const appData = DataManager.getAppData();
  const bon = appData.bonsCadeaux.find(b => b.id === bonId);
  if (!bon) return false;

  bon.statut = 'rembourse';
  bon.dateRemboursement = new Date().toISOString().split('T')[0];
  await _persist('bons_cadeaux', 'update', bon, DataManager.mapBonCadeauToDb);
  return true;
}

async function forcerUtilisationBonExpire(bonId) {
  const appData = DataManager.getAppData();
  const bon = appData.bonsCadeaux.find(b => b.id === bonId);
  if (!bon) return false;

  bon.statut = 'actif';
  bon.forceUtilise = true;
  await _persist('bons_cadeaux', 'update', bon, DataManager.mapBonCadeauToDb);
  return true;
}

async function utiliserBonCadeau(bonId, prestationId) {
  const appData = DataManager.getAppData();
  const bon = appData.bonsCadeaux.find(b => b.id === bonId);
  if (!bon) return false;

  bon.statut = 'utilise';
  bon.prestationId = prestationId;
  bon.dateUtilisation = new Date().toISOString().split('T')[0];
  await _persist('bons_cadeaux', 'update', bon, DataManager.mapBonCadeauToDb);
  return true;
}

async function createClientMinimal(nomComplet) {
  const appData = DataManager.getAppData();
  const parts = nomComplet.trim().split(' ');
  let prenom = parts[0] || nomComplet;
  let nom = parts.slice(1).join(' ') || '';

  const newClient = {
    id: DataManager.generateId(),
    prenom: prenom,
    nom: nom,
    telephone: '',
    email: '',
    adresse: '',
    ville: '',
    notes: 'Client cree automatiquement depuis un bon cadeau',
    tags: [],
    createdAt: new Date().toISOString()
  };

  appData.clients.push(newClient);
  await _persist('clients', 'insert', newClient, DataManager.mapClientToDb);
  return newClient;
}

function getBonsCadeauxUtilisablesPourClient(clientId) {
  const appData = DataManager.getAppData();
  const today = new Date().toISOString().split('T')[0];
  return appData.bonsCadeaux.filter(bon => {
    if (bon.statut !== 'actif') return false;
    if (bon.beneficiaireClientId && bon.beneficiaireClientId !== clientId) return false;
    if (bon.dateExpiration < today && !bon.forceUtilise) return false;
    return true;
  });
}

// ===== EXPORTS GLOBAUX =====
window.BusinessServices = {
  createRdv,
  deleteRdvById,
  transformRdvToPrestation,
  annulerTransformationRdv,
  createPrestation,
  deletePrestationById,
  migrerToutesPrestationsExistantes,
  createDepense,
  deleteDepenseById,
  calculateDistanceAndCost,
  setupAutoCalculateAddress,
  generateICSCalendar,
  createBonCadeau,
  updateBonCadeau,
  deleteBonCadeau,
  rembourserBonCadeau,
  forcerUtilisationBonExpire,
  utiliserBonCadeau,
  createClientMinimal,
  getBonsCadeauxUtilisablesPourClient
};

console.log('Business Services PWA charge');
