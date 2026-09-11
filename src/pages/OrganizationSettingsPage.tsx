import { useEffect, useState } from 'react'
import AdminLayout from '../components/AdminLayout'
import DynamicRegistrationField from '../components/DynamicRegistrationField'
import { supabase } from '../lib/supabaseClient'

export type FieldType =
  | 'text'
  | 'email'
  | 'phone'
  | 'number'
  | 'dropdown'
  | 'radio'
  | 'checkbox'
  | 'date'
  | 'textarea'

export interface RegistrationField {
  id: string
  organization_id?: string
  label: string
  field_key: string
  field_type: FieldType
  is_required: boolean
  options: string[] | null
  display_order: number
  is_active: boolean
}

const FIELD_TYPE_LABELS: Record<FieldType, string> = {
  text: 'Short Text',
  email: 'Email Address',
  phone: 'Phone Number',
  number: 'Number',
  dropdown: 'Dropdown Select',
  radio: 'Single Choice (Radio)',
  checkbox: 'Multiple Choice (Checkboxes)',
  date: 'Date Picker',
  textarea: 'Long Paragraph / Notes',
}

export default function OrganizationSettingsPage() {
  const [fields, setFields] = useState<RegistrationField[]>([])
  const [orgId, setOrgId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  // Branding & Marketing state
  const [tagline, setTagline] = useState('')
  const [phone, setPhone] = useState('')
  const [whatsapp, setWhatsapp] = useState('')
  const [websiteUrl, setWebsiteUrl] = useState('')
  const [savingSettings, setSavingSettings] = useState(false)
  const [settingsSavedMessage, setSettingsSavedMessage] = useState(false)

  // Add / Edit Field Modal State
  const [modalMode, setModalMode] = useState<'create' | 'edit' | null>(null)
  const [editingFieldId, setEditingFieldId] = useState<string | null>(null)
  const [fieldLabel, setFieldLabel] = useState('')
  const [fieldKey, setFieldKey] = useState('')
  const [fieldType, setFieldType] = useState<FieldType>('text')
  const [isRequired, setIsRequired] = useState(true)
  const [optionsText, setOptionsText] = useState('') // newline or comma separated
  const [savingField, setSavingField] = useState(false)
  const [fieldError, setFieldError] = useState<string | null>(null)

  // Interactive Live Preview State
  const [previewValues, setPreviewValues] = useState<Record<string, string>>({})

  useEffect(() => {
    fetchData()
  }, [])

  async function fetchData() {
    setLoading(true)
    const { data: orgData } = await supabase.from('organizations').select('id').limit(1).single()
    if (orgData) setOrgId(orgData.id)

    const [{ data: fieldData }, { data: orgSettings }] = await Promise.all([
      supabase.from('registration_fields').select('*').order('display_order'),
      supabase.from('organization_settings').select('*').limit(1).maybeSingle(),
    ])

    setFields((fieldData as RegistrationField[]) ?? [])
    if (orgSettings) {
      setTagline(orgSettings.marketing_tagline ?? '')
      setPhone(orgSettings.contact_phone ?? '')
      setWhatsapp(orgSettings.whatsapp_url ?? '')
      setWebsiteUrl(orgSettings.website_url ?? '')
    }
    setLoading(false)
  }

  function slugify(text: string): string {
    return text
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
  }

  function handleLabelChange(value: string) {
    setFieldLabel(value)
    if (modalMode === 'create') {
      setFieldKey(slugify(value))
    }
  }

  function openCreateModal() {
    setModalMode('create')
    setEditingFieldId(null)
    setFieldLabel('')
    setFieldKey('')
    setFieldType('text')
    setIsRequired(true)
    setOptionsText('')
    setFieldError(null)
  }

  function openEditModal(field: RegistrationField) {
    setModalMode('edit')
    setEditingFieldId(field.id)
    setFieldLabel(field.label)
    setFieldKey(field.field_key)
    setFieldType(field.field_type)
    setIsRequired(field.is_required)
    setOptionsText(field.options ? field.options.join('\n') : '')
    setFieldError(null)
  }

  const needsOptions = ['dropdown', 'radio', 'checkbox'].includes(fieldType)

  async function handleSaveField(e: React.FormEvent) {
    e.preventDefault()
    setFieldError(null)

    if (!fieldLabel.trim()) {
      setFieldError('Field label is required.')
      return
    }

    const cleanKey = slugify(fieldKey || fieldLabel)
    if (!cleanKey) {
      setFieldError('Field key is required (e.g. student_grade).')
      return
    }

    let parsedOptions: string[] | null = null
    if (needsOptions) {
      parsedOptions = optionsText
        .split(/[\n,]/)
        .map((s) => s.trim())
        .filter(Boolean)
      if (parsedOptions.length === 0) {
        setFieldError('Please provide at least one option for dropdown/radio/checkbox fields.')
        return
      }
    }

    setSavingField(true)

    if (modalMode === 'create') {
      if (!orgId) {
        setFieldError('Could not identify organization.')
        setSavingField(false)
        return
      }

      // Check key collision
      if (fields.some((f) => f.field_key === cleanKey)) {
        setFieldError(`A field with key "${cleanKey}" already exists. Choose a different label or key.`)
        setSavingField(false)
        return
      }

      const { error: insertError } = await supabase.from('registration_fields').insert({
        organization_id: orgId,
        label: fieldLabel.trim(),
        field_key: cleanKey,
        field_type: fieldType,
        is_required: isRequired,
        options: parsedOptions,
        display_order: fields.length,
        is_active: true,
      })

      if (insertError) {
        setFieldError(insertError.message)
        setSavingField(false)
        return
      }
    } else if (modalMode === 'edit' && editingFieldId) {
      const { error: updateError } = await supabase
        .from('registration_fields')
        .update({
          label: fieldLabel.trim(),
          field_type: fieldType,
          is_required: isRequired,
          options: parsedOptions,
          updated_at: new Date().toISOString(),
        })
        .eq('id', editingFieldId)

      if (updateError) {
        setFieldError(updateError.message)
        setSavingField(false)
        return
      }
    }

    setSavingField(false)
    setModalMode(null)
    fetchData()
  }

  async function moveField(index: number, direction: -1 | 1) {
    const newIndex = index + direction
    if (newIndex < 0 || newIndex >= fields.length) return

    const a = fields[index]
    const b = fields[newIndex]

    await Promise.all([
      supabase.from('registration_fields').update({ display_order: b.display_order }).eq('id', a.id),
      supabase.from('registration_fields').update({ display_order: a.display_order }).eq('id', b.id),
    ])

    fetchData()
  }

  async function toggleFieldActive(field: RegistrationField) {
    await supabase
      .from('registration_fields')
      .update({ is_active: !field.is_active })
      .eq('id', field.id)
    fetchData()
  }

  async function deleteField(field: RegistrationField) {
    const confirmed = confirm(
      `Delete the "${field.label}" field? Historical submissions will still retain their saved values.`
    )
    if (!confirmed) return

    const { error: delError } = await supabase
      .from('registration_fields')
      .delete()
      .eq('id', field.id)

    if (delError) {
      alert(`Could not delete field: ${delError.message}`)
    } else {
      fetchData()
    }
  }

  async function handleSaveBranding(e: React.FormEvent) {
    e.preventDefault()
    if (!orgId) return

    setSavingSettings(true)
    await supabase.from('organization_settings').upsert({
      organization_id: orgId,
      marketing_tagline: tagline.trim() || null,
      contact_phone: phone.trim() || null,
      whatsapp_url: whatsapp.trim() || null,
      website_url: websiteUrl.trim() || null,
      updated_at: new Date().toISOString(),
    })

    setSavingSettings(false)
    setSettingsSavedMessage(true)
    setTimeout(() => setSettingsSavedMessage(false), 2500)
  }

  return (
    <AdminLayout
      title="Registration Form & Organization Settings"
      subtitle="Customize what students must fill out before taking assessments and your report card branding"
    >
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 max-w-7xl">
        {/* LEFT COLUMN: Registration Form Builder & Settings (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          {/* Form Builder Card */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-3 border-b border-slate-100">
              <div>
                <h2 className="text-base font-bold text-slate-900">Student Registration Fields</h2>
                <p className="text-xs text-slate-500">
                  Manage required student intake fields before testing begins.
                </p>
              </div>
              <button
                onClick={openCreateModal}
                className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-3.5 py-2 rounded-lg transition flex items-center gap-1.5 shrink-0"
              >
                <span>+</span> Add Custom Field
              </button>
            </div>

            {loading ? (
              <p className="text-xs text-slate-400 py-4 text-center">Loading fields...</p>
            ) : fields.length === 0 ? (
              <div className="text-center py-8 border-2 border-dashed border-slate-200 rounded-lg">
                <p className="text-sm font-medium text-slate-600">No registration fields set up.</p>
                <p className="text-xs text-slate-400 mt-1">
                  Add fields like "Full Name", "Parent WhatsApp", "Grade", etc.
                </p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {fields.map((f, index) => (
                  <div
                    key={f.id}
                    className={`border rounded-lg p-3.5 flex items-center justify-between gap-3 transition ${
                      f.is_active ? 'bg-slate-50/70 border-slate-200' : 'bg-slate-100/50 border-slate-200 opacity-60'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-sm text-slate-900 truncate">{f.label}</span>
                        <span className="text-[11px] font-mono text-slate-500 bg-white border border-slate-200 px-1.5 py-0.5 rounded">
                          {f.field_key}
                        </span>
                        <span className="text-xs bg-blue-50 text-blue-700 font-medium px-2 py-0.5 rounded">
                          {FIELD_TYPE_LABELS[f.field_type] || f.field_type}
                        </span>
                        {f.is_required ? (
                          <span className="text-[11px] font-bold text-red-600 bg-red-50 border border-red-200 px-1.5 py-0.5 rounded">
                            Required *
                          </span>
                        ) : (
                          <span className="text-[11px] text-slate-500 bg-slate-200 px-1.5 py-0.5 rounded">
                            Optional
                          </span>
                        )}
                      </div>

                      {f.options && f.options.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {f.options.map((opt, i) => (
                            <span
                              key={i}
                              className="text-[11px] bg-white border border-slate-200 text-slate-600 px-1.5 py-0.5 rounded"
                            >
                              {opt}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Reorder and Edit Actions */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        onClick={() => moveField(index, -1)}
                        disabled={index === 0}
                        title="Move Up"
                        className="text-xs px-2 py-1 rounded bg-slate-200 hover:bg-slate-300 disabled:opacity-30"
                      >
                        ↑
                      </button>
                      <button
                        onClick={() => moveField(index, 1)}
                        disabled={index === fields.length - 1}
                        title="Move Down"
                        className="text-xs px-2 py-1 rounded bg-slate-200 hover:bg-slate-300 disabled:opacity-30"
                      >
                        ↓
                      </button>
                      <button
                        onClick={() => openEditModal(f)}
                        className="text-xs bg-slate-200 hover:bg-slate-300 text-slate-700 font-medium px-2.5 py-1 rounded-md"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => toggleFieldActive(f)}
                        title={f.is_active ? 'Disable field' : 'Enable field'}
                        className={`text-xs px-2 py-1 rounded font-medium ${
                          f.is_active
                            ? 'bg-amber-100 text-amber-800 hover:bg-amber-200'
                            : 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                        }`}
                      >
                        {f.is_active ? 'Hide' : 'Show'}
                      </button>
                      <button
                        onClick={() => deleteField(f)}
                        className="text-xs text-red-600 hover:text-red-800 px-1.5 py-1"
                        title="Delete field"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Branding & Marketing Details Form */}
          <form
            onSubmit={handleSaveBranding}
            className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4"
          >
            <h2 className="text-base font-bold text-slate-900">Organization & Report Branding</h2>
            <p className="text-xs text-slate-500">
              Shown at the header and footer of student diagnostic results.
            </p>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Marketing Slogan / Footer Note
              </label>
              <input
                type="text"
                value={tagline}
                onChange={(e) => setTagline(e.target.value)}
                placeholder="e.g. Master SAT & ACT Math with targeted diagnostic courses"
                className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Contact Phone
                </label>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+1 (555) 019-2834"
                  className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  WhatsApp Contact Link
                </label>
                <input
                  type="text"
                  value={whatsapp}
                  onChange={(e) => setWhatsapp(e.target.value)}
                  placeholder="https://wa.me/15550192834"
                  className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Website URL
              </label>
              <input
                type="url"
                value={websiteUrl}
                onChange={(e) => setWebsiteUrl(e.target.value)}
                placeholder="https://youracademy.com"
                className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2"
              />
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-100">
              {settingsSavedMessage && (
                <span className="text-xs text-emerald-600 font-bold">✓ Settings saved successfully!</span>
              )}
              <button
                type="submit"
                disabled={savingSettings}
                className="ml-auto text-xs bg-blue-600 hover:bg-blue-700 text-white font-semibold px-4 py-2 rounded-lg transition disabled:opacity-50"
              >
                {savingSettings ? 'Saving...' : 'Save Branding'}
              </button>
            </div>
          </form>
        </div>

        {/* RIGHT COLUMN: Live Interactive Student Preview (5 cols) */}
        <div className="lg:col-span-5">
          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs sticky top-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Student Intake Preview</h3>
                <p className="text-xs text-slate-500">Live preview of what students will see</p>
              </div>
              <span className="text-[11px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full">
                Interactive
              </span>
            </div>

            <div className="space-y-4 max-h-[600px] overflow-y-auto pr-1">
              {fields.filter((f) => f.is_active).length === 0 ? (
                <p className="text-xs text-slate-400 py-6 text-center">
                  No active registration fields to preview.
                </p>
              ) : (
                fields
                  .filter((f) => f.is_active)
                  .map((field) => (
                    <DynamicRegistrationField
                      key={field.id}
                      field={field}
                      value={previewValues[field.field_key] ?? ''}
                      onChange={(val) =>
                        setPreviewValues((prev) => ({ ...prev, [field.field_key]: val }))
                      }
                    />
                  ))
              )}

              <button
                type="button"
                disabled
                className="w-full bg-blue-600 text-white text-xs font-semibold py-2.5 rounded-lg opacity-80 cursor-not-allowed mt-2"
              >
                Start Assessment →
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* Create / Edit Field Modal */}
      {/* ========================================================= */}
      {modalMode !== null && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4"
          role="dialog"
        >
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="text-base font-bold text-slate-900">
                {modalMode === 'create' ? 'Add Registration Field' : 'Edit Registration Field'}
              </h2>
              <button
                onClick={() => setModalMode(null)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveField} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Field Label <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Current Grade Level"
                  value={fieldLabel}
                  onChange={(e) => handleLabelChange(e.target.value)}
                  className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Field Key (Internal Identifier) <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  disabled={modalMode === 'edit'}
                  placeholder="e.g. grade_level"
                  value={fieldKey}
                  onChange={(e) => setFieldKey(slugify(e.target.value))}
                  className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 font-mono disabled:bg-slate-100 disabled:text-slate-500"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  JSON key used to store student answers in results and exports.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Field Type
                </label>
                <select
                  value={fieldType}
                  onChange={(e) => setFieldType(e.target.value as FieldType)}
                  className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 bg-white"
                >
                  {Object.entries(FIELD_TYPE_LABELS).map(([val, lbl]) => (
                    <option key={val} value={val}>
                      {lbl}
                    </option>
                  ))}
                </select>
              </div>

              {needsOptions && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Choice Options (one per line or comma-separated) <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    rows={3}
                    placeholder={'Grade 9\nGrade 10\nGrade 11\nGrade 12'}
                    value={optionsText}
                    onChange={(e) => setOptionsText(e.target.value)}
                    className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 font-mono text-xs"
                  />
                </div>
              )}

              <div className="border border-slate-200 bg-slate-50 p-3 rounded-lg">
                <label className="flex items-center gap-2 text-xs font-semibold text-slate-800 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isRequired}
                    onChange={(e) => setIsRequired(e.target.checked)}
                  />
                  Require students to fill out this field before testing
                </label>
              </div>

              {fieldError && (
                <p className="text-xs text-red-600 bg-red-50 p-2 rounded">{fieldError}</p>
              )}

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setModalMode(null)}
                  className="px-4 py-2 text-xs font-medium text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingField}
                  className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {savingField ? 'Saving...' : modalMode === 'create' ? 'Add Field' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AdminLayout>
  )
}