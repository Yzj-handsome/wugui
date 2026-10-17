/* 登录 / 注册（两个独立页面，路由 #/login 与 #/register） */

import { api } from '../api.js?v=202610171027';
import { h, icon, toast, regField, REG_RULES } from '../ui.js?v=202610171027';
import { state, refreshUser } from '../app.js?v=202610171027';

function shell(main, title, subtitle) {
  const card = h('div', { class: 'auth-card' });
  main.append(h('div', { class: 'section' },
    h('div', { class: 'wrap wrap--narrow' },
      h('div', { class: 'auth-head' },
        h('div', { class: 'auth-head__mark' }, icon('pin')),
        h('h1', { class: 'auth-head__title' }, title),
        h('p', { class: 'auth-head__sub' }, subtitle)),
      card)));
  return card;
}

function submitOnEnter(fields, submit) {
  for (const el of fields) {
    el.addEventListener('keydown', (e) => { if (e.key === 'Enter') submit(); });
  }
}

/* ---------------- 登录 ---------------- */
export async function renderLogin(main) {
  const account = h('input', {
    class: 'input', placeholder: '手机号 或 学号',
    autocomplete: 'username', inputmode: 'text',
  });
  const password = h('input', {
    class: 'input', type: 'password', placeholder: '密码',
    autocomplete: 'current-password',
  });
  const fAccount = regField('手机号 / 学号', account, '用注册时填的手机号或学号', true, true);
  const fPassword = regField('密码', password, null, true, true);

  const btn = h('button', { class: 'btn btn--primary btn--lg auth-submit' }, '登 录');

  const submit = async () => {
    const values = { account: account.value.trim(), password: password.value };
    let firstBad = null;
    const check = (field, msg) => { if (msg !== true) { field.setErr(msg); firstBad = firstBad || field; } };
    check(fAccount, values.account ? true : '请输入手机号或学号');
    check(fPassword, values.password ? true : '请输入密码');
    if (firstBad) { firstBad.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); return; }
    btn.disabled = true; btn.textContent = '登录中…';
    try {
      await api.login(values);
      await refreshUser();
      toast('已登录', 'ok');
      location.hash = '#/';
    } catch (err) {
      toast(err.message || '登录失败', 'err');
      btn.disabled = false; btn.textContent = '登 录';
    }
  };
  btn.addEventListener('click', submit);
  submitOnEnter([account, password], submit);

  const chips = h('div', { class: 'chips', style: 'margin-top:10px' });
  api.users().then((data) => {
    for (const u of (data.users || []).slice(0, 8)) {
      chips.append(h('button', {
        class: 'chip', type: 'button',
        onclick: async () => {
          try {
            await api.login({ nickname: u.nickname });
            await refreshUser();
            toast(`已切换为 ${u.nickname}`, 'ok');
            location.hash = '#/';
          } catch (err) { toast(err.message, 'err'); }
        },
      }, u.nickname));
    }
  }).catch(() => {});

  const card = shell(main, '登录物归', '用手机号或学号登录，继续找回你的物品');
  card.append(
    h('div', { class: 'form-grid' }, fAccount, fPassword),
    btn,
    h('div', { class: 'auth-switch' },
      '还没有账号？',
      h('a', { href: '#/register' }, '去注册 →')),
    h('div', { class: 'auth-divider' }, '或者用演示身份一键进入（不用密码）'),
    chips,
  );
}

/* ---------------- 注册 ---------------- */
export async function renderRegister(main) {
  const phone = h('input', { class: 'input', placeholder: '138 0000 0000', inputmode: 'numeric', maxlength: '11' });
  const realName = h('input', { class: 'input', placeholder: '张三' });
  const studentId = h('input', { class: 'input', placeholder: '2023xxxxxxxxx' });
  const password = h('input', { class: 'input', type: 'password', placeholder: '至少 6 位', autocomplete: 'new-password' });
  const password2 = h('input', { class: 'input', type: 'password', placeholder: '再输一次', autocomplete: 'new-password' });
  const nickname = h('input', { class: 'input', placeholder: '默认用真实姓名' });
  const qq = h('input', { class: 'input', placeholder: '5-12 位数字' });
  const wechat = h('input', { class: 'input', placeholder: '微信号' });
  const email = h('input', { class: 'input', placeholder: 'you@qq.com 或 you@whu.edu.cn' });

  const fPhone = regField('手机号', phone, '用于登录与失物对接', true);
  const fName = regField('真实姓名', realName, '失物交接时的核验依据', true);
  const fSid = regField('学号', studentId, '用于登录；服务端只存 HMAC 摘要，不保存明文', true);
  const fPw = regField('密码', password, '6-32 位，不能有空格', true);
  const fPw2 = regField('确认密码', password2, null, true);
  const fNick = regField('昵称', nickname, '展示用，默认取真实姓名', false, true);
  const fQq = regField('QQ 号', qq, null);
  const fWx = regField('微信号', wechat, null);
  const fMail = regField('邮箱', email, 'QQ 邮箱或武大邮箱（@whu.edu.cn）都可以', false, true);

  const btn = h('button', { class: 'btn btn--primary btn--lg auth-submit' }, '注册并登录');

  const submit = async () => {
    const values = {
      phone: phone.value.replace(/\s/g, ''),
      real_name: realName.value.trim(),
      student_id: studentId.value.trim(),
      password: password.value,
      qq: qq.value.trim(),
      wechat: wechat.value.trim(),
      email: email.value.trim(),
      nickname: nickname.value.trim(),
    };
    const fields = {
      phone: fPhone, real_name: fName, student_id: fSid, password: fPw,
      qq: fQq, wechat: fWx, email: fMail,
    };
    let firstBad = null;
    for (const [key, rule] of Object.entries(REG_RULES)) {
      const result = rule(values[key]);
      if (result !== true) { fields[key].setErr(result); firstBad = firstBad || fields[key]; }
    }
    if (values.password !== password2.value) {
      fPw2.setErr('两次输入的密码不一致');
      firstBad = firstBad || fPw2;
    }
    if (firstBad) { firstBad.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); return; }

    btn.disabled = true; btn.textContent = '注册中…';
    try {
      const { password: _pw, ...payload } = values;   // eslint-disable-line no-unused-vars
      await api.register({ ...payload, password: values.password });
      await refreshUser();
      toast('注册成功，已自动登录', 'ok');
      location.hash = '#/';
    } catch (err) {
      toast(err.message || '注册失败', 'err');
      btn.disabled = false; btn.textContent = '注册并登录';
    }
  };
  btn.addEventListener('click', submit);
  submitOnEnter([phone, realName, studentId, password, password2, nickname, qq, wechat, email], submit);

  const card = shell(main, '注册物归账号', '注册后可以发布失物、接收匹配推送、发起认领');
  card.append(
    h('div', { class: 'form-grid' },
      fPhone, fName, fSid,
      h('div', { class: 'form-divider form-field--full' }, '账号密码'),
      fPw, fPw2, fNick,
      h('div', { class: 'form-divider form-field--full' }, '以下选填，方便同学联系你'),
      fQq, fWx, fMail),
    btn,
    h('div', { class: 'auth-switch' },
      '已经有账号了？',
      h('a', { href: '#/login' }, '去登录 →')),
    h('div', { class: 'form-note', style: 'margin-top:10px' },
      '学号只保存 HMAC 摘要，不保存明文；联系方式默认不公开，只在匹配确认后按关系放行。'),
  );
}
