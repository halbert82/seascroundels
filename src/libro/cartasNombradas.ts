// Qué cartas nombra un texto del reglamento (para dibujarlas junto a sus ejemplos).
// Se buscan los nombres impresos: de cada carta, de cada encuentro y del Destino de los Peligros, y los nombres
// de pila de los Capitanes («Diego», «Catalina»). De los Peligros se apunta además qué parte se nombra (el encuentro
// de un Entorno o el Destino): los ejemplos enseñan solo esa parte, recortada y a un tamaño en que se lea.

import { CATALOGO, type EntradaCatalogo } from '../engine/catalogo.ts'
import type { Entorno } from '../engine/datos.ts'

/** Parte de una carta de Peligro: el encuentro de un Entorno, el único encuentro (mazo propio) o el Destino. */
export type ParteCarta = Entorno | 'encuentro' | 'destino'

interface Nombre {
  texto: string
  id: string
  /** Qué parte de la carta lleva ese nombre (sin parte: el nombre de la carta). */
  parte?: ParteCarta
}

function nombresDe(e: EntradaCatalogo): { texto: string; parte?: ParteCarta }[] {
  switch (e.tipo) {
    case 'peligro': {
      if (e.carta.retirada) return []
      const encuentros = Object.entries(e.carta.encuentros).map(([entorno, x]) => ({ texto: x.nombre, parte: entorno as Entorno }))
      return [{ texto: e.carta.nombre }, ...encuentros, { texto: e.carta.destino.nombre, parte: 'destino' }]
    }
    case 'mazoPropio':
      return [{ texto: e.carta.nombre }, { texto: e.carta.encuentro.nombre, parte: 'encuentro' }, { texto: e.carta.destino.nombre, parte: 'destino' }]
    case 'capitan':
      return [{ texto: e.carta.nombre }, { texto: e.carta.nombre.split(' ')[0] ?? '' }]
    case 'barco':
      return [{ texto: e.carta.nombre }]
    default:
      return 'nombre' in e.carta ? [{ texto: e.carta.nombre }] : []
  }
}

let indice: Nombre[] | null = null

function nombres(): Nombre[] {
  if (indice) return indice
  const lista: Nombre[] = []
  const vistos = new Set<string>()
  for (const e of CATALOGO) {
    for (const { texto, parte } of nombresDe(e)) {
      // Nombres demasiado cortos o genéricos darían falsos positivos.
      if (texto.length < 4 || vistos.has(texto)) continue
      vistos.add(texto)
      lista.push({ texto, id: e.id, ...(parte ? { parte } : {}) })
    }
  }
  // Los más largos primero: «Bucanero veterano» antes que un nombre que esté dentro de él.
  indice = lista.sort((a, b) => b.texto.length - a.texto.length)
  return indice
}

const LETRA = /[\p{L}\p{N}]/u

/** Una carta nombrada en un texto y, si es de Peligro, las partes suyas que se nombran (en el orden de la carta). */
export interface CartaNombrada {
  id: string
  partes: ParteCarta[]
}

const ORDEN_PARTES: ParteCarta[] = ['mar', 'nat', 'ciu', 'encuentro', 'destino']

/** Carta de Peligro (o de mazo propio) por su nombre impreso. */
function peligroPorNombre(nombre: string): string | null {
  const e = CATALOGO.find((x) => (x.tipo === 'peligro' && !x.carta.retirada) || x.tipo === 'mazoPropio' ? x.carta.nombre === nombre : false)
  return e?.id ?? null
}

/** Cartas nombradas en el texto, en el orden en que salen (sin repetir), como mucho `maximo`, con sus partes. */
export function cartasYPartes(texto: string, maximo = 5): CartaNombrada[] {
  const ocupado = new Array<boolean>(texto.length).fill(false)
  const encontradas: { pos: number; id: string; parte?: ParteCarta }[] = []
  // Fase 10: los Destinos ya no muestran su nombre; se citan como «el Destino de la carta «X»» (y «el de la carta «X»»).
  for (const m of texto.matchAll(/\b(?:Destino|el|los) de la carta «([^»]+)»/g)) {
    const id = peligroPorNombre(m[1] ?? '')
    if (!id || m.index === undefined) continue
    const inicio = m.index + m[0].indexOf('«')
    for (let i = inicio; i < inicio + (m[1] ?? '').length + 2; i++) ocupado[i] = true
    encontradas.push({ pos: m.index, id, parte: 'destino' })
  }
  for (const n of nombres()) {
    let desde = 0
    for (let pos = texto.indexOf(n.texto, desde); pos >= 0; pos = texto.indexOf(n.texto, desde)) {
      desde = pos + n.texto.length
      const antes = texto[pos - 1] ?? ' '
      const despues = texto[pos + n.texto.length] ?? ' '
      if (LETRA.test(antes) || LETRA.test(despues)) continue
      if (ocupado.slice(pos, pos + n.texto.length).some(Boolean)) continue
      for (let i = pos; i < pos + n.texto.length; i++) ocupado[i] = true
      encontradas.push({ pos, id: n.id, ...(n.parte ? { parte: n.parte } : {}) })
    }
  }
  const cartas: CartaNombrada[] = []
  for (const { id, parte } of encontradas.sort((a, b) => a.pos - b.pos)) {
    let c = cartas.find((x) => x.id === id)
    if (!c) cartas.push((c = { id, partes: [] }))
    if (parte && !c.partes.includes(parte)) c.partes.push(parte)
  }
  for (const c of cartas) c.partes.sort((a, b) => ORDEN_PARTES.indexOf(a) - ORDEN_PARTES.indexOf(b))
  return cartas.slice(0, maximo)
}

/** Cartas nombradas en el texto, en el orden en que salen (sin repetir), como mucho `maximo`. */
export function cartasNombradas(texto: string, maximo = 5): string[] {
  return cartasYPartes(texto, maximo).map((c) => c.id)
}
