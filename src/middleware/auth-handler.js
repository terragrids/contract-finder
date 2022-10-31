import { verify } from '@noble/ed25519'
import algosdk from 'algosdk'
import { TokenInvalidError } from '../error/token-invalid-error.js'
import { TokenExpiredError } from '../error/token-expired-error.js'
import assert from 'node:assert/strict'
import { minutes10 } from '../utils/constants.js'
import AuthRepository from '../repository/auth.repository.js'

export default async function authHandler(ctx, next) {
    let toCheck
    let signature
    let nonce
    let expiryDate
    let from
    let to
    let wallet

    const token = ctx.headers?.authorization?.split(' ')
    if (token?.length !== 2) throw new TokenInvalidError()

    try {
        const decodedToken = Buffer.from(token[1], 'base64')

        const identity = JSON.parse(decodedToken)
        wallet = identity.account
        const base64SignedTxn = identity.authentication

        const decodedTx = algosdk.decodeSignedTransaction(new Uint8Array(Buffer.from(base64SignedTxn, 'base64')))
        toCheck = decodedTx.txn
        signature = decodedTx.sig

        const note = new TextDecoder().decode(toCheck.note)
        assert.ok(note.startsWith('arc14'))
        const base64AuthMessage = note.replace('arc14', '')
        const decodedAuthMessage = Buffer.from(base64AuthMessage, 'base64')
        const authMessage = JSON.parse(decodedAuthMessage)

        assert.equal(authMessage.service, 'terragrids.org')
        assert.equal(authMessage.authAcc, wallet)
        assert.ok(typeof authMessage.nonce === 'string')

        nonce = authMessage.nonce
        expiryDate = nonce.split('-')[1]

        from = algosdk.encodeAddress(toCheck.from.publicKey)
        to = algosdk.encodeAddress(toCheck.to.publicKey)
    } catch (e) {
        throw new TokenInvalidError()
    }

    if (Number(expiryDate) < Date.now() || Number(expiryDate) > Date.now() + minutes10) {
        throw new TokenExpiredError()
    }

    if (toCheck.firstRound === 1 && toCheck.lastRound === 1 && from === to && from === wallet) {
        const authRepository = new AuthRepository()
        const savedAuthMessage = await authRepository.getAuthMessage(wallet)

        if (!savedAuthMessage || savedAuthMessage.nonce !== nonce) throw new TokenInvalidError()

        const verified = await verify(signature, toCheck.bytesToSign(), toCheck.from.publicKey)
        if (verified) {
            await authRepository.deleteAuthMessage(wallet)
            await next()
            return
        }
    }
    // if not verified throw invalid error
    throw new TokenInvalidError()
}
