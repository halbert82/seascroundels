// Zonas de la mesa: barra superior, Barco y tripulación, puerto y muelle, misión, mano y mazos.

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
import { CartaMesa } from './CartaMesa.tsx'
import { CartaDe, fichasDe, useMesa } from './contexto.tsx'
import { DorsoEscalado, type TipoDorso } from './Dorso.tsx'
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
  const paso = pasoActual(s)
  const escenario = s.zonas.escenarioEnCurso[0]
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
          <Icono id={entornoIcono(s, s.mision.carta)} /> {nombreDe(copia(s, s.mision.carta).id)}
        </div>
      )}
      <div className="barra-derecha">
        <div className="reloj" title="Cada turno se revela una carta de Escenario. Cuando no quedan, es tu último turno.">
          {escenario && <CartaDe inst={escenario} escala={0.1} revelar="escenario" />}
          <div className="reloj-texto">
            <span className="reloj-n">{s.ultimoTurno ? 'Último turno' : `${dias} ${dias === 1 ? 'día' : 'días'}`}</span>
            <span className="reloj-sub">{escenario ? nombreDe(copia(s, escenario).id) : 'Escenario'}</span>
          </div>
        </div>
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
// Barco y tripulación

function Marcas({ n, maximo, clase }: { n: number; maximo: number; clase: string }) {
  return (
    <span className={`marcas ${clase}`}>
      {Array.from({ length: maximo }, (_, i) => (
        <span key={i} className={i < n ? 'marca llena' : 'marca'} />
      ))}
    </span>
  )
}

/** Mejora (o Tesoro) en pequeño, bajo su portador: nombre, munición y si está agotada. */
function Chip({ inst }: { inst: InstId }) {
  const { s, inter, pulsar } = useMesa()
  const zoom = useZoom()
  const c = copia(s, inst)
  const e = porId(c.id)
  const opciones = inter.opciones.get(inst) ?? []
  const marca = inter.marcas.get(inst)
  const f = fichasDe(s, inst)
  const tesoro = e.tipo === 'tesoro'
  return (
    <motion.button
      layoutId={inst}
      type="button"
      className={`chip${tesoro ? ' tesoro' : ''}${c.agotada ? ' agotada' : ''}${marca ? ` marca-${marca}` : ''}`}
      data-inst={inst}
      data-carta={c.id}
      onClick={(ev) => opciones.length > 0 && pulsar(inst, ev.currentTarget)}
      onPointerEnter={(ev) => ev.pointerType === 'mouse' && zoom.mostrar(c.id, ev.currentTarget)}
      onPointerLeave={(ev) => ev.pointerType === 'mouse' && zoom.ocultar()}
      onContextMenu={(ev) => {
        ev.preventDefault()
        zoom.mostrar(c.id, ev.currentTarget)
      }}
      title={opciones.map((o) => o.etiqueta).join(' · ') || undefined}
    >
      <Icono id={tesoro ? 'doblon' : 'mejora'} />
      <span className="chip-nombre">{nombreDe(c.id)}</span>
      {f.municion !== undefined && (
        <span className="chip-municion">
          <Icono id="municion" />
          {f.municion}
        </span>
      )}
      {c.agotada && <span className="chip-estado">agotada</span>}
    </motion.button>
  )
}

function Tripulante({ inst, escala }: { inst: InstId; escala: number }) {
  const { s } = useMesa()
  const mejoras = vinculadas(s, inst)
  return (
    <div className="tripulante">
      <CartaDe inst={inst} escala={escala} />
      {mejoras.length > 0 && (
        <div className="chips">
          {mejoras.map((m) => (
            <Chip key={m} inst={m} />
          ))}
        </div>
      )}
    </div>
  )
}

export function ZonaBarco() {
  const { s, inter, pulsar } = useMesa()
  const danoMax = valor(s, { tipo: 'danoMaximo' })
  const espacio = valor(s, { tipo: 'espacio' })
  const capacidad = valor(s, { tipo: 'capacidad' })
  const mejoras = vinculadas(s, 'barco')
  const tripulacion = s.zonas.tripulacion
  const muchos = tripulacion.length > 4
  const opcionesBarco = inter.opciones.get('barco') ?? []
  return (
    <section className="zona zona-barco">
      <Rotulo extra={<span className="dato">Capacidad {plazasOcupadas(s)}/{capacidad}</span>}>Tu Barco</Rotulo>
      <div className="barco">
        <CartaMesa
          inst="barco"
          id="barco"
          escala={0.27}
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
          <div className="chips">
            {mejoras.length === 0 && <span className="vacio">Sin Mejoras de barco</span>}
            {mejoras.map((m) => (
              <Chip key={m} inst={m} />
            ))}
          </div>
        </div>
      </div>
      <Rotulo extra={s.zonas.rehenes.length > 0 ? <span className="dato rojo">{s.zonas.rehenes.length} rehén</span> : undefined}>Tripulación</Rotulo>
      <div className={`tripulacion${muchos ? ' apretada' : ''}`}>
        {tripulacion.map((c) => (
          <Tripulante key={c} inst={c} escala={muchos ? 0.24 : 0.27} />
        ))}
        {s.zonas.rehenes.map((c) => (
          <div key={c} className="tripulante rehen" title="Rehén: lo rescatas si superas la misión.">
            <CartaDe inst={c} escala={0.2} />
            <span className="rehen-marca">
              <Icono id="rehen" /> Rehén
            </span>
          </div>
        ))}
      </div>
    </section>
  )
}

// ---------------------------------------------------------------------------
// Puerto

function Mision({ inst }: { inst: InstId }) {
  const { s } = useMesa()
  const id = copia(s, inst).id
  const distancia = valor(s, { tipo: 'distancia', mision: inst })
  const necesario = valor(s, { tipo: 'avanceNecesario', mision: inst })
  const minima = reputacionMinima(id)
  return (
    <div className="mision">
      <CartaDe inst={inst} escala={0.4} />
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
  const n = s.zonas.muelle.length
  // El muelle ocupa unos 510 px: las cartas se achican si hay más de cuatro.
  const escalaMuelle = n <= 4 ? 0.32 : Math.max(0.2, (510 - (n - 1) * 9) / n / 378)
  return (
    <section className="zona zona-puerto">
      <div className="puerto-fila">
        <div className="bloque crece">
          <Rotulo extra={<span className="dato">Se repone al terminar Jugar cartas</span>}>Muelle</Rotulo>
          <div className="fila-cartas muelle">
            {s.zonas.muelle.map((c) => (
              <CartaDe key={c} inst={c} escala={escalaMuelle} />
            ))}
            {n === 0 && <span className="vacio">El muelle está vacío</span>}
          </div>
        </div>
        <div className="bloque">
          <Rotulo>Puerto</Rotulo>
          <CartaMesa inst="puerto" id={s.puerto} escala={0.3} />
        </div>
      </div>
      <div className="bloque">
        <Rotulo extra={<span className="dato">{s.zonas.mazoMisiones.length} en el mazo de Misiones</span>}>Misiones disponibles</Rotulo>
        <div className="fila-cartas misiones">
          {s.zonas.misionesDisponibles.map((m) => (
            <Mision key={m} inst={m} />
          ))}
        </div>
      </div>
      <EsteTurno />
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
      <CartaMesa inst={`este-turno-${escenario}`} sinVuelo id={id} escala={0.2} />
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

function Pila({ zona, descartes, dorso, nombre }: { zona: Zona; descartes: Zona; dorso: TipoDorso; nombre: string }) {
  const { s } = useMesa()
  const escala = 0.15
  const arriba = s.zonas[descartes][0]
  return (
    <div className="pila">
      <div className="pila-mazo">
        <div className="pila-cartas" title={`${nombre}: ${s.zonas[zona].length} cartas`}>
          {s.zonas[zona].length > 0 ? <DorsoEscalado tipo={dorso} escala={escala} /> : <div className="pila-vacia" style={{ width: 378 * escala, height: 528 * escala }} />}
          <Origenes s={s} zona={zona} escala={escala} />
        </div>
        <span className="pila-n">{s.zonas[zona].length}</span>
      </div>
      <div className="pila-mazo">
        <div className="pila-cartas" title={`Descartes: ${s.zonas[descartes].length} cartas`}>
          {arriba ? <CartaMesa inst={arriba} id={copia(s, arriba).id} escala={escala} /> : <div className="pila-vacia" style={{ width: 378 * escala, height: 528 * escala }} />}
        </div>
        <span className="pila-n">{s.zonas[descartes].length}</span>
      </div>
      <span className="pila-nombre">{nombre}</span>
    </div>
  )
}

export function Mazos() {
  const { s } = useMesa()
  const peligros = mazoActivo(s)
  return (
    <section className="zona mazos">
      <Rotulo>Mazos</Rotulo>
      <Pila zona={peligros.mazo} descartes={peligros.descartes} dorso="peligros" nombre={peligros.mazo === 'mazoMision' ? 'Mazo de la misión' : 'Peligros'} />
      <Pila zona="mazoCapitan" descartes="descartesCapitan" dorso="capitan" nombre="Mazo del capitán" />
      <Pila zona="mazoMuelle" descartes="descartesMuelle" dorso="muelle" nombre="Mazo de muelle" />
      <div className="pila pila-escenario">
        <div className="pila-mazo">
          <div className="pila-cartas">
            {s.zonas.mazoEscenario.length > 0 ? <DorsoEscalado tipo="escenario" escala={0.15} /> : <div className="pila-vacia" style={{ width: 57, height: 79 }} />}
            <Origenes s={s} zona="mazoEscenario" escala={0.15} />
          </div>
          <span className="pila-n">{s.zonas.mazoEscenario.length}</span>
        </div>
        <span className="pila-nombre">Escenario</span>
      </div>
    </section>
  )
}
