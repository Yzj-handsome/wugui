/* 发布页：三步 —— 上传/描述 → 确认 AI 填好的表单 → 完成并展示匹配（§11.2） */

import { api, compressImage } from '../api.js';
import {
  h, icon, toast, field, select, matchCard, emptyState, sourceText, locationPicker,
} from '../ui.js';
import { state, refreshUser } from '../app.js';

export async function renderPost(main) {
  /* 联系方式校验规则与后端 schemas.CONTACT_PATTERNS 保持一致 */
  const CONTACT_RULES = {
    phone: { re: /^1[3-9]\d{9}$/, hint: '11 位手机号', label: '手机号' },
    qq: { re: /^[1-9]\d{4,11}$/, hint: '5–12 位 QQ 号', label: 'QQ 号' },
    wechat: { re: /^([A-Za-z][-_A-Za-z0-9]{5,19}|1[3-9]\d{9})$/, hint: '微信号，或绑定的手机号', label: '微信号' },
    email: { re: /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/, hint: '邮箱地址', label: '邮箱' },
  };

  function checkContact(type, value) {
    if (!value) return '请留下联系方式，方便失主联系你';
    const rule = CONTACT_RULES[type];
    if (!rule) return '请选择联系方式类型';
    if (!rule.re.test(value)) return `${rule.label}格式不正确（${rule.hint}）`;
    return null;
  }

  const session = {
    step: 1,
    kind: 'lost',
    text: '',
    images: [],
    parsed: null,
    item: null,
    matches: [],
    contactType: 'wechat',
    contactValue: '',
  };

  const wrap = h('div', { class: 'wrap wrap--narrow' });
  main.append(h('div', { class: 'section' }, wrap));

  const stepsBar = h('div', { class: 'steps' });
  function drawSteps() {
    const labels = ['描述或上传', '确认 AI 填写', '完成'];
    stepsBar.innerHTML = '';
    labels.forEach((label, i) => {
      const idx = i + 1;
      const cls = session.step === idx ? 'is-active' : (session.step > idx ? 'is-done' : '');
      stepsBar.append(h('div', { class: `step ${cls}` },
        h('span', { class: 'step__idx' }, session.step > idx ? '✓' : idx), label));
    });
  }

  const body = h('div', {});
  wrap.append(stepsBar, body);

  /* ---------------- 第一步 ---------------- */
  function step1() {
    const text = h('textarea', {
      class: 'textarea',
      placeholder: session.kind === 'lost'
        ? '例如：周二下午在图书馆总馆三楼丢了一副黑色蓝牙耳机，充电盒一起丢的，盒子背面有贴纸'
        : '例如：在图书馆总馆三楼自习区捡到一副黑色无线耳机，带充电盒，盒盖内侧有贴纸',
      oninput: () => { session.text = text.value; },
    }, session.text);
    const thumbs = h('div', { class: 'thumb-row', style: 'margin-top:12px' });
    const file = h('input', { type: 'file', accept: 'image/*', multiple: true, hidden: true });
    const zone = h('div', { class: 'dropzone' },
      icon('upload'),
      h('div', { class: 'strong' }, '拖拽或点击上传照片'),
      h('div', { class: 'small muted' },
        session.kind === 'found'
          ? '建议拍两张：一张正面展示图，一张细节图（背面、内部、挂件）。细节图不公开，只用来出验证题。'
          : '有旧照片的话一起传上来，图像相似度会参与匹配。'),
      h('div', { class: 'small muted', style: 'margin-top:6px' }, '浏览器端会先压到长边 1568px，最多 3 张'),
      file);

    /* ---------- 联系方式（拾主必填）---------- */
    const CONTACT_TYPES = [
      ['wechat', '微信'], ['phone', '手机号'], ['qq', 'QQ 号'], ['email', '邮箱'],
    ];
    const contactValue = h('input', {
      class: 'input',
      placeholder: CONTACT_RULES[session.contactType]?.hint || '',
      value: session.contactValue || '',
      oninput: (e) => { session.contactValue = e.target.value.trim(); },
    });
    const typeRow = h('div', { class: 'seg' });
    for (const [value, label] of CONTACT_TYPES) {
      const btn = h('button', {
        class: `seg__item${session.contactType === value ? ' is-active' : ''}`,
        onclick: () => {
          session.contactType = value;
          typeRow.querySelectorAll('.seg__item').forEach((b) => b.classList.remove('is-active'));
          btn.classList.add('is-active');
          contactValue.placeholder = CONTACT_RULES[value]?.hint || '';
          contactValue.focus();
        },
      }, label);
      typeRow.append(btn);
    }
    const contactBox = h('div', { class: 'contact-box' },
      h('div', { class: 'row row--between' },
        h('div', { class: 'strong' }, '你的联系方式'),
        h('span', { class: 'chip chip--warn' }, '拾主必填')),
      h('div', { class: 'form-hint', style: 'margin:4px 0 10px' },
        '失主找到线索后要能联系上你，所以这一项不能空。默认不对外公开——只有匹配到的失主和通过验证的认领人能看到。'),
      typeRow,
      h('div', { style: 'margin-top:10px' }, contactValue),
    );
    const contactToggle = () => { contactBox.hidden = session.kind !== 'found'; };
    contactToggle();

    zone.addEventListener('click', () => file.click());
    zone.addEventListener('dragover', (e) => { e.preventDefault(); zone.classList.add('is-over'); });
    zone.addEventListener('dragleave', () => zone.classList.remove('is-over'));
    zone.addEventListener('drop', (e) => {
      e.preventDefault(); zone.classList.remove('is-over');
      addImages(e.dataTransfer.files);
    });
    file.addEventListener('change', () => { addImages(file.files); file.value = ''; });

    async function addImages(files) {
      for (const f of Array.from(files).slice(0, 3 - session.images.length)) {
        if (!f.type.startsWith('image/')) continue;
        try {
          const data = await compressImage(f);
          session.images.push(data);
          const thumb = h('div', { class: 'thumb' },
            h('img', { src: data, alt: '待发布照片' }),
            h('button', {
              onclick: () => { session.images = session.images.filter((x) => x !== data); thumb.remove(); },
            }, '×'));
          thumbs.append(thumb);
        } catch (err) { toast('图片读取失败：' + err.message, 'err'); }
      }
    }

    const next = h('button', { class: 'btn btn--primary btn--lg', onclick: runParse }, 'AI 帮我填 →');

    const tabs = h('div', { class: 'composer__tabs' });
    for (const [key, label] of [['lost', '我丢了'], ['found', '我捡到了']]) {
      const tab = h('button', { class: `composer__tab${key === session.kind ? ' is-active' : ''}` }, label);
      tab.addEventListener('click', () => {
        session.kind = key;
        tabs.querySelectorAll('.composer__tab').forEach((t) => t.classList.remove('is-active'));
        tab.classList.add('is-active');
        text.placeholder = key === 'lost' ? '描述丢失的物品…' : '描述捡到的物品…';
        contactToggle();
      });
      tabs.append(tab);
    }

    body.innerHTML = '';
    body.append(
      h('h2', { class: 'section-title' }, '描述或上传'),
      h('div', { class: 'panel stack' },
        tabs,
        text,
        zone,
        thumbs,
        contactBox,
        h('div', { class: 'form-note' }, icon('shield'),
          '照片会被 AI 分析；人脸、证件号与隐藏特征区域会先打码再公开（§13.1）。'),
        h('div', { class: 'row', style: 'margin-top:6px' },
          next,
          h('button', { class: 'btn btn--ghost', onclick: () => { location.hash = '#/'; } }, '取消')),
      ),
    );

    async function runParse() {
      session.text = text.value.trim();
      if (!session.text && !session.images.length) {
        toast('至少写一句话，或传一张照片', 'err');
        return;
      }
      // 拾主的联系方式必填：先在前端校验一次，避免走完解析才被拒
      if (session.kind === 'found') {
        const issue = checkContact(session.contactType, session.contactValue);
        if (issue) {
          toast(issue, 'err');
          contactValue.focus();
          return;
        }
      }
      next.disabled = true; next.textContent = 'AI 正在解析…';
      try {
        // 未登录也允许试匹配，但发布要求登录
        const res = await api.preview({
          kind: session.kind, text: session.text, image_keys: session.images,
        });
        session.parsed = res.parsed;
        session.matches = res.matches || [];
        session.analyzed = res.analyzed_count;
        session.step = 2;
        drawSteps(); step2();
      } catch (err) {
        toast(err.message, 'err');
      } finally {
        next.disabled = false; next.textContent = 'AI 帮我填 →';
      }
    }
  }

  /* ---------------- 第二步：确认表单 ---------------- */
  function step2() {
    const p = session.parsed || {};
    const d = p.draft || {};
    const meta = state.meta || { locations: [], categories: {} };
    const low = new Set(p.low_conf || []);

    const titleIn = h('input', { class: 'input', value: p.title || '', oninput: (e) => { d.title = e.target.value; } });
    const catL1 = select(Object.keys(meta.categories || {}), d.category_l1, (v) => {
      d.category_l1 = v;
      const subs = meta.categories[v] || [];
      d.category_l2 = subs[0] || '其他';
      redrawCat2();
    });
    const catL2Box = h('div', {});
    function redrawCat2() {
      catL2Box.innerHTML = '';
      const subs = meta.categories[d.category_l1] || [];
      const sel = select(subs, d.category_l2, (v) => { d.category_l2 = v; });
      sel.classList.add('input');
      catL2Box.append(sel);
    }
    redrawCat2();

    const colorIn = h('input', {
      class: 'input',
      value: (d.colors || []).map((c) => (c.modifier || '') + c.name).join('、'),
      placeholder: '如：黑 或 深蓝',
      oninput: (e) => {
        d.colors = e.target.value.split(/[、,，\s]+/).filter(Boolean).map((n) => ({ name: n, modifier: null }));
      },
    });
    const brandIn = h('input', { class: 'input', value: d.brand || '', oninput: (e) => { d.brand = e.target.value; } });
    const locSel = locationPicker({
      tree: meta.tree || [],
      groups: meta.groups || [],
      value: p.location || '',
      placeholder: '（未识别，请选择）',
      onChange: (v) => { session.location = v; },
    });
    const timeFrom = h('input', {
      class: 'input', type: 'datetime-local',
      value: toLocal(p.occurred_from),
      oninput: (e) => { session.from = e.target.value ? new Date(e.target.value) : null; },
    });
    const condIn = h('input', {
      class: 'input', value: d.condition || '', placeholder: '成色、磨损等',
      oninput: (e) => { d.condition = e.target.value; },
    });
    const rawView = h('textarea', { class: 'textarea', readonly: true }, session.text);

    const publishBtn = h('button', { class: 'btn btn--primary btn--lg', onclick: publish }, '确认发布');
    const backBtn = h('button', { class: 'btn', onclick: () => { session.step = 1; drawSteps(); step1(); } }, '← 改描述');

    const previewCards = h('div', { class: 'cards', style: 'grid-template-columns:repeat(auto-fill,minmax(220px,1fr))' });
    for (const m of (session.matches || []).slice(0, 3)) previewCards.append(matchCard(m, { showScore: true }));

    body.innerHTML = '';
    body.append(
      h('h2', { class: 'section-title' }, '确认 AI 填写的信息'),
      h('div', { class: 'row small muted', style: 'margin:-6px 0 12px' },
        icon('sparkle'), `解析引擎：${p.engine === 'vlm' ? '视觉语言模型' : '规则词典 + 向量'} · 用时 ${p.elapsed_ms || 0}ms`),
      h('div', { class: 'panel stack' },
        h('div', { class: 'form-grid' },
          field('物品标题', titleIn, '不超过 16 字，卡片上显示的就是它', low.has('title')),
          field('一级类别', catL1),
          field('二级类别', catL2Box, null, low.has('category')),
          field('颜色（多个用、分隔）', colorIn, null, low.has('colors')),
          field('品牌', brandIn, '只在商标或文字可见时填', low.has('brand')),
          field('地点', locSel, '来自校园地名库，可直接搜索选择', !session.parsed.location),
          field('丢失 / 拾获时间', timeFrom, '默认取描述里的时间，没写就按发帖前推算', low.has('time')),
          field('成色与磨损', condIn),
        ),
        field('原始描述（会作为匹配依据）', rawView),
        p.warnings && p.warnings.length
          ? h('div', { class: 'form-note' }, icon('sparkle'), p.warnings.join('；'))
          : null,
        h('div', { class: 'row row--between', style: 'margin-top:8px' },
          h('div', { class: 'row' }, backBtn, publishBtn),
          h('span', { class: 'small muted' }, '发布后自动开始匹配，命中会推送给你')),
      ),
      session.matches && session.matches.length
        ? h('div', { style: 'margin-top:22px' },
            h('h2', { class: 'section-title' },
              `发布前先看看：已找到 ${session.matches.length} 条候选（已分析 ${session.analyzed || 0} 条线索）`),
            previewCards)
        : null,
    );

    function toLocal(iso) {
      if (!iso) return '';
      const d2 = new Date(iso);
      const pad = (n) => String(n).padStart(2, '0');
      return `${d2.getFullYear()}-${pad(d2.getMonth() + 1)}-${pad(d2.getDate())}T${pad(d2.getHours())}:${pad(d2.getMinutes())}`;
    }

    async function publish() {
      if (!state.user) {
        toast('发布需要先登录（右上角）', 'err');
        return;
      }
      publishBtn.disabled = true; publishBtn.textContent = '发布中…';
      const overrides = {
        title: d.title, category_l1: d.category_l1, category_l2: d.category_l2,
        brand: d.brand, condition: d.condition,
        colors: (d.colors || []).map((c) => (c.modifier || '') + c.name),
      };
      try {
        const item = await api.createItem({
          kind: session.kind,
          text: session.text,
          image_keys: session.images,
          overrides,
          location_name: session.location || session.parsed.location || null,
          occurred_from: (session.from || new Date(session.parsed.occurred_from || Date.now())).toISOString(),
          contact_type: session.kind === 'found' ? session.contactType : null,
          contact_value: session.contactValue || null,
          source: 'web',
          autopublish: true,
        });
        session.item = item;
        session.step = 3;
        drawSteps();
        step3();
      } catch (err) {
        toast(err.message, 'err');
      } finally {
        publishBtn.disabled = false; publishBtn.textContent = '确认发布';
      }
    }
  }

  /* ---------------- 第三步：完成 + 匹配 ---------------- */
  async function step3() {
    const item = session.item;
    const data = await api.itemMatches(item.id, true).catch(() => ({ matches: [] }));
    const matches = data.matches || [];
    const cards = h('div', { class: 'cards' });
    if (matches.length) {
      for (const m of matches) cards.append(matchCard(m, { showScore: true }));
    } else {
      cards.append(emptyState('暂时没有匹配到线索', '已为你持续关注，有新线索入库会第一时间推送给你。'));
    }
    body.innerHTML = '';
    body.append(
      h('h2', { class: 'section-title' }, '发布完成'),
      h('div', { class: 'panel stack' },
        h('div', { class: 'row row--between' },
          h('div', {},
            h('div', { class: 'strong', style: 'font-size:17px' }, item.title),
            h('div', { class: 'small muted' },
              `${item.category_l1 || ''} / ${item.category_l2 || ''} · ${item.location || '地点待补充'} · 来源 ${sourceText[item.source] || item.source}`),
            h('div', { class: 'chips', style: 'margin-top:8px' },
              h('span', { class: 'badge badge--confirm badge--dot' }, '已入库并参与匹配'),
              (item.colors || []).map((c) => h('span', { class: 'chip' }, c + '色'))),
          ),
          h('img', {
            src: item.cover_url || '', alt: item.title,
            style: 'width:120px;aspect-ratio:4/3;object-fit:cover;border-radius:12px;border:1px solid var(--border)',
          }),
        ),
        h('div', { class: 'row', style: 'margin-top:6px' },
          h('button', { class: 'btn btn--primary', onclick: () => { api.deliver().catch(() => {}); location.hash = '#/inbox'; } }, '去消息中心看推送'),
          h('button', { class: 'btn', onclick: () => { location.hash = `#/items/${item.id}`; } }, '查看详情'),
          h('button', { class: 'btn btn--ghost', onclick: () => { location.hash = '#/'; } }, '再找别的')),
      ),
      h('div', { style: 'margin-top:22px' },
        h('h2', { class: 'section-title' }, `匹配结果（${matches.length} 条）`),
        cards),
    );
  }

  drawSteps();
  step1();
  refreshUser();
}
