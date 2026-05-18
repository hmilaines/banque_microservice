// server.js – Microservice Compte (gRPC + SQLite3)
const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const db = require('./db');
// db.initDb() sera appelé avant de démarrer le serveur

// ── Chargement du proto ──────────────────────────────────────
const PROTO_PATH = path.join(__dirname, '../proto/compte.proto');
const packageDef = protoLoader.loadSync(PROTO_PATH, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
});
const compteProto = grpc.loadPackageDefinition(packageDef).compte;

// ── Implémentation des méthodes gRPC ────────────────────────

function CreateCompte(call, callback) {
  try {
    const { proprietaire, email, solde_initial, type } = call.request;

    if (!proprietaire || !email) {
      return callback({
        code: grpc.status.INVALID_ARGUMENT,
        message: 'proprietaire et email sont obligatoires',
      });
    }

    const id = uuidv4();
    const createdAt = new Date().toISOString();
    const solde = solde_initial || 0;
    const typeCompte = type || 'courant';

    const compte = db.createCompte(id, proprietaire, email, solde, typeCompte, createdAt);
    console.log(`[Compte] Compte créé : ${id} pour ${proprietaire}`);
    callback(null, { compte });
  } catch (err) {
    console.error('[Compte] Erreur CreateCompte:', err.message);
    callback({ code: grpc.status.INTERNAL, message: err.message });
  }
}

function GetCompte(call, callback) {
  try {
    const compte = db.getCompteById(call.request.id);
    if (!compte) {
      return callback({
        code: grpc.status.NOT_FOUND,
        message: `Compte ${call.request.id} introuvable`,
      });
    }
    callback(null, { compte });
  } catch (err) {
    callback({ code: grpc.status.INTERNAL, message: err.message });
  }
}

function GetAllComptes(call, callback) {
  try {
    const comptes = db.getAllComptes();
    callback(null, { comptes });
  } catch (err) {
    callback({ code: grpc.status.INTERNAL, message: err.message });
  }
}

function UpdateSolde(call, callback) {
  try {
    const { id, montant } = call.request;
    const compte = db.getCompteById(id);

    if (!compte) {
      return callback({
        code: grpc.status.NOT_FOUND,
        message: `Compte ${id} introuvable`,
      });
    }
    if (compte.statut === 'bloque') {
      return callback({
        code: grpc.status.FAILED_PRECONDITION,
        message: 'Compte bloqué – opération refusée',
      });
    }
    if (compte.solde + montant < 0) {
      return callback({
        code: grpc.status.FAILED_PRECONDITION,
        message: 'Solde insuffisant',
      });
    }

    const updated = db.updateSolde(id, montant);
    console.log(`[Compte] Solde mis à jour : ${id} → ${updated.solde} TND`);
    callback(null, { compte: updated, message: 'Solde mis à jour avec succès' });
  } catch (err) {
    callback({ code: grpc.status.INTERNAL, message: err.message });
  }
}

function DeleteCompte(call, callback) {
  try {
    const success = db.deleteCompte(call.request.id);
    if (!success) {
      return callback({
        code: grpc.status.NOT_FOUND,
        message: `Compte ${call.request.id} introuvable`,
      });
    }
    callback(null, { success: true, message: 'Compte supprimé avec succès' });
  } catch (err) {
    callback({ code: grpc.status.INTERNAL, message: err.message });
  }
}

function BloquerCompte(call, callback) {
  try {
    const compte = db.getCompteById(call.request.id);
    if (!compte) {
      return callback({
        code: grpc.status.NOT_FOUND,
        message: `Compte ${call.request.id} introuvable`,
      });
    }
    const updated = db.bloquerCompte(call.request.id);
    console.log(`[Compte] Compte bloqué : ${call.request.id}`);
    callback(null, { compte: updated, message: 'Compte bloqué avec succès' });
  } catch (err) {
    callback({ code: grpc.status.INTERNAL, message: err.message });
  }
}

// ── Démarrage du serveur gRPC ────────────────────────────────
const PORT = process.env.GRPC_PORT || '50051';

const server = new grpc.Server();
server.addService(compteProto.CompteService.service, {
  CreateCompte,
  GetCompte,
  GetAllComptes,
  UpdateSolde,
  DeleteCompte,
  BloquerCompte,
});

async function main() {
  await db.initDb();
  server.bindAsync(
    `0.0.0.0:${PORT}`,
    grpc.ServerCredentials.createInsecure(),
    (err, port) => {
      if (err) { console.error('[Compte] Erreur de démarrage:', err); process.exit(1); }
      console.log(`✅ Microservice Compte démarré sur le port ${port} (gRPC)`);
    }
  );
}

main().catch(console.error);
