import { PIECE_TYPES, TEAMS } from '../data/Constants.js';
import { isInBounds } from '../util/GridUtil.js';

export class ModifierSystem {
    constructor(board, relics = [], turnManager = null) {
        this.board = board;
        this.relics = relics;
        this.turnManager = turnManager;

        // Per-battle state
        this.battleCaptureCount = {};  // pieceId -> count
        this.rallyActive = false;
        this.lastStandTurnStart = {};  // pieceId -> turn number when last-stand started
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

        // Rally: if piece has rally modifier, set flag
        if (piece.hasModifier('rally')) {
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

        // --- Movement modifiers on this piece ---
        for (const mod of piece.modifiers) {
            switch (mod.id) {
                case 'leapOver':
                    moves = this._addLeapOverMoves(piece, moves);
                    break;
                case 'extraRange':
                    moves = this._extendRange(piece, moves, 2);
                    break;
                case 'kingStep':
                    moves = this._addKingMoves(piece, moves);
                    break;
                case 'sidestep':
                    moves = this._addSidestep(piece, moves);
                    break;
                case 'retreat':
                    moves = this._addRetreat(piece, moves);
                    break;
                case 'diagonalSlip':
                    moves = this._addDiagonalSlip(piece, moves);
                    break;
                case 'charge':
                    if (piece.moveCount === 0) {
                        moves = this._extendRange(piece, moves, 3);
                    }
                    break;
                case 'phasing':
                    moves = this._addPhasingMoves(piece, moves);
                    break;
                case 'glasscannon':
                    moves = this._extendRange(piece, moves, 3);
                    break;
                case 'berserker': {
                    const kills = this.battleCaptureCount[piece.id] || 0;
                    if (kills > 0) {
                        moves = this._extendRange(piece, moves, kills);
                    }
                    break;
                }
                case 'forwardCapture':
                    moves = this._addForwardCapture(piece, moves);
                    break;
                case 'rangedCapture':
                    moves = this._flagRangedCaptures(piece, moves);
                    break;
            }
        }

        // --- Aura: Inspire from adjacent friendlies ---
        const friendlies = this.board.getTeamPieces(piece.team);
        for (const ally of friendlies) {
            if (ally.id === piece.id) continue;
            if (!ally.hasModifier('inspire')) continue;
            const dx = Math.abs(piece.col - ally.col);
            const dy = Math.abs(piece.row - ally.row);
            if (dx <= 1 && dy <= 1) {
                moves = this._extendRange(piece, moves, 1);
                break; // Only one inspire bonus
            }
        }

        // --- Rally: if rally was active from last turn, +1 range to all friendlies ---
        if (this.rallyActive && piece.team === TEAMS.PLAYER) {
            moves = this._extendRange(piece, moves, 1);
        }

        // --- Aura: Intimidate from adjacent enemies ---
        const enemies = this.board.getTeamPieces(piece.team === TEAMS.PLAYER ? TEAMS.ENEMY : TEAMS.PLAYER);
        for (const enemy of enemies) {
            if (!enemy.hasModifier('intimidate')) continue;
            const dx = Math.abs(piece.col - enemy.col);
            const dy = Math.abs(piece.row - enemy.row);
            if (dx <= 1 && dy <= 1) {
                moves = this._reduceRange(piece, moves, 1);
                break;
            }
        }

        // --- Anchored: limit to max 2 squares movement ---
        if (piece.hasModifier('anchored')) {
            moves = moves.filter(m => {
                const dist = Math.max(Math.abs(m.col - piece.col), Math.abs(m.row - piece.row));
                return dist <= 2;
            });
        }

        // --- Relic effects ---
        moves = this._applyRelicEffects(piece, moves);

        return moves;
    }

    handlePostCapture(piece, capturedPiece) {
        const results = { extraMove: false, returnToStart: false, startCol: 0, startRow: 0, explode: false, adjacentEnemies: [] };

        if (piece.hasModifier('doubleCapture')) {
            results.extraMove = true;
        }

        if (piece.hasModifier('captureChain')) {
            // Check if immediate follow-up capture is available
            const futureMoves = this.getModifiedMoves(piece, this._getBaseMoves(piece));
            if (futureMoves.some(m => m.type === 'capture')) {
                results.extraMove = true;
            }
        }

        if (piece.hasModifier('captureRetreat')) {
            results.returnToStart = true;
        }

        if (piece.hasModifier('explosiveCapture')) {
            results.explode = true;
            // Find adjacent enemies to the capture target's position
            const offsets = [[-1,-1],[0,-1],[1,-1],[-1,0],[1,0],[-1,1],[0,1],[1,1]];
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
        // Glasscannon on attacker bypasses ALL target protections
        if (attacker.hasModifier('glasscannon')) {
            // But glasscannon on TARGET means protections are also bypassed
            return true;
        }

        // Glasscannon on target: all protections bypassed
        if (target.hasModifier('glasscannon')) {
            return true;
        }

        const turnNum = this.turnManager ? this.turnManager.turnNumber : 999;

        // First turn shield
        if (target.hasModifier('firstTurnShield') && turnNum < 4) {
            return false;
        }

        // Flank shield: can't be captured from the side (same row)
        if (target.hasModifier('flankShield')) {
            if (attacker.row === target.row && attacker.col !== target.col) {
                return false;
            }
        }

        // Rear shield: can't be captured from behind
        if (target.hasModifier('rearShield')) {
            const isPlayer = target.team === TEAMS.PLAYER;
            // Player pieces face up (forward = lower row), behind = higher row
            // Enemy pieces face down (forward = higher row), behind = lower row
            if (isPlayer && attacker.row > target.row) return false;
            if (!isPlayer && attacker.row < target.row) return false;
        }

        // Adjacency shield: immune while adjacent to a friendly
        if (target.hasModifier('adjacencyShield')) {
            const friendlies = this.board.getTeamPieces(target.team);
            const hasAdjacentFriendly = friendlies.some(f => {
                if (f.id === target.id) return false;
                return Math.abs(f.col - target.col) <= 1 && Math.abs(f.row - target.row) <= 1;
            });
            if (hasAdjacentFriendly) return false;
        }

        // Last stand: when last non-king piece, immune for 3 turns
        if (target.hasModifier('lastStand')) {
            const teamPieces = this.board.getTeamPieces(target.team);
            const nonKingPieces = teamPieces.filter(p => p.type !== PIECE_TYPES.KING);
            if (nonKingPieces.length === 1 && nonKingPieces[0].id === target.id) {
                if (!this.lastStandTurnStart[target.id]) {
                    this.lastStandTurnStart[target.id] = turnNum;
                }
                const elapsed = turnNum - this.lastStandTurnStart[target.id];
                if (elapsed < 6) return false; // 3 full turns = 6 half-turns
            }
        }

        // Anchored: immune to capture
        if (target.hasModifier('anchored')) {
            return false;
        }

        // Guardian aura: check if any adjacent friendly has guardian
        const targetFriendlies = this.board.getTeamPieces(target.team);
        for (const ally of targetFriendlies) {
            if (ally.id === target.id) continue;
            if (!ally.hasModifier('guardian')) continue;
            const dx = Math.abs(ally.col - target.col);
            const dy = Math.abs(ally.row - target.row);
            if (dx > 1 || dy > 1) continue;

            // Guardian blocks captures from guardian's direction relative to target
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
            [-1, -1], [0, -1], [1, -1],
            [-1, 0],           [1, 0],
            [-1, 1],  [0, 1],  [1, 1],
        ];

        for (const [dc, dr] of offsets) {
            const nc = piece.col + dc;
            const nr = piece.row + dr;
            if (!isInBounds(nc, nr, this.board.cols, this.board.rows)) continue;
            if (moves.some(m => m.col === nc && m.row === nr)) continue;
            const tile = this.board.getTile(nc, nr);
            if (!tile || !tile.isPassable()) continue;

            if (tile.hasPiece()) {
                if (tile.piece.team !== piece.team) {
                    moves.push({ col: nc, row: nr, type: 'capture' });
                }
            } else {
                moves.push({ col: nc, row: nr, type: 'move' });
            }
        }
        return moves;
    }

    _addSidestep(piece, moves) {
        for (const dc of [-1, 1]) {
            const nc = piece.col + dc;
            const nr = piece.row;
            if (!isInBounds(nc, nr, this.board.cols, this.board.rows)) continue;
            if (moves.some(m => m.col === nc && m.row === nr)) continue;
            const tile = this.board.getTile(nc, nr);
            if (!tile || !tile.isPassable()) continue;

            if (tile.hasPiece()) {
                if (tile.piece.team !== piece.team) {
                    moves.push({ col: nc, row: nr, type: 'capture' });
                }
            } else {
                moves.push({ col: nc, row: nr, type: 'move' });
            }
        }
        return moves;
    }

    _addRetreat(piece, moves) {
        const dir = piece.team === TEAMS.PLAYER ? 1 : -1; // backward
        const nc = piece.col;
        const nr = piece.row + dir;
        if (!isInBounds(nc, nr, this.board.cols, this.board.rows)) return moves;
        if (moves.some(m => m.col === nc && m.row === nr)) return moves;
        const tile = this.board.getTile(nc, nr);
        if (!tile || !tile.isPassable()) return moves;

        if (tile.hasPiece()) {
            if (tile.piece.team !== piece.team) {
                moves.push({ col: nc, row: nr, type: 'capture' });
            }
        } else {
            moves.push({ col: nc, row: nr, type: 'move' });
        }
        return moves;
    }

    _addDiagonalSlip(piece, moves) {
        const offsets = [[-1, -1], [1, -1], [-1, 1], [1, 1]];
        for (const [dc, dr] of offsets) {
            const nc = piece.col + dc;
            const nr = piece.row + dr;
            if (!isInBounds(nc, nr, this.board.cols, this.board.rows)) continue;
            if (moves.some(m => m.col === nc && m.row === nr)) continue;
            const tile = this.board.getTile(nc, nr);
            if (!tile || !tile.isPassable()) continue;

            if (tile.hasPiece()) {
                if (tile.piece.team !== piece.team) {
                    moves.push({ col: nc, row: nr, type: 'capture' });
                }
            } else {
                moves.push({ col: nc, row: nr, type: 'move' });
            }
        }
        return moves;
    }

    _addForwardCapture(piece, moves) {
        const dir = piece.team === TEAMS.PLAYER ? -1 : 1;
        const nc = piece.col;
        const nr = piece.row + dir;
        if (!isInBounds(nc, nr, this.board.cols, this.board.rows)) return moves;
        if (moves.some(m => m.col === nc && m.row === nr && m.type === 'capture')) return moves;
        const tile = this.board.getTile(nc, nr);
        if (tile && tile.hasPiece() && tile.piece.team !== piece.team) {
            // Remove any existing move-only entry at this square
            moves = moves.filter(m => !(m.col === nc && m.row === nr && m.type === 'move'));
            moves.push({ col: nc, row: nr, type: 'capture' });
        }
        return moves;
    }

    _flagRangedCaptures(piece, moves) {
        // Mark all capture moves as ranged (attacker stays put)
        return moves.map(m => {
            if (m.type === 'capture') {
                return { ...m, ranged: true };
            }
            return m;
        });
    }

    _addLeapOverMoves(piece, moves) {
        // For sliding directions, re-calculate allowing one leap
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
                        // Jump over this piece
                        leaped = true;
                        nc += dc;
                        nr += dr;
                        continue;
                    }
                    // After leaping, can capture enemy
                    if (tile.piece.team !== piece.team) {
                        if (!moves.some(m => m.col === nc && m.row === nr)) {
                            moves.push({ col: nc, row: nr, type: 'capture' });
                        }
                    }
                    break;
                }

                if (!moves.some(m => m.col === nc && m.row === nr)) {
                    moves.push({ col: nc, row: nr, type: 'move' });
                }
                nc += dc;
                nr += dr;
            }
        }
        return moves;
    }

    _addPhasingMoves(piece, moves) {
        // Re-calculate sliding moves ignoring blocking pieces
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
                        if (!moves.some(m => m.col === nc && m.row === nr)) {
                            moves.push({ col: nc, row: nr, type: 'capture' });
                        }
                    }
                    // Continue through regardless
                    nc += dc;
                    nr += dr;
                    continue;
                }

                if (!moves.some(m => m.col === nc && m.row === nr)) {
                    moves.push({ col: nc, row: nr, type: 'move' });
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

            // Extend from the outermost move in this direction
            let curCol = m.col;
            let curRow = m.row;
            for (let i = 0; i < extra; i++) {
                curCol += ndx;
                curRow += ndy;
                if (!isInBounds(curCol, curRow, this.board.cols, this.board.rows)) break;
                if (moves.some(em => em.col === curCol && em.row === curRow)) continue;
                if (extended.some(em => em.col === curCol && em.row === curRow)) continue;
                const tile = this.board.getTile(curCol, curRow);
                if (!tile || !tile.isPassable()) break;
                if (tile.hasPiece()) {
                    if (tile.piece.team !== piece.team) {
                        extended.push({ col: curCol, row: curRow, type: 'capture' });
                    }
                    break;
                }
                extended.push({ col: curCol, row: curRow, type: 'move' });
            }
        }
        return [...moves, ...extended];
    }

    _reduceRange(piece, moves, amount) {
        // Remove the farthest moves in each sliding direction
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
            // Keep all but the last 'amount' moves, but always keep at least 1
            const keep = Math.max(1, group.length - amount);
            result.push(...group.slice(0, keep));
        }
        return result;
    }

    _getSlidingDirections(piece) {
        // Determine sliding directions based on piece type
        switch (piece.type) {
            case PIECE_TYPES.ROOK:
                return [[0,-1],[0,1],[-1,0],[1,0]];
            case PIECE_TYPES.BISHOP:
                return [[-1,-1],[1,-1],[-1,1],[1,1]];
            case PIECE_TYPES.QUEEN:
                return [[0,-1],[0,1],[-1,0],[1,0],[-1,-1],[1,-1],[-1,1],[1,1]];
            default:
                return [];
        }
    }

    _getBaseMoves(piece) {
        // Minimal base moves for checking capture chains - just check current legal moves
        // This imports circular, so we use a simplified version
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
                        moves.push({ col: nc, row: nr, type: 'capture' });
                    }
                    break;
                }
                moves.push({ col: nc, row: nr, type: 'move' });
                nc += dc;
                nr += dr;
            }
        }
        // Knights
        if (piece.type === PIECE_TYPES.KNIGHT) {
            const knightOffsets = [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]];
            for (const [dc, dr] of knightOffsets) {
                const nc = piece.col + dc;
                const nr = piece.row + dr;
                if (!isInBounds(nc, nr, this.board.cols, this.board.rows)) continue;
                const tile = this.board.getTile(nc, nr);
                if (!tile || !tile.isPassable()) continue;
                if (tile.hasPiece()) {
                    if (tile.piece.team !== piece.team) {
                        moves.push({ col: nc, row: nr, type: 'capture' });
                    }
                } else {
                    moves.push({ col: nc, row: nr, type: 'move' });
                }
            }
        }
        return moves;
    }

    _applyRelicEffects(piece, moves) {
        // Relic: pawnForwardCapture gives all pawns forward capture
        if (piece.type === PIECE_TYPES.PAWN && this.hasRelic('pawnForwardCapture')
            && !piece.hasModifier('forwardCapture')) {
            moves = this._addForwardCapture(piece, moves);
        }
        return moves;
    }

    hasRelic(id) {
        return this.relics.some(r => r.id === id);
    }
}
