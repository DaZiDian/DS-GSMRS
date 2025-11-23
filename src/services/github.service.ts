/**
 * GitHub 服务模块
 * 
 * 原理：
 * - 通过 GitHub REST API 在指定仓库的 Issue 中创建评论
 * - 使用内存 Set 实现事件去重，防止重复处理同一事件
 * - 自动识别 Bot 用户，避免无限循环（Bot 触发事件 -> 发送消息 -> 触发新事件）
 * - 支持创建新 Issue 或在现有 Issue 中评论
 * 
 * 选型理由：
 * - GitHub REST API：官方 API，功能完整，文档完善
 * - Set 数据结构：O(1) 查找性能，适合去重场景
 * - 内存去重：简单高效，适合中小规模应用（可扩展为 Redis）
 */
import axios, { AxiosInstance } from 'axios';
import { NormalizedMessage } from '../types';
import { ConfigLoader } from '../config/loader';
import { logger, safeLog } from '../utils/logger';

export class GitHubService {
  private token: string;
  private repo: string;
  private issueNumber: number;
  private api: AxiosInstance;
  private enabled: boolean;
  private processedEvents: Set<string> = new Set();

  constructor() {
    const config = ConfigLoader.getConfig();
    this.enabled = config.github?.enable ?? false;
    this.token = config.github?.token || '';
    this.repo = config.github?.repo || '';
    this.issueNumber = config.github?.issue_number || 1;

    if (!this.token || !this.repo) {
      logger.warn('[GSMRS] GitHub Token 或仓库未配置');
    }

    this.api = axios.create({
      baseURL: 'https://api.github.com',
      timeout: 15000,
      headers: {
        'Authorization': `token ${this.token}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'DS-GSMRS/1.0',
      },
    });
  }

  /**
   * Create or update issue comment
   */
  async postComment(message: NormalizedMessage): Promise<boolean> {
    if (!this.enabled || !this.token || !this.repo) {
      logger.warn('[GSMRS] GitHub 服务已禁用或未配置');
      return false;
    }

    try {
      // Format message
      let body = '';
      if (message.title) {
        body += `## ${message.title}\n\n`;
      }
      body += message.content;
      if (message.author) {
        body += `\n\n---\n_From: ${message.author}_`;
      }
      if (message.source) {
        body += `\n_Source: ${message.source}_`;
      }

      const response = await this.api.post(
        `/repos/${this.repo}/issues/${this.issueNumber}/comments`,
        { body }
      );

      if (response.status === 201) {
        logger.info(`[GSMRS] 评论已发布到 GitHub Issue #${this.issueNumber}`, {
          messageId: message.id,
          commentId: response.data.id,
        });
        return true;
      } else {
        logger.error('[GSMRS] 发布 GitHub 评论失败', {
          status: response.status,
          messageId: message.id,
        });
        return false;
      }
    } catch (error: any) {
      logger.error('[GSMRS] 发布 GitHub 评论时出错', {
        error: error.message,
        messageId: message.id,
        data: safeLog(error.response?.data),
      });
      return false;
    }
  }

  /**
   * Create a new issue
   */
  async createIssue(message: NormalizedMessage): Promise<boolean> {
    if (!this.enabled || !this.token || !this.repo) {
      logger.warn('[GSMRS] GitHub 服务已禁用或未配置');
      return false;
    }

    try {
      const title = message.title || `Message from ${message.source}`;
      let body = message.content;
      if (message.author) {
        body += `\n\n---\n_From: ${message.author}_`;
      }
      if (message.source) {
        body += `\n_Source: ${message.source}_`;
      }

      const response = await this.api.post(`/repos/${this.repo}/issues`, {
        title,
        body,
        labels: ['notification'],
      });

      if (response.status === 201) {
        logger.info(`[GSMRS] GitHub Issue 已创建`, {
          messageId: message.id,
          issueNumber: response.data.number,
        });
        return true;
      } else {
        logger.error('[GSMRS] 创建 GitHub Issue 失败', {
          status: response.status,
          messageId: message.id,
        });
        return false;
      }
    } catch (error: any) {
      logger.error('[GSMRS] 创建 GitHub Issue 时出错', {
        error: error.message,
        messageId: message.id,
        data: safeLog(error.response?.data),
      });
      return false;
    }
  }

  /**
   * Check if event was already processed (deduplication)
   */
  isEventProcessed(eventId: string): boolean {
    return this.processedEvents.has(eventId);
  }

  /**
   * Mark event as processed
   */
  markEventProcessed(eventId: string): void {
    this.processedEvents.add(eventId);
    // Keep only last 1000 events in memory
    if (this.processedEvents.size > 1000) {
      const first = this.processedEvents.values().next().value;
      if (first) {
        this.processedEvents.delete(first);
      }
    }
  }

  /**
   * Check if sender is a bot (to prevent infinite loops)
   */
  isBotUser(sender: any): boolean {
    return sender?.type === 'Bot' || sender?.login?.endsWith('[bot]');
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<boolean> {
    if (!this.enabled || !this.token || !this.repo) {
      return false;
    }

    try {
      const response = await this.api.get(`/repos/${this.repo}`);
      return response.status === 200;
    } catch (error: any) {
      logger.error('[GSMRS] GitHub 健康检查失败', {
        error: error.message,
      });
      return false;
    }
  }
}

