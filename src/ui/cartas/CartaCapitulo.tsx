// Carta de misión (apaisada): capítulos de travesía, misiones iniciales y aventuras.

import { Fragment, type CSSProperties } from 'react'
import { Fichas, TextoCarta, claseIcono } from './TextoCarta.tsx'
import { COLOR_ENTORNO, type VistaCapitulo } from './vista.ts'

export function CartaCapitulo({ v }: { v: VistaCapitulo }) {
  const conDistancia = v.distancia > 0
  return (
    <div className="card wide chap">
      <div className="chapp">
        <div className="seal">
          <b>{v.sello}</b>
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
      <div className="chapr">
        {v.reglas.map((regla, i) => (
          <Fragment key={i}>
            {i > 0 && <div className="rule" />}
            <div className="rules">
              <TextoCarta segmentos={regla} />
            </div>
          </Fragment>
        ))}
        <div className="flavor">{v.ambientacion}</div>
        <div className="reward">
          <span className="lbl">Recompensa</span>
          <Fichas fichas={v.recompensaTexto ? [...v.recompensa, { texto: v.recompensaTexto }] : v.recompensa} vacio={false} />
          {v.siguiente && <span className="next">{v.siguiente}</span>}
        </div>
      </div>
      <div className="foot">
        <span>{v.pie}</span>
        <span>{v.codigo}</span>
      </div>
    </div>
  )
}
