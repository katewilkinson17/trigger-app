import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export function useAuth() {
  const [user, setUser] = useState(undefined) // undefined = still loading

  useEffect(() => {
    async function init() {
      // getUser() makes a real network call to verify the session is still valid.
      // This catches stale/expired sessions that getSession() (localStorage-only) would miss,
      // which is the root cause of RLS errors when auth.uid() doesn't match user_id.
      const { data: { user: verifiedUser } } = await supabase.auth.getUser()

      if (verifiedUser) {
        setUser(verifiedUser)
      } else {
        // No valid session — create a persistent anonymous one
        const { data, error } = await supabase.auth.signInAnonymously()
        if (error) console.error('Anonymous sign-in failed:', error)
        setUser(data?.user ?? null)
      }
    }

    init()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      // Only update if we have a user — don't overwrite with null mid-flow
      // (the init() async sequence handles the null → anonymous sign-in path)
      if (session?.user) setUser(session.user)
    })

    return () => subscription.unsubscribe()
  }, [])

  return {
    user,
    loading: user === undefined,
  }
}
