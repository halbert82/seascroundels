// Compara cada captura (capturas/actual/NNN.png) con su imagen de referencia
// (referencia/cartas/NNN.webp). Escribe en capturas/comparar/NNN.png una lámina
// «referencia | dibujada | diferencia» y un informe ordenado de más a menos diferente.
//
//   npm run comparar            → todas las capturas que haya
//   npm run comparar -- 1 77    → solo esas

import { mkdir, readdir, writeFile } from 'node:fs/promises'
import sharp from 'sharp'

const raiz = new URL('../', import.meta.url)
const dirActual = new URL('capturas/actual/', raiz)
const dirComparar = new URL('capturas/comparar/', raiz)
await mkdir(dirComparar, { recursive: true })

const soloEstas = new Set(process.argv.slice(2).map((n) => String(Number(n)).padStart(3, '0')))
const nums = (await readdir(dirActual))
  .filter((f) => f.endsWith('.png'))
  .map((f) => f.slice(0, 3))
  .filter((n) => soloEstas.size === 0 || soloEstas.has(n))
  .sort()

/** Umbral (0–255) a partir del cual un píxel cuenta como distinto. */
const UMBRAL = 48

const resultados = []
for (const num of nums) {
  const actual = sharp(new URL(`${num}.png`, dirActual).pathname).removeAlpha()
  const { width: ancho = 0, height: alto = 0 } = await actual.metadata()
  const actPix = await actual.raw().toBuffer()

  // Algunas referencias tienen una o dos filas de más (artefacto de la captura original):
  // se recortan con el desplazamiento vertical que mejor alinea, en vez de estirarlas.
  const refImg = sharp(new URL(`referencia/cartas/${num}.webp`, raiz).pathname).removeAlpha()
  const { width: anchoRef = 0, height: altoRef = 0 } = await refImg.metadata()
  const refTodo = await refImg.raw().toBuffer()
  let mejor = { dy: 0, coste: Infinity }
  for (let dy = 0; dy <= Math.max(0, altoRef - alto); dy++) {
    let coste = 0
    for (let y = 0; y < Math.min(alto, altoRef - dy); y += 3) {
      for (let x = 0; x < Math.min(ancho, anchoRef); x += 3) {
        const a = (y * ancho + x) * 3
        const r = ((y + dy) * anchoRef + x) * 3
        coste += Math.abs((actPix[a] ?? 0) - (refTodo[r] ?? 0)) + Math.abs((actPix[a + 1] ?? 0) - (refTodo[r + 1] ?? 0))
      }
    }
    if (coste < mejor.coste) mejor = { dy, coste }
  }
  const refPix = Buffer.alloc(actPix.length)
  for (let y = 0; y < alto; y++) {
    for (let x = 0; x < ancho; x++) {
      const a = (y * ancho + x) * 3
      const yr = Math.min(altoRef - 1, y + mejor.dy)
      const xr = Math.min(anchoRef - 1, x)
      const r = (yr * anchoRef + xr) * 3
      refPix[a] = refTodo[r] ?? 0
      refPix[a + 1] = refTodo[r + 1] ?? 0
      refPix[a + 2] = refTodo[r + 2] ?? 0
    }
  }

  const dif = Buffer.alloc(refPix.length)
  let suma = 0
  let distintos = 0
  for (let i = 0; i < refPix.length; i += 3) {
    const dr = Math.abs((refPix[i] ?? 0) - (actPix[i] ?? 0))
    const dg = Math.abs((refPix[i + 1] ?? 0) - (actPix[i + 1] ?? 0))
    const db = Math.abs((refPix[i + 2] ?? 0) - (actPix[i + 2] ?? 0))
    const m = Math.max(dr, dg, db)
    suma += (dr + dg + db) / 3
    if (m > UMBRAL) distintos++
    const v = Math.min(255, m * 3)
    dif[i] = v
    dif[i + 1] = m > UMBRAL ? v * 0.35 : v
    dif[i + 2] = m > UMBRAL ? v * 0.2 : v
  }
  const pixeles = refPix.length / 3
  const media = suma / pixeles
  const porcentaje = (distintos / pixeles) * 100
  resultados.push({ num, media: Number(media.toFixed(2)), distintos: Number(porcentaje.toFixed(2)) })

  // Lámina a resolución normal (la mitad): referencia | dibujada | diferencia.
  const mitad = { width: Math.round(ancho / 2), height: Math.round(alto / 2) }
  const trozos = await Promise.all(
    [refPix, actPix, dif].map((buf) =>
      sharp(buf, { raw: { width: ancho, height: alto, channels: 3 } }).resize(mitad).png().toBuffer(),
    ),
  )
  const hueco = 12
  await sharp({
    create: { width: mitad.width * 3 + hueco * 2, height: mitad.height, channels: 3, background: '#ffffff' },
  })
    .composite(trozos.map((input, i) => ({ input, left: i * (mitad.width + hueco), top: 0 })))
    .png()
    .toFile(new URL(`${num}.png`, dirComparar).pathname)
}

resultados.sort((a, b) => b.distintos - a.distintos)
await writeFile(new URL('capturas/informe.json', raiz), JSON.stringify(resultados, null, 1))
console.log('carta  dif.media  %píxeles distintos')
for (const r of resultados) console.log(`${r.num}    ${String(r.media).padStart(6)}    ${String(r.distintos).padStart(6)}`)
