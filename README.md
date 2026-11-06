# Dashboard WEB

Vue 3 AI 对话与图表页面，包含中英文界面、执行过程、历史搜索、附件解析和图表下载。

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
