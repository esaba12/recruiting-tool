import { ShieldAlert } from 'lucide-react'

// Google shows a "Google hasn't verified this app" interstitial on every Gmail/Calendar
// connect: the consent screen runs unverified on purpose (see CLAUDE.md, "Google OAuth
// verification — attempted and deliberately skipped"). Without a heads-up, that screen
// reads like a phishing warning and people bail. Shared by onboarding and Settings.
export default function UnverifiedAppNote({ what = 'Gmail' }) {
  const access = what === 'Gmail'
    ? 'Access is read-only: the app can read recruiting mail but can never send, delete, or change anything.'
    : 'The app reads your schedule to spot conflicts, adds events only when you ask, and auto-synced recruiting events go into a separate "Recruiting" calendar it creates.'
  return (
    <div className="flex gap-3 p-3 border border-warning-200 bg-warning-50 rounded-md">
      <ShieldAlert size={16} className="text-warning-700 shrink-0 mt-0.5" />
      <div className="text-xs text-warning-800 space-y-1 leading-relaxed">
        <p className="font-semibold">Heads-up: Google will say "Google hasn't verified this app."</p>
        <p>
          This is a small student project that hasn't gone through Google's paid review. Click{' '}
          <span className="font-semibold">Advanced</span> → <span className="font-semibold">Go to recruitingos (unsafe)</span> to continue.
        </p>
        <p>{access} You can disconnect anytime in Settings.</p>
      </div>
    </div>
  )
}
