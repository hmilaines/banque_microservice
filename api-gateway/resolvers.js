// resolvers.js – Résolveurs GraphQL (appellent les microservices via gRPC)
const { compteClient, txClient, notifClient, call } = require('./grpcClients');

const resolvers = {
  // ── Queries ──────────────────────────────────────────────
  compte: async ({ id }) => {
    const res = await call(compteClient, 'GetCompte', { id });
    return res.compte;
  },

  comptes: async () => {
    const res = await call(compteClient, 'GetAllComptes', {});
    return res.comptes;
  },

  transaction: async ({ id }) => {
    const res = await call(txClient, 'GetTransaction', { id });
    return res.transaction;
  },

  transactions: async () => {
    const res = await call(txClient, 'GetAllTransactions', {});
    return res.transactions;
  },

  transactionsDuCompte: async ({ compteId }) => {
    const res = await call(txClient, 'GetTransactionsByCompte', { compte_id: compteId });
    return res.transactions;
  },

  notificationsDuCompte: async ({ compteId }) => {
    const res = await call(notifClient, 'GetNotificationsByCompte', { compte_id: compteId });
    return res.notifications;
  },

  toutesLesNotifications: async () => {
    const res = await call(notifClient, 'GetAllNotifications', {});
    return res.notifications;
  },

  // ── Mutations ─────────────────────────────────────────────
  creerCompte: async ({ proprietaire, email, soldeInitial, type }) => {
    const res = await call(compteClient, 'CreateCompte', {
      proprietaire,
      email,
      solde_initial: soldeInitial || 0,
      type: type || 'courant',
    });
    return res.compte;
  },

  bloquerCompte: async ({ id }) => {
    const res = await call(compteClient, 'BloquerCompte', { id });
    return res.compte;
  },

  supprimerCompte: async ({ id }) => {
    const res = await call(compteClient, 'DeleteCompte', { id });
    return { success: res.success, message: res.message };
  },

  effectuerTransaction: async ({ compteSource, compteDest, montant, type, description }) => {
    const res = await call(txClient, 'CreateTransaction', {
      compteSource,
      compteDest: compteDest || '',
      montant,
      type,
      description: description || '',
    });
    return res.transaction;
  },

  marquerNotificationLue: async ({ id }) => {
    const res = await call(notifClient, 'MarquerLue', { id });
    return res.notification;
  },
};

module.exports = resolvers;
