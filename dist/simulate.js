// src/core/EventBus.js
var EventBus = class {
  constructor() {
    this.listeners = /* @__PURE__ */ new Map();
  }
  on(event, callback, context = null) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push({ callback, context });
    return () => this.off(event, callback);
  }
  off(event, callback) {
    const list = this.listeners.get(event);
    if (!list) return;
    const idx = list.findIndex((l) => l.callback === callback);
    if (idx !== -1) list.splice(idx, 1);
  }
  emit(event, data) {
    const list = this.listeners.get(event);
    if (!list) return;
    for (const { callback, context } of [...list]) {
      callback.call(context, data);
    }
  }
  clear() {
    this.listeners.clear();
  }
};

// src/util/SeededRNG.js
var SeededRNG = class {
  constructor(seed) {
    this.seed = seed;
    this.state = seed;
  }
  next() {
    this.state = this.state * 1664525 + 1013904223 & 4294967295;
    return (this.state >>> 0) / 4294967295;
  }
  random() {
    return this.next();
  }
  randomInt(min, max) {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }
  randomChoice(arr) {
    return arr[Math.floor(this.next() * arr.length)];
  }
  shuffle(arr) {
    const result = [...arr];
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }
  weightedChoice(items, weights) {
    const total = weights.reduce((a, b) => a + b, 0);
    let roll = this.next() * total;
    for (let i = 0; i < items.length; i++) {
      roll -= weights[i];
      if (roll <= 0) return items[i];
    }
    return items[items.length - 1];
  }
  static generateSeed() {
    return Math.floor(Math.random() * 4294967295);
  }
};

// src/data/Constants.js
var PIECE_TYPES = {
  PAWN: "pawn",
  KNIGHT: "knight",
  BISHOP: "bishop",
  ROOK: "rook",
  QUEEN: "queen",
  KING: "king"
};
var TEAMS = {
  PLAYER: "player",
  ENEMY: "enemy"
};
var TERRAIN_TYPES = {
  NONE: "none",
  FORTRESS: "fortress",
  ICE: "ice",
  BRAMBLE: "bramble",
  VOID: "void",
  ALTAR: "altar"
};
var ROSTER_LIMIT = 16;
var TOTAL_FLOORS = 10;
var BOSS_FLOORS = [5, 10];
var STARTING_GOLD = 0;
var DRAFT_POINTS = { easy: 20, normal: 14, hard: 8 };
var DRAFT_COSTS = { pawn: 1, knight: 2, bishop: 2, rook: 3, queen: 5 };

// src/board/Tile.js
var Tile = class {
  constructor(col, row) {
    this.col = col;
    this.row = row;
    this.piece = null;
    this.terrain = TERRAIN_TYPES.NONE;
    this.isLight = (col + row) % 2 === 0;
  }
  isEmpty() {
    return this.piece === null;
  }
  hasPiece() {
    return this.piece !== null;
  }
  isPassable() {
    return this.terrain !== TERRAIN_TYPES.VOID;
  }
  setPiece(piece) {
    this.piece = piece;
    if (piece) {
      piece.col = this.col;
      piece.row = this.row;
    }
  }
  removePiece() {
    const piece = this.piece;
    this.piece = null;
    return piece;
  }
};

// src/util/GridUtil.js
function isInBounds(col, row, cols, rows) {
  return col >= 0 && col < cols && row >= 0 && row < rows;
}

// src/board/Board.js
var Board = class _Board {
  constructor(cols = 8, rows = 8) {
    this.cols = cols;
    this.rows = rows;
    this.tiles = [];
    this.pieces = [];
    this.init();
  }
  init() {
    this.tiles = [];
    for (let r = 0; r < this.rows; r++) {
      const row = [];
      for (let c = 0; c < this.cols; c++) {
        row.push(new Tile(c, r));
      }
      this.tiles.push(row);
    }
    this.pieces = [];
  }
  getTile(col, row) {
    if (!isInBounds(col, row, this.cols, this.rows)) return null;
    return this.tiles[row][col];
  }
  getPieceAt(col, row) {
    const tile = this.getTile(col, row);
    return tile ? tile.piece : null;
  }
  placePiece(piece, col, row) {
    const tile = this.getTile(col, row);
    if (!tile) return false;
    tile.setPiece(piece);
    if (!this.pieces.includes(piece)) {
      this.pieces.push(piece);
    }
    return true;
  }
  removePiece(piece) {
    const tile = this.getTile(piece.col, piece.row);
    if (tile) tile.removePiece();
    const idx = this.pieces.indexOf(piece);
    if (idx !== -1) this.pieces.splice(idx, 1);
  }
  movePiece(piece, toCol, toRow) {
    const fromTile = this.getTile(piece.col, piece.row);
    const toTile = this.getTile(toCol, toRow);
    if (!fromTile || !toTile) return null;
    let captured = null;
    if (toTile.piece && toTile.piece.team !== piece.team) {
      captured = toTile.piece;
      this.removePiece(captured);
    }
    fromTile.removePiece();
    toTile.setPiece(piece);
    piece.hasMoved = true;
    piece.moveCount++;
    return captured;
  }
  getTeamPieces(team) {
    return this.pieces.filter((p) => p.team === team);
  }
  findKing(team) {
    return this.pieces.find((p) => p.team === team && p.type === "king");
  }
  isSquareAttackedBy(col, row, attackingTeam, getMovesForPiece) {
    const attackers = this.getTeamPieces(attackingTeam);
    for (const piece of attackers) {
      const moves = getMovesForPiece(piece, true);
      if (moves.some((m) => m.col === col && m.row === row)) {
        return true;
      }
    }
    return false;
  }
  clone() {
    const copy = new _Board(this.cols, this.rows);
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        copy.tiles[r][c].terrain = this.tiles[r][c].terrain;
      }
    }
    for (const piece of this.pieces) {
      const cloned = piece.clone();
      copy.placePiece(cloned, cloned.col, cloned.row);
    }
    return copy;
  }
  setTerrain(col, row, terrain) {
    const tile = this.getTile(col, row);
    if (tile) tile.terrain = terrain;
  }
  getEmptyTiles() {
    const empty = [];
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const tile = this.tiles[r][c];
        if (tile.isEmpty() && tile.isPassable()) {
          empty.push(tile);
        }
      }
    }
    return empty;
  }
};

// src/combat/TurnManager.js
var TurnManager = class {
  constructor(eventBus) {
    this.eventBus = eventBus;
    this.currentTeam = TEAMS.PLAYER;
    this.turnNumber = 0;
    this.extraTurns = 0;
    this.consecutiveCaptures = 0;
  }
  reset() {
    this.currentTeam = TEAMS.PLAYER;
    this.turnNumber = 0;
    this.extraTurns = 0;
    this.consecutiveCaptures = 0;
  }
  get isPlayerTurn() {
    return this.currentTeam === TEAMS.PLAYER;
  }
  nextTurn() {
    if (this.extraTurns > 0) {
      this.extraTurns--;
      this.eventBus.emit("extraTurn", { team: this.currentTeam });
      return;
    }
    this.currentTeam = this.currentTeam === TEAMS.PLAYER ? TEAMS.ENEMY : TEAMS.PLAYER;
    this.turnNumber++;
    this.eventBus.emit("turnChanged", {
      team: this.currentTeam,
      turn: this.turnNumber
    });
  }
  grantExtraTurn(count = 1) {
    this.extraTurns += count;
  }
  onCapture() {
    this.consecutiveCaptures++;
  }
  onNonCapture() {
    this.consecutiveCaptures = 0;
  }
  getConsecutiveCaptures() {
    return this.consecutiveCaptures;
  }
};

// src/combat/CaptureResolver.js
var CaptureResolver = class {
  constructor(board, eventBus) {
    this.board = board;
    this.eventBus = eventBus;
    this.modifierSystem = null;
    this.rng = Math;
  }
  canCapture(attacker, targetCol, targetRow) {
    const target = this.board.getPieceAt(targetCol, targetRow);
    if (!target) return false;
    if (target.team === attacker.team) return false;
    const tile = this.board.getTile(targetCol, targetRow);
    if (tile.terrain === TERRAIN_TYPES.FORTRESS) {
      return false;
    }
    if (this.modifierSystem) {
      return this.modifierSystem.canBeCaptured(target, attacker);
    }
    return true;
  }
  resolveCapture(attacker, target) {
    if (target.hasModifier("gamblersFate") && !attacker.hasModifier("glasscannon")) {
      if (this.rng.random() < 0.5) {
        this.eventBus.emit("gamblersFateSurvived", {
          piece: target,
          attacker
        });
        return null;
      }
    }
    this.board.removePiece(target);
    this.eventBus.emit("pieceCaptured", {
      captured: target,
      capturedBy: attacker,
      col: target.col,
      row: target.row
    });
    return target;
  }
  resolveExplosion(attacker, adjacentEnemies) {
    const removed = [];
    for (const enemy of adjacentEnemies) {
      if (enemy.type === PIECE_TYPES.KING) continue;
      this.board.removePiece(enemy);
      removed.push(enemy);
      this.eventBus.emit("pieceCaptured", {
        captured: enemy,
        capturedBy: attacker,
        col: enemy.col,
        row: enemy.row,
        explosive: true
      });
    }
    return removed;
  }
  getGoldValue(piece) {
    return 1;
  }
};

// src/pieces/MovementPattern.js
var MovementPattern = class {
  static getMoves(piece, board, capturesOnly = false) {
    switch (piece.type) {
      case PIECE_TYPES.PAWN:
        return this.getPawnMoves(piece, board, capturesOnly);
      case PIECE_TYPES.KNIGHT:
        return this.getKnightMoves(piece, board, capturesOnly);
      case PIECE_TYPES.BISHOP:
        return this.getBishopMoves(piece, board, capturesOnly);
      case PIECE_TYPES.ROOK:
        return this.getRookMoves(piece, board, capturesOnly);
      case PIECE_TYPES.QUEEN:
        return this.getQueenMoves(piece, board, capturesOnly);
      case PIECE_TYPES.KING:
        return this.getKingMoves(piece, board, capturesOnly);
      default:
        return [];
    }
  }
  static getPawnMoves(piece, board, capturesOnly) {
    const moves = [];
    const direction = piece.team === TEAMS.PLAYER ? -1 : 1;
    const { col, row } = piece;
    if (!capturesOnly) {
      const fwd = row + direction;
      if (isInBounds(col, fwd, board.cols, board.rows)) {
        const tile = board.getTile(col, fwd);
        if (tile.isEmpty() && tile.isPassable()) {
          moves.push({ col, row: fwd, type: "move" });
          if (!piece.hasMoved) {
            const fwd2 = row + direction * 2;
            if (isInBounds(col, fwd2, board.cols, board.rows)) {
              const tile2 = board.getTile(col, fwd2);
              if (tile2.isEmpty() && tile2.isPassable()) {
                moves.push({ col, row: fwd2, type: "move" });
              }
            }
          }
        }
      }
    }
    for (const dc of [-1, 1]) {
      const nc = col + dc;
      const nr = row + direction;
      if (isInBounds(nc, nr, board.cols, board.rows)) {
        const tile = board.getTile(nc, nr);
        if (tile.isPassable()) {
          if (tile.hasPiece() && tile.piece.team !== piece.team) {
            moves.push({ col: nc, row: nr, type: "capture" });
          } else if (capturesOnly) {
            moves.push({ col: nc, row: nr, type: "threat" });
          }
        }
      }
    }
    return moves;
  }
  static getKnightMoves(piece, board, capturesOnly) {
    const moves = [];
    const offsets = [
      [-2, -1],
      [-2, 1],
      [-1, -2],
      [-1, 2],
      [1, -2],
      [1, 2],
      [2, -1],
      [2, 1]
    ];
    for (const [dc, dr] of offsets) {
      const nc = piece.col + dc;
      const nr = piece.row + dr;
      if (!isInBounds(nc, nr, board.cols, board.rows)) continue;
      const tile = board.getTile(nc, nr);
      if (!tile.isPassable()) continue;
      if (tile.hasPiece()) {
        if (tile.piece.team !== piece.team) {
          moves.push({ col: nc, row: nr, type: "capture" });
        }
      } else if (!capturesOnly) {
        moves.push({ col: nc, row: nr, type: "move" });
      } else {
        moves.push({ col: nc, row: nr, type: "threat" });
      }
    }
    return moves;
  }
  static getSlidingMoves(piece, board, directions, capturesOnly) {
    const moves = [];
    for (const [dc, dr] of directions) {
      let nc = piece.col + dc;
      let nr = piece.row + dr;
      while (isInBounds(nc, nr, board.cols, board.rows)) {
        const tile = board.getTile(nc, nr);
        if (!tile.isPassable()) break;
        if (tile.hasPiece()) {
          if (tile.piece.team !== piece.team) {
            moves.push({ col: nc, row: nr, type: "capture" });
          }
          break;
        }
        if (!capturesOnly) {
          moves.push({ col: nc, row: nr, type: "move" });
        } else {
          moves.push({ col: nc, row: nr, type: "threat" });
        }
        nc += dc;
        nr += dr;
      }
    }
    return moves;
  }
  static getBishopMoves(piece, board, capturesOnly) {
    return this.getSlidingMoves(piece, board, [[-1, -1], [1, -1], [-1, 1], [1, 1]], capturesOnly);
  }
  static getRookMoves(piece, board, capturesOnly) {
    return this.getSlidingMoves(piece, board, [[0, -1], [0, 1], [-1, 0], [1, 0]], capturesOnly);
  }
  static getQueenMoves(piece, board, capturesOnly) {
    return this.getSlidingMoves(piece, board, [
      [-1, -1],
      [1, -1],
      [-1, 1],
      [1, 1],
      [0, -1],
      [0, 1],
      [-1, 0],
      [1, 0]
    ], capturesOnly);
  }
  static getKingMoves(piece, board, capturesOnly) {
    const moves = [];
    const offsets = [
      [-1, -1],
      [0, -1],
      [1, -1],
      [-1, 0],
      [1, 0],
      [-1, 1],
      [0, 1],
      [1, 1]
    ];
    for (const [dc, dr] of offsets) {
      const nc = piece.col + dc;
      const nr = piece.row + dr;
      if (!isInBounds(nc, nr, board.cols, board.rows)) continue;
      const tile = board.getTile(nc, nr);
      if (!tile.isPassable()) continue;
      if (tile.hasPiece()) {
        if (tile.piece.team !== piece.team) {
          moves.push({ col: nc, row: nr, type: "capture" });
        }
      } else if (!capturesOnly) {
        moves.push({ col: nc, row: nr, type: "move" });
      } else {
        moves.push({ col: nc, row: nr, type: "threat" });
      }
    }
    if (!capturesOnly && !piece.hasMoved) {
      const castles = this.getCastlingMoves(piece, board);
      for (const c of castles) moves.push(c);
    }
    return moves;
  }
  static getCastlingMoves(king, board) {
    const moves = [];
    const row = king.row;
    const enemyTeam = king.team === TEAMS.PLAYER ? TEAMS.ENEMY : TEAMS.PLAYER;
    if (this.isSquareAttackedBy(king.col, row, enemyTeam, board)) return moves;
    const kRook = board.getPieceAt(board.cols - 1, row);
    if (kRook && kRook.type === PIECE_TYPES.ROOK && kRook.team === king.team && !kRook.hasMoved) {
      let clear = true;
      for (let c = king.col + 1; c < board.cols - 1; c++) {
        const t = board.getTile(c, row);
        if (t.hasPiece() || !t.isPassable()) {
          clear = false;
          break;
        }
      }
      if (clear) {
        const pass1 = !this.isSquareAttackedBy(king.col + 1, row, enemyTeam, board);
        const pass2 = !this.isSquareAttackedBy(king.col + 2, row, enemyTeam, board);
        if (pass1 && pass2) {
          moves.push({
            col: king.col + 2,
            row,
            type: "castle",
            rookFromCol: board.cols - 1,
            rookToCol: king.col + 1
          });
        }
      }
    }
    const qRook = board.getPieceAt(0, row);
    if (qRook && qRook.type === PIECE_TYPES.ROOK && qRook.team === king.team && !qRook.hasMoved) {
      let clear = true;
      for (let c = 1; c < king.col; c++) {
        const t = board.getTile(c, row);
        if (t.hasPiece() || !t.isPassable()) {
          clear = false;
          break;
        }
      }
      if (clear) {
        const pass1 = !this.isSquareAttackedBy(king.col - 1, row, enemyTeam, board);
        const pass2 = !this.isSquareAttackedBy(king.col - 2, row, enemyTeam, board);
        if (pass1 && pass2) {
          moves.push({
            col: king.col - 2,
            row,
            type: "castle",
            rookFromCol: 0,
            rookToCol: king.col - 1
          });
        }
      }
    }
    return moves;
  }
  static isSquareAttackedBy(col, row, team, board) {
    const pieces = board.getTeamPieces(team);
    for (const p of pieces) {
      let attackMoves;
      if (p.type === PIECE_TYPES.KING) {
        const dc = Math.abs(p.col - col);
        const dr = Math.abs(p.row - row);
        if (dc <= 1 && dr <= 1 && dc + dr > 0) return true;
        continue;
      }
      attackMoves = this.getMoves(p, board, true);
      if (attackMoves.some((m) => m.col === col && m.row === row)) return true;
    }
    return false;
  }
};

// src/combat/CheckDetector.js
var CheckDetector = class {
  constructor(board) {
    this.board = board;
  }
  isKingInCheck(team) {
    const king = this.board.findKing(team);
    if (!king) return false;
    const enemyTeam = team === "player" ? "enemy" : "player";
    return this.isSquareAttacked(king.col, king.row, enemyTeam);
  }
  isSquareAttacked(col, row, byTeam) {
    const pieces = this.board.getTeamPieces(byTeam);
    for (const piece of pieces) {
      const moves = MovementPattern.getMoves(piece, this.board, true);
      if (moves.some((m) => m.col === col && m.row === row)) {
        return true;
      }
    }
    return false;
  }
  getAttackersOfSquare(col, row, byTeam) {
    const attackers = [];
    const pieces = this.board.getTeamPieces(byTeam);
    for (const piece of pieces) {
      const moves = MovementPattern.getMoves(piece, this.board, true);
      if (moves.some((m) => m.col === col && m.row === row)) {
        attackers.push(piece);
      }
    }
    return attackers;
  }
  wouldMoveCauseCheck(piece, toCol, toRow, team) {
    const boardCopy = this.board.clone();
    const pieceCopy = boardCopy.getPieceAt(piece.col, piece.row);
    if (!pieceCopy) return false;
    boardCopy.movePiece(pieceCopy, toCol, toRow);
    const king = boardCopy.findKing(team);
    if (!king) return false;
    const enemyTeam = team === "player" ? "enemy" : "player";
    const enemies = boardCopy.getTeamPieces(enemyTeam);
    for (const enemy of enemies) {
      const moves = MovementPattern.getMoves(enemy, boardCopy, true);
      if (moves.some((m) => m.col === king.col && m.row === king.row)) {
        return true;
      }
    }
    return false;
  }
  hasLegalMoves(team) {
    const pieces = this.board.getTeamPieces(team);
    for (const piece of pieces) {
      if (piece.isFrozen) continue;
      const moves = MovementPattern.getMoves(piece, this.board, false);
      for (const move of moves) {
        if (move.type === "threat") continue;
        if (!this.wouldMoveCauseCheck(piece, move.col, move.row, team)) {
          return true;
        }
      }
    }
    return false;
  }
};

// src/data/PieceData.js
var PIECE_VALUES = {
  [PIECE_TYPES.PAWN]: 1,
  [PIECE_TYPES.KNIGHT]: 3,
  [PIECE_TYPES.BISHOP]: 3,
  [PIECE_TYPES.ROOK]: 5,
  [PIECE_TYPES.QUEEN]: 9,
  [PIECE_TYPES.KING]: 100
};
var PIECE_NAMES = {
  [PIECE_TYPES.PAWN]: "Pawn",
  [PIECE_TYPES.KNIGHT]: "Knight",
  [PIECE_TYPES.BISHOP]: "Bishop",
  [PIECE_TYPES.ROOK]: "Rook",
  [PIECE_TYPES.QUEEN]: "Queen",
  [PIECE_TYPES.KING]: "King"
};
var PIECE_SYMBOLS = {
  [PIECE_TYPES.PAWN]: "P",
  [PIECE_TYPES.KNIGHT]: "N",
  [PIECE_TYPES.BISHOP]: "B",
  [PIECE_TYPES.ROOK]: "R",
  [PIECE_TYPES.QUEEN]: "Q",
  [PIECE_TYPES.KING]: "K"
};
var SHOP_PRICES = {
  [PIECE_TYPES.PAWN]: 5,
  [PIECE_TYPES.KNIGHT]: 15,
  [PIECE_TYPES.BISHOP]: 15,
  [PIECE_TYPES.ROOK]: 20,
  [PIECE_TYPES.QUEEN]: 35
};

// src/ai/AIBehaviors.js
var AIBehaviors = {
  evaluateMove(piece, move, board, ownTeam, enemyTeam) {
    let score = 0;
    if (move.type === "capture") {
      const target = board.getPieceAt(move.col, move.row);
      if (target) {
        const targetVal = PIECE_VALUES[target.type] * 100;
        score += targetVal;
        if (target.type === PIECE_TYPES.KING) {
          score += 5e4;
        }
        if (!this.isSquareDefendedBy(move.col, move.row, board, enemyTeam)) {
          score += targetVal * 0.5;
        }
      }
    }
    const risk = this.evaluateSquareRisk(move.col, move.row, piece, board, ownTeam, enemyTeam);
    score -= risk;
    const currentRisk = this.evaluateSquareRisk(piece.col, piece.row, piece, board, ownTeam, enemyTeam);
    if (currentRisk > 0 && risk === 0) {
      score += currentRisk * 0.7;
    }
    const friendlyPieces = board.getTeamPieces(ownTeam);
    for (const friend of friendlyPieces) {
      if (friend === piece) continue;
      const friendKey = `${friend.col},${friend.row}`;
      const friendMoves = MovementPattern.getMoves(piece, board, true);
      const defendsFriend = friendMoves.some((m) => m.col === friend.col && m.row === friend.row);
      if (defendsFriend) {
        const friendRisk = this.evaluateSquareRisk(friend.col, friend.row, friend, board, ownTeam, enemyTeam);
        if (friendRisk > 0) {
          score += PIECE_VALUES[friend.type] * 20;
        }
      }
    }
    const centerCol = board.cols / 2;
    const centerRow = board.rows / 2;
    const centerDist = Math.abs(move.col - centerCol) + Math.abs(move.row - centerRow);
    score += (board.cols - centerDist) * 3;
    const enemyKing = board.findKing(enemyTeam);
    if (enemyKing) {
      const distToKing = Math.abs(move.col - enemyKing.col) + Math.abs(move.row - enemyKing.row);
      score += (20 - distToKing) * 5;
      if (distToKing <= 2 && piece.type !== PIECE_TYPES.PAWN) {
        score += 25;
      }
    }
    if (piece.type === PIECE_TYPES.PAWN) {
      const direction = piece.team === "player" ? -1 : 1;
      score += move.row * direction * 8;
      if (direction === 1 && move.row === board.rows - 1 || direction === -1 && move.row === 0) {
        score += 400;
      }
    }
    score += this.evaluateKingSafety(board, ownTeam) * 0.5;
    const ownKing = board.findKing(ownTeam);
    if (ownKing && piece.type !== PIECE_TYPES.KING) {
      const distToOwnKing = Math.abs(move.col - ownKing.col) + Math.abs(move.row - ownKing.row);
      const enemies = board.getTeamPieces(enemyTeam);
      const nearbyEnemies = enemies.filter(
        (e) => Math.abs(e.col - ownKing.col) + Math.abs(e.row - ownKing.row) <= 3
      );
      if (nearbyEnemies.length > 0 && distToOwnKing <= 2) {
        score += nearbyEnemies.length * 20;
      }
    }
    if (piece.type === PIECE_TYPES.KING) {
      const destRisk = this.evaluateSquareRisk(move.col, move.row, piece, board, ownTeam, enemyTeam);
      score -= destRisk * 2;
    }
    return score;
  },
  evaluateSquareRisk(col, row, movingPiece, board, ownTeam, enemyTeam) {
    if (enemyTeam === void 0) {
      enemyTeam = ownTeam;
      ownTeam = movingPiece.team;
    }
    const enemies = board.getTeamPieces(enemyTeam);
    let isAttacked = false;
    let lowestAttackerValue = Infinity;
    for (const enemy of enemies) {
      const moves = MovementPattern.getMoves(enemy, board, true);
      if (moves.some((m) => m.col === col && m.row === row)) {
        isAttacked = true;
        const val = PIECE_VALUES[enemy.type];
        if (val < lowestAttackerValue) lowestAttackerValue = val;
      }
    }
    if (!isAttacked) return 0;
    const pieceValue = PIECE_VALUES[movingPiece.type];
    const friendlies = board.getTeamPieces(ownTeam);
    let isDefended = false;
    for (const friend of friendlies) {
      if (friend === movingPiece) continue;
      const moves = MovementPattern.getMoves(friend, board, true);
      if (moves.some((m) => m.col === col && m.row === row)) {
        isDefended = true;
        break;
      }
    }
    if (!isDefended) {
      return pieceValue * 80;
    }
    if (lowestAttackerValue < pieceValue) {
      return (pieceValue - lowestAttackerValue) * 40;
    }
    return 0;
  },
  isSquareDefendedBy(col, row, board, team) {
    const pieces = board.getTeamPieces(team);
    for (const piece of pieces) {
      const moves = MovementPattern.getMoves(piece, board, true);
      if (moves.some((m) => m.col === col && m.row === row)) {
        return true;
      }
    }
    return false;
  },
  evaluateKingSafety(board, team) {
    const king = board.findKing(team);
    if (!king) return -1e4;
    const enemyTeam = team === "player" ? "enemy" : "player";
    const enemies = board.getTeamPieces(enemyTeam);
    let dangerScore = 0;
    for (const enemy of enemies) {
      const dist = Math.abs(enemy.col - king.col) + Math.abs(enemy.row - king.row);
      if (dist <= 2) dangerScore += PIECE_VALUES[enemy.type] * 20;
      else if (dist <= 4) dangerScore += PIECE_VALUES[enemy.type] * 5;
    }
    return -dangerScore;
  }
};

// src/ai/Evaluator.js
var Evaluator = class {
  static evaluateBoard(board, team) {
    const enemyTeam = team === "player" ? "enemy" : "player";
    let score = 0;
    for (const piece of board.getTeamPieces(team)) {
      score += PIECE_VALUES[piece.type] * 100;
    }
    for (const piece of board.getTeamPieces(enemyTeam)) {
      score -= PIECE_VALUES[piece.type] * 100;
    }
    let ownMoves = 0;
    let enemyMoves = 0;
    for (const p of board.getTeamPieces(team)) {
      ownMoves += MovementPattern.getMoves(p, board, false).filter((m) => m.type !== "threat").length;
    }
    for (const p of board.getTeamPieces(enemyTeam)) {
      enemyMoves += MovementPattern.getMoves(p, board, false).filter((m) => m.type !== "threat").length;
    }
    score += (ownMoves - enemyMoves) * 5;
    score += this.evaluateKingSafety(board, team);
    score -= this.evaluateKingSafety(board, enemyTeam);
    const midC = board.cols / 2;
    const midR = board.rows / 2;
    for (const p of board.getTeamPieces(team)) {
      const dist = Math.abs(p.col - midC) + Math.abs(p.row - midR);
      if (dist <= 2) score += 12;
      else if (dist <= 3) score += 5;
    }
    for (const p of board.getTeamPieces(enemyTeam)) {
      const dist = Math.abs(p.col - midC) + Math.abs(p.row - midR);
      if (dist <= 2) score -= 12;
      else if (dist <= 3) score -= 5;
    }
    score += this.evaluateHangingPieces(board, team, enemyTeam);
    for (const p of board.getTeamPieces(team)) {
      if (p.type === PIECE_TYPES.PAWN) {
        const dir = p.team === "player" ? -1 : 1;
        const progress = p.row * dir;
        score += progress * 3;
      }
    }
    return score;
  }
  static evaluateHangingPieces(board, team, enemyTeam) {
    let score = 0;
    for (const piece of board.getTeamPieces(team)) {
      if (piece.type === PIECE_TYPES.KING) continue;
      if (this.isAttacked(piece, board, enemyTeam) && !this.isDefended(piece, board, team)) {
        score -= PIECE_VALUES[piece.type] * 40;
      }
    }
    for (const piece of board.getTeamPieces(enemyTeam)) {
      if (piece.type === PIECE_TYPES.KING) continue;
      if (this.isAttacked(piece, board, team) && !this.isDefended(piece, board, enemyTeam)) {
        score += PIECE_VALUES[piece.type] * 40;
      }
    }
    return score;
  }
  static isAttacked(piece, board, byTeam) {
    for (const attacker of board.getTeamPieces(byTeam)) {
      const moves = MovementPattern.getMoves(attacker, board, true);
      if (moves.some((m) => m.col === piece.col && m.row === piece.row)) {
        return true;
      }
    }
    return false;
  }
  static isDefended(piece, board, byTeam) {
    for (const defender of board.getTeamPieces(byTeam)) {
      if (defender === piece) continue;
      const moves = MovementPattern.getMoves(defender, board, true);
      if (moves.some((m) => m.col === piece.col && m.row === piece.row)) {
        return true;
      }
    }
    return false;
  }
  static evaluateKingSafety(board, team) {
    const king = board.findKing(team);
    if (!king) return -5e3;
    const enemyTeam = team === "player" ? "enemy" : "player";
    let safety = 0;
    for (const enemy of board.getTeamPieces(enemyTeam)) {
      const dist = Math.abs(enemy.col - king.col) + Math.abs(enemy.row - king.row);
      if (dist <= 2) safety -= PIECE_VALUES[enemy.type] * 15;
      else if (dist <= 4) safety -= PIECE_VALUES[enemy.type] * 3;
    }
    for (const friend of board.getTeamPieces(team)) {
      if (friend === king) continue;
      const dist = Math.abs(friend.col - king.col) + Math.abs(friend.row - king.row);
      if (dist <= 2) safety += 8;
    }
    return safety;
  }
  static minimax(board, depth, isMaximizing, team, alpha = -Infinity, beta = Infinity) {
    if (depth === 0) {
      return { score: this.evaluateBoard(board, team) };
    }
    const currentTeam = isMaximizing ? team : team === "player" ? "enemy" : "player";
    const pieces = board.getTeamPieces(currentTeam);
    let allMoves = [];
    for (const piece of pieces) {
      if (piece.isFrozen) continue;
      const moves = MovementPattern.getMoves(piece, board, false).filter((m) => m.type !== "threat");
      for (const move of moves) {
        allMoves.push({ piece, move });
      }
    }
    allMoves.sort((a, b) => {
      const aCapture = a.move.type === "capture" ? 1 : 0;
      const bCapture = b.move.type === "capture" ? 1 : 0;
      if (aCapture !== bCapture) return bCapture - aCapture;
      if (aCapture && bCapture) {
        const aTarget = board.getPieceAt(a.move.col, a.move.row);
        const bTarget = board.getPieceAt(b.move.col, b.move.row);
        const aVal = aTarget ? PIECE_VALUES[aTarget.type] : 0;
        const bVal = bTarget ? PIECE_VALUES[bTarget.type] : 0;
        return bVal - aVal;
      }
      return 0;
    });
    let bestMove = null;
    let bestScore = isMaximizing ? -Infinity : Infinity;
    for (const { piece, move } of allMoves) {
      const boardCopy = board.clone();
      const pieceCopy = boardCopy.getPieceAt(piece.col, piece.row);
      if (!pieceCopy) continue;
      boardCopy.movePiece(pieceCopy, move.col, move.row);
      if (move.type === "castle" && move.rookFromCol !== void 0) {
        const rook = boardCopy.getPieceAt(move.rookFromCol, move.row);
        if (rook) boardCopy.movePiece(rook, move.rookToCol, move.row);
      }
      const result = this.minimax(boardCopy, depth - 1, !isMaximizing, team, alpha, beta);
      if (isMaximizing) {
        if (result.score > bestScore) {
          bestScore = result.score;
          bestMove = { piece, move, score: bestScore };
        }
        alpha = Math.max(alpha, bestScore);
      } else {
        if (result.score < bestScore) {
          bestScore = result.score;
          bestMove = { piece, move, score: bestScore };
        }
        beta = Math.min(beta, bestScore);
      }
      if (beta <= alpha) break;
    }
    return bestMove || { score: bestScore };
  }
};

// src/ai/ThreatMap.js
var ThreatMap = class {
  constructor(board) {
    this.board = board;
    this.threats = /* @__PURE__ */ new Map();
    this.defenses = /* @__PURE__ */ new Map();
  }
  build(team) {
    this.threats.clear();
    this.defenses.clear();
    const pieces = this.board.getTeamPieces(team);
    for (const piece of pieces) {
      const moves = MovementPattern.getMoves(piece, this.board, true);
      for (const move of moves) {
        const key = `${move.col},${move.row}`;
        const target = this.board.getPieceAt(move.col, move.row);
        if (target && target.team === team) {
          if (!this.defenses.has(key)) this.defenses.set(key, []);
          this.defenses.get(key).push(piece);
        } else {
          if (!this.threats.has(key)) this.threats.set(key, []);
          this.threats.get(key).push(piece);
        }
      }
    }
  }
  isSquareThreatened(col, row) {
    return this.threats.has(`${col},${row}`);
  }
  getThreatsAt(col, row) {
    return this.threats.get(`${col},${row}`) || [];
  }
  isSquareDefended(col, row) {
    return this.defenses.has(`${col},${row}`);
  }
  getDefendersAt(col, row) {
    return this.defenses.get(`${col},${row}`) || [];
  }
  isPieceHanging(piece) {
    const key = `${piece.col},${piece.row}`;
    const threats = this.threats.get(key) || [];
    const defenders = this.defenses.get(key) || [];
    return threats.length > 0 && defenders.length === 0;
  }
};

// src/ai/AIController.js
var AIController = class {
  constructor(board, eventBus) {
    this.board = board;
    this.eventBus = eventBus;
    this.difficulty = 1;
    this.threatMap = new ThreatMap(board);
    this.modifierSystem = null;
    this.relics = [];
    this.turnManager = null;
  }
  setDifficulty(level) {
    this.difficulty = Math.max(1, Math.min(5, level));
  }
  getBestMove(team = TEAMS.ENEMY) {
    const pieces = this.board.getTeamPieces(team);
    const enemyTeam = team === TEAMS.PLAYER ? TEAMS.ENEMY : TEAMS.PLAYER;
    this.threatMap.build(enemyTeam);
    const enemySlowed = this.relics.some((r) => r.id === "enemySlowed");
    const turnNum = this.turnManager ? this.turnManager.turnNumber : 0;
    if (this.difficulty >= 3) {
      const depth = this.difficulty >= 5 ? 3 : 2;
      const result = Evaluator.minimax(this.board, depth, true, team);
      if (result && result.piece && result.move) {
        if (!result.piece.isFrozen) {
          if (!(enemySlowed && result.piece.type === PIECE_TYPES.KING && turnNum % 2 === 0)) {
            return result;
          }
        }
      }
    }
    let allMoves = [];
    for (const piece of pieces) {
      if (piece.isFrozen) continue;
      if (enemySlowed && piece.type === PIECE_TYPES.KING && turnNum % 2 === 0) continue;
      const baseMoves = MovementPattern.getMoves(piece, this.board, false).filter((m) => m.type !== "threat");
      const moves = this.modifierSystem ? this.modifierSystem.getModifiedMoves(piece, baseMoves) : baseMoves;
      for (const move of moves) {
        const score = AIBehaviors.evaluateMove(
          piece,
          move,
          this.board,
          team,
          enemyTeam
        );
        allMoves.push({ piece, move, score });
      }
    }
    if (allMoves.length === 0) return null;
    allMoves.sort((a, b) => b.score - a.score);
    if (this.difficulty <= 1) {
      const candidates = allMoves.slice(0, Math.min(3, allMoves.length));
      return candidates[Math.floor(Math.random() * candidates.length)];
    }
    return allMoves[0];
  }
};

// src/pieces/ModifierSystem.js
var ModifierSystem = class {
  constructor(board, relics = [], turnManager = null) {
    this.board = board;
    this.relics = relics;
    this.turnManager = turnManager;
    this.battleCaptureCount = {};
    this.rallyActive = false;
    this.lastStandTurnStart = {};
  }
  resetBattleState() {
    this.battleCaptureCount = {};
    this.rallyActive = false;
    this.lastStandTurnStart = {};
  }
  onCapture(piece) {
    if (!this.battleCaptureCount[piece.id]) {
      this.battleCaptureCount[piece.id] = 0;
    }
    this.battleCaptureCount[piece.id]++;
    if (piece.hasModifier("rally")) {
      this.rallyActive = true;
    }
  }
  consumeRally() {
    if (this.rallyActive) {
      this.rallyActive = false;
      return true;
    }
    return false;
  }
  // ===== MAIN PUBLIC API =====
  getModifiedMoves(piece, baseMoves) {
    let moves = [...baseMoves];
    for (const mod of piece.modifiers) {
      switch (mod.id) {
        case "leapOver":
          moves = this._addLeapOverMoves(piece, moves);
          break;
        case "extraRange":
          moves = this._extendRange(piece, moves, 2);
          break;
        case "kingStep":
          moves = this._addKingMoves(piece, moves);
          break;
        case "sidestep":
          moves = this._addSidestep(piece, moves);
          break;
        case "retreat":
          moves = this._addRetreat(piece, moves);
          break;
        case "diagonalSlip":
          moves = this._addDiagonalSlip(piece, moves);
          break;
        case "charge":
          if (piece.moveCount === 0) {
            moves = this._extendRange(piece, moves, 3);
          }
          break;
        case "phasing":
          moves = this._addPhasingMoves(piece, moves);
          break;
        case "glasscannon":
          moves = this._extendRange(piece, moves, 3);
          break;
        case "berserker": {
          const kills = this.battleCaptureCount[piece.id] || 0;
          if (kills > 0) {
            moves = this._extendRange(piece, moves, kills);
          }
          break;
        }
        case "forwardCapture":
          moves = this._addForwardCapture(piece, moves);
          break;
        case "rangedCapture":
          moves = this._flagRangedCaptures(piece, moves);
          break;
      }
    }
    const friendlies = this.board.getTeamPieces(piece.team);
    for (const ally of friendlies) {
      if (ally.id === piece.id) continue;
      if (!ally.hasModifier("inspire")) continue;
      const dx = Math.abs(piece.col - ally.col);
      const dy = Math.abs(piece.row - ally.row);
      if (dx <= 1 && dy <= 1) {
        moves = this._extendRange(piece, moves, 1);
        break;
      }
    }
    if (this.rallyActive && piece.team === TEAMS.PLAYER) {
      moves = this._extendRange(piece, moves, 1);
    }
    const enemies = this.board.getTeamPieces(piece.team === TEAMS.PLAYER ? TEAMS.ENEMY : TEAMS.PLAYER);
    for (const enemy of enemies) {
      if (!enemy.hasModifier("intimidate")) continue;
      const dx = Math.abs(piece.col - enemy.col);
      const dy = Math.abs(piece.row - enemy.row);
      if (dx <= 1 && dy <= 1) {
        moves = this._reduceRange(piece, moves, 1);
        break;
      }
    }
    if (piece.hasModifier("anchored")) {
      moves = moves.filter((m) => {
        const dist = Math.max(Math.abs(m.col - piece.col), Math.abs(m.row - piece.row));
        return dist <= 2;
      });
    }
    moves = this._applyRelicEffects(piece, moves);
    return moves;
  }
  handlePostCapture(piece, capturedPiece) {
    const results = { extraMove: false, returnToStart: false, startCol: 0, startRow: 0, explode: false, adjacentEnemies: [] };
    if (piece.hasModifier("doubleCapture")) {
      results.extraMove = true;
    }
    if (piece.hasModifier("captureChain")) {
      const futureMoves = this.getModifiedMoves(piece, this._getBaseMoves(piece));
      if (futureMoves.some((m) => m.type === "capture")) {
        results.extraMove = true;
      }
    }
    if (piece.hasModifier("captureRetreat")) {
      results.returnToStart = true;
    }
    if (piece.hasModifier("explosiveCapture")) {
      results.explode = true;
      const offsets = [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]];
      for (const [dc, dr] of offsets) {
        const nc = capturedPiece.col + dc;
        const nr = capturedPiece.row + dr;
        if (!isInBounds(nc, nr, this.board.cols, this.board.rows)) continue;
        const adj = this.board.getPieceAt(nc, nr);
        if (adj && adj.team !== piece.team && adj.id !== piece.id) {
          results.adjacentEnemies.push(adj);
        }
      }
    }
    return results;
  }
  canBeCaptured(target, attacker) {
    if (attacker.hasModifier("glasscannon")) {
      return true;
    }
    if (target.hasModifier("glasscannon")) {
      return true;
    }
    const turnNum = this.turnManager ? this.turnManager.turnNumber : 999;
    if (target.hasModifier("firstTurnShield") && turnNum < 4) {
      return false;
    }
    if (target.hasModifier("flankShield")) {
      if (attacker.row === target.row && attacker.col !== target.col) {
        return false;
      }
    }
    if (target.hasModifier("rearShield")) {
      const isPlayer = target.team === TEAMS.PLAYER;
      if (isPlayer && attacker.row > target.row) return false;
      if (!isPlayer && attacker.row < target.row) return false;
    }
    if (target.hasModifier("adjacencyShield")) {
      const friendlies = this.board.getTeamPieces(target.team);
      const hasAdjacentFriendly = friendlies.some((f) => {
        if (f.id === target.id) return false;
        return Math.abs(f.col - target.col) <= 1 && Math.abs(f.row - target.row) <= 1;
      });
      if (hasAdjacentFriendly) return false;
    }
    if (target.hasModifier("lastStand")) {
      const teamPieces = this.board.getTeamPieces(target.team);
      const nonKingPieces = teamPieces.filter((p) => p.type !== PIECE_TYPES.KING);
      if (nonKingPieces.length === 1 && nonKingPieces[0].id === target.id) {
        if (!this.lastStandTurnStart[target.id]) {
          this.lastStandTurnStart[target.id] = turnNum;
        }
        const elapsed = turnNum - this.lastStandTurnStart[target.id];
        if (elapsed < 6) return false;
      }
    }
    if (target.hasModifier("anchored")) {
      return false;
    }
    const targetFriendlies = this.board.getTeamPieces(target.team);
    for (const ally of targetFriendlies) {
      if (ally.id === target.id) continue;
      if (!ally.hasModifier("guardian")) continue;
      const dx = Math.abs(ally.col - target.col);
      const dy = Math.abs(ally.row - target.row);
      if (dx > 1 || dy > 1) continue;
      const guardDir = { col: Math.sign(ally.col - target.col), row: Math.sign(ally.row - target.row) };
      const attackDir = { col: Math.sign(attacker.col - target.col), row: Math.sign(attacker.row - target.row) };
      if (guardDir.col === attackDir.col && guardDir.row === attackDir.row) {
        return false;
      }
    }
    return true;
  }
  // ===== MOVEMENT HELPERS =====
  _addKingMoves(piece, moves) {
    const offsets = [
      [-1, -1],
      [0, -1],
      [1, -1],
      [-1, 0],
      [1, 0],
      [-1, 1],
      [0, 1],
      [1, 1]
    ];
    for (const [dc, dr] of offsets) {
      const nc = piece.col + dc;
      const nr = piece.row + dr;
      if (!isInBounds(nc, nr, this.board.cols, this.board.rows)) continue;
      if (moves.some((m) => m.col === nc && m.row === nr)) continue;
      const tile = this.board.getTile(nc, nr);
      if (!tile || !tile.isPassable()) continue;
      if (tile.hasPiece()) {
        if (tile.piece.team !== piece.team) {
          moves.push({ col: nc, row: nr, type: "capture" });
        }
      } else {
        moves.push({ col: nc, row: nr, type: "move" });
      }
    }
    return moves;
  }
  _addSidestep(piece, moves) {
    for (const dc of [-1, 1]) {
      const nc = piece.col + dc;
      const nr = piece.row;
      if (!isInBounds(nc, nr, this.board.cols, this.board.rows)) continue;
      if (moves.some((m) => m.col === nc && m.row === nr)) continue;
      const tile = this.board.getTile(nc, nr);
      if (!tile || !tile.isPassable()) continue;
      if (tile.hasPiece()) {
        if (tile.piece.team !== piece.team) {
          moves.push({ col: nc, row: nr, type: "capture" });
        }
      } else {
        moves.push({ col: nc, row: nr, type: "move" });
      }
    }
    return moves;
  }
  _addRetreat(piece, moves) {
    const dir = piece.team === TEAMS.PLAYER ? 1 : -1;
    const nc = piece.col;
    const nr = piece.row + dir;
    if (!isInBounds(nc, nr, this.board.cols, this.board.rows)) return moves;
    if (moves.some((m) => m.col === nc && m.row === nr)) return moves;
    const tile = this.board.getTile(nc, nr);
    if (!tile || !tile.isPassable()) return moves;
    if (tile.hasPiece()) {
      if (tile.piece.team !== piece.team) {
        moves.push({ col: nc, row: nr, type: "capture" });
      }
    } else {
      moves.push({ col: nc, row: nr, type: "move" });
    }
    return moves;
  }
  _addDiagonalSlip(piece, moves) {
    const offsets = [[-1, -1], [1, -1], [-1, 1], [1, 1]];
    for (const [dc, dr] of offsets) {
      const nc = piece.col + dc;
      const nr = piece.row + dr;
      if (!isInBounds(nc, nr, this.board.cols, this.board.rows)) continue;
      if (moves.some((m) => m.col === nc && m.row === nr)) continue;
      const tile = this.board.getTile(nc, nr);
      if (!tile || !tile.isPassable()) continue;
      if (tile.hasPiece()) {
        if (tile.piece.team !== piece.team) {
          moves.push({ col: nc, row: nr, type: "capture" });
        }
      } else {
        moves.push({ col: nc, row: nr, type: "move" });
      }
    }
    return moves;
  }
  _addForwardCapture(piece, moves) {
    const dir = piece.team === TEAMS.PLAYER ? -1 : 1;
    const nc = piece.col;
    const nr = piece.row + dir;
    if (!isInBounds(nc, nr, this.board.cols, this.board.rows)) return moves;
    if (moves.some((m) => m.col === nc && m.row === nr && m.type === "capture")) return moves;
    const tile = this.board.getTile(nc, nr);
    if (tile && tile.hasPiece() && tile.piece.team !== piece.team) {
      moves = moves.filter((m) => !(m.col === nc && m.row === nr && m.type === "move"));
      moves.push({ col: nc, row: nr, type: "capture" });
    }
    return moves;
  }
  _flagRangedCaptures(piece, moves) {
    return moves.map((m) => {
      if (m.type === "capture") {
        return { ...m, ranged: true };
      }
      return m;
    });
  }
  _addLeapOverMoves(piece, moves) {
    const slideDirs = this._getSlidingDirections(piece);
    if (slideDirs.length === 0) return moves;
    for (const [dc, dr] of slideDirs) {
      let nc = piece.col + dc;
      let nr = piece.row + dr;
      let leaped = false;
      while (isInBounds(nc, nr, this.board.cols, this.board.rows)) {
        const tile = this.board.getTile(nc, nr);
        if (!tile || !tile.isPassable()) break;
        if (tile.hasPiece()) {
          if (!leaped) {
            leaped = true;
            nc += dc;
            nr += dr;
            continue;
          }
          if (tile.piece.team !== piece.team) {
            if (!moves.some((m) => m.col === nc && m.row === nr)) {
              moves.push({ col: nc, row: nr, type: "capture" });
            }
          }
          break;
        }
        if (!moves.some((m) => m.col === nc && m.row === nr)) {
          moves.push({ col: nc, row: nr, type: "move" });
        }
        nc += dc;
        nr += dr;
      }
    }
    return moves;
  }
  _addPhasingMoves(piece, moves) {
    const slideDirs = this._getSlidingDirections(piece);
    if (slideDirs.length === 0) return moves;
    for (const [dc, dr] of slideDirs) {
      let nc = piece.col + dc;
      let nr = piece.row + dr;
      while (isInBounds(nc, nr, this.board.cols, this.board.rows)) {
        const tile = this.board.getTile(nc, nr);
        if (!tile || !tile.isPassable()) break;
        if (tile.hasPiece()) {
          if (tile.piece.team !== piece.team) {
            if (!moves.some((m) => m.col === nc && m.row === nr)) {
              moves.push({ col: nc, row: nr, type: "capture" });
            }
          }
          nc += dc;
          nr += dr;
          continue;
        }
        if (!moves.some((m) => m.col === nc && m.row === nr)) {
          moves.push({ col: nc, row: nr, type: "move" });
        }
        nc += dc;
        nr += dr;
      }
    }
    return moves;
  }
  _extendRange(piece, moves, extra) {
    const extended = [];
    for (const m of moves) {
      const dc = m.col - piece.col;
      const dr = m.row - piece.row;
      if (dc === 0 && dr === 0) continue;
      const ndx = Math.sign(dc);
      const ndy = Math.sign(dr);
      let curCol = m.col;
      let curRow = m.row;
      for (let i = 0; i < extra; i++) {
        curCol += ndx;
        curRow += ndy;
        if (!isInBounds(curCol, curRow, this.board.cols, this.board.rows)) break;
        if (moves.some((em) => em.col === curCol && em.row === curRow)) continue;
        if (extended.some((em) => em.col === curCol && em.row === curRow)) continue;
        const tile = this.board.getTile(curCol, curRow);
        if (!tile || !tile.isPassable()) break;
        if (tile.hasPiece()) {
          if (tile.piece.team !== piece.team) {
            extended.push({ col: curCol, row: curRow, type: "capture" });
          }
          break;
        }
        extended.push({ col: curCol, row: curRow, type: "move" });
      }
    }
    return [...moves, ...extended];
  }
  _reduceRange(piece, moves, amount) {
    const grouped = {};
    for (const m of moves) {
      const dc = Math.sign(m.col - piece.col);
      const dr = Math.sign(m.row - piece.row);
      const key = `${dc},${dr}`;
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(m);
    }
    const result = [];
    for (const key in grouped) {
      const group = grouped[key].sort((a, b) => {
        const da = Math.max(Math.abs(a.col - piece.col), Math.abs(a.row - piece.row));
        const db = Math.max(Math.abs(b.col - piece.col), Math.abs(b.row - piece.row));
        return da - db;
      });
      const keep = Math.max(1, group.length - amount);
      result.push(...group.slice(0, keep));
    }
    return result;
  }
  _getSlidingDirections(piece) {
    switch (piece.type) {
      case PIECE_TYPES.ROOK:
        return [[0, -1], [0, 1], [-1, 0], [1, 0]];
      case PIECE_TYPES.BISHOP:
        return [[-1, -1], [1, -1], [-1, 1], [1, 1]];
      case PIECE_TYPES.QUEEN:
        return [[0, -1], [0, 1], [-1, 0], [1, 0], [-1, -1], [1, -1], [-1, 1], [1, 1]];
      default:
        return [];
    }
  }
  _getBaseMoves(piece) {
    const moves = [];
    const slideDirs = this._getSlidingDirections(piece);
    for (const [dc, dr] of slideDirs) {
      let nc = piece.col + dc;
      let nr = piece.row + dr;
      while (isInBounds(nc, nr, this.board.cols, this.board.rows)) {
        const tile = this.board.getTile(nc, nr);
        if (!tile || !tile.isPassable()) break;
        if (tile.hasPiece()) {
          if (tile.piece.team !== piece.team) {
            moves.push({ col: nc, row: nr, type: "capture" });
          }
          break;
        }
        moves.push({ col: nc, row: nr, type: "move" });
        nc += dc;
        nr += dr;
      }
    }
    if (piece.type === PIECE_TYPES.KNIGHT) {
      const knightOffsets = [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]];
      for (const [dc, dr] of knightOffsets) {
        const nc = piece.col + dc;
        const nr = piece.row + dr;
        if (!isInBounds(nc, nr, this.board.cols, this.board.rows)) continue;
        const tile = this.board.getTile(nc, nr);
        if (!tile || !tile.isPassable()) continue;
        if (tile.hasPiece()) {
          if (tile.piece.team !== piece.team) {
            moves.push({ col: nc, row: nr, type: "capture" });
          }
        } else {
          moves.push({ col: nc, row: nr, type: "move" });
        }
      }
    }
    return moves;
  }
  _applyRelicEffects(piece, moves) {
    if (piece.type === PIECE_TYPES.PAWN && this.hasRelic("pawnForwardCapture") && !piece.hasModifier("forwardCapture")) {
      moves = this._addForwardCapture(piece, moves);
    }
    return moves;
  }
  hasRelic(id) {
    return this.relics.some((r) => r.id === id);
  }
};

// src/combat/CombatManager.js
var CombatManager = class {
  constructor(eventBus) {
    this.eventBus = eventBus;
    this.board = null;
    this.turnManager = new TurnManager(eventBus);
    this.captureResolver = null;
    this.checkDetector = null;
    this.ai = null;
    this.capturedByPlayer = [];
    this.capturedByEnemy = [];
    this.goldEarned = 0;
    this.gameOver = false;
    this.winner = null;
    this.relics = [];
    this.modifierSystem = null;
  }
  initBattle(board, options = {}) {
    this.board = board;
    this.captureResolver = new CaptureResolver(board, this.eventBus);
    this.checkDetector = new CheckDetector(board);
    this.ai = new AIController(board, this.eventBus);
    this.ai.setDifficulty(options.difficulty || 2);
    this.turnManager.reset();
    this.capturedByPlayer = [];
    this.capturedByEnemy = [];
    this.goldEarned = 0;
    this.gameOver = false;
    this.winner = null;
    this.relics = options.relics || [];
    this.armyAbility = options.armyAbility || null;
    this.modifierSystem = new ModifierSystem(board, this.relics, this.turnManager);
    this.modifierSystem.resetBattleState();
    this.captureResolver.modifierSystem = this.modifierSystem;
    if (options.rng) this.captureResolver.rng = options.rng;
    this.ai.modifierSystem = this.modifierSystem;
    this.ai.relics = this.relics;
    this.ai.turnManager = this.turnManager;
    if (this.hasRelic("freeMove")) {
      this.turnManager.grantExtraTurn(1);
    }
  }
  getLegalMoves(piece) {
    if (piece.isFrozen) return [];
    const rawMoves = MovementPattern.getMoves(piece, this.board, false).filter((m) => m.type !== "threat");
    return this.modifierSystem ? this.modifierSystem.getModifiedMoves(piece, rawMoves) : rawMoves;
  }
  executeMove(piece, toCol, toRow, moveData = {}) {
    const fromCol = piece.col;
    const fromRow = piece.row;
    const target = this.board.getPieceAt(toCol, toRow);
    let captured = null;
    if (moveData.type === "castle") {
      const rook = this.board.getPieceAt(moveData.rookFromCol, piece.row);
      if (rook) {
        const kingFrom = this.board.getTile(fromCol, fromRow);
        const kingTo = this.board.getTile(toCol, toRow);
        kingFrom.removePiece();
        kingTo.setPiece(piece);
        piece.hasMoved = true;
        piece.moveCount++;
        const rookFrom = this.board.getTile(moveData.rookFromCol, piece.row);
        const rookTo = this.board.getTile(moveData.rookToCol, piece.row);
        rookFrom.removePiece();
        rookTo.setPiece(rook);
        rook.hasMoved = true;
        rook.moveCount++;
        return {
          success: true,
          piece,
          from: { col: fromCol, row: fromRow },
          to: { col: toCol, row: toRow },
          captured: null,
          promoted: false,
          extraTurn: false,
          castle: {
            rook,
            rookFrom: { col: moveData.rookFromCol, row: piece.row },
            rookTo: { col: moveData.rookToCol, row: piece.row }
          }
        };
      }
    }
    if (target && target.team !== piece.team) {
      if (!this.captureResolver.canCapture(piece, toCol, toRow)) {
        return { success: false, reason: "protected" };
      }
      const isRanged = moveData.ranged || false;
      captured = this.captureResolver.resolveCapture(piece, target);
      if (!captured) {
        if (!isRanged) {
        }
        const result2 = {
          success: true,
          piece,
          from: { col: fromCol, row: fromRow },
          to: { col: fromCol, row: fromRow },
          captured: null,
          promoted: false,
          extraTurn: false,
          gamblerSurvived: true
        };
        piece.moveCount++;
        this.turnManager.onNonCapture();
        return result2;
      }
      if (isRanged) {
        piece.moveCount++;
        const result2 = {
          success: true,
          piece,
          from: { col: fromCol, row: fromRow },
          to: { col: fromCol, row: fromRow },
          captured,
          promoted: false,
          extraTurn: false,
          rangedCapture: true
        };
        this._handlePostCaptureEffects(piece, captured, result2, fromCol, fromRow);
        return result2;
      }
    }
    const fromTile = this.board.getTile(fromCol, fromRow);
    const toTile = this.board.getTile(toCol, toRow);
    fromTile.removePiece();
    toTile.setPiece(piece);
    piece.hasMoved = true;
    piece.moveCount++;
    const result = {
      success: true,
      piece,
      from: { col: fromCol, row: fromRow },
      to: { col: toCol, row: toRow },
      captured,
      promoted: false,
      extraTurn: false
    };
    if (captured) {
      this._handlePostCaptureEffects(piece, captured, result, fromCol, fromRow);
    } else {
      this.turnManager.onNonCapture();
    }
    const landedTile = this.board.getTile(piece.col, piece.row);
    if (landedTile.terrain === TERRAIN_TYPES.BRAMBLE) {
      piece.isFrozen = true;
    }
    if (landedTile.terrain === TERRAIN_TYPES.ICE) {
      result.iceSlide = this.applyIceSlide(piece, toCol - fromCol, toRow - fromRow);
    }
    if (piece.type === PIECE_TYPES.PAWN) {
      const promoRow = piece.team === TEAMS.PLAYER ? 0 : this.board.rows - 1;
      let promoRank = promoRow;
      if ((this.hasRelic("earlyPromotion") || this.armyAbility === "earlyPromotion") && piece.team === TEAMS.PLAYER) {
        promoRank = 1;
      }
      if (piece.team === TEAMS.PLAYER && toRow <= promoRank || piece.team === TEAMS.ENEMY && toRow >= promoRank) {
        result.needsPromotion = true;
      }
      if (landedTile.terrain === TERRAIN_TYPES.ALTAR) {
        result.needsPromotion = true;
      }
    }
    return result;
  }
  _handlePostCaptureEffects(piece, captured, result, fromCol, fromRow) {
    if (piece.team === TEAMS.PLAYER) {
      this.capturedByPlayer.push(captured);
      this.goldEarned += this.captureResolver.getGoldValue(captured);
    } else {
      this.capturedByEnemy.push(captured);
    }
    this.turnManager.onCapture();
    if (this.modifierSystem) {
      this.modifierSystem.onCapture(piece);
    }
    if (captured.type === PIECE_TYPES.KING) {
      this.endBattle(piece.team);
      result.kingCaptured = true;
      return;
    }
    if (this.hasRelic("captureStreak") && this.turnManager.getConsecutiveCaptures() >= 3) {
      this.turnManager.grantExtraTurn(1);
      result.extraTurn = true;
      this.turnManager.consecutiveCaptures = 0;
    }
    if (this.modifierSystem) {
      const postCapture = this.modifierSystem.handlePostCapture(piece, captured);
      if (postCapture.extraMove) {
        this.turnManager.grantExtraTurn(1);
        result.extraTurn = true;
      }
      if (postCapture.returnToStart) {
        result.captureRetreat = true;
        result.retreatTo = { col: fromCol, row: fromRow };
        const curTile = this.board.getTile(piece.col, piece.row);
        const startTile = this.board.getTile(fromCol, fromRow);
        if (startTile && startTile.isEmpty()) {
          curTile.removePiece();
          startTile.setPiece(piece);
        }
      }
      if (postCapture.explode && postCapture.adjacentEnemies.length > 0) {
        result.explosiveCapture = true;
        const removed = this.captureResolver.resolveExplosion(piece, postCapture.adjacentEnemies);
        result.explosionVictims = removed;
        for (const enemy of removed) {
          if (piece.team === TEAMS.PLAYER) {
            this.capturedByPlayer.push(enemy);
            this.goldEarned += this.captureResolver.getGoldValue(enemy);
          } else {
            this.capturedByEnemy.push(enemy);
          }
          if (enemy.type === PIECE_TYPES.KING) {
            this.endBattle(piece.team);
            result.kingCaptured = true;
            return;
          }
        }
      }
    }
  }
  applyIceSlide(piece, dx, dy) {
    if (dx === 0 && dy === 0) return null;
    const dirCol = dx === 0 ? 0 : dx > 0 ? 1 : -1;
    const dirRow = dy === 0 ? 0 : dy > 0 ? 1 : -1;
    const slideCol = piece.col + dirCol;
    const slideRow = piece.row + dirRow;
    const tile = this.board.getTile(slideCol, slideRow);
    if (tile && tile.isEmpty() && tile.isPassable()) {
      const fromTile = this.board.getTile(piece.col, piece.row);
      fromTile.removePiece();
      tile.setPiece(piece);
      return { col: slideCol, row: slideRow };
    }
    return null;
  }
  promotePiece(piece, newType) {
    piece.promote(newType);
    this.eventBus.emit("piecePromoted", { piece, newType });
  }
  endTurn() {
    if (this.modifierSystem) {
      this.modifierSystem.consumeRally();
    }
    const currentPieces = this.board.getTeamPieces(this.turnManager.currentTeam);
    for (const p of currentPieces) {
      if (p.isFrozen) p.isFrozen = false;
    }
    this.turnManager.nextTurn();
  }
  getAIMove() {
    if (!this.ai) return null;
    return this.ai.getBestMove(TEAMS.ENEMY);
  }
  endBattle(winnerTeam) {
    this.gameOver = true;
    this.winner = winnerTeam;
    this.eventBus.emit("combatEnd", {
      winner: winnerTeam,
      capturedByPlayer: this.capturedByPlayer,
      capturedByEnemy: this.capturedByEnemy,
      goldEarned: this.goldEarned,
      turns: this.turnManager.turnNumber
    });
  }
  isKingInCheck(team) {
    return this.checkDetector ? this.checkDetector.isKingInCheck(team) : false;
  }
  hasRelic(relicId) {
    return this.relics.some((r) => r.id === relicId);
  }
};

// src/pieces/Piece.js
var nextId = 1;
var Piece = class _Piece {
  constructor(type, team, col = 0, row = 0) {
    this.id = nextId++;
    this.type = type;
    this.team = team;
    this.col = col;
    this.row = row;
    this.hasMoved = false;
    this.moveCount = 0;
    this.modifiers = [];
    this.isFrozen = false;
    this.promotedFrom = null;
    this.originalType = type;
  }
  addModifier(modifier) {
    this.modifiers.push(modifier);
  }
  removeModifier(modifierId) {
    const idx = this.modifiers.findIndex((m) => m.id === modifierId);
    if (idx !== -1) this.modifiers.splice(idx, 1);
  }
  hasModifier(modifierId) {
    return this.modifiers.some((m) => m.id === modifierId);
  }
  getModifiersByType(type) {
    return this.modifiers.filter((m) => m.type === type);
  }
  promote(newType) {
    this.promotedFrom = this.type;
    this.type = newType;
  }
  clone() {
    const copy = new _Piece(this.type, this.team, this.col, this.row);
    copy.id = this.id;
    copy.hasMoved = this.hasMoved;
    copy.moveCount = this.moveCount;
    copy.modifiers = this.modifiers.map((m) => ({ ...m }));
    copy.isFrozen = this.isFrozen;
    copy.promotedFrom = this.promotedFrom;
    copy.originalType = this.originalType;
    return copy;
  }
  serialize() {
    return {
      id: this.id,
      type: this.type,
      team: this.team,
      col: this.col,
      row: this.row,
      hasMoved: this.hasMoved,
      moveCount: this.moveCount,
      modifiers: this.modifiers.map((m) => ({ ...m })),
      isFrozen: this.isFrozen,
      promotedFrom: this.promotedFrom,
      originalType: this.originalType
    };
  }
  static deserialize(data) {
    const piece = new _Piece(data.type, data.team, data.col, data.row);
    piece.id = data.id;
    piece.hasMoved = data.hasMoved;
    piece.moveCount = data.moveCount;
    piece.modifiers = data.modifiers || [];
    piece.isFrozen = data.isFrozen || false;
    piece.promotedFrom = data.promotedFrom || null;
    piece.originalType = data.originalType || data.type;
    if (data.id >= nextId) nextId = data.id + 1;
    return piece;
  }
};

// src/ai/BossAI.js
var BossAI = class {
  constructor(board, eventBus, bossData) {
    this.board = board;
    this.eventBus = eventBus;
    this.bossData = bossData;
    this.currentPhase = 0;
    this.phaseTriggered = /* @__PURE__ */ new Set([0]);
  }
  checkPhaseTransition() {
    const phases = this.bossData.phases;
    for (let i = this.currentPhase + 1; i < phases.length; i++) {
      if (this.phaseTriggered.has(i)) continue;
      const phase = phases[i];
      if (phase.triggerCondition === "piecesRemaining") {
        const enemyCount = this.board.getTeamPieces(TEAMS.ENEMY).length;
        if (enemyCount <= phase.triggerValue) {
          this.triggerPhase(i);
          return true;
        }
      }
    }
    return false;
  }
  triggerPhase(phaseIndex) {
    const phase = this.bossData.phases[phaseIndex];
    this.currentPhase = phaseIndex;
    this.phaseTriggered.add(phaseIndex);
    if (phase.addPieces) {
      for (const p of phase.addPieces) {
        const tile = this.board.getTile(p.col, p.row);
        if (tile && tile.isEmpty()) {
          const piece = new Piece(p.type, TEAMS.ENEMY, p.col, p.row);
          this.board.placePiece(piece, p.col, p.row);
        }
      }
    }
    if (phase.addTerrain) {
      for (const t of phase.addTerrain) {
        this.board.setTerrain(t.col, t.row, t.terrain);
      }
    }
    if (phase.removeTerrain) {
      for (const t of phase.removeTerrain) {
        this.board.setTerrain(t.col, t.row, "none");
      }
    }
    this.eventBus.emit("bossPhaseChange", {
      phase: phaseIndex,
      name: phase.name
    });
  }
  getBestMove() {
    const depth = this.currentPhase >= 2 ? 4 : 3;
    const result = Evaluator.minimax(this.board, depth, true, TEAMS.ENEMY);
    if (result && result.piece && result.move) {
      return result;
    }
    return this.getFallbackMove();
  }
  getFallbackMove() {
    const pieces = this.board.getTeamPieces(TEAMS.ENEMY);
    let bestMove = null;
    let bestScore = -Infinity;
    for (const piece of pieces) {
      if (piece.isFrozen) continue;
      const moves = MovementPattern.getMoves(piece, this.board, false).filter((m) => m.type !== "threat");
      for (const move of moves) {
        let score = AIBehaviors.evaluateMove(
          piece,
          move,
          this.board,
          TEAMS.ENEMY,
          TEAMS.PLAYER
        );
        const ownKing = this.board.findKing(TEAMS.ENEMY);
        if (ownKing && piece.type !== PIECE_TYPES.KING) {
          const distToOwnKing = Math.abs(move.col - ownKing.col) + Math.abs(move.row - ownKing.row);
          if (distToOwnKing <= 2) score += 15;
        }
        if (score > bestScore) {
          bestScore = score;
          bestMove = { piece, move, score };
        }
      }
    }
    return bestMove;
  }
};

// src/data/ArmyData.js
var ARMIES = {
  standard: {
    id: "standard",
    name: "Standard",
    description: "A full chess army",
    pieces: [
      { type: PIECE_TYPES.KING },
      { type: PIECE_TYPES.QUEEN },
      { type: PIECE_TYPES.ROOK },
      { type: PIECE_TYPES.ROOK },
      { type: PIECE_TYPES.BISHOP },
      { type: PIECE_TYPES.BISHOP },
      { type: PIECE_TYPES.KNIGHT },
      { type: PIECE_TYPES.KNIGHT },
      { type: PIECE_TYPES.PAWN },
      { type: PIECE_TYPES.PAWN },
      { type: PIECE_TYPES.PAWN },
      { type: PIECE_TYPES.PAWN },
      { type: PIECE_TYPES.PAWN },
      { type: PIECE_TYPES.PAWN },
      { type: PIECE_TYPES.PAWN },
      { type: PIECE_TYPES.PAWN }
    ],
    ability: null,
    color: "#c9a84e"
  }
};

// src/data/FloorData.js
var FLOOR_CONFIG = [
  { floor: 1, difficulty: 1, nodeCount: 3, paths: 2, types: { battle: 0.6, event: 0.2, rest: 0.2 } },
  { floor: 2, difficulty: 1, nodeCount: 3, paths: 2, types: { battle: 0.5, event: 0.2, shop: 0.15, rest: 0.15 } },
  { floor: 3, difficulty: 2, nodeCount: 4, paths: 2, types: { battle: 0.55, elite: 0.1, event: 0.1, shop: 0.15, rest: 0.1 } },
  { floor: 4, difficulty: 2, nodeCount: 4, paths: 3, types: { battle: 0.5, elite: 0.15, event: 0.1, shop: 0.15, rest: 0.1 } },
  { floor: 5, difficulty: 3, nodeCount: 1, paths: 1, types: { boss: 1 } },
  { floor: 6, difficulty: 3, nodeCount: 3, paths: 2, types: { battle: 0.5, event: 0.2, shop: 0.15, rest: 0.15 } },
  { floor: 7, difficulty: 4, nodeCount: 4, paths: 2, types: { battle: 0.5, elite: 0.15, event: 0.1, shop: 0.15, rest: 0.1 } },
  { floor: 8, difficulty: 4, nodeCount: 4, paths: 3, types: { battle: 0.45, elite: 0.2, event: 0.1, shop: 0.15, rest: 0.1 } },
  { floor: 9, difficulty: 5, nodeCount: 3, paths: 2, types: { battle: 0.4, elite: 0.2, shop: 0.2, rest: 0.2 } },
  { floor: 10, difficulty: 5, nodeCount: 1, paths: 1, types: { boss: 1 } }
];
function getFloorConfig(floor) {
  return FLOOR_CONFIG[floor - 1] || FLOOR_CONFIG[0];
}

// src/progression/FloorGenerator.js
var FloorGenerator = class {
  constructor(rng) {
    this.rng = rng;
  }
  generateFloor(floorNum) {
    const config = getFloorConfig(floorNum);
    if (config.types.boss) {
      const nodes2 = [{
        id: 0,
        type: "boss",
        floor: floorNum,
        layer: 0,
        layerIndex: 0,
        x: 0.5,
        y: 0.5,
        connections: [],
        visited: false
      }];
      return { floor: floorNum, nodes: nodes2, config, layers: 1 };
    }
    const layerCount = config.nodeCount;
    const nodesPerLayer = config.paths || 2;
    const nodes = [];
    let id = 0;
    const layers = [];
    for (let l = 0; l < layerCount; l++) {
      const layer = [];
      let count;
      if (l === 0) count = Math.min(nodesPerLayer, 2);
      else if (l === layerCount - 1) count = Math.min(nodesPerLayer, 2);
      else count = nodesPerLayer;
      for (let i = 0; i < count; i++) {
        const type = this.rollNodeType(config.types);
        const node = {
          id: id++,
          type,
          floor: floorNum,
          layer: l,
          layerIndex: i,
          x: (l + 0.5) / layerCount,
          y: count === 1 ? 0.5 : (i + 0.5) / count,
          connections: [],
          visited: false
        };
        layer.push(node);
        nodes.push(node);
      }
      layers.push(layer);
    }
    for (let l = 0; l < layers.length - 1; l++) {
      const current = layers[l];
      const next = layers[l + 1];
      for (const node of current) {
        const closest = next.reduce((best, n) => {
          const dist = Math.abs(node.layerIndex / current.length - n.layerIndex / next.length);
          const bestDist = Math.abs(node.layerIndex / current.length - best.layerIndex / next.length);
          return dist < bestDist ? n : best;
        }, next[0]);
        if (!node.connections.includes(closest.id)) {
          node.connections.push(closest.id);
        }
        if (next.length > 1 && this.rng.random() < 0.5) {
          const other = next.find((n) => n.id !== closest.id);
          if (other && !node.connections.includes(other.id)) {
            node.connections.push(other.id);
          }
        }
      }
      for (const nextNode of next) {
        const hasIncoming = current.some((n) => n.connections.includes(nextNode.id));
        if (!hasIncoming) {
          const closest = current.reduce((best, n) => {
            const dist = Math.abs(n.layerIndex / current.length - nextNode.layerIndex / next.length);
            const bestDist = Math.abs(best.layerIndex / current.length - nextNode.layerIndex / next.length);
            return dist < bestDist ? n : best;
          }, current[0]);
          closest.connections.push(nextNode.id);
        }
      }
    }
    return { floor: floorNum, nodes, config, layers: layerCount };
  }
  rollNodeType(typeWeights) {
    const types = Object.keys(typeWeights).filter((t) => t !== "boss");
    const weights = types.map((t) => typeWeights[t]);
    return this.rng.weightedChoice(types, weights);
  }
  generateMap(totalFloors = 10) {
    const floors = [];
    for (let i = 1; i <= totalFloors; i++) {
      floors.push(this.generateFloor(i));
    }
    return floors;
  }
};

// src/data/EnemyData.js
var ENEMY_ENCOUNTERS = {
  // Floor 1-2 encounters
  scoutPatrol: {
    id: "scoutPatrol",
    name: "Scout Patrol",
    difficulty: 1,
    boardSize: { cols: 8, rows: 8 },
    pieces: [
      { type: PIECE_TYPES.KING },
      { type: PIECE_TYPES.PAWN },
      { type: PIECE_TYPES.PAWN },
      { type: PIECE_TYPES.PAWN }
    ],
    goldReward: 8
  },
  pawnWall: {
    id: "pawnWall",
    name: "Pawn Wall",
    difficulty: 1,
    boardSize: { cols: 8, rows: 8 },
    pieces: [
      { type: PIECE_TYPES.KING },
      { type: PIECE_TYPES.PAWN },
      { type: PIECE_TYPES.PAWN },
      { type: PIECE_TYPES.PAWN },
      { type: PIECE_TYPES.PAWN }
    ],
    goldReward: 10
  },
  // Floor 3-4
  knightRaiders: {
    id: "knightRaiders",
    name: "Knight Raiders",
    difficulty: 2,
    boardSize: { cols: 8, rows: 8 },
    pieces: [
      { type: PIECE_TYPES.KING },
      { type: PIECE_TYPES.KNIGHT },
      { type: PIECE_TYPES.KNIGHT },
      { type: PIECE_TYPES.PAWN },
      { type: PIECE_TYPES.PAWN }
    ],
    goldReward: 14
  },
  bishopAmbush: {
    id: "bishopAmbush",
    name: "Bishop Ambush",
    difficulty: 2,
    boardSize: { cols: 8, rows: 8 },
    pieces: [
      { type: PIECE_TYPES.KING },
      { type: PIECE_TYPES.BISHOP },
      { type: PIECE_TYPES.BISHOP },
      { type: PIECE_TYPES.PAWN },
      { type: PIECE_TYPES.PAWN },
      { type: PIECE_TYPES.PAWN }
    ],
    goldReward: 14
  },
  // Floor 5-6
  rookGuard: {
    id: "rookGuard",
    name: "Rook Guard",
    difficulty: 3,
    boardSize: { cols: 8, rows: 8 },
    pieces: [
      { type: PIECE_TYPES.KING },
      { type: PIECE_TYPES.ROOK },
      { type: PIECE_TYPES.KNIGHT },
      { type: PIECE_TYPES.PAWN },
      { type: PIECE_TYPES.PAWN },
      { type: PIECE_TYPES.PAWN }
    ],
    goldReward: 18
  },
  mixedForce: {
    id: "mixedForce",
    name: "Mixed Force",
    difficulty: 3,
    boardSize: { cols: 8, rows: 8 },
    pieces: [
      { type: PIECE_TYPES.KING },
      { type: PIECE_TYPES.ROOK },
      { type: PIECE_TYPES.BISHOP },
      { type: PIECE_TYPES.KNIGHT },
      { type: PIECE_TYPES.PAWN },
      { type: PIECE_TYPES.PAWN },
      { type: PIECE_TYPES.PAWN }
    ],
    goldReward: 20
  },
  // Floor 7-8
  queenStrike: {
    id: "queenStrike",
    name: "Queen Strike",
    difficulty: 4,
    boardSize: { cols: 8, rows: 8 },
    pieces: [
      { type: PIECE_TYPES.KING },
      { type: PIECE_TYPES.QUEEN },
      { type: PIECE_TYPES.KNIGHT },
      { type: PIECE_TYPES.PAWN },
      { type: PIECE_TYPES.PAWN },
      { type: PIECE_TYPES.PAWN }
    ],
    goldReward: 24
  },
  fortress: {
    id: "fortress",
    name: "Fortified Position",
    difficulty: 4,
    boardSize: { cols: 8, rows: 8 },
    pieces: [
      { type: PIECE_TYPES.KING },
      { type: PIECE_TYPES.ROOK },
      { type: PIECE_TYPES.ROOK },
      { type: PIECE_TYPES.BISHOP },
      { type: PIECE_TYPES.PAWN },
      { type: PIECE_TYPES.PAWN },
      { type: PIECE_TYPES.PAWN }
    ],
    goldReward: 26
  },
  // Floor 9-10
  royalArmy: {
    id: "royalArmy",
    name: "Royal Army",
    difficulty: 5,
    boardSize: { cols: 8, rows: 8 },
    pieces: [
      { type: PIECE_TYPES.KING },
      { type: PIECE_TYPES.QUEEN },
      { type: PIECE_TYPES.ROOK },
      { type: PIECE_TYPES.BISHOP },
      { type: PIECE_TYPES.KNIGHT },
      { type: PIECE_TYPES.PAWN },
      { type: PIECE_TYPES.PAWN },
      { type: PIECE_TYPES.PAWN },
      { type: PIECE_TYPES.PAWN }
    ],
    goldReward: 30
  },
  grandArmy: {
    id: "grandArmy",
    name: "Grand Army",
    difficulty: 5,
    boardSize: { cols: 8, rows: 8 },
    pieces: [
      { type: PIECE_TYPES.KING },
      { type: PIECE_TYPES.ROOK },
      { type: PIECE_TYPES.BISHOP },
      { type: PIECE_TYPES.BISHOP },
      { type: PIECE_TYPES.KNIGHT },
      { type: PIECE_TYPES.PAWN },
      { type: PIECE_TYPES.PAWN },
      { type: PIECE_TYPES.PAWN }
    ],
    goldReward: 28
  },
  // Elites
  eliteKnightCommander: {
    id: "eliteKnightCommander",
    name: "Knight Commander",
    difficulty: 2,
    isElite: true,
    boardSize: { cols: 8, rows: 8 },
    pieces: [
      { type: PIECE_TYPES.KING },
      { type: PIECE_TYPES.KNIGHT },
      { type: PIECE_TYPES.KNIGHT },
      { type: PIECE_TYPES.KNIGHT },
      { type: PIECE_TYPES.PAWN },
      { type: PIECE_TYPES.PAWN }
    ],
    goldReward: 25
  },
  eliteBishopCouncil: {
    id: "eliteBishopCouncil",
    name: "Bishop Council",
    difficulty: 4,
    isElite: true,
    boardSize: { cols: 8, rows: 8 },
    pieces: [
      { type: PIECE_TYPES.KING },
      { type: PIECE_TYPES.BISHOP },
      { type: PIECE_TYPES.BISHOP },
      { type: PIECE_TYPES.BISHOP },
      { type: PIECE_TYPES.PAWN },
      { type: PIECE_TYPES.PAWN },
      { type: PIECE_TYPES.PAWN }
    ],
    goldReward: 28
  },
  eliteQueenGuard: {
    id: "eliteQueenGuard",
    name: "Queen's Guard",
    difficulty: 5,
    isElite: true,
    boardSize: { cols: 8, rows: 8 },
    pieces: [
      { type: PIECE_TYPES.KING },
      { type: PIECE_TYPES.QUEEN },
      { type: PIECE_TYPES.ROOK },
      { type: PIECE_TYPES.BISHOP },
      { type: PIECE_TYPES.KNIGHT },
      { type: PIECE_TYPES.PAWN },
      { type: PIECE_TYPES.PAWN },
      { type: PIECE_TYPES.PAWN }
    ],
    goldReward: 35
  }
};
function getEncountersForDifficulty(difficulty) {
  return Object.values(ENEMY_ENCOUNTERS).filter((e) => e.difficulty === difficulty && !e.isElite);
}
function getEliteEncounters(difficulty) {
  return Object.values(ENEMY_ENCOUNTERS).filter((e) => e.isElite && e.difficulty <= difficulty);
}

// src/data/TerrainData.js
var TERRAIN_INFO = {
  [TERRAIN_TYPES.FORTRESS]: {
    name: "Fortress",
    description: "Piece on this square can't be captured",
    color: { light: "#a0c4ff", dark: "#7ba7e0" },
    symbol: "\u{1F6E1}"
  },
  [TERRAIN_TYPES.ICE]: {
    name: "Ice",
    description: "Piece that moves here slides one extra square in the same direction",
    color: { light: "#cce5ff", dark: "#99ccee" },
    symbol: "\u2744"
  },
  [TERRAIN_TYPES.BRAMBLE]: {
    name: "Bramble",
    description: "Piece that moves here can't move next turn",
    color: { light: "#8bc34a", dark: "#689f38" },
    symbol: "\u2663"
  },
  [TERRAIN_TYPES.VOID]: {
    name: "Void",
    description: "Impassable \u2014 no piece can enter",
    color: { light: "#2a2a2a", dark: "#1a1a1a" },
    symbol: "\u25AA"
  },
  [TERRAIN_TYPES.ALTAR]: {
    name: "Altar",
    description: "Pawn stepping here promotes immediately",
    color: { light: "#ffd54f", dark: "#ffb300" },
    symbol: "\u2606"
  }
};
function getRandomTerrain(rng = Math) {
  const types = [TERRAIN_TYPES.FORTRESS, TERRAIN_TYPES.ICE, TERRAIN_TYPES.BRAMBLE, TERRAIN_TYPES.ALTAR];
  return types[Math.floor(rng.random() * types.length)];
}

// src/progression/EncounterGenerator.js
var EncounterGenerator = class {
  constructor(rng) {
    this.rng = rng;
  }
  generateBattle(floor, difficulty) {
    const encounters = getEncountersForDifficulty(difficulty);
    if (encounters.length === 0) return this.generateFallback(floor, difficulty);
    const encounter = this.rng.randomChoice(encounters);
    return this.buildEncounter(encounter, floor);
  }
  generateElite(floor, difficulty) {
    const elites = getEliteEncounters(difficulty);
    if (elites.length === 0) return this.generateBattle(floor, difficulty);
    const encounter = this.rng.randomChoice(elites);
    return this.buildEncounter(encounter, floor);
  }
  buildEncounter(encounter, floor) {
    const { cols, rows } = encounter.boardSize;
    const midCol = Math.floor(cols / 2);
    const enemyPieces = [];
    const occupied = /* @__PURE__ */ new Set();
    const deepFormation = rows >= 7;
    const kingRow = deepFormation ? 1 : 0;
    const pawnRow = deepFormation ? 2 : 1;
    enemyPieces.push({ type: PIECE_TYPES.KING, col: midCol, row: kingRow });
    occupied.add(`${midCol},${kingRow}`);
    const remaining = encounter.pieces.filter((p) => p.type !== PIECE_TYPES.KING);
    const pawns = remaining.filter((p) => p.type === PIECE_TYPES.PAWN);
    const officers = remaining.filter((p) => p.type !== PIECE_TYPES.PAWN);
    let pawnOffset = 0;
    for (const p of pawns) {
      let col = Math.min(cols - 1, Math.max(0, midCol + pawnOffset));
      const row = pawnRow;
      while (occupied.has(`${col},${row}`) && col < cols) col++;
      if (col >= cols) col = 0;
      while (occupied.has(`${col},${row}`)) col++;
      occupied.add(`${col},${row}`);
      enemyPieces.push({ type: PIECE_TYPES.PAWN, col, row });
      if (pawnOffset === 0) pawnOffset = 1;
      else pawnOffset = pawnOffset > 0 ? -pawnOffset : -pawnOffset + 1;
    }
    let officerOffset = 1;
    for (const p of officers) {
      let col = Math.min(cols - 1, Math.max(0, midCol + officerOffset));
      let row = kingRow;
      if (occupied.has(`${col},${row}`)) {
        row = 0;
        col = Math.min(cols - 1, Math.max(0, midCol + officerOffset));
      }
      while (occupied.has(`${col},${row}`)) {
        col = (col + 1) % cols;
      }
      occupied.add(`${col},${row}`);
      enemyPieces.push({ type: p.type, col, row });
      officerOffset = officerOffset > 0 ? -officerOffset : -officerOffset + 1;
    }
    const terrain = [];
    if (floor >= 3 && this.rng.random() < 0.4 + floor * 0.05) {
      const count = this.rng.randomInt(1, Math.min(4, Math.floor(floor / 2)));
      for (let i = 0; i < count; i++) {
        const tc = this.rng.randomInt(0, cols - 1);
        const tr = this.rng.randomInt(2, rows - 3);
        if (!enemyPieces.some((p) => p.col === tc && p.row === tr)) {
          terrain.push({ col: tc, row: tr, terrain: getRandomTerrain(this.rng) });
        }
      }
    }
    return {
      name: encounter.name,
      cols,
      rows,
      enemyPieces,
      terrain,
      goldReward: encounter.goldReward,
      isElite: encounter.isElite || false,
      difficulty: encounter.difficulty
    };
  }
  generateFallback(floor, difficulty) {
    const cols = 8;
    const rows = 8;
    const midCol = Math.floor(cols / 2);
    const enemyPieces = [{ type: PIECE_TYPES.KING, col: midCol, row: 0 }];
    const pawnCount = Math.min(cols - 1, 1 + floor);
    for (let i = 0; i < pawnCount; i++) {
      const c = Math.min(cols - 1, Math.max(0, midCol - Math.floor(pawnCount / 2) + i));
      enemyPieces.push({ type: PIECE_TYPES.PAWN, col: c, row: 1 });
    }
    if (floor >= 3) enemyPieces.push({ type: PIECE_TYPES.KNIGHT, col: midCol - 1, row: 0 });
    if (floor >= 5) enemyPieces.push({ type: PIECE_TYPES.BISHOP, col: midCol + 1, row: 0 });
    if (floor >= 7) enemyPieces.push({ type: PIECE_TYPES.ROOK, col: midCol + 2, row: 0 });
    return {
      name: "Enemy Force",
      cols,
      rows,
      enemyPieces,
      terrain: [],
      goldReward: 5 + floor * 3,
      isElite: false,
      difficulty
    };
  }
  placePlayerPieces(roster, cols, rows, enemyCount = Infinity) {
    const placed = [];
    const occupied = /* @__PURE__ */ new Set();
    const lastRow = rows - 1;
    const pawnRow = lastRow - 1;
    const backRankOrder = [
      PIECE_TYPES.ROOK,
      PIECE_TYPES.KNIGHT,
      PIECE_TYPES.BISHOP,
      PIECE_TYPES.QUEEN,
      PIECE_TYPES.KING,
      PIECE_TYPES.BISHOP,
      PIECE_TYPES.KNIGHT,
      PIECE_TYPES.ROOK
    ];
    const byType = {};
    for (const piece of roster) {
      if (!byType[piece.type]) byType[piece.type] = [];
      byType[piece.type].push(piece);
    }
    for (let col = 0; col < Math.min(cols, backRankOrder.length); col++) {
      const type = backRankOrder[col];
      if (byType[type] && byType[type].length > 0) {
        const piece = byType[type].shift();
        const key = `${col},${lastRow}`;
        occupied.add(key);
        placed.push({ piece, col, row: lastRow });
      }
    }
    if (byType[PIECE_TYPES.PAWN]) {
      let col = 0;
      for (const piece of byType[PIECE_TYPES.PAWN]) {
        while (col < cols && occupied.has(`${col},${pawnRow}`)) col++;
        if (col >= cols) break;
        occupied.add(`${col},${pawnRow}`);
        placed.push({ piece, col, row: pawnRow });
        col++;
      }
    }
    const remaining = [];
    for (const type of Object.keys(byType)) {
      if (type === PIECE_TYPES.PAWN) continue;
      for (const piece of byType[type]) {
        remaining.push(piece);
      }
    }
    let overflowRow = lastRow - 2;
    let overflowCol = 0;
    for (const piece of remaining) {
      while (overflowRow >= Math.floor(rows * 0.5)) {
        const key = `${overflowCol},${overflowRow}`;
        if (!occupied.has(key)) {
          occupied.add(key);
          placed.push({ piece, col: overflowCol, row: overflowRow });
          overflowCol++;
          break;
        }
        overflowCol++;
        if (overflowCol >= cols) {
          overflowCol = 0;
          overflowRow--;
        }
      }
    }
    return placed;
  }
};

// src/data/RelicData.js
var RELICS = {
  freeMove: {
    id: "freeMove",
    name: "Initiative Crown",
    description: "Start each battle with a free move",
    rarity: "uncommon",
    shopPrice: 20
  },
  captureStreak: {
    id: "captureStreak",
    name: "Bloodthirst Amulet",
    description: "Capturing 3 pieces in a row grants an extra turn",
    rarity: "rare",
    shopPrice: 30
  },
  earlyPromotion: {
    id: "earlyPromotion",
    name: "Fast Track Banner",
    description: "Pawns promote one rank earlier",
    rarity: "uncommon",
    shopPrice: 18
  },
  pawnForwardCapture: {
    id: "pawnForwardCapture",
    name: "Spearmaster's Manual",
    description: "All pawns can capture forward",
    rarity: "common",
    shopPrice: 12
  },
  extraPieceOnPromote: {
    id: "extraPieceOnPromote",
    name: "Recruitment Scroll",
    description: "Gain an extra pawn when you promote",
    rarity: "rare",
    shopPrice: 22
  },
  enemySlowed: {
    id: "enemySlowed",
    name: "Leaden Crown",
    description: "Enemy king can only move every other turn",
    rarity: "common",
    shopPrice: 8
  },
  goldBonus: {
    id: "goldBonus",
    name: "Merchant's Purse",
    description: "Earn 50% more gold from battles",
    rarity: "uncommon",
    shopPrice: 15
  },
  healingRest: {
    id: "healingRest",
    name: "Sanctuary Bell",
    description: "Rest nodes recruit a knight instead of a pawn",
    rarity: "rare",
    shopPrice: 25
  },
  shieldStart: {
    id: "shieldStart",
    name: "Vanguard Shield",
    description: "Your front-row pawns have first-turn protection at battle start",
    rarity: "uncommon",
    shopPrice: 14
  },
  terrainSight: {
    id: "terrainSight",
    name: "Cartographer's Lens",
    description: "See terrain before choosing battle path",
    rarity: "common",
    shopPrice: 10
  }
};
function getRandomRelic(ownedRelicIds = [], rng = Math) {
  const available = Object.values(RELICS).filter((r) => !ownedRelicIds.includes(r.id));
  if (available.length === 0) return null;
  return available[Math.floor(rng.random() * available.length)];
}

// src/progression/RelicSystem.js
var RelicSystem = class {
  constructor(eventBus) {
    this.eventBus = eventBus;
    this.ownedRelics = [];
  }
  addRelic(relic) {
    if (this.hasRelic(relic.id)) return false;
    this.ownedRelics.push({ ...relic });
    this.eventBus.emit("relicGained", { relic });
    return true;
  }
  removeRelic(relicId) {
    const idx = this.ownedRelics.findIndex((r) => r.id === relicId);
    if (idx === -1) return false;
    const removed = this.ownedRelics.splice(idx, 1)[0];
    this.eventBus.emit("relicLost", { relic: removed });
    return true;
  }
  hasRelic(relicId) {
    return this.ownedRelics.some((r) => r.id === relicId);
  }
  getRelic(relicId) {
    return this.ownedRelics.find((r) => r.id === relicId);
  }
  getRandomReward(rng = Math) {
    const ownedIds = this.ownedRelics.map((r) => r.id);
    return getRandomRelic(ownedIds, rng);
  }
  getShopOfferings(count = 3, rng = Math) {
    const ownedIds = this.ownedRelics.map((r) => r.id);
    const available = Object.values(RELICS).filter((r) => !ownedIds.includes(r.id));
    const shuffled = [...available].sort(() => rng.random() - 0.5);
    return shuffled.slice(0, count);
  }
  serialize() {
    return this.ownedRelics.map((r) => ({ ...r }));
  }
  deserialize(data) {
    this.ownedRelics = data.map((r) => ({ ...r }));
  }
};

// src/data/ModifierData.js
var MODIFIER_TYPES = {
  MOVEMENT: "movement",
  CAPTURE: "capture",
  DEFENSE: "defense",
  AURA: "aura",
  RISK: "risk"
};
var MODIFIERS = {
  // === MOVEMENT (8) ===
  leapOver: {
    id: "leapOver",
    name: "Leap Over",
    description: "Sliding pieces can jump over one blocking piece in their path",
    shortDescription: "Jump over 1 blocker",
    category: MODIFIER_TYPES.MOVEMENT,
    rarity: "rare",
    shopPrice: 15,
    redundantFor: []
  },
  extraRange: {
    id: "extraRange",
    name: "Extended Reach",
    description: "Sliding moves extend 2 extra squares in each direction",
    shortDescription: "+2 slide range",
    category: MODIFIER_TYPES.MOVEMENT,
    rarity: "common",
    shopPrice: 8,
    redundantFor: ["queen", "rook", "bishop"]
  },
  kingStep: {
    id: "kingStep",
    name: "Royal Step",
    description: "Can also move one square in any direction, like a king",
    shortDescription: "+king moves",
    category: MODIFIER_TYPES.MOVEMENT,
    rarity: "uncommon",
    shopPrice: 12,
    redundantFor: ["queen", "king"]
  },
  sidestep: {
    id: "sidestep",
    name: "Sidestep",
    description: "Can move one square left or right along the same row",
    shortDescription: "+1 left/right",
    category: MODIFIER_TYPES.MOVEMENT,
    rarity: "common",
    shopPrice: 6,
    redundantFor: ["queen", "rook", "king"]
  },
  retreat: {
    id: "retreat",
    name: "Retreat",
    description: "Can move one square directly backward",
    shortDescription: "+1 backward",
    category: MODIFIER_TYPES.MOVEMENT,
    rarity: "common",
    shopPrice: 6,
    redundantFor: ["queen", "rook", "king"]
  },
  diagonalSlip: {
    id: "diagonalSlip",
    name: "Diagonal Slip",
    description: "Can move one square diagonally in any direction",
    shortDescription: "+diagonal step",
    category: MODIFIER_TYPES.MOVEMENT,
    rarity: "common",
    shopPrice: 7,
    redundantFor: ["queen", "bishop", "king"]
  },
  charge: {
    id: "charge",
    name: "Charge",
    description: "On first move of battle, sliding range extends by 3 extra squares",
    shortDescription: "+3 range on first move",
    category: MODIFIER_TYPES.MOVEMENT,
    rarity: "uncommon",
    shopPrice: 10,
    redundantFor: ["queen", "rook", "bishop"]
  },
  phasing: {
    id: "phasing",
    name: "Phasing",
    description: "Slides pass through blocking pieces as if they were not there",
    shortDescription: "Ignore blockers",
    category: MODIFIER_TYPES.MOVEMENT,
    rarity: "legendary",
    shopPrice: 22,
    redundantFor: []
  },
  // === CAPTURE (4) ===
  forwardCapture: {
    id: "forwardCapture",
    name: "Pike",
    description: "Can capture one square directly forward",
    shortDescription: "+forward capture",
    category: MODIFIER_TYPES.CAPTURE,
    rarity: "common",
    shopPrice: 8,
    redundantFor: ["queen", "rook"]
  },
  doubleCapture: {
    id: "doubleCapture",
    name: "Zealous Pursuit",
    description: "After capturing, this piece can move again",
    shortDescription: "Extra move on capture",
    category: MODIFIER_TYPES.CAPTURE,
    rarity: "rare",
    shopPrice: 18,
    redundantFor: []
  },
  captureChain: {
    id: "captureChain",
    name: "Chain Strike",
    description: "After capturing, if another capture is immediately available, move again",
    shortDescription: "Chain captures",
    category: MODIFIER_TYPES.CAPTURE,
    rarity: "uncommon",
    shopPrice: 14,
    redundantFor: []
  },
  captureRetreat: {
    id: "captureRetreat",
    name: "Hit and Run",
    description: "After capturing, return to starting square",
    shortDescription: "Return after capture",
    category: MODIFIER_TYPES.CAPTURE,
    rarity: "uncommon",
    shopPrice: 12,
    redundantFor: []
  },
  // === DEFENSE (7) ===
  firstTurnShield: {
    id: "firstTurnShield",
    name: "Opening Guard",
    description: "Cannot be captured during the first 2 turns of battle",
    shortDescription: "Immune turns 1-2",
    category: MODIFIER_TYPES.DEFENSE,
    rarity: "common",
    shopPrice: 5,
    redundantFor: []
  },
  flankShield: {
    id: "flankShield",
    name: "Flanking Shield",
    description: "Cannot be captured from the side (same row)",
    shortDescription: "Side-immune",
    category: MODIFIER_TYPES.DEFENSE,
    rarity: "uncommon",
    shopPrice: 14,
    redundantFor: []
  },
  rearShield: {
    id: "rearShield",
    name: "Rear Guard",
    description: "Cannot be captured from behind",
    shortDescription: "Back-immune",
    category: MODIFIER_TYPES.DEFENSE,
    rarity: "uncommon",
    shopPrice: 12,
    redundantFor: []
  },
  adjacencyShield: {
    id: "adjacencyShield",
    name: "Formation Guard",
    description: "Cannot be captured while adjacent to a friendly piece",
    shortDescription: "Immune near allies",
    category: MODIFIER_TYPES.DEFENSE,
    rarity: "rare",
    shopPrice: 16,
    redundantFor: []
  },
  lastStand: {
    id: "lastStand",
    name: "Last Stand",
    description: "When this is the last non-king piece, immune for 3 turns",
    shortDescription: "Immune as last piece",
    category: MODIFIER_TYPES.DEFENSE,
    rarity: "rare",
    shopPrice: 14,
    redundantFor: []
  },
  anchored: {
    id: "anchored",
    name: "Anchored",
    description: "Cannot be captured, but limited to 2 squares of movement",
    shortDescription: "Immovable fortress",
    category: MODIFIER_TYPES.DEFENSE,
    rarity: "legendary",
    shopPrice: 20,
    redundantFor: []
  },
  gamblersFate: {
    id: "gamblersFate",
    name: "Gambler's Fate",
    description: "50% chance to survive being captured",
    shortDescription: "50% dodge capture",
    category: MODIFIER_TYPES.DEFENSE,
    rarity: "rare",
    shopPrice: 16,
    redundantFor: []
  },
  // === AURA (5) ===
  inspire: {
    id: "inspire",
    name: "Inspire",
    description: "Adjacent friendly pieces gain +1 sliding range",
    shortDescription: "Allies +1 range",
    category: MODIFIER_TYPES.AURA,
    rarity: "rare",
    shopPrice: 16,
    redundantFor: []
  },
  intimidate: {
    id: "intimidate",
    name: "Intimidate",
    description: "Adjacent enemy pieces lose 1 sliding range (minimum 1)",
    shortDescription: "Enemies -1 range",
    category: MODIFIER_TYPES.AURA,
    rarity: "uncommon",
    shopPrice: 12,
    redundantFor: []
  },
  guardian: {
    id: "guardian",
    name: "Guardian",
    description: "Adjacent friendly pieces can't be captured from this piece's direction",
    shortDescription: "Shield allies from side",
    category: MODIFIER_TYPES.AURA,
    rarity: "rare",
    shopPrice: 16,
    redundantFor: []
  },
  decoy: {
    id: "decoy",
    name: "Decoy",
    description: "Enemy AI prioritizes capturing this piece over others",
    shortDescription: "Draws enemy fire",
    category: MODIFIER_TYPES.AURA,
    rarity: "uncommon",
    shopPrice: 10,
    redundantFor: []
  },
  rally: {
    id: "rally",
    name: "Rally Cry",
    description: "When this piece captures, all friendlies gain +1 range next turn",
    shortDescription: "Capture buffs team",
    category: MODIFIER_TYPES.AURA,
    rarity: "legendary",
    shopPrice: 20,
    redundantFor: []
  },
  // === RISK/REWARD (4) ===
  glasscannon: {
    id: "glasscannon",
    name: "Glass Cannon",
    description: "+3 sliding range, but all protections on this piece are bypassed",
    shortDescription: "+3 range, no defense",
    category: MODIFIER_TYPES.RISK,
    rarity: "uncommon",
    shopPrice: 10,
    redundantFor: ["queen", "rook", "bishop"]
  },
  berserker: {
    id: "berserker",
    name: "Berserker",
    description: "Gains +1 sliding range for each capture made this battle",
    shortDescription: "+range per kill",
    category: MODIFIER_TYPES.RISK,
    rarity: "rare",
    shopPrice: 16,
    redundantFor: ["queen", "rook", "bishop"]
  },
  explosiveCapture: {
    id: "explosiveCapture",
    name: "Explosive Capture",
    description: "When capturing, also removes all adjacent enemy pieces",
    shortDescription: "AoE on capture",
    category: MODIFIER_TYPES.RISK,
    rarity: "legendary",
    shopPrice: 24,
    redundantFor: []
  },
  rangedCapture: {
    id: "rangedCapture",
    name: "Ranged Strike",
    description: "Can capture at range without moving to the target square",
    shortDescription: "Capture at distance",
    category: MODIFIER_TYPES.RISK,
    rarity: "legendary",
    shopPrice: 22,
    redundantFor: []
  }
};
var RARITY_WEIGHTS = { common: 50, uncommon: 30, rare: 15, legendary: 5 };
function getRandomModifier(rng = Math) {
  const all = Object.values(MODIFIERS);
  return all[Math.floor(rng.random() * all.length)];
}
function getUpgradePackChoices(rng, excludeIds = [], count = 3, rosterTypes = []) {
  const nonKingTypes = rosterTypes.filter((t) => t !== "king");
  const pool = Object.values(MODIFIERS).filter((m) => {
    if (excludeIds.includes(m.id)) return false;
    if (m.redundantFor && m.redundantFor.length > 0 && nonKingTypes.length > 0) {
      if (nonKingTypes.every((t) => m.redundantFor.includes(t))) return false;
    }
    return true;
  });
  if (pool.length === 0) return [];
  const totalWeight = Object.entries(RARITY_WEIGHTS).reduce((sum, [rarity, w]) => {
    return sum + (pool.some((m) => m.rarity === rarity) ? w : 0);
  }, 0);
  const choices = [];
  const used = /* @__PURE__ */ new Set();
  for (let i = 0; i < count && used.size < pool.length; i++) {
    let roll = rng.random() * totalWeight;
    let selectedRarity = "common";
    for (const [rarity, w] of Object.entries(RARITY_WEIGHTS)) {
      if (!pool.some((m) => m.rarity === rarity && !used.has(m.id))) continue;
      roll -= w;
      if (roll <= 0) {
        selectedRarity = rarity;
        break;
      }
    }
    const candidates = pool.filter((m) => m.rarity === selectedRarity && !used.has(m.id));
    if (candidates.length === 0) {
      const fallback = pool.filter((m) => !used.has(m.id));
      if (fallback.length === 0) break;
      const pick = fallback[Math.floor(rng.random() * fallback.length)];
      choices.push(pick);
      used.add(pick.id);
    } else {
      const pick = candidates[Math.floor(rng.random() * candidates.length)];
      choices.push(pick);
      used.add(pick.id);
    }
  }
  return choices;
}

// src/progression/Shop.js
var Shop = class {
  constructor(rng, eventBus) {
    this.rng = rng;
    this.eventBus = eventBus;
    this.items = [];
  }
  generate(floor, ownedRelicIds = []) {
    this.items = [];
    const pieceTypes = [PIECE_TYPES.PAWN, PIECE_TYPES.KNIGHT, PIECE_TYPES.BISHOP, PIECE_TYPES.ROOK, PIECE_TYPES.QUEEN];
    const shuffled = this.rng.shuffle(pieceTypes);
    const pieceCount = this.rng.randomInt(2, 3);
    for (let i = 0; i < pieceCount; i++) {
      const type = shuffled[i];
      this.items.push({
        category: "piece",
        type,
        price: SHOP_PRICES[type] || 10,
        name: type.charAt(0).toUpperCase() + type.slice(1),
        description: `Recruit a ${type} to your army`
      });
    }
    const modCount = this.rng.randomInt(1, 2);
    for (let i = 0; i < modCount; i++) {
      const mod = getRandomModifier(this.rng);
      if (mod && !this.items.some((it) => it.id === mod.id)) {
        this.items.push({
          category: "modifier",
          id: mod.id,
          price: mod.shopPrice,
          name: mod.name,
          description: mod.description,
          rarity: mod.rarity,
          modifier: mod
        });
      }
    }
    const relic = getRandomRelic(ownedRelicIds, this.rng);
    if (relic) {
      this.items.push({
        category: "relic",
        id: relic.id,
        price: relic.shopPrice,
        name: relic.name,
        description: relic.description,
        relic
      });
    }
    return this.items;
  }
  canAfford(item, gold) {
    return gold >= item.price;
  }
  purchase(item, runManager) {
    if (!this.canAfford(item, runManager.gold)) return false;
    runManager.gold -= item.price;
    switch (item.category) {
      case "piece":
        runManager.recruitPiece(item.type);
        break;
      case "modifier":
        this.eventBus.emit("modifierPurchased", { modifier: item.modifier });
        break;
      case "relic":
        runManager.addRelic(item.relic);
        break;
    }
    const idx = this.items.indexOf(item);
    if (idx !== -1) this.items.splice(idx, 1);
    this.eventBus.emit("shopPurchase", { item });
    return true;
  }
};

// src/progression/RunManager.js
var RunManager = class {
  constructor(eventBus) {
    this.eventBus = eventBus;
    this.rng = null;
    this.seed = 0;
    this.roster = [];
    this.gold = STARTING_GOLD;
    this.currentFloor = 1;
    this.currentNode = null;
    this.armyId = null;
    this.armyAbility = null;
    this.difficulty = "normal";
    this.relicSystem = new RelicSystem(eventBus);
    this.floorGenerator = null;
    this.encounterGenerator = null;
    this.shop = null;
    this.prisoners = {};
    this.map = [];
    this.stats = { battlesWon: 0, piecesLost: 0, piecesRecruited: 0, goldSpent: 0, floorsCleared: 0 };
    this.isActive = false;
  }
  startRun(armyId, seed = null) {
    this.seed = seed || SeededRNG.generateSeed();
    this.rng = new SeededRNG(this.seed);
    this.floorGenerator = new FloorGenerator(this.rng);
    this.encounterGenerator = new EncounterGenerator(this.rng);
    this.shop = new Shop(this.rng, this.eventBus);
    this.armyId = armyId;
    const army = ARMIES[armyId];
    this.armyAbility = army.ability;
    this.difficulty = "normal";
    this.roster = army.pieces.map((p) => new Piece(p.type, TEAMS.PLAYER));
    this.gold = STARTING_GOLD;
    this.currentFloor = 1;
    this.currentNode = null;
    this.relicSystem = new RelicSystem(this.eventBus);
    this.prisoners = {};
    this.stats = { battlesWon: 0, piecesLost: 0, piecesRecruited: 0, goldSpent: 0, floorsCleared: 0 };
    this.map = this.floorGenerator.generateMap(TOTAL_FLOORS);
    this.isActive = true;
    this.eventBus.emit("runStarted", { army, seed: this.seed });
  }
  startRunFromDraft(difficulty, pieceTypes, seed = null) {
    this.seed = seed || SeededRNG.generateSeed();
    this.rng = new SeededRNG(this.seed);
    this.floorGenerator = new FloorGenerator(this.rng);
    this.encounterGenerator = new EncounterGenerator(this.rng);
    this.shop = new Shop(this.rng, this.eventBus);
    this.armyId = "draft";
    this.armyAbility = null;
    this.difficulty = difficulty;
    this.roster = [];
    this.roster.push(new Piece(PIECE_TYPES.KING, TEAMS.PLAYER));
    for (const type of pieceTypes) {
      if (type !== PIECE_TYPES.KING) {
        this.roster.push(new Piece(type, TEAMS.PLAYER));
      }
    }
    this.gold = STARTING_GOLD;
    this.currentFloor = 1;
    this.currentNode = null;
    this.relicSystem = new RelicSystem(this.eventBus);
    this.prisoners = {};
    this.stats = { battlesWon: 0, piecesLost: 0, piecesRecruited: 0, goldSpent: 0, floorsCleared: 0 };
    this.map = this.floorGenerator.generateMap(TOTAL_FLOORS);
    this.isActive = true;
    this.eventBus.emit("runStarted", { armyId: "draft", difficulty, seed: this.seed });
  }
  getCurrentFloorData() {
    return this.map[this.currentFloor - 1] || null;
  }
  getEncounter(nodeType) {
    const difficulty = Math.min(5, Math.ceil(this.currentFloor / 2));
    switch (nodeType) {
      case "battle":
        return this.encounterGenerator.generateBattle(this.currentFloor, difficulty);
      case "elite":
        return this.encounterGenerator.generateElite(this.currentFloor, difficulty);
      case "boss":
        return { name: `Boss (Floor ${this.currentFloor})`, isBoss: true, difficulty };
      default:
        return null;
    }
  }
  prepareCombat(encounter) {
    const enemyCount = encounter.enemyPieces ? encounter.enemyPieces.length : Infinity;
    const playerPlacement = this.encounterGenerator.placePlayerPieces(
      this.roster,
      encounter.cols,
      encounter.rows,
      enemyCount
    );
    return {
      cols: encounter.cols,
      rows: encounter.rows,
      playerPieces: playerPlacement,
      enemyPieces: encounter.enemyPieces,
      terrain: encounter.terrain,
      difficulty: encounter.difficulty,
      relics: this.relicSystem.ownedRelics,
      armyAbility: this.armyAbility,
      encounterName: encounter.name
    };
  }
  onBattleWon(result) {
    this.stats.battlesWon++;
    let goldMult = 1 + (this.currentFloor - 1) * 0.1;
    if (this.relicSystem.ownedRelics.some((r) => r.id === "goldBonus")) goldMult *= 1.5;
    const gold = Math.floor((result.goldEarned || 10) * goldMult);
    this.gold += gold;
    if (result.capturedByEnemy) {
      for (const captured of result.capturedByEnemy) {
        const idx = this.roster.findIndex((p) => p.id === captured.id);
        if (idx !== -1) {
          this.roster.splice(idx, 1);
          this.stats.piecesLost++;
        }
      }
    }
    const boardPieces = result.survivingPlayerPieces || [];
    for (const bp of boardPieces) {
      const rosterPiece = this.roster.find((p) => p.id === bp.id);
      if (rosterPiece && bp.promotedFrom) {
        rosterPiece.type = bp.type;
        rosterPiece.promotedFrom = bp.promotedFrom;
      }
    }
    if (result.capturedByPlayer) {
      for (const captured of result.capturedByPlayer) {
        this.addPrisoner(captured.type);
      }
    }
    return this._getBattleRewards(this.currentFloor, result.isElite);
  }
  _getBattleRewards(floor, isElite) {
    const rewards = { gold: 0, relic: null, recruitOptions: [] };
    const base = 8 + floor * 3;
    const range = 5 + floor;
    rewards.gold = base + this.rng.randomInt(0, range);
    if (isElite) rewards.gold = Math.floor(rewards.gold * 1.5);
    if (isElite) {
      rewards.relic = getRandomRelic([], this.rng);
    }
    rewards.recruitOptions = [{ type: PIECE_TYPES.PAWN, cost: 0 }];
    if (floor >= 2 && this.rng.random() < 0.4 + floor * 0.05) {
      rewards.recruitOptions.push({
        type: this.rng.randomChoice([PIECE_TYPES.KNIGHT, PIECE_TYPES.BISHOP]),
        cost: 0
      });
    }
    return rewards;
  }
  onBattleLost() {
    this.isActive = false;
    this.eventBus.emit("runEnded", { victory: false, stats: this.stats });
  }
  advanceFloor() {
    this.currentFloor++;
    this.stats.floorsCleared++;
    if (this.currentFloor > TOTAL_FLOORS) {
      this.isActive = false;
      this.eventBus.emit("runEnded", { victory: true, stats: this.stats });
      return false;
    }
    return true;
  }
  recruitPiece(type) {
    if (this.roster.length >= ROSTER_LIMIT) return null;
    const piece = new Piece(type, TEAMS.PLAYER);
    this.roster.push(piece);
    this.stats.piecesRecruited++;
    this.eventBus.emit("pieceRecruited", { piece });
    return piece;
  }
  addRelic(relic) {
    this.relicSystem.addRelic(relic);
  }
  addPrisoner(type) {
    if (type === PIECE_TYPES.KING) return;
    if (!this.prisoners[type]) this.prisoners[type] = 0;
    this.prisoners[type]++;
  }
  convertPrisoners(type) {
    if ((this.prisoners[type] || 0) < 3) return false;
    if (this.roster.length >= ROSTER_LIMIT) return false;
    this.prisoners[type] -= 3;
    this.recruitPiece(type);
    return true;
  }
  releasePrisoner(type) {
    if ((this.prisoners[type] || 0) < 1) return 0;
    this.prisoners[type]--;
    const ransom = { pawn: 2, knight: 4, bishop: 4, rook: 6, queen: 10 };
    const gold = ransom[type] || 2;
    this.gold += gold;
    return gold;
  }
  generateShop() {
    const ownedIds = this.relicSystem.ownedRelics.map((r) => r.id);
    return this.shop.generate(this.currentFloor, ownedIds);
  }
  purchaseShopItem(item) {
    if (this.gold < item.price) return false;
    this.gold -= item.price;
    this.stats.goldSpent += item.price;
    if (item.category === "piece") {
      this.recruitPiece(item.type);
    } else if (item.category === "relic") {
      this.addRelic(item.relic);
    }
    const idx = this.shop.items.indexOf(item);
    if (idx !== -1) this.shop.items.splice(idx, 1);
    return true;
  }
  serialize() {
    return {
      seed: this.seed,
      armyId: this.armyId,
      difficulty: this.difficulty,
      roster: this.roster.map((p) => p.serialize()),
      gold: this.gold,
      currentFloor: this.currentFloor,
      relics: this.relicSystem.serialize(),
      prisoners: { ...this.prisoners },
      stats: { ...this.stats },
      isActive: this.isActive
    };
  }
  deserialize(data) {
    this.seed = data.seed;
    this.rng = new SeededRNG(data.seed);
    this.floorGenerator = new FloorGenerator(this.rng);
    this.encounterGenerator = new EncounterGenerator(this.rng);
    this.shop = new Shop(this.rng, this.eventBus);
    this.armyId = data.armyId;
    this.difficulty = data.difficulty || "normal";
    this.armyAbility = data.armyId === "draft" ? null : ARMIES[data.armyId]?.ability || null;
    this.roster = data.roster.map((p) => Piece.deserialize(p));
    this.gold = data.gold;
    this.currentFloor = data.currentFloor;
    this.relicSystem.deserialize(data.relics);
    this.prisoners = data.prisoners || {};
    this.stats = data.stats;
    this.isActive = data.isActive;
    this.map = this.floorGenerator.generateMap(TOTAL_FLOORS);
  }
};

// src/data/BossData.js
var BOSSES = {
  floor5: {
    id: "floor5",
    name: "The Dark Bishop",
    title: "Guardian of the Midgame",
    description: "A powerful bishop commands an army of zealots. The board shifts as the battle unfolds.",
    boardSize: { cols: 8, rows: 8 },
    phases: [
      {
        name: "Phase 1: The Congregation",
        pieces: [
          { type: PIECE_TYPES.KING, col: 4, row: 0 },
          { type: PIECE_TYPES.BISHOP, col: 2, row: 0 },
          { type: PIECE_TYPES.BISHOP, col: 5, row: 0 },
          { type: PIECE_TYPES.PAWN, col: 3, row: 1 },
          { type: PIECE_TYPES.PAWN, col: 5, row: 1 }
        ],
        terrain: [
          { col: 0, row: 3, terrain: TERRAIN_TYPES.VOID },
          { col: 7, row: 3, terrain: TERRAIN_TYPES.VOID },
          { col: 3, row: 3, terrain: TERRAIN_TYPES.ALTAR },
          { col: 4, row: 3, terrain: TERRAIN_TYPES.ALTAR }
        ]
      },
      {
        name: "Phase 2: Divine Wrath",
        addPieces: [
          { type: PIECE_TYPES.BISHOP, col: 0, row: 0 },
          { type: PIECE_TYPES.KNIGHT, col: 7, row: 0 }
        ],
        addTerrain: [
          { col: 1, row: 4, terrain: TERRAIN_TYPES.BRAMBLE },
          { col: 6, row: 4, terrain: TERRAIN_TYPES.BRAMBLE }
        ],
        triggerCondition: "piecesRemaining",
        triggerValue: 3
      }
    ],
    goldReward: 40,
    difficulty: 3
  },
  floor10: {
    id: "floor10",
    name: "The Ivory King",
    title: "Ruler of the Board",
    description: "The final challenge. A complete chess army stands against you, led by a king who refuses to fall.",
    boardSize: { cols: 10, rows: 10 },
    phases: [
      {
        name: "Phase 1: Royal Guard",
        pieces: [
          { type: PIECE_TYPES.KING, col: 5, row: 0 },
          { type: PIECE_TYPES.QUEEN, col: 4, row: 0 },
          { type: PIECE_TYPES.ROOK, col: 1, row: 0 },
          { type: PIECE_TYPES.BISHOP, col: 3, row: 0 },
          { type: PIECE_TYPES.BISHOP, col: 6, row: 0 },
          { type: PIECE_TYPES.KNIGHT, col: 2, row: 0 },
          { type: PIECE_TYPES.KNIGHT, col: 7, row: 0 },
          { type: PIECE_TYPES.PAWN, col: 3, row: 1 },
          { type: PIECE_TYPES.PAWN, col: 5, row: 1 },
          { type: PIECE_TYPES.PAWN, col: 7, row: 1 }
        ],
        terrain: [
          { col: 0, row: 4, terrain: TERRAIN_TYPES.VOID },
          { col: 9, row: 4, terrain: TERRAIN_TYPES.VOID },
          { col: 0, row: 5, terrain: TERRAIN_TYPES.VOID },
          { col: 9, row: 5, terrain: TERRAIN_TYPES.VOID },
          { col: 4, row: 4, terrain: TERRAIN_TYPES.FORTRESS },
          { col: 5, row: 4, terrain: TERRAIN_TYPES.FORTRESS }
        ]
      },
      {
        name: "Phase 2: Reinforcements",
        addPieces: [
          { type: PIECE_TYPES.ROOK, col: 8, row: 0 },
          { type: PIECE_TYPES.PAWN, col: 0, row: 1 }
        ],
        addTerrain: [
          { col: 2, row: 5, terrain: TERRAIN_TYPES.ICE },
          { col: 7, row: 5, terrain: TERRAIN_TYPES.ICE }
        ],
        removeTerrain: [
          { col: 4, row: 4 },
          { col: 5, row: 4 }
        ],
        triggerCondition: "piecesRemaining",
        triggerValue: 8
      },
      {
        name: "Phase 3: Last Stand",
        addPieces: [
          { type: PIECE_TYPES.KNIGHT, col: 4, row: 1 }
        ],
        addTerrain: [
          { col: 3, row: 3, terrain: TERRAIN_TYPES.BRAMBLE },
          { col: 6, row: 3, terrain: TERRAIN_TYPES.BRAMBLE }
        ],
        triggerCondition: "piecesRemaining",
        triggerValue: 4
      }
    ],
    goldReward: 60,
    difficulty: 5
  }
};
function getBossForFloor(floor) {
  if (floor === 5) return BOSSES.floor5;
  if (floor === 10) return BOSSES.floor10;
  return null;
}

// src/data/EventData.js
var EVENTS = {
  mysteriousAltar: {
    id: "mysteriousAltar",
    title: "Mysterious Altar",
    description: 'You find a glowing altar in the ruins. An ancient voice whispers: "Sacrifice to gain power."',
    choices: [
      {
        text: "Sacrifice a pawn for a random relic",
        effect: "sacrificePawnForRelic",
        requirement: { minPawns: 1 }
      },
      {
        text: "Leave it alone",
        effect: "none"
      }
    ]
  },
  wanderingKnight: {
    id: "wanderingKnight",
    title: "Wandering Knight",
    description: "A lone knight offers to join your cause \u2014 for a price.",
    choices: [
      {
        text: "Pay 15 gold to recruit the knight",
        effect: "buyKnight",
        requirement: { minGold: 15 }
      },
      {
        text: "Challenge the knight \u2014 win and they join for free",
        effect: "knightChallenge"
      },
      {
        text: "Decline",
        effect: "none"
      }
    ]
  },
  forgottenArmory: {
    id: "forgottenArmory",
    title: "Forgotten Armory",
    description: "Old weapon racks line the walls. Some still hold equipment in usable condition.",
    choices: [
      {
        text: "Take a random modifier for a piece",
        effect: "randomModifier"
      },
      {
        text: "Search carefully for gold (10-20)",
        effect: "findGold"
      }
    ]
  },
  cursedMirror: {
    id: "cursedMirror",
    title: "Cursed Mirror",
    description: "A dark mirror shows a twisted reflection. Power radiates from it, but at what cost?",
    choices: [
      {
        text: "Touch the mirror \u2014 upgrade a random piece but lose 1 pawn",
        effect: "mirrorUpgrade",
        requirement: { minPawns: 1 }
      },
      {
        text: "Smash the mirror \u2014 gain 12 gold",
        effect: "smashMirrorGold"
      },
      {
        text: "Walk away",
        effect: "none"
      }
    ]
  },
  campfire: {
    id: "campfire",
    title: "Campfire Rest",
    description: "Your army finds a sheltered spot to rest. The fire crackles warmly.",
    choices: [
      {
        text: "Rest \u2014 recruit a free pawn",
        effect: "recruitPawn"
      },
      {
        text: "Train \u2014 give a random piece a modifier",
        effect: "trainModifier"
      }
    ]
  },
  gamblingDen: {
    id: "gamblingDen",
    title: "Gambling Den",
    description: 'Shady figures offer a game of chance. "Double or nothing," they say.',
    choices: [
      {
        text: "Gamble 10 gold \u2014 50% chance to double it",
        effect: "gamble",
        requirement: { minGold: 10 }
      },
      {
        text: "Rob them \u2014 free relic but take a battle",
        effect: "robGamblers"
      },
      {
        text: "Move along",
        effect: "none"
      }
    ]
  },
  blessedFountain: {
    id: "blessedFountain",
    title: "Blessed Fountain",
    description: "Crystal-clear water flows from an ancient fountain, shimmering with magical energy.",
    choices: [
      {
        text: "Drink \u2014 promote a random pawn immediately",
        effect: "promotePawn",
        requirement: { minPawns: 1 }
      },
      {
        text: "Fill a flask \u2014 gain the next battle with a free turn",
        effect: "grantFreeTurn"
      }
    ]
  }
};
function getRandomEvent(rng = Math) {
  const all = Object.values(EVENTS);
  return all[Math.floor(rng.random() * all.length)];
}

// src/simulation/RunSimulator.js
function meetsRequirement(choice, runManager) {
  if (!choice.requirement) return true;
  if (choice.requirement.minGold && runManager.gold < choice.requirement.minGold) return false;
  if (choice.requirement.minPawns) {
    const pawnCount = runManager.roster.filter((p) => p.type === PIECE_TYPES.PAWN).length;
    if (pawnCount < choice.requirement.minPawns) return false;
  }
  return true;
}
function materialScore(board, team) {
  return board.getTeamPieces(team).reduce((sum, p) => sum + (PIECE_VALUES[p.type] || 0), 0);
}
function draftPieces(budget, strategy) {
  const pieces = [];
  const costs = DRAFT_COSTS;
  const maxCounts = { queen: 1, rook: 2, bishop: 2, knight: 2, pawn: 8 };
  if (strategy === "aggressive") {
    let remaining = budget;
    const order = [["queen", 1], ["rook", 1], ["bishop", 1], ["knight", 1], ["pawn", 8]];
    for (const [type, max] of order) {
      let count = 0;
      while (remaining >= costs[type] && count < max) {
        pieces.push(type);
        remaining -= costs[type];
        count++;
      }
    }
    while (remaining >= costs.pawn) {
      pieces.push("pawn");
      remaining -= costs.pawn;
    }
  } else if (strategy === "cautious") {
    let remaining = budget;
    const order = [["pawn", 6], ["knight", 2], ["bishop", 2], ["rook", 1]];
    for (const [type, max] of order) {
      let count = 0;
      while (remaining >= costs[type] && count < max) {
        pieces.push(type);
        remaining -= costs[type];
        count++;
      }
    }
  } else if (strategy === "pawnFarmer") {
    let remaining = budget;
    if (remaining >= costs.knight) {
      pieces.push("knight");
      remaining -= costs.knight;
    }
    while (remaining >= costs.pawn) {
      pieces.push("pawn");
      remaining -= costs.pawn;
    }
  } else {
    let remaining = budget;
    if (remaining >= costs.rook) {
      pieces.push("rook");
      remaining -= costs.rook;
    }
    for (let i = 0; i < 2 && remaining >= costs.knight; i++) {
      pieces.push("knight");
      remaining -= costs.knight;
    }
    if (remaining >= costs.bishop) {
      pieces.push("bishop");
      remaining -= costs.bishop;
    }
    while (remaining >= costs.pawn) {
      pieces.push("pawn");
      remaining -= costs.pawn;
    }
  }
  return pieces;
}
function pickUpgrade(choices, roster, strategy) {
  if (choices.length === 0) return null;
  const piece = roster.length > 0 ? roster[0] : null;
  if (!piece) return null;
  if (strategy === "aggressive") {
    const pref = choices.find((c) => c.category === "capture" || c.category === "risk");
    return pref || choices[0];
  }
  if (strategy === "cautious") {
    const pref = choices.find((c) => c.category === "defense");
    return pref || choices[0];
  }
  const rarityOrder = { legendary: 0, rare: 1, uncommon: 2, common: 3 };
  const sorted = [...choices].sort((a, b) => (rarityOrder[a.rarity] || 3) - (rarityOrder[b.rarity] || 3));
  return sorted[0];
}
function applyUpgrade(mod, roster, rng) {
  if (!mod || roster.length === 0) return;
  const sorted = [...roster].sort((a, b) => a.modifiers.length - b.modifiers.length);
  const target = sorted.find((p) => !p.hasModifier(mod.id)) || sorted[0];
  if (target && !target.hasModifier(mod.id)) {
    target.addModifier({ ...mod });
  }
}
var STRATEGIES = {
  aggressive: {
    name: "Aggressive",
    playerAIDifficulty: 4,
    pathPriority: ["elite", "battle", "event", "shop", "rest"],
    draftStyle: "aggressive",
    pickPromotion(roster) {
      return PIECE_TYPES.QUEEN;
    },
    pickShopPurchases(items, gold, roster, relics) {
      const purchases = [];
      const sorted = [...items].sort((a, b) => {
        if (a.category === "relic" && b.category !== "relic") return -1;
        if (b.category === "relic" && a.category !== "relic") return 1;
        const valueA = a.category === "piece" ? PIECE_VALUES[a.type] || 1 : 5;
        const valueB = b.category === "piece" ? PIECE_VALUES[b.type] || 1 : 5;
        return valueB - valueA;
      });
      let remaining = gold;
      for (const item of sorted) {
        if (item.price <= remaining) {
          purchases.push(item);
          remaining -= item.price;
        }
      }
      return purchases;
    },
    pickEventChoice(event, rm) {
      const risky = ["knightChallenge", "sacrificePawnForRelic", "gamble", "mirrorUpgrade", "robGamblers"];
      for (const choice of event.choices) {
        if (risky.includes(choice.effect) && meetsRequirement(choice, rm)) return choice;
      }
      for (const choice of event.choices) {
        if (choice.effect !== "none" && meetsRequirement(choice, rm)) return choice;
      }
      return event.choices[event.choices.length - 1];
    },
    handlePrisoners(rm) {
      for (const type of Object.keys(rm.prisoners)) {
        while ((rm.prisoners[type] || 0) >= 3 && rm.roster.length < ROSTER_LIMIT) {
          rm.convertPrisoners(type);
        }
      }
    }
  },
  cautious: {
    name: "Cautious",
    playerAIDifficulty: 4,
    pathPriority: ["rest", "shop", "event", "battle"],
    draftStyle: "cautious",
    pickPromotion(roster) {
      return PIECE_TYPES.QUEEN;
    },
    pickShopPurchases(items, gold, roster, relics) {
      const purchases = [];
      const sorted = [...items].sort((a, b) => a.price - b.price);
      let remaining = gold;
      for (const item of sorted) {
        if (item.price <= remaining && item.price <= 15) {
          purchases.push(item);
          remaining -= item.price;
        }
      }
      return purchases;
    },
    pickEventChoice(event, rm) {
      const safe = ["findGold", "recruitPawn", "smashMirrorGold", "grantFreeTurn"];
      for (const choice of event.choices) {
        if (safe.includes(choice.effect) && meetsRequirement(choice, rm)) return choice;
      }
      return event.choices[event.choices.length - 1];
    },
    handlePrisoners(rm) {
      for (const type of Object.keys(rm.prisoners)) {
        while ((rm.prisoners[type] || 0) > 0) {
          rm.releasePrisoner(type);
        }
      }
    }
  },
  pawnFarmer: {
    name: "Pawn Farmer",
    playerAIDifficulty: 4,
    pathPriority: ["battle", "event", "shop", "rest"],
    draftStyle: "pawnFarmer",
    pickPromotion(roster) {
      const counts = { knight: 0, bishop: 0, rook: 0 };
      for (const p of roster) {
        if (counts.hasOwnProperty(p.type)) counts[p.type]++;
      }
      let min = Infinity, pick = PIECE_TYPES.KNIGHT;
      for (const [type, count] of Object.entries(counts)) {
        if (count < min) {
          min = count;
          pick = type;
        }
      }
      return pick;
    },
    pickShopPurchases(items, gold, roster, relics) {
      const purchases = [];
      let remaining = gold;
      const sorted = [...items].sort((a, b) => {
        if (a.category === "relic" && a.id === "earlyPromotion") return -1;
        if (b.category === "relic" && b.id === "earlyPromotion") return 1;
        if (a.category === "piece" && a.type === PIECE_TYPES.PAWN) return -1;
        if (b.category === "piece" && b.type === PIECE_TYPES.PAWN) return 1;
        return a.price - b.price;
      });
      for (const item of sorted) {
        if (item.price <= remaining) {
          purchases.push(item);
          remaining -= item.price;
        }
      }
      return purchases;
    },
    pickEventChoice(event, rm) {
      const preferred = ["promotePawn", "recruitPawn", "trainModifier", "randomModifier"];
      for (const choice of event.choices) {
        if (preferred.includes(choice.effect) && meetsRequirement(choice, rm)) return choice;
      }
      for (const choice of event.choices) {
        if (choice.effect !== "none" && meetsRequirement(choice, rm)) return choice;
      }
      return event.choices[event.choices.length - 1];
    },
    handlePrisoners(rm) {
      for (const type of Object.keys(rm.prisoners)) {
        while ((rm.prisoners[type] || 0) >= 3 && rm.roster.length < ROSTER_LIMIT) {
          rm.convertPrisoners(type);
        }
      }
    }
  },
  balanced: {
    name: "Balanced",
    playerAIDifficulty: 4,
    pathPriority: ["battle", "shop", "event", "rest"],
    draftStyle: "balanced",
    pickPromotion(roster) {
      return PIECE_TYPES.QUEEN;
    },
    pickShopPurchases(items, gold, roster, relics) {
      const purchases = [];
      let remaining = gold;
      const sorted = [...items].sort((a, b) => {
        if (a.category === "relic" && b.category !== "relic") return -1;
        if (b.category === "relic" && a.category !== "relic") return 1;
        return a.price - b.price;
      });
      for (const item of sorted) {
        if (item.price <= remaining) {
          if (item.category === "piece" && roster.length >= 14) continue;
          purchases.push(item);
          remaining -= item.price;
        }
      }
      return purchases;
    },
    pickEventChoice(event, rm) {
      const strong = rm.roster.length >= 12;
      if (strong) {
        const moderate = ["knightChallenge", "randomModifier", "trainModifier", "mirrorUpgrade", "gamble"];
        for (const choice of event.choices) {
          if (moderate.includes(choice.effect) && meetsRequirement(choice, rm)) return choice;
        }
      }
      const safe = ["findGold", "recruitPawn", "smashMirrorGold", "grantFreeTurn", "promotePawn"];
      for (const choice of event.choices) {
        if (safe.includes(choice.effect) && meetsRequirement(choice, rm)) return choice;
      }
      for (const choice of event.choices) {
        if (choice.effect !== "none" && meetsRequirement(choice, rm)) return choice;
      }
      return event.choices[event.choices.length - 1];
    },
    handlePrisoners(rm) {
      for (const type of Object.keys(rm.prisoners)) {
        if ((rm.prisoners[type] || 0) >= 3 && rm.roster.length < ROSTER_LIMIT) {
          rm.convertPrisoners(type);
        } else if (rm.gold < 10) {
          while ((rm.prisoners[type] || 0) > 0) {
            rm.releasePrisoner(type);
          }
        }
      }
    }
  }
};
function getPathPriority(strategy, roster) {
  if (strategy === STRATEGIES.balanced) {
    if (roster.length >= 12) return ["battle", "event", "shop", "rest"];
    return ["rest", "shop", "battle", "event"];
  }
  return strategy.pathPriority;
}
var HeadlessCombat = class {
  constructor(eventBus) {
    this.eventBus = eventBus;
  }
  run(boardSetup, options, strategy, bossData = null) {
    const { cols, rows, playerPieces, enemyPieces, terrain } = boardSetup;
    const board = new Board(cols, rows);
    if (terrain) {
      for (const t of terrain) {
        board.setTerrain(t.col, t.row, t.terrain);
      }
    }
    if (bossData && bossData.phases[0].terrain) {
      for (const t of bossData.phases[0].terrain) {
        board.setTerrain(t.col, t.row, t.terrain);
      }
    }
    if (bossData) {
      for (const pd of bossData.phases[0].pieces) {
        const piece = new Piece(pd.type, TEAMS.ENEMY, pd.col, pd.row);
        board.placePiece(piece, pd.col, pd.row);
      }
    } else {
      for (const pd of enemyPieces) {
        const piece = new Piece(pd.type, TEAMS.ENEMY, pd.col, pd.row);
        board.placePiece(piece, pd.col, pd.row);
      }
    }
    for (const pp of playerPieces) {
      board.placePiece(pp.piece, pp.col, pp.row);
    }
    const combat = new CombatManager(this.eventBus);
    combat.initBattle(board, {
      difficulty: options.difficulty || 2,
      relics: options.relics || [],
      armyAbility: options.armyAbility || null
    });
    const playerAI = new AIController(board, this.eventBus);
    playerAI.setDifficulty(strategy.playerAIDifficulty);
    playerAI.modifierSystem = combat.modifierSystem;
    playerAI.relics = options.relics || [];
    playerAI.turnManager = combat.turnManager;
    let bossAI = null;
    if (bossData) {
      bossAI = new BossAI(board, this.eventBus, bossData);
    }
    const MAX_TURNS = 200;
    let maxTurnsReached = false;
    while (!combat.gameOver) {
      if (combat.turnManager.turnNumber >= MAX_TURNS) {
        const playerMat = materialScore(board, TEAMS.PLAYER);
        const enemyMat = materialScore(board, TEAMS.ENEMY);
        combat.endBattle(playerMat > enemyMat ? TEAMS.PLAYER : TEAMS.ENEMY);
        maxTurnsReached = true;
        break;
      }
      if (bossAI && !combat.turnManager.isPlayerTurn) {
        bossAI.checkPhaseTransition();
      }
      let moveResult;
      if (combat.turnManager.isPlayerTurn) {
        const move = playerAI.getBestMove(TEAMS.PLAYER);
        if (!move) {
          combat.endTurn();
          continue;
        }
        moveResult = combat.executeMove(move.piece, move.move.col, move.move.row, move.move);
      } else {
        let move;
        if (bossAI) {
          move = bossAI.getBestMove();
        } else {
          move = combat.getAIMove();
        }
        if (!move) {
          combat.endTurn();
          continue;
        }
        moveResult = combat.executeMove(move.piece, move.move.col, move.move.row, move.move);
      }
      if (!moveResult || !moveResult.success) {
        combat.endTurn();
        continue;
      }
      if (combat.gameOver) break;
      if (moveResult.needsPromotion) {
        if (moveResult.piece.team === TEAMS.PLAYER) {
          combat.promotePiece(moveResult.piece, strategy.pickPromotion([]));
        } else {
          combat.promotePiece(moveResult.piece, PIECE_TYPES.QUEEN);
        }
      }
      if (combat.gameOver) break;
      combat.endTurn();
    }
    return {
      outcome: combat.winner === TEAMS.PLAYER ? "win" : "loss",
      turns: combat.turnManager.turnNumber,
      capturedByPlayer: combat.capturedByPlayer,
      capturedByEnemy: combat.capturedByEnemy,
      survivingPlayerPieces: board.getTeamPieces(TEAMS.PLAYER),
      goldEarned: combat.goldEarned,
      maxTurnsReached
    };
  }
};
function resolveEventChoice(choice, rm) {
  if (!meetsRequirement(choice, rm)) return;
  const rng = rm.rng;
  switch (choice.effect) {
    case "none":
      break;
    case "sacrificePawnForRelic": {
      const pawns = rm.roster.filter((p) => p.type === PIECE_TYPES.PAWN);
      if (pawns.length > 0) {
        rm.roster.splice(rm.roster.indexOf(pawns[0]), 1);
        const relic = rm.relicSystem.getRandomReward(rng);
        if (relic) rm.addRelic(relic);
      }
      break;
    }
    case "buyKnight":
      rm.gold -= 15;
      rm.recruitPiece(PIECE_TYPES.KNIGHT);
      break;
    case "knightChallenge":
      if (rng.random() < 0.6) {
        rm.recruitPiece(PIECE_TYPES.KNIGHT);
      } else {
        const pawns = rm.roster.filter((p) => p.type === PIECE_TYPES.PAWN);
        if (pawns.length > 0) {
          rm.roster.splice(rm.roster.indexOf(pawns[0]), 1);
        }
      }
      break;
    case "randomModifier":
    case "trainModifier": {
      const mod = getRandomModifier(rng);
      if (mod && rm.roster.length > 0) {
        const valid = rm.roster.filter((p) => !p.hasModifier(mod.id));
        if (valid.length > 0) {
          rng.randomChoice(valid).addModifier({ ...mod });
        }
      }
      break;
    }
    case "findGold":
      rm.gold += rng.randomInt(10, 20);
      break;
    case "mirrorUpgrade": {
      const pawns = rm.roster.filter((p) => p.type === PIECE_TYPES.PAWN);
      if (pawns.length > 0) {
        rm.roster.splice(rm.roster.indexOf(pawns[0]), 1);
        const types = [PIECE_TYPES.KNIGHT, PIECE_TYPES.BISHOP, PIECE_TYPES.ROOK];
        const upgradeType = rng.randomChoice(types);
        const mod = getRandomModifier(rng);
        const upgradePiece = rm.recruitPiece(upgradeType);
        if (upgradePiece && mod) upgradePiece.addModifier({ ...mod });
      }
      break;
    }
    case "smashMirrorGold":
      rm.gold += 12;
      break;
    case "recruitPawn":
      rm.recruitPiece(PIECE_TYPES.PAWN);
      break;
    case "gamble":
      rm.gold -= 10;
      if (rng.random() < 0.5) rm.gold += 20;
      break;
    case "robGamblers": {
      const relic = rm.relicSystem.getRandomReward(rng);
      if (relic) rm.addRelic(relic);
      break;
    }
    case "promotePawn": {
      const pawns = rm.roster.filter((p) => p.type === PIECE_TYPES.PAWN);
      if (pawns.length > 0) {
        const types = [PIECE_TYPES.KNIGHT, PIECE_TYPES.BISHOP, PIECE_TYPES.ROOK];
        pawns[0].promote(rng.randomChoice(types));
      }
      break;
    }
    case "grantFreeTurn":
      rm.addRelic({ id: "freeMove", name: "Initiative Crown", description: "Start each battle with a free move" });
      break;
  }
}
var HeadlessRun = class {
  constructor(strategy, seed) {
    this.strategy = strategy;
    this.seed = seed;
    this.eventBus = new EventBus();
    this.rm = new RunManager(this.eventBus);
    this.combat = new HeadlessCombat(this.eventBus);
    this.floorStats = [];
    this.battleResults = [];
    this.deathFloor = null;
    this.victory = false;
  }
  run() {
    const budget = DRAFT_POINTS.normal;
    const pieces = draftPieces(budget, this.strategy.draftStyle);
    this.rm.startRunFromDraft("normal", pieces, this.seed);
    this.simulateUpgrade();
    for (let floor = 1; floor <= TOTAL_FLOORS; floor++) {
      const floorStart = {
        floor,
        rosterStart: this.rm.roster.length,
        goldStart: this.rm.gold,
        rosterEnd: 0,
        goldEnd: 0,
        combatResults: [],
        survived: false
      };
      this.strategy.handlePrisoners(this.rm);
      const floorData = this.rm.getCurrentFloorData();
      if (!floorData) break;
      const visited = /* @__PURE__ */ new Set();
      this.navigateFloor(floorData, visited);
      if (!this.rm.isActive) {
        floorStart.rosterEnd = this.rm.roster.length;
        floorStart.goldEnd = this.rm.gold;
        floorStart.survived = false;
        this.floorStats.push(floorStart);
        this.deathFloor = floor;
        return;
      }
      floorStart.rosterEnd = this.rm.roster.length;
      floorStart.goldEnd = this.rm.gold;
      floorStart.survived = true;
      this.floorStats.push(floorStart);
      if (!this.rm.advanceFloor()) {
        this.victory = true;
        return;
      }
    }
  }
  simulateUpgrade() {
    const rosterTypes = this.rm.roster.map((p) => p.type);
    const choices = getUpgradePackChoices(this.rm.rng, [], 3, rosterTypes);
    const mod = pickUpgrade(choices, this.rm.roster, this.strategy.draftStyle);
    applyUpgrade(mod, this.rm.roster, this.rm.rng);
  }
  navigateFloor(floorData, visited) {
    const nodes = floorData.nodes;
    if (nodes.length === 0) return;
    const layers = {};
    for (const node of nodes) {
      if (!layers[node.layer]) layers[node.layer] = [];
      layers[node.layer].push(node);
    }
    const layerKeys = Object.keys(layers).sort((a, b) => a - b);
    let currentNodeId = null;
    for (const layerKey of layerKeys) {
      const layerNodes = layers[layerKey];
      let reachable;
      if (currentNodeId === null) {
        reachable = layerNodes;
      } else {
        const currentNode = nodes.find((n) => n.id === currentNodeId);
        reachable = layerNodes.filter((n) => currentNode.connections.includes(n.id));
        if (reachable.length === 0) reachable = layerNodes;
      }
      const priority = getPathPriority(this.strategy, this.rm.roster);
      reachable.sort((a, b) => {
        const aIdx = priority.indexOf(a.type);
        const bIdx = priority.indexOf(b.type);
        return (aIdx === -1 ? 99 : aIdx) - (bIdx === -1 ? 99 : bIdx);
      });
      let chosen = reachable[0];
      if ((this.strategy === STRATEGIES.cautious || this.strategy === STRATEGIES.pawnFarmer) && chosen.type === "elite") {
        const nonElite = reachable.find((n) => n.type !== "elite");
        if (nonElite) chosen = nonElite;
      }
      currentNodeId = chosen.id;
      this.processNode(chosen);
      if (!this.rm.isActive) return;
    }
  }
  processNode(node) {
    switch (node.type) {
      case "battle":
      case "elite":
        this.processBattle(node.type);
        break;
      case "boss":
        this.processBoss();
        break;
      case "shop":
        this.processShop();
        break;
      case "event":
        this.processEvent();
        break;
      case "rest":
        this.processRest();
        break;
    }
  }
  processBattle(nodeType) {
    const encounter = this.rm.getEncounter(nodeType);
    if (!encounter) return;
    const setup = this.rm.prepareCombat(encounter);
    const result = this.combat.run(setup, {
      difficulty: setup.difficulty,
      relics: setup.relics,
      armyAbility: setup.armyAbility
    }, this.strategy);
    if (result.outcome === "win") {
      const rewards = this.rm.onBattleWon({
        goldEarned: result.goldEarned,
        capturedByEnemy: result.capturedByEnemy,
        capturedByPlayer: result.capturedByPlayer,
        survivingPlayerPieces: result.survivingPlayerPieces,
        isElite: encounter.isElite
      });
      this.applyRewards(rewards);
      this.simulateUpgrade();
    } else {
      this.rm.onBattleLost();
    }
    this.battleResults.push({
      floor: this.rm.currentFloor,
      type: nodeType,
      outcome: result.outcome,
      turns: result.turns,
      piecesLost: result.capturedByEnemy.length,
      maxTurnsReached: result.maxTurnsReached
    });
  }
  processBoss() {
    const bossData = getBossForFloor(this.rm.currentFloor);
    if (!bossData) return;
    const { cols, rows } = bossData.boardSize;
    const playerPlacement = this.rm.encounterGenerator.placePlayerPieces(
      this.rm.roster,
      cols,
      rows,
      bossData.phases[0].pieces.length
    );
    const result = this.combat.run({
      cols,
      rows,
      playerPieces: playerPlacement,
      enemyPieces: [],
      terrain: []
    }, {
      difficulty: bossData.difficulty,
      relics: this.rm.relicSystem.ownedRelics,
      armyAbility: this.rm.armyAbility
    }, this.strategy, bossData);
    if (result.outcome === "win") {
      const rewards = this.rm.onBattleWon({
        goldEarned: result.goldEarned,
        capturedByEnemy: result.capturedByEnemy,
        capturedByPlayer: result.capturedByPlayer,
        survivingPlayerPieces: result.survivingPlayerPieces,
        isElite: false
      });
      this.applyRewards(rewards);
      this.simulateUpgrade();
    } else {
      this.rm.onBattleLost();
    }
    this.battleResults.push({
      floor: this.rm.currentFloor,
      type: "boss",
      outcome: result.outcome,
      turns: result.turns,
      piecesLost: result.capturedByEnemy.length,
      maxTurnsReached: result.maxTurnsReached
    });
  }
  applyRewards(rewards) {
    if (!rewards) return;
    if (rewards.gold) {
      this.rm.gold += rewards.gold;
    }
    if (rewards.recruitOptions) {
      for (const opt of rewards.recruitOptions) {
        if (opt.cost === 0) {
          this.rm.recruitPiece(opt.type);
        }
      }
    }
    if (rewards.relic) {
      this.rm.addRelic(rewards.relic);
    }
  }
  processShop() {
    const items = this.rm.generateShop();
    const purchases = this.strategy.pickShopPurchases(
      items,
      this.rm.gold,
      this.rm.roster,
      this.rm.relicSystem.ownedRelics
    );
    for (const item of purchases) {
      this.rm.purchaseShopItem(item);
    }
  }
  processEvent() {
    const event = getRandomEvent(this.rm.rng);
    const choice = this.strategy.pickEventChoice(event, this.rm);
    resolveEventChoice(choice, this.rm);
  }
  processRest() {
    this.rm.recruitPiece(PIECE_TYPES.PAWN);
    if (this.rm.relicSystem.hasRelic("healingRest") || this.rm.rng.random() < 0.3) {
      this.rm.recruitPiece(PIECE_TYPES.KNIGHT);
    }
  }
};
var SimulationRunner = class {
  constructor(runsPerStrategy2, baseSeed2) {
    this.runsPerStrategy = runsPerStrategy2;
    this.baseSeed = baseSeed2;
    this.results = {};
  }
  run() {
    const strategyNames = Object.keys(STRATEGIES);
    const total = strategyNames.length * this.runsPerStrategy;
    let completed = 0;
    for (const key of strategyNames) {
      const strategy = STRATEGIES[key];
      const stratResults = {
        wins: 0,
        losses: 0,
        deathFloors: new Array(TOTAL_FLOORS + 1).fill(0),
        totalBattles: 0,
        totalPiecesLost: 0,
        totalMaxTurns: 0,
        avgDeathFloor: 0,
        floorData: [],
        runs: []
      };
      for (let f = 1; f <= TOTAL_FLOORS; f++) {
        stratResults.floorData.push({
          floor: f,
          rosterSum: 0,
          goldSum: 0,
          count: 0
        });
      }
      for (let i = 0; i < this.runsPerStrategy; i++) {
        const seed = this.baseSeed + i * 1e3 + Object.keys(STRATEGIES).indexOf(key) * 1e5;
        const run = new HeadlessRun(strategy, seed);
        try {
          run.run();
        } catch (e) {
          completed++;
          continue;
        }
        if (run.victory) {
          stratResults.wins++;
        } else {
          stratResults.losses++;
          if (run.deathFloor) stratResults.deathFloors[run.deathFloor]++;
        }
        for (const fs of run.floorStats) {
          const fd = stratResults.floorData[fs.floor - 1];
          fd.rosterSum += fs.rosterStart;
          fd.goldSum += fs.goldStart;
          fd.count++;
        }
        for (const br of run.battleResults) {
          stratResults.totalBattles++;
          stratResults.totalPiecesLost += br.piecesLost;
          if (br.maxTurnsReached) stratResults.totalMaxTurns++;
        }
        stratResults.runs.push({
          victory: run.victory,
          deathFloor: run.deathFloor,
          battlesWon: run.battleResults.filter((b) => b.outcome === "win").length
        });
        completed++;
        if (completed % 50 === 0 || completed === total) {
          process.stderr.write(`\r  Progress: ${completed}/${total} runs (${Math.round(completed / total * 100)}%)`);
        }
      }
      const lostRuns = stratResults.runs.filter((r) => !r.victory);
      stratResults.avgDeathFloor = lostRuns.length > 0 ? lostRuns.reduce((s, r) => s + (r.deathFloor || 0), 0) / lostRuns.length : 0;
      this.results[key] = stratResults;
    }
    process.stderr.write("\n");
  }
  printResults() {
    const N = this.runsPerStrategy;
    const keys = Object.keys(STRATEGIES);
    console.log("\n" + "=".repeat(95));
    console.log("  OVERALL WIN RATES");
    console.log("=".repeat(95));
    console.log(
      pad("Strategy", 16) + pad("Wins", 8) + pad("Losses", 8) + pad("Win%", 8) + pad("AvgFloor", 10) + pad("AvgBattles", 12) + pad("AvgLost", 10) + pad("MaxTurns", 10)
    );
    console.log("-".repeat(95));
    for (const key of keys) {
      const r = this.results[key];
      const totalRuns = r.wins + r.losses;
      const winPct = totalRuns > 0 ? (r.wins / totalRuns * 100).toFixed(1) : "0.0";
      const avgBattles = totalRuns > 0 ? (r.totalBattles / totalRuns).toFixed(1) : "0";
      const avgLost = totalRuns > 0 ? (r.totalPiecesLost / totalRuns).toFixed(1) : "0";
      const avgFloor = r.avgDeathFloor > 0 ? r.avgDeathFloor.toFixed(1) : r.wins > 0 ? "10+" : "N/A";
      console.log(
        pad(STRATEGIES[key].name, 16) + pad(String(r.wins), 8) + pad(String(r.losses), 8) + pad(winPct + "%", 8) + pad(String(avgFloor), 10) + pad(avgBattles, 12) + pad(avgLost, 10) + pad(String(r.totalMaxTurns), 10)
      );
    }
    console.log("\n" + "=".repeat(75));
    console.log("  DEATH FLOOR DISTRIBUTION");
    console.log("=".repeat(75));
    let header = pad("Floor", 8);
    for (const key of keys) {
      header += pad(STRATEGIES[key].name, 17);
    }
    console.log(header);
    console.log("-".repeat(75));
    for (let f = 1; f <= TOTAL_FLOORS; f++) {
      const isBoss = BOSS_FLOORS.includes(f);
      let row = pad(`F${f}${isBoss ? "*" : " "}`, 8);
      for (const key of keys) {
        const r = this.results[key];
        const deaths = r.deathFloors[f];
        const totalRuns = r.wins + r.losses;
        const pct = totalRuns > 0 ? (deaths / totalRuns * 100).toFixed(1) : "0.0";
        row += pad(`${deaths} (${pct}%)`, 17);
      }
      console.log(row);
    }
    console.log("  (* = boss floor)");
    console.log("\n" + "=".repeat(85));
    console.log("  PER-FLOOR AVERAGES (Roster / Gold)");
    console.log("=".repeat(85));
    header = pad("Floor", 8);
    for (const key of keys) {
      header += pad(STRATEGIES[key].name, 20);
    }
    console.log(header);
    console.log("-".repeat(85));
    for (let f = 1; f <= TOTAL_FLOORS; f++) {
      const isBoss = BOSS_FLOORS.includes(f);
      let row = pad(`F${f}${isBoss ? "*" : " "}`, 8);
      for (const key of keys) {
        const fd = this.results[key].floorData[f - 1];
        if (fd.count > 0) {
          const avgRoster = (fd.rosterSum / fd.count).toFixed(1);
          const avgGold = (fd.goldSum / fd.count).toFixed(0);
          const totalRuns = this.results[key].wins + this.results[key].losses;
          row += pad(`${avgRoster}p / ${avgGold}g (${fd.count}/${totalRuns})`, 20);
        } else {
          row += pad("\u2014", 20);
        }
      }
      console.log(row);
    }
    console.log("\n" + "=".repeat(85));
  }
};
function pad(str, width) {
  str = String(str);
  return str + " ".repeat(Math.max(0, width - str.length));
}
var args = process.argv.slice(2);
var runsPerStrategy = parseInt(args[0], 10) || 50;
var baseSeed = parseInt(args[1], 10) || 42;
console.log(`
Blanca Monte Carlo Difficulty Simulation`);
console.log(`  Runs per strategy: ${runsPerStrategy}`);
console.log(`  Base seed: ${baseSeed}`);
console.log(`  Strategies: ${Object.values(STRATEGIES).map((s) => s.name).join(", ")}`);
console.log(`  Draft: Normal difficulty (${DRAFT_POINTS.normal} pts)`);
console.log("");
var sim = new SimulationRunner(runsPerStrategy, baseSeed);
sim.run();
sim.printResults();
