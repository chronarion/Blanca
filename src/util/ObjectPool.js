export class ObjectPool {
    constructor(factory, reset, initialSize = 20) {
        this.factory = factory;
        this.reset = reset;
        this.pool = [];
        for (let i = 0; i < initialSize; i++) {
            this.pool.push(this.factory());
        }
    }

    get() {
        if (this.pool.length > 0) {
            return this.pool.pop();
        }
        return this.factory();
    }

    release(obj) {
        this.reset(obj);
        this.pool.push(obj);
    }

    get size() {
        return this.pool.length;
    }
}
