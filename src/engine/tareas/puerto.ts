// Quedarte en puerto: dos opciones distintas de la carta de puerto, en el orden que quieras.

import { DATOS } from '../datos.ts'
import { anotar, copia, encolar, nombre, nombres } from '../estado.ts'
import { quitarEstadosBarco, quitarEstadosTripulacion } from '../estados.ts'
import { primerNumero } from '../textos.ts'
import type { Estado, NuevaTarea, Opcion } from '../tipos.ts'
import { huecosLibres } from '../valores.ts'
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
      // «Repara 3 daños y quita todos los Estados del Barco.» Primero los Estados (regla de oro 5: el orden lo eliges
      // tú), así el primer punto de reparación no se gasta en quitar Anegado.
      const n = primerNumero(texto)
      opciones.push({
        clave: 'astillero',
        texto: `Astillero: repara ${n} y quita los Estados del Barco`,
        tareas: [{ tipo: 'quitarTodosLosEstados', de: 'barco' }, { tipo: 'reparar', n }],
      })
    } else if (titulo === 'Taberna') {
      // «Cura 3 heridas y quita todos los Estados de tus Tripulantes.» Las Ventajas se quedan. Primero los Estados, así la
      // curación no se gasta en quitar Envenenado o Sangrando. «Cuarentena» la cierra un turno.
      if (s.temporales.some((x) => x.clave === 'cuarentena.turno')) continue
      const n = primerNumero(texto)
      opciones.push({
        clave: 'taberna',
        texto: `Taberna: cura ${n} y quita los Estados de tus Tripulantes`,
        tareas: [
          { tipo: 'quitarTodosLosEstados', de: 'tripulacion' },
          { tipo: 'curar', n, modo: 'repartir' },
        ],
      })
    } else if (titulo === 'Tablón de encargos') {
      opciones.push({ clave: 'tablon', texto: 'Tablón de encargos: cambia misiones', tareas: [{ tipo: 'tablon' }] })
    } else {
      throw new Error(`Opción de puerto desconocida: ${texto}`)
    }
  }
  if (puerto.id === 'tortuga') {
    opciones.push({ clave: 'propia', texto: `${puerto.habilidadPropia.nombre}: 2 de Avance en una misión`, tareas: [{ tipo: 'soplos' }] })
  } else if (puerto.id === 'nassau') {
    // «Entrenamiento»: una ficha de +1 a la habilidad que elijas en un Tripulante con hueco libre.
    if (s.zonas.tripulacion.some((c) => huecosLibres(s, c) > 0)) {
      opciones.push({
        clave: 'propia',
        texto: `${puerto.habilidadPropia.nombre}: +1 a una habilidad de un Tripulante`,
        tareas: [{ tipo: 'ponerEntrenamiento', entre: [...s.zonas.tripulacion], hab: null, carta: null }],
      })
    }
  }
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

/** Taberna y Astillero: quitan todos los Estados de tus Tripulantes o del Barco. */
export const quitarTodosLosEstados: Manejador<'quitarTodosLosEstados'> = (s, t) => {
  if (t.de === 'barco') {
    const quitados = quitarEstadosBarco(s)
    if (quitados.length > 0) anotar(s, 'efecto', `El Barco ya no está ${quitados.join(' ni ')}.`)
  } else {
    for (const linea of quitarEstadosTripulacion(s)) anotar(s, 'efecto', `${linea}.`)
  }
  return 'hecha'
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

/** Cuántas misiones disponibles hay: lo dice la carta de puerto (fase 10). */
export function misionesDelPuerto(s: Estado): number {
  return DATOS.puertos.find((p) => p.id === s.puerto)?.misiones ?? 3
}

/** Repón las misiones disponibles hasta tener tantas como indica la carta de puerto. */
export const reponerMisiones: Manejador<'reponerMisiones'> = (s) => {
  while (s.zonas.misionesDisponibles.length < misionesDelPuerto(s)) {
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
