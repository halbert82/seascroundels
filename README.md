# Sea Scoundrels

Juego de cartas cooperativo en solitario, al estilo de los LCG, ambientado en el Caribe de 1670.
Esta aplicación web sirve para jugarlo y probarlo.

**Web publicada:** https://halbert82.github.io/seascroundels/

## Estado

- **Fase 1 (hecha):** proyecto base, publicación automática en GitHub Pages y galería con las 153 cartas
  de la Caja básica dibujadas desde `data/cartas.json`, con modo de comparación con `referencia/cartas`.
- **Fase 2 (hecha):** motor de reglas, primera parte: preparación, turno, puerto, muelle, pagar, reclutar,
  adquirir, despedir, Escenario y derrota por tiempo, con sus pruebas.
- **Fase 3 (hecha):** motor de reglas, segunda parte: zarpar y Distancia, misiones y sus reglas, Peligros y
  encuentros, Pruebas con Destino y Sin oposición, heridas, daño, rehenes, hundimiento, retirarse, recompensas,
  mazo de historia, Tesoros y victoria. Con jugadores automáticos que juegan partidas enteras y un informe de
  equilibrio (`docs/informe-equilibrio.md`).
- **Fase 4 (hecha):** capacidades de todas las cartas del jugador (Tripulantes, Mejoras, Eventos, Tesoros,
  Catalina y Nassau), con una prueba por carta. El jugador automático usa las capacidades, y el informe de
  equilibrio da datos por carta, también con mazos de muelle variados.
- **Fase 5 (hecha):** la mesa de juego. Se juega entera con el ratón: portada, mesa que se adapta al ancho de la
  pantalla, decisiones, Prueba con desglose y Destino grande, Tripulantes con hueco fijo (girados al agotarse),
  animaciones, registro, guardado automático, deshacer, ayuda, fin de misión y fin de partida.

## Para trabajar en local

```sh
npm install
npm run dev          # servidor de desarrollo
npm test             # pruebas (Vitest)
npm run build        # compilación para publicar
npm run equilibrio   # juega 3000 partidas automáticas (unos 5 min) y reescribe docs/informe-equilibrio.md
npm run capturas:mesa  # capturas de la mesa (en puerto, Prueba, fin de misión) en capturas/mesa/
npm run jugar:mesa     # juega una partida entera pulsando la interfaz (PARTIDAS=3 para más)
```

### Comprobar que las cartas son fieles al diseño

```sh
npx playwright install chromium   # solo la primera vez
npm run capturas                  # fotografía cada carta en capturas/actual/
npm run comparar                  # láminas referencia | dibujada | diferencia en capturas/comparar/
```

`npm run comparar` lista las cartas de más a menos diferente. Las diferencias que quedan son de suavizado
del texto (las referencias se capturaron con medio píxel de desplazamiento).

## Organización

- `src/engine/`: datos y reglas del juego, en TypeScript puro (sin React).
  - El estado de la partida es JSON simple; `responder(estado, elección)` lo avanza hasta la siguiente decisión.
  - Las reglas son una pila de tareas (`tareas/`); las capacidades de las cartas, un registro por carta (`capacidades/`).
  - Los textos impresos de encuentros, Destinos y misiones se interpretan (`efectos.ts`, `destinos.ts`,
    `capacidades/misiones.ts`): un cambio en `cartas.json` llega solo al motor.
  - Las capacidades de las cartas del jugador están en `capacidades/` (`tripulantes.ts`, `mejoras.ts`, `eventos.ts`)
    y leen sus números del texto. `capacidades/huellas.json` guarda cada texto sin números: si cambia la redacción
    de una carta, una prueba avisa de que hay que revisar su capacidad.
  - `pruebas/situacion.ts` monta situaciones de prueba en una llamada; `docs/decisiones.md` recoge las decisiones de reglas.
  - `pruebas/jugadores.ts` tiene un jugador al azar y uno con criterio; `pruebas/equilibrio.ts` simula partidas y escribe el informe.
- `src/ui/cartas/`: dibujo de las cartas. `cartas.css` es la maquetación original portada;
  `ajustes.ts` recoge los ajustes que la plantilla original decidía carta a carta.
- `src/ui/galeria/`: la galería y la hoja que usan las capturas.
- `.github/workflows/publicar.yml`: compila, pasa las pruebas y publica en cada push a `main`.
