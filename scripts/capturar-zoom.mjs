// Capturas de la carta ampliada junto a su carta de la mesa: una carta en cada esquina de la mesa, una de la mano, una
// del muelle, una misión, el Peligro y el Destino, en 1440×900 y 1920×1080, y con el dedo en una tableta (1024×768).
// Comprueba en cada una que la ampliación está pegada a la carta, dentro de la pantalla, sin taparla, y que sus
// explicaciones van por el lado libre. Las deja en capturas/zoom/.
//
//   npm run capturas:zoom              (compila y captura)
//   node scripts/capturar-zoom.mjs     (sin compilar; usa dist/)

import { mkdir } from 'node:fs/promises'
import { chromium } from 'playwright'
import { preview } from 'vite'

const destino = new URL('../capturas/zoom/', import.meta.url)
await mkdir(destino, { recursive: true })

const TAMANOS = [
  ['1440x900', 1440, 900],
  ['1920x1080', 1920, 1080],
]

// Qué carta ampliar en cada escena. `elegir` recibe todas las cartas que casan y devuelve la que toca.
const OBJETIVOS = {
  puerto: [
    { nombre: 'arriba-izquierda-tripulante', selector: '.zona-tripulacion .tripulante .carta-mesa', elegir: 'primera' },
    { nombre: 'arriba-derecha-barco', selector: '.zona-barco .carta-mesa', elegir: 'primera' },
    { nombre: 'abajo-izquierda-mano', selector: '.mano .carta-mesa', elegir: 'primera' },
    { nombre: 'abajo-derecha-mazos', selector: '.mazos .carta-mesa', elegir: 'ultima' },
    { nombre: 'mano-centro', selector: '.mano .carta-mesa', elegir: 'centro' },
    { nombre: 'muelle', selector: '.muelle .carta-mesa', elegir: 'primera' },
    { nombre: 'mision', selector: '.misiones .carta-mesa', elegir: 'ultima' },
    { nombre: 'abajo-izquierda-tripulante', selector: '.zona-tripulacion .tripulante .carta-mesa', elegir: 'ultima' },
  ],
  prueba: [
    { nombre: 'peligro', selector: '.hueco-encuentro .carta-mesa', elegir: 'primera' },
    { nombre: 'destino', selector: '.destino-ventana', elegir: 'primera' },
    { nombre: 'mision-en-curso', selector: '.zona-mision .carta-mesa', elegir: 'primera' },
    { nombre: 'tripulante-agotado', selector: '.zona-tripulacion .carta-mesa.agotada, .zona-tripulacion .carta-mesa', elegir: 'primera' },
  ],
}

const servidor = await preview({ logLevel: 'error', preview: { port: 5197 } })
const raiz = servidor.resolvedUrls?.local[0]
if (!raiz) throw new Error('El servidor no ha arrancado')
const base = new URL('seascroundels/', raiz).href

const navegador = await chromium.launch()
const errores = []
const fallos = []
const notas = []
const hechas = []

async function abrir(contexto, tamano, escena) {
  const pagina = await contexto.newPage()
  pagina.on('pageerror', (e) => errores.push(`${tamano} ${escena}: ${e.message}`))
  pagina.on('console', (m) => m.type() === 'error' && errores.push(`${tamano} ${escena}: ${m.text()}`))
  await pagina.goto(`${base}#/escena/${escena}`, { waitUntil: 'networkidle' })
  await pagina.evaluate(() => document.fonts.ready)
  await pagina.waitForTimeout(900)
  return pagina
}

/** La carta que toca, de las que casan con el selector (visibles). */
async function localizar(pagina, { selector, elegir }) {
  const todas = pagina.locator(selector)
  const n = await todas.count()
  if (n === 0) return null
  if (elegir === 'ultima') return todas.nth(n - 1)
  if (elegir === 'centro') return todas.nth(Math.floor((n - 1) / 2))
  return todas.first()
}

/** Comprueba la ampliación abierta respecto a su carta: dentro, pegada, sin taparla y con las ayudas por el lado libre. */
async function comprobar(pagina, original, que) {
  const r = await original.evaluate((el) => {
    const caja = (e) => {
      const b = e.getBoundingClientRect()
      return { x: b.left, y: b.top, d: b.right, a: b.bottom }
    }
    // La carta tal y como se ve: si está girada (agotada), la girada.
    const o = caja(el.querySelector(':scope > .carta-giro') ?? el)
    const capa = document.querySelector('.capa-zoom')
    const carta = capa?.querySelector(':scope > .zoom-carta')
    const ayudas = capa?.querySelector(':scope > .zoom-ayudas')
    const lienzo = document.querySelector('.lienzo')
    const escala = lienzo ? lienzo.getBoundingClientRect().width / lienzo.offsetWidth : 1
    return {
      o,
      z: carta ? caja(carta) : null,
      y: ayudas ? caja(ayudas) : null,
      lado: capa?.getAttribute('data-lado') ?? null,
      ventana: { ancho: window.innerWidth, alto: window.innerHeight },
      escala,
    }
  })
  if (!r.z) return fallos.push(`${que}: no sale la ampliación`)
  const tol = 1.5
  const dentro = (c) => c.x >= -tol && c.y >= -tol && c.d <= r.ventana.ancho + tol && c.a <= r.ventana.alto + tol
  const cruza = (a, b) => a.x < b.d - tol && b.x < a.d - tol && a.y < b.a - tol && b.y < a.a - tol
  if (!dentro(r.z)) fallos.push(`${que}: la ampliación se sale de la pantalla ${JSON.stringify(r.z)}`)
  if (r.y && !dentro(r.y)) fallos.push(`${que}: las explicaciones se salen de la pantalla`)
  if (cruza(r.z, r.o)) fallos.push(`${que}: la ampliación tapa la carta original`)
  if (r.y && cruza(r.y, r.o)) fallos.push(`${que}: las explicaciones tapan la carta original`)
  if (r.y && cruza(r.y, r.z)) fallos.push(`${que}: las explicaciones pisan la ampliación`)
  // Pegada: a 12 unidades del lienzo de la carta por el lado elegido.
  const hueco = { derecha: r.z.x - r.o.d, izquierda: r.o.x - r.z.d, arriba: r.o.y - r.z.a, abajo: r.z.y - r.o.a }[r.lado]
  if (hueco === undefined || Math.abs(hueco - 12 * r.escala) > 2) fallos.push(`${que}: no está pegada a la carta (lado ${r.lado}, hueco ${hueco?.toFixed(1)})`)
  // Las explicaciones, por el lado libre (el contrario a la carta original). Si junto a la ampliación no caben, pueden ir
  // al otro lado de la carta original (sin taparla: eso ya se ha comprobado).
  const haciaLaCarta = r.y && ((r.lado === 'derecha' && r.y.d <= r.z.x + tol) || (r.lado === 'izquierda' && r.y.x >= r.z.d - tol))
  if (haciaLaCarta) {
    const alOtroLado = r.lado === 'derecha' ? r.y.d <= r.o.x + tol : r.y.x >= r.o.d - tol
    if (alOtroLado) notas.push(`${que}: las explicaciones no caben junto a la ampliación y van al otro lado de la carta`)
    else fallos.push(`${que}: las explicaciones no van por el lado libre`)
  }
  return r
}

try {
  for (const [tamano, ancho, alto] of TAMANOS) {
    const contexto = await navegador.newContext({ viewport: { width: ancho, height: alto } })
    for (const [escena, objetivos] of Object.entries(OBJETIVOS)) {
      const p = await abrir(contexto, tamano, escena)
      for (const objetivo of objetivos) {
        const carta = await localizar(p, objetivo)
        const que = `${tamano} ${escena} ${objetivo.nombre}`
        if (!carta) {
          fallos.push(`${que}: no hay ninguna carta «${objetivo.selector}»`)
          continue
        }
        await p.mouse.move(2, 2)
        await p.waitForTimeout(150)
        // El ratón al centro de lo que se ve de la carta (sin desplazar la página, como haría `hover`).
        const b = await carta.boundingBox()
        await p.mouse.move(b.x + b.width / 2, Math.min(b.y + b.height / 2, b.y + Math.max(8, (alto - b.y) / 2)), { steps: 4 })
        await p.waitForTimeout(500)
        const r = await comprobar(p, carta, que)
        const ruta = new URL(`${escena}-${objetivo.nombre}-${tamano}.png`, destino).pathname
        await p.screenshot({ path: ruta })
        hechas.push(`${ruta}${r?.lado ? ` (${r.lado})` : ''}`)
      }
      await p.close()
    }
    await contexto.close()
  }

  // Con el dedo, en una tableta: tocar amplía; tocar la ampliación la cierra; tocar fuera también.
  const contexto = await navegador.newContext({ viewport: { width: 1024, height: 768 }, hasTouch: true })
  const p = await abrir(contexto, 'tableta', 'puerto')
  const capa = p.locator('.capa-zoom')
  const tripulante = p.locator('.zona-tripulacion .tripulante .carta-mesa').first()
  await tripulante.tap()
  await p.waitForTimeout(400)
  if ((await p.locator('.capa-zoom.tactil').count()) !== 1) fallos.push('tableta: tocar un Tripulante no lo amplía')
  else await comprobar(p, tripulante, 'tableta tripulante')
  let ruta = new URL('tableta-1024x768-tocar-tripulante.png', destino).pathname
  await p.screenshot({ path: ruta })
  hechas.push(ruta)
  await p.locator('.capa-zoom .zoom-carta').tap()
  await p.waitForTimeout(300)
  if ((await capa.count()) !== 0) fallos.push('tableta: tocar la ampliación no la cierra')
  const mano = p.locator('.mano .carta-mesa').last()
  await mano.tap()
  await p.waitForTimeout(400)
  if ((await capa.count()) !== 1) fallos.push('tableta: tocar una carta de la mano no la amplía')
  else await comprobar(p, mano, 'tableta mano')
  ruta = new URL('tableta-1024x768-tocar-mano.png', destino).pathname
  await p.screenshot({ path: ruta })
  hechas.push(ruta)
  await p.locator('.barra-turno').tap()
  await p.waitForTimeout(300)
  if ((await capa.count()) !== 0) fallos.push('tableta: tocar fuera no cierra la ampliación')
  await p.close()
  await contexto.close()

  console.log(hechas.join('\n'))
  console.log(errores.length ? `Errores en la consola:\n${errores.join('\n')}` : 'Sin errores en la consola')
  if (notas.length) console.log(`Notas:\n${notas.join('\n')}`)
  console.log(fallos.length ? `Fallos:\n${fallos.join('\n')}` : 'Todas las ampliaciones bien colocadas')
  if (fallos.length || errores.length) process.exitCode = 1
} finally {
  await navegador.close()
  await new Promise((ok) => servidor.httpServer.close(ok))
}
