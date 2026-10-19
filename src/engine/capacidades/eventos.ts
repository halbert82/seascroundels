// Capacidades de los Eventos del mazo del capitán: se juegan desde la mano pagando su coste.
// Sin etiqueta, en cualquier pausa (N2); «Acción:», en las ventanas de acción; Respuestas e Interrupciones,
// cuando ocurre lo que dicen. Los números se leen del texto de cada carta.

import { tipoDe } from '../catalogo.ts'
import { anotar, copia } from '../estado.ts'
import { encuentroDe, mazoActivo } from '../peligros.ts'
import { numeroConIcono, numerosEntreLlaves, numeroTras, primerNumero, textoDe } from '../textos.ts'
import type { Capacidad, CartaId, Estado, Ventana } from '../tipos.ts'
import { huecosLibres, plazasLibres } from '../valores.ts'
import { canonesAgotados, destinoVigente, enEntorno, hayAgotados, hayHeridos, hayQueReparar, participantes, peligroRevelado, reclutablesGratis } from './comun.ts'

const texto = (id: CartaId) => textoDe(id)

function evento(carta: CartaId, ventana: Ventana, resto: Omit<Capacidad, 'clave' | 'carta' | 'ventana' | 'desde'>): Capacidad {
  return { clave: `${carta}.jugar`, carta, ventana, desde: 'mano', ...resto }
}

function hayMazoDePeligros(s: Estado): boolean {
  return s.zonas[mazoActivo(s).mazo].length + s.zonas[mazoActivo(s).descartes].length > 0
}

export const CAPACIDADES_EVENTOS: Capacidad[] = [
  // Sin etiqueta: en cualquier pausa.
  evento('botin', 'libre', {
    // «Busca una Mejora.»
    requisito: (s) => s.zonas.mazoMuelle.some((c) => ['mejoraBarco', 'mejoraTripulante'].includes(tipoDe(copia(s, c).id))),
    efecto: () => [{ tipo: 'buscarMuelle', filtro: 'mejora' }],
  }),
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
    // «Prepara todos tus Cañones.» (fase 10b)
    requisito: (s) => canonesAgotados(s).length > 0,
    efecto: () => [{ tipo: 'prepararCanon', todos: true }],
  }),

  // Acción.
  evento('ron_descanso', 'accion', {
    // «Acción: Agota a tu Capitán: Cura 1 herida a cada Tripulante.»
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
    // «Respuesta: Después de que reveles una carta de Peligro en el Mar, gana 2 de Avance.»
    disparo: (s, _yo, ev, fase) => fase === 'despues' && ev.tipo === 'revelarPeligro' && enEntorno(s, 'mar'),
    efecto: () => [{ tipo: 'ganarAvance', n: numeroConIcono(texto('viento'), 'avance'), motivo: '¡A toda vela!' }],
  }),
  evento('sangre_fria', 'respuesta', {
    // «Respuesta: Después de que reveles una carta de Peligro en Ciudad, gana su Avance y descártala sin resolverla.»
    disparo: (s, _yo, ev, fase) => fase === 'despues' && enEntorno(s, 'ciu') && peligroRevelado(s, ev),
    efecto: () => [{ tipo: 'quitarEncuentro', modo: 'descartar', avance: true }],
  }),
  evento('cambio_rumbo', 'respuesta', {
    // «Respuesta: Después de que reveles una carta de Peligro en el Mar, ponla al fondo del mazo de Peligros y revela otra.»
    disparo: (s, _yo, ev, fase) => fase === 'despues' && enEntorno(s, 'mar') && peligroRevelado(s, ev),
    efecto: () => [{ tipo: 'quitarEncuentro', modo: 'fondo', avance: false }],
  }),
  evento('soborno', 'respuesta', {
    // «Respuesta: Después de que reveles una carta de Peligro con Prueba en Ciudad, supera automáticamente esa
    // Prueba, sin revelar Destino.» (N17)
    disparo: (s, _yo, ev, fase) =>
      fase === 'despues' && enEntorno(s, 'ciu') && peligroRevelado(s, ev) && encuentroDe(s, ev.carta).prueba.length > 0 && s.mision?.automatica !== ev.carta,
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
    // «Respuesta: Después de zarpar, gana 1 de Avance y roba 1.»
    disparo: (_s, _yo, ev, fase) => fase === 'despues' && ev.tipo === 'zarpar',
    efecto: () => [
      { tipo: 'ganarAvance', n: numeroConIcono(texto('mapa'), 'avance'), motivo: 'Mapa robado' },
      { tipo: 'robar', n: numeroConIcono(texto('mapa'), 'robar') },
    ],
  }),
  evento('senda', 'respuesta', {
    // «Respuesta: Después de zarpar hacia una misión de Naturaleza, gana 2 de Avance.»
    disparo: (s, _yo, ev, fase) => fase === 'despues' && ev.tipo === 'zarpar' && enEntorno(s, 'nat'),
    efecto: () => [{ tipo: 'ganarAvance', n: numeroConIcono(texto('senda'), 'avance'), motivo: 'Senda escondida' }],
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
    // «Respuesta: Después de que superes una Prueba de COM, recluta del muelle un Tripulante de coste 2 o menos sin
    // pagar su coste.» (también si se superó automáticamente, N17)
    disparo: (s, _yo, ev, fase) =>
      fase === 'despues' && ev.tipo === 'superarPrueba' && s.prueba?.hab === 'COM' && reclutablesGratis(s, numeroTras(texto('prisionero'), 'coste')).length > 0,
    efecto: () => [{ tipo: 'reclutarGratis', maxCoste: numeroTras(texto('prisionero'), 'coste') }],
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
  evento('retirada', 'respuesta', {
    // «Respuesta: Después de que se revele el Destino de una Prueba, descarta la carta de Peligro sin resolverla.»
    // El Destino ya revelado se aplica igual (N16).
    disparo: (s, _yo, ev, fase) => fase === 'despues' && ev.tipo === 'revelarDestino' && s.prueba?.destino === ev.carta && s.zonas.encuentro.includes(s.prueba.encuentro),
    efecto: () => [{ tipo: 'quitarEncuentro', modo: 'descartar', avance: false }],
  }),

  // Interrupciones.
  evento('reflejos', 'interrupcion', {
    // «Interrupción: Cuando se revele un Destino, cancélalo.»
    disparo: (s, _yo, ev, fase) => fase === 'antes' && destinoVigente(s, ev),
    efecto: () => [{ tipo: 'cambiarDestino', modo: 'cancelar' }],
  }),
  evento('ni_hombre', 'interrupcion', {
    // «Interrupción: Cuando un Tripulante que participe en una Prueba vaya a sufrir heridas, elige a otro Tripulante
    // que participe en esa Prueba. Ese Tripulante las sufre en su lugar.»
    disparo: (s, _yo, ev, fase) =>
      fase === 'antes' && ev.tipo === 'heridas' && ev.cantidad > 0 && participantes(s).includes(ev.objetivo) && participantes(s).length > 1,
    efecto: (s, _yo, suceso) => (suceso ? [{ tipo: 'desviarHeridas', suceso: suceso.id, entre: participantes(s) }] : []),
  }),
  evento('espesura', 'interrupcion', {
    // «Interrupción: Cuando vayas a aplicar los efectos de fallo de una Prueba en Naturaleza, ignóralos.» (N15)
    disparo: (s, _yo, ev, fase) => fase === 'antes' && ev.tipo === 'fallarPrueba' && enEntorno(s, 'nat') && s.prueba !== null && !s.prueba.sinFallo && !s.prueba.ignorarFallo,
    efecto: (s) => {
      if (s.prueba) s.prueba.ignorarFallo = true
      return []
    },
  }),
]
