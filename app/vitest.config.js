import { defineConfig, loadEnv } from 'vite'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Tests read the same root .env vite.config.js does (SUPABASE_URL, service-role
// key, anon key) — mirrored onto process.env so the RLS harness can talk to
// whichever Supabase project is configured (hosted, or `supabase start`).
export default defineConfig(({ mode }) => {
  Object.assign(process.env, loadEnv(mode, path.join(__dirname, '..'), ''))
  return {
    test: {
      environment: 'node',
      include: ['test/**/*.test.js'],
      testTimeout: 30000,
      hookTimeout: 60000,
    },
  }
})
