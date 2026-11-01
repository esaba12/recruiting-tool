import { NAV_ITEMS } from './layout/Sidebar.jsx'
import { NAV_ICON } from '../lib/icons.js'

// The signed-out home at "/". Plain on purpose: the app's own tokens and fonts, a static
// preview of the real Today tab, and copy that says what the product does.

const FEATURES = [
  ['Today', 'A daily list of what needs you: follow-ups that are due, online assessments about to close, upcoming interviews, and contacts you haven’t talked to in a while.'],
  ['Inbox', 'Connect Gmail and recruiting email is pulled into threads. Interview invites become calendar events, and reply drafts use your résumé and availability.'],
  ['Network', 'Recruiters, alumni and referrers in one list, with every call and email logged against them and a reminder when it’s time to reach out again.'],
  ['Pipeline', 'Every application from sourced to offer, as a board or a spreadsheet. Import an existing tracker or a LinkedIn export to start.'],
  ['Calendar', 'Info sessions, coffee chats and interviews from your school’s event feeds and your Google Calendar, with conflicts flagged.'],
  ['Learn', 'LeetCode history synced in, spaced-repetition review, and prep organized by the companies you’re interviewing with.'],
]

const PRIVACY = [
  ['Separate accounts', 'Each account’s data is isolated at the database level with row-level security.'],
  ['Your own API keys', 'AI features use your Anthropic or OpenAI key. Keys are encrypted and only used for your requests.'],
  ['Résumé stays on your device', 'PDFs are read in the browser. The file itself is never uploaded.'],
  ['Read-only Gmail access', 'Email scanning is optional and can be disconnected from Settings at any time.'],
]

const PRIMARY = 'px-4 py-2.5 rounded-md text-sm font-semibold bg-accent-600 text-on-accent hover:bg-accent-700 transition-colors'
const SECONDARY = 'px-4 py-2.5 rounded-md text-sm font-medium bg-surface text-ink-800 border border-ink-200 hover:bg-ink-50 transition-colors'
const NAV_LINK = 'px-3 py-1.5 rounded-md text-sm text-ink-600 hover:text-ink-900 hover:bg-ink-100 transition-colors'

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-canvas text-ink-900">
      <header className="border-b border-ink-200">
        <nav className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center gap-1">
          <a href="/" className="font-heading font-semibold tracking-tight mr-auto">Recruiting OS</a>
          <a href="/demo" className={`hidden sm:block ${NAV_LINK}`}>Demo</a>
          <a href="/login" className={NAV_LINK}>Sign in</a>
          <a href="/signup" className="ml-1 px-3 py-1.5 rounded-md text-sm font-medium bg-accent-600 text-on-accent hover:bg-accent-700 transition-colors">Sign up</a>
        </nav>
      </header>

      <main>
        <section className="max-w-6xl mx-auto px-4 sm:px-6 pt-16 sm:pt-24">
          <h1 className="font-heading text-4xl sm:text-5xl lg:text-[3.5rem] font-semibold tracking-tight leading-[1.08] max-w-3xl">
            A recruiting tracker for internship season.
          </h1>
          <p className="mt-5 text-lg text-ink-600 leading-relaxed max-w-2xl">
            Keep your contacts, applications, recruiting events and email in one place.
            Recruiting OS reads it all and puts what you need to do next at the top.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a href="/signup" className={PRIMARY}>Create an account</a>
            <a href="/demo" className={SECONDARY}>Try the demo</a>
          </div>
          <p className="mt-4 text-sm text-ink-500">
            Free. Built for SWE, PM, banking, quant and consulting recruiting.
          </p>

          <AppPreview />
        </section>

        <section className="max-w-6xl mx-auto px-4 sm:px-6 py-20 sm:py-28">
          <h2 className="font-heading text-2xl sm:text-3xl font-semibold tracking-tight">What it does</h2>
          <dl className="mt-8 grid md:grid-cols-2 gap-x-16">
            {FEATURES.map(([name, body]) => (
              <div key={name} className="py-6 border-t border-ink-200">
                <dt className="font-heading text-lg font-semibold">{name}</dt>
                <dd className="mt-2 text-[15px] text-ink-600 leading-relaxed">{body}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="bg-surface border-y border-ink-200">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-20 grid lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] gap-10 lg:gap-16">
            <div>
              <h2 className="font-heading text-2xl sm:text-3xl font-semibold tracking-tight">Privacy and API keys</h2>
              <p className="mt-3 text-ink-600 leading-relaxed">
                Full details are in the <a href="/privacy.html" className="text-link underline underline-offset-2">privacy policy</a>.
              </p>
            </div>
            <dl className="grid sm:grid-cols-2 gap-x-10 gap-y-8">
              {PRIVACY.map(([title, body]) => (
                <div key={title}>
                  <dt className="font-semibold">{title}</dt>
                  <dd className="mt-1.5 text-[15px] text-ink-600 leading-relaxed">{body}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        <section className="max-w-6xl mx-auto px-4 sm:px-6 py-20 flex flex-col sm:flex-row sm:items-center gap-6">
          <div className="flex-1">
            <h2 className="font-heading text-2xl sm:text-3xl font-semibold tracking-tight">Get set up before applications open.</h2>
            <p className="mt-2 text-ink-600">Import the spreadsheet you already have and you’re running in a few minutes.</p>
          </div>
          <div className="flex gap-3">
            <a href="/signup" className={PRIMARY}>Create an account</a>
            <a href="/login" className={SECONDARY}>Sign in</a>
          </div>
        </section>
      </main>

      <footer className="border-t border-ink-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-ink-500">
          <span className="mr-auto">Recruiting OS</span>
          <a href="/demo" className="hover:text-ink-900 transition-colors">Demo</a>
          <a href="/privacy.html" className="hover:text-ink-900 transition-colors">Privacy</a>
          <a href="/terms.html" className="hover:text-ink-900 transition-colors">Terms</a>
        </div>
      </footer>
    </div>
  )
}

// A static, scaled-down copy of the app: the real sidebar nav and card style, with names from
// the /demo seed data. Purely illustrative, so it's hidden from screen readers.
function AppPreview() {
  const followUps = [
    ['Kelly Sanders', 'Stripe', 'Overdue 2 days'],
    ['Ryan Kowalski', 'Notion', 'Due today'],
    ['Emma Whitfield', 'Figma', 'Due Friday'],
  ]
  const upcoming = [
    ['Tue', 'Ramp online assessment closes'],
    ['Wed', 'Anthropic phone screen'],
    ['Thu', 'Vercel info session'],
  ]
  const funnel = [['Applied', 24], ['Screen', 9], ['Interview', 5], ['Offer', 1]]
  const replies = [
    ['Deepak Nair', 'Re: Coffee chat next week? I’m free Tuesday or Thursday afternoon', '2h ago'],
    ['Amara Osei', 'Vercel SWE intern: scheduling your technical interview', 'Yesterday'],
  ]
  return (
    <div aria-hidden className="mt-14 sm:mt-16 rounded-lg border border-ink-200 bg-surface overflow-hidden shadow-[0_1px_2px_rgba(0,0,0,0.04),0_16px_40px_-16px_rgba(0,0,0,0.14)] select-none">
      <div className="flex">
        <div className="theme-fixed hidden md:block w-48 shrink-0 bg-ink-900 px-3 py-4">
          <span className="block font-heading text-sm font-semibold text-white px-2">Recruiting OS</span>
          <ul className="mt-5 space-y-0.5">
            {NAV_ITEMS.map(({ id, label }) => {
              const Icon = NAV_ICON[id]
              return (
                <li key={id} className={`flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-[13px] font-medium ${id === 'today' ? 'bg-accent-500 text-on-accent' : 'text-ink-300'}`}>
                  {Icon && <Icon size={14} strokeWidth={2} />}
                  {label}
                </li>
              )
            })}
          </ul>
        </div>

        <div className="flex-1 min-w-0 bg-canvas p-4 sm:p-6">
          <p className="font-heading text-lg font-semibold">Today</p>
          <div className="mt-4 grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <Card title="Follow up" count={followUps.length}>
              {followUps.map(([name, company, due]) => (
                <Row key={name}>
                  <span className="font-medium truncate">{name}</span>
                  <span className="text-ink-500 truncate">{company}</span>
                  <span className={`ml-auto shrink-0 text-xs ${due.startsWith('Overdue') ? 'text-danger-600' : 'text-ink-500'}`}>{due}</span>
                </Row>
              ))}
            </Card>
            <Card title="This week" count={upcoming.length}>
              {upcoming.map(([day, what]) => (
                <Row key={what}>
                  <span className="w-8 shrink-0 text-ink-500">{day}</span>
                  <span className="truncate">{what}</span>
                </Row>
              ))}
            </Card>
            <Card title="Applications" count={24} className="sm:col-span-2 lg:col-span-1">
              <div className="space-y-2.5 pt-1.5">
                {funnel.map(([stage, n]) => (
                  <div key={stage} className="grid grid-cols-[4.5rem_minmax(0,1fr)_1.5rem] items-center gap-2 text-xs">
                    <span className="text-ink-500">{stage}</span>
                    <span className="h-1.5 rounded-full bg-ink-100 overflow-hidden">
                      <span className="block h-full bg-accent-500 rounded-full" style={{ width: `${(n / 24) * 100}%` }} />
                    </span>
                    <span className="text-right tabular-nums text-ink-700">{n}</span>
                  </div>
                ))}
              </div>
            </Card>
            <Card title="Needs a reply" count={replies.length} className="sm:col-span-2 lg:col-span-3">
              {replies.map(([from, subject, when]) => (
                <Row key={subject}>
                  <span className="sm:w-36 shrink-0 font-medium truncate">{from}</span>
                  <span className="text-ink-600 truncate">{subject}</span>
                  <span className="ml-auto shrink-0 text-xs text-ink-500">{when}</span>
                </Row>
              ))}
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}

function Card({ title, count, className = '', children }) {
  return (
    <div className={`min-w-0 bg-surface border border-ink-200 rounded-md px-3.5 pt-3 pb-2 ${className}`}>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-semibold text-ink-700">{title}</span>
        <span className="text-xs tabular-nums text-ink-500">{count}</span>
      </div>
      {children}
    </div>
  )
}

function Row({ children }) {
  return <div className="flex items-baseline gap-2 py-1.5 border-t border-ink-100 first:border-t-0 text-[13px]">{children}</div>
}
