import './styles/main.css';
import { MARKETS, getMarketById } from './data/index.js';
import {
  computeCorridorWhiteSpace,
  computeInvestmentMemo,
  computeSummaryStats,
  formatCurrency,
  formatNumber,
  formatUsd,
} from './engine/analytics.js';
import {
  renderHistogramChart,
  renderMoatLeaderboard,
  renderScatterChart,
  renderWhiteSpacePanel,
} from './components/charts.js';
import { renderMemoView } from './components/memoView.js';
import { renderRegistryView } from './components/registryView.js';

const state = {
  marketId: MARKETS[0].id,
  activeView: 'analytics', // 'analytics' | 'memo' | 'registry'
  activeCorridor: 'ALL',
  activeSegment: 'ALL',
  minRating: 3.6,
  selectedVenueId: null,
  registrySort: { key: 'reviews', dir: 'desc' },
  registrySearch: '',
};

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function createTooltipController() {
  const el = document.createElement('div');
  el.className = 'chart-tooltip';
  document.body.appendChild(el);

  const position = (evt) => {
    const pad = 14;
    const rect = el.getBoundingClientRect();
    let x = evt.clientX + pad;
    let y = evt.clientY + pad;
    if (x + rect.width > window.innerWidth - 10) {
      x = evt.clientX - rect.width - pad;
    }
    if (y + rect.height > window.innerHeight - 10) {
      y = evt.clientY - rect.height - pad;
    }
    el.style.left = `${Math.max(8, x)}px`;
    el.style.top = `${Math.max(8, y)}px`;
  };

  return {
    show(evt, html) {
      el.innerHTML = html;
      el.classList.add('is-visible');
      position(evt);
    },
    move(evt) {
      position(evt);
    },
    hide() {
      el.classList.remove('is-visible');
    },
  };
}

const tooltipApi = createTooltipController();

function getFilteredVenues(market) {
  return market.venues.filter((v) => {
    if (state.activeCorridor !== 'ALL' && v.corridor !== state.activeCorridor) return false;
    if (state.activeSegment !== 'ALL' && v.segment !== state.activeSegment) return false;
    if (v.rating < state.minRating) return false;
    return true;
  });
}

function renderInspector(container, market) {
  const venue = market.venues.find((v) => v.id === state.selectedVenueId);
  if (!venue) {
    container.className = 'inspector-bar is-hidden';
    container.innerHTML = '';
    return;
  }

  container.className = 'inspector-bar';
  container.innerHTML = `
    <div>
      <div class="panel-kicker">SELECTED BENCHMARK OPERATOR &middot; ${escapeHtml(venue.corridor)} &middot; ${escapeHtml(venue.segment)}</div>
      <h3 class="inspector-title">${escapeHtml(venue.name)}</h3>
      <p class="inspector-pos">${escapeHtml(venue.positioning)}</p>
    </div>
    <div class="inspector-stats">
      <div class="insp-stat"><span>${escapeHtml(market.priceUnitLabel)}</span><strong>${formatCurrency(venue.price, market)}</strong></div>
      <div class="insp-stat"><span>Rating</span><strong>${venue.rating.toFixed(1)} / 5.0</strong></div>
      <div class="insp-stat"><span>Modelled Reviews</span><strong>${formatNumber(venue.reviews)}</strong></div>
      <div class="insp-stat"><span>Density</span><strong>${venue.densityIndex}/100</strong></div>
      <div class="insp-stat"><span>Utilization</span><strong>${venue.utilizationPct}%</strong></div>
      <div class="insp-stat"><span>${escapeHtml(market.capacityLabel)}</span><strong>${formatNumber(venue.capacity)}</strong></div>
      <button type="button" class="btn-ghost" id="btn-close-inspector">Clear</button>
    </div>
  `;

  container.querySelector('#btn-close-inspector').addEventListener('click', () => {
    state.selectedVenueId = null;
    renderApp();
  });
}

function renderApp() {
  const app = document.getElementById('app');
  const market = getMarketById(state.marketId);
  const filteredVenues = getFilteredVenues(market);
  const stats = computeSummaryStats(filteredVenues);
  const corridorScores = computeCorridorWhiteSpace(market);
  const topCorridor = corridorScores[0];
  const segments = [...new Set(market.venues.map((v) => v.segment))];

  app.innerHTML = `
    <div class="app-shell">
      <header class="topbar">
        <div class="brand-block">
          <div class="brand-kicker">COMMERCIAL DUE DILIGENCE</div>
          <h1 class="brand-title">Market-Entry Benchmarks &amp; IC Memo Engine</h1>
          <p class="brand-subtitle">Prepared by <strong>Mohammed KM</strong> &middot; Illustrative Commercial Due-Diligence Benchmarks</p>
        </div>
        <nav class="view-nav" aria-label="Primary views">
          <button type="button" class="view-tab ${state.activeView === 'analytics' ? 'is-active' : ''}" data-view="analytics">Market Analytics</button>
          <button type="button" class="view-tab ${state.activeView === 'memo' ? 'is-active' : ''}" data-view="memo">1-Page PE Memo</button>
          <button type="button" class="view-tab ${state.activeView === 'registry' ? 'is-active' : ''}" data-view="registry">Competitor Registry (${market.venues.length})</button>
        </nav>
      </header>

      <div class="methodology-banner" role="note" aria-label="Methodology notice">
        <span class="methodology-tag">METHODOLOGY</span>
        <p class="methodology-text">Operator identities are anonymized. Ratings, modelled review counts, pricing, and utilization figures are synthetic benchmarks constructed for commercial due-diligence illustration.</p>
      </div>

      <section class="control-bar">
        <div class="market-selector-row">
          <div class="market-tabs" role="tablist" aria-label="Target markets">
            ${MARKETS.map(
              (m) => `
              <button type="button" class="market-btn ${m.id === market.id ? 'is-active' : ''}" data-market-id="${m.id}">
                <span class="market-btn-name">${escapeHtml(m.shortName)}</span>
                <span class="market-btn-meta">${m.venues.length} venues &middot; ${m.corridors.length} corridors &middot; ${m.currency}</span>
              </button>`
            ).join('')}
          </div>
          <div class="snapshot-badge">${escapeHtml(market.region)} &middot; ${escapeHtml(market.snapshotDate)}</div>
        </div>

        <div class="filter-row">
          <div class="filter-group">
            <span class="filter-label">Corridor</span>
            <button type="button" class="pill-btn ${state.activeCorridor === 'ALL' ? 'is-active' : ''}" data-corridor="ALL">All Corridors</button>
            ${market.corridors
              .map(
                (c) => `
                <button type="button" class="pill-btn ${state.activeCorridor === c.id ? 'is-active' : ''}" data-corridor="${escapeHtml(c.id)}">
                  <span class="legend-swatch" style="background:${c.color}"></span>${escapeHtml(c.label)}
                </button>`
              )
              .join('')}
          </div>

          <div class="filter-group">
            <span class="filter-label">Segment</span>
            <select id="segment-select" class="select-control" aria-label="Filter by segment">
              <option value="ALL">All Segments</option>
              ${segments
                .map(
                  (seg) =>
                    `<option value="${escapeHtml(seg)}" ${state.activeSegment === seg ? 'selected' : ''}>${escapeHtml(seg)}</option>`
                )
                .join('')}
            </select>

            <label class="range-wrap">
              <span class="filter-label">Min Rating</span>
              <input type="range" id="rating-range" min="3.6" max="4.7" step="0.1" value="${state.minRating.toFixed(1)}" />
              <span class="mono">${state.minRating.toFixed(1)}+</span>
            </label>
          </div>
        </div>
      </section>

      <section class="kpi-strip" aria-label="Executive metrics">
        <div class="kpi-card">
          <div class="kpi-label">Benchmarked Venues</div>
          <div class="kpi-value">${stats.count}<span class="muted kpi-denom"> / ${market.venues.length}</span></div>
          <div class="kpi-sub">${formatNumber(stats.totalReviews)} modelled reviews</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">Weighted Avg Rating</div>
          <div class="kpi-value">${stats.weightedAvgRating.toFixed(2)}<span class="muted" style="font-size:13px"> / 5.0</span></div>
          <div class="kpi-sub">Simple mean ${stats.simpleAvgRating.toFixed(2)} &middot; Util ${stats.avgUtilization.toFixed(0)}%</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">Median ${escapeHtml(market.priceUnitLabel.split(' ')[0])} Price</div>
          <div class="kpi-value">${formatCurrency(stats.prices.median, market)}</div>
          <div class="kpi-sub">${formatUsd(stats.prices.median, market.fxToUsd, false)} eq. &middot; CV ${stats.prices.cvPct.toFixed(1)}%</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">Top-5 Review Moat</div>
          <div class="kpi-value accent-amber">${stats.top5ReviewSharePct.toFixed(1)}%</div>
          <div class="kpi-sub">Concentration Gini ${stats.gini.toFixed(2)} &middot; Density ${stats.avgDensity.toFixed(0)}/100</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">Top White-Space Corridor</div>
          <div class="kpi-value accent-emerald">${topCorridor.whiteSpaceScore}<span class="muted" style="font-size:13px">/100</span></div>
          <div class="kpi-sub">${escapeHtml(topCorridor.corridor.label)} &middot; ${topCorridor.posture}</div>
        </div>
      </section>

      <div id="venue-inspector" class="inspector-bar is-hidden"></div>

      <main id="main-stage"></main>

      <footer class="app-footer">
        <span>Commercial Due-Diligence &amp; Market Intelligence &middot; Mohammed KM</span>
        <span class="mono">Anonymized Synthetic Benchmark Data &middot; Client-Side Computation</span>
      </footer>
    </div>
  `;

  // Bind navigation & filter events
  app.querySelectorAll('.view-tab').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.activeView = btn.getAttribute('data-view');
      renderApp();
    });
  });

  app.querySelectorAll('.market-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const nextId = btn.getAttribute('data-market-id');
      if (nextId !== state.marketId) {
        state.marketId = nextId;
        state.activeCorridor = 'ALL';
        state.activeSegment = 'ALL';
        state.minRating = 3.6;
        state.selectedVenueId = null;
        state.registrySearch = '';
        renderApp();
      }
    });
  });

  app.querySelectorAll('[data-corridor]').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.activeCorridor = btn.getAttribute('data-corridor');
      renderApp();
    });
  });

  const segSelect = app.querySelector('#segment-select');
  segSelect.addEventListener('change', (e) => {
    state.activeSegment = e.target.value;
    renderApp();
  });

  const ratingRange = app.querySelector('#rating-range');
  ratingRange.addEventListener('input', (e) => {
    state.minRating = parseFloat(e.target.value);
    renderApp();
  });

  const inspectorEl = app.querySelector('#venue-inspector');
  renderInspector(inspectorEl, market);

  const stage = app.querySelector('#main-stage');
  const onSelectVenue = (venueId) => {
    state.selectedVenueId = state.selectedVenueId === venueId ? null : venueId;
    renderApp();
  };

  if (state.activeView === 'analytics') {
    stage.innerHTML = `
      <div class="analytics-grid">
        <section class="panel-card">
          <div class="panel-head">
            <div>
              <div class="panel-kicker">EXHIBIT 01 &middot; POSITIONING MATRIX</div>
              <h2 class="panel-title">Competitive Density vs. Average Rating</h2>
            </div>
            <span class="panel-tag">n = ${filteredVenues.length} operators</span>
          </div>
          <div id="chart-scatter"></div>
        </section>

        <section class="panel-card">
          <div class="panel-head">
            <div>
              <div class="panel-kicker">EXHIBIT 02 &middot; PRICE ARCHITECTURE</div>
              <h2 class="panel-title">Pricing Dispersion Histogram</h2>
            </div>
            <span class="panel-tag">${escapeHtml(market.currency)}</span>
          </div>
          <div id="chart-histogram"></div>
        </section>
      </div>

      <div class="analytics-grid">
        <section class="panel-card">
          <div class="panel-head">
            <div>
              <div class="panel-kicker">EXHIBIT 03 &middot; INCUMBENT ENTRENCHMENT</div>
              <h2 class="panel-title">Review-Volume Moat Leaderboard</h2>
            </div>
            <span class="panel-tag">Top 10 by Volume</span>
          </div>
          <div id="chart-moat"></div>
        </section>

        <section class="panel-card">
          <div class="panel-head">
            <div>
              <div class="panel-kicker">EXHIBIT 04 &middot; ENTRY PRIORITIZATION</div>
              <h2 class="panel-title">Underserved White-Space Score by Micro-Market</h2>
            </div>
            <span class="panel-tag">5-Factor Index</span>
          </div>
          <div id="chart-whitespace"></div>
        </section>
      </div>
    `;

    renderScatterChart(
      stage.querySelector('#chart-scatter'),
      filteredVenues,
      market,
      state.selectedVenueId,
      onSelectVenue,
      tooltipApi
    );
    renderHistogramChart(stage.querySelector('#chart-histogram'), filteredVenues, market, tooltipApi);
    renderMoatLeaderboard(
      stage.querySelector('#chart-moat'),
      filteredVenues,
      market,
      state.selectedVenueId,
      onSelectVenue
    );
    renderWhiteSpacePanel(
      stage.querySelector('#chart-whitespace'),
      corridorScores,
      market,
      state.activeCorridor,
      (corridorId) => {
        state.activeCorridor = corridorId;
        renderApp();
      }
    );
  } else if (state.activeView === 'memo') {
    const memo = computeInvestmentMemo(market, state.activeCorridor);
    renderMemoView(stage, memo);
  } else if (state.activeView === 'registry') {
    renderRegistryView(
      stage,
      filteredVenues,
      market,
      state.registrySort,
      state.registrySearch,
      state.selectedVenueId,
      {
        onSearch(val) {
          state.registrySearch = val;
          renderApp();
        },
        onSort(key) {
          if (state.registrySort.key === key) {
            state.registrySort.dir = state.registrySort.dir === 'asc' ? 'desc' : 'asc';
          } else {
            state.registrySort = { key, dir: key === 'name' || key === 'corridor' || key === 'segment' ? 'asc' : 'desc' };
          }
          renderApp();
        },
        onSelectVenue,
      }
    );
  }
}

renderApp();
