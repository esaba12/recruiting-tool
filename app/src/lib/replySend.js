// Getting a drafted reply into Gmail (v1.5 spec 05 A). The connection is gmail.readonly, so the
// app can't create the draft in Gmail itself: it copies the text and opens the thread, where
// you paste and send. Shared by Inbox's composer and Today's reply rows.
import { gmailThreadUrl } from './inbox.js'

export const draftGmailUrl = draft => (draft?.threadId ? gmailThreadUrl({ id: draft.threadId, mailbox: draft.mailbox }) : null)

// → { ok, opened, error }. `demo` copies but never navigates away from /demo.
export async function copyAndOpen(url, body, { clipboard = globalThis.navigator?.clipboard, open = (u => globalThis.window?.open(u, '_blank', 'noopener')), demo = false } = {}) {
  try {
    await clipboard.writeText(body)
  } catch {
    return { ok: false, opened: false, error: "Couldn't copy. Select the text and copy it yourself." }
  }
  if (demo || !url) return { ok: true, opened: false }
  open(url)
  return { ok: true, opened: true }
}
