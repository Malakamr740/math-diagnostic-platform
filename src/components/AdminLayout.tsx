import { useState, type ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

interface AdminLayoutProps {
  children: ReactNode
  title?: string
  subtitle?: string
  actions?: ReactNode
}

export default function AdminLayout({ children, title, subtitle, actions }: AdminLayoutProps) {
  const { profile, session, signOut } = useAuth()
  const location = useLocation()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const navItems = [
    { label: 'Dashboard', path: '/admin', icon: '📊' },
    { label: 'Assessments', path: '/admin/assessments', icon: '📝' },
    { label: 'Question Bank', path: '/admin/questions', icon: '📚' },
    { label: 'Taxonomy', path: '/admin/taxonomy', icon: '🏷️' },
    { label: 'Levels & Courses', path: '/admin/levels', icon: '🎯' },
    { label: 'Settings & Fields', path: '/admin/settings', icon: '⚙️' },
  ]

  const isActive = (path: string) => {
    if (path === '/admin') return location.pathname === '/admin'
    return location.pathname.startsWith(path)
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row text-slate-900 font-sans">
      {/* Mobile Header */}
      <div className="md:hidden bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between">
        <span className="font-bold text-lg text-blue-600">AssessHub</span>
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="p-2 text-slate-600 rounded-md hover:bg-slate-100"
        >
          {mobileMenuOpen ? '✕' : '☰'}
        </button>
      </div>

      {/* Sidebar Navigation */}
      <aside
        className={`${
          mobileMenuOpen ? 'block' : 'hidden'
        } md:flex flex-col w-full md:w-64 bg-white border-r border-slate-200 shrink-0 z-20`}
      >
        <div className="p-6 border-b border-slate-100 hidden md:flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold text-lg shadow-sm">
            A
          </div>
          <div>
            <h1 className="font-bold text-slate-900 leading-tight">Assessment Studio</h1>
            <p className="text-xs text-slate-500 font-medium">Diagnostic & Testing</p>
          </div>
        </div>

        <nav className="p-4 space-y-1 flex-1">
          {navItems.map((item) => {
            const active = isActive(item.path)
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition ${
                  active
                    ? 'bg-blue-50 text-blue-700 shadow-xs'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <span className="text-lg">{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            )
          })}
        </nav>

        {/* User profile footer */}
        <div className="p-4 border-t border-slate-200 bg-slate-50/50">
          <div className="flex items-center justify-between">
            <div className="min-w-0 pr-2">
              <p className="text-xs font-semibold text-slate-900 truncate">
                {profile?.full_name || session?.user.email || 'Teacher Account'}
              </p>
              <p className="text-[11px] text-slate-500 uppercase tracking-wider font-semibold">
                {profile?.role || 'Staff'}
              </p>
            </div>
            <button
              onClick={signOut}
              title="Sign Out"
              className="text-xs bg-slate-200 hover:bg-red-50 hover:text-red-600 text-slate-700 px-2.5 py-1.5 rounded-md transition"
            >
              Sign out
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {(title || actions) && (
          <header className="bg-white border-b border-slate-200 px-6 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              {title && <h1 className="text-xl font-bold text-slate-900">{title}</h1>}
              {subtitle && <p className="text-sm text-slate-500 mt-0.5">{subtitle}</p>}
            </div>
            {actions && <div className="flex items-center gap-2.5 flex-wrap">{actions}</div>}
          </header>
        )}
        <main className="flex-1 p-6 max-w-7xl w-full mx-auto">{children}</main>
      </div>
    </div>
  )
}