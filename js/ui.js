/* UI 工具箱：DOM 构造、图标、角标、卡片、简易 SVG 图表。
   不引入任何前端框架，保持「零构建、秒开」。 */

/* 原生 append 会把 null / undefined 变成字符串 "null" 塞进 DOM。
   模板里到处是 `cond ? el : null`，这里统一挡掉，避免出现莫名的 "null" 文字。 */
const nativeAppend = Element.prototype.append;
Element.prototype.append = function append(...nodes) {
  return nativeAppend.apply(this, nodes.flat(6)
    .filter((n) => n !== null && n !== undefined && n !== false));
};

export const h = (tag, attrs = {}, ...children) => {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === null || v === undefined || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'html') el.innerHTML = v;
    else if (k === 'text') el.textContent = v;
    else if (k === 'dataset') Object.assign(el.dataset, v);
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else if (k === 'value') el.value = v;
    else el.setAttribute(k, v === true ? '' : String(v));
  }
  mount(el, ...children);
  return el;
};

/* 语义化别名：和 h() 的写法保持一致 */
export function mount(parent, ...children) {
  parent.append(...children);
  return parent;
}

export const svg = (path, extra = {}) => {
  const el = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  el.setAttribute('viewBox', '0 0 24 24');
  el.setAttribute('aria-hidden', 'true');
  for (const [k, v] of Object.entries(extra)) el.setAttribute(k, v);
  el.innerHTML = path;
  return el;
};

export const ICONS = {
  search: '<circle cx="11" cy="11" r="7" stroke="currentColor" stroke-width="2" fill="none"/><path d="M16.5 16.5 21 21" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
  image: '<rect x="3" y="4" width="18" height="16" rx="3" stroke="currentColor" stroke-width="1.8" fill="none"/><circle cx="9" cy="10" r="1.8" fill="currentColor"/><path d="M4 17l4.5-4.2 3.2 2.8L15 12l5 5" stroke="currentColor" stroke-width="1.8" fill="none" stroke-linecap="round"/>',
  arrow: '<path d="M5 12h13M13 6l6 6-6 6" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>',
  chevron: '<path d="M9 6l6 6-6 6" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/>',
  pin: '<path d="M12 21s7-6.3 7-11a7 7 0 10-14 0c0 4.7 7 11 7 11z" stroke="currentColor" stroke-width="1.8" fill="none"/><circle cx="12" cy="10" r="2.6" stroke="currentColor" stroke-width="1.8" fill="none"/>',
  clock: '<circle cx="12" cy="12" r="8.5" stroke="currentColor" stroke-width="1.8" fill="none"/><path d="M12 7.5V12l3 2" stroke="currentColor" stroke-width="1.8" fill="none" stroke-linecap="round"/>',
  filter: '<path d="M4 6h16M7 12h10M10 18h4" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/>',
  grid: '<rect x="4" y="4" width="7" height="7" rx="2" stroke="currentColor" stroke-width="1.8" fill="none"/><rect x="13" y="4" width="7" height="7" rx="2" stroke="currentColor" stroke-width="1.8" fill="none"/><rect x="4" y="13" width="7" height="7" rx="2" stroke="currentColor" stroke-width="1.8" fill="none"/><rect x="13" y="13" width="7" height="7" rx="2" stroke="currentColor" stroke-width="1.8" fill="none"/>',
  calendar: '<rect x="3.5" y="5" width="17" height="16" rx="3" stroke="currentColor" stroke-width="1.8" fill="none"/><path d="M3.5 10h17M8 3v4M16 3v4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
  upload: '<path d="M12 16V5m0 0L8 9m4-4 4 4" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/><path d="M4 15v3a2 2 0 002 2h12a2 2 0 002-2v-3" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7" stroke="currentColor" stroke-width="2.2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>',
  close: '<path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/>',
  bell: '<path d="M6 9a6 6 0 1112 0c0 4 1.5 5.5 1.5 5.5h-15S6 13 6 9z" stroke="currentColor" stroke-width="1.8" fill="none"/><path d="M10 18a2 2 0 004 0" stroke="currentColor" stroke-width="1.8" fill="none" stroke-linecap="round"/>',
  shield: '<path d="M12 3l7 3v6c0 4.5-3 7.6-7 9-4-1.4-7-4.5-7-9V6l7-3z" stroke="currentColor" stroke-width="1.8" fill="none"/><path d="M9 12.2l2 2 4-4" stroke="currentColor" stroke-width="1.8" fill="none" stroke-linecap="round"/>',
  sparkle: '<path d="M12 4l1.6 4.4L18 10l-4.4 1.6L12 16l-1.6-4.4L6 10l4.4-1.6L12 4z" fill="currentColor"/>',
  message: '<path d="M4 6.5A2.5 2.5 0 016.5 4h11A2.5 2.5 0 0120 6.5v7a2.5 2.5 0 01-2.5 2.5H9l-5 4v-4z" stroke="currentColor" stroke-width="1.8" fill="none" stroke-linejoin="round"/>',
  phone: '<path d="M6.6 3.5h3l1.5 4-2 1.5a12 12 0 006.4 6.4l1.5-2 4 1.5v3a2 2 0 01-2.2 2A17 17 0 014.6 5.7 2 2 0 016.6 3.5z" stroke="currentColor" stroke-width="1.8" fill="none" stroke-linejoin="round"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="3" stroke="currentColor" stroke-width="1.8" fill="none"/><path d="M4 7.5l7.2 5a1.5 1.5 0 001.6 0l7.2-5" stroke="currentColor" stroke-width="1.8" fill="none" stroke-linecap="round"/>',
  lock: '<rect x="5" y="10.5" width="14" height="10" rx="2.5" stroke="currentColor" stroke-width="1.8" fill="none"/><path d="M8.5 10.5V8a3.5 3.5 0 017 0v2.5" stroke="currentColor" stroke-width="1.8" fill="none" stroke-linecap="round"/>',
  box: '<path d="M4 8l8-4 8 4v8l-8 4-8-4V8z" stroke="currentColor" stroke-width="1.8" fill="none"/><path d="M4 8l8 4 8-4M12 12v8" stroke="currentColor" stroke-width="1.8" fill="none"/>',
};

export const icon = (name, cls) =>
  svg(ICONS[name] || '', { class: cls ? `ic ${cls}` : 'ic' });

/* ---------------- 提示 ---------------- */

export function toast(message, kind = '') {
  const box = document.getElementById('toasts');
  const el = h('div', { class: `toast ${kind ? 'toast--' + kind : ''}` }, message);
  box.append(el);
  setTimeout(() => { el.style.opacity = '0'; el.style.transition = 'opacity .3s'; }, 2600);
  setTimeout(() => el.remove(), 3000);
}

/* ---------------- 通用片段 ---------------- */

export const TIER_TEXT = { high: '高度相似', confirm: '需要你确认', weak: '可能相关' };

export function tierBadge(tier) {
  if (!tier || tier === 'hidden') return null;
  return h('span', { class: `badge badge--${tier} badge--dot` }, TIER_TEXT[tier] || tier);
}

export const fmtPercent = (v) => `${Math.round((v || 0) * 100)}%`;

export function fmtTime(value) {
  if (!value) return '';
  // 后端存的是「无时区的 UTC」，浏览器会当成本地时间解析（差 8 小时）。
  // 没有时区标记的字符串统一补一个 Z。
  const text = String(value);
  const iso = /(Z|[+-]\d{2}:?\d{2})$/.test(text) ? text : `${text}Z`;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return '刚刚';
  if (diff < 3600) return `${Math.floor(diff / 60)} 分钟前`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} 小时前`;
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)} 天前`;
  return `${d.getMonth() + 1}月${d.getDate()}日`;
}

export const sourceText = {
  web: '网页', qq_group: 'QQ 群', wall: '表白墙', admin: '管理端',
  wechat_paste: '微信粘贴',
};

/* 线索卡片（效果图里的 MatchCard） */
export function matchCard(match, opts = {}) {
  const item = match.item;
  const cover = item.cover_url || '';
  const badge = tierBadge(match.tier);
  const card = h('article', { class: 'card', dataset: { id: item.id } },
    h('div', { class: 'card__media' },
      cover
        ? h('img', { src: cover, alt: item.canonical_desc || item.title, loading: 'lazy' })
        : h('div', { class: 'skeleton', style: 'width:100%;height:100%' }),
      badge ? h('div', { class: 'card__badge' }, badge) : null,
    ),
    h('div', { class: 'card__body' },
      h('h3', { class: 'card__title' }, h('span', {}, item.title || '未识别物品'), icon('chevron')),
      h('div', { class: 'card__meta' },
        h('span', {}, icon('pin'), item.location || '地点待补充'),
        h('span', {}, icon('clock'), item.occurred_text || fmtTime(item.created_at)),
      ),
      match.explain && match.explain.length
        ? h('div', { class: 'card__explain' }, h('b', {}, '相似点：'), match.explain.join(' · '))
        : null,
      opts.showScore
        ? h('div', { class: 'card__score' },
            `相似度 ${fmtPercent(match.score)}`,
            h('div', { class: 'card__bar', style: 'flex:1' },
              h('i', { style: `width:${Math.round((match.score || 0) * 100)}%` })))
        : null,
    ),
  );
  card.addEventListener('click', () => {
    if (opts.onOpen) opts.onOpen(item.id, match);
    else { location.hash = `#/items/${item.id}`; }
  });
  card.style.cursor = 'pointer';
  return card;
}

export function skeletonCards(n = 6) {
  return Array.from({ length: n }, () => h('div', { class: 'skeleton skeleton-card' }));
}

export function emptyState(title, desc, action) {
  return h('div', { class: 'empty' }, h('strong', {}, title), h('div', {}, desc), action || null);
}

export function field(labelText, control, hint, low = false) {
  return h('div', { class: `form-field${low ? ' form-field--low' : ''}` },
    h('label', {}, labelText, low ? h('span', { class: 'chip chip--warn', style: 'margin-left:6px' }, 'AI 不确定') : null),
    control,
    hint ? h('div', { class: 'form-hint' }, hint) : null,
  );
}

/* 手机号脱敏：13812345678 → 138****5678 */
export function maskPhone(value) {
  const v = String(value || '');
  return v.length === 11 ? `${v.slice(0, 3)}****${v.slice(7)}` : v;
}

/* ---------------- 表单字段规则（登录/注册、发布页共用） ---------------- */

export const REG_RULES = {
  phone: (v) => /^1[3-9]\d{9}$/.test(v) || '手机号格式不正确（11 位数字，1 开头）',
  real_name: (v) => /^[\u4e00-\u9fa5A-Za-z][\u4e00-\u9fa5A-Za-z·]{1,19}$/.test(v)
    || '请填 2-20 个中文或字母',
  student_id: (v) => /^[0-9A-Za-z]{6,20}$/.test(v) || '请填 6-20 位数字或字母',
  password: (v) => (v && v.length >= 6 && v.length <= 32 && !/\s/.test(v))
    || '密码 6-32 位，不能有空格',
  qq: (v) => !v || /^[1-9]\d{4,11}$/.test(v) || 'QQ 号格式不正确（5-12 位数字）',
  wechat: (v) => !v || /^[A-Za-z][-_A-Za-z0-9]{5,19}$/.test(v) || '微信号以字母开头，6-20 位',
  email: (v) => !v || /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(v) || '邮箱格式不正确',
};

/* 带「必填 / 选填」标签与行内错误提示的表单字段 */
export function regField(labelText, input, hint, required = false, full = false) {
  const err = h('div', { class: 'form-err', hidden: true });
  input.addEventListener('input', () => {
    err.hidden = true;
    input.classList.remove('input--err');
  });
  const box = h('div', { class: `form-field${full ? ' form-field--full' : ''}` },
    h('label', {}, labelText,
      h('span', { class: required ? 'req' : 'opt' }, required ? '必填' : '选填')),
    input, err,
    hint ? h('div', { class: 'form-hint' }, hint) : null);
  box.setErr = (msg) => {
    if (!msg) return;
    err.textContent = msg;
    err.hidden = false;
    input.classList.add('input--err');
  };
  return box;
}

export function select(options, value, onChange, placeholder) {
  const el = h('select', { class: 'select' });
  if (placeholder) el.append(h('option', { value: '' }, placeholder));
  for (const opt of options) {
    const [v, label] = Array.isArray(opt) ? opt : [opt, opt];
    el.append(h('option', { value: v, selected: String(v) === String(value) }, label));
  }
  if (onChange) el.addEventListener('change', () => onChange(el.value));
  return el;
}

export function modal(title, body, footer) {
  const back = h('div', { class: 'modal-back', onclick: (e) => { if (e.target === back) back.remove(); } },
    h('div', { class: 'modal' },
      h('div', { class: 'modal__head' }, title),
      h('div', { class: 'modal__body' }, body),
      footer ? h('div', { class: 'modal__foot' }, footer) : null,
    ),
  );
  document.body.append(back);
  return back;
}

/* 联系方式展示：有权查看时显示号码，无权时显示一把锁和原因 */
export function contactCard(contact, visible, reason, extra = '') {
  if (visible && contact) {
    const iconName = { phone: 'phone', qq: 'message', wechat: 'message', email: 'mail' }[contact.type] || 'message';
    return h('div', { class: 'contact-card' },
      h('div', { class: 'contact-card__icon' }, icon(iconName)),
      h('div', { class: 'grow' },
        h('div', { class: 'small muted' }, `拾主联系方式 · ${contact.label}`),
        h('div', { class: 'contact-card__value' }, contact.value),
        extra ? h('div', { class: 'form-hint', style: 'margin-top:4px' }, extra) : null),
      h('button', {
        class: 'btn btn--sm',
        onclick: () => {
          navigator.clipboard?.writeText(contact.value);
          toast('已复制联系方式', 'ok');
        },
      }, '复制'),
    );
  }
  return h('div', { class: 'contact-card contact-card--locked' },
    h('div', { class: 'contact-card__icon' }, icon('lock')),
    h('div', { class: 'grow' },
      h('div', { class: 'small muted' }, '联系方式'),
      h('div', { style: 'font-size:13.5px;margin-top:2px' }, reason || '匹配确认后可见')),
  );
}

/* ---------------- 地点选择器（学部 → 区域分组 → 具体地点）---------------- */

/* 把三级树压平成「可搜索的叶子列表」，每项带上所属学部和分组 */
export function flattenLocations(tree) {
  const out = [];
  for (const top of tree || []) {
    const walk = (node, parentName) => {
      const children = node.children || [];
      if (!children.length) {
        out.push({
          name: node.name, parent: parentName, group: node.group,
          aliases: node.aliases || [], keys: node.keys || '', floor: node.floor,
        });
        return;
      }
      for (const child of children) walk(child, parentName || node.name);
    };
    walk(top, top.name);
  }
  return out;
}

/* 搜索用：名称 + 别名 + 后端生成的变体串（含中文/阿拉伯数字两种写法） */
function matchLocation(leaf, keyword) {
  const kw = keyword.toLowerCase();
  if (leaf.name.toLowerCase().includes(kw)) return true;
  if ((leaf.aliases || []).some((a) => a.toLowerCase().includes(kw))) return true;
  return (leaf.keys || '').toLowerCase().includes(kw);
}

/**
 * 分级地点选择器。
 *
 * 左列选学部（或「全部地点」），右列按区域分组列出该学部下的具体地点：
 * 点「工学部」就会看到 教学区：工学部一教、工学部二教… 宿舍区：工学部1舍…
 * 顶部搜索框可以跨学部搜简称（教五、梅一舍、樱花城堡）。
 */
export function locationPicker({ tree, groups = [], value = '', onChange, placeholder = '全部地点' }) {
  const leaves = flattenLocations(tree);
  const topNames = (tree || []).map((t) => t.name);
  let currentTop = '';          // '' = 全部
  let picked = value || '';

  const label = h('span', { class: 'grow' }, picked || placeholder);
  const clearBtn = h('button', {
    class: 'picker__clear', type: 'button', title: '清除地点',
    onclick: (e) => { e.stopPropagation(); select(''); },
  }, '×');
  const trigger = h('button', { class: 'picker__trigger', type: 'button' },
    icon('pin'), label, picked ? clearBtn : null, icon('chevron', 'chev'));

  const search = h('input', { placeholder: '搜索地点，如 教五、梅一舍、樱花城堡', autocomplete: 'off' });
  const colTop = h('div', { class: 'picker__col' });
  const colBody = h('div', { class: 'picker__col' });
  const panel = h('div', { class: 'picker__panel', hidden: true },
    h('div', { class: 'picker__search' }, icon('search'), search),
    h('div', { class: 'picker__cols' }, colTop, colBody));
  const root = h('div', { class: 'picker' }, trigger, panel);

  function select(name) {
    picked = name;
    label.textContent = name || placeholder;
    trigger.querySelectorAll('.picker__clear').forEach((b) => b.remove());
    if (name) trigger.insertBefore(clearBtn, trigger.lastChild);
    panel.hidden = true;
    trigger.classList.remove('is-open');
    onChange?.(name);
  }

  function placeItem(leaf, showParent = false) {
    const sub = showParent ? (leaf.group || leaf.parent) : null;
    return h('button', {
      class: `picker__item${leaf.name === picked ? ' is-picked' : ''}`,
      type: 'button',
      onclick: () => select(leaf.name),
    }, leaf.name, leaf.floor ? h('span', { class: 'sub' }, leaf.floor) : null,
      sub ? h('span', { class: 'sub' }, sub) : null);
  }

  function drawTop() {
    colTop.innerHTML = '';
    colTop.append(h('button', {
      class: `picker__item${currentTop === '' ? ' is-active' : ''}`,
      type: 'button', onclick: () => { currentTop = ''; drawTop(); drawBody(); },
    }, '全部地点'));
    for (const name of topNames) {
      const count = leaves.filter((l) => l.parent === name).length;
      colTop.append(h('button', {
        class: `picker__item${currentTop === name ? ' is-active' : ''}`,
        type: 'button', onclick: () => { currentTop = name; drawTop(); drawBody(); },
      }, name, h('span', { class: 'sub' }, String(count))));
    }
  }

  function drawBody(keyword = '') {
    colBody.innerHTML = '';
    const kw = keyword.trim();
    if (kw) {
      const hit = leaves.filter((l) => matchLocation(l, kw));
      if (!hit.length) {
        colBody.append(h('div', { class: 'picker__empty' }, '没有匹配的地点'));
        return;
      }
      let lastGroup = null;
      for (const leaf of hit.slice(0, 60)) {
        const groupName = `${leaf.parent} · ${leaf.group || '其他'}`;
        if (groupName !== lastGroup) {
          colBody.append(h('div', { class: 'picker__group' }, groupName));
          lastGroup = groupName;
        }
        colBody.append(placeItem(leaf, false));
      }
      return;
    }
    // 未搜索：按区域分组列出（全部地点时按学部再分一层）
    const scope = currentTop ? leaves.filter((l) => l.parent === currentTop) : leaves;
    if (!scope.length) {
      colBody.append(h('div', { class: 'picker__empty' }, '这个学部还没有登记地点'));
      return;
    }
    if (!currentTop) {
      for (const name of topNames) {
        const items = scope.filter((l) => l.parent === name);
        if (!items.length) continue;
        colBody.append(h('div', { class: 'picker__group' }, name));
        for (const leaf of items.slice(0, 8)) colBody.append(placeItem(leaf, true));
        if (items.length > 8) {
          colBody.append(h('button', {
            class: 'picker__item', type: 'button',
            onclick: () => { currentTop = name; drawTop(); drawBody(); },
          }, h('span', { class: 'sub' }, `还有 ${items.length - 8} 个，点这里看全部 →`)));
        }
      }
      return;
    }
    const order = groups.length ? groups : [...new Set(scope.map((l) => l.group))];
    for (const g of order) {
      const items = scope.filter((l) => (l.group || '其他') === g);
      if (!items.length) continue;
      colBody.append(h('div', { class: 'picker__group' }, g));
      for (const leaf of items) colBody.append(placeItem(leaf, false));
    }
  }

  search.addEventListener('input', () => drawBody(search.value));

  /* 视口里放得下就往下开；下面快没地方了就向上弹，并限制列表高度 */
  function placePanel() {
    if (window.matchMedia('(max-width: 560px)').matches) {
      panel.classList.remove('up');
      panel.style.removeProperty('--cols-max');
      return;
    }
    const rect = trigger.getBoundingClientRect();
    const below = window.innerHeight - rect.bottom - 14;
    const above = rect.top - 14;
    const up = below < 360 && above > below;
    panel.classList.toggle('up', up);
    const avail = Math.max(190, Math.min(320, (up ? above : below) - 76));
    panel.style.setProperty('--cols-max', `${Math.round(avail)}px`);
  }

  window.addEventListener('resize', () => { if (!panel.hidden) placePanel(); });

  trigger.addEventListener('click', (e) => {
    e.stopPropagation();
    const willOpen = panel.hidden;
    panel.hidden = !willOpen;
    trigger.classList.toggle('is-open', willOpen);
    if (willOpen) {
      search.value = '';
      drawTop();
      drawBody();
      placePanel();
      search.focus();
    }
  });
  panel.addEventListener('click', (e) => e.stopPropagation());
  document.addEventListener('click', () => {
    panel.hidden = true;
    trigger.classList.remove('is-open');
  });

  drawTop();
  drawBody();
  return root;
}

/* ---------------- 轻量 SVG 图表 ---------------- */

const NS = 'http://www.w3.org/2000/svg';
const s = (tag, attrs = {}) => {
  const el = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  return el;
};

export function lineChart(series, { height = 240, width = 720 } = {}) {
  const pad = { l: 34, r: 14, t: 14, b: 26 };
  const max = Math.max(1, ...series.flatMap((d) => [d.lost || 0, d.found || 0]));
  const iw = width - pad.l - pad.r;
  const ih = height - pad.t - pad.b;
  const root = s('svg', { viewBox: `0 0 ${width} ${height}`, class: 'chart', preserveAspectRatio: 'none' });
  const x = (i) => pad.l + (series.length <= 1 ? 0 : (i * iw) / (series.length - 1));
  const y = (v) => pad.t + ih - (v / max) * ih;
  for (let g = 0; g <= 3; g++) {
    const gy = pad.t + (ih * g) / 3;
    root.append(s('line', { x1: pad.l, x2: width - pad.r, y1: gy, y2: gy, stroke: 'var(--border)', 'stroke-width': 1 }));
    const t = s('text', { x: 4, y: gy + 4, fill: 'var(--text-3)', 'font-size': 10 });
    t.textContent = Math.round((max * (3 - g)) / 3);
    root.append(t);
  }
  const draw = (key, color) => {
    const pts = series.map((d, i) => `${x(i)},${y(d[key] || 0)}`).join(' ');
    root.append(s('polyline', { points: pts, fill: 'none', stroke: color, 'stroke-width': 2.2, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }));
    root.append(s('polygon', { points: `${pad.l},${pad.t + ih} ${pts} ${x(series.length - 1)},${pad.t + ih}`, fill: color, opacity: 0.09 }));
    series.forEach((d, i) => root.append(s('circle', { cx: x(i), cy: y(d[key] || 0), r: 2.6, fill: color })));
  };
  draw('lost', '#2563eb');
  draw('found', '#10b981');
  series.forEach((d, i) => {
    if (series.length > 12 && i % 2) return;
    const t = s('text', { x: x(i), y: height - 8, fill: 'var(--text-3)', 'font-size': 10, 'text-anchor': 'middle' });
    t.textContent = d.label || '';
    root.append(t);
  });
  return root;
}

export function barChart(rows, { height = 220, width = 420, color = '#2563eb' } = {}) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  const root = s('svg', { viewBox: `0 0 ${width} ${height}`, class: 'chart', preserveAspectRatio: 'xMidYMid meet' });
  const rowH = Math.min(30, height / Math.max(1, rows.length));
  rows.forEach((r, i) => {
    const cy = 12 + i * (rowH + 6);
    const label = s('text', { x: 0, y: cy + 11, fill: 'var(--text-2)', 'font-size': 12 });
    label.textContent = (r.name || '').slice(0, 7);
    root.append(label);
    const bx = 76;
    const bw = (width - bx - 44) * (r.value / max);
    root.append(s('rect', { x: bx, y: cy, width: Math.max(2, bw), height: 14, rx: 7, fill: color, opacity: 0.85 }));
    root.append(s('rect', { x: bx, y: cy, width: width - bx - 44, height: 14, rx: 7, fill: 'var(--bg-soft)' }));
    root.append(s('rect', { x: bx, y: cy, width: Math.max(2, bw), height: 14, rx: 7, fill: color, opacity: 0.9 }));
    const val = s('text', { x: width, y: cy + 11, fill: 'var(--text-3)', 'font-size': 12, 'text-anchor': 'end' });
    val.textContent = r.value;
    root.append(val);
  });
  return root;
}

export function funnelChart(steps, { width = 420, height = 200 } = {}) {
  const max = Math.max(1, ...steps.map((st) => st.value));
  const root = s('svg', { viewBox: `0 0 ${width} ${height}`, class: 'chart' });
  const gap = 14;
  const w = (width - gap * (steps.length - 1)) / steps.length;
  const colors = ['#2563eb', '#3b82f6', '#60a5fa', '#a5b4fc'];
  steps.forEach((st, i) => {
    const bh = Math.max(6, (st.value / max) * (height - 54));
    const x = i * (w + gap);
    const y = height - 34 - bh;
    root.append(s('rect', { x, y, width: w, height: bh, rx: 8, fill: colors[i % colors.length], opacity: 0.9 }));
    const v = s('text', { x: x + w / 2, y: y - 6, fill: 'var(--text)', 'font-size': 14, 'font-weight': 600, 'text-anchor': 'middle' });
    v.textContent = st.value;
    root.append(v);
    const n = s('text', { x: x + w / 2, y: height - 14, fill: 'var(--text-3)', 'font-size': 11.5, 'text-anchor': 'middle' });
    n.textContent = st.name;
    root.append(n);
  });
  return root;
}

export function heatmap(cells, { width = 720 } = {}) {
  const days = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];
  const max = Math.max(1, ...cells.map((c) => c.value));
  const root = h('div', { class: 'heat' });
  root.append(h('div', {}));
  for (let hr = 0; hr < 24; hr++) {
    root.append(h('div', { class: 'heat__label', style: 'text-align:center' },
      hr % 6 === 0 ? String(hr) : ''));
  }
  for (let d = 0; d < 7; d++) {
    root.append(h('div', { class: 'heat__label' }, days[d]));
    for (let hr = 0; hr < 24; hr++) {
      const cell = cells.find((c) => c.weekday === d && c.hour === hr);
      const v = cell ? cell.value : 0;
      const alpha = v / max;
      root.append(h('div', {
        class: 'heat__cell',
        title: `${days[d]} ${hr}:00 · ${v} 条`,
        style: v ? `background: color-mix(in srgb, var(--primary) ${Math.round(18 + alpha * 82)}%, transparent)` : '',
      }));
    }
  }
  return root;
}

export function legend() {
  return h('div', { class: 'legend' }, '低',
    h('div', { class: 'legend__ramp' },
      ...[0.16, 0.34, 0.52, 0.7, 0.88].map((a) =>
        h('i', { style: `background: color-mix(in srgb, var(--primary) ${Math.round(a * 100)}%, transparent)` }))),
    '高');
}

/* ---------------- 校园插画（Hero 背景） ---------------- */

export function campusArt() {
  return svg(`
    <defs>
      <linearGradient id="bldg" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#dbe6f6"/><stop offset="1" stop-color="#c3d4ec"/>
      </linearGradient>
      <linearGradient id="tower" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#e8f0fb"/><stop offset="1" stop-color="#cddcef"/>
      </linearGradient>
    </defs>
    <g opacity="0.9">
      <path d="M120 320h420v-90l-210-70-210 70z" fill="url(#bldg)"/>
      <rect x="300" y="120" width="76" height="112" rx="6" fill="url(#tower)"/>
      <path d="M338 108l10-16 10 16z" fill="#a8bedd"/>
      <g fill="#ffffff" opacity="0.85">
        <rect x="150" y="256" width="26" height="30" rx="3"/><rect x="196" y="256" width="26" height="30" rx="3"/>
        <rect x="242" y="256" width="26" height="30" rx="3"/><rect x="400" y="256" width="26" height="30" rx="3"/>
        <rect x="446" y="256" width="26" height="30" rx="3"/><rect x="492" y="256" width="26" height="30" rx="3"/>
        <rect x="316" y="150" width="20" height="26" rx="3"/><rect x="344" y="150" width="20" height="26" rx="3"/>
      </g>
      <g stroke="#b7cbe6" stroke-width="3" fill="none">
        <path d="M60 322c60-34 120-30 190-6"/><path d="M470 318c70-30 130-24 190 4"/>
      </g>
      <g fill="#9fc9a8">
        <circle cx="96" cy="286" r="30"/><circle cx="132" cy="298" r="22"/>
        <path d="M92 322h10v34H92z" fill="#8c9a86"/>
      </g>
      <g fill="#a9d3b3">
        <circle cx="604" cy="272" r="34"/><circle cx="648" cy="288" r="24"/>
        <path d="M600 320h10v40h-10z" fill="#8c9a86"/>
      </g>
      <g>
        <path d="M200 96c-14 0-25 11-25 25 0 18 25 46 25 46s25-28 25-46c0-14-11-25-25-25z" fill="#22c55e" opacity="0.92"/>
        <circle cx="200" cy="121" r="8" fill="#fff"/>
      </g>
      <g>
        <path d="M430 74c-11 0-20 9-20 20 0 14 20 37 20 37s20-23 20-37c0-11-9-20-20-20z" fill="#34d399" opacity="0.9"/>
        <circle cx="430" cy="94" r="6.5" fill="#fff"/>
      </g>
      <path d="M225 122c30 6 60 24 96 44s86 30 110 24" stroke="#7fd4a3" stroke-width="3" fill="none"
            stroke-dasharray="2 9" stroke-linecap="round"/>
      <path d="M150 300h360" stroke="#b7cbe6" stroke-width="4" stroke-linecap="round"/>
    </g>`);
}
