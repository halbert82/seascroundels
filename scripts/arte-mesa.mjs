// Copias pequeñas de las ilustraciones para la mesa y la galería (assets/arte/mesa/).
//
// Las ilustraciones van grandes en assets/arte/ (1312 px de ancho, 768 las verticales) porque el reglamento las usa a
// todo el ancho de la página y en papel se verían blandas. En la mesa, una carta nunca se ve a más de unos 378 px de
// ancho (su tamaño de diseño), así que basta con el doble: 756 px las apaisadas y cuadradas, y 440 las verticales
// (misiones y puertos, que ocupan una franja de 214 px). Las que ya son así de pequeñas no llevan copia.
//
//   npm run arte:mesa      (después de añadir o cambiar una ilustración)

import { mkdir, readdir, rm } from 'node:fs/promises'
import sharp from 'sharp'

const origen = new URL('../assets/arte/', import.meta.url)
const destino = new URL('../assets/arte/mesa/', import.meta.url)
await rm(destino, { recursive: true, force: true })
await mkdir(destino, { recursive: true })

let copias = 0
for (const nombre of (await readdir(origen)).filter((f) => f.endsWith('.jpg')).sort()) {
  const imagen = sharp(new URL(nombre, origen).pathname)
  const { width = 0, height = 0 } = await imagen.metadata()
  const ancho = width >= height ? 756 : 440
  if (width <= ancho + 20) continue
  await imagen.resize({ width: ancho }).jpeg({ quality: 84, mozjpeg: true }).toFile(new URL(nombre, destino).pathname)
  copias++
}
console.log(`${copias} copias pequeñas en assets/arte/mesa/`)
