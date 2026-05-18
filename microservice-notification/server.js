// server.js – Microservice Notification (gRPC + RxDB + Kafka Consumer)
const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const path = require('path');
const db = require('./db');
const kafka = require('./kafka');

// ── Proto ────────────────────────────────────────────────────
const PROTO_PATH = path.join(__dirname, '../proto/notification.proto');
const packageDef = protoLoader.loadSync(PROTO_PATH, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
});
const notifProto = grpc.loadPackageDefinition(packageDef).notification;

// ── Implémentation gRPC ──────────────────────────────────────

async function GetNotificationsByCompte(call, callback) {
  try {
    const notifications = await db.getNotificationsByCompte(call.request.compte_id);
    callback(null, { notifications });
  } catch (err) {
    callback({ code: grpc.status.INTERNAL, message: err.message });
  }
}

async function GetAllNotifications(call, callback) {
  try {
    const notifications = await db.getAllNotifications();
    callback(null, { notifications });
  } catch (err) {
    callback({ code: grpc.status.INTERNAL, message: err.message });
  }
}

async function MarquerLue(call, callback) {
  try {
    const notif = await db.marquerLue(call.request.id);
    if (!notif) {
      return callback({ code: grpc.status.NOT_FOUND, message: 'Notification introuvable' });
    }
    callback(null, { notification: notif, message: 'Notification marquée comme lue' });
  } catch (err) {
    callback({ code: grpc.status.INTERNAL, message: err.message });
  }
}

// ── Démarrage ────────────────────────────────────────────────
const PORT = process.env.GRPC_PORT || '50053';

async function main() {
  await db.initDb();

  const server = new grpc.Server();
  server.addService(notifProto.NotificationService.service, {
    GetNotificationsByCompte,
    GetAllNotifications,
    MarquerLue,
  });

  server.bindAsync(`0.0.0.0:${PORT}`, grpc.ServerCredentials.createInsecure(), async (err, port) => {
    if (err) { console.error(err); process.exit(1); }
    await kafka.connectConsumer();
    console.log(`✅ Microservice Notification démarré sur le port ${port} (gRPC)`);
  });
}

main().catch(console.error);
