# TaskFlow — PWA (for PWABuilder → Google Play)

This is your TaskFlow app converted into a proper **installable PWA**:
same design, same task logic, plus:

- `manifest.json` — name, icons, colors, tells the browser/OS it's installable
- `service-worker.js` — caches the static app shell so it loads instantly
- `icons/` — 192px & 512px icons (regular + maskable, as Play requires)

**Update:** this version now talks to a real backend with per-user accounts
(see the separate `TaskFlowBackend` project) instead of `localStorage`.
That means:
- You need to deploy `TaskFlowBackend` to Railway first (its own README
  walks through that) and set `API_BASE_URL` in `index.html` to your
  Railway URL before this frontend will work.
- The app now requires an internet connection to log in and load/save
  tasks — the offline cache only speeds up loading the app shell, not your
  task data.
- Tasks are private per account (email + password), so different people
  signing in on the same device or the same person on multiple devices
  each see the right data.

## Overview of the whole path

```
Your files → hosted on HTTPS → PWABuilder scans it → generates a signed
Android package (.aab) → upload to Google Play Console → published
```

You need a **live HTTPS URL** before PWABuilder can do anything — it works
by scanning a real, deployed site, not local files. The easiest free way is
GitHub Pages, using the same GitHub account from before.

---

## Step 1 — Host the PWA on GitHub Pages (free, HTTPS by default)

1. Unzip `TaskFlowPWA.zip`.
2. Create a new GitHub repo (or reuse one) — e.g. `taskflow-pwa`.
3. Upload the **contents** of the `TaskFlowPWA` folder to the repo root
   (`index.html`, `manifest.json`, `service-worker.js`, `style.css`,
   `script.js`, `icons/`, `.nojekyll`).
4. In the repo: **Settings → Pages**.
   - Under "Build and deployment" → Source: **Deploy from a branch**.
   - Branch: `main`, folder: `/ (root)` → **Save**.
5. Wait ~1 minute, then refresh — GitHub shows your live URL, something like:
   `https://yourusername.github.io/taskflow-pwa/`
6. Open that URL on your phone or in Chrome desktop and confirm the app
   loads normally. Optional sanity check: Chrome DevTools → **Application**
   tab → Manifest (should show your icons/name) and Service Workers
   (should show "activated and running").

Keep that URL — you'll paste it into PWABuilder next.

---

## Step 2 — Generate the Android package with PWABuilder

1. Go to **https://www.pwabuilder.com**.
2. Paste your GitHub Pages URL into the box and click **Start**.
3. PWABuilder scans the site and shows a report card for Manifest, Service
   Worker, and Security (HTTPS). You want to see mostly green checks — this
   template is set up to pass all three out of the box.
4. Click **Package for Stores** → choose **Android**.
5. On the Android package options screen:
   - **Package ID**: reverse-domain style, e.g. `com.yourname.taskflow`
     (this becomes your app's permanent unique ID on Play — choose
     carefully, it can't be changed later).
   - **App name**: TaskFlow (or whatever you'd like shown on Play).
   - **Signing key**: choose **"Generate new signing key"** if this is your
     first Android app. PWABuilder will create it for you.
     ⚠️ Download and safely back up the generated `.keystore`/signing info
     it gives you — you need the *same* key for every future update of this
     app. Losing it means you can never update the app again, only publish
     a new listing.
   - Leave the rest at defaults unless you know you want to change them.
6. Click **Generate**. PWABuilder builds a `.zip` containing:
   - `app-release-signed.aab` (or `.apk`) — the file you upload to Play
   - `assetlinks.json` — proves to Android that your website and app are
     the same publisher (needed so the app opens without a browser address
     bar, as a proper TWA)
   - Your signing key info

## Step 3 — Verify domain ownership (Digital Asset Links)

This step is what makes the installed app open full-screen instead of
looking like a browser window with a URL bar.

1. From the PWABuilder download, take `assetlinks.json`.
2. In your GitHub Pages repo, create a folder path exactly:
   `.well-known/assetlinks.json` and put that file there (upload via
   GitHub's web UI — you can create a file at that path directly by typing
   `.well-known/assetlinks.json` as the filename when adding a new file).
3. Commit it. After GitHub Pages redeploys (~1 min), confirm it's reachable
   at: `https://yourusername.github.io/taskflow-pwa/.well-known/assetlinks.json`

If this file isn't reachable, the installed app will still work but will
show a browser-style address bar at the top — not a dealbreaker, just not
as polished.

---

## Step 4 — Publish to Google Play

1. Sign up for a **Google Play Developer account** at
   `play.google.com/console` — one-time **$25** registration fee, plus
   identity verification (can take a day or two the first time).
2. In Play Console: **Create app** → fill in name (TaskFlow), language,
   app or game → App, Free or Paid.
3. Go through the required setup sections in the left sidebar (Play
   Console won't let you publish until all show green):
   - **Store listing**: description, screenshots (take a few from your
     phone or Chrome device toolbar in different sizes), app icon
     (`icons/icon-512.png`), feature graphic (1024×500 — you'll need to
     make this one separately, e.g. in Canva).
   - **Content rating**: fill out the questionnaire (a simple task manager
     will rate very low/everyone).
   - **Target audience**, **Data safety**: TaskFlow only stores tasks
     locally on-device (no data collection, no accounts), so these
     sections are quick — answer accordingly.
   - **App content**: privacy policy URL is required even for a simple
     app — a free one-page policy (e.g. via a free generator, or just a
     short page you host on the same GitHub Pages site) stating you don't
     collect personal data will satisfy this.
4. Go to **Production → Create new release**, upload the
   `app-release-signed.aab` from PWABuilder.
5. Submit for review. Google typically reviews within a few hours to a
   couple of days for simple apps.

---

## After publishing — updating the app later

1. Make changes to `index.html` / `style.css` / `script.js`.
2. Push the updated files to the same GitHub repo (Pages redeploys
   automatically).
3. Go back to PWABuilder, regenerate the Android package — **reuse the
   same signing key** you downloaded in Step 2 (PWABuilder lets you upload
   your existing `.keystore` instead of generating a new one).
4. In Play Console: **Production → Create new release**, upload the new
   `.aab`, submit.

---

## Notes

- This whole path (GitHub Pages + PWABuilder) costs nothing except Google's
  one-time $25 developer registration.
- If you'd rather not deal with Play Console at all yet, everything through
  Step 2 already gives you an installable app: visiting the GitHub Pages
  URL in Chrome on Android shows an "Install app" prompt that adds it to
  the home screen, no Play Store needed.
