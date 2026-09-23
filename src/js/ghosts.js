// ghosts.js
// Configuracion estatica y IA de los fantasmas. Va antes que game.js en el
// HTML; sus referencias a DIRS / OPPOSITE / canMove se resuelven en tiempo de
// ejecucion (cuando decideGhost se llama durante update), no en carga.

// Definicion estatica por fantasma: color, esquina de scatter y retardo de salida.
const GHOST_DEFS = {
  blinky: { color: '#ff0000', scatter: { x: 26, y: 1 },  exitDelay: 0 },
  pinky:  { color: '#ffb8ff', scatter: { x: 1,  y: 1 },  exitDelay: 120 },
  inky:   { color: '#00ffff', scatter: { x: 26, y: 29 }, exitDelay: 240 },
  clyde:  { color: '#ffb852', scatter: { x: 1,  y: 29 }, exitDelay: 360 },
};

// Frames a ~60fps. Indice par = scatter, impar = chase; agotado -> chase permanente.
const SCATTER_SCHEDULE = [ 420, 1200, 420, 1200, 300, 1200, 300 ];

// Elige la direccion de un fantasma al entrar en una celda alineada.
// Placeholder: eleccion aleatoria entre los giros validos (la IA por
// personalidad se implementa en un paso posterior del plan).
function decideGhost( game, g ) {
  const grid = game.grid;

  const options = Object.keys( DIRS ).filter(
    ( dir ) => dir !== OPPOSITE[ g.dir ] && canMove( grid, g.x, g.y, dir, 'ghost' )
  );
  // Sin salida (callejon): permitir el giro de 180.
  const choices = options.length ? options : [ '' + OPPOSITE[ g.dir ] ];

  g.dir = choices[ Math.floor( Math.random() * choices.length ) ];
}

window.GHOST_DEFS = GHOST_DEFS;
window.SCATTER_SCHEDULE = SCATTER_SCHEDULE;
window.decideGhost = decideGhost;
