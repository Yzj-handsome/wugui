/* 办事大厅：我的遗失物品发布 / 我的捡到物品发布 */

import { api } from '../api.js?v=202610171035';
import { h, icon, emptyState, fmtTime, sourceText } from '../ui.js?v=202610171035';
import { state } from '../app.js?v=202610171035';

const STATUS_TEXT = {
  draft: '草稿', pending_confirm: '待确认', active: '在架', claiming: '认领中',
  handover: '待交接', closed: '已归还', expired: '已过期', withdrawn: '已撤回',
};
const STATUS_CLASS = {
  active: 'badge--high', claiming: 'badge--confirm', handover: 'badge--confirm',
  closed: 'badge--plain', expired: 'badge--plain', withdrawn: 'badge--plain',
  pending_confirm: 'badge--weak', draft: 'badge--plain',
};

function itemRow(item) {
  const badge = h('span',
    { class: `badge badge--dot ${STATUS_CLASS[item.status] || 'badge--plain'}` },
    STATUS_TEXT[item.status] || item.status);
  return h('a', { class: 'hall-item', href: `#/items/${item.id}` },
    item.cover_url
      ? h('img', { class: 'hall-item__img', src: item.cover_url, alt: item.title })
      : h('div', { class: 'hall-item__img hall-item__img--empty' }, icon('box')),
    h('div', { class: 'hall-item__body' },
      h('div', { class: 'hall-item__title' }, item.title || '未命名物品'),
      h('div', { class: 'small muted' },
        [item.category_l2, item.location, item.occurred_text || fmtTime(item.created_at)]
          .filter(Boolean).join(' · ')),
      h('div', { class: 'chips', style: 'margin-top:8px' },
        badge,
        (item.colors || []).slice(0, 2).map((c) => h('span', { class: 'chip' }, c + '色')),
        h('span', { class: 'chip chip--muted' }, sourceText[item.source] || item.source))),
    icon('chevron', 'hall-item__arrow'));
}

function section(title, desc, items, emptyDesc) {
  return h('section', { class: 'hall-section' },
    h('div', { class: 'hall-section__head' },
      h('h2', { class: 'section-title', style: 'margin:0' }, title),
      h('span', { class: 'chip chip--muted' }, `${items.length} 条`)),
    h('div', { class: 'small muted', style: 'margin:-4px 0 12px' }, desc),
    items.length
      ? h('div', { class: 'hall-list' }, items.map(itemRow))
      : emptyState('还没有发布', emptyDesc));
}

export async function renderHall(main) {
  const wrap = h('div', { class: 'wrap' });
  main.append(h('div', { class: 'section' }, wrap));

  wrap.append(h('div', { class: 'row row--between', style: 'margin-bottom:6px' },
    h('div', {},
      h('h1', { class: 'hall-title' }, '办事大厅'),
      h('p', { class: 'small muted', style: 'margin:6px 0 0' },
        '我的遗失与捡到发布都在这里；点卡片可以查看详情、跟进认领进度。')),
    h('div', { class: 'row' },
      h('a', { class: 'btn btn--primary btn--sm', href: '#/post' }, '＋ 我丢了 / 我捡到了'))));

  if (!state.user) {
    wrap.append(h('div', { class: 'panel', style: 'margin-top:18px' },
      emptyState('登录后查看你的发布',
        '用手机号或学号登录，就能在这里管理丢失与捡到的物品。',
        h('div', { class: 'row', style: 'margin-top:14px' },
          h('a', { class: 'btn btn--primary', href: '#/login' }, '去登录'),
          h('a', { class: 'btn', href: '#/register' }, '注册账号')))));
    return;
  }

  const data = await api.items({ mine: true, limit: 100 }).catch(() => ({ items: [] }));
  const items = data.items || [];
  const lost = items.filter((i) => i.kind === 'lost');
  const found = items.filter((i) => i.kind === 'found');
  const karma = await api.karma().catch(() => null);

  wrap.append(h('div', { class: 'hall-stats' },
    h('div', { class: 'hall-stat' },
      h('div', { class: 'hall-stat__num' }, String(lost.length)),
      h('div', { class: 'small muted' }, '我发布的遗失物品'),
      h('div', { class: 'small muted' }, '被捡到时系统会推送给你')),
    h('div', { class: 'hall-stat' },
      h('div', { class: 'hall-stat__num hall-stat__num--green' }, String(found.length)),
      h('div', { class: 'small muted' }, '我发布的捡到物品'),
      h('div', { class: 'small muted' }, '等待失主认领，交接码在消息中心')),
    karma
      ? h('div', { class: 'hall-stat' },
          h('div', { class: 'hall-stat__num hall-stat__num--amber' }, String(karma.points)),
          h('div', { class: 'small muted' }, `Karma 积分 · ${karma.title}`),
          h('div', { class: 'small muted' },
            karma.next_at ? `再 ${Math.max(0, karma.next_at - karma.points)} 分升级` : '已是最高称号'))
      : null,
  ));

  wrap.append(section('我的遗失物品发布', '丢东西时发布在这里；匹配到候选会主动推送。',
    lost, '还没有发布过丢失信息，点右上角「＋ 我丢了 / 我捡到了」开始。'));
  wrap.append(section('我的捡到物品发布', '捡到东西时发布在这里；认领人要通过你的隐藏细节题。',
    found, '还没有发布过捡到信息，拾金不昧从一条记录开始。'));
}
