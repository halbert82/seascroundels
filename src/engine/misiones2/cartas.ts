// Misiones 2.0 · las cartas de misión apartadas: los Pasajeros (Don Anselmo y El guía del istmo) y «¡La guardia!».

import { registrarCapacidades } from '../capacidades/index.ts'
import { entornoActual } from '../peligros.ts'
import type { Capacidad, Consulta, Estado, InstId } from '../tipos.ts'
import { bajarPasajero, ultimaPrueba } from './comun.ts'

/** Capacidades de una carta que funcionan mientras está en su zona (Pasajeros, cartas junto a la misión). */
function enSuZona(desde: 'pasajero' | 'cartaMision', zona: 'pasajeros' | 'cartasMision', carta: string, caps: Omit<Capacidad, 'carta' | 'desde'>[]): Capacidad[] {
  const activa = (s: Estado, yo: InstId | null) => yo !== null && s.zonas[zona].includes(yo)
  return caps.map((c) => {
    const cap: Capacidad = { ...c, clave: `${carta}.${c.clave}`, carta, desde }
    const { modifica, disparo, requisito } = c
    if (modifica) cap.modifica = (ctx, yo, q) => (activa(ctx.s, yo) ? modifica(ctx, yo, q) : 0)
    if (disparo) cap.disparo = (s, yo, ev, fase) => activa(s, yo) && disparo(s, yo, ev, fase)
    cap.requisito = (s, yo) => activa(s, yo) && (!requisito || requisito(s, yo))
    return cap
  })
}

// ---------------------------------------------------------------------------
// Don Anselmo, el comerciante: los encuentros #Guardia# y #Civil# reciben −1.
// (Se baja si fallas una misión de su travesía o si el Barco se hunde: lo hacen esas reglas.)

registrarCapacidades(
  ...enSuZona('pasajero', 'pasajeros', 'anselmo', [
    {
      clave: 'papeles',
      ventana: 'constante',
      modifica: (_ctx, _yo, c: Consulta) => (c.tipo === 'dificultad' && c.claves.some((k) => k === 'Guardia' || k === 'Civil') ? -1 : 0),
    },
  ]),
)

// ---------------------------------------------------------------------------
// El guía del istmo: las Pruebas de EXP en Naturaleza reciben −1. Si fallas una Prueba de EXP, se marcha.

registrarCapacidades(
  ...enSuZona('pasajero', 'pasajeros', 'guia', [
    {
      clave: 'camino',
      ventana: 'constante',
      modifica: (ctx, _yo, c: Consulta) => (c.tipo === 'dificultad' && c.hab === 'EXP' && entornoActual(ctx.s) === 'nat' ? -1 : 0),
    },
    {
      clave: 'seMarcha',
      ventana: 'obligada',
      disparo: (s, _yo, ev, fase) => fase === 'despues' && ev.tipo === 'fallarPrueba' && (s.prueba?.hab ?? ultimaPrueba(s)?.hab) === 'EXP',
      efecto: () => [bajarPasajero('guia', 'se marcha por su cuenta')],
    },
  ]),
)

// ---------------------------------------------------------------------------
// ¡La guardia!: mientras esté, todas las Pruebas reciben +1. Acción: Prueba de COM 5, o agota a 2 Tripulantes:
// descarta esta carta (vuelve a apartarse). Al terminar la misión, también vuelve a apartarse.

registrarCapacidades(
  ...enSuZona('cartaMision', 'cartasMision', 'guardia', [
    // TODO(regla): P54 · el +1 de «¡La guardia!» también se aplica a su propia Prueba de COM 5 (queda en 6).
    { clave: 'todas', ventana: 'constante', modifica: (_ctx, _yo, c: Consulta) => (c.tipo === 'dificultad' ? 1 : 0) },
    {
      clave: 'palos',
      ventana: 'accion',
      texto: 'Haz una Prueba de COM 5 (los echáis a palos): si la superas, descarta ¡La guardia!',
      requisito: (s) => s.prueba === null,
      efecto: (_s, yo) =>
        yo
          ? [
              {
                tipo: 'pruebaSuelta',
                fuente: yo,
                paso: 'empezar',
                definicion: {
                  nombre: 'Echar a la guardia a palos',
                  palabrasClave: [],
                  opciones: [{ hab: 'COM', dificultad: 5 }],
                  exito: [{ tipo: 'codigo', clave: 'guardia.descartar' }],
                  fallo: [],
                },
              },
            ]
          : [],
    },
    {
      clave: 'tejados',
      ventana: 'accion',
      texto: 'Agota a 2 Tripulantes (os escabullís por los tejados): descarta ¡La guardia!',
      coste: [{ tipo: 'agotarVarios', n: 2 }],
      efecto: (_s, yo) => (yo ? [{ tipo: 'aplicarEfectos', efectos: [{ tipo: 'codigo', clave: 'guardia.descartar' }], contexto: 'efecto', fuente: yo }] : []),
    },
  ]),
)
