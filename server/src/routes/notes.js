const express = require('express')
const prisma = require('../lib/prisma')
const requireAuth = require('../middleware/auth')

const router = express.Router()

router.use(requireAuth)

// GET /api/notes
router.get('/', async (req, res) => {
  try {
    const notes = await prisma.note.findMany({
      where: { userId: req.user.userId },
      orderBy: { updatedAt: 'desc' }
    })
    res.json({ notes })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Something went wrong.' })
  }
})

// POST /api/notes
router.post('/', async (req, res) => {
  const { title, content, tag, tags } = req.body

if (content === undefined && title === undefined) {    return res.status(400).json({ error: 'Title or content is required.' })
  }

  try {
    const note = await prisma.note.create({
      data: {
        title:   title   || '',
        content: content || '',
        tag:     tag     || 'Note',
        tags:    tags    || [],
        userId:  req.user.userId
      }
    })
    res.status(201).json({ note })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Something went wrong.' })
  }
})

// PUT /api/notes/:id
router.put('/:id', async (req, res) => {
  const { title, content, tag, tags } = req.body

  try {
    const existing = await prisma.note.findUnique({ where: { id: req.params.id } })
    if (!existing) return res.status(404).json({ error: 'Note not found.' })
    if (existing.userId !== req.user.userId) return res.status(403).json({ error: 'Not allowed.' })

    const note = await prisma.note.update({
      where: { id: req.params.id },
      data: {
        title:   title   !== undefined ? title   : existing.title,
        content: content !== undefined ? content : existing.content,
        tag:     tag     !== undefined ? tag     : existing.tag,
        tags:    tags    !== undefined ? tags    : existing.tags,
      }
    })
    res.json({ note })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Something went wrong.' })
  }
})

// DELETE /api/notes/:id
router.delete('/:id', async (req, res) => {
  try {
    const note = await prisma.note.findUnique({ where: { id: req.params.id } })
    if (!note) return res.status(404).json({ error: 'Note not found.' })
    if (note.userId !== req.user.userId) return res.status(403).json({ error: 'Not allowed.' })

    await prisma.note.delete({ where: { id: req.params.id } })
    res.json({ success: true })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Something went wrong.' })
  }
})

module.exports = router