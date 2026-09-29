import type { Session } from '@supabase/supabase-js'
import { useEffect, useState } from 'preact/hooks'
import { ToastProvider } from './components/Toast'
import { supabase } from './lib/supabase'
import { useRoute } from './lib/router'
import { AuthPage } from './pages/AuthPage'
import { ChallengePage } from './pages/ChallengePage'
import { CreatePage } from './pages/CreatePage'
import { HomePage } from './pages/HomePage'
import { SettingsPage } from './pages/SettingsPage'

export function App() {
  const [session, setSession] = useState<Session | null | undefined>(undefined)
  const route = useRoute()

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data } = supabase.auth.onAuthStateChange((_event, next) => setSession(next))
    return () => data.subscription.unsubscribe()
  }, [])

  const userId = session?.user.id
  return (
    <ToastProvider>
      <div class="app">
        {session === undefined ? (
          <div class="page" aria-busy="true"><span class="visually-hidden">Loading</span></div>
        ) : !userId ? (
          <AuthPage />
        ) : route.name === 'new' ? (
          <CreatePage key={userId} />
        ) : route.name === 'settings' ? (
          <SettingsPage key={userId} />
        ) : route.name === 'challenge' ? (
          <ChallengePage key={`${userId}:${route.id}`} id={route.id} tab={route.tab} />
        ) : (
          <HomePage key={userId} />
        )}
      </div>
    </ToastProvider>
  )
}
