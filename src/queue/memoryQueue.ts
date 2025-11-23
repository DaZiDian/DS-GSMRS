/**
 * 内存队列模块
 * 
 * 原理：
 * - 使用数组实现 FIFO 队列，按顺序处理消息
 * - 支持指数退避重试机制（1s, 2s, 4s...），提高成功率
 * - 实现死信队列（DLQ），存储超过最大重试次数的失败任务
 * - 使用 Map 存储处理器，支持不同目标类型的自定义处理逻辑
 * 
 * 选型理由：
 * - 内存实现：简单高效，适合单机部署，延迟低
 * - 指数退避：避免频繁重试导致资源浪费，提高成功率
 * - 死信队列：便于问题排查和手动重试
 * - 可扩展：未来可替换为 Redis 等分布式队列
 */
import { QueueJob, NormalizedMessage } from '../types';
import { logger } from '../utils/logger';

type JobHandler = (job: QueueJob) => Promise<boolean>;

export class MemoryQueue {
  private queue: QueueJob[] = [];
  private processing: boolean = false;
  private handlers: Map<string, JobHandler> = new Map();
  private maxRetries: number = 3;
  private retryDelay: number = 1000; // Initial delay in ms
  private dlq: QueueJob[] = []; // Dead Letter Queue

  /**
   * Add job to queue
   */
  enqueue(
    message: NormalizedMessage,
    target: 'telegram' | 'github' | 'mail' | 'api',
    maxRetries: number = this.maxRetries
  ): string {
    const job: QueueJob = {
      id: `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      message,
      target,
      retries: 0,
      maxRetries,
      createdAt: Date.now(),
    };

    this.queue.push(job);
    logger.debug('[GSMRS] 任务已入队', { jobId: job.id, target });

    // Start processing if not already running
    if (!this.processing) {
      this.process();
    }

    return job.id;
  }

  /**
   * Register handler for target type
   */
  registerHandler(target: string, handler: JobHandler): void {
    this.handlers.set(target, handler);
  }

  /**
   * Process queue
   */
  private async process(): Promise<void> {
    if (this.processing || this.queue.length === 0) {
      return;
    }

    this.processing = true;

    while (this.queue.length > 0) {
      const job = this.queue.shift();
      if (!job) {
        break;
      }

      try {
        const handler = this.handlers.get(job.target);
        if (!handler) {
          logger.error('[GSMRS] 未注册目标类型的处理器', {
            jobId: job.id,
            target: job.target,
          });
          this.dlq.push(job);
          continue;
        }

        const success = await handler(job);

        if (!success) {
          // Retry logic
          if (job.retries < job.maxRetries) {
            job.retries++;
            const delay = this.retryDelay * Math.pow(2, job.retries - 1); // Exponential backoff
            
            logger.info('[GSMRS] 任务失败，将重试', {
              jobId: job.id,
              retries: job.retries,
              maxRetries: job.maxRetries,
              delay,
            });

            // Re-queue with delay
            setTimeout(() => {
              this.queue.push(job);
              if (!this.processing) {
                this.process();
              }
            }, delay);
          } else {
            // Max retries reached, move to DLQ
            logger.error('[GSMRS] 任务超过最大重试次数，移至死信队列', {
              jobId: job.id,
              target: job.target,
              retries: job.retries,
            });
            this.dlq.push(job);
          }
        } else {
          logger.debug('[GSMRS] 任务处理成功', {
            jobId: job.id,
            target: job.target,
          });
        }
      } catch (error: any) {
        logger.error('[GSMRS] 处理任务时出错', {
          jobId: job.id,
          error: error.message,
        });

        if (job.retries < job.maxRetries) {
          job.retries++;
          const delay = this.retryDelay * Math.pow(2, job.retries - 1);
          setTimeout(() => {
            this.queue.push(job);
            if (!this.processing) {
              this.process();
            }
          }, delay);
        } else {
          this.dlq.push(job);
        }
      }
    }

    this.processing = false;
  }

  /**
   * Get queue stats
   */
  getStats(): {
    queueLength: number;
    dlqLength: number;
    processing: boolean;
  } {
    return {
      queueLength: this.queue.length,
      dlqLength: this.dlq.length,
      processing: this.processing,
    };
  }

  /**
   * Get DLQ jobs
   */
  getDLQ(): QueueJob[] {
    return [...this.dlq];
  }

  /**
   * Clear DLQ
   */
  clearDLQ(): void {
    this.dlq = [];
  }
}

