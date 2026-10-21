// Misiones 2.0 · las travesías (fase 12: de 2 a 4 capítulos) y sus capítulos con salida doble.

import { anotar, copia } from '../estado.ts'
import { ponerEstado } from '../estados.ts'
import { mazoActivo } from '../peligros.ts'
import { registrarCodigo } from '../tareas/efectos.ts'
import type { Efecto } from '../efectos.ts'
import type { NuevaTarea } from '../tipos.ts'
import { mover } from '../zonas.ts'
import {
  alFallarPrueba,
  alResolverSinPrueba,
  alRevelarPeligro,
  alSuperarPrueba,
  avancePrueba,
  bajarPasajero,
  dificultadClaves,
  dificultadHabilidad,
  fallaLaMision,
  fichas,
  hasFallado,
  hasFalladoEncuentro,
  hasSuperado,
  ponerFichas,
  ponerPasajero,
  registrarMision,
  viajaContigo,
} from './comun.ts'
import { alarma } from './sueltas.ts'

const avance = (n: number): Efecto => ({ tipo: 'ganarAvance', n })
const robar = (n: number): NuevaTarea => ({ tipo: 'robar', n })
const mezclar = (n: number): NuevaTarea => ({ tipo: 'mezclarMazoPropio', n })

// ---------------------------------------------------------------------------
// El templo perdido · Media, 4 capítulos (fase 12: 1 / 2 / 2 / 2 o 3)

/** «Rumbo a la isla»: habéis avistado la isla (agotando a un Vigía o a un Piloto). */
const ISLA = 'templo-I.isla'
const avistada = (s: Parameters<typeof hasSuperado>[0]) => s.mision?.hecho?.includes(ISLA) ?? false

registrarMision('templo-I', {
  // No se supera hasta superar una Prueba de NAV o de EXP en ella, o hasta avistar la isla (cambio de diseño de Albert).
  impideSuperar: (s) => (hasSuperado(s, 'NAV', 'EXP') || avistada(s) ? null : 'No puedes superarla hasta superar una Prueba de NAV o de EXP, o avistar la isla'),
  alZarpar: () => [{ tipo: 'alZarparOpcional', coste: { tipo: 'agotarRasgo', rasgos: ['Oficial'] }, efectos: [avance(2)], texto: 'Agotar a un Oficial para ganar 2 de Avance' }],
  capacidades: [
    {
      // Acción durante la misión: agota a un Vigía o a un Piloto (avistáis la isla).
      clave: 'isla',
      ventana: 'accion',
      texto: 'Agota a un Vigía o a un Piloto: avistáis la isla (ya podéis superar la misión)',
      coste: [{ tipo: 'agotarTripulante', rasgo: null, rasgos: ['Vigía', 'Piloto'] }],
      requisito: (s) => !avistada(s) && !hasSuperado(s, 'NAV', 'EXP'),
      efecto: (s) => {
        if (s.mision) s.mision.hecho = [...(s.mision.hecho ?? []), ISLA]
        anotar(s, 'efecto', 'Avistáis la isla: ya podéis superar la misión.')
        return []
      },
    },
  ],
})

registrarMision('templo-II', {
  sinRetirada: true,
  capacidades: [avancePrueba('calzada', 'EXP', 1, 2)],
})

// Fase 12: «La escalinata de los sacerdotes» (carta 239). Cada Prueba de EXP fallada, 1 ficha de Derrumbe; cada una
// superada por 2 o más, quita 1. Con 3, la escalera cede: la misión falla. (Una Prueba sin nadie asignado se falla:
// también pone ficha, como «cada Prueba que falles» en las demás misiones.)
registrarMision('templo-III', {
  fichas: [{ ficha: 'derrumbe', nombre: 'Derrumbe', umbral: 3, inicial: 0, nota: 'Con 3, la escalera cede y la misión falla.' }],
  capacidades: [
    alFallarPrueba('derrumbe', (_s, p) => (p.hab === 'EXP' ? [ponerFichas('derrumbe', 1)] : [])),
    alSuperarPrueba('apoyo', (_s, p) => (p.hab === 'EXP' && p.margen >= 2 ? [ponerFichas('derrumbe', -1)] : [])),
  ],
  alCambiarFichas: (s, _f, antes, ahora) => {
    if (antes < 3 && ahora >= 3) fallaLaMision(s, 'la escalera cede')
    return []
  },
})

// «El templo» (carta 120): el capítulo IV desde la fase 12 (antes, el III).
registrarMision('templo-IV', {
  alZarpar: () => [mezclar(6)],
  // La Espada del sacerdote: el Tesoro y 2 de reputación, pero tu Capitán queda Maldito.
  alElegir: (s, clave) => {
    if (clave === 'espada' && s.zonas.tripulacion.includes(s.capitan) && ponerEstado(s, s.capitan, 'maldito')) {
      anotar(s, 'aviso', 'Tu Capitán queda Maldito.')
    }
    return []
  },
})

// ---------------------------------------------------------------------------
// La Flota de la Plata · Difícil, 4 capítulos (fase 12: 1 / 2 / 2 / 4)

registrarMision('flota-I', {
  capacidades: [dificultadClaves('tormenta', ['Tormenta'], 1)],
  alZarpar: () => [
    { tipo: 'alZarparOpcional', coste: { tipo: 'agotarRasgo', rasgos: ['Piloto', 'Marinero'] }, efectos: [avance(2)], texto: 'Agotar a un Piloto o a un Marinero para ganar 2 de Avance' },
  ],
})

registrarMision('flota-II', {
  alZarpar: () => [mezclar(6)],
  capacidades: [alSuperarPrueba('bodega', (_s, p) => (p.hab === 'COM' ? [robar(1)] : []))],
})

// Fase 12: «Al abordaje del galeón» (carta 238). Los Cañones no suman (estáis pegados a su casco); cada Prueba de COM
// que superes por 2 o más da 1 de Avance más.
registrarMision('flota-III', {
  capacidades: [{ clave: 'casco', ventana: 'constante', modifica: (_ctx, _yo, c) => (c.tipo === 'sinCanones' ? 1 : 0) }, avancePrueba('cubierta', 'COM', 1, 2)],
})

// «La huida con la plata» (carta 128): el capítulo IV desde la fase 12 (antes, el III).
registrarMision('flota-IV', {
  fichas: [{ ficha: 'persecucion', nombre: 'Persecución', umbral: 3, inicial: 1, nota: 'Con 3 os dan alcance: La Armada te persigue será tu siguiente encuentro.' }],
  alZarpar: () => [ponerFichas('persecucion', 1)],
  capacidades: [
    alFallarPrueba('falloNav', (_s, p) => (p.hab === 'NAV' ? [ponerFichas('persecucion', 1)] : [])),
    alResolverSinPrueba('sinPrueba', () => [ponerFichas('persecucion', 1)]),
    alSuperarPrueba('ventajaNav', (_s, p) => (p.hab === 'NAV' && p.margen >= 2 ? [ponerFichas('persecucion', -1)] : [])),
  ],
  alCambiarFichas: (_s, _f, antes, ahora) => (antes < 3 && ahora >= 3 ? [{ tipo: 'aplicarEfectos', efectos: [{ tipo: 'codigo', clave: 'mision.alcance' }], contexto: 'efecto' }] : []),
})

// Os dan alcance: «La Armada te persigue» se pone encima del mazo de Peligros (será el siguiente encuentro) y la
// Persecución vuelve a 1. Después de resolverla, vuelve a apartarse.
// P53 (confirmada): si La Armada ya estaba en el mazo de Peligros (la metió El cazador de piratas), se saca de ahí
// y después de resolverla también se aparta.
registrarCodigo('mision.alcance', (s) => {
  const m = s.mision
  if (!m) return []
  const armada = [...s.zonas.mazoHistoria, ...s.zonas.apartados, ...s.zonas.mazoPeligros, ...s.zonas.descartesPeligros, ...s.zonas.mazoMision, ...s.zonas.descartesMision].find(
    (c) => copia(s, c).id === 'armada',
  )
  m.fichas = { ...m.fichas, persecucion: 1 }
  if (!armada) {
    anotar(s, 'aviso', 'Os dan alcance, pero La Armada ya está en juego. La Persecución vuelve a 1.')
    return []
  }
  mover(s, armada, mazoActivo(s).mazo, 'arriba')
  s.persigue = armada
  m.alApartar = armada
  anotar(s, 'aviso', 'Os dan alcance: «La Armada te persigue» será tu siguiente encuentro. La Persecución vuelve a 1.')
  return []
})

// ---------------------------------------------------------------------------
// El espía de Cádiz · Fácil, 2 capítulos (fase 12: 1 / 3)

// Fase 12: «Seguirle por Port Royal» (carta 135) une «Un soplo en Port Royal» y «Seguirle por los muelles»: el soplo
// de pago al zarpar y la Sospecha. Ya no da 1 de Avance más por los encuentros #Civil#.
registrarMision('espia-I', {
  alZarpar: () => [
    {
      tipo: 'alZarparOpcional',
      coste: { tipo: 'descartar', n: 2 },
      // Fase 13 (I7): «Puedes descartar 2 cartas. Si lo haces, Otea 3.»
      efectos: [{ tipo: 'mirarOrdenar', n: 3, fondo: 'libre' }],
      texto: 'Descartar 2 cartas para otear 3',
    },
  ],
  fichas: [{ ficha: 'sospecha', nombre: 'Sospecha', umbral: 3, inicial: 0, nota: 'Con 3, el espía te descubre y la misión falla.' }],
  capacidades: [
    alSuperarPrueba('com', (_s, p) => (p.hab === 'COM' ? [ponerFichas('sospecha', 1)] : [])),
    // P55 (confirmada): una Prueba sin nadie comprometido no cuenta como «fallar por 2 o más» (lo dice el ejemplo:
    // «mejor dejarla sin oposición y sufrir su castigo que superarla»).
    alFallarPrueba('porDos', (_s, p) => (p.margen <= -2 && !p.nadie ? [ponerFichas('sospecha', 1)] : [])),
  ],
  alCambiarFichas: (s, _f, antes, ahora) => {
    if (antes < 3 && ahora >= 3) fallaLaMision(s, 'el espía te descubre')
    return []
  },
})

// «La goleta del correo» (carta 137): el capítulo II desde la fase 12 (antes, el III).
registrarMision('espia-II', {
  conTesoro: (s) => !hasFallado(s, 'COM'),
  capacidades: [avancePrueba('nav', 'NAV', 1)],
})

// ---------------------------------------------------------------------------
// El cargamento de Maracaibo · Fácil (1 / 2 / 3). Don Anselmo viaja con vosotros.

/** «Si fallas una misión de esta travesía, Don Anselmo se baja asustado.» */
const anselmoSeBaja = () => [bajarPasajero('anselmo', 'se baja asustado')]

registrarMision('maracaibo-I', {
  // P56 (confirmada): si Don Anselmo se bajó, vuelve a subir cada vez que zarpas a esta misión.
  alZarpar: () => [ponerPasajero('anselmo')],
  // Salida doble: con un Buscado o un encuentro #Guardia# fallado, los guardacostas te esperan (II-b, carta 140).
  siguiente: (s) => ((s.mision?.buscados ?? 0) > 0 || hasFalladoEncuentro(s, 'Guardia') ? 140 : 218),
  alNoSuperar: anselmoSeBaja,
})

registrarMision('maracaibo-II-a', {
  capacidades: [dificultadHabilidad('sinLuces', 'NAV', -1), dificultadClaves('militar', ['Armada', 'Militar'], 2)],
  gesta: (s) => !hasSuperado(s, 'COM'),
  alNoSuperar: anselmoSeBaja,
})

registrarMision('maracaibo-II-b', {
  capacidades: [dificultadClaves('militar', ['Armada', 'Militar'], 1), avancePrueba('com', 'COM', 1)],
  alNoSuperar: anselmoSeBaja,
})

registrarMision('maracaibo-III', {
  alZarpar: () => [{ tipo: 'ganarAvance', n: 2, si: { rasgo: 'Contrabandista' } }],
  // Sin Don Anselmo no hay Tesoro; con él, se baja y paga: robas 2 y se descarta.
  conTesoro: (s) => viajaContigo(s, 'anselmo'),
  alSuperar: (s) => (viajaContigo(s, 'anselmo') ? [robar(2), bajarPasajero('anselmo', 'se baja y paga')] : []),
  alNoSuperar: anselmoSeBaja,
})

// ---------------------------------------------------------------------------
// La fortaleza de San Felipe · Difícil (2 / 3 / 5)

registrarMision('sanfelipe-I', {
  capacidades: [dificultadHabilidad('disparo', 'COM', 1), dificultadHabilidad('noche', 'EXP', -1)],
  // Salida doble: sin superar ninguna Prueba de COM, entráis sin que os vean (II-a, carta 219).
  siguiente: (s) => (hasSuperado(s, 'COM') ? 144 : 219),
})

registrarMision('sanfelipe-II-a', alarma())

registrarMision('sanfelipe-II-b', {
  capacidades: [
    dificultadClaves('murallas', ['Militar', 'Guardia'], 1),
    // Si fallas una Prueba de COM, cada Tripulante comprometido sufre además 1 herida.
    alFallarPrueba('escala', (_s, p) => (p.hab === 'COM' ? [{ tipo: 'aQuien', quien: { de: 'comprometidos', cada: true }, hacer: { tipo: 'heridas', n: 1 } }] : [])),
  ],
})

registrarMision('sanfelipe-III', {
  fichas: [
    {
      ficha: 'mecha',
      nombre: 'Mecha',
      umbral: 4,
      inicial: 0,
      nota: 'Con 4, después de resolver ese Peligro, si no has superado la misión, el polvorín estalla: 2 heridas repartidas y te retiras.',
    },
  ],
  capacidades: [
    alRevelarPeligro('mecha', () => [ponerFichas('mecha', 1)]),
    // P52 (respondida): el cuarto Peligro se resuelve entero (da su Avance); si después no has superado la misión,
    // el polvorín estalla.
    {
      clave: 'estalla',
      ventana: 'obligada',
      disparo: (s, _yo, ev, fase) => fase === 'despues' && ev.tipo === 'cartaResuelta' && fichas(s, 'mecha') >= 4 && s.mision !== null && !s.mision.fin,
      efecto: (s) => {
        fallaLaMision(s, 'el polvorín estalla')
        return [{ tipo: 'repartirHeridas', n: 2, entre: [...s.zonas.tripulacion] }]
      },
    },
  ],
  // Vuelas el polvorín: el Barco queda Perseguido.
  alElegir: (_s, clave) => (clave === 'polvorin' ? [{ tipo: 'ponerEstadoBarco', estado: 'perseguido' }] : []),
})

// ---------------------------------------------------------------------------
// El barco fantasma · Media, 2 capítulos (fase 12: 1 / 3 o 4)

// Fase 12: «A bordo del fantasma» (carta 147) une «Niebla en el estrecho» y «A bordo del fantasma»: los Cañones no
// suman y el Barco no sufre daño. Sin los dos modificadores de los encuentros #Sobrenatural# (se anulaban).
registrarMision('fantasma-I', {
  capacidades: [
    { clave: 'niebla', ventana: 'constante', modifica: (_ctx, _yo, c) => (c.tipo === 'sinCanones' ? 1 : 0) },
    {
      // El Barco no sufre daño: cada daño que fuera a sufrir es, en su lugar, 1 herida a un Tripulante que elijas.
      clave: 'aBordo',
      ventana: 'obligada',
      disparo: (_s, _yo, ev, fase) => fase === 'antes' && ev.tipo === 'danoBarco' && ev.cantidad > 0,
      efecto: (s, _yo, suceso) => {
        if (!suceso || suceso.cancelado || suceso.ev.tipo !== 'danoBarco') return []
        suceso.cancelado = true
        const n = suceso.ev.cantidad
        anotar(s, 'efecto', `Estáis a bordo del fantasma: en vez de ${n} de daño al Barco, ${n === 1 ? '1 herida' : `${n} heridas`} a quien elijas.`)
        return Array.from({ length: n }, (): NuevaTarea => ({ tipo: 'herirUno', n: 1, entre: [...s.zonas.tripulacion] }))
      },
    },
  ],
})

// «El camarote del capitán» (carta 149): el capítulo II desde la fase 12 (antes, el III).
registrarMision('fantasma-II', {
  primeraSinAyuda: true,
  gesta: (s) => !hasSuperado(s, 'COM'),
  // Le devuelves su bitácora: quita Maldito de todos tus Tripulantes.
  alElegir: (_s, clave) => (clave === 'bitacora' ? [{ tipo: 'quitarEstado', estado: 'maldito', de: 'todos' }] : []),
})

// ---------------------------------------------------------------------------
// El saqueo de Panamá · Victoria (2 / 3 / victoria)

registrarMision('panama-I', {
  capacidades: [dificultadClaves('guardia', ['Guardia'], 1)],
})

registrarMision('panama-II', {
  sinRetirada: true,
  distancia: (s, impresa) => (viajaContigo(s, 'guia') ? 0 : impresa),
  capacidades: [dificultadHabilidad('sinGuia', 'EXP', 1, (s) => !viajaContigo(s, 'guia'))],
})

registrarMision('panama-III', {
  // Fase 11 (P66): 6 de reputación para zarpar (antes 9, cuando se ganaba con 18).
  reputacionMinima: 6,
  fichas: [{ ficha: 'defensa', nombre: 'Defensa', umbral: 0, inicial: 3, nota: 'Cada Prueba de COM que superes quita 1. No puedes superar la misión mientras quede alguna.' }],
  alZarpar: () => [ponerFichas('defensa', 3)],
  capacidades: [alSuperarPrueba('asalto', (_s, p) => (p.hab === 'COM' ? [ponerFichas('defensa', -1)] : []))],
  impideSuperar: (s) => (fichas(s, 'defensa') > 0 ? 'Quedan fichas de Defensa' : null),
})
