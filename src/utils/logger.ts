/**
 * 日志工具模块
 * 
 * 原理：
 * - 使用 Winston 作为日志框架，提供多级别日志（info/warn/error）和多种输出目标
 * - 支持控制台输出（带颜色）和文件输出（按级别分离）
 * - 自动创建日志目录，支持日志文件轮转（最大5MB，保留5个文件）
 * 
 * 选型理由：
 * - Winston 是 Node.js 生态中最成熟和灵活的日志库
 * - 支持多种传输方式（控制台、文件、远程等），便于扩展
 * - 内置日志格式化和级别管理，减少手动处理
 * - 性能优秀，适合生产环境使用
 */
import * as winston from 'winston';
import * as path from 'path';
import * as fs from 'fs';

const logDir = path.join(process.cwd(), 'logs');

// 确保日志目录存在（Windows 兼容）
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

// 获取日志级别前缀
function getLevelPrefix(level: string): string {
  const upperLevel = level.toUpperCase();
  if (upperLevel.includes('ERROR')) return 'ERROR';
  if (upperLevel.includes('WARN')) return 'WARN';
  if (upperLevel.includes('INFO')) return 'INFO';
  if (upperLevel.includes('DEBUG')) return 'DEBUG';
  return 'INFO';
}

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.splat(),
    winston.format.json()
  ),
  defaultMeta: { service: 'ds-gsmrs' },
  transports: [
    // 控制台输出（带颜色和格式化）
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.printf((info: any) => {
          const { timestamp, level, message, ...meta } = info;
          const levelPrefix = getLevelPrefix(level);
          // 移除消息中可能已存在的 [GSMRS] 前缀（包括前后空格），避免重复
          const cleanMessage = typeof message === 'string' 
            ? message.replace(/^\s*\[GSMRS\]\s*/i, '').trim()
            : message;
          const metaStr = Object.keys(meta).length ? JSON.stringify(meta, null, 2) : '';
          return `${timestamp} [${levelPrefix}] - [GSMRS] ${cleanMessage}${metaStr ? ' ' + metaStr : ''}`;
        })
      ),
    }),
    // Write all logs with level 'error' and below to error.log
    new winston.transports.File({
      filename: path.join(logDir, 'error.log'),
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
    // Write all logs to combined.log
    new winston.transports.File({
      filename: path.join(logDir, 'combined.log'),
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
  ],
});

/**
 * 安全日志函数
 * 原理：递归遍历对象和字符串，自动隐藏敏感信息（token、password、secret等）
 * 用途：在记录日志前清理敏感数据，防止泄露
 */
export function safeLog(data: any): any {
  if (typeof data === 'string') {
    // Remove tokens and secrets from logs
    return data.replace(/(?:token|api[_-]?key|secret|password|passwd|pwd)\s*[:=]\s*[a-zA-Z0-9_\-]{20,}/gi, '***REDACTED***');
  }
  if (typeof data === 'object' && data !== null) {
    const sanitized: any = Array.isArray(data) ? [] : {};
    for (const key in data) {
      if (['token', 'password', 'secret', 'api_key', 'authorization'].includes(key.toLowerCase())) {
        sanitized[key] = '***REDACTED***';
      } else {
        sanitized[key] = safeLog(data[key]);
      }
    }
    return sanitized;
  }
  return data;
}

