// db.js – RxDB (NoSQL) pour le microservice Notification
// Conforme au TP6 du prof (même approche RxDB + LokiJS adapter)
const { createRxDatabase, addRxPlugin } = require('rxdb');
const { getRxStorageLoki } = require('rxdb/plugins/storage-lokijs');
const { RxDBQueryBuilderPlugin } = require('rxdb/plugins/query-builder');
const Loki = require('lokijs');
const { v4: uuidv4 } = require('uuid');

addRxPlugin(RxDBQueryBuilderPlugin);

const notificationSchema = {
  title: 'notification',
  version: 0,
  type: 'object',
  primaryKey: 'id',
  properties: {
    id:        { type: 'string', maxLength: 100 },
    compteId:  { type: 'string' },
    email:     { type: 'string' },
    type:      { type: 'string' },
    message:   { type: 'string' },
    lue:       { type: 'boolean', default: false },
    createdAt: { type: 'string' },
  },
  required: ['id', 'compteId', 'type', 'message', 'createdAt'],
};

let db = null;
let notifCollection = null;

async function initDb() {
  if (db) return;
  db = await createRxDatabase({
    name: 'notifications_db',
    storage: getRxStorageLoki({
      adapter: new Loki.LokiMemoryAdapter(),
    }),
    ignoreDuplicate: true,
  });

  await db.addCollections({ notifications: { schema: notificationSchema } });
  notifCollection = db.notifications;
  console.log('[Notification-DB] RxDB (NoSQL - LokiJS) initialisée');
}

async function createNotification(compteId, email, type, message) {
  const doc = {
    id: uuidv4(),
    compteId,
    email: email || '',
    type,
    message,
    lue: false,
    createdAt: new Date().toISOString(),
  };
  await notifCollection.insert(doc);
  return doc;
}

async function getNotificationsByCompte(compteId) {
  const docs = await notifCollection.find().where('compteId').equals(compteId).exec();
  return docs.map(d => d.toJSON());
}

async function getAllNotifications() {
  const docs = await notifCollection.find().exec();
  return docs.map(d => d.toJSON());
}

async function marquerLue(id) {
  const doc = await notifCollection.findOne(id).exec();
  if (!doc) return null;
  await doc.patch({ lue: true });
  return doc.toJSON();
}

module.exports = { initDb, createNotification, getNotificationsByCompte, getAllNotifications, marquerLue };
