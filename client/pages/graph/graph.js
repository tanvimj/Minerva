/* =====================================================
   MINERVA — graph.js
   Force-directed knowledge graph engine
   ===================================================== */
'use strict'

// ── Auth ──────────────────────────────────────────
const token = localStorage.getItem('token')
const user  = JSON.parse(localStorage.getItem('user') || 'null')
if (!token || !user) window.location.href = '../auth/login.html'

// ══════════════════════════════════════════════════
// CANVAS & CONTEXT
// ══════════════════════════════════════════════════
const canvas  = document.getElementById('graphCanvas')
const ctx     = canvas.getContext('2d')
const wrapper = document.getElementById('graphWrap')

let W = 0, H = 0

function resizeCanvas() {
  const dpr = window.devicePixelRatio || 1
  W = wrapper.clientWidth
  H = wrapper.clientHeight
  canvas.width  = W * dpr
  canvas.height = H * dpr
  canvas.style.width  = W + 'px'
  canvas.style.height = H + 'px'
  ctx.scale(dpr, dpr)
  renderFrame()
}

// ══════════════════════════════════════════════════
// BACKGROUND PARTICLE SYSTEM
// ══════════════════════════════════════════════════
const bgCanvas = document.getElementById('bgParticles')
const bgCtx    = bgCanvas.getContext('2d')
const PARTICLES = []
const PARTICLE_COUNT = 80

function initParticles() {
  bgCanvas.width  = window.innerWidth
  bgCanvas.height = window.innerHeight
  PARTICLES.length = 0
  for (let i = 0; i < PARTICLE_COUNT; i++) {
    PARTICLES.push({
      x:  Math.random() * window.innerWidth,
      y:  Math.random() * window.innerHeight,
      vx: (Math.random() - 0.5) * 0.18,
      vy: (Math.random() - 0.5) * 0.18,
      r:  Math.random() * 1.2 + 0.3,
      a:  Math.random() * 0.5 + 0.1,
    })
  }
}

function tickParticles() {
  bgCtx.clearRect(0, 0, bgCanvas.width, bgCanvas.height)
  PARTICLES.forEach(p => {
    p.x += p.vx; p.y += p.vy
    if (p.x < 0) p.x = bgCanvas.width
    if (p.x > bgCanvas.width)  p.x = 0
    if (p.y < 0) p.y = bgCanvas.height
    if (p.y > bgCanvas.height) p.y = 0
    bgCtx.beginPath()
    bgCtx.arc(p.x, p.y, p.r, 0, Math.PI * 2)
    bgCtx.fillStyle = `rgba(167,139,250,${p.a})`
    bgCtx.fill()
  })
  requestAnimationFrame(tickParticles)
}

// ══════════════════════════════════════════════════
// GRAPH STATE
// ══════════════════════════════════════════════════
let nodes         = []
let edges         = []
let filteredNodes = []
let filteredEdges = []

let selectedNode = null
let hoveredNode  = null
let draggingNode = null

let camX = 0, camY = 0, camScale = 1
let lastMouse = { x: 0, y: 0 }
let dragStart = { x: 0, y: 0 }
let isPanning = false

let showLabels    = true
let animateEdges  = true
let clusterMode   = false
let sizeMode      = 'links'
let activeFilter  = 'all'
let activeTagFilter = null
let edgePulse     = 0

const TAG_PALETTE = [
  '#a78bfa', '#c4b5fd', '#6ee7b7', '#fbbf24',
  '#f87171', '#fb923c', '#60a5fa', '#34d399',
  '#facc15', '#818cf8',
]
const tagColorMap = {}
let tagColorIdx = 0

function getTagColor(tag) {
  if (!tag) return '#a78bfa'
  if (!tagColorMap[tag]) {
    tagColorMap[tag] = TAG_PALETTE[tagColorIdx % TAG_PALETTE.length]
    tagColorIdx++
  }
  return tagColorMap[tag]
}

// ══════════════════════════════════════════════════
// FETCH DATA
// ══════════════════════════════════════════════════
async function loadGraph() {
  try {
    const res = await fetch('http://localhost:4000/api/notes', {
      headers: { 'Authorization': `Bearer ${token}` }
    })
    if (!res.ok) throw new Error('Notes fetch failed')
    const data = await res.json()
    buildGraph(data.notes || [])
  } catch (err) {
    console.warn('API unavailable, using mock data:', err.message)
    buildGraph(getMockNotes())
  }
}

function buildGraph(rawNotes) {
  if (!rawNotes.length) {
    document.getElementById('graphLoading').classList.add('hidden')
    document.getElementById('graphEmpty').style.display = 'flex'
    return
  }

  nodes = rawNotes.map(note => {
    const words = countWords(note.content || '') + countWords(note.title || '')
    const tag   = note.tag || (Array.isArray(note.tags) && note.tags[0]) || 'Note'
    const color = getTagColor(tag)
    return {
      id: note.id,
      title: note.title || note.content?.slice(0, 40) || 'Untitled',
      tag,
      tags: note.tags || [],
      wordCount: words,
      createdAt: note.createdAt,
      updatedAt: note.updatedAt,
      content: note.content || '',
      color,
      x: W / 2 + (Math.random() - 0.5) * Math.min(W, H) * 0.5,
      y: H / 2 + (Math.random() - 0.5) * Math.min(W, H) * 0.5,
      vx: 0, vy: 0, r: 8,
      pinned: false, opacity: 1,
    }
  })

  edges = []
  const edgeSet = new Set()
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const a = nodes[i]; const b = nodes[j]
      const sharedTags = getSharedTags(a, b)
      if (sharedTags.length > 0) {
        const key = [a.id, b.id].sort().join('|')
        if (!edgeSet.has(key)) {
          edgeSet.add(key)
          edges.push({ source: a.id, target: b.id, sourceNode: a, targetNode: b, weight: sharedTags.length })
        }
      }
    }
  }

  const degreeMap = {}
  nodes.forEach(n => { degreeMap[n.id] = 0 })
  edges.forEach(e => { degreeMap[e.source]++; degreeMap[e.target]++ })
  nodes.forEach(n => { n.degree = degreeMap[n.id] })

  recalcNodeSizes()
  buildTagFilters()
  applyFilter()
  updateStats()

  setTimeout(() => {
    document.getElementById('graphLoading').classList.add('hidden')
    document.getElementById('graphSubtitle').textContent =
      `${nodes.length} notes · ${edges.length} connections`
  }, 600)

  startSimulation()
}

function getSharedTags(a, b) {
  const tagsA = new Set([a.tag, ...a.tags].map(t => t?.toLowerCase()).filter(Boolean))
  const tagsB = [b.tag, ...b.tags].map(t => t?.toLowerCase()).filter(Boolean)
  return tagsB.filter(t => tagsA.has(t))
}

function countWords(str) {
  return str.trim().split(/\s+/).filter(Boolean).length
}

// ══════════════════════════════════════════════════
// NODE SIZES
// ══════════════════════════════════════════════════
function recalcNodeSizes() {
  const now = Date.now()
  const maxDeg   = Math.max(...nodes.map(n => n.degree), 1)
  const maxWords = Math.max(...nodes.map(n => n.wordCount), 1)
  nodes.forEach(n => {
    switch (sizeMode) {
      case 'links':   n.r = 6 + (n.degree / maxDeg) * 14; break
      case 'words':   n.r = 6 + (n.wordCount / maxWords) * 14; break
      case 'recency': {
        const age = (now - new Date(n.updatedAt || n.createdAt)) / (1000 * 60 * 60 * 24)
        n.r = 6 + Math.max(0, 14 - age * 0.5)
        break
      }
      case 'uniform': n.r = 9; break
    }
  })
}

// ══════════════════════════════════════════════════
// FORCE-DIRECTED SIMULATION
// ══════════════════════════════════════════════════
let simRunning  = false
let simSteps    = 0
const MAX_STEPS = 400
const COOLING   = 0.985

function startSimulation() {
  simRunning = true
  simSteps   = 0
  camX = 0; camY = 0; camScale = 1
  requestAnimationFrame(simulationLoop)
}

function simulationLoop() {
  if (!simRunning) return
  tickForces()
  renderFrame()
  updateMinimap()
  simSteps++
  edgePulse += 0.02
  requestAnimationFrame(simulationLoop)
}

function tickForces() {
  const alpha   = Math.max(0.01, 1 - simSteps / MAX_STEPS) * COOLING
  const repulse = clusterMode ? 800 : 450
  const attract = clusterMode ? 0.06 : 0.04
  const center  = 0.012
  const fn = filteredNodes
  const fe = filteredEdges

  for (let i = 0; i < fn.length; i++) {
    for (let j = i + 1; j < fn.length; j++) {
      const a = fn[i]; const b = fn[j]
      let dx = b.x - a.x; let dy = b.y - a.y
      const dist    = Math.sqrt(dx * dx + dy * dy) || 1
      const minDist = (a.r + b.r) * 2.5
      const force   = repulse / (dist * dist)
      const fx = (dx / dist) * force; const fy = (dy / dist) * force
      a.vx -= fx * alpha; a.vy -= fy * alpha
      b.vx += fx * alpha; b.vy += fy * alpha
      if (dist < minDist) {
        const overlap = (minDist - dist) * 0.5
        a.x -= (dx / dist) * overlap; a.y -= (dy / dist) * overlap
        b.x += (dx / dist) * overlap; b.y += (dy / dist) * overlap
      }
    }
  }

  fe.forEach(e => {
    const a = e.sourceNode; const b = e.targetNode
    if (!a || !b) return
    const dx   = b.x - a.x; const dy = b.y - a.y
    const dist = Math.sqrt(dx * dx + dy * dy) || 1
    const ideal  = clusterMode ? 120 : 180
    const spring = (dist - ideal) * attract * (e.weight || 1)
    const fx = (dx / dist) * spring; const fy = (dy / dist) * spring
    if (!a.pinned) { a.vx += fx * alpha; a.vy += fy * alpha }
    if (!b.pinned) { b.vx -= fx * alpha; b.vy -= fy * alpha }
  })

  if (clusterMode) {
    const centroids = {}
    fn.forEach(n => {
      if (!centroids[n.tag]) centroids[n.tag] = { x: 0, y: 0, count: 0 }
      centroids[n.tag].x += n.x; centroids[n.tag].y += n.y; centroids[n.tag].count++
    })
    Object.values(centroids).forEach(c => { c.x /= c.count; c.y /= c.count })
    fn.forEach(n => {
      const c = centroids[n.tag]
      if (!c) return
      n.vx += (c.x - n.x) * 0.035 * alpha
      n.vy += (c.y - n.y) * 0.035 * alpha
    })
  }

  fn.forEach(n => {
    if (n.pinned) return
    n.vx += (W / 2 - n.x) * center * alpha
    n.vy += (H / 2 - n.y) * center * alpha
    n.vx *= 0.82; n.vy *= 0.82
    n.x  += n.vx; n.y  += n.vy
  })
}

// ══════════════════════════════════════════════════
// RENDER
// ══════════════════════════════════════════════════
function renderFrame() {
  ctx.clearRect(0, 0, W, H)
  ctx.save()
  ctx.translate(camX, camY)
  ctx.scale(camScale, camScale)
  drawEdges()
  drawNodes()
  if (showLabels) drawLabels()
  ctx.restore()
}

function drawEdges() {
  const pulse = (Math.sin(edgePulse) + 1) / 2
  filteredEdges.forEach(e => {
    const a = e.sourceNode; const b = e.targetNode
    if (!a || !b) return
    const isRelated   = selectedNode && (e.source === selectedNode.id || e.target === selectedNode.id)
    const isUnrelated = selectedNode && !isRelated
    const alpha = isUnrelated ? 0.04 : isRelated ? 0.85 : 0.18
    const width = isRelated ? 1.5 + e.weight * 0.5 : 0.8
    ctx.beginPath()
    ctx.moveTo(a.x, a.y)
    if (animateEdges && isRelated) {
      const midX = (a.x + b.x) / 2 + (b.y - a.y) * 0.12
      const midY = (a.y + b.y) / 2 - (b.x - a.x) * 0.12
      ctx.quadraticCurveTo(midX, midY, b.x, b.y)
    } else {
      ctx.lineTo(b.x, b.y)
    }
    if (isRelated && animateEdges) {
      ctx.strokeStyle = `rgba(167,139,250,${alpha * (0.7 + pulse * 0.3)})`
      ctx.shadowColor = 'rgba(167,139,250,0.4)'
      ctx.shadowBlur  = 6
    } else {
      ctx.strokeStyle = `rgba(167,139,250,${alpha})`
      ctx.shadowBlur  = 0
    }
    ctx.lineWidth = width
    ctx.stroke()
    ctx.shadowBlur = 0
    if (animateEdges && isRelated) {
      const t  = (edgePulse * 0.3) % 1
      const px = a.x + (b.x - a.x) * t
      const py = a.y + (b.y - a.y) * t
      ctx.beginPath()
      ctx.arc(px, py, 2.5, 0, Math.PI * 2)
      ctx.fillStyle   = `rgba(167,139,250,${0.8 * alpha})`
      ctx.shadowColor = 'rgba(167,139,250,0.8)'
      ctx.shadowBlur  = 8
      ctx.fill()
      ctx.shadowBlur  = 0
    }
  })
}

function drawNodes() {
  filteredNodes.forEach(n => {
    const isSelected = selectedNode && selectedNode.id === n.id
    const isHovered  = hoveredNode  && hoveredNode.id  === n.id
    const isRelated  = selectedNode && !isSelected && filteredEdges.some(
      e => (e.source === selectedNode.id && e.target === n.id) ||
           (e.target === selectedNode.id && e.source === n.id)
    )
    const isFaded = selectedNode && !isSelected && !isRelated
    const r     = isSelected ? n.r * 1.35 : isHovered ? n.r * 1.2 : n.r
    const alpha = isFaded ? 0.18 : n.opacity

    if (isSelected || isHovered) {
      ctx.beginPath()
      ctx.arc(n.x, n.y, r + 10, 0, Math.PI * 2)
      const glowAlpha = isSelected ? 0.25 : 0.12
      const grd = ctx.createRadialGradient(n.x, n.y, r, n.x, n.y, r + 10)
      grd.addColorStop(0, n.color.replace(')', `,${glowAlpha})`).replace('rgb', 'rgba'))
      grd.addColorStop(1, 'transparent')
      ctx.fillStyle = grd
      ctx.fill()
      ctx.beginPath()
      ctx.arc(n.x, n.y, r + 5, 0, Math.PI * 2)
      ctx.strokeStyle = isSelected ? 'rgba(167,139,250,0.5)' : 'rgba(167,139,250,0.25)'
      ctx.lineWidth = 1
      ctx.stroke()
    }

    ctx.beginPath()
    ctx.arc(n.x, n.y, r, 0, Math.PI * 2)
    const grd = ctx.createRadialGradient(n.x - r * 0.3, n.y - r * 0.3, 0, n.x, n.y, r)
    grd.addColorStop(0, hexAlpha(n.color, alpha * 0.95))
    grd.addColorStop(1, hexAlpha(n.color, alpha * 0.55))
    ctx.fillStyle = grd
    ctx.fill()
    ctx.strokeStyle = isSelected ? `rgba(255,255,255,${alpha * 0.7})` : `rgba(255,255,255,${alpha * 0.2})`
    ctx.lineWidth   = isSelected ? 1.5 : 0.8
    ctx.stroke()

    if (n.degree >= 3) {
      ctx.beginPath()
      ctx.arc(n.x, n.y, 2, 0, Math.PI * 2)
      ctx.fillStyle = `rgba(255,255,255,${alpha * 0.7})`
      ctx.fill()
    }
  })
}

function drawLabels() {
  ctx.textAlign    = 'center'
  ctx.textBaseline = 'top'
  filteredNodes.forEach(n => {
    const isSelected = selectedNode && selectedNode.id === n.id
    const isRelated  = selectedNode && filteredEdges.some(
      e => (e.source === selectedNode.id && e.target === n.id) ||
           (e.target === selectedNode.id && e.source === n.id)
    )
    const isFaded = selectedNode && !isSelected && !isRelated
    if (camScale < 0.55 && !isSelected && !isRelated) return
    const alpha    = isFaded ? 0.12 : (isSelected ? 1 : 0.7)
    const maxChars = isSelected ? 28 : 16
    const label    = n.title.length > maxChars ? n.title.slice(0, maxChars) + '…' : n.title
    ctx.font = isSelected
      ? `400 ${Math.max(9, n.r * 0.85)}px 'DM Sans', sans-serif`
      : `300 ${Math.max(8, n.r * 0.7)}px 'DM Sans', sans-serif`
    ctx.shadowColor = 'rgba(5,5,13,0.9)'
    ctx.shadowBlur  = 4
    ctx.fillStyle   = `rgba(255,255,255,${alpha})`
    ctx.fillText(label, n.x, n.y + n.r + 5)
    ctx.shadowBlur  = 0
  })
}

// ══════════════════════════════════════════════════
// MINIMAP
// ══════════════════════════════════════════════════
const mmCanvas = document.getElementById('minimap')
const mmCtx    = mmCanvas.getContext('2d')

function updateMinimap() {
  if (!filteredNodes.length) return
  const mW = mmCanvas.width; const mH = mmCanvas.height
  mmCtx.clearRect(0, 0, mW, mH)
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
  filteredNodes.forEach(n => {
    minX = Math.min(minX, n.x); maxX = Math.max(maxX, n.x)
    minY = Math.min(minY, n.y); maxY = Math.max(maxY, n.y)
  })
  const gW  = maxX - minX || 1; const gH = maxY - minY || 1
  const sc  = Math.min((mW - 10) / gW, (mH - 10) / gH) * 0.85
  const offX = (mW - gW * sc) / 2 - minX * sc
  const offY = (mH - gH * sc) / 2 - minY * sc
  filteredEdges.forEach(e => {
    const a = e.sourceNode; const b = e.targetNode
    if (!a || !b) return
    mmCtx.beginPath()
    mmCtx.moveTo(a.x * sc + offX, a.y * sc + offY)
    mmCtx.lineTo(b.x * sc + offX, b.y * sc + offY)
    mmCtx.strokeStyle = 'rgba(167,139,250,0.12)'
    mmCtx.lineWidth   = 0.5
    mmCtx.stroke()
  })
  filteredNodes.forEach(n => {
    const mx = n.x * sc + offX; const my = n.y * sc + offY
    mmCtx.beginPath()
    mmCtx.arc(mx, my, Math.max(1.2, n.r * sc * 0.6), 0, Math.PI * 2)
    mmCtx.fillStyle = n === selectedNode ? 'rgba(255,255,255,0.9)' : hexAlpha(n.color, 0.7)
    mmCtx.fill()
  })
  const vp  = document.getElementById('minimapViewport')
  const vpW = (W / camScale) * sc; const vpH = (H / camScale) * sc
  const vpX = (-camX / camScale) * sc + offX
  const vpY = (-camY / camScale) * sc + offY
  vp.style.left = vpX + 'px'; vp.style.top    = vpY + 'px'
  vp.style.width = vpW + 'px'; vp.style.height = vpH + 'px'
}

// ══════════════════════════════════════════════════
// FILTERS & TAGS
// ══════════════════════════════════════════════════
function buildTagFilters() {
  const tags = [...new Set(nodes.map(n => n.tag).filter(Boolean))]
  const container = document.getElementById('tagFilters')
  container.innerHTML = ''
  tags.forEach(tag => {
    const color = getTagColor(tag)
    const chip  = document.createElement('button')
    chip.className   = 'tag-filter-chip'
    chip.dataset.tag = tag
    chip.innerHTML   = `<span class="chip-dot" style="background:${color}"></span>${tag}`
    chip.addEventListener('click', () => {
      if (activeTagFilter === tag) {
        activeTagFilter = null
        chip.classList.remove('active')
        chip.style.borderColor = ''
        chip.style.color = ''
      } else {
        activeTagFilter = tag
        container.querySelectorAll('.tag-filter-chip').forEach(c => {
          c.classList.remove('active'); c.style.borderColor = ''; c.style.color = ''
        })
        chip.classList.add('active')
        chip.style.borderColor = color
        chip.style.color = color
      }
      applyFilter()
    })
    container.appendChild(chip)
  })
}

function applyFilter() {
  let fn = [...nodes]
  if (activeTagFilter) {
    const related = new Set()
    fn.forEach(n => { if (n.tag === activeTagFilter) related.add(n.id) })
    edges.forEach(e => {
      if (related.has(e.source)) related.add(e.target)
      if (related.has(e.target)) related.add(e.source)
    })
    fn = fn.map(n => { n.opacity = related.has(n.id) ? 1 : 0.12; return n })
  } else {
    fn.forEach(n => { n.opacity = 1 })
  }
  switch (activeFilter) {
    case 'orphans': filteredNodes = nodes.filter(n => n.degree === 0); break
    case 'recent': {
      const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000
      filteredNodes = nodes.filter(n => new Date(n.updatedAt || n.createdAt) >= cutoff)
      break
    }
    case 'hubs':    filteredNodes = nodes.filter(n => n.degree >= 3); break
    default:        filteredNodes = fn
  }
  const visibleIds = new Set(filteredNodes.map(n => n.id))
  filteredEdges = edges.filter(e => visibleIds.has(e.source) && visibleIds.has(e.target))
  updateStats()
}

// ══════════════════════════════════════════════════
// STATS
// ══════════════════════════════════════════════════
function updateStats() {
  const orphans  = nodes.filter(n => n.degree === 0).length
  const tags     = new Set(nodes.map(n => n.tag)).size
  const avgLinks = nodes.length ? (edges.length * 2 / nodes.length).toFixed(1) : '0'
  setEl('statNodes',    filteredNodes.length)
  setEl('statEdges',    filteredEdges.length)
  setEl('statClusters', tags)
  setEl('statOrphans',  orphans)
  setEl('statAvgLinks', avgLinks)
}
function setEl(id, val) { const el = document.getElementById(id); if (el) el.textContent = val }

// ══════════════════════════════════════════════════
// MOUSE / TOUCH INTERACTION
// ══════════════════════════════════════════════════
function getMousePos(e) {
  const rect = canvas.getBoundingClientRect()
  return { x: e.clientX - rect.left, y: e.clientY - rect.top }
}
function screenToWorld(sx, sy) {
  return { x: (sx - camX) / camScale, y: (sy - camY) / camScale }
}
function getNodeAt(sx, sy) {
  const { x, y } = screenToWorld(sx, sy)
  for (let i = filteredNodes.length - 1; i >= 0; i--) {
    const n = filteredNodes[i]
    const dx = x - n.x; const dy = y - n.y
    if (dx * dx + dy * dy <= (n.r + 4) * (n.r + 4)) return n
  }
  return null
}

const tooltip = document.getElementById('nodeTooltip')
function showTooltip(n, sx, sy) {
  tooltip.innerHTML = `<div class="tooltip-title">${n.title}</div><div class="tooltip-meta">${n.tag} · ${n.wordCount}w · ${n.degree} links</div>`
  tooltip.style.left = (sx + 14) + 'px'
  tooltip.style.top  = (sy - 10) + 'px'
  tooltip.classList.add('visible')
}
function hideTooltip() { tooltip.classList.remove('visible') }

canvas.addEventListener('mousemove', e => {
  const pos  = getMousePos(e)
  const node = getNodeAt(pos.x, pos.y)
  if (isPanning) {
    camX += pos.x - lastMouse.x
    camY += pos.y - lastMouse.y
    lastMouse = pos
    return
  }
  if (draggingNode) {
    const world = screenToWorld(pos.x, pos.y)
    draggingNode.x = world.x; draggingNode.y = world.y
    draggingNode.vx = 0; draggingNode.vy = 0
    draggingNode.pinned = true
    return
  }
  if (node !== hoveredNode) {
    hoveredNode = node
    canvas.style.cursor = node ? 'pointer' : 'grab'
    if (node) showTooltip(node, pos.x, pos.y)
    else hideTooltip()
  } else if (node) {
    tooltip.style.left = (pos.x + 14) + 'px'
    tooltip.style.top  = (pos.y - 10) + 'px'
  }
})

canvas.addEventListener('mousedown', e => {
  const pos  = getMousePos(e)
  const node = getNodeAt(pos.x, pos.y)
  lastMouse = pos; dragStart = pos
  if (node) { draggingNode = node }
  else { isPanning = true; canvas.style.cursor = 'grabbing' }
})

canvas.addEventListener('mouseup', e => {
  const pos   = getMousePos(e)
  const dx    = pos.x - dragStart.x; const dy = pos.y - dragStart.y
  const moved = Math.sqrt(dx * dx + dy * dy) > 4
  if (draggingNode && !moved) selectNode(draggingNode)
  if (draggingNode) { draggingNode.pinned = false; draggingNode = null }
  isPanning = false
  canvas.style.cursor = hoveredNode ? 'pointer' : 'grab'
})

canvas.addEventListener('mouseleave', () => {
  isPanning = false; draggingNode = null; hoveredNode = null; hideTooltip()
})

canvas.addEventListener('wheel', e => {
  e.preventDefault()
  const pos      = getMousePos(e)
  const delta    = e.deltaY > 0 ? 0.9 : 1.1
  const newScale = Math.max(0.15, Math.min(4, camScale * delta))
  camX = pos.x - (pos.x - camX) * (newScale / camScale)
  camY = pos.y - (pos.y - camY) * (newScale / camScale)
  camScale = newScale
}, { passive: false })

let lastTouchDist = 0
canvas.addEventListener('touchstart', e => {
  if (e.touches.length === 1) {
    const t   = e.touches[0]
    const pos = { x: t.clientX, y: t.clientY }
    const node = getNodeAt(pos.x, pos.y)
    lastMouse = pos; dragStart = pos
    if (node) draggingNode = node
    else isPanning = true
  } else if (e.touches.length === 2) {
    const dx = e.touches[0].clientX - e.touches[1].clientX
    const dy = e.touches[0].clientY - e.touches[1].clientY
    lastTouchDist = Math.sqrt(dx * dx + dy * dy)
    isPanning = false; draggingNode = null
  }
}, { passive: true })

canvas.addEventListener('touchmove', e => {
  e.preventDefault()
  if (e.touches.length === 1) {
    const t   = e.touches[0]
    const pos = { x: t.clientX, y: t.clientY }
    if (isPanning) { camX += pos.x - lastMouse.x; camY += pos.y - lastMouse.y }
    else if (draggingNode) {
      const world = screenToWorld(pos.x, pos.y)
      draggingNode.x = world.x; draggingNode.y = world.y
    }
    lastMouse = pos
  } else if (e.touches.length === 2) {
    const dx   = e.touches[0].clientX - e.touches[1].clientX
    const dy   = e.touches[0].clientY - e.touches[1].clientY
    const dist = Math.sqrt(dx * dx + dy * dy)
    camScale = Math.max(0.15, Math.min(4, camScale * (dist / lastTouchDist)))
    lastTouchDist = dist
  }
}, { passive: false })

canvas.addEventListener('touchend', e => {
  if (e.changedTouches.length === 1 && draggingNode) {
    const t  = e.changedTouches[0]
    const dx = t.clientX - dragStart.x; const dy = t.clientY - dragStart.y
    if (Math.sqrt(dx * dx + dy * dy) < 8) selectNode(draggingNode)
  }
  draggingNode = null; isPanning = false
})

// ══════════════════════════════════════════════════
// NODE SELECTION & CONTEXT PANEL
// ══════════════════════════════════════════════════
function selectNode(node) { selectedNode = node; openContextPanel(node) }
function deselectNode()   { selectedNode = null; closeContextPanel() }

function openContextPanel(node) {
  document.getElementById('contextPanel').classList.add('open')
  document.getElementById('cpTitle').textContent  = node.title
  document.getElementById('cpEmpty').style.display   = 'none'
  document.getElementById('cpContent').style.display = 'flex'

  const allTags = [node.tag, ...node.tags].filter(Boolean)
  document.getElementById('cpTagRow').innerHTML = allTags.map(t =>
    `<span class="cp-tag" style="background:${hexAlpha(getTagColor(t),0.15)};color:${getTagColor(t)};border-color:${hexAlpha(getTagColor(t),0.25)}">${t}</span>`
  ).join('')

  document.getElementById('cpCreated').textContent = fmtDate(node.createdAt)
  document.getElementById('cpEdited').textContent  = fmtDate(node.updatedAt || node.createdAt)
  document.getElementById('cpWords').textContent   = node.wordCount
  document.getElementById('cpConns').textContent   = node.degree

  const preview = node.content?.slice(0, 240) || 'No content.'
  document.getElementById('cpPreview').textContent = preview + (node.content?.length > 240 ? '…' : '')

  const conns = filteredEdges
    .filter(e => e.source === node.id || e.target === node.id)
    .map(e => e.source === node.id ? e.targetNode : e.sourceNode)
    .filter(Boolean)

  document.getElementById('cpConnCount').textContent = conns.length
  const connList = document.getElementById('cpConnections')
  connList.innerHTML = ''
  conns.slice(0, 8).forEach(cn => {
    const item = document.createElement('div')
    item.className = 'cp-conn-item'
    item.innerHTML = `<span class="cp-conn-dot" style="background:${cn.color}"></span><span class="cp-conn-name">${cn.title}</span><span class="cp-conn-links">${cn.degree}↔</span>`
    item.addEventListener('click', () => { selectNode(cn); focusNode(cn) })
    connList.appendChild(item)
  })
  if (conns.length > 8) {
    connList.innerHTML += `<div style="font-size:.65rem;color:var(--lo);padding:.3rem .55rem">+${conns.length - 8} more</div>`
  }
  buildInsights(node, conns)
}

function buildInsights(node, conns) {
  const container = document.getElementById('cpInsights')
  container.innerHTML = ''
  const insights = []
  const daysSinceEdit = Math.floor((Date.now() - new Date(node.updatedAt || node.createdAt)) / 86400000)
  if (daysSinceEdit > 14) insights.push({ type: 'warning', icon: '⏰', text: `You haven't edited this note in ${daysSinceEdit} days.` })
  if (node.degree >= 5)   insights.push({ type: 'success', icon: '🌐', text: `This is a hub note — connected to ${node.degree} other ideas.` })
  else if (node.degree === 0) insights.push({ type: 'warning', icon: '🔗', text: 'Orphan note — not connected to any others. Consider linking it.' })
  if (conns.length > 0) {
    const connTags = new Set(conns.map(c => c.tag))
    if (connTags.size >= 3) insights.push({ type: 'info', icon: '🧠', text: `Bridges ${connTags.size} topic clusters — a key conceptual connector.` })
  }
  if (node.wordCount > 300) insights.push({ type: 'info', icon: '📄', text: `Dense note with ${node.wordCount} words — consider splitting into atomic notes.` })
  if (insights.length === 0) insights.push({ type: 'info', icon: '✨', text: 'Keep writing and linking to unlock deeper insights.' })
  insights.forEach(i => {
    const el = document.createElement('div')
    el.className = `cp-insight ${i.type}`
    el.innerHTML = `<span class="cp-insight-icon">${i.icon}</span><span>${i.text}</span>`
    container.appendChild(el)
  })
}

function closeContextPanel() {
  document.getElementById('contextPanel').classList.remove('open')
  document.getElementById('cpEmpty').style.display   = 'flex'
  document.getElementById('cpContent').style.display = 'none'
}

function focusNode(node) {
  animateCam(W / 2 - node.x * camScale, H / 2 - node.y * camScale, Math.min(2, Math.max(0.8, camScale)), 400)
}

function animateCam(tx, ty, ts, dur) {
  const sx = camX; const sy = camY; const ss = camScale
  const start = performance.now()
  function step(now) {
    const p = Math.min((now - start) / dur, 1)
    const e = 1 - Math.pow(2, -10 * p)
    camX = sx + (tx - sx) * e; camY = sy + (ty - sy) * e; camScale = ss + (ts - ss) * e
    if (p < 1) requestAnimationFrame(step)
  }
  requestAnimationFrame(step)
}

// ══════════════════════════════════════════════════
// SEARCH
// ══════════════════════════════════════════════════
const searchInput   = document.getElementById('nodeSearch')
const searchResults = document.getElementById('searchResults')
const searchClear   = document.getElementById('searchClear')

searchInput.addEventListener('input', () => {
  const q = searchInput.value.trim().toLowerCase()
  searchClear.classList.toggle('visible', q.length > 0)
  searchResults.innerHTML = ''
  if (!q) { nodes.forEach(n => { n.opacity = 1 }); return }
  const matches = nodes.filter(n => n.title.toLowerCase().includes(q) || n.tag.toLowerCase().includes(q))
  nodes.forEach(n => { n.opacity = matches.includes(n) ? 1 : 0.1 })
  matches.slice(0, 8).forEach(n => {
    const item = document.createElement('div')
    item.className = 'search-result-item'
    const idx = n.title.toLowerCase().indexOf(q)
    if (idx >= 0) {
      item.innerHTML = n.title.slice(0, idx) + `<em>${n.title.slice(idx, idx + q.length)}</em>` + n.title.slice(idx + q.length)
    } else {
      item.textContent = n.title
    }
    item.addEventListener('click', () => {
      selectNode(n); focusNode(n)
      nodes.forEach(nd => { nd.opacity = 1 })
      searchInput.value = ''; searchResults.innerHTML = ''
      searchClear.classList.remove('visible')
    })
    searchResults.appendChild(item)
  })
})

searchClear.addEventListener('click', () => {
  searchInput.value = ''; searchResults.innerHTML = ''
  searchClear.classList.remove('visible')
  nodes.forEach(n => { n.opacity = 1 })
})

// ══════════════════════════════════════════════════
// CONTROL WIRING
// ══════════════════════════════════════════════════
document.getElementById('filterPills').addEventListener('click', e => {
  const btn = e.target.closest('.gcp-pill')
  if (!btn) return
  document.querySelectorAll('#filterPills .gcp-pill').forEach(b => b.classList.remove('active'))
  btn.classList.add('active')
  activeFilter = btn.dataset.filter
  applyFilter()
})

document.getElementById('toggleLabels').addEventListener('change',   e => { showLabels   = e.target.checked })
document.getElementById('toggleEdgeAnim').addEventListener('change', e => { animateEdges = e.target.checked })
document.getElementById('toggleCluster').addEventListener('change',  e => { clusterMode  = e.target.checked; simSteps = 0 })

document.getElementById('sizeModeGroup').addEventListener('click', e => {
  const btn = e.target.closest('.gcp-pill')
  if (!btn) return
  document.querySelectorAll('#sizeModeGroup .gcp-pill').forEach(b => b.classList.remove('active'))
  btn.classList.add('active')
  sizeMode = btn.dataset.mode
  recalcNodeSizes()
})

document.getElementById('zoomIn').addEventListener('click', () => {
  const sc = Math.min(4, camScale * 1.3)
  animateCam(camX + (W / 2 - camX) * (1 - sc / camScale), camY + (H / 2 - camY) * (1 - sc / camScale), sc, 250)
})
document.getElementById('zoomOut').addEventListener('click', () => {
  const sc = Math.max(0.15, camScale * 0.77)
  animateCam(camX + (W / 2 - camX) * (1 - sc / camScale), camY + (H / 2 - camY) * (1 - sc / camScale), sc, 250)
})
document.getElementById('zoomFit').addEventListener('click', fitGraph)

function fitGraph() {
  if (!filteredNodes.length) return
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
  filteredNodes.forEach(n => {
    minX = Math.min(minX, n.x - n.r); maxX = Math.max(maxX, n.x + n.r)
    minY = Math.min(minY, n.y - n.r); maxY = Math.max(maxY, n.y + n.r)
  })
  const pad = 60
  const sc  = Math.min((W - pad * 2) / (maxX - minX || 1), (H - pad * 2) / (maxY - minY || 1))
  const ts  = Math.max(0.15, Math.min(2.5, sc))
  animateCam(W / 2 - ((minX + maxX) / 2) * ts, H / 2 - ((minY + maxY) / 2) * ts, ts, 500)
}

document.getElementById('refreshBtn').addEventListener('click', () => {
  nodes.forEach(n => { n.pinned = false; n.vx = (Math.random() - 0.5) * 3; n.vy = (Math.random() - 0.5) * 3 })
  simSteps = 0
})

document.getElementById('cpClose').addEventListener('click', deselectNode)
document.getElementById('cpFocusNode').addEventListener('click', () => { if (selectedNode) focusNode(selectedNode) })
document.getElementById('cpOpenNote').addEventListener('click', () => {
  if (selectedNode) window.location.href = `../notes/notes.html?id=${selectedNode.id}`
})

canvas.addEventListener('click', e => {
  const pos   = getMousePos(e)
  const dx    = pos.x - dragStart.x; const dy = pos.y - dragStart.y
  const moved = Math.sqrt(dx * dx + dy * dy) > 4
  if (!moved && !getNodeAt(pos.x, pos.y)) deselectNode()
})

// ══════════════════════════════════════════════════
// UTILITIES
// ══════════════════════════════════════════════════
function hexAlpha(hex, alpha) {
  if (hex.startsWith('rgba') || hex.startsWith('rgb')) return hex.replace(/[\d.]+\)$/, `${alpha})`)
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r},${g},${b},${alpha})`
}
function fmtDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

// ══════════════════════════════════════════════════
// MOCK DATA
// ══════════════════════════════════════════════════
function getMockNotes() {
  const tags   = ['Ideas', 'Research', 'Project', 'Design', 'Learning', 'Personal']
  const titles = [
    'Second Brain Architecture', 'Zettelkasten Method', 'Graph-based Retrieval',
    'TypeScript Deep Dive', 'Product Design Principles', 'Machine Learning Notes',
    'Atomic Note-taking', 'Knowledge Management', 'API Design Patterns',
    'React Performance', 'Focus Techniques', 'Daily Journaling Habit',
    'Cognitive Load Theory', 'Spaced Repetition', 'Mental Models',
    'Writing Clarity', 'Network Effects', 'Decision Making Frameworks',
    'Flow State Research', 'Personal Knowledge Base'
  ]
  return titles.map((title, i) => ({
    id:        `mock-${i}`,
    title,
    content:   `Notes about ${title}. This is a sample note for the knowledge graph visualization.`.repeat(Math.ceil(Math.random() * 3)),
    tag:       tags[i % tags.length],
    tags:      [tags[i % tags.length], tags[(i + 2) % tags.length]],
    wordCount: Math.floor(Math.random() * 400 + 50),
    createdAt: new Date(Date.now() - Math.random() * 60 * 86400000).toISOString(),
    updatedAt: new Date(Date.now() - Math.random() * 14 * 86400000).toISOString(),
  }))
}

// ══════════════════════════════════════════════════
// BOOT
// ══════════════════════════════════════════════════
window._graphSetFilter = function(filter) { activeFilter = filter; applyFilter() }
window.addEventListener('resize', resizeCanvas)
initParticles()
tickParticles()
resizeCanvas()
loadGraph()