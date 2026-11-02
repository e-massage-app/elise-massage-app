// Tests des regles RDV / prestations / fiches / export .ics (node --test tests/rdv-prestations.test.js).
// Donnees fictives : aucun chiffre reel d'Elise ici (le depot est public).
const assert = require('node:assert/strict');
const test = require('node:test');
const R = require('../js/core/rdv-prestations.js');

const rdv = { id: 'r1', clientId: 'c1', date: '2026-11-10', heure: '10:00' };

test('prestation du RDV : par rdvId, meme si l\'heure du RDV a change', () => {
  const p = { id: 'p1', rdvId: 'r1', clientId: 'c1', date: '2026-11-10', heure: '09:00' };
  assert.ok(R.estPrestationDuRdv(p, rdv));
  assert.ok(R.estPrestationDuRdv(p, { ...rdv, heure: '15:30', date: '2026-11-12' }));
});

test('prestation d\'un AUTRE RDV au meme creneau : pas confondue', () => {
  const p = { id: 'p1', rdvId: 'r2', clientId: 'c1', date: '2026-11-10', heure: '10:00' };
  assert.equal(R.estPrestationDuRdv(p, rdv), false);
});

test('ancienne prestation sans rdvId : meme date + heure + fiche', () => {
  assert.ok(R.estPrestationDuRdv({ id: 'p1', clientId: 'c1', date: '2026-11-10', heure: '10:00' }, rdv));
  assert.equal(R.estPrestationDuRdv({ id: 'p2', clientId: 'c2', date: '2026-11-10', heure: '10:00' }, rdv), false);
  assert.equal(R.estPrestationDuRdv({ id: 'p3', clientId: 'c1', date: '2026-11-10', heure: '11:00' }, rdv), false);
});

test('prestationsDuRdv et rdvDeLaPrestation', () => {
  const prestations = [
    { id: 'p1', rdvId: 'r1', clientId: 'c1', date: '2026-11-10', heure: '09:00' },
    { id: 'p2', clientId: 'c1', date: '2026-11-10', heure: '10:00' },
    { id: 'p3', clientId: 'c9', date: '2026-11-10', heure: '10:00' }
  ];
  assert.deepEqual(R.prestationsDuRdv(rdv, prestations).map(p => p.id), ['p1', 'p2']);
  assert.equal(R.rdvDeLaPrestation(prestations[0], [rdv]).id, 'r1');
  assert.equal(R.rdvDeLaPrestation(prestations[2], [rdv]), null);
  assert.deepEqual(R.prestationsDuRdv(rdv, undefined), []);
});

test('depense Transport : champs attendus, null sans frais', () => {
  const p = { id: 'p1', date: '2026-11-10', type: 'Massage', distanceKm: 12, fraisDeplacement: 9.5 };
  const d = R.depenseTransportDe(p, 'Cliente Fictive');
  assert.deepEqual(d, {
    date: '2026-11-10', montant: 9.5, categorie: 'Transport', fournisseur: 'Frais kilometriques',
    description: 'Deplacement Massage - Cliente Fictive (12km A/R)',
    notes: 'Genere automatiquement depuis prestation p1', prestationId: 'p1'
  });
  assert.equal(R.depenseTransportDe({ ...p, fraisDeplacement: 0 }, 'X'), null);
  assert.equal(R.depenseTransportDe({ ...p, fraisDeplacement: '' }, 'X'), null);
});

test('fiche encore utilisee : message clair avec les nombres', () => {
  const appData = {
    rdv: [{ clientId: 'c1' }, { clientId: 'c1' }, { clientId: 'c2' }],
    prestations: [{ clientId: 'c1' }]
  };
  const liens = R.liensDeLaFiche(appData, 'c1');
  assert.deepEqual(liens, { rdv: 2, prestations: 1 });
  const msg = R.messageFicheLiee('Cliente Fictive', liens);
  assert.match(msg, /^Impossible de supprimer « Cliente Fictive » : la fiche a encore 2 RDV et 1 prestation\./);
  assert.match(R.messageFicheLiee('X', { rdv: 0, prestations: 3 }, 'convertir en prospect'), /convertir en prospect « X » : la fiche a encore 3 prestations\./);
  assert.equal(R.messageFicheLiee('X', R.liensDeLaFiche(appData, 'c3')), null);
});

test('ics : echappement de \\ ; , et des retours a la ligne', () => {
  assert.equal(R.echapperIcs('a\\b;c,d\ne\r\nf'), 'a\\\\b\\;c\\,d\\ne\\nf');
  assert.equal(R.echapperIcs(null), '');
});

test('ics : RDV a venir seulement, annules exclus, confirme reconnu, CRLF', () => {
  const maintenant = new Date(2026, 10, 2, 12, 0); // 2 nov. 2026 midi, heure locale
  const rdvs = [
    { id: 'a', clientId: 'c1', date: '2026-11-05', heure: '10:00', type: 'Massage', duree: 60, statut: 'confirmé', notes: 'Huile, sans parfum; dos\nnuque' },
    { id: 'b', clientId: 'c1', date: '2026-11-06', heure: '10:00', type: 'Massage', statut: 'annulé' },
    { id: 'c', clientId: 'c1', date: '2026-11-01', heure: '10:00', type: 'Massage', statut: 'confirmé' },
    { id: 'd', clientId: 'cX', date: '2026-11-07', heure: '09:30', type: 'HeadSpa', statut: 'en attente' },
    { id: 'e', clientId: 'c1', date: '2026-11-08', heure: '09:30', type: 'Massage', statut: 'confirme' }
  ];
  const ics = R.calendrierIcs(rdvs, [{ id: 'c1', prenom: 'Cliente', nom: 'Fictive' }], maintenant);

  assert.ok(ics.endsWith('END:VCALENDAR\r\n'));
  assert.equal(ics.split('\r\n').filter(l => l.includes('\n')).length, 0); // aucune fin de ligne LF seule
  assert.deepEqual([...ics.matchAll(/^UID:(\w+)@/gm)].map(m => m[1]), ['a', 'd', 'e']);

  const evenements = ics.split('BEGIN:VEVENT').slice(1);
  assert.match(evenements[0], /STATUS:CONFIRMED/);
  assert.match(evenements[0], /SUMMARY:Massage - Cliente Fictive\r\n/);
  assert.match(evenements[0], /DESCRIPTION:Type: Massage\\nDuree: 60min\\nStatut: confirmé\\nNotes: Huile\\, sans parfum\\; dos\\nnuque\r\n/);
  assert.match(evenements[1], /STATUS:TENTATIVE/);
  assert.match(evenements[1], /SUMMARY:HeadSpa - Client\r\n/);
  assert.match(evenements[2], /STATUS:CONFIRMED/);

  // DTSTART en UTC, coherent avec l'heure locale du RDV
  const attendu = new Date('2026-11-05T10:00').toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  assert.match(evenements[0], new RegExp(`DTSTART:${attendu}`));
});
