# Will Murphy's Journey

A personal site: a scrolling vintage map that follows Iowa → Austin → Waco → Houston, plus Interests and Accomplishments pages.

## Where to edit

| What | File |
|---|---|
| The desk (home page) and the panel text for each object | `index.html` (each panel is an `<article class="panel">`) |
| The 3D desk island: objects, lighting, camera flights | `js/desk3d.js`, `css/desk.css` |
| The globe (dots, coastlines, colors) | `js/globe.js` (map outlines in `assets/data/`) |
| Timeline text, dates, highlights, globe pins | `js/data.js` (shown on `journey.html`, run by `js/journey3d.js`) |
| LinkedIn/Substack links | search all `.html` files for `linkedin.com` / `substack.com` |
| App icon and home-screen settings | `assets/icons/`, `manifest.webmanifest` (regenerate icons with `tools/make_icons.py`) |
| Interests | `interests.html` |
| Projects, Substack, awards | `accomplishments.html` |
| Colors and fonts | top of `css/styles.css` |
| Résumé | save your PDF as `assets/Will-Murphy-Resume.pdf` |
| Photos | put them in `assets/photos/` and add `image: 'assets/photos/name.jpg'` to a highlight |

Anything in `[brackets]` is a placeholder.

## Putting it online (free, with GitHub Pages)

1. Create a GitHub account, then a new **public** repository (for example `will-murphy-journey`).
2. Upload everything in this folder to it ("Add file → Upload files", then drag the folder contents in).
3. In the repo go to **Settings → Pages**, set Source to "Deploy from a branch", branch `main`, folder `/ (root)`, and click Save.
4. After a minute or two the site is live at `https://YOUR-GITHUB-USERNAME.github.io/will-murphy-journey/`.

To get a custom domain like `willmurphy.com` later, buy it (about $12/yr) and add it under Settings → Pages → Custom domain.
