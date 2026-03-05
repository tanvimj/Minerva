// routes/analytics.js
const express    = require('express')
const prisma     = require('../lib/prisma')
const requireAuth = require('../middleware/auth')

const router = express.Router()
router.use(requireAuth)

// ── helpers ──────────────────────────────────────
function wordCount(str) {
  if (!str) return 0
  return str.trim().split(/\s+/).filter(Boolean).length
}

function startOfDay(date) {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d
}

function daysBetween(a, b) {
  return Math.floor((startOfDay(b) - startOfDay(a)) / 86400000)
}

// ── GET /api/analytics ───────────────────────────
router.get('/', async (req, res) => {
  try {
    const userId = req.user.userId

    // Fetch all notes for this user — we do all aggregation in JS
    // to avoid raw SQL and stay Prisma-idiomatic
    const notes = await prisma.note.findMany({
      where: { userId },
      select: {
        id:        true,
        title:     true,
        content:   true,
        tag:       true,
        tags:      true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: 'asc' }
    })

    const goals = await prisma.goal.findMany({
      where: { userId },
      select: { status: true }
    })

    const now      = new Date()
    const total    = notes.length

    // ── Total words ──────────────────────────────
    const totalWords = notes.reduce((sum, n) =>
      sum + wordCount(n.title) + wordCount(n.content), 0)

    // ── Active goals ─────────────────────────────
    const activeGoals = goals.filter(g => g.status === 'active').length

    // ── Notes this week ──────────────────────────
    const weekAgo = new Date(now)
    weekAgo.setDate(now.getDate() - 7)
    const notesThisWeek = notes.filter(n => new Date(n.createdAt) >= weekAgo).length

    // ── Notes last week (for % delta) ────────────
    const twoWeeksAgo = new Date(now)
    twoWeeksAgo.setDate(now.getDate() - 14)
    const notesLastWeek = notes.filter(n => {
      const d = new Date(n.createdAt)
      return d >= twoWeeksAgo && d < weekAgo
    }).length

    // ── Streak ───────────────────────────────────
    // Build a set of unique active days (by createdAt)
    const activeDaySet = new Set(
      notes.map(n => startOfDay(new Date(n.createdAt)).toDateString())
    )
    let streak = 0
    const cursor = new Date(now)
    // Allow today to not have a note yet without breaking streak
    if (!activeDaySet.has(startOfDay(cursor).toDateString())) {
      cursor.setDate(cursor.getDate() - 1)
    }
    while (activeDaySet.has(startOfDay(cursor).toDateString())) {
      streak++
      cursor.setDate(cursor.getDate() - 1)
    }

    // ── Most active tag ───────────────────────────
    const tagCounts = {}
    notes.forEach(n => {
      const t = n.tag || 'Note'
      tagCounts[t] = (tagCounts[t] || 0) + 1
      // also count from tags[] array
      if (Array.isArray(n.tags)) {
        n.tags.forEach(tag => {
          tagCounts[tag] = (tagCounts[tag] || 0) + 1
        })
      }
    })
    const mostActiveTag = Object.entries(tagCounts)
      .sort((a, b) => b[1] - a[1])[0] || ['Note', 0]

    // ── Tag distribution (top 8) ──────────────────
    const tagDistribution = Object.entries(tagCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([label, count]) => ({ label: `#${label.toLowerCase()}`, count }))

    // ── Productivity over time ────────────────────
    // Returns arrays for 7d, 30d, 90d
    function buildTimeSeries(days) {
      const result = { notes: [], words: [], labels: [] }
      for (let i = days - 1; i >= 0; i--) {
        const day = new Date(now)
        day.setDate(now.getDate() - i)
        const dayStr = startOfDay(day).toDateString()

        const dayNotes = notes.filter(n =>
          startOfDay(new Date(n.createdAt)).toDateString() === dayStr
        )
        result.notes.push(dayNotes.length)
        result.words.push(
          dayNotes.reduce((s, n) => s + wordCount(n.title) + wordCount(n.content), 0)
        )
        result.labels.push(
          day.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
        )
      }
      return result
    }

    const productivity7  = buildTimeSeries(7)
    const productivity30 = buildTimeSeries(30)
    const productivity90 = buildTimeSeries(90)

    // ── Activity heatmap (last 20 weeks = 140 days) ──
    const heatmapDays = 140
    const heatmap = []
    for (let i = heatmapDays - 1; i >= 0; i--) {
      const day = new Date(now)
      day.setDate(now.getDate() - i)
      const dayStr = startOfDay(day).toDateString()
      const count  = notes.filter(n =>
        startOfDay(new Date(n.createdAt)).toDateString() === dayStr
      ).length
      // Map count → level 0–4
      const level = count === 0 ? 0
                  : count === 1 ? 1
                  : count <= 3  ? 2
                  : count <= 6  ? 3
                  : 4
      heatmap.push({
        date:  day.toISOString().split('T')[0],
        count,
        level
      })
    }

    // ── Writing hours histogram ───────────────────
    // Count notes created per hour of day (0–23)
    const hourCounts = new Array(24).fill(0)
    notes.forEach(n => {
      const h = new Date(n.createdAt).getHours()
      hourCounts[h]++
    })
    // Normalize to 0–4 intensity
    const maxHour = Math.max(...hourCounts, 1)
    const writingHours = hourCounts.map(c =>
      c === 0 ? 0 : Math.ceil((c / maxHour) * 4)
    )

    // Peak writing hour range
    const peakHour = hourCounts.indexOf(Math.max(...hourCounts))
    const peakLabel = `${peakHour % 12 || 12}${peakHour < 12 ? 'am' : 'pm'}–${(peakHour + 2) % 12 || 12}${(peakHour + 2) < 12 ? 'am' : 'pm'}`

    // ── Week-over-week deltas ─────────────────────
    const wordsThisWeek = notes
      .filter(n => new Date(n.createdAt) >= weekAgo)
      .reduce((s, n) => s + wordCount(n.title) + wordCount(n.content), 0)

    const wordsLastWeek = notes
      .filter(n => {
        const d = new Date(n.createdAt)
        return d >= twoWeeksAgo && d < weekAgo
      })
      .reduce((s, n) => s + wordCount(n.title) + wordCount(n.content), 0)

    const notesWoWDelta  = notesLastWeek  > 0
      ? Math.round(((notesThisWeek  - notesLastWeek)  / notesLastWeek)  * 100)
      : notesThisWeek > 0 ? 100 : 0

    const wordsWoWDelta  = wordsLastWeek  > 0
      ? Math.round(((wordsThisWeek  - wordsLastWeek)  / wordsLastWeek)  * 100)
      : wordsThisWeek > 0 ? 100 : 0

    // ── Response ──────────────────────────────────
    res.json({
      overview: {
        totalNotes:     total,
        totalWords,
        notesThisWeek,
        activeGoals,
        streak,
        mostActiveTag:  mostActiveTag[0],
        mostActiveTagCount: mostActiveTag[1],
        notesWoWDelta,
        wordsWoWDelta,
      },
      productivity7,
      productivity30,
      productivity90,
      tagDistribution,
      heatmap,
      writingHours,
      peakWritingHour: peakLabel,
    })

  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Analytics query failed.' })
  }
})

module.exports = router