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
- `assets/arte/*.jpg` y `data/arte.json`: las ilustraciones que ya existen, a qué carta van y su encuadre. Van grandes (1312 px de ancho, 768 las verticales) porque el reglamento las usa a todo el ancho; la mesa y la galería usan una copia pequeña en `assets/arte/mesa/`, que se genera con `npm run arte:mesa` al añadir o cambiar una. El resto de cartas aún no tiene ilustración; lleva un hueco con el texto «Ilustración pendiente».

## Alcance de la versión 0

- **Una partida jugable de principio a fin**, en solitario. Sin cuentas ni servidor, y sin menús más allá de una portada con «Nueva partida» y «Continuar».
- **Todo predefinido** (`mazosPredefinidos` en `cartas.json`): capitán Diego «Garra» Mendoza, puerto Tortuga, modo normal (12 de reputación y 11 cartas de Escenario), el mazo del capitán con 40 cartas (36 hasta la fase 6) y el mazo de muelle con 20 (corregido por Albert: el reglamento pide de 15 a 20).
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

9. **Reglamento maquetado:** dos libros («Aprende a jugar» y «Referencia de reglas») generados desde `docs/reglamento-v1.0.md` con `npm run reglamento` (React + Paged.js en `src/libro/`, PDF con el Chromium de Playwright; la publicación los genera). Las marcas `[!tema]`, `[!ejemplo]`, `[!importante]`, `[!consejo]`, `[!epigrafe]` y `[!grafico]` están explicadas al principio del reglamento. No se toca nada a mano: si algo sale mal maquetado, se arregla en la maqueta o en el reglamento. Lo ancho va centrado en la página; cada capítulo de «Aprende a jugar» lleva su ilustración (`src/libro/arte.ts`) y las columnas exteriores casi vacías, una viñeta. `npm run comprobar:reglamento` revisa que nada se monte, se descentre o se salga, que no queden marcas pendientes ni páginas casi vacías y que ninguna palabra se parta entre dos páginas. El índice de términos de la Referencia sale solo de las entradas y sus negritas (una prueba exige que tenga cada término en negrita, palabra clave y Rasgo de las cartas) y «Mazos de inicio», de los mazos predefinidos.

12. **Travesías de 2 y 4 capítulos:** El espía de Cádiz y El barco fantasma pasan a dos capítulos (135 y 147 unen los dos primeros; quedan libres los números 136 y 148); La Flota de la Plata y El templo perdido, a cuatro, con dos capítulos III nuevos (238 «Al abordaje del galeón» y 239 «La escalinata de los sacerdotes», con la ficha de Derrumbe). Al superar un capítulo, el siguiente va siempre encima del mazo de Misiones (sin barajar) y sale enseguida entre las disponibles. Detalle en la sección «Fase 12» de `docs/decisiones.md`.

13. **Revisión de las cartas de Peligro (tandas 1 y 2):** cartas 154 a 159, reglas de estilo de los Peligros y mazos propios (sin «Sin Prueba», Avance y daño con icono, «superior», «Elige» por líneas, «Vigía −2» bajo la Prueba, Otear siempre del mazo de Peligros), heridas libres en los encuentros, dos Destinos («Bruma en la selva») y la carta nueva 240 «Arenga del capitán» (en la colección, no en el mazo de inicio). Segunda ronda: Destinos simplificados (41 solo con modificador y Sin oposición; 6 con «Inflige 1 herida a un Tripulante asignado»), «Otea N», «Prepara a 1 Tripulante asignado», heridas libres por asignado (P79) y Cañones con «[mar], [agotar]:». Detalle en la sección «Fase 13» de `docs/decisiones.md`.

14. **Rotación de la tripulación:** palabras clave Enrolado N (se va al terminar N misiones) y Desgaste (1 herida después de cada Prueba a la que esté asignado), seis Tripulantes nuevos (241–246) y el jugador automático que despide para hacer sitio. Excepción temporal: mazo de muelle de 26 cartas para probar la fase 14; se quita al rehacer los mazos de inicio. Detalle en la sección «Fase 14» de `docs/decisiones.md`.

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
- **Avance X / Y (19 de octubre de 2026):** los encuentros con Prueba dan X si la superas e Y si no. Albert eligió Y = mitad de X **hacia arriba** (1 / 1, 2 / 1, 3 / 2, 4 / 2), en el campo `avanceSinSuperar` de cada encuentro. Detalle en la sección «Avance con dos valores» de `docs/decisiones.md`.
- **Fase 8:** cambios, lecturas y respuestas P57–P59 en la sección «Fase 8» de `docs/decisiones.md` (alisios y huracanes cambian las Distancias de todas las misiones; Escasez se salta la Recarga; Impuestos pierde la Mejora de mayor coste; La Armada patrulla pone La Armada encima del mazo). P60 cerrada: el soborno de La Armada patrulla es 1 carta. P61: la dificultad suma todos los modificadores, el Destino incluido, y solo el resultado final no baja de 0.
- **Fase 12:** respuestas P67–P70 en la sección «Fase 12» de `docs/decisiones.md`. El equilibrio se ajusta jugando (Albert prefiere un reto antes que un juego fácil): para publicar, el único tope duro es Panamá por debajo del 10 % de las partidas. «Rumores del tesoro» da 2 en los capítulos II, III y IV.
- **Fase 13:** las heridas de los encuentros son siempre libres (las reparte el jugador entre todos sus Tripulantes); herir a un asignado queda para los Destinos. Respuestas P71–P85 e I1–I11 en la sección «Fase 13» de `docs/decisiones.md`. Reglas generales de Albert:
  - **Las cartas se aplican al pie de la letra:** si una carta daña el Barco, lo daña en cualquier Entorno (fuera P19).
  - **«Al zarpar:»** solo en cartas en juego (misiones, Mejoras, Tesoros) y se aplica solo; los Eventos dicen «**Respuesta:** Después de zarpar, …». Orden: zarpas, pagas la Distancia, «Al zarpar», Respuestas.
  - **«El Tripulante asignado con más (o menos) X» sin nadie asignado**, en un encuentro, es el de más (o menos) X de toda la tripulación.
  - **Las Mejoras de barco se usan en cualquier ventana** si la carta no dice otra cosa (fuera N18). Lo que dependa del Entorno lo dice la carta con el icono del Entorno delante del efecto: «[mar], [agotar]: efecto», «**Respuesta:** [ciu]: Después de…», «**Al zarpar:** [mar]: …». Los cuatro Cañones, solo en el Mar (P81).
  - **Un Destino sin nadie asignado** (P83): lo que le hace a «un Tripulante asignado» o a «el asignado con…» no se aplica; solo su Sin oposición. La regla de los encuentros (toda la tripulación, heridas libres) no vale para los Destinos.
- **Fase 14:** Enrolado y Desgaste son palabras clave de Tripulante (reglas en `docs/decisiones.md`, sección «Fase 14»); despedir sigue sin dar nada a cambio. Pendientes P86–P88.
