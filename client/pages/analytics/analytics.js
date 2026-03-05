/* =====================================================
   MINERVA — analytics.js
   ===================================================== */
'use strict'

// ── Auth Guard ─────────────────────────────────────
const token = localStorage.getItem('token')
const user  = JSON.parse(localStorage.getItem('user') || 'null')
if (!token || !user) window.location.href = '../auth/login.html'

// ── User info ──────────────────────────────────────
if (user) {
  const initials = user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0,2)
  const el = document.getElementById('avatarInitials')
  if (el) el.textContent = initials
  const dateEl = document.getElementById('pageDate')
  if (dateEl) {
    const now = new Date()
    dateEl.textContent = `${user.name.split(' ')[0]} · ${now.toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric'})}`
  }
}

// ── Avatar menu ────────────────────────────────────
const avatarBtn  = document.getElementById('avatarBtn')
const avatarMenu = document.getElementById('avatarMenu')
const logoutBtn  = document.getElementById('logoutBtn')
const menuName   = document.getElementById('avatarMenuName')
const menuEmail  = document.getElementById('avatarMenuEmail')
if (user) {
  if (menuName)  menuName.textContent  = user.name
  if (menuEmail) menuEmail.textContent = user.email
}
avatarBtn?.addEventListener('click', e => { e.stopPropagation(); avatarMenu.classList.toggle('open') })
document.addEventListener('click', () => avatarMenu?.classList.remove('open'))
logoutBtn?.addEventListener('click', () => {
  localStorage.removeItem('token'); localStorage.removeItem('user')
  window.location.href = '../auth/login.html'
})

// ── Sidebar ────────────────────────────────────────
document.getElementById('sidebarToggle')?.addEventListener('click', () =>
  document.getElementById('sidebar').classList.toggle('collapsed'))

// ══════════════════════════════════════════════════
// STATE
// ══════════════════════════════════════════════════
let API_DATA = null
let activeRange = 7
let productivityChart = null

const TAG_COLORS = [
  'rgba(167,139,250,0.9)','rgba(110,231,183,0.9)','rgba(251,191,36,0.9)',
  'rgba(251,146,60,0.9)', 'rgba(96,165,250,0.9)', 'rgba(248,113,113,0.9)',
  'rgba(167,243,208,0.9)','rgba(196,181,253,0.9)',
]

// ══════════════════════════════════════════════════
// FETCH
// ══════════════════════════════════════════════════
async function fetchAnalytics() {
  try {
    const res = await fetch('http://localhost:4000/api/analytics', {
      headers: { 'Authorization': `Bearer ${token}` }
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    API_DATA = await res.json()
  } catch (err) {
    console.warn('Using mock data:', err.message)
    API_DATA = buildMockData()
  }
  renderAll()
}

// ══════════════════════════════════════════════════
// RENDER ALL
// ══════════════════════════════════════════════════
function renderAll() {
  updateStatCards()
  renderProductivityChart(activeRange)
  renderHeatmap()
  renderTagChart()
  renderWritingHours()

  // Reveal everything + animate counters after one frame
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      initScrollReveal()
    })
  })

  const idle = window.requestIdleCallback || (cb => setTimeout(cb, 80))
  idle(() => buildMiniGraph())
  idle(() => initInsightCards())

  setTimeout(() => {
    const n7 = API_DATA.productivity7.notes
    const w7 = API_DATA.productivity7.words.map(w => Math.round(w / 100))
    drawSparkline('spark-notes', n7, 'rgba(167,139,250,0.9)')
    drawSparkline('spark-words', w7, 'rgba(110,231,183,0.9)')
    drawSparkline('spark-week',  n7, 'rgba(251,146,60,0.9)')
    drawSparkline('spark-links', n7, 'rgba(251,191,36,0.9)')
  }, 200)
}

// ══════════════════════════════════════════════════
// 1. STAT CARDS — write real values into existing HTML
// ══════════════════════════════════════════════════
function updateStatCards() {
  const o = API_DATA.overview

  // helper: update a stat-value el's data-target so counter animates to real value
  function setTarget(key, value, suffix) {
    const card = document.querySelector(`[data-stat-key="${key}"]`)
    if (!card) return
    const el = card.querySelector('.stat-value')
    if (!el) return
    if (typeof value === 'string') {
      el.textContent = value
      delete el.dataset.target
      return
    }
    el.dataset.target = value
    el.dataset.suffix = suffix || ''
    el.dataset.format = value >= 1000 ? 'compact' : ''
    el.textContent    = '0' + (suffix || '')
  }

  function setDelta(key, text, cls) {
    const card = document.querySelector(`[data-stat-key="${key}"]`)
    if (!card) return
    const el = card.querySelector('.stat-delta')
    if (!el) return
    el.textContent = text
    el.className   = `stat-delta ${cls || 'neutral'}`
  }

  setTarget('totalNotes', o.totalNotes)
  setTarget('totalWords', o.totalWords)
  setTarget('notesWeek',  o.notesThisWeek)
  setTarget('streak',     o.streak, ' days')
  setTarget('activeTag',  `#${o.mostActiveTag.toLowerCase()}`)
  // activeGoals key maps to the "Notes This Week" card in the HTML
  // (HTML has activeGoals key on the calendar card)
  setTarget('activeGoals', o.notesThisWeek)

  // Deltas
  const notesDir = o.notesWoWDelta > 0 ? 'positive' : o.notesWoWDelta < 0 ? 'negative' : 'neutral'
  const wordsDir = o.wordsWoWDelta > 0 ? 'positive' : o.wordsWoWDelta < 0 ? 'negative' : 'neutral'
  setDelta('totalNotes', `${o.notesWoWDelta > 0 ? '↑' : '↓'} ${Math.abs(o.notesWoWDelta)}% vs last week`, notesDir)
  setDelta('totalWords', `${o.wordsWoWDelta > 0 ? '↑' : '↓'} ${Math.abs(o.wordsWoWDelta)}% vs last week`, wordsDir)
  setDelta('activeTag',  `${o.mostActiveTagCount} notes tagged`, 'neutral')
  setDelta('streak',     o.streak > 0 ? '🔥 Keep it going!' : 'Start your streak today', 'positive')
}

// ══════════════════════════════════════════════════
// 2. PRODUCTIVITY CHART
// ══════════════════════════════════════════════════
function renderProductivityChart(range) {
  const keyMap = { 7: 'productivity7', 30: 'productivity30', 90: 'productivity90' }
  const data   = API_DATA[keyMap[range]] || API_DATA.productivity7
  const scaled = data.words.map(w => Math.round(w / 100))
  const peakIdx = data.notes.indexOf(Math.max(...data.notes))

  const canvas = document.getElementById('productivityChart')
  if (!canvas) return
  const ctx = canvas.getContext('2d')

  const ng = ctx.createLinearGradient(0,0,0,260)
  ng.addColorStop(0,'rgba(167,139,250,0.3)'); ng.addColorStop(1,'rgba(167,139,250,0)')
  const wg = ctx.createLinearGradient(0,0,0,260)
  wg.addColorStop(0,'rgba(110,231,183,0.2)'); wg.addColorStop(1,'rgba(110,231,183,0)')

  const cfg = {
    type: 'line',
    data: {
      labels: data.labels,
      datasets: [
        {
          label:'Notes', data:data.notes,
          borderColor:'rgba(167,139,250,0.9)', backgroundColor:ng,
          borderWidth:2, tension:0.4, fill:true, yAxisID:'yNotes',
          pointRadius: data.notes.map((_,i) => i===peakIdx ? 5 : 0),
          pointBackgroundColor:'rgba(167,139,250,1)',
          pointBorderColor:'#07070e', pointBorderWidth:2,
        },
        {
          label:'Words ÷100', data:scaled,
          borderColor:'rgba(110,231,183,0.7)', backgroundColor:wg,
          borderWidth:1.5, tension:0.4, fill:true, yAxisID:'yWords', pointRadius:0,
        }
      ]
    },
    options: {
      responsive:true, maintainAspectRatio:false,
      interaction:{ mode:'index', intersect:false },
      animation:{ duration:700, easing:'easeInOutQuart' },
      plugins:{
        legend:{ display:false },
        tooltip:{
          backgroundColor:'rgba(12,10,24,0.95)', borderColor:'rgba(255,255,255,0.08)',
          borderWidth:1, titleColor:'rgba(255,255,255,0.9)', bodyColor:'rgba(255,255,255,0.55)', padding:10,
          callbacks:{ label: c => c.datasetIndex===0 ? `  Notes: ${c.parsed.y}` : `  Words: ~${c.parsed.y*100}` }
        }
      },
      scales:{
        x:{ grid:{color:'rgba(255,255,255,0.04)',drawTicks:false}, border:{display:false},
            ticks:{color:'rgba(255,255,255,0.25)',font:{size:10},maxTicksLimit:range<=7?7:10,maxRotation:0} },
        yNotes:{ position:'left', grid:{color:'rgba(255,255,255,0.04)',drawTicks:false}, border:{display:false},
                 ticks:{color:'rgba(255,255,255,0.25)',font:{size:10},maxTicksLimit:5} },
        yWords:{ position:'right', grid:{display:false}, border:{display:false},
                 ticks:{color:'rgba(110,231,183,0.4)',font:{size:10},maxTicksLimit:5} }
      }
    }
  }

  if (productivityChart) {
    productivityChart.data    = cfg.data
    productivityChart.options = cfg.options
    productivityChart.update('active')
  } else {
    productivityChart = new Chart(ctx, cfg)
  }
}

document.querySelectorAll('.range-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.range-btn').forEach(b => b.classList.remove('active'))
    btn.classList.add('active')
    activeRange = parseInt(btn.dataset.range) || 7
    if (API_DATA) renderProductivityChart(activeRange)
  })
})

// ══════════════════════════════════════════════════
// 3. HEATMAP
// ══════════════════════════════════════════════════
function renderHeatmap() {
  const grid   = document.getElementById('heatmapGrid')
  const months = document.getElementById('heatmapMonths')
  if (!grid || !months) return

  const cells = API_DATA.heatmap
  const frag  = document.createDocumentFragment()
  cells.forEach(cell => {
    const el = document.createElement('div')
    el.className     = 'hm-cell-item'
    el.dataset.level = cell.level
    el.title         = `${cell.date} · ${cell.count} note${cell.count!==1?'s':''}`
    frag.appendChild(el)
  })
  grid.innerHTML = ''; grid.appendChild(frag)

  const seen = {}
  cells.forEach((c, idx) => {
    const mon = new Date(c.date+'T00:00:00').toLocaleDateString('en-US',{month:'short'})
    if (!seen[mon]) { seen[mon] = true }
  })
  const mFrag = document.createDocumentFragment()
  Object.keys(seen).forEach(mon => {
    const el = document.createElement('div')
    el.className = 'heatmap-month-label'; el.textContent = mon
    mFrag.appendChild(el)
  })
  months.innerHTML = ''; months.appendChild(mFrag)
}

// ══════════════════════════════════════════════════
// 4. TAG CHART
// ══════════════════════════════════════════════════
function renderTagChart() {
  const canvas = document.getElementById('tagChart')
  if (!canvas) return

  const tags = API_DATA.tagDistribution.map((t,i) => ({...t, color: TAG_COLORS[i%TAG_COLORS.length]}))

  const donutNum = document.querySelector('.donut-num')
  if (donutNum) donutNum.textContent = tags.length

  new Chart(canvas.getContext('2d'), {
    type:'doughnut',
    data:{
      labels: tags.map(t=>t.label),
      datasets:[{
        data: tags.map(t=>t.count),
        backgroundColor: tags.map(t=>t.color),
        borderColor:'rgba(7,7,14,0.9)', borderWidth:2, hoverOffset:6
      }]
    },
    options:{
      responsive:false, cutout:'70%',
      plugins:{
        legend:{display:false},
        tooltip:{backgroundColor:'rgba(12,10,24,0.95)',borderColor:'rgba(255,255,255,0.08)',
                 borderWidth:1,titleColor:'rgba(255,255,255,0.9)',bodyColor:'rgba(255,255,255,0.55)',padding:8}
      },
      animation:{animateRotate:true,duration:900}
    }
  })

  const list = document.getElementById('tagList')
  if (!list) return
  const frag = document.createDocumentFragment()
  tags.forEach(tag => {
    const item = document.createElement('div')
    item.className = 'tag-item'
    item.innerHTML = `<span class="tag-swatch" style="background:${tag.color}"></span><span class="tag-name">${tag.label}</span><span class="tag-count">${tag.count}</span>`
    frag.appendChild(item)
  })
  list.innerHTML = ''; list.appendChild(frag)
}

// ══════════════════════════════════════════════════
// 5. WRITING HOURS
// ══════════════════════════════════════════════════
function renderWritingHours() {
  const grid = document.getElementById('timeGrid')
  if (!grid) return
  const slice = API_DATA.writingHours.slice(6,24)
  const rows  = [
    slice,
    slice.map(v => Math.max(0, v - (Math.random()>0.6?1:0))),
    slice.map(v => Math.min(4, v + (Math.random()>0.75?1:0))),
  ]
  const frag = document.createDocumentFragment()
  rows.forEach(row => row.forEach(v => {
    const cell = document.createElement('div')
    cell.className = 'time-cell'
    if (v > 0) cell.dataset.intensity = Math.min(4, v)
    frag.appendChild(cell)
  }))
  grid.innerHTML = ''; grid.appendChild(frag)

  const peakEl = document.querySelector('.time-peak-note strong')
  if (peakEl && API_DATA.peakWritingHour) peakEl.textContent = API_DATA.peakWritingHour
}

// ══════════════════════════════════════════════════
// MINI GRAPH
// ══════════════════════════════════════════════════
function buildMiniGraph() {
  const canvas = document.getElementById('miniGraph')
  if (!canvas) return
  const items = (API_DATA.tagDistribution||[]).slice(0,5).map(t=>({name:t.label,links:t.count}))
  if (!items.length) return
  const ctx = canvas.getContext('2d')
  const W = canvas.offsetWidth || 260; const H = 140
  canvas.width = W; canvas.height = H
  const maxVal  = Math.max(...items.map(d=>d.links),1)
  const barH=14, gap=8
  const startY  = (H-(items.length*(barH+gap)-gap))/2
  const barMaxW = W-48
  ctx.clearRect(0,0,W,H)
  items.forEach((item,i) => {
    const y  = startY + i*(barH+gap)
    const bw = (item.links/maxVal)*barMaxW
    ctx.fillStyle='rgba(255,255,255,0.05)'
    rr(ctx,0,y,barMaxW,barH,4); ctx.fill()
    const grad=ctx.createLinearGradient(0,0,bw,0)
    grad.addColorStop(0,'rgba(124,58,237,0.7)'); grad.addColorStop(1,'rgba(167,139,250,0.9)')
    ctx.fillStyle=grad; rr(ctx,0,y,bw,barH,4); ctx.fill()
    ctx.fillStyle='rgba(167,139,250,0.9)'; ctx.font='500 10px DM Sans,system-ui'
    ctx.textAlign='left'; ctx.fillText(item.links, bw+6, y+barH-2)
  })
}
function rr(ctx,x,y,w,h,r) {
  ctx.beginPath(); ctx.moveTo(x+r,y); ctx.lineTo(x+w-r,y)
  ctx.quadraticCurveTo(x+w,y,x+w,y+r); ctx.lineTo(x+w,y+h-r)
  ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h); ctx.lineTo(x+r,y+h)
  ctx.quadraticCurveTo(x,y+h,x,y+h-r); ctx.lineTo(x,y+r)
  ctx.quadraticCurveTo(x,y,x+r,y); ctx.closePath()
}

// ══════════════════════════════════════════════════
// SPARKLINES
// ══════════════════════════════════════════════════
function drawSparkline(id, data, color) {
  const wrap = document.getElementById(id)
  if (!wrap || !data.length) return
  wrap.innerHTML=''
  const canvas=document.createElement('canvas')
  canvas.width=wrap.offsetWidth||100; canvas.height=28
  wrap.appendChild(canvas)
  const ctx=canvas.getContext('2d')
  const max=Math.max(...data),min=Math.min(...data),range=max-min||1
  const W=canvas.width,H=canvas.height,step=W/(data.length-1)
  const grad=ctx.createLinearGradient(0,0,0,H)
  grad.addColorStop(0,color.replace('0.9)','0.3)')); grad.addColorStop(1,'transparent')
  ctx.beginPath()
  data.forEach((v,i)=>{ const x=i*step,y=H-((v-min)/range)*(H-4)-2; i===0?ctx.moveTo(x,y):ctx.lineTo(x,y) })
  ctx.lineTo((data.length-1)*step,H); ctx.lineTo(0,H); ctx.closePath()
  ctx.fillStyle=grad; ctx.fill()
  ctx.beginPath()
  data.forEach((v,i)=>{ const x=i*step,y=H-((v-min)/range)*(H-4)-2; i===0?ctx.moveTo(x,y):ctx.lineTo(x,y) })
  ctx.strokeStyle=color; ctx.lineWidth=1.5; ctx.stroke()
}

// ══════════════════════════════════════════════════
// INSIGHT CARDS
// ══════════════════════════════════════════════════
function initInsightCards() {
  document.querySelectorAll('.insight-expand').forEach(btn => {
    btn.addEventListener('click', () => {
      const card   = btn.closest('.insight-card')
      const detail = card.querySelector('.insight-detail')
      if (!detail) return
      const open = detail.classList.contains('open')
      detail.classList.toggle('open', !open)
      btn.classList.toggle('expanded', !open)
    })
  })
}

// ══════════════════════════════════════════════════
// SCROLL REVEAL + COUNTER ANIMATION
// ══════════════════════════════════════════════════
function animateCounter(el) {
  const raw    = el.dataset.target
  const suffix = el.dataset.suffix || ''
  const fmt    = el.dataset.format
  if (raw === undefined || raw === '') return
  const target = parseFloat(raw)
  if (isNaN(target)) return
  const dur = 1200, start = performance.now()
  function step(now) {
    const p = Math.min((now-start)/dur, 1)
    const e = 1 - Math.pow(2, -10*p)
    const v = e * target
    let display = (fmt==='compact' && v>=1000) ? (v/1000).toFixed(1)+'k'
                : Number.isInteger(target) ? Math.round(v).toString()
                : v.toFixed(1)
    el.textContent = display + suffix
    if (p < 1) requestAnimationFrame(step)
  }
  requestAnimationFrame(step)
}

function initScrollReveal() {
  const obs = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return
      const el    = entry.target
      const delay = parseInt(el.dataset.delay || '0', 10)
      setTimeout(() => {
        el.classList.add('visible')
        // Animate all counter targets inside this element
        el.querySelectorAll('[data-target]').forEach(animateCounter)
        // Animate bar fills
        el.querySelectorAll('.linked-bar-fill').forEach(f => {
          f.style.width = (f.dataset.width || 0) + '%'
        })
      }, delay)
      obs.unobserve(el)
    })
  }, { threshold: 0.05, rootMargin: '0px 0px -20px 0px' })

  document.querySelectorAll('.reveal').forEach(el => obs.observe(el))
}

// ══════════════════════════════════════════════════
// MOCK DATA FALLBACK
// ══════════════════════════════════════════════════
function buildMockData() {
  function gen(days,min,max) {
    const a=[]; let v=Math.round((min+max)/2)
    for(let i=0;i<days;i++){v=Math.max(min,Math.min(max,v+(Math.random()-0.45)*(max-min)*0.3));a.push(Math.round(v))}
    return a
  }
  function lbls(days) {
    const a=[],t=new Date()
    for(let i=days-1;i>=0;i--){const d=new Date(t);d.setDate(t.getDate()-i);a.push(d.toLocaleDateString('en-US',{month:'short',day:'numeric'}))}
    return a
  }
  const n7=gen(7,0,8),n30=gen(30,0,10),n90=gen(90,0,12)
  const heatmap=[]
  for(let i=139;i>=0;i--){
    const d=new Date();d.setDate(d.getDate()-i)
    const r=Math.abs(Math.sin(d.getDate()+d.getMonth()*31+1)*10000)%1
    const level=r<0.2?0:r<0.45?1:r<0.65?2:r<0.82?3:4
    heatmap.push({date:d.toISOString().split('T')[0],count:[0,1,3,6,10][level],level})
  }
  return {
    overview:{totalNotes:142,totalWords:24870,notesThisWeek:19,activeGoals:8,streak:27,
              mostActiveTag:'ideas',mostActiveTagCount:47,notesWoWDelta:12,wordsWoWDelta:8},
    productivity7: {notes:n7, words:n7.map(v=>v*180), labels:lbls(7)},
    productivity30:{notes:n30,words:n30.map(v=>v*180),labels:lbls(30)},
    productivity90:{notes:n90,words:n90.map(v=>v*180),labels:lbls(90)},
    tagDistribution:[
      {label:'#ideas',count:47},{label:'#research',count:34},{label:'#project',count:28},
      {label:'#learning',count:22},{label:'#design',count:18},{label:'#personal',count:14}
    ],
    heatmap,
    writingHours:[0,0,0,0,0,0,1,1,2,1,1,1,1,1,2,3,2,4,4,3,3,2,1,0],
    peakWritingHour:'8pm–10pm',
  }
}

// ── Boot ───────────────────────────────────────────
fetchAnalytics()