import {
  computePriceHistogram,
  computeMoatLeaderboard,
  computeSummaryStats,
  formatCurrency,
  formatNumber,
  getEditorialCorridorColor,
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
  return found ? getEditorialCorridorColor(found.color) : '#475569';
}

export function renderScatterChart(
  container,
  venues,
  market,
  selectedVenueId,
  onSelectVenue,
  tooltipApi,
  options = {}
) {
  const { lens = 'density', hypotheticalOutlet = null } = options;
  const width = 680;
  const height = 360;
  const pad = { top: 28, right: 28, bottom: 48, left: 56 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;

  if (!venues.length) {
    container.innerHTML = '<div class="empty-state">No operators match the active filters.</div>';
    return;
  }

  const maxReviews = Math.max(...venues.map((v) => v.reviews), 100);
  const sr = (rev) => 5.5 + Math.sqrt(rev / maxReviews) * 14.5;

  // Determine X/Y scales by active visual lens
  let minX = 20;
  let maxX = 100;
  let minY = 3.6;
  let maxY = 5.0;
  let xTicks = [20, 40, 60, 80, 100];
  let yTicks = [3.6, 3.95, 4.3, 4.65, 5.0];
  let xTitle = 'Local Competitive Density Index (0-100, 1km Catchment)';
  let yTitle = 'Avg Rating (1.0-5.0)';
  let getX = (v) => v.densityIndex;
  let getY = (v) => v.rating;
  let fmtX = (t) => String(Math.round(t));
  let fmtY = (t) => t.toFixed(2);
  let midX = 65;
  let midY = 4.35;
  let quadrants = {
    tl: 'UNDERSERVED WHITE SPACE',
    tr: 'ENTRENCHED LEADERS',
    bl: 'QUALITY GAP TARGETS',
    br: 'CROWDED COMMODITY',
  };

  if (lens === 'price') {
    const prices = venues.map((v) => v.price);
    const pMin = Math.min(...prices, hypotheticalOutlet ? hypotheticalOutlet.price : Infinity);
    const pMax = Math.max(...prices, hypotheticalOutlet ? hypotheticalOutlet.price : -Infinity);
    const span = Math.max(40, pMax - pMin);
    minX = Math.max(0, Math.floor((pMin - span * 0.08) / 20) * 20);
    maxX = Math.ceil((pMax + span * 0.08) / 20) * 20;
    const step = (maxX - minX) / 4;
    xTicks = [0, 1, 2, 3, 4].map((i) => Math.round(minX + i * step));
    midX = (minX + maxX) / 2;
    xTitle = `${market.priceUnitLabel} (${market.currency})`;
    getX = (v) => v.price;
    fmtX = (t) => formatNumber(Math.round(t));
    quadrants = {
      tl: 'VALUE QUALITY LEADERS',
      tr: 'PREMIUM BENCHMARKS',
      bl: 'MASS / DISCOUNT TIER',
      br: 'OVERPRICED / VULNERABLE',
    };
  } else if (lens === 'moat') {
    const prices = venues.map((v) => v.price);
    const pMin = Math.min(...prices, hypotheticalOutlet ? hypotheticalOutlet.price : Infinity);
    const pMax = Math.max(...prices, hypotheticalOutlet ? hypotheticalOutlet.price : -Infinity);
    const span = Math.max(40, pMax - pMin);
    minX = Math.max(0, Math.floor((pMin - span * 0.08) / 20) * 20);
    maxX = Math.ceil((pMax + span * 0.08) / 20) * 20;
    const step = (maxX - minX) / 4;
    xTicks = [0, 1, 2, 3, 4].map((i) => Math.round(minX + i * step));
    minY = 0;
    maxY = Math.ceil((maxReviews * 1.1) / 500) * 500;
    yTicks = [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(maxY * f));
    midX = (minX + maxX) / 2;
    midY = maxY * 0.45;
    xTitle = `${market.priceUnitLabel} (${market.currency})`;
    yTitle = 'Modelled Review Volume (Moat)';
    getX = (v) => v.price;
    getY = (v) => v.reviews;
    fmtX = (t) => formatNumber(Math.round(t));
    fmtY = (t) => (t >= 1000 ? `${(t / 1000).toFixed(1)}K` : String(t));
    quadrants = {
      tl: 'VOLUME FORTRESSES',
      tr: 'PREMIUM FORTRESSES',
      bl: 'VALUE CHALLENGERS',
      br: 'NICHE / EMERGING PREMIUM',
    };
  }

  const sx = (val) => pad.left + ((val - minX) / Math.max(1e-6, maxX - minX)) * plotW;
  const sy = (val) => pad.top + ((maxY - val) / Math.max(1e-6, maxY - minY)) * plotH;
  const qx = sx(midX);
  const qy = sy(midY);

  const gridLinesX = xTicks
    .map(
      (t) => `
      <line x1="${sx(t)}" y1="${pad.top}" x2="${sx(t)}" y2="${height - pad.bottom}" stroke="#e5e5e3" stroke-width="1" />
      <text x="${sx(t)}" y="${height - pad.bottom + 18}" fill="#555555" font-size="11" font-family="var(--font-mono)" text-anchor="middle">${fmtX(t)}</text>`
    )
    .join('');

  const gridLinesY = yTicks
    .map(
      (t) => `
      <line x1="${pad.left}" y1="${sy(t)}" x2="${width - pad.right}" y2="${sy(t)}" stroke="#e5e5e3" stroke-width="1" />
      <text x="${pad.left - 10}" y="${sy(t) + 3.5}" fill="#555555" font-size="11" font-family="var(--font-mono)" text-anchor="end">${fmtY(t)}</text>`
    )
    .join('');

  const sorted = [...venues].sort((a, b) => b.reviews - a.reviews);
  const dots = sorted
    .map((v) => {
      const cx = sx(getX(v));
      const cy = sy(getY(v));
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
          stroke="${isSelected ? '#111111' : color}"
          stroke-width="${isSelected ? '2.4' : '1.2'}"
        />`;
    })
    .join('');

  // Optional live overlay of hypothetical store from Pro-Forma Builder
  let outletSvg = '';
  if (hypotheticalOutlet) {
    const ox = Math.max(pad.left + 8, Math.min(width - pad.right - 8, sx(getX(hypotheticalOutlet))));
    const oy = Math.max(pad.top + 8, Math.min(height - pad.bottom - 8, sy(getY(hypotheticalOutlet))));
    const labelAnchor = ox > width - 150 ? 'end' : 'start';
    const labelDx = ox > width - 150 ? -13 : 13;
    outletSvg = `
      <g class="outlet-marker" pointer-events="none">
        <circle cx="${ox.toFixed(1)}" cy="${oy.toFixed(1)}" r="13" fill="#1b5e43" fill-opacity="0.14" stroke="#1b5e43" stroke-width="1.4" stroke-dasharray="3 2" />
        <polygon points="${ox.toFixed(1)},${(oy - 7).toFixed(1)} ${(ox + 7).toFixed(1)},${oy.toFixed(1)} ${ox.toFixed(1)},${(oy + 7).toFixed(1)} ${(ox - 7).toFixed(1)},${oy.toFixed(1)}" fill="#1b5e43" stroke="#ffffff" stroke-width="1.6" />
        <text x="${(ox + labelDx).toFixed(1)}" y="${(oy + 4).toFixed(1)}" fill="#1b5e43" font-size="11" font-weight="600" font-family="var(--font-mono)" text-anchor="${labelAnchor}">YOUR OUTLET</text>
      </g>`;
  }

  container.innerHTML = `
    <div class="svg-wrap">
      <svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="xMidYMid meet" class="chart-svg" role="img" aria-label="Interactive corridor positioning map">
        <rect x="${pad.left}" y="${pad.top}" width="${plotW}" height="${plotH}" fill="#ffffff" />
        ${
          lens === 'density'
            ? `<rect x="${pad.left}" y="${pad.top}" width="${qx - pad.left}" height="${height - pad.bottom - pad.top}" fill="#1b5e43" fill-opacity="0.045" />`
            : ''
        }
        ${gridLinesX}
        ${gridLinesY}
        <line x1="${qx}" y1="${pad.top}" x2="${qx}" y2="${height - pad.bottom}" stroke="#c9c9c5" stroke-width="1.1" stroke-dasharray="4 4" />
        <line x1="${pad.left}" y1="${qy}" x2="${width - pad.right}" y2="${qy}" stroke="#c9c9c5" stroke-width="1.1" stroke-dasharray="4 4" />
        <text x="${pad.left + 8}" y="${pad.top + 15}" fill="#1b5e43" font-size="10.5" font-weight="500" font-family="var(--font-mono)" letter-spacing="0.04em">${quadrants.tl}</text>
        <text x="${width - pad.right - 8}" y="${pad.top + 15}" fill="#555555" font-size="10.5" font-family="var(--font-mono)" text-anchor="end" letter-spacing="0.04em">${quadrants.tr}</text>
        <text x="${pad.left + 8}" y="${height - pad.bottom - 8}" fill="#555555" font-size="10.5" font-family="var(--font-mono)" letter-spacing="0.04em">${quadrants.bl}</text>
        <text x="${width - pad.right - 8}" y="${height - pad.bottom - 8}" fill="#b45309" font-size="10.5" font-family="var(--font-mono)" text-anchor="end" letter-spacing="0.04em">${quadrants.br}</text>
        <text x="${pad.left + plotW / 2}" y="${height - 8}" fill="#555555" font-size="12" font-family="var(--font-sans)" text-anchor="middle">${escapeHtml(xTitle)}</text>
        <text x="16" y="${pad.top + plotH / 2}" fill="#555555" font-size="12" font-family="var(--font-sans)" text-anchor="middle" transform="rotate(-90 16 ${pad.top + plotH / 2})">${escapeHtml(yTitle)}</text>
        <g class="scatter-layer">${dots}</g>
        ${outletSvg}
      </svg>
    </div>
    <div class="chart-legend-row">
      <div class="legend-items">
        ${market.corridors
          .map(
            (c) =>
              `<span class="legend-chip"><span class="legend-swatch" style="background:${getEditorialCorridorColor(c.color)}"></span>${escapeHtml(c.label)}</span>`
          )
          .join('')}
        ${
          hypotheticalOutlet
            ? `<span class="legend-chip"><span class="legend-diamond"></span>Your Pro-Forma Outlet</span>`
            : ''
        }
      </div>
      <div class="legend-note">Size = review volume. Click any node to inspect.</div>
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

export function renderHistogramChart(container, venues, market, tooltipApi, hypotheticalPrice = null) {
  const width = 560;
  const height = 290;
  const pad = { top: 34, right: 20, bottom: 48, left: 42 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;

  if (!venues.length) {
    container.innerHTML = '<div class="empty-state">No pricing data for active filters.</div>';
    return;
  }

  const stats = computeSummaryStats(venues);
  const { bins, maxBinTotal, minPrice, maxPrice } = computePriceHistogram(venues, market.corridors, 8);
  const barGap = 8;
  const barW = (plotW - barGap * (bins.length - 1)) / bins.length;
  const priceSpan = Math.max(1, maxPrice - minPrice);

  const pxToX = (priceVal) => pad.left + ((priceVal - minPrice) / priceSpan) * plotW;

  const yStep = Math.max(1, Math.ceil(maxBinTotal / 4));
  const yMax = yStep * 4;
  const yTicks = [0, yStep, yStep * 2, yStep * 3, yMax];

  const yGrid = yTicks
    .map((t) => {
      const y = pad.top + plotH - (t / yMax) * plotH;
      return `
        <line x1="${pad.left}" y1="${y}" x2="${width - pad.right}" y2="${y}" stroke="#e5e5e3" stroke-width="1" />
        <text x="${pad.left - 8}" y="${y + 3.5}" fill="#555555" font-size="11" font-family="var(--font-mono)" text-anchor="end">${t}</text>`;
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
          return `<rect x="${x.toFixed(1)}" y="${currentY.toFixed(1)}" width="${barW.toFixed(1)}" height="${segH.toFixed(1)}" fill="${getEditorialCorridorColor(c.color)}" fill-opacity="0.82" rx="1.5" />`;
        })
        .join('');

      const totalH = (bin.total / yMax) * plotH;
      const topY = pad.top + plotH - totalH;

      return `
        <g class="hist-bin" data-bin-idx="${idx}">
          ${segments}
          <rect x="${x.toFixed(1)}" y="${pad.top}" width="${barW.toFixed(1)}" height="${plotH}" fill="transparent" />
          ${bin.total > 0 ? `<text x="${(x + barW / 2).toFixed(1)}" y="${(topY - 5).toFixed(1)}" fill="#111111" font-size="10.5" font-family="var(--font-mono)" text-anchor="middle">${bin.total}</text>` : ''}
          <text x="${(x + barW / 2).toFixed(1)}" y="${height - pad.bottom + 16}" fill="#555555" font-size="10" font-family="var(--font-mono)" text-anchor="middle">${bin.shortLabel}</text>
        </g>`;
    })
    .join('');

  const markers = [
    { label: 'P25', val: stats.prices.p25, color: '#64748b' },
    { label: 'MED', val: stats.prices.median, color: '#111111' },
    { label: 'P75', val: stats.prices.p75, color: '#b45309' },
  ];

  const markersSvg = markers
    .map((m) => {
      const mx = Math.max(pad.left, Math.min(width - pad.right, pxToX(m.val)));
      return `
        <line x1="${mx.toFixed(1)}" y1="${pad.top - 5}" x2="${mx.toFixed(1)}" y2="${pad.top + plotH}" stroke="${m.color}" stroke-width="1.2" stroke-dasharray="3 3" />
        <text x="${mx.toFixed(1)}" y="${pad.top - 10}" fill="${m.color}" font-size="10" font-family="var(--font-mono)" text-anchor="middle">${m.label} ${Math.round(m.val)}</text>`;
    })
    .join('');

  let outletLine = '';
  if (Number.isFinite(hypotheticalPrice)) {
    const ox = Math.max(pad.left, Math.min(width - pad.right, pxToX(hypotheticalPrice)));
    outletLine = `
      <line x1="${ox.toFixed(1)}" y1="${pad.top}" x2="${ox.toFixed(1)}" y2="${pad.top + plotH}" stroke="#1b5e43" stroke-width="2" />
      <polygon points="${ox.toFixed(1)},${pad.top + 2} ${(ox - 5).toFixed(1)},${pad.top - 5} ${(ox + 5).toFixed(1)},${pad.top - 5}" fill="#1b5e43" />
    `;
  }

  container.innerHTML = `
    <div class="svg-wrap">
      <svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="xMidYMid meet" class="chart-svg" role="img" aria-label="Pricing dispersion histogram">
        <rect x="${pad.left}" y="${pad.top}" width="${plotW}" height="${plotH}" fill="#ffffff" />
        ${yGrid}
        ${barsSvg}
        ${markersSvg}
        ${outletLine}
        <text x="${pad.left + plotW / 2}" y="${height - 10}" fill="#555555" font-size="11.5" font-family="var(--font-sans)" text-anchor="middle">${escapeHtml(market.priceUnitLabel)} (${escapeHtml(market.currency)})</text>
      </svg>
    </div>
    <div class="dispersion-strip">
      <div class="disp-item"><span>P25</span><strong class="mono">${formatCurrency(stats.prices.p25, market)}</strong></div>
      <div class="disp-item"><span>Median</span><strong class="mono">${formatCurrency(stats.prices.median, market)}</strong></div>
      <div class="disp-item"><span>P75</span><strong class="mono">${formatCurrency(stats.prices.p75, market)}</strong></div>
      <div class="disp-item"><span>IQR</span><strong class="mono">${formatCurrency(stats.prices.iqr, market)}</strong></div>
      <div class="disp-item"><span>CV</span><strong class="mono">${stats.prices.cvPct.toFixed(1)}%</strong></div>
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
         <div class="tt-sub">${bin.total} operator${bin.total === 1 ? '' : 's'}</div>
         <div class="tt-grid">${breakdown}</div>`
      );
    });
    el.addEventListener('mousemove', (evt) => tooltipApi.move(evt));
    el.addEventListener('mouseleave', () => tooltipApi.hide());
  });
}

export function renderMoatLeaderboard(container, venues, market, selectedVenueId, onSelectVenue) {
  const leaders = computeMoatLeaderboard(venues, 8);
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

export function renderWhiteSpacePanel(
  container,
  corridorScores,
  market,
  activeCorridor,
  onCorridorSelect,
  onSimulateCorridor
) {
  const cardsHtml = corridorScores
    .map((row) => {
      const isFocused = activeCorridor === row.corridor.id;
      const color = getEditorialCorridorColor(row.corridor.color);
      const barColor =
        row.whiteSpaceScore >= 70 ? '#1b5e43' : row.whiteSpaceScore >= 52 ? '#b45309' : '#64748b';
      return `
        <div class="ws-card ${isFocused ? 'is-focused' : ''}">
          <button type="button" class="ws-card-trigger" data-corridor-id="${escapeHtml(row.corridor.id)}">
            <div class="ws-card-head">
              <div class="ws-card-info">
                <div class="ws-corridor-title">
                  <span class="legend-swatch" style="background:${color}"></span>
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
              <div class="ws-factor"><span>Demand</span><strong class="mono">${row.subScores.demandScore}</strong></div>
              <div class="ws-factor"><span>Supply Gap</span><strong class="mono">${row.subScores.supplyGapScore}</strong></div>
              <div class="ws-factor"><span>Quality</span><strong class="mono">${row.subScores.qualityGapScore}</strong></div>
              <div class="ws-factor"><span>Moat Open</span><strong class="mono">${row.subScores.moatOpennessScore}</strong></div>
              <div class="ws-factor"><span>Price Room</span><strong class="mono">${row.subScores.priceHeadroomScore}</strong></div>
            </div>
          </button>

          <div class="ws-card-actions">
            <details class="editorial-details compact-details">
              <summary>Corridor notes</summary>
              <p class="ws-note">${escapeHtml(row.corridor.notes)}</p>
            </details>
            ${
              onSimulateCorridor
                ? `<button type="button" class="btn-inline-accent" data-sim-corridor="${escapeHtml(row.corridor.id)}">Drop Outlet Here &rarr;</button>`
                : ''
            }
          </div>
        </div>`;
    })
    .join('');

  container.innerHTML = `
    <div class="ws-stack">${cardsHtml}</div>
    <details class="editorial-details">
      <summary>5-factor white-space formula</summary>
      <p class="details-body mono">Score = 0.28 Demand + 0.34 Supply Gap + 0.14 Quality Gap + 0.16 Moat Openness + 0.08 Price Headroom. Click any corridor to filter charts or drop a hypothetical outlet into Pro-Forma.</p>
    </details>
  `;

  container.querySelectorAll('.ws-card-trigger').forEach((btn) => {
    btn.addEventListener('click', () => {
      const cid = btn.getAttribute('data-corridor-id');
      onCorridorSelect(activeCorridor === cid ? 'ALL' : cid);
    });
  });

  if (onSimulateCorridor) {
    container.querySelectorAll('[data-sim-corridor]').forEach((btn) => {
      btn.addEventListener('click', () => {
        onSimulateCorridor(btn.getAttribute('data-sim-corridor'));
      });
    });
  }
}
