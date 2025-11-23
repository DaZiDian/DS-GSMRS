/**
 * Telegram 服务模块
 * 
 * 原理：
 * - 通过 Telegram Bot API 发送消息到指定聊天（群组或频道）
 * - 使用 Axios 发送 HTTP 请求到 Telegram API
 * - 支持 MarkdownV2 格式，自动转义特殊字符防止格式错误
 * - 提供健康检查功能，验证 Bot Token 有效性
 * 
 * 选型理由：
 * - Axios：比原生 fetch 更易用，支持拦截器、超时控制等功能
 * - Telegram Bot API：官方 API，稳定可靠，功能完整
 * - MarkdownV2：Telegram 推荐格式，支持丰富的文本样式
 */
import axios, { AxiosInstance } from 'axios';
import { NormalizedMessage } from '../types';
import { ConfigLoader } from '../config/loader';
import { logger, safeLog } from '../utils/logger';

export class TelegramService {
  private botToken: string;
  private defaultChatId: number;
  private api: AxiosInstance;
  private enabled: boolean;

  constructor() {
    const config = ConfigLoader.getConfig();
    this.enabled = config.telegram?.enable ?? false;
    this.botToken = config.telegram?.token || '';
    this.defaultChatId = config.telegram?.default_target_chat || 0;

    if (!this.botToken) {
      logger.warn('[GSMRS] Telegram Bot Token 未配置');
    }

    this.api = axios.create({
      baseURL: `https://api.telegram.org/bot${this.botToken}`,
      timeout: 10000,
    });
  }

  /**
   * Send message to Telegram
   */
  async sendMessage(message: NormalizedMessage, chatId?: number): Promise<boolean> {
    if (!this.enabled || !this.botToken) {
      logger.warn('[GSMRS] Telegram 服务已禁用或未配置');
      return false;
    }

    const targetChatId = chatId || this.defaultChatId;
    if (!targetChatId) {
      logger.error('[GSMRS] 未指定目标聊天 ID');
      return false;
    }

    try {
      // Format message
      let text = '';
      if (message.title) {
        text += `*${message.title}*\n\n`;
      }
      text += message.content;
      if (message.author) {
        text += `\n\n_From: ${message.author}_`;
      }

      // Escape markdown special characters
      text = text.replace(/([_*\[\]()~`>#+\-=|{}.!])/g, '\\$1');

      const response = await this.api.post('/sendMessage', {
        chat_id: targetChatId,
        text,
        parse_mode: 'MarkdownV2',
        disable_web_page_preview: true,
      });

      if (response.data.ok) {
        logger.info(`[GSMRS] 消息已发送到 Telegram 聊天 ${targetChatId}`, {
          messageId: message.id,
        });
        return true;
      } else {
        logger.error('[GSMRS] 发送 Telegram 消息失败', {
          error: response.data.description,
          messageId: message.id,
        });
        return false;
      }
    } catch (error: any) {
      logger.error('[GSMRS] 发送 Telegram 消息时出错', {
        error: error.message,
        messageId: message.id,
        data: safeLog(error.response?.data),
      });
      return false;
    }
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<boolean> {
    if (!this.enabled || !this.botToken) {
      return false;
    }

    try {
      const response = await this.api.get('/getMe');
      return response.data.ok === true;
    } catch (error: any) {
      logger.error('[GSMRS] Telegram 健康检查失败', {
        error: error.message,
      });
      return false;
    }
  }

  /**
   * Get bot info
   */
  async getBotInfo(): Promise<any> {
    if (!this.enabled || !this.botToken) {
      return null;
    }

    try {
      const response = await this.api.get('/getMe');
      if (response.data.ok) {
        return response.data.result;
      }
      return null;
    } catch (error: any) {
      logger.error('[GSMRS] 获取 Bot 信息失败', { error: error.message });
      return null;
    }
  }
}

