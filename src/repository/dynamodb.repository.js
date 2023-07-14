import {
    ConditionalCheckFailedException,
    DeleteItemCommand,
    DescribeTableCommand,
    DynamoDBClient,
    GetItemCommand,
    PutItemCommand,
    QueryCommand,
    TransactWriteItemsCommand,
    TransactionCanceledException,
    UpdateItemCommand
} from '@aws-sdk/client-dynamodb'
import RepositoryError from '../error/repository.error.js'
import Logger from '../logging/logger.js'
import { UserUnauthorizedError } from '../error/user-unauthorized-error.js'

export const PERMISSION_ALL = '0'
export const PERMISSION_APPROVE_PLACE = '1'
export const PERMISSION_ARCHIVE_PLACE = '2'

export default class DynamoDbRepository {
    client
    table

    constructor() {
        this.client = new DynamoDBClient({
            region: process.env.DYNAMO_DB_REGION,
            endpoint: process.env.DYNAMO_DB_ENDPOINT
        })
        this.table = process.env.DYNAMO_DB_ENV === 'prod' ? 'terragrids' : 'terragrids-dev'
    }

    async testConnection() {
        const command = new DescribeTableCommand({ TableName: this.table })
        try {
            const response = await this.client.send(command)
            return {
                status: response.$metadata.httpStatusCode,
                table: this.table,
                region: process.env.DYNAMO_DB_REGION,
                endpoint: process.env.DYNAMO_DB_ENDPOINT
            }
        } catch (e) {
            new Logger().error(e.message)
            return { error: 'Unable to connect to dynamo db' }
        }
    }

    async put({ item, itemLogName = 'item', transactionConditions }) {
        const putParams = {
            TableName: this.table,
            Item: item
        }

        if (transactionConditions) {
            const transactParams = {
                TransactItems: [
                    ...transactionConditions,
                    {
                        Put: putParams
                    }
                ]
            }

            const command = new TransactWriteItemsCommand(transactParams)

            try {
                return await this.client.send(command)
            } catch (e) {
                if (e instanceof ConditionalCheckFailedException) throw e
                if (e instanceof TransactionCanceledException && e.CancellationReasons && e.CancellationReasons.some(r => r.Code === 'ConditionalCheckFailed')) throw new UserUnauthorizedError()
                throw new RepositoryError(e, `Unable to put ${itemLogName}`)
            }
        } else {
            const command = new PutItemCommand(putParams)

            try {
                return await this.client.send(command)
            } catch (e) {
                throw new RepositoryError(e, `Unable to put ${itemLogName}`)
            }
        }
    }

    async transactWrite({ items, conditions }) {
        const transactParams = {
            TransactItems: [
                ...conditions,
                ...items.map(item => {
                    switch (item.command) {
                        case 'Put':
                            return {
                                Put: {
                                    TableName: this.table,
                                    Item: item.data
                                }
                            }
                        case 'Update':
                            return {
                                Update: this.getUpdateParams(item.key, item.attributes)
                            }
                        case 'UpdateCounter':
                            return {
                                Update: {
                                    TableName: this.table,
                                    Key: item.key,
                                    UpdateExpression: `add ${item.counters.map(c => `${c.name} :${c.name}`).join(',')}`,
                                    ExpressionAttributeValues: {
                                        ...item.counters.reduce((map, counter) => ((map[`:${counter.name}`] = { N: counter.change }), map), {})
                                    }
                                }
                            }
                    }
                })
            ]
        }

        const command = new TransactWriteItemsCommand(transactParams)

        try {
            return await this.client.send(command)
        } catch (e) {
            if (e instanceof ConditionalCheckFailedException) throw e
            if (e instanceof TransactionCanceledException && e.CancellationReasons && e.CancellationReasons.some(r => r.Code === 'ConditionalCheckFailed')) throw new UserUnauthorizedError()
            throw new RepositoryError(e, 'Unable to execute transaction')
        }
    }

    async update({ key, attributes, itemLogName = 'item', userId, permissions }) {
        const updateParams = this.getUpdateParams(key, attributes)

        if (permissions && userId) {
            const transactParams = {
                TransactItems: [
                    this.checkPermissions(userId, [PERMISSION_ARCHIVE_PLACE]),
                    {
                        Update: updateParams
                    }
                ]
            }

            const command = new TransactWriteItemsCommand(transactParams)

            try {
                return await this.client.send(command)
            } catch (e) {
                if (e instanceof ConditionalCheckFailedException) throw e
                if (e instanceof TransactionCanceledException && e.CancellationReasons && e.CancellationReasons.some(r => r.Code === 'ConditionalCheckFailed')) throw new UserUnauthorizedError()
                throw new RepositoryError(e, `Unable to update ${itemLogName}`)
            }
        } else {
            const command = new UpdateItemCommand(updateParams)

            try {
                return await this.client.send(command)
            } catch (e) {
                if (e instanceof ConditionalCheckFailedException) throw e
                throw new RepositoryError(e, `Unable to update ${itemLogName}`)
            }
        }
    }

    getUpdateParams(key, attributes) {
        const updateExpressionList = []
        const attributeValues = {}
        let attributeNames

        if (Object.values(attributes).some(value => value !== undefined)) {
            const updateAttributes = attributes

            for (const [key, value] of Object.entries(updateAttributes)) {
                if (value !== undefined) {
                    let placeholder = key
                    if (key.startsWith('#')) {
                        placeholder = key.substring(1)
                        if (!attributeNames) attributeNames = {}
                        attributeNames[key] = placeholder
                    }
                    updateExpressionList.push(`${key} = :${placeholder}`)
                    attributeValues[`:${placeholder}`] = value
                }
            }
        }

        const updateExpression = updateExpressionList.length > 0 ? `set ${updateExpressionList.join(',')}` : null

        return {
            TableName: this.table,
            Key: key,
            UpdateExpression: updateExpression,
            ExpressionAttributeValues: attributeValues,
            ExpressionAttributeNames: attributeNames,
            ConditionExpression: 'attribute_exists(pk)'
        }
    }

    async get({ key, itemLogName = 'item' }) {
        const params = {
            TableName: this.table,
            Key: key
        }
        const command = new GetItemCommand(params)

        try {
            return await this.client.send(command)
        } catch (e) {
            if (e instanceof ConditionalCheckFailedException) throw e
            throw new RepositoryError(e, `Unable to get ${itemLogName}`)
        }
    }

    async query({ indexName, conditionExpression, filterExpression, attributeNames, attributeValues, pageSize = 10, nextPageKey, forward = true, itemLogName = 'item' }) {
        const params = {
            TableName: this.table,
            IndexName: indexName,
            KeyConditionExpression: conditionExpression,
            FilterExpression: filterExpression,
            ExpressionAttributeNames: attributeNames,
            ExpressionAttributeValues: attributeValues,
            Limit: parseInt(pageSize),
            ExclusiveStartKey: nextPageKey ? JSON.parse(Buffer.from(nextPageKey, 'base64').toString('ascii')) : null,
            ScanIndexForward: forward
        }

        const command = new QueryCommand(params)

        try {
            const data = await this.client.send(command)
            return {
                items: data.Items || [],
                nextPageKey: data.LastEvaluatedKey ? Buffer.from(JSON.stringify(data.LastEvaluatedKey)).toString('base64') : null
            }
        } catch (e) {
            throw new RepositoryError(e, `Unable to query ${itemLogName}`)
        }
    }

    async delete({ key, itemLogName = 'item' }) {
        const params = {
            TableName: this.table,
            Key: key,
            ConditionExpression: 'attribute_exists(pk)'
        }
        const command = new DeleteItemCommand(params)

        try {
            return await this.client.send(command)
        } catch (e) {
            if (e instanceof ConditionalCheckFailedException) throw e
            else throw new RepositoryError(e, `Unable to delete ${itemLogName}`)
        }
    }

    checkPermissions(userId, permissions) {
        const conditionExpressionItems = []
        const expressionAttributeValues = {}

        for (const permission of permissions) {
            conditionExpressionItems.push(`contains(#permissions, :p_${permission})`)
            expressionAttributeValues[`:p_${permission}`] = { N: permission }
        }

        expressionAttributeValues[':all'] = { N: PERMISSION_ALL }
        const conditionExpression = `(${conditionExpressionItems.join(' AND ')}) OR contains(#permissions, :all)`

        return {
            ConditionCheck: {
                TableName: this.table,
                Key: { pk: { S: `user|oauth|${userId}` } },
                ConditionExpression: conditionExpression,
                ExpressionAttributeNames: {
                    '#permissions': 'permissions'
                },
                ExpressionAttributeValues: expressionAttributeValues
            }
        }
    }

    checkPlaceBelongsToUser(tokenId, userId) {
        return {
            ConditionCheck: {
                TableName: this.table,
                Key: { pk: { S: `place|${tokenId}` } },
                ConditionExpression: 'gsi1pk = :user',
                ExpressionAttributeValues: {
                    ':user': { S: `user|${userId}` }
                }
            }
        }
    }

    checkTrackerBelongsToUser(tokenId, userId) {
        return {
            ConditionCheck: {
                TableName: this.table,
                Key: { pk: { S: `tracker|${tokenId}` } },
                ConditionExpression: 'userId = :user',
                ExpressionAttributeValues: {
                    ':user': { S: userId }
                }
            }
        }
    }
}
