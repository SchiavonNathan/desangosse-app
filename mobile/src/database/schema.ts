import * as SQLite from 'expo-sqlite';

export async function initDatabase() {
  const db = await SQLite.openDatabaseAsync('pdfs.db');
  
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS local_pdfs (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      hash TEXT NOT NULL,
      url TEXT NOT NULL,
      localUri TEXT,
      category TEXT,
      subcategoryId TEXT,
      subcategoryName TEXT
    );
  `);

  // Safe migrations — ignore errors if column already exists
  const alterCols = [
    'ALTER TABLE local_pdfs ADD COLUMN category TEXT;',
    'ALTER TABLE local_pdfs ADD COLUMN subcategoryId TEXT;',
    'ALTER TABLE local_pdfs ADD COLUMN subcategoryName TEXT;',
  ];
  for (const sql of alterCols) {
    try { await db.execAsync(sql); } catch (_) { /* column exists */ }
  }
}

export async function getLocalPdfs() {
  const db = await SQLite.openDatabaseAsync('pdfs.db');
  return await db.getAllAsync('SELECT * FROM local_pdfs ORDER BY name ASC');
}

export async function insertOrUpdatePdf(pdf: { id: string, name: string, hash: string, url: string, localUri: string, category: string, subcategoryId?: string | null, subcategoryName?: string | null }) {
  const db = await SQLite.openDatabaseAsync('pdfs.db');
  await db.runAsync(
    `INSERT INTO local_pdfs (id, name, hash, url, localUri, category, subcategoryId, subcategoryName) 
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET 
       name=excluded.name, 
       hash=excluded.hash, 
       url=excluded.url, 
       localUri=excluded.localUri,
       category=excluded.category,
       subcategoryId=excluded.subcategoryId,
       subcategoryName=excluded.subcategoryName`,
    pdf.id ?? null, pdf.name ?? null, pdf.hash ?? null, pdf.url ?? null, pdf.localUri ?? null, pdf.category ?? null, pdf.subcategoryId ?? null, pdf.subcategoryName ?? null
  );
}

export async function deletePdf(id: string) {
  const db = await SQLite.openDatabaseAsync('pdfs.db');
  await db.runAsync('DELETE FROM local_pdfs WHERE id = ?', id ?? null);
}
