export function isAdminWallet(wallet) {
    return wallet && process.env.ADMIN_WALLETS ? process.env.ADMIN_WALLETS.split(',').includes(wallet) : false
}

export async function isTokenAccepted(stdlib, wallet, tokenId) {
    const tokens = await stdlib.tokensAccepted(wallet)
    return tokens.map(token => token.toNumber()).some(id => id === tokenId)
}
