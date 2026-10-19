// Gráficos del reglamento: componentes, anatomía de las cartas, la mesa al empezar, el turno, la Prueba, el
// ejemplo de juego a doble página y la referencia rápida de la contraportada.
// Todas las cartas las dibuja la app desde sus datos (como en la mesa y la galería).

import { Fragment, useContext, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import arte from '../../data/arte.json'
import { CATALOGO, type EntradaCatalogo, type TipoCarta } from '../engine/catalogo.ts'
import type { Bloque, Capitulo, FilaComponente, Reglamento } from './fuente.ts'
import { BloqueVista, ContextoReglamento, InicioCapitulo } from './Libro.tsx'
import { Dorso, Filete, Icono, Marcador, Miniatura } from './piezas.tsx'

function Html({ html, className = '' }: { html: string; className?: string }) {
  return <div className={`md ${className}`} dangerouslySetInnerHTML={{ __html: html }} />
}

const sinEtiquetas = (html: string) => html.replace(/<[^>]+>/g, '')

// ---------------------------------------------------------------------------
// Componentes: cada fila de las tablas, con un abanico de sus cartas y sus números de colección

const visibles = CATALOGO.filter((e) => !(e.tipo === 'peligro' && e.carta.retirada))
const deTipo = (...tipos: TipoCarta[]) => visibles.filter((e) => tipos.includes(e.tipo))
const capitulos = (f: (e: EntradaCatalogo & { tipo: 'capitulo' }) => boolean) =>
  visibles.filter((e): e is EntradaCatalogo & { tipo: 'capitulo' } => e.tipo === 'capitulo' && f(e))

/** Cartas de cada fila de «Componentes», por el nombre de la fila. */
function cartasDeFila(nombre: string): EntradaCatalogo[] {
  switch (sinEtiquetas(nombre)) {
    case 'Capitanes':
      return deTipo('capitan')
    case 'Barco':
      return deTipo('barco')
    case 'Tripulantes':
      return deTipo('tripulante')
    case 'Mejoras':
      return deTipo('mejoraBarco', 'mejoraTripulante')
    case 'Eventos':
      return deTipo('evento')
    case 'Habilidades':
      return deTipo('habilidad')
    case 'Puertos':
      return deTipo('puerto')
    case 'Peligros':
      return deTipo('peligro')
    case 'Escenario':
      return deTipo('escenario')
    case 'Misiones iniciales':
      return capitulos((e) => e.mision.inicial)
    case 'Aventuras':
      return capitulos((e) => e.mision.aventura)
    case 'Capítulos':
      return capitulos((e) => !e.mision.inicial && !e.mision.aventura)
    case 'Tesoros':
      return deTipo('tesoro')
    case 'Mazos propios':
      return deTipo('mazoPropio')
    case 'Pasajeros':
      return deTipo('pasajero')
    case 'Cartas de misión':
      return deTipo('cartaMision')
    default:
      return []
  }
}

/** Preferimos para el abanico las cartas que ya tienen ilustración. */
const CON_ARTE = new Set(Object.keys(arte))

function abanico(cartas: EntradaCatalogo[]): EntradaCatalogo[] {
  const preferidas = [...cartas].sort((a, b) => Number(CON_ARTE.has(b.id)) - Number(CON_ARTE.has(a.id)))
  return preferidas.slice(0, 3)
}

function rango(cartas: EntradaCatalogo[]): string {
  const nums = [...new Set(cartas.map((c) => c.num))].sort((a, b) => a - b)
  if (nums.length === 0) return ''
  const tramos: string[] = []
  let inicio = nums[0] ?? 0
  let previo = inicio
  for (const n of [...nums.slice(1), Infinity]) {
    if (n === previo + 1) {
      previo = n
      continue
    }
    tramos.push(inicio === previo ? String(inicio).padStart(3, '0') : `${String(inicio).padStart(3, '0')}–${String(previo).padStart(3, '0')}`)
    inicio = n
    previo = n
  }
  return tramos.length > 3 ? `${tramos.slice(0, 3).join(', ')}…` : tramos.join(', ')
}

export function Componentes({ grupo, filas }: { grupo: string; filas: FilaComponente[] }) {
  return (
    <div className="componentes ancho">
      {grupo && <h4 className="componentes-grupo">{grupo}</h4>}
      <div className="componentes-rejilla">
        {filas.map((f) => {
          const cartas = cartasDeFila(f.nombre)
          const muestra = abanico(cartas)
          return (
            <div key={f.nombre} className="componente">
              <div className={`componente-abanico n${muestra.length}`}>
                {muestra.map((c, i) => (
                  <Miniatura key={c.id} id={c.id} ancho={c.tipo === 'capitulo' || c.tipo === 'puerto' ? 15 : 16} girada={(i - (muestra.length - 1) / 2) * 7} style={{ zIndex: i }} />
                ))}
              </div>
              <div className="componente-texto">
                <div className="componente-nombre">
                  <span dangerouslySetInnerHTML={{ __html: f.nombre }} />
                  <span className="componente-cantidad" dangerouslySetInnerHTML={{ __html: f.cantidad }} />
                </div>
                <div className="componente-uso" dangerouslySetInnerHTML={{ __html: f.html }} />
                {cartas.length > 0 && <div className="componente-numeros">Nº {rango(cartas)}</div>}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Anatomía de las cartas

type Donde = 'izq' | 'der' | 'arr' | 'aba' | 'arr-izq' | 'arr-der' | 'centro'

interface Llamada {
  /** Número o letra del marcador. */
  n: string
  /** Parte de la carta (selector dentro de la carta dibujada). */
  sel: string
  donde: Donde
  /** Desplazamiento en milímetros. */
  dx?: number
  dy?: number
}

interface CartaAnotadaDef {
  id: string
  /** Ancho de la carta en milímetros (lado corto si es apaisada). */
  ancho: number
  llamadas: Llamada[]
}

interface AnatomiaDef {
  cartas: CartaAnotadaDef[]
  /** Leyenda con letras (para las cartas que el reglamento explica en un párrafo, no en una lista). */
  letras?: { letra: string; texto: string }[]
}

const ANATOMIAS: Record<string, AnatomiaDef> = {
  tripulante: {
    cartas: [
      {
        id: 'vigia',
        ancho: 58,
        llamadas: [
          { n: '1', sel: '.costb', donde: 'arr-izq', dx: 2, dy: 2 },
          { n: '2', sel: '.plate .name', donde: 'der' },
          { n: '3', sel: '.tabs:not(.r) .tab:nth-child(2)', donde: 'izq' },
          { n: '4', sel: '.tabs.r .tab', donde: 'der' },
          { n: '5', sel: '.vida', donde: 'der' },
          { n: '6', sel: '.ribbon', donde: 'izq', dx: 4 },
          { n: '7', sel: '.traits', donde: 'izq' },
          { n: '8', sel: '.rules', donde: 'izq' },
          { n: '9', sel: '.flavor', donde: 'izq' },
          { n: '10', sel: '.foot span:last-child', donde: 'der' },
        ],
      },
    ],
  },
  mejora: {
    cartas: [
      {
        id: 'bronce',
        ancho: 46,
        llamadas: [
          { n: 'A', sel: '.costb', donde: 'arr-izq', dx: 2, dy: 2 },
          { n: 'B', sel: '.plate .name', donde: 'der' },
          { n: 'C', sel: '.espq', donde: 'der' },
          { n: 'D', sel: '.tabs.r .tab', donde: 'der' },
          { n: 'E', sel: '.ribbon', donde: 'izq', dx: 4 },
          { n: 'F', sel: '.rules', donde: 'izq' },
        ],
      },
    ],
    letras: [
      { letra: 'A', texto: 'Coste' },
      { letra: 'B', texto: 'Nombre' },
      { letra: 'C', texto: 'Espacio que ocupa (un cuadro por punto)' },
      { letra: 'D', texto: 'Munición' },
      { letra: 'E', texto: 'Tipo' },
      { letra: 'F', texto: 'Texto de juego' },
    ],
  },
  evento: {
    cartas: [
      {
        id: 'reflejos',
        ancho: 40,
        llamadas: [
          { n: 'A', sel: '.costb', donde: 'arr-izq', dx: 2, dy: 2 },
          { n: 'B', sel: '.tabs:not(.r) .tab', donde: 'izq' },
          { n: 'C', sel: '.rules', donde: 'izq' },
        ],
      },
      { id: 'abordaje', ancho: 40, llamadas: [{ n: 'B', sel: '.tabs:not(.r) .tab', donde: 'izq' }] },
    ],
    letras: [
      { letra: 'A', texto: 'Coste (solo los Eventos)' },
      { letra: 'B', texto: 'Iconos de habilidad' },
      { letra: 'C', texto: 'Texto del Evento' },
    ],
  },
  barco: {
    cartas: [
      {
        id: 'barco',
        ancho: 46,
        llamadas: [
          { n: 'A', sel: '.tabs.r .tab:nth-child(1)', donde: 'der' },
          { n: 'B', sel: '.tabs.r .tab:nth-child(2)', donde: 'der' },
          { n: 'C', sel: '.tabs.r .tab:nth-child(3)', donde: 'der' },
          { n: 'D', sel: '.rules', donde: 'izq' },
        ],
      },
    ],
    letras: [
      { letra: 'A', texto: 'Daño máximo' },
      { letra: 'B', texto: 'Capacidad' },
      { letra: 'C', texto: 'Espacio' },
      { letra: 'D', texto: 'Texto de juego' },
    ],
  },
  puerto: {
    cartas: [
      {
        id: 'tortuga',
        ancho: 56,
        llamadas: [
          { n: 'A', sel: '.ptoh .chapn', donde: 'izq' },
          { n: 'B', sel: '.muelleb', donde: 'der' },
          { n: 'C', sel: '.ptor .opt', donde: 'izq' },
          { n: 'D', sel: '.ptoab', donde: 'izq' },
          { n: 'E', sel: '.ptoart', donde: 'der' },
        ],
      },
    ],
    letras: [
      { letra: 'A', texto: 'Nombre del puerto' },
      { letra: 'B', texto: 'Tamaño del muelle' },
      { letra: 'C', texto: 'Opciones comunes' },
      { letra: 'D', texto: 'Opción propia del puerto' },
      { letra: 'E', texto: 'Ilustración' },
    ],
  },
  // «El prisionero de Portobelo», como la lámina de referencia (su recompensa ya cabe: la letra se ajusta sola).
  mision: {
    cartas: [
      {
        id: 'panama-I',
        ancho: 58,
        llamadas: [
          { n: '1', sel: '.seal', donde: 'arr-izq', dx: 1, dy: 1 },
          { n: '2', sel: '.chapt .chapn', donde: 'der' },
          { n: '3', sel: '.tabs .tab:first-child', donde: 'izq' },
          { n: '4', sel: '.tabs .tab.dark', donde: 'izq' },
          { n: '5', sel: '.chapr .rules', donde: 'der' },
          { n: '6', sel: '.reward', donde: 'der' },
          { n: '7', sel: '.foot span:first-child', donde: 'izq' },
        ],
      },
    ],
  },
  peligro: {
    cartas: [
      {
        id: 'p2_arrecife',
        ancho: 60,
        llamadas: [
          { n: '1', sel: '.encp .ent', donde: 'izq' },
          { n: '2', sel: '.encp .encn', donde: 'izq' },
          { n: '3', sel: '.encp .test2', donde: 'der' },
          { n: '4', sel: '.encp .av', donde: 'der' },
          { n: '5', sel: '.encp .t2.win', donde: 'der' },
          { n: '6', sel: '.dest', donde: 'izq' },
        ],
      },
    ],
  },
  escenario: {
    cartas: [
      {
        id: 'rumores',
        ancho: 44,
        llamadas: [
          { n: 'A', sel: '.plate .name', donde: 'der' },
          { n: 'B', sel: '.rules', donde: 'izq' },
          { n: 'C', sel: '.flavor', donde: 'izq' },
        ],
      },
    ],
    letras: [
      { letra: 'A', texto: 'Nombre' },
      { letra: 'B', texto: 'Efecto al revelarla' },
      { letra: 'C', texto: 'Ambientación' },
    ],
  },
}

/** Separación de los marcadores respecto al borde de la carta y entre ellos (mm). */
const FUERA = 7
const ENTRE = 6.6

interface Punto {
  n: string
  /** Marcador, fuera de la carta. */
  mx: number
  my: number
  /** Punto señalado, sobre la parte de la carta. */
  tx: number
  ty: number
}

/** Una carta con sus llamadas: el marcador fuera de la carta y una línea fina hasta la parte que señala. */
function CartaAnotada({ def }: { def: CartaAnotadaDef }) {
  const ref = useRef<HTMLDivElement>(null)
  const [puntos, setPuntos] = useState<Punto[]>([])
  const [tam, setTam] = useState({ w: 0, h: 0 })
  useLayoutEffect(() => {
    const raiz = ref.current?.querySelector<HTMLElement>('.miniatura')
    if (!raiz) return
    const base = raiz.getBoundingClientRect()
    // Unidades del lienzo: la página puede estar escalada en pantalla.
    const k = raiz.offsetWidth ? base.width / raiz.offsetWidth : 1
    const MMPX = 96 / 25.4
    const W = base.width / k
    const lista: Punto[] = []
    for (const l of def.llamadas) {
      const el = raiz.querySelector(l.sel)
      if (!el) continue
      const r = el.getBoundingClientRect()
      const x0 = (r.left - base.left) / k
      const y0 = (r.top - base.top) / k
      const w = r.width / k
      const h = r.height / k
      const izquierda = l.donde === 'izq' || l.donde === 'arr-izq'
      const dentro = Math.min(0.9 * MMPX, w / 2)
      const ty = (l.donde.startsWith('arr') ? y0 + Math.min(h / 2, 3 * MMPX) : y0 + h / 2) + (l.dy ?? 0) * MMPX
      const tx = (izquierda ? x0 + dentro : x0 + w - dentro) + (l.dx ?? 0) * MMPX
      lista.push({ n: l.n, tx, ty, mx: izquierda ? -FUERA * MMPX : W + FUERA * MMPX, my: ty })
    }
    // Que no se pisen los marcadores de un mismo lado.
    for (const lado of [true, false]) {
      const deLado = lista.filter((p) => p.mx < 0 === lado).sort((a, b) => a.my - b.my)
      for (let i = 1; i < deLado.length; i++) {
        const prev = deLado[i - 1]
        const p = deLado[i]
        if (prev && p && p.my - prev.my < ENTRE * MMPX) p.my = prev.my + ENTRE * MMPX
      }
    }
    setTam({ w: W, h: base.height / k })
    setPuntos(lista)
  }, [def])
  const MMPX = 96 / 25.4
  return (
    <div className="carta-anotada" ref={ref} style={{ margin: `0 ${FUERA + 4}mm` }}>
      <Miniatura id={def.id} ancho={def.ancho} />
      <svg className="lineas-guia" width={tam.w + 2 * (FUERA + 4) * MMPX} height={tam.h} style={{ left: `-${FUERA + 4}mm` }} aria-hidden="true">
        {puntos.map((p, i) => {
          const dx = (FUERA + 4) * MMPX
          const borde = p.mx < 0 ? p.mx + 3.1 * MMPX : p.mx - 3.1 * MMPX
          return (
            <g key={i}>
              <line x1={borde + dx} y1={p.my} x2={p.tx + dx} y2={p.ty} />
              <circle cx={p.tx + dx} cy={p.ty} r={1.5} />
            </g>
          )
        })}
      </svg>
      {puntos.map((p, i) => (
        <Marcador key={i} style={{ left: p.mx, top: p.my }}>
          {p.n}
        </Marcador>
      ))}
    </div>
  )
}

export function Anatomia({ tipo, leyenda }: { tipo: string; leyenda: string[] }) {
  const def = ANATOMIAS[tipo]
  if (!def) return <div className="pendiente">[anatomía de «{tipo}» pendiente]</div>
  const numerada = leyenda.length > 0
  return (
    <figure className={`anatomia anatomia-${tipo} ancho ${numerada ? 'numerada' : 'con-letras'}`}>
      <div className="anatomia-cartas">
        {def.cartas.map((c) => (
          <CartaAnotada key={c.id} def={c} />
        ))}
      </div>
      {numerada ? (
        <ol className="anatomia-leyenda">
          {leyenda.map((html, i) => (
            <li key={i}>
              <Marcador className="pequeno">{i + 1}</Marcador>
              <span dangerouslySetInnerHTML={{ __html: html }} />
            </li>
          ))}
        </ol>
      ) : (
        <ul className="anatomia-letras">
          {def.letras?.map((l) => (
            <li key={l.letra}>
              <Marcador className="pequeno">{l.letra}</Marcador>
              {l.texto}
            </li>
          ))}
        </ul>
      )}
    </figure>
  )
}

// ---------------------------------------------------------------------------
// La mesa al empezar la partida (con los pasos de la preparación)

const MANO = ['abordaje', 'timon', 'ojo', 'reflejos', 'soborno']
const MUELLE = ['marinero_p', 'bucanero', 'sable', 'matasanos']
const INICIALES = capitulos((e) => e.mision.inicial).map((e) => e.id)

interface Zona {
  x: number
  y: number
  rotulo: string
  paso?: number
  /** Posición del rótulo respecto a la zona. */
  ancho: number
}

/** Título de cada paso de la preparación (la negrita con que empieza cada punto de su lista numerada). */
function pasosDePreparacion(r: Reglamento | null): string[] {
  const cap = r?.aprende.capitulos.find((c) => c.titulo.startsWith('Preparación'))
  const lista = cap?.bloques.find((b): b is Bloque & { tipo: 'html' } => b.tipo === 'html' && b.html.includes('<ol'))
  if (!lista) return []
  return [...lista.html.matchAll(/<li><strong>([\s\S]*?)<\/strong>/g)].map((m) => (m[1] ?? '').replace(/[.:]$/, ''))
}

function Hueco({ x, y, w, h, texto }: { x: number; y: number; w: number; h: number; texto?: string }) {
  return (
    <div className="mesa-hueco" style={{ left: `${x}mm`, top: `${y}mm`, width: `${w}mm`, height: `${h}mm` }}>
      {texto}
    </div>
  )
}

function En({ x, y, children, style }: { x: number; y: number; children: ReactNode; style?: CSSProperties }) {
  return (
    <div className="mesa-pieza" style={{ left: `${x}mm`, top: `${y}mm`, ...style }}>
      {children}
    </div>
  )
}

export function Mesa() {
  const W = 14.5 // lado corto de una carta (mm)
  const H = W * (528 / 378)
  const filas = [8, 58, 110]
  const pasos = pasosDePreparacion(useContext(ContextoReglamento))
  const bajo = (y: number, alto = H) => y + alto + 2
  const zonas: Zona[] = [
    { x: 4, y: bajo(filas[0] ?? 0), rotulo: 'Mazo de Escenario', paso: 1, ancho: 18 },
    { x: 22, y: bajo(filas[0] ?? 0), rotulo: 'Peligros · descartes', paso: 4, ancho: 33 },
    { x: 60, y: bajo(filas[0] ?? 0, W), rotulo: 'Misiones disponibles', paso: 5, ancho: 66 },
    { x: 130, y: bajo(filas[0] ?? 0, W), rotulo: 'Mazo de Misiones', paso: 5, ancho: 22 },
    { x: 155, y: bajo(filas[0] ?? 0, W), rotulo: 'Mazo de historia', paso: 5, ancho: 22 },
    { x: 4, y: (filas[1] ?? 0) + 15, rotulo: 'Reputación', paso: 1, ancho: 40 },
    { x: 48, y: bajo(filas[1] ?? 0, 16), rotulo: 'Puerto', paso: 3, ancho: 24 },
    { x: 76, y: bajo(filas[1] ?? 0), rotulo: 'Muelle', paso: 6, ancho: 66 },
    { x: 148, y: bajo(filas[1] ?? 0), rotulo: 'Mazo de muelle', paso: 6, ancho: 28 },
    { x: 4, y: bajo(filas[2] ?? 0), rotulo: 'Capitán y Barco', paso: 2, ancho: 33 },
    { x: 40, y: bajo(filas[2] ?? 0), rotulo: 'Tus Tripulantes', ancho: 50 },
    { x: 98, y: bajo(filas[2] ?? 0), rotulo: 'Mazo del capitán', paso: 7, ancho: 22 },
    { x: 126, y: bajo(filas[2] ?? 0), rotulo: 'Tu mano', paso: 7, ancho: 40 },
  ]
  const [f0 = 0, f1 = 0, f2 = 0] = filas
  return (
    <figure className="mesa-diagrama ancho">
      <div className="mesa-tablero" style={{ height: `${f2 + H + 10}mm` }}>
        <div className="mesa-franja" style={{ top: `${f2 - 5}mm`, height: `${H + 13}mm` }}>
          <span>Tu zona</span>
        </div>
        {/* Arriba: el reloj, los Peligros y las misiones. */}
        <En x={4} y={f0}>
          <Dorso tipo="escenario" ancho={W} grosor={4} />
        </En>
        <En x={22} y={f0}>
          <Dorso tipo="peligros" ancho={W} grosor={6} />
        </En>
        <Hueco x={39.5} y={f0} w={W} h={H} />
        {INICIALES.map((id, i) => (
          <En key={id} x={60 + i * 22.5} y={f0}>
            <Miniatura id={id} ancho={W} />
          </En>
        ))}
        <En x={130} y={f0}>
          <Dorso tipo="misiones" ancho={W} apaisado grosor={4} />
        </En>
        <En x={155} y={f0}>
          <Dorso tipo="historia" ancho={W} apaisado grosor={5} />
        </En>
        {/* En medio: la reputación, el puerto y el muelle. */}
        <En x={4} y={f1}>
          <div className="mesa-reputacion">
            <Icono id="rep" />
            {[0, 3, 6, 9, 12, 15, 18].map((n) => (
              <span key={n} className={n === 0 ? 'marca-rep actual' : 'marca-rep'}>
                {n}
              </span>
            ))}
          </div>
        </En>
        <En x={48} y={f1}>
          <Miniatura id="tortuga" ancho={16} />
        </En>
        {MUELLE.map((id, i) => (
          <En key={id} x={76 + i * 17} y={f1}>
            <Miniatura id={id} ancho={W} />
          </En>
        ))}
        <En x={148} y={f1}>
          <Dorso tipo="muelle" ancho={W} grosor={4} />
        </En>
        {/* Abajo: tu gente, tu mazo y tu mano. */}
        <En x={4} y={f2}>
          <Miniatura id="capitan" ancho={W} />
        </En>
        <En x={21} y={f2}>
          <Miniatura id="barco" ancho={W} />
        </En>
        {[0, 1, 2].map((i) => (
          <Hueco key={i} x={40 + i * 17} y={f2} w={W} h={H} texto={i === 0 ? 'Los reclutas en tu turno' : undefined} />
        ))}
        <En x={98} y={f2}>
          <Dorso tipo="capitan" ancho={W} grosor={5} />
        </En>
        <div className="mesa-mano" style={{ left: '124mm', top: `${f2 - 1}mm` }}>
          {MANO.map((id, i) => (
            <Miniatura key={id} id={id} ancho={W} girada={(i - 2) * 6} style={{ left: `${i * 8.5}mm`, top: `${Math.abs(i - 2) * 1}mm` }} />
          ))}
        </div>
        {zonas.map((z) => (
          <div key={z.rotulo} className="mesa-rotulo" style={{ left: `${z.x}mm`, top: `${z.y}mm`, width: `${z.ancho}mm` }}>
            {z.paso !== undefined && <Marcador className="pequeno">{z.paso}</Marcador>}
            <span>{z.rotulo}</span>
          </div>
        ))}
      </div>
      <figcaption>La mesa al empezar una partida normal con Diego en Tortuga. Los números rojos son los pasos de la preparación.</figcaption>
      {pasos.length > 0 && (
        <ol className="mesa-pasos">
          {pasos.map((p, i) => (
            <li key={i}>
              <Marcador className="pequeno">{i + 1}</Marcador>
              <span dangerouslySetInnerHTML={{ __html: p }} />
            </li>
          ))}
        </ol>
      )}
    </figure>
  )
}

// ---------------------------------------------------------------------------
// El turno en 4 pasos

const ICONO_PASO = ['acampar', 'doblon', 'timon', 'robar']

export function Turno({ pasos }: { pasos: string[] }) {
  const resumen = useContext(ContextoReglamento)?.rapida.turno ?? []
  return (
    <figure className="turno ancho">
      <ol className="turno-pasos">
        {pasos.map((p, i) => (
          <li key={i} className="turno-paso">
            <div className="turno-cabecera">
              <span className="turno-num">{i + 1}</span>
              <Icono id={ICONO_PASO[i] ?? 'acampar'} className="turno-icono" />
            </div>
            <div className="turno-titulo" dangerouslySetInnerHTML={{ __html: p }} />
            {resumen[i] && <div className="turno-resumen" dangerouslySetInnerHTML={{ __html: lineaRapida(resumen[i] ?? '').texto }} />}
          </li>
        ))}
      </ol>
      <div className="turno-vuelta">
        <span>Siguiente turno: vuelves al paso 1</span>
      </div>
    </figure>
  )
}

/** Resumen de cada paso del turno (sale de la Referencia rápida), para la contraportada. */
function lineaRapida(html: string): { titulo: string; texto: string } {
  const m = /^<strong>([^<]*?)\s*[—:.]?\s*<\/strong>\s*([\s\S]*)$/.exec(html.trim())
  return m ? { titulo: m[1] ?? '', texto: m[2] ?? '' } : { titulo: '', texto: html }
}

// ---------------------------------------------------------------------------
// La Prueba: diagrama de flujo con la ventana de acción

const PASOS_PRUEBA = ['Comprometer', 'Destino', 'Ventana de acción', 'Resolver', 'Avance']

export function PruebaFlujo() {
  const textos = useContext(ContextoReglamento)?.rapida.prueba ?? []
  const t = (i: number, defecto: string) => {
    const texto = textos[i] ?? defecto
    const titulo = PASOS_PRUEBA[i] ?? ''
    return texto.replace(new RegExp(`^${titulo}:\\s*`, 'i'), '').replace(/^./, (c) => c.toUpperCase())
  }
  return (
    <figure className="prueba-flujo ancho">
      <div className="pf-fila">
        <div className="pf-caja">
          <span className="pf-num">1</span>
          <span className="pf-titulo">{PASOS_PRUEBA[0]}</span>
          <span className="pf-texto" dangerouslySetInnerHTML={{ __html: t(0, 'Compromete a tu tripulación y añade cartas de tu mano.') }} />
          <span className="pf-nota">Única ocasión de sumar cartas de la mano</span>
        </div>
        <span className="pf-flecha" />
        <div className="pf-caja">
          <span className="pf-num">2</span>
          <span className="pf-titulo">{PASOS_PRUEBA[1]}</span>
          <span className="pf-texto" dangerouslySetInnerHTML={{ __html: t(1, 'Revela el Destino y aplícalo.') }} />
          <span className="pf-nota">
            <Icono id="sinop" /> ¿Nadie comprometido? También Sin oposición
          </span>
        </div>
        <span className="pf-flecha" />
        <div className="pf-caja pf-ventana">
          <span className="pf-etiqueta">Ventana de acción</span>
          <span className="pf-num">3</span>
          <span className="pf-titulo">{PASOS_PRUEBA[2]}</span>
          <span className="pf-texto" dangerouslySetInnerHTML={{ __html: t(2, 'Capacidades y Eventos con su propio momento.') }} />
        </div>
        <span className="pf-flecha" />
        <div className="pf-decision">
          <div className="pf-rombo">
            <span className="pf-num">4</span>
            <span>¿Tu total iguala o supera la dificultad?</span>
          </div>
        </div>
      </div>
      <svg className="pf-rama-flechas" viewBox="0 0 100 10" preserveAspectRatio="none" aria-hidden="true">
        <path d="M89 0 V4 H55 V10 M89 4 H85 V10" />
      </svg>
      <div className="pf-salidas">
        <div className="pf-salida pf-si">
          <span className="pf-rama">Sí</span>
          <span className="pf-titulo">Superas la Prueba</span>
          <span className="pf-texto">Aplica el efecto de éxito.</span>
          <span className="pf-avance">
            <span className="pf-num">5</span> Ganas el primer Avance: <b>X</b> de «Avance X / Y»
          </span>
        </div>
        <div className="pf-salida pf-no">
          <span className="pf-rama">No (o nadie comprometido)</span>
          <span className="pf-titulo">Fallas la Prueba</span>
          <span className="pf-texto">Aplica el efecto de fallo.</span>
          <span className="pf-avance">
            <span className="pf-num">5</span> Ganas el segundo Avance: <b>Y</b> de «Avance X / Y»
          </span>
        </div>
      </div>
    </figure>
  )
}

// ---------------------------------------------------------------------------
// Ejemplo de juego completo, a doble página, con las cartas a la vista.
// El texto es el del reglamento; los paneles enseñan las cartas de ese ejemplo (el primer turno con Diego en
// Tortuga) y lo que pasa con cada una. Si cambia el ejemplo, hay que cambiar también estos paneles.

interface CartaPanel {
  id: string
  insignia?: string
  tono?: 'bien' | 'mal' | 'neutro'
  agotada?: boolean
}

interface GrupoPanel {
  rotulo: string
  paso: number
  cartas: CartaPanel[]
}

// Paneles del ejemplo de juego escritos a mano para ese ejemplo (aprobado por Albert): si cambia el ejemplo, hay que cambiarlos.
const PANEL_PUERTO: GrupoPanel[] = [
  { rotulo: 'Escenario', paso: 1, cartas: [{ id: 'rumores', insignia: '+1 de Avance si zarpas' }] },
  {
    rotulo: 'Tu mano',
    paso: 2,
    cartas: [
      { id: 'abordaje', insignia: 'Se queda', tono: 'bien' },
      { id: 'timon', insignia: 'Se queda', tono: 'bien' },
      { id: 'ojo', insignia: 'Paga', tono: 'mal' },
      { id: 'soborno', insignia: 'Paga', tono: 'mal' },
      { id: 'reflejos', insignia: 'Paga', tono: 'mal' },
    ],
  },
  {
    rotulo: 'Muelle de Tortuga',
    paso: 2,
    cartas: [
      { id: 'bucanero', insignia: 'Reclutado', tono: 'bien' },
      { id: 'marinero_p', insignia: 'Reclutado', tono: 'bien' },
      { id: 'sable', insignia: 'Se descarta', tono: 'neutro' },
      { id: 'matasanos', insignia: 'Se descarta', tono: 'neutro' },
    ],
  },
]

const PANEL_MISION: GrupoPanel[] = [
  { rotulo: 'Misión', paso: 3, cartas: [{ id: 'prueba-I', insignia: 'Empieza con 1 · pide 3' }] },
  { rotulo: 'Encuentro de Mar', paso: 3, cartas: [{ id: 'p2_turbonada', insignia: 'NAV 4 · Avance 3 / 2' }] },
  {
    rotulo: 'Comprometidos',
    paso: 3,
    cartas: [
      { id: 'capitan', insignia: 'NAV 2', agotada: true },
      { id: 'bucanero', insignia: 'NAV 1', agotada: true },
      { id: 'timon', insignia: '+2 NAV', tono: 'bien' },
    ],
  },
  { rotulo: 'Destino', paso: 3, cartas: [{ id: 'p2_arrecife', insignia: '+1 a la dificultad', tono: 'mal' }] },
]

function CartaDePanel({ c, ancho }: { c: CartaPanel; ancho: number }) {
  const largo = ancho * (528 / 378)
  return (
    <div className="panel-carta">
      {c.agotada ? (
        <div className="panel-agotada" style={{ width: `${largo}mm`, height: `${ancho}mm` }}>
          <Miniatura id={c.id} ancho={ancho} style={{ transform: `translate(${largo}mm, 0) rotate(90deg)`, transformOrigin: '0 0' }} />
        </div>
      ) : (
        <Miniatura id={c.id} ancho={ancho} />
      )}
      {c.insignia && <span className={`panel-insignia ${c.tono ?? ''}`}>{c.agotada ? `Agotado · ${c.insignia}` : c.insignia}</span>}
    </div>
  )
}

function PanelEjemplo({ grupos, ancho, className = '', children }: { grupos: GrupoPanel[]; ancho: number; className?: string; children?: ReactNode }) {
  return (
    <figure className={`panel-ejemplo ancho ${className}`}>
      <div className="panel-grupos">
        {grupos.map((g) => (
          <div key={g.rotulo} className="panel-grupo">
            <div className="panel-rotulo">
              <Marcador className="pequeno">{g.paso}</Marcador>
              {g.rotulo}
            </div>
            <div className="panel-cartas">
              {g.cartas.map((c) => (
                <CartaDePanel key={`${g.rotulo}-${c.id}`} c={c} ancho={ancho} />
              ))}
            </div>
          </div>
        ))}
      </div>
      {children}
    </figure>
  )
}

/** ¿Empieza este bloque por «**Zarpar —**»? Desde ahí, el texto va en la página derecha. */
const empiezaZarpar = (b: Bloque) => b.tipo === 'html' && /^<p><strong>Zarpar\b/.test(b.html)

export function EjemploDeJuego({ c }: { c: Capitulo }) {
  const corte = c.bloques.findIndex(empiezaZarpar)
  const izquierda = corte >= 0 ? c.bloques.slice(0, corte) : c.bloques
  const derecha = corte >= 0 ? c.bloques.slice(corte) : []
  const [intro, ...pasosIzq] = izquierda
  return (
    <section className="capitulo ejemplo-de-juego" id={c.id}>
      <div className="flujo">
        <InicioCapitulo c={c} />
        {!c.conTema && <aside className="nota-tema pendiente">[nota pendiente]</aside>}
        {intro && <BloqueVista b={intro} />}
        <PanelEjemplo grupos={PANEL_PUERTO} ancho={19.5} className="panel-puerto" />
        {pasosIzq.map((b, i) => (
          <div key={i} className="paso-ejemplo">
            <BloqueVista b={b} />
          </div>
        ))}
        {derecha.length > 0 && (
          <PanelEjemplo grupos={PANEL_MISION} ancho={17} className="panel-mision">
            <div className="panel-cuenta">
              <span>
                <b>Total:</b> Diego 2 + Bucanero 1 + Barco 1 + «Mano firme al timón» 2 = <b>6</b>
              </span>
              <span>
                <b>Dificultad:</b> 4 + Destino 1 = <b>5</b>
              </span>
              <span className="panel-resultado">Superada: 1 + 3 + 1 = 5 de Avance, y la misión pedía 3</span>
            </div>
          </PanelEjemplo>
        )}
        {derecha.map((b, i) => (
          <div key={i} className="paso-ejemplo">
            <BloqueVista b={b} />
          </div>
        ))}
      </div>
    </section>
  )
}

// ---------------------------------------------------------------------------
// Referencia rápida (contraportada)

/** «N y gota roja» → N + el icono de herida; « · » separa variantes. */
const ICONOS_TEXTO: [RegExp, string][] = [
  [/gota roja/, 'herida'],
  [/Mejora tachada/, 'mejora tachada'],
  [/\bbarco\b/, 'dano'],
  [/\bagotar\b/, 'agotar'],
  [/\bdescartar\b/, 'descartar'],
  [/\brobar\b/, 'robar'],
  [/\bcurar\b/, 'curar'],
  [/\bmapa\b/, 'avance'],
  [/\bbarril\b/, 'municion'],
  [/\bMejora\b/, 'mejora'],
  [/^Rehén$/, 'rehen'],
  [/^Calavera$/, 'rep'],
  [/^Sin fallo/, 'sinop'],
]

function SimboloIcono({ texto }: { texto: string }) {
  const variantes = sinEtiquetas(texto).split(' · ')
  return (
    <span className="simbolos">
      {variantes.map((v, i) => {
        const limpio = v.replace(/[«»]/g, '').trim()
        const regla = ICONOS_TEXTO.find(([re]) => re.test(limpio))
        if (!regla) {
          return (
            <span key={i} className="simbolo simbolo-texto">
              {limpio}
            </span>
          )
        }
        const [re, icono] = regla
        const numero = limpio.replace(re, '').replace(/\s+y\s*$/, '').replace(/\(.*\)/, '').trim()
        const tachada = icono === 'mejora tachada'
        return (
          <span key={i} className={`simbolo icono-${icono.split(' ')[0]}`}>
            {numero && <b>{numero}</b>}
            <Icono id={icono.split(' ')[0] ?? ''} className={tachada ? 'tachado' : ''} />
          </span>
        )
      })}
    </span>
  )
}

export function Contraportada({ rapida }: { rapida: Reglamento['rapida'] }) {
  return (
    <section className="contraportada" id="referencia-rapida">
      <div className="cp-cabecera">
        <span className="cp-juego">Sea Scoundrels</span>
        <h2 className="cp-titulo marca-seccion">Referencia rápida</h2>
      </div>
      <div className="cp-columnas">
        <div className="cp-col">
          <h3 className="cp-apartado">El turno en 4 pasos</h3>
          <ol className="cp-turno">
            {rapida.turno.map((html, i) => {
              const l = lineaRapida(html)
              return (
                <li key={i}>
                  <span className="cp-num">{i + 1}</span>
                  <div>
                    <b className="cp-paso">{l.titulo}</b>
                    <span dangerouslySetInnerHTML={{ __html: l.texto }} />
                  </div>
                </li>
              )
            })}
          </ol>
          <h3 className="cp-apartado">Resolver una Prueba</h3>
          <ol className="cp-prueba">
            {rapida.prueba.map((html, i) => (
              <li key={i} className={i === 2 ? 'cp-ventana' : ''}>
                <span className="cp-num">{i + 1}</span>
                <span dangerouslySetInnerHTML={{ __html: html }} />
              </li>
            ))}
          </ol>
          <h3 className="cp-apartado">Iconos de efecto</h3>
          <table className="cp-iconos">
            <tbody>
              {rapida.iconos.map((f, i) => (
                <tr key={i}>
                  <td>
                    <SimboloIcono texto={f.icono} />
                  </td>
                  <td dangerouslySetInnerHTML={{ __html: f.significa }} />
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="cp-col">
          <h3 className="cp-apartado">Estados y Ventajas</h3>
          <Html html={rapida.estadosIntro} className="cp-estados-intro" />
          {rapida.estadosQuita && <p className="cp-estados-nota">↳ {rapida.estadosQuita}:</p>}
          <table className="cp-estados">
            <tbody>
              {rapida.estados.map((f, i) => (
                <Fragment key={i}>
                  <tr className={`cp-clase-${/Ventaja/.test(f.clase) ? 'ventaja' : /Barco/.test(f.clase) ? 'barco' : 'estado'}`}>
                    <th>
                      <span dangerouslySetInnerHTML={{ __html: f.ficha }} />
                      <small dangerouslySetInnerHTML={{ __html: f.clase }} />
                    </th>
                    <td>
                      <span dangerouslySetInnerHTML={{ __html: f.hace }} />
                      {f.quita.trim() !== '—' && <span className="cp-quita" dangerouslySetInnerHTML={{ __html: f.quita }} />}
                    </td>
                  </tr>
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <Filete className="cp-filete" />
    </section>
  )
}
