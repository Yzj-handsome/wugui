/* 应用外壳：路由、导航、主题、智能体浮层。
   路由用 hash（`#/items/xxx`），后端对任何路径都返回 index.html。 */

import { api, streamPreview } from './api.js';
import { h, toast, campusArt, field, maskPhone } from './ui.js';
import { renderHome } from './pages/home.js';
import { renderPost } from './pages/post.js';
import { renderItem } from './pages/item.js';
import { renderClaim } from './pages/claim.js';
import { renderInbox } from './pages/inbox.js';
import { renderMe } from './pages/me.js';
import { renderAdmin } from './pages/admin.js';

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
  { path: /^\/admin\/?$/, render: renderAdmin, nav: 'admin' },
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
      onclick: () => openLogin(),
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
    h('button', { onclick: () => { location.hash = '#/admin'; menu.hidden = true; } }, '数据看板'),
    h('hr'),
    h('button', { onclick: async () => { await api.logout(); await refreshUser(); menu.hidden = true; toast('已退出'); } }, '退出登录'),
  );
  btn.addEventListener('click', (e) => { e.stopPropagation(); menu.hidden = !menu.hidden; });
  document.addEventListener('click', () => { menu.hidden = true; });
  box.append(btn, menu);
}

/* ---------------- 登录 / 注册 ---------------- */

/* 表单规则，与后端 schemas.validate_register 保持一致：
   前端做即时提示，后端做兜底。返回 true 表示通过，否则返回错误文案。 */
const REG_RULES = {
  phone: (v) => /^1[3-9]\d{9}$/.test(v) || '手机号格式不正确（11 位数字，1 开头）',
  real_name: (v) => /^[\u4e00-\u9fa5A-Za-z][\u4e00-\u9fa5A-Za-z·]{1,19}$/.test(v)
    || '请填 2-20 个中文或字母',
  student_id: (v) => /^[0-9A-Za-z]{6,20}$/.test(v) || '请填 6-20 位数字或字母',
  qq: (v) => !v || /^[1-9]\d{4,11}$/.test(v) || 'QQ 号格式不正确（5-12 位数字）',
  wechat: (v) => !v || /^[A-Za-z][-_A-Za-z0-9]{5,19}$/.test(v) || '微信号以字母开头，6-20 位',
  email: (v) => !v || /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(v) || '邮箱格式不正确',
};

/* 带「必填 / 选填」标签和错误提示的表单字段 */
function regField(labelText, input, hint, required = false, full = false) {
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

function openLogin() {
  const phone = h('input', { class: 'input', placeholder: '138 0000 0000', inputmode: 'numeric', maxlength: '11' });
  const realName = h('input', { class: 'input', placeholder: '张三' });
  const studentId = h('input', { class: 'input', placeholder: '2023xxxxxxxxx' });
  const nickname = h('input', { class: 'input', placeholder: '默认用真实姓名' });
  const qq = h('input', { class: 'input', placeholder: '5-12 位数字' });
  const wechat = h('input', { class: 'input', placeholder: '微信号' });
  const email = h('input', { class: 'input', placeholder: 'you@qq.com 或 you@whu.edu.cn' });

  const fPhone = regField('手机号', phone, '失主 / 拾主联系对接用', true);
  const fName = regField('真实姓名', realName, '失物交接时的核验依据', true);
  const fSid = regField('学号', studentId, '服务端只保存 HMAC 摘要，不保存明文', true, true);
  const fNick = regField('昵称', nickname, '展示用，默认取真实姓名', false, true);
  const fQq = regField('QQ 号', qq, null);
  const fWx = regField('微信号', wechat, null);
  const fMail = regField('邮箱', email, 'QQ 邮箱或校园邮箱（@whu.edu.cn）都可以', false, true);

  const chips = h('div', { class: 'chips', style: 'margin-top:10px' });
  const submitBtn = h('button', { class: 'btn btn--primary' }, '注册 / 登录');

  const back = h('div', { class: 'modal-back' },
    h('div', { class: 'modal' },
      h('div', { class: 'modal__head' }, '登录 / 注册'),
      h('div', { class: 'modal__body' },
        h('div', { class: 'stack' },
          h('div', { class: 'form-grid' },
            fPhone, fName, fSid, fNick,
            h('div', { class: 'form-divider form-field--full' }, '以下选填，方便同学联系你'),
            fQq, fWx, fMail),
          h('div', { class: 'form-note' }, '没有密码：填好资料就是注册，下次用同样的手机号或学号进入。'),
          h('div', { style: 'border-top:1px solid var(--border);padding-top:12px' },
            h('div', { class: 'small muted', style: 'margin-bottom:8px' }, '或者用演示身份一键进入（不用填资料）：'),
            chips),
        ),
      ),
      h('div', { class: 'modal__foot' },
        h('button', { class: 'btn', onclick: () => back.remove() }, '取消'),
        submitBtn),
    ));

  const submit = async () => {
    const values = {
      phone: phone.value.replace(/\s/g, ''),
      real_name: realName.value.trim(),
      student_id: studentId.value.trim(),
      nickname: nickname.value.trim(),
      qq: qq.value.trim(),
      wechat: wechat.value.trim(),
      email: email.value.trim(),
    };
    const fields = { phone: fPhone, real_name: fName, student_id: fSid, qq: fQq, wechat: fWx, email: fMail };
    let firstBad = null;
    for (const [key, rule] of Object.entries(REG_RULES)) {
      const result = rule(values[key]);
      if (result !== true) {
        fields[key].setErr(result);
        firstBad = firstBad || fields[key];
      }
    }
    if (firstBad) {
      firstBad.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      return;
    }
    submitBtn.disabled = true;
    submitBtn.textContent = '正在进入…';
    try {
      await api.login(values);
      back.remove();
      await refreshUser();
      toast('已登录', 'ok');
    } catch (err) {
      toast(err.message || '登录失败', 'err');
      submitBtn.disabled = false;
      submitBtn.textContent = '注册 / 登录';
    }
  };
  submitBtn.addEventListener('click', submit);
  for (const el of [phone, realName, studentId, nickname, qq, wechat, email]) {
    el.addEventListener('keydown', (e) => { if (e.key === 'Enter') submit(); });
  }

  document.body.append(back);
  api.users().then((data) => {
    for (const u of data.users.slice(0, 8)) {
      chips.append(h('button', {
        class: 'chip',
        onclick: async () => {
          await api.login({ nickname: u.nickname });
          back.remove(); await refreshUser(); toast(`已切换为 ${u.nickname}`, 'ok');
        },
      }, u.nickname));
    }
  }).catch(() => {});
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

  document.getElementById('agentFab').addEventListener('click', () => openAgent());
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

/* ---------------- 主题 ---------------- */

function initTheme() {
  // 深色是默认主题；用户手动切换过就按 localStorage 来。
  // （HTML 里还有一段内联脚本做同样的事，避免首屏白闪。）
  const saved = localStorage.getItem('wugui-theme');
  document.documentElement.dataset.theme = saved === 'light' ? '' : 'dark';
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
