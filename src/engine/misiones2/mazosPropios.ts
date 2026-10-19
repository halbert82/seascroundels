// Misiones 2.0 · las cartas de Peligro de los mazos propios (Templo y Escolta), con el formato de los Peligros 2.0:
// un solo encuentro (el del Entorno de su misión) y un Destino. También «La Armada te persigue», rehecha (P51).

import { registrarPeligro } from '../capacidades/peligros.ts'
import { anotar, copia } from '../estado.ts'
import { mazoActivo } from '../peligros.ts'
import {
  agotar,
  avance,
  codigo,
  comprometidoCon,
  dano,
  descartar,
  dificultad,
  encuentroEs,
  heridas,
  heridasAsignados,
  mas,
  menos,
  municion,
  participantesCtx,
  pierdesAvance,
  robar,
} from '../peligros2/comun.ts'
import { registrarCodigo } from '../tareas/efectos.ts'
import type { CartaId, Estado, InstId } from '../tipos.ts'
import { mover, vinculadas } from '../zonas.ts'

function lleva(s: Estado, c: InstId, ...ids: CartaId[]): boolean {
  return vinculadas(s, c).some((m) => ids.includes(copia(s, m).id))
}

// ---------------------------------------------------------------------------
// Mazo del Templo (solo Naturaleza)

// Guerreros esqueleto · Duro
// Destino: si fallas, la carta vuelve encima del mazo del Templo (vuelven a levantarse).
registrarCodigo('esqueleto.levantarse', (s, fuente) => {
  if (!fuente || !s.zonas.destino.includes(fuente)) return []
  mover(s, fuente, mazoActivo(s).mazo, 'arriba')
  anotar(s, 'aviso', '«Guerreros esqueleto» vuelven a levantarse: la carta va encima del mazo del Templo.')
  return []
})
registrarPeligro('esqueleto', {
  encuentros: { unico: { exito: [{ tipo: 'seRetira' }], fallo: [heridasAsignados(2)] } },
  destino: { siFallas: [codigo('esqueleto.levantarse')], sinOposicion: [heridas(1)] },
})

// Trampa de dardos · Leve
registrarPeligro('dardos', {
  encuentros: { unico: { exito: [municion(1)], fallo: [comprometidoCon(menos('EXP'), { tipo: 'estado', estado: 'envenenado' })] } },
  destino: {
    efectos: [comprometidoCon(menos('prueba'), { tipo: 'heridas', n: 1 })],
    // Sin oposición: inflige 1 herida a un Tripulante (fase 10: ya no tiene que estar preparado).
    sinOposicion: [heridas(1)],
  },
})

// Ídolo maldito · Duro · Elige: lo dejas en su sitio (pierdes 1 Avance) o lo coges (Prueba de EXP 4).
registrarPeligro('idolo', {
  encuentros: {
    unico: {
      elige: [
        { texto: 'Dejarlo en su sitio (pierdes 1 Avance)', efectos: [pierdesAvance(1)] },
        { texto: 'Cogerlo: Prueba de EXP 4', prueba: true },
      ],
      exito: [robar(3)],
      fallo: [comprometidoCon(mas('EXP'), { tipo: 'estado', estado: 'maldito' })],
    },
  },
  destino: { prueba: { sinCartas: true }, sinOposicion: [descartar(1)] },
})

// Pasadizo secreto · Favorable · Sin Prueba: mira las 3 de arriba del mazo del Templo y pon 1 al fondo.
registrarPeligro('pasadizo', {
  encuentros: { unico: { efecto: [{ tipo: 'mirarOrdenar', n: 3, fondo: 'una' }] } },
  // −1. Sin oposición: +0 en su lugar.
  destino: { modificador: (_s, p) => (p.comprometidos.length === 0 ? 0 : -1) },
})

// La losa giratoria · Leve · Se queda en juego.
registrarPeligro('losa', {
  encuentros: {
    unico: {
      // Al revelarse: el Tripulante preparado con más EXP queda al otro lado de la losa (no puede comprometerse
      // mientras esta carta esté en juego).
      alRevelarse: [{ tipo: 'aQuien', quien: { de: 'preparados', por: mas('EXP') }, hacer: { tipo: 'noCompromete', hasta: 'carta' } }],
      queda: {
        quitar: [],
        acciones: [{ texto: 'Agota a 2 Tripulantes (empujáis la losa): descarta esta carta', coste: [{ tipo: 'agotarVarios', n: 2 }], efectos: [{ tipo: 'descartarEsta' }] }],
      },
    },
  },
  destino: { siFallas: [pierdesAvance(1)], sinOposicion: [agotar(1)] },
})

// El guardián de jade · Terrible
registrarPeligro('guardian', {
  encuentros: {
    unico: {
      // Las Mejoras no suman. Si un comprometido lleva un Escapulario o un Amuleto, −2.
      prueba: { mejorasNoSuman: true },
      capacidades: [dificultad('amuletos', (ctx) => (participantesCtx(ctx).some((c) => lleva(ctx.s, c, 'escapulario', 'amuleto')) ? -2 : 0))],
      exito: [avance(1), robar(2)],
      fallo: [{ tipo: 'porCada', medida: 'faltan', efectos: [heridas(1)], maximo: 3 }],
    },
  },
  destino: { sinOposicion: [{ tipo: 'heridas', n: 2, capitan: true }] },
})

// ---------------------------------------------------------------------------
// Mazo de la Escolta (solo Mar)

// Galeón de la plata · Duro · Antes de comprometer, puedes gastar 1 munición: −2. Abordaje.
registrarPeligro('galeon', {
  encuentros: {
    unico: {
      elige: [
        { texto: 'Gastar 1 munición: la Prueba recibe −2', efectos: [{ tipo: 'perderMunicion', n: 1 }], prueba: true, modDificultad: -2, si: { tipo: 'municion', minimo: 1 } },
        { texto: 'Hacer la Prueba sin gastar munición', prueba: true },
      ],
      abordaje: true,
      exito: [robar(2), municion(1)],
    },
  },
  destino: { sinOposicion: [dano(1)] },
})

// Navío de escolta · Duro
registrarPeligro('escolta', {
  encuentros: {
    unico: {
      exito: [{ tipo: 'siguiente', mod: { de: 'encuentro', claves: ['Barco'], n: -1 } }],
      fallo: [dano(2)],
    },
  },
  // +1; +2 en su lugar si el encuentro es #Barco#. Sin oposición: el Barco queda Perseguido.
  destino: {
    modificador: (s) => (encuentroEs(s, 'Barco') ? 2 : 1),
    sinOposicion: [{ tipo: 'estadoBarco', estado: 'perseguido' }],
  },
})

// Fuego de cobertura · Leve · Se queda en juego: mientras esté, los Cañones no suman. Acción: Prueba de NAV 3.
registrarPeligro('cobertura', {
  encuentros: {
    unico: {
      queda: {
        quitar: [{ tipo: 'prueba', opciones: [{ hab: 'NAV', dificultad: 3 }] }],
        capacidades: [{ clave: 'sinCanones', ventana: 'constante', modifica: (_ctx, _yo, c) => (c.tipo === 'sinCanones' ? 1 : 0) }],
      },
    },
  },
  destino: { prueba: { sinCanones: true }, sinOposicion: [dano(1)] },
})

// Marineros del galeón hundido · Favorable
registrarPeligro('naufragos_g', {
  encuentros: {
    unico: {
      exito: [{ tipo: 'gratisDelMuelle', maxCoste: 2, que: 'tripulante', siNo: [robar(1)] }],
      fallo: [agotar(1)],
    },
  },
  // −1. Sin oposición: +0 en su lugar.
  destino: { modificador: (_s, p) => (p.comprometidos.length === 0 ? 0 : -1) },
})

// Mar gruesa · Leve
registrarPeligro('margruesa', {
  encuentros: { unico: { exito: [avance(1)], fallo: [dano(1), heridas(1)] } },
  destino: { sinOposicion: [dano(1)] },
})

// Cofres por la borda · Leve · Elige: os paráis a recogerla (robas 3 y pierdes 1 Avance) o Prueba de NAV 4.
registrarPeligro('cofres', {
  encuentros: {
    unico: {
      elige: [
        { texto: 'Pararos a recoger la plata (robas 3 y pierdes 1 Avance)', efectos: [robar(3), pierdesAvance(1)] },
        { texto: 'Seguir tras el galeón: Prueba de NAV 4', prueba: true },
      ],
      exito: [avance(2)],
      fallo: [agotar(1)],
    },
  },
  destino: { siSuperas: [robar(1)], sinOposicion: [descartar(1)] },
})

// ---------------------------------------------------------------------------
// La Armada te persigue (P51, rehecha por Albert): carta apartada que entra con «+ La Armada» y se queda en el mazo el
// resto de la partida. En la Flota III os da alcance y, después de resolverla, vuelve a apartarse.

registrarPeligro('armada', {
  encuentros: {
    // Los Cañones no suman. Éxito: +1 Avance. Fallo: Abordaje.
    mar: { prueba: { sinCanones: true }, abordaje: true, exito: [avance(1)] },
    // Éxito: +1 munición. Fallo: 2 heridas repartidas y el Barco queda Perseguido.
    nat: { exito: [municion(1)], fallo: [heridas(2), { tipo: 'estadoBarco', estado: 'perseguido' }] },
    // Éxito: +1 Avance. Fallo: el comprometido con más EXP queda rehén.
    ciu: { exito: [avance(1)], fallo: [comprometidoCon(mas('EXP'), { tipo: 'rehen' })] },
  },
  // +1; +2 en su lugar si el encuentro es #Militar# o #Guardia#. Sin oposición: el Barco queda Perseguido.
  destino: {
    modificador: (s) => (encuentroEs(s, 'Armada', 'Militar', 'Guardia') ? 2 : 1),
    sinOposicion: [{ tipo: 'estadoBarco', estado: 'perseguido' }],
  },
})
