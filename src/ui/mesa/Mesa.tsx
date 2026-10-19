// La mesa de juego: junta las zonas, el panel de decisión, la mano y los paneles, y responde al motor.

import { LayoutGroup } from 'motion/react'
import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { jugadorConCriterio } from '../../engine/pruebas/jugadores.ts'
import { textoUso } from '../textos/decisiones.ts'
import type { Decision, Estado } from '../../engine/tipos.ts'
import { Contexto } from './contexto.tsx'
import { claveDecision, interaccion, seleccionVacia, type Interaccion, type Objetivo, type OpcionCarta, type Seleccion } from './interaccion.ts'
import { enLienzo } from './disposicion.ts'
import { Lienzo, useLienzo } from './Lienzo.tsx'
import { PanelDecision } from './PanelDecision.tsx'
import { Ayuda, FinDeMision, FinDePartida, Menu, MenuCarta, Registro, UltimoOcurrido } from './Paneles.tsx'
import { useVelocidad } from './preferencias.ts'
import { usePartida, type PartidaEnMesa } from './usePartida.ts'
import { CapaZoom, ProveedorZoom, useZoom } from './Zoom.tsx'
import { CapaExplicacion, ProveedorExplicacion } from './Explicacion.tsx'
import { ALTO_ZONAS, ARRIBA, DER, HUECO, IZQ, MARGEN, anchoCentro, repartirAltoDeMas } from './disposicion.ts'
import { BarraSuperior, BloqueBarco, Mano, Mazos, ZonaPuerto, ZonaTripulacion } from './Zonas.tsx'
import { ZonaMision } from './ZonaMision.tsx'
import './mesa.css'

const VACIA: Interaccion = { marcas: new Map(), opciones: new Map(), numeros: new Map(), apartadas: [] }

interface Props {
  inicial: () => PartidaEnMesa
  guardar: boolean
  irA: (ruta: string) => void
  /** Una partida nueva; la mesa pide la misma clase de partida que la que se está jugando. */
  nueva: (op?: { sinEscenario?: boolean }) => PartidaEnMesa
}

export function Mesa(props: Props) {
  return (
    <Lienzo>
      <ProveedorZoom>
        <MesaEnLienzo {...props} />
      </ProveedorZoom>
    </Lienzo>
  )
}

function MesaEnLienzo({ inicial, guardar, irA, nueva }: Props) {
  const { ancho, alto } = useLienzo()
  const juego = usePartida(inicial, guardar)
  const s = juego.estado
  const d = s.pendiente
  const velocidad = useVelocidad()
  const zoom = useZoom()
  const [sel, setSel] = useState<Seleccion | null>(null)
  const [menuCarta, setMenuCarta] = useState<{ x: number; y: number; opciones: OpcionCarta[] } | null>(null)
  const [panel, setPanel] = useState<'registro' | 'ayuda' | 'menu' | null>(null)
  const [finVisto, setFinVisto] = useState<number>(-1)

  // Para las pruebas de la interfaz (con «?pruebas» en la dirección): qué jugaría el jugador automático.
  const estadoActual = useRef(s)
  estadoActual.current = s
  const jugadas = useRef(0)
  jugadas.current = juego.partida.jugadas ?? 0
  useEffect(() => {
    if (!new URLSearchParams(window.location.search).has('pruebas')) return
    const bot = jugadorConCriterio()
    Object.assign(window, {
      __mesa: {
        estado: () => estadoActual.current,
        jugadas: () => jugadas.current,
        sugerencia: () => (estadoActual.current.pendiente ? bot(estadoActual.current, estadoActual.current.pendiente) : null),
        etiquetaUso: (uso: Parameters<typeof textoUso>[1]) => textoUso(estadoActual.current, uso).carta,
      },
    })
  }, [])

  const actual = d && sel?.de === claveDecision(d) ? sel : d ? seleccionVacia(d) : null
  const inter = useMemo(() => (d && actual ? interaccion(s, d, actual) : VACIA), [s, d, actual])

  const ejecutar = (o: OpcionCarta) => {
    setMenuCarta(null)
    if (o.eleccion) {
      setSel(null)
      juego.elegir(o.eleccion)
    } else if (o.seleccion) setSel(o.seleccion)
  }

  const pulsar = (objetivo: Objetivo, elemento: HTMLElement, opcion?: number) => {
    const opciones = inter.opciones.get(objetivo) ?? []
    const elegida = opcion !== undefined ? opciones[opcion] : undefined
    if (elegida) return ejecutar(elegida)
    const unica = opciones[0]
    if (opciones.length === 1 && unica) return ejecutar(unica)
    if (opciones.length === 0) return
    // El menú sale junto a la carta: la ampliación se quita para no taparlo.
    zoom.ocultar()
    const p = enLienzo(elemento)
    setMenuCarta({ x: Math.min(p.anchoLienzo - 280, Math.max(10, p.x + p.ancho / 2 - 130)), y: Math.max(70, Math.min(p.altoLienzo - 220, p.y - 20)), opciones })
  }

  const elegir = (e: Parameters<typeof juego.elegir>[0]) => {
    setSel(null)
    juego.elegir(e)
  }

  const hayFinMision = s.registro.slice(juego.partida.desde).some((r) => r.dato?.tipo === 'finMision') && finVisto !== juego.partida.desde

  const nuevaPartida = () => {
    if (!s.resultado && !window.confirm('¿Empezar una partida nueva? Se perderá la que estás jugando.')) return
    setPanel(null)
    juego.reiniciar(nueva({ sinEscenario: Boolean(s.sinEscenario) }))
  }

  const botones = (
    <div className="barra-botones">
      <button type="button" className="icono-boton" onClick={juego.deshacer} disabled={!juego.puedeDeshacer} title="Deshacer la última decisión">
        ↶<span>Deshacer</span>
      </button>
      <button type="button" className="icono-boton" onClick={() => setPanel(panel === 'registro' ? null : 'registro')} title="Registro de partida">
        ☰<span>Registro</span>
      </button>
      <button type="button" className="icono-boton redondo" onClick={() => setPanel('ayuda')} title="Ayuda: secuencia del turno y de una Prueba">
        ?
      </button>
      <button type="button" className="icono-boton" onClick={() => setPanel(panel === 'menu' ? null : 'menu')} title="Menú">
        ⚙<span>Menú</span>
      </button>
    </div>
  )

  // Si la mesa crece de alto (en una pantalla más cuadrada, como una tableta), la altura de más va primero a la mano,
  // para que sus cartas se vean enteras, y lo que sobre, a las zonas de arriba; el panel va justo debajo de ellas.
  const extra = repartirAltoDeMas(alto)
  const zona = { top: ARRIBA, height: ALTO_ZONAS + extra.zonas }
  return (
    <ProveedorExplicacion>
      <Contexto.Provider value={{ s, inter, pulsar }}>
        <LayoutGroup>
          <div className={`mesa vel-${velocidad}`} style={{ width: ancho, height: alto, '--extra-zonas': `${extra.zonas}px`, '--extra-mano': `${extra.mano}px` } as CSSProperties}>
            <BarraSuperior botones={botones} />
            <div className="col-izq" style={{ ...zona, left: MARGEN, width: IZQ }}>
              <ZonaTripulacion />
            </div>
            <main className="centro" style={{ ...zona, left: MARGEN + IZQ + HUECO, width: anchoCentro(ancho) }}>
              {s.mision ? <ZonaMision desde={juego.partida.desde} decision={d} sel={actual} /> : <ZonaPuerto />}
            </main>
            <aside className="col-der" style={{ ...zona, right: MARGEN, width: DER }}>
              <UltimoOcurrido s={s} desde={juego.partida.desde} />
              <BloqueBarco />
              <Mazos />
            </aside>
            {d && actual && <PanelDecision decision={d} sel={actual} setSel={setSel} elegir={elegir} />}
            <Mano />
            {juego.error && <div className="aviso-error">{juego.error}</div>}
            {menuCarta && <MenuCarta {...menuCarta} alElegir={ejecutar} alCerrar={() => setMenuCarta(null)} />}
            {panel === 'menu' && <Menu alCerrar={() => setPanel(null)} nuevaPartida={nuevaPartida} portada={() => irA('/')} galeria={() => irA('/galeria')} />}
            {panel === 'registro' && <Registro s={s} alCerrar={() => setPanel(null)} />}
            {panel === 'ayuda' && <Ayuda alCerrar={() => setPanel(null)} />}
            {hayFinMision && !s.resultado && <FinDeMision s={s} desde={juego.partida.desde} alCerrar={() => setFinVisto(juego.partida.desde)} elegir={elegir} />}
            {s.resultado && <FinDePartida s={s} otra={() => juego.reiniciar(nueva({ sinEscenario: Boolean(s.sinEscenario) }))} portada={() => irA('/')} />}
            <CapaZoom />
            <CapaExplicacion />
          </div>
        </LayoutGroup>
      </Contexto.Provider>
    </ProveedorExplicacion>
  )
}

export type { Decision, Estado }
