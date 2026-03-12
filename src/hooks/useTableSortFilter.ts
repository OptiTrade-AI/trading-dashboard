import { useState, useMemo, useCallback } from 'react';

type SortDirection = 'asc' | 'desc';

interface TableSortFilterOptions<T, K extends string> {
  /** Items to filter and sort */
  items: T[];
  /** Default sort key */
  defaultSortKey: K;
  /** Default sort direction */
  defaultSortDirection?: SortDirection;
  /** Default filter status */
  defaultFilterStatus?: string;
  /** Get the status field from an item */
  getStatus: (item: T) => string;
  /** Get the ticker field from an item */
  getTicker: (item: T) => string;
  /** Get the entry date field from an item */
  getEntryDate: (item: T) => string;
  /** Map of computed sort keys to value extractors */
  computedSortValues?: Partial<Record<K, (item: T) => number | string>>;
  /** Custom status filter logic (for CC's "closed" including "called") */
  statusFilter?: (item: T, status: string) => boolean;
}

export function useTableSortFilter<T, K extends string>({
  items,
  defaultSortKey,
  defaultSortDirection = 'desc',
  defaultFilterStatus = 'open',
  getStatus,
  getTicker,
  getEntryDate,
  computedSortValues = {},
  statusFilter,
}: TableSortFilterOptions<T, K>) {
  const [sortKey, setSortKey] = useState<K>(defaultSortKey);
  const [sortDirection, setSortDirection] = useState<SortDirection>(defaultSortDirection);
  const [filterStatus, setFilterStatus] = useState(defaultFilterStatus);
  const [filterTicker, setFilterTicker] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const handleSort = useCallback((key: K) => {
    setSortKey(prev => {
      if (prev === key) {
        setSortDirection(d => d === 'asc' ? 'desc' : 'asc');
        return prev;
      }
      setSortDirection('desc');
      return key;
    });
  }, []);

  const clearFilters = useCallback(() => {
    setFilterStatus(defaultFilterStatus);
    setFilterTicker('');
    setFilterType('all');
    setDateFrom('');
    setDateTo('');
  }, [defaultFilterStatus]);

  const uniqueTickers = useMemo(
    () => Array.from(new Set(items.map(getTicker))),
    [items, getTicker]
  );

  const filteredAndSorted = useMemo(() => {
    let result = [...items];

    // Status filter
    if (filterStatus !== 'all') {
      if (statusFilter) {
        result = result.filter(item => statusFilter(item, filterStatus));
      } else {
        result = result.filter(item => getStatus(item) === filterStatus);
      }
    }

    // Ticker filter
    if (filterTicker) {
      result = result.filter(item =>
        getTicker(item).toLowerCase().includes(filterTicker.toLowerCase())
      );
    }

    // Date range filter
    if (dateFrom) {
      result = result.filter(item => getEntryDate(item) >= dateFrom);
    }
    if (dateTo) {
      result = result.filter(item => getEntryDate(item) <= dateTo);
    }

    // Sort
    result.sort((a, b) => {
      let aVal: number | string;
      let bVal: number | string;

      const computedFn = computedSortValues[sortKey];
      if (computedFn) {
        aVal = computedFn(a);
        bVal = computedFn(b);
      } else {
        aVal = (a as Record<string, unknown>)[sortKey] as string ?? '';
        bVal = (b as Record<string, unknown>)[sortKey] as string ?? '';
      }

      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortDirection === 'asc'
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal);
      }

      return sortDirection === 'asc'
        ? (aVal as number) - (bVal as number)
        : (bVal as number) - (aVal as number);
    });

    return result;
  }, [items, filterStatus, filterTicker, dateFrom, dateTo, sortKey, sortDirection, getStatus, getTicker, getEntryDate, computedSortValues, statusFilter]);

  const hasActiveFilters = filterStatus !== defaultFilterStatus || filterTicker !== '' || dateFrom !== '' || dateTo !== '' || filterType !== 'all';

  return {
    // Sort state
    sortKey,
    sortDirection,
    handleSort,
    // Filter state
    filterStatus,
    setFilterStatus,
    filterTicker,
    setFilterTicker,
    filterType,
    setFilterType,
    dateFrom,
    setDateFrom,
    dateTo,
    setDateTo,
    // Computed
    filteredAndSorted,
    uniqueTickers,
    hasActiveFilters,
    clearFilters,
  };
}
