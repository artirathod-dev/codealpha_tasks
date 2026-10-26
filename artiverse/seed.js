// Demo data so the app looks alive on first run. Delete artiverse.db (npm run reset) to start fresh.
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

const PAL = {
  sunset:    ['#3b2a6e', '#ff9a5a', '#ffd08a', '#5b4a8a', '#3d3566', '#241f45'],
  lake:      ['#7ec8e3', '#e0f4ff', '#fff6c9', '#4f8f7a', '#2e6b5b', '#1d4a40'],
  mountains: ['#9fc5ff', '#e8f1ff', '#ffffff', '#6f86a8', '#4d6280', '#2f4058'],
  flowers:   ['#ffd1e8', '#fff3d6', '#ffe27a', '#8fcf8a', '#5fae6a', '#3f8a4f'],
  night:     ['#0b1030', '#3a2a7a', '#f3f0ff', '#2a2f6b', '#1c2150', '#10143a'],
  forest:    ['#c8f2d0', '#f2ffe8', '#fff8b0', '#3f9a62', '#2b7a4d', '#1b5a3a']
};

function scene(c, sx = 560, sy = 330) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600"><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${c[0]}"/><stop offset="1" stop-color="${c[1]}"/></linearGradient></defs><rect width="800" height="600" fill="url(#g)"/><circle cx="${sx}" cy="${sy}" r="70" fill="${c[2]}" opacity=".92"/><path d="M0 420 L150 300 L260 380 L400 250 L560 400 L700 310 L800 400 V600 H0Z" fill="${c[3]}"/><path d="M0 480 L120 400 L260 470 L420 360 L600 480 L720 420 L800 470 V600 H0Z" fill="${c[4]}"/><path d="M0 540 L200 480 L400 540 L620 470 L800 530 V600 H0Z" fill="${c[5]}"/></svg>`;
}

module.exports = function seed(db, uploadDir) {
  if (db.prepare('SELECT COUNT(*) c FROM users').get().c > 0) return;
  console.log('Seeding demo data...');

  const files = {};
  Object.keys(PAL).forEach((k, i) => {
    const f = `seed-${k}.svg`;
    fs.writeFileSync(path.join(uploadDir, f), scene(PAL[k], 300 + i * 70, 300 + (i % 3) * 30));
    files[k] = '/uploads/' + f;
  });

  const hash = bcrypt.hashSync('arti123', 8);
  const users = [
    ['arti_rathod', 'arti@example.com', 'Arti Rathod', 'Computer Engineering Student | Dreaming Big ✨', 'Just a girl who loves coding, exploring new things and building a better future.\n\nKeep going, you\'re doing great! 💜', 'HTML, CSS, JavaScript, Express.js, MongoDB, C++, Problem Solving, Teamwork', 'Pune, India'],
    ['riya_sharma', 'riya@example.com', 'Riya Sharma', 'Travel & sunsets', 'Chasing golden hours.', 'Photography, Travel', 'Mumbai, India'],
    ['neha_patel', 'neha@example.com', 'Neha Patel', 'Nature lover', 'Plants, trails and tea.', 'Hiking, Gardening', 'Surat, India'],
    ['aman_verma', 'aman@example.com', 'Aman Verma', 'Weekend explorer', 'Always up for a road trip.', 'Cycling, Maps', 'Delhi, India'],
    ['sneha_joshi', 'sneha@example.com', 'Sneha Joshi', 'Designer', 'Colors, layouts and coffee.', 'Figma, UI Design', 'Pune, India'],
    ['karan_mehta', 'karan@example.com', 'Karan Mehta', 'Developer', 'Building things on the web.', 'Node.js, React', 'Bengaluru, India'],
    ['techworld', 'tech@example.com', 'Tech World', 'Tech news & tips', 'The future is built with code.', 'AI, Web, Cloud', 'Internet'],
    ['nature_lover', 'nature@example.com', 'Nature Lover', 'Outdoors', 'Nature is the best therapy.', 'Photography', 'Himalayas'],
    ['travel_diaries', 'travel@example.com', 'Travel Diaries', 'Wander often', 'Mountains are calling.', 'Travel', 'Everywhere'],
    ['green_planet', 'green@example.com', 'Green Planet', 'Sustainable living', 'Small steps, big change.', 'Eco', 'Earth']
  ];
  const insU = db.prepare('INSERT INTO users(username,email,password,name,headline,bio,skills,location,created_at) VALUES(?,?,?,?,?,?,?,?,?)');
  users.forEach(u => insU.run(u[0], u[1], hash, u[2], u[3], u[4], u[5], u[6], '2025-05-12 10:00:00'));
  const id = n => db.prepare('SELECT id FROM users WHERE username=?').get(n).id;

  const posts = [
    ['riya_sharma', 'Good vibes only ✨ #GoodVibes #Sunset', 'sunset', 120],
    ['techworld', 'The future is built with code 💻 #Tech #Coding', 'night', 240],
    ['nature_lover', 'Nature is the best therapy 💚 #Nature #NatureLover', 'lake', 300],
    ['travel_diaries', 'Mountains are calling… #Mountains #Travel', 'mountains', 420],
    ['green_planet', 'Somewhere in nature 🌸 #Nature #Photography', 'flowers', 500],
    ['neha_patel', 'Nature heals 💚 Morning hike done! #Nature #Travel', 'forest', 600],
    ['aman_verma', 'Sunset lovers unite 🌇 #Sunset #Photography', 'sunset', 700],
    ['arti_rathod', 'Finished my first full-stack project today! 🚀 #StudentLife #Coding', 'night', 60],
    ['sneha_joshi', 'Color palette inspiration for this week 🎨 #Design', null, 800],
    ['karan_mehta', 'Express + SQLite is such a fun combo for mini projects. #Tech', null, 900]
  ];
  const insP = db.prepare("INSERT INTO posts(user_id,content,image,created_at) VALUES(?,?,?,datetime('now',?))");
  posts.forEach(p => insP.run(id(p[0]), p[1], p[2] ? files[p[2]] : null, `-${p[3]} minutes`));

  const follow = db.prepare('INSERT OR IGNORE INTO follows(follower_id,following_id) VALUES(?,?)');
  ['riya_sharma', 'techworld', 'nature_lover', 'travel_diaries'].forEach(n => follow.run(id('arti_rathod'), id(n)));
  ['riya_sharma', 'neha_patel', 'aman_verma', 'sneha_joshi', 'karan_mehta', 'techworld'].forEach(n => follow.run(id(n), id('arti_rathod')));
  follow.run(id('neha_patel'), id('riya_sharma'));
  follow.run(id('aman_verma'), id('riya_sharma'));

  const like = db.prepare('INSERT OR IGNORE INTO likes(user_id,post_id) VALUES(?,?)');
  const all = db.prepare('SELECT id FROM posts').all().map(r => r.id);
  users.forEach((u, i) => all.forEach((pid, j) => { if ((i + j) % 3 === 0) like.run(id(u[0]), pid); }));

  const cm = db.prepare('INSERT INTO comments(post_id,user_id,content) VALUES(?,?,?)');
  cm.run(1, id('neha_patel'), 'This view looks so beautiful! 😍');
  cm.run(1, id('aman_verma'), 'Where is this place? Looks amazing!');
  cm.run(8, id('riya_sharma'), 'Congratulations Arti! 🎉');

  const msg = db.prepare('INSERT INTO messages(from_id,to_id,content) VALUES(?,?,?)');
  msg.run(id('riya_sharma'), id('arti_rathod'), 'Hey Arti! Loved your latest post 💜');
  msg.run(id('arti_rathod'), id('riya_sharma'), 'Thank you Riya! 😊');

  db.prepare('INSERT INTO notifications(user_id,actor_id,type,post_id) VALUES(?,?,?,?)').run(id('arti_rathod'), id('riya_sharma'), 'comment', 8);
  db.prepare('INSERT INTO notifications(user_id,actor_id,type,post_id) VALUES(?,?,?,?)').run(id('arti_rathod'), id('neha_patel'), 'follow', null);
  db.prepare('INSERT INTO notifications(user_id,actor_id,type,post_id) VALUES(?,?,?,?)').run(id('arti_rathod'), id('aman_verma'), 'like', 8);
  const act = db.prepare("INSERT INTO activity(user_id,text,created_at) VALUES(?,?,datetime('now',?))");
  act.run(id('arti_rathod'), 'You updated your profile photo', '-2 hours');
  act.run(id('arti_rathod'), 'You followed Riya Sharma', '-5 hours');
  console.log('Demo login -> email: arti@example.com  password: arti123');
};
