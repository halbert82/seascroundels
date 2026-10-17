// Cada carta de Peligro de la misión: revelarla, leer su encuentro, la Prueba con su Destino, el Avance
// y la ventana posterior (retirarse o seguir).

import { iconosDe, porId, tipoDe } from '../catalogo.ts'
import { definicionEncuentro, reglasDe } from '../definiciones.ts'
import { destinoDe } from '../destinos.ts'
import type { Efecto } from '../efectos.ts'
import { anotar, claveUso, copia, encolar, nombre, nombres } from '../estado.ts'
import { agotar, quitarEstado, tieneEstado } from '../estados.ts'
import { cartaDeArriba, cerrarPrueba, descartarPeligro, entornoActual, mazoActivo, ponerEnMuelle } from '../peligros.ts'
import { impideRetirarse } from '../definiciones.ts'
import { cumple } from './efectos.ts'
import { vetadoAlComprometer } from './peligros2.ts'
import {
  definicionActual,
  dificultadDeOpcion,
  gastarModsSiguientes,
  dificultadPrueba,
  modificadorDeDestino,
  nombreDelEncuentro,
  nuevaPrueba,
  pruebaEnCurso,
  totalPrueba,
} from '../prueba.ts'
import type { Accion, Estado, InstId, NuevaTarea, PruebaEnCurso } from '../tipos.ts'
import { encolarUso, usosDisponibles } from '../usos.ts'
import { modificadores, valor } from '../valores.ts'
import { mover } from '../zonas.ts'
import { eleccionDe, preguntar, type Manejador } from './comun.ts'

const NOMBRE_ENTORNO = { mar: 'Mar', nat: 'Naturaleza', ciu: 'Ciudad' } as const

function evento(ev: Extract<NuevaTarea, { tipo: 'evento' }>['ev']): NuevaTarea {
  return { tipo: 'evento', ev, fase: 'antes', cancelado: false, usadas: [] }
}

function aplicar(efectos: Efecto[], contexto: 'efecto' | 'pago', fuente: InstId): NuevaTarea {
  return { tipo: 'aplicarEfectos', efectos, contexto, fuente }
}

/**
 * Empieza la Prueba del encuentro de esta carta. `extra`: dificultad de más («Elige: … o la Prueba recibe +2»).
 * «La siguiente Prueba de esta misión recibe ±X» se aplica aquí y se gasta.
 */
export function empezarPrueba(s: Estado, carta: InstId, extra: number, origen: 'encuentro' | 'accion'): PruebaEnCurso {
  const p = nuevaPrueba(carta)
  p.origen = origen
  const m = s.mision
  if (extra !== 0) p.modExtra = extra
  s.prueba = p
  // «Soborno»: esta Prueba se supera automáticamente, sin revelar Destino.
  if (origen === 'encuentro' && m) {
    if (m.automatica === carta) p.automatica = true
    m.automatica = null
  }
  return p
}

/** La misión ha terminado (D5a, hundimiento o retirada): lo que quede se cierra sin resolverse. */
function terminada(s: Estado): boolean {
  return !s.mision || s.mision.fin !== null
}

/**
 * La Prueba en curso se corta: en una misión, si ha terminado; en puerto, una Prueba de un encuentro no
 * puede seguir (la de una Acción, sí).
 */
function pruebaCortada(s: Estado): boolean {
  if (s.mision) return s.mision.fin !== null
  return s.prueba?.origen !== 'accion'
}

/** Al terminar de resolverse, la carta del encuentro va a los descartes o, si lo dice, ocupa el muelle. */
function salidaDelEncuentro(s: Estado, carta: InstId): void {
  const m = s.mision
  if (m?.alMuelle?.carta === carta) {
    const { coste } = m.alMuelle
    delete m.alMuelle
    ponerEnMuelle(s, carta, coste)
    return
  }
  if (m?.alFondo === carta && !m.retirar.includes(carta)) {
    delete m.alFondo
    mover(s, carta, mazoActivo(s).mazo, 'abajo')
    anotar(s, 'efecto', `«${nombre(s, carta)}» va al fondo del mazo de Peligros.`)
    return
  }
  descartarPeligro(s, carta)
}

/** Gasta los «el siguiente encuentro … de esta misión» que le tocan a este encuentro; devuelve la dificultad de más. */
// TODO(regla): P27 · si ese siguiente encuentro no tiene Prueba, el «recibe ±N» se gasta igualmente (no espera al siguiente).
function gastarModsDeEncuentro(s: Estado, t: { sinAvance?: boolean }, claves: readonly string[]): number {
  const m = s.mision
  if (!m?.modsSiguientes) return 0
  const aplican = m.modsSiguientes.filter((x) => x.de === 'encuentro' && (!x.claves || claves.some((k) => x.claves?.includes(k))))
  if (aplican.length === 0) return 0
  m.modsSiguientes = m.modsSiguientes.filter((x) => !aplican.includes(x))
  if (m.modsSiguientes.length === 0) delete m.modsSiguientes
  if (aplican.some((x) => x.sinAvance)) t.sinAvance = true
  return aplican.reduce((n, x) => n + (x.n ?? 0), 0)
}

export const encuentro: Manejador<'encuentro'> = (s, t, e) => {
  if (terminada(s)) return 'hecha'
  const m = s.mision
  if (!m) return 'hecha'
  switch (t.paso) {
    case 'revelar': {
      const carta = cartaDeArriba(s, 'encuentro')
      if (!carta) {
        anotar(s, 'aviso', 'No quedan cartas de Peligro que revelar: vuelves a puerto.')
        m.fin = 'retirada'
        return 'hecha'
      }
      const perseguia = s.persigue === carta
      if (perseguia) s.persigue = null
      mover(s, carta, 'encuentro')
      s.infoRevelada++
      t.carta = carta
      const entorno = entornoActual(s)
      const lugar = porId(copia(s, carta).id).tipo === 'mazoPropio' ? '' : ` (${entorno ? NOMBRE_ENTORNO[entorno] : ''})`
      const alcance = perseguia ? ' Te ha alcanzado.' : ''
      anotar(s, 'revelar', `Revelas «${nombre(s, carta)}»: ${nombreDelEncuentro(s, carta)}${lugar}.${alcance}`, { tipo: 'revelado', inst: carta, como: 'encuentro' })
      // «Al revelarse»: se aplica antes de las Respuestas a la revelación.
      // TODO(regla): P12 · «al revelarse» se aplica antes de las Respuestas a la revelación de la carta.
      const alRevelarse = definicionEncuentro(s, carta).alRevelarse ?? []
      encolar(s, ...(alRevelarse.length > 0 ? [aplicar(alRevelarse, 'efecto', carta)] : []), evento({ tipo: 'revelarPeligro', carta }))
      t.paso = 'leer'
      return 'sigue'
    }
    case 'leer': {
      const carta = t.carta
      // Si una capacidad la ha descartado sin resolverla, no cuenta como resuelta (D5b): se revela otra.
      if (!carta || !s.zonas.encuentro.includes(carta)) return 'hecha'
      const def = definicionEncuentro(s, carta)
      t.paso = 'avance'
      // «El siguiente encuentro (#Guardia#…) de esta misión…»: le toca a este.
      const extra = gastarModsDeEncuentro(s, t, def.palabrasClave)
      if (def.sinPruebaSi && cumple(s, def.sinPruebaSi)) {
        anotar(s, 'efecto', 'Ganas el Avance sin Prueba.')
        return 'sigue'
      }
      if (def.queda) {
        // Se queda en juego junto a la misión: no se resuelve ahora (ni hay Prueba al revelarla).
        encolar(s, ...(def.efecto.length > 0 ? [aplicar(def.efecto, 'efecto', carta)] : []), { tipo: 'quedarEnJuego', carta })
        t.paso = 'despues'
      } else if (def.elige && def.elige.length > 0) {
        encolar(s, extra !== 0 ? { tipo: 'elegirEncuentro', carta, extra } : { tipo: 'elegirEncuentro', carta })
      } else if (def.opciones.length === 0) {
        encolar(s, aplicar(def.efecto, 'efecto', carta))
      } else {
        const p = empezarPrueba(s, carta, extra, 'encuentro')
        if (def.superaSi && cumple(s, def.superaSi)) {
          p.automatica = true
          anotar(s, 'efecto', 'Superas la Prueba sin hacerla.')
        }
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
      let n = t.sinAvance ? 0 : definicionEncuentro(s, carta).avance
      const p = s.prueba
      if (p?.resultado === 'superada' && p.hab) n += p.avanceSiSuperas + valor(s, { tipo: 'avanceExtraPrueba', hab: p.hab })
      const mc = copia(s, m.carta)
      mc.avance += n
      m.cartasResueltas++
      m.resueltas = [...(m.resueltas ?? []), definicionEncuentro(s, carta).palabrasClave]
      anotar(s, 'efecto', `Ganas ${n} de Avance (${mc.avance}/${valor(s, { tipo: 'avanceNecesario', mision: m.carta })}).`, { tipo: 'avance', n, total: mc.avance })
      salidaDelEncuentro(s, carta)
      cerrarPrueba(s)
      encolar(s, evento({ tipo: 'cartaResuelta', carta }))
      t.paso = 'despues'
      return 'sigue'
    }
    case 'despues': {
      // El Peligro de más de «Perseguido» no deja retirarse antes del siguiente.
      if (t.sinVentana) return 'hecha'
      if (!e) {
        const acciones: Accion[] = [
          ...usosDisponibles(s, ['accion', 'libre']).map((uso) => ({ tipo: 'usar' as const, uso })),
          ...(m.sinRetirada || impideRetirarse(s) ? [] : [{ tipo: 'retirarse' } as const]),
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
  if (d.heridaComprometido && comprometidos.length > 0) {
    // Maldito: cuando un Destino hiere a «uno de los comprometidos», tiene que ser él.
    const malditos = comprometidos.filter((c) => tieneEstado(s, c, 'maldito'))
    tareas.push({ tipo: 'herirUno', n: d.heridaComprometido, entre: malditos.length > 0 ? malditos : comprometidos })
  }
  if (d.heridaMasFuerte && comprometidos.length > 0) {
    const hab = p.hab
    const valores = comprometidos.map((c) => valor(s, { tipo: 'habilidad', carta: c, hab }))
    const maximo = Math.max(...valores)
    tareas.push({ tipo: 'herirUno', n: d.heridaMasFuerte, entre: comprometidos.filter((_, i) => valores[i] === maximo) })
  }
  // N14: Sin oposición se mira al aplicar el Destino, después de su ventana (N9). Si el Loro se ha unido
  // en ella, ya hay alguien comprometido y no se aplica.
  p.sinOposicion = p.comprometidos.length === 0
  // Reglas nuevas del Destino: lo que cambia en la Prueba, efectos añadidos y «persigue» (vuelve encima del mazo).
  const reglas = reglasDe(copia(s, p.destino).id)?.destino
  if (reglas?.prueba) Object.assign(p, reglas.prueba)
  if (reglas?.efectos && reglas.efectos.length > 0) tareas.push({ tipo: 'aplicarEfectos', efectos: reglas.efectos, contexto: 'efecto', fuente: p.destino })
  if (p.sinOposicion) tareas.push({ tipo: 'aplicarEfectos', efectos: d.sinOposicion, contexto: 'sinOposicion', fuente: p.destino })
  if (reglas?.persigue || d.persigue) p.persigue = true
  return tareas
}

/** Al comprometerse: Sangrando hiere al agotarse, Aturdido no suma (y se quita), Inspirado da +1 (y se quita). */
export function alComprometerse(s: Estado, p: PruebaEnCurso, c: InstId, agotarlo: boolean): void {
  if (agotarlo) agotar(s, c)
  if (quitarEstado(s, c, 'aturdido')) {
    p.sinSumar = [...(p.sinSumar ?? []), c]
    anotar(s, 'efecto', `${nombre(s, c)} está Aturdido: no suma en esta Prueba.`)
  }
  if (quitarEstado(s, c, 'inspirado')) {
    p.bonos.push({ n: 1, canon: false, fuente: 'estado:inspirado' })
    anotar(s, 'efecto', `${nombre(s, c)} está Inspirado: +1 en esta Prueba.`)
  }
}

export const prueba: Manejador<'prueba'> = (s, t, e) => {
  if (!s.prueba || pruebaCortada(s)) return 'hecha'
  const p = pruebaEnCurso(s)
  if (p.origen !== 'accion' && !s.zonas.encuentro.includes(p.encuentro)) {
    // La carta de Peligro se ha quitado sin resolverla tras revelar el Destino («Retirada a tiempo»): no hay
    // Prueba que resolver, pero el Destino ya revelado se aplica tras su ventana (N9, N16).
    if (t.paso === 'aplicarDestino') encolar(s, ...aplicarDestino(s, p))
    return 'hecha'
  }
  const def = definicionActual(s)
  if (def.sinAyuda) p.sinAyuda = true
  switch (t.paso) {
    case 'comprometer': {
      if (p.automatica) {
        // «Carronadas» o «Soborno»: se supera sin comprometer ni revelar Destino. Si hay dos opciones, eliges (N17).
        if (p.opcion === null) {
          if (def.opciones.length > 1 && !e) {
            return preguntar({
              tipo: 'elegirOpcion',
              motivo: { clave: 'opcionAutomatica' },
              opciones: def.opciones.map((o, i) => ({ clave: String(i), texto: `${o.hab} ${o.dificultad}` })),
            })
          }
          p.opcion = e ? Number(eleccionDe(e, 'opcion').clave) : 0
        }
        const o = def.opciones[p.opcion]
        if (!o) throw new Error('Opción de Prueba inexistente')
        p.hab = o.hab
        p.dificultadBase = dificultadDeOpcion(s, p.encuentro, p.opcion)
        gastarModsSiguientes(s, p, def, o.hab)
        anotar(s, 'jugada', `Superas automáticamente la Prueba de ${o.hab}, sin revelar Destino.`)
        t.paso = 'resolver'
        return 'sigue'
      }
      if (!e) {
        const habs = new Set(def.opciones.map((o) => o.hab))
        const pregunta = {
          tipo: 'comprometer' as const,
          motivo: { clave: p.origen === 'accion' ? 'comprometerAccion' : 'comprometer', carta: copia(s, p.encuentro).id },
          opciones: def.opciones.map((o) => ({ ...o })),
          // Encadenado, «no puede comprometerse» o lo que vete la carta: no se ofrecen.
          tripulantes: def.soloCon
            ? [def.soloCon]
            : s.zonas.tripulacion.filter(
                (c) => !copia(s, c).agotada && !tieneEstado(s, c, 'encadenado') && !vetadoAlComprometer(s, c) && !def.restriccion?.veto?.(s, c),
              ),
          // Sin ayuda: solo suman las Habilidades de la mano.
          cartas: s.zonas.mano.filter(
            (c) => [...habs].some((h) => iconosDe(copia(s, c).id, h) > 0) && (!def.sinAyuda || tipoDe(copia(s, c).id) === 'habilidad'),
          ),
        }
        return preguntar(def.sinAyuda ? { ...pregunta, sinAyuda: true } : pregunta)
      }
      const c = eleccionDe(e, 'compromiso')
      const opcion = def.opciones[c.opcion]
      if (!opcion) throw new Error('Opción de Prueba inexistente')
      // D1b: la rebaja por Rasgo se mira ahora, antes de agotar a nadie, y se congela.
      p.dificultadBase = dificultadDeOpcion(s, p.encuentro, c.opcion, c.tripulantes)
      p.opcion = c.opcion
      p.hab = opcion.hab
      gastarModsSiguientes(s, p, def, opcion.hab)
      for (const x of c.tripulantes) {
        // Ya agotado como coste de la Acción que pide la Prueba («solo con él»): se compromete sin agotarse otra vez.
        if (def.soloCon === x) {
          alComprometerse(s, p, x, false)
          continue
        }
        // Rodrigo: en una Prueba de COM se compromete sin agotarse (una vez por turno).
        if (modificadores(s, { tipo: 'sinAgotarAlComprometer', carta: x, hab: opcion.hab }) > 0) {
          const clave = claveUso('turno', x, `${copia(s, x).id}.sinAgotar`)
          s.usos[clave] = (s.usos[clave] ?? 0) + 1
          anotar(s, 'jugada', `${nombre(s, x)} se compromete sin agotarse.`, { tipo: 'usar', carta: copia(s, x).id, clave: `${copia(s, x).id}.sinAgotar` })
          alComprometerse(s, p, x, false)
          continue
        }
        alComprometerse(s, p, x, true)
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
      let carta = cartaDeArriba(s, 'destino')
      t.paso = 'aplicarDestino'
      if (!carta) return 'sigue'
      mover(s, carta, 'destino')
      s.infoRevelada++
      // Mal agüero: se revelan 2 Destinos y se aplica el peor (el otro se descarta).
      if (p.dosDestinos && p.hab) {
        const otra = cartaDeArriba(s, 'destino')
        if (otra) {
          mover(s, otra, 'destino')
          const valorDe = (d: InstId) => {
            const m2 = modificadorDeDestino(s, d, p.encuentro, p.hab ?? 'NAV')
            return m2 === 'fallo' ? Infinity : m2
          }
          const [peor, mejor] = valorDe(otra) > valorDe(carta) ? [otra, carta] : [carta, otra]
          anotar(s, 'revelar', `Revelas 2 Destinos: «${destinoDe(copia(s, carta).id).nombre}» y «${destinoDe(copia(s, otra).id).nombre}». Se aplica el peor.`)
          descartarPeligro(s, mejor)
          carta = peor
        }
      }
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
          p.comprometidos.length > 0 && !p.sinReforzar
            ? s.zonas.mano
                .filter((c) => iconosDe(copia(s, c).id, hab) > 0 && (!def.sinAyuda || tipoDe(copia(s, c).id) === 'habilidad'))
                .map((carta) => ({ tipo: 'reforzar' as const, carta }))
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
      p.final = { total, dificultad }
      const superada = p.automatica || (!p.falla && p.comprometidos.length > 0 && total >= dificultad)
      p.resultado = superada ? 'superada' : 'fallada'
      const motivo = p.falla ? ' (el Destino la hace fallar)' : p.comprometidos.length === 0 ? ' (nadie comprometido)' : ''
      const texto = p.automatica ? 'Prueba superada automáticamente.' : `Total ${total} contra ${dificultad}: ${superada ? 'superas' : 'fallas'} la Prueba${motivo}.`
      anotar(s, 'jugada', texto, {
        tipo: 'prueba',
        peligro: copia(s, p.encuentro).id,
        encuentro: def.nombre,
        superada,
      })
      encolar(s, evento(superada ? { tipo: 'superarPrueba' } : { tipo: 'fallarPrueba' }))
      return 'hecha'
    }
  }
}
