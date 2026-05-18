// db.js – SQLite3 (sql.js) pour le microservice Transaction
const initSqlJs = require('sql.js');
const path = require('path');
const fs = require('fs');

const DB_FILE = path.join(__dirname, 'transactions.db');
let db = null;

async function initDb() {
  const SQL = await initSqlJs();
  if (fs.existsSync(DB_FILE)) {
    db = new SQL.Database(fs.readFileSync(DB_FILE));
  } else {
    db = new SQL.Database();
  }
  db.run(`
    CREATE TABLE IF NOT EXISTS transactions (
      id           TEXT PRIMARY KEY,
      compteSource TEXT NOT NULL,
      compteDest   TEXT,
      montant      REAL NOT NULL,
      type         TEXT NOT NULL,
      statut       TEXT NOT NULL DEFAULT 'en_attente',
      description  TEXT,
      createdAt    TEXT NOT NULL
    )
  `);
  saveDb();
  console.log('[Transaction-DB] SQLite3 (sql.js) initialisée');
}

function saveDb() {
  if (!db) return;
  fs.writeFileSync(DB_FILE, Buffer.from(db.export()));
}

function rowToObj(stmt) {
  const rows = [];
  while (stmt.step()) {
    const cols = stmt.getColumnNames();
    const vals = stmt.get();
    const obj = {};
    cols.forEach((c, i) => { obj[c] = vals[i]; });
    rows.push(obj);
  }
  stmt.free();
  return rows;
}

function createTransaction(id, compteSource, compteDest, montant, type, description, createdAt) {
  db.run(
    `INSERT INTO transactions (id,compteSource,compteDest,montant,type,statut,description,createdAt)
     VALUES (?,?,?,?,?,'en_attente',?,?)`,
    [id, compteSource, compteDest || '', montant, type, description || '', createdAt]
  );
  saveDb();
  return getTransactionById(id);
}

function updateStatut(id, statut) {
  db.run('UPDATE transactions SET statut = ? WHERE id = ?', [statut, id]);
  saveDb();
  return getTransactionById(id);
}

function getTransactionById(id) {
  const stmt = db.prepare('SELECT * FROM transactions WHERE id = ?');
  stmt.bind([id]);
  return rowToObj(stmt)[0] || null;
}

function getTransactionsByCompte(compteId) {
  const stmt = db.prepare(
    `SELECT * FROM transactions WHERE compteSource = ? OR compteDest = ? ORDER BY createdAt DESC`
  );
  stmt.bind([compteId, compteId]);
  return rowToObj(stmt);
}

function getAllTransactions() {
  return rowToObj(db.prepare('SELECT * FROM transactions ORDER BY createdAt DESC'));
}

module.exports = { initDb, createTransaction, updateStatut, getTransactionById, getTransactionsByCompte, getAllTransactions };
