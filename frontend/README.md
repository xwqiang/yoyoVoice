# Frontend (yoyoVoice)

yoyoVoice 的前端应用，基于 React + TypeScript + Vite 构建，面向儿童学习交互与家长管理面板。

## 启动开发环境

```bash
npm install
npm run dev -- --host 0.0.0.0 --port 5173
```

访问：`http://127.0.0.1:5173`

## 构建

```bash
npm run build
npm run preview
```

## 目录说明

- `src/pages/admin`: 家长/教师管理端页面
- `src/pages/student`: 学生学习端页面
- `src/components`: 公共与模块化组件
- `src/context`: 用户与孩子状态上下文
- `src/api`: API 请求封装
