import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'

// Belt-and-suspenders: unregister any lingering service workers on every load.
// The SW we shipped was caching index.html and overriding all cache headers.
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then(registrations => {
    registrations.forEach(r => r.unregister())
  })
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>
)
