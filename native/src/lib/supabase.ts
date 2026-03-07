import { createClient } from '@supabase/supabase-js'
import * as SecureStore from 'expo-secure-store'

const supabaseUrl  = process.env.EXPO_PUBLIC_SUPABASE_URL!
const supabaseKey  = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!

if (!supabaseUrl || !supabaseKey) {
  console.warn('Supabase env vars missing — check your .env file')
}

// expo-secure-store adapter for Supabase session persistence.
// SecureStore replaces localStorage: the session JWT is stored encrypted
// in the device keychain so it survives app restarts.
const SecureStoreAdapter = {
  getItem:    (key: string) => SecureStore.getItemAsync(key),
  setItem:    (key: string, value: string) => SecureStore.setItemAsync(key, value),
  removeItem: (key: string) => SecureStore.deleteItemAsync(key),
}

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    storage:            SecureStoreAdapter,
    autoRefreshToken:   true,
    persistSession:     true,
    detectSessionInUrl: false,   // must be false for React Native
  },
})
