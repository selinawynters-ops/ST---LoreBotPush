# ST LoreBot Push Patch Bundle 🚀

This repository is a **delivery bundle repo** for DreamTavern/SillyTavern push-system updates.  
It intentionally contains packaged ZIP artifacts, not a full server source tree. It is also really important to understand that if you are not admin or do not have admin privileges, you CANNOT see anyone else but the admin to push your book to. 

## 📦 What's Inside

### 1) `SillyTavern-PushPatch-Package-20260302.zip`
Full-file replacement package containing:

- `public/index.html`
- `public/style.css`
- `public/scripts/world-info.js`
- `src/endpoints/characters.js`
- `src/endpoints/worldinfo.js`
- `README.md` (implementation + rollout guide)

Use this ZIP when you want a straightforward file-copy install.

### 2) `SillyTavern-PushPatch-Patches-20260302.zip`
Patch-only package containing:

- `patches/00-all-changes.patch` (all changes in one patch)
- `patches/01-public-index-html.patch`
- `patches/02-public-style-css.patch`
- `patches/03-public-scripts-world-info-js.patch`
- `patches/04-src-endpoints-characters-js.patch`
- `patches/05-src-endpoints-worldinfo-js.patch`
- `README_PATCHES.md`

Use this ZIP when you prefer `git apply` workflows.

## 🧠 What These Changes Do

Core behavior delivered by these packages:

- Adds **Push UI** buttons to World Info editor
- Adds **single push** + **admin bulk push** flows
- Adds backend push endpoints and manifest handling
- Locks pushed lorebooks and pushed character advanced fields
- Enforces visibility/edit permissions so hidden pushed lorebooks are accessible only by:
  - 👑 Admin users
  - ✍️ Original creator of that pushed lorebook

Special rule included:

- If a user-pushed `dd-*` lorebook is later re-pushed by admin, it keeps creator lineage and hidden/locked behavior.
 
![brave_F48EPcfLAm](https://github.com/user-attachments/assets/a91c0356-adaf-4e0c-9991-7ad20c19f16c)
![brave_ZyB5pczdjE](https://github.com/user-attachments/assets/5ec4363c-90b6-4d3a-b5da-014639ee1198)
![brave_poGXxvH71C](https://github.com/user-attachments/assets/cfc177bd-2c5e-413f-b474-4bd84aef6900)
![brave_NvRYiyCLbh](https://github.com/user-attachments/assets/6794d59e-5459-469c-b61d-f6087e89130b)
![brave_FbF6IiSZGm](https://github.com/user-attachments/assets/d2c984ea-0264-43ac-80aa-c5c3e427667f)



## 🛠️ Install Options

### Option A: Full-file package (fastest)
1. Extract `SillyTavern-PushPatch-Package-20260302.zip`
2. Copy each extracted file into matching path under your live SillyTavern root
3. Restart server
4. Hard refresh browser (`Ctrl+F5`)

### Option B: Patch package
1. Extract `SillyTavern-PushPatch-Patches-20260302.zip`
2. From your server repo root:
   ```bash
   git apply --reject /path/to/patches/00-all-changes.patch
   ```
3. Validate:
   ```bash
   node --check src/endpoints/worldinfo.js
   node --check src/endpoints/characters.js
   node --check public/scripts/world-info.js
   ```
4. Restart server + hard refresh browser

## ⚡ Low-Downtime Rollout (Recommended)

1. Stage changes in a test/staging copy first
2. Run syntax checks there
3. Start staging and verify push flows
4. During cutover:
   - Stop production process
   - Copy validated files
   - Start production process immediately

Downtime should be minimal (seconds to a couple of minutes depending on host).

## 🔁 Rollback

Always keep a backup of the original 5 files before deploying.  
If needed, restore those files and restart the server.

If you used patch flow:
```bash
git checkout -- public/index.html public/style.css public/scripts/world-info.js src/endpoints/characters.js src/endpoints/worldinfo.js
```

## 🧪 Quick Smoke Test

1. Open World Info editor
2. Confirm push button(s) appear
3. User pushes lorebook to admin
4. Admin re-pushes to users
5. Validate visibility/edit lock behavior by role

## 🖼️ Screenshots

Screenshot section is intentionally left for manual additions by the maintainer.

---

If you want a fresh timestamped bundle, regenerate from your currently tested server copy and replace these ZIPs.
