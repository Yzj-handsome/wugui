/* 首页：找物品（效果图主体）
   搜索区 + 筛选区 + 结果卡片区，SSE 分阶段更新（§11.4）。 */

import { api, streamPreview, compressImage } from '../api.js?v=202610171048';
import {
  h, mount, icon, toast, matchCard, skeletonCards, emptyState, select, campusArt,
  tierBadge, fmtPercent, locationPicker,
} from '../ui.js?v=202610171048';
import { state, refreshUser, openAgent } from '../app.js?v=202610171048';

const EXAMPLES = {
  lost: [
    '周二下午在图书馆三楼丢了一副黑色蓝牙耳机，充电盒一起丢的',
    '五教上课落在教室一个深色保温杯，杯底有刻字',
    '在二食堂丢了一把蓝色折叠伞',
  ],
  found: [
    '图书馆三楼自习区捡到一副黑色无线耳机，带充电盒',
    '操场看台捡到一个灰色水杯',
    '在逸夫楼捡到一张校园卡',
  ],
};

export async function renderHome(main) {
  const session = { kind: 'lost', text: '', images: [], parsed: null, matches: [], analyzed: 0 };

  /* ---------- Hero ---------- */
  const heroInner = h('div', { class: 'hero__inner' },
    h('h1', { class: 'hero__title' }, '把遗失的，找回来。'),
    h('p', { class: 'hero__desc' }, '描述、上传照片，AI 帮你从珞珈山的失物线索里找到可能匹配的物品。'),
    composer(),
  );
  const hero = h('section', { class: 'hero' }, heroInner, h('div', { class: 'hero__art' }, campusArt()));

  /* ---------- 结果区 ---------- */
  const resultsHead = h('div', { class: 'results__head' });
  const cards = h('div', { class: 'cards' });
  const resultsCol = h('div', {}, resultsHead, cards);
  const filterPanel = buildFilterPanel(session, reload);
  const layout = h('div', { class: 'layout' }, filterPanel, resultsCol);
  const body = h('div', { class: 'wrap' }, h('div', { class: 'section' }, layout));

  main.append(hero, body);

  /* ---------- 逻辑 ---------- */
  function composer() {
    const input = h('input', {
      placeholder: EXAMPLES[session.kind][0],
      autocomplete: 'off',
      oninput: () => { session.text = input.value; },
      onkeydown: (e) => { if (e.key === 'Enter') submit(); },
    });
    const thumbs = h('div', { class: 'thumb-row' });
    const preview = h('div', { class: 'composer__preview', hidden: true });
    const parsedBox = h('div', { class: 'chips', style: 'margin-top:10px' });
    const hints = h('div', { class: 'composer__hint' });
    const file = h('input', { type: 'file', accept: 'image/*', multiple: true, hidden: true });
    const matchBtn = h('button', { class: 'btn btn--primary btn--lg', onclick: submit },
      '开始匹配', icon('arrow'));

    const tabs = h('div', { class: 'composer__tabs' });
    for (const [key, label] of [['lost', '我丢了'], ['found', '我捡到了']]) {
      const tab = h('button', { class: `composer__tab${key === session.kind ? ' is-active' : ''}` }, label);
      tab.addEventListener('click', () => {
        session.kind = key;
        tabs.querySelectorAll('.composer__tab').forEach((t) => t.classList.remove('is-active'));
        tab.classList.add('is-active');
        input.placeholder = EXAMPLES[key][0];
        renderHints();
      });
      tabs.append(tab);
    }

    function renderHints() {
      hints.innerHTML = '';
      hints.append(h('span', { class: 'small muted' }, '试试：'));
      for (const ex of EXAMPLES[session.kind].slice(0, 2)) {
        hints.append(h('button', {
          class: 'chip chip--ghost',
          onclick: () => { input.value = ex; session.text = ex; input.focus(); },
        }, ex.length > 22 ? ex.slice(0, 22) + '…' : ex));
      }
      hints.append(h('button', {
        class: 'linklike small', style: 'margin-left:auto',
        onclick: () => openAgent(input.value || ''),
      }, '或者直接问智能体 →'));
    }
    renderHints();

    async function addImages(files) {
      for (const f of files.slice(0, 3)) {
        if (!f.type.startsWith('image/')) continue;
        try {
          const data = await compressImage(f);
          session.images.push(data);
          const thumb = h('div', { class: 'thumb' },
            h('img', { src: data, alt: '上传的照片' }),
            h('button', { onclick: () => { session.images = session.images.filter((x) => x !== data); thumb.remove(); sync(); } }, '×'));
          thumbs.append(thumb);
        } catch (err) { toast('图片读取失败：' + err.message, 'err'); }
      }
      sync();
    }
    function sync() {
      preview.hidden = session.images.length === 0;
      if (session.images.length) {
        preview.innerHTML = '';
        preview.append(
          h('div', { class: 'row row--between', style: 'margin-bottom:8px' },
            h('span', { class: 'small muted' }, `已选 ${session.images.length} 张照片（浏览器端已压到长边 1568px）`),
            h('button', { class: 'linklike small', onclick: () => { session.images = []; thumbs.innerHTML = ''; sync(); } }, '全部移除')),
          thumbs);
      }
    }

    file.addEventListener('change', () => { addImages(file.files); file.value = ''; });

    return h('div', { class: 'composer' },
      tabs,
      h('div', { class: 'composer__row' },
        h('label', { class: 'composer__input' }, icon('search'), input),
        h('button', { class: 'btn', onclick: () => file.click() }, icon('image'), '上传照片'),
        matchBtn),
      preview,
      parsedBox,
      hints,
      file,
    );

    function setParsed(parsed) {
      parsedBox.innerHTML = '';
      if (!parsed) return;
      const d = parsed.draft || {};
      const chips = [];
      if (parsed.title) chips.push([parsed.title, '']);
      if (d.category_l2 && d.category_l2 !== '其他') chips.push([`${d.category_l1} / ${d.category_l2}`, '']);
      for (const c of d.colors || []) chips.push([`${c.modifier || ''}${c.name}色`, '']);
      if (d.brand) chips.push([d.brand, '']);
      if (parsed.location) chips.push([parsed.location, '']);
      if (d.time_expr) chips.push([d.time_expr, '']);
      for (const low of parsed.low_conf || []) chips.push([`${low} 需确认`, 'chip--warn']);
      parsedBox.append(h('span', { class: 'small muted' }, 'AI 理解：'));
      for (const [text, cls] of chips) parsedBox.append(h('span', { class: `chip ${cls}` }, text));
      parsedBox.append(h('span', {
        class: 'chip chip--ghost', title: '点这里去发布页补充字段',
        onclick: () => { location.hash = '#/post'; },
        style: 'cursor:pointer',
      }, '不对？去发布页改'));
    }

    async function submit() {
      session.text = input.value.trim();
      if (!session.text && !session.images.length) {
        toast('先描述一下，或上传一张照片', 'err');
        input.focus();
        return;
      }
      matchBtn.disabled = true;
      matchBtn.textContent = '匹配中…';
      resultsHead.innerHTML = '';
      mount(resultsHead, 
        h('h2', {}, '为你找到的线索'),
        h('span', { class: 'results__meta' }, '正在理解你的描述…'));
      cards.innerHTML = '';
      cards.append(...skeletonCards(3));

      try {
        await streamPreview(
          { kind: session.kind, text: session.text, image_keys: session.images, filters: session.filters || {} },
          {
            stage: (d) => { resultsHead.lastChild.textContent = d.message; },
            parsed: (d) => {
              session.parsed = d;
              setParsed(d);
              resultsHead.lastChild.textContent = `AI 理解：${d.title || '…'}`;
            },
            recalled: (d) => {
              session.analyzed = d.analyzed_count;
              resultsHead.lastChild.textContent = `已分析 ${d.analyzed_count} 条线索`;
            },
            results: (d) => {
              session.matches = d.matches || [];
              drawResults();
            },
            reviewed: (d) => {
              const m = session.matches.find((x) => x.id === d.id);
              if (m) { m.tier = d.tier; m.conflicts = d.conflicts; }
              drawResults();
            },
          });
      } catch (err) {
        toast(err.message, 'err');
        cards.innerHTML = '';
        cards.append(emptyState('匹配没成功', err.message));
      } finally {
        matchBtn.disabled = false;
        matchBtn.innerHTML = '';
        matchBtn.append('开始匹配', icon('arrow'));
      }
    }

    function drawResults() {
      const onlyHigh = filterPanel.dataset.onlyHigh === '1';
      let list = session.matches.slice();
      if (onlyHigh) list = list.filter((m) => m.tier === 'high');
      resultsHead.innerHTML = '';
      mount(resultsHead, 
        h('h2', {}, session.kind === 'lost' ? '为你找到的线索' : '可能的主人在找你'),
        h('span', { class: 'results__meta' },
          `已分析 ${session.analyzed} 条线索 · 展示 ${list.length} 条`),
        session.images.length ? h('span', { class: 'chip' }, '已用照片参与匹配') : null,
      );
      cards.innerHTML = '';
      if (!list.length) {
        cards.append(emptyState(
          onlyHigh ? '暂时没有「高度相似」的线索' : '暂时没有匹配到线索',
          '开启关键词下方的开关可以看全部候选；也建议补充颜色、品牌或更具体的地点。',
          h('button', { class: 'btn btn--primary', style: 'margin-top:14px', onclick: () => { location.hash = '#/post'; } }, '把这条信息发布出去'),
        ));
        return;
      }
      for (const m of list) cards.append(matchCard(m, { showScore: true }));
    }
  }

  /* ---------- 筛选面板 ---------- */
  function buildFilterPanel(session, onChange) {
    const panel = h('aside', { class: 'panel' });
    panel.dataset.onlyHigh = '0';
    const meta = state.meta || { locations: [], categories: {} };
    const catOpts = [['', '全部类别'], ...Object.keys(meta.categories || {}).map((k) => [k, k])];

    const setFilter = (patch) => {
      session.filters = { ...(session.filters || {}), ...patch };
      onChange();
    };

    /* 自定义时间段：选「自定义」后展开起止日期。
       时间按物品的「发生时间」筛（丢了/捡到的时间），不是发布时间。 */
    const fromInput = h('input', {
      class: 'input', type: 'date',
      onchange: (e) => {
        const value = e.target.value;
        if (value && untilInput.value && value > untilInput.value) {
          toast('开始日期不能晚于结束日期', 'err');
          e.target.value = '';
          return;
        }
        setFilter({ date_from: value || undefined });
      },
    });
    const untilInput = h('input', {
      class: 'input', type: 'date',
      onchange: (e) => {
        const value = e.target.value;
        if (value && fromInput.value && value < fromInput.value) {
          toast('结束日期不能早于开始日期', 'err');
          e.target.value = '';
          return;
        }
        setFilter({ date_to: value || undefined });
      },
    });
    const customBox = h('div', { class: 'field', hidden: true },
      h('label', {}, '自定义时间段'),
      h('div', { class: 'date-range' }, fromInput, h('span', { class: 'muted' }, '至'), untilInput),
      h('div', { class: 'form-hint' }, '按物品的发生时间筛选，可只填一端'));

    const daySel = select([
      ['', '不限时间'], ['1', '最近 24 小时'], ['7', '最近 7 天'], ['30', '最近 30 天'],
      ['custom', '自定义时间段…'],
    ], '', (v) => {
      const isCustom = v === 'custom';
      customBox.hidden = !isCustom;
      if (isCustom) {
        setFilter({ days: undefined });
      } else {
        fromInput.value = '';
        untilInput.value = '';
        setFilter({ days: v || undefined, date_from: undefined, date_to: undefined });
      }
      if (isCustom) onChange();
    }, null);

    const locSel = locationPicker({
      tree: meta.tree || [],
      groups: meta.groups || [],
      value: session.filters?.location || '',
      onChange: (v) => { setFilter({ location: v || undefined }); drawRadius(); },
    });

    const catSel = select(catOpts, '', (v) => setFilter({ category_l1: v || undefined }), null);
    const toggle = h('input', {
      type: 'checkbox',
      onchange: () => { panel.dataset.onlyHigh = toggle.checked ? '1' : '0'; onChange(); },
    });

    /* 地理半径：选了地点之后才出现（面板不会整块重建，所以这里手动重绘） */
    const RADII = [[0, '仅本地点'], [300, '300 米内'], [1000, '1 公里内'], [3000, '3 公里内']];
    const radiusRow = h('div', { class: 'chips radius-chips' });
    function drawRadius() {
      radiusRow.innerHTML = '';
      const loc = session.filters?.location;
      radiusRow.hidden = !loc;
      if (!loc) return;
      for (const [value, label] of RADII) {
        radiusRow.append(h('button', {
          class: `chip${Number(session.filters.radius || 0) === value ? ' is-active' : ''}`,
          onclick: () => { setFilter({ radius: value || undefined }); drawRadius(); },
        }, label));
      }
    }
    drawRadius();

    panel.append(
      h('div', { class: 'panel__title' }, icon('filter'), '筛选线索'),
      h('div', { class: 'field' }, h('label', {}, '时间范围'), daySel),
      customBox,
      h('div', { class: 'field' }, h('label', {}, '地点'), locSel, radiusRow),
      h('div', { class: 'field' }, h('label', {}, '物品类别'), catSel),
      h('div', { class: 'switch-row' },
        h('span', { class: 'small' }, '只看高匹配'),
        h('label', { class: 'switch' }, toggle, h('span', { class: 'switch__track' }), h('span', { class: 'switch__thumb' }))),
      h('div', { style: 'margin-top:14px' },
        h('button', { class: 'btn btn--block btn--sm', onclick: () => { location.hash = '#/post'; } }, '发布我的信息')),
      h('div', { style: 'margin-top:8px' },
        h('button', { class: 'btn btn--block btn--sm', onclick: () => openAgent('') }, '问智能体找')),
    );
    return panel;
  }

  /* ---------- 浏览模式：先展示最近的线索 ---------- */
  // 连续改筛选条件时会并发发起多次请求，先发出的可能后返回。
  // 用序号挡掉过期响应，避免旧结果覆盖新结果（实测把这个坑踩出来了）。
  let loadSeq = 0;

  async function reload() {
    const seq = ++loadSeq;
    const filters = { ...(session.filters || {}) };
    const params = { limit: 9, kind: session.kind === 'lost' ? 'found' : 'lost' };
    if (filters.category_l1) params.category_l1 = filters.category_l1;
    if (filters.location) {
      if (filters.radius) {
        // 半径搜索：以所选地点为圆心（服务端复用校园平面坐标）
        params.near = filters.location;
        params.radius = filters.radius;
      } else {
        params.location = filters.location;
      }
    }
    if (filters.date_from) params.date_from = filters.date_from;
    if (filters.date_to) params.date_to = filters.date_to;

    let data;
    try {
      data = await api.items(params);
    } catch (err) {
      if (seq === loadSeq) toast(err.message, 'err');
      return;
    }
    if (seq !== loadSeq) return;   // 已经有更新的请求了，这次结果作废
    let items = data.items || [];
    // 「最近 N 天」在服务端没有对应参数，这里按发生时间补一次前端过滤
    if (filters.days) {
      const cutoff = Date.now() - Number(filters.days) * 86400000;
      items = items.filter((it) => {
        const ref = it.occurred_from || it.created_at;
        return !ref || new Date(ref).getTime() >= cutoff;
      });
    }
    const rangeText = describeRange(filters);
    resultsHead.innerHTML = '';
    mount(resultsHead,
      h('h2', {}, session.kind === 'lost' ? '校园里最近的拾物' : '校园里最近的失物'),
      h('span', { class: 'results__meta' },
        rangeText ? `${data.total} 条 · ${rangeText}` : `${data.total} 条 · 点开看详情，或在上方描述你要找的东西`),
    );
    cards.innerHTML = '';
    if (!items.length) {
      cards.append(emptyState('这个条件下还没有线索', '换个筛选条件试试，或者直接发布你的信息。'));
      return;
    }
    for (const it of items) {
      cards.append(matchCard({
        id: it.id, item: it, score: 0, tier: null, explain: [], channels: [],
      }, { showScore: false }));
    }
  }

  function describeRange(filters) {
    if (filters.date_from || filters.date_to) {
      const from = filters.date_from ? filters.date_from.slice(5) : '最早';
      const to = filters.date_to ? filters.date_to.slice(5) : '现在';
      return `时间范围 ${from} 至 ${to}`;
    }
    if (filters.days) return `最近 ${filters.days} 天`;
    return '';
  }

  await reload();
}
