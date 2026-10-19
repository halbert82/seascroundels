// Cartas de Peligro (tres encuentros y un Destino) y cartas de mazo propio (un encuentro sin Entorno).

import { Fragment, useLayoutEffect, useRef, type CSSProperties } from 'react'
import { Fichas, TextoCarta, claseIcono } from './TextoCarta.tsx'
import { esNombreEncuentroLargo } from './ajustes.ts'
import { COLOR_ENTORNO, COLOR_HABILIDAD, type TextosEncuentro, type VistaDestino, type VistaEncuentro, type VistaMazoPropio, type VistaPeligro } from './vista.ts'

/** «3 / 2»: lo que ganas si superas la Prueba y, más pequeño, si no la superas. */
function AvanceEncuentro({ e }: { e: VistaEncuentro }) {
  if (e.avanceSinSuperar === undefined) return <b>{e.avance}</b>
  return (
    <span className="av-xy" title={`Si superas la Prueba: ${e.avance} de Avance. Si no la superas: ${e.avanceSinSuperar}.`}>
      <b>{e.avance}</b>
      <span className="av-sep">/</span>
      <b className="av-y">{e.avanceSinSuperar}</b>
    </span>
  )
}

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
            <AvanceEncuentro e={e} />
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

// ---------------------------------------------------------------------------
// Peligros 2.0: cada encuentro con su texto completo (Texto, Éxito y Fallo). El alto se reparte según el texto de
// cada encuentro y la letra se ajusta sola hasta que todo cabe.

/**
 * La Prueba (fase 10): a la izquierda, justo encima de Éxito y Fallo, con el icono y la dificultad grandes. Si es una X
 * («X = 2 + tus Mejoras de barco…»), su nota va al lado.
 */
function Prueba2({ e, nota }: { e: VistaEncuentro; nota: TextosEncuentro['nota'] }) {
  return (
    <p className="test2">
      {e.opciones.map((o, i) => (
        <Fragment key={i}>
          {i > 0 && <span className="sep">/</span>}
          <span className="o2" style={{ color: COLOR_HABILIDAD[o.hab] }}>
            <span className={claseIcono(o.hab)} />
            <b>{o.variable ? 'X' : o.dificultad}</b>
          </span>
          {o.alternativa && (
            <span className="alt">
              ({o.alternativa.texto} <i>{o.alternativa.rasgo}</i>)
            </span>
          )}
        </Fragment>
      ))}
      {nota.length > 0 && (
        <span className="alt nota">
          <TextoCarta segmentos={nota} />
        </span>
      )}
    </p>
  )
}

function Encuentro2({ e }: { e: VistaEncuentro }) {
  const t = e.textos
  if (!t) return null
  return (
    <div className="encp v2" data-entorno={e.entorno}>
      {e.entorno && (
        <div className="ent" style={{ '--ec': COLOR_ENTORNO[e.entorno] } as CSSProperties}>
          <span className={claseIcono(e.entorno)} />
        </div>
      )}
      <div className="encb">
        <div className="ench">
          <span className="encn">{e.nombre}</span>
          <span className="av">
            <span className="ic i-avance" />
            <AvanceEncuentro e={e} />
          </span>
        </div>
        <div className="encm">
          {e.claves && <span className="enck">{e.claves}</span>}
          {t.etiquetas.map((x) => (
            <span key={x} className="etq">
              {x}
            </span>
          ))}
          {!e.conPrueba && <span className="sinp">Sin Prueba</span>}
        </div>
        {t.texto.length > 0 && (
          <p className="t2">
            <TextoCarta segmentos={t.texto} />
          </p>
        )}
        {e.conPrueba && <Prueba2 e={e} nota={t.nota} />}
        {t.exito.length > 0 && (
          <p className="t2 win">
            <span className="lbl">Éxito</span>
            <TextoCarta segmentos={t.exito} />
          </p>
        )}
        {t.fallo.length > 0 && (
          <p className="t2 fail">
            <span className="lbl">Fallo</span>
            <TextoCarta segmentos={t.fallo} />
          </p>
        )}
      </div>
    </div>
  )
}

/**
 * El Destino (fase 10): sin nombre; el modificador en el círculo, a la izquierda, y su texto al lado. La línea Sin
 * oposición lleva solo el escudo y su efecto.
 */
function Destino2({ d }: { d: VistaDestino }) {
  return (
    <div className="dest v2" title={`Destino: ${d.nombre}`}>
      <span className={d.mod === '✕' ? 'mod fallo' : 'mod'} style={{ '--dc': d.colorMod } as CSSProperties}>
        {d.mod}
      </span>
      <div className="dest-textos">
        {d.texto.length > 0 && (
          <p className="t2 destt">
            <TextoCarta segmentos={d.texto} tema="oscuro" />
          </p>
        )}
        {d.sinOposicionTexto && d.sinOposicionTexto.length > 0 && (
          <p className="t2 so2">
            <span className="ic i-sinop" />
            <TextoCarta segmentos={d.sinOposicionTexto} tema="oscuro" />
          </p>
        )}
      </div>
    </div>
  )
}

/** Tamaños de letra que se prueban, de mayor a menor, hasta que el texto cabe (fase 10: puede crecer más). */
const TAMANOS = [14, 13.5, 13, 12.5, 12, 11.5, 11, 10.5, 10, 9.6, 9.2, 8.8, 8.4, 8, 7.6, 7.2]

function CartaPeligro2({ v }: { v: VistaPeligro }) {
  const ref = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const carta = ref.current
    if (!carta) return
    const desborda = () => [...carta.querySelectorAll<HTMLElement>('.encb, .dest')].some((x) => x.scrollHeight > x.clientHeight + 0.5)
    for (const t of TAMANOS) {
      carta.style.setProperty('--fs2', `${t}px`)
      if (!desborda()) break
    }
  })
  return (
    <div className="card enc v2" ref={ref}>
      {v.encuentros.map((e, i) => (
        <Encuentro2 key={i} e={e} />
      ))}
      <Destino2 d={v.destino} />
      <div className="hznum">{v.codigo}</div>
    </div>
  )
}

export function CartaPeligro({ v }: { v: VistaPeligro }) {
  if (v.v2) return <CartaPeligro2 v={v} />
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

function CartaMazoPropio2({ v }: { v: VistaMazoPropio }) {
  const ref = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const carta = ref.current
    if (!carta) return
    const desborda = () => [...carta.querySelectorAll<HTMLElement>('.encb, .dest')].some((x) => x.scrollHeight > x.clientHeight + 0.5)
    for (const t of TAMANOS_PROPIO) {
      carta.style.setProperty('--fs2', `${t}px`)
      if (!desborda()) break
    }
  })
  return (
    <div className="card enc solo v2" ref={ref}>
      <div className="soloh">{v.mazo}</div>
      <div className="soloart" style={{ background: FONDO_MAZO_PROPIO }}>
        <span>Ilustración pendiente</span>
      </div>
      <Encuentro2 e={v.encuentro} />
      <Destino2 d={v.destino} />
      {/* Fase 10: es del mazo de historia; su pie deja sitio a la pestaña con el número (la cabecera ya dice su mazo). */}
      <div className="hznum">{v.codigo}</div>
    </div>
  )
}

/** Las cartas de mazo propio tienen un solo encuentro: la letra puede ser algo mayor. */
const TAMANOS_PROPIO = [17, 16, 15, 14, 13.4, 12.8, 12.2, 11.6, 11, 10.5, 10, 9.6, 9.2, 8.8]

export function CartaMazoPropio({ v }: { v: VistaMazoPropio }) {
  if (v.v2) return <CartaMazoPropio2 v={v} />
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
