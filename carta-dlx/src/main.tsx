import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'

const root = createRoot(document.getElementById('root')!)

// /admin es el editor de DLX; todo lo demás es la carta pública. Se cargan por separado
// para que los clientes no descarguen el editor.
if (/^\/admin\/?$/.test(window.location.pathname)) {
  import('./AdminView.tsx').then(({ default: AdminView }) => {
    root.render(<StrictMode><AdminView /></StrictMode>)
  })
} else {
  import('./CartaView.tsx').then(({ default: CartaView }) => {
    root.render(<StrictMode><CartaView /></StrictMode>)
  })
}
