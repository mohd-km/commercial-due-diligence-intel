import {
  computePriceHistogram,
  computeMoatLeaderboard,
  computeSummaryStats,
  formatCurrency,
  formatNumber,
} from '../engine/analytics.js';

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function getCorridorColor(market, corridorId) {
  const found = market.corridors.find((c) => c.id === corridorId);
  return found ? found.color : '#94a3b8';
}

export function renderScatterChart(container, venues, market, selectedVenueId, onSelectVenue, tooltipApi) {
  const width = 640;
  const height = 350;
  const pad = { top: 26, right: 26, bottom: 48, left: 54 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;

  if (!venues.length) {
    container.innerHTML = '<div class="empty-state">No venues match the active filters.</div>';
    return;
  }

  const minX = 20;
  const maxX = 100;
  const minY = 3.6;
  const maxY = 5.0;
  const maxReviews = Math.max(...venues.map((v) => v.reviews), 100);

  const sx = (val) => pad.left + ((val - minX) / (maxX - minX)) * plotW;
  const sy = (val) => pad.top + ((maxY - val) / (maxY - minY)) * plotH;
  const sr = (rev) => 5 + Math.sqrt(rev / maxReviews) * 14;

  // Quadrant reference thresholds
  const midX = 65;
  const midY = 4.35;
  const qx = sx(midX);
  const qy = sy(midY);

  const xTicks = [20, 40, 60, 80, 100];
  const yTicks = [3.6, 3.95, 4.3, 4.65, 5.0];

  const gridLinesX = xTicks
    .map(
      (t) => `
      <line x1="${sx(t)}" y1="${pad.top}" x2="${sx(t)}" y2="${height - pad.bottom}" stroke="#1c2436" stroke-width="1" />
      <text x="${sx(t)}" y="${height - pad.bottom + 18}" fill="#7c889e" font-size="10.5" font-family="var(--font-mono)" text-anchor="middle">${t}</text>`
    )
    .join('');

  const gridLinesY = yTicks
    .map(
      (t) => `
      <line x1="${pad.left}" y1="${sy(t)}" x2="${width - pad.right}" y2="${sy(t)}" stroke="#1c2436" stroke-width="1" />
      <text x="${pad.left - 10}" y="${sy(t) + 3.5}" fill="#7c889e" font-size="10.5" font-family="var(--font-mono)" text-anchor="end">${t.toFixed(2)}</text>`
    )
    .join('');

  // Render bubbles sorted largest first so smaller dots remain hoverable
  const sorted = [...venues].sort((a, b) => b.reviews - a.reviews);
  const dots = sorted
    .map((v) => {
      const cx = sx(v.densityIndex);
      const cy = sy(v.rating);
      const r = sr(v.reviews);
      const color = getCorridorColor(market, v.corridor);
      const isSelected = v.id === selectedVenueId;
      return `
        <circle
          class="scatter-dot ${isSelected ? 'is-selected' : ''}"
          data-venue-id="${escapeHtml(v.id)}"
          cx="${cx.toFixed(1)}"
          cy="${cy.toFixed(1)}"
          r="${r.toFixed(1)}"
          fill="${color}"
          fill-opacity="${isSelected ? '0.92' : '0.62'}"
          stroke="${isSelected ? '#f4f1ea' : color}"
          stroke-width="${isSelected ? '2.2' : '1.2'}"
        />`;
    })
    .join('');

  container.innerHTML = `
    <div class="svg-wrap">
      <svg viewBox="0 0 ${width} ${height}" class="chart-svg" role="img" aria-label="Competitive density versus average rating scatter plot">
        <!-- Quadrant subtle highlight for White-Space Opportunity (Low Density, Mod-High Rating) -->
        <rect x="${pad.left}" y="${pad.top}" width="${qx - pad.left}" height="${height - pad.bottom - pad.top}" fill="#10b981" fill-opacity="0.04" />
        ${gridLinesX}
        ${gridLinesY}
        <!-- Quadrant reference lines -->
        <line x1="${qx}" y1="${pad.top}" x2="${qx}" y2="${height - pad.bottom}" stroke="#334155" stroke-width="1.1" stroke-dasharray="4 4" />
        <line x1="${pad.left}" y1="${qy}" x2="${width - pad.right}" y2="${qy}" stroke="#334155" stroke-width="1.1" stroke-dasharray="4 4" />
        <!-- Quadrant labels -->
        <text x="${pad.left + 8}" y="${pad.top + 14}" fill="#10b981" fill-opacity="0.85" font-size="9.5" font-family="var(--font-mono)" letter-spacing="0.06em">UNDERSERVED / LOW DENSITY</text>
        <text x="${width - pad.right - 8}" y="${pad.top + 14}" fill="#9aa4b8" fill-opacity="0.75" font-size="9.5" font-family="var(--font-mono)" text-anchor="end" letter-spacing="0.06em">ENTRENCHED LEADERS</text>
        <text x="${pad.left + 8}" y="${height - pad.bottom - 8}" fill="#64748b" fill-opacity="0.8" font-size="9.5" font-family="var(--font-mono)" letter-spacing="0.06em">QUALITY GAP TARGETS</text>
        <text x="${width - pad.right - 8}" y="${height - pad.bottom - 8}" fill="#f59e0b" fill-opacity="0.75" font-size="9.5" font-family="var(--font-mono)" text-anchor="end" letter-spacing="0.06em">CROWDED COMMODITY</text>
        <!-- Axis titles -->
        <text x="${pad.left + plotW / 2}" y="${height - 8}" fill="#9aa4b8" font-size="11" font-family="var(--font-sans)" text-anchor="middle">Local Competitive Density Index (0–100, 1km Catchment)</text>
        <text x="15" y="${pad.top + plotH / 2}" fill="#9aa4b8" font-size="11" font-family="var(--font-sans)" text-anchor="middle" transform="rotate(-90 15 ${pad.top + plotH / 2})">Avg Rating (1.0–5.0)</text>
        <!-- Bubbles -->
        <g class="scatter-layer">${dots}</g>
      </svg>
    </div>
    <div class="chart-legend-row">
      <div class="legend-items">
        ${market.corridors
          .map(
            (c) => `<span class="legend-chip"><span class="legend-swatch" style="background:${c.color}"></span>${escapeHtml(c.label)}</span>`
          )
          .join('')}
      </div>
      <div class="legend-note">Bubble area proportional to review volume. Click any node to inspect.</div>
    </div>
  `;

  const venueMap = new Map(venues.map((v) => [v.id, v]));
  container.querySelectorAll('.scatter-dot').forEach((el) => {
    const id = el.getAttribute('data-venue-id');
    const v = venueMap.get(id);
    if (!v) return;
    el.addEventListener('mouseenter', (evt) => {
      tooltipApi.show(
        evt,
        `<div class="tt-title">${escapeHtml(v.name)}</div>
         <div class="tt-sub">${escapeHtml(v.corridor)} &middot; ${escapeHtml(v.segment)}</div>
         <div class="tt-grid">
           <span>Rating</span><span class="mono">${v.rating.toFixed(1)} / 5.0</span>
           <span>Density</span><span class="mono">${v.densityIndex}/100</span>
           <span>Price</span><span class="mono">${formatCurrency(v.price, market)}</span>
           <span>Reviews</span><span class="mono">${formatNumber(v.reviews)}</span>
         </div>`
      );
    });
    el.addEventListener('mousemove', (evt) => tooltipApi.move(evt));
    el.addEventListener('mouseleave', () => tooltipApi.hide());
    el.addEventListener('click', () => onSelectVenue(v.id));
  });
}

export function renderHistogramChart(container, venues, market, tooltipApi) {
  const width = 560;
  const height = 310;
  const pad = { top: 34, right: 20, bottom: 50, left: 42 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;

  if (!venues.length) {
    container.innerHTML = '<div class="empty-state">No pricing data available for active filters.</div>';
    return;
  }

  const stats = computeSummaryStats(venues);
  const { bins, maxBinTotal, minPrice, maxPrice } = computePriceHistogram(venues, market.corridors, 8);
  const barGap = 8;
  const barW = (plotW - barGap * (bins.length - 1)) / bins.length;
  const priceSpan = Math.max(1, maxPrice - minPrice);

  const pxToX = (priceVal) => pad.left + ((priceVal - minPrice) / priceSpan) * plotW;

  // Y-axis ticks
  const yStep = Math.max(1, Math.ceil(maxBinTotal / 4));
  const yMax = yStep * 4;
  const yTicks = [0, yStep, yStep * 2, yStep * 3, yMax];

  const yGrid = yTicks
    .map((t) => {
      const y = pad.top + plotH - (t / yMax) * plotH;
      return `
        <line x1="${pad.left}" y1="${y}" x2="${width - pad.right}" y2="${y}" stroke="#1c2436" stroke-width="1" />
        <text x="${pad.left - 8}" y="${y + 3.5}" fill="#7c889e" font-size="10.5" font-family="var(--font-mono)" text-anchor="end">${t}</text>`;
    })
    .join('');

  const barsSvg = bins
    .map((bin, idx) => {
      const x = pad.left + idx * (barW + barGap);
      let currentY = pad.top + plotH;
      const segments = market.corridors
        .map((c) => {
          const count = bin.byCorridor[c.id] || 0;
          if (!count) return '';
          const segH = (count / yMax) * plotH;
          currentY -= segH;
          return `<rect x="${x.toFixed(1)}" y="${currentY.toFixed(1)}" width="${barW.toFixed(1)}" height="${segH.toFixed(1)}" fill="${c.color}" fill-opacity="0.82" rx="1.5" />`;
        })
        .join('');

      const totalH = (bin.total / yMax) * plotH;
      const topY = pad.top + plotH - totalH;

      return `
        <g class="hist-bin" data-bin-idx="${idx}">
          ${segments}
          <rect x="${x.toFixed(1)}" y="${pad.top}" width="${barW.toFixed(1)}" height="${plotH}" fill="transparent" />
          ${bin.total > 0 ? `<text x="${(x + barW / 2).toFixed(1)}" y="${(topY - 5).toFixed(1)}" fill="#cbd5e1" font-size="10" font-family="var(--font-mono)" text-anchor="middle">${bin.total}</text>` : ''}
          <text x="${(x + barW / 2).toFixed(1)}" y="${height - pad.bottom + 16}" fill="#7c889e" font-size="9.5" font-family="var(--font-mono)" text-anchor="middle">${bin.shortLabel}</text>
        </g>`;
    })
    .join('');

  const markers = [
    { label: 'P25', val: stats.prices.p25, color: '#94a3b8' },
    { label: 'MED', val: stats.prices.median, color: '#f4f1ea' },
    { label: 'P75', val: stats.prices.p75, color: '#10b981' },
  ];

  const markersSvg = markers
    .map((m) => {
      const mx = Math.max(pad.left, Math.min(width - pad.right, pxToX(m.val)));
      return `
        <line x1="${mx.toFixed(1)}" y1="${pad.top - 6}" x2="${mx.toFixed(1)}" y2="${pad.top + plotH}" stroke="${m.color}" stroke-width="1.3" stroke-dasharray="3 3" />
        <text x="${mx.toFixed(1)}" y="${pad.top - 11}" fill="${m.color}" font-size="9.5" font-family="var(--font-mono)" text-anchor="middle">${m.label} ${Math.round(m.val)}</text>`;
    })
    .join('');

  container.innerHTML = `
    <div class="svg-wrap">
      <svg viewBox="0 0 ${width} ${height}" class="chart-svg" role="img" aria-label="Pricing dispersion histogram">
        ${yGrid}
        ${barsSvg}
        ${markersSvg}
        <text x="${pad.left + plotW / 2}" y="${height - 10}" fill="#9aa4b8" font-size="11" font-family="var(--font-sans)" text-anchor="middle">${escapeHtml(market.priceUnitLabel)} (${escapeHtml(market.currency)})</text>
      </svg>
    </div>
    <div class="dispersion-strip">
      <div class="disp-item"><span>P25</span><strong class="mono">${formatCurrency(stats.prices.p25, market)}</strong></div>
      <div class="disp-item"><span>Median (P50)</span><strong class="mono">${formatCurrency(stats.prices.median, market)}</strong></div>
      <div class="disp-item"><span>P75</span><strong class="mono">${formatCurrency(stats.prices.p75, market)}</strong></div>
      <div class="disp-item"><span>IQR Spread</span><strong class="mono">${formatCurrency(stats.prices.iqr, market)}</strong></div>
      <div class="disp-item"><span>Dispersion (CV)</span><strong class="mono">${stats.prices.cvPct.toFixed(1)}%</strong></div>
    </div>
  `;

  container.querySelectorAll('.hist-bin').forEach((el) => {
    const idx = Number(el.getAttribute('data-bin-idx'));
    const bin = bins[idx];
    if (!bin) return;
    el.addEventListener('mouseenter', (evt) => {
      const breakdown = market.corridors
        .map((c) => `<span>${escapeHtml(c.label)}</span><span class="mono">${bin.byCorridor[c.id] || 0}</span>`)
        .join('');
      tooltipApi.show(
        evt,
        `<div class="tt-title">${market.currency} ${bin.lo} – ${bin.hi}</div>
         <div class="tt-sub">${bin.total} benchmarked operator${bin.total === 1 ? '' : 's'}</div>
         <div class="tt-grid">${breakdown}</div>`
      );
    });
    el.addEventListener('mousemove', (evt) => tooltipApi.move(evt));
    el.addEventListener('mouseleave', () => tooltipApi.hide());
  });
}

export function renderMoatLeaderboard(container, venues, market, selectedVenueId, onSelectVenue) {
  const leaders = computeMoatLeaderboard(venues, 10);
  if (!leaders.length) {
    container.innerHTML = '<div class="empty-state">No operators match the active filters.</div>';
    return;
  }

  const maxReviews = leaders[0].reviews || 1;

  const rowsHtml = leaders
    .map((item) => {
      const pctWidth = Math.max(6, (item.reviews / maxReviews) * 100);
      const color = getCorridorColor(market, item.corridor);
      const tierClass = item.moatTier.toLowerCase();
      const isSelected = item.id === selectedVenueId;
      return `
        <button type="button" class="moat-row ${isSelected ? 'is-selected' : ''}" data-venue-id="${escapeHtml(item.id)}">
          <div class="moat-row-top">
            <div class="moat-name-group">
              <span class="moat-rank mono">${String(item.rank).padStart(2, '0')}</span>
              <span class="moat-name">${escapeHtml(item.name)}</span>
              <span class="moat-corridor-dot" style="background:${color}" title="${escapeHtml(item.corridor)}"></span>
            </div>
            <div class="moat-metrics">
              <span class="moat-tier badge-${tierClass}">${item.moatTier.toUpperCase()}</span>
              <span class="mono moat-rating">${item.rating.toFixed(1)}</span>
              <span class="mono moat-reviews">${formatNumber(item.reviews)}</span>
              <span class="mono moat-share">${item.sharePct.toFixed(1)}%</span>
            </div>
          </div>
          <div class="moat-bar-track">
            <div class="moat-bar-fill" style="width:${pctWidth.toFixed(1)}%; background:${color}"></div>
          </div>
        </button>`;
    })
    .join('');

  container.innerHTML = `
    <div class="moat-header-cols">
      <span>Rank / Operator</span>
      <span class="moat-col-right">Tier &middot; Rating &middot; Reviews &middot; Share</span>
    </div>
    <div class="moat-list">${rowsHtml}</div>
  `;

  container.querySelectorAll('.moat-row').forEach((btn) => {
    btn.addEventListener('click', () => onSelectVenue(btn.getAttribute('data-venue-id')));
  });
}

export function renderWhiteSpacePanel(container, corridorScores, market, activeCorridor, onCorridorSelect) {
  const cardsHtml = corridorScores
    .map((row) => {
      const isFocused = activeCorridor === row.corridor.id;
      const barColor =
        row.whiteSpaceScore >= 70 ? '#10b981' : row.whiteSpaceScore >= 52 ? '#f59e0b' : '#64748b';
      return `
        <div class="ws-card ${isFocused ? 'is-focused' : ''}" data-corridor-id="${escapeHtml(row.corridor.id)}">
          <div class="ws-card-head">
            <div>
              <div class="ws-corridor-title">
                <span class="legend-swatch" style="background:${row.corridor.color}"></span>
                <span>${escapeHtml(row.corridor.label)}</span>
              </div>
              <div class="ws-corridor-meta mono">${row.count} venues &middot; Density ${row.avgDensity.toFixed(0)}/100 &middot; Rent ${formatNumber(row.corridor.primeRentPerSqft)} ${escapeHtml(row.corridor.rentUnit)}</div>
            </div>
            <div class="ws-score-box">
              <div class="ws-score-num mono" style="color:${barColor}">${row.whiteSpaceScore}<span>/100</span></div>
              <div class="ws-posture posture-${row.postureClass}">${row.posture}</div>
            </div>
          </div>

          <div class="ws-main-bar">
            <div class="ws-main-bar-fill" style="width:${row.whiteSpaceScore}%; background:${barColor}"></div>
          </div>

          <div class="ws-factors-grid">
            <div class="ws-factor"><span>Demand (28%)</span><strong class="mono">${row.subScores.demandScore}</strong></div>
            <div class="ws-factor"><span>Supply Gap (34%)</span><strong class="mono">${row.subScores.supplyGapScore}</strong></div>
            <div class="ws-factor"><span>Quality Gap (14%)</span><strong class="mono">${row.subScores.qualityGapScore}</strong></div>
            <div class="ws-factor"><span>Moat Open (16%)</span><strong class="mono">${row.subScores.moatOpennessScore}</strong></div>
            <div class="ws-factor"><span>Price Room (8%)</span><strong class="mono">${row.subScores.priceHeadroomScore}</strong></div>
          </div>

          <p class="ws-note">${escapeHtml(row.corridor.notes)}</p>
        </div>`;
    })
    .join('');

  container.innerHTML = `
    <div class="ws-stack">${cardsHtml}</div>
    <div class="ws-formula-foot">
      Composite score = 0.28 Demand + 0.34 Supply Gap + 0.14 Quality Gap + 0.16 Moat Openness + 0.08 Price Headroom. Click a corridor card to filter charts.
    </div>
  `;

  container.querySelectorAll('.ws-card').forEach((card) => {
    card.addEventListener('click', () => {
      const cid = card.getAttribute('data-corridor-id');
      onCorridorSelect(activeCorridor === cid ? 'ALL' : cid);
    });
  });
}
