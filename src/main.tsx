import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'

const root = createRoot(document.getElementById('root')!)

// /carta es el menú digital público (comensales, sin sesión); todo lo demás es el punto de venta.
// Cada uno se carga por separado para que el menú no descargue la app completa.
if (/^\/carta\/?$/.test(window.location.pathname)) {
  import('./components/PublicMenuView.tsx').then(({ default: PublicMenuView }) => {
    root.render(
      <StrictMode>
        <PublicMenuView />
      </StrictMode>,
    )
  })
} else {
  Promise.all([import('./App.tsx'), import('./components/UpdatePrompt.tsx')]).then(([{ default: App }, { default: UpdatePrompt }]) => {
    root.render(
      <StrictMode>
        <App />
        <UpdatePrompt />
      </StrictMode>,
    )
  })
}
