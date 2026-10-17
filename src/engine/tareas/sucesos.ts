// Sucesos con sus ventanas, uso de capacidades, Eventos jugados y pausas para capacidades sin etiqueta.

import { nombreDe, tipoDe } from '../catalogo.ts'
import { anotar, buscarTarea, claveUso, copia, encolar, nombre, sucesoDescartada } from '../estado.ts'
import { interpretarEfectos } from '../efectos.ts'
import { encuentroDe } from '../peligros.ts'
import type { Estado, Evento, NuevaTarea, TareaDe } from '../tipos.ts'
import { valor } from '../valores.ts'
import { capacidadDe, claveDe, encolarUso, usosDisparados, usosDisponibles } from '../usos.ts'
import { estaEn, mover, zonaDe } from '../zonas.ts'
import { preguntar, type Manejador, type Resultado } from './comun.ts'

function aplicarSuceso(s: Estado, ev: Evento): void {
  switch (ev.tipo) {
    case 'inicioTurno':
    case 'finTurno':
    case 'reclutar':
    case 'zarpar':
    case 'revelarPeligro':
    case 'comprometer':
    case 'revelarDestino':
    case 'descartada':
      return // Solo marcan el momento para las Interrupciones y Respuestas.
    case 'danoBarco': {
      if (ev.cantidad <= 0) return
      s.danoBarco += ev.cantidad
      anotar(s, 'efecto', `El Barco recibe ${ev.cantidad} de daño (${s.danoBarco}).`, { tipo: 'dano', n: ev.cantidad })
      return
    }
    case 'superarPrueba': {
      const p = s.prueba
      if (!p) return
      const tareas: NuevaTarea[] = [
        { tipo: 'aplicarEfectos', efectos: interpretarEfectos(encuentroDe(s, p.encuentro).textoExito ?? ''), contexto: 'exito' },
      ]
      if (p.preparaSiSuperas) tareas.push({ tipo: 'prepararUno', entre: [...p.comprometidos] })
      encolar(s, ...tareas)
      return
    }
    case 'fallarPrueba':
      if (s.prueba) encolar(s, { tipo: 'aplicarFallo' })
      return
    case 'heridas': {
      if (ev.cantidad <= 0 || !estaEn(s, ev.objetivo, 'tripulacion')) return
      copia(s, ev.objetivo).heridas += ev.cantidad
      anotar(s, 'efecto', `${nombre(s, ev.objetivo)} sufre ${ev.cantidad} ${ev.cantidad === 1 ? 'herida' : 'heridas'}.`, { tipo: 'heridas', inst: ev.objetivo, n: ev.cantidad })
      return
    }
    case 'derrota': {
      if (!estaEn(s, ev.carta, 'tripulacion')) return
      anotar(s, 'aviso', `${nombre(s, ev.carta)} queda derrotado.`, { tipo: 'derrota', carta: copia(s, ev.carta).id })
      if (ev.carta === s.capitan) {
        s.resultado = { gana: false, motivo: 'Tu Capitán ha quedado derrotado.' }
        return
      }
      encolar(s, { tipo: 'sacarTripulante', carta: ev.carta, destino: 'descartesMuelle', motivo: 'derrotado' })
      return
    }
  }
}

/** Ventana de un suceso: Obligadas solas; Interrupciones o Respuestas ofrecidas hasta que el jugador pase. */
/** Sucesos de un encuentro: si la misión ya ha terminado, sus ventanas no se abren. */
const DEL_ENCUENTRO = new Set<Evento['tipo']>(['revelarPeligro', 'comprometer', 'revelarDestino'])

function ventana(s: Estado, t: TareaDe<'evento'>, e: Parameters<Manejador<'evento'>>[2]): Resultado | 'cerrada' {
  if (s.mision?.fin && DEL_ENCUENTRO.has(t.ev.tipo)) return 'cerrada'
  const fase = t.fase === 'antes' ? 'antes' : 'despues'
  const obligadas = usosDisparados(s, 'obligada', t.ev, fase).filter((u) => !t.usadas.includes(claveDe(u)))
  if (obligadas.length > 0) {
    // Regla de oro 5: si varias se aplican a la vez, el jugador decide el orden.
    if (obligadas.length === 1 || e?.tipo === 'opcion') {
      const elegida = e?.tipo === 'opcion' ? obligadas.find((u) => claveDe(u) === e.clave) : obligadas[0]
      if (!elegida) throw new Error('Capacidad obligada desconocida')
      t.usadas.push(claveDe(elegida))
      encolarUso(s, elegida, t.id)
      return 'sigue'
    }
    return preguntar({
      tipo: 'elegirOpcion',
      motivo: { clave: 'ordenObligadas' },
      opciones: obligadas.map((u) => ({ clave: claveDe(u), texto: capacidadDe(u).carta })),
    })
  }
  if (e?.tipo === 'usar') {
    t.usadas.push(claveDe(e.uso))
    encolarUso(s, e.uso, t.id)
    return 'sigue'
  }
  if (e?.tipo === 'pasar') return 'cerrada'
  const usos = usosDisparados(s, fase === 'antes' ? 'interrupcion' : 'respuesta', t.ev, fase).filter(
    (u) => !t.usadas.includes(claveDe(u)),
  )
  if (usos.length === 0) return 'cerrada'
  return preguntar({ tipo: 'ofrecer', motivo: { clave: fase === 'antes' ? 'interrupcion' : 'respuesta' }, usos })
}

export const evento: Manejador<'evento'> = (s, t, e) => {
  if (t.fase === 'aplicar') {
    if (!t.cancelado) aplicarSuceso(s, t.ev)
    t.fase = 'despues'
    return 'sigue'
  }
  const r = ventana(s, t, e)
  if (r !== 'cerrada') return r
  if (t.fase === 'antes') {
    t.fase = 'aplicar'
    return 'sigue'
  }
  return 'hecha'
}

/** Usar una capacidad: paga su coste y aplica su efecto. */
export const usar: Manejador<'usar'> = (s, t) => {
  const cap = capacidadDe(t.uso)
  const fuente = t.uso.fuente
  if (t.paso === 'coste') {
    if (cap.limite) {
      const clave = claveUso(cap.limite.por, fuente, cap.clave)
      s.usos[clave] = (s.usos[clave] ?? 0) + 1
    }
    t.paso = 'efecto'
    for (const coste of cap.coste ?? []) {
      if (coste.tipo === 'pagar') {
        encolar(s, { tipo: 'pagar', cantidad: coste.n, motivo: cap.carta })
        continue
      }
      if (coste.tipo === 'agotarCapitan') {
        copia(s, s.capitan).agotada = true
        continue
      }
      if (fuente === null) throw new Error(`La capacidad ${cap.clave} necesita una carta que pague su coste`)
      const c = copia(s, fuente)
      if (coste.tipo === 'agotarse') {
        c.agotada = true
        if (s.prueba && !s.prueba.agotadas.includes(fuente)) s.prueba.agotadas.push(fuente)
      }
      else if (coste.tipo === 'municion') c.municion -= coste.n
      // N13: una herida pagada como coste se puede evitar o desviar como cualquier otra (Grumete, «Ni un hombre
      // atrás»); el coste se da por pagado igualmente.
      else if (coste.tipo === 'herida') {
        encolar(s, { tipo: 'evento', ev: { tipo: 'heridas', objetivo: fuente, cantidad: coste.n }, fase: 'antes', cancelado: false, usadas: [] })
      }
      else if (coste.tipo === 'descartarse') {
        const zona = zonaDe(s, fuente)
        if (zona === 'mejoras') t.descartarAlFinal = true
        else if (zona === 'mano') mover(s, fuente, 'descartesCapitan')
        // Un Tripulante que se descarta a sí mismo (Grumete leal) sale con sus Mejoras; sus Tesoros pasan a otro.
        else if (zona === 'tripulacion') encolar(s, { tipo: 'sacarTripulante', carta: fuente, destino: 'descartesMuelle', motivo: 'descartado' })
        else mover(s, fuente, 'descartesMuelle')
      }
    }
    if (fuente !== null) anotar(s, 'jugada', `Usas «${nombre(s, fuente)}».`, { tipo: 'usar', carta: copia(s, fuente).id, clave: cap.clave })
    else anotar(s, 'jugada', `Usas «${nombreDe(cap.carta)}».`, { tipo: 'usar', carta: cap.carta, clave: cap.clave })
    return 'sigue'
  }
  const suceso = t.evento !== null ? (buscarTarea(s, t.evento) as TareaDe<'evento'>) : null
  const tareas = cap.efecto?.(s, fuente, suceso) ?? []
  if (t.descartarAlFinal && fuente !== null && estaEn(s, fuente, 'mejoras')) {
    mover(s, fuente, 'descartesMuelle')
    tareas.push(sucesoDescartada(fuente))
  }
  encolar(s, ...tareas)
  return 'hecha'
}

/** Jugar un Evento de la mano: va a «resolviendo» (no puede pagarse a sí mismo), se paga, se aplica y se descarta. */
export const jugarEvento: Manejador<'jugarEvento'> = (s, t) => {
  if (t.paso === 'pagar') {
    if (tipoDe(copia(s, t.carta).id) !== 'evento') throw new Error('Solo se pueden jugar Eventos')
    mover(s, t.carta, 'resolviendo')
    anotar(s, 'jugada', `Juegas «${nombre(s, t.carta)}».`, { tipo: 'usar', carta: copia(s, t.carta).id, clave: t.clave })
    t.paso = 'efecto'
    const coste = valor(s, { tipo: 'coste', carta: t.carta })
    if (coste > 0) encolar(s, { tipo: 'pagar', cantidad: coste, motivo: copia(s, t.carta).id })
    // Además del número del timón, el coste de su capacidad («Agota a tu Capitán:»).
    for (const c of capacidadDe({ fuente: t.carta, clave: t.clave }).coste ?? []) {
      if (c.tipo === 'agotarCapitan') copia(s, s.capitan).agotada = true
      else if (c.tipo === 'pagar') encolar(s, { tipo: 'pagar', cantidad: c.n, motivo: copia(s, t.carta).id })
      else throw new Error(`Coste no previsto en un Evento: ${c.tipo}`)
    }
    return 'sigue'
  }
  if (t.paso === 'efecto') {
    const cap = capacidadDe({ fuente: t.carta, clave: t.clave })
    t.paso = 'descartar'
    const suceso = t.evento !== null ? (buscarTarea(s, t.evento) as TareaDe<'evento'>) : null
    encolar(s, ...(cap.efecto?.(s, t.carta, suceso) ?? []))
    return 'sigue'
  }
  if (estaEn(s, t.carta, 'resolviendo')) mover(s, t.carta, 'descartesCapitan')
  return 'hecha'
}

/** Pausa en la que solo se pueden usar capacidades sin etiqueta (N2). Si no hay ninguna, no se pregunta. */
export const ventanaLibre: Manejador<'ventanaLibre'> = (s, t, e) => {
  if (e?.tipo === 'accion') {
    const accion = e.accion
    if (accion.tipo === 'terminarPaso') return 'hecha'
    if (accion.tipo === 'usar') {
      encolarUso(s, accion.uso, null)
      return 'sigue'
    }
    throw new Error(`Acción no válida en esta pausa: ${accion.tipo}`)
  }
  const usos = usosDisponibles(s, ['libre'])
  if (usos.length === 0) return 'hecha'
  return preguntar({
    tipo: 'ventanaAccion',
    motivo: { clave: `pausa.${t.momento}` },
    acciones: [...usos.map((uso) => ({ tipo: 'usar' as const, uso })), { tipo: 'terminarPaso' }],
  })
}

