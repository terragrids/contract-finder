import DynamoDbRepository from './dynamodb.repository.js'

export default class ProjectRepository extends DynamoDbRepository {
    projectPrefix = 'project'
    creatorPrefix = 'creator'

    async createProject({ contractInfo, creator }) {
        return await this.put({
            item: {
                pk: { S: `${this.projectPrefix}|${contractInfo}` },
                creator: { S: creator }
            },
            itemLogName: 'project'
        })
    }
}
