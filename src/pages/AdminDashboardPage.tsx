import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import AdminLayout from '../components/AdminLayout'
import { supabase } from '../lib/supabaseClient'

interface DashboardStats {
  totalQuestions: number
  totalAssessments: number
  totalAttempts: number
  recentAttempts: Array<{
    id: string
    started_at: string
    assessment: { name: string } | null
    result: { percentage: number } | null
  }>
}

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<DashboardStats>({
    totalQuestions: 0,
    totalAssessments: 0,
    totalAttempts: 0,
    recentAttempts: [],
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadStats() {
      const [
        { count: qCount },
        { count: aCount },
        { count: attCount },
        { data: recentData },
      ] = await Promise.all([
        supabase.from('questions').select('*', { count: 'exact', head: true }),
        supabase.from('assessments').select('*', { count: 'exact', head: true }),
        supabase.from('attempts').select('*', { count: 'exact', head: true }),
        supabase
          .from('attempts')
          .select(
            `id, started_at, assessment:assessments(name), result:attempt_results(percentage)`
          )
          .order('started_at', { ascending: false })
          .limit(5),
      ])

      setStats({
        totalQuestions: qCount ?? 0,
        totalAssessments: aCount ?? 0,
        totalAttempts: attCount ?? 0,
        recentAttempts: (recentData as unknown as DashboardStats['recentAttempts']) ?? [],
      })
      setLoading(false)
    }

    loadStats()
  }, [])

  return (
    <AdminLayout
      title="Admin Dashboard"
      subtitle="Overview of question bank, active diagnostics, and student activity"
      actions={
        <div className="flex gap-2">
          <Link
            to="/admin/assessments/new"
            className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-3.5 py-2 rounded-lg transition"
          >
            + New Assessment
          </Link>
          <Link
            to="/admin/questions/new"
            className="bg-slate-800 hover:bg-slate-900 text-white text-xs font-semibold px-3.5 py-2 rounded-lg transition"
          >
            + Create Question
          </Link>
        </div>
      }
    >
      <div className="space-y-6">
        {/* Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Total Questions
            </p>
            <p className="text-3xl font-extrabold text-slate-900 mt-2">
              {loading ? '...' : stats.totalQuestions}
            </p>
            <Link
              to="/admin/questions"
              className="text-xs text-blue-600 hover:underline mt-2 inline-block font-medium"
            >
              Browse Question Bank →
            </Link>
          </div>

          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Assessments Created
            </p>
            <p className="text-3xl font-extrabold text-slate-900 mt-2">
              {loading ? '...' : stats.totalAssessments}
            </p>
            <Link
              to="/admin/assessments"
              className="text-xs text-blue-600 hover:underline mt-2 inline-block font-medium"
            >
              Manage Assessments →
            </Link>
          </div>

          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Student Attempts
            </p>
            <p className="text-3xl font-extrabold text-slate-900 mt-2">
              {loading ? '...' : stats.totalAttempts}
            </p>
            <span className="text-xs text-slate-500 mt-2 inline-block">
              Recorded diagnostic test sessions
            </span>
          </div>
        </div>

        {/* Quick Access & Recent Attempts */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left 2 Cols: Recent Submissions */}
          <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 shadow-xs p-5">
            <h2 className="text-base font-bold text-slate-900 mb-4">Recent Test Attempts</h2>
            {stats.recentAttempts.length === 0 ? (
              <p className="text-sm text-slate-500 py-6 text-center">
                No student attempts recorded yet.
              </p>
            ) : (
              <div className="divide-y divide-slate-100">
                {stats.recentAttempts.map((att) => (
                  <div key={att.id} className="py-3 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-slate-800">
                        {att.assessment?.name || 'Assessment'}
                      </p>
                      <p className="text-xs text-slate-400">
                        {new Date(att.started_at).toLocaleDateString()} at{' '}
                        {new Date(att.started_at).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-bold text-slate-700">
                        {att.result?.percentage !== undefined ? `${att.result.percentage}%` : '—'}
                      </span>
                      <Link
                        to={`/admin/attempts/${att.id}`}
                        className="text-xs text-blue-600 hover:underline font-medium"
                      >
                        View Results →
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Right Col: Shortcut Actions */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5 space-y-3">
            <h2 className="text-base font-bold text-slate-900 mb-2">Shortcuts</h2>
            <Link
              to="/admin/taxonomy"
              className="flex items-center justify-between p-3 rounded-lg border border-slate-100 bg-slate-50 hover:bg-slate-100 text-sm font-medium transition"
            >
              <span>🏷️ Taxonomy Hierarchy</span>
              <span className="text-slate-400">→</span>
            </Link>
            <Link
              to="/admin/levels"
              className="flex items-center justify-between p-3 rounded-lg border border-slate-100 bg-slate-50 hover:bg-slate-100 text-sm font-medium transition"
            >
              <span>🎯 Levels & Recommendations</span>
              <span className="text-slate-400">→</span>
            </Link>
            <Link
              to="/admin/settings"
              className="flex items-center justify-between p-3 rounded-lg border border-slate-100 bg-slate-50 hover:bg-slate-100 text-sm font-medium transition"
            >
              <span>⚙️ Registration Fields & Org</span>
              <span className="text-slate-400">→</span>
            </Link>
          </div>
        </div>
      </div>
    </AdminLayout>
  )
}