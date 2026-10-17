// Capacidades de los Capitanes (salvo el +1 de Diego, que es constante) y de los Tripulantes.
// Los números se leen del texto de cada carta.

import { tipoDe } from '../catalogo.ts'
import { anotar, claveUso, copia, nombre } from '../estado.ts'
import { mazoActivo } from '../peligros.ts'
import { numeroConIcono, numerosEntreLlaves, primerNumero, textoDe } from '../textos.ts'
import type { Capacidad, CartaId } from '../tipos.ts'
import { valor } from '../valores.ts'
import { canonesSinCargar, destinoVigente, hayHeridos, participa, participantes, peligroRevelado } from './comun.ts'

const texto = (id: CartaId) => textoDe(id)

/** «Después de que superes una Prueba [de H] en la que participe X, gana N de Avance / roba N». */
function trasSuperar(carta: CartaId, hab: 'NAV' | 'EXP' | null, efecto: Capacidad['efecto']): Capacidad {
  return {
    clave: `${carta}.superar`,
    carta,
    ventana: 'respuesta',
    desde: 'juego',
    disparo: (s, yo, ev, fase) => fase === 'despues' && ev.tipo === 'superarPrueba' && participa(s, yo) && (hab === null || s.prueba?.hab === hab),
    efecto,
  }
}

export const CAPACIDADES_TRIPULANTES: Capacidad[] = [
  // Catalina: «Agotar: Este turno, el próximo Tripulante que reclutes cuesta 2 menos.»
  {
    clave: 'capitan2.agotar',
    carta: 'capitan2',
    ventana: 'libre',
    desde: 'juego',
    coste: [{ tipo: 'agotarse' }],
    requisito: (s) => !s.temporales.some((x) => x.clave === 'capitan2.descuento'),
    efecto: () => [{ tipo: 'anadirTemporal', temporal: { clave: 'capitan2.descuento', fuente: 'capitan2', hasta: 'finTurno' } }],
  },
  {
    clave: 'capitan2.descuento',
    carta: 'capitan2',
    ventana: 'constante',
    desde: 'temporal',
    modifica: (ctx, _yo, c) =>
      c.tipo === 'coste' && copia(ctx.s, c.carta).id !== 'capitan2' && tipoDe(copia(ctx.s, c.carta).id) === 'tripulante' ? -(numerosEntreLlaves(texto('capitan2'))[0] ?? 0) : 0,
  },

  // Grumete leal: «Interrupción: Cuando otro Tripulante vaya a sufrir heridas, descarta a Grumete leal para reducirlas a 0.»
  {
    clave: 'grumete.salvar',
    carta: 'grumete',
    ventana: 'interrupcion',
    desde: 'juego',
    coste: [{ tipo: 'descartarse' }],
    disparo: (s, yo, ev, fase) => fase === 'antes' && ev.tipo === 'heridas' && ev.cantidad > 0 && ev.objetivo !== yo && s.zonas.tripulacion.includes(ev.objetivo),
    efecto: (s, _yo, suceso) => {
      if (suceso?.ev.tipo === 'heridas') {
        suceso.cancelado = true
        anotar(s, 'efecto', `${nombre(s, suceso.ev.objetivo)} no sufre las heridas.`)
      }
      return []
    },
  },

  // Uñas largas: «Respuesta: Después de que superes una Prueba en la que participe Uñas largas, roba 1.»
  trasSuperar('saqueador', null, () => [{ tipo: 'robar', n: numeroConIcono(texto('saqueador'), 'robar') }]),
  // Contrabandista: «… una Prueba de NAV en la que participe …, gana 1 de Avance.»
  trasSuperar('contrabandista', 'NAV', () => [{ tipo: 'ganarAvance', n: numeroConIcono(texto('contrabandista'), 'avance'), motivo: 'Contrabandista del bajo Caribe' }]),
  // Rastreador de la selva: «… una Prueba de EXP en la que participe …, gana 1 de Avance.»
  trasSuperar('baqueano', 'EXP', () => [{ tipo: 'ganarAvance', n: numeroConIcono(texto('baqueano'), 'avance'), motivo: 'Rastreador de la selva' }]),

  // Filibustero borracho: «Sufre 1 herida: recibe +2 COM para esta Prueba. (Límite de una vez por turno.)»
  // Se ofrece durante una Prueba de COM (o antes de elegir opción) si participa o aún puede comprometerse.
  {
    clave: 'filibustero.furia',
    carta: 'filibustero',
    ventana: 'libre',
    desde: 'juego',
    limite: { veces: 1, por: 'turno' },
    coste: [{ tipo: 'herida', n: numeroConIcono(texto('filibustero'), 'herida') }],
    requisito: (s, yo) => {
      const p = s.prueba
      if (!p || p.automatica || !yo || s.temporales.some((x) => x.clave === 'filibustero.com' && x.inst === yo)) return false
      if (p.hab === null) return !copia(s, yo).agotada
      return p.hab === 'COM' && participa(s, yo)
    },
    efecto: (_s, yo) => (yo ? [{ tipo: 'anadirTemporal', temporal: { clave: 'filibustero.com', fuente: 'filibustero', hasta: 'finPrueba', inst: yo } }] : []),
  },
  {
    clave: 'filibustero.com',
    carta: 'filibustero',
    ventana: 'constante',
    desde: 'temporal',
    modifica: (_ctx, yo, c) => (c.tipo === 'habilidad' && c.hab === 'COM' && c.carta === yo ? numeroConIcono(texto('filibustero'), 'COM') : 0),
  },

  // Cañonero: «Agotar: Añade 1 munición a un Cañón.» (sin pasar de su máximo)
  {
    clave: 'canonero.municion',
    carta: 'canonero',
    ventana: 'libre',
    desde: 'juego',
    coste: [{ tipo: 'agotarse' }],
    requisito: (s) => canonesSinCargar(s).length > 0,
    efecto: () => [{ tipo: 'anadirMunicion', n: numeroConIcono(texto('canonero'), 'municion') }],
  },

  // Isabela: «Interrupción: Agotar: Cuando otro Tripulante vaya a quedar derrotado, en vez de eso reduce su Vida a 1.»
  // TODO(regla): «reduce su Vida a 1» = le queda 1 Vida (heridas = Vida − 1). Opción por defecto de CLAUDE.md.
  {
    clave: 'isabela.salvar',
    carta: 'isabela',
    ventana: 'interrupcion',
    desde: 'juego',
    coste: [{ tipo: 'agotarse' }],
    disparo: (s, yo, ev, fase) => fase === 'antes' && ev.tipo === 'derrota' && ev.carta !== yo && s.zonas.tripulacion.includes(ev.carta),
    efecto: (s, _yo, suceso) => {
      if (suceso?.ev.tipo === 'derrota') {
        suceso.cancelado = true
        const objetivo = suceso.ev.carta
        copia(s, objetivo).heridas = Math.max(0, valor(s, { tipo: 'vida', carta: objetivo }) - numeroConIcono(texto('isabela'), 'vida'))
        anotar(s, 'efecto', `${nombre(s, objetivo)} no queda derrotado: se queda con ${numeroConIcono(texto('isabela'), 'vida')} de Vida.`)
      }
      return []
    },
  },

  // Íñigo: «Respuesta: Agotar: Después de que reveles una carta de Peligro, descártala sin resolverla y revela otra.»
  {
    clave: 'bartolome.descartar',
    carta: 'bartolome',
    ventana: 'respuesta',
    desde: 'juego',
    coste: [{ tipo: 'agotarse' }],
    disparo: (s, _yo, ev, fase) => fase === 'despues' && peligroRevelado(s, ev),
    efecto: () => [{ tipo: 'quitarEncuentro', modo: 'descartar', avance: false }],
  },

  // Rodrigo: «Puedes comprometer a Rodrigo en una Prueba de COM sin agotarlo. (Límite de una vez por turno.)»
  // Se aplica solo: no agotarse nunca es peor.
  {
    clave: 'reinaldo.sinAgotar',
    carta: 'reinaldo',
    ventana: 'constante',
    desde: 'juego',
    modifica: (ctx, yo, c) =>
      c.tipo === 'sinAgotarAlComprometer' && c.carta === yo && c.hab === 'COM' && (ctx.s.usos[claveUso('turno', yo, 'reinaldo.sinAgotar')] ?? 0) < 1 ? 1 : 0,
  },

  // Carpintero de a bordo: «Agotar: Repara 1 daño.»
  {
    clave: 'carpintero.reparar',
    carta: 'carpintero',
    ventana: 'libre',
    desde: 'juego',
    coste: [{ tipo: 'agotarse' }],
    requisito: (s) => s.danoBarco > 0,
    efecto: () => [{ tipo: 'reparar', n: numeroConIcono(texto('carpintero'), 'dano') }],
  },

  // Matasanos: «Agotar: Cura 2 heridas a un Tripulante.»
  {
    clave: 'matasanos.curar',
    carta: 'matasanos',
    ventana: 'libre',
    desde: 'juego',
    coste: [{ tipo: 'agotarse' }],
    requisito: hayHeridos,
    efecto: () => [{ tipo: 'curar', n: numeroConIcono(texto('matasanos'), 'herida'), modo: 'uno' }],
  },

  // Espadachín errante: «Si es el único Tripulante que participa en una Prueba, recibe +2 COM.» (en vivo)
  {
    clave: 'espadachin.solo',
    carta: 'espadachin',
    ventana: 'constante',
    desde: 'juego',
    modifica: (ctx, yo, c) => {
      if (c.tipo !== 'habilidad' || c.hab !== 'COM' || c.carta !== yo) return 0
      const quienes = ctx.participantes ?? participantes(ctx.s)
      return quienes.length === 1 && quienes[0] === yo ? numeroConIcono(texto('espadachin'), 'COM') : 0
    },
  },

  // Vigía inexperta: «Agotar: Otea 1.»
  {
    clave: 'vigia.otear',
    carta: 'vigia',
    ventana: 'libre',
    desde: 'juego',
    coste: [{ tipo: 'agotarse' }],
    requisito: (s) => s.zonas[mazoActivo(s).mazo].length + s.zonas[mazoActivo(s).descartes].length > 0,
    efecto: () => [{ tipo: 'otear', n: primerNumero(texto('vigia')), cartas: [], arriba: [], fondo: [] }],
  },

  // Viejo lobo de mar: «Respuesta: Después de que se revele el Destino de una Prueba en la que participe,
  // descarta ese Destino y revela otro. (Límite de una vez por turno.)»
  {
    clave: 'viejo_lobo.destino',
    carta: 'viejo_lobo',
    ventana: 'respuesta',
    desde: 'juego',
    limite: { veces: 1, por: 'turno' },
    disparo: (s, yo, ev, fase) => fase === 'despues' && destinoVigente(s, ev) && participa(s, yo),
    efecto: () => [{ tipo: 'cambiarDestino', modo: 'otro' }],
  },

  // Loro parlanchín: «Respuesta: Después de que se revele el Destino de una Prueba, compromete a Loro parlanchín en ella.»
  // Puede unirse aunque nadie se haya comprometido (confirmado por Albert con N14).
  {
    clave: 'loro.unirse',
    carta: 'loro',
    ventana: 'respuesta',
    desde: 'juego',
    disparo: (s, yo, ev, fase) =>
      fase === 'despues' &&
      ev.tipo === 'revelarDestino' &&
      s.prueba?.destino === ev.carta &&
      yo !== null &&
      !copia(s, yo).agotada &&
      !s.prueba.comprometidos.includes(yo),
    efecto: (_s, yo) => (yo ? [{ tipo: 'comprometerUno', carta: yo }] : []),
  },
]
