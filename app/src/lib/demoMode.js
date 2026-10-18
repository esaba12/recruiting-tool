// The public /demo route (App.jsx's DemoApp) has no account, so every auth-gated proxy
// would 401. Each data path checks this and serves seed data from demoData.js instead.
export function isDemoMode() {
  return typeof window !== 'undefined' && window.location.pathname.startsWith('/demo')
}

export const DEMO_SIGNUP_MSG = 'This needs an account — the demo runs on sample data. Sign up free to use it.'

export class DemoModeError extends Error {
  constructor(msg = DEMO_SIGNUP_MSG) {
    super(msg)
    this.name = 'DemoModeError'
  }
}
