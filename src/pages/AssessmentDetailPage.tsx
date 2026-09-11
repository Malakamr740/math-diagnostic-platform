import { useEffect, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import AdminLayout from '../components/AdminLayout'
import ShareAssessmentModal from '../components/ShareAssessmentModal'
import { supabase } from '../lib/supabaseClient'

interface Assessment {
  id: string
  name: string
  description: string | null
  instructions: string | null
  exam_id: string | null
  status: 'draft' | 'published' | 'archived'
}

interface ExamOption {
  id: string
  name: string
}

interface ModuleRow {
  id: string
  name: string
  description: string | null
  instructions: string | null
  display_order: number
  timing_enabled: boolean
  time_limit_minutes: number | null
  shuffle_questions: boolean
  shuffle_choices: boolean
}

export default function AssessmentDetailPage() {
  const { assessmentId } = useParams<{ assessmentId: string }>()
  const navigate = useNavigate()

  const [assessment, setAssessment] = useState<Assessment | null>(null)
  const [modules, setModules] = useState<ModuleRow[]>([])
  const [exams, setExams] = useState<ExamOption[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Assessment Edit Modal State
  const [showEditAssessmentModal, setShowEditAssessmentModal] = useState(false)
  const [editName, setEditName] = useState('')
  const [editExamId, setEditExamId] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [editInstructions, setEditInstructions] = useState('')
  const [editStatus, setEditStatus] = useState<'draft' | 'published' | 'archived'>('draft')
  const [savingAssessment, setSavingAssessment] = useState(false)
  const [assessmentSaveError, setAssessmentSaveError] = useState<string | null>(null)

  // Module Edit Modal State
  const [editingModule, setEditingModule] = useState<ModuleRow | null>(null)
  const [moduleEditName, setModuleEditName] = useState('')
  const [moduleEditDescription, setModuleEditDescription] = useState('')
  const [moduleEditTimingEnabled, setModuleEditTimingEnabled] = useState(true)
  const [moduleEditTimeLimit, setModuleEditTimeLimit] = useState(30)
  const [moduleEditShuffleQuestions, setModuleEditShuffleQuestions] = useState(false)
  const [moduleEditShuffleChoices, setModuleEditShuffleChoices] = useState(false)
  const [savingModuleEdit, setSavingModuleEdit] = useState(false)
  const [moduleEditError, setModuleEditError] = useState<string | null>(null)

  // New Module Form State
  const [showNewModuleForm, setShowNewModuleForm] = useState(false)
  const [newModuleName, setNewModuleName] = useState('')
  const [newModuleDescription, setNewModuleDescription] = useState('')
  const [newTimingEnabled, setNewTimingEnabled] = useState(true)
  const [newTimeLimit, setNewTimeLimit] = useState(30)
  const [newShuffleQuestions, setNewShuffleQuestions] = useState(false)
  const [newShuffleChoices, setNewShuffleChoices] = useState(false)
  const [savingNewModule, setSavingNewModule] = useState(false)
  const [newModuleError, setNewModuleError] = useState<string | null>(null)

  const [showShareModal, setShowShareModal] = useState(false)
  const [publishing, setPublishing] = useState(false)

  useEffect(() => {
    fetchData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assessmentId])

  async function fetchData() {
    if (!assessmentId) return
    setLoading(true)

    const [
      { data: assessmentData, error: aError },
      { data: moduleData },
      { data: examData },
    ] = await Promise.all([
      supabase
        .from('assessments')
        .select('id, name, description, instructions, exam_id, status')
        .eq('id', assessmentId)
        .single(),
      supabase
        .from('modules')
        .select(
          'id, name, description, instructions, display_order, timing_enabled, time_limit_minutes, shuffle_questions, shuffle_choices'
        )
        .eq('assessment_id', assessmentId)
        .order('display_order'),
      supabase.from('exams').select('id, name').eq('is_active', true).order('name'),
    ])

    if (aError || !assessmentData) {
      setError('Could not load this assessment.')
      setLoading(false)
      return
    }

    setAssessment(assessmentData as Assessment)
    setModules((moduleData as ModuleRow[]) ?? [])
    setExams((examData as ExamOption[]) ?? [])
    setLoading(false)
  }

  function openEditAssessmentModal() {
    if (!assessment) return
    setEditName(assessment.name)
    setEditExamId(assessment.exam_id ?? '')
    setEditDescription(assessment.description ?? '')
    setEditInstructions(assessment.instructions ?? '')
    setEditStatus(assessment.status)
    setAssessmentSaveError(null)
    setShowEditAssessmentModal(true)
  }

  async function handleSaveAssessmentSettings(e: React.FormEvent) {
    e.preventDefault()
    if (!assessmentId || !editName.trim()) {
      setAssessmentSaveError('Assessment name is required.')
      return
    }

    setSavingAssessment(true)
    setAssessmentSaveError(null)

    const { error: updateError } = await supabase
      .from('assessments')
      .update({
        name: editName.trim(),
        exam_id: editExamId || null,
        description: editDescription.trim() || null,
        instructions: editInstructions.trim() || null,
        status: editStatus,
        updated_at: new Date().toISOString(),
      })
      .eq('id', assessmentId)

    setSavingAssessment(false)

    if (updateError) {
      setAssessmentSaveError(updateError.message)
      return
    }

    setShowEditAssessmentModal(false)
    fetchData()
  }

  function openEditModuleModal(mod: ModuleRow) {
    setEditingModule(mod)
    setModuleEditName(mod.name)
    setModuleEditDescription(mod.description ?? '')
    setModuleEditTimingEnabled(mod.timing_enabled)
    setModuleEditTimeLimit(mod.time_limit_minutes ?? 30)
    setModuleEditShuffleQuestions(mod.shuffle_questions)
    setModuleEditShuffleChoices(mod.shuffle_choices)
    setModuleEditError(null)
  }

  async function handleSaveModuleSettings(e: React.FormEvent) {
    e.preventDefault()
    if (!editingModule) return

    if (!moduleEditName.trim()) {
      setModuleEditError('Module name is required.')
      return
    }

    if (moduleEditTimingEnabled && (!moduleEditTimeLimit || moduleEditTimeLimit <= 0)) {
      setModuleEditError('Enter a valid time limit in minutes.')
      return
    }

    setSavingModuleEdit(true)
    setModuleEditError(null)

    const { error: updateError } = await supabase
      .from('modules')
      .update({
        name: moduleEditName.trim(),
        description: moduleEditDescription.trim() || null,
        timing_enabled: moduleEditTimingEnabled,
        time_limit_minutes: moduleEditTimingEnabled ? moduleEditTimeLimit : null,
        shuffle_questions: moduleEditShuffleQuestions,
        shuffle_choices: moduleEditShuffleChoices,
        updated_at: new Date().toISOString(),
      })
      .eq('id', editingModule.id)

    setSavingModuleEdit(false)

    if (updateError) {
      setModuleEditError(updateError.message)
      return
    }

    setEditingModule(null)
    fetchData()
  }

  async function handleCreateModule(e: React.FormEvent) {
    e.preventDefault()
    setNewModuleError(null)

    if (!newModuleName.trim()) {
      setNewModuleError('Module name is required.')
      return
    }

    if (newTimingEnabled && (!newTimeLimit || newTimeLimit <= 0)) {
      setNewModuleError('Enter a valid time limit, or turn timing off.')
      return
    }

    setSavingNewModule(true)

    const { error: insertError } = await supabase.from('modules').insert({
      assessment_id: assessmentId,
      name: newModuleName.trim(),
      description: newModuleDescription.trim() || null,
      display_order: modules.length,
      timing_enabled: newTimingEnabled,
      time_limit_minutes: newTimingEnabled ? newTimeLimit : null,
      shuffle_questions: newShuffleQuestions,
      shuffle_choices: newShuffleChoices,
    })

    setSavingNewModule(false)

    if (insertError) {
      setNewModuleError(insertError.message)
      return
    }

    setNewModuleName('')
    setNewModuleDescription('')
    setShowNewModuleForm(false)
    fetchData()
  }

  async function moveModule(index: number, direction: -1 | 1) {
    const newIndex = index + direction
    if (newIndex < 0 || newIndex >= modules.length) return

    const a = modules[index]
    const b = modules[newIndex]

    await Promise.all([
      supabase.from('modules').update({ display_order: b.display_order }).eq('id', a.id),
      supabase.from('modules').update({ display_order: a.display_order }).eq('id', b.id),
    ])

    fetchData()
  }

  async function deleteModule(moduleId: string) {
    if (!confirm('Delete this module? This also removes its question assignments.')) return
    await supabase.from('modules').delete().eq('id', moduleId)
    fetchData()
  }

  async function deleteAssessment() {
    if (!assessmentId) return
    const confirmed = confirm(
      'Are you sure you want to completely delete this assessment and all its modules? This action cannot be undone.'
    )
    if (!confirmed) return

    const { error: delError } = await supabase.from('assessments').delete().eq('id', assessmentId)
    if (delError) {
      alert(`Could not delete assessment: ${delError.message}`)
    } else {
      navigate('/admin/assessments')
    }
  }

  async function publishAssessment() {
    if (!assessmentId || !confirm('Publish this assessment? Students will be able to start it.'))
      return
    setPublishing(true)
    const { error: publishError } = await supabase.rpc('publish_assessment', {
      p_assessment_id: assessmentId,
    })
    setPublishing(false)
    if (publishError) setError(publishError.message)
    else fetchData()
  }

  if (loading) {
    return (
      <AdminLayout>
        <p className="text-slate-500">Loading assessment...</p>
      </AdminLayout>
    )
  }

  if (error || !assessment) {
    return (
      <AdminLayout>
        <p className="text-red-600 bg-red-50 p-4 rounded-lg">{error || 'Assessment not found.'}</p>
      </AdminLayout>
    )
  }

  const selectedExam = exams.find((e) => e.id === assessment.exam_id)

  return (
    <AdminLayout
      title={assessment.name}
      subtitle={assessment.description || undefined}
      actions={
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={openEditAssessmentModal}
            className="bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold px-3.5 py-2 rounded-lg transition flex items-center gap-1.5"
          >
            <span>⚙️</span> Edit Settings
          </button>

          {assessment.status === 'published' ? (
            <button
              onClick={() => setShowShareModal(true)}
              className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold px-4 py-2 rounded-lg transition flex items-center gap-1.5"
            >
              <span>🔗</span> Share Link
            </button>
          ) : (
            <button
              onClick={publishAssessment}
              disabled={publishing}
              className="bg-green-600 hover:bg-green-700 text-white text-xs font-semibold px-4 py-2 rounded-lg disabled:opacity-50 transition"
            >
              {publishing ? 'Publishing...' : '🚀 Publish Assessment'}
            </button>
          )}

          <Link
            to={`/admin/assessments/${assessmentId}/results`}
            className="bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-semibold px-3.5 py-2 rounded-lg transition"
          >
            Results
          </Link>
        </div>
      }
    >
      <div className="max-w-4xl space-y-6">
        {/* Assessment Overview Card */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <span
                className={`text-xs font-semibold px-2.5 py-0.5 rounded-full capitalize ${
                  assessment.status === 'published'
                    ? 'bg-emerald-100 text-emerald-800'
                    : assessment.status === 'draft'
                    ? 'bg-amber-100 text-amber-800'
                    : 'bg-slate-100 text-slate-700'
                }`}
              >
                Status: {assessment.status}
              </span>
              {selectedExam && (
                <span className="text-xs bg-purple-50 text-purple-700 border border-purple-200 font-medium px-2.5 py-0.5 rounded-full">
                  Exam Type: {selectedExam.name}
                </span>
              )}
            </div>

            <button
              onClick={openEditAssessmentModal}
              className="text-xs text-blue-600 hover:text-blue-800 font-semibold"
            >
              Edit Details & Instructions ↗
            </button>
          </div>

          {assessment.instructions && (
            <div className="bg-blue-50/70 border border-blue-100 rounded-lg p-3 text-xs text-slate-700">
              <span className="font-bold text-blue-900 block mb-1">
                Student Pre-Test Instructions:
              </span>
              <p className="whitespace-pre-wrap">{assessment.instructions}</p>
            </div>
          )}
        </div>

        {/* Modules Section */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-bold text-slate-900">Assessment Modules / Sections</h2>
              <p className="text-xs text-slate-500">
                Each module can have individual timing limits, shuffling, and questions.
              </p>
            </div>
            {!showNewModuleForm && (
              <button
                onClick={() => setShowNewModuleForm(true)}
                className="text-xs bg-blue-600 hover:bg-blue-700 text-white font-semibold px-3 py-2 rounded-lg"
              >
                + Add Module
              </button>
            )}
          </div>

          {modules.length === 0 && !showNewModuleForm && (
            <div className="text-center py-8 border-2 border-dashed border-slate-200 rounded-lg">
              <p className="text-sm font-medium text-slate-600">No modules added yet.</p>
              <p className="text-xs text-slate-400 mt-1">
                Add your first section (e.g. "Module 1: Reading & Writing" or "Math Section 1").
              </p>
            </div>
          )}

          <div className="space-y-3">
            {modules.map((mod, index) => (
              <div
                key={mod.id}
                className="border border-slate-200 rounded-lg p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50 hover:bg-slate-50 transition"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-400">#{index + 1}</span>
                    <h3 className="font-semibold text-sm text-slate-900">{mod.name}</h3>
                  </div>
                  {mod.description && (
                    <p className="text-xs text-slate-500 mt-0.5">{mod.description}</p>
                  )}
                  <div className="flex flex-wrap gap-2 mt-2 text-xs text-slate-500">
                    <span className="bg-white border border-slate-200 px-2 py-0.5 rounded">
                      {mod.timing_enabled ? `⏱ ${mod.time_limit_minutes} min limit` : 'Untimed'}
                    </span>
                    {mod.shuffle_questions && (
                      <span className="bg-white border border-slate-200 px-2 py-0.5 rounded">
                        🔀 Shuffled Questions
                      </span>
                    )}
                    {mod.shuffle_choices && (
                      <span className="bg-white border border-slate-200 px-2 py-0.5 rounded">
                        🔀 Shuffled Choices
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => moveModule(index, -1)}
                    disabled={index === 0}
                    title="Move Up"
                    className="text-xs px-2 py-1 rounded bg-slate-200 hover:bg-slate-300 disabled:opacity-30"
                  >
                    ↑
                  </button>
                  <button
                    onClick={() => moveModule(index, 1)}
                    disabled={index === modules.length - 1}
                    title="Move Down"
                    className="text-xs px-2 py-1 rounded bg-slate-200 hover:bg-slate-300 disabled:opacity-30"
                  >
                    ↓
                  </button>
                  <button
                    onClick={() => openEditModuleModal(mod)}
                    className="text-xs bg-slate-200 hover:bg-slate-300 text-slate-700 font-medium px-2.5 py-1.5 rounded-md"
                  >
                    ⚙️ Settings
                  </button>
                  <Link
                    to={`/admin/assessments/${assessmentId}/modules/${mod.id}`}
                    className="text-xs bg-blue-600 hover:bg-blue-700 text-white font-semibold px-3 py-1.5 rounded-md"
                  >
                    Questions →
                  </Link>
                  <button
                    onClick={() => deleteModule(mod.id)}
                    className="text-xs text-red-600 hover:text-red-800 px-2 py-1"
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* New Module Inline Form */}
          {showNewModuleForm && (
            <form
              onSubmit={handleCreateModule}
              className="mt-4 border border-blue-200 bg-blue-50/40 rounded-xl p-4 space-y-3"
            >
              <h3 className="text-xs font-bold uppercase tracking-wider text-blue-900">
                Create New Module
              </h3>

              <input
                type="text"
                placeholder="Module Name (e.g. Module 1: Algebra & Geometry)"
                value={newModuleName}
                onChange={(e) => setNewModuleName(e.target.value)}
                className="w-full text-sm bg-white border border-slate-300 rounded-lg px-3 py-2"
              />

              <textarea
                placeholder="Section instructions or description (optional)"
                value={newModuleDescription}
                onChange={(e) => setNewModuleDescription(e.target.value)}
                rows={2}
                className="w-full text-sm bg-white border border-slate-300 rounded-lg px-3 py-2"
              />

              <div className="flex flex-wrap items-center gap-4 text-xs text-slate-700">
                <label className="flex items-center gap-1.5 font-medium">
                  <input
                    type="checkbox"
                    checked={newTimingEnabled}
                    onChange={(e) => setNewTimingEnabled(e.target.checked)}
                  />
                  Enable Timing Limit
                </label>

                {newTimingEnabled && (
                  <div className="flex items-center gap-1.5">
                    <input
                      type="number"
                      min={1}
                      value={newTimeLimit}
                      onChange={(e) => setNewTimeLimit(Number(e.target.value))}
                      className="w-16 bg-white border border-slate-300 rounded px-2 py-1"
                    />
                    <span>minutes</span>
                  </div>
                )}

                <label className="flex items-center gap-1.5 font-medium">
                  <input
                    type="checkbox"
                    checked={newShuffleQuestions}
                    onChange={(e) => setNewShuffleQuestions(e.target.checked)}
                  />
                  Shuffle Questions
                </label>

                <label className="flex items-center gap-1.5 font-medium">
                  <input
                    type="checkbox"
                    checked={newShuffleChoices}
                    onChange={(e) => setNewShuffleChoices(e.target.checked)}
                  />
                  Shuffle Choices
                </label>
              </div>

              {newModuleError && <p className="text-xs text-red-600">{newModuleError}</p>}

              <div className="flex gap-2 pt-1">
                <button
                  type="submit"
                  disabled={savingNewModule}
                  className="text-xs bg-blue-600 hover:bg-blue-700 text-white font-semibold px-4 py-2 rounded-lg"
                >
                  {savingNewModule ? 'Saving...' : 'Add Module'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowNewModuleForm(false)}
                  className="text-xs bg-slate-200 text-slate-700 font-medium px-3 py-2 rounded-lg hover:bg-slate-300"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Danger Zone: Delete Assessment */}
        <div className="border border-red-200 bg-red-50/50 rounded-xl p-5 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-red-900">Danger Zone</h3>
            <p className="text-xs text-red-700 mt-0.5">
              Permanently delete this entire assessment and all assigned modules.
            </p>
          </div>
          <button
            onClick={deleteAssessment}
            className="text-xs bg-red-600 hover:bg-red-700 text-white font-semibold px-3 py-2 rounded-lg"
          >
            Delete Assessment
          </button>
        </div>
      </div>

      {/* ========================================================= */}
      {/* Assessment Settings Edit Modal */}
      {/* ========================================================= */}
      {showEditAssessmentModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4"
          role="dialog"
        >
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-lg w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="text-base font-bold text-slate-900">Edit Assessment Settings</h2>
              <button
                onClick={() => setShowEditAssessmentModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveAssessmentSettings} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Assessment Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Assessment Type / Target Exam
                </label>
                <select
                  value={editExamId}
                  onChange={(e) => setEditExamId(e.target.value)}
                  className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 bg-white"
                >
                  <option value="">— None / Custom —</option>
                  {exams.map((ex) => (
                    <option key={ex.id} value={ex.id}>
                      {ex.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Publication Status
                </label>
                <select
                  value={editStatus}
                  onChange={(e) =>
                    setEditStatus(e.target.value as 'draft' | 'published' | 'archived')
                  }
                  className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 bg-white"
                >
                  <option value="draft">Draft (Editing / Hidden)</option>
                  <option value="published">Published (Live for students)</option>
                  <option value="archived">Archived (Closed)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Short Description
                </label>
                <textarea
                  rows={2}
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  placeholder="Optional summary shown on the student intro screen"
                  className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Student Instructions
                </label>
                <textarea
                  rows={3}
                  value={editInstructions}
                  onChange={(e) => setEditInstructions(e.target.value)}
                  placeholder="Instructions displayed to students before starting"
                  className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2"
                />
              </div>

              {assessmentSaveError && (
                <p className="text-xs text-red-600 bg-red-50 p-2 rounded">{assessmentSaveError}</p>
              )}

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowEditAssessmentModal(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingAssessment}
                  className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {savingAssessment ? 'Saving...' : 'Save Settings'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* Module Settings Edit Modal */}
      {/* ========================================================= */}
      {editingModule && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4"
          role="dialog"
        >
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="text-base font-bold text-slate-900">Edit Module Settings</h2>
              <button
                onClick={() => setEditingModule(null)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveModuleSettings} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Module Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={moduleEditName}
                  onChange={(e) => setModuleEditName(e.target.value)}
                  className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Description / Instructions
                </label>
                <textarea
                  rows={2}
                  value={moduleEditDescription}
                  onChange={(e) => setModuleEditDescription(e.target.value)}
                  className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2"
                />
              </div>

              <div className="space-y-2 border border-slate-200 bg-slate-50 p-3 rounded-lg text-xs">
                <label className="flex items-center gap-2 font-semibold text-slate-800">
                  <input
                    type="checkbox"
                    checked={moduleEditTimingEnabled}
                    onChange={(e) => setModuleEditTimingEnabled(e.target.checked)}
                  />
                  Enable Timing Limit for this Module
                </label>

                {moduleEditTimingEnabled && (
                  <div className="flex items-center gap-2 pl-5 pt-1">
                    <span className="text-slate-600">Time limit:</span>
                    <input
                      type="number"
                      min={1}
                      value={moduleEditTimeLimit}
                      onChange={(e) => setModuleEditTimeLimit(Number(e.target.value))}
                      className="w-20 bg-white border border-slate-300 rounded px-2 py-1 font-mono"
                    />
                    <span className="text-slate-600">minutes</span>
                  </div>
                )}
              </div>

              <div className="space-y-2 border border-slate-200 bg-slate-50 p-3 rounded-lg text-xs">
                <label className="flex items-center gap-2 font-semibold text-slate-800">
                  <input
                    type="checkbox"
                    checked={moduleEditShuffleQuestions}
                    onChange={(e) => setModuleEditShuffleQuestions(e.target.checked)}
                  />
                  Shuffle Question Order per Student Attempt
                </label>

                <label className="flex items-center gap-2 font-semibold text-slate-800">
                  <input
                    type="checkbox"
                    checked={moduleEditShuffleChoices}
                    onChange={(e) => setModuleEditShuffleChoices(e.target.checked)}
                  />
                  Shuffle Multiple Choice Options
                </label>
              </div>

              {moduleEditError && (
                <p className="text-xs text-red-600 bg-red-50 p-2 rounded">{moduleEditError}</p>
              )}

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingModule(null)}
                  className="px-4 py-2 text-xs font-medium text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingModuleEdit}
                  className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {savingModuleEdit ? 'Saving...' : 'Save Module'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Share Modal */}
      <ShareAssessmentModal
        assessmentId={assessment.id}
        assessmentName={assessment.name}
        isOpen={showShareModal}
        onClose={() => setShowShareModal(false)}
      />
    </AdminLayout>
  )
}