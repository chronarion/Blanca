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

        // Mobility
        let ownMoves = 0;
        let enemyMoves = 0;
        for (const p of board.getTeamPieces(team)) {
            ownMoves += MovementPattern.getMoves(p, board, false).length;
        }
        for (const p of board.getTeamPieces(enemyTeam)) {
            enemyMoves += MovementPattern.getMoves(p, board, false).length;
        }
        score += (ownMoves - enemyMoves) * 2;

        // King safety
        score += this.evaluateKingSafety(board, team);
        score -= this.evaluateKingSafety(board, enemyTeam);

        // Center control
        const centerCols = [Math.floor(board.cols / 2) - 1, Math.floor(board.cols / 2)];
        const centerRows = [Math.floor(board.rows / 2) - 1, Math.floor(board.rows / 2)];
        for (const c of centerCols) {
            for (const r of centerRows) {
                const piece = board.getPieceAt(c, r);
                if (piece) {
                    score += piece.team === team ? 10 : -10;
                }
            }
        }

        return score;
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
            if (dist <= 2) safety += 5;
        }

        return safety;
    }

    static minimax(board, depth, isMaximizing, team, alpha = -Infinity, beta = Infinity) {
        if (depth === 0) {
            return { score: this.evaluateBoard(board, team) };
        }

        const currentTeam = isMaximizing ? team : (team === 'player' ? 'enemy' : 'player');
        const pieces = board.getTeamPieces(currentTeam);

        let bestMove = null;
        let bestScore = isMaximizing ? -Infinity : Infinity;

        for (const piece of pieces) {
            if (piece.isFrozen) continue;
            const moves = MovementPattern.getMoves(piece, board, false)
                .filter(m => m.type !== 'threat');

            for (const move of moves) {
                const boardCopy = board.clone();
                const pieceCopy = boardCopy.getPieceAt(piece.col, piece.row);
                if (!pieceCopy) continue;

                boardCopy.movePiece(pieceCopy, move.col, move.row);
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
            if (beta <= alpha) break;
        }

        return bestMove || { score: bestScore };
    }
}
