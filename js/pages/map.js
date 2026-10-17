/* 校园失物地图：把地点坐标画成热力大屏（给保卫处看「哪里、什么时候最丢东西」） */

import { api } from '../api.js';
import { h, icon, emptyState } from '../ui.js';

const PERIODS = [['all', '全部时段'], ['morning', '上午 6-12'], ['afternoon', '下午 12-18'],
  ['evening', '晚上 18-24'], ['night', '深夜 0-6']];

export async function renderMap(main) {
  const wrap = h('div', { class: 'wrap' });
  main.append(h('div', { class: 'section' }, wrap));

  let period = 'all';
  let kind = 'all';

  const head = h('div', { class: 'row row--between', style: 'align-items:flex-start;margin-bottom:6px' },
    h('div', {},
      h('h1', { class: 'hall-title' }, '校园失物地图'),
      h('p', { class: 'small muted', style: 'margin:6px 0 0' },
        '热力点大小 = 该地点的线索数量；切换时段看「什么时候最容易丢东西」。')));
  const controls = h('div', { class: 'row', style: 'margin:14px 0 18px;flex-wrap:wrap' });
  const stats = h('div', { class: 'hall-stats', style: 'grid-template-columns:repeat(3,1fr)' });
  const board = h('div', { class: 'map-board' });
  const ranking = h('div', { class: 'panel', style: 'margin-top:16px' });
  wrap.append(head, controls, stats, board, ranking);

  function drawControls() {
    controls.innerHTML = '';
    for (const [key, label] of [['all', '全部'], ['lost', '失物'], ['found', '拾物']]) {
      controls.append(h('button', {
        class: `chip${kind === key ? ' is-active' : ''}`,
        onclick: () => { kind = key; drawControls(); load(); },
      }, label));
    }
    controls.append(h('span', { style: 'width:10px' }));
    for (const [key, label] of PERIODS) {
      controls.append(h('button', {
        class: `chip${period === key ? ' is-active' : ''}`,
        onclick: () => { period = key; drawControls(); load(); },
      }, label));
    }
  }

  function dotColor(p) {
    if (kind === 'lost') return '#2563eb';
    if (kind === 'found') return '#059669';
    return p.lost >= p.found ? '#2563eb' : '#059669';
  }

  async function load() {
    board.innerHTML = '';
    stats.innerHTML = '';
    ranking.innerHTML = '';
    const q = new URLSearchParams();
    if (kind !== 'all') q.set('kind', kind);
    q.set('period', period);
    let data;
    try {
      data = await api.map(q.toString());
    } catch (err) {
      board.append(emptyState('地图数据加载失败', err.message));
      return;
    }
    const points = data.points || [];
    if (!points.length) {
      board.append(emptyState('这个时段没有线索', '换个时段或看全部。'));
      return;
    }

    const maxCount = Math.max(...points.map((p) => p.count));
    for (const [label, value, note] of [
      ['线索总数', String(data.total), '当前筛选条件下'],
      ['覆盖地点', String(points.length), '有坐标记录的校园地点'],
      ['最热地点', (data.hotspots[0] || {}).name || '—', `${(data.hotspots[0] || {}).count || 0} 条`],
    ]) {
      stats.append(h('div', { class: 'hall-stat' },
        h('div', { class: 'hall-stat__num' }, value),
        h('div', { class: 'small muted' }, label),
        h('div', { class: 'small muted' }, note)));
    }

    // SVG 热力板（等比缩放到容器）
    const W = 1000;
    const H = 560;
    const pad = 60;
    const svgNS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    svg.setAttribute('class', 'map-svg');
    // 底纹
    const bg = document.createElementNS(svgNS, 'rect');
    bg.setAttribute('width', W);
    bg.setAttribute('height', H);
    bg.setAttribute('rx', 18);
    bg.setAttribute('fill', 'var(--bg-soft)');
    svg.append(bg);
    for (let i = 1; i < 6; i += 1) {
      const line = document.createElementNS(svgNS, 'line');
      line.setAttribute('x1', pad);
      line.setAttribute('x2', W - pad);
      line.setAttribute('y1', pad + ((H - pad * 2) / 5) * i);
      line.setAttribute('y2', pad + ((H - pad * 2) / 5) * i);
      line.setAttribute('stroke', 'var(--border)');
      line.setAttribute('stroke-dasharray', '4 8');
      svg.append(line);
    }
    const px = (p) => pad + p.nx * (W - pad * 2);
    const py = (p) => H - pad - p.ny * (H - pad * 2);
    for (const p of points) {
      const r = 12 + (p.count / maxCount) * 42;
      const circle = document.createElementNS(svgNS, 'circle');
      circle.setAttribute('cx', px(p));
      circle.setAttribute('cy', py(p));
      circle.setAttribute('r', r);
      circle.setAttribute('fill', dotColor(p));
      circle.setAttribute('opacity', '0.18');
      svg.append(circle);
      const core = document.createElementNS(svgNS, 'circle');
      core.setAttribute('cx', px(p));
      core.setAttribute('cy', py(p));
      core.setAttribute('r', Math.max(5, r * 0.22));
      core.setAttribute('fill', dotColor(p));
      svg.append(core);
      const label = document.createElementNS(svgNS, 'text');
      label.setAttribute('x', px(p));
      label.setAttribute('y', py(p) + r + 16);
      label.setAttribute('text-anchor', 'middle');
      label.setAttribute('class', 'map-label');
      label.textContent = `${p.name}${p.count > 1 ? ` ·${p.count}` : ''}`;
      svg.append(label);
    }
    board.append(svg);

    ranking.append(
      h('h3', { style: 'margin:0 0 10px;font-size:16px' }, '热点排行'),
      h('div', { class: 'hall-list' }, ...(data.hotspots || []).map((p, i) => h('div', { class: 'hall-item' },
        h('span', { class: 'map-rank' }, String(i + 1)),
        h('div', { class: 'hall-item__body' },
          h('div', { class: 'hall-item__title' }, p.name),
          h('div', { class: 'small muted' },
            `失物 ${p.lost} · 拾物 ${p.found} · 合计 ${p.count}`)),
        h('span', { class: 'chip' }, `${p.count} 条`)))));
  }

  drawControls();
  await load();
}
