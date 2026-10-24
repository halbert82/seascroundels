// Capacidades de las Mejoras de barco, las Mejoras de tripulante y los Tesoros (salvo las constantes de
// números, que están en constantes.ts). Los números se leen del texto de cada carta.

import { anotar, copia, nombre } from '../estado.ts'
import { mazoActivo } from '../peligros.ts'
import { clavesDelEncuentro, definicionDe, dificultadDeOpcion, esAbordaje } from '../prueba.ts'
import { numeroConIcono, numerosEntreLlaves, numeroTras, primerNumero, textoDe } from '../textos.ts'
import type { Habilidad } from '../datos.ts'
import type { Capacidad, CartaId, Estado, InstId, NuevaTarea } from '../tipos.ts'
import { valor } from '../valores.ts'
import { mover } from '../zonas.ts'
import { conPruebaDe, destinoVigente, enEntorno, hayAgotados, hayHeridos, participa, participantes, peligroQueSePuedeQuitar, portadorDe } from './comun.ts'

const texto = (id: CartaId) => textoDe(id)

/** Suma una bonificación a la Prueba en curso. Las de Cañón se anulan con «Los Cañones no suman». */
function bono(s: Estado, n: number, canon: boolean, fuente: CartaId): NuevaTarea[] {
  if (!s.prueba) return []
  s.prueba.bonos.push({ n, canon, fuente })
  anotar(s, 'efecto', `La Prueba recibe ${n > 0 ? '+' : ''}${n}.`)
  return []
}

/** Prueba en curso de esa habilidad, ya comprometida y con alguien que participa (si no, se falla igual). */
function pruebaDe(s: Estado, hab: Habilidad): boolean {
  const p = s.prueba
  return p !== null && !p.automatica && p.hab === hab && participantes(s).length > 0
}

/** «Reduce su Vida a 1»: el Tripulante que iba a quedar derrotado se queda con esa Vida restante. */
function salvarDeLaDerrota(s: Estado, objetivo: InstId, vida: number): void {
  copia(s, objetivo).heridas = Math.max(0, valor(s, { tipo: 'vida', carta: objetivo }) - vida)
  anotar(s, 'efecto', `${nombre(s, objetivo)} no queda derrotado: se queda con ${vida} de Vida.`)
}

export const CAPACIDADES_MEJORAS: Capacidad[] = [
  // ---------------------------------------------------------------------------
  // Mejoras de barco

  // Vela mayor: «Al zarpar: [Mar]: Gana 1 de Avance.» Se aplica sola.
  {
    clave: 'vela.alZarpar',
    carta: 'vela',
    ventana: 'alZarpar',
    desde: 'juego',
    requisito: (s) => enEntorno(s, 'mar'),
    efecto: () => [{ tipo: 'ganarAvance', n: numeroConIcono(texto('vela'), 'avance'), motivo: 'Vela mayor' }],
  },
  // Chalupa: «Al zarpar: [Naturaleza]/[Ciudad]: Gana 1 de Avance.»
  {
    clave: 'chalupa.alZarpar',
    carta: 'chalupa',
    ventana: 'alZarpar',
    desde: 'juego',
    requisito: (s) => enEntorno(s, 'nat', 'ciu'),
    efecto: () => [{ tipo: 'ganarAvance', n: numeroConIcono(texto('chalupa'), 'avance'), motivo: 'Chalupa' }],
  },
  // Bandera negra: «[Mar]: Tus Pruebas de COM reciben +1.»
  {
    clave: 'bandera.com',
    carta: 'bandera',
    ventana: 'constante',
    desde: 'juego',
    modifica: (ctx, _yo, c) => (c.tipo === 'totalPrueba' && c.hab === 'COM' && enEntorno(ctx.s, 'mar') ? (numerosEntreLlaves(texto('bandera'))[0] ?? 0) : 0),
  },
  // Botica de a bordo: «Descarta 1 carta de tu mano: Cura 1 herida a un Tripulante. (Límite de dos veces por turno.)»
  {
    clave: 'botica.curar',
    carta: 'botica',
    ventana: 'libre',
    desde: 'juego',
    limite: { veces: 2, por: 'turno' },
    coste: [{ tipo: 'pagar', n: primerNumero(texto('botica')) }],
    requisito: hayHeridos,
    efecto: () => [{ tipo: 'curar', n: numeroConIcono(texto('botica'), 'herida'), modo: 'uno' }],
  },
  // Víveres de reserva: «Acción: Descarta Víveres de reserva: Prepara a todos tus Tripulantes.»
  {
    clave: 'viveres.preparar',
    carta: 'viveres',
    ventana: 'accion',
    desde: 'juego',
    coste: [{ tipo: 'descartarse' }],
    requisito: hayAgotados,
    efecto: () => [{ tipo: 'prepararTripulantes' }],
  },
  // La Cruz de Santa Bárbara: «Cuando el Barco vaya a sufrir más de 2 daño a la vez, en vez de eso sufre 2.» Se aplica sola.
  {
    clave: 'cruz.tope',
    carta: 'cruz',
    ventana: 'obligada',
    desde: 'juego',
    disparo: (_s, _yo, ev, fase) => fase === 'antes' && ev.tipo === 'danoBarco' && ev.cantidad > numeroConIcono(texto('cruz'), 'dano'),
    efecto: (s, _yo, suceso) => {
      if (suceso?.ev.tipo === 'danoBarco') {
        suceso.ev.cantidad = numeroConIcono(texto('cruz'), 'dano')
        anotar(s, 'efecto', `La Cruz de Santa Bárbara deja el daño en ${suceso.ev.cantidad}.`)
      }
      return []
    },
  },
  // Cañones de bronce: «[mar], Agotar: Una Prueba de COM recibe +2.» Fase 10b: sin munición. Fase 13 (Albert): fuera N18;
  // una Mejora de barco se usa en cualquier Entorno salvo que la carta lo limite, como aquí («[mar], [agotar]: …»).
  {
    clave: 'bronce.disparar',
    carta: 'bronce',
    ventana: 'libre',
    desde: 'juego',
    coste: [{ tipo: 'agotarse' }],
    requisito: (s) => enEntorno(s, 'mar') && pruebaDe(s, 'COM'),
    efecto: (s) => bono(s, numerosEntreLlaves(texto('bronce'))[0] ?? 0, true, 'bronce'),
  },
  // Carronadas: «Agotar: Supera automáticamente una Prueba de COM de dificultad 4 o menos, sin revelar Destino.»
  // Se usa antes de comprometer (aún no hay Destino). La dificultad cuenta sus modificadores (N17).
  {
    clave: 'carronadas.disparar',
    carta: 'carronadas',
    ventana: 'libre',
    desde: 'juego',
    coste: [{ tipo: 'agotarse' }],
    requisito: (s) => enEntorno(s, 'mar') && opcionDeCarronadas(s) !== null,
    efecto: (s) => {
      const opcion = opcionDeCarronadas(s)
      if (s.prueba && opcion !== null) {
        s.prueba.automatica = true
        s.prueba.opcion = opcion
      }
      return []
    },
  },
  // Culebrina de proa: «[mar], Agotar: Una Prueba de NAV recibe +2.»
  {
    clave: 'culebrina.disparar',
    carta: 'culebrina',
    ventana: 'libre',
    desde: 'juego',
    coste: [{ tipo: 'agotarse' }],
    requisito: (s) => enEntorno(s, 'mar') && pruebaDe(s, 'NAV'),
    efecto: (s) => bono(s, numerosEntreLlaves(texto('culebrina'))[0] ?? 0, true, 'culebrina'),
  },
  // Pedrero de borda: «Respuesta: Agotar: Después de que reveles una carta de Peligro con Prueba de COM,
  // descártala sin resolverla y revela otra.» Fase 13: solo en el Mar porque la carta lo dice («[mar], [agotar]»).
  {
    clave: 'pedrero.disparar',
    carta: 'pedrero',
    ventana: 'respuesta',
    desde: 'juego',
    coste: [{ tipo: 'agotarse' }],
    disparo: (s, _yo, ev, fase) => fase === 'despues' && enEntorno(s, 'mar') && peligroQueSePuedeQuitar(s, ev) && conPruebaDe(s, ev.carta, 'COM'),
    efecto: () => [{ tipo: 'quitarEncuentro', modo: 'descartar', avance: false }],
  },
  // Velas de tormenta: «Respuesta: Agotar: Después de que reveles una carta de Peligro con Prueba de NAV, descártala…»
  {
    clave: 'velas_tormenta.esquivar',
    carta: 'velas_tormenta',
    ventana: 'respuesta',
    desde: 'juego',
    coste: [{ tipo: 'agotarse' }],
    disparo: (s, _yo, ev, fase) => fase === 'despues' && peligroQueSePuedeQuitar(s, ev) && conPruebaDe(s, ev.carta, 'NAV'),
    efecto: () => [{ tipo: 'quitarEncuentro', modo: 'descartar', avance: false }],
  },

  // ---------------------------------------------------------------------------
  // Mejoras de tripulante

  // Pistola de chispa: «Agotar: +3 COM en esta Prueba.» Fase 15, quinta ronda (Albert): el portador recibe +3 COM hasta
  // el final de esta Prueba, solo si participa en ella (como «for this attack» de Marvel Champions). Solo se ofrece en una
  // Prueba de COM: en otra, no sumaría nada.
  {
    clave: 'pistola.disparar',
    carta: 'pistola',
    ventana: 'libre',
    desde: 'juego',
    coste: [{ tipo: 'agotarse' }],
    requisito: (s, yo) => pruebaDe(s, 'COM') && participa(s, portadorDe(s, yo)),
    efecto: (s, yo) => {
      const portador = portadorDe(s, yo)
      if (!portador) return []
      anotar(s, 'efecto', `${nombre(s, portador)} recibe ${numeroConIcono(texto('pistola'), 'COM')} COM en esta Prueba.`)
      return [{ tipo: 'anadirTemporal', temporal: { clave: 'pistola.com', fuente: 'pistola', hasta: 'finPrueba', inst: portador } }]
    },
  },
  {
    clave: 'pistola.com',
    carta: 'pistola',
    ventana: 'constante',
    desde: 'temporal',
    modifica: (_ctx, yo, c) => (c.tipo === 'habilidad' && c.hab === 'COM' && c.carta === yo ? numeroConIcono(texto('pistola'), 'COM') : 0),
  },
  // Escapulario del Carmen: «Interrupción: Agotar: Cuando se revele el Destino de una Prueba en la que participe el portador, cancélalo.»
  {
    clave: 'escapulario.cancelar',
    carta: 'escapulario',
    ventana: 'interrupcion',
    desde: 'juego',
    coste: [{ tipo: 'agotarse' }],
    disparo: (s, yo, ev, fase) => fase === 'antes' && destinoVigente(s, ev) && participa(s, portadorDe(s, yo)),
    efecto: () => [{ tipo: 'cambiarDestino', modo: 'cancelar' }],
  },
  // Amuleto vudú: «Interrupción: Descarta Amuleto vudú: Cuando el portador vaya a quedar derrotado, en vez de eso reduce su Vida a 1.»
  // «Reduce su Vida a 1» = le queda 1 Vida restante (heridas = Vida − 1), confirmado por Albert.
  {
    clave: 'amuleto.salvar',
    carta: 'amuleto',
    ventana: 'interrupcion',
    desde: 'juego',
    coste: [{ tipo: 'descartarse' }],
    disparo: (s, yo, ev, fase) => fase === 'antes' && ev.tipo === 'derrota' && ev.carta === portadorDe(s, yo),
    efecto: (s, _yo, suceso) => {
      if (suceso?.ev.tipo === 'derrota') {
        suceso.cancelado = true
        salvarDeLaDerrota(s, suceso.ev.carta, numeroConIcono(texto('amuleto'), 'vida'))
      }
      return []
    },
  },
  // Ron de la reserva: «Acción: Descarta Ron de la reserva: Prepara al portador y cúrale 1 herida.»
  {
    clave: 'ron_reserva.beber',
    carta: 'ron_reserva',
    ventana: 'accion',
    desde: 'juego',
    coste: [{ tipo: 'descartarse' }],
    requisito: (s, yo) => {
      const p = portadorDe(s, yo)
      return p !== null && (copia(s, p).agotada || copia(s, p).heridas > 0)
    },
    efecto: (s, yo) => {
      const p = portadorDe(s, yo)
      if (!p) return []
      return [
        { tipo: 'prepararUno', entre: [p] },
        { tipo: 'curar', n: numeroConIcono(texto('ron_reserva'), 'herida'), modo: 'uno', objetivo: p },
      ]
    },
  },
  // Patente de corso: «Solo puede llevarla el Capitán. Los encuentros Militar y Guardia reciben −1 de dificultad.»
  {
    clave: 'patente.dificultad',
    carta: 'patente',
    ventana: 'constante',
    desde: 'juego',
    modifica: (_ctx, _yo, c) =>
      c.tipo === 'dificultad' && c.claves.some((k) => k === 'Armada' || k === 'Militar' || k === 'Guardia') ? (numerosEntreLlaves(texto('patente'))[0] ?? 0) : 0,
  },

  // ---------------------------------------------------------------------------
  // Tesoros

  // Espada del sacerdote: «Interrupción: Cuando se revele el Destino de una Prueba de COM en la que participe
  // el portador, cancélalo. (Límite de una vez por misión.)»
  {
    clave: 'espada.cancelar',
    carta: 'espada',
    ventana: 'interrupcion',
    desde: 'juego',
    limite: { veces: 1, por: 'mision' },
    disparo: (s, yo, ev, fase) => fase === 'antes' && destinoVigente(s, ev) && s.prueba?.hab === 'COM' && participa(s, portadorDe(s, yo)),
    efecto: () => [{ tipo: 'cambiarDestino', modo: 'cancelar' }],
  },
  // Mascarón del galeón: «Interrupción: Cuando el Barco vaya a recibir daño, evítalo. (Límite de una vez por misión.)»
  {
    clave: 'mascaron.evitar',
    carta: 'mascaron',
    ventana: 'interrupcion',
    desde: 'juego',
    limite: { veces: 1, por: 'mision' },
    disparo: (_s, _yo, ev, fase) => fase === 'antes' && ev.tipo === 'danoBarco' && ev.cantidad > 0,
    efecto: (s, _yo, suceso) => {
      if (suceso?.ev.tipo === 'danoBarco') {
        suceso.cancelado = true
        anotar(s, 'efecto', 'El Mascarón del galeón evita el daño.')
      }
      return []
    },
  },
  // Los despachos del Rey: «Al zarpar: Otea 2 del mazo de Peligros.» (P4, fase 10b). Se aplica sola.
  {
    clave: 'despachos.otear',
    carta: 'despachos',
    ventana: 'alZarpar',
    desde: 'juego',
    requisito: (s) => s.zonas[mazoActivo(s).mazo].length + s.zonas[mazoActivo(s).descartes].length > 0,
    efecto: () => [{ tipo: 'otear', n: primerNumero(texto('despachos')), cartas: [], arriba: [], fondo: [] }],
  },
  // Pólvora del Rey (Tesoro, fase 10b): «Al entrar en juego, pon 3 fichas sobre esta carta. Respuesta: Después de agotar
  // un Cañón en una Prueba de COM, quita 1 ficha de esta carta: esa Prueba recibe +2 más. Si no quedan fichas, descarta
  // esta carta.» Las 3 fichas las pone ponerTesoro. El +2 es fuego de Cañón: «Los Cañones no suman» también lo anula, y
  // en un Abordaje no se usa (fase 14, Albert).
  {
    clave: 'polvora_rey.disparo',
    carta: 'polvora_rey',
    ventana: 'respuesta',
    desde: 'juego',
    disparo: (s, yo, ev, fase) =>
      fase === 'despues' && ev.tipo === 'canonAgotado' && yo !== null && (copia(s, yo).fichas ?? 0) > 0 && pruebaDe(s, 'COM') && !esAbordaje(s),
    efecto: (s, yo) => {
      if (!yo) return []
      const c = copia(s, yo)
      c.fichas = Math.max(0, (c.fichas ?? 0) - 1)
      anotar(s, 'efecto', `Quitas 1 ficha de la Pólvora del Rey (le ${c.fichas === 1 ? 'queda' : 'quedan'} ${c.fichas}).`)
      const tareas = bono(s, numerosEntreLlaves(texto('polvora_rey'))[0] ?? 0, true, 'polvora_rey')
      if (c.fichas === 0) {
        // Un Tesoro no va a ningún mazo de descartes: vuelve al mazo de historia (sale de la partida).
        mover(s, yo, 'mazoHistoria', 'abajo')
        anotar(s, 'efecto', 'La Pólvora del Rey se queda sin fichas: se descarta.')
      }
      return tareas
    },
  },
  // Farol de los ahogados: «Respuesta: Después de que se revele un Destino, descártalo y revela otro. (Límite de una vez por misión.)»
  {
    clave: 'farol.destino',
    carta: 'farol',
    ventana: 'respuesta',
    desde: 'juego',
    limite: { veces: 1, por: 'mision' },
    disparo: (s, _yo, ev, fase) => fase === 'despues' && destinoVigente(s, ev),
    efecto: () => [{ tipo: 'cambiarDestino', modo: 'otro' }],
  },
]

/** Opción de COM de la Prueba aún sin comprometer cuya dificultad actual es 4 o menos (Carronadas). */
function opcionDeCarronadas(s: Estado): number | null {
  const p = s.prueba
  if (!p || p.automatica || p.hab !== null || !s.zonas.encuentro.includes(p.encuentro)) return null
  const limite = numeroTras(texto('carronadas'), 'dificultad')
  const opciones = definicionDe(s, p.encuentro).opciones
  for (let i = 0; i < opciones.length; i++) {
    const o = opciones[i]
    if (o?.hab !== 'COM') continue
    const dificultad = valor(s, { tipo: 'dificultad', base: dificultadDeOpcion(s, p.encuentro, i), hab: 'COM', claves: clavesDelEncuentro(s, p.encuentro) })
    if (dificultad <= limite) return i
  }
  return null
}
