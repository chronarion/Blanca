import { ARMIES, getArmyList } from '../data/ArmyData.js';
import { PieceRenderer } from '../render/PieceRenderer.js';
import { Piece } from '../pieces/Piece.js';
import { TEAMS, UI_COLORS } from '../data/Constants.js';
import { UITheme } from '../ui/UITheme.js';

export class ArmySelectState {
    constructor() {
        this.stateMachine = null;
        this.eventBus = null;
        this.renderer = null;
        this.runManager = null;

        this.armies = getArmyList();
        this.selectedIndex = 0;
        this.hoverIndex = -1;

        this.clickHandler = null;
        this.moveHandler = null;
        this.keyHandler = null;
    }

    enter() {
        this.selectedIndex = 0;
        this.hoverIndex = -1;
        this.bindInput();
    }

    exit() {
        if (this.clickHandler) this.eventBus.off('click', this.clickHandler);
        if (this.moveHandler) this.eventBus.off('mousemove', this.moveHandler);
        if (this.keyHandler) this.eventBus.off('keydown', this.keyHandler);
    }

    bindInput() {
        this.clickHandler = (data) => this.handleClick(data);
        this.moveHandler = (data) => this.handleMove(data);
        this.keyHandler = (data) => this.handleKey(data);
        this.eventBus.on('click', this.clickHandler);
        this.eventBus.on('mousemove', this.moveHandler);
        this.eventBus.on('keydown', this.keyHandler);
    }

    getCardBounds() {
        const cardW = 180;
        const cardH = 250;
        const gap = 18;
        const totalW = this.armies.length * (cardW + gap) - gap;
        const startX = (this.renderer.width - totalW) / 2;
        const y = this.renderer.height / 2 - cardH / 2 + 24;

        return this.armies.map((_, i) => ({
            x: startX + i * (cardW + gap),
            y, w: cardW, h: cardH,
        }));
    }

    handleClick(data) {
        const bounds = this.getCardBounds();
        for (let i = 0; i < bounds.length; i++) {
            const b = bounds[i];
            if (data.x >= b.x && data.x <= b.x + b.w && data.y >= b.y && data.y <= b.y + b.h) {
                this.selectArmy(i);
                return;
            }
        }
    }

    handleMove(data) {
        const bounds = this.getCardBounds();
        this.hoverIndex = -1;
        for (let i = 0; i < bounds.length; i++) {
            const b = bounds[i];
            if (data.x >= b.x && data.x <= b.x + b.w && data.y >= b.y && data.y <= b.y + b.h) {
                this.hoverIndex = i;
                break;
            }
        }
    }

    handleKey(data) {
        if (data.code === 'ArrowLeft') {
            this.selectedIndex = (this.selectedIndex - 1 + this.armies.length) % this.armies.length;
        } else if (data.code === 'ArrowRight') {
            this.selectedIndex = (this.selectedIndex + 1) % this.armies.length;
        } else if (data.code === 'Enter' || data.code === 'Space') {
            this.selectArmy(this.selectedIndex);
        } else if (data.code === 'Escape') {
            this.stateMachine.change('mainMenu');
        }
    }

    selectArmy(index) {
        const army = this.armies[index];
        if (this.runManager) {
            this.runManager.startRun(army.id);
            this.stateMachine.change('map');
        }
    }

    update(dt) {}

    render(ctx) {
        const w = this.renderer.width;
        const h = this.renderer.height;

        UITheme.drawBackground(ctx, w, h);
        UITheme.drawVignette(ctx, w, h, 0.4);

        // Title
        UITheme.drawTitle(ctx, 'Choose Your Army', w / 2, 55, 32);

        ctx.font = '13px monospace';
        ctx.fillStyle = UI_COLORS.textDim;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('Select a starting army for your run', w / 2, 90);

        UITheme.drawDivider(ctx, w / 2 - 140, 110, 280);

        const bounds = this.getCardBounds();

        for (let i = 0; i < this.armies.length; i++) {
            const army = this.armies[i];
            const b = bounds[i];
            const isHover = this.hoverIndex === i;
            const isSelected = this.selectedIndex === i;
            const active = isHover || isSelected;

            // Card
            UITheme.drawPanel(ctx, b.x, b.y, b.w, b.h, {
                highlight: active,
                glow: isSelected,
                fill: active ? '#1a1a28' : UI_COLORS.panel,
            });

            // Color accent bar at top
            ctx.beginPath();
            UITheme.roundRect(ctx, b.x + 1, b.y + 1, b.w - 2, 3, 2);
            ctx.fillStyle = army.color;
            ctx.globalAlpha = active ? 0.8 : 0.4;
            ctx.fill();
            ctx.globalAlpha = 1;

            // Army name
            ctx.font = 'bold 13px monospace';
            ctx.fillStyle = active ? army.color : UI_COLORS.text;
            ctx.textAlign = 'center';
            ctx.fillText(army.name, b.x + b.w / 2, b.y + 26);

            // Piece icons
            const pieceSize = 28;
            const piecesPerRow = 4;
            const pieceGap = 4;
            const pieceTotalW = Math.min(army.pieces.length, piecesPerRow) * (pieceSize + pieceGap);
            const pieceStartX = b.x + (b.w - pieceTotalW) / 2;

            for (let j = 0; j < army.pieces.length; j++) {
                const row = Math.floor(j / piecesPerRow);
                const col = j % piecesPerRow;
                const px = pieceStartX + col * (pieceSize + pieceGap);
                const py = b.y + 44 + row * (pieceSize + pieceGap);
                const tempPiece = new Piece(army.pieces[j].type, TEAMS.PLAYER);
                PieceRenderer.draw(ctx, tempPiece, px, py, pieceSize);
            }

            // Description
            ctx.font = '11px monospace';
            ctx.fillStyle = UI_COLORS.textDim;
            ctx.textAlign = 'center';
            UITheme.wrapText(ctx, army.description, b.x + b.w / 2, b.y + 148, b.w - 20, 14);
        }

        // Instructions
        ctx.font = '12px monospace';
        ctx.fillStyle = UI_COLORS.textDim;
        ctx.textAlign = 'center';
        ctx.globalAlpha = 0.6;
        ctx.fillText('Click to select  |  Arrow keys to browse', w / 2, h - 40);
        ctx.globalAlpha = 1;
    }
}
