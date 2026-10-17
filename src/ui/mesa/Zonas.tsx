// Zonas de la mesa: barra superior, tripulación, Barco, puerto y muelle, mano y mazos.

import { motion } from 'motion/react'
import type { CSSProperties, ReactNode } from 'react'
import { nombreDe, porId } from '../../engine/catalogo.ts'
import { reputacionMinima } from '../../engine/capacidades/misiones.ts'
import { copia } from '../../engine/estado.ts'
import { mazoActivo } from '../../engine/peligros.ts'
import type { Estado, InstId, Zona } from '../../engine/tipos.ts'
import { espacioOcupado, plazasOcupadas, valor } from '../../engine/valores.ts'
import { vinculadas } from '../../engine/zonas.ts'
import { claseIcono } from '../cartas/TextoCarta.tsx'
import type { IconoId } from '../cartas/marcado.ts'
import { textoPlano } from '../textos/decisiones.ts'
import { INFO_ESTADO, type EstadoBarco, type EstadoTripulante } from '../../engine/infoEstados.ts'
import { PanelPrueba } from './ZonaMision.tsx'
import { CartaMesa } from './CartaMesa.tsx'
import { CartaDe, fichasDe, useMesa } from './contexto.tsx'
import { IZQ, anchoCentro, escalaPara } from './disposicion.ts'
import { DorsoEscalado, type TipoDorso } from './Dorso.tsx'
import { useLienzo } from './Lienzo.tsx'
import { duracion, useVelocidad } from './preferencias.ts'
import { useZoom } from './Zoom.tsx'

export function Icono({ id, className = '' }: { id: IconoId; className?: string }) {
  return <span className={`${claseIcono(id)} ${className}`} />
}

/** Un número que late al cambiar. */
export function Numero({ valor: v, className = '' }: { valor: number; className?: string }) {
  const velocidad = useVelocidad()
  return (
    <motion.b
      key={v}
      className={className}
      initial={duracion(velocidad, 1) > 0 ? { scale: 1.45, color: '#fff3c4' } : false}
      animate={{ scale: 1, color: 'var(--c-numero, inherit)' }}
      transition={{ duration: duracion(velocidad, 0.32) }}
    >
      {v}
    </motion.b>
  )
}

function Rotulo({ children, extra }: { children: ReactNode; extra?: ReactNode }) {
  return (
    <h2 className="rotulo">
      <span>{children}</span>
      {extra && <span className="rotulo-extra">{extra}</span>}
    </h2>
  )
}

// ---------------------------------------------------------------------------
// Barra superior

const PASOS = ['Inicio', 'Jugar cartas', 'Quedarte o zarpar', 'Final'] as const

function pasoActual(s: Estado): number {
  switch (s.paso) {
    case 'inicio':
      return 0
    case 'jugarCartas':
      return 1
    case 'quedarseOZarpar':
    case 'mision':
      return 2
    case 'final':
      return 3
    default:
      return -1
  }
}

export function BarraSuperior({ botones }: { botones: ReactNode }) {
  const { s } = useMesa()
  const zoom = useZoom()
  const paso = pasoActual(s)
  const escenario = s.zonas.escenarioEnCurso[0]
  const idEscenario = escenario ? copia(s, escenario).id : null
  const dias = s.zonas.mazoEscenario.length
  return (
    <header className="barra">
      <div className="barra-turno">
        <span className="turno">Turno {s.turno}</span>
        <ol className="pasos">
          {PASOS.map((p, i) => (
            <li key={p} className={i === paso ? 'actual' : i < paso ? 'hecho' : ''}>
              <span className="paso-num">{i + 1}</span>
              {p}
            </li>
          ))}
        </ol>
      </div>
      {s.mision && (
        <div className="barra-mision">
          <Icono id={entornoIcono(s, s.mision.carta)} /> <span className="barra-mision-nombre">{nombreDe(copia(s, s.mision.carta).id)}</span>
        </div>
      )}
      <div className="barra-derecha">
        <button
          type="button"
          className="reloj"
          title="Cada turno se revela una carta de Escenario; cuando no quedan, es tu último turno. Pulsa para ver la carta de este turno."
          onClick={(e) => idEscenario && zoom.mostrar(idEscenario, e.currentTarget, true)}
          onPointerLeave={() => zoom.ocultar()}
        >
          <Icono id="acampar" />
          <span className="reloj-n">{s.ultimoTurno ? 'Último turno' : `${dias} ${dias === 1 ? 'día' : 'días'}`}</span>
          {idEscenario && <span className="reloj-sub">· {nombreDe(idEscenario)}</span>}
        </button>
        <div className="reputacion" title={`Reputación: ganas al llegar a ${s.reputacionObjetivo}`}>
          <Icono id="rep" />
          <Numero valor={s.reputacion} />
          <span className="de">/ {s.reputacionObjetivo}</span>
        </div>
        {botones}
      </div>
    </header>
  )
}

function entornoIcono(s: Estado, mision: InstId): IconoId {
  const e = porId(copia(s, mision).id)
  return e.tipo === 'capitulo' ? e.carta.entorno : 'mar'
}

// ---------------------------------------------------------------------------
// Tripulación y Barco

function Marcas({ n, maximo, clase }: { n: number; maximo: number; clase: string }) {
  return (
    <span className={`marcas ${clase}`}>
      {Array.from({ length: maximo }, (_, i) => (
        <span key={i} className={i < n ? 'marca llena' : 'marca'} />
      ))}
    </span>
  )
}

/** Mejora (o Tesoro) en pequeño, bajo su portador: nombre, munición y si está agotada (y si se agotó ahora). */
function Chip({ inst }: { inst: InstId }) {
  const { s, inter, pulsar } = useMesa()
  const zoom = useZoom()
  const c = copia(s, inst)
  const e = porId(c.id)
  const opciones = inter.opciones.get(inst) ?? []
  const marca = inter.marcas.get(inst)
  const f = fichasDe(s, inst)
  const tesoro = e.tipo === 'tesoro'
  const ahora = c.agotada && (s.prueba?.agotadas.includes(inst) ?? false)
  return (
    <motion.button
      layoutId={inst}
      type="button"
      className={`chip${tesoro ? ' tesoro' : ''}${c.agotada ? ' agotada' : ''}${ahora ? ' ahora' : ''}${marca ? ` marca-${marca}` : ''}`}
      data-inst={inst}
      data-carta={c.id}
      onClick={(ev) => opciones.length > 0 && pulsar(inst, ev.currentTarget)}
      onPointerEnter={(ev) => ev.pointerType === 'mouse' && zoom.mostrar(c.id, ev.currentTarget)}
      onPointerLeave={(ev) => ev.pointerType === 'mouse' && zoom.ocultar()}
      onContextMenu={(ev) => {
        ev.preventDefault()
        zoom.mostrar(c.id, ev.currentTarget)
      }}
      title={[nombreDe(c.id), c.agotada ? (ahora ? 'agotada en esta Prueba' : 'agotada') : '', ...opciones.map((o) => o.etiqueta)].filter(Boolean).join(' · ')}
    >
      <Icono id={tesoro ? 'doblon' : 'mejora'} />
      <span className="chip-nombre">{nombreDe(c.id)}</span>
      {f.municion !== undefined && (
        <span className="chip-municion">
          <Icono id="municion" />
          {f.municion}
        </span>
      )}
      {c.agotada && <Icono id="agotar" className="chip-agotada" />}
    </motion.button>
  )
}

/** Fichas de Estado (y lo que dura «no se prepara», «no puede comprometerse»). */
export function FichasEstado({ estados, extra = [] }: { estados: readonly (EstadoTripulante | EstadoBarco)[]; extra?: { texto: string; ayuda: string }[] }) {
  if (estados.length === 0 && extra.length === 0) return null
  return (
    <div className="estados">
      {estados.map((e) => (
        <span key={e} className={`estado-ficha ${INFO_ESTADO[e].bueno ? 'bueno' : 'malo'}`} title={`${INFO_ESTADO[e].nombre}: ${INFO_ESTADO[e].texto}`}>
          {INFO_ESTADO[e].nombre}
        </span>
      ))}
      {extra.map((x) => (
        <span key={x.texto} className="estado-ficha aviso" title={x.ayuda}>
          {x.texto}
        </span>
      ))}
    </div>
  )
}

/** «No se prepara» y «no puede comprometerse» de un Tripulante, por las cartas de Peligro. */
function restricciones(s: Estado, inst: InstId): { texto: string; ayuda: string }[] {
  const lista: { texto: string; ayuda: string }[] = []
  for (const t of s.temporales) {
    if (t.inst !== inst) continue
    const de = t.carta && s.cartas[t.carta] ? ` («${nombreDe(copia(s, t.carta).id)}»)` : ''
    if (t.clave === 'noPrepara') lista.push({ texto: 'No se prepara', ayuda: `No se prepara${t.hasta === 'inicio' ? ' en tu próximo Inicio' : ''}${de}.` })
    if (t.clave === 'noCompromete') lista.push({ texto: 'No compromete', ayuda: `No puede comprometerse${de}.` })
  }
  return lista
}

/** Hueco fijo de un Tripulante: cabe la carta derecha y la carta girada, así nada se mueve al agotar o preparar. */
function Tripulante({ inst, escala, rehen }: { inst: InstId; escala: number; rehen?: boolean }) {
  const { s } = useMesa()
  const lado = 528 * escala
  const mejoras = vinculadas(s, inst)
  return (
    <div className={`tripulante${rehen ? ' rehen' : ''}`} style={{ width: lado }}>
      <div className="hueco" style={{ width: lado, height: lado }}>
        <CartaDe inst={inst} escala={escala} />
        <FichasEstado estados={copia(s, inst).estados ?? []} extra={restricciones(s, inst)} />
        {rehen && (
          <span className="rehen-marca">
            <Icono id="rehen" /> Rehén
          </span>
        )}
      </div>
      <div className="chips una-fila">
        {mejoras.map((m) => (
          <Chip key={m} inst={m} />
        ))}
      </div>
    </div>
  )
}

export function ZonaTripulacion() {
  const { s } = useMesa()
  const total = s.zonas.tripulacion.length + s.zonas.rehenes.length
  // Tres huecos por fila; si hay más de seis, se achican para que quepan tres filas.
  const porFila = 3
  const filas = Math.max(2, Math.ceil(total / porFila))
  const ladoPorAncho = Math.floor((IZQ - 30 - (porFila - 1) * 12) / porFila)
  const ladoPorAlto = (548 - 22 - 30 - (filas - 1) * 10) / filas - 28
  const escala = Math.min(ladoPorAncho, ladoPorAlto) / 528
  return (
    <section className="zona zona-tripulacion">
      <Rotulo extra={<span className="dato">Capacidad {plazasOcupadas(s)}/{valor(s, { tipo: 'capacidad' })} · el Capitán no cuenta</span>}>Tripulación</Rotulo>
      <div className="tripulacion">
        {s.zonas.tripulacion.map((c) => (
          <Tripulante key={c} inst={c} escala={escala} />
        ))}
        {s.zonas.rehenes.map((c) => (
          <Tripulante key={c} inst={c} escala={escala} rehen />
        ))}
      </div>
    </section>
  )
}

export function BloqueBarco() {
  const { s, inter, pulsar } = useMesa()
  const danoMax = valor(s, { tipo: 'danoMaximo' })
  const espacio = valor(s, { tipo: 'espacio' })
  const mejoras = vinculadas(s, 'barco')
  const opcionesBarco = inter.opciones.get('barco') ?? []
  return (
    <section className="zona zona-barco">
      <Rotulo>Tu Barco</Rotulo>
      <div className="barco">
        <CartaMesa
          inst="barco"
          id="barco"
          escala={0.2}
          marca={inter.marcas.get('barco') ?? null}
          {...(opcionesBarco.length > 0 ? { onClick: (el: HTMLElement) => pulsar('barco', el) } : {})}
        />
        <div className="barco-datos">
          <div className="dato-fila" title="El Barco se hunde cuando su daño llega al máximo.">
            <Icono id="dano" />
            <span>Daño</span>
            <Marcas n={s.danoBarco} maximo={danoMax} clase="dano" />
          </div>
          <div className="dato-fila" title="Lo que ocupan las Mejoras de barco.">
            <Icono id="espacio" />
            <span>Espacio</span>
            <Marcas n={espacioOcupado(s)} maximo={espacio} clase="espacio" />
          </div>
          <FichasEstado estados={s.estadosBarco ?? []} />
          <div className="chips">
            {mejoras.length === 0 && <span className="vacio">Sin Mejoras de barco</span>}
            {mejoras.map((m) => (
              <Chip key={m} inst={m} />
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

// ---------------------------------------------------------------------------
// Puerto

function Mision({ inst, escala }: { inst: InstId; escala: number }) {
  const { s } = useMesa()
  const id = copia(s, inst).id
  const distancia = valor(s, { tipo: 'distancia', mision: inst })
  const necesario = valor(s, { tipo: 'avanceNecesario', mision: inst })
  const minima = reputacionMinima(id)
  return (
    <div className="mision">
      <CartaDe inst={inst} escala={escala} />
      <div className="mision-datos">
        <span title="Avance que pide la misión">
          <Icono id="avance" /> {copia(s, inst).avance > 0 ? `${copia(s, inst).avance}/` : ''}
          {necesario}
        </span>
        {distancia > 0 && (
          <span title="Distancia: NAV que necesitas para zarpar">
            <Icono id="NAV" /> Distancia {distancia}
          </span>
        )}
        {minima > 0 && (
          <span className={s.reputacion < minima ? 'rojo' : ''} title="Reputación mínima para zarpar">
            <Icono id="rep" /> {minima}
          </span>
        )}
      </div>
    </div>
  )
}

export function ZonaPuerto() {
  const { s } = useMesa()
  const { ancho } = useLienzo()
  const centro = anchoCentro(ancho) - 26
  const n = s.zonas.muelle.length
  // Alto disponible para el muelle y las misiones, quitando rótulos, huecos y la fila de abajo (puerto y Escenario).
  const altoCartas = 548 - 24 - 3 * 24 - 2 * 12 - 104 - 22
  const escalaMuelle = Math.min(escalaPara(centro, Math.max(4, n), 378, 9, 0.2, 0.4), 0.33)
  const escalaMisiones = Math.min(escalaPara(centro, 3, 528, 14, 0.3, 0.5), (altoCartas - 528 * escalaMuelle) / 378)
  return (
    <section className="zona zona-puerto">
      <div className="bloque">
        <Rotulo extra={<span className="dato">Se repone al terminar Jugar cartas</span>}>Muelle</Rotulo>
        <div className="fila-cartas muelle">
          {s.zonas.muelle.map((c) =>
            s.peligrosEnMuelle?.[c] !== undefined ? (
              <div key={c} className="peligro-muelle">
                <CartaDe inst={c} escala={escalaMuelle} />
                <span className="peligro-muelle-nota" title={`Ocupa el muelle. En Jugar cartas puedes pagar ${s.peligrosEnMuelle[c]} cartas para descartarla.`}>
                  Ocupa el muelle · paga {s.peligrosEnMuelle[c]}
                </span>
              </div>
            ) : (
              <CartaDe key={c} inst={c} escala={escalaMuelle} />
            ),
          )}
          {n === 0 && <span className="vacio">El muelle está vacío</span>}
        </div>
      </div>
      {s.prueba ? (
        // Una Prueba en puerto (la Acción de una carta): ocupa el sitio de las misiones mientras dura.
        <div className="bloque prueba-en-puerto">
          <PanelPrueba decision={s.pendiente} sel={null} ancho={Math.min(560, centro)} />
        </div>
      ) : (
        <div className="bloque">
          <Rotulo extra={<span className="dato">{s.zonas.mazoMisiones.length} en el mazo de Misiones</span>}>Misiones disponibles</Rotulo>
          <div className="fila-cartas misiones">
            {s.zonas.misionesDisponibles.map((m) => (
              <Mision key={m} inst={m} escala={escalaMisiones} />
            ))}
          </div>
        </div>
      )}
      {!s.prueba && (
        <div className="puerto-abajo">
          <div className="bloque">
            <Rotulo>Puerto</Rotulo>
            <CartaMesa inst="puerto" id={s.puerto} escala={0.2} />
          </div>
          <EsteTurno />
        </div>
      )}
    </section>
  )
}

/** La carta de Escenario del turno y lo que hace, para tenerla presente mientras juegas. */
function EsteTurno() {
  const { s } = useMesa()
  const escenario = s.zonas.escenarioEnCurso[0]
  if (!escenario) {
    return (
      <div className="este-turno">
        <span className="vacio">{s.ultimoTurno ? 'No quedan cartas de Escenario: este es tu último turno.' : 'Sin carta de Escenario este turno.'}</span>
      </div>
    )
  }
  const id = copia(s, escenario).id
  return (
    <div className="este-turno">
      <CartaDe inst={escenario} escala={0.16} revelar="escenario" />
      <div className="este-turno-texto">
        <span className="rotulo-pequeno">Este turno</span>
        <span className="este-turno-nombre">{nombreDe(id)}</span>
        <span className="este-turno-efecto">{textoPlano(id)}</span>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Mano

export function Mano() {
  const { s } = useMesa()
  const mano = s.zonas.mano
  const n = mano.length
  const separacion = n <= 6 ? 128 : Math.max(70, 760 / n)
  return (
    <section className="mano" aria-label="Tu mano">
      {mano.map((c, i) => {
        const desvio = i - (n - 1) / 2
        return (
          <div key={c} className="mano-carta" style={{ '--x': `${desvio * separacion}px`, '--giro': `${desvio * 2.2}deg`, '--caida': `${Math.abs(desvio) * 5}px`, zIndex: i } as CSSProperties}>
            <CartaDe inst={c} escala={0.4} />
          </div>
        )
      })}
      {n === 0 && <div className="mano-vacia">Tu mano está vacía</div>}
    </section>
  )
}

// ---------------------------------------------------------------------------
// Mazos y descartes

/** Copias de arriba de un mazo, invisibles, para que las cartas «salgan» de él al robarse o revelarse. */
function Origenes({ s, zona, escala }: { s: Estado; zona: Zona; escala: number }) {
  return (
    <>
      {s.zonas[zona].slice(0, 4).map((c) => (
        <motion.div key={c} layoutId={c} className="origen" style={{ width: 378 * escala, height: 528 * escala }} />
      ))}
    </>
  )
}

const ESCALA_PILA = 0.13

function Pila({ zona, descartes, dorso, nombre }: { zona: Zona; descartes?: Zona; dorso: TipoDorso; nombre: string }) {
  const { s } = useMesa()
  const arriba = descartes ? s.zonas[descartes][0] : undefined
  const hueco = <div className="pila-vacia" style={{ width: 378 * ESCALA_PILA, height: 528 * ESCALA_PILA }} />
  return (
    <div className="pila">
      <div className="pila-mazo" title={`${nombre}: ${s.zonas[zona].length} cartas`}>
        <div className="pila-cartas">
          {s.zonas[zona].length > 0 ? <DorsoEscalado tipo={dorso} escala={ESCALA_PILA} /> : hueco}
          <Origenes s={s} zona={zona} escala={ESCALA_PILA} />
        </div>
        <span className="pila-n">{s.zonas[zona].length}</span>
      </div>
      {descartes && (
        <div className="pila-mazo" title={`Descartes: ${s.zonas[descartes].length} cartas`}>
          <div className="pila-cartas">{arriba ? <CartaMesa inst={arriba} id={copia(s, arriba).id} escala={ESCALA_PILA} /> : hueco}</div>
          <span className="pila-n">{s.zonas[descartes].length}</span>
        </div>
      )}
      <span className="pila-nombre">{nombre}</span>
    </div>
  )
}

export function Mazos() {
  const { s } = useMesa()
  const peligros = mazoActivo(s)
  return (
    <section className="zona mazos">
      <Pila zona={peligros.mazo} descartes={peligros.descartes} dorso="peligros" nombre={peligros.mazo === 'mazoMision' ? 'Mazo de la misión' : 'Peligros'} />
      <Pila zona="mazoCapitan" descartes="descartesCapitan" dorso="capitan" nombre="Mazo del capitán" />
      <Pila zona="mazoMuelle" descartes="descartesMuelle" dorso="muelle" nombre="Mazo de muelle" />
      <Pila zona="mazoEscenario" dorso="escenario" nombre="Escenario" />
    </section>
  )
}
