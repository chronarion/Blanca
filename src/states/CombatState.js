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
import { UITheme } from '../ui/UITheme.js';

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

        // Deployment phase
        this.deployPhase = false;
        this.deployAvailable = true;
        this.deploySelectedPiece = null;
        this.deployHoverReady = false;
        this.deployHoverEnter = false;
        this.deployTime = 0;
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
                    if (!pawn.hasModifier('firstTurnShield')) {
                        pawn.addModifier({ id: 'firstTurnShield', category: 'defense', rarity: 'common', name: 'Opening Guard', shortDescription: 'Immune turns 1-2' });
                    }
                }
            }
        }

        this.deployPhase = false;
        this.deployAvailable = true;
        this.deploySelectedPiece = null;
        this.deployHoverReady = false;
        this.deployHoverEnter = false;
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

        if (this.gameOver) {
            this.onCombatFinished();
            return;
        }

        if (this.deployPhase) {
            this.handleDeployClick(data);
            return;
        }

        if (this.pendingPromotion) {
            this.handlePromotionClick(data);
            return;
        }

        if (!this.combatManager.turnManager.isPlayerTurn) return;

        // Check deploy enter button
        if (this.deployAvailable) {
            const dbtn = this.getDeployEnterButton();
            if (data.x >= dbtn.x && data.x <= dbtn.x + dbtn.w &&
                data.y >= dbtn.y && data.y <= dbtn.y + dbtn.h) {
                this.enterDeploy();
                return;
            }
        }

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

        if (this.deployPhase) {
            const btn = this.getReadyButton();
            this.deployHoverReady = (
                data.x >= btn.x && data.x <= btn.x + btn.w &&
                data.y >= btn.y && data.y <= btn.y + btn.h
            );
        }

        if (this.deployAvailable && !this.deployPhase) {
            const dbtn = this.getDeployEnterButton();
            this.deployHoverEnter = (
                data.x >= dbtn.x && data.x <= dbtn.x + dbtn.w &&
                data.y >= dbtn.y && data.y <= dbtn.y + dbtn.h
            );
        }
    }

    handleKey(data) {
        if (this.deployPhase) {
            if (data.code === 'Enter' || data.code === 'Space') {
                this.finishDeploy();
            } else if (data.code === 'Escape') {
                this.deploySelectedPiece = null;
                this.boardRenderer.selectedPiece = null;
            }
            return;
        }
        if (data.code === 'Escape') {
            if (this.pendingPromotion) return;
            if (this.selectedPiece) {
                this.deselect();
            } else if (this.stateMachine.states.has('pause')) {
                this.stateMachine.push('pause');
            }
        }
        if ((data.code === 'KeyD') && this.deployAvailable && !this.deployPhase &&
            !this.animatingMove && this.combatManager.turnManager.isPlayerTurn) {
            this.enterDeploy();
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

    // --- Deployment phase ---

    getDeployRows() {
        // Player's bottom two rows
        return [this.board.rows - 1, this.board.rows - 2];
    }

    isDeployZone(col, row) {
        const rows = this.getDeployRows();
        return rows.includes(row) && col >= 0 && col < this.board.cols;
    }

    handleDeployClick(data) {
        // Check Ready button
        const btn = this.getReadyButton();
        if (data.x >= btn.x && data.x <= btn.x + btn.w &&
            data.y >= btn.y && data.y <= btn.y + btn.h) {
            this.finishDeploy();
            return;
        }

        const pos = this.boardRenderer.screenToBoard(data.x, data.y);
        if (!pos) return;

        const clickedPiece = this.board.getPieceAt(pos.col, pos.row);

        if (this.deploySelectedPiece) {
            // Click on same piece: deselect
            if (clickedPiece === this.deploySelectedPiece) {
                this.deploySelectedPiece = null;
                this.boardRenderer.selectedPiece = null;
                return;
            }

            // Click on another player piece: swap
            if (clickedPiece && clickedPiece.team === TEAMS.PLAYER) {
                this.swapPiecePositions(this.deploySelectedPiece, clickedPiece);
                this.deploySelectedPiece = null;
                this.boardRenderer.selectedPiece = null;
                return;
            }

            // Click on empty tile in deploy zone: move piece there
            if (!clickedPiece && this.isDeployZone(pos.col, pos.row)) {
                const tile = this.board.getTile(pos.col, pos.row);
                if (tile && tile.isEmpty() && tile.isPassable()) {
                    const fromTile = this.board.getTile(this.deploySelectedPiece.col, this.deploySelectedPiece.row);
                    fromTile.removePiece();
                    tile.setPiece(this.deploySelectedPiece);
                    this.deploySelectedPiece = null;
                    this.boardRenderer.selectedPiece = null;
                    return;
                }
            }

            // Click elsewhere: deselect
            this.deploySelectedPiece = null;
            this.boardRenderer.selectedPiece = null;
        } else {
            // No selection: pick a player piece
            if (clickedPiece && clickedPiece.team === TEAMS.PLAYER) {
                this.deploySelectedPiece = clickedPiece;
                this.boardRenderer.selectedPiece = clickedPiece;
            }
        }
    }

    swapPiecePositions(a, b) {
        const tileA = this.board.getTile(a.col, a.row);
        const tileB = this.board.getTile(b.col, b.row);
        tileA.removePiece();
        tileB.removePiece();
        tileA.setPiece(b);
        tileB.setPiece(a);
    }

    getReadyButton() {
        const ts = this.boardRenderer.tileSize;
        const bw = this.board.cols * ts;
        const bx = this.boardRenderer.offsetX;
        const by = this.boardRenderer.offsetY + this.board.rows * ts;
        return {
            x: bx + bw / 2 - 70,
            y: by + 22,
            w: 140,
            h: 40,
        };
    }

    getDeployEnterButton() {
        const w = this.renderer.width;
        return { x: w - 90, y: 6, w: 74, h: 26 };
    }

    enterDeploy() {
        this.deployPhase = true;
        this.deploySelectedPiece = null;
        this.deployHoverReady = false;
        this.deployTime = 0;
        this.showStatus('Deploy your pieces');
    }

    finishDeploy() {
        this.deployPhase = false;
        this.deploySelectedPiece = null;
        this.deployHoverReady = false;
        this.boardRenderer.selectedPiece = null;
        this.showStatus('Your move');
    }

    // Drawn inside the screen-shake transform, on top of the board tiles+pieces
    drawDeployOverlay(ctx) {
        const ts = this.boardRenderer.tileSize;
        const ox = this.boardRenderer.offsetX;
        const oy = this.boardRenderer.offsetY;
        const bw = this.board.cols * ts;
        const bh = this.board.rows * ts;
        const deployRows = this.getDeployRows();
        const deployTopRow = Math.min(...deployRows);

        // --- Darken everything above the deploy zone ---
        const dzY = oy + deployTopRow * ts;
        ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
        ctx.fillRect(ox, oy, bw, dzY - oy);

        // --- Tint deploy zone with warm gold ---
        const pulse = 0.04 + Math.sin(this.deployTime * 2.5) * 0.02;
        ctx.fillStyle = `rgba(200, 168, 78, ${pulse})`;
        ctx.fillRect(ox, dzY, bw, bh - (dzY - oy));

        // --- Pulsing gold border around deploy zone ---
        const borderAlpha = 0.35 + Math.sin(this.deployTime * 3) * 0.2;
        ctx.save();
        ctx.strokeStyle = `rgba(200, 168, 78, ${borderAlpha})`;
        ctx.lineWidth = 3;
        ctx.setLineDash([8, 4]);
        ctx.strokeRect(ox + 1, dzY, bw - 2, bh - (dzY - oy) - 1);
        ctx.setLineDash([]);
        ctx.restore();

        // --- "DEPLOY ZONE" label at the border ---
        ctx.save();
        ctx.font = 'bold 10px monospace';
        ctx.fillStyle = `rgba(200, 168, 78, ${0.5 + Math.sin(this.deployTime * 3) * 0.2})`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillText('DEPLOY ZONE', ox + bw / 2, dzY - 4);
        ctx.restore();

        // --- Highlight empty deploy zone squares when a piece is selected ---
        if (this.deploySelectedPiece) {
            for (const row of deployRows) {
                for (let col = 0; col < this.board.cols; col++) {
                    const tile = this.board.getTile(col, row);
                    if (tile && tile.isEmpty() && tile.isPassable()) {
                        const pos = this.boardRenderer.boardToScreen(col, row);
                        ctx.fillStyle = `rgba(200, 168, 78, ${0.08 + Math.sin(this.deployTime * 3) * 0.04})`;
                        ctx.fillRect(pos.x, pos.y, ts, ts);
                        // Small dot in center
                        ctx.fillStyle = `rgba(200, 168, 78, 0.35)`;
                        ctx.beginPath();
                        ctx.arc(pos.x + ts / 2, pos.y + ts / 2, ts * 0.12, 0, Math.PI * 2);
                        ctx.fill();
                    }
                }
            }
        }

        // --- Gold corner brackets on each player piece ---
        const playerPieces = this.board.getTeamPieces(TEAMS.PLAYER);
        for (const piece of playerPieces) {
            const pos = this.boardRenderer.boardToScreen(piece.col, piece.row);
            const m = 3;
            const s = 7;
            const isSelected = piece === this.deploySelectedPiece;
            ctx.strokeStyle = isSelected ? '#fff' : UI_COLORS.gold;
            ctx.lineWidth = isSelected ? 2 : 1.5;
            // top-left
            ctx.beginPath();
            ctx.moveTo(pos.x + m, pos.y + m + s);
            ctx.lineTo(pos.x + m, pos.y + m);
            ctx.lineTo(pos.x + m + s, pos.y + m);
            ctx.stroke();
            // top-right
            ctx.beginPath();
            ctx.moveTo(pos.x + ts - m - s, pos.y + m);
            ctx.lineTo(pos.x + ts - m, pos.y + m);
            ctx.lineTo(pos.x + ts - m, pos.y + m + s);
            ctx.stroke();
            // bottom-left
            ctx.beginPath();
            ctx.moveTo(pos.x + m, pos.y + ts - m - s);
            ctx.lineTo(pos.x + m, pos.y + ts - m);
            ctx.lineTo(pos.x + m + s, pos.y + ts - m);
            ctx.stroke();
            // bottom-right
            ctx.beginPath();
            ctx.moveTo(pos.x + ts - m - s, pos.y + ts - m);
            ctx.lineTo(pos.x + ts - m, pos.y + ts - m);
            ctx.lineTo(pos.x + ts - m, pos.y + ts - m - s);
            ctx.stroke();

            // Selected piece: full glowing border
            if (isSelected) {
                ctx.save();
                ctx.shadowColor = UI_COLORS.gold;
                ctx.shadowBlur = 10;
                ctx.strokeStyle = UI_COLORS.gold;
                ctx.lineWidth = 2;
                ctx.strokeRect(pos.x + 1, pos.y + 1, ts - 2, ts - 2);
                ctx.restore();
            }
        }
    }

    // Drawn outside screen-shake, on top of the HUD
    drawDeployChrome(ctx) {
        const w = this.renderer.width;
        const h = this.renderer.height;
        const ts = this.boardRenderer.tileSize;
        const ox = this.boardRenderer.offsetX;
        const oy = this.boardRenderer.offsetY;
        const bw = this.board.cols * ts;
        const bh = this.board.rows * ts;

        // --- Top banner ---
        const bannerH = 48;
        const bannerGrad = ctx.createLinearGradient(0, 0, 0, bannerH);
        bannerGrad.addColorStop(0, 'rgba(40, 32, 10, 0.95)');
        bannerGrad.addColorStop(0.7, 'rgba(40, 32, 10, 0.85)');
        bannerGrad.addColorStop(1, 'rgba(40, 32, 10, 0)');
        ctx.fillStyle = bannerGrad;
        ctx.fillRect(0, 0, w, bannerH);

        // Gold accent line at bottom of banner
        const lineAlpha = 0.4 + Math.sin(this.deployTime * 3) * 0.15;
        ctx.strokeStyle = `rgba(200, 168, 78, ${lineAlpha})`;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(w * 0.15, bannerH - 2);
        ctx.lineTo(w * 0.85, bannerH - 2);
        ctx.stroke();

        // "DEPLOY PHASE" title
        ctx.save();
        ctx.font = `bold 20px Georgia, 'Times New Roman', serif`;
        ctx.fillStyle = UI_COLORS.gold;
        ctx.shadowColor = 'rgba(200, 168, 78, 0.5)';
        ctx.shadowBlur = 12;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('DEPLOY PHASE', w / 2, 22);
        ctx.restore();

        // --- Instruction text below board ---
        const instrY = oy + bh + 6;
        ctx.font = '11px monospace';
        ctx.fillStyle = UI_COLORS.textDim;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        if (this.deploySelectedPiece) {
            ctx.fillStyle = UI_COLORS.gold;
            ctx.fillText('Click another piece to swap, or click empty to cancel', w / 2, instrY);
        } else {
            ctx.fillText('Click a piece to select, then click another to swap positions', w / 2, instrY);
        }

        // --- Ready button (larger, more prominent) ---
        const btn = this.getReadyButton();
        // Glow behind button
        ctx.save();
        ctx.shadowColor = UI_COLORS.gold;
        ctx.shadowBlur = this.deployHoverReady ? 16 : 8;
        ctx.beginPath();
        UITheme.roundRect(ctx, btn.x, btn.y, btn.w, btn.h, 6);
        ctx.fillStyle = 'rgba(0,0,0,0.01)';
        ctx.fill();
        ctx.restore();

        UITheme.drawButton(ctx, btn.x, btn.y, btn.w, btn.h, 'READY', this.deployHoverReady, {
            fontSize: 15,
            hoverColor: 'rgba(200, 168, 78, 0.3)',
        });

        // Keyboard hint
        ctx.font = '9px monospace';
        ctx.fillStyle = UI_COLORS.textDim;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillText('Enter / Space', btn.x + btn.w / 2, btn.y + btn.h + 4);
    }

    startMoveAnimation(piece, move) {
        this.deployAvailable = false;
        this.deselect();
        this.animatingMove = {
            piece,
            fromCol: piece.col, fromRow: piece.row,
            toCol: move.col, toRow: move.row,
            progress: 0,
            duration: ANIMATION.moveDuration,
            moveType: move.type,
            moveData: move,
        };
    }

    finishMove(anim) {
        const result = this.combatManager.executeMove(anim.piece, anim.toCol, anim.toRow, anim.moveData);
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
        if (this.deployPhase) this.deployTime += dt;
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

        if (this.deployPhase) this.drawDeployOverlay(ctx);

        ctx.restore();

        this.floatingText.render(ctx);
        this.drawUI(ctx);

        if (this.deployPhase) this.drawDeployChrome(ctx);
        if (this.bossPhaseTimer > 0) this.drawBossPhase(ctx);
        if (this.pendingPromotion) this.drawPromotionUI(ctx);
        if (this.gameOver) this.drawGameOverOverlay(ctx);
    }

    drawUI(ctx) {
        const tm = this.combatManager ? this.combatManager.turnManager : null;
        const turnNum = tm ? Math.floor(tm.turnNumber / 2) + 1 : 1;
        const isPlayerTurn = tm ? tm.isPlayerTurn : true;
        const w = this.renderer.width;

        // Top bar with gradient
        const barGrad = ctx.createLinearGradient(0, 0, 0, 40);
        barGrad.addColorStop(0, 'rgba(9,9,13,0.85)');
        barGrad.addColorStop(1, 'rgba(9,9,13,0)');
        ctx.fillStyle = barGrad;
        ctx.fillRect(0, 0, w, 40);

        // Turn number
        ctx.font = '12px monospace';
        ctx.fillStyle = UI_COLORS.textDim;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(`Turn ${turnNum}`, 16, 20);

        // Turn indicator
        ctx.font = 'bold 13px monospace';
        ctx.textAlign = 'center';
        if (this.deployPhase) {
            // Banner drawn by drawDeployChrome
        } else if (isPlayerTurn) {
            ctx.fillStyle = UI_COLORS.accent;
            ctx.fillText('YOUR TURN', w / 2, 20);
        } else {
            ctx.fillStyle = UI_COLORS.danger;
            ctx.fillText('ENEMY TURN', w / 2, 20);
        }

        // Gold
        if (this.combatManager) {
            ctx.fillStyle = UI_COLORS.gold;
            ctx.font = '12px monospace';
            ctx.textAlign = 'right';
            const goldX = (this.deployAvailable && !this.deployPhase) ? w - 100 : w - 16;
            ctx.fillText(`${this.combatManager.goldEarned}g`, goldX, 20);
        }

        // Deploy enter button (shown when deploy is available but not active)
        if (this.deployAvailable && !this.deployPhase && isPlayerTurn) {
            const dbtn = this.getDeployEnterButton();
            UITheme.drawButton(ctx, dbtn.x, dbtn.y, dbtn.w, dbtn.h, 'Deploy', this.deployHoverEnter, {
                fontSize: 11,
                hoverColor: 'rgba(200, 168, 78, 0.2)',
            });
        }

        // Status message
        if (this.statusTimer > 0 && this.statusMessage) {
            const alpha = Math.min(1, this.statusTimer);
            ctx.globalAlpha = alpha;
            ctx.font = 'bold 14px monospace';
            ctx.fillStyle = UI_COLORS.accent;
            ctx.textAlign = 'center';
            ctx.fillText(this.statusMessage, w / 2, 54);
            ctx.globalAlpha = 1;
        }

        this.drawCapturedPieces(ctx);
    }

    drawCapturedPieces(ctx) {
        const size = 20;
        const spacing = 22;
        const y = this.renderer.height - 32;

        if (this.capturedByPlayer.length > 0) {
            ctx.font = '10px monospace';
            ctx.fillStyle = UI_COLORS.textDim;
            ctx.textAlign = 'left';
            ctx.textBaseline = 'middle';
            ctx.fillText('Captured:', 12, y - 2);
            for (let i = 0; i < this.capturedByPlayer.length; i++) {
                PieceRenderer.draw(ctx, this.capturedByPlayer[i], 12 + i * spacing, y + 4, size);
            }
        }
    }

    drawPromotionUI(ctx) {
        ctx.fillStyle = 'rgba(0,0,0,0.7)';
        ctx.fillRect(0, 0, this.renderer.width, this.renderer.height);

        const w = this.renderer.width;
        const h = this.renderer.height;

        UITheme.drawTitle(ctx, 'Promote', w / 2, h / 2 - 68, 24);

        const btnW = 70;
        const btnH = 70;
        const gap = 12;
        const totalW = this.promotionChoices.length * (btnW + gap) - gap;
        const startX = (w - totalW) / 2;
        const y = h / 2 - btnH / 2;

        for (let i = 0; i < this.promotionChoices.length; i++) {
            const bx = startX + i * (btnW + gap);
            UITheme.drawPanel(ctx, bx, y, btnW, btnH, { radius: 6, shadow: false });

            const tempPiece = new Piece(this.promotionChoices[i], this.pendingPromotion.team);
            PieceRenderer.draw(ctx, tempPiece, bx + 5, y + 5, btnW - 10);

            ctx.font = '10px monospace';
            ctx.fillStyle = UI_COLORS.textDim;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'top';
            ctx.fillText(this.promotionChoices[i], bx + btnW / 2, y + btnH + 8);
        }
    }

    drawBossPhase(ctx) {
        const alpha = Math.min(1, this.bossPhaseTimer * 0.8);
        ctx.globalAlpha = alpha;
        const w = this.renderer.width;
        const h = this.renderer.height;

        const barGrad = ctx.createLinearGradient(0, h / 2 - 30, 0, h / 2 + 30);
        barGrad.addColorStop(0, 'rgba(60,10,15,0.7)');
        barGrad.addColorStop(0.5, 'rgba(60,10,15,0.9)');
        barGrad.addColorStop(1, 'rgba(60,10,15,0.7)');
        ctx.fillStyle = barGrad;
        ctx.fillRect(0, h / 2 - 30, w, 60);

        ctx.font = `bold 22px Georgia, serif`;
        ctx.fillStyle = UI_COLORS.danger;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(this.bossPhaseMessage, w / 2, h / 2);
        ctx.globalAlpha = 1;
    }

    drawGameOverOverlay(ctx) {
        ctx.fillStyle = 'rgba(0,0,0,0.8)';
        ctx.fillRect(0, 0, this.renderer.width, this.renderer.height);

        const w = this.renderer.width;
        const h = this.renderer.height;
        const isWin = this.winner === TEAMS.PLAYER;

        if (isWin) {
            UITheme.drawTitle(ctx, 'VICTORY', w / 2, h / 2 - 50, 48);
        } else {
            ctx.save();
            ctx.font = `bold 48px Georgia, 'Times New Roman', serif`;
            ctx.fillStyle = UI_COLORS.danger;
            ctx.shadowColor = 'rgba(192, 64, 80, 0.4)';
            ctx.shadowBlur = 20;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('DEFEAT', w / 2, h / 2 - 50);
            ctx.restore();
        }

        ctx.font = '15px monospace';
        ctx.fillStyle = UI_COLORS.text;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(
            `Turns: ${Math.floor(this.turnCount / 2)}  |  Captured: ${this.capturedByPlayer.length}  |  Gold: ${this.combatManager ? this.combatManager.goldEarned : 0}`,
            w / 2, h / 2 + 10
        );

        ctx.font = '12px monospace';
        ctx.fillStyle = UI_COLORS.textDim;
        ctx.fillText('Click to continue', w / 2, h / 2 + 45);
    }
}

function easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
}
