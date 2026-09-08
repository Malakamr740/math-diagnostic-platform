import { useRef, useState, useEffect } from 'react'
import ContentBlockRenderer from './ContentBlockRenderer'
import ImageUploadButton from './ImageUploadButton'
import TableBlockEditor from './TableBlockEditor'
import { parseContentText, blocksToText, type ContentBlock } from '../lib/contentBlocks'

interface ContentTextEditorProps {
  initialBlocks?: ContentBlock[]
  onChange: (blocks: ContentBlock[]) => void
  placeholder?: string
}

export default function ContentTextEditor({
  initialBlocks,
  onChange,
  placeholder,
}: ContentTextEditorProps) {
  // Split initial blocks into "typed text" (text/math/break) and
  // "attached media" (image/table) — they're edited differently,
  // so we track them as two separate pieces of state.
  const initialTyped = (initialBlocks ?? []).filter(
    (b) => b.type === 'text' || b.type === 'math' || b.type === 'break'
  )
  const initialMedia = (initialBlocks ?? []).filter(
    (b) => b.type === 'image' || b.type === 'table'
  ) as Extract<ContentBlock, { type: 'image' | 'table' }>[]

  const [text, setText] = useState(() => blocksToText(initialTyped))
  const [mediaBlocks, setMediaBlocks] = useState<Extract<ContentBlock, { type: 'image' | 'table' }>[]>(
    initialMedia
  )
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)

  useEffect(() => {
    // Final saved order: typed content first, then any attached
    // images/tables. Simple and predictable for a first version —
    // precise drag-to-reorder between text and media can come later
    // if teachers need it.
    onChange([...parseContentText(text), ...mediaBlocks])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, mediaBlocks])

  function insertMathMarkers() {
    const el = textareaRef.current
    if (!el) return
    const start = el.selectionStart
    const end = el.selectionEnd
    const before = text.slice(0, start)
    const after = text.slice(end)
    setText(`${before}$$${after}`)
    requestAnimationFrame(() => {
      el.focus()
      el.setSelectionRange(start + 1, start + 1)
    })
  }

  function handleImageUploaded(url: string) {
    setMediaBlocks([...mediaBlocks, { type: 'image', url }])
  }

  function addTable() {
    setMediaBlocks([
      ...mediaBlocks,
      {
        type: 'table',
        rows: [
          ['', ''],
          ['', ''],
        ],
      },
    ])
  }

  function updateMediaBlock(
    index: number,
    updated: Extract<ContentBlock, { type: 'image' | 'table' }>
  ) {
    setMediaBlocks((prev) => prev.map((b, i) => (i === index ? updated : b)))
  }

    function removeMediaBlock(index: number) {
      setMediaBlocks(mediaBlocks.filter((_, i) => i !== index))
    }

  const previewBlocks = [...parseContentText(text), ...mediaBlocks]

  return (
    <div className="space-y-3">
      <div className="flex gap-2 items-start">
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={placeholder ?? 'Type your question. Wrap math in $ $, e.g. If $x = 3$, then...'}
          rows={4}
          className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-slate-900 font-mono text-sm resize-y"
        />
        <button
          type="button"
          onClick={insertMathMarkers}
          title="Insert math markers at cursor"
          className="text-sm bg-purple-100 text-purple-700 px-3 py-2 rounded-md hover:bg-purple-200 whitespace-nowrap"
        >
          √ Insert Math
        </button>
      </div>

      <p className="text-xs text-slate-400">
        Wrap math in <code className="bg-slate-100 px-1 rounded">$...$</code> — e.g.{' '}
        <code className="bg-slate-100 px-1 rounded">{'$\\sqrt{x+3}$'}</code>. Press Enter for a new
        line.
      </p>

      {/* Attached media: images, figures, and tables */}
      <div className="space-y-3 border-t border-slate-200 pt-3">
        <p className="text-xs font-medium text-slate-500 uppercase">
          Images, Figures &amp; Tables
        </p>
        <p className="text-xs text-slate-400 -mt-2">
          Upload an image below. Leave its caption blank for a plain image, or add a caption to
          display it as a labeled figure.
        </p>

        {mediaBlocks.map((block, index) => (
          <div key={index} className="bg-slate-50 border border-slate-200 rounded-md p-3">
            {block.type === 'image' && (
              <div className="space-y-2">
                <img src={block.url} alt="" className="max-h-40 rounded-md" />
                <input
                  type="text"
                  value={block.caption ?? ''}
                  onChange={(e) => updateMediaBlock(index, { ...block, caption: e.target.value })}
                  placeholder="Caption (optional — leave blank for a plain image, fill in to display as a figure)"
                  className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
                />
              </div>
            )}
            {block.type === 'table' && (
              <TableBlockEditor
                rows={block.rows}
                onChange={(rows) => updateMediaBlock(index, { ...block, rows })}
              />
            )}
            <button
              type="button"
              onClick={() => removeMediaBlock(index)}
              className="text-xs text-red-600 hover:underline mt-2"
            >
              Remove this {block.type}
            </button>
          </div>
        ))}

        <div className="flex gap-2">
          <ImageUploadButton onUploaded={handleImageUploaded} />
          <button
            type="button"
            onClick={addTable}
            className="text-sm bg-slate-200 text-slate-800 px-3 py-1.5 rounded-md hover:bg-slate-300 h-fit"
          >
            + Add Table
          </button>
        </div>
      </div>

      {(text.trim().length > 0 || mediaBlocks.length > 0) && (
        <div>
          <p className="text-xs font-medium text-slate-500 uppercase mb-1">Preview</p>
          <div className="bg-slate-50 rounded-md p-4 text-lg text-slate-900">
            <ContentBlockRenderer blocks={previewBlocks} />
          </div>
        </div>
      )}
    </div>
  )
}