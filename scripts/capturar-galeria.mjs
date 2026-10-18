// Capturas de la galería tal y como se publica (compilada, con la ruta de GitHub Pages),
// en capturas/galeria/. Comprueba escritorio y tableta.
//
//   npm run build && node scripts/capturar-galeria.mjs

import { mkdir } from 'node:fs/promises'
import { chromium } from 'playwright'
import { preview } from 'vite'

const destino = new URL('../capturas/galeria/', import.meta.url)
await mkdir(destino, { recursive: true })

const servidor = await preview({ logLevel: 'error', preview: { port: 5197 } })
const raiz = servidor.resolvedUrls?.local[0]
if (!raiz) throw new Error('El servidor no ha arrancado')
const base = new URL('seascroundels/', raiz).href

const navegador = await chromium.launch()
const errores = []
try {
  for (const [nombre, ancho, alto] of [
    ['escritorio-1440', 1440, 900],
    ['escritorio-1920', 1920, 1080],
    ['tableta-1180', 1180, 820],
  ]) {
    const pagina = await navegador.newPage({ viewport: { width: ancho, height: alto } })
    pagina.on('pageerror', (e) => errores.push(`${nombre}: ${e.message}`))
    pagina.on('console', (m) => m.type() === 'error' && errores.push(`${nombre}: ${m.text()}`))
    await pagina.goto(`${base}#/galeria`, { waitUntil: 'networkidle' })
    await pagina.evaluate(() => document.fonts.ready)
    await pagina.screenshot({ path: new URL(`${nombre}.png`, destino).pathname })
    if (nombre === 'escritorio-1440') {
      // Ampliación al pasar el ratón por una carta
      await pagina.hover('.gal-item[data-num="11"]')
      await pagina.waitForTimeout(400)
      await pagina.screenshot({ path: new URL(`${nombre}-ampliada.png`, destino).pathname })
      await pagina.mouse.move(5, 5)
      // Modo comparar
      await pagina.getByRole('button', { name: 'Comparar' }).click()
      await pagina.getByRole('button', { name: 'Peligros' }).click()
      await pagina.waitForTimeout(600)
      await pagina.screenshot({ path: new URL(`${nombre}-comparar.png`, destino).pathname })
      await pagina.getByRole('button', { name: 'Diferencia' }).click()
      await pagina.waitForTimeout(600)
      await pagina.screenshot({ path: new URL(`${nombre}-diferencia.png`, destino).pathname })
    }
    await pagina.close()
  }
  console.log(errores.length ? `Errores:\n${errores.join('\n')}` : 'Sin errores en la consola')
} finally {
  await navegador.close()
  await new Promise((ok) => servidor.httpServer.close(ok))
}
