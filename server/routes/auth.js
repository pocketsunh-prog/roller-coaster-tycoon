import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { query } from '../db.js';
import { signToken, authMiddleware } from '../auth.js';

const router = Router();

router.post('/register', async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: 'Username and password required' });
  if (username.length < 3 || username.length > 32) return res.status(400).json({ error: 'Username must be 3-32 characters' });
  if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });
  const existing = await query('SELECT id FROM users WHERE username = ?', [username]);
  if (existing.length) return res.status(409).json({ error: 'Username already taken' });
  const hash = await bcrypt.hash(password, 10);
  const result = await query('INSERT INTO users (username, password_hash) VALUES (?, ?)', [username, hash]);
  const token = signToken({ userId: result.insertId, username });
  res.json({ token, username });
});

router.post('/login', async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: 'Username and password required' });
  const rows = await query('SELECT id, username, password_hash FROM users WHERE username = ?', [username]);
  if (!rows.length) return res.status(401).json({ error: 'Invalid credentials' });
  const user = rows[0];
  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) return res.status(401).json({ error: 'Invalid credentials' });
  const token = signToken({ userId: user.id, username: user.username });
  res.json({ token, username: user.username });
});

router.get('/me', authMiddleware, (req, res) => {
  res.json({ userId: req.userId, username: req.username });
});

export default router;
