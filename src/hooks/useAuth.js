import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export function useAuth() {
  const [user, setUser] = useState(undefined) // undefined = still loading

  useEffect(() => {
    // ── Register the listener BEFORE calling init() ─────────────────────────
    // This ensures we never miss an auth-state event that fires during init
    // (e.g. the SIGNED_IN that Supabase fires synchronously inside
    // signInAnonymously(), or a TOKEN_REFRESHED / SIGNED_OUT that the SDK
    // fires in the background while init() is awaiting getUser()).
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('[useAuth] onAuthStateChange:', event, '| user:', session?.user?.id ?? null)

      if (session?.user) {
        // A fresh valid session arrived — adopt it.
        setUser(session.user)
      } else if (event === 'SIGNED_OUT' || event === 'TOKEN_REFRESHED') {
        // The SDK lost or refreshed the session; keep React state in sync.
        // Setting null (not undefined) collapses the loading state so the UI
        // isn't blocked, then init()'s own setUser call may overwrite with a
        // real user once signInAnonymously completes.
        if (session === null) setUser(null)
      }
    })

    async function init() {
      console.log('[useAuth] init: verifying existing session with getUser()...')
      try {
        // getUser() makes a live network call to Supabase — it is the only
        // reliable way to confirm the stored JWT is still valid server-side.
        const { data, error } = await supabase.auth.getUser()
        console.log('[useAuth] getUser →', {
          userId: data?.user?.id ?? null,
          error:  error?.message ?? null,
        })

        if (data?.user) {
          // Confirmed valid session — we're done.
          console.log('[useAuth] valid session confirmed:', data.user.id)
          setUser(data.user)
          return
        }

        // No valid session. We MUST sign out before calling signInAnonymously()
        // because if a stale token is present in localStorage, Supabase will
        // return that existing (invalid) session instead of creating a fresh
        // one, and auth.uid() will be NULL in RLS → all writes silently fail.
        console.log('[useAuth] no valid session; clearing stale token...')
        await supabase.auth.signOut()

        console.log('[useAuth] calling signInAnonymously()...')
        const { data: anonData, error: anonError } = await supabase.auth.signInAnonymously()
        console.log('[useAuth] signInAnonymously →', {
          userId: anonData?.user?.id ?? null,
          error:  anonError?.message ?? null,
        })

        if (anonError) {
          console.error('[useAuth] anonymous sign-in failed:', anonError)
          // Unblock the UI. Task saves will show their own error message
          // rather than leaving the user with a permanently disabled button.
          setUser(null)
          return
        }

        // onAuthStateChange will also fire here (belt-and-suspenders):
        setUser(anonData?.user ?? null)

      } catch (err) {
        // Any unexpected throw (network failure, malformed Supabase response,
        // destructure error) lands here.  Without this catch, user stays
        // undefined forever → loading state never clears → button stuck gray.
        console.error('[useAuth] init threw unexpectedly:', err)
        setUser(null) // unblock the UI
      }
    }

    init()

    return () => subscription.unsubscribe()
  }, [])

  return {
    user,
    loading: user === undefined,
  }
}
