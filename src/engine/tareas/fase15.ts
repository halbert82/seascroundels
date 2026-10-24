// Fase 15: pasos nuevos de las cartas de Peligro y de las misiones nuevas que no son de una sola carta.

import { porId } from '../catalogo.ts'
import { reglasPermanente } from '../definiciones.ts'
import { anotar, copia, encolar, nombre, nombres } from '../estado.ts'
import type { CartaId, Destina, Estado, InstId } from '../tipos.ts'
import { mover } from '../zonas.ts'
import { agotar } from '../estados.ts'
import { cifraDeDestina, habilidadAlAgotarse, quienesDestinanSolos } from '../valores.ts'
import { eleccionDe, preguntar, type Manejador } from './comun.ts'

/**
 * «Descarta la carta superior (las N cartas superiores) de tu mazo del capitán.» Si el mazo está vacío, no se descarta
 * nada ni se baraja la pila de descartes (como «Dados cargados», P40); si quedan menos, se descartan las que haya.
 */
export const descartarMazoCapitan: Manejador<'descartarMazoCapitan'> = (s, t) => {
  const cartas = s.zonas.mazoCapitan.slice(0, t.n)
  for (const c of cartas) mover(s, c, 'descartesCapitan')
  if (cartas.length > 0) {
    s.infoRevelada++
    anotar(s, 'revelar', `Descartas de arriba de tu mazo del capitán: ${nombres(s, cartas)}.`)
  } else anotar(s, 'efecto', 'Tu mazo del capitán está vacío: no descartas nada.')
  return 'hecha'
}

/**
 * Pone en juego una permanente que está en el mazo de historia (en la zona de permanentes, junto a la misión) y le pone
 * sus fichas iniciales. Devuelve la copia, o null si no estaba en el mazo de historia.
 */
export function ponerEnJuegoDesdeHistoria(s: Estado, id: CartaId): InstId | null {
  const carta = s.zonas.mazoHistoria.find((c) => copia(s, c).id === id)
  if (!carta) return null
  mover(s, carta, 'permanentes', 'abajo')
  const q = reglasPermanente(id)
  if (q?.contador || q?.fichasIniciales) copia(s, carta).fichas = q.fichasIniciales ?? 0
  anotar(s, 'aviso', `Pones en juego «${nombre(s, carta)}» (carta ${porId(id).num} del mazo de historia).`)
  if (q?.alEntrar && q.alEntrar.length > 0) encolar(s, { tipo: 'aplicarEfectos', efectos: q.alEntrar, contexto: 'efecto', fuente: carta })
  return carta
}

/** «Pon en juego la carta N del mazo de historia; si ya está en juego, …» desde un recuadro de efecto. */
export const ponerEnJuego: Manejador<'ponerEnJuego'> = (s, t) => {
  if (ponerEnJuegoDesdeHistoria(s, t.carta)) return 'hecha'
  if (t.siYa && t.siYa.length > 0) {
    anotar(s, 'efecto', `«${porId(t.carta).carta.nombre}» ya está en juego.`)
    encolar(s, { tipo: 'aplicarEfectos', efectos: t.siYa, contexto: 'efecto' })
  }
  return 'hecha'
}

/**
 * «Destina X [habilidad]»: eliges a qué Tripulantes preparados agotas; su habilidad, sumada (con bonificaciones, como al
 * cubrir una Distancia), tiene que llegar a X. Se pregunta como una Distancia sin cartas de la mano. «Con un solo
 * Tripulante» («Ojos amarillos en la espesura»): eliges a uno de los que llegan solos.
 */
export const destina: Manejador<'destina'> = (s, t, e) => {
  const n = cifraDeDestina(s, t)
  if (t.solo) {
    const candidatos = quienesDestinanSolos(s, t)
    if (candidatos.length === 0) return 'hecha'
    const elegido = candidatos.length === 1 ? candidatos[0] : e ? eleccionDe(e, 'cartas').ids.find((c) => candidatos.includes(c)) : undefined
    if (!elegido) {
      return preguntar({ tipo: 'elegirCartas', motivo: { clave: 'destinaSolo', n, texto: textoDestina(t, n) }, candidatas: candidatos, min: 1, max: 1 })
    }
    agotar(s, elegido)
    const alt = t.alternativa
    const hab = habilidadAlAgotarse(s, [elegido], t.hab) >= n || !alt ? t.hab : alt.hab
    anotar(s, 'pagar', `Destinas ${habilidadAlAgotarse(s, [elegido], hab)} de ${hab}: agotas a ${nombre(s, elegido)}.`)
    if (s.prueba && !s.prueba.agotadas.includes(elegido)) s.prueba.agotadas.push(elegido)
    return 'hecha'
  }
  const preparados = s.zonas.tripulacion.filter((c) => !copia(s, c).agotada)
  if (!e) {
    return preguntar({ tipo: 'cubrirDistancia', motivo: { clave: 'destina', n, texto: t.hab }, distancia: n, tripulantes: preparados, cartas: [] })
  }
  const ids = eleccionDe(e, 'cartas').ids.filter((c) => preparados.includes(c))
  for (const c of ids) agotar(s, c)
  anotar(s, 'pagar', `Destinas ${habilidadAlAgotarse(s, ids, t.hab)} de ${t.hab}: agotas a ${nombres(s, ids)}.`)
  if (s.prueba) for (const c of ids) if (!s.prueba.agotadas.includes(c)) s.prueba.agotadas.push(c)
  return 'hecha'
}

/** «Destina 6 COM con un solo Tripulante (4 EXP si es un Explorador)», para la pregunta. */
function textoDestina(d: Destina, n: number): string {
  const alt = d.alternativa ? ` (${d.alternativa.n} ${d.alternativa.hab} si es un ${d.alternativa.rasgo})` : ''
  return `${n} ${d.hab}${d.solo ? ' con un solo Tripulante' : ''}${alt}`
}
