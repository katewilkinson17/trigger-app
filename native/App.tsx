import { ActivityIndicator, StyleSheet, View } from 'react-native'
import { StatusBar } from 'expo-status-bar'
import { useAuth } from './src/hooks/useAuth'

// Placeholder — screens will be built out in Part Two.
// This confirms auth is wired up: loading spinner → silent anon sign-in → ready.
export default function App() {
  const { loading } = useAuth()

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#5B4FE8" />
        <StatusBar style="auto" />
      </View>
    )
  }

  return (
    <View style={styles.center}>
      <StatusBar style="auto" />
    </View>
  )
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    backgroundColor: '#F7F5F2',
    alignItems: 'center',
    justifyContent: 'center',
  },
})
