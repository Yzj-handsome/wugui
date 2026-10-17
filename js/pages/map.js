/* 校园失物地图：真实地图大屏（高德瓦片 + Leaflet）+ 热力点 */

import { api } from '../api.js?v=202610171035';
import { h, emptyState } from '../ui.js?v=202610171035';

const CENTER = [30.5385, 114.3615];              // 武汉大学文理学部
const M_LAT = 111320;
const M_LNG = 111320 * Math.cos((CENTER[0] * Math.PI) / 180);

const PERIODS = [['all', '全部时段'], ['morning', '上午 6-12'], ['afternoon', '下午 12-18'],
  ['evening', '晚上 18-24'], ['night', '深夜 0-6']];

function toLatLng(p) {
  const lat = CENTER[0] + p.y / M_LAT;
  const lng = CENTER[1] + p.x / M_LNG;
  return [lat + 0.0026, lng + 0.0061];            // 粗略的 GCJ-02 偏移（武汉）
}

export async function renderMap(main) {
  const wrap = h('div', { class: 'wrap' });
  main.append(h('div', { class: 'section' }, wrap));

  let period = 'all';
  let kind = 'all';

  const controls = h('div', { class: 'row map-controls' });
  const hero = h('div', { class: 'map-hero' });
  const canvas = h('div', { class: 'map-canvas' });
  const glass = h('div', { class: 'map-overlay' });
  const legend = h('div', { class: 'map-legend' },
    h('span', { class: 'map-legend__item' }, h('i', { class: 'map-dot map-dot--lost' }), '失物'),
    h('span', { class: 'map-legend__item' }, h('i', { class: 'map-dot map-dot--found' }), '拾物'));
  hero.append(canvas, glass, legend);
  const ranking = h('div', { class: 'panel', style: 'margin-top:18px' });

  wrap.append(
    h('div', { class: 'map-head' },
      h('div', {},
        h('h1', { class: 'map-title' }, '校园失物地图'),
        h('p', { class: 'map-sub' },
          '真实地图上的热力点：圆越大 = 该地点线索越多；切换时段看「什么时候最容易丢东西」。')),
      controls),
    hero,
    ranking);

  let map = null;
  let layer = null;

  function drawControls() {
    controls.innerHTML = '';
    for (const [key, label] of [['all', '全部'], ['lost', '失物'], ['found', '拾物']]) {
      controls.append(h('button', {
        class: `chip${kind === key ? ' is-active' : ''}`,
        onclick: () => { kind = key; drawControls(); load(); },
      }, label));
    }
    controls.append(h('span', { class: 'map-controls__gap' }));
    for (const [key, label] of PERIODS) {
      controls.append(h('button', {
        class: `chip${period === key ? ' is-active' : ''}`,
        onclick: () => { period = key; drawControls(); load(); },
      }, label));
    }
  }

  function ensureMap() {
    if (map || !window.L) return;
    map = window.L.map(canvas, { zoomControl: true, attributionControl: true })
      .setView(CENTER, 15);
    window.L.tileLayer(
      'https://webrd0{s}.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=8&x={x}&y={y}&z={z}',
      { subdomains: ['1', '2', '3', '4'], maxZoom: 19, attribution: '地图 © 高德' },
    ).addTo(map);
    layer = window.L.layerGroup().addTo(map);
    window.setTimeout(() => map.invalidateSize(), 120);
  }

  function svgFallback(points) {
    const W = 1000; const H = 600; const pad = 70;
    const NS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    svg.setAttribute('class', 'map-svg');
    const bg = document.createElementNS(NS, 'rect');
    bg.setAttribute('width', W); bg.setAttribute('height', H);
    bg.setAttribute('rx', 18); bg.setAttribute('fill', 'var(--bg-soft)');
    svg.append(bg);
    const max = Math.max(...points.map((p) => p.count));
    for (const p of points) {
      const cx = pad + p.nx * (W - pad * 2);
      const cy = H - pad - p.ny * (H - pad * 2);
      const r = 14 + (p.count / max) * 48;
      const c = document.createElementNS(NS, 'circle');
      c.setAttribute('cx', cx); c.setAttribute('cy', cy); c.setAttribute('r', r);
      c.setAttribute('fill', p.lost >= p.found ? '#2563eb' : '#059669');
      c.setAttribute('opacity', '0.16');
      svg.append(c);
      const t = document.createElementNS(NS, 'text');
      t.setAttribute('x', cx); t.setAttribute('y', cy + r + 18);
      t.setAttribute('text-anchor', 'middle'); t.setAttribute('class', 'map-label');
      t.textContent = `${p.name}${p.count > 1 ? ` ·${p.count}` : ''}`;
      svg.append(t);
    }
    canvas.append(svg);
  }

  function drawGlass(data) {
    glass.innerHTML = '';
    const hot = (data.hotspots || [])[0] || {};
    const cell = (value, label, cls = '') => h('div', { class: 'map-glass' },
      h('div', { class: `map-glass__value ${cls}` }, value),
      h('div', { class: 'map-glass__label' }, label));
    glass.append(
      cell(String(data.total), '线索总数'),
      cell(String((data.points || []).length), '覆盖地点'),
      cell(hot.name || '—', '最热地点', 'map-glass__value--text'));
  }

  async function load() {
    glass.innerHTML = '';
    ranking.innerHTML = '';
    canvas.innerHTML = '';
    map = null; layer = null;

    const q = new URLSearchParams();
    if (kind !== 'all') q.set('kind', kind);
    q.set('period', period);
    let data;
    try {
      data = await api.map(q.toString());
    } catch (err) {
      canvas.append(emptyState('地图数据加载失败', err.message));
      return;
    }
    const points = data.points || [];
    drawGlass(data);
    if (!points.length) {
      canvas.append(emptyState('这个时段没有线索', '换个时段或看全部。'));
      return;
    }

    if (window.L) {
      ensureMap();
      const max = Math.max(...points.map((p) => p.count));
      for (const p of points) {
        const color = kind === 'lost' ? '#2563eb'
          : kind === 'found' ? '#059669'
            : (p.lost >= p.found ? '#2563eb' : '#059669');
        window.L.circle(toLatLng(p), {
          radius: 90 + (p.count / max) * 320,
          color: 'transparent', fillColor: color, fillOpacity: 0.12,
        }).addTo(layer);
        window.L.circleMarker(toLatLng(p), {
          radius: 9 + (p.count / max) * 20,
          color: '#ffffff', weight: 2,
          fillColor: color, fillOpacity: 0.92,
        }).bindPopup(
          `<strong>${p.name}</strong><br/>失物 ${p.lost} · 拾物 ${p.found} · 合计 ${p.count}`,
        ).addTo(layer);
      }
      window.setTimeout(() => map && map.invalidateSize(), 120);
    } else {
      svgFallback(points);
    }

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
