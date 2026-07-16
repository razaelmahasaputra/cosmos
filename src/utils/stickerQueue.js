class StickerQueue {
    constructor() {
        this.queue = [];
        this.processing = false;
    }

    /**
     * Add a task to the queue and wait for its completion.
     * @param {Function} task - An async function that returns a Promise.
     * @returns {Promise<any>}
     */
    async add(task) {
        return new Promise((resolve, reject) => {
            this.queue.push({ task, resolve, reject });
            this.process();
        });
    }

    async process() {
        if (this.processing || this.queue.length === 0) return;
        this.processing = true;

        const { task, resolve, reject } = this.queue.shift();
        try {
            const result = await task();
            resolve(result);
        } catch (err) {
            reject(err);
        } finally {
            this.processing = false;
            // Process the next task in the microtask queue
            Promise.resolve().then(() => this.process());
        }
    }
}

export const stickerQueue = new StickerQueue();
