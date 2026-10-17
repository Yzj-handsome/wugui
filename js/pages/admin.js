/* 数据看板
   设计原则：先给结论、再给证据、细节收进折叠区。
   四个核心指标 → 发布与找回 → 认领与安全 → 校园分布 → （折叠）系统细节 */

import { api } from '../api.js?v=202610171048';
import {
  h, mount, icon, lineChart, funnelChart, heatmap, legend, fmtPercent, emptyState,
} from '../ui.js?v=202610171048';

export async function renderAdmin(main) {
  const wrap = h('div', { class: 'wrap' });
  main.append(h('div', { class: 'section' }, wrap));

  const head = h('div', { class: 'dash__head' });
  const body = h('div', {});
  wrap.append(head, body);

  async function load() {
    body.innerHTML = '';
    body.append(h('div', { class: 'kpis' },
      ...Array.from({ length: 4 }, () => h('div', { class: 'skeleton', style: 'height:118px' }))));

    let data;
    try {
      data = await api.metrics(14);
    } catch (err) {
      body.innerHTML = '';
      body.append(emptyState('看板没加载出来', err.message,
        h('button', { class: 'btn btn--primary', style: 'margin-top:12px', onclick: load }, '重试')));
      return;
    }

    drawHead();
    body.innerHTML = '';
    body.append(sectionResults(data), sectionTrend(data), sectionClaim(data),
      sectionCampus(data), sectionSystem());
    loadSystem();
  }

  function drawHead() {
    head.innerHTML = '';
    mount(head,
      h('div', {},
        h('h1', {}, '数据看板'),
        h('p', { class: 'dash__sub' }, '近 14 天 · 指标直接来自 items 与 events，不另设埋点系统')),
      h('div', { class: 'dash__actions' },
        h('span', { class: 'chip chip--muted' }, `更新于 ${new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}`),
        h('button', { class: 'btn btn--sm', onclick: load }, icon('check'), '刷新')),
    );
  }

  /* ---------------- ① 运营结果 ---------------- */
  function sectionResults(data) {
    const get = (key) => data.cards.find((c) => c.key === key) || {};
    const items = get('items');
    const match = get('match_rate');
    const ret = get('return_rate');
    const hours = get('return_hours');

    const kpi = ({ label, value, unit, hint, meter, tone = 'confirm', delta }) =>
      h('div', { class: `kpi kpi--${tone}` },
        h('div', { class: 'kpi__label' }, label),
        h('div', { class: 'kpi__value' }, value, unit ? h('span', {}, unit) : null),
        h('div', { class: 'kpi__hint' }, hint),
        delta !== undefined && delta !== null
          ? h('div', { class: `kpi__delta kpi__delta--${delta >= 0 ? 'up' : 'down'}` },
              `${delta >= 0 ? '+' : ''}${delta} 条较上一周期`)
          : null,
        meter === undefined ? null
          : h('div', { class: `kpi__meter kpi__meter--${tone}` },
              h('i', { style: `width:${Math.max(2, Math.min(100, Math.round(meter * 100)))}%` })),
      );

    return section('运营结果', '最关心的四个数：库里的量、能匹配上多少、找回了多少、花多久',
      h('div', { class: 'kpis' },
        kpi({
          label: '在架线索', value: items.value ?? 0, unit: '条',
          hint: items.hint || '', tone: 'confirm',
          meter: Math.min(1, (items.value || 0) / 60),
        }),
        kpi({
          label: '匹配率', value: fmtPercent(match.value), hint: match.hint || '',
          tone: 'confirm', meter: match.value,
        }),
        kpi({
          label: '找回率', value: fmtPercent(ret.value), hint: ret.hint || '',
          tone: 'high', meter: ret.value,
        }),
        kpi({
          label: '找回耗时中位数', value: (hours.value ?? 0).toFixed(1), unit: '小时',
          hint: hours.hint || '', tone: 'weak',
          meter: Math.min(1, (hours.value || 0) / 72),
        }),
      ));
  }

  /* ---------------- ② 发布与找回 ---------------- */
  function sectionTrend(data) {
    const daily = data.daily || [];
    const total = { lost: daily.reduce((a, d) => a + d.lost, 0), found: daily.reduce((a, d) => a + d.found, 0) };

    const trend = card('每日发布量', `失物 ${total.lost} 条 · 拾物 ${total.found} 条`,
      lineChart(daily, { width: 760, height: 230 }),
      h('div', { class: 'legend' },
        h('span', { class: 'row', style: 'gap:6px' },
          h('i', { style: 'width:14px;height:3px;background:#2563eb;display:inline-block;border-radius:2px' }), '失物'),
        h('span', { class: 'row', style: 'gap:6px' },
          h('i', { style: 'width:14px;height:3px;background:#10b981;display:inline-block;border-radius:2px' }), '拾物'),
      ));

    const cats = data.categories || [];
    const maxCat = Math.max(1, ...cats.map((c) => c.value));
    const catCard = card('一级品类分布', `共 ${cats.reduce((a, c) => a + c.value, 0)} 条记录`,
      cats.length
        ? h('div', { class: 'bars' }, ...cats.slice(0, 7).map((c) => h('div', { class: 'bar-row' },
            h('div', {}, c.name),
            h('div', { class: 'bar-row__track' },
              h('div', { class: 'bar-row__fill', style: `width:${(c.value / maxCat) * 100}%` })),
            h('div', { class: 'bar-row__value' }, c.value))))
        : emptyState('还没有数据', ''));

    return section('发布与找回', '发布节奏、物品构成',
      h('div', { class: 'dash__grid dash__grid--2' }, trend, catCard));
  }

  /* ---------------- ③ 认领与安全 ---------------- */
  function sectionClaim(data) {
    const funnel = (data.funnel || []).filter((f) => f.name !== '被拒绝');
    const rejected = (data.funnel || []).find((f) => f.name === '被拒绝') || { value: 0 };
    const started = (data.funnel || []).find((f) => f.name === '发起认领') || { value: 0 };
    const intercept = data.cards.find((c) => c.key === 'intercept') || {};

    const funnelCard = card('认领流程', '发起认领 → 通过验证 → 完成交接',
      funnel.length && started.value
        ? funnelChart(funnel, { width: 420, height: 200 })
        : emptyState('还没有人认领', '发布拾物后就会有人来认领'),
      h('div', { class: 'muted-line', style: 'margin-top:4px' },
        `被拒绝（判定为冒领）：${rejected.value} 次`));

    const interceptCard = card('防冒领', '验证环节拦下多少可疑认领',
      h('div', { class: 'kpi__value', style: 'margin:10px 0 4px' }, fmtPercent(intercept.value)),
      h('div', { class: 'kpi__hint' }, intercept.hint || ''),
      h('div', { class: 'kpi__meter kpi__meter--high', style: 'margin-top:14px' },
        h('i', { style: `width:${Math.round((intercept.value || 0) * 100)}%` })),
      h('div', { class: 'muted-line', style: 'margin-top:14px' },
        '认领必须答对只有真主人知道的细节题，答案来自拾主照片里不公开的特征。'));

    const tiers = data.tiers || [];
    const tierCard = card('档位精确率', '各档位中用户点「是我的」的比例',
      h('table', { class: 'data' },
        h('thead', {}, h('tr', {},
          h('th', {}, '档位'), h('th', { class: 'num' }, '候选'),
          h('th', { class: 'num' }, '已反馈'), h('th', { class: 'num' }, '精确率'))),
        h('tbody', {}, ...tiers.map((t) => h('tr', {},
          h('td', {}, h('span', { class: `badge badge--${t.tier} badge--dot` }, t.label)),
          h('td', { class: 'num' }, t.count || 0),
          h('td', { class: 'num' }, t.total || 0),
          h('td', { class: 'num' }, t.precision == null ? '—' : fmtPercent(t.precision)))))),
      h('div', { class: 'muted-line', style: 'margin-top:8px' },
        '用户点的「不是我的」同时会作为排序模型的负样本。'));

    return section('认领与安全', '防冒领效果与匹配档位的可信度',
      h('div', { class: 'dash__grid dash__grid--3' }, funnelCard, interceptCard, tierCard));
  }

  /* ---------------- ④ 校园分布 ---------------- */
  function sectionCampus(data) {
    const locs = data.locations || [];
    const locCard = card('地点热力', '丢失与拾获次数最多的地点',
      locs.length
        ? h('table', { class: 'data' },
            h('thead', {}, h('tr', {}, h('th', {}, '地点'), h('th', { class: 'num' }, '次数'))),
            h('tbody', {}, ...locs.slice(0, 8).map((l) => h('tr', {},
              h('td', {}, l.name), h('td', { class: 'num' }, l.value)))))
        : emptyState('还没有数据', ''));

    const heatCard = card('时段热力', '星期 × 小时的发布量，颜色越深越多',
      heatmap(data.hours || []), legend());

    return section('校园分布', '保卫处最关心的两个视角：哪里丢得多、什么时候丢得多',
      h('div', { class: 'dash__grid dash__grid--wide' }, heatCard, locCard));
  }

  /* ---------------- ⑤ 系统细节（折叠） ---------------- */
  function sectionSystem() {
    const details = h('details', { class: 'dash__more' },
      h('summary', {}, '系统与模型细节'),
      h('div', { class: 'dash__more-body' }, h('div', { class: 'skeleton', style: 'height:120px' })));
    return details;
  }

  async function loadSystem() {
    const box = body.querySelector('.dash__more-body');
    if (!box) return;
    const [overview, models, msgs, fields, latency] = await Promise.all([
      api.overview().catch(() => null),
      api.modelStatus().catch(() => null),
      api.messages().catch(() => ({ messages: [] })),
      api.fieldFeedback().catch(() => ({ fields: [] })),
      api.metrics(14).catch(() => null),
    ]);

    box.innerHTML = '';
    const cards = [];

    if (models) {
      const m = models.models || {};
      cards.push(card('模型与依赖', '当前实际加载的组件',
        h('table', { class: 'data' },
          h('tbody', {},
            row('文本向量', `${m.text_backend} · ${m.text_dim} 维`),
            row('图文向量', m.clip ? 'CLIP ViT-B/32 已加载' : '未加载（用颜色/形态描述符兜底）'),
            row('重排', m.reranker ? '交叉编码器' : '特征线性打分'),
            row('视觉语言模型', m.vlm_model || m.vlm),
            row('OCR', m.ocr),
            row('群消息分类器', models.classifier && models.classifier.active
              ? `已训练（${models.classifier.samples} 条样本）`
              : '关键词规则'),
            row('排序模型', models.ranker && models.ranker.active
              ? `已训练（AUC ${models.ranker.auc}）`
              : '人工权重（标注样本不足）')))));
    }

    if (latency) {
      cards.push(card('分阶段延迟', 'P50 / P95，单位毫秒',
        h('table', { class: 'data' },
          h('thead', {}, h('tr', {},
            h('th', {}, '阶段'), h('th', { class: 'num' }, 'P50'), h('th', { class: 'num' }, 'P95'))),
          h('tbody', {}, ...(latency.pipeline || []).map((r) => h('tr', {},
            h('td', {}, r.stage),
            h('td', { class: 'num' }, r.p50 || '—'),
            h('td', { class: 'num' }, r.p95 || '—')))))));
    }

    if (overview) {
      cards.push(card('运营待办', '需要人工介入的事项',
        h('table', { class: 'data' },
          h('tbody', {},
            row('待确认发布', overview.pending_items),
            row('待裁决认领', overview.pending_claims),
            row('即将过期', overview.expiring_soon),
            row('风控冻结账号', overview.frozen_users),
            row('字段级修正标注', overview.field_edits))))); 
    }

    if (fields.fields && fields.fields.length) {
      cards.push(card('AI 抽取修正率', '用户改动 AI 所填字段的比例',
        h('table', { class: 'data' },
          h('thead', {}, h('tr', {}, h('th', {}, '字段'), h('th', { class: 'num' }, '次数'), h('th', { class: 'num' }, '占比'))),
          h('tbody', {}, ...fields.fields.slice(0, 6).map((f) => h('tr', {},
            h('td', {}, f.field), h('td', { class: 'num' }, f.count),
            h('td', { class: 'num' }, fmtPercent(f.rate))))))));
    }

    if (msgs.messages && msgs.messages.length) {
      const labelText = { lost: '失物', found: '拾物', returned: '已找回', irrelevant: '无关' };
      cards.push(card('群消息采集', '两级分类后的落库情况；无关消息不落盘',
        h('table', { class: 'data' },
          h('thead', {}, h('tr', {}, h('th', {}, '来源'), h('th', {}, '内容'), h('th', {}, '判定'))),
          h('tbody', {}, ...msgs.messages.slice(0, 6).map((m) => h('tr', {},
            h('td', { class: 'small muted' }, m.channel_id || m.source),
            h('td', { class: 'small' }, (m.text || '').slice(0, 26)),
            h('td', {}, h('span', { class: 'badge badge--plain' }, labelText[m.label] || m.label || '—'))))))));
    }

    if (!cards.length) {
      box.append(h('div', { class: 'muted-line' }, '暂时没有更多细节'));
      return;
    }
    box.append(h('div', { class: 'dash__grid dash__grid--even' }, ...cards));
  }

  function row(label, value) {
    return h('tr', {}, h('td', { class: 'muted' }, label), h('td', {}, String(value ?? '—')));
  }

  await load();
}

/* 统一的区块外壳 */
function section(title, sub, content) {
  return h('section', { class: 'dash__section' },
    h('div', { class: 'dash__section-head' }, h('h2', {}, title), h('span', {}, sub)),
    content);
}

/* 统一的图表卡 */
function card(title, sub, ...children) {
  return h('div', { class: 'chart-card' },
    h('h3', {}, title),
    sub ? h('div', { class: 'chart-card__sub' }, sub) : null,
    ...children);
}
