// Revisa la maqueta de los dos libros del reglamento, página a página (usa dist/; compila antes con npm run build):
//   - nada de la columna exterior (notas, consejos, viñetas) se monta sobre otra cosa;
//   - lo ancho (diagramas, cabeceras ilustradas) queda centrado en la página, y nada se sale de ella;
//   - nada se sale por abajo del área de texto;
//   - ninguna ilustración se repite en dos páginas seguidas, y una ilustración de adorno (cabecera, viñeta o lámina)
//     no repite en su doble página la ilustración de una carta ni de otro adorno;
//   - las cartas de los ejemplos miden al menos 24 mm (para leer su nombre y sus números);
//   - de las cartas de Peligro, los ejemplos enseñan solo la parte que citan, recortada a un tamaño en que se lee
//     (60 mm o más y letra de 7,2 px o más), nunca la carta entera en pequeño;
//   - ningún ejemplo, recuadro ni diagrama queda partido entre dos páginas;
//   - ningún título se queda al pie de una página con una o dos líneas debajo y el resto en la siguiente;
//   - el punto en que acaba cada llamada de las anatomías no tapa letras ni iconos;
//   - no queda ningún «[epígrafe pendiente]» ni «[nota pendiente]» (los créditos sí pueden llevar «[pendiente]»);
//   - ninguna página de texto queda casi vacía (con menos de 15 % de su alto ocupado, como unas pocas líneas que no
//     cupieron), salvo la última de los créditos;
//   - el ejemplo de juego tiene sus dos paneles (el del puerto a la izquierda y el de la misión a la derecha);
//   - ninguna palabra queda partida entre dos páginas («cart-» / «as»);
//   - no se pierde nada: cada nota, ejemplo, recuadro o gráfico está dentro de su página, y todo el texto del
//     reglamento (de la parte de ese libro) sale en el libro, también a media frase;
//   - cada número de página de una remisión es el de la página donde está lo que cita.
// Además dice qué páginas quedan en blanco (con la rosa de los vientos) porque lo que sigue empieza en página par.
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

/**
 * Muestras del texto de cada libro, sacadas del reglamento: de cada línea de texto (párrafo, punto de lista, nota,
 * ejemplo, epígrafe), trozos de 24 letras cada 40, para que se note también lo que se pierde a media frase. Sin las
 * marcas, las tablas, los títulos, «Véase también» ni la referencia rápida; las remisiones («ver «X»») se dibujan de otra
 * manera («véase «X», pág. 12»), así que el texto se corta en ellas y no se mira el trozo que las cruza.
 */
const fuente = await readFile(new URL('../docs/reglamento-v1.0.md', import.meta.url), 'utf8')
const soloLetras = (t) => t.normalize('NFC').replace(/[^\p{L}\p{N}]/gu, '').toLowerCase()
function muestrasDe(trozo) {
  const muestras = []
  for (const linea of trozo.split('\n')) {
    const t = linea.replace(/^[\s>]*/, '')
    if (!t || t.startsWith('[!') || t.startsWith('|') || t.startsWith('#') || t.startsWith('<!--') || t.startsWith('*Véase también')) continue
    const limpio = t.replace(/^(\d+\.|[-*])\s+/, '')
    for (const tramo of limpio.split(/\(?\b[Vv]er (?:«[^»]+»|[A-ZÁÉÍÓÚ][\p{L} ]+)(?:, al final de este libro)?\)?/u)) {
      const letras = soloLetras(tramo)
      for (let i = 0; i + 24 <= letras.length || (i === 0 && letras.length >= 12); i += 40) {
        muestras.push({ linea: t.slice(0, 50), letras: letras.slice(i, i + 24) })
      }
    }
  }
  return muestras
}
const parte = (desde, hasta) => fuente.slice(fuente.indexOf(desde), hasta ? fuente.indexOf(hasta) : undefined)
const comoUsar = parte('## Cómo usar', '## Parte 1')
const MUESTRAS = {
  'aprende-a-jugar': muestrasDe(comoUsar + parte('## Parte 1', '## Parte 2')),
  'referencia-de-reglas': muestrasDe(comoUsar + parte('## Parte 2', '## Referencia rápida')),
}

/** En el navegador: los problemas de cada página. */
function revisar([arteDeCarta, muestras]) {
  const MM = 96 / 25.4
  const problemas = []
  const paginas = [...document.querySelectorAll('.pagedjs_page')]
  const artes = paginas.map((p) => new Set([...p.querySelectorAll('[data-arte]')].map((e) => e.dataset.arte)))
  const cruza = (a, b) => a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1
  const enBlanco = []
  paginas.forEach((pagina, i) => {
    const n = i + 1
    const hoja = pagina.getBoundingClientRect()
    if (pagina.classList.contains('pagedjs_blank_page')) enBlanco.push(pagina.querySelector('.lamina') ? `${n} (lámina: ${pagina.querySelector('.lamina').dataset.arte})` : `${n} (rosa)`)
    // Marcas de texto pendiente.
    for (const p of pagina.querySelectorAll('.pendiente')) {
      if (p.closest('.creditos')) continue
      problemas.push(`pág. ${n}: queda «${(p.textContent ?? '').trim()}»`)
    }
    // Páginas de texto casi vacías (unas pocas líneas que no cupieron en la anterior).
    const contenidoPagina = pagina.querySelector('.pagedjs_page_content')
    const marco = contenidoPagina?.getBoundingClientRect()
    if (marco && !pagina.classList.contains('pagedjs_blank_page') && !pagina.querySelector('.cubierta, .contraportada, .creditos')) {
      const partes = [...contenidoPagina.querySelectorAll('p, li, h2, h3, h4, table, figure, .ejemplo, .importante, .ancho, .miniatura, .letra, .vease')]
        .filter((e) => !e.closest('.nota-tema, .vineta, .consejo, .pestanas-letras'))
        .flatMap((e) => [...e.getClientRects()])
        .filter((x) => x.height > 0 && x.left < hoja.right)
      const fin = partes.length ? Math.max(...partes.map((x) => x.bottom)) : marco.top
      const ocupado = (fin - marco.top) / marco.height
      if (ocupado < 0.15) problemas.push(`pág. ${n}: casi vacía (solo ${Math.round(ocupado * 100)} % de su alto ocupado)`)
    }
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
      // Fase 10c: las cartas de Peligro son tarot (420 px de ancho sin escalar).
      const escala = carta ? carta.getBoundingClientRect().width / 420 : 0
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
  // Ilustraciones de adorno (cabeceras, viñetas y láminas): ninguna repite en su doble página (la par, a la izquierda,
  // con la impar siguiente) una ilustración de una carta o de otro adorno.
  paginas.forEach((pagina, i) => {
    const pareja = pagina.classList.contains('pagedjs_left_page') ? paginas[i + 1] : paginas[i - 1]
    for (const v of pagina.querySelectorAll('.vineta, .cabecera-arte, .lamina')) {
      const otras = [pagina, pareja].filter(Boolean).flatMap((p) => [...p.querySelectorAll('[data-arte], [data-carta]')]).filter((e) => e !== v && !v.contains(e))
      const repetida = otras.find((e) => (e.dataset.arte ?? arteDeCarta[e.dataset.carta]) === v.dataset.arte)
      if (repetida) problemas.push(`pág. ${i + 1}: «${v.className.split(' ')[0]}» repite la ilustración ${v.dataset.arte}, que ya sale en su doble página (${repetida.dataset.carta ? `carta ${repetida.dataset.carta}` : repetida.className.split(' ')[0]})`)
    }
  })
  // Palabras partidas entre dos páginas: un bloque que sigue en la página siguiente acaba en letra y su continuación
  // empieza en letra.
  for (const fin of document.querySelectorAll('[data-split-to]')) {
    const ref = fin.getAttribute('data-ref')
    const sigue = ref ? document.querySelector(`[data-ref="${ref}"][data-split-from]`) : null
    if (!sigue) continue
    // Paged.js pone su propio guion (‑, U+2011) al partir una palabra.
    const a = (fin.textContent ?? '').replace(/\s+$/, '')
    const b = (sigue.textContent ?? '').replace(/^\s+/, '')
    if (/\p{L}[\u2011\u00AD-]?$/u.test(a) && !/\s$/.test(fin.textContent ?? '') && /^\p{Ll}/u.test(b)) {
      const n = paginas.findIndex((p) => p.contains(fin)) + 1
      problemas.push(`pág. ${n}: la palabra «${a.split(/\s/).pop()}…${b.split(/\s/)[0]}» queda partida entre esta página y la siguiente`)
    }
  }
  // Nada perdido fuera de su página (Paged.js deja a la derecha, oculto, lo que no ha sabido colocar).
  for (const e of document.querySelectorAll('.pagedjs_page :is(.nota-tema, .consejo, .ejemplo, .importante, .ancho, figure)')) {
    const pagina = e.closest('.pagedjs_page')
    const area = pagina.querySelector('.pagedjs_page_content').getBoundingClientRect()
    const r = e.getBoundingClientRect()
    if (r.width > 0 && (r.left >= area.right - 1 || r.right <= area.left + 1)) {
      problemas.push(`pág. ${paginas.indexOf(pagina) + 1}: «${e.className.split(' ')[0]}» («${(e.textContent ?? '').replace(/\u00AD/g, '').trim().slice(0, 40)}») queda fuera de la página: se pierde`)
    }
  }
  // Cada línea de texto del reglamento sale en el libro (en lo que se ve de sus páginas).
  const visible = paginas
    .map((p) => {
      // Lo que Paged.js deja para la página siguiente queda en una columna oculta a la derecha del área de texto (dentro de
      // la hoja): no se ve. De un texto partido en varias líneas, solo cuentan las que caen dentro del área.
      const contenido = p.querySelector('.pagedjs_page_content') ?? p
      const area = contenido.getBoundingClientRect()
      const textos = document.createTreeWalker(contenido, NodeFilter.SHOW_TEXT)
      let t = ''
      for (let n = textos.nextNode(); n; n = textos.nextNode()) {
        const el = n.parentElement
        // (Los números de página de las remisiones no están en el reglamento.)
        if (!el || el.closest('.pestanas-letras, a.pagref, a.num-pag')) continue
        const rango = document.createRange()
        rango.selectNodeContents(n)
        const trozos = [...rango.getClientRects()].filter((r) => r.width > 0)
        if (trozos.length > 0 && trozos.every((r) => r.left >= area.right - 1)) continue
        t += n.textContent
      }
      return t
    })
    .join('')
    .normalize('NFC')
    .replace(/[^\p{L}\p{N}]/gu, '')
    .toLowerCase()
  const faltan = new Set(muestras.filter((m) => !visible.includes(m.letras)).map((m) => m.linea))
  for (const linea of faltan) problemas.push(`no sale entero en el libro: «${linea}…»`)
  // Cada número de página de una remisión («pág. 12», «Tesoros²⁶», el índice) es el de la página donde está su ancla.
  for (const a of document.querySelectorAll('.pagedjs_page a.num-pag, .pagedjs_page a.pagref')) {
    const id = decodeURIComponent((a.getAttribute('href') ?? '').slice(1))
    const ancla = id ? document.querySelector(`.pagedjs_page [id="${CSS.escape(id)}"]`) : null
    const real = ancla ? paginas.indexOf(ancla.closest('.pagedjs_page')) + 1 : 0
    const escrito = Number((a.textContent ?? '').trim() || getComputedStyle(a, '::after').content.replace(/"/g, ''))
    if (!real || escrito !== real) problemas.push(`pág. ${paginas.indexOf(a.closest('.pagedjs_page')) + 1}: la remisión a «${id}» dice pág. ${escrito || '?'} y está en la ${real || '?'}`)
  }
  // El ejemplo de juego, a doble página: el panel del puerto en la par y el de la misión en la impar siguiente.
  const ejemplo = document.querySelector('.ejemplo-de-juego')
  if (ejemplo) {
    const pagDe = (sel) => paginas.findIndex((p) => p.querySelector(sel))
    const puerto = pagDe('.panel-puerto')
    const mision = pagDe('.panel-mision')
    if (puerto < 0 || mision < 0) problemas.push('el ejemplo de juego no tiene sus dos paneles (el del puerto y el de la misión)')
    else if (mision !== puerto + 1 || !paginas[puerto].classList.contains('pagedjs_left_page')) problemas.push(`el ejemplo de juego no queda a doble página (paneles en las págs. ${puerto + 1} y ${mision + 1})`)
  }
  return { problemas, enBlanco, paginas: paginas.length, vinetas: document.querySelectorAll('.vineta').length, cabeceras: document.querySelectorAll('.cabecera-arte').length }
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
    const r = await pagina.evaluate(revisar, [ARTE_DE_CARTA, MUESTRAS[fichero]])
    const lista = [...new Set([...r.problemas, ...errores])]
    console.log(`${fichero}: ${r.paginas} páginas, ${r.cabeceras} cabeceras ilustradas, ${r.vinetas} viñetas${lista.length ? '' : ', sin problemas'}`)
    if (r.enBlanco.length) console.log(`  sin texto, porque lo que sigue empieza en página par: pág. ${r.enBlanco.join(', ')}`)
    for (const p of lista) console.log(`  ${p}`)
    fallos += lista.length
    await pagina.close()
  }
} finally {
  await navegador.close()
  await new Promise((ok) => servidor.httpServer.close(ok))
}
if (fallos) process.exitCode = 1
