import { Piece } from '../pieces/Piece.js';
import { PIECE_TYPES, TEAMS, STARTING_GOLD, TOTAL_FLOORS, ROSTER_LIMIT } from '../data/Constants.js';
import { ARMIES } from '../data/ArmyData.js';
import { SeededRNG } from '../util/SeededRNG.js';
import { FloorGenerator } from './FloorGenerator.js';
import { EncounterGenerator } from './EncounterGenerator.js';
import { RelicSystem } from './RelicSystem.js';
import { Shop } from './Shop.js';
import { getRandomRelic } from '../data/RelicData.js';

export class RunManager {
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
        this.difficulty = 'normal';

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
        this.difficulty = 'normal';

        // Create roster from army
        this.roster = army.pieces.map(p => new Piece(p.type, TEAMS.PLAYER));
        this.gold = STARTING_GOLD;
        this.currentFloor = 1;
        this.currentNode = null;

        this.relicSystem = new RelicSystem(this.eventBus);
        this.prisoners = {};
        this.stats = { battlesWon: 0, piecesLost: 0, piecesRecruited: 0, goldSpent: 0, floorsCleared: 0 };

        // Generate map
        this.map = this.floorGenerator.generateMap(TOTAL_FLOORS);
        this.isActive = true;

        this.eventBus.emit('runStarted', { army, seed: this.seed });
    }

    startRunFromDraft(difficulty, pieceTypes, seed = null) {
        this.seed = seed || SeededRNG.generateSeed();
        this.rng = new SeededRNG(this.seed);

        this.floorGenerator = new FloorGenerator(this.rng);
        this.encounterGenerator = new EncounterGenerator(this.rng);
        this.shop = new Shop(this.rng, this.eventBus);

        this.armyId = 'draft';
        this.armyAbility = null;
        this.difficulty = difficulty;

        // Create roster from drafted piece types (king is always included)
        this.roster = [];
        // Always add king
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

        // Generate map
        this.map = this.floorGenerator.generateMap(TOTAL_FLOORS);
        this.isActive = true;

        this.eventBus.emit('runStarted', { armyId: 'draft', difficulty, seed: this.seed });
    }

    getCurrentFloorData() {
        return this.map[this.currentFloor - 1] || null;
    }

    getEncounter(nodeType) {
        const difficulty = Math.min(5, Math.ceil(this.currentFloor / 2));
        switch (nodeType) {
            case 'battle':
                return this.encounterGenerator.generateBattle(this.currentFloor, difficulty);
            case 'elite':
                return this.encounterGenerator.generateElite(this.currentFloor, difficulty);
            case 'boss':
                return { name: `Boss (Floor ${this.currentFloor})`, isBoss: true, difficulty };
            default:
                return null;
        }
    }

    prepareCombat(encounter) {
        const enemyCount = encounter.enemyPieces ? encounter.enemyPieces.length : Infinity;
        const playerPlacement = this.encounterGenerator.placePlayerPieces(
            this.roster, encounter.cols, encounter.rows, enemyCount
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
            encounterName: encounter.name,
        };
    }

    onBattleWon(result) {
        this.stats.battlesWon++;
        let goldMult = 1 + (this.currentFloor - 1) * 0.1;
        if (this.relicSystem.ownedRelics.some(r => r.id === 'goldBonus')) goldMult *= 1.5;
        const gold = Math.floor((result.goldEarned || 10) * goldMult);
        this.gold += gold;

        // Remove captured pieces from roster
        if (result.capturedByEnemy) {
            for (const captured of result.capturedByEnemy) {
                const idx = this.roster.findIndex(p => p.id === captured.id);
                if (idx !== -1) {
                    this.roster.splice(idx, 1);
                    this.stats.piecesLost++;
                }
            }
        }

        // Update promoted pieces in roster
        const boardPieces = result.survivingPlayerPieces || [];
        for (const bp of boardPieces) {
            const rosterPiece = this.roster.find(p => p.id === bp.id);
            if (rosterPiece && bp.promotedFrom) {
                rosterPiece.type = bp.type;
                rosterPiece.promotedFrom = bp.promotedFrom;
            }
        }

        // Add captured enemy pieces as prisoners
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

        // Elites can award relics (modifiers now come from upgrade packs)
        if (isElite) {
            rewards.relic = getRandomRelic([], this.rng);
        }

        // Always offer a free pawn recruit
        rewards.recruitOptions = [{ type: PIECE_TYPES.PAWN, cost: 0 }];
        // From floor 2+, chance for a free officer recruit
        if (floor >= 2 && this.rng.random() < 0.4 + floor * 0.05) {
            rewards.recruitOptions.push({
                type: this.rng.randomChoice([PIECE_TYPES.KNIGHT, PIECE_TYPES.BISHOP]),
                cost: 0,
            });
        }

        return rewards;
    }

    onBattleLost() {
        this.isActive = false;
        this.eventBus.emit('runEnded', { victory: false, stats: this.stats });
    }

    advanceFloor() {
        this.currentFloor++;
        this.stats.floorsCleared++;
        if (this.currentFloor > TOTAL_FLOORS) {
            this.isActive = false;
            this.eventBus.emit('runEnded', { victory: true, stats: this.stats });
            return false;
        }
        return true;
    }

    recruitPiece(type) {
        if (this.roster.length >= ROSTER_LIMIT) return null;
        const piece = new Piece(type, TEAMS.PLAYER);
        this.roster.push(piece);
        this.stats.piecesRecruited++;
        this.eventBus.emit('pieceRecruited', { piece });
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
        const ownedIds = this.relicSystem.ownedRelics.map(r => r.id);
        return this.shop.generate(this.currentFloor, ownedIds);
    }

    purchaseShopItem(item) {
        if (this.gold < item.price) return false;
        this.gold -= item.price;
        this.stats.goldSpent += item.price;

        if (item.category === 'piece') {
            this.recruitPiece(item.type);
        } else if (item.category === 'relic') {
            this.addRelic(item.relic);
        }
        // Modifier purchased — handled in shop state UI

        const idx = this.shop.items.indexOf(item);
        if (idx !== -1) this.shop.items.splice(idx, 1);

        return true;
    }

    serialize() {
        return {
            seed: this.seed,
            armyId: this.armyId,
            difficulty: this.difficulty,
            roster: this.roster.map(p => p.serialize()),
            gold: this.gold,
            currentFloor: this.currentFloor,
            relics: this.relicSystem.serialize(),
            prisoners: { ...this.prisoners },
            stats: { ...this.stats },
            isActive: this.isActive,
        };
    }

    deserialize(data) {
        this.seed = data.seed;
        this.rng = new SeededRNG(data.seed);
        // Fast-forward RNG to current state by regenerating the map
        this.floorGenerator = new FloorGenerator(this.rng);
        this.encounterGenerator = new EncounterGenerator(this.rng);
        this.shop = new Shop(this.rng, this.eventBus);

        this.armyId = data.armyId;
        this.difficulty = data.difficulty || 'normal';
        this.armyAbility = data.armyId === 'draft' ? null : (ARMIES[data.armyId]?.ability || null);
        this.roster = data.roster.map(p => Piece.deserialize(p));
        this.gold = data.gold;
        this.currentFloor = data.currentFloor;
        this.relicSystem.deserialize(data.relics);
        this.prisoners = data.prisoners || {};
        this.stats = data.stats;
        this.isActive = data.isActive;

        this.map = this.floorGenerator.generateMap(TOTAL_FLOORS);
    }
}
