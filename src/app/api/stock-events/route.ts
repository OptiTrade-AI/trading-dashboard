import { createTradeHandlers } from '@/lib/createTradeRoute';
import { getStockEventsCollection } from '@/lib/collections';

export const { GET, POST, PATCH, DELETE } = createTradeHandlers(
  getStockEventsCollection,
  'stock event',
  ['ticker', 'shares', 'salePrice', 'costBasis', 'saleDate'],
);
