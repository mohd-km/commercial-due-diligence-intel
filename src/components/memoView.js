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

export function renderMemoView(container, memo, onEditProForma = null) {
  const { market, allStats, corridorScores, recommended, verdict, tam, unitEconomics, risks, diligenceChecklist } = memo;
  const cur = (v, compact = false) => formatCurrency(v, market, compact);
  const usd = (v) => formatUsd(v, market.fxToUsd, true);
  const markdown = generateMemoMarkdown(memo);
  const paybackStr = Number.isFinite(unitEconomics.paybackMonths)
    ? `${unitEconomics.paybackMonths.toFixed(1)} mo`
    : 'N/A';
  const beStr = Number.isFinite(unitEconomics.breakEvenUnits)
    ? `${Math.ceil(unitEconomics.breakEvenUnits)} ${unitEconomics.unitShort}`
    : 'N/A';

  container.innerHTML = `
    <div class="memo-toolbar no-print">
      <div class="memo-toolbar-meta">
        <span class="mono memo-id-tag">${escapeHtml(memo.memoId)}</span>
        <span class="memo-toolbar-sub">Synced with Live Store Pro-Forma &middot; ${escapeHtml(recommended.corridor.label)}</span>
      </div>
      <div class="memo-toolbar-actions">
        ${onEditProForma ? '<button type="button" class="btn-ghost" id="btn-edit-pf">Adjust Pro-Forma</button>' : ''}
        <button type="button" class="btn-secondary" id="btn-print-memo">Print / PDF</button>
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
            <span><strong>Corridor:</strong> ${escapeHtml(recommended.corridor.label)}</span>
            <span><strong>Date:</strong> ${escapeHtml(memo.date)}</span>
          </div>
        </div>
        <div class="memo-verdict-box verdict-${verdict.tone}">
          <div class="verdict-caption">IC VERDICT</div>
          <div class="verdict-code mono">${escapeHtml(verdict.code)}</div>
          <div class="verdict-sub">${escapeHtml(recommended.corridor.label)} &middot; WS ${recommended.whiteSpaceScore}/100</div>
        </div>
      </header>

      <section class="memo-section">
        <h3 class="memo-h3">1. Executive Thesis</h3>
        <p class="memo-lead">${escapeHtml(verdict.summary)}</p>
        <div class="memo-stat-pills mono">
          <span>n = ${allStats.count} anonymized operators</span>
          <span>Weighted Rating ${allStats.weightedAvgRating.toFixed(2)}/5.0</span>
          <span>Median ${cur(allStats.prices.median)}</span>
          <span>Top-5 Moat ${allStats.top5ReviewSharePct.toFixed(1)}% (Gini ${allStats.gini.toFixed(2)})</span>
        </div>
      </section>

      <div class="memo-two-col">
        <section class="memo-section">
          <h3 class="memo-h3">2. TAM / SAM / SOM &amp; Corridors</h3>
          <div class="memo-table-scroll">
            <table class="memo-table">
              <thead>
                <tr>
                  <th>Layer</th>
                  <th>Basis</th>
                  <th class="num">Local (Yr)</th>
                  <th class="num">USD Eq.</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td data-label="Layer"><strong>TAM</strong></td>
                  <td data-label="Basis">${formatCompact(tam.activeUsers)} &times; ${market.tamModel.annualVisitsPerUser}x @ ${cur(market.tamModel.avgTicketLocal)}</td>
                  <td data-label="Local (Yr)" class="num mono">${cur(tam.tamLocal, true)}</td>
                  <td data-label="USD Eq." class="num mono">${usd(tam.tamLocal)}</td>
                </tr>
                <tr>
                  <td data-label="Layer"><strong>SAM</strong></td>
                  <td data-label="Basis">${market.tamModel.samSharePct}% target corridors</td>
                  <td data-label="Local (Yr)" class="num mono">${cur(tam.samLocal, true)}</td>
                  <td data-label="USD Eq." class="num mono">${usd(tam.samLocal)}</td>
                </tr>
                <tr class="row-highlight">
                  <td data-label="Layer"><strong>SOM (Yr 3)</strong></td>
                  <td data-label="Basis">${market.tamModel.somShareOfSamPct}% in ${escapeHtml(recommended.corridor.label)}</td>
                  <td data-label="Local (Yr)" class="num mono">${cur(tam.somLocal, true)}</td>
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
                  <th class="num">Median</th>
                  <th class="num">WS</th>
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
                      <td data-label="Median" class="num mono">${cur(c.medianPrice)}</td>
                      <td data-label="WS" class="num mono">${c.whiteSpaceScore}/100</td>
                    </tr>`
                  )
                  .join('')}
              </tbody>
            </table>
          </div>
          <details class="editorial-details">
            <summary>TAM bottom-up methodology</summary>
            <p class="details-body">${escapeHtml(market.tamModel.tamNote)}</p>
          </details>
        </section>

        <section class="memo-section">
          <h3 class="memo-h3">3. Store Pro-Forma Unit Economics</h3>
          <p class="memo-footnote">${escapeHtml(unitEconomics.formatName)}</p>
          <div class="memo-table-scroll">
            <table class="memo-table">
              <thead>
                <tr>
                  <th>Line Item</th>
                  <th class="num">Pro-Forma</th>
                  <th class="num">Note / % Rev</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td data-label="Line Item">Target ${escapeHtml(market.priceUnitLabel)}</td>
                  <td data-label="Pro-Forma" class="num mono">${cur(unitEconomics.avgTicketLocal)}</td>
                  <td data-label="Note" class="num mono">${unitEconomics.dailyCovers} ${escapeHtml(unitEconomics.unitShort)} (${unitEconomics.utilizationPct}%)</td>
                </tr>
                <tr>
                  <td data-label="Line Item">Corridor Rent</td>
                  <td data-label="Pro-Forma" class="num mono">${formatNumber(unitEconomics.rentPerSqft)} ${escapeHtml(unitEconomics.rentUnit)}</td>
                  <td data-label="Note" class="num mono">${unitEconomics.rentToRevPct.toFixed(1)}% of rev</td>
                </tr>
                <tr>
                  <td data-label="Line Item">Monthly Revenue</td>
                  <td data-label="Pro-Forma" class="num mono">${cur(unitEconomics.monthlyRevenueLocal, true)}</td>
                  <td data-label="Note" class="num mono">${usd(unitEconomics.monthlyRevenueLocal)}</td>
                </tr>
                <tr>
                  <td data-label="Line Item">Gross Margin</td>
                  <td data-label="Pro-Forma" class="num mono">${unitEconomics.grossMarginPct.toFixed(1)}%</td>
                  <td data-label="Note" class="num mono">Direct COGS</td>
                </tr>
                <tr>
                  <td data-label="Line Item">Labor &amp; Site Opex</td>
                  <td data-label="Pro-Forma" class="num mono">${(unitEconomics.laborToRevPct + unitEconomics.otherOpexPct).toFixed(1)}%</td>
                  <td data-label="Note" class="num mono">${unitEconomics.laborToRevPct.toFixed(1)}% + ${unitEconomics.otherOpexPct.toFixed(1)}%</td>
                </tr>
                <tr class="row-highlight">
                  <td data-label="Line Item"><strong>Site-Level EBITDA</strong></td>
                  <td data-label="Pro-Forma" class="num mono"><strong>${cur(unitEconomics.monthlyEbitdaLocal, true)}/mo</strong></td>
                  <td data-label="Note" class="num mono"><strong>${unitEconomics.siteEbitdaMarginPct.toFixed(1)}% margin</strong></td>
                </tr>
                <tr>
                  <td data-label="Line Item">Break-Even Volume</td>
                  <td data-label="Pro-Forma" class="num mono">${beStr}</td>
                  <td data-label="Note" class="num mono">${Number.isFinite(unitEconomics.breakEvenUtilPct) ? `${unitEconomics.breakEvenUtilPct.toFixed(0)}% util` : 'N/A'}</td>
                </tr>
                <tr>
                  <td data-label="Line Item">Net Buildout Capex</td>
                  <td data-label="Pro-Forma" class="num mono">${cur(unitEconomics.buildoutCapexLocal, true)}</td>
                  <td data-label="Note" class="num mono">${unitEconomics.landlordCapexPct}% LL funded</td>
                </tr>
                <tr class="row-highlight">
                  <td data-label="Line Item"><strong>Payback &amp; 5-Yr IRR</strong></td>
                  <td data-label="Pro-Forma" class="num mono"><strong>${paybackStr}</strong></td>
                  <td data-label="Note" class="num mono"><strong>${unitEconomics.targetIrrPct > -60 ? `${unitEconomics.targetIrrPct.toFixed(1)}% IRR` : 'Neg.'}</strong></td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <section class="memo-section">
        <h3 class="memo-h3">4. Key Entry Risks &amp; Mitigants</h3>
        <div class="memo-table-scroll">
          <table class="memo-table memo-table-risks">
            <thead>
              <tr>
                <th>Severity</th>
                <th>Risk Driver</th>
                <th>Dataset Signal</th>
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
        <details class="editorial-details memo-checklist-drawer">
          <summary>5. 90-Day Commercial Diligence Workplan (${diligenceChecklist.length} items)</summary>
          <ol class="memo-checklist">
            ${diligenceChecklist.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}
          </ol>
        </details>
      </section>

      <footer class="memo-sheet-footer">
        <span>ILLUSTRATIVE BENCHMARK &middot; ANONYMIZED SYNTHETIC MODEL</span>
        <span class="mono">Commercial Due-Diligence &amp; Market Intelligence &middot; Mohammed KM</span>
      </footer>
    </article>
  `;

  const editPfBtn = container.querySelector('#btn-edit-pf');
  if (editPfBtn && onEditProForma) {
    editPfBtn.addEventListener('click', () => onEditProForma());
  }

  container.querySelector('#btn-print-memo').addEventListener('click', () => {
    container.querySelectorAll('details').forEach((d) => {
      d.open = true;
    });
    window.print();
  });

  const copyBtn = container.querySelector('#btn-copy-md');
  const dlBtn = container.querySelector('#btn-download-md');

  copyBtn.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(markdown);
      copyBtn.textContent = 'Copied';
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
      copyBtn.textContent = 'Copied';
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
