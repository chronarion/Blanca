import { PIECE_TYPES } from '../data/Constants.js';
import { PIECE_VALUES } from '../data/PieceData.js';
import { MovementPattern } from '../pieces/MovementPattern.js';

export const AIBehaviors = {
    evaluateMove(piece, move, board, ownTeam, enemyTeam) {
        let score = 0;

        // Capture value
        if (move.type === 'capture') {
            const target = board.getPieceAt(move.col, move.row);
            if (target) {
                score += PIECE_VALUES[target.type] * 100;
                // King capture is always priority
                if (target.type === PIECE_TYPES.KING) {
                    score += 10000;
                }
            }
        }

        // Avoid hanging pieces — check if destination is safe
        const risk = this.evaluateSquareRisk(move.col, move.row, piece, board, enemyTeam);
        score -= risk;

        // Retreat logic: if current square is under threat and destination is safe, bonus
        const currentRisk = this.evaluateSquareRisk(piece.col, piece.row, piece, board, enemyTeam);
        if (currentRisk > 0 && risk === 0 && move.type !== 'capture') {
            score += currentRisk * 0.5;
        }

        // Center control
        const centerCol = board.cols / 2;
        const centerRow = board.rows / 2;
        const centerDist = Math.abs(move.col - centerCol) + Math.abs(move.row - centerRow);
        score += (board.cols - centerDist) * 2;

        // Advance toward enemy king
        const enemyKing = board.findKing(enemyTeam);
        if (enemyKing) {
            const distToKing = Math.abs(move.col - enemyKing.col) + Math.abs(move.row - enemyKing.row);
            score += (20 - distToKing) * 3;
        }

        // Pawn advancement
        if (piece.type === PIECE_TYPES.PAWN) {
            const direction = piece.team === 'player' ? -1 : 1;
            score += (move.row * direction) * 5;
        }

        // King safety — factor in own king's safety
        score += this.evaluateKingSafety(board, ownTeam) * 0.1;

        // Defensive awareness: bonus for moving near own king when enemies are close
        const ownKing = board.findKing(ownTeam);
        if (ownKing && piece.type !== PIECE_TYPES.KING) {
            const distToOwnKing = Math.abs(move.col - ownKing.col) + Math.abs(move.row - ownKing.row);
            const enemies = board.getTeamPieces(enemyTeam);
            const nearbyEnemies = enemies.filter(e =>
                Math.abs(e.col - ownKing.col) + Math.abs(e.row - ownKing.row) <= 3
            );
            if (nearbyEnemies.length > 0 && distToOwnKing <= 2) {
                score += nearbyEnemies.length * 15;
            }
        }

        return score;
    },

    evaluateSquareRisk(col, row, movingPiece, board, enemyTeam) {
        const enemies = board.getTeamPieces(enemyTeam);
        let risk = 0;

        for (const enemy of enemies) {
            const moves = MovementPattern.getMoves(enemy, board, true);
            if (moves.some(m => m.col === col && m.row === row)) {
                risk += PIECE_VALUES[movingPiece.type] * 50;
                break;
            }
        }

        return risk;
    },

    evaluateKingSafety(board, team) {
        const king = board.findKing(team);
        if (!king) return -10000;

        const enemyTeam = team === 'player' ? 'enemy' : 'player';
        const enemies = board.getTeamPieces(enemyTeam);
        let dangerScore = 0;

        for (const enemy of enemies) {
            const dist = Math.abs(enemy.col - king.col) + Math.abs(enemy.row - king.row);
            if (dist <= 2) dangerScore += PIECE_VALUES[enemy.type] * 20;
            else if (dist <= 4) dangerScore += PIECE_VALUES[enemy.type] * 5;
        }

        return -dangerScore;
    },
};
