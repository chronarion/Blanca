export class StateMachine {
    constructor(eventBus) {
        this.states = new Map();
        this.currentState = null;
        this.currentName = null;
        this.eventBus = eventBus;
        this.stateStack = [];
    }

    add(name, state) {
        this.states.set(name, state);
        state.stateMachine = this;
        state.eventBus = this.eventBus;
    }

    change(name, params = {}) {
        if (this.currentState && this.currentState.exit) {
            this.currentState.exit();
        }
        this.currentState = this.states.get(name);
        this.currentName = name;
        if (!this.currentState) {
            throw new Error(`State '${name}' not found`);
        }
        if (this.currentState.enter) {
            this.currentState.enter(params);
        }
        this.eventBus.emit('stateChanged', { name, params });
    }

    push(name, params = {}) {
        if (this.currentState) {
            if (this.currentState.pause) this.currentState.pause();
            this.stateStack.push({ state: this.currentState, name: this.currentName });
        }
        this.currentState = this.states.get(name);
        this.currentName = name;
        if (this.currentState.enter) {
            this.currentState.enter(params);
        }
    }

    pop() {
        if (this.currentState && this.currentState.exit) {
            this.currentState.exit();
        }
        const prev = this.stateStack.pop();
        if (prev) {
            this.currentState = prev.state;
            this.currentName = prev.name;
            if (this.currentState.resume) this.currentState.resume();
        }
    }

    update(dt) {
        if (this.currentState && this.currentState.update) {
            this.currentState.update(dt);
        }
    }

    render(ctx) {
        if (this.currentState && this.currentState.render) {
            this.currentState.render(ctx);
        }
    }

    handleInput(type, data) {
        if (this.currentState && this.currentState.handleInput) {
            this.currentState.handleInput(type, data);
        }
    }
}
