/* 积分中心：Karma 积分 + 信用分 + 排行榜 + 积分兑换 */

import { api } from '../api.js?v=202610171027';
import { h, icon, toast, emptyState } from '../ui.js?v=202610171027';
import { state } from '../app.js?v=202610171027';

export async function renderKarma(main) {
  const wrap = h('div', { class: 'wrap wrap--narrow' });
  main.append(h('div', { class: 'section' }, wrap));

  wrap.append(h('div', { style: 'margin-bottom:6px' },
    h('h1', { class: 'hall-title' }, '积分中心'),
    h('p', { class: 'small muted', style: 'margin:6px 0 0' },
      '拾金不昧能攒积分：发布 +1、信息填写完整 +2、顺利完成归还 +10、认领通过验证 +5。')));

  if (!state.user) {
    wrap.append(h('div', { class: 'panel', style: 'margin-top:16px' },
      emptyState('登录后查看你的积分',
        '登录后能攒积分、看排行榜、兑换校园小商户的券。',
        h('div', { class: 'row', style: 'margin-top:14px' },
          h('a', { class: 'btn btn--primary', href: '#/login' }, '去登录'),
          h('a', { class: 'btn', href: '#/register' }, '注册账号')))));
    return;
  }

  const mine = h('div', {});
  const board = h('div', {});
  wrap.append(mine, board);

  try {
    const k = await api.karma();
    const credit = k.credit || { score: 0, band: '', notes: [] };
    const catalog = k.catalog || [];

    const list = h('div', { class: 'catalog' });
    for (const c of catalog) {
      list.append(h('div', { class: 'catalog__row' },
        h('div', {},
          h('div', { class: 'strong small' }, c.title),
          h('div', { class: 'small muted' }, `${c.desc} · ${c.cost} 分`)),
        c.redeemed
          ? h('span', { class: 'chip chip--muted' }, '已兑换')
          : h('button', {
              class: 'btn btn--sm',
              disabled: k.points < c.cost,
              onclick: async () => {
                try {
                  const r = await api.redeem(c.id);
                  toast(`兑换成功！券码 ${r.code}`, 'ok');
                  location.reload();
                } catch (err) { toast(err.message, 'err'); }
              },
            }, k.points >= c.cost ? '兑换' : `差 ${c.cost - k.points} 分`)));
    }

    mine.append(h('div', { class: 'panel stack' },
      h('div', { class: 'row row--between' },
        h('div', { class: 'row', style: 'gap:12px;align-items:flex-end' },
          h('span', { class: 'karma-points' }, String(k.points)),
          h('span', { class: 'small muted', style: 'padding-bottom:6px' }, '可用积分')),
        h('span', { class: 'karma-badge' }, `Lv.${k.level} · ${k.title}`)),
      h('div', { class: 'karma-bar' },
        h('div', {
          class: 'karma-bar__fill',
          style: `width:${k.next_at ? Math.min(100, Math.round((k.points / k.next_at) * 100)) : 100}%`,
        })),
      h('div', { class: 'row row--between', style: 'margin-top:14px' },
        h('div', {},
          h('div', { class: 'small muted' }, '信用分'),
          h('div', { class: 'row', style: 'gap:8px' },
            h('span', { class: 'credit-score' }, String(credit.score)),
            h('span', { class: 'chip' }, credit.band))),
        h('div', { class: 'small muted', style: 'max-width:62%;text-align:right' },
          (credit.notes || []).slice(-3).join(' · '))),
      h('div', { class: 'chips', style: 'margin-top:12px' },
        (k.breakdown || []).filter((b) => b.count > 0).map((b) =>
          h('span', { class: 'chip chip--muted' }, `${b.label} ×${b.count}（+${b.points}）`))),
      h('div', { class: 'form-hint', style: 'margin-top:6px' },
        `累计获得 ${k.earned} 分 · 已兑换 ${k.spent} 分`),
      h('div', { class: 'form-divider' }, '积分兑换（校园小商户）'),
      list));
  } catch (err) {
    mine.append(emptyState('积分加载失败', err.message));
  }

  try {
    const data = await api.leaderboard();
    const leaders = data.leaders || [];
    board.append(h('div', { class: 'panel', style: 'margin-top:16px' },
      h('div', { class: 'row row--between', style: 'margin-bottom:10px' },
        h('h3', { style: 'margin:0;font-size:17px' }, '珞珈热心榜'),
        h('span', { class: 'chip chip--muted' }, `共 ${data.total_users || 0} 人上榜`)),
      leaders.length
        ? h('div', { class: 'hall-list' }, ...leaders.map((u, i) => h('div', { class: 'hall-item' },
            h('span', { class: 'map-rank' }, String(i + 1)),
            h('div', { class: 'hall-item__body' },
              h('div', { class: 'hall-item__title' }, u.nickname),
              h('div', { class: 'small muted' }, `${u.title} · 信用 ${u.credit}`)),
            h('span', { class: 'chip' }, `${u.points} 分`))))
        : emptyState('还没有人上榜', '发布第一条线索就能上榜。')));
  } catch (err) {
    board.append(emptyState('排行榜加载失败', err.message));
  }
}
