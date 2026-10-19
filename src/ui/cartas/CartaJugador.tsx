// Carta vertical: Capitán, Barco, Tripulante, Mejoras, Evento, Habilidad, Escenario y Tesoro.

import type { CSSProperties } from 'react'
import { NombreCarta } from './NombreCarta.tsx'
import { esTextoApretado } from './ajustes.ts'
import { TextoCarta, claseIcono } from './TextoCarta.tsx'
import type { VistaJugador } from './vista.ts'

function fondoArte(v: VistaJugador): string {
  if (v.arte) return `url("${v.arte.url}") ${v.arte.encuadre}/cover no-repeat`
  return `linear-gradient(160deg, color-mix(in srgb, ${v.color}, #fff 12%) 0%, color-mix(in srgb, ${v.color}, #000 55%) 100%)`
}

export function CartaJugador({ v }: { v: VistaJugador }) {
  const estiloCarta = { '--cc': v.color } as CSSProperties
  const conCoste = v.coste !== undefined
  return (
    <div className={['card', v.alta && 'tall', esTextoApretado(v.num) && 'tight', v.diseno && `jug t-${v.diseno}`].filter(Boolean).join(' ')} style={estiloCarta}>
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
      <div className="tbox">
        {v.rasgos.length > 0 && (
          <>
            <div className="traits">
              <span>{v.rasgos.map((r) => `${r}.`).join(' ')}</span>
            </div>
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
