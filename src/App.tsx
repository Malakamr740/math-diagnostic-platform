import { AuthProvider, useAuth } from './contexts/AuthContext'
import LoginPage from './pages/LoginPage'

function AppContent() {
  const { session, profile, loading, signOut } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100">
        <p className="text-slate-600">Loading...</p>
      </div>
    )
  }

  if (!session) {
    return <LoginPage />
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100">
      <div className="text-center">
        <h1 className="text-2xl font-semibold text-slate-800 mb-2">
          Logged in as {profile?.full_name || session.user.email}
        </h1>
        <p className="text-slate-600 mb-4">Role: {profile?.role}</p>
        <button
          onClick={signOut}
          className="bg-slate-800 text-white px-4 py-2 rounded-md hover:bg-slate-900"
        >
          Sign Out
        </button>
      </div>
    </div>
  )
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  )
}

export default App