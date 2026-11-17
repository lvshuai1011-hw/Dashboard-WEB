import type { useProcessTimeline } from './composables/useProcessTimeline';
import type { useChartCards } from './composables/useChartCards';
import type { ChatMessage } from './types';
import type { useUiCopy } from './composables/useUiCopy';

// Shared contract for the message list and its message renderer.
export interface MessageItemProps {
  locatedMessageId: string;
  copiedMessageId: string;
  streaming: boolean;
  attachmentReading: boolean;
  reducedMotion: boolean;
  now: number;
  message: ChatMessage;
  feedback: ReadonlyMap<string, string>;
  uiCopy: ReturnType<typeof useUiCopy>['value'];
  formatTime: (time: number) => string;
  isActive: (message: ChatMessage) => boolean;
  justFinished: (message: ChatMessage) => boolean;
  answerText: (message: ChatMessage) => string;
  canRegenerate: (message: ChatMessage) => boolean;
  showFollowUps: (message: ChatMessage) => boolean;
  timeline: ReturnType<typeof useProcessTimeline>;
  charts: ReturnType<typeof useChartCards>;
}
