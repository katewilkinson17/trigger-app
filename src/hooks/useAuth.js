import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export function useAuth() {
  const [user, setUser] = useState(undefined) // undefined = still loading

  useEffect(() => {
    async function init() {
      // getUser() makes a real network call to verify the stored session is valid.
      // If it returns null, the token is expired/invalid — we must sign out first
      // because signInAnonymously() returns the *existing* (stale) session when one
      // is present in localStorage, which causes auth.uid() = NULL → RLS failures.
      const { data: { user: verifiedUser } } = await supabase.auth.getUser()

      if (verifiedUser) {
        setUser(verifiedUser)
        return
      }

      // Clear the stale session so signInAnonymously creates a fresh one
      await supabase.auth.signOut()
      const { data, error } = await supabase.auth.signInAnonymously()
      if (error) console.error('Anonymous sign-in failed:', error)
      setUser(data?.user ?? null)
    }

    init()

    // onAuthStateChange fires when signInAnonymously completes — keep user in sync
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) setUser(session.user)
    })

    return () => subscription.unsubscribe()
  }, [])

  return {
    user,
    loading: user === undefined,
  }
}
