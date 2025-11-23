# **Github 智能消息代理服务（Github Secure Message Relay Service）**

**版本：v1.0**  
 **作者：DZ1D 项目组**  
 **状态：已完成**

**项目地址：[DaZiDian/DS_GSMRS: DS_GSMRS(Github Secure Message Relay Service)](https://github.com/DaZiDian/DS_GSMRS)**

------

## 📌 **项目简介**

该项目是一个基于 Node.js + TypeScript 的 **智能消息代理服务（Message Relay Service）**，用于在多个平台之间安全地转发消息，包括：

- Telegram Bot
- GitHub Issues / Discussions
- 邮件（SMTP）
- 内部 API 回调服务
- 自定义通道（未来扩展）

此服务旨在用最轻量与最灵活的方式实现 **跨平台消息整合与统一推送**，同时高度关注：

✔ **安全性**：避免消息泄露、被窃听、被恶意滥用  
 ✔ **可靠性**：支持队列重试、速率限制、防伪签  
 ✔ **扩展性**：模块化架构，便于未来支持更多平台  
 ✔ **隐私性**：自动敏感字段隐藏、安全日志与加密配置

------

## ✨ **核心功能**

### 1. **多平台消息转发**

支持从任意输入源将消息同步/转发至以下目标：

| 输入来源              | 输出支持平台                        |
| --------------------- | ----------------------------------- |
| Telegram Bot Webhook  | Telegram / GitHub / 邮件 / 本地 API |
| GitHub Issues Webhook | Telegram / 邮件                     |
| 外部 HTTP API         | 全部平台                            |
| 内部事件              | 全部平台                            |

------

### 2. **消息格式统一化（Message Normalization）**

所有消息均会经过统一格式处理：

- 标准化消息 JSON
- 清理 HTML / Markdown
- 防止格式注入
- 自动识别来源平台
- 支持模板化输出

------

### 3. **可选的消息过滤与敏感信息保护**

系统内置：

- API Token / 密码 / 邮箱 / 电话号码自动隐藏（如：`abcd1234` → `ab****34`）
- 正则敏感信息检查
- 敏感字段上报警告

------

### 4. **安全性增强**

系统提供以下安全功能：

#### ✔ HMAC 签名校验（防伪装 Webhook）

所有外部请求可启用 HMAC-SHA256 校验。

#### ✔ 允许 IP 白名单 / 黑名单

支持限制可访问 API 的来源。

#### ✔ GitHub / 邮件误报处理

- 提供消息重复检测（避免 GH 重复触发 events）
- 邮件标题自动过滤系统误报关键字
- 提供隔离队列（quarantine queue）处理不确定消息

#### ✔ 全站 HTTPS 强制

支持 behind Nginx / Cloudflare。

#### ✔ 队列与重试

- 对 Telegram / GitHub / 邮件 推送失败进行指数回退重试
- 防止平台临时错误导致消息丢失

------

### 5. **队列系统（可选启用）**

内置 Memory Queue，可扩展 Redis。

提供：

- 延迟重试
- 顺序保障
- 死信队列（DLQ）

------

## 🏗 **系统架构图**

```
         ┌──────────────┐
         │ Telegram Bot │
         └───────┬──────┘
                 │
         ┌───────▼────────┐
         │ Webhook Router │
         └───────┬────────┘
                 │ Normalized Message
         ┌───────▼─────────┐
         │  Message Engine │
         └───────┬─────────┘
     ┌───────────┼─────────────┐
     ▼           ▼             ▼
┌────────────┐ ┌────────────┐ ┌──────────────┐
│ Telegram   │ │ GitHub API │ │ SMTP Mailer  │
└────────────┘ └────────────┘ └──────────────┘
```

## 🛠 技术栈

| 技术栈               | 用途          |
| -------------------- | ------------- |
| Node.js + TypeScript | 主服务逻辑    |
| Express              | HTTP 服务     |
| Axios                | 外部 API 请求 |
| Nodemailer           | SMTP 邮件推送 |
| js-yaml              | 解析配置      |
| crypto               | HMAC 校验     |
| winston              | 日志系统      |

------

## 📁 **项目目录结构**

```
ds_gsmrs/
├── src/
│   ├── index.ts                    # 主入口文件
│   ├── config/
│   │   └── loader.ts               # 配置加载器
│   ├── routers/
│   │   ├── telegram.router.ts      # Telegram 路由
│   │   ├── github.router.ts        # GitHub 路由
│   │   └── api.router.ts           # API 路由
│   ├── services/
│   │   ├── telegram.service.ts     # Telegram 服务
│   │   ├── github.service.ts       # GitHub 服务
│   │   ├── mail.service.ts         # 邮件服务
│   │   └── sanitizer.ts            # 消息清理与标准化
│   ├── middlewares/
│   │   ├── hmac.ts                 # HMAC 验证中间件
│   │   ├── rateLimit.ts            # 速率限制中间件
│   │   └── ipWhitelist.ts          # IP 白名单中间件
│   ├── utils/
│   │   └── logger.ts               # 日志工具
│   ├── queue/
│   │   └── memoryQueue.ts          # 内存队列
│   └── types/
│       └── index.ts                # TypeScript 类型定义
├── config.yaml                     # 配置文件
├── config.yaml.example             # 配置示例文件
├── package.json
├── tsconfig.json
└── README.md
```

------

## ⚙️ **配置说明**

配置文件使用 YAML 格式，位于项目根目录的 `config.yaml`。

```yaml
server:
  port: 3000
  https: false
  ip_whitelist:
    - "127.0.0.1"
    - "::1"

security:
  enable_hmac: true
  hmac_secret: "your_hmac_secret_here_change_this_in_production"
  hide_sensitive: true
  rate_limit:
    max: 100
    window_ms: 60000

telegram:
  token: "YOUR_TELEGRAM_BOT_TOKEN"
  enable: true
  default_target_chat: -100123456789

github:
  token: "YOUR_GITHUB_TOKEN"
  enable: true
  repo: "your/repo"
  issue_number: 1

mail:
  enable: false
  smtp:
    host: smtp.example.com
    port: 465
    secure: true
    user: your@example.com
    pass: "password"
  to: admin@example.com
```

### 配置项说明

- **server.port**: 服务监听端口
- **server.https**: 是否启用 HTTPS（建议通过反向代理实现）
- **server.ip_whitelist**: IP 白名单（空数组表示允许所有 IP）
- **security.enable_hmac**: 是否启用 HMAC 签名验证
- **security.hmac_secret**: HMAC 密钥（生产环境必须修改）
- **security.hide_sensitive**: 是否自动隐藏敏感信息
- **security.rate_limit**: 速率限制配置
- **telegram/github/mail**: 各平台配置，`enable: false` 可禁用对应平台

------

## 🚀 **快速启动**

### 1. 安装依赖

```bash
npm install
```

### 2. 配置服务

复制 `config.yaml.example` 为 `config.yaml`，并根据实际情况修改配置：

```bash
cp config.yaml.example config.yaml
# 编辑 config.yaml，填入你的 Token、密钥等信息
```

### 3. 构建项目

```bash
npm run build
```

### 4. 启动服务

**生产环境：**
```bash
npm start
```

**开发环境（自动重启）：**
```bash
npm run dev
```

### 5. 配置 Webhook

#### Telegram Bot Webhook

```bash
curl -X POST "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook" \
  -d "url=https://your-domain.com/telegram/webhook"
```

#### GitHub Webhook

在 GitHub 仓库设置中添加 Webhook：
- URL: `https://your-domain.com/github/webhook`
- Content type: `application/json`
- Secret: 与 `config.yaml` 中的 `security.hmac_secret` 保持一致
- Events: 选择 `Issues` 和 `Issue comment`

------

## 🔒 **安全建议**

### 1. 避免消息被窃听

- 强制 HTTPS 环境（建议通过 Nginx / Caddy / Cloudflare）
- HMAC-SHA256 验证 webhook
- IP 白名单限制
- 敏感信息脱敏（token / email / phone）

------

### 2. 防止 GitHub 误报 / 重复触发

GitHub Webhook 常见误报问题：

| 问题                 | 解决方式             |
| -------------------- | -------------------- |
| 重复推送同一事件     | 使用 event ID 去重   |
| Bot 触发导致无限循环 | Auto-ignore bot user |
| 垃圾 Issue / Spam    | 启用斜杠过滤规则     |

------

### 3. 防止邮件误报

- 自动检测 SPAM 词汇并加入隔离队列
- 强制 MIME Sanitizer
- 邮件标题自动逃逸危险字符
- 多 SMTP 备用通道

------

### 4. 日志安全

默认日志策略：

- 不记录完整消息正文
- 不记录 Token / Authorization header
- 日志自动按天切割
- 支持输出到本地或远程（如 Loki / Elastic）

------

## 📡 **API 端点**

### 通用 API

- `POST /api/send` - 发送消息到指定目标
  ```json
  {
    "title": "消息标题",
    "content": "消息内容",
    "author": "作者",
    "target": "telegram|github|mail" // 可选，不指定则发送到所有启用的目标
  }
  ```

- `GET /api/health` - 健康检查
- `GET /api/queue/stats` - 获取队列统计
- `GET /api/queue/dlq` - 获取死信队列

### Telegram

- `POST /telegram/webhook` - Telegram Bot Webhook
- `GET /telegram/health` - Telegram 服务健康检查

### GitHub

- `POST /github/webhook` - GitHub Webhook
- `GET /github/health` - GitHub 服务健康检查

------

## 🧪 **测试说明**

内置了：

- Telegram 健康检查接口：`/telegram/health`
- GitHub API 联通性测试：`/github/health`
- 邮件发送测试：通过 `/api/send` 发送到 mail 目标
- HMAC 校验测试：使用错误的签名访问 webhook
- Rate Limit 压力测试：快速发送多个请求到 `/api/send`

------

## 🔧 **未来扩展功能**

- Discord / Slack / 飞书 / 企业微信 推送
- 支持 Redis 队列
- 提供 Web Dashboard（状态监控）
- 消息搜索与日志持久化
- AI 自动分类消息（Spam 检测 / 意图识别）

------

## 📄 **许可证**

MIT License

### DaZiDian & DSMCC ©2007-present  All Copyrights Reserved.
