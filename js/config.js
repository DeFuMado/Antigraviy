/* =====================================================
   CONFIG.JS - Configuration & Journal Module
   ===================================================== */

function initConfig() {
    // Restore config values
    const maxField = document.getElementById('max-field');
    const maxTables = document.getElementById('max-tables');

    if (maxField) maxField.value = state.config.maxField || 100;
    if (maxTables) maxTables.value = state.config.maxTables || 6;

    renderJournalHistory();
    if (typeof renderCustomPhrases === 'function') renderCustomPhrases();
}

function saveConfig() {
    state.config.maxField = parseInt(document.getElementById('max-field')?.value) || 100;
    state.config.maxTables = parseInt(document.getElementById('max-tables')?.value) || 6;

    saveState();
}

// ---- Journal ----
function saveJournalEntry() {
    const text = document.getElementById('journal-text')?.value.trim();
    if (!text) {
        alert('Escreva algo no diário!');
        return;
    }

    const entry = {
        id: Date.now(),
        date: getTodayKey(),
        timestamp: new Date().toISOString(),
        text: text
    };

    state.journal.push(entry);
    saveState();

    document.getElementById('journal-text').value = '';
    renderJournalHistory();
    alert('📝 Entrada salva no diário!');
}

function renderJournalHistory() {
    const container = document.getElementById('journal-history');
    if (!container) return;

    if (state.journal.length === 0) {
        container.innerHTML = '<p class="empty-state">Nenhuma entrada no diário.</p>';
        return;
    }

    const sorted = [...state.journal].reverse();
    container.innerHTML = sorted.map(entry => `
    <div class="history-item">
      <div class="history-date">${formatDate(entry.date)}<br>${formatTime(entry.timestamp)}</div>
      <div class="history-content">
        <div class="history-detail">${escapeHtml(entry.text)}</div>
      </div>
    </div>
  `).join('');
}

// ---- Data Management ----
function exportAllData() {
    const data = {
        exportDate: new Date().toISOString(),
        appVersion: '1.0',
        ...state
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `downswing-recovery-${getTodayKey()}.json`;
    a.click();
    URL.revokeObjectURL(url);
}

function importData(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function (e) {
        try {
            const data = JSON.parse(e.target.result);

            if (!confirm('Isso vai substituir todos os seus dados atuais. Continuar?')) return;

            // Merge imported data
            if (data.sessions) state.sessions = data.sessions;
            if (data.tiltEpisodes) state.tiltEpisodes = data.tiltEpisodes;
            if (data.studyDays) state.studyDays = data.studyDays;
            if (data.spots) state.spots = data.spots;
            if (data.journal) state.journal = data.journal;
            if (data.config) state.config = { ...state.config, ...data.config };
            if (data.agameNotes !== undefined) state.agameNotes = data.agameNotes;
            if (data.cgameNotes !== undefined) state.cgameNotes = data.cgameNotes;

            saveState();

            // Re-init everything
            initSession();
            initTilt();
            initStudy();
            initSpots();
            initConfig();
            if (typeof initStats === 'function') initStats();
            if (typeof initDashboard === 'function') initDashboard();
            updateDailyProgress();

            alert('✅ Dados importados com sucesso!');
        } catch (err) {
            alert('❌ Erro ao importar dados: ' + err.message);
        }
    };
    reader.readAsText(file);
}

function clearAllData() {
    if (!confirm('⚠️ Isso vai apagar TODOS os seus dados. Tem certeza?')) return;
    if (!confirm('🚨 Última chance! Todos os dados serão perdidos. Confirmar?')) return;

    localStorage.removeItem(APP_STATE_KEY);
    location.reload();
}
