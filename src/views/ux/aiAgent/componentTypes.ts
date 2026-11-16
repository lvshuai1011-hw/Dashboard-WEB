import type { Component } from 'vue';
import type { ChatMessage, ChartContent, ProcessItem, MessageLayout } from './types';
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
  layout: (message: ChatMessage) => MessageLayout;
  isActive: (message: ChatMessage) => boolean;
  justFinished: (message: ChatMessage) => boolean;
  keyMarkPart: (message: ChatMessage) => number | undefined;
  bodyEntries: (message: ChatMessage) => string[];
  answerText: (message: ChatMessage) => string;
  canRegenerate: (message: ChatMessage) => boolean;
  showFollowUps: (message: ChatMessage) => boolean;
  traceOpen: (message: ChatMessage) => boolean;
  liveLabel: (message: ChatMessage) => string;
  liveStepName: (message: ChatMessage) => string;
  summaryLabel: (message: ChatMessage) => string;
  stepCounts: (
    message: ChatMessage,
  ) => { group: string; label: string; icon: Component; count: number }[];
  stepExpandable: (item: ProcessItem) => boolean;
  stepGroup: (item: ProcessItem) => string;
  stepOpen: (message: ChatMessage, item: ProcessItem) => boolean;
  stepIcon: (item: ProcessItem) => Component;
  stepName: (item: ProcessItem) => string;
  stepPreview: (message: ChatMessage, item: ProcessItem) => string;
  stepTime: (message: ChatMessage, item: ProcessItem) => string;
  toolFacts: (item: ProcessItem) => { label: string; value: string }[];
  prettyJson: (value: string) => string;
  chartMode: (message: ChatMessage, item: ProcessItem) => string;
  chartTable: (
    chart?: ChartContent,
  ) => { headers: string[]; rows: (string | number)[][] } | undefined;
  numericColumn: (table: { rows: (string | number)[][] }, index: number) => boolean;
  formatCell: (value: unknown) => string;
}
