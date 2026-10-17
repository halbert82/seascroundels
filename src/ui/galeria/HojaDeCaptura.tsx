// Todas las cartas a tamaño real sobre el fondo de la lámina original.
// La usa el script de capturas para compararlas con referencia/cartas.

import { CATALOGO } from '../../engine/catalogo.ts'
import { Carta } from '../cartas/Carta.tsx'
import { forzarTextoApretado } from '../cartas/ajustes.ts'

export function HojaDeCaptura() {
  forzarTextoApretado(window.location.hash.includes('apretado=todas'))
  return (
    <div
      style={{
        background: '#D9CBAE',
        display: 'flex',
        flexWrap: 'wrap',
        gap: 40,
        padding: 40,
        alignItems: 'flex-start',
      }}
    >
      {CATALOGO.map((entrada) => (
        <div key={entrada.num} data-captura={String(entrada.num).padStart(3, '0')} style={{ flex: 'none' }}>
          <Carta entrada={entrada} />
        </div>
      ))}
    </div>
  )
}
