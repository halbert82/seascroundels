// Saca los dos libros del reglamento en PDF a partir de la web compilada (Paged.js los reparte en páginas A4 y el
// Chromium de Playwright los imprime), y unas capturas de páginas de muestra para revisarlos.
//
//   npm run reglamento                     compila la web, saca los PDF y las capturas
//   node scripts/reglamento.mjs            lo mismo, sin compilar (usa dist/)
//   node scripts/reglamento.mjs --solo-pdf solo los PDF (lo usa la publicación en GitHub Pages)
//
// Los PDF quedan en dist/reglamento/ (se publican con la web) y una copia en capturas/reglamento/, con las capturas.

import { copyFile, mkdir } from 'node:fs/promises'
import { chromium } from 'playwright'
import sharp from 'sharp'
import { preview } from 'vite'

const LIBROS = [
  { id: 'aprende', fichero: 'aprende-a-jugar' },
  { id: 'referencia', fichero: 'referencia-de-reglas' },
]
const soloPdf = process.argv.includes('--solo-pdf')

const dist = new URL('../dist/reglamento/', import.meta.url)
const capturas = new URL('../capturas/reglamento/', import.meta.url)
await mkdir(dist, { recursive: true })
await mkdir(capturas, { recursive: true })

const servidor = await preview({ logLevel: 'error', preview: { port: 5197 } })
const raiz = servidor.resolvedUrls?.local[0]
if (!raiz) throw new Error('El servidor no ha arrancado')
// La vista previa ya sirve la web en /seascroundels/ (la ruta base de GitHub Pages).
const base = raiz.endsWith('/seascroundels/') ? raiz : new URL('seascroundels/', raiz).href

/** Índice (desde 0) de la primera página que contiene el selector. */
async function paginaCon(pagina, selector, condicion = 'cualquiera') {
  return pagina.evaluate(
    ([sel, cond]) => {
      const paginas = [...document.querySelectorAll('.pagedjs_page')]
      if (cond === 'doble') {
        // Una doble página (par a la izquierda, impar a la derecha) con nota temática y ejemplo.
        for (let i = 1; i + 1 < paginas.length; i += 2) {
          const dos = [paginas[i], paginas[i + 1]]
          const nota = dos.some((p) => p.querySelector('.nota-tema:not(.pendiente)'))
          const ejemplo = dos.some((p) => p.querySelector('.ejemplo'))
          if (nota && ejemplo) return i
        }
        return -1
      }
      if (cond === 'texto') return paginas.findIndex((p) => [...p.querySelectorAll('.nota-tema, p, li')].some((e) => e.textContent?.replace(/\u00AD/g, '').includes(sel)))
      return paginas.findIndex((p) => p.querySelector(sel))
    },
    [selector, condicion],
  )
}

async function capturaDePagina(pagina, indice) {
  return pagina.locator('.pagedjs_page').nth(indice).screenshot()
}

/** Doble página: la par a la izquierda y la impar a la derecha, como un libro abierto. */
async function dobleDesde(pagina, indice) {
  const izquierda = indice % 2 === 1 ? indice : indice - 1
  const [a, b] = [await capturaDePagina(pagina, izquierda), await capturaDePagina(pagina, izquierda + 1)]
  const meta = await sharp(a).metadata()
  return sharp({ create: { width: (meta.width ?? 0) * 2, height: meta.height ?? 0, channels: 3, background: '#fbf7ec' } })
    .composite([
      { input: a, left: 0, top: 0 },
      { input: b, left: meta.width ?? 0, top: 0 },
    ])
    .png()
    .toBuffer()
}

async function guardar(nombre, datos) {
  const ruta = new URL(nombre, capturas).pathname
  await sharp(datos).png().toFile(ruta)
  console.log(`  ${ruta}`)
}

async function capturar(pagina, libro) {
  if (libro.id === 'aprende') {
    await guardar('1-portada.png', await capturaDePagina(pagina, 0))
    await guardar('2-componentes.png', await capturaDePagina(pagina, await paginaCon(pagina, '#a-componentes')))
    await guardar('3-anatomia.png', await capturaDePagina(pagina, await paginaCon(pagina, '.anatomia-tripulante')))
    await guardar('4-aprende-a-jugar-doble-pagina.png', await dobleDesde(pagina, await paginaCon(pagina, '', 'doble')))
    await guardar('5-prueba.png', await capturaDePagina(pagina, await paginaCon(pagina, '.prueba-flujo')))
    await guardar('7-ejemplo-de-juego-doble-pagina.png', await dobleDesde(pagina, await paginaCon(pagina, '.ejemplo-de-juego')))
    await guardar('8-contraportada.png', await capturaDePagina(pagina, (await pagina.locator('.pagedjs_page').count()) - 1))
    await guardar('9-el-turno.png', await capturaDePagina(pagina, await paginaCon(pagina, '.turno')))
    await guardar('10-cabecera-de-capitulo.png', await capturaDePagina(pagina, await paginaCon(pagina, '#a-las-misiones')))
    await guardar('11-anatomia-mision.png', await capturaDePagina(pagina, await paginaCon(pagina, '.anatomia-mision')))
    await guardar('12-el-turno-doble-pagina.png', await dobleDesde(pagina, await paginaCon(pagina, '.turno')))
    for (const tipo of ['puerto', 'mision', 'peligro']) await guardar(`13-anatomia-${tipo}-de-cerca.png`, await pagina.locator(`.anatomia-${tipo} .anatomia-cartas`).screenshot())
    await guardar('14-ejemplo-de-juego-panel-de-la-mision.png', await pagina.locator('.panel-mision').screenshot())
    await guardar('17-nota-tematica-nueva.png', await capturaDePagina(pagina, await paginaCon(pagina, 'El Caribe de 1670 no tiene héroes', 'texto')))
    await guardar('18-mazos-de-inicio.png', await capturaDePagina(pagina, await paginaCon(pagina, '#a-mazos-de-inicio')))
  } else {
    await guardar('6-referencia-de-reglas-doble-pagina.png', await dobleDesde(pagina, await paginaCon(pagina, '#r-destino')))
    await guardar('15-ejemplo-dano-en-ciudad.png', await pagina.locator('.ejemplo', { hasText: 'Daño en Ciudad' }).screenshot())
    await guardar('16-dano-en-ciudad-pagina.png', await capturaDePagina(pagina, await paginaCon(pagina, '#r-dano')))
    await guardar('19-entrada-al-revelarse.png', await capturaDePagina(pagina, await paginaCon(pagina, '#r-al-revelarse')))
    await guardar('20-indice-de-terminos.png', await capturaDePagina(pagina, await paginaCon(pagina, '#indice-de-terminos')))
  }
}

// En Linux (la máquina que publica), Chromium redondea el ancho de las letras y las líneas no caen donde en el Mac en
// que se revisan los libros: sin ese redondeo, los PDF publicados salen como los revisados.
const navegador = await chromium.launch({ args: ['--font-render-hinting=none'] })
const errores = []
try {
  for (const libro of LIBROS) {
    const pagina = await navegador.newPage({ viewport: { width: 1100, height: 1400 }, deviceScaleFactor: soloPdf ? 1 : 1.6 })
    pagina.on('pageerror', (e) => errores.push(`${libro.fichero}: ${e.message}`))
    pagina.on('console', (m) => m.type() === 'error' && errores.push(`${libro.fichero}: ${m.text()}`))
    const url = `${base}reglamento/${libro.fichero}.html?imprimir`
    await pagina.goto(url, { waitUntil: 'networkidle' })
    if (process.env.DEPURAR) console.log(url, await pagina.title())
    await pagina.waitForFunction(() => window.__libroListo === true, null, { timeout: 180_000 })
    await pagina.evaluate(() => document.fonts.ready)
    await pagina.waitForTimeout(400)
    const total = await pagina.evaluate(() => window.__libroPaginas)
    const pdf = new URL(`${libro.fichero}.pdf`, dist)
    await pagina.pdf({ path: pdf.pathname, preferCSSPageSize: true, printBackground: true })
    await copyFile(pdf, new URL(`${libro.fichero}.pdf`, capturas))
    console.log(`${libro.fichero}.pdf: ${total} páginas`)
    if (!soloPdf) await capturar(pagina, libro)
    await pagina.close()
  }
  if (errores.length) {
    console.log(`Errores en la consola:\n${errores.join('\n')}`)
    process.exitCode = 1
  }
} finally {
  await navegador.close()
  await new Promise((ok) => servidor.httpServer.close(ok))
}
