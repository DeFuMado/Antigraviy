/* =====================================================
   APP.JS - Global State & Navigation
   ===================================================== */

// ---- State ----
const APP_STATE_KEY = 'downswing_recovery_state';

const state = {
  currentTab: 'session',
  sessions: [],
  tiltEpisodes: [],
  studyDays: {},
  spots: [],
  journal: [],
  config: {
    maxField: 100,
    maxTables: 6,
    logicPhrase: 'A variância é inevitável. Meu foco deve ser na qualidade das minhas decisões e em executar a estratégia correta.'
  },
  agameNotes: '',
  cgameNotes: '',
  playerStats: [],
  // Session state (volatile)
  sessionActive: false,
  sessionPhase: 'warmup', // warmup | focus | cooldown
  sessionStartTime: null,
  sessionPaused: false,
  markedHands: [],
  adherence: null
};

// ---- Persistence ----
function saveState() {
  const toSave = { ...state };
  // Don't persist volatile timer state
  delete toSave.sessionActive;
  delete toSave.sessionPhase;
  delete toSave.sessionStartTime;
  delete toSave.sessionPaused;
  delete toSave.markedHands;
  delete toSave.adherence;
  localStorage.setItem(APP_STATE_KEY, JSON.stringify(toSave));
}

function loadState() {
  const saved = localStorage.getItem(APP_STATE_KEY);
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      Object.assign(state, parsed);
    } catch (e) {
      console.error('Error loading state:', e);
    }
  }
}

// ---- Navigation ----
function switchTab(tabName) {
  state.currentTab = tabName;

  // Update tab buttons
  document.querySelectorAll('.nav-tab').forEach(t => {
    t.classList.toggle('active', t.dataset.tab === tabName);
  });

  // Update tab content
  document.querySelectorAll('.tab-content').forEach(c => {
    c.classList.remove('active');
  });
  const target = document.getElementById(tabName + '-tab');
  if (target) target.classList.add('active');

  // Refresh dashboard when switching to it
  if (tabName === 'dashboard' && typeof renderDashboard === 'function') {
    renderDashboard();
  }

  // Update tab badges
  if (typeof updateTabBadges === 'function') updateTabBadges();

  saveState();
}

// ---- Daily Progress ----
function updateDailyProgress() {
  const today = getTodayKey();
  let total = 0;
  let completed = 0;

  // Warm-up checks (5 items)
  const warmupChecks = document.querySelectorAll('.warmup-check');
  total += warmupChecks.length;
  warmupChecks.forEach(c => { if (c.checked) completed++; });

  // Study checks (5 items)  
  const studyChecks = document.querySelectorAll('.study-check');
  total += studyChecks.length;
  const todayStudy = state.studyDays[today];
  if (todayStudy) {
    studyChecks.forEach(c => {
      if (todayStudy.tasks && todayStudy.tasks[c.dataset.task]) {
        completed++;
      }
    });
  }

  // Session completed today?
  const todaySession = state.sessions.find(s => s.date === today);
  total += 1;
  if (todaySession) completed++;

  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;

  const bar = document.getElementById('progress-bar');
  const label = document.getElementById('progress-label');
  if (bar) bar.style.width = pct + '%';
  if (label) label.textContent = `Progresso Diário: ${pct}%`;
}

// ---- Utilities ----
function getTodayKey() {
  return new Date().toISOString().split('T')[0];
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' });
}

function formatTime(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function formatDuration(ms) {
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

// ---- Init ----
document.addEventListener('DOMContentLoaded', () => {
  loadState();

  // Set date display
  const dateDisplay = document.getElementById('date-display');
  if (dateDisplay) {
    dateDisplay.textContent = new Date().toLocaleDateString('pt-BR', {
      weekday: 'short',
      day: '2-digit',
      month: 'short'
    });
  }

  // Restore tab
  switchTab(state.currentTab || 'dashboard');

  // Init modules
  initDashboard();
  initSession();
  initTilt();
  initStats();
  initStudy();
  initSpots();
  initConfig();

  // Update progress & badges
  updateDailyProgress();
  if (typeof updateTabBadges === 'function') updateTabBadges();
});

// ---- Randomizer (Auto) ----
let randomizerInterval = null;
let floatingRandInterval = null;
let randomizerSpeed = 2000; // ms between changes

function setRandomNumber(numEl, barEl) {
  const num = Math.floor(Math.random() * 100) + 1;

  numEl.textContent = num;
  numEl.classList.add('pop');
  setTimeout(() => numEl.classList.remove('pop'), 200);

  // Update bar
  barEl.style.width = num + '%';

  // Color based on value
  if (num <= 33) {
    barEl.style.background = 'linear-gradient(90deg, #10b981, #34d399)';
    barEl.style.boxShadow = '0 0 12px rgba(16, 185, 129, 0.4)';
  } else if (num <= 66) {
    barEl.style.background = 'linear-gradient(90deg, #f59e0b, #fbbf24)';
    barEl.style.boxShadow = '0 0 12px rgba(245, 158, 11, 0.4)';
  } else {
    barEl.style.background = 'linear-gradient(90deg, #ef4444, #f87171)';
    barEl.style.boxShadow = '0 0 12px rgba(239, 68, 68, 0.4)';
  }
}

// In-session randomizer
function toggleRandomizer() {
  const numEl = document.getElementById('randomizer-number');
  const barEl = document.getElementById('randomizer-bar-fill');
  const btn = document.getElementById('randomize-btn');
  if (!numEl || !barEl) return;

  if (randomizerInterval) {
    clearInterval(randomizerInterval);
    randomizerInterval = null;
    btn.textContent = '▶️ Iniciar Randomizador';
    btn.classList.remove('active-rand');
  } else {
    setRandomNumber(numEl, barEl);
    randomizerInterval = setInterval(() => setRandomNumber(numEl, barEl), randomizerSpeed);
    btn.textContent = '⏸️ Pausar Randomizador';
    btn.classList.add('active-rand');
  }
}

function randomize() {
  toggleRandomizer();
}

function updateRandomizerSpeed(ms) {
  randomizerSpeed = ms;
  // Restart if running
  if (randomizerInterval) {
    const numEl = document.getElementById('randomizer-number');
    const barEl = document.getElementById('randomizer-bar-fill');
    clearInterval(randomizerInterval);
    randomizerInterval = setInterval(() => setRandomNumber(numEl, barEl), randomizerSpeed);
  }
  // Floating too
  if (floatingRandInterval) {
    const numEl = document.getElementById('floating-random-number');
    const barEl = document.getElementById('floating-random-bar');
    clearInterval(floatingRandInterval);
    floatingRandInterval = setInterval(() => setRandomNumber(numEl, barEl), randomizerSpeed);
  }
}

// Floating randomizer  
function toggleFloatingRandomizer() {
  const panel = document.getElementById('floating-randomizer-panel');
  if (!panel) return;

  const isHidden = panel.classList.contains('hidden');
  panel.classList.toggle('hidden');

  const numEl = document.getElementById('floating-random-number');
  const barEl = document.getElementById('floating-random-bar');

  if (isHidden) {
    // Opening — auto-start
    if (!floatingRandInterval && numEl && barEl) {
      setRandomNumber(numEl, barEl);
      floatingRandInterval = setInterval(() => setRandomNumber(numEl, barEl), randomizerSpeed);
    }
  } else {
    // Closing — stop
    if (floatingRandInterval) {
      clearInterval(floatingRandInterval);
      floatingRandInterval = null;
    }
  }
}

function toggleFloatingRand() {
  const numEl = document.getElementById('floating-random-number');
  const barEl = document.getElementById('floating-random-bar');
  const btn = document.getElementById('floating-rand-toggle');
  if (!numEl || !barEl) return;

  if (floatingRandInterval) {
    clearInterval(floatingRandInterval);
    floatingRandInterval = null;
    if (btn) btn.textContent = '▶️ Retomar';
  } else {
    setRandomNumber(numEl, barEl);
    floatingRandInterval = setInterval(() => setRandomNumber(numEl, barEl), randomizerSpeed);
    if (btn) btn.textContent = '⏸️ Pausar';
  }
}

function setFloatingSpeed(val) {
  randomizerSpeed = parseInt(val);
  updateRandomizerSpeed(randomizerSpeed);
}

// ---- Theme Toggle ----
function toggleTheme() {
  const html = document.documentElement;
  const current = html.getAttribute('data-theme');
  const next = current === 'light' ? 'dark' : 'light';
  html.setAttribute('data-theme', next);
  localStorage.setItem('antigraviy-theme', next);

  const btn = document.getElementById('theme-toggle');
  if (btn) btn.textContent = next === 'light' ? '🌙' : '☀️';
}

// Restore theme on load
(function () {
  const saved = localStorage.getItem('antigraviy-theme');
  if (saved === 'light') {
    document.documentElement.setAttribute('data-theme', 'light');
  }
})();

// ---- Subtle Audio Cues ----
let audioCtx = null;

function playTick(freq = 880, duration = 0.08) {
  // Check if sound is muted
  if (state.config.soundMuted) return;

  try {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.type = 'sine';
    osc.frequency.value = freq;
    gain.gain.value = 0.05; // Very subtle
    osc.start();
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
    osc.stop(audioCtx.currentTime + duration);
  } catch (e) {
    // Audio not supported, ignore
  }
}

function toggleSound() {
  state.config.soundMuted = !state.config.soundMuted;
  saveState();
  const btn = document.getElementById('sound-toggle');
  if (btn) btn.textContent = state.config.soundMuted ? '🔇' : '🔊';
}
