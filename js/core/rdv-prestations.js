// ===== RDV, PRESTATIONS, FICHES : REGLES PURES (v1.2.0.0) =====
// Fonctions sans DOM ni Supabase, testees sous Node (tests/rdv-prestations.test.js).

(function (racine) {

// ----- Lien prestation -> RDV -----
// La prestation nee d'un RDV porte son rdvId. Les prestations d'avant la v1.2.0.0
// n'en ont pas : on les retrouve comme avant, meme date + heure + fiche. Un RDV
// modifie apres coup (heure, date) garde ainsi sa prestation.
function estPrestationDuRdv(p, rdv) {
  if (!p || !rdv) return false;
  if (p.rdvId) return p.rdvId === rdv.id;
  return p.date === rdv.date && p.heure === rdv.heure && p.clientId === rdv.clientId;
}

function prestationsDuRdv(rdv, prestations) {
  return (prestations || []).filter(p => estPrestationDuRdv(p, rdv));
}

function rdvDeLaPrestation(p, rdvs) {
  return (rdvs || []).find(r => estPrestationDuRdv(p, r)) || null;
}

// ----- Depense Transport d'une prestation -----
// Champs attendus de la depense creee pour les frais de route, ou null sans frais.
function depenseTransportDe(p, clientNom) {
  const montant = Number(p.fraisDeplacement) || 0;
  if (montant <= 0) return null;
  return {
    date: p.date,
    montant,
    categorie: 'Transport',
    fournisseur: 'Frais kilometriques',
    description: `Deplacement ${p.type} - ${clientNom || 'Client'} (${p.distanceKm}km A/R)`,
    notes: `Genere automatiquement depuis prestation ${p.id}`,
    prestationId: p.id
  };
}

// ----- Fiche cliente encore utilisee -----
function liensDeLaFiche(appData, clientId) {
  return {
    rdv: (appData.rdv || []).filter(r => r.clientId === clientId).length,
    prestations: (appData.prestations || []).filter(p => p.clientId === clientId).length
  };
}

// Supprimer (ou convertir) une fiche qui a des RDV ou des prestations laissait des
// orphelins, ou effacait l'historique et le chiffre d'affaires : on refuse, en disant pourquoi.
function messageFicheLiee(nomFiche, liens, action = 'supprimer') {
  if (!liens.rdv && !liens.prestations) return null;
  const encore = [];
  if (liens.rdv) encore.push(`${liens.rdv} RDV`);
  if (liens.prestations) encore.push(`${liens.prestations} prestation${liens.prestations > 1 ? 's' : ''}`);
  return `Impossible de ${action} « ${nomFiche} » : la fiche a encore ${encore.join(' et ')}.\n\n`
    + 'Rattachez-les à une autre fiche (ou supprimez-les) avant de recommencer.';
}

// ----- Export agenda .ics (RFC 5545) -----
const estAnnule = rdv => rdv.statut === 'annulé' || rdv.statut === 'annule';
const estConfirme = rdv => rdv.statut === 'confirmé' || rdv.statut === 'confirme';

// Texte d'un champ : \ ; , et retours a la ligne s'echappent (sinon le champ est coupe).
function echapperIcs(texte) {
  return String(texte ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r\n|\r|\n/g, '\\n');
}

// RDV a venir (heure locale), annules exclus. Lignes terminees par CRLF.
function calendrierIcs(rdvs, clients, maintenant) {
  const dateIcs = d => d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  const lignes = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Elise Massage//Agenda//FR', 'CALSCALE:GREGORIAN'];

  (rdvs || []).forEach(rdv => {
    if (estAnnule(rdv)) return;
    const debut = new Date(`${rdv.date}T${rdv.heure}`);
    if (isNaN(debut.getTime()) || debut < maintenant) return;
    const client = (clients || []).find(c => c.id === rdv.clientId);
    const nom = client ? `${client.prenom} ${client.nom}` : 'Client';
    const duree = rdv.duree || 60;
    const fin = new Date(debut.getTime() + duree * 60 * 1000);
    const description = [`Type: ${rdv.type}`, `Duree: ${duree}min`, `Statut: ${rdv.statut}`]
      .concat(rdv.notes ? [`Notes: ${rdv.notes}`] : [])
      .map(echapperIcs)
      .join('\\n');

    lignes.push(
      'BEGIN:VEVENT',
      `UID:${rdv.id}@elisemassage.local`,
      `DTSTAMP:${dateIcs(maintenant)}`,
      `DTSTART:${dateIcs(debut)}`,
      `DTEND:${dateIcs(fin)}`,
      `SUMMARY:${echapperIcs(`${rdv.type} - ${nom}`)}`,
      `DESCRIPTION:${description}`,
      `STATUS:${estConfirme(rdv) ? 'CONFIRMED' : 'TENTATIVE'}`,
      'END:VEVENT'
    );
  });

  lignes.push('END:VCALENDAR');
  return lignes.join('\r\n') + '\r\n';
}

const RdvPrestations = {
  estPrestationDuRdv,
  prestationsDuRdv,
  rdvDeLaPrestation,
  depenseTransportDe,
  liensDeLaFiche,
  messageFicheLiee,
  echapperIcs,
  calendrierIcs
};

racine.RdvPrestations = RdvPrestations;
if (typeof module !== 'undefined' && module.exports) module.exports = RdvPrestations;

})(typeof window !== 'undefined' ? window : globalThis);
