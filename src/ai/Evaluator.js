import { PIECE_TYPES } from '../data/Constants.js';
import { PIECE_VALUES } from '../data/PieceData.js';
import { MovementPattern } from '../pieces/MovementPattern.js';

export class Evaluator {
    static evaluateBoard(board, team) {
        const enemyTeam = team === 'player' ? 'enemy' : 'player';
        let score = 0;

        // Material
        for (const piece of board.getTeamPieces(team)) {
            score += PIECE_VALUES[piece.type] * 100;
        }
        for (const piece of board.getTeamPieces(enemyTeam)) {
            score -= PIECE_VALUES[piece.type] * 100;
        }

        // Mobility (higher weight — controlling the board matters)
        let ownMoves = 0;
        let enemyMoves = 0;
        for (const p of board.getTeamPieces(team)) {
            ownMoves += MovementPattern.getMoves(p, board, false)
                .filter(m => m.type !== 'threat').length;
        }
        for (const p of board.getTeamPieces(enemyTeam)) {
            enemyMoves += MovementPattern.getMoves(p, board, false)
                .filter(m => m.type !== 'threat').length;
        }
        score += (ownMoves - enemyMoves) * 5;

        // King safety
        score += this.evaluateKingSafety(board, team);
        score -= this.evaluateKingSafety(board, enemyTeam);

        // Center control (expanded to center region, not just 4 squares)
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

        // Hanging pieces penalty/bonus
        score += this.evaluateHangingPieces(board, team, enemyTeam);

        // Pawn advancement
        for (const p of board.getTeamPieces(team)) {
            if (p.type === PIECE_TYPES.PAWN) {
                const dir = p.team === 'player' ? -1 : 1;
                const progress = p.row * dir;
                score += progress * 3;
            }
        }

        return score;
    }

    static evaluateHangingPieces(board, team, enemyTeam) {
        let score = 0;
        // Penalize own hanging pieces (attacked but undefended)
        for (const piece of board.getTeamPieces(team)) {
            if (piece.type === PIECE_TYPES.KING) continue;
            if (this.isAttacked(piece, board, enemyTeam) &&
                !this.isDefended(piece, board, team)) {
                score -= PIECE_VALUES[piece.type] * 40;
            }
        }
        // Bonus for enemy hanging pieces
        for (const piece of board.getTeamPieces(enemyTeam)) {
            if (piece.type === PIECE_TYPES.KING) continue;
            if (this.isAttacked(piece, board, team) &&
                !this.isDefended(piece, board, enemyTeam)) {
                score += PIECE_VALUES[piece.type] * 40;
            }
        }
        return score;
    }

    static isAttacked(piece, board, byTeam) {
        for (const attacker of board.getTeamPieces(byTeam)) {
            const moves = MovementPattern.getMoves(attacker, board, true);
            if (moves.some(m => m.col === piece.col && m.row === piece.row)) {
                return true;
            }
        }
        return false;
    }

    static isDefended(piece, board, byTeam) {
        for (const defender of board.getTeamPieces(byTeam)) {
            if (defender === piece) continue;
            const moves = MovementPattern.getMoves(defender, board, true);
            if (moves.some(m => m.col === piece.col && m.row === piece.row)) {
                return true;
            }
        }
        return false;
    }

    static evaluateKingSafety(board, team) {
        const king = board.findKing(team);
        if (!king) return -5000;

        const enemyTeam = team === 'player' ? 'enemy' : 'player';
        let safety = 0;

        // Penalty for enemy pieces near king
        for (const enemy of board.getTeamPieces(enemyTeam)) {
            const dist = Math.abs(enemy.col - king.col) + Math.abs(enemy.row - king.row);
            if (dist <= 2) safety -= PIECE_VALUES[enemy.type] * 15;
            else if (dist <= 4) safety -= PIECE_VALUES[enemy.type] * 3;
        }

        // Bonus for friendly pieces near king
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

        const currentTeam = isMaximizing ? team : (team === 'player' ? 'enemy' : 'player');
        const pieces = board.getTeamPieces(currentTeam);

        // Collect all moves with move ordering (captures first, sorted by victim value)
        let allMoves = [];
        for (const piece of pieces) {
            if (piece.isFrozen) continue;
            const moves = MovementPattern.getMoves(piece, board, false)
                .filter(m => m.type !== 'threat');

            for (const move of moves) {
                allMoves.push({ piece, move });
            }
        }

        // Move ordering: captures first (by target value desc), then non-captures
        allMoves.sort((a, b) => {
            const aCapture = a.move.type === 'capture' ? 1 : 0;
            const bCapture = b.move.type === 'capture' ? 1 : 0;
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
            // Handle castling: also move the rook
            if (move.type === 'castle' && move.rookFromCol !== undefined) {
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
}
