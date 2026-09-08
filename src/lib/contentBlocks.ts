// The canonical definition of a content block — used everywhere
// a question's content is stored, edited, or rendered.
export type ContentBlock =
  | { type: 'text'; value: string }
  | { type: 'math'; latex: string }
  | { type: 'image'; url: string; alt?: string; caption?: string }
  | { type: 'table'; rows: string[][] }  // each cell is raw text that may contain $...$ math
  | { type: 'break' }

// Turns raw typed text like:
//   "If $x = 3$, then:\nthe perimeter is $2x + 4$."
// into structured blocks:
//   [text, math, text, break, text, math, text]
//
// Note: this does NOT handle images — images are inserted as a
// separate explicit action (a file isn't typeable text), so they're
// added on top of these parsed blocks, not through this function.
export function parseContentText(text: string): ContentBlock[] {
  const blocks: ContentBlock[] = []
  const mathRegex = /\$(.*?)\$/g
  let lastIndex = 0
  let match: RegExpExecArray | null

  function pushTextSegment(segment: string) {
    const lines = segment.split('\n')
    lines.forEach((line, i) => {
      if (line.length > 0) blocks.push({ type: 'text', value: line })
      if (i < lines.length - 1) blocks.push({ type: 'break' })
    })
  }

  while ((match = mathRegex.exec(text)) !== null) {
    pushTextSegment(text.slice(lastIndex, match.index))
    blocks.push({ type: 'math', latex: match[1] })
    lastIndex = mathRegex.lastIndex
  }
  pushTextSegment(text.slice(lastIndex))

  return blocks
}

// The reverse operation: turns stored blocks back into editable text.
// Needed so the Edit Question page can pre-fill the textarea with
// existing content in the same $...$ format the teacher typed originally.
export function blocksToText(blocks: ContentBlock[]): string {
  let result = ''
  for (const block of blocks) {
    if (block.type === 'text') result += block.value
    else if (block.type === 'math') result += `$${block.latex}$`
    else if (block.type === 'break') result += '\n'
    // image blocks are intentionally skipped here — they're not
    // representable as plain typed text, and are managed separately.
  }
  return result
}

// Splits multi-line choice text into one ContentBlock[] per line.
// Each line becomes one choice's content (blank lines are ignored,
// so extra Enter presses don't create empty choices).
export function parseChoicesText(text: string): ContentBlock[][] {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => parseContentText(line))
}

// The reverse: turns an array of choices' blocks back into one
// multi-line string, for pre-filling the textarea when editing.
export function choicesToText(choiceBlocks: ContentBlock[][]): string {
  return choiceBlocks.map((blocks) => blocksToText(blocks)).join('\n')
}