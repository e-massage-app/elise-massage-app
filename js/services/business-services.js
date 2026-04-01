// ===== js/services/business-services.js =====
// Gestion des RDV et Prestations (logique métier)

// ===== GESTION RDV =====
function createRdv(formData) {
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
    // NOUVEAUX CHAMPS POUR FRAIS DE DÉPLACEMENT
    adresseMassage: formData.adresseMassage || '',
    distanceKm: formData.distanceKm || 0,
    fraisDeplacement: formData.fraisDeplacement || 0,
    // CHAMP SEXE POUR STATISTIQUES
    sexe: formData.sexe || ''
  };
  
  if (formData.id && DataManager.getEditingId()) {
    const index = appData.rdv.findIndex(r => r.id === DataManager.getEditingId());
    if (index !== -1) {
      appData.rdv[index] = rdv;
    }
  } else {
    appData.rdv.push(rdv);
  }
  
  return rdv;
}

function deleteRdvById(rdvId) {
  const appData = DataManager.getAppData();
  appData.rdv = appData.rdv.filter(r => r.id !== rdvId);
}

function transformRdvToPrestation(rdvId) {
  const appData = DataManager.getAppData();
  const rdvIndex = appData.rdv.findIndex(r => r.id === rdvId);
  if (rdvIndex !== -1) {
    const rdv = appData.rdv[rdvIndex];
    
    // D'abord supprimer toute prestation existante sur ce créneau pour éviter les doublons
    appData.prestations = appData.prestations.filter(p => 
      !(p.date === rdv.date && 
        p.heure === rdv.heure && 
        p.clientId === rdv.clientId)
    );
    
    // Ensuite marquer le RDV comme transformé
    appData.rdv[rdvIndex].transformeEnPrestation = true;
  }
}

function annulerTransformationRdv(rdvId) {
  const appData = DataManager.getAppData();
  const rdvIndex = appData.rdv.findIndex(r => r.id === rdvId);
  if (rdvIndex !== -1) {
    const rdv = appData.rdv[rdvIndex];
    
    // Retirer le marquage de transformation
    delete appData.rdv[rdvIndex].transformeEnPrestation;
    
    // ✅ CORRECTION : Récupérer les IDs des prestations à supprimer pour supprimer leurs dépenses aussi
    const prestationsASupprimer = appData.prestations.filter(p => {
      const isSameSlot = p.date === rdv.date && p.heure === rdv.heure && p.clientId === rdv.clientId;
      const isTransformedFromThisRdv = p.isTransformed && isSameSlot;
      return isSameSlot || isTransformedFromThisRdv;
    });
    
    // ✅ CORRECTION : Supprimer les dépenses transport liées aux prestations supprimées
    if (appData.depenses && prestationsASupprimer.length > 0) {
      const depensesAvant = appData.depenses.length;
      
      prestationsASupprimer.forEach(prestation => {
        // Supprimer les dépenses liées à cette prestation
        appData.depenses = appData.depenses.filter(d => d.prestationId !== prestation.id);
      });
      
      const depensesApres = appData.depenses.length;
      if (depensesAvant > depensesApres) {

      }
    }
    
    // Supprimer TOUTES les prestations correspondantes (par date/heure/client ET par transformation)
    appData.prestations = appData.prestations.filter(p => {
      // Supprimer si c'est la même date/heure/client OU si c'est marqué comme transformé du même RDV
      const isSameSlot = p.date === rdv.date && p.heure === rdv.heure && p.clientId === rdv.clientId;
      const isTransformedFromThisRdv = p.isTransformed && isSameSlot;
      
      return !(isSameSlot || isTransformedFromThisRdv);
    });
    
    // ✅ CORRECTION : Rafraîchir les vues après l'annulation
    if (window.ViewManager) {
      if (typeof window.ViewManager.updateCalendar === 'function') {
        window.ViewManager.updateCalendar();
      }
      if (typeof window.ViewManager.updateDashboard === 'function') {
        window.ViewManager.updateDashboard();
      }
      if (typeof window.ViewManager.updateDepensesDisplay === 'function') {
        window.ViewManager.updateDepensesDisplay();
      }
      if (typeof window.ViewManager.updatePrestationsTable === 'function') {
        window.ViewManager.updatePrestationsTable();
      }
    }
    
    return true;
  }
  return false;
}

// ===== GESTION PRESTATIONS =====
function createPrestation(formData) {
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
    // NOUVEAUX CHAMPS POUR FRAIS DE DÉPLACEMENT
    adresseMassage: formData.adresseMassage || '',
    distanceKm: formData.distanceKm || 0,
    fraisDeplacement: formData.fraisDeplacement || 0,
    // NOUVEAU CHAMP POUR MOYEN DE PAIEMENT
    moyenPaiement: formData.moyenPaiement || ''
  };
  
  if (formData.id && DataManager.getEditingId()) {
    const index = appData.prestations.findIndex(p => p.id === DataManager.getEditingId());
    if (index !== -1) {
      appData.prestations[index] = prestation;
    }
  } else {
    appData.prestations.push(prestation);
  }
  
  // NOUVEAU : Créer automatiquement une dépense Transport si frais de déplacement
  if (formData.fraisDeplacement > 0) {
    createAutomaticTransportDepense(prestation);
  }
  
  // ✅ CORRECTION : Rafraîchir le calendrier après ajout/modification
  if (window.ViewManager && typeof window.ViewManager.updateCalendar === 'function') {
    window.ViewManager.updateCalendar();
  }
  
  // ✅ CORRECTION : Rafraîchir le dashboard aussi pour les KPIs
  if (window.ViewManager && typeof window.ViewManager.updateDashboard === 'function') {
    window.ViewManager.updateDashboard();
  }
  
  return prestation;
}

// NOUVELLE FONCTION : Créer automatiquement une dépense Transport
function createAutomaticTransportDepense(prestation) {
  const appData = DataManager.getAppData();
  if (!appData.depenses) {
    appData.depenses = [];
  }
  
  const client = appData.clients.find(c => c.id === prestation.clientId);
  const clientNom = client ? `${client.prenom} ${client.nom}` : 'Client';
  
  const depenseTransport = {
    id: DataManager.generateId(),
    date: prestation.date,
    montant: prestation.fraisDeplacement,
    categorie: 'Transport',
    fournisseur: 'Frais kilométriques',
    description: `Déplacement ${prestation.type} - ${clientNom} (${prestation.distanceKm}km A/R)`,
    notes: `Généré automatiquement depuis prestation ${prestation.id}`,
    prestationId: prestation.id // Lien vers la prestation
  };
  
  appData.depenses.push(depenseTransport);
}

function deletePrestationById(prestationId) {
  const appData = DataManager.getAppData();
  
  // ✅ CORRECTION : Supprimer aussi la dépense transport automatique associée si elle existe
  if (appData.depenses) {
    const depensesAvant = appData.depenses.length;
    appData.depenses = appData.depenses.filter(d => d.prestationId !== prestationId);
    const depensesApres = appData.depenses.length;
    
    if (depensesAvant > depensesApres) {
    }
  }
  
  // Supprimer la prestation
  const prestationsAvant = appData.prestations.length;
  appData.prestations = appData.prestations.filter(p => p.id !== prestationId);
  const prestationsApres = appData.prestations.length;
  
  // ✅ CORRECTION : Rafraîchir les vues après suppression
  if (prestationsAvant > prestationsApres) {
    
    // Rafraîchir le calendrier
    if (window.ViewManager && typeof window.ViewManager.updateCalendar === 'function') {
      window.ViewManager.updateCalendar();
    }
    
    // Rafraîchir le dashboard
    if (window.ViewManager && typeof window.ViewManager.updateDashboard === 'function') {
      window.ViewManager.updateDashboard();
    }
    
    // Rafraîchir la table des dépenses si on est sur cet onglet
    if (window.ViewManager && typeof window.ViewManager.updateDepensesDisplay === 'function') {
      window.ViewManager.updateDepensesDisplay();
    }
    
    // Rafraîchir la table des prestations
    if (window.ViewManager && typeof window.ViewManager.updatePrestationsTable === 'function') {
      window.ViewManager.updatePrestationsTable();
    }
  }
}

// 🔄 MIGRATION DES FRAIS DE DÉPLACEMENT EXISTANTS
function migrerToutesPrestationsExistantes() {
  
  const appData = DataManager.getAppData();
  if (!appData.depenses) {
    appData.depenses = [];
  }
  
  let prestationsMigrees = 0;
  let depensesCreees = 0;
  let depensesIgnorees = 0;
  
  // Parcourir toutes les prestations existantes
  appData.prestations.forEach(prestation => {
    // Vérifier si elle a des frais de déplacement
    if (prestation.fraisDeplacement && prestation.fraisDeplacement > 0) {
      
      // Vérifier si une dépense transport existe déjà pour cette prestation
      const depenseExistante = appData.depenses.find(d => 
        d.prestationId === prestation.id && 
        d.categorie === 'Transport'
      );
      
      // Si pas de dépense existante, créer
      if (!depenseExistante) {
        const client = appData.clients.find(c => c.id === prestation.clientId);
        const clientNom = client ? `${client.prenom} ${client.nom}` : 'Client';
        
        const nouvelleDépense = {
          id: DataManager.generateId(),
          date: prestation.date,
          categorie: 'Transport',
          description: `Déplacement ${prestation.type} - ${clientNom} (${prestation.distanceKm || '?'}km A/R)`,
          montant: prestation.fraisDeplacement,
          fournisseur: 'Frais kilométriques',
          prestationId: prestation.id, // Lien vers la prestation
          notes: `Généré automatiquement depuis prestation ${prestation.id} (migration)`
        };
        
        appData.depenses.push(nouvelleDépense);
        depensesCreees++;
        
      } else {
        depensesIgnorees++;
      }
      
      prestationsMigrees++;
    }
  });
  
  console.log(`🎉 Migration terminée:`);
  console.log(`   📋 ${prestationsMigrees} prestations avec frais de déplacement trouvées`);
  console.log(`   ✅ ${depensesCreees} nouvelles dépenses transport créées`);
  console.log(`   ⚠️ ${depensesIgnorees} dépenses déjà existantes (ignorées)`);
  
  // Sauvegarder immédiatement
  DataManager.saveData();
  
  return {
    prestationsMigrees,
    depensesCreees,
    depensesIgnorees
  };
}

// ===== GESTION DÉPENSES =====
function createDepense(formData) {
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
  
  if (!appData.depenses) {
    appData.depenses = [];
  }
  
  if (formData.id && DataManager.getEditingId()) {
    const index = appData.depenses.findIndex(d => d.id === DataManager.getEditingId());
    if (index !== -1) {
      appData.depenses[index] = depense;
    }
  } else {
    appData.depenses.push(depense);
  }
  
  return depense;
}

function deleteDepenseById(depenseId) {
  const appData = DataManager.getAppData();
  if (!appData.depenses) return;
  appData.depenses = appData.depenses.filter(d => d.id !== depenseId);
}

// ===== CALCUL FRAIS DE DÉPLACEMENT - FONCTIONS INTERFACE =====

// Fonction pour calculer distance et coût automatiquement
async function calculateDistanceAndCost(inputId, distanceId, fraisId) {
  const adresseInput = document.getElementById(inputId);
  const distanceHidden = document.getElementById(distanceId);
  const fraisHidden = document.getElementById(fraisId);
  const resultDiv = document.getElementById(`${inputId}-result`);
  
  const adresseMassage = adresseInput.value.trim();
  
  if (!adresseMassage) {
    resultDiv.innerHTML = '<span style="color: #e74c3c;">❌ Veuillez saisir une adresse</span>';
    return;
  }
  
  // Vérifier que l'adresse du salon est configurée
  if (!DataManager.isAdresseSalonConfigured()) {
    resultDiv.innerHTML = '<span style="color: #e74c3c;">❌ Adresse du salon non configurée dans les paramètres</span>';
    return;
  }
  
  resultDiv.innerHTML = '<span style="color: #f39c12;">🔄 Calcul en cours...</span>';
  
  try {
    const adresseSalon = DataManager.getAdresseSalon();
    const distanceResult = await Calculations.calculateDistance(adresseSalon, adresseMassage);
    
    if (distanceResult.error) {
      resultDiv.innerHTML = `<span style="color: #e74c3c;">❌ ${distanceResult.error}</span>`;
      distanceHidden.value = '0';
      fraisHidden.value = '0';
      return;
    }
    
    const distanceKm = distanceResult.distanceKm;
    const fraisDeplacement = DataManager.calculateFraisDeplacement(distanceKm);
    
    // Sauvegarder les valeurs calculées
    distanceHidden.value = distanceKm;
    fraisHidden.value = fraisDeplacement;
    
    // Afficher le résultat
    if (distanceKm === 0 || fraisDeplacement === 0) {
      resultDiv.innerHTML = '<span style="color: #27ae60;">✅ Massage au salon (pas de frais)</span>';
    } else {
      const methodText = distanceResult.method === 'routing' ? 'Itinéraire précis' : 'Estimation route';
      const dureeText = distanceResult.dureeMinutes ? ` (~${distanceResult.dureeMinutes}min)` : '';
      
      resultDiv.innerHTML = `
        <div style="background: #e8f5e8; padding: 0.5rem; border-radius: 6px; border: 1px solid #c3e6cb;">
          <div style="color: #27ae60; font-weight: 600;">✅ Distance: ${distanceKm} km${dureeText}</div>
          <div style="color: var(--beige-dore); font-weight: 600;">💰 Frais estimés: ${fraisDeplacement.toFixed(2)} € (A/R)</div>
          <small style="color: #666;">${methodText} - Calcul basé sur vos paramètres</small>
        </div>
      `;
    }
  } catch (error) {
    resultDiv.innerHTML = `<span style="color: #e74c3c;">❌ Erreur: ${error.message}</span>`;
    distanceHidden.value = '0';
    fraisHidden.value = '0';
  }
}

// Fonction pour gérer la saisie automatique d'adresse (optionnel - calcul au blur)
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
    
    const formatIcsDate = (date) => {
      return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    };
    
    icsContent.push(
      'BEGIN:VEVENT',
      `UID:${rdv.id}@elisemassage.local`,
      `DTSTAMP:${formatIcsDate(new Date())}`,
      `DTSTART:${formatIcsDate(startDate)}`,
      `DTEND:${formatIcsDate(endDate)}`,
      `SUMMARY:${rdv.type} - ${clientNom}`,
      `DESCRIPTION:Type: ${rdv.type}\\nDurée: ${rdv.duree || 60}min\\nStatut: ${rdv.statut}${rdv.notes ? '\\nNotes: ' + rdv.notes : ''}`,
      `STATUS:${rdv.statut === 'confirmé' ? 'CONFIRMED' : 'TENTATIVE'}`,
      'END:VEVENT'
    );
  });
  
  icsContent.push('END:VCALENDAR');
  return icsContent.join('\n');
}

// ===== BONS CADEAUX - LOGIQUE MÉTIER =====

function createBonCadeau(bonData) {
  const appData = DataManager.getAppData();

  if (!appData.bonsCadeaux) {
    appData.bonsCadeaux = [];
  }

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
  console.log('🎁 Bon cadeau créé:', newBon);

  return newBon;
}

function updateBonCadeau(bonData) {
  const appData = DataManager.getAppData();
  const index = appData.bonsCadeaux.findIndex(b => b.id === bonData.id);

  if (index === -1) {
    console.error('Bon cadeau non trouvé:', bonData.id);
    return null;
  }

  // Préserver les champs qui ne doivent pas être modifiés
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

  console.log('🎁 Bon cadeau mis à jour:', appData.bonsCadeaux[index]);
  return appData.bonsCadeaux[index];
}

function deleteBonCadeau(bonId) {
  const appData = DataManager.getAppData();
  const index = appData.bonsCadeaux.findIndex(b => b.id === bonId);

  if (index !== -1) {
    appData.bonsCadeaux.splice(index, 1);
    console.log('🎁 Bon cadeau supprimé:', bonId);
    return true;
  }

  return false;
}

function rembourserBonCadeau(bonId) {
  const appData = DataManager.getAppData();
  const bon = appData.bonsCadeaux.find(b => b.id === bonId);

  if (!bon) {
    console.error('Bon cadeau non trouvé:', bonId);
    return false;
  }

  bon.statut = 'rembourse';
  bon.dateRemboursement = new Date().toISOString().split('T')[0];
  console.log('🎁 Bon cadeau remboursé:', bon);

  return true;
}

function forcerUtilisationBonExpire(bonId) {
  const appData = DataManager.getAppData();
  const bon = appData.bonsCadeaux.find(b => b.id === bonId);

  if (!bon) {
    console.error('Bon cadeau non trouvé:', bonId);
    return false;
  }

  // Remettre le bon en actif pour qu'il puisse être utilisé
  bon.statut = 'actif';
  bon.forceUtilise = true;
  console.log('🎁 Bon cadeau expiré forcé pour utilisation:', bon);

  return true;
}

function utiliserBonCadeau(bonId, prestationId) {
  const appData = DataManager.getAppData();
  const bon = appData.bonsCadeaux.find(b => b.id === bonId);

  if (!bon) {
    console.error('Bon cadeau non trouvé:', bonId);
    return false;
  }

  bon.statut = 'utilise';
  bon.prestationId = prestationId;
  bon.dateUtilisation = new Date().toISOString().split('T')[0];

  console.log('🎁 Bon cadeau utilisé:', bon);
  return true;
}

function createClientMinimal(nomComplet) {
  const appData = DataManager.getAppData();

  // Essayer de séparer prénom et nom
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
    preferences: {},
    notes: 'Client créé automatiquement depuis un bon cadeau',
    tags: [],
    createdAt: new Date().toISOString()
  };

  appData.clients.push(newClient);
  console.log('👤 Client minimal créé depuis bon cadeau:', newClient);

  return newClient;
}

function getBonsCadeauxUtilisablesPourClient(clientId) {
  const appData = DataManager.getAppData();
  const today = new Date().toISOString().split('T')[0];

  return appData.bonsCadeaux.filter(bon => {
    // Doit être actif
    if (bon.statut !== 'actif') return false;

    // Si un bénéficiaire est spécifié, doit correspondre
    if (bon.beneficiaireClientId && bon.beneficiaireClientId !== clientId) return false;

    // Soit non expiré, soit forcé
    if (bon.dateExpiration < today && !bon.forceUtilise) return false;

    return true;
  });
}

// ===== EXPORTS GLOBAUX =====
window.BusinessServices = {
  // RDV
  createRdv,
  deleteRdvById,
  transformRdvToPrestation,
  annulerTransformationRdv,

  // Prestations
  createPrestation,
  deletePrestationById,
  migrerToutesPrestationsExistantes,

  // Dépenses
  createDepense,
  deleteDepenseById,

  // Frais déplacement
  calculateDistanceAndCost,
  setupAutoCalculateAddress,

  // Calendar
  generateICSCalendar,

  // Bons Cadeaux
  createBonCadeau,
  updateBonCadeau,
  deleteBonCadeau,
  rembourserBonCadeau,
  forcerUtilisationBonExpire,
  utiliserBonCadeau,
  createClientMinimal,
  getBonsCadeauxUtilisablesPourClient
};

console.log('✅ Business Services chargé');