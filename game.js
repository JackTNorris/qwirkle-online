/*
TODO:
=================
ESSENTIAL:
- Fix rule that prevents non-contiguous addition on the same line [DONE]
- Fix swapping tiles functionality [DONE]
- Increase padding on edges to allow large plays [DONE]
- Add in login [ DONE ]
- Cancelling only part of move (add x's on pieces) [DONE]
- Add in bonus points for 6+ [DONE]

NICE TO HAVES:
- Saving games
- Score history
- drag and drop
- Themes: halloween and christmas themes with different colors and tile shapes [DONE]
  - Halloween
    - black, orange, green, purple, yellow, red
    - pumpkin, ghost, bat, cat, skull, witch hat
  - Christmas
    - tree, present, stocking, snowflake, bell, ornament
    - red, green, silver, gold, white, pink 
*/

// ── Constants (rendering only — no game logic) ─────────────────────────────
const CENTER = 45;
const API_URL = 'https://api.jacktnorris.dev';

// ── Themes ─────────────────────────────────────────────────────────────────
const THEMES = {
  classic: {
    label: 'Classic',
    colors: {
      red:    '#e84040',
      orange: '#f4a261',
      yellow: '#f4d35e',
      green:  '#52b788',
      blue:   '#4895ef',
      purple: '#b14aed',
    },
    // Classic shapes are handled by the default shapeSVG switch
    shapeMap: null,
  },
  halloween: {
    label: '🎃 Halloween',
    colors: {
      red:    '#cc0000',
      orange: '#ff6b00',
      yellow: '#f4d35e',
      green:  '#3a7d44',
      purple: '#7b2d8b',
      black:  '#1a1a1a',
    },
    // Maps server shape names → halloween display names
    shapeMap: {
      circle:  'pumpkin',
      '4star': 'ghost',
      diamond: 'bat',
      square:  'cat',
      '8star': 'skull',
      clover:  'witchhat',
    },
  },
  christmas: {
    label: '🎄 Christmas',
    colors: {
      red:    '#cc2222',
      orange: '#c0964a', // gold
      yellow: '#f4f4f4', // white
      green:  '#2d6a2d',
      blue:   '#a8a8b0', // silver
      purple: '#e85d9a', // pink
    },
    shapeMap: {
      circle:  'ornament',
      '4star': 'snowflake',
      diamond: 'present',
      square:  'stocking',
      '8star': 'bell',
      clover:  'tree',
    },
  },
};

const urlTheme = new URLSearchParams(window.location.search).get('theme');
let currentTheme = (urlTheme && THEMES[urlTheme]) ? urlTheme : (localStorage.getItem('qwirkle-theme') || 'classic');

// ── Theme-aware color/shape helpers ────────────────────────────────────────
const tileColor = (serverColor) => {
  const theme = THEMES[currentTheme] || THEMES.classic;
  return theme.colors[serverColor] || '#fff';
};

// Maps a server color name to the theme's color key
// Server always uses: red, orange, yellow, green, blue, purple
// Halloween uses:     red, orange, yellow, green, purple, black  (no blue → black)
// Christmas uses:     red, orange(gold), yellow(white), green, blue(silver), purple(pink)
// The mapping is positional — server color index → theme color index
const SERVER_COLORS = ['red','orange','yellow','green','blue','purple'];
const themeColorKey = (serverColor) => {
  const theme = THEMES[currentTheme] || THEMES.classic;
  if (!theme.shapeMap) return serverColor; // classic uses same keys
  const keys = Object.keys(theme.colors);
  const idx = SERVER_COLORS.indexOf(serverColor);
  return keys[idx] ?? serverColor;
};

const resolvedTileColor = (serverColor) => {
  const theme = THEMES[currentTheme] || THEMES.classic;
  const keys = Object.keys(theme.colors);
  const idx = SERVER_COLORS.indexOf(serverColor);
  return Object.values(theme.colors)[idx] ?? '#fff';
};

const shapeSVG = (serverShape, serverColor) => {
  const c = resolvedTileColor(serverColor);
  const theme = THEMES[currentTheme] || THEMES.classic;
  const displayShape = theme.shapeMap ? (theme.shapeMap[serverShape] || serverShape) : serverShape;
  return renderShapeSVG(displayShape, c);
};

const faceColor = (hex) => {
  const h = hex.replace('#', '');
  const r = parseInt(h.substring(0,2), 16);
  const g = parseInt(h.substring(2,4), 16);
  const b = parseInt(h.substring(4,6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.45 ? '#1a0a00' : '#f0ede0';
};
 
// Returns a subtle dark outline stroke when the tile color is very light,
// so white/light shapes remain visible against a white tile background.
const outlineStroke = (hex) => {
  const h = hex.replace('#', '');
  const r = parseInt(h.substring(0,2), 16);
  const g = parseInt(h.substring(2,4), 16);
  const b = parseInt(h.substring(4,6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.75 ? 'stroke="#aaa" stroke-width="1"' : '';
};
 
const renderShapeSVG = (shape, c) => {
  const base = `viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg"`;
  switch (shape) {
 
    // ── Classic ──────────────────────────────────────────────────────────────
    case 'circle':
      return `<svg ${base}><circle cx="20" cy="20" r="17" fill="${c}" ${outlineStroke(c)}/></svg>`;
    case 'square':
      return `<svg ${base}><rect x="4" y="4" width="32" height="32" fill="${c}" ${outlineStroke(c)}/></svg>`;
    case 'diamond':
      return `<svg ${base}><polygon points="20,2 38,20 20,38 2,20" fill="${c}" ${outlineStroke(c)}/></svg>`;
    case '4star': {
      const p = 'M20,2 L23,17 L38,20 L23,23 L20,38 L17,23 L2,20 L17,17 Z';
      return `<svg ${base}><path d="${p}" fill="${c}" ${outlineStroke(c)}/></svg>`;
    }
    case '8star': {
      const pts = [];
      for (let i = 0; i < 16; i++) {
        const angle = (i * Math.PI) / 8 - Math.PI / 2;
        const r = i % 2 === 0 ? 18 : 9;
        pts.push(`${20 + r * Math.cos(angle)},${20 + r * Math.sin(angle)}`);
      }
      return `<svg ${base}><polygon points="${pts.join(' ')}" fill="${c}" ${outlineStroke(c)}/></svg>`;
    }
    case 'clover':
      return `<svg ${base}>
        <circle cx="20" cy="12" r="8" fill="${c}" ${outlineStroke(c)}/>
        <circle cx="20" cy="28" r="8" fill="${c}" ${outlineStroke(c)}/>
        <circle cx="12" cy="20" r="8" fill="${c}" ${outlineStroke(c)}/>
        <circle cx="28" cy="20" r="8" fill="${c}" ${outlineStroke(c)}/>
        <circle cx="20" cy="20" r="6" fill="${c}" ${outlineStroke(c)}/>
      </svg>`;
 
    // ── Halloween ─────────────────────────────────────────────────────────────
    case 'pumpkin':
      return `<svg ${base}>
        <ellipse cx="20" cy="23" rx="14" ry="12" fill="${c}" ${outlineStroke(c)}/>
        <ellipse cx="10" cy="23" rx="6" ry="10" fill="${c}" ${outlineStroke(c)}/>
        <ellipse cx="30" cy="23" rx="6" ry="10" fill="${c}" ${outlineStroke(c)}/>
        <rect x="18" y="9" width="4" height="6" rx="2" fill="#4a9e5c"/>
        <path d="M18,12 Q14,8 11,10" stroke="#4a9e5c" stroke-width="1.5" fill="none"/>
        <polygon points="13,20 10,25 16,25" fill="${faceColor(c)}"/>
        <polygon points="27,20 24,25 30,25" fill="${faceColor(c)}"/>
        <path d="M11,29 Q20,34 29,29" stroke="${faceColor(c)}" stroke-width="1.5" fill="none"/>
        <line x1="16" y1="29" x2="15" y2="33" stroke="${faceColor(c)}" stroke-width="1.2"/>
        <line x1="20" y1="31" x2="20" y2="35" stroke="${faceColor(c)}" stroke-width="1.2"/>
        <line x1="24" y1="29" x2="25" y2="33" stroke="${faceColor(c)}" stroke-width="1.2"/>
        <ellipse cx="20" cy="23" rx="4" ry="6" fill="${c}" opacity="0.4"/>
      </svg>`;
 
    case 'ghost':
      return `<svg ${base}>
        <path d="M7,36 L7,18 Q7,4 20,4 Q33,4 33,18 L33,36 Q29,31 25,36 Q22,31 20,36 Q18,31 15,36 Q11,31 7,36 Z" fill="${c}" ${outlineStroke(c)}/>
        <ellipse cx="13" cy="18" rx="5" ry="3" fill="#ffb3b3" opacity="0.5"/>
        <ellipse cx="27" cy="18" rx="5" ry="3" fill="#ffb3b3" opacity="0.5"/>
        <ellipse cx="14" cy="17" rx="4" ry="5" fill="${faceColor(c)}"/>
        <ellipse cx="26" cy="17" rx="4" ry="5" fill="${faceColor(c)}"/>
        <circle cx="15" cy="15" r="1.5" fill="white"/>
        <circle cx="27" cy="15" r="1.5" fill="white"/>
        <path d="M15,25 Q20,28 25,25" stroke="${faceColor(c)}" stroke-width="1.2" fill="none"/>
      </svg>`;
 
    case 'bat':
      return `<svg ${base}>
        <path d="M20,22 Q12,14 3,12 Q7,18 9,22 Q5,20 2,22 Q8,25 13,29 Q16,32 18,30" fill="${c}" ${outlineStroke(c)}/>
        <path d="M20,22 Q28,14 37,12 Q33,18 31,22 Q35,20 38,22 Q32,25 27,29 Q24,32 22,30" fill="${c}" ${outlineStroke(c)}/>
        <ellipse cx="20" cy="24" rx="7" ry="9" fill="${c}" ${outlineStroke(c)}/>
        <polygon points="15,18 12,8 18,16" fill="${c}"/>
        <polygon points="25,18 28,8 22,16" fill="${c}"/>
        <ellipse cx="16" cy="21" rx="2.5" ry="3" fill="${faceColor(c)}"/>
        <ellipse cx="24" cy="21" rx="2.5" ry="3" fill="${faceColor(c)}"/>
        <circle cx="17" cy="20" r="1" fill="white"/>
        <circle cx="25" cy="20" r="1" fill="white"/>
        <polygon points="18,31 16,37 20,37" fill="white"/>
        <polygon points="22,31 20,37 24,37" fill="white"/>
      </svg>`;
 
    case 'cat':
      return `<svg ${base}>
        <polygon points="10,18 6,4 16,14" fill="${c}"/>
        <polygon points="30,18 34,4 24,14" fill="${c}"/>
        <polygon points="11,16 8,6 15,13" fill="#ff8888" opacity="0.6"/>
        <polygon points="29,16 32,6 25,13" fill="#ff8888" opacity="0.6"/>
        <ellipse cx="20" cy="24" rx="14" ry="13" fill="${c}" ${outlineStroke(c)}/>
        <ellipse cx="13" cy="21" rx="4" ry="5" fill="#ff8c00"/>
        <ellipse cx="27" cy="21" rx="4" ry="5" fill="#ff8c00"/>
        <ellipse cx="13" cy="21" rx="1.5" ry="4.5" fill="${faceColor(c)}"/>
        <ellipse cx="27" cy="21" rx="1.5" ry="4.5" fill="${faceColor(c)}"/>
        <circle cx="12" cy="19" r="1.2" fill="white"/>
        <circle cx="26" cy="19" r="1.2" fill="white"/>
        <polygon points="20,27 18,30 22,30" fill="#ff9999"/>
        <path d="M18,30 Q15,32 12,31" stroke="#888" stroke-width="0.9" fill="none"/>
        <path d="M22,30 Q25,32 28,31" stroke="#888" stroke-width="0.9" fill="none"/>
        <line x1="6" y1="24" x2="14" y2="26" stroke="#aaa" stroke-width="0.8"/>
        <line x1="6" y1="27" x2="14" y2="27" stroke="#aaa" stroke-width="0.8"/>
        <line x1="34" y1="24" x2="26" y2="26" stroke="#aaa" stroke-width="0.8"/>
        <line x1="34" y1="27" x2="26" y2="27" stroke="#aaa" stroke-width="0.8"/>
      </svg>`;
 
    case 'skull':
      return `<svg ${base}>
        <ellipse cx="20" cy="18" rx="14" ry="13" fill="${c}" ${outlineStroke(c)}/>
        <rect x="11" y="28" width="18" height="10" rx="3" fill="${c}" ${outlineStroke(c)}/>
        <ellipse cx="14" cy="17" rx="5.5" ry="6.5" fill="${faceColor(c)}"/>
        <ellipse cx="26" cy="17" rx="5.5" ry="6.5" fill="${faceColor(c)}"/>
        <circle cx="12" cy="15" r="2" fill="white" opacity="0.4"/>
        <circle cx="24" cy="15" r="2" fill="white" opacity="0.4"/>
        <path d="M17,24 Q20,26 23,24" stroke="${faceColor(c)}" stroke-width="1.2" fill="none"/>
        <line x1="16" y1="29" x2="16" y2="38" stroke="${faceColor(c)}" stroke-width="1.8"/>
        <line x1="20" y1="29" x2="20" y2="38" stroke="${faceColor(c)}" stroke-width="1.8"/>
        <line x1="24" y1="29" x2="24" y2="38" stroke="${faceColor(c)}" stroke-width="1.8"/>
        <ellipse cx="20" cy="12" rx="6" ry="2" fill="white" opacity="0.15"/>
      </svg>`;
 
    case 'witchhat':
      return `<svg ${base}>
        <ellipse cx="20" cy="34" rx="17" ry="5" fill="${c}" ${outlineStroke(c)}/>
        <path d="M20,3 L8,32 L32,32 Z" fill="${c}" ${outlineStroke(c)}/>
        <rect x="6" y="29" width="28" height="6" rx="1" fill="${c}" opacity="0.75"/>
        <rect x="14" y="30" width="12" height="4" rx="1" fill="#f4d35e" opacity="0.9"/>
        <rect x="17" y="31" width="6" height="2" rx="0.5" fill="${c}"/>
        <path d="M14,16 Q10,9 14,7 Q18,5 18,10" stroke="#f4d35e" stroke-width="1.4" fill="none" opacity="0.7"/>
        <circle cx="18" cy="10" r="1.5" fill="#f4d35e" opacity="0.7"/>
        <path d="M20,3 L21,8 L23,6 L22,10 L25,9 L22,12 L24,15" stroke="#f4d35e" stroke-width="0.8" fill="none" opacity="0.5"/>
      </svg>`;
 
    // ── Christmas ─────────────────────────────────────────────────────────────
    case 'ornament':
      return `<svg ${base}>
        <rect x="18" y="3" width="4" height="6" rx="1" fill="#999"/>
        <rect x="14" y="7" width="12" height="3" rx="1.5" fill="#bbb"/>
        <circle cx="20" cy="25" r="15" fill="${c}" ${outlineStroke(c)}/>
        <ellipse cx="14" cy="18" rx="4" ry="6" fill="white" opacity="0.2"/>
        <path d="M6,25 Q20,20 34,25" stroke="white" stroke-width="1.2" fill="none" opacity="0.3"/>
        <path d="M5,30 Q20,25 35,30" stroke="white" stroke-width="1" fill="none" opacity="0.2"/>
        <path d="M20,17 L21,21 L25,21 L22,23 L23,27 L20,25 L17,27 L18,23 L15,21 L19,21 Z" fill="white" opacity="0.35"/>
      </svg>`;
 
    case 'snowflake': {
      // Snowflake is stroke-only; on light colors darken the stroke for visibility
      const sf = hex => {
        const h2 = hex.replace('#','');
        const r2 = parseInt(h2.substring(0,2),16), g2 = parseInt(h2.substring(2,4),16), b2 = parseInt(h2.substring(4,6),16);
        return (0.299*r2+0.587*g2+0.114*b2)/255 > 0.75 ? '#888' : hex;
      };
      const sc = sf(c);
      return `<svg ${base}>
        <g stroke="${sc}" stroke-linecap="round">
          <line x1="20" y1="3"  x2="20" y2="37" stroke-width="2.5"/>
          <line x1="3"  y1="20" x2="37" y2="20" stroke-width="2.5"/>
          <line x1="7"  y1="7"  x2="33" y2="33" stroke-width="2.5"/>
          <line x1="33" y1="7"  x2="7"  y2="33" stroke-width="2.5"/>
          <line x1="20" y1="3"  x2="15" y2="8"  stroke-width="2"/>
          <line x1="20" y1="3"  x2="25" y2="8"  stroke-width="2"/>
          <line x1="20" y1="37" x2="15" y2="32" stroke-width="2"/>
          <line x1="20" y1="37" x2="25" y2="32" stroke-width="2"/>
          <line x1="3"  y1="20" x2="8"  y2="15" stroke-width="2"/>
          <line x1="3"  y1="20" x2="8"  y2="25" stroke-width="2"/>
          <line x1="37" y1="20" x2="32" y2="15" stroke-width="2"/>
          <line x1="37" y1="20" x2="32" y2="25" stroke-width="2"/>
          <line x1="7"  y1="7"  x2="12" y2="7"  stroke-width="2"/>
          <line x1="7"  y1="7"  x2="7"  y2="12" stroke-width="2"/>
          <line x1="33" y1="7"  x2="28" y2="7"  stroke-width="2"/>
          <line x1="33" y1="7"  x2="33" y2="12" stroke-width="2"/>
          <line x1="7"  y1="33" x2="12" y2="33" stroke-width="2"/>
          <line x1="7"  y1="33" x2="7"  y2="28" stroke-width="2"/>
          <line x1="33" y1="33" x2="28" y2="33" stroke-width="2"/>
          <line x1="33" y1="33" x2="33" y2="28" stroke-width="2"/>
        </g>
        <circle cx="20" cy="20" r="4" fill="${sc}"/>
        <circle cx="20" cy="20" r="2" fill="white" opacity="0.5"/>
      </svg>`;
    }
 
    case 'present':
      return `<svg ${base}>
        <rect x="5"  y="18" width="30" height="20" rx="2" fill="${c}" ${outlineStroke(c)}/>
        <rect x="4"  y="13" width="32" height="8"  rx="2" fill="${c}" opacity="0.8" ${outlineStroke(c)}/>
        <rect x="17" y="13" width="6"  height="25" fill="white" opacity="0.3"/>
        <rect x="4"  y="17" width="32" height="4"  fill="white" opacity="0.3"/>
        <path d="M20,13 Q12,5 9,8  Q6,11 11,13 Z" fill="gray" opacity="0.4"/>
        <path d="M20,13 Q28,5 31,8 Q34,11 29,13 Z" fill="gray" opacity="0.4"/>
        <circle cx="20" cy="13" r="3" fill="gray" opacity="0.5"/>
        <rect x="7" y="20" width="8" height="3" rx="1.5" fill="gray" opacity="0.15"/>
      </svg>`;
 
    case 'stocking':
      return `<svg ${base}>
        <path d="M13,3 L13,27 Q13,38 24,38 Q35,38 35,30 Q35,23 27,22 L27,3 Z" fill="${c}" ${outlineStroke(c)}/>
        <rect x="11" y="3" width="18" height="7" rx="3" fill="white" opacity="0.8"/>
        <circle cx="15" cy="6.5" r="1.5" fill="${c}" opacity="0.6"/>
        <circle cx="19" cy="6.5" r="1.5" fill="${c}" opacity="0.6"/>
        <circle cx="23" cy="6.5" r="1.5" fill="${c}" opacity="0.6"/>
        <path d="M27,22 Q35,22 35,30 Q35,35 30,37" stroke="white" stroke-width="1.2" fill="none" opacity="0.25"/>
        <ellipse cx="16" cy="28" rx="3" ry="5" fill="white" opacity="0.12"/>
      </svg>`;
 
    case 'bell':
      return `<svg ${base}>
        <rect x="18" y="2"  width="4" height="5" rx="2" fill="#999"/>
        <ellipse cx="20" cy="8" rx="6" ry="2" fill="#bbb"/>
        <path d="M20,7 Q8,7 8,22 L8,30 L32,30 L32,22 Q32,7 20,7 Z" fill="${c}" ${outlineStroke(c)}/>
        <ellipse cx="20" cy="30" rx="12" ry="3.5" fill="${c}" opacity="0.85"/>
        <circle cx="20" cy="35" r="3.5" fill="${c}" opacity="0.9"/>
        <ellipse cx="14" cy="18" rx="3" ry="5" fill="white" opacity="0.2"/>
        <path d="M12,24 Q20,27 28,24" stroke="white" stroke-width="1" fill="none" opacity="0.25"/>
        <circle cx="28" cy="8"  r="3" fill="#2d6a2d"/>
        <circle cx="22" cy="6"  r="3" fill="#2d6a2d"/>
        <circle cx="16" cy="8"  r="3" fill="#2d6a2d"/>
        <circle cx="21" cy="5"  r="2" fill="#cc2222"/>
        <circle cx="25" cy="6"  r="2" fill="#cc2222"/>
      </svg>`;
 
    case 'tree':
      return `<svg ${base}>
        <polygon points="20,2 6,16 12,16 5,25 11,25 5,36 35,36 29,25 35,25 28,16 34,16" fill="${c}" ${outlineStroke(c)}/>
        <rect x="17" y="34" width="6" height="6" fill="#8B4513"/>
        <path d="M20,2 L21,5 L23,3 L21,7" stroke="#f4d35e" stroke-width="1" fill="none" opacity="0.8"/>
        <path d="M20,2 L18,4 L19,7" stroke="#f4d35e" stroke-width="0.8" fill="none" opacity="0.6"/>
        <circle cx="12" cy="20" r="2"   fill="#cc2222"/>
        <circle cx="28" cy="17" r="2"   fill="#f4d35e"/>
        <circle cx="26" cy="27" r="2"   fill="#4895ef"/>
        <circle cx="14" cy="28" r="1.8" fill="#f4d35e"/>
        <circle cx="20" cy="22" r="1.8" fill="#cc2222"/>
        <circle cx="22" cy="30" r="1.5" fill="#e85d9a"/>
        <path d="M20,2 L21.2,6 L25,6 L22,8.5 L23.2,12.5 L20,10 L16.8,12.5 L18,8.5 L15,6 L18.8,6 Z" fill="#f4d35e"/>
      </svg>`;
 
    default:
      return `<svg ${base}><circle cx="20" cy="20" r="17" fill="${c}"/></svg>`;
  }
};

// ── Socket.IO ──────────────────────────────────────────────────────────────
const socket = io(API_URL);

// ── Client State (UI only) ─────────────────────────────────────────────────
let state = {
  board: {},
  players: [],
  currentPlayer: 0,
  bagCount: 0,
  gameOver: false,
  yourHand: [],
  yourIdx: null,
  pendingPlacements: [],  // [{row, col, tile, handIdx}] — tracked client-side for previews
  selectedHandIdx: null,
  exchangeMode: false,    // true when player is selecting tiles to exchange
  exchangeIdxs: new Set(), // hand indices selected for exchange
};

// ── Socket Events ──────────────────────────────────────────────────────────
socket.on('joined', ({ roomId, playerIdx }) => {
  state.yourIdx = playerIdx;
  logMsg(`Joined room ${roomId} as player ${playerIdx + 1}.`);
});

socket.on('state', (serverState) => {
  state.board = serverState.board;
  state.players = serverState.players;
  state.currentPlayer = serverState.currentPlayer;
  state.bagCount = serverState.bagCount;
  state.gameOver = serverState.gameOver;
  state.yourHand = serverState.yourHand;

  // Clear pending once server confirms the move
  state.pendingPlacements = [];
  state.selectedHandIdx = null;
  state.exchangeMode = false;
  state.exchangeIdxs = new Set();

  if (serverState.logMsg) logMsg(serverState.logMsg, serverState.logMsg.includes('QWIRKLE'));
  if (serverState.gameOver && serverState.winner) {
    showOverlay(`${serverState.winner} Wins!`, `Final score: ${serverState.winnerScore} points`);
  }

  renderAll();
});

socket.on('error', ({ message }) => {
  logMsg(`❌ ${message}`, true);
  // Roll back any pending placements on error
  state.pendingPlacements = [];
  state.selectedHandIdx = null;
  state.exchangeMode = false;
  state.exchangeIdxs = new Set();
  renderBoard();
  renderHand();
  updateButtons();
});

// ── Join / New Game ────────────────────────────────────────────────────────
const joinGame = async (numPlayers = 2, playerName = 'You') => {
  const res = await fetch(`${API_URL}/qwirkle/rooms`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ numPlayers }),
  });
  const { roomId } = await res.json();
  socket.emit('join', { roomId, playerName });
  return roomId;
};

const showLobby = async () => {
  const params = new URLSearchParams(window.location.search);
  const roomCode = params.get('room');
  const playerName = params.get('name');
  const theme = params.get('theme');

  // No name yet — send to lobby to pick one, preserving room code and theme
  if (!playerName) {
    const lobbyUrl = new URL('index.html', window.location.href);
    if (roomCode) lobbyUrl.searchParams.set('room', roomCode);
    if (theme) lobbyUrl.searchParams.set('theme', theme);
    window.location.href = lobbyUrl.toString();
    return;
  }

  if (roomCode) {
    // Joining an existing room
    socket.emit('join', { roomId: roomCode.toUpperCase(), playerName });
  } else {
    // Creating a new room
    const numPlayers = Number(params.get('players') || 2);
    const roomId = await joinGame(numPlayers, playerName);
    // Shareable link goes to lobby with room code and theme
    const shareUrl = new URL('index.html', window.location.href);
    shareUrl.searchParams.set('room', roomId);
    if (theme) shareUrl.searchParams.set('theme', theme);
    logMsg(`Share this link with your opponent: ${shareUrl}`);
    // Update current URL to include room without redirecting
    const gameUrl = new URL(window.location.href);
    gameUrl.searchParams.set('room', roomId);
    window.history.replaceState({}, '', gameUrl);
  }
};

// ── Render ──────────────────────────────────────────────────────────────────
const renderAll = () => {
  renderScores();
  renderBoard();
  renderHand();
  renderBag();
  updateButtons();
  updateBanner();
};

const renderScores = () => {
  const el = document.getElementById('scores');
  el.innerHTML = state.players.map((p, i) => `
    <div class="score-card ${i === state.currentPlayer ? 'active' : ''}">
      <div class="name">${p.name}</div>
      <div class="points">${p.score}</div>
    </div>
  `).join('');
};

const renderBag = () => {
  document.getElementById('bag-count').textContent = `Bag: ${state.bagCount}`;
};

const updateBanner = () => {
  const isMyTurn = state.currentPlayer === state.yourIdx;
  document.getElementById('turn-banner').textContent = isMyTurn
    ? 'Your turn — select a tile then click a cell'
    : `${state.players[state.currentPlayer]?.name ?? '...'} is playing...`;
};

// ── SVG Rendering ─────────────────────────────────────────────────────────

const tileHTML = (tile, idx, isSelected, isPlaced, isExchangeSelected = false) => {
  const sel = isSelected ? 'selected' : '';
  const pla = isPlaced ? 'placed' : '';
  const exch = isExchangeSelected ? 'exchange-selected' : '';
  const dot = isPlaced ? '<span class="placed-indicator"></span>' : '';
  const exchMark = isExchangeSelected ? '<span class="exchange-indicator">↩</span>' : '';
  return `<div class="tile ${sel} ${pla} ${exch}"
    data-idx="${idx}"
    onclick="selectTile(${idx})"
    title="${tile.color} ${tile.shape}">
    ${shapeSVG(tile.shape, tile.color)}
    ${dot}${exchMark}
  </div>`;
};

const renderHand = () => {
  const isMyTurn = state.currentPlayer === state.yourIdx;
  const placedIdxs = new Set(state.pendingPlacements.map(p => p.handIdx));
  document.getElementById('hand').innerHTML = state.yourHand.map((tile, i) =>
    tileHTML(tile, i, state.selectedHandIdx === i, placedIdxs.has(i), state.exchangeIdxs.has(i))
  ).join('');
};

const renderBoard = () => {
  let minR = CENTER - 5, maxR = CENTER + 5;
  let minC = CENTER - 5, maxC = CENTER + 5;

  // Expand visible area around all placed tiles
  const allKeys = [...Object.keys(state.board), ...state.pendingPlacements.map(p => `${p.row},${p.col}`)];
  for (const key of allKeys) {
    const [r, c] = key.split(',').map(Number);
    minR = Math.min(minR, r - 2); maxR = Math.max(maxR, r + 2);
    minC = Math.min(minC, c - 2); maxC = Math.max(maxC, c + 2);
  }

  const cols = maxC - minC + 1;
  const rows = maxR - minR + 1;
  const boardEl = document.getElementById('board');
  boardEl.style.gridTemplateColumns = `repeat(${cols}, var(--cell-size))`;
  boardEl.style.gridTemplateRows = `repeat(${rows}, var(--cell-size))`;

  const isMyTurn = state.currentPlayer === state.yourIdx;
  const validCells = isMyTurn && state.selectedHandIdx !== null ? getValidCells() : new Set();

  let html = '';
  for (let r = minR; r <= maxR; r++) {
    for (let c = minC; c <= maxC; c++) {
      const key = `${r},${c}`;
      const tile = state.board[key];
      const pending = state.pendingPlacements.find(p => p.row === r && p.col === c);
      const isValid = validCells.has(key);

      if (tile || pending) {
        const t = tile || pending.tile;
        const preview = pending ? 'preview' : '';
        html += `<div class="cell ${preview}" style="position:relative;">
          <div class="tile" style="cursor:default;width:60px;height:60px;">${shapeSVG(t.shape, t.color)}</div>
        </div>`;
      } else if (isValid) {
        html += `<div class="cell droppable" data-row="${r}" data-col="${c}" onclick="placeOnBoard(${r},${c})"></div>`;
      } else {
        html += `<div class="cell"></div>`;
      }
    }
  }
  boardEl.innerHTML = html;
};

// ── Valid Cell Highlighting (client-side UX only, server re-validates) ──────
const getValidCells = () => {
  const valid = new Set();
  const boardAndPending = {
    ...state.board,
    ...Object.fromEntries(state.pendingPlacements.map(p => [`${p.row},${p.col}`, p.tile])),
  };
  const boardEmpty = Object.keys(state.board).length === 0 && state.pendingPlacements.length === 0;

  if (boardEmpty) {
    valid.add(`${CENTER},${CENTER}`);
    return valid;
  }

  // Determine locked direction and axis value from pending placements
  let dir = null;
  let lockedRow = null;
  let lockedCol = null;
  if (state.pendingPlacements.length === 1) {
    // Direction not yet locked — both axes still open
  } else if (state.pendingPlacements.length >= 2) {
    const pRows = state.pendingPlacements.map(p => p.row);
    const pCols = state.pendingPlacements.map(p => p.col);
    if (pRows.every(r => r === pRows[0])) { dir = 'h'; lockedRow = pRows[0]; }
    else { dir = 'v'; lockedCol = pCols[0]; }
  }

  for (const key of Object.keys(boardAndPending)) {
    const [r, c] = key.split(',').map(Number);
    for (const [nr, nc] of [[r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]]) {
      const nkey = `${nr},${nc}`;
      if (boardAndPending[nkey]) continue;

      // Once direction is locked, only allow cells on that axis
      if (dir === 'h' && nr !== lockedRow) continue;
      if (dir === 'v' && nc !== lockedCol) continue;

      // With pending tiles placed, the candidate must be on the same line as
      // pending placements — either adjacent to a pending tile, or on the
      // pending line (which may be bridged by existing board tiles)
      if (state.pendingPlacements.length > 0 && !isOnPendingLineOrAdjacent(nr, nc, boardAndPending)) continue;

      if (wouldBeValidLocally(nr, nc)) valid.add(nkey);
    }
  }

  return valid;
};

// A candidate cell is valid if it's directly adjacent to a pending tile, OR
// it sits on the same row/col as the pending line and is reachable without
// gaps (existing board tiles can bridge the space between pending placements).
const isOnPendingLineOrAdjacent = (r, c, boardAndPending) => {
  if (state.pendingPlacements.length === 0) return true;

  // Always allow cells directly adjacent to a pending tile
  const adjacentToPending = state.pendingPlacements.some(p =>
    (Math.abs(p.row - r) === 1 && p.col === c) || (Math.abs(p.col - c) === 1 && p.row === r)
  );
  if (adjacentToPending) return true;

  // For 2+ pending tiles, also allow cells on the same axis that are reachable
  // from a pending tile with no gaps (board tiles may bridge the gap)
  if (state.pendingPlacements.length < 1) return false;

  const pRows = state.pendingPlacements.map(p => p.row);
  const pCols = state.pendingPlacements.map(p => p.col);
  const isHorizontal = pRows.every(ro => ro === pRows[0]);
  const isVertical = pCols.every(co => co === pCols[0]);

  if (isHorizontal && r === pRows[0]) {
    // Check there's a contiguous path of tiles from the nearest pending tile to (r,c)
    const pendingCols = pCols.sort((a, b) => a - b);
    if (c < pendingCols[0]) {
      for (let sc = c + 1; sc < pendingCols[0]; sc++) {
        if (!boardAndPending[`${r},${sc}`]) return false;
      }
      return true;
    }
    if (c > pendingCols[pendingCols.length - 1]) {
      for (let sc = pendingCols[pendingCols.length - 1] + 1; sc < c; sc++) {
        if (!boardAndPending[`${r},${sc}`]) return false;
      }
      return true;
    }
  }

  if (isVertical && c === pCols[0]) {
    const pendingRows = pRows.sort((a, b) => a - b);
    if (r < pendingRows[0]) {
      for (let sr = r + 1; sr < pendingRows[0]; sr++) {
        if (!boardAndPending[`${sr},${c}`]) return false;
      }
      return true;
    }
    if (r > pendingRows[pendingRows.length - 1]) {
      for (let sr = pendingRows[pendingRows.length - 1] + 1; sr < r; sr++) {
        if (!boardAndPending[`${sr},${c}`]) return false;
      }
      return true;
    }
  }

  return false;
};

const wouldBeValidLocally = (row, col) => {
  if (state.selectedHandIdx === null) return false;
  const tile = state.yourHand[state.selectedHandIdx];
  if (!tile) return false;

  const otherBoard = {
    ...state.board,
    ...Object.fromEntries(state.pendingPlacements.map(p => [`${p.row},${p.col}`, p.tile])),
  };

  return checkLineLocally(row, col, tile, 'h', otherBoard) &&
         checkLineLocally(row, col, tile, 'v', otherBoard);
};

const checkLineLocally = (row, col, tile, dir, board) => {
  const line = [tile];
  if (dir === 'h') {
    for (let dc = 1; dc < 7; dc++) { const t = board[`${row},${col + dc}`]; if (!t) break; line.push(t); }
    for (let dc = 1; dc < 7; dc++) { const t = board[`${row},${col - dc}`]; if (!t) break; line.push(t); }
  } else {
    for (let dr = 1; dr < 7; dr++) { const t = board[`${row + dr},${col}`]; if (!t) break; line.push(t); }
    for (let dr = 1; dr < 7; dr++) { const t = board[`${row - dr},${col}`]; if (!t) break; line.push(t); }
  }
  if (line.length > 6) return false;
  if (line.length <= 1) return true;
  const colors = new Set(line.map(t => t.color));
  const shapes = new Set(line.map(t => t.shape));
  if (colors.size === 1) return shapes.size === line.length;
  if (shapes.size === 1) return colors.size === line.length;
  return false;
};

// ── Tile Selection & Placement (local preview only) ────────────────────────
const selectTile = (idx) => {
  if (state.currentPlayer !== state.yourIdx || state.gameOver) return;

  if (state.exchangeMode) {
    // In exchange mode, toggle tile in the exchange selection set
    if (state.exchangeIdxs.has(idx)) state.exchangeIdxs.delete(idx);
    else state.exchangeIdxs.add(idx);
    updateButtons();
    renderHand();
    return;
  }

  const placedIdxs = new Set(state.pendingPlacements.map(p => p.handIdx));
  if (placedIdxs.has(idx)) return;

  state.selectedHandIdx = state.selectedHandIdx === idx ? null : idx;
  renderBoard();
  renderHand();
};

const placeOnBoard = (row, col) => {
  if (state.selectedHandIdx === null || state.gameOver) return;
  const tile = state.yourHand[state.selectedHandIdx];

  state.pendingPlacements.push({ row, col, tile, handIdx: state.selectedHandIdx });
  state.selectedHandIdx = null;

  updateButtons();
  renderBoard();
  renderHand();
};

const cancelPlacement = (row, col) => {
  state.pendingPlacements = state.pendingPlacements.filter(p => !(p.row === row && p.col === col));
  state.pendingPlacements = pruneInvalidPlacements(state.pendingPlacements);
  state.selectedHandIdx = null;
  updateButtons();
  renderBoard();
  renderHand();
};

// After removing a tile, the remaining pending placements may be invalid —
// e.g. they're no longer collinear, or gaps have opened up. Remove any that
// no longer belong, keeping the longest valid contiguous subset on one axis.
const pruneInvalidPlacements = (placements) => {
  if (placements.length <= 1) return placements;

  const rows = placements.map(p => p.row);
  const cols = placements.map(p => p.col);
  const allSameRow = rows.every(r => r === rows[0]);
  const allSameCol = cols.every(c => c === cols[0]);

  // If they're no longer collinear, keep only the first tile
  if (!allSameRow && !allSameCol) return [placements[0]];

  // Check for gaps — a gap means tiles on either side of the removed cell
  // are now disconnected; keep only the group that stays contiguous.
  const boardWithPending = {
    ...state.board,
    ...Object.fromEntries(placements.map(p => [`${p.row},${p.col}`, p.tile])),
  };

  if (allSameRow) {
    const r = rows[0];
    const sorted = [...placements].sort((a, b) => a.col - b.col);
    // Find the largest contiguous run (including board tiles that may bridge)
    const groups = [];
    let group = [sorted[0]];
    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i - 1].col;
      const curr = sorted[i].col;
      // Check every cell between prev and curr is filled (board or pending)
      let contiguous = true;
      for (let c = prev + 1; c < curr; c++) {
        if (!boardWithPending[`${r},${c}`]) { contiguous = false; break; }
      }
      if (contiguous) group.push(sorted[i]);
      else { groups.push(group); group = [sorted[i]]; }
    }
    groups.push(group);
    // Keep the largest group
    const best = groups.reduce((a, b) => b.length > a.length ? b : a);
    return best;
  }

  if (allSameCol) {
    const c = cols[0];
    const sorted = [...placements].sort((a, b) => a.row - b.row);
    const groups = [];
    let group = [sorted[0]];
    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i - 1].row;
      const curr = sorted[i].row;
      let contiguous = true;
      for (let r = prev + 1; r < curr; r++) {
        if (!boardWithPending[`${r},${c}`]) { contiguous = false; break; }
      }
      if (contiguous) group.push(sorted[i]);
      else { groups.push(group); group = [sorted[i]]; }
    }
    groups.push(group);
    const best = groups.reduce((a, b) => b.length > a.length ? b : a);
    return best;
  }

  return placements;
};

// ── Button Actions ──────────────────────────────────────────────────────────
const updateButtons = () => {
  const isMyTurn = state.currentPlayer === state.yourIdx;
  const btnExchange = document.getElementById('btn-exchange');
  document.getElementById('btn-play').disabled = !isMyTurn || state.pendingPlacements.length === 0 || state.exchangeMode;
  if (state.exchangeMode) {
    btnExchange.textContent = state.exchangeIdxs.size > 0 ? `Confirm Exchange (${state.exchangeIdxs.size})` : 'Confirm Exchange';
    btnExchange.disabled = !isMyTurn || state.exchangeIdxs.size === 0;
  } else {
    btnExchange.textContent = 'Exchange';
    btnExchange.disabled = !isMyTurn || state.bagCount === 0 || state.pendingPlacements.length > 0;
  }
  document.getElementById('btn-cancel').disabled = !isMyTurn || (
    state.pendingPlacements.length === 0 && state.selectedHandIdx === null && !state.exchangeMode
  );
};

document.getElementById('btn-play').onclick = () => {
  if (state.pendingPlacements.length === 0) return;
  socket.emit('play', { pendingPlacements: state.pendingPlacements });
};

document.getElementById('btn-exchange').onclick = () => {
  if (!state.exchangeMode) {
    // First click: enter exchange mode
    state.exchangeMode = true;
    state.exchangeIdxs = new Set();
    state.selectedHandIdx = null;
    renderBoard(); // clear valid cell highlights
    renderHand();
    updateButtons();
  } else {
    // Second click (confirm): emit with selected indices
    if (state.exchangeIdxs.size === 0) return;
    socket.emit('exchange', { handIdxs: [...state.exchangeIdxs] });
  }
};

document.getElementById('btn-cancel').onclick = () => {
  state.pendingPlacements = [];
  state.selectedHandIdx = null;
  state.exchangeMode = false;
  state.exchangeIdxs = new Set();
  renderBoard();
  renderHand();
  updateButtons();
};

// ── Log ─────────────────────────────────────────────────────────────────────
const logMsg = (msg, highlight = false) => {
  const log = document.getElementById('log');
  const span = document.createElement('span');
  span.textContent = msg;
  if (highlight) span.classList.add('highlight');
  log.prepend(span);
};

// ── Overlay ──────────────────────────────────────────────────────────────────
const showOverlay = (title, msg) => {
  document.getElementById('overlay-title').textContent = title;
  document.getElementById('overlay-msg').textContent = msg;
  document.getElementById('overlay').style.display = 'flex';
};

document.getElementById('overlay-btn').onclick = () => {
  // Send back to lobby to pick a name for the new game
  const lobbyUrl = new URL('index.html', window.location.href);
  window.location.href = lobbyUrl.toString();
};

// ── Board Pan ────────────────────────────────────────────────────────────────
(function () {
  const bc = document.getElementById('board-container');
  let dragging = false, sx, sy, sl, st;
  bc.addEventListener('mousedown', e => {
    if (e.target.classList.contains('cell') || e.target.classList.contains('tile')) return;
    dragging = true; sx = e.clientX; sy = e.clientY; sl = bc.scrollLeft; st = bc.scrollTop;
  });
  document.addEventListener('mousemove', e => {
    if (!dragging) return;
    bc.scrollLeft = sl - (e.clientX - sx);
    bc.scrollTop = st - (e.clientY - sy);
  });
  document.addEventListener('mouseup', () => dragging = false);
})();

// ── Start ────────────────────────────────────────────────────────────────────
showLobby();

setTimeout(() => {
  const bc = document.getElementById('board-container');
  const b = document.getElementById('board');
  bc.scrollLeft = (b.offsetWidth - bc.offsetWidth) / 2;
  bc.scrollTop = (b.offsetHeight - bc.offsetHeight) / 2;
}, 50);