// El turno en 4 pasos (Inicio, Jugar cartas, Quedarte o zarpar, Final) y el cambio de mano inicial.

import { capacidadesDe } from '../capacidades/index.ts'
import { anotar, copia, encolar, nombre } from '../estado.ts'
import { esCanon } from '../catalogo.ts'
import { puedePrepararse } from './peligros2.ts'
import { quitarEstado, tieneEstado } from '../estados.ts'
import type { InstId, NuevaTarea } from '../tipos.ts'
import { puedeZarpar } from './mision.ts'
import { arriba, mover } from '../zonas.ts'
import { robarCartas } from './cartas.ts'
import { quitarFichasDeEnrolado } from './tripulacion.ts'
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
      const carta = s.sinEscenario ? undefined : arriba(s, 'mazoEscenario')
      if (s.sinEscenario) {
        // Partida de aprendizaje: cada turno gasta un día del contador; sin días, este es el último turno.
        if (s.sinEscenario.dias <= 0) {
          s.ultimoTurno = true
          anotar(s, 'aviso', 'No quedan días: este es tu último turno.')
        } else {
          s.sinEscenario.dias -= 1
          anotar(s, 'efecto', `Pasa un día: ${diasTexto(s.sinEscenario.dias)}.`)
        }
      } else if (!carta) {
        s.ultimoTurno = true
        anotar(s, 'aviso', 'No queda ninguna carta de Escenario: este es tu último turno.')
      } else {
        mover(s, carta, 'escenarioEnCurso')
        s.infoRevelada++
        anotar(s, 'revelar', `Escenario: «${nombre(s, carta)}».`, { tipo: 'revelado', inst: carta, como: 'escenario' })
        tareas.push({ tipo: 'aplicarEscenario', carta })
      }
      tareas.push(
        { tipo: 'prepararTodo' },
        { tipo: 'evento', ev: { tipo: 'inicioTurno' }, fase: 'antes', cancelado: false, usadas: [] },
        // Decisión N4: la pausa del Inicio va al final del paso, después de preparar.
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
          opciones: [
            { clave: 'quedarse', texto: 'Quedarte en puerto' },
            ...s.zonas.misionesDisponibles
              .filter((m) => puedeZarpar(s, m))
              .map((m) => ({ clave: `zarpar:${m}`, texto: `Zarpar a «${nombre(s, m)}»` })),
          ],
        })
      }
      const clave = eleccionDe(e, 'opcion').clave
      if (clave === 'quedarse') {
        anotar(s, 'jugada', 'Te quedas en puerto.')
        encolar(s, { tipo: 'quedarseEnPuerto', elegidas: [] })
      } else if (clave.startsWith('zarpar:')) {
        encolar(s, { tipo: 'zarpar', mision: clave.slice('zarpar:'.length) as InstId })
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
    case 'robar': {
      // «Náufrago en la playa»: al final del turno, descarta al Tripulante que reclutaste con él.
      const naufragos = s.temporales
        .filter((x) => x.clave === 'naufrago.turno' && x.inst && s.zonas.tripulacion.includes(x.inst))
        .map((x): NuevaTarea => ({ tipo: 'sacarTripulante', carta: x.inst as InstId, destino: 'descartesMuelle', motivo: 'naufrago' }))
      encolar(
        s,
        { tipo: 'robarHastaMando' },
        // Fase 16, Desánimo: «Cuando vayas a robar al final del turno, roba 1 carta menos y descarta esta carta.» (El −1 lo
        // pone su capacidad constante; aquí se descarta, robes o no.)
        { tipo: 'descartarDesanimo' },
        { tipo: 'evento', ev: { tipo: 'finTurno' }, fase: 'antes', cancelado: false, usadas: [] },
        // Estados al final del turno: Envenenado hiere y Borracho se pasa.
        { tipo: 'estadosFinTurno', paso: 'veneno', pendientes: [] },
        ...naufragos,
      )
      t.paso = 'enrolado'
      return 'sigue'
    }
    case 'enrolado':
      // Fase 14, «Enrolado N»: lo último del Final de turno, después de los efectos «al final de cada turno».
      encolar(s, ...quitarFichasDeEnrolado(s))
      t.paso = 'cierre'
      return 'sigue'
    case 'cierre': {
      // Lo que dura «este turno» se acaba; lo de «tu próximo turno» empieza a contar ahora.
      s.temporales = s.temporales.filter((x) => x.hasta !== 'finTurno' || (x.desdeTurno ?? 0) > s.turno)
      // Los límites «una vez por turno» vuelven a estar disponibles.
      for (const clave of Object.keys(s.usos)) if (clave.startsWith('turno:')) delete s.usos[clave]
      for (const c of [...s.zonas.escenarioEnCurso]) mover(s, c, 'descartesEscenario')
      if (s.ultimoTurno) {
        s.resultado = { gana: false, motivo: s.sinEscenario ? 'Se ha acabado el tiempo: no quedaban días.' : 'Se ha acabado el tiempo: no quedaban cartas de Escenario.' }
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

/**
 * Prepara todas tus cartas agotadas (menos las que «no se preparan»). Se acaban los «en tu próximo Inicio». Fase 10b:
 * con «Escasez de pertrechos» (revelada antes, en el paso 1 del Inicio), los Cañones no se preparan. (Fase 15, quinta
 * ronda: fuera Pólvora mojada.)
 */
export const prepararTodo: Manejador<'prepararTodo'> = (s) => {
  const motivo = s.temporales.some((x) => x.clave === 'escasez.turno') ? 'Escasez de pertrechos' : null
  const canones = s.zonas.mejoras.filter((c) => esCanon(copia(s, c).id) && copia(s, c).agotada)
  if (motivo && canones.length > 0) anotar(s, 'aviso', `${motivo}: tus Cañones no se preparan.`)
  for (const c of [...s.zonas.tripulacion, ...s.zonas.mejoras]) {
    if (motivo && canones.includes(c)) continue
    if (!puedePrepararse(s, c)) {
      if (copia(s, c).agotada) anotar(s, 'efecto', `${nombre(s, c)} no se prepara.`)
      continue
    }
    // Fase 16, Extenuado: «Obligado: Cuando este Tripulante vaya a prepararse en la Fase de Inicio, en vez de eso descarta
    // esta carta.» Solo si iba a prepararse (estaba agotado).
    // TODO(regla) P111: si en la Fase de Inicio ya estaba preparado, la carta se queda hasta la próxima vez que vaya a
    // prepararse en una Fase de Inicio (el texto, al pie de la letra).
    if (copia(s, c).agotada && s.zonas.tripulacion.includes(c) && tieneEstado(s, c, 'extenuado')) {
      quitarEstado(s, c, 'extenuado')
      anotar(s, 'aviso', `${nombre(s, c)} está Extenuado: no se prepara (descartas su carta de Extenuado).`)
      continue
    }
    copia(s, c).agotada = false
  }
  s.temporales = s.temporales.filter((x) => x.hasta !== 'inicio')
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

/** «quedan 3 días», «queda 1 día», «no queda ningún día». */
export function diasTexto(n: number): string {
  if (n <= 0) return 'no queda ningún día'
  return n === 1 ? 'queda 1 día' : `quedan ${n} días`
}
