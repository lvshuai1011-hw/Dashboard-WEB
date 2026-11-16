import { reactive } from "vue";
import type { ChatMessage } from "../types";
// 请求按助手消息 ID 共享，切换会话不会取消请求。
const running = reactive(new Map<string, { abort: () => void; message: ChatMessage }>());
export function useRunningRequests() { return running; }
