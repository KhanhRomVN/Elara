import { createLogger } from '../../utils/logger';

const logger = createLogger('AntigravityQueue');

interface QueueTask<T> {
  execute: () => Promise<T>;
  resolve: (value: T) => void;
  reject: (error: any) => void;
}

/**
 * Request queue with rate limiting for Antigravity API
 * Ensures requests are processed sequentially with minimum interval
 * to avoid 429 rate limit errors
 */
export class AntigravityQueue {
  private queue: QueueTask<any>[] = [];
  private processing = false;
  private lastRequestTime = 0;
  private minInterval: number;

  constructor(minIntervalMs: number = 250) {
    this.minInterval = minIntervalMs;
    logger.info(`[Queue] Initialized with min interval: ${this.minInterval}ms`);
  }

  /**
   * Add a task to the queue
   * Returns a promise that resolves when the task is executed
   */
  async add<T>(task: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.queue.push({
        execute: task,
        resolve,
        reject,
      });

      logger.debug(`[Queue] Task added, queue size: ${this.queue.length}`);

      // Start processing if not already running
      this.processQueue();
    });
  }

  /**
   * Process tasks in the queue sequentially
   */
  private async processQueue(): Promise<void> {
    if (this.processing || this.queue.length === 0) {
      return;
    }

    this.processing = true;
    logger.debug('[Queue] Started processing');

    while (this.queue.length > 0) {
      const now = Date.now();
      const timeSinceLastRequest = now - this.lastRequestTime;

      // Wait if we're within the minimum interval
      if (this.lastRequestTime > 0 && timeSinceLastRequest < this.minInterval) {
        const waitTime = this.minInterval - timeSinceLastRequest;
        logger.debug(
          `[Queue] Waiting ${waitTime}ms before next request (rate limiting)`,
        );
        await new Promise((r) => setTimeout(r, waitTime));
      }

      const task = this.queue.shift()!;
      this.lastRequestTime = Date.now();

      try {
        logger.debug(`[Queue] Executing task, ${this.queue.length} remaining`);
        const result = await task.execute();
        task.resolve(result);
      } catch (error) {
        logger.error('[Queue] Task execution failed:', error);
        task.reject(error);
      }
    }

    this.processing = false;
    logger.debug('[Queue] Finished processing, queue empty');
  }

  /**
   * Get current queue size
   */
  getQueueSize(): number {
    return this.queue.length;
  }

  /**
   * Check if queue is currently processing
   */
  isProcessing(): boolean {
    return this.processing;
  }
}
