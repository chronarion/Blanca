import { ARMIES, getArmyList } from '../data/ArmyData.js';
import { PieceRenderer } from '../render/PieceRenderer.js';
import { Piece } from '../pieces/Piece.js';
import { TEAMS, UI_COLORS } from '../data/Constants.js';

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
        const cardH = 240;
        const gap = 20;
        const totalW = this.armies.length * (cardW + gap) - gap;
        const startX = (this.renderer.width - totalW) / 2;
        const y = this.renderer.height / 2 - cardH / 2 + 20;

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
        // Title
        ctx.font = 'bold 36px monospace';
        ctx.fillStyle = UI_COLORS.text;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('Choose Your Army', this.renderer.width / 2, 60);

        ctx.font = '14px monospace';
        ctx.fillStyle = UI_COLORS.textDim;
        ctx.fillText('Select a starting army for your run', this.renderer.width / 2, 95);

        const bounds = this.getCardBounds();

        for (let i = 0; i < this.armies.length; i++) {
            const army = this.armies[i];
            const b = bounds[i];
            const isHover = this.hoverIndex === i;
            const isSelected = this.selectedIndex === i;

            // Card background
            ctx.fillStyle = isHover || isSelected ? UI_COLORS.panel : UI_COLORS.bgLight;
            ctx.fillRect(b.x, b.y, b.w, b.h);

            // Border
            ctx.strokeStyle = isSelected ? army.color : (isHover ? UI_COLORS.accent : UI_COLORS.panelBorder);
            ctx.lineWidth = isSelected ? 3 : 1;
            ctx.strokeRect(b.x, b.y, b.w, b.h);

            // Army name
            ctx.font = 'bold 13px monospace';
            ctx.fillStyle = army.color;
            ctx.textAlign = 'center';
            ctx.fillText(army.name, b.x + b.w / 2, b.y + 22);

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
                const py = b.y + 38 + row * (pieceSize + pieceGap);
                const tempPiece = new Piece(army.pieces[j].type, TEAMS.PLAYER);
                PieceRenderer.draw(ctx, tempPiece, px, py, pieceSize);
            }

            // Description
            ctx.font = '11px monospace';
            ctx.fillStyle = UI_COLORS.textDim;
            ctx.textAlign = 'center';
            const desc = army.description;
            this.wrapText(ctx, desc, b.x + b.w / 2, b.y + 140, b.w - 16, 14);
        }

        // Instructions
        ctx.font = '12px monospace';
        ctx.fillStyle = UI_COLORS.textDim;
        ctx.textAlign = 'center';
        ctx.fillText('Click to select  |  Arrow keys to browse  |  Enter to confirm', this.renderer.width / 2, this.renderer.height - 40);
    }

    wrapText(ctx, text, x, y, maxWidth, lineHeight) {
        const words = text.split(' ');
        let line = '';
        let lines = [];
        for (const word of words) {
            const test = line + (line ? ' ' : '') + word;
            if (ctx.measureText(test).width > maxWidth && line) {
                lines.push(line);
                line = word;
            } else {
                line = test;
            }
        }
        if (line) lines.push(line);
        for (let i = 0; i < lines.length; i++) {
            ctx.fillText(lines[i], x, y + i * lineHeight);
        }
    }
}
