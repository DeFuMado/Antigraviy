/* =====================================================
   SPOTS.JS - Spot Analysis + Flashcard Review Module
   ===================================================== */

// Spaced repetition intervals in days
const REVIEW_INTERVALS = [1, 3, 7, 14, 30];

// ---- Rich Text Formatting ----
function formatText(text) {
    if (!text) return '';
    let out = escapeHtml(text);
    // Images: ![alt](url)
    out = out.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" class="spot-inline-img" onclick="event.stopPropagation()">');
    // Links: [text](url) or bare URLs
    out = out.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener" class="spot-link" onclick="event.stopPropagation()">$1</a>');
    out = out.replace(/(^|[^"=])(https?:\/\/[^\s<]+)/g, '$1<a href="$2" target="_blank" rel="noopener" class="spot-link" onclick="event.stopPropagation()">$2</a>');
    // Bold: **text**
    out = out.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    // Line breaks
    out = out.replace(/\n/g, '<br>');
    return out;
}

const SPOT_TAGS = [
    '3bet Pot', 'Squeeze', 'Blind Defense', 'ICM', 'Multiway',
    'Heads-Up', 'Draw Heavy', 'River Play', 'Bluff Spot', 'Value Bet',
    'Check-Raise', 'C-Bet', 'Fold Decision', 'Sizing', 'Short Stack'
];

let activeTagFilter = null;

function initSpots() {
    // Ensure all spots have review data (migrate old format)
    state.spots.forEach(s => {
        if (!s.review) {
            s.review = {
                nextReview: s.date || getTodayKey(),
                interval: 1,
                reviewCount: 0,
                difficult: false
            };
        }
        // Migrate old intervalIdx format to new interval format
        if (s.review.intervalIdx !== undefined) {
            s.review.interval = REVIEW_INTERVALS[s.review.intervalIdx] || 1;
            delete s.review.intervalIdx;
        }
        if (s.review.difficult === undefined) {
            s.review.difficult = false;
        }
        // Migrate: add tags array if missing
        if (!s.tags) s.tags = [];
    });
    renderSpotTagChips();
    renderSpotsList();
    updateFlashcardUI();
}

// ---- Save Spot (with review scheduling) ----
function saveSpot() {
    const name = document.getElementById('spot-name')?.value.trim();
    const q1 = document.getElementById('spot-q1')?.value.trim();
    const q2 = document.getElementById('spot-q2')?.value.trim();
    const q3 = document.getElementById('spot-q3')?.value.trim();
    const q4 = document.getElementById('spot-q4')?.value.trim();
    const q5 = document.getElementById('spot-q5')?.value.trim();
    const trained = document.getElementById('spot-trained')?.checked || false;

    if (!name) {
        alert('Digite o nome do spot!');
        return;
    }

    if (!q1 && !q2 && !q3 && !q4 && !q5) {
        alert('Responda pelo menos uma pergunta!');
        return;
    }

    // Collect selected tags
    const selectedTags = [];
    document.querySelectorAll('.spot-tag-check:checked').forEach(cb => {
        selectedTags.push(cb.value);
    });

    // First review: tomorrow
    const tomorrow = addDays(getTodayKey(), 1);

    const spot = {
        id: Date.now(),
        date: getTodayKey(),
        timestamp: new Date().toISOString(),
        name,
        questions: {
            myPlay: q1,
            theory: q2,
            population: q3,
            nodelock: q4,
            solverTraining: q5
        },
        trained,
        tags: selectedTags,
        review: {
            nextReview: tomorrow,
            interval: 1,
            reviewCount: 0,
            difficult: false
        }
    };

    state.spots.push(spot);
    saveState();

    // Clear form
    document.getElementById('spot-name').value = '';
    document.getElementById('spot-q1').value = '';
    document.getElementById('spot-q2').value = '';
    document.getElementById('spot-q3').value = '';
    document.getElementById('spot-q4').value = '';
    document.getElementById('spot-q5').value = '';
    document.getElementById('spot-trained').checked = false;
    document.querySelectorAll('.spot-tag-check').forEach(cb => cb.checked = false);

    renderSpotsList();
    updateFlashcardUI();
    alert('✅ Spot salvo! Primeira revisão amanhã.');
}

// ---- Date helpers ----
function addDays(dateStr, days) {
    const d = new Date(dateStr + 'T12:00:00');
    d.setDate(d.getDate() + days);
    return d.toISOString().split('T')[0];
}

function daysBetween(dateStr1, dateStr2) {
    const d1 = new Date(dateStr1 + 'T12:00:00');
    const d2 = new Date(dateStr2 + 'T12:00:00');
    return Math.round((d2 - d1) / (1000 * 60 * 60 * 24));
}

function getIntervalLabel(interval) {
    if (interval <= 1) return '1 dia';
    if (interval <= 2) return '2 dias';
    if (interval <= 4) return `${interval} dias`;
    if (interval <= 6) return `${interval} dias`;
    if (interval <= 10) return '1 semana';
    if (interval <= 16) return '2 semanas';
    return '1 mês';
}

// ---- Interval Calculation (Conservative) ----
function calcNextInterval(currentInterval, rating) {
    switch (rating) {
        case 'again':
            return 1; // Reset to 1 day
        case 'hard':
            return Math.max(1, Math.round(currentInterval * 1.2)); // 1.2x
        case 'good':
            return Math.max(1, Math.round(currentInterval * 1.4)); // 1.4x standard
        case 'easy':
            return Math.max(1, Math.round(currentInterval * 1.8)); // 1.8x skip
        default:
            return currentInterval;
    }
}

// ---- Get Due Spots ----
function getDueSpots() {
    const today = getTodayKey();
    return state.spots.filter(s => {
        if (!s.review) return false;
        return s.review.nextReview <= today;
    });
}

// ---- Flashcard State (volatile) ----
let fcQueue = [];
let fcCurrentIdx = 0;
let fcFlipped = false;

function updateFlashcardUI() {
    const dueSpots = getDueSpots();
    const dueCount = dueSpots.length;

    const countEl = document.getElementById('fc-due-count');
    const emptyEl = document.getElementById('fc-empty');
    const containerEl = document.getElementById('fc-card-container');
    const startBtn = document.getElementById('fc-start-btn');
    const nextInfoEl = document.getElementById('fc-next-info');

    if (countEl) {
        countEl.textContent = `${dueCount} para revisar`;
        countEl.classList.toggle('has-due', dueCount > 0);
    }

    if (dueCount === 0) {
        if (emptyEl) emptyEl.style.display = '';
        if (containerEl) containerEl.style.display = 'none';
        if (startBtn) startBtn.style.display = 'none';

        // Show next review date
        if (nextInfoEl && state.spots.length > 0) {
            const futureSpots = state.spots
                .filter(s => s.review && s.review.nextReview > getTodayKey())
                .sort((a, b) => a.review.nextReview.localeCompare(b.review.nextReview));
            if (futureSpots.length > 0) {
                const next = futureSpots[0];
                const daysUntil = daysBetween(getTodayKey(), next.review.nextReview);
                nextInfoEl.textContent = `Próxima revisão em ${daysUntil} dia(s) — ${formatDate(next.review.nextReview)}`;
            } else {
                nextInfoEl.textContent = '';
            }
        }
    } else {
        if (emptyEl) emptyEl.style.display = 'none';
        if (containerEl) containerEl.style.display = 'none';
        if (startBtn) {
            startBtn.style.display = '';
            startBtn.textContent = `🃏 Iniciar Revisão (${dueCount} spots)`;
        }
    }
}

function startFlashcardReview() {
    fcQueue = getDueSpots();
    if (fcQueue.length === 0) return;

    fcCurrentIdx = 0;
    fcFlipped = false;

    const startBtn = document.getElementById('fc-start-btn');
    const containerEl = document.getElementById('fc-card-container');
    if (startBtn) startBtn.style.display = 'none';
    if (containerEl) containerEl.style.display = '';

    showFlashcard();
}

function showFlashcard() {
    if (fcCurrentIdx >= fcQueue.length) {
        // Review complete
        finishFlashcardReview();
        return;
    }

    const spot = fcQueue[fcCurrentIdx];
    fcFlipped = false;

    // Progress
    const progressEl = document.getElementById('fc-progress-text');
    if (progressEl) progressEl.textContent = `${fcCurrentIdx + 1} / ${fcQueue.length}`;

    // Interval badge + difficulty tag
    const badgeEl = document.getElementById('fc-interval-badge');
    if (badgeEl) {
        const label = getIntervalLabel(spot.review.interval);
        const diffTag = spot.review.difficult ? ' ⚠️' : '';
        badgeEl.textContent = `Intervalo: ${label}${diffTag}`;
    }

    // Front
    const titleEl = document.getElementById('fc-card-title');
    if (titleEl) titleEl.textContent = spot.name;

    // Back
    const answersEl = document.getElementById('fc-card-answers');
    if (answersEl) {
        const labels = [
            { key: 'myPlay', label: '1. Como estou jogando' },
            { key: 'theory', label: '2. Como a Teoria joga' },
            { key: 'population', label: '3. Como a pop joga' },
            { key: 'nodelock', label: '4. Nodelock' },
            { key: 'solverTraining', label: '5. Treino no Solver' }
        ];

        answersEl.innerHTML = labels
            .filter(q => spot.questions[q.key])
            .map(q => `
                <div class="fc-answer-item">
                    <div class="fc-answer-label">${q.label}</div>
                    <div class="fc-answer-text">${formatText(spot.questions[q.key])}</div>
                </div>
            `).join('');
    }

    // Reset card flip
    const cardInner = document.getElementById('fc-card-inner');
    if (cardInner) cardInner.classList.remove('flipped');

    // Hide rating buttons
    const ratingEl = document.getElementById('fc-rating-buttons');
    if (ratingEl) ratingEl.style.display = 'none';
}

function flipFlashcard() {
    if (fcFlipped) return;
    fcFlipped = true;

    const cardInner = document.getElementById('fc-card-inner');
    if (cardInner) cardInner.classList.add('flipped');

    // Show rating buttons with interval hints
    const spot = fcQueue[fcCurrentIdx];
    const cur = spot.review.interval;

    const hintHard = document.getElementById('fc-hint-hard');
    const hintGood = document.getElementById('fc-hint-good');
    const hintEasy = document.getElementById('fc-hint-easy');

    if (hintHard) hintHard.textContent = `${calcNextInterval(cur, 'hard')}d (1.2x)`;
    if (hintGood) hintGood.textContent = `${calcNextInterval(cur, 'good')}d (1.4x)`;
    if (hintEasy) hintEasy.textContent = `${calcNextInterval(cur, 'easy')}d (1.8x)`;

    // Show rating buttons
    const ratingEl = document.getElementById('fc-rating-buttons');
    if (ratingEl) ratingEl.style.display = '';
}

function rateFlashcard(rating) {
    const spot = fcQueue[fcCurrentIdx];
    if (!spot || !spot.review) return;

    const today = getTodayKey();
    const newInterval = calcNextInterval(spot.review.interval, rating);

    spot.review.interval = newInterval;
    spot.review.nextReview = addDays(today, newInterval);
    spot.review.reviewCount++;

    // Difficulty tracking
    if (rating === 'again') {
        spot.review.difficult = true;
    } else if (rating === 'easy') {
        spot.review.difficult = false; // Mastered
    }

    saveState();

    // Next card
    fcCurrentIdx++;
    showFlashcard();
}

function finishFlashcardReview() {
    const containerEl = document.getElementById('fc-card-container');
    if (containerEl) containerEl.style.display = 'none';

    updateFlashcardUI();
    alert(`🎉 Revisão completa! ${fcQueue.length} spot(s) revisado(s).`);
}

// ---- Render Spots List ----
function renderSpotsList(filter = '') {
    const container = document.getElementById('spots-list');
    if (!container) return;

    let spots = [...state.spots].reverse();

    // Tag filter
    if (activeTagFilter) {
        spots = spots.filter(s => (s.tags || []).includes(activeTagFilter));
    }

    // Text search filter
    if (filter) {
        const lowerFilter = filter.toLowerCase();
        spots = spots.filter(s =>
            s.name.toLowerCase().includes(lowerFilter) ||
            Object.values(s.questions).some(q => q && q.toLowerCase().includes(lowerFilter)) ||
            (s.tags || []).some(t => t.toLowerCase().includes(lowerFilter))
        );
    }

    if (spots.length === 0) {
        container.innerHTML = filter
            ? '<p class="empty-state">Nenhum spot encontrado.</p>'
            : '<p class="empty-state">Nenhum spot salvo ainda.</p>';
        return;
    }

    container.innerHTML = spots.map(s => {
        const questionLabels = [
            { key: 'myPlay', label: '1. Como estou jogando' },
            { key: 'theory', label: '2. Como a Teoria joga' },
            { key: 'population', label: '3. Como a pop joga' },
            { key: 'nodelock', label: '4. Nodelock' },
            { key: 'solverTraining', label: '5. Treino no Solver' }
        ];

        const questionsHtml = questionLabels
            .filter(q => s.questions[q.key])
            .map(q => `
        <div class="spot-question">
          <div class="spot-question-label">${q.label}</div>
          <div class="spot-question-answer">${formatText(s.questions[q.key])}</div>
        </div>
      `).join('');

        // Review info badge
        const diffIcon = s.review && s.review.difficult ? ' ⚠️' : '';
        const reviewBadge = s.review
            ? `<span class="spot-review-badge${s.review.difficult ? ' difficult' : ''}" title="Revisões: ${s.review.reviewCount}">🃏 ${getIntervalLabel(s.review.interval)}${diffIcon}</span>`
            : '';

        // Tag chips
        const tagsHtml = (s.tags || []).map(t =>
            `<span class="spot-tag-chip">${escapeHtml(t)}</span>`
        ).join('');

        return `
      <div class="spot-card" id="spot-${s.id}" onclick="toggleSpot(${s.id})">
        <div class="spot-card-header">
          <div>
            <span class="spot-card-title">${escapeHtml(s.name)}</span>
            ${s.trained ? '<span class="spot-trained-badge">✅ Treinado</span>' : ''}
            ${reviewBadge}
          </div>
          <span class="spot-card-date">${formatDate(s.date)}</span>
        </div>
        ${tagsHtml ? `<div class="spot-tags-row">${tagsHtml}</div>` : ''}
        <div class="spot-card-body">
          ${questionsHtml}
          <div class="spot-actions">
            <button class="btn btn-accent" onclick="event.stopPropagation(); editSpot(${s.id})">✏️ Editar</button>
            <button class="btn btn-danger" onclick="event.stopPropagation(); deleteSpot(${s.id})">🗑️ Excluir</button>
          </div>
        </div>
      </div>
    `;
    }).join('');
}

function toggleSpot(id) {
    const card = document.getElementById('spot-' + id);
    if (card) card.classList.toggle('expanded');
}

function deleteSpot(id) {
    if (!confirm('Excluir este spot?')) return;
    state.spots = state.spots.filter(s => s.id !== id);
    saveState();
    renderSpotsList();
    updateFlashcardUI();
}

function filterSpots() {
    const search = document.getElementById('spot-search')?.value || '';
    renderSpotsList(search);
}

function renderSpotTagChips() {
    const container = document.getElementById('spot-tag-filters');
    if (!container) return;

    // Get tags that are actually used
    const usedTags = new Set();
    (state.spots || []).forEach(s => (s.tags || []).forEach(t => usedTags.add(t)));

    if (usedTags.size === 0) {
        container.innerHTML = '';
        return;
    }

    let html = `<button class="tag-filter-chip ${!activeTagFilter ? 'active' : ''}" onclick="toggleTagFilter(null)">Todos</button>`;
    [...usedTags].sort().forEach(tag => {
        html += `<button class="tag-filter-chip ${activeTagFilter === tag ? 'active' : ''}" onclick="toggleTagFilter('${escapeHtml(tag)}')">${escapeHtml(tag)}</button>`;
    });
    container.innerHTML = html;
}

function toggleTagFilter(tag) {
    activeTagFilter = tag;
    renderSpotTagChips();
    filterSpots();
}

// ---- Edit Spot ----
let editingSpotId = null;

function editSpot(id) {
    const spot = state.spots.find(s => s.id === id);
    if (!spot) return;

    editingSpotId = id;

    // Populate form
    document.getElementById('spot-name').value = spot.name;
    document.getElementById('spot-q1').value = spot.questions.myPlay || '';
    document.getElementById('spot-q2').value = spot.questions.theory || '';
    document.getElementById('spot-q3').value = spot.questions.population || '';
    document.getElementById('spot-q4').value = spot.questions.nodelock || '';
    document.getElementById('spot-q5').value = spot.questions.solverTraining || '';
    document.getElementById('spot-trained').checked = spot.trained || false;

    // Restaurar tags
    document.querySelectorAll('.spot-tag-check').forEach(cb => {
        cb.checked = (spot.tags || []).includes(cb.value);
    });

    // Change save button to update mode
    const saveBtn = document.querySelector('#spots-tab .btn-primary.btn-large');
    if (saveBtn) {
        saveBtn.textContent = '✅ Salvar Alterações';
        saveBtn.setAttribute('onclick', 'updateSpot()');
    }

    // Scroll to form
    document.getElementById('spot-name').scrollIntoView({ behavior: 'smooth', block: 'center' });
    document.getElementById('spot-name').focus();
}

function updateSpot() {
    if (!editingSpotId) return;

    const spot = state.spots.find(s => s.id === editingSpotId);
    if (!spot) return;

    const name = document.getElementById('spot-name')?.value.trim();
    if (!name) {
        alert('Digite o nome do spot!');
        return;
    }

    spot.name = name;
    spot.questions.myPlay = document.getElementById('spot-q1')?.value.trim() || '';
    spot.questions.theory = document.getElementById('spot-q2')?.value.trim() || '';
    spot.questions.population = document.getElementById('spot-q3')?.value.trim() || '';
    spot.questions.nodelock = document.getElementById('spot-q4')?.value.trim() || '';
    spot.questions.solverTraining = document.getElementById('spot-q5')?.value.trim() || '';
    spot.trained = document.getElementById('spot-trained')?.checked || false;

    // Salvar tags atualizadas
    const selectedTags = [];
    document.querySelectorAll('.spot-tag-check:checked').forEach(cb => {
        selectedTags.push(cb.value);
    });
    spot.tags = selectedTags;

    saveState();
    cancelEdit();
    renderSpotsList();
    alert('✅ Spot atualizado!');
}

function cancelEdit() {
    editingSpotId = null;

    // Clear form
    document.getElementById('spot-name').value = '';
    document.getElementById('spot-q1').value = '';
    document.getElementById('spot-q2').value = '';
    document.getElementById('spot-q3').value = '';
    document.getElementById('spot-q4').value = '';
    document.getElementById('spot-q5').value = '';
    document.getElementById('spot-trained').checked = false;

    // Restore save button
    const saveBtn = document.querySelector('#spots-tab .btn-primary.btn-large');
    if (saveBtn) {
        saveBtn.textContent = '💾 Salvar Spot';
        saveBtn.setAttribute('onclick', 'saveSpot()');
    }
}

