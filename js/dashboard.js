/* =====================================================
   DASHBOARD.JS - Home Dashboard Module
   ===================================================== */

// ---- Tab Badge Notifications ----
function updateTabBadges() {
    const due = countDueCards();
    const spotsTab = document.querySelector('.nav-tab[data-tab="spots"]');
    if (!spotsTab) return;

    let badge = spotsTab.querySelector('.tab-badge');
    if (due > 0) {
        if (!badge) {
            badge = document.createElement('span');
            badge.className = 'tab-badge';
            spotsTab.style.position = 'relative';
            spotsTab.appendChild(badge);
        }
        badge.textContent = due;
    } else if (badge) {
        badge.remove();
    }
}

function initDashboard() {
    renderDashboard();
}

function renderDashboard() {
    // Streak
    const streak = calcStreak();
    const streakEl = document.getElementById('dash-streak');
    if (streakEl) streakEl.textContent = streak;

    // Average Decision Quality (last 7 sessions)
    const avgQ = calcAvgQuality(7);
    const avgQEl = document.getElementById('dash-avg-quality');
    if (avgQEl) {
        avgQEl.textContent = avgQ > 0 ? avgQ.toFixed(1) : '—';
        avgQEl.className = 'dash-metric-value ' +
            (avgQ >= 8 ? 'metric-success' : avgQ >= 5 ? 'metric-warning' : avgQ > 0 ? 'metric-danger' : '');
    }

    // Tilt episodes this week
    const tiltCount = calcTiltThisWeek();
    const tiltEl = document.getElementById('dash-tilt-count');
    if (tiltEl) {
        tiltEl.textContent = tiltCount;
        tiltEl.className = 'dash-metric-value ' +
            (tiltCount === 0 ? 'metric-success' : tiltCount <= 2 ? 'metric-warning' : 'metric-danger');
    }

    // Flashcards due
    const dueCount = countDueCards();
    const dueEl = document.getElementById('dash-due-cards');
    if (dueEl) {
        dueEl.textContent = dueCount;
        dueEl.className = 'dash-metric-value ' +
            (dueCount === 0 ? 'metric-success' : 'metric-accent');
    }

    // Total sessions
    const totalSessions = state.sessions.length;
    const totalEl = document.getElementById('dash-total-sessions');
    if (totalEl) totalEl.textContent = totalSessions;

    // Total study hours (approximation from sessions)
    const totalHours = calcTotalGrindHours();
    const hoursEl = document.getElementById('dash-grind-hours');
    if (hoursEl) hoursEl.textContent = totalHours.toFixed(0) + 'h';

    // Sparklines
    renderQualitySparkline();
    renderSessionSparkline();

    // Badges
    renderBadges();
}

// ---- Streak Calculator ----
function calcStreak() {
    // Count consecutive days with at least 1 session, going back from yesterday
    // (today may be in progress)
    let streak = 0;
    const today = new Date();

    // Check if today has a session — if so, include it
    const todayKey = getTodayKey();
    const hasTodaySession = state.sessions.some(s => s.date === todayKey);

    // Start from today if session exists, otherwise from yesterday
    let checkDate = new Date(today);
    if (!hasTodaySession) {
        checkDate.setDate(checkDate.getDate() - 1);
    }

    for (let i = 0; i < 365; i++) {
        const key = checkDate.toISOString().split('T')[0];
        const hasSession = state.sessions.some(s => s.date === key);
        if (hasSession) {
            streak++;
            checkDate.setDate(checkDate.getDate() - 1);
        } else {
            break;
        }
    }

    return streak;
}

// ---- Average Decision Quality ----
function calcAvgQuality(n) {
    if (state.sessions.length === 0) return 0;
    const recent = [...state.sessions].sort((a, b) =>
        new Date(b.timestamp) - new Date(a.timestamp)
    ).slice(0, n);
    const sum = recent.reduce((acc, s) => acc + (s.decisionQuality || 0), 0);
    return sum / recent.length;
}

// ---- Tilt This Week ----
function calcTiltThisWeek() {
    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay()); // Sunday
    startOfWeek.setHours(0, 0, 0, 0);

    return state.tiltEpisodes.filter(ep => {
        const epDate = new Date(ep.timestamp || ep.date);
        return epDate >= startOfWeek;
    }).length;
}

// ---- Due Flashcards ----
function countDueCards() {
    const today = getTodayKey();
    return (state.spots || []).filter(s => {
        if (!s.review) return true;
        return s.review.nextReview <= today;
    }).length;
}

// ---- Total Grind Hours ----
function calcTotalGrindHours() {
    return state.sessions.reduce((acc, s) => acc + (s.duration || 0), 0) / (1000 * 60 * 60);
}

// ---- Sparklines (pure CSS bar charts) ----
function renderQualitySparkline() {
    const container = document.getElementById('dash-quality-spark');
    if (!container) return;

    const recent = [...state.sessions]
        .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
        .slice(-14);

    if (recent.length < 2) {
        container.innerHTML = '<span class="spark-empty">Dados insuficientes</span>';
        return;
    }

    container.innerHTML = recent.map(s => {
        const pct = ((s.decisionQuality || 0) / 10) * 100;
        const color = s.decisionQuality >= 8 ? 'var(--color-success)' :
            s.decisionQuality >= 5 ? 'var(--color-warning)' : 'var(--color-danger)';
        return `<div class="spark-bar" style="height:${pct}%;background:${color}" title="${formatDate(s.date)}: ${s.decisionQuality}/10"></div>`;
    }).join('');
}

function renderSessionSparkline() {
    const container = document.getElementById('dash-session-spark');
    if (!container) return;

    // Group sessions by date, count per day (last 14 days)
    const dayMap = {};
    const now = new Date();
    for (let i = 13; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(d.getDate() - i);
        dayMap[d.toISOString().split('T')[0]] = 0;
    }

    state.sessions.forEach(s => {
        if (dayMap[s.date] !== undefined) dayMap[s.date]++;
    });

    const days = Object.entries(dayMap);
    const maxCount = Math.max(...days.map(d => d[1]), 1);

    container.innerHTML = days.map(([date, count]) => {
        const pct = (count / maxCount) * 100;
        const today = date === getTodayKey();
        return `<div class="spark-bar ${today ? 'spark-today' : ''} ${count === 0 ? 'spark-zero' : ''}" style="height:${Math.max(pct, 4)}%;${count > 0 ? 'background:var(--accent-secondary)' : ''}" title="${formatDate(date)}: ${count} sessões"></div>`;
    }).join('');
}

// ---- Badges / Gamification ----
const BADGE_DEFS = [
    { id: 'streak3', icon: '🔥', label: '3 dias seguidos', desc: 'Streak de 3 dias', check: () => calcStreak() >= 3 },
    { id: 'streak7', icon: '🔥🔥', label: '7 dias seguidos', desc: 'Streak de 7 dias', check: () => calcStreak() >= 7 },
    { id: 'streak14', icon: '🔥🔥🔥', label: '14 dias seguidos', desc: 'Streak de 14 dias!', check: () => calcStreak() >= 14 },
    { id: 'streak30', icon: '💎', label: '30 dias seguidos', desc: 'Streak lendário!', check: () => calcStreak() >= 30 },
    { id: 'quality10', icon: '🏆', label: '10x Qualidade ≥8', desc: '10 sessões com decisão ≥8', check: () => state.sessions.filter(s => s.decisionQuality >= 8).length >= 10 },
    { id: 'quality25', icon: '👑', label: '25x Qualidade ≥8', desc: '25 sessões top!', check: () => state.sessions.filter(s => s.decisionQuality >= 8).length >= 25 },
    { id: 'spots10', icon: '🔍', label: '10 spots salvos', desc: 'Biblioteca crescendo', check: () => (state.spots || []).length >= 10 },
    { id: 'spots25', icon: '📚', label: '25 spots salvos', desc: 'Coleção robusta!', check: () => (state.spots || []).length >= 25 },
    { id: 'sessions25', icon: '🎮', label: '25 sessões', desc: 'Grinder dedicado', check: () => state.sessions.length >= 25 },
    { id: 'sessions50', icon: '⚡', label: '50 sessões', desc: 'Grinder elite', check: () => state.sessions.length >= 50 },
    { id: 'sessions100', icon: '🐉', label: '100 sessões', desc: 'Grinder lendário!', check: () => state.sessions.length >= 100 },
    { id: 'notilt', icon: '🧊', label: '0 tilts na semana', desc: 'Controle mental', check: () => calcTiltThisWeek() === 0 && state.sessions.some(s => s.date === getTodayKey()) },
    { id: 'hours50', icon: '⏱️', label: '50h grindadas', desc: '50 horas de volume', check: () => calcTotalGrindHours() >= 50 },
    { id: 'hours100', icon: '💪', label: '100h grindadas', desc: '100 horas de dedicação!', check: () => calcTotalGrindHours() >= 100 },
];

function renderBadges() {
    const container = document.getElementById('dash-badges');
    if (!container) return;

    const html = BADGE_DEFS.map(badge => {
        const unlocked = badge.check();
        return `<div class="dash-badge ${unlocked ? 'unlocked' : 'locked'}" title="${badge.desc}">
            <span class="badge-icon">${badge.icon}</span>
            <span class="badge-label">${badge.label}</span>
        </div>`;
    }).join('');

    container.innerHTML = html;
}
