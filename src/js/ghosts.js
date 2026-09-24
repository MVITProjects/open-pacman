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

// Fright: duracion y velocidad asustado.
const FRIGHT_FRAMES = 360; // 6 s a ~60fps; parpadeo blanco en los ultimos 120
const FRIGHT_SPEED = 0.05; // mitad de GHOST_SPEED

// Tile objetivo de persecucion segun la personalidad del fantasma.
function chaseTarget( game, g ) {
  const p = game.pacman;
  const px = Math.round( p.x );
  const py = Math.round( p.y );
  const d = DIRS[ p.dir ];

  // Blinky: la celda de Pac-Man (persecucion directa).
  if ( g.kind === 'blinky' ) return { x: px, y: py };

  // Pinky: la celda a 4 celdas por delante de Pac-Man en la direccion que mira.
  if ( g.kind === 'pinky' ) return { x: px + d.x * 4, y: py + d.y * 4 };

  // Inky: espejo de Blinky respecto al punto 2 celdas por delante de Pac-Man.
  if ( g.kind === 'inky' ) {
    const blinky = game.ghosts.find( ( gh ) => gh.kind === 'blinky' );
    const bx = blinky ? Math.round( blinky.x ) : px;
    const by = blinky ? Math.round( blinky.y ) : py;
    return { x: 2 * ( px + d.x * 2 ) - bx, y: 2 * ( py + d.y * 2 ) - by };
  }

  // Clyde: persigue si esta a mas de 8 celdas (Manhattan); si no, su esquina.
  if ( g.kind === 'clyde' ) {
    const dist = Math.abs( Math.round( g.x ) - px ) + Math.abs( Math.round( g.y ) - py );
    if ( dist > 8 ) return { x: px, y: py };
    return { x: GHOST_DEFS[ g.kind ].scatter.x, y: GHOST_DEFS[ g.kind ].scatter.y };
  }

  return { x: px, y: py };
}

// Elige la direccion de un fantasma al entrar en una celda alineada:
// calcula el tile objetivo de su personalidad y elige el giro que mas lo
// acerca (distancia Manhattan).
function decideGhost( game, g ) {
  const grid = game.grid;

  const options = Object.keys( DIRS ).filter(
    ( dir ) => dir !== OPPOSITE[ g.dir ] && canMove( grid, g.x, g.y, dir, 'ghost' )
  );
  // Sin salida (callejon): permitir el giro de 180.
  const choices = options.length ? options : [ '' + OPPOSITE[ g.dir ] ];

  // Fright: giro aleatorio entre las opciones validas, sin retroceder salvo
  // callejon (misma regla de opciones que siempre).
  if ( game.frightTimer > 0 ) {
    g.dir = choices[ Math.floor( Math.random() * choices.length ) ];
    return;
  }

  const target =
    game.ghostPhase && game.ghostPhase.mode === 'scatter'
      ? GHOST_DEFS[ g.kind ].scatter
      : chaseTarget( game, g );
  let best = choices[ 0 ];
  let bestDist = Infinity;
  for ( const dir of choices ) {
    const d = DIRS[ dir ];
    const nx = g.x + d.x;
    const ny = g.y + d.y;
    const dist = Math.abs( nx - target.x ) + Math.abs( ny - target.y );
    if ( dist < bestDist ) {
      bestDist = dist;
      best = dir;
    }
  }
  g.dir = best;
}

window.GHOST_DEFS = GHOST_DEFS;
window.SCATTER_SCHEDULE = SCATTER_SCHEDULE;
window.FRIGHT_FRAMES = FRIGHT_FRAMES;
window.FRIGHT_SPEED = FRIGHT_SPEED;
window.decideGhost = decideGhost;
