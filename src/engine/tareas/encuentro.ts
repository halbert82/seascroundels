// Cada carta de Peligro de la misión: revelarla, leer su encuentro, la Prueba con su Destino, el Avance
// y la ventana posterior (retirarse o seguir).

import { iconosDe, porId, tipoDe } from '../catalogo.ts'
import { avanceSinSuperar, definicionEncuentro, reglasDe } from '../definiciones.ts'
import { destinoDe } from '../destinos.ts'
import type { Efecto } from '../efectos.ts'
import { anotar, claveUso, copia, encolar, nombre, nombres } from '../estado.ts'
import { agotar, quitarEstado } from '../estados.ts'
import { cartaDeArriba, cerrarPrueba, descartarPeligro, entornoActual, mazoActivo, ponerEnMuelle } from '../peligros.ts'
import { impideRetirarse } from '../definiciones.ts'
import { cumple, faltan, margen } from './efectos.ts'
import { reglasMision } from '../misiones2/registro.ts'
import { vetadoAlComprometer } from './peligros2.ts'
import {
  definicionActual,
  dificultadDeOpcion,
  efectosDeDestino,
  gastarModsSiguientes,
  destinosDeLaPrueba,
  dificultadPrueba,
  modificadorDeDestino,
  nombreDelEncuentro,
  nuevaPrueba,
  pruebaEnCurso,
  totalPrueba,
  buscadoEnCiudad,
} from '../prueba.ts'
import type { Accion, Estado, InstId, NuevaTarea, PruebaEnCurso } from '../tipos.ts'
import type { Habilidad } from '../datos.ts'
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
  // Lo que el texto del encuentro cambia en su Prueba («las Mejoras no suman», «invierte el Destino»…).
  if (origen === 'encuentro') {
    const cambios = definicionEncuentro(s, carta).prueba
    if (cambios) Object.assign(p, cambios)
  }
  s.prueba = p
  // «La primera Prueba de esta misión es Sin ayuda» (El camarote del capitán).
  if (m) {
    if ((m.pruebasEmpezadas ?? 0) === 0 && reglasMision(copia(s, m.carta).id)?.primeraSinAyuda) {
      p.sinAyuda = true
      anotar(s, 'aviso', 'La primera Prueba de esta misión es Sin ayuda.')
    }
    m.pruebasEmpezadas = (m.pruebasEmpezadas ?? 0) + 1
  }
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

/**
 * Avance de más que da un encuentro según la misión («los encuentros #Civil# dan 1 más», «cada Prueba de EXP que
 * superes por 2 o más da 1 más»). Con `p`, la Prueba del encuentro (si se superó).
 */
export function avanceExtraEncuentro(s: Estado, claves: readonly string[], p: PruebaEnCurso | null): number {
  const superada = p?.resultado === 'superada' && p.hab !== null
  const hab: Habilidad | null = superada ? p.hab : null
  return valor(s, { tipo: 'avanceExtraEncuentro', claves, hab, margen: superada ? margen(s) : 0 })
}

/**
 * Avance que dará el encuentro de la Prueba en curso si la superas y si no la superas («3 / 1»), con lo que la misión
 * da de más (lo que depende de por cuánto la superes no se cuenta). Null si no es la Prueba de un encuentro.
 */
export function avancePrevisto(s: Estado, hab: Habilidad | null): { siSuperas: number; siNo: number } | null {
  const p = s.prueba
  if (!p || p.origen === 'accion' || !s.zonas.encuentro.includes(p.encuentro)) return null
  const def = definicionEncuentro(s, p.encuentro)
  const claves = def.palabrasClave
  const siempre = valor(s, { tipo: 'avanceExtraEncuentro', claves, hab: null, margen: 0 })
  // Al superarla: lo de la misión para esa habilidad (superándola por lo justo) y lo de las cartas.
  const alSuperar = hab
    ? valor(s, { tipo: 'avanceExtraEncuentro', claves, hab, margen: 0 }) + valor(s, { tipo: 'avanceExtraPrueba', hab }) + p.avanceSiSuperas
    : siempre + p.avanceSiSuperas
  const menos = p.avanceMenos ?? 0
  return { siSuperas: Math.max(0, def.avance + alSuperar - menos), siNo: Math.max(0, avanceSinSuperar(s, def) + siempre - menos) }
}

/** Al terminar de resolverse, la carta del encuentro va a los descartes o, si lo dice, ocupa el muelle. */
function salidaDelEncuentro(s: Estado, carta: InstId): void {
  const m = s.mision
  // «La Armada te persigue» en la Flota III: después de resolverla, vuelve a apartarse.
  if (m?.alApartar === carta) {
    delete m.alApartar
    m.retirar = m.retirar.filter((c) => c !== carta)
    mover(s, carta, 'mazoHistoria')
    anotar(s, 'efecto', `«${nombre(s, carta)}» vuelve al mazo de historia.`)
    return
  }
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
// Si ese siguiente encuentro no tiene Prueba, el «recibe ±N» se gasta igualmente (no espera al siguiente) (P27).
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
      // «Al revelarse» se aplica antes de las Respuestas a la revelación de la carta (P12).
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
      if (def.pone) {
        // Fase 11: pone en juego una permanente (desde el mazo de historia). Si no está allí, la carta del encuentro se
        // descarta sin Avance y se revela otra; si está, el Avance llega en el paso siguiente, como en cualquier encuentro.
        const { carta: permanente, junto, fichas } = def.pone
        const selector = typeof junto === 'function' ? junto(s) : junto
        t.pone = true
        encolar(s, ...(def.efecto.length > 0 ? [aplicar(def.efecto, 'efecto', carta)] : []), {
          tipo: 'ponerPermanente',
          carta,
          permanente,
          ...(selector ? { junto: selector } : {}),
          ...(fichas !== undefined ? { fichas } : {}),
        })
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
      const p = s.prueba
      const def = definicionEncuentro(s, carta)
      const claves = def.palabrasClave
      // Avance X / Y: si no superas la Prueba del encuentro (fallas, no comprometes a nadie o el Destino dice «Fallas la
      // Prueba»), ganas Y. Si la superas, si en un «Elige» pagas en vez de hacer la Prueba o si no hay Prueba, ganas X.
      // Lo que la misión da de más al superar una Prueba se suma a X.
      const sinSuperar = p?.encuentro === carta && p.origen !== 'accion' && p.hab !== null && p.resultado === 'fallada'
      const base = sinSuperar ? avanceSinSuperar(s, def) : def.avance
      // El encuentro que pone una permanente da su Avance impreso; lo de más de la misión solo si ese Avance no es 0 (como
      // cuando se quedaba en juego).
      const extra = t.pone && def.avance === 0 ? 0 : avanceExtraEncuentro(s, claves, t.pone ? null : p)
      let n = t.sinAvance ? 0 : base + extra
      if (p?.resultado === 'superada' && p.hab) n += p.avanceSiSuperas + valor(s, { tipo: 'avanceExtraPrueba', hab: p.hab })
      // Fase 13: Sin oposición «−1 [avance] (mín. 0)»: este encuentro da menos, sin bajar de 0.
      if (p?.encuentro === carta && p.avanceMenos) n = Math.max(0, n - p.avanceMenos)
      const mc = copia(s, m.carta)
      mc.avance += n
      m.cartasResueltas++
      m.resueltas = [...(m.resueltas ?? []), definicionEncuentro(s, carta).palabrasClave]
      anotar(s, 'efecto', `Ganas ${n} de Avance (${mc.avance}/${valor(s, { tipo: 'avanceNecesario', mision: m.carta })}).`, { tipo: 'avance', n, total: mc.avance })
      salidaDelEncuentro(s, carta)
      cerrarPrueba(s)
      // La permanente que acaba de entrar no cuenta el final de su propio encuentro.
      const permanente = m.permanenteNueva
      delete m.permanenteNueva
      encolar(s, evento(permanente ? { tipo: 'cartaResuelta', carta, permanente } : { tipo: 'cartaResuelta', carta }))
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
        m.retiradaVoluntaria = true
        anotar(s, 'jugada', 'Te retiras y vuelves a puerto.')
      }
      return 'hecha'
    }
  }
}

/** Revela el Destino de la Prueba (con «revela 2 Destinos y aplica el peor», si toca). */
function revelarDestino(s: Estado, p: PruebaEnCurso): void {
  let carta = cartaDeArriba(s, 'destino')
  if (!carta) return
  mover(s, carta, 'destino')
  s.infoRevelada++
  // Mal agüero: se revelan 2 Destinos y se aplica el peor (el otro se descarta).
  if (p.dosDestinos && p.hab) {
    const otra = cartaDeArriba(s, 'destino')
    if (otra) {
      mover(s, otra, 'destino')
      const valorDe = (d: InstId) => {
        const m2 = modificadorDeDestino(s, d, p.encuentro, p.hab ?? 'NAV')
        return m2 === 'fallo' ? Infinity : p.invertirDestino ? -m2 : m2
      }
      const [peor, mejor] = valorDe(otra) > valorDe(carta) ? [otra, carta] : [carta, otra]
      anotar(s, 'revelar', `Revelas 2 Destinos: el de la carta «${nombre(s, carta)}» y el de la carta «${nombre(s, otra)}». Se aplica el peor.`)
      descartarPeligro(s, mejor)
      carta = peor
    }
  }
  p.destino = carta
  const d = destinoDe(copia(s, carta).id)
  // Fase 13, «Bruma en la selva»: «Resuelve 2 cartas de Destino en esta Prueba». Se revelan las dos cartas superiores
  // del mazo de Peligros y valen las dos (P71, confirmado por Albert): se suman los dos modificadores, se aplican los
  // efectos de los dos y, sin nadie asignado, los dos Sin oposición; «Reflejos de gato» cancela solo uno, el que elija el
  // jugador. Con «Mal agüero» a la vez, el primero sale de los 2 de Mal agüero.
  const otra = p.dosDestinosSuman ? cartaDeArriba(s, 'destino') : null
  if (otra) {
    mover(s, otra, 'destino')
    s.infoRevelada++
    p.segundoDestino = otra
    p.segundoCancelado = false
    const d2 = destinoDe(copia(s, otra).id)
    anotar(s, 'revelar', `Destino de la carta «${nombre(s, carta)}»: ${d.impreso}.`, { tipo: 'revelado', inst: carta, como: 'destino' })
    anotar(s, 'revelar', `Segundo Destino, de la carta «${nombre(s, otra)}»: ${d2.impreso}. Valen los dos.`, { tipo: 'revelado', inst: otra, como: 'destino' })
  } else {
    anotar(s, 'revelar', `Destino de la carta «${nombre(s, carta)}»: ${d.impreso}.`, { tipo: 'revelado', inst: carta, como: 'destino' })
  }
  encolar(s, evento({ tipo: 'revelarDestino', carta }))
}

/**
 * Aplica los Destinos revelados que no se han cancelado: modificador, efecto añadido y Sin oposición (N9). Fase 13: con
 * dos Destinos («Bruma en la selva»), sus modificadores se suman y se aplica todo lo de los dos, uno detrás de otro.
 */
function aplicarDestino(s: Estado, p: PruebaEnCurso): NuevaTarea[] {
  if (!p.hab) return []
  // N14: Sin oposición se mira al aplicar el Destino, después de su ventana (N9). Si el Loro se ha unido
  // en ella, ya hay alguien comprometido y no se aplica.
  p.sinOposicion = p.comprometidos.length === 0
  const tareas: NuevaTarea[] = []
  let suma = 0
  for (const { carta, cancelado, segundo } of destinosDeLaPrueba(p)) {
    if (cancelado) continue
    tareas.push(...aplicarUnDestino(s, p, carta, segundo))
    const impreso = modificadorDeDestino(s, carta, p.encuentro, p.hab)
    // «La Madre de agua»: el modificador se invierte («Fallas la Prueba» no cambia).
    const mod = impreso !== 'fallo' && p.invertirDestino ? -impreso : impreso
    if (mod === 'fallo') p.falla = true
    else suma += mod
  }
  p.modDestino = suma
  return tareas
}

/** Lo que un Destino hace además de su modificador (su efecto, su Sin oposición, «persigue»…). */
function aplicarUnDestino(s: Estado, p: PruebaEnCurso, carta: InstId, segundo: boolean): NuevaTarea[] {
  const hab = p.hab
  if (!hab) return []
  const d = destinoDe(copia(s, carta).id)
  p.sinCartas = p.sinCartas || (d.sinCartas ?? false)
  p.sinCanones = p.sinCanones || (d.sinCanones ?? false)
  p.heridaSiFallas += d.heridaSiFallas ?? 0
  p.avanceSiSuperas += d.avanceSiSuperas ?? 0
  p.preparaSiSuperas = p.preparaSiSuperas || (d.preparaSiSuperas ?? false)
  const tareas: NuevaTarea[] = []
  const comprometidos = p.comprometidos.filter((c) => s.zonas.tripulacion.includes(c))
  if (d.heridaComprometido && comprometidos.length > 0) {
    tareas.push({ tipo: 'herirUno', n: d.heridaComprometido, entre: comprometidos })
  }
  if (d.heridaMasFuerte && comprometidos.length > 0) {
    const valores = comprometidos.map((c) => valor(s, { tipo: 'habilidad', carta: c, hab }))
    const maximo = Math.max(...valores)
    tareas.push({ tipo: 'herirUno', n: d.heridaMasFuerte, entre: comprometidos.filter((_, i) => valores[i] === maximo) })
  }
  // Reglas nuevas del Destino: lo que cambia en la Prueba, efectos añadidos y «persigue» (vuelve encima del mazo).
  const reglas = reglasDe(copia(s, carta).id)?.destino
  if (reglas?.prueba) Object.assign(p, reglas.prueba)
  if (reglas?.efectos && reglas.efectos.length > 0) {
    const efectos = efectosDeDestino(s, p, reglas.efectos)
    if (efectos.length > 0) tareas.push({ tipo: 'aplicarEfectos', efectos, contexto: 'efecto', fuente: carta })
  }
  if (p.sinOposicion) tareas.push({ tipo: 'aplicarEfectos', efectos: d.sinOposicion, contexto: 'sinOposicion', fuente: carta })
  if (reglas?.persigue || d.persigue) {
    if (segundo) p.segundoPersigue = true
    else p.persigue = true
  }
  return tareas
}

/**
 * Al ser asignado se agota (Sangrando hiere al agotarse). Fase 10b: si está Aguerrido, es asignado sin agotarse y la
 * ficha se quita. Inspirado y Maldito no se gastan: suman al total mientras duren (prueba.ts).
 */
export function alComprometerse(s: Estado, _p: PruebaEnCurso, c: InstId, agotarlo: boolean): void {
  if (!agotarlo) return
  if (quitarEstado(s, c, 'aguerrido')) {
    anotar(s, 'efecto', `${nombre(s, c)} está Aguerrido: es asignado sin agotarse.`)
    return
  }
  agotar(s, c)
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
      // «La echadora de cartas»: revela el Destino antes de comprometer a nadie (se aplica después, como siempre).
      if (p.destinoAntes && !p.destino && !e) {
        revelarDestino(s, p)
        if (p.destino) return 'sigue'
      }
      if (!e) {
        const habs = new Set(def.opciones.map((o) => o.hab))
        const pregunta = {
          tipo: 'comprometer' as const,
          motivo: { clave: p.origen === 'accion' ? 'comprometerAccion' : 'comprometer', carta: copia(s, p.encuentro).id },
          opciones: def.opciones.map((o) => ({ ...o })),
          // Buscado en Ciudad, «no puede comprometerse» o lo que vete la carta: no se ofrecen.
          tripulantes: def.soloCon
            ? [def.soloCon]
            : s.zonas.tripulacion.filter(
                (c) => !copia(s, c).agotada && !buscadoEnCiudad(s, c) && !vetadoAlComprometer(s, c) && !def.restriccion?.veto?.(s, c),
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
          anotar(s, 'jugada', `${nombre(s, x)} es asignado sin agotarse.`, { tipo: 'usar', carta: copia(s, x).id, clave: `${copia(s, x).id}.sinAgotar` })
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
      if (c.tripulantes.length === 0) anotar(s, 'jugada', `Prueba de ${opcion.hab} ${p.dificultadBase}: no asignas a nadie.`)
      else {
        const conCartas = c.cartas.length > 0 ? ` y añades ${nombres(s, c.cartas)}` : ''
        anotar(s, 'jugada', `Prueba de ${opcion.hab} ${p.dificultadBase}: asignas a ${nombres(s, c.tripulantes)}${conCartas}.`)
      }
      encolar(s, evento({ tipo: 'comprometer' }))
      t.paso = 'destino'
      return 'sigue'
    }
    case 'destino': {
      p.sinOposicion = p.comprometidos.length === 0
      t.paso = 'aplicarDestino'
      // «La echadora de cartas»: el Destino ya se reveló antes de comprometer (no se revela otro).
      if (p.destino) return 'sigue'
      revelarDestino(s, p)
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
        // Sin refuerzo: en la ventana de acción solo se usan capacidades (de cartas en juego y Eventos con su momento).
        const acciones: Accion[] = [...usosDisponibles(s, ['accion', 'libre']).map((uso) => ({ tipo: 'usar' as const, uso })), { tipo: 'terminarPaso' }]
        return preguntar({ tipo: 'ventanaAccion', motivo: { clave: 'ventanaPrueba', n: dificultadPrueba(s) }, acciones })
      }
      const accion = eleccionDe(e, 'accion').accion
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
      // Fase 15, «Descomunal N»: con menos de N asignados, la Prueba se falla (también si el Loro se une solo).
      const pocos = def.minimo !== undefined && p.comprometidos.length < def.minimo
      const superada = p.automatica || (!p.falla && !pocos && p.comprometidos.length > 0 && total >= dificultad)
      p.resultado = superada ? 'superada' : 'fallada'
      // Se apunta en la misión (las reglas de misión miran qué Pruebas has superado o fallado, y por cuánto).
      if (s.mision && p.hab) {
        const hecha = {
          hab: p.hab,
          superada,
          margen: superada ? margen(s) : -faltan(s),
          claves: [...def.palabrasClave],
          encuentro: p.origen !== 'accion',
          nadie: p.comprometidos.length === 0,
        }
        s.mision.pruebas = [...(s.mision.pruebas ?? []), hecha]
      }
      const motivo = p.falla
        ? ' (el Destino la hace fallar)'
        : p.comprometidos.length === 0
          ? ' (nadie asignado)'
          : pocos
            ? ` (Descomunal ${def.minimo}: no llegas a ${def.minimo} asignados)`
            : ''
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
