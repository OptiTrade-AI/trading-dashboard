import { MongoClient } from 'mongodb';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB || 'csp-tracker';

if (!uri) {
  console.error('Set MONGODB_URI in .env.local (or export it) before running this script.');
  process.exit(1);
}

const DATA_DIR = join(process.cwd(), 'data');

const COLLECTIONS: { file: string; collection: string }[] = [
  { file: 'csp-trades.json', collection: 'cspTrades' },
  { file: 'covered-calls.json', collection: 'coveredCalls' },
  { file: 'directional-trades.json', collection: 'directionalTrades' },
  { file: 'spreads.json', collection: 'spreads' },
  { file: 'account-settings.json', collection: 'accountSettings' },
];

async function seed() {
  const client = new MongoClient(uri!);
  await client.connect();
  console.log('Connected to MongoDB Atlas');

  const db = client.db(dbName);

  for (const { file, collection } of COLLECTIONS) {
    const filePath = join(DATA_DIR, file);
    if (!existsSync(filePath)) {
      console.log(`  Skipping ${file} — file not found`);
      continue;
    }

    const raw = readFileSync(filePath, 'utf-8');
    const data = JSON.parse(raw);
    const col = db.collection(collection);

    await col.deleteMany({});

    if (collection === 'accountSettings') {
      // Settings is a single document, not an array
      if (data && typeof data === 'object' && !Array.isArray(data)) {
        await col.insertOne(data);
        console.log(`  ${collection}: inserted 1 settings document`);
      } else {
        console.log(`  ${collection}: skipped — unexpected format`);
      }
    } else {
      if (Array.isArray(data) && data.length > 0) {
        await col.insertMany(data);
        console.log(`  ${collection}: inserted ${data.length} documents`);
      } else {
        console.log(`  ${collection}: 0 documents (empty array)`);
      }
    }
  }

  await client.close();
  console.log('Done — seed complete.');
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
