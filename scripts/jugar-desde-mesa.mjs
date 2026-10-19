// Juega partidas enteras desde la interfaz: el jugador automático decide y el navegador pulsa la pantalla
// (cartas, menús y botones), como lo haría una persona. Falla si algo no se puede hacer con el ratón o si
// sale un error en la consola.
//
//   npm run build && node scripts/jugar-desde-mesa.mjs        (PARTIDAS=3 para más)

import { chromium } from 'playwright'
import { preview } from 'vite'
import { jugarDecision } from './mesa-automatica.mjs'

const PARTIDAS = Number(process.env.PARTIDAS ?? 1)
const servidor = await preview({ logLevel: 'error', preview: { port: 5199 } })
const raiz = servidor.resolvedUrls?.local[0]
if (!raiz) throw new Error('El servidor no ha arrancado')
// La vista previa ya sirve la web en /seascroundels/ (la ruta base de GitHub Pages).
const base = raiz.endsWith('/seascroundels/') ? raiz : new URL('seascroundels/', raiz).href

const navegador = await chromium.launch()
const errores = []
let fallo = null

async function jugarUna(n) {
  const pagina = await navegador.newPage({ viewport: { width: 1440, height: 900 } })
  pagina.on('pageerror', (e) => errores.push(`partida ${n}: ${e.message}`))
  pagina.on('console', (m) => m.type() === 'error' && errores.push(`partida ${n}: ${m.text()}`))
  await pagina.goto(`${base}?pruebas#/`, { waitUntil: 'networkidle' })
  await pagina.evaluate(() => localStorage.clear())
  await pagina.getByRole('button', { name: /Nueva partida/ }).click()
  await pagina.waitForFunction(() => window.__mesa)
  await pagina.evaluate(() => {
    // Sin animaciones: más rápido y sin esperar a que terminen.
    localStorage.setItem('sea-scoundrels/velocidad', 'sin')
  })
  let pasos = 0
  for (;;) {
    if (++pasos > 3000) throw new Error('Demasiados pasos')
    const resultado = await jugarDecision(pagina)
    if (resultado) {
      console.log(`Partida ${n}: ${resultado.gana ? 'victoria' : 'derrota'} en ${pasos} decisiones — ${resultado.motivo}`)
      break
    }
  }
  await pagina.screenshot({ path: new URL(`../capturas/mesa/final-partida-${n}.png`, import.meta.url).pathname })
  await pagina.close()
}

try {
  for (let n = 1; n <= PARTIDAS; n++) await jugarUna(n)
} catch (e) {
  fallo = e
} finally {
  await navegador.close()
  await new Promise((ok) => servidor.httpServer.close(ok))
}
if (errores.length) console.log(`Errores en la consola:\n${errores.join('\n')}`)
if (fallo) {
  console.error(fallo)
  process.exit(1)
}
if (errores.length) process.exit(1)
console.log('Todo se ha podido jugar desde la mesa.')
