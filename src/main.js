import './styles/main.css';
import { MARKETS, getMarketById } from './data/index.js';
import {
  computeCorridorWhiteSpace,
  computeInvestmentMemo,
  computeStoreProForma,
  computeSummaryStats,
  formatCurrency,
  formatNumber,
  formatUsd,
  getEditorialCorridorColor,
  getProFormaDefaults,
} from './engine/analytics.js';
import {
  renderHistogramChart,
  renderMoatLeaderboard,
  renderScatterChart,
  renderWhiteSpacePanel,
} from './components/charts.js';
import { renderProFormaView } from './components/proFormaView.js';
import { renderMemoView } from './components/memoView.js';
import { renderRegistryView } from './components/registryView.js';

const state = {
  marketId: MARKETS[0].id,
  activeView: 'analytics', // 'analytics' | 'proforma' | 'memo' | 'registry'
  mapLens: 'density', // 'density' | 'price' | 'moat'
  activeCorridor: 'ALL',
  activeSegment: 'ALL',
  minRating: 3.6,
  selectedVenueId: null,
  registrySort: { key: 'reviews', dir: 'desc' },
  registrySearch: '',
  proFormaByMarket: {},
};

function getProFormaParams(market) {
  if (!state.proFormaByMarket[market.id]) {
    state.proFormaByMarket[market.id] = getProFormaDefaults(market);
  }
  return state.proFormaByMarket[market.id];
}

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
      <div class="panel-kicker">SELECTED OPERATOR &middot; ${escapeHtml(venue.corridor)} &middot; ${escapeHtml(venue.segment)}</div>
      <h3 class="inspector-title">${escapeHtml(venue.name)}</h3>
      <p class="inspector-pos">${escapeHtml(venue.positioning)}</p>
    </div>
    <div class="inspector-stats">
      <div class="insp-stat"><span>${escapeHtml(market.priceUnitLabel)}</span><strong>${formatCurrency(venue.price, market)}</strong></div>
      <div class="insp-stat"><span>Rating</span><strong>${venue.rating.toFixed(1)} / 5.0</strong></div>
      <div class="insp-stat"><span>Reviews</span><strong>${formatNumber(venue.reviews)}</strong></div>
      <div class="insp-stat"><span>Density</span><strong>${venue.densityIndex}/100</strong></div>
      <div class="insp-stat"><span>Util</span><strong>${venue.utilizationPct}%</strong></div>
      <button type="button" class="btn-secondary" id="btn-clone-pf">Use in Pro-Forma</button>
      <button type="button" class="btn-ghost" id="btn-close-inspector">Clear</button>
    </div>
  `;

  container.querySelector('#btn-clone-pf').addEventListener('click', () => {
    const corridorObj = market.corridors.find((c) => c.id === venue.corridor);
    const current = getProFormaParams(market);
    state.proFormaByMarket[market.id] = {
      ...current,
      corridorId: venue.corridor,
      rentPerSqft: corridorObj ? corridorObj.primeRentPerSqft : current.rentPerSqft,
      avgTicket: venue.price,
      utilizationPct: Math.min(98, Math.max(35, venue.utilizationPct)),
    };
    state.activeView = 'proforma';
    renderApp();
  });

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
  const pfParams = getProFormaParams(market);
  const proForma = computeStoreProForma(market, pfParams);

  const showFilterRow = state.activeView === 'analytics' || state.activeView === 'registry';

  app.innerHTML = `
    <div class="app-shell">
      <header class="topbar no-print">
        <div class="brand-block">
          <div class="brand-kicker">
            <span>COMMERCIAL DUE DILIGENCE</span>
            <span class="synthetic-pill">ANONYMIZED &middot; SYNTHETIC BENCHMARKS</span>
          </div>
          <div class="brand-title-row">
            <span class="brand-mark" aria-hidden="true">
              <svg viewBox="0 0 36 36" width="36" height="36" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect x="0.75" y="0.75" width="34.5" height="34.5" rx="7.25" fill="#ffffff" stroke="#111111" stroke-width="1.5" />
                <line x1="8" y1="26.5" x2="28" y2="26.5" stroke="#111111" stroke-width="1.25" stroke-linecap="round" />
                <rect x="9.5" y="19" width="3.75" height="7.5" rx="0.75" fill="#111111" />
                <rect x="16.125" y="14" width="3.75" height="12.5" rx="0.75" fill="#111111" />
                <rect x="22.75" y="9.5" width="3.75" height="17" rx="0.75" fill="#111111" />
                <circle cx="11.375" cy="12" r="1.5" fill="#111111" />
              </svg>
            </span>
            <h1 class="brand-title">Market-Entry Visual Map &amp; Store Pro-Forma</h1>
          </div>
          <p class="brand-subtitle">Mohammed KM &middot; 100% client-side interactive benchmarks across Bengaluru, Dubai &amp; London</p>
        </div>
        <nav class="view-nav" aria-label="Primary views">
          <button type="button" class="view-tab ${state.activeView === 'analytics' ? 'is-active' : ''}" data-view="analytics">Visual Map</button>
          <button type="button" class="view-tab ${state.activeView === 'proforma' ? 'is-active' : ''}" data-view="proforma">Store Pro-Forma</button>
          <button type="button" class="view-tab ${state.activeView === 'memo' ? 'is-active' : ''}" data-view="memo">1-Page PE Memo</button>
          <button type="button" class="view-tab ${state.activeView === 'registry' ? 'is-active' : ''}" data-view="registry">Registry (${market.venues.length})</button>
        </nav>
      </header>

      <section class="control-bar no-print">
        <div class="market-selector-row">
          <div class="market-tabs" role="tablist" aria-label="Target markets">
            ${MARKETS.map(
              (m) => `
              <button type="button" class="market-btn ${m.id === market.id ? 'is-active' : ''}" data-market-id="${m.id}">
                <span class="market-btn-name">${escapeHtml(m.shortName)}</span>
                <span class="market-btn-meta">${m.venues.length} operators &middot; ${m.corridors.length} corridors &middot; ${m.currency}</span>
              </button>`
            ).join('')}
          </div>
          <div class="snapshot-badge">${escapeHtml(market.region)} &middot; ${escapeHtml(market.snapshotDate)}</div>
        </div>

        ${
          showFilterRow
            ? `
          <div class="filter-row">
            <div class="filter-group">
              <span class="filter-label">Corridor</span>
              <button type="button" class="pill-btn ${state.activeCorridor === 'ALL' ? 'is-active' : ''}" data-corridor="ALL">All</button>
              ${market.corridors
                .map(
                  (c) => `
                  <button type="button" class="pill-btn ${state.activeCorridor === c.id ? 'is-active' : ''}" data-corridor="${escapeHtml(c.id)}">
                    <span class="legend-swatch" style="background:${getEditorialCorridorColor(c.color)}"></span>${escapeHtml(c.label)}
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
          </div>`
            : ''
        }
      </section>

      ${
        state.activeView === 'analytics'
          ? `
        <section class="kpi-strip no-print" aria-label="Executive metrics">
          <div class="kpi-card">
            <div class="kpi-label">Operators</div>
            <div class="kpi-value">${stats.count}<span class="muted kpi-denom"> / ${market.venues.length}</span></div>
            <div class="kpi-sub">${formatNumber(stats.totalReviews)} modelled reviews</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-label">Weighted Rating</div>
            <div class="kpi-value">${stats.weightedAvgRating.toFixed(2)}<span class="muted kpi-denom"> / 5.0</span></div>
            <div class="kpi-sub">Util ${stats.avgUtilization.toFixed(0)}% avg</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-label">Median Price</div>
            <div class="kpi-value">${formatCurrency(stats.prices.median, market)}</div>
            <div class="kpi-sub">${formatUsd(stats.prices.median, market.fxToUsd, false)} &middot; CV ${stats.prices.cvPct.toFixed(1)}%</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-label">Top-5 Moat Share</div>
            <div class="kpi-value tone-amber">${stats.top5ReviewSharePct.toFixed(1)}%</div>
            <div class="kpi-sub">Gini ${stats.gini.toFixed(2)} &middot; Density ${stats.avgDensity.toFixed(0)}</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-label">Top White-Space</div>
            <div class="kpi-value tone-emerald">${topCorridor.whiteSpaceScore}<span class="muted kpi-denom">/100</span></div>
            <div class="kpi-sub">${escapeHtml(topCorridor.corridor.label)}</div>
          </div>
        </section>`
          : ''
      }

      <div id="venue-inspector" class="inspector-bar is-hidden no-print"></div>

      <main id="main-stage"></main>

      <footer class="app-footer no-print">
        <span>Commercial Due-Diligence &amp; Market Intelligence &middot; Mohammed KM</span>
        <span class="mono">Anonymized Synthetic Benchmarks &middot; Zero Runtime APIs</span>
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
  if (segSelect) {
    segSelect.addEventListener('change', (e) => {
      state.activeSegment = e.target.value;
      renderApp();
    });
  }

  const ratingRange = app.querySelector('#rating-range');
  if (ratingRange) {
    ratingRange.addEventListener('change', (e) => {
      state.minRating = parseFloat(e.target.value);
      renderApp();
    });
  }

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
              <div class="panel-kicker">EXHIBIT 01 &middot; INTERACTIVE CORRIDOR &amp; MOAT MAP</div>
              <h2 class="panel-title">Positioning Matrix &amp; Hypothetical Outlet Overlay</h2>
            </div>
            <div class="lens-toggle" role="tablist" aria-label="Map axis lens">
              <button type="button" class="lens-btn ${state.mapLens === 'density' ? 'is-active' : ''}" data-lens="density">Density</button>
              <button type="button" class="lens-btn ${state.mapLens === 'price' ? 'is-active' : ''}" data-lens="price">Price</button>
              <button type="button" class="lens-btn ${state.mapLens === 'moat' ? 'is-active' : ''}" data-lens="moat">Moat</button>
            </div>
          </div>
          <div id="chart-scatter"></div>
        </section>

        <section class="panel-card">
          <div class="panel-head">
            <div>
              <div class="panel-kicker">EXHIBIT 02 &middot; PRICE ARCHITECTURE</div>
              <h2 class="panel-title">Pricing Dispersion Histogram</h2>
            </div>
            <span class="panel-tag mono">${escapeHtml(market.currency)}</span>
          </div>
          <div id="chart-histogram"></div>
        </section>
      </div>

      <div class="analytics-grid">
        <section class="panel-card">
          <div class="panel-head">
            <div>
              <div class="panel-kicker">EXHIBIT 03 &middot; ENTRY PRIORITIZATION</div>
              <h2 class="panel-title">Corridor White-Space Index</h2>
            </div>
            <span class="panel-tag mono">5-Factor Model</span>
          </div>
          <div id="chart-whitespace"></div>
        </section>

        <section class="panel-card">
          <div class="panel-head">
            <div>
              <div class="panel-kicker">EXHIBIT 04 &middot; INCUMBENT ENTRENCHMENT</div>
              <h2 class="panel-title">Review-Volume Moat Leaderboard</h2>
            </div>
            <span class="panel-tag mono">Top 8</span>
          </div>
          <div id="chart-moat"></div>
        </section>
      </div>
    `;

    stage.querySelectorAll('[data-lens]').forEach((btn) => {
      btn.addEventListener('click', () => {
        state.mapLens = btn.getAttribute('data-lens');
        renderApp();
      });
    });

    renderScatterChart(
      stage.querySelector('#chart-scatter'),
      filteredVenues,
      market,
      state.selectedVenueId,
      onSelectVenue,
      tooltipApi,
      {
        lens: state.mapLens,
        hypotheticalOutlet: proForma.hypotheticalOutlet,
      }
    );
    renderHistogramChart(
      stage.querySelector('#chart-histogram'),
      filteredVenues,
      market,
      tooltipApi,
      proForma.params.avgTicket
    );
    renderWhiteSpacePanel(
      stage.querySelector('#chart-whitespace'),
      corridorScores,
      market,
      state.activeCorridor,
      (corridorId) => {
        state.activeCorridor = corridorId;
        renderApp();
      },
      (corridorId) => {
        const cObj = market.corridors.find((c) => c.id === corridorId);
        state.proFormaByMarket[market.id] = {
          ...getProFormaParams(market),
          corridorId,
          rentPerSqft: cObj ? cObj.primeRentPerSqft : getProFormaParams(market).rentPerSqft,
        };
        state.activeView = 'proforma';
        renderApp();
      }
    );
    renderMoatLeaderboard(
      stage.querySelector('#chart-moat'),
      filteredVenues,
      market,
      state.selectedVenueId,
      onSelectVenue
    );
  } else if (state.activeView === 'proforma') {
    renderProFormaView(stage, market, proForma, {
      onChange(nextParams) {
        state.proFormaByMarket[market.id] = nextParams;
      },
      onCorridorDrop(nextParams) {
        state.proFormaByMarket[market.id] = nextParams;
        renderApp();
      },
      onReset() {
        state.proFormaByMarket[market.id] = getProFormaDefaults(market);
        renderApp();
      },
      onOpenMemo() {
        state.activeView = 'memo';
        renderApp();
      },
    });
  } else if (state.activeView === 'memo') {
    const memo = computeInvestmentMemo(market, pfParams.corridorId, proForma);
    renderMemoView(stage, memo, () => {
      state.activeView = 'proforma';
      renderApp();
    });
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
            state.registrySort = {
              key,
              dir: key === 'name' || key === 'corridor' || key === 'segment' ? 'asc' : 'desc',
            };
          }
          renderApp();
        },
        onSelectVenue,
      }
    );
  }
}

renderApp();
