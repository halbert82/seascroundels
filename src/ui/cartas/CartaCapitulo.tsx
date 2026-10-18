// Carta de misión (apaisada): capítulos de travesía, misiones iniciales y aventuras.

import { Fragment, useLayoutEffect, useRef, type CSSProperties } from 'react'
import { Fichas, TextoCarta, claseIcono } from './TextoCarta.tsx'
import { COLOR_ENTORNO, type VistaCapitulo } from './vista.ts'

/** Tamaños de letra de las reglas que se prueban, de mayor a menor, hasta que todo cabe. */
const TAMANOS = [16, 15.2, 14.4, 13.6, 12.8, 12, 11.4, 10.8]

export function CartaCapitulo({ v }: { v: VistaCapitulo }) {
  const conDistancia = v.distancia > 0
  const ref = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const caja = ref.current
    if (!caja) return
    for (const t of TAMANOS) {
      caja.style.setProperty('--fsr', `${t}px`)
      if (caja.scrollHeight <= caja.clientHeight + 0.5) break
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
            del capítulo
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
      <div className="chapr" ref={ref}>
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
        <span>{v.pie}</span>
        <span>{v.codigo}</span>
      </div>
    </div>
  )
}
