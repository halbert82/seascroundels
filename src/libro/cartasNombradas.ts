// Qué cartas nombra un texto del reglamento (para dibujarlas en pequeño junto a sus ejemplos).
// Se buscan los nombres impresos: de cada carta, de cada encuentro y del Destino de los Peligros, y los nombres
// de pila de los Capitanes («Diego», «Catalina»).

import { CATALOGO, type EntradaCatalogo } from '../engine/catalogo.ts'

interface Nombre {
  texto: string
  id: string
}

function nombresDe(e: EntradaCatalogo): string[] {
  switch (e.tipo) {
    case 'peligro': {
      if (e.carta.retirada) return []
      const encuentros = Object.values(e.carta.encuentros).map((x) => x.nombre)
      return [e.carta.nombre, ...encuentros, e.carta.destino.nombre]
    }
    case 'mazoPropio':
      return [e.carta.nombre, e.carta.encuentro.nombre, e.carta.destino.nombre]
    case 'capitan':
      return [e.carta.nombre, e.carta.nombre.split(' ')[0] ?? '']
    case 'barco':
      return [e.carta.nombre]
    default:
      return 'nombre' in e.carta ? [e.carta.nombre] : []
  }
}

let indice: Nombre[] | null = null

function nombres(): Nombre[] {
  if (indice) return indice
  const lista: Nombre[] = []
  const vistos = new Set<string>()
  for (const e of CATALOGO) {
    for (const texto of nombresDe(e)) {
      // Nombres demasiado cortos o genéricos darían falsos positivos.
      if (texto.length < 4 || vistos.has(texto)) continue
      vistos.add(texto)
      lista.push({ texto, id: e.id })
    }
  }
  // Los más largos primero: «Bucanero veterano» antes que un nombre que esté dentro de él.
  indice = lista.sort((a, b) => b.texto.length - a.texto.length)
  return indice
}

const LETRA = /[\p{L}\p{N}]/u

/** Cartas nombradas en el texto, en el orden en que salen (sin repetir), como mucho `maximo`. */
export function cartasNombradas(texto: string, maximo = 5): string[] {
  const ocupado = new Array<boolean>(texto.length).fill(false)
  const encontradas: { pos: number; id: string }[] = []
  for (const n of nombres()) {
    let desde = 0
    for (let pos = texto.indexOf(n.texto, desde); pos >= 0; pos = texto.indexOf(n.texto, desde)) {
      desde = pos + n.texto.length
      const antes = texto[pos - 1] ?? ' '
      const despues = texto[pos + n.texto.length] ?? ' '
      if (LETRA.test(antes) || LETRA.test(despues)) continue
      if (ocupado.slice(pos, pos + n.texto.length).some(Boolean)) continue
      for (let i = pos; i < pos + n.texto.length; i++) ocupado[i] = true
      encontradas.push({ pos, id: n.id })
    }
  }
  const ids: string[] = []
  for (const { id } of encontradas.sort((a, b) => a.pos - b.pos)) {
    if (!ids.includes(id)) ids.push(id)
  }
  return ids.slice(0, maximo)
}
