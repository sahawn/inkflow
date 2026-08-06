/* =========================================
   INKFLOW - APP.JS
   Dashboard Penulis PWA
   ========================================= */

// =========================================
// FIREBASE & STATE
// =========================================
const db = window.db;
const auth = window.auth;
const provider = window.provider;

let currentUser = null;
let currentStoryId = null;
let currentChapterId = null;
let currentBibleId = null;
let allStories = [];
let currentStory = null;
let isEditingChapter = false;
let isEditingBible = false;

// Timer & Goal State
let writingTimer = null;
let timerSeconds = 25 * 60;
let timerRunning = false;
let wordGoal = 500;

// =========================================
// UTILITY FUNCTIONS (SAFE TIMESTAMP)
// =========================================
function formatDate(updatedAt) {
    if (!updatedAt) return '-';

    // Kalau sudah berupa Date object
    if (updatedAt instanceof Date) {
        return updatedAt.toLocaleDateString('id-ID');
    }

    // Kalau Firebase Timestamp (punya method toDate)
    if (typeof updatedAt.toDate === 'function') {
        return updatedAt.toDate().toLocaleDateString('id-ID');
    }

    // Kalau object {seconds, nanoseconds} (Firestore raw timestamp)
    if (updatedAt.seconds !== undefined) {
        return new Date(updatedAt.seconds * 1000).toLocaleDateString('id-ID');
    }

    // Kalau string ISO atau number (timestamp)
    try {
        const d = new Date(updatedAt);
        if (!isNaN(d.getTime())) {
            return d.toLocaleDateString('id-ID');
        }
    } catch (e) {}

    return '-';
}

function countWords(text) {
    if (!text) return 0;
    return text.trim().split(/\s+/).filter(w => w.length > 0).length;
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function formatNumber(num) {
    return num.toLocaleString('id-ID');
}

// =========================================
// DOM ELEMENTS - DASHBOARD
// =========================================
const els = {
    // Screens
    dashboardScreen: document.getElementById('dashboard-screen'),
    storyDetailScreen: document.getElementById('story-detail-screen'),
    editorScreen: document.getElementById('editor-screen'),
    bibleScreen: document.getElementById('bible-screen'),
    bibleEditorScreen: document.getElementById('bible-editor-screen'),

    // Header & Auth
    syncStatus: document.getElementById('sync-status'),
    userName: document.getElementById('user-name'),
    btnLogin: document.getElementById('btn-login'),
    btnLogout: document.getElementById('btn-logout'),
    btnThemeToggle: document.getElementById('btn-theme-toggle'),

    // Search & Filter
    searchInput: document.getElementById('search-input'),
    btnClearSearch: document.getElementById('btn-clear-search'),
    filterChips: document.querySelectorAll('.chip'),
    projectsContainer: document.getElementById('projects-container'),
    projectCount: document.getElementById('project-count'),

    // Stats
    countDraft: document.getElementById('count-draft'),
    countEditing: document.getElementById('count-editing'),
    countPublished: document.getElementById('count-published'),

    // FAB & Modal
    btnNewStory: document.getElementById('btn-new-story'),
    newStoryModal: document.getElementById('new-story-modal'),
    btnCloseModal: document.getElementById('btn-close-modal'),
    btnCancelStory: document.getElementById('btn-cancel-story'),
    btnCreateStory: document.getElementById('btn-create-story'),
    newStoryTitle: document.getElementById('new-story-title'),
    newStorySynopsis: document.getElementById('new-story-synopsis'),

    // Story Detail
    detailStoryTitle: document.getElementById('detail-story-title'),
    detailStoryBadge: document.getElementById('detail-story-badge'),
    detailStoryMeta: document.getElementById('detail-story-meta'),
    detailStorySynopsis: document.getElementById('detail-story-synopsis'),
    storyStatusDropdown: document.getElementById('story-status-dropdown'),
    btnBackDashboard: document.getElementById('btn-back-dashboard'),
    btnOpenBible: document.getElementById('btn-open-bible'),
    btnNewChapter: document.getElementById('btn-new-chapter'),
    btnExportTxt: document.getElementById('btn-export-txt'),
    btnExportMd: document.getElementById('btn-export-md'),
    chaptersContainer: document.getElementById('chapters-container'),
    detailTotalChapters: document.getElementById('detail-total-chapters'),
    detailTotalWords: document.getElementById('detail-total-words'),
    detailEstRead: document.getElementById('detail-est-read'),

    // Editor
    editorTitle: document.getElementById('editor-title'),
    btnBack: document.getElementById('btn-back'),
    btnSave: document.getElementById('btn-save'),
    btnFocusMode: document.getElementById('btn-focus-mode'),
    chapterTitle: document.getElementById('chapter-title'),
    chapterContent: document.getElementById('chapter-content'),
    wordCount: document.getElementById('word-count'),
    charCount: document.getElementById('char-count'),
    readTime: document.getElementById('read-time'),
    btnEditorMenu: document.getElementById('btn-editor-menu'),
    editorSheet: document.getElementById('editor-sheet'),
    sheetExportTxt: document.getElementById('sheet-export-txt'),
    sheetExportMd: document.getElementById('sheet-export-md'),
    sheetExportJson: document.getElementById('sheet-export-json'),
    sheetDeleteChapter: document.getElementById('sheet-delete-chapter'),

    // Goal & Timer
    goalBar: document.getElementById('goal-bar'),
    goalDisplay: document.getElementById('goal-display'),
    goalProgressFill: document.getElementById('goal-progress-fill'),
    btnTimerToggle: document.getElementById('btn-timer-toggle'),
    btnGoalSettings: document.getElementById('btn-goal-settings'),
    goalModal: document.getElementById('goal-modal'),
    btnCloseGoal: document.getElementById('btn-close-goal'),
    btnSaveGoal: document.getElementById('btn-save-goal'),
    goalInput: document.getElementById('goal-input'),
    timerInput: document.getElementById('timer-input'),

    // Focus Mode
    focusOverlay: document.getElementById('focus-overlay'),
    btnExitFocus: document.getElementById('btn-exit-focus'),
    focusWordCount: document.getElementById('focus-word-count'),
    focusChapterTitle: document.getElementById('focus-chapter-title'),
    focusChapterContent: document.getElementById('focus-chapter-content'),

    // Bible
    bibleContainer: document.getElementById('bible-container'),
    btnBackDetailFromBible: document.getElementById('btn-back-detail-from-bible'),
    btnNewBible: document.getElementById('btn-new-bible'),
    bibleFilters: document.querySelectorAll('.bible-filter'),

    // Bible Editor
    bibleEditorTitle: document.getElementById('bible-editor-title'),
    btnCancelBible: document.getElementById('btn-cancel-bible'),
    btnSaveBible: document.getElementById('btn-save-bible'),
    bibleCategory: document.getElementById('bible-category'),
    bibleEntryTitle: document.getElementById('bible-entry-title'),
    bibleEntryContent: document.getElementById('bible-entry-content'),

    // System
    offlineBanner: document.getElementById('offline-banner'),
    toastContainer: document.getElementById('toast-container'),
};

// =========================================
// THEME SYSTEM
// =========================================
function initTheme() {
    const savedTheme = localStorage.getItem('inkflow-theme') || 'dark';
    document.documentElement.setAttribute('data-theme', savedTheme);
    updateThemeIcon(savedTheme);
}

function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme');
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('inkflow-theme', next);
    updateThemeIcon(next);
}

function updateThemeIcon(theme) {
    if (els.btnThemeToggle) {
        els.btnThemeToggle.textContent = theme === 'dark' ? '🌙' : '☀️';
    }
}

// =========================================
// TOAST NOTIFICATIONS
// =========================================
function showToast(message, type = 'info') {
    if (!els.toastContainer) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    els.toastContainer.appendChild(toast);

    setTimeout(() => {
        if (toast.parentNode) toast.remove();
    }, 3000);
}

// =========================================
// OFFLINE DETECTION
// =========================================
function initOfflineDetection() {
    function updateOnlineStatus() {
        if (navigator.onLine) {
            if (els.offlineBanner) els.offlineBanner.classList.add('hidden');
            if (els.syncStatus) els.syncStatus.textContent = '✅ Tersinkron';
        } else {
            if (els.offlineBanner) els.offlineBanner.classList.remove('hidden');
            if (els.syncStatus) els.syncStatus.textContent = '📡 Offline';
        }
    }

    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);
    updateOnlineStatus();
}

// =========================================
// SCREEN NAVIGATION
// =========================================
function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(s => {
        s.classList.add('hidden');
        s.classList.remove('slide-in-right', 'slide-in-left');
    });

    const screen = document.getElementById(screenId);
    if (screen) {
        screen.classList.remove('hidden');
        screen.classList.add('slide-in-right');
    }
}

function goBack() {
    if (els.editorScreen && !els.editorScreen.classList.contains('hidden')) {
        saveChapter(true);
    } else if (els.storyDetailScreen && !els.storyDetailScreen.classList.contains('hidden')) {
        showScreen('dashboard-screen');
    } else if (els.bibleScreen && !els.bibleScreen.classList.contains('hidden')) {
        showScreen('story-detail-screen');
    } else if (els.bibleEditorScreen && !els.bibleEditorScreen.classList.contains('hidden')) {
        showScreen('bible-screen');
    }
}

// =========================================
// AUTHENTICATION
// =========================================
function initAuth() {
    auth.onAuthStateChanged((user) => {
        if (user) {
            currentUser = user;
            if (els.userName) els.userName.textContent = user.displayName || user.email;
            if (els.btnLogin) els.btnLogin.classList.add('hidden');
            if (els.btnLogout) els.btnLogout.classList.remove('hidden');
            if (els.syncStatus) els.syncStatus.textContent = '✅ Tersinkron';
            loadStories();
        } else {
            currentUser = null;
            if (els.userName) els.userName.textContent = '';
            if (els.btnLogin) els.btnLogin.classList.remove('hidden');
            if (els.btnLogout) els.btnLogout.classList.add('hidden');
            if (els.syncStatus) els.syncStatus.textContent = '⚠️ Login untuk sinkron';
            renderStories([]);
            updateStats([]);
        }
    });
}

if (els.btnLogin) {
    els.btnLogin.addEventListener('click', () => {
        auth.signInWithPopup(provider).catch(err => {
            showToast('Gagal login: ' + err.message, 'error');
        });
    });
}

if (els.btnLogout) {
    els.btnLogout.addEventListener('click', () => {
        auth.signOut().then(() => {
            showToast('Berhasil logout', 'success');
        });
    });
}

// =========================================
// STORIES CRUD
// =========================================
async function loadStories() {
    if (!currentUser) return;

    try {
        // Show skeleton loading
        if (els.projectsContainer) {
            els.projectsContainer.innerHTML = `
                <div class="skeleton-card"><div class="skeleton-line w-60"></div><div class="skeleton-line w-40"></div></div>
                <div class="skeleton-card"><div class="skeleton-line w-60"></div><div class="skeleton-line w-40"></div></div>
                <div class="skeleton-card"><div class="skeleton-line w-60"></div><div class="skeleton-line w-40"></div></div>
            `;
        }

        const snapshot = await db.collection('users').doc(currentUser.uid)
            .collection('stories').orderBy('updatedAt', 'desc').get();

        allStories = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));

        renderStories(allStories);
        updateStats(allStories);
    } catch (err) {
        console.error('loadStories error:', err);
        showToast('Gagal memuat cerita', 'error');
        renderStories([]);
    }
}

function updateStats(stories) {
    const draft = stories.filter(s => s.status === 'Draft').length;
    const editing = stories.filter(s => s.status === 'Editing').length;
    const published = stories.filter(s => s.status === 'Published').length;

    animateNumber(els.countDraft, draft);
    animateNumber(els.countEditing, editing);
    animateNumber(els.countPublished, published);
}

function animateNumber(el, target) {
    if (!el) return;
    const start = parseInt(el.textContent) || 0;
    if (start === target) return;

    const duration = 500;
    const startTime = performance.now();

    function update(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const ease = 1 - Math.pow(1 - progress, 3);
        const current = Math.round(start + (target - start) * ease);

        el.textContent = current;

        if (progress < 1) {
            requestAnimationFrame(update);
        }
    }

    requestAnimationFrame(update);
}

function renderStories(stories) {
    if (!els.projectsContainer) return;
    els.projectsContainer.innerHTML = '';

    if (stories.length === 0) {
        els.projectsContainer.innerHTML = `
            <div style="text-align:center; padding:40px 20px; color:var(--text-tertiary);">
                <div style="font-size:3rem; margin-bottom:12px;">📚</div>
                <p>Belum ada cerita. Yuk mulai menulis!</p>
            </div>
        `;
        if (els.projectCount) els.projectCount.textContent = '0 cerita';
        return;
    }

    if (els.projectCount) els.projectCount.textContent = `${stories.length} cerita`;

    stories.forEach(story => {
        const card = document.createElement('div');
        card.className = 'project-card';
        card.setAttribute('data-status', story.status || 'Draft');
        card.setAttribute('data-id', story.id);

        const date = formatDate(story.updatedAt);
        const chapterCount = story.chapterCount || 0;
        const status = story.status || 'Draft';
        const statusClass = status.toLowerCase();

        card.innerHTML = `
            <h3>${escapeHtml(story.title || 'Tanpa Judul')}</h3>
            <p class="meta-data">📅 ${date} • ${chapterCount} bab</p>
            <div class="card-actions">
                <span class="badge badge-${statusClass}">${status}</span>
                <button class="btn-small btn-edit" data-action="edit" data-id="${story.id}">✏️ Edit</button>
                <button class="btn-small btn-delete" data-action="delete" data-id="${story.id}">🗑️ Hapus</button>
            </div>
        `;

        // Card click -> open detail
        card.addEventListener('click', (e) => {
            if (e.target.closest('[data-action]')) return;
            openStoryDetail(story.id);
        });

        // Edit button
        const editBtn = card.querySelector('[data-action="edit"]');
        if (editBtn) {
            editBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                editStory(story.id);
            });
        }

        // Delete button
        const deleteBtn = card.querySelector('[data-action="delete"]');
        if (deleteBtn) {
            deleteBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                deleteStory(story.id);
            });
        }

        els.projectsContainer.appendChild(card);
    });
}

// =========================================
// SEARCH & FILTER
// =========================================
let currentFilter = 'all';
let currentSearch = '';

function filterStories() {
    let filtered = allStories;

    if (currentFilter !== 'all') {
        filtered = filtered.filter(s => s.status === currentFilter);
    }

    if (currentSearch) {
        const q = currentSearch.toLowerCase();
        filtered = filtered.filter(s => 
            (s.title || '').toLowerCase().includes(q) ||
            (s.synopsis || '').toLowerCase().includes(q)
        );
    }

    renderStories(filtered);
}

if (els.searchInput) {
    els.searchInput.addEventListener('input', (e) => {
        currentSearch = e.target.value.trim();
        if (els.btnClearSearch) {
            els.btnClearSearch.classList.toggle('hidden', !currentSearch);
        }
        filterStories();
    });
}

if (els.btnClearSearch) {
    els.btnClearSearch.addEventListener('click', () => {
        if (els.searchInput) els.searchInput.value = '';
        currentSearch = '';
        els.btnClearSearch.classList.add('hidden');
        filterStories();
        if (els.searchInput) els.searchInput.focus();
    });
}

if (els.filterChips) {
    els.filterChips.forEach(chip => {
        chip.addEventListener('click', () => {
            els.filterChips.forEach(c => c.classList.remove('active'));
            chip.classList.add('active');
            currentFilter = chip.dataset.filter;
            filterStories();
        });
    });
}

// =========================================
// NEW STORY
// =========================================
if (els.btnNewStory) {
    els.btnNewStory.addEventListener('click', () => {
        if (els.newStoryModal) {
            els.newStoryModal.classList.remove('hidden');
            if (els.newStoryTitle) els.newStoryTitle.focus();
        }
    });
}

function closeNewStoryModal() {
    if (els.newStoryModal) els.newStoryModal.classList.add('hidden');
    if (els.newStoryTitle) els.newStoryTitle.value = '';
    if (els.newStorySynopsis) els.newStorySynopsis.value = '';
}

if (els.btnCloseModal) els.btnCloseModal.addEventListener('click', closeNewStoryModal);
if (els.btnCancelStory) els.btnCancelStory.addEventListener('click', closeNewStoryModal);

if (els.newStoryModal) {
    els.newStoryModal.addEventListener('click', (e) => {
        if (e.target === els.newStoryModal) closeNewStoryModal();
    });
}

if (els.btnCreateStory) {
    els.btnCreateStory.addEventListener('click', async () => {
        const title = els.newStoryTitle ? els.newStoryTitle.value.trim() : '';
        if (!title) {
            showToast('Judul cerita wajib diisi', 'error');
            return;
        }

        if (!currentUser) {
            showToast('Silakan login terlebih dahulu', 'error');
            return;
        }

        try {
            const now = firebase.firestore.FieldValue.serverTimestamp();
            const storyData = {
                title: title,
                synopsis: els.newStorySynopsis ? els.newStorySynopsis.value.trim() : '',
                status: 'Draft',
                chapterCount: 0,
                totalWords: 0,
                createdAt: now,
                updatedAt: now
            };

            await db.collection('users').doc(currentUser.uid)
                .collection('stories').add(storyData);

            showToast('Cerita berhasil dibuat!', 'success');
            closeNewStoryModal();
            loadStories();
        } catch (err) {
            console.error('createStory error:', err);
            showToast('Gagal membuat cerita', 'error');
        }
    });
}

async function editStory(storyId) {
    showToast('Fitur edit cerita segera hadir', 'info');
}

async function deleteStory(storyId) {
    if (!confirm('Yakin ingin menghapus cerita ini? Semua chapter akan ikut terhapus.')) return;

    try {
        // Delete chapters first
        const chaptersSnap = await db.collection('users').doc(currentUser.uid)
            .collection('stories').doc(storyId)
            .collection('chapters').get();

        const batch = db.batch();
        chaptersSnap.docs.forEach(doc => batch.delete(doc.ref));
        await batch.commit();

        // Delete story
        await db.collection('users').doc(currentUser.uid)
            .collection('stories').doc(storyId).delete();

        showToast('Cerita dihapus', 'success');
        loadStories();
    } catch (err) {
        console.error('deleteStory error:', err);
        showToast('Gagal menghapus cerita', 'error');
    }
}

// =========================================
// STORY DETAIL
// =========================================
async function openStoryDetail(storyId) {
    if (!currentUser) return;

    currentStoryId = storyId;
    const story = allStories.find(s => s.id === storyId);
    if (!story) return;

    currentStory = story;

    if (els.detailStoryTitle) els.detailStoryTitle.textContent = story.title || 'Tanpa Judul';
    if (els.detailStorySynopsis) els.detailStorySynopsis.textContent = story.synopsis || 'Tidak ada sinopsis.';

    const date = formatDate(story.updatedAt);
    if (els.detailStoryMeta) els.detailStoryMeta.textContent = `Terakhir diubah: ${date}`;
    if (els.storyStatusDropdown) els.storyStatusDropdown.value = story.status || 'Draft';

    // Update badge
    if (els.detailStoryBadge) {
        els.detailStoryBadge.className = `badge badge-${(story.status || 'draft').toLowerCase()}`;
        els.detailStoryBadge.textContent = story.status || 'Draft';
    }

    await loadChapters(storyId);
    showScreen('story-detail-screen');
}

async function loadChapters(storyId) {
    try {
        const snapshot = await db.collection('users').doc(currentUser.uid)
            .collection('stories').doc(storyId)
            .collection('chapters').orderBy('order', 'asc').get();

        const chapters = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));

        renderChapters(chapters);
        updateDetailStats(chapters);
    } catch (err) {
        console.error('loadChapters error:', err);
        showToast('Gagal memuat chapter', 'error');
    }
}

function renderChapters(chapters) {
    if (!els.chaptersContainer) return;
    els.chaptersContainer.innerHTML = '';

    if (chapters.length === 0) {
        els.chaptersContainer.innerHTML = `
            <div style="text-align:center; padding:30px; color:var(--text-tertiary);">
                <p>Belum ada chapter. Klik "+ Bab Baru" untuk mulai!</p>
            </div>
        `;
        return;
    }

    chapters.forEach((chapter, index) => {
        const card = document.createElement('div');
        card.className = 'chapter-card';
        card.setAttribute('data-id', chapter.id);

        const wordCount = countWords(chapter.content || '');
        const date = formatDate(chapter.updatedAt);
        const title = chapter.title || `Bab ${index + 1}`;

        card.innerHTML = `
            <div style="display:flex; align-items:center; gap:12px; flex:1;">
                <div class="chapter-number">${index + 1}</div>
                <div>
                    <h4>${escapeHtml(title)}</h4>
                    <span>${formatNumber(wordCount)} kata • ${date}</span>
                </div>
            </div>
        `;

        card.addEventListener('click', () => openEditor(chapter.id, chapter));
        els.chaptersContainer.appendChild(card);
    });
}

function updateDetailStats(chapters) {
    const totalChapters = chapters.length;
    const totalWords = chapters.reduce((sum, c) => sum + countWords(c.content || ''), 0);
    const estRead = Math.ceil(totalWords / 200);

    if (els.detailTotalChapters) els.detailTotalChapters.textContent = totalChapters;
    if (els.detailTotalWords) els.detailTotalWords.textContent = formatNumber(totalWords);
    if (els.detailEstRead) els.detailEstRead.textContent = `${estRead}m`;
}

if (els.storyStatusDropdown) {
    els.storyStatusDropdown.addEventListener('change', async () => {
        if (!currentStoryId || !currentUser) return;

        const newStatus = els.storyStatusDropdown.value;

        try {
            await db.collection('users').doc(currentUser.uid)
                .collection('stories').doc(currentStoryId)
                .update({ 
                    status: newStatus, 
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp() 
                });

            const story = allStories.find(s => s.id === currentStoryId);
            if (story) story.status = newStatus;

            if (els.detailStoryBadge) {
                els.detailStoryBadge.className = `badge badge-${newStatus.toLowerCase()}`;
                els.detailStoryBadge.textContent = newStatus;
            }

            showToast(`Status diubah ke ${newStatus}`, 'success');
            updateStats(allStories);
        } catch (err) {
            console.error('updateStatus error:', err);
            showToast('Gagal mengubah status', 'error');
        }
    });
}

if (els.btnBackDashboard) {
    els.btnBackDashboard.addEventListener('click', () => {
        loadStories();
        showScreen('dashboard-screen');
    });
}

if (els.btnOpenBible) {
    els.btnOpenBible.addEventListener('click', () => {
        loadBibleEntries();
        showScreen('bible-screen');
    });
}

if (els.btnNewChapter) {
    els.btnNewChapter.addEventListener('click', () => {
        openEditor(null, null);
    });
}

// =========================================
// EDITOR
// =========================================
function openEditor(chapterId, chapterData) {
    currentChapterId = chapterId;
    isEditingChapter = !!chapterId;

    if (els.editorTitle) els.editorTitle.textContent = currentStory?.title || 'Editor';
    if (els.chapterTitle) els.chapterTitle.value = chapterData?.title || '';
    if (els.chapterContent) els.chapterContent.value = chapterData?.content || '';

    updateEditorStats();
    updateGoalProgress();

    showScreen('editor-screen');
    if (els.chapterContent) els.chapterContent.focus();
}

if (els.btnBack) {
    els.btnBack.addEventListener('click', () => {
        saveChapter(true);
    });
}

if (els.btnSave) {
    els.btnSave.addEventListener('click', () => {
        saveChapter(false);
    });
}

async function saveChapter(silent = false) {
    if (!currentUser || !currentStoryId) return;

    const title = els.chapterTitle ? els.chapterTitle.value.trim() : '';
    const content = els.chapterContent ? els.chapterContent.value : '';

    if (!content.trim() && !title) {
        if (!silent) showToast('Chapter kosong, tidak disimpan', 'info');
        goBack();
        return;
    }

    try {
        const chapterData = {
            title: title || 'Bab Baru',
            content: content,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        };

        if (currentChapterId) {
            await db.collection('users').doc(currentUser.uid)
                .collection('stories').doc(currentStoryId)
                .collection('chapters').doc(currentChapterId)
                .update(chapterData);
        } else {
            const snap = await db.collection('users').doc(currentUser.uid)
                .collection('stories').doc(currentStoryId)
                .collection('chapters').get();

            chapterData.order = snap.size;
            chapterData.createdAt = firebase.firestore.FieldValue.serverTimestamp();

            const docRef = await db.collection('users').doc(currentUser.uid)
                .collection('stories').doc(currentStoryId)
                .collection('chapters').add(chapterData);

            currentChapterId = docRef.id;
            isEditingChapter = true;
        }

        await updateStoryWordCount();

        if (!silent) showToast('Chapter disimpan!', 'success');
        if (silent) goBack();
    } catch (err) {
        console.error('saveChapter error:', err);
        showToast('Gagal menyimpan', 'error');
    }
}

async function updateStoryWordCount() {
    try {
        const snap = await db.collection('users').doc(currentUser.uid)
            .collection('stories').doc(currentStoryId)
            .collection('chapters').get();

        const chapters = snap.docs.map(d => d.data());
        const totalWords = chapters.reduce((sum, c) => sum + countWords(c.content || ''), 0);
        const chapterCount = chapters.length;

        await db.collection('users').doc(currentUser.uid)
            .collection('stories').doc(currentStoryId)
            .update({
                totalWords,
                chapterCount,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
    } catch (err) {
        console.error('updateStoryWordCount error:', err);
    }
}

function updateEditorStats() {
    const text = els.chapterContent ? els.chapterContent.value : '';
    const words = countWords(text);
    const chars = text.length;
    const readTime = Math.ceil(words / 200);

    if (els.wordCount) els.wordCount.textContent = `${formatNumber(words)} kata`;
    if (els.charCount) els.charCount.textContent = `${formatNumber(chars)} karakter`;
    if (els.readTime) els.readTime.textContent = `${readTime}m baca`;

    updateGoalProgress();
}

if (els.chapterContent) {
    els.chapterContent.addEventListener('input', updateEditorStats);
}
if (els.chapterTitle) {
    els.chapterTitle.addEventListener('input', updateEditorStats);
}

// =========================================
// GOAL & TIMER
// =========================================
function updateGoalProgress() {
    const words = countWords(els.chapterContent ? els.chapterContent.value : '');
    const percent = Math.min((words / wordGoal) * 100, 100);

    if (els.goalDisplay) els.goalDisplay.textContent = `Target: ${formatNumber(words)}/${formatNumber(wordGoal)} kata`;
    if (els.goalProgressFill) els.goalProgressFill.style.width = `${percent}%`;

    if (percent >= 100) {
        if (els.goalProgressFill) els.goalProgressFill.style.background = 'linear-gradient(90deg, #4cd964, #30d158)';
    } else {
        if (els.goalProgressFill) els.goalProgressFill.style.background = 'linear-gradient(90deg, var(--accent-blue), var(--accent-purple))';
    }
}

if (els.btnGoalSettings) {
    els.btnGoalSettings.addEventListener('click', () => {
        if (els.goalModal) {
            els.goalModal.classList.remove('hidden');
            if (els.goalInput) els.goalInput.value = wordGoal;
            if (els.timerInput) els.timerInput.value = timerSeconds / 60;
        }
    });
}

if (els.btnCloseGoal) {
    els.btnCloseGoal.addEventListener('click', () => {
        if (els.goalModal) els.goalModal.classList.add('hidden');
    });
}

if (els.goalModal) {
    els.goalModal.addEventListener('click', (e) => {
        if (e.target === els.goalModal) els.goalModal.classList.add('hidden');
    });
}

if (els.btnSaveGoal) {
    els.btnSaveGoal.addEventListener('click', () => {
        wordGoal = parseInt(els.goalInput ? els.goalInput.value : 500) || 500;
        timerSeconds = (parseInt(els.timerInput ? els.timerInput.value : 25) || 25) * 60;

        localStorage.setItem('inkflow-goal', wordGoal);
        localStorage.setItem('inkflow-timer', timerSeconds);

        updateGoalProgress();
        updateTimerDisplay();
        if (els.goalModal) els.goalModal.classList.add('hidden');
        showToast('Pengaturan disimpan', 'success');
    });
}

function updateTimerDisplay() {
    const mins = Math.floor(timerSeconds / 60);
    const secs = timerSeconds % 60;
    const timeStr = `${mins}:${secs.toString().padStart(2, '0')}`;
    if (els.btnTimerToggle) {
        els.btnTimerToggle.textContent = timerRunning ? `⏸️ ${timeStr}` : `▶️ ${timeStr}`;
    }
}

if (els.btnTimerToggle) {
    els.btnTimerToggle.addEventListener('click', () => {
        if (timerRunning) {
            clearInterval(writingTimer);
            timerRunning = false;
            if (els.btnTimerToggle) els.btnTimerToggle.classList.remove('active');
        } else {
            timerRunning = true;
            if (els.btnTimerToggle) els.btnTimerToggle.classList.add('active');
            writingTimer = setInterval(() => {
                timerSeconds--;
                updateTimerDisplay();

                if (timerSeconds <= 0) {
                    clearInterval(writingTimer);
                    timerRunning = false;
                    if (els.btnTimerToggle) els.btnTimerToggle.classList.remove('active');
                    showToast('⏰ Waktu habis! Istirahat dulu yuk.', 'info');
                    const savedTimer = localStorage.getItem('inkflow-timer');
                    timerSeconds = savedTimer ? parseInt(savedTimer) : 25 * 60;
                }
            }, 1000);
        }
        updateTimerDisplay();
    });
}

// =========================================
// FOCUS MODE
// =========================================
if (els.btnFocusMode) {
    els.btnFocusMode.addEventListener('click', () => {
        if (els.focusChapterTitle) els.focusChapterTitle.value = els.chapterTitle ? els.chapterTitle.value : '';
        if (els.focusChapterContent) els.focusChapterContent.value = els.chapterContent ? els.chapterContent.value : '';
        if (els.focusOverlay) els.focusOverlay.classList.remove('hidden');
        if (els.focusChapterContent) els.focusChapterContent.focus();
    });
}

if (els.btnExitFocus) {
    els.btnExitFocus.addEventListener('click', () => {
        if (els.chapterTitle) els.chapterTitle.value = els.focusChapterTitle ? els.focusChapterTitle.value : '';
        if (els.chapterContent) els.chapterContent.value = els.focusChapterContent ? els.focusChapterContent.value : '';
        if (els.focusOverlay) els.focusOverlay.classList.add('hidden');
        updateEditorStats();
    });
}

if (els.focusChapterContent) {
    els.focusChapterContent.addEventListener('input', () => {
        const words = countWords(els.focusChapterContent.value);
        if (els.focusWordCount) els.focusWordCount.textContent = `${formatNumber(words)} kata`;
    });
}

// =========================================
// EDITOR BOTTOM SHEET
// =========================================
if (els.btnEditorMenu) {
    els.btnEditorMenu.addEventListener('click', () => {
        if (els.editorSheet) els.editorSheet.classList.remove('hidden');
    });
}

if (els.editorSheet) {
    els.editorSheet.addEventListener('click', (e) => {
        if (e.target === els.editorSheet) els.editorSheet.classList.add('hidden');
    });
}

if (els.sheetExportTxt) {
    els.sheetExportTxt.addEventListener('click', () => {
        exportChapter('txt');
        if (els.editorSheet) els.editorSheet.classList.add('hidden');
    });
}
if (els.sheetExportMd) {
    els.sheetExportMd.addEventListener('click', () => {
        exportChapter('md');
        if (els.editorSheet) els.editorSheet.classList.add('hidden');
    });
}
if (els.sheetExportJson) {
    els.sheetExportJson.addEventListener('click', () => {
        exportChapter('json');
        if (els.editorSheet) els.editorSheet.classList.add('hidden');
    });
}

if (els.sheetDeleteChapter) {
    els.sheetDeleteChapter.addEventListener('click', async () => {
        if (els.editorSheet) els.editorSheet.classList.add('hidden');
        if (!currentChapterId || !confirm('Yakin hapus chapter ini?')) return;

        try {
            await db.collection('users').doc(currentUser.uid)
                .collection('stories').doc(currentStoryId)
                .collection('chapters').doc(currentChapterId).delete();

            showToast('Chapter dihapus', 'success');
            goBack();
        } catch (err) {
            console.error('deleteChapter error:', err);
            showToast('Gagal menghapus', 'error');
        }
    });
}

function exportChapter(format) {
    const title = els.chapterTitle ? els.chapterTitle.value : 'Untitled';
    const content = els.chapterContent ? els.chapterContent.value : '';

    let blob, filename;

    switch(format) {
        case 'txt':
            blob = new Blob([`${title}\n\n${content}`], { type: 'text/plain' });
            filename = `${title}.txt`;
            break;
        case 'md':
            blob = new Blob([`# ${title}\n\n${content}`], { type: 'text/markdown' });
            filename = `${title}.md`;
            break;
        case 'json':
            blob = new Blob([JSON.stringify({ 
                title, 
                content, 
                exportedAt: new Date().toISOString() 
            }, null, 2)], { type: 'application/json' });
            filename = `${title}.json`;
            break;
        default:
            return;
    }

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    showToast(`Diekspor sebagai ${format.toUpperCase()}`, 'success');
}

// Detail exports
if (els.btnExportTxt) {
    els.btnExportTxt.addEventListener('click', () => exportStory('txt'));
}
if (els.btnExportMd) {
    els.btnExportMd.addEventListener('click', () => exportStory('md'));
}

async function exportStory(format) {
    if (!currentStoryId || !currentUser) return;

    try {
        const snap = await db.collection('users').doc(currentUser.uid)
            .collection('stories').doc(currentStoryId)
            .collection('chapters').orderBy('order', 'asc').get();

        const chapters = snap.docs.map(d => d.data());
        const story = currentStory;

        let content = '';
        let filename = `${story.title || 'Cerita'}.${format}`;

        if (format === 'txt') {
            content = `${story.title || 'Tanpa Judul'}\n${'='.repeat(40)}\n\n`;
            content += `Sinopsis: ${story.synopsis || '-'}\n\n`;
            content += `${'='.repeat(40)}\n\n`;
            chapters.forEach((ch, i) => {
                content += `BAB ${i + 1}: ${ch.title || `Bab ${i + 1}`}\n\n`;
                content += `${ch.content || ''}\n\n`;
                content += `${'-'.repeat(40)}\n\n`;
            });
        } else if (format === 'md') {
            content = `# ${story.title || 'Tanpa Judul'}\n\n`;
            content += `> ${story.synopsis || '-'}\n\n`;
            content += `---\n\n`;
            chapters.forEach((ch, i) => {
                content += `## ${ch.title || `Bab ${i + 1}`}\n\n`;
                content += `${ch.content || ''}\n\n`;
            });
        }

        const blob = new Blob([content], { type: format === 'md' ? 'text/markdown' : 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        showToast(`Cerita diekspor sebagai ${format.toUpperCase()}`, 'success');
    } catch (err) {
        console.error('exportStory error:', err);
        showToast('Gagal mengekspor', 'error');
    }
}

// =========================================
// BIBLE
// =========================================
let bibleEntries = [];
let currentBibleFilter = 'all';

async function loadBibleEntries() {
    if (!currentUser || !currentStoryId) return;

    try {
        const snapshot = await db.collection('users').doc(currentUser.uid)
            .collection('stories').doc(currentStoryId)
            .collection('bible').orderBy('createdAt', 'desc').get();

        bibleEntries = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));

        renderBibleEntries();
    } catch (err) {
        console.error('loadBibleEntries error:', err);
        showToast('Gagal memuat Story Bible', 'error');
    }
}

function renderBibleEntries() {
    if (!els.bibleContainer) return;
    els.bibleContainer.innerHTML = '';

    let filtered = bibleEntries;
    if (currentBibleFilter !== 'all') {
        filtered = bibleEntries.filter(e => e.category === currentBibleFilter);
    }

    if (filtered.length === 0) {
        els.bibleContainer.innerHTML = `
            <div style="text-align:center; padding:30px; color:var(--text-tertiary);">
                <p>Belum ada entri. Klik "+ Entri" untuk menambah!</p>
            </div>
        `;
        return;
    }

    filtered.forEach(entry => {
        const card = document.createElement('div');
        card.className = 'bible-card';
        card.setAttribute('data-id', entry.id);

        card.innerHTML = `
            <span class="badge-bible">${escapeHtml(entry.category || 'Lainnya')}</span>
            <h4>${escapeHtml(entry.title || 'Tanpa Judul')}</h4>
            <p>${escapeHtml(entry.content || '')}</p>
        `;

        card.addEventListener('click', () => openBibleEditor(entry));
        els.bibleContainer.appendChild(card);
    });
}

if (els.bibleFilters) {
    els.bibleFilters.forEach(filter => {
        filter.addEventListener('click', () => {
            els.bibleFilters.forEach(f => f.classList.remove('active'));
            filter.classList.add('active');
            currentBibleFilter = filter.dataset.category;
            renderBibleEntries();
        });
    });
}

if (els.btnBackDetailFromBible) {
    els.btnBackDetailFromBible.addEventListener('click', () => {
        showScreen('story-detail-screen');
    });
}

if (els.btnNewBible) {
    els.btnNewBible.addEventListener('click', () => {
        openBibleEditor(null);
    });
}

function openBibleEditor(entry) {
    isEditingBible = !!entry;
    currentBibleId = entry?.id || null;

    if (els.bibleEditorTitle) els.bibleEditorTitle.textContent = entry ? 'Edit Entri' : 'Entri Baru';
    if (els.bibleCategory) els.bibleCategory.value = entry?.category || 'Karakter';
    if (els.bibleEntryTitle) els.bibleEntryTitle.value = entry?.title || '';
    if (els.bibleEntryContent) els.bibleEntryContent.value = entry?.content || '';

    showScreen('bible-editor-screen');
    if (els.bibleEntryTitle) els.bibleEntryTitle.focus();
}

if (els.btnCancelBible) {
    els.btnCancelBible.addEventListener('click', () => {
        showScreen('bible-screen');
    });
}

if (els.btnSaveBible) {
    els.btnSaveBible.addEventListener('click', async () => {
        const title = els.bibleEntryTitle ? els.bibleEntryTitle.value.trim() : '';
        if (!title) {
            showToast('Judul entri wajib diisi', 'error');
            return;
        }

        try {
            const data = {
                title: title,
                category: els.bibleCategory ? els.bibleCategory.value : 'Lainnya',
                content: els.bibleEntryContent ? els.bibleEntryContent.value : '',
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            };

            if (isEditingBible && currentBibleId) {
                await db.collection('users').doc(currentUser.uid)
                    .collection('stories').doc(currentStoryId)
                    .collection('bible').doc(currentBibleId)
                    .update(data);
            } else {
                data.createdAt = firebase.firestore.FieldValue.serverTimestamp();
                await db.collection('users').doc(currentUser.uid)
                    .collection('stories').doc(currentStoryId)
                    .collection('bible').add(data);
            }

            showToast('Entri Bible disimpan!', 'success');
            loadBibleEntries();
            showScreen('bible-screen');
        } catch (err) {
            console.error('saveBible error:', err);
            showToast('Gagal menyimpan entri', 'error');
        }
    });
}

// =========================================
// KEYBOARD SHORTCUTS
// =========================================
document.addEventListener('keydown', (e) => {
    // Ctrl+S = Save
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        if (els.editorScreen && !els.editorScreen.classList.contains('hidden')) {
            saveChapter(false);
        }
    }

    // Ctrl+Shift+F = Focus Mode
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'F') {
        e.preventDefault();
        if (els.editorScreen && !els.editorScreen.classList.contains('hidden') && els.btnFocusMode) {
            els.btnFocusMode.click();
        }
    }

    // Escape = Close modal/sheet/go back
    if (e.key === 'Escape') {
        if (els.goalModal && !els.goalModal.classList.contains('hidden')) {
            els.goalModal.classList.add('hidden');
        } else if (els.newStoryModal && !els.newStoryModal.classList.contains('hidden')) {
            closeNewStoryModal();
        } else if (els.editorSheet && !els.editorSheet.classList.contains('hidden')) {
            els.editorSheet.classList.add('hidden');
        } else if (els.focusOverlay && !els.focusOverlay.classList.contains('hidden')) {
            if (els.btnExitFocus) els.btnExitFocus.click();
        } else {
            goBack();
        }
    }
});

// =========================================
// SWIPE GESTURES (Mobile)
// =========================================
let touchStartX = 0;
let touchEndX = 0;

document.addEventListener('touchstart', (e) => {
    touchStartX = e.changedTouches[0].screenX;
}, { passive: true });

document.addEventListener('touchend', (e) => {
    touchEndX = e.changedTouches[0].screenX;
    handleSwipe();
}, { passive: true });

function handleSwipe() {
    const threshold = 100;
    const diff = touchEndX - touchStartX;

    if (diff > threshold && touchStartX < 50) {
        goBack();
    }
}

// =========================================
// SERVICE WORKER REGISTRATION
// =========================================
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js')
        .then(reg => console.log('SW registered'))
        .catch(err => console.log('SW error:', err));
}

// =========================================
// INITIALIZATION
// =========================================
function init() {
    // Load saved settings
    const savedGoal = localStorage.getItem('inkflow-goal');
    const savedTimer = localStorage.getItem('inkflow-timer');
    if (savedGoal) wordGoal = parseInt(savedGoal);
    if (savedTimer) timerSeconds = parseInt(savedTimer);

    updateTimerDisplay();
    initTheme();
    initOfflineDetection();
    initAuth();

    // Event listeners
    if (els.btnThemeToggle) {
        els.btnThemeToggle.addEventListener('click', toggleTheme);
    }

    // Prevent pull-to-refresh on mobile
    document.body.style.overscrollBehavior = 'none';
}

// Run when DOM ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
