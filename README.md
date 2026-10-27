# Learning English

Juegos web para practicar inglés, hechos solo con HTML, CSS y JavaScript. No necesitan instalación: se abren en cualquier navegador.

## Temas

| Tema | Carpeta | Nivel |
|---|---|---|
| Comparativos y Superlativos | `temas/comparativos/` | A1 - A2 |

## Cómo usarlo

- **En línea:** abre la página publicada con GitHub Pages.
- **En tu computador:** abre `index.html` con doble clic.

El progreso de cada juego se guarda en el navegador (localStorage), así que cada dispositivo tiene su propio progreso.

## Cómo añadir un tema nuevo

1. Crea una carpeta dentro de `temas/`, por ejemplo `temas/present-simple/`.
2. Copia dentro los archivos de `temas/comparativos/` como punto de partida y adapta `data.js`.
3. Añade el tema a la lista en `topics.js` para que aparezca en la página de inicio.

## Cómo añadir vocabulario a un tema

Edita el archivo `data.js` del tema. Cada palabra es una línea con su traducción, formas, regla, frecuencia y categoría. Los comentarios del archivo explican cada campo.
