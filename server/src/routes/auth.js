const express = require('express')
const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')
const prisma = require('../lib/prisma')

const router = express.Router()

// SIGNUP
router.post('/signup', async (req, res) => {
  const { name, email, password } = req.body

  if (!name || !email || !password)
    return res.status(400).json({ error: 'All fields are required.' })

  if (password.length < 6)
    return res.status(400).json({ error: 'Password must be at least 6 characters.' })

  try {
    const existing = await prisma.user.findUnique({ where: { email } })
    if (existing)
      return res.status(409).json({ error: 'Email already in use.' })

    const hashed = await bcrypt.hash(password, 12)
    const user = await prisma.user.create({
      data: { name, email, password: hashed }
    })

    const token = jwt.sign(
      { userId: user.id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN }
    )

    res.status(201).json({ token, user: { id: user.id, name: user.name, email: user.email } })
  }  catch (err) {
    console.error('SIGNUP ERROR:', err.message, err.stack)
    res.status(500).json({ error: 'Something went wrong.' })
  }
})

// LOGIN

// LOGIN
router.post('/login', async (req, res) => {
  const { email, password } = req.body

  if (!email || !password)
    return res.status(400).json({ error: 'All fields are required.' })

  try {
    const user = await prisma.user.findUnique({ where: { email } })
    if (!user)
      return res.status(401).json({ error: 'Invalid email or password.' })

    const match = await bcrypt.compare(password, user.password)
    if (!match)
      return res.status(401).json({ error: 'Invalid email or password.' })

    const token = jwt.sign(
      { userId: user.id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN }
    )

    res.json({ token, user: { id: user.id, name: user.name, email: user.email } })
  } catch (err) {
    console.error('SIGNUP ERROR:', JSON.stringify(err, null, 2), err.message, err.stack)
    res.status(500).json({ error: 'Something went wrong.' })
  }
})
// ME
const requireAuth = require('/src/middleware/auth')

router.get('/me', requireAuth, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.userId },
      select: { id: true, name: true, email: true, createdAt: true }
    })

    if (!user) return res.status(404).json({ error: 'User not found.' })

    res.json({ user })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Something went wrong.' })
  }
})
module.exports = router