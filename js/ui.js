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
    this.souvenirsEl = this.$('souvenirs');
    this.shopBtn = this.$('shopBtn');
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

    // Confirm modal
    this.modalEl = this.$('modal');
    this.modalMsg = this.$('modal-msg');
    this._modalResolve = null;
    this.$('modal-cancel').addEventListener('click', () => this._closeModal(false));
    this.$('modal-confirm').addEventListener('click', () => this._closeModal(true));
    this.modalEl.querySelector('.modal-backdrop').addEventListener('click', () => this._closeModal(false));

    // Action buttons
    this.$('undoBtn').addEventListener('click', () => game.undo());
    this.$('clearBtn').addEventListener('click', () => this.confirm('Clear all track pieces?', () => game.clearAll()));
    this.$('newBtn').addEventListener('click', () => this.confirm('Start a new game? This erases everything.', () => game.newGame()));
    this.$('zoomInBtn').addEventListener('click', () => game.zoomIn());
    this.$('zoomOutBtn').addEventListener('click', () => game.zoomOut());
    this.$('saveBtn').addEventListener('click', () => game.save());
    this.$('loadBtn').addEventListener('click', () => game.load());
    this.shopBtn.addEventListener('click', () => game.toggleShop());
    this.openBtn.addEventListener('click', () => game.toggleOpen());
    this.$('priceMinus').addEventListener('click', () => game.setPrice(-1));
    this.$('pricePlus').addEventListener('click', () => game.setPrice(1));
    this.$('helpBtn').addEventListener('click', () => this.$('help').classList.toggle('hidden'));
  }

  confirm(msg, onYes) {
    this.modalMsg.textContent = msg;
    this.modalEl.classList.remove('hidden');
    this._modalOnYes = onYes;
  }

  _closeModal(confirmed) {
    this.modalEl.classList.add('hidden');
    if (confirmed && this._modalOnYes) this._modalOnYes();
    this._modalOnYes = null;
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
    this.souvenirsEl.textContent = g.souvenirs;
    this.shopBtn.classList.toggle('selected', g.hasShop);
    this.shopBtn.querySelector('.tool-name').textContent = g.hasShop ? 'Sell Shop' : 'Gift Shop';

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

  initSlots() {
    this.slotSelect = this.$('slotSelect');
    this.slotSelect.addEventListener('change', () => {
      const name = this.slotSelect.value;
      if (name && name !== this.game.currentSlot) {
        this.game.load(name);
      }
    });
    this.$('slotNewBtn').addEventListener('click', () => this.promptNewSlot());
    this.$('slotDeleteBtn').addEventListener('click', () => this.deleteCurrentSlot());
  }

  async promptNewSlot() {
    const name = prompt('Save name:');
    if (!name) return;
    const trimmed = name.trim().slice(0, 64);
    if (!trimmed) return;
    this.game.newSlot(trimmed);
    await this.refreshSlots();
  }

  async deleteCurrentSlot() {
    if (this.game.currentSlot === 'default') { this.toast('Cannot delete default'); return; }
    const ok = confirm(`Delete save "${this.game.currentSlot}"?`);
    if (!ok) return;
    await this.game.deleteSlot(this.game.currentSlot);
    this.game.currentSlot = 'default';
    this.game.load('default');
    await this.refreshSlots();
  }

  async refreshSlots() {
    if (!this.slotSelect) return;
    const slots = await this.game.listSlots();
    const names = slots.length ? slots.map(s => s.save_name) : ['default'];
    if (!names.includes(this.game.currentSlot)) names.push(this.game.currentSlot);
    this.slotSelect.innerHTML = '';
    for (const n of names) {
      const opt = document.createElement('option');
      opt.value = n;
      opt.textContent = n;
      if (n === this.game.currentSlot) opt.selected = true;
      this.slotSelect.appendChild(opt);
    }
    if (this.game.loggedIn) this.game.save(true);
  }
}
