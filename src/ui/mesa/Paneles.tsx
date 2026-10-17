// Paneles de la mesa: lo último que ha pasado, registro, ayuda, menú, menú de carta, fin de misión y fin de partida.

import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useRef, type ReactNode } from 'react'
import { nombreDe, porId } from '../../engine/catalogo.ts'
import { CartaEscalada } from '../cartas/Carta.tsx'
import { resumenDePartida } from '../../engine/resumen.ts'
import type { EntradaRegistro, Estado } from '../../engine/tipos.ts'
import type { OpcionCarta } from './interaccion.ts'
import { cambiarVelocidad, duracion, useVelocidad, type Velocidad } from './preferencias.ts'
import { Icono, Numero } from './Zonas.tsx'
import type { IconoId } from '../cartas/marcado.ts'

const ICONO_REGISTRO: Partial<Record<EntradaRegistro['tipo'], IconoId>> = {
  revelar: 'robar',
  pagar: 'doblon',
  aviso: 'herida',
  fin: 'rep',
  robar: 'robar',
}

function Linea({ r }: { r: EntradaRegistro }) {
  const icono = ICONO_REGISTRO[r.tipo]
  return (
    <li className={`linea linea-${r.tipo}`}>
      {icono ? <Icono id={icono} /> : <span className="linea-punto" />}
      <span>{r.texto}</span>
    </li>
  )
}

/** Las líneas del registro desde tu última decisión. */
export function UltimoOcurrido({ s, desde }: { s: Estado; desde: number }) {
  const velocidad = useVelocidad()
  const nuevas = s.registro.slice(desde).filter((r) => r.tipo !== 'turno')
  const anteriores = nuevas.length === 0 ? s.registro.slice(-4).filter((r) => r.tipo !== 'turno') : []
  return (
    <section className="zona ultimo">
      <h2 className="rotulo">
        <span>Lo último que ha pasado</span>
      </h2>
      <ol className="lineas">
        <AnimatePresence initial={false}>
          {(nuevas.length > 0 ? nuevas.slice(-9) : anteriores).map((r, i) => (
            <motion.div
              key={`${desde}-${i}-${r.texto}`}
              initial={duracion(velocidad, 1) > 0 ? { opacity: 0, x: 12 } : false}
              animate={{ opacity: nuevas.length > 0 ? 1 : 0.55, x: 0 }}
              transition={{ duration: duracion(velocidad, 0.22), delay: duracion(velocidad, 0.04) * i }}
            >
              <Linea r={r} />
            </motion.div>
          ))}
        </AnimatePresence>
      </ol>
    </section>
  )
}

function Capa({ children, alCerrar, clase = '' }: { children: ReactNode; alCerrar: () => void; clase?: string }) {
  return (
    <div className={`capa ${clase}`} onClick={alCerrar}>
      <div className="capa-panel" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="cerrar" onClick={alCerrar} aria-label="Cerrar">
          ×
        </button>
        {children}
      </div>
    </div>
  )
}

/** Registro de partida completo, agrupado por turnos. */
export function Registro({ s, alCerrar }: { s: Estado; alCerrar: () => void }) {
  const fin = useRef<HTMLDivElement>(null)
  useEffect(() => fin.current?.scrollIntoView(), [])
  const turnos = new Map<number, EntradaRegistro[]>()
  for (const r of s.registro) turnos.set(r.turno, [...(turnos.get(r.turno) ?? []), r])
  return (
    <div className="cajon" role="dialog" aria-label="Registro de partida">
      <div className="cajon-cabecera">
        <h2>Registro de partida</h2>
        <button type="button" className="cerrar" onClick={alCerrar} aria-label="Cerrar">
          ×
        </button>
      </div>
      <div className="cajon-cuerpo">
        {[...turnos].map(([turno, lineas]) => (
          <section key={turno} className="registro-turno">
            <h3>{turno === 0 ? 'Preparación' : `Turno ${turno}`}</h3>
            <ol className="lineas">
              {lineas
                .filter((r) => r.tipo !== 'turno')
                .map((r, i) => (
                  <Linea key={i} r={r} />
                ))}
            </ol>
          </section>
        ))}
        <div ref={fin} />
      </div>
    </div>
  )
}

/** Referencia rápida del reglamento. */
export function Ayuda({ alCerrar }: { alCerrar: () => void }) {
  return (
    <Capa alCerrar={alCerrar} clase="ayuda">
      <h2>Referencia rápida</h2>
      <div className="ayuda-columnas">
        <section>
          <h3>Secuencia del turno</h3>
          <ol>
            <li>
              <b>Inicio:</b> revela una carta de Escenario y aplícala · prepara tus cartas · recarga la munición · efectos de «al empezar el turno».
            </li>
            <li>
              <b>Jugar cartas:</b> recluta, adquiere Mejoras, juega Eventos y despide, en cualquier orden · al terminar, descarta y repón el muelle.
            </li>
            <li>
              <b>Quedarte o zarpar:</b> dos opciones distintas del puerto, o una misión disponible.
            </li>
            <li>
              <b>Final:</b> descarta las cartas que quieras · roba hasta tu Mando (si el mazo del capitán se acaba, pierdes un día) · efectos de «al final de cada turno».
            </li>
          </ol>
        </section>
        <section>
          <h3>Resolver una Prueba</h3>
          <ol>
            <li>Compromete a tu tripulación (o a nadie) y añade cartas.</li>
            <li>Revela el Destino y aplícalo; si no comprometiste a nadie, también Sin oposición.</li>
            <li>Ventana de acción: capacidades y, si comprometiste a alguien, reforzar.</li>
            <li>Resuelve la Prueba.</li>
            <li>Gana el Avance del encuentro.</li>
          </ol>
        </section>
      </div>
      <section className="ayuda-mesa">
        <h3>En la mesa</h3>
        <ul>
          <li>Lo que puedes hacer ahora brilla en dorado. Pulsa la carta para hacerlo.</li>
          <li>Pasa el ratón por encima de una carta para verla en grande (en tableta, mantenla pulsada).</li>
          <li>«Deshacer» vuelve atrás la última decisión mientras no se haya revelado nada nuevo.</li>
        </ul>
      </section>
    </Capa>
  )
}

const VELOCIDADES: { id: Velocidad; nombre: string }[] = [
  { id: 'normal', nombre: 'Normal' },
  { id: 'rapida', nombre: 'Rápida' },
  { id: 'sin', nombre: 'Sin animaciones' },
]

export function Menu({ alCerrar, nuevaPartida, portada, galeria }: { alCerrar: () => void; nuevaPartida: () => void; portada: () => void; galeria: () => void }) {
  const velocidad = useVelocidad()
  return (
    <div className="menu-flotante" role="menu" onMouseLeave={alCerrar}>
      <div className="menu-seccion">
        <span className="menu-rotulo">Velocidad de animación</span>
        <div className="segmentado">
          {VELOCIDADES.map((v) => (
            <button key={v.id} type="button" className={v.id === velocidad ? 'activo' : ''} onClick={() => cambiarVelocidad(v.id)}>
              {v.nombre}
            </button>
          ))}
        </div>
      </div>
      <button type="button" className="menu-item" onClick={nuevaPartida}>
        Nueva partida
      </button>
      <button type="button" className="menu-item" onClick={galeria}>
        Galería de cartas
      </button>
      <button type="button" className="menu-item" onClick={portada}>
        Volver a la portada
      </button>
    </div>
  )
}

/** Menú de una carta que permite varias cosas. */
export function MenuCarta({ x, y, opciones, alElegir, alCerrar }: { x: number; y: number; opciones: OpcionCarta[]; alElegir: (o: OpcionCarta) => void; alCerrar: () => void }) {
  return (
    <div className="menu-carta-capa" onClick={alCerrar}>
      <div className="menu-carta" style={{ left: x, top: y }} onClick={(e) => e.stopPropagation()}>
        {opciones.map((o, i) => (
          <button key={i} type="button" onClick={() => alElegir(o)}>
            <span>{o.etiqueta}</span>
            {o.detalle && <small>{o.detalle}</small>}
          </button>
        ))}
      </div>
    </div>
  )
}

const RESULTADO_MISION = {
  superada: { titulo: 'Misión superada', clase: 'bien' },
  retirada: { titulo: 'Te retiras', clase: 'mal' },
  hundida: { titulo: 'El Barco se hunde', clase: 'mal' },
} as const

/** Panel con el resultado de una misión recién terminada (de las líneas del registro desde tu última decisión). */
export function FinDeMision({ s, desde, alCerrar }: { s: Estado; desde: number; alCerrar: () => void }) {
  const nuevas = s.registro.slice(desde)
  const i = nuevas.findIndex((r) => r.dato?.tipo === 'finMision')
  const fin = nuevas[i]?.dato
  if (i < 0 || fin?.tipo !== 'finMision') return null
  const r = RESULTADO_MISION[fin.resultado]
  const vuelta = nuevas.findIndex((x, j) => j > i && x.texto === 'Vuelves a puerto.')
  const lineas = nuevas.slice(i + 1, vuelta < 0 ? undefined : vuelta).filter((x) => x.tipo !== 'turno')
  return (
    <Capa alCerrar={alCerrar} clase={`fin-mision ${r.clase}`}>
      <div className="fin-mision-cuerpo">
        <div className="fin-mision-carta">
          <CartaEscalada entrada={porId(fin.mision)} escala={0.5} />
        </div>
        <div>
          <span className="fin-rotulo">{r.titulo}</span>
          <h2>{nombreDe(fin.mision)}</h2>
          <ol className="lineas">
            {lineas.map((x, k) => (
              <Linea key={k} r={x} />
            ))}
            {lineas.length === 0 && <li className="linea vacio">Sin recompensa: vuelves a puerto.</li>}
          </ol>
        </div>
      </div>
      <div className="capa-botones">
        <button type="button" className="boton principal" onClick={alCerrar}>
          Seguir
        </button>
      </div>
    </Capa>
  )
}

/** Pantalla final con el resumen de la partida. */
export function FinDePartida({ s, otra, portada }: { s: Estado; otra: () => void; portada: () => void }) {
  const r = resumenDePartida(s)
  const velocidad = useVelocidad()
  return (
    <div className="capa fin-partida">
      <motion.div className={`capa-panel ${r.gana ? 'victoria' : 'derrota'}`} initial={{ scale: 0.92, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ duration: duracion(velocidad, 0.35) }}>
        <span className="fin-rotulo">{r.gana ? '¡Victoria!' : 'Derrota'}</span>
        <h2>{r.motivo}</h2>
        <div className="resumen-cifras">
          <div>
            <Icono id="rep" />
            <Numero valor={r.reputacion} />
            <span>de {r.reputacionObjetivo} de reputación</span>
          </div>
          <div>
            <b>{r.turnos}</b>
            <span>{r.turnos === 1 ? 'turno' : 'turnos'}</span>
          </div>
          <div>
            <b>{r.misiones.superadas.length}</b>
            <span>misiones superadas</span>
          </div>
          <div>
            <b>
              {r.pruebas.superadas}/{r.pruebas.superadas + r.pruebas.falladas}
            </b>
            <span>Pruebas superadas</span>
          </div>
        </div>
        <div className="resumen-columnas">
          <section>
            <h3>Misiones</h3>
            <ul>
              {r.misiones.superadas.map((m, i) => (
                <li key={`s${i}`} className="bien">
                  {nombreDe(m)}
                </li>
              ))}
              {r.misiones.retiradas.map((m, i) => (
                <li key={`r${i}`} className="mal">
                  {nombreDe(m)} (te retiraste)
                </li>
              ))}
              {r.misiones.hundidas.map((m, i) => (
                <li key={`h${i}`} className="mal">
                  {nombreDe(m)} (hundido)
                </li>
              ))}
              {r.misiones.superadas.length + r.misiones.retiradas.length + r.misiones.hundidas.length === 0 && <li>Ninguna</li>}
            </ul>
          </section>
          <section>
            <h3>La tripulación</h3>
            <ul>
              <li>{r.reclutados} Tripulantes reclutados</li>
              <li>{r.adquiridas} Mejoras adquiridas</li>
              <li>{r.tripulantesPerdidos} Tripulantes perdidos</li>
              {r.rehenesPerdidos > 0 && <li>{r.rehenesPerdidos} rehenes perdidos</li>}
              <li>{r.hundimientos === 0 ? 'El Barco nunca se hundió' : `El Barco se hundió ${r.hundimientos} ${r.hundimientos === 1 ? 'vez' : 'veces'}`}</li>
            </ul>
          </section>
          <section>
            <h3>Las cartas que más usaste</h3>
            <ul>
              {r.masUsadas.map((c) => (
                <li key={c.carta}>
                  {c.nombre} <small>×{c.veces}</small>
                </li>
              ))}
            </ul>
          </section>
        </div>
        <div className="capa-botones">
          <button type="button" className="boton" onClick={portada}>
            Volver a la portada
          </button>
          <button type="button" className="boton principal" onClick={otra}>
            Jugar otra partida
          </button>
        </div>
      </motion.div>
    </div>
  )
}
