// Textos en español de lo que pide el motor en cada momento: decisiones, sucesos y capacidades.
// La interfaz solo dibuja: todo lo que dice sale de aquí.

import { capacidadPorClave } from '../../engine/capacidades/index.ts'
import { CATALOGO, nombreDe, porId, tipoDe } from '../../engine/catalogo.ts'
import { quedaDe, type FormaDeQuitar } from '../../engine/definiciones.ts'
import { destinoDe } from '../../engine/destinos.ts'
import { copia } from '../../engine/estado.ts'
import { INFO_ESTADO, sujetoJuntoAlBarco, type EstadoBarco, type FichaTripulante } from '../../engine/infoEstados.ts'
import { nombreDelEncuentro } from '../../engine/prueba.ts'
import { encuentroDe } from '../../engine/peligros.ts'
import { textoDe } from '../../engine/textos.ts'
import type { AccionSobre, Condicion, Efecto, Medida, Selector } from '../../engine/efectos.ts'
import { textoModSiguiente } from '../../engine/tareas/efectos.ts'
import { reglasMision } from '../../engine/misiones2/registro.ts'
import type { OpcionPrueba } from '../../engine/datos.ts'
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
    // Fase 13 (P82): el Entorno delante del efecto, como condición («[mar]: …», «[nat]/[ciu]: …», «[mar], [agotar]: …»).
    .replace(/\[(mar|nat|ciu)\](?:\/\[(mar|nat|ciu)\])?(?=[:,])/g, (_m, a: string, b?: string) => `${entorno[a]}${b ? ` / ${entorno[b]}` : ''}`)
    .replace(/\{([+−-]?\d+)(?: ([a-zA-Z]+))?(?: [grk])?\}/g, (_m, n: string, ic?: string) => (ic ? `${n} ${iconos[ic] ?? ic}` : n))
    .replace(/\[([a-zA-Z]+)\]/g, (_m, ic: string) => iconos[ic] ?? ic)
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/_(.+?)_/g, '$1')
    .replace(/#(.+?)#/g, '$1')
    .replace(/~(.+?)~/g, '$1')
    .replace(/\\n|\n/g, ' ')
}

/** «COM 3 o EXP 3» */
export function textoOpciones(opciones: readonly OpcionPrueba[]): string {
  // Fase 13 (regla A6): «NAV 4 (Vigía −2)», «NAV 4 (Marinero asignado −2)».
  return opciones
    .map((o) => `${o.hab} ${o.dificultad}${o.alternativa ? ` (${o.alternativa.rasgo}${o.alternativa.comprometido ? ' asignado' : ''} −${o.dificultad - o.alternativa.dificultad})` : ''}`)
    .join(' o ')
}

/** Cómo se quita una carta de Peligro en juego, en palabras. */
export function textoFormaDeQuitar(f: FormaDeQuitar): string {
  switch (f.tipo) {
    case 'destina': {
      // «Destina 6 COM (5 si tienes un Carpintero preparado)», «Destina 6 COM con un solo Tripulante (4 EXP si es un Explorador)».
      const rebaja = f.rebaja ? ` (${f.rebaja.n} si tienes un ${f.rebaja.rasgo} preparado)` : ''
      const alt = f.alternativa ? ` (${f.alternativa.n} ${f.alternativa.hab} si es un ${f.alternativa.rasgo})` : ''
      return `Destina ${f.n} ${f.hab}${f.solo ? ' con un solo Tripulante' : ''}${rebaja}${alt}`
    }
    case 'agotarRasgo':
      return f.rasgo ? `Agota a un ${f.rasgo}` : 'Agota a un Tripulante'
    case 'pagar':
      return `Paga ${plural(f.n, 'carta', 'cartas')}`
  }
}

/** La Respuesta o Interrupción impresa en el encuentro de una carta de Peligro (o su texto entero si no la encuentra). */
function textoDeLaCapacidad(s: Estado, carta: InstId): string {
  try {
    const texto = encuentroDe(s, carta).textoEfecto ?? ''
    const etiqueta = /\*\*(Respuesta|Interrupción):\*\*([^*]+)/.exec(texto)
    const plano = (t: string) => t.replace(/~(.+?)~/g, '$1').replace(/\*\*(.+?)\*\*/g, '$1').replace(/_(.+?)_/g, '$1').replace(/#(.+?)#/g, '$1').replace(/\[([A-Z]+)\]/g, '$1')
    return plano(etiqueta ? `${etiqueta[1]}: ${etiqueta[2]?.trim()}` : texto) || nombre(s, carta)
  } catch {
    return nombre(s, carta)
  }
}

/** Lo que dice una capacidad ofrecida: la carta y su texto. */
export function textoUso(s: Estado, uso: Uso): { carta: string; texto: string } {
  const cap = capacidadPorClave(uso.clave)
  if (cap?.desde === 'estado' || cap?.desde === 'estadoBarco') {
    const estado = cap.carta.slice('estado:'.length) as FichaTripulante | EstadoBarco
    // Fase 16: las Acciones de las cartas de Estado que las descartan («Acción: Agota a un Cirujano: descarta esta carta»).
    const coste = /Acción: (.+?): descarta esta carta/.exec(textoPlano(cap.carta))?.[1]
    if (coste) {
      const de = uso.fuente ? ` de ${nombre(s, uso.fuente)}` : ''
      return { carta: `Descartar «${INFO_ESTADO[estado].nombre}»${de}`, texto: `${coste.charAt(0).toUpperCase()}${coste.slice(1)}.` }
    }
    return { carta: `Usar «${INFO_ESTADO[estado].nombre}»`, texto: INFO_ESTADO[estado].texto }
  }
  if (cap?.desde === 'peligroEnMuelle' && uso.fuente) {
    return { carta: `Descartar «${nombre(s, uso.fuente)}» del muelle`, texto: `Paga ${plural(s.peligrosEnMuelle?.[uso.fuente] ?? 0, 'carta', 'cartas')}.` }
  }
  // Capacidades de un Tripulante señalado por una carta de Peligro («Encontrar al perdido»).
  if (cap?.desde === 'marca' && uso.fuente) {
    return { carta: `«${nombreDe(cap.carta)}»: ${nombre(s, uso.fuente)}`, texto: cap.texto ?? '' }
  }
  if ((cap?.desde === 'permanente' || cap?.desde === 'encuentro' || cap?.desde === 'destino') && uso.fuente) {
    const q = quedaDe(s, uso.fuente)
    const quitar = /\.quitar(\d+)$/.exec(uso.clave)?.[1]
    if (quitar !== undefined) {
      const forma = q?.quitar[Number(quitar)]
      return { carta: `Quitar «${nombre(s, uso.fuente)}»`, texto: forma ? `${textoFormaDeQuitar(forma)}.` : '' }
    }
    const accion = /\.accion(\d+)$/.exec(uso.clave)?.[1]
    const textoAccion = accion !== undefined ? q?.acciones?.[Number(accion)]?.texto : undefined
    return { carta: `«${nombre(s, uso.fuente)}»`, texto: textoAccion ? `${textoAccion}.` : (cap.texto ?? textoDeLaCapacidad(s, uso.fuente)) }
  }
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
      const enc = s.zonas.encuentro.includes(ev.carta) ? `: ${nombreDelEncuentro(s, ev.carta)}` : ''
      return `Has revelado «${nombre(s, ev.carta)}»${enc}.`
    }
    case 'cartaResuelta':
      return `Has terminado con «${nombre(s, ev.carta)}».`
    case 'descartarTripulante':
      return `${nombre(s, ev.carta)} ${antes ? 'va a descartarse' : 'se ha descartado'}.`
    case 'persigue':
      return `«${nombre(s, ev.carta)}» ${antes ? 'va a ponerse' : 'se ha puesto'} encima del mazo de Peligros.`
    case 'canonAgotado':
      return `Has agotado «${nombre(s, ev.carta)}».`
    case 'revelarDestino': {
      const d = destinoDe(copia(s, ev.carta).id)
      return `Se revela el Destino de la carta «${nombre(s, ev.carta)}»: ${d.impreso}.`
    }
    case 'comprometer':
      return 'Has asignado Tripulantes a la Prueba.'
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
    case 'estadoPuesto':
      return `${nombre(s, ev.carta)} ha quedado ${INFO_ESTADO[ev.estado].nombre}.`
    case 'inicioTurno':
      return 'Empieza el turno.'
    case 'finTurno':
      return 'Termina el turno.'
    case 'entraEnJuego':
      return `«${nombre(s, ev.carta)}» entra en juego.`
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
      return { titulo: 'Fase de Inicio', ayuda: 'Antes de la Fase de Reclutamiento puedes usar capacidades sin etiqueta.' }
    case 'jugarCartas':
      return {
        titulo: 'Fase de Reclutamiento',
        ayuda: 'Pulsa una carta del muelle para reclutarla o adquirirla, o una carta de tu mano para jugarla. Pagas descartando cartas de tu mano.',
      }
    case 'quedarseOZarpar':
      return { titulo: 'Fase de Rumbo: ¿te quedas en puerto o zarpas?', ayuda: 'Pulsa una misión disponible para zarpar, o quédate en puerto.' }
    case 'opcionPuerto':
      return {
        titulo: n <= 1 ? 'En puerto: elige la primera opción' : 'En puerto: elige la segunda opción',
        ayuda: `Tienen que ser dos opciones distintas.${s.temporales.some((x) => x.clave === 'cuarentena.turno') ? ' La Cuarentena cierra la Taberna este turno.' : ''}`,
      }
    case 'descartarFinal':
      return { titulo: 'Fase de Final de turno', ayuda: 'Descarta las cartas que quieras. Después robarás hasta tu Mando.' }
    case 'pagar':
      return { titulo: `Paga ${n} por «${nombreCarta(m.carta)}»`, ayuda: `Elige ${plural(n, 'carta', 'cartas')} de tu mano para descartar.` }
    case 'herir':
      return { titulo: `¿Quién sufre ${plural(n, 'herida', 'heridas')}?` }
    case 'heridas': {
      // Heridas libres (fase 10): entre todos tus Tripulantes, salvo si la carta dice «entre los asignados».
      const todos = d.tipo === 'repartir' && s.zonas.tripulacion.every((c) => d.maximos[c] !== undefined)
      return {
        titulo: `Reparte ${plural(n, 'herida', 'heridas')}`,
        ayuda: todos ? 'Entre tus Tripulantes, preparados o agotados, Capitán incluido, como quieras.' : 'Entre los Tripulantes asignados, como quieras.',
      }
    }
    case 'curar':
      return { titulo: `Reparte ${n} de curación`, ayuda: 'Entre tus Tripulantes heridos, como quieras.' }
    case 'agotarCanones':
      return { titulo: `Agota ${n === 1 ? 'un Cañón' : `${n} Cañones`}`, ayuda: 'Elige entre tus Cañones preparados.' }
    case 'prepararCanon':
      return { titulo: '¿Qué Cañón preparas?' }
    case 'agotar':
      return { titulo: `Agota a ${plural(n, 'Tripulante', 'Tripulantes')}` }
    case 'exceso':
      return { titulo: 'No caben todos en el Barco', ayuda: `Despide a ${plural(n, 'Tripulante', 'Tripulantes')}.` }
    case 'desercion':
      return { titulo: 'Deserción', ayuda: 'Elige quién deserta entre tus Tripulantes de menor coste. Vuelve al muelle y sus Mejoras se descartan.' }
    case 'descartar':
      return { titulo: `Descarta ${plural(n, 'carta', 'cartas')} de tu mano` }
    case 'perderMejora':
      return { titulo: 'Pierdes una Mejora', ayuda: m.texto ?? 'Elige cuál se descarta.' }
    case 'agotarMejora':
      return { titulo: 'Agota una Mejora', ayuda: 'Sigue aplicando su texto, pero no podrá usar una capacidad «Agotar:» hasta que se prepare.' }
    case 'tablon':
      return { titulo: 'Tablón de encargos', ayuda: 'Elige las misiones disponibles que mandas al fondo del mazo de Misiones (o ninguna).' }
    case 'soplos':
      return { titulo: 'Soplos de la Hermandad', ayuda: '¿En qué misión disponible pones 2 de Avance?' }
    case 'distancia':
      return {
        titulo: `Cubre la Distancia ${n} de «${nombreCarta(m.carta)}»`,
        ayuda:
          'Agota al menos a un Tripulante preparado (aunque tenga NAV 0) y, si no basta, descarta cartas de tu mano con iconos de NAV hasta sumar al menos ese número. Lo que reduce la Distancia, como el Barco, ya está descontado.',
      }
    case 'comprometer': {
      const enc = s.prueba ? nombreDelEncuentro(s, s.prueba.encuentro) : ''
      const sinAyuda = d.tipo === 'comprometer' && d.sinAyuda
      return {
        titulo: `Prueba: ${enc}${sinAyuda ? ' · Sin ayuda' : ''}`,
        ayuda: sinAyuda
          ? 'Sin ayuda: asigna a un solo Tripulante. Solo suman las Habilidades de tu mano (añádelas ahora: después del Destino ya no se puede), y no puedes jugar Eventos.'
          : 'Asigna Tripulantes preparados y añade ya las cartas de tu mano con iconos de la habilidad: después del Destino no se puede. También puedes no asignar a nadie.',
      }
    }
    case 'elige':
      return { titulo: `«${nombreCarta(m.carta)}»: elige`, ayuda: 'Haz la Prueba o paga lo que pide la carta.' }
    case 'ponerEstado': {
      const info = m.carta ? INFO_ESTADO[m.carta.slice('estado:'.length) as FichaTripulante] : undefined
      return { titulo: `¿Quién queda ${info?.nombre ?? ''}?`, ayuda: info?.texto }
    }
    case 'quitarEstado': {
      const info = m.carta ? INFO_ESTADO[m.carta.slice('estado:'.length) as FichaTripulante] : undefined
      return { titulo: `¿A quién le quitas ${info?.nombre ?? 'el Estado'}?` }
    }
    case 'incautar':
      return { titulo: `Te incautan ${plural(n, 'carta', 'cartas')}`, ayuda: 'Van debajo de la misión. Si la superas, las recuperas; si no, las pierdes.' }
    case 'agotarParaPagar':
      return { titulo: m.carta ? `Agota a un ${m.carta} para pagar` : 'Agota a un Tripulante para pagar' }
    // Peligros 2.0
    case 'elegirEfectos':
      return { titulo: m.carta ? `«${nombreCarta(m.carta)}»: elige` : 'Elige', ayuda: 'Solo se ofrece lo que puedes pagar entero.' }
    case 'aQuien':
      return { titulo: `¿Quién ${m.texto ?? 'es'}?`, ayuda: n > 1 ? `Elige ${n}.` : 'Hay empate: eliges tú.' }
    case 'prepararN':
      return { titulo: `Prepara a ${plural(n, 'Tripulante', 'Tripulantes')}` }
    case 'descartarMayorCoste':
      return { titulo: 'Descarta la carta de mayor coste de tu mano', ayuda: 'Hay empate: eliges cuál.' }
    case 'agotarPago':
      return d.tipo === 'elegirOpcion' ? { titulo: '¿Cómo pagas?' } : { titulo: `Agota a ${plural(n, 'Tripulante', 'Tripulantes')} para pagar` }
    case 'lenguasSueltas':
      return { titulo: '¿Cuál pones en el muelle?', ayuda: 'Sustituye a la carta de más a la izquierda del muelle; las otras van al fondo del mazo de muelle.' }
    case 'marinerosSinBarco':
      return {
        titulo: 'Marineros sin barco: ¿qué Tripulante pones en el muelle?',
        ayuda: 'Sustituye a la carta de más a la izquierda del muelle; las otras van al fondo del mazo de muelle. Este turno, reclutarlo cuesta 1 menos.',
      }
    case 'gratisDelMuelle':
      // Fase 13: «sin coste», el término del reglamento (nunca «gratis»).
      return {
        titulo: 'Del muelle, sin coste',
        ayuda: n >= 99 ? 'Puedes poner en juego sin pagar su coste una carta del muelle, sea cual sea su coste (o ninguna).' : `Puedes poner en juego sin pagar su coste una carta del muelle de coste ${n} o menos (o ninguna).`,
      }
    case 'mitadDelMuelle':
      return {
        titulo: 'Del muelle, a mitad de coste',
        ayuda: `Puedes poner en juego una carta del muelle${n >= 99 ? '' : ` de coste ${n} o menos`} pagando la mitad de su coste, redondeando hacia arriba (o ninguna).`,
      }
    case 'portadorGratis':
      return { titulo: `¿Quién lleva «${nombreCarta(m.carta)}»?` }
    case 'subasta':
      return { titulo: 'Subasta del naufragio', ayuda: 'Puedes poner en juego una Mejora del muelle pagando 2 cartas menos de su coste (o ninguna).' }
    case 'recuperarDescarte':
      return { titulo: `Recupera ${plural(n, 'carta', 'cartas')} de tu descarte` }
    case 'quitarUnEstado':
      return { titulo: '¿A quién le quitas el Estado?', ayuda: m.texto ? `Puedes quitar: ${m.texto}.` : undefined }
    case 'cualEstado':
      return { titulo: `¿Qué Estado le quitas a ${nombreCarta(m.carta)}?` }
    case 'junto':
      return { titulo: `¿Junto a quién va «${nombreCarta(m.carta)}»?`, ayuda: 'Hay empate: eliges tú. La permanente va junto a ese Tripulante.' }
    case 'separados':
      return { titulo: 'Os separáis en la bruma', ayuda: 'Varios asignados empatan con la EXP más baja: eliges quién se pierde (se descarta con sus Mejoras; si es el Capitán, sufre 1 herida en su lugar).' }
    case 'cancelarCualDestino':
      return { titulo: '¿Qué Destino cancelas?', ayuda: 'Esta Prueba resuelve 2 Destinos: la carta cancela solo uno, el que elijas.' }
    case 'cambiarCualDestino':
      return { titulo: '¿Qué Destino cambias?', ayuda: 'Esta Prueba resuelve 2 Destinos: descartas el que elijas y revelas otro en su lugar.' }
    case 'giroDeLaMuerte':
      return { titulo: 'Giro de la muerte: fallas la Prueba…', ayuda: '…salvo que el Tripulante asignado con la habilidad más alta sufra 2 heridas; entonces el Destino es −1.' }
    case 'descartarMuelle':
      return { titulo: '¿Qué carta del muelle se descarta?', ayuda: 'Hay empate: eliges tú.' }
    case 'vendaval':
      return { titulo: 'Vendaval: fallas la Prueba…', ayuda: '…salvo que descartes 2 cartas o agotes a otro Tripulante preparado con NAV 2 o más; entonces el Destino es −2.' }
    case 'ventanaPrueba':
      return { titulo: 'Antes de resolver la Prueba', ayuda: 'Puedes usar capacidades de tus cartas en juego y Eventos que tengan su momento.' }
    case 'trasEncuentro':
      return s.mision?.sinRetirada
        ? { titulo: 'Carta resuelta', ayuda: 'Sigue con la misión revelando otra carta. No puedes retirarte de esta misión.' }
        : { titulo: 'Carta resuelta', ayuda: `Sigue con la misión revelando otra carta, o retírate a puerto (${loQuePierdesAlRetirarte(s)}).` }
    case 'interrupcion':
    case 'respuesta': {
      const suceso = sucesoDe(s, d)
      const que = suceso ? textoSuceso(s, suceso.ev, suceso.fase) : ''
      // Fase 10: las cartas que dan Avance al empezar la misión dicen «Al zarpar» (el motor las ofrece después de zarpar).
      if (suceso?.ev.tipo === 'zarpar') return { titulo: que || 'Al zarpar', ayuda: '¿Usas alguna capacidad «Al zarpar» o «Después de zarpar»? Si no, pasa.' }
      return { titulo: que || (m.clave === 'interrupcion' ? 'Puedes usar una Interrupción' : 'Puedes usar una Respuesta'), ayuda: m.clave === 'interrupcion' ? '¿Usas alguna Interrupción? Si no, pasa.' : '¿Usas alguna Respuesta? Si no, pasa.' }
    }
    case 'ordenObligadas':
      return { titulo: 'Varias capacidades obligadas a la vez', ayuda: 'Elige cuál se aplica primero.' }
    case 'otear':
      return { titulo: `Oteas «${nombreCarta(m.carta)}»`, ayuda: '¿La dejas arriba del mazo o la pones al fondo?' }
    case 'alFondo':
      return { titulo: n === 1 ? 'Elige la carta que va al fondo del mazo' : `Elige las ${n} cartas que van al fondo del mazo` }
    case 'ordenarOteo':
      return { titulo: 'Ordena las cartas que dejas arriba', ayuda: 'La primera que elijas queda encima.' }
    case 'alZarparAgotar':
      return { titulo: m.carta ? `Al zarpar a «${nombreCarta(m.carta)}»` : 'Al zarpar', ayuda: `${m.texto ?? 'Puedes agotar a un Tripulante con el Rasgo que pide la misión'}. Elige a quién, o a nadie.` }
    case 'alZarparDescartar':
      return { titulo: m.carta ? `Al zarpar a «${nombreCarta(m.carta)}»` : 'Al zarpar', ayuda: `¿${m.texto ?? `Descartas ${plural(n, 'carta', 'cartas')}`}?` }
    case 'finalMision':
      return { titulo: `«${nombreCarta(m.carta)}»: elige el final`, ayuda: 'La misión está superada. Elige una de las dos recompensas.' }
    // Fase 15
    case 'bucear':
      return {
        titulo: n === 0 ? '«Fondeáis sobre el San José»: ¿buceas?' : '«Fondeáis sobre el San José»: ¿buceas otra vez?',
        ayuda: `Has superado «El naufragio del San José». Para bucear, agota a un Tripulante preparado y roba 1 carta del mazo del naufragio: lo que pasa lo dice la carta. Quedan ${m.texto ?? 'cartas'} en el mazo.`,
      }
    case 'buzo':
      return { titulo: '¿Quién baja al naufragio?', ayuda: 'Se agota. Lo que la carta le haga «al Tripulante que ha robado esta carta» le pasa a él.' }
    case 'pulpo':
      return { titulo: 'El pulpo de la bodega: elige', ayuda: 'Otro Tripulante preparado puede bajar a sacarlo (se agota) o le dejas que se suelte solo (sufre 2 heridas).' }
    case 'pulpoAyuda':
      return { titulo: '¿Quién baja a sacarlo?', ayuda: 'Se agota.' }
    case 'diarioAvance':
      return { titulo: 'El diario del capitán', ayuda: `¿En qué misión disponible pones ${plural(n, 'ficha', 'fichas')} de Avance? Cuentan cuando zarpes a ella.` }
    case 'desviarAProtegido':
      return {
        titulo: `¿Cuánto recibe «${nombreCarta(m.carta)}» en su lugar?`,
        ayuda: 'Puede llevarse parte o todo. Si se queda sin Vida, se aplica lo que dice su carta.',
      }
    case 'destina':
      return {
        titulo: `Destina ${n} ${m.texto ?? ''}`.trim(),
        ayuda: `Agota a Tripulantes preparados cuya ${m.texto ?? 'habilidad'} sume al menos ${n}, con sus bonificaciones (como al cubrir una Distancia). No es una Prueba: no hay Destino ni cartas de la mano.`,
      }
    case 'destinaSolo':
      return {
        titulo: `Destina ${m.texto ?? n}`,
        ayuda: 'Elige al Tripulante preparado que lo paga él solo, con sus bonificaciones: se agota. No es una Prueba: no hay Destino ni cartas de la mano.',
      }
    case 'conservarMision':
      return { titulo: `No has superado «${nombreCarta(m.carta)}»`, ayuda: '¿La dejas disponible para otro turno o la mandas al fondo del mazo de Misiones?' }
    case 'portadorTesoro':
      return { titulo: `¿Quién lleva «${nombreCarta(m.carta)}»?`, ayuda: 'Un Tesoro no ocupa hueco de Mejora.' }
    case 'reasignarTesoro':
      return { titulo: `«${nombreCarta(m.carta)}» pasa a otro Tripulante`, ayuda: 'Elige quién lo lleva.' }
    case 'preparar':
      return { titulo: 'Prepara a un Tripulante asignado' }
    case 'reclutaEncuentro':
      return { titulo: 'Puedes reclutar a un Tripulante', ayuda: 'Del muelle, pagando su coste (o ninguno).' }
    case 'reclutarGratis':
      return { titulo: 'Recluta sin coste', ayuda: `Un Tripulante del muelle de coste ${n} o menos, sin pagar su coste (o ninguno).` }
    case 'reclutarDelMazoMuelle':
      return {
        titulo: 'Del mazo de muelle, sin coste',
        ayuda: `Puedes reclutar sin coste a uno de estos Tripulantes de coste ${n} o menos (o a ninguno). ${m.texto === 'descartar' ? 'Los demás se descartan.' : 'Los demás van al fondo del mazo de muelle.'}`,
      }
    case 'naufrago':
      return { titulo: 'Náufrago en la playa', ayuda: 'Puedes reclutar sin coste a uno de estos Tripulantes. Al final del turno se descarta.' }
    case 'desviarHeridas':
      return { titulo: n === 1 ? '¿Quién sufre la herida en su lugar?' : `¿Quién sufre las ${n} heridas en su lugar?` }
    case 'curarUno':
      return { titulo: `¿A quién curas ${plural(n, 'herida', 'heridas')}?` }
    case 'entrenamiento':
      return { titulo: '¿Quién recibe la ficha de Entrenamiento?', ayuda: '+1 a una habilidad. Ocupa un hueco de Mejora.' }
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
  return nombreDelEncuentro(s, inst)
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
    case 'menosAvanceEncuentro':
      return `este encuentro da ${e.n} de Avance menos (mín. 0)`
    case 'agotarCanones':
      return e.n === 'todos' ? 'agotas todos tus Cañones' : `agotas ${n2(e.n, 'Cañón', 'Cañones')}`
    case 'perderMejora':
      return e.n === 1 ? 'pierdes una Mejora' : `pierdes ${e.n} Mejoras`
    case 'agotarMejora':
      return 'agotas una Mejora'
    case 'reputacion':
      return e.n < 0 ? `pierdes ${-e.n} de reputación` : `ganas ${e.n} de reputación`
    case 'menosMando':
      return e.proximo ? '−1 Mando en tu próximo turno' : '−1 Mando este turno'
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
    case 'estado': {
      const quien = { uno: 'un Tripulante', comprometido: 'uno de los Tripulantes asignados', todos: 'todos tus Tripulantes', capitan: 'tu Capitán' }[e.a]
      return `${quien} ${e.a === 'todos' ? 'quedan' : 'queda'} ${INFO_ESTADO[e.estado].nombre}`
    }
    case 'estadoBarco': {
      const { quien, adjetivo } = sujetoJuntoAlBarco(e.estado)
      return `${quien} queda ${adjetivo}`
    }
    case 'quitarEstado':
      return `quitas ${INFO_ESTADO[e.estado].nombre}${e.a === 'todos' ? ' a todos' : ''}`
    case 'quitarEstadoBarco': {
      const { quien, adjetivo } = sujetoJuntoAlBarco(e.estado)
      return `${quien} ya no está ${adjetivo}`
    }
    case 'incautar':
      return e.que === 'mano' ? `te incautan ${n2(e.n, 'carta', 'cartas')} de la mano` : e.que === 'mejora' ? 'te incautan una Mejora' : 'te incautan un Tripulante'
    case 'ocuparMuelle':
      return `la carta ocupa el muelle (pagas ${n2(e.coste, 'carta', 'cartas')} para descartarla)`
    case 'modSiguientePrueba':
      return `la siguiente Prueba de esta misión recibe ${e.n > 0 ? '+' : ''}${e.n}`
    case 'mirarPeligros':
      return `miras ${e.n === 1 ? 'la carta superior' : `las ${e.n} cartas superiores`} del mazo de Peligros`
    case 'descartarArriba':
      return `descartas ${e.n === 1 ? 'la carta superior' : `las ${e.n} cartas superiores`} del mazo de Peligros sin resolverla${e.n === 1 ? '' : 's'}`
    case 'noRetirarse':
      return 'no puedes retirarte de esta misión'
    case 'retirarse':
      return 'te retiras de la misión'
    case 'descartarEsta':
      return 'devuelves esta carta al mazo de historia'
    case 'alJunto':
      return describirAQuien({ de: 'capitan' }, e.hacer).replace(/^el Capitán /, 'el Tripulante junto al que está ')
    case 'si': {
      const entonces = describirEfectos(e.entonces)
      const sino = e.sino ? describirEfectos(e.sino) : ''
      return `si ${describirCondicion(e.condicion)}, ${entonces}${sino ? `; si no, ${sino}` : ''}`
    }
    case 'porCada':
      return `${describirEfectos(e.efectos)} por cada ${describirMedida(e.medida)}${e.maximo !== undefined ? ` (máximo ${e.maximo})` : ''}`
    case 'ganarAvance':
      return `+${e.n} de Avance`
    case 'prepararCanones':
      return `preparas ${n2(e.n, 'Cañón', 'Cañones')}`
    case 'preparar':
      return e.n === 'todos' ? 'preparas a todos tus Tripulantes' : e.n === 'comprometidos' ? 'preparas a los Tripulantes asignados' : `preparas a ${n2(e.n, 'Tripulante', 'Tripulantes')}`
    case 'aQuien':
      return describirAQuien(e.quien, e.hacer)
    case 'descartarAzar':
      return `descartas ${n2(e.n, 'carta', 'cartas')} al azar`
    case 'descartarMayorCoste':
      return 'descartas la carta de mayor coste de tu mano'
    case 'agotarPago':
      return `agotas a ${n2(e.n, 'Tripulante', 'Tripulantes')}${e.oRasgo ? ` (o a 1 ${e.oRasgo})` : ''}`
    case 'mirarOrdenar':
      return e.fondo === 'libre' ? `oteas ${e.n}` : `miras las ${e.n} cartas superiores del mazo de Peligros${e.fondo === 'una' ? ' y pones 1 al fondo' : ' y las ordenas'}`
    case 'siguiente':
      return textoModSiguiente(e.mod).replace(/\.$/, '').toLowerCase()
    case 'alFondo':
      return 'esta carta va al fondo del mazo de Peligros'
    case 'elegir':
      return `eliges: ${e.opciones.map((o) => o.texto).join(' o ')}`
    case 'gratisDelMuelle':
      if (e.mitad) return `pones en juego una carta del muelle${e.maxCoste >= 99 ? '' : ` de coste ${e.maxCoste} o menos`} pagando la mitad de su coste`
      return e.maxCoste >= 99 ? 'pones en juego sin coste una carta del muelle' : `pones en juego sin coste una carta del muelle de coste ${e.maxCoste} o menos`
    case 'reclutarDelMazoMuelle':
      return `miras ${e.n} del mazo de muelle y puedes reclutar sin coste a uno de coste ${e.maxCoste} o menos`
    case 'recuperarIncautadas':
      return 'recuperas lo incautado'
    case 'recuperarDescarte':
      return `recuperas ${n2(e.n, 'carta', 'cartas')} de tu descarte`
    case 'ficha':
      return `pones ${n2(e.n, 'ficha', 'fichas')} en esta carta`
    case 'superarSinPrueba':
      return 'superas sin Prueba'
    case 'codigo':
      return null
    case 'descartarMazoCapitan':
      return `descartas ${e.n === 1 ? 'la carta superior' : `las ${e.n} cartas superiores`} de tu mazo del capitán`
    case 'quitarTodosLosEstados':
      return 'quitas todos los Estados de tus Tripulantes'
    case 'ponerEnJuego':
      return `pones en juego «${nombreDe(e.carta)}»${e.siYa ? `; si ya está en juego, ${describirEfectos(e.siYa)}` : ''}`
    case 'quitarUnEstado':
      return `quitas ${e.estados.map((x) => INFO_ESTADO[x].nombre).join(', ')} a un Tripulante${e.curar ? ` y le curas ${e.curar}` : ''}`
    case 'descartarMuelle':
      return `se descarta del muelle ${e.cual === 'izquierda' ? 'la carta de más a la izquierda' : 'la Mejora más cara'}${e.reponer ? ' (se repone)' : ''}`
    case 'sobre':
      return describirAQuien({ de: 'capitan' }, e.hacer).replace(/^el Capitán /, 'ese Tripulante ')
    case 'herirComprometido':
      return `uno de los Tripulantes asignados sufre ${n2(e.n, 'herida', 'heridas')}`
  }
}

const NOMBRE_DE: Record<Selector['de'], string> = {
  comprometidos: 'Tripulante asignado',
  tripulacion: 'Tripulante',
  preparados: 'Tripulante preparado',
  agotados: 'Tripulante agotado',
  noComprometidos: 'Tripulante no asignado',
  noComprometidosPreparados: 'Tripulante preparado no asignado',
  heridos: 'Tripulante herido',
  capitan: 'Capitán',
}

function describirAQuien(q: Selector, a: AccionSobre): string {
  const quien = q.de === 'capitan' ? 'el Capitán' : `${q.cada ? 'cada' : 'el'} ${NOMBRE_DE[q.de]}`
  const por = !q.por || q.por === 'eleccion' || q.por === 'azar' ? '' : q.por === 'menosVida' ? ' con menos Vida' : q.por === 'masHeridas' ? ' con más heridas' : q.por === 'menorCoste' ? ' de menor coste' : 'mas' in q.por ? ` con más ${q.por.mas === 'prueba' ? 'habilidad' : q.por.mas}` : ` con menos ${q.por.menos === 'prueba' ? 'habilidad' : q.por.menos}`
  const que: Record<AccionSobre['tipo'], string> = {
    heridas: 'heridas' in a || a.tipo === 'heridas' ? `sufre ${'n' in a ? n2(a.n, 'herida', 'heridas') : ''}` : '',
    estado: a.tipo === 'estado' ? `queda ${INFO_ESTADO[a.estado].nombre}` : '',
    quitarEstado: a.tipo === 'quitarEstado' ? `pierde ${INFO_ESTADO[a.estado].nombre}` : '',
    descartar: 'se descarta',
    preparar: 'se prepara',
    agotar: 'se agota',
    curar: 'n' in a ? `se cura ${a.n}` : '',
    alMuelle: 'vuelve al muelle',
    noPrepara: 'no se prepara',
    noCompromete: 'no puede ser asignado',
    noSuma: 'no suma',
    varios: a.tipo === 'varios' ? a.acciones.map((x) => describirAQuien({ de: 'capitan' }, x).replace(/^el Capitán /, '')).join(' y ') : '',
    marcar: 'queda señalado',
    elegir: a.tipo === 'elegir' ? a.opciones.map((o) => o.texto).join(' o ') : '',
  }
  return `${quien}${por}${q.por === 'azar' ? ' al azar' : ''} ${que[a.tipo]}`
}

function describirCondicion(c: Condicion): string {
  switch (c.tipo) {
    case 'rasgoPreparado':
      return `tienes un ${c.rasgo} preparado`
    case 'rasgoEnJuego':
      return `tienes un ${c.rasgo}`
    case 'mejoras':
      return `tienes ${c.minimo} o más Mejoras`
    case 'heridas':
      return `tu tripulación tiene ${c.minimo} o más heridas`
    case 'canonesPreparados':
      return c.minimo === 1 ? 'tienes algún Cañón preparado' : `tienes ${c.minimo} o más Cañones preparados`
    case 'estado':
      return `alguien está ${INFO_ESTADO[c.estado].nombre}`
    case 'estadoBarco': {
      const { quien, adjetivo } = sujetoJuntoAlBarco(c.estado)
      return `${quien} está ${adjetivo}`
    }
    case 'no':
      return `no ${describirCondicion(c.condicion)}`
    case 'comprometidos':
      return c.maximo === 1 ? 'asignaste a uno solo' : `asignaste a ${c.minimo ?? 0} o más`
    case 'comprometidoRasgo':
      return `asignaste a un ${c.rasgo}`
    case 'comprometidoEstado':
      return `algún Tripulante asignado está ${INFO_ESTADO[c.estado].nombre}`
    case 'comprometidoCapitan':
      return 'el Capitán está asignado'
    case 'cartaEnJuego':
      return `tienes «${nombreDe(c.id)}»`
    case 'reputacion':
      return `tienes ${c.minimo} o más de reputación`
    case 'danoBarco':
      return `el Barco tiene ${c.minimo} o más daños`
    case 'mano':
      return `tienes ${c.minimo} o más cartas en la mano`
    case 'plazasLibres':
      return 'tienes Capacidad'
    case 'preparados':
      return `tienes ${c.minimo} o más Tripulantes preparados`
    case 'hab':
      return `la Prueba es de ${c.hab}`
    case 'claves':
      return `el encuentro es ${c.claves.join(' o ')}`
    case 'entorno':
      return `estás en ${c.entorno === 'mar' ? 'el Mar' : c.entorno === 'nat' ? 'Naturaleza' : 'Ciudad'}`
    case 'superadaPor':
      return `superas por ${c.minimo} o más`
    case 'falladaPor':
      return `fallas por ${c.minimo} o más`
    case 'todas':
      return c.condiciones.map(describirCondicion).join(' y ')
    case 'alguna':
      return c.condiciones.map(describirCondicion).join(' o ')
  }
}

function describirMedida(m: Medida): string {
  if (typeof m === 'object') return 'rasgo' in m ? m.rasgo : `Tripulante ${INFO_ESTADO[m.estado].nombre}`
  const nombres: Record<Exclude<Medida, object>, string> = {
    mejoras: 'Mejora',
    mejorasBarco: 'Mejora de barco',
    heridas: 'herida de tu tripulación',
    canonesPreparados: 'Cañón preparado',
    tripulantes: 'Tripulante',
    permanentes: 'carta de la zona de permanentes',
    margen: 'punto que superes',
    faltan: 'punto que te falte',
    dano: 'daño del Barco',
    mano: 'carta de tu mano',
    heridos: 'Tripulante herido',
    comprometidos: 'Tripulante asignado',
    comprometidosTrasElPrimero: 'Tripulante asignado después del primero',
  }
  return nombres[m]
}

export function describirEfectos(efectos: readonly Efecto[]): string {
  return efectos
    .map((e) => describirEfecto(e, efectos))
    .filter((x): x is string => Boolean(x))
    .join(' y ')
}

/**
 * Las partes de la recompensa de una misión, en palabras. `como`: lo que ha pasado al superarla (la Gesta, el
 * Tesoro que no se gana, el capítulo que añade una salida doble).
 */
export function partesDeRecompensa(misionId: string, como: { gesta?: boolean; sinTesoro?: boolean; siguiente?: number } = {}): string[] {
  const e = porId(misionId)
  if (e.tipo !== 'capitulo') return []
  const r = e.carta.recompensa
  const partes: string[] = []
  if (r.victoria) partes.push('¡ganas la partida!')
  if (r.rep) partes.push(`+${r.rep} de reputación`)
  if (como.gesta) partes.push('+1 de reputación por la Gesta')
  if (r.draw) partes.push(`robas ${n2(r.draw, 'carta', 'cartas')}`)
  if (r.pasajero) partes.push(`«${nombreDe(r.pasajero)}» sube a bordo como Pasajero`)
  // Fase 15: «Coge la carta 286 del mazo de historia» (una carta de recompensa). Con un final con elección, sus opciones.
  if (r.coge !== undefined) {
    const carta = CATALOGO.find((c) => c.num === r.coge)
    partes.push(`coges la carta ${r.coge} del mazo de historia${carta ? `, «${nombreDe(carta.id)}»` : ''}`)
    const elige = carta?.tipo === 'recompensa' ? (carta.carta.elige ?? []) : []
    if (elige.length > 0) partes.push(`eliges el final: ${elige.map((o) => o.texto.charAt(0).toLowerCase() + o.texto.slice(1)).join(' o ')}`)
  }
  if (r.tesoro) partes.push(como.sinTesoro ? `no ganas el Tesoro «${nombreDe(r.tesoro)}»` : `ganas el Tesoro «${nombreDe(r.tesoro)}»`)
  const siguiente = como.siguiente ?? e.carta.siguiente[0]
  if (siguiente !== undefined && !r.tesoro) {
    const capitulo = e.mision.capitulos.find((c) => c.num === siguiente)
    partes.push(capitulo ? `«${capitulo.nombre}» va encima del mazo de Misiones` : `la carta ${siguiente} va encima del mazo de Misiones`)
  }
  return partes
}

/** Lo que cuesta retirarse: el Avance y, en las misiones que se apartan si no las superas (la regata, «La ruta de los
 * alisios»), también la carta. */
export function loQuePierdesAlRetirarte(s: Estado): string {
  const m = s.mision
  return m && reglasMision(copia(s, m.carta).id)?.apartarSiNoSuperas ? 'pierdes el Avance y la misión se aparta' : 'pierdes el Avance'
}
