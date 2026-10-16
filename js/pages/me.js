/* 我的：发布与认领一览（§11.2） */

import { api } from '../api.js';
import { h, icon, toast, emptyState, fmtTime, maskPhone } from '../ui.js';
import { state, refreshUser } from '../app.js';

const STATUS_TEXT = {
  draft: '草稿', pending_confirm: '待确认', active: '在架', claiming: '认领中',
  handover: '待交接', closed: '已归还', expired: '已过期', withdrawn: '已撤回',
};

export async function renderMe(main) {
  const wrap = h('div', { class: 'wrap' });
  main.append(h('div', { class: 'section' }, wrap));

  if (!state.user) {
    wrap.append(h('div', { class: 'empty' },
      h('strong', {}, '还没登录'),
      h('div', {}, '登录后可以在这里管理自己的发布与认领。'),
      h('button', { class: 'btn btn--primary', style: 'margin-top:14px', onclick: () => document.querySelector('#userBox button')?.click() }, '去登录')));
    return;
  }

  const meBox = h('div', { class: 'panel row', style: 'gap:14px;margin-bottom:20px' });
  const listBox = h('div', {});
  wrap.append(meBox, listBox);

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
        h('span', { class: 'chip chip--muted' }, `角色 ${({ student: '学生', desk: '失物招领点', admin: '管理员', security: '保卫处' })[state.user.role] || state.user.role}`))),
    h('div', { class: 'row' },
      h('button', { class: 'btn btn--sm', onclick: () => { location.hash = '#/post'; } }, '发布新信息'),
      h('button', { class: 'btn btn--sm', onclick: () => { location.hash = '#/inbox'; } }, '消息中心')),
  );

  const data = await api.items({ mine: true, limit: 50 }).catch(() => ({ items: [] }));
  const items = data.items || [];

  listBox.append(
    h('h2', { class: 'section-title' }, `我的发布（${items.length}）`),
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
    ))) : emptyState('还没有发布过', '描述或拍一张照片，AI 会帮你填好信息并开始匹配。'),
  );
}
