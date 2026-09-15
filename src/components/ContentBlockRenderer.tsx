import { Fragment } from 'react'
import katex from 'katex'

export interface ContentBlock {
  type: string
  data?: Record<string, any>
  children?: ContentBlock[]
}

function renderInline(text?: string): React.ReactNode {
  if (!text) return null
  const parts = text.split(/(\$[^$]+\$)/g)
  return parts.map((part, i) => {
    if (part.startsWith('$') && part.endsWith('$') && part.length > 2) {
      try {
        return (
          <span key={i} dangerouslySetInnerHTML={{ __html: katex.renderToString(part.slice(1, -1), { throwOnError: false }) }} />
        )
      } catch {
        return <span key={i}>{part}</span>
      }
    }
    return <Fragment key={i}>{part}</Fragment>
  })
}

function Block({ block }: { block: ContentBlock }) {
  switch (block.type) {
    case 'text':
      return <p className="leading-relaxed">{renderInline(block.data?.text)}</p>
    case 'heading':
      return <h3 className="text-lg font-semibold text-slate-900">{renderInline(block.data?.text)}</h3>
    case 'image':
      return <img src={block.data?.src} alt={block.data?.alt || ''} className="my-3 max-w-full rounded-xl" />
    case 'katex':
      return (
        <div
          className="my-2 overflow-x-auto"
          dangerouslySetInnerHTML={{
            __html: katex.renderToString(block.data?.tex || '', { displayMode: true, throwOnError: false }),
          }}
        />
      )
    case 'list':
      return (
        <ul className="my-2 list-disc space-y-1 pl-5">
          {(block.data?.items || []).map((it: string, i: number) => (
            <li key={i}>{renderInline(it)}</li>
          ))}
        </ul>
      )
    case 'table': {
      const rows: string[][] = block.data?.rows || []
      if (!rows.length) return null
      return (
        <div className="my-3 overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <tbody>
              {rows.map((row, ri) => (
                <tr key={ri}>
                  {row.map((cell, ci) => (
                    <td key={ci} className="border border-slate-200 px-3 py-1.5">
                      {renderInline(cell)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )
    }
    case 'group':
      return (
        <div className="space-y-2">
          {(block.children || []).map((c, i) => (
            <Block key={i} block={c} />
          ))}
        </div>
      )
    default:
      return null
  }
}

export default function ContentBlockRenderer({ blocks }: { blocks: ContentBlock[] }) {
  if (!blocks || !blocks.length) return null
  return (
    <div className="space-y-2">
      {blocks.map((b, i) => (
        <Block key={i} block={b} />
      ))}
    </div>
  )
}