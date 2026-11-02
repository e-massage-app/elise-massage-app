// ===== GESTION : ECRAN (v1.1.0.0) =====
// Onglet « Gestion » : Pro (4 chiffres, detail au clic, courbe), Perso, Reglages.
// Mots d'Elise, pas de jargon comptable (ni « resultat », ni « provision »).
// Evenements par delegation (data-ge="action") : aucun onclick global ajoute.

(function (racine) {

const C = () => racine.GestionCalculs;
const D = () => racine.GestionDonnees;
const E = () => racine.Encaissements;

const vue = { onglet: 'pro', mois: null, detail: null, courbe: null, lie: false };

// ----- Outils -----

function aujourdhui() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function euros(n, { signe = false } = {}) {
  if (n === null || n === undefined || Number.isNaN(Number(n))) return '—';
  const v = Number(n);
  const decimales = Math.abs(v - Math.round(v)) < 0.005 ? 0 : 2;
  const txt = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', minimumFractionDigits: decimales, maximumFractionDigits: decimales }).format(v);
  return signe && v > 0 ? `+${txt}` : txt;
}

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function dateCourte(j) {
  return j ? `${j.slice(8, 10)}/${j.slice(5, 7)}` : '';
}

function nomMois(m, annee = false) {
  return C().nomMois(m, annee);
}

function deMois(m) {
  return C().deMois(m);
}

function pourcent(n) {
  return `${String(n).replace('.', ',')} %`;
}

const MOIS_COURTS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];

function ctx() {
  return C().contexte(DataManager.getAppData(), D().etat.gestion, D().reglages(), D().etat.ads);
}

function notifier(message, type = 'success') {
  if (racine.RdvDuplication?.showNotification) racine.RdvDuplication.showNotification(message, type);
}

function moisCourant() {
  return aujourdhui().slice(0, 7);
}

// ----- Types de saisie (libelles du point de vue d'Elise) -----

const TYPES = {
  'pro-entree': { titre: 'Un encaissement hors logiciel', espace: 'pro', sens: 'entree', comptes: ['caisse', 'pro'], categories: 'proEntree' },
  'pro-sortie': { titre: 'Un frais pro', espace: 'pro', sens: 'sortie', comptes: ['pro', 'caisse'], categories: 'proSortie' },
  'depot': { titre: 'Un dépôt de la caisse en banque', espace: 'pro', sens: 'transfert', comptes: ['caisse'], vers: 'pro' },
  'verser': { titre: 'Me verser de l\'argent', espace: 'pro', sens: 'transfert', comptes: ['pro', 'caisse'], vers: 'perso' },
  'perso-sortie': { titre: 'Une dépense perso', espace: 'perso', sens: 'sortie', comptes: ['perso', 'caisse', 'pro'], categories: 'persoVariable' },
  'perso-entree': { titre: 'Un revenu perso', espace: 'perso', sens: 'entree', comptes: ['perso'], categories: 'persoEntree' },
  'epargne': { titre: 'Mettre de côté', espace: 'perso', sens: 'transfert', comptes: ['perso', 'pro'], vers: 'epargne', categories: 'epargne' }
};

const TYPES_RECURRENTS = {
  'pro-fixe': { titre: 'Charge fixe pro', espace: 'pro', sens: 'sortie', comptes: ['pro', 'caisse'], categories: 'proSortie' },
  'versement': { titre: 'Virement pro → perso tous les mois', espace: 'pro', sens: 'transfert', comptes: ['pro'], vers: 'perso' },
  'perso-fixe': { titre: 'Charge fixe perso', espace: 'perso', sens: 'sortie', comptes: ['perso'], categories: 'persoFixe' },
  'perso-revenu': { titre: 'Revenu fixe', espace: 'perso', sens: 'entree', comptes: ['perso'], categories: 'persoEntree' },
  'epargne': { titre: 'Épargne programmée', espace: 'perso', sens: 'transfert', comptes: ['perso'], vers: 'epargne', categories: 'epargne' }
};

function typeDuMouvement(mv) {
  return Object.keys(TYPES).find(k => {
    const t = TYPES[k];
    return t.espace === (mv.espace || 'pro') && t.sens === mv.sens && (!t.vers || t.vers === mv.compteVers) && t.comptes.includes(mv.compte);
  }) || (mv.sens === 'transfert' ? 'verser' : mv.espace === 'perso' ? 'perso-sortie' : 'pro-sortie');
}

function typeDuRecurrent(r) {
  return Object.keys(TYPES_RECURRENTS).find(k => {
    const t = TYPES_RECURRENTS[k];
    return t.espace === (r.espace || 'pro') && t.sens === (r.sens || 'sortie') && (!t.vers || t.vers === r.compteVers);
  }) || 'pro-fixe';
}

// ----- Affichage -----

async function afficher() {
  const hote = document.getElementById('gestion-host');
  if (!hote) return;
  lierEvenements();
  if (!vue.mois) vue.mois = moisCourant();
  if (!D().etat.charge) {
    hote.innerHTML = '<div class="ge-chargement">Chargement de ta gestion…</div>';
    try {
      await D().charger();
    } catch (e) {
      console.error('Gestion : chargement impossible', e);
      hote.innerHTML = `<div class="ge-carte ge-erreur">Impossible de charger la gestion : ${esc(e.message || e)}.<br>Vérifie ta connexion puis réessaie.
        <div class="ge-actions"><button class="btn-primary" data-ge="recharger">Réessayer</button></div></div>`;
      return;
    }
  }
  rendre();
  if (!D().etat.adsCharge) {
    const m = moisCourant();
    D().chargerCoutsAds(E().decalerMois(m, -13), m).then(() => rendre());
  }
}

function rendre() {
  const hote = document.getElementById('gestion-host');
  if (!hote || !document.getElementById('gestion')?.classList.contains('active')) return;
  const corps = vue.onglet === 'perso' ? vuePerso() : vue.onglet === 'reglages' ? vueReglages() : vuePro();
  hote.innerHTML = entete() + corps;
  if (vue.onglet === 'pro') dessinerCourbe();
}

function entete() {
  const m = vue.mois;
  const suivantPossible = m < moisCourant();
  const onglets = [['pro', 'Pro'], ['perso', 'Perso'], ['reglages', 'Réglages']]
    .map(([k, l]) => `<button class="ge-segment ${vue.onglet === k ? 'actif' : ''}" data-ge="onglet" data-valeur="${k}" aria-pressed="${vue.onglet === k}">${l}</button>`).join('');
  const navMois = vue.onglet === 'reglages' ? '' : `
    <div class="ge-mois">
      <button class="ge-fleche" data-ge="mois" data-valeur="-1" aria-label="Mois précédent">‹</button>
      <span class="ge-mois-nom">${esc(nomMois(m, true))}</span>
      <button class="ge-fleche" data-ge="mois" data-valeur="1" aria-label="Mois suivant" ${suivantPossible ? '' : 'disabled'}>›</button>
    </div>`;
  const ajouter = vue.onglet === 'reglages' ? '' : `<button class="btn-primary ge-ajouter" data-ge="ajouter" data-type="${vue.onglet === 'perso' ? 'perso-sortie' : 'pro-sortie'}">+ Ajouter</button>`;
  return `
    <div class="ge-entete">
      <div class="ge-entete-haut">
        <h2>Gestion</h2>
        <div class="ge-segments" role="group" aria-label="Partie">${onglets}</div>
      </div>
      <div class="ge-entete-bas">${navMois}${ajouter}</div>
    </div>`;
}

// ----- Pro -----

function jourDeReference(m) {
  const j = aujourdhui();
  return m === j.slice(0, 7) ? j : E().dernierJourDuMois(m);
}

function vuePro() {
  const c = ctx();
  const m = vue.mois;
  const R = c.reglages;
  const p = C().moisPro(c, m);
  const jourRef = jourDeReference(m);
  const res = C().reserve(c, jourRef);
  const v = C().jePeuxMeVerser(c, m);
  const enCours = m === moisCourant();

  const demarrage = (D().etat.gestion.soldes.length === 0 || R.matelas === null || R.besoinMensuel === null) ? carteDemarrage(R) : '';

  const tuileEncaisse = tuile('encaisse', 'Ce que mes clientes m\'ont payé', euros(p.encaisse),
    `${enCours ? 'depuis le 1er du mois' : 'en ' + nomMois(m)}${p.encaisseCorrige !== null ? ' · corrigé à la main' : p.logiciel.carte ? ` · dont ${euros(p.logiciel.carte)} par carte` : ''}`);
  const tuileReste = tuile('frais', 'Ce qu\'il me reste après les frais', euros(p.reste),
    `${enCours ? 'mois en cours · ' : ''}${euros(p.frais)} de frais${p.adsInconnu ? ' · Google Ads en attente' : ''}`, p.reste < 0 ? 'negatif' : '');

  const matelas = C().nombreOuNull(R.matelas);
  const jauge = (res.montant !== null && matelas)
    ? `<span class="ge-jauge" role="img" aria-label="${Math.round(res.montant / matelas * 100)} % du matelas"><span style="width:${Math.max(0, Math.min(100, res.montant / matelas * 100))}%"></span></span>` : '';
  const tuileReserve = tuile('reserve', 'Ma réserve', res.montant === null ? 'À renseigner' : euros(res.montant),
    `${matelas ? `matelas ${euros(matelas)}` : 'compte pro + caisse'}${res.incomplet && res.montant !== null ? ' · un solde manque' : ''}`, '', jauge);

  const statuts = { ok: 'OK', tendu: 'Tendu', alerte: 'Alerte' };
  const tuileVerser = tuile('verser', 'Je peux me verser', v.recommande === null ? '—' : euros(v.recommande),
    `${v.statut ? `<strong>${statuts[v.statut]}</strong> · ` : ''}calculé sur ${nomMois(v.base)}${v.provisoire ? ' (pas encore clôturé)' : ''}`, v.statut ? `statut-${v.statut}` : '');

  return `
    ${demarrage}
    ${carteADeclarer(c, m)}
    <div class="ge-tuiles">${tuileEncaisse}${tuileReste}${tuileReserve}${tuileVerser}</div>
    <div class="ge-detail" id="ge-detail">${detailPro(c, p, res, v, jourRef)}</div>
    <section class="ge-carte ge-courbe-carte">
      <h3>Ma réserve, mois par mois</h3>
      <div id="ge-courbe" class="ge-courbe"></div>
      <p class="ge-aide">Trait plein : ta réserve à la fin de chaque mois. Pointillés : la suite jusqu'au printemps, si l'activité ressemble à l'an dernier
        et que tu te verses ${euros(C().nombreOuNull(R.besoinMensuel) || 0)} par mois.</p>
    </section>
    ${blocCloture(m)}`;
}

function tuile(cle, titre, valeur, note, classe = '', extra = '') {
  const ouverte = vue.detail === cle;
  return `
    <button class="ge-tuile ${classe} ${ouverte ? 'ouverte' : ''}" data-ge="detail" data-valeur="${cle}" aria-expanded="${ouverte}">
      <span class="ge-tuile-titre">${titre}</span>
      <span class="ge-tuile-valeur">${valeur}</span>
      ${extra}
      <span class="ge-tuile-note">${note}</span>
    </button>`;
}

function carteDemarrage(R) {
  const precedent = E().decalerMois(moisCourant(), -1);
  const manque = [];
  if (D().etat.gestion.soldes.length === 0) manque.push(`tes soldes au ${dateCourte(E().dernierJourDuMois(precedent))} (compte pro, caisse comptée, compte perso, épargne)`);
  if (R.matelas === null) manque.push('ton matelas de sécurité');
  if (R.besoinMensuel === null) manque.push('ce dont tu as besoin chaque mois');
  return `
    <div class="ge-carte ge-demarrage">
      <strong>Pour démarrer</strong>
      <p>Il me manque ${manque.join(', ')}. ${deMois(precedent).replace(/^d/, 'D')} sert de point de départ.</p>
      <div class="ge-actions">
        ${D().etat.gestion.soldes.length === 0 ? `<button class="btn-primary" data-ge="soldes-depart">Recopier mes soldes</button>` : ''}
        <button class="btn-secondary" data-ge="onglet" data-valeur="reglages">Ouvrir les réglages</button>
      </div>
    </div>`;
}

function carteADeclarer(c, m) {
  const a = C().aDeclarer(c, m);
  const info = a.declare === null
    ? `<button class="ge-lien" data-ge="declarer" data-valeur="${a.moisConcerne}">Saisir ce que j'ai déclaré</button>`
    : `Déclaré : <strong>${euros(a.declare)}</strong> <button class="ge-lien" data-ge="declarer" data-valeur="${a.moisConcerne}">modifier</button>`;
  const message = a.resteNonDeclare > 0
    ? `<p class="ge-info">Il reste ${euros(a.resteNonDeclare)} encaissés en ${nomMois(a.moisConcerne)} non déclarés (environ ${euros(a.cotisationsCorrespondantes)} de cotisations).</p>` : '';
  return `
    <div class="ge-carte ge-declarer">
      <div><span class="ge-petit">À déclarer en ${nomMois(m)}</span>
        <span class="ge-declarer-montant">${euros(a.montant)}</span>
        <span class="ge-petit">encaissés en ${nomMois(a.moisConcerne)}</span></div>
      <div class="ge-declarer-saisie">${info}</div>
      ${message}
    </div>`;
}

function detailPro(c, p, res, v, jourRef) {
  switch (vue.detail) {
    case 'encaisse': return detailEncaisse(p);
    case 'frais': return detailFrais(p);
    case 'reserve': return detailReserve(c, res, jourRef);
    case 'verser': return detailVerser(v);
    default: return '';
  }
}

function ligne(libelle, montant, { classe = '', action = '', note = '' } = {}) {
  return `<div class="ge-ligne ${classe}"><span class="ge-ligne-libelle">${libelle}${note ? `<span class="ge-ligne-note">${note}</span>` : ''}</span><span class="ge-ligne-montant">${montant}</span>${action}</div>`;
}

function boutonModifier(attrs, texte = 'Modifier') {
  return `<button class="ge-mini" ${attrs}>${texte}</button>`;
}

function detailEncaisse(p) {
  const L = p.logiciel;
  const moyens = ['Liquide', 'Carte bleue', 'Virement', 'Chèque']
    .filter(mo => L.parMoyen[mo])
    .map(mo => ligne(mo === 'Liquide' ? 'En liquide' : mo === 'Carte bleue' ? 'Par carte' : mo === 'Virement' ? 'Par virement' : 'Par chèque', euros(L.parMoyen[mo]))).join('');
  const saisies = D().etat.gestion.mouvements
    .filter(mv => (mv.espace || 'pro') === 'pro' && mv.sens === 'entree' && mv.date.slice(0, 7) === p.mois)
    .map(mv => ligne(`${esc(mv.libelle || mv.categorie || 'Encaissement')}`, euros(mv.montant), { note: `${dateCourte(mv.date)} · ajouté ici`, action: boutonModifier(`data-ge="modifier-mouvement" data-valeur="${mv.id}"`) })).join('');
  return `
    <div class="ge-carte">
      <h3>Ce que mes clientes m'ont payé en ${nomMois(p.mois)}</h3>
      ${moyens || '<p class="ge-aide">Aucune prestation encaissée dans le logiciel ce mois-ci.</p>'}
      ${L.tips ? ligne('dont pourboires', euros(L.tips), { classe: 'ge-sous' }) : ''}
      ${L.bonsVendus ? ligne('dont cartes cadeaux vendues', euros(L.bonsVendus), { classe: 'ge-sous' }) : ''}
      ${L.bonsRembourses ? ligne('cartes cadeaux remboursées', euros(L.bonsRembourses), { classe: 'ge-sous' }) : ''}
      ${saisies}
      ${ligne('<strong>Calculé</strong>', `<strong>${euros(p.encaisseCalcule)}</strong>`, { classe: 'ge-total' })}
      ${p.encaisseCorrige !== null ? ligne('Corrigé à la main', `<strong>${euros(p.encaisseCorrige)}</strong>`, { action: boutonModifier(`data-ge="corriger" data-cle="ca" data-valeur="${p.mois}"`) }) : ''}
      <p class="ge-aide">Les prestations payées avec une carte cadeau ne comptent pas : la carte a déjà été comptée le jour de sa vente.</p>
      <div class="ge-actions">
        <button class="btn-secondary" data-ge="ajouter" data-type="pro-entree">+ Encaissement hors logiciel</button>
        <button class="btn-secondary" data-ge="corriger" data-cle="ca" data-valeur="${p.mois}">Corriger le total</button>
      </div>
    </div>`;
}

// Les depenses du logiciel de meme libelle sont regroupees (ex. le loyer de la cabine, jour par jour)
function regrouperLogiciel(postes) {
  const groupes = [];
  const index = {};
  postes.forEach(po => {
    if (po.source !== 'logiciel') { groupes.push(po); return; }
    if (index[po.libelle] === undefined) { index[po.libelle] = groupes.length; groupes.push({ ...po, nombre: 1 }); return; }
    const g = groupes[index[po.libelle]];
    g.montant = C().arrondi(g.montant + po.montant);
    g.nombre += 1;
    g.date = null;
  });
  return groupes;
}

function detailFrais(p) {
  const etiquettes = { logiciel: 'logiciel', fixe: 'charge fixe', saisie: 'ajouté ici' };
  const lignes = regrouperLogiciel(p.postes).map(po => {
    let note = etiquettes[po.source] || 'calculé';
    if (po.nombre > 1) note = `${po.nombre} fois · ${note}`;
    if (po.source === 'saisie' && po.categorie && po.categorie !== po.libelle) note = `${esc(po.categorie)} · ${note}`;
    if (po.cle === 'urssaf') note = `${pourcent(D().reglages().tauxUrssaf)} ${p.declare !== null ? 'du montant déclaré' : 'de l\'encaissé'}`;
    if (po.cle === 'carte') note = `${pourcent(D().reglages().tauxCarte)} des paiements par carte`;
    if (po.cle === 'ads') note = po.inconnu ? (D().etat.adsErreur ? esc(D().etat.adsErreur) : 'en attente de Google') : 'lu chez Google';
    if (po.calcule !== undefined && po.calcule !== null && po.corrigeable && Math.abs(po.montant - po.calcule) > 0.004) note += ` · calculé : ${euros(po.calcule)}`;
    if (po.date) note = `${dateCourte(po.date)} · ${note}`;
    let action = '';
    if (po.corrigeable) action = boutonModifier(`data-ge="corriger" data-cle="${po.cle}" data-valeur="${p.mois}"`, 'Corriger');
    else if (po.source === 'saisie') action = boutonModifier(`data-ge="modifier-mouvement" data-valeur="${po.ref.id}"`);
    return ligne(esc(po.libelle), euros(po.montant), { note, action });
  }).join('');
  return `
    <div class="ge-carte">
      <h3>Les frais ${deMois(p.mois)}</h3>
      ${ligne('Encaissé', euros(p.encaisse))}
      ${lignes}
      ${ligne('<strong>Total des frais</strong>', `<strong>${euros(p.frais)}</strong>`, { classe: 'ge-total' })}
      ${ligne('<strong>Ce qu\'il me reste</strong>', `<strong>${euros(p.reste)}</strong>`, { classe: 'ge-total' })}
      <p class="ge-aide">L'URSSAF et Google Ads comptent dans le mois qu'ils concernent, même s'ils sont prélevés le mois suivant.
        Les estimations de frais kilométriques du logiciel ne sont pas comptées.</p>
      <div class="ge-actions">
        <button class="btn-secondary" data-ge="ajouter" data-type="pro-sortie">+ Ajouter un frais</button>
        <button class="btn-secondary" data-ge="onglet" data-valeur="reglages">Charges fixes</button>
      </div>
    </div>`;
}

function detailReserve(c, res, jourRef) {
  const comptes = res.parts.map(pa => {
    const nom = C().COMPTES[pa.compte];
    if (pa.montant === null) return ligne(nom, 'à renseigner', { action: boutonModifier(`data-ge="solde" data-valeur="${pa.compte}"`, 'Renseigner') });
    const note = pa.estime ? `estimé d'après ton relevé du ${dateCourte(pa.depuis)}` : `relevé du ${dateCourte(pa.depuis)}`;
    return ligne(nom, euros(pa.montant), { note, action: boutonModifier(`data-ge="solde" data-valeur="${pa.compte}"`, 'Mettre à jour') });
  }).join('');

  // Le journal de la caisse du mois : liquide encaisse (par jour) + mouvements
  const m = vue.mois;
  const flux = C().fluxConcernant(c, m).filter(f => f.compte === 'caisse' && f.date.slice(0, 7) === m);
  const parJour = {};
  const autres = [];
  flux.forEach(f => {
    if (f.source === 'logiciel' && f.type === 'encaissement') parJour[f.date] = (parJour[f.date] || 0) + f.montant;
    else autres.push(f);
  });
  const journal = [
    ...Object.entries(parJour).map(([d, mt]) => ({ date: d, libelle: 'Prestations en liquide', montant: mt })),
    ...autres.map(f => ({ date: f.date, libelle: [f.categorie, f.libelle].filter((x, i, a) => x && a.indexOf(x) === i).join(' · ') || (f.type === 'transfert' ? 'Dépôt / transfert' : 'Mouvement'), montant: f.montant, id: f.source === 'saisie' ? f.id : null }))
  ].sort((a, b) => a.date.localeCompare(b.date))
    .map(l => ligne(`${dateCourte(l.date)} · ${esc(l.libelle)}`, euros(l.montant, { signe: true }), { action: l.id ? boutonModifier(`data-ge="modifier-mouvement" data-valeur="${l.id}"`) : '' })).join('');

  return `
    <div class="ge-carte">
      <h3>Ma réserve ${jourRef === aujourdhui() ? 'aujourd\'hui' : `au ${dateCourte(jourRef)}`}</h3>
      ${comptes}
      ${ligne('<strong>Total</strong>', `<strong>${euros(res.montant)}</strong>`, { classe: 'ge-total' })}
      <p class="ge-aide">Entre deux relevés, j'ajoute ce qui est entré et sorti : prestations, frais, URSSAF et Google Ads à leur date de prélèvement, dépôts, ce que tu te verses.</p>
      <h3 class="ge-h3-sous">La caisse en ${nomMois(m)}</h3>
      ${journal || '<p class="ge-aide">Aucun mouvement en liquide ce mois-ci.</p>'}
      <div class="ge-actions">
        <button class="btn-secondary" data-ge="ajouter" data-type="depot">Déposer en banque</button>
        <button class="btn-secondary" data-ge="ajouter" data-type="perso-sortie" data-compte="caisse">Pris dans la caisse pour moi</button>
      </div>
    </div>`;
}

function detailVerser(v) {
  const R = D().reglages();
  const dettes = v.dettes.map(d => ligne(`− ${esc(d.libelle)}`, euros(d.montant))).join('');
  const plafondNote = `moyenne de ${v.moisPlafond.map(m => nomMois(m)).join(', ')}`;
  const explications = {
    ok: `Tu peux te verser ce dont tu as besoin (${euros(v.besoin)}).`,
    tendu: `C'est un peu juste : moins que ton besoin de ${euros(v.besoin)}, mais au moins ${R.seuilTendu} % de celui-ci.`,
    alerte: `Attention : moins de ${R.seuilTendu} % de ton besoin de ${euros(v.besoin)}.`
  };
  return `
    <div class="ge-carte">
      <h3>Ce que je peux me verser</h3>
      ${v.reserve === null ? '<p class="ge-info">Il me faut tes soldes pour faire ce calcul.</p>' : `
      ${ligne(`Ma réserve fin ${nomMois(v.base)}`, euros(v.reserve))}
      ${dettes}
      ${ligne('− Mon matelas de sécurité', euros(v.matelas))}
      ${ligne('<strong>Ce que j\'ai de côté</strong>', `<strong>${euros(v.marge)}</strong>`, { classe: 'ge-total' })}
      ${ligne(`Ce ${C().queMois(v.base)} a rapporté`, euros(v.plafond), { note: v.moisPlafond.length > 1 ? plafondNote : '' })}
      ${ligne('<strong>Je peux me verser</strong>', `<strong>${euros(v.recommande)}</strong>`, { classe: 'ge-total' })}
      <p class="ge-aide">Le plus petit des deux : je ne te propose jamais plus que ce que le mois a rapporté, ni de toucher au matelas.</p>
      ${v.statut ? `<p class="ge-statut statut-${v.statut}">${explications[v.statut]}</p>` : '<p class="ge-aide">Renseigne ton besoin mensuel dans les réglages pour voir OK / Tendu / Alerte.</p>'}
      ${v.provisoire ? `<p class="ge-info">${nomMois(v.base).replace(/^./, x => x.toUpperCase())} n'est pas clôturé : ce chiffre peut encore bouger.</p>` : ''}
      `}
      ${ligne(`Déjà pris pour moi en ${nomMois(vue.mois)}`, euros(v.dejaPris))}
      <div class="ge-actions">
        <button class="btn-primary" data-ge="ajouter" data-type="verser">Me verser de l'argent</button>
        ${v.provisoire && v.base < moisCourant() ? `<button class="btn-secondary" data-ge="cloturer" data-valeur="${v.base}">Clôturer ${nomMois(v.base)}</button>` : ''}
      </div>
    </div>`;
}

function blocCloture(m) {
  if (m >= moisCourant()) return '';
  const info = D().etat.gestion.mois[m];
  return info?.clotureLe
    ? `<div class="ge-cloture">${nomMois(m, true).replace(/^./, x => x.toUpperCase())} est clôturé (${dateCourte(info.clotureLe)}). <button class="ge-lien" data-ge="rouvrir" data-valeur="${m}">Rouvrir</button></div>`
    : `<div class="ge-cloture"><button class="btn-secondary" data-ge="cloturer" data-valeur="${m}">Clôturer ${nomMois(m)}</button>
        <span class="ge-petit">Une fois tout saisi : « Je peux me verser » partira de ce mois.</span></div>`;
}

// ----- Courbe -----

function dessinerCourbe() {
  const zone = document.getElementById('ge-courbe');
  if (!zone || typeof ApexCharts === 'undefined') return;
  const c = ctx();
  const cr = C().courbeReserve(c, aujourdhui());
  const mois = [...cr.points.map(p => p.mois), ...cr.projection.map(p => p.mois).filter(m => m !== moisCourant())];
  const reel = mois.map(m => { const p = cr.points.find(x => x.mois === m); return p ? p.reserve : null; });
  const projetee = mois.map(m => {
    const p = cr.projection.find(x => x.mois === m);
    if (p) return p.reserve;
    // relier la projection au dernier mois reel
    return m === E().decalerMois(moisCourant(), -1) ? (cr.points.find(x => x.mois === m)?.reserve ?? null) : null;
  });
  // On commence au premier mois dont la reserve est connue (pas de mois vides a gauche)
  const premier = reel.findIndex(v => v !== null);
  if (premier > 0) { mois.splice(0, premier); reel.splice(0, premier); projetee.splice(0, premier); }
  if (vue.courbe) { try { vue.courbe.destroy(); } catch (e) { /* rien */ } vue.courbe = null; }
  if (reel.every(v => v === null)) {
    zone.innerHTML = '<p class="ge-aide">La courbe apparaîtra dès que tes soldes de départ seront renseignés.</p>';
    return;
  }
  vue.courbe = new ApexCharts(zone, {
    chart: { type: 'line', height: 260, toolbar: { show: false }, zoom: { enabled: false }, fontFamily: 'Inter, sans-serif' },
    series: [{ name: 'Ma réserve', data: reel }, { name: 'Si ça continue', data: projetee }],
    xaxis: { categories: mois.map(m => `${MOIS_COURTS[Number(m.slice(5, 7)) - 1]} ${m.slice(2, 4)}`), labels: { rotate: 0, hideOverlappingLabels: true } },
    yaxis: { labels: { formatter: v => v === null ? '' : `${Math.round(v / 100) / 10} k€` } },
    stroke: { width: [3, 3], dashArray: [0, 6], curve: 'smooth' },
    colors: ['#b07a4f', '#c9a27e'],
    markers: { size: [4, 0] },
    dataLabels: { enabled: false },
    legend: { position: 'bottom' },
    tooltip: { y: { formatter: v => v === null ? '' : euros(v) } },
    annotations: cr.matelas ? { yaxis: [{ y: cr.matelas, borderColor: '#c0504d', strokeDashArray: 3, label: { text: `Matelas ${euros(cr.matelas)}`, style: { color: '#fff', background: '#c0504d' } } }] } : {},
    grid: { borderColor: '#efe6dd' }
  });
  vue.courbe.render();
}

// ----- Perso -----

function vuePerso() {
  const c = ctx();
  const m = vue.mois;
  const p = C().moisPerso(c, m);
  const jourRef = jourDeReference(m);
  const perso = C().soldeCompte(c, 'perso', jourRef);
  const epargne = C().soldeCompte(c, 'epargne', jourRef);

  const liste = (titre, flux, vide, actionType) => `
    <div class="ge-carte">
      <h3>${titre}</h3>
      ${flux.length ? flux.map(f => ligne(esc(f.libelle || f.categorie || '—'), euros(Math.abs(f.montant)), {
        note: `${f.source === 'recurrent' ? 'chaque mois' : dateCourte(f.date)}${f.categorie && f.libelle ? ' · ' + esc(f.categorie) : ''}${f.compte === 'caisse' ? ' · pris dans la caisse' : f.compte === 'pro' && f.type !== 'transfert' ? ' · payé avec le compte pro' : ''}`,
        action: f.source === 'saisie' && f.id ? boutonModifier(`data-ge="modifier-mouvement" data-valeur="${f.id}"`)
          : f.source === 'recurrent' && f.id ? boutonModifier(`data-ge="corriger" data-cle="rec:${f.id}" data-valeur="${m}"`, 'Ce mois-ci') : ''
      })).join('') : `<p class="ge-aide">${vide}</p>`}
      ${actionType ? `<div class="ge-actions"><button class="btn-secondary" data-ge="ajouter" data-type="${actionType}">+ Ajouter</button></div>` : ''}
    </div>`;

  const categories = Object.entries(p.parCategorie).sort((a, b) => b[1] - a[1])
    .map(([cat, mt]) => `<span class="ge-pastille">${esc(cat)} <strong>${euros(mt)}</strong></span>`).join('');

  // Une ligne par flux de transfert vers le perso ou l'epargne (cote qui recoit)
  const recus = p.revenus.map(f => f.type === 'transfert' ? { ...f, libelle: f.libelle || 'Versé depuis le pro' } : f);

  return `
    <div class="ge-tuiles">
      ${tuile('p-revenus', 'Ce qui est rentré', euros(p.totalRevenus), 'revenus + ce que je me suis versé')}
      ${tuile('p-fixes', 'Mes charges fixes', euros(p.totalFixes), 'tous les mois')}
      ${tuile('p-variables', 'Mes dépenses du mois', euros(p.totalVariables), `${p.variables.length} dépense${p.variables.length > 1 ? 's' : ''}`)}
      ${tuile('p-epargne', 'Mis de côté', euros(p.totalEpargne), 'ce mois-ci')}
    </div>
    <div class="ge-carte ge-soldes-perso">
      ${ligne('Compte perso', perso.montant === null ? 'à renseigner' : euros(perso.montant), { note: perso.depuis ? (perso.estime ? `estimé d'après le relevé du ${dateCourte(perso.depuis)}` : `relevé du ${dateCourte(perso.depuis)}`) : '', action: boutonModifier('data-ge="solde" data-valeur="perso"', perso.montant === null ? 'Renseigner' : 'Mettre à jour') })}
      ${ligne('Épargne', epargne.montant === null ? 'à renseigner' : euros(epargne.montant), { note: epargne.depuis ? `d'après le relevé du ${dateCourte(epargne.depuis)}` : '', action: boutonModifier('data-ge="solde" data-valeur="epargne"', epargne.montant === null ? 'Renseigner' : 'Mettre à jour') })}
      ${ligne('Reste pour vivre', `${euros(p.resteAVivreJour)} / jour`, { note: 'ce qui est rentré − charges fixes − mis de côté' })}
    </div>
    ${categories ? `<div class="ge-pastilles">${categories}</div>` : ''}
    ${vue.detail === 'p-revenus' || !vue.detail?.startsWith('p-') ? liste('Ce qui est rentré', recus, 'Rien pour l\'instant.', 'perso-entree') : ''}
    ${vue.detail === 'p-fixes' || !vue.detail?.startsWith('p-') ? liste('Mes charges fixes', p.fixes, 'Ajoute tes charges fixes dans les réglages.', null) : ''}
    ${vue.detail === 'p-variables' || !vue.detail?.startsWith('p-') ? liste('Mes dépenses du mois', p.variables, 'Aucune dépense saisie ce mois-ci.', 'perso-sortie') : ''}
    ${vue.detail === 'p-epargne' || !vue.detail?.startsWith('p-') ? liste('Mis de côté', p.epargne, 'Rien de mis de côté ce mois-ci.', 'epargne') : ''}`;
}

// ----- Reglages -----

function vueReglages() {
  const R = D().reglages();
  const champ = (cle, libelle, valeur, aide = '', attrs = 'type="number" step="0.01" inputmode="decimal"') => `
    <label class="ge-champ"><span>${libelle}</span>
      <input name="${cle}" ${attrs} value="${valeur ?? ''}">
      ${aide ? `<small>${aide}</small>` : ''}</label>`;
  const optionsComptes = (sel, liste = Object.keys(C().COMPTES)) => liste.map(k => `<option value="${k}" ${k === sel ? 'selected' : ''}>${C().COMPTES[k]}</option>`).join('');

  const groupes = Object.entries(TYPES_RECURRENTS).map(([k, t]) => {
    const lignes = D().etat.gestion.recurrents.filter(r => typeDuRecurrent(r) === k).map(r => ligne(
      esc(r.nom),
      euros(r.montant),
      { note: `${r.frequence === 'annuelle' ? `une fois par an, en ${C().NOMS_MOIS[(r.moisAnnuel || 1) - 1]}` : 'tous les mois'} · ${C().COMPTES[r.compte] || r.compte}${r.fin ? ` · jusqu'en ${nomMois(r.fin, true)}` : ''}`, action: boutonModifier(`data-ge="modifier-recurrent" data-valeur="${r.id}"`) }
    )).join('');
    return `<div class="ge-groupe"><div class="ge-groupe-tete"><h4>${t.titre}</h4><button class="ge-mini" data-ge="ajouter-recurrent" data-type="${k}">+ Ajouter</button></div>${lignes || '<p class="ge-aide">Aucune.</p>'}</div>`;
  }).join('');

  const soldes = [...D().etat.gestion.soldes].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 12)
    .map(s => ligne(`${C().COMPTES[s.compte] || s.compte}`, euros(s.montant), { note: `relevé du ${dateCourte(s.date)}/${s.date.slice(2, 4)}`, action: boutonModifier(`data-ge="modifier-solde" data-valeur="${s.id}"`) })).join('');

  const cats = R.categories;
  const champCategories = (cle, libelle) => `
    <label class="ge-champ ge-champ-large"><span>${libelle}</span>
      <input name="cat-${cle}" type="text" value="${esc((cats[cle] || []).join(', '))}">
    </label>`;

  return `
    <form class="ge-carte ge-reglages" data-ge-form="reglages">
      <h3>Mes repères</h3>
      <div class="ge-grille-champs">
        ${champ('matelas', 'Matelas de sécurité (€)', R.matelas, 'L\'argent que je ne touche pas.')}
        ${champ('besoinMensuel', 'Mon besoin chaque mois (€)', R.besoinMensuel, 'Ce qu\'il me faut pour vivre.')}
        ${champ('seuilTendu', '« Tendu » à partir de (% du besoin)', R.seuilTendu, 'En dessous : Alerte.', 'type="number" step="1" min="0" max="100" inputmode="numeric"')}
        <label class="ge-champ"><span>« Ce que le mois a rapporté »</span>
          <select name="moyenneSur"><option value="1" ${Number(R.moyenneSur) !== 3 ? 'selected' : ''}>Le dernier mois clôturé</option><option value="3" ${Number(R.moyenneSur) === 3 ? 'selected' : ''}>La moyenne des 3 derniers mois</option></select>
          <small>Avec les saisons, la moyenne lisse les mois creux.</small></label>
        ${champ('tauxUrssaf', 'Taux URSSAF (%)', R.tauxUrssaf)}
        ${champ('tauxCarte', 'Commission carte SumUp (%)', R.tauxCarte, 'À changer si la formule ou le prestataire change.')}
        <label class="ge-champ"><span>L'URSSAF est payée depuis</span><select name="compteUrssaf">${optionsComptes(R.compteUrssaf)}</select>
          <small>Si c'est l'épargne, elle ne baisse pas ta réserve.</small></label>
        <label class="ge-champ"><span>Le loyer de la cabine est payé avec</span><select name="compteLoyer">${optionsComptes(R.compteParCategorie.Loyer || 'caisse', ['caisse', 'pro'])}</select></label>
      </div>
      <h3>Mes catégories</h3>
      <p class="ge-aide">Séparées par des virgules. Tu peux aussi écrire une catégorie nouvelle directement en saisissant une dépense.</p>
      ${champCategories('persoVariable', 'Dépenses perso')}
      ${champCategories('persoFixe', 'Charges fixes perso')}
      ${champCategories('persoEntree', 'Revenus perso')}
      ${champCategories('epargne', 'Épargne')}
      ${champCategories('proSortie', 'Frais pro')}
      ${champCategories('proEntree', 'Encaissements hors logiciel')}
      <div class="ge-actions"><button class="btn-primary" type="submit">Enregistrer</button></div>
    </form>
    <div class="ge-carte">
      <h3>Ce qui revient tous les mois (ou tous les ans)</h3>
      <p class="ge-aide">Une charge fixe compte pour le mois, sans jour de prélèvement. Planity vient déjà du logiciel : pas besoin de l'ajouter ici.</p>
      ${groupes}
    </div>
    <div class="ge-carte">
      <div class="ge-groupe-tete"><h3>Mes soldes recopiés</h3><button class="ge-mini" data-ge="solde" data-valeur="pro">+ Nouveau relevé</button></div>
      ${soldes || '<p class="ge-aide">Aucun pour l\'instant.</p>'}
    </div>`;
}

// ----- Fenetres de saisie -----

function ouvrir(id, html) {
  showModal(id, html);
}

function fermer() {
  if (typeof closeModalCompletely === 'function') closeModalCompletely(); else closeModal();
}

function optionsCategories(cle, valeur) {
  const liste = (D().reglages().categories[cle] || []);
  return `<datalist id="ge-cats-${cle}">${liste.map(c => `<option value="${esc(c)}">`).join('')}</datalist>
    <input name="categorie" list="ge-cats-${cle}" value="${esc(valeur || '')}" placeholder="Choisir ou écrire">`;
}

function formulaireMouvement(type, mv = null, compteForce = null) {
  const t = TYPES[type];
  const comptes = t.comptes.map(k => `<option value="${k}" ${(mv?.compte || compteForce || t.comptes[0]) === k ? 'selected' : ''}>${C().COMPTES[k]}</option>`).join('');
  const choixType = Object.entries(TYPES).filter(([, x]) => x.espace === t.espace)
    .map(([k, x]) => `<option value="${k}" ${k === type ? 'selected' : ''}>${x.titre}</option>`).join('');
  const montant = mv && mv.montant !== '' && mv.montant !== null && mv.montant !== undefined ? Math.abs(Number(mv.montant)) : '';
  return `
    <h3>${mv?.id ? 'Modifier' : 'Ajouter'}</h3>
    <form class="ge-formulaire" data-ge-form="mouvement" data-id="${mv?.id || ''}">
      <label class="ge-champ"><span>Quoi ?</span><select name="type" data-ge-change="type-mouvement">${choixType}</select></label>
      <div class="ge-grille-champs">
        <label class="ge-champ"><span>Montant (€)</span><input name="montant" type="number" step="0.01" min="0" inputmode="decimal" required value="${montant}"></label>
        <label class="ge-champ"><span>Date</span><input name="date" type="date" required value="${mv?.date || (vue.mois === moisCourant() ? aujourdhui() : E().dernierJourDuMois(vue.mois))}"></label>
        <label class="ge-champ"><span>${t.sens === 'entree' ? 'Arrivé sur' : t.sens === 'transfert' ? 'Depuis' : 'Payé avec'}</span><select name="compte">${comptes}</select></label>
        ${t.vers ? `<label class="ge-champ"><span>Vers</span><input value="${C().COMPTES[t.vers]}" disabled></label>` : ''}
        ${t.categories ? `<label class="ge-champ"><span>Catégorie</span>${optionsCategories(t.categories, mv?.categorie)}</label>` : ''}
        <label class="ge-champ ge-champ-large"><span>Libellé (facultatif)</span><input name="libelle" type="text" value="${esc(mv?.libelle || '')}"></label>
      </div>
      <div class="modal-actions ge-actions">
        ${mv?.id ? '<button type="button" class="btn-secondary ge-danger" data-ge="supprimer-mouvement" data-valeur="' + mv.id + '">Supprimer</button>' : ''}
        <button type="submit" class="btn-primary">Enregistrer</button>
      </div>
    </form>`;
}

function formulaireRecurrent(type, r = null) {
  const t = TYPES_RECURRENTS[type];
  const comptes = t.comptes.map(k => `<option value="${k}" ${(r?.compte || t.comptes[0]) === k ? 'selected' : ''}>${C().COMPTES[k]}</option>`).join('');
  const moisOptions = C().NOMS_MOIS.map((n, i) => `<option value="${i + 1}" ${Number(r?.moisAnnuel) === i + 1 ? 'selected' : ''}>${n}</option>`).join('');
  const annuelle = r?.frequence === 'annuelle';
  const debutDefaut = E().decalerMois(moisCourant(), -1);
  return `
    <h3>${t.titre}</h3>
    <form class="ge-formulaire" data-ge-form="recurrent" data-id="${r?.id || ''}" data-type="${type}">
      <div class="ge-grille-champs">
        <label class="ge-champ ge-champ-large"><span>Nom</span><input name="nom" type="text" required value="${esc(r?.nom || '')}"></label>
        <label class="ge-champ"><span>Montant (€)</span><input name="montant" type="number" step="0.01" min="0" inputmode="decimal" required value="${r ? r.montant : ''}"></label>
        <label class="ge-champ"><span>Compte</span><select name="compte">${comptes}</select></label>
        ${t.categories ? `<label class="ge-champ"><span>Catégorie</span>${optionsCategories(t.categories, r?.categorie)}</label>` : ''}
        <label class="ge-champ"><span>Fréquence</span><select name="frequence" data-ge-change="frequence"><option value="mensuelle" ${annuelle ? '' : 'selected'}>Tous les mois</option><option value="annuelle" ${annuelle ? 'selected' : ''}>Une fois par an</option></select></label>
        <label class="ge-champ ge-si-annuelle" ${annuelle ? '' : 'hidden'}><span>Quel mois ?</span><select name="moisAnnuel">${moisOptions}</select></label>
        <label class="ge-champ"><span>À partir de</span><input name="debut" type="month" required value="${r?.debut || debutDefaut}"></label>
        <label class="ge-champ"><span>Jusqu'à (facultatif)</span><input name="fin" type="month" value="${r?.fin || ''}"></label>
      </div>
      <div class="modal-actions ge-actions">
        ${r ? `<button type="button" class="btn-secondary ge-danger" data-ge="supprimer-recurrent" data-valeur="${r.id}">Supprimer</button>` : ''}
        <button type="submit" class="btn-primary">Enregistrer</button>
      </div>
    </form>`;
}

function formulaireSolde(compte, s = null) {
  const options = Object.entries(C().COMPTES).map(([k, n]) => `<option value="${k}" ${(s?.compte || compte) === k ? 'selected' : ''}>${n}</option>`).join('');
  return `
    <h3>${s ? 'Modifier le relevé' : 'Recopier un solde'}</h3>
    <p class="ge-aide">Le solde affiché dans ton appli bancaire (ou l'argent compté dans la caisse), à la date du jour.</p>
    <form class="ge-formulaire" data-ge-form="solde" data-id="${s?.id || ''}">
      <div class="ge-grille-champs">
        <label class="ge-champ"><span>Compte</span><select name="compte">${options}</select></label>
        <label class="ge-champ"><span>Solde (€)</span><input name="montant" type="number" step="0.01" inputmode="decimal" required value="${s ? s.montant : ''}"></label>
        <label class="ge-champ"><span>Date</span><input name="date" type="date" required value="${s?.date || aujourdhui()}"></label>
      </div>
      <div class="modal-actions ge-actions">
        ${s ? `<button type="button" class="btn-secondary ge-danger" data-ge="supprimer-solde" data-valeur="${s.id}">Supprimer</button>` : ''}
        <button type="submit" class="btn-primary">Enregistrer</button>
      </div>
    </form>`;
}

function formulaireSoldesDepart() {
  const jour = E().dernierJourDuMois(E().decalerMois(moisCourant(), -1));
  const champs = Object.entries(C().COMPTES).map(([k, n]) => `
    <label class="ge-champ"><span>${n}</span><input name="${k}" type="number" step="0.01" inputmode="decimal" placeholder="laisser vide si aucun"></label>`).join('');
  return `
    <h3>Mes soldes au ${dateCourte(jour)}</h3>
    <p class="ge-aide">Le point de départ. Pour la caisse : l'argent liquide compté.</p>
    <form class="ge-formulaire" data-ge-form="soldes-depart" data-date="${jour}">
      <div class="ge-grille-champs">${champs}</div>
      <div class="modal-actions ge-actions"><button type="submit" class="btn-primary">Enregistrer</button></div>
    </form>`;
}

function formulaireCorrection(mois, cle) {
  const c = ctx();
  const info = D().etat.gestion.mois[mois] || {};
  const actuelle = info.corrections?.[cle];
  let titre = 'Corriger';
  let calcule = null;
  const p = C().moisPro(c, mois);
  if (cle === 'ca') { titre = `Ce que mes clientes m'ont payé en ${nomMois(mois)}`; calcule = p.encaisseCalcule; }
  else if (cle === 'urssaf') { titre = `URSSAF ${deMois(mois)}`; calcule = p.urssafCalcule; }
  else if (cle === 'carte') { titre = `Commission carte ${deMois(mois)}`; calcule = p.commissionCalculee; }
  else if (cle === 'ads') { titre = `Google Ads ${deMois(mois)}`; calcule = p.adsGoogle; }
  else if (cle.startsWith('rec:')) {
    const r = D().etat.gestion.recurrents.find(x => `rec:${x.id}` === cle);
    titre = `${r?.nom || 'Charge fixe'} en ${nomMois(mois)}`; calcule = r ? Number(r.montant) : null;
  }
  return `
    <h3>${esc(titre)}</h3>
    <p class="ge-aide">Calculé : ${euros(calcule)}. Le montant saisi remplace le calcul pour ce mois seulement${cle.startsWith('rec:') ? ' (0 = pas ce mois-ci)' : ''}.</p>
    <form class="ge-formulaire" data-ge-form="correction" data-mois="${mois}" data-cle="${esc(cle)}">
      <label class="ge-champ"><span>Montant (€)</span><input name="montant" type="number" step="0.01" inputmode="decimal" required value="${actuelle ?? ''}"></label>
      <div class="modal-actions ge-actions">
        ${actuelle !== undefined ? '<button type="button" class="btn-secondary" data-ge="annuler-correction">Revenir au calcul</button>' : ''}
        <button type="submit" class="btn-primary">Enregistrer</button>
      </div>
    </form>`;
}

function formulaireDeclare(mois) {
  const c = ctx();
  const t = C().totauxPro(c, mois);
  return `
    <h3>Ce que j'ai déclaré pour ${nomMois(mois)}</h3>
    <p class="ge-aide">Encaissé en ${nomMois(mois)} : ${euros(t.encaisse)}. L'URSSAF du mois est calculée sur le montant déclaré.</p>
    <form class="ge-formulaire" data-ge-form="declare" data-mois="${mois}">
      <label class="ge-champ"><span>Montant déclaré (€)</span><input name="montant" type="number" step="1" inputmode="decimal" required value="${t.declare ?? ''}"></label>
      <div class="modal-actions ge-actions">
        ${t.declare !== null ? '<button type="button" class="btn-secondary" data-ge="effacer-declare" data-valeur="' + mois + '">Effacer</button>' : ''}
        <button type="submit" class="btn-primary">Enregistrer</button>
      </div>
    </form>`;
}

// ----- Evenements -----

function lierEvenements() {
  if (vue.lie) return;
  vue.lie = true;
  document.addEventListener('click', e => {
    const el = e.target.closest('[data-ge]');
    if (!el || !(el.closest('#gestion') || el.closest('#modal-overlay'))) return;
    e.preventDefault();
    action(el.dataset.ge, el).catch(err => {
      console.error('Gestion :', err);
      notifier(`Erreur : ${err.message || err}`, 'error');
    });
  });
  document.addEventListener('submit', e => {
    const f = e.target.closest('form[data-ge-form]');
    if (!f) return;
    e.preventDefault();
    soumettre(f).catch(err => {
      console.error('Gestion :', err);
      notifier(`Erreur à l'enregistrement : ${err.message || err}`, 'error');
    });
  });
  document.addEventListener('change', e => {
    const el = e.target.closest('[data-ge-change]');
    if (!el) return;
    if (el.dataset.geChange === 'type-mouvement') {
      // Changer « Quoi ? » redessine le formulaire en gardant ce qui est deja saisi
      const f = el.closest('form');
      ouvrir('gestion-modal', formulaireMouvement(el.value, {
        id: f.dataset.id || null,
        montant: f.elements.montant.value,
        date: f.elements.date.value,
        libelle: f.elements.libelle.value,
        categorie: null,
        compte: null
      }));
    } else if (el.dataset.geChange === 'frequence') {
      el.closest('form').querySelector('.ge-si-annuelle').hidden = el.value !== 'annuelle';
    }
  });
}

async function action(nom, el) {
  const v = el.dataset.valeur;
  switch (nom) {
    case 'recharger':
      D().etat.charge = false; return afficher();
    case 'onglet':
      vue.onglet = v; vue.detail = null; return rendre();
    case 'mois':
      vue.mois = E().decalerMois(vue.mois, Number(v));
      if (vue.mois > moisCourant()) vue.mois = moisCourant();
      return rendre();
    case 'detail':
      vue.detail = vue.detail === v ? null : v;
      rendre();
      document.getElementById('ge-detail')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      return;
    case 'ajouter':
      return ouvrir('gestion-modal', formulaireMouvement(el.dataset.type, null, el.dataset.compte || null));
    case 'modifier-mouvement': {
      const mv = D().etat.gestion.mouvements.find(x => x.id === v);
      return mv && ouvrir('gestion-modal', formulaireMouvement(typeDuMouvement(mv), mv));
    }
    case 'supprimer-mouvement':
      if (!confirm('Supprimer cette ligne ?')) return;
      await D().supprimerMouvement(v); fermer(); notifier('Supprimé'); return rendre();
    case 'ajouter-recurrent':
      return ouvrir('gestion-modal', formulaireRecurrent(el.dataset.type));
    case 'modifier-recurrent': {
      const r = D().etat.gestion.recurrents.find(x => x.id === v);
      return r && ouvrir('gestion-modal', formulaireRecurrent(typeDuRecurrent(r), r));
    }
    case 'supprimer-recurrent':
      if (!confirm('Supprimer cette ligne ? Pour l\'arrêter sans effacer le passé, mets plutôt une date de fin.')) return;
      await D().supprimerRecurrent(v); fermer(); notifier('Supprimé'); return rendre();
    case 'solde':
      return ouvrir('gestion-modal', formulaireSolde(v));
    case 'modifier-solde': {
      const s = D().etat.gestion.soldes.find(x => x.id === v);
      return s && ouvrir('gestion-modal', formulaireSolde(s.compte, s));
    }
    case 'supprimer-solde':
      if (!confirm('Supprimer ce relevé ?')) return;
      await D().supprimerSolde(v); fermer(); notifier('Supprimé'); return rendre();
    case 'soldes-depart':
      return ouvrir('gestion-modal', formulaireSoldesDepart());
    case 'corriger':
      return ouvrir('gestion-modal', formulaireCorrection(v, el.dataset.cle));
    case 'annuler-correction': {
      const f = el.closest('.modal-content').querySelector('form');
      await D().corriger(f.dataset.mois, f.dataset.cle, null); fermer(); notifier('Retour au calcul'); return rendre();
    }
    case 'declarer':
      return ouvrir('gestion-modal', formulaireDeclare(v));
    case 'effacer-declare':
      await D().enregistrerMois(v, { caDeclare: null }); fermer(); return rendre();
    case 'cloturer':
      await D().enregistrerMois(v, { clotureLe: aujourdhui() }); notifier(`${nomMois(v, true)} clôturé`); return rendre();
    case 'rouvrir':
      await D().enregistrerMois(v, { clotureLe: null }); return rendre();
    default:
      return undefined;
  }
}

function lireNombre(f, nom) {
  const v = f.elements[nom]?.value;
  if (v === undefined || v === '') return null;
  const n = Number(String(v).replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

async function soumettre(f) {
  const quoi = f.dataset.geForm;
  if (quoi === 'mouvement') {
    const type = f.elements.type.value;
    const t = TYPES[type];
    const montant = lireNombre(f, 'montant');
    if (montant === null || montant <= 0) return notifier('Indique un montant', 'warning');
    await D().enregistrerMouvement({
      id: f.dataset.id || undefined,
      date: f.elements.date.value,
      espace: t.espace,
      sens: t.sens,
      compte: f.elements.compte.value,
      compteVers: t.vers || null,
      categorie: f.elements.categorie?.value.trim() || null,
      libelle: f.elements.libelle.value.trim() || null,
      montant
    });
    vue.mois = f.elements.date.value.slice(0, 7) <= moisCourant() ? f.elements.date.value.slice(0, 7) : vue.mois;
  } else if (quoi === 'recurrent') {
    const t = TYPES_RECURRENTS[f.dataset.type];
    const frequence = f.elements.frequence.value;
    await D().enregistrerRecurrent({
      id: f.dataset.id || undefined,
      espace: t.espace,
      sens: t.sens,
      compte: f.elements.compte.value,
      compteVers: t.vers || null,
      categorie: f.elements.categorie?.value.trim() || null,
      nom: f.elements.nom.value.trim(),
      montant: lireNombre(f, 'montant') || 0,
      frequence,
      moisAnnuel: frequence === 'annuelle' ? Number(f.elements.moisAnnuel.value) : null,
      debut: f.elements.debut.value,
      fin: f.elements.fin.value || null
    });
  } else if (quoi === 'solde') {
    await D().enregistrerSolde({
      id: f.dataset.id || undefined,
      compte: f.elements.compte.value,
      date: f.elements.date.value,
      montant: lireNombre(f, 'montant') ?? 0
    });
  } else if (quoi === 'soldes-depart') {
    const date = f.dataset.date;
    const saisies = Object.keys(C().COMPTES).map(k => ({ compte: k, montant: lireNombre(f, k) })).filter(s => s.montant !== null);
    if (!saisies.length) return notifier('Renseigne au moins un solde', 'warning');
    for (const s of saisies) await D().enregistrerSolde({ ...s, date });
  } else if (quoi === 'correction') {
    await D().corriger(f.dataset.mois, f.dataset.cle, lireNombre(f, 'montant'));
  } else if (quoi === 'declare') {
    await D().enregistrerMois(f.dataset.mois, { caDeclare: lireNombre(f, 'montant') });
  } else if (quoi === 'reglages') {
    const categories = {};
    ['persoVariable', 'persoFixe', 'persoEntree', 'epargne', 'proSortie', 'proEntree'].forEach(k => {
      categories[k] = (f.elements[`cat-${k}`].value || '').split(',').map(s => s.trim()).filter(Boolean);
    });
    const R = D().reglages();
    await D().enregistrerReglages({
      matelas: lireNombre(f, 'matelas'),
      besoinMensuel: lireNombre(f, 'besoinMensuel'),
      seuilTendu: lireNombre(f, 'seuilTendu') ?? 70,
      moyenneSur: Number(f.elements.moyenneSur.value) || 1,
      tauxUrssaf: lireNombre(f, 'tauxUrssaf') ?? 21.4,
      tauxCarte: lireNombre(f, 'tauxCarte') ?? 1.75,
      compteUrssaf: f.elements.compteUrssaf.value,
      compteParCategorie: { ...R.compteParCategorie, Loyer: f.elements.compteLoyer.value },
      categories
    });
    notifier('Réglages enregistrés');
    return rendre();
  }
  fermer();
  notifier('Enregistré');
  rendre();
}

racine.GestionVue = { afficher, rendre };

})(window);
