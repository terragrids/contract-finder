import { TokenInvalidError } from '../error/token-invalid-error.js'
import JwtRepository from '../repository/jwt.repository.js'
import jwt from 'jsonwebtoken'
import jwkToPem from 'jwk-to-pem'
import JwksFetchError from '../error/jwks-fetch.error.js'
import fetch from 'node-fetch'

async function refreshJwks() {
    const wellknownEndpoint = `${process.env.AUTH_ISSUER_BASE_URL}/.well-known/jwks.json`
    const response = await fetch(wellknownEndpoint)
    if (!response.ok) throw new JwksFetchError()
    const json = await response.json()
    await new JwtRepository().putJwks(json.keys)
    return json.keys
}

function decodeJwt(token, jwks) {
    let decodedJwt
    for (let i = 0; i < 2; i++) {
        try {
            decodedJwt = jwt.verify(token, jwkToPem(jwks[i]), {
                issuer: `${process.env.AUTH_ISSUER_BASE_URL}/`,
                algorithms: [jwks[i].alg]
            })
            break
        } catch (e) {
            // ignore
        }
    }
    return decodedJwt
}

export default async function jwtAuthorize(ctx, next) {
    try {
        const header = ctx.headers?.authorization?.split(' ')
        if (header?.length !== 2) throw new TokenInvalidError()
        const token = header[1]

        let jwks = await new JwtRepository().getJwks()
        if (!jwks) {
            jwks = await refreshJwks()
        }

        let decodedJwt = decodeJwt(token, jwks)
        if (!decodedJwt) {
            // Retry after refreshing jwks
            jwks = await refreshJwks()
            decodedJwt = decodeJwt(token, jwks)
        }

        if (!decodedJwt) throw new TokenInvalidError()
        ctx.state.jwt = decodedJwt
    } catch (e) {
        throw new TokenInvalidError()
    }
    await next()
}
