/* 消息中心：站内信列表 + SSE 未读推送（§8.2） */

import { api } from '../api.js';
import { h, icon, toast, fmtTime, emptyState } from '../ui.js';
import { state } from '../app.js';

const TYPE_META = {
  match_high: { icon: 'sparkle', label: '高度相似' },
  match_digest: { icon: 'bell', label: '每日摘要' },
  match_owner_hint: { icon: 'box', label: '拾主提醒' },
  claim_pass: { icon: 'check', label: '验证通过' },
  claim_pass_owner: { icon: 'check', label: '有人认领' },
  claim_review: { icon: 'shield', label: '待裁决' },
  claim_review_owner: { icon: 'shield', label: '待你裁决' },
  claim_reject: { icon: 'shield', label: '验证未通过' },
  item_confirm: { icon: 'box', label: '待确认发布' },
  no_match_7d: { icon: 'clock', label: '线索提醒' },
  expire_soon: { icon: 'clock', label: '即将过期' },
};

export async function renderInbox(main) {
  const wrap = h('div', { class: 'wrap wrap--narrow' });
  main.append(h('div', { class: 'section' }, wrap));

  if (!state.user) {
    wrap.append(h('div', { class: 'empty' },
      h('strong', {}, '登录后查看消息'),
      h('div', {}, '匹配推送、认领进度、交接码都会出现在这里。')));
    return;
  }

  const listBox = h('div', { class: 'list' });
  const head = h('div', { class: 'row row--between', style: 'margin-bottom:16px' });
  wrap.append(head, listBox);

  let onlyUnread = false;

  async function load() {
    listBox.innerHTML = '';
    listBox.append(h('div', { class: 'skeleton', style: 'height:76px' }));
    try {
      const data = await api.inbox(onlyUnread);
      head.innerHTML = '';
      head.append(
        h('h1', { style: 'font-size:23px;margin:0' }, '消息中心'),
        h('div', { class: 'row' },
          h('button', {
            class: `btn btn--sm${onlyUnread ? ' btn--primary' : ''}`,
            onclick: () => { onlyUnread = !onlyUnread; load(); },
          }, '只看未读'),
          h('button', {
            class: 'btn btn--sm',
            onclick: async () => { await api.markRead(); await load(); toast('已全部标记已读'); },
          }, '全部已读'),
          h('button', {
            class: 'btn btn--sm',
            onclick: async () => { const r = await api.deliver(); toast(`已投递 ${r.sent} 条`); await load(); },
          }, '立即投递'),
        ),
      );
      const items = data.items || [];
      if (!items.length) {
        listBox.append(emptyState('还没有消息', '发布信息后，一有匹配系统就会推送给你。'));
        return;
      }
      for (const msg of items) {
        const meta = TYPE_META[msg.event_type] || { icon: 'bell', label: msg.event_type };
        const row = h('div', { class: `msg${msg.read ? '' : ' is-unread'}` },
          h('div', { class: 'msg__icon' }, icon(meta.icon)),
          h('div', { class: 'grow' },
            h('div', { class: 'row row--between' },
              h('div', { class: 'msg__title' }, msg.title),
              h('div', { class: 'msg__time' }, fmtTime(msg.created_at))),
            h('div', { class: 'msg__body' }, msg.body),
            h('div', { class: 'row', style: 'margin-top:8px;gap:8px' },
              h('span', { class: 'chip chip--muted' }, meta.label),
              h('span', { class: 'chip chip--muted' }, `通道 ${msg.channel}`),
              msg.event_type === 'claim_pass' && msg.payload && msg.payload.handover
                ? h('span', { class: 'chip' }, `交接码 ${msg.payload.handover}`)
                : null,
              msg.item_id ? h('button', {
                class: 'linklike small',
                onclick: () => { location.hash = `#/items/${msg.item_id}`; },
              }, '查看线索 →') : null,
            ),
          ),
        );
        row.addEventListener('click', async () => {
          if (!msg.read) { await api.markRead(msg.id); row.classList.remove('is-unread'); }
        });
        listBox.append(row);
      }
    } catch (err) {
      listBox.innerHTML = '';
      listBox.append(emptyState('消息加载失败', err.message));
    }
  }

  await load();
  // Mark the local counter as read so the nav badge stops flashing on this page
  window.dispatchEvent(new Event('inbox-viewed'));
}
