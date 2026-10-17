/* 认领页：逐题作答 → 结论 → 交接码（§9、§11.2） */

import { api, compressImage } from '../api.js?v=202610171027';
import { h, icon, toast, field, contactCard } from '../ui.js?v=202610171027';
import { state } from '../app.js?v=202610171027';

export async function renderClaim(main, ctx) {
  const claimId = ctx.params[0];
  const wrap = h('div', { class: 'wrap wrap--tight' });
  main.append(h('div', { class: 'section' }, wrap));

  let claim;
  try {
    claim = await api.claim(claimId);
  } catch (err) {
    wrap.append(h('div', { class: 'empty' }, h('strong', {}, '找不到这次认领'), h('div', {}, err.message)));
    return;
  }

  function header(title, sub) {
    return h('div', { style: 'margin-bottom:18px' },
      h('div', { class: 'row', style: 'margin-bottom:6px' },
        h('button', { class: 'btn btn--ghost btn--sm', onclick: () => { location.hash = `#/items/${claim.item.id}`; } }, '← 回到线索'),
        h('span', { class: 'badge badge--plain' }, `认领 ${claim.claim_id.slice(0, 8)}`)),
      h('h1', { style: 'font-size:23px;margin:0 0 6px' }, title),
      h('p', { class: 'muted', style: 'margin:0' }, sub),
    );
  }

  function itemStrip() {
    const item = claim.item;
    return h('div', { class: 'panel row', style: 'gap:14px;align-items:flex-start;margin-bottom:18px' },
      item.cover_url ? h('img', {
        src: item.cover_url, alt: item.title,
        style: 'width:110px;aspect-ratio:4/3;object-fit:cover;border-radius:12px;border:1px solid var(--border)',
      }) : null,
      h('div', { class: 'grow' },
        h('div', { class: 'strong' }, item.title),
        h('div', { class: 'small muted' }, `${item.location || ''} · ${item.occurred_text || ''}`),
        h('div', { class: 'chips', style: 'margin-top:8px' },
          h('span', { class: 'chip chip--muted' }, `${item.category_l1 || ''}/${item.category_l2 || ''}`),
          (item.colors || []).map((c) => h('span', { class: 'chip chip--muted' }, c + '色'))),
      ),
    );
  }

  /* ---------------- 状态：待作答 ---------------- */
  if (claim.status === 'verifying' && claim.result !== 'reject') {
    if (!claim.questions || claim.questions.length < 2) {
      wrap.append(
        header('这件物品需要人工裁决', '系统没能从照片里找到足够独特的细节，请尽量描述你的物品特征，或上传旧照片。'),
        itemStrip(),
        h('div', { class: 'panel stack' },
          field('详细描述', h('textarea', { class: 'textarea', id: 'manualDesc', placeholder: '例如：耳机盒是黑色的，背面贴了一张黄色皮卡丘贴纸，合页一侧有个磕痕…' })),
          h('div', { class: 'form-note' }, icon('shield'), '回答会转交拾主人工确认；拾主看不到你的个人联系方式。'),
          h('button', { class: 'btn btn--primary', onclick: submitManual }, '提交给拾主裁决'),
        ),
      );
      return;
    }

    const answers = {};
    const qList = h('div', { class: 'q-list' });
    claim.questions.forEach((q, i) => {
      const input = h('textarea', {
        class: 'textarea',
        placeholder: '用自己的话回答，越具体越好（不超过 60 字）',
        oninput: (e) => { answers[q.id] = e.target.value; },
      });
      qList.append(h('div', { class: 'q-item' },
        h('div', { class: 'q-item__text' }, h('span', { class: 'q-item__idx' }, i + 1), q.text),
        input,
      ));
    });

    const evidence = [];
    const thumbs = h('div', { class: 'thumb-row', style: 'margin-top:10px' });
    const file = h('input', { type: 'file', accept: 'image/*', hidden: true });
    file.addEventListener('change', async () => {
      const f = file.files[0];
      if (!f) return;
      try {
        const data = await compressImage(f, 1024, 0.8);
        evidence.push(data);
        thumbs.append(h('div', { class: 'thumb' }, h('img', { src: data, alt: '旧照片' })));
      } catch (err) { toast(err.message, 'err'); }
      file.value = '';
    });

    wrap.append(
      header('答对细节就能证明是你的', `共 ${claim.questions.length} 道题。为保护物品隐私，答错时系统不会提示错在哪一题。`),
      itemStrip(),
      h('div', { class: 'panel stack' },
        h('div', { class: 'form-note' }, icon('shield'),
          '这些问题的答案来自拾主拍的细节图，展示图上看不到。冒领会被记录并冻结认领权限（§9.5）。'),
        qList,
        h('div', {},
          h('div', { class: 'small muted', style: 'margin-bottom:6px' }, '可选：上传旧照片或购买记录佐证'),
          h('button', { class: 'btn btn--sm', onclick: () => file.click() }, icon('image'), '选择照片'),
          thumbs, file),
        h('div', { class: 'row', style: 'margin-top:6px' },
          h('button', { class: 'btn btn--primary btn--lg', onclick: submit }, '提交答案'),
          h('span', { class: 'small muted' }, claim.needs_offline ? '该品类需线下凭校园卡交接' : '通过后可获得 6 位交接码')),
      ),
    );

    async function submit() {
      const payload = claim.questions.map((q) => ({ question_id: q.id, answer: answers[q.id] || '' }));
      if (payload.every((a) => !a.answer.trim())) { toast('至少回答一题', 'err'); return; }
      try {
        const res = await api.answer(claim.claim_id, payload, evidence);
        drawResult(res);
      } catch (err) { toast(err.message, 'err'); }
    }

    async function submitManual() {
      const text = document.getElementById('manualDesc').value.trim();
      if (!text) { toast('请先描述一下', 'err'); return; }
      try {
        const res = await api.answer(claim.claim_id,
          (claim.questions || []).map((q) => ({ question_id: q.id, answer: text })), evidence);
        drawResult(res);
      } catch (err) { toast(err.message, 'err'); }
    }
    return;
  }

  /* ---------------- 状态：已出结论 ---------------- */
  if (claim.status === 'handover') {
    const codeBox = h('div', { class: 'code-box' },
      h('div', {},
        h('div', { class: 'small muted' }, '一次性交接码'),
        h('div', { class: 'code-box__code', id: 'handoverCode' }, '••••••')),
      h('div', { class: 'small muted', style: 'max-width:190px;text-align:right' },
        `有效期至 ${new Date(claim.handover_expires_at).toLocaleDateString()}`),
    );
    const codeInput = h('input', { class: 'input', placeholder: '6 位数字', maxlength: 6 });
    wrap.append(
      header('验证通过，可以交接了', '把交接码出示给拾主或失物招领点，核销后物品即转为已归还。'),
      itemStrip(),
      h('div', { class: 'panel stack' },
        codeBox,
        h('div', { class: 'form-note' }, icon('shield'),
          '出于安全考虑库里只存交接码的哈希，忘记时请重新生成一份（旧码立即失效）。'),
        h('button', {
          class: 'btn btn--sm',
          onclick: async () => {
            try {
              const r = await api.regenerateCode(claim.claim_id);
              document.getElementById('handoverCode').textContent = r.handover_code;
              toast('已生成新的交接码', 'ok');
            } catch (err) { toast(err.message, 'err'); }
          },
        }, '生成 / 重新生成交接码'),
        /* 验证通过后双方要线下交接，这时给出拾主联系方式（§9.4） */
        claim.owner_contact
          ? h('div', {},
              h('div', { class: 'strong', style: 'margin-bottom:8px' }, '联系拾主约定交接'),
              contactCard(claim.owner_contact, true, '', '把交接码出示给拾主或失物招领点即可核销'))
          : null,
        claim.needs_offline
          ? h('div', { class: 'form-note' }, icon('shield'), '该品类属于高价值物品，请到失物招领点凭校园卡交接。')
          : null,
        h('div', { style: 'border-top:1px solid var(--border);padding-top:14px' },
          h('div', { class: 'strong', style: 'margin-bottom:8px' }, '拾主 / 工作人员核销'),
          h('div', { class: 'row' }, codeInput,
            h('button', {
              class: 'btn btn--primary',
              onclick: async () => {
                try {
                  const r = await api.handover(claim.claim_id, codeInput.value.trim());
                  toast(r.message, 'ok');
                  setTimeout(() => { location.hash = '#/inbox'; }, 800);
                } catch (err) { toast(err.message, 'err'); }
              },
            }, '核销')),
          h('div', { class: 'form-hint', style: 'margin-top:8px' }, '核销后留 48 小时争议窗口（§9.4）。')),
      ),
    );
    return;
  }

  /* 已拒绝 / 待裁决 */
  const isRejected = claim.status === 'rejected';
  const isReview = claim.status === 'pending_review';
  wrap.append(
    header(
      isRejected ? '验证未通过' : isReview ? '已转交拾主裁决' : '认领已结束',
      isRejected
        ? '为保护物品隐私，系统不会提示具体错在哪一题。冷却 24 小时后可以再试一次（每人每件最多 2 次）。'
        : isReview
          ? '你的回答已转交拾主，等待对方确认后即可获得交接码。'
          : '这次认领已经结束。',
    ),
    itemStrip(),
    claim.grades && claim.grades.length
      ? h('div', { class: 'panel' },
          h('div', { class: 'strong', style: 'margin-bottom:10px' }, '你的作答与判分'),
          h('div', { class: 'list' }, ...(claim.questions || []).map((q, i) => {
            const g = (claim.grades || []).find((x) => x.question_id === q.id) || {};
            return h('div', { class: 'q-item' },
              h('div', { class: 'row row--between' },
                h('div', { class: 'q-item__text' }, h('span', { class: 'q-item__idx' }, i + 1), q.text),
                h('span', { class: `verdict verdict--${g.verdict || 'partial'}` },
                  ({ match: '吻合', partial: '部分吻合', mismatch: '不吻合' })[g.verdict] || '未判')),
              h('div', { class: 'small muted' }, g.reason || ''));
          })))
      : null,
    h('div', { class: 'row', style: 'margin-top:16px' },
      h('button', { class: 'btn btn--primary', onclick: () => { location.hash = '#/'; } }, '回到首页'),
      !isRejected ? h('button', { class: 'btn', onclick: () => location.reload() }, '刷新状态') : null),
  );

  function drawResult(res) {
    const labels = { pass: '验证通过', review: '待拾主裁决', reject: '验证未通过' };
    wrap.innerHTML = '';
    wrap.append(
      header(labels[res.result] || '已提交', res.message),
      itemStrip(),
      h('div', { class: 'panel' },
        h('div', { class: 'strong', style: 'margin-bottom:10px' }, '逐题判分（仅显示结论与简要理由）'),
        h('div', { class: 'list' }, ...(res.grades || []).map((g) => {
          const q = (claim.questions || []).find((x) => x.id === g.question_id);
          return h('div', { class: 'q-item' },
            h('div', { class: 'row row--between' },
              h('div', { class: 'q-item__text' }, q ? q.text : g.question_id),
              h('span', { class: `verdict verdict--${g.verdict}` },
                ({ match: '吻合', partial: '部分吻合', mismatch: '不吻合' })[g.verdict] || g.verdict)),
            h('div', { class: 'small muted' }, g.reason));
        })),
        res.handover_code
          ? h('div', { class: 'code-box', style: 'margin-top:14px' },
              h('div', {},
                h('div', { class: 'small muted' }, '一次性交接码'),
                h('div', { class: 'code-box__code' }, res.handover_code)),
              h('div', { class: 'small muted', style: 'max-width:170px;text-align:right' },
                '出示给拾主或失物招领点核销'))
          : null,
        h('div', { class: 'row', style: 'margin-top:16px' },
          h('button', { class: 'btn', onclick: () => { location.hash = '#/inbox'; } }, '去消息中心'),
          h('button', { class: 'btn btn--ghost', onclick: () => location.reload() }, '刷新')),
      ),
    );
    if (res.result === 'pass') toast('验证通过！', 'ok');
  }
}
