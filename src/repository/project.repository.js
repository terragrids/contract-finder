import { ConditionalCheckFailedException } from '@aws-sdk/client-dynamodb'
import ProjectNotFoundError from '../error/project-not-found.error.js'
import DynamoDbRepository from './dynamodb.repository.js'

export default class ProjectRepository extends DynamoDbRepository {
    projectPrefix = 'project'
    creatorPrefix = 'creator'
    itemLogName = 'project'

    async createProject(contractId, creator) {
        return await this.put({
            item: {
                pk: { S: `${this.projectPrefix}|${contractId}` },
                creator: { S: `${this.creatorPrefix}|${creator}` }
            },
            itemLogName: this.itemLogName
        })
    }

    async getProject(contractId) {
        try {
            const data = await this.get({
                key: { pk: { S: `${this.projectPrefix}|${contractId}` } },
                itemLogName: this.itemLogName
            })

            return data.Item
                ? {
                      id: contractId,
                      creator: data.Item.creator.S.replace(`${this.creatorPrefix}|`, '')
                  }
                : null
        } catch (e) {
            if (e instanceof ConditionalCheckFailedException) throw new ProjectNotFoundError()
            else throw e
        }
    }
}
