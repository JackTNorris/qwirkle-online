/*
TODO:
=================
ESSENTIAL:
- Fix rule that prevents non-contiguous addition on the same line
- Fix swapping tiles functionality
- Increase padding on edges to allow large plays
- Add in login
- Cancelling only part of move (add x's on pieces)
- Themes: halloween and christmas themes with different colors and tile shapes
  - Halloween
    - black, orange, green, purple, yellow, red
    - pumpkin, ghost, bat, cat, skull, witch hat
  - Christmas
    - tree, present, stocking, snowflake, bell, ornament
    - red, green, silver, gold, white, pink 
NICE TO HAVES:
- Saving games
- Score history
- drag and drop

*/

// ── Constants ──────────────────────────────────────────────────────────────
const COLORS = ['red','orange','yellow','green','blue','purple'];
const SHAPES = ['circle','4star','diamond','square','8star','clover'];
const HAND_SIZE = 6;
const GRID_SIZE = 91; // center at 45,45
const CENTER = 45;

// ── State ──────────────────────────────────────────────────────────────────
let state = {
  bag: [],
  players: [],
  currentPlayer: 0,
  board: {}, // "row,col" -> {color, shape}
  pendingPlacements: [], // [{row,col,tile}]
  selectedTile: null,
  selectedHandIdx: null,
  gameOver: false,
  numPlayers: 2,
};

// ── Tile Creation ──────────────────────────────────────────────────────────
function createBag() {
  const bag = [];
  for (let i = 0; i < 3; i++)
    for (const c of COLORS)
      for (const s of SHAPES)
        bag.push({ color: c, shape: s });
  return shuffle(bag);
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// ── Game Init ──────────────────────────────────────────────────────────────
function initGame(numPlayers) {
  state.bag = createBag();
  state.numPlayers = numPlayers;
  state.board = {};
  state.pendingPlacements = [];
  state.selectedTile = null;
  state.selectedHandIdx = null;
  state.gameOver = false;
  state.currentPlayer = 0;

  state.players = Array.from({ length: numPlayers }, (_, i) => ({
    name: i === 0 ? 'You' : `CPU ${i}`,
    hand: [],
    score: 0,
    isAI: i !== 0,
  }));

  for (const p of state.players) {
    p.hand = state.bag.splice(0, HAND_SIZE);
  }

  // Find who goes first: most tiles of one kind
  let bestCount = -1, bestIdx = 0;
  state.players.forEach((p, i) => {
    const best = bestStartCount(p.hand);
    if (best > bestCount) { bestCount = best; bestIdx = i; }
  });
  state.currentPlayer = bestIdx;

  renderAll();
  logMsg(`Game started! ${state.players[state.currentPlayer].name} goes first.`);
  if (state.players[state.currentPlayer].isAI) setTimeout(aiTurn, 800);
}

function bestStartCount(hand) {
  let best = 0;
  for (const c of COLORS) {
    const cnt = hand.filter(t => t.color === c).length;
    if (cnt > best) best = cnt;
  }
  for (const s of SHAPES) {
    const cnt = hand.filter(t => t.shape === s).length;
    if (cnt > best) best = cnt;
  }
  return best;
}

// ── Render ──────────────────────────────────────────────────────────────────
function renderAll() {
  renderScores();
  renderBoard();
  renderHand();
  renderBag();
  updateButtons();
  updateBanner();
}

function renderScores() {
  const el = document.getElementById('scores');
  el.innerHTML = state.players.map((p, i) => `
    <div class="score-card ${i === state.currentPlayer ? 'active' : ''}">
      <div class="name">${p.name}</div>
      <div class="points">${p.score}</div>
    </div>
  `).join('');
}

function renderBag() {
  document.getElementById('bag-count').textContent = `Bag: ${state.bag.length}`;
}

function updateBanner() {
  const p = state.players[state.currentPlayer];
  document.getElementById('turn-banner').textContent =
    p.isAI ? `${p.name} is thinking...` : "Your turn — select a tile then click a cell";
}

function shapeSVG(shape, color) {
  const c = tileColor(color);
  const base = `viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg"`;
  switch (shape) {
    case 'circle':
      return `<svg ${base}><circle cx="20" cy="20" r="17" fill="${c}"/></svg>`;
    case 'square':
      return `<svg ${base}><rect x="4" y="4" width="32" height="32" fill="${c}"/></svg>`;
    case 'diamond':
      return `<svg ${base}><polygon points="20,2 38,20 20,38 2,20" fill="${c}"/></svg>`;
    case '4star': {
      // 4-pointed star (cross/plus star)
      const p = 'M20,2 L23,17 L38,20 L23,23 L20,38 L17,23 L2,20 L17,17 Z';
      return `<svg ${base}><path d="${p}" fill="${c}"/></svg>`;
    }
    case '8star': {
      // 8-pointed starburst
      const pts = [];
      for (let i = 0; i < 16; i++) {
        const angle = (i * Math.PI) / 8 - Math.PI / 2;
        const r = i % 2 === 0 ? 18 : 9;
        pts.push(`${20 + r * Math.cos(angle)},${20 + r * Math.sin(angle)}`);
      }
      return `<svg ${base}><polygon points="${pts.join(' ')}" fill="${c}"/></svg>`;
    }
    case 'clover': {
      // 4-leaf clover: four circles arranged around center
      const r = 8, off = 8;
      return `<svg ${base}>
        <circle cx="20" cy="${20-off}" r="${r}" fill="${c}"/>
        <circle cx="20" cy="${20+off}" r="${r}" fill="${c}"/>
        <circle cx="${20-off}" cy="20" r="${r}" fill="${c}"/>
        <circle cx="${20+off}" cy="20" r="${r}" fill="${c}"/>
        <circle cx="20" cy="20" r="6" fill="${c}"/>
      </svg>`;
    }
    default:
      return `<svg ${base}><circle cx="20" cy="20" r="17" fill="${c}"/></svg>`;
  }
}

function tileColor(color) {
  const map = { red:'#e84040', orange:'#f4a261', yellow:'#f4d35e', green:'#52b788', blue:'#4895ef', purple:'#b14aed' };
  return map[color] || '#fff';
}

function tileHTML(tile, idx, isSelected, isPlaced) {
  const sel = isSelected ? 'selected' : '';
  const pla = isPlaced ? 'placed' : '';
  const dot = isPlaced ? '<span class="placed-indicator"></span>' : '';
  return `<div class="tile ${sel} ${pla}" 
    data-idx="${idx}"
    onclick="selectTile(${idx})"
    title="${tile.color} ${tile.shape}">
    ${shapeSVG(tile.shape, tile.color)}
    ${dot}
  </div>`;
}

function renderHand() {
  const player = state.players[state.currentPlayer];
  if (player.isAI) { document.getElementById('hand').innerHTML = '<div style="color:var(--muted);font-size:0.85rem;padding:8px;">AI is playing...</div>'; return; }
  const placedIdxs = new Set(state.pendingPlacements.map(p => p.handIdx));
  document.getElementById('hand').innerHTML = player.hand.map((tile, i) =>
    tileHTML(tile, i, state.selectedHandIdx === i, placedIdxs.has(i))
  ).join('');
}

function renderBoard() {
  // Determine visible range
  let minR = CENTER - 5, maxR = CENTER + 5;
  let minC = CENTER - 5, maxC = CENTER + 5;
  for (const key of Object.keys(state.board)) {
    const [r, c] = key.split(',').map(Number);
    minR = Math.min(minR, r - 2); maxR = Math.max(maxR, r + 2);
    minC = Math.min(minC, c - 2); maxC = Math.max(maxC, c + 2);
  }

  const rows = maxR - minR + 1;
  const cols = maxC - minC + 1;
  const boardEl = document.getElementById('board');
  boardEl.style.gridTemplateColumns = `repeat(${cols}, var(--cell-size))`;
  boardEl.style.gridTemplateRows = `repeat(${rows}, var(--cell-size))`;

  // Compute valid drop cells
  const validCells = state.selectedHandIdx !== null && !state.players[state.currentPlayer].isAI
    ? getValidCells() : new Set();

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
        html += `<div class="cell ${preview}">
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
}

// ── Valid Placement Logic ───────────────────────────────────────────────────
function getValidCells() {
  const valid = new Set();
  const boardEmpty = Object.keys(state.board).length === 0 && state.pendingPlacements.length === 0;

  // default to center if board is empty and no pending placements (first move)
  if (boardEmpty && state.pendingPlacements.length === 0) {
    valid.add(`${CENTER},${CENTER}`);
    return valid;
  }

  // Determine direction from pending placements
  let dir = null;
  if (state.pendingPlacements.length >= 2) {
    const rows = state.pendingPlacements.map(p => p.row);
    const cols = state.pendingPlacements.map(p => p.col);
    dir = rows.every(r => r === rows[0]) ? 'h' : 'v';
  }

  const allCells = [...Object.keys(state.board), ...state.pendingPlacements.map(p => `${p.row},${p.col}`)];


  // Adjacent to existing tiles
  const adjacentTo = state.pendingPlacements.length === 0
    ? Object.keys(state.board)
    : state.pendingPlacements.map(p => `${p.row},${p.col}`);

  for (const key of allCells) {
    const [r, c] = key.split(',').map(Number);
    const neighbors = [[r-1,c],[r+1,c],[r,c-1],[r,c+1]];
    for (const [nr, nc] of neighbors) {
      const nkey = `${nr},${nc}`;
      if (!state.board[nkey] && !state.pendingPlacements.find(p => p.row === nr && p.col === nc)) {
        // Check direction constraint
        if (dir === 'h' && state.pendingPlacements.length > 0) {
          const pendRow = state.pendingPlacements[0].row;
          if (nr !== pendRow) continue;
        }
        if (dir === 'v' && state.pendingPlacements.length > 0) {
          const pendCol = state.pendingPlacements[0].col;
          if (nc !== pendCol) continue;
        }
        if (state.pendingPlacements.length > 0) {
          if (!isAdjacentToPending(nr, nc) && !isOnPendingLine(nr, nc)) continue;
        }
        if (wouldBeValid(nr, nc, state.selectedHandIdx)) {
          valid.add(nkey);
        }
      }
    }
  }

  // If board is empty, allow center
  if (Object.keys(state.board).length === 0 && state.pendingPlacements.length === 0) {
    valid.add(`${CENTER},${CENTER}`);
  }

  return valid;
}

function isAdjacentToPending(r, c) {
  return state.pendingPlacements.some(p =>
    (Math.abs(p.row - r) === 1 && p.col === c) ||
    (Math.abs(p.col - c) === 1 && p.row === r)
  );
}

function isOnPendingLine(r, c) {
  if (state.pendingPlacements.length < 2) return false;
  const rows = state.pendingPlacements.map(p => p.row);
  const cols = state.pendingPlacements.map(p => p.col);
  if (rows.every(ro => ro === rows[0])) return r === rows[0];
  if (cols.every(co => co === cols[0])) return c === cols[0];
  return false;
}

function wouldBeValid(row, col, handIdx) {
  if (handIdx === null) return false;
  const tile = state.players[state.currentPlayer].hand[handIdx];
  if (!tile) return false;

  // Check row line
  if (!checkLine(row, col, tile, 'h')) return false;
  // Check col line
  if (!checkLine(row, col, tile, 'v')) return false;

  // Must be adjacent to something (unless first tile)
  const boardEmpty = Object.keys(state.board).length === 0 && state.pendingPlacements.length === 0;
  if (!boardEmpty) {
    const adj = [[row-1,col],[row+1,col],[row,col-1],[row,col+1]];
    const hasNeighbor = adj.some(([r,c]) => state.board[`${r},${c}`] || state.pendingPlacements.find(p=>p.row===r&&p.col===c));
    if (!hasNeighbor) return false;
  }
  return true;
}

function getLine(row, col, dir, extraTile) {
  const tiles = [];
  if (extraTile) tiles.push(extraTile);

  // Collect from board + pending
  const getBoardTile = (r, c) => {
    const k = `${r},${c}`;
    if (state.board[k]) return state.board[k];
    const p = state.pendingPlacements.find(p => p.row === r && p.col === c);
    return p ? p.tile : null;
  };

  if (dir === 'h') {
    for (let dc = 1; dc < 7; dc++) {
      const t = getBoardTile(row, col + dc); if (!t) break; tiles.push(t);
    }
    for (let dc = 1; dc < 7; dc++) {
      const t = getBoardTile(row, col - dc); if (!t) break; tiles.push(t);
    }
  } else {
    for (let dr = 1; dr < 7; dr++) {
      const t = getBoardTile(row + dr, col); if (!t) break; tiles.push(t);
    }
    for (let dr = 1; dr < 7; dr++) {
      const t = getBoardTile(row - dr, col); if (!t) break; tiles.push(t);
    }
  }
  return tiles;
}

function checkLine(row, col, tile, dir) {
  const line = getLine(row, col, dir, tile);
  if (line.length > 6) return false;
  if (line.length <= 1) return true;

  const colors = new Set(line.map(t => t.color));
  const shapes = new Set(line.map(t => t.shape));

  // All same color different shape, or all same shape different color
  const allSameColor = colors.size === 1;
  const allSameShape = shapes.size === 1;

  if (!allSameColor && !allSameShape) return false;
  if (allSameColor && shapes.size !== line.length) return false;
  if (allSameShape && colors.size !== line.length) return false;
  return true;
}

// ── Placement ───────────────────────────────────────────────────────────────
function selectTile(idx) {
  const player = state.players[state.currentPlayer];
  if (player.isAI || state.gameOver) return;
  const placedIdxs = new Set(state.pendingPlacements.map(p => p.handIdx));
  if (placedIdxs.has(idx)) return;

  state.selectedHandIdx = state.selectedHandIdx === idx ? null : idx;
  renderBoard();
  renderHand();
}

function placeOnBoard(row, col) {
  if (state.selectedHandIdx === null || state.gameOver) return;
  const player = state.players[state.currentPlayer];
  const tile = player.hand[state.selectedHandIdx];

  state.pendingPlacements.push({ row, col, tile, handIdx: state.selectedHandIdx });
  state.selectedHandIdx = null;

  updateButtons();
  renderBoard();
  renderHand();
}

// ── Play / Exchange ─────────────────────────────────────────────────────────
function updateButtons() {
  const player = state.players[state.currentPlayer];
  const isHuman = !player.isAI;
  document.getElementById('btn-play').disabled = !isHuman || state.pendingPlacements.length === 0;
  document.getElementById('btn-exchange').disabled = !isHuman || state.bag.length === 0 || state.pendingPlacements.length > 0;
  document.getElementById('btn-cancel').disabled = !isHuman || (state.pendingPlacements.length === 0 && state.selectedHandIdx === null);
}

document.getElementById('btn-play').onclick = () => {
  if (state.pendingPlacements.length === 0) return;
  commitPlay();
};

document.getElementById('btn-exchange').onclick = () => {
  const player = state.players[state.currentPlayer];
  // Return hand tiles to bag, draw new ones
  state.bag.push(...player.hand);
  shuffle(state.bag);
  player.hand = state.bag.splice(0, HAND_SIZE);
  logMsg(`${player.name} exchanged all tiles.`);
  endTurn();
};

document.getElementById('btn-cancel').onclick = () => {
  state.pendingPlacements = [];
  state.selectedHandIdx = null;
  renderAll();
};

function commitPlay() {
  const player = state.players[state.currentPlayer];

  // Validate final placement
  for (const p of state.pendingPlacements) {
    if (!wouldBeValidFull(p.row, p.col, p.tile)) {
      logMsg('❌ Invalid placement!', true);
      return;
    }
  }

  // Apply to board
  let pts = 0;
  const linesCounted = new Set();

  for (const p of state.pendingPlacements) {
    state.board[`${p.row},${p.col}`] = p.tile;
  }

  // Score
  pts = scoreMove(state.pendingPlacements);
  player.score += pts;
  logMsg(`${player.name} scored ${pts} points!`, pts >= 6);

  // Remove from hand (high to low idx to preserve indices)
  const idxs = [...new Set(state.pendingPlacements.map(p => p.handIdx))].sort((a, b) => b - a);
  for (const idx of idxs) player.hand.splice(idx, 1);

  // Draw
  const draw = state.bag.splice(0, idxs.length);
  player.hand.push(...draw);

  state.pendingPlacements = [];
  state.selectedHandIdx = null;

  if (player.hand.length === 0 && state.bag.length === 0) {
    player.score += 6;
    logMsg(`${player.name} cleared their hand! +6 bonus!`, true);
    endGame();
    return;
  }

  endTurn();
}

function wouldBeValidFull(row, col, tile) {
  const origPending = state.pendingPlacements;
  // Temporarily treat all other pending as board
  const tempBoard = { ...state.board };
  for (const p of origPending) {
    if (p.row !== row || p.col !== col) tempBoard[`${p.row},${p.col}`] = p.tile;
  }
  // Check lines with temp board
  return checkLineWithBoard(row, col, tile, 'h', tempBoard) &&
         checkLineWithBoard(row, col, tile, 'v', tempBoard);
}

function checkLineWithBoard(row, col, tile, dir, board) {
  const line = [tile];
  if (dir === 'h') {
    for (let dc = 1; dc < 7; dc++) { const t = board[`${row},${col+dc}`]; if (!t) break; line.push(t); }
    for (let dc = 1; dc < 7; dc++) { const t = board[`${row},${col-dc}`]; if (!t) break; line.push(t); }
  } else {
    for (let dr = 1; dr < 7; dr++) { const t = board[`${row+dr},${col}`]; if (!t) break; line.push(t); }
    for (let dr = 1; dr < 7; dr++) { const t = board[`${row-dr},${col}`]; if (!t) break; line.push(t); }
  }
  if (line.length > 6) return false;
  if (line.length <= 1) return true;
  const colors = new Set(line.map(t => t.color));
  const shapes = new Set(line.map(t => t.shape));
  if (colors.size === 1) return shapes.size === line.length;
  if (shapes.size === 1) return colors.size === line.length;
  return false;
}

function scoreMove(placements) {
  let pts = 0;
  const scored = new Set();

  // Score each line touched
  const rows = [...new Set(placements.map(p => p.row))];
  const cols = [...new Set(placements.map(p => p.col))];
  const isHorizontal = rows.length === 1;
  const isVertical = cols.length === 1;

  if (isHorizontal || placements.length === 1) {
    // Score the horizontal line through all placements
    const row = placements[0].row;
    const hLine = getFullLine(row, placements[0].col, 'h');
    if (hLine.length > 1) {
      pts += hLine.length === 6 ? 12 : hLine.length;
      if (hLine.length === 6) logMsg('QWIRKLE! 🎉', true);
    }
    // Score each vertical line
    for (const p of placements) {
      const vLine = getFullLine(p.row, p.col, 'v');
      if (vLine.length > 1) {
        pts += vLine.length === 6 ? 12 : vLine.length;
        if (vLine.length === 6) logMsg('QWIRKLE! 🎉', true);
      }
    }
  } else if (isVertical) {
    const col = placements[0].col;
    const vLine = getFullLine(placements[0].row, col, 'v');
    if (vLine.length > 1) {
      pts += vLine.length === 6 ? 12 : vLine.length;
      if (vLine.length === 6) logMsg('QWIRKLE! 🎉', true);
    }
    for (const p of placements) {
      const hLine = getFullLine(p.row, p.col, 'h');
      if (hLine.length > 1) {
        pts += hLine.length === 6 ? 12 : hLine.length;
        if (hLine.length === 6) logMsg('QWIRKLE! 🎉', true);
      }
    }
  }

  if (pts === 0) pts = 1; // at least 1 for single tile
  return pts;
}

function getFullLine(row, col, dir) {
  const tiles = [state.board[`${row},${col}`] || { _: true }];
  if (dir === 'h') {
    for (let dc = 1; dc < 7; dc++) { const t = state.board[`${row},${col+dc}`]; if (!t) break; tiles.push(t); }
    for (let dc = 1; dc < 7; dc++) { const t = state.board[`${row},${col-dc}`]; if (!t) break; tiles.push(t); }
  } else {
    for (let dr = 1; dr < 7; dr++) { const t = state.board[`${row+dr},${col}`]; if (!t) break; tiles.push(t); }
    for (let dr = 1; dr < 7; dr++) { const t = state.board[`${row-dr},${col}`]; if (!t) break; tiles.push(t); }
  }
  return tiles;
}

// ── Turn Management ─────────────────────────────────────────────────────────
function endTurn() {
  // Check if current player is stuck
  state.currentPlayer = (state.currentPlayer + 1) % state.numPlayers;

  if (state.bag.length === 0 && state.players.every(p => p.hand.length === 0)) {
    endGame(); return;
  }

  renderAll();

  if (state.players[state.currentPlayer].isAI) {
    setTimeout(aiTurn, 900);
  }
}

function endGame() {
  state.gameOver = true;
  const winner = state.players.reduce((a, b) => a.score > b.score ? a : b);
  showOverlay(`${winner.name} Wins!`, `Final score: ${winner.score} points`);
  renderScores();
}

// ── Simple AI ───────────────────────────────────────────────────────────────
function aiTurn() {
  if (!state.players[state.currentPlayer].isAI || state.gameOver) return;
  const player = state.players[state.currentPlayer];

  const move = findBestAIMove(player.hand);

  if (!move || move.length === 0) {
    // Exchange or pass
    if (state.bag.length >= player.hand.length) {
      state.bag.push(...player.hand);
      shuffle(state.bag);
      player.hand = state.bag.splice(0, HAND_SIZE);
      logMsg(`${player.name} exchanged tiles.`);
    } else {
      logMsg(`${player.name} passes.`);
    }
    endTurn();
    return;
  }

  // Apply move
  const usedIdxs = new Set();
  for (const { row, col, tile, handIdx } of move) {
    state.board[`${row},${col}`] = tile;
    usedIdxs.add(handIdx);
  }

  const pts = scoreMove(move);
  player.score += pts;
  logMsg(`${player.name} placed ${move.length} tile(s) for ${pts} pts.`);

  const idxsArr = [...usedIdxs].sort((a, b) => b - a);
  for (const idx of idxsArr) player.hand.splice(idx, 1);
  const draw = state.bag.splice(0, idxsArr.length);
  player.hand.push(...draw);

  if (player.hand.length === 0 && state.bag.length === 0) {
    player.score += 6;
    logMsg(`${player.name} cleared hand! +6 bonus!`, true);
    endGame();
    return;
  }

  endTurn();
}

function findBestAIMove(hand) {
  // Try to place single tile first, then extend
  let bestMove = null;
  let bestScore = -1;

  const boardEmpty = Object.keys(state.board).length === 0;

  if (boardEmpty) {
    // Find best starting combo
    for (let i = 0; i < hand.length; i++) {
      const t = hand[i];
      const move = [{ row: CENTER, col: CENTER, tile: t, handIdx: i }];
      const s = scoreMove(move);
      if (s > bestScore) { bestScore = s; bestMove = move; }
    }
    return bestMove;
  }

  // Try all cells adjacent to board
  const candidates = getAdjacentEmpty();

  for (const [row, col] of candidates) {
    for (let i = 0; i < hand.length; i++) {
      const tile = hand[i];
      // Quick validity check
      if (checkLineWithBoard(row, col, tile, 'h', state.board) &&
          checkLineWithBoard(row, col, tile, 'v', state.board)) {
        const move = [{ row, col, tile, handIdx: i }];
        const s = scoreMove(move);
        if (s > bestScore) { bestScore = s; bestMove = move; }
      }
    }
  }

  return bestMove;
}

function getAdjacentEmpty() {
  const result = [];
  const seen = new Set();
  for (const key of Object.keys(state.board)) {
    const [r, c] = key.split(',').map(Number);
    for (const [nr, nc] of [[r-1,c],[r+1,c],[r,c-1],[r,c+1]]) {
      const nk = `${nr},${nc}`;
      if (!state.board[nk] && !seen.has(nk)) {
        seen.add(nk);
        result.push([nr, nc]);
      }
    }
  }
  return result;
}

// ── Log ─────────────────────────────────────────────────────────────────────
function logMsg(msg, highlight = false) {
  const log = document.getElementById('log');
  const span = document.createElement('span');
  span.textContent = msg;
  if (highlight) span.classList.add('highlight');
  log.prepend(span);
}

// ── Overlay ─────────────────────────────────────────────────────────────────
function showOverlay(title, msg) {
  document.getElementById('overlay-title').textContent = title;
  document.getElementById('overlay-msg').textContent = msg;
  document.getElementById('overlay').style.display = 'flex';
}

document.getElementById('overlay-btn').onclick = () => {
  document.getElementById('overlay').style.display = 'none';
  initGame(state.numPlayers);
};

// ── Board Pan ────────────────────────────────────────────────────────────────
(function() {
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
initGame(2);

// Center board
setTimeout(() => {
  const bc = document.getElementById('board-container');
  const b = document.getElementById('board');
  bc.scrollLeft = (b.offsetWidth - bc.offsetWidth) / 2;
  bc.scrollTop = (b.offsetHeight - bc.offsetHeight) / 2;
}, 50);