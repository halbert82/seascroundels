// El turno en 4 pasos (Inicio, Jugar cartas, Quedarte o zarpar, Final) y el cambio de mano inicial.

import { capacidadesDe } from '../capacidades/index.ts'
import { anotar, copia, encolar, nombre } from '../estado.ts'
import type { NuevaTarea } from '../tipos.ts'
import { valor } from '../valores.ts'
import { arriba, mover } from '../zonas.ts'
import { robarCartas } from './cartas.ts'
import { eleccionDe, preguntar, type Manejador } from './comun.ts'

/** Cambio de mano antes del primer turno: descarta las que quieras y roba otras tantas. */
export const cambioMano: Manejador<'cambioMano'> = (s, _t, e) => {
  if (!e) {
    return preguntar({
      tipo: 'elegirCartas',
      motivo: { clave: 'cambiarMano' },
      candidatas: [...s.zonas.mano],
      min: 0,
      max: s.zonas.mano.length,
    })
  }
  const ids = eleccionDe(e, 'cartas').ids
  if (ids.length === 0) {
    anotar(s, 'jugada', 'Te quedas con tu mano inicial.')
    return 'hecha'
  }
  for (const c of ids) mover(s, c, 'descartesCapitan')
  anotar(s, 'jugada', `Cambias ${ids.length} ${ids.length === 1 ? 'carta' : 'cartas'} de tu mano.`)
  robarCartas(s, ids.length)
  return 'hecha'
}

export const turno: Manejador<'turno'> = (s, t, e) => {
  switch (t.paso) {
    case 'inicio': {
      s.turno += 1
      s.paso = 'inicio'
      anotar(s, 'turno', `Turno ${s.turno}`)
      const tareas: NuevaTarea[] = []
      const carta = arriba(s, 'mazoEscenario')
      if (!carta) {
        s.ultimoTurno = true
        anotar(s, 'aviso', 'No queda ninguna carta de Escenario: este es tu último turno.')
      } else {
        mover(s, carta, 'escenarioEnCurso')
        s.infoRevelada++
        anotar(s, 'revelar', `Escenario: «${nombre(s, carta)}».`)
        tareas.push({ tipo: 'aplicarEscenario', carta })
      }
      tareas.push(
        { tipo: 'prepararTodo' },
        { tipo: 'recargar' },
        { tipo: 'evento', ev: { tipo: 'inicioTurno' }, fase: 'antes', cancelado: false, usadas: [] },
        // TODO(regla) N4: la pausa del Inicio va al final del paso (después de preparar y recargar).
        { tipo: 'ventanaLibre', momento: 'inicio' },
      )
      encolar(s, ...tareas)
      t.paso = 'jugar'
      return 'sigue'
    }
    case 'jugar':
      s.paso = 'jugarCartas'
      encolar(s, { tipo: 'ventanaJugar' }, { tipo: 'reponerMuelle' })
      t.paso = 'quedarseOZarpar'
      return 'sigue'
    case 'quedarseOZarpar': {
      s.paso = 'quedarseOZarpar'
      if (!e) {
        return preguntar({
          tipo: 'elegirOpcion',
          motivo: { clave: 'quedarseOZarpar' },
          // TODO fase 3: zarpar a una misión disponible.
          opciones: [{ clave: 'quedarse', texto: 'Quedarte en puerto' }],
        })
      }
      const clave = eleccionDe(e, 'opcion').clave
      if (clave === 'quedarse') {
        anotar(s, 'jugada', 'Te quedas en puerto.')
        encolar(s, { tipo: 'quedarseEnPuerto', elegidas: [] })
      }
      t.paso = 'final'
      return 'sigue'
    }
    case 'final':
      // El descarte va solo: así, mientras se decide, la pila es solo estructura y es una pausa (N2).
      s.paso = 'final'
      encolar(s, { tipo: 'descartarFinal' })
      t.paso = 'robar'
      return 'sigue'
    case 'robar':
      encolar(s, { tipo: 'robarHastaMando' }, { tipo: 'evento', ev: { tipo: 'finTurno' }, fase: 'antes', cancelado: false, usadas: [] })
      t.paso = 'cierre'
      return 'sigue'
    case 'cierre': {
      s.temporales = s.temporales.filter((x) => x.hasta !== 'finTurno')
      // Los límites «una vez por turno» vuelven a estar disponibles.
      for (const clave of Object.keys(s.usos)) if (clave.startsWith('turno:')) delete s.usos[clave]
      for (const c of [...s.zonas.escenarioEnCurso]) mover(s, c, 'descartesEscenario')
      if (s.ultimoTurno) {
        s.resultado = { gana: false, motivo: 'Se ha acabado el tiempo: no quedaban cartas de Escenario.' }
        anotar(s, 'fin', 'Se acaba el tiempo. Has perdido la partida.')
        return 'hecha'
      }
      encolar(s, { tipo: 'turno', paso: 'inicio' })
      return 'hecha'
    }
  }
}

/** Aplica la carta de Escenario revelada. */
export const aplicarEscenario: Manejador<'aplicarEscenario'> = (s, t) => {
  const cap = capacidadesDe(copia(s, t.carta).id).find((c) => c.ventana === 'alRevelar')
  if (!cap) throw new Error(`La carta de Escenario «${nombre(s, t.carta)}» no tiene efecto registrado`)
  encolar(s, ...(cap.efecto?.(s, t.carta, null) ?? []))
  return 'hecha'
}

/** Prepara todas tus cartas agotadas. */
export const prepararTodo: Manejador<'prepararTodo'> = (s) => {
  for (const c of [...s.zonas.tripulacion, ...s.zonas.mejoras]) copia(s, c).agotada = false
  return 'hecha'
}

/** Recarga: las cartas con munición la recuperan hasta su máximo (sin bajar si una carta la subió más). */
export const recargar: Manejador<'recargar'> = (s) => {
  for (const c of s.zonas.mejoras) {
    const maximo = valor(s, { tipo: 'municionMaxima', carta: c })
    if (maximo > 0) copia(s, c).municion = Math.max(copia(s, c).municion, maximo)
  }
  return 'hecha'
}

/** Final, paso 1: descarta las cartas que quieras. Es una pausa: se ofrecen las capacidades sin etiqueta (N2). */
export const descartarFinal: Manejador<'descartarFinal'> = (s, _t, e) => {
  if (!e) {
    return preguntar({
      tipo: 'elegirCartas',
      motivo: { clave: 'descartarFinal' },
      candidatas: [...s.zonas.mano],
      min: 0,
      max: s.zonas.mano.length,
    })
  }
  const ids = eleccionDe(e, 'cartas').ids
  for (const c of ids) mover(s, c, 'descartesCapitan')
  if (ids.length > 0) anotar(s, 'jugada', `Descartas ${ids.length} ${ids.length === 1 ? 'carta' : 'cartas'}.`)
  return 'hecha'
}
