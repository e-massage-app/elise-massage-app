// Banc d'essai des services (business-services.js, client-services.js) sous Node :
// une fausse base en memoire remplace Supabase, les vrais mappers de data-manager.js
// sont gardes. Rien ne part sur le reseau. Pas un fichier de test (pas de .test.js).

globalThis.window = globalThis;
globalThis.Encaissements = require('../js/core/encaissements.js');
require('../js/core/bons-cadeaux.js');
require('../js/core/rdv-prestations.js');
require('../js/core/data-manager.js');
const vraiDataManager = globalThis.DataManager;

// Jour fixe : les tests ne dependent pas de la date du jour
const AUJOURDHUI = '2026-11-02';
globalThis.jourLocal = () => AUJOURDHUI;

const alertes = [];
globalThis.alert = message => alertes.push(message);
console.error = () => {}; // _persist journalise ses echecs : on les verifie autrement

require('../js/services/business-services.js');

/**
 * Installe un DataManager sur appData. echecs : [{ table, action, id? }] qui
 * echouent comme une coupure reseau. Retourne le journal des ecritures en base.
 */
function installerBase(appData, echecs = []) {
  const ecritures = [];
  let editingId = null;
  let n = 0;
  alertes.length = 0;
  const echoue = (table, action, id) =>
    echecs.some(e => e.table === table && e.action === action && (e.id === undefined || e.id === id));
  const ecrire = (table, action, id, ligne) => {
    if (echoue(table, action, id)) throw new Error('reseau coupe');
    ecritures.push({ table, action, id, ligne });
  };

  globalThis.DataManager = {
    ...vraiDataManager,
    getAppData: () => appData,
    getEditingId: () => editingId,
    setEditingId: id => { editingId = id; },
    generateId: () => `id_test_${++n}`,
    insertEntity: async (table, obj, map) => ecrire(table, 'insert', obj.id, map(obj)),
    updateEntity: async (table, id, obj, map) => ecrire(table, 'update', id, map(obj)),
    deleteEntity: async (table, id) => ecrire(table, 'delete', id),
    saveParametresCles: async () => true
  };
  return ecritures;
}

module.exports = { installerBase, alertes, AUJOURDHUI };
