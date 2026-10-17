// Quedarte en puerto: dos opciones distintas de la carta de puerto, en el orden que quieras.

import { DATOS } from '../datos.ts'
import { anotar, copia, encolar, nombre, nombres } from '../estado.ts'
import { primerNumero } from '../textos.ts'
import type { Estado, NuevaTarea, Opcion } from '../tipos.ts'
import { arriba, mover } from '../zonas.ts'
import { eleccionDe, preguntar, type Manejador } from './comun.ts'

interface OpcionPuerto extends Opcion {
  tareas: NuevaTarea[]
}

/** Opciones de la carta de puerto, leídas de sus textos. */
export function opcionesDelPuerto(s: Estado): OpcionPuerto[] {
  const puerto = DATOS.puertos.find((p) => p.id === s.puerto)
  if (!puerto) throw new Error(`Puerto desconocido: ${s.puerto}`)
  const opciones: OpcionPuerto[] = []
  for (const texto of puerto.opcionesComunes) {
    const titulo = /\*\*(.+?)\.\*\*/.exec(texto)?.[1] ?? ''
    if (titulo === 'Astillero') {
      const n = primerNumero(texto)
      opciones.push({ clave: 'astillero', texto: `Astillero: repara ${n}`, tareas: [{ tipo: 'reparar', n }] })
    } else if (titulo === 'Taberna') {
      const n = primerNumero(texto)
      opciones.push({ clave: 'taberna', texto: `Taberna: cura ${n}`, tareas: [{ tipo: 'curar', n, modo: 'repartir' }] })
    } else if (titulo === 'Tablón de encargos') {
      opciones.push({ clave: 'tablon', texto: 'Tablón de encargos: cambia misiones', tareas: [{ tipo: 'tablon' }] })
    } else {
      throw new Error(`Opción de puerto desconocida: ${texto}`)
    }
  }
  if (puerto.id === 'tortuga') {
    opciones.push({ clave: 'propia', texto: `${puerto.habilidadPropia.nombre}: 2 de Avance en una misión`, tareas: [{ tipo: 'soplos' }] })
  }
  // TODO: Nassau (Entrenamiento) no se usa en la versión 0; se implementará si se elige ese puerto.
  return opciones
}

export const quedarseEnPuerto: Manejador<'quedarseEnPuerto'> = (s, t, e) => {
  if (t.elegidas.length >= 2) return 'hecha'
  const opciones = opcionesDelPuerto(s).filter((o) => !t.elegidas.includes(o.clave))
  if (!e) {
    return preguntar({
      tipo: 'elegirOpcion',
      motivo: { clave: 'opcionPuerto', n: t.elegidas.length + 1 },
      opciones: opciones.map(({ clave, texto }) => ({ clave, texto })),
    })
  }
  const clave = eleccionDe(e, 'opcion').clave
  const opcion = opciones.find((o) => o.clave === clave)
  if (!opcion) throw new Error(`Opción de puerto no disponible: ${clave}`)
  t.elegidas.push(clave)
  anotar(s, 'jugada', `En puerto: ${opcion.texto}.`)
  encolar(s, ...opcion.tareas)
  return 'sigue'
}

/** Tablón de encargos: pon al fondo del mazo de Misiones las misiones disponibles que quieras. Repón. */
export const tablon: Manejador<'tablon'> = (s, _t, e) => {
  if (!e) {
    return preguntar({
      tipo: 'elegirCartas',
      motivo: { clave: 'tablon' },
      candidatas: [...s.zonas.misionesDisponibles],
      min: 0,
      max: s.zonas.misionesDisponibles.length,
    })
  }
  const ids = eleccionDe(e, 'cartas').ids
  for (const m of ids) mover(s, m, 'mazoMisiones', 'abajo') // Sus fichas de Avance se descartan.
  if (ids.length > 0) anotar(s, 'efecto', `Al fondo del mazo de Misiones: ${nombres(s, ids)}.`)
  encolar(s, { tipo: 'reponerMisiones' })
  return 'hecha'
}

/** Repón las misiones disponibles hasta tener tres. */
export const reponerMisiones: Manejador<'reponerMisiones'> = (s) => {
  while (s.zonas.misionesDisponibles.length < 3) {
    const m = arriba(s, 'mazoMisiones')
    if (!m) break
    mover(s, m, 'misionesDisponibles', 'abajo')
    s.infoRevelada++
    anotar(s, 'revelar', `Nueva misión disponible: «${nombre(s, m)}».`)
  }
  return 'hecha'
}

/** Soplos de la Hermandad (Tortuga): pon 2 de Avance en una misión disponible. */
export const soplos: Manejador<'soplos'> = (s, _t, e) => {
  const puerto = DATOS.puertos.find((p) => p.id === s.puerto)
  const n = puerto ? primerNumero(puerto.habilidadPropia.texto) : 2
  if (s.zonas.misionesDisponibles.length === 0) return 'hecha'
  if (!e) {
    return preguntar({
      tipo: 'elegirCartas',
      motivo: { clave: 'soplos', n },
      candidatas: [...s.zonas.misionesDisponibles],
      min: 1,
      max: 1,
    })
  }
  const [m] = eleccionDe(e, 'cartas').ids
  if (!m) return 'hecha'
  copia(s, m).avance += n
  anotar(s, 'efecto', `Pones ${n} de Avance en «${nombre(s, m)}».`)
  return 'hecha'
}
