// server.js – Microservice Transaction (gRPC + SQLite3 + Kafka)
const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const db = require('./db');
const kafka = require('./kafka');

// ── Proto ────────────────────────────────────────────────────
const PROTO_TRANSACTION = path.join(__dirname, '../proto/transaction.proto');
const PROTO_COMPTE = path.join(__dirname, '../proto/compte.proto');

const txPackage = grpc.loadPackageDefinition(
  protoLoader.loadSync(PROTO_TRANSACTION, { keepCase: true, longs: String, enums: String, defaults: true, oneofs: true })
).transaction;

const comptePackage = grpc.loadPackageDefinition(
  protoLoader.loadSync(PROTO_COMPTE, { keepCase: true, longs: String, enums: String, defaults: true, oneofs: true })
).compte;

// ── Client gRPC vers Microservice Compte ─────────────────────
const COMPTE_HOST = process.env.COMPTE_HOST || 'localhost:50051';
const compteClient = new comptePackage.CompteService(
  COMPTE_HOST,
  grpc.credentials.createInsecure()
);

// Helper : appel gRPC vers Compte (promisifié)
function appelCompte(methode, payload) {
  return new Promise((resolve, reject) => {
    compteClient[methode](payload, (err, res) => {
      if (err) reject(err);
      else resolve(res);
    });
  });
}

// ── Implémentation gRPC ──────────────────────────────────────

async function CreateTransaction(call, callback) {
  const { compteSource, compteDest, montant, type, description } = call.request;

  if (!compteSource || !montant || !type) {
    return callback({
      code: grpc.status.INVALID_ARGUMENT,
      message: 'compteSource, montant et type sont obligatoires',
    });
  }

  const id = uuidv4();
  const createdAt = new Date().toISOString();
  const tx = db.createTransaction(id, compteSource, compteDest, montant, type, description, createdAt);

  try {
    // ── Logique métier selon le type ─────────────────────────
    if (type === 'depot') {
      await appelCompte('UpdateSolde', { id: compteSource, montant });
    } else if (type === 'retrait') {
      await appelCompte('UpdateSolde', { id: compteSource, montant: -montant });
    } else if (type === 'virement') {
      if (!compteDest) throw new Error('compteDest requis pour un virement');
      await appelCompte('UpdateSolde', { id: compteSource, montant: -montant });
      await appelCompte('UpdateSolde', { id: compteDest, montant });
    }

    // Marquer validée
    const txValidee = db.updateStatut(id, 'validee');
    console.log(`[Transaction] Validée : ${id} | Type : ${type} | Montant : ${montant} TND`);

    // Publier événement Kafka
    await kafka.publierTransactionValidee(txValidee);

    callback(null, { transaction: txValidee, message: 'Transaction validée avec succès' });
  } catch (err) {
    console.error('[Transaction] Échec:', err.message);
    const txEchouee = db.updateStatut(id, 'echouee');
    await kafka.publierTransactionEchouee(id, compteSource, err.message);
    callback({
      code: grpc.status.FAILED_PRECONDITION,
      message: `Transaction échouée : ${err.message}`,
    });
  }
}

function GetTransaction(call, callback) {
  const tx = db.getTransactionById(call.request.id);
  if (!tx) return callback({ code: grpc.status.NOT_FOUND, message: 'Transaction introuvable' });
  callback(null, { transaction: tx });
}

function GetTransactionsByCompte(call, callback) {
  const txs = db.getTransactionsByCompte(call.request.compte_id);
  callback(null, { transactions: txs });
}

function GetAllTransactions(call, callback) {
  callback(null, { transactions: db.getAllTransactions() });
}

// ── Démarrage ────────────────────────────────────────────────
const PORT = process.env.GRPC_PORT || '50052';

const server = new grpc.Server();
server.addService(txPackage.TransactionService.service, {
  CreateTransaction,
  GetTransaction,
  GetTransactionsByCompte,
  GetAllTransactions,
});

server.bindAsync(`0.0.0.0:${PORT}`, grpc.ServerCredentials.createInsecure(), async (err, port) => {
  if (err) { console.error(err); process.exit(1); }
  await db.initDb();
  await kafka.connectProducer();
  console.log(`✅ Microservice Transaction démarré sur le port ${port} (gRPC)`);
});
