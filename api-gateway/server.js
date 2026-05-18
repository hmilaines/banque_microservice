// server.js – API Gateway : REST + GraphQL → gRPC vers microservices
// Demarche identique au TP8 du prof (Express + Apollo + gRPC)
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { ApolloServer } = require('@apollo/server');
const { expressMiddleware } = require('@as-integrations/express4');
const { buildSchema } = require('graphql');
const fs = require('fs');
const path = require('path');

const { compteClient, txClient, notifClient, call } = require('./grpcClients');
const resolvers = require('./resolvers');

const app = express();
app.use(cors());
app.use(bodyParser.json());

// ═══════════════════════════════════════════════════════════════
// REST ENDPOINTS
// ═══════════════════════════════════════════════════════════════

// ── Comptes ──────────────────────────────────────────────────

// POST /api/comptes – Créer un compte
app.post('/api/comptes', async (req, res) => {
  try {
    const { proprietaire, email, soldeInitial, type } = req.body;
    const result = await call(compteClient, 'CreateCompte', {
      proprietaire,
      email,
      solde_initial: soldeInitial || 0,
      type: type || 'courant',
    });
    res.status(201).json(result.compte);
  } catch (err) {
    res.status(400).json({ erreur: err.message });
  }
});

// GET /api/comptes – Lister tous les comptes
app.get('/api/comptes', async (req, res) => {
  try {
    const result = await call(compteClient, 'GetAllComptes', {});
    res.json(result.comptes);
  } catch (err) {
    res.status(500).json({ erreur: err.message });
  }
});

// GET /api/comptes/:id – Obtenir un compte
app.get('/api/comptes/:id', async (req, res) => {
  try {
    const result = await call(compteClient, 'GetCompte', { id: req.params.id });
    res.json(result.compte);
  } catch (err) {
    res.status(404).json({ erreur: 'Compte introuvable' });
  }
});

// PATCH /api/comptes/:id/bloquer – Bloquer un compte
app.patch('/api/comptes/:id/bloquer', async (req, res) => {
  try {
    const result = await call(compteClient, 'BloquerCompte', { id: req.params.id });
    res.json({ message: result.message, compte: result.compte });
  } catch (err) {
    res.status(400).json({ erreur: err.message });
  }
});

// DELETE /api/comptes/:id – Supprimer un compte
app.delete('/api/comptes/:id', async (req, res) => {
  try {
    const result = await call(compteClient, 'DeleteCompte', { id: req.params.id });
    res.json({ success: result.success, message: result.message });
  } catch (err) {
    res.status(404).json({ erreur: err.message });
  }
});

// ── Transactions ─────────────────────────────────────────────

// POST /api/transactions – Effectuer une transaction
app.post('/api/transactions', async (req, res) => {
  try {
    const { compteSource, compteDest, montant, type, description } = req.body;
    const result = await call(txClient, 'CreateTransaction', {
      compteSource,
      compteDest: compteDest || '',
      montant,
      type,
      description: description || '',
    });
    res.status(201).json({ transaction: result.transaction, message: result.message });
  } catch (err) {
    res.status(400).json({ erreur: err.message });
  }
});

// GET /api/transactions – Lister toutes les transactions
app.get('/api/transactions', async (req, res) => {
  try {
    const result = await call(txClient, 'GetAllTransactions', {});
    res.json(result.transactions);
  } catch (err) {
    res.status(500).json({ erreur: err.message });
  }
});

// GET /api/transactions/:id – Obtenir une transaction
app.get('/api/transactions/:id', async (req, res) => {
  try {
    const result = await call(txClient, 'GetTransaction', { id: req.params.id });
    res.json(result.transaction);
  } catch (err) {
    res.status(404).json({ erreur: 'Transaction introuvable' });
  }
});

// GET /api/comptes/:id/transactions – Transactions d'un compte
app.get('/api/comptes/:id/transactions', async (req, res) => {
  try {
    const result = await call(txClient, 'GetTransactionsByCompte', { compte_id: req.params.id });
    res.json(result.transactions);
  } catch (err) {
    res.status(500).json({ erreur: err.message });
  }
});

// ── Notifications ─────────────────────────────────────────────

// GET /api/notifications – Toutes les notifications
app.get('/api/notifications', async (req, res) => {
  try {
    const result = await call(notifClient, 'GetAllNotifications', {});
    res.json(result.notifications);
  } catch (err) {
    res.status(500).json({ erreur: err.message });
  }
});

// GET /api/comptes/:id/notifications – Notifications d'un compte
app.get('/api/comptes/:id/notifications', async (req, res) => {
  try {
    const result = await call(notifClient, 'GetNotificationsByCompte', { compte_id: req.params.id });
    res.json(result.notifications);
  } catch (err) {
    res.status(500).json({ erreur: err.message });
  }
});

// PATCH /api/notifications/:id/lue – Marquer une notification comme lue
app.patch('/api/notifications/:id/lue', async (req, res) => {
  try {
    const result = await call(notifClient, 'MarquerLue', { id: req.params.id });
    res.json({ notification: result.notification, message: result.message });
  } catch (err) {
    res.status(404).json({ erreur: err.message });
  }
});

// ── Health check ──────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'api-gateway', timestamp: new Date().toISOString() });
});

// ═══════════════════════════════════════════════════════════════
// GRAPHQL – Apollo Server (même démarche que TP8)
// ═══════════════════════════════════════════════════════════════
async function startServer() {
  const schemaString = fs.readFileSync(path.join(__dirname, 'schema.gql'), 'utf8');
  const schema = buildSchema(schemaString);

  const apolloServer = new ApolloServer({ schema });
  await apolloServer.start();

  app.use(
    '/graphql',
    expressMiddleware(apolloServer, {
      context: async ({ req }) => ({ req }),
    })
  );

  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`\n✅ API Gateway démarrée sur http://localhost:${PORT}`);
    console.log(`   REST  → http://localhost:${PORT}/api/`);
    console.log(`   GraphQL → http://localhost:${PORT}/graphql`);
    console.log(`   Health  → http://localhost:${PORT}/health\n`);
  });
}

// Passer les resolvers à Apollo via le contexte root
// Override du middleware pour fournir les rootValue resolvers
const originalStart = startServer;
async function main() {
  const schemaString = fs.readFileSync(path.join(__dirname, 'schema.gql'), 'utf8');
  const schema = buildSchema(schemaString);

  const apolloServer = new ApolloServer({ schema, rootValue: resolvers });
  await apolloServer.start();

  app.use('/graphql', expressMiddleware(apolloServer));

  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`\n✅ API Gateway démarrée sur http://localhost:${PORT}`);
    console.log(`   REST    → http://localhost:${PORT}/api/`);
    console.log(`   GraphQL → http://localhost:${PORT}/graphql`);
    console.log(`   Health  → http://localhost:${PORT}/health\n`);
  });
}

main().catch(console.error);
