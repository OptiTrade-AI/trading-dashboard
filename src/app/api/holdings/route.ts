import { createTradeHandlers } from '@/lib/createTradeRoute';
import { getHoldingsCollection } from '@/lib/collections';

export const { GET, POST, PATCH, DELETE } = createTradeHandlers(getHoldingsCollection, 'holding');
