/**
 * 通用 API 路由模块
 * 
 * 原理：
 * - 提供统一的 HTTP API 接口，支持手动发送消息
 * - 支持指定单个目标或发送到所有启用的目标
 * - 提供队列统计和死信队列查询接口
 * - 提供综合健康检查，检查所有服务的状态
 * 
 * 选型理由：
 * - RESTful API：标准 HTTP 接口，易于集成
 * - 灵活目标选择：支持单目标或多目标发送
 * - 监控接口：便于运维和问题排查
 */
import { Router, Request, Response } from 'express';
import { NormalizedMessage } from '../types';
import { MessageSanitizer } from '../services/sanitizer';
import { TelegramService } from '../services/telegram.service';
import { GitHubService } from '../services/github.service';
import { MailService } from '../services/mail.service';
import { MemoryQueue } from '../queue/memoryQueue';
import { ConfigLoader } from '../config/loader';
import { logger } from '../utils/logger';

const router = Router();

let telegramService: TelegramService;
let githubService: GitHubService;
let mailService: MailService;
let messageQueue: MemoryQueue;

// Initialize services
function initializeServices(): void {
  telegramService = new TelegramService();
  githubService = new GitHubService();
  mailService = new MailService();
  messageQueue = new MemoryQueue();

  // Register queue handlers
  messageQueue.registerHandler('telegram', async (job) => {
    return telegramService.sendMessage(job.message);
  });

  messageQueue.registerHandler('github', async (job) => {
    return githubService.postComment(job.message);
  });

  messageQueue.registerHandler('mail', async (job) => {
    return mailService.sendEmail(job.message);
  });
}

initializeServices();

/**
 * Generic API endpoint to send messages to any target
 */
router.post('/send', async (req: Request, res: Response) => {
  try {
    const { title, content, author, target, metadata } = req.body;

    if (!content) {
      return res.status(400).json({ error: 'Content is required' });
    }

    // Normalize message
    const normalized = MessageSanitizer.normalize('api', {
      title,
      content,
      author,
      metadata,
    });

    // Sanitize
    const config = ConfigLoader.getConfig();
    const sanitized = MessageSanitizer.sanitizeMessage(
      normalized,
      config.security.hide_sensitive
    );

    // Determine targets
    const targets: Array<'telegram' | 'github' | 'mail'> = [];
    
    if (target) {
      // Single target specified
      if (['telegram', 'github', 'mail'].includes(target)) {
        targets.push(target as 'telegram' | 'github' | 'mail');
      } else {
        return res.status(400).json({ error: 'Invalid target' });
      }
    } else {
      // Send to all enabled targets
      const config = ConfigLoader.getConfig();
      if (config.telegram?.enable) targets.push('telegram');
      if (config.github?.enable) targets.push('github');
      if (config.mail?.enable) targets.push('mail');
    }

    if (targets.length === 0) {
      return res.status(400).json({ error: 'No enabled targets' });
    }

    // Queue messages
    for (const t of targets) {
      messageQueue.enqueue(sanitized, t);
    }

    logger.info('[GSMRS] API 消息已入队', {
      messageId: sanitized.id,
      targets,
    });

    res.json({
      success: true,
      messageId: sanitized.id,
      targets,
    });
  } catch (error: any) {
    logger.error('[GSMRS] 处理 API 请求时出错', {
      error: error.message,
      stack: error.stack,
    });
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * 获取队列统计信息
 */
router.get('/queue/stats', (req: Request, res: Response) => {
  try {
    const stats = messageQueue.getStats();
    res.json(stats);
  } catch (error: any) {
    logger.error('[GSMRS] 获取队列统计时出错', { error: error.message });
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * 获取死信队列（DLQ）
 */
router.get('/queue/dlq', (req: Request, res: Response) => {
  try {
    const dlq = messageQueue.getDLQ();
    res.json({
      count: dlq.length,
      jobs: dlq.map(job => ({
        id: job.id,
        target: job.target,
        retries: job.retries,
        maxRetries: job.maxRetries,
        createdAt: job.createdAt,
        messageId: job.message.id,
      })),
    });
  } catch (error: any) {
    logger.error('[GSMRS] 获取死信队列时出错', { error: error.message });
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * 综合健康检查端点
 */
router.get('/health', async (req: Request, res: Response) => {
  try {
    const config = ConfigLoader.getConfig();
    const health: any = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      services: {},
    };

    if (config.telegram?.enable) {
      health.services.telegram = await telegramService.healthCheck();
    }
    if (config.github?.enable) {
      health.services.github = await githubService.healthCheck();
    }
    if (config.mail?.enable) {
      health.services.mail = await mailService.healthCheck();
    }

    const allHealthy = Object.values(health.services).every((h: any) => h === true);
    health.status = allHealthy ? 'ok' : 'degraded';

    res.json(health);
  } catch (error: any) {
    logger.error('[GSMRS] 健康检查出错', { error: error.message });
    res.status(500).json({ error: 'Health check failed' });
  }
});

export default router;

