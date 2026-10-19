import { chromium } from 'playwright'
import { preview } from 'vite'
const servidor = await preview({ logLevel: 'error', preview: { port: 5616 } })
const raiz = servidor.resolvedUrls.local[0]
const base = raiz.endsWith('/seascroundels/') ? raiz : new URL('seascroundels/', raiz).href
const b = await chromium.launch()
const p = await b.newPage({ viewport: { width: 1100, height: 1400 } })
p.on('console', (m) => m.text().startsWith('CORTE') && console.log(m.text()))
await p.goto(`${base}reglamento/referencia-de-reglas.html?imprimir`, { waitUntil: 'networkidle' })
await p.waitForFunction(() => window.__libroListo === true, null, { timeout: 180000 })
const r = await p.evaluate(() => {
  const paginas = [...document.querySelectorAll('.pagedjs_page')]
  const out = []
  for (const [i, pag] of paginas.entries()) {
    const area = pag.querySelector('.pagedjs_page_content').getBoundingClientRect()
    for (const el of pag.querySelectorAll('p')) {
      const t = el.textContent.replace(/­/g, '')
      if (!t.includes('reloj de la partida') && !t.includes('corta, 11')) continue
      const rects = [...el.getClientRects()]
      out.push(`pág ${i + 1}: «${t.slice(0, 50)}» top=${Math.round(rects[0].top - area.top)} bottom=${Math.round(rects.at(-1).bottom - area.top)} area=${Math.round(area.height)} split-to=${el.getAttribute('data-split-to') ? 1 : 0} split-from=${el.getAttribute('data-split-from') ? 1 : 0} overflow=${getComputedStyle(pag.querySelector('.pagedjs_page_content')).overflow}`)
    }
  }
  return out
})
console.log(r.join('\n'))
await b.close(); servidor.httpServer.close()
