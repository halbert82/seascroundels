// Nombres y textos de las fichas que llevan los Tripulantes y el Barco. Sin dependencias: lo usan el catálogo y la interfaz.
//
// Fase 8: un efecto que solo ayuda es una Ventaja (Inspirado, Aguerrido); uno que perjudica o limita es un Estado
// (Borracho también, aunque dé +1 COM). Las dos funcionan igual: fichas sobre el Tripulante, sin repetir la misma.
// La Taberna quita todos los Estados de tus Tripulantes, pero no las Ventajas.

/** Estados de un Tripulante: perjudican o limitan. */
export const ESTADOS_TRIPULANTE = ['envenenado', 'borracho', 'aturdido', 'asustado', 'sangrando', 'buscado', 'maldito', 'encadenado'] as const
export type EstadoTripulante = (typeof ESTADOS_TRIPULANTE)[number]

/** Ventajas de un Tripulante: solo ayudan. */
export const VENTAJAS = ['inspirado', 'aguerrido'] as const
export type Ventaja = (typeof VENTAJAS)[number]

/** Todo lo que un Tripulante puede llevar encima: Estados y Ventajas. */
export const FICHAS_TRIPULANTE = [...ESTADOS_TRIPULANTE, ...VENTAJAS] as const
export type FichaTripulante = EstadoTripulante | Ventaja

export function esVentaja(f: string): f is Ventaja {
  return (VENTAJAS as readonly string[]).includes(f)
}

export const ESTADOS_BARCO = ['viaDeAgua', 'incendio', 'velasRotas', 'perseguido', 'polvoraMojada'] as const
export type EstadoBarco = (typeof ESTADOS_BARCO)[number]

export interface InfoEstado {
  nombre: string
  /** Lo que hace, en una frase (para la mesa). */
  texto: string
  /** Es una Ventaja (solo ayuda): en la mesa va en verde; los Estados, en rojo. */
  ventaja?: boolean
}

export const INFO_ESTADO: Record<FichaTripulante | EstadoBarco, InfoEstado> = {
  envenenado: { nombre: 'Envenenado', texto: 'Al final de cada turno, 1 herida. Curar quita la ficha en vez de la herida.' },
  borracho: { nombre: 'Borracho', texto: '+1 COM. No puede comprometerse a NAV ni EXP. Se quita al final del turno.' },
  aturdido: { nombre: 'Aturdido', texto: 'La próxima vez que se comprometa, no suma. Se quita entonces.' },
  asustado: { nombre: 'Asustado', texto: 'No puede comprometerse solo. Se quita al superar una Prueba en la que participe.' },
  sangrando: { nombre: 'Sangrando', texto: 'Cada vez que se agota, 1 herida. Curar 1 lo quita.' },
  buscado: { nombre: 'Buscado', texto: 'En Ciudad, los encuentros Guardia y Militar reciben +1 si participa. Se quita con la Taberna en puerto.' },
  maldito: {
    nombre: 'Maldito',
    texto: 'Cuando un Destino hiere a «uno de los comprometidos», tiene que ser él. Se quita al superar la Prueba de un encuentro Sobrenatural en la que participe.',
  },
  encadenado: {
    nombre: 'Encadenado',
    texto: 'No puede comprometerse ni usar capacidades. Prueba de COM o EXP 3 en una ventana de acción para quitarlo.',
  },
  inspirado: { nombre: 'Inspirado', texto: '+1 en su próxima Prueba.', ventaja: true },
  aguerrido: { nombre: 'Aguerrido', texto: 'Evita la próxima herida.', ventaja: true },
  viaDeAgua: { nombre: 'Vía de agua', texto: 'Al final de cada carta de Peligro en el Mar, 1 daño. Reparar 1 quita la ficha.' },
  incendio: {
    nombre: 'Incendio a bordo',
    texto:
      'En el Mar, al revelar cada carta de Peligro, 1 daño. Si acaba la misión sin apagarlo (en cualquier Entorno), pierdes una Mejora de barco y la ficha sigue. Se apaga agotando a un Tripulante en una ventana de acción.',
  },
  velasRotas: { nombre: 'Velas rotas', texto: 'El Barco no da su +1 de NAV y las Distancias son 1 mayores. Se quita con el Astillero en puerto.' },
  perseguido: { nombre: 'Perseguido', texto: 'Tu próxima misión de Mar empieza revelando un Peligro de más.' },
  polvoraMojada: { nombre: 'Pólvora mojada', texto: 'Los Cañones no recargan en el Inicio. Se quita con el Astillero en puerto.' },
}

/** Identificador de la «carta» de un Estado en el registro de capacidades («estado:borracho»). */
export function cartaDeEstado(e: FichaTripulante | EstadoBarco): string {
  return `estado:${e}`
}
