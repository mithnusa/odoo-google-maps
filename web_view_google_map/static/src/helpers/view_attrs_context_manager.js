import { reactive } from '@odoo/owl';

class GmapViewAttrsContextManager {
    constructor() {
        this.context = reactive({});
    }

    set(key, value) {
        this.context[key] = value;
    }

    get(key, defaultValue = null) {
        return this.context[key] ?? defaultValue;
    }

    update(attrs) {
        Object.assign(this.context, attrs);
    }

    getAll() {
        return { ...this.context };
    }

    remove(key) {
        delete this.context[key];
    }

    clear() {
        for (const key in this.context) {
            delete this.context[key];
        }
    }

    has(key) {
        return key in this.context;
    }
}

export const gMapViewAttrsContextManager = new GmapViewAttrsContextManager();
