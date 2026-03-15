import { useState, useEffect } from 'react'
import { supabase, silentSignIn } from '../lib/supabase'

export function useAuth() {
  const [user, setUser] = useState(undefined) // undefined = still loading

  useEffect(() => {
    // ── Primary: onAuthStateChange ────────────────────────────────────────────
    // Supabase v2 fires INITIAL_SESSION as the first event on registration,
    // reading from sessionStorage synchronously (as a microtask). This resolves
    // the loading state before any network call — the Dump button appears in its
    // correct state (enabled with a valid user, or enabled-but-unauthed if the
    // session was cleared) almost immediately.
    //
    // All subsequent events (SIGNED_IN, SIGNED_OUT, TOKEN_REFRESHED, etc.) keep
    // React state in sync with whatever session the SDK actually holds.
    // Using session?.user ?? null (never undefined) ensures loading always clears.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('[useAuth] onAuthStateChange:', event, '| user:', session?.user?.id ?? null)
      setUser(session?.user ?? null)
    })

    // ── Secondary: ensureSession ──────────────────────────────────────────────
    // If the PWA was closed (sessionStorage cleared) or this is the very first
    // visit, INITIAL_SESSION fires with session=null → user=null → Dump button
    // visible but no userId yet. ensureSession runs in the background and calls
    // silentSignIn(), which fires SIGNED_IN → setUser(freshUser) so the userId
    // is ready before the user finishes the dump form (~10–30 s).
    //
    // If getUser() confirms a valid session already exists (e.g. the app was
    // merely backgrounded), we leave it in place and return early.
    async function ensureSession() {
      try {
        const { data } = await supabase.auth.getUser()
        console.log('[useAuth] getUser:', data?.user?.id ?? 'no session')
        if (data?.user) return   // already signed in — nothing to do
        console.log('[useAuth] no session — creating anonymous session in background...')
        await silentSignIn()
        // onAuthStateChange SIGNED_IN fires and calls setUser(freshUser)
      } catch (err) {
        console.error('[useAuth] ensureSession error:', err)
        // INITIAL_SESSION already called setUser(null) so loading is cleared.
        // addTask's own silent re-auth will handle the session on first write.
      }
    }

    ensureSession()

    return () => subscription.unsubscribe()
  }, [])

  return { user, loading: user === undefined }
}
