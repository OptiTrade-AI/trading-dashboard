import { createTradeHandlers } from '@/lib/createTradeRoute';
import { getSpreadsCollection } from '@/lib/collections';

export const { GET, POST, PATCH, DELETE } = createTradeHandlers(getSpreadsCollection, 'spread');
