import { ConditionalCheckFailedException } from '@aws-sdk/client-dynamodb'
import ProjectNotFoundError from '../error/project-not-found.error.js'
import DynamoDbRepository from './dynamodb.repository.js'

export default class ProjectRepository extends DynamoDbRepository {
    projectPrefix = 'project'
    userPrefix = 'user'
    itemName = 'project'

    async createProject(contractId, creator) {
        return await this.put({
            item: {
                pk: { S: `${this.projectPrefix}|${contractId}` },
                gsi1pk: { S: `${this.userPrefix}|${creator}` },
                gsi2pk: { S: `type|${this.itemName}` }
            },
            itemLogName: this.itemName
        })
    }

    async getProject(contractId) {
        try {
            const data = await this.get({
                key: { pk: { S: `${this.projectPrefix}|${contractId}` } },
                itemLogName: this.itemName
            })

            return data.Item
                ? {
                      id: contractId,
                      creator: data.Item.gsi1pk.S.replace(`${this.userPrefix}|`, '')
                  }
                : null
        } catch (e) {
            if (e instanceof ConditionalCheckFailedException) throw new ProjectNotFoundError()
            else throw e
        }
    }
}
