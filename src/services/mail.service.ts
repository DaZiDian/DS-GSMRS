/**
 * 邮件服务模块
 * 
 * 原理：
 * - 使用 Nodemailer 通过 SMTP 协议发送邮件
 * - 支持 HTML 和纯文本格式，自动转义 HTML 特殊字符防止注入
 * - 集成 Spam 检测，自动过滤垃圾邮件关键词
 * - 提供邮件发送测试功能，验证 SMTP 配置
 * 
 * 选型理由：
 * - Nodemailer：Node.js 生态中最成熟的邮件库，支持多种传输方式
 * - SMTP 协议：标准协议，兼容所有邮件服务商（Gmail、QQ、163等）
 * - HTML 转义：防止 XSS 攻击，确保邮件安全
 */
import * as nodemailer from 'nodemailer';
import { Transporter } from 'nodemailer';
import { NormalizedMessage } from '../types';
import { ConfigLoader } from '../config/loader';
import { logger, safeLog } from '../utils/logger';
import { MessageSanitizer } from './sanitizer';

export class MailService {
  private transporter: Transporter | null = null;
  private to: string = '';
  private enabled: boolean = false;

  constructor() {
    const config = ConfigLoader.getConfig();
    this.enabled = config.mail?.enable ?? false;

    if (!this.enabled) {
      logger.info('[GSMRS] 邮件服务已禁用');
      return;
    }

    const mailConfig = config.mail;
    if (!mailConfig?.smtp || !mailConfig.to) {
      logger.warn('[GSMRS] 邮件服务已启用但 SMTP 配置或收件人未设置');
      return;
    }

    this.to = mailConfig.to;

    try {
      this.transporter = nodemailer.createTransport({
        host: mailConfig.smtp.host,
        port: mailConfig.smtp.port,
        secure: mailConfig.smtp.secure,
        auth: {
          user: mailConfig.smtp.user,
          pass: mailConfig.smtp.pass,
        },
      });

      logger.info('[GSMRS] 邮件服务已初始化', {
        host: mailConfig.smtp.host,
        port: mailConfig.smtp.port,
        to: this.to,
      });
    } catch (error: any) {
      logger.error('[GSMRS] 初始化邮件服务失败', {
        error: error.message,
      });
    }
  }

  /**
   * Send email
   */
  async sendEmail(message: NormalizedMessage): Promise<boolean> {
    if (!this.enabled || !this.transporter) {
      logger.warn('[GSMRS] 邮件服务已禁用或未配置');
      return false;
    }

    try {
      // Check for spam keywords
      const fullText = `${message.title || ''} ${message.content}`;
      if (MessageSanitizer.isSpam(fullText)) {
        logger.warn('[GSMRS] 消息被标记为垃圾邮件，已隔离', {
          messageId: message.id,
        });
        // Could implement quarantine queue here
        return false;
      }

      // Sanitize title to prevent injection
      let subject = message.title || `Notification from ${message.source}`;
      subject = subject.replace(/[\r\n]/g, ' ').substring(0, 200);

      // Format email body
      let html = '<html><body>';
      if (message.title) {
        html += `<h2>${this.escapeHtml(message.title)}</h2>`;
      }
      html += `<p>${this.escapeHtml(message.content).replace(/\n/g, '<br>')}</p>`;
      
      if (message.author) {
        html += `<hr><p><em>From: ${this.escapeHtml(message.author)}</em></p>`;
      }
      if (message.source) {
        html += `<p><em>Source: ${this.escapeHtml(message.source)}</em></p>`;
      }
      html += '</body></html>';

      const mailOptions = {
        from: (this.transporter.options as any).auth?.user,
        to: this.to,
        subject,
        html,
        text: `${message.title || ''}\n\n${message.content}`,
      };

      const info = await this.transporter.sendMail(mailOptions);
      
      logger.info('[GSMRS] 邮件发送成功', {
        messageId: message.id,
        messageId_email: info.messageId,
      });
      return true;
    } catch (error: any) {
      logger.error('[GSMRS] 发送邮件时出错', {
        error: error.message,
        messageId: message.id,
        data: safeLog(error),
      });
      return false;
    }
  }

  /**
   * Escape HTML to prevent injection
   */
  private escapeHtml(text: string): string {
    const map: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;',
    };
    return text.replace(/[&<>"']/g, (m) => map[m]);
  }

  /**
   * Health check - verify SMTP connection
   */
  async healthCheck(): Promise<boolean> {
    if (!this.enabled || !this.transporter) {
      return false;
    }

    try {
      await this.transporter.verify();
      return true;
    } catch (error: any) {
      logger.error('[GSMRS] 邮件服务健康检查失败', {
        error: error.message,
      });
      return false;
    }
  }

  /**
   * Test email sending
   */
  async sendTestEmail(): Promise<boolean> {
    const testMessage: NormalizedMessage = {
      id: 'test_' + Date.now(),
      source: 'internal',
      timestamp: Date.now(),
      title: 'Test Email from DS-GSMRS',
      content: 'This is a test email to verify the mail service configuration.',
      author: 'system',
      sanitized: true,
    };

    return this.sendEmail(testMessage);
  }
}

