# Sea Scoundrels — LCG pirata en solitario (app web)

El juego se llama **Sea Scoundrels**: ese es el título de la app, de la portada y de la pestaña del navegador. «La Sombra del Alba» es el nombre del Barco del jugador, no del juego.

Juego de cartas cooperativo en solitario, al estilo de los LCG (Arkham Horror, El Señor de los Anillos, Marvel Champions, Earthborne Rangers), ambientado en el Caribe de 1670. El diseñador es Albert. El diseño del juego (reglas y cartas) está cerrado en su versión 1.0. Esta app sirve para **jugarlo y probarlo**; los números de las cartas se ajustarán jugando.

## Cómo trabajar con Albert

- Habla siempre en **español**.
- Explica con **conceptos**, no con nombres de ficheros, funciones o siglas. Albert es ingeniero (firmware, TypeScript), pero aquí actúa como diseñador.
- Al terminar algo, da la **conclusión** de cada punto: cerrado, abierto, pendiente de trabajo o esperando su decisión.
- Cuando le plantees una decisión de reglas, dale **ejemplos de juego concretos**.
- **No inventes reglas.** Si el reglamento no cubre un caso, pregunta. Mientras tanto, usa la opción por defecto de la lista de «Decisiones pendientes» y márcala en el código con `// TODO(regla): …`.
- Si queda algo pendiente, termina con un bloque de respuesta que Albert pueda copiar y rellenar. Si él lo corrige, reescríbelo entero.

## Fuentes de verdad (por orden)

1. `docs/reglamento-v1.0.md`: el reglamento completo. Tiene una parte para aprender a jugar, una referencia de la A a la Z y una referencia rápida al final.
2. `data/cartas.json`: todas las cartas de la caja básica (153, con su número de colección). El campo `texto` es la versión 1.0, la buena. La sección `_leyenda` explica el marcado de los textos.
3. Los campos de ayuda que vienen del prototipo antiguo: `fallo`, `exito`, `siempre`, `ops`, `ayudaPrototipo`, `textoPrototipo`. Sirven al motor como pista, pero **si chocan con el texto o el reglamento, mandan el texto y el reglamento**.
4. **Fase 6:** `docs/peligros-2.0.md` (las 55 cartas de Peligro nuevas, que sustituyen a las 25 antiguas: estas se quedan en los datos marcadas `retirada`, solo para las pruebas) y `docs/jugador-2.0.md` (9 cartas de jugador nuevas). En `cartas.json` llevan `"version": 2` (los Peligros) y sus textos completos son solo para leerlos: lo que hacen está escrito a mano por carta en `src/engine/peligros2/` (reglas) y `src/engine/capacidades/jugador2.ts`.
5. **Fase 7:** `docs/misiones-2.0.md` (las 12 misiones 2.0: reglas y recompensas nuevas, capítulos con salida doble, Pasajeros, «¡La guardia!» y los mazos propios rehechos). Las reglas impresas de cada capítulo en `cartas.json` son para leerlas: lo que hace cada uno está escrito a mano en `src/engine/misiones2/`.
6. **Fase 8:** `docs/escenario-2.0.md` (las 14 cartas de Escenario 2.0, que sustituyen a las anteriores; lo que hace cada una está en `src/engine/capacidades/escenario.ts`). Inspirado y Aguerrido son **Ventajas**, no Estados (un efecto que solo ayuda es Ventaja; uno que perjudica o limita es Estado). La Taberna quita todos los Estados de los Tripulantes y el Astillero, todos los del Barco.

Recursos visuales:
- `referencia/cartas/NNN.webp`: imagen de cada carta tal y como está diseñada; el nombre es su número de colección. Es la referencia visual que hay que igualar.
- `referencia/estilo-cartas.css` y `referencia/plantilla-cartas.html`: la maquetación original de las cartas, con el CSS y una plantilla en una sintaxis de plantillas propia. `referencia/ejemplo-datos-render.json` contiene datos de ejemplo para esa plantilla. Pórtala a componentes React.
- `referencia/anatomia/`: tres láminas que explican las partes de las cartas de Tripulante, Misión y Peligro.
- `assets/iconos/*.svg`: iconos del juego. Se usan como máscara CSS y se colorean con `background-color`, como hace el CSS original.
- `assets/arte/*.jpg` y `data/arte.json`: las ilustraciones que ya existen y a qué carta van. El resto de cartas aún no tiene ilustración; lleva un hueco con el texto «Ilustración pendiente».

## Alcance de la versión 0

- **Una partida jugable de principio a fin**, en solitario. Sin cuentas ni servidor, y sin menús más allá de una portada con «Nueva partida» y «Continuar».
- **Todo predefinido** (`mazosPredefinidos` en `cartas.json`): capitán Diego «Garra» Mendoza, puerto Tortuga, modo normal (18 de reputación y 11 cartas de Escenario), el mazo del capitán con 40 cartas (36 hasta la fase 6) y el mazo de muelle con 20 (corregido por Albert: el reglamento pide de 15 a 20).
- **Todas las reglas del reglamento implementadas:**
  - preparación;
  - el turno en 4 pasos;
  - puerto y muelle;
  - pagar descartando cartas, reclutar y adquirir;
  - zarpar y Distancia;
  - revelar Peligros y leer el encuentro del Entorno que toca;
  - Pruebas: comprometer (con las cartas de la mano), Destino, Sin oposición, ventana de acción y resolver;
  - Avance, retirarse y recompensas;
  - mazo de historia y Tesoros;
  - heridas, daño y hundimiento;
  - penalizaciones;
  - Escenario como reloj;
  - ganar y perder.
- **Todas las capacidades de las cartas implementadas.** Cuando una carta pide elegir, la interfaz lo pregunta. Una Respuesta o una Interrupción se ofrece al jugador en su momento, nunca se aplica sola. Una capacidad Obligada se aplica sola.
- **Guardado automático en el navegador**, para cerrar y continuar.
- **Registro de partida** visible: qué se reveló, qué Destino salió, qué se pagó.
- **Deshacer la última acción** mientras no se haya revelado información nueva. Es deseable, no obligatorio.

## Arquitectura

- **Vite + React + TypeScript** (modo estricto). Pruebas con **Vitest**. Animaciones con **Motion** (Framer Motion).
- **El motor va separado de la interfaz** (`src/engine`, sin React):
  - estado serializable, acciones y una función que aplica cada acción;
  - azar con semilla, para reproducir partidas en las pruebas;
  - el motor expone las decisiones pendientes («elige un Tripulante», «¿usas esta Respuesta?») y la interfaz solo las muestra;
  - cada capacidad de carta está en un registro por `id`, con su ventana (Acción, Respuesta, Interrupción, Obligado, Al zarpar, constante).
- **Pruebas del motor:** cada regla del reglamento con su ejemplo de juego convertido en prueba, y cada carta con al menos una prueba. El ejemplo de juego completo del reglamento («Así transcurre el primer turno…») debe reproducirse como prueba.
- **Las cartas se dibujan desde los datos** con componentes React, no con imágenes. Así un cambio de texto o de número en `cartas.json` aparece al instante. Las imágenes de `referencia/` solo sirven para comparar.

## Dirección visual: que se vea profesional desde el principio

- Tiene que parecer **un juego de cartas digital comercial**, no un prototipo. Albert ya tuvo una app anterior que parecía casera y no quiere repetirlo.
- **Mesa:** fondo oscuro con textura sutil (madera de cubierta o carta náutica antigua), zonas claras y con aire. En pantalla tienen que verse:
  - la tripulación y el Barco, con su daño, su Espacio y sus Mejoras;
  - la mano;
  - el muelle;
  - la misión en curso, con su Avance;
  - el mazo de Peligros y la Prueba en curso, con la suma y la dificultad bien visibles;
  - el reloj de Escenario, con los días que quedan;
  - la reputación.
- **Cartas fieles a su diseño** (`referencia/cartas`): mismas tipografías (IM Fell English SC para títulos; Alegreya y Alegreya Sans para textos, de Google Fonts), mismos colores e iconos. Al pasar el ratón por encima o tocar una carta, se amplía para leerla.
- **Animaciones con propósito:**
  - robar y descartar;
  - agotar, girando la carta 90 grados;
  - revelar un Peligro y su Destino, dándole la vuelta a la carta;
  - el Avance sumándose;
  - el daño y las heridas.
  - Rápidas (150–350 ms) y que no bloqueen.
- **Claridad en cada paso:** siempre se ve en qué paso del turno estás y qué puedes hacer. Las acciones posibles se resaltan y las imposibles no se ofrecen.
- **Pantallas:** escritorio primero (1440×900 y 1920×1080), pero usable en tableta horizontal.
- Sin emojis; usa los iconos de `assets/iconos`.
- **Comprueba con capturas** (Playwright) cada pantalla nueva y compara las cartas con su imagen de referencia antes de dar algo por terminado.

## Plan por fases

1. **Esqueleto y despliegue:**
   - proyecto Vite;
   - publicación en GitHub Pages con GitHub Actions (ruta base `/<nombre-del-repo>/`);
   - galería con todas las cartas dibujadas desde los datos, para compararlas con `referencia/cartas`. Albert la revisa antes de seguir.
2. **Motor, primera parte:** preparación, turno, puerto, muelle, pagar, reclutar, adquirir y Escenario, con sus pruebas.
3. **Motor, segunda parte:** misiones, Peligros, Pruebas, Destino, heridas, daño, recompensas, historia, ganar y perder, con sus pruebas.
4. **Capacidades de todas las cartas**, con sus pruebas.
5. **Mesa de juego y pulido visual:** animaciones, registro, guardado y deshacer.
6. **Peligros 2.0:** reglas nuevas (se queda en juego, Estados, Elige, Sin ayuda, Abordaje, Persigue, Incautado, ocupar el muelle), las 55 cartas nuevas en lugar de las antiguas y 9 cartas de jugador nuevas. Punto de control con el Grupo A (cartas 1–11) y entrega final con todas y el informe de equilibrio.
7. **Misiones 2.0:** reglas y recompensas nuevas de las 12 misiones, capítulos II-a/II-b, Pasajeros, fichas de misión, Gesta, finales con elección, «¡La guardia!» y los mazos propios con el formato 2.0 (cartas 218–225). Para las pruebas de cartas y reglas generales hay misiones de prueba sin reglas (`pruebas-mar5`, `pruebas-nat3`…).
8. **Reglamento al día, Estados y Ventajas, puertos y Escenario 2.0:** el reglamento recoge las reglas de Peligro de la fase 6; Inspirado y Aguerrido pasan a ser Ventajas; Taberna y Astillero quitan los Estados; las 14 cartas de Escenario nuevas. Para las pruebas que solo necesitan pasar turnos hay una carta de Escenario de prueba sin efecto (`pruebas-calma`).

Al final de cada fase: pruebas verdes, despliegue y un resumen para Albert con conclusiones y lo pendiente.

## Decisiones de reglas

Todas las decisiones de Albert están en `docs/decisiones.md`, con su ejemplo y su prueba. Las que antes figuraban aquí como pendientes ya están confirmadas:

- **Loro parlanchín:** si nadie se compromete a la Prueba, puede unirse después del Destino (N14).
- **Isabela y el Amuleto vudú:** «reduce su Vida a 1» significa que queda con 1 Vida restante (heridas = Vida − 1).
- **Mazo de Escenario agotado:** no se rebaraja. Se juega el último turno y se pierde (D12).
- **Rehén:** el Capitán no puede ser rehén (N11).
- **Barco hundido:** las Mejoras de barco que se pierden **sí** activan sus efectos «después de que descartes esta carta».
- Si aparece cualquier otro caso no cubierto, pregunta a Albert con una opción por defecto y un ejemplo, y márcala en el código con `// TODO(regla): …` hasta que responda.
- **Fase 6:** las respuestas de Albert (P1–P48) están en `docs/decisiones.md`, sección «Fase 6». Reforzar y la Fiebre ya no existen: las cartas de la mano solo suman al comprometer. Ya no hay Pruebas dobles.
- **Fase 7:** respuestas P49–P56 en la sección «Fase 7» de `docs/decisiones.md`. «Las puertas de Panamá» tiene que seguir siendo una victoria rara (menos del 10 % de las partidas): no se toca su equilibrio.
- **Fase 8:** cambios, lecturas y respuestas P57–P59 en la sección «Fase 8» de `docs/decisiones.md` (alisios y huracanes cambian las Distancias de todas las misiones; Escasez se salta la Recarga; Impuestos pierde la Mejora de mayor coste; La Armada patrulla pone La Armada encima del mazo). Pendiente P60: equilibrio de las dos salidas de La Armada patrulla.
