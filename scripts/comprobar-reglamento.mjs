// Revisa la maqueta de los dos libros del reglamento, página a página (usa dist/; compila antes con npm run build):
//   - nada de la columna exterior (notas, consejos, viñetas) se monta sobre otra cosa;
//   - lo ancho (diagramas, cabeceras ilustradas) queda centrado en la página, y nada se sale de ella;
//   - nada se sale por abajo del área de texto;
//   - ninguna ilustración se repite en dos páginas seguidas;
//   - las cartas de los ejemplos miden al menos 24 mm (para leer su nombre y sus números).
//
//   npm run comprobar:reglamento      (compila y revisa)
//   node scripts/comprobar-reglamento.mjs

import { chromium } from 'playwright'
import { preview } from 'vite'

const servidor = await preview({ logLevel: 'error', preview: { port: 5194 }, ...(process.env.DIST ? { build: { outDir: process.env.DIST } } : {}) })
const raiz = servidor.resolvedUrls?.local[0]
if (!raiz) throw new Error('El servidor no ha arrancado')
const base = raiz.endsWith('/seascroundels/') ? raiz : new URL('seascroundels/', raiz).href

/** En el navegador: los problemas de cada página. */
function revisar() {
  const MM = 96 / 25.4
  const problemas = []
  const paginas = [...document.querySelectorAll('.pagedjs_page')]
  const artes = paginas.map((p) => new Set([...p.querySelectorAll('[data-arte]')].map((e) => e.dataset.arte)))
  const cruza = (a, b) => a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1
  paginas.forEach((pagina, i) => {
    const n = i + 1
    const hoja = pagina.getBoundingClientRect()
    const area = pagina.querySelector('.pagedjs_page_content')?.getBoundingClientRect()
    if (!area) return
    // Columna exterior: lo que va en ella no se monta sobre nada.
    const lateral = [...pagina.querySelectorAll('.nota-tema, .consejo, .vineta, .cartas-lado')]
    const bloques = [...pagina.querySelectorAll('.flujo > *, .ancho, .ejemplo, .importante, li, table')].filter(
      (e) => !e.matches('.nota-tema, .consejo, .cartas-lado') && !lateral.some((l) => l.contains(e) || e.contains(l)),
    )
    for (const l of lateral) {
      const r = l.getBoundingClientRect()
      if (r.height === 0) continue
      const nombre = l.className.split(' ')[0]
      for (const otro of lateral) {
        if (otro === l || otro.contains(l) || l.contains(otro)) continue
        if (cruza(r, otro.getBoundingClientRect()) && lateral.indexOf(otro) > lateral.indexOf(l)) problemas.push(`pág. ${n}: «${nombre}» se monta sobre «${otro.className.split(' ')[0]}»`)
      }
      for (const b of bloques) {
        const rb = b.getBoundingClientRect()
        if (rb.height > 0 && cruza(r, rb)) {
          problemas.push(`pág. ${n}: «${nombre}» («${(l.textContent ?? '').trim().slice(0, 30)}») se monta sobre «${b.className || b.tagName}»`)
          break
        }
      }
      if (r.bottom > area.bottom + 2) problemas.push(`pág. ${n}: «${nombre}» se sale por abajo`)
    }
    // Lo ancho, centrado en la página; nada se sale de la hoja.
    for (const a of pagina.querySelectorAll('.ancho')) {
      const r = a.getBoundingClientRect()
      const izq = (r.left - hoja.left) / MM
      const der = (hoja.right - r.right) / MM
      if (Math.abs(izq - der) > 0.6) problemas.push(`pág. ${n}: «${a.className.split(' ')[0]}» descentrado (${izq.toFixed(1)} mm a la izquierda, ${der.toFixed(1)} a la derecha)`)
    }
    // (Solo el contenido: los contenedores de Paged.js son anchos a propósito, para repartir el texto en columnas.)
    for (const e of pagina.querySelectorAll('.pagedjs_page_content :is(p, li, h2, h3, h4, table, figure, img, .ejemplo, .importante, .ancho, .vineta, .nota-tema, .consejo, .vease)')) {
      // Un párrafo que sigue en la página siguiente tiene un trozo fuera, a la derecha, oculto: no cuenta.
      const trozos = [...e.getClientRects()].filter((x) => x.width > 0 && x.left < hoja.right)
      if (trozos.length === 0 || getComputedStyle(e).visibility === 'hidden') continue
      const r = { left: Math.min(...trozos.map((x) => x.left)), right: Math.max(...trozos.map((x) => x.right)) }
      if (e.closest('.cubierta, .contraportada, .miniatura, .dorso-libro, .pestanas-letras')) continue
      if (r.left < hoja.left + 9 * MM || r.right > hoja.right - 9 * MM) {
        const camino = []
        for (let x = e; x && x !== pagina && camino.length < 4; x = x.parentElement) camino.push(x.className || x.tagName)
        problemas.push(`pág. ${n}: «${camino.join(' < ')}» se sale hacia el borde de la hoja (${((r.left - hoja.left) / MM).toFixed(1)}–${((r.right - hoja.left) / MM).toFixed(1)} mm)`)
        break
      }
    }
    // Ilustraciones: ninguna en dos páginas seguidas.
    for (const nombre of artes[i] ?? []) if (artes[i + 1]?.has(nombre)) problemas.push(`pág. ${n} y ${n + 1}: la misma ilustración (${nombre})`)
    // Cartas de los ejemplos, legibles.
    for (const m of pagina.querySelectorAll('.ejemplo .miniatura')) {
      const r = m.getBoundingClientRect()
      if (Math.min(r.width, r.height) / MM < 23.9) problemas.push(`pág. ${n}: una carta de ejemplo mide ${(Math.min(r.width, r.height) / MM).toFixed(1)} mm`)
    }
  })
  return { problemas, paginas: paginas.length, vinetas: document.querySelectorAll('.vineta').length, cabeceras: document.querySelectorAll('.cabecera-arte').length }
}

const navegador = await chromium.launch()
let fallos = 0
try {
  for (const fichero of ['aprende-a-jugar', 'referencia-de-reglas']) {
    const pagina = await navegador.newPage({ viewport: { width: 1100, height: 1400 } })
    const errores = []
    pagina.on('pageerror', (e) => errores.push(e.message))
    await pagina.goto(`${base}reglamento/${fichero}.html?imprimir`, { waitUntil: 'networkidle' })
    await pagina.waitForFunction(() => window.__libroListo === true, null, { timeout: 180_000 })
    const r = await pagina.evaluate(revisar)
    const lista = [...new Set([...r.problemas, ...errores])]
    console.log(`${fichero}: ${r.paginas} páginas, ${r.cabeceras} cabeceras ilustradas, ${r.vinetas} viñetas${lista.length ? '' : ', sin problemas'}`)
    for (const p of lista) console.log(`  ${p}`)
    fallos += lista.length
    await pagina.close()
  }
} finally {
  await navegador.close()
  await new Promise((ok) => servidor.httpServer.close(ok))
}
if (fallos) process.exitCode = 1
