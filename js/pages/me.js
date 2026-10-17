/* 我的：资料 + Karma 积分 + 校园邮箱验证 + 发布一览 */

import { api } from '../api.js?v=202610171035';
import { h, icon, toast, emptyState, fmtTime, maskPhone } from '../ui.js?v=202610171035';
import { state, refreshUser } from '../app.js?v=202610171035';

const STATUS_TEXT = {
  draft: '草稿', pending_confirm: '待确认', active: '在架', claiming: '认领中',
  handover: '待交接', closed: '已归还', expired: '已过期', withdrawn: '已撤回',
};

export async function renderMe(main) {
  const wrap = h('div', { class: 'wrap wrap--narrow' });
  main.append(h('div', { class: 'section' }, wrap));

  if (!state.user) {
    wrap.append(h('div', { class: 'empty' },
      h('strong', {}, '还没登录'),
      h('div', {}, '登录后可以在这里管理自己的发布与认领。'),
      h('div', { class: 'row', style: 'margin-top:14px' },
        h('a', { class: 'btn btn--primary', href: '#/login' }, '去登录'),
        h('a', { class: 'btn', href: '#/register' }, '注册账号'))));
    return;
  }

  const meBox = h('div', { class: 'panel row', style: 'gap:14px;margin-bottom:16px' });
  const karmaBox = h('div', { style: 'margin-bottom:16px' });
  const emailBox = h('div', { style: 'margin-bottom:16px' });
  const listBox = h('div', {});
  wrap.append(meBox, karmaBox, emailBox, listBox);

  meBox.append(
    h('span', { class: 'avatar avatar--lg' }, (state.user.nickname || '物').slice(0, 1)),
    h('div', { class: 'grow' },
      h('div', { class: 'strong', style: 'font-size:17px' }, state.user.nickname),
      h('div', { class: 'small muted' },
        [state.user.real_name,
         state.user.phone ? maskPhone(state.user.phone) : null,
         state.user.email].filter(Boolean).join(' · ') || '未绑定邮箱'),
      state.user.qq || state.user.wechat
        ? h('div', { class: 'small muted', style: 'margin-top:2px' },
            [state.user.qq ? `QQ ${state.user.qq}` : null,
             state.user.wechat ? `微信 ${state.user.wechat}` : null].filter(Boolean).join(' · '))
        : null,
      h('div', { class: 'chips', style: 'margin-top:8px' },
        state.user.verified ? h('span', { class: 'chip' }, '已实名') : h('span', { class: 'chip chip--warn' }, '未实名，无法发起认领'),
        state.user.student_bound ? h('span', { class: 'chip chip--muted' }, '学号已绑定') : null,
        state.user.email_verified
          ? h('span', { class: 'chip' }, (state.user.email || '').endsWith('@whu.edu.cn') ? '校园邮箱已认证' : '邮箱已认证')
          : h('span', { class: 'chip chip--muted' }, '邮箱未认证'),
        h('span', { class: 'chip chip--muted' }, `角色 ${({ student: '学生', desk: '失物招领点', admin: '管理员', security: '保卫处' })[state.user.role] || state.user.role}`))),
    h('div', { class: 'row' },
      h('button', { class: 'btn btn--sm', onclick: () => { location.hash = '#/post'; } }, '发布新信息'),
      h('button', { class: 'btn btn--sm', onclick: () => { location.hash = '#/hall'; } }, '办事大厅')),
  );

  /* ---------- 信用分 + 排行榜 + 积分兑换 ---------- */
  api.karma().then((k) => {
    karmaBox.innerHTML = '';
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
    karmaBox.append(h('div', { class: 'panel stack' },
      h('div', { class: 'row row--between' },
        h('div', { class: 'row', style: 'gap:10px' },
          h('span', { class: 'karma-points' }, String(k.points)),
          h('span', { class: 'small muted' }, '可用积分')),
        h('span', { class: 'karma-badge' }, `Lv.${k.level} · ${k.title}`)),
      h('div', { class: 'karma-bar' },
        h('div', {
          class: 'karma-bar__fill',
          style: `width:${k.next_at ? Math.min(100, Math.round((k.points / k.next_at) * 100)) : 100}%`,
        })),
      h('div', { class: 'row row--between', style: 'margin-top:12px' },
        h('div', {},
          h('div', { class: 'small muted' }, '信用分'),
          h('div', { class: 'row', style: 'gap:8px' },
            h('span', { class: 'credit-score' }, String(credit.score)),
            h('span', { class: 'chip' }, credit.band))),
        h('div', { class: 'small muted', style: 'max-width:60%' },
          (credit.notes || []).slice(-3).join(' · '))),
      h('div', { class: 'form-hint', style: 'margin-top:6px' },
        `累计获得 ${k.earned} 分 · 已兑换 ${k.spent} 分 · 发布 +1 / 完整 +2 / 归还 +10 / 认领通过 +5`),
      h('div', { class: 'form-divider' }, '积分兑换（校园小商户）'),
      list));
  }).catch(() => {});

  /* ---------- 排行榜 ---------- */
  api.leaderboard().then((data) => {
    const leaders = data.leaders || [];
    if (!leaders.length) return;
    const board = h('div', { class: 'panel', style: 'margin-bottom:16px' },
      h('h3', { style: 'margin:0 0 10px;font-size:16px' }, '珞珈热心榜'),
      h('div', { class: 'hall-list' }, ...leaders.slice(0, 5).map((u, i) => h('div', { class: 'hall-item' },
        h('span', { class: 'map-rank' }, String(i + 1)),
        h('div', { class: 'hall-item__body' },
          h('div', { class: 'hall-item__title' }, u.nickname),
          h('div', { class: 'small muted' }, `${u.title} · 信用 ${u.credit}`)),
        h('span', { class: 'chip' }, `${u.points} 分`)))));
    listBox.before(board);
  }).catch(() => {});


  /* ---------- 邮箱验证 ---------- */
  if (!state.user.email_verified) {
    const emailIn = h('input', {
      class: 'input', placeholder: 'you@whu.edu.cn 或 you@qq.com',
      value: state.user.email || '',
    });
    const codeIn = h('input', { class: 'input', placeholder: '6 位验证码', maxlength: '6' });
    const hint = h('div', { class: 'form-hint' });
    const codeRow = h('div', { class: 'row', style: 'margin-top:8px', hidden: true }, codeIn,
      h('button', {
        class: 'btn btn--primary btn--sm',
        onclick: async () => {
          try {
            const r = await api.emailVerify(codeIn.value.trim());
            toast('邮箱验证成功', 'ok');
            await refreshUser();
            location.reload();
          } catch (err) { toast(err.message, 'err'); }
        },
      }, '确认验证'));
    emailBox.append(h('div', { class: 'panel stack' },
      h('div', { class: 'row row--between' },
        h('div', { class: 'strong' }, '校园邮箱认证'),
        h('span', { class: 'chip chip--muted' }, '选填')),
      h('div', { class: 'form-hint' },
        '认证 @whu.edu.cn 校园邮箱后，账号可信度更高；演示模式会把验证码直接显示出来。'),
      h('div', { class: 'row' },
        emailIn,
        h('button', {
          class: 'btn btn--sm',
          onclick: async () => {
            try {
              const r = await api.emailSend(emailIn.value.trim());
              hint.textContent = r.campus
                ? `验证码已生成（演示模式）：${r.demo_code} —— 10 分钟内有效`
                : `验证码已生成（演示模式）：${r.demo_code}（这不是校园邮箱，认证后不显示「校园邮箱」徽章）`;
              codeRow.hidden = false;
              codeIn.focus();
            } catch (err) { toast(err.message, 'err'); }
          },
        }, '发送验证码')),
      hint,
      codeRow));
  }

  /* ---------- 我的发布 ---------- */
  const data = await api.items({ mine: true, limit: 50 }).catch(() => ({ items: [] }));
  const items = data.items || [];

  listBox.append(
    h('div', { class: 'row row--between', style: 'margin-bottom:8px' },
      h('h2', { class: 'section-title', style: 'margin:0' }, `我的发布（${items.length}）`),
      h('a', { class: 'linklike small', href: '#/hall' }, '去办事大厅看分类 →')),
    items.length ? h('div', { class: 'list' }, ...items.map((it) => h('div', { class: 'msg' },
      it.cover_url ? h('img', {
        src: it.cover_url, alt: it.title,
        style: 'width:76px;height:56px;object-fit:cover;border-radius:10px;border:1px solid var(--border);flex:0 0 auto',
      }) : h('div', { class: 'msg__icon' }, icon('box')),
      h('div', { class: 'grow' },
        h('div', { class: 'row row--between' },
          h('div', { class: 'msg__title' }, it.title),
          h('span', { class: `badge badge--dot ${it.status === 'closed' ? 'badge--high' : it.status === 'active' ? 'badge--confirm' : 'badge--plain'}` },
            STATUS_TEXT[it.status] || it.status)),
        h('div', { class: 'msg__body' },
          `${it.kind === 'lost' ? '失物' : '拾物'} · ${it.location || '地点待补充'} · ${it.occurred_text || fmtTime(it.created_at)}`),
        h('div', { class: 'row', style: 'margin-top:8px' },
          h('button', { class: 'linklike small', onclick: () => { location.hash = `#/items/${it.id}`; } }, '查看详情与匹配 →')),
      ),
    ))) : emptyState('还没有发布', '发布一句话或一张照片，AI 会帮你整理信息并开始匹配。'),
  );
}
