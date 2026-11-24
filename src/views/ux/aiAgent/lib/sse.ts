import { useLoginStore } from '~/store';
import { PREFIX, IDLE_TIMEOUT } from '../types';
import type { ChatRequest, StreamEvent, JsonRecord } from '../types';
import { isRecord } from './records';
export { isRecord } from './records';

// 增量按行切分，兼容 LF、CRLF、CR；跨 chunk 的半行和半帧继续保留。
export function createSseParser(
  onEvent: (event: StreamEvent) => void,
  onPayload?: (payload: string) => void,
) {
  let buffer = '';
  let dataLines: string[] = [];
  const dispatch = () => {
    const payload = dataLines.join('\n');
    dataLines = [];
    if (!payload.trim()) return;
    onPayload?.(payload);
    let outer: unknown;
    try {
      outer = JSON.parse(payload);
    } catch {
      return;
    }
    if (!isRecord(outer) || typeof outer.event !== 'string') return;
    let inner: JsonRecord = {};
    if (typeof outer.data === 'string') {
      try {
        const parsed: unknown = JSON.parse(outer.data);
        if (isRecord(parsed)) inner = parsed;
      } catch {
        /* 错误帧 data 为纯文本，保留在 raw.data 中。 */
      }
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
    if (eof) {
      buffer = '';
      dataLines = [];
    }
  };
}

export function chatStream(
  body: ChatRequest,
  onEvent: (event: StreamEvent) => void,
  onError: (error: unknown) => void,
  onComplete: () => void,
  onPayload?: (payload: string) => void,
): () => void {
  const controller = new AbortController();
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let settled = false;
  let receivedEndEvent = false;
  const clearTimer = () => {
    if (timer !== undefined) clearTimeout(timer);
  };
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
  const parse = createSseParser((event) => {
    if (settled) return;
    // 连接关闭不等于业务完成：只有主请求的有效结束帧才确认成功。
    // subagent_done 仅结束子任务，错误帧和缺少帧分隔符的残片均不算完成。
    if (
      event.outerEvent === 'ExecuteAgentNormal' &&
      (event.innerEvent === 'done' || event.innerEvent === 'finish_stop')
    )
      receivedEndEvent = true;
    onEvent(event);
  }, onPayload);
  touch(); // 包括等待响应头期间；每次收到实际字节后重置。
  void (async () => {
    try {
      const csrf = useLoginStore().getCsrfWebToken;
      const resp = await fetch(`${PREFIX}/webapi/ai/aiagent/v1/conversations`, {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'text/event-stream',
          CSRFWebToken: csrf,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      if (settled) {
        await resp.body?.cancel();
        return;
      }
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
            else {
              settled = true;
              clearTimer();
              onComplete();
            }
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
