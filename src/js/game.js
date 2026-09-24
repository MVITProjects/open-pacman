// game.js
// Estado y reglas. Depende de globals de maze.js: MAZE, TUNNEL_ROW,
// PACMAN_START, GHOST_STARTS, y de ghosts.js: GHOST_DEFS, decideGhost.

const DIRS = {
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
};
const OPPOSITE = { left: 'right', right: 'left', up: 'down', down: 'up' };

const PACMAN_SPEED = 0.125; // 1/8 celda/frame -> alinea cada 8 frames
const GHOST_SPEED = 0.1;    // 1/10 celda/frame

// Crea una partida nueva. Copia MAZE (pristino) a game.grid para poder comer
// dots sin destruir el original, y reiniciar.
function createGame() {
  const grid = MAZE.map( ( row ) => row.slice() );
  // La celda de inicio de Pacman arranca sin dot.
  grid[ PACMAN_START.y ][ PACMAN_START.x ] = 0;

  let dots = 0;
  for ( const row of grid ) for ( const v of row ) if ( v === 2 || v === 4 ) dots++;

  return {
    state: 'start',
    score: 0,
    lives: 3,
    dotsRemaining: dots,
    grid,
    pacman: {
      x: PACMAN_START.x,
      y: PACMAN_START.y,
      dir: 'left',
      nextDir: null,
      speed: PACMAN_SPEED,
    },
    ghosts: GHOST_STARTS.map( ( g ) => ( {
      x: g.x,
      y: g.y,
      dir: 'up',
      speed: GHOST_SPEED,
      kind: g.kind,
      // Los cuatro arrancan dentro de la pen; blinky (exitDelay 0) sale enseguida.
      // inPen no se deriva de exitDelay: debe ser true siempre.
      inPen: true,
      exitTimer: GHOST_DEFS[ g.kind ].exitDelay,
      forcedReverse: false,
    } ) ),
    ghostPhase: { mode: 'scatter', index: 0, framesLeft: SCATTER_SCHEDULE[ 0 ] },
    frightTimer: 0, // frames restantes de modo asustado
    frightChain: 0, // fantasmas comidos en este periodo de fright
  };
}

function aligned( v ) {
  return Math.abs( v - Math.round( v ) ) < 1e-3;
}

// Una celda es muro para el actor dado (string 'pacman' u objeto fantasma)?
//   pacman: bloqueado por pared (1) y puerta (3)
//   ghost:  bloqueado por pared (1); la puerta (3) lo bloquea solo si ya salio
//           de la pen (inPen false), para que no pueda volver a entrar.
function isWall( grid, x, y, actor ) {
  if ( y < 0 || y >= grid.length ) return true;
  if ( x < 0 || x >= grid[ 0 ].length ) return true;
  const v = grid[ y ][ x ];
  if ( v === 1 ) return true;
  if ( v === 3 && ( actor === 'pacman' || actor.inPen === false ) ) return true;
  return false;
}

// Puede el actor avanzar desde (x,y) en la direccion dir?
function canMove( grid, x, y, dir, actor ) {
  const d = DIRS[ dir ];
  if ( !d ) return false;
  const tx = x + d.x;
  const ty = y + d.y;
  // Tunel: salir por un borde en la fila del tunel siempre es valido.
  if ( ty === TUNNEL_ROW && ( tx < 0 || tx >= grid[ 0 ].length ) ) return true;
  return !isWall( grid, tx, ty, actor );
}

function wrapTunnel( a, width ) {
  if ( Math.round( a.y ) === TUNNEL_ROW ) {
    if ( a.x < 0 ) a.x += width;
    else if ( a.x >= width ) a.x -= width;
  }
}

function movePacman( game ) {
  const p = game.pacman;
  const grid = game.grid;
  const width = grid[ 0 ].length;

  if ( aligned( p.x ) && aligned( p.y ) ) {
    p.x = Math.round( p.x );
    p.y = Math.round( p.y );

    // Aplicar giro pendiente si es posible.
    if ( p.nextDir && canMove( grid, p.x, p.y, p.nextDir, 'pacman' ) ) {
      p.dir = p.nextDir;
      p.nextDir = null;
    }
    // Comer dot.
    if ( grid[ p.y ][ p.x ] === 2 ) {
      grid[ p.y ][ p.x ] = 0;
      game.score += 10;
      game.dotsRemaining--;
    }
    // Comer power pellet: 50 pts, activa el fright (timer completo, cadena a
    // cero) y obliga a todo fantasma activo a girar 180.
    if ( grid[ p.y ][ p.x ] === 4 ) {
      grid[ p.y ][ p.x ] = 0;
      game.score += 50;
      game.dotsRemaining--;
      game.frightTimer = FRIGHT_FRAMES;
      game.frightChain = 0;
      reverseGhosts( game );
    }
    // Si no puede seguir, se detiene en la celda.
    if ( !canMove( grid, p.x, p.y, p.dir, 'pacman' ) ) return;
  }

  const d = DIRS[ p.dir ];
  p.x += d.x * p.speed;
  p.y += d.y * p.speed;
  wrapTunnel( p, width );
}

// Salida guionizada: el fantasma cruza hasta la columna de la puerta (x = 13)
// y sube por ella hasta la fila 11, donde pasa a inPen = false (ya afuera).
function moveGhostExit( game, g ) {
  if ( g.x !== 13 ) {
    g.dir = g.x < 13 ? 'right' : 'left';
    g.x += ( g.x < 13 ? 1 : -1 ) * g.speed;
    if ( Math.abs( g.x - 13 ) <= g.speed ) g.x = 13;
    return;
  }
  g.dir = 'up';
  g.y -= g.speed;
  if ( g.y <= 11 ) {
    g.y = 11;
    g.inPen = false;
  }
}

function moveGhost( game, g ) {
  const grid = game.grid;
  const width = grid[ 0 ].length;

  // Dentro de la pen esperando su turno: no se mueve.
  if ( g.inPen && g.exitTimer > 0 ) return;
  // Salida guionizada: se mueve por el camino predefinido, sin decideGhost
  // (la regla de la puerta solo aplica a los fantasmas ya fuera).
  if ( g.inPen ) {
    moveGhostExit( game, g );
    return;
  }

  if ( aligned( g.x ) && aligned( g.y ) ) {
    g.x = Math.round( g.x );
    g.y = Math.round( g.y );
    if ( g.forcedReverse ) {
      g.forcedReverse = false; // el 180 forzado ya se cumple una celda completa
    } else {
      decideGhost( game, g );
    }
    if ( !canMove( grid, g.x, g.y, g.dir, g ) ) return;
  }

  // Velocidad efectiva derivada del estado por frame (g.speed no se muta en
  // las transiciones): asustado fuera de la pen -> mitad de velocidad.
  const speed = game.frightTimer > 0 ? FRIGHT_SPEED : g.speed;
  const d = DIRS[ g.dir ];
  g.x += d.x * speed;
  g.y += d.y * speed;
  wrapTunnel( g, width );
}

function resetPositions( game ) {
  const p = game.pacman;
  p.x = PACMAN_START.x;
  p.y = PACMAN_START.y;
  p.dir = 'left';
  p.nextDir = null;
  game.ghosts.forEach( ( g, i ) => {
    g.x = GHOST_STARTS[ i ].x;
    g.y = GHOST_STARTS[ i ].y;
    g.dir = 'up';
    // Igual que en createGame: los cuatro se re-estacionan dentro de la pen.
    g.inPen = true;
    g.exitTimer = GHOST_DEFS[ g.kind ].exitDelay;
    g.forcedReverse = false;
  } );
  // La muerte reinicia tambien la fase de fantasmas: staging y modo scatter.
  game.ghostPhase = { mode: 'scatter', index: 0, framesLeft: SCATTER_SCHEDULE[ 0 ] };
}

function collides( a, b ) {
  return Math.abs( a.x - b.x ) < 0.5 && Math.abs( a.y - b.y ) < 0.5;
}

// Cuenta atras de la fase de fantasmas. Al agotarse la fase actual avanza al
// siguiente tramo del horario (par = scatter, impar = chase) e invierte el
// sentido de todo fantasma fuera de la pen. Agotado el horario -> chase eterno.
function tickGhostPhase( game ) {
  const phase = game.ghostPhase;
  phase.framesLeft--;
  if ( phase.framesLeft > 0 ) return;

  phase.index++;
  if ( phase.index < SCATTER_SCHEDULE.length ) {
    phase.mode = phase.index % 2 === 0 ? 'scatter' : 'chase';
    phase.framesLeft = SCATTER_SCHEDULE[ phase.index ];
  } else {
    phase.mode = 'chase';
    phase.framesLeft = Infinity;
  }

  reverseGhosts( game );
}

// Invierte el sentido de todo fantasma fuera de la pen. Compartido por el
// cambio de fase scatter/chase y por comer una power pellet.
function reverseGhosts( game ) {
  game.ghosts.forEach( ( g ) => {
    if ( g.inPen ) return;
    g.dir = OPPOSITE[ g.dir ];
    // Si esta justo en una interseccion, marca el giro forzado para que el
    // proximo decideGhost no lo pise de inmediato y el 180 se vea una celda.
    if ( aligned( g.x ) && aligned( g.y ) ) g.forcedReverse = true;
  } );
}

function update( game ) {
  // Mientras dura el fright el conteo scatter/chase queda pausado; al agotarse
  // el timer reanuda la misma fase donde se detuvo.
  if ( game.frightTimer > 0 ) {
    game.frightTimer--;
  } else {
    tickGhostPhase( game );
  }
  movePacman( game );
  game.ghosts.forEach( ( g ) => {
    if ( g.inPen && g.exitTimer > 0 ) g.exitTimer--;
    moveGhost( game, g );
  } );

  for ( const g of game.ghosts ) {
    if ( collides( game.pacman, g ) ) {
      game.lives--;
      if ( game.lives <= 0 ) {
        game.state = 'lost';
        return;
      }
      resetPositions( game );
      break;
    }
  }

  if ( game.dotsRemaining <= 0 ) game.state = 'won';
}

window.createGame = createGame;
window.update = update;
window.DIRS = DIRS;
