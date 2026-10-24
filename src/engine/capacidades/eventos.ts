// Capacidades de los Eventos del mazo del capitán: se juegan desde la mano pagando su coste.
// Sin etiqueta, en cualquier pausa (N2); «Acción:», en las ventanas de acción; Respuestas e Interrupciones,
// cuando ocurre lo que dicen. Los números se leen del texto de cada carta.

import { anotar, copia } from '../estado.ts'
import { encuentroDe, mazoActivo } from '../peligros.ts'
import { numeroConIcono, numerosEntreLlaves, numeroTras, primerNumero, textoDe } from '../textos.ts'
import type { Capacidad, CartaId, Estado, Ventana } from '../tipos.ts'
import { huecosLibres, plazasLibres } from '../valores.ts'
import { canonesAgotados, destinoVigente, enEntorno, hayAgotados, hayHeridos, hayQueReparar, participantes, peligroQueSePuedeQuitar } from './comun.ts'

const texto = (id: CartaId) => textoDe(id)

function evento(carta: CartaId, ventana: Ventana, resto: Omit<Capacidad, 'clave' | 'carta' | 'ventana' | 'desde'>): Capacidad {
  return { clave: `${carta}.jugar`, carta, ventana, desde: 'mano', ...resto }
}

function hayMazoDePeligros(s: Estado): boolean {
  return s.zonas[mazoActivo(s).mazo].length + s.zonas[mazoActivo(s).descartes].length > 0
}

export const CAPACIDADES_EVENTOS: Capacidad[] = [
  // Sin etiqueta: en cualquier pausa. (Revisión de Albert: fuera «Botín escondido», que buscaba una Mejora.)
  evento('taberna', 'libre', {
    // «Otea 2.»
    requisito: hayMazoDePeligros,
    efecto: () => [{ tipo: 'otear', n: primerNumero(texto('taberna')), cartas: [], arriba: [], fondo: [] }],
  }),
  evento('reparacion', 'libre', {
    // «Repara 2 daño.»
    requisito: hayQueReparar,
    efecto: () => [{ tipo: 'reparar', n: numeroConIcono(texto('reparacion'), 'dano') }],
  }),
  evento('vendas', 'libre', {
    // «Cura 2 heridas.» (repartidas como quieras)
    requisito: hayHeridos,
    efecto: () => [{ tipo: 'curar', n: numeroConIcono(texto('vendas'), 'herida'), modo: 'repartir' }],
  }),
  evento('polvora_c', 'libre', {
    // «Pólvora robada» (revisión de Albert; antes «Pólvora de contrabando», que preparaba todos): «Prepara un Cañón.» Con
    // varios agotados, eliges cuál.
    requisito: (s) => canonesAgotados(s).length > 0,
    efecto: () => [{ tipo: 'prepararCanon' }],
  }),

  // Acción.
  evento('ron_descanso', 'accion', {
    // «Acción: Agota a tu Capitán: Cura 2 heridas a cada Tripulante.» (Revisión de Albert: coste 1 y 2 heridas; antes, 0 y 1.)
    coste: [{ tipo: 'agotarCapitan' }],
    requisito: hayHeridos,
    efecto: () => [{ tipo: 'curar', n: numeroConIcono(texto('ron_descanso'), 'herida'), modo: 'cadaUno' }],
  }),
  evento('arriba', 'accion', {
    // «Acción: Prepara a un Tripulante.»
    requisito: hayAgotados,
    efecto: (s) => [{ tipo: 'prepararUno', entre: s.zonas.tripulacion.filter((c) => copia(s, c).agotada) }],
  }),
  evento('trampa', 'accion', {
    // «Acción: Este turno, las Pruebas de COM en Naturaleza reciben −1 de dificultad.»
    requisito: (s) => !s.temporales.some((x) => x.clave === 'trampa.turno'),
    efecto: () => [{ tipo: 'anadirTemporal', temporal: { clave: 'trampa.turno', fuente: 'trampa', hasta: 'finTurno' } }],
  }),
  {
    clave: 'trampa.turno',
    carta: 'trampa',
    ventana: 'constante',
    desde: 'temporal',
    modifica: (ctx, _yo, c) => (c.tipo === 'dificultad' && c.hab === 'COM' && enEntorno(ctx.s, 'nat') ? (numerosEntreLlaves(texto('trampa'))[0] ?? 0) : 0),
  },
  evento('naufrago', 'accion', {
    // «Acción: Mira las 3 primeras cartas del mazo de muelle. Puedes reclutar a un Tripulante de entre ellas sin
    // pagar su coste. Descarta las demás. Al final del turno, descarta a ese Tripulante.»
    requisito: (s) => plazasLibres(s) >= 1 && s.zonas.mazoMuelle.length + s.zonas.descartesMuelle.length > 0,
    efecto: () => [{ tipo: 'naufrago', n: primerNumero(texto('naufrago')), cartas: [] }],
  }),

  // Respuestas al revelar una carta de Peligro (revelar un Destino no cuenta, D3).
  evento('viento', 'respuesta', {
    // «Respuesta: [Mar]: Después de que reveles una carta de Peligro, gana 1 de Avance.» (Fase 13, P82: el Entorno delante.
    // Revisión de Albert: 1 de Avance; antes, 2.)
    disparo: (s, _yo, ev, fase) => fase === 'despues' && ev.tipo === 'revelarPeligro' && enEntorno(s, 'mar'),
    efecto: () => [{ tipo: 'ganarAvance', n: numeroConIcono(texto('viento'), 'avance'), motivo: '¡A toda vela!' }],
  }),
  evento('sangre_fria', 'respuesta', {
    // «Respuesta: [Ciudad]: Después de que reveles una carta de Peligro, gana su Avance y descártala sin resolverla.»
    // Fase 15: no con un encuentro con Alerta.
    disparo: (s, _yo, ev, fase) => fase === 'despues' && enEntorno(s, 'ciu') && peligroQueSePuedeQuitar(s, ev),
    efecto: () => [{ tipo: 'quitarEncuentro', modo: 'descartar', avance: true }],
  }),
  evento('cambio_rumbo', 'respuesta', {
    // «Respuesta: [Mar]: Después de que reveles una carta de Peligro, ponla al fondo del mazo de Peligros y revela otra.»
    disparo: (s, _yo, ev, fase) => fase === 'despues' && enEntorno(s, 'mar') && peligroQueSePuedeQuitar(s, ev),
    efecto: () => [{ tipo: 'quitarEncuentro', modo: 'fondo', avance: false }],
  }),
  evento('soborno', 'respuesta', {
    // «Respuesta: [Ciudad]: Después de que reveles una carta de Peligro, supera automáticamente su Prueba (no reveles carta
    // de Destino).» (N17) Revisión de Albert: el texto ya no dice «con Prueba», pero sin Prueba no hay nada que superar y no
    // se ofrece (como P23). Con Alerta tampoco (fase 15: Alerta frena a Soborno, lo dice el reglamento).
    disparo: (s, _yo, ev, fase) =>
      fase === 'despues' && enEntorno(s, 'ciu') && peligroQueSePuedeQuitar(s, ev) && encuentroDe(s, ev.carta).prueba.length > 0 && s.mision?.automatica !== ev.carta,
    efecto: (s, _yo, suceso) => {
      if (s.mision && suceso?.ev.tipo === 'revelarPeligro') {
        s.mision.automatica = suceso.ev.carta
        anotar(s, 'efecto', 'Superarás esa Prueba sin revelar Destino.')
      }
      return []
    },
  }),

  // Respuestas en otros momentos.
  evento('mapa', 'respuesta', {
    // «Respuesta: Después de zarpar, gana 1 de Avance y roba 1.» (Fase 13, regla general 2: antes decía «Al zarpar:».)
    disparo: (_s, _yo, ev, fase) => fase === 'despues' && ev.tipo === 'zarpar',
    efecto: () => [
      { tipo: 'ganarAvance', n: numeroConIcono(texto('mapa'), 'avance'), motivo: 'Mapa robado' },
      { tipo: 'robar', n: numeroConIcono(texto('mapa'), 'robar') },
    ],
  }),
  evento('senda', 'respuesta', {
    // «Respuesta: [Naturaleza]: Después de zarpar, gana 2 de Avance.» (Fase 13: antes, «Al zarpar…:».)
    disparo: (s, _yo, ev, fase) => fase === 'despues' && ev.tipo === 'zarpar' && enEntorno(s, 'nat'),
    efecto: () => [{ tipo: 'ganarAvance', n: numeroConIcono(texto('senda'), 'avance'), motivo: 'Senda escondida' }],
  }),
  evento('arenga', 'respuesta', {
    // Fase 13 (P76), «Arenga del capitán» (240): «Respuesta: Después de zarpar, agota a tu Capitán: todos tus Tripulantes
    // quedan Inspirados.» Se juega después de los efectos «Al zarpar» (regla general 2). Si el Capitán ya está agotado (por
    // ejemplo, para la Distancia), no se puede jugar. La ficha dura hasta el final del turno. Los Pasajeros no son
    // Tripulantes: no reciben Ventajas.
    coste: [{ tipo: 'agotarCapitan' }],
    disparo: (_s, _yo, ev, fase) => fase === 'despues' && ev.tipo === 'zarpar',
    efecto: () => [{ tipo: 'aplicarEfectos', efectos: [{ tipo: 'estado', estado: 'inspirado', a: 'todos' }], contexto: 'efecto' }],
  }),
  evento('todos', 'respuesta', {
    // «Respuesta: Después de que comprometas Tripulantes en una Prueba, suma +1 por cada Tripulante comprometido.»
    disparo: (s, _yo, ev, fase) => fase === 'despues' && ev.tipo === 'comprometer' && participantes(s).length > 0,
    efecto: (s) => {
      const n = (numerosEntreLlaves(texto('todos'))[0] ?? 0) * participantes(s).length
      if (s.prueba) s.prueba.bonos.push({ n, canon: false, fuente: 'todos' })
      anotar(s, 'efecto', `La Prueba recibe +${n}.`)
      return []
    },
  }),
  evento('prisionero', 'respuesta', {
    // Fase 14 (Albert): «Respuesta: [Ciudad]: Después de que superes una Prueba de COM, mira las 3 cartas superiores del
    // mazo de muelle. Puedes reclutar sin coste un Tripulante de coste 2 o menos de entre ellas. Descarta las demás.»
    // (También si se superó automáticamente, N17.) Revisión de Albert: solo en Ciudad, y las demás se descartan (antes, al
    // fondo). Sin Capacidad no se ofrece: no podrías reclutar a nadie.
    disparo: (s, _yo, ev, fase) =>
      fase === 'despues' &&
      ev.tipo === 'superarPrueba' &&
      enEntorno(s, 'ciu') &&
      s.prueba?.hab === 'COM' &&
      plazasLibres(s) >= 1 &&
      s.zonas.mazoMuelle.length + s.zonas.descartesMuelle.length > 0,
    efecto: () => [
      { tipo: 'reclutarDelMazoMuelle', n: numeroTras(texto('prisionero'), 'mira las'), maxCoste: numeroTras(texto('prisionero'), 'coste'), cartas: [], resto: 'descartar' },
    ],
  }),
  evento('animo', 'respuesta', {
    // «Respuesta: Después de que falles una Prueba, roba 2.»
    disparo: (_s, _yo, ev, fase) => fase === 'despues' && ev.tipo === 'fallarPrueba',
    efecto: () => [{ tipo: 'robar', n: numeroConIcono(texto('animo'), 'robar') }],
  }),
  evento('leccion', 'respuesta', {
    // «Respuesta: Después de que falles una Prueba, pon una ficha de Entrenamiento de la habilidad de esa Prueba en
    // un Tripulante que participara en ella.» Necesita un hueco libre (D11).
    disparo: (s, _yo, ev, fase) =>
      fase === 'despues' && ev.tipo === 'fallarPrueba' && s.prueba?.hab !== null && participantes(s).some((c) => huecosLibres(s, c) > 0),
    efecto: (s) => (s.prueba?.hab ? [{ tipo: 'ponerEntrenamiento', entre: participantes(s), hab: s.prueba.hab, carta: null }] : []),
  }),

  // Interrupciones.
  // Revisión de Albert: fuera «Retirada a tiempo» (descartaba el Peligro después de ver el Destino).

  evento('reflejos', 'interrupcion', {
    // «Interrupción: Cancela todos los efectos de una carta de Destino recién revelada.» (Revisión de Albert: lo mismo que
    // antes, «Cuando se revele un Destino, cancélalo», redactado de otra forma.)
    disparo: (s, _yo, ev, fase) => fase === 'antes' && destinoVigente(s, ev),
    efecto: () => [{ tipo: 'cambiarDestino', modo: 'cancelar' }],
  }),
  evento('ni_hombre', 'interrupcion', {
    // «Cubrir las espaldas» (antes «Ni un hombre atrás»): cuando un Tripulante que participe en una Prueba vaya a recibir
    // heridas, eliges a otro Tripulante que participe en esa Prueba, que las recibe en su lugar.
    disparo: (s, _yo, ev, fase) =>
      fase === 'antes' && ev.tipo === 'heridas' && ev.cantidad > 0 && participantes(s).includes(ev.objetivo) && participantes(s).length > 1,
    efecto: (s, _yo, suceso) => (suceso ? [{ tipo: 'desviarHeridas', suceso: suceso.id, entre: participantes(s) }] : []),
  }),
  evento('espesura', 'interrupcion', {
    // «Interrupción: [Naturaleza]: Cuando vayas a aplicar los efectos de fallo de una Prueba, ignóralos.» (N15)
    disparo: (s, _yo, ev, fase) => fase === 'antes' && ev.tipo === 'fallarPrueba' && enEntorno(s, 'nat') && s.prueba !== null && !s.prueba.sinFallo && !s.prueba.ignorarFallo,
    efecto: (s) => {
      if (s.prueba) s.prueba.ignorarFallo = true
      return []
    },
  }),
]
