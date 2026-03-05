const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
require('dotenv').config();

const app = express();

/* ---------------- SECURITY ---------------- */

app.use(helmet());
app.use(express.json());

app.use(cors({
  origin: [
    'http://localhost:5500',
    'http://127.0.0.1:5500',
    'http://localhost:3000',
    'https://minerva-spwa.onrender.com'
  ],
  credentials: true
}));

/* ---------------- RATE LIMIT ---------------- */

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15,
  message: { error: 'Too many attempts, please try again later.' }
});

app.use('/api/auth', authLimiter);

/* ---------------- HEALTH CHECK ---------------- */

app.get('/health', (req, res) => {
  res.json({ status: 'Minerva API is running' });
});

/* ---------------- API ROUTES ---------------- */

app.use('/api/auth', require('./routes/auth'));
app.use('/api/notes', require('./routes/notes'));
app.use('/api/goals', require('./routes/goals'));
app.use('/api/analytics', require('./routes/analytics'));
app.use('/api/settings', require('./routes/settings'));

/* ---------------- SERVE FRONTEND ---------------- */

app.use(express.static(path.join(__dirname, '../../client')));

/* Root route -> Landing Page */

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../../client/pages/landing/index.html'));
});

/* SPA fallback — skip actual asset files, serve login for everything else */
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../../client/pages/landing/index.html'));
});

/* ---------------- SERVER ---------------- */

const PORT = process.env.PORT || 4000;

app.listen(PORT, () => {
  console.log(`Minerva API running on port ${PORT}`);
});