/* 详情页：对方物品与我的描述左右对比，按钮「这是我的」（§11.2） */

import { api } from '../api.js';
import {
  h, icon, toast, matchCard, tierBadge, fmtPercent, fmtTime, sourceText, modal, contactCard,
} from '../ui.js';
import { state } from '../app.js';

export async function renderItem(main, ctx) {
  const id = ctx.params[0];
  const wrap = h('div', { class: 'wrap' });
  main.append(h('div', { class: 'section' }, wrap));

  let item;
  try {
    item = await api.item(id);
  } catch (err) {
    wrap.append(h('div', { class: 'empty' }, h('strong', {}, '找不到这条记录'), h('div', {}, err.message)));
    return;
  }

  const isMine = state.user && state.user.id === item.owner_id;
  const owner = item.attrs && item.attrs.owner;

  const cover = (item.images || []).find((i) => i.role === 'display') || (item.images || [])[0];

  const gallery = h('div', { class: 'gallery' });
  for (const img of item.images || []) {
    gallery.append(h('figure', {},
      h('img', { src: img.url, alt: item.canonical_desc, loading: 'lazy' }),
      h('figcaption', {}, img.role === 'display' ? '展示图（已脱敏）' : img.role === 'detail' ? '细节图' : '主体裁剪'),
    ));
  }

  const attrs = item.attrs || {};
  const kv = h('dl', { class: 'kv' },
    h('dt', {}, '类别'), h('dd', {}, `${item.category_l1 || '—'} / ${item.category_l2 || '—'}`),
    h('dt', {}, '颜色'), h('dd', {}, (item.colors || []).join('、') || '—'),
    h('dt', {}, '品牌'), h('dd', {}, attrs.brand || '—'),
    h('dt', {}, '地点'), h('dd', {}, item.location || '—'),
    h('dt', {}, '时间'), h('dd', {}, item.occurred_text || fmtTime(item.occurred_from)),
    h('dt', {}, '来源'), h('dd', {}, sourceText[item.source] || item.source),
    h('dt', {}, '状态'), h('dd', {}, ({ active: '在架', claiming: '认领中', handover: '待交接', closed: '已归还', pending_confirm: '待确认' })[item.status] || item.status),
  );

  const actions = h('div', { class: 'row row--wrap', style: 'margin-top:14px' });
  if (item.kind === 'found' && !isMine) {
    actions.append(h('button', { class: 'btn btn--primary btn--lg', onclick: startClaim }, '这是我的 →'));
  }
  /* 站内安全消息：不用先给手机号，先聊 */
  if (!isMine) {
    actions.append(h('button', {
      class: 'btn',
      onclick: async () => {
        if (!state.user) { toast('登录后才能联系对方', 'err'); location.hash = '#/login'; return; }
        try {
          const conv = await api.openConversation(item.id);
          sessionStorage.setItem('wugui-open-conv', conv.id);
          location.hash = '#/inbox';
        } catch (err) { toast(err.message, 'err'); }
      },
    }, '联系发布者（站内消息）'));
  }
  /* 一键海报：带二维码，发群 / 朋友圈 */
  actions.append(h('button', {
    class: 'btn',
    onclick: () => window.open(`/api/items/${item.id}/poster`, '_blank'),
  }, '生成长图海报'));
  if (isMine) {
    actions.append(
      h('button', { class: 'btn', onclick: () => showClaims(item) }, '谁在认领（查看问答）'),
      h('button', { class: 'btn', onclick: () => { location.hash = '#/post'; } }, '编辑信息'),
      h('button', {
        class: 'btn btn--danger',
        onclick: async () => {
          if (!confirm('确认撤回这条信息？向量与图片会同步删除。')) return;
          await api.deleteItem(item.id); toast('已撤回'); location.hash = '#/';
        },
      }, '撤回'),
    );
  }
  if (item.is_document) {
    actions.append(h('span', { class: 'chip chip--warn' }, '证件类物品不进公开列表，仅本人可见'));
  }

  wrap.append(
    h('div', { class: 'row', style: 'margin-bottom:14px' },
      h('button', { class: 'btn btn--ghost btn--sm', onclick: () => history.back() }, '← 返回'),
      h('span', { class: 'small muted' }, `编号 ${item.id.slice(0, 8)}`),
      h('span', { class: `badge badge--dot ${item.kind === 'lost' ? 'badge--confirm' : 'badge--high'}` },
        item.kind === 'lost' ? '失物' : '拾物'),
    ),
    h('div', { class: 'compare' },
      h('div', { class: 'compare__col panel' },
        h('h4', {}, '这条记录'),
        cover ? h('img', {
          src: cover.url, alt: item.canonical_desc,
          style: 'border-radius:12px;border:1px solid var(--border);aspect-ratio:4/3;object-fit:cover;margin-bottom:12px',
        }) : null,
        h('h2', { style: 'margin:0 0 6px;font-size:20px' }, item.title),
        h('p', { class: 'muted small', style: 'margin:0 0 12px' }, item.canonical_desc),
        kv,
        item.raw_text ? h('div', { style: 'margin-top:12px' },
          h('div', { class: 'small muted' }, '原始描述'),
          h('div', { class: 'card__explain', style: 'margin-top:4px' }, item.raw_text)) : null,
      ),
      h('div', { class: 'compare__col panel' },
        h('h4', {}, '照片与细节'),
        gallery.innerHTML ? gallery : h('div', { class: 'empty' }, '这条记录没有照片'),
        (item.public_marks || []).length
          ? h('div', { style: 'margin-top:12px' },
              h('div', { class: 'small muted', style: 'margin-bottom:6px' }, '显著特征'),
              h('div', { class: 'chips' }, ...item.public_marks.map((m) => h('span', { class: 'chip chip--muted' }, m.text))))
          : null,
        (item.ocr_text || []).length
          ? h('div', { style: 'margin-top:12px' },
              h('div', { class: 'small muted', style: 'margin-bottom:6px' }, '物品上的文字'),
              h('div', { class: 'chips' }, ...item.ocr_text.map((t) => h('span', { class: 'chip chip--muted' }, t))))
          : null,
        /* 拾物的联系方式：默认只对发布者、匹配到的失主、通过验证的认领人可见 */
        item.kind === 'found' && (item.contact || item.has_contact)
          ? h('div', { style: 'margin-top:14px' },
              contactCard(item.contact, item.contact_visible, item.contact_locked_reason,
                isMine ? '失主看到「高度相似」的线索后即可查看，你也可以随时改' : ''))
          : null,
        owner ? h('div', { class: 'row', style: 'margin-top:16px' },
          h('span', { class: 'avatar' }, (owner.nickname || '物').slice(0, 1)),
          h('div', {},
            h('div', { class: 'strong small' }, owner.nickname),
            h('div', { class: 'small muted' }, owner.role === 'desk' ? '失物招领点' : owner.role === 'admin' ? '管理员' : '学生')),
        ) : null,
        actions,
      ),
    ),
  );

  /* 匹配列表 */
  const matchBox = h('div', {});
  wrap.append(h('div', { style: 'margin-top:26px' }, matchBox));
  try {
    const data = await api.itemMatches(id, false);
    const matches = data.matches || [];
    matchBox.append(
      h('h2', { class: 'section-title' }, `相关的候选线索（${matches.length}）`),
      matches.length ? h('div', { class: 'cards' },
        ...matches.map((m) => matchCard(m, { showScore: true }))) :
        h('div', { class: 'empty' }, '还没有匹配到候选'),
    );
  } catch { /* 忽略 */ }

  async function startClaim() {
    if (!state.user) { toast('认领需要先登录', 'err'); return; }
    try {
      const res = await api.createClaim(item.id);
      location.hash = `#/claims/${res.claim_id}`;
    } catch (err) { toast(err.message, 'err'); }
  }

  const CLAIM_STATUS = { verifying: '验证中', pending_review: '待裁决', handover: '待交接', closed: '已完成', rejected: '已拒绝' };
  const VERDICT_TEXT = { match: '吻合', partial: '部分吻合', mismatch: '不吻合' };

  function claimRow(c) {
    const questions = c.questions || [];
    const answers = c.answers || [];
    const grades = c.grades || [];
    const parts = [
      h('div', { class: 'row row--between' },
        h('div', { class: 'strong' }, c.claimant.nickname),
        h('div', { class: 'msg__time' }, fmtTime(c.created_at))),
      h('div', { class: 'small muted' }, `状态：${CLAIM_STATUS[c.status] || c.status}`),
    ];
    questions.forEach((q, i) => {
      const grade = (grades[i] || {}).verdict || 'partial';
      parts.push(h('div', { style: 'margin-top:8px' },
        h('div', { class: 'small strong' }, `Q${i + 1}. ${q.text}`),
        h('div', { class: 'small muted' }, `回答：${(answers[i] || {}).answer || '（未答）'}`),
        h('div', { class: 'small' },
          h('span', { class: `verdict verdict--${grade}` }, VERDICT_TEXT[grade] || '—'))));
    });
    if ((c.risk_flags || []).length) {
      parts.push(h('div', { class: 'chips', style: 'margin-top:8px' },
        ...c.risk_flags.map((f) => h('span', { class: 'chip chip--warn' }, `风险：${f}`))));
    }
    if (c.status === 'pending_review') {
      parts.push(h('div', { class: 'row', style: 'margin-top:10px' },
        h('button', {
          class: 'btn btn--primary btn--sm',
          onclick: async () => {
            const r = await api.reviewClaim(c.claim_id, true);
            toast(r.handover_code ? `已放行，交接码 ${r.handover_code}` : '已放行', 'ok');
          },
        }, '人工放行'),
        h('button', {
          class: 'btn btn--danger btn--sm',
          onclick: async () => { await api.reviewClaim(c.claim_id, false); toast('已拒绝'); },
        }, '拒绝')));
    }
    return h('div', { class: 'msg' }, h('div', { class: 'grow' }, ...parts));
  }

  async function showClaims(target) {
    try {
      const data = await api.itemClaims(target.id);
      const rows = data.claims || [];
      const body = rows.length
        ? h('div', { class: 'list' }, ...rows.map(claimRow))
        : h('div', { class: 'empty' }, '还没有人认领');

      modal('认领记录（问答原文仅拾主可见）', body,
        [h('button', { class: 'btn', onclick: (e) => e.target.closest('.modal-back').remove() }, '关闭')]);
    } catch (err) { toast(err.message, 'err'); }
  }
}
