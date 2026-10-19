import { chromium } from 'playwright'
import { preview } from 'vite'
const servidor = await preview({ logLevel: 'error', preview: { port: 5615 } })
const raiz = servidor.resolvedUrls.local[0]
const base = raiz.endsWith('/seascroundels/') ? raiz : new URL('seascroundels/', raiz).href
const b = await chromium.launch()
const p = await b.newPage({ viewport: { width: 1100, height: 1400 } })
await p.goto(`${base}reglamento/aprende-a-jugar.html?imprimir`, { waitUntil: 'networkidle' })
await p.waitForFunction(() => window.__libroListo === true, null, { timeout: 180000 })
const r = await p.evaluate((nums) => {
  const MM = 96 / 25.4
  const paginas = [...document.querySelectorAll('.pagedjs_page')]
  return nums.map((n) => {
    const pag = paginas[n - 1]
    const area = pag.querySelector('.pagedjs_page_content').getBoundingClientRect()
    const hoja = pag.getBoundingClientRect()
    const partes = [...pag.querySelectorAll('.flujo > *')].filter((e) => !e.matches('.nota-tema')).map((e) => e.getBoundingClientRect()).filter((x) => x.height > 0 && x.left < hoja.right)
    const fin = Math.max(...partes.map((x) => x.bottom), area.top)
    const flujo = [...pag.querySelectorAll('.flujo > *')].map((e) => `${e.className.split(' ')[0] || e.tagName} ${((e.getBoundingClientRect().height) / MM).toFixed(1)}mm`)
    return `pág. ${n}: libre ${((area.bottom - fin) / MM).toFixed(1)} mm de ${(area.height / MM).toFixed(0)}; ${flujo.join(' · ')}`
  })
}, process.argv.slice(2).map(Number))
console.log(r.join('\n'))
await b.close(); servidor.httpServer.close()
