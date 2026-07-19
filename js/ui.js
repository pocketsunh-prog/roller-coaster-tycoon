export class UI {
  constructor(game) {
    this.game = game;
    this.$ = id => document.getElementById(id);
    this.cashEl = this.$('cash');
    this.guestsEl = this.$('guests');
    this.statusEl = this.$('status');
    this.excitementEl = this.$('excitement');
    this.priceEl = this.$('price');
    this.speedEl = this.$('speed');
    this.openBtn = this.$('openBtn');
    this.toastEl = this.$('toast');
    this._toastTimer = null;

    // Build buttons place pieces
    document.querySelectorAll('[data-piece]').forEach(btn => {
      btn.addEventListener('click', () => game.tryPlace(btn.dataset.piece));
    });
    // Model buttons switch coaster style
    document.querySelectorAll('[data-model]').forEach(btn => {
      btn.addEventListener('click', () => game.setModel(btn.dataset.model));
    });
    this.$('undoBtn').addEventListener('click', () => game.undo());
    this.$('clearBtn').addEventListener('click', () => game.clearAll());
    this.$('zoomInBtn').addEventListener('click', () => game.zoomIn());
    this.$('zoomOutBtn').addEventListener('click', () => game.zoomOut());
    this.$('saveBtn').addEventListener('click', () => game.save());
    this.$('loadBtn').addEventListener('click', () => game.load());
    this.openBtn.addEventListener('click', () => game.toggleOpen());
    this.$('priceMinus').addEventListener('click', () => game.setPrice(-1));
    this.$('pricePlus').addEventListener('click', () => game.setPrice(1));
    this.$('helpBtn').addEventListener('click', () => this.$('help').classList.toggle('hidden'));
  }

  toast(msg, ms = 2400) {
    this.toastEl.textContent = msg;
    this.toastEl.classList.add('show');
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => this.toastEl.classList.remove('show'), ms);
  }

  update() {
    const g = this.game;
    this.cashEl.textContent = '$' + Math.floor(g.cash).toLocaleString();
    this.guestsEl.textContent = g.guests.guests.length;
    const st = g.track.stats;
    this.excitementEl.textContent = st.excitement;
    this.speedEl.textContent = g.train.state === 'running' ? g.train.speed.toFixed(1) : '0.0';
    this.priceEl.textContent = '$' + g.price;

    if (!g.track.complete) {
      this.statusEl.textContent = 'BUILDING';
      this.statusEl.className = 'stat-value status-building';
    } else if (g.rideOpen) {
      this.statusEl.textContent = 'OPEN';
      this.statusEl.className = 'stat-value status-open';
    } else {
      this.statusEl.textContent = 'CLOSED';
      this.statusEl.className = 'stat-value status-closed';
    }

    this.openBtn.disabled = !g.track.complete;
    this.openBtn.textContent = g.rideOpen ? 'Close Ride' : 'Open Ride';
    this.openBtn.classList.toggle('btn-open', !g.rideOpen && g.track.complete);
    this.openBtn.classList.toggle('btn-close', g.rideOpen);

    // Highlight the selected piece
    document.querySelectorAll('[data-piece]').forEach(btn => {
      btn.classList.toggle('selected', btn.dataset.piece === g.selected);
    });
    // Highlight the selected model
    document.querySelectorAll('[data-model]').forEach(btn => {
      btn.classList.toggle('selected', btn.dataset.model === g.model);
    });
  }
}
