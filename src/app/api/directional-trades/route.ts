import { createTradeHandlers } from '@/lib/createTradeRoute';
import { getDirectionalTradesCollection } from '@/lib/collections';

export const { GET, POST, PATCH, DELETE } = createTradeHandlers(
  getDirectionalTradesCollection,
  'directional trade',
  ['ticker', 'type', 'strike', 'contracts', 'expiration', 'entryDate', 'premium'],
);
