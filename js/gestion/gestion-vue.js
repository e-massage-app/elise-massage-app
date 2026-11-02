// ===== GESTION : ECRAN (v1.1.2.2) =====
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

// « ▲ +460 € » en vert, « ▼ −200 € » en rouge, « stable » sous 1 €
function variation(n) {
  const v = C().arrondi(n);
  if (Math.abs(v) < 1) return '<span class="ge-variation">stable</span>';
  return `<span class="ge-variation ${v > 0 ? 'hausse' : 'baisse'}">${v > 0 ? '▲' : '▼'} ${euros(v, { signe: true })}</span>`;
}

function pourcent(n) {
  return `${String(n).replace('.', ',')} %`;
}

function ctx() {
  return C().contexte(DataManager.getAppData(), D().etat.gestion, D().reglages(), D().etat.ads, D().etat.adsJours, aujourdhui());
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
  const v = C().jePeuxMeVerser(c, m, aujourdhui());
  const enCours = m === moisCourant();

  const demarrage = (D().etat.gestion.soldes.length === 0 || R.matelas === null || R.besoinMensuel === null) ? carteDemarrage(R) : '';

  const tuileEncaisse = tuile('encaisse', `Ce que mes clientes m'ont payé en ${nomMois(m)}`, euros(p.encaisse),
    `${enCours ? 'depuis le 1er du mois' : 'tout le mois'}${p.encaisseCorrige !== null ? ' · corrigé à la main' : p.logiciel.carte ? ` · dont ${euros(p.logiciel.carte)} par carte` : ''}`);
  const tuileReste = tuile('frais', `Ce qu'il me reste en ${nomMois(m)} après les frais`, euros(p.reste),
    `${enCours ? 'mois en cours · ' : ''}${euros(p.frais)} de frais${p.adsInconnu ? ' · Google Ads en attente' : ''}`, p.reste < 0 ? 'negatif' : '');

  // Ma reserve : ce qui compte, c'est si le mois la fait monter ou descendre depuis la fin du mois
  // d'avant (Jordan, 2026-11-02). Ce qui est du en est deja retire ; le salaire, seulement « si je me verse ».
  const b = C().bilanReserve(c, m, aujourdhui());
  const precedent = nomMois(E().decalerMois(m, -1));
  let noteReserve;
  if (v.reserve === null) noteReserve = 'compte pro + caisse';
  else if (b.depart === null) {
    noteReserve = `point de départ : tes soldes recopiés${v.salaireApres > 0 ? `<br>${euros(-v.salaireApres)} si je me verse le salaire ${deMois(m)} → ${euros(v.reserveApres)}` : ''}`;
  } else {
    noteReserve = `${variation(v.reserve - b.depart)} depuis fin ${precedent} (${euros(b.depart)})`
      + (v.salaireApres > 0 ? `<br>si je me verse le salaire ${deMois(m)} : ${variation(v.reserveApres - b.depart)}` : '');
  }
  // A cote : ce que montre la banque, et ce qui est deja du dessus (aucun « frais fantome »)
  if (v.reserve !== null) {
    const part = cle => v.parts.find(pa => pa.compte === cle)?.montant;
    noteReserve += `<br>compte pro ${euros(part('pro'))} + caisse ${euros(part('caisse'))}${v.totalAPayer ? ` − ${euros(v.totalAPayer)} déjà dus` : ''}`;
  }
  if (v.reserveIncomplete && v.reserve !== null) noteReserve += ' · un solde manque';
  const tuileReserve = tuile('reserve', enCours ? 'Ma réserve aujourd\'hui' : `Ma réserve fin ${nomMois(m)}`, v.reserve === null ? 'À renseigner' : euros(v.reserve), noteReserve);

  const statuts = { ok: 'OK', tendu: 'Tendu', alerte: 'Alerte' };
  const jaugeBesoin = v.besoin
    ? `<span class="ge-jauge" role="img" aria-label="${euros(v.total)} sur ${euros(v.besoin)}"><span style="width:${Math.round(v.progression * 100)}%"></span></span>` : '';
  // Verse au-dela du chiffre : « d'avance » tant que le mois tourne, « de trop » une fois termine
  const depasse = enCours ? 'd\'avance' : 'de trop';
  const notesVerser = [
    v.statut ? `<strong>${statuts[v.statut]}</strong>` : '',
    !v.verse ? '' : !v.enTrop ? `dont ${euros(v.verse)} déjà versés`
      : v.total ? `${euros(v.verse)} déjà versés, ${euros(v.enTrop)} ${depasse}` : `${euros(v.verse)} déjà versés ${depasse}`,
    enCours && v.rapporte < 0 ? `encore ${euros(-v.rapporte)} de frais à couvrir` : !v.enTrop && v.limiteParMatelas ? 'limité par le matelas' : ''
  ].filter(Boolean).join(' · ');
  const valeurVerser = `${euros(v.total)}${v.besoin ? `<span class="ge-sur"> sur ${euros(v.besoin)}</span>` : ''}`;
  const tuileVerser = tuile('verser', `Je peux me verser pour ${nomMois(m)}`, valeurVerser, notesVerser, v.statut ? `statut-${v.statut}` : '', jaugeBesoin);

  // Connexion Google Ads perdue : les frais de pub manquent, « Je peux me verser » est trop haut
  const alerteAds = DataManager.getParametres().googleAdsConnected && D().etat.adsErreur ? `
    <div class="ge-carte ge-erreur" role="alert">
      <p><strong>Google Ads n'est plus connecté</strong> : tes frais de pub ne sont pas comptés, donc « Je peux me verser » est trop haut.</p>
      <div class="ge-actions"><button class="btn-primary" data-ge="reconnecter-ads">Me reconnecter</button></div>
    </div>` : '';

  return `
    ${demarrage}
    ${alerteAds}
    ${carteADeclarer(c, m)}
    <div class="ge-tuiles">${tuileEncaisse}${tuileReste}${tuileReserve}${tuileVerser}</div>
    <div class="ge-detail" id="ge-detail">${detailPro(c, p, res, v, jourRef)}</div>
    <section class="ge-carte ge-courbe-carte">
      <h3>Ce qu'il me reste en ${nomMois(m)}, jour par jour</h3>
      <div id="ge-courbe" class="ge-courbe"></div>
      <p class="ge-aide">Ce que mes clientes m'ont payé, moins les frais (les charges fixes dès le 1er, Google Ads au jour le jour, l'URSSAF avec chaque paiement)
        et moins ce que je me suis versé. En rouge sous zéro : les frais ne sont pas encore couverts, ou je me suis versé plus que le mois n'a rapporté.</p>
      <p class="ge-aide" id="ge-courbe-projection" hidden></p>
    </section>`;
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
    ? `<button class="ge-lien" data-ge="declarer" data-valeur="${m}">Saisir ce que j'ai déclaré</button>`
    : `Déclaré : <strong>${euros(a.declare)}</strong> <button class="ge-lien" data-ge="declarer" data-valeur="${m}">modifier</button>`;
  const message = a.resteNonDeclare > 0
    ? `<p class="ge-info">Il reste ${euros(a.resteNonDeclare)} encaissés en ${nomMois(m)} non déclarés (environ ${euros(a.cotisationsCorrespondantes)} de cotisations).</p>` : '';
  const limite = `déclaration avant le ${Number(a.dateLimite.slice(8))} ${nomMois(a.dateLimite.slice(0, 7))}`;
  return `
    <div class="ge-carte ge-declarer">
      <div><span class="ge-petit">À déclarer pour ${nomMois(m)}</span>
        <span class="ge-declarer-montant">${euros(a.montant)}</span>
        <span class="ge-petit">${m === moisCourant() ? 'mois en cours · ' : ''}${limite}</span></div>
      <div class="ge-declarer-saisie">${info}</div>
      ${message}
    </div>`;
}

function detailPro(c, p, res, v, jourRef) {
  switch (vue.detail) {
    case 'encaisse': return detailEncaisse(p);
    case 'frais': return detailFrais(p);
    case 'reserve': return detailReserve(c, res, jourRef, v);
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
  const etiquettes = { logiciel: 'logiciel', fixe: 'charge fixe', saisie: 'ajouté ici', anticipe: 'prévu · compté dès le 1er' };
  const lignes = regrouperLogiciel(p.postes).map(po => {
    let note = etiquettes[po.source] || 'calculé';
    if (po.abonnement && po.source === 'logiciel') note = 'abonnement · compté dès le 1er';
    if (po.nombre > 1) note = `${po.nombre} fois · ${note}`;
    if (po.source === 'saisie' && po.categorie && po.categorie !== po.libelle) note = `${esc(po.categorie)} · ${note}`;
    if (po.cle === 'urssaf') note = `${pourcent(D().reglages().tauxUrssaf)} ${p.declare !== null ? 'du montant déclaré' : 'de l\'encaissé'}`;
    if (po.cle === 'carte') note = `${pourcent(D().reglages().tauxCarte)} des paiements par carte`;
    if (po.cle === 'ads') note = po.inconnu ? (D().etat.adsErreur ? esc(D().etat.adsErreur) : 'en attente de Google') : `lu chez Google + ${pourcent(D().reglages().fraisGoogle)} de taxe`;
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
      <p class="ge-aide">L'URSSAF et Google Ads comptent dans le mois qu'ils concernent, même s'ils sont prélevés plus tard (l'URSSAF deux mois après).
        Les estimations de frais kilométriques du logiciel ne sont pas comptées.</p>
      <div class="ge-actions">
        <button class="btn-secondary" data-ge="ajouter" data-type="pro-sortie">+ Ajouter un frais</button>
        <button class="btn-secondary" data-ge="onglet" data-valeur="reglages">Charges fixes</button>
      </div>
    </div>`;
}

// Comment ma reserve a bouge ce mois-ci : seulement des chiffres du mois, en partant de la fin du mois d'avant
function bilanDuMois(c, v) {
  const b = C().bilanReserve(c, v.mois, aujourdhui());
  const quand = b.enCours ? 'aujourd\'hui' : `fin ${nomMois(v.mois)}`;
  if (b.arrivee === null) return '';
  if (b.depart === null) {
    return `${ligne(`<strong>Ma réserve ${quand}</strong>`, `<strong>${euros(b.arrivee)}</strong>`, { classe: 'ge-total' })}
      <p class="ge-aide">Point de départ : tes soldes recopiés. Le détail mois par mois commence le mois suivant.</p>`;
  }
  const precedent = E().decalerMois(v.mois, -1);
  const autresMois = b.verses.lignes.filter(l => l.moisConcerne && l.moisConcerne !== v.mois);
  return `
      ${ligne(`Ma réserve fin ${nomMois(precedent)}`, euros(b.depart))}
      ${ligne(`Ce ${C().queMois(v.mois)} m'a rapporté${b.enCours ? ' jusqu\'ici' : ''}`, euros(b.rapporte, { signe: true }), { note: 'ce que mes clientes m\'ont payé − tous les frais du mois (URSSAF et Google Ads compris)' })}
      ${b.verses.total ? ligne(`Ce que je me suis versé en ${nomMois(v.mois)}`, euros(-b.verses.total), { note: autresMois.length ? `dont ${euros(autresMois.reduce((s, l) => s + l.montant, 0))} pour ${[...new Set(autresMois.map(l => nomMois(l.moisConcerne)))].join(', ')}` : '' }) : ''}
      ${b.ecart && Math.abs(b.ecart) >= 1 ? ligne('Écart avec mes relevés', euros(b.ecart, { signe: true }), { note: 'un mouvement pas saisi, ou un relevé différent de l\'estimation' }) : ''}
      ${ligne(`<strong>Ma réserve ${quand}</strong>`, `<strong>${euros(b.arrivee)}</strong>`, { classe: 'ge-total' })}`;
}

function detailReserve(c, res, jourRef, v) {
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

  const quand = jourRef === aujourdhui() ? 'aujourd\'hui' : `au ${dateCourte(jourRef)}`;

  return `
    <div class="ge-carte">
      <h3>Ma réserve</h3>
      ${bilanDuMois(c, v)}
      ${v.salaireApres > 0 && v.reserve !== null ? ligne(`Si je me verse le salaire ${deMois(m)} (${euros(v.salaireApres)})`, euros(v.reserveApres)) : ''}
      <p class="ge-aide">Ce que je dois déjà (URSSAF, Google Ads…) est retiré tout de suite, même s'il est prélevé plus tard. Mon salaire, seulement quand je me le verse.</p>
      <h3 class="ge-h3-sous">Sur mes comptes ${quand}</h3>
      ${comptes}
      ${ligne('<strong>Total sur mes comptes</strong>', `<strong>${euros(res.montant)}</strong>`, { classe: 'ge-total' })}
      ${v.totalAPayer ? ligne('dont déjà dû, pas encore prélevé', euros(v.totalAPayer), { note: 'déjà retiré de ma réserve' }) : ''}
      ${v.aPayer.map(l => ligne(esc(l.libelle), euros(l.montant), { classe: 'ge-sous', note: `prélevé vers le ${dateCourte(l.date)}` })).join('')}
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
  const explications = {
    ok: `${nomMois(v.mois).replace(/^./, x => x.toUpperCase())} t'a permis de te verser ce dont tu as besoin (${euros(v.besoin)}).`,
    tendu: `C'est un peu juste : moins que ton besoin de ${euros(v.besoin)}, mais au moins ${R.seuilTendu} % de celui-ci.`,
    alerte: `Attention : moins de ${R.seuilTendu} % de ton besoin de ${euros(v.besoin)}.`
  };
  const versements = v.versements.map(l => ligne(esc(l.libelle || l.categorie || (l.sens === 'transfert' ? 'Virement vers le perso' : 'Pris pour moi')), euros(l.montant), {
    note: l.source === 'recurrent' ? 'tous les mois' : `${dateCourte(l.date)}${l.date.slice(0, 7) !== v.mois ? ` · pour ${nomMois(v.mois)}` : ''}`,
    action: l.source === 'saisie' && l.id ? boutonModifier(`data-ge="modifier-mouvement" data-valeur="${l.id}"`) : ''
  })).join('');
  const limite = v.limiteParMatelas ? `
      <p class="ge-info">Limité pour garder ton matelas de ${euros(v.matelas)} : ta réserve (${euros(v.reserve)}, déjà sans ce que tu dois)
        ne laisse que ${euros(Math.max(0, v.marge))} au-dessus du matelas.</p>` : '';
  return `
    <div class="ge-carte">
      <h3>Ce que je peux me verser pour ${nomMois(v.mois)}</h3>
      ${ligne(`Ce ${C().queMois(v.mois)} m'a rapporté${v.enCours ? ' jusqu\'ici' : ''}`, euros(v.rapporte), { note: 'ce que mes clientes m\'ont payé − tous les frais du mois' })}
      ${ligne('<strong>Je peux me verser</strong>', `<strong>${euros(v.total)}</strong>`, { classe: 'ge-total' })}
      ${limite}
      ${v.reserve === null ? '<p class="ge-aide">Renseigne tes soldes pour que je vérifie aussi ton matelas.</p>' : ''}
      <h3 class="ge-h3-sous">Déjà versé pour ${nomMois(v.mois)}</h3>
      ${versements || '<p class="ge-aide">Rien pour l\'instant.</p>'}
      ${v.verse ? ligne('<strong>Reste à me verser</strong>', `<strong>${euros(v.resteAVerser)}</strong>`, { classe: 'ge-total' }) : ''}
      ${v.enTrop ? `<p class="ge-info">${v.enCours
        ? `Tu t'es versé ${euros(v.enTrop)} de plus que ce que ${nomMois(v.mois)} a rapporté jusqu'ici : ils sont pris sur ta réserve en attendant la suite du mois.`
        : `Tu t'es versé ${euros(v.enTrop)} de plus que ce que ${nomMois(v.mois)} t'a permis : ils ont été pris sur ta réserve.`}</p>` : ''}
      ${v.statut ? `<p class="ge-statut statut-${v.statut}">${explications[v.statut]}</p>` : ''}
      <p class="ge-aide">${v.enCours ? 'Ce chiffre bouge tout le mois : il monte à chaque paiement de cliente, il baisse à chaque frais. À la fin du mois, c\'est ce que le mois t\'a vraiment permis de te verser.' : 'Le mois est terminé : c\'est ce qu\'il t\'a permis de te verser.'}
        Un virement fait début ${nomMois(E().decalerMois(v.mois, 1))} pour ${nomMois(v.mois)} se saisit ici, avec « pour le mois de ${nomMois(v.mois)} ».</p>
      <div class="ge-actions">
        <button class="btn-primary" data-ge="ajouter" data-type="verser">Me verser de l'argent</button>
      </div>
    </div>`;
}

// ----- Courbe -----

// Pas de graduation « rond » (50, 100, 250, 500…) pour environ 4 intervalles
function pasRond(ecart) {
  const brut = Math.max(ecart, 1) / 4;
  const puissance = Math.pow(10, Math.floor(Math.log10(brut)));
  return [1, 2, 2.5, 5, 10].map(x => x * puissance).find(x => x >= brut);
}

function dessinerCourbe() {
  const zone = document.getElementById('ge-courbe');
  if (!zone || typeof ApexCharts === 'undefined') return;
  const c = ctx();
  const cm = C().courbeDuMois(c, vue.mois, aujourdhui());
  // Pointilles : les rendez-vous deja au calendrier, s'ils ont tous lieu (mois en cours seulement)
  const pr = C().projectionDuMois(c, vue.mois, aujourdhui());
  if (vue.courbe) { try { vue.courbe.destroy(); } catch (e) { /* rien */ } vue.courbe = null; }

  const connues = cm.valeurs.filter(v => v !== null);
  const avecProjection = connues.concat(pr ? pr.valeurs.filter(v => v !== null) : []);
  const haut = Math.max(0, ...avecProjection);
  const bas = Math.min(0, ...avecProjection);
  const pas = pasRond(haut - bas);
  const yMax = Math.max(pas, Math.ceil(haut / pas) * pas);
  const yMin = Math.floor(bas / pas) * pas;
  // Dore au-dessus de zero, rouge en dessous : le degrade de l'aire (courbe reelle) change de couleur au zero
  const hautReel = Math.max(0, ...connues);
  const basReel = Math.min(0, ...connues);
  const zero = hautReel === basReel ? 100 : Math.round(hautReel / (hautReel - basReel) * 100);
  const dore = '#b07a4f';
  const rouge = '#c0504d';

  const note = document.getElementById('ge-courbe-projection');
  if (note) {
    note.hidden = !pr;
    if (pr) note.textContent = `Pointillés : projection si les ${pr.nombre} rendez-vous prévus ont lieu (${euros(pr.prevu)}, une prestation peut s'annuler), URSSAF et loyer de la cabine compris, sans Google Ads ni commission carte.`;
  }

  const series = [{ name: 'Ce qu\'il me reste', type: 'area', data: cm.valeurs }];
  if (pr) series.push({ name: 'Si tous les rendez-vous ont lieu', type: 'line', data: pr.valeurs });

  vue.courbe = new ApexCharts(zone, {
    chart: { type: 'line', height: 240, toolbar: { show: false }, zoom: { enabled: false }, animations: { enabled: false }, fontFamily: 'Inter, sans-serif' },
    series,
    plotOptions: { area: { fillTo: 'origin' } },
    xaxis: {
      categories: cm.jours.map(j => String(Number(j.slice(8, 10)))),
      tickAmount: 6,
      labels: { rotate: 0, hideOverlappingLabels: true },
      tooltip: { enabled: false }
    },
    yaxis: { min: yMin, max: yMax, tickAmount: Math.round((yMax - yMin) / pas), forceNiceScale: false, labels: { formatter: v => `${Math.round(v)} €` } },
    stroke: { width: [2.5, 2], curve: 'straight', dashArray: [0, 6], colors: ['#7a5236', dore] },
    fill: {
      type: ['gradient', 'solid'],
      gradient: {
        type: 'vertical',
        colorStops: [
          { offset: 0, color: dore, opacity: 0.55 },
          { offset: zero, color: dore, opacity: 0.12 },
          { offset: zero, color: rouge, opacity: 0.35 },
          { offset: 100, color: rouge, opacity: 0.6 }
        ]
      }
    },
    colors: [dore, dore],
    markers: { size: 0 },
    dataLabels: { enabled: false },
    legend: { show: false },
    tooltip: {
      x: { formatter: (v, o) => { const j = cm.jours[o.dataPointIndex]; return j ? `${Number(j.slice(8, 10))} ${nomMois(j.slice(0, 7))}` : ''; } },
      y: { formatter: v => v === null || v === undefined ? '' : euros(v) }
    },
    annotations: { yaxis: [{ y: 0, borderColor: '#8c7b70', strokeDashArray: 0 }] },
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
        ${champ('seuilTendu', '« Tendu » à partir de (% du besoin)', R.seuilTendu, 'En dessous : Alerte. Affiché une fois le mois terminé.', 'type="number" step="1" min="0" max="100" inputmode="numeric"')}
        ${champ('tauxUrssaf', 'Taux URSSAF (%)', R.tauxUrssaf)}
        ${champ('tauxCarte', 'Commission carte SumUp (%)', R.tauxCarte, 'À changer si la formule ou le prestataire change.')}
        ${champ('fraisGoogle', 'Taxe Google Ads en plus (%)', R.fraisGoogle, 'Google l\'ajoute à la facture : environ 2 % en France.')}
        ${champ('jourUrssaf', 'L\'URSSAF part vers le … du mois M+2', R.jourUrssaf, 'Entre le 2 et le 4 : le 4 par prudence.', 'type="number" step="1" min="1" max="28" inputmode="numeric"')}
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
  fermerChoix();
  showModal(id, html);
}

function fermer() {
  fermerChoix();
  if (typeof closeModalCompletely === 'function') closeModalCompletely(); else closeModal();
}

// v1.1.2.0 : vraie liste de categories. L'ancien <datalist> ne s'ouvrait pas au toucher (ni au
// clic sur ordinateur) et ne proposait rien sur telephone. Ici : la liste s'ouvre des qu'on touche
// le champ, se filtre en tapant, et « + Ajouter … » garde une categorie nouvelle dans les reglages.
// v1.1.2.2 : la liste flotte au-dessus de la page (rattachee a <body>). Posee dans la fenetre, elle
// en depassait le bas : ascenseur force et liste coupee. Elle s'ouvre vers le haut si la place manque.
function optionsCategories(cle, valeur) {
  return `<div class="ge-choix" data-ge-choix="${cle}">
      <input name="categorie" value="${esc(valeur || '')}" placeholder="Choisir ou écrire" autocomplete="off"
        role="combobox" aria-label="Catégorie" aria-expanded="false" aria-autocomplete="list" aria-controls="ge-choix-liste">
      <button type="button" class="ge-choix-fleche" data-ge-choix-ouvrir tabindex="-1" aria-label="Voir les catégories">▾</button>
    </div>`;
}

function sansAccents(t) {
  return String(t || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

/** La categorie telle qu'elle est deja ecrite dans la liste (« loyer cabine » -> « Loyer cabine »). */
function categorieConnue(cle, saisie) {
  const texte = String(saisie || '').trim();
  if (!texte) return null;
  return (D().reglages().categories[cle] || []).find(c => sansAccents(c) === sansAccents(texte)) || texte;
}

/** Une categorie nouvelle rejoint la liste de son type, pour la retrouver la prochaine fois. */
async function retenirCategorie(cle, categorie) {
  if (!cle || !categorie) return;
  const R = D().reglages();
  const liste = R.categories[cle] || [];
  if (liste.some(c => sansAccents(c) === sansAccents(categorie))) return;
  await D().enregistrerReglages({ categories: { ...R.categories, [cle]: [...liste, categorie] } });
}

// Une seule liste pour tout l'ecran, et le champ qu'elle sert en ce moment
const choix = { boite: null, ul: null };

function listeChoix() {
  if (!choix.ul) {
    choix.ul = document.createElement('ul');
    choix.ul.id = 'ge-choix-liste';
    choix.ul.className = 'ge-choix-liste';
    choix.ul.setAttribute('role', 'listbox');
    choix.ul.hidden = true;
    document.body.appendChild(choix.ul);
  }
  return choix.ul;
}

/** Sous le champ s'il y a la place, sinon au-dessus ; jamais plus haute que l'espace libre. */
function placerChoix() {
  const ul = choix.ul;
  const champ = choix.boite?.querySelector('input');
  if (!ul || ul.hidden || !champ) return;
  if (!champ.isConnected) { fermerChoix(); return; }
  const r = champ.getBoundingClientRect();
  const marge = 8;
  const ecart = 4;
  const dessous = window.innerHeight - r.bottom - ecart - marge;
  const dessus = r.top - ecart - marge;
  const voulue = Math.min(ul.scrollHeight, 320);
  const versLeHaut = dessous < voulue && dessus > dessous;
  ul.style.left = `${Math.max(marge, r.left)}px`;
  ul.style.width = `${r.width}px`;
  ul.style.maxHeight = `${Math.max(96, Math.min(320, versLeHaut ? dessus : dessous))}px`;
  ul.style.top = versLeHaut ? 'auto' : `${r.bottom + ecart}px`;
  ul.style.bottom = versLeHaut ? `${window.innerHeight - r.top + ecart}px` : 'auto';
}

function remplirChoix(boite, filtre) {
  const liste = D().reglages().categories[boite.dataset.geChoix] || [];
  const champ = boite.querySelector('input');
  const saisie = champ.value.trim();
  const cherche = sansAccents(filtre);
  const trouvees = liste.filter(c => !cherche || sansAccents(c).includes(cherche));
  const existe = liste.some(c => sansAccents(c) === sansAccents(saisie));
  const items = trouvees.map(c => `<li role="option" data-valeur="${esc(c)}" class="${sansAccents(c) === sansAccents(saisie) ? 'is-choisi' : ''}">${esc(c)}</li>`);
  if (saisie && !existe) items.push(`<li role="option" class="ge-choix-ajout" data-valeur="${esc(saisie)}">+ Ajouter « ${esc(saisie)} »</li>`);
  const ul = listeChoix();
  if (choix.boite && choix.boite !== boite) choix.boite.querySelector('input')?.setAttribute('aria-expanded', 'false');
  choix.boite = boite;
  ul.innerHTML = items.join('');
  ul.hidden = !items.length;
  champ.setAttribute('aria-expanded', String(!ul.hidden));
  placerChoix();
}

function fermerChoix() {
  if (choix.ul) choix.ul.hidden = true;
  choix.boite?.querySelector('input')?.setAttribute('aria-expanded', 'false');
  choix.boite = null;
}

function choisirCategorie(li) {
  const champ = choix.boite?.querySelector('input');
  if (champ) champ.value = li.dataset.valeur;
  fermerChoix();
}

function lierChoixCategories() {
  // Ouvrir au toucher : toute la liste, pas seulement ce qui ressemble a la valeur deja la
  document.addEventListener('focusin', e => {
    const boite = e.target.closest('.ge-choix');
    if (boite && e.target.matches('input')) remplirChoix(boite, '');
  });
  document.addEventListener('input', e => {
    const boite = e.target.closest('.ge-choix');
    if (boite) remplirChoix(boite, e.target.value);
  });
  // mousedown + preventDefault : le champ garde le focus, la liste ne se ferme pas avant le choix
  document.addEventListener('mousedown', e => {
    const li = e.target.closest('.ge-choix-liste li');
    if (li) { e.preventDefault(); choisirCategorie(li); return; }
    if (e.target.closest('.ge-choix-liste')) { e.preventDefault(); return; } // barre de defilement
    const fleche = e.target.closest('[data-ge-choix-ouvrir]');
    if (!fleche) return;
    e.preventDefault();
    const boite = fleche.closest('.ge-choix');
    if (choix.boite === boite && !listeChoix().hidden) {
      fermerChoix();
    } else {
      boite.querySelector('input').focus();
      remplirChoix(boite, '');
    }
  });
  // Sur telephone, le toucher d'une ligne peut faire perdre le focus avant le choix : on attend
  // un instant avant de fermer, et le « click » ci-dessous rattrape le choix
  document.addEventListener('click', e => {
    const li = e.target.closest('.ge-choix-liste li');
    if (li) choisirCategorie(li);
  });
  document.addEventListener('focusout', e => {
    const boite = e.target.closest('.ge-choix');
    if (!boite) return;
    setTimeout(() => {
      if (choix.boite === boite && !boite.contains(document.activeElement)) fermerChoix();
    }, 150);
  });
  // La fenetre defile (telephone) ou change de taille (clavier) : la liste suit le champ
  window.addEventListener('resize', placerChoix);
  document.addEventListener('scroll', e => { if (e.target !== choix.ul) placerChoix(); }, true);
  document.addEventListener('keydown', e => {
    const boite = e.target.closest('.ge-choix');
    if (!boite || !e.target.matches('input')) return;
    const ul = listeChoix();
    const ouverte = choix.boite === boite && !ul.hidden;
    const items = [...ul.querySelectorAll('li')];
    const actif = ul.querySelector('li.is-actif');
    if (e.key === 'Escape' && ouverte) { e.preventDefault(); fermerChoix(); return; }
    if (e.key === 'Enter' && ouverte && actif) { e.preventDefault(); choisirCategorie(actif); return; }
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    e.preventDefault();
    if (!ouverte) { remplirChoix(boite, ''); return; }
    const i = items.indexOf(actif);
    const pas = e.key === 'ArrowDown' ? 1 : -1;
    const suivant = items[i < 0 ? (pas > 0 ? 0 : items.length - 1) : (i + pas + items.length) % items.length];
    if (actif) actif.classList.remove('is-actif');
    if (suivant) { suivant.classList.add('is-actif'); suivant.scrollIntoView({ block: 'nearest' }); }
  });
}

function formulaireMouvement(type, mv = null, compteForce = null) {
  const t = TYPES[type];
  const comptes = t.comptes.map(k => `<option value="${k}" ${(mv?.compte || compteForce || t.comptes[0]) === k ? 'selected' : ''}>${C().COMPTES[k]}</option>`).join('');
  const choixType = Object.entries(TYPES).filter(([, x]) => x.espace === t.espace)
    .map(([k, x]) => `<option value="${k}" ${k === type ? 'selected' : ''}>${x.titre}</option>`).join('');
  const montant = mv && mv.montant !== '' && mv.montant !== null && mv.montant !== undefined ? Math.abs(Number(mv.montant)) : '';
  // Un versement compte pour le mois choisi (le salaire d'octobre vire debut novembre), par defaut le mois affiche
  const moisVerse = mv?.moisConcerne || (mv?.id ? C().moisDuMouvement(mv) : vue.mois);
  const choixMois = [...new Set([moisVerse, ...[-2, -1, 0].map(n => E().decalerMois(moisCourant(), n))])].sort().reverse()
    .map(mo => `<option value="${mo}" ${mo === moisVerse ? 'selected' : ''}>${nomMois(mo, true)}</option>`).join('');
  return `
    <h3>${mv?.id ? 'Modifier' : 'Ajouter'}</h3>
    <form class="ge-formulaire" data-ge-form="mouvement" data-id="${mv?.id || ''}">
      <label class="ge-champ"><span>Quoi ?</span><select name="type" data-ge-change="type-mouvement">${choixType}</select></label>
      <div class="ge-grille-champs">
        <label class="ge-champ"><span>Montant (€)</span><input name="montant" type="number" step="0.01" min="0" inputmode="decimal" required value="${montant}"></label>
        <label class="ge-champ"><span>Date</span><input name="date" type="date" required value="${mv?.date || (vue.mois === moisCourant() ? aujourdhui() : E().dernierJourDuMois(vue.mois))}"></label>
        <label class="ge-champ"><span>${t.sens === 'entree' ? 'Arrivé sur' : t.sens === 'transfert' ? 'Depuis' : 'Payé avec'}</span><select name="compte">${comptes}</select></label>
        ${t.vers ? `<label class="ge-champ"><span>Vers</span><input value="${C().COMPTES[t.vers]}" disabled></label>` : ''}
        ${type === 'verser' ? `<label class="ge-champ"><span>Pour le mois de</span><select name="moisConcerne">${choixMois}</select></label>` : ''}
        ${t.categories ? `<div class="ge-champ ge-champ-large"><span>Catégorie</span>${optionsCategories(t.categories, mv?.categorie)}</div>` : ''}
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
        ${t.categories ? `<div class="ge-champ ge-champ-large"><span>Catégorie</span>${optionsCategories(t.categories, r?.categorie)}</div>` : ''}
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
        <label class="ge-champ"><span>Compte</span><select name="compte" data-ge-change="question-urssaf">${options}</select></label>
        <label class="ge-champ"><span>Solde (€)</span><input name="montant" type="number" step="0.01" inputmode="decimal" required value="${s ? s.montant : ''}"></label>
        <label class="ge-champ"><span>Date</span><input name="date" type="date" required value="${s?.date || aujourdhui()}" data-ge-change="question-urssaf"></label>
      </div>
      <div class="ge-question-urssaf">${questionsPrelevements(s?.compte || compte, s?.date || aujourdhui())}</div>
      <div class="modal-actions ge-actions">
        ${s ? `<button type="button" class="btn-secondary ge-danger" data-ge="supprimer-solde" data-valeur="${s.id}">Supprimer</button>` : ''}
        <button type="submit" class="btn-primary">Enregistrer</button>
      </div>
    </form>`;
}

// En debut de mois, on ne sait pas si l'URSSAF d'il y a deux mois et Google Ads du mois dernier sont passes
function questionsPrelevements(compte, date) {
  const c = ctx();
  const questions = [
    ['urssaf', C().urssafAConfirmer(c, compte, date), q => `L'URSSAF ${deMois(q.mois)} (${euros(q.montant)}) est-elle déjà passée sur ce solde ?`],
    ['ads', C().adsAConfirmer(c, compte, date), q => `Google Ads ${deMois(q.mois)} (${euros(q.montant)}) est-il déjà passé sur ce solde ? S'il est encore dans les « à venir » de ta banque : pas encore.`]
  ];
  return questions.filter(([, q]) => q).map(([cle, q, texte]) => `
    <fieldset class="ge-question">
      <legend>${texte(q)}</legend>
      <label><input type="radio" name="${cle}Passe" value="oui" required> Oui, c'est passé</label>
      <label><input type="radio" name="${cle}Passe" value="non" required> Pas encore</label>
      <input type="hidden" name="${cle}Mois" value="${q.mois}">
      <input type="hidden" name="${cle}Supposee" value="${q.dateSupposee}">
    </fieldset>`).join('');
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
  lierChoixCategories();
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
        moisConcerne: f.elements.moisConcerne?.value || null,
        categorie: null,
        compte: null
      }));
    } else if (el.dataset.geChange === 'question-urssaf') {
      const f = el.closest('form');
      f.querySelector('.ge-question-urssaf').innerHTML = questionsPrelevements(f.elements.compte.value, f.elements.date.value);
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
    case 'reconnecter-ads': {
      if (typeof racine.connectToGoogleAds === 'function') await racine.connectToGoogleAds();
      const m = moisCourant();
      await D().chargerCoutsAds(E().decalerMois(m, -13), m, { forcer: true });
      return rendre();
    }
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
    // Rattache au mois choisi seulement s'il differe de celui de la date
    const moisChoisi = f.elements.moisConcerne?.value || null;
    const moisConcerne = moisChoisi && moisChoisi !== f.elements.date.value.slice(0, 7) ? moisChoisi : null;
    const categorie = categorieConnue(t.categories, f.elements.categorie?.value);
    await D().enregistrerMouvement({
      id: f.dataset.id || undefined,
      date: f.elements.date.value,
      espace: t.espace,
      sens: t.sens,
      compte: f.elements.compte.value,
      compteVers: t.vers || null,
      categorie,
      libelle: f.elements.libelle.value.trim() || null,
      moisConcerne,
      montant
    });
    await retenirCategorie(t.categories, categorie);
    const moisAffiche = moisConcerne || f.elements.date.value.slice(0, 7);
    vue.mois = moisAffiche <= moisCourant() ? moisAffiche : vue.mois;
  } else if (quoi === 'recurrent') {
    const t = TYPES_RECURRENTS[f.dataset.type];
    const frequence = f.elements.frequence.value;
    const categorie = categorieConnue(t.categories, f.elements.categorie?.value);
    await D().enregistrerRecurrent({
      id: f.dataset.id || undefined,
      espace: t.espace,
      sens: t.sens,
      compte: f.elements.compte.value,
      compteVers: t.vers || null,
      categorie,
      nom: f.elements.nom.value.trim(),
      montant: lireNombre(f, 'montant') || 0,
      frequence,
      moisAnnuel: frequence === 'annuelle' ? Number(f.elements.moisAnnuel.value) : null,
      debut: f.elements.debut.value,
      fin: f.elements.fin.value || null
    });
    await retenirCategorie(t.categories, categorie);
  } else if (quoi === 'solde') {
    const date = f.elements.date.value;
    await D().enregistrerSolde({
      id: f.dataset.id || undefined,
      compte: f.elements.compte.value,
      date,
      montant: lireNombre(f, 'montant') ?? 0
    });
    // Reponses aux questions : la date ou chaque prelevement part, pour ne jamais le compter deux fois
    const lendemain = `${date.slice(0, 8)}${String(Number(date.slice(8, 10)) + 1).padStart(2, '0')}`;
    for (const cle of ['urssaf', 'ads']) {
      const mois = f.elements[`${cle}Mois`]?.value;
      const reponse = f.elements[`${cle}Passe`]?.value;
      if (!mois || !reponse) continue;
      const supposee = f.elements[`${cle}Supposee`].value;
      const le = reponse === 'oui' ? date : (supposee > date ? supposee : lendemain);
      const corrections = { ...(D().etat.gestion.mois[mois]?.corrections || {}), [`${cle}Le`]: le };
      await D().enregistrerMois(mois, { corrections });
    }
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
      tauxUrssaf: lireNombre(f, 'tauxUrssaf') ?? 21.4,
      tauxCarte: lireNombre(f, 'tauxCarte') ?? 1.75,
      compteUrssaf: f.elements.compteUrssaf.value,
      jourUrssaf: lireNombre(f, 'jourUrssaf') ?? 4,
      fraisGoogle: lireNombre(f, 'fraisGoogle') ?? 2,
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
