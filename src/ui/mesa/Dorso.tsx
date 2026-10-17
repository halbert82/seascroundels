// Dorsos de los mazos: madera y oro, cada mazo con su color y su emblema.

import type { CSSProperties } from 'react'
import { claseIcono } from '../cartas/TextoCarta.tsx'
import type { IconoId } from '../cartas/marcado.ts'

export type TipoDorso = 'peligros' | 'capitan' | 'muelle' | 'escenario'

export const DORSOS: Record<TipoDorso, { nombre: string; color: string; emblema: IconoId }> = {
  peligros: { nombre: 'Peligros', color: '#6E1F17', emblema: 'rep' },
  capitan: { nombre: 'Capitán', color: '#1E3550', emblema: 'MAN' },
  muelle: { nombre: 'Muelle', color: '#24452F', emblema: 'espacio' },
  escenario: { nombre: 'Escenario', color: '#7A5418', emblema: 'acampar' },
}

/** Dorso a tamaño de carta (378×528); se escala desde fuera como las cartas. */
export function Dorso({ tipo }: { tipo: TipoDorso }) {
  const d = DORSOS[tipo]
  return (
    <div className="dorso" style={{ '--dorso': d.color } as CSSProperties}>
      <div className="dorso-marco">
        <div className="dorso-rosa">
          <span className={`${claseIcono(d.emblema)} dorso-emblema`} />
        </div>
        <div className="dorso-titulo">Sea Scoundrels</div>
        <div className="dorso-nombre">{d.nombre}</div>
      </div>
    </div>
  )
}

/** Dorso escalado que ocupa su tamaño final. */
export function DorsoEscalado({ tipo, escala }: { tipo: TipoDorso; escala: number }) {
  return (
    <div style={{ width: 378 * escala, height: 528 * escala, position: 'relative', flex: 'none' }}>
      <div style={{ position: 'absolute', left: 0, top: 0, transform: `scale(${escala})`, transformOrigin: '0 0' }}>
        <Dorso tipo={tipo} />
      </div>
    </div>
  )
}
