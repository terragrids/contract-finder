import { ConditionalCheckFailedException } from '@aws-sdk/client-dynamodb'
import ProjectNotFoundError from '../error/project-not-found.error.js'
import DynamoDbRepository from './dynamodb.repository.js'

export default class ProjectRepository extends DynamoDbRepository {
    projectPrefix = 'project'
    userPrefix = 'user'
    itemName = 'project'

    async createProject({ contractId, name, offChainImageUrl, creator }) {
        const now = Date.now()

        return await this.put({
            item: {
                pk: { S: `${this.projectPrefix}|${contractId}` },
                gsi1pk: { S: `${this.userPrefix}|${creator}` },
                gsi2pk: { S: `type|${this.itemName}` },
                data: { S: `${this.itemName}|created|${now}` },
                created: { S: now },
                name: { N: name.toString() },
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
                    name: data.Item.name.S,
                    status: data.Item.data.S.split('|')[1],
                    ...(data.Item.created && { created: parseInt(data.Item.created.N) }),
                    ...(data.Item.archived && { archived: parseInt(data.Item.archived.N) }),
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

    async getProjects({ pageSize, nextPageKey, sort, status }) {
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
                ':gsi2pk': { S: `type|${this.itemName}` },
                ...(status && { ':status': { S: `${this.itemName}|${status}|` } })
            },
            pageSize,
            nextPageKey,
            forward
        })

        return {
            projects: data.items.map(project => ({
                id: project.pk.S.replace('project|', ''),
                status: project.data.S.split('|')[1],
                creator: project.gsi1pk.S.replace(`${this.userPrefix}|`, ''),
                ...(project.name && { name: project.name.S }),
                ...(project.created && { created: parseInt(project.created.N) }),
                ...(project.archived && { archived: parseInt(project.archived.N) }),
                ...(project.offChainImageUrl && { offChainImageUrl: project.offChainImageUrl.S })
            })),
            ...(data.nextPageKey && { nextPageKey: data.nextPageKey })
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
            projects: data.items.map(project => ({
                id: project.pk.S.replace('project|', ''),
                created: project.data.S.split('|')[2],
                ...(project.name && { name: project.name.S }),
                ...(project.offChainImageUrl && { offChainImageUrl: project.offChainImageUrl.S })
            })),
            ...(data.nextPageKey && { nextPageKey: data.nextPageKey })
        }
    }

    async deleteProject(contractId, permanent = false) {
        try {
            if (permanent) {
                await this.delete({
                    key: { pk: { S: `${this.projectPrefix}|${contractId}` } },
                    itemLogName: this.itemName
                })
            } else {
                const now = Date.now()
                await this.update({
                    key: { pk: { S: `${this.projectPrefix}|${contractId}` } },
                    attributes: {
                        '#data': { S: `${this.itemName}|archived|${now}` },
                        archived: { N: now.toString() }
                    },
                    itemLogName: this.itemName
                })
            }
        } catch (e) {
            if (e instanceof ConditionalCheckFailedException) throw new ProjectNotFoundError()
            else throw e
        }
    }
}
