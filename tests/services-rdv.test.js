// Tests des services RDV / prestations / cartes cadeaux, sur une fausse base en
// memoire (tests/aide-services.js). Donnees fictives (le depot est public).
const assert = require('node:assert/strict');
const test = require('node:test');
const { installerBase, alertes } = require('./aide-services.js');
const BS = globalThis.BusinessServices;

const client = { id: 'c1', prenom: 'Cliente', nom: 'Fictive' };

function donnees() {
  return { clients: [client], rdv: [], prestations: [], depenses: [], bonsCadeaux: [] };
}

function formPrestation(champs = {}) {
  return {
    id: '', date: '2026-11-10', heure: '10:00', clientId: 'c1', type: 'Massage', soinId: 's1',
    duree: 60, prix: 80, tips: 0, notes: '', adresseMassage: '', distanceKm: 0, fraisDeplacement: 0,
    moyenPaiement: 'Liquide', bonCadeauId: null, ...champs
  };
}

// ----- C2 : modifier un RDV -----

test('C2 : modifier un RDV garde la transformation et la carte cadeau (cache et base)', async () => {
  const appData = donnees();
  appData.rdv.push({ id: 'r1', clientId: 'c1', date: '2026-11-10', heure: '10:00', type: 'Massage', statut: 'planifie',
    transformeEnPrestation: true, bonCadeauId: 'b1' });
  const base = installerBase(appData);
  DataManager.setEditingId('r1');

  const rdv = await BS.createRdv({ id: 'r1', clientId: 'c1', date: '2026-11-10', heure: '11:00', type: 'Massage',
    statut: 'planifie', notes: 'decale' });

  assert.equal(rdv.heure, '11:00');
  assert.equal(appData.rdv[0].transformeEnPrestation, true);
  assert.equal(appData.rdv[0].bonCadeauId, 'b1');
  const ligne = base.find(e => e.table === 'rdv').ligne;
  assert.equal(ligne.transforme_en_prestation, true);
  assert.equal(ligne.bon_cadeau_id, 'b1');
  assert.equal(ligne.statut, 'planifie');
});

test('C2 : echec en base -> null, RDV en memoire inchange', async () => {
  const appData = donnees();
  appData.rdv.push({ id: 'r1', clientId: 'c1', date: '2026-11-10', heure: '10:00', statut: 'confirmé' });
  installerBase(appData, [{ table: 'rdv', action: 'update' }]);
  DataManager.setEditingId('r1');

  assert.equal(await BS.createRdv({ id: 'r1', clientId: 'c1', date: '2026-11-10', heure: '12:00', statut: 'confirmé' }), null);
  assert.equal(appData.rdv[0].heure, '10:00');
  assert.equal(alertes.length, 1);
});

// ----- C3 : une seule depense Transport par prestation -----

test('C3 : creer puis modifier une prestation avec frais = une seule depense Transport, mise a jour', async () => {
  const appData = donnees();
  installerBase(appData);

  const p = await BS.createPrestation(formPrestation({ distanceKm: 10, fraisDeplacement: 8 }));
  assert.equal(appData.depenses.length, 1);
  const idDepense = appData.depenses[0].id;

  DataManager.setEditingId(p.id);
  await BS.createPrestation(formPrestation({ id: p.id, date: '2026-11-12', distanceKm: 20, fraisDeplacement: 15 }));
  assert.equal(appData.depenses.length, 1);
  assert.equal(appData.depenses[0].id, idDepense);
  assert.equal(appData.depenses[0].montant, 15);
  assert.equal(appData.depenses[0].date, '2026-11-12');
  assert.match(appData.depenses[0].description, /\(20km A\/R\)/);
});

test('C3 : frais ramenes a 0 -> depense retiree ; doublons d\'avant nettoyes', async () => {
  const appData = donnees();
  appData.prestations.push({ id: 'p1', clientId: 'c1', date: '2026-11-10', heure: '10:00', fraisDeplacement: 8, prix: 80 });
  appData.depenses.push(
    { id: 'd1', prestationId: 'p1', categorie: 'Transport', montant: 8, date: '2026-11-10' },
    { id: 'd2', prestationId: 'p1', categorie: 'Transport', montant: 8, date: '2026-11-10' },
    { id: 'd3', categorie: 'Loyer', montant: 1, date: '2026-11-01' }
  );
  installerBase(appData);
  DataManager.setEditingId('p1');

  await BS.createPrestation(formPrestation({ id: 'p1', distanceKm: 10, fraisDeplacement: 8 }));
  assert.deepEqual(appData.depenses.map(d => d.id), ['d1', 'd3']);

  await BS.createPrestation(formPrestation({ id: 'p1', fraisDeplacement: 0 }));
  assert.deepEqual(appData.depenses.map(d => d.id), ['d3']);
});

// ----- I1 / I9 : validation d'un RDV, annulation, suppression -----

test('I1 : insertion de la prestation en echec -> null, rien en memoire, pas de depense', async () => {
  const appData = donnees();
  installerBase(appData, [{ table: 'prestations', action: 'insert' }]);
  const p = await BS.createPrestation(formPrestation({ rdvId: 'r1', fraisDeplacement: 8 }));
  assert.equal(p, null);
  assert.equal(appData.prestations.length, 0);
  assert.equal(appData.depenses.length, 0);
});

test('I9 : la prestation nee d\'un RDV porte rdvId (base comprise), garde a la modification', async () => {
  const appData = donnees();
  const base = installerBase(appData);
  const p = await BS.createPrestation(formPrestation({ rdvId: 'r1', isTransformed: true }));
  assert.equal(base.find(e => e.table === 'prestations').ligne.rdv_id, 'r1');

  DataManager.setEditingId(p.id);
  const modifiee = await BS.createPrestation(formPrestation({ id: p.id, prix: 90 })); // le formulaire ignore le RDV
  assert.equal(modifiee.rdvId, 'r1');
  assert.equal(modifiee.isTransformed, true);
});

test('I1 : transformation -> anciennes prestations du creneau remplacees, carte liberee, Transport retire', async () => {
  const appData = donnees();
  appData.rdv.push({ id: 'r1', clientId: 'c1', date: '2026-11-10', heure: '10:00', transformeEnPrestation: false });
  appData.prestations.push(
    { id: 'ancienne', clientId: 'c1', date: '2026-11-10', heure: '10:00', moyenPaiement: 'Bon cadeau', bonCadeauId: 'b1' },
    { id: 'nouvelle', rdvId: 'r1', clientId: 'c1', date: '2026-11-10', heure: '10:00', moyenPaiement: 'Liquide' }
  );
  appData.depenses.push({ id: 'd1', prestationId: 'ancienne', categorie: 'Transport', montant: 5, date: '2026-11-10' });
  appData.bonsCadeaux.push({ id: 'b1', statut: 'utilise', prestationId: 'ancienne', dateExpiration: '2027-01-01' });
  installerBase(appData);

  assert.equal(await BS.transformRdvToPrestation('r1', 'nouvelle'), true);
  assert.deepEqual(appData.prestations.map(p => p.id), ['nouvelle']);
  assert.equal(appData.depenses.length, 0);
  assert.equal(appData.bonsCadeaux[0].statut, 'actif');
  assert.equal(appData.rdv[0].transformeEnPrestation, true);
});

test('I1 : annuler la transformation d\'un RDV deplace -> prestation (rdvId) supprimee, carte liberee, Transport retire', async () => {
  const appData = donnees();
  appData.rdv.push({ id: 'r1', clientId: 'c1', date: '2026-11-11', heure: '15:00', transformeEnPrestation: true, bonCadeauId: 'b1' });
  appData.prestations.push({ id: 'p1', rdvId: 'r1', clientId: 'c1', date: '2026-11-10', heure: '10:00', moyenPaiement: 'Bon cadeau', bonCadeauId: 'b1' });
  appData.depenses.push({ id: 'd1', prestationId: 'p1', categorie: 'Transport', montant: 5, date: '2026-11-10' });
  appData.bonsCadeaux.push({ id: 'b1', statut: 'utilise', prestationId: 'p1', dateExpiration: '2027-01-01' });
  installerBase(appData);

  assert.equal(await BS.annulerTransformationRdv('r1'), true);
  assert.equal(appData.prestations.length, 0);
  assert.equal(appData.depenses.length, 0);
  assert.equal(appData.bonsCadeaux[0].statut, 'actif');
  assert.equal(appData.bonsCadeaux[0].prestationId, null);
  assert.equal(appData.rdv[0].transformeEnPrestation, false);
  assert.equal(appData.rdv[0].bonCadeauId, 'b1');
});

test('I1 : annulation dont la suppression echoue -> RDV toujours transforme', async () => {
  const appData = donnees();
  appData.rdv.push({ id: 'r1', clientId: 'c1', date: '2026-11-10', heure: '10:00', transformeEnPrestation: true });
  appData.prestations.push({ id: 'p1', rdvId: 'r1', clientId: 'c1', date: '2026-11-10', heure: '10:00' });
  installerBase(appData, [{ table: 'prestations', action: 'delete' }]);

  assert.equal(await BS.annulerTransformationRdv('r1'), false);
  assert.equal(appData.prestations.length, 1);
  assert.equal(appData.rdv[0].transformeEnPrestation, true);
});

test('I1 : supprimer un RDV transforme -> sa prestation, sa depense, carte liberee', async () => {
  const appData = donnees();
  appData.rdv.push({ id: 'r1', clientId: 'c1', date: '2026-11-10', heure: '10:00', transformeEnPrestation: true });
  appData.prestations.push(
    { id: 'p1', rdvId: 'r1', clientId: 'c1', date: '2026-11-10', heure: '09:00', bonCadeauId: 'b1', moyenPaiement: 'Bon cadeau' },
    { id: 'p2', clientId: 'c1', date: '2026-11-20', heure: '10:00' }
  );
  appData.depenses.push({ id: 'd1', prestationId: 'p1', categorie: 'Transport', montant: 5, date: '2026-11-10' });
  appData.bonsCadeaux.push({ id: 'b1', statut: 'utilise', prestationId: 'p1', dateExpiration: '2027-01-01' });
  installerBase(appData);

  assert.equal(await BS.deleteRdvById('r1'), true);
  assert.equal(appData.rdv.length, 0);
  assert.deepEqual(appData.prestations.map(p => p.id), ['p2']);
  assert.equal(appData.depenses.length, 0);
  assert.equal(appData.bonsCadeaux[0].statut, 'actif');
});

// ----- I2 : statut des cartes cadeaux -----

test('I2 : prolonger une carte expiree la rend active ; une carte utilisee reste utilisee', async () => {
  const appData = donnees();
  appData.bonsCadeaux.push(
    { id: 'b1', statut: 'expire', dateAchat: '2026-01-05', dateExpiration: '2026-07-05', montant: 50 },
    { id: 'b2', statut: 'utilise', dateAchat: '2026-01-05', dateExpiration: '2026-07-05', montant: 50, prestationId: 'p9' }
  );
  const base = installerBase(appData);

  const b1 = await BS.updateBonCadeau({ id: 'b1', dateAchat: '2026-01-05', dateDebut: '2026-10-01', dateExpiration: '2027-04-01', montant: 50 });
  assert.equal(b1.statut, 'actif');
  assert.equal(base[0].ligne.statut, 'actif');

  const b2 = await BS.updateBonCadeau({ id: 'b2', dateAchat: '2026-01-05', dateDebut: '2026-10-01', dateExpiration: '2027-04-01', montant: 50 });
  assert.equal(b2.statut, 'utilise');
});

test('I2 : les getters ne modifient plus le cache ; utilisation forcee comptee active', () => {
  const appData = donnees();
  appData.bonsCadeaux.push(
    { id: 'b1', statut: 'actif', dateExpiration: '2026-10-01', montant: 40 },
    { id: 'b2', statut: 'actif', dateExpiration: '2026-10-01', montant: 30, forceUtilise: true },
    { id: 'b3', statut: 'actif', dateExpiration: '2027-01-01', montant: 20 },
    { id: 'b4', statut: 'expire', dateExpiration: '2027-02-01', montant: 10 }
  );
  installerBase(appData);
  DataManager.setAppData(appData); // les getters de data-manager.js lisent son propre cache

  const stats = DataManager.getStatistiquesBonsCadeaux();
  assert.deepEqual({ actifs: stats.actifs, expires: stats.expires, montantActifs: stats.montantActifs }, { actifs: 3, expires: 1, montantActifs: 60 });
  assert.equal(DataManager.getMontantBonsCadeauxNonUtilises(), 60);
  assert.deepEqual(DataManager.getBonsCadeauxActifs().map(b => b.id), ['b2', 'b3', 'b4']);
  assert.equal(appData.bonsCadeaux[0].statut, 'actif'); // jamais ecrit « expire » par un getter
  assert.deepEqual(BS.getBonsCadeauxUtilisablesPourClient('c1').map(b => b.id), ['b2', 'b3', 'b4']);
});

// ----- Export .ics -----

test('export .ics : passe par la regle commune (CRLF, annules exclus)', () => {
  const appData = donnees();
  appData.rdv.push({ id: 'r1', clientId: 'c1', date: '2099-01-01', heure: '10:00', type: 'Massage', statut: 'annulé' });
  installerBase(appData);
  const ics = BS.generateICSCalendar();
  assert.ok(ics.includes('\r\n'));
  assert.ok(!ics.includes('BEGIN:VEVENT'));
});
