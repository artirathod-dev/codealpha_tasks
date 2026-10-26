# Artiverse - Mini Social Media Platform

Connect · Create · Share. A full-stack mini social network built to match the Artiverse UI design
(Home feed, Profile, Post detail + comments, Search/Explore, Login/Sign Up, Mobile view, Dark mode).

**Stack:** HTML + CSS + vanilla JavaScript (frontend) · Node.js + Express.js (backend) · SQLite (database, no DB server to install)

## Run it (3 steps)
1. Install Node.js 18+ from https://nodejs.org
2. Open this folder in VS Code, open the terminal and run:
   ```
   npm install
   npm start
   ```
3. Open http://localhost:3000

**Demo login:** `arti@example.com` / `arti123` (demo users and posts are created automatically on first run)

## Features
- Register / login (JWT + bcrypt), "remember me", show/hide password, logout
- User profiles: cover + avatar upload, headline, bio, skills, location, stats, Posts / Replies / Media / Likes / Saved tabs, recent activity
- Posts with text, photos, videos, emoji "Feeling" picker, #hashtags and @mentions that link; delete your own posts
- Comments (with comment likes and Reply), post detail page, related posts
- Like / unlike, save / unsave, follow / unfollow (updates live everywhere), share (copy link)
- Stories bar with full-screen story viewer (uses followed users' photo posts)
- Explore + search (All / Users / Posts / Hashtags tabs), trending hashtags, who-to-follow
- Notifications (likes, comments, follows) with live unread badge
- Direct messages with auto-refresh
- Dark mode toggle, fully responsive (desktop sidebar, tablet icon rail, mobile bottom navigation)

## Database tables
`users`, `posts`, `comments`, `likes`, `comment_likes`, `follows`, `saves`, `notifications`, `messages`, `activity`
(file: `artiverse.db`, created automatically).

## Project structure
```
artiverse/
├── server.js        Express server + REST API
├── db.js            SQLite schema
├── seed.js          Demo data
├── package.json
└── public/          Frontend
    ├── index.html
    ├── css/style.css
    ├── js/app.js    (single-page app, hash routing)
    └── uploads/     User-uploaded images & videos
```

## Useful commands
- `npm run dev` - restart automatically when you edit server files
- `npm run reset` - delete the database (demo data is re-created on next start)
- Start with an empty database: set the environment variable `SEED=false` before `npm start`
- Change port: set `PORT=4000`. For deployment set a strong `JWT_SECRET` environment variable.

## Troubleshooting
- `npm install` fails on better-sqlite3: use Node.js LTS (18/20/22).
- Port already in use: run with a different `PORT`.
