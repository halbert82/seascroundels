// Recuadro de un ejemplo, con las cartas que nombra su texto.
//
// - Sin cartas de Peligro: una carta va al lado del texto; varias, en una fila debajo (de 24 a 30 mm, como mucho 4).
// - Con cartas de Peligro: de cada una solo se enseña la parte que cita el texto (un encuentro, el Destino), recortada
//   y a un ancho en que se lee. El recuadro ocupa entonces la página entera y se colocan sus piezas de la forma que
//   deje el recuadro más bajo: todo en una fila bajo el texto, los recortes con las cartas a su lado, o los recortes al
//   lado del texto (como una carta sola). Para elegir, se calcula el alto de cada forma: el de los recortes se mide en
//   las cartas ya dibujadas y el del texto, con la anchura de sus letras.
// TODO(diseño): el recuadro a página entera y la letra mínima de los recortes (8 px, o 7,2 si así cabe en una fila)
// los he elegido yo (docs/decisiones.md, fase 9, «Última ronda de maqueta»).

import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { porId } from '../engine/catalogo.ts'
import { dimensiones } from '../ui/cartas/Carta.tsx'
import type { CartaNombrada, ParteCarta } from './cartasNombradas.ts'
import type { Bloque } from './fuente.ts'
import { anchoLegible, FragmentoPeligro, LETRA_LEGIBLE, LETRA_MINIMA, letraDeCarta, MARGEN_RECORTE, Miniatura, MM, selectorParte } from './piezas.tsx'

/** Ancho útil dentro de un recuadro de ejemplo de la columna principal (mm) y separación entre sus cartas. */
const ANCHO_EJEMPLO = 116
const SEPARACION_CARTAS = 2.5
/** Las cartas de un ejemplo, lo más grandes que quepan en una fila, hasta 30 mm y no menos de 24 (así se leen su nombre
 *  y sus números): si no caben a 24, se enseñan menos (las primeras que nombra el texto). */
const CARTA_EJEMPLO = 30
const CARTA_EJEMPLO_MINIMA = 24
/** Ancho útil de un recuadro de ejemplo a toda la página (178 mm menos sus márgenes) y separación entre sus piezas. */
const ANCHO_EJEMPLO_PAGINA = 171
const SEPARACION_PIEZAS = 3
/** Separación entre el texto y lo que va a su lado, y entre el texto y lo que va debajo (mm). */
const AL_LADO = 3.5
const DEBAJO = 2.4
/** El texto, al lado de los recortes, no se estrecha más de esto (mm). */
const TEXTO_MINIMO = 60
/** Los recortes más pequeños (letra mínima) solo se usan si el recuadro baja al menos esto (mm). */
const PREFERIR_LEGIBLE = 6

/** Letra del texto de los ejemplos (9 pt) y su interlineado; margen de cada párrafo (mm). */
const LETRA_TEXTO = 12
const LINEA = (LETRA_TEXTO * 1.38) / MM
const PARRAFO = 1.4
/** Alto del nombre de la carta encima de un recorte y separación entre recortes de una misma carta y entre cartas (mm). */
const NOMBRE_FRAGMENTO = 4.6
const ENTRE_RECORTES = 1.3
const ENTRE_FRAGMENTOS = 2.4

/** Proporción del lado largo de una carta respecto a su ancho en la fila (1 si va de pie). */
function proporcion(id: string): number {
  const d = dimensiones(porId(id))
  return d.ancho > d.alto ? d.ancho / d.alto : 1
}

/** Alto de una carta de `ancho` mm (su lado corto). */
function altoCarta(id: string, ancho: number): number {
  const d = dimensiones(porId(id))
  return d.ancho > d.alto ? ancho : (ancho * d.alto) / d.ancho
}

/** Ancho de las cartas de un ejemplo (de su lado corto) para que quepan todas en una fila de `espacio` mm. */
function anchoCartasEjemplo(ids: readonly string[], espacio = ANCHO_EJEMPLO, separacion = SEPARACION_CARTAS): number {
  const total = ids.reduce((n, id) => n + proporcion(id), 0)
  return Math.min(CARTA_EJEMPLO, (espacio - separacion * (ids.length - 1)) / total)
}

/** ¿Se enseña de esta carta solo la parte que cita el ejemplo? (las de Peligro y las de mazo propio). */
function seRecorta(c: CartaNombrada): boolean {
  const tipo = porId(c.id).tipo
  return (tipo === 'peligro' || tipo === 'mazoPropio') && c.partes.length > 0
}

// ---------------------------------------------------------------------------
// Alto del texto (mm) a un ancho dado: se mide la anchura de sus letras y se reparte en líneas.

let lienzo: CanvasRenderingContext2D | null = null

function anchoDeTexto(texto: string): number {
  lienzo ??= document.createElement('canvas').getContext('2d')
  if (!lienzo) return texto.length * 6
  lienzo.font = `400 ${LETRA_TEXTO}px "Alegreya Sans"`
  return lienzo.measureText(texto).width
}

/** Párrafos del texto de un ejemplo: su anchura (px) en una línea. Cada icono cuenta como una letra ancha. */
function parrafos(html: string): number[] {
  return html
    .split(/<\/p>|<\/li>/)
    .map((trozo) => {
      const iconos = (trozo.match(/class="ic\b/g) ?? []).length
      const texto = trozo
        .replace(/<[^>]+>/g, '')
        .replace(/&nbsp;/g, ' ')
        .replace(/&[a-z]+;/g, 'x')
        .trim()
      return texto ? anchoDeTexto(texto) + iconos * LETRA_TEXTO * 1.1 : 0
    })
    .filter((w) => w > 0)
}

function altoTexto(anchos: readonly number[], ancho: number): number {
  // Un 6 % más: las líneas no se llenan del todo al partir las palabras.
  return anchos.reduce((n, w) => n + Math.max(1, Math.ceil((w * 1.06) / (ancho * MM))) * LINEA + PARRAFO, 0)
}

// ---------------------------------------------------------------------------

/** Lo medido en las cartas de Peligro ya dibujadas: su letra y el alto de cada parte (px sin escalar). */
interface Medidas {
  letra: number
  partes: Record<string, number>
}

function FilaCartas({ ids, ancho, className = 'fila' }: { ids: readonly string[]; ancho: number; className?: string }) {
  return (
    <div className={`ejemplo-cartas ${className}`}>
      {ids.map((id) => (
        <Miniatura key={id} id={id} ancho={ancho} />
      ))}
    </div>
  )
}

interface Forma {
  alto: number
  dibujo: ReactNode
  /** Las piezas van al lado del texto (y no debajo). */
  alLado?: boolean
}

/** Las formas posibles de colocar recortes y cartas con los recortes a `w` mm, con el alto (mm) que tendría cada una. */
function formas(b: Bloque & { tipo: 'ejemplo' }, m: Medidas, w: number): Forma[] {
  const recortes = b.cartas.filter(seRecorta)
  const todas = b.cartas.filter((c) => !seRecorta(c)).map((c) => c.id)
  const texto = parrafos(b.html)
  const espacio = ANCHO_EJEMPLO_PAGINA
  const altoFragmento = (c: CartaNombrada) =>
    NOMBRE_FRAGMENTO + c.partes.reduce((n, p) => n + ((m.partes[`${c.id}:${p}`] ?? 130) + 2 * MARGEN_RECORTE) * (w / 378), 0) + ENTRE_RECORTES * (c.partes.length - 1)
  const altoPila = recortes.reduce((n, c) => n + altoFragmento(c), 0) + ENTRE_FRAGMENTOS * (recortes.length - 1)
  const altoMayor = Math.max(...recortes.map(altoFragmento))
  const altoCartas = (ids: readonly string[], a: number) => (ids.length ? Math.max(...ids.map((id) => altoCarta(id, a))) : 0)
  const fragmento = (c: CartaNombrada) => <FragmentoPeligro key={c.id} id={c.id} partes={c.partes} ancho={w} />
  const pila = <div className="ejemplo-fragmentos">{recortes.map(fragmento)}</div>
  const juntos = recortes.length * w + (recortes.length - 1) * SEPARACION_PIEZAS
  const lista: Forma[] = []

  // 1. Todo en una fila bajo el texto, en el orden en que lo nombra el texto.
  const restoFila = espacio - juntos - SEPARACION_PIEZAS
  const aFila = todas.length ? anchoCartasEjemplo(todas, restoFila, SEPARACION_PIEZAS) : CARTA_EJEMPLO
  if (juntos <= espacio && aFila >= CARTA_EJEMPLO_MINIMA) {
    lista.push({
      alto: altoTexto(texto, espacio) + DEBAJO + Math.max(altoMayor, altoCartas(todas, aFila)),
      dibujo: <div className="ejemplo-piezas una-fila">{b.cartas.map((c) => (seRecorta(c) ? fragmento(c) : <Miniatura key={c.id} id={c.id} ancho={aFila} />))}</div>,
    })
  }

  // 2. Bajo el texto, los recortes uno encima de otro y las cartas en una fila a su lado.
  const aColumna = todas.length ? anchoCartasEjemplo(todas, espacio - w - SEPARACION_PIEZAS, SEPARACION_PIEZAS) : 0
  if (todas.length && aColumna >= CARTA_EJEMPLO_MINIMA) {
    lista.push({
      alto: altoTexto(texto, espacio) + DEBAJO + Math.max(altoPila, altoCartas(todas, aColumna)),
      dibujo: (
        <div className="ejemplo-piezas columnas">
          {pila}
          <FilaCartas ids={todas} ancho={aColumna} />
        </div>
      ),
    })
  }

  // 3. Los recortes al lado del texto, y las cartas debajo del texto: tan grandes como quepan, pero sin pasar del alto
  //    de los recortes si así el recuadro queda más bajo (sin bajar de 24 mm).
  const anchoTexto = espacio - w - AL_LADO
  const aLado = todas.length ? anchoCartasEjemplo(todas, anchoTexto) : 0
  if (anchoTexto >= TEXTO_MINIMO && (!todas.length || aLado >= CARTA_EJEMPLO_MINIMA)) {
    const alto = altoTexto(texto, anchoTexto)
    let a = aLado
    if (todas.length) {
      const proporcionAlto = Math.max(...todas.map((id) => altoCarta(id, 1)))
      a = Math.max(CARTA_EJEMPLO_MINIMA, Math.min(aLado, (altoPila - alto - DEBAJO) / proporcionAlto))
    }
    lista.push({
      alto: Math.max(alto + (todas.length ? DEBAJO + altoCartas(todas, a) : 0), altoPila),
      alLado: true,
      dibujo: (
        <>
          <div className="ejemplo-columna">
            <div className="md ejemplo-texto" dangerouslySetInnerHTML={{ __html: b.html }} />
            {todas.length > 0 && <FilaCartas ids={todas} ancho={a} />}
          </div>
          {pila}
        </>
      ),
    })
  }

  // 4. Si nada de lo anterior cabe: los recortes en una fila (o uno encima de otro) y las cartas, en otra.
  if (lista.length === 0) {
    let ids = todas
    while (ids.length > 1 && anchoCartasEjemplo(ids, espacio) < CARTA_EJEMPLO_MINIMA) ids = ids.slice(0, -1)
    const a = anchoCartasEjemplo(ids, espacio)
    lista.push({
      alto: altoTexto(texto, espacio) + DEBAJO + (juntos <= espacio ? altoMayor : altoPila) + (ids.length ? SEPARACION_PIEZAS + altoCartas(ids, a) : 0),
      dibujo: (
        <div className="ejemplo-piezas filas">
          <div className={`ejemplo-fragmentos ${juntos <= espacio ? 'juntos' : ''}`}>{recortes.map(fragmento)}</div>
          {ids.length > 0 && <FilaCartas ids={ids} ancho={a} />}
        </div>
      ),
    })
  }
  return lista
}

export function Ejemplo({ b }: { b: Bloque & { tipo: 'ejemplo' } }) {
  const ref = useRef<HTMLDivElement>(null)
  const [medidas, setMedidas] = useState<Medidas | null>(null)
  // La primera vez se dibujan los recortes para medirlos: su letra (la más pequeña decide su ancho) y el alto de cada parte.
  useLayoutEffect(() => {
    if (medidas) return
    const fragmentos = [...(ref.current?.querySelectorAll<HTMLElement>('.fragmento') ?? [])]
    if (fragmentos.length === 0) return
    const partes: Record<string, number> = {}
    let letra = Infinity
    for (const f of fragmentos) {
      const carta = f.querySelector('.card')
      if (!carta) continue
      letra = Math.min(letra, letraDeCarta(carta))
      for (const r of f.querySelectorAll<HTMLElement>('.recorte')) {
        const parte = r.dataset.parte as ParteCarta
        const el = carta.querySelector<HTMLElement>(selectorParte(parte))
        if (el) partes[`${f.dataset.carta}:${parte}`] = el.offsetHeight
      }
    }
    setMedidas({ letra, partes })
  }, [medidas])

  const recortes = b.cartas.filter(seRecorta)
  let piezas: ReactNode = null
  let alLado = false
  if (recortes.length === 0) {
    // Una carta, al lado del texto; varias, en una fila debajo.
    let ids = b.cartas.map((c) => c.id)
    while (ids.length > 1 && anchoCartasEjemplo(ids) < CARTA_EJEMPLO_MINIMA) ids = ids.slice(0, -1)
    alLado = ids.length === 1
    if (ids.length > 0) piezas = <FilaCartas ids={ids} ancho={anchoCartasEjemplo(ids)} className={alLado ? 'una' : 'fila'} />
  } else if (!medidas) {
    // Para medir.
    piezas = <div className="ejemplo-fragmentos">{recortes.map((c) => <FragmentoPeligro key={c.id} id={c.id} partes={c.partes} ancho={80} />)}</div>
  } else {
    // La forma más baja, con los recortes a su tamaño legible; más pequeños (letra mínima) solo si así baja bastante.
    const legible = anchoLegible(medidas.letra, ANCHO_EJEMPLO_PAGINA, LETRA_LEGIBLE)
    const minimo = anchoLegible(medidas.letra, ANCHO_EJEMPLO_PAGINA, LETRA_MINIMA)
    const candidatas = [...formas(b, medidas, legible), ...(minimo < legible ? formas(b, medidas, minimo).map((f) => ({ ...f, alto: f.alto + PREFERIR_LEGIBLE })) : [])]
    const mejor = candidatas.reduce((x, y) => (y.alto < x.alto - 0.5 ? y : x))
    if (mejor.alLado) {
      return (
        <div className={`ejemplo ancho con-recortes ${b.pasos ? 'con-pasos' : ''}`} ref={ref}>
          <Cabecera b={b} />
          <div className="ejemplo-cuerpo al-lado">{mejor.dibujo}</div>
        </div>
      )
    }
    piezas = mejor.dibujo
  }
  return (
    <div className={`ejemplo ${b.pasos ? 'con-pasos' : ''} ${recortes.length > 0 ? 'ancho con-recortes' : ''}`} ref={ref}>
      <Cabecera b={b} />
      <div className="ejemplo-cuerpo">
        {alLado && piezas}
        <div className="md ejemplo-texto" dangerouslySetInnerHTML={{ __html: b.html }} />
        {!alLado && piezas}
      </div>
    </div>
  )
}

function Cabecera({ b }: { b: Bloque & { tipo: 'ejemplo' } }) {
  return (
    <div className="ejemplo-cabecera">
      <span className="ejemplo-etiqueta">Ejemplo</span>
      {b.titulo && <span className="ejemplo-titulo">{b.titulo}</span>}
    </div>
  )
}
