/* 应用外壳：路由、导航、主题、智能体浮层。
   路由用 hash（`#/items/xxx`），后端对任何路径都返回 index.html。 */

import { api, streamPreview } from './api.js';
import { h, toast, campusArt, maskPhone } from './ui.js';
import { renderHome } from './pages/home.js';
import { renderPost } from './pages/post.js';
import { renderItem } from './pages/item.js';
import { renderClaim } from './pages/claim.js';
import { renderInbox } from './pages/inbox.js';
import { renderMe } from './pages/me.js';
import { renderAdmin } from './pages/admin.js';
import { renderLogin, renderRegister } from './pages/auth.js';
import { renderHall } from './pages/hall.js';

export const state = {
  user: null,
  meta: null,
  status: null,
  unread: 0,
};

const routes = [
  { path: /^\/?$/, render: renderHome, nav: 'home' },
  { path: /^\/post\/?$/, render: renderPost, nav: 'post' },
  { path: /^\/items\/([\w-]+)$/, render: renderItem, nav: 'home' },
  { path: /^\/claims\/([\w-]+)$/, render: renderClaim, nav: 'inbox' },
  { path: /^\/inbox\/?$/, render: renderInbox, nav: 'inbox' },
  { path: /^\/me\/?$/, render: renderMe, nav: 'home' },
  { path: /^\/hall\/?$/, render: renderHall, nav: 'hall' },
  { path: /^\/login\/?$/, render: renderLogin, nav: null },
  { path: /^\/register\/?$/, render: renderRegister, nav: null },
  { path: /^\/admin\/?$/, render: renderAdmin, nav: null },
];

function currentPath() {
  const hash = location.hash.replace(/^#/, '');
  return hash || '/';
}

async function render() {
  const path = currentPath();
  const main = document.getElementById('main');
  main.innerHTML = '';
  document.querySelectorAll('.nav__links a').forEach((a) => a.classList.remove('is-active'));

  for (const route of routes) {
    const m = path.match(route.path);
    if (!m) continue;
    const link = document.querySelector(`.nav__links a[data-nav="${route.nav}"]`);
    if (link) link.classList.add('is-active');
    window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' });
    try {
      await route.render(main, { params: m.slice(1) });
    } catch (err) {
      console.error(err);
      main.append(h('div', { class: 'wrap section' },
        h('div', { class: 'empty' },
          h('strong', {}, '这一页没加载出来'),
          h('div', {}, err.message || '未知错误'))));
    }
    return;
  }
  main.append(h('div', { class: 'wrap section' },
    h('div', { class: 'empty' }, h('strong', {}, '页面不存在'), h('div', {}, `找不到 ${path}`))));
}

/* ---------------- 导航与用户 ---------------- */

function renderUser() {
  const box = document.getElementById('userBox');
  box.innerHTML = '';
  if (!state.user) {
    box.append(h('button', {
      class: 'btn btn--primary btn--sm',
      onclick: () => { location.hash = '#/login'; },
    }, '登录'));
    return;
  }
  const btn = h('button', { class: 'user__btn' },
    h('span', { class: 'avatar' }, (state.user.nickname || '物').slice(0, 1)),
    h('span', { class: 'user__name' }, state.user.nickname));
  const menu = h('div', { class: 'user__menu', hidden: true },
    h('div', { style: 'padding:8px 10px' },
      h('div', { class: 'strong' }, state.user.nickname),
      h('div', { class: 'small muted' },
        [state.user.real_name,
         state.user.phone ? maskPhone(state.user.phone) : null,
         state.user.email].filter(Boolean).join(' · ') || '未绑定邮箱'),
      h('div', { class: 'small', style: 'margin-top:4px' },
        state.user.verified
          ? h('span', { class: 'chip' }, '已实名')
          : h('span', { class: 'chip chip--warn' }, '未实名'))),
    h('hr'),
    h('button', { onclick: () => { location.hash = '#/me'; menu.hidden = true; } }, '我的发布与认领'),
    h('button', { onclick: () => { location.hash = '#/inbox'; menu.hidden = true; } }, '消息中心'),
    h('button', { onclick: () => { location.hash = '#/hall'; menu.hidden = true; } }, '办事大厅'),
    h('hr'),
    h('button', { onclick: async () => { await api.logout(); await refreshUser(); menu.hidden = true; toast('已退出'); } }, '退出登录'),
  );
  btn.addEventListener('click', (e) => { e.stopPropagation(); menu.hidden = !menu.hidden; });
  document.addEventListener('click', () => { menu.hidden = true; });
  box.append(btn, menu);
}

export async function refreshUser() {
  try {
    const me = await api.whoami();
    state.user = me.logged_in ? me : null;
  } catch { state.user = null; }
  renderUser();
}

async function pollUnread() {
  if (!state.user) { document.getElementById('navBadge').hidden = true; return; }
  try {
    const data = await api.inbox(true);
    state.unread = data.unread || 0;
    const badge = document.getElementById('navBadge');
    badge.hidden = !state.unread;
    badge.textContent = state.unread > 9 ? '9+' : state.unread;
  } catch { /* 忽略 */ }
}

/* ---------------- 智能体 ---------------- */

export function openAgent(prefill = '') {
  const panel = document.getElementById('agent');
  panel.hidden = false;
  const input = document.getElementById('agentInput');
  if (prefill) input.value = prefill;
  input.focus();
}

function initAgent() {
  const panel = document.getElementById('agent');
  const body = document.getElementById('agentBody');
  const form = document.getElementById('agentForm');
  const input = document.getElementById('agentInput');
  let history = [];
  let context = {};

  const push = (role, text) => {
    const bubble = h('div', { class: `bubble bubble--${role === 'user' ? 'me' : 'bot'}` }, text);
    body.append(bubble);
    body.scrollTop = body.scrollHeight;
    return bubble;
  };

  push('assistant', '你好，我是物归智能体。\n可以这样用：\n· 「周二下午在图书馆三楼丢了一副黑色耳机」— 我帮你找线索\n· 「我在五教捡到一个保温杯」— 我帮你发布\n· 「把这段群聊拆一下：…」— 批量导入');

  initAgentFab();
  document.getElementById('agentBtn').addEventListener('click', () => openAgent());
  document.getElementById('agentClose').addEventListener('click', () => { panel.hidden = true; });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const text = input.value.trim();
    if (!text) return;
    input.value = '';
    push('user', text);
    history.push({ role: 'user', content: text });
    const typing = h('div', { class: 'bubble bubble--bot' }, h('span', { class: 'typing' }, h('i'), h('i'), h('i')));
    body.append(typing);
    body.scrollTop = body.scrollHeight;
    try {
      const res = await api.chat(text, context, history.slice(-6));
      typing.remove();
      push('assistant', res.reply);
      history.push({ role: 'assistant', content: res.reply });
      if (res.data && res.data.stage === 'confirm') {
        context = {
          stage: 'confirm',
          draft_text: res.data.draft_text,
          images: res.data.images || [],
        };
      } else if (res.data && res.data.claim_id) {
        location.hash = `#/claims/${res.data.claim_id}`;
      } else if (res.data && res.data.item_id && res.data.matches) {
        const card = h('div', { class: 'row' },
          h('button', { class: 'btn btn--sm', onclick: () => { location.hash = `#/items/${res.data.item_id}`; } }, '查看详情'));
        body.append(card);
      } else {
        context = {};
      }
    } catch (err) {
      typing.remove();
      push('assistant', `出错了：${err.message}`);
    }
  });
}


/* 智能体图标：可拖动，位置记在 localStorage；拖动时不触发打开面板 */
function initAgentFab() {
  const fab = document.getElementById('agentFab');
  if (!fab) return;
  const KEY = 'wugui-fab-pos';
  const show = () => openAgent();

  function clamp(x, y) {
    const w = fab.offsetWidth || 56;
    const h = fab.offsetHeight || 56;
    const maxX = Math.max(8, window.innerWidth - w - 10);
    const maxY = Math.max(8, window.innerHeight - h - 10);
    return { x: Math.min(Math.max(10, x), maxX), y: Math.min(Math.max(10, y), maxY) };
  }

  function applyPos(x, y) {
    const p = clamp(x, y);
    fab.style.left = `${p.x}px`;
    fab.style.top = `${p.y}px`;
    fab.style.right = 'auto';
    fab.style.bottom = 'auto';
    return p;
  }

  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (saved && Number.isFinite(saved.x)) applyPos(saved.x, saved.y);
  } catch { /* 忽略 */ }

  let dragging = false;
  let moved = false;
  let sx = 0;
  let sy = 0;
  let bx = 0;
  let by = 0;

  fab.addEventListener('pointerdown', (e) => {
    const r = fab.getBoundingClientRect();
    dragging = true;
    moved = false;
    sx = e.clientX;
    sy = e.clientY;
    bx = r.left;
    by = r.top;
    fab.classList.add('is-dragging');
    try { fab.setPointerCapture(e.pointerId); } catch { /* 忽略 */ }
  });

  fab.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    const dx = e.clientX - sx;
    const dy = e.clientY - sy;
    if (!moved && Math.abs(dx) + Math.abs(dy) > 6) moved = true;
    if (moved) {
      e.preventDefault();
      applyPos(bx + dx, by + dy);
    }
  });

  const finish = () => {
    if (!dragging) return;
    dragging = false;
    fab.classList.remove('is-dragging');
    if (moved) {
      const r = fab.getBoundingClientRect();
      try { localStorage.setItem(KEY, JSON.stringify({ x: r.left, y: r.top })); } catch { /* 忽略 */ }
    }
  };
  fab.addEventListener('pointerup', finish);
  fab.addEventListener('pointercancel', finish);

  fab.addEventListener('click', (e) => {
    if (moved) { e.preventDefault(); e.stopPropagation(); moved = false; return; }
    show();
  });

  window.addEventListener('resize', () => {
    const r = fab.getBoundingClientRect();
    if (fab.style.left) applyPos(r.left, r.top);
  });
}

/* ---------------- 主题 ---------------- */

function initTheme() {
  // 亮色是默认主题；用户手动切换过就按 localStorage 来。
  // （HTML 里还有一段内联脚本做同样的事，避免首屏闪烁。）
  const saved = localStorage.getItem('wugui-theme');
  document.documentElement.dataset.theme = saved === 'dark' ? 'dark' : '';
  document.getElementById('themeBtn').addEventListener('click', () => {
    const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next === 'dark' ? 'dark' : '';
    localStorage.setItem('wugui-theme', next);
    window.dispatchEvent(new CustomEvent('theme-change'));
  });
}

/* ---------------- 启动 ---------------- */

async function boot() {
  initTheme();
  initAgent();
  window.addEventListener('hashchange', render);
  document.getElementById('agentBtn').addEventListener('click', () => openAgent());

  await refreshUser();
  try {
    state.meta = await api.meta();
    const stats = state.meta.stats || {};
    document.getElementById('footerMeta').textContent =
      `在架线索 ${stats.items_total ?? 0} 条 · 失物 ${stats.lost ?? 0} · 拾物 ${stats.found ?? 0}`;
  } catch { /* 忽略 */ }
  api.status().then((s) => { state.status = s; }).catch(() => {});
  pollUnread();
  setInterval(pollUnread, 20000);

  await render();
}

boot();
