import fs from 'node:fs';
import path from 'node:path';

import sanitize from 'sanitize-filename';
import { sync as writeFileAtomicSync } from 'write-file-atomic';

import { getAllEnabledUsers, getAllUserHandles, getUserDirectories } from '../../src/users.js';
import { read as readCharacterCard, write as writeCharacterCard } from '../../src/character-card-parser.js';

const PLUGIN_ID = 'pushbot';
const PLUGIN_VERSION = '1.2.0';

/**
 * Push Bot server plugin
 *
 * Exposes endpoints under:
 *   /api/plugins/pushbot/push
 *   /api/plugins/pushbot/bulk-push
 *   /api/plugins/pushbot/admin-handles
 *   /api/plugins/pushbot/push-notifications
 */

// ─────────────────────────────────────────────────────────
// Manifest helpers (same shape as your working bundle)
// Stored at data/{handle}/push-manifest.json
// ─────────────────────────────────────────────────────────

function getPushManifestPath(handle) {
  const dirs = getUserDirectories(handle);
  return path.join(path.dirname(dirs.worlds), 'push-manifest.json');
}

function readPushManifest(handle) {
  try {
    const p = getPushManifestPath(handle);
    if (!fs.existsSync(p)) return [];
    return JSON.parse(fs.readFileSync(p, 'utf8')) || [];
  } catch {
    return [];
  }
}

function writePushManifest(handle, records) {
  const p = getPushManifestPath(handle);
  writeFileAtomicSync(p, JSON.stringify(records, null, 2));
}

function recordPush(creatorHandle, record) {
  if (!record?.recipients?.length) return;
  const manifest = readPushManifest(creatorHandle);
  const existing = manifest.find(r => r.pushed_lorebook_name === record.pushed_lorebook_name);
  if (existing) {
    existing.recipients = Array.from(new Set([...(existing.recipients || []), ...record.recipients]));
    existing.character_files = Array.from(new Set([...(existing.character_files || []), ...(record.character_files || [])]));
  } else {
    manifest.push(record);
  }
  writePushManifest(creatorHandle, manifest);
}

function writePushNotification(handle, message) {
  try {
    const userDirs = getUserDirectories(handle);
    const notifDir = path.join(path.dirname(userDirs.worlds), 'push-notifications');
    if (!fs.existsSync(notifDir)) fs.mkdirSync(notifDir, { recursive: true });
    const ts = Date.now();
    const notifFile = path.join(notifDir, `${ts}.json`);
    writeFileAtomicSync(notifFile, JSON.stringify({ message, ts }));
  } catch (err) {
    console.warn(`[pushbot] Failed to write notification for ${handle}: ${err?.message || err}`);
  }
}

// ─────────────────────────────────────────────────────────
// World Info read
// ─────────────────────────────────────────────────────────

function readWorldInfoFile(directories, worldInfoName) {
  const filename = sanitize(`${worldInfoName}.json`);
  const p = path.join(directories.worlds, filename);
  if (!fs.existsSync(p)) throw new Error(`Lorebook not found: ${worldInfoName}`);
  const text = fs.readFileSync(p, 'utf8');
  return JSON.parse(text);
}

// ─────────────────────────────────────────────────────────
// Character matching (scan creator's characters folder)
// ─────────────────────────────────────────────────────────

async function findCharactersByWorld(directories, worldName) {
  if (!worldName) return [];
  const charDir = directories.characters;
  if (!fs.existsSync(charDir)) return [];

  const pngFiles = fs.readdirSync(charDir).filter(f => f.endsWith('.png'));
  const matches = [];

  for (const file of pngFiles) {
    try {
      const filePath = path.join(charDir, file);
      const card = await readCharacterCard(filePath);
      const charWorld = card?.data?.extensions?.world || '';
      if (charWorld === worldName) matches.push(file);
    } catch {
      // ignore unreadable cards
    }
  }

  return matches;
}

function parseDdCreator(name) {
  // dd-{handle}-Label
  const parts = String(name || '').split('-');
  if (parts.length >= 3 && parts[0] === 'dd') return parts[1];
  return null;
}

function buildPushedLorebookName({ isAdmin, creatorHandle, sourceLorebook, label }) {
  const safeLabel = sanitize(label || sourceLorebook || 'Lorebook') || 'Lorebook';

  // Admin pushing a user-sent dd-* book: preserve dd-* name
  if (isAdmin && String(sourceLorebook).startsWith('dd-')) {
    // keep as-is, but allow relabeling while preserving dd-{handle}- prefix
    const ddCreator = parseDdCreator(sourceLorebook);
    if (ddCreator) return `dd-${ddCreator}-${safeLabel}`;
    return sourceLorebook;
  }

  if (isAdmin) return `ADMIN-${safeLabel}`;
  return `dd-${creatorHandle}-${safeLabel}`;
}

function isHandleAdmin(handle) {
  try {
    const users = getAllEnabledUsers();
    return users.some(u => u?.profile?.handle === handle && u?.profile?.admin);
  } catch {
    return false;
  }
}

function resolveAdminHandles() {
  try {
    const users = getAllEnabledUsers();
    return users.filter(u => u?.profile?.admin).map(u => u.profile.handle).filter(Boolean);
  } catch {
    // fallback best-effort
    const handles = getAllUserHandles?.() || [];
    return handles.filter(h => isHandleAdmin(h));
  }
}

function resolveAllNonAdminHandles(exceptHandle) {
  try {
    const users = getAllEnabledUsers();
    return users
      .map(u => u?.profile)
      .filter(p => p?.handle && !p.admin && p.handle !== exceptHandle)
      .map(p => p.handle);
  } catch {
    const handles = getAllUserHandles?.() || [];
    return handles.filter(h => h !== exceptHandle && !isHandleAdmin(h));
  }
}

async function pushOne({ requestUser, sourceLorebookName, targets, label }) {
  const creatorHandle = requestUser.profile.handle;
  const isAdmin = !!requestUser.profile.admin;

  // Non-admin users may only push to admin accounts
  if (!isAdmin) {
    const admins = new Set(resolveAdminHandles());
    for (const t of targets) {
      if (!admins.has(t)) {
        const err = new Error('Non-admin users can only push to admin accounts.');
        err.status = 403;
        throw err;
      }
    }
  }

  const creatorDirs = getUserDirectories(creatorHandle);
  const world = readWorldInfoFile(creatorDirs, sourceLorebookName);

  const ddCreator = parseDdCreator(sourceLorebookName);
  const metaCreator = ddCreator || creatorHandle;

  // Stamp lock/hide metadata (matches your guide)
  world.extensions = world.extensions || {};
  world.extensions.dreamtavern_locked = true;
  world.extensions.dreamtavern_hidden = true;
  world.extensions.dreamtavern_creator = metaCreator;

  const pushedLorebookName = buildPushedLorebookName({
    isAdmin,
    creatorHandle: metaCreator,
    sourceLorebook: sourceLorebookName,
    label,
  });

  // Find linked characters in creator's character folder
  const characterFiles = await findCharactersByWorld(creatorDirs, sourceLorebookName);

  const pushed = [];
  const updated = [];
  const failed = [];
  const characters_pushed = [];

  for (const targetHandle of targets) {
    try {
      const targetDirs = getUserDirectories(targetHandle);

      // Write lorebook
      const targetWorldPath = path.join(targetDirs.worlds, sanitize(`${pushedLorebookName}.json`));
      const existedWorld = fs.existsSync(targetWorldPath);
      writeFileAtomicSync(targetWorldPath, JSON.stringify(world, null, 2));
      (existedWorld ? updated : pushed).push(targetHandle);

      // Write character cards
      for (const file of characterFiles) {
        const srcPath = path.join(creatorDirs.characters, file);
        const dstPath = path.join(targetDirs.characters, file);
        const existedChar = fs.existsSync(dstPath);

        const card = await readCharacterCard(srcPath);
        card.data = card.data || {};
        card.data.extensions = card.data.extensions || {};
        card.data.extensions.world = pushedLorebookName;
        card.data.extensions.dreamtavern_pushed = true;
        card.data.extensions.dreamtavern_creator = metaCreator;

        await writeCharacterCard(dstPath, card);
        characters_pushed.push(file);
        if (existedChar && !existedWorld) {
          // nothing
        }
      }

      writePushNotification(targetHandle, 'New character added! Please refresh your browser');
    } catch (err) {
      failed.push({ handle: targetHandle, error: err?.message || String(err) });
    }
  }

  // Record manifest on the original creator (dd creator or admin)
  recordPush(metaCreator, {
    source_lorebook: sourceLorebookName,
    pushed_lorebook_name: pushedLorebookName,
    character_files: characterFiles,
    recipients: targets,
  });

  return { pushed, updated, failed, characters_pushed };
}


function summarizeManifest(manifest) {
  const records = Array.isArray(manifest) ? manifest : [];
  const uniqueRecipients = new Set();
  const uniqueLorebooks = new Set();
  let totalCharacters = 0;
  for (const r of records) {
    if (r?.recipients) for (const h of r.recipients) uniqueRecipients.add(h);
    if (r?.source_lorebook) uniqueLorebooks.add(r.source_lorebook);
    if (Array.isArray(r?.character_files)) totalCharacters += r.character_files.length;
  }
  return {
    records: records.length,
    unique_recipients: uniqueRecipients.size,
    unique_lorebooks: uniqueLorebooks.size,
    total_character_files: totalCharacters,
  };
}

export async function init(router) {

  // Health + version
  router.get('/health', (req, res) => res.json({ ok: true, id: PLUGIN_ID, version: PLUGIN_VERSION }));
  router.get('/version', (req, res) => res.json({ id: PLUGIN_ID, version: PLUGIN_VERSION }));

  // About / capabilities
  router.get('/about', (req, res) => res.json({
    ok: true,
    id: PLUGIN_ID,
    version: PLUGIN_VERSION,
    capabilities: {
      push: true,
      bulkPush: true,
      adminHandles: true,
      notifications: true,
      stats: true,
    },
    notes: 'Install UI extension for buttons; this plugin provides the server endpoints.',
  }));


  // Stats for current user (creator/admin)
  router.get('/stats', (req, res) => {
    const handle = req.user?.profile?.handle;
    if (!handle) return res.sendStatus(401);
    const manifest = readPushManifest(handle);
    res.json(summarizeManifest(manifest));
  });
  // Admin handles for non-admin push UI
  router.get('/admin-handles', (req, res) => {
    try {
      res.json(resolveAdminHandles());
    } catch {
      res.json([]);
    }
  });

  // Single push
  router.post('/push', async (req, res) => {
    try {
      const user = req.user;
      if (!user?.profile?.handle) return res.sendStatus(401);

      const body = req.body || {};
      const name = String(body.name || '').trim();
      let targets = body.targets;
      const charLabel = body.charLabel || '';

      if (!name) return res.status(400).send('Missing lorebook name');

      if (targets === 'all') {
        targets = resolveAllNonAdminHandles(user.profile.handle);
      }
      if (!Array.isArray(targets) || targets.length === 0) return res.status(400).send('No targets selected');

      const result = await pushOne({
        requestUser: user,
        sourceLorebookName: name,
        targets: targets.map(String),
        label: charLabel,
      });

      res.json(result);
    } catch (err) {
      res.status(err?.status || 500).send(err?.message || 'Push failed');
    }
  });

  // Bulk push (admin only)
  router.post('/bulk-push', async (req, res) => {
    try {
      const user = req.user;
      if (!user?.profile?.handle) return res.sendStatus(401);
      if (!user.profile.admin) return res.sendStatus(403);

      const body = req.body || {};
      const lorebooks = Array.isArray(body.lorebooks) ? body.lorebooks.map(String) : [];
      let targets = Array.isArray(body.targets) ? body.targets.map(String) : null;

      if (lorebooks.length < 1 || lorebooks.length > 10) {
        return res.status(400).send('Select between 1 and 10 lorebooks');
      }

      if (!targets || targets.length === 0) {
        targets = resolveAllNonAdminHandles(user.profile.handle);
      }

      const results = [];
      for (const lb of lorebooks) {
        const r = await pushOne({
          requestUser: user,
          sourceLorebookName: lb,
          targets,
          label: '',
        });
        results.push({ lorebook: lb, ...r });
      }

      res.json({ results });
    } catch (err) {
      res.status(err?.status || 500).send(err?.message || 'Bulk push failed');
    }
  });

  // Notification polling
  router.post('/push-notifications', (req, res) => {
    try {
      const handle = req.user?.profile?.handle;
      if (!handle) return res.sendStatus(401);

      const userDirs = getUserDirectories(handle);
      const notifDir = path.join(path.dirname(userDirs.worlds), 'push-notifications');
      if (!fs.existsSync(notifDir)) return res.json([]);

      const files = fs.readdirSync(notifDir).filter(f => f.endsWith('.json'));
      const out = [];
      for (const f of files) {
        try {
          const p = path.join(notifDir, f);
          const obj = JSON.parse(fs.readFileSync(p, 'utf8'));
          out.push(obj);
          fs.rmSync(p, { force: true });
        } catch {
          // ignore
        }
      }

      res.json(out);
    } catch {
      res.json([]);
    }
  });

  console.log('[pushbot] server plugin loaded');
  return Promise.resolve();
}

export async function exit() {
  return Promise.resolve();
}