import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './estilos/fuentes.ts'
import './estilos/global.css'
import { App } from './App.tsx'

const raiz = document.getElementById('root')
if (!raiz) throw new Error('Falta el elemento #root')

createRoot(raiz).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
