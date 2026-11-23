// The app's service worker: Angular's, plus the Critical Now notification. The server sends that
// under a key Angular's worker ignores, so that this one decides what the device shows.
importScripts('./ngsw-worker.js');

const TAG = 'critical-now';

// The note a sign-out leaves, as `app/core/removal-note.ts` writes it.
const NOTE_DB = 'todo-push';
const NOTE_STORE = 'removal';
const NOTE_KEY = 'pending';

const payloadOf = (event) => {
  try {
    return event.data ? event.data.json() : null;
  } catch {
    return null;
  }
};

const request = (r) =>
  new Promise((resolve, reject) => {
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });

// Closed after each use: a connection left open would block the page from ever upgrading the store.
const withNotes = async (mode, work) => {
  const open = indexedDB.open(NOTE_DB, 1);
  open.onupgradeneeded = () => open.result.createObjectStore(NOTE_STORE);
  const db = await request(open);
  try {
    return await work(db.transaction(NOTE_STORE, mode).objectStore(NOTE_STORE));
  } finally {
    db.close();
  }
};

const readNote = () => withNotes('readonly', (store) => request(store.get(NOTE_KEY)));

const clearNote = (note) =>
  withNotes('readwrite', async (store) => {
    const current = await request(store.get(NOTE_KEY));
    if (current && current.endpoint === note.endpoint) {
      await request(store.delete(NOTE_KEY));
    }
  });

const show = (title, body) =>
  self.registration.showNotification(title, {
    body,
    tag: TAG,
    renotify: false,
    silent: true,
    icon: 'icons/icon-192.png',
    data: { onActionClick: { default: { operation: 'focusLastFocusedOrOpen', url: '/' } } },
  });

// A push arriving proves the connection a sign-out may not have had.
const finishRemoval = async (note, subscription) => {
  try {
    if (subscription && !(await subscription.unsubscribe())) {
      return;
    }
    const answer = await fetch('/push/removal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ endpoint: note.endpoint, auth: note.auth }),
    });
    if (answer.ok) {
      await clearNote(note);
    }
  } catch {
    // Kept for the next push, or the next start of the app.
  }
};

const handle = async (notice) => {
  const note = await readNote().catch(() => undefined);
  const subscription = await self.registration.pushManager.getSubscription();
  if (note && subscription && note.endpoint === subscription.endpoint) {
    // This device is no longer anyone's to show titles to.
    await finishRemoval(note, subscription);
    return;
  }
  await show(notice.title, notice.body);
  if (note) {
    await finishRemoval(note, null);
  }
};

self.addEventListener('push', (event) => {
  const notice = payloadOf(event)?.criticalNow;
  if (notice) {
    event.waitUntil(handle(notice));
  }
});
