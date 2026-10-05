import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'
import { readFileSync } from 'node:fs'

// Ambientes: `--mode pruebas` (.env.pruebas) y `--mode produccion` (.env.produccion).
// No hay un `.env` compartido a propósito: si a producción le falta un dato, el build
// falla en lugar de conectarse en silencio a la base de pruebas.
const ENVIRONMENTS = ['pruebas', 'produccion'] as const

// Proyecto de Firebase que corresponde a cada ambiente según .firebaserc
function firebaseProject(alias: string): string | undefined {
  try {
    return JSON.parse(readFileSync('.firebaserc', 'utf8')).projects?.[alias]
  } catch {
    return undefined
  }
}

function checkEnvironment(mode: string, env: Record<string, string>) {
  if (!ENVIRONMENTS.includes(mode as typeof ENVIRONMENTS[number])) {
    throw new Error(`Ambiente desconocido "${mode}". Usa --mode pruebas o --mode produccion.`)
  }
  const missing = ['VITE_FIREBASE_API_KEY', 'VITE_FIREBASE_AUTH_DOMAIN', 'VITE_FIREBASE_PROJECT_ID', 'VITE_FIREBASE_APP_ID']
    .filter(k => !env[k])
  if (missing.length) {
    throw new Error(`Faltan datos en .env.${mode}: ${missing.join(', ')}. Ver README → "Publicar la app".`)
  }
  const expected = firebaseProject(mode)
  if (expected && env.VITE_FIREBASE_PROJECT_ID !== expected) {
    throw new Error(`.env.${mode} apunta a "${env.VITE_FIREBASE_PROJECT_ID}", pero .firebaserc dice que "${mode}" es "${expected}".`)
  }
  if (mode === 'produccion') {
    if (!expected) throw new Error('Falta el alias "produccion" en .firebaserc. Ver README → "Publicar la app".')
    if (expected === firebaseProject('pruebas')) throw new Error('Producción y pruebas apuntan al mismo proyecto de Firebase.')
    if (env.VITE_ENVIRONMENT_LABEL) throw new Error('En producción VITE_ENVIRONMENT_LABEL debe quedar vacío.')
  }
}

// https://vite.dev/config/
export default defineConfig(({ command, mode }) => {
  // `vite` (desarrollo) usa el modo "development": se trata como pruebas
  const envMode = command === 'serve' && mode === 'development' ? 'pruebas' : mode
  const env = loadEnv(envMode, process.cwd(), 'VITE_')
  if (command === 'build') checkEnvironment(envMode, env)

  return {
    // Así Vite carga .env.pruebas también al correr `vite` sin --mode
    mode: envMode,
    plugins: [
      react(),
      VitePWA({
        // Una versión nueva no recarga la app sola (podría ser a media cuenta): se avisa
        registerType: 'prompt',
        includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
        manifest: {
          name: 'SOMA Punto de Venta',
          short_name: 'SOMA POS',
          description: 'Punto de venta de SOMA',
          lang: 'es',
          start_url: '/',
          scope: '/',
          display: 'standalone',
          orientation: 'any',
          background_color: '#09090b',
          theme_color: '#09090b',
          icons: [
            { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
            { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
            { src: 'pwa-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          ],
        },
        workbox: {
          // Solo la app (HTML/JS/CSS/íconos). Los datos siempre vienen de Firebase.
          globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
          navigateFallback: '/index.html',
          maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
          cleanupOutdatedCaches: true,
          // Que la primera versión instalada controle la página; si no, "Actualizar" no recarga
          clientsClaim: true,
        },
      }),
    ],
  }
})
