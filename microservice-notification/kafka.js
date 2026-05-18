// kafka.js – Consommateur Kafka pour le microservice Notification
const { Kafka } = require('kafkajs');
const db = require('./db');

const kafka = new Kafka({
  clientId: 'microservice-notification',
  brokers: [process.env.KAFKA_BROKER || 'localhost:9092'],
});

const consumer = kafka.consumer({ groupId: 'notification-group' });

// ── Topics consommés ─────────────────────────────────────────
// - transaction-validee  → notifier le client du succès
// - transaction-echouee  → notifier du refus

async function connectConsumer() {
  try {
    await consumer.connect();
    await consumer.subscribe({ topics: ['transaction-validee', 'transaction-echouee'], fromBeginning: false });

    await consumer.run({
      eachMessage: async ({ topic, message }) => {
        const payload = JSON.parse(message.value.toString());
        console.log(`[Notification-Kafka] Message reçu sur ${topic}:`, payload);

        if (topic === 'transaction-validee') {
          const msg = `Transaction ${payload.type} de ${payload.montant} TND validée (ID: ${payload.transactionId})`;
          await db.createNotification(payload.compteSource, '', 'transaction', msg);
          if (payload.compteDest) {
            const msgDest = `Réception de ${payload.montant} TND sur votre compte (ID tx: ${payload.transactionId})`;
            await db.createNotification(payload.compteDest, '', 'transaction', msgDest);
          }
        }

        if (topic === 'transaction-echouee') {
          const msg = `Transaction refusée : ${payload.raison}`;
          await db.createNotification(payload.compteSource, '', 'alerte_solde', msg);
        }
      },
    });

    console.log('[Notification-Kafka] Consommateur connecté aux topics : transaction-validee, transaction-echouee');
  } catch (err) {
    console.warn('[Notification-Kafka] Kafka non disponible – mode dégradé:', err.message);
  }
}

module.exports = { connectConsumer };
