# 曙光号 · 飞船账号系统设计说明

> 版本 1.0 · 2026-11 · 适用于 `stellar-odyssey`（静态 Three.js 客户端 + GitHub Pages）
> 说明：本文档同时描述**已落地的客户端原型**与**接入后端后的目标形态**，两者共用同一套数据模型与接口契约。

---

## 1. 目标与范围

### 1.1 目标

在进入飞行模式之前，完成一次「飞船账号」注册或登录，形成**注册 → 认证 → 会话维持 → 退出**的最小闭环，并把舰长档案带入游戏（称呼显示、后续可挂接等级/船坞/存档）。

### 1.2 范围内

| 项 | 说明 |
| --- | --- |
| 注册 | 飞船账号（唯一标识）、舰长昵称、密码、确认密码 |
| 登录 | 账号 + 密码；错误提示不区分「账号不存在 / 密码错误」 |
| 会话 | 本地会话令牌 + 过期时间（默认 30 天）；刷新页面恢复登录态 |
| 存储 | 账号条目：哈希后的密码、盐、迭代次数、时间戳、扩展位 |
| 反馈 | 逐字段校验、提交中状态、成功进入任务、失败可重试 |
| 退出 | 清除会话，回到认证界面，账号数据保留 |

### 1.3 范围外（明确不做）

- 不采集真实姓名、手机号、邮箱、身份证等敏感个人信息；昵称仅作展示。
- 不涉及支付、道具、实名认证。
- 不改变任何玩法数值（战斗、装配评分、曲率逻辑均不受影响）。
- 装配台 `shipyard/` 本轮不做准入拦截（可在后续复用同一账号体系）。

---

## 2. 账号数据模型

### 2.1 账号条目 `AccountRecord`

| 字段 | 类型 | 约束 | 说明 |
| --- | --- | --- | --- |
| `id` | string (uuid) | 必填、服务端生成 | 内部主键，不对外暴露自增序号 |
| `callsign` | string | 3–16 字符，`^[A-Za-z0-9_-]+$` | 飞船账号，展示用大小写保留 |
| `callsignKey` | string | 唯一索引 | `callsign.toLowerCase()`，用于唯一性校验与登录查找 |
| `nickname` | string | 2–12 字符，禁止控制字符 | 舰长昵称，可含中文 |
| `salt` | base64 (16 B) | 必填 | 每个账号独立随机盐 |
| `hash` | base64 (32 B) | 必填 | `PBKDF2-SHA256(password, salt, 210000)` 派生结果 |
| `iterations` | number | 100000–600000 | 与 hash 绑定，便于后续提升强度并平滑迁移 |
| `createdAt` | ISO8601 | 必填 | 注册时间 |
| `lastLoginAt` | ISO8601 | 可空 | 最近一次成功登录 |
| `meta` | object | 可扩展 | 预留：`level`、`ships`、`settings`、`progress` |

### 2.2 会话 `SessionRecord`

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `accountId` | string | 关联账号 |
| `callsign` / `nickname` | string | 展示用快照，避免每次读账号表 |
| `token` | string | 随机 32 B（base64url）；生产环境由服务端签发 |
| `issuedAt` / `expiresAt` | ISO8601 | 默认 30 天；过期即视为未登录 |

### 2.3 存储键位

| 键 | 位置 | 内容 |
| --- | --- | --- |
| `stellar_odyssey:accounts:v1` | localStorage | `AccountRecord[]` |
| `stellar_odyssey:session:v1` | localStorage | `SessionRecord` |
| `stellar_odyssey:lockout:v1` | sessionStorage | 登录失败计数（本标签页有效） |

选择 localStorage 的原因：静态站点无后端，需要跨刷新保留；生产形态应改为 HttpOnly Cookie + 服务端会话表。

---

## 3. 流程设计

### 3.1 首次进入（注册）

```
启动 → 资源加载(boot) → 检测会话
   ├─ 有有效会话 → 直接显示任务开始屏（显示舰长昵称）
   └─ 无会话 → 认证界面（默认「注册」页签）
          输入账号 → 失焦校验（格式 + 重复）
          输入昵称 → 失焦校验
          输入密码 → 实时强度条（长度/字母/数字/符号）
          输入确认密码 → 一致性校验
          提交 → 按钮进入 loading（禁用重复提交）
             ├─ 失败：字段级红字 + 顶部错误条，焦点回到首个非法字段
             └─ 成功：写入账号 → 建立会话 → 认证层淡出 → 任务开始屏
```

### 3.2 再次进入（登录）

- 账号输入框自动填充上次登录的 callsign（仅本地）。
- 提交失败统一提示「账号或密码不正确」，不暴露账号是否存在。
- 连续失败 5 次 → 本标签页锁定 60 秒（按钮禁用并显示倒计时）。

### 3.3 会话维持与退出

- 每次进入任务读取会话；`expiresAt` 过期则清除并回认证界面。
- 成功登录刷新 `lastLoginAt` 与 `expiresAt`（滑动过期）。
- 「切换账号」清除会话、保留账号记录，回到认证界面。

---

## 4. 校验规则与错误码

### 4.1 字段规则

| 字段 | 规则 | 失败提示 |
| --- | --- | --- |
| 飞船账号 | 非空；3–16 字符；仅 `A-Z a-z 0-9 _ -` | 「飞船账号需 3–16 位，仅限字母、数字、下划线、连字符」 |
| 飞船账号（重复） | `callsignKey` 唯一 | 「该飞船账号已被注册，换一个呼号」 |
| 舰长昵称 | 2–12 字符；去除首尾空格；禁止控制字符 | 「舰长昵称需 2–12 个字符」 |
| 密码 | 8–64 字符；至少 1 字母 + 1 数字 | 「密码至少 8 位，且同时包含字母与数字」 |
| 确认密码 | 与密码完全一致 | 「两次输入的密码不一致」 |
| 登录 | 账号存在且哈希匹配 | 「账号或密码不正确」 |

### 4.2 错误码（接口统一）

| code | HTTP | 语义 | 客户端处理 |
| --- | --- | --- | --- |
| `INVALID_CALLSIGN` | 400 | 格式非法 | 字段级提示 |
| `INVALID_NICKNAME` | 400 | 格式非法 | 字段级提示 |
| `WEAK_PASSWORD` | 400 | 强度不足 | 字段级提示 + 强度条标红 |
| `CALLSIGN_TAKEN` | 409 | 唯一性冲突 | 账号字段提示 + 建议加后缀 |
| `INVALID_CREDENTIALS` | 401 | 登录失败（不区分原因） | 顶部错误条 |
| `RATE_LIMITED` | 429 | 失败次数过多 | 倒计时禁用 |
| `STORAGE_UNAVAILABLE` | 500 | 本地存储/加密不可用 | 提示更换浏览器或关闭无痕模式 |
| `INTERNAL` | 500 | 未预期错误 | 通用失败提示，可重试 |

弹窗/文案不包含密码、盐、哈希等敏感值；控制台只记录错误码，不记录凭证。

---

## 5. 安全设计

### 5.1 密码

- **不存明文**：只保存 `salt` + `hash` + `iterations`。
- 派生：`PBKDF2-HMAC-SHA256`，随机 16 B 盐，210,000 次迭代，32 B 输出（`crypto.subtle.deriveBits`）。
- 比较：逐字节常量时间比较，避免提前返回。
- 传输（目标形态）：仅 HTTPS；服务端再做一次慢哈希（Argon2id 或 PBKDF2 600k）后入库，客户端哈希不替代服务端哈希。
- 日志：任何环境都不打印密码、盐、哈希；错误上报只带错误码与时间。

### 5.2 唯一性

- 客户端：`callsignKey` 全表扫描比对（数据量小）。
- 服务端：`UNIQUE(callsign_key)` 约束 + 冲突返回 409，避免并发注册竞态。

### 5.3 暴力提交

- 客户端：5 次失败 / 60 s 冷却（sessionStorage），提交中禁用按钮。
- 服务端：按 IP + 账号双维度限流，指数退避，返回 429 与 `Retry-After`。

### 5.4 本地原型的已知边界

静态站点没有可信执行环境：localStorage 中的数据对同源脚本可见，哈希只提高「明文泄露」成本，不能抵抗本机恶意脚本。因此：

- 原型阶段仅用于演示流程，**不得复用真实密码**（界面明确提示）。
- 接入后端后，客户端不再保存 `hash`，只保留服务端签发的会话 Cookie。

---

## 6. 接口契约（接入后端时启用）

### 6.1 注册

```http
POST /api/v1/accounts
Content-Type: application/json

{
  "callsign": "NX-07",
  "nickname": "林深",
  "passwordHash": "<base64 32B>",
  "salt": "<base64 16B>",
  "iterations": 210000
}
```

| 状态 | 响应体 |
| --- | --- |
| 201 | `{ "account": { "id", "callsign", "nickname", "createdAt", "meta" }, "session": { "token", "expiresAt" } }` |
| 400/409/500 | `{ "error": { "code", "message", "field?" } }` |

### 6.2 登录

```http
POST /api/v1/sessions
{ "callsign": "NX-07", "passwordHash": "<base64 32B>" }
```

| 状态 | 响应体 |
| --- | --- |
| 200 | `{ "account": {...}, "session": { "token", "expiresAt" } }` |
| 401 | `{ "error": { "code": "INVALID_CREDENTIALS", "message": "账号或密码不正确" } }` |
| 429 | `{ "error": { "code": "RATE_LIMITED", "message": "尝试过于频繁" }, "retryAfter": 60 }` |

> 说明：服务端需按 `callsign` 查出 `salt` 与 `iterations` 才能复算哈希；若客户端直接上传派生结果，等价于「密码等价物」，仍必须走 HTTPS，并在服务端再次加固哈希。

### 6.3 会话校验 / 退出

```http
GET    /api/v1/sessions/current   → 200 { account, session } | 401
DELETE /api/v1/sessions/current   → 204
```

---

## 7. 可扩展性预留

| 能力 | 预留方式 |
| --- | --- |
| 等级 / 经验 | `meta.level`、`meta.xp`，服务端增量更新 |
| 船坞存档 | `meta.ships[]` 指向装配台方案的 JSON（与 `lightspeed_shipyard:v1:` 的 build 结构对齐） |
| 找回密码 | 账号可选绑定邮箱（当前不采集）；重置令牌表 `password_resets` |
| 改昵称 | `PATCH /api/v1/accounts/current`，只允许 nickname/meta |
| 第三方登录 | `provider` + `providerUid` 唯一索引，密码字段可空 |
| 多端同步 | 会话表 + 版本号；客户端离线队列 |

---

## 8. 客户端实现说明

### 8.1 文件

| 文件 | 作用 |
| --- | --- |
| `src/auth.js` | `createAuthSystem()`：校验、PBKDF2、账号读写、会话、限流、界面事件 |
| `index.html` | `#auth-screen` 认证层、`#start-pilot` 舰长标识、`#btn-signout` 切换账号 |
| `css/styles.css` | 认证层与舰长标识样式（沿用青色主色 + 琥珀强调） |
| `src/main.js` | 启动后先过认证，再 `ui.finishBoot()` 显示任务开始屏 |

### 8.2 关键 DOM

`#auth-screen`、`#auth-tab-register`、`#auth-tab-login`、`#auth-form-register`、`#auth-form-login`、
`#auth-callsign`、`#auth-nickname`、`#auth-password`、`#auth-confirm`、`#auth-login-callsign`、`#auth-login-password`、
`#auth-error`、`#auth-submit`、`#auth-strength`、字段级 `[data-error-for]`。

### 8.3 验收清单

1. 首次打开出现注册界面，字段校验逐条生效。
2. 重复账号被拒绝并给出「该飞船账号已被注册」。
3. 弱密码被拒绝，强度条随输入变化。
4. 注册成功后进入任务开始屏，顶部显示舰长昵称。
5. 刷新页面保持登录；「切换账号」后可登录既有账号。
6. 密码错误提示统一，连续失败触发冷却。
7. 账号表中不存在明文密码；`hash` 为 44 字符 base64。
8. 飞行、战斗、装配台、曲率座舱均无回归。