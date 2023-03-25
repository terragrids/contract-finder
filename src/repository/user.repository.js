import { ConditionalCheckFailedException } from '@aws-sdk/client-dynamodb'
import NotFoundError from '../error/not-found.error.js'
import DynamoDbRepository from './dynamodb.repository.js'

export default class UserRepository extends DynamoDbRepository {
    async getUserById(id) {
        try {
            const response = await this.get({
                key: { pk: { S: `user|${id}` } },
                itemLogName: 'user'
            })

            const item = response.Item
            return item
                ? {
                      id: item.pk.S.replace('user|', ''),
                      ...(item.walletAddress && { walletAddress: item.walletAddress.S })
                  }
                : null
        } catch (e) {
            if (e instanceof ConditionalCheckFailedException) throw new NotFoundError()
            else throw e
        }
    }
}
