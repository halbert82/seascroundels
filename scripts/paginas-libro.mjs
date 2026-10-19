// Herramienta de revisión: fotografía todas las páginas de un libro del reglamento (sin compilar; usa dist/) y las
// deja en una carpeta, más una hoja con todas en miniatura.
//
//   node scripts/paginas-libro.mjs aprende|referencia <carpeta> [escala] [páginas: 3,14,15]

import { mkdir } from 'node:fs/promises'
import { chromium } from 'playwright'
import sharp from 'sharp'
import { preview } from 'vite'

const [libro = 'aprende', carpeta = 'capturas/paginas', escala = '1', solo = ''] = process.argv.slice(2)
const fichero = libro === 'aprende' ? 'aprende-a-jugar' : 'referencia-de-reglas'
const soloEstas = new Set(solo.split(',').filter(Boolean).map(Number))
await mkdir(carpeta, { recursive: true })

const servidor = await preview({ logLevel: 'error', preview: { port: 5198 }, ...(process.env.DIST ? { build: { outDir: process.env.DIST } } : {}) })
const raiz = servidor.resolvedUrls?.local[0]
const base = raiz.endsWith('/seascroundels/') ? raiz : new URL('seascroundels/', raiz).href
const navegador = await chromium.launch()
try {
  const pagina = await navegador.newPage({ viewport: { width: 1100, height: 1400 }, deviceScaleFactor: Number(escala) })
  pagina.on('pageerror', (e) => console.log('ERROR', e.message))
  await pagina.goto(`${base}reglamento/${fichero}.html?imprimir`, { waitUntil: 'networkidle' })
  await pagina.waitForFunction(() => window.__libroListo === true, null, { timeout: 180_000 })
  await pagina.evaluate(() => document.fonts.ready)
  await pagina.waitForTimeout(400)
  const n = await pagina.locator('.pagedjs_page').count()
  const miniaturas = []
  for (let i = 0; i < n; i++) {
    if (soloEstas.size && !soloEstas.has(i + 1)) continue
    const buf = await pagina.locator('.pagedjs_page').nth(i).screenshot()
    await sharp(buf).png().toFile(`${carpeta}/${String(i + 1).padStart(2, '0')}.png`)
    miniaturas.push(await sharp(buf).resize(300).png().toBuffer())
  }
  if (!soloEstas.size) {
    const meta = await sharp(miniaturas[0]).metadata()
    const cols = 8
    const filas = Math.ceil(miniaturas.length / cols)
    await sharp({ create: { width: 300 * cols, height: meta.height * filas, channels: 3, background: '#333' } })
      .composite(miniaturas.map((b, i) => ({ input: b, left: (i % cols) * 300, top: Math.floor(i / cols) * meta.height })))
      .png()
      .toFile(`${carpeta}/hoja.png`)
  }
  console.log(`${n} páginas`)
} finally {
  await navegador.close()
  await new Promise((ok) => servidor.httpServer.close(ok))
}
