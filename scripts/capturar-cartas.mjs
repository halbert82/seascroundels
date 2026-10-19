// Fotografía cada carta dibujada desde los datos, a doble resolución como las imágenes
// de referencia, en capturas/actual/NNN.png.
//
//   npm run capturas            → todas
//   npm run capturas -- 1 77    → solo esas
//   npm run capturas -- --apretado   → todas con texto apretado, en capturas/apretado/ (para calibrar)

import { mkdir } from 'node:fs/promises'
import { chromium } from 'playwright'
import { createServer } from 'vite'

const argumentos = process.argv.slice(2)
const apretado = argumentos.includes('--apretado')
const soloEstas = new Set(argumentos.filter((a) => !a.startsWith('--')).map((n) => String(Number(n)).padStart(3, '0')))
const destino = new URL(apretado ? '../capturas/apretado/' : '../capturas/actual/', import.meta.url)
await mkdir(destino, { recursive: true })

const servidor = await createServer({ logLevel: 'error', server: { port: 5199 } })
await servidor.listen()
const base = servidor.resolvedUrls?.local[0]
if (!base) throw new Error('El servidor de Vite no ha arrancado')

const navegador = await chromium.launch()
try {
  const pagina = await navegador.newPage({ deviceScaleFactor: 2, viewport: { width: 1700, height: 1100 } })
  await pagina.goto(`${base}#/captura${apretado ? '?apretado=todas' : ''}`, { waitUntil: 'networkidle' })
  await pagina.waitForSelector('[data-captura="153"]')
  await pagina.evaluate(async () => {
    await document.fonts.ready
    // Espera a que carguen las ilustraciones (son fondos CSS).
    const urls = new Set()
    for (const el of document.querySelectorAll('.art, .chapart, .ptoart')) {
      const m = /url\("?([^")]+)"?\)/.exec(getComputedStyle(el).backgroundImage)
      if (m) urls.add(m[1])
    }
    await Promise.all(
      [...urls].map(
        (u) =>
          new Promise((ok) => {
            const img = new Image()
            img.onload = img.onerror = ok
            img.src = u
          }),
      ),
    )
  })

  const elementos = await pagina.locator('[data-captura]').all()
  let n = 0
  for (const el of elementos) {
    const num = await el.getAttribute('data-captura')
    if (!num || (soloEstas.size > 0 && !soloEstas.has(num))) continue
    await el.locator('.card').screenshot({ path: new URL(`${num}.png`, destino).pathname, animations: 'disabled' })
    n++
  }
  console.log(`${n} cartas fotografiadas en ${destino.pathname}`)
} finally {
  await navegador.close()
  await servidor.close()
}
