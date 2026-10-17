// Cada carta de Peligro de la misión: revelarla, leer su encuentro, la Prueba con su Destino, el Avance
// y la ventana posterior (retirarse o seguir).

import { iconosDe, porId } from '../catalogo.ts'
import { destinoDe } from '../destinos.ts'
import { interpretarEfectos } from '../efectos.ts'
import { anotar, claveUso, copia, encolar, nombre, nombres } from '../estado.ts'
import { cartaDeArriba, descartarPeligro, encuentroDe, entornoActual } from '../peligros.ts'
import { dificultadDeOpcion, dificultadPrueba, modificadorDeDestino, nombreDelEncuentro, pruebaEnCurso, totalPrueba } from '../prueba.ts'
import type { Accion, Estado, InstId, NuevaTarea, PruebaEnCurso } from '../tipos.ts'
import { encolarUso, usosDisponibles } from '../usos.ts'
import { modificadores, valor } from '../valores.ts'
import { mover } from '../zonas.ts'
import { eleccionDe, preguntar, type Manejador } from './comun.ts'

const NOMBRE_ENTORNO = { mar: 'Mar', nat: 'Naturaleza', ciu: 'Ciudad' } as const

function evento(ev: Extract<NuevaTarea, { tipo: 'evento' }>['ev']): NuevaTarea {
  return { tipo: 'evento', ev, fase: 'antes', cancelado: false, usadas: [] }
}

function nuevaPrueba(encuentro: InstId): PruebaEnCurso {
  return {
    encuentro,
    opcion: null,
    hab: null,
    dificultadBase: 0,
    comprometidos: [],
    cartas: [],
    iconos: 0,
    bonos: [],
    destino: null,
    destinoCancelado: false,
    sinOposicion: false,
    modDestino: 0,
    falla: false,
    sinCartas: false,
    sinCanones: false,
    sinFallo: false,
    ignorarFallo: false,
    heridaSiFallas: 0,
    avanceSiSuperas: 0,
    preparaSiSuperas: false,
    automatica: false,
    agotadas: [],
    resultado: null,
  }
}

/** Termina la Prueba en curso: los Destinos revelados se descartan y caducan los efectos «para esta Prueba». */
function cerrarPrueba(s: Estado): void {
  for (const d of [...s.zonas.destino]) descartarPeligro(s, d)
  s.temporales = s.temporales.filter((x) => x.hasta !== 'finPrueba')
  s.prueba = null
}

/** La misión ha terminado (D5a, hundimiento o retirada): lo que quede se cierra sin resolverse. */
function terminada(s: Estado): boolean {
  return !s.mision || s.mision.fin !== null
}

export const encuentro: Manejador<'encuentro'> = (s, t, e) => {
  if (terminada(s)) return 'hecha'
  const m = s.mision
  if (!m) return 'hecha'
  switch (t.paso) {
    case 'revelar': {
      const carta = cartaDeArriba(s)
      if (!carta) {
        anotar(s, 'aviso', 'No quedan cartas de Peligro que revelar: vuelves a puerto.')
        m.fin = 'retirada'
        return 'hecha'
      }
      mover(s, carta, 'encuentro')
      s.infoRevelada++
      t.carta = carta
      const entorno = entornoActual(s)
      const lugar = porId(copia(s, carta).id).tipo === 'mazoPropio' ? '' : ` (${entorno ? NOMBRE_ENTORNO[entorno] : ''})`
      anotar(s, 'revelar', `Revelas «${nombre(s, carta)}»: ${nombreDelEncuentro(s, carta)}${lugar}.`, { tipo: 'revelado', inst: carta, como: 'encuentro' })
      encolar(s, evento({ tipo: 'revelarPeligro', carta }))
      t.paso = 'leer'
      return 'sigue'
    }
    case 'leer': {
      const carta = t.carta
      // Si una capacidad la ha descartado sin resolverla, no cuenta como resuelta (D5b): se revela otra.
      if (!carta || !s.zonas.encuentro.includes(carta)) return 'hecha'
      const enc = encuentroDe(s, carta)
      t.paso = 'avance'
      if (enc.prueba.length === 0) {
        encolar(s, { tipo: 'aplicarEfectos', efectos: interpretarEfectos(enc.textoEfecto ?? ''), contexto: 'efecto' })
      } else {
        s.prueba = nuevaPrueba(carta)
        // «Soborno»: esta Prueba se supera automáticamente, sin revelar Destino.
        if (m.automatica === carta) s.prueba.automatica = true
        m.automatica = null
        encolar(s, { tipo: 'prueba', paso: 'comprometer' })
      }
      return 'sigue'
    }
    case 'avance': {
      const carta = t.carta
      if (!carta || !s.zonas.encuentro.includes(carta)) {
        cerrarPrueba(s)
        return 'hecha'
      }
      const enc = encuentroDe(s, carta)
      let n = enc.avance
      const p = s.prueba
      if (p?.resultado === 'superada' && p.hab) n += p.avanceSiSuperas + valor(s, { tipo: 'avanceExtraPrueba', hab: p.hab })
      const mc = copia(s, m.carta)
      mc.avance += n
      m.cartasResueltas++
      anotar(s, 'efecto', `Ganas ${n} de Avance (${mc.avance}/${valor(s, { tipo: 'avanceNecesario', mision: m.carta })}).`, { tipo: 'avance', n, total: mc.avance })
      descartarPeligro(s, carta)
      cerrarPrueba(s)
      t.paso = 'despues'
      return 'sigue'
    }
    case 'despues': {
      if (!e) {
        const acciones: Accion[] = [
          ...usosDisponibles(s, ['accion', 'libre']).map((uso) => ({ tipo: 'usar' as const, uso })),
          { tipo: 'retirarse' },
          { tipo: 'terminarPaso' },
        ]
        return preguntar({ tipo: 'ventanaAccion', motivo: { clave: 'trasEncuentro' }, acciones })
      }
      const accion = eleccionDe(e, 'accion').accion
      if (accion.tipo === 'usar') {
        encolarUso(s, accion.uso, null)
        return 'sigue'
      }
      if (accion.tipo === 'retirarse') {
        m.fin = 'retirada'
        anotar(s, 'jugada', 'Te retiras y vuelves a puerto.')
      }
      return 'hecha'
    }
  }
}

/** Aplica el Destino revelado (si no se ha cancelado): modificador, efecto añadido y Sin oposición (N9). */
function aplicarDestino(s: Estado, p: PruebaEnCurso): NuevaTarea[] {
  if (!p.destino || p.destinoCancelado || !p.hab) return []
  const d = destinoDe(copia(s, p.destino).id)
  const mod = modificadorDeDestino(s, p.destino, p.encuentro, p.hab)
  if (mod === 'fallo') p.falla = true
  else p.modDestino = mod
  p.sinCartas = p.sinCartas || (d.sinCartas ?? false)
  p.sinCanones = p.sinCanones || (d.sinCanones ?? false)
  p.heridaSiFallas += d.heridaSiFallas ?? 0
  p.avanceSiSuperas += d.avanceSiSuperas ?? 0
  p.preparaSiSuperas = p.preparaSiSuperas || (d.preparaSiSuperas ?? false)
  const tareas: NuevaTarea[] = []
  const comprometidos = p.comprometidos.filter((c) => s.zonas.tripulacion.includes(c))
  if (d.heridaComprometido && comprometidos.length > 0) tareas.push({ tipo: 'herirUno', n: d.heridaComprometido, entre: comprometidos })
  if (d.heridaMasFuerte && comprometidos.length > 0) {
    const hab = p.hab
    const valores = comprometidos.map((c) => valor(s, { tipo: 'habilidad', carta: c, hab }))
    const maximo = Math.max(...valores)
    tareas.push({ tipo: 'herirUno', n: d.heridaMasFuerte, entre: comprometidos.filter((_, i) => valores[i] === maximo) })
  }
  // N14: Sin oposición se mira al aplicar el Destino, después de su ventana (N9). Si el Loro se ha unido
  // en ella, ya hay alguien comprometido y no se aplica.
  p.sinOposicion = p.comprometidos.length === 0
  if (p.sinOposicion) tareas.push({ tipo: 'aplicarEfectos', efectos: d.sinOposicion, contexto: 'sinOposicion' })
  return tareas
}

export const prueba: Manejador<'prueba'> = (s, t, e) => {
  if (terminada(s) || !s.prueba) return 'hecha'
  const p = pruebaEnCurso(s)
  if (!s.zonas.encuentro.includes(p.encuentro)) {
    // La carta de Peligro se ha quitado sin resolverla tras revelar el Destino («Retirada a tiempo»): no hay
    // Prueba que resolver, pero el Destino ya revelado se aplica tras su ventana (N9, N16).
    if (t.paso === 'aplicarDestino') encolar(s, ...aplicarDestino(s, p))
    return 'hecha'
  }
  const enc = encuentroDe(s, p.encuentro)
  switch (t.paso) {
    case 'comprometer': {
      if (p.automatica) {
        // «Carronadas» o «Soborno»: se supera sin comprometer ni revelar Destino. Si hay dos opciones, eliges (N17).
        if (p.opcion === null) {
          if (enc.prueba.length > 1 && !e) {
            return preguntar({
              tipo: 'elegirOpcion',
              motivo: { clave: 'opcionAutomatica' },
              opciones: enc.prueba.map((o, i) => ({ clave: String(i), texto: `${o.hab} ${o.dificultad}` })),
            })
          }
          p.opcion = e ? Number(eleccionDe(e, 'opcion').clave) : 0
        }
        const o = enc.prueba[p.opcion]
        if (!o) throw new Error('Opción de Prueba inexistente')
        p.hab = o.hab
        p.dificultadBase = dificultadDeOpcion(s, p.encuentro, p.opcion)
        anotar(s, 'jugada', `Superas automáticamente la Prueba de ${o.hab}, sin revelar Destino.`)
        t.paso = 'resolver'
        return 'sigue'
      }
      if (!e) {
        const habs = new Set(enc.prueba.map((o) => o.hab))
        return preguntar({
          tipo: 'comprometer',
          motivo: { clave: 'comprometer' },
          opciones: enc.prueba.map((o) => ({ ...o })),
          tripulantes: s.zonas.tripulacion.filter((c) => !copia(s, c).agotada),
          cartas: s.zonas.mano.filter((c) => [...habs].some((h) => iconosDe(copia(s, c).id, h) > 0)),
        })
      }
      const c = eleccionDe(e, 'compromiso')
      const opcion = enc.prueba[c.opcion]
      if (!opcion) throw new Error('Opción de Prueba inexistente')
      // D1b: la rebaja por Rasgo se mira ahora, antes de agotar a nadie, y se congela.
      p.dificultadBase = dificultadDeOpcion(s, p.encuentro, c.opcion)
      p.opcion = c.opcion
      p.hab = opcion.hab
      for (const x of c.tripulantes) {
        // Rodrigo: en una Prueba de COM se compromete sin agotarse (una vez por turno).
        if (modificadores(s, { tipo: 'sinAgotarAlComprometer', carta: x, hab: opcion.hab }) > 0) {
          const clave = claveUso('turno', x, `${copia(s, x).id}.sinAgotar`)
          s.usos[clave] = (s.usos[clave] ?? 0) + 1
          anotar(s, 'jugada', `${nombre(s, x)} se compromete sin agotarse.`, { tipo: 'usar', carta: copia(s, x).id, clave: `${copia(s, x).id}.sinAgotar` })
          continue
        }
        copia(s, x).agotada = true
      }
      p.comprometidos = [...c.tripulantes]
      if (c.cartas.length > 0) anotar(s, 'jugada', `Descartas por sus iconos: ${nombres(s, c.cartas)}.`, { tipo: 'iconos', cartas: c.cartas.map((x) => copia(s, x).id) })
      for (const x of c.cartas) mover(s, x, 'descartesCapitan')
      p.cartas = [...c.cartas]
      p.iconos = c.cartas.reduce((n, x) => n + iconosDe(copia(s, x).id, opcion.hab), 0)
      if (c.tripulantes.length === 0) anotar(s, 'jugada', `Prueba de ${opcion.hab} ${p.dificultadBase}: no comprometes a nadie.`)
      else {
        const conCartas = c.cartas.length > 0 ? ` y añades ${nombres(s, c.cartas)}` : ''
        anotar(s, 'jugada', `Prueba de ${opcion.hab} ${p.dificultadBase}: comprometes a ${nombres(s, c.tripulantes)}${conCartas}.`)
      }
      encolar(s, evento({ tipo: 'comprometer' }))
      t.paso = 'destino'
      return 'sigue'
    }
    case 'destino': {
      p.sinOposicion = p.comprometidos.length === 0
      const carta = cartaDeArriba(s)
      t.paso = 'aplicarDestino'
      if (!carta) return 'sigue'
      mover(s, carta, 'destino')
      s.infoRevelada++
      p.destino = carta
      const d = destinoDe(copia(s, carta).id)
      anotar(s, 'revelar', `Destino: «${d.nombre}» (${d.impreso}).`, { tipo: 'revelado', inst: carta, como: 'destino' })
      encolar(s, evento({ tipo: 'revelarDestino', carta }))
      return 'sigue'
    }
    case 'aplicarDestino':
      encolar(s, ...aplicarDestino(s, p))
      t.paso = 'ventana'
      return 'sigue'
    case 'ventana': {
      const hab = p.hab
      if (!hab) {
        t.paso = 'resolver'
        return 'sigue'
      }
      if (!e) {
        // Reforzar solo si se comprometió a alguien.
        const reforzar: Accion[] =
          p.comprometidos.length > 0
            ? s.zonas.mano.filter((c) => iconosDe(copia(s, c).id, hab) > 0).map((carta) => ({ tipo: 'reforzar' as const, carta }))
            : []
        const acciones: Accion[] = [
          ...reforzar,
          ...usosDisponibles(s, ['accion', 'libre']).map((uso) => ({ tipo: 'usar' as const, uso })),
          { tipo: 'terminarPaso' },
        ]
        return preguntar({ tipo: 'ventanaAccion', motivo: { clave: 'ventanaPrueba', n: dificultadPrueba(s) }, acciones })
      }
      const accion = eleccionDe(e, 'accion').accion
      if (accion.tipo === 'reforzar') {
        mover(s, accion.carta, 'descartesCapitan')
        p.cartas.push(accion.carta)
        p.iconos += iconosDe(copia(s, accion.carta).id, hab)
        anotar(s, 'jugada', `Refuerzas con «${nombre(s, accion.carta)}».`, { tipo: 'iconos', cartas: [copia(s, accion.carta).id] })
        return 'sigue'
      }
      if (accion.tipo === 'usar') {
        encolarUso(s, accion.uso, null)
        return 'sigue'
      }
      t.paso = 'resolver'
      return 'sigue'
    }
    case 'resolver': {
      const total = totalPrueba(s)
      const dificultad = dificultadPrueba(s)
      const superada = p.automatica || (!p.falla && p.comprometidos.length > 0 && total >= dificultad)
      p.resultado = superada ? 'superada' : 'fallada'
      const motivo = p.falla ? ' (el Destino la hace fallar)' : p.comprometidos.length === 0 ? ' (nadie comprometido)' : ''
      const texto = p.automatica ? 'Prueba superada automáticamente.' : `Total ${total} contra ${dificultad}: ${superada ? 'superas' : 'fallas'} la Prueba${motivo}.`
      anotar(s, 'jugada', texto, {
        tipo: 'prueba',
        peligro: copia(s, p.encuentro).id,
        encuentro: enc.nombre,
        superada,
      })
      encolar(s, evento(superada ? { tipo: 'superarPrueba' } : { tipo: 'fallarPrueba' }))
      return 'hecha'
    }
  }
}
