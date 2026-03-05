/* =============================================
   MINERVA auth.js — clean, no lag
   ============================================= */
(function () {
  'use strict';

  // ── Grab elements ─────────────────────────
  const tabIn      = document.getElementById('tab-in');
  const tabUp      = document.getElementById('tab-up');
  const tabPill    = document.getElementById('tabPill');
  const track      = document.getElementById('track');
  const panelLogin = document.getElementById('panel-login');
  const panelSU    = document.getElementById('panel-signup');
  const fLogin     = document.getElementById('f-login');
  const fSignup    = document.getElementById('f-signup');
  const suPw       = document.getElementById('su-pw');
  const suCfm      = document.getElementById('su-cfm');
  const sBar       = document.getElementById('sBar');
  const sLabel     = document.getElementById('sLabel');
  const strength   = document.getElementById('strength');
  const matchMsg   = document.getElementById('matchMsg');

  let current = 'login';

  // ── Tab pill position ─────────────────────
  function movePill(tabEl) {
    const tRect  = tabEl.getBoundingClientRect();
    const pRect  = tabEl.closest('.tabs').getBoundingClientRect();
    tabPill.style.left  = (tRect.left - pRect.left) + 'px';
    tabPill.style.width = tRect.width + 'px';
  }

  movePill(tabIn);

  // ── Switch panels ─────────────────────────
  function switchTo(name) {
    if (name === current) return;
    current = name;

    const toSignup = name === 'signup';

    track.classList.toggle('show-signup', toSignup);
    movePill(toSignup ? tabUp : tabIn);

    tabIn.classList.toggle('active', !toSignup);
    tabUp.classList.toggle('active',  toSignup);

    panelLogin.setAttribute('aria-hidden', toSignup  ? 'true' : 'false');
    panelSU.setAttribute(   'aria-hidden', !toSignup ? 'true' : 'false');

    document.title = toSignup ? 'Minerva — Sign Up' : 'Minerva — Sign In';

    setTimeout(() => {
      const target = toSignup ? panelSU : panelLogin;
      const first  = target.querySelector('input');
      if (first) first.focus();
    }, 420);
  }

  panelSU.setAttribute('aria-hidden', 'true');

  tabIn.addEventListener('click', () => switchTo('login'));
  tabUp.addEventListener('click', () => switchTo('signup'));
  document.querySelectorAll('.nudge-btn').forEach(b =>
    b.addEventListener('click', () => switchTo(b.dataset.to))
  );

  window.addEventListener('resize', () => movePill(current === 'login' ? tabIn : tabUp));

  // ── Eye / password reveal ─────────────────
  document.querySelectorAll('.eyebtn').forEach(btn => {
    btn.addEventListener('click', () => {
      const inp = btn.closest('.field').querySelector('input');
      const show = inp.type === 'password';
      inp.type = show ? 'text' : 'password';
      btn.classList.toggle('revealed', show);
      btn.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
    });
  });

  // ── Password strength ─────────────────────
  const LEVELS = [
    { label: '',       color: 'transparent',            pct: 0   },
    { label: 'Weak',   color: 'rgba(248,113,113,.85)',  pct: 22  },
    { label: 'Fair',   color: 'rgba(251,191,36,.85)',   pct: 44  },
    { label: 'Good',   color: 'rgba(251,191,36,.95)',   pct: 66  },
    { label: 'Strong', color: 'rgba(110,231,183,.85)',  pct: 88  },
    { label: 'Great',  color: 'rgba(110,231,183,.95)',  pct: 100 },
  ];

  function scorePassword(pw) {
    if (!pw) return 0;
    let s = 0;
    if (pw.length >= 8)           s++;
    if (pw.length >= 12)          s++;
    if (/[A-Z]/.test(pw))         s++;
    if (/[0-9]/.test(pw))         s++;
    if (/[^A-Za-z0-9]/.test(pw))  s++;
    return s;
  }

  suPw.addEventListener('input', () => {
    const val = suPw.value;
    const lv  = LEVELS[scorePassword(val)];
    strength.classList.toggle('show', val.length > 0);
    sBar.style.width      = lv.pct + '%';
    sBar.style.background = lv.color;
    sLabel.textContent    = lv.label;
    sLabel.style.color    = lv.color;
    if (suCfm.value) checkMatch();
  });

  // ── Confirm match ─────────────────────────
  function checkMatch() {
    const ok = suPw.value === suCfm.value;
    if (!suCfm.value) {
      matchMsg.textContent = '';
      suCfm.classList.remove('err');
      return true;
    }
    matchMsg.textContent  = ok ? '✓ Passwords match' : '✗ Passwords do not match';
    matchMsg.style.color  = ok ? 'rgba(110,231,183,.88)' : 'rgba(248,113,113,.85)';
    suCfm.classList.toggle('err', !ok);
    return ok;
  }
  suCfm.addEventListener('input', checkMatch);

  // ── Field validation ──────────────────────
  function validEmail(v) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim()); }

  function validateField(inp) {
    const v  = inp.value.trim();
    let ok   = v.length > 0;
    if (ok && inp.type  === 'email')    ok = validEmail(v);
    if (ok && inp.name  === 'password') ok = v.length >= 6;
    inp.classList.toggle('err', !ok);
    return ok;
  }

  document.querySelectorAll('.field input').forEach(inp => {
    inp.addEventListener('blur',  () => { if (inp.value) validateField(inp); });
    inp.addEventListener('input', () => inp.classList.remove('err'));
  });

  // ── Ripple ────────────────────────────────
  function ripple(btn, e) {
    const el   = document.createElement('span');
    const rect = btn.getBoundingClientRect();
    const sz   = Math.max(rect.width, rect.height);
    el.className = 'ripple';
    el.style.cssText = `width:${sz}px;height:${sz}px;
      left:${e.clientX - rect.left - sz/2}px;
      top:${e.clientY  - rect.top  - sz/2}px`;
    btn.appendChild(el);
    setTimeout(() => el.remove(), 520);
  }

  document.querySelectorAll('.submit-btn').forEach(btn =>
    btn.addEventListener('click', e => ripple(btn, e))
  );

  // ── Submit ────────────────────────────────
  async function handleSubmit(form, successLabel, afterSuccess) {
    const inputs = [...form.querySelectorAll('input')];
    const btn    = form.querySelector('.submit-btn');
    let valid    = inputs.every(validateField);

    if (form === fSignup && !checkMatch()) valid = false;

    if (!valid) {
      form.classList.remove('shake');
      void form.offsetWidth;
      form.classList.add('shake');
      return;
    }

    btn.classList.add('loading');

    const isLogin  = form === fLogin;
    const endpoint = isLogin
      ? 'http://localhost:4000' 
  : 'https://minerva-spwa.onrender.com';

    const body = isLogin
      ? { email: form.email.value, password: form.password.value }
      : { name: form.name.value, email: form.email.value, password: form.password.value };

    try {
      const res  = await fetch(endpoint, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(body)
      });

      const data = await res.json();

      if (!res.ok) {
        btn.classList.remove('loading');
        form.classList.remove('shake');
        void form.offsetWidth;
        form.classList.add('shake');
        alert(data.error || 'Something went wrong.');
        return;
      }

      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));

      btn.classList.remove('loading');
      btn.classList.add('success');
      btn.querySelector('.btn-text').textContent = successLabel;
      btn.querySelector('.btn-arr').textContent  = '✓';
      setTimeout(afterSuccess, 1500);

    } catch (err) {
      btn.classList.remove('loading');
      alert('Could not connect to server. Is it running?');
    }
  }

  fLogin.addEventListener('submit', e => {
    e.preventDefault();
    handleSubmit(fLogin, 'Welcome back!', () => {
      window.location.href = '../dashboard/dashboard.html';
    });
  });

  fSignup.addEventListener('submit', e => {
    e.preventDefault();
    handleSubmit(fSignup, 'Account created!', () => {
      const btn = fSignup.querySelector('.submit-btn');
      btn.classList.remove('success');
      btn.querySelector('.btn-text').textContent = 'Create Account';
      btn.querySelector('.btn-arr').textContent  = '→';
      switchTo('login');
    });
  });

})();