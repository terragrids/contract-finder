import { app } from './app.js'
import request from 'supertest'

const mockStdlib = {
    setProviderByName: jest.fn().mockImplementation(() => jest.fn()),
    getProvider: jest.fn().mockImplementation(() => jest.fn()),
    newAccountFromMnemonic: jest.fn().mockImplementation(() => jest.fn()),
    createAccount: jest.fn().mockImplementation(() => jest.fn()),
    protect: jest.fn().mockImplementation(() => jest.fn()),
    formatAddress: jest.fn().mockImplementation(() => jest.fn()),
    launchToken: jest.fn().mockImplementation(() => jest.fn())
}

jest.mock('./provider/reach-provider.js', () =>
    jest.fn().mockImplementation(() => ({
        getStdlib: jest.fn().mockImplementation(() => ({
            setProviderByName: mockStdlib.setProviderByName,
            getProvider: mockStdlib.getProvider,
            newAccountFromMnemonic: mockStdlib.newAccountFromMnemonic,
            createAccount: mockStdlib.createAccount,
            protect: mockStdlib.protect,
            formatAddress: mockStdlib.formatAddress,
            launchToken: mockStdlib.launchToken
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
    createProject: jest.fn().mockImplementation(() => jest.fn()),
    updateProject: jest.fn().mockImplementation(() => jest.fn()),
    getProject: jest.fn().mockImplementation(() => jest.fn()),
    getProjects: jest.fn().mockImplementation(() => jest.fn()),
    getProjectsByCreator: jest.fn().mockImplementation(() => jest.fn())
}
jest.mock('./repository/project.repository.js', () =>
    jest.fn().mockImplementation(() => ({
        createProject: mockProjectRepository.createProject,
        updateProject: mockProjectRepository.updateProject,
        getProject: mockProjectRepository.getProject,
        getProjects: mockProjectRepository.getProjects,
        getProjectsByCreator: mockProjectRepository.getProjectsByCreator
    }))
)

jest.mock('../reach/project-contract/build/index.main.mjs', () => jest.fn().mockImplementation(() => ({})))

import authHandler from './middleware/auth-handler.js'
jest.mock('./middleware/auth-handler.js')

import { algorandAddressFromCID, cidFromAlgorandAddress } from './utils/token-utils.js'

jest.mock('./utils/token-utils.js', () => ({
    algorandAddressFromCID: jest.fn().mockImplementation(() => ''),
    cidFromAlgorandAddress: jest.fn().mockImplementation(() => '')
}))

const mockAlgoIndexer = {
    callAlgonodeIndexerEndpoint: jest.fn().mockImplementation(() => jest.fn())
}
jest.mock('./network/algo-indexer.js', () =>
    jest.fn().mockImplementation(() => ({
        callAlgonodeIndexerEndpoint: mockAlgoIndexer.callAlgonodeIndexerEndpoint
    }))
)

describe('app', function () {
    const OLD_ENV = process.env

    beforeEach(() => {
        jest.clearAllMocks()
        authHandler.mockImplementation(async (ctx, next) => {
            ctx.state.account = 'project creator'
            await next()
        })
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

    describe('post project token endpoint', function () {
        it('should return 201 when posting new project token and all is fine', async () => {
            mockStdlib.newAccountFromMnemonic.mockImplementation(() => ({
                networkAccount: { addr: 'wallet_address' }
            }))

            mockStdlib.launchToken.mockImplementation(() => ({
                id: { toNumber: () => 1234 }
            }))

            algorandAddressFromCID.mockImplementation(() => ({ address: 'reserve_address', url: 'token_url' }))
            cidFromAlgorandAddress.mockImplementation(() => 'project cid')

            const response = await request(app.callback()).post('/projects/token').send({
                name: 'project name',
                cid: 'project cid'
            })

            expect(mockStdlib.launchToken).toHaveBeenCalledTimes(1)
            expect(mockStdlib.launchToken).toHaveBeenCalledWith({ networkAccount: { addr: 'wallet_address' } }, 'project name', 'TRPRJ', {
                decimals: 0,
                manager: 'wallet_address',
                reserve: 'reserve_address',
                supply: 1,
                url: 'token_url'
            })

            expect(response.status).toBe(201)
            expect(response.body).toEqual({
                id: 1234
            })
        })

        it('should return 500 when launch token fails', async () => {
            mockStdlib.launchToken.mockImplementation(() => {
                throw new Error()
            })

            const response = await request(app.callback()).post('/projects/token').send({
                name: 'project name',
                cid: 'project cid'
            })

            expect(response.status).toBe(500)
            expect(response.body).toEqual({
                error: 'MintTokenError',
                message: 'Unable to mint token'
            })
        })

        it('should return 500 when cid verification fails', async () => {
            algorandAddressFromCID.mockImplementation(() => ({ address: 'reserve_address', url: 'token_url' }))
            cidFromAlgorandAddress.mockImplementation(() => 'project meh')

            const response = await request(app.callback()).post('/projects/token').send({
                name: 'project name',
                cid: 'project cid'
            })

            expect(response.status).toBe(500)
            expect(response.body).toEqual({
                error: 'MintTokenError',
                message: 'Unable to mint token'
            })
        })

        it('should return 400 when project name is missing', async () => {
            const response = await request(app.callback()).post('/projects/token').send({
                cid: 'project cid'
            })

            expect(response.status).toBe(400)
            expect(response.body).toEqual({
                error: 'MissingParameterError',
                message: 'name must be specified'
            })
        })

        it('should return 400 when project cid is missing', async () => {
            const response = await request(app.callback()).post('/projects/token').send({
                name: 'project name'
            })

            expect(response.status).toBe(400)
            expect(response.body).toEqual({
                error: 'MissingParameterError',
                message: 'cid must be specified'
            })
        })

        it('should return 400 when project name is too long', async () => {
            const response = await request(app.callback())
                .post('/projects/token')
                .send({
                    name: '#'.repeat(129),
                    cid: 'project cid'
                })

            expect(response.status).toBe(400)
            expect(response.body).toEqual({
                error: 'ParameterTooLongError',
                message: 'name is too long'
            })
        })
    })

    describe('post project endpoint', function () {
        beforeEach(() => {
            mockStdlib.protect.mockImplementation(() => {})
        })

        it('should return 201 when posting new project and all is fine', async () => {
            mockStdlib.launchToken.mockImplementation(() => ({
                id: { toNumber: () => 1234 }
            }))

            algorandAddressFromCID.mockImplementation(() => ({ address: 'reserve_address', url: 'token_url' }))
            cidFromAlgorandAddress.mockImplementation(() => 'project cid')

            const adminInterface = {
                Admin: ({ log, onReady }) => {
                    log('ready')
                    onReady('contract')
                }
            }
            const adminSpy = jest.spyOn(adminInterface, 'Admin')
            mockStdlib.newAccountFromMnemonic.mockImplementation(() => ({
                networkAccount: { addr: 'wallet_address' },
                contract: () => ({
                    p: adminInterface
                })
            }))

            const response = await request(app.callback()).post('/projects').send({
                name: 'project name',
                cid: 'project cid',
                creator: 'project creator',
                offChainImageUrl: 'image url'
            })

            expect(mockStdlib.launchToken).toHaveBeenCalledTimes(1)
            expect(mockStdlib.launchToken).toHaveBeenCalledWith(expect.any(Object), 'project name', 'TRPRJ', {
                decimals: 0,
                manager: 'wallet_address',
                reserve: 'reserve_address',
                supply: 1,
                url: 'token_url'
            })

            expect(adminSpy).toHaveBeenCalledTimes(1)
            expect(adminSpy).toHaveBeenCalledWith(
                expect.objectContaining({
                    creator: 'project creator',
                    token: 1234
                })
            )

            expect(mockProjectRepository.createProject).toHaveBeenCalledTimes(1)
            expect(mockProjectRepository.createProject).toHaveBeenCalledWith({
                contractId: 'ImNvbnRyYWN0Ig==',
                creator: 'project creator',
                name: 'project name',
                offChainImageUrl: 'image url',
                tokenId: 1234
            })

            expect(response.status).toBe(201)
            expect(response.body).toEqual({
                contractInfo: 'ImNvbnRyYWN0Ig==',
                tokenId: 1234
            })
        })

        it('should return 500 when launch token fails', async () => {
            mockStdlib.launchToken.mockImplementation(() => {
                throw new Error()
            })

            const response = await request(app.callback()).post('/projects').send({
                name: 'project name',
                cid: 'project cid',
                creator: 'project creator',
                offChainImageUrl: 'image url'
            })

            expect(response.status).toBe(500)
            expect(response.body).toEqual({
                error: 'MintTokenError',
                message: 'Unable to mint token'
            })
        })

        it('should return 500 when cid verification fails', async () => {
            algorandAddressFromCID.mockImplementation(() => ({ address: 'reserve_address', url: 'token_url' }))
            cidFromAlgorandAddress.mockImplementation(() => 'project meh')

            const response = await request(app.callback()).post('/projects').send({
                name: 'project name',
                cid: 'project cid',
                creator: 'project creator',
                offChainImageUrl: 'image url'
            })

            expect(response.status).toBe(500)
            expect(response.body).toEqual({
                error: 'MintTokenError',
                message: 'Unable to mint token'
            })
        })

        it('should return 500 when deploying contract fails', async () => {
            mockStdlib.launchToken.mockImplementation(() => ({
                id: { toNumber: () => 1234 }
            }))

            algorandAddressFromCID.mockImplementation(() => ({ address: 'reserve_address', url: 'token_url' }))
            cidFromAlgorandAddress.mockImplementation(() => 'project cid')

            mockStdlib.newAccountFromMnemonic.mockImplementation(() => ({
                networkAccount: { addr: 'wallet_address' },
                contract: () => {
                    throw new Error()
                }
            }))

            const response = await request(app.callback()).post('/projects').send({
                name: 'project name',
                cid: 'project cid',
                creator: 'project creator',
                offChainImageUrl: 'image url'
            })

            expect(response.status).toBe(500)
            expect(response.body).toEqual({
                error: 'DeployContractError',
                message: 'Unable to deploy project contract'
            })
        })

        it('should return 500 when retrieving contract info fails', async () => {
            mockStdlib.launchToken.mockImplementation(() => ({
                id: { toNumber: () => 1234 }
            }))

            algorandAddressFromCID.mockImplementation(() => ({ address: 'reserve_address', url: 'token_url' }))
            cidFromAlgorandAddress.mockImplementation(() => 'project cid')

            mockStdlib.newAccountFromMnemonic.mockImplementation(() => ({
                networkAccount: { addr: 'wallet_address' },
                contract: () => ({
                    p: {
                        Admin: ({ onReady }) => onReady(/* undefined contract */)
                    }
                })
            }))

            const response = await request(app.callback()).post('/projects').send({
                name: 'project name',
                cid: 'project cid',
                creator: 'project creator',
                offChainImageUrl: 'image url'
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

            mockStdlib.launchToken.mockImplementation(() => ({
                id: { toNumber: () => 1234 }
            }))

            algorandAddressFromCID.mockImplementation(() => ({ address: 'reserve_address', url: 'token_url' }))
            cidFromAlgorandAddress.mockImplementation(() => 'project cid')

            mockStdlib.newAccountFromMnemonic.mockImplementation(() => ({
                networkAccount: { addr: 'wallet_address' },
                contract: () => ({
                    p: {
                        Admin: ({ log, onReady }) => {
                            log('ready')
                            onReady('contract')
                        }
                    }
                })
            }))

            const response = await request(app.callback()).post('/projects').send({
                name: 'project name',
                cid: 'project cid',
                creator: 'project creator',
                offChainImageUrl: 'image url'
            })

            expect(response.status).toBe(500)
            expect(response.body).toEqual({
                error: 'DeployContractError',
                message: 'Unable to deploy project contract'
            })
        })

        it('should return 400 when project name is missing', async () => {
            const response = await request(app.callback()).post('/projects').send({
                cid: 'project cid',
                creator: 'project creator',
                offChainImageUrl: 'image url'
            })

            expect(response.status).toBe(400)
            expect(response.body).toEqual({
                error: 'MissingParameterError',
                message: 'name must be specified'
            })
        })

        it('should return 400 when project cid is missing', async () => {
            const response = await request(app.callback()).post('/projects').send({
                name: 'project name',
                creator: 'project creator',
                offChainImageUrl: 'image url'
            })

            expect(response.status).toBe(400)
            expect(response.body).toEqual({
                error: 'MissingParameterError',
                message: 'cid must be specified'
            })
        })

        it('should return 400 when project offChainImageUrl is missing', async () => {
            const response = await request(app.callback()).post('/projects').send({
                name: 'project name',
                cid: 'project cid',
                creator: 'project creator'
            })

            expect(response.status).toBe(400)
            expect(response.body).toEqual({
                error: 'MissingParameterError',
                message: 'offChainImageUrl must be specified'
            })
        })

        it('should return 400 when project creator is missing', async () => {
            const response = await request(app.callback()).post('/projects').send({
                name: 'project name',
                cid: 'project cid',
                offChainImageUrl: 'image url'
            })

            expect(response.status).toBe(400)
            expect(response.body).toEqual({
                error: 'MissingParameterError',
                message: 'creator must be specified'
            })
        })

        it('should return 403 when project creator is not the authenticated user', async () => {
            authHandler.mockImplementation(async (ctx, next) => {
                ctx.state.account = 'bogus user'
                await next()
            })

            const response = await request(app.callback()).post('/projects').send({
                name: 'project name',
                cid: 'project cid',
                creator: 'project creator',
                offChainImageUrl: 'image url'
            })

            expect(response.status).toBe(403)
            expect(response.body).toEqual({
                error: 'UserUnauthorizedError',
                message: 'The authenticated user is not authorized to perform this action'
            })
        })

        it('should return 400 when project name is too long', async () => {
            const response = await request(app.callback())
                .post('/projects')
                .send({
                    name: '#'.repeat(129),
                    cid: 'project cid',
                    creator: 'project creator',
                    offChainImageUrl: 'image url'
                })

            expect(response.status).toBe(400)
            expect(response.body).toEqual({
                error: 'ParameterTooLongError',
                message: 'name is too long'
            })
        })

        it('should return 400 when project offChainImageUrl is too long', async () => {
            const response = await request(app.callback())
                .post('/projects')
                .send({
                    name: 'project name',
                    cid: 'project cid',
                    creator: 'project creator',
                    offChainImageUrl: '#'.repeat(129)
                })

            expect(response.status).toBe(400)
            expect(response.body).toEqual({
                error: 'ParameterTooLongError',
                message: 'offChainImageUrl is too long'
            })
        })

        it('should return 400 when project creator is too long', async () => {
            const response = await request(app.callback())
                .post('/projects')
                .send({
                    name: 'project name',
                    cid: 'project cid',
                    offChainImageUrl: 'project url',
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

            const response = await request(app.callback()).post('/projects').send({
                name: 'project name',
                cid: 'project cid',
                creator: 'project creator',
                offChainImageUrl: 'image url'
            })

            expect(response.status).toBe(400)
            expect(response.body).toEqual({
                error: 'AddressMalformedError',
                message: 'The specified address is malformed'
            })
        })
    })

    describe('update project endpoint', function () {
        it('should return 204 when updating all project properties and all is fine', async () => {
            mockProjectRepository.getProject.mockImplementation(() => ({
                id: 'eyJ0eXBlIjoiQmlnTnVtYmVyIiwiaGV4IjoiMHgwNmZkMmIzMyJ9',
                creator: 'project creator'
            }))

            const contractApi = {
                Api: {
                    updateName: jest.fn().mockImplementation(async () => Promise.resolve()),
                    updateMetadata: jest.fn().mockImplementation(async () => Promise.resolve())
                }
            }
            mockStdlib.newAccountFromMnemonic.mockImplementation(() => ({
                networkAccount: {},
                contract: () => ({
                    a: contractApi
                })
            }))

            const response = await request(app.callback()).put('/projects/contract-id').send({
                name: 'project name',
                url: 'project url',
                hash: 'project hash',
                offChainImageUrl: 'off-chain url'
            })

            expect(mockProjectRepository.getProject).toHaveBeenCalledTimes(1)
            expect(mockProjectRepository.getProject).toHaveBeenCalledWith('contract-id')

            expect(mockProjectRepository.updateProject).toHaveBeenCalledTimes(1)
            expect(mockProjectRepository.updateProject).toHaveBeenCalledWith({
                contractId: 'contract-id',
                name: 'project name',
                offChainImageUrl: 'off-chain url'
            })

            expect(contractApi.Api.updateName).toHaveBeenCalledTimes(1)
            expect(contractApi.Api.updateName).toHaveBeenCalledWith('project name')

            expect(contractApi.Api.updateMetadata).toHaveBeenCalledTimes(1)
            expect(contractApi.Api.updateMetadata).toHaveBeenCalledWith('project url', 'project hash')

            expect(response.status).toBe(204)
            expect(response.body).toEqual({})
        })

        it('should return 204 when updating project name and all is fine', async () => {
            mockProjectRepository.getProject.mockImplementation(() => ({
                id: 'eyJ0eXBlIjoiQmlnTnVtYmVyIiwiaGV4IjoiMHgwNmZkMmIzMyJ9',
                creator: 'project creator'
            }))

            const contractApi = {
                Api: {
                    updateName: jest.fn().mockImplementation(async () => Promise.resolve()),
                    updateMetadata: jest.fn().mockImplementation(async () => Promise.resolve())
                }
            }
            mockStdlib.newAccountFromMnemonic.mockImplementation(() => ({
                networkAccount: {},
                contract: () => ({
                    a: contractApi
                })
            }))

            const response = await request(app.callback()).put('/projects/contract-id').send({
                name: 'project name'
            })

            expect(mockProjectRepository.getProject).toHaveBeenCalledTimes(1)
            expect(mockProjectRepository.getProject).toHaveBeenCalledWith('contract-id')

            expect(contractApi.Api.updateName).toHaveBeenCalledTimes(1)
            expect(contractApi.Api.updateName).toHaveBeenCalledWith('project name')

            expect(contractApi.Api.updateMetadata).not.toHaveBeenCalled()

            expect(response.status).toBe(204)
            expect(response.body).toEqual({})
        })

        it('should return 204 when updating project metadata and all is fine', async () => {
            mockProjectRepository.getProject.mockImplementation(() => ({
                id: 'eyJ0eXBlIjoiQmlnTnVtYmVyIiwiaGV4IjoiMHgwNmZkMmIzMyJ9',
                creator: 'project creator'
            }))

            const contractApi = {
                Api: {
                    updateName: jest.fn().mockImplementation(async () => Promise.resolve()),
                    updateMetadata: jest.fn().mockImplementation(async () => Promise.resolve())
                }
            }
            mockStdlib.newAccountFromMnemonic.mockImplementation(() => ({
                networkAccount: {},
                contract: () => ({
                    a: contractApi
                })
            }))

            const response = await request(app.callback()).put('/projects/contract-id').send({
                url: 'project url',
                hash: 'project hash'
            })

            expect(mockProjectRepository.getProject).toHaveBeenCalledTimes(1)
            expect(mockProjectRepository.getProject).toHaveBeenCalledWith('contract-id')

            expect(contractApi.Api.updateName).not.toHaveBeenCalled()

            expect(contractApi.Api.updateMetadata).toHaveBeenCalledTimes(1)
            expect(contractApi.Api.updateMetadata).toHaveBeenCalledWith('project url', 'project hash')

            expect(response.status).toBe(204)
            expect(response.body).toEqual({})
        })

        it('should return 204 when updating no project properties', async () => {
            mockProjectRepository.getProject.mockImplementation(() => ({
                id: 'eyJ0eXBlIjoiQmlnTnVtYmVyIiwiaGV4IjoiMHgwNmZkMmIzMyJ9',
                creator: 'project creator'
            }))

            const contractApi = {
                Api: {
                    updateName: jest.fn(),
                    updateMetadata: jest.fn()
                }
            }
            mockStdlib.newAccountFromMnemonic.mockImplementation(() => ({
                networkAccount: {},
                contract: () => ({
                    a: contractApi
                })
            }))

            const response = await request(app.callback()).put('/projects/contract-id')

            expect(mockProjectRepository.getProject).not.toHaveBeenCalled()
            expect(contractApi.Api.updateName).not.toHaveBeenCalled()
            expect(contractApi.Api.updateMetadata).not.toHaveBeenCalled()

            expect(response.status).toBe(204)
            expect(response.body).toEqual({})
        })

        it('should return 403 when updating project with unauthorized user', async () => {
            authHandler.mockImplementation(async (ctx, next) => {
                ctx.state.account = 'bogus user'
                await next()
            })

            mockProjectRepository.getProject.mockImplementation(() => ({
                id: 'eyJ0eXBlIjoiQmlnTnVtYmVyIiwiaGV4IjoiMHgwNmZkMmIzMyJ9',
                creator: 'project creator'
            }))

            const contractApi = {
                Api: {
                    updateName: jest.fn(),
                    updateMetadata: jest.fn()
                }
            }
            mockStdlib.newAccountFromMnemonic.mockImplementation(() => ({
                networkAccount: {},
                contract: () => ({
                    a: contractApi
                })
            }))

            const response = await request(app.callback()).put('/projects/contract-id').send({
                name: 'project name',
                url: 'project url',
                hash: 'project hash',
                offChainImageUrl: 'off-chain url'
            })

            expect(mockProjectRepository.getProject).toHaveBeenCalledTimes(1)
            expect(mockProjectRepository.getProject).toHaveBeenCalledWith('contract-id')

            expect(mockProjectRepository.updateProject).not.toHaveBeenCalled()
            expect(contractApi.Api.updateName).not.toHaveBeenCalled()
            expect(contractApi.Api.updateMetadata).not.toHaveBeenCalled()

            expect(response.status).toBe(403)
            expect(response.body).toEqual({
                error: 'UserUnauthorizedError',
                message: 'The authenticated user is not authorized to perform this action'
            })
        })

        it('should return 400 when updating url project property without hash', async () => {
            mockProjectRepository.getProject.mockImplementation(() => ({
                id: 'eyJ0eXBlIjoiQmlnTnVtYmVyIiwiaGV4IjoiMHgwNmZkMmIzMyJ9'
            }))

            const contractApi = {
                Api: {
                    updateName: jest.fn(),
                    updateMetadata: jest.fn()
                }
            }
            mockStdlib.newAccountFromMnemonic.mockImplementation(() => ({
                networkAccount: {},
                contract: () => ({
                    a: contractApi
                })
            }))

            const response = await request(app.callback()).put('/projects/contract-id').send({
                url: 'url'
            })

            expect(mockProjectRepository.getProject).not.toHaveBeenCalled()
            expect(contractApi.Api.updateName).not.toHaveBeenCalled()
            expect(contractApi.Api.updateMetadata).not.toHaveBeenCalled()

            expect(response.status).toBe(400)
            expect(response.body).toEqual({
                error: 'MissingParameterError',
                message: 'hash must be specified'
            })
        })

        it('should return 400 when updating hash project property without url', async () => {
            mockProjectRepository.getProject.mockImplementation(() => ({
                id: 'eyJ0eXBlIjoiQmlnTnVtYmVyIiwiaGV4IjoiMHgwNmZkMmIzMyJ9'
            }))

            const contractApi = {
                Api: {
                    updateName: jest.fn(),
                    updateMetadata: jest.fn()
                }
            }
            mockStdlib.newAccountFromMnemonic.mockImplementation(() => ({
                networkAccount: {},
                contract: () => ({
                    a: contractApi
                })
            }))

            const response = await request(app.callback()).put('/projects/contract-id').send({
                hash: 'hash'
            })

            expect(mockProjectRepository.getProject).not.toHaveBeenCalled()
            expect(contractApi.Api.updateName).not.toHaveBeenCalled()
            expect(contractApi.Api.updateMetadata).not.toHaveBeenCalled()

            expect(response.status).toBe(400)
            expect(response.body).toEqual({
                error: 'MissingParameterError',
                message: 'url must be specified'
            })
        })

        it('should return 400 when updating too long name project property', async () => {
            mockProjectRepository.getProject.mockImplementation(() => ({
                id: 'eyJ0eXBlIjoiQmlnTnVtYmVyIiwiaGV4IjoiMHgwNmZkMmIzMyJ9'
            }))

            const contractApi = {
                Api: {
                    updateName: jest.fn(),
                    updateMetadata: jest.fn()
                }
            }
            mockStdlib.newAccountFromMnemonic.mockImplementation(() => ({
                networkAccount: {},
                contract: () => ({
                    a: contractApi
                })
            }))

            const response = await request(app.callback())
                .put('/projects/contract-id')
                .send({
                    name: '#'.repeat(129)
                })

            expect(mockProjectRepository.getProject).not.toHaveBeenCalled()
            expect(contractApi.Api.updateName).not.toHaveBeenCalled()
            expect(contractApi.Api.updateMetadata).not.toHaveBeenCalled()

            expect(response.status).toBe(400)
            expect(response.body).toEqual({
                error: 'ParameterTooLongError',
                message: 'name is too long'
            })
        })

        it('should return 400 when updating too long off-chain url project property', async () => {
            mockProjectRepository.getProject.mockImplementation(() => ({
                id: 'eyJ0eXBlIjoiQmlnTnVtYmVyIiwiaGV4IjoiMHgwNmZkMmIzMyJ9'
            }))

            const contractApi = {
                Api: {
                    updateName: jest.fn(),
                    updateMetadata: jest.fn()
                }
            }
            mockStdlib.newAccountFromMnemonic.mockImplementation(() => ({
                networkAccount: {},
                contract: () => ({
                    a: contractApi
                })
            }))

            const response = await request(app.callback())
                .put('/projects/contract-id')
                .send({
                    offChainImageUrl: '#'.repeat(129)
                })

            expect(mockProjectRepository.getProject).not.toHaveBeenCalled()
            expect(contractApi.Api.updateName).not.toHaveBeenCalled()
            expect(contractApi.Api.updateMetadata).not.toHaveBeenCalled()

            expect(response.status).toBe(400)
            expect(response.body).toEqual({
                error: 'ParameterTooLongError',
                message: 'offChainImageUrl is too long'
            })
        })

        it('should return 400 when updating too long url project property', async () => {
            mockProjectRepository.getProject.mockImplementation(() => ({
                id: 'eyJ0eXBlIjoiQmlnTnVtYmVyIiwiaGV4IjoiMHgwNmZkMmIzMyJ9'
            }))

            const contractApi = {
                Api: {
                    updateName: jest.fn(),
                    updateMetadata: jest.fn()
                }
            }
            mockStdlib.newAccountFromMnemonic.mockImplementation(() => ({
                networkAccount: {},
                contract: () => ({
                    a: contractApi
                })
            }))

            const response = await request(app.callback())
                .put('/projects/contract-id')
                .send({
                    url: '#'.repeat(129),
                    hash: 'hash'
                })

            expect(mockProjectRepository.getProject).not.toHaveBeenCalled()
            expect(contractApi.Api.updateName).not.toHaveBeenCalled()
            expect(contractApi.Api.updateMetadata).not.toHaveBeenCalled()

            expect(response.status).toBe(400)
            expect(response.body).toEqual({
                error: 'ParameterTooLongError',
                message: 'url is too long'
            })
        })

        it('should return 400 when updating too long hash project property', async () => {
            mockProjectRepository.getProject.mockImplementation(() => ({
                id: 'eyJ0eXBlIjoiQmlnTnVtYmVyIiwiaGV4IjoiMHgwNmZkMmIzMyJ9'
            }))

            const contractApi = {
                Api: {
                    updateName: jest.fn(),
                    updateMetadata: jest.fn()
                }
            }
            mockStdlib.newAccountFromMnemonic.mockImplementation(() => ({
                networkAccount: {},
                contract: () => ({
                    a: contractApi
                })
            }))

            const response = await request(app.callback())
                .put('/projects/contract-id')
                .send({
                    url: 'url',
                    hash: '#'.repeat(65)
                })

            expect(mockProjectRepository.getProject).not.toHaveBeenCalled()
            expect(contractApi.Api.updateName).not.toHaveBeenCalled()
            expect(contractApi.Api.updateMetadata).not.toHaveBeenCalled()

            expect(response.status).toBe(400)
            expect(response.body).toEqual({
                error: 'ParameterTooLongError',
                message: 'hash is too long'
            })
        })

        it('should return 500 when updating project name fails', async () => {
            mockProjectRepository.getProject.mockImplementation(() => ({
                id: 'eyJ0eXBlIjoiQmlnTnVtYmVyIiwiaGV4IjoiMHgwNmZkMmIzMyJ9',
                creator: 'project creator'
            }))

            const contractApi = {
                Api: {
                    updateName: jest.fn().mockImplementation(() => {
                        throw new Error()
                    }),
                    updateMetadata: jest.fn()
                }
            }
            mockStdlib.newAccountFromMnemonic.mockImplementation(() => ({
                networkAccount: {},
                contract: () => ({
                    a: contractApi
                })
            }))

            const response = await request(app.callback()).put('/projects/contract-id').send({
                name: 'name'
            })

            expect(response.status).toBe(500)
            expect(response.body).toEqual({
                error: 'UpdateContractError',
                message: 'Unable to update project contract'
            })
        })

        it('should return 500 when updating project metadata fails', async () => {
            mockProjectRepository.getProject.mockImplementation(() => ({
                id: 'eyJ0eXBlIjoiQmlnTnVtYmVyIiwiaGV4IjoiMHgwNmZkMmIzMyJ9',
                creator: 'project creator'
            }))

            const contractApi = {
                Api: {
                    updateName: jest.fn(),
                    updateMetadata: jest.fn().mockImplementation(() => {
                        throw new Error()
                    })
                }
            }
            mockStdlib.newAccountFromMnemonic.mockImplementation(() => ({
                networkAccount: {},
                contract: () => ({
                    a: contractApi
                })
            }))

            const response = await request(app.callback()).put('/projects/contract-id').send({
                url: 'url',
                hash: 'hash'
            })

            expect(response.status).toBe(500)
            expect(response.body).toEqual({
                error: 'UpdateContractError',
                message: 'Unable to update project contract'
            })
        })
    })

    describe('get project endpoint', function () {
        beforeEach(() => {
            mockStdlib.formatAddress.mockImplementation(address => `formatted ${address}`)
        })

        it('should return 200 when getting project and all is fine', async () => {
            mockProjectRepository.getProject.mockImplementation(() => ({
                id: 'eyJ0eXBlIjoiQmlnTnVtYmVyIiwiaGV4IjoiMHgwNmZkMmIzMyJ9',
                created: 'creation-date',
                creator: 'creator'
            }))

            const view = {
                View: {
                    balance: () => [0, { toNumber: () => 123 }],
                    tokenBalance: () => [0, { toNumber: () => 1 }],
                    token: () => [0, { toNumber: () => 'project token id' }],
                    creator: () => [0, 'project creator']
                }
            }

            mockStdlib.createAccount.mockImplementation(() => ({
                networkAccount: {},
                contract: () => ({
                    v: view
                })
            }))

            mockAlgoIndexer.callAlgonodeIndexerEndpoint.mockImplementation(() => {
                return Promise.resolve({
                    status: 200,
                    json: {
                        asset: {
                            index: 123,
                            params: {
                                name: 'project name',
                                total: 1,
                                decimals: 0,
                                'unit-name': 'TRPRJ',
                                url: 'project url',
                                reserve: 'project reserve'
                            }
                        }
                    }
                })
            })

            const response = await request(app.callback()).get('/projects/contract-id')

            expect(mockProjectRepository.getProject).toHaveBeenCalledTimes(1)
            expect(mockProjectRepository.getProject).toHaveBeenCalledWith('contract-id')

            expect(response.status).toBe(200)
            expect(response.body).toEqual({
                id: 'eyJ0eXBlIjoiQmlnTnVtYmVyIiwiaGV4IjoiMHgwNmZkMmIzMyJ9',
                creator: 'formatted project creator',
                created: 'creation-date',
                name: 'project name',
                url: 'project url',
                reserve: 'project reserve',
                tokenId: 'project token id',
                balance: 123,
                approved: false
            })
        })

        it('should return 500 when getting project and create account fails', async () => {
            mockProjectRepository.getProject.mockImplementation(() => ({
                id: 'eyJ0eXBlIjoiQmlnTnVtYmVyIiwiaGV4IjoiMHgwNmZkMmIzMyJ9',
                creator: 'creator'
            }))

            mockStdlib.createAccount.mockImplementation(() => {
                throw new Error()
            })

            const response = await request(app.callback()).get('/projects/contract-id')

            expect(mockProjectRepository.getProject).toHaveBeenCalledTimes(1)
            expect(mockProjectRepository.getProject).toHaveBeenCalledWith('contract-id')

            expect(response.status).toBe(500)
            expect(response.body).toEqual({
                error: 'ReadContractError',
                message: 'Unable to read project contract'
            })
        })

        it('should return 404 when getting project and token not found', async () => {
            mockProjectRepository.getProject.mockImplementation(() => ({
                id: 'eyJ0eXBlIjoiQmlnTnVtYmVyIiwiaGV4IjoiMHgwNmZkMmIzMyJ9',
                created: 'creation-date',
                creator: 'creator'
            }))

            const view = {
                View: {
                    balance: () => [0, { toNumber: () => 123 }],
                    tokenBalance: () => [0, { toNumber: () => 0 }],
                    token: () => [0, { toNumber: () => 'project token id' }],
                    creator: () => [0, 'project creator']
                }
            }

            mockStdlib.createAccount.mockImplementation(() => ({
                networkAccount: {},
                contract: () => ({
                    v: view
                })
            }))

            mockAlgoIndexer.callAlgonodeIndexerEndpoint.mockImplementation(() => {
                return Promise.resolve({
                    status: 200,
                    json: {
                        asset: {
                            index: 123,
                            deleted: true,
                            params: {
                                name: 'project name',
                                total: 1,
                                decimals: 0,
                                'unit-name': 'TRPRJ',
                                url: 'project url',
                                reserve: 'project reserve'
                            }
                        }
                    }
                })
            })

            const response = await request(app.callback()).get('/projects/contract-id')

            expect(mockProjectRepository.getProject).toHaveBeenCalledTimes(1)
            expect(mockProjectRepository.getProject).toHaveBeenCalledWith('contract-id')

            expect(response.status).toBe(404)
            expect(response.body).toEqual({
                error: 'AssetNotFoundError',
                message: 'Asset specified not found'
            })
        })

        it('should return 404 when getting project and token deleted', async () => {
            mockProjectRepository.getProject.mockImplementation(() => ({
                id: 'eyJ0eXBlIjoiQmlnTnVtYmVyIiwiaGV4IjoiMHgwNmZkMmIzMyJ9',
                created: 'creation-date',
                creator: 'creator'
            }))

            const view = {
                View: {
                    balance: () => [0, { toNumber: () => 123 }],
                    tokenBalance: () => [0, { toNumber: () => 0 }],
                    token: () => [0, { toNumber: () => 'project token id' }],
                    creator: () => [0, 'project creator']
                }
            }

            mockStdlib.createAccount.mockImplementation(() => ({
                networkAccount: {},
                contract: () => ({
                    v: view
                })
            }))

            mockAlgoIndexer.callAlgonodeIndexerEndpoint.mockImplementation(() => {
                return Promise.resolve({
                    status: 404
                })
            })

            const response = await request(app.callback()).get('/projects/contract-id')

            expect(mockProjectRepository.getProject).toHaveBeenCalledTimes(1)
            expect(mockProjectRepository.getProject).toHaveBeenCalledWith('contract-id')

            expect(response.status).toBe(404)
            expect(response.body).toEqual({
                error: 'AssetNotFoundError',
                message: 'Asset specified not found'
            })
        })
    })

    describe('get projects endpoint', function () {
        it('should return 200 when getting projects and all is fine', async () => {
            mockProjectRepository.getProjects.mockImplementation(() => ({
                projects: [
                    {
                        id: 'contract-id-1',
                        created: 'contract-date-1'
                    },
                    {
                        id: 'contract-id-2',
                        created: 'contract-date-2'
                    }
                ]
            }))

            const response = await request(app.callback()).get('/projects?sort=asc&pageSize=12&nextPageKey=page-key')

            expect(mockProjectRepository.getProjects).toHaveBeenCalledTimes(1)
            expect(mockProjectRepository.getProjects).toHaveBeenCalledWith({
                sort: 'asc',
                nextPageKey: 'page-key',
                pageSize: '12'
            })

            expect(response.status).toBe(200)
            expect(response.body).toEqual({
                projects: [
                    {
                        id: 'contract-id-1',
                        created: 'contract-date-1'
                    },
                    {
                        id: 'contract-id-2',
                        created: 'contract-date-2'
                    }
                ]
            })
        })
    })

    describe('get projects by creator endpoint', function () {
        it('should return 200 when getting projects and all is fine', async () => {
            mockProjectRepository.getProjectsByCreator.mockImplementation(() => ({
                projects: [
                    {
                        id: 'contract-id-1',
                        created: 'contract-date-1'
                    },
                    {
                        id: 'contract-id-2',
                        created: 'contract-date-2'
                    }
                ]
            }))

            const response = await request(app.callback()).get('/creators/creator-id/projects?sort=asc&pageSize=12&nextPageKey=page-key')

            expect(mockProjectRepository.getProjectsByCreator).toHaveBeenCalledTimes(1)
            expect(mockProjectRepository.getProjectsByCreator).toHaveBeenCalledWith({
                creator: 'creator-id',
                sort: 'asc',
                nextPageKey: 'page-key',
                pageSize: '12'
            })

            expect(response.status).toBe(200)
            expect(response.body).toEqual({
                projects: [
                    {
                        id: 'contract-id-1',
                        created: 'contract-date-1'
                    },
                    {
                        id: 'contract-id-2',
                        created: 'contract-date-2'
                    }
                ]
            })
        })
    })
})
