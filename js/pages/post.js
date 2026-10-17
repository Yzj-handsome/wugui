/* 发布页：两步 —— 结构化填写 → 预览发布（第三步展示匹配）
 *
 * 「我丢了」与「我捡到了」共用同一套结构化字段：
 *   物品类别 / 材质 / 颜色 / 显著特征 / 特殊标记 / 补充说明 + 照片
 *   「我丢了」可填丢失时间、丢失地点；「我捡到了」可填捡到时间、捡到地点 + 联系方式（必填）
 * 补充说明和照片可选投给 AI 做「补全」：只填你没填的字段，不动你写过的。
 */

import { api, compressImage } from '../api.js?v=202610171027';
import {
  h, icon, toast, field, select, matchCard, emptyState, sourceText, locationPicker,
} from '../ui.js?v=202610171027';
import { state } from '../app.js?v=202610171027';

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
    images: [],
    parsed: null,
    item: null,
    matches: [],
    contactType: 'wechat',
    contactValue: '',
    form: {
      category_l1: '', category_l2: '', material: '',
      colors: [], customColor: '',
      public_marks: '', secret_marks: '', note: '',
      location: '', when: '',
    },
  };

  const wrap = h('div', { class: 'wrap wrap--narrow' });
  main.append(h('div', { class: 'section' }, wrap));

  const stepsBar = h('div', { class: 'steps' });
  function drawSteps() {
    const labels = ['填写信息', '预览发布', '完成'];
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

  /* ---------------- 第一步：结构化填写 ---------------- */
  function step1() {
    const meta = state.meta || { categories: {}, colors: [], tree: [], groups: [] };
    const f = session.form;

    /* 类别 */
    const catL1 = select(Object.keys(meta.categories || {}),
      f.category_l1, (v) => {
        f.category_l1 = v;
        f.category_l2 = (meta.categories[v] || [])[0] || '';
        redrawCat2();
      }, '（选填）选择一级类别');
    catL1.classList.add('input');
    const catL2Box = h('div', {});
    function redrawCat2() {
      catL2Box.innerHTML = '';
      const subs = meta.categories[f.category_l1] || [];
      if (!subs.length) return;
      const sel = select(subs, f.category_l2, (v) => { f.category_l2 = v; }, '（选填）选择二级类别');
      sel.classList.add('input');
      catL2Box.append(sel);
    }
    redrawCat2();

    /* 材质 */
    const materialIn = h('input', {
      class: 'input', value: f.material, placeholder: '如：帆布 / 塑料 / 不锈钢 / 皮革',
      oninput: (e) => { f.material = e.target.value; },
    });

    /* 颜色：预置色块 + 自定义 */
    const colorRow = h('div', { class: 'chips color-chips' });
    const colorCustom = h('input', {
      class: 'input', value: f.customColor, placeholder: '也可以直接写：深蓝、米白…',
      oninput: (e) => { f.customColor = e.target.value; },
    });
    for (const name of (meta.colors || []).slice(0, 14)) {
      const chip = h('button', {
        class: `chip chip--color${f.colors.includes(name) ? ' is-active' : ''}`,
        type: 'button',
        onclick: () => {
          f.colors = f.colors.includes(name)
            ? f.colors.filter((x) => x !== name)
            : [...f.colors, name];
          chip.classList.toggle('is-active');
        },
      }, h('i', { class: `dot dot--${name}` }), name);
      colorRow.append(chip);
    }

    /* 显著特征 / 特殊标记 / 补充说明 */
    const marksIn = h('input', {
      class: 'input', value: f.public_marks,
      placeholder: '如：杯身有一道划痕 / 贴着黄色贴纸',
      oninput: (e) => { f.public_marks = e.target.value; },
    });
    const secretIn = h('input', {
      class: 'input', value: f.secret_marks,
      placeholder: '如：杯底刻了 WXYZ / 内衬写有名字',
      oninput: (e) => { f.secret_marks = e.target.value; },
    });
    const noteIn = h('textarea', {
      class: 'textarea',
      placeholder: session.kind === 'lost'
        ? '补充说明（选填）：时间、经过、还丢了什么……写了会作为匹配依据'
        : '补充说明（选填）：在哪捡到的、当时的情况……写了会作为匹配依据',
      oninput: () => { f.note = noteIn.value; },
    }, f.note);

    /* 时间与地点 */
    const whenLabel = session.kind === 'lost' ? '丢失时间' : '捡到时间';
    const whereLabel = session.kind === 'lost' ? '丢失地点' : '捡到地点';
    const whenIn = h('input', {
      class: 'input', type: 'datetime-local', value: f.when,
      oninput: (e) => { f.when = e.target.value; },
    });
    const locSel = locationPicker({
      tree: meta.tree || [],
      groups: meta.groups || [],
      value: f.location,
      placeholder: '（选填）点这里选择地点',
      onChange: (v) => { f.location = v; },
    });

    /* 照片 */
    const thumbs = h('div', { class: 'thumb-row', style: 'margin-top:12px' });
    const file = h('input', { type: 'file', accept: 'image/*', multiple: true, hidden: true });
    const zone = h('div', { class: 'dropzone' },
      icon('upload'),
      h('div', { class: 'strong' }, '拖拽或点击上传照片（最多 3 张）'),
      h('div', { class: 'small muted' },
        session.kind === 'found'
          ? '建议拍两张：一张正面展示图，一张细节图（背面、内部、挂件）。细节图不公开，只用来出验证题。'
          : '有旧照片的话一起传上来，图像相似度会参与匹配。'),
      file);
    zone.addEventListener('click', () => file.click());
    zone.addEventListener('dragover', (e) => { e.preventDefault(); zone.classList.add('is-over'); });
    zone.addEventListener('dragleave', () => zone.classList.remove('is-over'));
    zone.addEventListener('drop', (e) => {
      e.preventDefault(); zone.classList.remove('is-over');
      addImages(e.dataTransfer.files);
    });
    file.addEventListener('change', () => { addImages(file.files); file.value = ''; });

    async function addImages(files) {
      for (const item of Array.from(files).slice(0, 3 - session.images.length)) {
        if (!item.type.startsWith('image/')) continue;
        try {
          const data = await compressImage(item);
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

    /* 联系方式（拾主必填） */
    const contactValue = h('input', {
      class: 'input',
      placeholder: CONTACT_RULES[session.contactType]?.hint || '',
      value: session.contactValue || '',
      oninput: (e) => { session.contactValue = e.target.value.trim(); },
    });
    const typeRow = h('div', { class: 'seg' });
    for (const [value, label] of [['wechat', '微信'], ['phone', '手机号'], ['qq', 'QQ 号'], ['email', '邮箱']]) {
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
      h('div', { style: 'margin-top:10px' }, contactValue));
    const contactToggle = () => { contactBox.hidden = session.kind !== 'found'; };
    contactToggle();

    /* 顶部类型切换 */
    const tabs = h('div', { class: 'composer__tabs' });
    for (const [key, label] of [['lost', '我丢了'], ['found', '我捡到了']]) {
      const tab = h('button', { class: `composer__tab${key === session.kind ? ' is-active' : ''}` }, label);
      tab.addEventListener('click', () => {
        session.kind = key;
        tabs.querySelectorAll('.composer__tab').forEach((t) => t.classList.remove('is-active'));
        tab.classList.add('is-active');
        contactToggle();
        step1();
      });
      tabs.append(tab);
    }

    const aiBtn = h('button', { class: 'btn', onclick: () => runParse(true) }, 'AI 帮我补全（可选）');
    const nextBtn = h('button', { class: 'btn btn--primary btn--lg', onclick: () => runParse(false) },
      '下一步：预览发布 →');

    /* 拍照自动填表：只给照片，让系统反推类别/颜色/材质/特征/文字 */
    const photoFillBtn = h('button', {
      class: 'btn btn--sm',
      onclick: async () => {
        if (!session.images.length) { toast('请先上传照片', 'err'); return; }
        photoFillBtn.disabled = true;
        const old = photoFillBtn.textContent;
        photoFillBtn.textContent = '正在识别照片…';
        try {
          const r = await api.suggestFromPhotos(session.images);
          const filled = [];
          if (!f.category_l1 && r.category_l1) {
            f.category_l1 = r.category_l1;
            f.category_l2 = r.category_l2 || '';
            filled.push('类别');
          }
          if (!f.colors.length && !f.customColor && (r.colors || []).length) {
            f.colors = r.colors.slice(0, 3);
            filled.push('颜色');
          }
          if (!f.material && r.material) { f.material = r.material; filled.push('材质'); }
          if (!f.public_marks && (r.public_marks || []).length) {
            f.public_marks = r.public_marks.join('；');
            filled.push('显著特征');
          }
          if (!f.note && (r.ocr_text || []).length) {
            f.note = `图片上识别到文字：${r.ocr_text.join('、')}`;
            filled.push('补充说明');
          }
          if (filled.length) toast(`已从照片填上：${filled.join('、')}，请核对`, 'ok');
          else toast('照片没识别出新字段，可以手动补充', '');
          step1();
        } catch (err) {
          toast(err.message, 'err');
        } finally {
          photoFillBtn.disabled = false;
          photoFillBtn.textContent = old;
        }
      },
    }, '📷 从照片自动填表');

    body.innerHTML = '';
    body.append(
      h('h2', { class: 'section-title' }, '填写信息'),
      h('div', { class: 'panel stack' },
        tabs,
        h('div', { class: 'form-divider form-field--full' }, '结构化描述（都选填，填得越多匹配越准）'),
        h('div', { class: 'form-grid' },
          field('物品类别', h('div', { class: 'stack', style: 'gap:8px' }, catL1, catL2Box)),
          field('材质', materialIn),
          field('颜色', h('div', { class: 'stack', style: 'gap:8px' }, colorRow, colorCustom), '点色块多选，也可手写'),
          field('显著特征', marksIn, '公开可见，帮助失主核对'),
          field('特殊标记', secretIn, '不公开：只用于认领验证出题（如刻字、内衬签名）'),
        ),
        field('补充说明', noteIn),
        field(whenLabel, whenIn, '不填也可以'),
        field(whereLabel, locSel),
        contactBox,
        h('div', { class: 'form-divider form-field--full' }, '照片'),
        zone,
        thumbs,
        h('div', { class: 'row', style: 'margin-top:10px' }, photoFillBtn,
          h('span', { class: 'small muted' }, '上传后可以让系统自动识别，省去手填')),
        h('div', { class: 'form-note' }, icon('shield'),
          '照片会被 AI 分析；人脸、证件号与隐藏特征区域会先打码再公开。'),
        h('div', { class: 'row row--between', style: 'margin-top:6px' },
          h('div', { class: 'row' }, nextBtn, aiBtn),
          h('button', { class: 'btn btn--ghost', onclick: () => { location.hash = '#/'; } }, '取消')),
      ),
    );

    /* 只有补充说明与照片是「可选投喂」；结构化字段由用户直接填写，过滤空值后转发 */
    function structuredPayload() {
      const colors = [...f.colors, ...f.customColor.split(/[、,，\s]+/).filter(Boolean)];
      const splitMarks = (s) => s.split(/[；;、\n]+/).map((x) => x.trim()).filter(Boolean);
      return {
        category_l1: f.category_l1 || null,
        category_l2: f.category_l2 || null,
        material: f.material.trim() || null,
        colors: [...new Set(colors)],
        public_marks: splitMarks(f.public_marks),
        secret_marks: splitMarks(f.secret_marks),
      };
    }

    async function runParse(withAi) {
      const structured = structuredPayload();
      const hasStructured = structured.category_l1 || structured.material
        || structured.colors.length || structured.public_marks.length;
      if (!f.note.trim() && !session.images.length && !hasStructured) {
        toast('至少填一项：类别 / 材质 / 颜色 / 特征，或写一句补充说明、传一张照片', 'err');
        return;
      }
      if (session.kind === 'found') {
        const issue = checkContact(session.contactType, session.contactValue);
        if (issue) {
          toast(issue, 'err');
          contactValue.focus();
          return;
        }
      }

      aiBtn.disabled = true; nextBtn.disabled = true;
      const oldLabel = aiBtn.textContent;
      if (withAi) aiBtn.textContent = 'AI 正在补全…';
      try {
        const res = await api.preview({
          kind: session.kind, text: f.note.trim(), image_keys: session.images,
        });
        session.parsed = res.parsed || null;
        session.matches = res.matches || [];
        session.analyzed = res.analyzed_count || 0;
        if (withAi && res.parsed) {
          // 只补空缺，不覆盖用户写过的
          const d = res.parsed.draft || {};
          if (!f.category_l1 && d.category_l1) {
            f.category_l1 = d.category_l1;
            f.category_l2 = d.category_l2 || '';
          }
          if (!f.material && d.material) f.material = d.material;
          if (!f.colors.length && (d.colors || []).length) {
            f.colors = d.colors.map((c) => (c.modifier || '') + c.name).slice(0, 3);
          }
          if (!f.public_marks && (d.public_marks || []).length) {
            f.public_marks = (d.public_marks || []).map((m) => m.text).filter(Boolean).join('；');
          }
          if (!f.location && res.parsed.location) f.location = res.parsed.location;
          if (!f.when && res.parsed.occurred_from) {
            const d2 = new Date(res.parsed.occurred_from);
            const pad = (n) => String(n).padStart(2, '0');
            f.when = `${d2.getFullYear()}-${pad(d2.getMonth() + 1)}-${pad(d2.getDate())}T${pad(d2.getHours())}:${pad(d2.getMinutes())}`;
          }
          toast('已按描述补全空缺字段，请核对', 'ok');
        }
        session.step = 2;
        drawSteps(); step2();
      } catch (err) {
        toast(err.message, 'err');
      } finally {
        aiBtn.disabled = false; nextBtn.disabled = false; aiBtn.textContent = oldLabel;
      }
    }
  }

  /* ---------------- 第二步：预览与发布 ---------------- */
  function step2() {
    const p = session.parsed || {};
    const d = p.draft || {};
    const f = session.form;
    const meta = state.meta || { locations: [], categories: {} };
    const low = new Set(p.low_conf || []);
    const isLost = session.kind === 'lost';

    const titleIn = h('input', { class: 'input', value: p.title || '', oninput: (e) => { d.title = e.target.value; } });
    const catL1View = h('input', { class: 'input', value: f.category_l1 || '未填', readonly: true });
    const catL2View = h('input', { class: 'input', value: f.category_l2 || '未填', readonly: true });
    const materialIn = h('input', {
      class: 'input', value: f.material, placeholder: '如：帆布 / 塑料',
      oninput: (e) => { f.material = e.target.value; },
    });
    const colorIn = h('input', {
      class: 'input',
      value: [...f.colors, f.customColor].filter(Boolean).join('、'),
      placeholder: '如：黑 或 深蓝',
      oninput: (e) => { f.customColor = e.target.value; f.colors = []; },
    });
    const marksIn = h('input', {
      class: 'input', value: f.public_marks, placeholder: '公开的显著特征',
      oninput: (e) => { f.public_marks = e.target.value; },
    });
    const secretIn = h('input', {
      class: 'input', value: f.secret_marks, placeholder: '不公开的特殊标记（用于认领验证）',
      oninput: (e) => { f.secret_marks = e.target.value; },
    });
    const noteView = h('textarea', {
      class: 'textarea', placeholder: '补充说明（选填）',
      oninput: () => { f.note = noteView.value; },
    }, f.note);
    const locSel = locationPicker({
      tree: meta.tree || [],
      groups: meta.groups || [],
      value: f.location || p.location || '',
      placeholder: '（选填）选择地点',
      onChange: (v) => { f.location = v; },
    });
    const timeFrom = h('input', {
      class: 'input', type: 'datetime-local', value: f.when,
      oninput: (e) => { f.when = e.target.value; },
    });

    const publishBtn = h('button', { class: 'btn btn--primary btn--lg', onclick: publish }, '确认发布');
    const backBtn = h('button', { class: 'btn', onclick: () => { session.step = 1; drawSteps(); step1(); } }, '← 改描述');

    const previewCards = h('div', { class: 'cards', style: 'grid-template-columns:repeat(auto-fill,minmax(220px,1fr))' });
    for (const m of (session.matches || []).slice(0, 3)) previewCards.append(matchCard(m, { showScore: true }));

    body.innerHTML = '';
    body.append(
      h('h2', { class: 'section-title' }, '预览与发布'),
      h('div', { class: 'row small muted', style: 'margin:-6px 0 12px' },
        icon('sparkle'),
        session.parsed && session.parsed.engine
          ? `AI 补全：${session.parsed.engine === 'vlm' ? '视觉语言模型' : '规则词典 + 向量'} · 用时 ${session.parsed.elapsed_ms || 0}ms（只补了空着的字段）`
          : '未使用 AI 补全，按你填写的结构化信息发布'),
      h('div', { class: 'panel stack' },
        h('div', { class: 'form-grid' },
          field('物品标题', titleIn, '不超过 16 字，卡片上显示的就是它', low.has('title')),
          field('一级类别', catL1View, f.category_l1 ? null : '想改的话点「← 改描述」'),
          field('二级类别', catL2View),
          field('材质', materialIn),
          field('颜色（多个用、分隔）', colorIn, null, low.has('colors')),
          field('显著特征（公开）', marksIn),
          field('特殊标记（不公开）', secretIn, '认领人要通过这些细节的验证'),
          field(isLost ? '丢失时间' : '捡到时间', timeFrom, '不填按发帖前推算'),
          field(isLost ? '丢失地点' : '捡到地点', locSel),
        ),
        field('补充说明（会作为匹配依据）', noteView),
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

    async function publish() {
      if (!state.user) {
        toast('发布需要先登录', 'err');
        location.hash = '#/login';
        return;
      }
      publishBtn.disabled = true; publishBtn.textContent = '发布中…';
      const splitMarks = (s) => s.split(/[；;、\n]+/).map((x) => x.trim()).filter(Boolean);
      const colors = [...f.colors, ...f.customColor.split(/[、,，\s]+/)].filter(Boolean);
      const overrides = {
        title: d.title || p.title || '',
        category_l1: f.category_l1 || undefined,
        category_l2: f.category_l2 || undefined,
        brand: d.brand || undefined,
        condition: d.condition || undefined,
        colors: [...new Set(colors)],
      };
      try {
        const item = await api.createItem({
          kind: session.kind,
          text: f.note || '',
          image_keys: session.images,
          overrides,
          material: f.material || null,
          public_marks: splitMarks(f.public_marks),
          secret_marks: splitMarks(f.secret_marks),
          location_name: f.location || null,
          occurred_from: f.when ? new Date(f.when).toISOString() : null,
          contact_type: session.kind === 'found' ? session.contactType : null,
          contact_value: session.kind === 'found' ? (session.contactValue || null) : null,
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
              (item.colors || []).map((c) => h('span', { class: 'chip' }, c + '色')))),
          item.cover_url
            ? h('img', {
                src: item.cover_url, alt: item.title,
                style: 'width:120px;aspect-ratio:4/3;object-fit:cover;border-radius:12px;border:1px solid var(--border)',
              })
            : null),
        h('div', { class: 'row', style: 'margin-top:6px' },
          h('a', { class: 'btn btn--sm', href: `#/items/${item.id}` }, '看详情'),
          h('a', { class: 'btn btn--sm', href: '#/hall' }, '去办事大厅'),
          h('a', { class: 'btn btn--sm btn--ghost', href: '#/' }, '再发一条'))),
      h('h2', { class: 'section-title', style: 'margin-top:24px' },
        matches.length ? `已找到 ${matches.length} 条候选线索` : '匹配结果'),
      cards,
    );
  }

  drawSteps();
  step1();
}
