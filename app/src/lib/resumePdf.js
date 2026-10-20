import { normalizeResumeText } from './resume.js'

// Text out of a résumé PDF, entirely in the browser (v1.4 spec 09). pdfjs-dist is loaded
// on demand so it stays out of the main bundle: only someone adding a résumé downloads it.
export async function extractResumeText(file) {
  const [pdfjs, { default: workerUrl }] = await Promise.all([
    import('pdfjs-dist'),
    import('pdfjs-dist/build/pdf.worker.min.mjs?url'),
  ])
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl
  // The CSP has no 'unsafe-eval' (vercel.json), so pdf.js must not try to compile fonts.
  const task = pdfjs.getDocument({ data: await file.arrayBuffer(), isEvalSupported: false })
  try {
    const pdf = await task.promise
    const pages = []
    for (let i = 1; i <= Math.min(pdf.numPages, 5); i++) {
      const content = await (await pdf.getPage(i)).getTextContent()
      // hasEOL marks the end of a visual line; without it every item on a line runs together.
      pages.push(content.items.map(it => it.str + (it.hasEOL ? '\n' : ' ')).join(''))
    }
    return normalizeResumeText(pages.join('\n'))
  } finally {
    task.destroy() // frees the worker
  }
}
