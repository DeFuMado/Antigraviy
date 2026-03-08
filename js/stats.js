/* =====================================================
   STATS.JS - Statistics Tracking Module
   ===================================================== */

const STAT_CATEGORIES = [
  { key: 'all', label: 'All' },
  { key: 'agg', label: 'AGG (Agressividade)' },
  { key: 'preflop', label: 'Pre Flop' },
  { key: 'blindwar', label: 'Blind War' },
  { key: 'ip_attack', label: 'Pos Flop (IP Attack)' },
  { key: 'oop_attack', label: 'Pos Flop (OOP Attack)' },
  { key: 'oop_defense', label: 'Pos Flop (OOP Defense)' },
  { key: 'ip_defense', label: 'Pos Flop (IP Defense)' },
  { key: 'river_hu', label: 'River HU' },
  { key: 'reports', label: 'Reports (Win Rate/EV)' }
];

let activeCategoryFilter = 'all';

function initStats() {
  if (!state.playerStats) {
    state.playerStats = [];
  }

  // Migrate: ensure all stats have a category
  state.playerStats.forEach(s => {
    if (!s.category) s.category = 'all';
  });

  populateCategoryDropdown();
  renderCategoryChips();
  renderStatsTable();
  renderStatsSummary();
}

// ---- Category Chips ----
function renderCategoryChips() {
  const container = document.getElementById('category-chips');
  if (!container) return;

  container.innerHTML = STAT_CATEGORIES.map(cat => {
    const active = activeCategoryFilter === cat.key ? 'active' : '';
    const count = cat.key === 'all'
      ? state.playerStats.length
      : state.playerStats.filter(s => s.category === cat.key).length;
    return `<button class="category-chip ${active}" onclick="filterByCategory('${cat.key}')">${cat.label}${count > 0 ? ` (${count})` : ''}</button>`;
  }).join('');
}

function populateCategoryDropdown() {
  const select = document.getElementById('new-stat-category');
  if (!select) return;

  select.innerHTML = '<option value="">Categoria...</option>';
  STAT_CATEGORIES.filter(c => c.key !== 'all').forEach(cat => {
    const opt = document.createElement('option');
    opt.value = cat.key;
    opt.textContent = cat.label;
    select.appendChild(opt);
  });
}

function filterByCategory(cat) {
  activeCategoryFilter = cat;
  renderCategoryChips();
  renderStatsTable();
}

// ---- Classification Logic ----
const BGAME_THRESHOLD = 15;
const AGAME_THRESHOLD = 5;

function classifyStat(target, value) {
  if (target === 0) {
    if (value === 0) return 'agame';
    return Math.abs(value) <= 2 ? 'bgame' : 'cgame';
  }

  const deviation = Math.abs(value - target);
  const deviationPct = (deviation / Math.abs(target)) * 100;

  if (deviationPct <= AGAME_THRESHOLD) return 'agame';
  if (deviationPct <= BGAME_THRESHOLD) return 'bgame';
  return 'cgame';
}

function getDeviationText(target, value) {
  const diff = value - target;
  const sign = diff >= 0 ? '+' : '';
  return `${sign}${diff.toFixed(1)}`;
}

function getGameLabel(game) {
  switch (game) {
    case 'agame': return { text: 'A-Game', emoji: '🟢', cls: 'agame' };
    case 'bgame': return { text: 'B-Game', emoji: '🟡', cls: 'bgame' };
    case 'cgame': return { text: 'C-Game', emoji: '🔴', cls: 'cgame' };
    default: return { text: '—', emoji: '', cls: '' };
  }
}

function getCategoryLabel(key) {
  const cat = STAT_CATEGORIES.find(c => c.key === key);
  return cat ? cat.label : '';
}

// ---- Manual Game Override ----
function cycleStatGame(id) {
  const stat = state.playerStats.find(s => s.id === id);
  if (!stat) return;

  const cycle = ['agame', 'bgame', 'cgame'];

  if (!stat.manualGame) {
    stat.manualGame = 'agame';
    stat.game = 'agame';
  } else {
    const currentIdx = cycle.indexOf(stat.manualGame);
    const nextIdx = currentIdx + 1;

    if (nextIdx >= cycle.length) {
      delete stat.manualGame;
      stat.game = classifyStat(stat.target, stat.value);
    } else {
      stat.manualGame = cycle[nextIdx];
      stat.game = cycle[nextIdx];
    }
  }

  saveState();
  renderStatsTable();
  renderStatsSummary();
}

// ---- Add Stat ----
function addNewStat() {
  const name = document.getElementById('new-stat-name')?.value.trim();
  const target = parseFloat(document.getElementById('new-stat-target')?.value);
  const value = parseFloat(document.getElementById('new-stat-value')?.value);
  const category = document.getElementById('new-stat-category')?.value || 'all';

  if (!name) { alert('Digite o nome da stat!'); return; }
  if (isNaN(target)) { alert('Digite o target ideal!'); return; }
  if (isNaN(value)) { alert('Digite o valor da sua stat!'); return; }

  const stat = {
    id: Date.now(),
    name,
    target,
    value,
    category,
    game: classifyStat(target, value),
    addedDate: getTodayKey(),
    history: [{ date: getTodayKey(), value }]
  };

  state.playerStats.push(stat);
  saveState();

  // Clear form
  document.getElementById('new-stat-name').value = '';
  document.getElementById('new-stat-target').value = '';
  document.getElementById('new-stat-value').value = '';
  document.getElementById('new-stat-category').value = '';

  renderCategoryChips();
  renderStatsTable();
  renderStatsSummary();
}

// ---- Update Stat Value ----
function updateStatValue(id, newValue) {
  const val = parseFloat(newValue);
  if (isNaN(val)) return;

  const stat = state.playerStats.find(s => s.id === id);
  if (!stat) return;

  stat.value = val;
  stat.game = classifyStat(stat.target, stat.value);

  const today = getTodayKey();
  const existingToday = stat.history.find(h => h.date === today);
  if (existingToday) {
    existingToday.value = val;
  } else {
    stat.history.push({ date: today, value: val });
  }

  saveState();
  renderStatsTable();
  renderStatsSummary();
}

// ---- Update Stat Target ----
function updateStatTarget(id, newTarget) {
  const val = parseFloat(newTarget);
  if (isNaN(val)) return;

  const stat = state.playerStats.find(s => s.id === id);
  if (!stat) return;

  stat.target = val;
  stat.game = classifyStat(stat.target, stat.value);
  saveState();
  renderStatsTable();
  renderStatsSummary();
}

// ---- Delete Stat ----
function deleteStat(id) {
  if (!confirm('Excluir esta stat?')) return;
  state.playerStats = state.playerStats.filter(s => s.id !== id);
  saveState();
  renderCategoryChips();
  renderStatsTable();
  renderStatsSummary();
}

// ---- Edit Stat Name ----
function editStatName(id) {
  const cell = document.getElementById('stat-name-' + id);
  const stat = state.playerStats.find(s => s.id === id);
  if (!cell || !stat) return;

  cell.innerHTML = `
      <input type="text" class="stat-inline-input stat-name-edit" id="stat-name-input-${id}" 
        value="${escapeHtml(stat.name)}" 
        onkeydown="if(event.key==='Enter') saveStatName(${id})">
      <button class="btn-icon" onclick="saveStatName(${id})" title="Salvar">✅</button>
    `;
  document.getElementById('stat-name-input-' + id).focus();
}

function saveStatName(id) {
  const input = document.getElementById('stat-name-input-' + id);
  if (!input) return;

  const newName = input.value.trim();
  if (!newName) { alert('O nome não pode ficar vazio!'); return; }

  const stat = state.playerStats.find(s => s.id === id);
  if (!stat) return;

  stat.name = newName;
  saveState();
  renderStatsTable();
}

// ---- Filter State (A/B/C Game) ----
let activeStatsFilter = null;

function filterStats(game) {
  if (activeStatsFilter === game) {
    activeStatsFilter = null;
  } else {
    activeStatsFilter = game;
  }
  renderStatsTable();
  renderStatsSummary();
}

// ---- Render Table ----
function renderStatsTable() {
  const tbody = document.getElementById('stats-tbody');
  if (!tbody) return;

  if (!state.playerStats || state.playerStats.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="empty-state">Nenhuma stat adicionada. Use o formulário abaixo para começar!</td></tr>';
    return;
  }

  // Filter by category
  let stats = [...state.playerStats];
  if (activeCategoryFilter && activeCategoryFilter !== 'all') {
    stats = stats.filter(s => s.category === activeCategoryFilter);
  }

  // Filter by game classification
  if (activeStatsFilter) {
    stats = stats.filter(s => s.game === activeStatsFilter);
  }

  // Sort by absolute deviation (biggest leak first)
  stats.sort((a, b) => {
    const devA = Math.abs(a.value - a.target);
    const devB = Math.abs(b.value - b.target);
    return devB - devA;
  });

  if (stats.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="empty-state">Nenhuma stat nessa categoria.</td></tr>';
    return;
  }

  tbody.innerHTML = stats.map(s => {
    const game = getGameLabel(s.game);
    const deviation = getDeviationText(s.target, s.value);
    const deviationClass = s.game;

    // Build category options
    const catOptions = STAT_CATEGORIES.filter(c => c.key !== 'all').map(c =>
      `<option value="${c.key}" ${s.category === c.key ? 'selected' : ''}>${c.label}</option>`
    ).join('');

    return `
      <tr class="stat-row-${s.game}">
        <td class="stat-cell-name" id="stat-name-${s.id}">
          ${escapeHtml(s.name)}
          <select class="stat-cat-inline" onchange="updateStatCategory(${s.id}, this.value)">
            <option value="all" ${!s.category || s.category === 'all' ? 'selected' : ''}>Sem categoria</option>
            ${catOptions}
          </select>
        </td>
        <td>
          <input type="number" class="stat-inline-input" value="${s.target}" step="0.1"
            onchange="updateStatTarget(${s.id}, this.value)">
        </td>
        <td>
          <input type="number" class="stat-inline-input stat-value-input ${s.game}" value="${s.value}" step="0.1"
            onchange="updateStatValue(${s.id}, this.value)">
        </td>
        <td class="stat-deviation ${deviationClass}">${deviation}</td>
        <td>
          <span class="game-badge ${game.cls} clickable-badge" onclick="cycleStatGame(${s.id})" title="Clique para mudar (${s.manualGame ? 'manual' : 'auto'})">
            ${game.emoji} ${game.text}${s.manualGame ? ' ✎' : ''}
          </span>
        </td>
        <td class="stat-actions">
          <button class="btn-icon" onclick="editStatName(${s.id})" title="Editar nome">✏️</button>
          <button class="btn-icon" onclick="deleteStat(${s.id})" title="Excluir">🗑️</button>
        </td>
      </tr>
    `;
  }).join('');
}

function updateStatCategory(id, category) {
  const stat = state.playerStats.find(s => s.id === id);
  if (!stat) return;
  stat.category = category;
  saveState();
  renderCategoryChips();
}

// ---- Summary Cards ----
function renderStatsSummary() {
  const container = document.getElementById('stats-summary');
  if (!container || !state.playerStats) return;

  const total = state.playerStats.length;
  const aCount = state.playerStats.filter(s => s.game === 'agame').length;
  const bCount = state.playerStats.filter(s => s.game === 'bgame').length;
  const cCount = state.playerStats.filter(s => s.game === 'cgame').length;

  const isActive = (g) => activeStatsFilter === g ? 'active' : '';

  container.innerHTML = `
    <div class="stat-summary-card clickable ${isActive(null)}" onclick="filterStats(null)">
      <div class="stat-summary-value">${total}</div>
      <div class="stat-summary-label">Total Stats</div>
    </div>
    <div class="stat-summary-card agame-card clickable ${isActive('agame')}" onclick="filterStats('agame')">
      <div class="stat-summary-value">${aCount}</div>
      <div class="stat-summary-label">🟢 A-Game</div>
    </div>
    <div class="stat-summary-card bgame-card clickable ${isActive('bgame')}" onclick="filterStats('bgame')">
      <div class="stat-summary-value">${bCount}</div>
      <div class="stat-summary-label">🟡 B-Game</div>
    </div>
    <div class="stat-summary-card cgame-card clickable ${isActive('cgame')}" onclick="filterStats('cgame')">
      <div class="stat-summary-value">${cCount}</div>
      <div class="stat-summary-label">🔴 C-Game</div>
    </div>
  `;
}
