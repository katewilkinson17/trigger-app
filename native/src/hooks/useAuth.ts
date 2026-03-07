import { useState, useEffect } from 'react'
import { AppState, AppStateStatus } from 'react-native'
import { User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

// undefined = still initialising, null = auth failed, User = ready
type AuthState = User | null | undefined

export function useAuth() {
  const [user, setUser] = useState<AuthState>(undefined)

  useEffect(() => {
    async function init() {
      // getUser() makes a real network call to verify the stored session is valid.
      // If the keychain has a stale token this catches it, unlike getSession()
      // which only reads local storage and can return expired tokens.
      const { data: { user: verifiedUser } } = await supabase.auth.getUser()

      if (verifiedUser) {
        setUser(verifiedUser)
        return
      }

      // No valid session — clear any stale keychain entry then create a fresh
      // anonymous session. signInAnonymously() returns the existing session if
      // one is present, so we must sign out first to guarantee a new one.
      await supabase.auth.signOut()
      const { data, error } = await supabase.auth.signInAnonymously()
      if (error) console.error('Anonymous sign-in failed:', error.message)
      setUser(data?.user ?? null)
    }

    init()

    // Keep the session token refreshed while the app is foregrounded.
    // On React Native, visibilitychange doesn't exist — use AppState instead.
    function onAppStateChange(state: AppStateStatus) {
      if (state === 'active') {
        supabase.auth.startAutoRefresh()
      } else {
        supabase.auth.stopAutoRefresh()
      }
    }

    const subscription = AppState.addEventListener('change', onAppStateChange)

    // Mirror the web app's onAuthStateChange so in-flight token refreshes
    // update the user object without a full re-init.
    const { data: { subscription: authSub } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (session?.user) setUser(session.user)
      }
    )

    return () => {
      subscription.remove()
      authSub.unsubscribe()
    }
  }, [])

  return {
    user,
    loading: user === undefined,
  }
}
