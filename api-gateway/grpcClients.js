// grpcClients.js – Clients gRPC vers les trois microservices
const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const path = require('path');

const opts = { keepCase: true, longs: String, enums: String, defaults: true, oneofs: true };

// ── Chargement des protos ────────────────────────────────────
const comptePkg = grpc.loadPackageDefinition(
  protoLoader.loadSync(path.join(__dirname, '../proto/compte.proto'), opts)
).compte;

const txPkg = grpc.loadPackageDefinition(
  protoLoader.loadSync(path.join(__dirname, '../proto/transaction.proto'), opts)
).transaction;

const notifPkg = grpc.loadPackageDefinition(
  protoLoader.loadSync(path.join(__dirname, '../proto/notification.proto'), opts)
).notification;

// ── Instanciation des clients ────────────────────────────────
const COMPTE_HOST = process.env.COMPTE_HOST || 'localhost:50051';
const TX_HOST = process.env.TX_HOST || 'localhost:50052';
const NOTIF_HOST = process.env.NOTIF_HOST || 'localhost:50053';

const compteClient = new comptePkg.CompteService(COMPTE_HOST, grpc.credentials.createInsecure());
const txClient = new txPkg.TransactionService(TX_HOST, grpc.credentials.createInsecure());
const notifClient = new notifPkg.NotificationService(NOTIF_HOST, grpc.credentials.createInsecure());

// ── Helper : promisifier un appel gRPC ──────────────────────
function call(client, method, payload = {}) {
  return new Promise((resolve, reject) => {
    client[method](payload, (err, res) => {
      if (err) reject(err);
      else resolve(res);
    });
  });
}

module.exports = { compteClient, txClient, notifClient, call };
