import type { ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

interface Props {
  title?: string
  subtitle?: string
  actions?: ReactNode
  children: ReactNode
  loading?: boolean
}

const NAV = [
  { to: '/admin', label: 'Dashboard', end: true },
  { to: '/admin/assessments', label: 'Assessments' },
  { to: '/admin/questions', label: 'Question Bank' },
  { to: '/admin/taxonomy', label: 'Taxonomy' },
  { to: '/admin/levels', label: 'Levels & Courses' },
  { to: '/admin/settings', label: 'Settings' },
]

export default function AdminLayout({ title, subtitle, actions, children, loading }: Props) {
  const navigate = useNavigate()
  const [email, setEmail] = useState<string | null>(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email || null))
  }, [])

  async function logout() {
    await supabase.auth.signOut()
    navigate('/login')
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <aside className="fixed inset-y-0 left-0 hidden w-60 flex-col border-r border-slate-200 bg-white p-4 md:flex">
        <div className="mb-6 px-2 text-lg font-semibold text-slate-900">Diagnostic Admin</div>
        <nav className="flex-1 space-y-1">
          {NAV.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className="block rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="border-t border-slate-100 pt-3">
          <div className="truncate px-2 text-xs text-slate-500">{email}</div>
          <button onClick={logout} className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">
            Sign out
          </button>
        </div>
      </aside>

      <div className="md:pl-60">
        <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur">
          <div className="flex items-center justify-between gap-3 px-4 py-3 sm:px-6">
            <div>
              {title && <h1 className="text-xl font-semibold text-slate-900">{title}</h1>}
              {subtitle && <p className="text-sm text-slate-500">{subtitle}</p>}
            </div>
            {actions}
          </div>
        </header>
        <main className="p-4 sm:p-6">
          {loading ? <div className="text-slate-500">Loading…</div> : children}
        </main>
      </div>
    </div>
  )
}