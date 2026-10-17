// Nombre de la carta en su placa. Los nombres largos se reducen o pasan a dos líneas,
// como en la maquetación original.

import { tamanoNombre } from './ajustes.ts'

export function NombreCarta({ nombre, unica, num }: { nombre: string; unica: boolean; num: number }) {
  const { tam, dosLineas } = tamanoNombre(num)
  return (
    <span className={dosLineas ? 'name two' : 'name'} style={{ fontSize: `${tam}px` }}>
      {unica && <span className="uq">★</span>}
      {nombre}
    </span>
  )
}
