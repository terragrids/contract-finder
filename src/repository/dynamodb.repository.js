import { ConditionalCheckFailedException, DeleteItemCommand, DescribeTableCommand, DynamoDBClient, GetItemCommand, PutItemCommand, QueryCommand, UpdateItemCommand } from '@aws-sdk/client-dynamodb'
import RepositoryError from '../error/repository.error.js'
import Logger from '../logging/logger.js'

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

    async put({ item, itemLogName = 'item' }) {
        const params = {
            TableName: this.table,
            Item: item
        }

        const command = new PutItemCommand(params)

        try {
            return await this.client.send(command)
        } catch (e) {
            throw new RepositoryError(e, `Unable to put ${itemLogName}`)
        }
    }

    async update({ key, attributes, itemLogName = 'item' }) {
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

        const params = {
            TableName: this.table,
            Key: key,
            UpdateExpression: updateExpression,
            ExpressionAttributeValues: attributeValues,
            ExpressionAttributeNames: attributeNames,
            ConditionExpression: 'attribute_exists(pk)'
        }

        const command = new UpdateItemCommand(params)

        try {
            return await this.client.send(command)
        } catch (e) {
            throw new RepositoryError(e, `Unable to update ${itemLogName}`)
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

    async query({ indexName, conditionExpression, attributeNames, attributeValues, pageSize = 10, nextPageKey, forward = true, itemLogName = 'item' }) {
        const params = {
            TableName: this.table,
            IndexName: indexName,
            KeyConditionExpression: conditionExpression,
            ExpressionAttributeNames: attributeNames,
            ExpressionAttributeValues: attributeValues,
            Limit: pageSize,
            ExclusiveStartKey: nextPageKey ? JSON.parse(Buffer.from(nextPageKey, 'base64').toString('ascii')) : null,
            ScanIndexForward: forward
        }

        const command = new QueryCommand(params)

        try {
            return await this.client.send(command)
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
}
