import { createTradeHandlers } from '@/lib/createTradeRoute';
import { getCspTradesCollection } from '@/lib/collections';

export const { GET, POST, PATCH, DELETE } = createTradeHandlers(getCspTradesCollection, 'trade');
