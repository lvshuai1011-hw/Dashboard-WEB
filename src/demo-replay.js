// 独立预览入口读取本机选中的 SSE 文件，按文件名排序；生产门户不加载此模块。
export function createLocalReplay() {
  const bar = document.createElement('label');
  const status = document.createElement('span');
  const picker = document.createElement('input');
  picker.type = 'file';
  picker.multiple = true;
  picker.accept = '.txt,.sse,.log';
  bar.style.cssText = 'display:flex;align-items:center;flex-wrap:wrap;gap:12px;padding:8px 16px';
  bar.append('选择本地 SSE 文件', picker, status);
  status.setAttribute('role', 'status');
  document.body.prepend(bar);
  let frames = [];
  picker.onchange = async () => {
    frames = [];
    picker.disabled = true;
    try {
      const files = Array.from(picker.files).sort((a, b) => a.name.localeCompare(b.name));
      const parts = await Promise.all(files.map((file) => file.text()));
      // 每份粘贴文本结束于完整帧，文件末尾的空行可能被编辑器裁掉。
      const raw = parts.map((part) => part.replace(/\r\n?/g, '\n').trimEnd()).join('\n\n');
      frames = raw ? raw.split(/\n\n+/) : [];
      status.textContent = frames.length ? `已载入 ${frames.length} 帧，发送问题即可回放` : '';
    } catch {
      status.textContent = '文件读取失败，请重新选择';
    } finally {
      picker.disabled = false;
    }
  };
  return (signal) => {
    if (!frames.length) throw new Error('请先选择 SSE 文件');
    const source = frames;
    let index = 0;
    let timer;
    const encoder = new TextEncoder();
    const stop = () => {
      clearTimeout(timer);
      signal?.removeEventListener('abort', abort);
    };
    let controller;
    const abort = () => {
      stop();
      controller.error(new DOMException('Aborted', 'AbortError'));
    };
    const stream = new ReadableStream({
      start(value) {
        controller = value;
        signal?.addEventListener('abort', abort, { once: true });
        const next = () => {
          controller.enqueue(encoder.encode(source[index++] + '\n\n'));
          if (index === source.length) {
            stop();
            controller.close();
          } else timer = setTimeout(next, 35);
        };
        next();
      },
      cancel: stop,
    });
    return new Response(stream, { headers: { 'Content-Type': 'text/event-stream' } });
  };
}
