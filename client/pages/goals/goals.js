(function() {
  'use strict';

  // ── Auth guard ──────────────────────────────
  const token = localStorage.getItem('token');
  const user  = JSON.parse(localStorage.getItem('user') || 'null');
  if (!token || !user) window.location.href = '../auth/login.html';

  if (user) {
    const initials = user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0,2);
    const el = document.getElementById('avatarInitials');
    if (el) el.textContent = initials;
  }

  // ── State ───────────────────────────────────
  let goals        = [];
  let editingId    = null;
  let milestones   = [];
  let activeFilter = 'all';
  let searchQuery  = '';
  let sortBy       = 'updated';

  // ── DOM ─────────────────────────────────────
  const sidebar        = document.getElementById('sidebar');
  const sidebarToggle  = document.getElementById('sidebarToggle');
  const goalsGrid      = document.getElementById('goalsGrid');
  const newGoalBtn     = document.getElementById('newGoalBtn');
  const modalOverlay   = document.getElementById('modalOverlay');
  const modalClose     = document.getElementById('modalClose');
  const btnCancel      = document.getElementById('btnCancel');
  const btnSave        = document.getElementById('btnSave');
  const modalTitle     = document.getElementById('modalTitle');
  const goalName       = document.getElementById('goalName');
  const goalDesc       = document.getElementById('goalDesc');
  const goalCategory   = document.getElementById('goalCategory');
  const goalStatus     = document.getElementById('goalStatus');
  const goalProgress   = document.getElementById('goalProgress');
  const goalDue        = document.getElementById('goalDue');
  const milestoneList  = document.getElementById('milestoneList');
  const milestoneInput = document.getElementById('milestoneInput');
  const addMilestoneBtn= document.getElementById('addMilestoneBtn');
  const searchInput    = document.getElementById('searchInput');
  const sortSelect     = document.getElementById('sortSelect');

  // ── API ─────────────────────────────────────
  const API = 'http://localhost:4000/api/goals';
  const authHeaders = () => ({
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  });
  async function apiFetch(url, options = {}) {
    const res = await fetch(url, { ...options, headers: authHeaders() });
    return res.json();
  }

  // ── Helpers ─────────────────────────────────
  function normalizeGoal(g) {
    return {
      ...g,
      milestones: Array.isArray(g.milestones) ? g.milestones : [],
      updatedAt: new Date(g.updatedAt).getTime()
    };
  }

  function relativeTime(ts) {
    const diff = Date.now() - ts;
    const mins = Math.floor(diff/60000), hrs = Math.floor(diff/3600000), days = Math.floor(diff/86400000);
    if (mins < 1) return 'just now';
    if (mins < 60) return mins + 'm ago';
    if (hrs < 24) return hrs + 'h ago';
    if (days < 7) return days + (days===1?' day ago':' days ago');
    return new Date(ts).toLocaleDateString('en-US',{month:'short',day:'numeric'});
  }

  function dueLabel(dateStr, status) {
    if (status === 'completed') return { text: 'Completed', cls: 'done' };
    if (!dateStr) return { text: 'No due date', cls: '' };
    const due = new Date(dateStr);
    const diff = Math.ceil((due - new Date()) / 86400000);
    if (diff < 0) return { text: `${Math.abs(diff)}d overdue`, cls: 'over' };
    if (diff === 0) return { text: 'Due today', cls: 'soon' };
    if (diff <= 7) return { text: `Due in ${diff}d`, cls: 'soon' };
    return { text: `Due ${due.toLocaleDateString('en-US',{month:'short',day:'numeric'})}`, cls: '' };
  }

  function catClass(cat) {
    const map = { work:'cat-work', health:'cat-health', learning:'cat-learning', personal:'cat-personal', finance:'cat-finance' };
    return map[cat] || 'cat-work';
  }

  function fillClass(status) {
    const map = { active:'fill-active', completed:'fill-completed', paused:'fill-paused', overdue:'fill-overdue' };
    return map[status] || 'fill-active';
  }

  function statusDotClass(status) {
    const map = { active:'status-active', completed:'status-completed', paused:'status-paused', overdue:'status-overdue' };
    return map[status] || 'status-active';
  }

  // ── Overview stats ───────────────────────────
  function updateOverview() {
    const total       = goals.length;
    const active      = goals.filter(g => g.status === 'active').length;
    const done        = goals.filter(g => g.status === 'completed').length;
    const activeGoals = goals.filter(g => g.status === 'active');
    const avg         = activeGoals.length ? Math.round(activeGoals.reduce((s,g) => s + g.progress, 0) / activeGoals.length) : 0;

    document.getElementById('ovTotal').textContent  = total;
    document.getElementById('ovActive').textContent = active;
    document.getElementById('ovDone').textContent   = done;
    document.getElementById('ovAvg').textContent    = avg;
  }

  // ── Render grid ──────────────────────────────
  function getFiltered() {
    const q = searchQuery.toLowerCase();
    return goals.filter(g => {
      const matchSearch = !q || g.name.toLowerCase().includes(q) || (g.desc||'').toLowerCase().includes(q) || g.category.toLowerCase().includes(q);
      const matchFilter = activeFilter === 'all' || g.status === activeFilter || g.category === activeFilter;
      return matchSearch && matchFilter;
    }).sort((a,b) => {
      if (sortBy === 'progress') return b.progress - a.progress;
      if (sortBy === 'due') return (a.due||'9999') < (b.due||'9999') ? -1 : 1;
      if (sortBy === 'name') return a.name.localeCompare(b.name);
      return b.updatedAt - a.updatedAt;
    });
  }

  let fillTimers = [];
  function renderGrid() {
    fillTimers.forEach(t => clearTimeout(t));
    fillTimers = [];
    const filtered = getFiltered();
    goalsGrid.innerHTML = '';

    if (filtered.length === 0) {
      goalsGrid.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon"><svg viewBox="0 0 56 56" fill="none"><circle cx="28" cy="28" r="18" stroke="currentColor" stroke-width="1.3"/><circle cx="28" cy="28" r="8" stroke="currentColor" stroke-width="1"/><circle cx="28" cy="28" r="2" fill="currentColor" opacity=".4"/></svg></div>
          <h2 class="empty-title">No goals yet.</h2>
          <p class="empty-sub">Set your first intention and start tracking what matters most to you.</p>
          <button class="empty-btn" id="emptyNewBtn">
            <svg viewBox="0 0 16 16" fill="none"><line x1="8" y1="3" x2="8" y2="13" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><line x1="3" y1="8" x2="13" y2="8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
            Create First Goal
          </button>
        </div>`;
      document.getElementById('emptyNewBtn')?.addEventListener('click', () => openModal());
      updateOverview();
      return;
    }

    filtered.forEach((goal, i) => {
      const due = dueLabel(goal.due, goal.status);
      const doneMilestones  = (goal.milestones||[]).filter(m => m.done).length;
      const totalMilestones = (goal.milestones||[]).length;
      const cardStatus = goal.status === 'active' && goal.due && new Date(goal.due) < new Date() ? 'overdue' : goal.status;

      const card = document.createElement('div');
      card.className = `goal-card ${cardStatus}`;
      card.dataset.id = goal.id;
      card.style.animationDelay = (i * 30) + 'ms';

      card.innerHTML = `
        <div class="goal-card-top">
          <span class="goal-category ${catClass(goal.category)}">${goal.category}</span>
          <span class="goal-status-dot ${statusDotClass(cardStatus)}" title="${goal.status}"></span>
        </div>
        <div class="goal-name">${goal.name}</div>
        <div class="goal-desc">${goal.desc || ''}</div>
        <div class="goal-progress-wrap">
          <div class="goal-progress-top">
            <span class="goal-pct-label">Progress</span>
            <span class="goal-pct-val">${goal.progress}%</span>
          </div>
          <div class="goal-track">
            <div class="goal-fill ${fillClass(cardStatus)}" data-width="${goal.progress}"></div>
          </div>
        </div>
        <div class="goal-card-footer">
          <div class="goal-meta">
            <span class="goal-due ${due.cls}">${due.text}</span>
            ${totalMilestones ? `<span class="goal-milestones"><span>${doneMilestones}/${totalMilestones}</span> milestones</span>` : ''}
          </div>
          <div class="goal-actions">
            <button class="goal-action-btn edit-btn" title="Edit">
              <svg viewBox="0 0 16 16" fill="none"><path d="M11 2l3 3-9 9H2v-3L11 2z" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/></svg>
            </button>
            <button class="goal-action-btn delete delete-btn" title="Delete">
              <svg viewBox="0 0 16 16" fill="none"><path d="M3 4h10M6 4V3h4v1M5 4v8h6V4H5z" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/></svg>
            </button>
          </div>
        </div>
      `;

      card.querySelector('.edit-btn').addEventListener('click', e => { e.stopPropagation(); openModal(goal.id); });
      card.querySelector('.delete-btn').addEventListener('click', e => { e.stopPropagation(); deleteGoal(goal.id); });
      card.addEventListener('click', () => openModal(goal.id));

      goalsGrid.appendChild(card);
      const fill = card.querySelector('.goal-fill');
      if (fill) fillTimers.push(setTimeout(() => { fill.style.width = fill.dataset.width + '%'; }, i * 20 + 30));
    });

    updateOverview();
  }

  // ── Modal ────────────────────────────────────
  function openModal(goalId = null) {
    editingId = goalId;
    milestones = [];
    milestoneList.innerHTML = '';
    goalName.value     = '';
    goalDesc.value     = '';
    goalCategory.value = 'work';
    goalStatus.value   = 'active';
    goalProgress.value = 0;
    goalDue.value      = '';
    modalTitle.textContent = 'New Goal';
    btnSave.textContent    = 'Save Goal';
    btnSave.disabled       = false;

    if (goalId !== null) {
      const g = goals.find(g => g.id === goalId);
      if (g) {
        modalTitle.textContent = 'Edit Goal';
        btnSave.textContent    = 'Update Goal';
        goalName.value         = g.name;
        goalDesc.value         = g.desc || '';
        goalCategory.value     = g.category;
        goalStatus.value       = g.status;
        goalProgress.value     = g.progress;
        goalDue.value          = g.due || '';
        milestones             = (g.milestones||[]).map(m => ({...m}));
        renderMilestones();
      }
    }

    modalOverlay.classList.add('open');
    setTimeout(() => goalName.focus(), 150);
  }

  function closeModal() {
    modalOverlay.classList.remove('open');
    btnSave.disabled = false;
  }

  async function saveGoal() {
    const name = goalName.value.trim();
    if (!name) {
      goalName.focus();
      goalName.style.borderColor = 'rgba(248,113,113,.4)';
      setTimeout(() => goalName.style.borderColor = '', 800);
      return;
    }

    btnSave.textContent = 'Saving…';
    btnSave.disabled    = true;

    const goalData = {
      name,
      desc:       goalDesc.value.trim(),
      category:   goalCategory.value,
      status:     goalStatus.value,
      progress:   Math.min(100, Math.max(0, parseInt(goalProgress.value) || 0)),
      due:        goalDue.value || null,
      milestones,
    };

    try {
      if (editingId !== null) {
        const data = await apiFetch(`${API}/${editingId}`, {
          method: 'PUT',
          body: JSON.stringify(goalData)
        });
        if (data.goal) {
          const idx = goals.findIndex(g => g.id === editingId);
          if (idx !== -1) goals[idx] = normalizeGoal(data.goal);
        }
      } else {
        const data = await apiFetch(API, {
          method: 'POST',
          body: JSON.stringify(goalData)
        });
        if (data.goal) {
          goals.unshift(normalizeGoal(data.goal));
        }
      }

      closeModal();
      renderGrid();
    } catch (err) {
      console.error('Failed to save goal:', err);
      btnSave.textContent = editingId ? 'Update Goal' : 'Save Goal';
      btnSave.disabled    = false;
    }
  }

  async function deleteGoal(id) {
    const g = goals.find(g => g.id === id);
    if (!g) return;
    if (!confirm(`Delete "${g.name}"? This cannot be undone.`)) return;

    try {
      await apiFetch(`${API}/${id}`, { method: 'DELETE' });
      goals = goals.filter(g => g.id !== id);
      renderGrid();
    } catch (err) {
      console.error('Failed to delete goal:', err);
    }
  }

  // ── Milestones ───────────────────────────────
  function renderMilestones() {
    milestoneList.innerHTML = '';
    milestones.forEach((m, i) => {
      const item = document.createElement('div');
      item.className = 'milestone-item';
      item.innerHTML = `
        <div class="milestone-check ${m.done ? 'done' : ''}" data-idx="${i}"></div>
        <span class="milestone-text ${m.done ? 'done' : ''}">${m.text}</span>
        <button class="milestone-remove" data-idx="${i}">✕</button>
      `;
      item.querySelector('.milestone-check').addEventListener('click', () => { milestones[i].done = !milestones[i].done; renderMilestones(); });
      item.querySelector('.milestone-remove').addEventListener('click', () => { milestones.splice(i,1); renderMilestones(); });
      milestoneList.appendChild(item);
    });
  }

  function addMilestone() {
    const text = milestoneInput.value.trim();
    if (!text) return;
    milestones.push({ text, done: false });
    milestoneInput.value = '';
    renderMilestones();
  }

  // ── Load goals from API ──────────────────────
  async function loadGoals() {
    try {
      const data = await apiFetch(API);
      if (data.goals) {
        goals = data.goals.map(normalizeGoal);
        renderGrid();
      }
    } catch (err) {
      console.error('Failed to load goals:', err);
      renderGrid();
    }
  }

  // ── Event Listeners ──────────────────────────
  sidebarToggle.addEventListener('click', () => sidebar.classList.toggle('collapsed'));

  newGoalBtn.addEventListener('click', () => openModal());
  modalClose.addEventListener('click', closeModal);
  btnCancel.addEventListener('click', closeModal);
  btnSave.addEventListener('click', saveGoal);

  modalOverlay.addEventListener('click', e => { if (e.target === modalOverlay) closeModal(); });

  addMilestoneBtn.addEventListener('click', addMilestone);
  milestoneInput.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); addMilestone(); } });

  searchInput.addEventListener('input', e => { searchQuery = e.target.value; renderGrid(); });
  sortSelect.addEventListener('change', e => { sortBy = e.target.value; renderGrid(); });

  document.querySelectorAll('.filter-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      activeFilter = chip.dataset.filter;
      renderGrid();
    });
  });

  // Overview cards staggered reveal
  document.querySelectorAll('.ov-card').forEach((el, i) => {
    setTimeout(() => el.classList.add('visible'), i * 60);
  });

  // ── Init ─────────────────────────────────────
  loadGoals();

})();