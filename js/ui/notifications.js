// ===== NOTIFICATIONS : LA CLOCHE EN HAUT A DROITE (v1.4.0.0) =====
// Demande de Jordan (2026-11-03) : une carte cadeau payee en ligne doit se voir dans le logiciel, et la
// cloche doit pouvoir servir a d'autres alertes plus tard. Les notifications viennent de la table
// `notifications` (scripts/migration-notifications.sql), remplie par les fonctions Supabase ; Elise
// les lit et les marque lues. Arrivee en temps reel (Supabase Realtime) quand l'app est ouverte ;
// relecture au retour sur l'app. Regles pures : js/core/notifications-regles.js.

(function () {

const R = window.NotificationsRegles;
let liste = [];
let canal = null;

const esc = v => String(v == null ? '' : v).replace(/[&<>"']/g, c =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const el = id => document.getElementById(id);

async function charger() {
  try {
    const { data, error } = await supabaseClient.from('notifications').select('*')
      .order('cree_le', { ascending: false }).limit(30);
    if (error) throw error;
    liste = R.fusionner([], data || []).slice(0, 30);
    afficher();
  } catch (e) {
    // Table absente ou reseau coupe : la cloche reste vide, l'app continue
    console.warn('Notifications :', e.message || e);
  }
}

function afficher() {
  const pastille = el('notif-pastille');
  const texte = R.pastille(liste);
  if (pastille) {
    pastille.textContent = texte;
    pastille.hidden = !texte;
  }
  el('notif-bouton')?.setAttribute('aria-label', texte ? `Notifications (${R.nonLues(liste).length} non lues)` : 'Notifications');
  const zone = el('notif-liste');
  if (!zone) return;
  const maintenant = new Date();
  zone.innerHTML = liste.length
    ? liste.map(n => `
      <li>
        <button type="button" class="notif-item${n.lu_le ? '' : ' notif-item--nouvelle'}" data-notif="${esc(n.id)}">
          <span class="notif-item__titre">${esc(n.titre)}</span>
          ${n.texte ? `<span class="notif-item__texte">${esc(n.texte)}</span>` : ''}
          <span class="notif-item__quand">${esc(R.quand(n.cree_le, maintenant))}</span>
        </button>
      </li>`).join('')
    : '<li class="notif-vide">Aucune notification pour le moment.</li>';
  const toutLire = el('notif-tout-lire');
  if (toutLire) toutLire.hidden = !R.nonLues(liste).length;
}

async function marquerLues(ids) {
  if (!ids.length) return;
  const maintenant = new Date().toISOString();
  liste = liste.map(n => (ids.includes(n.id) && !n.lu_le ? { ...n, lu_le: maintenant } : n));
  afficher();
  const { error } = await supabaseClient.from('notifications').update({ lu_le: maintenant }).in('id', ids);
  if (error) console.warn('Notifications (lecture) :', error.message);
}

// Une carte cadeau creee par le serveur : on l'ajoute a la liste sans recharger l'app
async function ajouterBon(bonId) {
  if (!bonId || DataManager.getBonCadeauById(bonId)) return;
  const { data, error } = await supabaseClient.from('bons_cadeaux').select('*').eq('id', bonId).maybeSingle();
  if (error || !data) return;
  const appData = DataManager.getAppData();
  appData.bonsCadeaux = [...(appData.bonsCadeaux || []), DataManager.mapBonCadeauFromDb(data)];
  const onglet = document.querySelector('.tab-content.active')?.id;
  if (onglet === 'bons-cadeaux') ViewManager.updateBonsCadeauxDisplay();
  if (onglet === 'dashboard') ViewManager.updateDashboard();
}

async function ouvrirNotification(id) {
  const n = liste.find(x => x.id === id);
  if (!n) return;
  fermer();
  await marquerLues([id]);
  const lien = n.lien || {};
  if (lien.onglet) {
    // Le bouton de l'onglet (showTab lit le clic pour surligner le bon bouton)
    document.querySelector(`.nav-tab[onclick*="'${lien.onglet}'"]`)?.click();
  }
  if (lien.bonId) {
    await ajouterBon(lien.bonId);
    if (DataManager.getBonCadeauById(lien.bonId)) showBonCadeauDetailsModal(lien.bonId);
  }
}

function ouvrir() {
  const panneau = el('notif-panneau');
  // Telephone : le panneau prend toute la largeur, juste sous l'en-tete (ou qu'il soit)
  const entete = document.querySelector('.app-header');
  panneau.style.top = entete && window.matchMedia('(max-width: 768px)').matches
    ? `${Math.round(entete.getBoundingClientRect().bottom) + 6}px` : '';
  panneau.hidden = false;
  el('notif-bouton').setAttribute('aria-expanded', 'true');
  fermerMenuReglages();
}
function fermer() {
  const panneau = el('notif-panneau');
  if (panneau) panneau.hidden = true;
  el('notif-bouton')?.setAttribute('aria-expanded', 'false');
}
function basculer() {
  if (el('notif-panneau').hidden) ouvrir(); else fermer();
}

// ---------- Menu ⚙ (Parametres, Exporter, Importer), sur ordinateur ----------

function fermerMenuReglages() {
  const menu = el('menu-reglages');
  if (menu) menu.hidden = true;
  el('reglages-bouton')?.setAttribute('aria-expanded', 'false');
}
function basculerMenuReglages() {
  const menu = el('menu-reglages');
  const ouvert = menu.hidden;
  menu.hidden = !ouvert;
  el('reglages-bouton').setAttribute('aria-expanded', String(ouvert));
  if (ouvert) fermer();
}

// ---------- Temps reel ----------

async function abonner() {
  if (canal || typeof supabaseClient.channel !== 'function') return;
  const { data } = await supabaseClient.auth.getUser();
  const userId = data && data.user && data.user.id;
  if (!userId) return;
  canal = supabaseClient.channel('notifications-elise')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
      ({ new: n }) => {
        liste = R.fusionner(liste, [n]).slice(0, 30);
        afficher();
        if (typeof showTemporaryMessage === 'function') showTemporaryMessage(n.titre);
        if (n.lien && n.lien.bonId) ajouterBon(n.lien.bonId).catch(() => {});
      })
    .subscribe();
}

function demarrer() {
  el('notif-bouton')?.addEventListener('click', basculer);
  el('notif-tout-lire')?.addEventListener('click', () => marquerLues(R.nonLues(liste).map(n => n.id)));
  el('notif-liste')?.addEventListener('click', e => {
    const id = e.target.closest('[data-notif]')?.dataset.notif;
    if (id) ouvrirNotification(id);
  });
  el('reglages-bouton')?.addEventListener('click', basculerMenuReglages);
  el('menu-reglages')?.addEventListener('click', e => { if (e.target.closest('button')) fermerMenuReglages(); });
  // Clic ailleurs ou Echap : on ferme
  document.addEventListener('click', e => {
    if (!e.target.closest('.notif') ) fermer();
    if (!e.target.closest('.reglages')) fermerMenuReglages();
  });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') { fermer(); fermerMenuReglages(); } });
  // De retour sur l'app (telephone en veille, autre onglet) : on relit
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') charger(); });
  charger();
  abonner().catch(e => console.warn('Notifications (temps reel) :', e.message || e));
}

window.Notifications = { demarrer, charger };

})();
