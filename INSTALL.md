# 安装和运行指南（Windows 11）

## 前置要求

- Node.js >= 16.0.0
- npm 或 yarn
- Windows 11

## 安装步骤

### 1. 安装依赖

在项目根目录打开 PowerShell 或 CMD，运行：

```powershell
npm install
```

### 2. 配置服务

复制配置文件：

```powershell
Copy-Item config.yaml.example config.yaml
```

编辑 `config.yaml`，填入以下信息：

- **Telegram Bot Token**：从 [@BotFather](https://t.me/BotFather) 获取
- **GitHub Personal Access Token**：从 GitHub Settings → Developer settings → Personal access tokens 创建
- **SMTP 邮件配置**（如需要）：填入你的邮件服务器信息
- **HMAC Secret**：用于 Webhook 验证的密钥（生产环境必须修改）

### 3. 构建项目

```powershell
npm run build
```

### 4. 启动服务

**开发模式（自动重启）：**
```powershell
npm run dev
```

**生产模式：**
```powershell
npm start
```

服务将在 `http://localhost:3000` 启动（或配置文件中指定的端口）。

## Windows 11 特定说明

### 防火墙配置

如果需要在局域网中访问，需要允许 Node.js 通过防火墙：

1. 打开 Windows 安全中心
2. 防火墙和网络保护 → 高级设置
3. 入站规则 → 新建规则
4. 选择"程序" → 浏览到 Node.js 安装路径
5. 允许连接

### 端口占用检查

如果端口被占用，可以使用以下命令检查：

```powershell
netstat -ano | findstr :3000
```

### 后台运行（可选）

使用 PM2 在后台运行服务：

```powershell
# 全局安装 PM2
npm install -g pm2

# 启动服务
pm2 start dist/index.js --name ds-gsmrs

# 查看状态
pm2 status

# 查看日志
pm2 logs ds-gsmrs

# 停止服务
pm2 stop ds-gsmrs
```

## 测试

### 健康检查

```powershell
# 检查所有服务状态
Invoke-WebRequest -Uri http://localhost:3000/api/health | ConvertFrom-Json

# 检查 Telegram 服务
Invoke-WebRequest -Uri http://localhost:3000/telegram/health | ConvertFrom-Json

# 检查 GitHub 服务
Invoke-WebRequest -Uri http://localhost:3000/github/health | ConvertFrom-Json
```

### 发送测试消息

```powershell
$body = @{
    title = "测试消息"
    content = "这是一条测试消息"
    author = "测试用户"
    target = "telegram"
} | ConvertTo-Json

Invoke-WebRequest -Uri http://localhost:3000/api/send `
    -Method POST `
    -ContentType "application/json" `
    -Body $body
```

## 常见问题

### 1. 模块找不到错误

如果遇到 "Cannot find module" 错误，确保已运行 `npm install`。

### 2. 配置文件找不到

确保 `config.yaml` 文件在项目根目录，且文件名正确。

### 3. 端口被占用

修改 `config.yaml` 中的 `server.port` 为其他端口（如 3001）。

### 4. HMAC 验证失败

确保：
- GitHub Webhook Secret 与 `config.yaml` 中的 `security.hmac_secret` 一致
- 如果不需要 HMAC 验证，设置 `security.enable_hmac: false`

### 5. IP 白名单限制

如果无法访问，检查 `config.yaml` 中的 `server.ip_whitelist`：
- 设置为空数组 `[]` 以允许所有 IP
- 或添加你的 IP 地址

## 日志文件

日志文件位于 `logs/` 目录：
- `combined.log` - 所有日志
- `error.log` - 仅错误日志

## 下一步

配置 Webhook：
- [Telegram Bot Webhook 配置](README.md#telegram-bot-webhook)
- [GitHub Webhook 配置](README.md#github-webhook)

