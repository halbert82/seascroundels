// Revisa las cartas de Peligro y de mazo propio con el formato 2.0: la letra con la que ha quedado cada una (se ajusta
// sola para que quepa) y si algo se desborda. Fotografía unas cuantas en capturas/peligro-nuevo/, a doble resolución.
//
//   node scripts/capturar-peligros.mjs            → informe + una carta de ejemplo + las tres con más texto + iconos
//   node scripts/capturar-peligros.mjs 154 160    → además, esas cartas
//   node scripts/capturar-peligros.mjs --todas    → todas las cartas 2.0

import { mkdir, realpath, writeFile } from 'node:fs/promises'
import { chromium } from 'playwright'
import { createServer } from 'vite'

const argumentos = process.argv.slice(2)
const todas = argumentos.includes('--todas')
const pedidas = argumentos.filter((a) => !a.startsWith('--')).map((n) => String(Number(n)).padStart(3, '0'))
const destino = new URL('../capturas/peligro-nuevo/', import.meta.url)
await mkdir(destino, { recursive: true })

/** Letra mínima que se acepta sin avisar (px, en la carta a tamaño real de 378 × 528). */
const MINIMO = 9

// En una copia de trabajo, node_modules puede ser un enlace a otra carpeta: se permite servir desde ella (las fuentes).
const raiz = new URL('..', import.meta.url).pathname
const modulos = await realpath(new URL('../node_modules', import.meta.url).pathname)
const servidor = await createServer({ logLevel: 'error', server: { port: 5198, fs: { allow: [raiz, modulos] } } })
await servidor.listen()
const base = servidor.resolvedUrls?.local[0]
if (!base) throw new Error('El servidor de Vite no ha arrancado')

const navegador = await chromium.launch()
try {
  const pagina = await navegador.newPage({ deviceScaleFactor: 2, viewport: { width: 1700, height: 1100 } })
  await pagina.goto(`${base}#/captura`, { waitUntil: 'networkidle' })
  await pagina.waitForSelector('[data-captura="153"]')
  await pagina.evaluate(() => document.fonts.ready)
  // Las fuentes pueden llegar después del primer ajuste: se fuerza otro pintado.
  await pagina.waitForTimeout(300)

  const informe = await pagina.evaluate(() =>
    [...document.querySelectorAll('[data-captura]')]
      .map((el) => {
        const carta = el.querySelector('.card.enc.v2')
        if (!carta) return null
        const cajas = [...carta.querySelectorAll('.encb, .dest')]
        const desbordes = cajas.filter((x) => x.scrollHeight > x.clientHeight + 0.5 || x.scrollWidth > x.clientWidth + 0.5).length
        const encuentros = [...carta.querySelectorAll('.encp')].map((e) => e.querySelector('.encn')?.textContent ?? '')
        return {
          num: el.getAttribute('data-captura'),
          solo: carta.classList.contains('solo'),
          letra: parseFloat(carta.style.getPropertyValue('--fs2')),
          desbordes,
          texto: (carta.textContent ?? '').length,
          encuentros,
        }
      })
      .filter(Boolean),
  )

  informe.sort((a, b) => a.letra - b.letra || b.texto - a.texto)
  const lineas = informe.map(
    (c) =>
      `${c.num}  ${String(c.letra).padStart(4)} px  ${c.desbordes ? `DESBORDA (${c.desbordes})` : 'cabe'}  ${String(c.texto).padStart(4)} letras  ${c.solo ? '[mazo propio] ' : ''}${c.encuentros.join(' · ')}`,
  )
  console.log(lineas.join('\n'))
  const pequenas = informe.filter((c) => c.letra < MINIMO)
  const desbordadas = informe.filter((c) => c.desbordes > 0)
  console.log(
    `\n${informe.length} cartas 2.0 · letra mínima ${Math.min(...informe.map((c) => c.letra))} px · por debajo de ${MINIMO} px: ${pequenas.length} · desbordadas: ${desbordadas.length}`,
  )
  await writeFile(new URL('informe.txt', destino), lineas.join('\n') + '\n')

  const peligros = informe.filter((c) => !c.solo)
  const masTexto = [...peligros].sort((a, b) => b.texto - a.texto).slice(0, 3)
  const ejemplo = peligros.find((c) => c.num === '095') ?? peligros[0]
  const aFotografiar = new Map()
  if (ejemplo) aFotografiar.set(ejemplo.num, 'ejemplo')
  for (const c of masTexto) aFotografiar.set(c.num, 'mas-texto')
  const propio = [...informe].filter((c) => c.solo).sort((a, b) => b.texto - a.texto)[0]
  if (propio) aFotografiar.set(propio.num, 'mazo-propio')
  for (const n of pedidas) aFotografiar.set(n, 'pedida')
  if (todas) for (const c of informe) if (!aFotografiar.has(c.num)) aFotografiar.set(c.num, 'todas')

  for (const [num, motivo] of aFotografiar) {
    const nombre = motivo === 'todas' || motivo === 'pedida' ? `${num}.png` : `${motivo}-${num}.png`
    await pagina.locator(`[data-captura="${num}"] .card`).screenshot({ path: new URL(nombre, destino).pathname, animations: 'disabled' })
  }
  console.log(`Fotografiadas: ${[...aFotografiar].map(([n, m]) => `${n} (${m})`).join(', ')}`)

  // Los iconos de curar y de quitar un Estado, a tamaño de texto y grandes, sobre pergamino y sobre la franja oscura.
  await pagina.evaluate(() => {
    const hoja = document.createElement('div')
    hoja.id = 'hoja-iconos'
    hoja.style.cssText =
      'position:absolute;left:0;top:0;z-index:99;padding:24px 28px;background:radial-gradient(ellipse at 50% 35%,#FBF5E7 0%,#F2E6CD 68%,#E6D6B4 100%);font-family:Alegreya Sans,sans-serif;color:#2A2118;display:flex;flex-direction:column;gap:14px'
    const fila = (tam, fondo = '', verde = '#3D6631', rojo = '#8E2B23') =>
      `<div class="rules" style="font-size:${tam}px;line-height:1.3;${fondo}">` +
      `<span style="display:inline-block;width:4.5em;font-size:11px;color:#7A6248">${tam} px</span>` +
      `Cura <span class="num" style="color:${verde}">1 <span class="ic i-curar"></span></span> y quita ` +
      `<span class="num" style="color:${verde}">1 <span class="ic i-quitarestado"></span></span> a un Tripulante. ` +
      `<span class="ic i-curar" style="color:${rojo}"></span> <span class="ic i-quitarestado" style="color:${rojo}"></span></div>`
    hoja.innerHTML =
      [10, 11, 12, 13, 14, 17].map((t) => fila(t)).join('') +
      fila(14, 'background:#2A1E15;color:#EADCBF;padding:6px 8px;border-radius:6px;', '#9CC98A', '#F4A08C') +
      `<div style="display:flex;gap:36px;align-items:center;margin-top:6px">` +
      ['curar', 'quitarestado']
        .map(
          (i) =>
            `<div style="display:flex;flex-direction:column;align-items:center;gap:6px"><span class="ic i-${i}" style="font-size:128px;color:#2A2118"></span><span style="font-size:13px;color:#7A6248">${i}</span></div>`,
        )
        .join('') +
      ['curar', 'quitarestado'].map((i) => `<span class="ic i-${i}" style="font-size:48px;color:#3D6631"></span>`).join('') +
      `</div>`
    document.body.appendChild(hoja)
  })
  await pagina.locator('#hoja-iconos').screenshot({ path: new URL('iconos.png', destino).pathname })
  console.log(`Capturas en ${destino.pathname}`)
  if (desbordadas.length) process.exitCode = 1
} finally {
  await navegador.close()
  await servidor.close()
}
