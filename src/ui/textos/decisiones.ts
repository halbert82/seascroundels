// Textos en español de lo que pide el motor en cada momento: decisiones, sucesos y capacidades.
// La interfaz solo dibuja: todo lo que dice sale de aquí.

import { nombreDe, porId, tipoDe } from '../../engine/catalogo.ts'
import { destinoDe } from '../../engine/destinos.ts'
import { copia } from '../../engine/estado.ts'
import { encuentroDe } from '../../engine/peligros.ts'
import { textoDe } from '../../engine/textos.ts'
import type { Efecto } from '../../engine/efectos.ts'
import type { Decision, Estado, Evento, InstId, Uso } from '../../engine/tipos.ts'

export interface TextoDecision {
  titulo: string
  ayuda?: string
  /** No hay texto para esta decisión (una prueba lo vigila). */
  desconocida?: boolean
}

const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`
const nombre = (s: Estado, inst: InstId) => nombreDe(copia(s, inst).id)

/** Texto de una carta sin el marcado: «Repara {2 dano g}.» → «Repara 2 daño.» */
export function textoPlano(id: string): string {
  const iconos: Record<string, string> = {
    dano: 'daño',
    herida: 'herida',
    avance: 'Avance',
    robar: 'carta',
    curar: 'curación',
    municion: 'munición',
    rep: 'reputación',
    vida: 'Vida',
    capacidad: 'Capacidad',
    mar: 'el Mar',
    nat: 'Naturaleza',
    ciu: 'Ciudad',
    agotar: 'agotar',
    descartar: 'descartar',
    mejora: 'Mejora',
  }
  const entorno: Record<string, string> = { mar: 'Mar', nat: 'Naturaleza', ciu: 'Ciudad' }
  return textoDe(id)
    .replace(/misión \[(mar|nat|ciu)\](?: o \[(mar|nat|ciu)\])?/g, (_m, a: string, b?: string) => `misión de ${entorno[a]}${b ? ` o de ${entorno[b]}` : ''}`)
    .replace(/\{([+−-]?\d+)(?: ([a-zA-Z]+))?(?: [grk])?\}/g, (_m, n: string, ic?: string) => (ic ? `${n} ${iconos[ic] ?? ic}` : n))
    .replace(/\[([a-zA-Z]+)\]/g, (_m, ic: string) => iconos[ic] ?? ic)
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/_(.+?)_/g, '$1')
    .replace(/#(.+?)#/g, '$1')
    .replace(/\\n|\n/g, ' ')
}

/** Lo que dice una capacidad ofrecida: la carta y su texto. */
export function textoUso(s: Estado, uso: Uso): { carta: string; texto: string } {
  const id = uso.fuente ? copia(s, uso.fuente).id : (uso.clave.split('.')[0] ?? '')
  const esEvento = tipoDe(id) === 'evento'
  return { carta: `${esEvento ? 'Jugar' : 'Usar'} «${nombreDe(id)}»`, texto: textoPlano(id) }
}

/** Lo que va a pasar (Interrupciones) o acaba de pasar (Respuestas). */
export function textoSuceso(s: Estado, ev: Evento, fase: 'antes' | 'despues'): string {
  const antes = fase === 'antes'
  switch (ev.tipo) {
    case 'heridas':
      return `${nombre(s, ev.objetivo)} ${antes ? 'va a sufrir' : 'ha sufrido'} ${plural(ev.cantidad, 'herida', 'heridas')}.`
    case 'derrota':
      return `${nombre(s, ev.carta)} ${antes ? 'va a quedar derrotado' : 'ha quedado derrotado'}.`
    case 'danoBarco':
      return `El Barco ${antes ? 'va a recibir' : 'ha recibido'} ${ev.cantidad} de daño.`
    case 'revelarPeligro': {
      const enc = s.zonas.encuentro.includes(ev.carta) ? `: ${encuentroDe(s, ev.carta).nombre}` : ''
      return `Has revelado «${nombre(s, ev.carta)}»${enc}.`
    }
    case 'revelarDestino': {
      const d = destinoDe(copia(s, ev.carta).id)
      return `Se revela el Destino «${d.nombre}» (${d.impreso}).`
    }
    case 'comprometer':
      return 'Has comprometido a tu tripulación en la Prueba.'
    case 'superarPrueba':
      return 'Has superado la Prueba.'
    case 'fallarPrueba':
      return antes ? 'Has fallado la Prueba: vas a aplicar sus efectos de fallo.' : 'Has fallado la Prueba.'
    case 'zarpar':
      return `Zarpas a «${nombre(s, ev.mision)}».`
    case 'reclutar':
      return `Has reclutado a ${nombre(s, ev.carta)}.`
    case 'descartada':
      return `Se ha descartado «${nombre(s, ev.carta)}».`
    case 'inicioTurno':
      return 'Empieza el turno.'
    case 'finTurno':
      return 'Termina el turno.'
  }
}

/** Suceso al que responde una decisión de tipo «ofrecer» (la tarea que pregunta es el propio suceso). */
export function sucesoDe(s: Estado, d: Decision): { ev: Evento; fase: 'antes' | 'despues' } | null {
  const t = s.pila.find((x) => x.id === d.tarea)
  if (t?.tipo !== 'evento') return null
  return { ev: t.ev, fase: t.fase === 'antes' ? 'antes' : 'despues' }
}

function nombreCarta(id: string | undefined): string {
  return id ? nombreDe(id) : ''
}

/** Título y ayuda de la decisión pendiente. */
export function textoDecision(s: Estado, d: Decision): TextoDecision {
  const m = d.motivo
  const n = m.n ?? 0
  switch (m.clave) {
    case 'cambiarMano':
      return { titulo: 'Tu mano inicial', ayuda: 'Puedes descartar las cartas que quieras y robar otras tantas. Si te gusta, confirma sin elegir ninguna.' }
    case 'pausa.inicio':
      return { titulo: 'Inicio del turno', ayuda: 'Antes de jugar cartas puedes usar capacidades sin etiqueta.' }
    case 'jugarCartas':
      return {
        titulo: 'Jugar cartas',
        ayuda: 'Pulsa una carta del muelle para reclutarla o adquirirla, o una carta de tu mano para jugarla. Pagas descartando cartas de tu mano.',
      }
    case 'quedarseOZarpar':
      return { titulo: '¿Te quedas en puerto o zarpas?', ayuda: 'Pulsa una misión disponible para zarpar, o quédate en puerto.' }
    case 'opcionPuerto':
      return { titulo: n <= 1 ? 'En puerto: elige la primera opción' : 'En puerto: elige la segunda opción', ayuda: 'Tienen que ser dos opciones distintas.' }
    case 'descartarFinal':
      return { titulo: 'Final del turno', ayuda: 'Descarta las cartas que quieras. Después robarás hasta tu Mando.' }
    case 'pagar':
      return { titulo: `Paga ${n} por «${nombreCarta(m.carta)}»`, ayuda: `Elige ${plural(n, 'carta', 'cartas')} de tu mano para descartar.` }
    case 'buscar':
      return { titulo: 'Busca en el mazo de muelle', ayuda: 'Elige la carta que pasa al muelle. Después se baraja el mazo.' }
    case 'herir':
      return { titulo: `¿Quién sufre ${plural(n, 'herida', 'heridas')}?` }
    case 'heridas':
      return { titulo: `Reparte ${plural(n, 'herida', 'heridas')}`, ayuda: 'Entre los Tripulantes comprometidos, como quieras.' }
    case 'curar':
      return { titulo: `Reparte ${n} de curación`, ayuda: 'Entre tus Tripulantes heridos, como quieras.' }
    case 'municion':
      return d.tipo === 'repartir'
        ? { titulo: `Pierdes ${n} de munición`, ayuda: 'Reparte la pérdida entre tus Cañones.' }
        : { titulo: `¿A qué Cañón añades ${n} de munición?` }
    case 'agotar':
      return { titulo: `Agota a ${plural(n, 'Tripulante', 'Tripulantes')}` }
    case 'exceso':
      return { titulo: 'No caben todos en el Barco', ayuda: `Despide a ${plural(n, 'Tripulante', 'Tripulantes')}.` }
    case 'desercion':
      return { titulo: 'Deserción', ayuda: 'Elige quién deserta entre tus Tripulantes de menor coste.' }
    case 'descartar':
      return { titulo: `Descarta ${plural(n, 'carta', 'cartas')} de tu mano` }
    case 'perderMejora':
      return { titulo: 'Pierdes una Mejora', ayuda: 'Elige cuál se descarta.' }
    case 'agotarMejora':
      return { titulo: 'Agota una Mejora', ayuda: 'No aplicará su texto hasta que se prepare.' }
    case 'rehen':
      return { titulo: '¿A quién capturan como rehén?', ayuda: 'Si superas la misión, lo rescatas.' }
    case 'tablon':
      return { titulo: 'Tablón de encargos', ayuda: 'Elige las misiones disponibles que mandas al fondo del mazo de Misiones (o ninguna).' }
    case 'soplos':
      return { titulo: 'Soplos de la Hermandad', ayuda: '¿En qué misión disponible pones 2 de Avance?' }
    case 'distancia':
      return {
        titulo: `Cubre la Distancia ${n} de «${nombreCarta(m.carta)}»`,
        ayuda: 'Agota Tripulantes cuya NAV sume al menos ese número y, si hace falta, descarta cartas con iconos de NAV.',
      }
    case 'comprometer': {
      const enc = s.prueba ? encuentroDe(s, s.prueba.encuentro).nombre : ''
      return {
        titulo: `Prueba: ${enc}`,
        ayuda: 'Compromete Tripulantes preparados y añade cartas de tu mano con iconos de la habilidad. También puedes no comprometer a nadie.',
      }
    }
    case 'ventanaPrueba':
      return { titulo: 'Antes de resolver la Prueba', ayuda: 'Puedes reforzar con más cartas de tu mano o usar capacidades.' }
    case 'trasEncuentro':
      return { titulo: 'Carta resuelta', ayuda: 'Sigue con la misión revelando otra carta, o retírate a puerto (pierdes el Avance).' }
    case 'interrupcion':
    case 'respuesta': {
      const suceso = sucesoDe(s, d)
      const que = suceso ? textoSuceso(s, suceso.ev, suceso.fase) : ''
      return { titulo: que || (m.clave === 'interrupcion' ? 'Puedes usar una Interrupción' : 'Puedes usar una Respuesta'), ayuda: m.clave === 'interrupcion' ? '¿Usas alguna Interrupción? Si no, pasa.' : '¿Usas alguna Respuesta? Si no, pasa.' }
    }
    case 'ordenObligadas':
      return { titulo: 'Varias capacidades obligadas a la vez', ayuda: 'Elige cuál se aplica primero.' }
    case 'otear':
      return { titulo: `Oteas «${nombreCarta(m.carta)}»`, ayuda: '¿La dejas arriba del mazo o la pones al fondo?' }
    case 'ordenarOteo':
      return { titulo: 'Ordena las cartas que dejas arriba', ayuda: 'La primera que elijas queda encima.' }
    case 'alZarparAgotar':
      return { titulo: 'Al zarpar', ayuda: `Puedes agotar a un Tripulante con el Rasgo que pide la misión para ganar ${n} de Avance.` }
    case 'alZarparDescartar':
      return { titulo: 'Al zarpar', ayuda: `¿Descartas cartas de tu mano para ganar ${n} de Avance?` }
    case 'conservarMision':
      return { titulo: `No has superado «${nombreCarta(m.carta)}»`, ayuda: '¿La dejas disponible para otro turno o la mandas al fondo del mazo de Misiones?' }
    case 'portadorTesoro':
      return { titulo: `¿Quién lleva «${nombreCarta(m.carta)}»?`, ayuda: 'Un Tesoro no ocupa hueco de Mejora.' }
    case 'reasignarTesoro':
      return { titulo: `«${nombreCarta(m.carta)}» pasa a otro Tripulante`, ayuda: 'Elige quién lo lleva.' }
    case 'preparar':
      return { titulo: 'Prepara a un Tripulante comprometido' }
    case 'reclutaEncuentro':
      return { titulo: 'Puedes reclutar a un Tripulante', ayuda: 'Del muelle, pagando su coste (o ninguno).' }
    case 'reclutarGratis':
      return { titulo: 'Recluta gratis', ayuda: `Un Tripulante del muelle de coste ${n} o menos, sin pagar (o ninguno).` }
    case 'naufrago':
      return { titulo: 'Náufrago en la playa', ayuda: 'Puedes reclutar gratis a uno de estos Tripulantes. Al final del turno se descarta.' }
    case 'desviarHeridas':
      return { titulo: n === 1 ? '¿Quién sufre la herida en su lugar?' : `¿Quién sufre las ${n} heridas en su lugar?` }
    case 'curarUno':
      return { titulo: `¿A quién curas ${plural(n, 'herida', 'heridas')}?` }
    case 'entrenamiento':
      return { titulo: '¿Quién recibe la ficha de Entrenamiento?', ayuda: 'Ocupa un hueco de Mejora.' }
    case 'habilidadEntrenamiento':
      return { titulo: '¿A qué habilidad va el +1?' }
    case 'opcionAutomatica':
      return { titulo: 'Superas la Prueba sin revelar Destino', ayuda: '¿Qué opción de la Prueba superas?' }
    default:
      return { titulo: m.clave, desconocida: true }
  }
}

/** Nombre del encuentro de una carta de Peligro revelada (para el panel de la Prueba). */
export function nombreEncuentro(s: Estado, inst: InstId): string {
  const e = porId(copia(s, inst).id)
  return e.tipo === 'peligro' || e.tipo === 'mazoPropio' ? encuentroDe(s, inst).nombre : nombreDe(e.id)
}

// ---------------------------------------------------------------------------
// Efectos y recompensas en palabras

const n2 = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`

/** Un efecto de recuadro o de línea Sin oposición, en palabras: «2 heridas», «1 daño al Barco (en tierra, 1 herida)». */
export function describirEfecto(e: Efecto, todos: readonly Efecto[] = []): string | null {
  switch (e.tipo) {
    case 'heridas':
      if (e.soloEnTierra) return null // va junto al daño
      return `${n2(e.n, 'herida', 'heridas')}${e.capitan ? ' al Capitán' : ''}`
    case 'dano': {
      const alternativa = todos.find((x) => x.tipo === 'heridas' && x.soloEnTierra)
      const enTierra = alternativa && alternativa.tipo === 'heridas' ? ` (en tierra, ${n2(alternativa.n, 'herida', 'heridas')})` : ''
      return `${n2(e.n, 'daño', 'daños')} al Barco${enTierra}`
    }
    case 'reparar':
      return `reparas ${e.n}`
    case 'agotar':
      return e.n === 'todos' ? 'agotas a todos tus Tripulantes' : `agotas a ${n2(e.n, 'Tripulante', 'Tripulantes')}`
    case 'descartar':
      return `descartas ${n2(e.n, 'carta', 'cartas')}`
    case 'robar':
      return `robas ${n2(e.n, 'carta', 'cartas')}`
    case 'curar':
      return `curas ${e.n}`
    case 'perderAvance':
      return e.n === 'todo' ? 'pierdes todo el Avance' : `pierdes ${e.n} de Avance`
    case 'perderMunicion':
      return `pierdes ${e.n} de munición`
    case 'perderMejora':
      return e.n === 1 ? 'pierdes una Mejora' : `pierdes ${e.n} Mejoras`
    case 'agotarMejora':
      return 'agotas una Mejora'
    case 'rehen':
      return 'te capturan un rehén'
    case 'reputacion':
      return e.n < 0 ? `pierdes ${-e.n} de reputación` : `ganas ${e.n} de reputación`
    case 'menosMando':
      return '−1 Mando este turno'
    case 'perderDia':
      return 'pierdes un día'
    case 'entraEnMazo':
      return `«${nombreDe(e.carta)}» entra en el mazo de Peligros`
    case 'seRetira':
      return 'la carta se retira del juego'
    case 'recluta':
      return 'puedes reclutar'
    case 'sinFallo':
      return 'no se aplica el efecto de fallo'
  }
}

export function describirEfectos(efectos: readonly Efecto[]): string {
  return efectos
    .map((e) => describirEfecto(e, efectos))
    .filter((x): x is string => Boolean(x))
    .join(' y ')
}

/** Las partes de la recompensa de una misión, en palabras. */
export function partesDeRecompensa(misionId: string): string[] {
  const e = porId(misionId)
  if (e.tipo !== 'capitulo') return []
  const r = e.carta.recompensa
  const partes: string[] = []
  if (r.victoria) partes.push('¡ganas la partida!')
  if (r.rep) partes.push(`+${r.rep} de reputación`)
  if (r.search === 'crew') partes.push('buscas un Tripulante en el mazo de muelle')
  else if (r.search === 'ship') partes.push('buscas una Mejora de barco en el mazo de muelle')
  else if (r.search) partes.push('buscas una Mejora en el mazo de muelle')
  if (r.draw) partes.push(`robas ${n2(r.draw, 'carta', 'cartas')}`)
  if (r.tesoro) partes.push(`ganas el Tesoro «${nombreDe(r.tesoro)}»`)
  const siguiente = /carta (\d+)/.exec(e.carta.textoSiguiente)?.[1]
  if (siguiente && !r.tesoro) {
    const capitulo = e.mision.capitulos.find((c) => c.num === Number(siguiente))
    partes.push(capitulo ? `«${capitulo.nombre}» entra en el mazo de Misiones` : `la carta ${siguiente} entra en el mazo de Misiones`)
  }
  return partes
}
