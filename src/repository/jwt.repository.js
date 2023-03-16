import { ConditionalCheckFailedException } from '@aws-sdk/client-dynamodb'
import AssetNotFoundError from '../error/asset-not-found.error.js'
import DynamoDbRepository from './dynamodb.repository.js'

export default class JwtRepository extends DynamoDbRepository {
    async putJwks(jwks) {
        const base64Jwks = Buffer.from(JSON.stringify(jwks)).toString('base64')
        return await this.put({
            item: {
                pk: { S: 'jwks' },
                jwks: { S: base64Jwks },
                lastCached: { N: `${Date.now()}` }
            },
            itemLogName: 'jwks'
        })
    }

    async getJwks() {
        try {
            const response = await this.get({
                key: { pk: { S: 'jwks' } },
                itemLogName: 'jwks'
            })

            const item = response.Item
            if (!item) return null
            return JSON.parse(Buffer.from(item.jwks.S, 'base64').toString('ascii'))
        } catch (e) {
            if (e instanceof ConditionalCheckFailedException) throw new AssetNotFoundError()
            else throw e
        }
    }
}
