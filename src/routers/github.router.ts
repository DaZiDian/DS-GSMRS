/**
 * GitHub 路由模块
 * 
 * 原理：
 * - 接收 GitHub Webhook 推送的 Issue 相关事件
 * - 自动过滤 Bot 用户，防止无限循环
 * - 使用事件 ID 去重，避免重复处理
 * - 将消息转发到其他平台（Telegram、邮件等）
 * 
 * 选型理由：
 * - 事件去重：使用内存 Set，简单高效
 * - Bot 检测：防止自触发导致的循环
 * - 队列处理：异步转发，不阻塞 Webhook 响应
 */
import { Router, Request, Response } from 'express';
import { GitHubWebhookPayload } from '../types';
import { MessageSanitizer } from '../services/sanitizer';
import { TelegramService } from '../services/telegram.service';
import { GitHubService } from '../services/github.service';
import { MailService } from '../services/mail.service';
import { MemoryQueue } from '../queue/memoryQueue';
import { ConfigLoader } from '../config/loader';
import { logger, safeLog } from '../utils/logger';
import { hmacMiddleware } from '../middlewares/hmac';

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

  messageQueue.registerHandler('mail', async (job) => {
    return mailService.sendEmail(job.message);
  });
}

initializeServices();

/**
 * GitHub webhook endpoint
 * 注意：此端点需要 HMAC 验证
 */
router.post('/webhook', hmacMiddleware, async (req: Request, res: Response) => {
  try {
    const payload: GitHubWebhookPayload = req.body;
    const eventType = req.headers['x-github-event'] as string;

    // 忽略 Bot 用户，防止无限循环
    if (githubService.isBotUser(payload.sender)) {
      logger.info('[GSMRS] 忽略来自 Bot 用户的消息', {
        sender: payload.sender?.login,
      });
      return res.json({ success: true, message: 'Ignored bot user' });
    }

    // 去重：检查事件是否已处理
    const eventId = `${eventType}_${payload.issue?.number}_${Date.now()}`;
    if (githubService.isEventProcessed(eventId)) {
      logger.info('[GSMRS] 事件已处理，跳过', { eventId });
      return res.json({ success: true, message: 'Event already processed' });
    }
    githubService.markEventProcessed(eventId);

    // Only process issue events
    if (eventType !== 'issues' && eventType !== 'issue_comment') {
      return res.json({ success: true, message: 'Event type not handled' });
    }

    if (!payload.issue) {
      return res.status(400).json({ error: 'Invalid payload: no issue' });
    }

    // Normalize message
    const normalized = MessageSanitizer.normalize('github', payload);
    
    // Sanitize
    const config = ConfigLoader.getConfig();
    const sanitized = MessageSanitizer.sanitizeMessage(
      normalized,
      config.security.hide_sensitive
    );

    logger.info('[GSMRS] 收到 GitHub Webhook', {
      messageId: sanitized.id,
      eventType,
      issueNumber: payload.issue.number,
      action: payload.action,
    });

    // Queue messages to enabled targets
    const targets: Array<'telegram' | 'mail'> = [];
    
    if (config.telegram?.enable) {
      targets.push('telegram');
    }
    if (config.mail?.enable) {
      targets.push('mail');
    }

    // Send to all targets via queue
    for (const target of targets) {
      messageQueue.enqueue(sanitized, target);
    }

    res.json({ success: true, messageId: sanitized.id });
  } catch (error: any) {
    logger.error('[GSMRS] 处理 GitHub Webhook 时出错', {
      error: error.message,
      stack: error.stack,
    });
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GitHub 服务健康检查
 */
router.get('/health', async (req: Request, res: Response) => {
  try {
    const isHealthy = await githubService.healthCheck();
    
    res.json({
      service: 'github',
      healthy: isHealthy,
    });
  } catch (error: any) {
    logger.error('[GSMRS] GitHub 健康检查出错', { error: error.message });
    res.status(500).json({ error: 'Health check failed' });
  }
});

export default router;

