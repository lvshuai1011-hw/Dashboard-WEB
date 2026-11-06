# Dashboard WEB

Vue 3 AI 对话与图表页面（仅网页端），包含中英文界面、执行过程、历史搜索、附件解析和图表下载。

## 界面要点（2026-11 改版）

- 主流对话布局：浅灰侧栏（收藏 / 今天 / 近 7 天 / 更早分组，悬停“⋯”菜单），主题蓝 `#1664FF`。
- 会话标题即菜单：收藏、重命名、删除；右侧短横线为本会话提问导航，悬停展开、点击定位。
- 执行过程按 SSE 事件逐行呈现：思考（云）、加载技能（拼图）、子智能体（机器人）、工具（扳手）；生成中自动展开并显示四片折叠动画，结束后收起为“已完成 · 用时 · 步骤计数”。
- 结果卡片支持“图表 / 数据”切换，下载跟随当前视图（PNG / CSV）；表格数字右对齐、千分位。
- 起始页：品牌标识、标题与说明、输入框和“试试这样问”引导问题列表（直接展示完整问题，不依赖专属图标）；底部免责声明。

## 本地预览

建议使用 Node.js 22.13+（或 Node.js 24）。

```bash
npm ci
npm run dev -- --host localhost --port 5180
```

中文：http://localhost:5180/

英文：http://localhost:5180/?lang=en

预览默认使用 `src/demo-transport.js` 在浏览器内模拟 SSE，不连接真实 AI 服务。输入“趋势”“表格”“代码”“长文”“报错”“断流”可测试不同场景；英文也支持 trend、table、code、error、premature eof。

## 生产集成

页面文件为 `src/views/ux/aiAgent.vue`。将它集成到原门户；`stub/` 和 `src/demo-transport.js` 仅用于独立预览。PDF 解析依赖 `pdfjs-dist`，版本见 package.json。

附件提示支持中英文，悬停显示 `.pdf / .docx / .xlsx / .pptx / .csv / .txt / .md / .json`。每条问题最多 5 个文件，每个不超过 5 MiB；不支持旧版 DOC/XLS 或图片识别。

## 编译与交付

```bash
npm run build
```

`delivery/aiAgent-ui-delivery.zip` 包含组件、交付说明、构建记录和 PDF/PPTX 样例。最新修改通过 ESLint 和 Vite 构建；Linux 等效构建结果为 `BUILD OK: dist/`，未运行 Windows PowerShell 脚本。
