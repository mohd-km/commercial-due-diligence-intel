import {
  computeCorridorWhiteSpace,
  computeInvestmentMemo,
  computeStoreProForma,
  formatCurrency,
  formatNumber,
  formatUsd,
  generateMemoMarkdown,
  getEditorialCorridorColor,
} from '../engine/analytics.js';

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderWaterfallSvg(pf) {
  const width = 540;
  const height = 245;
  const pad = { top: 26, right: 16, bottom: 42, left: 16 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;

  const rev = Math.max(1, pf.monthlyRevenue);
  const items = [
    { label: 'Revenue', val: pf.monthlyRevenue, start: 0, end: pf.monthlyRevenue, color: '#111111' },
    { label: 'COGS', val: -pf.monthlyCogs, start: pf.monthlyRevenue, end: pf.monthlyGrossProfit, color: '#94a3b8' },
    { label: 'Rent', val: -pf.monthlyRent, start: pf.monthlyGrossProfit, end: pf.monthlyGrossProfit - pf.monthlyRent, color: '#b45309' },
    {
      label: 'Labor',
      val: -pf.monthlyLabor,
      start: pf.monthlyGrossProfit - pf.monthlyRent,
      end: pf.monthlyGrossProfit - pf.monthlyRent - pf.monthlyLabor,
      color: '#64748b',
    },
    {
      label: 'Opex',
      val: -pf.monthlyOtherOpex,
      start: pf.monthlyGrossProfit - pf.monthlyRent - pf.monthlyLabor,
      end: pf.monthlyEbitda,
      color: '#78716c',
    },
    {
      label: 'EBITDA',
      val: pf.monthlyEbitda,
      start: 0,
      end: pf.monthlyEbitda,
      color: pf.monthlyEbitda >= 0 ? '#1b5e43' : '#b91c1c',
    },
  ];

  const minVal = Math.min(0, pf.monthlyEbitda);
  const maxVal = rev * 1.08;
  const span = Math.max(1, maxVal - minVal);
  const sy = (v) => pad.top + ((maxVal - v) / span) * plotH;
  const zeroY = sy(0);

  const gap = 14;
  const barW = (plotW - gap * (items.length - 1)) / items.length;

  const bars = items
    .map((item, idx) => {
      const x = pad.left + idx * (barW + gap);
      const yTop = sy(Math.max(item.start, item.end));
      const yBot = sy(Math.min(item.start, item.end));
      const h = Math.max(2, yBot - yTop);
      const labelY = item.val >= 0 ? yTop - 6 : yBot + 13;
      const pctOfRev = (item.val / rev) * 100;
      return `
        <g>
          <rect x="${x.toFixed(1)}" y="${yTop.toFixed(1)}" width="${barW.toFixed(1)}" height="${h.toFixed(1)}" fill="${item.color}" fill-opacity="0.88" rx="2" />
          <text x="${(x + barW / 2).toFixed(1)}" y="${Math.max(12, Math.min(height - 28, labelY)).toFixed(1)}" fill="#111111" font-size="10.5" font-family="var(--font-mono)" text-anchor="middle">${pctOfRev >= 0 ? '' : '-'}${Math.abs(pctOfRev).toFixed(0)}%</text>
          <text x="${(x + barW / 2).toFixed(1)}" y="${height - 14}" fill="#555555" font-size="11" font-family="var(--font-sans)" text-anchor="middle">${item.label}</text>
        </g>`;
    })
    .join('');

  return `
    <svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="xMidYMid meet" class="chart-svg" role="img" aria-label="Monthly P&L waterfall chart">
      <rect x="0" y="0" width="${width}" height="${height}" fill="#ffffff" />
      <line x1="${pad.left}" y1="${zeroY.toFixed(1)}" x2="${width - pad.right}" y2="${zeroY.toFixed(1)}" stroke="#c9c9c5" stroke-width="1.2" />
      ${bars}
    </svg>
  `;
}

function renderPaybackCurveSvg(pf, market) {
  const width = 540;
  const height = 245;
  const pad = { top: 26, right: 24, bottom: 38, left: 72 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;

  const series = pf.cashflowSeries;
  const vals = series.map((d) => d.cumulative);
  const minVal = Math.min(-pf.effectiveCapex * 1.05, ...vals, -1);
  const maxVal = Math.max(pf.effectiveCapex * 0.4, ...vals, 1);
  const span = Math.max(1, maxVal - minVal);

  const sx = (m) => pad.left + (m / 36) * plotW;
  const sy = (v) => pad.top + ((maxVal - v) / span) * plotH;
  const zeroY = sy(0);

  const linePts = series.map((d) => `${sx(d.month).toFixed(1)},${sy(d.cumulative).toFixed(1)}`).join(' ');
  const areaPts = `${sx(0).toFixed(1)},${zeroY.toFixed(1)} ${linePts} ${sx(36).toFixed(1)},${zeroY.toFixed(1)}`;

  const xTicks = [0, 6, 12, 18, 24, 30, 36];
  const xGrid = xTicks
    .map(
      (m) => `
      <line x1="${sx(m).toFixed(1)}" y1="${pad.top}" x2="${sx(m).toFixed(1)}" y2="${height - pad.bottom}" stroke="#ececea" stroke-width="1" />
      <text x="${sx(m).toFixed(1)}" y="${height - pad.bottom + 16}" fill="#555555" font-size="10.5" font-family="var(--font-mono)" text-anchor="middle">M${m}</text>`
    )
    .join('');

  const yTicks = [minVal, 0, maxVal];
  const yGrid = yTicks
    .map(
      (v) => `
      <line x1="${pad.left}" y1="${sy(v).toFixed(1)}" x2="${width - pad.right}" y2="${sy(v).toFixed(1)}" stroke="${v === 0 ? '#111111' : '#ececea'}" stroke-width="${v === 0 ? '1.2' : '1'}" stroke-dasharray="${v === 0 ? '4 3' : ''}" />
      <text x="${pad.left - 8}" y="${(sy(v) + 3.5).toFixed(1)}" fill="#555555" font-size="10" font-family="var(--font-mono)" text-anchor="end">${formatCurrency(v, market, true)}</text>`
    )
    .join('');

  let paybackMarker = '';
  if (pf.rampedPaybackMonth !== null && pf.rampedPaybackMonth <= 36) {
    const bx = sx(pf.rampedPaybackMonth);
    paybackMarker = `
      <line x1="${bx.toFixed(1)}" y1="${pad.top}" x2="${bx.toFixed(1)}" y2="${height - pad.bottom}" stroke="#1b5e43" stroke-width="1.4" stroke-dasharray="3 3" />
      <circle cx="${bx.toFixed(1)}" cy="${zeroY.toFixed(1)}" r="5" fill="#1b5e43" stroke="#ffffff" stroke-width="2" />
      <text x="${Math.min(width - 80, bx + 8).toFixed(1)}" y="${pad.top + 13}" fill="#1b5e43" font-size="10.5" font-weight="600" font-family="var(--font-mono)">Break-even M${pf.rampedPaybackMonth.toFixed(1)}</text>
    `;
  } else {
    paybackMarker = `
      <text x="${width - pad.right - 6}" y="${pad.top + 13}" fill="#b91c1c" font-size="10.5" font-weight="600" font-family="var(--font-mono)" text-anchor="end">Payback &gt; 36 mo</text>
    `;
  }

  const endCum = series[series.length - 1].cumulative;
  const strokeColor = endCum >= 0 ? '#1b5e43' : '#b91c1c';

  return `
    <svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="xMidYMid meet" class="chart-svg" role="img" aria-label="36-month cumulative cashflow and payback curve">
      <rect x="${pad.left}" y="${pad.top}" width="${plotW}" height="${plotH}" fill="#ffffff" />
      ${xGrid}
      ${yGrid}
      <polygon points="${areaPts}" fill="${strokeColor}" fill-opacity="0.08" />
      <polyline points="${linePts}" fill="none" stroke="${strokeColor}" stroke-width="2.2" />
      ${paybackMarker}
      <text x="${pad.left + plotW / 2}" y="${height - 5}" fill="#555555" font-size="11" font-family="var(--font-sans)" text-anchor="middle">Months Post-Opening (3-Month Ramp + Steady State)</text>
    </svg>
  `;
}

export function renderProFormaView(container, market, initialProForma, callbacks) {
  const corridorScores = computeCorridorWhiteSpace(market);
  let currentPf = initialProForma;
  let currentParams = { ...initialProForma.params };
  const { spec, corridorRow } = currentPf;
  const cur = (v, compact = false) => formatCurrency(v, market, compact);
  const usd = (v) => formatUsd(v, market.fxToUsd, true);

  container.innerHTML = `
    <section class="proforma-shell">
      <div class="proforma-header-bar">
        <div>
          <div class="panel-kicker">INTERACTIVE STORE PRO-FORMA &amp; MEMO BUILDER</div>
          <h2 class="panel-title">Drop a Hypothetical Outlet into ${escapeHtml(market.shortName)}</h2>
        </div>
        <div class="proforma-actions">
          <button type="button" class="btn-ghost" id="btn-pf-reset">Reset</button>
          <button type="button" class="btn-secondary" id="btn-pf-open-memo">View 1-Page Memo</button>
          <button type="button" class="btn-primary" id="btn-pf-export-md">Export PE Memo (.md)</button>
        </div>
      </div>

      <div class="corridor-drop-grid" role="radiogroup" aria-label="Drop outlet into corridor">
        ${corridorScores
          .map((row) => {
            const active = row.corridor.id === currentParams.corridorId;
            const color = getEditorialCorridorColor(row.corridor.color);
            return `
              <button type="button" class="drop-corridor-btn ${active ? 'is-active' : ''}" data-drop-corridor="${escapeHtml(row.corridor.id)}">
                <div class="drop-corridor-top">
                  <span class="drop-corridor-name"><span class="legend-swatch" style="background:${color}"></span>${escapeHtml(row.corridor.label)}</span>
                  <span class="mono drop-ws-tag">WS ${row.whiteSpaceScore}/100</span>
                </div>
                <div class="drop-corridor-sub mono">
                  Rent ${formatNumber(row.corridor.primeRentPerSqft)} ${escapeHtml(row.corridor.rentUnit)} &middot; Median ${cur(row.medianPrice)}
                </div>
              </button>`;
          })
          .join('')}
      </div>

      <div class="pf-kpi-strip" id="pf-kpi-strip"></div>

      <div class="proforma-workspace">
        <div class="panel-card sliders-panel">
          <div class="panel-head">
            <div>
              <div class="panel-kicker">LIVE UNIT-ECONOMICS LEVERS</div>
              <h3 class="panel-title">Adjust Store Parameters</h3>
            </div>
            <span class="panel-tag mono">${formatNumber(spec.areaSqft)} sq ft</span>
          </div>

          <div class="slider-stack">
            <label class="pf-slider-row">
              <div class="pf-slider-head">
                <span>Corridor Rent (${escapeHtml(corridorRow.corridor.rentUnit)})</span>
                <strong class="mono" id="val-rent"></strong>
              </div>
              <input type="range" id="slider-rent" min="${spec.rentRange.min}" max="${spec.rentRange.max}" step="${spec.rentRange.step}" value="${currentParams.rentPerSqft}" />
              <div class="pf-slider-foot mono" id="foot-rent"></div>
            </label>

            <label class="pf-slider-row">
              <div class="pf-slider-head">
                <span>${escapeHtml(market.priceUnitLabel)} (${escapeHtml(market.currency)})</span>
                <strong class="mono" id="val-ticket"></strong>
              </div>
              <input type="range" id="slider-ticket" min="${spec.ticketRange.min}" max="${spec.ticketRange.max}" step="${spec.ticketRange.step}" value="${currentParams.avgTicket}" />
              <div class="pf-slider-foot mono" id="foot-ticket"></div>
            </label>

            <label class="pf-slider-row">
              <div class="pf-slider-head">
                <span>Steady-State Utilization (%)</span>
                <strong class="mono" id="val-util"></strong>
              </div>
              <input type="range" id="slider-util" min="35" max="98" step="1" value="${currentParams.utilizationPct}" />
              <div class="pf-slider-foot mono" id="foot-util"></div>
            </label>

            <label class="pf-slider-row">
              <div class="pf-slider-head">
                <span>Landlord Cat-B Capex Funding (%)</span>
                <strong class="mono" id="val-capex"></strong>
              </div>
              <input type="range" id="slider-capex" min="0" max="80" step="5" value="${currentParams.landlordCapexPct}" />
              <div class="pf-slider-foot mono" id="foot-capex"></div>
            </label>
          </div>

          <div class="be-gauge-box" id="be-gauge-box"></div>

          <details class="editorial-details">
            <summary>Model equations &amp; fixed-cost basis</summary>
            <p class="details-body mono" id="pf-equations-body"></p>
          </details>
        </div>

        <div class="proforma-charts-col">
          <div class="panel-card">
            <div class="panel-head">
              <div>
                <div class="panel-kicker">LIVE P&amp;L WATERFALL</div>
                <h3 class="panel-title">Monthly Unit-Economics Bridge</h3>
              </div>
              <span class="panel-tag mono" id="tag-wf-rev"></span>
            </div>
            <div class="svg-wrap" id="pf-waterfall-svg"></div>
          </div>

          <div class="panel-card">
            <div class="panel-head">
              <div>
                <div class="panel-kicker">CAPITAL RECOVERY</div>
                <h3 class="panel-title">36-Month Cumulative Cashflow &amp; Payback</h3>
              </div>
              <span class="panel-tag mono" id="tag-pb-mo"></span>
            </div>
            <div class="svg-wrap" id="pf-payback-svg"></div>
          </div>
        </div>
      </div>
    </section>
  `;

  function updateLive(pf) {
    currentPf = pf;
    const p = pf.params;
    const paybackText = Number.isFinite(pf.paybackMonths) ? `${pf.paybackMonths.toFixed(1)} mo` : 'N/A';
    const beText = Number.isFinite(pf.breakEvenUnits)
      ? `${Math.ceil(pf.breakEvenUnits)} ${pf.spec.unitShort}`
      : 'N/A';
    const beUtilText = Number.isFinite(pf.breakEvenUtilPct)
      ? `${pf.breakEvenUtilPct.toFixed(0)}% util`
      : 'Unprofitable';

    container.querySelector('#pf-kpi-strip').innerHTML = `
      <div class="pf-kpi-card">
        <div class="kpi-label">Simple Payback</div>
        <div class="kpi-value ${pf.paybackMonths <= 20 ? 'tone-emerald' : pf.paybackMonths <= 30 ? 'tone-amber' : 'tone-crimson'}">${paybackText}</div>
        <div class="kpi-sub mono">Net Capex ${cur(pf.effectiveCapex, true)}</div>
      </div>
      <div class="pf-kpi-card">
        <div class="kpi-label">Monthly Site EBITDA</div>
        <div class="kpi-value ${pf.monthlyEbitda > 0 ? 'tone-emerald' : 'tone-crimson'}">${cur(pf.monthlyEbitda, true)}</div>
        <div class="kpi-sub mono">${pf.siteEbitdaMarginPct.toFixed(1)}% margin &middot; ${usd(pf.monthlyEbitda)}</div>
      </div>
      <div class="pf-kpi-card">
        <div class="kpi-label">Break-Even Volume</div>
        <div class="kpi-value">${beText}</div>
        <div class="kpi-sub mono">${beUtilText} vs ${p.utilizationPct}% target</div>
      </div>
      <div class="pf-kpi-card pf-verdict-card verdict-${pf.verdict.tone}">
        <div class="kpi-label">5-Yr IRR &amp; IC Verdict</div>
        <div class="kpi-value">${escapeHtml(pf.verdict.code)} <span class="pf-irr-inline">${pf.impliedIrrPct > -60 ? `${pf.impliedIrrPct.toFixed(1)}% IRR` : 'Neg.'}</span></div>
        <div class="kpi-sub">${escapeHtml(pf.corridorRow.corridor.label)} &middot; Rent ${pf.rentToRevPct.toFixed(1)}% of rev</div>
      </div>
    `;

    container.querySelector('#val-rent').textContent = formatNumber(p.rentPerSqft);
    container.querySelector('#foot-rent').innerHTML = `<span>Monthly Lease: ${cur(pf.monthlyRent, true)}</span><span>${pf.rentToRevPct.toFixed(1)}% of rev</span>`;

    container.querySelector('#val-ticket').textContent = cur(p.avgTicket);
    container.querySelector('#foot-ticket').innerHTML = `<span>Corridor Median: ${cur(pf.corridorRow.medianPrice)}</span><span>Rev: ${cur(pf.monthlyRevenue, true)}/mo</span>`;

    container.querySelector('#val-util').textContent = `${p.utilizationPct}% (${pf.activeUnits} ${pf.spec.unitShort})`;
    container.querySelector('#foot-util').innerHTML = `<span>Capacity: ${pf.spec.maxUnits} ${pf.spec.unitShort}</span><span>Safety Margin: ${pf.marginOfSafetyPct >= 0 ? '+' : ''}${pf.marginOfSafetyPct.toFixed(0)}%</span>`;

    container.querySelector('#val-capex').textContent = `${p.landlordCapexPct}%`;
    container.querySelector('#foot-capex').innerHTML = `<span>Gross: ${cur(pf.baseCapex, true)}</span><span>Net Outlay: ${cur(pf.effectiveCapex, true)}</span>`;

    const utilBarPct = Math.min(100, Math.max(0, p.utilizationPct));
    const beBarPct = Number.isFinite(pf.breakEvenUtilPct)
      ? Math.min(100, Math.max(0, pf.breakEvenUtilPct))
      : 100;

    container.querySelector('#be-gauge-box').innerHTML = `
      <div class="be-gauge-head mono">
        <span>Break-Even Utilization Gauge</span>
        <span>BE ${beUtilText} &middot; Target ${p.utilizationPct}%</span>
      </div>
      <div class="be-gauge-track">
        <div class="be-gauge-fill ${p.utilizationPct >= pf.breakEvenUtilPct ? 'is-safe' : 'is-under'}" style="width:${utilBarPct}%"></div>
        <div class="be-gauge-marker" style="left:${beBarPct}%" title="Break-even threshold"></div>
      </div>
    `;

    container.querySelector('#pf-equations-body').textContent =
      `Monthly Rev = Active Units x Ticket x ${pf.spec.revenueMultiplier}. Gross Margin = ${pf.grossMarginPct.toFixed(1)}%. Fixed Costs = Rent + Labor (${cur(pf.monthlyLabor, true)}) + Site Opex (${cur(pf.monthlyOtherOpex, true)}). Break-Even Units = Fixed Costs / (Ticket x ${pf.spec.revenueMultiplier} x GM%). Payback = Net Capex / Monthly EBITDA.`;

    container.querySelector('#tag-wf-rev').textContent = `${cur(pf.monthlyRevenue, true)} rev`;
    container.querySelector('#pf-waterfall-svg').innerHTML = renderWaterfallSvg(pf);
    container.querySelector('#tag-pb-mo').textContent = paybackText;
    container.querySelector('#pf-payback-svg').innerHTML = renderPaybackCurveSvg(pf, market);
  }

  updateLive(currentPf);

  container.querySelectorAll('[data-drop-corridor]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const cid = btn.getAttribute('data-drop-corridor');
      const target = market.corridors.find((c) => c.id === cid);
      const nextParams = {
        ...currentParams,
        corridorId: cid,
        rentPerSqft: target ? target.primeRentPerSqft : currentParams.rentPerSqft,
      };
      callbacks.onCorridorDrop(nextParams);
    });
  });

  const bindSlider = (id, key) => {
    const el = container.querySelector(id);
    if (!el) return;
    el.addEventListener('input', (e) => {
      currentParams = { ...currentParams, [key]: Number(e.target.value) };
      callbacks.onChange(currentParams);
      updateLive(computeStoreProForma(market, currentParams));
    });
  };

  bindSlider('#slider-rent', 'rentPerSqft');
  bindSlider('#slider-ticket', 'avgTicket');
  bindSlider('#slider-util', 'utilizationPct');
  bindSlider('#slider-capex', 'landlordCapexPct');

  container.querySelector('#btn-pf-reset').addEventListener('click', () => callbacks.onReset());
  container.querySelector('#btn-pf-open-memo').addEventListener('click', () => callbacks.onOpenMemo());
  container.querySelector('#btn-pf-export-md').addEventListener('click', () => {
    const memo = computeInvestmentMemo(market, currentParams.corridorId, currentPf);
    const md = generateMemoMarkdown(memo);
    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pe-memo-${market.id}-${currentParams.corridorId.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  });
}
