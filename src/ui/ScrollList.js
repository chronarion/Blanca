import { UI_COLORS } from '../data/Constants.js';

export class ScrollList {
    constructor(x, y, w, h, itemHeight = 40) {
        this.x = x;
        this.y = y;
        this.w = w;
        this.h = h;
        this.itemHeight = itemHeight;
        this.items = [];
        this.scrollOffset = 0;
        this.selectedIndex = -1;
        this.hoverIndex = -1;
        this.onSelect = null;
    }

    setItems(items) {
        this.items = items;
        this.scrollOffset = 0;
        this.selectedIndex = -1;
    }

    handleClick(x, y) {
        if (!this.contains(x, y)) return false;
        const relY = y - this.y + this.scrollOffset;
        const idx = Math.floor(relY / this.itemHeight);
        if (idx >= 0 && idx < this.items.length) {
            this.selectedIndex = idx;
            if (this.onSelect) this.onSelect(this.items[idx], idx);
            return true;
        }
        return false;
    }

    handleMove(x, y) {
        if (!this.contains(x, y)) {
            this.hoverIndex = -1;
            return;
        }
        const relY = y - this.y + this.scrollOffset;
        this.hoverIndex = Math.floor(relY / this.itemHeight);
    }

    contains(x, y) {
        return x >= this.x && x <= this.x + this.w && y >= this.y && y <= this.y + this.h;
    }

    render(ctx, renderItem) {
        ctx.save();
        ctx.beginPath();
        ctx.rect(this.x, this.y, this.w, this.h);
        ctx.clip();

        const visibleStart = Math.floor(this.scrollOffset / this.itemHeight);
        const visibleEnd = Math.min(this.items.length, visibleStart + Math.ceil(this.h / this.itemHeight) + 1);

        for (let i = visibleStart; i < visibleEnd; i++) {
            const iy = this.y + i * this.itemHeight - this.scrollOffset;
            const isHover = this.hoverIndex === i;
            const isSelected = this.selectedIndex === i;

            if (isHover || isSelected) {
                ctx.fillStyle = isSelected ? UI_COLORS.accent + '33' : UI_COLORS.panelBorder + '33';
                ctx.fillRect(this.x, iy, this.w, this.itemHeight);
            }

            if (renderItem) {
                renderItem(ctx, this.items[i], this.x, iy, this.w, this.itemHeight, i);
            }
        }

        ctx.restore();

        // Scrollbar
        if (this.items.length * this.itemHeight > this.h) {
            const totalH = this.items.length * this.itemHeight;
            const barH = Math.max(20, (this.h / totalH) * this.h);
            const barY = this.y + (this.scrollOffset / totalH) * this.h;
            ctx.fillStyle = UI_COLORS.panelBorder;
            ctx.fillRect(this.x + this.w - 4, barY, 4, barH);
        }
    }
}
