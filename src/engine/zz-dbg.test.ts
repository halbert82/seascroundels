import { it } from 'vitest'
import { responder } from './motor.ts'
import { nuevaPartida } from './preparacion.ts'
import { jugadorConCriterio } from './pruebas/jugadores.ts'
it('dbg', { timeout: 300_000 }, () => {
  const j = jugadorConCriterio()
  const cuenta: Record<string, number> = {}
  let mostrado = 0
  for (let semilla = 1; semilla <= 40; semilla++) {
    let s = nuevaPartida({ semilla })
    const hist: string[] = []
    for (let n = 0; !s.resultado && n < 8000; n++) {
      s = responder(s, j(s, s.pendiente!))
      for (const r of s.registro) {
        hist.push(r.texto)
        if (r.dato?.tipo === 'revelado' && r.dato.como === 'destino') {
          const id = s.cartas[r.dato.inst]!.id
          cuenta[id] = (cuenta[id] ?? 0) + 1
          if ((id === 'p2_armada' || id === 'p2_bastian') && mostrado < 3 && (cuenta[id] ?? 0) > 3) {
            mostrado++
            console.log('----', semilla, '\n' + hist.slice(-14).join('\n'))
          }
        }
      }
      s.registro = []
    }
  }
  console.log(Object.entries(cuenta).sort((a, b) => b[1] - a[1]).slice(0, 8))
})
