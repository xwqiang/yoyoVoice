# Contributing to yoyoVoice

感谢你愿意参与 yoyoVoice 的开源建设。

## 提交前建议

- 先创建 issue 说明你要解决的问题或改进点
- 讨论通过后再提交 PR，避免重复工作
- 保持 PR 小而清晰，便于 review

## 本地开发

```bash
./scripts/dev.sh
```

或手动启动前后端（见根目录 `README.md`）。

## 代码规范

- 前端：TypeScript + React，保持组件职责单一
- 后端：FastAPI + SQLAlchemy，优先清晰的接口与数据模型
- 不提交密钥、数据库文件、音频缓存等本地数据

## 测试与验证

提交前请至少执行：

```bash
cd backend && .venv/bin/pytest
cd frontend && npm run build
```

## Pull Request Checklist

- [ ] 变更描述清晰，说明了为什么改
- [ ] 本地自测通过
- [ ] 没有提交敏感信息
- [ ] 更新了必要文档（README / 注释 / 示例）
