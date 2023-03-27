import { ConditionalCheckFailedException } from '@aws-sdk/client-dynamodb'
import NotFoundError from '../error/not-found.error.js'
import DynamoDbRepository from './dynamodb.repository.js'

export default class UserRepository extends DynamoDbRepository {
    async getUserByOauthId(id) {
        try {
            const response = await this.get({
                key: { pk: { S: `user|oauth|${id}` } },
                itemLogName: 'user'
            })

            const item = response.Item
            return item
                ? {
                      id: item.gsi1pk.S.replace('user|id|', ''),
                      ...(item.walletAddress && { walletAddress: item.walletAddress.S })
                  }
                : null
        } catch (e) {
            if (e instanceof ConditionalCheckFailedException) throw new NotFoundError()
            else throw e
        }
    }

    async getUserById(id) {
        try {
            const response = await this.query({
                indexName: 'gsi1',
                conditionExpression: 'gsi1pk = :gsi1pk',
                attributeValues: {
                    ':gsi1pk': { S: `user|id|${id}` }
                },
                pageSize: 1
            })

            if (response.items.length === 0) throw new NotFoundError()
            const item = response.items[0]
            return {
                id: item.gsi1pk.S.replace('user|id|', ''),
                ...(item.walletAddress && { walletAddress: item.walletAddress.S })
            }
        } catch (e) {
            if (e instanceof ConditionalCheckFailedException) throw new NotFoundError()
            else throw e
        }
    }
}
