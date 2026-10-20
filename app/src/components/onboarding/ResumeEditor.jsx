import { useRef, useState } from 'react'
import { FileText, Loader2, Upload } from 'lucide-react'
import { normalizeResumeText, RESUME_MAX_CHARS } from '../../lib/resume.js'

// Résumé text editor shared by the onboarding step and Settings (v1.4 spec 09). A PDF is
// read in the browser (lib/resumePdf.js, lazy-loaded); only the extracted text is kept, and
// it stays editable so a bad extraction can be fixed by hand. Controlled: the parent saves.
export default function ResumeEditor({ value, onChange, disabled = false }) {
  const [reading, setReading] = useState(false)
  const [err, setErr] = useState(null)
  const [fileName, setFileName] = useState(null)
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef(null)

  async function readFile(file) {
    if (!file) return
    setErr(null)
    if (file.type !== 'application/pdf' && !/\.pdf$/i.test(file.name)) {
      setErr('That isn\'t a PDF. Export your résumé as a PDF, or paste the text below.')
      return
    }
    setReading(true)
    try {
      const { extractResumeText } = await import('../../lib/resumePdf.js')
      const text = await extractResumeText(file)
      if (!text) setErr('No text found in that PDF (it may be a scanned image). Paste the text below instead.')
      else { onChange(text); setFileName(file.name) }
    } catch (e) {
      setErr(`Couldn't read that PDF: ${e.message}. Paste the text below instead.`)
    } finally {
      setReading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  const words = value.trim() ? value.trim().split(/\s+/).length : 0
  return (
    <div className="space-y-3">
      <label
        onDragOver={e => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={e => { e.preventDefault(); setDragging(false); if (!disabled) readFile(e.dataTransfer.files?.[0]) }}
        className={`flex items-center gap-3 px-4 py-4 border border-dashed rounded-md transition-colors ${
          disabled ? 'opacity-50 cursor-not-allowed border-ink-200' : `cursor-pointer ${dragging ? 'border-accent-500 bg-accent-50' : 'border-ink-300 bg-surface hover:border-accent-400'}`}`}>
        <input ref={inputRef} type="file" accept="application/pdf,.pdf" className="sr-only" disabled={disabled || reading}
          onChange={e => readFile(e.target.files?.[0])} />
        {reading ? <Loader2 size={18} className="animate-spin text-accent-600 shrink-0" />
          : fileName ? <FileText size={18} className="text-accent-600 shrink-0" />
          : <Upload size={18} className="text-ink-400 shrink-0" />}
        <span className="text-sm text-ink-700">
          {reading ? 'Reading your PDF…'
            : fileName ? <><span className="font-medium">{fileName}</span> <span className="text-ink-400">· drop another to replace</span></>
            : <><span className="font-medium">Drop your résumé PDF</span> <span className="text-ink-400">or click to choose one</span></>}
        </span>
      </label>
      {err && <p className="text-xs text-danger-600">{err}</p>}
      <div>
        <div className="flex items-baseline justify-between mb-1">
          <span className="text-xs text-ink-400">{value ? 'The text drafts will draw on. Fix anything that came out garbled.' : 'Or paste the text'}</span>
          {words > 0 && <span className="font-mono text-[10px] text-ink-400">{words} words</span>}
        </div>
        <textarea value={value} disabled={disabled} rows={value ? 10 : 4} maxLength={RESUME_MAX_CHARS}
          onChange={e => onChange(e.target.value)}
          onBlur={e => onChange(normalizeResumeText(e.target.value))}
          placeholder="Education, experience, projects, skills…"
          className="w-full px-2.5 py-2 border border-ink-100 rounded-lg text-xs font-mono leading-relaxed bg-surface text-ink-800 focus:outline-none focus:border-accent-400 focus:ring-1 focus:ring-accent-200" />
      </div>
    </div>
  )
}
