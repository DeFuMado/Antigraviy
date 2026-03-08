/* =====================================================
   TILT.JS - Tilt Management Module
   ===================================================== */

let breathingInterval = null;
let breathingActive = false;

function initTilt() {
    // Restore logic phrase on tilt page
    const mantra = document.getElementById('tilt-mantra');
    if (mantra && state.config.logicPhrase) {
        mantra.textContent = `"${state.config.logicPhrase}"`;
    }

    // Setup tilt sign listeners
    document.querySelectorAll('.tilt-check').forEach(check => {
        check.addEventListener('change', checkTiltSigns);
    });

    renderTiltHistory();
}

// ---- Tilt Signs ----
function checkTiltSigns() {
    const checks = document.querySelectorAll('.tilt-check');
    const checked = Array.from(checks).filter(c => c.checked).length;

    const warning = document.getElementById('tilt-warning');
    if (warning) {
        if (checked >= 2) {
            warning.classList.remove('hidden');
        } else {
            warning.classList.add('hidden');
        }
    }
}

// ---- Breathing Exercise ----
function startBreathing() {
    if (breathingActive) {
        stopBreathing();
        return;
    }

    breathingActive = true;
    const circle = document.getElementById('breath-circle');
    const text = document.getElementById('breath-text');
    const btn = document.getElementById('breath-btn');

    btn.textContent = '⏹️ Parar';

    let phase = 'inhale';
    let cycles = 0;
    const maxCycles = 5;

    function breathCycle() {
        if (!breathingActive || cycles >= maxCycles) {
            stopBreathing();
            return;
        }

        if (phase === 'inhale') {
            circle.className = 'breath-circle inhale';
            text.textContent = 'Inspire...';
            phase = 'hold';
            setTimeout(breathCycle, 4000);
        } else if (phase === 'hold') {
            text.textContent = 'Segure...';
            phase = 'exhale';
            setTimeout(breathCycle, 2000);
        } else {
            circle.className = 'breath-circle exhale';
            text.textContent = 'Expire...';
            phase = 'inhale';
            cycles++;
            setTimeout(breathCycle, 4000);
        }
    }

    breathCycle();
}

function stopBreathing() {
    breathingActive = false;
    const circle = document.getElementById('breath-circle');
    const text = document.getElementById('breath-text');
    const btn = document.getElementById('breath-btn');

    circle.className = 'breath-circle';
    text.textContent = 'Iniciar';
    btn.textContent = '▶️ Começar Respiração';
}

// ---- Log Tilt Episode ----
function logTiltEpisode() {
    const checks = document.querySelectorAll('.tilt-check');
    const checkedSigns = [];
    const labels = [
        'Irritação com bad beats',
        'Jogando muitas mãos (loose demais)',
        'Fazendo calls ruins por frustração',
        'Over-bluffing por raiva',
        'Pensamento: "preciso recuperar"',
        'Coração acelerado / tensão no corpo',
        'Subindo de stake para "recuperar"'
    ];

    checks.forEach((c, i) => {
        if (c.checked) checkedSigns.push(labels[i]);
    });

    if (checkedSigns.length === 0) {
        alert('Nenhum sinal de tilt marcado.');
        return;
    }

    const episode = {
        id: Date.now(),
        date: getTodayKey(),
        timestamp: new Date().toISOString(),
        signs: checkedSigns,
        signCount: checkedSigns.length
    };

    state.tiltEpisodes.push(episode);
    saveState();

    // Reset checkboxes
    checks.forEach(c => c.checked = false);
    document.getElementById('tilt-warning').classList.add('hidden');

    renderTiltHistory();
    alert('📝 Episódio de tilt registrado. Faça a respiração e releia a frase de lógica.');
}

// ---- Tilt History ----
function renderTiltHistory() {
    const container = document.getElementById('tilt-history');
    if (!container) return;

    if (state.tiltEpisodes.length === 0) {
        container.innerHTML = '<p class="empty-state">Nenhum episódio registrado.</p>';
        return;
    }

    const sorted = [...state.tiltEpisodes].reverse();
    container.innerHTML = sorted.map(ep => {
        const severityClass = ep.signCount >= 4 ? 'danger' : ep.signCount >= 2 ? 'warning' : 'info';
        return `
      <div class="history-item">
        <div class="history-date">${formatDate(ep.date)}<br>${formatTime(ep.timestamp)}</div>
        <div class="history-content">
          <div class="history-title">${ep.signCount} sinais de tilt</div>
          <div class="history-detail">${ep.signs.join(', ')}</div>
          <div class="history-badges">
            <span class="badge badge-${severityClass}">Severidade: ${ep.signCount}/7</span>
          </div>
        </div>
      </div>
    `;
    }).join('');
}
