// Escenario 2.0 (fase 8): las 14 cartas se aplican al revelarse, al empezar el turno. Las que dicen «Este turno…»
// dejan un efecto temporal con su propia regla, que dura hasta el final del turno. Los «Elige» se preguntan al revelar
// la carta; solo se ofrecen las opciones que puedes cumplir enteras (como P11) y, si no puedes cumplir ninguna, no
// pasa nada (P59).

import { anotar, copia, nombre } from '../estado.ts'
import { mover } from '../zonas.ts'
import type { Efecto, OpcionEfectos } from '../efectos.ts'
import { cumple, registrarCodigo } from '../tareas/efectos.ts'
import { registrarEspecial } from '../tareas/peligros2.ts'
import { mirarYPonerEnMuelle } from '../tareas/cartas.ts'
import { tipoDe } from '../catalogo.ts'
import { numeroConIcono, numeroTras, primerNumero, textoDe } from '../textos.ts'
import type { Capacidad, CartaId, Estado, InstId, NuevaTarea } from '../tipos.ts'
import { entornoDeMision } from './comun.ts'

function alRevelar(carta: CartaId, efecto: (s: Estado, inst: InstId) => NuevaTarea[]): Capacidad {
  return { clave: carta, carta, ventana: 'alRevelar', desde: 'escenario', efecto: (s, yo) => (yo ? efecto(s, yo) : []) }
}

function esteTurno(clave: string, fuente: CartaId): NuevaTarea {
  return { tipo: 'anadirTemporal', temporal: { clave, fuente, hasta: 'finTurno' } }
}

function efectos(lista: Efecto[], inst: InstId): NuevaTarea {
  return { tipo: 'aplicarEfectos', efectos: lista, contexto: 'efecto', fuente: inst }
}

/** «Elige»: el jugador decide al revelar la carta, entre las opciones que puede cumplir. */
function elige(opciones: OpcionEfectos[], inst: InstId): NuevaTarea {
  return { tipo: 'elegirEfectos', opciones, fuente: inst }
}

const n = (carta: CartaId) => primerNumero(textoDe(carta))

// Lo que no es un efecto de los Peligros: el descuento de los Carpinteros de ribera, la deserción y La Armada encima del
// mazo.
registrarCodigo('ribera.descuento', () => [esteTurno('ribera.turno', 'ribera')])
registrarCodigo('desercion.desertar', () => [{ tipo: 'desercion' }])

// Marineros sin barco (revisión de Albert, fuera Buscar): «Mira las 3 cartas superiores del mazo de muelle: pon un
// Tripulante de entre ellas en el muelle en lugar de la carta de más a la izquierda (que se descarta) y las demás al fondo.
// Este turno, reclutarlo cuesta 1 menos.» Como «Lenguas sueltas»; si no sale ningún Tripulante, no hay descuento.
registrarEspecial('reclutas.mirar', (s, _t, e) =>
  mirarYPonerEnMuelle(s, e, { motivo: 'marinerosSinBarco', soloTripulantes: true, marca: { clave: 'reclutas.turno', fuente: 'reclutas' } }),
)

/** «La Armada te persigue», si está apartada, en el mazo de Peligros o en sus descartes (de ahí se puede sacar). */
function armadaQueSePuedeSacar(s: Estado): InstId | undefined {
  return [...s.zonas.mazoHistoria, ...s.zonas.apartados, ...s.zonas.mazoPeligros, ...s.zonas.descartesPeligros].find((c) => copia(s, c).id === 'armada')
}

// La Armada patrulla: «pon La Armada te persigue encima del mazo de Peligros: será el primer encuentro de tu próxima
// misión, y después se queda en el mazo». Si ya estaba en el mazo o en los descartes, se saca de ahí (Albert, fase 8).
// Se marca como la carta que persigue: así es el primer encuentro aunque la misión mezcle su mazo propio o alguien
// baraje el mazo antes, y no sale como Destino. Después de resolverla se descarta como cualquier otra.
registrarCodigo('patrulla.encima', (s) => {
  const armada = armadaQueSePuedeSacar(s)
  if (!armada) return []
  mover(s, armada, 'mazoPeligros', 'arriba')
  s.persigue = armada
  anotar(s, 'aviso', '«La Armada te persigue» va encima del mazo de Peligros: será el primer encuentro de tu próxima misión.', {
    tipo: 'entraEnMazo',
    carta: 'armada',
  })
  return []
})

export const CAPACIDADES_ESCENARIO: Capacidad[] = [
  // ---------------------------------------------------------------------------------------------------------------
  // Buenas

  // Vientos alisios y Temporada de huracanes: ver sus efectos temporales, abajo.
  alRevelar('alisios', () => [esteTurno('alisios.turno', 'alisios')]),

  // Marineros sin barco: mira las 3 de arriba del mazo de muelle y pon un Tripulante en el muelle (ver arriba).
  alRevelar('reclutas', () => [{ tipo: 'especial', clave: 'reclutas.mirar', datos: {}, paso: 0 }]),

  // Carpinteros de ribera (revisión de Albert, fuera Buscar; P123): «Elige: repara 2 daños, o la primera Mejora de barco
  // que adquieras este turno cuesta 1 menos.» (Antes, buscar una Mejora de barco y ponerla en el muelle.)
  alRevelar('ribera', (_s, inst) => [
    elige(
      [
        { texto: `Reparar ${numeroConIcono(textoDe('ribera'), 'dano')} daños del Barco`, efectos: [{ tipo: 'reparar', n: numeroConIcono(textoDe('ribera'), 'dano') }] },
        { texto: 'La primera Mejora de barco que adquieras este turno cuesta 1 menos', efectos: [{ tipo: 'codigo', clave: 'ribera.descuento' }] },
      ],
      inst,
    ),
  ]),

  // Feria en la isla: roba 1 carta y cura 1 herida a cada Tripulante.
  alRevelar('feria', (_s, inst) => [
    { tipo: 'robar', n: n('feria') },
    efectos([{ tipo: 'curar', n: numeroConIcono(textoDe('feria'), 'herida'), modo: 'cadaUno' }], inst),
  ]),

  // Rumores del tesoro: lo aplica el inicio de la misión (avanceInicialDelEscenario, en las tareas de la misión).
  alRevelar('rumores', () => [esteTurno('rumores.turno', 'rumores')]),

  // Mercado próspero: revela 2 cartas más del muelle. Al reponerlo, las que sobren se descartan (el muelle entero se
  // descarta y se repone al terminar Jugar cartas, así que ya pasa).
  alRevelar('mercado', () => [{ tipo: 'revelarMuelle', n: n('mercado') }]),

  // ---------------------------------------------------------------------------------------------------------------
  // Mixtas

  // Fiesta de San Juan: prepara a todos; todos quedan Borrachos; si zarpas este turno, empiezas con 1 de Avance.
  alRevelar('sanjuan', (_s, inst) => [
    { tipo: 'prepararTripulantes' },
    efectos([{ tipo: 'estado', estado: 'borracho', a: 'todos' }], inst),
    esteTurno('sanjuan.turno', 'sanjuan'),
  ]),

  // Cuarentena: la Taberna no se puede elegir este turno; el Tripulante con menos Vida (impresa, P20) queda Aturdido.
  alRevelar('cuarentena', (s, inst) => {
    anotar(s, 'aviso', 'Cuarentena: el puerto cierra la Taberna este turno.')
    return [
      esteTurno('cuarentena.turno', 'cuarentena'),
      efectos([{ tipo: 'aQuien', quien: { de: 'tripulacion', por: 'menosVida' }, hacer: { tipo: 'estado', estado: 'envenenado' } }], inst),
    ]
  }),

  // ---------------------------------------------------------------------------------------------------------------
  // Malas

  alRevelar('huracanes', () => [esteTurno('huracanes.turno', 'huracanes')]),

  // Impuestos del gobernador: Elige: descarta 2 cartas, o pierde tu Mejora de mayor coste (empate: eliges). Con la
  // Patente de corso no pagas. El coste es el impreso; los Tesoros y las indestructibles no se pierden.
  alRevelar('impuestos', (s, inst) => {
    if (cumple(s, { tipo: 'cartaEnJuego', id: 'patente' })) {
      anotar(s, 'efecto', 'Impuestos del gobernador: con la Patente de corso no pagas.')
      return []
    }
    const cartas = numeroTras(textoDe('impuestos'), 'descarta')
    // P59a (confirmada): si no puedes cumplir ninguna de las dos opciones entera (menos de 2 cartas y ninguna Mejora que
    // se pueda perder), no pasa nada (P11: una opción de pago que no puedes pagar entera no se ofrece).
    return [
      elige(
        [
          { texto: `Descartar ${cartas} cartas`, efectos: [{ tipo: 'descartar', n: cartas }] },
          { texto: 'Perder tu Mejora de mayor coste', efectos: [{ tipo: 'perderMejora', n: 1, mayorCoste: true }] },
        ],
        inst,
      ),
    ]
  }),

  // Deserción: Elige: paga la soldada (1 carta por cada Tripulante, máximo 3), o tu Tripulante de menor coste deserta
  // y vuelve al muelle (con sus Mejoras descartadas). Tu Capitán nunca deserta.
  alRevelar('desercion', (s, inst) => {
    // «Por cada Tripulante» cuenta al Capitán, como en «El reparto».
    const soldada = Math.min(numeroTras(textoDe('desercion'), 'máximo'), s.zonas.tripulacion.length)
    const opciones: OpcionEfectos[] = [{ texto: `Pagar la soldada: descartar ${soldada} ${soldada === 1 ? 'carta' : 'cartas'}`, efectos: [{ tipo: 'descartar', n: soldada }] }]
    // P59b (confirmada): si solo tienes al Capitán, nadie puede desertar y esa opción no se ofrece: pagas la soldada
    // (1 carta) si puedes; si no puedes pagarla, no pasa nada.
    if (s.zonas.tripulacion.some((c) => c !== s.capitan)) {
      opciones.push({ texto: 'Tu Tripulante de menor coste deserta y vuelve al muelle (sus Mejoras se descartan)', efectos: [{ tipo: 'codigo', clave: 'desercion.desertar' }] })
    }
    return [elige(opciones, inst)]
  }),

  // Bando del virrey: tu Tripulante con más COM (impresa; si empatan, eliges) queda Buscado. Este turno, los encuentros
  // Guardia y Militar reciben +1.
  alRevelar('bando', (_s, inst) => [
    efectos([{ tipo: 'aQuien', quien: { de: 'tripulacion', por: { mas: 'COM' } }, hacer: { tipo: 'estado', estado: 'buscado' } }], inst),
    esteTurno('bando.turno', 'bando'),
  ]),

  // La Armada patrulla: Elige: descarta 1 carta (P60), o pon «La Armada te persigue» encima del mazo de Peligros (será el
  // primer encuentro de tu próxima misión y después se queda en el mazo). Si ya está en el mazo o en los descartes, se
  // saca y se pone encima, así que la segunda opción casi siempre se puede elegir.
  alRevelar('armada_patrulla', (s, inst) => {
    const cartas = numeroTras(textoDe('armada_patrulla'), 'descarta')
    const opciones: OpcionEfectos[] = [{ texto: `Descartar ${cartas} ${cartas === 1 ? 'carta' : 'cartas'}`, efectos: [{ tipo: 'descartar', n: cartas }] }]
    // P59c (confirmada, ya casi sin uso): si La Armada no se puede sacar de ningún sitio (salió del juego), esa opción no
    // se ofrece; descartas la carta si puedes y, si no, no pasa nada.
    if (armadaQueSePuedeSacar(s)) {
      opciones.push({ texto: 'Poner «La Armada te persigue» encima del mazo de Peligros', efectos: [{ tipo: 'codigo', clave: 'patrulla.encima' }] })
    } else {
      anotar(s, 'efecto', `«${nombre(s, inst)}»: «La Armada te persigue» ya no está en la partida.`)
    }
    return [elige(opciones, inst)]
  }),

  // Escasez de pertrechos: este turno no recargas munición (se salta la Recarga del Inicio, P58). Al final de este
  // turno, roba hasta tener 2 cartas menos que tu Mando.
  alRevelar('escasez', () => [esteTurno('escasez.turno', 'escasez')]),

  // ---------------------------------------------------------------------------------------------------------------
  // Efectos temporales («Este turno…»)
  {
    // Este turno, los encuentros Militar y Guardia reciben +1 de dificultad.
    clave: 'bando.turno',
    carta: 'bando',
    ventana: 'constante',
    desde: 'temporal',
    modifica: (_ctx, _yo, c) =>
      c.tipo === 'dificultad' && c.claves.some((k) => k === 'Militar' || k === 'Guardia') ? numeroConIcono(textoDe('bando'), 'r') : 0,
  },
  // Si zarpas este turno, empiezas la misión con Avance (lo aplica el inicio de la misión).
  { clave: 'rumores.turno', carta: 'rumores', ventana: 'constante', desde: 'temporal' },
  { clave: 'sanjuan.turno', carta: 'sanjuan', ventana: 'constante', desde: 'temporal' },
  // La Taberna no se ofrece este turno (lo mira el puerto).
  { clave: 'cuarentena.turno', carta: 'cuarentena', ventana: 'constante', desde: 'temporal' },
  {
    // Marineros sin barco: reclutar la carta encontrada cuesta 1 menos este turno.
    clave: 'reclutas.turno',
    carta: 'reclutas',
    ventana: 'constante',
    desde: 'temporal',
    modifica: (_ctx, yo, c) => (c.tipo === 'coste' && yo !== null && c.carta === yo ? -1 : 0),
  },
  {
    // Carpinteros de ribera: la primera Mejora de barco que adquieras este turno cuesta 1 menos (P123: al adquirirla, la
    // tarea de adquirir quita este efecto; el coste impreso no cambia).
    clave: 'ribera.turno',
    carta: 'ribera',
    ventana: 'constante',
    desde: 'temporal',
    modifica: (ctx, _yo, c) => (c.tipo === 'coste' && tipoDe(copia(ctx.s, c.carta).id) === 'mejoraBarco' && ctx.s.zonas.muelle.includes(c.carta) ? -1 : 0),
  },
  {
    clave: 'escasez.turno',
    carta: 'escasez',
    ventana: 'constante',
    desde: 'temporal',
    modifica: (_ctx, _yo, c) => (c.tipo === 'objetivoRobo' ? -numeroTras(textoDe('escasez'), 'tener') : 0),
  },
  {
    // Las misiones de Mar necesitan 1 de Avance más, las Distancias de todas las misiones son 1 mayores y los
    // encuentros Tormenta reciben +1. P57: «todas las misiones» son las de cualquier Entorno; una misión sin Distancia
    // (de Mar o en tu isla) sigue en 0 (D7, lo mira el cálculo de la Distancia).
    clave: 'huracanes.turno',
    carta: 'huracanes',
    ventana: 'constante',
    desde: 'temporal',
    modifica: (ctx, _yo, c) => {
      if (c.tipo === 'avanceNecesario' && entornoDeMision(ctx.s, c.mision) === 'mar') return 1
      if (c.tipo === 'distancia') return 1
      if (c.tipo === 'dificultad' && c.claves.includes('Tormenta')) return 1
      return 0
    },
  },
  {
    // Las misiones de Mar necesitan 1 de Avance menos y las Distancias de todas las misiones son 1 menores (P57).
    clave: 'alisios.turno',
    carta: 'alisios',
    ventana: 'constante',
    desde: 'temporal',
    modifica: (ctx, _yo, c) => {
      if (c.tipo === 'avanceNecesario' && entornoDeMision(ctx.s, c.mision) === 'mar') return -1
      if (c.tipo === 'distancia') return -1
      return 0
    },
  },
  {
    // «−1 Mando» (Chubasco repentino, Huracán): este turno robas hasta una carta menos.
    clave: 'menosMando',
    carta: 'regla',
    ventana: 'constante',
    desde: 'temporal',
    modifica: (_ctx, _yo, c) => (c.tipo === 'mando' ? -1 : 0),
  },
]
