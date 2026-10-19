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
 * La Prueba, en su columna a la izquierda de Éxito y Fallo: el icono y la dificultad grandes y, debajo, la alternativa
 * por Rasgo y la nota (si es una X, «X = 2 + tus Mejoras de barco…»).
 */
function Prueba2({ e, nota }: { e: VistaEncuentro; nota: TextosEncuentro['nota'] }) {
  return (
    <div className="test2">
      {e.opciones.map((o, i) => (
        <Fragment key={i}>
          {i > 0 && <span className="sep">/</span>}
          <span className="o2" style={{ color: COLOR_HABILIDAD[o.hab] }}>
            <span className={claseIcono(o.hab)} />
            <b>{o.variable ? 'X' : o.dificultad}</b>
          </span>
          {o.alternativa && (
            <span className="alt">
              {o.alternativa.texto} <i>{o.alternativa.rasgo}</i>
            </span>
          )}
        </Fragment>
      ))}
      {nota.length > 0 && (
        <span className="alt nota">
          <TextoCarta segmentos={nota} />
        </span>
      )}
    </div>
  )
}

/** Cuánto texto lleva la nota de la Prueba. */
function largoDe(segmentos: TextosEncuentro['nota']): number {
  return segmentos.reduce((n, s) => n + ('texto' in s ? s.texto.length : 'valor' in s ? s.valor.length + 2 : 2), 0)
}

/**
 * Si la nota o la alternativa de la Prueba son largas, su columna se ensancha para que no queden en una tira. Se decide
 * por carta: los tres filetes quedan alineados.
 */
function pideColumnaAncha(e: VistaEncuentro): boolean {
  const nota = e.textos ? largoDe(e.textos.nota) : 0
  return nota > 34 || e.opciones.some((o) => o.alternativa && o.alternativa.texto.length + o.alternativa.rasgo.length > 12)
}

/**
 * Un encuentro de los Peligros 2.0 (fase 10, segunda revisión de Albert). Arriba, el nombre, el Avance y las etiquetas;
 * debajo, el texto del encuentro a todo el ancho; y al pie, la Prueba a la izquierda, un filete y, a su derecha, Éxito
 * encima de Fallo. Sin Prueba, el efecto ocupa todo el ancho.
 */
function Encuentro2({ e, ancha }: { e: VistaEncuentro; ancha: boolean }) {
  const t = e.textos
  if (!t) return null
  const conResultados = t.exito.length > 0 || t.fallo.length > 0
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
          <p className={e.conPrueba ? 't2 fx' : 't2 fx solo'}>
            <TextoCarta segmentos={t.texto} />
          </p>
        )}
        {e.conPrueba ? (
          <div className={ancha ? 'resol ancha' : 'resol'}>
            <Prueba2 e={e} nota={t.nota} />
            {conResultados && (
              <>
                <span className="filete" aria-hidden="true" />
                <div className="outs2">
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
              </>
            )}
          </div>
        ) : (
          <>
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
          </>
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

/**
 * Tamaños de letra que se prueban, de mayor a menor, hasta que el texto cabe. No baja de 9 px: por debajo ya no se lee
 * bien en la mesa. Si un texto no cabe ni así, hay que acortarlo (scripts/capturar-peligros.mjs lo avisa).
 */
const TAMANOS = [14, 13.5, 13, 12.5, 12, 11.5, 11, 10.5, 10, 9.5, 9]

/**
 * Prueba los tamaños de letra de mayor a menor hasta que nada se desborda. Se repite cuando terminan de cargar las
 * fuentes: medido con la de reserva, el texto ocupa otra cosa.
 */
function useLetraQueCabe(tamanos: readonly number[]) {
  const ref = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const carta = ref.current
    if (!carta) return
    const ajustar = () => {
      const desborda = () =>
        [...carta.querySelectorAll<HTMLElement>('.encb, .dest')].some((x) => x.scrollHeight > x.clientHeight + 0.5)
      for (const t of tamanos) {
        carta.style.setProperty('--fs2', `${t}px`)
        if (!desborda()) break
      }
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
  return ref
}

function CartaPeligro2({ v }: { v: VistaPeligro }) {
  const ref = useLetraQueCabe(TAMANOS)
  return (
    <div className="card enc v2" ref={ref}>
      {v.encuentros.map((e, i) => (
        <Encuentro2 key={i} e={e} ancha={v.encuentros.some(pideColumnaAncha)} />
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
  const ref = useLetraQueCabe(TAMANOS_PROPIO)
  return (
    <div className="card enc solo v2" ref={ref}>
      <div className="soloh">{v.mazo}</div>
      <div className="soloart" style={{ background: FONDO_MAZO_PROPIO }}>
        <span>Ilustración pendiente</span>
      </div>
      <Encuentro2 e={v.encuentro} ancha={pideColumnaAncha(v.encuentro)} />
      <Destino2 d={v.destino} />
      {/* Fase 10: es del mazo de historia; su pie deja sitio a la pestaña con el número (la cabecera ya dice su mazo). */}
      <div className="hznum">{v.codigo}</div>
    </div>
  )
}

/** Las cartas de mazo propio tienen un solo encuentro: la letra puede ser algo mayor (y tampoco baja de 9 px). */
const TAMANOS_PROPIO = [17, 16, 15, 14, 13.4, 12.8, 12.2, 11.6, 11, 10.5, 10, 9.5, 9]

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
