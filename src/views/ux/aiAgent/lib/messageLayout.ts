import type { ChatMessage, MessageLayout, ProcessItem } from "../types";
export function bodyTextIds(message: ChatMessage): Set<number> {
  const ids = new Set<number>();
  const hasChart = message.process.some(p => p.kind === 'chart');
  let afterChart = false;
  for (const item of message.process) {
    if (item.kind === 'chart') afterChart = true;
    // 图表之后的总结立即进入正文，停止、报错或加载历史时也保持原位置。
    // follow_up JSON 单独保存，不参与图表分界或文本轮次判定。
    if (item.kind === 'text' && item.text.trim()
      && (hasChart ? afterChart : message.status === 'completed' && item.isFinal)) ids.add(item.id);
  }
  return ids;
}
// 正文按接收顺序显示图表及其后文本，其余事件留在思考过程。
export function layout(message: ChatMessage): MessageLayout {
  const textIds = bodyTextIds(message);
  const timeline: ProcessItem[] = [], body: ProcessItem[] = [];
  for (const item of message.process) {
    if (item.kind === 'chart' || (item.kind === 'text' && textIds.has(item.id))) body.push(item);
    else timeline.push(item);
  }
  return { timeline, body };
}
// 折叠框默认收起（ChatGPT 式）：从第一条过程事件出现就存在，标题栏实时滚动当前输出，
