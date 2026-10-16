/* 物归 · 静态演示版适配层（GitHub Pages 用）
 *
 * 原理：在 app.js 之前加载，接管 window.fetch——
 *   · 以 /api/ 开头的请求：用 demo-data.js 里的预置数据就地应答（含匹配流回放）
 *   · 其它请求（图片、CSS、JS）：原样放行
 * 这样整套前端在纯静态托管上也能完整跑起来，不需要后端。
 *
 * 数据由 scripts/build_static_demo.py 生成；本文件由 scripts/static_demo_shim.js 复制而来。
 */
(function () {
  const PACK = window.WUGUI_DEMO || {};
  const DATA = PACK.data || {};
  const STREAMS = PACK.streams || {};
  const realFetch = window.fetch.bind(window);
  const enc = new TextEncoder();
  const USER_KEY = 'wugui-demo-user';
  const claims = {};                       // 认领流程的内存状态

  const json = (data, status = 200) => new Response(JSON.stringify(data), {
    status, headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
  const ok = () => json({ ok: true, demo: true });
  const itemOf = (id) => (DATA.items || []).find((i) => i.id === id) || null;

  function currentUser() {
    try { return JSON.parse(localStorage.getItem(USER_KEY) || 'null'); } catch { return null; }
  }

  // ---------------- 详情（拿不到就用模板 + 覆盖字段，保证结构一致） ----------------
  const TPL_KEY = Object.keys(DATA.details || {})[0];
  const TPL = (DATA.details || {})[TPL_KEY] || {};

  function detailOf(id) {
    if (DATA.details[id]) return DATA.details[id];
    const b = itemOf(id) || claims[id] || {};
    return {
      ...TPL,
      id,
      kind: b.kind || 'found',
      status: b.status || 'active',
      title: b.title || '新发布的物品',
      canonical_desc: b.canonical_desc || b.raw_text || '',
      category_l1: b.category_l1 || '其他',
      category_l2: b.category_l2 || '其他',
      colors: b.colors || [],
      brand: b.brand || null,
      location: b.location || '未填写',
      occurred_text: b.occurred_text || '',
      occurred_from: b.occurred_from || null,
      occurred_to: b.occurred_to || null,
      source: 'web',
      cover_url: b.cover_url || null,
      images: b.cover_url ? [{ id: 'demo', role: 'display', url: b.cover_url }] : [],
      raw_text: b.raw_text || b.canonical_desc || '',
      public_marks: b.public_marks || [],
      ocr_text: [],
      is_document: false,
      owner_id: 'demo-user',
      created_at: new Date().toISOString(),
      contact: null,
      contact_visible: false,
      contact_locked_reason: '静态演示版：不提供联系方式',
      demo: true,
    };
  }

  // ---------------- 列表筛选（让筛选面板在静态版里也能用） ----------------
  function filterItems(sp) {
    let list = (DATA.items || []).slice();
    const kind = sp.get('kind');
    if (kind) list = list.filter((i) => i.kind === kind);
    const q = (sp.get('q') || '').trim().toLowerCase();
    if (q) {
      list = list.filter((i) =>
        `${i.title || ''} ${i.canonical_desc || ''}`.toLowerCase().includes(q));
    }
    const l1 = sp.get('category_l1');
    if (l1) list = list.filter((i) => i.category_l1 === l1);
    const loc = sp.get('location');
    if (loc) list = list.filter((i) => (i.location || '').includes(loc));
    const when = (i) => i.occurred_from || i.created_at || '';
    const df = sp.get('date_from');
    if (df) list = list.filter((i) => when(i) >= df);
    const dt = sp.get('date_to');
    if (dt) list = list.filter((i) => when(i) <= (dt.length === 10 ? `${dt}T23:59:59` : dt));
    if (sp.get('mine')) list = list.slice(0, 5);
    const total = list.length;
    const offset = Number(sp.get('offset') || 0);
    const limit = Math.min(Number(sp.get('limit') || 20), 100);
    return { total, items: list.slice(offset, offset + limit), demo: true };
  }

  // ---------------- 匹配流（按关键词挑一条预置流，逐段推给前端） ----------------
  function pickStream(text) {
    const t = String(text || '');
    const pick = (k) => STREAMS[k] || STREAMS.q1 || '';
    if (/耳机|airpods|蓝牙|耳塞/i.test(t)) return pick('q1');
    if (/保温杯|水杯|杯子/.test(t)) return pick('q2');
    if (/钥匙|挂件|小熊/.test(t)) return pick('q3');
    if (/校园卡|饭卡|卡套/.test(t)) return pick('q4');
    return pick('q1');
  }

  function sseResponse(text) {
    const events = String(text).split('\n\n').filter((s) => s.trim());
    const stream = new ReadableStream({
      start(controller) {
        let i = 0;
        const push = () => {
          if (i >= events.length) { controller.close(); return; }
          controller.enqueue(enc.encode(`${events[i]}\n\n`));
          i += 1;
          setTimeout(push, 220);
        };
        push();
      },
    });
    return new Response(stream, {
      status: 200, headers: { 'Content-Type': 'text/event-stream' },
    });
  }

  function eventData(text, wanted) {
    let out = null;
    String(text).split('\n\n').forEach((chunk) => {
      let ev = 'message'; let data = '';
      chunk.split('\n').forEach((line) => {
        if (line.startsWith('event:')) ev = line.slice(6).trim();
        else if (line.startsWith('data:')) data += line.slice(5).trim();
      });
      if (ev === wanted && data) { try { out = JSON.parse(data); } catch (e) { /* ignore */ } }
    });
    return out;
  }

  // ---------------- 认领流程（静态版：题目来自可见属性，答案直接判通过） ----------------
  function makeClaim(itemId) {
    const b = itemOf(itemId) || {};
    const color = (b.colors && b.colors[0]) || '其它';
    const questions = [
      { id: 'q1', type: 'choice', text: '这件物品的主要颜色是？',
        options: [color, '黑色', '白色', '蓝色'], hint: null },
      { id: 'q2', type: 'choice', text: '它是在哪里被捡到 / 丢失的？',
        options: [b.location || '校园里', '宿舍区', '食堂', '运动场'], hint: null },
      { id: 'q3', type: 'open', text: '写下只有主人知道的细节（贴纸、刻字、划痕都可以）',
        options: null, hint: '静态演示版：任意填写都会通过' },
    ];
    const claim = {
      claim_id: `demo-${Date.now().toString(36)}`,
      status: 'verifying',
      attempts: 0,
      item_id: itemId,
      item: b,
      questions,
      grades: null,
      result: null,
      needs_offline: false,
      owner_contact: null,
      handover_expires_at: new Date(Date.now() + 7 * 864e5).toISOString(),
      demo: true,
    };
    claims[claim.claim_id] = claim;
    return claim;
  }

  function briefByItemId(itemId) {
    return itemOf(itemId) || null;
  }

  // ---------------- 发布（静态版：生成一条本地物品，刷新即消失） ----------------
  function publish(body) {
    const id = `demo-${Date.now().toString(36)}`;
    const now = new Date();
    const item = {
      id, kind: body.kind || 'found', status: 'active',
      title: body.title || '新发布的物品',
      canonical_desc: body.canonical_desc || body.raw_text || '',
      category_l1: body.category_l1 || '其他', category_l2: body.category_l2 || '其他',
      colors: body.colors || [], brand: body.brand || null,
      location: body.location || '未填写',
      occurred_text: now.toLocaleDateString('zh-CN'),
      occurred_from: (body.occurred_from || now.toISOString()).slice(0, 19),
      occurred_to: null, source: 'web', cover_url: body.cover_url || null,
      raw_text: body.raw_text || '', public_marks: body.public_marks || [],
      demo: true,
    };
    DATA.items = [item, ...(DATA.items || [])];
    claims[id] = item;                       // 供 detailOf 兜底取字段
    return { id, item, matches: [], demo: true };
  }

  // ---------------- fetch 接管 ----------------
  window.fetch = async function (input, init) {
    let url;
    try {
      url = new URL(typeof input === 'string' ? input : (input && input.url) || '', location.href);
    } catch (e) {
      return realFetch(input, init);
    }
    if (!url.pathname.startsWith('/api/')) return realFetch(input, init);

    const p = url.pathname;
    const method = String((init && init.method) || (typeof input !== 'string' && input && input.method) || 'GET').toUpperCase();
    let body = null;
    try { body = init && init.body ? JSON.parse(init.body) : null; } catch (e) { body = null; }

    // —— 基础 ——
    if (p === '/api/meta') return json(DATA.meta || {});
    if (p === '/api/status') return json(DATA.status || {});
    if (p === '/api/config') return json(DATA.config || {});

    // —— 登录态 ——
    if (p === '/api/auth/me') {
      const u = currentUser();
      return json(u ? { ...u, logged_in: true } : { logged_in: false });
    }
    if (p === '/api/auth/login') {
      const u = {
        id: 'demo-user',
        nickname: (body && (body.nickname || body.real_name)) || '演示同学',
        real_name: (body && body.real_name) || '演示同学',
        phone: (body && body.phone) || '13900000000',
        qq: (body && body.qq) || null,
        wechat: (body && body.wechat) || null,
        email: (body && body.email) || 'demo@whu.edu.cn',
        role: 'student', verified: true, student_bound: true,
        avatar_url: null, login_at: Date.now(),
      };
      localStorage.setItem(USER_KEY, JSON.stringify(u));
      return json({ logged_in: true, id: u.id, nickname: u.nickname, role: 'student',
                    verified: true, registered: true, demo: true });
    }
    if (p === '/api/auth/logout') {
      localStorage.removeItem(USER_KEY);
      return json({ logged_in: false });
    }
    if (p === '/api/auth/users') return json(DATA.users || { users: [] });

    // —— 物品 ——
    if (p === '/api/items' && method === 'GET') return json(filterItems(url.searchParams));
    if (p === '/api/items' && method === 'POST') return json(publish(body || {}));
    const mItem = p.match(/^\/api\/items\/([\w-]+)$/);
    if (mItem) {
      if (method === 'DELETE') return ok();
      return json(detailOf(mItem[1]));
    }
    const mMatches = p.match(/^\/api\/items\/([\w-]+)\/matches$/);
    if (mMatches) {
      const hit = (DATA.matches || {})[mMatches[1]];
      return json(hit || { total: 0, matches: [], demo: true });
    }
    const mExplain = p.match(/^\/api\/items\/([\w-]+)\/explain$/);
    if (mExplain) {
      const other = url.searchParams.get('other_id') || '';
      const direct = (DATA.explains || {})[`${mExplain[1]}|${other}`];
      if (direct) return json(direct);
      const anyKey = Object.keys(DATA.explains || {}).find((k) => k.startsWith(`${mExplain[1]}|`));
      if (anyKey) return json(DATA.explains[anyKey]);
      return json({ score: 0.62, tier: 'confirm', explain: ['静态演示：预置的解释样例'],
                    features: {}, labels: {} });
    }

    // —— 匹配（流式 / 普通） ——
    if (p === '/api/match/preview/stream') return sseResponse(pickStream(body && body.text));
    if (p === '/api/match/preview') {
      const sse = pickStream(body && body.text);
      const results = eventData(sse, 'results') || { items: [] };
      return json({ ...results, demo: true });
    }

    // —— 认领 ——
    const mClaims = p.match(/^\/api\/items\/([\w-]+)\/claims$/);
    if (mClaims) {
      if (method === 'POST') {
        const claim = makeClaim(mClaims[1]);
        return json({ claim_id: claim.claim_id, item: briefByItemId(mClaims[1]) || claim.item,
                      questions: claim.questions, mode: 'qa', demo: true });
      }
      return json({ claims: [] });
    }
    const mClaim = p.match(/^\/api\/claims\/([\w-]+)$/);
    if (mClaim && method === 'GET') {
      const c = claims[mClaim[1]];
      return c ? json(c) : json({ detail: '静态演示：这个认领不存在' }, 404);
    }
    if (/^\/api\/claims\/[\w-]+\/answers$/.test(p) && method === 'POST') {
      const cid = p.split('/')[3];
      const c = claims[cid];
      const answers = (body && body.answers) || [];
      return json({
        claim_id: cid,
        result: 'pass',
        grades: (c ? c.questions : answers).map((q) => ({
          question_id: q.id || q.question_id, verdict: 'match', reason: '与隐藏特征一致（静态演示）',
        })),
        handover_code: '246813',
        handover_expires_at: new Date(Date.now() + 7 * 864e5).toISOString(),
        message: '验证通过，请与拾主约定交接时间地点',
        attempts_left: 2,
        demo: true,
      });
    }
    if (/^\/api\/claims\/[\w-]+\/handover$/.test(p)) {
      return json({ ok: true, message: '交接完成（静态演示）', demo: true });
    }
    if (/^\/api\/claims\/[\w-]+\/handover\/regenerate$/.test(p)) {
      return json({ handover_code: '135790', demo: true });
    }
    if (/^\/api\/claims\/[\w-]+\/review$/.test(p)) return ok();

    // —— 消息中心 ——
    if (p === '/api/inbox') return json(DATA.inbox || { unread: 0, items: [] });
    if (p === '/api/inbox/read' || p === '/api/inbox/deliver') return ok();

    // —— 看板 ——
    if (p === '/api/admin/metrics') return json(DATA.metrics || {});
    if (p === '/api/admin/overview') return json(DATA.overview || {});
    if (p === '/api/admin/models/status') return json(DATA.models || {});
    if (p === '/api/admin/field-feedback') return json(DATA.field_feedback || {});
    if (p === '/api/admin/notifications') return json({ notifications: [] });
    if (p === '/api/admin/items') return json({ items: DATA.items || [] });

    // —— 接入 / 智能体 ——
    if (p === '/api/ingest/messages') return json(DATA.ingest_messages || { messages: [] });
    if (p.startsWith('/api/ingest/')) return ok();
    if (p === '/api/agent/chat') {
      const q = (body && body.message) || '';
      return json({
        reply: '（静态演示版）我在真实环境里会解析你的描述、检索全库线索，并给出可核对的相似点。'
             + '你可以先试首页的示例查询，比如「周二下午在图书馆三楼丢了一副黑色蓝牙耳机」。'
             + (q ? `\n\n你刚才说的是：「${q}」` : ''),
        matches: [], draft: null, demo: true,
      });
    }

    // —— 其它：一律 OK，避免演示时弹错误 ——
    return ok();
  };

  // ---------------- 一个小角标，说明这是静态演示 ----------------
  function banner() {
    if (document.getElementById('demo-flag')) return;
    const el = document.createElement('div');
    el.id = 'demo-flag';
    el.textContent = '静态演示版 · 预置数据';
    el.style.cssText = 'position:fixed;left:14px;bottom:14px;z-index:60;font-size:12px;'
      + 'padding:5px 11px;border-radius:999px;background:rgba(12,18,32,.86);color:#cbd5e1;'
      + 'border:1px solid rgba(148,163,184,.28);backdrop-filter:blur(6px)';
    document.body.appendChild(el);
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', banner);
  } else {
    banner();
  }
})();
