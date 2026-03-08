/* =====================================================
   SESSION.JS - Grind Workflow (Warm-Up → Focus → Cool-Down)
   ===================================================== */

let sessionTimerInterval = null;
let sessionElapsed = 0;
let sessionGoalMinutes = 0;
let sessionGoalReached = false;

// ---- Dynamic Phrase System ----
const PHRASES = {
    automatico: {
        label: '🔥 Quebrando o Automático',
        phrases: [
            'Se eu não luto por potes desconhecidos, fico estagnado no jogo padrão. O crescimento técnico só existe fora da zona de conforto.',
            'O vilão está jogando no automático. Minha vantagem (edge) nasce no momento em que eu penso criativamente e o obrigo a pensar também.',
            'Ganhar apenas os potes que eu "já sei como ganhar" não me evolui. Devo buscar ativamente potes novos para criar o hábito de vencer em qualquer situação.'
        ]
    },
    intencao: {
        label: '🎯 Intenção e Agressividade',
        phrases: [
            'Mude a pergunta padrão. Não entre na mão para ver o que acontece. Entre perguntando: "Como posso fazer para ganhar este pote agora?"',
            'A maioria dos vilões não está disposta a brigar pelo pote. Minha intenção clara de vencer é uma arma; ela me faz ganhar fichas que a passividade perderia.',
            'A correnteza é mais forte nos blinds. É onde a atenção deve dobrar e a criatividade deve superar o jogo robótico.'
        ]
    },
    esforco: {
        label: '💪 Esforço Cognitivo',
        phrases: [
            'Pensar em cada size e cada street vai me deixar exausto hoje, mas é o que tornará meu jogo leve e lucrativo amanhã.',
            'Qualidade supera quantidade. Se for preciso jogar menos telas para pensar em cada detalhe de cada pote, eu farei. O foco gera o lucro.',
            'O cansaço mental é o sinal de que estou trabalhando corretamente. Estou construindo a intuição que me fará ganhar mais no futuro.'
        ]
    }
};

const MANTRAS = [
    'Onde o vilão reage, eu crio.',
    'Não aceite o check. Pergunte: Como eu ganho isso?',
    'Potes novos criam hábitos novos.',
    'Saia do automático. Explore sizes. Explore streets.',
    'O esforço de hoje é o easy game de amanhã.'
];

let currentPhraseCategory = 'intencao';
let currentPhraseIdx = 0;
let currentMantraIdx = 0;
let phraseReminderInterval = null;

// Merge hardcoded + custom phrases for a category
function getPhrasesForCategory(cat) {
    const base = PHRASES[cat] ? [...PHRASES[cat].phrases] : [];
    const custom = (state.config.customPhrases && state.config.customPhrases[cat]) || [];
    return [...base, ...custom];
}

// Merge hardcoded + custom mantras
function getMantras() {
    const custom = state.config.customMantras || [];
    return [...MANTRAS, ...custom];
}

function getPhaseCategory() {
    if (!state.sessionActive) return 'intencao';
    if (state.sessionPhase === 'warmup') return 'intencao';
    if (state.sessionPhase === 'focus') return 'automatico';
    if (state.sessionPhase === 'cooldown') return 'esforco';
    return 'intencao';
}

function updatePhraseForPhase() {
    const cat = getPhaseCategory();
    currentPhraseCategory = cat;
    currentPhraseIdx = 0;
    showCurrentPhrase();
}

function showCurrentPhrase() {
    const merged = getPhrasesForCategory(currentPhraseCategory);
    if (!merged.length) return;

    const catData = PHRASES[currentPhraseCategory];
    const phraseEl = document.getElementById('logic-phrase');
    const catEl = document.getElementById('phrase-category');

    if (catEl && catData) catEl.textContent = catData.label;
    if (phraseEl) {
        phraseEl.style.opacity = '0';
        setTimeout(() => {
            phraseEl.textContent = `"${merged[currentPhraseIdx % merged.length]}"`;
            phraseEl.style.opacity = '1';
        }, 200);
    }
}

function cyclePhrase() {
    const merged = getPhrasesForCategory(currentPhraseCategory);
    if (!merged.length) return;
    currentPhraseIdx = (currentPhraseIdx + 1) % merged.length;
    showCurrentPhrase();
    if (typeof playTick === 'function') playTick(660, 0.06);
}

function cycleMantra() {
    const allMantras = getMantras();
    currentMantraIdx = (currentMantraIdx + 1) % allMantras.length;
    const el = document.getElementById('mantra-text');
    if (el) {
        el.style.opacity = '0';
        setTimeout(() => {
            el.textContent = allMantras[currentMantraIdx];
            el.style.opacity = '1';
        }, 200);
    }
    if (typeof playTick === 'function') playTick(440, 0.06);
}

// ---- Custom Phrase Management ----
function addCustomPhrase() {
    const catSelect = document.getElementById('custom-phrase-category');
    const textInput = document.getElementById('custom-phrase-text');
    if (!catSelect || !textInput) return;

    const cat = catSelect.value;
    const text = textInput.value.trim();
    if (!text) { alert('Escreva uma frase!'); return; }

    if (!state.config.customPhrases) state.config.customPhrases = {};
    if (!state.config.customPhrases[cat]) state.config.customPhrases[cat] = [];

    state.config.customPhrases[cat].push(text);
    textInput.value = '';
    saveState();
    renderCustomPhrases();
}

function deleteCustomPhrase(cat, idx) {
    if (!state.config.customPhrases || !state.config.customPhrases[cat]) return;
    state.config.customPhrases[cat].splice(idx, 1);
    saveState();
    renderCustomPhrases();
}

function addCustomMantra() {
    const input = document.getElementById('custom-phrase-text');
    if (!input) return;
    const text = input.value.trim();
    if (!text) { alert('Escreva um mantra!'); return; }

    if (!state.config.customMantras) state.config.customMantras = [];
    state.config.customMantras.push(text);
    input.value = '';
    saveState();
    renderCustomPhrases();
}

function deleteCustomMantra(idx) {
    if (!state.config.customMantras) return;
    state.config.customMantras.splice(idx, 1);
    saveState();
    renderCustomPhrases();
}

function renderCustomPhrases() {
    const container = document.getElementById('custom-phrases-list');
    if (!container) return;

    const catLabels = {
        automatico: '🔥 Quebrando o Automático',
        intencao: '🎯 Intenção e Agressividade',
        esforco: '💪 Esforço Cognitivo'
    };

    let html = '';

    // Custom phrases by category
    const customPhrases = state.config.customPhrases || {};
    Object.keys(catLabels).forEach(cat => {
        const phrases = customPhrases[cat] || [];
        if (phrases.length === 0) return;

        html += `<div class="custom-phrase-group">
            <h5 class="custom-phrase-cat">${catLabels[cat]}</h5>`;
        phrases.forEach((p, i) => {
            html += `<div class="custom-phrase-item">
                <span class="custom-phrase-text">"${escapeHtml(p)}"</span>
                <button class="btn-icon custom-phrase-del" onclick="deleteCustomPhrase('${cat}', ${i})" title="Remover">🗑️</button>
            </div>`;
        });
        html += `</div>`;
    });

    // Custom mantras
    const customMantras = state.config.customMantras || [];
    if (customMantras.length > 0) {
        html += `<div class="custom-phrase-group">
            <h5 class="custom-phrase-cat">⚡ Mantras Personalizados</h5>`;
        customMantras.forEach((m, i) => {
            html += `<div class="custom-phrase-item">
                <span class="custom-phrase-text">"${escapeHtml(m)}"</span>
                <button class="btn-icon custom-phrase-del" onclick="deleteCustomMantra(${i})" title="Remover">🗑️</button>
            </div>`;
        });
        html += `</div>`;
    }

    if (!html) {
        html = '<p class="empty-state">Nenhuma frase personalizada ainda. Adicione acima!</p>';
    }

    container.innerHTML = html;

    // Update total count
    const totalCustom = Object.values(customPhrases).reduce((sum, arr) => sum + arr.length, 0) + customMantras.length;
    const totalBase = Object.values(PHRASES).reduce((sum, c) => sum + c.phrases.length, 0) + MANTRAS.length;
    const countEl = document.getElementById('phrase-total-count');
    if (countEl) countEl.textContent = `${totalBase + totalCustom} frases (${totalBase} base + ${totalCustom} custom)`;
}

function startPhraseReminder() {
    clearInterval(phraseReminderInterval);
    // Cycle phrase every 30 minutes during focus
    phraseReminderInterval = setInterval(() => {
        if (state.sessionPhase === 'focus' && !state.sessionPaused) {
            cyclePhrase();
            // Brief flash effect
            const banner = document.getElementById('logic-banner');
            if (banner) {
                banner.classList.add('phrase-flash');
                setTimeout(() => banner.classList.remove('phrase-flash'), 1500);
            }
        }
    }, 30 * 60 * 1000); // 30 min
}

function stopPhraseReminder() {
    clearInterval(phraseReminderInterval);
}

function initSession() {
    // Initialize phrase system
    updatePhraseForPhase();
    showCurrentPhrase();

    // Show random mantra
    currentMantraIdx = Math.floor(Math.random() * MANTRAS.length);
    const mantraEl = document.getElementById('mantra-text');
    if (mantraEl) mantraEl.textContent = MANTRAS[currentMantraIdx];

    // Auto-rotate phrases every 20s and mantras every 12s
    startAutoRotation();

    // Render session history
    renderSessionHistory();
}

let phraseAutoInterval = null;
let mantraAutoInterval = null;

function startAutoRotation() {
    clearInterval(phraseAutoInterval);
    clearInterval(mantraAutoInterval);

    phraseAutoInterval = setInterval(() => cyclePhrase(), 5 * 60 * 1000);  // 5 min
    mantraAutoInterval = setInterval(() => cycleMantra(), 2 * 60 * 1000);  // 2 min
}

// ---- Warm-Up ----
function updateWarmup() {
    const checks = document.querySelectorAll('.warmup-check');
    const allChecked = Array.from(checks).every(c => c.checked);

    const btn = document.getElementById('start-session-btn');
    if (btn) {
        btn.disabled = !allChecked;
        btn.textContent = allChecked
            ? '🚀 Iniciar Sessão'
            : `🔒 Complete o Warm-Up (${Array.from(checks).filter(c => c.checked).length}/${checks.length})`;
    }

    const status = document.getElementById('warmup-status');
    if (status) {
        if (allChecked) {
            status.textContent = '✅ Pronto';
            status.style.color = 'var(--color-success)';
        } else {
            status.textContent = `${Array.from(checks).filter(c => c.checked).length}/${checks.length}`;
        }
    }

    updateDailyProgress();
}

// ---- Start Session ----
function startSession() {
    const checks = document.querySelectorAll('.warmup-check');
    if (!Array.from(checks).every(c => c.checked)) return;

    state.sessionActive = true;
    state.sessionPhase = 'focus';
    state.sessionStartTime = Date.now();
    state.sessionPaused = false;
    state.markedHands = [];
    sessionElapsed = 0;
    sessionGoalReached = false;

    // Get session goal from warm-up dropdown
    const goalSelect = document.getElementById('session-goal');
    sessionGoalMinutes = goalSelect ? parseInt(goalSelect.value) || 0 : 0;

    // Update UI: Lock warmup, unlock focus
    const warmup = document.getElementById('phase-warmup');
    const focus = document.getElementById('phase-focus');
    const cooldown = document.getElementById('phase-cooldown');

    warmup.classList.add('completed');
    warmup.classList.remove('active-phase');
    document.getElementById('warmup-body').classList.add('hidden');
    document.getElementById('warmup-status').textContent = '✅ Completo';

    focus.classList.remove('locked');
    focus.classList.add('active-phase');
    document.getElementById('focus-body').classList.remove('hidden');
    document.getElementById('focus-status').textContent = '🎮 Em Andamento';
    document.getElementById('focus-status').style.color = 'var(--color-success)';

    cooldown.classList.add('locked');

    // Start timer
    startTimer();

    // Switch to "Breaking Automatic" phrases
    updatePhraseForPhase();
    startPhraseReminder();
}

function startTimer() {
    sessionTimerInterval = setInterval(() => {
        if (!state.sessionPaused) {
            sessionElapsed = Date.now() - state.sessionStartTime;
            const timerEl = document.getElementById('session-timer');
            if (timerEl) {
                timerEl.textContent = formatDuration(sessionElapsed);

                // Check session goal
                if (sessionGoalMinutes > 0) {
                    const elapsedMinutes = sessionElapsed / 60000;
                    if (elapsedMinutes >= sessionGoalMinutes && !sessionGoalReached) {
                        sessionGoalReached = true;
                        timerEl.classList.add('goal-reached');
                    }
                }
            }
        }
    }, 1000);
}

function togglePause() {
    state.sessionPaused = !state.sessionPaused;
    const btn = document.getElementById('pause-btn');
    if (btn) {
        btn.textContent = state.sessionPaused ? '▶️ Continuar' : '⏸️ Pausar';
    }
}

// ---- End Session → Open Cool-Down ----
function endSession() {
    if (!confirm('Encerrar a sessão e ir para o Cool-Down?')) return;

    clearInterval(sessionTimerInterval);
    state.sessionPhase = 'cooldown';

    // Update UI
    const focus = document.getElementById('phase-focus');
    const cooldown = document.getElementById('phase-cooldown');

    focus.classList.add('completed');
    focus.classList.remove('active-phase');
    document.getElementById('focus-body').classList.add('hidden');
    document.getElementById('focus-status').textContent = '✅ Completo';

    cooldown.classList.remove('locked');
    cooldown.classList.add('active-phase');
    document.getElementById('cooldown-body').classList.remove('hidden');
    document.getElementById('cooldown-status').textContent = '📝 Avaliando';
    document.getElementById('cooldown-status').style.color = 'var(--color-info)';

    // Switch to "Cognitive Effort" phrases
    updatePhraseForPhase();
    stopPhraseReminder();
}

// ---- Hand Marking ----
function markHand() {
    const note = document.getElementById('hand-note');
    if (!note || !note.value.trim()) return;

    state.markedHands.push({
        text: note.value.trim(),
        time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    });

    note.value = '';
    renderMarkedHands();
}

function renderMarkedHands() {
    const container = document.getElementById('marked-hands-list');
    if (!container) return;

    container.innerHTML = state.markedHands.map((h, i) => `
    <div class="marked-hand">
      <span>📌 ${escapeHtml(h.text)}</span>
      <span class="hand-time">${h.time}</span>
    </div>
  `).join('');
}

// ---- Cool-Down ----
function updateRatingDisplay() {
    const slider = document.getElementById('decision-quality');
    const display = document.getElementById('rating-value');
    if (slider && display) {
        display.textContent = slider.value;
        // Color based on value
        const v = parseInt(slider.value);
        if (v >= 8) display.style.color = 'var(--color-success)';
        else if (v >= 5) display.style.color = 'var(--color-warning)';
        else display.style.color = 'var(--color-danger)';
    }
}

function setAdherence(value) {
    state.adherence = value;
    document.querySelectorAll('.adherence-btn').forEach(btn => {
        btn.classList.toggle('selected', btn.dataset.value === value);
    });
}

function saveCooldown() {
    const quality = parseInt(document.getElementById('decision-quality').value);
    const notes = document.getElementById('session-notes')?.value || '';

    if (!state.adherence) {
        alert('Selecione se conseguiu seguir o plano!');
        return;
    }

    const session = {
        id: Date.now(),
        date: getTodayKey(),
        timestamp: new Date().toISOString(),
        duration: sessionElapsed,
        decisionQuality: quality,
        adherence: state.adherence,
        notes: notes,
        markedHands: [...state.markedHands]
    };

    state.sessions.push(session);
    saveState();

    // Reset session UI
    resetSessionUI();
    renderSessionHistory();
    updateDailyProgress();

    alert('✅ Sessão salva com sucesso!');
}

function resetSessionUI() {
    state.sessionActive = false;
    state.sessionPhase = 'warmup';
    state.markedHands = [];
    state.adherence = null;

    // Reset checkboxes
    document.querySelectorAll('.warmup-check').forEach(c => c.checked = false);

    // Reset phases
    const warmup = document.getElementById('phase-warmup');
    const focus = document.getElementById('phase-focus');
    const cooldown = document.getElementById('phase-cooldown');

    warmup.classList.remove('completed', 'active-phase');
    document.getElementById('warmup-body').classList.remove('hidden');
    document.getElementById('warmup-status').textContent = 'Pendente';
    document.getElementById('warmup-status').style.color = '';

    focus.classList.add('locked');
    focus.classList.remove('completed', 'active-phase');
    document.getElementById('focus-body').classList.add('hidden');
    document.getElementById('focus-status').textContent = '🔒 Bloqueado';
    document.getElementById('focus-status').style.color = '';

    cooldown.classList.add('locked');
    cooldown.classList.remove('completed', 'active-phase');
    document.getElementById('cooldown-body').classList.add('hidden');
    document.getElementById('cooldown-status').textContent = '🔒 Bloqueado';
    document.getElementById('cooldown-status').style.color = '';

    // Reset form
    document.getElementById('start-session-btn').disabled = true;
    document.getElementById('start-session-btn').textContent = '🔒 Complete o Warm-Up para iniciar';
    document.getElementById('session-timer').textContent = '00:00:00';
    document.getElementById('decision-quality').value = 5;
    document.getElementById('rating-value').textContent = '5';
    document.getElementById('rating-value').style.color = '';
    document.getElementById('session-notes').value = '';
    document.getElementById('marked-hands-list').innerHTML = '';
    document.querySelectorAll('.adherence-btn').forEach(b => b.classList.remove('selected'));

    // Reset phrases to Intention category
    updatePhraseForPhase();
}

// ---- Session History ----
function renderSessionHistory() {
    const container = document.getElementById('session-history');
    if (!container) return;

    // Also render quality trend
    renderQualityTrend();

    if (state.sessions.length === 0) {
        container.innerHTML = '<p class="empty-state">Nenhuma sessão registrada ainda.</p>';
        return;
    }

    const sorted = [...state.sessions].reverse();
    container.innerHTML = sorted.map(s => {
        const qualityClass = s.decisionQuality >= 8 ? 'success' : s.decisionQuality >= 5 ? 'warning' : 'danger';
        const adherenceLabel = s.adherence === 'sim' ? '✅ Seguiu o plano' : s.adherence === 'parcial' ? '⚠️ Parcialmente' : '❌ Não seguiu';
        const adherenceClass = s.adherence === 'sim' ? 'success' : s.adherence === 'parcial' ? 'warning' : 'danger';

        return `
      <div class="history-item" id="session-${s.id}">
        <div class="history-date">${formatDate(s.date)}<br>${formatTime(s.timestamp)}</div>
        <div class="history-content">
          <div class="history-title">Sessão de ${formatDuration(s.duration)}</div>
          <div class="history-detail">${s.notes ? escapeHtml(s.notes.substring(0, 100)) : 'Sem notas'}</div>
          <div class="history-badges">
            <span class="badge badge-${qualityClass}">Decisões: ${s.decisionQuality}/10</span>
            <span class="badge badge-${adherenceClass}">${adherenceLabel}</span>
            ${s.markedHands.length > 0 ? `<span class="badge badge-info">📌 ${s.markedHands.length} mãos</span>` : ''}
          </div>
          <div class="history-actions">
            <button class="btn-icon" onclick="editSession(${s.id})" title="Editar">✏️</button>
            <button class="btn-icon" onclick="deleteSession(${s.id})" title="Excluir">🗑️</button>
          </div>
        </div>
      </div>
    `;
    }).join('');
}

function deleteSession(id) {
    if (!confirm('Tem certeza que deseja excluir esta sessão?')) return;
    state.sessions = state.sessions.filter(s => s.id !== id);
    saveState();
    renderSessionHistory();
    updateDailyProgress();
}

function editSession(id) {
    const session = state.sessions.find(s => s.id === id);
    if (!session) return;

    const el = document.getElementById('session-' + id);
    if (!el) return;

    const contentDiv = el.querySelector('.history-content');
    const adherenceBtns = ['sim', 'parcial', 'nao'].map(v => {
        const labels = { sim: '✅ Sim', parcial: '⚠️ Parcial', nao: '❌ Não' };
        const selected = session.adherence === v ? 'selected' : '';
        return `<button class="adherence-btn ${selected}" data-value="${v}" onclick="this.parentNode.querySelectorAll('.adherence-btn').forEach(b=>b.classList.remove('selected'));this.classList.add('selected')">${labels[v]}</button>`;
    }).join('');

    contentDiv.innerHTML = `
      <div class="session-edit-form">
        <label class="edit-label">📝 Notas</label>
        <textarea id="edit-notes-${id}" class="input" rows="3">${escapeHtml(session.notes || '')}</textarea>

        <label class="edit-label">🎯 Qualidade das Decisões: <span id="edit-rating-val-${id}">${session.decisionQuality}</span>/10</label>
        <input type="range" id="edit-quality-${id}" min="1" max="10" value="${session.decisionQuality}"
          oninput="document.getElementById('edit-rating-val-${id}').textContent=this.value" class="slider">

        <label class="edit-label">📋 Seguiu o plano?</label>
        <div class="adherence-options" id="edit-adherence-${id}">
          ${adherenceBtns}
        </div>

        <div class="edit-actions">
          <button class="btn btn-accent" onclick="saveSessionEdit(${id})">✅ Salvar</button>
          <button class="btn" onclick="cancelSessionEdit()">Cancelar</button>
        </div>
      </div>
    `;
}

function saveSessionEdit(id) {
    const session = state.sessions.find(s => s.id === id);
    if (!session) return;

    const notes = document.getElementById('edit-notes-' + id)?.value || '';
    const quality = parseInt(document.getElementById('edit-quality-' + id)?.value || '5');
    const selectedAdherence = document.querySelector('#edit-adherence-' + id + ' .adherence-btn.selected');

    session.notes = notes;
    session.decisionQuality = quality;
    if (selectedAdherence) {
        session.adherence = selectedAdherence.dataset.value;
    }

    saveState();
    renderSessionHistory();
    updateDailyProgress();
}

function cancelSessionEdit() {
    renderSessionHistory();
}

// ---- Quality Trend Chart ----
function renderQualityTrend() {
    const container = document.getElementById('quality-trend-spark');
    if (!container) return;

    const recent = [...state.sessions]
        .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
        .slice(-20);

    if (recent.length < 2) {
        container.innerHTML = '<span class="spark-empty">Dados insuficientes (mín. 2 sessões)</span>';
        return;
    }

    container.innerHTML = recent.map(s => {
        const pct = ((s.decisionQuality || 0) / 10) * 100;
        const color = s.decisionQuality >= 8 ? 'var(--color-success)' :
            s.decisionQuality >= 5 ? 'var(--color-warning)' : 'var(--color-danger)';
        return `<div class="spark-bar" style="height:${pct}%;background:${color}" title="${formatDate(s.date)}: ${s.decisionQuality}/10"></div>`;
    }).join('');
}

// ---- Utility ----
function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}
