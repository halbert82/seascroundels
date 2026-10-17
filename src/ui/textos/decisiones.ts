// Textos en español de lo que pide el motor en cada momento: decisiones, sucesos y capacidades.
// La interfaz solo dibuja: todo lo que dice sale de aquí.

import { nombreDe, porId, tipoDe } from '../../engine/catalogo.ts'
import { destinoDe } from '../../engine/destinos.ts'
import { copia } from '../../engine/estado.ts'
import { encuentroDe } from '../../engine/peligros.ts'
import { textoDe } from '../../engine/textos.ts'
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
