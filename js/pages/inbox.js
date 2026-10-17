/* 消息中心：站内通知 + 站内安全会话（联系方式需双方同意才交换） */

import { api } from '../api.js?v=202610171035';
import { h, icon, toast, fmtTime, emptyState } from '../ui.js?v=202610171035';
import { state } from '../app.js?v=202610171035';

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
      h('div', {}, '匹配推送、认领进度、交接码、与对方的会话都在这里。'),
      h('a', { class: 'btn btn--primary', href: '#/login', style: 'margin-top:14px' }, '去登录')));
    return;
  }

  const head = h('div', { class: 'row row--between', style: 'margin-bottom:14px' });
  const tabsBar = h('div', { class: 'seg', style: 'margin-bottom:14px' });
  const body = h('div', {});
  wrap.append(head, tabsBar, body);

  let tab = 'notify';
  let openConv = null;
  let acting = false;
  let unreadChat = 0;
  try {
    const pending = sessionStorage.getItem('wugui-open-conv');
    if (pending) {
      openConv = pending;
      tab = 'chat';
      sessionStorage.removeItem('wugui-open-conv');
    }
  } catch { /* 忽略 */ }

  /* ---------------- 顶部 ---------------- */
  function drawHead() {
    head.innerHTML = '';
    head.append(
      h('h1', { style: 'font-size:23px;margin:0' }, '消息中心'),
      h('div', { class: 'row' },
        tab === 'notify'
          ? h('button', {
              class: 'btn btn--sm',
              onclick: async () => { await api.markRead(); await load(); toast('已全部标记已读'); },
            }, '全部已读')
          : null,
        tab === 'notify'
          ? h('button', {
              class: 'btn btn--sm',
              onclick: async () => { const r = await api.deliver(); toast(`已投递 ${r.sent} 条`); await load(); },
            }, '立即投递')
          : null,
      ),
    );
    tabsBar.innerHTML = '';
    for (const [key, label] of [['notify', '通知'], ['chat', `对话${unreadChat ? ` ${unreadChat}` : ''}`]]) {
      tabsBar.append(h('button', {
        class: `seg__item${tab === key ? ' is-active' : ''}`,
        onclick: () => { tab = key; openConv = null; drawHead(); load(); },
      }, label));
    }
  }

  /* ---------------- 通知 ---------------- */
  async function renderNotify(box) {
    const data = await api.inbox(false);
    const items = data.items || [];
    if (!items.length) {
      box.append(emptyState('还没有消息', '发布信息后，一有匹配系统就会推送给你。'));
      return;
    }
    const list = h('div', { class: 'list' });
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
            msg.event_type === 'claim_pass' && msg.payload && msg.payload.handover
              ? h('span', { class: 'chip' }, `交接码 ${msg.payload.handover}`)
              : null,
            msg.item_id
              ? h('button', {
                  class: 'linklike small',
                  onclick: (e) => { e.stopPropagation(); location.hash = `#/items/${msg.item_id}`; },
                }, '查看线索 →')
              : null)),
      );
      row.addEventListener('click', async () => {
        if (!msg.read) { await api.markRead(msg.id); row.classList.remove('is-unread'); }
      });
      list.append(row);
    }
    box.append(list);
  }

  /* ---------------- 会话列表 ---------------- */
  async function renderChatList(box) {
    const data = await api.conversations();
    const list = data.conversations || [];
    unreadChat = list.reduce((sum, c) => sum + (c.unread || 0), 0);
    drawHead();
    if (!list.length) {
      box.append(emptyState('还没有对话',
        '在物品详情页点「联系发布者」，就能在这里和对方站内沟通（不用先给手机号）。'));
      return;
    }
    const rows = h('div', { class: 'list' });
    for (const c of list) {
      rows.append(h('div', {
        class: `chat-row${c.unread ? ' is-unread' : ''}`,
        onclick: () => { openConv = c.id; load(); },
      },
        c.other.avatar_url
          ? h('img', { class: 'avatar', src: c.other.avatar_url, alt: c.other.nickname })
          : h('span', { class: 'avatar' }, (c.other.nickname || '物')[0]),
        h('div', { class: 'grow', style: 'min-width:0' },
          h('div', { class: 'row row--between' },
            h('strong', { class: 'small' }, c.other.nickname),
            h('span', { class: 'msg__time' }, c.last_at ? fmtTime(c.last_at) : '')),
          h('div', { class: 'small muted chat-row__item' },
            c.item ? `关于「${c.item.title}」` : ''),
          h('div', { class: 'small chat-row__last' }, c.last_message || '（还没有消息）')),
        c.unread ? h('span', { class: 'chat-row__unread' }, String(c.unread)) : null,
        c.other_share ? h('span', { class: 'chip chip--muted' }, '已交换') : null,
      ));
    }
    box.append(rows);
  }

  /* ---------------- 会话详情 ---------------- */
  async function renderConversation(box, cid) {
    const data = await api.conversation(cid);
    const c = data.conversation;
    const messages = data.messages || [];

    const headerRow = h('div', { class: 'row row--between', style: 'margin-bottom:10px' },
      h('div', { class: 'row' },
        h('button', { class: 'btn btn--sm', onclick: () => { openConv = null; load(); } }, '← 返回'),
        h('div', {},
          h('div', { class: 'strong' }, c.other.nickname),
          h('div', { class: 'small muted' },
            c.item ? h('a', { href: `#/items/${c.item.id}` }, `关于「${c.item.title}」`) : ''))),
    );

    const bubbles = h('div', { class: 'chat-body' });
    if (!messages.length) {
      bubbles.append(h('div', { class: 'chat-empty' }, '还没有消息，先打个招呼吧'));
    }
    for (const m of messages) {
      bubbles.append(h('div', { class: `bubble-row${m.mine ? ' is-mine' : ''}` },
        h('div', { class: 'bubble bubble--chat' },
          h('div', {}, m.body),
          h('div', { class: 'bubble__time' }, fmtTime(m.created_at)))));
    }

    const input = h('input', { class: 'input', placeholder: '说点什么…（不建议直接发手机号）' });
    const send = async () => {
      const text = input.value.trim();
      if (!text || acting) return;
      acting = true;
      try {
        await api.sendMessage(cid, text);
        input.value = '';
        await load();
      } catch (err) { toast(err.message, 'err'); } finally { acting = false; }
    };
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') send(); });

    const shareBtn = h('button', {
      class: `btn btn--sm${c.my_share ? ' btn--primary' : ''}`,
      onclick: async () => {
        try {
          await api.shareContact(cid, !c.my_share);
          toast(c.my_share ? '已撤回联系方式授权' : '已同意交换联系方式', 'ok');
          await load();
        } catch (err) { toast(err.message, 'err'); }
      },
    }, c.my_share ? '已同意交换我的联系方式（点击撤回）' : '同意交换我的联系方式');

    const tip = h('div', { class: 'form-note', style: 'margin:8px 0' }, icon('shield'),
      c.other_share
        ? '对方已同意交换联系方式。回到物品详情页即可查看（只对你们双方可见）。'
        : '双方都点「同意交换」后，彼此才能在物品详情页看到联系方式；在此之前全部通过站内消息沟通。');

    box.append(headerRow, tip, bubbles,
      h('div', { class: 'chat-input' }, input,
        h('button', { class: 'btn btn--primary btn--sm', onclick: send }, '发送')),
      h('div', { class: 'row', style: 'margin-top:10px' }, shareBtn));
    bubbles.scrollTop = bubbles.scrollHeight;
  }

  /* ---------------- 加载 ---------------- */

  async function load() {
    body.innerHTML = '';
    body.append(h('div', { class: 'skeleton', style: 'height:76px' }));
    try {
      body.innerHTML = '';
      if (tab === 'notify') await renderNotify(body);
      else if (openConv) await renderConversation(body, openConv);
      else await renderChatList(body);
    } catch (err) {
      body.innerHTML = '';
      body.append(emptyState('加载失败', err.message));
    }
  }

  drawHead();
  await load();
  window.dispatchEvent(new Event('inbox-viewed'));
}
