# Commercial Due-Diligence & Market Intelligence Engine

An institutional-grade, client-side commercial due-diligence and market-entry analytics application by **Mohammed KM**. Designed with a private-equity and strategy-consulting editorial aesthetic (deep slate `#0b0e14`, crisp ivory typography, emerald/amber/slate charts, tabular monospace numbers, and zero emojis).

## Overview

All analytics, statistical summaries, white-space scores, and 1-page Investment Committee (IC) memoranda are computed deterministically in the browser from pre-computed public/synthetic benchmark datasets (0 runtime API calls, 0 runtime tokens).

### Included Market-Entry Datasets (103 Benchmarked Competitors Total)

1. **Bengaluru Specialty Coffee & Third-Wave Cafes** (36 benchmarked venues)
   - Corridors: Indiranagar, Koramangala, Hebbal / Manyata
   - Benchmarks: INR basket pricing, rating, review volume, 1km competitive density index, seating capacity, and utilization.
2. **Dubai Boutique Hospitality & Short-Stay Operators** (34 benchmarked operators)
   - Corridors: Downtown Dubai, Dubai Marina, DIFC
   - Benchmarks: AED Average Daily Rate (ADR), rating, review volume, competitive density, key count, and occupancy utilization.
3. **London Flexible Coworking & Executive Desks** (33 benchmarked operators)
   - Corridors: Shoreditch, Canary Wharf, Soho
   - Benchmarks: GBP monthly desk rate, rating, review volume, competitive density, desk capacity, and utilization.

### Interactive Modules

- **Market Analytics View**
  - **Competitive Density vs. Average Rating Scatter Plot (SVG):** Bubble area scaled by review volume, quadrant reference thresholds, interactive hover tooltips, and click-to-inspect operator detail bar.
  - **Pricing Dispersion Histogram (SVG):** Stacked by micro-market corridor with P25, Median (P50), and P75 vertical marker lines plus IQR and coefficient of variation (CV) readouts.
  - **Review-Volume Moat Leaderboard:** Ranked top-10 incumbents with share of visible reviews and moat tier classification (`FORTRESS`, `ESTABLISHED`, `CHALLENGER`).
  - **Underserved White-Space Score by Micro-Market:** Deterministic 5-factor composite index (`0.28 Demand + 0.34 Supply Gap + 0.14 Quality Gap + 0.16 Moat Openness + 0.08 Price Headroom`).
- **Auto-Generated 1-Page PE Investment Memo View**
  - Synthesizes bottom-up TAM/SAM/SOM proxy model, unit-economics benchmark table, risk register with empirical signals and mitigants, 90-day diligence checklist, and Go / Selective Go / Conditional IC verdict.
  - One-click **Export Markdown (.md)** and **Copy Markdown** actions.
- **Competitor Registry**
  - Full sortable and searchable tabular view of all benchmarked operators.

## Local Development & Build

```bash
npm install
npm run dev      # Start local Vite dev server
npm run build    # Build production bundle into dist/index.html
npm run preview  # Preview production build
```

## Privacy & Data Notice

All datasets in `src/data/` consist exclusively of 100% public and synthetic benchmark figures assembled for analytical demonstration. No private financials or proprietary internal records are included.
