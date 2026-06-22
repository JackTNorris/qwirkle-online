/*
TODO:
=================
ESSENTIAL:
- Fix rule that prevents non-contiguous addition on the same line [DONE]
- Fix swapping tiles functionality [DONE]
- Increase padding on edges to allow large plays
- Add in login [ DONE ]
- Cancelling only part of move (add x's on pieces) [Get Clarity]
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

// ── Constants (rendering only — no game logic) ─────────────────────────────
const CENTER = 45;
const API_URL = 'https://api.jacktnorris.dev'

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
 
  // No name yet — send to lobby to pick one, preserving any room code
  if (!playerName) {
    const lobbyUrl = new URL('lobby.html', window.location.href);
    if (roomCode) lobbyUrl.searchParams.set('room', roomCode);
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
    // Rewrite the URL so the shareable link goes to lobby with the room code
    const shareUrl = new URL('index.html', window.location.href);
    shareUrl.searchParams.set('room', roomId);
    shareUrl.searchParams.set('numPlayers', numPlayers);
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

// ── SVG Rendering (unchanged) ───────────────────────────────────────────────
const tileColor = (color) => {
  const map = { red: '#e84040', orange: '#f4a261', yellow: '#f4d35e', green: '#52b788', blue: '#4895ef', purple: '#b14aed' };
  return map[color] || '#fff';
};

const shapeSVG = (shape, color) => {
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
      const p = 'M20,2 L23,17 L38,20 L23,23 L20,38 L17,23 L2,20 L17,17 Z';
      return `<svg ${base}><path d="${p}" fill="${c}"/></svg>`;
    }
    case '8star': {
      const pts = [];
      for (let i = 0; i < 16; i++) {
        const angle = (i * Math.PI) / 8 - Math.PI / 2;
        const r = i % 2 === 0 ? 18 : 9;
        pts.push(`${20 + r * Math.cos(angle)},${20 + r * Math.sin(angle)}`);
      }
      return `<svg ${base}><polygon points="${pts.join(' ')}" fill="${c}"/></svg>`;
    }
    case 'clover': {
      const r = 8, off = 8;
      return `<svg ${base}>
        <circle cx="20" cy="${20 - off}" r="${r}" fill="${c}"/>
        <circle cx="20" cy="${20 + off}" r="${r}" fill="${c}"/>
        <circle cx="${20 - off}" cy="20" r="${r}" fill="${c}"/>
        <circle cx="${20 + off}" cy="20" r="${r}" fill="${c}"/>
        <circle cx="20" cy="20" r="6" fill="${c}"/>
      </svg>`;
    }
    default:
      return `<svg ${base}><circle cx="20" cy="20" r="17" fill="${c}"/></svg>`;
  }
};

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
  document.getElementById('overlay').style.display = 'none';
  // Start a fresh room (drop the room param so showLobby creates a new one)
  const url = new URL(window.location.href);
  url.searchParams.delete('room');
  window.history.replaceState({}, '', url);
  showLobby();
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