// Dorsos de los mazos: madera y oro, cada mazo con su color y su emblema.

import type { CSSProperties } from 'react'
import { claseIcono } from '../cartas/TextoCarta.tsx'
import type { IconoId } from '../cartas/marcado.ts'
import './dorso.css'

export type TipoDorso = 'peligros' | 'capitan' | 'muelle' | 'escenario' | 'misiones'

export const DORSOS: Record<TipoDorso, { nombre: string; color: string; emblema: IconoId }> = {
  peligros: { nombre: 'Peligros', color: '#6E1F17', emblema: 'rep' },
  capitan: { nombre: 'Capitán', color: '#1E3550', emblema: 'MAN' },
  muelle: { nombre: 'Muelle', color: '#24452F', emblema: 'espacio' },
  escenario: { nombre: 'Escenario', color: '#7A5418', emblema: 'acampar' },
  misiones: { nombre: 'Misiones', color: '#3B2B4F', emblema: 'avance' },
}

/**
 * Dorso a tamaño de carta (378×528); se escala desde fuera como las cartas. Con `numero`, es el de una carta del mazo
 * de historia (fase 10): el dorso del mazo al que va, con su número bien visible en el centro.
 */
export function Dorso({ tipo, numero, apaisado = false }: { tipo: TipoDorso; numero?: number; apaisado?: boolean }) {
  const d = DORSOS[tipo]
  const clase = ['dorso', numero !== undefined ? 'de-historia' : '', apaisado ? 'apaisado' : ''].filter(Boolean).join(' ')
  return (
    <div className={clase} style={{ '--dorso': d.color } as CSSProperties}>
      <div className="dorso-marco">
        <div className="dorso-rosa">
          {numero === undefined ? <span className={`${claseIcono(d.emblema)} dorso-emblema`} /> : <b className="dorso-numero">{numero}</b>}
        </div>
        <div className="dorso-titulo">Sea Scoundrels</div>
        <div className="dorso-nombre">{d.nombre}</div>
        {numero !== undefined && <div className="dorso-historia">Mazo de historia · carta {numero}</div>}
      </div>
    </div>
  )
}

/** Dorso escalado que ocupa su tamaño final. */
export function DorsoEscalado({ tipo, escala, numero, apaisado = false }: { tipo: TipoDorso; escala: number; numero?: number; apaisado?: boolean }) {
  const [ancho, alto] = apaisado ? [528, 378] : [378, 528]
  return (
    <div style={{ width: ancho * escala, height: alto * escala, position: 'relative', flex: 'none' }}>
      <div style={{ position: 'absolute', left: 0, top: 0, transform: `scale(${escala})`, transformOrigin: '0 0' }}>
        <Dorso tipo={tipo} apaisado={apaisado} {...(numero !== undefined ? { numero } : {})} />
      </div>
    </div>
  )
}
