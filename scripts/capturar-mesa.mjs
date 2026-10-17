// Capturas de la mesa en sus tres momentos (en puerto, durante una Prueba y al final de una misión) y de la
// portada, tal y como se publica (compilada), en capturas/mesa/. Comprueba que no hay errores en la consola.
//
//   npm run capturas:mesa            (compila y captura)
//   node scripts/capturar-mesa.mjs   (sin compilar; usa dist/)
//   TAMANOS=1440 node scripts/capturar-mesa.mjs

import { mkdir } from 'node:fs/promises'
import { chromium } from 'playwright'
import { preview } from 'vite'

const destino = new URL('../capturas/mesa/', import.meta.url)
await mkdir(destino, { recursive: true })

const TAMANOS = {
  1440: ['1440x900', 1440, 900],
  1920: ['1920x1080', 1920, 1080],
  1024: ['tableta-1024x768', 1024, 768],
}
const elegidos = (process.env.TAMANOS ?? '1440,1920,1024').split(',').map((t) => TAMANOS[t.trim()]).filter(Boolean)
const ESCENAS = (process.env.ESCENAS ?? 'portada,puerto,prueba,finMision').split(',')

const servidor = await preview({ logLevel: 'error', preview: { port: 5198 } })
const raiz = servidor.resolvedUrls?.local[0]
if (!raiz) throw new Error('El servidor no ha arrancado')
const base = new URL('seascroundels/', raiz).href

const navegador = await chromium.launch()
const errores = []
try {
  for (const [tamano, ancho, alto] of elegidos) {
    for (const escena of ESCENAS) {
      const pagina = await navegador.newPage({ viewport: { width: ancho, height: alto } })
      pagina.on('pageerror', (e) => errores.push(`${tamano} ${escena}: ${e.message}`))
      pagina.on('console', (m) => m.type() === 'error' && errores.push(`${tamano} ${escena}: ${m.text()}`))
      await pagina.goto(`${base}#${escena === 'portada' ? '/' : `/escena/${escena}`}`, { waitUntil: 'networkidle' })
      await pagina.evaluate(() => document.fonts.ready)
      await pagina.waitForTimeout(900)
      await pagina.screenshot({ path: new URL(`${escena}-${tamano}.png`, destino).pathname })
      await pagina.close()
    }
  }
  console.log(errores.length ? `Errores:\n${errores.join('\n')}` : 'Sin errores en la consola')
} finally {
  await navegador.close()
  await new Promise((ok) => servidor.httpServer.close(ok))
}
