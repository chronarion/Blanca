import { Piece } from '../pieces/Piece.js';
import { PIECE_TYPES, TEAMS, TERRAIN_TYPES } from '../data/Constants.js';
import { getEncountersForDifficulty, getEliteEncounters } from '../data/EnemyData.js';
import { getRandomTerrain } from '../data/TerrainData.js';

export class EncounterGenerator {
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
        const occupied = new Set();

        // On boards with 7+ rows, use deeper formation (king row 1, pawns row 2, officers rows 0-1)
        const deepFormation = rows >= 7;
        const kingRow = deepFormation ? 1 : 0;
        const pawnRow = deepFormation ? 2 : 1;

        // Place king first
        enemyPieces.push({ type: PIECE_TYPES.KING, col: midCol, row: kingRow });
        occupied.add(`${midCol},${kingRow}`);

        // Separate remaining pieces into pawns and officers
        const remaining = encounter.pieces.filter(p => p.type !== PIECE_TYPES.KING);
        const pawns = remaining.filter(p => p.type === PIECE_TYPES.PAWN);
        const officers = remaining.filter(p => p.type !== PIECE_TYPES.PAWN);

        // Place first pawn directly in front of king to shield it
        let pawnOffset = 0;
        for (const p of pawns) {
            let col = Math.min(cols - 1, Math.max(0, midCol + pawnOffset));
            const row = pawnRow;
            while (occupied.has(`${col},${row}`) && col < cols) col++;
            if (col >= cols) col = 0;
            while (occupied.has(`${col},${row}`)) col++;
            occupied.add(`${col},${row}`);
            enemyPieces.push({ type: PIECE_TYPES.PAWN, col, row });
            // First pawn at midCol (shields king), then spiral outward
            if (pawnOffset === 0) pawnOffset = 1;
            else pawnOffset = pawnOffset > 0 ? -pawnOffset : -pawnOffset + 1;
        }

        // Place officers flanking the king (rows 0 and kingRow)
        let officerOffset = 1;
        for (const p of officers) {
            let col = Math.min(cols - 1, Math.max(0, midCol + officerOffset));
            // Try king's row first, then row 0
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

        // Generate terrain
        const terrain = [];
        if (floor >= 3 && this.rng.random() < 0.4 + floor * 0.05) {
            const count = this.rng.randomInt(1, Math.min(4, Math.floor(floor / 2)));
            for (let i = 0; i < count; i++) {
                const tc = this.rng.randomInt(0, cols - 1);
                const tr = this.rng.randomInt(2, rows - 3);
                if (!enemyPieces.some(p => p.col === tc && p.row === tr)) {
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
            difficulty: encounter.difficulty,
        };
    }

    generateFallback(floor, difficulty) {
        const cols = Math.min(10, 6 + Math.floor(floor / 3));
        const rows = cols;
        const midCol = Math.floor(cols / 2);

        const enemyPieces = [{ type: PIECE_TYPES.KING, col: midCol, row: 0 }];
        const pawnCount = Math.min(cols - 1, 2 + floor);
        for (let i = 0; i < pawnCount; i++) {
            const c = Math.min(cols - 1, Math.max(0, midCol - Math.floor(pawnCount / 2) + i));
            enemyPieces.push({ type: PIECE_TYPES.PAWN, col: c, row: 1 });
        }

        if (floor >= 3) enemyPieces.push({ type: PIECE_TYPES.KNIGHT, col: midCol - 1, row: 0 });
        if (floor >= 5) enemyPieces.push({ type: PIECE_TYPES.BISHOP, col: midCol + 1, row: 0 });
        if (floor >= 7) enemyPieces.push({ type: PIECE_TYPES.ROOK, col: midCol + 2, row: 0 });

        return {
            name: 'Enemy Force',
            cols, rows,
            enemyPieces,
            terrain: [],
            goldReward: 5 + floor * 3,
            isElite: false,
            difficulty,
        };
    }

    placePlayerPieces(roster, cols, rows, enemyCount = Infinity) {
        const placed = [];
        const maxDeploy = Math.min(Math.floor((cols * rows) * 0.25), enemyCount + 2);
        const midCol = Math.floor(cols / 2);
        const lastRow = rows - 1;
        const minRow = Math.floor(rows * 0.6);

        // Sort: king first, then by value
        const sorted = [...roster].sort((a, b) => {
            if (a.type === PIECE_TYPES.KING) return -1;
            if (b.type === PIECE_TYPES.KING) return 1;
            return 0;
        });

        const occupied = new Set();

        let colOffset = 0;
        let count = 0;
        for (const piece of sorted) {
            if (count >= maxDeploy) break;
            const isPawn = piece.type === PIECE_TYPES.PAWN;
            const baseRow = Math.max(minRow, isPawn ? lastRow - 1 : lastRow);
            let col;
            if (piece.type === PIECE_TYPES.KING) {
                col = midCol;
            } else {
                col = Math.min(cols - 1, Math.max(0, midCol + colOffset));
                colOffset = colOffset <= 0 ? -colOffset + 1 : -colOffset;
            }

            // Find a free position, adjusting if occupied
            let row = baseRow;
            let key = `${col},${row}`;
            while (occupied.has(key) && row >= minRow) {
                row--;
                key = `${col},${row}`;
            }
            if (occupied.has(key)) {
                // Try adjacent columns
                for (let dc = 1; dc < cols; dc++) {
                    for (const tryCol of [col + dc, col - dc]) {
                        if (tryCol >= 0 && tryCol < cols) {
                            key = `${tryCol},${baseRow}`;
                            if (!occupied.has(key)) {
                                col = tryCol;
                                row = baseRow;
                                break;
                            }
                        }
                    }
                    if (!occupied.has(`${col},${row}`)) break;
                }
            }

            occupied.add(`${col},${row}`);
            placed.push({ piece, col, row });
            count++;
        }

        return placed;
    }
}
