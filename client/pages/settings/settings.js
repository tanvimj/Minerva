/* =====================================================
   MINERVA — settings.js (fully wired)
   ===================================================== */

(function () {
  'use strict';

  // ── Auth guard ──────────────────────────────────
  const token = localStorage.getItem('token');
  const user  = JSON.parse(localStorage.getItem('user') || 'null');
  if (!token || !user) window.location.href = '../auth/login.html';

  const API = 'http://localhost:4000/api/settings';
  const authHeaders = () => ({
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  });

  // ══════════════════════════════════════════════════
  // APPEARANCE STATE
  // Loaded from localStorage immediately so the page
  // never flashes the wrong theme/accent on load.
  // ══════════════════════════════════════════════════
  const APPEARANCE_KEY = 'minerva_appearance';

  const DEFAULT_APPEARANCE = {
    theme:        'dark',
    accent:       '#a78bfa',
    fontSize:     'medium',
    fontStyle:    'sans',
    reducedMotion: false,
  };

  function loadAppearanceState() {
    try {
      return { ...DEFAULT_APPEARANCE, ...JSON.parse(localStorage.getItem(APPEARANCE_KEY) || '{}') };
    } catch { return { ...DEFAULT_APPEARANCE }; }
  }

  function saveAppearanceState(patch) {
    const current = loadAppearanceState();
    const next    = { ...current, ...patch };
    localStorage.setItem(APPEARANCE_KEY, JSON.stringify(next));
    return next;
  }

  // ══════════════════════════════════════════════════
  // APPLY APPEARANCE TO DOM
  // ══════════════════════════════════════════════════

  function getSystemTheme() {
    return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  }

  // Theme switching works entirely via [data-theme] on <html>.
  // The CSS handles all variable overrides — no inline style juggling needed.
  function applyThemeVars(theme) {
    const resolved = theme === 'system' ? getSystemTheme() : theme;
    document.documentElement.setAttribute('data-theme', resolved);
  }

  function applyAccent(color) {
    if (!color) return;
    document.documentElement.style.setProperty('--accent', color);
    // Derived glow / dim values
    document.documentElement.style.setProperty('--accent-glow', color + '33');
    document.documentElement.style.setProperty('--accent-dim',  color + '1a');
    // Update live preview elements
    const prevDot  = document.getElementById('prevDot');
    const prevTag  = document.getElementById('prevTag');
    const prevFill = document.getElementById('prevFill');
    if (prevDot)  prevDot.style.background  = color;
    if (prevTag)  { prevTag.style.color = color; prevTag.style.borderColor = color + '40'; prevTag.style.background = color + '1a'; }
    if (prevFill) prevFill.style.background = `linear-gradient(90deg, ${color}99, ${color})`;
  }

  const FONT_SIZE_MAP  = { small: '13px', medium: '14px', large: '15.5px' };
  const FONT_STYLE_MAP = {
    serif: "'Cormorant Garamond', Georgia, serif",
    sans:  "'DM Sans', system-ui, sans-serif",
    mono:  "'DM Mono', 'Fira Mono', monospace",
  };

  function applyFontSize(size) {
    document.documentElement.style.fontSize = FONT_SIZE_MAP[size] || '14px';
  }

  function applyFontStyle(style) {
    document.documentElement.style.setProperty('--sans', FONT_STYLE_MAP[style] || FONT_STYLE_MAP.sans);
    // Also set body font-family directly so it takes effect immediately
    document.body.style.fontFamily = FONT_STYLE_MAP[style] || FONT_STYLE_MAP.sans;
  }

  function applyReducedMotion(enabled) {
    document.documentElement.style.setProperty(
      '--ease', enabled ? 'linear' : 'cubic-bezier(0.4,0,0.2,1)'
    );
    if (enabled) {
      document.documentElement.setAttribute('data-reduced-motion', 'true');
    } else {
      document.documentElement.removeAttribute('data-reduced-motion');
    }
  }

  // Master apply — call with a full appearance object
  function applyAppearance(ap) {
    applyThemeVars(ap.theme);
    applyAccent(ap.accent);
    applyFontSize(ap.fontSize);
    applyFontStyle(ap.fontStyle);
    applyReducedMotion(ap.reducedMotion);
  }

  // ── Apply saved appearance immediately on load ──
  const savedAppearance = loadAppearanceState();
  applyAppearance(savedAppearance);

  // ══════════════════════════════════════════════════
  // POPULATE APPEARANCE UI FROM STATE
  // ══════════════════════════════════════════════════
  function syncAppearanceUI(ap) {
    // Theme picker
    document.querySelectorAll('.theme-opt').forEach(o => {
      const active = o.dataset.theme === ap.theme;
      o.classList.toggle('active', active);
      o.querySelector('.theme-tick').textContent = active ? '✓' : '';
    });

    // Accent swatches
    document.querySelectorAll('.accent-swatch').forEach(s => {
      s.classList.toggle('active', s.dataset.color === ap.accent);
    });
    const accentCustomEl = document.getElementById('accentCustom');
    if (accentCustomEl) accentCustomEl.value = ap.accent;

    // Font size seg
    const fontSizeSeg = document.getElementById('fontSizeSeg');
    if (fontSizeSeg) {
      fontSizeSeg.querySelectorAll('.seg-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.val === ap.fontSize);
      });
    }

    // Font style seg
    const fontStyleSeg = document.getElementById('fontStyleSeg');
    if (fontStyleSeg) {
      fontStyleSeg.querySelectorAll('.seg-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.val === ap.fontStyle);
      });
    }

    // Reduced motion toggle
    const reducedMotionEl = document.getElementById('reducedMotion');
    if (reducedMotionEl) reducedMotionEl.checked = ap.reducedMotion;
  }

  // Will be called after DOM ready — see bottom of file

  // ══════════════════════════════════════════════════
  // POPULATE UI FROM USER (profile, account fields)
  // ══════════════════════════════════════════════════
  function populateFromUser(u) {
    if (!u) return;
    const initials = u.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    setEl('avatarInitials',    initials);
    setEl('profileAvatar',     initials);
    setEl('avatarMenuName',    u.name);
    setEl('avatarMenuEmail',   u.email);
    setEl('profileAvatarName', u.name);
    setVal('displayName', u.name);
    setVal('email',       u.email);
    setVal('bio',         u.bio      || '');
    setVal('timezone',    u.timezone || 'Asia/Kolkata');
    setVal('language',    u.language || 'en');
  }

  function setEl(id, text) { const el = document.getElementById(id); if (el) el.textContent = text; }
  function setVal(id, val)  { const el = document.getElementById(id); if (el) el.value = val; }

  populateFromUser(user);

  // ── Fetch fresh settings from API ───────────────
  async function loadSettings() {
    try {
      const res  = await fetch(API, { headers: authHeaders() });
      if (!res.ok) return;
      const data = await res.json();
      if (data.user) {
        populateFromUser(data.user);
        const stored = JSON.parse(localStorage.getItem('user') || '{}');
        localStorage.setItem('user', JSON.stringify({ ...stored, ...data.user }));
      }
      // If backend ever starts returning appearance data, merge it in
      if (data.appearance) {
        const merged = saveAppearanceState(data.appearance);
        applyAppearance(merged);
        syncAppearanceUI(merged);
      }
    } catch (err) {
      console.error('Failed to load settings:', err);
    }
  }

  loadSettings();

  // ══════════════════════════════════════════════════
  // DOM READY — wire up all interactions
  // ══════════════════════════════════════════════════
  document.addEventListener('DOMContentLoaded', () => {
    syncAppearanceUI(loadAppearanceState());
    wireAppearanceControls();
  });

  // Also call sync immediately in case DOMContentLoaded already fired
  if (document.readyState !== 'loading') {
    syncAppearanceUI(loadAppearanceState());
    wireAppearanceControls();
  }

  // ══════════════════════════════════════════════════
  // WIRE APPEARANCE CONTROLS
  // ══════════════════════════════════════════════════
  function wireAppearanceControls() {

    // ── Theme picker ──
    document.querySelectorAll('.theme-opt').forEach(opt => {
      opt.addEventListener('click', () => {
        const theme = opt.dataset.theme;
        document.querySelectorAll('.theme-opt').forEach(o => {
          o.classList.remove('active');
          o.querySelector('.theme-tick').textContent = '';
        });
        opt.classList.add('active');
        opt.querySelector('.theme-tick').textContent = '✓';
        applyThemeVars(theme);
        saveAppearanceState({ theme });

        // Listen for system theme changes if 'system' is selected
        if (theme === 'system') {
          window.matchMedia('(prefers-color-scheme: light)').addEventListener('change', () => {
            if (loadAppearanceState().theme === 'system') applyThemeVars('system');
          }, { once: true });
        }
      });
    });

    // ── Accent swatches ──
    document.querySelectorAll('.accent-swatch').forEach(swatch => {
      swatch.addEventListener('click', () => {
        document.querySelectorAll('.accent-swatch').forEach(s => s.classList.remove('active'));
        swatch.classList.add('active');
        const color = swatch.dataset.color;
        applyAccent(color);
        saveAppearanceState({ accent: color });
        // Sync custom picker value
        const cp = document.getElementById('accentCustom');
        if (cp) cp.value = color;
      });
    });

    // ── Custom color picker ──
    // The rainbow label wraps the hidden <input type="color">
    // Clicking the label should open the native color picker
    const accentCustom = document.getElementById('accentCustom');
    const accentCustomWrap = document.querySelector('.accent-custom-wrap');
    if (accentCustom && accentCustomWrap) {
      // Make the wrapper actually trigger the input
      accentCustomWrap.addEventListener('click', (e) => {
        e.preventDefault();
        accentCustom.click();
      });
      accentCustom.addEventListener('input', e => {
        const color = e.target.value;
        document.querySelectorAll('.accent-swatch').forEach(s => s.classList.remove('active'));
        applyAccent(color);
        saveAppearanceState({ accent: color });
      });
    }

    // ── Font size ──
    const fontSizeSeg = document.getElementById('fontSizeSeg');
    if (fontSizeSeg) {
      fontSizeSeg.querySelectorAll('.seg-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          fontSizeSeg.querySelectorAll('.seg-btn').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          applyFontSize(btn.dataset.val);
          saveAppearanceState({ fontSize: btn.dataset.val });
        });
      });
    }

    // ── Font style ──
    const fontStyleSeg = document.getElementById('fontStyleSeg');
    if (fontStyleSeg) {
      fontStyleSeg.querySelectorAll('.seg-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          fontStyleSeg.querySelectorAll('.seg-btn').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          applyFontStyle(btn.dataset.val);
          saveAppearanceState({ fontStyle: btn.dataset.val });
        });
      });
    }

    // ── Reduced motion ──
    const reducedMotionEl = document.getElementById('reducedMotion');
    if (reducedMotionEl) {
      reducedMotionEl.addEventListener('change', () => {
        applyReducedMotion(reducedMotionEl.checked);
        saveAppearanceState({ reducedMotion: reducedMotionEl.checked });
      });
    }

    // ── Generic seg controls (for sections other than font) ──
    // Only applies to seg-controls NOT already handled above
    document.querySelectorAll('.seg-control').forEach(group => {
      if (group.id === 'fontSizeSeg' || group.id === 'fontStyleSeg') return;
      group.querySelectorAll('.seg-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          group.querySelectorAll('.seg-btn').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
        });
      });
    });
  }

  // ══════════════════════════════════════════════════
  // SAVE APPEARANCE TO BACKEND
  // ══════════════════════════════════════════════════
  async function saveAppearance() {
    const ap  = loadAppearanceState();
    const btn = document.querySelector('#section-appearance .btn-save');

    if (btn) { btn.textContent = 'Saving…'; btn.disabled = true; }

    try {
      const res  = await fetch(`${API}/appearance`, {
        method:  'PUT',
        headers: authHeaders(),
        body:    JSON.stringify(ap),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        showToast(data.error || 'Failed to save appearance.', 'error');
        return;
      }

      // Merge response back in case server normalises values
      const data = await res.json().catch(() => ({}));
      if (data.appearance) {
        const merged = saveAppearanceState(data.appearance);
        applyAppearance(merged);
        syncAppearanceUI(merged);
      }

      // Also persist to user object in localStorage
      const stored = JSON.parse(localStorage.getItem('user') || '{}');
      localStorage.setItem('user', JSON.stringify({ ...stored, appearance: ap }));

      showToast('Appearance saved.', 'success');
    } catch (err) {
      // API not available yet — still saved to localStorage, so just confirm
      showToast('Saved locally. Will sync when server is ready.', 'info');
    } finally {
      if (btn) {
        btn.innerHTML = '<svg viewBox="0 0 14 14" fill="none"><path d="M2 7l3.5 3.5L12 3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg> Save Appearance';
        btn.disabled = false;
      }
    }
  }

  // ══════════════════════════════════════════════════
  // SAVE SECTION DISPATCHER
  // ══════════════════════════════════════════════════
  window.saveSection = async function(section) {
    if      (section === 'profile')    await saveProfile();
    else if (section === 'account')    await saveAccount();
    else if (section === 'appearance') await saveAppearance();
    else showToast('Settings saved.', 'success');
  };

  // ══════════════════════════════════════════════════
  // SAVE PROFILE
  // ══════════════════════════════════════════════════
  async function saveProfile() {
    const name     = document.getElementById('displayName')?.value.trim();
    const bio      = document.getElementById('bio')?.value.trim();
    const timezone = document.getElementById('timezone')?.value;
    const language = document.getElementById('language')?.value;

    if (!name) { showToast('Name cannot be empty.', 'error'); return; }

    const btn = document.querySelector('#section-profile .btn-save');
    if (btn) { btn.textContent = 'Saving…'; btn.disabled = true; }

    try {
      const res  = await fetch(`${API}/profile`, {
        method:  'PUT',
        headers: authHeaders(),
        body:    JSON.stringify({ name, bio, timezone, language }),
      });
      const data = await res.json();
      if (!res.ok) { showToast(data.error || 'Failed to save.', 'error'); return; }

      const stored = JSON.parse(localStorage.getItem('user') || '{}');
      localStorage.setItem('user', JSON.stringify({ ...stored, ...data.user }));

      setEl('avatarMenuName',    data.user.name);
      setEl('profileAvatarName', data.user.name);
      const initials = data.user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
      setEl('avatarInitials', initials);
      setEl('profileAvatar',  initials);
      showToast('Profile saved.', 'success');
    } catch {
      showToast('Could not connect to server.', 'error');
    } finally {
      if (btn) { btn.textContent = 'Save Profile'; btn.disabled = false; }
    }
  }

  // ══════════════════════════════════════════════════
  // SAVE ACCOUNT
  // ══════════════════════════════════════════════════
  async function saveAccount() {
    const email           = document.getElementById('email')?.value.trim();
    const currentPassword = document.querySelector('#section-account input[placeholder="••••••••••"]')?.value;
    const newPassword     = document.getElementById('newPassword')?.value;
    const confirmPassword = document.querySelector('#section-account input[placeholder="Repeat new password"]')?.value;

    if (newPassword && newPassword !== confirmPassword) { showToast('Passwords do not match.', 'error'); return; }
    if (newPassword && newPassword.length < 8)          { showToast('Password must be at least 8 characters.', 'error'); return; }

    const body = {};
    if (email)       body.email = email;
    if (newPassword) { body.currentPassword = currentPassword; body.newPassword = newPassword; }
    if (Object.keys(body).length === 0) { showToast('Nothing to update.', 'info'); return; }

    const btn = document.querySelector('#section-account .btn-save');
    if (btn) { btn.textContent = 'Saving…'; btn.disabled = true; }

    try {
      const res  = await fetch(`${API}/account`, {
        method:  'PUT',
        headers: authHeaders(),
        body:    JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) { showToast(data.error || 'Failed to save.', 'error'); return; }

      const stored = JSON.parse(localStorage.getItem('user') || '{}');
      localStorage.setItem('user', JSON.stringify({ ...stored, ...data.user }));
      setEl('avatarMenuEmail', data.user.email);
      document.querySelectorAll('#section-account input[type="password"]').forEach(i => i.value = '');
      showToast('Account updated.', 'success');
    } catch {
      showToast('Could not connect to server.', 'error');
    } finally {
      if (btn) { btn.textContent = 'Save Changes'; btn.disabled = false; }
    }
  }

  // ══════════════════════════════════════════════════
  // AVATAR UPLOAD PREVIEW
  // ══════════════════════════════════════════════════
  const avatarUploadBtn = document.getElementById('avatarUploadBtn');
  const avatarInput     = document.getElementById('avatarInput');
  const profileAvatar   = document.getElementById('profileAvatar');

  if (avatarUploadBtn && avatarInput) {
    avatarUploadBtn.addEventListener('click', () => avatarInput.click());
    avatarInput.addEventListener('change', e => {
      const file = e.target.files[0];
      if (!file) return;
      if (file.size > 2 * 1024 * 1024) { showToast('Image must be under 2 MB.', 'error'); return; }
      const reader = new FileReader();
      reader.onload = ev => {
        profileAvatar.innerHTML = `<img src="${ev.target.result}" alt="avatar" style="width:100%;height:100%;object-fit:cover;border-radius:50%" />`;
      };
      reader.readAsDataURL(file);
    });
  }

  // ══════════════════════════════════════════════════
  // PASSWORD STRENGTH METER
  // ══════════════════════════════════════════════════
  const newPasswordInput = document.getElementById('newPassword');
  const psFill           = document.getElementById('psFill');
  const psLabel          = document.getElementById('psLabel');

  if (newPasswordInput) {
    newPasswordInput.addEventListener('input', () => {
      const val = newPasswordInput.value;
      let score = 0;
      if (val.length >= 8)            score++;
      if (/[A-Z]/.test(val))          score++;
      if (/[0-9]/.test(val))          score++;
      if (/[^A-Za-z0-9]/.test(val))   score++;
      const levels = [
        { w: '0%',   color: 'transparent',          label: '',       labelColor: '' },
        { w: '25%',  color: 'rgba(248,113,113,.8)',  label: 'Weak',   labelColor: 'var(--red)' },
        { w: '50%',  color: 'rgba(251,191,36,.8)',   label: 'Fair',   labelColor: 'var(--yellow)' },
        { w: '75%',  color: 'rgba(56,189,248,.8)',   label: 'Good',   labelColor: 'rgba(56,189,248,.9)' },
        { w: '100%', color: 'rgba(110,231,183,.85)', label: 'Strong', labelColor: 'var(--green)' },
      ];
      const lvl = levels[score];
      if (psFill)  { psFill.style.width = lvl.w; psFill.style.background = lvl.color; }
      if (psLabel) { psLabel.textContent = lvl.label; psLabel.style.color = lvl.labelColor; }
    });
  }

  // ══════════════════════════════════════════════════
  // ANALYTICS: INSIGHT SENSITIVITY DESCRIPTION
  // ══════════════════════════════════════════════════
  const insightSeg  = document.getElementById('insightSeg');
  const insightDesc = document.getElementById('insightDesc');
  const insightCopy = {
    basic:    'Basic mode shows note counts, streaks, and simple activity charts.',
    standard: 'Standard mode surfaces weekly trends, topic clusters, and productivity patterns.',
    advanced: 'Advanced mode uses deep pattern analysis to surface hidden connections and predict focus windows.',
  };
  if (insightSeg && insightDesc) {
    insightSeg.querySelectorAll('.seg-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        insightSeg.querySelectorAll('.seg-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        insightDesc.style.opacity = '0';
        setTimeout(() => { insightDesc.textContent = insightCopy[btn.dataset.val] || ''; insightDesc.style.opacity = '1'; }, 150);
      });
    });
  }

  // ══════════════════════════════════════════════════
  // EXPORT BUTTONS
  // ══════════════════════════════════════════════════
  async function triggerExport(format) {
    showToast(`Preparing ${format.toUpperCase()} export…`, 'info');
    try {
      const res = await fetch(`${API}/export${format === 'markdown' ? '/markdown' : ''}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) { showToast('Export failed.', 'error'); return; }
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = format === 'markdown' ? 'minerva-notes.md' : 'minerva-export.json';
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
      showToast('Download started.', 'success');
    } catch {
      showToast('Could not connect to server.', 'error');
    }
  }

  document.querySelectorAll('.btn-export').forEach(btn => {
    btn.addEventListener('click', () => {
      const text = btn.textContent.trim().toLowerCase();
      if (text === 'json')          triggerExport('json');
      else if (text === 'markdown') triggerExport('markdown');
      else if (text === 'pdf')      showToast('PDF export coming soon.', 'info');
    });
  });

  // ══════════════════════════════════════════════════
  // DATA: IMPORT DRAG & DROP
  // ══════════════════════════════════════════════════
  const importZone = document.getElementById('importZone');
  const importFile = document.getElementById('importFile');
  if (importZone) {
    importZone.addEventListener('dragover',  e => { e.preventDefault(); importZone.classList.add('drag-over'); });
    importZone.addEventListener('dragleave', () => importZone.classList.remove('drag-over'));
    importZone.addEventListener('drop', e => {
      e.preventDefault();
      importZone.classList.remove('drag-over');
      if (e.dataTransfer.files[0]) handleImport(e.dataTransfer.files[0]);
    });
  }
  if (importFile) importFile.addEventListener('change', e => { if (e.target.files[0]) handleImport(e.target.files[0]); });

  function handleImport(file) {
    const ext = file.name.split('.').pop().toLowerCase();
    if (!['json', 'md'].includes(ext)) { showToast('Only JSON or Markdown files are supported.', 'error'); return; }
    showToast(`Importing ${file.name}… (coming soon)`, 'info');
  }

  // ══════════════════════════════════════════════════
  // MINI GRAPH CANVAS (Graph settings preview)
  // ══════════════════════════════════════════════════
  const edgeThickness    = document.getElementById('edgeThickness');
  const edgeThicknessVal = document.getElementById('edgeThicknessVal');
  if (edgeThickness) {
    edgeThickness.addEventListener('input', () => {
      if (edgeThicknessVal) edgeThicknessVal.textContent = edgeThickness.value;
      const pct = ((edgeThickness.value - 1) / 4) * 100;
      edgeThickness.style.background = `linear-gradient(to right, var(--accent) 0%, var(--accent) ${pct}%, var(--brd) ${pct}%, var(--brd) 100%)`;
      drawMiniGraph();
    });
  }

  function drawMiniGraph() {
    const canvas = document.getElementById('miniGraphCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width, h = canvas.height;
    const thickness = parseInt(edgeThickness?.value || 2);
    const accent    = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#a78bfa';
    ctx.clearRect(0, 0, w, h);
    const nodes = [
      { x: w*.5,  y: h*.5,  r: 10, type: 'hub' },
      { x: w*.25, y: h*.25, r: 6,  type: 'leaf' },
      { x: w*.75, y: h*.25, r: 6,  type: 'leaf' },
      { x: w*.2,  y: h*.65, r: 6,  type: 'leaf' },
      { x: w*.78, y: h*.65, r: 6,  type: 'leaf' },
      { x: w*.5,  y: h*.15, r: 5,  type: 'leaf' },
      { x: w*.12, y: h*.45, r: 4,  type: 'isolated' },
      { x: w*.88, y: h*.45, r: 4,  type: 'isolated' },
    ];
    const edges  = [[0,1],[0,2],[0,3],[0,4],[0,5],[1,2],[3,4]];
    const colors = { hub: accent, leaf: 'rgba(110,231,183,0.8)', isolated: 'rgba(251,191,36,0.7)' };
    edges.forEach(([a, b]) => {
      ctx.beginPath();
      ctx.moveTo(nodes[a].x, nodes[a].y);
      ctx.lineTo(nodes[b].x, nodes[b].y);
      ctx.strokeStyle = 'rgba(167,139,250,0.18)';
      ctx.lineWidth   = thickness * 0.7;
      ctx.stroke();
    });
    nodes.forEach(node => {
      ctx.beginPath();
      ctx.arc(node.x, node.y, node.r, 0, Math.PI * 2);
      ctx.fillStyle   = colors[node.type];
      ctx.shadowColor = colors[node.type];
      ctx.shadowBlur  = node.type === 'hub' ? 10 : 4;
      ctx.fill();
      ctx.shadowBlur  = 0;
    });
  }

  drawMiniGraph();

  // ══════════════════════════════════════════════════
  // SETTINGS NAV
  // ══════════════════════════════════════════════════
  const snItems  = document.querySelectorAll('.sn-item');
  const sections = document.querySelectorAll('.settings-section');

  function showSection(name) {
    sections.forEach(s => s.classList.remove('active'));
    snItems.forEach(i => i.classList.remove('active'));
    const target = document.getElementById('section-' + name);
    if (target) target.classList.add('active');
    snItems.forEach(i => { if (i.dataset.section === name) i.classList.add('active'); });
  }

  snItems.forEach(item => item.addEventListener('click', () => showSection(item.dataset.section)));

  // ── Settings search ──
  const settingsSearch = document.getElementById('settingsSearch');
  if (settingsSearch) {
    settingsSearch.addEventListener('input', e => {
      const q = e.target.value.toLowerCase().trim();
      if (!q) return;
      let found = null;
      sections.forEach(section => {
        if (!found && section.textContent.toLowerCase().includes(q))
          found = section.id.replace('section-', '');
      });
      if (found) showSection(found);
    });
  }

  // ══════════════════════════════════════════════════
  // AVATAR MENU & LOGOUT
  // ══════════════════════════════════════════════════
  const avatarBtn  = document.getElementById('avatarBtn');
  const avatarMenu = document.getElementById('avatarMenu');
  const logoutBtn  = document.getElementById('logoutBtn');

  if (avatarBtn) avatarBtn.addEventListener('click', e => { e.stopPropagation(); avatarMenu.classList.toggle('open'); });
  document.addEventListener('click', () => avatarMenu?.classList.remove('open'));
  if (logoutBtn) logoutBtn.addEventListener('click', () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '../auth/login.html';
  });

  // ══════════════════════════════════════════════════
  // SIDEBAR TOGGLE
  // ══════════════════════════════════════════════════
  const sidebar       = document.getElementById('sidebar');
  const sidebarToggle = document.getElementById('sidebarToggle');
  if (sidebarToggle) sidebarToggle.addEventListener('click', () => sidebar.classList.toggle('collapsed'));

  // ══════════════════════════════════════════════════
  // TOAST
  // ══════════════════════════════════════════════════
  window.showToast = function(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    const icons = {
      success: '<svg viewBox="0 0 14 14" fill="none"><path d="M2 7l3.5 3.5L12 3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
      error:   '<svg viewBox="0 0 14 14" fill="none"><path d="M3 3l8 8M11 3L3 11" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>',
      info:    '<svg viewBox="0 0 14 14" fill="none"><circle cx="7" cy="7" r="5.5" stroke="currentColor" stroke-width="1.2"/><line x1="7" y1="6" x2="7" y2="10" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/><circle cx="7" cy="4" r=".6" fill="currentColor"/></svg>',
    };
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `<span class="toast-icon">${icons[type] || icons.info}</span><span class="toast-text">${message}</span>`;
    container.appendChild(toast);
    setTimeout(() => { toast.classList.add('out'); setTimeout(() => toast.remove(), 280); }, 3200);
  };

  // ══════════════════════════════════════════════════
  // MODAL
  // ══════════════════════════════════════════════════
  const modalOverlay    = document.getElementById('modalOverlay');
  const modalClose      = document.getElementById('modalClose');
  const modalCancel     = document.getElementById('modalCancel');
  const modalConfirmBtn = document.getElementById('modalConfirmBtn');
  const modalTitleEl    = document.getElementById('modalTitle');
  const modalBodyEl     = document.getElementById('modalBody');
  const modalConfirmWrap= document.getElementById('modalConfirmWrap');
  const modalConfirmInp = document.getElementById('modalConfirmInput');
  let pendingAction = null;

  window.openModal = function(title, body, requireConfirm = false, onConfirm = null) {
    modalTitleEl.textContent = title;
    modalBodyEl.textContent  = body;
    pendingAction = onConfirm;
    modalConfirmWrap.style.display = requireConfirm ? 'flex' : 'none';
    if (requireConfirm) modalConfirmInp.value = '';
    modalOverlay.classList.add('open');
  };

  function closeModal() { modalOverlay.classList.remove('open'); pendingAction = null; }
  if (modalClose)      modalClose.addEventListener('click', closeModal);
  if (modalCancel)     modalCancel.addEventListener('click', closeModal);
  if (modalOverlay)    modalOverlay.addEventListener('click', e => { if (e.target === modalOverlay) closeModal(); });
  if (modalConfirmBtn) modalConfirmBtn.addEventListener('click', () => { if (pendingAction) pendingAction(); closeModal(); });

  // ── Last active ──
  const lastActiveEl = document.getElementById('lastActive');
  if (lastActiveEl) lastActiveEl.textContent = 'just now';

})();