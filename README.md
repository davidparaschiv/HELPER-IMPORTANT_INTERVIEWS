# Interview Helper — Firebase + GitHub Pages

A mobile-first Vite app for Docker, Kubernetes, Helm, and AWS interview cards. Questions are stored in Cloud Firestore, so add/edit/remove changes appear on every device.

## 1. Firebase setup

1. Open Firebase Console and select `interview-helper-me`.
2. Go to **Build → Firestore Database → Create database**.
3. Choose a region and create the database.
4. Open **Firestore Database → Rules** and publish the contents of `firestore.rules`.

> The included rules allow public reads and writes so the app works immediately. This is suitable only for a personal/test app. Anyone who can access the site can modify the cards. Add authentication and stricter rules before sharing it widely.

The app uses the collection:

```text
questions
```

If the collection is empty, the app automatically imports `public/questions.json` on first load.

## 2. Run locally

```bash
npm install
npm run dev
```

Open the address shown by Vite, normally `http://localhost:5173`.

## 3. Build locally

```bash
npm run build
npm run preview
```

## 4. Deploy to GitHub Pages

The project is configured for:

```text
https://davidparaschiv.github.io/HELPER-IMPORTANT_INTERVIEWS/
```

Push all files to the repository. Then open:

```text
GitHub repository → Settings → Pages → Source → GitHub Actions
```

The workflow in `.github/workflows/deploy.yml` builds and deploys the `dist` directory after pushes to either `master` or `main`.

## Important files

- `src/firebase.js` — your Firebase web configuration
- `src/main.js` — Firestore CRUD and study-card behavior
- `src/style.css` — mobile-first white/red glass design
- `public/questions.json` — starter data imported only when Firestore is empty
- `vite.config.js` — GitHub Pages repository base path
- `firestore.rules` — Firestore access rules
