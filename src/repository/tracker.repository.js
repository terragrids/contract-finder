import DynamoDbRepository from './dynamodb.repository.js'

export default class TrackerRepository extends DynamoDbRepository {
    trackerPrefix = 'tracker'
    placePrefix = 'place'
    itemName = 'tracker'

    async createTracker({ tokenId, userId, placeId, name, offChainImageUrl }) {
        const now = Date.now()

        return await this.put({
            item: {
                pk: { S: `${this.trackerPrefix}|${tokenId}` },
                gsi1pk: { S: `${this.placePrefix}|${placeId}` },
                gsi2pk: { S: `type|${this.trackerPrefix}` },
                data: { S: `${this.trackerPrefix}|created|${now}` },
                created: { N: now.toString() },
                name: { S: name },
                offChainImageUrl: { S: offChainImageUrl }
            },
            itemLogName: this.itemName,
            transactionConditions: [this.checkPlaceBelongsToUser(placeId, userId)]
        })
    }
}
