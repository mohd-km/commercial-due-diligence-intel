import { classifyMoatTier, formatCurrency, formatNumber } from '../engine/analytics.js';

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function renderRegistryView(container, venues, market, sortState, searchQuery, selectedVenueId, callbacks) {
  const totalReviews = venues.reduce((s, v) => s + v.reviews, 0) || 1;
  const q = searchQuery.trim().toLowerCase();

  let filtered = venues;
  if (q) {
    filtered = venues.filter(
      (v) =>
        v.name.toLowerCase().includes(q) ||
        v.corridor.toLowerCase().includes(q) ||
        v.segment.toLowerCase().includes(q) ||
        v.positioning.toLowerCase().includes(q)
    );
  }

  const { key, dir } = sortState;
  const mul = dir === 'asc' ? 1 : -1;
  const sorted = [...filtered].sort((a, b) => {
    const va = a[key];
    const vb = b[key];
    if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * mul;
    return String(va).localeCompare(String(vb)) * mul;
  });

  const headers = [
    { key: 'name', label: 'Operator / Venue', align: 'left' },
    { key: 'corridor', label: 'Corridor', align: 'left' },
    { key: 'segment', label: 'Segment', align: 'left' },
    { key: 'price', label: market.priceUnitLabel, align: 'right' },
    { key: 'rating', label: 'Rating', align: 'right' },
    { key: 'reviews', label: 'Modelled Reviews', align: 'right' },
    { key: 'densityIndex', label: 'Density', align: 'right' },
    { key: 'utilizationPct', label: 'Util %', align: 'right' },
    { key: 'capacity', label: market.capacityLabel, align: 'right' },
  ];

  const rowsHtml = sorted
    .map((v) => {
      const sharePct = (v.reviews / totalReviews) * 100;
      const tier = classifyMoatTier(v.reviews, sharePct);
      const isSelected = v.id === selectedVenueId;
      const corridorObj = market.corridors.find((c) => c.id === v.corridor);
      const color = corridorObj ? corridorObj.color : '#94a3b8';

      return `
        <tr class="reg-row ${isSelected ? 'is-selected' : ''}" data-venue-id="${escapeHtml(v.id)}">
          <td class="reg-cell-primary" data-label="Operator">
            <div class="reg-name">${escapeHtml(v.name)}</div>
            <div class="reg-pos">${escapeHtml(v.positioning)}</div>
          </td>
          <td data-label="Corridor"><span class="corridor-pill"><span class="legend-swatch" style="background:${color}"></span>${escapeHtml(v.corridor)}</span></td>
          <td data-label="Segment" class="muted">${escapeHtml(v.segment)}</td>
          <td data-label="${escapeHtml(market.priceUnitLabel)}" class="num mono">${formatCurrency(v.price, market)}</td>
          <td data-label="Rating" class="num mono">${v.rating.toFixed(1)}</td>
          <td data-label="Modelled Reviews" class="num mono">
            <span>${formatNumber(v.reviews)}</span>
            <span class="moat-tier badge-${tier.toLowerCase()} inline-tier">${tier.toUpperCase()}</span>
          </td>
          <td data-label="Density" class="num mono">${v.densityIndex}/100</td>
          <td data-label="Util %" class="num mono">${v.utilizationPct}%</td>
          <td data-label="${escapeHtml(market.capacityLabel)}" class="num mono">${formatNumber(v.capacity)}</td>
        </tr>`;
    })
    .join('');

  container.innerHTML = `
    <div class="registry-toolbar">
      <div class="registry-count mono">Showing ${sorted.length} of ${venues.length} anonymized benchmark operators</div>
      <div class="registry-controls">
        <select id="registry-mobile-sort" class="select-control mobile-sort-select" aria-label="Sort operators">
          ${headers
            .map(
              (h) =>
                `<option value="${h.key}" ${sortState.key === h.key ? 'selected' : ''}>Sort: ${escapeHtml(h.label)}</option>`
            )
            .join('')}
        </select>
        <input
          type="search"
          id="registry-search"
          class="search-input"
          placeholder="Filter by operator, corridor, segment..."
          value="${escapeHtml(searchQuery)}"
        />
      </div>
    </div>
    <div class="table-scroll">
      <table class="registry-table">
        <thead>
          <tr>
            ${headers
              .map((h) => {
                const active = sortState.key === h.key;
                const arrow = active ? (sortState.dir === 'asc' ? ' [ASC]' : ' [DESC]') : '';
                return `<th class="${h.align === 'right' ? 'num' : ''} sortable ${active ? 'is-sorted' : ''}" data-sort-key="${h.key}">${escapeHtml(h.label)}<span class="sort-ind mono">${arrow}</span></th>`;
              })
              .join('')}
          </tr>
        </thead>
        <tbody>
          ${rowsHtml || '<tr><td colspan="9" class="empty-cell">No operators match your query.</td></tr>'}
        </tbody>
      </table>
    </div>
  `;

  const searchInput = container.querySelector('#registry-search');
  searchInput.addEventListener('input', (e) => callbacks.onSearch(e.target.value));
  if (document.activeElement?.id === 'registry-search') {
    searchInput.focus();
  }

  const mobileSort = container.querySelector('#registry-mobile-sort');
  mobileSort.addEventListener('change', (e) => callbacks.onSort(e.target.value));

  container.querySelectorAll('th.sortable').forEach((th) => {
    th.addEventListener('click', () => callbacks.onSort(th.getAttribute('data-sort-key')));
  });

  container.querySelectorAll('.reg-row').forEach((tr) => {
    tr.addEventListener('click', () => callbacks.onSelectVenue(tr.getAttribute('data-venue-id')));
  });
}
