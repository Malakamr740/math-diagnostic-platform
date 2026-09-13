import { useEffect, useState } from 'react'
import AdminLayout from '../components/AdminLayout'
import { supabase } from '../lib/supabaseClient'

interface LevelRow {
  id: string
  name: string
  min_percentage: number
  max_percentage: number
  description: string | null
  recommendation: string | null
}

interface CourseRow {
  id: string
  name: string
  description: string | null
  registration_url: string | null
  whatsapp_url: string | null
  phone: string | null
  is_active: boolean
}

export default function LevelsCoursesPage() {
  const [levels, setLevels] = useState<LevelRow[]>([])
  const [courses, setCourses] = useState<CourseRow[]>([])
  const [levelCourseMap, setLevelCourseMap] = useState<Record<string, string[]>>({})
  const [orgId, setOrgId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [savingLevelId, setSavingLevelId] = useState<string | null>(null)

  // New Course Modal State
  const [showCourseModal, setShowCourseModal] = useState(false)
  const [editingCourse, setEditingCourse] = useState<CourseRow | null>(null)
  const [courseName, setCourseName] = useState('')
  const [courseDescription, setCourseDescription] = useState('')
  const [courseRegUrl, setCourseRegUrl] = useState('')
  const [courseWhatsappUrl, setCourseWhatsappUrl] = useState('')
  const [savingCourse, setSavingCourse] = useState(false)
  const [courseError, setCourseError] = useState<string | null>(null)

  useEffect(() => {
    fetchData()
  }, [])

  async function fetchData() {
    setLoading(true)

    const { data: orgData } = await supabase.from('organizations').select('id').limit(1).single()
    if (orgData) setOrgId(orgData.id)

    const [
      { data: levelsData },
      { data: coursesData },
      { data: linksData }
    ] = await Promise.all([
      supabase.from('levels').select('*').order('min_percentage'),
      supabase.from('courses').select('*').order('created_at', { ascending: false }),
      supabase.from('level_courses').select('level_id, course_id')
    ])

    setLevels(levelsData ?? [])
    setCourses(coursesData ?? [])

    const map: Record<string, string[]> = {}
    linksData?.forEach((link) => {
      if (!map[link.level_id]) map[link.level_id] = []
      map[link.level_id].push(link.course_id)
    })
    setLevelCourseMap(map)

    setLoading(false)
  }

  async function updateLevel(level: LevelRow) {
    setSavingLevelId(level.id)
    await supabase
      .from('levels')
      .update({
        name: level.name,
        description: level.description,
        recommendation: level.recommendation,
        updated_at: new Date().toISOString()
      })
      .eq('id', level.id)
    setSavingLevelId(null)
  }

  async function toggleCourseForLevel(levelId: string, courseId: string, assigned: boolean) {
    if (assigned) {
      // Remove link
      await supabase
        .from('level_courses')
        .delete()
        .eq('level_id', levelId)
        .eq('course_id', courseId)
      
      setLevelCourseMap((prev) => ({
        ...prev,
        [levelId]: (prev[levelId] || []).filter((id) => id !== courseId)
      }))
    } else {
      // Add link
      await supabase
        .from('level_courses')
        .insert({ level_id: levelId, course_id: courseId })

      setLevelCourseMap((prev) => ({
        ...prev,
        [levelId]: [...(prev[levelId] || []), courseId]
      }))
    }
  }

  function openCreateCourseModal() {
    setEditingCourse(null)
    setCourseName('')
    setCourseDescription('')
    setCourseRegUrl('')
    setCourseWhatsappUrl('')
    setCourseError(null)
    setShowCourseModal(true)
  }

  function openEditCourseModal(c: CourseRow) {
    setEditingCourse(c)
    setCourseName(c.name)
    setCourseDescription(c.description || '')
    setCourseRegUrl(c.registration_url || '')
    setCourseWhatsappUrl(c.whatsapp_url || '')
    setCourseError(null)
    setShowCourseModal(true)
  }

  async function handleSaveCourse(e: React.FormEvent) {
    e.preventDefault()
    if (!courseName.trim()) {
      setCourseError('Course name is required.')
      return
    }
    if (!orgId) {
      setCourseError('Organization not resolved.')
      return
    }

    setSavingCourse(true)
    setCourseError(null)

    if (editingCourse) {
      const { error } = await supabase
        .from('courses')
        .update({
          name: courseName.trim(),
          description: courseDescription.trim() || null,
          registration_url: courseRegUrl.trim() || null,
          whatsapp_url: courseWhatsappUrl.trim() || null,
          updated_at: new Date().toISOString()
        })
        .eq('id', editingCourse.id)

      if (error) {
        setCourseError(error.message)
        setSavingCourse(false)
        return
      }
    } else {
      const { error } = await supabase.from('courses').insert({
        organization_id: orgId,
        name: courseName.trim(),
        description: courseDescription.trim() || null,
        registration_url: courseRegUrl.trim() || null,
        whatsapp_url: courseWhatsappUrl.trim() || null,
        is_active: true
      })

      if (error) {
        setCourseError(error.message)
        setSavingCourse(false)
        return
      }
    }

    setSavingCourse(false)
    setShowCourseModal(false)
    fetchData()
  }

  async function deleteCourse(courseId: string) {
    if (!confirm('Are you sure you want to delete this course?')) return
    await supabase.from('courses').delete().eq('id', courseId)
    fetchData()
  }

  return (
    <AdminLayout
      title="Performance Tiers & Course Recommendations"
      subtitle="Configure performance bands and manage courses recommended to students after evaluation"
      actions={
        <button
          onClick={openCreateCourseModal}
          className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-3.5 py-2 rounded-lg transition"
        >
          + Add Course / Prep Program
        </button>
      }
    >
      <div className="space-y-8 max-w-5xl">
        {/* Section 1: Performance Levels & Course Mapping */}
        <section className="space-y-4">
          <div>
            <h2 className="text-base font-bold text-slate-900">Performance Bands & Prescription</h2>
            <p className="text-xs text-slate-500">
              Link courses to specific readiness tiers. When a student falls into a band, these courses appear on their report.
            </p>
          </div>

          {loading ? (
            <p className="text-xs text-slate-500">Loading levels...</p>
          ) : (
            levels.map((lvl, index) => {
              const assignedCourseIds = levelCourseMap[lvl.id] || []

              return (
                <div key={lvl.id} className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <div className="flex items-center gap-3">
                      <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 text-xs font-bold flex items-center justify-center">
                        {index + 1}
                      </span>
                      <input
                        type="text"
                        value={lvl.name}
                        onChange={(e) => {
                          const copy = [...levels]
                          copy[index].name = e.target.value
                          setLevels(copy)
                        }}
                        className="font-bold text-slate-900 border-b border-transparent focus:border-blue-500 px-1 outline-none text-base"
                      />
                    </div>
                    <span className="text-xs font-mono font-semibold bg-slate-100 px-2.5 py-1 rounded-md text-slate-600">
                      Score: {lvl.min_percentage}% – {lvl.max_percentage}%
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 mb-1">
                        Evaluation Description
                      </label>
                      <input
                        type="text"
                        value={lvl.description ?? ''}
                        onChange={(e) => {
                          const copy = [...levels]
                          copy[index].description = e.target.value
                          setLevels(copy)
                        }}
                        className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-500 mb-1">
                        Instructor Prescription
                      </label>
                      <input
                        type="text"
                        value={lvl.recommendation ?? ''}
                        onChange={(e) => {
                          const copy = [...levels]
                          copy[index].recommendation = e.target.value
                          setLevels(copy)
                        }}
                        className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2"
                      />
                    </div>
                  </div>

                  {/* Course Checkboxes for this Level */}
                  <div className="pt-2">
                    <span className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                      Recommended Courses For This Band ({assignedCourseIds.length} Linked):
                    </span>
                    {courses.length === 0 ? (
                      <p className="text-xs text-slate-400">No courses created yet. Click "+ Add Course" above.</p>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {courses.map((c) => {
                          const isAssigned = assignedCourseIds.includes(c.id)
                          return (
                            <button
                              key={c.id}
                              type="button"
                              onClick={() => toggleCourseForLevel(lvl.id, c.id, isAssigned)}
                              className={`text-xs px-3 py-1.5 rounded-lg border transition flex items-center gap-1.5 ${
                                isAssigned
                                  ? 'bg-blue-50 border-blue-300 text-blue-800 font-bold'
                                  : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                              }`}
                            >
                              <span>{isAssigned ? '✓' : '+'}</span>
                              <span>{c.name}</span>
                            </button>
                          )
                        })}
                      </div>
                    )}
                  </div>

                  <div className="flex justify-end pt-1">
                    <button
                      type="button"
                      onClick={() => updateLevel(lvl)}
                      disabled={savingLevelId === lvl.id}
                      className="text-xs bg-slate-800 hover:bg-slate-900 text-white font-semibold px-3 py-1.5 rounded-md"
                    >
                      {savingLevelId === lvl.id ? 'Saving...' : 'Save Band Settings'}
                    </button>
                  </div>
                </div>
              )
            })
          )}
        </section>

        {/* Section 2: Manage Course Inventory */}
        <section className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
          <div>
            <h2 className="text-base font-bold text-slate-900">Course & Prep Program Catalog</h2>
            <p className="text-xs text-slate-500">
              Manage your offerings, enrollment links, and contact channels.
            </p>
          </div>

          {courses.length === 0 ? (
            <div className="border-2 border-dashed border-slate-200 rounded-xl p-8 text-center text-xs text-slate-400">
              No courses in your catalog yet. Click "+ Add Course / Prep Program" above to create one.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {courses.map((c) => (
                <div key={c.id} className="border border-slate-200 rounded-xl p-4 bg-slate-50/50 flex flex-col justify-between space-y-3">
                  <div>
                    <h4 className="font-bold text-sm text-slate-900">{c.name}</h4>
                    {c.description && (
                      <p className="text-xs text-slate-600 mt-1 line-clamp-2">{c.description}</p>
                    )}
                    <div className="flex flex-wrap gap-2 mt-2 text-[11px] text-slate-500">
                      {c.registration_url && <span className="bg-white border border-slate-200 px-1.5 py-0.5 rounded truncate max-w-xs">🔗 {c.registration_url}</span>}
                      {c.whatsapp_url && <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-1.5 py-0.5 rounded">💬 WhatsApp</span>}
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
                    <button
                      onClick={() => openEditCourseModal(c)}
                      className="text-xs bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 font-semibold px-2.5 py-1 rounded"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => deleteCourse(c.id)}
                      className="text-xs text-rose-600 hover:text-rose-800 font-semibold px-2 py-1"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Course Modal */}
      {showCourseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full space-y-4 shadow-xl">
            <h3 className="text-base font-bold text-slate-900">
              {editingCourse ? 'Edit Course / Program' : 'New Prep Course'}
            </h3>

            <form onSubmit={handleSaveCourse} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Course Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. SAT Math Advanced Bootcamp"
                  value={courseName}
                  onChange={(e) => setCourseName(e.target.value)}
                  className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Description</label>
                <textarea
                  rows={3}
                  placeholder="Summary of what the student will learn..."
                  value={courseDescription}
                  onChange={(e) => setCourseDescription(e.target.value)}
                  className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Registration / Checkout URL</label>
                <input
                  type="url"
                  placeholder="https://..."
                  value={courseRegUrl}
                  onChange={(e) => setCourseRegUrl(e.target.value)}
                  className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">WhatsApp Direct Contact Link</label>
                <input
                  type="text"
                  placeholder="https://wa.me/..."
                  value={courseWhatsappUrl}
                  onChange={(e) => setCourseWhatsappUrl(e.target.value)}
                  className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2"
                />
              </div>

              {courseError && <p className="text-xs text-rose-600 bg-rose-50 p-2 rounded">{courseError}</p>}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCourseModal(false)}
                  className="px-3 py-1.5 text-xs text-slate-600 bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingCourse}
                  className="px-4 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg"
                >
                  {savingCourse ? 'Saving...' : 'Save Course'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AdminLayout>
  )
}