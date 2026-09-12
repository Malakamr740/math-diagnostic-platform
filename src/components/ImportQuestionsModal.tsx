import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../lib/supabaseClient'
import { parseContentText } from '../lib/contentBlocks'
import ContentBlockRenderer from './ContentBlockRenderer'

interface ImportQuestionsModalProps {
  isOpen: boolean
  onClose: () => void
  onImportComplete: () => void
}

interface RawImportItem {
  question: string
  type: 'MCQ' | 'TRUE_FALSE' | 'GRID_IN'
  difficulty?: 'easy' | 'medium' | 'hard'
  points?: number
  exam?: string
  subject?: string
  category?: string
  chapter?: string
  lesson?: string
  skill?: string
  explanation?: string
  choices?: Array<{ text: string; is_correct: boolean }>
  correct_answer?: number | boolean | string
  tolerance?: number
}

interface ExtractedTaxonomy {
  exams: string[]
  subjects: string[]
  categories: string[]
  chapters: string[]
  lessons: string[]
  skills: string[]
  categoryCounts: Record<string, number>
}

export default function ImportQuestionsModal({
  isOpen,
  onClose,
  onImportComplete,
}: ImportQuestionsModalProps) {
  const [jsonText, setJsonText] = useState('')
  const [parsedItems, setParsedItems] = useState<RawImportItem[]>([])
  const [parseError, setParseError] = useState<string | null>(null)

  // Extracted Taxonomy directly from the uploaded JSON
  const [extractedTaxonomy, setExtractedTaxonomy] = useState<ExtractedTaxonomy>({
    exams: [],
    subjects: [],
    categories: [],
    chapters: [],
    lessons: [],
    skills: [],
    categoryCounts: {},
  })

  // Global Defaults / Fallbacks
  const [defaultExam, setDefaultExam] = useState('EST I')
  const [defaultSubject, setDefaultSubject] = useState('Math')

  // Filter preview by detected category
  const [previewCategoryFilter, setPreviewCategoryFilter] = useState('ALL')

  // Currently editing index
  const [activeEditingIdx, setActiveEditingIdx] = useState<number | null>(null)

  const [importing, setImporting] = useState(false)
  const [importProgress, setImportProgress] = useState('')

  useEffect(() => {
    if (isOpen && jsonText) validateAndExtract(jsonText)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen])

  if (!isOpen) return null

  function validateAndExtract(text: string) {
    setParseError(null)
    if (!text.trim()) {
      setParsedItems([])
      setExtractedTaxonomy({
        exams: [],
        subjects: [],
        categories: [],
        chapters: [],
        lessons: [],
        skills: [],
        categoryCounts: {},
      })
      return
    }

    try {
      const data = JSON.parse(text)
      if (!Array.isArray(data)) {
        setParseError('The JSON root must be an array: [ { ... }, { ... } ]')
        setParsedItems([])
        return
      }

      const examsSet = new Set<string>()
      const subjectsSet = new Set<string>()
      const categoriesSet = new Set<string>()
      const chaptersSet = new Set<string>()
      const lessonsSet = new Set<string>()
      const skillsSet = new Set<string>()
      const counts: Record<string, number> = {}

      for (let i = 0; i < data.length; i++) {
        const item = data[i]
        if (!item.question || typeof item.question !== 'string') {
          setParseError(`Question #${i + 1} is missing a "question" text string.`)
          setParsedItems([])
          return
        }
        if (!['MCQ', 'TRUE_FALSE', 'GRID_IN'].includes(item.type)) {
          setParseError(
            `Question #${i + 1} has invalid type "${item.type}". Must be MCQ, TRUE_FALSE, or GRID_IN.`
          )
          setParsedItems([])
          return
        }
        if (item.type === 'MCQ') {
          if (!Array.isArray(item.choices) || item.choices.length < 2) {
            setParseError(`Question #${i + 1} (MCQ) must have at least 2 choices.`)
            setParsedItems([])
            return
          }
          if (!item.choices.some((c: any) => c.is_correct === true)) {
            setParseError(
              `Question #${i + 1} (MCQ) must have at least one choice with "is_correct": true.`
            )
            setParsedItems([])
            return
          }
        }

        // Extract taxonomy strings from JSON
        if (item.exam?.trim()) examsSet.add(item.exam.trim())
        if (item.subject?.trim()) subjectsSet.add(item.subject.trim())
        if (item.category?.trim()) {
          const cat = item.category.trim()
          categoriesSet.add(cat)
          counts[cat] = (counts[cat] || 0) + 1
        }
        if (item.chapter?.trim()) chaptersSet.add(item.chapter.trim())
        if (item.lesson?.trim()) lessonsSet.add(item.lesson.trim())
        if (item.skill?.trim()) skillsSet.add(item.skill.trim())
      }

      setParsedItems(data)
      setExtractedTaxonomy({
        exams: Array.from(examsSet),
        subjects: Array.from(subjectsSet),
        categories: Array.from(categoriesSet),
        chapters: Array.from(chaptersSet),
        lessons: Array.from(lessonsSet),
        skills: Array.from(skillsSet),
        categoryCounts: counts,
      })

      if (examsSet.size > 0 && !defaultExam) {
        setDefaultExam(Array.from(examsSet)[0])
      }
      if (subjectsSet.size > 0 && !defaultSubject) {
        setDefaultSubject(Array.from(subjectsSet)[0])
      }
    } catch (err: any) {
      setParseError(`Invalid JSON syntax: ${err.message}`)
      setParsedItems([])
    }
  }

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (event) => {
      const content = event.target?.result as string
      setJsonText(content)
      validateAndExtract(content)
    }
    reader.readAsText(file)
  }

  function updateQuestionTaxonomyField(
    idx: number,
    field: 'category' | 'chapter' | 'lesson' | 'skill',
    value: string
  ) {
    const next = [...parsedItems]
    next[idx] = { ...next[idx], [field]: value }
    setParsedItems(next)
  }

  // Filtered Preview items
  const filteredPreview = useMemo(() => {
    if (previewCategoryFilter === 'ALL') return parsedItems
    return parsedItems.filter(
      (item) => (item.category || 'Uncategorized') === previewCategoryFilter
    )
  }, [parsedItems, previewCategoryFilter])

  async function handleImport() {
    if (parsedItems.length === 0) return
    setImporting(true)
    setImportProgress('Authenticating...')

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) throw new Error('You must be logged in.')

      const { data: profile } = await supabase
        .from('profiles')
        .select('organization_id')
        .eq('id', user.id)
        .single()
      if (!profile) throw new Error('Could not identify organization.')

      // Fetch Answer Type IDs
      const { data: answerTypes } = await supabase.from('answer_types').select('id, code')
      const typeMap = new Map<string, string>()
      answerTypes?.forEach((at) => typeMap.set(at.code, at.id))

      // Process each question individually with its own resolved taxonomy
      for (let i = 0; i < parsedItems.length; i++) {
        const item = parsedItems[i]
        setImportProgress(`Importing question ${i + 1} of ${parsedItems.length}...`)

        const typeId = typeMap.get(item.type)
        if (!typeId) throw new Error(`Unknown answer type: ${item.type}`)

        let taxIds = {
          exam_id: null as string | null,
          subject_id: null as string | null,
          category_id: null as string | null,
          chapter_id: null as string | null,
          lesson_id: null as string | null,
          skill_id: null as string | null,
        }

        const examName = item.exam || defaultExam || null
        const subjectName = item.subject || defaultSubject || null
        const categoryName = item.category || null
        const chapterName = item.chapter || null
        const lessonName = item.lesson || null
        const skillName = item.skill || null

        // Resolve or create full 6-level taxonomy hierarchy for this specific question
        if (examName) {
          const { data: taxData, error: taxError } = await supabase.rpc(
            'resolve_or_create_taxonomy',
            {
              p_org_id: profile.organization_id,
              p_exam: examName,
              p_subject: subjectName,
              p_category: categoryName,
              p_chapter: chapterName,
              p_lesson: lessonName,
              p_skill: skillName,
            }
          )

          if (!taxError && taxData && taxData.length > 0) {
            taxIds = taxData[0]
          }
        }

        const contentBlocks = parseContentText(item.question)
        const explanationBlocks = item.explanation ? parseContentText(item.explanation) : []

        // 1. Insert Question Row
        const { data: insertedQuestion, error: qError } = await supabase
          .from('questions')
          .insert({
            organization_id: profile.organization_id,
            answer_type_id: typeId,
            content_blocks: contentBlocks,
            explanation_blocks: explanationBlocks,
            difficulty: item.difficulty || 'medium',
            points: item.points || 1,
            exam_id: taxIds.exam_id,
            subject_id: taxIds.subject_id,
            category_id: taxIds.category_id,
            chapter_id: taxIds.chapter_id,
            lesson_id: taxIds.lesson_id,
            skill_id: taxIds.skill_id,
            status: 'published',
          })
          .select('id')
          .single()

        if (qError || !insertedQuestion) {
          throw new Error(`Failed to import item #${i + 1}: ${qError?.message}`)
        }

        // 2. Insert Choices or Correct Answer Rows
        if (item.type === 'MCQ' && item.choices) {
          const choiceRows = item.choices.map((c, cIdx) => ({
            question_id: insertedQuestion.id,
            content_blocks: parseContentText(c.text),
            is_correct: !!c.is_correct,
            display_order: cIdx,
          }))
          const { error: cError } = await supabase.from('question_choices').insert(choiceRows)
          if (cError) throw new Error(`Failed to save choices for #${i + 1}: ${cError.message}`)
        } else if (item.type === 'TRUE_FALSE') {
          const { error: tfError } = await supabase.from('question_correct_answers').insert({
            question_id: insertedQuestion.id,
            answer_data: { value: Boolean(item.correct_answer) },
          })
          if (tfError) throw new Error(`Failed to save answer for #${i + 1}: ${tfError.message}`)
        } else if (item.type === 'GRID_IN') {
          const { error: giError } = await supabase.from('question_correct_answers').insert({
            question_id: insertedQuestion.id,
            answer_data: {
              value: Number(item.correct_answer),
              tolerance: item.tolerance ? Number(item.tolerance) : 0,
            },
          })
          if (giError)
            throw new Error(`Failed to save numeric answer for #${i + 1}: ${giError.message}`)
        }
      }

      setImporting(false)
      onImportComplete()
      onClose()
    } catch (err: any) {
      setImporting(false)
      setParseError(err.message || 'Import failed.')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-4xl w-full p-6 space-y-4 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h2 className="text-base font-bold text-slate-900">Bulk Import Questions from JSON</h2>
            <p className="text-xs text-slate-500">
              Categories, Chapters, Lessons, and Skills are automatically parsed into dropdowns.
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1">
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto space-y-4 pr-1">
          {/* JSON Paste / Upload Area */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-slate-700">JSON Input</label>
              <label className="text-xs text-blue-600 hover:text-blue-800 font-medium cursor-pointer">
                📁 Upload .json file
                <input type="file" accept=".json" onChange={handleFileUpload} className="hidden" />
              </label>
            </div>
            <textarea
              rows={7}
              value={jsonText}
              onChange={(e) => {
                setJsonText(e.target.value)
                validateAndExtract(e.target.value)
              }}
              className="w-full text-xs font-mono border border-slate-300 rounded-lg p-3 leading-relaxed focus:border-blue-500 focus:outline-none"
              placeholder="Paste the JSON array containing questions and taxonomy here..."
            />
          </div>

          {parseError && (
            <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg p-2.5">
              ❌ {parseError}
            </p>
          )}

          {/* Extracted Taxonomy Summary Banner */}
          {parsedItems.length > 0 && !parseError && (
            <div className="bg-blue-50/70 border border-blue-200 rounded-xl p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-blue-900 uppercase tracking-wider">
                  📦 Automatically Detected in this JSON:
                </span>
                <span className="text-xs font-semibold text-blue-700">
                  {parsedItems.length} Total Questions
                </span>
              </div>

              {/* Detected Domains Pills */}
              <div className="flex flex-wrap gap-2 pt-1">
                {extractedTaxonomy.categories.map((cat) => (
                  <span
                    key={cat}
                    className="bg-white border border-blue-200 text-blue-800 font-bold text-xs px-2.5 py-1 rounded-lg shadow-2xs flex items-center gap-1.5"
                  >
                    <span>📁</span> {cat}
                    <span className="bg-blue-100 text-blue-900 px-1.5 py-0.2 rounded-full text-[11px]">
                      {extractedTaxonomy.categoryCounts[cat] || 0}
                    </span>
                  </span>
                ))}
              </div>

              <div className="text-[11px] text-blue-700 flex flex-wrap gap-4 pt-1 font-medium">
                <span>📖 {extractedTaxonomy.chapters.length} Unique Chapters</span>
                <span>📝 {extractedTaxonomy.lessons.length} Unique Lessons</span>
                <span>🎯 {extractedTaxonomy.skills.length} Unique Skills</span>
              </div>
            </div>
          )}

          {/* Target Exam Fallback Configuration */}
          <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs">
            <div>
              <label className="font-semibold text-slate-700 block mb-1">
                Default Target Exam
              </label>
              <input
                type="text"
                value={defaultExam}
                onChange={(e) => setDefaultExam(e.target.value)}
                placeholder="e.g. EST I, SAT, or ACT"
                className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5"
              />
            </div>
            <div>
              <label className="font-semibold text-slate-700 block mb-1">
                Default Subject
              </label>
              <input
                type="text"
                value={defaultSubject}
                onChange={(e) => setDefaultSubject(e.target.value)}
                placeholder="e.g. Math"
                className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5"
              />
            </div>
          </div>

          {/* Interactive Question Preview List with JSON-Populated Dropdowns */}
          {parsedItems.length > 0 && !parseError && (
            <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/40 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Question Preview ({filteredPreview.length} items shown)
                </h3>

                {/* Filter Preview by Category Dropdown */}
                {extractedTaxonomy.categories.length > 1 && (
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-slate-500 font-medium">Filter Preview:</span>
                    <select
                      value={previewCategoryFilter}
                      onChange={(e) => setPreviewCategoryFilter(e.target.value)}
                      className="bg-white border border-slate-300 rounded-lg px-2.5 py-1 font-semibold text-slate-800"
                    >
                      <option value="ALL">Show All Categories ({parsedItems.length})</option>
                      {extractedTaxonomy.categories.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat} ({extractedTaxonomy.categoryCounts[cat] || 0})
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
                {filteredPreview.map((item, idx) => {
                  const originalIndex = parsedItems.indexOf(item)

                  return (
                    <div
                      key={originalIndex}
                      className="bg-white border border-slate-200 rounded-xl p-4 text-xs space-y-2.5 shadow-2xs"
                    >
                      <div className="flex items-center justify-between gap-2 flex-wrap pb-2 border-b border-slate-100">
                        <div className="flex items-center gap-2">
                          <span className="font-extrabold text-slate-900">
                            #{originalIndex + 1}
                          </span>
                          <span className="bg-slate-100 text-slate-700 font-bold px-2 py-0.5 rounded">
                            {item.type}
                          </span>
                          <span className="capitalize text-slate-500">
                            {item.difficulty || 'medium'} &middot; {item.points || 1} pt
                          </span>
                        </div>

                        <button
                          type="button"
                          onClick={() =>
                            setActiveEditingIdx(
                              activeEditingIdx === originalIndex ? null : originalIndex
                            )
                          }
                          className="text-xs bg-blue-50 text-blue-700 hover:bg-blue-100 font-semibold px-2.5 py-1 rounded-md"
                        >
                          {activeEditingIdx === originalIndex
                            ? 'Close Dropdown Editor'
                            : '✏️ Edit Classification'}
                        </button>
                      </div>

                      {/* Question Content */}
                      <div className="text-slate-900 font-medium">
                        <ContentBlockRenderer blocks={parseContentText(item.question)} />
                      </div>

                      {/* Individual Taxonomy Badges */}
                      <div className="flex flex-wrap items-center gap-1.5 text-[11px] pt-1">
                        <span className="text-slate-400 font-semibold">Tags:</span>
                        {item.category && (
                          <span className="bg-blue-50 text-blue-700 border border-blue-200 font-bold px-2 py-0.5 rounded">
                            📁 {item.category}
                          </span>
                        )}
                        {item.chapter && (
                          <span className="bg-purple-50 text-purple-700 border border-purple-200 font-medium px-2 py-0.5 rounded">
                            📖 {item.chapter}
                          </span>
                        )}
                        {item.lesson && (
                          <span className="bg-amber-50 text-amber-800 border border-amber-200 font-medium px-2 py-0.5 rounded">
                            📝 {item.lesson}
                          </span>
                        )}
                        {item.skill && (
                          <span className="bg-emerald-50 text-emerald-800 border border-emerald-200 font-semibold px-2 py-0.5 rounded">
                            🎯 {item.skill}
                          </span>
                        )}
                      </div>

                      {/* Dropdown Menu Editor Populated from the JSON */}
                      {activeEditingIdx === originalIndex && (
                        <div className="mt-3 p-3.5 bg-blue-50/70 border border-blue-200 rounded-xl space-y-3">
                          <span className="font-bold text-blue-900 text-xs block">
                            Select or Change Classification for Question #{originalIndex + 1}:
                          </span>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {/* Category Dropdown */}
                            <div>
                              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                                Domain / Category
                              </label>
                              <select
                                value={item.category || ''}
                                onChange={(e) =>
                                  updateQuestionTaxonomyField(
                                    originalIndex,
                                    'category',
                                    e.target.value
                                  )
                                }
                                className="w-full bg-white border border-slate-300 rounded px-2 py-1.5 text-xs font-semibold"
                              >
                                <option value="">— None —</option>
                                {extractedTaxonomy.categories.map((c) => (
                                  <option key={c} value={c}>
                                    {c}
                                  </option>
                                ))}
                              </select>
                            </div>

                            {/* Chapter Dropdown */}
                            <div>
                              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                                Chapter
                              </label>
                              <select
                                value={item.chapter || ''}
                                onChange={(e) =>
                                  updateQuestionTaxonomyField(
                                    originalIndex,
                                    'chapter',
                                    e.target.value
                                  )
                                }
                                className="w-full bg-white border border-slate-300 rounded px-2 py-1.5 text-xs font-semibold"
                              >
                                <option value="">— None —</option>
                                {extractedTaxonomy.chapters.map((ch) => (
                                  <option key={ch} value={ch}>
                                    {ch}
                                  </option>
                                ))}
                              </select>
                            </div>

                            {/* Lesson Dropdown */}
                            <div>
                              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                                Lesson
                              </label>
                              <select
                                value={item.lesson || ''}
                                onChange={(e) =>
                                  updateQuestionTaxonomyField(
                                    originalIndex,
                                    'lesson',
                                    e.target.value
                                  )
                                }
                                className="w-full bg-white border border-slate-300 rounded px-2 py-1.5 text-xs font-semibold"
                              >
                                <option value="">— None —</option>
                                {extractedTaxonomy.lessons.map((l) => (
                                  <option key={l} value={l}>
                                    {l}
                                  </option>
                                ))}
                              </select>
                            </div>

                            {/* Skill Dropdown / Input */}
                            <div>
                              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                                Skill
                              </label>
                              <select
                                value={item.skill || ''}
                                onChange={(e) =>
                                  updateQuestionTaxonomyField(
                                    originalIndex,
                                    'skill',
                                    e.target.value
                                  )
                                }
                                className="w-full bg-white border border-slate-300 rounded px-2 py-1.5 text-xs font-semibold"
                              >
                                <option value="">— None —</option>
                                {extractedTaxonomy.skills.map((s) => (
                                  <option key={s} value={s}>
                                    {s}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between pt-3 border-t border-slate-100">
          <span className="text-xs text-slate-500 font-medium">{importProgress}</span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={importing}
              className="px-4 py-2 text-xs font-medium text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleImport}
              disabled={importing || parsedItems.length === 0 || !!parseError}
              className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {importing ? 'Importing...' : `Import ${parsedItems.length} Questions`}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}