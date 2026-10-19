// Revisa la maqueta de los dos libros del reglamento, página a página (usa dist/; compila antes con npm run build):
//   - nada de la columna exterior (notas, consejos, viñetas) se monta sobre otra cosa;
//   - lo ancho (diagramas, cabeceras ilustradas) queda centrado en la página, y nada se sale de ella;
//   - nada se sale por abajo del área de texto;
//   - ninguna ilustración se repite en dos páginas seguidas, y una viñeta no repite en su doble página la ilustración
//     de una carta, de una cabecera o de otra viñeta;
//   - las cartas de los ejemplos miden al menos 24 mm (para leer su nombre y sus números);
//   - de las cartas de Peligro, los ejemplos enseñan solo la parte que citan, recortada a un tamaño en que se lee
//     (60 mm o más y letra de 7,2 px o más), nunca la carta entera en pequeño;
//   - ningún ejemplo, recuadro ni diagrama queda partido entre dos páginas;
//   - ningún título se queda al pie de una página con una o dos líneas debajo y el resto en la siguiente;
//   - el punto en que acaba cada llamada de las anatomías no tapa letras ni iconos.
//
//   npm run comprobar:reglamento      (compila y revisa)
//   node scripts/comprobar-reglamento.mjs

import { readFile } from 'node:fs/promises'
import { chromium } from 'playwright'
import { preview } from 'vite'

const servidor = await preview({ logLevel: 'error', preview: { port: 5194 }, ...(process.env.DIST ? { build: { outDir: process.env.DIST } } : {}) })
const raiz = servidor.resolvedUrls?.local[0]
if (!raiz) throw new Error('El servidor no ha arrancado')
const base = raiz.endsWith('/seascroundels/') ? raiz : new URL('seascroundels/', raiz).href

/** Ilustración de cada carta («canones»), de data/arte.json. */
const arteJson = JSON.parse(await readFile(new URL('../data/arte.json', import.meta.url), 'utf8'))
const ARTE_DE_CARTA = Object.fromEntries(Object.entries(arteJson).map(([id, a]) => [id, a.archivo.split('/').pop().replace(/\.[a-z]+$/, '')]))

/** En el navegador: los problemas de cada página. */
function revisar(arteDeCarta) {
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
    // Cartas de Peligro de los ejemplos: solo la parte citada, recortada y legible.
    for (const m of pagina.querySelectorAll(':is(.ejemplo, .panel-ejemplo) .miniatura')) {
      if (m.querySelector('.card.enc')) problemas.push(`pág. ${n}: un ejemplo enseña entera, en pequeño, la carta de Peligro ${m.dataset.carta}`)
    }
    for (const f of pagina.querySelectorAll('.fragmento')) {
      const ancho = f.getBoundingClientRect().width / MM
      const carta = f.querySelector('.card')
      const escala = carta ? carta.getBoundingClientRect().width / 378 : 0
      const letra = (parseFloat(carta?.style.getPropertyValue('--fs2') ?? '') || 10) * escala
      if (ancho < 59.9 || letra < 7.15) problemas.push(`pág. ${n}: el recorte de ${f.dataset.carta} mide ${ancho.toFixed(1)} mm y su letra ${letra.toFixed(1)} px: no se lee`)
      if (!f.querySelector('.fragmento-nombre')?.textContent?.trim()) problemas.push(`pág. ${n}: el recorte de ${f.dataset.carta} no lleva el nombre de la carta`)
    }
    // Nada que no se pueda partir queda partido entre dos páginas.
    for (const e of pagina.querySelectorAll('[data-split-to]')) {
      if (e.matches('.ejemplo, .importante, .consejo, .nota-tema, .anatomia, .mesa-diagrama, .turno, .prueba-flujo, .panel-ejemplo, .componente, .fragmento'))
        problemas.push(`pág. ${n}: «${e.className.split(' ')[0]}» («${(e.textContent ?? '').trim().slice(0, 40)}») queda partido entre esta página y la siguiente`)
    }
    // Títulos al pie de página: debajo, más de dos líneas, o nada más de su sección en la página siguiente.
    const contenido = pagina.querySelector('.pagedjs_page_content')
    const siguiente = paginas[i + 1]?.querySelector('.pagedjs_page_content')
    const empiezaConTitulo = (area) => {
      for (const x of area?.querySelectorAll('h2, h3, h4, p, li, figure, table, .ejemplo, .importante, .ancho, .letra, .vease, .inicio-capitulo') ?? []) {
        const r = x.getBoundingClientRect()
        if (r.height === 0 || x.closest('.nota-tema, .vineta, .consejo, .pestanas-letras')) continue
        return x.matches('h2, h3, .letra, .inicio-capitulo') || x.closest('.inicio-capitulo, .cabecera-capitulo') !== null
      }
      return true
    }
    for (const t of contenido?.querySelectorAll('.subtitulo, .entrada-titulo, .componentes-grupo, .letra, .cabecera-capitulo') ?? []) {
      const rt = t.getBoundingClientRect()
      if (rt.height === 0 || rt.left > hoja.right) continue
      let fin = rt.bottom
      for (const x of contenido.querySelectorAll('p, li, figure, table, .ejemplo, .importante, .ancho, h3, h4, .vease, .letra')) {
        if (!(t.compareDocumentPosition(x) & Node.DOCUMENT_POSITION_FOLLOWING) || t.contains(x) || x.closest('.nota-tema, .vineta, .consejo')) continue
        for (const r of x.getClientRects()) if (r.height > 0 && r.left < hoja.right) fin = Math.max(fin, r.bottom)
      }
      const debajo = (fin - rt.bottom) / MM
      // Un capítulo o una letra siempre siguen; una sección, solo si la página siguiente no empieza con otro título.
      const sigue = t.matches('.letra, .cabecera-capitulo') || !empiezaConTitulo(siguiente)
      if (debajo < 15 && sigue && siguiente) problemas.push(`pág. ${n}: el título «${(t.textContent ?? '').trim().slice(0, 40)}» se queda al pie con ${debajo.toFixed(0)} mm debajo; lo suyo sigue en la página siguiente`)
    }
    // Llamadas de las anatomías: su punto no tapa letras ni iconos.
    for (const anotada of pagina.querySelectorAll('.carta-anotada')) {
      const carta = anotada.querySelector('.miniatura')
      if (!carta) continue
      const tapadas = []
      const textos = document.createTreeWalker(carta, NodeFilter.SHOW_TEXT)
      for (let t = textos.nextNode(); t; t = textos.nextNode()) {
        if (!(t.textContent ?? '').trim()) continue
        const rango = document.createRange()
        rango.selectNodeContents(t)
        for (const r of rango.getClientRects()) tapadas.push({ r, que: `«${t.textContent.trim().slice(0, 20)}»` })
      }
      for (const ic of carta.querySelectorAll('.ic, svg, img')) tapadas.push({ r: ic.getBoundingClientRect(), que: `un icono (${ic.className?.baseVal ?? ic.className})` })
      const marcadores = [...anotada.querySelectorAll('.marcador')]
      anotada.querySelectorAll('.lineas-guia circle').forEach((c, k) => {
        const rc = c.getBoundingClientRect()
        const tapa = tapadas.find(({ r }) => r.width > 0 && r.height > 0 && rc.left < r.right && r.left < rc.right && rc.top < r.bottom && r.top < rc.bottom)
        if (tapa) problemas.push(`pág. ${n}: el punto de la llamada ${marcadores[k]?.textContent ?? k + 1} (${carta.dataset.carta}) tapa ${tapa.que}`)
      })
    }
  })
  // Viñetas: ninguna repite en su doble página (la par, a la izquierda, con la impar siguiente) una ilustración de una
  // carta, de una cabecera o de otra viñeta.
  paginas.forEach((pagina, i) => {
    const pareja = pagina.classList.contains('pagedjs_left_page') ? paginas[i + 1] : paginas[i - 1]
    for (const v of pagina.querySelectorAll('.vineta')) {
      const otras = [pagina, pareja].filter(Boolean).flatMap((p) => [...p.querySelectorAll('[data-arte], [data-carta]')]).filter((e) => e !== v)
      const repetida = otras.find((e) => (e.dataset.arte ?? arteDeCarta[e.dataset.carta]) === v.dataset.arte)
      if (repetida) problemas.push(`pág. ${i + 1}: la viñeta repite la ilustración ${v.dataset.arte}, que ya sale en su doble página (${repetida.dataset.carta ? `carta ${repetida.dataset.carta}` : repetida.className.split(' ')[0]})`)
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
    const r = await pagina.evaluate(revisar, ARTE_DE_CARTA)
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
