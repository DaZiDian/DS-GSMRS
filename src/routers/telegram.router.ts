/**
 * Telegram 路由模块
 * 
 * 原理：
 * - 接收 Telegram Bot Webhook 推送的消息
 * - 将消息标准化并清理敏感信息
 * - 根据配置将消息转发到其他平台（GitHub、邮件等）
 * - 使用队列异步处理，提高响应速度
 * 
 * 选型理由：
 * - Express Router：模块化路由，代码组织清晰
 * - 队列处理：异步非阻塞，提高并发性能
 * - 消息标准化：统一处理逻辑，便于扩展新平台
 */
import { Router, Request, Response } from 'express';
import { TelegramMessage } from '../types';
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

  messageQueue.registerHandler('github', async (job) => {
    return githubService.postComment(job.message);
  });

  messageQueue.registerHandler('mail', async (job) => {
    return mailService.sendEmail(job.message);
  });
}

initializeServices();

/**
 * Telegram webhook endpoint
 * 注意：此端点需要 HMAC 验证（在 index.ts 中已应用）
 */
router.post('/webhook', hmacMiddleware, async (req: Request, res: Response) => {
  try {
    const payload: TelegramMessage = req.body;

    if (!payload.message) {
      return res.status(400).json({ error: 'Invalid payload: no message' });
    }

    // Normalize message
    const normalized = MessageSanitizer.normalize('telegram', payload);
    
    // Sanitize
    const config = ConfigLoader.getConfig();
    const sanitized = MessageSanitizer.sanitizeMessage(
      normalized,
      config.security.hide_sensitive
    );

    logger.info('[GSMRS] 收到 Telegram 消息', {
      messageId: sanitized.id,
      chatId: sanitized.metadata?.chatId,
      author: sanitized.author,
    });

    // Queue messages to all enabled targets
    const targets: Array<'telegram' | 'github' | 'mail'> = [];
    
    if (config.github?.enable) {
      targets.push('github');
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
    logger.error('[GSMRS] 处理 Telegram Webhook 时出错', {
      error: error.message,
      stack: error.stack,
    });
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Telegram 服务健康检查
 */
router.get('/health', async (req: Request, res: Response) => {
  try {
    const isHealthy = await telegramService.healthCheck();
    const botInfo = await telegramService.getBotInfo();
    
    res.json({
      service: 'telegram',
      healthy: isHealthy,
      bot: botInfo,
    });
  } catch (error: any) {
    logger.error('[GSMRS] Telegram 健康检查出错', { error: error.message });
    res.status(500).json({ error: 'Health check failed' });
  }
});

export default router;

