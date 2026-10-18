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
  fichaMision: 'Ficha de misión',
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

const TABERNA = 'En puerto, la Taberna quita todos los Estados de tus Tripulantes.'
const ASTILLERO = 'En puerto, el Astillero quita todos los Estados del Barco.'
const VENTAJA_SE_QUEDA = 'La Taberna no quita las Ventajas.'

/** `quita` vacío: solo se quita en puerto (la Taberna o el Astillero). */
function estado(e: FichaTripulante | EstadoBarco, hace: string, quita: string): Ayuda {
  const barco = (ESTADOS_BARCO as readonly string[]).includes(e)
  const ventaja = INFO_ESTADO[e].ventaja === true
  const clase: ClaseAyuda = ventaja ? 'ventaja' : barco ? 'estadoBarco' : 'estado'
  const enPuerto = ventaja ? VENTAJA_SE_QUEDA : barco ? ASTILLERO : TABERNA
  const solo = barco ? 'Solo lo quita el Astillero, en puerto.' : 'Solo lo quita la Taberna, en puerto.'
  return {
    clave: `estado:${e}`,
    nombre: INFO_ESTADO[e].nombre,
    clase,
    partes: [
      { rotulo: 'Qué hace', texto: hace },
      { rotulo: ventaja ? 'Cuándo se gasta' : 'Cómo se quita', texto: quita ? `${quita} ${enPuerto}` : solo },
    ],
  }
}

// ---------------------------------------------------------------------------
// Estados y Ventajas (reglamento: «Estado», «Ventaja» y la tabla de la Referencia rápida)

export const AYUDA_ESTADO: Record<FichaTripulante | EstadoBarco, Ayuda> = {
  envenenado: estado(
    'envenenado',
    'Al final de cada turno, sufre 1 herida.',
    'Curarle quita primero esta ficha, en vez de una herida. También la quitan la Herbolaria, «Cataplasma» y algunos encuentros («Agua dulce»).',
  ),
  borracho: estado('borracho', 'Recibe +1 COM, pero no puede comprometerse a Pruebas de NAV ni de EXP.', 'Se quita al final del turno.'),
  aturdido: estado('aturdido', 'La próxima vez que se comprometa a una Prueba, no suma.', 'Se quita entonces, al comprometerse. También la quita la Herbolaria.'),
  asustado: estado(
    'asustado',
    'No puede comprometerse solo a una Prueba (tampoco a una Prueba Sin ayuda).',
    'Se quita al superar una Prueba en la que participe. También la quita la Herbolaria.',
  ),
  sangrando: estado(
    'sangrando',
    'Cada vez que se agota, sufre 1 herida.',
    'Curarle 1 quita esta ficha (después de Envenenado, si también lo está). También la quitan la Herbolaria y «Cataplasma».',
  ),
  buscado: estado(
    'buscado',
    'En Ciudad, los encuentros Guardia y Militar reciben +1 por cada Tripulante Buscado que participe en su Prueba.',
    '',
  ),
  maldito: estado(
    'maldito',
    'Cuando un Destino hiere a «uno de los comprometidos», tiene que ser un Tripulante Maldito, si hay alguno comprometido.',
    'Se quita al superar la Prueba de un encuentro Sobrenatural en la que participe, y con algunas cartas («La mambo del mercado»).',
  ),
  encadenado: estado(
    'encadenado',
    'No puede comprometerse ni usar las capacidades de su carta; sus capacidades constantes y sus Mejoras siguen funcionando.',
    'Acción: haz una Prueba de COM 3 o de EXP 3 (no durante otra Prueba).',
  ),
  inspirado: estado('inspirado', 'Recibe +1 en su próxima Prueba.', 'Al comprometerse: suma 1 más y la ficha se quita.'),
  aguerrido: estado(
    'aguerrido',
    'Evita la próxima herida que vaya a sufrir. Solo evita 1, aunque reciba varias a la vez.',
    'Se quita al evitar esa herida.',
  ),
  viaDeAgua: estado(
    'viaDeAgua',
    'Al final de cada carta de Peligro en una misión de Mar, el Barco sufre 1 daño.',
    'Reparar quita primero esta ficha, en vez de un daño. También la quita el Práctico del puerto.',
  ),
  incendio: estado(
    'incendio',
    'En una misión de Mar, al revelar cada carta de Peligro, el Barco sufre 1 daño. Si una misión termina, en cualquier Entorno, sin haberlo apagado, pierdes una Mejora de barco y la ficha sigue.',
    'Se apaga con una Acción: agota a un Tripulante.',
  ),
  velasRotas: estado(
    'velasRotas',
    'El Barco no da su +1 a las Pruebas de NAV en el Mar y las Distancias son 1 mayores.',
    'También la quita el Práctico del puerto.',
  ),
  perseguido: estado(
    'perseguido',
    'Tu próxima misión de Mar empieza revelando un Peligro de más, que se resuelve entero antes del primero, sin ventana para retirarte entre ambos; cuenta como carta resuelta y da su Avance.',
    'Se quita al revelar ese Peligro de más. También la quita superar «Fragata a popa».',
  ),
  polvoraMojada: estado('polvoraMojada', 'Tus Cañones no recargan en el Inicio.', ''),
}

// ---------------------------------------------------------------------------
// Fichas de misión (reglas impresas de cada capítulo y la entrada «Fichas de misión» del reglamento)

const FIN_FICHAS = 'Las fichas de misión se descartan al terminar la misión, la superes o no.'
const MISION_FALLA = '«La misión falla» es como retirarte: no la superas, pierdes su Avance y eliges si la dejas disponible o la pones al fondo del mazo de Misiones.'

function fichaMision(f: FichaMision, nombre: string, cambia: string, pasa: string, mas = ''): Ayuda {
  return {
    clave: `mision:${f}`,
    nombre,
    clase: 'fichaMision',
    partes: [
      { rotulo: 'Cómo se ponen y se quitan', texto: cambia },
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
    'Con 2, la misión necesita 1 de Avance más. Con 3, pon en juego «¡La guardia!» junto a la misión: mientras esté, todas las Pruebas reciben +1.',
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
  'seQuedaEnJuego',
  'elige',
  'sinAyuda',
  'incautado',
  'persigue',
  'ocuparMuelle',
  'sinOposicion',
  'rehen',
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
  'salidaDoble',
  'pasajero',
  'indestructible',
  'otear',
  'entrenamiento',
  'tesoro',
  'estados',
] as const
export type ClaveRegla = (typeof CLAVES_REGLA)[number]

/** Palabras que nombran una cosa (no un efecto): su primer apartado es «Qué es» en vez de «Qué hace». */
const SON_COSAS: readonly ClaveRegla[] = ['sinOposicion', 'comprometidoCon', 'pruebaDeAccion', 'gesta', 'finalConEleccion', 'salidaDoble', 'pasajero', 'entrenamiento', 'tesoro', 'estados']

function regla(clave: ClaveRegla, nombre: string, hace: string, mas?: ParteAyuda): Ayuda {
  const rotulo = SON_COSAS.includes(clave) ? 'Qué es' : 'Qué hace'
  return { clave: `regla:${clave}`, nombre, clase: 'regla', partes: [{ rotulo, texto: hace }, ...(mas ? [mas] : [])] }
}

export const AYUDA_REGLA: Record<ClaveRegla, Ayuda> = {
  abordaje: regla(
    'abordaje',
    'Abordaje',
    'Si fallas la Prueba, sufres 1 herida por cada punto que te falte, como máximo 3. Si te faltan 3 o más, además uno de los Tripulantes comprometidos queda rehén.',
    {
      rotulo: 'Detalles',
      texto:
        'Si fallas, te falta al menos 1 punto, aunque fallaras por un Destino que dice «Fallas la Prueba». Las heridas se reparten entre los comprometidos. Si no comprometiste a nadie, las sufre el Tripulante que elijas y el rehén se elige al azar (nunca el Capitán).',
    },
  ),
  seQuedaEnJuego: regla(
    'seQuedaEnJuego',
    'Se queda en juego',
    'La carta no se descarta al resolverla: se queda junto a la misión, con su texto activo. Ganas su Avance impreso al revelarla y cuenta como carta resuelta. Puede impedirte superar la misión o retirarte mientras siga en juego.',
    {
      rotulo: 'Cómo se quita',
      texto: 'Como dice su texto (a menudo con una Acción) o con «Cortar por lo sano», si no es de nivel Terrible. Al terminar la misión se descarta con sus fichas.',
    },
  ),
  elige: regla(
    'elige',
    'Elige',
    'Te da varias opciones y escoges una. En un encuentro, eliges antes de comprometer a nadie; en una carta de Escenario, al revelarla (si no puedes cumplir entera ninguna opción, no pasa nada).',
    {
      rotulo: 'Detalles',
      texto:
        'Una opción que es un pago (descartar cartas, agotar Tripulantes, perder munición…) y no puedes pagar entera no se ofrece. Si una opción es pagar y la otra hacer la Prueba, al pagar ganas el Avance del encuentro sin hacer la Prueba ni revelar Destino.',
    },
  ),
  sinAyuda: regla('sinAyuda', 'Sin ayuda', 'Solo un Tripulante puede comprometerse a esa Prueba.', {
    rotulo: 'Detalles',
    texto:
      'Puedes añadir cartas de Habilidad de tu mano por sus iconos. Los Eventos no suman, ni siquiera por sus iconos, y durante esa Prueba no se pueden jugar Eventos. Las bonificaciones constantes del Tripulante y de sus Mejoras siguen sumando. Un Tripulante Asustado no puede comprometerse.',
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
    { rotulo: 'Cómo se quita', texto: 'En el paso de Jugar cartas puedes pagar las cartas que indica para descartarla. Va a la pila de descartes de Peligros.' },
  ),
  sinOposicion: regla(
    'sinOposicion',
    'Sin oposición',
    'Línea de algunos Destinos que solo se aplica cuando no comprometes a nadie a la Prueba. En los Destinos favorables suele decir «Sin fallo»: no se aplica el efecto de fallo.',
  ),
  rehen: regla(
    'rehen',
    'Rehén',
    'Uno de tus Tripulantes es capturado. Si había Tripulantes comprometidos en la Prueba, eliges a uno de ellos; si no, uno de tus Tripulantes al azar (nunca el Capitán). Apártalo: sigue ocupando Capacidad.',
    { rotulo: 'Cómo se recupera', texto: 'Si superas la misión, lo rescatas y vuelve a tu mesa. Si no la superas, se retira del juego con sus Mejoras y pierdes 1 de reputación.' },
  ),
  recluta: regla(
    'recluta',
    'Recluta',
    'Pagas el coste de un Tripulante del muelle y entra en juego, preparado (si la carta dice «gratis», no lo pagas). Tu Barco no puede llevar más Tripulantes que su Capacidad (el Capitán no cuenta).',
    { rotulo: 'Durante una misión', texto: 'El Tripulante entra preparado, ocupa Capacidad (si no cabe, no puedes reclutarlo) y cuenta como reclutar.' },
  ),
  comprometidoCon: regla(
    'comprometidoCon',
    'El comprometido con más (o menos)',
    'El Tripulante comprometido con el número impreso más alto (o más bajo) en esa habilidad, sin contar bonificaciones de Mejoras, fichas de Entrenamiento ni otras cartas. Si empatan, eliges tú.',
    {
      rotulo: 'Detalles',
      texto:
        'En un Destino, «la habilidad más alta (o más baja)» es la de esa Prueba. «El Tripulante con menos Vida» mira la Vida impresa, y en «el Tripulante de menor coste» el Capitán no cuenta.',
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
    'Es una Prueba normal: comprometes a tus Tripulantes y añades cartas de tu mano, revelas el Destino y, si no comprometiste a nadie, aplicas su línea Sin oposición.',
    {
      rotulo: 'Detalles',
      texto: 'No tiene Avance propio: solo ganas lo que diga su texto. No puedes hacerla durante otra Prueba: se usa en Jugar cartas o después de resolver una carta de Peligro.',
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
    'Se resuelve al empezar la misión, después de cubrir la Distancia. Si es opcional, decides en ese momento si la usas. Las capacidades de tus cartas que dicen «Después de zarpar» se resuelven en el mismo momento.',
  ),
  gesta: regla('gesta', 'Gesta', 'Si superas la misión de la manera que dice, ganas además 1 de reputación.'),
  finalConEleccion: regla(
    'finalConEleccion',
    'Final con elección',
    'Al superar este capítulo eliges una de las dos opciones de su recompensa (por ejemplo, un Tesoro y 2 de reputación, o 4 de reputación).',
  ),
  salidaDoble: regla(
    'salidaDoble',
    'Salida doble',
    'Esta travesía tiene dos capítulos II, «II-a» y «II-b». Su capítulo I dice cuál añades según cómo lo superes; el otro sale de la partida.',
  ),
  pasajero: regla(
    'pasajero',
    'Pasajero',
    'Carta que viaja contigo. Ocupa 1 de Capacidad; si no te queda Capacidad cuando entra, devuelve un Tripulante al muelle. No es un Tripulante: no se compromete, no se agota y no puede recibir heridas, Estados, Ventajas ni quedar rehén, salvo que su carta lo diga.',
    { rotulo: 'Cuándo se va', texto: 'Se queda en juego entre misiones hasta que su carta diga que se va.' },
  ),
  indestructible: regla('indestructible', 'Indestructible', 'No se puede perder ni agotar por ningún efecto, ni siquiera al hundirse el Barco.'),
  otear: regla('otear', 'Otear', 'Otear N: mira las N primeras cartas del mazo de Peligros y devuélvelas encima o al fondo del mazo, en el orden que quieras.'),
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
  noCompromete: { nombre: 'No compromete', hace: 'No puede comprometerse a las Pruebas mientras dure este efecto.' },
}

/** Cuándo termina, según hasta cuándo lo apuntó el motor. */
function finLimitacion(hasta: Temporal['hasta'], carta: string | null): string {
  switch (hasta) {
    case 'inicio':
      return 'Después de tu próximo Inicio (en ese Inicio no se prepara).'
    case 'finMision':
      return 'Al terminar la misión.'
    case 'superarPrueba':
      return 'Cuando superes otra Prueba en esta misión, o al terminar la misión.'
    case 'finPrueba':
      return 'Al terminar esta Prueba.'
    case 'carta':
      return carta ? `Cuando «${carta}» deje de estar en juego.` : 'Cuando la carta que lo causa deje de estar en juego.'
    case 'finTurno':
      return 'Al final del turno.'
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
    municion: 'munición',
    rep: 'reputación',
    vida: 'Vida',
    capacidad: 'Capacidad',
    mar: 'Mar',
    nat: 'Naturaleza',
    ciu: 'Ciudad',
    agotar: 'agotar',
    descartar: 'descartar',
    mejora: 'Mejora',
    rehen: 'rehén',
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
  recoger(entrada.carta, '', false, lista)
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
  aturdido: /\bAturdid[oa]s?\b/,
  asustado: /\bAsustad[oa]s?\b/,
  sangrando: /\bSangrando\b/,
  buscado: /\bBuscad[oa]s?\b/,
  maldito: /\bMaldit[oa]s?\b/,
  encadenado: /\bEncadenad[oa]s?\b/,
  inspirado: /\bInspirad[oa]s?\b/,
  aguerrido: /\bAguerrid[oa]s?\b/,
  viaDeAgua: /\bVía de agua\b/,
  incendio: /\bIncendio a bordo\b/,
  velasRotas: /\bVelas rotas\b/,
  perseguido: /\bPerseguido\b/,
  polvoraMojada: /\bPólvora mojada\b/,
}

const PATRON_REGLA: Record<ClaveRegla, RegExp | null> = {
  abordaje: /\bAbordaje\b/,
  seQuedaEnJuego: /\b[Ss]e queda en juego\b/,
  elige: /\bElige\b/,
  sinAyuda: /\bSin ayuda\b/,
  incautado: /\b[Ii]ncautad[oa]s?\b/,
  persigue: /\bPersigue\b|vaya a poner su carta encima del mazo de Peligros/,
  ocuparMuelle: /Ocupa el muelle|pon esta carta en el muelle/,
  sinOposicion: /\bSin oposición\b/,
  rehen: /\breh[eé]n(es)?\b/i,
  recluta: /\bRecluta\b/,
  comprometidoCon: /comprometid[oa]s? con (más|menos)|con (más|menos) (NAV|COM|EXP|Vida)\b|habilidad más (alta|baja)|de menor coste/,
  seRetira: /\bSe retira\b/,
  entraEnMazo: /\+ «|\+ La Armada|[Ee]ntra en el mazo de Peligros|(?<!esta carta |su carta )encima del mazo de Peligros/,
  volverMuelle: /\b[Vv]uelven? al muelle\b|↩/,
  pruebaDeAccion: /Acción: [Hh]az una Prueba/,
  misionFalla: /\bla misión falla\b/i,
  alZarpar: /\bAl zarpar\b|\b[Dd]espués de zarpar\b/,
  gesta: /\bGesta\b/,
  finalConEleccion: /\bElige\b/,
  salidaDoble: /\bSalida doble\b/,
  pasajero: /\bPasajeros?\b/,
  indestructible: /\bIndestructible\b/,
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
  const extra = entrada.tipo === 'pasajero' ? AYUDA_REGLA.pasajero : entrada.tipo === 'tesoro' ? AYUDA_REGLA.tesoro : null
  if (extra && !lista.includes(extra)) lista.unshift(extra)
  return lista
}

/** Todas las explicaciones, por grupos (para la Referencia rápida y las pruebas). */
export function glosarioCompleto(): { titulo: string; ayudas: Ayuda[] }[] {
  return [
    { titulo: 'Estados de los Tripulantes', ayudas: FICHAS_TRIPULANTE.filter((e) => !INFO_ESTADO[e].ventaja).map((e) => AYUDA_ESTADO[e]) },
    { titulo: 'Estados del Barco', ayudas: ESTADOS_BARCO.map((e) => AYUDA_ESTADO[e]) },
    { titulo: 'Ventajas', ayudas: FICHAS_TRIPULANTE.filter((e) => INFO_ESTADO[e].ventaja).map((e) => AYUDA_ESTADO[e]) },
    { titulo: 'Fichas de misión', ayudas: (Object.keys(AYUDA_FICHA_MISION) as FichaMision[]).map((f) => AYUDA_FICHA_MISION[f]) },
    { titulo: 'Palabras de las cartas', ayudas: CLAVES_REGLA.filter((c) => c !== 'estados').map((c) => AYUDA_REGLA[c]) },
  ]
}
