// Mazo de historia (fase 10, como el de Arkham Horror 3.ª edición): las cartas que no empiezan en ningún mazo llevan su
// número bien visible en el anverso y, en el dorso, el dorso del mazo al que van, con el mismo número. Se buscan por él
// («Pon la carta 137 encima del mazo de Misiones»).

import { esDelNaufragio, type EntradaCatalogo } from '../../engine/catalogo.ts'

/** El dorso del mazo al que va una carta del mazo de historia. */
export type DorsoHistoria = 'misiones' | 'muelle' | 'peligros'

/**
 * Si la carta empieza en el mazo de historia, el dorso del mazo al que va: los capítulos II y III, al de Misiones; los
 * Tesoros, al de muelle (son Mejoras); los mazos propios y «La Armada te persigue», al de Peligros. Los Pasajeros y
 * las permanentes no van a ningún mazo: llevan el dorso de misión, porque salen durante las misiones.
 */
export function dorsoDeHistoria(e: EntradaCatalogo): DorsoHistoria | null {
  switch (e.tipo) {
    case 'capitulo':
      return e.carta.capitulo === 'I' ? null : 'misiones'
    case 'tesoro':
      // Fase 15 (P106, Albert): los Tesoros 270 y 271 van en el mazo del naufragio, con el mismo dorso que las demás (el de
      // misión): si llevaran el de muelle, se sabría cuándo toca un Tesoro.
      return esDelNaufragio(e.id) ? 'misiones' : 'muelle'
    // Fase 15: la culebrina del naufragio es una Mejora de barco, pero del mazo del naufragio: el mismo dorso de misión.
    case 'mejoraBarco':
      return e.carta.mision ? 'misiones' : null
    case 'mazoPropio':
      return 'peligros'
    case 'peligro':
      return e.carta.entraDuranteLaPartida && !e.carta.retirada ? 'peligros' : null
    case 'pasajero':
    // Fase 15: las cartas del mazo del naufragio salen al superar su misión: dorso de misión.
    case 'naufragio':
    // Fase 11: las permanentes (también «¡La guardia!») no van a ningún mazo (van a la zona de permanentes): dorso de
    // misión, pila normal.
    case 'permanente':
      return 'misiones'
    default:
      return null
  }
}
