# 全仓代码审查与修改记录（2026-11-16）

基线：`ec93953146b46866a7838ea9a93cbdec2cf4a633`（GitHub main）。

这次审查直接阅读仓库中的手写代码及其调用关系，测试是修改后的验证手段。下表逐项说明审查结果；不是仅检索关键词或把构建成功当作审查完成。
第三方依赖、锁文件、生成 ZIP、构建日志不属于手写源码：锁文件核对依赖元数据，旧交付物因与当前代码不一致而移出当前版本，历史仍在 Git 中。

## 修改重点

- 可读性：统一多行模板、语句和样式，清理未用导入与矛盾注释；不把显而易见的 0/1 或 SVG 坐标都包装成常量。
- 职责：原映射中的入口和 11 个组件文件保留；附件格式、历史解码、问题编辑、复制反馈、正文提取分别放入专用模块。
- 数据边界：SSE 和历史共用图表校验，异常图表保留原 JSON；修复重复消息 ID、无效时间、类别排序及轴 ID 映射。
- 生命周期：请求启动前注册句柄；清理失败、取消和尾流；修复图表根节点替换及导出失败的恢复。
- 呈现：限制 Markdown 表格吞入后续代码；修复欢迎标题关键帧，保留既定布局和动画节奏。

## 基线文件覆盖

| 文件 | 阅读与处理 |
| --- | --- |
| `.gitignore` | 增加生成交付包忽略项。 |
| `README.md` | 修正旧欢迎页说明、移植范围、交付方式并记录检查边界。 |
| `delivery/aiAgent-ui-delivery.zip` | 旧交付产物，与当前模块源码不一致；删除当前副本，改为从 Git HEAD 生成源码包。 |
| `delivery/aiAgent-交付说明.txt` | 旧交付说明与当前代码矛盾，移出当前版本；完整内容保留于 Git 历史。 |
| `delivery/build-output.txt` | 旧交付产物，与当前模块源码不一致；删除当前副本，改为从 Git HEAD 生成源码包。 |
| `index.html` | 核对入口、字体、尺寸与图标；从单行改为可读排版。 |
| `package-lock.json` | 机器生成文件；核对根依赖和锁定版本，不声称逐行审查第三方实现。 |
| `package.json` | 明确开发检查脚本、开发依赖和 Node 最低版本。 |
| `src/demo-transport.js` | 核对演示场景；支持 URL 入参；处理预取消并清理 abort 监听。 |
| `src/main.js` | 核对注册顺序；按当前语言设置 HTML lang。 |
| `src/views/ux/aiAgent.vue` | 保留兼容入口，继续加载 aiAgent/App.vue。 |
| `src/views/ux/aiAgent/App.vue` | 页面编排；移出编辑、复制反馈和正文选择；弹窗开启时不抢快捷键。 |
| `src/views/ux/aiAgent/components/ChartCard.vue` | 表格与数字列改为 computed，避免每一列表头重建整张表。 |
| `src/views/ux/aiAgent/components/ChartView.vue` | 核对实例生命周期；根节点替换后释放旧实例；导出 finally 恢复展示。 |
| `src/views/ux/aiAgent/components/ChatHeader.vue` | 核对菜单与重命名事件，展开模板排版。 |
| `src/views/ux/aiAgent/components/ChatSidebar.vue` | 核对搜索、收藏、重命名和删除事件转发，展开模板排版。 |
| `src/views/ux/aiAgent/components/Composer.vue` | 补全 ChatMessage 导入，核对发送、停止、附件和输入法事件。 |
| `src/views/ux/aiAgent/components/ConfirmDialogs.vue` | 核对 model-value 关闭与确认事件；保留附件纯文本预览。 |
| `src/views/ux/aiAgent/components/MessageItem.vue` | 保留正文/过程分流；共享参数类型，移除未使用导入。 |
| `src/views/ux/aiAgent/components/MessageList.vue` | 共享参数类型；提问导航增加键盘焦点入口。 |
| `src/views/ux/aiAgent/components/ProcessTimeline.vue` | 核对展开条件和事件标识；保留时间线职责。 |
| `src/views/ux/aiAgent/components/Typewriter.vue` | 核对分块、终止清理、details 恢复和动画状态；保留 0.8 秒重点扫光。 |
| `src/views/ux/aiAgent/components/WelcomePage.vue` | 核对 SVG ID 隔离及装饰性内容可达性。 |
| `src/views/ux/aiAgent/composables/useAttachments.ts` | 超过附件数量时提前停止提取；核对异步会话隔离与大小限制。 |
| `src/views/ux/aiAgent/composables/useChartCards.ts` | 核对图表复合键、CSV 引号和导出分支；统一排版。 |
| `src/views/ux/aiAgent/composables/useChatStream.ts` | 先注册句柄再启动传输；用转发 abort 处理同步失败；清理追问尾流。 |
| `src/views/ux/aiAgent/composables/useConversations.ts` | 历史解码移到 lib/history.ts；删除同时结束该消息的追问尾流。 |
| `src/views/ux/aiAgent/composables/useProcessTimeline.ts` | 去除与实际行为矛盾的默认折叠注释及未使用参数名。 |
| `src/views/ux/aiAgent/composables/useRunningRequests.ts` | 保留用户要求的模块级请求表；明确单 App 实例契约。 |
| `src/views/ux/aiAgent/composables/useScrollFollow.ts` | 核对跟随开关、定位范围及计时器清理。 |
| `src/views/ux/aiAgent/composables/useUiCopy.ts` | 核对双语文案字段一致性。 |
| `src/views/ux/aiAgent/lib/attachmentReaders.ts` | 保留公共入口，拆出 PDF、ZIP、XML、Office、Excel 格式和附件元数据。 |
| `src/views/ux/aiAgent/lib/chartOptions.ts` | 保留查询横轴顺序；映射非连续轴 ID；multi-bar 转成 bar；缩放按完整类目数判断。 |
| `src/views/ux/aiAgent/lib/icons.ts` | 核对 SVG 工厂、属性和许可证注释；格式化。 |
| `src/views/ux/aiAgent/lib/identity.ts` | 历史时间限制在 Date 可表示区间，避免日期格式化抛错。 |
| `src/views/ux/aiAgent/lib/markdown.ts` | 表格边界、列宽和反引号分隔修复；核对转义和链接协议白名单。 |
| `src/views/ux/aiAgent/lib/messageLayout.ts` | 核对多图表/复用 messageId 的正文归属；删去残留注释。 |
| `src/views/ux/aiAgent/lib/records.ts` | 核对 unknown 到对象的类型守卫。 |
| `src/views/ux/aiAgent/lib/sse.ts` | 核对 CR/LF 分帧、结束帧、EOF、超时、主动取消；登录 store 读取移入异常处理。 |
| `src/views/ux/aiAgent/lib/streamEvents.ts` | 图表通过 schema 才进入图表卡，异常结构保留为普通 JSON。 |
| `src/views/ux/aiAgent/styles/global.less` | 移除对宿主 html/body/#app 的尺寸覆盖，仅保留弹层样式。 |
| `src/views/ux/aiAgent/styles/seeksettlement.less` | 逐条检查选择器；修复 keyframes 中错误的页面前缀，统一多行排版。 |
| `src/views/ux/aiAgent/types.ts` | 核对文件内容与使用位置。 |
| `stub/i18n/CN.js` | 核对全部预览语言键；统一格式。 |
| `stub/i18n/US.js` | 核对全部预览语言键；修正拖拽提示的错误单词。 |
| `stub/i18n/index.js` | 核对中文/英文选择、全局注入与 Composition 模式。 |
| `stub/store/index.js` | 核对 Pinia 模拟登录接口；sessionStorage 不可用时保持演示可启动。 |
| `tests/chart-stream.test.mjs` | 核对测试使用真实源模块，保留原有五个分流场景。 |
| `vite.config.js` | 核对别名、插件和路径解析；统一格式。 |

## 新增模块

| 文件 | 职责 |
| --- | --- |
| `componentTypes.ts` | MessageList / MessageItem 共用参数契约 |
| `composables/useQuestionEditor.ts` | 按会话保存编辑目标，提交/取消时恢复草稿 |
| `composables/useMessageActions.ts` | 复制、反馈和反馈计时器清理 |
| `lib/chartSchema.ts` | 图表入口结构校验，不换算业务值 |
| `lib/history.ts` | 存储数据恢复、异常字段处理、ID 去重 |
| `lib/messagePresentation.ts` | 复制和正文判空共同使用的正文提取 |
| `lib/attachmentMetadata.ts` | 附件名、历史附件、请求拼接 |
| `lib/pdfReader.ts` | PDF 资源和文本层提取 |
| `lib/officeArchive.ts` | ZIP 目录、解压、CRC、体积校验 |
| `lib/officeXml.ts` | Office 内部路径及 XML 边界 |
| `lib/officeReaders.ts` | DOCX / XLSX / PPTX 文本提取 |
| `lib/spreadsheetFormats.ts` | 有名的 Excel 格式 ID、日期和百分比解释 |

## 验证与边界

- TypeScript 检查包含 Vue 模板、strict、未使用变量和参数检查；Vite 单独构建。
- 17 项自动化回归：原有 5 项图表分流，新增 Markdown、图表 schema/轴序、历史、Excel 日期、关键帧和 SSE 分帧/EOF/取消等覆盖。
- 浏览器使用演示传输检查问答、图表/数据切换、追问、编辑取消恢复草稿、断流错误；不等同于真实后端联调。
- 本轮没有重新实测 PDF、DOCX、XLSX、PPTX 的浏览器上传全过程；其拆分使用原提取实现，格式转换有自动化覆盖，生产文件仍应由移植方验证。
- 会话和运行表按要求保持模块级共享；支持单 App 实例，不承诺同时挂载两个独立助手视图。localStorage 仍有容量限制，未改存储架构。
- Markdown 仍是受限的轻量子集，不宣称完整 CommonMark 兼容。PDF 仅提取文本层，不做 OCR。
- 运行时依赖未升级；现有主包仍较大。没有用提高告警阈值掩盖构建提示。
- 未执行 Windows PowerShell 脚本；检查运行于 Linux。此记录不代表“代码绝无缺陷”。

## 2026-11-17 后续精简

移除 63 个纯事件转发函数，将 MessageList 公共属性集中传递；保留 defineEmits 类型校验与原有对外接口。Less 页面前缀改为嵌套前后已比较编译结果，CSS 一致；另删除原先无法命中 teleported 内容的 tooltip-text 规则及重复菜单声明。短样式规则紧凑排版仅减少展示行数，不计为功能代码删除。主样式由 2104 行调整到 1485 行。

AppTooltip.vue 集中配置浅色提示、hover/focus 触发与延迟。覆盖附件、历史名称、按钮提示；菜单、图表 tooltip、确认/附件预览框也明确设置浅色表面。浏览器检查附件、历史提示和菜单计算背景均为 rgb(248, 250, 252)。

验证：类型检查、17 项测试、格式检查与构建；浏览器验证历史切换、数据视图切换、重命名取消和模拟 SSE 问答。真实后端与附件格式解析的验证限制沿用上文。

### 2026-11-17：组件与业务逻辑精简

- 过程时间线和图表能力分别以有类型约束的对象传入，移除中间组件对内部函数及图表事件的逐项转发。保留现有文件路径；移植时需一并更新 App、componentTypes、MessageList、MessageItem、ProcessTimeline、ChartCard。
- 柱状图与折线图共用类目对齐、缺值处理、稀疏轴编号和缩放配置；表格及图表数据共用 CSV 导出路径。
- 历史筛选、摘要和点击定位共用搜索字段；正文布局、重点文本和过程计数使用 computed，避免同一次渲染反复遍历。
- 运行阶段标签和步骤名合并为一次扫描；删除未被消费的 tailing 响应式集合，保留 tails 的追问超时与取消管理。
- 业务源码净减少 189 行，无新增依赖或样式变更。类型检查、20 项测试、格式检查和生产构建通过；21 组图表重构前后配置对比通过（函数字段除外）。浏览器验证历史恢复、过程展开、图表/数据切换、CSV 下载内容和正文搜索定位。真实后端仍需集成环境验证。
