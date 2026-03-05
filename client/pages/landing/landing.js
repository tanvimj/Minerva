/* ============================================
   MINERVA — script.js
   ============================================ */

// --- Nav scroll effect ---
const nav = document.getElementById('nav');
window.addEventListener('scroll', () => {
  nav.classList.toggle('scrolled', window.scrollY > 20);
}, { passive: true });

// --- Mobile menu toggle ---
const hamburger = document.getElementById('hamburger');
const mobileMenu = document.getElementById('mobileMenu');

hamburger.addEventListener('click', () => {
  const isOpen = mobileMenu.classList.toggle('open');
  hamburger.classList.toggle('open', isOpen);
  hamburger.setAttribute('aria-expanded', isOpen);
});

// Close mobile menu on link click
mobileMenu.querySelectorAll('a').forEach(link => {
  link.addEventListener('click', () => {
    mobileMenu.classList.remove('open');
    hamburger.classList.remove('open');
    hamburger.setAttribute('aria-expanded', false);
  });
});

// --- Scroll-triggered card reveals ---
const cards = document.querySelectorAll('.feature-card');

const revealObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      const delay = parseInt(entry.target.dataset.delay || 0);
      setTimeout(() => {
        entry.target.classList.add('visible');
      }, delay);
      revealObserver.unobserve(entry.target);
    }
  });
}, {
  threshold: 0.12,
  rootMargin: '0px 0px -40px 0px'
});

cards.forEach(card => revealObserver.observe(card));

// --- Smooth anchor scrolling (offset for fixed nav) ---
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
  anchor.addEventListener('click', (e) => {
    const target = document.querySelector(anchor.getAttribute('href'));
    if (!target) return;
    e.preventDefault();
    const navHeight = document.getElementById('nav').offsetHeight;
    const top = target.getBoundingClientRect().top + window.scrollY - navHeight - 16;
    window.scrollTo({ top, behavior: 'smooth' });
  });
});

// --- Subtle parallax on hero orb (desktop only) ---
// --- Neural Graph ---
(function () {
  const svg       = document.getElementById('neuralSvg');
  const edgeGroup = document.getElementById('edgeGroup');
  const nodeGroup = document.getElementById('nodeGroup');
  if (!svg) return;

  const W = 420, H = 420;

  // Node definitions: [x, y, radius, label]
  const nodes = [
    { x: 210, y: 210, r: 18,  label: 'Minerva'   },  // 0 — center hub
    { x: 210, y:  80, r: 11,  label: 'Goals'      },  // 1
    { x: 330, y: 130, r:  9,  label: 'Notes'      },  // 2
    { x: 355, y: 250, r: 10,  label: 'Projects'   },  // 3
    { x: 295, y: 355, r:  9,  label: 'Analytics'  },  // 4
    { x: 125, y: 355, r:  9,  label: 'Resources'  },  // 5
    { x:  65, y: 250, r: 10,  label: 'Graph'      },  // 6
    { x:  90, y: 130, r:  9,  label: 'Ideas'      },  // 7
    { x: 210, y: 148, r:  7,  label: ''           },  // 8  — orbital cluster
    { x: 285, y: 175, r:  6,  label: ''           },  // 9
    { x: 305, y: 255, r:  6,  label: ''           },  // 10
    { x: 255, y: 320, r:  6,  label: ''           },  // 11
    { x: 165, y: 320, r:  6,  label: ''           },  // 12
    { x: 115, y: 255, r:  6,  label: ''           },  // 13
    { x: 135, y: 175, r:  6,  label: ''           },  // 14
    { x: 340, y: 185, r:  5,  label: ''           },  // 15
    { x:  82, y: 185, r:  5,  label: ''           },  // 16
    { x: 165, y:  95, r:  5,  label: ''           },  // 17
    { x: 255, y:  95, r:  5,  label: ''           },  // 18
  ];

  // Edges: [fromIndex, toIndex]
  const edges = [
    [0,1],[0,2],[0,3],[0,4],[0,5],[0,6],[0,7],   // hub spokes
    [1,8],[2,9],[3,10],[4,11],[5,12],[6,13],[7,14], // hub→orbital
    [8,9],[9,10],[10,11],[11,12],[12,13],[13,14],[14,8], // orbital ring
    [1,17],[1,18],[2,15],[3,15],[6,16],[7,16],     // outer ties
    [8,14],[9,15],[11,4],[12,5],[2,18],[7,17],     // cross links
    [3,9],[6,14],[4,10],[5,13],                    // diagonal web
  ];

  // --- Build SVG elements ---
  const edgeEls = [];
  edges.forEach(([a, b], i) => {
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('x1', nodes[a].x);
    line.setAttribute('y1', nodes[a].y);
    line.setAttribute('x2', nodes[b].x);
    line.setAttribute('y2', nodes[b].y);
    line.classList.add('graph-edge');
    line.dataset.a = a;
    line.dataset.b = b;
    edgeGroup.appendChild(line);
    edgeEls.push(line);
  });

  const nodeEls      = [];  // { outer, inner, pulse, labelEl }
  const travelDotEls = [];

  nodes.forEach((n, i) => {
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');

    // Outer halo
    const outer = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    outer.setAttribute('cx', n.x);
    outer.setAttribute('cy', n.y);
    outer.setAttribute('r', n.r + 6);
    outer.classList.add('graph-node-outer');

    // Pulse ring (hidden until active)
    const pulse = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    pulse.setAttribute('cx', n.x);
    pulse.setAttribute('cy', n.y);
    pulse.setAttribute('r', n.r + 6);
    pulse.classList.add('pulse-ring');
    pulse.style.display = 'none';

    // Inner dot
    const inner = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    inner.setAttribute('cx', n.x);
    inner.setAttribute('cy', n.y);
    inner.setAttribute('r', n.r);
    inner.classList.add('graph-node-inner');

    // Fill gradient per node size
    const hue = i === 0 ? '260' : '255';
    const alpha = i === 0 ? '0.55' : '0.35';
    inner.setAttribute('fill', `hsla(${hue},80%,72%,${alpha})`);
    inner.setAttribute('stroke', `hsla(${hue},80%,80%,0.5)`);
    inner.setAttribute('stroke-width', '1');

    g.appendChild(outer);
    g.appendChild(pulse);
    g.appendChild(inner);

    // Label
    let labelEl = null;
    if (n.label) {
      labelEl = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      labelEl.setAttribute('x', n.x);
      labelEl.setAttribute('y', n.y + n.r + 16);
      labelEl.classList.add('graph-node-label');
      labelEl.textContent = n.label;
      g.appendChild(labelEl);
    }

    nodeGroup.appendChild(g);
    nodeEls.push({ outer, inner, pulse, labelEl, g });

    // Hover interaction
    outer.addEventListener('mouseenter', () => activateNode(i, true));
    outer.addEventListener('mouseleave', () => activateNode(i, false));
    inner.addEventListener('mouseenter', () => activateNode(i, true));
    inner.addEventListener('mouseleave', () => activateNode(i, false));
  });

  // --- Activate / deactivate a node ---
  function activateNode(idx, on) {
    const { outer, inner, pulse, labelEl } = nodeEls[idx];
    outer.classList.toggle('active', on);
    inner.classList.toggle('active', on);
    pulse.style.display = on ? 'block' : 'none';
    if (labelEl) labelEl.classList.toggle('active', on);

    // Highlight connected edges
    edgeEls.forEach(el => {
      const a = parseInt(el.dataset.a);
      const b = parseInt(el.dataset.b);
      if (a === idx || b === idx) el.classList.toggle('active', on);
    });
  }

  // --- Travelling dot animation ---
  function spawnTravelDot(edgeIndex) {
    const [a, b] = edges[edgeIndex];
    const na = nodes[a], nb = nodes[b];

    const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    dot.setAttribute('r', '2.5');
    dot.classList.add('travel-dot');
    svg.appendChild(dot);

    const reverse  = Math.random() > 0.5;
    const duration = 900 + Math.random() * 800;
    const start    = performance.now();

    function step(now) {
      let t = (now - start) / duration;
      if (t > 1) {
        svg.removeChild(dot);
        return;
      }
      // ease in-out
      t = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
      const x = reverse ? nb.x + (na.x - nb.x) * t : na.x + (nb.x - na.x) * t;
      const y = reverse ? nb.y + (na.y - nb.y) * t : na.y + (nb.y - na.y) * t;
      dot.setAttribute('cx', x);
      dot.setAttribute('cy', y);
      requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  // --- Auto-pulse: randomly light up nodes + spawn dots ---
  function autoAnimate() {
    // Pick a random non-hub node to briefly activate
    const idx = 1 + Math.floor(Math.random() * (nodes.length - 1));
    activateNode(idx, true);
    setTimeout(() => activateNode(idx, false), 1200);

    // Spawn a travelling dot on a random edge
    const edgeIdx = Math.floor(Math.random() * edges.length);
    spawnTravelDot(edgeIdx);
  }

  setInterval(autoAnimate, 1400);

  // --- Slow drift / float of the whole graph ---
  const graphEl = document.querySelector('.neural-graph');
  if (graphEl) {
    let tick = 0;
    function drift() {
      tick += 0.004;
      const dy = Math.sin(tick) * 6;
      const dx = Math.cos(tick * 0.7) * 3;
      graphEl.style.transform = `translate(${dx}px, ${dy}px)`;
      requestAnimationFrame(drift);
    }
    drift();
  }

  // --- Mouse parallax (desktop) ---
  if (window.matchMedia('(min-width: 900px)').matches && graphEl) {
    window.addEventListener('mousemove', (e) => {
      const cx = window.innerWidth / 2;
      const cy = window.innerHeight / 2;
      const dx = (e.clientX - cx) / cx;
      const dy = (e.clientY - cy) / cy;
      graphEl.style.transform = `translate(${dx * 12}px, ${dy * 12}px)`;
    }, { passive: true });
  }

})();