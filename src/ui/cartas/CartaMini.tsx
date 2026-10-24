// Fase 16: carta mini de Estado o de Ventaja (41 × 63 mm, como las mini de Arkham y los estados de Marvel Champions).
// Misma maqueta que las demás cartas, en pequeño: placa con el nombre, hueco de ilustración, cinta con el tipo («Estado ·
// Tripulante») y el texto. Los Estados llevan el marco rojo; las Ventajas, el verde.

import { useLayoutEffect, useRef, type CSSProperties } from 'react'
import { TextoCarta } from './TextoCarta.tsx'
import type { VistaMini } from './vista.ts'

/** Letra del texto, de mayor a menor, hasta que cabe en su caja. */
const TAMANOS = [17, 16.5, 16, 15.5, 15, 14.5, 14, 13.5, 13, 12.5, 12, 11.5, 11]

export function CartaMini({ v }: { v: VistaMini }) {
  const caja = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const el = caja.current
    if (!el) return
    const cabe = () => {
      if (el.scrollHeight > el.clientHeight + 0.5) return false
      const ultimo = el.lastElementChild
      if (!ultimo) return true
      const marco = el.getBoundingClientRect()
      const escala = el.offsetHeight > 0 ? marco.height / el.offsetHeight : 1
      const estilo = getComputedStyle(el)
      const debajo = (parseFloat(estilo.paddingBottom) || 0) + (parseFloat(estilo.borderBottomWidth) || 0)
      return (ultimo.getBoundingClientRect().bottom - marco.top) / escala + debajo <= el.offsetHeight + 1
    }
    const ajustar = () => {
      for (const t of TAMANOS) {
        el.style.setProperty('--fsm', `${t}px`)
        if (cabe()) break
      }
      el.dataset.letra = el.style.getPropertyValue('--fsm')
    }
    ajustar()
    let vivo = true
    if (typeof document !== 'undefined' && document.fonts && document.fonts.status !== 'loaded') {
      void document.fonts.ready.then(() => {
        if (vivo) ajustar()
      })
    }
    return () => {
      vivo = false
    }
  })
  const fondo = `linear-gradient(160deg, color-mix(in srgb, ${v.color}, #fff 14%) 0%, color-mix(in srgb, ${v.color}, #000 58%) 100%)`
  return (
    <div className={`card cmini ${v.ventaja ? 'ventaja' : 'estado'}`} style={{ '--cc': v.color } as CSSProperties}>
      <div className="art" style={{ background: fondo }}>
        Ilustración pendiente
      </div>
      <div className="plate">
        <span className="name">{v.nombre}</span>
      </div>
      <div className="ribbon">{v.tipoTexto}</div>
      <div className="tbox" ref={caja}>
        <div className="rules">
          <TextoCarta segmentos={v.texto} />
        </div>
      </div>
      <div className="foot">
        <span>{v.copias === 1 ? '1 copia' : `${v.copias} copias`}</span>
        <span>{v.codigo}</span>
      </div>
    </div>
  )
}
