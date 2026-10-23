// Carta de misión (apaisada): capítulos de travesía, misiones iniciales y aventuras.

import { Fragment, useLayoutEffect, useRef, type CSSProperties } from 'react'
import { Fichas, TextoCarta, claseIcono } from './TextoCarta.tsx'
import { COLOR_ENTORNO, type HistoriaDeCarta, type VistaCapitulo } from './vista.ts'

/** Tamaños de letra de las reglas que se prueban, de mayor a menor, hasta que todo cabe. */
const TAMANOS = [16, 15.2, 14.4, 13.6, 12.8, 12, 11.4, 10.8]

export function CartaCapitulo({ v }: { v: VistaCapitulo & { historia?: HistoriaDeCarta } }) {
  const conDistancia = v.distancia > 0
  const ref = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const caja = ref.current
    if (!caja) return
    // Cabe si no se sale ni por abajo ni por los lados, y la recompensa cabe entera, también de alto (fase 11: la pastilla
    // «Añade la carta N…» quedaba aplastada).
    const cabe = () =>
      caja.scrollHeight <= caja.clientHeight + 0.5 &&
      [...caja.querySelectorAll<HTMLElement>('.reward, .rcab')].every((el) => el.scrollWidth <= el.clientWidth + 0.5 && el.scrollHeight <= el.clientHeight + 0.5)
    const ajustar = () => {
      for (const t of TAMANOS) {
        caja.style.setProperty('--fsr', `${t}px`)
        if (cabe()) break
      }
    }
    ajustar()
    // Fase 12: se repite cuando terminan de cargar las fuentes. Medida con la de reserva, la pastilla «Añade la carta
    // 128…» de la carta 238 cabía y, con la buena, se salía 3 px del recuadro de la recompensa.
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
    <div className="card wide chap">
      <div className="chapp">
        <div className={v.rama ? 'seal rama' : 'seal'}>
          <b>
            {v.sello}
            {v.rama && <i>-{v.rama}</i>}
          </b>
          <small>de {v.de}</small>
        </div>
        <div className="chapt">
          <span className="chapm">{v.travesia}</span>
          <span className="chapn">{v.nombre}</span>
        </div>
      </div>
      {v.arte ? (
        <div className="chapart" style={{ background: `url("${v.arte.url}") ${v.arte.encuadre}/cover no-repeat` }} />
      ) : (
        <div className="chapart ph">
          <span>
            Ilustración
            <br />
            pendiente
          </span>
        </div>
      )}
      <div className="tabs">
        <span
          className={conDistancia ? 'tab entd' : 'tab'}
          style={{ '--sc': COLOR_ENTORNO[v.entorno] } as CSSProperties}
        >
          <span className={claseIcono(v.entorno)} />
          {conDistancia && (
            <span className="dst">
              <span className="ic i-nav" />
              <b>{v.distancia}</b>
            </span>
          )}
        </span>
        <span className="tab dark">
          <span className="ic i-avance" />
          <b>{v.avance}</b>
        </span>
      </div>
      <div className={v.reglas.length === 0 ? 'chapr sinreglas' : 'chapr'} ref={ref}>
        {v.reglas.map((regla, i) => (
          <Fragment key={i}>
            {i > 0 && <div className="rule" />}
            <div className="rules">
              <TextoCarta segmentos={regla} />
            </div>
          </Fragment>
        ))}
        <div className="flavor">{v.ambientacion}</div>
        {v.recompensaMarcada ? (
          <div className="reward marcada">
            <div className="rcab">
              <span className="lbl">Recompensa</span>
              {v.siguiente && <span className="next">{v.siguiente}</span>}
            </div>
            <div className="rtexto">
              <TextoCarta segmentos={v.recompensaMarcada} />
            </div>
          </div>
        ) : (
          <div className="reward">
            <span className="lbl">Recompensa</span>
            <Fichas fichas={v.recompensaTexto ? [...v.recompensa, { texto: v.recompensaTexto }] : v.recompensa} vacio={false} />
            {v.siguiente && <span className="next">{v.siguiente}</span>}
          </div>
        )}
      </div>
      <div className="foot">
        {v.historia ? (
          <span className="pie-historia">
            {v.pie}
            <b className="nh-num">{v.historia.num}</b>
          </span>
        ) : (
          <span>{v.pie}</span>
        )}
        <span>{v.codigo}</span>
      </div>
    </div>
  )
}
