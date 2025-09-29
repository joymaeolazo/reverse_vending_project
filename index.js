require('dotenv').config();

const express = require('express');
const bodyParser = require('body-parser');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const QRCode = require('qrcode');
const pool = require('./db'); // mysql2 promise pool

const app = express();
app.set('view engine', 'ejs');
app.use(bodyParser.urlencoded({ extended: false }));
app.use(express.static('public'));

app.use(session({
  secret: 'secretkey',
  resave: false,
  saveUninitialized: true
}));

app.get('/', (req, res) => res.redirect('/login'));

function checkAuth(req, res, next) {
  if (req.session.user) next();
  else res.redirect('/login');
}

/* ========== REGISTER ========== */
app.get('/register', (req, res) => res.render('register', { error: null }));
app.post('/register', async (req, res) => {
  const { name, email, password } = req.body;
  const hashed = await bcrypt.hash(password, 10);
  try {
    await pool.execute(
      'INSERT INTO users (name,email,password,role) VALUES (?,?,?,?)',
      [name, email, hashed, 'user']
    );
    res.redirect('/login');
  } catch (err) {
    res.render('register', { error: '❌ ' + err.message });
  }
});

/* ========== LOGIN ========== */
app.get('/login', (req, res) => res.render('login', { error: null }));
app.post('/login', async (req, res) => {
  const { email, password } = req.body;
  const [rows] = await pool.execute('SELECT * FROM users WHERE email=?', [email]);

  if (!rows.length) {
    return res.render('login', { error: '❌ User not found.' });
  }

  const user = rows[0];
  const valid = await bcrypt.compare(password, user.password);
  if (!valid) {
    return res.render('login', { error: '❌ Wrong password.' });
  }

  req.session.user = user;
  if (user.role === 'admin') res.redirect('/admin/dashboard');
  else res.redirect('/dashboard');
});

/* ========== USER DASHBOARD ========== */
app.get('/dashboard', checkAuth, async (req, res) => {
  const user = req.session.user;
  const qrCode = await QRCode.toDataURL(`UserID:${user.id}-Name:${user.name}`);
  const [rewards] = await pool.execute('SELECT * FROM rewards');

  const [claimed] = await pool.execute(`
    SELECT r.name AS reward_name, cr.claimed_at
    FROM claimed_rewards cr
    JOIN rewards r ON r.id = cr.reward_id
    WHERE cr.user_id = ?
    ORDER BY cr.claimed_at DESC
  `, [user.id]);

  const popup = req.query.claimed === '1';
  res.render('dashboard', { user, qrCode, rewards, claimed, popup });
});

/* ========== CLAIM REWARD ========== */
app.post('/claim/:rewardId', checkAuth, async (req, res) => {
  const user = req.session.user;
  const rewardId = req.params.rewardId;

  const [rewardRows] = await pool.execute('SELECT * FROM rewards WHERE id=?', [rewardId]);
  const reward = rewardRows[0];
  if (!reward) return res.send('Reward not found');

  if (user.points >= reward.cost) {
    await pool.execute(
      'INSERT INTO claimed_rewards (user_id, reward_id) VALUES (?, ?)',
      [user.id, rewardId]
    );
    await pool.execute(
      'UPDATE users SET points = points - ? WHERE id=?',
      [reward.cost, user.id]
    );
    req.session.user.points -= reward.cost;
    res.redirect('/dashboard?claimed=1');
  } else {
    res.send('Not enough points.');
  }
});

/* ========== ADMIN DASHBOARD & CLAIMS ========== */
app.get('/admin/dashboard', checkAuth, async (req, res) => {
  if (req.session.user.role !== 'admin') return res.send('Access denied');
  const [users] = await pool.execute('SELECT id,name,email,points FROM users');
  const [rewards] = await pool.execute('SELECT * FROM rewards');
  res.render('admin_dashboard', { user: req.session.user, users, rewards });
});

app.post('/admin/rewards/add', checkAuth, async (req, res) => {
  if (req.session.user.role !== 'admin') return res.send('Access denied');
  const { name, description, cost } = req.body;
  await pool.execute(
    'INSERT INTO rewards (name, description, cost) VALUES (?,?,?)',
    [name, description, cost]
  );
  res.redirect('/admin/dashboard');
});

app.post('/admin/rewards/edit/:id', checkAuth, async (req, res) => {
  if (req.session.user.role !== 'admin') return res.send('Access denied');
  const { name, description, cost } = req.body;
  const { id } = req.params;
  await pool.execute(
    'UPDATE rewards SET name=?, description=?, cost=? WHERE id=?',
    [name, description || null, cost, id]
  );
  res.redirect('/admin/dashboard');
});

app.post('/admin/rewards/delete/:id', checkAuth, async (req, res) => {
  if (req.session.user.role !== 'admin') return res.send('Access denied');
  await pool.execute('DELETE FROM rewards WHERE id=?', [req.params.id]);
  res.redirect('/admin/dashboard');
});

app.get('/admin/claims', checkAuth, async (req, res) => {
  if (req.session.user.role !== 'admin') return res.send('Access denied');
  const [rows] = await pool.execute(`
    SELECT u.name AS user, r.name AS reward, cr.claimed_at
    FROM claimed_rewards cr
    JOIN users u   ON u.id = cr.user_id
    JOIN rewards r ON r.id = cr.reward_id
    ORDER BY cr.claimed_at DESC
  `);
  res.render('admin_claims', { claims: rows });
});

/* ========== LOGOUT ========== */
app.get('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/login'));
});

/*app.listen(3000, () => console.log('Server running on http://localhost:3000'));*/
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on ${PORT}`));
