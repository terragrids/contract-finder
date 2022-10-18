import { DescribeTableCommand, DynamoDBClient, PutItemCommand } from '@aws-sdk/client-dynamodb'
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
}
