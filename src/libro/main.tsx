// Página de un libro del reglamento: dibuja el libro entero con React, lo reparte en páginas A4 con Paged.js y lo
// enseña como un libro (a doble página en pantallas anchas). Con «?imprimir» se prepara para sacar el PDF.

import { Previewer, registerHandlers } from 'pagedjs'
import { StrictMode } from 'react'
import { flushSync } from 'react-dom'
import { createRoot } from 'react-dom/client'
import fuente from '../../docs/reglamento-v1.0.md?raw'
import '../estilos/fuentes.ts'
import { LAMINAS, VINETAS } from './arte.ts'
import { CortesDePagina } from './cortes.ts'
import { Barra } from './Barra.tsx'
import { leerReglamento, type LibroId } from './fuente.ts'
import { Libro, TITULO } from './Libro.tsx'
import { cortarRecortes } from './piezas.tsx'
import { silabear } from './silabas.ts'
import { usarIlustracionesGrandes } from '../ui/cartas/vista.ts'
import './libro.css'
import paginas from './paginas.css?raw'

declare global {
  interface Window {
    /** El libro ya está repartido en páginas (lo espera el script que saca el PDF). */
    __libroListo?: boolean
    __libroPaginas?: number
  }
}

const libro = (document.body.dataset.libro === 'referencia' ? 'referencia' : 'aprende') satisfies LibroId
const imprimir = new URLSearchParams(window.location.search).has('imprimir')
document.body.classList.toggle('imprimir', imprimir)

/** Carga antes las tipografías: las cartas ajustan su texto midiéndolo. */
async function cargarTipografias(): Promise<void> {
  const muestra = 'AaÁáÉéÍíÓóÚúÑñ¿?¡!«»—★0123456789'
  const caras = [
    '400 16px "IM Fell English SC"',
    '400 16px Alegreya',
    'italic 400 16px Alegreya',
    '700 16px Alegreya',
    '900 16px Alegreya',
    '400 16px "Alegreya Sans"',
    'italic 400 16px "Alegreya Sans"',
    '700 16px "Alegreya Sans"',
    'italic 700 16px "Alegreya Sans"',
    '800 16px "Alegreya Sans"',
    '900 16px "Alegreya Sans"',
    '700 16px "Alegreya Sans SC"',
    '800 16px "Alegreya Sans SC"',
  ]
  await Promise.all(caras.map((c) => document.fonts.load(c, muestra).catch(() => [])))
}

/** Espera a que carguen las imágenes del libro (las ilustraciones de la cubierta). */
async function cargarImagenes(raiz: HTMLElement): Promise<void> {
  const imagenes = [...raiz.querySelectorAll('img')]
  await Promise.all(imagenes.map((img) => (img.complete ? Promise.resolve() : new Promise<void>((ok) => img.addEventListener('load', () => ok(), { once: true })))))
}

/** En pantalla, el libro se escala para caber a lo ancho (a doble página si cabe). */
function ajustarZoom(): void {
  const paginasEl = document.querySelector<HTMLElement>('.pagedjs_pages')
  if (!paginasEl || imprimir) return
  const anchoPagina = 210 * (96 / 25.4)
  const doble = window.innerWidth >= 900
  document.body.classList.toggle('doble', doble)
  const ancho = (doble ? 2 : 1) * anchoPagina + 48
  const zoom = Math.min(1.25, (window.innerWidth - 24) / ancho)
  paginasEl.style.setProperty('zoom', String(zoom))
}

/**
 * Paged.js guarda el texto de las cabeceras («string-set») sin la comilla de cierre; Chromium ya no acepta esa
 * cadena abierta si va seguida de más texto («Libro · Sección»), así que la cerramos.
 */
function cerrarCadenas(): void {
  for (const pagina of document.querySelectorAll<HTMLElement>('.pagedjs_page')) {
    for (const prop of Array.from(pagina.style)) {
      if (!prop.startsWith('--pagedjs-string-')) continue
      const valor = pagina.style.getPropertyValue(prop)
      if (valor.startsWith('"') && !/[^\\]"$/.test(valor)) pagina.style.setProperty(prop, `${valor}"`)
    }
  }
}

/** Páginas que empiezan con el título de un capítulo: sin cabecera corrida. */
function marcarAperturas(): void {
  for (const pagina of document.querySelectorAll<HTMLElement>('.pagedjs_page')) {
    const contenido = pagina.querySelector('.pagedjs_page_content')
    const cabecera = pagina.querySelector('.inicio-capitulo, .cabecera-capitulo, .creditos > .titulo-preliminar')
    if (!contenido || !cabecera) continue
    if (cabecera.getBoundingClientRect().top - contenido.getBoundingClientRect().top < 40) pagina.classList.add('pagina-de-apertura')
  }
}

/**
 * Láminas: en una página que queda en blanco porque lo que sigue empieza en página par, una ilustración a página entera
 * (ver LAMINAS en arte.ts) en vez de la rosa de los vientos.
 */
function laminas(): void {
  const paginas = [...document.querySelectorAll<HTMLElement>('.pagedjs_page')]
  paginas.forEach((pagina, i) => {
    if (!pagina.classList.contains('pagedjs_blank_page')) return
    const siguiente = paginas[i + 1]
    const lamina = LAMINAS.find((l) => siguiente?.querySelector(l.antesDe))
    const hoja = pagina.querySelector<HTMLElement>('.pagedjs_sheet')
    if (!lamina || !hoja) return
    pagina.classList.add('con-lamina')
    const marco = document.createElement('div')
    marco.className = 'lamina'
    marco.dataset.arte = lamina.arte.nombre
    const img = document.createElement('img')
    img.src = lamina.arte.url
    img.alt = ''
    img.style.objectPosition = lamina.arte.encuadre
    marco.append(img)
    hoja.append(marco)
  })
}

/** Reparte una copia del libro en páginas (Paged.js) y devuelve cuántas salen. */
async function repartir(contenido: DocumentFragment, destino: HTMLElement): Promise<number> {
  const previsor = new Previewer()
  const flujo = await previsor.preview(contenido, [{ [new URL('paginas.css', window.location.href).href]: paginas }], destino)
  return flujo.total
}

/** Página de cada ancla a la que remite un número de página («pág. 12», «Tesoros²⁶», el índice). */
function paginasDeLasAnclas(destino: HTMLElement): Map<string, number> {
  const paginas = [...destino.querySelectorAll<HTMLElement>('.pagedjs_page')]
  const mapa = new Map<string, number>()
  for (const a of destino.querySelectorAll<HTMLAnchorElement>('a.num-pag, a.pagref')) {
    const id = decodeURIComponent((a.getAttribute('href') ?? '').slice(1))
    if (!id || mapa.has(id)) continue
    const destinoAncla = destino.querySelector(`[id="${CSS.escape(id)}"]`)
    const pagina = destinoAncla?.closest('.pagedjs_page')
    if (pagina) mapa.set(id, paginas.indexOf(pagina as HTMLElement) + 1)
  }
  return mapa
}

/**
 * Reparte el libro con sitio para los números de página de las remisiones («pág. 12», el número volado de «Tesoros²⁶»,
 * el índice). Paged.js los pone después de cortar cada página: al aparecer, alguna línea se alargaba y el final de la
 * página quedaba oculto, perdido (le pasó a «Escenario» en la Referencia). Así que antes de repartir se escribe en cada
 * uno «88», lo más ancho que puede ser un número de página de estos libros, y después se cambia por el de verdad: una
 * línea solo puede acortarse, nunca alargarse, así que nada se sale de su página. Una sola vuelta.
 */
async function repartirConNumeros(contenido: DocumentFragment, destino: HTMLElement): Promise<number> {
  for (const a of contenido.querySelectorAll<HTMLAnchorElement>('a.num-pag, a.pagref')) {
    a.textContent = '88'
    a.classList.add('pag-escrita')
  }
  const total = await repartir(contenido, destino)
  const numeros = paginasDeLasAnclas(destino)
  for (const a of destino.querySelectorAll<HTMLAnchorElement>('a.num-pag, a.pagref')) {
    const n = numeros.get(decodeURIComponent((a.getAttribute('href') ?? '').slice(1)))
    a.textContent = n === undefined ? '' : String(n)
  }
  return total
}

/** Milímetros en píxeles CSS. */
const MM = 96 / 25.4
/** Alto de una viñeta y lo que se separa de lo que haya encima y debajo (mm). */
const ALTO_VINETA = 36
const AIRE_VINETA = 5

/**
 * Viñetas en la columna exterior: en cada página de texto cuya columna exterior quede libre en más de la mitad de su
 * alto, una ilustración pequeña en el hueco libre más grande. Ninguna ilustración se repite en dos páginas seguidas
 * (las cabeceras de los capítulos también cuentan), y una viñeta no repite la ilustración de una carta de su doble
 * página. El ejemplo de juego a doble página no lleva.
 */
function vinetas(): void {
  const paginas = [...document.querySelectorAll<HTMLElement>('.pagedjs_page')]
  const usadas = paginas.map((p) => new Set([...p.querySelectorAll<HTMLElement>('[data-arte]')].map((e) => e.dataset.arte ?? '')))
  // Las ilustraciones de las cartas dibujadas (ejemplos, diagramas): una viñeta no las repite en su doble página.
  const deCartas = paginas.map((p) => new Set([...p.querySelectorAll<HTMLElement>('[data-arte-carta]')].map((e) => e.dataset.arteCarta ?? '')))
  let turno = 0
  paginas.forEach((pagina, i) => {
    if (!pagina.querySelector('.capitulo .flujo, .referencia .flujo')) return
    if (pagina.querySelector('.ejemplo-de-juego, .contraportada, .creditos')) return
    const area = pagina.querySelector<HTMLElement>('.pagedjs_page_content')
    if (!area) return
    const a = area.getBoundingClientRect()
    const lateral = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--lateral')) * MM || 46 * MM
    const derecha = pagina.classList.contains('pagedjs_right_page')
    const x0 = derecha ? a.right - lateral : a.left
    const x1 = x0 + lateral
    // Lo que ya ocupa la columna exterior (notas, consejos, lo ancho…), con algo de aire.
    const ocupado = [...area.querySelectorAll<HTMLElement>('.flujo > *, .nota-tema, .consejo, .cartas-lado, .ancho, .vease')]
      .map((e) => e.getBoundingClientRect())
      .filter((r) => r.height > 0 && r.right > x0 + MM && r.left < x1 - MM)
      .map((r) => [Math.max(a.top, r.top - AIRE_VINETA * MM), Math.min(a.bottom, r.bottom + AIRE_VINETA * MM)] as const)
      .sort((p, q) => p[0] - q[0])
    const libres: [number, number][] = []
    let desde = a.top
    for (const [arriba, abajo] of ocupado) {
      if (arriba > desde) libres.push([desde, arriba])
      desde = Math.max(desde, abajo)
    }
    if (a.bottom > desde) libres.push([desde, a.bottom])
    const libre = libres.reduce((n, [p, q]) => n + (q - p), 0)
    const hueco = libres.reduce<[number, number] | null>((m, h) => (!m || h[1] - h[0] > m[1] - m[0] ? h : m), null)
    const alto = ALTO_VINETA * MM
    if (libre <= a.height / 2 || !hueco || hueco[1] - hueco[0] < alto) return
    // Junto al texto: si la página acaba antes, el hueco se corta donde acaba el texto (si así sigue cabiendo).
    const finTexto = Math.max(...[...area.querySelectorAll<HTMLElement>('.flujo > *')].map((e) => e.getBoundingClientRect().bottom), a.top)
    const junto: [number, number] = [hueco[0], Math.min(hueco[1], finTexto)]
    const sitio: [number, number] = junto[1] - junto[0] >= alto ? junto : [hueco[0], hueco[0] + alto]
    // Una ilustración que no esté en esta página ni en las de al lado (cabeceras y viñetas), ni en una carta de su doble
    // página (la par, a la izquierda, con la impar que la sigue).
    const pareja = pagina.classList.contains('pagedjs_left_page') ? i + 1 : i - 1
    const vecinas = new Set([...(usadas[i - 1] ?? []), ...(usadas[i] ?? []), ...(usadas[i + 1] ?? []), ...(deCartas[i] ?? []), ...(deCartas[pareja] ?? [])])
    for (let k = 0; k < VINETAS.length; k++) {
      const arte = VINETAS[(turno + k) % VINETAS.length]
      if (!arte || vecinas.has(arte.nombre)) continue
      turno = (turno + k + 1) % VINETAS.length
      usadas[i]?.add(arte.nombre)
      const vineta = document.createElement('div')
      vineta.className = 'vineta'
      vineta.dataset.arte = arte.nombre
      // Paged.js da a lo que cuelga de la página su alto entero (con !important): el de la viñeta va aquí.
      vineta.style.setProperty('height', `${ALTO_VINETA}mm`, 'important')
      vineta.style.left = `${x0 - a.left}px`
      vineta.style.top = `${(sitio[0] + sitio[1]) / 2 - alto / 2 - a.top}px`
      const img = document.createElement('img')
      img.src = arte.url
      img.alt = ''
      img.style.objectPosition = arte.encuadre
      vineta.append(img)
      if (getComputedStyle(area).position === 'static') area.style.position = 'relative'
      area.append(vineta)
      return
    }
  })
}

/** Referencia de reglas: pestañas con las letras en el borde exterior, con la de la página resaltada. */
function indiceLateral(): void {
  const paginas = [...document.querySelectorAll<HTMLElement>('.pagedjs_page')]
  const letras = [...new Set([...document.querySelectorAll<HTMLElement>('.letra-texto')].map((l) => l.textContent ?? ''))]
  let actual = ''
  for (const pagina of paginas) {
    const primera = pagina.querySelector<HTMLElement>('.entrada')
    if (primera) actual = primera.dataset.letra ?? actual
    if (!actual || pagina.querySelector('.contraportada, .creditos') || !pagina.querySelector('.entrada, .referencia')) continue
    const tira = document.createElement('div')
    tira.className = 'pestanas-letras'
    for (const l of letras) {
      const span = document.createElement('span')
      span.textContent = l
      if (l === actual) span.className = 'actual'
      tira.append(span)
    }
    pagina.querySelector('.pagedjs_sheet')?.append(tira)
  }
}

async function principal(): Promise<void> {
  document.title = `${TITULO[libro]} · Sea Scoundrels`
  const barra = document.getElementById('barra')
  if (barra && !imprimir) createRoot(barra).render(<Barra libro={libro} />)

  await cargarTipografias()
  usarIlustracionesGrandes()
  const reglamento = leerReglamento(fuente)
  const origen = document.getElementById('origen')
  const destino = document.getElementById('paginas')
  if (!origen || !destino) throw new Error('Faltan los contenedores del libro')

  const raiz = createRoot(origen)
  flushSync(() =>
    raiz.render(
      <StrictMode>
        <Libro r={reglamento} libro={libro} />
      </StrictMode>,
    ),
  )
  await cargarImagenes(origen)
  await new Promise((ok) => requestAnimationFrame(() => ok(null)))
  cortarRecortes(origen)
  silabear(origen)

  // Paged.js reparte una copia estática del libro; React ya no la toca.
  const contenido = document.createDocumentFragment()
  for (const nodo of [...origen.childNodes]) contenido.append(nodo.cloneNode(true))
  raiz.unmount()
  origen.remove()

  registerHandlers(CortesDePagina)
  window.__libroPaginas = await repartirConNumeros(contenido, destino)
  cerrarCadenas()
  marcarAperturas()
  if (libro === 'referencia') indiceLateral()
  laminas()
  vinetas()
  await cargarImagenes(destino)
  document.getElementById('cargando')?.remove()
  ajustarZoom()
  window.addEventListener('resize', ajustarZoom)
  // Si se entra con un ancla («#r-destino»), se va a ella cuando ya hay páginas.
  if (window.location.hash) document.getElementById(decodeURIComponent(window.location.hash.slice(1)))?.scrollIntoView()
  window.__libroListo = true
}

principal().catch((e: unknown) => {
  const aviso = document.getElementById('cargando')
  if (aviso) aviso.textContent = `No se ha podido maquetar el libro: ${e instanceof Error ? e.message : String(e)}`
  throw e
})
