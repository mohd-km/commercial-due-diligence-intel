// Deterministic Commercial Due-Diligence Analytics & PE Memo Engine
// 100% client-side computation, zero runtime API calls, zero emojis.

export function percentile(sortedValues, p) {
  if (!sortedValues.length) return 0;
  const idx = (sortedValues.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sortedValues[lo];
  return sortedValues[lo] + (sortedValues[hi] - sortedValues[lo]) * (idx - lo);
}

export function computeGini(values) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const n = sorted.length;
  const sum = sorted.reduce((acc, v) => acc + v, 0);
  if (sum === 0) return 0;
  let weightedSum = 0;
  for (let i = 0; i < n; i += 1) {
    weightedSum += (i + 1) * sorted[i];
  }
  return (2 * weightedSum) / (n * sum) - (n + 1) / n;
}

export function formatNumber(val, decimals = 0) {
  if (!Number.isFinite(val)) return '0';
  return val.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export function formatCompact(val) {
  if (!Number.isFinite(val)) return '0';
  const abs = Math.abs(val);
  if (abs >= 1e9) return `${(val / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${(val / 1e6).toFixed(2)}M`;
  if (abs >= 1e3) return `${(val / 1e3).toFixed(1)}K`;
  return formatNumber(val, 0);
}

export function formatCurrency(val, market, compact = false) {
  const numStr = compact ? formatCompact(val) : formatNumber(Math.round(val), 0);
  return `${market.currency} ${numStr}`;
}

export function formatUsd(localVal, fxToUsd, compact = true) {
  const usd = localVal * fxToUsd;
  return compact ? `USD ${formatCompact(usd)}` : `USD ${formatNumber(usd, 0)}`;
}

export function classifyMoatTier(reviews, sharePct) {
  if (sharePct >= 8.0 || reviews >= 2500) return 'Fortress';
  if (sharePct >= 3.5 || reviews >= 1000) return 'Established';
  return 'Challenger';
}

export function computeSummaryStats(venues) {
  const count = venues.length;
  if (count === 0) {
    return {
      count: 0,
      totalReviews: 0,
      weightedAvgRating: 0,
      simpleAvgRating: 0,
      avgDensity: 0,
      avgUtilization: 0,
      prices: { min: 0, p25: 0, median: 0, p75: 0, max: 0, iqr: 0, cvPct: 0 },
      top5ReviewSharePct: 0,
      gini: 0,
    };
  }

  const totalReviews = venues.reduce((s, v) => s + v.reviews, 0);
  const weightedRatingNum = venues.reduce((s, v) => s + v.rating * v.reviews, 0);
  const weightedAvgRating = totalReviews > 0 ? weightedRatingNum / totalReviews : 0;
  const simpleAvgRating = venues.reduce((s, v) => s + v.rating, 0) / count;
  const avgDensity = venues.reduce((s, v) => s + v.densityIndex, 0) / count;
  const avgUtilization = venues.reduce((s, v) => s + v.utilizationPct, 0) / count;

  const sortedPrices = venues.map((v) => v.price).sort((a, b) => a - b);
  const min = sortedPrices[0];
  const max = sortedPrices[sortedPrices.length - 1];
  const p25 = percentile(sortedPrices, 0.25);
  const median = percentile(sortedPrices, 0.5);
  const p75 = percentile(sortedPrices, 0.75);
  const iqr = p75 - p25;
  const meanPrice = sortedPrices.reduce((s, p) => s + p, 0) / count;
  const variance = sortedPrices.reduce((s, p) => s + (p - meanPrice) ** 2, 0) / count;
  const cvPct = meanPrice > 0 ? (Math.sqrt(variance) / meanPrice) * 100 : 0;

  const sortedReviewsDesc = [...venues].sort((a, b) => b.reviews - a.reviews);
  const top5Reviews = sortedReviewsDesc.slice(0, 5).reduce((s, v) => s + v.reviews, 0);
  const top5ReviewSharePct = totalReviews > 0 ? (top5Reviews / totalReviews) * 100 : 0;
  const gini = computeGini(venues.map((v) => v.reviews));

  return {
    count,
    totalReviews,
    weightedAvgRating,
    simpleAvgRating,
    avgDensity,
    avgUtilization,
    prices: { min, p25, median, p75, max, iqr, cvPct },
    top5ReviewSharePct,
    gini,
  };
}

export function computePriceHistogram(venues, corridors, binCount = 8) {
  if (!venues.length) return { bins: [], maxBinTotal: 0, minPrice: 0, maxPrice: 0 };
  const prices = venues.map((v) => v.price);
  const rawMin = Math.min(...prices);
  const rawMax = Math.max(...prices);
  const span = Math.max(1, rawMax - rawMin);
  const step = Math.ceil(span / binCount / 10) * 10 || Math.ceil(span / binCount);
  const start = Math.floor(rawMin / step) * step;

  const bins = [];
  for (let i = 0; i < binCount; i += 1) {
    const lo = start + i * step;
    const hi = lo + step;
    const byCorridor = {};
    corridors.forEach((c) => {
      byCorridor[c.id] = 0;
    });
    bins.push({
      lo,
      hi,
      label: `${lo}–${hi}`,
      shortLabel: `${lo}`,
      total: 0,
      byCorridor,
    });
  }

  venues.forEach((v) => {
    let idx = Math.floor((v.price - start) / step);
    if (idx < 0) idx = 0;
    if (idx >= binCount) idx = binCount - 1;
    bins[idx].total += 1;
    if (bins[idx].byCorridor[v.corridor] !== undefined) {
      bins[idx].byCorridor[v.corridor] += 1;
    }
  });

  const maxBinTotal = Math.max(...bins.map((b) => b.total), 1);
  return {
    bins,
    maxBinTotal,
    minPrice: start,
    maxPrice: start + binCount * step,
  };
}

export function computeMoatLeaderboard(venues, limit = 10) {
  const totalReviews = venues.reduce((s, v) => s + v.reviews, 0) || 1;
  return [...venues]
    .sort((a, b) => b.reviews - a.reviews)
    .slice(0, limit)
    .map((v, idx) => {
      const sharePct = (v.reviews / totalReviews) * 100;
      return {
        rank: idx + 1,
        ...v,
        sharePct,
        moatTier: classifyMoatTier(v.reviews, sharePct),
      };
    });
}

export function computeCorridorWhiteSpace(market) {
  const allPrices = market.venues.map((v) => v.price).sort((a, b) => a - b);
  const marketMedianPrice = percentile(allPrices, 0.5) || 1;

  const rows = market.corridors.map((corridor) => {
    const subset = market.venues.filter((v) => v.corridor === corridor.id);
    const stats = computeSummaryStats(subset);
    const avgReviews = subset.length ? stats.totalReviews / subset.length : 0;

    // 5-factor deterministic white-space model (each sub-score 0-100)
    const demandScore = Math.round(corridor.demandProxyIndex);
    const supplyGapScore = Math.max(8, Math.min(96, Math.round(102 - stats.avgDensity * 0.92)));
    const qualityGapScore = Math.max(18, Math.min(94, Math.round((4.88 - stats.simpleAvgRating) * 115)));
    const moatOpennessScore = Math.max(10, Math.min(95, Math.round(100 - Math.min(92, (avgReviews / 32)))));
    const priceHeadroomScore = Math.max(
      24,
      Math.min(94, Math.round(58 + ((stats.prices.median / marketMedianPrice) - 0.9) * 75))
    );

    const whiteSpaceScore = Math.round(
      demandScore * 0.28 +
      supplyGapScore * 0.34 +
      qualityGapScore * 0.14 +
      moatOpennessScore * 0.16 +
      priceHeadroomScore * 0.08
    );

    let posture = 'SATURATED / AVOID';
    let postureClass = 'saturated';
    if (whiteSpaceScore >= 70) {
      posture = 'PRIORITY ENTRY';
      postureClass = 'priority';
    } else if (whiteSpaceScore >= 52) {
      posture = 'SELECTIVE / NICHE';
      postureClass = 'selective';
    }

    return {
      corridor,
      count: subset.length,
      avgRating: stats.simpleAvgRating,
      weightedAvgRating: stats.weightedAvgRating,
      medianPrice: stats.prices.median,
      avgDensity: stats.avgDensity,
      avgUtilization: stats.avgUtilization,
      totalReviews: stats.totalReviews,
      avgReviews: Math.round(avgReviews),
      subScores: {
        demandScore,
        supplyGapScore,
        qualityGapScore,
        moatOpennessScore,
        priceHeadroomScore,
      },
      whiteSpaceScore,
      posture,
      postureClass,
    };
  });

  return rows.sort((a, b) => b.whiteSpaceScore - a.whiteSpaceScore);
}

export function computeInvestmentMemo(market, activeCorridor = 'ALL') {
  const allStats = computeSummaryStats(market.venues);
  const corridorScores = computeCorridorWhiteSpace(market);
  const recommended = activeCorridor === 'ALL'
    ? corridorScores[0]
    : corridorScores.find((c) => c.corridor.id === activeCorridor) || corridorScores[0];

  const saturatedCorridor = corridorScores[corridorScores.length - 1];

  // Bottom-up TAM / SAM / SOM computation
  const t = market.tamModel;
  const activeUsers = t.targetPopulation * (t.adoptionRatePct / 100);
  const annualOccasions = activeUsers * t.annualVisitsPerUser;
  const tamLocal = annualOccasions * t.avgTicketLocal;
  const samLocal = tamLocal * (t.samSharePct / 100);
  const somLocal = samLocal * (t.somShareOfSamPct / 100);

  const ue = market.unitEconomics;
  const ws = recommended.whiteSpaceScore;

  let verdictLabel = 'CONDITIONAL / WATCH — CAPEX-GATED';
  let verdictCode = 'CONDITIONAL';
  let verdictTone = 'amber';
  let verdictSummary = '';

  if (ws >= 72 && ue.paybackMonths <= 20) {
    verdictLabel = 'GO — TARGETED CORRIDOR ENTRY';
    verdictCode = 'GO';
    verdictTone = 'emerald';
    verdictSummary = `${recommended.corridor.label} scores ${ws}/100 on the Underserved White-Space Index with ${Math.round(recommended.avgDensity)}/100 competitive density (vs. ${Math.round(saturatedCorridor.avgDensity)}/100 in ${saturatedCorridor.corridor.label}) and sub-${Math.ceil(ue.paybackMonths)}-month site payback at ${ue.siteEbitdaMarginPct.toFixed(1)}% steady-state EBITDA margin.`;
  } else if (ws >= 66 && ue.paybackMonths <= 30) {
    verdictLabel = 'SELECTIVE GO — STRUCTURED ENTRY';
    verdictCode = 'SELECTIVE GO';
    verdictTone = 'emerald';
    verdictSummary = `${recommended.corridor.label} exhibits a compelling ${ws}/100 White-Space Score driven by low incumbent density (${Math.round(recommended.avgDensity)}/100) and ${recommended.avgUtilization.toFixed(0)}% incumbent utilization, supporting entry provided lease obligations are structured via hybrid management agreements.`;
  } else {
    verdictLabel = 'CONDITIONAL / WATCH — CAPEX-GATED';
    verdictCode = 'CONDITIONAL';
    verdictTone = 'amber';
    verdictSummary = `While ${recommended.corridor.label} leads the market at ${ws}/100 White-Space Score, unsubsidized buildout payback (${ue.paybackMonths.toFixed(1)} months) and ${ue.siteEbitdaMarginPct.toFixed(1)}% site EBITDA margin require >=70% landlord Cat-B capex funding before IC capital release.`;
  }

  const memoId = `IC-${market.id.toUpperCase().replace(/-/g, '-')}-2026Q4`;

  return {
    memoId,
    preparedBy: 'Mohammed KM',
    date: market.snapshotDate,
    market,
    allStats,
    corridorScores,
    recommended,
    saturatedCorridor,
    verdict: {
      code: verdictCode,
      label: verdictLabel,
      tone: verdictTone,
      summary: verdictSummary,
    },
    tam: {
      activeUsers,
      annualOccasions,
      tamLocal,
      tamUsd: tamLocal * market.fxToUsd,
      samLocal,
      samUsd: samLocal * market.fxToUsd,
      somLocal,
      somUsd: somLocal * market.fxToUsd,
    },
    unitEconomics: ue,
    risks: market.risks,
    diligenceChecklist: market.diligenceChecklist,
  };
}

export function generateMemoMarkdown(memo) {
  const { market, allStats, corridorScores, recommended, verdict, tam, unitEconomics, risks, diligenceChecklist } = memo;
  const cur = (v, compact = false) => formatCurrency(v, market, compact);
  const usd = (v) => formatUsd(v, market.fxToUsd, true);

  const corridorRows = corridorScores
    .map(
      (c) =>
        `| ${c.corridor.label} | ${c.count} | ${c.avgDensity.toFixed(0)}/100 | ${c.avgRating.toFixed(2)} | ${cur(c.medianPrice)} | ${c.whiteSpaceScore}/100 | ${c.posture} |`
    )
    .join('\n');

  const riskRows = risks
    .map((r) => `| ${r.severity} | ${r.driver} | ${r.signal} | ${r.mitigant} |`)
    .join('\n');

  const checklistLines = diligenceChecklist.map((item, i) => `${i + 1}. ${item}`).join('\n');

  return `# Investment Committee Memorandum — ${market.title}

- **Memo ID:** ${memo.memoId}
- **Prepared By:** ${memo.preparedBy}
- **Region / Sector:** ${market.region} | ${market.sector}
- **Dataset Scope:** ${allStats.count} benchmarked competitors (${formatNumber(allStats.totalReviews)} total public reviews) | ${memo.date}
- **Recommended Entry Corridor:** ${recommended.corridor.label} (White-Space Score: ${recommended.whiteSpaceScore}/100)
- **IC Verdict:** **${verdict.label}**

---

## 1. Executive Thesis & Verdict Rationale

${verdict.summary}

Across the ${allStats.count} benchmarked operators, weighted average rating stands at **${allStats.weightedAvgRating.toFixed(2)} / 5.00** with a median ${market.priceUnitLabel.toLowerCase()} of **${cur(allStats.prices.median)}** (IQR: ${cur(allStats.prices.p25)} – ${cur(allStats.prices.p75)}). Review-volume concentration is elevated (Top-5 incumbent share: **${allStats.top5ReviewSharePct.toFixed(1)}%**, Gini: **${allStats.gini.toFixed(2)}**), penalizing late entrants in saturated corridors while creating outsized returns in underserved micro-markets.

### Micro-Market White-Space Ranking

| Corridor | Benchmarked Venues | Avg Density | Avg Rating | Median Price | White-Space Score | Entry Posture |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
${corridorRows}

---

## 2. TAM / SAM / SOM Proxy Model (Bottom-Up)

*Methodology:* ${market.tamModel.tamNote}

| Layer | Definition | Local Currency (Annual) | USD Equivalent (Annual) |
| --- | --- | ---: | ---: |
| **TAM** | ${formatCompact(tam.activeUsers)} active buyers x ${market.tamModel.annualVisitsPerUser} annual occasions @ ${cur(market.tamModel.avgTicketLocal)} | ${cur(tam.tamLocal, true)} | ${usd(tam.tamLocal)} |
| **SAM** | ${market.tamModel.samSharePct}% serviceable share across target corridors | ${cur(tam.samLocal, true)} | ${usd(tam.samLocal)} |
| **SOM (Yr 3)** | ${market.tamModel.somShareOfSamPct}% target capture in priority corridor | ${cur(tam.somLocal, true)} | ${usd(tam.somLocal)} |

---

## 3. Unit-Economics Benchmark (${unitEconomics.formatName})

| Metric | Benchmark Value | Notes |
| --- | ---: | --- |
| Target ${market.priceUnitLabel} | ${cur(unitEconomics.avgTicketLocal)} | Positioned at upper-mid corridor quartile |
| Monthly Revenue (Steady State) | ${cur(unitEconomics.monthlyRevenueLocal, true)} (${usd(unitEconomics.monthlyRevenueLocal)}) | ${unitEconomics.dailyCovers} daily units/covers |
| Gross Margin | ${unitEconomics.grossMarginPct.toFixed(1)}% | Direct COGS / variable servicing |
| Rent / Occupancy Cost | ${unitEconomics.rentToRevPct.toFixed(1)}% of rev | Disciplined corridor lease cap |
| Direct Labor | ${unitEconomics.laborToRevPct.toFixed(1)}% of rev | Lean standardized staffing |
| Other Site Opex | ${unitEconomics.otherOpexPct.toFixed(1)}% of rev | Utilities, marketing, tech, QA |
| **Site-Level EBITDA Margin** | **${unitEconomics.siteEbitdaMarginPct.toFixed(1)}%** | **${cur(unitEconomics.monthlyEbitdaLocal, true)} / month** |
| Initial Buildout Capex | ${cur(unitEconomics.buildoutCapexLocal, true)} (${usd(unitEconomics.buildoutCapexLocal)}) | Turnkey Cat-B + pre-opening |
| Implied Simple Payback | **${unitEconomics.paybackMonths.toFixed(1)} months** | Target unlevered IRR: **${unitEconomics.targetIrrPct.toFixed(1)}%** |

---

## 4. Key Entry Risks & Mitigants

| Severity | Risk Driver | Empirical Signal | Actionable Mitigant |
| --- | --- | --- | --- |
${riskRows}

---

## 5. Next-Step 90-Day Commercial Diligence Checklist

${checklistLines}

---
*Generated deterministically by Commercial Due-Diligence & Market Intelligence Engine (Mohammed KM). All figures represent public/synthetic benchmark data for analytical modeling.*
`;
}
