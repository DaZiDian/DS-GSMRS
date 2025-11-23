/**
 * HMAC 签名验证中间件
 * 
 * 原理：
 * - 使用 HMAC-SHA256 算法验证 Webhook 请求的完整性
 * - 从请求头获取签名，使用配置的密钥计算期望签名
 * - 使用 timingSafeEqual 进行常量时间比较，防止时序攻击
 * - 支持 GitHub (x-hub-signature-256) 和自定义 (x-signature) 签名头
 * 
 * 选型理由：
 * - HMAC-SHA256：行业标准，安全性高，GitHub/Telegram 等平台都支持
 * - crypto.timingSafeEqual：防止时序攻击，提高安全性
 * - 中间件模式：可配置启用/禁用，不影响其他功能
 */
import { Request, Response, NextFunction } from 'express';
import * as crypto from 'crypto';
import { ConfigLoader } from '../config/loader';
import { logger } from '../utils/logger';

export function hmacMiddleware(req: Request, res: Response, next: NextFunction): void {
  const config = ConfigLoader.getConfig();

  if (!config.security.enable_hmac) {
    return next();
  }

  const signature = req.headers['x-hub-signature-256'] || req.headers['x-signature'];
  const secret = config.security.hmac_secret;

  if (!signature || !secret) {
    logger.warn('[GSMRS] HMAC 验证失败：缺少签名或密钥');
    res.status(401).json({ error: 'Unauthorized: HMAC signature required' });
    return;
  }

  // Get raw body (should be available if body-parser is configured with verify)
  const rawBody = (req as any).rawBody || JSON.stringify(req.body);
  
  // Calculate expected signature
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(rawBody);
  const expectedSignature = 'sha256=' + hmac.digest('hex');

  // Compare signatures
  const providedSignature = Array.isArray(signature) ? signature[0] : signature;
  
  if (!crypto.timingSafeEqual(
    Buffer.from(expectedSignature),
    Buffer.from(providedSignature)
  )) {
    logger.warn('[GSMRS] HMAC 验证失败：签名不匹配', {
      ip: req.ip,
      path: req.path,
    });
    res.status(401).json({ error: 'Unauthorized: Invalid HMAC signature' });
    return;
  }

  logger.debug('[GSMRS] HMAC 验证通过');
  next();
}

