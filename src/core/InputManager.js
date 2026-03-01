export class InputManager {
    constructor(canvas, eventBus) {
        this.canvas = canvas;
        this.eventBus = eventBus;
        this.mouse = { x: 0, y: 0, down: false };
        this.keys = new Set();
        this.setupListeners();
    }

    setupListeners() {
        // Use CSS coordinates (matching Renderer's setTransform scaling)
        this.canvas.addEventListener('mousemove', e => {
            const rect = this.canvas.getBoundingClientRect();
            this.mouse.x = e.clientX - rect.left;
            this.mouse.y = e.clientY - rect.top;
            this.eventBus.emit('mousemove', { x: this.mouse.x, y: this.mouse.y });
        });

        this.canvas.addEventListener('mousedown', e => {
            this.mouse.down = true;
            const rect = this.canvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            this.eventBus.emit('click', { x, y, button: e.button });
        });

        this.canvas.addEventListener('mouseup', () => {
            this.mouse.down = false;
        });

        this.canvas.addEventListener('contextmenu', e => {
            e.preventDefault();
            const rect = this.canvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            this.eventBus.emit('rightclick', { x, y });
        });

        this.canvas.addEventListener('wheel', e => {
            e.preventDefault();
            this.eventBus.emit('wheel', { deltaY: e.deltaY });
        }, { passive: false });

        window.addEventListener('keydown', e => {
            if (!this.keys.has(e.code)) {
                this.keys.add(e.code);
                this.eventBus.emit('keydown', { code: e.code, key: e.key });
            }
        });

        window.addEventListener('keyup', e => {
            this.keys.delete(e.code);
            this.eventBus.emit('keyup', { code: e.code, key: e.key });
        });
    }

    isKeyDown(code) {
        return this.keys.has(code);
    }
}
