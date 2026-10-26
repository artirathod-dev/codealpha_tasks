// Artiverse backend: Express.js REST API + static frontend
const express = require('express');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const db = require('./db');

const PORT = process.env.PORT || 3000;
const SECRET = process.env.JWT_SECRET || 'artiverse-dev-secret-change-me';
const UPLOADS = path.join(__dirname, 'public', 'uploads');
fs.mkdirSync(UPLOADS, { recursive: true });
if (process.env.SEED !== 'false') require('./seed')(db, UPLOADS);

const app = express();
app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// ---------- helpers ----------
const OK_EXT = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.mp4', '.webm', '.mov'];
const upload = multer({
  storage: multer.diskStorage({
    destination: UPLOADS,
    filename: (req, f, cb) => {
      let ext = path.extname(f.originalname).toLowerCase();
      if (!OK_EXT.includes(ext)) ext = f.mimetype.startsWith('video') ? '.mp4' : '.jpg';
      cb(null, crypto.randomBytes(8).toString('hex') + ext);
    }
  }),
  limits: { fileSize: 30 * 1024 * 1024 },
  fileFilter: (req, f, cb) => cb(null, /^(image|video)\//.test(f.mimetype))
});

const fail = (res, msg, code = 400) => res.status(code).json({ error: msg });
const sign = id => jwt.sign({ id }, SECRET, { expiresIn: '30d' });
const count = (sql, ...a) => db.prepare(sql).get(...a).c;
const auth = (req, res, next) => {
  try { req.uid = jwt.verify((req.headers.authorization || '').replace('Bearer ', ''), SECRET).id; next(); }
  catch { fail(res, 'Please log in', 401); }
};
const notify = (to, actor, type, post) => {
  if (to !== actor) db.prepare('INSERT INTO notifications(user_id,actor_id,type,post_id) VALUES(?,?,?,?)').run(to, actor, type, post || null);
};
const log = (uid, text) => db.prepare('INSERT INTO activity(user_id,text) VALUES(?,?)').run(uid, text);

const FIELDS = 'id,username,name,bio,skills,location,headline,avatar,cover,created_at';
function profile(where, arg, viewer) {
  const u = db.prepare(`SELECT ${FIELDS}, email FROM users WHERE ${where}`).get(arg);
  if (!u) return null;
  u.posts = count('SELECT COUNT(*) c FROM posts WHERE user_id=?', u.id);
  u.followers = count('SELECT COUNT(*) c FROM follows WHERE following_id=?', u.id);
  u.following = count('SELECT COUNT(*) c FROM follows WHERE follower_id=?', u.id);
  u.isMe = u.id === viewer;
  u.isFollowing = !!db.prepare('SELECT 1 FROM follows WHERE follower_id=? AND following_id=?').get(viewer, u.id);
  if (!u.isMe) delete u.email;
  return u;
}

const POST_SQL = `SELECT p.id,p.content,p.image,p.created_at,u.username,u.name,u.avatar,
 (SELECT COUNT(*) FROM likes l WHERE l.post_id=p.id) likes,
 (SELECT COUNT(*) FROM comments c WHERE c.post_id=p.id) comments,
 EXISTS(SELECT 1 FROM likes l WHERE l.post_id=p.id AND l.user_id=?) liked,
 EXISTS(SELECT 1 FROM saves s WHERE s.post_id=p.id AND s.user_id=?) saved
 FROM posts p JOIN users u ON u.id=p.user_id`;
function getPosts(me, where = '', args = [], tail = 'ORDER BY p.id DESC LIMIT 40') {
  return db.prepare(`${POST_SQL} ${where} ${tail}`).all(me, me, ...args)
    .map(x => ({ ...x, liked: !!x.liked, saved: !!x.saved }));
}
function tagCounts() {
  const m = {};
  db.prepare('SELECT content FROM posts ORDER BY id DESC LIMIT 500').all().forEach(r =>
    (r.content.match(/#\w+/g) || []).forEach(t => { t = t.toLowerCase(); m[t] = (m[t] || 0) + 1; }));
  return Object.entries(m).sort((a, b) => b[1] - a[1]).map(([tag, count]) => ({ tag, count }));
}

// ---------- auth ----------
app.post('/api/auth/register', (req, res) => {
  let { name, username, email, password } = req.body || {};
  username = (username || '').trim().toLowerCase();
  email = (email || '').trim().toLowerCase();
  name = (name || '').trim() || username;
  if (!/^[a-z0-9_.]{3,20}$/.test(username)) return fail(res, 'Username must be 3-20 characters: letters, numbers, _ or .');
  if (!/^\S+@\S+\.\S+$/.test(email)) return fail(res, 'Please enter a valid email');
  if ((password || '').length < 6) return fail(res, 'Password must be at least 6 characters');
  if (db.prepare('SELECT 1 FROM users WHERE username=? OR email=?').get(username, email)) return fail(res, 'Username or email is already taken');
  const r = db.prepare('INSERT INTO users(username,email,password,name) VALUES(?,?,?,?)').run(username, email, bcrypt.hashSync(password, 10), name.slice(0, 50));
  res.json({ token: sign(r.lastInsertRowid), user: profile('id=?', r.lastInsertRowid, r.lastInsertRowid) });
});

app.post('/api/auth/login', (req, res) => {
  const id = ((req.body || {}).identifier || '').trim().toLowerCase();
  const u = db.prepare('SELECT * FROM users WHERE email=? OR username=?').get(id, id);
  if (!u || !bcrypt.compareSync((req.body || {}).password || '', u.password)) return fail(res, 'Invalid email/username or password', 401);
  res.json({ token: sign(u.id), user: profile('id=?', u.id, u.id) });
});

app.get('/api/me', auth, (req, res) => {
  const u = profile('id=?', req.uid, req.uid);
  u ? res.json(u) : fail(res, 'User not found', 401);
});

app.put('/api/me', auth, upload.fields([{ name: 'avatar', maxCount: 1 }, { name: 'cover', maxCount: 1 }]), (req, res) => {
  const b = req.body || {};
  const f = req.files || {};
  const cur = db.prepare('SELECT * FROM users WHERE id=?').get(req.uid);
  const pick = (k, max) => (b[k] !== undefined ? String(b[k]).trim().slice(0, max) : cur[k]);
  db.prepare('UPDATE users SET name=?,headline=?,bio=?,location=?,skills=?,avatar=?,cover=? WHERE id=?').run(
    pick('name', 50) || cur.name, pick('headline', 100), pick('bio', 400), pick('location', 60), pick('skills', 200),
    f.avatar ? '/uploads/' + f.avatar[0].filename : cur.avatar,
    f.cover ? '/uploads/' + f.cover[0].filename : cur.cover, req.uid);
  if (f.avatar) log(req.uid, 'You updated your profile photo');
  else log(req.uid, 'You updated your profile');
  res.json(profile('id=?', req.uid, req.uid));
});

// ---------- posts ----------
app.get('/api/feed', auth, (req, res) => {
  let posts = getPosts(req.uid, 'WHERE p.user_id=? OR p.user_id IN (SELECT following_id FROM follows WHERE follower_id=?)', [req.uid, req.uid]);
  if (!posts.length) posts = getPosts(req.uid);
  res.json(posts);
});

app.get('/api/explore', auth, (req, res) => res.json(getPosts(req.uid, 'WHERE p.image IS NOT NULL', [], 'ORDER BY p.id DESC LIMIT 18')));

app.post('/api/posts', auth, upload.single('media'), (req, res) => {
  const content = String((req.body || {}).content || '').trim().slice(0, 1000);
  if (!content && !req.file) return fail(res, 'Write something or add a photo/video');
  const r = db.prepare('INSERT INTO posts(user_id,content,image) VALUES(?,?,?)').run(req.uid, content, req.file ? '/uploads/' + req.file.filename : null);
  log(req.uid, 'You shared a new post');
  res.json(getPosts(req.uid, 'WHERE p.id=?', [r.lastInsertRowid])[0]);
});

app.get('/api/posts/:id', auth, (req, res) => {
  const p = getPosts(req.uid, 'WHERE p.id=?', [req.params.id])[0];
  if (!p) return fail(res, 'Post not found', 404);
  const related = getPosts(req.uid, 'WHERE p.id!=?', [req.params.id], 'ORDER BY RANDOM() LIMIT 4');
  res.json({ post: p, related });
});

app.delete('/api/posts/:id', auth, (req, res) => {
  const r = db.prepare('DELETE FROM posts WHERE id=? AND user_id=?').run(req.params.id, req.uid);
  r.changes ? res.json({ ok: true }) : fail(res, 'Not allowed', 403);
});

app.post('/api/posts/:id/like', auth, (req, res) => {
  const post = db.prepare('SELECT id,user_id FROM posts WHERE id=?').get(req.params.id);
  if (!post) return fail(res, 'Post not found', 404);
  const ex = db.prepare('SELECT 1 FROM likes WHERE user_id=? AND post_id=?').get(req.uid, post.id);
  if (ex) db.prepare('DELETE FROM likes WHERE user_id=? AND post_id=?').run(req.uid, post.id);
  else { db.prepare('INSERT INTO likes(user_id,post_id) VALUES(?,?)').run(req.uid, post.id); notify(post.user_id, req.uid, 'like', post.id); }
  res.json({ liked: !ex, likes: count('SELECT COUNT(*) c FROM likes WHERE post_id=?', post.id) });
});

app.post('/api/posts/:id/save', auth, (req, res) => {
  const ex = db.prepare('SELECT 1 FROM saves WHERE user_id=? AND post_id=?').get(req.uid, req.params.id);
  if (ex) db.prepare('DELETE FROM saves WHERE user_id=? AND post_id=?').run(req.uid, req.params.id);
  else db.prepare('INSERT INTO saves(user_id,post_id) VALUES(?,?)').run(req.uid, req.params.id);
  res.json({ saved: !ex });
});

// ---------- comments ----------
const COMMENT_SQL = `SELECT c.id,c.content,c.created_at,u.username,u.name,u.avatar,
 (SELECT COUNT(*) FROM comment_likes x WHERE x.comment_id=c.id) likes,
 EXISTS(SELECT 1 FROM comment_likes x WHERE x.comment_id=c.id AND x.user_id=?) liked
 FROM comments c JOIN users u ON u.id=c.user_id`;

app.get('/api/posts/:id/comments', auth, (req, res) =>
  res.json(db.prepare(`${COMMENT_SQL} WHERE c.post_id=? ORDER BY c.id`).all(req.uid, req.params.id).map(c => ({ ...c, liked: !!c.liked }))));

app.post('/api/posts/:id/comments', auth, (req, res) => {
  const content = String((req.body || {}).content || '').trim().slice(0, 500);
  const post = db.prepare('SELECT id,user_id FROM posts WHERE id=?').get(req.params.id);
  if (!post) return fail(res, 'Post not found', 404);
  if (!content) return fail(res, 'Comment cannot be empty');
  const r = db.prepare('INSERT INTO comments(post_id,user_id,content) VALUES(?,?,?)').run(post.id, req.uid, content);
  notify(post.user_id, req.uid, 'comment', post.id);
  const c = db.prepare(`${COMMENT_SQL} WHERE c.id=?`).get(req.uid, r.lastInsertRowid);
  res.json({ ...c, liked: !!c.liked });
});

app.post('/api/comments/:id/like', auth, (req, res) => {
  const ex = db.prepare('SELECT 1 FROM comment_likes WHERE user_id=? AND comment_id=?').get(req.uid, req.params.id);
  if (ex) db.prepare('DELETE FROM comment_likes WHERE user_id=? AND comment_id=?').run(req.uid, req.params.id);
  else db.prepare('INSERT INTO comment_likes(user_id,comment_id) VALUES(?,?)').run(req.uid, req.params.id);
  res.json({ liked: !ex, likes: count('SELECT COUNT(*) c FROM comment_likes WHERE comment_id=?', req.params.id) });
});

// ---------- users & follow ----------
app.get('/api/users/:username', auth, (req, res) => {
  const u = profile('username=?', req.params.username.toLowerCase(), req.uid);
  if (!u) return fail(res, 'User not found', 404);
  if (u.isMe) u.activity = db.prepare('SELECT text,created_at FROM activity WHERE user_id=? ORDER BY id DESC LIMIT 3').all(u.id);
  res.json(u);
});

app.get('/api/users/:username/posts', auth, (req, res) => {
  const u = db.prepare('SELECT id FROM users WHERE username=?').get(req.params.username.toLowerCase());
  if (!u) return fail(res, 'User not found', 404);
  const tab = req.query.tab || 'posts';
  if (tab === 'replies')
    return res.json(db.prepare(`SELECT c.id,c.content,c.created_at,c.post_id,p.content post_content,pu.username post_user
      FROM comments c JOIN posts p ON p.id=c.post_id JOIN users pu ON pu.id=p.user_id WHERE c.user_id=? ORDER BY c.id DESC LIMIT 30`).all(u.id));
  if (tab === 'media') return res.json(getPosts(req.uid, 'WHERE p.user_id=? AND p.image IS NOT NULL', [u.id]));
  if (tab === 'likes') return res.json(getPosts(req.uid, 'WHERE p.id IN (SELECT post_id FROM likes WHERE user_id=?)', [u.id]));
  if (tab === 'saved') return res.json(u.id === req.uid ? getPosts(req.uid, 'WHERE p.id IN (SELECT post_id FROM saves WHERE user_id=?)', [u.id]) : []);
  res.json(getPosts(req.uid, 'WHERE p.user_id=?', [u.id]));
});

app.get('/api/users/:username/stories', auth, (req, res) => {
  const u = db.prepare('SELECT id FROM users WHERE username=?').get(req.params.username.toLowerCase());
  if (!u) return fail(res, 'User not found', 404);
  res.json(db.prepare('SELECT id,content,image,created_at FROM posts WHERE user_id=? AND image IS NOT NULL ORDER BY id DESC LIMIT 5').all(u.id));
});

app.post('/api/users/:username/follow', auth, (req, res) => {
  const t = db.prepare('SELECT id,name FROM users WHERE username=?').get(req.params.username.toLowerCase());
  if (!t) return fail(res, 'User not found', 404);
  if (t.id === req.uid) return fail(res, "You can't follow yourself");
  const ex = db.prepare('SELECT 1 FROM follows WHERE follower_id=? AND following_id=?').get(req.uid, t.id);
  if (ex) db.prepare('DELETE FROM follows WHERE follower_id=? AND following_id=?').run(req.uid, t.id);
  else { db.prepare('INSERT INTO follows(follower_id,following_id) VALUES(?,?)').run(req.uid, t.id); notify(t.id, req.uid, 'follow'); log(req.uid, 'You followed ' + t.name); }
  res.json({ following: !ex, followers: count('SELECT COUNT(*) c FROM follows WHERE following_id=?', t.id) });
});

app.get('/api/suggestions', auth, (req, res) =>
  res.json(db.prepare(`SELECT id,username,name,avatar,headline FROM users WHERE id!=? AND id NOT IN
    (SELECT following_id FROM follows WHERE follower_id=?) ORDER BY RANDOM() LIMIT 4`).all(req.uid, req.uid)));

app.get('/api/following', auth, (req, res) =>
  res.json(db.prepare(`SELECT u.id,u.username,u.name,u.avatar FROM users u JOIN follows f ON f.following_id=u.id WHERE f.follower_id=?`).all(req.uid)));

app.get('/api/stories', auth, (req, res) =>
  res.json(db.prepare(`SELECT DISTINCT u.id,u.username,u.name,u.avatar FROM users u JOIN posts p ON p.user_id=u.id
    WHERE p.image IS NOT NULL AND u.id!=? AND u.id IN (SELECT following_id FROM follows WHERE follower_id=?) LIMIT 10`).all(req.uid, req.uid)));

// ---------- search & trending ----------
app.get('/api/trending', auth, (req, res) => res.json(tagCounts().slice(0, 6)));

app.get('/api/search', auth, (req, res) => {
  const q = String(req.query.q || '').trim();
  if (!q) return res.json({ users: [], posts: [], tags: [] });
  const term = q.replace(/^#/, '').replace(/[%_]/g, '');
  const like = `%${term}%`;
  const users = db.prepare(`SELECT id,username,name,avatar,headline,
    EXISTS(SELECT 1 FROM follows WHERE follower_id=? AND following_id=users.id) following
    FROM users WHERE username LIKE ? OR name LIKE ? LIMIT 12`).all(req.uid, like, like).map(u => ({ ...u, following: !!u.following, isMe: u.id === req.uid }));
  const posts = getPosts(req.uid, 'WHERE p.content LIKE ? OR u.username LIKE ?', [q.startsWith('#') ? `%${q}%` : like, like], 'ORDER BY p.id DESC LIMIT 18');
  const tags = tagCounts().filter(t => t.tag.includes(term.toLowerCase())).slice(0, 10);
  res.json({ users, posts, tags });
});

// ---------- notifications ----------
app.get('/api/notifications', auth, (req, res) => {
  const list = db.prepare(`SELECT n.id,n.type,n.post_id,n.is_read,n.created_at,u.username,u.name,u.avatar FROM notifications n
    JOIN users u ON u.id=n.actor_id WHERE n.user_id=? ORDER BY n.id DESC LIMIT 50`).all(req.uid);
  res.json(list);
});
app.get('/api/notifications/count', auth, (req, res) =>
  res.json({ count: count('SELECT COUNT(*) c FROM notifications WHERE user_id=? AND is_read=0', req.uid) }));
app.post('/api/notifications/read', auth, (req, res) => {
  db.prepare('UPDATE notifications SET is_read=1 WHERE user_id=?').run(req.uid);
  res.json({ ok: true });
});

// ---------- messages ----------
app.get('/api/messages', auth, (req, res) =>
  res.json(db.prepare(`SELECT u.username,u.name,u.avatar,m.content last,m.created_at FROM messages m
    JOIN users u ON u.id=CASE WHEN m.from_id=? THEN m.to_id ELSE m.from_id END
    WHERE m.id IN (SELECT MAX(id) FROM messages WHERE from_id=? OR to_id=? GROUP BY CASE WHEN from_id=? THEN to_id ELSE from_id END)
    ORDER BY m.id DESC`).all(req.uid, req.uid, req.uid, req.uid)));

app.get('/api/messages/:username', auth, (req, res) => {
  const o = db.prepare('SELECT id,username,name,avatar FROM users WHERE username=?').get(req.params.username.toLowerCase());
  if (!o) return fail(res, 'User not found', 404);
  const msgs = db.prepare(`SELECT id,content,created_at,from_id=? mine FROM messages
    WHERE (from_id=? AND to_id=?) OR (from_id=? AND to_id=?) ORDER BY id`).all(req.uid, req.uid, o.id, o.id, req.uid).map(m => ({ ...m, mine: !!m.mine }));
  res.json({ user: o, messages: msgs });
});

app.post('/api/messages/:username', auth, (req, res) => {
  const o = db.prepare('SELECT id FROM users WHERE username=?').get(req.params.username.toLowerCase());
  const content = String((req.body || {}).content || '').trim().slice(0, 1000);
  if (!o || !content) return fail(res, 'Invalid message');
  const r = db.prepare('INSERT INTO messages(from_id,to_id,content) VALUES(?,?,?)').run(req.uid, o.id, content);
  res.json(db.prepare('SELECT id,content,created_at,1 mine FROM messages WHERE id=?').get(r.lastInsertRowid));
});

// ---------- errors & fallback ----------
app.use('/api', (req, res) => fail(res, 'Not found', 404));
app.use((err, req, res, next) => {
  console.error(err);
  fail(res, err.code === 'LIMIT_FILE_SIZE' ? 'File is too large (max 30 MB)' : 'Server error', 500);
});

app.listen(PORT, () => console.log(`Artiverse running -> http://localhost:${PORT}`));
