// Glosario de la mesa: qué hace cada Estado, Ventaja, ficha de misión y palabra de regla de las cartas, y cómo se quita
// o cuándo termina. Lo usan las fichas de la mesa (al pasar el ratón o al pulsarlas), la ampliación de las cartas y la
// Referencia rápida.
//
// Los textos salen del reglamento (docs/reglamento-v1.0.md: la Referencia de reglas de la A a la Z y la tabla
// «Estados y Ventajas» de la Referencia rápida), resumidos sin cambiar el sentido. Los de las fichas de misión salen
// de las reglas impresas de cada capítulo (data/cartas.json). Sin React: solo datos y texto.

import { porId, type EntradaCatalogo } from '../../engine/catalogo.ts'
import { ESTADOS_BARCO, FICHAS_TRIPULANTE, INFO_ESTADO, type EstadoBarco, type FichaTripulante } from '../../engine/infoEstados.ts'
import type { FichaMision, Temporal } from '../../engine/tipos.ts'

/** Qué es lo explicado: decide el color de la ficha y el rótulo de arriba. */
export type ClaseAyuda = 'estado' | 'estadoBarco' | 'ventaja' | 'fichaMision' | 'limitacion' | 'regla'

export const NOMBRE_CLASE: Record<ClaseAyuda, string> = {
  estado: 'Estado',
  estadoBarco: 'Estado del Barco',
  ventaja: 'Ventaja',
  fichaMision: 'Contador',
  limitacion: 'Efecto que dura',
  regla: 'Regla',
}

/** Un apartado de la explicación: «Qué hace», «Cómo se quita»… */
export interface ParteAyuda {
  rotulo: string
  texto: string
}

export interface Ayuda {
  /** Identificador estable (para React y las pruebas): «estado:buscado», «regla:abordaje», «mision:alarma»… */
  clave: string
  nombre: string
  clase: ClaseAyuda
  partes: ParteAyuda[]
}

const VENTAJA_SE_QUEDA = 'La Taberna no quita las Ventajas.'

/**
 * Cómo se quita, con la misma redacción que el reglamento (entrada «Estado»): lo que lo quita solo (`propia`, si hay
 * algo) y, además, «se quita con la Taberna (o el Astillero) o con cualquier carta que así lo indique», con un ejemplo.
 */
function estado(e: FichaTripulante | EstadoBarco, hace: string, propia: string, ejemplo = ''): Ayuda {
  const barco = (ESTADOS_BARCO as readonly string[]).includes(e)
  const ventaja = INFO_ESTADO[e].ventaja === true
  const clase: ClaseAyuda = ventaja ? 'ventaja' : barco ? 'estadoBarco' : 'estado'
  const generica = `${propia ? 'También se quita' : 'Se quita'} con ${barco ? 'el Astillero' : 'la Taberna'} o con cualquier carta que así lo indique${ejemplo ? ` (por ejemplo, ${ejemplo})` : ''}.`
  return {
    clave: `estado:${e}`,
    nombre: INFO_ESTADO[e].nombre,
    clase,
    partes: [
      { rotulo: 'Qué hace', texto: hace },
      { rotulo: ventaja ? 'Cuándo se gasta' : 'Cómo se quita', texto: ventaja ? `${propia} ${VENTAJA_SE_QUEDA}` : propia ? `${propia} ${generica}` : generica },
    ],
  }
}

// ---------------------------------------------------------------------------
// Estados y Ventajas (reglamento: «Estado», «Ventaja» y la tabla de la Referencia rápida)

export const AYUDA_ESTADO: Record<FichaTripulante | EstadoBarco, Ayuda> = {
  // Fase 16 (Albert): los Estados y las Ventajas son cartas mini; cada una dice cómo se quita («Acción: Agota a un
  // Cirujano: descarta esta carta»), además de la Taberna (los de los Tripulantes) y el Astillero (los del Barco).
  envenenado: estado('envenenado', 'Al final del turno, le infliges 1 herida.', 'Se quita agotando a un Cirujano (Acción).', 'la Herbolaria o «Cataplasma»'),
  borracho: estado('borracho', 'Recibe +1 COM, pero no puede ser asignado a Pruebas de NAV ni de EXP.', 'Se quita al final del turno.'),
  asustado: estado('asustado', 'No puede ser asignado él solo a una Prueba (tampoco a una Prueba Sin ayuda).', 'Se quita al final del turno, o agotando a un Oficial (Acción).'),
  sangrando: estado('sangrando', 'Cada vez que se agota, le infliges 1 herida.', 'Se quita agotando a otro Tripulante preparado (Acción).', '«Cataplasma»'),
  buscado: estado('buscado', 'No puede ser asignado en las misiones de Ciudad.', 'Se quita descartando 1 carta en la Fase de Reclutamiento.'),
  maldito: estado('maldito', '−1 al total de cada Prueba en la que participe.', 'Se quita al superar una Prueba en la que participe.', '«La mambo del mercado»'),
  extenuado: estado('extenuado', 'En la Fase de Inicio no se prepara.', 'Se quita entonces, en lugar de prepararse.'),
  inspirado: estado('inspirado', '+1 al total de cada Prueba en la que participe.', 'Se quita al final del turno.'),
  aguerrido: estado('aguerrido', 'Puede ser asignado a una Prueba sin agotarse.', 'Se quita al hacerlo; no caduca al final del turno.'),
  viaDeAgua: estado(
    'viaDeAgua',
    'En una misión de Mar, después de cada carta de Peligro: «Daña 1», salvo que agotes a un Tripulante preparado.',
    'Se quita agotando a un Carpintero (Acción).',
  ),
  velasRotas: estado('velasRotas', 'Las Distancias aumentan en 1, y en el Mar tus Pruebas de NAV reciben −1.', 'Se quita agotando a un Carpintero (Acción).'),
  perseguido: estado('perseguido', 'Los encuentros de tipo Armada reciben +1 de dificultad.', 'Se quita al superar un encuentro de tipo Armada.'),
  // El Desánimo va junto al Barco, pero no es un Estado del Barco ni de un Tripulante.
  desanimo: {
    clave: 'estado:desanimo',
    nombre: INFO_ESTADO.desanimo.nombre,
    clase: 'estado',
    partes: [
      { rotulo: 'Qué hace', texto: 'Al final del turno, cuando vayas a robar, robas 1 carta menos.' },
      { rotulo: 'Cómo se quita', texto: 'Se descarta sola entonces. No la quitan la Taberna ni el Astillero.' },
    ],
  },
}

// ---------------------------------------------------------------------------
// Contadores de misión (reglas impresas de cada capítulo y la entrada «Contadores» del reglamento; antes de la fase 16, fichas
// de misión). Se llevan con fichas genéricas sobre la carta: «pon 1 ficha de Alarma» es poner 1 ficha genérica.

const FIN_FICHAS = 'Las fichas de los contadores de la misión se descartan al terminarla, la superes o no.'
const MISION_FALLA = '«La misión falla» es como retirarte: no la superas, pierdes su Avance y eliges si la dejas disponible o la pones al fondo del mazo de Misiones.'

function fichaMision(f: FichaMision, nombre: string, cambia: string, pasa: string, mas = ''): Ayuda {
  return {
    clave: `mision:${f}`,
    nombre,
    clase: 'fichaMision',
    partes: [
      { rotulo: 'Cómo se ponen y se quitan (fichas genéricas)', texto: cambia },
      { rotulo: 'Qué pasa', texto: pasa },
      { rotulo: 'Cuándo terminan', texto: mas ? `${mas} ${FIN_FICHAS}` : FIN_FICHAS },
    ],
  }
}

export const AYUDA_FICHA_MISION: Record<FichaMision, Ayuda> = {
  alarma: fichaMision(
    'alarma',
    'Alarma',
    'Cada Prueba de COM que superes y cada vez que un Tripulante quede Buscado: 1 ficha de Alarma.',
    'Con 2, la misión necesita 1 de Avance más. Con 3, pon en juego la carta 220 del mazo de historia, la permanente «¡La guardia!»: mientras esté, todas las Pruebas reciben +1.',
  ),
  ladron: fichaMision(
    'ladron',
    'Ladrón',
    'Al zarpar pones 2. Cada Peligro sin Prueba y cada Prueba que falles: +1. Cada Prueba de NAV o de EXP que superes por 2 o más: −1.',
    'Con 5, el ladrón se escapa: la misión falla. Con 0, lo atrapas: superas la misión ahora, aunque no tengas todo el Avance.',
    MISION_FALLA,
  ),
  persecucion: fichaMision(
    'persecucion',
    'Persecución',
    'Al zarpar pones 1. Cada Prueba de NAV que falles y cada Peligro sin Prueba: +1. Cada Prueba de NAV que superes por 2 o más: −1.',
    'Con 3 os dan alcance: pon «La Armada te persigue» encima del mazo de Peligros y deja la Persecución en 1. Después de resolverla, vuelve a apartarse.',
  ),
  sospecha: fichaMision(
    'sospecha',
    'Sospecha',
    'Cada Prueba de COM que superes y cada Prueba que falles por 2 o más: 1 ficha de Sospecha.',
    'Con 3, el espía te descubre: la misión falla.',
    MISION_FALLA,
  ),
  derrumbe: fichaMision(
    'derrumbe',
    'Derrumbe',
    'Lo dice la misión. En «La escalinata de los sacerdotes», cada Prueba de EXP que falles pone 1 y cada una que superes por 2 o más quita 1. En «…sacudida por un temblor», cada Prueba que falles pone 1.',
    'Con 3, la misión falla.',
    MISION_FALLA,
  ),
  rival: fichaMision(
    'rival',
    'Rival',
    'Después de que reveles una carta de Peligro: 2 fichas de Rival. En «La ruta de los alisios», su Acción (Destina 3 NAV, una vez por misión) quita 2.',
    'Con 8, la misión termina sin superarse, en cuanto se revela el Peligro que pone la octava, sin resolverlo. En «La regata de San Juan», el rival gana la regata y no ganas nada. En «La ruta de los alisios», van Hoorn llega antes y llega el capítulo II-b. En las dos, si no superas la misión (también si te retiras), la carta se aparta.',
  ),
  mecha: fichaMision(
    'mecha',
    'Mecha',
    'La mecha se enciende al zarpar: cada vez que reveles un Peligro, 1 ficha de Mecha.',
    'Con 4, después de resolver ese Peligro, si no has superado la misión, el polvorín estalla: 2 heridas repartidas entre tus Tripulantes y te retiras.',
  ),
  defensa: fichaMision(
    'defensa',
    'Defensa',
    'Al zarpar pones 3. Cada Prueba de COM que superes quita 1.',
    'No puedes superar la misión mientras quede alguna.',
  ),
}

// ---------------------------------------------------------------------------
// Palabras de regla de las cartas (reglamento: Referencia de reglas de la A a la Z)

export const CLAVES_REGLA = [
  'abordaje',
  'permanente',
  'elige',
  'sinAyuda',
  'incautado',
  'persigue',
  'ocuparMuelle',
  'sinOposicion',
  'descartaTripulante',
  'recluta',
  'comprometidoCon',
  'seRetira',
  'entraEnMazo',
  'volverMuelle',
  'pruebaDeAccion',
  'misionFalla',
  'alZarpar',
  'gesta',
  'finalConEleccion',
  'cartaRecompensa',
  'salidaDoble',
  'pasajero',
  'descomunal',
  'alerta',
  'destina',
  'capituloAlAzar',
  'mazoNaufragio',
  'indestructible',
  'enrolado',
  'otear',
  'entrenamiento',
  'tesoro',
  'estados',
] as const
export type ClaveRegla = (typeof CLAVES_REGLA)[number]

/** Palabras que nombran una cosa (no un efecto): su primer apartado es «Qué es» en vez de «Qué hace». */
const SON_COSAS: readonly ClaveRegla[] = ['sinOposicion', 'comprometidoCon', 'pruebaDeAccion', 'gesta', 'finalConEleccion', 'cartaRecompensa', 'salidaDoble', 'capituloAlAzar', 'mazoNaufragio', 'pasajero', 'entrenamiento', 'tesoro', 'estados']

function regla(clave: ClaveRegla, nombre: string, hace: string, mas?: ParteAyuda): Ayuda {
  const rotulo = SON_COSAS.includes(clave) ? 'Qué es' : 'Qué hace'
  return { clave: `regla:${clave}`, nombre, clase: 'regla', partes: [{ rotulo, texto: hace }, ...(mas ? [mas] : [])] }
}

export const AYUDA_REGLA: Record<ClaveRegla, Ayuda> = {
  abordaje: regla(
    'abordaje',
    'Abordaje',
    'El enemigo salta a tu cubierta: en esta Prueba no se pueden usar Cañones (ni suman ni se pueden agotar sus capacidades). Si fallas, infliges 1 herida por cada punto que te falte para llegar a la dificultad, sin máximo (las repartes como quieras).',
    {
      rotulo: 'Detalles',
      texto:
        'Las heridas las repartes como quieras entre tus Tripulantes, preparados o agotados, Capitán incluido. Si fallas, te falta al menos 1 punto, aunque fallaras por un Destino que dice «Fallas la Prueba». La Pólvora del Rey, que es fuego de Cañón, tampoco vale.',
    },
  ),
  permanente: regla(
    'permanente',
    'Zona de permanentes',
    'Algunos encuentros y misiones dicen «Pon en juego la carta N del mazo de historia»: esa carta, una permanente, se pone junto a la misión (o junto a un Tripulante, si lo dice) con su texto activo. El encuentro da su Avance y su carta se descarta como cualquier otra. Si la permanente no está en el mazo de historia, la carta del encuentro se descarta sin dar su Avance y se revela otra.',
    {
      rotulo: 'Cómo se quita',
      texto: 'Como dice su texto (a menudo con una Acción) o con «Cortar por lo sano». «Descarta esta carta» la devuelve al mazo de historia. Al terminar la misión, todas vuelven al mazo de historia con sus fichas fuera, salvo las que digan otra cosa («Mala fama», las Murallas de Port Royal).',
    },
  ),
  elige: regla(
    'elige',
    'Elige',
    'Te da varias opciones y escoges una. En un encuentro, eliges antes de asignar a nadie; en una carta de Escenario, al revelarla (si no puedes cumplir entera ninguna opción, no pasa nada).',
    {
      rotulo: 'Detalles',
      texto:
        'Una opción que es un pago (descartar cartas, agotar Tripulantes, perder munición…) y no puedes pagar entera no se ofrece. Si una opción es pagar y la otra hacer la Prueba, pagar cuenta como superarla: ganas el primer número de su Avance («3 / 2»: 3) sin hacer la Prueba ni revelar Destino.',
    },
  ),
  sinAyuda: regla('sinAyuda', 'Sin ayuda', 'Solo un Tripulante puede ser asignado a esa Prueba.', {
    rotulo: 'Detalles',
    texto:
      'Puedes añadir cartas de Habilidad de tu mano por sus iconos. Los Eventos no suman, ni siquiera por sus iconos, y durante esa Prueba no se pueden jugar Eventos. Las bonificaciones constantes del Tripulante y de sus Mejoras siguen sumando. Un Tripulante Asustado no puede ser asignado.',
  }),
  incautado: regla(
    'incautado',
    'Incautado',
    'Cartas de tu mano, una Mejora o un Tripulante van debajo de la carta de misión hasta saber si la superas. Las eliges tú, salvo que la carta diga «al azar» o «las de más coste». Un Tripulante incautado sigue ocupando su plaza en el Barco.',
    {
      rotulo: 'Cómo se recupera',
      texto:
        'Si superas la misión, lo recuperas: las cartas vuelven a tu mano, la Mejora a su portador (si ya no está en juego, se descarta) y el Tripulante a tu tripulación. Si no la superas, lo pierdes: sale del juego, salvo que la carta diga que se descarta.',
    },
  ),
  persigue: regla(
    'persigue',
    'Persigue',
    'Después de aplicar este Destino, pon su carta encima del mazo de Peligros: será tu siguiente encuentro.',
    {
      rotulo: 'Detalles',
      texto:
        'Si la misión termina antes de revelarla, sigue encima del mazo y sale como primer encuentro de tu próxima misión, con el encuentro del Entorno que toque. «Virar y dar la cara» la manda al fondo del mazo. No es lo mismo que el Estado Perseguido del Barco.',
    },
  ),
  ocuparMuelle: regla(
    'ocuparMuelle',
    'Ocupa el muelle',
    'Cuando termina el encuentro, la carta de Peligro sustituye a la carta de coste más alto del muelle (si empatan, a la de más a la izquierda), que se descarta. Se queda de un turno a otro y ocupa un hueco: al reponer el muelle revelas una carta menos. No se puede reclutar ni adquirir, y no cuenta para los efectos que eligen una carta del muelle.',
    { rotulo: 'Cómo se quita', texto: 'En la Fase de Reclutamiento puedes pagar las cartas que indica para descartarla. Va a la pila de descartes de Peligros.' },
  ),
  sinOposicion: regla(
    'sinOposicion',
    'Sin oposición',
    'Línea de algunos Destinos que solo se aplica cuando no asignas a nadie a la Prueba. Lo que el Destino le hace a un Tripulante asignado, en cambio, no se aplica: el Sin oposición ya es el castigo. En los Destinos favorables suele decir «Sin fallo»: no se aplica el efecto de fallo.',
    {
      rotulo: 'Avance',
      texto:
        'Sin nadie asignado, fallas la Prueba: ganas el segundo número del Avance del encuentro («Avance 3 / 2»: 2), aunque la línea diga que no se aplica el efecto de fallo. «−1 de Avance (mín. 0)»: ese encuentro da 1 de Avance menos, sin bajar de 0; no quita el Avance que ya tenía la misión.',
    },
  ),
  descartaTripulante: regla(
    'descartaTripulante',
    'Descartar a un Tripulante',
    'El Tripulante va a la pila de descartes del mazo de muelle junto con sus Mejoras, como al despedirlo. Sus Tesoros pasan a otro Tripulante.',
    { rotulo: 'El Capitán', texto: 'Si un efecto descartaría al Capitán, el Capitán no se descarta: en su lugar, le infliges 1 herida.' },
  ),
  recluta: regla(
    'recluta',
    'Recluta',
    'Pagas el coste de un Tripulante del muelle y entra en juego, preparado (si la carta dice «sin coste», no lo pagas). Tu Barco no puede llevar más Tripulantes que su Capacidad (el Capitán no cuenta).',
    { rotulo: 'Durante una misión', texto: 'El Tripulante entra preparado, ocupa Capacidad (si no cabe, no puedes reclutarlo) y cuenta como reclutar.' },
  ),
  comprometidoCon: regla(
    'comprometidoCon',
    'El Tripulante asignado con más (o menos)',
    'El Tripulante asignado con el número impreso más alto (o más bajo) en esa habilidad, sin contar bonificaciones de Mejoras, fichas de Entrenamiento ni otras cartas. Si empatan, eliges tú.',
    {
      rotulo: 'Detalles',
      texto:
        'Sin nadie asignado, en un encuentro es el de más (o menos) de toda tu tripulación; en un Destino, no se aplica. En un Destino, «la habilidad más alta (o más baja)» es la de esa Prueba. «El Tripulante con menos Vida» mira la Vida impresa, y en «el Tripulante de menor coste» el Capitán no cuenta.',
    },
  ),
  seRetira: regla(
    'seRetira',
    'Se retira',
    'Aplica ese encuentro y retira la carta del juego en vez de descartarla: ya no volverá a salir, ni como encuentro ni como Destino.',
  ),
  entraEnMazo: regla(
    'entraEnMazo',
    'Entra en el mazo de Peligros',
    'Baraja esa carta en el mazo de Peligros: se queda en el mazo el resto de la partida, como cualquier otra.',
    {
      rotulo: 'Encima del mazo',
      texto:
        'Si la carta dice que la pongas encima del mazo, no la barajes: será tu primer encuentro de la próxima misión, aunque antes se baraje el mazo, y no sale como Destino mientras espera. Si ya estaba en el mazo o en los descartes, sácala de ahí y ponla encima.',
    },
  ),
  volverMuelle: regla(
    'volverMuelle',
    'Vuelve al muelle',
    'El Tripulante (nunca el Capitán) vuelve al muelle junto con sus Mejoras. Desde el muelle puedes volver a reclutarlo pagando su coste.',
  ),
  pruebaDeAccion: regla(
    'pruebaDeAccion',
    'Prueba de una Acción',
    'Es una Prueba normal: asignas a tus Tripulantes y añades cartas de tu mano, revelas el Destino y, si no asignaste a nadie, aplicas su línea Sin oposición.',
    {
      rotulo: 'Detalles',
      texto:
        'No tiene Avance propio: solo ganas lo que diga su texto. No puedes hacerla durante otra Prueba: se usa en la Fase de Reclutamiento o después de resolver una carta de Peligro. La de una Interrupción («¡A por ellos!») se hace en el momento, aunque haya otra Prueba a medio resolver; al terminarla, se sigue con la otra.',
    },
  ),
  misionFalla: regla(
    'misionFalla',
    'La misión falla',
    'Es como retirarte: no superas la misión, pierdes su Avance y eliges si la dejas disponible o la pones al fondo del mazo de Misiones.',
  ),
  alZarpar: regla(
    'alZarpar',
    'Al zarpar',
    'Se resuelve al empezar la misión, después de cubrir la Distancia. La tienen las misiones y las cartas que dan algo al empezar una misión, como el Avance de la Vela mayor. Si es opcional, decides en ese momento si la usas. Las capacidades de tus cartas que dicen «Después de zarpar» se resuelven en el mismo momento.',
  ),
  gesta: regla('gesta', 'Gesta', 'Si superas la misión de la manera que dice, ganas además 1 de reputación.'),
  finalConEleccion: regla(
    'finalConEleccion',
    'Final con elección',
    'Al superar el capítulo coges su carta de recompensa y eliges una de sus dos opciones (por ejemplo, un Tesoro y 2 de reputación, o 3 de reputación).',
  ),
  cartaRecompensa: regla(
    'cartaRecompensa',
    'Carta de recompensa',
    'Carta del mazo de historia que te da una misión al superarla («Coge la carta 290 del mazo de historia»). La coges, haces lo que dice y, al terminar, vuelve al mazo de historia.',
  ),
  salidaDoble: regla(
    'salidaDoble',
    'Salida doble',
    'Esta travesía tiene dos capítulos II, «II-a» y «II-b». Su capítulo I dice cuál añades según cómo lo superes; el otro se queda en el mazo de historia.',
  ),
  pasajero: regla(
    'pasajero',
    'Pasajero',
    'Carta que viaja contigo. Su carta dice todo lo que hace: no es un Tripulante (no ocupa Capacidad, no puede ser asignado y no recibe heridas, Estados ni Ventajas).',
    { rotulo: 'Cuándo se va', texto: 'Se queda en juego entre misiones hasta que su carta diga que se va.' },
  ),
  descomunal: regla(
    'descomunal',
    'Descomunal',
    'Descomunal N: asigna al menos N Tripulantes a esta Prueba; si no puedes, la fallas.',
    { rotulo: 'Detalles', texto: 'Puedes no asignar a nadie (Sin oposición): entonces la fallas. Si asignas, tienen que ser N o más; con menos, no se puede.' },
  ),
  alerta: regla(
    'alerta',
    'Alerta',
    'Este encuentro se resuelve siempre: ninguna carta puede descartarlo, devolverlo al mazo ni evitar que se resuelva. Si ves esta carta al otear, debe quedarse encima del mazo.',
    {
      rotulo: 'Detalles',
      texto: 'No valen contra él «Sangre fría», «Soborno», las Velas de tormenta, Íñigo «Lince» Quintero, «Cambio de rumbo», «Retirada a tiempo» ni el Pedrero de borda. Al otear (la Vigía inexperta, «Rumores de taberna», los Despachos del Rey…) no puedes ponerla al fondo, aunque sí ordenarla con las demás que dejas encima. Si reúnes el Avance a mitad de él, se resuelve igualmente antes de superar la misión.',
    },
  ),
  destina: regla(
    'destina',
    'Destina',
    'Destina X y una habilidad: para pagarlo, agota Tripulantes preparados cuya habilidad sume al menos X. No es una Prueba: no se revela Destino ni se añaden cartas de la mano.',
    { rotulo: 'Detalles', texto: 'Cada Tripulante cuenta con sus bonificaciones, como al cubrir una Distancia.' },
  ),
  capituloAlAzar: regla(
    'capituloAlAzar',
    'Capítulo al azar',
    'La carta 293, «Las tres cruces del mapa», que dan el capítulo I de «La Isla del Tesoro» y «El mapa era falso», baraja boca abajo los capítulos II que no hayas superado y pone uno encima del mazo de Misiones sin mirarlo; los demás vuelven al mazo de historia. No sabes cuál te espera hasta que sale.',
  ),
  mazoNaufragio: regla(
    'mazoNaufragio',
    'Mazo del naufragio',
    'Doce cartas del mazo de historia (269 a 271 y 277 a 285). Las baraja la carta 286, «Fondeáis sobre el San José», que coges al superar «El naufragio del San José». Cada vez que buceas, agotas a un Tripulante preparado y robas 1. Lo que pasa lo dice cada carta: te la quedas, la pones en juego o vuelve barajada al mazo.',
    {
      rotulo: 'Detalles',
      texto: 'Antes de bucear preparas a todos tus Tripulantes, y puedes bucear las veces que quieras mientras te quede alguien preparado. Una carta que no dice qué hacer con ella se aparta después de aplicarla. Al terminar, la carta 286 y todo el mazo del naufragio vuelven al mazo de historia, salvo las cartas que estén en juego.',
    },
  ),
  indestructible: regla('indestructible', 'Indestructible', 'No se puede perder ni agotar por ningún efecto, ni siquiera al hundirse el Barco.'),
  enrolado: regla(
    'enrolado',
    'Enrolado',
    'Enrolado N: al reclutarlo, recibe N fichas de Enrolado. Al final de cada turno pierde 1, hayas zarpado o no. Cuando no le queda ninguna, se va a la pila de descartes del muelle con sus Mejoras, como al despedirlo.',
    { rotulo: 'Detalles', texto: 'Cuenta también el turno en que lo reclutas, y los turnos en que te quedas en puerto. No cuenta como derrotado. Las fichas no se renuevan ni se añaden.' },
  ),
  otear: regla(
    'otear',
    'Otear',
    'Otea N: mira las N cartas superiores del mazo de Peligros y devuélvelas encima o al fondo del mazo, en el orden que quieras. Si la misión revela de un mazo propio mezclado, mira ese mazo.',
    { rotulo: 'Detalles', texto: 'Una carta con Alerta (como los barcos rivales) debe quedarse encima del mazo: no puedes ponerla al fondo.' },
  ),
  entrenamiento: regla(
    'entrenamiento',
    'Entrenamiento',
    'Ficha de +1 en NAV, COM o EXP. Ocupa uno de los huecos de Mejora del Tripulante y dura mientras siga en juego. No se puede perder ni agotar.',
  ),
  tesoro: regla(
    'tesoro',
    'Tesoro',
    'Carta única que dan algunos capítulos. Entra en juego al momento, sin coste. No ocupa Espacio ni hueco de Mejora, y no se puede perder ni agotar.',
    { rotulo: 'Si su portador cae', texto: 'Si su portador queda derrotado, vincúlalo a otro de tus Tripulantes.' },
  ),
  estados: regla(
    'estados',
    'Estados y Ventajas',
    'Fichas sobre un Tripulante o el Barco. Un Estado perjudica o limita; una Ventaja (Inspirado, Aguerrido) solo ayuda. Se quedan de un turno a otro, también entre misiones, y nadie puede tener dos veces la misma.',
    { rotulo: 'Cómo se quitan', texto: 'Cada una dice cómo. En puerto, la Taberna quita todos los Estados de tus Tripulantes (no las Ventajas) y el Astillero, todos los del Barco.' },
  ),
}

// ---------------------------------------------------------------------------
// Lo que dura «no se prepara» y «no puede comprometerse» (efectos de las cartas de Peligro, sin ficha impresa)

export type ClaveLimitacion = 'noPrepara' | 'noCompromete'

const HACE_LIMITACION: Record<ClaveLimitacion, { nombre: string; hace: string }> = {
  noPrepara: { nombre: 'No se prepara', hace: 'No se prepara mientras dure este efecto: si está agotado, sigue agotado.' },
  noCompromete: { nombre: 'No puede ser asignado', hace: 'No puede ser asignado a las Pruebas mientras dure este efecto.' },
}

/** Cuándo termina, según hasta cuándo lo apuntó el motor. */
function finLimitacion(hasta: Temporal['hasta'], carta: string | null): string {
  switch (hasta) {
    case 'inicio':
      return 'Después de tu próxima Fase de Inicio (en esa fase no se prepara).'
    case 'finMision':
      return 'Al terminar la misión.'
    case 'finPrueba':
      return 'Al terminar esta Prueba.'
    case 'carta':
      return carta ? `Cuando «${carta}» deje de estar en juego (vuelva al mazo de historia).` : 'Cuando la carta que lo causa deje de estar en juego.'
    case 'finTurno':
      return 'Al final del turno.'
  }
}

/** Ayuda de la marca de un Tripulante junto al que está una permanente (fase 11). */
export function ayudaJunto(permanente: string): Ayuda {
  return {
    clave: `junto:${permanente}`,
    nombre: `Junto a «${permanente}»`,
    clase: 'limitacion',
    partes: [
      {
        rotulo: 'Qué es',
        texto: `La permanente «${permanente}» está junto a este Tripulante: lo que dice de «el atrapado», «el señalado» o «ese Tripulante» le pasa a él.`,
      },
      { rotulo: 'Cuándo termina', texto: 'Cuando la permanente vuelve al mazo de historia: al descartarla o al terminar la misión.' },
    ],
  }
}

/** Ayuda de un «no se prepara» o «no puede comprometerse», con la carta que lo causa. */
export function ayudaLimitacion(clave: ClaveLimitacion, hasta: Temporal['hasta'], fuente: string | null, carta: string | null): Ayuda {
  const { nombre, hace } = HACE_LIMITACION[clave]
  return {
    clave: `limitacion:${clave}:${hasta}`,
    nombre,
    clase: 'limitacion',
    partes: [
      { rotulo: 'Qué hace', texto: fuente ? `${hace} Lo causa «${fuente}».` : hace },
      { rotulo: 'Cuándo termina', texto: finLimitacion(hasta, carta) },
    ],
  }
}

// ---------------------------------------------------------------------------
// Qué explicar junto a una carta ampliada: lo que su texto nombra

/** Texto de una carta sin marcado ni frases de ambiente: «{2 dano g}» → «2 daño», «**Elige:**» → «Elige:». */
export function sinMarcado(texto: string): string {
  const icono: Record<string, string> = {
    dano: 'daño',
    herida: 'herida',
    avance: 'Avance',
    robar: 'carta',
    curar: 'curar',
    rep: 'reputación',
    vida: 'Vida',
    capacidad: 'Capacidad',
    mar: 'Mar',
    nat: 'Naturaleza',
    ciu: 'Ciudad',
    agotar: 'agotar',
    descartar: 'descartar',
    mejora: 'Mejora',
    sinop: 'Sin oposición',
    MAN: 'Mando',
    espacio: 'Espacio',
  }
  return texto
    .replace(/~[^~]*~/g, ' ')
    .replace(/\{([^}]*)\}/g, (_m, c: string) => {
      const [n = '', ic] = c.trim().split(/\s+/)
      return ic && !/^[grk]$/.test(ic) ? `${n} ${icono[ic] ?? ic}` : n
    })
    .replace(/\[([A-Za-z]+)\]/g, (_m, ic: string) => icono[ic] ?? ic)
    .replace(/\*\*/g, '')
    .replace(/_([^_]+)_/g, '$1')
    .replace(/#([^#]+)#/g, '$1')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Campos con texto de reglas (no los nombres, la ambientación ni las ayudas del prototipo). */
const CAMPOS_TEXTO = new Set(['texto', 'nota', 'notaPrueba', 'textoEfecto', 'textoExito', 'textoFallo', 'etiquetas', 'reglas', 'opcionesComunes', 'efecto'])

interface TextoCarta {
  texto: string
  /** En la recompensa de un capítulo, «Elige» es un final con elección. */
  recompensa: boolean
}

function recoger(valor: unknown, campo: string, recompensa: boolean, lista: TextoCarta[]): void {
  if (typeof valor === 'string') {
    if (campo === 'textoSinOposicion') {
      if (valor.trim()) lista.push({ texto: `Sin oposición: ${valor}`, recompensa })
    } else if (CAMPOS_TEXTO.has(campo) && valor.trim()) lista.push({ texto: valor, recompensa })
    return
  }
  if (Array.isArray(valor)) {
    for (const v of valor) recoger(v, campo, recompensa, lista)
    return
  }
  if (valor && typeof valor === 'object') {
    for (const [k, v] of Object.entries(valor)) {
      // Los arrays de textos («reglas», «etiquetas») heredan el nombre de su campo.
      recoger(v, k, recompensa || k === 'recompensa', lista)
    }
  }
}

/** Todos los textos de reglas de una carta, sin marcado. */
export function textosDeCarta(entrada: EntradaCatalogo): TextoCarta[] {
  const lista: TextoCarta[] = []
  // Fase 15, cuarta ronda: el texto de una carta de recompensa es una recompensa («Elige» es un final con elección).
  recoger(entrada.carta, '', entrada.tipo === 'recompensa', lista)
  return lista.map((t) => ({ ...t, texto: sinMarcado(t.texto) })).filter((t) => t.texto)
}

interface Patron {
  ayuda: Ayuda
  patron: RegExp
  /** Solo cuenta dentro (true) o fuera (false) de la recompensa de un capítulo. */
  enRecompensa?: boolean
}

const PATRON_ESTADO: Record<FichaTripulante | EstadoBarco, RegExp> = {
  envenenado: /\bEnvenenad[oa]s?\b/,
  borracho: /\bBorrach[oa]s?\b/,
  asustado: /\bAsustad[oa]s?\b/,
  sangrando: /\bSangrando\b/,
  buscado: /\bBuscad[oa]s?\b/,
  maldito: /\bMaldit[oa]s?\b/,
  inspirado: /\bInspirad[oa]s?\b/,
  aguerrido: /\bAguerrid[oa]s?\b/,
  viaDeAgua: /\bVía de agua\b/,
  velasRotas: /\bVelas rotas\b/,
  perseguido: /\bPerseguido\b/,
  extenuado: /\bExtenuad[oa]s?\b/,
  desanimo: /\bDesánimo\b/,
}

const PATRON_REGLA: Record<ClaveRegla, RegExp | null> = {
  abordaje: /\bAbordaje\b/,
  permanente: /\bPon en juego la carta \d+ del mazo de historia\b|\bzona de permanentes\b/,
  elige: /\bElige\b/,
  sinAyuda: /\bSin ayuda\b/,
  incautado: /\b[Ii]ncautad[oa]s?\b/,
  persigue: /\bPersigue\b|vaya a poner su carta encima del mazo de Peligros/,
  ocuparMuelle: /Ocupa el muelle|pon esta carta en el muelle/,
  sinOposicion: /\bSin oposición\b/,
  descartaTripulante: /\b[Dd]escarta (al|a ese|a un|a otro) Tripulante\b|\bdescarta a (Fiador|Grumete)\b|\bse descarta \(lo pescan|\bdescarta a ese Tripulante\b/,
  recluta: /\bRecluta\b/,
  comprometidoCon: /asignad[oa]s? con (más|menos)|con (más|menos) (NAV|COM|EXP|Vida)\b|con la (NAV|COM|EXP) más (alta|baja)|habilidad más (alta|baja)|de menor coste/,
  seRetira: /\bSe retira\b/,
  entraEnMazo: /\+ «|\+ La Armada|[Ee]ntra en el mazo de Peligros|(?<!esta carta |su carta )encima del mazo de Peligros/,
  volverMuelle: /\b[Vv]uelven? al muelle\b|↩/,
  pruebaDeAccion: /(Acción|Interrupción):.* [Hh]az una Prueba/,
  misionFalla: /\bla misión falla\b/i,
  alZarpar: /\bAl zarpar\b|\b[Dd]espués de zarpar\b/,
  gesta: /\bGesta\b/,
  finalConEleccion: /\bElige\b/,
  cartaRecompensa: /\bCoge la carta \d+ del mazo de historia\b/,
  salidaDoble: /\bSalida doble\b/,
  pasajero: /\bPasajeros?\b/,
  descomunal: /\bDescomunal \d/,
  alerta: /\bAlerta\b/,
  destina: /\bDestina \d/,
  capituloAlAzar: /\bBaraja boca abajo (las cartas \d+|los capítulos II)/,
  mazoNaufragio: /\bmazo del naufragio\b/,
  indestructible: /\bIndestructible\b/,
  enrolado: /\bEnrolado \d/,
  otear: /\b[Oo]tea\b|\bOtear\b/,
  entrenamiento: /\bEntrenamiento\b/,
  // Por el tipo de carta (ver ayudasDeCarta).
  tesoro: null,
  estados: /\bEstados\b|\bVentajas\b/,
}

const PATRONES: Patron[] = [
  ...FICHAS_TRIPULANTE.map((e) => ({ ayuda: AYUDA_ESTADO[e], patron: PATRON_ESTADO[e] })),
  ...ESTADOS_BARCO.map((e) => ({ ayuda: AYUDA_ESTADO[e], patron: PATRON_ESTADO[e] })),
  ...(Object.keys(AYUDA_FICHA_MISION) as FichaMision[]).map((f) => ({
    ayuda: AYUDA_FICHA_MISION[f],
    patron: new RegExp(`fichas? de ${AYUDA_FICHA_MISION[f].nombre}\\b`),
  })),
  ...CLAVES_REGLA.flatMap((c): Patron[] => {
    const patron = PATRON_REGLA[c]
    if (!patron) return []
    if (c === 'elige') return [{ ayuda: AYUDA_REGLA[c], patron, enRecompensa: false }]
    if (c === 'finalConEleccion') return [{ ayuda: AYUDA_REGLA[c], patron, enRecompensa: true }]
    return [{ ayuda: AYUDA_REGLA[c], patron }]
  }),
]

/** Explicaciones de lo que nombra un texto, en el orden en que aparece. */
export function ayudasDeTextos(textos: readonly TextoCarta[]): Ayuda[] {
  const encontradas = new Map<string, { ayuda: Ayuda; donde: number }>()
  textos.forEach((t, i) => {
    for (const p of PATRONES) {
      if (p.enRecompensa !== undefined && p.enRecompensa !== t.recompensa) continue
      const m = p.patron.exec(t.texto)
      if (!m) continue
      const donde = i * 10_000 + m.index
      const ya = encontradas.get(p.ayuda.clave)
      if (!ya || donde < ya.donde) encontradas.set(p.ayuda.clave, { ayuda: p.ayuda, donde })
    }
  })
  // Las expresiones que salen en casi todas las cartas de Peligro, al final.
  const peso = (a: Ayuda) => (AL_FINAL.includes(a.clave) ? 1 : 0)
  return [...encontradas.values()].sort((a, b) => peso(a.ayuda) - peso(b.ayuda) || a.donde - b.donde).map((x) => x.ayuda)
}

const AL_FINAL = ['regla:comprometidoCon', 'regla:sinOposicion']

/** Lo que conviene explicar junto a una carta ampliada: las palabras de regla, Estados y fichas que nombra. */
export function ayudasDeCarta(id: string): Ayuda[] {
  const entrada = porId(id)
  const lista = ayudasDeTextos(textosDeCarta(entrada))
  const extra =
    entrada.tipo === 'pasajero' ? AYUDA_REGLA.pasajero : entrada.tipo === 'tesoro' ? AYUDA_REGLA.tesoro : entrada.tipo === 'recompensa' ? AYUDA_REGLA.cartaRecompensa : null
  if (extra && !lista.includes(extra)) lista.unshift(extra)
  // Caben 6 junto a la ampliación. Fase 16: con Extenuado, «La maldición del bokor» llegaba a 7; sobran las del final,
  // que son las más comunes en las cartas de Peligro («Sin oposición»…).
  return lista.slice(0, MAX_AYUDAS)
}

/** Explicaciones que caben junto a una carta ampliada. */
const MAX_AYUDAS = 6

/** Todas las explicaciones, por grupos (para la Referencia rápida y las pruebas). */
export function glosarioCompleto(): { titulo: string; ayudas: Ayuda[] }[] {
  return [
    { titulo: 'Estados de los Tripulantes', ayudas: FICHAS_TRIPULANTE.filter((e) => !INFO_ESTADO[e].ventaja).map((e) => AYUDA_ESTADO[e]) },
    { titulo: 'Estados del Barco', ayudas: ESTADOS_BARCO.map((e) => AYUDA_ESTADO[e]) },
    { titulo: 'Ventajas', ayudas: FICHAS_TRIPULANTE.filter((e) => INFO_ESTADO[e].ventaja).map((e) => AYUDA_ESTADO[e]) },
    { titulo: 'Contadores', ayudas: (Object.keys(AYUDA_FICHA_MISION) as FichaMision[]).map((f) => AYUDA_FICHA_MISION[f]) },
    { titulo: 'Palabras de las cartas', ayudas: CLAVES_REGLA.filter((c) => c !== 'estados').map((c) => AYUDA_REGLA[c]) },
  ]
}
