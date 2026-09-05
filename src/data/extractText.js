import * as pdfjs from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl

const TEXT_TYPES = ['.txt', '.md', '.csv', '.json', '.rtf']

// Judgments number their paragraphs, and those numbers are what a pinpoint
// citation refers to. pdf.js returns positioned text items, so a newline is
// inserted whenever the vertical position moves — without that the whole
// page collapses into one line and the numbering becomes unusable.
async function extractPdf(file) {
  const pdf = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise
  const pages = []
  for (let n = 1; n <= pdf.numPages; n += 1) {
    const content = await (await pdf.getPage(n)).getTextContent()
    let lastY = null
    let line = ''
    const lines = []
    for (const item of content.items) {
      const y = item.transform[5]
      if (lastY !== null && Math.abs(y - lastY) > 2) {
        lines.push(line.trim())
        line = ''
      }
      line += item.str
      lastY = y
    }
    if (line.trim()) lines.push(line.trim())
    pages.push(lines.filter(Boolean).join('\n'))
  }
  await pdf.destroy()
  return pages.join('\n\n')
}

// Returns { text } or throws an Error whose message is safe to show.
export async function extractText(file) {
  const name = file.name.toLowerCase()
  if (name.endsWith('.pdf')) {
    const text = await extractPdf(file)
    if (!text.trim()) {
      throw new Error('No text found — this looks like a scanned PDF. TribUnal cannot read scanned images.')
    }
    return text
  }
  if (TEXT_TYPES.some((ext) => name.endsWith(ext)) || file.type.startsWith('text/')) {
    return await file.text()
  }
  if (name.endsWith('.doc') || name.endsWith('.docx')) {
    throw new Error('Word files cannot be read. Save it as a PDF and upload that instead.')
  }
  throw new Error('Unsupported file type. Upload a PDF or a plain text file.')
}
