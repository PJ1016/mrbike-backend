const NULLISH_WALLET_FILTER = {
  $or: [{ wallet: { $exists: false } }, { wallet: null }],
};

function shouldNormalizeWallet(dealer) {
  return !Object.prototype.hasOwnProperty.call(dealer || {}, "wallet") || dealer.wallet === null;
}

function normalizeWalletValue(dealer) {
  return shouldNormalizeWallet(dealer) ? 0 : dealer.wallet;
}

module.exports = {
  NULLISH_WALLET_FILTER,
  shouldNormalizeWallet,
  normalizeWalletValue,
};
