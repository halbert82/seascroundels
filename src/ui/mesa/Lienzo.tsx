// La mesa se diseña a 1440×900 y se escala entera para caber en la pantalla (tableta incluida).

import { useEffect, useState, type ReactNode } from 'react'

export const ANCHO = 1440
export const ALTO = 900

function escalaPara(ancho: number, alto: number): number {
  return Math.min(ancho / ANCHO, alto / ALTO)
}

export function Lienzo({ children }: { children: ReactNode }) {
  const [escala, setEscala] = useState(() => escalaPara(window.innerWidth, window.innerHeight))
  useEffect(() => {
    const alCambiar = () => setEscala(escalaPara(window.innerWidth, window.innerHeight))
    window.addEventListener('resize', alCambiar)
    return () => window.removeEventListener('resize', alCambiar)
  }, [])
  const alto = window.innerHeight
  return (
    <div className="lienzo-marco">
      {/* La barra superior sigue de lado a lado aunque la mesa no ocupe todo el ancho. */}
      <div className="franja-superior" style={{ top: (alto - ALTO * escala) / 2, height: 58 * escala }} />
      <div className="lienzo" style={{ width: ANCHO, height: ALTO, transform: `translate(-50%, -50%) scale(${escala})` }}>
        {children}
      </div>
    </div>
  )
}
