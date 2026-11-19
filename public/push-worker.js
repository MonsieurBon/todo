// The app's service worker: Angular's, plus the Critical Now notification. The server sends that
// under a key Angular's worker ignores, so that this one decides what the device shows.
importScripts('./ngsw-worker.js');

const TAG = 'critical-now';

const payloadOf = (event) => {
  try {
    return event.data ? event.data.json() : null;
  } catch {
    return null;
  }
};

self.addEventListener('push', (event) => {
  const notice = payloadOf(event)?.criticalNow;
  if (!notice) {
    return;
  }
  event.waitUntil(
    self.registration.showNotification(notice.title, {
      body: notice.body,
      tag: TAG,
      renotify: false,
      silent: true,
      icon: 'icons/icon-192.png',
      data: { onActionClick: { default: { operation: 'focusLastFocusedOrOpen', url: '/' } } },
    }),
  );
});
