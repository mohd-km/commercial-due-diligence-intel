import {
  formatCompact,
  formatCurrency,
  formatNumber,
  formatUsd,
  generateMemoMarkdown,
} from '../engine/analytics.js';

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function renderMemoView(container, memo) {
  const { market, allStats, corridorScores, recommended, verdict, tam, unitEconomics, risks, diligenceChecklist } = memo;
  const cur = (v, compact = false) => formatCurrency(v, market, compact);
  const usd = (v) => formatUsd(v, market.fxToUsd, true);
  const markdown = generateMemoMarkdown(memo);

  container.innerHTML = `
    <div class="memo-toolbar">
      <div class="memo-toolbar-meta">
        <span class="mono memo-id-tag">${escapeHtml(memo.memoId)}</span>
        <span class="memo-toolbar-sub">1-Page Investment Committee Synthesis &middot; Modelled Benchmark</span>
      </div>
      <div class="memo-toolbar-actions">
        <button type="button" class="btn-secondary" id="btn-copy-md">Copy Markdown</button>
        <button type="button" class="btn-primary" id="btn-download-md">Export Markdown (.md)</button>
      </div>
    </div>

    <article class="pe-memo-sheet">
      <header class="memo-sheet-header">
        <div class="memo-header-left">
          <div class="memo-kicker">INVESTMENT COMMITTEE MEMORANDUM &middot; COMMERCIAL DUE DILIGENCE</div>
          <h2 class="memo-title">${escapeHtml(market.title)}</h2>
          <div class="memo-meta-strip">
            <span><strong>Prepared By:</strong> ${escapeHtml(memo.preparedBy)}</span>
            <span><strong>Region:</strong> ${escapeHtml(market.region)}</span>
            <span><strong>Sector:</strong> ${escapeHtml(market.sector)}</span>
            <span><strong>Date:</strong> ${escapeHtml(memo.date)}</span>
          </div>
        </div>
        <div class="memo-verdict-box verdict-${verdict.tone}">
          <div class="verdict-caption">IC RECOMMENDATION</div>
          <div class="verdict-code mono">${escapeHtml(verdict.code)}</div>
          <div class="verdict-sub">${escapeHtml(recommended.corridor.label)} &middot; WS ${recommended.whiteSpaceScore}/100</div>
        </div>
      </header>

      <section class="memo-section">
        <h3 class="memo-h3">1. Executive Thesis &amp; Verdict Rationale</h3>
        <p class="memo-lead">${escapeHtml(verdict.summary)}</p>
        <p class="memo-body">
          Across <strong>${allStats.count}</strong> anonymized benchmark operators (${formatNumber(allStats.totalReviews)} total modelled reviews), the market records a review-weighted average rating of
          <span class="mono">${allStats.weightedAvgRating.toFixed(2)}/5.00</span> and median ${escapeHtml(market.priceUnitLabel.toLowerCase())} of
          <span class="mono">${cur(allStats.prices.median)}</span> (IQR: <span class="mono">${cur(allStats.prices.p25)} – ${cur(allStats.prices.p75)}</span>).
          Review-volume concentration is elevated (Top-5 incumbent share <span class="mono">${allStats.top5ReviewSharePct.toFixed(1)}%</span>, Gini <span class="mono">${allStats.gini.toFixed(2)}</span>),
          reinforcing the case for disciplined micro-market selection over head-on entry in saturated clusters.
        </p>
      </section>

      <div class="memo-two-col">
        <section class="memo-section">
          <h3 class="memo-h3">2. TAM / SAM / SOM Proxy Model</h3>
          <p class="memo-footnote">${escapeHtml(market.tamModel.tamNote)}</p>
          <div class="memo-table-scroll">
            <table class="memo-table">
              <thead>
                <tr>
                  <th>Layer</th>
                  <th>Bottom-Up Basis</th>
                  <th class="num">Local (Annual)</th>
                  <th class="num">USD Eq.</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td data-label="Layer"><strong>TAM</strong></td>
                  <td data-label="Basis">${formatCompact(tam.activeUsers)} buyers &times; ${market.tamModel.annualVisitsPerUser}x @ ${cur(market.tamModel.avgTicketLocal)}</td>
                  <td data-label="Local (Annual)" class="num mono">${cur(tam.tamLocal, true)}</td>
                  <td data-label="USD Eq." class="num mono">${usd(tam.tamLocal)}</td>
                </tr>
                <tr>
                  <td data-label="Layer"><strong>SAM</strong></td>
                  <td data-label="Basis">${market.tamModel.samSharePct}% serviceable corridor share</td>
                  <td data-label="Local (Annual)" class="num mono">${cur(tam.samLocal, true)}</td>
                  <td data-label="USD Eq." class="num mono">${usd(tam.samLocal)}</td>
                </tr>
                <tr class="row-highlight">
                  <td data-label="Layer"><strong>SOM (Yr 3)</strong></td>
                  <td data-label="Basis">${market.tamModel.somShareOfSamPct}% target capture in ${escapeHtml(recommended.corridor.label)}</td>
                  <td data-label="Local (Annual)" class="num mono">${cur(tam.somLocal, true)}</td>
                  <td data-label="USD Eq." class="num mono">${usd(tam.somLocal)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <h4 class="memo-h4">Corridor White-Space Ranking</h4>
          <div class="memo-table-scroll">
            <table class="memo-table">
              <thead>
                <tr>
                  <th>Corridor</th>
                  <th class="num">Venues</th>
                  <th class="num">Density</th>
                  <th class="num">Median Price</th>
                  <th class="num">WS Score</th>
                </tr>
              </thead>
              <tbody>
                ${corridorScores
                  .map(
                    (c) => `
                    <tr class="${c.corridor.id === recommended.corridor.id ? 'row-highlight' : ''}">
                      <td data-label="Corridor"><strong>${escapeHtml(c.corridor.label)}</strong></td>
                      <td data-label="Venues" class="num mono">${c.count}</td>
                      <td data-label="Density" class="num mono">${c.avgDensity.toFixed(0)}/100</td>
                      <td data-label="Median Price" class="num mono">${cur(c.medianPrice)}</td>
                      <td data-label="WS Score" class="num mono">${c.whiteSpaceScore}/100</td>
                    </tr>`
                  )
                  .join('')}
              </tbody>
            </table>
          </div>
        </section>

        <section class="memo-section">
          <h3 class="memo-h3">3. Unit-Economics Benchmark</h3>
          <p class="memo-footnote">Format: ${escapeHtml(unitEconomics.formatName)} (Illustrative synthetic steady-state model)</p>
          <div class="memo-table-scroll">
            <table class="memo-table">
              <thead>
                <tr>
                  <th>Line Item</th>
                  <th class="num">Benchmark</th>
                  <th class="num">% of Rev / Note</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td data-label="Line Item">Target ${escapeHtml(market.priceUnitLabel)}</td>
                  <td data-label="Benchmark" class="num mono">${cur(unitEconomics.avgTicketLocal)}</td>
                  <td data-label="Note" class="num mono">${unitEconomics.dailyCovers} daily units</td>
                </tr>
                <tr>
                  <td data-label="Line Item">Monthly Revenue</td>
                  <td data-label="Benchmark" class="num mono">${cur(unitEconomics.monthlyRevenueLocal, true)}</td>
                  <td data-label="Note" class="num mono">${usd(unitEconomics.monthlyRevenueLocal)}</td>
                </tr>
                <tr>
                  <td data-label="Line Item">Gross Profit Margin</td>
                  <td data-label="Benchmark" class="num mono">${unitEconomics.grossMarginPct.toFixed(1)}%</td>
                  <td data-label="Note" class="num mono">Direct COGS</td>
                </tr>
                <tr>
                  <td data-label="Line Item">Occupancy / Lease Cost</td>
                  <td data-label="Benchmark" class="num mono">${unitEconomics.rentToRevPct.toFixed(1)}%</td>
                  <td data-label="Note" class="num mono">Target corridor cap</td>
                </tr>
                <tr>
                  <td data-label="Line Item">Direct Labor &amp; Site Opex</td>
                  <td data-label="Benchmark" class="num mono">${(unitEconomics.laborToRevPct + unitEconomics.otherOpexPct).toFixed(1)}%</td>
                  <td data-label="Note" class="num mono">${unitEconomics.laborToRevPct.toFixed(1)}% + ${unitEconomics.otherOpexPct.toFixed(1)}%</td>
                </tr>
                <tr class="row-highlight">
                  <td data-label="Line Item"><strong>Site-Level EBITDA</strong></td>
                  <td data-label="Benchmark" class="num mono"><strong>${cur(unitEconomics.monthlyEbitdaLocal, true)}/mo</strong></td>
                  <td data-label="Note" class="num mono"><strong>${unitEconomics.siteEbitdaMarginPct.toFixed(1)}% margin</strong></td>
                </tr>
                <tr>
                  <td data-label="Line Item">Initial Buildout Capex</td>
                  <td data-label="Benchmark" class="num mono">${cur(unitEconomics.buildoutCapexLocal, true)}</td>
                  <td data-label="Note" class="num mono">${usd(unitEconomics.buildoutCapexLocal)}</td>
                </tr>
                <tr class="row-highlight">
                  <td data-label="Line Item"><strong>Payback &amp; Unlevered IRR</strong></td>
                  <td data-label="Benchmark" class="num mono"><strong>${unitEconomics.paybackMonths.toFixed(1)} months</strong></td>
                  <td data-label="Note" class="num mono"><strong>${unitEconomics.targetIrrPct.toFixed(1)}% IRR</strong></td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <section class="memo-section">
        <h3 class="memo-h3">4. Key Entry Risks &amp; Concrete Mitigants</h3>
        <div class="memo-table-scroll">
          <table class="memo-table memo-table-risks">
            <thead>
              <tr>
                <th>Severity</th>
                <th>Risk Driver</th>
                <th>Modelled Dataset Signal</th>
                <th>Mitigant</th>
              </tr>
            </thead>
            <tbody>
              ${risks
                .map(
                  (r) => `
                  <tr>
                    <td data-label="Severity"><span class="sev-badge sev-${r.severity.toLowerCase()}">${escapeHtml(r.severity)}</span></td>
                    <td data-label="Risk Driver"><strong>${escapeHtml(r.driver)}</strong></td>
                    <td data-label="Signal">${escapeHtml(r.signal)}</td>
                    <td data-label="Mitigant">${escapeHtml(r.mitigant)}</td>
                  </tr>`
                )
                .join('')}
            </tbody>
          </table>
        </div>
      </section>

      <section class="memo-section">
        <h3 class="memo-h3">5. Next-Step 90-Day Commercial Diligence Workplan</h3>
        <ol class="memo-checklist">
          ${diligenceChecklist.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}
        </ol>
      </section>

      <footer class="memo-sheet-footer">
        <span>ILLUSTRATIVE BENCHMARK &middot; ANONYMIZED SYNTHETIC MODEL</span>
        <span class="mono">Commercial Due-Diligence &amp; Market Intelligence &middot; Mohammed KM</span>
      </footer>
    </article>
  `;

  const copyBtn = container.querySelector('#btn-copy-md');
  const dlBtn = container.querySelector('#btn-download-md');

  copyBtn.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(markdown);
      copyBtn.textContent = 'Copied to Clipboard';
      setTimeout(() => {
        copyBtn.textContent = 'Copy Markdown';
      }, 1800);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = markdown;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      copyBtn.textContent = 'Copied to Clipboard';
      setTimeout(() => {
        copyBtn.textContent = 'Copy Markdown';
      }, 1800);
    }
  });

  dlBtn.addEventListener('click', () => {
    const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pe-memo-${market.id}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  });
}
