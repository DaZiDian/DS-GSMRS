/**
 * 速率限制中间件
 * 
 * 原理：
 * - 使用滑动窗口算法限制每个 IP 的请求频率
 * - 基于内存 Map 存储每个 IP 的请求计数和重置时间
 * - 自动清理过期条目，防止内存泄漏
 * - 返回标准 HTTP 429 状态码和 Retry-After 头
 * 
 * 选型理由：
 * - 内存实现：简单高效，适合单机部署（可扩展为 Redis）
 * - 滑动窗口：比固定窗口更公平，防止突发流量
 * - Map 数据结构：O(1) 查找性能，适合高频请求场景
 */
import { Request, Response, NextFunction } from 'express';
import { ConfigLoader } from '../config/loader';
import { logger } from '../utils/logger';

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

class RateLimiter {
  private entries: Map<string, RateLimitEntry> = new Map();
  private maxRequests: number;
  private windowMs: number;

  constructor(maxRequests: number, windowMs: number) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;

    // Clean up old entries every minute
    setInterval(() => this.cleanup(), 60000);
  }

  check(identifier: string): boolean {
    const now = Date.now();
    const entry = this.entries.get(identifier);

    if (!entry || now > entry.resetTime) {
      // Create new entry or reset expired one
      this.entries.set(identifier, {
        count: 1,
        resetTime: now + this.windowMs,
      });
      return true;
    }

    if (entry.count >= this.maxRequests) {
      return false;
    }

    entry.count++;
    return true;
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.entries.entries()) {
      if (now > entry.resetTime) {
        this.entries.delete(key);
      }
    }
  }

  getRemaining(identifier: string): number {
    const entry = this.entries.get(identifier);
    if (!entry) {
      return this.maxRequests;
    }
    return Math.max(0, this.maxRequests - entry.count);
  }

  getResetTime(identifier: string): number {
    const entry = this.entries.get(identifier);
    if (!entry) {
      return Date.now() + this.windowMs;
    }
    return entry.resetTime;
  }
}

let rateLimiter: RateLimiter | null = null;

export function rateLimitMiddleware(req: Request, res: Response, next: NextFunction): void {
  const config = ConfigLoader.getConfig();
  const rateLimitConfig = config.security.rate_limit;

  if (!rateLimiter) {
    rateLimiter = new RateLimiter(rateLimitConfig.max, rateLimitConfig.window_ms);
  }

  // Use IP address as identifier
  const identifier = req.ip || req.socket.remoteAddress || 'unknown';

  if (!rateLimiter.check(identifier)) {
    const resetTime = rateLimiter.getResetTime(identifier);
    logger.warn('[GSMRS] 速率限制已超出', {
      ip: identifier,
      path: req.path,
      resetTime: new Date(resetTime).toISOString(),
    });

    res.status(429).json({
      error: 'Too Many Requests',
      message: 'Rate limit exceeded',
      retryAfter: Math.ceil((resetTime - Date.now()) / 1000),
    });
    return;
  }

  const remaining = rateLimiter.getRemaining(identifier);
  res.setHeader('X-RateLimit-Limit', rateLimitConfig.max.toString());
  res.setHeader('X-RateLimit-Remaining', remaining.toString());
  res.setHeader('X-RateLimit-Reset', rateLimiter.getResetTime(identifier).toString());

  next();
}

