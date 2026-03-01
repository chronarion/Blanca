import { UI_COLORS } from '../data/Constants.js';

const NODE_COLORS = {
    battle: '#e94560',
    elite: '#ff9800',
    shop: '#4caf50',
    event: '#9c27b0',
    rest: '#2196f3',
    boss: '#ffd700',
};

const NODE_LABELS = {
    battle: 'Battle',
    elite: 'Elite',
    shop: 'Shop',
    event: 'Event',
    rest: 'Rest',
    boss: 'BOSS',
};

export class MapState {
    constructor() {
        this.stateMachine = null;
        this.eventBus = null;
        this.renderer = null;
        this.runManager = null;

        this.floorData = null;
        this.hoverNode = null;

        this.clickHandler = null;
        this.moveHandler = null;
        this.keyHandler = null;
    }

    enter() {
        this.floorData = this.runManager.getCurrentFloorData();
        this.hoverNode = null;

        // Check if floor should advance (all nodes visited or just one node)
        if (this.floorData) {
            const anyVisited = this.floorData.nodes.some(n => n.visited);
            if (anyVisited && (this.floorData.nodes.length === 1 || this.floorData.nodes.every(n => n.visited))) {
                const canContinue = this.runManager.advanceFloor();
                if (canContinue) {
                    this.floorData = this.runManager.getCurrentFloorData();
                }
            }
        }

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

    getNodeBounds() {
        if (!this.floorData) return [];
        const w = this.renderer.width;
        const h = this.renderer.height;
        const mapH = h * 0.6;
        const mapY = h * 0.15;
        const mapX = w * 0.1;
        const mapW = w * 0.8;
        const nodeR = 28;

        return this.floorData.nodes.map(node => ({
            node,
            x: mapX + node.x * mapW,
            y: mapY + node.y * mapH,
            r: nodeR,
        }));
    }

    handleClick(data) {
        const bounds = this.getNodeBounds();
        for (const b of bounds) {
            const dx = data.x - b.x;
            const dy = data.y - b.y;
            if (dx * dx + dy * dy < b.r * b.r) {
                this.selectNode(b.node);
                return;
            }
        }
    }

    handleMove(data) {
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

        // Check if floor is done
        this.checkFloorAdvance();
    }

    checkFloorAdvance() {
        const allVisited = this.floorData.nodes.every(n => n.visited);
        const anyVisited = this.floorData.nodes.some(n => n.visited);

        // Auto-advance if only one node or all visited
        if (allVisited || this.floorData.nodes.length === 1) {
            const canContinue = this.runManager.advanceFloor();
            if (canContinue) {
                this.floorData = this.runManager.getCurrentFloorData();
                this.hoverNode = null;
            }
        }
    }

    update(dt) {}

    render(ctx) {
        const w = this.renderer.width;
        const h = this.renderer.height;

        // Floor header
        ctx.font = 'bold 28px monospace';
        ctx.fillStyle = UI_COLORS.text;
        ctx.textAlign = 'center';
        ctx.fillText(`Floor ${this.runManager.currentFloor}`, w / 2, 40);

        // Run info bar
        ctx.font = '13px monospace';
        ctx.fillStyle = UI_COLORS.textDim;
        ctx.fillText(`Army: ${this.runManager.roster.length} pieces  |  Gold: ${this.runManager.gold}  |  Relics: ${this.runManager.relicSystem.ownedRelics.length}`, w / 2, 68);

        if (!this.floorData) return;

        const bounds = this.getNodeBounds();

        // Draw connections
        ctx.strokeStyle = UI_COLORS.panelBorder;
        ctx.lineWidth = 2;
        for (const b of bounds) {
            for (const connId of b.node.connections) {
                const target = bounds.find(b2 => b2.node.id === connId);
                if (target) {
                    ctx.beginPath();
                    ctx.moveTo(b.x, b.y);
                    ctx.lineTo(target.x, target.y);
                    ctx.stroke();
                }
            }
        }

        // Draw nodes
        for (const b of bounds) {
            const isHover = this.hoverNode === b.node;
            const color = NODE_COLORS[b.node.type] || UI_COLORS.accent;

            // Node circle
            ctx.beginPath();
            ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
            ctx.fillStyle = b.node.visited ? UI_COLORS.bgLight : color;
            ctx.fill();
            ctx.strokeStyle = isHover ? '#ffffff' : (b.node.visited ? UI_COLORS.textDim : color);
            ctx.lineWidth = isHover ? 3 : 2;
            ctx.stroke();

            if (b.node.visited) {
                ctx.font = 'bold 16px monospace';
                ctx.fillStyle = UI_COLORS.textDim;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText('✓', b.x, b.y);
            }

            // Label
            ctx.font = 'bold 11px monospace';
            ctx.fillStyle = b.node.visited ? UI_COLORS.textDim : UI_COLORS.text;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'top';
            ctx.fillText(NODE_LABELS[b.node.type] || b.node.type, b.x, b.y + b.r + 6);
        }

        // Tooltip
        if (this.hoverNode && !this.hoverNode.visited) {
            this.drawTooltip(ctx, this.hoverNode);
        }

        // Instructions
        ctx.font = '12px monospace';
        ctx.fillStyle = UI_COLORS.textDim;
        ctx.textAlign = 'center';
        ctx.fillText('Click a node to proceed', w / 2, h - 30);
    }

    drawTooltip(ctx, node) {
        const w = this.renderer.width;
        ctx.font = '14px monospace';
        ctx.fillStyle = UI_COLORS.text;
        ctx.textAlign = 'center';
        ctx.fillText(`${NODE_LABELS[node.type]} — Click to enter`, w / 2, this.renderer.height - 60);

        // Cartographer's Lens: show terrain info on battle nodes
        if (this.runManager.relicSystem.hasRelic('terrainSight') && node.terrain && node.terrain.length > 0) {
            ctx.font = '11px monospace';
            ctx.fillStyle = '#aaa';
            const terrainNames = node.terrain.map(t => t.terrain || t.type || t).join(', ');
            ctx.fillText(`Terrain: ${terrainNames}`, w / 2, this.renderer.height - 44);
        }
    }
}
