/* =====================================================
   MINERVA — dashboard.js
   ===================================================== */

// ── Auth Guard ────────────────────────────────────
const token = localStorage.getItem('token');
const user  = JSON.parse(localStorage.getItem('user') || 'null');

if (!token || !user) {
  window.location.href = '../auth/login.html';
}

// ── Populate user info ────────────────────────────
if (user) {
  const initials = user.name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const avatarEl = document.getElementById('avatarInitials');
  if (avatarEl) avatarEl.textContent = initials;

  const pageTitle = document.querySelector('.page-title');
  if (pageTitle) pageTitle.textContent = 'Dashboard';

  const dateEl = document.getElementById('pageDate');
  if (dateEl) {
    const now = new Date();
    dateEl.textContent = `Welcome back, ${user.name.split(' ')[0]} · ${now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}`;
  }
}

// ── Avatar menu & logout ──────────────────────────
const avatarBtn  = document.getElementById('avatarBtn');
const avatarMenu = document.getElementById('avatarMenu');
const logoutBtn  = document.getElementById('logoutBtn');
const menuName   = document.getElementById('avatarMenuName');
const menuEmail  = document.getElementById('avatarMenuEmail');

if (user) {
  if (menuName)  menuName.textContent  = user.name;
  if (menuEmail) menuEmail.textContent = user.email;
}

avatarBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  avatarMenu.classList.toggle('open');
});

document.addEventListener('click', () => {
  avatarMenu.classList.remove('open');
});

logoutBtn.addEventListener('click', () => {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  window.location.href = '../auth/login.html';
});

// ── Fetch fresh user data from server ────────────
fetch('http://localhost:4000/api/auth/me', {
  headers: { Authorization: `Bearer ${token}` }
})
  .then(res => res.json())
  .then(data => {
    if (data.user) {
      if (menuName)  menuName.textContent  = data.user.name;
      if (menuEmail) menuEmail.textContent = data.user.email;
    }
  })
  .catch(err => console.error('Failed to fetch user:', err));

(function () {
  'use strict';

  // ── Sidebar collapse toggle ──────────────────────
  const sidebar       = document.getElementById('sidebar');
  const sidebarToggle = document.getElementById('sidebarToggle');

  sidebarToggle.addEventListener('click', () => {
    sidebar.classList.toggle('collapsed');
  });

  // ── Active nav item ──────────────────────────────
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', e => {
      if (item.getAttribute('href') === '#') {
        e.preventDefault();
        document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
        item.classList.add('active');
      }
    });
  });

  // ── Tag chip toggle (quick capture) ─────────────
  document.querySelectorAll('.tag-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('.tag-chip').forEach(c => c.classList.remove('active-chip'));
      chip.classList.add('active-chip');
    });
  });

  // ── Animated number counter ──────────────────────
  function animateCounter(el) {
  if (el.closest('.stat-card[data-stat="notes"]')) return;
  const target = parseInt(el.dataset.target, 10);
  const suffix = el.dataset.suffix || '';
  el.textContent = target + suffix;
}

  // ── Goal progress bar fill ───────────────────────
  function animateGoals() {
    document.querySelectorAll('.goal-item').forEach(item => {
      const pct  = parseInt(item.dataset.progress, 10);
      const fill = item.querySelector('.goal-fill');
      if (fill) {
        setTimeout(() => { fill.style.width = pct + '%'; }, 200);
      }
    });
  }

  // ── Chart bars ───────────────────────────────────
  (function buildChart() {
    const chartArea = document.getElementById('chartArea');
    const chartDays = document.getElementById('chartDays');
    if (!chartArea || !chartDays) return;

    const days   = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
    const values = [3.5, 5.2, 4.1, 6.8, 5.5, 2.2, 7.0];
    const maxVal = Math.max(...values);
    const todayIdx      = new Date().getDay();
    const adjustedToday = (todayIdx + 6) % 7;

    days.forEach((day, i) => {
      const heightPct = (values[i] / maxVal) * 100;
      const isToday   = i === adjustedToday;

      const wrap = document.createElement('div');
      wrap.className = 'chart-bar-wrap';

      const val = document.createElement('span');
      val.className   = 'chart-bar-val';
      val.textContent = values[i] + 'h';

      const bar = document.createElement('div');
      bar.className    = 'chart-bar' + (isToday ? ' today' : '');
      bar.style.height = heightPct + '%';
      bar.title        = `${day}: ${values[i]}h focus`;

      wrap.appendChild(val);
      wrap.appendChild(bar);
      chartArea.appendChild(wrap);

      const label = document.createElement('div');
      label.className   = 'chart-day' + (isToday ? ' today' : '');
      label.textContent = day;
      chartDays.appendChild(label);
    });

    setTimeout(() => {
      document.querySelectorAll('.chart-bar').forEach((bar, i) => {
        setTimeout(() => { bar.style.transform = 'scaleY(1)'; }, i * 60);
      });
    }, 300);
  })();

  // ── Intersection Observer for reveals ────────────
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      const el    = entry.target;
      const delay = parseInt(el.dataset.delay || 0, 10);

      setTimeout(() => {
        el.classList.add('visible');
        const valEl = el.querySelector('.stat-value');
        if (valEl) animateCounter(valEl);
      }, delay);

      observer.unobserve(el);
    });
  }, { threshold: 0.1 });

  document.querySelectorAll('.stat-card').forEach(el => observer.observe(el));

  document.querySelectorAll('.note-card').forEach((el, i) => {
    el.dataset.delay = i * 70;
    observer.observe(el);
  });

  

  // ── Animate goals on load ─────────────────────────
  animateGoals();

  // ── Quick capture button ──────────────────────────
  const captureBtn   = document.querySelector('.capture-btn');
  const captureInput = document.querySelector('.capture-input');

  if (captureBtn && captureInput) {
    captureBtn.addEventListener('click', async () => {
      const text = captureInput.value.trim();
      const activeTag = document.querySelector('.tag-chip.active-chip')?.textContent || 'Note';

      if (!text) {
        captureInput.focus();
        captureInput.style.borderColor = 'rgba(248,113,113,.45)';
        setTimeout(() => { captureInput.style.borderColor = ''; }, 800);
        return;
      }

      captureBtn.disabled = true;

      try {
        const res = await fetch('http://localhost:4000/api/notes', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ content: text, tag: activeTag })
        });

        const data = await res.json();

        if (!res.ok) {
          alert(data.error || 'Failed to save note.');
          return;
        }

        captureBtn.textContent = '✓ Saved';
        captureBtn.style.background = 'rgba(110,231,183,.85)';
        captureInput.value = '';

        prependNote(data.note);

        // Bump the notes count stat
        const notesStatEl = document.querySelector('.stat-card[data-stat="notes"] .stat-value');
        if (notesStatEl) notesStatEl.textContent = parseInt(notesStatEl.textContent || 0) + 1;

        setTimeout(() => {
          captureBtn.innerHTML = '<span>Save</span><svg viewBox="0 0 16 16" fill="none"><path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';
          captureBtn.style.background = '';
          captureBtn.disabled = false;
        }, 1500);

      } catch (err) {
        alert('Could not connect to server.');
        captureBtn.disabled = false;
      }
    });

    captureInput.addEventListener('keydown', e => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') captureBtn.click();
    });
  }

  // ── Ripple on note cards ──────────────────────────
  document.querySelectorAll('.note-card').forEach(card => {
    card.addEventListener('click', function (e) {
      const r    = document.createElement('span');
      const rect = this.getBoundingClientRect();
      const sz   = Math.max(rect.width, rect.height);
      r.style.cssText = `
        position:absolute; border-radius:50%; pointer-events:none;
        background:rgba(167,139,250,0.12);
        width:${sz}px; height:${sz}px;
        left:${e.clientX - rect.left - sz/2}px;
        top:${e.clientY  - rect.top  - sz/2}px;
        transform:scale(0); animation:rippleOut .45s ease-out forwards;
      `;
      this.style.position = 'relative';
      this.style.overflow = 'hidden';
      this.appendChild(r);
      setTimeout(() => r.remove(), 500);
    });
  });

  if (!document.getElementById('rippleStyle')) {
    const s = document.createElement('style');
    s.id = 'rippleStyle';
    s.textContent = '@keyframes rippleOut { to { transform:scale(3.5); opacity:0; } }';
    document.head.appendChild(s);
  }

  // ── Render a single note card ─────────────────────
  function renderNoteCard(note) {
    const timeAgo = getTimeAgo(new Date(note.createdAt));
    const tagClass = note.tag === 'Idea' ? 'tag-idea' : note.tag === 'Research' ? 'tag-research' : 'tag-project';

    const card = document.createElement('div');
    card.className = 'note-card';
    card.dataset.delay = '0';
    card.innerHTML = `
      <div class="note-top">
        <span class="note-tag ${tagClass}">${note.tag}</span>
        <span class="note-time">${timeAgo}</span>
      </div>
      <h3 class="note-title">${note.content.slice(0, 60)}${note.content.length > 60 ? '…' : ''}</h3>
      <p class="note-preview">${note.content}</p>
    `;
    setTimeout(() => card.classList.add('visible'), 50);
    return card;
  }

  // ── Prepend note to notes list ────────────────────
  function prependNote(note) {
    const notesList = document.querySelector('.notes-list');
    if (!notesList) return;
    const card = renderNoteCard(note);
    notesList.insertBefore(card, notesList.firstChild);
  }

  // ── Load real notes from server ───────────────────
  async function loadNotes() {
    try {
      const res = await fetch('http://localhost:4000/api/notes', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();

      // Update real notes count on stat card
      const notesStatEl = document.querySelector('.stat-card[data-stat="notes"] .stat-value');
      if (notesStatEl && data.notes) {
        notesStatEl.textContent = data.notes.length;
      }

      if (!data.notes || data.notes.length === 0) return;

      const notesList = document.querySelector('.notes-list');
      if (!notesList) return;

      notesList.innerHTML = '';
      data.notes.slice(0, 4).forEach((note, i) => {
        const card = renderNoteCard(note);
        card.dataset.delay = i * 70;
        notesList.appendChild(card);
        observer.observe(card);
      });
    } catch (err) {
      console.error('Failed to load notes:', err);
    }
  }

  // ── Time ago helper ───────────────────────────────
  function getTimeAgo(date) {
    const seconds = Math.floor((new Date() - date) / 1000);
    if (seconds < 60)    return 'Just now';
    if (seconds < 3600)  return Math.floor(seconds / 60) + 'm ago';
    if (seconds < 86400) return Math.floor(seconds / 3600) + 'h ago';
    if (seconds < 172800) return 'Yesterday';
    return Math.floor(seconds / 86400) + 'd ago';
  }

  loadNotes();
})();