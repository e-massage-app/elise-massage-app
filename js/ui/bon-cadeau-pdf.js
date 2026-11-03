// ===== BON CADEAU A IMPRIMER : FENETRE ET PDF (v1.2.1.0) =====
// Elise remplit et telecharge le bon de ses clientes sur SON visuel (decision de Jordan, 2026-11-03).
// Le PDF reste vectoriel : le texte est pose sur son fichier (assets/bon-cadeau/bon-vierge.pdf), rien
// n'est aplati en image ; format 210 x 100 mm. Champs pre-remplis depuis le bon, tous modifiables ;
// emojis PLEINS a la couleur du texte (police BonCadeauEmoji, palette « Inserer un emoji »).
// Mise en page : js/core/bon-cadeau-carte.js. Un caractere qu'aucune police ne dessine est signale.
// pdf-lib et fontkit ne sont charges qu'au premier telechargement (versions figees).

(function () {

const C = window.BonCadeauCarte;
// Chemin pris depuis ce script (js/ui/) : marche aussi depuis tests/apercu-app.html
const DOSSIER = new URL('../../assets/bon-cadeau/', document.currentScript.src).href;
const BIBLIOTHEQUES = [
  'https://cdn.jsdelivr.net/npm/pdf-lib@1.17.1/dist/pdf-lib.min.js',
  'https://cdn.jsdelivr.net/npm/@pdf-lib/fontkit@1.1.1/dist/fontkit.umd.min.js'
];
const COULEUR_CSS = `rgb(${C.STYLE.couleur.join(',')})`;

const esc = v => String(v == null ? '' : v).replace(/[&<>"']/g, c =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// ---------- Apercu : memes polices que le PDF, mesure au canvas ----------

let policesApercu = null;
function chargerPolicesApercu() {
  if (!policesApercu) {
    policesApercu = Promise.all([
      new FontFace('BonTexte', `url(${DOSSIER}BonCadeauSans-SemiBold.ttf)`),
      new FontFace('BonMention', `url(${DOSSIER}BonCadeauSans-Regular.ttf)`),
      new FontFace('BonEmoji', `url(${DOSSIER}BonCadeauEmoji.ttf)`)
    ].map(p => p.load().then(f => { document.fonts.add(f); return f; })))
      .catch(e => { policesApercu = null; throw e; });
  }
  return policesApercu;
}

let contexte = null;
// Mesure a 100 px puis mise a l'echelle : les navigateurs arrondissent les tres petites tailles
function mesureApercu(texte, taille, emoji) {
  contexte = contexte || document.createElement('canvas').getContext('2d');
  contexte.font = `100px ${emoji ? 'BonEmoji' : 'BonTexte'}`;
  return contexte.measureText(texte).width * taille / 100;
}

function svgDuBon(compo) {
  let textes = '';
  for (const cle of C.CLES) {
    const r = compo[cle];
    if (r.tropLong) continue;
    const x = C.CHAMPS[cle].x0 + C.STYLE.marge;
    r.lignes.forEach((ligne, i) => {
      const morceaux = C.segments(ligne).map(s =>
        `<tspan font-family="${s.emoji ? 'BonEmoji' : 'BonTexte'}">${esc(s.texte)}</tspan>`).join('');
      textes += `<text x="${x}" y="${r.lignesDeBase[i]}" font-size="${r.taille}">${morceaux}</text>`;
    });
  }
  const m = C.MENTION;
  textes += `<text x="${m.fin}" y="${m.ligneDeBase}" font-size="${m.taille}" font-family="BonMention" text-anchor="end">${esc(m.texte)}</text>`;
  return `<svg viewBox="0 0 ${C.PAGE.largeur} ${C.PAGE.hauteur}" fill="${COULEUR_CSS}" style="white-space: pre" aria-hidden="true">${textes}</svg>`;
}

// ---------- PDF ----------

function chargerScript(src) {
  return new Promise((ok, ko) => {
    if ((src.includes('pdf-lib@') && window.PDFLib) || (src.includes('fontkit@') && window.fontkit)) return ok();
    const s = document.createElement('script');
    s.src = src;
    s.onload = () => ok();
    s.onerror = () => ko(new Error(`Chargement impossible : ${src}`));
    document.head.appendChild(s);
  });
}

let ressources = null;
function chargerRessources() {
  if (!ressources) {
    ressources = (async () => {
      for (const src of BIBLIOTHEQUES) await chargerScript(src);
      const lire = nom => fetch(DOSSIER + nom).then(r => {
        if (!r.ok) throw new Error(`${nom} introuvable (${r.status})`);
        return r.arrayBuffer();
      });
      const [modele, semi, fin, emoji] = await Promise.all(
        ['bon-vierge.pdf', 'BonCadeauSans-SemiBold.ttf', 'BonCadeauSans-Regular.ttf', 'BonCadeauEmoji.ttf'].map(lire));
      // Ce que savent dessiner les polices : un caractere absent sortirait en case vide sur le bon
      const texte = window.fontkit.create(new Uint8Array(semi));
      const dessins = window.fontkit.create(new Uint8Array(emoji));
      const couvre = (car, estEmoji) => (estEmoji ? dessins : texte).hasGlyphForCodePoint(car.codePointAt(0));
      return { modele, semi, fin, emoji, couvre };
    })().catch(e => { ressources = null; throw e; });
  }
  return ressources;
}

async function creerPdf(textes) {
  const r = await chargerRessources();
  const { PDFDocument, rgb } = window.PDFLib;
  const doc = await PDFDocument.load(r.modele);
  doc.registerFontkit(window.fontkit);
  const semi = await doc.embedFont(r.semi, { subset: true });
  const fin = await doc.embedFont(r.fin, { subset: true });
  const emoji = await doc.embedFont(r.emoji, { subset: true });

  const compo = C.composer(textes, (t, taille, e) => (e ? emoji : semi).widthOfTextAtSize(t, taille));
  const tropLongs = C.CLES.filter(c => compo[c].tropLong);
  if (tropLongs.length) throw new Error(`Texte trop long : ${tropLongs.map(c => C.CHAMPS[c].libelle).join(', ')}`);
  const absents = C.CLES.flatMap(c => C.introuvables(compo[c].texte, r.couvre));
  if (absents.length) throw new Error(`Caractères impossibles à imprimer : ${absents.join(' ')}`);

  const page = doc.getPage(0);
  const boite = page.getMediaBox();
  const yPdf = y => boite.y + boite.height - y; // regles : origine en haut ; PDF : en bas
  const couleur = rgb(...C.STYLE.couleur.map(v => v / 255));

  for (const cle of C.CLES) {
    const res = compo[cle];
    res.lignes.forEach((ligne, i) => {
      let x = boite.x + C.CHAMPS[cle].x0 + C.STYLE.marge;
      for (const s of C.segments(ligne)) {
        const police = s.emoji ? emoji : semi;
        page.drawText(s.texte, { x, y: yPdf(res.lignesDeBase[i]), size: res.taille, font: police, color: couleur });
        x += police.widthOfTextAtSize(s.texte, res.taille);
      }
    });
  }
  const m = C.MENTION;
  page.drawText(m.texte, {
    x: boite.x + m.fin - fin.widthOfTextAtSize(m.texte, m.taille),
    y: yPdf(m.ligneDeBase), size: m.taille, font: fin, color: couleur
  });

  doc.setTitle(`Bon cadeau${textes.pour ? ` pour ${textes.pour}` : ''}`);
  doc.setAuthor('Elise Massage & Bien-être');
  doc.setCreator('Logiciel Elise Massage');
  return doc.save();
}

function proposerFichier(octets, nom) {
  const url = URL.createObjectURL(new Blob([octets], { type: 'application/pdf' }));
  const lien = document.createElement('a');
  lien.href = url;
  lien.download = nom;
  document.body.appendChild(lien);
  lien.click();
  lien.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

// ---------- Fenetre ----------

/** Soins de la carte d'Elise, avec duree : « Massage Signature - 60 minutes ». Montant du bon en tete. */
function soinsProposes(bon) {
  const libelles = [];
  if (bon.montant > 0) libelles.push(C.soinDeMontant(bon.montant));
  for (const soin of DataManager.getSoins()) {
    const durees = [...new Set((soin.variantes || []).map(v => Number(v.duree)).filter(Boolean))].sort((a, b) => a - b);
    if (durees.length) durees.forEach(d => libelles.push(`${soin.nom} - ${d} minutes`));
    else libelles.push(soin.nom);
  }
  return [...new Set(libelles)];
}

function ouvrirBonCadeauPdf(bonId) {
  const bon = DataManager.getBonCadeauById(bonId);
  if (!bon) return;
  const clients = DataManager.getAppData().clients || [];
  const nomFiche = id => {
    const c = id && clients.find(x => x.id === id);
    return c ? `${c.prenom || ''} ${c.nom || ''}`.trim() : '';
  };
  const textes = C.textesParDefaut(bon, { acheteur: nomFiche(bon.acheteurClientId), beneficiaire: nomFiche(bon.beneficiaireClientId) });
  const champ = (cle, libelle, html) => `
    <div class="form-group">
      <label for="bon-pdf-${cle}">${libelle}</label>
      ${html}
      <small class="bon-pdf__alerte" data-alerte="${cle}"></small>
    </div>`;

  showModal('bon-cadeau-pdf-modal', `
    <h3>🎁 Bon cadeau à imprimer</h3>
    <p class="bon-pdf__aide">Les champs reprennent le bon : modifiez-les si besoin. PDF au format du bon (210 × 100 mm), prêt à imprimer ou à envoyer.</p>
    <div class="bon-pdf__corps" id="bon-pdf-corps">
    <div class="bon-pdf__visuel">
      <div class="bon-pdf__apercu">
        <img src="${DOSSIER}apercu-vierge.webp" alt="Aperçu du bon cadeau">
        <div class="bon-pdf__textes" id="bon-pdf-textes"></div>
      </div>
      <button type="button" class="bon-pdf__bascule" id="bon-pdf-bascule" aria-pressed="false">Voir le bon entier</button>
    </div>
    <form id="bon-pdf-form" class="bon-pdf__champs" onsubmit="return false">
      ${champ('offertPar', 'Bon cadeau offert par', `<input type="text" id="bon-pdf-offertPar" data-cle="offertPar" value="${esc(textes.offertPar)}" autocomplete="off">`)}
      ${champ('pour', 'Pour', `<input type="text" id="bon-pdf-pour" data-cle="pour" value="${esc(textes.pour)}" autocomplete="off">`)}
      ${champ('soin', 'Soin', `
        <select id="bon-pdf-soin-liste" aria-label="Choisir un soin de la carte">
          <option value="">Choisir dans ma carte des soins…</option>
          ${soinsProposes(bon).map(s => `<option value="${esc(s)}">${esc(s)}</option>`).join('')}
        </select>
        <input type="text" id="bon-pdf-soin" data-cle="soin" value="${esc(textes.soin)}" autocomplete="off">`)}
      ${champ('message', 'Message', `
        <textarea id="bon-pdf-message" data-cle="message" rows="3" placeholder="Joyeux anniversaire ! ❤">${esc(textes.message)}</textarea>
        <button type="button" class="bon-pdf__ouvrir-emojis" id="bon-pdf-ouvrir-emojis" aria-expanded="false" aria-controls="bon-pdf-emojis">
          <span class="bon-pdf__emoji" aria-hidden="true">😊</span> Insérer un emoji
        </button>
        <div class="bon-pdf__emojis" id="bon-pdf-emojis" hidden>
          ${C.EMOJIS.map(g => `
            <div class="bon-pdf__groupe">${esc(g.titre)}</div>
            <div class="bon-pdf__grille">
              ${g.emojis.map(e => `<button type="button" class="bon-pdf__emoji" data-emoji="${e}" title="Insérer ${e}">${e}</button>`).join('')}
            </div>`).join('')}
        </div>
        <small class="bon-pdf__note">Emojis imprimés pleins, à la couleur du texte (ceux du clavier aussi). Un long message rapetisse pour tenir dans son encart.</small>`)}
    </form>
    </div>
    <div class="modal-actions">
      <button type="button" class="btn-secondary" onclick="closeModal()">Fermer</button>
      <button type="button" class="btn-primary" id="bon-pdf-telecharger" data-loading-text="Création du PDF…">⬇️ Télécharger le PDF</button>
    </div>
  `);

  const form = document.getElementById('bon-pdf-form');
  const lire = () => Object.fromEntries(C.CLES.map(cle => [cle, form.querySelector(`[data-cle="${cle}"]`).value]));
  const bouton = document.getElementById('bon-pdf-telecharger');

  let couvre = null; // connu une fois les polices du PDF chargees
  const majApercu = () => {
    const compo = C.composer(lire(), mesureApercu);
    const zone = document.getElementById('bon-pdf-textes');
    if (zone) zone.innerHTML = svgDuBon(compo);
    let bloque = false;
    for (const cle of C.CLES) {
      const absents = couvre ? C.introuvables(compo[cle].texte, couvre) : [];
      const alerte = form.querySelector(`[data-alerte="${cle}"]`);
      alerte.textContent = compo[cle].tropLong ? 'Trop long pour tenir sur le bon : raccourcissez ce texte.'
        : absents.length ? `Impossible à imprimer sur le bon : ${absents.join(' ')}` : '';
      bloque = bloque || !!compo[cle].tropLong || absents.length > 0;
    }
    bouton.disabled = bloque;
  };

  form.addEventListener('input', majApercu);

  // « Inserer un emoji » : a l'endroit du curseur, dans le dernier champ touche (le message sinon)
  let dernierChamp = document.getElementById('bon-pdf-message');
  const retenir = e => { if (e.target.dataset.cle) dernierChamp = e.target; };
  ['focusin', 'click', 'input'].forEach(type => form.addEventListener(type, retenir));
  const palette = document.getElementById('bon-pdf-emojis');
  const ouvrirPalette = document.getElementById('bon-pdf-ouvrir-emojis');
  ouvrirPalette.addEventListener('click', () => {
    palette.hidden = !palette.hidden;
    ouvrirPalette.setAttribute('aria-expanded', String(!palette.hidden));
  });
  palette.addEventListener('click', e => {
    const emoji = e.target.closest('[data-emoji]')?.dataset.emoji;
    if (!emoji) return;
    const champ = dernierChamp;
    const debut = champ.selectionStart ?? champ.value.length;
    const fin = champ.selectionEnd ?? debut;
    const precedent = [...champ.value.slice(0, debut)].pop();
    // Une espace avant, sauf en debut, apres une espace ou apres un autre emoji (« ❤✨ »)
    const espace = precedent && !/\s/.test(precedent) && !C.segments(precedent)[0].emoji ? ' ' : '';
    champ.setRangeText(espace + emoji, debut, fin, 'end');
    majApercu();
  });
  document.getElementById('bon-pdf-bascule').addEventListener('click', e => {
    const entier = document.getElementById('bon-pdf-corps').classList.toggle('entier');
    e.target.setAttribute('aria-pressed', String(entier));
    e.target.textContent = entier ? 'Zoom sur les champs' : 'Voir le bon entier';
  });
  document.getElementById('bon-pdf-soin-liste').addEventListener('change', e => {
    if (!e.target.value) return;
    document.getElementById('bon-pdf-soin').value = e.target.value;
    e.target.value = '';
    majApercu();
  });
  bouton.addEventListener('click', () => window.withButtonLoading(bouton, async () => {
    const valeurs = lire();
    const octets = await creerPdf(valeurs);
    const carte = Object.fromEntries(C.CLES.map(cle => [cle, C.typographier(valeurs[cle], C.CHAMPS[cle].multi)]));
    if (JSON.stringify(bon.carte || null) !== JSON.stringify(carte)) {
      await BusinessServices.enregistrerCarteBonCadeau(bon.id, carte);
    }
    const nom = C.nomDeFichier(carte.pour, jourLocal(new Date()));
    proposerFichier(octets, nom);
    showTemporaryMessage(`📄 Bon cadeau créé : ${nom}`);
  }, { errorMessage: 'Le PDF du bon cadeau n\'a pas pu être créé.' }).catch(() => {}));

  majApercu();
  chargerPolicesApercu().then(majApercu).catch(e => console.warn('Polices du bon cadeau :', e));
  // Prepare le PDF pendant qu'Elise relit, et verifie ce que les polices savent dessiner
  chargerRessources().then(r => { couvre = r.couvre; majApercu(); }).catch(() => {});
}

window.ouvrirBonCadeauPdf = ouvrirBonCadeauPdf;

})();
