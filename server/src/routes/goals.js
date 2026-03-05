const express = require('express')
const prisma = require('../lib/prisma')
const requireAuth = require('../middleware/auth')

const router = express.Router()

router.use(requireAuth)

// GET /api/goals
router.get('/', async (req, res) => {
  try {
    const goals = await prisma.goal.findMany({
      where: { userId: req.user.userId },
      orderBy: { updatedAt: 'desc' }
    })
    res.json({ goals })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Something went wrong.' })
  }
})

// POST /api/goals
router.post('/', async (req, res) => {
  const { name, desc, category, status, progress, due, milestones } = req.body
  if (!name || !name.trim()) return res.status(400).json({ error: 'Name is required.' })

  try {
    const goal = await prisma.goal.create({
      data: {
        name:       name.trim(),
        desc:       desc       || '',
        category:   category   || 'work',
        status:     status     || 'active',
        progress:   progress   || 0,
        due:        due        || null,
        milestones: milestones || [],
        userId:     req.user.userId
      }
    })
    res.status(201).json({ goal })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Something went wrong.' })
  }
})

// PUT /api/goals/:id
router.put('/:id', async (req, res) => {
  const { name, desc, category, status, progress, due, milestones } = req.body
  try {
    const existing = await prisma.goal.findUnique({ where: { id: req.params.id } })
    if (!existing) return res.status(404).json({ error: 'Goal not found.' })
    if (existing.userId !== req.user.userId) return res.status(403).json({ error: 'Not allowed.' })

    const goal = await prisma.goal.update({
      where: { id: req.params.id },
      data: {
        name:       name       !== undefined ? name.trim() : existing.name,
        desc:       desc       !== undefined ? desc        : existing.desc,
        category:   category   !== undefined ? category    : existing.category,
        status:     status     !== undefined ? status      : existing.status,
        progress:   progress   !== undefined ? progress    : existing.progress,
        due:        due        !== undefined ? due         : existing.due,
        milestones: milestones !== undefined ? milestones  : existing.milestones,
      }
    })
    res.json({ goal })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Something went wrong.' })
  }
})

// DELETE /api/goals/:id
router.delete('/:id', async (req, res) => {
  try {
    const goal = await prisma.goal.findUnique({ where: { id: req.params.id } })
    if (!goal) return res.status(404).json({ error: 'Goal not found.' })
    if (goal.userId !== req.user.userId) return res.status(403).json({ error: 'Not allowed.' })

    await prisma.goal.delete({ where: { id: req.params.id } })
    res.json({ success: true })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Something went wrong.' })
  }
})

module.exports = router