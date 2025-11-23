/**
 * IP 白名单中间件
 * 
 * 原理：
 * - 从请求中提取客户端 IP（支持代理场景下的 X-Forwarded-For 头）
 * - 检查 IP 是否在配置的白名单中
 * - 支持 IPv4 和 IPv6，自动处理 localhost 变体
 * - 如果未配置白名单，则允许所有 IP（便于开发测试）
 * 
 * 选型理由：
 * - 简单高效：直接字符串匹配，性能开销小
 * - 灵活配置：支持空列表（允许所有）或精确匹配
 * - 代理兼容：正确处理反向代理场景下的真实 IP
 */
import { Request, Response, NextFunction } from 'express';
import { ConfigLoader } from '../config/loader';
import { logger } from '../utils/logger';

export function ipWhitelistMiddleware(req: Request, res: Response, next: NextFunction): void {
  const config = ConfigLoader.getConfig();
  const whitelist = config.server.ip_whitelist;

  // If no whitelist configured, allow all
  if (!whitelist || whitelist.length === 0) {
    return next();
  }

  const clientIp = req.ip || 
                   req.socket.remoteAddress || 
                   (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
                   'unknown';

  // Check if IP is in whitelist
  const isAllowed = whitelist.some(allowedIp => {
    // Support CIDR notation in future, for now just exact match
    if (allowedIp === clientIp) {
      return true;
    }
    // Support IPv6 localhost variants
    if ((allowedIp === '::1' || allowedIp === '127.0.0.1') && 
        (clientIp === '::1' || clientIp === '127.0.0.1' || clientIp === '::ffff:127.0.0.1')) {
      return true;
    }
    return false;
  });

  if (!isAllowed) {
    logger.warn('[GSMRS] IP 不在白名单中', {
      ip: clientIp,
      path: req.path,
      whitelist,
    });
    res.status(403).json({ error: 'Forbidden: IP address not allowed' });
    return;
  }

  next();
}

