# ST---LoreBotPush

# Push Bot — Character & Lorebook Push (One‑Way Distribution)

This repo packages **Push Bot** in the supported SillyTavern architecture:

- ✅ **UI Extension** (installable via SillyTavern’s built‑in extension installer)
- ✅ **Server Plugin** (adds the required backend endpoints)

It implements the **one‑way** distribution model described in your guide:

- **Admin → users** (push / bulk push)
- **Non‑admin creator → admins only** (server‑enforced)
- Pushes **a lorebook and the characters bound to it** (`character.data.extensions.world`)
- Re‑push **overwrites** the recipient copies (does **not** touch chats/memories)

## What gets installed where

### 1) UI extension (this repo root)
Files at repo root (`manifest.json`, `index.js`, `style.css`) are the UI extension.

### 2) Server plugin
The plugin lives here:

```
server-plugin/pushbot/index.mjs
```

---

## Installation (for people who don’t already have Push Bot)

### Step A — Install the **server plugin** (required)
1. Copy the folder `server-plugin/pushbot` into:
   ```
   <SillyTavern>/plugins/pushbot
   ```
2. In `<SillyTavern>/config.yaml`, ensure:
   ```yaml
   enableServerPlugins: true
   ```
3. Restart SillyTavern.

### Step B — Install the **UI extension** (built‑in installer)
1. In SillyTavern: **Extensions → Install Extension**
2. Paste the GitHub repo URL for this repo, **or** install from ZIP.
3. Enable the extension and hard refresh (Ctrl+Shift+R).

---

## How to publish on GitHub

Recommended setup:

- Keep this repo public (or shareable)
- Create a GitHub Release that includes a zip of the **server plugin folder** for easy download

### Make a plugin zip for Releases
Zip the folder `server-plugin/pushbot` so users can drop it into `<SillyTavern>/plugins/`.

---

## Notes / compatibility

- UI extensions **cannot** add server endpoints. The server plugin is required for fresh installs.
- The server plugin endpoints are under:
  - `POST /api/plugins/pushbot/push`
  - `POST /api/plugins/pushbot/bulk-push`
  - `POST /api/plugins/pushbot/push-notifications`
  - `GET  /api/plugins/pushbot/admin-handles`

---

## License
Add a license file if you want explicit usage terms.
