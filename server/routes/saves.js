import { Router } from 'express';
import { query } from '../db.js';
import { authMiddleware } from '../auth.js';

const router = Router();

router.use(authMiddleware);

router.get('/saves', async (req, res) => {
  const rows = await query(
    'SELECT id, save_name, updated_at FROM saves WHERE user_id = ? ORDER BY updated_at DESC',
    [req.userId]
  );
  res.json(rows);
});

router.get('/saves/:name', async (req, res) => {
  const rows = await query(
    'SELECT game_data, updated_at FROM saves WHERE user_id = ? AND save_name = ?',
    [req.userId, req.params.name]
  );
  if (!rows.length) return res.status(404).json({ error: 'Save not found' });
  res.json({ game_data: rows[0].game_data, updated_at: rows[0].updated_at });
});

router.post('/saves/:name', async (req, res) => {
  const { game_data } = req.body || {};
  if (!game_data) return res.status(400).json({ error: 'game_data required' });
  const name = req.params.name;
  await query(
    `INSERT INTO saves (user_id, save_name, game_data) VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE game_data = VALUES(game_data)`,
    [req.userId, name, JSON.stringify(game_data)]
  );
  res.json({ ok: true });
});

router.delete('/saves/:name', async (req, res) => {
  await query('DELETE FROM saves WHERE user_id = ? AND save_name = ?', [req.userId, req.params.name]);
  res.json({ ok: true });
});

export default router;
