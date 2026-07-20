const TOKEN_KEY = 'coasterToken';
const USER_KEY = 'coasterUser';

export const auth = {
  getToken() { return localStorage.getItem(TOKEN_KEY); },
  getUser() {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  },
  setSession(token, username) {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify({ username }));
  },
  clear() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  },
  async api(path, options = {}) {
    const token = this.getToken();
    const res = await fetch(`/api${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(options.headers || {}),
      },
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Request failed');
    return data;
  },
  async register(username, password) {
    const data = await this.api('/auth/register', { method: 'POST', body: JSON.stringify({ username, password }) });
    this.setSession(data.token, data.username);
    return data;
  },
  async login(username, password) {
    const data = await this.api('/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) });
    this.setSession(data.token, data.username);
    return data;
  },
  async saveGame(name, gameData) {
    return this.api(`/saves/${encodeURIComponent(name)}`, { method: 'POST', body: JSON.stringify({ game_data: gameData }) });
  },
  async loadGame(name) {
    return this.api(`/saves/${encodeURIComponent(name)}`);
  },
  async listSaves() {
    return this.api('/saves');
  },
  async deleteSave(name) {
    return this.api(`/saves/${encodeURIComponent(name)}`, { method: 'DELETE' });
  },
};
