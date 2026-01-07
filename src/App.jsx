import { useState, useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { get_session, on_auth_state_change, sign_up, sign_in, sign_out } from './services/playerStorage'
import AuthPanel from './components/AuthPanel'
import CharacterSelectScreen from './routes/CharacterSelectScreen'
import GameScreen from './routes/GameScreen'

function App() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  // Check session on mount
  useEffect(() => {
    get_session().then(({ data }) => {
      setUser(data.session?.user || null)
      setLoading(false)
    }).catch((error) => {
      console.error('Error getting session:', error)
      setLoading(false)
    })
  }, [])

  // Listen to auth state changes
  useEffect(() => {
    const { data: listener } = on_auth_state_change((_event, session) => {
      setUser(session?.user || null)
    })
    return () => {
      listener?.subscription?.unsubscribe()
    }
  }, [])

  // Auth handlers
  const handle_sign_in = async ({ email, password, isLogin, onStatus }) => {
    try {
      onStatus('Working...')
      const fn = isLogin ? sign_in : sign_up
      const { error } = await fn(email, password)
      if (error) {
        onStatus(error.message)
      } else {
        onStatus('Success! Check your email if using signup.')
      }
    } catch (err) {
      onStatus(err.message)
    }
  }

  const handle_sign_out = async () => {
    try {
      await sign_out()
      setUser(null)
    } catch (error) {
      console.error('Error signing out:', error)
    }
  }

  if (loading) {
    return <div>Loading...</div>
  }

  if (!user) {
    return <AuthPanel onSignIn={handle_sign_in} />
  }

  return (
    <Routes>
      <Route path="/" element={<Navigate to="/character-select" replace />} />
      <Route path="/character-select" element={<CharacterSelectScreen onSignOut={handle_sign_out} />} />
      <Route path="/game/:characterId" element={<GameScreen onSignOut={handle_sign_out} />} />
      <Route path="*" element={<Navigate to="/character-select" replace />} />
    </Routes>
  )
}

export default App

