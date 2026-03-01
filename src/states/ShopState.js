import { UI_COLORS, PIECE_TYPES, TEAMS } from '../data/Constants.js';
import { Piece } from '../pieces/Piece.js';
import { PieceRenderer } from '../render/PieceRenderer.js';

export class ShopState {
    constructor() {
        this.stateMachine = null;
        this.eventBus = null;
        this.renderer = null;
        this.runManager = null;

        this.items = [];
        this.hoverIndex = -1;
        this.message = '';
        this.messageTimer = 0;

        this.clickHandler = null;
        this.moveHandler = null;
        this.keyHandler = null;

        this.pendingModifier = null;
        this.validPieces = [];
    }

    enter(params = {}) {
        this.items = params.items || this.runManager.generateShop();
        this.hoverIndex = -1;
        this.message = '';
        this.messageTimer = 0;
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

    getItemBounds() {
        const cardW = 160;
        const cardH = 180;
        const gap = 16;
        const totalW = this.items.length * (cardW + gap) - gap;
        const startX = (this.renderer.width - totalW) / 2;
        const y = this.renderer.height / 2 - cardH / 2;

        return this.items.map((item, i) => ({
            item, x: startX + i * (cardW + gap), y, w: cardW, h: cardH,
        }));
    }

    getLeaveButton() {
        const bw = 140;
        const bh = 40;
        return { x: (this.renderer.width - bw) / 2, y: this.renderer.height - 80, w: bw, h: bh };
    }

    handleClick(data) {
        // Piece selection mode for modifier assignment
        if (this.pendingModifier) {
            const pieceBounds = this.getPieceSelectionBounds();
            for (const b of pieceBounds) {
                if (data.x >= b.x && data.x <= b.x + b.w && data.y >= b.y && data.y <= b.y + b.h) {
                    b.piece.addModifier({ ...this.pendingModifier });
                    this.showMessage(`Applied ${this.pendingModifier.name} to ${b.piece.type}!`);
                    this.pendingModifier = null;
                    this.validPieces = [];
                    return;
                }
            }
            // Click elsewhere cancels (modifier already paid for, lost)
            return;
        }

        // Check leave button
        const lb = this.getLeaveButton();
        if (data.x >= lb.x && data.x <= lb.x + lb.w && data.y >= lb.y && data.y <= lb.y + lb.h) {
            this.stateMachine.change('map');
            return;
        }

        // Check items
        const bounds = this.getItemBounds();
        for (const b of bounds) {
            if (data.x >= b.x && data.x <= b.x + b.w && data.y >= b.y && data.y <= b.y + b.h) {
                this.purchaseItem(b.item);
                return;
            }
        }
    }

    handleMove(data) {
        const bounds = this.getItemBounds();
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
        if (data.code === 'Escape') {
            this.stateMachine.change('map');
        }
    }

    purchaseItem(item) {
        if (this.runManager.gold < item.price) {
            this.showMessage('Not enough gold!');
            return;
        }

        if (item.category === 'modifier') {
            // Find valid pieces in roster for this modifier
            const valid = this.runManager.roster.filter(p =>
                item.validPieces && item.validPieces.includes(p.type) && !p.hasModifier(item.id)
            );
            if (valid.length === 0) {
                this.showMessage('No valid pieces for this modifier!');
                return;
            }
            // Deduct gold and enter piece selection mode
            const success = this.runManager.purchaseShopItem(item);
            if (success) {
                this.pendingModifier = item.modifier || item;
                this.validPieces = valid;
                this.showMessage('Select a piece to apply modifier');
            }
            return;
        }

        const success = this.runManager.purchaseShopItem(item);
        if (success) {
            this.showMessage(`Purchased ${item.name}!`);
        }
    }

    getPieceSelectionBounds() {
        const btnW = 60;
        const btnH = 60;
        const gap = 10;
        const totalW = this.validPieces.length * (btnW + gap) - gap;
        const startX = (this.renderer.width - totalW) / 2;
        const y = this.renderer.height / 2 - btnH / 2;
        return this.validPieces.map((piece, i) => ({
            piece, x: startX + i * (btnW + gap), y, w: btnW, h: btnH,
        }));
    }

    showMessage(msg) {
        this.message = msg;
        this.messageTimer = 2;
    }

    update(dt) {
        if (this.messageTimer > 0) this.messageTimer -= dt;
    }

    render(ctx) {
        const w = this.renderer.width;

        // Title
        ctx.font = 'bold 32px monospace';
        ctx.fillStyle = UI_COLORS.text;
        ctx.textAlign = 'center';
        ctx.fillText('Shop', w / 2, 50);

        // Gold display
        ctx.font = 'bold 18px monospace';
        ctx.fillStyle = UI_COLORS.gold;
        ctx.fillText(`Gold: ${this.runManager.gold}`, w / 2, 85);

        // Items
        const bounds = this.getItemBounds();
        for (let i = 0; i < bounds.length; i++) {
            const b = bounds[i];
            const item = b.item;
            const isHover = this.hoverIndex === i;
            const canAfford = this.runManager.gold >= item.price;

            ctx.fillStyle = isHover ? UI_COLORS.panel : UI_COLORS.bgLight;
            ctx.fillRect(b.x, b.y, b.w, b.h);
            ctx.strokeStyle = canAfford ? (isHover ? UI_COLORS.accent : UI_COLORS.panelBorder) : '#555';
            ctx.lineWidth = isHover ? 2 : 1;
            ctx.strokeRect(b.x, b.y, b.w, b.h);

            // Icon
            if (item.category === 'piece') {
                const tempPiece = new Piece(item.type, TEAMS.PLAYER);
                PieceRenderer.draw(ctx, tempPiece, b.x + (b.w - 40) / 2, b.y + 12, 40);
            } else {
                ctx.font = '28px serif';
                ctx.fillStyle = item.category === 'relic' ? UI_COLORS.gold : UI_COLORS.info;
                ctx.textAlign = 'center';
                ctx.fillText(item.category === 'relic' ? '★' : '◆', b.x + b.w / 2, b.y + 40);
            }

            // Name
            ctx.font = 'bold 12px monospace';
            ctx.fillStyle = UI_COLORS.text;
            ctx.textAlign = 'center';
            ctx.fillText(item.name, b.x + b.w / 2, b.y + 70);

            // Description
            ctx.font = '10px monospace';
            ctx.fillStyle = UI_COLORS.textDim;
            this.wrapText(ctx, item.description, b.x + b.w / 2, b.y + 88, b.w - 16, 13);

            // Price
            ctx.font = 'bold 14px monospace';
            ctx.fillStyle = canAfford ? UI_COLORS.gold : UI_COLORS.danger;
            ctx.fillText(`${item.price}g`, b.x + b.w / 2, b.y + b.h - 16);
        }

        // Leave button
        const lb = this.getLeaveButton();
        ctx.fillStyle = UI_COLORS.panel;
        ctx.fillRect(lb.x, lb.y, lb.w, lb.h);
        ctx.strokeStyle = UI_COLORS.panelBorder;
        ctx.lineWidth = 1;
        ctx.strokeRect(lb.x, lb.y, lb.w, lb.h);
        ctx.font = 'bold 14px monospace';
        ctx.fillStyle = UI_COLORS.text;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('Leave Shop', lb.x + lb.w / 2, lb.y + lb.h / 2);

        // Piece selection overlay for modifier assignment
        if (this.pendingModifier) {
            ctx.fillStyle = 'rgba(0,0,0,0.65)';
            ctx.fillRect(0, 0, w, this.renderer.height);

            ctx.font = 'bold 18px monospace';
            ctx.fillStyle = UI_COLORS.text;
            ctx.textAlign = 'center';
            ctx.fillText(`Apply ${this.pendingModifier.name} to:`, w / 2, this.renderer.height / 2 - 60);

            const pieceBounds = this.getPieceSelectionBounds();
            for (const b of pieceBounds) {
                ctx.fillStyle = UI_COLORS.panel;
                ctx.fillRect(b.x, b.y, b.w, b.h);
                ctx.strokeStyle = UI_COLORS.panelBorder;
                ctx.lineWidth = 2;
                ctx.strokeRect(b.x, b.y, b.w, b.h);
                PieceRenderer.draw(ctx, b.piece, b.x + 2, b.y + 2, b.w - 4);
            }
        }

        // Message
        if (this.messageTimer > 0 && this.message) {
            ctx.globalAlpha = Math.min(1, this.messageTimer);
            ctx.font = 'bold 16px monospace';
            ctx.fillStyle = UI_COLORS.accent;
            ctx.textAlign = 'center';
            ctx.fillText(this.message, w / 2, this.renderer.height - 120);
            ctx.globalAlpha = 1;
        }
    }

    wrapText(ctx, text, x, y, maxWidth, lineHeight) {
        const words = text.split(' ');
        let line = '';
        let lineNum = 0;
        for (const word of words) {
            const test = line + (line ? ' ' : '') + word;
            if (ctx.measureText(test).width > maxWidth && line) {
                ctx.fillText(line, x, y + lineNum * lineHeight);
                line = word;
                lineNum++;
            } else {
                line = test;
            }
        }
        if (line) ctx.fillText(line, x, y + lineNum * lineHeight);
    }
}
