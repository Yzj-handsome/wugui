/* 接口客户端：与后端 §11.5 的 REST 一一对应。
   所有请求都带 cookie（同源），出错时抛出带 detail 的 Error。 */

const json = { 'Content-Type': 'application/json' };

async function request(path, { method = 'GET', body, raw } = {}) {
  const res = await fetch(path, {
    method,
    credentials: 'same-origin',
    headers: body && !raw ? json : undefined,
    body: body ? (raw ? body : JSON.stringify(body)) : undefined,
  });
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!res.ok) {
    let detail = (data && data.detail) || `请求失败（${res.status}）`;
    // FastAPI 的校验错误是数组，取第一条的可读信息
    if (Array.isArray(detail)) {
      const first = detail[0] || {};
      detail = String(first.msg || '参数不合法').replace(/^Value error,\s*/, '');
    }
    const err = new Error(typeof detail === 'string' ? detail : JSON.stringify(detail));
    err.status = res.status; err.data = data;
    throw err;
  }
  return data;
}

export const api = {
  meta: () => request('/api/meta'),
  status: () => request('/api/status'),
  config: () => request('/api/config'),
  whoami: () => request('/api/auth/me'),
  login: (payload) => request('/api/auth/login', { method: 'POST', body: payload }),
  register: (payload) => request('/api/auth/register', { method: 'POST', body: payload }),
  logout: () => request('/api/auth/logout', { method: 'POST' }),
  users: () => request('/api/auth/users'),

  items: (params = {}) => request('/api/items?' + new URLSearchParams(params)),
  item: (id) => request(`/api/items/${id}`),
  createItem: (payload) => request('/api/items', { method: 'POST', body: payload }),
  updateItem: (id, payload) => request(`/api/items/${id}`, { method: 'PATCH', body: payload }),
  deleteItem: (id) => request(`/api/items/${id}`, { method: 'DELETE' }),
  itemMatches: (id, refresh = false) =>
    request(`/api/items/${id}/matches?refresh=${refresh ? 'true' : 'false'}`),
  explain: (id, otherId) => request(`/api/items/${id}/explain?other_id=${otherId}`),
  feedback: (matchId, action, note) =>
    request(`/api/matches/${matchId}/feedback`, { method: 'POST', body: { action, note } }),

  preview: (payload) => request('/api/match/preview', { method: 'POST', body: payload }),

  createClaim: (itemId) => request(`/api/items/${itemId}/claims`, { method: 'POST', body: {} }),
  claim: (id) => request(`/api/claims/${id}`),
  answer: (id, answers, evidence) =>
    request(`/api/claims/${id}/answers`, { method: 'POST', body: { answers, evidence_keys: evidence || [] } }),
  handover: (id, code) => request(`/api/claims/${id}/handover`, { method: 'POST', body: { code } }),
  regenerateCode: (id) => request(`/api/claims/${id}/handover/regenerate`, { method: 'POST' }),
  reviewClaim: (id, approve) => request(`/api/claims/${id}/review`, { method: 'POST', body: { approve } }),
  itemClaims: (itemId) => request(`/api/items/${itemId}/claims`),

  inbox: (onlyUnread = false) => request(`/api/inbox?only_unread=${onlyUnread}`),
  markRead: (id) => request('/api/inbox/read', { method: 'POST', body: { id } }),
  deliver: () => request('/api/inbox/deliver', { method: 'POST' }),

  chat: (message, context, history) =>
    request('/api/agent/chat', { method: 'POST', body: { message, context: context || {}, history: history || [] } }),
  importChat: (text) => request('/api/ingest/import', { method: 'POST', body: { text } }),
  publishDrafts: (drafts) => request('/api/ingest/publish', { method: 'POST', body: { drafts } }),
  ingestMessage: (payload) => request('/api/ingest/message', { method: 'POST', body: payload }),
  flushIngest: (source) => request(`/api/ingest/flush${source ? '?source=' + source : ''}`, { method: 'POST' }),
  messages: (label) => request(`/api/ingest/messages${label ? '?label=' + label : ''}`),

  metrics: (days = 14) => request(`/api/admin/metrics?days=${days}`),
  overview: () => request('/api/admin/overview'),
  adminItems: (status) => request(`/api/admin/items${status ? '?status=' + status : ''}`),
  modelStatus: () => request('/api/admin/models/status'),
  trainModels: () => request('/api/admin/models/train', { method: 'POST' }),
  job: (name) => request(`/api/admin/jobs/${name}`, { method: 'POST' }),
  notifications: () => request('/api/admin/notifications'),
  fieldFeedback: () => request('/api/admin/field-feedback'),
};

/* SSE：试匹配的流式结果（§11.4） */
export async function streamPreview(payload, handlers = {}) {
  const res = await fetch('/api/match/preview/stream', {
    method: 'POST',
    credentials: 'same-origin',
    headers: json,
    body: JSON.stringify(payload),
  });
  if (!res.ok || !res.body) {
    const text = await res.text().catch(() => '');
    let detail = `请求失败（${res.status}）`;
    try { detail = JSON.parse(text).detail || detail; } catch { /* ignore */ }
    throw new Error(detail);
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buf = '';
  const dispatch = (event, data) => { if (handlers[event]) handlers[event](data); };
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const parts = buf.split('\n\n');
    buf = parts.pop();
    for (const chunk of parts) {
      const lines = chunk.split('\n');
      let event = 'message';
      let data = '';
      for (const line of lines) {
        if (line.startsWith('event:')) event = line.slice(6).trim();
        else if (line.startsWith('data:')) data += line.slice(5).trim();
      }
      if (!data) continue;
      try { dispatch(event, JSON.parse(data)); } catch { /* ignore */ }
    }
  }
  return handlers.done ? handlers.done() : null;
}

/* 图片压缩：长边 1568px，转 JPEG（§11.3） */
export async function compressImage(file, maxSide = 1568, quality = 0.86) {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  canvas.getContext('2d').drawImage(bitmap, 0, 0, w, h);
  bitmap.close?.();
  return canvas.toDataURL('image/jpeg', quality);
}

export function fileToDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
