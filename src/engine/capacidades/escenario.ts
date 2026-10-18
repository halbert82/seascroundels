// Escenario 2.0 (fase 8): las 14 cartas se aplican al revelarse, al empezar el turno. Las que dicen «Este turno…»
// dejan un efecto temporal con su propia regla, que dura hasta el final del turno. Los «Elige» se preguntan al revelar
// la carta; solo se ofrecen las opciones que puedes cumplir enteras (como P11).

import { anotar, copia, nombre } from '../estado.ts'
import type { Efecto, OpcionEfectos } from '../efectos.ts'
import { cumple, registrarCodigo } from '../tareas/efectos.ts'
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

// Lo que no es un efecto de los Peligros: buscar una Mejora de barco y la deserción.
registrarCodigo('ribera.buscar', () => [{ tipo: 'buscarMuelle', filtro: 'mejoraBarco' }])
registrarCodigo('desercion.desertar', () => [{ tipo: 'desercion' }])

export const CAPACIDADES_ESCENARIO: Capacidad[] = [
  // ---------------------------------------------------------------------------------------------------------------
  // Buenas

  // Vientos alisios y Temporada de huracanes: ver sus efectos temporales, abajo.
  alRevelar('alisios', () => [esteTurno('alisios.turno', 'alisios')]),

  // Marineros sin barco: busca un Tripulante y ponlo en el muelle. Este turno, reclutarlo cuesta 1 menos.
  alRevelar('reclutas', () => [{ tipo: 'buscarMuelle', filtro: 'tripulante', marca: { clave: 'reclutas.turno', fuente: 'reclutas' } }]),

  // Carpinteros de ribera: Elige: repara 2 daños, o busca una Mejora de barco y ponla en el muelle.
  alRevelar('ribera', (_s, inst) => [
    elige(
      [
        { texto: `Reparar ${numeroConIcono(textoDe('ribera'), 'dano')} daños del Barco`, efectos: [{ tipo: 'reparar', n: numeroConIcono(textoDe('ribera'), 'dano') }] },
        { texto: 'Buscar una Mejora de barco y ponerla en el muelle', efectos: [{ tipo: 'codigo', clave: 'ribera.buscar' }] },
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
      efectos([{ tipo: 'aQuien', quien: { de: 'tripulacion', por: 'menosVida' }, hacer: { tipo: 'estado', estado: 'aturdido' } }], inst),
    ]
  }),

  // ---------------------------------------------------------------------------------------------------------------
  // Malas

  alRevelar('huracanes', () => [esteTurno('huracanes.turno', 'huracanes')]),

  // Impuestos del gobernador: Elige: descarta 2 cartas, o pierde una Mejora a tu elección. Con la Patente no pagas.
  alRevelar('impuestos', (s, inst) => {
    if (cumple(s, { tipo: 'cartaEnJuego', id: 'patente' })) {
      anotar(s, 'efecto', 'Impuestos del gobernador: con la Patente de corso no pagas.')
      return []
    }
    const cartas = numeroTras(textoDe('impuestos'), 'descarta')
    // TODO(regla) P59a: si no puedes cumplir ninguna de las dos opciones entera (menos de 2 cartas y ninguna Mejora que se
    // pueda perder), no pasa nada (P11: una opción de pago que no puedes pagar entera no se ofrece).
    return [
      elige(
        [
          { texto: `Descartar ${cartas} cartas`, efectos: [{ tipo: 'descartar', n: cartas }] },
          { texto: 'Perder una Mejora a tu elección', efectos: [{ tipo: 'perderMejora', n: 1 }] },
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
    // TODO(regla) P59b: si solo tienes al Capitán, nadie puede desertar y esa opción no se ofrece: pagas la soldada (1 carta)
    // si puedes; si no puedes pagarla, no pasa nada.
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

  // La Armada patrulla: Elige: descarta 3 cartas, o baraja «La Armada te persigue» en el mazo de Peligros.
  alRevelar('armada_patrulla', (s, inst) => {
    const cartas = numeroTras(textoDe('armada_patrulla'), 'descarta')
    const opciones: OpcionEfectos[] = [{ texto: `Descartar ${cartas} cartas (sobornas a un oficial del almirantazgo)`, efectos: [{ tipo: 'descartar', n: cartas }] }]
    // TODO(regla) P59c: si La Armada ya está en el mazo de Peligros, no se puede barajar otra vez y esa opción no se ofrece:
    // descartas 3 si puedes; si no puedes, no pasa nada.
    if (s.zonas.apartados.some((c) => copia(s, c).id === 'armada')) {
      opciones.push({ texto: 'Barajar «La Armada te persigue» en el mazo de Peligros', efectos: [{ tipo: 'entraEnMazo', carta: 'armada' }] })
    } else {
      anotar(s, 'efecto', `«${nombre(s, inst)}»: La Armada ya está en el mazo de Peligros.`)
    }
    return [elige(opciones, inst)]
  }),

  // Escasez de pertrechos: pierdes 1 munición. Al final de este turno, roba hasta tener 2 cartas menos que tu Mando.
  // TODO(regla) P58: la carta se aplica en el paso 1 del Inicio y la Recarga (paso 3) vuelve a llenar los Cañones, así que la
  // munición perdida solo se nota con Pólvora mojada. Lectura literal, pendiente de Albert.
  alRevelar('escasez', (_s, inst) => [
    efectos([{ tipo: 'perderMunicion', n: numeroConIcono(textoDe('escasez'), 'municion') }], inst),
    esteTurno('escasez.turno', 'escasez'),
  ]),

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
    clave: 'escasez.turno',
    carta: 'escasez',
    ventana: 'constante',
    desde: 'temporal',
    modifica: (_ctx, _yo, c) => (c.tipo === 'objetivoRobo' ? -numeroTras(textoDe('escasez'), 'tener') : 0),
  },
  {
    // Las misiones de Mar necesitan 1 de Avance más y los encuentros Tormenta reciben +1.
    // TODO(regla) P57: «sus Distancias son 1 mayores»: «sus» son las de las misiones de Mar, que no tienen Distancia, así que
    // en la lectura literal ninguna Distancia cambia. Antes la carta subía todas las Distancias (D7). Pendiente de Albert.
    clave: 'huracanes.turno',
    carta: 'huracanes',
    ventana: 'constante',
    desde: 'temporal',
    modifica: (ctx, _yo, c) => {
      if (c.tipo === 'avanceNecesario' && entornoDeMision(ctx.s, c.mision) === 'mar') return 1
      if (c.tipo === 'dificultad' && c.claves.includes('Tormenta')) return 1
      return 0
    },
  },
  {
    // Las misiones de Mar necesitan 1 de Avance menos.
    // TODO(regla) P57: «sus Distancias son 1 menores»: como en Temporada de huracanes, en la lectura literal no cambia ninguna.
    clave: 'alisios.turno',
    carta: 'alisios',
    ventana: 'constante',
    desde: 'temporal',
    modifica: (ctx, _yo, c) => (c.tipo === 'avanceNecesario' && entornoDeMision(ctx.s, c.mision) === 'mar' ? -1 : 0),
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
