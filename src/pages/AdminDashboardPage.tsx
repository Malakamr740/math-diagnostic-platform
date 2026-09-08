import { useAuth } from '../contexts/AuthContext'
import { Link } from 'react-router-dom'

export default function AdminDashboardPage() {
  const { profile, session, signOut } = useAuth()

  return (
    <div className="min-h-screen bg-slate-100">
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex justify-between items-center">
        <h1 className="text-xl font-semibold text-slate-800">Admin Dashboard</h1>
        <div className="flex items-center gap-4">
          <span className="text-sm text-slate-600">
            {profile?.full_name || session?.user.email} ({profile?.role})
          </span>
          <button
            onClick={signOut}
            className="text-sm bg-slate-800 text-white px-3 py-1.5 rounded-md hover:bg-slate-900"
          >
            Sign Out
          </button>
        </div>
      </header>

      <main className="p-6">
        <div className="flex gap-3">
          <Link
            to="/admin/questions"
            className="inline-block bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
          >
            Go to Question Bank
          </Link>
          <Link
            to="/admin/assessments"
            className="inline-block bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
          >
            Go to Assessments
          </Link>
        </div>
      </main>
    </div>
  )
}