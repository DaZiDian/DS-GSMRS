# 快速启动指南

## 前置要求

- Node.js >= 16.0.0
- npm 或 yarn

## 安装步骤

1. **安装依赖**
   ```bash
   npm install
   ```

2. **配置服务**
   
   复制配置文件并编辑：
   ```bash
   cp config.yaml.example config.yaml
   ```
   
   编辑 `config.yaml`，填入以下信息：
   - Telegram Bot Token（从 @BotFather 获取）
   - GitHub Personal Access Token
   - SMTP 邮件配置（如需要）
   - HMAC Secret（用于 webhook 验证）

3. **构建项目**
   ```bash
   npm run build
   ```

4. **启动服务**
   
   开发模式（自动重启）：
   ```bash
   npm run dev
   ```
   
   生产模式：
   ```bash
   npm start
   ```

## 配置 Webhook

### Telegram Bot Webhook

```bash
curl -X POST "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://your-domain.com/telegram/webhook"}'
```

### GitHub Webhook

1. 进入你的 GitHub 仓库
2. 点击 Settings → Webhooks → Add webhook
3. 配置：
   - Payload URL: `https://your-domain.com/github/webhook`
   - Content type: `application/json`
   - Secret: 与 `config.yaml` 中的 `security.hmac_secret` 保持一致
   - Events: 选择 `Issues` 和 `Issue comment`

## 测试

### 健康检查

```bash
# 检查所有服务状态
curl http://localhost:3000/api/health

# 检查 Telegram 服务
curl http://localhost:3000/telegram/health

# 检查 GitHub 服务
curl http://localhost:3000/github/health
```

### 发送测试消息

```bash
curl -X POST http://localhost:3000/api/send \
  -H "Content-Type: application/json" \
  -d '{
    "title": "测试消息",
    "content": "这是一条测试消息",
    "author": "测试用户",
    "target": "telegram"
  }'
```

## 常见问题

### 1. HMAC 验证失败

确保：
- GitHub Webhook Secret 与 `config.yaml` 中的 `security.hmac_secret` 一致
- Telegram Webhook 如果启用了 HMAC，也需要正确配置

### 2. IP 白名单限制

如果无法访问，检查 `config.yaml` 中的 `server.ip_whitelist` 配置，确保你的 IP 在列表中，或设置为空数组以允许所有 IP。

### 3. 消息未发送

检查：
- 对应服务的 `enable` 配置是否为 `true`
- Token 和配置是否正确
- 查看日志文件 `logs/combined.log` 或 `logs/error.log`

## 日志

日志文件位于 `logs/` 目录：
- `combined.log` - 所有日志
- `error.log` - 仅错误日志

## 生产环境建议

1. **使用 HTTPS**：通过 Nginx 或 Cloudflare 配置反向代理
2. **修改 HMAC Secret**：使用强随机字符串
3. **配置 IP 白名单**：限制访问来源
4. **监控日志**：定期检查错误日志
5. **使用进程管理器**：使用 PM2 或 systemd 管理服务

```bash
# 使用 PM2 启动
npm install -g pm2
pm2 start dist/index.js --name ds-gsmrs
pm2 save
pm2 startup
```

