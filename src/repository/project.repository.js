import { ConditionalCheckFailedException } from '@aws-sdk/client-dynamodb'
import ProjectNotFoundError from '../error/project-not-found.error.js'
import DynamoDbRepository from './dynamodb.repository.js'

export default class ProjectRepository extends DynamoDbRepository {
    projectPrefix = 'project'
    userPrefix = 'user'
    itemName = 'project'

    async createProject({ contractId, name, offChainImageUrl, creator }) {
        return await this.put({
            item: {
                pk: { S: `${this.projectPrefix}|${contractId}` },
                gsi1pk: { S: `${this.userPrefix}|${creator}` },
                gsi2pk: { S: `type|${this.itemName}` },
                data: { S: `${this.itemName}|created|${Date.now()}` },
                name: { S: name },
                offChainImageUrl: { S: offChainImageUrl }
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

            if (data.Item) {
                return {
                    id: contractId,
                    creator: data.Item.gsi1pk.S.replace(`${this.userPrefix}|`, ''),
                    created: data.Item.data.S.replace(`${this.itemName}|created|`, ''),
                    ...(data.Item.offChainImageUrl && data.Item.offChainImageUrl.S && { offChainImageUrl: data.Item.offChainImageUrl.S })
                }
            }

            throw new ProjectNotFoundError()
        } catch (e) {
            if (e instanceof ConditionalCheckFailedException) throw new ProjectNotFoundError()
            else throw e
        }
    }

    async updateProject({ contractId, name, offChainImageUrl }) {
        try {
            await this.update({
                key: { pk: { S: `${this.projectPrefix}|${contractId}` } },
                attributes: {
                    ...(name && { '#name': { S: name } }),
                    ...(offChainImageUrl && { offChainImageUrl: { S: offChainImageUrl } })
                },
                itemLogName: this.itemName
            })
        } catch (e) {
            if (e instanceof ConditionalCheckFailedException) throw new ProjectNotFoundError()
            else throw e
        }
    }

    async getProjectsByCreator({ creator, pageSize, nextPageKey, sort }) {
        const forward = sort && sort === 'desc' ? false : true
        const data = await this.query({
            indexName: 'gsi1',
            conditionExpression: 'gsi1pk = :gsi1pk AND begins_with(#data, :type)',
            attributeNames: { '#data': 'data' },
            attributeValues: {
                ':gsi1pk': { S: `user|${creator}` },
                ':type': { S: 'project|' }
            },
            pageSize,
            nextPageKey,
            forward
        })

        return {
            projects: data.Items.map(project => ({
                id: project.pk.S.replace('project|', ''),
                created: project.data.S.split('|')[2],
                ...(project.name && { name: project.name.S }),
                ...(project.offChainImageUrl && { offChainImageUrl: project.offChainImageUrl.S })
            })),
            ...(data.nextPageKey && { nextPageKey: data.nextPageKey })
        }
    }
}
