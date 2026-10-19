// Carta de puerto (apaisada): opciones comunes, opción propia y muelle.

import { TextoCarta } from './TextoCarta.tsx'
import type { VistaPuerto } from './vista.ts'

export function CartaPuerto({ v }: { v: VistaPuerto }) {
  return (
    <div className="card wide pto2">
      <div className="ptoh">
        <span className="chapm">Puerto · El Caribe</span>
        <span className="chapn">{v.nombre}</span>
        <div className="muelleb">
          <small>MUELLE</small>
          <b>{v.muelle}</b>
        </div>
      </div>
      {/* La ilustración en la franja de la derecha, como la de una misión en la suya; la frase, encima y abajo. */}
      <div className={`ptoart ${v.arte ? 'con-arte' : ''}`} style={v.arte ? { background: `url("${v.arte.url}") ${v.arte.encuadre}/cover no-repeat` } : undefined}>
        {!v.arte && (
          <span>
            Ilustración
            <br />
            del puerto
          </span>
        )}
        {v.ambientacion && <div className="ptofl">{v.ambientacion}</div>}
      </div>
      <div className="ptor">
        {v.comunes.map((opcion, i) => (
          <div key={i} className="opt">
            <span className="ot">
              <TextoCarta segmentos={opcion} />
            </span>
          </div>
        ))}
        <div className="ptoab">
          <div className="ptoabh">
            <span>{v.propia.nombre}</span>
          </div>
          <div className="rules">
            <TextoCarta segmentos={v.propia.texto} />
          </div>
        </div>
      </div>
      <div className="foot">
        <span>Puerto · Caja básica</span>
        <span>{v.codigo}</span>
      </div>
    </div>
  )
}
