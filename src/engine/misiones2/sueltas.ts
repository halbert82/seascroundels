// Misiones 2.0 · las misiones de un solo capítulo: las tres iniciales y las dos aventuras.
// También la Alarma y «¡La guardia!», que usan La casa del gobernador y San Felipe II-a.

import { anotar, copia, nombre } from '../estado.ts'
import { registrarCodigo } from '../tareas/efectos.ts'
import type { Estado, NuevaTarea } from '../tipos.ts'
import { mover } from '../zonas.ts'
import {
  alFallarPrueba,
  alQuedar,
  alResolverSinPrueba,
  alSuperarPrueba,
  dificultadClaves,
  fallaLaMision,
  fichas,
  ponerFichas,
  registrarMision,
  superarAhora,
} from './comun.ts'
import type { ReglasMision } from './registro.ts'

const robar = (n: number): NuevaTarea => ({ tipo: 'robar', n })
const reputacion = (n: number): NuevaTarea => ({ tipo: 'cambiarReputacion', n })

// ---------------------------------------------------------------------------
// La Alarma y «¡La guardia!»

/**
 * Alarma: cada Prueba de COM que superes y cada vez que un Tripulante quede Buscado, 1 ficha. Con 2, la misión
 * necesita 1 de Avance más. Con 3, pon en juego «¡La guardia!».
 */
export function alarma(): Pick<ReglasMision, 'fichas' | 'capacidades' | 'alCambiarFichas'> {
  return {
    fichas: [{ ficha: 'alarma', nombre: 'Alarma', umbral: 3, inicial: 0, nota: 'Con 2, la misión necesita 1 de Avance más. Con 3, llega ¡La guardia!' }],
    capacidades: [
      alSuperarPrueba('alarma', (_s, p) => (p.hab === 'COM' ? [ponerFichas('alarma', 1)] : [])),
      alQuedar('buscado', 'buscado', () => [ponerFichas('alarma', 1)]),
      {
        clave: 'alarma2',
        ventana: 'constante',
        modifica: (ctx, _yo, c) => (c.tipo === 'avanceNecesario' && c.mision === ctx.s.mision?.carta && fichas(ctx.s, 'alarma') >= 2 ? 1 : 0),
      },
    ],
    alCambiarFichas: (_s, _f, antes, ahora) => (antes < 3 && ahora >= 3 ? [{ tipo: 'aplicarEfectos', efectos: [{ tipo: 'codigo', clave: 'mision.guardia' }], contexto: 'efecto' }] : []),
  }
}

// «¡La guardia!» entra en juego junto a la misión (está apartada en el mazo de historia).
registrarCodigo('mision.guardia', (s) => {
  const carta = s.zonas.mazoHistoria.find((c) => copia(s, c).id === 'guardia')
  if (!carta || !s.mision) return []
  mover(s, carta, 'cartasMision', 'abajo')
  anotar(s, 'aviso', 'La Alarma llega a 3: ¡La guardia! entra en juego junto a la misión. Todas las Pruebas reciben +1.')
  return []
})

/** «¡La guardia!» se descarta: vuelve a apartarse (al mazo de historia). */
export function apartarCartaDeMision(s: Estado, carta: Parameters<typeof nombre>[1], motivo: string): void {
  if (!s.zonas.cartasMision.includes(carta)) return
  mover(s, carta, 'mazoHistoria', 'abajo')
  anotar(s, 'efecto', `${motivo}: «${nombre(s, carta)}» vuelve a apartarse.`)
}

registrarCodigo('guardia.descartar', (s, fuente) => {
  if (fuente) apartarCartaDeMision(s, fuente, 'Os quitáis de encima a la guardia')
  return []
})

// ---------------------------------------------------------------------------
// Misiones iniciales

// Una deuda en Tortuga · I · Cobrar la deuda
registrarMision('deuda-I', {
  capacidades: [dificultadClaves('pirata', ['Pirata'], -1)],
  // Puedes dejar 1 carta de tu mano como pagaré: si superas la misión, la recuperas y robas 1; si no, la pierdes.
  alZarpar: () => [
    {
      tipo: 'elegirEfectos',
      opciones: [
        {
          texto: 'Dejar 1 carta de tu mano como pagaré (si superas la misión, la recuperas y robas 1; si no, la pierdes)',
          efectos: [{ tipo: 'incautar', que: 'mano', n: 1, alRecuperar: [{ tipo: 'robar', n: 1 }], anotacion: 'Dejas como pagaré' }],
        },
        { texto: 'No dejar pagaré', efectos: [] },
      ],
    },
  ],
})

// Prueba de mar · I · Rumbo a mar abierto
registrarMision('prueba-I', {
  capacidades: [
    {
      // La primera vez que el Barco vaya a sufrir daño en esta misión, evítalo (todo ese daño).
      clave: 'carena',
      ventana: 'obligada',
      limite: { veces: 1, por: 'mision' },
      disparo: (_s, _yo, ev, fase) => fase === 'antes' && ev.tipo === 'danoBarco' && ev.cantidad > 0,
      efecto: (s, _yo, suceso) => {
        if (suceso && !suceso.cancelado) {
          suceso.cancelado = true
          anotar(s, 'efecto', 'El Barco sale de carena: evitas ese daño.')
        }
        return []
      },
    },
  ],
  // TODO(regla): P50 · la Gesta mira el daño del Barco al superarla (también el que traía de antes).
  gesta: (s) => s.danoBarco === 0,
})

// Aguada en la cala · I · Agua y leña
registrarMision('aguada-I', {
  capacidades: [
    // Cada vez que superes una Prueba, cura 1 herida a uno de los Tripulantes comprometidos (eliges entre los heridos).
    alSuperarPrueba('agua', () => [{ tipo: 'aQuien', quien: { de: 'comprometidos', herido: true }, hacer: { tipo: 'curar', n: 1 } }]),
  ],
})

// ---------------------------------------------------------------------------
// Aventuras

// El ladrón del puerto: la Ventaja del ladrón.
registrarMision('ladron-I', {
  fichas: [{ ficha: 'ventaja', nombre: 'Ventaja', umbral: 5, inicial: 2, nota: 'Con 5, el ladrón se escapa y la misión falla. Con 0, lo atrapas y la superas.' }],
  alZarpar: () => [ponerFichas('ventaja', 2)],
  capacidades: [
    alResolverSinPrueba('sinPrueba', () => [ponerFichas('ventaja', 1)]),
    alFallarPrueba('fallo', () => [ponerFichas('ventaja', 1)]),
    alSuperarPrueba('corte', (_s, p) => ((p.hab === 'NAV' || p.hab === 'EXP') && p.margen >= 2 ? [ponerFichas('ventaja', -1)] : [])),
  ],
  alCambiarFichas: (s, _f, antes, ahora) => {
    if (ahora >= 5 && antes < 5) fallaLaMision(s, 'el ladrón se escapa')
    else if (ahora <= 0 && antes > 0) superarAhora(s, 'lo atrapas')
    return []
  },
})

// La casa del gobernador: Alarma y saqueo.
registrarMision('gobernador-I', {
  ...alarma(),
  // Saqueo: si te retiras entre dos Peligros, cobras según tu Avance.
  alRetirarte: (s, avance) => {
    if (avance >= 4) {
      anotar(s, 'efecto', `Saqueo: te retiras con ${avance} de Avance: +1 de reputación y buscas una Mejora.`)
      return [reputacion(1), { tipo: 'buscarMuelle', filtro: 'mejora' }]
    }
    if (avance >= 2) {
      anotar(s, 'efecto', `Saqueo: te retiras con ${avance} de Avance: robas 2 cartas.`)
      return [robar(2)]
    }
    return []
  },
})
