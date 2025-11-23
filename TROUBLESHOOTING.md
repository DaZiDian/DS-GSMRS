# 问题排查指南

根据测试日志，以下是发现的问题和解决方案：

## ✅ 已正常工作的功能

1. **服务启动** ✓
   - 服务器成功启动在端口 3000
   - 配置加载成功

2. **Telegram 服务** ✓
   - Bot Token 有效
   - 消息成功发送到 Telegram 群组

3. **消息队列** ✓
   - 队列系统正常工作
   - 重试机制正常
   - 死信队列功能正常

## ⚠️ 需要修复的问题

### 1. GitHub 404 错误

**错误信息：**
```
Request failed with status code 404
"message": "Not Found"
```

**可能原因：**
- 仓库 `DaZiDian/DS-GSMRS` 不存在
- Issue #1 不存在
- Token 权限不足

**解决方案：**

1. **检查仓库是否存在：**
   - 访问：https://github.com/DaZiDian/DS-GSMRS
   - 如果不存在，需要创建仓库或修改配置中的仓库名称

2. **创建 Issue #1：**
   - 进入仓库页面
   - 点击 **Issues** 标签
   - 点击 **New Issue**
   - 填写标题和内容
   - 创建后，Issue 编号会显示在 URL 中

3. **检查 Token 权限：**
   - 确保 GitHub Token 有 `repo` 或 `issues:write` 权限
   - 重新生成 Token 并更新配置

### 2. 邮件服务连接失败

**错误信息：**
```
Client network socket disconnected before secure TLS connection was established
connect ETIMEDOUT 111.124.203.45:465
```

**可能原因：**
- 网络防火墙阻止了 465 端口
- 163 邮箱 SMTP 服务需要特殊配置
- 需要使用授权码而不是密码

**解决方案：**

1. **检查 163 邮箱授权码：**
   - 登录 163 邮箱
   - 设置 → POP3/SMTP/IMAP
   - 开启 SMTP 服务
   - 生成授权码（不是邮箱密码）
   - 更新配置文件中的 `pass` 字段

2. **尝试使用 587 端口（STARTTLS）：**
   ```yaml
   smtp:
     host: smtp.163.com
     port: 587
     secure: false  # 改为 false，使用 STARTTLS
   ```

3. **检查网络连接：**
   - 确保服务器可以访问外网
   - 检查防火墙是否阻止了 SMTP 端口
   - 尝试使用其他邮件服务商（如 Gmail、QQ 邮箱）测试

4. **163 邮箱 SMTP 配置参考：**
   ```yaml
   smtp:
     host: smtp.163.com
     port: 465
     secure: true
     user: your-email@163.com
     pass: "授权码"  # 必须是授权码，不是密码
   ```

### 3. 日志重复前缀

**问题：**
日志显示 `[GSMRS] [GSMRS]` 重复前缀

**解决方案：**
已修复，需要重新构建：
```powershell
npm run build
```

### 4. 健康检查端点 HMAC 验证

**问题：**
健康检查端点需要 HMAC 验证，导致无法访问

**解决方案：**
已修复，健康检查端点现在不需要 HMAC 验证。需要重新构建并重启服务。

## 🔧 修复步骤

1. **重新构建项目：**
   ```powershell
   npm run build
   ```

2. **检查 GitHub 仓库和 Issue：**
   - 确认仓库存在：https://github.com/DaZiDian/DS-GSMRS
   - 创建 Issue #1（如果不存在）

3. **修复邮件配置：**
   - 确认使用授权码而不是密码
   - 或尝试使用 587 端口 + STARTTLS

4. **重启服务：**
   ```powershell
   # 停止当前服务（Ctrl+C）
   npm start
   ```

## 📊 测试结果总结

| 服务 | 状态 | 说明 |
|------|------|------|
| Telegram | ✅ 正常 | 消息成功发送 |
| GitHub | ❌ 失败 | 404 错误，需要检查仓库和 Issue |
| 邮件 | ❌ 失败 | 连接超时，需要检查网络和配置 |
| 队列系统 | ✅ 正常 | 重试和死信队列工作正常 |
| 健康检查 | ⚠️ 部分 | Telegram 正常，其他服务失败 |

## 🎯 下一步

1. 修复 GitHub 仓库/Issue 问题
2. 修复邮件服务连接问题
3. 重新构建并测试
4. 验证所有服务正常工作

