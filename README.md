# Sea Scoundrels

Juego de cartas cooperativo en solitario, al estilo de los LCG, ambientado en el Caribe de 1670.
Esta aplicación web sirve para jugarlo y probarlo.

**Web publicada:** https://halbert82.github.io/seascroundels/

## Estado

- **Fase 1 (hecha):** proyecto base, publicación automática en GitHub Pages y galería con las 153 cartas
  de la Caja básica dibujadas desde `data/cartas.json`, con modo de comparación con `referencia/cartas`.
- Fases siguientes: motor de reglas, capacidades de las cartas y mesa de juego (ver `CLAUDE.md`).

## Para trabajar en local

```sh
npm install
npm run dev          # servidor de desarrollo
npm test             # pruebas (Vitest)
npm run build        # compilación para publicar
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
- `src/ui/cartas/`: dibujo de las cartas. `cartas.css` es la maquetación original portada;
  `ajustes.ts` recoge los ajustes que la plantilla original decidía carta a carta.
- `src/ui/galeria/`: la galería y la hoja que usan las capturas.
- `.github/workflows/publicar.yml`: compila, pasa las pruebas y publica en cada push a `main`.
