import { defineComponent, h } from "vue";
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
export const SkillIcon = defineComponent({
  setup: () => () => h('svg', { viewBox: '0 0 24 24', width: '1em', height: '1em', fill: 'none', stroke: 'currentColor', 'stroke-width': 1.7, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true' }, [
    h('path', { d: 'M15.39 4.39a1 1 0 0 0 1.68-.474 2.5 2.5 0 1 1 3.014 3.015 1 1 0 0 0-.474 1.68l1.683 1.682a2.414 2.414 0 0 1 0 3.414L19.61 15.39a1 1 0 0 1-1.68-.474 2.5 2.5 0 1 0-3.014 3.015 1 1 0 0 1 .474 1.68l-1.683 1.682a2.414 2.414 0 0 1-3.414 0L8.61 19.61a1 1 0 0 0-1.68.474 2.5 2.5 0 1 1-3.014-3.015 1 1 0 0 0 .474-1.68l-1.683-1.682a2.414 2.414 0 0 1 0-3.414L4.39 8.61a1 1 0 0 1 1.68.474 2.5 2.5 0 1 0 3.014-3.015 1 1 0 0 1-.474-1.68l1.683-1.682a2.414 2.414 0 0 1 3.414 0z' }),
  ]),
});
// 展示层线性图标（Lucide 图形，ISC License，© Lucide Contributors），只内联用到的几枚。
export const lineIcon = (paths: string[], strokeWidth = 1.6) => defineComponent({
  setup: () => () => h('svg', { viewBox: '0 0 24 24', width: '1em', height: '1em', fill: 'none', stroke: 'currentColor', 'stroke-width': strokeWidth, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true' }, paths.map(d => h('path', { d }))),
});
export const CloudIcon = lineIcon(['M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z']);
export const BotIcon = lineIcon(['M12 8V4H8', 'M6 8h12a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2z', 'M2 14h2', 'M20 14h2', 'M15 13v2', 'M9 13v2']);
export const WrenchIcon = lineIcon(['M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z']);
export const PanelIcon = lineIcon(['M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z', 'M9 3v18']);
export const ChartLineIcon = lineIcon(['M3 3v16a2 2 0 0 0 2 2h16', 'm19 9-5 5-4-4-3 3']);
export const TableIcon = lineIcon(['M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z', 'M3 9h18', 'M9 9v12']);
export const MoreIcon = lineIcon(['M12 12h.01', 'M19 12h.01', 'M5 12h.01'], 2.4);
export const ChevronIcon = lineIcon(['m6 9 6 6 6-6']);
export const BackIcon = lineIcon(['M19 12H5', 'm12 19-7-7 7-7']);
export const ArrowRightIcon = lineIcon(['M5 12h14', 'm12 5 7 7-7 7']);
export const FillIcon = lineIcon(['M14 9 9 4 4 9', 'M20 20h-7a4 4 0 0 1-4-4V4']);
export const NewChatIcon = lineIcon(['M12 20h9', 'M16.376 3.622a1 1 0 0 1 3.002 3.002L7.368 18.635a2 2 0 0 1-.855.506l-2.872.838a.5.5 0 0 1-.62-.62l.838-2.872a2 2 0 0 1 .506-.854z']);
export const StopIcon = defineComponent({ setup: () => () => h('svg', { viewBox: '0 0 24 24', width: '1em', height: '1em', 'aria-hidden': 'true' }, [h('rect', { x: 7, y: 7, width: 10, height: 10, rx: 2, fill: 'currentColor' })]) });
// 生成中状态标识：一次完整的“呼吸”——吸气时圆点缓缓涨大，稍作停顿；呼气时圆点收回，同时一圈细环从边缘荡开、淡去。
// 吸短呼长，一个周期约 3.6 秒。颜色为主题蓝实心。配合状态文字上的一道微光。不由 token 更新驱动。
// 用户明确要求每次生成均自动播放此状态动效；其他减少动态行为保持原有策略。
export const ActivityMark = defineComponent({
  setup: () => () => h('span', { class: 'activity-mark', 'aria-hidden': 'true' }, [h('i', { class: 'activity-ring' }), h('i', { class: 'activity-core' })]),
});
// 与现有线性图标统一的赞/踩图形。文案意图为“有帮助 / 没有帮助”；没有新增外部 t() 键。
export const FeedbackIcon = defineComponent({
  props: { down: Boolean },
  setup: props => () => h('svg', { viewBox: '0 0 24 24', width: 16, height: 16, fill: 'none', stroke: 'currentColor', 'stroke-width': 1.6, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true', class: { 'feedback-down': props.down } }, [
    h('path', { d: 'M7 10v11H3V10h4Zm0 0 4-8c2 0 3 1 3 3v4h5a2 2 0 0 1 2 2l-1.4 8a2 2 0 0 1-2 2H7' }),
  ]),
});
