import { createTradeHandlers } from '@/lib/createTradeRoute';
import { getAnnotationsCollection } from '@/lib/collections';

export const { GET, POST, PATCH, DELETE } = createTradeHandlers(
  getAnnotationsCollection,
  'annotation',
  ['date', 'label'],
);
