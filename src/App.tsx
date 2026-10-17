import { useEffect, useState } from 'react'
import { Galeria } from './ui/galeria/Galeria.tsx'
import { HojaDeCaptura } from './ui/galeria/HojaDeCaptura.tsx'
import { ESCENAS, escena, type Escena } from './ui/mesa/escenas.ts'
import { Mesa } from './ui/mesa/Mesa.tsx'
import { borrarPartidaGuardada, empezar, partidaGuardada, partidaNueva } from './ui/mesa/usePartida.ts'
import { Portada } from './ui/portada/Portada.tsx'

/** Rutas con almohadilla para que funcionen en GitHub Pages sin configuración. */
function useRuta(): string {
  const [ruta, setRuta] = useState(() => window.location.hash.replace(/^#/, '') || '/')
  useEffect(() => {
    const alCambiar = () => setRuta(window.location.hash.replace(/^#/, '') || '/')
    window.addEventListener('hashchange', alCambiar)
    return () => window.removeEventListener('hashchange', alCambiar)
  }, [])
  return ruta
}

function irA(ruta: string): void {
  window.location.hash = ruta
}

export function App() {
  const ruta = useRuta()
  if (ruta.startsWith('/captura')) return <HojaDeCaptura />
  if (ruta.startsWith('/galeria')) return <Galeria />
  if (ruta.startsWith('/escena/')) {
    const nombre = ruta.slice('/escena/'.length)
    if ((ESCENAS as readonly string[]).includes(nombre)) {
      return <Mesa key={ruta} inicial={() => escena(nombre as Escena)} guardar={false} irA={irA} nueva={partidaNueva} />
    }
  }
  if (ruta.startsWith('/partida')) {
    return (
      <Mesa
        key="partida"
        inicial={() => {
          const guardada = partidaGuardada()
          return guardada ? empezar(guardada) : partidaNueva()
        }}
        guardar
        irA={irA}
        nueva={partidaNueva}
      />
    )
  }
  return (
    <Portada
      irA={irA}
      nueva={() => {
        borrarPartidaGuardada()
        irA('/partida')
      }}
    />
  )
}
