// db.js – SQLite3 (via sql.js / WebAssembly) pour le microservice Compte
// sql.js = SQLite3 compilé en WebAssembly → pas besoin de compilation native
const initSqlJs = require('sql.js');
const path = require('path');
const fs = require('fs');

const DB_FILE = path.join(__dirname, 'comptes.db');
let db = null;

async function initDb() {
  const SQL = await initSqlJs();
  if (fs.existsSync(DB_FILE)) {
    db = new SQL.Database(fs.readFileSync(DB_FILE));
  } else {
    db = new SQL.Database();
  }
  db.run(`
    CREATE TABLE IF NOT EXISTS comptes (
      id           TEXT PRIMARY KEY,
      proprietaire TEXT NOT NULL,
      email        TEXT NOT NULL,
      solde        REAL NOT NULL DEFAULT 0,
      type         TEXT NOT NULL DEFAULT 'courant',
      statut       TEXT NOT NULL DEFAULT 'actif',
      createdAt    TEXT NOT NULL
    )
  `);
  saveDb();
  console.log('[Compte-DB] SQLite3 (sql.js) initialisée');
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

// ── CRUD ─────────────────────────────────────────────────────
function createCompte(id, proprietaire, email, solde, type, createdAt) {
  db.run(
    `INSERT INTO comptes (id,proprietaire,email,solde,type,statut,createdAt)
     VALUES (?,?,?,?,'${type}','actif',?)`,
    [id, proprietaire, email, solde, createdAt]
  );
  saveDb();
  return getCompteById(id);
}

function getCompteById(id) {
  const stmt = db.prepare('SELECT * FROM comptes WHERE id = ?');
  stmt.bind([id]);
  return rowToObj(stmt)[0] || null;
}

function getAllComptes() {
  return rowToObj(db.prepare('SELECT * FROM comptes ORDER BY createdAt DESC'));
}

function updateSolde(id, montant) {
  const compte = getCompteById(id);
  if (!compte) return null;
  db.run('UPDATE comptes SET solde = ? WHERE id = ?', [compte.solde + montant, id]);
  saveDb();
  return getCompteById(id);
}

function deleteCompte(id) {
  db.run('DELETE FROM comptes WHERE id = ?', [id]);
  saveDb();
  return true;
}

function bloquerCompte(id) {
  db.run("UPDATE comptes SET statut = 'bloque' WHERE id = ?", [id]);
  saveDb();
  return getCompteById(id);
}

module.exports = { initDb, createCompte, getCompteById, getAllComptes, updateSolde, deleteCompte, bloquerCompte };
