export class EventManager {
    constructor() {
        this.listeners = new Map();
    }

    addListener(target, eventName, handler, options = {}) {
        const key = this._getEventKey(target, eventName);
        const listener = google.maps.event.addListener(
            target,
            eventName,
            options.debounce ? this._debounce(handler, options.debounce) : handler
        );

        if (!this.listeners.has(key)) {
            this.listeners.set(key, []);
        }
        this.listeners.get(key).push(listener);
        return listener;
    }

    removeListeners(target, eventName) {
        const key = this._getEventKey(target, eventName);
        if (this.listeners.has(key)) {
            this.listeners.get(key).forEach(listener => {
                google.maps.event.removeListener(listener);
            });
            this.listeners.delete(key);
        }
    }

    removeAllListeners() {
        this.listeners.forEach((listeners, key) => {
            listeners.forEach(listener => {
                google.maps.event.removeListener(listener);
            });
        });
        this.listeners.clear();
    }

    _getEventKey(target, eventName) {
        return `${target}_${eventName}`;
    }

    _debounce(func, wait) {
        let timeout;
        return (...args) => {
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(this, args), wait);
        };
    }
}
