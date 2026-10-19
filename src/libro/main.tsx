// Página de un libro del reglamento: dibuja el libro entero con React, lo reparte en páginas A4 con Paged.js y lo
// enseña como un libro (a doble página en pantallas anchas). Con «?imprimir» se prepara para sacar el PDF.

import { Previewer } from 'pagedjs'
import { StrictMode } from 'react'
import { flushSync } from 'react-dom'
import { createRoot } from 'react-dom/client'
import fuente from '../../docs/reglamento-v1.0.md?raw'
import '../estilos/fuentes.ts'
import { Barra } from './Barra.tsx'
import { leerReglamento, type LibroId } from './fuente.ts'
import { Libro, TITULO } from './Libro.tsx'
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
    const cabecera = pagina.querySelector('.cabecera-capitulo, .creditos > .titulo-preliminar')
    if (!contenido || !cabecera) continue
    if (cabecera.getBoundingClientRect().top - contenido.getBoundingClientRect().top < 40) pagina.classList.add('pagina-de-apertura')
  }
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

  // Paged.js reparte una copia estática del libro; React ya no la toca.
  const contenido = document.createDocumentFragment()
  for (const nodo of [...origen.childNodes]) contenido.append(nodo.cloneNode(true))
  raiz.unmount()
  origen.remove()

  const previsor = new Previewer()
  const flujo = await previsor.preview(contenido, [{ [new URL('paginas.css', window.location.href).href]: paginas }], destino)
  window.__libroPaginas = flujo.total
  cerrarCadenas()
  marcarAperturas()
  if (libro === 'referencia') indiceLateral()
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
