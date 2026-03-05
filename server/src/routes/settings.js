const express = require('express')
const bcrypt = require('bcryptjs')
const prisma = require('../lib/prisma')
const requireAuth = require('../middleware/auth')

const router = express.Router()
router.use(requireAuth)

// GET /api/settings — fetch current user's settings
router.get('/', async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.userId },
      select: { id:true, name:true, email:true, bio:true, timezone:true, language:true, theme:true, accent:true, createdAt:true }
    })
    if (!user) return res.status(404).json({ error: 'User not found.' })
    res.json({ user })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Something went wrong.' })
  }
})

// PUT /api/settings/profile — update name, bio, timezone, language
router.put('/profile', async (req, res) => {
  const { name, bio, timezone, language } = req.body
  if (!name || !name.trim()) return res.status(400).json({ error: 'Name is required.' })

  try {
    const user = await prisma.user.update({
      where: { id: req.user.userId },
      data: {
        name:     name.trim(),
        bio:      bio      !== undefined ? bio.trim()      : undefined,
        timezone: timezone !== undefined ? timezone        : undefined,
        language: language !== undefined ? language        : undefined,
      },
      select: { id:true, name:true, email:true, bio:true, timezone:true, language:true, theme:true, accent:true }
    })
    res.json({ user })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Something went wrong.' })
  }
})

// PUT /api/settings/account — update email and/or password
router.put('/account', async (req, res) => {
  const { email, currentPassword, newPassword } = req.body

  try {
    const existing = await prisma.user.findUnique({ where: { id: req.user.userId } })
    if (!existing) return res.status(404).json({ error: 'User not found.' })

    const updateData = {}

    // Update email
    if (email && email.trim() !== existing.email) {
      const taken = await prisma.user.findUnique({ where: { email: email.trim() } })
      if (taken) return res.status(400).json({ error: 'Email already in use.' })
      updateData.email = email.trim()
    }

    // Update password
    if (newPassword) {
      if (!currentPassword) return res.status(400).json({ error: 'Current password is required.' })
      const valid = await bcrypt.compare(currentPassword, existing.password)
      if (!valid) return res.status(400).json({ error: 'Current password is incorrect.' })
      if (newPassword.length < 8) return res.status(400).json({ error: 'New password must be at least 8 characters.' })
      updateData.password = await bcrypt.hash(newPassword, 12)
    }

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ error: 'Nothing to update.' })
    }

    const user = await prisma.user.update({
      where: { id: req.user.userId },
      data: updateData,
      select: { id:true, name:true, email:true, bio:true, timezone:true, language:true, theme:true, accent:true }
    })

    res.json({ user })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Something went wrong.' })
  }
})

// PUT /api/settings/appearance — save theme and accent
router.put('/appearance', async (req, res) => {
  const { theme, accent } = req.body
  try {
    const user = await prisma.user.update({
      where: { id: req.user.userId },
      data: {
        theme:  theme  !== undefined ? theme  : undefined,
        accent: accent !== undefined ? accent : undefined,
      },
      select: { id:true, name:true, email:true, bio:true, timezone:true, language:true, theme:true, accent:true }
    })
    res.json({ user })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Something went wrong.' })
  }
})

// GET /api/settings/export — export all user data as JSON
router.get('/export', async (req, res) => {
  try {
    const [notes, goals] = await Promise.all([
      prisma.note.findMany({ where: { userId: req.user.userId }, orderBy: { createdAt: 'desc' } }),
      prisma.goal.findMany({ where: { userId: req.user.userId }, orderBy: { createdAt: 'desc' } }),
    ])

    const payload = {
      exportedAt: new Date().toISOString(),
      notes,
      goals,
    }

    res.setHeader('Content-Type', 'application/json')
    res.setHeader('Content-Disposition', 'attachment; filename="minerva-export.json"')
    res.json(payload)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Export failed.' })
  }
})

// GET /api/settings/export/markdown — export notes as markdown
router.get('/export/markdown', async (req, res) => {
  try {
    const notes = await prisma.note.findMany({
      where: { userId: req.user.userId },
      orderBy: { createdAt: 'desc' }
    })

    const md = notes.map(note => {
      const date = new Date(note.createdAt).toLocaleDateString('en-US', { year:'numeric', month:'long', day:'numeric' })
      const tags = note.tags?.length ? `**Tags:** ${note.tags.join(', ')}\n\n` : ''
      return `# ${note.title || 'Untitled'}\n\n**Date:** ${date}  \n**Tag:** ${note.tag}\n\n${tags}${note.content}\n\n---\n`
    }).join('\n')

    res.setHeader('Content-Type', 'text/markdown')
    res.setHeader('Content-Disposition', 'attachment; filename="minerva-notes.md"')
    res.send(md)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Export failed.' })
  }
})

module.exports = router