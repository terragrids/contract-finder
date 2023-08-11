import { ConditionalCheckFailedException } from '@aws-sdk/client-dynamodb'
import DynamoDbRepository from './dynamodb.repository.js'
import TrackerNotFoundError from '../error/tracker-not-found.error.js'
import ReadingNotFoundError from '../error/reading-not-found.error.js'

export default class TrackerRepository extends DynamoDbRepository {
    trackerPrefix = 'tracker'
    readingPrefix = 'reading'
    importedTimestampPrefix = 'imp-ts'
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

    async getTracker(tokenId, withApiKey = false) {
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
                    placeId: data.Item.gsi1pk.S.replace(`${this.placePrefix}|`, ''),
                    name: data.Item.name.S,
                    status,
                    type,
                    offChainImageUrl: data.Item.offChainImageUrl.S,
                    ...(data.Item.utilityName && { utilityName: data.Item.utilityName.S }),
                    ...(data.Item.utilityAccountId && { utilityAccountId: data.Item.utilityAccountId.S }),
                    ...(withApiKey && data.Item.utilityAccountApiKey && { utilityAccountApiKey: data.Item.utilityAccountApiKey.S }),
                    ...(data.Item.meterMpan && { meterMpan: data.Item.meterMpan.S }),
                    ...(data.Item.meterMprn && { meterMprn: data.Item.meterMprn.S }),
                    ...(data.Item.meterSerialNumber && { meterSerialNumber: data.Item.meterSerialNumber.S }),
                    ...(data.Item.consumptionReadingCount && { consumptionReadingCount: data.Item.consumptionReadingCount.N }),
                    ...(data.Item.absoluteReadingCount && { absoluteReadingCount: data.Item.absoluteReadingCount.N }),
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

    async updateTracker({ tokenId, utilityName, utilityAccountId, utilityAccountApiKey, meterMpan, meterMprn, meterSerialNumber }) {
        try {
            const now = Date.now()
            await this.update({
                key: { pk: { S: `${this.trackerPrefix}|${tokenId}` } },
                attributes: {
                    ...(utilityName && { utilityName: { S: utilityName } }),
                    ...(utilityAccountId && { utilityAccountId: { S: utilityAccountId } }),
                    ...(utilityAccountApiKey && { utilityAccountApiKey: { S: utilityAccountApiKey } }),
                    ...(meterMpan && { meterMpan: { S: meterMpan } }),
                    ...(meterMprn && { meterMprn: { S: meterMprn } }),
                    ...(meterSerialNumber && { meterSerialNumber: { S: meterSerialNumber } }),
                    lastModified: { N: now.toString() }
                },
                itemLogName: this.itemName
            })
        } catch (e) {
            if (e instanceof ConditionalCheckFailedException) throw new TrackerNotFoundError()
            else throw e
        }
    }

    async removeTrackerUtility(tokenId) {
        try {
            const now = Date.now()
            await this.update({
                key: { pk: { S: `${this.trackerPrefix}|${tokenId}` } },
                attributes: {
                    utilityName: { S: '' },
                    utilityAccountId: { S: '' },
                    utilityAccountApiKey: { S: '' },
                    meterMpan: { S: '' },
                    meterMprn: { S: '' },
                    meterSerialNumber: { S: '' },
                    lastModified: { N: now.toString() }
                },
                itemLogName: this.itemName
            })
        } catch (e) {
            if (e instanceof ConditionalCheckFailedException) throw new TrackerNotFoundError()
            else throw e
        }
    }

    async createReadings({ trackerId, placeId, userId, isAdmin, readings }) {
        const now = Date.now()

        const consumptionReadings = readings.filter(reading => reading.type === 'consumption' && reading.start !== undefined && reading.end !== undefined)
        const absoluteReadings = readings.filter(reading => reading.type === 'absolute')

        await this.transactWrite({
            items: [
                ...readings.map(reading => ({
                    command: 'Put',
                    data: {
                        pk: { S: `${this.readingPrefix}|${reading.id}` },
                        gsi1pk: { S: `${this.trackerPrefix}|${trackerId}` },
                        gsi2pk: { S: `type|${this.readingPrefix}|${reading.type}` },
                        data: { S: `${this.readingPrefix}|active|${reading.start || now}` },
                        placeId: { S: `${this.placePrefix}|${placeId}` },
                        userId: { S: userId },
                        created: { N: now.toString() },
                        hash: { S: reading.encryptionIV }
                    }
                })),
                ...consumptionReadings.map(reading => ({
                    command: 'Put',
                    data: {
                        pk: { S: `consumption|${trackerId}|${reading.start}|${reading.end}` },
                        gsi1pk: { S: `${this.trackerPrefix}|${trackerId}` },
                        gsi2pk: { S: `type|${this.importedTimestampPrefix}` },
                        data: { S: `${this.importedTimestampPrefix}|${reading.start}` }
                    }
                })),
                ...(consumptionReadings.length
                    ? [
                          {
                              command: 'UpdateCounter',
                              key: { pk: { S: `${this.trackerPrefix}|${trackerId}` } },
                              counters: [
                                  {
                                      name: 'consumptionReadingCount',
                                      change: consumptionReadings.length
                                  }
                              ]
                          }
                      ]
                    : []),
                ...(consumptionReadings.length
                    ? [
                          {
                              command: 'UpdateCounter',
                              key: { pk: { S: `${this.placePrefix}|${placeId}` } },
                              counters: [
                                  {
                                      name: 'consumptionReadingCount',
                                      change: consumptionReadings.length
                                  }
                              ]
                          }
                      ]
                    : []),
                ...(absoluteReadings.length
                    ? [
                          {
                              command: 'UpdateCounter',
                              key: { pk: { S: `${this.trackerPrefix}|${trackerId}` } },
                              counters: [
                                  {
                                      name: 'absoluteReadingsCount',
                                      change: absoluteReadings.length
                                  }
                              ]
                          }
                      ]
                    : []),
                ...(absoluteReadings.length
                    ? [
                          {
                              command: 'UpdateCounter',
                              key: { pk: { S: `${this.placePrefix}|${placeId}` } },
                              counters: [
                                  {
                                      name: 'absoluteReadingsCount',
                                      change: absoluteReadings.length
                                  }
                              ]
                          }
                      ]
                    : [])
            ],
            conditions: !isAdmin ? [this.checkTrackerBelongsToUser(trackerId, userId)] : []
        })
    }

    async deleteReading({ userId, isAdmin, reading }) {
        await this.transactWrite({
            items: [
                {
                    command: 'Delete',
                    key: { pk: { S: `${this.readingPrefix}|${reading.id}` } }
                },
                {
                    command: 'UpdateCounter',
                    key: { pk: { S: `${this.trackerPrefix}|${reading.trackerId}` } },
                    counters: [
                        {
                            name: reading.type === 'consumption' ? 'consumptionReadingCount' : 'absoluteReadingsCount',
                            change: -1
                        }
                    ]
                },
                {
                    command: 'UpdateCounter',
                    key: { pk: { S: `${this.placePrefix}|${reading.placeId}` } },
                    counters: [
                        {
                            name: reading.type === 'consumption' ? 'consumptionReadingCount' : 'absoluteReadingsCount',
                            change: -1
                        }
                    ]
                }
            ],
            conditions: !isAdmin ? [this.checkTrackerBelongsToUser(reading.trackerId, userId)] : []
        })
    }

    async getReadings({ trackerId, status, sort, pageSize, nextPageKey }) {
        const forward = sort && sort === 'desc' ? false : true
        let condition = 'gsi1pk = :gsi1pk'
        let filter

        if (status) {
            condition = `${condition} AND begins_with(#data, :filter)`
            filter = `${this.readingPrefix}|${status}`
        }

        const data = await this.query({
            indexName: 'gsi1',
            conditionExpression: condition,
            ...(filter && { attributeNames: { '#data': 'data' } }),
            attributeValues: {
                ':gsi1pk': { S: `${this.trackerPrefix}|${trackerId}` },
                ...(filter && { ':filter': { S: filter } })
            },
            pageSize,
            nextPageKey,
            forward
        })

        return {
            readings: data.items
                .map(reading => {
                    try {
                        const [, status] = reading.data.S.split('|')
                        return {
                            id: reading.pk.S.replace(`${this.readingPrefix}|`, ''),
                            trackerId: reading.gsi1pk.S.replace(`${this.trackerPrefix}|`, ''),
                            status,
                            created: reading.created.N,
                            ...(reading.hash && { iv: reading.hash.S })
                        }
                    } catch (e) {
                        return null
                    }
                })
                .filter(item => item !== null),
            ...(data.nextPageKey && { nextPageKey: data.nextPageKey })
        }
    }

    async getReading(id) {
        try {
            const data = await this.get({
                key: { pk: { S: `${this.readingPrefix}|${id}` } },
                itemLogName: this.itemName
            })

            if (data.Item) {
                const [, status, date] = data.Item.data.S.split('|')
                return {
                    id: data.Item.pk.S.replace(`${this.readingPrefix}|`, ''),
                    trackerId: data.Item.gsi1pk.S.replace(`${this.trackerPrefix}|`, ''),
                    placeId: data.Item.placeId.S,
                    userId: data.Item.userId.S,
                    type: data.Item.gsi2pk.S.replace(`type|${this.readingPrefix}|`, ''),
                    status,
                    created: data.Item.created.N,
                    lastModified: date,
                    ...(data.Item.hash && { iv: data.Item.hash.S })
                }
            }

            throw new ReadingNotFoundError()
        } catch (e) {
            if (e instanceof ConditionalCheckFailedException) throw new ReadingNotFoundError()
            else throw e
        }
    }

    async getConsumptionReadingExistenceByInterval({ trackerId, intervals }) {
        const data = await this.batchGetItems({
            keys: intervals.map(interval => ({
                pk: { S: `consumption|${trackerId}|${interval.start}|${interval.end}` }
            })),
            projection: 'pk'
        })

        return data.map(item => {
            const [, , start, end] = item.pk.S.split('|')
            return { start, end }
        })
    }

    async getReadingsById(ids) {
        const data = await this.batchGetItems({
            keys: ids.map(id => ({
                pk: { S: `${this.readingPrefix}|${id}` }
            })),
            projection: 'pk'
        })

        return data.map(item => {
            const [, status, date] = item.data.S.split('|')
            return {
                id: item.pk.S.replace(`${this.readingPrefix}|`, ''),
                trackerId: item.gsi1pk.S.replace(`${this.trackerPrefix}|`, ''),
                placeId: item.placeId?.S,
                userId: item.userId?.S,
                status,
                created: item.created?.N,
                lastModified: date,
                ...(item.hash && { iv: data.Item.hash.S })
            }
        })
    }
}
