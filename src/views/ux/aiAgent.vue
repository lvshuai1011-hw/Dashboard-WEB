<template>
  <section ref="processRoot" class="agent-page" :aria-label="t('AIAGENT.BRAND')" @keydown="onWorkspaceKeydown">
    <div class="workspace">
      <!-- 侧栏：品牌、新建、搜索、按时间分组的历史会话 -->
      <aside v-if="sidebarOpen" class="sidebar">
        <div class="brand">
          <BrandMark />
          <h1 :title="t('AIAGENT.BRAND')">{{ t('AIAGENT.BRAND') }}</h1>
          <el-tooltip :content="uiCopy.collapse" placement="bottom"><button class="icon-button" type="button" :aria-label="uiCopy.collapse" :aria-expanded="true" @click="toggleSidebar"><el-icon><PanelIcon /></el-icon></button></el-tooltip>
        </div>
        <button class="new-chat" type="button" @click="newConversation"><el-icon><NewChatIcon /></el-icon><span>{{ t('AIAGENT.HISTORY.NEW') }}</span></button>
        <div class="history-search">
          <el-input ref="historySearchRef" v-model="historyQuery" clearable :prefix-icon="Search" :placeholder="uiCopy.searchHistory" :aria-label="`${t('AIAGENT.HISTORY.TITLE')} · ${t('CM.COMMON.SEARCH')}`" @keydown.esc.stop="historyQuery = ''">
            <template v-if="!historyQuery" #suffix><kbd>Ctrl K</kbd></template>
          </el-input>
        </div>
        <el-scrollbar class="history-scroll">
          <p v-if="!filteredHistory.length" class="history-empty">{{ t(historyQuery.trim() ? 'CM.UX.HOME.SEARCH.RESULT.EMPTY' : 'AIAGENT.HISTORY.EMPTY') }}</p>
          <section v-for="group in historyGroups" :key="group.key" class="history-group">
            <h2>{{ group.label }}</h2>
            <div v-for="chat in group.items" :key="chat.id" class="history-item" :class="{ selected: chat.id === activeId, renaming: renaming.id === chat.id && renaming.where === 'side' }">
              <input v-if="renaming.id === chat.id && renaming.where === 'side'" v-model="renaming.value" class="rename-input" maxlength="80" :aria-label="t('AIAGENT.HISTORY.NAME_LABEL')" @keydown.enter.prevent="commitRename" @keydown.esc.stop.prevent="cancelRename" @blur="commitRename" />
              <button v-else class="history-select" type="button" :aria-current="chat.id === activeId ? 'page' : undefined" :title="chat.title || t('AIAGENT.HISTORY.UNTITLED')" @click="openHistoryResult(chat)" @dblclick="renameConversation(chat, 'side')">
                <span class="history-title">{{ chat.title || t('AIAGENT.HISTORY.UNTITLED') }}</span>
                <span v-if="historyQuery.trim()" class="history-match">{{ historyMatch(chat) }}</span>
                <i v-if="['running', 'failed', 'stopped'].includes(chatState(chat))" class="history-dot" :class="chatState(chat)" :title="t(chatStateKeys[chatState(chat)])" aria-hidden="true" />
              </button>
              <el-dropdown v-if="!(renaming.id === chat.id && renaming.where === 'side')" trigger="click" placement="bottom-end" popper-class="agent-menu" @command="(command: string) => onChatCommand(chat, command, 'side')">
                <button class="history-more" type="button" :aria-label="uiCopy.more"><el-icon><MoreIcon /></el-icon></button>
                <template #dropdown>
                  <el-dropdown-menu>
                    <el-dropdown-item command="favorite" :icon="chat.favorite ? StarFilled : Star">{{ t(chat.favorite ? 'AIAGENT.HISTORY.UNFAVORITE' : 'AIAGENT.HISTORY.FAVORITE') }}</el-dropdown-item>
                    <el-dropdown-item command="rename" :icon="EditPen">{{ t('AIAGENT.HISTORY.RENAME') }}</el-dropdown-item>
                    <el-dropdown-item command="delete" :icon="Delete" divided class="danger">{{ t('AIAGENT.HISTORY.DELETE') }}</el-dropdown-item>
                  </el-dropdown-menu>
                </template>
              </el-dropdown>
            </div>
          </section>
        </el-scrollbar>
        <p v-if="storageWarning" class="history-note" role="alert">{{ t(storageWarning) }}</p>
      </aside>

      <main class="chat-pane" :class="{ 'is-welcome': !messages.length, 'sidebar-hidden': !sidebarOpen }" @dragenter="onAttachmentDragEnter" @dragover="onAttachmentDragOver" @dragleave="onAttachmentDragLeave" @drop="onAttachmentDrop">
        <div v-if="attachmentDragDepth" class="attachment-drop" aria-hidden="true"><el-icon><Paperclip /></el-icon><strong>{{ attachmentCopy.add }}</strong><span>{{ attachmentHint }}</span></div>
        <el-tooltip v-if="!sidebarOpen" :content="uiCopy.expand" placement="right">
          <button class="icon-button sidebar-open" type="button" :aria-label="uiCopy.expand" :aria-expanded="false" @click="toggleSidebar"><el-icon><PanelIcon /></el-icon></button>
        </el-tooltip>

        <!-- 顶栏：会话标题即菜单（收藏 / 重命名 / 删除） -->
        <header v-if="messages.length" class="chat-header">
          <input v-if="renaming.id === current.id && renaming.where === 'header'" v-model="renaming.value" class="rename-input header" maxlength="80" :aria-label="t('AIAGENT.HISTORY.NAME_LABEL')" @keydown.enter.prevent="commitRename" @keydown.esc.stop.prevent="cancelRename" @blur="commitRename" />
          <el-dropdown v-else trigger="click" placement="bottom-start" popper-class="agent-menu" @command="(command: string) => onChatCommand(current, command, 'header')">
            <button class="chat-title" type="button">
              <el-icon v-if="current.favorite" class="title-star"><StarFilled /></el-icon>
              <span>{{ current.title || t('AIAGENT.HISTORY.UNTITLED') }}</span>
              <el-icon class="title-chevron"><ChevronIcon /></el-icon>
            </button>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item command="favorite" :icon="current.favorite ? StarFilled : Star">{{ t(current.favorite ? 'AIAGENT.HISTORY.UNFAVORITE' : 'AIAGENT.HISTORY.FAVORITE') }}</el-dropdown-item>
                <el-dropdown-item command="rename" :icon="EditPen">{{ t('AIAGENT.HISTORY.RENAME') }}</el-dropdown-item>
                <el-dropdown-item command="delete" :icon="Delete" divided class="danger">{{ t('AIAGENT.HISTORY.DELETE') }}</el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </header>

        <!-- 起始页 -->
        <div v-if="!messages.length" class="welcome">
          <BrandMark class="welcome-mark" />
          <h2 class="welcome-title">{{ t('AIAGENT.WELCOME.TITLE') }}</h2>
          <p class="welcome-tip">{{ t('AIAGENT.WELCOME.TIP') }}</p>
        </div>

        <div v-else class="chat-scroll-area">
          <el-scrollbar ref="scrollRef" class="message-scroll" @scroll="onMessageScroll">
            <div class="message-list" role="log" aria-live="off" :aria-label="t('AIAGENT.A11Y.MESSAGES')">
              <article v-for="message in messages" :id="`chat-message-${message.id}`" :key="message.id" class="message" :class="[message.role, { located: locatedMessageId === message.id }]" tabindex="-1">
                <!-- 用户提问 -->
                <template v-if="message.role === 'user'">
                  <div class="question" :title="formatTime(message.createdAt)">
                    <p class="question-text">{{ message.content }}</p>
                    <div v-if="message.attachments?.length" class="sent-attachments">
                      <button v-for="file in message.attachments" :key="file.id" type="button" class="file-chip" :title="file.name" @click="attachmentPreview = file"><el-icon><Document /></el-icon><span>{{ file.name }}</span></button>
                    </div>
                  </div>
                  <div class="question-actions">
                    <el-tooltip :content="copiedMessageId === message.id ? t('AIAGENT.COPY.SUCCESS') : uiCopy.copy"><button type="button" class="icon-button small" :aria-label="uiCopy.copy" @click="copyQuestion(message)"><el-icon><component :is="copiedMessageId === message.id ? Check : CopyDocument" /></el-icon></button></el-tooltip>
                    <el-tooltip :content="t('AIAGENT.BUTTON.EDIT_QUESTION')"><button type="button" class="icon-button small" :disabled="streaming || attachmentReading" :aria-label="t('AIAGENT.BUTTON.EDIT_QUESTION')" @click="editQuestion(message)"><el-icon><EditPen /></el-icon></button></el-tooltip>
                  </div>
                </template>

                <!-- 助手回答 -->
                <template v-else>
                  <div v-if="message.process.length || isActive(message)" class="process" :class="[message.status, { live: isActive(message), open: traceOpen(message) }]">
                    <button class="trace-toggle" type="button" :data-message-id="message.id" :aria-expanded="traceOpen(message)" :aria-controls="`trace-${message.id}`">
                      <!-- 生成中的折叠方块与结果图标共用一个槽位：结束时方块收拢，再弹出结果图标。 -->
                      <span class="trace-icon">
                        <Transition name="mark" mode="out-in">
                          <ActivityMark v-if="isActive(message)" key="live" />
                          <el-icon v-else key="result" class="trace-result"><component :is="message.status === 'error' ? CircleClose : message.status === 'stopped' ? VideoPause : CircleCheck" /></el-icon>
                        </Transition>
                      </span>
                      <template v-if="isActive(message)">
                        <span class="trace-label">{{ liveLabel(message) }}<template v-if="liveStepName(message)"> · {{ liveStepName(message) }}</template></span>
                        <span class="trace-elapsed">{{ t('AIAGENT.STATUS.ELAPSED', { seconds: Math.floor(Math.max(0, now - message.createdAt) / 1000) }) }}</span>
                      </template>
                      <template v-else>
                        <span class="trace-label">{{ summaryLabel(message) }}</span>
                        <span v-if="stepCounts(message).length" class="trace-counts">
                          <span v-for="entry in stepCounts(message)" :key="entry.group" :title="entry.label"><el-icon><component :is="entry.icon" /></el-icon>{{ entry.count }}</span>
                        </span>
                      </template>
                      <el-icon v-if="layout(message).timeline.length" class="trace-chevron"><ChevronIcon /></el-icon>
                    </button>
                    <div v-if="traceOpen(message) && layout(message).timeline.length" :id="`trace-${message.id}`" class="steps">
                      <template v-for="item in layout(message).timeline" :key="item.id">
                        <component :is="stepExpandable(item) ? 'button' : 'div'" class="step-row" :class="[stepGroup(item), item.status, { expandable: stepExpandable(item), open: stepExpandable(item) && stepOpen(message, item) }]"
                          v-bind="stepExpandable(item) ? { type: 'button', 'data-message-id': message.id, 'data-process-id': item.id, 'aria-expanded': stepOpen(message, item) } : {}">
                          <el-icon class="step-icon"><component :is="item.status === 'error' ? CircleClose : stepIcon(item)" /></el-icon>
                          <span class="step-name">{{ stepName(item) }}</span>
                          <span class="step-preview">{{ stepExpandable(item) && stepOpen(message, item) ? '' : stepPreview(message, item) }}</span>
                          <span class="step-time">{{ stepTime(message, item) }}</span>
                          <el-icon v-if="stepExpandable(item)" class="step-chevron"><ChevronIcon /></el-icon>
                        </component>
                        <div v-if="stepExpandable(item) && stepOpen(message, item)" class="step-detail">
                          <Typewriter v-if="item.kind === 'text'" :content="item.text" :active="isActive(message) && item.status === 'running'" @progress="scheduleScroll" />
                          <template v-else-if="item.kind === 'subagent'">
                            <template v-if="item.thinking"><h4>{{ t('AIAGENT.PROCESS.THINKING_TURN') }}</h4><p class="plain">{{ item.thinking }}</p></template>
                            <template v-if="item.answer"><h4>{{ t('AIAGENT.PROCESS.SUBAGENT_ANSWER') }}</h4><Typewriter :content="item.answer" :active="isActive(message) && item.status === 'running'" @progress="scheduleScroll" /></template>
                            <p v-if="!item.thinking && !item.answer" class="plain">{{ t('AIAGENT.STATUS.WAITING') }}</p>
                          </template>
                          <pre v-else-if="item.kind === 'json'" class="raw">{{ item.input }}</pre>
                          <template v-else>
                            <dl v-if="toolFacts(item).length" class="facts"><template v-for="fact in toolFacts(item)" :key="fact.label"><dt>{{ fact.label }}</dt><dd>{{ fact.value }}</dd></template></dl>
                            <p v-else class="plain">{{ t('AIAGENT.PROCESS.NO_DETAILS') }}</p>
                            <details v-if="item.input" class="raw-details"><summary>{{ t('AIAGENT.PROCESS.RAW') }}</summary><pre class="raw">{{ prettyJson(item.input) }}</pre></details>
                          </template>
                        </div>
                      </template>
                    </div>
                  </div>

                  <div v-for="item in layout(message).body" :key="`body-${item.id}`" class="answer-part">
                    <Typewriter v-if="item.kind === 'text'" :content="item.text" :active="isActive(message)" :highlight="item.id === keyMarkPart(message)" :sweep="justFinished(message)" @progress="scheduleScroll" />
                    <div v-else-if="item.kind === 'chart'" class="result-card">
                      <div class="result-head">
                        <strong>{{ item.chart?.title || t('AIAGENT.CHART.TITLE') }}</strong>
                        <div v-if="item.chart?.chart_type !== 'table' && chartHasData(item.chart)" class="segmented" role="tablist">
                          <button type="button" role="tab" :aria-selected="chartMode(message, item) === 'chart'" :class="{ active: chartMode(message, item) === 'chart' }" @click="chartModes.set(chartKey(message, item), 'chart')"><el-icon><ChartLineIcon /></el-icon>{{ uiCopy.chart }}</button>
                          <button type="button" role="tab" :aria-selected="chartMode(message, item) === 'data'" :class="{ active: chartMode(message, item) === 'data' }" @click="chartModes.set(chartKey(message, item), 'data')"><el-icon><TableIcon /></el-icon>{{ uiCopy.data }}</button>
                        </div>
                        <el-tooltip v-if="canDownloadChart(item)" :content="t(chartMode(message, item) === 'data' ? 'AIAGENT.CHART.DOWNLOAD_TABLE' : 'AIAGENT.CHART.DOWNLOAD')">
                          <button class="icon-button" type="button" :aria-label="t(chartMode(message, item) === 'data' ? 'AIAGENT.CHART.DOWNLOAD_TABLE' : 'AIAGENT.CHART.DOWNLOAD')" @click.stop="downloadCurrent(message, item)"><el-icon><Download /></el-icon></button>
                        </el-tooltip>
                      </div>
                      <div class="result-body">
                        <p v-if="item.chart?.summary" class="result-summary">{{ item.chart.summary }}</p>
                        <template v-if="chartHasData(item.chart)">
                          <ChartView v-if="item.chart?.chart_type !== 'table'" v-show="chartMode(message, item) === 'chart'" :ref="el => { setChartRef(chartKey(message, item), el); }" :content="item.chart" />
                          <div v-if="chartMode(message, item) === 'data' && chartTable(item.chart)" class="data-table-scroll">
                            <table class="data-table">
                              <thead><tr><th v-for="(head, hi) in chartTable(item.chart)!.headers" :key="hi" :class="{ num: numericColumn(chartTable(item.chart)!, hi) }">{{ head }}</th></tr></thead>
                              <tbody><tr v-for="(row, ri) in chartTable(item.chart)!.rows" :key="ri"><td v-for="(cell, ci) in row" :key="ci" :class="{ num: typeof cell === 'number' }">{{ formatCell(cell) }}</td></tr></tbody>
                            </table>
                          </div>
                        </template>
                        <p v-else class="result-empty">{{ t('AIAGENT.CHART.NO_DATA') }}</p>
                      </div>
                      <div v-if="item.chart?.total != null" class="result-foot">{{ t('AIAGENT.CHART.RECORDS', { total: item.chart.total, displayed: item.chart.displayed ?? item.chart.total }) }}</div>
                    </div>
                  </div>
                  <p v-if="message.status === 'completed' && !bodyEntries(message).length" class="note">{{ t('AIAGENT.STATUS.NO_ANSWER') }}</p>
                  <p v-if="message.status === 'stopped'" class="note">{{ t('AIAGENT.STATUS.STOPPED_NOTE') }}</p>
                  <div v-if="message.errorKey" class="error-card" role="alert"><el-icon><Warning /></el-icon><div><strong>{{ t(message.errorKey) }}</strong><p v-if="message.errorDetail">{{ message.errorDetail }}</p></div></div>
                  <div v-if="!isActive(message)" class="answer-actions">
                    <el-tooltip :content="t(copiedMessageId === message.id ? 'AIAGENT.COPY.SUCCESS' : 'AIAGENT.BUTTON.COPY')"><button type="button" class="icon-button small" :disabled="!answerText(message)" :aria-label="t('AIAGENT.BUTTON.COPY')" @click="copyAnswer(message)"><el-icon><component :is="copiedMessageId === message.id ? Check : CopyDocument" /></el-icon></button></el-tooltip>
                    <!-- 反馈仅保存在本机，不声称已提交服务端；复用 YES / NOT 键。 -->
                    <el-tooltip :content="t('CM.COMMON.YES')"><button type="button" class="icon-button small" :class="{ selected: feedback.get(message.id) === 'up' }" :aria-label="t('CM.COMMON.YES')" :aria-pressed="feedback.get(message.id) === 'up'" @click="setFeedback(message, 'up')"><FeedbackIcon /></button></el-tooltip>
                    <el-tooltip :content="t('CM.COMMON.NOT')"><button type="button" class="icon-button small" :class="{ selected: feedback.get(message.id) === 'down' }" :aria-label="t('CM.COMMON.NOT')" :aria-pressed="feedback.get(message.id) === 'down'" @click="setFeedback(message, 'down')"><FeedbackIcon down /></button></el-tooltip>
                    <el-tooltip v-if="canRegenerate(message)" :content="t('AIAGENT.BUTTON.REGENERATE')"><button type="button" class="icon-button small" :disabled="streaming" :aria-label="t('AIAGENT.BUTTON.REGENERATE')" @click="regenerate(message)"><el-icon><RefreshRight /></el-icon></button></el-tooltip>
                  </div>
                  <!-- 追问建议：仅在最新一条已完成的答复下展示，点击直接提问。 -->
                  <div v-if="showFollowUps(message)" class="follow-ups" role="group" :aria-label="uiCopy.related">
                    <p class="follow-label" aria-hidden="true">{{ uiCopy.related }}</p>
                    <button v-for="(question, index) in message.followUps" :key="question" type="button" class="follow-up" :style="{ '--i': index }" @click="askFollowUp(question)">
                      <span>{{ question }}</span><ArrowRightIcon class="follow-icon" aria-hidden="true" />
                    </button>
                  </div>
                </template>
              </article>
            </div>
          </el-scrollbar>

          <!-- 右侧提问导航：悬停展开列表，点击定位 -->
          <nav v-if="questionEntries.length > 1" class="question-nav" :aria-label="uiCopy.questions">
            <div class="nav-rail" aria-hidden="true"><i v-for="entry in questionEntries" :key="entry.id" :class="{ active: entry.id === activeQuestionId }" /></div>
            <div class="nav-panel">
              <p>{{ uiCopy.questions }}</p>
              <button v-for="entry in questionEntries" :key="entry.id" type="button" :class="{ active: entry.id === activeQuestionId }" @click="jumpToMessage(entry.id)">
                <i aria-hidden="true" /><span>{{ entry.content }}</span><time>{{ formatTime(entry.createdAt) }}</time>
              </button>
            </div>
          </nav>
          <el-tooltip v-if="!following" :content="t('AIAGENT.BUTTON.BOTTOM')"><button class="to-bottom" type="button" :aria-label="t('AIAGENT.BUTTON.BOTTOM')" @click="jumpToBottom"><el-icon><ArrowDown /></el-icon></button></el-tooltip>
        </div>

        <!-- 输入区 -->
        <footer class="composer-region">
          <div class="composer" :class="{ 'is-streaming': streaming }" @paste="onAttachmentPaste">
            <!-- DOCX / XLSX / PDF / PPTX 在本地提取文本；仍通过现有 message.content 发送，无新增上传接口。 -->
            <input ref="attachmentInput" hidden type="file" :accept="ATTACHMENT_ACCEPT" multiple tabindex="-1" :aria-label="attachmentCopy.add" @change="onAttachmentChoose" />
            <div v-if="editingMessageId" class="composer-editing"><span><el-icon><EditPen /></el-icon>{{ t('AIAGENT.BUTTON.EDIT_QUESTION') }}</span><button type="button" class="icon-button small" :aria-label="t('AIAGENT.BUTTON.CANCEL')" :title="t('AIAGENT.BUTTON.CANCEL')" @click="cancelQuestionEdit"><el-icon><Close /></el-icon></button></div>
            <div v-if="draftAttachments.length" class="attachment-list">
              <div v-for="file in draftAttachments" :key="file.id" class="file-chip removable">
                <button type="button" class="file-open" :title="file.name" @click="attachmentPreview = file"><el-icon><Document /></el-icon><span>{{ file.name }}</span></button>
                <button type="button" class="file-remove" :aria-label="`${t('CM.COMMON.DELETE')} ${file.name}`" :title="t('CM.COMMON.DELETE')" @click="removeAttachment(file.id)"><el-icon><Close /></el-icon></button>
              </div>
            </div>
            <p v-if="attachmentError" class="attachment-error" role="alert"><span>{{ attachmentError }}</span><button type="button" class="icon-button small" :aria-label="t('CM.COMMON.CLOSE')" @click="attachmentErrors.delete(activeId)"><el-icon><Close /></el-icon></button></p>
            <el-input ref="inputRef" v-model="draft" type="textarea" resize="none" :autosize="{ minRows: messages.length ? 1 : 2, maxRows: 8 }" :placeholder="t('AIAGENT.INPUT.PLACEHOLDER')" :aria-label="t('AIAGENT.INPUT.LABEL')" @keydown="onInputKeydown" />
            <div class="composer-toolbar">
              <el-tooltip placement="top-start" :trigger="['hover', 'focus']">
                <template #content><div class="tooltip-text">{{ attachmentCopy.limits }}<br />{{ attachmentCopy.formatsSummary }}</div></template>
                <button type="button" class="attach-button" :disabled="attachmentReading" :aria-label="attachmentCopy.add" @click="attachmentInput?.click()"><el-icon><Paperclip /></el-icon><span>{{ attachmentCopy.add }}</span><em v-if="draftAttachments.length">{{ draftAttachments.length }}</em></button>
              </el-tooltip>
              <span v-if="attachmentReading" class="composer-hint" role="status">{{ t('CM.COMMON.UPLOADING_FILE') }}</span>
              <span v-else-if="streaming" class="composer-hint">{{ t('AIAGENT.INPUT.NEXT_DRAFT') }}</span>
              <span class="spacer" />
              <el-tooltip v-if="streaming" :content="t('AIAGENT.BUTTON.STOP')"><button type="button" class="send-button stop" :aria-label="t('AIAGENT.BUTTON.STOP')" @click="stopGeneration()"><el-icon><StopIcon /></el-icon></button></el-tooltip>
              <el-tooltip v-else :content="t(editingMessageId ? 'AIAGENT.BUTTON.REGENERATE' : 'AIAGENT.BUTTON.SEND')"><button type="button" class="send-button" :disabled="!draft.trim() || attachmentReading" :aria-label="t(editingMessageId ? 'AIAGENT.BUTTON.REGENERATE' : 'AIAGENT.BUTTON.SEND')" @click="sendMessage"><el-icon><component :is="editingMessageId ? RefreshRight : Top" /></el-icon></button></el-tooltip>
            </div>
          </div>
          <!-- 示例问题：直接展示完整问题，不依赖专属图标；增删问题只需改 welcomeExamples 与语言包文案。 -->
          <div v-if="!messages.length" class="examples">
            <p class="examples-label">{{ uiCopy.tryAsking }}</p>
            <button v-for="(key, index) in welcomeExamples" :key="key" type="button" class="example" :style="{ '--i': index }" @click="setDraft(t(`AIAGENT.EXAMPLE.${key}.PROMPT`))">
              <span class="example-text">{{ t(`AIAGENT.EXAMPLE.${key}.PROMPT`) }}</span>
              <span class="example-hint" aria-hidden="true">{{ uiCopy.fill }}<el-icon><FillIcon /></el-icon></span>
            </button>
          </div>
        </footer>
        <p class="disclaimer">{{ uiCopy.disclaimer }}</p>
      </main>
    </div>
    <el-dialog :model-value="!!pendingDelete" width="420px" :append-to-body="false" :show-close="false" align-center class="agent-confirm" @update:model-value="value => { if (!value) pendingDelete = null; }">
      <template #header><h3 class="confirm-title">{{ uiCopy.deleteTitle }}</h3></template>
      <p class="confirm-body">{{ uiCopy.deleteBody(pendingDelete?.title || t('AIAGENT.HISTORY.UNTITLED')) }}</p>
      <template #footer>
        <button type="button" class="dialog-button" @click="pendingDelete = null">{{ t('AIAGENT.BUTTON.CANCEL') }}</button>
        <button type="button" class="dialog-button danger" @click="confirmDelete">{{ t('AIAGENT.HISTORY.DELETE') }}</button>
      </template>
    </el-dialog>
    <el-dialog :model-value="!!attachmentPreview" :title="attachmentPreview?.name || t('CM.COMMON.PREVIEW')" width="min(760px, 92vw)" :append-to-body="false" class="agent-preview" @update:model-value="value => { if (!value) attachmentPreview = null; }">
      <pre class="attachment-content">{{ attachmentPreview?.content }}</pre>
    </el-dialog>
    <p class="sr-only" role="status" aria-live="polite">{{ t(streaming ? 'AIAGENT.A11Y.GENERATING' : 'AIAGENT.A11Y.READY') }}</p>
  </section>
</template>
<script setup lang="ts">
import { computed, defineComponent, h, nextTick, onMounted, onUnmounted, reactive, ref, watch, type PropType } from 'vue';
import { useI18n } from 'vue-i18n';
import { ElButton, ElInput, ElIcon, ElTooltip, ElScrollbar, ElDialog, ElDropdown, ElDropdownMenu, ElDropdownItem, ElMessage, type InputInstance, type ScrollbarInstance } from 'element-plus';
import { ArrowDown, Check, ChatLineRound, CircleCheck, CircleClose, Close, Connection, CopyDocument, Delete, Document, Download, EditPen, InfoFilled, Loading, Paperclip, Top, RefreshRight, Search, Star, StarFilled, VideoPause, Warning } from '@element-plus/icons-vue';
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
// 展示层线性图标（Lucide 图形，ISC License，© Lucide Contributors），只内联用到的几枚。
const lineIcon = (paths: string[], strokeWidth = 1.6) => defineComponent({
  setup: () => () => h('svg', { viewBox: '0 0 24 24', width: '1em', height: '1em', fill: 'none', stroke: 'currentColor', 'stroke-width': strokeWidth, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true' }, paths.map(d => h('path', { d }))),
});
const CloudIcon = lineIcon(['M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z']);
const BotIcon = lineIcon(['M12 8V4H8', 'M6 8h12a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2z', 'M2 14h2', 'M20 14h2', 'M15 13v2', 'M9 13v2']);
const WrenchIcon = lineIcon(['M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z']);
const PanelIcon = lineIcon(['M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z', 'M9 3v18']);
const ChartLineIcon = lineIcon(['M3 3v16a2 2 0 0 0 2 2h16', 'm19 9-5 5-4-4-3 3']);
const TableIcon = lineIcon(['M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z', 'M3 9h18', 'M9 9v12']);
const MoreIcon = lineIcon(['M12 12h.01', 'M19 12h.01', 'M5 12h.01'], 2.4);
const ChevronIcon = lineIcon(['m6 9 6 6 6-6']);
const ArrowRightIcon = lineIcon(['M5 12h14', 'm12 5 7 7-7 7']);
const FillIcon = lineIcon(['M14 9 9 4 4 9', 'M20 20h-7a4 4 0 0 1-4-4V4']);
const NewChatIcon = lineIcon(['M12 20h9', 'M16.376 3.622a1 1 0 0 1 3.002 3.002L7.368 18.635a2 2 0 0 1-.855.506l-2.872.838a.5.5 0 0 1-.62-.62l.838-2.872a2 2 0 0 1 .506-.854z']);
const StopIcon = defineComponent({ setup: () => () => h('svg', { viewBox: '0 0 24 24', width: '1em', height: '1em', 'aria-hidden': 'true' }, [h('rect', { x: 7, y: 7, width: 10, height: 10, rx: 2, fill: 'currentColor' })]) });
// 品牌标识：静止的四方块。生成中的状态动画见 ActivityMark。
const BrandMark = defineComponent({ setup: () => () => h('span', { class: 'brand-mark', 'aria-hidden': 'true' }, [h('i'), h('i'), h('i'), h('i')]) });
// 生成中状态标识：三个小圆点依次明暗起伏，克制、通用；不由 token 更新驱动。
// 用户明确要求每次生成均自动播放此状态动效；其他减少动态行为保持原有策略。
const ActivityMark = defineComponent({
  setup: () => () => h('span', { class: 'activity-mark', 'aria-hidden': 'true' }, [h('i'), h('i'), h('i')]),
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
  // 模型在答复结束前通过 json 事件下发的追问建议（最多 3 条）。
  followUps?: string[];
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
// 追问建议：仅接受非空字符串数组，去重后最多 3 条，单条不超过 200 字。
function readFollowUps(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const list = [...new Set(value.filter((v): v is string => typeof v === 'string').map(v => v.trim()).filter(v => v && Array.from(v).length <= 200))].slice(0, 3);
  return list.length ? list : undefined;
}
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
          followUps: m.role === 'assistant' ? readFollowUps(m.followUps) : undefined,
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
const locatedMessageId = ref(''), copiedMessageId = ref('');
let locatedTimer: ReturnType<typeof setTimeout> | undefined, copiedTimer: ReturnType<typeof setTimeout> | undefined;
const questionEntries = computed(() => messages.value.filter(message => message.role === 'user'));
const readingPositions = new Map<string, { top: number; following: boolean }>();
function rememberReadingPosition() {
  const wrap = scrollRef.value?.wrapRef;
  if (wrap) readingPositions.set(activeId.value, { top: wrap.scrollTop, following: following.value });
}
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
async function focusHistorySearch() {
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
}
function markCopied(id: string) { copiedMessageId.value = id; clearTimeout(copiedTimer); copiedTimer = setTimeout(() => { copiedMessageId.value = ''; }, 1800); }
async function copyQuestion(message: ChatMessage) { if (await copyText(message.content)) markCopied(message.id); }
async function copyAnswer(message: ChatMessage) {
  if (await copyText(answerText(message))) markCopied(message.id);
}

const following = ref(true);
const sidebarOpen = ref(true);
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
// 起始页示例卡片：顺序与语言包键对应，图标仅作展示。
const welcomeExamples = ['ONE', 'TWO', 'THREE'];
// ---- 展示层（2026-11 改版）：仅派生展示数据，不改变请求、事件解析与历史存储 ----
// 新增文案沿用 attachmentCopy 的做法放在组件内，中英各一份，不新增外部语言包键。
const uiCopy = computed(() => locale.value.toLowerCase().startsWith('zh') ? {
  tryAsking: '试试这样问', fill: '填入', copy: '复制', related: '你可能还想问', deleteTitle: '删除会话？', deleteBody: (title: string) => `将删除「${title}」及其全部问答，删除后无法恢复。`,
  searchHistory: '搜索会话', today: '今天', week: '近 7 天', earlier: '更早', more: '更多',
  done: '已完成', usedTime: (seconds: string) => `用时 ${seconds} 秒`, chart: '图表', data: '数据', dimension: '维度',
  questions: '本会话的提问', disclaimer: '内容由 AI 生成，数据以系统报表为准', expand: '展开侧栏', collapse: '收起侧栏',
  steps: { thinking: '思考', skill: '技能', agent: '智能体', tool: '工具' },
} : {
  tryAsking: 'Try asking', fill: 'Use', copy: 'Copy', related: 'Related questions', deleteTitle: 'Delete chat?', deleteBody: (title: string) => `This will delete “${title}” and all of its messages. This can’t be undone.`,
  searchHistory: 'Search chats', today: 'Today', week: 'Previous 7 days', earlier: 'Earlier', more: 'More',
  done: 'Completed', usedTime: (seconds: string) => `${seconds}s`, chart: 'Chart', data: 'Data', dimension: 'Category',
  questions: 'Questions in this chat', disclaimer: 'AI-generated content. Refer to system reports for official figures.', expand: 'Show sidebar', collapse: 'Hide sidebar',
  steps: { thinking: 'Thinking', skill: 'Skills', agent: 'Agents', tool: 'Tools' },
});
// 历史分组：收藏置顶，其余按最近更新时间分为今天 / 近 7 天 / 更早。
const historyGroups = computed(() => {
  const start = new Date(); start.setHours(0, 0, 0, 0);
  const today = start.getTime(), week = today - 6 * 86_400_000;
  return [
    { key: 'favorites', label: t('AIAGENT.HISTORY.FAVORITES'), items: pinned.value },
    { key: 'today', label: uiCopy.value.today, items: unpinned.value.filter(c => c.updatedAt >= today) },
    { key: 'week', label: uiCopy.value.week, items: unpinned.value.filter(c => c.updatedAt < today && c.updatedAt >= week) },
    { key: 'earlier', label: uiCopy.value.earlier, items: unpinned.value.filter(c => c.updatedAt < week) },
  ].filter(group => group.items.length);
});
// 点击追问直接发送；若输入框已有草稿、附件或正在编辑问题，则改为填入，避免覆盖用户内容。
function askFollowUp(question: string) {
  if (streaming.value || attachmentReading.value || editingMessageId.value || draft.value.trim() || draftAttachments.value.length) { setDraft(question); return; }
  draft.value = question;
  sendMessage();
}
function showFollowUps(message: ChatMessage) {
  const list = messages.value;
  return message.role === 'assistant' && message.status === 'completed' && !isActive(message) && !!message.followUps?.length && list[list.length - 1]?.id === message.id;
}
function onChatCommand(chat: Conversation, command: string, where: 'side' | 'header' = 'side') {
  if (command === 'favorite') toggleFavorite(chat);
  else if (command === 'rename') renameConversation(chat, where);
  else if (command === 'delete') deleteConversation(chat);
}
// 右侧提问导航：按滚动位置高亮当前所读的提问。
const activeQuestionId = ref('');
function updateActiveQuestion() {
  const wrap = scrollRef.value?.wrapRef;
  const entries = questionEntries.value;
  if (!wrap || !entries.length) { activeQuestionId.value = ''; return; }
  if (wrap.scrollHeight - wrap.scrollTop - wrap.clientHeight < 8) { activeQuestionId.value = entries[entries.length - 1].id; return; }
  const top = wrap.getBoundingClientRect().top + 96;
  let id = entries[0].id;
  for (const entry of entries) {
    const el = document.getElementById(`chat-message-${entry.id}`);
    if (el && el.getBoundingClientRect().top <= top) id = entry.id;
  }
  activeQuestionId.value = id;
}
watch(() => [activeId.value, questionEntries.value.length], () => { void nextTick(updateActiveQuestion); });
function onMessageScroll() { onScroll(); updateActiveQuestion(); }
// ---- 执行过程：每个 SSE 过程项渲染为一行步骤 ----
type StepGroup = 'thinking' | 'skill' | 'agent' | 'tool' | 'data';
function stepGroup(item: ProcessItem): StepGroup {
  if (item.kind === 'text') return 'thinking';
  if (item.kind === 'subagent') return 'agent';
  if (item.kind === 'tool') return item.skillLoad ? 'skill' : 'tool';
  return 'data';
}
const stepIcons: Record<StepGroup, unknown> = { thinking: CloudIcon, skill: SkillIcon, agent: BotIcon, tool: WrenchIcon, data: Document };
function stepIcon(item: ProcessItem) { return stepIcons[stepGroup(item)]; }
function stepName(item: ProcessItem) {
  if (item.kind === 'tool' && item.skillLoad) return t('AIAGENT.PROCESS.SKILL_LOADED', { name: skillLabel(item.toolName) });
  return processTitle(item);
}
function plainLine(value: string, last = false) {
  const lines = value.split('\n').map(line => line.replace(/^[#>\-*\s]+|[`*_]/g, '').trim()).filter(Boolean);
  return (last ? lines[lines.length - 1] : lines[0]) || '';
}
function stepPreview(message: ChatMessage, item: ProcessItem) {
  const live = isActive(message) && item.status === 'running';
  if (item.kind === 'text') return plainLine(item.text, live);
  if (item.kind === 'subagent') return plainLine(item.answer || item.thinking, true);
  if (item.kind === 'tool' && !item.skillLoad) return toolFacts(item).filter(fact => fact.label !== t('AIAGENT.PROCESS.SKILL') && fact.label !== t('AIAGENT.PROCESS.STATUS') && fact.label !== t('AIAGENT.PROCESS.DURATION_LABEL')).map(fact => `${fact.label}: ${fact.value}`).join('  ');
  return '';
}
function stepTime(message: ChatMessage, item: ProcessItem) {
  if (item.kind === 'text' || item.kind === 'chart' || item.kind === 'json') return '';
  const ms = Math.round(Math.max(0, item.duration ?? now.value - item.startTime));
  return ms < 1000 ? t('AIAGENT.PROCESS.DURATION', { ms }) : t('AIAGENT.STATUS.ELAPSED', { seconds: (ms / 1000).toFixed(ms < 10_000 ? 2 : 1) });
}
function stepExpandable(item: ProcessItem) {
  if (item.kind === 'text') return !!item.text.trim();
  if (item.kind === 'tool') return !item.skillLoad;
  return true;
}
const stepOverride = reactive(new Map<string, boolean>());
function stepOpen(message: ChatMessage, item: ProcessItem) {
  const manual = stepOverride.get(chartKey(message, item));
  if (manual !== undefined) return manual;
  // 默认只展开“正在输出”的思考 / 子智能体，以及出错的步骤。
  return item.status === 'error' || (isActive(message) && item.status === 'running' && (item.kind === 'text' || item.kind === 'subagent'));
}
function toggleStep(message: ChatMessage, item: ProcessItem) { stepOverride.set(chartKey(message, item), !stepOpen(message, item)); }
function stepCounts(message: ChatMessage) {
  const counts: Partial<Record<StepGroup, number>> = {};
  layout(message).timeline.forEach(item => { const group = stepGroup(item); counts[group] = (counts[group] || 0) + 1; });
  return (['thinking', 'skill', 'agent', 'tool'] as const).filter(group => counts[group]).map(group => ({ group, count: counts[group]!, icon: stepIcons[group], label: uiCopy.value.steps[group] }));
}
function liveStepName(message: ChatMessage) {
  const item = message.process.filter(p => (p.kind === 'tool' || p.kind === 'subagent') && p.status === 'running').pop();
  return item ? (item.kind === 'tool' && item.skillLoad ? skillLabel(item.toolName) : processTitle(item)) : '';
}
function summaryLabel(message: ChatMessage) {
  const label = message.status === 'completed' ? uiCopy.value.done : t(statusKeys[message.status]);
  return message.finishedAt ? `${label} · ${uiCopy.value.usedTime(((message.finishedAt - message.createdAt) / 1000).toFixed(1))}` : label;
}
// ---- 图表卡片：图表 / 数据两种视图，下载跟随当前视图 ----
const chartModes = reactive(new Map<string, 'chart' | 'data'>());
function chartMode(message: ChatMessage, item: ProcessItem) { return item.chart?.chart_type === 'table' ? 'data' : chartModes.get(chartKey(message, item)) || 'chart'; }
function chartTable(chart?: ChartContent): { headers: string[]; rows: (string | number)[][] } | undefined {
  if (!chart) return undefined;
  if (chart.chart_type === 'table') return chart.table_data ? { headers: chart.table_data.headers.map(String), rows: chart.table_data.rows as (string | number)[][] } : undefined;
  const series = chart.series ?? [];
  if (!series.length) return undefined;
  const xs: (string | number)[] = [];
  series.forEach(s => s.data.forEach(d => { if (!xs.includes(d.x)) xs.push(d.x); }));
  const maps = series.map(s => new Map(s.data.map(d => [d.x, d.y])));
  return { headers: [chart.x_label || uiCopy.value.dimension, ...series.map(s => s.name || chart.y_label || '')], rows: xs.map(x => [x, ...maps.map(m => m.get(x) ?? '')]) };
}
function numericColumn(table: { rows: (string | number)[][] }, index: number) { return table.rows.length > 0 && table.rows.every(row => typeof row[index] === 'number' || row[index] === '' || row[index] == null); }
function formatCell(value: unknown) { return typeof value === 'number' ? value.toLocaleString(locale.value.startsWith('zh') ? 'zh-CN' : 'en-US', { maximumFractionDigits: 6 }) : value == null ? '' : String(value); }
async function downloadCurrent(message: ChatMessage, item: ProcessItem) {
  const chart = item.chart;
  if (!chart) return;
  if (chart.chart_type === 'table' || chartMode(message, item) === 'chart') { await downloadChart(message, item); return; }
  const table = chartTable(chart);
  if (!table) return;
  const rows = [table.headers.map(csvCell).join(','), ...table.rows.map(row => row.map(csvCell).join(','))];
  saveBlob(new Blob([`\ufeff${rows.join('\r\n')}`], { type: 'text/csv;charset=utf-8' }), chartFileName(chart, 'csv'));
}
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
function toggleSidebar() { sidebarOpen.value = !sidebarOpen.value; }
function newConversation() {
  rememberReadingPosition();
  historyQuery.value = '';
  // 不再打断正在跑的回答：并发下其它会话的请求独立存活，切回来还能继续看。
  conversations.value = conversations.value.filter(c => c.messages.length || c.title || c.draft || c.attachments?.length);
  const chat = makeConversation(); conversations.value.unshift(chat); activeId.value = chat.id;
  following.value = true; persistHistory();
  void nextTick(() => inputRef.value?.focus());
}
function switchConversation(id: string) {
  if (id !== activeId.value && conversations.value.some(c => c.id === id)) {
    rememberReadingPosition(); locatedMessageId.value = '';
    activeId.value = id; const position = readingPositions.get(id); following.value = position?.following ?? true; persistHistory();
    void nextTick(() => { if (activeId.value !== id) return; if (following.value) scheduleScroll(); else scrollRef.value?.setScrollTop(position?.top || 0); });
  }
}
function toggleFavorite(chat: Conversation) {
  chat.favorite = !chat.favorite;
  persistHistory();
}
// 重命名：在侧栏条目或顶栏标题处原地编辑；Enter / 失焦保存，Esc 取消。
const renaming = reactive({ id: '', where: '' as '' | 'side' | 'header', value: '' });
function renameConversation(chat: Conversation, where: 'side' | 'header' = 'side') {
  renaming.id = chat.id; renaming.where = where; renaming.value = chat.title || '';
  void nextTick(() => { const input = processRoot.value?.querySelector<HTMLInputElement>('input.rename-input'); input?.focus(); input?.select(); });
}
function cancelRename() { renaming.id = ''; renaming.where = ''; }
function commitRename() {
  const chat = conversations.value.find(c => c.id === renaming.id);
  const value = renaming.value.trim();
  if (chat && value && value !== chat.title) {
    if (Array.from(value).length > 80) { ElMessage.warning(t('AIAGENT.HISTORY.NAME_REQUIRED')); return; }
    chat.title = value; persistHistory();
  }
  cancelRename();
}
// 删除：自定义确认框，确认后执行原有删除流程。
const pendingDelete = ref<Conversation | null>(null);
function deleteConversation(chat: Conversation) { pendingDelete.value = chat; }
function confirmDelete() {
  const chat = pendingDelete.value;
  pendingDelete.value = null;
  if (!chat || disposed) return;
  // 删除会话要把该会话下所有在跑的回答都停掉，否则请求会挂在已删除的消息上。
  chat.messages.forEach(m => { if (running.has(m.id)) finishRequest(m.id, m, 'stopped'); });
  conversations.value = conversations.value.filter(c => c.id !== chat.id);
  if (!conversations.value.length) conversations.value.push(makeConversation());
  if (chat.id === activeId.value) { activeId.value = conversations.value[0].id; following.value = true; scheduleScroll(); }
  persistHistory();
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
  // 生成中自动展开、结束后收起；用户手动展开/收起后以用户选择为准。
  return manual === undefined ? isActive(message) : manual;
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
  const step = event.target.closest<HTMLButtonElement>('button.step-row[data-message-id][data-process-id]');
  if (step) {
    const message = findMessage(step.dataset.messageId);
    const item = message?.process.find(value => String(value.id) === step.dataset.processId);
    if (message && item) { event.stopPropagation(); toggleStep(message, item); }
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
// 展示层图表主题（企业风格）：只在 dealChart 结果上叠加样式，不改变数据、系列与坐标含义。
// 卡片标题已显示图表名，画布内标题仅在下载 PNG 时临时显示。
// 色板以主题蓝起头，其余取冷色为主、暖色点缀，保证相邻系列可区分且整体不跳色。
const chartPalette = ['#3370ff', '#2fc0b3', '#8b7bf7', '#f5a73b', '#5aa9ff', '#ee7a92', '#74c26b', '#94a0b4'];
// 纵向渐变：顶部实色、底部略透，柱体与面积更有层次；下载 PNG 时同样生效。
const fadeDown = (color: string, from = 'ff', to = 'cc') => ({ type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: color + from }, { offset: 1, color: color + to }] });
const asArray = <T,>(value: T | T[] | undefined): T[] => (value == null ? [] : Array.isArray(value) ? value : [value]);
function polishChartOption(option: Record<string, unknown>, type: ChartType) {
  const muted = '#8a93a3';
  const series = asArray(option.series as Record<string, unknown>[]);
  const isPie = type === 'pie' || type === 'ring';
  option.color = chartPalette;
  option.textStyle = { fontFamily: 'PingFang SC, Microsoft YaHei, -apple-system, Segoe UI, Arial, sans-serif', color: '#5f6878' };
  option.title = merge(cloneDeep(option.title ?? {}), { show: false, top: 6, left: 'center', textStyle: { fontSize: 15, fontWeight: 600, color: '#1f2329' } });
  option.tooltip = merge(cloneDeep(option.tooltip ?? {}), {
    backgroundColor: '#fff', borderColor: '#e6e9ef', borderWidth: 1, padding: [9, 13], textStyle: { color: '#1d2330', fontSize: 12.5 },
    extraCssText: 'border-radius:10px;box-shadow:0 8px 24px rgba(23,32,56,.12);',
    axisPointer: type === 'bar' || type === 'multi-bar' ? { type: 'shadow', shadowStyle: { color: 'rgba(51,112,255,0.06)' } } : { type: 'line', lineStyle: { color: '#b9c3d6', type: 'dashed' } },
  });
  const showLegend = isPie || series.length > 1;
  option.legend = merge(cloneDeep(option.legend ?? {}), { show: showLegend, icon: 'circle', itemWidth: 8, itemHeight: 8, itemGap: 22, bottom: 0, textStyle: { color: '#5f6878', fontSize: 12 } });
  if (option.xAxis) {
    const base = { axisTick: { show: false }, axisLabel: { color: muted, fontSize: 12, margin: 12 }, nameTextStyle: { color: muted, fontSize: 11 } };
    option.xAxis = asArray(option.xAxis as Record<string, unknown>).map(axis => merge(cloneDeep(axis), base, { axisLine: { show: true, lineStyle: { color: '#dfe3ea' } }, splitLine: { show: axis.type === 'value', lineStyle: { color: '#eef1f5', type: 'dashed' } } }));
    option.yAxis = asArray(option.yAxis as Record<string, unknown>).map(axis => merge(cloneDeep(axis), base, { axisLine: { show: false }, splitLine: { lineStyle: { color: '#eef1f5', type: 'dashed' } } }));
    const zoom = !!option.dataZoom;
    if (zoom) option.dataZoom = (option.dataZoom as Record<string, unknown>[]).map(item => item.type === 'slider' ? { ...item, top: undefined, bottom: showLegend ? 28 : 6, height: 16, borderColor: '#e6e9ef', fillerColor: 'rgba(51,112,255,0.1)', handleStyle: { color: '#fff', borderColor: '#b9c3d6' }, moveHandleSize: 0, textStyle: { color: muted } } : item);
    option.grid = { top: 28, left: 4, right: 20, bottom: (showLegend ? 28 : 4) + (zoom ? 30 : 0), containLabel: true };
  }
  series.forEach((item, index) => {
    const color = chartPalette[index % chartPalette.length];
    if (item.type === 'line') {
      merge(item, { smooth: false, symbol: 'circle', symbolSize: 8, showSymbol: asArray(item.data as unknown[]).length <= 24, lineStyle: { width: 2.5, cap: 'round', join: 'round' }, itemStyle: { color, borderColor: '#fff', borderWidth: 2 }, emphasis: { focus: 'series', scale: 1.4 } });
      // 单系列时在折线下铺一层由深到浅的面积，强化趋势；多系列不铺，避免相互遮挡。
      if (series.length === 1) item.areaStyle = { color: fadeDown(color, '2e', '00') };
    } else if (item.type === 'bar' || item.type === 'multi-bar') {
      merge(item, { type: 'bar', barMaxWidth: series.length > 1 ? 24 : 48, barCategoryGap: '46%', barGap: '18%', itemStyle: { borderRadius: [5, 5, 0, 0] }, emphasis: { focus: 'series' } });
      (item.itemStyle as Record<string, unknown>).color = fadeDown(color);
    } else if (item.type === 'pie') {
      merge(item, { radius: ['44%', '68%'], center: ['50%', '46%'], padAngle: 1.5, itemStyle: { borderColor: '#fff', borderWidth: 2, borderRadius: 6 }, percentPrecision: 1, label: { color: '#5f6878', fontSize: 12.5, formatter: '{b}  {d}%' }, labelLine: { length: 12, length2: 14, lineStyle: { color: '#c5cbd6' } }, emphasis: { scaleSize: 6 } });
    } else if (item.type === 'scatter') {
      merge(item, { symbolSize: 8, itemStyle: { color, opacity: 0.8 } });
    }
  });
  return option;
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
        option.animationDuration = 700; option.animationEasing = 'cubicOut';
        polishChartOption(option, props.content.chart_type);
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
    // 下载时临时显示画布标题并留出顶部空间，导出后恢复屏幕样式。
    expose({ getDataURL: (opts?: Record<string, unknown>) => {
      try {
        if (!inst) return '';
        const current = inst.getOption() as { grid?: { top?: unknown }[] };
        const gridTop = current.grid?.[0]?.top;
        inst.setOption({ animation: false, title: { show: true }, ...(current.grid?.length ? { grid: { top: 64 } } : {}) });
        const url = inst.getDataURL(opts as never);
        inst.setOption({ animation: !reducedMotion.value, title: { show: false }, ...(current.grid?.length ? { grid: { top: gridTop } } : {}) });
        return url;
      } catch { return ''; }
    } });
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
    // 追问建议：{ "follow_up": ["...", "...", "..."] }，不进入执行过程，答复结束后展示在正文下方。
    if (isRecord(parsed) && 'follow_up' in parsed) {
      const list = readFollowUps((parsed as JsonRecord).follow_up);
      if (list) message.followUps = list;
      return;
    }
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
// 追问在结束帧之后下发：答复先完成、过程先收起；连接再保留片刻，只接收追问 json。
const FOLLOW_UP_WAIT = 20_000;
const tails = new Map<string, { abort: () => void; timer: ReturnType<typeof setTimeout> }>();
function endTail(messageId: string) {
  const tail = tails.get(messageId);
  if (!tail) return;
  tails.delete(messageId); clearTimeout(tail.timer); tail.abort();
}
function acceptTailEvent(message: ChatMessage, event: StreamEvent) {
  if (event.outerEvent !== 'ExecuteAgentNormal' || (event.innerEvent !== 'json' && event.innerEvent !== 'subagent_json')) return;
  try {
    const parsed: unknown = JSON.parse((event.content ?? '').replace(/^```json\s*/, '').replace(/\s*```$/, '').trim());
    if (!isRecord(parsed) || !('follow_up' in parsed)) return;
    const list = readFollowUps((parsed as JsonRecord).follow_up);
    if (list) { message.followUps = list; persistHistory(); scheduleScroll(); }
    endTail(message.id);
  } catch { /* 非 JSON，忽略 */ }
}
function finishRequest(messageId: string, message: ChatMessage, status: 'completed' | 'stopped' | 'error', keepTail = false) {
  const handle = running.get(messageId);
  if (!handle) return;
  running.delete(messageId);
  message.status = status; message.process.forEach(p => closeProcess(p, status));
  message.finishedAt = Date.now();
  // 完成后收起过程卡，让答复正文成为视觉主体；图表属于正文，保持展开。
  if (status === 'completed') message.process.forEach(p => { if (p.kind !== 'chart') p.expanded = false; });
  if (!running.size) { clearInterval(elapsedTimer); elapsedTimer = undefined; }
  if (keepTail && !disposed) tails.set(messageId, { abort: handle.abort, timer: setTimeout(() => endTail(messageId), FOLLOW_UP_WAIT) });
  else handle.abort();
  persistHistory(); scheduleScroll();
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
    if (disposed) return;
    if (!running.has(message.id)) { if (tails.has(message.id)) acceptTailEvent(message, event); return; }
    if (event.conversationId) chat.conversationId = event.conversationId;
    chat.updatedAt = Date.now();
    const result = applyAgentEvent(message, event);
    if (result) {
      finishRequest(message.id, message, result === 'done' ? 'completed' : 'error', result === 'done');
      // 错误已在消息内以卡片完整呈现；只有该会话不在前台时才额外弹出提示。
      if (result === 'error' && chat.id !== activeId.value) ElMessage.error(t(message.errorKey!));
    } else { scheduleSave(); scheduleScroll(); }
  }, error => {
    if (disposed || !running.has(message.id)) { endTail(message.id); return; }
    // chatStream 用 Object.assign(new Error(...), { status }) 带上状态码，
    // 它是个 Error 实例，isRecord() 判不出来——必须直接读属性，否则 401/403 会被误报成网络错误。
    const status = (error as { status?: number } | null)?.status;
    message.errorKey = status === 401 || status === 403 ? 'AIAGENT.ERROR.AUTH' : 'AIAGENT.ERROR.NETWORK';
    finishRequest(message.id, message, 'error'); if (chat.id !== activeId.value) ElMessage.error(t(message.errorKey));
  }, () => { endTail(message.id); if (!disposed) finishRequest(message.id, message, 'completed'); });
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
// 轻量语法着色：只区分注释、字符串、数字、关键字四类，不引入高亮库；未标注语言或纯文本时原样输出。
const CODE_KEYWORDS = new Set('const let var function return if else for while do break continue switch case default new class extends import export from async await try catch finally throw typeof instanceof in of null undefined true false this super void delete yield static public private protected interface enum implements package def lambda pass None True False and or not elif except raise with global nonlocal func go defer chan struct range fn mut impl pub self final abstract then fi done esac'.split(' '));
const SQL_KEYWORDS = new Set('select insert update delete into values from where group by order having join left right inner outer on as and or not in is null limit offset union all distinct create table alter drop index view set desc asc between like exists case when then else end with count sum avg min max'.split(' '));
const CODE_PLAIN = /^(?:|text|txt|plain|plaintext|log|output|csv|markdown|md)$/;
const CODE_HASH = /^(?:py|python|sh|bash|shell|zsh|yaml|yml|toml|ruby|rb|ini|conf|dockerfile|makefile|r|perl|powershell|ps1)$/;
function highlightCode(code: string, language: string): string {
  const lang = language.trim().toLowerCase().split(/\s+/)[0] ?? '';
  if (CODE_PLAIN.test(lang) || code.length > 20000) return escapeHtml(code);
  const comment = CODE_HASH.test(lang) ? '#[^\\n]*' : lang === 'sql' ? '--[^\\n]*|\\/\\*[\\s\\S]*?\\*\\/' : lang === 'json' ? '(?!)' : '\\/\\/[^\\n]*|\\/\\*[\\s\\S]*?\\*\\/';
  const pattern = new RegExp(`(${comment})|("(?:\\\\.|[^"\\\\\\n])*"|'(?:\\\\.|[^'\\\\\\n])*'|\`(?:\\\\.|[^\`\\\\])*\`)|\\b(\\d+(?:\\.\\d+)?)\\b|\\b([A-Za-z_]\\w*)\\b`, 'g');
  let html = '', last = 0;
  for (const match of code.matchAll(pattern)) {
    const [text, isComment, isString, isNumber, word] = match;
    const kind = isComment ? 'c' : isString ? 's' : isNumber ? 'n' : word && (lang === 'sql' ? SQL_KEYWORDS.has(word.toLowerCase()) : CODE_KEYWORDS.has(word)) ? 'k' : '';
    if (!kind) continue;
    html += `${escapeHtml(code.slice(last, match.index))}<span class="tok-${kind}">${escapeHtml(text)}</span>`;
    last = match.index! + text.length;
  }
  return html + escapeHtml(code.slice(last));
}
const CHECK_ICON = '<svg class="copy-done" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg>';
const COPY_ICON = '<svg class="copy-idle" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="8" y="8" width="13" height="13" rx="2.5"/><path d="M4 16V5a2 2 0 0 1 2-2h11"/></svg>';
function renderMarkdown(source: string, depth = 0): string {
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
      const pre = `<pre><code>${highlightCode(code.join('\n'), fence[2])}</code></pre>`;
      result.push(`<div class="code-block"><div class="code-toolbar"><span>${escapeHtml(fence[2].trim() || t('AIAGENT.MARKDOWN.CODE'))}</span>`
        + `<button type="button" data-copy-code title="${escapeHtml(t('AIAGENT.BUTTON.COPY_CODE'))}" aria-label="${escapeHtml(t('AIAGENT.BUTTON.COPY_CODE'))}">${COPY_ICON}${CHECK_ICON}</button></div>`
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
// 刚完成（1.5 秒内）的答复在落入正文时播放高亮动画；刷新、切换会话加载的历史不播放。
function justFinished(message: ChatMessage) {
  return message.status === 'completed' && !!message.finishedAt && Date.now() - message.finishedAt < 1500;
}
// 正文中第一个含 **加粗** 的文本块；整条回答只高亮这一处。
function keyMarkPart(message: ChatMessage) {
  return layout(message).body.find(item => item.kind === 'text' && /\*\*[^*\n]+\*\*/.test(item.text))?.id;
}
const Typewriter = defineComponent({
  props: { content: { type: String, required: true }, active: Boolean, highlight: Boolean, sweep: Boolean }, emits: ['progress'],
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
    const html = computed(() => renderMarkdown(displayed.value));
    const root = ref<HTMLElement>(); let openStates: boolean[] = [];
    const captureDetails = () => { openStates = Array.from(root.value?.querySelectorAll('details') || []).map(el => el.open); };
    const restoreDetails = () => { root.value?.querySelectorAll('details').forEach((el, i) => { if (i < openStates.length) el.open = openStates[i]; }); };
    // 重点高亮（参考 Google AI 模式）：只给正文第一处 **加粗** 加浅蓝底。
    // 答复刚落到正文时（sweep）像荧光笔一样从左到右刷出；历史消息直接显示底色，不播放动画。
    // innerHTML 更新会重建节点，按挂载时间算负的 animation-delay 接续进度，避免动画重播。
    const mountedAt = performance.now();
    const paintMarks = () => {
      const el = props.highlight ? root.value?.querySelector('strong') : null;
      if (!el) return;
      el.classList.add('key-mark');
      if (props.sweep && !reducedMotion.value) { el.classList.add('mark-sweep'); el.style.animationDelay = `${mountedAt - performance.now() + 280}ms`; }
    };
    // 浮现式输出：不显示输入光标，新出现的文字在约半秒内淡入。
    // innerHTML 每次更新都会重建节点，因此记录每段文字出现的时刻，重建后按已播放时长（负的 animation-delay）接续，不会重播。
    const FADE_MS = 480, NO_WRAP = /^(?:UL|OL|TABLE|THEAD|TBODY|TR)$/;
    let reveals: { from: number; at: number }[] = [], shownLength = 0, fadedHtml = '';
    const fadeIn = () => {
      const el = root.value;
      if (!el || fadedHtml === html.value) return;
      fadedHtml = html.value;
      const nodes: Text[] = [], walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      let total = 0;
      while (walker.nextNode()) { const node = walker.currentNode as Text; nodes.push(node); total += node.data.length; }
      const now = performance.now();
      if (props.active && !reducedMotion.value && total > shownLength) reveals.push({ from: shownLength, at: now });
      shownLength = total;
      reveals = reveals.filter(item => now - item.at < FADE_MS && item.from < total);
      if (!reveals.length) return;
      let offset = 0;
      for (const node of nodes) {
        const start = offset, end = offset + node.data.length; offset = end;
        if (end <= reveals[0].from || NO_WRAP.test(node.parentElement?.tagName ?? '')) continue;
        let rest = node, restStart = start;
        for (let k = 0; k < reveals.length; k++) {
          const from = Math.max(reveals[k].from, start), to = Math.min(k + 1 < reveals.length ? reveals[k + 1].from : total, end);
          if (from >= to) continue;
          if (from > restStart) { rest = rest.splitText(from - restStart); restStart = from; }
          const after = to < end ? rest.splitText(to - restStart) : null;
          const span = document.createElement('span');
          span.className = 'fade-in-text'; span.style.animationDelay = `${Math.round(reveals[k].at - now)}ms`;
          rest.replaceWith(span); span.appendChild(rest);
          if (!after) break;
          rest = after; restStart = to;
        }
      }
    };
    const mounted = () => { paintMarks(); fadeIn(); };
    const updated = () => { restoreDetails(); paintMarks(); fadeIn(); };
    return () => h('div', { class: ['typewriter', { active: props.active }] }, [
      h('div', { ref: root, class: 'markdown-body', innerHTML: html.value, onClick: copyCode, onToggleCapture: scheduleScroll, onVnodeBeforeUpdate: captureDetails, onVnodeMounted: mounted, onVnodeUpdated: updated }),
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
  // 成功时由按钮图标就地变为对勾来反馈，不再弹顶部提示；失败才提示。
  if (!disposed && !copied) ElMessage.warning(t('AIAGENT.COPY.FAILED'));
  return copied;
}
function copyCode(event: MouseEvent) {
  if (!(event.target instanceof Element)) return;
  const button = event.target.closest('button[data-copy-code]');
  const code = button?.closest('.code-block')?.querySelector('pre code');
  // 复制成功后按钮图标短暂变为对勾，给出就地反馈。
  if (code) void copyText(code.textContent ?? '').then(copied => { if (!copied || !button) return; button.classList.add('copied'); setTimeout(() => button.classList.remove('copied'), 1800); });
}
let motionQuery: MediaQueryList | undefined;
function syncMedia() { reducedMotion.value = !!motionQuery?.matches; }
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
  motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  syncMedia(); motionQuery.addEventListener('change', syncMedia);
  window.addEventListener('pagehide', onPageHide); scheduleScroll();
});
onUnmounted(() => { clearTimeout(locatedTimer); clearTimeout(copiedTimer); });
onUnmounted(() => {
  processEventRoot?.removeEventListener('click', onProcessClick, true);
  processEventRoot = undefined;
  stopAll(); [...tails.keys()].forEach(endTail); persistHistory(); disposed = true; clearTimeout(saveTimer); clearInterval(elapsedTimer);
  motionQuery?.removeEventListener('change', syncMedia);
  window.removeEventListener('pagehide', onPageHide);
});
</script>
<style scoped lang="less">
/* 企业浅色风格：略带蓝调的中性灰 + 主题蓝 #3370FF；颜色、圆角、阴影统一走下方变量；仅网页端；不依赖外部字体与样式。 */
:global(html), :global(body), :global(#app) { height: 100%; width: 100%; min-width: 0; min-height: 0; margin: 0; box-sizing: border-box; }
.agent-page {
  --blue: #3370ff; --blue-hover: #245bdb; --blue-soft: #eef3ff; --blue-line: #b8cdff; --mark: #d9e5ff;
  --ink: #1d2330; --ink-2: #333a47; --muted: #5f6878; --faint: #8a93a3; --disabled: #c5cbd6;
  --line: #dfe3ea; --line-soft: #ebeef3; --fill: #f1f3f7; --fill-soft: #f6f8fb; --hover: #e8ecf2;
  --success: #00a870; --danger: #f54a45; --warning: #ff8800;
  --radius-sm: 6px; --radius: 10px; --radius-lg: 14px;
  --shadow-xs: 0 1px 2px rgba(23,32,56,.05); --shadow-sm: 0 1px 2px rgba(23,32,56,.04), 0 2px 8px rgba(23,32,56,.05);
  --shadow-md: 0 4px 16px rgba(23,32,56,.08); --shadow-lg: 0 12px 32px rgba(23,32,56,.14);
  --content-width: 800px;
  --el-color-primary: #3370ff;
  --el-font-family: 'PingFang SC', 'Microsoft YaHei', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Helvetica Neue', Arial, sans-serif;
  height: 100%; width: 100%; min-height: 0; min-width: 0; display: flex; flex-direction: column; overflow: hidden;
  background: #fff; color: var(--ink); font-family: var(--el-font-family); font-size: 14px;
  -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale;
}
.agent-page, .agent-page *, .agent-page *::before, .agent-page *::after { box-sizing: border-box; }
.workspace { display: flex; flex: 1; min-height: 0; min-width: 0; overflow: hidden; }
button { font: inherit; }

/* 通用图标按钮 */
.icon-button { display: inline-grid; place-items: center; flex-shrink: 0; width: 32px; height: 32px; padding: 0; border: 0; border-radius: 6px; background: transparent; color: var(--muted); font-size: 16px; cursor: pointer; transition: background .15s, color .15s; }
.icon-button:hover:not(:disabled) { background: var(--hover); color: var(--ink); }
.icon-button:disabled { opacity: .4; cursor: not-allowed; }
.icon-button.small { width: 28px; height: 28px; font-size: 15px; }
.icon-button.selected { color: var(--blue); background: var(--blue-soft); }

/* ---------- 侧栏 ---------- */
.sidebar { width: 264px; flex: 0 0 264px; display: flex; flex-direction: column; min-height: 0; padding: 14px 12px 10px; background: var(--fill-soft); border-right: 1px solid var(--line-soft); }
.brand { display: flex; align-items: center; gap: 9px; height: 36px; padding: 0 2px 0 6px; }
.brand h1 { flex: 1; min-width: 0; margin: 0; font-size: 15px; font-weight: 600; letter-spacing: .2px; color: var(--ink); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
:deep(.brand-mark) { display: grid; grid-template-columns: 1fr 1fr; grid-template-rows: 1fr 1fr; gap: 2px; flex-shrink: 0; width: 24px; height: 24px; padding: 5px; border-radius: 6px; background: var(--blue); }
:deep(.brand-mark i) { border-radius: 1.5px; background: #fff; }
:deep(.brand-mark i:nth-child(2)) { opacity: .62; }
:deep(.brand-mark i:nth-child(3)) { opacity: .8; }
.new-chat { display: flex; align-items: center; justify-content: center; gap: 6px; height: 36px; margin-top: 14px; border: 1px solid var(--line); border-radius: 8px; background: #fff; color: var(--ink-2); font-size: 13.5px; cursor: pointer; transition: border-color .15s, color .15s, background .15s; }
.new-chat .el-icon { font-size: 15px; }
.new-chat:hover { border-color: var(--disabled); background: var(--fill-soft); }
.history-search { margin-top: 8px; }
.history-search :deep(.el-input__wrapper) { height: 36px; padding: 0 10px; border-radius: 8px; background: #fff; box-shadow: 0 0 0 1px var(--line) inset; transition: box-shadow .15s; }
.history-search :deep(.el-input__wrapper:hover) { box-shadow: 0 0 0 1px var(--disabled) inset; }
.history-search :deep(.el-input__wrapper.is-focus) { box-shadow: 0 0 0 1px var(--faint) inset; }
.history-search :deep(.el-input__inner) { font-size: 13px; }
.history-search kbd { font: 11px/1 var(--el-font-family); color: var(--disabled); }
.history-scroll { flex: 1; min-height: 0; margin-top: 6px; }
.history-empty { margin: 32px 0; text-align: center; font-size: 12.5px; color: var(--faint); }
.history-group h2 { margin: 0; padding: 16px 10px 6px; font-size: 11.5px; font-weight: 500; letter-spacing: .4px; color: var(--faint); }
.history-item { position: relative; display: flex; align-items: center; margin-bottom: 2px; border-radius: 8px; transition: background .12s, box-shadow .12s; }
.history-item:hover, .history-item:focus-within, .history-item:has(.history-more[aria-expanded="true"]) { background: var(--hover); }
.history-item.selected { background: var(--hover); }
.history-select { flex: 1; min-width: 0; display: flex; flex-wrap: wrap; align-items: center; gap: 2px 6px; padding: 8px 10px 8px 12px; border: 0; background: transparent; text-align: left; color: var(--ink-2); cursor: pointer; }
/* “⋯”按钮悬浮在行尾，未悬停时标题可占满整行。 */
.history-item:hover .history-select, .history-item:focus-within .history-select, .history-item:has(.history-more[aria-expanded="true"]) .history-select { padding-right: 38px; }
.history-title { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 13.5px; line-height: 20px; }
.history-item.selected .history-title { color: var(--ink); font-weight: 500; }
.history-match { flex-basis: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 11.5px; color: var(--faint); }
.history-dot { width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0; }
.history-dot.running { background: var(--blue); animation: soft-pulse 1.6s ease-in-out infinite; }
.history-dot.failed { background: var(--danger); }
.history-dot.stopped { background: var(--warning); }
.history-more { position: absolute; right: 5px; top: 50%; display: grid; place-items: center; width: 26px; height: 26px; margin-top: -13px; padding: 0; border: 0; border-radius: 6px; background: transparent; color: var(--muted); font-size: 16px; cursor: pointer; opacity: 0; transition: opacity .12s, background .12s; }
.history-item:hover .history-more, .history-item:focus-within .history-more, .history-more[aria-expanded="true"] { opacity: 1; }
.history-more:hover { background: var(--hover); color: var(--ink); }
.history-note { margin: 6px 0 0; padding: 8px; font-size: 11.5px; line-height: 1.6; color: var(--danger); }

/* ---------- 主区域 ---------- */
.chat-pane { position: relative; display: flex; flex-direction: column; flex: 1; min-width: 0; min-height: 0; overflow: hidden; background: #fff; }
.sidebar-open { position: absolute; z-index: 6; top: 12px; left: 12px; }
.chat-header { flex-shrink: 0; display: flex; align-items: center; height: 56px; padding: 0 24px; border-bottom: 1px solid var(--line-soft); }
.sidebar-hidden .chat-header { padding-left: 56px; }
.chat-title { display: inline-flex; align-items: center; gap: 6px; max-width: min(640px, 60vw); height: 34px; padding: 0 8px; margin-left: -8px; border: 0; border-radius: 8px; background: transparent; color: var(--ink); cursor: pointer; transition: background .15s; }
.chat-title:hover { background: var(--fill); }
.chat-title > span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 15px; font-weight: 500; }
.title-star { flex-shrink: 0; color: #f7ba1e; font-size: 14px; }
.title-chevron { flex-shrink: 0; color: var(--faint); font-size: 14px; }

.chat-scroll-area { position: relative; flex: 1; min-height: 0; display: flex; flex-direction: column; }
.message-scroll { flex: 1; min-height: 0; }
.message-scroll :deep(.el-scrollbar__wrap) { overscroll-behavior: contain; }
.message-list { width: 100%; max-width: calc(var(--content-width) + 80px); margin: 0 auto; padding: 16px 40px 36px; }

/* 消息 */
.message { position: relative; margin-top: 32px; scroll-margin-top: 16px; border-radius: 8px; animation: rise .3s ease-out both; }
.message:first-child { margin-top: 8px; }
.message.located { outline: 2px solid var(--blue-line); outline-offset: 6px; }
.message:focus { outline-offset: 6px; }
/* 编辑按钮在气泡左侧悬停出现，不占版面高度，问与答之间保持固定间距。 */
.message.user { display: flex; justify-content: flex-end; align-items: flex-end; gap: 4px; }
.question-actions { order: -1; display: flex; margin-bottom: 6px; opacity: 0; transition: opacity .15s; }
.question { max-width: 78%; padding: 10px 16px; border-radius: 16px 16px 4px 16px; background: var(--fill); color: var(--ink); }
.question-text { margin: 0; white-space: pre-wrap; overflow-wrap: anywhere; font-size: 14.5px; line-height: 1.75; }
.sent-attachments { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }
.message.user:hover .question-actions, .question-actions:focus-within { opacity: 1; }
.message.assistant { color: var(--ink-2); }

/* 执行过程 */
.process { margin-bottom: 16px; }
.trace-toggle { display: inline-flex; align-items: center; gap: 8px; max-width: 100%; height: 32px; padding: 0 10px 0 8px; margin-left: -8px; border: 0; border-radius: 8px; background: transparent; color: var(--muted); font-size: 13px; cursor: pointer; transition: background .15s; }
.trace-toggle:hover { background: var(--fill-soft); }
.trace-label { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.process.live .trace-label { color: var(--ink); }
.trace-elapsed { flex-shrink: 0; font-variant-numeric: tabular-nums; color: var(--faint); }
.trace-icon { display: grid; place-items: center; width: 20px; height: 20px; flex: 0 0 20px; }
.trace-result { flex-shrink: 0; font-size: 15px; color: var(--success); }
.mark-leave-active { transition: transform .26s cubic-bezier(.55,0,.75,.2), opacity .26s ease-in; }
.mark-leave-to { opacity: 0; transform: scale(.6); }
.mark-enter-active { transition: transform .34s cubic-bezier(.34,1.56,.64,1), opacity .2s ease-out; }
.mark-enter-from { opacity: 0; transform: scale(.4); }
.process.error .trace-result { color: var(--danger); }
.process.stopped .trace-result { color: var(--warning); }
.trace-counts { display: inline-flex; gap: 4px; margin-left: 2px; }
.trace-counts > span { display: inline-flex; align-items: center; gap: 3px; height: 20px; padding: 0 6px; border-radius: 4px; background: var(--fill); font-size: 11.5px; color: var(--muted); font-variant-numeric: tabular-nums; }
.trace-counts .el-icon { font-size: 12px; }
.trace-chevron { flex-shrink: 0; font-size: 14px; color: var(--faint); transform: rotate(-90deg); transition: transform .2s; }
.process.open .trace-chevron { transform: none; }
.steps { position: relative; margin: 4px 0 0 -10px; padding: 2px 0; animation: rise .2s ease-out both; }
/* 一根淡灰细线串起各步骤图标，表达先后顺序；不使用底板与彩色强调。 */
.steps::before { content: ''; position: absolute; left: 17.5px; top: 20px; bottom: 20px; width: 1px; background: var(--line); }
.step-row { display: flex; align-items: center; gap: 10px; width: 100%; min-height: 36px; padding: 0 10px; border: 0; border-radius: 7px; background: transparent; color: var(--ink-2); font-size: 13.5px; text-align: left; }
button.step-row { cursor: pointer; transition: background .12s; }
button.step-row:hover .step-name, .step-row.open .step-name { color: var(--ink); }
button.step-row:hover .step-chevron { color: var(--muted); }
.step-icon { position: relative; z-index: 1; flex-shrink: 0; font-size: 16px; color: var(--muted); background: #fff; box-shadow: 0 0 0 4px #fff; }
.step-row.skill { color: var(--faint); font-size: 13px; }
.step-row.skill .step-icon { color: var(--faint); }
.step-row.running .step-icon { color: var(--blue); animation: soft-pulse 1.6s ease-in-out infinite; }
.step-row.running .step-name { color: var(--ink); font-weight: 500; }
.step-row.error .step-icon, .step-row.error .step-name { color: var(--danger); }
.step-name { flex-shrink: 0; max-width: 45%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.step-preview { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 13px; color: var(--faint); }
.step-time { flex-shrink: 0; font-size: 12px; color: var(--faint); font-variant-numeric: tabular-nums; }
.step-chevron { flex-shrink: 0; font-size: 13px; color: var(--disabled); transform: rotate(-90deg); transition: transform .2s; }
.step-row.open .step-chevron { transform: none; }
.step-detail { margin: -2px 10px 10px 36px; padding: 0; font-size: 13.5px; line-height: 1.8; color: var(--muted); }
.step-detail h4 { margin: 8px 0 2px; font-size: 12px; font-weight: 500; color: var(--faint); }
.step-detail h4:first-child { margin-top: 2px; }
.step-detail .plain { margin: 0; white-space: pre-wrap; }
.step-detail :deep(.markdown-body) { color: var(--muted); font-size: 13.5px; }
.facts { display: grid; grid-template-columns: auto minmax(0, 1fr); gap: 4px 16px; margin: 4px 0; font-size: 12.5px; }
.facts dt { color: var(--faint); }
.facts dd { margin: 0; color: var(--ink-2); overflow-wrap: anywhere; }
.raw-details { margin-top: 6px; }
.raw-details summary { font-size: 12px; color: var(--faint); cursor: pointer; }
.raw-details summary:hover { color: var(--blue); }
.raw { max-height: 280px; margin: 6px 0 0; padding: 10px 12px; overflow: auto; border: 1px solid var(--line-soft); border-radius: 8px; background: var(--fill-soft); color: var(--ink-2); font: 12px/1.7 ui-monospace, Consolas, 'SF Mono', monospace; white-space: pre-wrap; overflow-wrap: anywhere; }

/* 生成中标识：三个圆点依次明暗起伏 */
:deep(.activity-mark) { display: flex; align-items: center; justify-content: center; gap: 3px; width: 20px; height: 20px; flex: 0 0 20px; }
:deep(.activity-mark i) { width: 4px; height: 4px; border-radius: 50%; background: var(--blue); animation: vds-dot 1.2s ease-in-out infinite both; }
:deep(.activity-mark i:nth-child(2)) { animation-delay: .16s; }
:deep(.activity-mark i:nth-child(3)) { animation-delay: .32s; }

/* 正文 */
.answer-part + .answer-part { margin-top: 16px; }
.answer-part :deep(.markdown-body) { font-size: 15px; line-height: 1.85; color: var(--ink-2); }
.note { margin: 10px 0 0; font-size: 13px; line-height: 1.7; color: var(--faint); }
.error-card { display: flex; align-items: flex-start; gap: 10px; margin-top: 12px; padding: 13px 16px; border: 1px solid #fbd9d7; border-radius: var(--radius); background: #fff8f7; color: #d83931; font-size: 13.5px; }
.error-card > .el-icon { margin-top: 3px; flex-shrink: 0; font-size: 16px; }
.error-card strong { font-weight: 500; }
.error-card p { margin: 4px 0 0; color: #8f5f5c; white-space: pre-wrap; overflow-wrap: anywhere; }
.answer-actions { display: flex; gap: 2px; margin-top: 12px; margin-left: -6px; }
.answer-actions .icon-button { color: var(--faint); }
.answer-actions .icon-button:hover:not(:disabled) { color: var(--ink); }
.answer-actions .icon-button.selected { color: var(--blue); background: var(--blue-soft); }
:deep(.feedback-down) { transform: rotate(180deg); }

/* 追问建议 */
.follow-ups { display: flex; flex-direction: column; align-items: flex-start; gap: 8px; margin-top: 18px; padding-top: 16px; border-top: 1px solid var(--line-soft); }
.follow-label { margin: 0 0 2px; font-size: 12px; color: var(--faint); }
.follow-up { display: inline-flex; align-items: center; gap: 10px; max-width: 100%; min-height: 38px; padding: 7px 12px 7px 14px; border: 1px solid var(--line); border-radius: var(--radius); background: #fff; color: var(--ink-2); font-size: 14px; line-height: 1.55; text-align: left; cursor: pointer; transition: background .15s, color .15s, border-color .15s, box-shadow .15s; animation: rise .35s ease-out both; animation-delay: calc(var(--i, 0) * 60ms); }
.follow-up > span { min-width: 0; }
.follow-up:hover, .follow-up:focus-visible { border-color: var(--blue-line); background: var(--blue-soft); color: var(--blue); box-shadow: var(--shadow-xs); outline: none; }
.follow-icon { flex-shrink: 0; width: 14px; height: 14px; color: var(--faint); transition: color .15s, transform .15s; }
.follow-up:hover .follow-icon, .follow-up:focus-visible .follow-icon { color: var(--blue); transform: translateX(2px); }

/* 结果卡片 */
.result-card { border: 1px solid var(--line); border-radius: var(--radius-lg); background: #fff; box-shadow: var(--shadow-sm); overflow: hidden; }
.result-head { display: flex; align-items: center; gap: 10px; min-height: 54px; padding: 8px 12px 8px 20px; border-bottom: 1px solid var(--line-soft); }
.result-head strong { flex: 1; min-width: 0; font-size: 14.5px; font-weight: 600; color: var(--ink); overflow-wrap: anywhere; }
.segmented { display: inline-flex; flex-shrink: 0; padding: 3px; border-radius: 9px; background: var(--fill); }
.segmented button { display: inline-flex; align-items: center; gap: 5px; height: 26px; padding: 0 11px; border: 0; border-radius: 6px; background: transparent; color: var(--muted); font-size: 12.5px; cursor: pointer; transition: background .15s, color .15s; }
.segmented button .el-icon { font-size: 13px; }
.segmented button:hover { color: var(--ink); }
.segmented button.active { background: #fff; color: var(--ink); box-shadow: 0 1px 2px rgba(23,32,56,.1); }
.result-body { padding: 16px 20px 14px; }
.result-summary { margin: 0 0 8px; font-size: 13px; line-height: 1.7; color: var(--faint); }
.result-empty { margin: 24px 0; text-align: center; font-size: 13px; color: var(--faint); }
:deep(.chart-container) { width: 100%; height: 340px; }
:deep(.chart-container.is-empty) { display: flex; align-items: center; justify-content: center; height: 140px; }
:deep(.chart-empty) { margin: 0; font-size: 13px; color: var(--faint); }
.data-table-scroll { max-height: 420px; overflow: auto; margin: 4px -20px -14px; border-top: 1px solid var(--line-soft); }
.data-table { width: 100%; border-collapse: collapse; font-size: 13.5px; }
.data-table th, .data-table td { padding: 11px 20px; border-bottom: 1px solid var(--line-soft); text-align: left; white-space: nowrap; }
.data-table thead th { position: sticky; top: 0; z-index: 1; background: var(--fill-soft); color: var(--muted); font-weight: 500; font-size: 12.5px; letter-spacing: .2px; }
.data-table td { color: var(--ink-2); }
.data-table td.num, .data-table th.num { text-align: right; font-variant-numeric: tabular-nums; }
.data-table tbody tr { transition: background .12s; }
.data-table tbody tr:hover { background: var(--blue-soft); }
.data-table tbody tr:last-child td { border-bottom: 0; }
.result-foot { padding: 10px 20px; border-top: 1px solid var(--line-soft); background: var(--fill-soft); font-size: 12px; color: var(--faint); }

/* 右侧提问导航 */
.question-nav { position: absolute; z-index: 5; top: 16px; right: 12px; display: flex; flex-direction: column; align-items: flex-end; }
.nav-rail { display: flex; flex-direction: column; align-items: flex-end; gap: 9px; padding: 8px 6px; }
.nav-rail i { display: block; width: 12px; height: 2px; border-radius: 1px; background: var(--disabled); transition: width .2s, background .2s; }
.nav-rail i.active { width: 18px; background: var(--blue); }
.nav-panel { position: absolute; top: 0; right: 0; width: 300px; max-height: min(420px, 70vh); overflow: auto; padding: 6px; border: 1px solid var(--line-soft); border-radius: 12px; background: #fff; box-shadow: var(--shadow-lg); opacity: 0; visibility: hidden; transform: translateX(6px); transition: opacity .15s, transform .15s, visibility .15s; }
.question-nav:hover .nav-panel, .question-nav:focus-within .nav-panel { opacity: 1; visibility: visible; transform: none; }
.nav-panel p { margin: 0; padding: 6px 10px 8px; font-size: 12px; color: var(--faint); }
.nav-panel button { display: flex; align-items: center; gap: 10px; width: 100%; padding: 8px 10px; border: 0; border-radius: 6px; background: transparent; color: var(--ink-2); font-size: 13px; text-align: left; cursor: pointer; }
.nav-panel button:hover { background: var(--fill); }
.nav-panel button.active { background: var(--blue-soft); color: var(--blue); }
.nav-panel button i { flex-shrink: 0; width: 10px; height: 2px; border-radius: 1px; background: var(--disabled); }
.nav-panel button.active i { width: 14px; background: var(--blue); }
.nav-panel button span { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.nav-panel button time { flex-shrink: 0; font-size: 11.5px; color: var(--faint); font-variant-numeric: tabular-nums; }

.to-bottom { position: absolute; z-index: 4; bottom: 12px; left: 50%; display: grid; place-items: center; width: 34px; height: 34px; margin-left: -17px; padding: 0; border: 1px solid var(--line); border-radius: 50%; background: #fff; color: var(--muted); font-size: 16px; box-shadow: var(--shadow-md); cursor: pointer; transition: color .15s, border-color .15s; animation: fade-in .2s ease-out both; }
.to-bottom:hover { color: var(--blue); border-color: var(--blue-line); }

/* ---------- 输入区 ---------- */
.composer-region { flex-shrink: 0; width: 100%; max-width: calc(var(--content-width) + 80px); margin: 0 auto; padding: 4px 40px 0; }
.composer { padding: 14px 14px 12px 18px; border: 1px solid var(--line); border-radius: 18px; background: #fff; box-shadow: var(--shadow-md); transition: border-color .15s; }
/* 起始页与问答页共用同一套输入框外观；聚焦时只略微加深描边，不使用主题色。 */
.composer:focus-within { border-color: var(--disabled); }
.composer :deep(.el-textarea__inner) { padding: 2px 0; border: 0; box-shadow: none; background: transparent; color: var(--ink); font-family: inherit; font-size: 14.5px; line-height: 1.7; }
.composer :deep(.el-textarea__inner::placeholder) { color: var(--faint); }
.composer-toolbar { display: flex; align-items: center; gap: 10px; margin-top: 8px; }
.composer-toolbar .spacer { flex: 1; }
.attach-button { display: inline-flex; align-items: center; gap: 5px; height: 30px; padding: 0 11px 0 9px; border: 1px solid var(--line); border-radius: 15px; background: #fff; color: var(--muted); font-size: 13px; cursor: pointer; transition: color .15s, border-color .15s, background .15s; }
.attach-button .el-icon { font-size: 14px; }
.attach-button em { min-width: 16px; height: 16px; padding: 0 4px; border-radius: 8px; background: var(--blue); color: #fff; font-size: 11px; font-style: normal; line-height: 16px; text-align: center; }
.attach-button:hover:not(:disabled) { color: var(--blue); border-color: var(--blue-line); background: var(--blue-soft); }
.attach-button:disabled { opacity: .5; cursor: not-allowed; }
.composer-hint { font-size: 12px; color: var(--faint); }
.send-button { display: grid; place-items: center; flex-shrink: 0; width: 34px; height: 34px; padding: 0; border: 0; border-radius: 50%; background: var(--blue); color: #fff; font-size: 17px; cursor: pointer; transition: background .15s, transform .1s, box-shadow .15s; }
.send-button:hover:not(:disabled) { background: var(--blue-hover); }
.send-button:active:not(:disabled) { transform: scale(.94); }
.send-button:disabled { background: var(--fill); color: var(--disabled); box-shadow: none; cursor: not-allowed; }
.send-button.stop { background: var(--ink); font-size: 18px; box-shadow: none; }
.send-button.stop:hover { background: #000; }
.composer-editing { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin: -2px 0 8px; padding-bottom: 8px; border-bottom: 1px solid var(--line-soft); color: var(--blue); font-size: 12.5px; }
.composer-editing > span { display: inline-flex; align-items: center; gap: 6px; }
.attachment-list { display: flex; flex-wrap: wrap; gap: 8px; max-height: 112px; overflow: auto; padding-bottom: 10px; }
.file-chip { display: inline-flex; align-items: center; gap: 6px; max-width: 260px; min-width: 0; height: 32px; padding: 0 10px; border: 1px solid var(--line); border-radius: 8px; background: #fff; color: var(--ink-2); font-size: 12.5px; cursor: pointer; }
.file-chip > span, .file-open > span { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.file-chip .el-icon { flex-shrink: 0; color: var(--blue); font-size: 15px; }
.file-chip.removable { padding: 0 2px 0 0; background: var(--fill-soft); cursor: default; }
.file-open { display: inline-flex; align-items: center; gap: 6px; min-width: 0; height: 100%; padding: 0 4px 0 10px; border: 0; background: transparent; color: inherit; cursor: pointer; }
.file-open:hover { color: var(--blue); }
.file-remove { display: grid; place-items: center; width: 24px; height: 24px; padding: 0; border: 0; border-radius: 5px; background: transparent; color: var(--faint); cursor: pointer; }
.file-remove .el-icon { color: inherit; font-size: 13px; }
.file-remove:hover { background: var(--hover); color: var(--ink); }
.attachment-error { display: flex; align-items: flex-start; gap: 8px; margin: 0 0 8px; color: var(--danger); font-size: 12.5px; line-height: 1.6; white-space: pre-wrap; overflow-wrap: anywhere; }
.attachment-error span { flex: 1; padding-top: 4px; }
.tooltip-text { max-width: 300px; font-size: 12px; line-height: 1.7; }
.disclaimer { flex-shrink: 0; margin: 0; padding: 10px 0 12px; text-align: center; font-size: 11.5px; color: var(--faint); opacity: .8; }
.attachment-drop { position: absolute; z-index: 20; inset: 12px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; border: 2px dashed var(--blue-line); border-radius: 16px; background: rgba(243,246,255,.94); color: var(--blue); pointer-events: none; }
.attachment-drop .el-icon { font-size: 30px; }
.attachment-drop span { font-size: 12.5px; color: var(--muted); }
.attachment-content { max-height: 58vh; margin: 0; padding: 16px; overflow: auto; border-radius: 8px; background: var(--fill-soft); color: var(--ink); font: 12px/1.75 ui-monospace, Consolas, monospace; white-space: pre-wrap; overflow-wrap: anywhere; }
/* 弹框：删除确认与附件预览 */
.agent-page :deep(.el-overlay) { background: rgba(31,35,41,.32); }
.agent-page :deep(.el-dialog) { --el-dialog-padding-primary: 0; padding: 0; border-radius: 14px; box-shadow: 0 16px 48px rgba(23,32,56,.2); overflow: hidden; }
.agent-page :deep(.agent-confirm .el-dialog__header) { margin: 0; padding: 22px 24px 0; }
.agent-page :deep(.agent-confirm .el-dialog__body) { padding: 10px 24px 0; }
.agent-page :deep(.agent-confirm .el-dialog__footer) { display: flex; justify-content: flex-end; gap: 10px; padding: 22px 24px 20px; }
.confirm-title { margin: 0; font-size: 16px; font-weight: 600; color: var(--ink); }
.confirm-body { margin: 0; font-size: 14px; line-height: 1.7; color: var(--muted); overflow-wrap: anywhere; }
.dialog-button { height: 34px; min-width: 72px; padding: 0 16px; border: 1px solid var(--line); border-radius: 8px; background: #fff; color: var(--ink-2); font-size: 14px; cursor: pointer; transition: background .15s, border-color .15s; }
.dialog-button:hover { background: var(--fill-soft); border-color: var(--disabled); }
.dialog-button.danger { border-color: var(--danger); background: var(--danger); color: #fff; }
.dialog-button.danger:hover { border-color: #d83931; background: #d83931; }
.agent-page :deep(.agent-preview .el-dialog__header) { margin: 0; padding: 18px 20px 12px; border-bottom: 1px solid var(--line-soft); }
.agent-page :deep(.agent-preview .el-dialog__title) { font-size: 15px; font-weight: 600; color: var(--ink); }
.agent-page :deep(.agent-preview .el-dialog__headerbtn) { top: 8px; right: 8px; }
.agent-page :deep(.agent-preview .el-dialog__body) { padding: 16px 20px 20px; }
/* 原地重命名 */
.rename-input { flex: 1; min-width: 0; height: 36px; margin: 0; padding: 0 10px; border: 1px solid var(--blue); border-radius: 8px; outline: 0; background: #fff; color: var(--ink); font: inherit; font-size: 13.5px; box-shadow: 0 0 0 3px rgba(51,112,255,.1); }
.history-item.renaming { background: transparent; }
.rename-input.header { flex: 0 1 420px; height: 34px; margin-left: -8px; font-size: 15px; font-weight: 500; }

/* ---------- 起始页 ---------- */
.chat-pane.is-welcome { justify-content: center; padding-bottom: 5vh; }
.welcome { display: flex; flex-direction: column; align-items: center; padding: 0 40px 28px; text-align: center; animation: rise .45s ease-out both; }
.welcome :deep(.welcome-mark) { width: 48px; height: 48px; gap: 4px; padding: 11px; border-radius: 13px; }
.welcome :deep(.welcome-mark i) { border-radius: 3px; }
.welcome-title { margin: 24px 0 0; font-size: 30px; line-height: 1.35; font-weight: 600; letter-spacing: .5px; color: var(--ink); }
.welcome-tip { margin: 10px 0 0; font-size: 15px; line-height: 1.7; color: var(--muted); }
.is-welcome .composer-region { animation: rise .45s ease-out .06s both; }
.is-welcome .disclaimer { position: absolute; left: 0; right: 0; bottom: 12px; pointer-events: none; }
.examples { display: grid; gap: 8px; margin-top: 18px; }
.examples-label { margin: 0; padding: 0 4px 2px; font-size: 12px; color: var(--faint); animation: rise .45s ease-out .1s both; }
.example { position: relative; display: flex; align-items: center; gap: 12px; width: 100%; min-height: 46px; padding: 10px 14px 10px 16px; border: 1px solid var(--line-soft); border-radius: 12px; background: rgba(255,255,255,.8); color: var(--ink-2); font-size: 14px; line-height: 1.6; text-align: left; cursor: pointer; transition: background .15s, color .15s, border-color .15s, box-shadow .15s, transform .15s; animation: rise .45s ease-out both; animation-delay: calc(140ms + var(--i, 0) * 60ms); }
.example:hover, .example:focus-visible { border-color: var(--blue-line); background: #fff; color: var(--ink); box-shadow: var(--shadow-sm); transform: translateY(-1px); }
.example-text { flex: 1; min-width: 0; }
.example-hint { display: inline-flex; align-items: center; gap: 4px; flex-shrink: 0; font-size: 12px; color: var(--blue); opacity: 0; transform: translateX(-4px); transition: opacity .15s, transform .15s; }
.example:hover .example-hint, .example:focus-visible .example-hint { opacity: 1; transform: none; }
.example-hint .el-icon { font-size: 14px; }


/* ---------- Markdown ---------- */
.sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
:deep(.typewriter) { overflow-wrap: anywhere; }
:deep(.fade-in-text) { animation: text-in .48s ease-out both; }
:deep(.markdown-body p) { margin: 0 0 12px; }
:deep(.markdown-body p:last-child) { margin-bottom: 0; }
:deep(.markdown-body > :first-child) { margin-top: 0; }
:deep(.markdown-body h1), :deep(.markdown-body h2), :deep(.markdown-body h3), :deep(.markdown-body h4), :deep(.markdown-body h5), :deep(.markdown-body h6) { margin: 22px 0 10px; line-height: 1.5; font-size: 1.08em; font-weight: 600; color: var(--ink); }
:deep(.markdown-body h1), :deep(.markdown-body h2) { font-size: 1.18em; }
:deep(.markdown-body strong) { font-weight: 600; color: var(--ink); }
.answer-part :deep(.markdown-body strong.key-mark) { padding: 1px 2px; border-radius: 3px; background: linear-gradient(var(--mark), var(--mark)) 0 0 / 100% 100% no-repeat; }
.answer-part :deep(.markdown-body strong.mark-sweep) { animation: mark-sweep 1.6s cubic-bezier(.4,0,.3,1) both; }
@keyframes mark-sweep { from { background-size: 0% 100%; } to { background-size: 100% 100%; } }
:deep(.markdown-body ul), :deep(.markdown-body ol) { padding-left: 22px; margin: 10px 0; }
:deep(.markdown-body li) { margin: 4px 0; padding-left: 2px; }
:deep(.markdown-body li::marker) { color: var(--faint); }
:deep(.markdown-body a) { color: var(--blue); text-decoration: none; }
:deep(.markdown-body a:hover) { text-decoration: underline; }
:deep(.markdown-body blockquote) { margin: 12px 0; padding: 4px 14px; border-left: 3px solid var(--line); color: var(--muted); }
:deep(.markdown-body hr) { height: 1px; margin: 18px 0; border: 0; background: var(--line-soft); }
:deep(.markdown-body code) { padding: 2px 6px; border-radius: 5px; font-size: .88em; font-family: ui-monospace, 'SF Mono', 'JetBrains Mono', Consolas, monospace; background: var(--fill); color: #3558c8; }
:deep(.code-block) { margin: 14px 0; border: 1px solid var(--line); border-radius: 12px; overflow: hidden; background: #fafbfd; box-shadow: var(--shadow-xs); }
:deep(.code-toolbar) { display: flex; align-items: center; justify-content: space-between; gap: 12px; height: 38px; padding: 0 6px 0 16px; border-bottom: 1px solid var(--line-soft); background: var(--fill-soft); color: var(--muted); font: 500 12px/1 ui-monospace, 'SF Mono', Consolas, monospace; letter-spacing: .3px; }
:deep(.code-toolbar button) { display: grid; place-items: center; flex-shrink: 0; width: 28px; height: 28px; padding: 0; border: 0; border-radius: 6px; background: transparent; color: var(--faint); cursor: pointer; transition: background .15s, color .15s; }
:deep(.code-toolbar button:hover) { background: var(--hover); color: var(--ink); }
:deep(.code-toolbar .copy-done), :deep(.code-toolbar button.copied .copy-idle) { display: none; }
:deep(.code-toolbar button.copied .copy-done) { display: block; color: var(--success); }
:deep(.code-block pre) { margin: 0; padding: 14px 18px 16px; overflow-x: auto; font-size: 13px; line-height: 1.75; tab-size: 4; }
:deep(.code-block pre code) { padding: 0; white-space: pre; font-variant-ligatures: none; background: transparent; color: var(--ink-2); font-size: 13px; }
:deep(.tok-k) { color: #2f5fe0; }
:deep(.tok-s) { color: #178a63; }
:deep(.tok-n) { color: #b0600f; }
:deep(.tok-c) { color: var(--faint); font-style: italic; }
:deep(.code-fold summary), :deep(.md-details > summary) { padding: 8px 12px; font-size: 12.5px; color: var(--muted); cursor: pointer; }
:deep(.md-details) { margin: 12px 0; padding-left: 12px; border-left: 2px solid var(--line); }
:deep(.table-scroll) { overflow: auto; max-width: 100%; max-height: 420px; margin: 14px 0; border: 1px solid var(--line); border-radius: 12px; }
:deep(.markdown-body table) { width: 100%; border-collapse: collapse; font-size: 13.5px; }
:deep(.markdown-body th), :deep(.markdown-body td) { min-width: 90px; padding: 10px 14px; border-bottom: 1px solid var(--line-soft); text-align: left; }
:deep(.markdown-body th) { position: sticky; top: 0; background: var(--fill-soft); color: var(--muted); font-weight: 500; }
:deep(.markdown-body tr:last-child td) { border-bottom: 0; }

/* 焦点、滚动条 */
:deep(button:focus-visible), :deep(summary:focus-visible), :deep(a:focus-visible) { outline: 2px solid var(--blue); outline-offset: 2px; }
:deep(.el-scrollbar__thumb) { background: #c0c7d2; }
.raw, .data-table-scroll, :deep(.code-block pre), :deep(.table-scroll) { scrollbar-width: thin; scrollbar-color: #c5cbd6 transparent; }

/* 动画 */
@keyframes rise { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
@keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
@keyframes text-in { from { opacity: 0; } to { opacity: 1; } }
@keyframes soft-pulse { 0%, 100% { opacity: 1; } 50% { opacity: .35; } }
@keyframes vds-dot { 0%, 70%, 100% { opacity: .28; transform: scale(.85); } 35% { opacity: 1; transform: scale(1.1); } }

/* 减少动态：关闭其余动效；按用户要求保留生成状态标识动画。 */
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after, :deep(*), :deep(*::before), :deep(*::after) { animation: none !important; transition: none !important; scroll-behavior: auto !important; }
  :deep(.activity-mark i) { animation: vds-dot 1.2s ease-in-out infinite both !important; }
  :deep(.activity-mark i:nth-child(2)) { animation-delay: .16s !important; }
  :deep(.activity-mark i:nth-child(3)) { animation-delay: .32s !important; }
}
</style>
<!-- 下拉菜单渲染在 body 下，需非 scoped 样式；类名带 agent- 前缀避免影响门户其它页面。 -->
<style lang="less">
.agent-menu.el-dropdown__popper { --el-dropdown-menuItem-hover-fill: #f1f3f7; --el-dropdown-menuItem-hover-color: #1d2330; border: 1px solid #ebeef3; border-radius: 12px; box-shadow: 0 12px 32px rgba(23,32,56,.14); }
.agent-menu.el-dropdown__popper .el-popper__arrow { display: none; }
.agent-menu .el-dropdown-menu { padding: 5px; border-radius: 12px; }
.agent-menu .el-dropdown-menu__item { min-width: 148px; height: 34px; padding: 0 10px; border-radius: 7px; font-size: 13.5px; color: #333a47; }
.agent-menu .el-dropdown-menu__item .el-icon { margin-right: 8px; font-size: 15px; }
.agent-menu .el-dropdown-menu__item.danger { color: #f54a45; }
.agent-menu .el-dropdown-menu__item.danger:not(.is-disabled):hover { background: #fff1f0; color: #f54a45; }
.agent-menu .el-dropdown-menu__item--divided { margin-top: 4px; }
</style>
