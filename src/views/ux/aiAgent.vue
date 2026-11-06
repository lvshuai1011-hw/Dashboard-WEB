<template>
  <section ref="processRoot" class="agent-page" :aria-label="t('AIAGENT.BRAND')" @keydown="onWorkspaceKeydown">
    <div class="workspace">
      <component :is="mobile ? ElDrawer : 'aside'" v-if="mobile || sidebarOpen" class="history-panel"
        v-bind="mobile ? { direction: 'ltr', size: 'min(300px, 88vw)', title: t('AIAGENT.HISTORY.TITLE'), bodyClass: 'agent-history-body', headerClass: 'agent-history-header', appendToBody: false } : {}"
        :model-value="drawerOpen" @update:model-value="drawerOpen = $event" @opened="onHistoryDrawerOpened" @closed="historySearchPending = false">
        <div class="history-content">
        <div class="history-brand">
          <h1>{{ t('AIAGENT.BRAND') }}</h1>
          <el-tooltip :content="t('AIAGENT.HISTORY.TOGGLE')"><button class="panel-toggle" type="button"
            :aria-label="t('AIAGENT.HISTORY.TOGGLE')" :aria-expanded="true" @click="toggleSidebar"><el-icon><Fold /></el-icon></button></el-tooltip>
        </div>
        <el-button class="history-new" :icon="Plus" @click="newConversation">{{ t('AIAGENT.HISTORY.NEW') }}</el-button>
        <div class="history-search"><el-input ref="historySearchRef" v-model="historyQuery" clearable :prefix-icon="Search" :placeholder="t('CM.COMMON.SEARCH')" :aria-label="`${t('AIAGENT.HISTORY.TITLE')} · ${t('CM.COMMON.SEARCH')}`" @keydown.esc.stop="historyQuery = ''" /></div>
        <el-scrollbar class="history-scroll">
          <el-empty v-if="!filteredHistory.length" :image-size="48" :description="t(historyQuery.trim() ? 'CM.UX.HOME.SEARCH.RESULT.EMPTY' : 'AIAGENT.HISTORY.EMPTY')" />
          <template v-if="pinned.length">
            <div class="history-heading"><span><el-icon><StarFilled /></el-icon>{{ t('AIAGENT.HISTORY.FAVORITES') }}</span><span class="count">{{ pinned.length }}</span></div>
            <div v-for="chat in pinned" :key="chat.id" class="history-item" :class="{ selected: chat.id === activeId }">
              <button class="history-select" type="button" :aria-current="chat.id === activeId ? 'page' : undefined" @click="openHistoryResult(chat)">
                <i class="state-dot" :class="chatState(chat)" :title="chatStateKeys[chatState(chat)] ? t(chatStateKeys[chatState(chat)]) : undefined" aria-hidden="true" /><span><strong :title="chat.title || t('AIAGENT.HISTORY.UNTITLED')">{{ chat.title || t('AIAGENT.HISTORY.UNTITLED') }}</strong><span v-if="historyQuery.trim()" class="history-match" :title="historyMatch(chat)">{{ historyMatch(chat) }}</span><span v-else class="history-meta"><time>{{ formatTime(chat.updatedAt) }}</time><em v-if="chatState(chat) !== 'empty'" class="history-state" :class="chatState(chat)">{{ t(chatStateKeys[chatState(chat)]) }}</em></span></span>
              </button>
              <div class="history-actions">
                <el-button text :icon="StarFilled" class="starred" :aria-label="t('AIAGENT.HISTORY.UNFAVORITE')" :title="t('AIAGENT.HISTORY.UNFAVORITE')" @click="toggleFavorite(chat)" />
                <el-button text :icon="EditPen" :aria-label="t('AIAGENT.HISTORY.RENAME')" :title="t('AIAGENT.HISTORY.RENAME')" @click="renameConversation(chat)" />
                <el-button text :icon="Delete" :aria-label="t('AIAGENT.HISTORY.DELETE')" :title="t('AIAGENT.HISTORY.DELETE')" @click="deleteConversation(chat)" />
              </div>
            </div>
          </template>
          <div v-if="unpinned.length" class="history-heading"><span>{{ t('AIAGENT.HISTORY.TITLE') }}</span><span class="count">{{ unpinned.length }}</span></div>
          <div v-for="chat in unpinned" :key="chat.id" class="history-item" :class="{ selected: chat.id === activeId }">
            <button class="history-select" type="button" :aria-current="chat.id === activeId ? 'page' : undefined" @click="openHistoryResult(chat)">
              <i class="state-dot" :class="chatState(chat)" :title="chatStateKeys[chatState(chat)] ? t(chatStateKeys[chatState(chat)]) : undefined" aria-hidden="true" /><span><strong :title="chat.title || t('AIAGENT.HISTORY.UNTITLED')">{{ chat.title || t('AIAGENT.HISTORY.UNTITLED') }}</strong><span v-if="historyQuery.trim()" class="history-match" :title="historyMatch(chat)">{{ historyMatch(chat) }}</span><span v-else class="history-meta"><time>{{ formatTime(chat.updatedAt) }}</time><em v-if="chatState(chat) !== 'empty'" class="history-state" :class="chatState(chat)">{{ t(chatStateKeys[chatState(chat)]) }}</em></span></span>
            </button>
            <div class="history-actions">
              <el-button text :icon="Star" :aria-label="t('AIAGENT.HISTORY.FAVORITE')" :title="t('AIAGENT.HISTORY.FAVORITE')" @click="toggleFavorite(chat)" />
              <el-button text :icon="EditPen" :aria-label="t('AIAGENT.HISTORY.RENAME')" :title="t('AIAGENT.HISTORY.RENAME')" @click="renameConversation(chat)" />
              <el-button text :icon="Delete" :aria-label="t('AIAGENT.HISTORY.DELETE')" :title="t('AIAGENT.HISTORY.DELETE')" @click="deleteConversation(chat)" />
            </div>
          </div>
        </el-scrollbar>
        <p v-if="storageWarning" class="history-note warning" role="alert">{{ t(storageWarning) }}</p>
        </div>
      </component>
      <!-- 展示层修复：窄屏抽屉关闭时也保留原有历史入口，复用 toggleSidebar。 -->
      <el-tooltip v-if="mobile || !sidebarOpen" :content="t('AIAGENT.HISTORY.TOGGLE')" placement="right">
        <button class="panel-handle" type="button" :aria-label="t('AIAGENT.HISTORY.TOGGLE')" :aria-expanded="mobile ? drawerOpen : sidebarOpen" @click="toggleSidebar"><el-icon><Fold /></el-icon></button>
      </el-tooltip>
      <main class="chat-pane" :class="{ 'chat-pane--welcome': !messages.length }" @dragenter="onAttachmentDragEnter" @dragover="onAttachmentDragOver" @dragleave="onAttachmentDragLeave" @drop="onAttachmentDrop">
        <div v-if="attachmentDragDepth" class="attachment-drop" aria-hidden="true"><el-icon><Paperclip /></el-icon><strong>{{ attachmentCopy.add }}</strong><span>{{ attachmentHint }}</span></div>
        <!-- 会话目录只服务于长对话定位；导出与独立阅读入口按需求移除。 -->
        <header v-if="messages.length" class="conversation-bar">
          <button class="conversation-title" type="button" :title="t('AIAGENT.HISTORY.RENAME')" @click="renameConversation(current)"><span>{{ current.title || t('AIAGENT.HISTORY.UNTITLED') }}</span><el-icon><EditPen /></el-icon></button>
          <div class="conversation-controls">
            <el-tooltip :content="t(current.favorite ? 'AIAGENT.HISTORY.UNFAVORITE' : 'AIAGENT.HISTORY.FAVORITE')"><button type="button" class="utility-button" :class="{ starred: current.favorite }" :aria-label="t(current.favorite ? 'AIAGENT.HISTORY.UNFAVORITE' : 'AIAGENT.HISTORY.FAVORITE')" :aria-pressed="!!current.favorite" @click="toggleFavorite(current)"><el-icon><component :is="current.favorite ? StarFilled : Star" /></el-icon></button></el-tooltip>
            <el-tooltip :content="t('AIAGENT.A11Y.MESSAGES')"><button ref="outlineButton" type="button" class="utility-button" :aria-label="t('AIAGENT.A11Y.MESSAGES')" :aria-expanded="outlineOpen" aria-controls="conversation-outline" @click="outlineOpen = !outlineOpen"><el-icon><Operation /></el-icon><span>{{ questionEntries.length }}</span></button></el-tooltip>
          </div>
        </header>
        <nav v-if="outlineOpen && messages.length" id="conversation-outline" class="conversation-outline" :aria-label="t('AIAGENT.A11Y.MESSAGES')">
          <div class="outline-heading"><strong>{{ t('AIAGENT.A11Y.MESSAGES') }}</strong><button type="button" class="utility-button" :aria-label="t('CM.COMMON.CLOSE')" @click="closeOutline"><el-icon><Close /></el-icon></button></div>
          <button v-for="(entry, index) in questionEntries" :key="entry.id" type="button" class="outline-entry" @click="jumpToMessage(entry.id); outlineOpen = false"><span>{{ String(index + 1).padStart(2, '0') }}</span><strong>{{ entry.content }}</strong><el-icon><ArrowRight /></el-icon></button>
        </nav>
        <div class="chat-scroll-area">
          <el-scrollbar ref="scrollRef" class="message-scroll" :class="{ 'message-scroll--welcome': !messages.length }" @scroll="onScroll">
            <div v-if="!messages.length" class="welcome">
              <!-- 起始页只保留可操作的预制问题；不再重复品牌、标题、说明和装饰。 -->
              <div class="suggestions">
                <button v-for="key in ['ONE', 'TWO', 'THREE']" :key="key" type="button" class="suggestion" :title="t(`AIAGENT.EXAMPLE.${key}.PROMPT`)" @click="setDraft(t(`AIAGENT.EXAMPLE.${key}.PROMPT`))">
                  {{ t(`AIAGENT.EXAMPLE.${key}.DESCRIPTION`) }}
                </button>
              </div>
            </div>
            <div v-else class="message-list" role="log" aria-live="off" :aria-label="t('AIAGENT.A11Y.MESSAGES')">
              <article v-for="message in messages" :id="`chat-message-${message.id}`" :key="message.id" class="message-row" :class="[message.role, { located: locatedMessageId === message.id }]" tabindex="-1">
                <div class="message-column">
                  <!-- 按本轮反馈：生成状态统一到过程入口，不再另设消息头胶囊。 -->
                  <div v-if="!isActive(message)" class="message-meta">
                    <time v-if="message.role === 'user' || (!isActive(message) && !message.finishedAt)" class="message-time" :datetime="new Date(message.createdAt).toISOString()">{{ formatTime(message.createdAt) }}</time>
                    <!-- 结束异常/中断不能沿用“完成于”文案；仅调整呈现，复用现有状态与耗时键。 -->
                    <span v-if="message.finishedAt && !isActive(message)" class="message-time finished">
                      <template v-if="message.status === 'completed'">{{ finishText(message) }}</template>
                      <template v-else>{{ t(statusKeys[message.status]) }} · {{ t('AIAGENT.STATUS.ELAPSED', { seconds: ((message.finishedAt - message.createdAt) / 1000).toFixed(1) }) }}</template>
                    </span>
                  </div>
                  <div class="bubble">
                    <template v-if="message.role === 'user'">
                      <p class="user-content">{{ message.content }}</p>
                      <div v-if="message.attachments?.length" class="sent-attachments">
                        <button v-for="file in message.attachments" :key="file.id" type="button" class="attachment-preview" :title="file.name" @click="attachmentPreview = file"><el-icon><Document /></el-icon><span>{{ file.name }}</span></button>
                      </div>
                    </template>
                    <template v-else>
                      <!-- 单一状态入口：连接、执行、输出沿用同一行视觉；过程默认收起，保留手动选择。 -->
                      <div v-if="isActive(message) && !message.process.length" class="waiting">
                        <ActivityMark />
                        <span class="live-step">{{ t(statusKeys[message.status]) }}</span>
                        <span class="status-elapsed">{{ t('AIAGENT.STATUS.ELAPSED', { seconds: Math.floor(Math.max(0, now - message.createdAt) / 1000) }) }}</span>
                      </div>
                      <div v-if="message.process.length" class="process-trace" :class="[{ live: isActive(message) }, message.status]">
                        <button class="trace-toggle" type="button" :data-message-id="message.id" :aria-expanded="traceOpen(message)" :aria-controls="`trace-${message.id}`">
                          <template v-if="isActive(message)">
                            <ActivityMark />
                            <span class="live-step">{{ liveLabel(message) }}</span>
                            <span class="status-elapsed">{{ t('AIAGENT.STATUS.ELAPSED', { seconds: Math.floor(Math.max(0, now - message.createdAt) / 1000) }) }}</span>
                          </template>
                          <template v-else>
                            <el-icon class="trace-result" aria-hidden="true"><component :is="message.status === 'error' ? CircleClose : message.status === 'stopped' ? VideoPause : CircleCheck" /></el-icon>
                            <span>{{ t('AIAGENT.PROCESS.TITLE') }}</span><span v-if="message.status === 'error' || message.status === 'stopped'" class="trace-outcome">{{ t(statusKeys[message.status]) }}</span><span class="count">{{ layout(message).timeline.length }}</span>
                          </template>
                          <el-icon class="chevron" :class="{ expanded: traceOpen(message) }"><ArrowRight /></el-icon>
                        </button>
                        <ol v-if="traceOpen(message)" :id="`trace-${message.id}`" class="timeline">
                          <li v-for="item in layout(message).timeline" :key="item.id" :class="['process-item', item.kind, item.status]">
                            <span class="timeline-dot" :class="{ 'is-live': isActive(message) && item.status === 'running' }" aria-hidden="true" />
                            <div v-if="item.kind === 'text'" class="reasoning-line">
                              <Typewriter :content="item.text" :active="isActive(message) && item.status === 'running'" :cursor="cursorOwner(message) === item.id" @progress="scheduleScroll" />
                            </div>
                            <!-- 技能加载只是读了说明书（16ms），不是执行工具：一行淡色提示即可，不占可展开卡片。 -->
                            <div v-else-if="item.skillLoad" class="skill-load-line">
                              <el-icon><SkillIcon /></el-icon><span>{{ t('AIAGENT.PROCESS.SKILL_LOADED', { name: item.toolName }) }}</span>
                            </div>
                            <div v-else class="process-card">
                              <button class="process-summary" type="button" :data-message-id="message.id" :data-process-id="item.id" :aria-expanded="item.expanded" :aria-controls="`process-${message.id}-${item.id}`">
                                <el-icon class="kind-icon"><component :is="kindIcon(item)" /></el-icon>
                                <span class="process-title">{{ processTitle(item) }}</span>
                                <span class="duration">{{ durationText(item) }}</span>
                                <el-icon class="process-state" :aria-label="t(processStatusKeys[item.status])" role="img">
                                  <component :is="stateIcon(item)" />
                                </el-icon>
                                <el-icon class="chevron" :class="{ expanded: item.expanded }"><ArrowRight /></el-icon>
                              </button>
                              <div v-if="item.expanded" :id="`process-${message.id}-${item.id}`" class="process-details">
                                <template v-if="item.kind === 'subagent'">
                                  <p v-if="item.agentName" class="technical-name">{{ item.agentName }}</p>
                                  <template v-if="item.thinking"><h4>{{ t('AIAGENT.PROCESS.SUBAGENT_THINKING') }}</h4><p class="reasoning-text">{{ item.thinking }}</p></template>
                                  <template v-if="item.answer"><h4>{{ t('AIAGENT.PROCESS.SUBAGENT_ANSWER') }}</h4>
                                    <Typewriter :content="item.answer" :active="isActive(message) && item.status === 'running'" :cursor="cursorOwner(message) === item.id" @progress="scheduleScroll" /></template>
                                  <p v-if="!item.thinking && !item.answer" class="quiet">{{ t('AIAGENT.STATUS.WAITING') }}</p>
                                </template>
                                <template v-else-if="item.kind === 'json'"><pre class="json-text">{{ item.input }}</pre></template>
                                <template v-else>
                                  <h4>{{ t('AIAGENT.PROCESS.DETAILS_TITLE') }}</h4>
                                  <dl v-if="toolFacts(item).length" class="tool-facts">
                                    <template v-for="fact in toolFacts(item)" :key="fact.label"><dt>{{ fact.label }}</dt><dd>{{ fact.value }}</dd></template>
                                  </dl>
                                  <p v-else class="quiet">{{ t('AIAGENT.PROCESS.NO_DETAILS') }}</p>
                                  <details v-if="item.input" class="raw-details"><summary>{{ t('AIAGENT.PROCESS.RAW') }}</summary><pre>{{ prettyJson(item.input) }}</pre></details>
                                </template>
                              </div>
                            </div>
                          </li>
                        </ol>
                      </div>
                      <div v-for="item in layout(message).body" :key="`body-${item.id}`" class="answer-part">
                        <Typewriter v-if="item.kind === 'text'" :content="item.text" :active="isActive(message)" :cursor="cursorOwner(message) === item.id" @progress="scheduleScroll" />
                        <div v-else-if="item.kind === 'chart'" class="chart-card">
                          <div class="card-head">
                            <span class="kind-icon"><el-icon><TrendCharts /></el-icon></span>
                            <span class="process-title">{{ item.chart?.title || t('AIAGENT.CHART.TITLE') }}</span>
                            <el-tooltip v-if="canDownloadChart(item)" :content="t(item.chart?.chart_type === 'table' ? 'AIAGENT.CHART.DOWNLOAD_TABLE' : 'AIAGENT.CHART.DOWNLOAD')">
                              <button class="card-action" type="button" :aria-label="t(item.chart?.chart_type === 'table' ? 'AIAGENT.CHART.DOWNLOAD_TABLE' : 'AIAGENT.CHART.DOWNLOAD')" @click.stop="downloadChart(message, item)"><el-icon><Download /></el-icon></button>
                            </el-tooltip>
                          </div>
                          <div :id="`chart-${message.id}-${item.id}`" class="chart-block-body">
                            <p v-if="item.chart?.summary" class="chart-summary">{{ item.chart.summary }}</p>
                            <div v-if="item.chart?.chart_type === 'table' && item.chart?.table_data" class="chart-table-scroll">
                              <table class="chart-table">
                                <thead><tr><th v-for="(head, hi) in item.chart.table_data.headers" :key="hi">{{ head }}</th></tr></thead>
                                <tbody>
                                  <tr v-for="(row, ri) in item.chart.table_data.rows" :key="ri">
                                    <td v-for="(cell, ci) in row" :key="ci">{{ cell }}</td>
                                  </tr>
                                </tbody>
                              </table>
                            </div>
                            <ChartView v-else-if="item.chart?.series && item.chart.series.length" :ref="el => { setChartRef(chartKey(message, item), el); }" :content="item.chart" />
                            <p v-else class="quiet">{{ t('AIAGENT.CHART.NO_DATA') }}</p>
                            <p v-if="item.chart?.total != null" class="chart-meta">{{ t('AIAGENT.CHART.RECORDS', { total: item.chart.total, displayed: item.chart.displayed ?? item.chart.total }) }}</p>
                          </div>
                        </div>
                      </div>
                      <p v-if="message.status === 'completed' && !bodyEntries(message).length" class="quiet">{{ t('AIAGENT.STATUS.NO_ANSWER') }}</p>
                      <p v-if="message.status === 'stopped'" class="quiet">{{ t('AIAGENT.STATUS.STOPPED_NOTE') }}</p>
                      <div v-if="message.errorKey" class="error-card" role="alert"><el-icon><Warning /></el-icon><div><strong>{{ t(message.errorKey) }}</strong><p v-if="message.errorDetail">{{ message.errorDetail }}</p></div></div>
                    </template>
                  </div>
                  <div v-if="message.role === 'user'" class="question-actions">
                    <el-tooltip :content="t('AIAGENT.BUTTON.EDIT_QUESTION')"><button type="button" class="utility-button" :disabled="streaming || attachmentReading" :aria-label="t('AIAGENT.BUTTON.EDIT_QUESTION')" @click="editQuestion(message)"><el-icon><EditPen /></el-icon></button></el-tooltip>
                  </div>
                  <div v-if="message.role === 'assistant' && !isActive(message)" class="message-actions">
                    <el-button text size="small" :icon="CopyDocument" :disabled="!answerText(message)" @click="copyAnswer(message)">{{ t(copiedMessageId === message.id ? 'AIAGENT.COPY.SUCCESS' : 'AIAGENT.BUTTON.COPY') }}</el-button>
                    <!-- 反馈仅保存在本机，不声称已提交服务端；复用 YES / NOT 键，不新增语言包键。 -->
                    <el-tooltip :content="t('CM.COMMON.YES')"><button type="button" class="utility-button feedback-button" :class="{ selected: feedback.get(message.id) === 'up' }" :aria-label="t('CM.COMMON.YES')" :aria-pressed="feedback.get(message.id) === 'up'" @click="setFeedback(message, 'up')"><FeedbackIcon /></button></el-tooltip>
                    <el-tooltip :content="t('CM.COMMON.NOT')"><button type="button" class="utility-button feedback-button" :class="{ selected: feedback.get(message.id) === 'down' }" :aria-label="t('CM.COMMON.NOT')" :aria-pressed="feedback.get(message.id) === 'down'" @click="setFeedback(message, 'down')"><FeedbackIcon down /></button></el-tooltip>
                    <el-button v-if="canRegenerate(message)" text size="small" :icon="RefreshRight" :disabled="streaming" @click="regenerate(message)">{{ t('AIAGENT.BUTTON.REGENERATE') }}</el-button>
                  </div>
                </div>
              </article>
            </div>
          </el-scrollbar>
          <el-button v-if="messages.length && !following" class="back-bottom" round :icon="ArrowDown" @click="jumpToBottom"><span v-if="streaming" class="bottom-generating">{{ t('AIAGENT.STATUS.ANSWER') }} · </span>{{ t('AIAGENT.BUTTON.BOTTOM') }}</el-button>
        </div>
        <footer class="composer-region">
          <div class="composer" :class="{ 'is-streaming': streaming, 'has-attachments': draftAttachments.length }" @paste="onAttachmentPaste">
            <!-- DOCX / XLSX 在本地提取文本与表格；仍通过现有 message.content 发送，无新增上传接口。 -->
            <input ref="attachmentInput" hidden type="file" :accept="ATTACHMENT_ACCEPT" multiple tabindex="-1" :aria-label="attachmentCopy.add" @change="onAttachmentChoose" />
            <div v-if="draftAttachments.length" class="attachment-list">
              <div v-for="file in draftAttachments" :key="file.id" class="attachment-chip">
                <button type="button" class="attachment-preview" :title="file.name" @click="attachmentPreview = file"><el-icon><Document /></el-icon><span>{{ file.name }}</span></button>
                <button type="button" class="attachment-remove" :aria-label="`${t('CM.COMMON.DELETE')} ${file.name}`" :title="t('CM.COMMON.DELETE')" @click="removeAttachment(file.id)"><el-icon><Close /></el-icon></button>
              </div>
            </div>
            <p v-if="attachmentError" class="attachment-error" role="alert">{{ attachmentError }}<button type="button" :aria-label="t('CM.COMMON.CLOSE')" @click="attachmentErrors.delete(activeId)"><el-icon><Close /></el-icon></button></p>
            <div v-if="editingMessageId" class="composer-editing"><span><el-icon><EditPen /></el-icon>{{ t('AIAGENT.BUTTON.EDIT_QUESTION') }}</span><button type="button" class="utility-button" :aria-label="t('AIAGENT.BUTTON.CANCEL')" :title="t('AIAGENT.BUTTON.CANCEL')" @click="cancelQuestionEdit"><el-icon><Close /></el-icon></button></div>
            <el-input ref="inputRef" v-model="draft" type="textarea" resize="none" :autosize="{ minRows: 2, maxRows: 6 }" :placeholder="t('AIAGENT.INPUT.PLACEHOLDER')" :aria-label="t('AIAGENT.INPUT.LABEL')" @keydown="onInputKeydown" />
            <div class="composer-toolbar">
              <div class="composer-tools">
                <!-- 用户确认的新文案由本组件随 locale 提供；不新增外部语言包键。 -->
                <el-tooltip placement="top-start" effect="light" :trigger="['hover', 'focus']">
                  <template #content><div class="attachment-limits">{{ attachmentCopy.limits }}</div></template>
                  <el-button text :icon="Paperclip" :disabled="attachmentReading" :aria-label="attachmentCopy.add" @click="attachmentInput?.click()">{{ attachmentCopy.add }}<span v-if="draftAttachments.length" class="attachment-count">{{ draftAttachments.length }}</span></el-button>
                </el-tooltip>
                <!-- 用户选择简短说明：悬停或键盘聚焦显示，随 locale 切换，不增加外部 t() 键。 -->
                <el-tooltip placement="top-start" effect="light" :trigger="['hover', 'focus']" :show-after="100" :hide-after="100">
                  <template #content><div class="attachment-format-hint">{{ attachmentCopy.formatsSummary }}</div></template>
                  <button type="button" class="attachment-info" :aria-label="attachmentCopy.formatsTitle"><el-icon><InfoFilled /></el-icon></button>
                </el-tooltip>
                <span v-if="attachmentReading" role="status">{{ t('CM.COMMON.UPLOADING_FILE') }}</span>
                <span v-else-if="streaming" class="next-draft">{{ t('AIAGENT.INPUT.NEXT_DRAFT') }}</span>
              </div>
              <el-button v-if="streaming" class="stop-button" :icon="VideoPause" @click="stopGeneration">{{ t('AIAGENT.BUTTON.STOP') }}</el-button>
              <el-button v-else class="send-button" type="primary" :icon="editingMessageId ? RefreshRight : Top" :aria-label="t(editingMessageId ? 'AIAGENT.BUTTON.REGENERATE' : 'AIAGENT.BUTTON.SEND')" :title="t(editingMessageId ? 'AIAGENT.BUTTON.REGENERATE' : 'AIAGENT.BUTTON.SEND')" :disabled="!draft.trim() || attachmentReading" @click="sendMessage" />
            </div>
          </div>
        </footer>
      </main>
    </div>
    <el-dialog :model-value="!!attachmentPreview" :title="attachmentPreview?.name || t('CM.COMMON.PREVIEW')" width="min(760px, 92vw)" :append-to-body="false" @update:model-value="value => { if (!value) attachmentPreview = null; }">
      <pre class="attachment-content">{{ attachmentPreview?.content }}</pre>
    </el-dialog>
    <p class="sr-only" role="status" aria-live="polite">{{ t(streaming ? 'AIAGENT.A11Y.GENERATING' : 'AIAGENT.A11Y.READY') }}</p>
  </section>
</template>
<script setup lang="ts">
import { computed, defineComponent, h, nextTick, onMounted, onUnmounted, reactive, ref, watch, type PropType } from 'vue';
import { useI18n } from 'vue-i18n';
import { ElButton, ElInput, ElIcon, ElTooltip, ElEmpty, ElScrollbar, ElDrawer, ElDialog, ElMessage, ElMessageBox, type InputInstance, type ScrollbarInstance } from 'element-plus';
import { ArrowDown, ArrowRight, ChatLineRound, CircleCheck, CircleClose, Close, Connection, CopyDocument, Delete, Document, Download, EditPen, Fold, InfoFilled, Loading, Operation, Paperclip, Plus, Top, RefreshRight, Search, Star, StarFilled, TrendCharts, VideoPause, Warning } from '@element-plus/icons-vue';
import { useLoginStore } from '~/store';
import * as echarts from 'echarts';
import { merge, cloneDeep } from 'lodash-es';
import pdfWorkerUrl from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url';

/* 新增文案：将每行 key 与中文/英文分别加入 CN.js / US.js 的现有对象。
AIAGENT.BRAND | VDS动态看板 | VDS Realtime Dashboard
AIAGENT.BUTTON.REGENERATE | 重新生成 | Regenerate
AIAGENT.CHART.DOWNLOAD | 下载图表 | Download chart
AIAGENT.CHART.DOWNLOAD_TABLE | 导出 CSV | Export CSV
AIAGENT.PROCESS.THINKING_TURN | 思考 | Reasoning
AIAGENT.PROCESS.DETAILS_TITLE | 本次调用 | This call
AIAGENT.PROCESS.SKILL | 技能 | Skill
AIAGENT.PROCESS.STATUS | 状态 | Status
AIAGENT.PROCESS.DURATION_LABEL | 耗时 | Duration
AIAGENT.PROCESS.RAW | 原始数据 | Raw data
AIAGENT.PROCESS.NO_DETAILS | 该技能没有返回额外信息。 | This skill returned no extra information.
AIAGENT.HISTORY.FAVORITES | 收藏 | Favorites
AIAGENT.HISTORY.FAVORITE | 收藏该会话 | Add to favorites
AIAGENT.HISTORY.UNFAVORITE | 取消收藏 | Remove from favorites
AIAGENT.WELCOME.TITLE / TIP 与 AIAGENT.EXAMPLE.* 已改为 SDA 计费问答场景。
技能名保持英文原文（query-planning / query-execute / render-chart），故不再需要 AIAGENT.SKILL.QUERY_* 系列。
*/
const { t, locale } = useI18n();
// 用户选择的 06「拼图」：Lucide puzzle（ISC，Copyright Lucide Contributors）。
// 内联单枚图标，不安装整套图标依赖；活动形变标识仍由 ActivityMark 负责。
/*! ISC License

Copyright (c) 2026 Lucide Icons and Contributors

Permission to use, copy, modify, and/or distribute this software for any
purpose with or without fee is hereby granted, provided that the above
copyright notice and this permission notice appear in all copies.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES
WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF
MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR
ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES
WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN
ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF
OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE. */
const SkillIcon = defineComponent({
  setup: () => () => h('svg', { viewBox: '0 0 24 24', width: '1em', height: '1em', fill: 'none', stroke: 'currentColor', 'stroke-width': 1.7, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true' }, [
    h('path', { d: 'M15.39 4.39a1 1 0 0 0 1.68-.474 2.5 2.5 0 1 1 3.014 3.015 1 1 0 0 0-.474 1.68l1.683 1.682a2.414 2.414 0 0 1 0 3.414L19.61 15.39a1 1 0 0 1-1.68-.474 2.5 2.5 0 1 0-3.014 3.015 1 1 0 0 1 .474 1.68l-1.683 1.682a2.414 2.414 0 0 1-3.414 0L8.61 19.61a1 1 0 0 0-1.68.474 2.5 2.5 0 1 1-3.014-3.015 1 1 0 0 0 .474-1.68l-1.683-1.682a2.414 2.414 0 0 1 0-3.414L4.39 8.61a1 1 0 0 1 1.68.474 2.5 2.5 0 1 0 3.014-3.015 1 1 0 0 1-.474-1.68l1.683-1.682a2.414 2.414 0 0 1 3.414 0z' }),
  ]),
});
// 用户已确认的单枚折叠标识：沿用示例的形变轨迹和 5.6 秒节奏；不由 token 更新驱动。
// 用户明确要求每次生成均自动播放此状态动效；其他减少动态行为保持原有策略。
const ActivityMark = defineComponent({
  setup: () => () => h('span', { class: 'activity-mark', 'aria-hidden': 'true' }, [
    h('span', { class: 'activity-scale' }, [h('span', { class: 'activity-form' }, [
      ...['a', 'b', 'c', 'd'].map(part => h('i', { class: `activity-fold activity-fold-${part}` })),
      h('i', { class: 'activity-core' }),
    ])]),
  ]),
});
// 与现有线性图标统一的赞/踩图形。文案意图为“有帮助 / 没有帮助”；没有新增外部 t() 键。
const FeedbackIcon = defineComponent({
  props: { down: Boolean },
  setup: props => () => h('svg', { viewBox: '0 0 24 24', width: 16, height: 16, fill: 'none', stroke: 'currentColor', 'stroke-width': 1.6, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true', class: { 'feedback-down': props.down } }, [
    h('path', { d: 'M7 10v11H3V10h4Zm0 0 4-8c2 0 3 1 3 3v4h5a2 2 0 0 1 2 2l-1.4 8a2 2 0 0 1-2 2H7' }),
  ]),
});
const PREFIX = '/vds';
const IDLE_TIMEOUT = 120_000;
const STORAGE_KEY = 'vds_ai_conversations';
type JsonRecord = Record<string, unknown>;
type Status = 'waiting' | 'thinking' | 'tool' | 'subagent' | 'answer' | 'completed' | 'stopped' | 'error';
type ProcessStatus = 'running' | 'completed' | 'error' | 'stopped';
type ProcessKind = 'text' | 'tool' | 'subagent' | 'chart' | 'json';
type ChartType = 'table' | 'bar' | 'multi-bar' | 'line' | 'multi-line' | 'pie' | 'ring' | 'scatter';
interface ChartPoint { x: string | number; y: number | string; }
interface ChartSeries { name: string; data: ChartPoint[]; y_axis_index?: number; }
interface ChartTableData { headers: string[]; rows: (string | number)[][]; sortable?: boolean[]; filterable?: boolean[]; }
interface ChartContent {
  chart_type: ChartType; title: string; summary?: string; x_label?: string; y_label?: string;
  series?: ChartSeries[]; table_data?: ChartTableData; total?: number; displayed?: number;
  [key: string]: unknown;
}
interface ProcessItem {
  id: number; kind: ProcessKind; status: ProcessStatus;
  toolName: string; agentName: string; input: string; text: string; answer: string; thinking: string; chart?: ChartContent;
  startTime: number; duration?: number; expanded: boolean; manual?: boolean;
  // 这条 tool 事件只是「加载技能说明书」（title: "Loaded skill: xxx"），
  // 不是真正的工具执行——渲染时降级成一行淡色提示，不画成可展开的执行卡片。
  skillLoad?: boolean;
  // 服务端在 finish_stop 帧里点名的那一轮才是答复正文（参考 Dashboard 的 finish_stop 改名机制），
  // 其余文本都是过程叙述。只有这个标记为真的文本会被提升出折叠区。
  isFinal?: boolean;
}
interface TextAttachment { id: string; name: string; size: number; content: string; }
interface ChatMessage {
  attachments?: TextAttachment[];
  id: string; role: 'user' | 'assistant'; content: string; prompt: string; status: Status; createdAt: number;
  finishedAt?: number; process: ProcessItem[]; lastEvent?: string; activeSubagent?: number; errorKey?: string; errorDetail?: string;
  // 最近一次收到任意事件（含心跳）的时刻：用来判断「真在动」还是「上游静默」，
  // 以及给状态栏计时。心跳也会刷新它——这正是长静默期仍能证明模型存活的关键。
  lastSignalAt?: number;
  // 本轮接收到的字节总数与事件数，用于状态栏显示「已收到 N 段内容」。
  streamBytes?: number;
}
/** 气泡渲染布局：process 按时间顺序拆成「可折叠时间线」与「正文主体」两部分。 */
interface MessageLayout { timeline: ProcessItem[]; body: ProcessItem[]; }
interface Conversation {
  attachments?: TextAttachment[];
  id: string; title: string; conversationId: string | null; messages: ChatMessage[];
  createdAt: number; updatedAt: number; draft: string; favorite?: boolean;
}
interface StreamEvent {
  outerEvent: string; innerEvent?: string; content?: string; toolName?: string;
  raw: JsonRecord & { inner: JsonRecord }; conversationId?: string;
}
interface ChatRequest {
  conversationId: string; agent: { agentCode: 'SDA' }; message: { content: string }; stream: true;
}
const statusKeys: Record<Status, string> = {
  waiting: 'AIAGENT.STATUS.WAITING', thinking: 'AIAGENT.STATUS.THINKING', tool: 'AIAGENT.STATUS.TOOL',
  subagent: 'AIAGENT.STATUS.SUBAGENT', answer: 'AIAGENT.STATUS.ANSWER', completed: 'AIAGENT.STATUS.COMPLETED',
  stopped: 'AIAGENT.STATUS.STOPPED', error: 'AIAGENT.STATUS.ERROR',
};
const processStatusKeys: Record<ProcessStatus, string> = {
  running: 'AIAGENT.PROCESS.RUNNING', completed: 'AIAGENT.STATUS.COMPLETED', error: 'AIAGENT.PROCESS.ERROR', stopped: 'AIAGENT.PROCESS.STOPPED',
};
// SDA 的 tool 事件 metadata.toolName 恒为 "skill"，真正的技能名在 content 里。
// 技能名按用户要求保持英文原文（query-planning / query-execute / render-chart），不翻译。
const errorKeys: Record<string, string> = {
  ExecuteAgentContentError: 'AIAGENT.ERROR.CONTENT', ExecuteAgentSafetyCheckError: 'AIAGENT.ERROR.SAFETY',
  ExecuteAgentInternalSystemError: 'AIAGENT.ERROR.INTERNAL', ExecuteAgentLicenseCheckError: 'AIAGENT.ERROR.LICENSE',
};
function isRecord(value: unknown): value is JsonRecord { return typeof value === 'object' && value !== null && !Array.isArray(value); }

// 增量按行切分，兼容 LF、CRLF、CR；跨 chunk 的半行和半帧继续保留。
function createSseParser(onEvent: (event: StreamEvent) => void) {
  let buffer = '';
  let dataLines: string[] = [];
  const dispatch = () => {
    const payload = dataLines.join('\n');
    dataLines = [];
    if (!payload.trim()) return;
    let outer: unknown;
    try { outer = JSON.parse(payload); } catch { return; }
    if (!isRecord(outer) || typeof outer.event !== 'string') return;
    let inner: JsonRecord = {};
    if (typeof outer.data === 'string') {
      try {
        const parsed: unknown = JSON.parse(outer.data);
        if (isRecord(parsed)) inner = parsed;
      } catch { /* 错误帧 data 为纯文本，保留在 raw.data 中。 */ }
    }
    const metadata = isRecord(inner.metadata) ? inner.metadata : {};
    onEvent({
      outerEvent: outer.event,
      innerEvent: typeof inner.event === 'string' ? inner.event : undefined,
      content: typeof inner.content === 'string' ? inner.content : undefined,
      toolName: typeof metadata.toolName === 'string' ? metadata.toolName : undefined,
      raw: { ...outer, inner },
      conversationId: typeof outer.conversationId === 'string' ? outer.conversationId : undefined,
    });
  };
  return (chunk: string, eof = false) => {
    buffer += chunk;
    while (buffer.length) {
      const match = /[\r\n]/.exec(buffer);
      if (!match) break;
      const i = match.index;
      if (buffer[i] === '\r' && i === buffer.length - 1 && !eof) break;
      const line = buffer.slice(0, i);
      const width = buffer[i] === '\r' && buffer[i + 1] === '\n' ? 2 : 1;
      buffer = buffer.slice(i + width);
      if (line === '') dispatch();
      else if (line.startsWith('data:')) dataLines.push(line.slice(5).replace(/^ /, ''));
    }
    // EOF 不把缺少空行终止符的残帧伪装成有效事件。
    if (eof) { buffer = ''; dataLines = []; }
  };
}

function chatStream(body: ChatRequest, onEvent: (event: StreamEvent) => void,
  onError: (error: unknown) => void, onComplete: () => void): () => void {
  const csrf = useLoginStore().getCsrfWebToken;
  const controller = new AbortController();
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let settled = false;
  let receivedEndEvent = false;
  const clearTimer = () => { if (timer !== undefined) clearTimeout(timer); };
  const cancelTransport = () => {
    controller.abort();
    void reader?.cancel().catch(() => undefined);
  };
  const fail = (error: unknown) => {
    if (settled) return;
    settled = true;
    clearTimer();
    cancelTransport();
    onError(error);
  };
  const touch = () => {
    clearTimer();
    timer = setTimeout(() => fail(new Error('IDLE_TIMEOUT')), IDLE_TIMEOUT);
  };
  const parse = createSseParser(event => {
    if (settled) return;
    // 连接关闭不等于业务完成：只有主请求的有效结束帧才确认成功。
    // subagent_done 仅结束子任务，错误帧和缺少帧分隔符的残片均不算完成。
    if (event.outerEvent === 'ExecuteAgentNormal' && (event.innerEvent === 'done' || event.innerEvent === 'finish_stop')) receivedEndEvent = true;
    onEvent(event);
  });
  touch(); // 包括等待响应头期间；每次收到实际字节后重置。
  void (async () => {
    try {
      const resp = await fetch(`${PREFIX}/webapi/ai/aiagent/v1/conversations`, {
        method: 'POST', credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream', 'CSRFWebToken': csrf },
        body: JSON.stringify(body), signal: controller.signal,
      });
      if (settled) { await resp.body?.cancel(); return; }
      if (!resp.ok) throw Object.assign(new Error('HTTP_ERROR'), { status: resp.status });
      if (!resp.body || !resp.headers.get('content-type')?.includes('text/event-stream')) {
        throw new Error('INVALID_STREAM');
      }
      reader = resp.body.getReader();
      const decoder = new TextDecoder();
      while (!settled) {
        const { done, value } = await reader.read();
        if (settled) break;
        if (done) {
          parse(decoder.decode(), true);
          if (!settled) {
            if (!receivedEndEvent) fail(new Error('UNEXPECTED_EOF'));
            else { settled = true; clearTimer(); onComplete(); }
          }
          break;
        }
        if (value.byteLength) touch(); // 心跳也算数据，必须在解析前刷新。
        parse(decoder.decode(value, { stream: true }));
      }
    } catch (error) {
      if (!settled) fail(error);
    } finally {
      clearTimer();
      reader?.releaseLock();
    }
  })();
  return () => {
    if (settled) return;
    settled = true;
    clearTimer();
    cancelTransport();
  };
}

// 数量和原文件大小在上传提示中说明；文本提取量限制保护既有请求和本地历史。
const MAX_ATTACHMENTS = 5;
const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;
const MAX_ATTACHMENT_TOTAL = MAX_ATTACHMENTS * MAX_ATTACHMENT_BYTES;
const ATTACHMENT_ACCEPT = '.pdf,.pptx,.docx,.xlsx,.txt,.md,.markdown,.csv,.json,.log,.yaml,.yml,.xml,.sql,.js,.ts,.py,.java,.c,.cpp,.h,.html,.css';
// 本地 OOXML 文本提取，不引入依赖：浏览器 ZIP/DEFLATE + XML DOM。
// DOCX：正文段落、表格；XLSX：全部工作表、共享字符串、日期、百分比、公式缓存值。
// PPTX 复用同一解析器；不执行宏/公式/外部关系，不支持旧版 DOC/XLS 与扫描图片。
const MAX_OFFICE_EXPANDED_BYTES = 24 * 1024 * 1024;
const MAX_DOCUMENT_PAGES = 200;
// 字体/CMap 随 Vite 打包到同源静态资源，不从 CDN 读取；兼容原工程 Vite 4/5。
const pdfAssets = import.meta.glob('/node_modules/pdfjs-dist/{cmaps,standard_fonts}/*', { eager: true, as: 'url' }) as Record<string, string>;
class PdfBinaryDataFactory {
  async fetch({ kind, filename }: { kind: string; filename: string }): Promise<Uint8Array> {
    const folder = kind === 'cMapUrl' ? 'cmaps' : kind === 'standardFontDataUrl' ? 'standard_fonts' : '';
    const url = folder && pdfAssets[`/node_modules/pdfjs-dist/${folder}/${filename}`];
    if (!url) throw new Error('PDF_RESOURCE_UNAVAILABLE');
    const response = await fetch(url);
    if (!response.ok) throw new Error('PDF_RESOURCE_UNAVAILABLE');
    return new Uint8Array(await response.arrayBuffer());
  }
}
async function readPdfFile(file: File): Promise<string> {
  // 主解析库只在首次上传 PDF 时加载；仅读取文本层，不渲染页面或启动 OCR。
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
  const task = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()), BinaryDataFactory: PdfBinaryDataFactory,
    useWorkerFetch: false, useWasm: false, isEvalSupported: false, disableFontFace: true, disableWorkerRendering: true, stopAtErrors: true });
  const timeout = setTimeout(() => { void task.destroy().catch(() => undefined); }, 30000);
  try {
    const document = await task.promise;
    if (document.numPages > MAX_DOCUMENT_PAGES) throw new Error('DOCUMENT_PAGES');
    const pages: string[] = []; let bytes = 0, hasText = false;
    for (let number = 1; number <= document.numPages; number++) {
      const page = await document.getPage(number);
      try {
        const content = await page.getTextContent();
        let text = '', previousY: number | undefined;
        for (const item of content.items) {
          if (!('str' in item)) continue;
          const y = item.transform[5];
          // 优先使用 PDF 的行结束标记；无标记时按基线变化保留换行。
          if (text && !text.endsWith('\n') && previousY !== undefined && Math.abs(y - previousY) > Math.max(2, item.height * .5)) text += '\n';
          else if (text && !/\s$/.test(text) && item.str && !/^\s/.test(item.str)) text += ' ';
          text += item.str + (item.hasEOL ? '\n' : ''); previousY = y;
        }
        text = text.trim(); hasText ||= !!text;
        const block = `## ${number}\n${text}`;
        bytes += new TextEncoder().encode(block).length;
        if (bytes > MAX_ATTACHMENT_BYTES) throw new Error('ATTACHMENT_SIZE');
        pages.push(block);
      } finally { page.cleanup(); }
    }
    // 无文本层不能当作解析成功；由既有空内容提示拒绝加入附件。
    return hasText ? pages.join('\n\n') : '';
  } finally { clearTimeout(timeout); await task.destroy(); }
}
function officeFailure() { return new Error('INVALID_OFFICE_DOCUMENT'); }
function officePath(base: string, target: string): string {
  if (/^[a-z][a-z0-9+.-]*:/i.test(target) || target.includes('\\')) throw officeFailure();
  const segments: string[] = [];
  for (const part of (target.startsWith('/') ? target.slice(1) : base + target).split('/')) {
    if (!part || part === '.') continue;
    if (part === '..') { if (!segments.length) throw officeFailure(); segments.pop(); }
    else segments.push(part);
  }
  return segments.join('/');
}
function xmlElements(root: Document | Element, name: string): Element[] { return Array.from(root.getElementsByTagNameNS('*', name)); }
function parseOfficeXml(text: string): Document {
  if (/<!DOCTYPE|<!ENTITY/i.test(text)) throw officeFailure();
  const doc = new DOMParser().parseFromString(text, 'application/xml');
  if (xmlElements(doc, 'parsererror').length || !doc.documentElement) throw officeFailure();
  return doc;
}
function officeCrc(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
async function officeArchive(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer), view = new DataView(buffer);
  const entries = new Map<string, { offset: number; packed: number; size: number; method: number; crc: number }>();
  const uint16 = (p: number) => view.getUint16(p, true), uint32 = (p: number) => view.getUint32(p, true);
  let end = -1;
  for (let p = bytes.length - 22; p >= Math.max(0, bytes.length - 65557); p--) {
    if (uint32(p) === 0x06054b50 && p + 22 + uint16(p + 20) === bytes.length) { end = p; break; }
  }
  if (end < 0 || uint16(end + 4) || uint16(end + 6)) throw officeFailure();
  const count = uint16(end + 10), directorySize = uint32(end + 12), directoryOffset = uint32(end + 16);
  if (count !== uint16(end + 8) || count > 4096 || directoryOffset + directorySize > end) throw officeFailure();
  let offset = directoryOffset, total = 0;
  const decoder = new TextDecoder('utf-8', { fatal: true });
  for (let i = 0; i < count; i++) {
    if (offset + 46 > end || uint32(offset) !== 0x02014b50) throw officeFailure();
    const flags = uint16(offset + 8), method = uint16(offset + 10), crc = uint32(offset + 16);
    const packed = uint32(offset + 20), size = uint32(offset + 24), nameLength = uint16(offset + 28);
    const next = offset + 46 + nameLength + uint16(offset + 30) + uint16(offset + 32), local = uint32(offset + 42);
    if (flags & 1 || next > directoryOffset + directorySize || size === 0xffffffff || packed === 0xffffffff || local + 30 > directoryOffset) throw officeFailure();
    const name = officePath('', decoder.decode(bytes.subarray(offset + 46, offset + 46 + nameLength)));
    if (entries.has(name)) throw officeFailure();
    total += size;
    if (total > MAX_OFFICE_EXPANDED_BYTES) throw new Error('ATTACHMENT_SIZE');
    if (uint32(local) !== 0x04034b50 || uint16(local + 8) !== method || uint16(local + 6) & 1) throw officeFailure();
    const dataOffset = local + 30 + uint16(local + 26) + uint16(local + 28);
    if (dataOffset + packed > directoryOffset) throw officeFailure();
    entries.set(name, { offset: dataOffset, packed, size, method, crc });
    offset = next;
  }
  if (offset !== directoryOffset + directorySize) throw officeFailure();
  const cache = new Map<string, Document>();
  return async (path: string, optional = false): Promise<Document | undefined> => {
    if (cache.has(path)) return cache.get(path);
    const entry = entries.get(path);
    if (!entry) { if (optional) return undefined; throw officeFailure(); }
    const packed = bytes.slice(entry.offset, entry.offset + entry.packed);
    let output: Uint8Array;
    if (entry.method === 0) output = packed;
    else if (entry.method === 8 && typeof DecompressionStream !== 'undefined') {
      const reader = new Blob([packed]).stream().pipeThrough(new DecompressionStream('deflate-raw')).getReader();
      const chunks: Uint8Array[] = []; let length = 0;
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          length += value.byteLength;
          if (length > entry.size || length > MAX_OFFICE_EXPANDED_BYTES) { await reader.cancel(); throw new Error('ATTACHMENT_SIZE'); }
          chunks.push(value);
        }
      } finally { reader.releaseLock(); }
      output = new Uint8Array(length); let cursor = 0;
      for (const chunk of chunks) { output.set(chunk, cursor); cursor += chunk.byteLength; }
    } else throw officeFailure();
    if (output.length !== entry.size || officeCrc(output) !== entry.crc) throw officeFailure();
    const doc = parseOfficeXml(decoder.decode(output)); cache.set(path, doc); return doc;
  };
}
function wordText(node: Element): string {
  if (node.localName === 'del' || node.localName === 'instrText') return '';
  if (node.localName === 't') return node.textContent || '';
  if (node.localName === 'tab') return '\t';
  if (node.localName === 'br' || node.localName === 'cr') return '\n';
  return Array.from(node.children).map(wordText).join('');
}
function wordBlocks(root: Element): string[] {
  const result: string[] = [];
  for (const child of Array.from(root.children)) {
    if (child.localName === 'p') result.push(wordText(child));
    else if (child.localName === 'tbl') {
      const rows = Array.from(child.children).filter(el => el.localName === 'tr');
      result.push(rows.map(row => Array.from(row.children).filter(el => el.localName === 'tc').map(cell => wordBlocks(cell).join(' / ')).join('\t')).join('\n'));
    } else if (child.localName !== 'del') result.push(...wordBlocks(child));
  }
  return result;
}
function presentationText(root: Element): string {
  return xmlElements(root, 'p').map(paragraph => Array.from(paragraph.children).map(part => part.localName === 'br' ? '\n' : xmlElements(part, 't').map(text => text.textContent || '').join('')).join('')).join('\n').trim();
}
function presentationBlocks(root: Element): string[] {
  const blocks: string[] = [];
  for (const shape of Array.from(root.children)) {
    if (shape.localName === 'sp') {
      const placeholder = xmlElements(shape, 'ph')[0]?.getAttribute('type');
      // 跳过自动页码、日期、页眉页脚及备注中的幻灯片缩略图占位。
      if (['sldNum', 'dt', 'hdr', 'ftr', 'sldImg'].includes(placeholder || '')) continue;
      const body = Array.from(shape.children).find(child => child.localName === 'txBody');
      if (body) blocks.push(presentationText(body));
    } else if (shape.localName === 'graphicFrame') {
      for (const table of xmlElements(shape, 'tbl')) {
        blocks.push(Array.from(table.children).filter(row => row.localName === 'tr').map(row =>
          Array.from(row.children).filter(cell => cell.localName === 'tc').map(cell => presentationText(cell).replace(/\n/g, ' / ')).join('\t')).join('\n'));
      }
    } else if (shape.localName === 'grpSp') blocks.push(...presentationBlocks(shape));
  }
  return blocks.filter(block => block.trim());
}
async function readPresentation(read: Awaited<ReturnType<typeof officeArchive>>): Promise<string> {
  const presentation = await read('ppt/presentation.xml'), relationships = await read('ppt/_rels/presentation.xml.rels');
  if (!presentation || !relationships) throw officeFailure();
  const slides = xmlElements(presentation, 'sldId'), rels = xmlElements(relationships, 'Relationship');
  if (slides.length > MAX_DOCUMENT_PAGES) throw new Error('DOCUMENT_PAGES');
  const output: string[] = []; let bytes = 0, hasText = false;
  // 按 presentation.xml 中的顺序读取，避免 slide10 / slide2 文件名排序错误。
  for (const [index, slide] of slides.entries()) {
    const id = slide.getAttribute('r:id') || Array.from(slide.attributes).find(attr => attr.localName === 'id')?.value;
    const rel = rels.find(item => item.getAttribute('Id') === id);
    if (!rel || rel.getAttribute('TargetMode') === 'External' || !rel.getAttribute('Type')?.endsWith('/slide')) throw officeFailure();
    const path = officePath('ppt/', rel.getAttribute('Target') || '');
    if (!path.startsWith('ppt/slides/')) throw officeFailure();
    const xml = await read(path), root = xml && xmlElements(xml, 'spTree')[0];
    if (!root) throw officeFailure();
    const blocks = presentationBlocks(root);
    const slash = path.lastIndexOf('/');
    const slideRels = await read(`${path.slice(0, slash + 1)}_rels/${path.slice(slash + 1)}.rels`, true);
    const notesRel = slideRels && xmlElements(slideRels, 'Relationship').find(item => item.getAttribute('Type')?.endsWith('/notesSlide'));
    if (notesRel && notesRel.getAttribute('TargetMode') !== 'External') {
      const notesPath = officePath(path.slice(0, slash + 1), notesRel.getAttribute('Target') || '');
      if (!notesPath.startsWith('ppt/notesSlides/')) throw officeFailure();
      const notesXml = await read(notesPath), notesRoot = notesXml && xmlElements(notesXml, 'spTree')[0];
      // 备注以引用块跟在所属页后面；不增加界面文案或语言包键。
      if (notesRoot) blocks.push(...presentationBlocks(notesRoot).map(text => '> ' + text.replace(/\n/g, '\n> ')));
    }
    hasText ||= blocks.length > 0;
    const block = `## ${index + 1}\n${blocks.join('\n\n')}`;
    bytes += new TextEncoder().encode(block).length;
    if (bytes > MAX_ATTACHMENT_BYTES) throw new Error('ATTACHMENT_SIZE');
    output.push(block);
  }
  return hasText ? output.join('\n\n') : '';
}
function excelColumn(reference: string): number {
  const letters = /^([A-Z]+)[1-9]\d*$/i.exec(reference)?.[1];
  if (!letters) throw officeFailure();
  let column = 0;
  for (const letter of letters.toUpperCase()) column = column * 26 + letter.charCodeAt(0) - 64;
  if (column > 16384) throw officeFailure();
  return column - 1;
}
function excelValue(raw: string, formatId: number, format: string, date1904: boolean): string {
  if (!raw || !Number.isFinite(Number(raw))) return raw;
  const value = Number(raw);
  // 引号/转义内容不是日期模式；内置日期格式和自定义日期格式均识别。
  const pattern = format.replace(/"[^"]*"|\\.|\[(?!h+\]|m+\]|s+\])[^\]]*\]/gi, '').toLowerCase();
  const isDate = (formatId >= 14 && formatId <= 22) || (formatId >= 27 && formatId <= 36) || (formatId >= 45 && formatId <= 47) || (formatId >= 50 && formatId <= 58) || /[ydhs]|m{2,}/.test(pattern);
  if (isDate) {
    const days = Math.floor(value), fraction = value - days;
    const hasTime = /[hs]/.test(pattern) || (formatId >= 18 && formatId <= 22) || (formatId >= 45 && formatId <= 47) || fraction !== 0;
    const timeOnly = /[hs]/.test(pattern) && !/[yd]/.test(pattern) || [18,19,20,21,45,46,47].includes(formatId);
    const seconds = Math.round(fraction * 86400);
    const time = [Math.floor(seconds / 3600), Math.floor(seconds / 60) % 60, seconds % 60].map(n => String(n).padStart(2, '0')).join(':');
    if (timeOnly) return /\[h+\]/.test(pattern) || formatId === 46 ? `${Math.floor(value * 24)}:${time.slice(3)}` : time;
    const date = new Date(Date.UTC(date1904 ? 1904 : 1899, date1904 ? 0 : 11, date1904 ? 1 : 31) + (days - (!date1904 && days > 59 ? 1 : 0)) * 86400000);
    if (!Number.isFinite(date.getTime())) return raw;
    const text = !date1904 && days === 60 ? '1900-02-29' : date.toISOString().slice(0, 10);
    return hasTime ? `${text} ${time}` : text;
  }
  if ([9,10].includes(formatId) || pattern.includes('%')) {
    const decimals = /\.([0#]+)%/.exec(pattern)?.[1].length ?? (formatId === 10 ? 2 : 0);
    return `${(value * 100).toFixed(Math.min(decimals, 10))}%`;
  }
  if (/^0{2,}$/.test(pattern) && Number.isInteger(value) && value >= 0) return raw.padStart(pattern.length, '0');
  return raw;
}
async function readOfficeFile(file: File): Promise<string> {
  const read = await officeArchive(await file.arrayBuffer());
  if (/\.pptx$/i.test(file.name)) return readPresentation(read);
  if (/\.docx$/i.test(file.name)) {
    const doc = await read('word/document.xml');
    const body = doc && xmlElements(doc, 'body')[0];
    if (!body) throw officeFailure();
    return wordBlocks(body).join('\n\n').trim();
  }
  const workbook = await read('xl/workbook.xml'), relationships = await read('xl/_rels/workbook.xml.rels');
  if (!workbook || !relationships) throw officeFailure();
  const sharedXml = await read('xl/sharedStrings.xml', true), styles = await read('xl/styles.xml', true);
  const shared = sharedXml ? xmlElements(sharedXml, 'si').map(item => xmlElements(item, 't').filter(text => text.parentElement?.localName !== 'rPh').map(text => text.textContent || '').join('')) : [];
  const formats = new Map(styles ? xmlElements(styles, 'numFmt').map(el => [Number(el.getAttribute('numFmtId')), el.getAttribute('formatCode') || '']) : []);
  const styleRoot = styles && xmlElements(styles, 'cellXfs')[0];
  const styleIds = styleRoot ? Array.from(styleRoot.children).map(el => Number(el.getAttribute('numFmtId') || 0)) : [];
  const date1904 = ['1', 'true'].includes(xmlElements(workbook, 'workbookPr')[0]?.getAttribute('date1904') || '');
  const rels = xmlElements(relationships, 'Relationship');
  const sheets = xmlElements(workbook, 'sheet'), output: string[] = [];
  if (!sheets.length || sheets.length > 100) throw officeFailure();
  let cellCount = 0, textBytes = 0;
  for (const sheet of sheets) {
    const id = sheet.getAttribute('r:id') || Array.from(sheet.attributes).find(attr => attr.localName === 'id')?.value;
    const rel = rels.find(item => item.getAttribute('Id') === id);
    if (!rel || rel.getAttribute('TargetMode') === 'External') throw officeFailure();
    // Chartsheets have no cells; do not confuse a chart-only workbook with a readable data table.
    if (!rel.getAttribute('Type')?.endsWith('/worksheet')) continue;
    const path = officePath('xl/', rel.getAttribute('Target') || '');
    if (!path.startsWith('xl/worksheets/')) throw officeFailure();
    const xml = await read(path); if (!xml) throw officeFailure();
    const sheetData = xmlElements(xml, 'sheetData')[0]; if (!sheetData) throw officeFailure();
    const rows: string[] = []; let previousRow = 0, maxColumns = 0;
    for (const row of Array.from(sheetData.children).filter(el => el.localName === 'row')) {
      const rowNumber = Number(row.getAttribute('r') || previousRow + 1);
      if (!Number.isInteger(rowNumber) || rowNumber <= previousRow || rowNumber > 1048576) throw officeFailure();
      // Explicit row numbers retain sparse row locations without allocating millions of empty rows.
      const cells: string[] = []; let previousColumn = -1;
      for (const cell of Array.from(row.children).filter(el => el.localName === 'c')) {
        if (++cellCount > 50000) throw new Error('ATTACHMENT_SIZE');
        const address = cell.getAttribute('r'), column = address ? excelColumn(address) : previousColumn + 1;
        if (column <= previousColumn || column > 1023) throw new Error('ATTACHMENT_SIZE');
        if (address && Number(/\d+$/.exec(address)?.[0]) !== rowNumber) throw officeFailure();
        previousColumn = column;
        const type = cell.getAttribute('t'), value = xmlElements(cell, 'v')[0]?.textContent || '';
        let text = value;
        if (type === 's') {
          if (!/^\d+$/.test(value) || Number(value) >= shared.length) throw officeFailure();
          text = shared[Number(value)];
        } else if (type === 'inlineStr') text = xmlElements(cell, 't').map(part => part.textContent || '').join('');
        else if (type === 'b') text = value === '1' ? 'TRUE' : 'FALSE';
        else if (!type || type === 'n') {
          const formatId = styleIds[Number(cell.getAttribute('s') || 0)] || 0;
          text = excelValue(value, formatId, formats.get(formatId) || '', date1904);
        }
        // Formula values are cached by Excel; if not cached, preserve the literal formula and never invent a result.
        if (!text && xmlElements(cell, 'f').length) text = `=${xmlElements(cell, 'f')[0].textContent || ''}`;
        cells[column] = /[\t\r\n"]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
        textBytes += new TextEncoder().encode(text).length;
        if (textBytes > MAX_ATTACHMENT_BYTES) throw new Error('ATTACHMENT_SIZE');
      }
      if (cells.length) {
        maxColumns = Math.max(maxColumns, cells.length);
        const line = `${rowNumber}\t${Array.from({ length: cells.length }, (_, index) => cells[index] || '').join('\t')}`;
        textBytes += line.length - cells.filter(Boolean).join('').length;
        if (textBytes > MAX_ATTACHMENT_BYTES) throw new Error('ATTACHMENT_SIZE');
        rows.push(line);
      }
      previousRow = rowNumber;
    }
    if (rows.length) {
      const columns = Array.from({ length: maxColumns }, (_, index) => {
        let number = index + 1, name = '';
        while (number) { number--; name = String.fromCharCode(65 + number % 26) + name; number = Math.floor(number / 26); }
        return name;
      });
      output.push(`## ${sheet.getAttribute('name') || sheet.getAttribute('sheetId') || ''}\n#\t${columns.join('\t')}\n${rows.join('\n')}`);
    }
  }
  return output.join('\n\n');
}

function validAttachmentName(name: string) { return ATTACHMENT_ACCEPT.split(',').some(ext => name.toLowerCase().endsWith(ext)); }
function readAttachments(value: unknown): TextAttachment[] {
  if (!Array.isArray(value)) return [];
  const result: TextAttachment[] = []; let total = 0;
  for (const file of value) {
    if (result.length >= MAX_ATTACHMENTS) break;
    // 停止接收新 TSV，但已保存的历史附件仍可阅读，避免升级后丢失原内容。
    if (!isRecord(file) || typeof file.name !== 'string' || typeof file.content !== 'string' || !(validAttachmentName(file.name) || /\.tsv$/i.test(file.name))) continue;
    if (!file.content.trim() || file.content.includes('\0') || file.content.length > MAX_ATTACHMENT_BYTES) continue;
    const size = new TextEncoder().encode(file.content).length;
    if (size > MAX_ATTACHMENT_BYTES || total + size > MAX_ATTACHMENT_TOTAL) continue;
    result.push({ id: typeof file.id === 'string' ? file.id : uid(), name: file.name.slice(0, 240), content: file.content, size }); total += size;
  }
  return result;
}
function attachmentRequestContent(question: string, files: TextAttachment[]) {
  if (!files.length) return question;
  // 请求格式保持为原接口的纯文本 content；文件用 JSON 表达边界，显示与本地历史仍保留独立文件卡片。
  return `${question}\n\n<attached_files format="json">\n${JSON.stringify(files.map(({ name, content }) => ({ name, content })), null, 2)}\n</attached_files>`;
}
const storageWarning = ref('');
const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
const textValue = (value: unknown) => typeof value === 'string' ? value : '';
const timeValue = (value: unknown) => typeof value === 'number' && Number.isFinite(value) ? value : Date.now();
function makeConversation(): Conversation {
  return { id: uid(), title: '', conversationId: null, messages: [], createdAt: Date.now(), updatedAt: Date.now(), draft: '', attachments: [], favorite: false };
}
// localStorage 是不可信输入；仅恢复白名单字段，并把刷新前的运行态转成停止态。
function readHistory(): Conversation[] {
  try {
    const data: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    if (!Array.isArray(data)) throw new Error('INVALID_HISTORY');
    return data.filter((c): c is JsonRecord => {
      const valid = isRecord(c) && Array.isArray(c.messages);
      if (!valid) storageWarning.value = 'AIAGENT.HISTORY.LOAD_FAILED';
      return valid;
    }).map(c => ({
      id: textValue(c.id) || uid(), title: textValue(c.title), conversationId: textValue(c.conversationId) || null,
      createdAt: timeValue(c.createdAt), updatedAt: timeValue(c.updatedAt), draft: textValue(c.draft), attachments: readAttachments(c.attachments), favorite: c.favorite === true,
      messages: (c.messages as unknown[]).filter((m): m is JsonRecord => isRecord(m) && ['user', 'assistant'].includes(String(m.role))).map(m => {
        const process: ProcessItem[] = (Array.isArray(m.process) ? m.process : []).filter((p): p is JsonRecord => isRecord(p) && ['text', 'tool', 'subagent', 'chart', 'json'].includes(String(p.kind))).map((p, i) => ({
          id: i + 1, kind: p.kind as ProcessItem['kind'], status: (['completed', 'error', 'stopped'].includes(String(p.status)) ? p.status : 'stopped') as ProcessStatus,
          toolName: textValue(p.toolName), agentName: textValue(p.agentName), input: textValue(p.input), text: textValue(p.text), answer: textValue(p.answer), thinking: textValue(p.thinking), chart: isRecord(p.chart) ? (p.chart as ChartContent) : undefined,
          startTime: timeValue(p.startTime), duration: Math.max(0, typeof p.duration === 'number' && Number.isFinite(p.duration) ? p.duration : timeValue(c.updatedAt) - timeValue(p.startTime)),
          // 图表是答复正文的一部分，重新打开会话时就该直接看到，不该再点一次展开。
          expanded: p.kind === 'chart',
          // 正文归属随会话一起持久化，否则重新打开后答复会被并进过程区。
          isFinal: p.isFinal === true,
          skillLoad: p.skillLoad === true,
        }));
        // 旧版本历史没有 isFinal：按旧规则补上（最后一个工具之后的那串文本就是答复），
        // 否则升级后打开老会话会因为找不到正文而把答复全部并进过程区。
        if (process.length && !process.some(p => p.isFinal)) {
          let start = 0;
          process.forEach((p, i) => { if (p.kind === 'tool' || p.kind === 'subagent') start = i + 1; });
          const tail = process.slice(start).filter(p => p.kind === 'text' && p.text.trim());
          if (tail.length) tail[tail.length - 1].isFinal = true;
        }
        return {
          id: textValue(m.id) || uid(), role: m.role as ChatMessage['role'], content: textValue(m.content), prompt: textValue(m.prompt),
          status: (['completed', 'error', 'stopped'].includes(String(m.status)) ? m.status : 'stopped') as Status,
          createdAt: timeValue(m.createdAt),
          finishedAt: typeof m.finishedAt === 'number' && Number.isFinite(m.finishedAt) ? m.finishedAt : undefined,
          errorKey: Object.values(errorKeys).concat('AIAGENT.ERROR.NETWORK', 'AIAGENT.ERROR.AUTH').includes(String(m.errorKey)) ? String(m.errorKey) : undefined,
          errorDetail: textValue(m.errorDetail), attachments: m.role === 'user' ? readAttachments(m.attachments) : [],
          process,
        };
      }),
    })).sort((a, b) => b.updatedAt - a.updatedAt);
  } catch { storageWarning.value = 'AIAGENT.HISTORY.LOAD_FAILED'; return []; }
}
// 每次打开 iframe 都进入新会话；保留有内容的历史及草稿供用户主动选择。
const conversations = ref<Conversation[]>(readHistory().filter(c => c.messages.length || c.title || c.draft || c.attachments?.length));
const initialConversation = makeConversation();
conversations.value.unshift(initialConversation);
const activeId = ref(initialConversation.id);
const current = computed(() => conversations.value.find(c => c.id === activeId.value)!);
const messages = computed(() => current.value.messages);
// ---- 历史会话状态 ----
// 会话级状态只取「最后一条助手消息」：它代表这次会话最近的结果。
// running 是实时的（有请求在跑），其余来自消息本身的状态。
type ChatState = 'running' | 'completed' | 'failed' | 'stopped' | 'empty';
function chatState(chat: Conversation): ChatState {
  if (chat.messages.some(m => running.has(m.id))) return 'running';
  const last = [...chat.messages].reverse().find(m => m.role === 'assistant');
  if (!last) return 'empty';
  if (last.status === 'error') return 'failed';
  // 用户主动停止也算未完成，单独区分出来，避免和真正失败混在一起。
  if (last.status === 'stopped') return 'stopped';
  if (last.status === 'completed') return 'completed';
  return 'empty';
}
const chatStateKeys: Record<ChatState, string> = {
  running: 'AIAGENT.HISTORY.STATE.RUNNING', completed: 'AIAGENT.HISTORY.STATE.COMPLETED',
  failed: 'AIAGENT.HISTORY.STATE.FAILED', stopped: 'AIAGENT.HISTORY.STATE.STOPPED', empty: '',
};
const history = computed(() => conversations.value.filter(c => c.messages.length || c.title || c.draft || c.attachments?.length).slice().sort((a, b) => b.updatedAt - a.updatedAt));
// 收藏项单独置顶成一块，且不再在下面的历史列表里重复出现。
const historyQuery = ref('');
function matchesHistory(chat: Conversation, query: string) {
  const contains = (value: string | undefined) => !!value?.normalize('NFKC').toLocaleLowerCase().includes(query);
  return contains(chat.title) || chat.attachments?.some(file => contains(file.name)) || chat.messages.some(message =>
    contains(message.content) || message.attachments?.some(file => contains(file.name)) || message.process.some(item =>
      contains(item.text) || contains(item.answer) || contains(item.thinking) || contains(item.chart?.title) || contains(item.chart?.summary)));
}
// 搜索时用命中片段替代日期行，保持两行密度；只输出文本，不注入 HTML。
function historyMatch(chat: Conversation) {
  const query = historyQuery.value.trim().normalize('NFKC').toLocaleLowerCase();
  const values = [chat.title, ...(chat.attachments ?? []).map(file => file.name), ...chat.messages.flatMap(message => [message.content, ...(message.attachments ?? []).map(file => file.name), ...message.process.flatMap(item => [item.text, item.answer, item.thinking, item.chart?.title, item.chart?.summary])])];
  const text = (values.find(value => value?.normalize('NFKC').toLocaleLowerCase().includes(query)) || '').normalize('NFKC').replace(/\s+/g, ' ');
  const index = text.toLocaleLowerCase().indexOf(query), start = Math.max(0, index - 12);
  return `${start ? '…' : ''}${text.slice(start, start + Math.max(64, query.length + 24))}`;
}
const filteredHistory = computed(() => {
  const query = historyQuery.value.trim().normalize('NFKC').toLocaleLowerCase();
  return query ? history.value.filter(chat => matchesHistory(chat, query)) : history.value;
});
const pinned = computed(() => filteredHistory.value.filter(c => c.favorite));
const unpinned = computed(() => filteredHistory.value.filter(c => !c.favorite));
const draft = computed({ get: () => current.value.draft, set: value => { current.value.draft = value; scheduleSave(); } });
// 「本会话是否有回答在生成」——并发后按当前会话判定，不再用全局单值。

// 会话定位和快捷键仅改变本地展示。
const historySearchRef = ref<InputInstance>();
const historySearchPending = ref(false);
const outlineButton = ref<HTMLButtonElement>();
const outlineOpen = ref(false);
const locatedMessageId = ref(''), copiedMessageId = ref('');
let locatedTimer: ReturnType<typeof setTimeout> | undefined, copiedTimer: ReturnType<typeof setTimeout> | undefined;
const questionEntries = computed(() => messages.value.filter(message => message.role === 'user'));
const readingPositions = new Map<string, { top: number; following: boolean }>();
function rememberReadingPosition() {
  const wrap = scrollRef.value?.wrapRef;
  if (wrap) readingPositions.set(activeId.value, { top: wrap.scrollTop, following: following.value });
}
function closeOutline() { outlineOpen.value = false; void nextTick(() => outlineButton.value?.focus()); }
async function jumpToMessage(id: string) {
  following.value = false;
  await nextTick();
  const el = document.getElementById(`chat-message-${id}`), wrap = scrollRef.value?.wrapRef;
  if (!el || !wrap || !processRoot.value?.contains(el)) return;
  scrollRef.value?.setScrollTop(wrap.scrollTop + el.getBoundingClientRect().top - wrap.getBoundingClientRect().top - 18);
  el.focus({ preventScroll: true }); locatedMessageId.value = id;
  clearTimeout(locatedTimer); locatedTimer = setTimeout(() => { locatedMessageId.value = ''; }, 2200);
}
function messageMatches(message: ChatMessage, query: string) {
  const contains = (value?: string) => !!value?.normalize('NFKC').toLocaleLowerCase().includes(query);
  return contains(message.content) || message.attachments?.some(file => contains(file.name)) || message.process.some(item => contains(item.text) || contains(item.answer) || contains(item.thinking) || contains(item.chart?.title) || contains(item.chart?.summary));
}
async function openHistoryResult(chat: Conversation) {
  const query = historyQuery.value.trim().normalize('NFKC').toLocaleLowerCase();
  switchConversation(chat.id);
  const match = query ? chat.messages.find(message => messageMatches(message, query)) : undefined;
  if (match) { if (match.role === 'assistant') traceOverride.set(match.id, true); await jumpToMessage(match.id); }
}
function onHistoryDrawerOpened() {
  if (historySearchPending.value) { historySearchPending.value = false; historySearchRef.value?.focus(); }
}
async function focusHistorySearch() {
  if (mobile.value && !drawerOpen.value) { historySearchPending.value = true; drawerOpen.value = true; return; }
  sidebarOpen.value = true;
  await nextTick(); historySearchRef.value?.focus();
}
// 点击发送会卸载原按钮并把焦点交回 body；只在此时补快捷键，不重复处理组件内事件。
function onPageShortcut(event: KeyboardEvent) {
  if (!processRoot.value?.getClientRects().length) return;
  if (event.target === document.body || event.target === document.documentElement) onWorkspaceKeydown(event);
}
function onWorkspaceKeydown(event: KeyboardEvent) {
  if (event.isComposing || event.keyCode === 229) return;
  // 不抢占弹窗/文件选择器的 Escape，也不让快捷新建使当前弹窗串到另一会话。
  if (attachmentPreview.value) return;
  if ((event.ctrlKey || event.metaKey) && !event.altKey && event.key.toLowerCase() === 'k') { event.preventDefault(); void focusHistorySearch(); }
  else if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === 'o') { event.preventDefault(); newConversation(); }
  else if (event.shiftKey && event.key === 'Escape') { event.preventDefault(); inputRef.value?.focus(); }
  else if (event.key === 'Escape' && outlineOpen.value) { event.preventDefault(); closeOutline(); }
}
async function copyAnswer(message: ChatMessage) {
  if (await copyText(answerText(message))) { copiedMessageId.value = message.id; clearTimeout(copiedTimer); copiedTimer = setTimeout(() => { copiedMessageId.value = ''; }, 1800); }
}

const following = ref(true);
const sidebarOpen = ref(true);
const drawerOpen = ref(false);
const mobile = ref(false);
const reducedMotion = ref(false);
const now = ref(Date.now());
const scrollRef = ref<ScrollbarInstance>();
const inputRef = ref<InputInstance>();
const processRoot = ref<HTMLElement>();
let processEventRoot: HTMLElement | undefined;
let disposed = false;
let scrollScheduled = false;
let saveTimer: ReturnType<typeof setTimeout> | undefined;
let elapsedTimer: ReturnType<typeof setInterval> | undefined;
// 并发对话：每条助手消息独立持有自己的请求句柄，切换/新建会话不再互相打断。
// 上限 MAX_RUNNING，超出时提示用户先停止一个（避免后端被同一用户刷爆）。
const MAX_RUNNING = 3;
const running = reactive(new Map<string, { abort: () => void; message: ChatMessage }>());
// 「本会话是否有回答在生成」——并发后按当前会话判定，不再用全局单值。
const streaming = computed(() => messages.value.some(m => running.has(m.id)));
// 图表实例按 ProcessItem.id 缓存，供下载按钮取 getDataURL；组件卸载时由 ChartView 自身 dispose。
const chartRefs = new Map<string, { getDataURL: (opts?: Record<string, unknown>) => string }>();

const attachmentInput = ref<HTMLInputElement>();
const attachmentPreview = ref<TextAttachment | null>(null);
const attachmentDragDepth = ref(0);
const attachmentReadingIds = reactive(new Set<string>());
const attachmentErrors = reactive(new Map<string, string>());
const draftAttachments = computed(() => current.value.attachments || []);
const attachmentReading = computed(() => attachmentReadingIds.has(activeId.value));
const attachmentError = computed(() => attachmentErrors.get(activeId.value) || '');
// 用户指定“添加附件”与简短格式说明；本地中英副本避免依赖不可修改的外部语言包。
// Word/Excel/PowerPoint 对应 DOCX/XLSX/PPTX，仍不接收旧 DOC/XLS。
const attachmentCopy = computed(() => locale.value.toLowerCase().startsWith('zh') ? {
  add: '添加附件',
  formatsTitle: '支持的文件格式',
  formatsSummary: '支持 .pdf / .docx / .xlsx / .pptx / .csv / .txt / .md / .json',
  formats: '支持 PDF/Word/Excel/PowerPoint/CSV/TXT/Markdown/JSON',
  limits: `每条问题最多添加 ${MAX_ATTACHMENTS} 个文件，每个文件不超过 ${MAX_ATTACHMENT_BYTES / 1024 / 1024} MB。`,
  countError: `每条问题最多添加 ${MAX_ATTACHMENTS} 个文件。`,
} : {
  add: 'Add attachments',
  formatsTitle: 'Supported file formats',
  formatsSummary: 'Supports .pdf / .docx / .xlsx / .pptx / .csv / .txt / .md / .json',
  formats: 'Supports PDF, Word, Excel, PowerPoint, CSV, TXT, Markdown and JSON.',
  limits: `Up to ${MAX_ATTACHMENTS} files per question, ${MAX_ATTACHMENT_BYTES / 1024 / 1024} MB per file.`,
  countError: `Add up to ${MAX_ATTACHMENTS} files per question.`,
});
const attachmentHint = computed(() => attachmentCopy.value.formats);
function removeAttachment(id: string) { current.value.attachments = draftAttachments.value.filter(file => file.id !== id); scheduleSave(); }
async function addAttachments(files: File[]) {
  const chat = current.value;
  if (disposed || attachmentReadingIds.has(chat.id) || !files.length) return;
  attachmentReadingIds.add(chat.id); attachmentErrors.delete(chat.id);
  const errors: string[] = [];
  try {
    for (const file of files) {
      if (disposed || !conversations.value.includes(chat)) break;
      const reject = (message: string) => { errors.push(`${file.name}: ${message}`); };
      if (!validAttachmentName(file.name)) { reject(t('CM.COMMON.UPLOAD_FILE_FORMAT', { format: ATTACHMENT_ACCEPT })); continue; }
      if (!file.size) { reject(t('SYS.VALIDATOR.FILE_EMPTY')); continue; }
      const isOffice = /\.(docx|xlsx|pptx)$/i.test(file.name), isPdf = /\.pdf$/i.test(file.name);
      if (file.size > MAX_ATTACHMENT_BYTES) { reject(t('CM.COMMON.UPLOAD_FILE_SIZE', { size: `${MAX_ATTACHMENT_BYTES / 1024 / 1024} MB` })); continue; }
      try {
        const content = isPdf ? await readPdfFile(file) : isOffice ? await readOfficeFile(file) : new TextDecoder('utf-8', { fatal: true }).decode(await file.arrayBuffer());
        if (disposed || !conversations.value.includes(chat)) break;
        if (!content.trim()) { reject(t(isOffice || isPdf ? 'AIAGENT.CHART.NO_DATA' : 'SYS.VALIDATOR.FILE_EMPTY')); continue; }
        if (content.includes('\0')) { reject(t('CM.COMMON.UPLOAD_FILE_FORMAT', { format: 'UTF-8' })); continue; }
        const existing = chat.attachments || [];
        if (existing.some(item => item.name === file.name && item.content === content)) continue;
        if (existing.length >= MAX_ATTACHMENTS) { reject(attachmentCopy.value.countError); continue; }
        const size = new TextEncoder().encode(content).length;
        if (size > MAX_ATTACHMENT_BYTES || existing.reduce((sum, item) => sum + item.size, 0) + size > MAX_ATTACHMENT_TOTAL) { reject(t('CM.COMMON.UPLOAD_FILE_SIZE', { size: `${size > MAX_ATTACHMENT_BYTES ? MAX_ATTACHMENT_BYTES / 1024 / 1024 : MAX_ATTACHMENT_TOTAL / 1024 / 1024} MB` })); continue; }
        chat.attachments = [...existing, { id: uid(), name: file.name.slice(0, 240), size, content }]; scheduleSave();
      } catch (error) {
        reject(error instanceof Error && error.message === 'ATTACHMENT_SIZE'
          ? t('CM.COMMON.UPLOAD_FILE_SIZE', { size: `${MAX_ATTACHMENT_BYTES / 1024 / 1024} MB` })
          : error instanceof Error && error.message === 'DOCUMENT_PAGES'
            ? t('CM.COMMON.LENGTH', { min: 1, max: MAX_DOCUMENT_PAGES })
            // 读取失败不误报为“必须为 PDF 格式”：密码保护/损坏/资源加载失败均可能发生。
            // 复用语言包已有文案；本轮不新增密码输入或扫描识别入口。
            : isPdf ? `${t('CM.COMMON.UPLOAD')} · ${t('AIAGENT.HISTORY.STATE.FAILED')}`
              : t('CM.COMMON.UPLOAD_FILE_FORMAT', { format: isOffice ? 'DOCX / XLSX / PPTX (Office Open XML)' : 'UTF-8' }));
      }
    }
  } finally {
    attachmentReadingIds.delete(chat.id);
    if (errors.length && conversations.value.includes(chat)) attachmentErrors.set(chat.id, errors.join('\n'));
  }
}
function onAttachmentChoose(event: Event) {
  const input = event.target as HTMLInputElement;
  const files = Array.from(input.files || []); input.value = ''; void addAttachments(files);
}
function isFileDrag(event: DragEvent) { return Array.from(event.dataTransfer?.types || []).includes('Files'); }
function onAttachmentDragEnter(event: DragEvent) { if (isFileDrag(event)) { event.preventDefault(); attachmentDragDepth.value++; } }
function onAttachmentDragOver(event: DragEvent) { if (isFileDrag(event)) { event.preventDefault(); if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy'; } }
function onAttachmentDragLeave(event: DragEvent) { if (isFileDrag(event)) { event.preventDefault(); attachmentDragDepth.value = Math.max(0, attachmentDragDepth.value - 1); } }
function onAttachmentDrop(event: DragEvent) { if (!isFileDrag(event)) return; event.preventDefault(); attachmentDragDepth.value = 0; void addAttachments(Array.from(event.dataTransfer?.files || [])); }
function onAttachmentPaste(event: ClipboardEvent) { const files = Array.from(event.clipboardData?.files || []); if (files.length) { event.preventDefault(); void addAttachments(files); } }
// 编辑先进入输入框，提交前不改动任何已发送消息。每个会话独立保存编辑目标与原草稿。
const questionEdits = reactive(new Map<string, { userId: string; draft: string; attachments: TextAttachment[] }>());
const editingMessageId = computed(() => questionEdits.get(activeId.value)?.userId || '');
function editQuestion(message: ChatMessage) {
  if (streaming.value || attachmentReading.value) return;
  const index = messages.value.indexOf(message);
  const question = message.role === 'user' ? message : messages.value[index - 1];
  if (!question || question.role !== 'user') return;
  const prior = questionEdits.get(activeId.value);
  // Preserve a pending draft, including attachments, so Cancel restores it instead of silently discarding it.
  questionEdits.set(activeId.value, { userId: question.id, draft: prior?.draft ?? draft.value, attachments: prior?.attachments ?? draftAttachments.value.map(file => ({ ...file })) });
  current.value.attachments = (question.attachments || []).map(file => ({ ...file }));
  draft.value = question.content;
  void nextTick(() => inputRef.value?.focus());
}
function cancelQuestionEdit() {
  const edit = questionEdits.get(activeId.value);
  if (!edit || attachmentReading.value) return;
  current.value.draft = edit.draft; current.value.attachments = edit.attachments;
  questionEdits.delete(activeId.value); scheduleSave(); void nextTick(() => inputRef.value?.focus());
}
// 反馈是本地标记，独立键保存，不改变历史结构、不伪装服务端反馈接口。
type AnswerFeedback = 'up' | 'down';
function readFeedback(): Map<string, AnswerFeedback> {
  try {
    const values: unknown = JSON.parse(localStorage.getItem(`${STORAGE_KEY}:feedback`) || '[]');
    if (!Array.isArray(values)) return new Map();
    return new Map(values.filter((item): item is [string, AnswerFeedback] => Array.isArray(item) && item.length === 2 && typeof item[0] === 'string' && ['up', 'down'].includes(item[1])).slice(-1000));
  } catch { return new Map(); }
}
const feedback = reactive(readFeedback());
function setFeedback(message: ChatMessage, value: AnswerFeedback) {
  if (feedback.get(message.id) === value) feedback.delete(message.id); else feedback.set(message.id, value);
  try { localStorage.setItem(`${STORAGE_KEY}:feedback`, JSON.stringify([...feedback].slice(-1000))); }
  catch { ElMessage.warning(t('AIAGENT.HISTORY.SAVE_FAILED')); }
}

function persistHistory() {
  clearTimeout(saveTimer); saveTimer = undefined;
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(conversations.value)); localStorage.setItem(`${STORAGE_KEY}:active`, activeId.value); storageWarning.value = ''; }
  catch { storageWarning.value = 'AIAGENT.HISTORY.SAVE_FAILED'; }
}
function scheduleSave() { if (!saveTimer && !disposed) saveTimer = setTimeout(persistHistory, 600); }
function formatTime(value: number) { return new Intl.DateTimeFormat(locale.value.startsWith('zh') ? 'zh-CN' : 'en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(value); }
// 整条回答的结束时间与总耗时：此前只标了开始时间，用户看不出「跑完是什么时候、跑了多久」。
function finishText(message: ChatMessage) {
  if (!message.finishedAt) return '';
  return t('AIAGENT.MESSAGE.DONE_AT', { time: new Intl.DateTimeFormat(locale.value.startsWith('zh') ? 'zh-CN' : 'en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(message.finishedAt), seconds: ((message.finishedAt - message.createdAt) / 1000).toFixed(1) });
}
function toggleSidebar() { if (mobile.value) drawerOpen.value = !drawerOpen.value; else sidebarOpen.value = !sidebarOpen.value; }
function newConversation() {
  rememberReadingPosition(); outlineOpen.value = false;
  historyQuery.value = '';
  // 不再打断正在跑的回答：并发下其它会话的请求独立存活，切回来还能继续看。
  conversations.value = conversations.value.filter(c => c.messages.length || c.title || c.draft || c.attachments?.length);
  const chat = makeConversation(); conversations.value.unshift(chat); activeId.value = chat.id;
  drawerOpen.value = false; following.value = true; persistHistory();
  void nextTick(() => inputRef.value?.focus());
}
function switchConversation(id: string) {
  if (id !== activeId.value && conversations.value.some(c => c.id === id)) {
    rememberReadingPosition(); outlineOpen.value = false; locatedMessageId.value = '';
    activeId.value = id; const position = readingPositions.get(id); following.value = position?.following ?? true; persistHistory();
    void nextTick(() => { if (activeId.value !== id) return; if (following.value) scheduleScroll(); else scrollRef.value?.setScrollTop(position?.top || 0); });
  }
  drawerOpen.value = false;
}
function toggleFavorite(chat: Conversation) {
  chat.favorite = !chat.favorite;
  persistHistory();
}
async function renameConversation(chat: Conversation) {
  try {
    const { value } = await ElMessageBox.prompt(t('AIAGENT.HISTORY.NAME_LABEL'), t('AIAGENT.HISTORY.RENAME'), {
      inputValue: chat.title, confirmButtonText: t('AIAGENT.BUTTON.CONFIRM'), cancelButtonText: t('AIAGENT.BUTTON.CANCEL'),
      inputValidator: value => !!value?.trim() && Array.from(value.trim()).length <= 80 || t('AIAGENT.HISTORY.NAME_REQUIRED'),
    });
    if (!disposed && conversations.value.includes(chat)) { chat.title = value.trim(); persistHistory(); }
  } catch { /* 用户取消。 */ }
}
async function deleteConversation(chat: Conversation) {
  try {
    await ElMessageBox.confirm(t('AIAGENT.HISTORY.DELETE_CONFIRM', { title: chat.title || t('AIAGENT.HISTORY.UNTITLED') }), t('AIAGENT.HISTORY.TITLE'), {
      confirmButtonText: t('AIAGENT.BUTTON.CONFIRM'), cancelButtonText: t('AIAGENT.BUTTON.CANCEL'), type: 'warning',
    });
    if (disposed) return;
    // 删除会话要把该会话下所有在跑的回答都停掉，否则请求会挂在已删除的消息上。
    chat.messages.forEach(m => { if (running.has(m.id)) finishRequest(m.id, m, 'stopped'); });
    conversations.value = conversations.value.filter(c => c.id !== chat.id);
    if (!conversations.value.length) conversations.value.push(makeConversation());
    if (chat.id === activeId.value) { activeId.value = conversations.value[0].id; following.value = true; scheduleScroll(); }
    persistHistory();
  } catch { /* 用户取消。 */ }
}
function makeMessage(role: ChatMessage['role'], content: string, prompt = ''): ChatMessage {
  return { id: uid(), role, content, prompt, status: role === 'user' ? 'completed' : 'waiting', createdAt: Date.now(), process: [] };
}
function closeProcess(item: ProcessItem, status: ProcessStatus = 'completed') {
  if (item.status !== 'running') return;
  item.status = status;
  // 服务端在 tool 事件的 metadata.duration 里给了真实耗时，要保留；
  // 只有没拿到时才回落到本地计时（此前无条件覆盖，导致显示成 0.0s）。
  if (item.duration == null) item.duration = Math.max(0, Date.now() - item.startTime);
  item.expanded = status === 'error';
}
function addProcess(message: ChatMessage, kind: ProcessKind): ProcessItem {
  // 只收尾已完成的上一步，不折叠任何卡片：早先在这里统一 expanded=false，
  // 导致每来一个新 skill 就把用户正在看的思考收回去。
  message.process.forEach(p => { if (p.kind !== 'subagent') closeProcess(p); });
  const item = reactive<ProcessItem>({ id: message.process.length + 1, kind, status: 'running', toolName: '', agentName: '', input: '', text: '', answer: '', thinking: '', startTime: Date.now(), expanded: true });
  message.process.push(item);
  return message.process[message.process.length - 1];
}
// 文本轮：同一 messageId 的事件持续追加到同一轮，messageId 变化即新开一轮。
function appendTextTurn(message: ChatMessage, textId: string, chunk: string): ProcessItem {
  let item = message.process.find(p => p.kind === 'text' && p.toolName === textId);
  if (!item) {
    // 上一轮文本到此结束，收尾为已完成，避免旧轮一直显示加载态。
    message.process.forEach(p => { if (p.kind === 'text' && p.status === 'running') closeProcess(p); });
    item = addProcess(message, 'text'); item.toolName = textId;
  }
  item.text += chunk;
  return item;
}
// 判定哪一轮文本是给用户看的答复。实测发现两种服务端形态都要兼容：
//   1) finish_stop.messageId 能对上某个文本轮 → 直接用（最可靠，Dashboard 的机制）；
//   2) 对不上（实测 SDA 常见：finish_stop 带的是新 id，前面从未出现过）→ 回落。
// 回落不能简单取「最后一个文本轮」：实测最后一轮往往是 "Query succeeded, but I notice..."
// 这类调试碎碎念。因此再看最后一轮之后有没有图表——纯图表回答时 summary 才是结论。
function markFinalTurn(message: ChatMessage, messageId: string) {
  const texts = message.process.filter(p => p.kind === 'text');
  if (!texts.length) return;
  const matched = messageId ? texts.find(p => p.toolName === messageId) : undefined;
  if (matched) { matched.isFinal = true; return; }
  // 没有任何图表：最后一轮文本就是答复（即便读起来像叙述，也没有别的可展示内容）。
  if (!message.process.some(p => p.kind === 'chart')) { texts[texts.length - 1].isFinal = true; return; }
  // 有图表：文本是过程，答复由图表标题 + summary 承担，这里不再提升任何文本。
  // 这样避免了把 "Query succeeded, but I notice..." 当成结论显示给用户。
}
// 流式期间全部平铺流出（参考 Dashboard：items 一维数组逐条渲染，文字随 token 实时增长）；
// 结束后只有 isFinal 文本 + 图表留在正文，其余过程收进折叠区。
// 注意「流式期间不划分」正是 Dashboard 不会横跳的原因：划分只发生一次，就在结束时。
function bodyTextIds(message: ChatMessage): Set<number> {
  const ids = new Set<number>();
  if (message.status !== 'completed') return ids;
  message.process.forEach(item => { if (item.kind === 'text' && item.isFinal && item.text.trim()) ids.add(item.id); });
  return ids;
}
// 正文 = isFinal 文本 + 所有图表；其余过程按时间顺序进折叠框。
// 注意：流式期间**也要**把过程项留在 timeline 里，否则折叠框根本不存在——
// 那样用户只有等回答结束才看到它，观感就不是「边跑边有个思考框」。
function layout(message: ChatMessage): MessageLayout {
  const textIds = bodyTextIds(message);
  const timeline: ProcessItem[] = [], body: ProcessItem[] = [];
  for (const item of message.process) {
    if (item.kind === 'chart' || (item.kind === 'text' && textIds.has(item.id))) body.push(item);
    else timeline.push(item);
  }
  return { timeline, body };
}
// 折叠框默认收起（ChatGPT 式）：从第一条过程事件出现就存在，标题栏实时滚动当前输出，
// 用户点开才看完整过程；结束后保持收起。手动展开/收起后尊重用户选择。
const traceOverride = reactive(new Map<string, boolean>());
function traceOpen(message: ChatMessage) {
  const manual = traceOverride.get(message.id);
  return manual === undefined ? false : manual;
}
function toggleTrace(message: ChatMessage) {
  traceOverride.set(message.id, !traceOpen(message));
}
// 复制/判空都以“用户在正文里看到的全部内容”为准：文本 part + 图表标题与摘要。
// 纯图表回答没有文本 part，若只取 text，复制会被误禁用且会被误判为“未收到答复”。
function bodyEntries(message: ChatMessage) {
  return layout(message).body.map(p => {
    if (p.kind === 'text') return p.text.trim();
    if (p.kind === 'chart') return [p.chart?.title, p.chart?.summary].filter(Boolean).join('\n').trim();
    return '';
  }).filter(Boolean);
}
// ---- 状态栏：运行中把这一条变成「当前步骤 + 正在输出的文字」 ----
// 阶段只从本地观测推断，不依赖上游任何格式约定。
function liveLabel(message: ChatMessage) {
  const runningTool = message.process.filter(p => (p.kind === 'tool' || p.kind === 'subagent') && p.status === 'running').pop();
  if (runningTool) return t(runningTool.kind === 'subagent' ? 'AIAGENT.STATUS.SUBAGENT' : 'AIAGENT.STATUS.TOOL');
  const text = message.process.filter(p => p.kind === 'text').pop();
  if (text && text.status === 'running') return t('AIAGENT.STATUS.ANSWER');
  if (message.process.some(p => p.kind === 'chart')) return t('AIAGENT.STATUS.RENDERING');
  return message.process.length ? t('AIAGENT.STATUS.THINKING') : t('AIAGENT.STATUS.WAITING');
}
// 展示层：只允许最新过程项拥有光标；图表/工具在末尾时不回跳到旧文字。
function cursorOwner(message: ChatMessage) {
  const item = message.process[message.process.length - 1];
  return isActive(message) && item?.status === 'running' && (item.kind === 'text' || item.kind === 'subagent') ? item.id : undefined;
}
function answerText(message: ChatMessage) {
  // 用户评审修正：中断后仍可复制已收到的文字，不把过程文本冒充已完成的最终答复。
  if (message.status === 'stopped' || message.status === 'error') {
    return message.process.map(item => item.kind === 'text' ? item.text : item.kind === 'subagent' ? item.answer : item.kind === 'chart' ? [item.chart?.title, item.chart?.summary].filter(Boolean).join('\n') : '').filter(Boolean).join('\n\n').trim();
  }
  return bodyEntries(message).join('\n\n').trim();
}
function kindIcon(item: ProcessItem) {
  if (item.kind === 'tool') return SkillIcon;
  if (item.kind === 'subagent') return Connection;
  return ChatLineRound;
}
function stateIcon(item: ProcessItem) {
  if (item.kind === 'text') return item.status === 'running' ? Loading : CircleCheck;
  return item.status === 'running' ? Loading : item.status === 'completed' ? CircleCheck : item.status === 'error' ? CircleClose : VideoPause;
}
function currentSubagent(message: ChatMessage): ProcessItem | undefined { return message.process.find(p => p.id === message.activeSubagent && p.status === 'running'); }
function ensureSubagent(message: ChatMessage): ProcessItem {
  let item = currentSubagent(message);
  if (!item) { item = addProcess(message, 'subagent'); message.activeSubagent = item.id; }
  return item;
}
// 技能名保持英文原文，只有拿不到名字时才回落到本地化占位。
function skillLabel(name: string) { return name || t('AIAGENT.SKILL.GENERIC'); }
function processTitle(item: ProcessItem) {
  if (item.kind === 'chart') return item.chart?.title || t('AIAGENT.CHART.TITLE');
  if (item.kind === 'json') return t('AIAGENT.CHART.JSON_TITLE');
  if (item.kind === 'text') return t('AIAGENT.PROCESS.THINKING_TURN');
  if (item.kind === 'tool') return item.toolName ? skillLabel(item.toolName) : t('AIAGENT.PROCESS.TOOL_CALL', { name: t('AIAGENT.SKILL.GENERIC') });
  return item.agentName === 'to_pcr_agent' ? t('AIAGENT.AGENT.PCR') : item.agentName || t('AIAGENT.PROCESS.SUBAGENT');
}
// metadata 里 callId / timeStart / toolName / status / duration 是链路内部字段：
// 前两个对用户没有意义，其余三个已单独成行，都不在这里重复展示。
const internalMetaKeys = new Set(['toolName', 'status', 'duration', 'callId', 'timeStart', 'input']);
// 技能卡展开后给用户看的是「这次调用做了什么」，而不是给开发看的原始 JSON。
// 只解释已知字段，未知字段仍收在下方「原始数据」里，不猜测含义。
function toolFacts(item: ProcessItem) {
  const facts: { label: string; value: string }[] = [];
  if (item.toolName) facts.push({ label: t('AIAGENT.PROCESS.SKILL'), value: item.toolName });
  facts.push({ label: t('AIAGENT.PROCESS.STATUS'), value: t(processStatusKeys[item.status]) });
  // duration 单位为毫秒（与参考实现 rdd-agent/MessagePop.vue 一致），不要当秒再除 1000。
  if (item.duration != null) facts.push({ label: t('AIAGENT.PROCESS.DURATION_LABEL'), value: t('AIAGENT.PROCESS.DURATION', { ms: Math.round(Math.max(0, item.duration)) }) });
  let meta: Record<string, unknown> | undefined;
  try { const parsed: unknown = JSON.parse(item.input || '{}'); if (isRecord(parsed)) meta = parsed; } catch { /* 非 JSON，只展示原始数据 */ }
  if (meta) {
    for (const [key, value] of Object.entries(meta)) {
      if (internalMetaKeys.has(key)) continue;
      if (value == null || value === '' || typeof value === 'object') continue;
      facts.push({ label: key, value: String(value) });
    }
  }
  return facts;
}
function chartFileName(chart?: ChartContent, ext = 'png') {
  const base = (chart?.title || 'chart').replace(/[\\/:*?"<>|\r\n\t]+/g, '_').replace(/\s+/g, '_').replace(/^_+|_+$/g, '').slice(0, 80) || 'chart';
  return `${base}.${ext}`;
}
function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob), link = document.createElement('a');
  link.href = url; link.download = filename; document.body.appendChild(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
function csvCell(value: unknown) {
  const text = value == null ? '' : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}
// 图表是否“有内容可展示/可导出”：表格看行，图形看是否至少有一个非空数值点。
// 服务端查回空结果集时会给出带 series 的空壳 chart，此时 echarts 仍会画空坐标轴，
// 容易被误读成渲染失败，因此展示与下载都以此为准。
function chartHasData(chart?: ChartContent) {
  if (!chart) return false;
  if (chart.chart_type === 'table') return !!chart.table_data?.rows?.length;
  const series = chart.series;
  if (!series?.length) return false;
  return series.some(s => s.data?.some(d => d.y !== '' && d.y != null));
}
// 空结果的图表没有可导出的内容，隐藏下载按钮避免点了报错。
function canDownloadChart(item: ProcessItem) { return chartHasData(item.chart); }
// item.id 只在单条消息内自增，跨消息会重号；用「消息 id : 步骤 id」做复合键避免串图。
function chartKey(message: ChatMessage, item: ProcessItem) { return `${message.id}:${item.id}`; }
function setChartRef(key: string, el: unknown) {
  const instance = el as { getDataURL?: (opts?: Record<string, unknown>) => string } | null;
  if (instance?.getDataURL) chartRefs.set(key, instance as { getDataURL: (opts?: Record<string, unknown>) => string });
  else chartRefs.delete(key);
}
async function downloadChart(message: ChatMessage, item: ProcessItem) {
  const chart = item.chart;
  if (!chart) return;
  if (chart.chart_type === 'table' && chart.table_data) {
    const rows = [chart.table_data.headers.map(csvCell).join(','), ...chart.table_data.rows.map(row => row.map(csvCell).join(','))];
    // BOM 让 Excel 正确识别 UTF-8 中文。
    saveBlob(new Blob([`﻿${rows.join('\r\n')}`], { type: 'text/csv;charset=utf-8' }), chartFileName(chart, 'csv'));
    return;
  }
  const key = chartKey(message, item);
  // 图表始终渲染，正常情况下直接取实例；取不到时等一帧再取。
  if (!chartRefs.get(key)) await nextTick();
  const url = chartRefs.get(key)?.getDataURL({ type: 'png', pixelRatio: 2, backgroundColor: '#fff' });
  if (!url) { ElMessage.warning(t('AIAGENT.CHART.DOWNLOAD_FAILED')); return; }
  const link = document.createElement('a');
  link.href = url; link.download = chartFileName(chart); document.body.appendChild(link); link.click(); link.remove();
}
function durationText(item: ProcessItem) { return t('AIAGENT.PROCESS.DURATION', { ms: Math.round(Math.max(0, item.duration ?? now.value - item.startTime)) }); }
function prettyJson(value: string) { try { return JSON.stringify(JSON.parse(value), null, 2); } catch { return value || '—'; } }
function toggleProcess(item: ProcessItem) {
  item.expanded = !item.expanded;
  item.manual = true;
  // 手动查看过程时保留阅读位置，避免展开后立即滚离当前卡片。
}
// 在稳定根节点原生委托，不依赖每个 v-for 按钮自己的 Vue click 绑定。
// 按 id 在**全部会话**里找消息：并发后同时可能有多个会话的消息渲染在屏幕上，
// 只在当前会话里找会让其它会话的卡片点了没反应。
function findMessage(id: string | undefined) {
  if (!id) return undefined;
  for (const conversation of conversations.value) {
    const hit = conversation.messages.find(m => m.id === id);
    if (hit) return hit;
  }
  return undefined;
}
function onProcessClick(event: MouseEvent) {
  if (!(event.target instanceof Element) || !processEventRoot) return;
  const trace = event.target.closest<HTMLButtonElement>('button.trace-toggle[data-message-id]');
  if (trace) {
    const message = findMessage(trace.dataset.messageId);
    if (message) { event.stopPropagation(); toggleTrace(message); }
    return;
  }
  const button = event.target.closest<HTMLButtonElement>('button.process-summary[data-message-id][data-process-id]');
  if (!button || button.disabled || !processEventRoot.contains(button)) return;
  const message = findMessage(button.dataset.messageId);
  const item = message?.process.find(value => String(value.id) === button.dataset.processId);
  if (!item) return;
  event.stopPropagation();
  toggleProcess(item);
}
// ---- SDA 图表渲染(echarts)----
// 照搬 Dashboard rdd-agent/MessagePop.vue 的 dealChart/barMerge/lineMerge/pieMerge/scatterMerge,
// 适配 SDA 新字段(chart_type/series/table_data)。base option 内联(对应 Dashboard chart-option.js)。
const seriesColors = ['#1677ff', '#4b9b8f', '#c99b48', '#c76d73', '#6c9dbb', '#7976b5', '#b88968', '#7e929f'];
const dataZoomConfig: Record<string, unknown>[] = [
  { type: 'inside', xAxisIndex: [0], start: 0, end: 100 },
  { type: 'slider', xAxisIndex: [0], start: 0, end: 100, top: '85%', height: 20, show: true, brushSelect: true },
];
const legendConfig: Record<string, unknown> = { width: '80%', height: 100, bottom: 0, type: 'scroll', left: 'center', itemWidth: 18, itemHeight: 12, textStyle: { fontSize: 10 } };
const textSlice = (params: string) => { const textlen = 14; return params.length > textlen ? `${params.slice(0, textlen)}..` : params; };
// 类目名普遍偏长（如 BillingType (currency)）时，截断会丢掉关键信息；
// 改为整段展示并旋转 40°，同时抬高 grid 底部给旋转后的标签留位，避免压住 legend。
// formatter 必须显式给出恒等函数：base option 里已有 textSlice，lodash merge 不会因缺键而清掉它。
function categoryAxis(values: (string | number)[], base?: Record<string, unknown>) {
  const longest = values.reduce<number>((n, v) => Math.max(n, String(v).length), 0);
  return longest > 10
    ? { axisLabel: { rotate: 40, fontSize: 10, interval: 0, hideOverlap: false, formatter: (v: string) => v }, bottom: '22%' }
    : { axisLabel: base ?? { fontSize: 10, formatter: textSlice }, bottom: undefined as string | undefined };
}
const barOption: Record<string, unknown> = {
  xAxis: { type: 'category', axisLabel: { fontSize: 10, formatter: textSlice } },
  yAxis: { type: 'value' }, tooltip: { show: true },
  grid: { top: '5%', bottom: '10%', left: '0', right: '2%', containLabel: true },
  color: ['#587DFF', '#468BCA', '#349396', '#349855', '#629433'], legend: legendConfig,
};
const lineOption: Record<string, unknown> = {
  xAxis: { type: 'category', axisLabel: { padding: [0, 0, 15, 0], fontSize: 10, formatter: textSlice } },
  legend: legendConfig, tooltip: { confine: true, trigger: 'axis' },
  grid: { bottom: '9%', top: '5%', left: '2%', right: '2%', containLabel: true }, yAxis: { type: 'value' },
};
const pieOption: Record<string, unknown> = {
  title: { top: '0%', left: 'center', show: true, width: '80%', textStyle: { fontSize: 17, align: 'center', padding: [0, 10] } },
  tooltip: { confine: true, fontSize: 14, trigger: 'item', formatter: `{a}<br /> {b} : {c} ({d}%) ` },
  legend: legendConfig, series: [{ type: 'pie', top: 'middle' }],
};
const scatterOption: Record<string, unknown> = {
  grid: { left: '5%', bottom: '8%', containLabel: true },
  xAxis: { axisLabel: { fontSize: 10, formatter: textSlice } }, legend: legendConfig, tooltip: { trigger: 'item' },
};
function dealChart(content: ChartContent): Record<string, unknown> | null {
  if (!content || !content.chart_type) return null;
  switch (content.chart_type) {
    case 'multi-bar': case 'bar': return barMerge(content);
    case 'multi-line': case 'line': return lineMerge(content);
    case 'pie': return pieMerge(content, 'pie');
    case 'ring': return pieMerge(content, 'ring');
    case 'scatter': return scatterMerge(content);
    default: return null;
  }
}
function barMerge(config: ChartContent): Record<string, unknown> {
  const series = config.series ?? [];
  const barXData = [...new Set(series.flatMap(s => s.data.map(d => d.x)))].sort();
  const yAxisIndices = [...new Set(series.map(item => item.y_axis_index ?? 0))];
  const isMultiAxis = yAxisIndices.length > 1;
  const yAxisData = isMultiAxis
    ? yAxisIndices.map((index, i) => ({ type: 'value', name: series.find(s => (s.y_axis_index ?? 0) === index)?.name || '', position: i === 0 ? 'left' : 'right', nameGap: 25, nameTextStyle: { verticalAlign: 'top', align: i === 0 ? 'right' : 'left' } }))
    : { type: 'value', name: config.y_label, nameGap: 25, nameTextStyle: { verticalAlign: 'top', align: config.y_label && config.y_label.length > 7 ? 'left' : 'center' } };
  const cat = categoryAxis(barXData);
  const option: Record<string, unknown> = {
    title: { text: config.title, top: '0%', left: 'center', show: true, width: '80%', textStyle: { fontSize: 14, align: 'center', padding: [0, 10] } },
    legend: { bottom: '-3' }, tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    grid: { top: '20%', left: '3%', right: '7%', bottom: cat.bottom ?? '10%', containLabel: true },
    xAxis: { type: 'category', data: barXData, axisLabel: cat.axisLabel, name: config.x_label, nameLocation: 'end', nameTextStyle: { verticalAlign: 'top', align: 'right', padding: [20, 0, 0, 0] } },
    yAxis: yAxisData,
    series: series.map((item, index) => {
      const dataMap = new Map(item.data.map(d => [d.x, d.y]));
      return { name: item.name, type: config.chart_type, barMaxWidth: Math.max(8, 40 / series.length), data: barXData.map(x => [x, dataMap.get(x) ?? null]), yAxisIndex: item.y_axis_index ?? 0, itemStyle: { color: seriesColors[index % seriesColors.length] } };
    }),
  };
  if (series[0] && series[0].data.length > 20) option.dataZoom = dataZoomConfig;
  return merge(cloneDeep(barOption), option);
}
function lineMerge(data: ChartContent): Record<string, unknown> {
  const { title, x_label, y_label } = data;
  const series = data.series ?? [];
  const xData = [...new Set(series.flatMap(item => item.data.map(d => d.x)))].sort();
  const yAxisIndices = [...new Set(series.map(item => item.y_axis_index ?? 0))];
  const isMultiAxis = yAxisIndices.length > 1;
  const seriesData = series.map(item => {
    const dataMap = new Map(item.data.map(d => [d.x, d.y]));
    return { name: item.name, type: 'line', data: xData.map(x => [x, dataMap.get(x) ?? null]), smooth: true, yAxisIndex: item.y_axis_index ?? 0 };
  });
  const yAxisData = isMultiAxis
    ? yAxisIndices.map((index, i) => ({ type: 'value', name: series.find(s => (s.y_axis_index ?? 0) === index)?.name || '', position: i === 0 ? 'left' : 'right', nameGap: 25, nameTextStyle: { verticalAlign: 'top', align: i === 0 ? 'right' : 'left' } }))
    : { type: 'value', name: y_label, nameGap: 25, nameTextStyle: { verticalAlign: 'top', align: y_label && y_label.length > 7 ? 'left' : 'center' } };
  const cat = categoryAxis(xData, { padding: [0, 0, 15, 0], fontSize: 10, formatter: textSlice });
  const option: Record<string, unknown> = {
    title: { text: title, top: '0%', left: 'center', show: true, width: '80%', textStyle: { fontSize: 14, align: 'center', padding: [0, 10] } },
    tooltip: { trigger: 'axis', confine: true }, legend: { bottom: '-3' },
    xAxis: { type: 'category', data: xData, axisLabel: cat.axisLabel, name: x_label, nameLocation: 'end', nameTextStyle: { verticalAlign: 'top', align: 'right', padding: [20, 0, 0, 0] } },
    grid: { top: '20%', left: '3%', right: '8%', bottom: cat.bottom ?? '15%', containLabel: true }, yAxis: yAxisData, series: seriesData,
  };
  if (xData.length > 20) option.dataZoom = dataZoomConfig;
  return merge(cloneDeep(lineOption), option);
}
function pieMerge(data: ChartContent, type: 'pie' | 'ring'): Record<string, unknown> {
  const { title, series, summary } = data;
  const pieSeries = series ?? [];
  const pieData = (pieSeries[0]?.data ?? []).map(item => ({ name: item.x, value: item.y }));
  pieData.sort((a, b) => Number(b.value) - Number(a.value));
  const option: Record<string, unknown> = {
    title: { text: title },
    series: [{ name: pieSeries[0]?.name, type: 'pie', data: pieData, top: '0', radius: type === 'pie' ? '53%' : ['40%', '53%'], label: { fontSize: 13, formatter: (params: { name: string }) => `${params.name}` } }],
  };
  if (type === 'ring') {
    option.graphic = [{ type: 'group', left: 'center', top: 'center', children: [{ type: 'text', style: { text: summary ?? '-', textAlign: 'center', fill: '#333', fontSize: 13, fontWeight: 'bold' }, tooltip: { show: true, trigger: 'item', formatter: summary ?? '-', backgroundColor: 'rgba(50, 50, 50, 0.9)', borderColor: '#333', textStyle: { color: '#fff' } } }] }];
  }
  return merge(cloneDeep(pieOption), option);
}
function scatterMerge(chartData: ChartContent): Record<string, unknown> {
  const series = chartData.series ?? [];
  const legendData = series.map(item => item.name);
  const option: Record<string, unknown> = {
    title: { text: chartData.title, left: 'center' }, legend: { data: legendData },
    xAxis: { type: 'value', name: chartData.x_label, splitLine: { show: true } },
    yAxis: { type: 'value', name: chartData.y_label, splitLine: { show: true } }, series: [] as unknown[],
  };
  const firstSeries = series[0];
  if (firstSeries && firstSeries.data.length > 0) {
    const firstDataPoint = firstSeries.data[0];
    if (typeof firstDataPoint.x === 'string') {
      (option.xAxis as Record<string, unknown>).type = 'category';
      const xCategories = new Set<string | number>(); const uniqueXCategories: (string | number)[] = [];
      series.forEach(s => s.data.forEach(dp => { if (dp.x !== undefined && !xCategories.has(dp.x)) { xCategories.add(dp.x); uniqueXCategories.push(dp.x); } }));
      uniqueXCategories.sort((a, b) => String(a).localeCompare(String(b)));
      (option.xAxis as Record<string, unknown>).data = uniqueXCategories;
    }
    if (typeof firstDataPoint.y === 'string') {
      (option.yAxis as Record<string, unknown>).type = 'category';
      const yCategories = new Set<string | number>(); const uniqueYCategories: (string | number)[] = [];
      series.forEach(s => s.data.forEach(dp => { if (dp.y !== undefined && !yCategories.has(dp.y)) { yCategories.add(dp.y); uniqueYCategories.push(dp.y); } }));
      (option.yAxis as Record<string, unknown>).data = uniqueYCategories;
    }
  }
  const outSeries = option.series as unknown[];
  series.forEach((s, index) => {
    outSeries.push({ name: s.name, type: 'scatter', data: s.data.map(item => [item.x, item.y]), symbolSize: 10, itemStyle: { color: seriesColors[index % seriesColors.length] } });
  });
  if ((option.xAxis as Record<string, unknown>).type === 'category') {
    (option.xAxis as Record<string, unknown>).axisTick = { alignWithLabel: true, length: 5 };
  }
  return merge(cloneDeep(scatterOption), option);
}
// 单个图表用独立组件管理 echarts 实例:onMounted init、onUnmounted dispose、ResizeObserver 自适应。
// 不在 v-for 里用内联函数 ref(每次渲染都会重建闭包,会被 Vue 当作 ref 变化反复 dispose/re-init,图表画不出来)。
const ChartView = defineComponent({
  props: { content: { type: Object as PropType<ChartContent>, required: false } },
  setup(props, { expose }) {
    const root = ref<HTMLElement>();
    let inst: ReturnType<typeof echarts.init> | undefined;
    let observer: ResizeObserver | undefined;
    // 有 series 但每个点都没有数值 = 服务端确实查回了空结果集，改用空状态替代空坐标轴。
    const isEmpty = computed(() => !!props.content?.chart_type && !chartHasData(props.content));
    const render = () => {
      if (!root.value || !props.content || !props.content.chart_type) return;
      // 空结果集不初始化 echarts，否则 canvas 会把空状态文案顶掉。
      if (isEmpty.value) { inst?.dispose(); inst = undefined; return; }
      if (!inst) inst = echarts.init(root.value);
      const option = dealChart(props.content);
      if (option) {
        // 展示层统一图表字体/颜色；减少动态时关闭 ECharts 自带插值动画。
        option.animation = !reducedMotion.value;
        option.color = seriesColors;
        option.textStyle = { fontFamily: 'Huawei Sans, Manrope, Arial, Microsoft YaHei, sans-serif', color: '#58616f' };
        inst.setOption(option, true);
      }
    };
    onMounted(() => {
      render();
      if (typeof ResizeObserver !== 'undefined' && root.value) {
        observer = new ResizeObserver(() => { try { inst?.resize(); } catch { /* 实例已销毁 */ } });
        observer.observe(root.value);
      }
    });
    onUnmounted(() => { observer?.disconnect(); inst?.dispose(); inst = undefined; });
    watch(() => [props.content, reducedMotion.value], render, { flush: 'post' });
    // 供下载按钮取 getDataURL；实例销毁后回落为空，避免抛错。
    expose({ getDataURL: (opts?: Record<string, unknown>) => { try { return inst?.getDataURL(opts as never) ?? ''; } catch { return ''; } } });
    return () => isEmpty.value
      ? h('div', { class: 'chart-container is-empty' }, [h('p', { class: 'chart-empty' }, t('AIAGENT.CHART.NO_DATA'))])
      : h('div', { ref: root, class: 'chart-container' });
  },
});
// 每个 token 只修改既有正文；步骤只由阶段边界创建。没有出参协议，不猜测 output 字段。
function applyAgentEvent(message: ChatMessage, event: StreamEvent): 'done' | 'error' | undefined {
  // 任何事件（含心跳）都算「上游还活着」，状态栏据此判断是否处于静默期。
  message.lastSignalAt = Date.now();
  if (event.outerEvent !== 'ExecuteAgentNormal' || event.innerEvent === 'error') {
    message.errorKey = errorKeys[event.outerEvent] || 'AIAGENT.ERROR.INTERNAL';
    message.errorDetail = event.outerEvent === 'ExecuteAgentNormal' ? event.content : textValue(event.raw.data);
    return 'error';
  }
  const content = event.content ?? '';
  switch (event.innerEvent) {
    case 'answer': case 'delta': {
      // 服务端按内层 messageId 区分文本轮次：同一 id 持续追加，id 变化即新的一轮。
      const textId = textValue(event.raw.inner.messageId) || textValue(event.raw.conversationId) || 'turn';
      const item = appendTextTurn(message, textId, content);
      item.status = 'running';
      message.content += content; // 兼容字段：保留全文，便于历史持久化与复制兜底。
      message.status = 'answer';
      break;
    }
    case 'tool': {
      const name = content.trim() || event.toolName || '';
      if (event.toolName === 'task') {
        let item = currentSubagent(message);
        // 兼容先发占位 task、再给出目标名称；已有子智能体输出时新建下一次派发。
        if (!item || item.agentName || item.answer || item.thinking) {
          if (item) closeProcess(item);
          message.activeSubagent = undefined; item = ensureSubagent(message);
        }
        item.toolName = 'task'; item.input += content;
        if (/^[\w.-]+$/.test(name) && name !== 'task') item.agentName = name;
        message.status = 'subagent';
      } else if (event.toolName === 'skill') {
        // SDA：metadata.toolName 恒为 "skill"，真正的技能名在 content；每个技能发 running/completed 两次。
        // status/duration 都在内层 metadata 里（不在内层顶层）。
        // 实测这两次事件只相隔 16ms、title 是 "Loaded skill: xxx" ——它是「加载技能说明书」，
        // 不是真正执行查询（真正的 executeCypherQuery 从不下发事件）。标成 kind 之外的一个弱提示，
        // 避免把 16ms 的读文件说成「执行工具」误导用户。
        const meta = isRecord(event.raw.inner.metadata) ? event.raw.inner.metadata : {};
        const status = textValue(meta.status);
        let item = message.process.find(p => p.kind === 'tool' && p.toolName === name && p.status === 'running');
        if (status === 'completed') {
          if (item) {
            const duration = meta.duration;
            if (typeof duration === 'number' && Number.isFinite(duration)) item.duration = duration;
            closeProcess(item);
          }
          break;
        }
        if (!item) { item = addProcess(message, 'tool'); item.toolName = name; item.input = JSON.stringify(meta, null, 2); item.skillLoad = true; }
        message.status = 'tool';
      } else {
        const item = addProcess(message, 'tool'); item.toolName = name; item.input = content; message.status = 'tool';
      }
      break;
    }
    case 'subagent_crunching': case 'subagent_answer': {
      const item = ensureSubagent(message);
      if (message.lastEvent !== 'subagent_answer' && message.lastEvent !== 'subagent_crunching') {
        message.process.forEach(p => { if (p.kind !== 'subagent') closeProcess(p); });
        if (!item.manual) item.expanded = true;
      }
      if (event.innerEvent === 'subagent_answer') item.answer += content; else item.thinking += content;
      message.status = 'subagent'; break;
    }
    case 'subagent_done': {
      const item = currentSubagent(message); if (item) closeProcess(item);
      message.activeSubagent = undefined; break;
    }
    case 'done': case 'finish_stop':
      // 参考 Dashboard：finish_stop 帧自带内层 messageId，点名的那一轮文本才是答复正文。
      markFinalTurn(message, textValue(event.raw.inner.messageId) || textValue(event.raw.messageID));
      return 'done';
    // 心跳不产生内容，但它是「上游仍在这条连接上」的唯一证据：
    // 刷新 lastSignalAt 让状态栏继续跳、计时继续走，避免长静默被当成卡死。
    case 'heartbeat': message.lastSignalAt = Date.now(); break;
    case 'json': case 'subagent_json': handleJsonEvent(message, event); break;
  }
  message.lastEvent = event.innerEvent;
}
// SDA 的 json/subagent_json 事件:content 可能带 ```json 代码块包裹,剥掉后 JSON.parse;
// 含 chart_type → 加 chart 卡片(ChartView 用 echarts 渲染);否则加 json 卡片显示 message/status/原文。
function handleJsonEvent(message: ChatMessage, event: StreamEvent) {
  const content = event.content ?? '';
  if (!content) return;
  try {
    const jsonStr = content.replace(/^```json\s*/, '').replace(/\s*```$/, '').trim();
    const parsed: unknown = JSON.parse(jsonStr);
    if (isRecord(parsed) && typeof (parsed as JsonRecord).chart_type === 'string') {
      const item = addProcess(message, 'chart');
      item.chart = parsed as ChartContent;
      closeProcess(item, 'completed');
      item.expanded = true; // 流式期间展开让用户先看到图表；完成后 finishRequest 统一收起。
    } else if (isRecord(parsed)) {
      const record = parsed as JsonRecord;
      const text = typeof record.message === 'string' ? record.message
        : typeof record.status === 'string' ? record.status
        : jsonStr;
      const item = addProcess(message, 'json');
      item.input = text;
      closeProcess(item, 'completed');
    }
  } catch { /* 非 JSON 或解析失败,忽略 */ }
}
function isActive(message: ChatMessage) { return running.has(message.id); }
function finishRequest(messageId: string, message: ChatMessage, status: 'completed' | 'stopped' | 'error') {
  const handle = running.get(messageId);
  if (!handle) return;
  running.delete(messageId);
  message.status = status; message.process.forEach(p => closeProcess(p, status));
  message.finishedAt = Date.now();
  // 完成后收起过程卡，让答复正文成为视觉主体；图表属于正文，保持展开。
  if (status === 'completed') message.process.forEach(p => { if (p.kind !== 'chart') p.expanded = false; });
  if (!running.size) { clearInterval(elapsedTimer); elapsedTimer = undefined; }
  handle.abort(); persistHistory(); scheduleScroll();
}
function sendMessage() {
  const content = draft.value.trim();
  if (!content || disposed || attachmentReading.value) return;
  if (running.size >= MAX_RUNNING) { ElMessage.warning(t('AIAGENT.LIMIT.RUNNING', { max: MAX_RUNNING })); return; }
  const chat = current.value;
  // 同一会话不允许并发：两个请求共用同一个 conversationId，上游返回的会话 id
  // 会被两条流交叉回写，上下文也会混在一起。不同会话之间并发才是我们要的。
  if (chat.messages.some(m => running.has(m.id))) { ElMessage.warning(t('AIAGENT.LIMIT.SESSION_BUSY')); return; }
  const edit = questionEdits.get(chat.id);
  if (edit) {
    const index = chat.messages.findIndex(item => item.id === edit.userId);
    // 最后一问复用原重新生成语义；历史问题重新提问，保留后续轮次，不擅自截断历史。
    if (index >= 0 && index === chat.messages.length - 2 && chat.messages[index + 1]?.role === 'assistant') chat.messages.splice(index, 2);
    questionEdits.delete(chat.id);
  }
  if (!chat.title) chat.title = Array.from(content).slice(0, 20).join('');
  if (!chat.conversationId) chat.conversationId = `conv-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const message = reactive(makeMessage('assistant', '', content));
  const files = (chat.attachments || []).map(file => ({ ...file }));
  const userMessage = makeMessage('user', content); userMessage.attachments = files;
  chat.messages.push(userMessage, message);
  // 编辑提交后也恢复原来的下一问草稿，避免只有取消时保留、发送时却丢失。
  chat.draft = edit?.draft ?? ''; chat.attachments = edit?.attachments ?? []; attachmentErrors.delete(chat.id); chat.updatedAt = Date.now();
  following.value = true; now.value = Date.now();
  if (!elapsedTimer) elapsedTimer = setInterval(() => { now.value = Date.now(); }, 500);
  const abort = chatStream({ conversationId: chat.conversationId, agent: { agentCode: 'SDA' }, message: { content: attachmentRequestContent(content, files) }, stream: true }, event => {
    if (disposed || !running.has(message.id)) return;
    if (event.conversationId) chat.conversationId = event.conversationId;
    chat.updatedAt = Date.now();
    const result = applyAgentEvent(message, event);
    if (result) {
      finishRequest(message.id, message, result === 'done' ? 'completed' : 'error');
      if (result === 'error') ElMessage.error(t(message.errorKey!));
    } else { scheduleSave(); scheduleScroll(); }
  }, error => {
    if (disposed || !running.has(message.id)) return;
    // chatStream 用 Object.assign(new Error(...), { status }) 带上状态码，
    // 它是个 Error 实例，isRecord() 判不出来——必须直接读属性，否则 401/403 会被误报成网络错误。
    const status = (error as { status?: number } | null)?.status;
    message.errorKey = status === 401 || status === 403 ? 'AIAGENT.ERROR.AUTH' : 'AIAGENT.ERROR.NETWORK';
    finishRequest(message.id, message, 'error'); ElMessage.error(t(message.errorKey));
  }, () => { if (!disposed) finishRequest(message.id, message, 'completed'); });
  // 注册必须在 chatStream 可能同步回调之前完成，因此先占位再覆盖 abort。
  running.set(message.id, { abort: () => undefined, message });
  running.get(message.id)!.abort = abort;
  persistHistory(); scheduleScroll();
}
// 只停止指定消息；不传则停止当前会话里正在跑的那条。
// 注意调用方必须传**消息对象**，不能直接把 @click 绑到这个函数上：
// Vue 会把 MouseEvent 当第一个实参传进来，target 变成事件对象，id 为 undefined，
// finishRequest 拿不到句柄后静默返回——表现为「点停止没反应」。
function stopGeneration(message?: ChatMessage) {
  // 当前会话优先；找不到再全局找，避免用户切了会话后停不到原来那条。
  const target = (message instanceof Object && 'process' in message ? message : undefined)
    ?? messages.value.find(m => running.has(m.id))
    ?? [...running.values()].map(h => h.message).find(m => m.role === 'assistant');
  if (target) { finishRequest(target.id, target, 'stopped'); return; }
  // 没有可停的请求时也要有反馈，否则用户无从判断按钮是否生效。
  if (!running.size) ElMessage.info(t('AIAGENT.STATUS.STOPPED'));
}
// 每条助手答复均可再次生成；最后一轮原位替换，旧轮次作为新问题提交以保留后续历史。
function canRegenerate(message: ChatMessage) {
  const index = messages.value.indexOf(message);
  return !running.has(message.id) && !!message.prompt && index > 0 && messages.value[index - 1]?.role === 'user';
}
function regenerate(message: ChatMessage) {
  if (!canRegenerate(message) || streaming.value || disposed || attachmentReading.value) return;
  if (running.size >= MAX_RUNNING) { ElMessage.warning(t('AIAGENT.LIMIT.RUNNING', { max: MAX_RUNNING })); return; }
  // 重试不能覆盖正在编辑的草稿；需要修改时使用问题旁的编辑入口。
  if (draft.value.trim() || draftAttachments.value.length) { ElMessage.warning(t('AIAGENT.INPUT.DRAFT_EXISTS')); return; }
  editQuestion(message); sendMessage();
}
function setDraft(content: string) {
  if (draft.value.trim()) { ElMessage.warning(t('AIAGENT.INPUT.DRAFT_EXISTS')); return; }
  draft.value = content; void nextTick(() => inputRef.value?.focus());
}
function onInputKeydown(raw: Event | KeyboardEvent) {
  const event = raw as KeyboardEvent;
  // Enter 直接发送，Shift+Enter 换行；中文输入法组字期间（isComposing / keyCode 229）不拦截。
  if (event.isComposing || event.keyCode === 229 || event.key !== 'Enter') return;
  if (event.shiftKey || event.altKey || event.ctrlKey || event.metaKey) return;
  event.preventDefault();
  sendMessage();
}
function onScroll() {
  const el = scrollRef.value?.wrapRef;
  if (el) following.value = el.scrollHeight - el.scrollTop - el.clientHeight < 64;
}
function scheduleScroll() {
  if (!following.value || scrollScheduled || disposed) return;
  scrollScheduled = true;
  void nextTick(() => {
    scrollScheduled = false;
    const el = scrollRef.value?.wrapRef;
    if (!disposed && following.value && el) scrollRef.value?.setScrollTop(el.scrollHeight);
  });
}
function jumpToBottom() { following.value = true; scheduleScroll(); }
function escapeHtml(value: string) {
  const entities: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  return value.replace(/[&<>"']/g, char => entities[char]);
}
function safeUrl(value: string) {
  try { const url = new URL(value); return ['https:', 'http:', 'mailto:'].includes(url.protocol) ? escapeHtml(url.href) : ''; }
  catch { return ''; }
}
function inlineMarkdown(value: string) {
  // 在原文上识别 token，所有普通文本/属性分别转义，不二次解析已生成的 HTML。
  const pattern = /`([^`]+)`|\[([^\]\n]+)\]\(([^\s()]+)\)|\*\*([^*]+)\*\*|\*([^*]+)\*/g;
  let result = '', offset = 0;
  for (const match of value.matchAll(pattern)) {
    result += escapeHtml(value.slice(offset, match.index));
    const [, code, label, url, bold, italic] = match;
    const href = url ? safeUrl(url) : '';
    result += code !== undefined ? `<code>${escapeHtml(code)}</code>` : label !== undefined
      ? href ? `<a href="${href}" target="_blank" rel="noopener noreferrer">${escapeHtml(label)}</a>` : escapeHtml(match[0])
      : bold !== undefined ? `<strong>${escapeHtml(bold)}</strong>` : `<em>${escapeHtml(italic)}</em>`;
    offset = match.index! + match[0].length;
  }
  return result + escapeHtml(value.slice(offset));
}
function detailsEnd(value: string): number {
  let depth = 0;
  for (const match of value.matchAll(/<details(?: open)?>|<\/details>/g)) {
    depth += match[0] === '</details>' ? -1 : 1;
    if (depth === 0) return match.index! + match[0].length;
  }
  return -1;
}
function renderMarkdown(source: string, depth = 0, cursor = false): string {
  const lines = source.replace(/\r\n?/g, '\n').split('\n');
  const result: string[] = [];
  const cells = (line: string) => {
    const values: string[] = []; let value = '', code = false;
    const row = line.trim().replace(/^\|/, '').replace(/\|$/, '');
    for (let k = 0; k < row.length; k++) {
      if (row[k] === '\\' && row[k + 1] === '|') { value += '|'; k++; continue; }
      if (row[k] === '`') code = !code;
      if (row[k] === '|' && !code) { values.push(value.trim()); value = ''; } else value += row[k];
    }
    values.push(value.trim()); return values;
  };
  const separator = (line: string) => line.includes('|') && cells(line).every(cell => /^:?-{3,}:?$/.test(cell));
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) { i++; continue; }
    const fence = /^\s*(`{3,}|~{3,})(.*)$/.exec(line);
    if (fence) {
      const code: string[] = []; i++;
      const closing = new RegExp(`^\\s*${fence[1][0]}{${fence[1].length},}\\s*$`);
      while (i < lines.length && !closing.test(lines[i])) code.push(lines[i++]);
      if (i < lines.length) i++;
      const pre = `<pre><code>${escapeHtml(code.join('\n'))}</code></pre>`;
      result.push(`<div class="code-block"><div class="code-toolbar"><span>${escapeHtml(fence[2].trim() || t('AIAGENT.MARKDOWN.CODE'))}</span>`
        + `<button type="button" data-copy-code>${escapeHtml(t('AIAGENT.BUTTON.COPY_CODE'))}</button></div>`
        + (code.length > 14 ? `<details class="code-fold"><summary>${escapeHtml(t('AIAGENT.MARKDOWN.EXPAND_CODE', { lines: code.length }))}</summary>${pre}</details>` : pre) + '</div>');
      continue;
    }
    // 只接受无任意属性的 details/summary 子集，重新生成安全标签；其它原始 HTML 一律转义。
    if (depth < 4 && /^<details(?: open)?>$/.test(line.trim())) {
      const rest = lines.slice(i).join('\n'), end = detailsEnd(rest);
      if (end > 0 && !rest.slice(end).split('\n')[0].trim()) {
        const block = rest.slice(0, end), body = block.replace(/^<details(?: open)?>\s*/, '').replace(/<\/details>$/, '');
        const summary = /^<summary>([\s\S]*?)<\/summary>\s*/.exec(body);
        result.push(`<details class="md-details"><summary>${inlineMarkdown(summary?.[1] || t('AIAGENT.PROCESS.DETAILS'))}</summary>${renderMarkdown(body.slice(summary?.[0].length || 0), depth + 1)}</details>`);
        i += block.split('\n').length; continue;
      }
    }
    if (i + 1 < lines.length && line.includes('|') && separator(lines[i + 1])) {
      const headers = cells(line), rows: string[] = []; i += 2;
      while (i < lines.length && lines[i].trim() && lines[i].includes('|')) {
        const row = cells(lines[i++]); rows.push(`<tr>${headers.map((_, index) => `<td>${inlineMarkdown(row[index] ?? '')}</td>`).join('')}</tr>`);
      }
      result.push(`<div class="table-scroll"><table><thead><tr>${headers.map(cell => `<th>${inlineMarkdown(cell)}</th>`).join('')}</tr></thead><tbody>${rows.join('')}</tbody></table></div>`); continue;
    }
    const heading = /^(#{1,6})\s+(.+)$/.exec(line);
    if (heading) { result.push(`<h${heading[1].length}>${inlineMarkdown(heading[2])}</h${heading[1].length}>`); i++; continue; }
    const list = /^\s*([-+*]|\d+\.)\s+(.+)$/.exec(line);
    if (list) {
      const ordered = /^\d/.test(list[1]), tag = ordered ? 'ol' : 'ul', items: string[] = [];
      while (i < lines.length) {
        const item = /^\s*([-+*]|\d+\.)\s+(.+)$/.exec(lines[i]);
        if (!item || /^\d/.test(item[1]) !== ordered) break;
        items.push(`<li>${inlineMarkdown(item[2])}</li>`); i++;
      }
      result.push(`<${tag}>${items.join('')}</${tag}>`); continue;
    }
    result.push(/^>\s?/.test(line) ? `<blockquote>${inlineMarkdown(line.replace(/^>\s?/, ''))}</blockquote>` : `<p>${inlineMarkdown(line)}</p>`);
    i++;
  }
  // 只在最后一个普通文本块的闭合标签前插入装饰光标；不触碰代码、表格或 details。
  // 使用已转义的 HTML，不解析原始输入，不在链接/行内代码中嵌入光标。
  if (cursor && result.length) {
    const last = result.length - 1;
    result[last] = result[last].replace(/(<\/(?:p|h[1-6]|blockquote|li)>)(<\/(?:ul|ol)>)?$/, '<span class="stream-cursor" aria-hidden="true"></span>$1$2');
  }
  return result.join('');
}
// 逐次取最多 15 个 Unicode 字符，完整 details 作为一个原子块；不切割生成的 HTML。
function typingChunk(pending: string): string {
  let offset = 0, count = 0;
  while (offset < pending.length && count < 15) {
    const rest = pending.slice(offset);
    if (/^<details(?: open)?>/.test(rest)) {
      if (offset) break;
      const end = detailsEnd(rest); return end < 0 ? '' : rest.slice(0, end);
    }
    if (rest.startsWith('<') && ['<details>', '<details open>'].some(prefix => prefix.startsWith(rest))) break;
    const character = String.fromCodePoint(pending.codePointAt(offset)!); offset += character.length; count++;
  }
  return pending.slice(0, offset);
}
const Typewriter = defineComponent({
  props: { content: { type: String, required: true }, active: Boolean, cursor: { type: Boolean, default: true } }, emits: ['progress'],
  setup(props, { emit }) {
    const displayed = ref(''); let observed = '', pending = '';
    let timer: ReturnType<typeof setTimeout> | undefined;
    const clear = () => { clearTimeout(timer); timer = undefined; };
    const pump = () => {
      timer = undefined;
      const chunk = typingChunk(pending);
      displayed.value += chunk; pending = pending.slice(chunk.length); emit('progress');
      if (pending && chunk) timer = setTimeout(pump, 30);
    };
    watch(() => [props.content, props.active, reducedMotion.value] as const, ([content, active, reduced]) => {
      if (!active || reduced) { clear(); pending = ''; displayed.value = content; }
      else {
        if (!content.startsWith(observed)) { clear(); displayed.value = ''; pending = content; }
        else pending += content.slice(observed.length);
        // 收到增量先绘制一小段，剩余内容再定时追赶；避免首帧完全依赖延迟计时器。
        if (pending) { clear(); pump(); }
      }
      observed = content; emit('progress');
    }, { immediate: true });
    onUnmounted(clear);
    const html = computed(() => renderMarkdown(displayed.value, 0, props.active && props.cursor && !reducedMotion.value));
    const root = ref<HTMLElement>(); let openStates: boolean[] = [];
    const captureDetails = () => { openStates = Array.from(root.value?.querySelectorAll('details') || []).map(el => el.open); };
    const restoreDetails = () => { root.value?.querySelectorAll('details').forEach((el, i) => { if (i < openStates.length) el.open = openStates[i]; }); };
    return () => h('div', { class: ['typewriter', { active: props.active }] }, [
      h('div', { ref: root, class: 'markdown-body', innerHTML: html.value, onClick: copyCode, onToggleCapture: scheduleScroll, onVnodeBeforeUpdate: captureDetails, onVnodeUpdated: restoreDetails }),
    ]);
  },
});
async function copyText(content: string) {
  let copied = false;
  try { if (navigator.clipboard?.writeText) { await navigator.clipboard.writeText(content); copied = true; } } catch { /* 尝试兼容内网 HTTP。 */ }
  if (!copied && !disposed) {
    const previous = document.activeElement, textarea = document.createElement('textarea');
    textarea.value = content; textarea.style.cssText = 'position:fixed;left:-9999px;top:0'; document.body.appendChild(textarea);
    try { textarea.select(); copied = document.execCommand('copy'); } catch { copied = false; }
    finally { textarea.remove(); if (previous instanceof HTMLElement) previous.focus({ preventScroll: true }); }
  }
  if (!disposed) { if (copied) ElMessage.success(t('AIAGENT.COPY.SUCCESS')); else ElMessage.warning(t('AIAGENT.COPY.FAILED')); }
  return copied;
}
function copyCode(event: MouseEvent) {
  if (!(event.target instanceof Element)) return;
  const button = event.target.closest('button[data-copy-code]');
  const code = button?.closest('.code-block')?.querySelector('pre code');
  if (code) void copyText(code.textContent ?? '');
}
let narrowQuery: MediaQueryList | undefined, motionQuery: MediaQueryList | undefined;
function syncMedia() { mobile.value = !!narrowQuery?.matches; reducedMotion.value = !!motionQuery?.matches; if (!mobile.value) drawerOpen.value = false; }
// 离开页面/卸载时要停掉**全部**在跑的请求：并发下可能同时有 2~3 条，
// 只停当前会话那一条会让其余 fetch 悬挂到空闲超时。
function stopAll() {
  [...running.values()].forEach(handle => finishRequest(handle.message.id, handle.message, 'stopped'));
}
function onPageHide() { stopAll(); persistHistory(); }
onMounted(() => document.addEventListener('keydown', onPageShortcut));
onUnmounted(() => document.removeEventListener('keydown', onPageShortcut));
onMounted(() => {
  processEventRoot = processRoot.value;
  processEventRoot?.addEventListener('click', onProcessClick, true);
  narrowQuery = window.matchMedia('(max-width: 767px)'); motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  syncMedia(); narrowQuery.addEventListener('change', syncMedia); motionQuery.addEventListener('change', syncMedia);
  window.addEventListener('pagehide', onPageHide); scheduleScroll();
});
onUnmounted(() => { clearTimeout(locatedTimer); clearTimeout(copiedTimer); });
onUnmounted(() => {
  processEventRoot?.removeEventListener('click', onProcessClick, true);
  processEventRoot = undefined;
  stopAll(); persistHistory(); disposed = true; clearTimeout(saveTimer); clearInterval(elapsedTimer);
  narrowQuery?.removeEventListener('change', syncMedia); motionQuery?.removeEventListener('change', syncMedia);
  window.removeEventListener('pagehide', onPageHide);
});
</script>
<style scoped lang="less">
/* 浅色门户：阅读区留白、轻量分隔与一套控件尺度；不依赖外部样式或字体下载。 */
:global(html), :global(body), :global(#app) { height: 100%; width: 100%; min-width: 0; min-height: 0; margin: 0; box-sizing: border-box; }
.agent-page, .history-panel {
  --blue: #1677ff; --ink: #252b34; --muted: #737c89; --line: #e6e9ed;
  --surface: #fff; --surface-soft: #f7f8fa; --hover: #eef1f5; --blue-soft: #eff6ff;
  --running: #2167c5; --completed: #7a8491; --failed: #b94f57; --stopped: #9a722d;
  --radius-container: 12px; --radius-card: 10px; --radius-control: 8px;
  --shadow-float: 0 4px 18px rgba(27,40,59,.09); --content-width: 980px;
  --el-color-primary: #1677ff;
  --el-font-family: 'Huawei Sans', Manrope, Arial, 'San Francisco', Helvetica, Roboto, 'Microsoft YaHei', sans-serif;
  font-family: var(--el-font-family); font-size: 14px; color: var(--ink);
}
.agent-page { height: 100%; width: 100%; max-width: 100%; min-height: 0; min-width: 0; display: flex; flex-direction: column; overflow: hidden; background: var(--surface); border: 0; border-radius: 0; }
.agent-page, .agent-page *, .agent-page *::before, .agent-page *::after { box-sizing: border-box; }
.workspace { display: flex; flex: 1; min-height: 0; min-width: 0; overflow: hidden; }
.history-panel { width: 264px; flex: 0 0 264px; display: flex; flex-direction: column; min-height: 0; background: var(--surface-soft); border-right: 1px solid var(--line); }
.history-content { display: flex; flex-direction: column; height: 100%; min-height: 0; }
.history-brand { display: flex; align-items: center; gap: 12px; padding: 24px 18px 20px; }
.history-brand h1 { flex: 1; min-width: 0; margin: 0; font-size: 16px; font-weight: 650; line-height: 1.5; letter-spacing: -.25px; color: var(--ink); }
.panel-toggle, .panel-handle, .card-action { display: grid; place-items: center; flex-shrink: 0; width: 32px; height: 32px; border: 0; border-radius: var(--radius-control); color: var(--muted); background: transparent; font-size: 16px; cursor: pointer; }
.panel-handle { width: 36px; height: 40px; margin: 16px 0 0 8px; }
.panel-handle .el-icon { transform: rotate(180deg); }
.panel-toggle:hover, .panel-handle:hover, .card-action:hover { color: var(--ink); background: var(--hover); }
.history-new { margin: 0 16px 16px; min-height: 40px; border-radius: var(--radius-control); border-color: #dae2ed; background: var(--surface); color: var(--running); font-weight: 550; }
.history-new:hover { border-color: #aac9f2; background: var(--blue-soft); }
.history-search { margin: 0 16px 8px; }.history-search :deep(.el-input__wrapper) { min-height: 32px; padding: 2px 10px; border-radius: var(--radius-control); background: #fff; box-shadow: 0 0 0 1px var(--line) inset; }.history-search :deep(.el-input__inner) { font-size: 12px; }.history-search :deep(.el-input__wrapper.is-focus) { box-shadow: 0 0 0 1px #8bb3e9 inset; }
.history-scroll { flex: 1; min-height: 0; }
.history-scroll :deep(.el-scrollbar__view) { padding-bottom: 8px; }
.history-heading { display: flex; justify-content: space-between; align-items: center; padding: 12px 20px 7px; font-size: 12px; font-weight: 550; color: var(--muted); }
.history-heading > span:first-child { display: flex; align-items: center; gap: 6px; }
.history-heading .el-icon { color: var(--stopped); font-size: 14px; }
.count { display: inline-flex; justify-content: center; align-items: center; min-width: 20px; height: 20px; padding: 0 6px; border-radius: 6px; color: var(--muted); background: #eceff3; font-size: 11px; font-variant-numeric: tabular-nums; }
.history-item { --history-item-bg: var(--surface-soft); position: relative; margin: 2px 8px; border: 1px solid transparent; border-radius: var(--radius-card); }
.history-item:hover, .history-item:focus-within { --history-item-bg: var(--hover); background: var(--history-item-bg); }
.history-item.selected { --history-item-bg: var(--surface); background: var(--history-item-bg); border-color: #dce3ed; }
.history-select { width: 100%; display: flex; align-items: flex-start; gap: 8px; padding: 9px 11px; border: 0; border-radius: var(--radius-control); background: transparent; text-align: left; color: var(--ink); font: inherit; cursor: pointer; }
.history-select > span { flex: 1; min-width: 0; }
.history-select strong { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 13px; font-weight: 550; line-height: 1.6; }
.history-match { display: block; margin-top: 5px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 11px; line-height: 17px; color: var(--muted); }
.history-meta { display: flex; align-items: center; gap: 7px; margin-top: 3px; line-height: 16px; white-space: nowrap; }
.history-meta time { min-width: 0; overflow: hidden; text-overflow: ellipsis; font-size: 11px; color: var(--muted); }
.history-state { flex-shrink: 0; font-size: 11px; font-style: normal; white-space: nowrap; }
.history-state.running { color: var(--running); }.history-state.completed { color: var(--completed); }
.history-state.failed { color: var(--failed); }.history-state.stopped { color: var(--stopped); }
/* 状态以图形 + 文案区分。完成为细勾、失败为叉、停止为双线；运行圆环保持静态。 */
.state-dot { position: relative; display: inline-block; flex: 0 0 12px; width: 12px; height: 12px; margin-top: 4px; border-radius: 50%; color: var(--completed); }
.state-dot.empty::before { content: ''; position: absolute; inset: 3px; border: 1px solid #acb3bd; border-radius: 50%; }
.state-dot.running { color: var(--running); }
.state-dot.running::before { content: ''; position: absolute; inset: 3px; border-radius: 50%; background: currentColor; }
.state-dot.running::after { content: ''; position: absolute; inset: 0; border: 1px solid currentColor; border-radius: 50%; opacity: .3; }
.history-select .state-dot.running::after { opacity: .3; }
.state-dot.completed::before { content: ''; position: absolute; width: 7px; height: 4px; top: 3px; left: 2px; border: solid currentColor; border-width: 0 0 1.5px 1.5px; transform: rotate(-45deg); }
.state-dot.failed { color: var(--failed); }
.state-dot.failed::before, .state-dot.failed::after { content: ''; position: absolute; width: 10px; height: 1.5px; left: 1px; top: 5px; background: currentColor; transform: rotate(45deg); }
.state-dot.failed::after { transform: rotate(-45deg); }
.state-dot.stopped { color: var(--stopped); }
.state-dot.stopped::before, .state-dot.stopped::after { content: ''; position: absolute; width: 2px; height: 8px; top: 2px; left: 3px; border-radius: 1px; background: currentColor; }
.state-dot.stopped::after { left: 7px; }
/* 展示调整：操作浮在标题行末尾，保留原按钮/事件与 Tab 顺序；触屏始终可见。 */
.history-actions { position: absolute; right: 6px; top: 6px; display: flex; gap: 1px; padding-left: 10px; background: linear-gradient(to right,transparent,var(--history-item-bg) 10px); opacity: 0; pointer-events: none; transition: opacity .15s ease; }
.history-item:hover .history-actions, .history-item:focus-within .history-actions { opacity: 1; pointer-events: auto; }
.history-actions :deep(.el-button) { margin: 0; width: 25px; height: 26px; padding: 4px; border-radius: 6px; color: var(--muted); }
@media (hover: none), (pointer: coarse) {
  .history-actions { opacity: 1; pointer-events: auto; padding-left: 0; top: 5px; }
  .history-actions :deep(.el-button) { width: 28px; height: 28px; }
  .history-select strong { padding-right: 82px; }
}
.history-actions :deep(.el-button.starred) { color: var(--stopped); }
.history-actions :deep(.el-button .el-icon), .message-actions :deep(.el-icon) { font-size: 15px; }
.history-actions :deep(.el-button:hover), .message-actions :deep(.el-button:not(:disabled):hover) { background: var(--hover); color: var(--ink); }
.history-note { margin: 0; padding: 14px 20px; border-top: 1px solid var(--line); color: var(--muted); font-size: 11px; line-height: 1.6; }
.history-note.warning { color: var(--failed); }
.history-scroll :deep(.el-empty__description p) { font-size: 13px; color: var(--muted); }
.agent-page :deep(.agent-history-body) { padding: 0; min-height: 0; }
.agent-page :deep(.agent-history-header) { margin: 0; padding: 16px 18px 8px; color: var(--muted); font-size: 12px; }
.chat-pane { position: relative; display: flex; flex-direction: column; flex: 1; min-width: 0; min-height: 0; overflow: hidden; background: var(--surface); }
.chat-scroll-area { position: relative; display: flex; flex-direction: column; flex: 1; min-height: 0; min-width: 0; overflow: hidden; }
.message-scroll { height: 100%; flex: 1; min-height: 0; min-width: 0; }
.message-scroll :deep(.el-scrollbar__wrap) { overscroll-behavior: contain; }
.message-scroll :deep(.el-scrollbar__view) { min-height: 100%; }
.message-scroll--welcome :deep(.el-scrollbar__view) { height: 100%; min-height: 0; container: agent-welcome / size; }
.welcome { display: flex; align-items: flex-end; width: 100%; min-height: 100%; max-width: var(--content-width); margin: 0 auto; padding: 24px 40px 16px; }
.suggestions { display: flex; flex-wrap: wrap; justify-content: center; gap: 10px; width: 100%; }
.suggestion { padding: 11px 16px; border: 1px solid var(--line); border-radius: var(--radius-card); background: #fff; color: #586374; font: inherit; font-size: 13px; line-height: 1.5; cursor: pointer; text-align: left; }
.suggestion:hover { background: #f7f9fc; border-color: #cdd5e1; color: var(--ink); }
.chat-pane--welcome .composer-region { padding-top: 0; padding-bottom: clamp(40px, 30vh, 300px); }
@container agent-welcome (max-width: 600px) { .welcome { padding: 16px 20px; }.suggestions { gap: 8px; }.suggestion { padding: 9px 12px; font-size: 12px; } }
@container agent-welcome (max-height: 180px) { .welcome { padding-top: 12px; }.suggestion { padding: 7px 10px; } }
.message-list { width: 100%; max-width: var(--content-width); margin: auto; padding: 36px 40px 28px; }
.message-row { display: flex; align-items: flex-start; margin-bottom: 32px; }
.message-row:last-child { margin-bottom: 0; }
.message-row.user { justify-content: flex-end; }
.message-column { min-width: 0; max-width: 100%; }
.assistant .message-column { width: 100%; }
.user .message-column { max-width: 82%; }
.message-meta { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; min-height: 28px; margin-bottom: 8px; font-size: 12px; }
.user .message-meta { justify-content: flex-end; min-height: 18px; margin-bottom: 6px; }
.status-elapsed { flex-shrink: 0; color: #9298a1; font-size: 11px; font-weight: 400; font-variant-numeric: tabular-nums; white-space: nowrap; }
.message-time { color: var(--muted); font-size: 12px; line-height: 20px; font-variant-numeric: tabular-nums; }
.bubble { line-height: 1.85; font-size: 14px; overflow-wrap: anywhere; }
/* 助手正文不套卡片；用户提问用轻量填色，与图表/工具详情的边框层次分开。 */
.assistant .bubble { padding: 0; border: 0; background: transparent; box-shadow: none; }
.user .bubble { padding: 12px 18px; background: #eef3fa; border: 1px solid transparent; border-radius: var(--radius-container); color: #303b4c; }
.user-content, .reasoning-text { margin: 0; white-space: pre-wrap; }
.message-actions { align-items: center; display: flex; flex-wrap: wrap; gap: 2px 4px; margin-top: 14px; padding-top: 2px; }
.message-actions :deep(.el-button) { margin: 0; padding: 6px 9px; height: 30px; border-radius: var(--radius-control); color: var(--muted); font-size: 12px; }
.message-actions :deep(.el-button:disabled) { color: #aeb5bf; }
.process-trace { margin-bottom: 18px; }
.process-trace:last-child { margin-bottom: 0; }
/* 状态入口由内容决定宽度，不再有横跨回答区的背景条；实时文字只出现在展开后的过程。 */
.trace-toggle { display: inline-flex; align-items: center; gap: 9px; width: auto; max-width: 100%; min-height: 36px; padding: 4px 6px 4px 0; border: 0; border-radius: var(--radius-control); background: transparent; color: var(--muted); font: inherit; font-size: 12px; line-height: 24px; text-align: left; cursor: pointer; }
.trace-toggle:hover { color: var(--ink); background: #f7f8fa; }
.process-trace.live .trace-toggle, .waiting { min-height: 36px; gap: 8px; }
.live-step { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: #43536b; font-size: 13px; font-weight: 500; }
/* 缩放层统一收至 24px，保留内部形变轨迹，使标识与状态文字同一行协调。 */
:deep(.activity-mark) { position: relative; display: block; width: 24px; height: 24px; flex: 0 0 24px; }
:deep(.activity-scale) { position: absolute; inset: 0 auto auto 0; width: 36px; height: 36px; transform: scale(.6666667); transform-origin: top left; }
:deep(.activity-form) { position: absolute; left: 2px; top: 2px; width: 32px; height: 32px; isolation: isolate; animation: vds-whole-turn 5.6s cubic-bezier(.5,0,.25,1) infinite; }
:deep(.activity-fold) { position: absolute; left: 8px; top: 8px; width: 16px; height: 16px; border-radius: 5px; background: #2864e8; animation-duration: 5.6s; animation-timing-function: cubic-bezier(.5,0,.25,1); animation-iteration-count: infinite; }
:deep(.activity-fold-a) { animation-name: vds-fold-a; transform: translate(-5px,-5px); }
:deep(.activity-fold-b) { animation-name: vds-fold-b; transform: translate(5px,-5px); }
:deep(.activity-fold-c) { animation-name: vds-fold-c; transform: translate(5px,5px); }
:deep(.activity-fold-d) { animation-name: vds-fold-d; transform: translate(-5px,5px); }
:deep(.activity-core) { position: absolute; inset: 9px; border-radius: 5px; background: #2864e8; }
.trace-toggle .count { min-width: 0; height: auto; padding: 0; color: #9298a1; background: none; }
.trace-toggle .chevron { margin-left: 1px; font-size: 11px; }
.trace-result { font-size: 14px; color: var(--completed); flex-shrink: 0; }
.trace-outcome { font-size: 12px; }
.process-trace.error .trace-result, .process-trace.error .trace-outcome { color: var(--failed); }
.process-trace.stopped .trace-result, .process-trace.stopped .trace-outcome { color: var(--stopped); }
/* 文字光标只标记当前插入点；主要生成动效始终由状态图标承担。 */
.timeline { padding: 0 0 0 18px; margin: 16px 0 2px 8px; list-style: none; border-left: 1px solid var(--line); }
.process-item { position: relative; padding-bottom: 12px; }.process-item:last-child { padding-bottom: 0; }
.timeline-dot { position: absolute; width: 7px; height: 7px; left: -22px; top: 16px; border-radius: 50%; background: #a9b0bb; box-shadow: 0 0 0 3px var(--surface); }
.running .timeline-dot { background: var(--running); }.error .timeline-dot { background: var(--failed); }.stopped .timeline-dot { background: var(--stopped); }
/* 保留既有时间线；只有当前请求中仍在执行的步骤显示柔和外环，不改变点位或布局。 */
.timeline-dot.is-live::after { content: ''; position: absolute; inset: -2px; border: 1px solid var(--running); border-radius: 50%; pointer-events: none; animation: timeline-ring 1.8s ease-out infinite; }
@keyframes timeline-ring { 0% { transform: scale(.7); opacity: .55; } 85%,100% { transform: scale(1.75); opacity: 0; } }
@keyframes timeline-ring-soft { 0%,100% { opacity: .12; } 50% { opacity: .45; } }

.reasoning-line { padding: 4px 0 8px; color: #626e7f; font-size: 13px; line-height: 1.85; }
.skill-load-line { display: flex; align-items: center; gap: 6px; padding: 4px 0 6px; font-size: 12px; color: var(--muted); overflow-wrap: anywhere; }
.skill-load-line .el-icon { font-size: 14px; flex-shrink: 0; }
.process-card { border: 1px solid var(--line); border-radius: var(--radius-card); overflow: hidden; background: var(--surface-soft); }
.running .process-card { border-color: #d9e7fa; background: #f8fbff; }
.error .process-card { border-color: #edd9dc; background: #fffafa; }.stopped .process-card { border-color: #e9e1d3; background: #fdfbf7; }
.process-summary { display: flex; align-items: center; gap: 9px; width: 100%; min-height: 44px; padding: 10px 12px; border: 0; background: transparent; color: #5d6878; font: inherit; text-align: left; cursor: pointer; }
.process-summary:hover { background: rgba(27,40,59,.025); }
.kind-icon { color: #7b8797; font-size: 16px; flex-shrink: 0; }
.process-title { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 13px; }
.duration { flex-shrink: 0; font-size: 11px; color: var(--muted); font-variant-numeric: tabular-nums; }
.process-state { color: var(--completed); font-size: 16px; flex-shrink: 0; }
.running .process-state { color: var(--running); }.error .process-state { color: var(--failed); }.stopped .process-state { color: var(--stopped); }
.chevron { flex-shrink: 0; color: #8b95a3; font-size: 12px; transition: transform .18s ease; }.chevron.expanded { transform: rotate(90deg); }
.process-details { padding: 0 14px 14px 37px; font-size: 13px; color: #626e7f; }
.process-details h4 { margin: 12px 0 7px; font-size: 12px; font-weight: 550; color: var(--muted); }
.process-details pre, .json-text { margin: 8px 0 0; padding: 12px; max-height: 320px; overflow: auto; border-radius: var(--radius-control); background: #edf0f4; white-space: pre-wrap; overflow-wrap: anywhere; font: 12px/1.7 ui-monospace, Consolas, monospace; }
.tool-facts { display: grid; grid-template-columns: auto minmax(0,1fr); gap: 6px 16px; margin: 0; }
.tool-facts dt { color: var(--muted); font-size: 12px; }.tool-facts dd { margin: 0; color: #4a5565; font-size: 12px; overflow-wrap: anywhere; }
.raw-details { margin-top: 12px; }.raw-details summary { font-size: 12px; color: var(--muted); cursor: pointer; }.raw-details summary:hover { color: var(--running); }
.technical-name { margin: 0; color: var(--muted); font-size: 12px; }
.quiet { color: var(--muted); font-size: 13px; line-height: 1.8; margin: 12px 0 0; }
.waiting { display: flex; align-items: center; line-height: 24px; font-size: 12px; color: var(--muted); }.waiting { width: fit-content; max-width: 100%; }
.error-card { display: flex; align-items: flex-start; gap: 10px; margin-top: 14px; padding: 14px 16px; border: 1px solid #ecd8dc; border-radius: var(--radius-card); background: #fff8f9; color: var(--failed); font-size: 13px; }
.error-card > .el-icon { margin-top: 4px; flex-shrink: 0; font-size: 17px; }.error-card strong { font-weight: 550; }.error-card p { margin: 5px 0 0; color: #85676c; white-space: pre-wrap; }
.answer-part + .answer-part { margin-top: 22px; }
.chart-card { border: 1px solid var(--line); border-radius: var(--radius-card); background: var(--surface); overflow: hidden; }
.chart-card .card-head { display: flex; align-items: center; gap: 9px; padding: 14px 16px; border-bottom: 1px solid #eff1f4; }
.chart-card .card-head .kind-icon { display: inline-flex; color: var(--running); }
.chart-card .card-head .process-title { color: var(--ink); font-size: 14px; font-weight: 550; white-space: normal; overflow-wrap: anywhere; }
.chart-card .chart-block-body { padding: 16px; }
.chart-summary { margin: 0 0 16px; font-size: 14px; line-height: 1.8; color: var(--ink); }
.chart-table-scroll { overflow: auto; max-width: 100%; max-height: 420px; border: 1px solid var(--line); border-radius: var(--radius-control); }
.chart-table { width: 100%; border-collapse: collapse; font-size: 13px; background: var(--surface); }
.chart-table th, .chart-table td { padding: 11px 14px; text-align: left; border: 0; border-bottom: 1px solid #edf0f3; white-space: nowrap; }
.chart-table thead th { background: #f5f7f9; color: #566171; font-weight: 600; position: sticky; top: 0; z-index: 1; }
.chart-table tbody tr:hover { background: #fafbfd; }.chart-table tbody tr:last-child td { border-bottom: 0; }
:deep(.chart-container) { width: 100%; height: 320px; margin-top: 8px; }
:deep(.chart-container.is-empty) { display: flex; align-items: center; justify-content: center; height: 160px; border: 1px dashed #dce1e8; border-radius: var(--radius-control); background: var(--surface-soft); }
:deep(.chart-empty) { margin: 0; font-size: 13px; color: var(--muted); }
.chart-meta { margin: 12px 0 0; color: var(--muted); font-size: 12px; }
.back-bottom { position: absolute; bottom: 16px; left: 50%; transform: translateX(-50%); max-width: calc(100% - 24px); height: 36px; border-color: var(--line); box-shadow: var(--shadow-float); color: #586a83; font-size: 12px; background: var(--surface); z-index: 2; }
.composer-region { width: min(var(--content-width),100%); flex-shrink: 0; margin: 0 auto; padding: 12px 40px 20px; }
.composer { padding: 14px 16px 12px; border: 1px solid #dce1e8; border-radius: var(--radius-container); background: var(--surface); box-shadow: 0 3px 14px rgba(27,40,59,.04); }
.composer:focus-within { border-color: #7fafea; box-shadow: 0 0 0 3px rgba(22,119,255,.07); }
.composer :deep(.el-textarea__inner) { padding: 0 2px; box-shadow: none; background: transparent; line-height: 1.8; font-family: inherit; font-size: 14px; color: var(--ink); }
.composer :deep(.el-textarea__inner:focus-visible) { outline: 0; }
.composer :deep(.el-textarea__inner::placeholder) { color: #8c95a2; }
.composer-toolbar { display: flex; align-items: center; justify-content: space-between; gap: 12px; min-height: 34px; margin-top: 12px; }
.composer-toolbar > span { flex: 1; color: var(--muted); font-size: 12px; line-height: 1.5; }
.composer-toolbar :deep(.el-button) { flex-shrink: 0; height: 34px; min-width: 84px; margin: 0; border-radius: var(--radius-control); font-weight: 550; }
.composer-toolbar :deep(.send-button) { width: 36px; min-width: 36px; height: 36px; padding: 0; border-radius: 50%; }
.composer-toolbar :deep(.send-button .el-icon) { font-size: 18px; }
@media (pointer: coarse) { .composer-toolbar :deep(.send-button) { width: 44px; min-width: 44px; height: 44px; } }
.composer-toolbar :deep(.el-button.is-disabled) { color: #929ca9; background: #eff2f6; border-color: #e9edf2; }
.composer-toolbar :deep(.stop-button) { background: #f2f5f9; border-color: #d8e0e9; color: #45566e; }
.composer-toolbar :deep(.stop-button:hover) { color: var(--running); border-color: #adc9ed; background: var(--blue-soft); }
.sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
:deep(.typewriter) { overflow-wrap: anywhere; }
:deep(.stream-cursor) { display: inline-block; width: 2px; height: .95em; margin-left: 3px; border-radius: 2px; vertical-align: -.12em; background: #9298a1; pointer-events: none; opacity: .5; }
:deep(.markdown-body p) { margin: 0 0 12px; }:deep(.markdown-body p:last-child) { margin-bottom: 0; }
:deep(.markdown-body h1), :deep(.markdown-body h2), :deep(.markdown-body h3), :deep(.markdown-body h4), :deep(.markdown-body h5), :deep(.markdown-body h6) { margin: 24px 0 10px; line-height: 1.5; font-size: 1.12em; font-weight: 600; color: var(--ink); }
:deep(.markdown-body > :first-child) { margin-top: 0; }
:deep(.markdown-body ul), :deep(.markdown-body ol) { padding-left: 24px; margin: 12px 0; }
:deep(.markdown-body li) { margin: 4px 0; padding-left: 2px; }
:deep(.markdown-body a) { color: var(--running); text-decoration: underline; text-underline-offset: 3px; }
:deep(.markdown-body blockquote) { margin: 14px 0; padding: 8px 14px; border-left: 3px solid #c5d3e5; color: #69768a; background: #f7f9fc; border-radius: 0 6px 6px 0; }
:deep(.markdown-body code) { padding: 2px 5px; border-radius: 4px; font-size: .9em; font-family: ui-monospace, Consolas, monospace; background: #f0f2f5; color: #465269; }
:deep(.code-block) { margin: 16px 0; border: 1px solid var(--line); border-radius: var(--radius-card); overflow: hidden; background: #f7f8fa; }
:deep(.code-toolbar) { display: flex; align-items: center; justify-content: space-between; padding: 8px 12px; gap: 12px; border-bottom: 1px solid var(--line); color: var(--muted); font-size: 12px; }
:deep(.code-toolbar button) { flex-shrink: 0; padding: 4px 7px; border: 0; border-radius: 6px; color: #5d6b80; background: transparent; font: inherit; cursor: pointer; }
:deep(.code-toolbar button:hover) { background: var(--hover); color: var(--ink); }
:deep(.code-block pre) { margin: 0; padding: 16px; overflow-x: auto; line-height: 1.75; tab-size: 4; }
:deep(.code-block pre code) { padding: 0; white-space: pre; background: transparent; color: #354255; }
:deep(.code-fold summary), :deep(.md-details > summary) { padding: 10px 12px; font-size: 12px; color: #66748a; cursor: pointer; }
:deep(.md-details) { margin: 12px 0; padding-left: 12px; border-left: 2px solid var(--line); }
:deep(.table-scroll) { overflow: auto; max-width: 100%; max-height: 420px; margin: 16px 0; border: 1px solid var(--line); border-radius: var(--radius-control); }
:deep(.markdown-body table) { width: 100%; border-collapse: collapse; font-size: 13px; }
:deep(.markdown-body th), :deep(.markdown-body td) { min-width: 90px; padding: 10px 12px; border-bottom: 1px solid var(--line); text-align: left; }
:deep(.markdown-body th) { position: sticky; top: 0; background: #f5f7f9; color: #586374; font-weight: 600; }
:deep(.markdown-body tr:last-child td) { border-bottom: 0; }
:deep(button:focus-visible), :deep(summary:focus-visible), :deep(a:focus-visible) { outline: 2px solid var(--blue); outline-offset: 2px; }
:deep(.el-scrollbar__thumb) { background: #a4adba; }
:deep(.code-block pre), :deep(.table-scroll), .chart-table-scroll, .process-details pre { scrollbar-width: thin; scrollbar-color: #bfc6d0 transparent; }
@keyframes vds-whole-turn{0%,8%{transform:rotate(-8deg) scale(.88)}25%,34%{transform:rotate(34deg) scale(.92)}51%,58%{transform:rotate(82deg) scale(.78)}76%,84%{transform:rotate(120deg) scale(.91)}100%{transform:rotate(172deg) scale(.88)}}
@keyframes vds-fold-a{0%,8%,100%{transform:translate(-5px,-5px) rotate(0deg)}25%,34%{transform:translate(0,-7px) rotate(45deg) scale(.94)}51%,58%{transform:translate(-1px,-1px) rotate(0deg) scale(1.18)}76%,84%{transform:translate(-6px,-3px) rotate(25deg) scaleX(.82)}}
@keyframes vds-fold-b{0%,8%,100%{transform:translate(5px,-5px) rotate(0deg)}25%,34%{transform:translate(7px,0) rotate(45deg) scale(.94)}51%,58%{transform:translate(1px,-1px) rotate(0deg) scale(1.18)}76%,84%{transform:translate(3px,-6px) rotate(25deg) scaleY(.82)}}
@keyframes vds-fold-c{0%,8%,100%{transform:translate(5px,5px) rotate(0deg)}25%,34%{transform:translate(0,7px) rotate(45deg) scale(.94)}51%,58%{transform:translate(1px,1px) rotate(0deg) scale(1.18)}76%,84%{transform:translate(6px,3px) rotate(25deg) scaleX(.82)}}
@keyframes vds-fold-d{0%,8%,100%{transform:translate(-5px,5px) rotate(0deg)}25%,34%{transform:translate(-7px,0) rotate(45deg) scale(.94)}51%,58%{transform:translate(-1px,1px) rotate(0deg) scale(1.18)}76%,84%{transform:translate(-3px,6px) rotate(25deg) scaleY(.82)}}
@media (max-width: 767px) {
  .agent-page { border-radius: 0; border: 0; }
  .history-brand { padding: 8px 18px 16px; }.panel-toggle { display: none; }
  .panel-handle { width: 28px; height: 36px; margin: 10px 0 0 2px; }
  .message-list { padding: 24px 14px 20px; }.message-row { margin-bottom: 26px; }
  .message-column, .assistant .message-column { max-width: 100%; width: 100%; }.user .message-column { width: auto; max-width: 94%; }
  .user .bubble { padding: 10px 14px; }.message-meta { gap: 6px; }
  .process-summary { gap: 6px; padding: 9px; }.process-title { font-size: 12px; }.process-details { padding: 0 12px 12px; }.duration { font-size: 11px; }
  .trace-toggle { gap: 7px; }.process-trace.live .trace-toggle, .waiting { gap: 8px; }
  .timeline { margin-left: 4px; padding-left: 14px; }.timeline-dot { left: -18px; }
  .chart-card .card-head { padding: 10px 12px; }.chart-card .chart-block-body { padding: 12px; }
  .composer-region { padding: 8px 12px max(12px,env(safe-area-inset-bottom)); }.composer { padding: 12px; }
  .composer-toolbar { gap: 8px; }.composer-toolbar > span { font-size: 11px; }
  .message-actions { gap: 2px; }.message-actions :deep(.el-button) { padding: 6px; }
}
@media (max-height: 520px), (max-width: 767px) { .chat-pane--welcome .composer-region { padding-bottom: max(20px,env(safe-area-inset-bottom)); } }

/* 附件与正文分开呈现：发送前可预览/移除，发送后保留文件卡；所有内容以纯文本插值输出。 */
.attachment-list { display: flex; flex-wrap: wrap; gap: 8px; max-height: 112px; overflow: auto; padding: 0 0 10px; }
.attachment-chip { display: flex; align-items: center; min-width: 0; max-width: 100%; border: 1px solid var(--line); border-radius: var(--radius-control); background: #f7f9fc; }
.attachment-preview { display: inline-flex; align-items: center; gap: 8px; min-width: 0; max-width: 100%; padding: 8px 10px; border: 0; background: transparent; color: #4e6080; font: inherit; font-size: 12px; text-align: left; cursor: pointer; border-radius: var(--radius-control); }
.attachment-preview > span { min-width: 0; max-width: 230px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.attachment-preview .el-icon { flex-shrink: 0; font-size: 16px; }
.attachment-preview:hover { color: var(--blue); background: var(--blue-soft); }
.attachment-remove, .attachment-error button { display: grid; place-items: center; width: 28px; height: 28px; flex-shrink: 0; padding: 0; margin-right: 4px; border: 0; border-radius: 6px; background: transparent; color: var(--muted); cursor: pointer; }
.attachment-remove:hover { background: #e8edf5; color: var(--ink); }
.sent-attachments { display: flex; flex-direction: column; gap: 6px; margin-top: 10px; }.sent-attachments .attachment-preview { border: 1px solid #dce5f1; background: #ffffffa8; }
.attachment-error { display: flex; align-items: flex-start; gap: 8px; margin: 0 0 8px; color: var(--failed); font-size: 12px; line-height: 1.6; white-space: pre-wrap; overflow-wrap: anywhere; }.attachment-error button { margin-left: auto; }
.composer-tools { display: flex; flex-wrap: wrap; align-items: center; min-width: 0; gap: 4px 10px; }.composer-tools > span { color: var(--muted); font-size: 11px; line-height: 1.5; }
.attachment-info { display: grid; place-items: center; width: 28px; height: 28px; padding: 0; flex-shrink: 0; border: 0; border-radius: var(--radius-control); color: #8b95a3; background: transparent; cursor: pointer; }
.attachment-info .el-icon { font-size: 15px; }
.attachment-info:hover, .attachment-info:focus-visible { color: var(--blue); background: var(--blue-soft); }
.attachment-format-hint { max-width: 280px; font-size: 12px; line-height: 1.6; }
@media (pointer: coarse) { .attachment-info { width: 44px; height: 44px; } }
.attachment-limits { max-width: 280px; padding: 3px 1px; font-size: 12px; line-height: 1.6; }
.composer-tools :deep(.el-button) { min-width: 0; padding: 7px 9px; color: #63758e; }.attachment-count { margin-left: 6px; font-size: 11px; color: var(--muted); }
.attachment-content { max-height: 58vh; overflow: auto; margin: 0; padding: 16px; background: var(--surface-soft); border-radius: var(--radius-control); color: var(--ink); font: 12px/1.75 ui-monospace,Consolas,monospace; white-space: pre-wrap; overflow-wrap: anywhere; }
.attachment-drop { position: absolute; z-index: 20; inset: 12px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 14px; padding: 20px; border: 2px dashed #93b5e8; border-radius: var(--radius-container); background: #f3f7fff5; color: #4779bd; text-align: center; pointer-events: none; }.attachment-drop .el-icon { font-size: 32px; }.attachment-drop span { font-size: 12px; }
@media (max-width: 767px) { .composer-tools { gap: 4px; }.composer-tools .next-draft { display: none; }.attachment-preview > span { max-width: 150px; } }


/* 会话级导航与正文操作保持轻量。 */
.chat-pane { position: relative; }
.conversation-bar { flex-shrink: 0; min-height: 56px; display: flex; align-items: center; gap: 16px; padding: 10px 24px; border-bottom: 0; background: #fff; }
.conversation-title { display: flex; align-items: center; gap: 8px; min-width: 0; border: 0; padding: 4px 0; background: transparent; color: var(--ink); text-align: left; font: inherit; cursor: pointer; }
.conversation-title > span { overflow: hidden; white-space: nowrap; text-overflow: ellipsis; font-size: 14px; font-weight: 600; }.conversation-title .el-icon { flex-shrink: 0; color: #a2aab6; font-size: 13px; }
.conversation-controls { margin-left: auto; display: flex; align-items: center; gap: 4px; flex-shrink: 0; }
.utility-button { display: inline-flex; align-items: center; justify-content: center; gap: 5px; min-width: 30px; height: 30px; padding: 5px; border: 0; border-radius: var(--radius-control); background: transparent; color: var(--muted); font: inherit; font-size: 12px; cursor: pointer; }
.utility-button .el-icon { font-size: 16px; }.utility-button:hover { color: var(--running); background: var(--hover); }.utility-button.starred { color: #af8535; }
.conversation-outline { position: absolute; z-index: 8; top: 56px; right: 20px; width: min(360px, calc(100% - 32px)); max-height: min(420px, 60%); overflow: auto; padding: 8px; border: 1px solid var(--line); border-radius: var(--radius-container); background: #fff; box-shadow: 0 12px 40px #2636521a; }
.outline-heading { display: flex; align-items: center; justify-content: space-between; padding: 2px 8px 8px; color: var(--muted); font-size: 12px; }
.outline-entry { width: 100%; display: flex; align-items: center; gap: 10px; padding: 12px 8px; border: 0; border-radius: var(--radius-control); background: transparent; font: inherit; text-align: left; cursor: pointer; }.outline-entry:hover { background: var(--hover); }.outline-entry > span { color: #9aa5b5; font-size: 11px; font-variant-numeric: tabular-nums; }.outline-entry strong { flex: 1; min-width: 0; font-size: 13px; line-height: 1.5; font-weight: 500; color: var(--ink); overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }.outline-entry .el-icon { font-size: 12px; color: #a0aabb; }
.message-row { scroll-margin-top: 18px; border-radius: var(--radius-control); }.message-row.located { outline: 2px solid #b9d1f2; outline-offset: 8px; }.message-row:focus { outline-offset: 8px; }
.bottom-generating { color: var(--running); }
@media (max-width: 767px) { .conversation-bar { gap: 8px; padding: 8px 12px; min-height: 52px; }.conversation-title > span { font-size: 13px; }.conversation-controls { gap: 2px; }.conversation-outline { top: 52px; right: 12px; }.composer-tools { gap: 2px; }.composer-tools .next-draft { display: none; } }

.question-actions { display: flex; justify-content: flex-end; margin-top: 3px; }
.question-actions .utility-button { color: #8c95a2; }
.utility-button:disabled { opacity: .4; cursor: not-allowed; }
.feedback-button.selected { color: var(--running); background: var(--blue-soft); }
:deep(.feedback-down) { transform: rotate(180deg); }
.composer-editing { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding-bottom: 8px; margin-bottom: 8px; border-bottom: 1px solid var(--line); color: var(--muted); font-size: 12px; }
.composer-editing > span { display: inline-flex; align-items: center; gap: 7px; }
@media (pointer: coarse) { .question-actions .utility-button, .message-actions .utility-button { min-width: 44px; height: 44px; }.panel-handle { width: 44px; height: 44px; } }

/* 减少动态仍隐藏文字光标、禁用其他动画；按用户明确选择保留生成状态标识。 */
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after, :deep(*), :deep(*::before), :deep(*::after) { animation: none !important; transition: none !important; scroll-behavior: auto !important; }
  :deep(.stream-cursor) { display: none !important; }
  /* 减少动态时仅保留低幅明暗，避免扩散缩放。 */
  .timeline-dot.is-live::after { transform: none; animation: timeline-ring-soft 1.8s ease-in-out infinite !important; }
  :deep(.activity-mark .activity-form) { display: block; animation: vds-whole-turn 5.6s cubic-bezier(.5,0,.25,1) infinite !important; }
  :deep(.activity-mark .activity-fold-a) { animation: vds-fold-a 5.6s cubic-bezier(.5,0,.25,1) infinite !important; }
  :deep(.activity-mark .activity-fold-b) { animation: vds-fold-b 5.6s cubic-bezier(.5,0,.25,1) infinite !important; }
  :deep(.activity-mark .activity-fold-c) { animation: vds-fold-c 5.6s cubic-bezier(.5,0,.25,1) infinite !important; }
  :deep(.activity-mark .activity-fold-d) { animation: vds-fold-d 5.6s cubic-bezier(.5,0,.25,1) infinite !important; }
}
</style>
