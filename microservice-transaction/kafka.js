// kafka.js – Producteur Kafka pour le microservice Transaction
const { Kafka } = require('kafkajs');

const kafka = new Kafka({
  clientId: 'microservice-transaction',
  brokers: [process.env.KAFKA_BROKER || 'localhost:9092'],
});

const producer = kafka.producer();
let connected = false;

async function connectProducer() {
  try {
    await producer.connect();
    connected = true;
    console.log('[Transaction-Kafka] Producteur connecté');
  } catch (err) {
    console.warn('[Transaction-Kafka] Kafka non disponible – mode dégradé:', err.message);
  }
}

// ── Topics produits par ce microservice ──────────────────────
// Topic : transaction-validee
//   Payload : { transactionId, compteSource, compteDest, montant, type, description }
// Topic : transaction-echouee
//   Payload : { transactionId, compteSource, raison }

async function publierTransactionValidee(transaction) {
  if (!connected) return;
  await producer.send({
    topic: 'transaction-validee',
    messages: [
      {
        key: transaction.id,
        value: JSON.stringify({
          transactionId: transaction.id,
          compteSource: transaction.compteSource,
          compteDest: transaction.compteDest,
          montant: transaction.montant,
          type: transaction.type,
          description: transaction.description,
          createdAt: transaction.createdAt,
        }),
      },
    ],
  });
  console.log(`[Transaction-Kafka] Événement publié → transaction-validee : ${transaction.id}`);
}

async function publierTransactionEchouee(transactionId, compteSource, raison) {
  if (!connected) return;
  await producer.send({
    topic: 'transaction-echouee',
    messages: [
      {
        key: transactionId,
        value: JSON.stringify({ transactionId, compteSource, raison }),
      },
    ],
  });
  console.log(`[Transaction-Kafka] Événement publié → transaction-echouee : ${transactionId}`);
}

module.exports = { connectProducer, publierTransactionValidee, publierTransactionEchouee };
