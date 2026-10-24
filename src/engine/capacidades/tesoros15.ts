// Capacidades de los Tesoros de la fase 15 (el Gallardete de San Juan, la Carta de marear de van Hoorn, La campana del San
// José y El doblón de la calavera) y de La culebrina del San José, la Mejora del mazo del naufragio. Los números se leen
// de su texto.

import { porId } from '../catalogo.ts'
import type { Habilidad } from '../datos.ts'
import { anotar, copia, nombre } from '../estado.ts'
import { ponerEstado } from '../estados.ts'
import { mazoActivo } from '../peligros.ts'
import { numeroConIcono, numerosEntreLlaves, primerNumero, textoDe } from '../textos.ts'
import type { Capacidad, Estado } from '../tipos.ts'
import { valor } from '../valores.ts'
import { enEntorno, participantes } from './comun.ts'

/** Prueba en curso de una de esas habilidades, ya comprometida y con alguien que participa (como los demás Cañones). */
function pruebaCon(s: Estado, habs: Habilidad[]): boolean {
  const p = s.prueba
  return p !== null && !p.automatica && p.hab !== null && habs.includes(p.hab) && participantes(s).length > 0
}

export const CAPACIDADES_TESOROS15: Capacidad[] = [
  // Gallardete de San Juan (148): «Indestructible. +1 Mando.»
  {
    clave: 'gallardete.mando',
    carta: 'gallardete',
    ventana: 'constante',
    desde: 'juego',
    modifica: (_ctx, _yo, c) => (c.tipo === 'mando' ? numeroConIcono(textoDe('gallardete'), 'MAN') : 0),
  },
  // Carta de marear de van Hoorn (263): «Indestructible. Tus misiones [mar] necesitan {−1 avance}.»
  {
    clave: 'carta_marear.avance',
    carta: 'carta_marear',
    ventana: 'constante',
    desde: 'juego',
    modifica: (ctx, _yo, c) => {
      if (c.tipo !== 'avanceNecesario') return 0
      const e = porId(copia(ctx.s, c.mision).id)
      return e.tipo === 'capitulo' && e.carta.entorno === 'mar' ? numeroConIcono(textoDe('carta_marear'), 'avance') : 0
    },
  },
  // La campana del San José (270, del mazo del naufragio): «Pon esta carta en juego. Indestructible. Al zarpar: [mar]:
  // Otea 2.» Se aplica sola, como los Despachos del Rey.
  {
    clave: 'campana_sanjose.otear',
    carta: 'campana_sanjose',
    ventana: 'alZarpar',
    desde: 'juego',
    requisito: (s) => enEntorno(s, 'mar') && s.zonas[mazoActivo(s).mazo].length + s.zonas[mazoActivo(s).descartes].length > 0,
    efecto: () => [{ tipo: 'otear', n: primerNumero(textoDe('campana_sanjose').split('Otea')[1] ?? ''), cartas: [], arriba: [], fondo: [] }],
  },
  // La culebrina del San José (278, Mejora de barco del mazo del naufragio, Cañón): «[mar], [agotar]: Una Prueba de [COM]
  // o de [NAV] recibe +2.» Es fuego de Cañón: en un Abordaje no se usa y «Los Cañones no suman» lo anula.
  {
    clave: 'culebrina_sanjose.disparar',
    carta: 'culebrina_sanjose',
    ventana: 'libre',
    desde: 'juego',
    coste: [{ tipo: 'agotarse' }],
    requisito: (s) => enEntorno(s, 'mar') && pruebaCon(s, ['COM', 'NAV']),
    efecto: (s) => {
      if (!s.prueba) return []
      const n = numerosEntreLlaves(textoDe('culebrina_sanjose'))[0] ?? 0
      s.prueba.bonos.push({ n, canon: true, fuente: 'culebrina_sanjose' })
      anotar(s, 'efecto', `La Prueba recibe +${n}.`)
      return []
    },
  },
  // El doblón de la calavera (271, del mazo del naufragio): «Pon esta carta en juego. Indestructible. No puedes descartar
  // esta carta. Tu Capitán no puede quedar derrotado: cuando vaya a quedar derrotado, queda con {1 vida} restante. Tu
  // Capitán queda Maldito, y este Estado no se le puede quitar.» Todo se aplica solo. Que el Maldito no se quite lo mira
  // `sePuedeQuitar` (estados.ts); que no se pueda descartar, que es Tesoro (indestructible). Ya no da reputación.
  {
    clave: 'doblon.entrar',
    carta: 'doblon',
    ventana: 'obligada',
    desde: 'juego',
    disparo: (_s, yo, ev, fase) => fase === 'despues' && ev.tipo === 'entraEnJuego' && ev.carta === yo,
    efecto: (s) => {
      if (ponerEstado(s, s.capitan, 'maldito')) anotar(s, 'aviso', `${nombre(s, s.capitan)} queda Maldito por el doblón de la calavera: este Estado no se le puede quitar.`)
      else anotar(s, 'aviso', `${nombre(s, s.capitan)} ya estaba Maldito: mientras tengas el doblón de la calavera, no se le puede quitar.`)
      return []
    },
  },
  {
    clave: 'doblon.salvar',
    carta: 'doblon',
    ventana: 'obligada',
    desde: 'juego',
    disparo: (s, _yo, ev, fase) => fase === 'antes' && ev.tipo === 'derrota' && ev.carta === s.capitan,
    efecto: (s, _yo, suceso) => {
      if (suceso?.ev.tipo === 'derrota') {
        suceso.cancelado = true
        const vida = numeroConIcono(textoDe('doblon'), 'vida')
        copia(s, s.capitan).heridas = Math.max(0, valor(s, { tipo: 'vida', carta: s.capitan }) - vida)
        anotar(s, 'aviso', `El doblón de la calavera: ${nombre(s, s.capitan)} no queda derrotado, se queda con ${vida} de Vida.`)
      }
      return []
    },
  },
]
