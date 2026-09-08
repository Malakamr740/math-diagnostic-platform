import { InlineMath } from 'react-katex'
import { parseContentText, type ContentBlock } from '../lib/contentBlocks'

export type { ContentBlock }

interface ContentBlockRendererProps {
  blocks: ContentBlock[]
}

export default function ContentBlockRenderer({ blocks }: ContentBlockRendererProps) {
  return (
    <span className="leading-relaxed break-words [overflow-wrap:anywhere]">
      {blocks.map((block, index) => {
        if (block.type === 'text') {
          return <span key={index}>{block.value}</span>
        }
        if (block.type === 'math') {
          return (
            <span key={index} className="mx-1 inline-block align-middle">
              <InlineMath math={block.latex} />
            </span>
          )
        }
        if (block.type === 'image') {
          return (
            <span key={index} className="block my-3">
              <img
                src={block.url}
                alt={block.alt || ''}
                className="max-h-64 max-w-full rounded-md border border-slate-200"
              />
              {block.caption && (
                <span className="block text-sm text-slate-500 mt-1 italic">{block.caption}</span>
              )}
            </span>
          )
        }
        if (block.type === 'table') {
          return (
            <table key={index} className="border-collapse my-3 text-base">
              <tbody>
                {block.rows.map((row, rowIndex) => (
                  <tr key={rowIndex}>
                    {row.map((cell, colIndex) => (
                      <td
                        key={colIndex}
                        className={`border border-slate-300 px-3 py-1.5 ${
                          rowIndex === 0 ? 'font-semibold bg-slate-50' : ''
                        }`}
                      >
                        {cell.includes('$') ? (
                          <ContentBlockRenderer blocks={parseContentText(cell)} />
                        ) : (
                          cell
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          )
        }
        if (block.type === 'break') {
          return <br key={index} />
        }
        return null
      })}
    </span>
  )
}