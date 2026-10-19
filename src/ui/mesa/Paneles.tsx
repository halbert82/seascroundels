// Paneles de la mesa: lo último que ha pasado, registro, ayuda, menú, menú de carta, fin de misión y fin de partida.

import { AnimatePresence, motion } from 'motion/react'
import { LIBROS } from '../reglamento.ts'
import { useEffect, useRef, type ReactNode } from 'react'
import { esCarta, nombreDe, porId, tipoDe } from '../../engine/catalogo.ts'
import { partesDeRecompensa } from '../textos/decisiones.ts'
import { CartaEscalada } from '../cartas/Carta.tsx'
import { resumenDePartida } from '../../engine/resumen.ts'
import type { Eleccion, EntradaRegistro, Estado } from '../../engine/tipos.ts'
import type { OpcionCarta } from './interaccion.ts'
import { cambiarVelocidad, duracion, useVelocidad, type Velocidad } from './preferencias.ts'
import { Icono, Numero } from './Zonas.tsx'
import type { IconoId } from '../cartas/marcado.ts'
import { glosarioCompleto } from '../textos/glosario.ts'
import { Explicable } from './Explicacion.tsx'

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
  const anteriores = nuevas.length === 0 ? s.registro.filter((r) => r.tipo !== 'turno').slice(-3) : []
  return (
    <section className="zona ultimo">
      <h2 className="rotulo">
        <span>Lo último que ha pasado</span>
      </h2>
      <ol className="lineas">
        <AnimatePresence initial={false}>
          {(nuevas.length > 0 ? nuevas.slice(-5) : anteriores).map((r, i) => (
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
      {nuevas.length > 5 && <span className="mas-en-registro">y {nuevas.length - 5} más en el registro</span>}
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
  const cuerpo = useRef<HTMLDivElement>(null)
  // Abre por el final. Solo baja el propio registro: «scrollIntoView» desplazaba también la mesa entera (y la barra
  // superior se salía de la pantalla) y en los navegadores nuevos devuelve una promesa que React no admite.
  useEffect(() => {
    const el = cuerpo.current
    if (el) el.scrollTop = el.scrollHeight
  }, [])
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
      <div className="cajon-cuerpo" ref={cuerpo}>
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
      </div>
    </div>
  )
}

/** El glosario en tres columnas: los grupos cortos repartidos en dos y las palabras de las cartas en la tercera. */
function columnasGlosario(): ReturnType<typeof glosarioCompleto>[] {
  const grupos = glosarioCompleto()
  const cortos = grupos.filter((g) => g.ayudas.length <= 10)
  return [cortos.filter((_, i) => i % 2 === 0), cortos.filter((_, i) => i % 2 === 1), grupos.filter((g) => g.ayudas.length > 10)]
}

/** Referencia rápida del reglamento. */
export function Ayuda({ alCerrar }: { alCerrar: () => void }) {
  return (
    <Capa alCerrar={alCerrar} clase="ayuda">
      <h2>Referencia rápida</h2>
      <nav className="ayuda-libros" aria-label="Reglamento">
        <span>El reglamento completo:</span>
        {LIBROS.map((l) => (
          <span key={l.nombre} className="ayuda-libro">
            <a href={l.web} target="_blank" rel="noreferrer">
              {l.nombre}
            </a>
            <a className="pdf" href={l.pdf} download>
              PDF
            </a>
          </span>
        ))}
      </nav>
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
            <li>Compromete a tu tripulación (o a nadie) y añade cartas de tu mano: es tu única ocasión.</li>
            <li>Revela el Destino y aplícalo; si no comprometiste a nadie, también Sin oposición.</li>
            <li>Ventana de acción: capacidades de tus cartas en juego y Eventos con su momento.</li>
            <li>Resuelve la Prueba.</li>
            <li>Gana el Avance del encuentro.</li>
          </ol>
        </section>
      </div>
      <section className="ayuda-mesa">
        <h3>En la mesa</h3>
        <ul>
          <li>Lo que puedes hacer ahora brilla en dorado. Pulsa la carta para hacerlo.</li>
          <li>Pasa el ratón por encima de una carta para verla en grande, junto a ella y con sus reglas explicadas al lado (en tableta, tócala).</li>
          <li>Pasa el ratón por encima de una ficha (un Estado, una Ventaja, una ficha de misión…) o púlsala para ver qué hace y cómo se quita.</li>
          <li>«Deshacer» vuelve atrás la última decisión mientras no se haya revelado nada nuevo.</li>
        </ul>
      </section>
      <section className="ayuda-glosario">
        <h3>Fichas y palabras de las cartas</h3>
        <p className="ayuda-glosario-nota">Pasa el ratón por encima o pulsa cualquiera para leer su explicación completa.</p>
        <div className="glosario-grupos">
          {columnasGlosario().map((columna, i) => (
            <div key={i} className="glosario-columna">
              {columna.map((g) => (
                <div key={g.titulo} className="glosario-grupo">
                  <span className="glosario-titulo">{g.titulo}</span>
                  <div className="glosario-fichas">
                    {g.ayudas.map((a) => (
                      <Explicable key={a.clave} ayuda={a} className={`glosario-ficha clase-${a.clase}`}>
                        {a.nombre}
                      </Explicable>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
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

/** Cifras de una misión, del registro entre el zarpe y su final. */
function cifrasDeMision(s: Estado, fin: number) {
  let inicio = fin
  while (inicio > 0 && s.registro[inicio]?.dato?.tipo !== 'zarpar') inicio--
  const cifras = { heridas: 0, dano: 0, cartas: 0 }
  for (const r of s.registro.slice(inicio, fin)) {
    const d = r.dato
    if (d?.tipo === 'heridas') cifras.heridas += d.n
    else if (d?.tipo === 'dano') cifras.dano += d.n
    else if (d?.tipo === 'pago') cifras.cartas += d.n
    else if (d?.tipo === 'iconos') cifras.cartas += d.cartas.length
    // (Las Acciones de las fichas de Estado, «estado:encadenado», no son cartas.)
    else if (d?.tipo === 'usar' && esCarta(d.carta) && tipoDe(d.carta) === 'evento') cifras.cartas += 1
  }
  return cifras
}

function frase(partes: string[]): string {
  if (partes.length <= 1) return partes[0] ?? ''
  return `${partes.slice(0, -1).join(', ')} y ${partes[partes.length - 1]}`
}

/** Panel con el resultado de una misión recién terminada: recompensa completa y resumen de la misión. */
export function FinDeMision({ s, desde, alCerrar, elegir }: { s: Estado; desde: number; alCerrar: () => void; elegir: (e: Eleccion) => void }) {
  const i = s.registro.findIndex((r, k) => k >= desde && r.dato?.tipo === 'finMision')
  const fin = s.registro[i]?.dato
  if (i < 0 || fin?.tipo !== 'finMision') return null
  const r = fin.motivo ? { titulo: 'La misión falla', clase: 'mal' } : RESULTADO_MISION[fin.resultado]
  const cifras = cifrasDeMision(s, i)
  const d = s.pendiente
  const pendiente = d?.motivo.clave
  const eliges = pendiente === 'buscar' || pendiente === 'portadorTesoro'
  // Final con elección: se elige aquí mismo.
  const finales = d?.tipo === 'elegirOpcion' && pendiente === 'finalMision' ? d.opciones : []
  const despues = s.registro.slice(i)
  const salida = despues.find((x) => x.texto.endsWith('se baraja en el mazo de Misiones.'))
  const nombreSalida = salida ? /«(.+)»/.exec(salida.texto)?.[1] : undefined
  const capituloSalida = nombreSalida ? (porId(fin.mision).tipo === 'capitulo' ? (porId(fin.mision) as Extract<ReturnType<typeof porId>, { tipo: 'capitulo' }>).mision.capitulos.find((c) => c.nombre === nombreSalida) : undefined) : undefined
  const como = {
    gesta: despues.some((x) => x.dato?.tipo === 'gesta'),
    sinTesoro: despues.some((x) => x.texto.startsWith('No ganas el Tesoro')),
    ...(capituloSalida ? { siguiente: capituloSalida.num } : {}),
  }
  const recompensa = fin.resultado === 'superada' ? frase(partesDeRecompensa(fin.mision, como)) : ''
  return (
    <Capa alCerrar={alCerrar} clase={`fin-mision ${r.clase}`}>
      <div className="fin-mision-cuerpo">
        <div className="fin-mision-carta">
          <CartaEscalada entrada={porId(fin.mision)} escala={0.5} />
        </div>
        <div className="fin-mision-texto">
          <span className="fin-rotulo">{r.titulo}</span>
          <h2>{nombreDe(fin.mision)}</h2>
          {fin.resultado === 'superada' ? (
            <p className="fin-recompensa">
              <b>Recompensa:</b> {recompensa}
              {eliges && <em> Lo eliges al pulsar «Seguir».</em>}
            </p>
          ) : (
            <p className="fin-recompensa mal">
              {fin.motivo ? `${fin.motivo.charAt(0).toUpperCase()}${fin.motivo.slice(1)}. ` : ''}Sin recompensa: pierdes el Avance de la misión y vuelves a puerto.
            </p>
          )}
          {finales.length > 0 && (
            <div className="fin-elige">
              <span className="fin-elige-rotulo">Elige el final</span>
              {finales.map((o) => (
                <button key={o.clave} type="button" className="boton opcion-final" onClick={() => elegir({ tipo: 'opcion', clave: o.clave })}>
                  {o.texto}
                </button>
              ))}
            </div>
          )}
          <dl className="fin-cifras">
            <div>
              <dt>Avance</dt>
              <dd>
                {fin.avance ?? 0}
                <small>/{fin.necesario ?? '?'}</small>
              </dd>
            </div>
            <div>
              <dt>Peligros resueltos</dt>
              <dd>{fin.resueltas ?? 0}</dd>
            </div>
            <div>
              <dt>Heridas</dt>
              <dd>{cifras.heridas}</dd>
            </div>
            <div>
              <dt>Daño al Barco</dt>
              <dd>{cifras.dano}</dd>
            </div>
            <div>
              <dt>Cartas gastadas</dt>
              <dd>{cifras.cartas}</dd>
            </div>
          </dl>
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
