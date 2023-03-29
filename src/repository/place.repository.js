import { ConditionalCheckFailedException } from '@aws-sdk/client-dynamodb'
import PlaceNotFoundError from '../error/place-not-found.error.js'
import DynamoDbRepository from './dynamodb.repository.js'

export default class PlaceRepository extends DynamoDbRepository {
    placePrefix = 'place'
    userPrefix = 'user'
    itemName = 'place'

    async createPlace({ tokenId, userId, name, positionX, positionY, offChainImageUrl }) {
        const now = Date.now()

        return await this.put({
            item: {
                pk: { S: `${this.placePrefix}|${tokenId}` },
                gsi1pk: { S: `${this.userPrefix}|${userId}` },
                gsi2pk: { S: `type|${this.placePrefix}` },
                data: { S: `${this.placePrefix}|created|${now}` },
                created: { N: now.toString() },
                positionX: { N: positionX.toString() },
                positionY: { N: positionY.toString() },
                name: { S: name },
                offChainImageUrl: { S: offChainImageUrl }
            },
            itemLogName: this.itemName
        })
    }

    async getPlace(tokenId) {
        try {
            const data = await this.get({
                key: { pk: { S: `${this.placePrefix}|${tokenId}` } },
                itemLogName: this.itemName
            })

            if (data.Item) {
                return {
                    id: tokenId,
                    userId: data.Item.gsi1pk.S.replace(`${this.userPrefix}|`, ''),
                    name: data.Item.name.S,
                    status: data.Item.data.S.split('|')[1],
                    positionX: parseInt(data.Item.positionX.N),
                    positionY: parseInt(data.Item.positionY.N),
                    ...(data.Item.created && { created: parseInt(data.Item.created.N) }),
                    ...(data.Item.archived && { archived: parseInt(data.Item.archived.N) }),
                    ...(data.Item.offChainImageUrl && data.Item.offChainImageUrl.S && { offChainImageUrl: data.Item.offChainImageUrl.S })
                }
            }

            throw new PlaceNotFoundError()
        } catch (e) {
            if (e instanceof ConditionalCheckFailedException) throw new PlaceNotFoundError()
            else throw e
        }
    }

    async updatePlace({ tokenId, name, offChainImageUrl }) {
        try {
            await this.update({
                key: { pk: { S: `${this.placePrefix}|${tokenId}` } },
                attributes: {
                    ...(name && { '#name': { S: name } }),
                    ...(offChainImageUrl && { offChainImageUrl: { S: offChainImageUrl } })
                },
                itemLogName: this.itemName
            })
        } catch (e) {
            if (e instanceof ConditionalCheckFailedException) throw new PlaceNotFoundError()
            else throw e
        }
    }

    async setProjectApproval(contractId, approved) {
        try {
            const state = approved ? 'approved' : 'rejected'
            const now = Date.now()
            await this.update({
                key: { pk: { S: `${this.placePrefix}|${contractId}` } },
                attributes: {
                    '#data': { S: `${this.itemName}|${state}|${now}` },
                    approvalDate: { N: now.toString() }
                },
                itemLogName: this.itemName
            })
        } catch (e) {
            if (e instanceof ConditionalCheckFailedException) throw new PlaceNotFoundError()
            else throw e
        }
    }

    async getPlaces({ pageSize, nextPageKey, sort, status }) {
        const forward = sort && sort === 'desc' ? false : true
        let condition = 'gsi2pk = :gsi2pk'
        if (status) {
            condition = `${condition} AND begins_with(#data, :status)`
        }
        const data = await this.query({
            indexName: 'gsi2',
            conditionExpression: condition,
            ...(status && { attributeNames: { '#data': 'data' } }),
            attributeValues: {
                ':gsi2pk': { S: `type|${this.placePrefix}` },
                ...(status && { ':status': { S: `${this.placePrefix}|${status}` } })
            },
            pageSize,
            nextPageKey,
            forward
        })

        return {
            places: data.items.map(place => ({
                id: place.pk.S.replace(`${this.placePrefix}|`, ''),
                status: place.data.S.split('|')[1],
                userId: place.gsi1pk.S.replace(`${this.userPrefix}|`, ''),
                name: place.name.S,
                offChainImageUrl: place.offChainImageUrl.S,
                positionX: parseInt(place.positionX.N),
                positionY: parseInt(place.positionY.N)
            })),
            ...(data.nextPageKey && { nextPageKey: data.nextPageKey })
        }
    }

    async getPlacesByUser({ userId, pageSize, nextPageKey, sort, status }) {
        const forward = sort && sort === 'desc' ? false : true
        let placeAttributeValue = `${this.itemName}|`
        if (status) {
            placeAttributeValue = `${placeAttributeValue}${status}`
        }
        const data = await this.query({
            indexName: 'gsi1',
            conditionExpression: 'gsi1pk = :gsi1pk AND begins_with(#data, :place)',
            attributeNames: { '#data': 'data' },
            attributeValues: {
                ':gsi1pk': { S: `user|${userId}` },
                ':place': { S: placeAttributeValue }
            },
            pageSize,
            nextPageKey,
            forward
        })

        return {
            places: data.items.map(place => ({
                id: place.pk.S.replace(`${this.placePrefix}|`, ''),
                status: place.data.S.split('|')[1],
                ...(place.name && { name: place.name.S }),
                ...(place.created && { created: parseInt(place.created.N) }),
                ...(place.archived && { archived: parseInt(place.archived.N) }),
                ...(place.offChainImageUrl && { offChainImageUrl: place.offChainImageUrl.S })
            })),
            ...(data.nextPageKey && { nextPageKey: data.nextPageKey })
        }
    }

    async deleteProject(contractId, permanent = false) {
        try {
            if (permanent) {
                await this.delete({
                    key: { pk: { S: `${this.placePrefix}|${contractId}` } },
                    itemLogName: this.itemName
                })
            } else {
                const now = Date.now()
                await this.update({
                    key: { pk: { S: `${this.placePrefix}|${contractId}` } },
                    attributes: {
                        '#data': { S: `${this.itemName}|archived|${now}` },
                        archived: { N: now.toString() }
                    },
                    itemLogName: this.itemName
                })
            }
        } catch (e) {
            if (e instanceof ConditionalCheckFailedException) throw new PlaceNotFoundError()
            else throw e
        }
    }
}
