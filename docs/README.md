# PixDock 90s Retro Docs Site

This directory contains the documentation site for [PixDock](https://github.com/stormixus/pixdock), built using [Astro](https://astro.build) with a glorious 90s retro aesthetic! 📟

## 🚀 Features

- 💾 **Pure 90s Web Aesthetic:** CRT scanlines, neon glowing text, and pixel-perfect framing.
- 🚦 **Nostalgic Elements:** Hit counters, `<marquee>` banners, `<blink>` tags, and MIDI player UI.
- ⚡ **Astro Powered:** Blazing fast static site generation.

## 🧞 Project Structure

```text
docs/
├── public/                 # Static assets (images, fonts, icons)
├── src/
│   ├── components/         # 90s Retro specific components (HitCounter, BlinkText, AsciiArt)
│   ├── layouts/            # RetroLayout.astro with CRT frames and GeoCities footers
│   ├── pages/              # Astro pages (index, features, install, etc.)
│   └── styles/             # Global 90s CSS (retro.css)
├── astro.config.mjs        # Astro builder & GitHub Pages configuration
└── package.json
```

## 🛠️ Commands

All commands are run from the `docs/` directory:

| Command                   | Action                                           |
| :------------------------ | :----------------------------------------------- |
| `npm install`             | Installs dependencies                            |
| `npm run dev`             | Starts local dev server at `localhost:4321`      |
| `npm run build`           | Build your production site to `./dist/`          |
| `npm run preview`         | Preview your build locally, before deploying     |

## 🚀 Deployment

This site is automatically deployed to GitHub pages via the `.github/workflows/pages.yml` file on merge to the `main` branch.

All links and resources are set up to properly resolve under the `/pixdock/` base path config.
