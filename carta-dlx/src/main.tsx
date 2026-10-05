import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import CartaView from './CartaView.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <CartaView />
  </StrictMode>,
)
