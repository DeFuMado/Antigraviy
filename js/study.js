/* =====================================================
   STUDY.JS - 12-Week Leak Fix Study System
   ===================================================== */

const STUDY_CHECKLIST_TASKS = [
    { key: 'review', label: '🔍 Revisão de mãos jogadas no spot', desc: 'Revise mãos onde este leak apareceu' },
    { key: 'analyze', label: '📊 Análise do leak nas stats', desc: 'Analise os números e identifique padrões' },
    { key: 'theory', label: '📖 Estudo da Teoria (GTO)', desc: 'Estude a teoria correta para este spot' },
    { key: 'solver', label: '🖥️ Treino no Solver', desc: 'Pratique no solver até dominar' },
    { key: 'reeval', label: '✅ Re-avaliar a stat', desc: 'Atualize o valor na aba Stats e veja o progresso' }
];

let viewingWeek = 0; // 0-indexed, which week is being viewed

// Get ISO week number for a date
function getISOWeekNumber(date) {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

// Get display label for a plan week (real calendar week number)
function getCalendarWeekLabel(weekIdx) {
    const plan = state.studyPlan;
    if (!plan || !plan.startWeekNum) return `Sem ${weekIdx + 1}`;
    return `Sem ${plan.startWeekNum + weekIdx}`;
}

// Get calendar week label from an archived week object
function getArchivedWeekLabel(archivedWeek) {
    return `Sem ${archivedWeek.calendarWeek}`;
}

function initStudy() {
    if (!state.studyPlan) {
        state.studyPlan = null;
    }
    if (!state.studyPlanArchive) {
        state.studyPlanArchive = [];
    }

    // Auto-archive past weeks
    if (state.studyPlan) {
        archivePastWeeks();
    }

    if (state.studyPlan && state.studyPlan.weeks.length > 0) {
        viewingWeek = getCurrentWeekIndex();
        renderPlanUI();
    } else {
        state.studyPlan = null;
        renderNoPlanUI();
    }

    renderStudyHistory();
}

// ---- Archive Past Weeks ----
function archivePastWeeks() {
    const plan = state.studyPlan;
    if (!plan || !plan.weeks || plan.weeks.length === 0) return;

    // Calculate how many full weeks have elapsed since plan start
    const start = new Date(plan.startDate);
    const now = new Date();
    const elapsedWeeks = Math.floor((now - start) / (7 * 24 * 60 * 60 * 1000));

    // Archive the first N elapsed weeks (they are in the past)
    const toRemove = Math.min(elapsedWeeks, plan.weeks.length);
    if (toRemove <= 0) return;

    const startWeekNum = plan.startWeekNum || 1;

    for (let i = 0; i < toRemove; i++) {
        const week = plan.weeks[i];
        state.studyPlanArchive.push({
            calendarWeek: startWeekNum + i,
            weekNum: week.weekNum,
            category: week.category,
            categoryLabel: week.categoryLabel,
            leaks: week.leaks,
            checklist: week.checklist,
            notes: week.notes,
            archivedAt: new Date().toISOString()
        });
    }

    // Remove archived weeks and update plan
    plan.weeks = plan.weeks.slice(toRemove);
    plan.startWeekNum = startWeekNum + toRemove;

    // Advance startDate by the number of archived weeks
    const newStart = new Date(start);
    newStart.setDate(newStart.getDate() + toRemove * 7);
    plan.startDate = newStart.toISOString().split('T')[0];

    // Re-number remaining weeks
    plan.weeks.forEach((w, i) => {
        w.weekNum = i + 1;
    });

    saveState();
}

// ---- Current Week Calculation ----
function getCurrentWeekIndex() {
    if (!state.studyPlan || !state.studyPlan.weeks.length) return 0;
    // After archiving, current week is always 0 (first remaining week)
    return 0;
}

// ---- Plan Generation ----
function generateStudyPlan() {
    if (!state.playerStats || state.playerStats.length === 0) {
        alert('Adicione stats na aba Stats primeiro!');
        return;
    }

    // Get C-Game stats (biggest leaks)
    const cGameStats = state.playerStats.filter(s => s.game === 'cgame');

    if (cGameStats.length === 0) {
        alert('Nenhuma stat C-Game encontrada! Suas stats estão todas em A ou B-Game. 🎉');
        return;
    }

    if (state.studyPlan && !confirm('Já existe um plano ativo. Deseja gerar um novo? O progresso atual será perdido.')) {
        return;
    }

    // ---- Only group these 5 specific stat families ----
    const STAT_GROUPS = [
        { key: 'rfi', label: 'RFI (Raise First In)', patterns: ['rfi'] },
        { key: '3bet', label: '3Bet', patterns: ['3bet', '3-bet', '3 bet'] },
        { key: 'ev_bb', label: 'EV / BB', patterns: ['ev', 'bb/100', 'bb100', 'winrate'] },
        { key: 'agg', label: 'Agressão', patterns: ['agg', 'agress'] },
        { key: 'bet_river', label: 'Bet River / Trashs', patterns: ['trash river', 'river bet any', 'river any bet'] }
    ];

    function matchStatToGroup(statName) {
        const lower = statName.toLowerCase();
        for (const group of STAT_GROUPS) {
            for (const pattern of group.patterns) {
                const regex = new RegExp(pattern, 'i');
                if (regex.test(lower)) return group;
            }
        }
        return null;
    }

    // Separate: grouped (only 5 families) vs individual
    const grouped = {};
    const ungrouped = [];

    cGameStats.forEach(stat => {
        const group = matchStatToGroup(stat.name);
        if (group) {
            if (!grouped[group.key]) {
                grouped[group.key] = { label: group.label, stats: [] };
            }
            grouped[group.key].stats.push(stat);
        } else {
            ungrouped.push(stat);
        }
    });

    // Build leak entries: grouped families + individual stats
    const leakEntries = [];

    Object.keys(grouped).forEach(key => {
        const g = grouped[key];
        g.stats.sort((a, b) => Math.abs(b.value - b.target) - Math.abs(a.value - a.target));

        leakEntries.push({
            groupKey: key,
            groupLabel: g.label,
            isGroup: true,
            stats: g.stats.map(s => ({
                statId: s.id,
                name: s.name,
                target: s.target,
                value: s.value,
                deviation: s.value - s.target,
                category: s.category
            })),
            avgDeviation: g.stats.reduce((sum, s) => sum + Math.abs(s.value - s.target), 0) / g.stats.length,
            category: g.stats[0].category || 'all'
        });
    });

    // Individual stats (everything not in the 5 groups)
    ungrouped.sort((a, b) => Math.abs(b.value - b.target) - Math.abs(a.value - a.target));
    ungrouped.forEach(stat => {
        leakEntries.push({
            groupKey: 'single_' + stat.id,
            groupLabel: stat.name,
            isGroup: false,
            stats: [{
                statId: stat.id,
                name: stat.name,
                target: stat.target,
                value: stat.value,
                deviation: stat.value - stat.target,
                category: stat.category
            }],
            avgDeviation: Math.abs(stat.value - stat.target),
            category: stat.category || 'all'
        });
    });

    // Sort all entries by biggest deviation first
    leakEntries.sort((a, b) => b.avgDeviation - a.avgDeviation);

    // Build 12 weeks — 1 leak per week (deep focus)
    const weeks = [];
    const LEAKS_PER_WEEK = 1;

    for (let w = 0; w < 12; w++) {
        const weekLeaks = [];
        const checklist = {};
        const notes = {};

        for (let slot = 0; slot < LEAKS_PER_WEEK; slot++) {
            const idx = w * LEAKS_PER_WEEK + slot;
            let entry;

            if (idx < leakEntries.length) {
                entry = leakEntries[idx];
            } else if (leakEntries.length > 0) {
                // Reinforcement: cycle back through biggest leaks
                entry = leakEntries[idx % leakEntries.length];
            }

            if (!entry) continue;

            weekLeaks.push({
                groupKey: entry.groupKey,
                groupLabel: entry.groupLabel,
                isGroup: entry.isGroup,
                stats: entry.stats,
                category: entry.category
            });

            checklist[entry.groupKey] = {};
            notes[entry.groupKey] = {};
            STUDY_CHECKLIST_TASKS.forEach(t => {
                checklist[entry.groupKey][t.key] = false;
                notes[entry.groupKey][t.key] = '';
            });
        }

        // Category label from the first leak
        const catLabel = weekLeaks.length > 0
            ? getCategoryLabelForPlan(weekLeaks[0].category)
            : '';

        weeks.push({
            weekNum: w + 1,
            category: weekLeaks[0]?.category || 'all',
            categoryLabel: catLabel,
            leaks: weekLeaks,
            checklist,
            notes
        });
    }

    const now = new Date();
    state.studyPlan = {
        startDate: getTodayKey(),
        startWeekNum: getISOWeekNumber(now),
        generatedAt: now.toISOString(),
        weeks
    };

    saveState();
    viewingWeek = 0;
    renderPlanUI();
}

function getCategoryLabelForPlan(key) {
    // Reuse STAT_CATEGORIES if available
    if (typeof STAT_CATEGORIES !== 'undefined') {
        const cat = STAT_CATEGORIES.find(c => c.key === key);
        if (cat) return cat.label;
    }
    return key;
}

// ---- Render: No Plan ----
function renderNoPlanUI() {
    const btn = document.getElementById('generate-plan-btn');
    const status = document.getElementById('plan-status');

    if (btn) btn.textContent = '🔄 Gerar Plano de 12 Semanas';

    // Count C-Game stats
    const cCount = (state.playerStats || []).filter(s => s.game === 'cgame').length;
    if (status) {
        status.textContent = cCount > 0
            ? `${cCount} leaks (C-Game) encontrados — pronto para gerar!`
            : 'Adicione stats na aba Stats para gerar o plano.';
    }

    // Hide plan UI
    hideEl('week-progress-card');
    hideEl('week-banner');
    hideEl('week-study-progress');
    document.getElementById('week-leaks-container').innerHTML = '';
}

// ---- Render: Plan Active ----
function renderPlanUI() {
    const plan = state.studyPlan;
    if (!plan) return renderNoPlanUI();

    // Update button
    const btn = document.getElementById('generate-plan-btn');
    if (btn) btn.textContent = '🔄 Regenerar Plano';

    // Status
    const status = document.getElementById('plan-status');
    const currentWeek = getCurrentWeekIndex();
    const totalWeeks = plan.weeks.length;
    const archived = (state.studyPlanArchive || []).length;
    if (status) {
        status.innerHTML = `Plano iniciado em <strong>${formatDate(plan.startDate)}</strong> — Semana atual: <strong>${getCalendarWeekLabel(currentWeek)}</strong> (${archived + 1} de ${archived + totalWeeks})`;
    }

    // Show plan sections
    showEl('week-progress-card');
    showEl('week-banner');
    showEl('week-study-progress');

    renderWeekDots();
    renderCurrentWeek();
    updateWeeklyProgressBar();
}

// ---- Week Dots (12-week overview) ----
function renderWeekDots() {
    const container = document.getElementById('week-dots');
    if (!container || !state.studyPlan) return;

    const currentWeek = getCurrentWeekIndex();

    container.innerHTML = state.studyPlan.weeks.map((week, i) => {
        const pct = getWeekCompletionPct(i);
        let cls = 'week-dot';

        if (i === viewingWeek) cls += ' viewing';
        if (i === currentWeek) cls += ' current';
        if (pct === 100) cls += ' completed';
        else if (pct > 0) cls += ' in-progress';

        const calLabel = getCalendarWeekLabel(i);
        return `
      <div class="${cls}" onclick="goToWeek(${i})" title="${calLabel}: ${week.categoryLabel} (${Math.round(pct)}%)">
        <span class="week-dot-num">${state.studyPlan.startWeekNum ? state.studyPlan.startWeekNum + i : i + 1}</span>
        <div class="week-dot-fill" style="height: ${pct}%"></div>
      </div>
    `;
    }).join('');
}

function getWeekCompletionPct(weekIdx) {
    const plan = state.studyPlan;
    if (!plan || !plan.weeks[weekIdx]) return 0;

    const week = plan.weeks[weekIdx];
    const checklist = week.checklist;
    if (!checklist) return 0;

    let total = 0;
    let completed = 0;

    Object.values(checklist).forEach(tasks => {
        Object.values(tasks).forEach(done => {
            total++;
            if (done) completed++;
        });
    });

    return total > 0 ? (completed / total) * 100 : 0;
}

// ---- Week Navigation ----
function navigateWeek(dir) {
    const max = (state.studyPlan ? state.studyPlan.weeks.length : 1) - 1;
    viewingWeek = Math.max(0, Math.min(max, viewingWeek + dir));
    renderCurrentWeek();
    renderWeekDots();
    updateWeeklyProgressBar();
}

function goToWeek(idx) {
    viewingWeek = idx;
    renderCurrentWeek();
    renderWeekDots();
    updateWeeklyProgressBar();
}

// ---- Render Current Week ----
function renderCurrentWeek() {
    const plan = state.studyPlan;
    if (!plan) return;

    const week = plan.weeks[viewingWeek];
    if (!week) return;

    const currentWeek = getCurrentWeekIndex();
    const isPast = viewingWeek < currentWeek;
    const isCurrent = viewingWeek === currentWeek;
    const isFuture = viewingWeek > currentWeek;

    // Week banner
    const weekNum = document.getElementById('week-number');
    const weekCat = document.getElementById('week-category');
    const weekAlert = document.getElementById('week-alert');

    if (weekNum) weekNum.textContent = `${getCalendarWeekLabel(viewingWeek)}`;
    if (weekCat) weekCat.textContent = `🎯 Foco: ${week.categoryLabel}`;

    if (weekAlert) {
        if (isCurrent) {
            weekAlert.innerHTML = `⚡ <strong>SEMANA ATIVA</strong> — Trabalhe nos leaks abaixo!`;
            weekAlert.className = 'week-alert active';
        } else if (isPast) {
            const pct = Math.round(getWeekCompletionPct(viewingWeek));
            weekAlert.innerHTML = `✅ Semana concluída — ${pct}% completado`;
            weekAlert.className = 'week-alert past';
        } else {
            weekAlert.innerHTML = `🔒 Semana futura — foque na semana atual primeiro`;
            weekAlert.className = 'week-alert future';
        }
    }

    // Nav buttons
    document.getElementById('week-prev-btn').disabled = viewingWeek === 0;
    document.getElementById('week-next-btn').disabled = viewingWeek >= (state.studyPlan.weeks.length - 1);

    // Render leak cards
    renderWeekLeaks(week, viewingWeek);
}

// ---- Render Leak Cards ----
function renderWeekLeaks(week, weekIdx) {
    const container = document.getElementById('week-leaks-container');
    if (!container) return;

    // Action bar for adding topics/spots
    const spotsOptions = (state.spots || []).map(s =>
        `<option value="${s.id}">${escapeHtml(s.name)}</option>`
    ).join('');

    const addBarHTML = `
      <div class="week-add-actions">
        <button class="btn btn-accent" onclick="showAddLeakForm(${weekIdx})">➕ Adicionar Tópico</button>
        ${spotsOptions ? `
          <div class="spot-add-group">
            <select id="spot-select-${weekIdx}" class="text-input spot-select-dropdown">
              <option value="">🔍 Adicionar Spot...</option>
              ${spotsOptions}
            </select>
            <button class="btn btn-secondary" onclick="addSpotToWeek(${weekIdx})">+ Spot</button>
          </div>
        ` : ''}
      </div>
      <div class="add-leak-form hidden" id="add-leak-form-${weekIdx}">
        <input type="text" id="add-leak-input-${weekIdx}" class="text-input" placeholder="Nome do tópico de estudo...">
        <div class="add-leak-form-btns">
          <button class="btn btn-primary" onclick="confirmAddLeak(${weekIdx})">✅ Adicionar</button>
          <button class="btn" onclick="hideAddLeakForm(${weekIdx})">Cancelar</button>
        </div>
      </div>
    `;

    if (!week.leaks || week.leaks.length === 0) {
        container.innerHTML = addBarHTML + '<div class="glass-card"><p class="empty-state">Nenhum leak atribuído a esta semana. Use os botões acima para adicionar.</p></div>';
        return;
    }

    container.innerHTML = addBarHTML + week.leaks.map(leak => {
        const gk = leak.groupKey;
        const leakChecklist = week.checklist[gk] || {};
        const leakNotes = (week.notes && week.notes[gk]) || {};
        const isCustom = leak.isCustom || false;

        // Render individual stats table within the group (skip for custom topics)
        let statsTableHTML = '';
        if (!isCustom && leak.stats && leak.stats.length > 0) {
            statsTableHTML = leak.stats.map(stat => {
                const currentStat = (state.playerStats || []).find(s => s.id === stat.statId);
                const currentValue = currentStat ? currentStat.value : stat.value;
                const currentDev = currentStat ? (currentStat.value - stat.target) : stat.deviation;
                const devSign = currentDev >= 0 ? '+' : '';
                const currentGame = currentStat ? getGameLabel(currentStat.game) : null;

                return `
                <tr class="leak-stat-row">
                  <td class="leak-stat-name">${escapeHtml(stat.name)}</td>
                  <td class="leak-stat-target">${stat.target}</td>
                  <td class="leak-stat-current cgame">${currentValue}</td>
                  <td class="leak-stat-dev cgame">${devSign}${currentDev.toFixed(1)}</td>
                  ${currentGame ? `<td class="leak-stat-game">${currentGame.emoji}</td>` : '<td></td>'}
                </tr>`;
            }).join('');
        }

        // Safe groupKey for inline JS (encode for use in function calls)
        const gkSafe = gk.replace(/'/g, "\\'")

        const checklistHTML = STUDY_CHECKLIST_TASKS.map(task => {
            const checked = leakChecklist[task.key] ? 'checked' : '';
            const noteText = leakNotes[task.key] || '';
            const hasNote = noteText.trim().length > 0;
            const noteId = `note-${weekIdx}-${gk}-${task.key}`;
            return `
        <div class="leak-task-block">
          <label class="check-item study-check-item leak-check-item">
            <input type="checkbox" class="study-check" ${checked}
              onchange="toggleLeakTask(${weekIdx}, '${gkSafe}', '${task.key}', this.checked)">
            <span class="checkmark"></span>
            <div class="leak-task-info">
              <span class="leak-task-label">${task.label}</span>
              <span class="leak-task-desc">${task.desc}</span>
            </div>
            <button class="btn-icon leak-note-toggle ${hasNote ? 'has-note' : ''}" 
              onclick="event.preventDefault(); event.stopPropagation(); toggleTaskNotes('${noteId}')" 
              title="Notas e links">
              ${hasNote ? '📝' : '📎'}
            </button>
          </label>
          <div class="leak-note-area hidden" id="${noteId}">
            <textarea class="text-input leak-note-input" 
              placeholder="Cole links, anote conclusões, insights..." 
              rows="3"
              oninput="saveLeakNotes(${weekIdx}, '${gkSafe}', '${task.key}', this.value)">${escapeHtml(noteText)}</textarea>
          </div>
        </div>
      `;
        }).join('');

        const completedTasks = Object.values(leakChecklist).filter(Boolean).length;
        const totalTasks = STUDY_CHECKLIST_TASKS.length;
        const leakPct = Math.round((completedTasks / totalTasks) * 100);
        const progressCls = leakPct === 100 ? 'completed' : leakPct > 0 ? 'in-progress' : '';
        const groupIcon = isCustom ? '📌' : (leak.isGroup ? '📦' : '🔴');
        const statCount = leak.stats ? leak.stats.length : 0;
        const cardId = `leak-body-${weekIdx}-${gk}`;

        // Stats table section (only for non-custom leaks with stats)
        const statsSection = statsTableHTML ? `
        <div class="leak-stats-table-wrap">
          <table class="leak-stats-table">
            <thead>
              <tr>
                <th>Stat</th>
                <th>Target</th>
                <th>Atual</th>
                <th>Desvio</th>
                <th></th>
              </tr>
            </thead>
            <tbody>${statsTableHTML}</tbody>
          </table>
        </div>` : '';

        return `
      <div class="glass-card leak-card ${progressCls}">
        <div class="leak-card-header" onclick="toggleLeakCard('${cardId}', this)" style="cursor:pointer;">
          <div class="leak-info">
            <h4 class="leak-name" id="leak-name-${weekIdx}-${gkSafe}">${groupIcon} ${escapeHtml(leak.groupLabel)}</h4>
            <span class="leak-category-tag">${isCustom ? '📌 Tópico personalizado' : getCategoryLabelForPlan(leak.category)}${!isCustom && leak.isGroup ? ` · ${statCount} stats` : ''}</span>
          </div>
          <div class="leak-header-right">
            <button class="btn-icon leak-edit-btn" onclick="event.stopPropagation(); editLeakName(${weekIdx}, '${gkSafe}')" title="Editar nome">✏️</button>
            <button class="btn-icon leak-remove-btn" onclick="event.stopPropagation(); removeLeakFromWeek(${weekIdx}, '${gkSafe}')" title="Remover">🗑️</button>
            <span class="leak-progress-badge">${completedTasks}/${totalTasks}</span>
            <span class="leak-toggle-icon">▶</span>
          </div>
        </div>

        ${statsSection}

        <!-- Collapsible study section -->
        <div class="leak-card-body hidden" id="${cardId}">
          <div class="leak-progress-mini">
            <div class="progress-bar-container">
              <div class="progress-bar-fill study-fill" style="width: ${leakPct}%"></div>
            </div>
            <span class="leak-progress-text">${completedTasks}/${totalTasks}</span>
          </div>
          <div class="leak-checklist">
            ${checklistHTML}
          </div>
        </div>
      </div>
    `;
    }).join('');
}

function toggleLeakCard(cardId, headerEl) {
    const body = document.getElementById(cardId);
    if (!body) return;
    body.classList.toggle('hidden');
    const icon = headerEl.querySelector('.leak-toggle-icon');
    if (icon) icon.textContent = body.classList.contains('hidden') ? '▶' : '▼';
}

// ---- Toggle Checklist Task ----
function toggleLeakTask(weekIdx, groupKey, taskKey, checked) {
    const plan = state.studyPlan;
    if (!plan || !plan.weeks[weekIdx]) return;

    const week = plan.weeks[weekIdx];
    if (!week.checklist[groupKey]) {
        week.checklist[groupKey] = {};
    }
    week.checklist[groupKey][taskKey] = checked;

    saveState();

    // Log to study history
    if (checked) {
        logStudyAction(weekIdx, groupKey, taskKey);
    }

    renderWeekLeaks(week, weekIdx);
    renderWeekDots();
    updateWeeklyProgressBar();
}

// ---- Notes Toggle & Save ----
function toggleTaskNotes(noteId) {
    const el = document.getElementById(noteId);
    if (!el) return;
    el.classList.toggle('hidden');
    if (!el.classList.contains('hidden')) {
        const textarea = el.querySelector('textarea');
        if (textarea) textarea.focus();
    }
}

function saveLeakNotes(weekIdx, statId, taskKey, value) {
    const plan = state.studyPlan;
    if (!plan || !plan.weeks[weekIdx]) return;

    const week = plan.weeks[weekIdx];
    if (!week.notes) week.notes = {};
    if (!week.notes[statId]) week.notes[statId] = {};
    week.notes[statId][taskKey] = value;

    saveState();
}

// ---- Weekly Progress Bar ----
function updateWeeklyProgressBar() {
    const pct = getWeekCompletionPct(viewingWeek);
    const plan = state.studyPlan;

    const bar = document.getElementById('study-progress-bar');
    const text = document.getElementById('study-progress-text');

    if (bar) bar.style.width = Math.round(pct) + '%';

    if (text && plan && plan.weeks[viewingWeek]) {
        const week = plan.weeks[viewingWeek];
        let total = 0, completed = 0;
        Object.values(week.checklist).forEach(tasks => {
            Object.values(tasks).forEach(done => {
                total++;
                if (done) completed++;
            });
        });
        text.textContent = `${completed}/${total} tarefas`;
    }
}

// ---- Study History ----
function logStudyAction(weekIdx, groupKey, taskKey) {
    const today = getTodayKey();
    if (!state.studyDays) state.studyDays = {};
    if (!state.studyDays[today]) {
        state.studyDays[today] = { date: today, tasks: {}, leakActions: [] };
    }

    const plan = state.studyPlan;
    const week = plan.weeks[weekIdx];
    const leak = week.leaks.find(l => l.groupKey === groupKey);
    const taskLabel = STUDY_CHECKLIST_TASKS.find(t => t.key === taskKey)?.label || taskKey;

    state.studyDays[today].leakActions = state.studyDays[today].leakActions || [];
    state.studyDays[today].leakActions.push({
        weekIdx: weekIdx,
        week: weekIdx + 1,
        statName: leak ? leak.groupLabel : 'Unknown',
        task: taskLabel,
        time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    });

    saveState();
    renderStudyHistory();
}

function renderStudyHistory() {
    const container = document.getElementById('study-history');
    if (!container) return;

    const archive = state.studyPlanArchive || [];

    if (archive.length === 0) {
        container.innerHTML = '<p class="empty-state">Nenhuma semana arquivada ainda. As semanas passadas aparecerão aqui automaticamente.</p>';
        return;
    }

    // Sort by calendar week descending (most recent first)
    const sorted = [...archive].sort((a, b) => b.calendarWeek - a.calendarWeek);

    container.innerHTML = sorted.map((aw, idx) => {
        const calLabel = getArchivedWeekLabel(aw);
        const leakNames = (aw.leaks || []).map(l => l.groupLabel).join(', ');
        const pct = getArchivedWeekPct(aw);
        const cardId = `archive-${aw.calendarWeek}`;
        const pctCls = pct === 100 ? 'completed' : pct > 0 ? 'partial' : 'empty';

        // Build expanded content: stats table + checklist state + notes
        const expandedHTML = (aw.leaks || []).map(leak => {
            const gk = leak.groupKey;
            const checklistData = (aw.checklist && aw.checklist[gk]) || {};
            const notesData = (aw.notes && aw.notes[gk]) || {};

            const statsRows = (leak.stats || []).map(s => {
                const devSign = s.deviation >= 0 ? '+' : '';
                return `<tr>
                    <td class="leak-stat-name">${escapeHtml(s.name)}</td>
                    <td class="leak-stat-target">${s.target}</td>
                    <td class="leak-stat-current cgame">${s.value}</td>
                    <td class="leak-stat-dev cgame">${devSign}${s.deviation.toFixed(1)}</td>
                </tr>`;
            }).join('');

            const checklistRows = STUDY_CHECKLIST_TASKS.map(task => {
                const done = checklistData[task.key];
                const note = notesData[task.key] || '';
                const icon = done ? '✅' : '⬜';
                const noteHTML = note.trim()
                    ? `<div class="archive-note">📝 ${escapeHtml(note)}</div>`
                    : '';
                return `<div class="archive-task ${done ? 'done' : ''}">${icon} ${task.label}${noteHTML}</div>`;
            }).join('');

            return `
            <div class="archive-leak-section">
                <h5 class="archive-leak-title">${leak.isGroup ? '📦' : '🔴'} ${escapeHtml(leak.groupLabel)}</h5>
                <table class="leak-stats-table">
                    <thead><tr><th>Stat</th><th>Target</th><th>Atual</th><th>Desvio</th></tr></thead>
                    <tbody>${statsRows}</tbody>
                </table>
                <div class="archive-checklist">${checklistRows}</div>
            </div>`;
        }).join('');

        return `
        <div class="history-week-card glass-card ${pctCls}">
          <div class="history-week-header" onclick="toggleArchiveCard('${cardId}')" style="cursor:pointer;">
            <div class="history-week-info">
              <span class="history-week-label">${calLabel}</span>
              <span class="history-week-leaks">${escapeHtml(leakNames)}</span>
            </div>
            <div class="history-week-meta">
              <span class="history-week-pct">${Math.round(pct)}%</span>
              <button class="btn-icon archive-restore-btn" onclick="event.stopPropagation(); restoreArchivedWeek(${aw.calendarWeek})" title="Restaurar para o plano ativo">⬆️</button>
              <span class="archive-toggle-icon" id="icon-${cardId}">▶</span>
            </div>
          </div>
          <div class="archive-body hidden" id="${cardId}">
            ${expandedHTML}
          </div>
        </div>
      `;
    }).join('');
}

function toggleArchiveCard(cardId) {
    const body = document.getElementById(cardId);
    if (!body) return;
    body.classList.toggle('hidden');
    const icon = document.getElementById('icon-' + cardId);
    if (icon) icon.textContent = body.classList.contains('hidden') ? '▶' : '▼';
}

function getArchivedWeekPct(archivedWeek) {
    if (!archivedWeek.checklist) return 0;
    let total = 0, completed = 0;
    Object.values(archivedWeek.checklist).forEach(tasks => {
        Object.values(tasks).forEach(done => {
            total++;
            if (done) completed++;
        });
    });
    return total > 0 ? (completed / total) * 100 : 0;
}

// ---- Restore archived week back to active plan ----
function restoreArchivedWeek(calendarWeek) {
    if (!state.studyPlanArchive) return;

    const idx = state.studyPlanArchive.findIndex(w => w.calendarWeek === calendarWeek);
    if (idx === -1) return;

    const archived = state.studyPlanArchive.splice(idx, 1)[0];

    // If no active plan, create one
    if (!state.studyPlan) {
        state.studyPlan = {
            startDate: new Date().toISOString().split('T')[0],
            startWeekNum: archived.calendarWeek,
            generatedAt: new Date().toISOString(),
            weeks: []
        };
    }

    // Re-add the week to the plan in the correct position
    const restoredWeek = {
        weekNum: 1,
        category: archived.category,
        categoryLabel: archived.categoryLabel,
        leaks: archived.leaks,
        checklist: archived.checklist,
        notes: archived.notes
    };

    // Insert at the beginning (before current weeks) since it's a past week being restored
    state.studyPlan.weeks.unshift(restoredWeek);

    // Update startWeekNum to the earliest week
    state.studyPlan.startWeekNum = Math.min(state.studyPlan.startWeekNum, archived.calendarWeek);

    // Re-number all weeks
    state.studyPlan.weeks.forEach((w, i) => {
        w.weekNum = i + 1;
    });

    saveState();
    viewingWeek = 0;
    renderPlanUI();
    renderStudyHistory();
}

// ---- Edit Plan: Remove Leak ----
function removeLeakFromWeek(weekIdx, groupKey) {
    const plan = state.studyPlan;
    if (!plan || !plan.weeks[weekIdx]) return;
    if (!confirm('Remover este tópico da semana?')) return;

    const week = plan.weeks[weekIdx];
    week.leaks = week.leaks.filter(l => l.groupKey !== groupKey);
    delete week.checklist[groupKey];
    if (week.notes) delete week.notes[groupKey];

    saveState();
    renderWeekLeaks(week, weekIdx);
    renderWeekDots();
    updateWeeklyProgressBar();
}

// ---- Edit Plan: Edit Leak Name ----
function editLeakName(weekIdx, groupKey) {
    const plan = state.studyPlan;
    if (!plan || !plan.weeks[weekIdx]) return;

    const week = plan.weeks[weekIdx];
    const leak = week.leaks.find(l => l.groupKey === groupKey);
    if (!leak) return;

    const newName = prompt('Novo nome do tópico:', leak.groupLabel);
    if (newName === null || !newName.trim()) return;

    leak.groupLabel = newName.trim();
    saveState();
    renderWeekLeaks(week, weekIdx);
}

// ---- Edit Plan: Add Custom Topic ----
function showAddLeakForm(weekIdx) {
    const form = document.getElementById('add-leak-form-' + weekIdx);
    if (form) {
        form.classList.remove('hidden');
        const input = document.getElementById('add-leak-input-' + weekIdx);
        if (input) input.focus();
    }
}

function hideAddLeakForm(weekIdx) {
    const form = document.getElementById('add-leak-form-' + weekIdx);
    if (form) form.classList.add('hidden');
    const input = document.getElementById('add-leak-input-' + weekIdx);
    if (input) input.value = '';
}

function confirmAddLeak(weekIdx) {
    const plan = state.studyPlan;
    if (!plan || !plan.weeks[weekIdx]) return;

    const input = document.getElementById('add-leak-input-' + weekIdx);
    const name = input ? input.value.trim() : '';
    if (!name) { alert('Digite o nome do tópico!'); return; }

    const week = plan.weeks[weekIdx];
    const gk = 'custom_' + Date.now();

    week.leaks.push({
        groupKey: gk,
        groupLabel: name,
        isGroup: false,
        isCustom: true,
        stats: [],
        category: 'all'
    });

    // Initialize checklist and notes
    week.checklist[gk] = {};
    if (!week.notes) week.notes = {};
    week.notes[gk] = {};
    STUDY_CHECKLIST_TASKS.forEach(t => {
        week.checklist[gk][t.key] = false;
        week.notes[gk][t.key] = '';
    });

    saveState();
    hideAddLeakForm(weekIdx);
    renderWeekLeaks(week, weekIdx);
    renderWeekDots();
    updateWeeklyProgressBar();
}

// ---- Edit Plan: Add Spot to Week ----
function addSpotToWeek(weekIdx) {
    const plan = state.studyPlan;
    if (!plan || !plan.weeks[weekIdx]) return;

    const select = document.getElementById('spot-select-' + weekIdx);
    if (!select || !select.value) { alert('Selecione um spot!'); return; }

    const spotId = parseInt(select.value);
    const spot = (state.spots || []).find(s => s.id === spotId);
    if (!spot) return;

    const week = plan.weeks[weekIdx];
    const gk = 'spot_' + spotId;

    // Check if already added
    if (week.leaks.some(l => l.groupKey === gk)) {
        alert('Este spot já está nesta semana!');
        return;
    }

    week.leaks.push({
        groupKey: gk,
        groupLabel: '🔍 ' + spot.name,
        isGroup: false,
        isCustom: true,
        stats: [],
        category: 'all'
    });

    // Initialize checklist and notes
    week.checklist[gk] = {};
    if (!week.notes) week.notes = {};
    week.notes[gk] = {};
    STUDY_CHECKLIST_TASKS.forEach(t => {
        week.checklist[gk][t.key] = false;
        week.notes[gk][t.key] = '';
    });

    saveState();
    select.value = '';
    renderWeekLeaks(week, weekIdx);
    renderWeekDots();
    updateWeeklyProgressBar();
}

// ---- Helpers ----
function hideEl(id) {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
}
function showEl(id) {
    const el = document.getElementById(id);
    if (el) el.style.display = '';
}
