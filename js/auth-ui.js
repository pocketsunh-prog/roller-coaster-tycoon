import { auth } from './auth.js';

export class AuthUI {
  constructor(game) {
    this.game = game;
    this.$ = id => document.getElementById(id);
    this.modal = this.$('authModal');
    this.errorEl = this.$('authError');
    this.submitBtn = this.$('authSubmit');
    this.loggedSection = this.$('authLogged');
    this.tab = 'login';

    this.$('authBtn').addEventListener('click', () => this.open());
    this.$('authCancel').addEventListener('click', () => this.close());
    this.$('authSubmit').addEventListener('click', () => this.submit());
    this.$('authLogout').addEventListener('click', () => this.logout());
    this.modal.querySelector('.modal-backdrop').addEventListener('click', () => this.close());

    this.$('authPassword').addEventListener('keydown', e => { if (e.key === 'Enter') this.submit(); });

    document.querySelectorAll('.auth-tab').forEach(t => {
      t.addEventListener('click', () => this.switchTab(t.dataset.tab));
    });

    this.refreshBtn();
  }

  open(required = false) {
    this.required = required;
    this.$('authCancel').style.display = required ? 'none' : '';
    this.modal.querySelector('.modal-backdrop').style.pointerEvents = required ? 'none' : '';
    this.$('authGateMsg').style.display = required ? '' : 'none';
    this.modal.classList.toggle('required', required);
    const user = auth.getUser();
    this.modal.classList.remove('hidden');
    if (user) {
      this.showLogged();
    } else {
      this.showForm();
      this.switchTab('login');
    }
  }

  close() {
    if (this.required) return;
    this.modal.classList.add('hidden');
    this.errorEl.textContent = '';
  }

  showForm() {
    this.loggedSection.classList.add('hidden');
    this.submitBtn.style.display = '';
    this.$('authUsername').style.display = '';
    this.$('authPassword').style.display = '';
    document.querySelector('.auth-tabs').style.display = '';
  }

  showLogged() {
    const user = auth.getUser();
    this.$('authUser').textContent = user ? user.username : '';
    this.loggedSection.classList.remove('hidden');
    this.submitBtn.style.display = 'none';
    this.$('authUsername').style.display = 'none';
    this.$('authPassword').style.display = 'none';
    document.querySelector('.auth-tabs').style.display = 'none';
  }

  switchTab(tab) {
    this.tab = tab;
    this.errorEl.textContent = '';
    document.querySelectorAll('.auth-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
    this.submitBtn.textContent = tab === 'login' ? 'Login' : 'Register';
    this.$('authPassword').autocomplete = tab === 'login' ? 'current-password' : 'new-password';
  }

  async submit() {
    const username = this.$('authUsername').value.trim();
    const password = this.$('authPassword').value;
    this.errorEl.textContent = '';
    if (!username || !password) { this.errorEl.textContent = 'Fill in both fields'; return; }
    this.submitBtn.disabled = true;
    try {
      if (this.tab === 'login') await auth.login(username, password);
      else await auth.register(username, password);
      this.game.onAuthChange();
      this.refreshBtn();
      this.showLogged();
    } catch (e) {
      this.errorEl.textContent = e.message;
    } finally {
      this.submitBtn.disabled = false;
    }
  }

  logout() {
    auth.clear();
    this.game.onAuthChange();
    this.refreshBtn();
    this.showForm();
    this.switchTab('login');
  }

  refreshBtn() {
    const user = auth.getUser();
    this.$('authBtn').textContent = user ? user.username : 'Login';
  }
}
