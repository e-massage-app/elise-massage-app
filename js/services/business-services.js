// ===== js/services/business-services.js =====
// Gestion des RDV et Prestations (logique metier)
// Version PWA : chaque mutation persiste dans Supabase

// ===== HELPER : persister + signaler les echecs a l'utilisateur =====
// Retourne true en cas de succes, false sinon (sans throw pour limiter
// l'impact sur les callers qui ne sont pas instrumentes).
// En cas d'echec, affiche une alerte BLOQUANTE pour eviter le faux positif
// "j'ai sauvegarde mais en fait c'etait que dans le cache".
async function _persist(table, action, data, mapFn) {
  try {
    if (action === 'insert') {
      await DataManager.insertEntity(table, data, mapFn);
    } else if (action === 'update') {
      await DataManager.updateEntity(table, data.id, data, mapFn);
    } else if (action === 'delete') {
      await DataManager.deleteEntity(table, data);
    }
    return true;
  } catch (err) {
    console.error(`Erreur persistence ${table}/${action}:`, err);
    const labels = {
      rdv: 'RDV', prestations: 'prestation', depenses: 'depense',
      bons_cadeaux: 'bon cadeau', clients: 'client', prospects: 'prospect',
      collaborateurs: 'collaborateur'
    };
    const verbe = action === 'insert' ? 'enregistre' : (action === 'update' ? 'mis a jour' : 'supprime');
    if (typeof alert !== 'undefined') {
      alert(`Echec sauvegarde ${labels[table] || table} (${verbe}).\n\nLe changement est visible localement mais n'a PAS ete sauvegarde en base.\n\nVerifiez votre connexion, rechargez l'app, et recommencez.`);
    }
    return false;
  }
}

// ===== GESTION RDV =====
// v1.2.0.0 : base d'abord, cache ensuite ; null si l'enregistrement a echoue
// (_persist a deja alerte) : l'appelant garde la fenetre ouverte.
async function createRdv(formData) {
  const appData = DataManager.getAppData();

  const champs = {
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
    if (index === -1) return null;
    // v1.2.0.0 : le formulaire ne connait ni transformeEnPrestation ni bonCadeauId :
    // reconstruire le RDV les effacait (base : false / null). On fusionne.
    const rdv = { ...appData.rdv[index], ...champs };
    if (!(await _persist('rdv', 'update', rdv, DataManager.mapRdvToDb))) return null;
    appData.rdv[index] = rdv;
    return rdv;
  }

  const rdv = { id: formData.id || DataManager.generateId(), ...champs };
  if (!(await _persist('rdv', 'insert', rdv, DataManager.mapRdvToDb))) return null;
  appData.rdv.push(rdv);
  return rdv;
}

async function deleteRdvById(rdvId) {
  const appData = DataManager.getAppData();

  // v1.0.7.3 : si le RDV avait ete transforme en prestation, on supprime aussi
  // la prestation liee. Sinon la prestation reste en DB et le calendrier la
  // re-affiche au prochain F5 -> 2 clics pour "tout" supprimer.
  // v1.2.0.0 : prestation retrouvee par rdvId, et supprimee par deletePrestationById
  // (depenses Transport + carte cadeau liberee ; DB-first, arret au premier echec).
  const rdv = appData.rdv.find(r => r.id === rdvId);
  if (rdv && rdv.transformeEnPrestation) {
    for (const presta of RdvPrestations.prestationsDuRdv(rdv, appData.prestations)) {
      if (!(await deletePrestationById(presta.id))) return false;
    }
  }

  // v1.0.7.3 : DB-first pour le RDV lui-meme
  const ok = await _persist('rdv', 'delete', rdvId);
  if (!ok) return false;
  appData.rdv = appData.rdv.filter(r => r.id !== rdvId);
  return true;
}

// v1.2.0.0 : appele APRES l'enregistrement de la prestation (prestationId) : si
// l'insertion echoue, le RDV n'est pas marque transforme. Les autres prestations
// du RDV (essai precedent, saisie a la main sur le creneau) sont remplacees par
// celle-ci, via deletePrestationById (carte cadeau liberee, depense Transport retiree).
async function transformRdvToPrestation(rdvId, prestationId) {
  const appData = DataManager.getAppData();
  const rdv = appData.rdv.find(r => r.id === rdvId);
  if (!rdv) return false;

  const anciennes = RdvPrestations.prestationsDuRdv(rdv, appData.prestations).filter(p => p.id !== prestationId);
  for (const p of anciennes) {
    if (!(await deletePrestationById(p.id))) return false;
  }

  if (!(await _persist('rdv', 'update', { ...rdv, transformeEnPrestation: true }, DataManager.mapRdvToDb))) return false;
  rdv.transformeEnPrestation = true;
  return true;
}

async function annulerTransformationRdv(rdvId) {
  const appData = DataManager.getAppData();
  const rdv = appData.rdv.find(r => r.id === rdvId);
  if (!rdv) return false;

  // v1.2.0.0 : prestations du RDV (rdvId, sinon meme creneau) supprimees d'abord par
  // deletePrestationById : la carte cadeau redevient active et la depense Transport
  // part avec. Le RDV ne retrouve son etat normal que si tout a ete supprime.
  for (const p of RdvPrestations.prestationsDuRdv(rdv, appData.prestations)) {
    if (!(await deletePrestationById(p.id))) return false;
  }

  if (!(await _persist('rdv', 'update', { ...rdv, transformeEnPrestation: false }, DataManager.mapRdvToDb))) return false;
  rdv.transformeEnPrestation = false;

  if (window.ViewManager) {
    if (typeof window.ViewManager.updateCalendar === 'function') window.ViewManager.updateCalendar();
    if (typeof window.ViewManager.updateDashboard === 'function') window.ViewManager.updateDashboard();
    if (typeof window.ViewManager.updateDepensesDisplay === 'function') window.ViewManager.updateDepensesDisplay();
    if (typeof window.ViewManager.updatePrestationsTable === 'function') window.ViewManager.updatePrestationsTable();
  }

  return true;
}

// ===== GESTION PRESTATIONS =====
// v1.2.0.0 : base d'abord, cache ensuite. Retourne null si l'enregistrement a
// echoue (_persist a deja alerte) : la validation d'un RDV s'arrete alors sans
// marquer le RDV transforme ni la carte cadeau utilisee.
async function createPrestation(formData) {
  const appData = DataManager.getAppData();

  const isEdit = formData.id && DataManager.getEditingId();
  const existante = isEdit ? appData.prestations.find(p => p.id === DataManager.getEditingId()) : null;

  // v1.1.0.0 : la carte cadeau suit la prestation (elle etait perdue : la
  // prestation creee n'avait pas de bon_cadeau_id, et une modification
  // l'effacait). Le formulaire de modification ne propose pas de choisir la
  // carte : on garde celle de la prestation tant qu'elle reste reglee par
  // carte cadeau ; si le moyen de paiement change, le lien est retire.
  let bonCadeauId = formData.bonCadeauId || null;
  if (!bonCadeauId && isEdit && formData.moyenPaiement === 'Bon cadeau') {
    bonCadeauId = (existante && existante.bonCadeauId) || null;
  }

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
    // v1.2.0.0 : le formulaire de modification ne connait ni le RDV d'origine ni
    // la transformation : on les garde (sinon une modification les effacait).
    isTransformed: formData.isTransformed || (existante ? !!existante.isTransformed : false),
    rdvId: formData.rdvId || (existante ? existante.rdvId : null) || null,
    adresseMassage: formData.adresseMassage || '',
    distanceKm: formData.distanceKm || 0,
    fraisDeplacement: formData.fraisDeplacement || 0,
    moyenPaiement: formData.moyenPaiement || '',
    bonCadeauId: bonCadeauId
  };

  if (isEdit) {
    const index = appData.prestations.findIndex(p => p.id === DataManager.getEditingId());
    if (index === -1) return null;
    const avant = appData.prestations[index];
    if (!(await _persist('prestations', 'update', prestation, DataManager.mapPrestationToDb))) return null;
    appData.prestations[index] = prestation;
    // v1.1.0.0 : la prestation n'est plus reglee par carte cadeau (erreur de
    // saisie corrigee) : la cliente n'est pas venue avec cette carte.
    if (Encaissements.estPayeeParBonCadeau(avant) && !Encaissements.estPayeeParBonCadeau(prestation)) {
      await libererBonsCadeauxDe(avant);
    }
  } else {
    if (!(await _persist('prestations', 'insert', prestation, DataManager.mapPrestationToDb))) return null;
    appData.prestations.push(prestation);
  }

  await synchroniserDepenseTransport(prestation);

  if (window.ViewManager) {
    if (typeof window.ViewManager.updateCalendar === 'function') window.ViewManager.updateCalendar();
    if (typeof window.ViewManager.updateDashboard === 'function') window.ViewManager.updateDashboard();
  }

  return prestation;
}

// v1.2.0.0 : UNE depense Transport par prestation. Avant, chaque enregistrement
// (modification comprise) en creait une de plus. On retrouve celle(s) de la
// prestation par prestationId : mise a jour (date, montant, description), retiree
// si les frais tombent a 0, creee seulement s'il n'y en a pas. Les doublons deja
// en base partent a la premiere modification de la prestation.
async function synchroniserDepenseTransport(prestation) {
  const appData = DataManager.getAppData();
  if (!appData.depenses) appData.depenses = [];

  const client = appData.clients.find(c => c.id === prestation.clientId);
  const attendue = RdvPrestations.depenseTransportDe(prestation, client ? `${client.prenom} ${client.nom}` : 'Client');
  const existantes = appData.depenses.filter(d => d.prestationId === prestation.id);
  const [gardee, ...enTrop] = attendue ? existantes : [null, ...existantes];

  for (const d of enTrop) {
    if (await _persist('depenses', 'delete', d.id)) {
      appData.depenses = appData.depenses.filter(x => x.id !== d.id);
    }
  }
  if (!attendue) return;

  if (gardee) {
    const maj = { ...gardee, date: attendue.date, montant: attendue.montant, description: attendue.description };
    if (await _persist('depenses', 'update', maj, DataManager.mapDepenseToDb)) {
      appData.depenses = appData.depenses.map(d => (d.id === maj.id ? maj : d));
    }
  } else {
    const nouvelle = { id: DataManager.generateId(), ...attendue };
    if (await _persist('depenses', 'insert', nouvelle, DataManager.mapDepenseToDb)) {
      appData.depenses.push(nouvelle);
    }
  }
}

async function deletePrestationById(prestationId) {
  const appData = DataManager.getAppData();

  // v1.0.7.2 : DB-first persistence. Sans ca, si _persist echoue silencieusement
  // le cache est filtre localement mais la DB garde la prestation -> au prochain
  // F5 elle reapparait, et l'utilisateur croit qu'il faut cliquer Supprimer 2x.

  // 1) Persister la suppression des depenses associees (echec = on garde tout en cache)
  const depensesAssociees = appData.depenses
    ? appData.depenses.filter(d => d.prestationId === prestationId)
    : [];
  for (const d of depensesAssociees) {
    const ok = await _persist('depenses', 'delete', d.id);
    if (!ok) {
      // arret en cas d'echec : on ne supprime ni les depenses ni la prestation
      return false;
    }
  }

  // 2) Persister la suppression de la prestation (echec = on garde tout en cache et on restaure)
  const prestationPersistOk = await _persist('prestations', 'delete', prestationId);
  if (!prestationPersistOk) {
    return false;
  }

  // 3) Maintenant qu'on a confirme la persistance, filtrer le cache local
  if (appData.depenses && depensesAssociees.length > 0) {
    appData.depenses = appData.depenses.filter(d => d.prestationId !== prestationId);
  }
  const supprimee = appData.prestations.find(p => p.id === prestationId);
  appData.prestations = appData.prestations.filter(p => p.id !== prestationId);

  // v1.1.0.0 : une prestation supprimee n'a pas eu lieu : sa carte cadeau redevient active
  if (supprimee && Encaissements.estPayeeParBonCadeau(supprimee)) {
    await libererBonsCadeauxDe(supprimee);
  }

  if (window.ViewManager) {
    if (typeof window.ViewManager.updateCalendar === 'function') window.ViewManager.updateCalendar();
    if (typeof window.ViewManager.updateDashboard === 'function') window.ViewManager.updateDashboard();
    if (typeof window.ViewManager.updateDepensesDisplay === 'function') window.ViewManager.updateDepensesDisplay();
    if (typeof window.ViewManager.updatePrestationsTable === 'function') window.ViewManager.updatePrestationsTable();
  }
  return true;
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

  // v1.1.0.0 : le formulaire ne connait pas ces liens. Une modification les
  // effacait : une depense d'abonnement perdait type/abonnementNom (et le
  // generateur la recreait au chargement suivant = doublon), une depense
  // Transport perdait sa prestation. On les reprend de la depense existante.
  // v1.2.0.0 : abonnementId aussi.
  if (isEdit) {
    const existante = appData.depenses.find(d => d.id === DataManager.getEditingId());
    ['type', 'abonnementNom', 'abonnementId', 'prestationId'].forEach(cle => {
      const valeur = formData[cle] !== undefined ? formData[cle] : (existante ? existante[cle] : undefined);
      if (valeur !== undefined && valeur !== null) depense[cle] = valeur;
    });
  }

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
// v1.2.0.0 : RdvPrestations.calendrierIcs : statut 'confirmé' reconnu (seul
// 'confirme' l'etait), RDV annules exclus, notes echappees, fins de ligne CRLF.
function generateICSCalendar() {
  const appData = DataManager.getAppData();
  return RdvPrestations.calendrierIcs(appData.rdv, appData.clients, new Date());
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

  // v1.2.0.0 : base d'abord ; null si echec (_persist a alerte, la fenetre reste ouverte)
  if (!(await _persist('bons_cadeaux', 'insert', newBon, DataManager.mapBonCadeauToDb))) return null;
  appData.bonsCadeaux.push(newBon);
  return newBon;
}

async function updateBonCadeau(bonData) {
  const appData = DataManager.getAppData();
  const index = appData.bonsCadeaux.findIndex(b => b.id === bonData.id);
  if (index === -1) return null;

  const existingBon = appData.bonsCadeaux[index];
  const maj = {
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
  // v1.2.0.0 : statut recalcule depuis la nouvelle date de fin : prolonger une
  // carte expiree la rend de nouveau active (utilisee / remboursee : inchange).
  maj.statut = BonsCadeaux.statutEffectif(maj, jourLocal(new Date()));

  if (!(await _persist('bons_cadeaux', 'update', maj, DataManager.mapBonCadeauToDb))) return null;
  appData.bonsCadeaux[index] = maj;
  return maj;
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
  bon.dateRemboursement = jourLocal(new Date()); // v1.2.0.0 : jour local, pas UTC
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

// v1.1.0.0 : regle d'Elise : une carte cadeau est « utilisee » quand la cliente
// est venue. Si la prestation reglee avec la carte est supprimee, ou corrigee
// vers un autre moyen de paiement, la carte redevient active. On ne touche
// qu'aux cartes liees a CETTE prestation (lien porte par la prestation, ou par
// la carte pour les prestations d'avant la v1.1.0.0).
async function libererBonsCadeauxDe(prestation) {
  const appData = DataManager.getAppData();
  const bons = (appData.bonsCadeaux || []).filter(b =>
    b.statut === 'utilise' &&
    (b.id === prestation.bonCadeauId || b.prestationId === prestation.id) &&
    (!b.prestationId || b.prestationId === prestation.id)
  );
  for (const bon of bons) {
    bon.statut = 'actif';
    bon.prestationId = null;
    bon.dateUtilisation = null;
    await _persist('bons_cadeaux', 'update', bon, DataManager.mapBonCadeauToDb);
  }
  return bons.length;
}

async function utiliserBonCadeau(bonId, prestationId) {
  const appData = DataManager.getAppData();
  const bon = appData.bonsCadeaux.find(b => b.id === bonId);
  if (!bon) return false;

  bon.statut = 'utilise';
  bon.prestationId = prestationId;
  bon.dateUtilisation = jourLocal(new Date()); // v1.2.0.0 : jour local, pas UTC
  await _persist('bons_cadeaux', 'update', bon, DataManager.mapBonCadeauToDb);
  return true;
}

// Marquer manuellement un bon comme utilise, avec date antidatable et lien
// optionnel vers une prestation existante. Sert de filet de securite quand
// le flow automatique a echoue (cas typique : prestation creee avant 1.0.6.0
// ou correction retroactive).
async function marquerBonCadeauUtiliseManuel(bonId, dateUtilisation, prestationId) {
  const appData = DataManager.getAppData();
  const bon = appData.bonsCadeaux.find(b => b.id === bonId);
  if (!bon) {
    alert('Bon cadeau introuvable');
    return false;
  }

  // Snapshot pour rollback
  const previous = {
    statut: bon.statut,
    prestationId: bon.prestationId,
    dateUtilisation: bon.dateUtilisation
  };

  bon.statut = 'utilise';
  bon.dateUtilisation = dateUtilisation;
  bon.prestationId = prestationId || null;

  const ok = await _persist('bons_cadeaux', 'update', bon, DataManager.mapBonCadeauToDb);
  if (!ok) {
    bon.statut = previous.statut;
    bon.prestationId = previous.prestationId;
    bon.dateUtilisation = previous.dateUtilisation;
    return false;
  }
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

  // v1.2.0.0 : base d'abord ; null si echec (_persist a alerte)
  if (!(await _persist('clients', 'insert', newClient, DataManager.mapClientToDb))) return null;
  appData.clients.push(newClient);
  return newClient;
}

function getBonsCadeauxUtilisablesPourClient(clientId) {
  const appData = DataManager.getAppData();
  // v1.2.0.0 : statut reel du jour (expiration, utilisation forcee comprises)
  return appData.bonsCadeaux.filter(bon => {
    if (DataManager.statutBonCadeau(bon) !== 'actif') return false;
    if (bon.beneficiaireClientId && bon.beneficiaireClientId !== clientId) return false;
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
  marquerBonCadeauUtiliseManuel,
  createClientMinimal,
  getBonsCadeauxUtilisablesPourClient,
  // v1.2.0.0 : meme enregistrement + alerte pour les fiches et les abonnements
  persist: _persist
};

console.log('Business Services PWA charge');
