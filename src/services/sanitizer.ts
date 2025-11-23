/**
 * 消息清理与标准化模块
 * 
 * 原理：
 * - 消息标准化：将不同来源（Telegram、GitHub、API）的消息转换为统一格式
 * - 敏感信息隐藏：使用正则表达式匹配并替换敏感数据（Token、邮箱、电话等）
 * - HTML/Markdown 清理：移除 HTML 标签，转义特殊字符，防止注入攻击
 * - Spam 检测：基于关键词列表检测垃圾消息
 * 
 * 选型理由：
 * - 正则表达式：性能好，匹配准确，适合文本处理
 * - 静态方法：无需实例化，使用方便，内存占用小
 * - 模块化设计：清理逻辑集中管理，便于维护和扩展
 */
import { NormalizedMessage } from '../types';

export class MessageSanitizer {
  private static readonly SENSITIVE_PATTERNS = [
    // API Tokens (GitHub, Telegram, etc.)
    /(?:token|api[_-]?key|secret|password|passwd|pwd)\s*[:=]\s*([a-zA-Z0-9_\-]{20,})/gi,
    // Email addresses
    /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g,
    // Phone numbers
    /(\+?\d{1,3}[-.\s]?\(?\d{1,4}\)?[-.\s]?\d{1,4}[-.\s]?\d{1,9})/g,
    // Credit card numbers (basic pattern)
    /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g,
  ];

  private static readonly SPAM_KEYWORDS = [
    'spam', 'scam', 'phishing', 'malware', 'virus',
    'click here', 'limited time', 'act now', 'urgent',
  ];

  /**
   * Hide sensitive information in text
   */
  static hideSensitive(text: string): string {
    let sanitized = text;

    // Hide tokens and secrets
    sanitized = sanitized.replace(
      /(?:token|api[_-]?key|secret|password|passwd|pwd)\s*[:=]\s*([a-zA-Z0-9_\-]{20,})/gi,
      (match, token) => {
        if (token.length > 8) {
          return match.replace(token, `${token.substring(0, 2)}****${token.substring(token.length - 2)}`);
        }
        return match.replace(token, '****');
      }
    );

    // Hide email addresses
    sanitized = sanitized.replace(
      /([a-zA-Z0-9._%+-]+)@([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g,
      (match, user, domain) => {
        const hiddenUser = user.length > 2 
          ? `${user.substring(0, 2)}****` 
          : '****';
        return `${hiddenUser}@${domain}`;
      }
    );

    // Hide phone numbers
    sanitized = sanitized.replace(
      /(\+?\d{1,3}[-.\s]?\(?\d{1,4}\)?[-.\s]?\d{1,4}[-.\s]?\d{1,9})/g,
      (match) => {
        const digits = match.replace(/\D/g, '');
        if (digits.length > 4) {
          return `${digits.substring(0, 2)}****${digits.substring(digits.length - 2)}`;
        }
        return '****';
      }
    );

    return sanitized;
  }

  /**
   * Check if message contains spam keywords
   */
  static isSpam(text: string): boolean {
    const lowerText = text.toLowerCase();
    return this.SPAM_KEYWORDS.some(keyword => lowerText.includes(keyword));
  }

  /**
   * Clean HTML tags
   */
  static stripHtml(html: string): string {
    return html.replace(/<[^>]*>/g, '').replace(/&[^;]+;/g, '');
  }

  /**
   * Escape markdown special characters
   */
  static escapeMarkdown(text: string): string {
    return text.replace(/([_*\[\]()~`>#+\-=|{}.!])/g, '\\$1');
  }

  /**
   * Sanitize message content
   */
  static sanitizeMessage(message: NormalizedMessage, hideSensitive: boolean = true): NormalizedMessage {
    let content = message.content;
    let title = message.title;

    // Strip HTML if present
    content = this.stripHtml(content);
    if (title) {
      title = this.stripHtml(title);
    }

    // Hide sensitive information
    if (hideSensitive) {
      content = this.hideSensitive(content);
      if (title) {
        title = this.hideSensitive(title);
      }
    }

    return {
      ...message,
      content,
      title,
      sanitized: true,
    };
  }

  /**
   * Normalize message from different sources
   */
  static normalize(
    source: 'telegram' | 'github' | 'api' | 'internal',
    rawData: any
  ): NormalizedMessage {
    const id = `${source}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const timestamp = Date.now();

    let title: string | undefined;
    let content: string = '';
    let author: string | undefined;
    let metadata: Record<string, any> = {};

    switch (source) {
      case 'telegram':
        if (rawData.message) {
          content = rawData.message.text || '';
          author = rawData.message.from?.username || rawData.message.from?.first_name;
          metadata.chatId = rawData.message.chat?.id;
          metadata.messageId = rawData.message.message_id;
        }
        break;

      case 'github':
        if (rawData.issue) {
          title = rawData.issue.title;
          content = rawData.issue.body || '';
          author = rawData.issue.user?.login;
          metadata.issueNumber = rawData.issue.number;
          metadata.repository = rawData.repository?.full_name;
          metadata.action = rawData.action;
        }
        break;

      case 'api':
        title = rawData.title;
        content = rawData.content || rawData.message || '';
        author = rawData.author;
        metadata = rawData.metadata ? { ...rawData.metadata } : {};
        break;

      case 'internal':
        title = rawData.title;
        content = rawData.content || rawData.message || '';
        author = rawData.author || 'system';
        metadata = rawData.metadata ? { ...rawData.metadata } : {};
        break;
    }

    return {
      id,
      source,
      timestamp,
      title,
      content,
      author,
      metadata,
      sanitized: false,
    };
  }
}

