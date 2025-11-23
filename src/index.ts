/**
 * 主入口文件
 * 
 * 原理：
 * - 使用 Express 框架构建 HTTP 服务器
 * - 加载配置文件并初始化所有中间件和路由
 * - 支持优雅关闭（SIGTERM/SIGINT），确保资源正确释放
 * - 配置 body-parser 保存原始请求体用于 HMAC 验证
 * 
 * 选型理由：
 * - Express：Node.js 最成熟的 Web 框架，生态丰富，文档完善
 * - body-parser：Express 官方推荐，支持多种数据格式解析
 * - 中间件模式：模块化设计，易于维护和扩展
 */
import express, { Express, Request, Response, NextFunction } from 'express';
import * as bodyParser from 'body-parser';
import { ConfigLoader } from './config/loader';
import { Config } from './types';
import { logger } from './utils/logger';
import { hmacMiddleware } from './middlewares/hmac';
import { rateLimitMiddleware } from './middlewares/rateLimit';
import { ipWhitelistMiddleware } from './middlewares/ipWhitelist';
import telegramRouter from './routers/telegram.router';
import githubRouter from './routers/github.router';
import apiRouter from './routers/api.router';
import { TelegramService } from './services/telegram.service';
import { GitHubService } from './services/github.service';
import { MailService } from './services/mail.service';
import { MemoryQueue } from './queue/memoryQueue';
import { MessageSanitizer } from './services/sanitizer';

// 加载配置
let config: Config;
try {
  config = ConfigLoader.load();
  logger.info('[GSMRS] 配置加载成功');
} catch (error: any) {
  logger.error('[GSMRS] 配置加载失败', { error: error.message });
  process.exit(1);
}

const app: Express = express();
const port = config.server.port || 3000;

// Trust proxy (for IP whitelist behind reverse proxy)
app.set('trust proxy', true);

// Body parser - 保存原始请求体用于 HMAC 验证
app.use(bodyParser.json({
  verify: (req: any, res: Response, buf: Buffer) => {
    req.rawBody = buf.toString('utf8');
  },
}));
app.use(bodyParser.urlencoded({ extended: true }));

// 安全中间件
app.use(ipWhitelistMiddleware);
app.use(rateLimitMiddleware);

// 请求日志记录
app.use((req: Request, res: Response, next: NextFunction) => {
  logger.info('[GSMRS] 收到请求', {
    method: req.method,
    path: req.path,
    ip: req.ip,
  });
  next();
});

// Routes
// 注意：健康检查端点不需要 HMAC 验证，Webhook 端点在路由内部应用 HMAC
app.use('/telegram', telegramRouter);
app.use('/github', githubRouter);
app.use('/api', apiRouter);

// Root endpoint
app.get('/', (req: Request, res: Response) => {
  res.json({
    name: 'DS-GSMRS',
    version: '1.0.0',
    description: 'Github Secure Message Relay Service',
    endpoints: {
      telegram: '/telegram/webhook',
      github: '/github/webhook',
      api: '/api/send',
      health: '/api/health',
    },
  });
});

// 错误处理器
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  logger.error('[GSMRS] 未处理的错误', {
    error: err.message,
    stack: err.stack,
    path: req.path,
  });
  res.status(500).json({ error: 'Internal server error' });
});

// 启动服务器
app.listen(port, async () => {
  logger.info(`[GSMRS] DS-GSMRS 服务器已启动`, {
    port,
    https: config.server.https,
    environment: process.env.NODE_ENV || 'development',
  });

  // 服务启动成功后发送测试消息
  try {
    logger.info('[GSMRS] 正在发送启动测试消息...');
    
    // 初始化服务
    const telegramService = new TelegramService();
    const githubService = new GitHubService();
    const mailService = new MailService();
    const messageQueue = new MemoryQueue();

    // 注册队列处理器
    messageQueue.registerHandler('telegram', async (job) => {
      return telegramService.sendMessage(job.message);
    });
    messageQueue.registerHandler('github', async (job) => {
      return githubService.postComment(job.message);
    });
    messageQueue.registerHandler('mail', async (job) => {
      return mailService.sendEmail(job.message);
    });

    // 创建测试消息
    const testMessage = MessageSanitizer.normalize('internal', {
      title: '🚀 DS-GSMRS 服务启动通知',
      content: `服务已成功启动！

📊 服务信息：
- 端口: ${port}
- 环境: ${process.env.NODE_ENV || 'development'}
- HTTPS: ${config.server.https ? '已启用' : '未启用'}

✅ 已启用的服务：
${config.telegram?.enable ? '- Telegram Bot' : ''}
${config.github?.enable ? '- GitHub' : ''}
${config.mail?.enable ? '- 邮件服务' : ''}

⏰ 启动时间: ${new Date().toLocaleString('zh-CN')}`,
      author: 'system',
    });

    // 清理敏感信息
    const sanitized = MessageSanitizer.sanitizeMessage(
      testMessage,
      config.security.hide_sensitive
    );

    // 发送到所有启用的目标
    const targets: Array<'telegram' | 'github' | 'mail'> = [];
    if (config.telegram?.enable) targets.push('telegram');
    if (config.github?.enable) targets.push('github');
    if (config.mail?.enable) targets.push('mail');

    if (targets.length > 0) {
      for (const target of targets) {
        messageQueue.enqueue(sanitized, target);
      }
      logger.info(`[GSMRS] 启动测试消息已发送到 ${targets.length} 个目标`, { targets });
    } else {
      logger.warn('[GSMRS] 未启用任何服务，跳过测试消息发送');
    }
  } catch (error: any) {
    logger.error('[GSMRS] 发送启动测试消息失败', { error: error.message });
  }
});

// 优雅关闭
process.on('SIGTERM', () => {
  logger.info('[GSMRS] 收到 SIGTERM 信号，正在优雅关闭');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('[GSMRS] 收到 SIGINT 信号，正在优雅关闭');
  process.exit(0);
});

