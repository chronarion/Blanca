import { Board } from '../board/Board.js';
import { BoardRenderer } from '../board/BoardRenderer.js';
import { Piece } from '../pieces/Piece.js';
import { MovementPattern } from '../pieces/MovementPattern.js';
import { CombatManager } from '../combat/CombatManager.js';
import { FloatingText } from '../ui/FloatingText.js';
import { AnimationManager } from '../render/AnimationManager.js';
import { PieceRenderer } from '../render/PieceRenderer.js';
import { BossAI } from '../ai/BossAI.js';
import { PIECE_TYPES, TEAMS, UI_COLORS, ANIMATION } from '../data/Constants.js';
import { PIECE_VALUES } from '../data/PieceData.js';

export class CombatState {
    constructor() {
        this.board = null;
        this.boardRenderer = null;
        this.combatManager = null;
        this.animManager = new AnimationManager();
        this.floatingText = new FloatingText();

        this.selectedPiece = null;
        this.legalMoves = [];
        this.gameOver = false;
        this.winner = null;
        this.stateMachine = null;
        this.eventBus = null;
        this.renderer = null;
        this.runManager = null;

        this.animatingMove = null;
        this.capturedByPlayer = [];
        this.capturedByEnemy = [];
        this.turnCount = 0;
        this.statusMessage = '';
        this.statusTimer = 0;

        this.pendingPromotion = null;
        this.promotionChoices = [PIECE_TYPES.QUEEN, PIECE_TYPES.ROOK, PIECE_TYPES.BISHOP, PIECE_TYPES.KNIGHT];

        this.clickHandler = null;
        this.moveHandler = null;
        this.rightClickHandler = null;
        this.keyHandler = null;

        this.encounterParams = null;
        this.screenShake = { x: 0, y: 0, intensity: 0, decay: 0.9 };
        this.isBoss = false;
        this.bossAI = null;
        this.bossPhaseMessage = '';
        this.bossPhaseTimer = 0;
    }

    enter(params = {}) {
        this.encounterParams = params;
        const cols = params.cols || 8;
        const rows = params.rows || 8;

        this.board = new Board(cols, rows);
        this.boardRenderer = new BoardRenderer(this.board, this.renderer);
        this.combatManager = new CombatManager(this.eventBus);
        this.combatManager.initBattle(this.board, {
            difficulty: params.difficulty || 2,
            relics: params.relics || [],
            armyAbility: params.armyAbility || null,
        });

        this.selectedPiece = null;
        this.legalMoves = [];
        this.gameOver = false;
        this.winner = null;
        this.capturedByPlayer = [];
        this.capturedByEnemy = [];
        this.turnCount = 0;
        this.animatingMove = null;
        this.pendingPromotion = null;
        this.screenShake = { x: 0, y: 0, intensity: 0, decay: 0.9 };
        this.isBoss = params.isBoss || false;
        this.bossAI = null;
        this.bossPhaseMessage = '';
        this.bossPhaseTimer = 0;

        if (params.bossData) {
            this.bossAI = new BossAI(this.board, this.eventBus, params.bossData);
            this.eventBus.on('bossPhaseChange', (data) => {
                this.bossPhaseMessage = data.name;
                this.bossPhaseTimer = 3;
                this.shakeScreen(8);
            });
        }

        // Queen split handler
        this.queenSplitHandler = (data) => this.handleQueenSplit(data);
        this.eventBus.on('queenSplit', this.queenSplitHandler);

        if (params.setup) {
            params.setup(this.board);
        } else if (params.playerPieces && params.enemyPieces) {
            for (const p of params.playerPieces) {
                const piece = p.piece instanceof Piece ? p.piece : (p instanceof Piece ? p : new Piece(p.type, TEAMS.PLAYER));
                piece.hasMoved = false;
                piece.moveCount = 0;
                piece.isFrozen = false;
                this.board.placePiece(piece, p.col, p.row);
            }
            for (const p of params.enemyPieces) {
                const piece = p.piece instanceof Piece ? p.piece : (p instanceof Piece ? p : new Piece(p.type, TEAMS.ENEMY));
                this.board.placePiece(piece, p.col, p.row);
            }
            if (params.terrain) {
                for (const t of params.terrain) {
                    this.board.setTerrain(t.col, t.row, t.terrain);
                }
            }
        } else {
            this.setupDefaultBattle();
        }

        // Vanguard Shield relic: front-row pawns get first-turn protection
        if (params.relics?.some(r => r.id === 'shieldStart')) {
            const playerPawns = this.board.getTeamPieces(TEAMS.PLAYER)
                .filter(p => p.type === PIECE_TYPES.PAWN);
            if (playerPawns.length > 0) {
                const minRow = Math.min(...playerPawns.map(p => p.row));
                const frontPawns = playerPawns.filter(p => p.row <= minRow + 1);
                for (const pawn of frontPawns) {
                    if (!pawn.hasModifier('firstTurnProtection')) {
                        pawn.addModifier({ id: 'firstTurnProtection', type: 'protection', name: 'Opening Guard' });
                    }
                }
            }
        }

        this.showStatus('Your move');
        this.bindInput();
    }

    setupDefaultBattle() {
        const b = this.board;
        const midCol = Math.floor(b.cols / 2);
        const lastRow = b.rows - 1;

        // Player (bottom)
        b.placePiece(new Piece(PIECE_TYPES.KING, TEAMS.PLAYER), midCol, lastRow);
        b.placePiece(new Piece(PIECE_TYPES.QUEEN, TEAMS.PLAYER), midCol - 1, lastRow);
        b.placePiece(new Piece(PIECE_TYPES.BISHOP, TEAMS.PLAYER), midCol - 2, lastRow);
        b.placePiece(new Piece(PIECE_TYPES.BISHOP, TEAMS.PLAYER), midCol + 1, lastRow);
        b.placePiece(new Piece(PIECE_TYPES.KNIGHT, TEAMS.PLAYER), midCol - 3, lastRow);
        b.placePiece(new Piece(PIECE_TYPES.KNIGHT, TEAMS.PLAYER), midCol + 2, lastRow);
        b.placePiece(new Piece(PIECE_TYPES.ROOK, TEAMS.PLAYER), Math.max(0, midCol - 4), lastRow);
        b.placePiece(new Piece(PIECE_TYPES.ROOK, TEAMS.PLAYER), Math.min(b.cols - 1, midCol + 3), lastRow);
        for (let c = Math.max(0, midCol - 4); c <= Math.min(b.cols - 1, midCol + 3); c++) {
            b.placePiece(new Piece(PIECE_TYPES.PAWN, TEAMS.PLAYER), c, lastRow - 1);
        }

        // Enemy (top)
        b.placePiece(new Piece(PIECE_TYPES.KING, TEAMS.ENEMY), midCol, 0);
        b.placePiece(new Piece(PIECE_TYPES.QUEEN, TEAMS.ENEMY), midCol + 1, 0);
        b.placePiece(new Piece(PIECE_TYPES.BISHOP, TEAMS.ENEMY), midCol - 2, 0);
        b.placePiece(new Piece(PIECE_TYPES.BISHOP, TEAMS.ENEMY), midCol + 2, 0);
        b.placePiece(new Piece(PIECE_TYPES.KNIGHT, TEAMS.ENEMY), midCol - 1, 0);
        b.placePiece(new Piece(PIECE_TYPES.KNIGHT, TEAMS.ENEMY), midCol + 3, 0);
        b.placePiece(new Piece(PIECE_TYPES.ROOK, TEAMS.ENEMY), Math.max(0, midCol - 3), 0);
        b.placePiece(new Piece(PIECE_TYPES.ROOK, TEAMS.ENEMY), Math.min(b.cols - 1, midCol + 4), 0);
        for (let c = Math.max(0, midCol - 4); c <= Math.min(b.cols - 1, midCol + 3); c++) {
            b.placePiece(new Piece(PIECE_TYPES.PAWN, TEAMS.ENEMY), c, 1);
        }
    }

    bindInput() {
        this.clickHandler = (data) => this.handleClick(data);
        this.moveHandler = (data) => this.handleMouseMove(data);
        this.rightClickHandler = () => this.deselect();
        this.keyHandler = (data) => this.handleKey(data);

        this.eventBus.on('click', this.clickHandler);
        this.eventBus.on('mousemove', this.moveHandler);
        this.eventBus.on('rightclick', this.rightClickHandler);
        this.eventBus.on('keydown', this.keyHandler);
    }

    exit() {
        if (this.clickHandler) this.eventBus.off('click', this.clickHandler);
        if (this.moveHandler) this.eventBus.off('mousemove', this.moveHandler);
        if (this.rightClickHandler) this.eventBus.off('rightclick', this.rightClickHandler);
        if (this.keyHandler) this.eventBus.off('keydown', this.keyHandler);
        if (this.queenSplitHandler) this.eventBus.off('queenSplit', this.queenSplitHandler);
    }

    handleClick(data) {
        if (this.animatingMove) return;

        if (this.pendingPromotion) {
            this.handlePromotionClick(data);
            return;
        }

        if (this.gameOver) {
            this.onCombatFinished();
            return;
        }

        if (!this.combatManager.turnManager.isPlayerTurn) return;

        const pos = this.boardRenderer.screenToBoard(data.x, data.y);
        if (!pos) return;

        const { col, row } = pos;
        const clickedPiece = this.board.getPieceAt(col, row);

        if (this.selectedPiece) {
            const move = this.legalMoves.find(m => m.col === col && m.row === row);
            if (move) {
                this.startMoveAnimation(this.selectedPiece, move);
                return;
            }
            if (clickedPiece && clickedPiece.team === TEAMS.PLAYER && !clickedPiece.isFrozen) {
                this.selectPiece(clickedPiece);
                return;
            }
            this.deselect();
        } else {
            if (clickedPiece && clickedPiece.team === TEAMS.PLAYER && !clickedPiece.isFrozen) {
                this.selectPiece(clickedPiece);
            }
        }
    }

    handleMouseMove(data) {
        if (!this.boardRenderer) return;
        this.boardRenderer.hoverTile = this.boardRenderer.screenToBoard(data.x, data.y);
    }

    handleKey(data) {
        if (data.code === 'Escape') {
            if (this.pendingPromotion) return;
            if (this.selectedPiece) {
                this.deselect();
            } else if (this.stateMachine.states.has('pause')) {
                this.stateMachine.push('pause');
            }
        }
    }

    selectPiece(piece) {
        this.selectedPiece = piece;
        this.legalMoves = this.combatManager.getLegalMoves(piece);
        this.boardRenderer.selectedPiece = piece;
        this.boardRenderer.legalMoves = this.legalMoves;
    }

    deselect() {
        this.selectedPiece = null;
        this.legalMoves = [];
        this.boardRenderer.selectedPiece = null;
        this.boardRenderer.legalMoves = [];
    }

    startMoveAnimation(piece, move) {
        this.deselect();
        this.animatingMove = {
            piece,
            fromCol: piece.col, fromRow: piece.row,
            toCol: move.col, toRow: move.row,
            progress: 0,
            duration: ANIMATION.moveDuration,
            moveType: move.type,
        };
    }

    finishMove(anim) {
        const result = this.combatManager.executeMove(anim.piece, anim.toCol, anim.toRow);
        if (!result.success) return;

        this.boardRenderer.lastMove = { from: result.from, to: result.to };

        if (result.captured) {
            const pos = this.boardRenderer.boardToScreen(anim.toCol, anim.toRow);
            const ts = this.boardRenderer.tileSize;
            this.floatingText.add(pos.x + ts / 2, pos.y, 'Captured!', UI_COLORS.accent, 800, 16);
            this.shakeScreen(4);
            this.capturedByPlayer = this.combatManager.capturedByPlayer;
            this.capturedByEnemy = this.combatManager.capturedByEnemy;
        }

        if (result.kingCaptured) {
            this.gameOver = true;
            this.winner = result.piece.team;
            this.shakeScreen(10);
            const msg = this.winner === TEAMS.PLAYER ? 'VICTORY!' : 'DEFEAT!';
            this.showStatus(msg);
            return;
        }

        if (result.needsPromotion) {
            if (anim.piece.team === TEAMS.PLAYER) {
                this.pendingPromotion = anim.piece;
                this.showStatus('Choose promotion');
                return;
            } else {
                this.combatManager.promotePiece(anim.piece, PIECE_TYPES.QUEEN);
                this.afterMove();
                return;
            }
        }

        this.afterMove();
    }

    afterMove() {
        this.combatManager.endTurn();
        this.turnCount = this.combatManager.turnManager.turnNumber;

        if (this.combatManager.turnManager.isPlayerTurn) {
            this.showStatus('Your move');
            this.updateCheckWarning();
        } else {
            this.showStatus('Enemy thinking...');
            setTimeout(() => this.doAITurn(), 350);
        }
    }

    updateCheckWarning() {
        const king = this.board.findKing(TEAMS.PLAYER);
        if (king && this.combatManager.isKingInCheck(TEAMS.PLAYER)) {
            this.boardRenderer.checkSquare = { col: king.col, row: king.row };
            this.showStatus('Your king is in danger!');
        } else {
            this.boardRenderer.checkSquare = null;
        }
    }

    doAITurn() {
        if (this.gameOver) return;
        if (this.combatManager.turnManager.isPlayerTurn) return;

        // Boss phase check
        if (this.bossAI) {
            this.bossAI.checkPhaseTransition();
        }

        const result = this.bossAI
            ? this.bossAI.getBestMove()
            : this.combatManager.getAIMove();

        if (result) {
            this.startMoveAnimation(result.piece, result.move);
        } else {
            this.combatManager.endTurn();
            this.turnCount = this.combatManager.turnManager.turnNumber;
            this.showStatus('Your move');
            this.updateCheckWarning();
        }
    }

    onCombatFinished() {
        const isWin = this.winner === TEAMS.PLAYER;
        const survivingPlayerPieces = this.board.getTeamPieces(TEAMS.PLAYER);

        if (this.runManager && this.runManager.isActive) {
            this.eventBus.emit('combatFinished', {
                victory: isWin,
                goldEarned: this.combatManager.goldEarned,
                capturedByPlayer: this.combatManager.capturedByPlayer,
                capturedByEnemy: this.combatManager.capturedByEnemy,
                survivingPlayerPieces,
                turns: this.turnCount,
                isElite: this.encounterParams?.isElite || false,
            });
        } else {
            // No active run — go to main menu
            this.stateMachine.change('mainMenu');
        }
    }

    shakeScreen(intensity) {
        this.screenShake.intensity = intensity;
    }

    showStatus(msg) {
        this.statusMessage = msg;
        this.statusTimer = 2.5;
    }

    handlePromotionClick(data) {
        const piece = this.pendingPromotion;
        if (!piece) return;

        const btnW = 70;
        const btnH = 70;
        const gap = 10;
        const totalW = this.promotionChoices.length * (btnW + gap) - gap;
        const startX = (this.renderer.width - totalW) / 2;
        const y = this.renderer.height / 2 - btnH / 2;

        for (let i = 0; i < this.promotionChoices.length; i++) {
            const bx = startX + i * (btnW + gap);
            if (data.x >= bx && data.x <= bx + btnW && data.y >= y && data.y <= y + btnH) {
                this.combatManager.promotePiece(piece, this.promotionChoices[i]);
                this.pendingPromotion = null;
                this.showStatus(`Promoted to ${this.promotionChoices[i]}!`);
                const pos = this.boardRenderer.boardToScreen(piece.col, piece.row);
                const ts = this.boardRenderer.tileSize;
                this.floatingText.add(pos.x + ts / 2, pos.y, 'Promoted!', UI_COLORS.gold, 1000, 18);

                // Recruitment Scroll relic: spawn a pawn after promotion
                if (this.combatManager.hasRelic('extraPieceOnPromote')) {
                    this.spawnPawnNear(piece.col, piece.row, piece.team);
                }

                this.afterMove();
                return;
            }
        }
    }

    spawnPawnNear(col, row, team) {
        for (const [dc, dr] of [[0,1],[0,-1],[-1,0],[1,0],[-1,1],[1,1],[-1,-1],[1,-1]]) {
            const nc = col + dc;
            const nr = row + dr;
            if (nc >= 0 && nc < this.board.cols && nr >= 0 && nr < this.board.rows) {
                const tile = this.board.getTile(nc, nr);
                if (tile && tile.isEmpty() && tile.isPassable()) {
                    const pawn = new Piece(PIECE_TYPES.PAWN, team, nc, nr);
                    this.board.placePiece(pawn, nc, nr);
                    const pos = this.boardRenderer.boardToScreen(nc, nr);
                    const ts = this.boardRenderer.tileSize;
                    this.floatingText.add(pos.x + ts / 2, pos.y, '+Pawn', UI_COLORS.success, 1000, 14);
                    return;
                }
            }
        }
    }

    handleQueenSplit(data) {
        const queen = data.queen;
        const { col, row } = queen;
        const adjacent = [];
        for (const [dc, dr] of [[-1,0],[1,0],[0,-1],[0,1],[-1,-1],[1,-1],[-1,1],[1,1]]) {
            const nc = col + dc;
            const nr = row + dr;
            if (nc >= 0 && nc < this.board.cols && nr >= 0 && nr < this.board.rows) {
                const tile = this.board.getTile(nc, nr);
                if (tile && tile.isEmpty() && tile.isPassable()) {
                    adjacent.push({ col: nc, row: nr });
                }
            }
        }

        let spawned = 0;
        const spawnTypes = [PIECE_TYPES.BISHOP, PIECE_TYPES.ROOK];
        for (let i = 0; i < spawnTypes.length && i < adjacent.length; i++) {
            const sq = adjacent[i];
            const piece = new Piece(spawnTypes[i], queen.team, sq.col, sq.row);
            this.board.placePiece(piece, sq.col, sq.row);
            spawned++;
        }

        if (spawned > 0) {
            const pos = this.boardRenderer.boardToScreen(col, row);
            const ts = this.boardRenderer.tileSize;
            this.floatingText.add(pos.x + ts / 2, pos.y, 'Queen splits!', UI_COLORS.gold, 1200, 16);
            this.shakeScreen(6);
        }
    }

    update(dt) {
        if (this.statusTimer > 0) this.statusTimer -= dt;
        if (this.bossPhaseTimer > 0) this.bossPhaseTimer -= dt;

        this.floatingText.update(dt);
        this.animManager.update(dt);

        // Screen shake
        if (this.screenShake.intensity > 0.1) {
            this.screenShake.x = (Math.random() - 0.5) * this.screenShake.intensity * 2;
            this.screenShake.y = (Math.random() - 0.5) * this.screenShake.intensity * 2;
            this.screenShake.intensity *= this.screenShake.decay;
        } else {
            this.screenShake.x = 0;
            this.screenShake.y = 0;
            this.screenShake.intensity = 0;
        }

        if (this.animatingMove) {
            this.animatingMove.progress += (dt * 1000) / this.animatingMove.duration;
            if (this.animatingMove.progress >= 1) {
                const anim = this.animatingMove;
                this.animatingMove = null;
                this.finishMove(anim);
            }
        }
    }

    render(ctx) {
        if (!this.boardRenderer) return;

        ctx.save();
        ctx.translate(this.screenShake.x, this.screenShake.y);

        const animatingPieces = new Set();
        if (this.animatingMove) {
            animatingPieces.add(this.animatingMove.piece.id);
        }

        this.boardRenderer.render(ctx, animatingPieces);

        // Animating piece
        if (this.animatingMove) {
            const anim = this.animatingMove;
            const from = this.boardRenderer.boardToScreen(anim.fromCol, anim.fromRow);
            const to = this.boardRenderer.boardToScreen(anim.toCol, anim.toRow);
            const t = easeOutCubic(anim.progress);
            const x = from.x + (to.x - from.x) * t;
            const y = from.y + (to.y - from.y) * t;
            PieceRenderer.draw(ctx, anim.piece, x, y, this.boardRenderer.tileSize);
        }

        ctx.restore();

        this.floatingText.render(ctx);
        this.drawUI(ctx);

        if (this.bossPhaseTimer > 0) this.drawBossPhase(ctx);
        if (this.pendingPromotion) this.drawPromotionUI(ctx);
        if (this.gameOver) this.drawGameOverOverlay(ctx);
    }

    drawUI(ctx) {
        const tm = this.combatManager ? this.combatManager.turnManager : null;
        const turnNum = tm ? Math.floor(tm.turnNumber / 2) + 1 : 1;
        const isPlayerTurn = tm ? tm.isPlayerTurn : true;

        // Top bar
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(0, 0, this.renderer.width, 44);

        ctx.font = '14px monospace';
        ctx.fillStyle = UI_COLORS.textDim;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(`Turn ${turnNum}`, 16, 22);

        // Turn indicator
        ctx.fillStyle = isPlayerTurn ? UI_COLORS.success : UI_COLORS.danger;
        ctx.font = 'bold 14px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(isPlayerTurn ? 'YOUR TURN' : 'ENEMY TURN', this.renderer.width / 2, 22);

        // Gold
        if (this.combatManager) {
            ctx.fillStyle = UI_COLORS.gold;
            ctx.font = '14px monospace';
            ctx.textAlign = 'right';
            ctx.fillText(`Gold: ${this.combatManager.goldEarned}`, this.renderer.width - 16, 22);
        }

        // Status message
        if (this.statusTimer > 0 && this.statusMessage) {
            const alpha = Math.min(1, this.statusTimer);
            ctx.globalAlpha = alpha;
            ctx.font = 'bold 16px monospace';
            ctx.fillStyle = UI_COLORS.accent;
            ctx.textAlign = 'center';
            ctx.fillText(this.statusMessage, this.renderer.width / 2, 62);
            ctx.globalAlpha = 1;
        }

        // Captured pieces
        this.drawCapturedPieces(ctx);
    }

    drawCapturedPieces(ctx) {
        const size = 22;
        const spacing = 24;
        const y = this.renderer.height - 36;

        if (this.capturedByPlayer.length > 0) {
            ctx.font = '11px monospace';
            ctx.fillStyle = UI_COLORS.textDim;
            ctx.textAlign = 'left';
            ctx.fillText('Captured:', 12, y - 4);
            for (let i = 0; i < this.capturedByPlayer.length; i++) {
                PieceRenderer.draw(ctx, this.capturedByPlayer[i], 12 + i * spacing, y, size);
            }
        }
    }

    drawPromotionUI(ctx) {
        ctx.fillStyle = 'rgba(0,0,0,0.65)';
        ctx.fillRect(0, 0, this.renderer.width, this.renderer.height);

        ctx.font = 'bold 22px monospace';
        ctx.fillStyle = UI_COLORS.text;
        ctx.textAlign = 'center';
        ctx.fillText('Choose Promotion', this.renderer.width / 2, this.renderer.height / 2 - 65);

        const btnW = 70;
        const btnH = 70;
        const gap = 10;
        const totalW = this.promotionChoices.length * (btnW + gap) - gap;
        const startX = (this.renderer.width - totalW) / 2;
        const y = this.renderer.height / 2 - btnH / 2;

        for (let i = 0; i < this.promotionChoices.length; i++) {
            const bx = startX + i * (btnW + gap);
            ctx.fillStyle = UI_COLORS.panel;
            ctx.fillRect(bx, y, btnW, btnH);
            ctx.strokeStyle = UI_COLORS.panelBorder;
            ctx.lineWidth = 2;
            ctx.strokeRect(bx, y, btnW, btnH);

            const tempPiece = new Piece(this.promotionChoices[i], this.pendingPromotion.team);
            PieceRenderer.draw(ctx, tempPiece, bx + 3, y + 3, btnW - 6);

            ctx.font = '10px monospace';
            ctx.fillStyle = UI_COLORS.textDim;
            ctx.textAlign = 'center';
            ctx.fillText(this.promotionChoices[i], bx + btnW / 2, y + btnH + 14);
        }
    }

    drawBossPhase(ctx) {
        const alpha = Math.min(1, this.bossPhaseTimer * 0.8);
        ctx.globalAlpha = alpha;
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(0, this.renderer.height / 2 - 30, this.renderer.width, 60);
        ctx.font = 'bold 22px monospace';
        ctx.fillStyle = UI_COLORS.danger;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(this.bossPhaseMessage, this.renderer.width / 2, this.renderer.height / 2);
        ctx.globalAlpha = 1;
    }

    drawGameOverOverlay(ctx) {
        ctx.fillStyle = 'rgba(0,0,0,0.75)';
        ctx.fillRect(0, 0, this.renderer.width, this.renderer.height);

        const isWin = this.winner === TEAMS.PLAYER;

        ctx.font = 'bold 52px monospace';
        ctx.fillStyle = isWin ? UI_COLORS.success : UI_COLORS.danger;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(isWin ? 'VICTORY' : 'DEFEAT', this.renderer.width / 2, this.renderer.height / 2 - 50);

        ctx.font = '18px monospace';
        ctx.fillStyle = UI_COLORS.text;
        ctx.fillText(
            `Turns: ${Math.floor(this.turnCount / 2)}  |  Captured: ${this.capturedByPlayer.length}  |  Gold: ${this.combatManager ? this.combatManager.goldEarned : 0}`,
            this.renderer.width / 2, this.renderer.height / 2 + 10
        );

        ctx.font = '14px monospace';
        ctx.fillStyle = UI_COLORS.textDim;
        ctx.fillText('Click to continue', this.renderer.width / 2, this.renderer.height / 2 + 50);
    }
}

function easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
}
