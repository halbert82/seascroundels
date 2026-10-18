// Capturas de las explicaciones de la mesa (las fichas de Estado, Ventaja y misión al pasar el ratón o al pulsarlas,
// la ampliación de una carta con sus palabras de regla y la Referencia rápida), con ratón y con toque, en
// capturas/ayudas/. Comprueba que no hay errores en la consola.
//
//   npm run build && node scripts/capturar-ayudas.mjs
//   TAMANOS=1440 node scripts/capturar-ayudas.mjs

import { mkdir } from 'node:fs/promises'
import { chromium } from 'playwright'
import { preview } from 'vite'

const destino = new URL('../capturas/ayudas/', import.meta.url)
await mkdir(destino, { recursive: true })

const TAMANOS = {
  1440: ['1440x900', 1440, 900, false],
  1920: ['1920x1080', 1920, 1080, false],
  1024: ['tableta-1024x768', 1024, 768, true],
}
const elegidos = (process.env.TAMANOS ?? '1440,1920,1024').split(',').map((t) => TAMANOS[t.trim()]).filter(Boolean)

const servidor = await preview({ logLevel: 'error', preview: { port: 5199 } })
const raiz = servidor.resolvedUrls?.local[0]
if (!raiz) throw new Error('El servidor no ha arrancado')
const base = new URL('seascroundels/', raiz).href

const navegador = await chromium.launch()
const errores = []
const fallos = []

async function abrir(contexto, tamano, escena) {
  const pagina = await contexto.newPage()
  pagina.on('pageerror', (e) => errores.push(`${tamano} ${escena}: ${e.message}`))
  pagina.on('console', (m) => m.type() === 'error' && errores.push(`${tamano} ${escena}: ${m.text()}`))
  await pagina.goto(`${base}#/escena/${escena}`, { waitUntil: 'networkidle' })
  await pagina.evaluate(() => document.fonts.ready)
  await pagina.waitForTimeout(900)
  return pagina
}

async function foto(pagina, nombre) {
  await pagina.waitForTimeout(350)
  await pagina.screenshot({ path: new URL(`${nombre}.png`, destino).pathname })
}

/** La ventanita está abierta y dice lo que tiene que decir. */
async function comprobar(pagina, que, texto) {
  await pagina.waitForTimeout(300)
  const v = pagina.locator('.explicacion')
  if ((await v.count()) !== 1) return fallos.push(`${que}: no se abre la explicación`)
  const t = await v.innerText()
  if (!t.includes(texto)) fallos.push(`${que}: la explicación no dice «${texto}» (dice: ${t.slice(0, 80)}…)`)
}

try {
  for (const [tamano, ancho, alto, tactil] of elegidos) {
    const contexto = await navegador.newContext({ viewport: { width: ancho, height: alto }, hasTouch: tactil, isMobile: false })
    const pulsar = (loc) => (tactil ? loc.tap() : loc.click())

    // Estados y Ventajas de los Tripulantes y del Barco (escena «enJuego»).
    let p = await abrir(contexto, tamano, 'enJuego')
    if (!tactil) {
      await p.locator('.tripulante .estado-ficha', { hasText: 'Buscado' }).hover()
      await comprobar(p, `${tamano} ratón sobre Buscado`, 'Solo lo quita la Taberna')
      await foto(p, `estado-raton-${tamano}`)
      await p.mouse.move(5, 450)
      await p.waitForTimeout(200)
      if ((await p.locator('.explicacion').count()) !== 0) fallos.push(`${tamano}: la explicación no se cierra al salir con el ratón`)
    }
    await pulsar(p.locator('.zona-barco .estado-ficha', { hasText: 'Vía de agua' }))
    await comprobar(p, `${tamano} pulsar Vía de agua`, 'Astillero')
    await foto(p, `estado-barco-pulsado-${tamano}`)
    await p.keyboard.press('Escape')
    await p.waitForTimeout(250)
    if ((await p.locator('.explicacion').count()) !== 0) fallos.push(`${tamano}: Escape no cierra la explicación`)
    await pulsar(p.locator('.tripulante .estado-ficha.ventaja').first())
    await comprobar(p, `${tamano} pulsar una Ventaja`, 'La Taberna no quita las Ventajas')
    await foto(p, `ventaja-pulsada-${tamano}`)
    // Pulsar fuera la cierra.
    await pulsar(p.locator('.barra-turno'))
    await p.waitForTimeout(250)
    if ((await p.locator('.explicacion').count()) !== 0) fallos.push(`${tamano}: pulsar fuera no cierra la explicación`)

    // La ampliación de una carta de Peligro en juego, con sus palabras de regla al lado.
    const enJuego = p.locator('.en-juego .carta-mesa').first()
    if (tactil) await enJuego.dispatchEvent('contextmenu')
    else await enJuego.hover()
    await p.waitForTimeout(300)
    if ((await p.locator('.zoom-ayudas .tarjeta-ayuda').count()) === 0) fallos.push(`${tamano}: la ampliación no explica sus palabras de regla`)
    await foto(p, `ampliacion-${tamano}`)
    // La carta del encuentro nombra más cosas: van en dos columnas.
    const encuentro = p.locator('.hueco-encuentro .carta-mesa').first()
    if (tactil) {
      await p.locator('.barra-turno').tap()
      await encuentro.dispatchEvent('contextmenu')
    } else await encuentro.hover()
    await p.waitForTimeout(300)
    if ((await p.locator('.zoom-ayudas.dos-columnas').count()) === 0) fallos.push(`${tamano}: la ampliación del encuentro no sale en dos columnas`)
    await foto(p, `ampliacion-dos-columnas-${tamano}`)
    if (tactil) {
      await p.locator('.barra-turno').tap()
      await p.waitForTimeout(200)
      if ((await p.locator('.capa-zoom').count()) !== 0) fallos.push(`${tamano}: la ampliación no se quita al tocar la mesa`)
    }
    await p.close()

    // Fichas de misión (escena «alarma»: La casa del gobernador con la Alarma a 3).
    p = await abrir(contexto, tamano, 'alarma')
    const alarma = p.locator('.ficha-mision', { hasText: 'Alarma' })
    if (tactil) await alarma.tap()
    else await alarma.hover()
    await comprobar(p, `${tamano} ficha de Alarma`, '¡La guardia!')
    await foto(p, `ficha-mision-${tactil ? 'tocada' : 'raton'}-${tamano}`)
    await p.close()

    // La Referencia rápida (el botón «?»), con una de sus fichas explicada.
    p = await abrir(contexto, tamano, 'enJuego')
    await pulsar(p.locator('.icono-boton.redondo'))
    await p.waitForTimeout(300)
    if ((await p.locator('.capa.ayuda').count()) !== 1) fallos.push(`${tamano}: el botón «?» no abre la Referencia rápida`)
    await foto(p, `referencia-sin-abrir-${tamano}`)
    await pulsar(p.locator('.glosario-ficha', { hasText: 'Abordaje' }))
    await comprobar(p, `${tamano} Abordaje en la Referencia rápida`, 'herida por cada punto')
    await foto(p, `referencia-${tamano}`)
    await p.close()
    await contexto.close()
  }
  console.log(errores.length ? `Errores:\n${errores.join('\n')}` : 'Sin errores en la consola')
  console.log(fallos.length ? `Fallos:\n${fallos.join('\n')}` : 'Todas las explicaciones se abren y se cierran')
  if (errores.length || fallos.length) process.exitCode = 1
} finally {
  await navegador.close()
  await new Promise((ok) => servidor.httpServer.close(ok))
}
