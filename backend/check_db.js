const Database = require('better-sqlite3');
const db = new Database(
  '/home/khanhromvn/Documents/Coding/Elara/backend/database.sqlite',
);

try {
  console.log('--- Table Info ---');
  const info = db.pragma('table_info(models_performance)');
  console.log(info);

  console.log('\n--- Index List ---');
  const indexes = db.pragma('index_list(models_performance)');
  console.log(indexes);

  console.log('\n--- Index Info ---');
  for (const idx of indexes) {
    console.log(`Index: ${idx.name}`);
    console.log(db.pragma(`index_info(${idx.name})`));
  }
} catch (e) {
  console.error(e);
}
