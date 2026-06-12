# yoyoVoice - 儿童英语学习平台

面向 iPad 的儿童英语单词学习 Web 应用，支持释义理解、拼写、发音练习，集成 Azure 发音评估与 Cursor SDK AI 辅助。

## 功能

- **预设课程** + **自定义词表**学习源切换
- **三大模块**：释义选择、拼写输入、发音录音评估
- **多孩子**数据隔离，家长/教师统一管理端
- **每日学习计划**自动生成（新词 + 错题复习）
- **Azure Pronunciation Assessment** 发音评分
- **Cursor SDK** AI：练习推荐、快速录入单词、学习周报

## 快速开始（局域网）

### 1. 后端

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
# 编辑 .env 填入 AZURE_SPEECH_KEY、CURSOR_API_KEY（可选，无密钥时使用模拟/规则降级）
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

### 2. 前端开发模式

```bash
cd frontend
npm install
npm run dev
```

访问 `http://<本机IP>:5173`（iPad 同一 WiFi）

### 3. 一键启动

```bash
chmod +x scripts/dev.sh
./scripts/dev.sh
```

### 4. 生产构建（单端口部署）

```bash
cd frontend && npm run build
cd ../backend && uvicorn app.main:app --host 0.0.0.0 --port 8000
```

访问 `http://<本机IP>:8000`

## 环境变量

| 变量 | 说明 |
|------|------|
| `SECRET_KEY` | JWT 签名密钥 |
| `DATABASE_URL` | SQLite 路径，默认 `data/yoyovoice.db` |
| `AZURE_SPEECH_KEY` | Azure 语音服务密钥 |
| `AZURE_SPEECH_REGION` | Azure 区域，如 `eastus` |
| `CURSOR_API_KEY` | Cursor SDK API 密钥 |
| `CURSOR_MODEL` | AI 模型，默认 `composer-2.5` |

## 云部署预留

- 数据库文件挂载 `data/` volume
- 配置 HTTPS 反向代理（Caddy/nginx）以支持 iPad 麦克风
- 将 `DATABASE_URL` 换为 PostgreSQL 即可扩展（SQLAlchemy 抽象层已支持）

## 目录结构

```
backend/     FastAPI + SQLite
frontend/    React + Vite + Tailwind PWA
data/        SQLite 数据库与音频缓存
scripts/     开发与种子脚本
```
