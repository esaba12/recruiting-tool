// Applies the last-used color scheme + light/dark mode before first paint, so a dark-mode
// user never sees a white flash. A plain blocking script in <head> (not inline — the CSP is
// script-src 'self'). Mirrors lib/theme.js's resolve logic; keep the two in sync.
(function () {
  var a = {}
  try { a = JSON.parse(localStorage.getItem('rec_appearance')) || {} } catch (e) {}
  var mode = a.mode === 'light' || a.mode === 'dark' ? a.mode
    : (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
  var el = document.documentElement
  el.setAttribute('data-scheme', a.scheme || 'orange')
  el.setAttribute('data-mode', mode)
})()
