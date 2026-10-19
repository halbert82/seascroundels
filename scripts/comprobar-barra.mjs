// Comprueba que la barra superior de la mesa no se mueve nunca: juega desde la mesa hasta revelar varios Destinos
// (con animaciones, para que salte el desplazamiento que enseña el Destino), y abre y cierra el registro, la
// referencia rápida y el menú, y amplía cartas y fichas. Tras cada acción mide que:
//   - la barra está arriba del todo, entera en la pantalla;
//   - ni la página ni el marco de la mesa se han desplazado;
//   - solo están desplazadas por dentro las zonas hechas para ello (el centro, el registro, la ayuda…).
// En 1440×900, 1920×1080 y en tableta (1024×768, con toques).
//
//   npm run comprobar:barra               (compila y comprueba)
//   node scripts/comprobar-barra.mjs      (sin compilar; usa dist/)

import { chromium } from 'playwright'
import { preview } from 'vite'
import { jugarDecision } from './mesa-automatica.mjs'

const DESTINOS = Number(process.env.DESTINOS ?? 5)
const TODOS = [
  { nombre: '1440x900', width: 1440, height: 900, toque: false },
  { nombre: '1920x1080', width: 1920, height: 1080, toque: false },
  { nombre: 'tableta-1024x768', width: 1024, height: 768, toque: true },
]
const TAMANOS = process.env.TAMANOS ? TODOS.filter((t) => process.env.TAMANOS.split(',').some((n) => t.nombre.startsWith(n))) : TODOS

const servidor = await preview({ logLevel: 'error', preview: { port: 5195 } })
const raiz = servidor.resolvedUrls?.local[0]
if (!raiz) throw new Error('El servidor no ha arrancado')
const base = raiz.endsWith('/seascroundels/') ? raiz : new URL('seascroundels/', raiz).href

/** Lo que se mide tras cada acción (en el navegador). */
function medir() {
  const problemas = []
  const barra = document.querySelector('.barra')
  const lienzo = document.querySelector('.lienzo')
  const marco = document.querySelector('.lienzo-marco')
  if (!barra || !lienzo || !marco) return ['no está la mesa']
  const b = barra.getBoundingClientRect()
  const l = lienzo.getBoundingClientRect()
  if (Math.abs(b.top - l.top) > 1) problemas.push(`la barra se ha movido (${b.top.toFixed(0)} px en vez de ${l.top.toFixed(0)})`)
  if (b.top < -1 || b.bottom > window.innerHeight + 1) problemas.push(`la barra se sale de la pantalla (arriba en ${b.top.toFixed(0)} px)`)
  const doc = document.scrollingElement
  if (doc && (doc.scrollTop || doc.scrollLeft)) problemas.push(`la página está desplazada (${doc.scrollTop} px)`)
  if (marco.scrollTop || marco.scrollLeft) problemas.push(`el marco de la mesa está desplazado (${marco.scrollTop} px)`)
  for (const el of document.querySelectorAll('.lienzo-marco *')) {
    if (!el.scrollTop && !el.scrollLeft) continue
    const { overflowX, overflowY } = getComputedStyle(el)
    if (/auto|scroll/.test(overflowY + overflowX)) continue
    problemas.push(`«${el.className || el.tagName}» está desplazado (${el.scrollTop} px) sin ser una zona desplazable`)
  }
  return problemas
}

const navegador = await chromium.launch()
const fallos = []
const errores = []
let acciones = 0

async function comprobar(pagina, tamano, accion) {
  acciones++
  // Deja que terminen las animaciones y los desplazamientos suaves (el del Destino espera ~0,4 s).
  await pagina.waitForTimeout(650)
  const problemas = await pagina.evaluate(medir)
  for (const p of problemas) fallos.push(`${tamano.nombre}, tras ${accion}: ${p}`)
  if (problemas.length) await pagina.screenshot({ path: new URL(`../capturas/barra-${tamano.nombre}-${fallos.length}.png`, import.meta.url).pathname })
}

/** Ampliar una carta: con ratón, pasar por encima; en tableta, tocarla (y tocar fuera para cerrar). */
async function ampliar(pagina, tamano, selector) {
  // En tableta, tocar una carta con acción también la hace: se tocan solo cartas sin acción, para no cambiar la partida.
  const carta = pagina.locator(tamano.toque ? `${selector}:not(.pulsable)` : selector).first()
  if (!(await carta.count())) return
  if (tamano.toque) {
    await carta.tap({ force: true })
    await comprobar(pagina, tamano, `tocar ${selector}`)
    await pagina.touchscreen.tap(Math.round(tamano.width / 2), 8)
    await comprobar(pagina, tamano, `tocar fuera tras ${selector}`)
    // Mantener pulsada (menú contextual del navegador): también amplía.
    await carta.dispatchEvent('contextmenu')
    await comprobar(pagina, tamano, `mantener pulsada ${selector}`)
    await pagina.touchscreen.tap(Math.round(tamano.width / 2), 8)
  } else {
    await carta.hover({ force: true })
    await comprobar(pagina, tamano, `ampliar ${selector}`)
    await pagina.mouse.move(tamano.width / 2, tamano.height - 2)
  }
  await comprobar(pagina, tamano, `cerrar la ampliación de ${selector}`)
}

async function paneles(pagina, tamano) {
  const pulsar = async (loc) => (tamano.toque ? loc.tap() : loc.click())
  // Si acaba de terminar la misión, su ventana tapa la mesa: se cierra como lo haría el jugador.
  const fin = pagina.locator('.fin-mision .boton.principal')
  if (await fin.count()) {
    await pulsar(fin.first())
    await comprobar(pagina, tamano, 'cerrar el fin de misión')
  }
  await pulsar(pagina.getByRole('button', { name: /Registro/ }))
  await comprobar(pagina, tamano, 'abrir el registro')
  await pulsar(pagina.locator('.cajon .cerrar'))
  await comprobar(pagina, tamano, 'cerrar el registro')
  await pulsar(pagina.locator('.barra-botones .icono-boton.redondo'))
  await comprobar(pagina, tamano, 'abrir la referencia rápida')
  // Bajar por la ayuda (se desplaza por dentro) y cerrarla.
  await pagina.mouse.wheel(0, 900)
  await comprobar(pagina, tamano, 'desplazar la referencia rápida')
  await pagina.keyboard.press('Escape')
  const cerrar = pagina.locator('.capa .cerrar').first()
  if (await cerrar.count()) await pulsar(cerrar)
  await comprobar(pagina, tamano, 'cerrar la referencia rápida')
  await pulsar(pagina.getByRole('button', { name: /Menú/ }))
  await comprobar(pagina, tamano, 'abrir el menú')
  await pulsar(pagina.getByRole('button', { name: /Menú/ }))
  await comprobar(pagina, tamano, 'cerrar el menú')
  for (const sel of ['.col-izq .carta-mesa', '.mano .carta-mesa', '.col-der .carta-mesa', '.destino-grande', '.centro .carta-mesa']) await ampliar(pagina, tamano, sel)
  // Una ficha con explicación (Estado, Ventaja…), si hay alguna.
  const ficha = pagina.locator('.explicable').first()
  if (await ficha.count()) {
    await (tamano.toque ? ficha.tap() : ficha.click())
    await comprobar(pagina, tamano, 'abrir una explicación')
    await pagina.keyboard.press('Escape')
    await comprobar(pagina, tamano, 'cerrar una explicación')
  }
}

try {
  for (const tamano of TAMANOS) {
    try {
      await comprobarTamano(tamano)
    } catch (e) {
      fallos.push(`${tamano.nombre}: la comprobación no pudo seguir (${String(e.message ?? e).split('\n').slice(0, 4).join(' · ')})`)
    }
  }
} finally {
  await navegador.close()
  await new Promise((ok) => servidor.httpServer.close(ok))
}

async function comprobarTamano(tamano) {
    const contexto = await navegador.newContext({ viewport: { width: tamano.width, height: tamano.height }, hasTouch: tamano.toque })
    const pagina = await contexto.newPage()
    pagina.on('pageerror', (e) => errores.push(`${tamano.nombre}: ${e.message}`))
    pagina.on('console', (m) => m.type() === 'error' && errores.push(`${tamano.nombre}: ${m.text().slice(0, 200)}`))
    await pagina.goto(`${base}?pruebas#/`, { waitUntil: 'networkidle' })
    await pagina.evaluate(() => localStorage.clear())
    await pagina.getByRole('button', { name: /Nueva partida/ }).click()
    await pagina.waitForFunction(() => window.__mesa)
    await comprobar(pagina, tamano, 'empezar la partida')
    await paneles(pagina, tamano)
    let destinos = 0
    let anterior = null
    for (let paso = 1; paso <= 600 && destinos < DESTINOS; paso++) {
      const resultado = await jugarDecision(pagina)
      if (resultado) break
      const destino = await pagina.evaluate(() => window.__mesa.estado().prueba?.destino ?? null)
      if (destino && destino !== anterior) {
        destinos++
        await comprobar(pagina, tamano, `revelar el Destino ${destinos}`)
        await paneles(pagina, tamano)
      } else if (paso % 10 === 0) {
        await comprobar(pagina, tamano, `la decisión ${paso}`)
      }
      anterior = destino
    }
    console.log(`${tamano.nombre}: ${destinos} Destinos revelados`)
    await contexto.close()
}

if (errores.length) console.log(`Errores en la consola:\n${[...new Set(errores)].join('\n')}`)
if (fallos.length) {
  console.log(`La barra se ha movido (${fallos.length} veces en ${acciones} comprobaciones):\n${[...new Set(fallos)].slice(0, 40).join('\n')}`)
  process.exit(1)
}
if (errores.length) process.exit(1)
console.log(`La barra sigue en su sitio tras las ${acciones} comprobaciones.`)
