'use strict';
/* Artiverse frontend - single page app (vanilla JS, hash routing) */
const $ = (s, e = document) => e.querySelector(s);
const $$ = (s, e = document) => [...e.querySelectorAll(s)];
const state = { me: null, poll: null, nav: 0, storyUsers: [] };

/* ---------- icons ---------- */
const IC = {
  home: '<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
  explore: '<circle cx="12" cy="12" r="9"/><path d="m15.5 8.5-2 5-5 2 2-5z"/>',
  msg: '<path d="M4 5h16a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H9l-5 4V6a1 1 0 0 1 1-1z"/>',
  bell: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10 21a2 2 0 0 0 4 0"/>',
  plus: '<rect x="3" y="3" width="18" height="18" rx="4"/><path d="M12 8v8M8 12h8"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9 7 7M17 17l2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1"/>',
  heart: '<path d="M12 21s-8-5.3-8-11a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 20 10c0 5.7-8 11-8 11z"/>',
  comment: '<path d="M21 12a8 8 0 0 1-11.6 7.1L3 21l1.9-5.4A8 8 0 1 1 21 12z"/>',
  share: '<path d="M12 3v12M7 8l5-5 5 5"/><path d="M5 14v5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5"/>',
  bookmark: '<path d="M6 3h12v18l-6-4-6 4z"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>',
  more: '<circle cx="12" cy="5" r="1.2"/><circle cx="12" cy="12" r="1.2"/><circle cx="12" cy="19" r="1.2"/>',
  image: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="m21 16-5-5-9 9"/>',
  video: '<rect x="2" y="6" width="14" height="12" rx="2"/><path d="m16 10 6-3v10l-6-3"/>',
  smile: '<circle cx="12" cy="12" r="9"/><path d="M8 14s1.5 2 4 2 4-2 4-2M9 9.5h.01M15 9.5h.01"/>',
  send: '<path d="m22 2-7 20-4-9-9-4z"/><path d="M22 2 11 13"/>',
  moon: '<path d="M21 13a9 9 0 1 1-10-10 7 7 0 0 0 10 10z"/>',
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
  flag: '<path d="M5 21V4M5 4h13l-2 4 2 4H5"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
  back: '<path d="m15 18-6-6 6-6"/>',
  x: '<path d="M6 6l12 12M18 6 6 18"/>',
  link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>'
};
const ic = n => `<svg class="i" viewBox="0 0 24 24">${IC[n]}</svg>`;

/* ---------- helpers ---------- */
const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const linkify = t => esc(t)
  .replace(/#(\w+)/g, '<a class="tag" href="#/explore?q=%23$1">#$1</a>')
  .replace(/@(\w+)/g, '<a href="#/u/$1">@$1</a>');
const isVid = s => /\.(mp4|webm|mov)$/i.test(s || '');
const token = () => localStorage.getItem('av_token') || sessionStorage.getItem('av_token');
const first = n => (n || '').split(' ')[0];

function ago(s) {
  const d = (Date.now() - new Date(String(s).replace(' ', 'T') + 'Z')) / 1000;
  if (d < 60) return 'just now';
  if (d < 3600) return Math.floor(d / 60) + 'm';
  if (d < 86400) return Math.floor(d / 3600) + 'h';
  if (d < 604800) return Math.floor(d / 86400) + 'd';
  return new Date(String(s).replace(' ', 'T') + 'Z').toLocaleDateString('en', { day: 'numeric', month: 'short' });
}

function genAv(u) {
  const n = (u.name || u.username || '?').trim();
  const ini = n.split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase();
  let h = 0;
  for (const c of (u.username || n)) h = (h * 31 + c.charCodeAt(0)) % 360;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="hsl(${h},70%,62%)"/><stop offset="1" stop-color="hsl(${(h + 50) % 360},70%,48%)"/></linearGradient></defs><rect width="100" height="100" fill="url(#g)"/><text x="50" y="63" font-size="38" font-family="Arial,sans-serif" font-weight="700" fill="#fff" text-anchor="middle">${esc(ini)}</text></svg>`;
  return 'data:image/svg+xml,' + encodeURIComponent(svg);
}
const av = (u, c = '') => `<img class="av ${c}" src="${esc(u.avatar || genAv(u))}" alt="${esc(u.name)}">`;

function mediaEl(src, mode = 'post') {
  if (isVid(src)) return mode === 'post'
    ? `<video src="${esc(src)}" controls playsinline preload="metadata"></video>`
    : `<video src="${esc(src)}" muted playsinline preload="metadata" ${mode === 'story' ? 'autoplay loop' : ''}></video>`;
  return `<img src="${esc(src)}" alt="" loading="lazy">`;
}

let toastTimer;
function toast(m) {
  const t = $('#toast');
  t.textContent = m; t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2400);
}

async function api(path, o = {}) {
  const headers = {};
  if (token()) headers.Authorization = 'Bearer ' + token();
  let body;
  if (o.form) body = o.form;
  else if (o.body) { headers['Content-Type'] = 'application/json'; body = JSON.stringify(o.body); }
  const r = await fetch(path, { method: o.method || 'GET', headers, body });
  const d = await r.json().catch(() => ({}));
  if (r.status === 401 && state.me) { logout(true); throw new Error('Session expired. Please log in again.'); }
  if (!r.ok) throw new Error(d.error || 'Something went wrong');
  return d;
}

/* ---------- theme ---------- */
function applyTheme(t) {
  document.documentElement.dataset.theme = t;
  localStorage.setItem('av_theme', t);
}
applyTheme(localStorage.getItem('av_theme') || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'));

/* ---------- auth ---------- */
function clearToken() { localStorage.removeItem('av_token'); sessionStorage.removeItem('av_token'); }
function showAuth() { $('#app').classList.add('hidden'); $('#auth').classList.remove('hidden'); }
function showApp() { $('#auth').classList.add('hidden'); $('#app').classList.remove('hidden'); }
function logout(expired) {
  clearToken(); state.me = null; clearInterval(state.poll); clearInterval(state.badgeTimer);
  showAuth();
  if (!expired) toast('Logged out. See you soon! 👋');
}

function authTab(which) {
  $$('[data-authtab].tab').forEach(t => t.classList.toggle('active', t.dataset.authtab === which));
  $('#loginForm').classList.toggle('hidden', which !== 'login');
  $('#signupForm').classList.toggle('hidden', which !== 'signup');
  $('#authSwitch').innerHTML = which === 'login'
    ? `Don't have an account? <a href="#" data-authtab="signup">Sign Up</a>`
    : `Already have an account? <a href="#" data-authtab="login">Login</a>`;
}

async function doAuth(url, body, remember, form) {
  const btn = $('.btn', form); btn.disabled = true;
  try {
    const d = await api(url, { method: 'POST', body });
    clearToken();
    (remember ? localStorage : sessionStorage).setItem('av_token', d.token);
    state.me = d.user;
    buildShell(); showApp();
    history.replaceState(null, '', '#/home');
    route();
    toast(`Welcome, ${first(d.user.name)}! 💜`);
  } catch (e) { toast(e.message); }
  btn.disabled = false;
}
$('#loginForm').addEventListener('submit', e => {
  e.preventDefault();
  const f = new FormData(e.target);
  doAuth('/api/auth/login', { identifier: f.get('identifier'), password: f.get('password') }, !!f.get('remember'), e.target);
});
$('#signupForm').addEventListener('submit', e => {
  e.preventDefault();
  const f = Object.fromEntries(new FormData(e.target));
  doAuth('/api/auth/register', f, true, e.target);
});

/* ---------- shell ---------- */
const NAV = [['home', 'Home', 'home'], ['explore', 'Explore', 'explore'], ['messages', 'Messages', 'msg'], ['notifications', 'Notifications', 'bell'], ['create', 'Create Post', 'plus'], 'sep', ['profile', 'Profile', 'user'], ['settings', 'Settings', 'settings']];

function buildShell() {
  $('#nav').innerHTML = NAV.map(n => n === 'sep' ? '<div class="sep"></div>' :
    `<a href="#/${n[0]}" data-nav="${n[0]}">${ic(n[2])}<span>${n[1]}</span>${n[0] === 'notifications' ? '<b class="badge hidden" data-badge></b>' : ''}</a>`).join('');
  $('#bottomNav').innerHTML = [['home', 'home', 'Home'], ['explore', 'explore', 'Explore'], ['create', 'plus', ''], ['notifications', 'bell', 'Alerts'], ['profile', 'user', 'Profile']]
    .map(n => `<a href="#/${n[0]}" data-nav="${n[0]}" class="${n[0] === 'create' ? 'plus' : ''}">${ic(n[1])}${n[2] ? `<span>${n[2]}</span>` : ''}${n[0] === 'notifications' ? '<b class="badge hidden" data-badge></b>' : ''}</a>`).join('');
  $('#searchIcon').innerHTML = ic('search');
  $('#themeBtn').innerHTML = ic('moon');
  $('#bellBtn').innerHTML = ic('bell') + '<b class="badge hidden" data-badge></b>';
  if (!$('.msearch')) $('.top-actions').insertAdjacentHTML('afterbegin', `<button class="icon msearch" data-act="msearch">${ic('search')}</button>`);
  paintMe();
  refreshBadge();
  clearInterval(state.badgeTimer);
  state.badgeTimer = setInterval(refreshBadge, 25000);
}
function paintMe() {
  $('#meChip').innerHTML = `${av(state.me, 'sm')}<div><b>${esc(state.me.name)}</b><small>@${esc(state.me.username)}</small></div>`;
  $('#topAvatar').href = '#/profile';
  $('#topAvatar').innerHTML = av(state.me, 'sm');
}
async function refreshBadge(force) {
  try {
    const n = force !== undefined ? force : (await api('/api/notifications/count')).count;
    $$('[data-badge]').forEach(b => { b.textContent = n > 9 ? '9+' : n; b.classList.toggle('hidden', !n); });
  } catch { /* ignore */ }
}
function setActive(name, parts) {
  let k = name;
  if (name === 'u') k = parts[1] === state.me.username ? 'profile' : '';
  if (name === 'post') k = '';
  $$('[data-nav]').forEach(a => a.classList.toggle('active', a.dataset.nav === k));
}

/* ---------- router ---------- */
function render(my, html) {
  if (my !== state.nav) return false;
  $('#view').innerHTML = html;
  return true;
}
async function route() {
  if (!state.me) return;
  clearInterval(state.poll);
  const [path, qs] = location.hash.slice(1).split('?');
  const parts = path.split('/').filter(Boolean);
  const name = parts[0] || 'home';
  const q = new URLSearchParams(qs || '');
  document.body.classList.remove('mobile-search');
  if (name !== 'explore') $('#searchInput').value = '';
  setActive(name, parts);
  const my = ++state.nav;
  $('#view').innerHTML = '<div class="loader"></div>';
  try { await (VIEWS[name] || VIEWS.home)(parts.slice(1), q, my); }
  catch (e) { render(my, `<div class="page single"><div class="card empty">${esc(e.message)}<br><br><a class="btn sm" href="#/home">Go home</a></div></div>`); }
  if (my === state.nav) window.scrollTo(0, 0);
}
window.addEventListener('hashchange', route);

/* ---------- reusable pieces ---------- */
function postCard(p, detail = false) {
  const mine = p.username === state.me.username;
  const media = p.image ? `<div class="media" ${!detail && !isVid(p.image) ? 'data-act="open"' : ''}>${mediaEl(p.image)}</div>` : '';
  return `<article class="card post fade" data-id="${p.id}">
    <div class="row between">
      <a class="row gap user" href="#/u/${esc(p.username)}">${av(p)}<div><b>${esc(p.name)}</b><small>@${esc(p.username)} · ${ago(p.created_at)}</small></div></a>
      <div class="menu"><button class="icon" data-act="menu">${ic('more')}</button>
        <div class="dropdown hidden">
          <button data-act="save">${ic('bookmark')} ${p.saved ? 'Unsave post' : 'Save post'}</button>
          <button data-act="copy">${ic('link')} Copy link</button>
          ${mine ? `<button class="danger" data-act="delete">${ic('trash')} Delete</button>` : `<button data-act="report">${ic('flag')} Report</button>`}
        </div></div>
    </div>
    ${p.content ? `<div class="ptext" ${detail ? '' : 'data-act="open"'}>${linkify(p.content)}</div>` : '<div style="height:10px"></div>'}
    ${media}
    <div class="actions">
      <button class="act like ${p.liked ? 'on' : ''}" data-act="like">${ic('heart')}<span>${p.likes}</span></button>
      <button class="act" data-act="open">${ic('comment')}<span class="ccount">${p.comments}</span></button>
      <button class="act" data-act="share">${ic('share')}</button>
      <button class="act save ${p.saved ? 'on' : ''}" data-act="save">${ic('bookmark')}</button>
    </div></article>`;
}

const person = u => `<div class="person"><a href="#/u/${esc(u.username)}">${av(u, 'sm')}</a>
  <div class="grow"><a href="#/u/${esc(u.username)}"><b>${esc(u.name)}</b></a><small>@${esc(u.username)}</small></div>
  ${u.isMe ? '' : `<button class="btn sm ${u.following ? 'following' : ''}" data-act="follow" data-user="${esc(u.username)}">${u.following ? 'Following' : 'Follow'}</button>`}</div>`;

const tile = p => `<a class="tile" href="#/post/${p.id}">${p.image ? mediaEl(p.image, 'tile') : esc((p.content || '').slice(0, 90))}</a>`;

async function fillRight(kinds = ['follow', 'trend']) {
  const el = $('#right'); if (!el) return;
  let sug = [], tr = [];
  try {
    [sug, tr] = await Promise.all([kinds.includes('follow') ? api('/api/suggestions') : [], kinds.includes('trend') ? api('/api/trending') : []]);
  } catch { return; }
  if (!$('#right')) return;
  el.innerHTML =
    (kinds.includes('follow') ? `<div class="card fade"><h3>Who to follow</h3>${sug.map(u => person({ ...u, following: false })).join('') || '<small>You follow everyone 🎉</small>'}</div>` : '') +
    (kinds.includes('trend') ? `<div class="card fade"><h3>Trending</h3>${tr.map(t => `<div class="tr"><a href="#/explore?q=${encodeURIComponent(t.tag)}">${esc(t.tag)}</a><span>${t.count} post${t.count > 1 ? 's' : ''}</span></div>`).join('') || '<small>No trends yet</small>'}</div>` : '');
}

/* composer */
function composerHTML() {
  const emojis = ['😀', '😍', '🥳', '😎', '🔥', '💜', '✨', '🌅', '🚀', '👏', '🙌', '😂'];
  return `<div class="card composer fade">
    <div class="row gap" style="align-items:flex-start">${av(state.me)}<textarea id="cText" rows="1" maxlength="1000" placeholder="What's on your mind, ${esc(first(state.me.name))}?"></textarea></div>
    <div id="cPrev"></div>
    <div id="cEmo" class="emojis hidden">${emojis.map(x => `<button type="button" data-act="emoji">${x}</button>`).join('')}</div>
    <div class="row between tools"><div class="row" style="flex-wrap:wrap">
      <label class="chip" style="margin:0">${ic('image')}Photo<input type="file" id="cPhoto" accept="image/*"></label>
      <label class="chip" style="margin:0">${ic('video')}Video<input type="file" id="cVideo" accept="video/*"></label>
      <button type="button" class="chip" data-act="feel">${ic('smile')}Feeling</button></div>
      <button class="btn sm" id="cPost">Post</button></div></div>`;
}
function bindComposer(done) {
  let file = null;
  const ta = $('#cText'), prev = $('#cPrev');
  ta.addEventListener('input', () => { ta.style.height = 'auto'; ta.style.height = Math.min(ta.scrollHeight, 200) + 'px'; });
  const pick = inp => inp.addEventListener('change', () => {
    const f = inp.files[0]; if (!f) return;
    if (f.size > 30 * 1024 * 1024) { toast('File too large (max 30 MB)'); inp.value = ''; return; }
    file = f;
    const url = URL.createObjectURL(f);
    prev.innerHTML = `<div class="preview">${f.type.startsWith('video') ? `<video src="${url}" controls playsinline></video>` : `<img src="${url}" alt="">`}<button type="button" class="x" data-act="rmMedia">${ic('x')}</button></div>`;
  });
  pick($('#cPhoto')); pick($('#cVideo'));
  state.clearMedia = () => { file = null; prev.innerHTML = ''; $('#cPhoto').value = ''; $('#cVideo').value = ''; };
  $('#cPost').onclick = async () => {
    const text = ta.value.trim();
    if (!text && !file) return toast('Write something or add a photo/video');
    const fd = new FormData(); fd.append('content', text); if (file) fd.append('media', file);
    const btn = $('#cPost'); btn.disabled = true;
    try {
      const p = await api('/api/posts', { method: 'POST', form: fd });
      ta.value = ''; ta.style.height = 'auto'; state.clearMedia();
      toast('Posted! 🎉'); done(p);
    } catch (e) { toast(e.message); }
    btn.disabled = false;
  };
}

/* story viewer */
async function openStory(username) {
  const items = await api(`/api/users/${encodeURIComponent(username)}/stories`);
  const mine = username === state.me.username;
  if (!items.length) { toast(mine ? 'Share a photo post to create a story' : 'No stories yet'); if (mine) location.hash = '#/create'; return; }
  const user = mine ? state.me : (state.storyUsers.find(u => u.username === username) || { username, name: username });
  const root = $('#modalRoot');
  let i = 0, timer;
  const close = () => { clearTimeout(timer); root.innerHTML = ''; root.onclick = null; document.removeEventListener('keydown', key); };
  const next = () => { if (i < items.length - 1) { i++; show(); } else close(); };
  const prev = () => { if (i > 0) i--; show(); };
  const key = e => { if (e.key === 'Escape') close(); if (e.key === 'ArrowRight') next(); if (e.key === 'ArrowLeft') prev(); };
  function show() {
    clearTimeout(timer);
    const it = items[i];
    root.innerHTML = `<div class="overlay"><div class="story-view">
      <div class="bars">${items.map((_, k) => `<i class="${k < i ? 'done' : k === i ? 'cur' : ''}"><b></b></i>`).join('')}</div>
      <div class="story-top">${av(user, 'xs')}<b>${esc(user.name)}</b><small style="color:#ddd">${ago(it.created_at)}</small>
        <button class="icon" style="margin-left:auto;color:#fff" data-close>${ic('x')}</button></div>
      ${mediaEl(it.image, 'story')}<div class="shade"></div>
      <div class="tap" style="left:0" data-prev></div><div class="tap" style="right:0" data-next></div>
      <div class="story-cap">${linkify(it.content || '')}</div></div></div>`;
    timer = setTimeout(next, 4000);
  }
  root.onclick = e => {
    if (e.target.closest('a') || e.target.classList.contains('overlay') || e.target.closest('[data-close]')) close();
    else if (e.target.closest('[data-next]')) next();
    else if (e.target.closest('[data-prev]')) prev();
  };
  document.addEventListener('keydown', key);
  show();
}

/* ---------- views ---------- */
const VIEWS = {
  async home(a, q, my) {
    const [feed, stories] = await Promise.all([api('/api/feed'), api('/api/stories')]);
    state.storyUsers = stories;
    const sHTML = `<div class="stories">
      <div class="story" data-act="story" data-user="${esc(state.me.username)}"><div class="ring">${av(state.me)}</div><span>Your story</span></div>
      ${stories.map(u => `<div class="story" data-act="story" data-user="${esc(u.username)}"><div class="ring">${av(u)}</div><span>${esc(first(u.name))}</span></div>`).join('')}</div>`;
    if (!render(my, `<div class="page"><div class="center">${composerHTML()}${sHTML}<div id="feed">${feed.map(p => postCard(p)).join('') || '<div class="card empty">No posts yet. Share your first one!</div>'}</div></div><aside class="right" id="right"></aside></div>`)) return;
    bindComposer(p => { $('#feed .empty')?.remove(); $('#feed').insertAdjacentHTML('afterbegin', postCard(p)); });
    fillRight();
  },

  async create(a, q, my) {
    if (!render(my, `<div class="page single"><div><h2 style="margin:6px 0 14px">Create Post</h2>${composerHTML()}<p class="hint">Tip: add #hashtags so people can discover your post. Photo posts also appear as your story.</p></div></div>`)) return;
    bindComposer(() => { location.hash = '#/home'; });
    $('#cText').focus();
  },

  async explore(a, q, my) {
    const term = (q.get('q') || '').trim();
    const tab = q.get('tab') || 'all';
    $('#searchInput').value = term;
    const data = term ? await api('/api/search?q=' + encodeURIComponent(term))
      : { users: [], posts: await api('/api/explore'), tags: await api('/api/trending') };
    const base = '#/explore?' + (term ? 'q=' + encodeURIComponent(term) + '&' : '') + 'tab=';
    const tabs = ['all', 'users', 'posts', 'hashtags'].filter(t => term || t === 'all' || t === 'posts' || t === 'hashtags');
    const usersSec = data.users.length ? `<div class="card"><h3>Users</h3>${data.users.map(person).join('')}</div>` : '';
    const tagsSec = data.tags.length ? `<div class="card"><h3>Hashtags</h3>${data.tags.map(t => `<div class="tr"><a href="#/explore?q=${encodeURIComponent(t.tag)}">${esc(t.tag)}</a><span>${t.count} post${t.count > 1 ? 's' : ''}</span></div>`).join('')}</div>` : '';
    const mini = p => `<a class="mini" href="#/post/${p.id}"><div class="tile">${p.image ? mediaEl(p.image, 'tile') : esc((p.content || '').slice(0, 80))}</div>
      <small style="color:var(--text)">${esc((p.content || '').slice(0, 50))}</small><small>@${esc(p.username)}</small><small>♥ ${p.likes} &nbsp; 💬 ${p.comments}</small></a>`;
    const postsSec = data.posts.length ? `<div class="card"><h3>${term ? 'Posts' : 'Discover'}</h3><div class="pgrid">${data.posts.map(mini).join('')}</div></div>` : '';
    const body = (tab === 'users' ? usersSec : tab === 'posts' ? postsSec : tab === 'hashtags' ? tagsSec : usersSec + tagsSec + postsSec)
      || `<div class="card empty">No results${term ? ' for “' + esc(term) + '”' : ''}.</div>`;
    if (!render(my, `<div class="page"><div class="center">
      <div class="card" style="padding:0"><div class="tabs">${tabs.map(t => `<a class="tab ${t === tab ? 'active' : ''}" href="${base}${t}">${t[0].toUpperCase() + t.slice(1)}</a>`).join('')}</div></div>
      ${body}</div><aside class="right" id="right"></aside></div>`)) return;
    fillRight(['trend']);
  },

  async post([id], q, my) {
    const [{ post, related }, comments] = await Promise.all([api('/api/posts/' + id), api(`/api/posts/${id}/comments`)]);
    const cmt = c => `<div class="comment" data-cid="${c.id}">${av(c, 'sm')}<div class="grow">
      <div><a href="#/u/${esc(c.username)}"><b style="color:var(--text)">${esc(c.name)}</b></a> <small>@${esc(c.username)} · ${ago(c.created_at)}</small></div>
      <p>${linkify(c.content)}</p>
      <div class="links"><button data-act="reply" data-user="${esc(c.username)}">Reply</button>
      <button class="${c.liked ? 'on' : ''}" data-act="cLike" data-cid="${c.id}">${ic('heart')}<span>${c.likes}</span></button></div></div></div>`;
    const thumb = p => p.image && !isVid(p.image) ? `<img src="${esc(p.image)}" alt="">` : '<div class="ph"></div>';
    if (!render(my, `<div class="page wide"><div class="center">
      <a class="back" href="#/home" data-act="back">${ic('back')} Back</a>
      ${postCard(post, true)}
      <div class="card fade"><h3>Comments (<span id="cCount">${comments.length}</span>)</h3>
        <div id="cList">${comments.map(cmt).join('') || '<div class="empty" id="noC" style="padding:12px">Be the first to comment 💬</div>'}</div>
        <form class="cform" id="cForm">${av(state.me, 'xs')}<input id="cInput" placeholder="Add a comment..." maxlength="500" autocomplete="off"><button aria-label="Send">${ic('send')}</button></form></div></div>
      <aside class="right"><div class="card"><h3>Post options</h3>
        <button class="opt" data-act="save" data-id="${post.id}">${ic('bookmark')}<span id="saveLbl">${post.saved ? 'Unsave post' : 'Save post'}</span></button>
        <button class="opt" data-act="report">${ic('flag')} Report</button>
        <button class="opt" data-act="share" data-id="${post.id}">${ic('share')} Share</button></div>
        <div class="card"><h3>Related posts</h3>${related.map(p => `<a class="rel" href="#/post/${p.id}">${thumb(p)}<div><b>${esc((p.content || 'Post').slice(0, 28))}</b><small>@${esc(p.username)} · ${ago(p.created_at)}</small></div></a>`).join('') || '<small>Nothing related yet</small>'}</div></aside></div>`)) return;
    $('#cForm').onsubmit = async e => {
      e.preventDefault();
      const inp = $('#cInput'), content = inp.value.trim(); if (!content) return;
      try {
        const c = await api(`/api/posts/${id}/comments`, { method: 'POST', body: { content } });
        $('#noC')?.remove(); $('#cList').insertAdjacentHTML('beforeend', cmt(c)); inp.value = '';
        $('#cCount').textContent = $$('#cList .comment').length;
        $$('.post .ccount').forEach(s => s.textContent = $$('#cList .comment').length);
      } catch (err) { toast(err.message); }
    };
  },

  async u([username], q, my) {
    if (!username) username = state.me.username;
    const user = await api('/api/users/' + encodeURIComponent(username));
    const joined = new Date(user.created_at.replace(' ', 'T') + 'Z').toLocaleDateString('en', { month: 'long', year: 'numeric' });
    const skills = (user.skills || '').split(',').map(s => s.trim()).filter(Boolean);
    const tabs = ['posts', 'replies', 'media', 'likes'].concat(user.isMe ? ['saved'] : []);
    if (!render(my, `<div class="page wide"><div class="center fade">
      <div class="card pcard"><div class="cover" ${user.cover ? `style="background-image:url('${esc(user.cover)}')"` : ''}></div>
        <div class="pbody">${av(user, 'lg')}
          <div class="pactions">${user.isMe ? `<a class="btn ghost sm" href="#/settings">Edit Profile</a>` :
            `<a class="btn ghost sm" href="#/messages/${esc(user.username)}">Message</a><button class="btn sm ${user.isFollowing ? 'following' : ''}" data-act="follow" data-user="${esc(user.username)}">${user.isFollowing ? 'Following' : 'Follow'}</button>`}</div>
          <h2>${esc(user.name)}</h2><small>@${esc(user.username)}</small>
          ${user.headline ? `<p style="margin-top:6px">${esc(user.headline)}</p>` : ''}
          <div class="meta">${user.location ? `<span>📍 ${esc(user.location)}</span>` : ''}<span>🗓 Joined ${joined}</span></div>
          <div class="stats"><div><b>${user.posts}</b><small>Posts</small></div><div><b id="fCount">${user.followers}</b><small>Followers</small></div><div><b>${user.following}</b><small>Following</small></div></div></div>
        <div class="tabs" id="pTabs">${tabs.map((t, i) => `<button class="tab ${i ? '' : 'active'}" data-tab="${t}">${t[0].toUpperCase() + t.slice(1)}</button>`).join('')}</div></div>
      <div id="pContent"></div></div>
      <aside class="right">
        <div class="card"><h3>About me ${user.isMe ? '<a class="more" href="#/settings">Edit</a>' : ''}</h3><p style="white-space:pre-wrap">${esc(user.bio) || '<small>No bio yet.</small>'}</p></div>
        ${skills.length ? `<div class="card"><h3>Skills</h3><div class="chips">${skills.map(s => `<span class="skill">${esc(s)}</span>`).join('')}</div></div>` : ''}
        ${user.activity && user.activity.length ? `<div class="card"><h3>Recent activity</h3>${user.activity.map(x => `<div class="person">${av(user, 'xs')}<div><small style="color:var(--text)">${esc(x.text)}</small><small style="display:block">${ago(x.created_at)} ago</small></div></div>`).join('')}</div>` : ''}
      </aside></div>`)) return;
    async function loadTab(tab) {
      $$('#pTabs .tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
      const box = $('#pContent'); box.innerHTML = '<div class="loader"></div>';
      let items;
      try { items = await api(`/api/users/${encodeURIComponent(user.username)}/posts?tab=${tab}`); } catch (e) { items = []; }
      if (!$('#pContent')) return;
      if (!items.length) { $('#pContent').innerHTML = '<div class="card empty">Nothing here yet.</div>'; return; }
      $('#pContent').innerHTML = tab === 'replies'
        ? `<div class="card">${items.map(r => `<a class="reply" href="#/post/${r.post_id}">${esc(r.content)}<small>on @${esc(r.post_user)}'s post · ${ago(r.created_at)}</small></a>`).join('')}</div>`
        : `<div class="card"><div class="grid">${items.map(tile).join('')}</div></div>`;
    }
    $('#pTabs').onclick = e => { const t = e.target.closest('.tab'); if (t) loadTab(t.dataset.tab); };
    loadTab('posts');
  },

  async profile(a, q, my) { return VIEWS.u([state.me.username], q, my); },

  async notifications(a, q, my) {
    const list = await api('/api/notifications');
    const txt = { like: 'liked your post', comment: 'commented on your post', follow: 'started following you' };
    if (!render(my, `<div class="page single"><div class="card fade"><h3>Notifications</h3>${list.map(n =>
      `<a class="notif ${n.is_read ? '' : 'unread'}" href="${n.post_id ? '#/post/' + n.post_id : '#/u/' + esc(n.username)}">${av(n, 'sm')}<div><b>${esc(n.name)}</b> ${txt[n.type] || 'interacted with you'}<small style="display:block">${ago(n.created_at)} ago</small></div></a>`).join('') || '<div class="empty">No notifications yet 🔔</div>'}</div></div>`)) return;
    if (list.some(n => !n.is_read)) { await api('/api/notifications/read', { method: 'POST' }); refreshBadge(0); }
  },

  async messages([u], q, my) {
    const [convs, following] = await Promise.all([api('/api/messages'), api('/api/following')]);
    const data = u ? await api('/api/messages/' + encodeURIComponent(u)) : null;
    const convUsers = new Set(convs.map(c => c.username));
    const list = convs.map(c => `<a class="conv ${c.username === u ? 'active' : ''}" href="#/messages/${esc(c.username)}">${av(c, 'sm')}<div><b>${esc(c.name)}</b><small>${esc(c.last)}</small></div></a>`).join('')
      + (following.filter(f => !convUsers.has(f.username)).length ? `<small style="display:block;margin:12px 6px 4px">Start a chat</small>` + following.filter(f => !convUsers.has(f.username)).map(f => `<a class="conv ${f.username === u ? 'active' : ''}" href="#/messages/${esc(f.username)}">${av(f, 'sm')}<div><b>${esc(f.name)}</b><small>@${esc(f.username)}</small></div></a>`).join('') : '');
    const bubbles = ms => ms.map(m => `<div class="bubble ${m.mine ? 'mine' : ''}">${esc(m.content)}</div>`).join('') || '<div class="empty">Say hi 👋</div>';
    const threadHTML = data ? `<div class="chathead"><a class="icon mback" href="#/messages">${ic('back')}</a><a class="row gap" style="color:var(--text)" href="#/u/${esc(data.user.username)}">${av(data.user, 'sm')}<b>${esc(data.user.name)}</b></a></div>
      <div class="thread" id="thread">${bubbles(data.messages)}</div>
      <form class="cform" id="mForm"><input id="mInput" placeholder="Type a message..." autocomplete="off" maxlength="1000"><button aria-label="Send">${ic('send')}</button></form>`
      : '<div class="empty" style="margin:auto">Select a conversation to start chatting 💬</div>';
    if (!render(my, `<div class="page" style="grid-template-columns:minmax(0,900px)"><div class="chat ${u ? 'has-thread' : ''}">
      <div class="card convs chat-scroll"><h3>Messages</h3>${list || '<div class="empty">Follow people to start chatting.</div>'}</div>
      <div class="card threadbox">${threadHTML}</div></div></div>`)) return;
    if (!data) return;
    const th = $('#thread'); th.scrollTop = th.scrollHeight;
    let count = data.messages.length;
    $('#mForm').onsubmit = async e => {
      e.preventDefault();
      const inp = $('#mInput'), content = inp.value.trim(); if (!content) return;
      inp.value = '';
      try {
        const m = await api('/api/messages/' + encodeURIComponent(u), { method: 'POST', body: { content } });
        if (!count) th.innerHTML = '';
        th.insertAdjacentHTML('beforeend', `<div class="bubble mine">${esc(m.content)}</div>`); count++;
        th.scrollTop = th.scrollHeight;
      } catch (err) { toast(err.message); }
    };
    state.poll = setInterval(async () => {
      const t = $('#thread'); if (!t) return;
      try {
        const d = await api('/api/messages/' + encodeURIComponent(u));
        if (d.messages.length !== count) { count = d.messages.length; t.innerHTML = bubbles(d.messages); t.scrollTop = t.scrollHeight; }
      } catch { /* ignore */ }
    }, 4000);
  },

  async settings(a, q, my) {
    const m = state.me;
    if (!render(my, `<div class="page single"><div class="fade"><div class="card"><h3>Edit profile</h3>
      <form id="setForm">
        <label>Full name<input name="name" value="${esc(m.name)}" maxlength="50" required></label>
        <label>Headline<input name="headline" value="${esc(m.headline)}" maxlength="100" placeholder="e.g. Computer Engineering Student"></label>
        <label>Location<input name="location" value="${esc(m.location)}" maxlength="60" placeholder="City, Country"></label>
        <label>About me<textarea name="bio" rows="4" maxlength="400">${esc(m.bio)}</textarea></label>
        <label>Skills (comma separated)<input name="skills" value="${esc(m.skills)}" maxlength="200" placeholder="HTML, CSS, JavaScript"></label>
        <label>Profile photo<input type="file" name="avatar" accept="image/*"></label>
        <label>Cover photo<input type="file" name="cover" accept="image/*"></label>
        <button class="btn">Save changes</button></form></div>
      <div class="card"><h3>Preferences</h3>
        <button class="opt" data-act="theme">${ic('moon')} Toggle dark / light mode</button>
        <button class="opt" data-act="logout" style="color:var(--danger)">${ic('logout')} Log out</button></div></div></div>`)) return;
    $('#setForm').onsubmit = async e => {
      e.preventDefault();
      const btn = $('.btn', e.target); btn.disabled = true;
      try {
        state.me = await api('/api/me', { method: 'PUT', form: new FormData(e.target) });
        paintMe(); toast('Profile updated ✨'); location.hash = '#/profile';
      } catch (err) { toast(err.message); }
      btn.disabled = false;
    };
  }
};

/* ---------- global events ---------- */
const closeMenus = () => $$('.dropdown').forEach(d => d.classList.add('hidden'));
async function copyLink(id) {
  const url = location.origin + location.pathname + '#/post/' + id;
  try { if (navigator.share && matchMedia('(pointer:coarse)').matches) await navigator.share({ url }); else { await navigator.clipboard.writeText(url); toast('Link copied 🔗'); } }
  catch { toast(url); }
}

document.addEventListener('click', async e => {
  const at = e.target.closest('[data-authtab]');
  if (at) { e.preventDefault(); authTab(at.dataset.authtab); return; }
  const eye = e.target.closest('[data-eye]');
  if (eye) { const i = eye.previousElementSibling; i.type = i.type === 'password' ? 'text' : 'password'; eye.textContent = i.type === 'password' ? 'Show' : 'Hide'; return; }

  const b = e.target.closest('[data-act]');
  if (!b || b.dataset.act !== 'menu') {
    if (!e.target.closest('.dropdown')) closeMenus(); else if (b) closeMenus();
  }
  if (!b) return;
  if (b.tagName === 'A' && b.getAttribute('href') === '#') e.preventDefault();
  const act = b.dataset.act;
  const card = b.closest('.post');
  const pid = (card && card.dataset.id) || b.dataset.id;
  try {
    switch (act) {
      case 'menu': { const dd = b.nextElementSibling, open = !dd.classList.contains('hidden'); closeMenus(); if (!open) dd.classList.remove('hidden'); break; }
      case 'open': if (e.target.closest('a')) break; location.hash = '#/post/' + pid; break;
      case 'back': if (history.length > 1) { e.preventDefault(); history.back(); } break;
      case 'like': {
        const d = await api(`/api/posts/${pid}/like`, { method: 'POST' });
        $$(`.post[data-id="${pid}"] .act.like`).forEach(x => { x.classList.toggle('on', d.liked); $('span', x).textContent = d.likes; if (d.liked) { x.classList.add('pop'); setTimeout(() => x.classList.remove('pop'), 300); } });
        break;
      }
      case 'save': {
        const d = await api(`/api/posts/${pid}/save`, { method: 'POST' });
        $$(`.post[data-id="${pid}"] .act.save`).forEach(x => x.classList.toggle('on', d.saved));
        $$(`.post[data-id="${pid}"] .dropdown [data-act=save]`).forEach(x => x.lastChild.textContent = d.saved ? ' Unsave post' : ' Save post');
        const l = $('#saveLbl'); if (l) l.textContent = d.saved ? 'Unsave post' : 'Save post';
        toast(d.saved ? 'Saved to your collection 🔖' : 'Removed from saved');
        break;
      }
      case 'copy': case 'share': copyLink(pid); break;
      case 'report': toast('Thanks for reporting. We will review this post.'); break;
      case 'delete':
        if (!confirm('Delete this post permanently?')) break;
        await api('/api/posts/' + pid, { method: 'DELETE' });
        if (location.hash.startsWith('#/post/')) location.hash = '#/home'; else card.remove();
        toast('Post deleted');
        break;
      case 'follow': {
        const user = b.dataset.user;
        const d = await api(`/api/users/${encodeURIComponent(user)}/follow`, { method: 'POST' });
        $$(`[data-act=follow][data-user="${user}"]`).forEach(x => { x.textContent = d.following ? 'Following' : 'Follow'; x.classList.toggle('following', d.following); });
        const fc = $('#fCount'); if (fc && location.hash.toLowerCase().endsWith('/' + user.toLowerCase())) fc.textContent = d.followers;
        toast(d.following ? `You're now following @${user}` : `Unfollowed @${user}`);
        break;
      }
      case 'cLike': {
        const d = await api(`/api/comments/${b.dataset.cid}/like`, { method: 'POST' });
        b.classList.toggle('on', d.liked); $('span', b).textContent = d.likes; break;
      }
      case 'reply': { const i = $('#cInput'); if (i) { i.value = `@${b.dataset.user} `; i.focus(); } break; }
      case 'feel': $('#cEmo').classList.toggle('hidden'); break;
      case 'emoji': { const t = $('#cText'); t.value += b.textContent; t.focus(); break; }
      case 'rmMedia': state.clearMedia && state.clearMedia(); break;
      case 'story': await openStory(b.dataset.user); break;
      case 'msearch': document.body.classList.toggle('mobile-search'); $('#searchInput').focus(); break;
      case 'theme': applyTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'); break;
      case 'logout': logout(); break;
      case 'forgot': toast('Password reset is not available in this demo.'); break;
      case 'social': toast('Social login is a demo placeholder. Use email & password.'); break;
    }
  } catch (err) { toast(err.message); }
});

$('#themeBtn').addEventListener('click', () => applyTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'));
$('#searchForm').addEventListener('submit', e => {
  e.preventDefault();
  const v = $('#searchInput').value.trim();
  document.body.classList.remove('mobile-search');
  location.hash = v ? '#/explore?q=' + encodeURIComponent(v) : '#/explore';
});

/* ---------- boot ---------- */
(async function boot() {
  if (token()) {
    try { state.me = await api('/api/me'); } catch { clearToken(); }
  }
  if (!state.me) return showAuth();
  buildShell(); showApp();
  if (!location.hash) history.replaceState(null, '', '#/home');
  route();
})();
