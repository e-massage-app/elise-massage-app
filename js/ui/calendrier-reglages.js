// ===== CALENDRIER : REGLAGES (v1.1.3.0) =====
// Picto ⚙ du calendrier. Pour l'instant : jours fermes de la semaine, vacances et fermetures
// exceptionnelles (plages de dates), apparence du grise (couleur, opacite, uni ou hachures).
// Un jour ferme est seulement colore : Elise peut toujours y poser un RDV.
// Enregistre dans la cle `calendrier` de `parametres`, et elle seule (saveParametresCles) :
// une vieille copie ouverte ailleurs ne peut pas l'ecraser (cle dans CLES_PARAMETRES_A_PART).

(function (racine) {

const DEFAUT = { joursFermes: [7, 1], fermetures: [], couleur: '#b9aea4', opacite: 0.35, style: 'uni' };
const COULEURS = [
  { valeur: '#b9aea4', nom: 'Taupe' },
  { valeur: '#c3c4cc', nom: 'Gris perle' },
  { valeur: '#e3b9ad', nom: 'Rose poudré' },
  { valeur: '#dcc7a1', nom: 'Sable' },
  { valeur: '#adc4ab', nom: 'Sauge' },
  { valeur: '#c4b8de', nom: 'Lavande' }
];
const JOURS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

// ----- Calculs purs (testes : tests/calendrier-reglages.test.js) -----

function reglagesComplets(r) {
  const x = r && typeof r === 'object' ? r : {};
  const opacite = Number(x.opacite);
  return {
    joursFermes: Array.isArray(x.joursFermes) ? x.joursFermes.map(Number).filter(j => j >= 1 && j <= 7) : DEFAUT.joursFermes.slice(),
    fermetures: Array.isArray(x.fermetures) ? x.fermetures.filter(f => f && f.debut && f.fin) : [],
    couleur: /^#[0-9a-f]{6}$/i.test(x.couleur || '') ? x.couleur : DEFAUT.couleur,
    opacite: Number.isFinite(opacite) ? Math.min(0.9, Math.max(0.05, opacite)) : DEFAUT.opacite,
    style: x.style === 'hachures' ? 'hachures' : 'uni'
  };
}

/** 1 = lundi … 7 = dimanche, pour une date 'YYYY-MM-DD'. */
function jourSemaine(jour) {
  const d = new Date(Number(jour.slice(0, 4)), Number(jour.slice(5, 7)) - 1, Number(jour.slice(8, 10)));
  return d.getDay() || 7;
}

/** La fermeture qui couvre ce jour (plage d'abord, puis jour de la semaine), ou null. */
function fermetureDu(reglages, jour) {
  const plage = reglages.fermetures.find(f => f.debut <= jour && jour <= f.fin);
  if (plage) return { type: 'plage', libelle: plage.libelle || 'Fermeture exceptionnelle' };
  if (reglages.joursFermes.includes(jourSemaine(jour))) return { type: 'semaine', libelle: 'Jour fermé' };
  return null;
}

/** Le fond du grise : la couleur, ou des hachures de cette couleur. */
function fondCss(reglages) {
  return reglages.style === 'hachures'
    ? `repeating-linear-gradient(135deg, ${reglages.couleur} 0 5px, transparent 5px 11px)`
    : reglages.couleur;
}

// ----- Etat -----

const etat = { brouillon: null, lie: false, ajout: false };

function reglages() {
  const p = racine.DataManager ? racine.DataManager.getParametres() : {};
  return reglagesComplets(p && p.calendrier);
}

/** Variables CSS posees sur la grille du calendrier (lues par .calendar-day.jour-ferme). */
function variablesGrille(r = reglages()) {
  return `--ferme-fond: ${fondCss(r)}; --ferme-opacite: ${r.opacite};`;
}

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function dateCourte(jour) {
  return new Date(Number(jour.slice(0, 4)), Number(jour.slice(5, 7)) - 1, Number(jour.slice(8, 10)))
    .toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
}

function aujourdhui() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// ----- Fenetre de reglages -----

function apercu(r) {
  // Une semaine type : les jours fermes grises, un RDV pose sur le premier d'entre eux
  const premierFerme = JOURS.findIndex((_, i) => r.joursFermes.includes(i + 1));
  return `<div class="cal-apercu" style="${variablesGrille(r)}" aria-hidden="true">
    ${JOURS.map((j, i) => `<div class="cal-apercu-jour${r.joursFermes.includes(i + 1) ? ' jour-ferme' : ''}">
      <span>${j}</span>${i === premierFerme ? '<i>10:00</i>' : ''}</div>`).join('')}
  </div>
  <p class="cal-aide">Un RDV reste possible un jour fermé : il s'affiche normalement par-dessus.</p>`;
}

function listeFermetures(r) {
  const jour = aujourdhui();
  const plages = r.fermetures.slice().sort((a, b) => a.debut.localeCompare(b.debut));
  const lignes = plages.map(f => `<li class="${f.fin < jour ? 'is-passee' : ''}">
      <span><b>${esc(f.libelle || 'Fermeture')}</b> · ${f.debut === f.fin ? dateCourte(f.debut) : `du ${dateCourte(f.debut)} au ${dateCourte(f.fin)}`}</span>
      <button type="button" class="cal-mini" data-cal="supprimer-periode" data-id="${esc(f.id)}" aria-label="Supprimer cette période">✕</button>
    </li>`).join('');
  const formulaire = etat.ajout ? `<div class="cal-ajout">
      <label class="cal-champ"><span>Du</span><input type="date" id="cal-debut" value="${jour}"></label>
      <label class="cal-champ"><span>Au</span><input type="date" id="cal-fin" value="${jour}"></label>
      <label class="cal-champ cal-champ-large"><span>Libellé</span><input type="text" id="cal-libelle" placeholder="Vacances" maxlength="40"></label>
      <p class="cal-erreur" id="cal-erreur" hidden></p>
      <div class="cal-ajout-actions">
        <button type="button" class="btn-secondary" data-cal="annuler-periode">Annuler</button>
        <button type="button" class="btn-primary" data-cal="valider-periode">Ajouter</button>
      </div>
    </div>` : `<button type="button" class="cal-ajouter" data-cal="ajouter-periode">+ Ajouter des vacances ou une fermeture</button>`;
  return `${lignes ? `<ul class="cal-periodes">${lignes}</ul>` : '<p class="cal-aide">Aucune pour l\'instant.</p>'}${formulaire}`;
}

function corps(r) {
  return `
    <section class="cal-section">
      <h4>Jours fermés chaque semaine</h4>
      <div class="cal-jours" role="group" aria-label="Jours fermés">
        ${JOURS.map((j, i) => `<button type="button" class="cal-jour${r.joursFermes.includes(i + 1) ? ' is-on' : ''}" data-cal="jour" data-jour="${i + 1}" aria-pressed="${r.joursFermes.includes(i + 1)}">${j}</button>`).join('')}
      </div>
    </section>
    <section class="cal-section">
      <h4>Vacances et fermetures exceptionnelles</h4>
      <div id="cal-fermetures">${listeFermetures(r)}</div>
    </section>
    <section class="cal-section">
      <h4>Apparence</h4>
      <div id="cal-apercu">${apercu(r)}</div>
      <label class="cal-champ cal-champ-large"><span>Opacité <b id="cal-opacite-val">${Math.round(r.opacite * 100)} %</b></span>
        <input type="range" id="cal-opacite" min="5" max="90" step="5" value="${Math.round(r.opacite * 100)}"></label>
      <div class="cal-ligne">
        <span class="cal-etiquette">Style</span>
        <div class="cal-choix-style">
          <button type="button" class="cal-style${r.style === 'uni' ? ' is-on' : ''}" data-cal="style" data-style="uni" aria-pressed="${r.style === 'uni'}">Uni</button>
          <button type="button" class="cal-style${r.style === 'hachures' ? ' is-on' : ''}" data-cal="style" data-style="hachures" aria-pressed="${r.style === 'hachures'}">Hachures</button>
        </div>
      </div>
      <div class="cal-ligne">
        <span class="cal-etiquette">Couleur</span>
        <div class="cal-couleurs">
          ${COULEURS.map(c => `<button type="button" class="cal-pastille${c.valeur === r.couleur ? ' is-on' : ''}" data-cal="couleur" data-couleur="${c.valeur}" style="--c:${c.valeur}" title="${c.nom}" aria-label="${c.nom}"></button>`).join('')}
          <label class="cal-pastille cal-pastille-libre" title="Autre couleur" style="--c:${r.couleur}">
            <input type="color" id="cal-couleur-libre" value="${r.couleur}" aria-label="Autre couleur"></label>
        </div>
      </div>
    </section>
    <div class="modal-actions">
      <button type="button" class="btn-secondary" data-cal="fermer">Annuler</button>
      <button type="button" class="btn-primary" data-cal="enregistrer">Enregistrer</button>
    </div>`;
}

function ouvrir() {
  etat.brouillon = reglages();
  etat.ajout = false;
  lier();
  // L'ordre compte : showModal donne le focus (et un clic) au premier <input>. Les jours et les
  // vacances sont des boutons, le premier champ est donc le curseur d'opacite (sans effet).
  racine.showModal('calendrier-reglages-modal', `<h3>Réglages du calendrier</h3><div class="cal-reglages" id="cal-reglages">${corps(etat.brouillon)}</div>`);
}

function majApercu() {
  const zone = document.getElementById('cal-apercu');
  if (zone) zone.innerHTML = apercu(etat.brouillon);
  const libre = document.querySelector('.cal-pastille-libre');
  if (libre) libre.style.setProperty('--c', etat.brouillon.couleur);
  document.querySelectorAll('.cal-pastille[data-couleur]').forEach(b => b.classList.toggle('is-on', b.dataset.couleur === etat.brouillon.couleur));
}

async function enregistrer(bouton) {
  const p = racine.DataManager.getParametres();
  const avant = p.calendrier;
  p.calendrier = reglagesComplets(etat.brouillon);
  bouton.disabled = true;
  try {
    await racine.DataManager.saveParametresCles(['calendrier']);
  } catch (e) {
    p.calendrier = avant;
    bouton.disabled = false;
    console.error('Réglages du calendrier :', e);
    if (racine.showCustomAlert) racine.showCustomAlert('Les réglages n\'ont pas pu être enregistrés. Vérifie la connexion et réessaie.', 'error');
    return;
  }
  racine.closeModalCompletely();
  if (racine.ViewManager?.updateCalendar) racine.ViewManager.updateCalendar();
  if (racine.showTemporaryMessage) racine.showTemporaryMessage('Réglages du calendrier enregistrés');
}

function lier() {
  if (etat.lie) return;
  etat.lie = true;
  document.addEventListener('click', e => {
    const el = e.target.closest('[data-cal]');
    if (!el || !el.closest('#calendrier-reglages-modal')) return;
    const b = etat.brouillon;
    switch (el.dataset.cal) {
      case 'jour': {
        const j = Number(el.dataset.jour);
        b.joursFermes = b.joursFermes.includes(j) ? b.joursFermes.filter(x => x !== j) : [...b.joursFermes, j].sort();
        el.classList.toggle('is-on', b.joursFermes.includes(j));
        el.setAttribute('aria-pressed', String(b.joursFermes.includes(j)));
        majApercu();
        break;
      }
      case 'couleur':
        b.couleur = el.dataset.couleur;
        majApercu();
        break;
      case 'style':
        b.style = el.dataset.style;
        document.querySelectorAll('.cal-style').forEach(s => {
          s.classList.toggle('is-on', s.dataset.style === b.style);
          s.setAttribute('aria-pressed', String(s.dataset.style === b.style));
        });
        majApercu();
        break;
      case 'ajouter-periode':
        etat.ajout = true;
        document.getElementById('cal-fermetures').innerHTML = listeFermetures(b);
        document.getElementById('cal-libelle')?.focus();
        break;
      case 'annuler-periode':
        etat.ajout = false;
        document.getElementById('cal-fermetures').innerHTML = listeFermetures(b);
        break;
      case 'valider-periode': {
        const debut = document.getElementById('cal-debut').value;
        const fin = document.getElementById('cal-fin').value || debut;
        const erreur = document.getElementById('cal-erreur');
        if (!debut || fin < debut) {
          erreur.textContent = !debut ? 'Choisis la date de début.' : 'La date de fin doit être après la date de début.';
          erreur.hidden = false;
          return;
        }
        const libelle = document.getElementById('cal-libelle').value.trim();
        b.fermetures = [...b.fermetures, { id: `ferm_${Date.now()}`, debut, fin, libelle: libelle || 'Vacances' }];
        etat.ajout = false;
        document.getElementById('cal-fermetures').innerHTML = listeFermetures(b);
        break;
      }
      case 'supprimer-periode':
        b.fermetures = b.fermetures.filter(f => f.id !== el.dataset.id);
        document.getElementById('cal-fermetures').innerHTML = listeFermetures(b);
        break;
      case 'fermer':
        racine.closeModalCompletely();
        break;
      case 'enregistrer':
        enregistrer(el);
        break;
    }
  });
  document.addEventListener('input', e => {
    if (!etat.brouillon || !e.target.closest('#calendrier-reglages-modal')) return;
    if (e.target.id === 'cal-opacite') {
      etat.brouillon.opacite = Number(e.target.value) / 100;
      const val = document.getElementById('cal-opacite-val');
      if (val) val.textContent = `${e.target.value} %`;
      majApercu();
    } else if (e.target.id === 'cal-couleur-libre') {
      etat.brouillon.couleur = e.target.value;
      majApercu();
    }
  });
}

const CalendrierReglages = { DEFAUT, reglagesComplets, jourSemaine, fermetureDu, fondCss, reglages, variablesGrille, ouvrir };

racine.CalendrierReglages = CalendrierReglages;
if (typeof module !== 'undefined' && module.exports) module.exports = CalendrierReglages;

})(typeof window !== 'undefined' ? window : globalThis);
