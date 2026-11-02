// Tests des fiches clientes (creation, modification, suppression, conversion) sur une
// fausse base en memoire (tests/aide-services.js). Donnees fictives (le depot est public).
const assert = require('node:assert/strict');
const test = require('node:test');
const { installerBase, alertes, AUJOURDHUI } = require('./aide-services.js');
require('../js/services/client-services.js');
const CS = globalThis.ClientServices;

const formulaire = (champs = {}) => ({
  id: '', nom: 'Fictive', prenom: 'Cliente', telephone: '', email: '', sexe: 'F', ville: '',
  adresse: '', notes: '', parrain: null, canalAcquisition: 'non-renseigne', dateAcquisition: undefined,
  huiles: '', zones: '', allergies: '', pression: 'moyenne', sansFidelite: true, ...champs
});

test('C5 : creation enregistree en base AVANT d\'apparaitre ; sansFidelite et etiquettes recopiees', async () => {
  const appData = { clients: [], prospects: [], rdv: [], prestations: [] };
  const base = installerBase(appData);

  const client = await CS.createClient(formulaire());
  assert.equal(appData.clients.length, 1);
  assert.equal(client.sansFidelite, true);
  assert.deepEqual(client.tags, []);
  assert.equal(client.dateAcquisition, AUJOURDHUI);
  assert.equal(base[0].ligne.sans_fidelite, true);
});

test('C5 : creation en echec -> erreur remontee (withButtonLoading l\'affiche), rien en memoire', async () => {
  const appData = { clients: [], prospects: [], rdv: [], prestations: [] };
  installerBase(appData, [{ table: 'clients', action: 'insert' }]);
  await assert.rejects(() => CS.createClient(formulaire()), /reseau coupe/);
  assert.equal(appData.clients.length, 0);
});

test('C5 : modification = champs renseignes seulement (date d\'acquisition, etiquettes, fidelite gardees)', async () => {
  const appData = {
    clients: [{ id: 'c1', nom: 'Fictive', prenom: 'Cliente', dateAcquisition: '2025-03-01', tags: ['vip'], fideliteAtteinte: [5] }],
    prospects: [], rdv: [], prestations: []
  };
  const base = installerBase(appData);
  DataManager.setEditingId('c1');

  await CS.createClient(formulaire({ id: 'c1', telephone: '0600000000' }));
  assert.equal(appData.clients[0].telephone, '0600000000');
  assert.equal(appData.clients[0].dateAcquisition, '2025-03-01');
  assert.deepEqual(appData.clients[0].tags, ['vip']);
  assert.deepEqual(appData.clients[0].fideliteAtteinte, [5]);
  assert.equal(base[0].ligne.date_acquisition, '2025-03-01');
});

test('C5 : modification en echec -> fiche en memoire intacte', async () => {
  const appData = { clients: [{ id: 'c1', nom: 'Fictive', prenom: 'Cliente', telephone: '' }], prospects: [], rdv: [], prestations: [] };
  installerBase(appData, [{ table: 'clients', action: 'update' }]);
  DataManager.setEditingId('c1');
  await assert.rejects(() => CS.createClient(formulaire({ id: 'c1', telephone: '0611111111' })));
  assert.equal(appData.clients[0].telephone, '');
});

test('C5 : suppression refusee tant que la fiche a des RDV ou des prestations', async () => {
  const appData = {
    clients: [{ id: 'c1', prenom: 'Cliente', nom: 'Fictive' }], prospects: [],
    rdv: [{ id: 'r1', clientId: 'c1' }], prestations: [{ id: 'p1', clientId: 'c1' }, { id: 'p2', clientId: 'c1' }]
  };
  const base = installerBase(appData);

  assert.match(CS.motifRefusFiche('c1'), /la fiche a encore 1 RDV et 2 prestations/);
  assert.equal(await CS.deleteClientById('c1'), false);
  assert.equal(base.length, 0);
  assert.equal(appData.clients.length, 1);
  assert.equal(appData.rdv.length, 1);
  assert.equal(alertes.length, 1);
});

test('C5 : suppression d\'une fiche libre : base puis memoire ; echec -> fiche gardee', async () => {
  const appData = { clients: [{ id: 'c1', prenom: 'A', nom: 'B' }], prospects: [], rdv: [], prestations: [] };
  installerBase(appData, [{ table: 'clients', action: 'delete' }]);
  assert.equal(await CS.deleteClientById('c1'), false);
  assert.equal(appData.clients.length, 1);

  installerBase(appData);
  assert.equal(await CS.deleteClientById('c1'), true);
  assert.equal(appData.clients.length, 0);
});

test('C5 : conversion en prospect refusee si la fiche a des RDV (elle les effacait)', async () => {
  const appData = { clients: [{ id: 'c1', prenom: 'A', nom: 'B' }], prospects: [], rdv: [{ id: 'r1', clientId: 'c1' }], prestations: [] };
  const base = installerBase(appData);
  assert.equal(await CS.convertClientToProspect('c1'), null);
  assert.equal(base.length, 0);
  assert.equal(appData.rdv.length, 1);
  assert.match(alertes[0], /Impossible de convertir en prospect « A B »/);
});
