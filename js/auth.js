// ===== js/auth.js =====
// Gestion de l'authentification Supabase

const Auth = {
  /**
   * Vérifie si l'utilisateur est connecté, redirige vers login.html sinon
   */
  async checkSession() {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session) {
      window.location.href = 'login.html';
      return false;
    }
    return true;
  },

  /**
   * Connexion par email/mot de passe
   */
  async login(email, password) {
    const { data, error } = await supabaseClient.auth.signInWithPassword({
      email,
      password
    });
    if (error) {
      throw error;
    }
    return data;
  },

  /**
   * Déconnexion
   */
  async logout() {
    await supabaseClient.auth.signOut();
    window.location.href = 'login.html';
  },

  /**
   * Retourne l'utilisateur courant ou null
   */
  async getUser() {
    const { data: { user } } = await supabaseClient.auth.getUser();
    return user;
  },

  /**
   * Retourne le user_id de l'utilisateur courant
   */
  async getUserId() {
    const user = await this.getUser();
    return user ? user.id : null;
  },

  /**
   * Listener pour les changements d'état d'authentification
   */
  onAuthStateChange(callback) {
    supabaseClient.auth.onAuthStateChange((event, session) => {
      callback(event, session);
    });
  }
};

window.Auth = Auth;

console.log('✅ Module Auth chargé');
