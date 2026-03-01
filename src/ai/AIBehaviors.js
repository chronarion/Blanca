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
                const targetVal = PIECE_VALUES[target.type] * 100;
                score += targetVal;
                // King capture is always priority
                if (target.type === PIECE_TYPES.KING) {
                    score += 50000;
                }
                // Bonus for capturing hanging pieces (undefended)
                if (!this.isSquareDefendedBy(move.col, move.row, board, enemyTeam)) {
                    score += targetVal * 0.5;
                }
            }
        }

        // Exchange-aware risk evaluation
        const risk = this.evaluateSquareRisk(move.col, move.row, piece, board, ownTeam, enemyTeam);
        score -= risk;

        // Retreat logic: if current square is under threat and destination is safe, bonus
        const currentRisk = this.evaluateSquareRisk(piece.col, piece.row, piece, board, ownTeam, enemyTeam);
        if (currentRisk > 0 && risk === 0) {
            score += currentRisk * 0.7;
        }

        // Protect hanging pieces: move to defend a friendly piece under attack
        const friendlyPieces = board.getTeamPieces(ownTeam);
        for (const friend of friendlyPieces) {
            if (friend === piece) continue;
            // If this friend is attacked and we'd be defending their square from our new position
            const friendKey = `${friend.col},${friend.row}`;
            const friendMoves = MovementPattern.getMoves(piece, board, true);
            const defendsFriend = friendMoves.some(m => m.col === friend.col && m.row === friend.row);
            if (defendsFriend) {
                const friendRisk = this.evaluateSquareRisk(friend.col, friend.row, friend, board, ownTeam, enemyTeam);
                if (friendRisk > 0) {
                    score += PIECE_VALUES[friend.type] * 20;
                }
            }
        }

        // Center control
        const centerCol = board.cols / 2;
        const centerRow = board.rows / 2;
        const centerDist = Math.abs(move.col - centerCol) + Math.abs(move.row - centerRow);
        score += (board.cols - centerDist) * 3;

        // Advance toward enemy king
        const enemyKing = board.findKing(enemyTeam);
        if (enemyKing) {
            const distToKing = Math.abs(move.col - enemyKing.col) + Math.abs(move.row - enemyKing.row);
            score += (20 - distToKing) * 5;

            // Bonus for attacking squares adjacent to enemy king
            if (distToKing <= 2 && piece.type !== PIECE_TYPES.PAWN) {
                score += 25;
            }
        }

        // Pawn advancement (promote faster)
        if (piece.type === PIECE_TYPES.PAWN) {
            const direction = piece.team === 'player' ? -1 : 1;
            score += (move.row * direction) * 8;
            // Big bonus for reaching promotion rank
            if ((direction === 1 && move.row === board.rows - 1) ||
                (direction === -1 && move.row === 0)) {
                score += 400;
            }
        }

        // King safety
        score += this.evaluateKingSafety(board, ownTeam) * 0.5;

        // Defensive awareness: bonus for moving near own king when enemies are close
        const ownKing = board.findKing(ownTeam);
        if (ownKing && piece.type !== PIECE_TYPES.KING) {
            const distToOwnKing = Math.abs(move.col - ownKing.col) + Math.abs(move.row - ownKing.row);
            const enemies = board.getTeamPieces(enemyTeam);
            const nearbyEnemies = enemies.filter(e =>
                Math.abs(e.col - ownKing.col) + Math.abs(e.row - ownKing.row) <= 3
            );
            if (nearbyEnemies.length > 0 && distToOwnKing <= 2) {
                score += nearbyEnemies.length * 20;
            }
        }

        // King shouldn't walk into danger
        if (piece.type === PIECE_TYPES.KING) {
            const destRisk = this.evaluateSquareRisk(move.col, move.row, piece, board, ownTeam, enemyTeam);
            score -= destRisk * 2; // Extra penalty for king exposure
        }

        return score;
    },

    evaluateSquareRisk(col, row, movingPiece, board, ownTeam, enemyTeam) {
        // Handle legacy calls with 5 args (no ownTeam)
        if (enemyTeam === undefined) {
            enemyTeam = ownTeam;
            ownTeam = movingPiece.team;
        }

        const enemies = board.getTeamPieces(enemyTeam);

        // Find all enemy pieces that attack this square
        let isAttacked = false;
        let lowestAttackerValue = Infinity;

        for (const enemy of enemies) {
            const moves = MovementPattern.getMoves(enemy, board, true);
            if (moves.some(m => m.col === col && m.row === row)) {
                isAttacked = true;
                const val = PIECE_VALUES[enemy.type];
                if (val < lowestAttackerValue) lowestAttackerValue = val;
            }
        }

        if (!isAttacked) return 0;

        const pieceValue = PIECE_VALUES[movingPiece.type];

        // Check if we have defenders (own pieces that could recapture)
        const friendlies = board.getTeamPieces(ownTeam);
        let isDefended = false;

        for (const friend of friendlies) {
            if (friend === movingPiece) continue;
            const moves = MovementPattern.getMoves(friend, board, true);
            if (moves.some(m => m.col === col && m.row === row)) {
                isDefended = true;
                break;
            }
        }

        // Undefended and attacked: lose the piece
        if (!isDefended) {
            return pieceValue * 80;
        }

        // Defended but attacked by cheaper piece: bad trade
        if (lowestAttackerValue < pieceValue) {
            return (pieceValue - lowestAttackerValue) * 40;
        }

        // Defended and attacked by equal or more valuable piece: acceptable trade
        return 0;
    },

    isSquareDefendedBy(col, row, board, team) {
        const pieces = board.getTeamPieces(team);
        for (const piece of pieces) {
            const moves = MovementPattern.getMoves(piece, board, true);
            if (moves.some(m => m.col === col && m.row === row)) {
                return true;
            }
        }
        return false;
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
