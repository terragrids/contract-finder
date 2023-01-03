export function isAdminWallet(wallet) {
    return wallet && process.env.ADMIN_WALLETS ? process.env.ADMIN_WALLETS.split(',').includes(wallet) : false
}
