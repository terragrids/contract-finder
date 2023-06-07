import { ConditionalCheckFailedException } from '@aws-sdk/client-dynamodb'
import DynamoDbRepository from './dynamodb.repository.js'
import TrackerNotFoundError from '../error/tracker-not-found.error.js'

export default class TrackerRepository extends DynamoDbRepository {
    trackerPrefix = 'tracker'
    readingPrefix = 'reading'
    placePrefix = 'place'
    itemName = 'tracker'

    async createTracker({ tokenId, userId, placeId, type, name, offChainImageUrl, isAdmin }) {
        const now = Date.now()

        return await this.put({
            item: {
                pk: { S: `${this.trackerPrefix}|${tokenId}` },
                gsi1pk: { S: `${this.placePrefix}|${placeId}` },
                gsi2pk: { S: `type|${this.trackerPrefix}` },
                data: { S: `${this.trackerPrefix}|active|${type}|${now}` },
                userId: { S: userId },
                created: { N: now.toString() },
                name: { S: name },
                offChainImageUrl: { S: offChainImageUrl }
            },
            itemLogName: this.itemName,
            ...(!isAdmin && { transactionConditions: [this.checkPlaceBelongsToUser(placeId, userId)] })
        })
    }

    async getTrackers({ placeId, type, status, sort, pageSize, nextPageKey }) {
        const forward = sort && sort === 'desc' ? false : true
        let condition = 'gsi1pk = :gsi1pk'
        let filter

        if (status) {
            condition = `${condition} AND begins_with(#data, :filter)`
            filter = `${this.trackerPrefix}|${status}`

            if (type) {
                filter = `${filter}|${type}`
            }
        }

        const data = await this.query({
            indexName: 'gsi1',
            conditionExpression: condition,
            ...(filter && { attributeNames: { '#data': 'data' } }),
            attributeValues: {
                ':gsi1pk': { S: `${this.placePrefix}|${placeId}` },
                ...(filter && { ':filter': { S: filter } })
            },
            pageSize,
            nextPageKey,
            forward
        })

        return {
            trackers: data.items.map(tracker => {
                const [, status, type, date] = tracker.data.S.split('|')
                return {
                    id: tracker.pk.S.replace(`${this.trackerPrefix}|`, ''),
                    placeId: tracker.gsi1pk.S.replace(`${this.placePrefix}|`, ''),
                    status,
                    type,
                    name: tracker.name.S,
                    offChainImageUrl: tracker.offChainImageUrl.S,
                    created: tracker.created.N,
                    lastModified: date
                }
            }),
            ...(data.nextPageKey && { nextPageKey: data.nextPageKey })
        }
    }

    async getTracker(tokenId) {
        try {
            const data = await this.get({
                key: { pk: { S: `${this.trackerPrefix}|${tokenId}` } },
                itemLogName: this.itemName
            })

            if (data.Item) {
                const [, status, type, date] = data.Item.data.S.split('|')
                return {
                    id: tokenId,
                    userId: data.Item.userId?.S,
                    name: data.Item.name.S,
                    status,
                    type,
                    offChainImageUrl: data.Item.offChainImageUrl.S,
                    created: data.Item.created.N,
                    lastModified: date
                }
            }

            throw new TrackerNotFoundError()
        } catch (e) {
            if (e instanceof ConditionalCheckFailedException) throw new TrackerNotFoundError()
            else throw e
        }
    }

    async createReading({ id, trackerId, userId, isAdmin }) {
        const now = Date.now()

        return await this.put({
            item: {
                pk: { S: `${this.readingPrefix}|${id}` },
                gsi1pk: { S: `${this.trackerPrefix}|${trackerId}` },
                gsi2pk: { S: `type|${this.readingPrefix}` },
                data: { S: `${this.readingPrefix}|active|${now}` },
                userId: { S: userId },
                created: { N: now.toString() }
            },
            itemLogName: this.itemName,
            ...(!isAdmin && { transactionConditions: [this.checkTrackerBelongsToUser(trackerId, userId)] })
        })
    }
}
