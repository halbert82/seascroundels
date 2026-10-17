// Nombres y textos de las fichas de Estado. Sin dependencias: lo usan el catálogo y la interfaz.

export const ESTADOS_TRIPULANTE = [
  'envenenado',
  'fiebre',
  'borracho',
  'aturdido',
  'asustado',
  'sangrando',
  'buscado',
  'maldito',
  'encadenado',
  'inspirado',
  'aguerrido',
] as const
export type EstadoTripulante = (typeof ESTADOS_TRIPULANTE)[number]

export const ESTADOS_BARCO = ['viaDeAgua', 'incendio', 'velasRotas', 'perseguido', 'polvoraMojada'] as const
export type EstadoBarco = (typeof ESTADOS_BARCO)[number]

export interface InfoEstado {
  nombre: string
  /** Lo que hace, en una frase (para la mesa). */
  texto: string
  bueno?: boolean
}

export const INFO_ESTADO: Record<EstadoTripulante | EstadoBarco, InfoEstado> = {
  envenenado: { nombre: 'Envenenado', texto: 'Al final de cada turno, 1 herida. Curar quita la ficha en vez de la herida.' },
  fiebre: {
    nombre: 'Fiebre',
    texto: '−1 a todas sus habilidades. Al final del turno se contagia a otro Tripulante sin Fiebre. Se quita en puerto con la Taberna o con el Matasanos.',
  },
  borracho: { nombre: 'Borracho', texto: '+1 COM. No puede comprometerse a NAV ni EXP. Se quita al final del turno.' },
  aturdido: { nombre: 'Aturdido', texto: 'La próxima vez que se comprometa, no suma. Se quita entonces.' },
  asustado: { nombre: 'Asustado', texto: 'No puede comprometerse solo. Se quita al superar una Prueba en la que participe.' },
  sangrando: { nombre: 'Sangrando', texto: 'Cada vez que se agota, 1 herida. Curar 1 lo quita.' },
  buscado: { nombre: 'Buscado', texto: 'En Ciudad, los encuentros Guardia y Militar reciben +1 si participa.' },
  maldito: {
    nombre: 'Maldito',
    texto: 'Cuando un Destino hiere a «uno de los comprometidos», tiene que ser él. Se quita al superar un encuentro Sobrenatural.',
  },
  encadenado: {
    nombre: 'Encadenado',
    texto: 'No puede comprometerse ni usar capacidades. Prueba de COM o EXP 3 en una ventana de acción para quitarlo.',
  },
  inspirado: { nombre: 'Inspirado', texto: '+1 en su próxima Prueba.', bueno: true },
  aguerrido: { nombre: 'Aguerrido', texto: 'Evita la próxima herida.', bueno: true },
  viaDeAgua: { nombre: 'Vía de agua', texto: 'Al final de cada carta de Peligro en el Mar, 1 daño. Reparar 1 quita la ficha.' },
  incendio: {
    nombre: 'Incendio a bordo',
    texto:
      'Al revelar cada carta de Peligro, 1 daño. Si no se apaga antes de acabar la misión, pierdes una Mejora de barco. Se apaga agotando a un Tripulante en una ventana de acción.',
  },
  velasRotas: { nombre: 'Velas rotas', texto: 'El Barco no da su +1 de NAV y las Distancias son 1 mayores. Se quita con el Astillero en puerto.' },
  perseguido: { nombre: 'Perseguido', texto: 'Tu próxima misión de Mar empieza revelando un Peligro de más.' },
  polvoraMojada: { nombre: 'Pólvora mojada', texto: 'Los Cañones no recargan en el Inicio. Se quita con el Astillero en puerto.' },
}

/** Identificador de la «carta» de un Estado en el registro de capacidades («estado:fiebre»). */
export function cartaDeEstado(e: EstadoTripulante | EstadoBarco): string {
  return `estado:${e}`
}
