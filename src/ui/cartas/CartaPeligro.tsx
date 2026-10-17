// Cartas de Peligro (tres encuentros y un Destino) y cartas de mazo propio (un encuentro sin Entorno).

import { Fragment, type CSSProperties } from 'react'
import { Fichas, TextoCarta, claseIcono } from './TextoCarta.tsx'
import { esNombreEncuentroLargo } from './ajustes.ts'
import { COLOR_ENTORNO, COLOR_HABILIDAD, type VistaDestino, type VistaEncuentro, type VistaMazoPropio, type VistaPeligro } from './vista.ts'

function Encuentro({ e }: { e: VistaEncuentro }) {
  return (
    <div className="encp">
      {e.entorno && (
        <div className="ent" style={{ '--ec': COLOR_ENTORNO[e.entorno] } as CSSProperties}>
          <span className={claseIcono(e.entorno)} />
        </div>
      )}
      <div className="encb">
        <div className="ench">
          <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
            <span className={esNombreEncuentroLargo(e.nombre) ? 'encn long' : 'encn'}>{e.nombre}</span>
            <span className="enck">{e.claves}</span>
          </div>
          <span className="av">
            <span className="ic i-avance" />
            <b>{e.avance}</b>
          </span>
        </div>
        {e.conPrueba ? (
          <>
            <div className="test">
              {e.opciones.map((o, i) => (
                <Fragment key={i}>
                  {i > 0 && <span className="sep">/</span>}
                  <span className="opt" style={{ color: COLOR_HABILIDAD[o.hab] }}>
                    <span className={claseIcono(o.hab)} />
                    <b>{o.dificultad}</b>
                  </span>
                  {o.alternativa && (
                    <span className="alt">
                      ({o.alternativa.texto} <i>{o.alternativa.rasgo}</i>)
                    </span>
                  )}
                </Fragment>
              ))}
            </div>
            <div className="outs">
              <div className="out win">
                <Fichas fichas={e.exito} />
              </div>
              <div className="out fail">
                <Fichas fichas={e.fallo} />
              </div>
            </div>
          </>
        ) : (
          <div className="outs">
            <div className="out fx">
              <Fichas fichas={e.efecto} />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

/** La franja del Destino (también se usa sola, ampliada, en la mesa). */
export function Destino({ d, entraDuranteLaPartida }: { d: VistaDestino; entraDuranteLaPartida: boolean }) {
  const conLinea = d.texto.length > 0 || d.sinOposicion.length > 0
  return (
    <div className="dest">
      <div className="desth">
        <span className="destn">{d.nombre}</span>
        <span className={d.mod === '✕' ? 'mod fallo' : 'mod'} style={{ '--dc': d.colorMod } as CSSProperties}>
          {d.mod}
        </span>
      </div>
      <div className="destf">{d.ambientacion}</div>
      {conLinea && (
        <div className="destr">
          <span className="destt">
            <TextoCarta segmentos={d.texto} tema="oscuro" />
          </span>
          {d.sinOposicion.length > 0 && (
            <span className="so">
              <span className="ic i-sinop" />
              <Fichas fichas={d.sinOposicion} vacio={false} />
            </span>
          )}
        </div>
      )}
      {entraDuranteLaPartida && <div className="oncet">Entra en el mazo durante la partida</div>}
    </div>
  )
}

export function CartaPeligro({ v }: { v: VistaPeligro }) {
  return (
    <div className="card enc">
      {v.encuentros.map((e, i) => (
        <Encuentro key={i} e={e} />
      ))}
      <Destino d={v.destino} entraDuranteLaPartida={v.entraDuranteLaPartida} />
      <div className="hznum">{v.codigo}</div>
    </div>
  )
}

const FONDO_MAZO_PROPIO =
  'linear-gradient(160deg, color-mix(in srgb, #3B302A, #fff 12%) 0%, color-mix(in srgb, #3B302A, #000 55%) 100%)'

export function CartaMazoPropio({ v }: { v: VistaMazoPropio }) {
  return (
    <div className="card enc solo">
      <div className="soloh">{v.mazo}</div>
      <div className="soloart" style={{ background: FONDO_MAZO_PROPIO }}>
        <span>Ilustración pendiente</span>
      </div>
      <Encuentro e={v.encuentro} />
      <Destino d={v.destino} entraDuranteLaPartida={false} />
      <div className="hznum">
        <span>Mazo propio</span> · <span>{v.codigo}</span>
      </div>
    </div>
  )
}
