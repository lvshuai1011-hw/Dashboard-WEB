// 仅在线预览使用：组件仍调用原接口并走完整 SSE 解析；此模块在浏览器内模拟响应，不接入公司环境。
const originalFetch = window.fetch.bind(window);
window.fetch = async (input, init = {}) => {
  const url = typeof input === 'string' ? input : input.url;
  if (!url.endsWith('/vds/webapi/ai/aiagent/v1/conversations')) return originalFetch(input, init);
  const body = JSON.parse(init.body || '{}');
  const prompt = body.message?.content || '';
  const attachmentMatch = /\n\n<attached_files format="json">\n([\s\S]*)\n<\/attached_files>$/.exec(prompt);
  const files = attachmentMatch ? JSON.parse(attachmentMatch[1]) : [];
  const english = new URLSearchParams(location.search).get('lang') === 'en';
  const encoder = new TextEncoder();
  const timers = [];
  let closed = false;
  const stop = () => { closed = true; timers.forEach(clearTimeout); };
  const stream = new ReadableStream({
    start(controller) {
      const emit = (inner, outerEvent = 'ExecuteAgentNormal') => {
        if (!closed) controller.enqueue(encoder.encode(`data:${JSON.stringify({event:outerEvent,data:JSON.stringify(inner),conversationId:body.conversationId})}\n\n`));
      };
      const at = (ms, fn) => timers.push(setTimeout(() => { if (!closed) fn(); }, ms));
      init.signal?.addEventListener('abort', () => { stop(); controller.error(new DOMException('Aborted','AbortError')); }, {once:true});
      at(200, () => emit({event:'heartbeat'}));
      at(800, () => emit({event:'tool',content:'query-planning',metadata:{toolName:'skill',status:'running'}}));
      at(1100, () => emit({event:'tool',content:'query-planning',metadata:{toolName:'skill',status:'completed',duration:16}}));
      // 预览回归：有部分文本，但服务端提前关流，不发送主请求结束帧。
      if (/断流|提前断开|premature eof/i.test(prompt)) {
        at(1600, () => emit({event:'answer',content:english?'Partial response received before the connection closed.':'这是断流前已收到的部分内容。',messageId:'partial'}));
        at(4000, () => { stop(); controller.close(); });
        return;
      }
      if (/报错|异常|error/i.test(prompt)) {
        at(2200, () => emit({event:'error',content:english?'Simulated error for UI testing.':'这是用于验证错误状态的模拟异常。'}));
        return;
      }
      const reasoning = english ? 'Preparing sample billing data and choosing a presentation.' : '正在整理演示计费数据，选择合适的展示方式。';
      at(1600,()=>emit({event:'answer',content:reasoning,messageId:'planning'}));
      const table=/表格|csv|table/i.test(prompt);
      const line=/趋势|月份|折线|trend|month|line/i.test(prompt);
      const pie=/占比|饼图|pie/i.test(prompt);
      const textOnly=/文字|代码|markdown|text|code|长文/i.test(prompt);
      const labels=line?['01','02','03','04','05','06']:(english?['Prepaid','Postpaid','Hybrid']:['预付费','后付费','混合']);
      const values=line?[72000,81000,79000,93000,110000,125000]:[125000,98000,43000];
      const title=english?'Sample billing revenue':'计费收入（演示数据）';
      if(!textOnly)at(3000,()=>emit({event:'json',messageId:'chart',content:JSON.stringify(table?{chart_type:'table',title,summary:english?'Sample records for interaction testing.':'以下为交互测试用模拟记录。',table_data:{headers:english?['Type','Revenue']:['类型','收入'],rows:labels.map((v,i)=>[v,values[i]])},total:labels.length}:{chart_type:line?'line':pie?'pie':'bar',title,summary:english?'Synthetic figures; no company data is queried.':'模拟数值，不代表真实业务结果。',series:[{name:english?'Revenue':'收入',data:labels.map((x,i)=>({x,y:values[i]}))}]} )}));
      let answer = english ? `This is a **UI test response** for your question.\n\nThe page uses synthetic billing data. You can test copying, regenerating, editing, downloading, and stopping.\n\n- Prepaid: 125,000\n- Postpaid: 98,000\n- Hybrid: 43,000` : `这是针对本次提问的 **界面测试答复**。\n\n本页使用模拟计费数据，不进行真实业务查询。你可以验证复制、重新生成、重新编辑、下载及停止操作。\n\n- 预付费收入：125,000\n- 后付费收入：98,000\n- 混合计费收入：43,000`;
      if (files.length) answer += (english ? '\n\nReceived file text through the message request (demo echo):' : '\n\n已通过消息请求收到附件文本（仅演示回显）：') + files.map(file => `\n\n**${file.name}**\n\n${file.content.slice(0, 120)}`).join('');
      if(/代码|code/i.test(prompt))answer += '\n\n```js\nconst revenue = [125000, 98000, 43000];\nconst total = revenue.reduce((sum, value) => sum + value, 0);\n```';
      if(/长文|long/i.test(prompt))answer += Array.from({length:24},(_,i)=>`\n\n### ${i+1}\n${english?'Long content for scroll testing. '.repeat(8):'这段演示内容用于验证长答案滚动、回到底部与内容留白。'.repeat(6)}`).join('');
      const chars=Array.from(answer); const interval=chars.length>1000?2:45;
      chars.forEach((ch,i)=>at(3800+i*interval,()=>emit({event:'answer',content:ch,messageId:'final'})));
      const end=4200+chars.length*interval;
      at(end,()=>emit({event:'finish_stop',messageId:'final'}));
      at(end+100,()=>{stop();controller.close();});
    },
    cancel(){stop();}
  });
  return new Response(stream,{headers:{'Content-Type':'text/event-stream'}});
};
