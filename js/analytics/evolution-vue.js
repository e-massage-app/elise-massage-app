// ===== ANALYTICS : EVOLUTION, ECRAN (v1.1.2.0) =====
// Carte « Évolution » de la vue d'ensemble Analytics : colonnes empilees par
// activite, ligne « Il me reste », annee d'avant en pointilles, legende qui
// masque une activite, detail d'un mois (ou d'un jour) au toucher.
// La periode vient des filtres du haut (Année / Mois). Calculs : EvolutionCalculs.

(function (racine) {

const V = () => racine.EvolutionCalculs;

// Tons du logiciel : dore d'Elise en tete, puis des pastels qui restent lisibles sur blanc
const COULEURS = ['#d4a574', '#a993c9', '#e8a3a3', '#e9c46a', '#82a9cf', '#c9a27e'];
const COULEUR_CARTES = '#93c2a9';
const COULEUR_RESTE = '#7a5236';
const COULEUR_AVANT = '#bcae9f';

const etat = { masquees: new Set(), choix: null, clePeriode: null, donnees: null, graphique: null, survol: null, lie: false };

// ----- Outils -----

function aujourdhui() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function euros(n) {
  const v = Number(n) || 0;
  const decimales = Math.abs(v - Math.round(v)) < 0.005 ? 0 : 2;
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', minimumFractionDigits: decimales, maximumFractionDigits: decimales }).format(v);
}

function eurosAxe(v) {
  if (Math.abs(v) >= 1000) return `${(v / 1000).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} k€`;
  return `${Math.round(v)} €`;
}

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function majuscule(t) {
  return t.charAt(0).toUpperCase() + t.slice(1);
}

function groupeDe(p) {
  return racine.Calculations.getGroupeNameForPrestation(p);
}

/** Activites dans l'ordre des pastilles d'avant : Massages, HeadSpa, puis les autres groupes. */
function activitesConnues() {
  const groupes = (racine.DataManager.getGroupesCategories ? racine.DataManager.getGroupesCategories() : []).map(g => g.nom);
  const autres = groupes.filter(n => n !== 'Massages' && n !== 'HeadSpa').sort((a, b) => a.localeCompare(b));
  return ['Massages', 'HeadSpa', ...autres];
}

/** Une activite garde sa couleur quelle que soit la periode. */
function couleur(nom) {
  if (nom === V().CARTES) return COULEUR_CARTES;
  const ordre = activitesConnues();
  const i = ordre.indexOf(nom);
  return COULEURS[(i < 0 ? ordre.length : i) % COULEURS.length];
}

function periodeChoisie() {
  return V().periodeDe(
    document.getElementById('global-year-selector')?.value || 'current',
    document.getElementById('global-month-selector')?.value || '',
    aujourdhui()
  );
}

/** Nom d'une colonne : « juillet 2026 » ou « 12 novembre ». */
function nomColonne(d, i) {
  const c = d.colonnes[i];
  if (d.mode === 'mois') return `${Number(c.cle.slice(8, 10))} ${V().MOIS_LONGS[d.periode.mois - 1]}`;
  return `${V().MOIS_LONGS[i]} ${d.periode.annee}`;
}

function enCours(c) {
  const jour = aujourdhui();
  return c.debut <= jour && c.fin > jour;
}

// ----- Rendu -----

function afficher() {
  const hote = document.getElementById('evo');
  if (!hote || !racine.DataManager || !V()) return;
  lier(hote);
  const periode = periodeChoisie();
  const cle = `${periode.annee}-${periode.mois || ''}`;
  if (cle !== etat.clePeriode) { etat.choix = null; etat.clePeriode = cle; }

  const d = V().evolution(racine.DataManager.getAppData(), periode, { groupeDe, activites: activitesConnues(), aujourdhui: aujourdhui() });
  etat.donnees = d;

  document.getElementById('evo-titre').textContent = d.mode === 'mois'
    ? majuscule(V().nomPeriode(periode))
    : `Mon année ${periode.annee}`;
  document.getElementById('evo-sous-titre').textContent = d.mode === 'mois'
    ? 'Ce que mes clientes m\'ont payé, jour par jour'
    : 'Ce que mes clientes m\'ont payé, mois par mois';

  rendreChiffres(d);
  rendreLegende(d);
  dessiner(d);
  rendreDetail(d);
}

function texteComparaison(comparaison, finPeriode) {
  if (!comparaison || comparaison.ecart === null) return '';
  const meme = finPeriode > aujourdhui() ? ' à la même date' : '';
  const sens = comparaison.ecart > 0 ? 'hausse' : comparaison.ecart < 0 ? 'baisse' : 'egal';
  const fleche = sens === 'hausse' ? '▲' : sens === 'baisse' ? '▼' : '=';
  return `<span class="evo-compare is-${sens}" title="${esc(euros(comparaison.encaisse))} encaissés en ${comparaison.annee}">${fleche} ${Math.abs(comparaison.ecart)} %<small>vs ${comparaison.annee}${meme}</small></span>`;
}

function rendreChiffres(d) {
  const hote = document.getElementById('evo-chiffres');
  if (!d.total) {
    hote.innerHTML = '<p class="evo-attente">Cette période n\'a pas encore commencé.</p>';
    return;
  }
  const t = d.total;
  const fin = d.colonnes[d.colonnes.length - 1].fin;
  hote.innerHTML = `
    <div class="evo-chiffre"><span class="evo-k">Encaissé</span><span class="evo-v">${euros(t.encaisse)}</span></div>
    <span class="evo-op" aria-hidden="true">−</span>
    <div class="evo-chiffre"><span class="evo-k">Frais</span><span class="evo-v">${euros(t.frais)}</span></div>
    <span class="evo-op" aria-hidden="true">=</span>
    <div class="evo-chiffre is-reste"><span class="evo-k">Il me reste</span><span class="evo-v">${euros(t.reste)}</span></div>
    ${texteComparaison(d.comparaison, fin)}`;
}

function totalAvantVisible(parActivite) {
  return Object.entries(parActivite || {}).reduce((t, [nom, v]) => t + (etat.masquees.has(nom) ? 0 : v), 0);
}

function avecAnneeAvant(d) {
  return d.mode === 'annee' && d.avant.some(a => a && Object.values(a).some(v => v !== 0));
}

function rendreLegende(d) {
  const hote = document.getElementById('evo-legende');
  const totaux = d.total ? d.total.parActivite : {};
  const puces = d.activites.map(nom => {
    const off = etat.masquees.has(nom);
    return `<button type="button" class="evo-puce${off ? ' is-off' : ''}" data-evo="activite" data-nom="${esc(nom)}" aria-pressed="${!off}" style="--c:${couleur(nom)}">
      <i></i>${esc(nom)}<b>${euros(totaux[nom] || 0)}</b></button>`;
  }).join('');
  const traits = d.mode === 'annee' && d.activites.length ? `
    <span class="evo-trait"><i class="is-reste"></i>Il me reste</span>
    ${avecAnneeAvant(d) ? `<span class="evo-trait"><i class="is-avant"></i>${d.periode.annee - 1}</span>` : ''}` : '';
  hote.innerHTML = puces + traits;
}

function bulle(d, i) {
  const b = d.bilans[i];
  if (!b) return '';
  const c = d.colonnes[i];
  const lignes = d.activites.filter(n => !etat.masquees.has(n) && (b.parActivite[n] || 0) !== 0)
    .map(n => `<div class="evo-bulle-ligne"><i style="background:${couleur(n)}"></i>${esc(n)}<b>${euros(b.parActivite[n])}</b></div>`).join('');
  const avant = d.mode === 'annee' && avecAnneeAvant(d) && d.avant[i]
    ? `<div class="evo-bulle-ligne is-avant">${V().MOIS_LONGS[i]} ${d.periode.annee - 1}<b>${euros(totalAvantVisible(d.avant[i]))}</b></div>` : '';
  return `<div class="evo-bulle">
    <div class="evo-bulle-titre">${esc(majuscule(nomColonne(d, i)))}${enCours(c) ? '<span>en cours</span>' : ''}</div>
    ${lignes || '<div class="evo-bulle-ligne is-vide">Rien d\'encaissé</div>'}
    <div class="evo-bulle-sep"></div>
    <div class="evo-bulle-ligne">Encaissé<b>${euros(b.encaisse)}</b></div>
    <div class="evo-bulle-ligne">Frais<b>${b.frais ? '− ' + euros(b.frais) : euros(0)}</b></div>
    <div class="evo-bulle-ligne is-reste">Il me reste<b>${euros(b.reste)}</b></div>
    ${avant}
    <div class="evo-bulle-astuce">Touche la colonne pour le détail</div>
  </div>`;
}

/** Le mois (ou le jour) choisi ressort sous l'axe ; les colonnes a venir s'effacent. */
function couleursEtiquettes(d) {
  return d.colonnes.map((c, i) => (i === etat.choix ? COULEUR_RESTE : c.avenir ? '#cfc4b8' : '#9c9187'));
}

function dessiner(d) {
  const zone = document.getElementById('revenue-chart');
  if (etat.graphique) { try { etat.graphique.destroy(); } catch (e) { /* deja detruit */ } etat.graphique = null; }
  zone.innerHTML = '';
  if (!d.activites.length) {
    zone.innerHTML = `<div class="evo-vide">${d.total ? 'Rien d\'encaissé sur cette période pour l\'instant.' : 'Rien à afficher pour l\'instant.'}</div>`;
    return;
  }
  if (typeof ApexCharts === 'undefined') return;
  zone.setAttribute('role', 'img');
  zone.setAttribute('aria-label', `Encaissements ${d.mode === 'mois' ? 'jour par jour' : 'mois par mois'}, par activité : ${d.activites.join(', ')}`);

  const visibles = d.series.filter(s => !etat.masquees.has(s.nom));
  const series = visibles.map(s => ({ name: s.nom, type: 'bar', data: s.valeurs }));
  const couleurs = visibles.map(s => couleur(s.nom));
  const traits = [];
  if (d.mode === 'annee') {
    // Le mois en cours n'a que quelques jours : sa colonne pousse, mais la ligne s'arrete au
    // dernier mois complet (sinon elle plonge chaque debut de mois). Son chiffre est dans la bulle.
    series.push({ name: 'Il me reste', type: 'line', data: d.reste.map((v, i) => (enCours(d.colonnes[i]) ? null : v)) });
    couleurs.push(COULEUR_RESTE);
    traits.push({ largeur: 2.5, pointilles: 0, point: 4 });
    if (avecAnneeAvant(d)) {
      series.push({ name: String(d.periode.annee - 1), type: 'line', data: d.avant.map(a => (a ? totalAvantVisible(a) : null)) });
      couleurs.push(COULEUR_AVANT);
      traits.push({ largeur: 2, pointilles: 5, point: 0 });
    }
  }
  const barres = visibles.map(() => ({ largeur: 1.5, pointilles: 0, point: 0 }));
  const tous = barres.concat(traits);
  const etroit = window.innerWidth < 560;
  etat.survol = null;

  etat.graphique = new ApexCharts(zone, {
    chart: {
      type: 'bar',
      stacked: true,
      stackOnlyBar: true,
      height: etroit ? 260 : 300,
      fontFamily: 'Inter, sans-serif',
      toolbar: { show: false },
      zoom: { enabled: false },
      animations: { enabled: true, speed: 450, animateGradually: { enabled: false }, dynamicAnimation: { enabled: false } },
      events: {
        // Un toucher n'importe ou dans la colonne : la bulle affichee donne la colonne visee
        click: (e, ctx, config) => choisir(config.dataPointIndex >= 0 ? config.dataPointIndex : etat.survol)
      }
    },
    series,
    colors: couleurs,
    plotOptions: {
      bar: {
        columnWidth: d.mode === 'mois' ? '82%' : '58%',
        borderRadius: d.mode === 'mois' ? 3 : 6,
        borderRadiusApplication: 'end',
        borderRadiusWhenStacked: 'last'
      }
    },
    fill: { opacity: 1 },
    stroke: {
      width: tous.map(t => t.largeur),
      dashArray: tous.map(t => t.pointilles),
      colors: barres.map(() => '#ffffff').concat(traits.length ? couleurs.slice(barres.length) : []),
      curve: 'straight'
    },
    markers: { size: tous.map(t => t.point), strokeColors: '#ffffff', strokeWidth: 2, hover: { sizeOffset: 2 } },
    dataLabels: { enabled: false },
    legend: { show: false },
    // Pas d'assombrissement au survol : ApexCharts 4+ ignore « value » et noircit la colonne ;
    // le fond creme (crosshairs) et la bulle suffisent
    states: { hover: { filter: { type: 'none' } }, active: { filter: { type: 'none' } } },
    xaxis: {
      categories: d.colonnes.map(c => c.libelle),
      tickAmount: d.mode === 'mois' ? (etroit ? 6 : 10) : undefined,
      labels: {
        rotate: 0,
        hideOverlappingLabels: true,
        // Telephone : l'initiale du mois (J F M...), le nom complet est dans la bulle
        formatter: v => (etroit && d.mode === 'annee' && typeof v === 'string' ? v.charAt(0).toUpperCase() : v),
        style: { fontSize: '11px', colors: couleursEtiquettes(d) }
      },
      axisBorder: { color: '#ece1d5' },
      axisTicks: { show: false },
      crosshairs: { fill: { type: 'solid', color: '#f6eee5' } },
      tooltip: { enabled: false }
    },
    yaxis: { forceNiceScale: true, labels: { formatter: eurosAxe, style: { fontSize: '11px', colors: '#9c9187' } } },
    grid: { borderColor: '#f1e8de', strokeDashArray: 4, padding: { left: 8, right: 8 } },
    tooltip: { shared: true, intersect: false, custom: ({ dataPointIndex }) => { etat.survol = dataPointIndex; return bulle(d, dataPointIndex); } }
  });
  etat.graphique.render().then(() => { if (etat.choix !== null) majEtiquettes(d); });
}

function ligneDetail(libelle, valeur, pastille) {
  return `<li>${pastille ? `<i style="background:${pastille}"></i>` : ''}<span>${esc(libelle)}</span><b>${euros(valeur)}</b></li>`;
}

function rendreDetail(d) {
  const hote = document.getElementById('evo-detail');
  const i = etat.choix;
  const b = i === null ? d.total : d.bilans[i];
  if (!b) { hote.innerHTML = ''; hote.hidden = true; return; }
  hote.hidden = false;
  const appData = racine.DataManager.getAppData();
  const comparaison = i === null ? d.comparaison : V().comparer(appData, b.debut, b.fin, groupeDe, b.encaisse);
  const finColonne = i === null ? d.colonnes[d.colonnes.length - 1].fin : d.colonnes[i].fin;
  const nom = i === null ? V().nomPeriode(d.periode) : (d.mode === 'mois' ? `du ${nomColonne(d, i)}` : nomColonne(d, i));
  const titre = i === null || d.mode === 'annee' ? `Le détail de ${nom}` : `Le détail ${nom}`;

  const encaisse = d.activites.filter(n => (b.parActivite[n] || 0) !== 0)
    .map(n => ligneDetail(n, b.parActivite[n], couleur(n))).join('');
  const frais = Object.entries(b.parCategorie).sort((x, y) => y[1] - x[1])
    .map(([cat, v]) => ligneDetail(cat, v)).join('');
  const meme = finColonne > aujourdhui() ? ' à la même date' : '';
  const avant = comparaison && comparaison.encaisse > 0
    ? `<span class="evo-avant">En ${comparaison.annee}${meme} : ${euros(comparaison.encaisse)} encaissés${comparaison.ecart !== null ? ` · ${comparaison.ecart > 0 ? '▲' : comparaison.ecart < 0 ? '▼' : '='} ${Math.abs(comparaison.ecart)} %` : ''}</span>`
    : '';

  hote.innerHTML = `
    <div class="evo-detail-tete">
      <h4>${esc(titre)}</h4>
      ${i !== null ? `<button type="button" class="evo-lien" data-evo="tout">← ${d.mode === 'mois' ? 'Tout le mois' : 'Toute l\'année'}</button>` : ''}
    </div>
    <div class="evo-detail-grille">
      <div class="evo-bloc">
        <div class="evo-bloc-titre">Encaissé<b>${euros(b.encaisse)}</b></div>
        ${encaisse ? `<ul>${encaisse}</ul>` : '<p class="evo-rien">Aucun encaissement.</p>'}
        ${b.pourboires > 0 ? `<p class="evo-note">dont ${euros(b.pourboires)} de pourboires</p>` : ''}
      </div>
      <div class="evo-bloc">
        <div class="evo-bloc-titre">Frais<b>${euros(b.frais)}</b></div>
        ${frais ? `<ul>${frais}</ul>` : '<p class="evo-rien">Aucun frais saisi.</p>'}
      </div>
    </div>
    <div class="evo-detail-pied">
      <span class="evo-reste">Il me reste <b>${euros(b.reste)}</b></span>
      ${avant}
    </div>
    <p class="evo-mention">Frais = l'onglet Dépenses. Google Ads et l'URSSAF ne sont pas comptés ici : ils sont dans l'onglet Gestion.</p>`;
}

// ----- Evenements -----

/** Colonne choisie : son nom ressort sous l'axe et un voile dore la couvre (ApexCharts dessine
 *  ce voile par-dessus les barres, d'ou la transparence). */
function majEtiquettes(d) {
  if (!etat.graphique) return;
  const largeur = (etat.graphique.w?.globals?.gridWidth || 0) / d.colonnes.length;
  const fond = etat.choix === null ? [] : [{
    x: d.colonnes[etat.choix].libelle,
    borderColor: 'rgba(212, 165, 116, 0.18)',
    borderWidth: Math.max(4, Math.round(largeur * 0.92)),
    strokeDashArray: 0
  }];
  etat.graphique.updateOptions({
    xaxis: { labels: { style: { colors: couleursEtiquettes(d) } } },
    annotations: { xaxis: fond }
  }, false, false);
}

function choisir(i) {
  const d = etat.donnees;
  if (!d || i === null || i === undefined || i < 0 || !d.bilans[i]) return;
  etat.choix = etat.choix === i ? null : i;
  majEtiquettes(d);
  rendreDetail(d);
  if (etat.choix !== null && window.innerWidth < 720) {
    document.getElementById('evo-detail')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
}

function lier(hote) {
  if (etat.lie) return;
  etat.lie = true;
  hote.addEventListener('click', e => {
    const el = e.target.closest('[data-evo]');
    if (!el) return;
    const d = etat.donnees;
    if (el.dataset.evo === 'activite') {
      const nom = el.dataset.nom;
      if (etat.masquees.has(nom)) etat.masquees.delete(nom); else etat.masquees.add(nom);
      // Jamais tout masque : le graphique serait vide
      if (d.activites.every(n => etat.masquees.has(n))) etat.masquees.delete(nom);
      rendreLegende(d);
      dessiner(d);
    } else if (el.dataset.evo === 'tout') {
      etat.choix = null;
      majEtiquettes(d);
      rendreDetail(d);
    }
  });
}

racine.EvolutionVue = { afficher };

})(window);
