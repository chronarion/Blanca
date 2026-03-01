import { UI_COLORS, PIECE_TYPES, TEAMS } from '../data/Constants.js';
import { UITheme } from '../ui/UITheme.js';
import { Button } from '../ui/Button.js';
import { PieceSetLoader, PIECE_SETS } from '../render/PieceSetLoader.js';
import { PieceRenderer } from '../render/PieceRenderer.js';
import { Piece } from '../pieces/Piece.js';

const DISPLAY_NAMES = {
    original: 'Original',
    alpha: 'Alpha', anarcandy: 'Anarcandy', caliente: 'Caliente',
    california: 'California', cardinal: 'Cardinal', cburnett: 'Cburnett',
    celtic: 'Celtic', chess7: 'Chess7', chessnut: 'Chessnut',
    companion: 'Companion', cooke: 'Cooke', disguised: 'Disguised',
    dubrovny: 'Dubrovny', fantasy: 'Fantasy', fresca: 'Fresca',
    gioco: 'Gioco', governor: 'Governor', horsey: 'Horsey',
    icpieces: 'ICPieces', kosal: 'Kosal', leipzig: 'Leipzig',
    letter: 'Letter', maestro: 'Maestro', merida: 'Merida',
    monarchy: 'Monarchy', mono: 'Mono', mpchess: 'MPChess',
    pirouetti: 'Pirouetti', pixel: 'Pixel', reillycraig: 'Reillycraig',
    riohacha: 'Riohacha', shapes: 'Shapes', spatial: 'Spatial',
    staunty: 'Staunty', tatiana: 'Tatiana',
};

// Preview piece types
const PREVIEW_TYPES = [
    PIECE_TYPES.KING, PIECE_TYPES.QUEEN, PIECE_TYPES.ROOK,
    PIECE_TYPES.BISHOP, PIECE_TYPES.KNIGHT, PIECE_TYPES.PAWN,
];

export class SettingsState {
    constructor() {
        this.stateMachine = null;
        this.eventBus = null;
        this.renderer = null;

        this.buttons = [];
        this.clickHandler = null;
        this.moveHandler = null;
        this.keyHandler = null;

        this.selectedIndex = 0;
        this.scrollOffset = 0;
        this.hoverIndex = -1;
    }

    enter() {
        // Find current set index
        const current = PieceSetLoader.getCurrentSet();
        this.selectedIndex = PIECE_SETS.indexOf(current);
        if (this.selectedIndex === -1) this.selectedIndex = 0;
        this.scrollOffset = 0;
        this.hoverIndex = -1;

        this.createButtons();

        // Preload neighboring sets
        this.preloadNearby();

        this.clickHandler = (data) => {
            for (const btn of this.buttons) btn.handleClick(data.x, data.y);
            this.handleListClick(data);
        };
        this.moveHandler = (data) => {
            for (const btn of this.buttons) btn.handleMove(data.x, data.y);
            this.handleListMove(data);
        };
        this.keyHandler = (data) => {
            if (data.code === 'Escape') this.stateMachine.change('mainMenu');
            else if (data.code === 'ArrowUp') this.navigate(-1);
            else if (data.code === 'ArrowDown') this.navigate(1);
            else if (data.code === 'Enter') this.selectSet(this.selectedIndex);
        };
        this.wheelHandler = (data) => {
            const { listH, itemH } = this.getListBounds();
            const maxVisible = Math.floor(listH / itemH);
            const maxScroll = Math.max(0, PIECE_SETS.length - maxVisible);
            if (data.deltaY > 0) {
                this.scrollOffset = Math.min(maxScroll, this.scrollOffset + 3);
            } else if (data.deltaY < 0) {
                this.scrollOffset = Math.max(0, this.scrollOffset - 3);
            }
        };
        this.eventBus.on('click', this.clickHandler);
        this.eventBus.on('mousemove', this.moveHandler);
        this.eventBus.on('keydown', this.keyHandler);
        this.eventBus.on('wheel', this.wheelHandler);
    }

    exit() {
        if (this.clickHandler) this.eventBus.off('click', this.clickHandler);
        if (this.moveHandler) this.eventBus.off('mousemove', this.moveHandler);
        if (this.keyHandler) this.eventBus.off('keydown', this.keyHandler);
        if (this.wheelHandler) this.eventBus.off('wheel', this.wheelHandler);
    }

    createButtons() {
        const w = this.renderer.width;
        const h = this.renderer.height;
        const btnW = 180;
        const btnH = 42;
        const x = (w - btnW) / 2;

        this.buttons = [
            new Button(x, h - 60, btnW, btnH, 'Back', {
                onClick: () => this.stateMachine.change('mainMenu'),
            }),
        ];
    }

    getListBounds() {
        const w = this.renderer.width;
        const h = this.renderer.height;
        const listW = Math.min(200, w * 0.35);
        const listX = 20;
        const listY = 100;
        const listH = h - 180;
        const itemH = 28;
        return { listX, listY, listW, listH, itemH };
    }

    getPreviewBounds() {
        const w = this.renderer.width;
        const h = this.renderer.height;
        const { listX, listW } = this.getListBounds();
        const previewX = listX + listW + 20;
        const previewW = w - previewX - 20;
        const previewY = 100;
        const previewH = h - 180;
        return { previewX, previewY, previewW, previewH };
    }

    navigate(dir) {
        this.selectedIndex = Math.max(0, Math.min(PIECE_SETS.length - 1, this.selectedIndex + dir));
        this.selectSet(this.selectedIndex);
        this.ensureVisible();
    }

    ensureVisible() {
        const { listH, itemH } = this.getListBounds();
        const maxVisible = Math.floor(listH / itemH);
        if (this.selectedIndex < this.scrollOffset) {
            this.scrollOffset = this.selectedIndex;
        } else if (this.selectedIndex >= this.scrollOffset + maxVisible) {
            this.scrollOffset = this.selectedIndex - maxVisible + 1;
        }
    }

    selectSet(index) {
        const setName = PIECE_SETS[index];
        this.selectedIndex = index;
        PieceSetLoader.setCurrentSet(setName);
        this.preloadNearby();
    }

    preloadNearby() {
        for (let i = -2; i <= 2; i++) {
            const idx = this.selectedIndex + i;
            if (idx >= 0 && idx < PIECE_SETS.length) {
                PieceSetLoader.loadSet(PIECE_SETS[idx]);
            }
        }
    }

    handleListClick(data) {
        const { listX, listY, listW, listH, itemH } = this.getListBounds();
        const maxVisible = Math.floor(listH / itemH);

        if (data.x >= listX && data.x <= listX + listW &&
            data.y >= listY && data.y <= listY + listH) {
            const clickedRow = Math.floor((data.y - listY) / itemH);
            const idx = this.scrollOffset + clickedRow;
            if (idx >= 0 && idx < PIECE_SETS.length) {
                this.selectSet(idx);
            }
        }

        // Scroll arrow buttons (full-width clickable areas)
        const arrowH = 22;
        if (data.x >= listX && data.x <= listX + listW) {
            if (data.y >= listY - arrowH && data.y <= listY) {
                this.scrollOffset = Math.max(0, this.scrollOffset - 3);
            } else if (data.y >= listY + listH && data.y <= listY + listH + arrowH) {
                this.scrollOffset = Math.min(
                    Math.max(0, PIECE_SETS.length - maxVisible),
                    this.scrollOffset + 3
                );
            }
        }
    }

    handleListMove(data) {
        const { listX, listY, listW, listH, itemH } = this.getListBounds();
        this.hoverIndex = -1;
        if (data.x >= listX && data.x <= listX + listW &&
            data.y >= listY && data.y <= listY + listH) {
            const row = Math.floor((data.y - listY) / itemH);
            this.hoverIndex = this.scrollOffset + row;
        }
    }

    update(dt) {}

    render(ctx) {
        const w = this.renderer.width;
        const h = this.renderer.height;

        UITheme.drawBackground(ctx, w, h);
        UITheme.drawVignette(ctx, w, h, 0.4);

        UITheme.drawTitle(ctx, 'Settings', w / 2, 55, 30);
        UITheme.drawDivider(ctx, w / 2 - 100, 82, 200);

        this.renderSetList(ctx);
        this.renderPreview(ctx);

        for (const btn of this.buttons) {
            btn.render(ctx);
        }
    }

    renderSetList(ctx) {
        const { listX, listY, listW, listH, itemH } = this.getListBounds();
        const maxVisible = Math.floor(listH / itemH);

        // List label
        ctx.font = '9px monospace';
        ctx.fillStyle = UI_COLORS.textDim;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'bottom';
        ctx.fillText('PIECE SET', listX, listY - 4);

        // List panel
        UITheme.drawPanel(ctx, listX, listY, listW, listH, { radius: 6, shadow: false });

        // Clip to list area
        ctx.save();
        ctx.beginPath();
        ctx.rect(listX, listY, listW, listH);
        ctx.clip();

        for (let i = 0; i < maxVisible && (this.scrollOffset + i) < PIECE_SETS.length; i++) {
            const idx = this.scrollOffset + i;
            const setName = PIECE_SETS[idx];
            const iy = listY + i * itemH;
            const isSelected = idx === this.selectedIndex;
            const isHover = idx === this.hoverIndex;

            if (isSelected) {
                ctx.fillStyle = 'rgba(200, 168, 78, 0.12)';
                ctx.fillRect(listX + 1, iy, listW - 2, itemH);
            } else if (isHover) {
                ctx.fillStyle = 'rgba(200, 168, 78, 0.05)';
                ctx.fillRect(listX + 1, iy, listW - 2, itemH);
            }

            // Loaded indicator
            if (PieceSetLoader.isLoaded(setName)) {
                ctx.fillStyle = UI_COLORS.success;
                ctx.beginPath();
                ctx.arc(listX + 10, iy + itemH / 2, 2, 0, Math.PI * 2);
                ctx.fill();
            }

            ctx.font = isSelected ? 'bold 11px monospace' : '11px monospace';
            ctx.fillStyle = isSelected ? UI_COLORS.accent : UI_COLORS.text;
            ctx.textAlign = 'left';
            ctx.textBaseline = 'middle';
            ctx.fillText(DISPLAY_NAMES[setName] || setName, listX + 18, iy + itemH / 2);
        }

        ctx.restore();

        const maxScroll = Math.max(0, PIECE_SETS.length - maxVisible);
        const arrowH = 20;

        // Up arrow button
        if (this.scrollOffset > 0) {
            ctx.fillStyle = UI_COLORS.panel;
            ctx.fillRect(listX, listY - arrowH - 2, listW, arrowH);
            ctx.strokeStyle = UI_COLORS.panelBorder;
            ctx.lineWidth = 1;
            ctx.strokeRect(listX, listY - arrowH - 2, listW, arrowH);
            ctx.font = 'bold 14px monospace';
            ctx.fillStyle = UI_COLORS.accent;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('\u25B2', listX + listW / 2, listY - arrowH / 2 - 2);
        }

        // Down arrow button
        if (this.scrollOffset < maxScroll) {
            ctx.fillStyle = UI_COLORS.panel;
            ctx.fillRect(listX, listY + listH + 2, listW, arrowH);
            ctx.strokeStyle = UI_COLORS.panelBorder;
            ctx.lineWidth = 1;
            ctx.strokeRect(listX, listY + listH + 2, listW, arrowH);
            ctx.font = 'bold 14px monospace';
            ctx.fillStyle = UI_COLORS.accent;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('\u25BC', listX + listW / 2, listY + listH + arrowH / 2 + 2);
        }

        // Scrollbar track + thumb
        if (maxScroll > 0) {
            const trackX = listX + listW - 5;
            const trackW = 3;
            ctx.fillStyle = 'rgba(42, 37, 64, 0.5)';
            ctx.fillRect(trackX, listY, trackW, listH);
            const thumbH = Math.max(16, (maxVisible / PIECE_SETS.length) * listH);
            const thumbY = listY + (this.scrollOffset / maxScroll) * (listH - thumbH);
            ctx.fillStyle = UI_COLORS.accent;
            ctx.fillRect(trackX, thumbY, trackW, thumbH);
        }

        // Scroll hint
        ctx.font = '9px monospace';
        ctx.fillStyle = UI_COLORS.textDim;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillText('scroll to browse', listX + listW / 2, listY + listH + arrowH + 6);
    }

    renderPreview(ctx) {
        const { previewX, previewY, previewW, previewH } = this.getPreviewBounds();
        const setName = PIECE_SETS[this.selectedIndex];

        UITheme.drawPanel(ctx, previewX, previewY, previewW, previewH, { radius: 6, shadow: false });

        // Set name
        ctx.font = 'bold 16px monospace';
        ctx.fillStyle = UI_COLORS.accent;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillText(DISPLAY_NAMES[setName] || setName, previewX + previewW / 2, previewY + 12);

        // Loading indicator
        if (!PieceSetLoader.isLoaded(setName)) {
            ctx.font = '11px monospace';
            ctx.fillStyle = UI_COLORS.textDim;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('Loading...', previewX + previewW / 2, previewY + previewH / 2);
            return;
        }

        // Preview pieces
        const pieceSize = Math.min(48, (previewW - 40) / 6);
        const gap = 6;
        const totalPiecesW = PREVIEW_TYPES.length * (pieceSize + gap) - gap;
        const startX = previewX + (previewW - totalPiecesW) / 2;

        // Player pieces row
        const playerRowY = previewY + 50;
        ctx.font = '9px monospace';
        ctx.fillStyle = UI_COLORS.textDim;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillText('Player', previewX + previewW / 2, playerRowY - 4);

        for (let i = 0; i < PREVIEW_TYPES.length; i++) {
            const px = startX + i * (pieceSize + gap);
            const piece = new Piece(PREVIEW_TYPES[i], TEAMS.PLAYER);
            PieceRenderer.draw(ctx, piece, px, playerRowY, pieceSize);
        }

        // Enemy pieces row
        const enemyRowY = playerRowY + pieceSize + 30;
        ctx.font = '9px monospace';
        ctx.fillStyle = UI_COLORS.textDim;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillText('Enemy', previewX + previewW / 2, enemyRowY - 4);

        for (let i = 0; i < PREVIEW_TYPES.length; i++) {
            const px = startX + i * (pieceSize + gap);
            const piece = new Piece(PREVIEW_TYPES[i], TEAMS.ENEMY);
            PieceRenderer.draw(ctx, piece, px, enemyRowY, pieceSize);
        }

        // Board preview (mini chessboard with pieces)
        const boardSize = Math.min(previewW - 40, previewH - enemyRowY - pieceSize + previewY - 40);
        if (boardSize > 60) {
            const boardY = enemyRowY + pieceSize + 20;
            const boardX = previewX + (previewW - boardSize) / 2;
            const cellSize = boardSize / 4;

            // 4x4 mini board
            for (let r = 0; r < 4; r++) {
                for (let c = 0; c < 4; c++) {
                    const isLight = (r + c) % 2 === 0;
                    ctx.fillStyle = isLight ? 'rgba(240, 217, 181, 0.3)' : 'rgba(181, 136, 99, 0.3)';
                    ctx.fillRect(boardX + c * cellSize, boardY + r * cellSize, cellSize, cellSize);
                }
            }

            // Place a few pieces on the mini board
            const miniPieces = [
                { type: PIECE_TYPES.KING, team: TEAMS.PLAYER, c: 2, r: 3 },
                { type: PIECE_TYPES.QUEEN, team: TEAMS.PLAYER, c: 1, r: 3 },
                { type: PIECE_TYPES.PAWN, team: TEAMS.PLAYER, c: 1, r: 2 },
                { type: PIECE_TYPES.PAWN, team: TEAMS.PLAYER, c: 2, r: 2 },
                { type: PIECE_TYPES.KING, team: TEAMS.ENEMY, c: 1, r: 0 },
                { type: PIECE_TYPES.ROOK, team: TEAMS.ENEMY, c: 3, r: 0 },
                { type: PIECE_TYPES.PAWN, team: TEAMS.ENEMY, c: 0, r: 1 },
                { type: PIECE_TYPES.KNIGHT, team: TEAMS.ENEMY, c: 2, r: 1 },
            ];
            for (const mp of miniPieces) {
                const piece = new Piece(mp.type, mp.team);
                PieceRenderer.draw(ctx, piece,
                    boardX + mp.c * cellSize + cellSize * 0.05,
                    boardY + mp.r * cellSize + cellSize * 0.05,
                    cellSize * 0.9);
            }
        }
    }
}
