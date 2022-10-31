import DynamoDbRepository from './dynamodb.repository.js'

export default class AuthRepository extends DynamoDbRepository {
    itemName = 'auth'

    async getAuthMessage(walletAddress) {
        const data = await this.get({
            key: { pk: { S: `${this.itemName}|${walletAddress}` } },
            itemLogName: this.itemName
        })

        if (data.Item) {
            return {
                nonce: data.Item.nonce.S
            }
        } else return null
    }

    async deleteAuthMessage(walletAddress) {
        await this.delete({
            key: { pk: { S: `${this.itemName}|${walletAddress}` } },
            itemLogName: this.itemName
        })
    }
}
