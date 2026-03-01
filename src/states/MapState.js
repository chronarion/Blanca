import { UI_COLORS, PIECE_TYPES, TEAMS } from '../data/Constants.js';
import { UITheme } from '../ui/UITheme.js';
import { PieceRenderer } from '../render/PieceRenderer.js';
import { Piece } from '../pieces/Piece.js';

const NODE_COLORS = {
    battle: '#c04050',
    elite: '#d0a040',
    shop: '#5a9e6a',
    event: '#8a5ab0',
    rest: '#5080b0',
    boss: '#c9a84e',
};

const NODE_LABELS = {
    battle: 'Battle',
    elite: 'Elite',
    shop: 'Shop',
    event: 'Event',
    rest: 'Rest',
    boss: 'BOSS',
};

const NODE_ICONS = {
    battle: '\u2694',
    elite: '\u2620',
    shop: '\u2666',
    event: '?',
    rest: '\u2665',
    boss: '\u265A',
};

const PIECE_NAMES = {
    pawn: 'Pawn', knight: 'Knight', bishop: 'Bishop',
    rook: 'Rook', queen: 'Queen', king: 'King',
};

// Relic icon symbols and accent colors
const RELIC_ICONS = {
    freeMove:            { symbol: '\u265A', color: '#c9a84e' }, // crown
    captureStreak:       { symbol: '\u2666', color: '#c04050' }, // diamond (blood)
    earlyPromotion:      { symbol: '\u2191', color: '#5a9e6a' }, // up arrow
    pawnForwardCapture:  { symbol: '\u2191', color: '#8a8070' }, // pike
    extraPieceOnPromote: { symbol: '+',      color: '#5080b0' }, // plus
    enemySlowed:         { symbol: '\u265A', color: '#6a6272' }, // heavy crown
    goldBonus:           { symbol: '\u25C9', color: '#c9a84e' }, // coin
    healingRest:         { symbol: '\u266A', color: '#8a5ab0' }, // bell/note
    shieldStart:         { symbol: '\u25B2', color: '#5080b0' }, // shield triangle
    terrainSight:        { symbol: '\u25C8', color: '#5a9e6a' }, // eye/lens
};

export class MapState {
    constructor() {
        this.stateMachine = null;
        this.eventBus = null;
        this.renderer = null;
        this.runManager = null;

        this.floorData = null;
        this.hoverNode = null;
        this.reachableNodes = new Set();

        this.clickHandler = null;
        this.moveHandler = null;
        this.keyHandler = null;

        // Gold gain effect
        this.goldEffect = null;

        // Inventory hover
        this.hoverPiece = null;  // { piece, x, y }
        this.hoverRelic = null;  // { relic, x, y }
        this.inventoryBounds = []; // rebuilt each frame

        // Roster swap selection
        this.selectedRosterPiece = null;

        // Floor transition effect
        this.floorTransition = null; // { fromFloor, toFloor, time, duration }
    }

    enter(params = {}) {
        this.floorData = this.runManager.getCurrentFloorData();
        this.hoverNode = null;
        this.hoverPiece = null;
        this.hoverRelic = null;
        this.selectedRosterPiece = null;

        // Gold effect from returning from combat/shop/event
        if (params.goldGained) {
            this.goldEffect = { amount: params.goldGained, timer: 2, y: 0 };
        }

        if (this.floorData) {
            // Check if we should advance floor
            const lastLayer = this.getLastLayerNodes();
            const lastLayerDone = lastLayer.length > 0 && lastLayer.some(n => n.visited);
            const singleNode = this.floorData.nodes.length === 1;

            if (lastLayerDone || (singleNode && this.floorData.nodes[0].visited)) {
                const prevFloor = this.runManager.currentFloor;
                const canContinue = this.runManager.advanceFloor();
                if (canContinue) {
                    this.floorData = this.runManager.getCurrentFloorData();
                    this.startFloorTransition(prevFloor, this.runManager.currentFloor);
                }
            }
        }

        this.updateReachable();
        this.bindInput();
    }

    exit() {
        if (this.clickHandler) this.eventBus.off('click', this.clickHandler);
        if (this.moveHandler) this.eventBus.off('mousemove', this.moveHandler);
        if (this.keyHandler) this.eventBus.off('keydown', this.keyHandler);
    }

    getLastLayerNodes() {
        if (!this.floorData || !this.floorData.nodes.length) return [];
        const maxLayer = Math.max(...this.floorData.nodes.map(n => n.layer || 0));
        return this.floorData.nodes.filter(n => (n.layer || 0) === maxLayer);
    }

    updateReachable() {
        this.reachableNodes.clear();
        if (!this.floorData) return;

        const visited = this.floorData.nodes.filter(n => n.visited);

        if (visited.length === 0) {
            for (const node of this.floorData.nodes) {
                if ((node.layer || 0) === 0) {
                    this.reachableNodes.add(node.id);
                }
            }
        } else {
            // Only consider connections from the latest visited layer (Slay the Spire style)
            const maxVisitedLayer = Math.max(...visited.map(n => n.layer || 0));
            const latestVisited = visited.filter(n => (n.layer || 0) === maxVisitedLayer);
            for (const node of latestVisited) {
                for (const connId of node.connections) {
                    const target = this.floorData.nodes.find(n => n.id === connId);
                    if (target && !target.visited) {
                        this.reachableNodes.add(connId);
                    }
                }
            }
        }
    }

    bindInput() {
        this.clickHandler = (data) => this.handleClick(data);
        this.moveHandler = (data) => this.handleMove(data);
        this.keyHandler = (data) => this.handleKey(data);
        this.eventBus.on('click', this.clickHandler);
        this.eventBus.on('mousemove', this.moveHandler);
        this.eventBus.on('keydown', this.keyHandler);
    }

    getNodeBounds() {
        if (!this.floorData) return [];
        const w = this.renderer.width;
        const h = this.renderer.height;
        const mapH = h * 0.42;
        const mapY = h * 0.14;
        const mapX = w * 0.12;
        const mapW = w * 0.76;
        const nodeR = 24;

        return this.floorData.nodes.map(node => ({
            node,
            x: mapX + node.x * mapW,
            y: mapY + node.y * mapH,
            r: nodeR,
        }));
    }

    handleClick(data) {
        if (this.floorTransition) return;
        const bounds = this.getNodeBounds();
        for (const b of bounds) {
            const dx = data.x - b.x;
            const dy = data.y - b.y;
            if (dx * dx + dy * dy < b.r * b.r) {
                if (this.reachableNodes.has(b.node.id)) {
                    this.selectNode(b.node);
                }
                return;
            }
        }

        // Check prisoner action buttons
        for (const ib of this.inventoryBounds) {
            if (data.x >= ib.x && data.x <= ib.x + ib.w &&
                data.y >= ib.y && data.y <= ib.y + ib.h) {
                if (ib.kind === 'prisonerAction') {
                    this.handlePrisonerAction(ib.data.type, ib.data.action);
                    return;
                }
            }
        }

        // Check roster piece clicks for swap
        for (const ib of this.inventoryBounds) {
            if (data.x >= ib.x && data.x <= ib.x + ib.w &&
                data.y >= ib.y && data.y <= ib.y + ib.h) {
                if (ib.kind === 'piece') {
                    this.handleRosterSwap(ib.data);
                    return;
                }
            }
        }

        // Clicked empty space — deselect
        this.selectedRosterPiece = null;
    }

    handleRosterSwap(piece) {
        if (!this.selectedRosterPiece) {
            this.selectedRosterPiece = piece;
        } else if (this.selectedRosterPiece === piece) {
            this.selectedRosterPiece = null;
        } else {
            const roster = this.runManager.roster;
            const idxA = roster.indexOf(this.selectedRosterPiece);
            const idxB = roster.indexOf(piece);
            if (idxA !== -1 && idxB !== -1) {
                roster[idxA] = piece;
                roster[idxB] = this.selectedRosterPiece;
            }
            this.selectedRosterPiece = null;
        }
    }

    handleMove(data) {
        // Map node hover
        const bounds = this.getNodeBounds();
        this.hoverNode = null;
        for (const b of bounds) {
            const dx = data.x - b.x;
            const dy = data.y - b.y;
            if (dx * dx + dy * dy < b.r * b.r) {
                this.hoverNode = b.node;
                break;
            }
        }

        // Inventory hover
        this.hoverPiece = null;
        this.hoverRelic = null;
        for (const ib of this.inventoryBounds) {
            if (data.x >= ib.x && data.x <= ib.x + ib.w &&
                data.y >= ib.y && data.y <= ib.y + ib.h) {
                if (ib.kind === 'piece') {
                    this.hoverPiece = { piece: ib.data, x: ib.x, y: ib.y, w: ib.w, h: ib.h };
                } else if (ib.kind === 'relic') {
                    this.hoverRelic = { relic: ib.data, x: ib.x, y: ib.y, w: ib.w, h: ib.h };
                }
                break;
            }
        }
    }

    handleKey(data) {
        if (data.code === 'Escape') {
            if (this.stateMachine.states.has('pause')) {
                this.stateMachine.push('pause');
            }
        }
    }

    selectNode(node) {
        if (node.visited) return;
        node.visited = true;
        this.runManager.currentNode = node;
        this.updateReachable();

        switch (node.type) {
            case 'battle':
            case 'elite': {
                const encounter = this.runManager.getEncounter(node.type);
                if (encounter) {
                    const combatParams = this.runManager.prepareCombat(encounter);
                    combatParams.isElite = encounter.isElite;
                    this.stateMachine.change('combat', combatParams);
                }
                break;
            }
            case 'boss': {
                this.stateMachine.change('bossIntro', { floor: this.runManager.currentFloor });
                break;
            }
            case 'shop': {
                const items = this.runManager.generateShop();
                this.stateMachine.change('shop', { items });
                break;
            }
            case 'event': {
                this.stateMachine.change('event', { floor: this.runManager.currentFloor });
                break;
            }
            case 'rest': {
                this.doRest();
                break;
            }
        }
    }

    doRest() {
        const hasHealingRest = this.runManager.relicSystem.hasRelic('healingRest');
        const type = hasHealingRest ? 'knight' : 'pawn';
        this.runManager.recruitPiece(type);
        this.eventBus.emit('restCompleted', { recruitedType: type });
        this.checkFloorAdvance();
    }

    checkFloorAdvance() {
        const lastLayer = this.getLastLayerNodes();
        const lastLayerDone = lastLayer.length > 0 && lastLayer.some(n => n.visited);
        const singleNode = this.floorData.nodes.length === 1;

        if (lastLayerDone || singleNode) {
            const prevFloor = this.runManager.currentFloor;
            const canContinue = this.runManager.advanceFloor();
            if (canContinue) {
                this.floorData = this.runManager.getCurrentFloorData();
                this.hoverNode = null;
                this.updateReachable();
                this.startFloorTransition(prevFloor, this.runManager.currentFloor);
            }
        }
    }

    startFloorTransition(fromFloor, toFloor) {
        this.floorTransition = {
            fromFloor,
            toFloor,
            time: 0,
            duration: 2.0,
        };
    }

    update(dt) {
        if (this.floorTransition) {
            this.floorTransition.time += dt;
            if (this.floorTransition.time >= this.floorTransition.duration) {
                this.floorTransition = null;
            }
        }
        if (this.goldEffect) {
            this.goldEffect.timer -= dt;
            this.goldEffect.y += dt * 30;
            if (this.goldEffect.timer <= 0) this.goldEffect = null;
        }
    }

    render(ctx) {
        const w = this.renderer.width;
        const h = this.renderer.height;

        UITheme.drawBackground(ctx, w, h);
        UITheme.drawVignette(ctx, w, h, 0.35);

        // Floor header
        UITheme.drawTitle(ctx, `Floor ${this.runManager.currentFloor}`, w / 2, 32, 24);
        UITheme.drawDivider(ctx, w / 2 - 140, 50, 280);

        if (!this.floorData) return;

        // Rebuild inventory bounds each frame
        this.inventoryBounds = [];

        // --- Map area ---
        this.renderMap(ctx, w, h);

        // --- Run inventory panel ---
        this.renderInventory(ctx, w, h);

        // --- Hover tooltips (drawn last, on top) ---
        this.renderHoverTooltip(ctx, w, h);

        // Gold gain effect
        if (this.goldEffect) {
            ctx.save();
            ctx.globalAlpha = Math.min(1, this.goldEffect.timer);
            ctx.font = 'bold 18px monospace';
            ctx.fillStyle = UI_COLORS.gold;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            const effectText = typeof this.goldEffect.amount === 'string'
                ? this.goldEffect.amount
                : `+${this.goldEffect.amount}g`;
            ctx.fillText(effectText, w / 2, 70 - this.goldEffect.y);
            ctx.restore();
        }

        // Floor transition overlay (drawn last, on top of everything)
        if (this.floorTransition) {
            this.drawFloorTransition(ctx, w, h);
        }
    }

    drawFloorTransition(ctx, w, h) {
        const t = this.floorTransition;
        const p = t.time / t.duration; // 0..1

        // Phase 1 (0.0-0.4): cinematic bars close in + old floor fades
        // Phase 2 (0.4-0.6): full black, new floor text appears
        // Phase 3 (0.6-1.0): bars open, new floor revealed

        ctx.save();

        // Bar height: grows to cover h/2 then shrinks back
        let barH;
        if (p < 0.4) {
            // Ease in: bars slide in
            const bp = p / 0.4;
            barH = easeInCubic(bp) * h * 0.5;
        } else if (p < 0.6) {
            barH = h * 0.5;
        } else {
            // Ease out: bars slide away
            const bp = (p - 0.6) / 0.4;
            barH = (1 - easeOutCubic(bp)) * h * 0.5;
        }

        // Top bar
        ctx.fillStyle = '#09090d';
        ctx.fillRect(0, 0, w, barH);
        // Bottom bar
        ctx.fillRect(0, h - barH, w, barH);

        // Gold edge lines on bars
        if (barH > 2) {
            const lineAlpha = Math.min(1, barH / (h * 0.15));
            ctx.strokeStyle = `rgba(200, 168, 78, ${lineAlpha * 0.5})`;
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(0, barH);
            ctx.lineTo(w, barH);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(0, h - barH);
            ctx.lineTo(w, h - barH);
            ctx.stroke();
        }

        // Text phase: show during the closed period
        if (p >= 0.25 && p < 0.75) {
            const textP = (p - 0.25) / 0.5;
            let textAlpha;
            if (textP < 0.3) {
                textAlpha = textP / 0.3;
            } else if (textP > 0.7) {
                textAlpha = (1 - textP) / 0.3;
            } else {
                textAlpha = 1;
            }

            ctx.globalAlpha = textAlpha;

            // "Floor X" departing (slides up and fades)
            if (textP < 0.5) {
                const slideUp = textP * 40;
                ctx.font = `bold 16px Georgia, 'Times New Roman', serif`;
                ctx.fillStyle = UI_COLORS.textDim;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(`Floor ${t.fromFloor}`, w / 2, h / 2 - 10 - slideUp);
            }

            // "Floor Y" arriving (slides in from below and glows)
            if (textP > 0.3) {
                const arriveP = Math.min(1, (textP - 0.3) / 0.4);
                const slideIn = (1 - easeOutCubic(arriveP)) * 50;

                ctx.save();
                ctx.font = `bold 36px Georgia, 'Times New Roman', serif`;
                ctx.fillStyle = UI_COLORS.accent;
                ctx.shadowColor = 'rgba(200, 168, 78, 0.6)';
                ctx.shadowBlur = 20;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(`Floor ${t.toFloor}`, w / 2, h / 2 + slideIn);
                ctx.restore();

                // Decorative divider under the floor text
                if (arriveP > 0.5) {
                    const divAlpha = (arriveP - 0.5) * 2;
                    const divW = 120 * divAlpha;
                    ctx.globalAlpha = textAlpha * divAlpha;
                    ctx.strokeStyle = UI_COLORS.accent;
                    ctx.lineWidth = 1;
                    ctx.beginPath();
                    ctx.moveTo(w / 2 - divW / 2, h / 2 + slideIn + 24);
                    ctx.lineTo(w / 2 + divW / 2, h / 2 + slideIn + 24);
                    ctx.stroke();

                    // Diamond center
                    const dy = h / 2 + slideIn + 24;
                    ctx.fillStyle = UI_COLORS.accent;
                    ctx.beginPath();
                    ctx.moveTo(w / 2, dy - 3);
                    ctx.lineTo(w / 2 + 3, dy);
                    ctx.lineTo(w / 2, dy + 3);
                    ctx.lineTo(w / 2 - 3, dy);
                    ctx.closePath();
                    ctx.fill();
                }
            }

            ctx.globalAlpha = 1;
        }

        ctx.restore();
    }

    renderMap(ctx, w, h) {
        const bounds = this.getNodeBounds();

        // Draw connections
        for (const b of bounds) {
            for (const connId of b.node.connections) {
                const target = bounds.find(b2 => b2.node.id === connId);
                if (!target) continue;

                const bothVisited = b.node.visited && target.node.visited;
                const isPath = b.node.visited && this.reachableNodes.has(target.node.id);

                ctx.beginPath();
                ctx.moveTo(b.x, b.y);
                ctx.lineTo(target.x, target.y);

                if (bothVisited) {
                    ctx.strokeStyle = 'rgba(200, 168, 78, 0.3)';
                    ctx.lineWidth = 2.5;
                } else if (isPath) {
                    ctx.strokeStyle = 'rgba(200, 168, 78, 0.25)';
                    ctx.lineWidth = 2;
                    ctx.setLineDash([6, 4]);
                } else {
                    ctx.strokeStyle = 'rgba(200, 168, 78, 0.07)';
                    ctx.lineWidth = 1;
                }
                ctx.stroke();
                ctx.setLineDash([]);
            }
        }

        // Draw nodes
        for (const b of bounds) {
            const isHover = this.hoverNode === b.node;
            const isReachable = this.reachableNodes.has(b.node.id);
            const color = NODE_COLORS[b.node.type] || UI_COLORS.accent;

            // Glow for reachable hover
            if (isHover && isReachable) {
                ctx.save();
                ctx.beginPath();
                ctx.arc(b.x, b.y, b.r + 4, 0, Math.PI * 2);
                ctx.shadowColor = color;
                ctx.shadowBlur = 16;
                ctx.strokeStyle = color;
                ctx.lineWidth = 1.5;
                ctx.stroke();
                ctx.restore();
            }

            // Pulsing ring for reachable nodes
            if (isReachable && !b.node.visited) {
                ctx.beginPath();
                ctx.arc(b.x, b.y, b.r + 2, 0, Math.PI * 2);
                ctx.strokeStyle = color;
                ctx.lineWidth = 1;
                ctx.globalAlpha = 0.5;
                ctx.stroke();
                ctx.globalAlpha = 1;
            }

            // Node circle
            ctx.beginPath();
            ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
            if (b.node.visited) {
                ctx.fillStyle = UI_COLORS.bgLight;
            } else if (isReachable) {
                const grad = ctx.createRadialGradient(b.x - 3, b.y - 3, 0, b.x, b.y, b.r);
                grad.addColorStop(0, color);
                grad.addColorStop(1, this.darkenColor(color, 0.5));
                ctx.fillStyle = grad;
            } else {
                ctx.fillStyle = UI_COLORS.panel;
            }
            ctx.fill();

            ctx.beginPath();
            ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
            if (b.node.visited) {
                ctx.strokeStyle = UI_COLORS.panelBorder;
            } else if (isReachable) {
                ctx.strokeStyle = color;
            } else {
                ctx.strokeStyle = 'rgba(42, 37, 64, 0.5)';
            }
            ctx.lineWidth = isHover && isReachable ? 2.5 : 1.5;
            ctx.stroke();

            // Icon or checkmark
            const locked = !isReachable && !b.node.visited;
            ctx.font = b.node.visited ? '13px monospace' : 'bold 15px serif';
            ctx.fillStyle = b.node.visited ? UI_COLORS.textDim :
                locked ? 'rgba(106, 98, 114, 0.4)' : '#fff';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(
                b.node.visited ? '\u2713' : (locked ? '\u2022' : (NODE_ICONS[b.node.type] || '')),
                b.x, b.y
            );

            // Label
            ctx.font = '10px monospace';
            ctx.fillStyle = locked ? 'rgba(106, 98, 114, 0.3)' :
                b.node.visited ? UI_COLORS.textDim : UI_COLORS.text;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'top';
            ctx.fillText(NODE_LABELS[b.node.type] || b.node.type, b.x, b.y + b.r + 5);
        }

        // Map node tooltip
        if (this.hoverNode && this.reachableNodes.has(this.hoverNode.id)) {
            this.drawNodeTooltip(ctx, this.hoverNode);
        }
    }

    renderInventory(ctx, w, h) {
        const panelY = h * 0.62;
        const panelH = h - panelY - 10;
        const panelW = w - 20;
        const panelX = 10;

        UITheme.drawPanel(ctx, panelX, panelY, panelW, panelH, {
            radius: 8,
            shadow: false,
        });

        const rm = this.runManager;
        const relics = rm.relicSystem.ownedRelics;

        // --- Header row: Gold | Floor | Stats ---
        ctx.font = 'bold 13px monospace';
        ctx.fillStyle = UI_COLORS.gold;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(`${rm.gold}g`, panelX + 14, panelY + 16);

        ctx.font = '11px monospace';
        ctx.fillStyle = UI_COLORS.textDim;
        ctx.textAlign = 'right';
        ctx.fillText(
            `W:${rm.stats.battlesWon}  L:${rm.stats.piecesLost}`,
            panelX + panelW - 14, panelY + 16
        );

        // Divider
        ctx.beginPath();
        ctx.moveTo(panelX + 10, panelY + 30);
        ctx.lineTo(panelX + panelW - 10, panelY + 30);
        ctx.strokeStyle = UI_COLORS.panelBorder;
        ctx.lineWidth = 1;
        ctx.stroke();

        // --- Two-column layout ---
        const contentY = panelY + 36;
        const relicColW = relics.length > 0 ? Math.min(180, panelW * 0.38) : 0;
        const rosterColW = panelW - relicColW - 28;

        // --- Left: Roster + Prisoners ---
        const rosterEndY = this.renderRoster(ctx, panelX + 14, contentY, rosterColW, rm.roster);
        this.renderPrisoners(ctx, panelX + 14, rosterEndY + 6, rosterColW, rm.prisoners);

        // --- Right: Relics ---
        if (relics.length > 0) {
            const relicX = panelX + panelW - relicColW - 10;
            // Vertical divider
            ctx.beginPath();
            ctx.moveTo(relicX - 6, contentY);
            ctx.lineTo(relicX - 6, panelY + panelH - 10);
            ctx.strokeStyle = UI_COLORS.panelBorder;
            ctx.lineWidth = 1;
            ctx.stroke();

            this.renderRelics(ctx, relicX, contentY, relicColW, relics);
        }
    }

    renderRoster(ctx, x, y, maxW, roster) {
        const pieceSize = 28;
        const gap = 4;
        const maxPerRow = Math.floor(maxW / (pieceSize + gap));

        ctx.font = '9px monospace';
        ctx.fillStyle = UI_COLORS.textDim;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillText('ROSTER', x, y);

        const gridY = y + 14;

        for (let i = 0; i < roster.length; i++) {
            const piece = roster[i];
            const col = i % maxPerRow;
            const row = Math.floor(i / maxPerRow);
            const px = x + col * (pieceSize + gap);
            const py = gridY + row * (pieceSize + gap);

            // Selected piece: gold border + fill
            if (this.selectedRosterPiece === piece) {
                ctx.save();
                ctx.fillStyle = 'rgba(200, 168, 78, 0.15)';
                ctx.fillRect(px - 2, py - 2, pieceSize + 4, pieceSize + 4);
                ctx.beginPath();
                ctx.rect(px - 2, py - 2, pieceSize + 4, pieceSize + 4);
                ctx.strokeStyle = UI_COLORS.gold;
                ctx.lineWidth = 2;
                ctx.stroke();
                ctx.restore();
            } else if (this.selectedRosterPiece && this.hoverPiece && this.hoverPiece.piece === piece) {
                // Swap target: dashed gold border
                ctx.save();
                ctx.beginPath();
                ctx.rect(px - 2, py - 2, pieceSize + 4, pieceSize + 4);
                ctx.strokeStyle = UI_COLORS.gold;
                ctx.lineWidth = 1.5;
                ctx.setLineDash([4, 3]);
                ctx.stroke();
                ctx.setLineDash([]);
                ctx.restore();
            } else if (this.hoverPiece && this.hoverPiece.piece === piece) {
                // Normal hover
                ctx.save();
                ctx.beginPath();
                ctx.rect(px - 2, py - 2, pieceSize + 4, pieceSize + 4);
                ctx.strokeStyle = UI_COLORS.accent;
                ctx.lineWidth = 1.5;
                ctx.stroke();
                ctx.restore();
            }

            PieceRenderer.draw(ctx, piece, px, py, pieceSize);

            // Register hover bounds
            this.inventoryBounds.push({
                kind: 'piece',
                x: px, y: py,
                w: pieceSize, h: pieceSize,
                data: piece,
            });
        }

        const rows = Math.ceil(roster.length / maxPerRow);
        let endY = gridY + rows * (pieceSize + gap);

        // Swap hint
        if (this.selectedRosterPiece) {
            ctx.font = '9px monospace';
            ctx.fillStyle = UI_COLORS.gold;
            ctx.textAlign = 'left';
            ctx.textBaseline = 'top';
            ctx.fillText('Click another to swap', x, endY + 2);
            endY += 14;
        }

        return endY;
    }

    renderRelics(ctx, x, y, maxW, relics) {
        ctx.font = '9px monospace';
        ctx.fillStyle = UI_COLORS.textDim;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillText('RELICS', x, y);

        const itemH = 22;
        const iconSize = 16;
        const startY = y + 14;

        for (let i = 0; i < relics.length; i++) {
            const relic = relics[i];
            const iy = startY + i * itemH;
            const iconCfg = RELIC_ICONS[relic.id] || { symbol: '\u2022', color: UI_COLORS.accent };

            // Highlight row on hover
            if (this.hoverRelic && this.hoverRelic.relic === relic) {
                ctx.fillStyle = 'rgba(200, 168, 78, 0.06)';
                ctx.fillRect(x - 2, iy - 2, maxW + 4, itemH);
            }

            // Icon circle
            const iconCx = x + iconSize / 2;
            const iconCy = iy + iconSize / 2;
            this.drawRelicIcon(ctx, iconCx, iconCy, iconSize / 2, relic.id, iconCfg);

            // Relic name
            ctx.font = '10px monospace';
            ctx.fillStyle = UI_COLORS.text;
            ctx.textAlign = 'left';
            ctx.textBaseline = 'middle';
            const nameStr = relic.name.length > 16 ? relic.name.slice(0, 15) + '\u2026' : relic.name;
            ctx.fillText(nameStr, x + iconSize + 6, iconCy);

            // Register hover bounds
            this.inventoryBounds.push({
                kind: 'relic',
                x: x - 2, y: iy - 2,
                w: maxW + 4, h: itemH,
                data: relic,
            });
        }
    }

    renderPrisoners(ctx, x, y, maxW, prisoners) {
        const types = [PIECE_TYPES.PAWN, PIECE_TYPES.KNIGHT, PIECE_TYPES.BISHOP, PIECE_TYPES.ROOK, PIECE_TYPES.QUEEN];
        const active = types.filter(t => (prisoners[t] || 0) > 0);
        if (active.length === 0) return;

        ctx.font = '9px monospace';
        ctx.fillStyle = UI_COLORS.textDim;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillText('PRISONERS', x, y);

        const rowH = 22;
        const iconSize = 16;
        let rowY = y + 14;

        for (const type of active) {
            const count = prisoners[type];

            // Piece icon (enemy theme)
            const tempPiece = new Piece(type, TEAMS.ENEMY);
            PieceRenderer.draw(ctx, tempPiece, x, rowY, iconSize);

            // Count
            ctx.font = '11px monospace';
            ctx.fillStyle = UI_COLORS.text;
            ctx.textAlign = 'left';
            ctx.textBaseline = 'middle';
            ctx.fillText(`x${count}`, x + iconSize + 4, rowY + iconSize / 2);

            // Buttons
            const btnY = rowY + 1;
            const btnH = 16;

            // Release button (always available)
            const ransom = { pawn: 2, knight: 4, bishop: 4, rook: 6, queen: 10 };
            const releaseText = `${ransom[type] || 2}g`;
            const releaseBtnW = 32;
            const releaseBtnX = x + maxW - releaseBtnW;

            ctx.font = '9px monospace';
            ctx.fillStyle = UI_COLORS.gold;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';

            // Release button bg
            ctx.save();
            ctx.beginPath();
            UITheme.roundRect(ctx, releaseBtnX, btnY, releaseBtnW, btnH, 3);
            ctx.fillStyle = 'rgba(200, 168, 78, 0.1)';
            ctx.fill();
            ctx.strokeStyle = 'rgba(200, 168, 78, 0.3)';
            ctx.lineWidth = 1;
            ctx.stroke();
            ctx.restore();

            ctx.font = '9px monospace';
            ctx.fillStyle = UI_COLORS.gold;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(releaseText, releaseBtnX + releaseBtnW / 2, btnY + btnH / 2);

            this.inventoryBounds.push({
                kind: 'prisonerAction',
                x: releaseBtnX, y: btnY,
                w: releaseBtnW, h: btnH,
                data: { type, action: 'release' },
            });

            // Convert button (only if count >= 3)
            if (count >= 3) {
                const convertBtnW = 42;
                const convertBtnX = releaseBtnX - convertBtnW - 4;

                ctx.save();
                ctx.beginPath();
                UITheme.roundRect(ctx, convertBtnX, btnY, convertBtnW, btnH, 3);
                ctx.fillStyle = 'rgba(90, 158, 106, 0.15)';
                ctx.fill();
                ctx.strokeStyle = UI_COLORS.success;
                ctx.lineWidth = 1;
                ctx.stroke();
                ctx.restore();

                ctx.font = '9px monospace';
                ctx.fillStyle = UI_COLORS.success;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText('Convert', convertBtnX + convertBtnW / 2, btnY + btnH / 2);

                this.inventoryBounds.push({
                    kind: 'prisonerAction',
                    x: convertBtnX, y: btnY,
                    w: convertBtnW, h: btnH,
                    data: { type, action: 'convert' },
                });
            }

            rowY += rowH;
        }
    }

    handlePrisonerAction(type, action) {
        if (action === 'convert') {
            if (this.runManager.convertPrisoners(type)) {
                this.goldEffect = { amount: `+${PIECE_NAMES[type]}!`, timer: 2, y: 0 };
            }
        } else if (action === 'release') {
            const gold = this.runManager.releasePrisoner(type);
            if (gold > 0) {
                this.goldEffect = { amount: `+${gold}g`, timer: 2, y: 0 };
            }
        }
    }

    drawRelicIcon(ctx, cx, cy, r, relicId, cfg) {
        ctx.save();

        // Dark circle background
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
        ctx.fill();
        ctx.strokeStyle = cfg.color;
        ctx.lineWidth = 1;
        ctx.stroke();

        // Draw unique icon per relic
        const s = r * 0.65;
        ctx.fillStyle = cfg.color;
        ctx.strokeStyle = cfg.color;
        ctx.lineWidth = 1;

        switch (relicId) {
            case 'freeMove': // Crown with 3 points
                ctx.beginPath();
                ctx.moveTo(cx - s, cy + s * 0.4);
                ctx.lineTo(cx - s * 0.6, cy - s * 0.5);
                ctx.lineTo(cx, cy + s * 0.1);
                ctx.lineTo(cx + s * 0.6, cy - s * 0.5);
                ctx.lineTo(cx + s, cy + s * 0.4);
                ctx.closePath();
                ctx.fill();
                break;

            case 'captureStreak': // Blood drop
                ctx.beginPath();
                ctx.moveTo(cx, cy - s);
                ctx.quadraticCurveTo(cx + s * 1.2, cy + s * 0.2, cx, cy + s);
                ctx.quadraticCurveTo(cx - s * 1.2, cy + s * 0.2, cx, cy - s);
                ctx.fill();
                break;

            case 'earlyPromotion': // Upward arrow with banner
                ctx.beginPath();
                ctx.moveTo(cx, cy - s);
                ctx.lineTo(cx + s * 0.7, cy);
                ctx.lineTo(cx + s * 0.25, cy);
                ctx.lineTo(cx + s * 0.25, cy + s);
                ctx.lineTo(cx - s * 0.25, cy + s);
                ctx.lineTo(cx - s * 0.25, cy);
                ctx.lineTo(cx - s * 0.7, cy);
                ctx.closePath();
                ctx.fill();
                break;

            case 'pawnForwardCapture': // Spear (vertical line + tip)
                ctx.beginPath();
                ctx.moveTo(cx, cy - s);
                ctx.lineTo(cx + s * 0.4, cy - s * 0.2);
                ctx.lineTo(cx + s * 0.12, cy - s * 0.2);
                ctx.lineTo(cx + s * 0.12, cy + s);
                ctx.lineTo(cx - s * 0.12, cy + s);
                ctx.lineTo(cx - s * 0.12, cy - s * 0.2);
                ctx.lineTo(cx - s * 0.4, cy - s * 0.2);
                ctx.closePath();
                ctx.fill();
                break;

            case 'extraPieceOnPromote': // Scroll
                ctx.beginPath();
                ctx.arc(cx - s * 0.5, cy - s * 0.6, s * 0.3, Math.PI, 0);
                ctx.lineTo(cx - s * 0.2, cy + s * 0.6);
                ctx.arc(cx + s * 0.5, cy + s * 0.6, s * 0.3, Math.PI, 0, true);
                ctx.lineTo(cx + s * 0.8, cy - s * 0.6);
                ctx.stroke();
                // Scroll lines
                ctx.beginPath();
                ctx.moveTo(cx - s * 0.3, cy - s * 0.1);
                ctx.lineTo(cx + s * 0.5, cy - s * 0.1);
                ctx.moveTo(cx - s * 0.3, cy + s * 0.2);
                ctx.lineTo(cx + s * 0.5, cy + s * 0.2);
                ctx.stroke();
                break;

            case 'enemySlowed': // Heavy crown (inverted/dark)
                ctx.beginPath();
                ctx.moveTo(cx - s, cy - s * 0.2);
                ctx.lineTo(cx - s * 0.5, cy + s * 0.5);
                ctx.lineTo(cx, cy - s * 0.1);
                ctx.lineTo(cx + s * 0.5, cy + s * 0.5);
                ctx.lineTo(cx + s, cy - s * 0.2);
                ctx.lineTo(cx + s, cy + s * 0.6);
                ctx.lineTo(cx - s, cy + s * 0.6);
                ctx.closePath();
                ctx.fill();
                break;

            case 'goldBonus': // Coin (circle with inner circle)
                ctx.beginPath();
                ctx.arc(cx, cy, s * 0.85, 0, Math.PI * 2);
                ctx.fill();
                ctx.beginPath();
                ctx.arc(cx, cy, s * 0.5, 0, Math.PI * 2);
                ctx.strokeStyle = '#09090d';
                ctx.lineWidth = 1;
                ctx.stroke();
                // G letter
                ctx.font = `bold ${s * 1.1}px serif`;
                ctx.fillStyle = '#09090d';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText('G', cx, cy + 0.5);
                break;

            case 'healingRest': // Bell
                ctx.beginPath();
                ctx.moveTo(cx, cy - s);
                ctx.quadraticCurveTo(cx + s * 1.3, cy - s * 0.2, cx + s * 0.8, cy + s * 0.5);
                ctx.lineTo(cx - s * 0.8, cy + s * 0.5);
                ctx.quadraticCurveTo(cx - s * 1.3, cy - s * 0.2, cx, cy - s);
                ctx.fill();
                // Clapper
                ctx.beginPath();
                ctx.arc(cx, cy + s * 0.7, s * 0.2, 0, Math.PI * 2);
                ctx.fill();
                break;

            case 'shieldStart': // Shield
                ctx.beginPath();
                ctx.moveTo(cx, cy - s);
                ctx.lineTo(cx + s * 0.9, cy - s * 0.5);
                ctx.lineTo(cx + s * 0.9, cy + s * 0.1);
                ctx.quadraticCurveTo(cx + s * 0.7, cy + s * 0.8, cx, cy + s);
                ctx.quadraticCurveTo(cx - s * 0.7, cy + s * 0.8, cx - s * 0.9, cy + s * 0.1);
                ctx.lineTo(cx - s * 0.9, cy - s * 0.5);
                ctx.closePath();
                ctx.fill();
                break;

            case 'terrainSight': // Eye
                ctx.beginPath();
                ctx.moveTo(cx - s, cy);
                ctx.quadraticCurveTo(cx, cy - s * 1.1, cx + s, cy);
                ctx.quadraticCurveTo(cx, cy + s * 1.1, cx - s, cy);
                ctx.fill();
                // Pupil
                ctx.beginPath();
                ctx.arc(cx, cy, s * 0.35, 0, Math.PI * 2);
                ctx.fillStyle = '#09090d';
                ctx.fill();
                break;

            default:
                ctx.font = `${r}px serif`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(cfg.symbol, cx, cy);
                break;
        }

        ctx.restore();
    }

    renderHoverTooltip(ctx, w, h) {
        if (this.hoverPiece) {
            this.drawPieceTooltip(ctx, this.hoverPiece, w, h);
        } else if (this.hoverRelic) {
            this.drawRelicTooltip(ctx, this.hoverRelic, w, h);
        }
    }

    drawPieceTooltip(ctx, hp, screenW, screenH) {
        const piece = hp.piece;
        const name = PIECE_NAMES[piece.type] || piece.type;
        const mods = piece.modifiers || [];

        // Measure tooltip
        ctx.font = 'bold 12px monospace';
        const titleW = ctx.measureText(name).width;

        const lines = [];
        ctx.font = '10px monospace';
        for (const mod of mods) {
            const modName = mod.name || mod.id;
            const modDesc = mod.description || '';
            lines.push({ name: modName, desc: modDesc });
        }
        if (mods.length === 0) {
            lines.push({ name: '', desc: 'No modifiers' });
        }

        let maxLineW = titleW;
        for (const line of lines) {
            const lineText = line.name ? `${line.name}: ${line.desc}` : line.desc;
            const lw = ctx.measureText(lineText).width;
            if (lw > maxLineW) maxLineW = lw;
        }

        const tipW = Math.min(260, maxLineW + 28);
        const tipH = 26 + lines.length * 16;

        // Position above the piece, clamped to screen
        let tipX = hp.x + hp.w / 2 - tipW / 2;
        let tipY = hp.y - tipH - 8;
        if (tipX < 4) tipX = 4;
        if (tipX + tipW > screenW - 4) tipX = screenW - tipW - 4;
        if (tipY < 4) tipY = hp.y + hp.h + 8;

        // Draw panel
        UITheme.drawPanel(ctx, tipX, tipY, tipW, tipH, { radius: 6 });

        // Title
        ctx.font = 'bold 12px monospace';
        ctx.fillStyle = UI_COLORS.accent;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillText(name, tipX + 10, tipY + 7);

        // Modifier lines
        ctx.font = '10px monospace';
        for (let i = 0; i < lines.length; i++) {
            const ly = tipY + 24 + i * 16;
            if (lines[i].name) {
                ctx.fillStyle = UI_COLORS.text;
                ctx.fillText(lines[i].name, tipX + 10, ly);
                ctx.fillStyle = UI_COLORS.textDim;
                const nameW = ctx.measureText(lines[i].name + ': ').width;
                // Truncate desc to fit
                let desc = lines[i].desc;
                while (ctx.measureText(desc).width > tipW - nameW - 20 && desc.length > 3) {
                    desc = desc.slice(0, -4) + '\u2026';
                }
                ctx.fillText(desc, tipX + 10 + nameW, ly);
            } else {
                ctx.fillStyle = UI_COLORS.textDim;
                ctx.fillText(lines[i].desc, tipX + 10, ly);
            }
        }
    }

    drawRelicTooltip(ctx, hr, screenW, screenH) {
        const relic = hr.relic;
        const name = relic.name;
        const desc = relic.description || '';

        ctx.font = 'bold 12px monospace';
        const titleW = ctx.measureText(name).width;
        ctx.font = '10px monospace';

        // Word-wrap description
        const maxDescW = Math.min(240, screenW - 40);
        const descLines = this.wrapToLines(ctx, desc, maxDescW);

        const tipW = Math.max(titleW + 28, maxDescW + 28);
        const tipH = 26 + descLines.length * 14;

        // Position above the relic row, clamped to screen
        let tipX = hr.x + hr.w / 2 - tipW / 2;
        let tipY = hr.y - tipH - 8;
        if (tipX < 4) tipX = 4;
        if (tipX + tipW > screenW - 4) tipX = screenW - tipW - 4;
        if (tipY < 4) tipY = hr.y + hr.h + 8;

        UITheme.drawPanel(ctx, tipX, tipY, tipW, tipH, { radius: 6 });

        // Relic name
        ctx.font = 'bold 12px monospace';
        ctx.fillStyle = UI_COLORS.accent;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillText(name, tipX + 10, tipY + 7);

        // Description
        ctx.font = '10px monospace';
        ctx.fillStyle = UI_COLORS.text;
        for (let i = 0; i < descLines.length; i++) {
            ctx.fillText(descLines[i], tipX + 10, tipY + 24 + i * 14);
        }
    }

    drawNodeTooltip(ctx, node) {
        const w = this.renderer.width;
        const h = this.renderer.height;
        const tipY = h * 0.57;

        UITheme.drawPanel(ctx, w / 2 - 120, tipY, 240, 30, {
            radius: 6,
            shadow: false,
        });

        ctx.font = '12px monospace';
        ctx.fillStyle = UI_COLORS.text;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`${NODE_LABELS[node.type]} \u2014 Click to enter`, w / 2, tipY + 15);
    }

    wrapToLines(ctx, text, maxWidth) {
        const words = text.split(' ');
        const lines = [];
        let line = '';
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
        return lines;
    }

    darkenColor(hex, amount) {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return `rgb(${Math.floor(r * amount)},${Math.floor(g * amount)},${Math.floor(b * amount)})`;
    }
}

function easeInCubic(t) { return t * t * t; }
function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }
