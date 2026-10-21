// Dibuja textos de carta ya interpretados (segmentos) y fichas de efecto.

import type { CSSProperties, ReactNode } from 'react'
import type { ColorNumero, Ficha, IconoId, Segmento } from './marcado.ts'
import { COLOR_ENTORNO, COLOR_HABILIDAD } from './vista.ts'

/** Clase CSS del icono: «i-nav», «i-herida»… */
export function claseIcono(icono: IconoId): string {
  return `ic i-${icono.toLowerCase()}`
}

export function Icono({ icono, color, style }: { icono: IconoId; color?: string; style?: CSSProperties }) {
  return <span className={claseIcono(icono)} style={color ? { color, ...style } : style} />
}

/** Fondo claro (pergamino) u oscuro (franja de Destino). */
export type Tema = 'claro' | 'oscuro'

const TINTA = '#2A2118'

const COLOR_NUMERO: Record<Tema, Record<ColorNumero, string>> = {
  claro: { verde: '#3D6631', rojo: '#8E2B23', tinta: TINTA },
  oscuro: { verde: '#9CC98A', rojo: '#F4A08C', tinta: '#FBF0DA' },
}

export function colorIcono(icono: IconoId, tema: Tema): string {
  if (tema === 'oscuro') {
    if (icono === 'NAV') return '#A5C4E7'
    if (icono === 'COM' || icono === 'herida' || icono === 'vida') return '#F4A08C'
    if (icono === 'EXP') return '#E2BE72'
    return '#FBF0DA'
  }
  if (icono === 'NAV' || icono === 'COM' || icono === 'EXP') return COLOR_HABILIDAD[icono]
  if (icono === 'mar' || icono === 'nat' || icono === 'ciu') return COLOR_ENTORNO[icono]
  if (icono === 'herida' || icono === 'vida') return '#8E2B23'
  return TINTA
}

export function TextoCarta({ segmentos, tema = 'claro' }: { segmentos: Segmento[]; tema?: Tema }) {
  const piezas: ReactNode[] = segmentos.map((s, i) => {
    switch (s.tipo) {
      case 'texto':
        return s.negrita ? (
          <span key={i} style={{ fontWeight: 800 }}>
            {s.texto}
          </span>
        ) : (
          <span key={i}>{s.texto}</span>
        )
      case 'rasgo':
        return (
          <span key={i} style={{ fontWeight: 800, fontStyle: 'italic' }}>
            {s.texto}
          </span>
        )
      case 'clave':
        return (
          <span key={i} className="kw">
            {s.texto}
          </span>
        )
      case 'ambiente':
        return (
          <span key={i} className="amb">
            {s.texto}
          </span>
        )
      case 'numero':
        return (
          <span key={i} className="num" style={{ color: COLOR_NUMERO[tema][s.color] }}>
            {s.valor}
            {s.icono && (
              <>
                {' '}
                <Icono icono={s.icono} color={colorIcono(s.icono, tema)} />
              </>
            )}
            {s.tras && <span style={{ color: COLOR_NUMERO[tema].tinta, fontWeight: 400 }}>{s.tras}</span>}
          </span>
        )
      case 'icono':
        return s.pegado ? (
          <span key={i} style={{ whiteSpace: 'nowrap', marginRight: '.3em' }}>
            <Icono icono={s.icono} color={colorIcono(s.icono, tema)} />
            <span style={{ fontWeight: 800 }}>{s.pegado}</span>
          </span>
        ) : (
          <Icono key={i} icono={s.icono} color={colorIcono(s.icono, tema)} />
        )
      case 'parrafo':
        return <span key={i} className="br" />
    }
  })
  return <>{piezas}</>
}

/** Fichas de un recuadro de efecto: «2 [dano] · 1 [herida]». Con `vacio`, un guion si no hay nada. */
export function Fichas({ fichas, vacio = true }: { fichas: Ficha[]; vacio?: boolean }) {
  if (fichas.length === 0) return vacio ? <span className="none dash">—</span> : null
  return (
    <>
      {fichas.map((f, i) => (
        <span key={i} className={f.rota ? 'tk brk' : f.icono ? 'tk' : 'tk txt'}>
          <b>{f.texto}</b>
          {f.icono && (
            <span className={f.rota ? 'icw brk' : 'icw'}>
              <span className={claseIcono(f.icono)} />
            </span>
          )}
        </span>
      ))}
    </>
  )
}
