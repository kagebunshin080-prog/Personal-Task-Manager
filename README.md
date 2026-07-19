# TaskFlow Backend (Node.js + Express + Postgres)

A small REST API providing account signup/login and per-user tasks, meant
to be deployed on **Railway** and called by your TaskFlow frontend.

## What it does

- `POST /api/auth/register` — create an account `{ email, password }`
- `POST /api/auth/login` — log in, returns a JWT `{ email, password }`
- `GET /api/tasks` — list your tasks (requires `Authorization: Bearer <token>`)
- `POST /api/tasks` — create a task
- `PUT /api/tasks/:id` — update a task (e.g. change status)
- `DELETE /api/tasks/:id` — delete a task
- `GET /api/health` — health check (used by Railway)

Every task is tied to the `user_id` of whoever created it — that's what
makes accounts separate. Passwords are hashed with bcrypt; nothing is
stored in plain text.

---

## Deploy to Railway

### 1. Push this folder to GitHub

Create a new repo (e.g. `taskflow-backend`) and upload the contents of
this `TaskFlowBackend` folder to it (same GitHub upload process you've
used before). Don't upload `node_modules` — the `.gitignore` already
excludes it.

### 2. Create the Railway project

1. Go to **railway.app**, sign up/log in (GitHub login is easiest).
2. **New Project → Deploy from GitHub repo** → pick `taskflow-backend`.
3. Railway detects it's a Node app automatically (via `package.json`) and
   starts building/deploying it.

### 3. Add a Postgres database

1. In your Railway project, click **+ New → Database → Add PostgreSQL**.
2. That's it — Railway automatically creates a `DATABASE_URL` variable and
   makes it available to your backend service. You don't need to configure
   connection details manually; `db/index.js` already reads
   `process.env.DATABASE_URL`.

### 4. Set environment variables

Click your backend service → **Variables** tab → add:

| Variable | Value |
|---|---|
| `JWT_SECRET` | any long random string (see note below) |
| `ALLOWED_ORIGINS` | your frontend's URL, e.g. `https://yourusername.github.io` |

To generate a strong `JWT_SECRET`, run this once on your own computer (or
ask me and I'll generate one for you):
```
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

`DATABASE_URL` and `PORT` are already set automatically by Railway — you
don't need to add those yourself.

### 5. Get your public API URL

Click your backend service → **Settings → Networking → Generate Domain**.
Railway gives you a public URL like:
```
https://taskflow-backend-production.up.railway.app
```

That's the URL your frontend will call. Test it's alive by visiting:
```
https://taskflow-backend-production.up.railway.app/api/health
```
You should see `{"status":"ok"}`.

### 6. Point your frontend at it

In `script.js` on the frontend, set:
```js
const API_BASE_URL = "https://taskflow-backend-production.up.railway.app/api";
```
(This is already wired up in the updated `TaskFlowPWA` — see its README for
exactly where.)

---

## Updating the backend later

Push new commits to the same GitHub repo — Railway automatically rebuilds
and redeploys. The database persists across deploys; you only lose data if
you explicitly delete the Postgres plugin.

## Local development (optional)

```
npm install
cp .env.example .env   # fill in a local DATABASE_URL and JWT_SECRET
npm start
```
Needs a local or remote Postgres instance to connect to.
