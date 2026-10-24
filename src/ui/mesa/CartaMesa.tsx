// Una carta sobre la mesa: la misma carta de la galería, escalada, con sus fichas encima,
// girada si está agotada, volteada al revelarse y volando entre zonas (layoutId = su copia).

import { motion } from 'motion/react'
import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { porId } from '../../engine/catalogo.ts'
import type { Entorno } from '../../engine/datos.ts'
import { CartaEscalada, dimensiones } from '../cartas/Carta.tsx'
import { claseIcono } from '../cartas/TextoCarta.tsx'
import { DorsoEscalado, type TipoDorso } from './Dorso.tsx'
import { duracion, useVelocidad } from './preferencias.ts'
import { useAmpliable, type AccionesZoom } from './Zoom.tsx'

export type Marca = 'legal' | 'elegida' | 'atenuada' | null

export interface FichasCarta {
  heridas?: number
  vida?: number
  avance?: number
  /** Fichas del contador de una carta de Peligro en juego. */
  contador?: number
  entrenamiento?: string[]
  /** Fase 14: fichas de Enrolado que le quedan a un Tripulante (se va cuando no le queda ninguna). */
  enrolado?: number
  /** Fase 15: Vida que le queda a una permanente que se puede dañar (o herir, el prisionero). */
  vidaCarta?: { restante: number; total: number; icono: 'dano' | 'herida' }
}

export interface PropsCartaMesa {
  /** Copia de la carta (o «barco», «puerto»…): es su identidad para volar entre zonas. */
  inst: string
  /** Sin vuelo entre zonas (para copias que se enseñan dos veces, como la última carta resuelta). */
  sinVuelo?: boolean
  id: string
  escala: number
  agotada?: boolean
  /**
   * Cuánto se encoge al agotarse (1: nada). En una tableta las cartas de la tripulación son más grandes que su hueco
   * girado: al agotarse giran y se encogen hasta caber en él.
   */
  encogeAgotada?: number
  marca?: Marca
  /** Orden de elección (1, 2…), para las decisiones en que importa. */
  numero?: number
  /** Participa en la Prueba en curso (comprometido) o se ha agotado para pagar algo en ella. */
  participa?: boolean
  fichas?: FichasCarta
  /** Se da la vuelta desde el dorso al aparecer. */
  revelar?: TipoDorso
  /** En una carta de Peligro, el encuentro que se lee (los otros dos se atenúan). */
  entorno?: Entorno | null
  /** Al pulsarla; `opcion`, si se eligió una de `acciones` en la ampliación (con el dedo). */
  onClick?: (elemento: HTMLElement, opcion?: number) => void
  /** Texto de ayuda al pasar el ratón (qué pasa si la pulsas). */
  ayuda?: string
  /** Lo que puede hacer la carta, uno por opción: con el dedo salen como botones en la ampliación. */
  acciones?: readonly string[]
  children?: ReactNode
}

const ORDEN_ENTORNO: Entorno[] = ['mar', 'nat', 'ciu']

export function CartaMesa(p: PropsCartaMesa) {
  const entrada = porId(p.id)
  const { ancho, alto } = dimensiones(entrada)
  const velocidad = useVelocidad()
  // Las acciones se leen de las props más recientes: la ampliación puede seguir abierta mientras la partida avanza.
  const ultimas = useRef(p)
  ultimas.current = p
  const accionesZoom = useMemo<AccionesZoom>(
    () => ({
      etiquetas: () => (ultimas.current.onClick ? (ultimas.current.acciones ?? [ultimas.current.ayuda ?? 'Usar esta carta']) : []),
      hacer: (ancla, opcion) => ultimas.current.onClick?.(ancla, opcion),
    }),
    [],
  )
  const ampliable = useAmpliable(p.id, accionesZoom)
  const t = duracion(velocidad, 0.28)
  // Agotada: girada 90°; sin encogerse, salvo que su hueco no tenga sitio para ella girada (en una tableta).
  const k = p.agotada ? (p.encogeAgotada ?? 1) : 1
  const giro = p.agotada ? { rotate: 90, scale: k } : { rotate: 0, scale: 1 }
  /** Lo que queda por encima (y por debajo) de la carta girada dentro de su caja. */
  const margenGirada = (alto * p.escala - ancho * p.escala * k) / 2

  // Destello al sufrir heridas o perder munición.
  const [golpe, setGolpe] = useState(0)
  const heridasAntes = useRef(p.fichas?.heridas ?? 0)
  useEffect(() => {
    const ahora = p.fichas?.heridas ?? 0
    if (ahora > heridasAntes.current) setGolpe((g) => g + 1)
    heridasAntes.current = ahora
  }, [p.fichas?.heridas])

  const esPeligro = entrada.tipo === 'peligro' && p.entorno
  // Peligros 2.0: los encuentros miden lo que su texto; se atenúan los que no se leen con una clase, no con velos.
  const v2 = entrada.tipo === 'peligro' && entrada.carta.version === 2
  const pulsable = Boolean(p.onClick)

  return (
    <motion.div
      {...(p.sinVuelo ? {} : { layoutId: p.inst, layout: true })}
      transition={{ duration: t, ease: [0.3, 0.7, 0.3, 1] }}
      className={`carta-mesa${p.marca ? ` marca-${p.marca}` : ''}${pulsable ? ' pulsable' : ''}${p.participa ? ' participa' : ''}${p.agotada ? ' agotada' : ''}`}
      data-inst={p.inst}
      data-carta={p.id}
      {...(esPeligro && v2 && p.entorno ? { 'data-entorno': p.entorno } : {})}
      style={{ width: ancho * p.escala, height: alto * p.escala }}
      // Con el dedo, el primer toque solo la amplía (la acción, con los botones de la ampliación o con otro toque).
      onClick={(e) => {
        if (ampliable.alPulsar(e.currentTarget)) return
        p.onClick?.(e.currentTarget)
      }}
      onPointerDown={ampliable.onPointerDown}
      onPointerEnter={ampliable.onPointerEnter}
      onPointerLeave={ampliable.onPointerLeave}
      onContextMenu={ampliable.onContextMenu}
      title={p.ayuda}
    >
      <motion.div className="carta-giro" animate={giro} transition={{ duration: t }} initial={false}>
        <motion.div
          className="carta-volteo"
          initial={p.revelar && t > 0 ? { rotateY: 180 } : false}
          animate={{ rotateY: 0 }}
          transition={{ duration: duracion(velocidad, 0.42), ease: 'easeOut' }}
        >
          <div className="cara frente">
            <CartaEscalada entrada={entrada} escala={p.escala} />
            {esPeligro && !v2 && (
              <div className="velos" style={{ transform: `scale(${p.escala})` }}>
                {ORDEN_ENTORNO.map((e, i) =>
                  e === p.entorno ? (
                    <div key={e} className="velo activo" style={{ top: 8 + i * 128 }} />
                  ) : (
                    <div key={e} className="velo" style={{ top: 8 + i * 128 }} />
                  ),
                )}
                <div className="velo velo-destino" title="El Destino de esta carta no se usa: el de la Prueba sale de la siguiente." />
              </div>
            )}
          </div>
          {p.revelar && t > 0 && (
            <div className="cara dorso-cara">
              <DorsoEscalado tipo={p.revelar} escala={p.escala} />
            </div>
          )}
        </motion.div>
      </motion.div>
      {golpe > 0 && <div key={golpe} className="destello" style={{ '--t': `${duracion(velocidad, 0.45)}s` } as CSSProperties} />}
      <Fichas fichas={p.fichas} abajo={p.agotada ? margenGirada + 4 : undefined} />
      {p.participa && (
        <span className="sello-participa" style={p.agotada ? { top: margenGirada - 10 } : undefined}>
          En la Prueba
        </span>
      )}
      {p.numero !== undefined && <span className="numero-orden">{p.numero}</span>}
      {p.marca === 'elegida' && p.numero === undefined && <span className="marca-check" />}
      {p.children}
    </motion.div>
  )
}

function Fichas({ fichas, abajo }: { fichas?: FichasCarta; abajo?: number | undefined }) {
  if (!fichas) return null
  const { heridas = 0, vida, avance, contador, entrenamiento = [], enrolado, vidaCarta } = fichas
  return (
    <div className="fichas" style={abajo !== undefined ? { bottom: abajo } : undefined}>
      {vidaCarta && (
        <span
          className={`ficha ficha-vida-carta${vidaCarta.restante <= 1 ? ' poca' : ''}`}
          title={`Le ${vidaCarta.restante === 1 ? 'queda' : 'quedan'} ${vidaCarta.restante} de ${vidaCarta.total} de Vida (${vidaCarta.total - vidaCarta.restante} ${vidaCarta.icono === 'dano' ? 'de daño' : vidaCarta.total - vidaCarta.restante === 1 ? 'herida' : 'heridas'})`}
        >
          <span className={claseIcono('vida')} />
          <b>
            {vidaCarta.restante}
            <small>/{vidaCarta.total}</small>
          </b>
        </span>
      )}
      {heridas > 0 && (
        <span className="ficha ficha-herida" title={`${heridas} ${heridas === 1 ? 'herida' : 'heridas'}${vida ? ` de ${vida}` : ''}`}>
          <span className={claseIcono('herida')} />
          <b>
            {heridas}
            {vida ? <small>/{vida}</small> : null}
          </b>
        </span>
      )}
      {avance !== undefined && avance > 0 && (
        <span className="ficha ficha-avance" title={`${avance} de Avance`}>
          <span className={claseIcono('avance')} />
          <b>{avance}</b>
        </span>
      )}
      {contador !== undefined && (
        // Fase 10: un solo tipo de contador, también para las cartas que se quedan en juego y llevan la cuenta de algo. Fase 16:
        // se lleva con un dado (se dibuja como un dado).
        <span className="ficha ficha-contador dado" title={`Contador: ${contador} (un dado sobre esta carta)`}>
          <b>{contador}</b>
        </span>
      )}
      {enrolado !== undefined && (
        <span
          className="ficha ficha-contador ficha-enrolado dado"
          title={`Enrolado: ${enrolado}. Su dado baja 1 al final de cada turno y se va al llegar a 0.`}
        >
          <b>{enrolado}</b>
          <small>Enrolado</small>
        </span>
      )}
      {entrenamiento.map((h, i) => (
        <span key={i} className={`ficha ficha-entrenamiento hab-${h.toLowerCase()}`} title={`Entrenamiento: +1 ${h}`}>
          <span className={claseIcono(h as 'NAV')} />
          <b>+1</b>
        </span>
      ))}
    </div>
  )
}
