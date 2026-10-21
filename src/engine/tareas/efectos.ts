// Efectos de los recuadros de Peligro y de las líneas Sin oposición, convertidos en tareas.

import { esIndestructible, esUnica, porId, rasgosDe } from '../catalogo.ts'
import { entero } from '../azar.ts'
import type { Condicion, Efecto, Medida, ModSiguiente } from '../efectos.ts'
import { anotar, copia, encolar, nombre, nombres } from '../estado.ts'
import { agotar, tieneEstado, tieneEstadoBarco } from '../estados.ts'
import { entornoActual } from '../peligros.ts'
import { definicionActual, dificultadPrueba, pruebaEnCurso, totalPrueba } from '../prueba.ts'
import type { Estado, InstId, NuevaTarea } from '../tipos.ts'
import { mejoraActiva, plazasLibres, valor } from '../valores.ts'
import { barajar, mover, vinculadas } from '../zonas.ts'
import { eleccionDe, preguntar, type Manejador } from './comun.ts'
import { recuperarIncautadas } from './mision.ts'
import { canonesPreparados } from '../capacidades/comun.ts'
import { puedePrepararse, rescatarRehen, sucesoRehen } from './peligros2.ts'

/** Tripulantes comprometidos que siguen en juego (N7: si no queda ninguno, como sin comprometidos). */
function comprometidosEnJuego(s: Estado): InstId[] {
  return s.prueba ? s.prueba.comprometidos.filter((c) => s.zonas.tripulacion.includes(c)) : []
}

function suceso(ev: { tipo: 'heridas'; objetivo: InstId; cantidad: number } | { tipo: 'danoBarco'; cantidad: number }): NuevaTarea {
  return { tipo: 'evento', ev, fase: 'antes', cancelado: false, usadas: [] }
}

/** ¿Se cumple lo que pregunta la carta a la mesa? */
export function cumple(s: Estado, c: Condicion): boolean {
  switch (c.tipo) {
    case 'rasgoPreparado':
      return s.zonas.tripulacion.some((x) => !copia(s, x).agotada && rasgosDe(copia(s, x).id).includes(c.rasgo))
    case 'rasgoEnJuego':
      return s.zonas.tripulacion.some((x) => rasgosDe(copia(s, x).id).includes(c.rasgo))
    case 'mejoras':
      return s.zonas.mejoras.length >= c.minimo
    case 'heridas':
      return s.zonas.tripulacion.reduce((n, x) => n + copia(s, x).heridas, 0) >= c.minimo
    case 'canonesPreparados':
      return canonesPreparados(s).length >= c.minimo
    case 'estado':
      return s.zonas.tripulacion.some((x) => tieneEstado(s, x, c.estado))
    case 'estadoBarco':
      return tieneEstadoBarco(s, c.estado)
    case 'no':
      return !cumple(s, c.condicion)
    case 'comprometidos': {
      const n = comprometidosEnJuego(s).length
      return n >= (c.minimo ?? 0) && n <= (c.maximo ?? Infinity)
    }
    case 'comprometidoRasgo':
      return comprometidosEnJuego(s).some((x) => rasgosDe(copia(s, x).id).includes(c.rasgo))
    case 'comprometidoEstado':
      return comprometidosEnJuego(s).some((x) => tieneEstado(s, x, c.estado))
    case 'comprometidoCapitan':
      return comprometidosEnJuego(s).includes(s.capitan)
    case 'cartaEnJuego':
      return [...s.zonas.tripulacion, ...s.zonas.mejoras].some((x) => copia(s, x).id === c.id && (s.zonas.tripulacion.includes(x) || mejoraEnJuego(s, x)))
    case 'reputacion':
      return s.reputacion >= c.minimo
    case 'danoBarco':
      return s.danoBarco >= c.minimo
    case 'mano':
      return s.zonas.mano.length >= c.minimo
    case 'plazasLibres':
      return plazasLibres(s) >= c.minimo
    case 'preparados':
      return s.zonas.tripulacion.filter((x) => !copia(s, x).agotada).length >= c.minimo
    case 'hab':
      return s.prueba?.hab === c.hab
    case 'claves':
      return s.prueba !== null && definicionActual(s).palabrasClave.some((k) => c.claves.includes(k))
    case 'entorno':
      return entornoActual(s) === c.entorno
    case 'superadaPor':
      return s.prueba?.resultado === 'superada' && margen(s) >= c.minimo
    case 'falladaPor':
      return s.prueba?.resultado === 'fallada' && faltan(s) >= c.minimo
    case 'todas':
      return c.condiciones.every((x) => cumple(s, x))
    case 'alguna':
      return c.condiciones.some((x) => cumple(s, x))
  }
}

/** Una Mejora o Tesoro en juego: vinculada al Barco o a un Tripulante en juego (aunque esté agotada). */
function mejoraEnJuego(s: Estado, m: InstId): boolean {
  const v = copia(s, m).vinculadaA
  return s.zonas.mejoras.includes(m) && (v === 'barco' || (v !== null && s.zonas.tripulacion.includes(v)))
}

/** Puntos por los que superaste la Prueba en curso (0 si no). */
export function margen(s: Estado): number {
  const p = s.prueba
  if (!p || p.resultado !== 'superada') return 0
  const f = p.final ?? { total: totalPrueba(s), dificultad: dificultadPrueba(s) }
  return Math.max(0, f.total - f.dificultad)
}

/** Puntos que te faltaron en la Prueba en curso: al menos 1 si la fallaste (P8). */
// Si fallas, te falta al menos 1 punto, aunque fallaras por un Destino «Fallas la Prueba» (P8).
export function faltan(s: Estado): number {
  const p = s.prueba
  if (!p || p.resultado !== 'fallada') return 0
  const f = p.final ?? { total: totalPrueba(s), dificultad: dificultadPrueba(s) }
  return Math.max(1, f.dificultad - (p.comprometidos.length > 0 ? f.total : 0))
}

/** Lo que se cuenta en «por cada». */
export function medir(s: Estado, m: Medida): number {
  if (typeof m === 'object') {
    if ('rasgo' in m) return s.zonas.tripulacion.filter((x) => rasgosDe(copia(s, x).id).includes(m.rasgo)).length
    return s.zonas.tripulacion.filter((x) => tieneEstado(s, x, m.estado)).length
  }
  switch (m) {
    case 'margen':
      return margen(s)
    case 'faltan':
      return faltan(s)
    case 'dano':
      return s.danoBarco
    case 'mano':
      return s.zonas.mano.length
    case 'heridos':
      return s.zonas.tripulacion.filter((x) => copia(s, x).heridas > 0).length
    case 'comprometidos':
      return comprometidosEnJuego(s).length
    case 'mejoras':
      return s.zonas.mejoras.length
    case 'mejorasBarco':
      return vinculadas(s, 'barco').length
    case 'heridas':
      return s.zonas.tripulacion.reduce((n, x) => n + copia(s, x).heridas, 0)
    case 'canonesPreparados':
      return canonesPreparados(s).length
    case 'tripulantes':
      return s.zonas.tripulacion.length
    case 'permanentes':
      return s.zonas.permanentes.length
  }
}

/** Un efecto multiplicado («1 herida por cada…»): los que tienen número se multiplican; los demás se repiten. */
function escalar(e: Efecto, k: number): Efecto[] {
  if (k <= 0) return []
  if ('n' in e && typeof e.n === 'number') return [{ ...e, n: e.n * k }]
  if (e.tipo === 'aQuien' && 'n' in e.hacer) return [{ ...e, hacer: { ...e.hacer, n: e.hacer.n * k } }]
  return Array.from({ length: k }, () => e)
}

/**
 * ¿Se puede pagar entero? Para las opciones de pago de «Elige»: una opción que no puedes pagar entera no se
 * ofrece (P11). Lo que no se puede «no pagar» (heridas, daño) siempre se puede.
 */
// En «Elige», una opción de pago que no puedes pagar entera no se ofrece (P11).
export function sePuedePagarEntero(s: Estado, efectos: readonly Efecto[]): boolean {
  const preparados = s.zonas.tripulacion.filter((c) => !copia(s, c).agotada).length
  let mano = 0
  for (const e of efectos) {
    switch (e.tipo) {
      case 'descartar':
        mano += e.n
        break
      case 'incautar':
        if (e.que === 'mano') mano += e.n
        else if (e.que === 'mejora' && s.zonas.mejoras.filter((m) => !esIndestructible(copia(s, m).id)).length < e.n) return false
        else if (e.que === 'tripulante' && s.zonas.tripulacion.filter((c) => c !== s.capitan).length < e.n) return false
        break
      case 'agotar':
        if (e.n !== 'todos' && preparados < e.n) return false
        break
      case 'agotarCanones':
        if (e.n !== 'todos' && canonesPreparados(s).length < e.n) return false
        break
      case 'perderMejora':
        if (s.zonas.mejoras.filter((m) => !esIndestructible(copia(s, m).id)).length < e.n) return false
        break
      case 'perderAvance':
        if (e.n !== 'todo' && (!s.mision || copia(s, s.mision.carta).avance < e.n)) return false
        break
      case 'reputacion':
        if (e.n < 0 && s.reputacion < -e.n) return false
        break
      case 'agotarMejora':
        if (!s.zonas.mejoras.some((m) => mejoraActiva(s, m) && !copia(s, m).agotada && !esIndestructible(copia(s, m).id))) return false
        break
      case 'porCada': {
        const k = Math.max(e.minimo ?? 0, Math.min(medir(s, e.medida), e.maximo ?? Infinity))
        const descartes = e.efectos.reduce((n, x) => n + (x.tipo === 'descartar' ? x.n : 0), 0) * k
        mano += descartes
        if (!sePuedePagarEntero(s, e.efectos.filter((x) => x.tipo !== 'descartar').flatMap((x) => escalar(x, k)))) return false
        break
      }
      case 'si':
        if (!sePuedePagarEntero(s, cumple(s, e.condicion) ? e.entonces : (e.sino ?? []))) return false
        break
      case 'rehen':
        if (!s.zonas.tripulacion.some((c) => c !== s.capitan)) return false
        break
      case 'agotarPago': {
        const conRasgo = e.oRasgo ? s.zonas.tripulacion.some((c) => !copia(s, c).agotada && rasgosDe(copia(s, c).id).includes(e.oRasgo ?? '')) : false
        if (preparados < e.n && !conRasgo) return false
        break
      }
      default:
        break
    }
  }
  return s.zonas.mano.length >= mano
}

/** Tripulantes a los que puede ir un Estado «a uno de los comprometidos» (si no hay, a cualquiera). */
function destinatarios(s: Estado, a: 'uno' | 'comprometido' | 'capitan'): InstId[] {
  if (a === 'capitan') return [s.capitan]
  const comprometidos = comprometidosEnJuego(s)
  return a === 'comprometido' && comprometidos.length > 0 ? comprometidos : [...s.zonas.tripulacion]
}

/**
 * Tareas de una lista de efectos (las heridas de un fallo con comprometidos las agrupa aplicarFallo).
 * `fuente`: la carta que los aplica («descarta esta carta», «ocupa el muelle», «quítale el Estado»).
 */
export function tareasDe(s: Estado, efectos: readonly Efecto[], fuente?: InstId): NuevaTarea[] {
  const enMar = entornoActual(s) === 'mar'
  const tareas: NuevaTarea[] = []
  for (const e of efectos) {
    switch (e.tipo) {
      case 'heridas': {
        if (e.soloEnTierra && enMar) break
        const asignados = e.asignados ? comprometidosEnJuego(s) : []
        if (asignados.length > 1) tareas.push({ tipo: 'repartirHeridas', n: e.n, entre: asignados })
        else tareas.push({ tipo: 'herirUno', n: e.n, entre: e.capitan ? [s.capitan] : asignados.length === 1 ? asignados : [...s.zonas.tripulacion] })
        break
      }
      case 'dano':
        // El Barco solo recibe daño en el Mar; en tierra se aplica la alternativa («/ 1 herida»), si la hay, salvo que la
        // carta diga expresamente que lo daña en tierra (P19).
        if (enMar || e.enTierra) tareas.push(suceso({ tipo: 'danoBarco', cantidad: e.n }))
        break
      case 'reparar':
        tareas.push({ tipo: 'reparar', n: e.n })
        break
      case 'agotar':
        tareas.push({ tipo: 'agotarTripulantes', n: e.n })
        break
      case 'descartar':
        tareas.push({ tipo: 'descartarMano', n: e.n })
        break
      case 'robar':
        tareas.push({ tipo: 'robar', n: e.n })
        break
      case 'curar':
        if (e.modo === 'cadaComprometido') {
          tareas.push({ tipo: 'aQuien', quien: { de: 'comprometidos', cada: true }, hacer: { tipo: 'curar', n: e.n } })
        } else if (e.modo === 'cadaHerido') {
          tareas.push({ tipo: 'aQuien', quien: { de: 'heridos', cada: true }, hacer: { tipo: 'curar', n: e.n } })
        } else tareas.push({ tipo: 'curar', n: e.n, modo: e.modo === 'cadaUno' ? 'cadaUno' : e.modo === 'uno' ? 'uno' : 'repartir' })
        break
      case 'perderAvance':
        tareas.push({ tipo: 'perderAvance', n: e.n })
        break
      case 'menosAvanceEncuentro':
        // Fase 13: lo apunta la Prueba del encuentro y se descuenta al ganar su Avance (nunca por debajo de 0).
        // TODO(regla): en la Prueba de una Acción (sin encuentro) no hay Avance del que descontar: no hace nada.
        if (s.prueba && s.prueba.origen !== 'accion') {
          s.prueba.avanceMenos = (s.prueba.avanceMenos ?? 0) + e.n
          anotar(s, 'efecto', `Este encuentro da ${e.n} de Avance menos (mín. 0).`)
        }
        break
      case 'agotarCanones':
        tareas.push({ tipo: 'agotarCanones', n: e.n })
        break
      case 'perderMejora':
        for (let i = 0; i < e.n; i++) {
          const t: NuevaTarea = e.deComprometidos ? { tipo: 'perderMejora', portadores: comprometidosEnJuego(s) } : { tipo: 'perderMejora' }
          if (e.mayorCoste && t.tipo === 'perderMejora') t.mayorCoste = true
          tareas.push(t)
        }
        break
      case 'agotarMejora':
        tareas.push({ tipo: 'agotarMejora' })
        break
      case 'rehen':
        tareas.push({ tipo: 'rehen', entre: comprometidosEnJuego(s) })
        break
      case 'reputacion':
        tareas.push({ tipo: 'cambiarReputacion', n: e.n })
        break
      case 'menosMando':
        // «En tu próximo turno»: cuenta desde el turno siguiente y se acaba al final de ese turno.
        tareas.push({
          tipo: 'anadirTemporal',
          temporal: e.proximo ? { clave: 'menosMando', fuente: 'regla', hasta: 'finTurno', desdeTurno: s.turno + 1 } : { clave: 'menosMando', fuente: 'regla', hasta: 'finTurno' },
        })
        break
      case 'perderDia':
        tareas.push({ tipo: 'perderDia' })
        break
      case 'entraEnMazo':
        tareas.push({ tipo: 'entrarEnMazo', carta: e.carta })
        break
      case 'seRetira':
        if (s.mision && s.prueba) s.mision.retirar.push(s.prueba.encuentro)
        else if (s.mision && s.zonas.encuentro[0]) s.mision.retirar.push(s.zonas.encuentro[0])
        break
      case 'recluta':
        tareas.push({ tipo: 'reclutaEncuentro' })
        break
      case 'sinFallo':
        if (s.prueba) s.prueba.sinFallo = true
        break
      // Fase 6
      case 'estado':
        if (e.a === 'todos') for (const c of s.zonas.tripulacion) tareas.push({ tipo: 'ponerEstado', estado: e.estado, entre: [c] })
        else tareas.push({ tipo: 'ponerEstado', estado: e.estado, entre: destinatarios(s, e.a) })
        break
      case 'estadoBarco':
        tareas.push({ tipo: 'ponerEstadoBarco', estado: e.estado })
        break
      case 'quitarEstado':
        if (e.a === 'todos') tareas.push({ tipo: 'quitarEstado', estado: e.estado, de: 'todos' })
        else if (e.a === 'fuente') {
          if (fuente) tareas.push({ tipo: 'quitarEstado', estado: e.estado, de: [fuente] })
        } else tareas.push({ tipo: 'quitarEstado', estado: e.estado, de: [...s.zonas.tripulacion] })
        break
      case 'quitarEstadoBarco':
        tareas.push({ tipo: 'quitarEstadoBarco', estado: e.estado })
        break
      case 'incautar': {
        const { tipo: _tipo, ...resto } = e
        tareas.push({ tipo: 'incautar', ...resto })
        break
      }
      case 'ocuparMuelle': {
        const carta = fuente ?? s.zonas.encuentro[0]
        if (carta) tareas.push({ tipo: 'ocuparMuelle', carta, coste: e.coste })
        break
      }
      case 'modSiguientePrueba':
        if (s.mision) {
          s.mision.modsSiguientes = [...(s.mision.modsSiguientes ?? []), { de: 'prueba', n: e.n }]
          anotar(s, 'efecto', `La siguiente Prueba de esta misión recibe ${e.n > 0 ? '+' : ''}${e.n}.`)
        }
        break
      case 'mirarPeligros':
        tareas.push({ tipo: 'mirarPeligros', n: e.n })
        break
      case 'descartarArriba':
        tareas.push({ tipo: 'descartarArriba', n: e.n })
        break
      case 'noRetirarse':
        if (s.mision && !s.mision.sinRetirada) {
          s.mision.sinRetirada = true
          anotar(s, 'aviso', 'No puedes retirarte de esta misión.')
        }
        break
      case 'retirarse':
        if (s.mision && !s.mision.fin) {
          s.mision.fin = 'retirada'
          anotar(s, 'aviso', 'Te retiras de la misión.')
        }
        break
      case 'descartarEsta':
        // En una permanente, «descarta esta carta» la devuelve al mazo de historia (fase 11).
        if (fuente) tareas.push({ tipo: 'devolverPermanente', carta: fuente })
        break
      case 'alJunto': {
        // A quien va junto la permanente («el atrapado», «el señalado», «ese Tripulante»), si sigue en tu tripulación.
        const junto = fuente ? copia(s, fuente).junto : undefined
        if (junto && s.zonas.tripulacion.includes(junto)) {
          tareas.push({ tipo: 'aplicarEfectos', efectos: [{ tipo: 'sobre', carta: junto, hacer: e.hacer }], contexto: 'efecto', ...(fuente ? { fuente } : {}) })
        }
        break
      }
      case 'si':
        tareas.push(...tareasDe(s, cumple(s, e.condicion) ? e.entonces : (e.sino ?? []), fuente))
        break
      case 'porCada': {
        const k = Math.max(e.minimo ?? 0, Math.min(medir(s, e.medida), e.maximo ?? Infinity))
        tareas.push(...tareasDe(s, e.efectos.flatMap((x) => escalar(x, k)), fuente))
        break
      }
      // Peligros 2.0
      case 'ganarAvance':
        if (s.mision && e.n > 0) tareas.push({ tipo: 'ganarAvance', n: e.n, motivo: fuente ? nombre(s, fuente) : 'Efecto' })
        break
      case 'prepararCanones':
        for (let i = 0; i < e.n; i++) tareas.push({ tipo: 'prepararCanon' })
        break
      case 'preparar':
        if (e.n === 'todos') tareas.push({ tipo: 'prepararTripulantes' })
        else if (e.n === 'comprometidos') tareas.push({ tipo: 'aQuien', quien: { de: 'comprometidos', cada: true }, hacer: { tipo: 'preparar' } })
        else tareas.push({ tipo: 'prepararN', n: e.n })
        break
      case 'aQuien':
        tareas.push(fuente ? { tipo: 'aQuien', quien: e.quien, hacer: e.hacer, fuente } : { tipo: 'aQuien', quien: e.quien, hacer: e.hacer })
        break
      case 'descartarAzar':
        tareas.push({ tipo: 'descartarAzar', n: e.n })
        break
      case 'descartarMayorCoste':
        tareas.push({ tipo: 'descartarMayorCoste' })
        break
      case 'agotarPago':
        tareas.push(e.oRasgo ? { tipo: 'agotarPago', n: e.n, oRasgo: e.oRasgo } : { tipo: 'agotarPago', n: e.n })
        break
      case 'mirarOrdenar': {
        const t: NuevaTarea = { tipo: 'otear', n: e.n, cartas: [], arriba: [], fondo: [] }
        if (e.fondo === 'no') Object.assign(t, { fondoMax: 0 })
        if (e.fondo === 'una') Object.assign(t, { fondoMax: 1, fondoMin: 1 })
        tareas.push(t)
        break
      }
      case 'siguiente':
        if (s.mision) {
          s.mision.modsSiguientes = [...(s.mision.modsSiguientes ?? []), e.mod]
          anotar(s, 'efecto', textoModSiguiente(e.mod))
        }
        break
      case 'alFondo':
        if (s.mision && fuente) s.mision.alFondo = fuente
        break
      case 'elegir':
        tareas.push(fuente ? { tipo: 'elegirEfectos', opciones: e.opciones, fuente } : { tipo: 'elegirEfectos', opciones: e.opciones })
        break
      case 'gratisDelMuelle': {
        const t: NuevaTarea = { tipo: 'gratisDelMuelle', maxCoste: e.maxCoste, que: e.que }
        if (e.rasgo) t.rasgo = e.rasgo
        if (e.siNo) t.siNo = e.siNo
        tareas.push(t)
        break
      }
      case 'rescatarRehenes':
        if (s.zonas.rehenes.length > 0) for (const h of [...s.zonas.rehenes]) rescatarRehen(s, h, e.preparados)
        else tareas.push(...tareasDe(s, e.siNo ?? [], fuente))
        break
      case 'recuperarIncautadas':
        recuperarIncautadas(s)
        break
      case 'recuperarDescarte':
        tareas.push({ tipo: 'recuperarDescarte', n: e.n })
        break
      case 'ficha':
        if (fuente) for (let i = 0; i < e.n; i++) tareas.push({ tipo: 'contador', carta: fuente, clave: 'ficha' })
        break
      case 'superarSinPrueba':
        if (s.prueba) s.prueba.automatica = true
        break
      case 'codigo':
        tareas.push(...ejecutarCodigo(s, e.clave, fuente))
        break
      case 'quitarUnEstado':
        tareas.push(e.curar ? { tipo: 'quitarUnEstado', estados: [...e.estados], curar: e.curar } : { tipo: 'quitarUnEstado', estados: [...e.estados] })
        break
      case 'descartarMuelle':
        tareas.push(e.reponer ? { tipo: 'descartarMuelle', cual: e.cual, reponer: true } : { tipo: 'descartarMuelle', cual: e.cual })
        break
      case 'sobre':
        tareas.push({ tipo: 'aQuien', quien: { de: 'tripulacion', inst: e.carta }, hacer: e.hacer, ...(fuente ? { fuente } : {}) })
        break
      case 'herirComprometido': {
        // Maldito: cuando un Destino hiere a «uno de los comprometidos», tiene que ser él. Sin comprometidos, a quien elijas.
        const comprometidos = comprometidosEnJuego(s)
        const malditos = comprometidos.filter((c) => tieneEstado(s, c, 'maldito'))
        tareas.push({ tipo: 'herirUno', n: e.n, entre: malditos.length > 0 ? malditos : comprometidos.length > 0 ? comprometidos : [...s.zonas.tripulacion] })
        break
      }
    }
  }
  return tareas
}

/** Texto para el registro de «la siguiente Prueba / el siguiente encuentro…». */
export function textoModSiguiente(m: ModSiguiente): string {
  const cual = m.de === 'prueba' ? 'La siguiente Prueba' : 'El siguiente encuentro'
  const de = m.claves ? ` ${m.claves.map((k) => `#${k}#`.replaceAll('#', '')).join(' o ')}` : m.hab ? ` de ${m.hab}` : ''
  const que = m.sinAvance ? 'no da Avance' : m.dosDestinos ? 'revela 2 Destinos y aplica el peor' : `recibe ${(m.n ?? 0) > 0 ? '+' : ''}${m.n ?? 0}`
  return `${cual}${de} de esta misión ${que}.`
}

// ---------------------------------------------------------------------------
// Código propio de las cartas: lo que no cabe en los efectos de siempre.

type Codigo = (s: Estado, fuente: InstId | undefined) => NuevaTarea[]
const CODIGOS = new Map<string, Codigo>()

/** Registra una función con su clave, para el efecto `{ tipo: 'codigo', clave }`. */
export function registrarCodigo(clave: string, f: Codigo): void {
  CODIGOS.set(clave, f)
}

function ejecutarCodigo(s: Estado, clave: string, fuente: InstId | undefined): NuevaTarea[] {
  const f = CODIGOS.get(clave)
  if (!f) throw new Error(`Código de carta desconocido: ${clave}`)
  return f(s, fuente)
}

export const aplicarEfectos: Manejador<'aplicarEfectos'> = (s, t) => {
  encolar(s, ...tareasDe(s, t.efectos, t.fuente))
  return 'hecha'
}

/**
 * Recuadro rojo de la Prueba en curso. Fase 10 (heridas libres): las heridas del fallo se reparten como quiera el
 * jugador entre todos sus Tripulantes, preparados o agotados, Capitán incluido, haya asignado a alguien o no; solo las
 * que la carta da «entre los Tripulantes asignados» (o a «un Tripulante asignado») se reparten entre ellos. Las reglas
 * de misión «cada efecto de fallo inflige además 1 herida» suman una vez por recuadro con algo (D2b, D2c), y el
 * Destino «si fallas, sufre además 1 herida», siempre.
 */
export const aplicarFallo: Manejador<'aplicarFallo'> = (s) => {
  const p = pruebaEnCurso(s)
  if (p.sinFallo) {
    anotar(s, 'efecto', 'No se aplica el efecto de fallo.')
    return 'hecha'
  }
  // «Perdidos en la espesura»: sin recuadro rojo tampoco hay herida extra de la misión (D2c); la del Destino, sí (N15).
  const def = definicionActual(s)
  // «1 herida por cada punto que te falte»: son heridas del fallo como las demás (libres, o entre los asignados si lo dice).
  const efectos = (p.ignorarFallo ? [] : def.fallo).flatMap((e): Efecto[] => {
    if (e.tipo !== 'porCada' || !e.efectos.every((x) => x.tipo === 'heridas' && !x.capitan && !x.soloEnTierra)) return [e]
    const k = Math.max(e.minimo ?? 0, Math.min(medir(s, e.medida), e.maximo ?? Infinity))
    const n = k * e.efectos.reduce((t, x) => t + (x.tipo === 'heridas' ? x.n : 0), 0)
    const asignados = e.efectos.every((x) => x.tipo === 'heridas' && x.asignados)
    return n > 0 ? [asignados ? { tipo: 'heridas', n, asignados } : { tipo: 'heridas', n }] : []
  })
  if (p.ignorarFallo) anotar(s, 'efecto', 'Ignoras los efectos de fallo del encuentro.')
  const comprometidos = comprometidosEnJuego(s)
  const extraMision = efectos.length > 0 ? valor(s, { tipo: 'heridaExtraFallo' }) : 0
  const extras = [extraMision, p.heridaSiFallas].filter((n) => n > 0)
  const enMar = entornoActual(s) === 'mar'
  const tareas: NuevaTarea[] = []
  // Heridas libres (entre todos) y las que la carta da a los asignados, cada montón en el sitio de su primera herida.
  let monton = 0
  let posicion = -1
  let deAsignados = 0
  let posicionAsignados = -1
  for (const e of efectos) {
    const esHerida = e.tipo === 'heridas' && !e.capitan && !(e.soloEnTierra && enMar)
    if (esHerida && e.asignados && comprometidos.length > 0) {
      if (posicionAsignados < 0) posicionAsignados = tareas.length
      deAsignados += e.n
    } else if (esHerida) {
      if (posicion < 0) posicion = tareas.length
      monton += e.n
    } else {
      tareas.push(...tareasDe(s, [e], p.encuentro))
    }
  }
  // Abordaje: 1 herida por cada punto que falte (máximo 3); si faltan 3 o más, además un comprometido queda rehén.
  // Faltan max(1, dificultad − total) puntos; sin comprometidos, las heridas van a quien elijas y el rehén es al azar (P8).
  let rehenAbordaje = false
  if (def.abordaje && !p.ignorarFallo) {
    const faltan = Math.max(1, dificultadPrueba(s) - totalPrueba(s))
    const heridas = Math.min(3, faltan)
    anotar(s, 'efecto', `Abordaje: te faltan ${faltan} ${faltan === 1 ? 'punto' : 'puntos'}: ${heridas} ${heridas === 1 ? 'herida' : 'heridas'}${faltan >= 3 ? ' y un rehén' : ''}.`)
    monton += heridas
    rehenAbordaje = faltan >= 3
  }
  monton += extras.reduce((a, b) => a + b, 0)
  const libres: NuevaTarea | null = monton > 0 ? { tipo: 'repartirHeridas', n: monton, entre: [...s.zonas.tripulacion] } : null
  const asignadas: NuevaTarea | null = deAsignados > 0 ? { tipo: 'repartirHeridas', n: deAsignados, entre: comprometidos } : null
  // Se insertan de atrás adelante para que las posiciones no se muevan.
  const inserciones = [
    ...(libres ? [{ en: posicion < 0 ? tareas.length : posicion, t: libres }] : []),
    ...(asignadas ? [{ en: posicionAsignados, t: asignadas }] : []),
  ].sort((a, b) => b.en - a.en)
  for (const x of inserciones) tareas.splice(x.en, 0, x.t)
  if (rehenAbordaje) tareas.push({ tipo: 'rehen', entre: comprometidos })
  encolar(s, ...tareas)
  return 'hecha'
}

/** N heridas a un Tripulante elegido entre los indicados. */
export const herirUno: Manejador<'herirUno'> = (s, t, e) => {
  const candidatos = t.entre.filter((c) => s.zonas.tripulacion.includes(c))
  if (candidatos.length === 0 || t.n <= 0) return 'hecha'
  if (candidatos.length > 1 && !e) {
    return preguntar({ tipo: 'elegirCartas', motivo: { clave: 'herir', n: t.n }, candidatas: candidatos, min: 1, max: 1 })
  }
  const objetivo = candidatos.length === 1 ? candidatos[0] : eleccionDe(e as NonNullable<typeof e>, 'cartas').ids[0]
  if (objetivo) encolar(s, suceso({ tipo: 'heridas', objetivo, cantidad: t.n }))
  return 'hecha'
}

/** N heridas repartidas libremente entre varios Tripulantes (N6). */
export const repartirHeridas: Manejador<'repartirHeridas'> = (s, t, e) => {
  const entre = t.entre.filter((c) => s.zonas.tripulacion.includes(c))
  if (entre.length === 0 || t.n <= 0) return 'hecha'
  if (entre.length === 1 && entre[0]) {
    encolar(s, suceso({ tipo: 'heridas', objetivo: entre[0], cantidad: t.n }))
    return 'hecha'
  }
  if (!e) {
    const maximos: Partial<Record<InstId, number>> = {}
    for (const c of entre) maximos[c] = t.n
    return preguntar({ tipo: 'repartir', motivo: { clave: 'heridas', n: t.n }, cantidad: t.n, maximos })
  }
  const reparto = eleccionDe(e, 'reparto').n
  encolar(
    s,
    ...(Object.entries(reparto) as [InstId, number][])
      .filter(([, n]) => n > 0)
      .map(([objetivo, cantidad]) => suceso({ tipo: 'heridas', objetivo, cantidad })),
  )
  return 'hecha'
}

/** Agota a N Tripulantes. Cada uno que falte es 1 herida a elección; «todos» sin nadie preparado no hace nada (N5). */
export const agotarTripulantes: Manejador<'agotarTripulantes'> = (s, t, e) => {
  const preparados = s.zonas.tripulacion.filter((c) => !copia(s, c).agotada)
  const agotarlos = (cartas: readonly InstId[]) => {
    if (cartas.length > 0) anotar(s, 'efecto', `Agotas a ${nombres(s, cartas)}.`)
    for (const c of cartas) agotar(s, c)
  }
  if (t.n === 'todos') {
    agotarlos(preparados)
    return 'hecha'
  }
  if (preparados.length <= t.n) {
    agotarlos(preparados)
    const faltan = t.n - preparados.length
    encolar(s, ...Array.from({ length: faltan }, (): NuevaTarea => ({ tipo: 'herirUno', n: 1, entre: [...s.zonas.tripulacion] })))
    return 'hecha'
  }
  if (!e) return preguntar({ tipo: 'elegirCartas', motivo: { clave: 'agotar', n: t.n }, candidatas: preparados, min: t.n, max: t.n })
  agotarlos(eleccionDe(e, 'cartas').ids)
  return 'hecha'
}

/** Agota una Mejora preparada (ni Tesoros ni indestructibles). Agotada sigue aplicando su texto (fase 10). */
export const agotarMejora: Manejador<'agotarMejora'> = (s, _t, e) => {
  const candidatas = s.zonas.mejoras.filter((m) => mejoraActiva(s, m) && !copia(s, m).agotada && !esIndestructible(copia(s, m).id))
  const agotar = (m: InstId) => {
    copia(s, m).agotada = true
    anotar(s, 'efecto', `Se agota «${nombre(s, m)}».`)
  }
  if (candidatas.length === 0) return 'hecha'
  if (candidatas.length === 1 && candidatas[0]) {
    agotar(candidatas[0])
    return 'hecha'
  }
  if (!e) return preguntar({ tipo: 'elegirCartas', motivo: { clave: 'agotarMejora' }, candidatas, min: 1, max: 1 })
  const [m] = eleccionDe(e, 'cartas').ids
  if (m) agotar(m)
  return 'hecha'
}

/** Descarta N cartas de la mano (todas si no tienes tantas). */
export const descartarMano: Manejador<'descartarMano'> = (s, t, e) => {
  const descartar = (cartas: readonly InstId[]) => {
    for (const c of cartas) mover(s, c, 'descartesCapitan')
    if (cartas.length > 0) anotar(s, 'efecto', `Descartas ${nombres(s, cartas)}.`)
  }
  if (s.zonas.mano.length <= t.n) {
    descartar([...s.zonas.mano])
    return 'hecha'
  }
  if (!e) return preguntar({ tipo: 'elegirCartas', motivo: { clave: 'descartar', n: t.n }, candidatas: [...s.zonas.mano], min: t.n, max: t.n })
  descartar(eleccionDe(e, 'cartas').ids)
  return 'hecha'
}

/** Pierdes N de Avance de la misión, nunca por debajo de 0. */
export const perderAvance: Manejador<'perderAvance'> = (s, t) => {
  if (!s.mision) return 'hecha'
  const m = copia(s, s.mision.carta)
  const antes = m.avance
  m.avance = t.n === 'todo' ? 0 : Math.max(0, m.avance - t.n)
  if (antes > m.avance) anotar(s, 'efecto', `Pierdes ${antes - m.avance} de Avance.`, { tipo: 'avancePerdido', n: antes - m.avance })
  return 'hecha'
}

/**
 * Agota N Cañones preparados, o todos (fase 10b: antes, «pierdes N munición»). Los eliges tú; si no tienes tantos,
 * se agotan los que haya. `coste`: los agota el jugador para pagar algo («Virar y dar la cara»), y eso es «agotar un
 * Cañón» para la Pólvora del Rey.
 */
export const agotarCanones: Manejador<'agotarCanones'> = (s, t, e) => {
  const preparados = canonesPreparados(s)
  if (preparados.length === 0) return 'hecha'
  let elegidos: InstId[]
  if (t.n === 'todos' || preparados.length <= t.n) elegidos = preparados
  else if (!e) return preguntar({ tipo: 'elegirCartas', motivo: { clave: 'agotarCanones', n: t.n }, candidatas: preparados, min: t.n, max: t.n })
  else elegidos = eleccionDe(e, 'cartas').ids
  for (const c of elegidos) agotar(s, c)
  anotar(s, 'efecto', `Agotas ${elegidos.map((c) => `«${nombre(s, c)}»`).join(' y ')}.`)
  if (t.coste) for (const c of elegidos) encolar(s, { tipo: 'evento', ev: { tipo: 'canonAgotado', carta: c }, fase: 'despues', cancelado: false, usadas: [] })
  return 'hecha'
}

/**
 * Rehén: uno de los comprometidos (si los hay en juego) o uno al azar. El Capitán no puede ser rehén
 * (opción por defecto de CLAUDE.md); con solo el Capitán, no pasa nada (N11).
 */
export const rehen: Manejador<'rehen'> = (s, t, e) => {
  const capturar = (c: InstId) => encolar(s, sucesoRehen(c))
  const comprometidos = t.entre.filter((c) => c !== s.capitan && s.zonas.tripulacion.includes(c))
  if (comprometidos.length > 0) {
    if (comprometidos.length === 1 && comprometidos[0]) {
      capturar(comprometidos[0])
      return 'hecha'
    }
    if (!e) return preguntar({ tipo: 'elegirCartas', motivo: { clave: 'rehen' }, candidatas: comprometidos, min: 1, max: 1 })
    const [c] = eleccionDe(e, 'cartas').ids
    if (c) capturar(c)
    return 'hecha'
  }
  const posibles = s.zonas.tripulacion.filter((c) => c !== s.capitan)
  if (posibles.length === 0) {
    anotar(s, 'efecto', 'No hay nadie a quien capturar.')
    return 'hecha'
  }
  const elegido = posibles[entero(s, posibles.length)]
  s.infoRevelada++
  if (elegido) capturar(elegido)
  void anotar
  return 'hecha'
}

export const cambiarReputacion: Manejador<'cambiarReputacion'> = (s, t) => {
  const antes = s.reputacion
  s.reputacion = Math.max(0, s.reputacion + t.n)
  if (s.reputacion !== antes) {
    const cambio = s.reputacion - antes
    anotar(s, 'efecto', `${cambio > 0 ? 'Ganas' : 'Pierdes'} ${Math.abs(cambio)} de reputación (${s.reputacion}).`, { tipo: 'reputacion', n: cambio })
  }
  return 'hecha'
}

/**
 * Una carta del mazo de historia («La Armada te persigue», la carta 95) entra en el mazo de Peligros normal (N10),
 * aunque la misión use un mazo mezclado. (Las partidas de antes de la fase 10 la tienen en «apartados».)
 */
export const entrarEnMazo: Manejador<'entrarEnMazo'> = (s, t) => {
  const carta = [...s.zonas.mazoHistoria, ...s.zonas.apartados].find((c) => copia(s, c).id === t.carta)
  if (!carta) return 'hecha'
  mover(s, carta, 'mazoPeligros')
  barajar(s, 'mazoPeligros')
  anotar(s, 'aviso', `«${nombre(s, carta)}» entra en el mazo de Peligros.`, { tipo: 'entraEnMazo', carta: t.carta })
  return 'hecha'
}

/** «Recluta»: puedes poner en juego un Tripulante del muelle pagando su coste. */
export const reclutaEncuentro: Manejador<'reclutaEncuentro'> = (s, _t, e) => {
  const candidatos = s.zonas.muelle.filter((c) => {
    const id = copia(s, c).id
    if (porId(id).tipo !== 'tripulante') return false
    if (plazasLibres(s) < 1) return false
    if (s.zonas.mano.length < valor(s, { tipo: 'coste', carta: c })) return false
    return !(esUnica(id) && [...s.zonas.tripulacion, ...s.zonas.rehenes].some((x) => copia(s, x).id === id))
  })
  if (candidatos.length === 0) return 'hecha'
  if (!e) return preguntar({ tipo: 'elegirCartas', motivo: { clave: 'reclutaEncuentro' }, candidatas: candidatos, min: 0, max: 1 })
  const [c] = eleccionDe(e, 'cartas').ids
  if (c) encolar(s, { tipo: 'reclutar', carta: c, paso: 'pagar' })
  return 'hecha'
}

/** Prepara a uno de los Tripulantes indicados (Destino «Ánimo»). */
export const prepararUno: Manejador<'prepararUno'> = (s, t, e) => {
  const candidatos = t.entre.filter((c) => s.zonas.tripulacion.includes(c) && copia(s, c).agotada && puedePrepararse(s, c))
  const preparar = (c: InstId) => {
    copia(s, c).agotada = false
    anotar(s, 'efecto', `${nombre(s, c)} vuelve a estar preparado.`)
  }
  if (candidatos.length === 0) return 'hecha'
  if (candidatos.length === 1 && candidatos[0]) {
    preparar(candidatos[0])
    return 'hecha'
  }
  if (!e) return preguntar({ tipo: 'elegirCartas', motivo: { clave: 'preparar' }, candidatas: candidatos, min: 1, max: 1 })
  const [c] = eleccionDe(e, 'cartas').ids
  if (c) preparar(c)
  return 'hecha'
}
