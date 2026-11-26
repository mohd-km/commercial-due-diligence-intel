// Deterministic Commercial Due-Diligence Analytics, Store Pro-Forma & PE Memo Engine
// 100% client-side computation, zero runtime API calls, zero emojis.

// Editorial restrained corridor palette mapped onto light paper surfaces
const EDITORIAL_COLOR_MAP = {
  '#10b981': '#1b5e43', // deep forest green (priority / domain accent)
  '#f59e0b': '#b45309', // muted ochre / burnt amber
  '#64748b': '#475569', // editorial slate
};

export function getEditorialCorridorColor(rawColor) {
  return EDITORIAL_COLOR_MAP[rawColor] || rawColor || '#475569';
}

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
  const sign = val < 0 ? '-' : '';
  const abs = Math.abs(val);
  if (abs >= 1e9) return `${sign}${(abs / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${sign}${(abs / 1e6).toFixed(2)}M`;
  if (abs >= 1e3) return `${sign}${(abs / 1e3).toFixed(1)}K`;
  return `${sign}${formatNumber(abs, 0)}`;
}

export function formatCurrency(val, market, compact = false) {
  if (!Number.isFinite(val)) return `${market.currency} 0`;
  const sign = val < 0 ? '-' : '';
  const abs = Math.abs(val);
  const numStr = compact ? formatCompact(abs) : formatNumber(Math.round(abs), 0);
  return `${sign}${market.currency} ${numStr}`;
}

export function formatUsd(localVal, fxToUsd, compact = true) {
  const usd = localVal * fxToUsd;
  const sign = usd < 0 ? '-' : '';
  const abs = Math.abs(usd);
  return compact ? `${sign}USD ${formatCompact(abs)}` : `${sign}USD ${formatNumber(abs, 0)}`;
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
    const moatOpennessScore = Math.max(10, Math.min(95, Math.round(100 - Math.min(92, avgReviews / 32))));
    const priceHeadroomScore = Math.max(
      24,
      Math.min(94, Math.round(58 + (stats.prices.median / marketMedianPrice - 0.9) * 75))
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

// =========================================================================
// INTERACTIVE STORE PRO-FORMA ENGINE (100% deterministic, client-side)
// =========================================================================

const PRO_FORMA_SPEC = {
  'bengaluru-coffee': {
    areaSqft: 1100,
    rentIsAnnual: false,
    revenueMultiplier: 30, // days/month
    maxUnits: 212, // max daily covers at 100% utilization
    baseUtilPct: 78,
    unitLabel: 'covers / day',
    unitShort: 'covers/day',
    rentRange: { min: 90, max: 340, step: 5 },
    ticketRange: { min: 260, max: 680, step: 10 },
  },
  'dubai-hospitality': {
    areaSqft: 27000,
    rentIsAnnual: true,
    revenueMultiplier: 30, // nights/month
    maxUnits: 45, // total keys
    baseUtilPct: 80,
    unitLabel: 'keys / night',
    unitShort: 'keys/night',
    rentRange: { min: 100, max: 280, step: 5 },
    ticketRange: { min: 650, max: 1950, step: 20 },
  },
  'london-coworking': {
    areaSqft: 22000,
    rentIsAnnual: true,
    revenueMultiplier: 1, // monthly desk rate
    maxUnits: 360, // total desks
    baseUtilPct: 85,
    unitLabel: 'occupied desks',
    unitShort: 'desks',
    rentRange: { min: 35, max: 140, step: 2 },
    ticketRange: { min: 450, max: 1200, step: 15 },
  },
};

export function getProFormaSpec(market) {
  return PRO_FORMA_SPEC[market.id] || PRO_FORMA_SPEC['bengaluru-coffee'];
}

export function getProFormaDefaults(market, corridorId = null) {
  const spec = getProFormaSpec(market);
  const corridorScores = computeCorridorWhiteSpace(market);
  const targetRow = corridorId
    ? corridorScores.find((c) => c.corridor.id === corridorId) || corridorScores[0]
    : corridorScores[0];

  return {
    corridorId: targetRow.corridor.id,
    rentPerSqft: targetRow.corridor.primeRentPerSqft,
    avgTicket: market.unitEconomics.avgTicketLocal,
    utilizationPct: spec.baseUtilPct,
    landlordCapexPct: 0,
  };
}

function computeFiveYearIrr(capex, annualEbitda) {
  if (capex <= 0) return annualEbitda > 0 ? 120 : 0;
  if (annualEbitda <= 0) return -100;
  // Solve NPV(r) = -capex + sum_{t=1..5} annualEbitda / (1 + r)^t = 0 via bisection
  let lo = -0.65;
  let hi = 2.5;
  const npv = (r) => {
    let val = -capex;
    for (let t = 1; t <= 5; t += 1) {
      val += annualEbitda / (1 + r) ** t;
    }
    return val;
  };
  if (npv(hi) > 0) return hi * 100;
  if (npv(lo) < 0) return -65;
  for (let i = 0; i < 40; i += 1) {
    const mid = (lo + hi) / 2;
    if (npv(mid) > 0) lo = mid;
    else hi = mid;
  }
  return ((lo + hi) / 2) * 100;
}

export function computeStoreProForma(market, params) {
  const spec = getProFormaSpec(market);
  const ue = market.unitEconomics;
  const corridorScores = computeCorridorWhiteSpace(market);
  const corridorRow =
    corridorScores.find((c) => c.corridor.id === params.corridorId) || corridorScores[0];

  const rentPerSqft = Number(params.rentPerSqft);
  const avgTicket = Number(params.avgTicket);
  const utilizationPct = Number(params.utilizationPct);
  const landlordCapexPct = Number(params.landlordCapexPct || 0);

  const activeUnits = Math.round((spec.maxUnits * utilizationPct) / 100);
  const monthlyRevenue = activeUnits * avgTicket * spec.revenueMultiplier;

  const grossMarginFrac = ue.grossMarginPct / 100;
  const monthlyCogs = monthlyRevenue * (1 - grossMarginFrac);
  const monthlyGrossProfit = monthlyRevenue - monthlyCogs;

  const monthlyRent = spec.rentIsAnnual
    ? (rentPerSqft * spec.areaSqft) / 12
    : rentPerSqft * spec.areaSqft;

  // Fixed store staffing and baseline site overhead anchored to format size
  const monthlyLabor = ue.monthlyRevenueLocal * (ue.laborToRevPct / 100);
  const monthlyOtherOpex = ue.monthlyRevenueLocal * (ue.otherOpexPct / 100);
  const totalFixedCosts = monthlyRent + monthlyLabor + monthlyOtherOpex;

  const monthlyEbitda = monthlyGrossProfit - totalFixedCosts;
  const annualEbitda = monthlyEbitda * 12;

  const siteEbitdaMarginPct = monthlyRevenue > 0 ? (monthlyEbitda / monthlyRevenue) * 100 : 0;
  const rentToRevPct = monthlyRevenue > 0 ? (monthlyRent / monthlyRevenue) * 100 : 0;
  const laborToRevPct = monthlyRevenue > 0 ? (monthlyLabor / monthlyRevenue) * 100 : 0;
  const otherOpexPct = monthlyRevenue > 0 ? (monthlyOtherOpex / monthlyRevenue) * 100 : 0;

  const contributionPerUnit = avgTicket * spec.revenueMultiplier * grossMarginFrac;
  const breakEvenUnits =
    contributionPerUnit > 0 ? totalFixedCosts / contributionPerUnit : Infinity;
  const breakEvenUtilPct =
    Number.isFinite(breakEvenUnits) ? (breakEvenUnits / spec.maxUnits) * 100 : Infinity;
  const marginOfSafetyPct =
    activeUnits > 0 && Number.isFinite(breakEvenUnits)
      ? ((activeUnits - breakEvenUnits) / activeUnits) * 100
      : -100;

  const effectiveCapex = ue.buildoutCapexLocal * (1 - landlordCapexPct / 100);
  const paybackMonths = monthlyEbitda > 0 ? effectiveCapex / monthlyEbitda : Infinity;
  const impliedIrrPct = computeFiveYearIrr(effectiveCapex, annualEbitda);

  // 36-month cumulative cashflow curve (3-month ramp: 55%, 75%, 90%, then 100% steady state)
  const rampFactors = [0.55, 0.75, 0.9];
  const cashflowSeries = [{ month: 0, cumulative: -effectiveCapex, monthly: -effectiveCapex }];
  let cum = -effectiveCapex;
  let rampedPaybackMonth = null;
  for (let m = 1; m <= 36; m += 1) {
    const factor = m <= 3 ? rampFactors[m - 1] : 1;
    const revM = monthlyRevenue * factor;
    const gpM = revM * grossMarginFrac;
    const ebitdaM = gpM - totalFixedCosts;
    const prevCum = cum;
    cum += ebitdaM;
    if (rampedPaybackMonth === null && prevCum < 0 && cum >= 0) {
      const frac = ebitdaM > 0 ? Math.abs(prevCum) / ebitdaM : 0;
      rampedPaybackMonth = m - 1 + frac;
    }
    cashflowSeries.push({ month: m, cumulative: cum, monthly: ebitdaM });
  }

  // Dynamic verdict combining corridor white-space score & store unit economics
  const ws = corridorRow.whiteSpaceScore;
  let verdictCode = 'CONDITIONAL';
  let verdictLabel = 'CONDITIONAL / WATCH — CAPEX-GATED';
  let verdictTone = 'amber';
  let verdictSummary = '';

  if (monthlyEbitda <= 0 || siteEbitdaMarginPct < 10) {
    verdictCode = 'PASS';
    verdictLabel = 'PASS — NEGATIVE / SUB-HURDLE ECONOMICS';
    verdictTone = 'crimson';
    verdictSummary = `In ${corridorRow.corridor.label} at ${formatCurrency(avgTicket, market)} and ${utilizationPct}% utilization, site EBITDA margin compresses to ${siteEbitdaMarginPct.toFixed(1)}% (rent-to-revenue ${rentToRevPct.toFixed(1)}%), failing IC return hurdles.`;
  } else if (ws >= 68 && paybackMonths <= 20 && siteEbitdaMarginPct >= 20) {
    verdictCode = 'GO';
    verdictLabel = 'GO — TARGETED CORRIDOR ENTRY';
    verdictTone = 'emerald';
    verdictSummary = `${corridorRow.corridor.label} (White-Space ${ws}/100) supports ${paybackMonths.toFixed(1)}-month simple payback and ${siteEbitdaMarginPct.toFixed(1)}% site EBITDA margin with break-even at ${Math.ceil(breakEvenUnits)} ${spec.unitShort} (${breakEvenUtilPct.toFixed(0)}% util).`;
  } else if (ws >= 52 && paybackMonths <= 30 && siteEbitdaMarginPct >= 14) {
    verdictCode = 'SELECTIVE GO';
    verdictLabel = 'SELECTIVE GO — STRUCTURED LEASE';
    verdictTone = 'emerald';
    verdictSummary = `${corridorRow.corridor.label} (White-Space ${ws}/100) delivers ${paybackMonths.toFixed(1)}-month payback and ${impliedIrrPct.toFixed(1)}% 5-yr unlevered IRR at ${utilizationPct}% utilization; execute with lease-cap or revenue-share protection.`;
  } else {
    verdictCode = 'CONDITIONAL';
    verdictLabel = 'CONDITIONAL / WATCH — CAPEX-GATED';
    verdictTone = 'amber';
    verdictSummary = `In ${corridorRow.corridor.label} (White-Space ${ws}/100), ${paybackMonths.toFixed(1)}-month payback and ${siteEbitdaMarginPct.toFixed(1)}% EBITDA margin require higher utilization, lower rent, or landlord Cat-B capex funding before capital release.`;
  }

  // Implied hypothetical outlet coordinates for overlay on visual map
  const hypotheticalOutlet = {
    name: `Hypothetical Outlet (${corridorRow.corridor.label})`,
    corridor: corridorRow.corridor.id,
    densityIndex: Math.round(corridorRow.avgDensity),
    rating: Number(Math.min(4.85, Math.max(4.4, corridorRow.avgRating + 0.25)).toFixed(2)),
    price: avgTicket,
    utilizationPct,
    reviews: 0,
  };

  return {
    spec,
    params: {
      corridorId: corridorRow.corridor.id,
      rentPerSqft,
      avgTicket,
      utilizationPct,
      landlordCapexPct,
    },
    corridorRow,
    activeUnits,
    monthlyRevenue,
    monthlyCogs,
    monthlyGrossProfit,
    monthlyRent,
    monthlyLabor,
    monthlyOtherOpex,
    totalFixedCosts,
    monthlyEbitda,
    annualEbitda,
    grossMarginPct: ue.grossMarginPct,
    rentToRevPct,
    laborToRevPct,
    otherOpexPct,
    siteEbitdaMarginPct,
    breakEvenUnits,
    breakEvenUtilPct,
    marginOfSafetyPct,
    baseCapex: ue.buildoutCapexLocal,
    effectiveCapex,
    paybackMonths,
    rampedPaybackMonth,
    impliedIrrPct,
    cashflowSeries,
    verdict: {
      code: verdictCode,
      label: verdictLabel,
      tone: verdictTone,
      summary: verdictSummary,
    },
    hypotheticalOutlet,
  };
}

export function computeInvestmentMemo(market, activeCorridor = 'ALL', proForma = null) {
  const allStats = computeSummaryStats(market.venues);
  const corridorScores = computeCorridorWhiteSpace(market);
  const recommended = proForma
    ? proForma.corridorRow
    : activeCorridor === 'ALL'
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

  const pf = proForma || computeStoreProForma(market, getProFormaDefaults(market, recommended.corridor.id));

  const unitEconomics = {
    formatName: market.unitEconomics.formatName,
    avgTicketLocal: pf.params.avgTicket,
    dailyCovers: pf.activeUnits,
    unitShort: pf.spec.unitShort,
    utilizationPct: pf.params.utilizationPct,
    rentPerSqft: pf.params.rentPerSqft,
    rentUnit: pf.corridorRow.corridor.rentUnit,
    monthlyRevenueLocal: pf.monthlyRevenue,
    grossMarginPct: pf.grossMarginPct,
    rentToRevPct: pf.rentToRevPct,
    laborToRevPct: pf.laborToRevPct,
    otherOpexPct: pf.otherOpexPct,
    siteEbitdaMarginPct: pf.siteEbitdaMarginPct,
    monthlyEbitdaLocal: pf.monthlyEbitda,
    buildoutCapexLocal: pf.effectiveCapex,
    landlordCapexPct: pf.params.landlordCapexPct,
    paybackMonths: pf.paybackMonths,
    breakEvenUnits: pf.breakEvenUnits,
    breakEvenUtilPct: pf.breakEvenUtilPct,
    targetIrrPct: pf.impliedIrrPct,
  };

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
    verdict: pf.verdict,
    proForma: pf,
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
    unitEconomics,
    risks: market.risks,
    diligenceChecklist: market.diligenceChecklist,
  };
}

export function generateMemoMarkdown(memo) {
  const { market, allStats, corridorScores, recommended, verdict, tam, unitEconomics, risks, diligenceChecklist } = memo;
  const cur = (v, compact = false) => formatCurrency(v, market, compact);
  const usd = (v) => formatUsd(v, market.fxToUsd, true);
  const paybackStr = Number.isFinite(unitEconomics.paybackMonths)
    ? `${unitEconomics.paybackMonths.toFixed(1)} months`
    : 'N/A (EBITDA <= 0)';
  const beStr = Number.isFinite(unitEconomics.breakEvenUnits)
    ? `${Math.ceil(unitEconomics.breakEvenUnits)} ${unitEconomics.unitShort} (${unitEconomics.breakEvenUtilPct.toFixed(0)}% util)`
    : 'N/A';

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
- **Dataset Scope:** ${allStats.count} anonymized benchmark operators (${formatNumber(allStats.totalReviews)} total modelled reviews) | ${memo.date}
- **Target Entry Corridor:** ${recommended.corridor.label} (White-Space Score: ${recommended.whiteSpaceScore}/100)
- **IC Verdict:** **${verdict.label}**

---

## 1. Executive Thesis & Verdict Rationale

${verdict.summary}

Across ${allStats.count} anonymized benchmark operators, weighted average rating stands at **${allStats.weightedAvgRating.toFixed(2)} / 5.00** with a median ${market.priceUnitLabel.toLowerCase()} of **${cur(allStats.prices.median)}** (IQR: ${cur(allStats.prices.p25)} – ${cur(allStats.prices.p75)}). Top-5 incumbent review share is **${allStats.top5ReviewSharePct.toFixed(1)}%** (Gini: **${allStats.gini.toFixed(2)}**).

### Micro-Market White-Space Ranking

| Corridor | Venues | Avg Density | Avg Rating | Median Price | White-Space Score | Entry Posture |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
${corridorRows}

---

## 2. TAM / SAM / SOM Proxy Model (Bottom-Up)

*Methodology:* ${market.tamModel.tamNote}

| Layer | Definition | Local Currency (Annual) | USD Equivalent (Annual) |
| --- | --- | ---: | ---: |
| **TAM** | ${formatCompact(tam.activeUsers)} active buyers x ${market.tamModel.annualVisitsPerUser} annual occasions @ ${cur(market.tamModel.avgTicketLocal)} | ${cur(tam.tamLocal, true)} | ${usd(tam.tamLocal)} |
| **SAM** | ${market.tamModel.samSharePct}% serviceable share across target corridors | ${cur(tam.samLocal, true)} | ${usd(tam.samLocal)} |
| **SOM (Yr 3)** | ${market.tamModel.somShareOfSamPct}% target capture in ${recommended.corridor.label} | ${cur(tam.somLocal, true)} | ${usd(tam.somLocal)} |

---

## 3. Store Pro-Forma Unit Economics (${unitEconomics.formatName})

| Metric | Pro-Forma Value | Notes |
| --- | ---: | --- |
| Target ${market.priceUnitLabel} | ${cur(unitEconomics.avgTicketLocal)} | ${unitEconomics.dailyCovers} ${unitEconomics.unitShort} (${unitEconomics.utilizationPct}% util) |
| Corridor Prime Rent | ${formatNumber(unitEconomics.rentPerSqft)} ${unitEconomics.rentUnit} | ${unitEconomics.rentToRevPct.toFixed(1)}% of monthly revenue |
| Monthly Revenue (Steady State) | ${cur(unitEconomics.monthlyRevenueLocal, true)} (${usd(unitEconomics.monthlyRevenueLocal)}) | Client-side interactive pro-forma |
| Gross Margin | ${unitEconomics.grossMarginPct.toFixed(1)}% | Direct COGS / variable servicing |
| Direct Labor & Other Opex | ${(unitEconomics.laborToRevPct + unitEconomics.otherOpexPct).toFixed(1)}% of rev | ${unitEconomics.laborToRevPct.toFixed(1)}% labor + ${unitEconomics.otherOpexPct.toFixed(1)}% site opex |
| **Site-Level EBITDA** | **${cur(unitEconomics.monthlyEbitdaLocal, true)} / mo** | **${unitEconomics.siteEbitdaMarginPct.toFixed(1)}% margin** |
| **Break-Even Volume** | **${beStr}** | Covers fixed rent + staffing + site opex |
| Net Buildout Capex | ${cur(unitEconomics.buildoutCapexLocal, true)} (${usd(unitEconomics.buildoutCapexLocal)}) | ${unitEconomics.landlordCapexPct}% landlord Cat-B funding |
| **Implied Simple Payback** | **${paybackStr}** | 5-Yr Unlevered IRR: **${unitEconomics.targetIrrPct.toFixed(1)}%** |

---

## 4. Key Entry Risks & Mitigants

| Severity | Risk Driver | Empirical Signal | Actionable Mitigant |
| --- | --- | --- | --- |
${riskRows}

---

## 5. Next-Step 90-Day Commercial Diligence Checklist

${checklistLines}

---
*Generated by Commercial Due-Diligence & Market Intelligence Engine (Mohammed KM). All operator identities are anonymized and figures represent synthetic/modelled benchmarks for due-diligence illustration.*
`;
}
