# Cartas de jugador nuevas (para probar con los Peligros 2.0)

Nueve cartas de la caja básica que responden a las reglas nuevas de Peligro (Estados y Ventajas, cartas que se quedan en juego, rehenes, Persigue). Ninguna respuesta sale gratis: todas piden agotar, pagar cartas, gastar munición o superar una Prueba.

Formato igual que el resto de `cartas.json`. Iconos: [NAV] [COM] [EXP]. Las líneas «Ejemplo» son notas de diseño, no van en la carta.

## Tripulantes (van al mazo de muelle)

### Herbolaria
- Tripulante · Neutral · Coste 2 · NAV 0 · COM 0 · EXP 2 · Vida 1 · Mejoras 1 · Rasgos: Explorador
- Texto: [agotar]: Quita a un Tripulante uno de estos Estados: Envenenado, Sangrando, Aturdido o Asustado.
- Ambientación: «Para cada veneno, una hoja. Para cada hoja, un precio.»
- Ejemplo: la «Barba amarilla» deja Envenenado al Bucanero; la agotas y queda limpio.

### Práctico del puerto
- Tripulante · Neutral · Coste 2 · NAV 2 · COM 0 · EXP 1 · Vida 1 · Mejoras 1 · Rasgos: Marinero, Piloto
- Texto: **Respuesta:** Después de que superes una Prueba de [NAV] en la que participe Práctico del puerto, quita Vía de agua o Velas rotas del Barco.
- Ambientación: «Conozco cada bajo de esta costa. Algunos, de cerca.»
- Ejemplo: la «Turbonada» deja Velas rotas; superas la siguiente Prueba de NAV con él y el Barco vuelve a dar su +1.

### La Lengua
- Tripulante · Neutral · Coste 2 · NAV 0 · COM 0 · EXP 2 · Vida 1 · Mejoras 1 · Rasgos: Explorador
- Texto: Los encuentros #Civil# en los que participe La Lengua reciben −1 de dificultad.
- Ambientación: «Habla seis idiomas. Miente en todos.»
- Ejemplo: en «Carestía» eliges regatear (EXP 3); con ella baja a 2.

### Fiador de la Hermandad
- Tripulante · Piratería · Coste 1 · NAV 0 · COM 1 · EXP 0 · Vida 1 · Mejoras 0 · Rasgos: Bucanero
- Texto: **Interrupción:** Cuando otro Tripulante vaya a quedar rehén, Fiador de la Hermandad queda rehén en su lugar. Si lo rescatas, roba {2 robar}.
- Ambientación: «Mi palabra vale lo que yo. Que no es mucho, pero vale.»
- Ejemplo: la «Leva forzosa» se lleva a Isabela; va el Fiador en su lugar.

## Eventos (van al mazo del capitán)

### Cataplasma
- Evento · Coste 0 · Iconos: [EXP]
- Texto: Quita Envenenado o Sangrando a un Tripulante y cúrale {1 herida g}.
- Ambientación: «Barro, hojas y una oración. Funciona casi siempre.»

### Cortar por lo sano
- Evento · Coste 0 · Iconos: [COM]
- Texto: **Acción:** Descarta 2 cartas de tu mano: Descarta una carta de Peligro que se quede en juego, salvo si es de nivel Terrible.
- Ambientación: «Si no puedes desatar el nudo, córtalo.»
- Ejemplo: «Campanas a rebato» lleva 2 fichas; pagas 2 cartas y el campanario calla.

### ¡A por ellos!
- Evento · Coste 1 · Iconos: [COM] [COM]
- Texto: **Acción:** Haz una Prueba de [COM] 3. Si la superas, rescata a todos los rehenes de esta misión: vuelven preparados.
- Ambientación: «¡Nadie se queda atrás! Salvo el que se quede.»
- Nota: es una Prueba normal (se comprometen Tripulantes, se revela Destino, Sin oposición si no hay nadie). Solo se puede jugar durante una misión.

### Ron para los valientes
- Evento · Coste 0 · Iconos: [COM]
- Texto: **Acción:** Un Tripulante queda Borracho y Aguerrido.
- Nota (fase 8): Borracho es un Estado y Aguerrido, una Ventaja. El texto de la carta no cambia.
- Ambientación: «Un trago para el valor. Otro para el pulso. El tercero, para el miedo.»

### Virar y dar la cara
- Evento · Coste 0 · Iconos: [NAV] [COM]
- Texto: **Interrupción:** Gasta {1 municion}: Cuando un Destino vaya a poner su carta encima del mazo de Peligros, ponla al fondo del mazo en su lugar.
- Ambientación: «¿Nos persiguen? Que prueben el bronce de popa.»
- Ejemplo: sale el Destino «La Armada os da caza»; disparas y la Armada se queda atrás.

## Cambios en los mazos predefinidos

- **Mazo de muelle** (sigue en 20): entran Herbolaria, Práctico del puerto, La Lengua y Fiador de la Hermandad. Salen una de las dos copias de Bucanero veterano, Rufián de cubierta, Brújula de latón y Sable de abordaje (sobraba COM y las +1 sueltas son lo más flojo).
- **Mazo del capitán** (pasa de 36 a 40): entran los cinco Eventos. Sale una de las dos copias de Reflejos de gato.
