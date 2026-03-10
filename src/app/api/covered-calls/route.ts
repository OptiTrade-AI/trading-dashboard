import { createTradeHandlers } from '@/lib/createTradeRoute';
import { getCoveredCallsCollection } from '@/lib/collections';

export const { GET, POST, PATCH, DELETE } = createTradeHandlers(getCoveredCallsCollection, 'covered call');
