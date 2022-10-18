import { app } from './app.js'
import request from 'supertest'

const mockStdlib = {
    setProviderByName: jest.fn().mockImplementation(() => jest.fn()),
    getProvider: jest.fn().mockImplementation(() => jest.fn()),
    newAccountFromMnemonic: jest.fn().mockImplementation(() => jest.fn()),
    protect: jest.fn().mockImplementation(() => jest.fn())
}

jest.mock('./provider/reach-provider.js', () =>
    jest.fn().mockImplementation(() => ({
        getStdlib: jest.fn().mockImplementation(() => ({
            setProviderByName: mockStdlib.setProviderByName,
            getProvider: mockStdlib.getProvider,
            newAccountFromMnemonic: mockStdlib.newAccountFromMnemonic,
            protect: mockStdlib.protect
        })),
        getEnv: jest.fn().mockImplementation(() => 'TestNet')
    }))
)

const mockDynamoDbRepository = {
    testConnection: jest.fn().mockImplementation(() => jest.fn())
}
jest.mock('./repository/dynamodb.repository.js', () =>
    jest.fn().mockImplementation(() => ({
        testConnection: mockDynamoDbRepository.testConnection
    }))
)

const mockProjectRepository = {
    createProject: jest.fn().mockImplementation(() => jest.fn())
}
jest.mock('./repository/project.repository.js', () =>
    jest.fn().mockImplementation(() => ({
        createProject: mockProjectRepository.createProject
    }))
)

jest.mock('../reach/project-contract/build/index.main.mjs', () => jest.fn().mockImplementation(() => ({})))

describe('app', function () {
    const OLD_ENV = process.env

    beforeEach(() => {
        jest.clearAllMocks()
        process.env = { ...OLD_ENV } // make a copy
    })

    afterAll(() => {
        process.env = OLD_ENV // restore old env
    })

    describe('get root endpoint', function () {
        it('should return 200 when calling root endpoint', async () => {
            const response = await request(app.callback()).get('/')
            expect(response.status).toBe(200)
            expect(response.text).toBe('terragrids project contract api')
        })
    })

    describe('get health check endpoint', function () {
        it('should return 200 when calling hc endpoint and all is healthy', async () => {
            mockStdlib.getProvider.mockImplementation(() =>
                Promise.resolve({
                    algodClient: { healthCheck: () => ({ do: async () => Promise.resolve({}) }) },
                    indexer: { makeHealthCheck: () => ({ do: async () => Promise.resolve({ version: '1.2.3' }) }) }
                })
            )

            mockDynamoDbRepository.testConnection.mockImplementation(() =>
                Promise.resolve({
                    status: 200,
                    region: 'test-region'
                })
            )

            mockStdlib.newAccountFromMnemonic.mockImplementation(() => ({ networkAccount: {} }))

            const response = await request(app.callback()).get('/hc')
            expect(response.status).toBe(200)
            expect(response.status).toBe(200)
            expect(response.body).toEqual({
                env: 'dev',
                region: 'local',
                db: {
                    status: 'ok',
                    region: 'test-region'
                },
                reach: {
                    network: 'TestNet',
                    algoClient: 'ok',
                    algoIndexer: 'ok',
                    algoAccount: 'ok'
                }
            })
        })

        it('should return 200 when calling hc endpoint and algo client is faulty', async () => {
            mockStdlib.getProvider.mockImplementation(() =>
                Promise.resolve({
                    algodClient: { healthCheck: () => ({ do: async () => Promise.resolve({ error: 'error' }) }) },
                    indexer: { makeHealthCheck: () => ({ do: async () => Promise.resolve({ version: '1.2.3' }) }) }
                })
            )

            mockDynamoDbRepository.testConnection.mockImplementation(() =>
                Promise.resolve({
                    status: 200,
                    region: 'test-region'
                })
            )

            mockStdlib.newAccountFromMnemonic.mockImplementation(() => ({ networkAccount: {} }))

            const response = await request(app.callback()).get('/hc')
            expect(response.status).toBe(200)
            expect(response.status).toBe(200)
            expect(response.body).toEqual({
                env: 'dev',
                region: 'local',
                db: {
                    status: 'ok',
                    region: 'test-region'
                },
                reach: {
                    network: 'TestNet',
                    algoClient: 'error',
                    algoIndexer: 'ok',
                    algoAccount: 'ok'
                }
            })
        })

        it('should return 200 when calling hc endpoint and algo indexer is faulty', async () => {
            mockStdlib.getProvider.mockImplementation(() =>
                Promise.resolve({
                    algodClient: { healthCheck: () => ({ do: async () => Promise.resolve({}) }) },
                    indexer: { makeHealthCheck: () => ({ do: async () => Promise.resolve({}) }) }
                })
            )

            mockDynamoDbRepository.testConnection.mockImplementation(() =>
                Promise.resolve({
                    status: 200,
                    region: 'test-region'
                })
            )

            mockStdlib.newAccountFromMnemonic.mockImplementation(() => ({ networkAccount: {} }))

            const response = await request(app.callback()).get('/hc')
            expect(response.status).toBe(200)
            expect(response.status).toBe(200)
            expect(response.body).toEqual({
                env: 'dev',
                region: 'local',
                db: {
                    status: 'ok',
                    region: 'test-region'
                },
                reach: {
                    network: 'TestNet',
                    algoClient: 'ok',
                    algoIndexer: 'error',
                    algoAccount: 'ok'
                }
            })
        })

        it('should return 200 when calling hc endpoint and algo account is faulty', async () => {
            mockStdlib.getProvider.mockImplementation(() =>
                Promise.resolve({
                    algodClient: { healthCheck: () => ({ do: async () => Promise.resolve({}) }) },
                    indexer: { makeHealthCheck: () => ({ do: async () => Promise.resolve({ version: '1.2.3' }) }) }
                })
            )

            mockDynamoDbRepository.testConnection.mockImplementation(() =>
                Promise.resolve({
                    status: 200,
                    region: 'test-region'
                })
            )

            mockStdlib.newAccountFromMnemonic.mockImplementation(() => ({}))

            const response = await request(app.callback()).get('/hc')
            expect(response.status).toBe(200)
            expect(response.status).toBe(200)
            expect(response.body).toEqual({
                env: 'dev',
                region: 'local',
                db: {
                    status: 'ok',
                    region: 'test-region'
                },
                reach: {
                    network: 'TestNet',
                    algoClient: 'ok',
                    algoIndexer: 'ok',
                    algoAccount: 'error'
                }
            })
        })

        it('should return 200 when calling hc endpoint and db in faulty', async () => {
            mockStdlib.getProvider.mockImplementation(() =>
                Promise.resolve({
                    algodClient: { healthCheck: () => ({ do: async () => Promise.resolve({}) }) },
                    indexer: { makeHealthCheck: () => ({ do: async () => Promise.resolve({ version: '1.2.3' }) }) }
                })
            )

            mockDynamoDbRepository.testConnection.mockImplementation(() =>
                Promise.resolve({
                    status: 500,
                    region: 'test-region'
                })
            )

            mockStdlib.newAccountFromMnemonic.mockImplementation(() => ({ networkAccount: {} }))

            const response = await request(app.callback()).get('/hc')
            expect(response.status).toBe(200)
            expect(response.status).toBe(200)
            expect(response.body).toEqual({
                env: 'dev',
                region: 'local',
                db: {
                    status: 'error',
                    region: 'test-region'
                },
                reach: {
                    network: 'TestNet',
                    algoClient: 'ok',
                    algoIndexer: 'ok',
                    algoAccount: 'ok'
                }
            })
        })
    })

    describe('post project endpoint', function () {
        beforeEach(() => {
            mockStdlib.protect.mockImplementation(() => {})
        })

        it('should return 201 when posting new project and all is fine', async () => {
            const adminInterface = {
                Admin: ({ log, onReady }) => {
                    log('ready')
                    onReady('contract')
                }
            }
            const adminSpy = jest.spyOn(adminInterface, 'Admin')
            mockStdlib.newAccountFromMnemonic.mockImplementation(() => ({
                networkAccount: {},
                contract: () => ({
                    p: adminInterface
                })
            }))

            const response = await request(app.callback()).post('/project').send({
                name: 'project name',
                url: 'project url',
                hash: 'project hash',
                creator: 'project creator'
            })

            expect(adminSpy).toHaveBeenCalledTimes(1)
            expect(adminSpy).toHaveBeenCalledWith(
                expect.objectContaining({
                    name: 'project name',
                    url: 'project url',
                    hash: 'project hash',
                    creator: 'project creator'
                })
            )

            expect(mockProjectRepository.createProject).toHaveBeenCalledTimes(1)
            expect(mockProjectRepository.createProject).toHaveBeenCalledWith('ImNvbnRyYWN0Ig==', 'project creator')

            expect(response.status).toBe(201)
            expect(response.body).toEqual({
                contractInfo: 'ImNvbnRyYWN0Ig=='
            })
        })

        it('should return 500 when deploying contract fails', async () => {
            mockStdlib.newAccountFromMnemonic.mockImplementation(() => ({
                networkAccount: {},
                contract: () => {
                    throw new Error()
                }
            }))

            const response = await request(app.callback()).post('/project').send({
                name: 'project name',
                url: 'project url',
                hash: 'project hash',
                creator: 'project creator'
            })

            expect(response.status).toBe(500)
            expect(response.body).toEqual({
                error: 'DeployContractError',
                message: 'Unable to deploy project contract'
            })
        })

        it('should return 500 when retrieving contract info fails', async () => {
            mockStdlib.newAccountFromMnemonic.mockImplementation(() => ({
                networkAccount: {},
                contract: () => ({
                    p: {
                        Admin: ({ onReady }) => onReady(/* undefined contract */)
                    }
                })
            }))

            const response = await request(app.callback()).post('/project').send({
                name: 'project name',
                url: 'project url',
                hash: 'project hash',
                creator: 'project creator'
            })

            expect(response.status).toBe(500)
            expect(response.body).toEqual({
                error: 'DeployContractError',
                message: 'Unable to deploy project contract'
            })
        })

        it('should return 500 when saving contract in repository fails', async () => {
            mockProjectRepository.createProject.mockImplementation(() => {
                throw new Error()
            })

            mockStdlib.newAccountFromMnemonic.mockImplementation(() => ({
                networkAccount: {},
                contract: () => ({
                    p: {
                        Admin: ({ log, onReady }) => {
                            log('ready')
                            onReady('contract')
                        }
                    }
                })
            }))

            const response = await request(app.callback()).post('/project').send({
                name: 'project name',
                url: 'project url',
                hash: 'project hash',
                creator: 'project creator'
            })

            expect(response.status).toBe(500)
            expect(response.body).toEqual({
                error: 'DeployContractError',
                message: 'Unable to deploy project contract'
            })
        })

        it('should return 400 when project name is missing', async () => {
            const response = await request(app.callback()).post('/project').send({
                url: 'project url',
                hash: 'project hash',
                creator: 'project creator'
            })

            expect(response.status).toBe(400)
            expect(response.body).toEqual({
                error: 'MissingParameterError',
                message: 'name must be specified'
            })
        })

        it('should return 400 when project url is missing', async () => {
            const response = await request(app.callback()).post('/project').send({
                name: 'project name',
                hash: 'project hash',
                creator: 'project creator'
            })

            expect(response.status).toBe(400)
            expect(response.body).toEqual({
                error: 'MissingParameterError',
                message: 'url must be specified'
            })
        })

        it('should return 400 when project hash is missing', async () => {
            const response = await request(app.callback()).post('/project').send({
                name: 'project name',
                url: 'project url',
                creator: 'project creator'
            })

            expect(response.status).toBe(400)
            expect(response.body).toEqual({
                error: 'MissingParameterError',
                message: 'hash must be specified'
            })
        })

        it('should return 400 when project creator is missing', async () => {
            const response = await request(app.callback()).post('/project').send({
                name: 'project name',
                url: 'project url',
                hash: 'project hash'
            })

            expect(response.status).toBe(400)
            expect(response.body).toEqual({
                error: 'MissingParameterError',
                message: 'creator must be specified'
            })
        })

        it('should return 400 when project name is too long', async () => {
            const response = await request(app.callback())
                .post('/project')
                .send({
                    name: '#'.repeat(129),
                    url: 'project url',
                    hash: 'project hash',
                    creator: 'project creator'
                })

            expect(response.status).toBe(400)
            expect(response.body).toEqual({
                error: 'ParameterTooLongError',
                message: 'name is too long'
            })
        })

        it('should return 400 when project url is too long', async () => {
            const response = await request(app.callback())
                .post('/project')
                .send({
                    name: 'project name',
                    url: '#'.repeat(129),
                    hash: 'project hash',
                    creator: 'project creator'
                })

            expect(response.status).toBe(400)
            expect(response.body).toEqual({
                error: 'ParameterTooLongError',
                message: 'url is too long'
            })
        })

        it('should return 400 when project hash is too long', async () => {
            const response = await request(app.callback())
                .post('/project')
                .send({
                    name: 'project name',
                    url: 'project url',
                    hash: '#'.repeat(33),
                    creator: 'project creator'
                })

            expect(response.status).toBe(400)
            expect(response.body).toEqual({
                error: 'ParameterTooLongError',
                message: 'hash is too long'
            })
        })

        it('should return 400 when project creator is too long', async () => {
            const response = await request(app.callback())
                .post('/project')
                .send({
                    name: 'project name',
                    url: 'project url',
                    hash: 'project hash',
                    creator: '#'.repeat(65)
                })

            expect(response.status).toBe(400)
            expect(response.body).toEqual({
                error: 'ParameterTooLongError',
                message: 'creator is too long'
            })
        })

        it('should return 400 when project creator is malformed', async () => {
            mockStdlib.protect.mockImplementation(() => {
                throw new Error()
            })

            const response = await request(app.callback()).post('/project').send({
                name: 'project name',
                url: 'project url',
                hash: 'project hash',
                creator: 'project creator'
            })

            expect(response.status).toBe(400)
            expect(response.body).toEqual({
                error: 'AddressMalformedError',
                message: 'The specified address is malformed'
            })
        })
    })
})
