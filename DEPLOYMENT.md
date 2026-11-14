# Deploying HoopVision CV to GitHub Pages ($0/month)

All computer vision tracking, HSV masking, live camera streaming, video uploads, and parabolic trajectory physics run 100% client-side in the browser. No backend server, database, or API keys are required.

---

## 1. Local Build Commands

Verify and build the static bundle (`dist/`, including `dist/404.html` for SPA refresh support):

```bash
npm install
npm run build
```

You can preview the production static build locally with:

```bash
npm run preview
```

---

## 2. Overwrite `lxtrvn/Basketball-Shot-Coach` & Deploy via GitHub Actions

This repository includes `.github/workflows/deploy.yml`, which automatically builds and deploys `dist/` whenever `main` is updated.

### Terminal Commands (inside the exported project folder)

```bash
git init
git add .
git commit -m "Deploy static HoopVision CV to GitHub Pages"
git branch -M main
git remote add origin https://github.com/lxtrvn/Basketball-Shot-Coach.git
git push --force -u origin main
```

### GitHub Repository Settings

1. Open **https://github.com/lxtrvn/Basketball-Shot-Coach/settings/pages**.
2. Under **Build and deployment** → **Source**, select **GitHub Actions**.
3. Wait ~1 minute for the **Deploy to GitHub Pages** workflow under the **Actions** tab to finish; your site will be live at **`https://lxtrvn.github.io/Basketball-Shot-Coach/`**.

---

## 3. Alternative — Manual Deployment via `gh-pages` Branch

If you prefer deploying the built `dist/` folder directly to a `gh-pages` branch without GitHub Actions:

```bash
npm install
npm run build
npx gh-pages -d dist
```

Then in GitHub **Settings → Pages**:
1. Set **Source** to **Deploy from a branch**.
2. Set the branch to **`gh-pages`** and folder to **`/ (root)`**, then click **Save**.
