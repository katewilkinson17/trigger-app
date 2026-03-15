import { createClient } from '@supabase/supabase-js'

const supabaseUrl     = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase env vars missing — copy .env.example to .env and fill in your project credentials.')
}

// ── Session storage adapter ──────────────────────────────────────────────────
// Safari's ITP (Intelligent Tracking Prevention) classifies cross-origin
// network requests to supabase.co as potential trackers. When the Supabase
// SDK writes its session token to localStorage, ITP intercepts the write and
// surfaces a "reduce protections" prompt on every single visit.
//
// sessionStorage fixes this because:
//  • It is scoped to the current origin (the app's own domain), not to
//    Supabase's domain — ITP does not restrict first-party sessionStorage.
//  • It is never shared across sites, so Safari has no grounds to flag it.
//  • The prompt disappears.
//
// Trade-off: sessionStorage is cleared when the PWA window is fully closed
// (app switcher → swipe away). The app silently re-authenticates via
// silentSignIn() the next time it opens, creating a new anonymous session.
//
// try/catch guards every call: Safari Private Browsing throws on all storage
// writes, and we never want a storage error to crash the auth flow.
const sessionStore = {
  getItem:    key => { try { return sessionStorage.getItem(key) }     catch { return null } },
  setItem:    (key, v) => { try { sessionStorage.setItem(key, v) }    catch {} },
  removeItem: key => { try { sessionStorage.removeItem(key) }         catch {} },
}

export const supabase = createClient(supabaseUrl ?? '', supabaseAnonKey ?? '', {
  auth: {
    storage:            sessionStore,
    persistSession:     true,
    autoRefreshToken:   true,
    detectSessionInUrl: false,
  },
})

// ── Silent re-authentication ─────────────────────────────────────────────────
// Creates a fresh anonymous session without showing the user anything.
// Called by useAuth when the app opens with no stored session, and by
// useTasks.addTask when a write fails because the session was lost mid-flow.
//
// Returns the new userId string on success, or null if the network is down.
export async function silentSignIn() {
  console.log('[auth] silentSignIn: acquiring fresh anonymous session...')
  try {
    // scope:'local' clears only the local token without a server round-trip —
    // safe here since we're immediately replacing the session anyway.
    await supabase.auth.signOut({ scope: 'local' })
    const { data, error } = await supabase.auth.signInAnonymously()
    if (error) {
      console.error('[auth] silentSignIn error:', error.message)
      return null
    }
    console.log('[auth] silentSignIn success, userId:', data?.user?.id)
    return data?.user?.id ?? null
  } catch (err) {
    console.error('[auth] silentSignIn threw:', err)
    return null
  }
}
