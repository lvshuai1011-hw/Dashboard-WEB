import { defineComponent, h } from 'vue';

// 遮罩从样式表加载 SVG，使图标随按钮的文字颜色变化。
function icon(name: string) {
  return defineComponent({
    setup: () => () => h('span', { class: ['agent-icon', 'icon-' + name], 'aria-hidden': 'true' }),
  });
}
export const CloudIcon = icon('cloud');
export const BotIcon = icon('bot');
export const WrenchIcon = icon('wrench');
export const PanelIcon = icon('panel');
export const ChartLineIcon = icon('chart-line');
export const TableIcon = icon('table');
export const MoreIcon = icon('more');
export const ChevronIcon = icon('chevron');
export const BackIcon = icon('back');
export const ArrowRightIcon = icon('arrow-right');
export const FillIcon = icon('fill');
export const NewChatIcon = icon('new-chat');
export const SkillIcon = icon('skill');
export const StopIcon = icon('stop');

export const ActivityMark = defineComponent({
  setup: () => () =>
    h('span', { class: 'activity-mark', 'aria-hidden': 'true' }, [
      h('i', { class: 'activity-ring' }),
      h('i', { class: 'activity-core' }),
    ]),
});

export const FeedbackIcon = defineComponent({
  props: { down: Boolean },
  setup: (props) => () =>
    h('span', {
      class: ['agent-icon', 'icon-feedback', { 'feedback-down': props.down }],
      'aria-hidden': 'true',
    }),
});
