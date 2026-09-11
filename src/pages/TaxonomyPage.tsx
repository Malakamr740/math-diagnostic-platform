import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'

interface RawRow {
  id: string
  name: string
  description: string | null
  is_active: boolean
  parent_id: string | null
}

interface TaxonomyNode extends RawRow {
  children: TaxonomyNode[]
}

interface LevelConfig {
  key: string
  table: string
  parentColumn: string | null // null only for the root level (exams)
  label: string
}

const LEVELS: LevelConfig[] = [
  { key: 'exam', table: 'exams', parentColumn: null, label: 'Exam' },
  { key: 'subject', table: 'subjects', parentColumn: 'exam_id', label: 'Subject' },
  { key: 'category', table: 'categories', parentColumn: 'subject_id', label: 'Category' },
  { key: 'chapter', table: 'chapters', parentColumn: 'category_id', label: 'Chapter' },
  { key: 'lesson', table: 'lessons', parentColumn: 'chapter_id', label: 'Lesson' },
  { key: 'skill', table: 'skills', parentColumn: 'lesson_id', label: 'Skill' },
]

export default function TaxonomyPage() {
  const [tree, setTree] = useState<TaxonomyNode[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [orgId, setOrgId] = useState<string | null>(null)

  useEffect(() => {
    fetchAll()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function fetchAll() {
    setLoading(true)
    setError(null)

    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      setError('You must be logged in.')
      setLoading(false)
      return
    }
    const { data: profile } = await supabase
      .from('profiles')
      .select('organization_id')
      .eq('id', user.id)
      .single()
    if (!profile) {
      setError('Could not determine your organization.')
      setLoading(false)
      return
    }
    setOrgId(profile.organization_id)

    // Fetch every level's rows in parallel, each normalized to {id, name,
    // description, is_active, parent_id} so the tree-building step below
    // doesn't need to know each table's real parent-column name.
    const results = await Promise.all(
      LEVELS.map((level) =>
        level.parentColumn === null
          ? supabase
              .from(level.table)
              .select('id, name, description, is_active')
              .eq('organization_id', profile.organization_id)
          : supabase.from(level.table).select(`id, name, description, is_active, ${level.parentColumn}`)
      )
    )

    for (const r of results) {
      if (r.error) {
        setError(r.error.message)
        setLoading(false)
        return
      }
    }

    const rowsByLevel: RawRow[][] = results.map((r, i) => {
      const parentCol = LEVELS[i].parentColumn
      return (r.data ?? []).map((row: any) => ({
        id: row.id,
        name: row.name,
        description: row.description,
        is_active: row.is_active,
        parent_id: parentCol ? row[parentCol] : null,
      }))
    })

    // Build the tree bottom-up: attach skills to lessons, lessons to
    // chapters, etc., ending with a fully-nested array of exam roots.
    let currentLevelNodes: TaxonomyNode[] = rowsByLevel[LEVELS.length - 1].map((r) => ({
      ...r,
      children: [],
    }))

    for (let i = LEVELS.length - 2; i >= 0; i--) {
      const parentRows = rowsByLevel[i]
      const childrenByParent = new Map<string, TaxonomyNode[]>()
      for (const child of currentLevelNodes) {
        if (!child.parent_id) continue
        const list = childrenByParent.get(child.parent_id) ?? []
        list.push(child)
        childrenByParent.set(child.parent_id, list)
      }
      currentLevelNodes = parentRows.map((r) => ({
        ...r,
        children: childrenByParent.get(r.id) ?? [],
      }))
    }

    setTree(currentLevelNodes)
    setLoading(false)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100">
        <p className="text-slate-600">Loading taxonomy...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-100">
      <header className="bg-white border-b border-slate-200 px-6 py-4">
        <Link to="/admin" className="text-sm text-blue-600 hover:underline">
          ← Back to Dashboard
        </Link>
        <h1 className="text-xl font-semibold text-slate-800 mt-1">Taxonomy</h1>
        <p className="text-sm text-slate-500 mt-1">
          Exam → Subject → Category → Chapter → Lesson → Skill
        </p>
      </header>

      <main className="p-6 max-w-4xl mx-auto space-y-3">
        {error && <p className="text-sm text-red-600 bg-red-50 rounded-md px-3 py-2">{error}</p>}

        {tree.length === 0 && (
          <p className="text-slate-600 bg-white rounded-lg border border-slate-200 p-6 text-center">
            No exams yet.
          </p>
        )}

        {tree.map((node) => (
          <TaxonomyNodeRow key={node.id} node={node} levelIndex={0} orgId={orgId} onRefresh={fetchAll} />
        ))}

        <AddNodeForm levelIndex={0} parentId={null} orgId={orgId} onAdded={fetchAll} />
      </main>
    </div>
  )
}

// ============================================================
// One row in the tree — expandable, editable, deletable, and
// able to spawn a child of the next level down.
// ============================================================

function TaxonomyNodeRow({
  node,
  levelIndex,
  orgId,
  onRefresh,
}: {
  node: TaxonomyNode
  levelIndex: number
  orgId: string | null
  onRefresh: () => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editName, setEditName] = useState(node.name)
  const [editDescription, setEditDescription] = useState(node.description ?? '')
  const [saving, setSaving] = useState(false)
  const [rowError, setRowError] = useState<string | null>(null)

  const level = LEVELS[levelIndex]
  const isLastLevel = levelIndex === LEVELS.length - 1
  const indentPx = levelIndex * 20

  async function saveEdit() {
    if (!editName.trim()) return
    setSaving(true)
    const { error } = await supabase
      .from(level.table)
      .update({ name: editName.trim(), description: editDescription.trim() || null })
      .eq('id', node.id)
    setSaving(false)
    if (error) {
      setRowError(error.message)
      return
    }
    setEditing(false)
    onRefresh()
  }

  async function toggleActive() {
    const { error } = await supabase
      .from(level.table)
      .update({ is_active: !node.is_active })
      .eq('id', node.id)
    if (error) {
      setRowError(error.message)
      return
    }
    onRefresh()
  }

  async function handleDelete() {
    if (node.children.length > 0) {
      setRowError(`Remove all ${level.label.toLowerCase()} children first before deleting this.`)
      return
    }
    if (!confirm(`Delete this ${level.label.toLowerCase()}?`)) return
    const { error } = await supabase.from(level.table).delete().eq('id', node.id)
    if (error) {
      setRowError(
        error.message.includes('violates foreign key')
          ? `Can't delete — something still references this ${level.label.toLowerCase()}.`
          : error.message
      )
      return
    }
    onRefresh()
  }

  return (
    <div>
      <div
        className="flex items-center justify-between bg-white border border-slate-200 rounded-md px-3 py-2 mb-1"
        style={{ marginLeft: indentPx }}
      >
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <button
            onClick={() => setExpanded((e) => !e)}
            className="text-slate-400 hover:text-slate-700 w-4 shrink-0"
            aria-label="Toggle expand"
          >
            {isLastLevel ? '·' : expanded ? '▾' : '▸'}
          </button>

          {editing ? (
            <div className="flex-1 flex flex-col gap-1 py-1">
              <input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="rounded border border-slate-300 px-2 py-1 text-sm"
                placeholder="Name"
              />
              <input
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                className="rounded border border-slate-300 px-2 py-1 text-sm"
                placeholder="Description (optional)"
              />
            </div>
          ) : (
            <div className="min-w-0">
              <span className={`text-sm font-medium ${node.is_active ? 'text-slate-800' : 'text-slate-400 line-through'}`}>
                {node.name}
              </span>
              <span className="text-xs text-slate-400 ml-2">{level.label}</span>
              {node.description && (
                <p className="text-xs text-slate-500 truncate">{node.description}</p>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0 ml-2">
          {editing ? (
            <>
              <button
                onClick={saveEdit}
                disabled={saving}
                className="text-xs bg-blue-600 text-white px-2 py-1 rounded hover:bg-blue-700 disabled:opacity-50"
              >
                Save
              </button>
              <button
                onClick={() => {
                  setEditing(false)
                  setEditName(node.name)
                  setEditDescription(node.description ?? '')
                }}
                className="text-xs bg-slate-200 text-slate-700 px-2 py-1 rounded hover:bg-slate-300"
              >
                Cancel
              </button>
            </>
          ) : (
            <>
              <label className="flex items-center gap-1 text-xs text-slate-500 mr-1">
                <input type="checkbox" checked={node.is_active} onChange={toggleActive} />
                Active
              </label>
              <button
                onClick={() => setEditing(true)}
                className="text-xs bg-slate-100 text-slate-700 px-2 py-1 rounded hover:bg-slate-200"
              >
                Edit
              </button>
              <button
                onClick={handleDelete}
                className="text-xs bg-red-50 text-red-700 px-2 py-1 rounded hover:bg-red-100"
              >
                Delete
              </button>
            </>
          )}
        </div>
      </div>

      {rowError && (
        <p className="text-xs text-red-600 bg-red-50 rounded px-2 py-1 mb-1" style={{ marginLeft: indentPx }}>
          {rowError}
        </p>
      )}

      {expanded && !isLastLevel && (
        <div>
          {node.children.map((child) => (
            <TaxonomyNodeRow
              key={child.id}
              node={child}
              levelIndex={levelIndex + 1}
              orgId={orgId}
              onRefresh={onRefresh}
            />
          ))}
          <div style={{ marginLeft: indentPx + 20 }}>
            <AddNodeForm levelIndex={levelIndex + 1} parentId={node.id} orgId={orgId} onAdded={onRefresh} />
          </div>
        </div>
      )}
    </div>
  )
}

// ============================================================
// Inline "+ Add" form for creating a new node at a given level,
// under a given parent (or no parent, for the root exam level).
// ============================================================

function AddNodeForm({
  levelIndex,
  parentId,
  orgId,
  onAdded,
}: {
  levelIndex: number
  parentId: string | null
  orgId: string | null
  onAdded: () => void
}) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const level = LEVELS[levelIndex]

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setSaving(true)
    setError(null)

    const row: Record<string, unknown> = {
      name: name.trim(),
      description: description.trim() || null,
    }
    if (level.parentColumn === null) {
      row.organization_id = orgId
    } else {
      row[level.parentColumn] = parentId
    }

    const { error: insertError } = await supabase.from(level.table).insert(row)

    setSaving(false)

    if (insertError) {
      setError(insertError.message)
      return
    }

    setName('')
    setDescription('')
    setOpen(false)
    onAdded()
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="text-xs text-blue-600 hover:underline py-1"
      >
        + Add {level.label}
      </button>
    )
  }

  return (
    <form onSubmit={handleAdd} className="flex flex-col gap-1 bg-blue-50 border border-blue-100 rounded-md p-2 my-1 max-w-sm">
      <input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder={`${level.label} name`}
        className="rounded border border-slate-300 px-2 py-1 text-sm"
      />
      <input
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Description (optional)"
        className="rounded border border-slate-300 px-2 py-1 text-sm"
      />
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={saving}
          className="text-xs bg-blue-600 text-white px-2 py-1 rounded hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? 'Saving...' : `Add ${level.label}`}
        </button>
        <button
          type="button"
          onClick={() => {
            setOpen(false)
            setName('')
            setDescription('')
            setError(null)
          }}
          className="text-xs bg-slate-200 text-slate-700 px-2 py-1 rounded hover:bg-slate-300"
        >
          Cancel
        </button>
      </div>
    </form>
  )
}