/* =====================================================
   MINERVA — notes.js
   Connected to real backend API
   ===================================================== */
(function () {
  'use strict';

  // ── Auth Guard ──────────────────────────────────
  const token = localStorage.getItem('token');
  const user  = JSON.parse(localStorage.getItem('user') || 'null');
  if (!token || !user) {
    window.location.href = '../auth/login.html';
  }

  // ── Show user initials ──────────────────────────
  if (user) {
    const initials = user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    const avatarEl = document.querySelector('.avatar-initials');
    if (avatarEl) avatarEl.textContent = initials;
  }

  // ══════════════════════════════════════════════════
  // STATE
  // ══════════════════════════════════════════════════
  let notes        = [];
  let activeId     = null;
  let isDirty      = false;
  let activeFilter = 'all';
  let searchQuery  = '';
  let saveTimer    = null;

  // ══════════════════════════════════════════════════
  // DOM REFS
  // ══════════════════════════════════════════════════
  const sidebar        = document.getElementById('sidebar');
  const sidebarToggle  = document.getElementById('sidebarToggle');
  const panelToggleBtn = document.getElementById('panelToggleBtn');
  const listPanel      = document.getElementById('listPanel');
  const notesList      = document.getElementById('notesList');
  const emptyState     = document.getElementById('emptyState');
  const noteCountBadge = document.getElementById('noteCountBadge');
  const listSearch     = document.getElementById('listSearch');
  const topSearch      = document.getElementById('topSearch');
  const newNoteBtn     = document.getElementById('newNoteBtn');
  const eeNewBtn       = document.getElementById('eeNewBtn');
  const editorEmpty    = document.getElementById('editorEmpty');
  const editorToolbar  = document.getElementById('editorToolbar');
  const noteTitleInput = document.getElementById('noteTitleInput');
  const noteContent    = document.getElementById('noteContent');
  const tagsList       = document.getElementById('tagsList');
  const tagInput       = document.getElementById('tagInput');
  const wordCount      = document.getElementById('wordCount');
  const charCount      = document.getElementById('charCount');
  const unsavedInd     = document.getElementById('unsavedIndicator');
  const saveBtn        = document.getElementById('saveBtn');
  const saveBtnLabel   = document.getElementById('saveBtnLabel');
  const deleteNoteBtn  = document.getElementById('deleteNoteBtn');

  // ══════════════════════════════════════════════════
  // API HELPERS
  // ══════════════════════════════════════════════════
  const API = 'http://localhost:4000/api/notes';
  const headers = () => ({
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  });

  async function apiFetch(url, options = {}) {
    const res = await fetch(url, { ...options, headers: headers() });
    return res.json();
  }

  // ══════════════════════════════════════════════════
  // HELPERS
  // ══════════════════════════════════════════════════
  function relativeTime(ts) {
    const diff  = Date.now() - new Date(ts).getTime();
    const mins  = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days  = Math.floor(diff / 86400000);
    if (mins  < 1)  return 'just now';
    if (mins  < 60) return mins  + 'm ago';
    if (hours < 24) return hours + 'h ago';
    if (days  < 7)  return days  + (days === 1 ? ' day ago' : ' days ago');
    return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  function getContentText() {
    return noteContent.innerText || '';
  }

  function updateCounts() {
    const text  = getContentText().trim();
    const words = text.length === 0 ? 0 : text.split(/\s+/).filter(Boolean).length;
    wordCount.textContent = words + (words === 1 ? ' word' : ' words');
    charCount.textContent = text.length + ' chars';
  }

  function tagClass(tag) {
    const map = { idea: 'tag-idea', Idea: 'tag-idea', research: 'tag-research', Research: 'tag-research', project: 'tag-project', Project: 'tag-project' };
    return map[tag] || 'tag-default';
  }

  function escHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function findNote(id) {
    return notes.find(n => n.id === id) || null;
  }

  // ══════════════════════════════════════════════════
  // RENDER: NOTES LIST
  // ══════════════════════════════════════════════════
  function renderList() {
    const q = searchQuery.toLowerCase();
    const filtered = notes.filter(n => {
      const matchSearch = !q ||
        (n.title || '').toLowerCase().includes(q) ||
        (n.content || '').toLowerCase().includes(q) ||
        (n.tags || []).some(t => t.toLowerCase().includes(q));
      const matchFilter = activeFilter === 'all' ||
        (n.tag || '').toLowerCase() === activeFilter ||
        (n.tags || []).map(t => t.toLowerCase()).includes(activeFilter);
      return matchSearch && matchFilter;
    });

    noteCountBadge.textContent = notes.length + (notes.length === 1 ? ' note' : ' notes');
    notesList.innerHTML = '';

    if (filtered.length === 0) {
      emptyState.style.display = 'flex';
      notesList.style.display  = 'none';
    } else {
      emptyState.style.display = 'none';
      notesList.style.display  = 'flex';

      filtered.forEach((note, i) => {
        const item = document.createElement('div');
        item.className = 'note-list-item' + (note.id === activeId ? ' active' : '');
        item.dataset.id = note.id;
        item.style.animationDelay = (i * 35) + 'ms';
        item.innerHTML = `
          <div class="nli-header">
            <span class="nli-tag ${tagClass(note.tag)}">${escHtml(note.tag || 'note')}</span>
            <span class="nli-date">${relativeTime(note.updatedAt)}</span>
          </div>
          <div class="nli-title">${escHtml(note.title || 'Untitled')}</div>
          <div class="nli-preview">${escHtml((note.content || '').slice(0, 100))}</div>
        `;
        item.addEventListener('click', () => selectNote(note.id));
        notesList.appendChild(item);
      });
    }
  }

  // ══════════════════════════════════════════════════
  // RENDER: EDITOR
  // ══════════════════════════════════════════════════
  function renderEditor(note) {
    if (!note) {
      editorEmpty.classList.remove('hidden');
      editorToolbar.style.opacity = '0.4';
      editorToolbar.style.pointerEvents = 'none';
      noteTitleInput.value  = '';
      noteContent.innerHTML = '';
      tagsList.innerHTML    = '';
      deleteNoteBtn.style.display = 'none';
      setDirty(false);
      updateCounts();
      return;
    }

    editorEmpty.classList.add('hidden');
    editorToolbar.style.opacity = '';
    editorToolbar.style.pointerEvents = '';
    deleteNoteBtn.style.display = 'flex';

    noteTitleInput.value  = note.title || '';
    noteContent.innerHTML = (note.content || '').replace(/\n/g, '<br>');

    renderTags(note.tags || []);
    updateCounts();
    setDirty(false);

    const body = document.querySelector('.editor-body');
    if (body) body.scrollTop = 0;
  }

  function renderTags(tags) {
    tagsList.innerHTML = '';
    tags.forEach(tag => {
      const pill = document.createElement('span');
      pill.className = 'tag-pill';
      pill.innerHTML = `${escHtml(tag)}<button class="tag-remove" data-tag="${escHtml(tag)}" title="Remove tag">✕</button>`;
      pill.querySelector('.tag-remove').addEventListener('click', (e) => {
        e.stopPropagation();
        removeTag(tag);
      });
      tagsList.appendChild(pill);
    });
  }

  // ══════════════════════════════════════════════════
  // DIRTY STATE
  // ══════════════════════════════════════════════════
  function setDirty(val) {
    isDirty = val;
    unsavedInd.style.opacity = val ? '1' : '0';
  }

  // ══════════════════════════════════════════════════
  // NOTE ACTIONS
  // ══════════════════════════════════════════════════
  function selectNote(id) {
    if (isDirty && activeId !== null) commitSave(false);
    activeId = id;
    renderEditor(findNote(id));
    renderList();
    if (window.innerWidth <= 640) listPanel.classList.add('hidden-mobile');
  }

  async function createNote() {
    try {
      const data = await apiFetch(API, {
        method: 'POST',
        body: JSON.stringify({ title: '', content: '', tag: 'Idea', tags: [] })
      });

      if (data.note) {
        notes.unshift(data.note);
        selectNote(data.note.id);
        renderList();
        setTimeout(() => noteTitleInput.focus(), 50);
      }
    } catch (err) {
      console.error('Failed to create note:', err);
    }
  }

  async function deleteNote() {
    if (!activeId) return;
    const note  = findNote(activeId);
    const title = note ? (note.title || 'Untitled') : '';
    if (!confirm(`Delete "${title}"? This cannot be undone.`)) return;

    try {
      await apiFetch(`${API}/${activeId}`, { method: 'DELETE' });
      notes  = notes.filter(n => n.id !== activeId);
      activeId = notes.length > 0 ? notes[0].id : null;
      renderEditor(activeId ? findNote(activeId) : null);
      renderList();
    } catch (err) {
      console.error('Failed to delete note:', err);
    }
  }

  async function commitSave(showFeedback = true) {
    if (!activeId) return;
    const note = findNote(activeId);
    if (!note) return;

    const title   = noteTitleInput.value.trim() || 'Untitled';
    const content = noteContent.innerHTML.replace(/<br>/g, '\n').replace(/<[^>]+>/g, '');
    const tags    = Array.from(tagsList.querySelectorAll('.tag-pill'))
                        .map(p => p.childNodes[0].textContent.trim())
                        .filter(Boolean);

    // Infer tag from tags array
    const catMap  = { idea: 'Idea', research: 'Research', project: 'Project' };
    const found   = tags.find(t => catMap[t.toLowerCase()]);
    const tag     = found ? catMap[found.toLowerCase()] : (note.tag || 'Note');

    try {
      const data = await apiFetch(`${API}/${activeId}`, {
        method: 'PUT',
        body: JSON.stringify({ title, content, tag, tags })
      });

      if (data.note) {
        const idx = notes.findIndex(n => n.id === activeId);
        if (idx !== -1) notes[idx] = data.note;
      }

      setDirty(false);
      renderList();

      if (showFeedback) {
        saveBtn.classList.add('saving');
        saveBtnLabel.textContent = 'Saved ✓';
        clearTimeout(saveTimer);
        saveTimer = setTimeout(() => {
          saveBtn.classList.remove('saving');
          saveBtnLabel.textContent = 'Save';
        }, 1400);
      }
    } catch (err) {
      console.error('Failed to save note:', err);
    }
  }

  function addTag(raw) {
    if (!activeId) return;
    const tag  = raw.trim().toLowerCase().replace(/[^a-z0-9-]/g, '');
    if (!tag) return;
    const note = findNote(activeId);
    if (!note || (note.tags || []).includes(tag)) return;
    note.tags = [...(note.tags || []), tag];
    renderTags(note.tags);
    setDirty(true);
  }

  function removeTag(tag) {
    if (!activeId) return;
    const note = findNote(activeId);
    if (!note) return;
    note.tags = (note.tags || []).filter(t => t !== tag);
    renderTags(note.tags);
    setDirty(true);
  }

  // ══════════════════════════════════════════════════
  // LOAD NOTES FROM API
  // ══════════════════════════════════════════════════
  async function loadNotes() {
    try {
      const data = await apiFetch(API);
      if (data.notes) {
        notes = data.notes;
        renderList();
      }
    } catch (err) {
      console.error('Failed to load notes:', err);
    }
  }

  // ══════════════════════════════════════════════════
  // EVENT LISTENERS
  // ══════════════════════════════════════════════════
  sidebarToggle.addEventListener('click', () => sidebar.classList.toggle('collapsed'));

  panelToggleBtn.addEventListener('click', () => listPanel.classList.toggle('hidden-mobile'));

  newNoteBtn.addEventListener('click', createNote);
  eeNewBtn.addEventListener('click',  createNote);

  deleteNoteBtn.addEventListener('click', deleteNote);

  saveBtn.addEventListener('click', () => commitSave(true));

  document.addEventListener('keydown', e => {
    if ((e.metaKey || e.ctrlKey) && e.key === 's') {
      e.preventDefault();
      commitSave(true);
    }
  });

  noteTitleInput.addEventListener('input', () => { if (activeId) setDirty(true); });

  noteContent.addEventListener('input', () => {
    if (activeId) setDirty(true);
    updateCounts();
  });

  tagInput.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addTag(tagInput.value);
      tagInput.value = '';
    }
  });

  tagInput.addEventListener('blur', () => {
    if (tagInput.value.trim()) {
      addTag(tagInput.value);
      tagInput.value = '';
    }
  });

  listSearch.addEventListener('input', e => {
    searchQuery = e.target.value;
    renderList();
  });

  topSearch.addEventListener('input', e => {
    searchQuery = e.target.value;
    listSearch.value = searchQuery;
    renderList();
  });

  document.querySelectorAll('.filter-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      activeFilter = chip.dataset.filter;
      renderList();
    });
  });

  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', e => {
      if (item.getAttribute('href') === '#') {
        e.preventDefault();
        document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
        item.classList.add('active');
      }
    });
  });

  // ══════════════════════════════════════════════════
  // INIT
  // ══════════════════════════════════════════════════
  loadNotes();
  renderEditor(null);

})();