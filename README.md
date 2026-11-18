# Dashboard WEB

Vue 3 AI 对话与图表页面（仅网页端），包含中英文界面、执行过程、历史搜索、附件解析和图表下载。

## 界面要点（2026-11 改版）

- 主流对话布局：浅灰无边框侧栏（“新建会话 / 搜索会话”为列表行，点击搜索后切换为搜索视图，返回或 Esc 退出；收藏 / 今天 / 近 7 天 / 更早分组，悬停“⋯”菜单），主题蓝 `#3370FF`。
- 会话标题即菜单：收藏、重命名、删除；右侧短横线为本会话提问导航，悬停展开、点击定位。
- 执行过程按 SSE 事件逐行呈现：思考（云）、加载技能（拼图）、子智能体（机器人）、工具（扳手）；生成中自动展开并显示“呼吸”状态标识（主题蓝圆点吸气涨大、呼气收回并荡开一圈细环），状态文字带一道微光，文字以淡入方式逐步浮现（不显示输入光标），结束后收起为“已完成 · 用时 · 步骤计数”。
- 结果卡片支持“图表 / 数据”切换，下载跟随当前视图（PNG / CSV）；表格数字右对齐、千分位。
- 视觉规范：颜色、圆角、阴影统一为 `.agent-page` 上的 CSS 变量（略带蓝调的中性灰阶）；图表使用以主题蓝起头的统一色板，柱状图渐变圆角、单系列折线带面积渐变、饼图为环形。
- 代码块带轻量语法着色（注释 / 字符串 / 数字 / 关键字，不引入高亮库）；报错在消息内以卡片呈现，仅当出错会话不在前台时才额外弹出顶部提示。
- 起始页：动画标题、输入框和“试试这样问”引导问题列表（直接展示完整问题，不依赖专属图标）；底部免责声明。

## 更新日志

### 2026-11-18

- 技能步骤改用项目内绘制的榫槽拼图图标。

- 静态图标、欢迎页趋势图和标签页图标改为独立 SVG，源码包包含对应资源。新增检查防止将绘图路径粘回业务源码。
- 统一中文维护注释，简化附件错误分支、Markdown 着色规则及常用容量与时间参数。
- [前端设计与维护指南](docs/design.md) 说明从 SSE 到图表正文的完整流程、历史恢复、附件读取和图标替换方法。

### 2026-11-16

- 浮窗统一为浅灰白色：附件、历史标题、按钮提示、下拉菜单和图表提示；原生 title 提示替换为可控组件。

- 对全仓手写代码逐文件审查并统一可读格式；保留原拆分映射的入口与组件文件名。
- 分离附件格式解析、历史恢复、编辑、复制反馈；共用消息组件类型，移除过时注释和未用导入。
- 修复异常图表、横轴顺序、轴索引映射、Markdown 表格边界、请求注册顺序、图表实例清理和关键帧选择器。
- 添加类型检查、格式检查及回归测试入口；移除过时交付物，改为从提交生成源码包。
- ZIP 签名、字段偏移、压缩方式、Excel 内置格式和解析上限使用有含义的命名。

### 2026-11-13

- 移除欢迎页标题下方的说明文字。
- 起始页改用 **VDS RealTime Dashboard** 文字标题。进入时先绘制字形轮廓，再填成主题蓝，下方的装饰性折线从左向右绘制，终点亮起后停住。
- 左侧栏显示静态名称 **SeekSettlement**。开启系统“减少动态效果”时，起始页直接显示动画结束后的样式。

## 移植问结算助手

保留现有页面入口 `src/views/ux/aiAgent.vue`，它加载同级 `aiAgent/App.vue`。移植时一起合并 `aiAgent/` 目录及该入口。宿主继续提供 Vue 3.5、Element Plus、ECharts、lodash-es、pdfjs-dist、i18n 语言包和 `~/store` 的登录接口。Site 演示使用模拟传输，真实门户沿用既有 SSE 接口。

下表的行号以拆分前的 GitHub 提交 `4a6021d` 为准。

| 原代码位置 | 新文件或归属 |
| --- | --- |
| 模板 1–280 的页面骨架，脚本 281–2427 的组装和生命周期 | `App.vue` |
| 365–432 的类型和协议常量，以及各处的附件、并发、追问限制 | `types.ts` |
| 433–554 的记录判断、分帧和 HTTP 传输 | `lib/sse.ts`，记录判断由 `lib/records.ts` 提供并从 SSE 模块导出 |
| 566–902 的 PDF 资源、附件提取、历史附件恢复和请求正文拼接 | `lib/attachmentReaders.ts` |
| 310–348、352–364 的自定义图标 | `lib/icons.ts` |
| 903–1015 的历史与选中会话、1341–1346 的持久化及 1353–1403 的会话操作 | `composables/useConversations.ts`，ID 与历史字段转换在 `lib/identity.ts` |
| 1882–2098 的流事件与发送流程、1404–1466 的过程推进和正文分流 | `composables/useChatStream.ts`、`useRunningRequests.ts`、`lib/streamEvents.ts`、`lib/messageLayout.ts` |
| 1016–1032、1157–1172、2111–2124 中的滚动引用、阅读位置、导航和跟随逻辑 | `composables/useScrollFollow.ts` |
| 模板 5–45、54–70、73–94 | `ChatSidebar.vue`、`ChatHeader.vue`、`WelcomePage.vue` |
| 模板 96–98 和 213–227、99–212 | `MessageList.vue` 和 `MessageItem.vue` |
| 模板 116–163、167–192 | `ProcessTimeline.vue` 和 `ChartCard.vue` |
| 模板 230–263、267–277 | `Composer.vue` 和 `ConfirmDialogs.vue` |
| 1832–1880、2264–2381 | `ChartView.vue` 和 `Typewriter.vue`，配置和 Markdown 分别放在 `lib/chartOptions.ts` 和 `lib/markdown.ts` |
| 2428–2821、2823–2832 | `styles/seeksettlement.less` 和 `styles/global.less`。页面样式限定在 `.agent-page` 下，以便跨组件应用 |

附件交互、执行过程、图表下载及界面文案分别归入 `useAttachments.ts`、`useProcessTimeline.ts`、`useChartCards.ts` 和 `useUiCopy.ts`。子组件均位于 `components/`，以类型化 props 和事件连接。

## 本地部署

独立运行本页面（脱离原门户），只需要 Node.js 和 npm，不依赖后端、数据库或外网服务。

### 1. 准备环境

| 项目 | 要求 |
| --- | --- |
| Node.js | 22.13 及以上（或 24），用 `node -v` 确认 |
| npm | 随 Node.js 安装，用 `npm -v` 确认 |
| 浏览器 | 最新版 Chrome / Edge；仅支持网页端，不适配手机 |

### 2. 获取代码并安装依赖

```bash
git clone https://github.com/lvshuai1011-hw/dashboard-web.git
cd dashboard-web
npm ci
```

`npm ci` 严格按 `package-lock.json` 安装，保证版本和他人一致；首次安装需要联网，之后离线也能运行。

### 3. 开发模式（改代码时用）

```bash
npm run dev -- --host localhost --port 5180
```

- 中文：http://localhost:5180/
- 英文：http://localhost:5180/?lang=en

保存文件后页面自动热更新。端口被占用时换一个 `--port` 即可。

### 4. 生产构建与预览（交付、演示时用）

```bash
npm run build
npx vite preview --host localhost --port 5181
```

- 构建产物在 `dist/`，是纯静态文件（一个 `index.html` 加 `assets/`），不需要 Node.js 就能运行。
- 预览地址：http://localhost:5181/
- 构建时出现“chunk 大于 500 kB”的提示是正常的，不影响使用。

### 5. 部署到静态服务器

把 `dist/` 整个目录放到任意静态服务器（nginx、Apache、对象存储静态站点等）的网站根目录即可。以 nginx 为例：

```nginx
server {
  listen 8080;
  root /var/www/dashboard-web/dist;
  index index.html;
}
```

- 如果要放在子路径（例如 `/ai/`）下，构建时指定：`npx vite build --base=/ai/`。
- 局域网内其他人访问，把 `--host localhost` 改成 `--host 0.0.0.0`，并确认防火墙放行对应端口。

### 6. 验证是否部署成功

打开页面后：

1. 起始页显示 “VDS RealTime Dashboard”、装饰折线和三条示例问题，侧栏名称为 “SeekSettlement”；
2. 点击示例问题，再按 Enter 发送；
3. 约 1 秒后出现“思考”过程，随后出现结果卡片（图表）、文字答复和三条追问建议。

预览默认使用 `src/demo-transport.js` 在浏览器内模拟 SSE，不连接真实 AI 服务，所以断网也能完成上面的验证。输入“趋势”“表格”“代码”“长文”“报错”“断流”可测试不同场景；英文也支持 trend、table、code、error、premature eof。

### 7. 常见问题

| 现象 | 处理 |
| --- | --- |
| `npm ci` 报 Node 版本不满足 | 升级到 Node.js 22.13 及以上 |
| 端口已被占用 | 换一个 `--port`，或先结束占用该端口的进程 |
| 页面空白 | 打开浏览器开发者工具的 Console 看报错；确认访问的是 `/` 而不是文件路径（不能直接双击 `dist/index.html`） |
| 子路径部署后样式、脚本 404 | 构建时漏了 `--base`，见上面第 5 步 |
| 历史会话在换浏览器后没有了 | 会话只保存在当前浏览器的本地存储里，这是设计如此 |

## 追问建议（后端约定）

答复结束后，后端可在同一 SSE 流里下发一个 `json` 事件作为追问建议，推荐顺序：

```
答复正文 … → finish_stop → json: {"follow_up": ["问题一", "问题二", "问题三"]} → 关闭连接
```

- 收到 `finish_stop` 即判定答复完成：执行过程收起、动画停止；前端继续保留连接最多 20 秒，只接收 `follow_up`，其它事件忽略。
- `follow_up` 也可在 `finish_stop` 之前下发，同样识别；它不会出现在执行过程里。
- 取非空字符串、去重后最多 3 条，单条不超过 200 字；随会话保存在本地历史中。
- 只在最新一条已完成的答复下展示；点击直接提问，若输入框已有草稿或附件则改为填入。

## 生产集成

页面入口为 `src/views/ux/aiAgent.vue`，必须连同 `src/views/ux/aiAgent/` 整个目录集成到原门户；`stub/` 和 `src/demo-transport.js` 仅用于独立预览。PDF 解析依赖 `pdfjs-dist`，版本见 package.json。

附件提示支持中英文，悬停显示 `.pdf / .docx / .xlsx / .pptx / .csv / .txt / .md / .json`。每条问题最多 5 个文件，每个不超过 5 MiB；不支持旧版 DOC/XLS 或图片识别。

## 代码检查与交付

```bash
npm run typecheck
npm test
npm run format:check
npm run build
npm run package:source
```

`typecheck` 检查 Vue 模板与 TypeScript，并拒绝未使用的变量；`format` 统一排版。
这些是独立检查：Vite 构建不会代替类型检查。开发工具仅为 devDependencies，不增加页面运行时依赖。

旧的单文件交付 ZIP、旧说明及旧构建日志已移出当前版本，可从 Git 历史查阅。
`package:source` 从当前 **已提交的 HEAD** 生成 `delivery/aiAgent-source.zip`，包含完整模块、预览工程与文档；执行前请先提交改动。生成包不纳入 Git，避免再次与源码脱节。

当前审查范围与修改依据见 [代码审查记录](docs/code-review-2026-11-16.md)。
PDF 仅提取文本层；Office 仅支持 OOXML。真实接口、企业语言包和登录态仍需移植方联调。
本页面按单个应用实例设计；会话和运行请求为模块级共享状态，同一页面不要同时挂载两份 App。

### 2026-11-17：精简与浅色浮窗

- 删除 63 个只转发事件的包装函数，组件模板直接调用有类型约束的 emit；消息列表合并公共属性传递。
- Less 使用嵌套收拢重复页面作用域，移除失效提示样式和重复菜单声明；最多三个声明的短规则紧凑排版，长规则保留逐行格式。样式文件不参与 Prettier 自动展开。
- 统一附件、历史会话、操作按钮的浅灰蓝提示和菜单；图表提示及预览/确认弹窗采用浅色表面。
- 保留组件拆分路径及现有功能。新增 AppTooltip 只集中管理提示主题、延迟和键盘焦点，不引入依赖。

### 2026-11-17：组件与业务逻辑精简

- 过程时间线和图表能力分别以有类型约束的对象传入，移除中间组件对内部函数及图表事件的逐项转发。保留现有文件路径；移植时需一并更新 App、componentTypes、MessageList、MessageItem、ProcessTimeline、ChartCard。
- 柱状图与折线图共用类目对齐、缺值处理、稀疏轴编号和缩放配置；表格及图表数据共用 CSV 导出路径。
- 历史筛选、摘要和点击定位共用搜索字段；正文布局、重点文本和过程计数使用 computed，避免同一次渲染反复遍历。
- 运行阶段标签和步骤名合并为一次扫描；删除未被消费的 tailing 响应式集合，保留 tails 的追问超时与取消管理。
- 业务源码净减少 189 行，无新增依赖或样式变更。类型检查、20 项测试、格式检查和生产构建通过；21 组图表重构前后配置对比通过（函数字段除外）。浏览器验证历史恢复、过程展开、图表/数据切换、CSV 下载内容和正文搜索定位。真实后端仍需集成环境验证。
