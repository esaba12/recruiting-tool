import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import { AuthProvider } from './lib/AuthContext.jsx'
import './index.css'
import { initSentry } from './lib/sentry.js'
import { LazyMotion } from 'motion/react'

const loadMotionFeatures = () => import('./lib/motionFeatures.js').then(mod => mod.default)

initSentry()

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {/* Components animate with the slim `m.*` elements; domAnimation (variants, enter/exit)
        arrives in its own chunk, not the full motion bundle in the entry (v1.3 spec 09). */}
    <LazyMotion features={loadMotionFeatures}>
      <AuthProvider>
        <App />
      </AuthProvider>
    </LazyMotion>
  </React.StrictMode>
)
