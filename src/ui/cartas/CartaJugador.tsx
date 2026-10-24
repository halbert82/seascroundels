// Carta vertical: Capitán, Barco, Tripulante, Mejoras, Evento, Habilidad, Escenario y Tesoro.

import { useLayoutEffect, useRef, type CSSProperties } from 'react'
import { NombreCarta } from './NombreCarta.tsx'
import { esTextoApretado } from './ajustes.ts'
import { TextoCarta, claseIcono } from './TextoCarta.tsx'
import type { VistaJugador } from './vista.ts'

function fondoArte(v: VistaJugador): string {
  if (v.arte) return `url("${v.arte.url}") ${v.arte.encuadre}/cover no-repeat`
  return `linear-gradient(160deg, color-mix(in srgb, ${v.color}, #fff 12%) 0%, color-mix(in srgb, ${v.color}, #000 55%) 100%)`
}

/** Fase 11: letra de las permanentes (mucho texto), de mayor a menor, hasta que cabe en su caja. */
const TAMANOS_PERMANENTE = [16.5, 16, 15.5, 15, 14.5, 14, 13.5, 13, 12.5, 12]

export function CartaJugador({ v }: { v: VistaJugador }) {
  // Fase 16: las cartas de jugador llevan todas la misma letra en las reglas (--fsj; ver ajustes.ts).
  const estiloCarta = {
    '--cc': v.color,
    ...(v.letra !== undefined ? { '--fsj': `${v.letra}px` } : {}),
    ...(v.arteCorto ? { '--acorta': `${v.arteCorto}px` } : {}),
  } as CSSProperties
  const conCoste = v.coste !== undefined
  const caja = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const el = caja.current
    if (!v.permanente || !el) return
    const carta = el.closest('.card')
    // ¿Cabe todo, también el relleno de abajo? En una caja flexible, scrollHeight no siempre lo cuenta, y la ambientación
    // (o la última línea) llegaba a tocar el borde (fase 15: 220, 228, 267, 273, 275, 285 y 286).
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
    const probar = () => {
      for (const t of TAMANOS_PERMANENTE) {
        el.style.setProperty('--fsp', `${t}px`)
        if (cabe()) return true
      }
      return false
    }
    // Fase 15: si ni con la letra más pequeña cabe (las Murallas de Port Royal), la ilustración se acorta y la caja de
    // texto sube.
    const ajustar = () => {
      carta?.classList.remove('largo')
      if (!probar() && carta) {
        carta.classList.add('largo')
        probar()
      }
      el.dataset.letra = el.style.getPropertyValue('--fsp')
    }
    ajustar()
    // Se repite cuando terminan de cargar las fuentes (con la de reserva, el texto mide distinto).
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
  return (
    <div
      className={[
        'card',
        v.alta && 'tall',
        v.permanente && 'perm',
        v.arteCorto && 'acorta',
        v.letra !== undefined ? 'dj' : esTextoApretado(v.num) && 'tight',
        v.diseno && `jug t-${v.diseno}`,
      ]
        .filter(Boolean)
        .join(' ')}
      style={estiloCarta}
    >
      {v.diseno === 'mejoraBarco' && <div className="marco" />}
      <div className="art" style={{ background: fondoArte(v) }}>
        {v.arte ? '' : 'Ilustración pendiente'}
      </div>
      <div className={conCoste ? 'plate cst' : 'plate'}>
        <NombreCarta nombre={v.nombre} unica={v.unica} num={v.num} />
        {v.diseno === 'evento' && <span className="sub">{v.tipoTexto}</span>}
      </div>
      {v.espacio > 0 && (
        <div className="espq">
          {Array.from({ length: v.espacio }, (_, i) => (
            <span key={i} className="sq" />
          ))}
        </div>
      )}
      {conCoste && (
        <div className="costb">
          <b>{v.coste}</b>
        </div>
      )}
      <div className="tabs" style={{ top: v.pestanasIzqTop }}>
        {v.pestanasIzq.map((p, i) => (
          <span
            key={i}
            className={p.valor === 0 ? 'tab zero' : 'tab'}
            style={{ '--sc': p.color } as CSSProperties}
          >
            <span className={claseIcono(p.icono)} />
            {p.valor !== undefined && <b>{p.valor}</b>}
          </span>
        ))}
      </div>
      <div className="tabs r" style={{ top: v.pestanasDerTop }}>
        {v.pestanasDer.map((p, i) => (
          <span key={i} className="tab" style={{ '--sc': p.color } as CSSProperties}>
            <span className={claseIcono(p.icono)} />
            <b>{p.valor}</b>
          </span>
        ))}
      </div>
      {v.huecos !== undefined && (
        <div className="tabs r" style={{ top: v.huecosTop }}>
          <span className={v.huecos === 0 ? 'tab mejt zero' : 'tab mejt'}>
            <span className="ic i-saco" />
            <b>{v.huecos}</b>
          </span>
        </div>
      )}
      {v.vida !== undefined && (
        <div className="vida">
          <b>{v.vida}</b>
        </div>
      )}
      {v.diseno !== 'evento' && <div className="ribbon">{v.tipoTexto}</div>}
      <div className="tbox" ref={caja}>
        {v.rasgos.length > 0 && (
          <>
            <div className="traits">
              <span>{v.rasgos.map((r) => `${r}.`).join(' ')}</span>
            </div>
            <div className="rule" />
          </>
        )}
        {v.tipos && (
          <>
            <div className="ptipo">{v.tipos}</div>
            <div className="rule" />
          </>
        )}
        <div className={v.textoClase ? `rules ${v.textoClase}` : 'rules'}>
          <TextoCarta segmentos={v.texto} />
        </div>
        {v.ambientacion && <div className="flavor">{v.ambientacion}</div>}
      </div>
      <div className="foot">
        <span>
          {v.clase && <span className="cl">{v.clase} · </span>}
          {v.arte ? 'Ilus. Midjourney' : 'Ilustración pendiente'}
        </span>
        <span>{v.codigo}</span>
      </div>
    </div>
  )
}
