import { useEffect, useState } from 'react'
import { Galeria } from './ui/galeria/Galeria.tsx'
import { HojaDeCaptura } from './ui/galeria/HojaDeCaptura.tsx'

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

export function App() {
  const ruta = useRuta()
  if (ruta.startsWith('/captura')) return <HojaDeCaptura />
  return <Galeria />
}
