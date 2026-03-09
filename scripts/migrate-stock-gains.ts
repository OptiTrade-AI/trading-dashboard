import { MongoClient } from 'mongodb';
import { v4 as uuidv4 } from 'uuid';
import { format } from 'date-fns';

const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB || 'csp-tracker';

if (!uri) {
  console.error('Set MONGODB_URI env var before running.');
  process.exit(1);
}

async function migrate() {
  if (!uri) return;

  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db(dbName);

  // Read the old value
  const settings = await db.collection('accountSettings').findOne({});
  const oldValue = settings?.realizedStockGains;

  if (oldValue === undefined || oldValue === null || oldValue === 0) {
    console.log('No realizedStockGains to migrate (value is', oldValue, ')');
    await client.close();
    return;
  }

  console.log(`Found realizedStockGains: $${oldValue}`);

  // Create a stock event for it
  const stockEvent = {
    id: uuidv4(),
    ticker: 'LEGACY',
    shares: 1,
    costBasis: oldValue > 0 ? 0 : Math.abs(oldValue),
    salePrice: oldValue > 0 ? oldValue : 0,
    saleDate: format(new Date(), 'yyyy-MM-dd'),
    realizedPL: oldValue,
    isTaxLossHarvest: false,
    notes: `Migrated from realizedStockGains setting ($${oldValue})`,
  };

  await db.collection('stockEvents').insertOne(stockEvent);
  console.log('Created stock event:', stockEvent.id);

  // Remove the field from settings
  await db.collection('accountSettings').updateOne({}, { $unset: { realizedStockGains: '' } });
  console.log('Removed realizedStockGains from account settings');

  await client.close();
  console.log('Migration complete!');
}

migrate().catch(console.error);
