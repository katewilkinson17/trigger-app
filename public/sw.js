// Service worker disabled — self-destruct to clear any previous installation.
// iOS Safari cached the old SW; this update ensures it is unregistered on next check.
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', () => {
  self.registration.unregister().then(() => {
    // Reload any open clients so they get a fully uncached page load
    return self.clients.matchAll({ type: 'window' })
  }).then(clients => {
    clients.forEach(c => c.navigate(c.url))
  })
})
