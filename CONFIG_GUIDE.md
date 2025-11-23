# 配置指南

本文档提供配置文件中各项设置的详细说明和获取方式。

## 📋 快速链接

### Telegram Bot
- **创建 Bot**: [@BotFather](https://t.me/BotFather)
- **官方文档**: https://core.telegram.org/bots/tutorial
- **API 文档**: https://core.telegram.org/bots/api
- **获取聊天 ID**: https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getUpdates

### GitHub
- **创建 Token**: https://github.com/settings/tokens/new
- **官方文档**: https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/creating-a-personal-access-token
- **Webhook 文档**: https://docs.github.com/en/webhooks/using-webhooks/validating-webhook-deliveries

### 邮件服务
- **Gmail 应用密码**: https://support.google.com/accounts/answer/185833
- **QQ 邮箱授权码**: https://service.mail.qq.com/cgi-bin/help?subtype=1&&id=28&&no=1001256
- **163 邮箱授权码**: https://help.mail.163.com/faqDetail.do?code=d7a5dc8471cd0c0e8b4b8f4f8e49998b374173cfe9171305fa1ce630d7f68ac2c
- **Nodemailer 文档**: https://nodemailer.com/smtp/

## 🔑 配置项说明

### 1. Telegram Bot Token

**获取步骤：**
1. 在 Telegram 中搜索并打开 [@BotFather](https://t.me/BotFather)
2. 发送 `/newbot` 命令
3. 按照提示设置 Bot 名称（如：My Notification Bot）
4. 设置 Bot 用户名（必须以 `bot` 结尾，如：my_notification_bot）
5. BotFather 会返回 Bot Token，格式类似：`123456789:ABCdefGHIjklMNOpqrsTUVwxyz`
6. 复制 Token 并保存到配置文件

**注意事项：**
- Token 是敏感信息，不要泄露
- 如果 Token 泄露，立即在 BotFather 中撤销并重新生成

### 2. Telegram 聊天 ID

**获取步骤：**
1. 将 Bot 添加到目标群组或频道
2. 在群组中发送任意消息（或让 Bot 发送消息）
3. 访问：`https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getUpdates`
4. 在返回的 JSON 中找到 `"chat":{"id":-100123456789}`
5. 复制这个 ID 到配置文件

**ID 格式说明：**
- 群组 ID：负数（如 `-100123456789`）
- 频道 ID：负数（如 `-100123456789`）
- 个人聊天 ID：正数（如 `123456789`）

**替代方法：**
- 使用 [@userinfobot](https://t.me/userinfobot) 在群组中获取

### 3. GitHub Personal Access Token

**获取步骤：**
1. 登录 GitHub，点击右上角头像 → **Settings**
2. 左侧菜单找到 **Developer settings**
3. 选择 **Personal access tokens** → **Tokens (classic)**
4. 点击 **Generate new token (classic)**
5. 设置：
   - **Note**: Token 名称（如：DS-GSMRS）
   - **Expiration**: 过期时间（建议选择较长时间）
   - **Select scopes**: 至少勾选 `repo` 权限（或仅 `issues:write`）
6. 点击 **Generate token**
7. ⚠️ **重要**：立即复制 Token，离开页面后将无法再次查看

**权限说明：**
- `repo`: 完整仓库访问权限（推荐）
- `issues:write`: 仅 Issue 相关权限（最小权限）

### 4. GitHub 仓库和 Issue

**仓库格式：**
- 格式：`owner/repo`
- 示例：`octocat/Hello-World`、`your-username/your-repo`

**创建 Issue：**
1. 进入目标仓库
2. 点击 **Issues** 标签
3. 点击 **New Issue**
4. 填写标题和内容
5. 创建后，Issue 编号会显示在 URL 中（如：`#1`）

### 5. HMAC Secret

**生成方式：**

**Linux/Mac:**
```bash
openssl rand -hex 32
```

**Windows PowerShell:**
```powershell
-join ((48..57) + (65..90) + (97..122) | Get-Random -Count 32 | % {[char]$_})
```

**在线工具：**
- https://www.random.org/strings/
- 设置：长度 32，字符集选择字母和数字

**注意事项：**
- 必须与 GitHub Webhook Secret 保持一致
- 生产环境必须使用强随机字符串
- 长度建议至少 32 个字符

### 6. SMTP 邮件配置

**常见邮件服务商配置：**

#### Gmail
```yaml
host: smtp.gmail.com
port: 465
secure: true
user: your-email@gmail.com
pass: "应用专用密码"  # 不是 Gmail 密码！
```

**获取 Gmail 应用密码：**
1. 启用两步验证
2. 访问：https://myaccount.google.com/apppasswords
3. 选择"邮件"和"其他（自定义名称）"
4. 生成并复制应用密码

#### QQ 邮箱
```yaml
host: smtp.qq.com
port: 465
secure: true
user: your-email@qq.com
pass: "授权码"  # 不是 QQ 密码！
```

**获取 QQ 邮箱授权码：**
1. 登录 QQ 邮箱
2. 设置 → 账户 → 开启 POP3/SMTP 服务
3. 生成授权码并保存

#### 163 邮箱
```yaml
host: smtp.163.com
port: 465
secure: true
user: your-email@163.com
pass: "授权码"  # 不是 163 密码！
```

**获取 163 邮箱授权码：**
1. 登录 163 邮箱
2. 设置 → POP3/SMTP/IMAP
3. 开启 SMTP 服务
4. 生成授权码并保存

#### Outlook/Hotmail
```yaml
host: smtp-mail.outlook.com
port: 587
secure: false  # 使用 STARTTLS
user: your-email@outlook.com
pass: "密码"
```

## 🔒 安全建议

1. **配置文件权限**
   - 不要将 `config.yaml` 提交到版本控制
   - 使用 `.gitignore` 排除配置文件
   - 设置适当的文件权限（Linux: `chmod 600 config.yaml`）

2. **Token 和密钥**
   - 使用强随机字符串作为 HMAC Secret
   - 定期轮换 Token 和密钥
   - 不要在日志中记录敏感信息

3. **IP 白名单**
   - 生产环境建议配置 IP 白名单
   - 仅允许必要的 IP 访问

4. **HTTPS**
   - 生产环境必须使用 HTTPS
   - 建议通过反向代理（Nginx/Caddy）实现

## ❓ 常见问题

### Q: Telegram Bot Token 在哪里获取？
A: 通过 [@BotFather](https://t.me/BotFather) 创建 Bot 后获取。

### Q: 如何获取 Telegram 群组 ID？
A: 将 Bot 添加到群组后，访问 `https://api.telegram.org/bot<TOKEN>/getUpdates` 查看。

### Q: GitHub Token 需要哪些权限？
A: 至少需要 `repo` 权限（或仅 `issues:write`）。

### Q: 为什么 Gmail 密码不工作？
A: Gmail 需要使用"应用专用密码"，不是普通密码。参考上面的 Gmail 配置说明。

### Q: HMAC Secret 必须和 GitHub Webhook Secret 一样吗？
A: 是的，必须完全一致，否则 Webhook 验证会失败。

### Q: 如何测试配置是否正确？
A: 运行 `npm start` 启动服务，访问 `http://localhost:3000/api/health` 检查各服务状态。

