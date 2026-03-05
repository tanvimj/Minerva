const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const app = express();

app.use(helmet());
app.use(express.json());

app.use(cors({
  origin: ['http://localhost:5500', 'http://127.0.0.1:5500', 'http://localhost:3000'],
  credentials: true
}));

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15,
  message: { error: 'Too many attempts, please try again later.' }
});
app.use('/api/auth', authLimiter);

app.get('/health', (req, res) => {
  res.json({ status: 'Minerva API is running' });
});

app.use('/api/auth', require('./routes/auth'));
app.use('/api/notes', require('./routes/notes'));
app.use('/api/goals', require('./routes/goals'));
app.use('/api/analytics', require('./routes/analytics'));
app.use('/api/settings', require('./routes/settings'));

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Minerva API running on http://localhost:${PORT}`);
});