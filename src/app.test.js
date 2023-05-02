import { app } from './app.js'
import request from 'supertest'

const mockStdlib = {
    setProviderByName: jest.fn().mockImplementation(() => jest.fn()),
    getProvider: jest.fn().mockImplementation(() => jest.fn()),
    newAccountFromMnemonic: jest.fn().mockImplementation(() => jest.fn()),
    createAccount: jest.fn().mockImplementation(() => jest.fn()),
    protect: jest.fn().mockImplementation(() => jest.fn()),
    formatAddress: jest.fn().mockImplementation(() => jest.fn()),
    launchToken: jest.fn().mockImplementation(() => jest.fn()),
    algosdk: jest.fn().mockImplementation(() => jest.fn()),
    makeAssetConfigTxnWithSuggestedParamsFromObject: jest.fn().mockImplementation(() => jest.fn()),
    waitForConfirmation: jest.fn().mockImplementation(() => jest.fn()),
    tokensAccepted: jest.fn().mockImplementation(() => jest.fn())
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
            launchToken: mockStdlib.launchToken,
            tokensAccepted: mockStdlib.tokensAccepted,
            algosdk: {
                makeAssetConfigTxnWithSuggestedParamsFromObject: mockStdlib.makeAssetConfigTxnWithSuggestedParamsFromObject,
                waitForConfirmation: mockStdlib.waitForConfirmation
            }
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

const mockPlaceRepository = {
    createPlace: jest.fn().mockImplementation(() => jest.fn()),
    updatePlace: jest.fn().mockImplementation(() => jest.fn()),
    getPlace: jest.fn().mockImplementation(() => jest.fn()),
    getPlaces: jest.fn().mockImplementation(() => jest.fn()),
    getPlacesByUser: jest.fn().mockImplementation(() => jest.fn()),
    deletePlace: jest.fn().mockImplementation(() => jest.fn()),
    deleteProject: jest.fn().mockImplementation(() => jest.fn()),
    setProjectApproval: jest.fn().mockImplementation(() => jest.fn())
}
jest.mock('./repository/place.repository.js', () =>
    jest.fn().mockImplementation(() => ({
        createPlace: mockPlaceRepository.createPlace,
        updatePlace: mockPlaceRepository.updatePlace,
        getPlace: mockPlaceRepository.getPlace,
        getPlaces: mockPlaceRepository.getPlaces,
        getPlacesByUser: mockPlaceRepository.getPlacesByUser,
        deletePlace: mockPlaceRepository.deletePlace,
        deleteProject: mockPlaceRepository.deleteProject,
        setProjectApproval: mockPlaceRepository.setProjectApproval
    }))
)

const mockUserRepository = {
    getUserById: jest.fn().mockImplementation(() => jest.fn()),
    getUserByOauthId: jest.fn().mockImplementation(() => jest.fn())
}
jest.mock('./repository/user.repository.js', () =>
    jest.fn().mockImplementation(() => ({
        getUserById: mockUserRepository.getUserById,
        getUserByOauthId: mockUserRepository.getUserByOauthId
    }))
)

jest.mock('../reach/project-contract/build/index.main.mjs', () => jest.fn().mockImplementation(() => ({})))

import authHandler from './middleware/auth-handler.js'
jest.mock('./middleware/auth-handler.js')

jest.mock('./middleware/jwt-authorize.js', () =>
    jest.fn().mockImplementation(async (ctx, next) => {
        ctx.state.jwt = { sub: 'jwt_sub' }
        await next()
    })
)

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
            ctx.state.account = 'place user'
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
            expect(response.text).toBe('terragrids place contract api')
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

    describe('post places endpoint', function () {
        beforeEach(() => {
            mockStdlib.protect.mockImplementation(() => {})
        })

        it('should return 201 when posting new place and all is fine', async () => {
            mockStdlib.launchToken.mockImplementation(() => ({
                id: { toNumber: () => 1234 }
            }))

            algorandAddressFromCID.mockImplementation(() => ({ address: 'reserve_address', url: 'token_url' }))
            cidFromAlgorandAddress.mockImplementation(() => 'place cid')

            mockStdlib.newAccountFromMnemonic.mockImplementation(() => ({
                networkAccount: { addr: 'wallet_address' }
            }))

            mockUserRepository.getUserByOauthId.mockImplementation(() => ({
                id: 'user_id'
            }))

            const response = await request(app.callback()).post('/places').send({
                name: 'place name',
                cid: 'place cid',
                offChainImageUrl: 'image url',
                positionX: 0,
                positionY: 3
            })

            expect(mockStdlib.launchToken).toHaveBeenCalledTimes(1)
            expect(mockStdlib.launchToken).toHaveBeenCalledWith(expect.any(Object), 'place name', 'TRPLC', {
                decimals: 0,
                manager: 'wallet_address',
                clawback: 'wallet_address',
                freeze: 'wallet_address',
                reserve: 'reserve_address',
                supply: 1,
                url: 'token_url'
            })

            expect(mockPlaceRepository.createPlace).toHaveBeenCalledTimes(1)
            expect(mockPlaceRepository.createPlace).toHaveBeenCalledWith({
                userId: 'user_id',
                name: 'place name',
                offChainImageUrl: 'image url',
                tokenId: 1234,
                positionX: 0,
                positionY: 3
            })

            expect(response.status).toBe(201)
            expect(response.body).toEqual({
                tokenId: 1234
            })
        })

        it('should return 201 when posting new place with long name', async () => {
            mockStdlib.launchToken.mockImplementation(() => ({
                id: { toNumber: () => 1234 }
            }))

            algorandAddressFromCID.mockImplementation(() => ({ address: 'reserve_address', url: 'token_url' }))
            cidFromAlgorandAddress.mockImplementation(() => 'place cid')

            mockStdlib.newAccountFromMnemonic.mockImplementation(() => ({
                networkAccount: { addr: 'wallet_address' }
            }))

            mockUserRepository.getUserByOauthId.mockImplementation(() => ({
                id: 'user_id'
            }))

            const response = await request(app.callback()).post('/places').send({
                name: 'Louisville and Nashville Railroad Office Building',
                cid: 'place cid',
                creator: 'place user',
                offChainImageUrl: 'image url',
                positionX: 3,
                positionY: 0
            })

            expect(mockStdlib.launchToken).toHaveBeenCalledTimes(1)
            expect(mockStdlib.launchToken).toHaveBeenCalledWith(expect.any(Object), 'Louisville and Nashville Rail…', 'TRPLC', {
                decimals: 0,
                manager: 'wallet_address',
                clawback: 'wallet_address',
                freeze: 'wallet_address',
                reserve: 'reserve_address',
                supply: 1,
                url: 'token_url'
            })

            expect(mockPlaceRepository.createPlace).toHaveBeenCalledTimes(1)
            expect(mockPlaceRepository.createPlace).toHaveBeenCalledWith({
                userId: 'user_id',
                name: 'Louisville and Nashville Railroad Office Building',
                offChainImageUrl: 'image url',
                tokenId: 1234,
                positionX: 3,
                positionY: 0
            })

            expect(response.status).toBe(201)
            expect(response.body).toEqual({
                tokenId: 1234
            })
        })

        it('should return 500 when launch token fails', async () => {
            mockStdlib.launchToken.mockImplementation(() => {
                throw new Error()
            })

            const response = await request(app.callback()).post('/places').send({
                name: 'place name',
                cid: 'place cid',
                offChainImageUrl: 'image url',
                positionX: 3,
                positionY: 0
            })

            expect(response.status).toBe(500)
            expect(response.body).toEqual({
                error: 'MintTokenError',
                message: 'Unable to mint token'
            })
        })

        it('should return 500 when cid verification fails', async () => {
            algorandAddressFromCID.mockImplementation(() => ({ address: 'reserve_address', url: 'token_url' }))
            cidFromAlgorandAddress.mockImplementation(() => 'place meh')

            const response = await request(app.callback()).post('/places').send({
                name: 'place name',
                cid: 'place cid',
                offChainImageUrl: 'image url',
                positionX: 3,
                positionY: 0
            })

            expect(response.status).toBe(500)
            expect(response.body).toEqual({
                error: 'MintTokenError',
                message: 'Unable to mint token'
            })
        })

        it('should return 500 when saving contract in repository fails', async () => {
            mockPlaceRepository.createPlace.mockImplementation(() => {
                throw new Error()
            })

            mockStdlib.launchToken.mockImplementation(() => ({
                id: { toNumber: () => 1234 }
            }))

            algorandAddressFromCID.mockImplementation(() => ({ address: 'reserve_address', url: 'token_url' }))
            cidFromAlgorandAddress.mockImplementation(() => 'place cid')

            mockStdlib.newAccountFromMnemonic.mockImplementation(() => ({
                networkAccount: { addr: 'wallet_address' }
            }))

            const response = await request(app.callback()).post('/places').send({
                name: 'place name',
                cid: 'place cid',
                offChainImageUrl: 'image url',
                positionX: 3,
                positionY: 2
            })

            expect(response.status).toBe(500)
            expect(response.body).toEqual({})
        })

        it('should return 400 when place name is missing', async () => {
            const response = await request(app.callback()).post('/places').send({
                cid: 'place cid',
                offChainImageUrl: 'image url',
                positionX: 3,
                positionY: 2
            })

            expect(response.status).toBe(400)
            expect(response.body).toEqual({
                error: 'MissingParameterError',
                message: 'name must be specified'
            })
        })

        it('should return 400 when place cid is missing', async () => {
            const response = await request(app.callback()).post('/places').send({
                name: 'place name',
                offChainImageUrl: 'image url',
                positionX: 3,
                positionY: 2
            })

            expect(response.status).toBe(400)
            expect(response.body).toEqual({
                error: 'MissingParameterError',
                message: 'cid must be specified'
            })
        })

        it('should return 400 when place offChainImageUrl is missing', async () => {
            const response = await request(app.callback()).post('/places').send({
                name: 'place name',
                cid: 'place cid',
                positionX: 3,
                positionY: 2
            })

            expect(response.status).toBe(400)
            expect(response.body).toEqual({
                error: 'MissingParameterError',
                message: 'offChainImageUrl must be specified'
            })
        })

        it('should return 400 when place positionX is missing', async () => {
            const response = await request(app.callback()).post('/places').send({
                name: 'place name',
                cid: 'place cid',
                offChainImageUrl: 'image url',
                positionY: 2
            })

            expect(response.status).toBe(400)
            expect(response.body).toEqual({
                error: 'TypePositiveOrZeroNumberError',
                message: 'positionX must be zero or a positive number'
            })
        })

        it('should return 400 when place positionX is not valid', async () => {
            const response = await request(app.callback()).post('/places').send({
                name: 'place name',
                cid: 'place cid',
                offChainImageUrl: 'image url',
                positionX: -2,
                positionY: 2
            })

            expect(response.status).toBe(400)
            expect(response.body).toEqual({
                error: 'TypePositiveOrZeroNumberError',
                message: 'positionX must be zero or a positive number'
            })
        })

        it('should return 400 when place positionY is missing', async () => {
            const response = await request(app.callback()).post('/places').send({
                name: 'place name',
                cid: 'place cid',
                offChainImageUrl: 'image url',
                positionX: 2
            })

            expect(response.status).toBe(400)
            expect(response.body).toEqual({
                error: 'TypePositiveOrZeroNumberError',
                message: 'positionY must be zero or a positive number'
            })
        })

        it('should return 400 when place positionY is not valid', async () => {
            const response = await request(app.callback()).post('/places').send({
                name: 'place name',
                cid: 'place cid',
                offChainImageUrl: 'image url',
                positionX: 2,
                positionY: -2
            })

            expect(response.status).toBe(400)
            expect(response.body).toEqual({
                error: 'TypePositiveOrZeroNumberError',
                message: 'positionY must be zero or a positive number'
            })
        })

        it('should return 400 when place name is too long', async () => {
            const response = await request(app.callback())
                .post('/places')
                .send({
                    name: '#'.repeat(129),
                    cid: 'place cid',
                    offChainImageUrl: 'image url',
                    positionX: 3,
                    positionY: 2
                })

            expect(response.status).toBe(400)
            expect(response.body).toEqual({
                error: 'ParameterTooLongError',
                message: 'name is too long'
            })
        })

        it('should return 400 when place offChainImageUrl is too long', async () => {
            const response = await request(app.callback())
                .post('/places')
                .send({
                    name: 'place name',
                    cid: 'place cid',
                    offChainImageUrl: '#'.repeat(129),
                    positionX: 3,
                    positionY: 2
                })

            expect(response.status).toBe(400)
            expect(response.body).toEqual({
                error: 'ParameterTooLongError',
                message: 'offChainImageUrl is too long'
            })
        })
    })

    describe('update place endpoint', function () {
        it('should return 204 when updating all place properties and all is fine', async () => {
            const tokenId = '1234'

            mockUserRepository.getUserByOauthId.mockImplementation(() => ({
                id: 'user-id'
            }))

            mockPlaceRepository.getPlace.mockImplementation(() => ({
                id: tokenId,
                userId: 'user-id'
            }))

            mockStdlib.newAccountFromMnemonic.mockImplementation(() => ({
                networkAccount: { addr: 'wallet_address', sk: 'account_sk' }
            }))

            algorandAddressFromCID.mockImplementation(() => ({ address: 'reserve_address', url: 'token_url' }))
            cidFromAlgorandAddress.mockImplementation(() => 'place cid')

            mockStdlib.getProvider.mockImplementation(() =>
                Promise.resolve({
                    algodClient: {
                        getTransactionParams: () => ({ do: async () => Promise.resolve({ param: 'txn_param' }) }),
                        sendRawTransaction: () => ({ do: async () => Promise.resolve({ txId: 'txn_id' }) })
                    }
                })
            )

            const mockSignedTnx = jest.fn().mockImplementation(() => 'signed_txn')

            mockStdlib.makeAssetConfigTxnWithSuggestedParamsFromObject.mockImplementation(() => ({
                signTxn: mockSignedTnx
            }))

            const response = await request(app.callback()).put(`/places/${tokenId}`).send({
                name: 'place name',
                cid: 'place cid',
                offChainImageUrl: 'off-chain url'
            })

            expect(mockUserRepository.getUserByOauthId).toHaveBeenCalledTimes(1)
            expect(mockUserRepository.getUserByOauthId).toHaveBeenCalledWith('jwt_sub')

            expect(mockPlaceRepository.getPlace).toHaveBeenCalledTimes(1)
            expect(mockPlaceRepository.getPlace).toHaveBeenCalledWith(tokenId)

            expect(mockStdlib.makeAssetConfigTxnWithSuggestedParamsFromObject).toHaveBeenCalledTimes(1)
            expect(mockStdlib.makeAssetConfigTxnWithSuggestedParamsFromObject).toHaveBeenCalledWith({
                assetIndex: 1234,
                clawback: 'wallet_address',
                freeze: 'wallet_address',
                from: 'wallet_address',
                manager: 'wallet_address',
                reserve: 'reserve_address',
                suggestedParams: {
                    param: 'txn_param'
                }
            })

            expect(mockSignedTnx).toHaveBeenCalledTimes(1)
            expect(mockSignedTnx).toHaveBeenCalledWith('account_sk')

            expect(mockStdlib.waitForConfirmation).toHaveBeenCalledTimes(1)
            expect(mockStdlib.waitForConfirmation).toHaveBeenCalledWith(expect.any(Object), 'txn_id', 4)

            expect(mockPlaceRepository.updatePlace).toHaveBeenCalledTimes(1)
            expect(mockPlaceRepository.updatePlace).toHaveBeenCalledWith({
                tokenId: tokenId,
                name: 'place name',
                offChainImageUrl: 'off-chain url'
            })

            expect(response.status).toBe(204)
            expect(response.body).toEqual({})
        })

        it('should return 403 when updating place with unauthorized user', async () => {
            const tokenId = '1234'

            mockUserRepository.getUserByOauthId.mockImplementation(() => ({
                id: 'user-id-1'
            }))

            mockPlaceRepository.getPlace.mockImplementation(() => ({
                id: tokenId,
                userId: 'user-id'
            }))

            const response = await request(app.callback()).put(`/places/${tokenId}`).send({
                name: 'place name',
                cid: 'place cid',
                offChainImageUrl: 'off-chain url'
            })

            expect(mockUserRepository.getUserByOauthId).toHaveBeenCalledTimes(1)
            expect(mockUserRepository.getUserByOauthId).toHaveBeenCalledWith('jwt_sub')

            expect(mockPlaceRepository.getPlace).toHaveBeenCalledTimes(1)
            expect(mockPlaceRepository.getPlace).toHaveBeenCalledWith(tokenId)

            expect(mockPlaceRepository.updatePlace).not.toHaveBeenCalled()

            expect(response.status).toBe(403)
            expect(response.body).toEqual({
                error: 'UserUnauthorizedError',
                message: 'The authenticated user is not authorized to perform this action'
            })
        })

        it('should return 400 when updating url place property without cid', async () => {
            const response = await request(app.callback()).put('/places/1234').send({
                name: 'place name',
                offChainImageUrl: 'off-chain url'
            })

            expect(mockPlaceRepository.getPlace).not.toHaveBeenCalled()

            expect(response.status).toBe(400)
            expect(response.body).toEqual({
                error: 'MissingParameterError',
                message: 'cid must be specified'
            })
        })

        it('should return 400 when updating url place property without off-chain url', async () => {
            const response = await request(app.callback()).put('/places/1234').send({
                name: 'place name',
                cid: 'place cid'
            })

            expect(mockPlaceRepository.getPlace).not.toHaveBeenCalled()

            expect(response.status).toBe(400)
            expect(response.body).toEqual({
                error: 'MissingParameterError',
                message: 'offChainImageUrl must be specified'
            })
        })

        it('should return 400 when updating url place property without name', async () => {
            const response = await request(app.callback()).put('/places/contract-id').send({
                cid: 'place cid',
                offChainImageUrl: 'off-chain url'
            })

            expect(mockPlaceRepository.getPlace).not.toHaveBeenCalled()

            expect(response.status).toBe(400)
            expect(response.body).toEqual({
                error: 'MissingParameterError',
                message: 'name must be specified'
            })
        })

        it('should return 400 when updating too long name place property', async () => {
            const response = await request(app.callback())
                .put('/places/contract-id')
                .send({
                    name: '#'.repeat(129),
                    cid: 'place cid',
                    offChainImageUrl: 'off-chain url'
                })

            expect(mockPlaceRepository.getPlace).not.toHaveBeenCalled()

            expect(response.status).toBe(400)
            expect(response.body).toEqual({
                error: 'ParameterTooLongError',
                message: 'name is too long'
            })
        })

        it('should return 400 when updating too long off-chain url place property', async () => {
            const response = await request(app.callback())
                .put('/places/contract-id')
                .send({
                    name: 'place name',
                    cid: 'place cid',
                    offChainImageUrl: '#'.repeat(129)
                })

            expect(mockPlaceRepository.getPlace).not.toHaveBeenCalled()

            expect(response.status).toBe(400)
            expect(response.body).toEqual({
                error: 'ParameterTooLongError',
                message: 'offChainImageUrl is too long'
            })
        })

        it('should return 500 when cid verification fails', async () => {
            const tokenId = '1234'

            mockUserRepository.getUserByOauthId.mockImplementation(() => ({
                id: 'user-id'
            }))

            mockPlaceRepository.getPlace.mockImplementation(() => ({
                id: tokenId,
                userId: 'user-id'
            }))

            mockStdlib.newAccountFromMnemonic.mockImplementation(() => ({
                networkAccount: { addr: 'wallet_address', sk: 'account_sk' }
            }))

            algorandAddressFromCID.mockImplementation(() => ({ address: 'reserve_address', url: 'token_url' }))
            cidFromAlgorandAddress.mockImplementation(() => 'place meh')

            const response = await request(app.callback()).put(`/places/${tokenId}`).send({
                name: 'place name',
                cid: 'place cid',
                offChainImageUrl: 'off-chain url'
            })

            expect(response.status).toBe(500)
            expect(response.body).toEqual({
                error: 'UpdatePlaceTokenError',
                message: 'Unable to update place token'
            })
        })

        it('should return 500 when asset config transaction fails', async () => {
            const tokenId = '124'

            mockUserRepository.getUserByOauthId.mockImplementation(() => ({
                id: 'user-id'
            }))

            mockPlaceRepository.getPlace.mockImplementation(() => ({
                id: tokenId,
                userId: 'user-id'
            }))

            mockStdlib.newAccountFromMnemonic.mockImplementation(() => ({
                networkAccount: { addr: 'wallet_address', sk: 'account_sk' }
            }))

            algorandAddressFromCID.mockImplementation(() => ({ address: 'reserve_address', url: 'token_url' }))
            cidFromAlgorandAddress.mockImplementation(() => 'place cid')

            mockStdlib.getProvider.mockImplementation(() =>
                Promise.resolve({
                    algodClient: {
                        getTransactionParams: () => ({ do: async () => Promise.resolve({ param: 'txn_param' }) }),
                        sendRawTransaction: () => ({ do: async () => Promise.resolve({ txId: 'txn_id' }) })
                    }
                })
            )

            jest.fn().mockImplementation(() => 'signed_txn')

            mockStdlib.makeAssetConfigTxnWithSuggestedParamsFromObject.mockImplementation(() => {
                throw new Error()
            })

            const response = await request(app.callback()).put(`/places/${tokenId}`).send({
                name: 'place name',
                cid: 'place cid',
                offChainImageUrl: 'off-chain url'
            })

            expect(response.status).toBe(500)
            expect(response.body).toEqual({
                error: 'UpdatePlaceTokenError',
                message: 'Unable to update place token'
            })
        })
    })

    describe('approve project endpoint', function () {
        beforeEach(() => {
            mockStdlib.formatAddress.mockImplementation(address => `formatted ${address}`)

            process.env.ADMIN_WALLETS = 'admin_wallet,super_wallet'
            authHandler.mockImplementation(async (ctx, next) => {
                ctx.state.account = 'admin_wallet'
                await next()
            })
        })

        it('should return 204 when approving project and creator accepts token', async () => {
            const contractId = 'eyJ0eXBlIjoiQmlnTnVtYmVyIiwiaGV4IjoiMHgwNmZkMmIzMyJ9'

            const api = {
                Api: {
                    payToken: jest.fn().mockImplementation(() => Promise.resolve()),
                    setApprovalState: jest.fn().mockImplementation(() => Promise.resolve())
                }
            }

            const view = {
                View: {
                    creator: () => [0, 'project_creator'],
                    token: () => [0, { toNumber: () => 'project_token_id' }]
                }
            }

            mockStdlib.newAccountFromMnemonic.mockImplementation(() => ({
                networkAccount: { addr: 'wallet_address', sk: 'account_sk' },
                contract: () => ({
                    a: api,
                    v: view
                })
            }))

            mockStdlib.tokensAccepted.mockImplementation(() => [
                {
                    toNumber: () => 'project_token_id'
                }
            ])

            const response = await request(app.callback()).put(`/projects/${contractId}/approval`).send({
                approved: true
            })

            expect(mockStdlib.tokensAccepted).toHaveBeenCalledTimes(1)
            expect(mockStdlib.tokensAccepted).toHaveBeenCalledWith('formatted project_creator')

            expect(api.Api.payToken).toHaveBeenCalledTimes(1)

            expect(mockPlaceRepository.setProjectApproval).toHaveBeenCalledTimes(1)
            expect(mockPlaceRepository.setProjectApproval).toHaveBeenCalledWith(contractId, true)

            expect(response.status).toBe(204)
            expect(response.body).toEqual({})
        })

        it('should return 204 when approving project and creator do not accept token', async () => {
            const contractId = 'eyJ0eXBlIjoiQmlnTnVtYmVyIiwiaGV4IjoiMHgwNmZkMmIzMyJ9'

            const api = {
                Api: {
                    payToken: jest.fn().mockImplementation(() => Promise.resolve()),
                    setApprovalState: jest.fn().mockImplementation(() => Promise.resolve())
                }
            }

            const view = {
                View: {
                    creator: () => [0, 'project_creator'],
                    token: () => [0, { toNumber: () => 'project_token_id' }]
                }
            }

            mockStdlib.newAccountFromMnemonic.mockImplementation(() => ({
                networkAccount: { addr: 'wallet_address', sk: 'account_sk' },
                contract: () => ({
                    a: api,
                    v: view
                })
            }))

            mockStdlib.tokensAccepted.mockImplementation(() => [
                {
                    toNumber: () => 'other_project_token_id'
                }
            ])

            const response = await request(app.callback()).put(`/projects/${contractId}/approval`).send({
                approved: true
            })

            expect(mockStdlib.tokensAccepted).toHaveBeenCalledTimes(1)
            expect(mockStdlib.tokensAccepted).toHaveBeenCalledWith('formatted project_creator')

            expect(api.Api.payToken).not.toHaveBeenCalled()
            expect(api.Api.setApprovalState).toHaveBeenCalledTimes(1)
            expect(api.Api.setApprovalState).toHaveBeenCalledWith(true)

            expect(mockPlaceRepository.setProjectApproval).toHaveBeenCalledTimes(1)
            expect(mockPlaceRepository.setProjectApproval).toHaveBeenCalledWith(contractId, true)

            expect(response.status).toBe(204)
            expect(response.body).toEqual({})
        })

        it('should return 204 when rejecting project', async () => {
            const contractId = 'eyJ0eXBlIjoiQmlnTnVtYmVyIiwiaGV4IjoiMHgwNmZkMmIzMyJ9'

            const api = {
                Api: {
                    setApprovalState: jest.fn().mockImplementation(() => Promise.resolve())
                }
            }

            mockStdlib.newAccountFromMnemonic.mockImplementation(() => ({
                networkAccount: { addr: 'wallet_address', sk: 'account_sk' },
                contract: () => ({
                    a: api
                })
            }))

            const response = await request(app.callback()).put(`/projects/${contractId}/approval`).send({
                approved: false
            })

            expect(api.Api.setApprovalState).toHaveBeenCalledTimes(1)
            expect(api.Api.setApprovalState).toHaveBeenCalledWith(false)

            expect(mockPlaceRepository.setProjectApproval).toHaveBeenCalledTimes(1)
            expect(mockPlaceRepository.setProjectApproval).toHaveBeenCalledWith(contractId, false)

            expect(response.status).toBe(204)
            expect(response.body).toEqual({})
        })

        it('should return 400 when approval state not sent', async () => {
            const contractId = 'eyJ0eXBlIjoiQmlnTnVtYmVyIiwiaGV4IjoiMHgwNmZkMmIzMyJ9'

            const api = {
                Api: {
                    setApprovalState: jest.fn().mockImplementation(() => Promise.resolve())
                }
            }

            mockStdlib.newAccountFromMnemonic.mockImplementation(() => ({
                networkAccount: { addr: 'wallet_address', sk: 'account_sk' },
                contract: () => ({
                    a: api
                })
            }))

            const response = await request(app.callback()).put(`/projects/${contractId}/approval`).send({})

            expect(api.Api.setApprovalState).not.toHaveBeenCalled()
            expect(mockPlaceRepository.setProjectApproval).not.toHaveBeenCalled()

            expect(response.status).toBe(400)
            expect(response.body).toEqual({
                error: 'MissingParameterError',
                message: 'approved must be specified'
            })
        })

        it('should return 403 when user is not admin', async () => {
            const contractId = 'eyJ0eXBlIjoiQmlnTnVtYmVyIiwiaGV4IjoiMHgwNmZkMmIzMyJ9'
            authHandler.mockImplementation(async (ctx, next) => {
                ctx.state.account = 'small_wallet'
                await next()
            })

            const api = {
                Api: {
                    setApprovalState: jest.fn().mockImplementation(() => Promise.resolve())
                }
            }

            mockStdlib.newAccountFromMnemonic.mockImplementation(() => ({
                networkAccount: { addr: 'wallet_address', sk: 'account_sk' },
                contract: () => ({
                    a: api
                })
            }))

            const response = await request(app.callback()).put(`/projects/${contractId}/approval`).send({
                approved: true
            })

            expect(api.Api.setApprovalState).not.toHaveBeenCalled()
            expect(mockPlaceRepository.setProjectApproval).not.toHaveBeenCalled()

            expect(response.status).toBe(403)
            expect(response.body).toEqual({
                error: 'UserUnauthorizedError',
                message: 'The authenticated user is not authorized to perform this action'
            })
        })

        it('should return 400 when contract id is malformed', async () => {
            const contractId = 'contract_id'

            const api = {
                Api: {
                    setApprovalState: jest.fn().mockImplementation(() => Promise.resolve())
                }
            }

            mockStdlib.newAccountFromMnemonic.mockImplementation(() => ({
                networkAccount: { addr: 'wallet_address', sk: 'account_sk' },
                contract: () => ({
                    a: api
                })
            }))

            const response = await request(app.callback()).put(`/projects/${contractId}/approval`).send({
                approved: true
            })

            expect(api.Api.setApprovalState).not.toHaveBeenCalled()
            expect(mockPlaceRepository.setProjectApproval).not.toHaveBeenCalled()

            expect(response.status).toBe(400)
            expect(response.body).toEqual({
                error: 'ContractIdMalformedError',
                message: 'The specified contract identifier is malformed'
            })
        })

        it('should return 500 when api fails', async () => {
            const contractId = 'eyJ0eXBlIjoiQmlnTnVtYmVyIiwiaGV4IjoiMHgwNmZkMmIzMyJ9'

            const api = {
                Api: {
                    setApprovalState: jest.fn().mockImplementation(() => Promise.reject())
                }
            }

            mockStdlib.newAccountFromMnemonic.mockImplementation(() => ({
                networkAccount: { addr: 'wallet_address', sk: 'account_sk' },
                contract: () => ({
                    a: api
                })
            }))

            const response = await request(app.callback()).put(`/projects/${contractId}/approval`).send({
                approved: false
            })

            expect(api.Api.setApprovalState).toHaveBeenCalledTimes(1)
            expect(api.Api.setApprovalState).toHaveBeenCalledWith(false)

            expect(mockPlaceRepository.setProjectApproval).not.toHaveBeenCalled()

            expect(response.status).toBe(500)
            expect(response.body).toEqual({
                error: 'UpdatePlaceTokenError',
                message: 'Unable to update place token'
            })
        })
    })

    describe('get place endpoint', function () {
        it('should return 200 when getting place and user has wallet and has not opted in to the token', async () => {
            const tokenId = 'token-id'

            mockPlaceRepository.getPlace.mockImplementation(() => ({
                id: tokenId,
                userId: 'user-id',
                created: 'creation-date',
                name: 'place name'
            }))

            mockUserRepository.getUserById.mockImplementation(() => ({
                id: 'user-id',
                walletAddress: 'wallet-address'
            }))

            mockStdlib.tokensAccepted.mockImplementation(() => [
                {
                    toNumber: () => 'other-token-id'
                }
            ])

            mockAlgoIndexer.callAlgonodeIndexerEndpoint.mockImplementation(params => {
                switch (params) {
                    case `assets/${tokenId}`:
                        return Promise.resolve({
                            status: 200,
                            json: {
                                asset: {
                                    index: tokenId,
                                    params: {
                                        name: 'token name',
                                        total: 1,
                                        decimals: 0,
                                        'unit-name': 'TRPLC',
                                        url: 'place url',
                                        reserve: 'place reserve'
                                    }
                                }
                            }
                        })
                    case `assets/${tokenId}/balances`:
                        return Promise.resolve({
                            status: 200,
                            json: {
                                balances: [
                                    {
                                        address: 'other-wallet-address',
                                        amount: 1,
                                        deleted: false
                                    }
                                ]
                            }
                        })
                }
            })

            const response = await request(app.callback()).get(`/places/${tokenId}`)

            expect(mockPlaceRepository.getPlace).toHaveBeenCalledTimes(1)
            expect(mockPlaceRepository.getPlace).toHaveBeenCalledWith(tokenId)

            expect(mockUserRepository.getUserById).toHaveBeenCalledTimes(1)
            expect(mockUserRepository.getUserById).toHaveBeenCalledWith('user-id')

            expect(response.status).toBe(200)
            expect(response.body).toEqual({
                id: tokenId,
                userId: 'user-id',
                created: 'creation-date',
                name: 'place name',
                url: 'place url',
                reserve: 'place reserve',
                tokenCreatorOptIn: false,
                userWalletOwned: false
            })
        })

        it('should return 200 when getting place and user has wallet and has opted in to the token', async () => {
            const tokenId = 'token-id'

            mockPlaceRepository.getPlace.mockImplementation(() => ({
                id: tokenId,
                userId: 'user-id',
                created: 'creation-date',
                name: 'place name'
            }))

            mockUserRepository.getUserById.mockImplementation(() => ({
                id: 'user-id',
                walletAddress: 'wallet-address'
            }))

            mockStdlib.tokensAccepted.mockImplementation(() => [
                {
                    toNumber: () => 'token-id'
                }
            ])

            mockAlgoIndexer.callAlgonodeIndexerEndpoint.mockImplementation(params => {
                switch (params) {
                    case `assets/${tokenId}`:
                        return Promise.resolve({
                            status: 200,
                            json: {
                                asset: {
                                    index: tokenId,
                                    params: {
                                        name: 'token name',
                                        total: 1,
                                        decimals: 0,
                                        'unit-name': 'TRPLC',
                                        url: 'place url',
                                        reserve: 'place reserve'
                                    }
                                }
                            }
                        })
                    case `assets/${tokenId}/balances`:
                        return Promise.resolve({
                            status: 200,
                            json: {
                                balances: [
                                    {
                                        address: 'other-wallet-address',
                                        amount: 1,
                                        deleted: false
                                    }
                                ]
                            }
                        })
                }
            })

            const response = await request(app.callback()).get(`/places/${tokenId}`)

            expect(mockPlaceRepository.getPlace).toHaveBeenCalledTimes(1)
            expect(mockPlaceRepository.getPlace).toHaveBeenCalledWith(tokenId)

            expect(mockUserRepository.getUserById).toHaveBeenCalledTimes(1)
            expect(mockUserRepository.getUserById).toHaveBeenCalledWith('user-id')

            expect(response.status).toBe(200)
            expect(response.body).toEqual({
                id: tokenId,
                userId: 'user-id',
                created: 'creation-date',
                name: 'place name',
                url: 'place url',
                reserve: 'place reserve',
                tokenCreatorOptIn: true,
                userWalletOwned: false
            })
        })

        it('should return 200 when getting place and user has token in wallet', async () => {
            const tokenId = 'token-id'

            mockPlaceRepository.getPlace.mockImplementation(() => ({
                id: tokenId,
                userId: 'user-id',
                created: 'creation-date',
                name: 'place name'
            }))

            mockUserRepository.getUserById.mockImplementation(() => ({
                id: 'user-id',
                walletAddress: 'wallet-address'
            }))

            mockStdlib.tokensAccepted.mockImplementation(() => [
                {
                    toNumber: () => 'token-id'
                }
            ])

            mockAlgoIndexer.callAlgonodeIndexerEndpoint.mockImplementation(params => {
                switch (params) {
                    case `assets/${tokenId}`:
                        return Promise.resolve({
                            status: 200,
                            json: {
                                asset: {
                                    index: tokenId,
                                    params: {
                                        name: 'token name',
                                        total: 1,
                                        decimals: 0,
                                        'unit-name': 'TRPLC',
                                        url: 'place url',
                                        reserve: 'place reserve'
                                    }
                                }
                            }
                        })
                    case `assets/${tokenId}/balances`:
                        return Promise.resolve({
                            status: 200,
                            json: {
                                balances: [
                                    {
                                        address: 'wallet-address',
                                        amount: 1,
                                        deleted: false
                                    }
                                ]
                            }
                        })
                }
            })

            const response = await request(app.callback()).get(`/places/${tokenId}`)

            expect(mockPlaceRepository.getPlace).toHaveBeenCalledTimes(1)
            expect(mockPlaceRepository.getPlace).toHaveBeenCalledWith(tokenId)

            expect(mockUserRepository.getUserById).toHaveBeenCalledTimes(1)
            expect(mockUserRepository.getUserById).toHaveBeenCalledWith('user-id')

            expect(response.status).toBe(200)
            expect(response.body).toEqual({
                id: tokenId,
                userId: 'user-id',
                created: 'creation-date',
                name: 'place name',
                url: 'place url',
                reserve: 'place reserve',
                tokenCreatorOptIn: true,
                userWalletOwned: true
            })
        })

        it('should return 200 when getting place and user has registered wallet and asset not found in indexer', async () => {
            const tokenId = 'token-id'

            mockPlaceRepository.getPlace.mockImplementation(() => ({
                id: tokenId,
                userId: 'user-id',
                created: 'creation-date'
            }))

            mockUserRepository.getUserById.mockImplementation(() => ({
                id: 'user-id',
                walletAddress: 'wallet-address'
            }))

            mockStdlib.tokensAccepted.mockImplementation(() => [
                {
                    toNumber: () => 'token-id'
                }
            ])

            mockAlgoIndexer.callAlgonodeIndexerEndpoint.mockImplementation(params => {
                switch (params) {
                    case `assets/${tokenId}`:
                        return Promise.resolve({
                            status: 404
                        })
                    case `assets/${tokenId}/balances`:
                        return Promise.resolve({
                            status: 200,
                            json: {
                                balances: [
                                    {
                                        address: 'wallet-address',
                                        amount: 1,
                                        deleted: false
                                    }
                                ]
                            }
                        })
                }
            })

            const response = await request(app.callback()).get(`/places/${tokenId}`)

            expect(mockPlaceRepository.getPlace).toHaveBeenCalledTimes(1)
            expect(mockPlaceRepository.getPlace).toHaveBeenCalledWith(tokenId)

            expect(mockUserRepository.getUserById).toHaveBeenCalledTimes(1)
            expect(mockUserRepository.getUserById).toHaveBeenCalledWith('user-id')

            expect(response.status).toBe(404)
            expect(response.body).toEqual({
                error: 'AssetNotFoundError',
                message: 'Asset specified not found'
            })
        })

        it('should return 200 when getting place and user does not have registered wallet', async () => {
            const tokenId = 'token-id'

            mockPlaceRepository.getPlace.mockImplementation(() => ({
                id: tokenId,
                userId: 'user-id',
                created: 'creation-date',
                name: 'place name'
            }))

            mockUserRepository.getUserById.mockImplementation(() => ({
                id: 'user-id'
            }))

            mockAlgoIndexer.callAlgonodeIndexerEndpoint.mockImplementation(() => {
                return Promise.resolve({
                    status: 200,
                    json: {
                        asset: {
                            index: 123,
                            params: {
                                name: 'token name',
                                total: 1,
                                decimals: 0,
                                'unit-name': 'TRPLC',
                                url: 'place url',
                                reserve: 'place reserve'
                            }
                        }
                    }
                })
            })

            const response = await request(app.callback()).get(`/places/${tokenId}`)

            expect(mockPlaceRepository.getPlace).toHaveBeenCalledTimes(1)
            expect(mockPlaceRepository.getPlace).toHaveBeenCalledWith(tokenId)

            expect(mockUserRepository.getUserById).toHaveBeenCalledTimes(1)
            expect(mockUserRepository.getUserById).toHaveBeenCalledWith('user-id')

            expect(response.status).toBe(200)
            expect(response.body).toEqual({
                id: tokenId,
                userId: 'user-id',
                created: 'creation-date',
                name: 'place name',
                url: 'place url',
                reserve: 'place reserve'
            })
        })

        it('should return 200 when getting place and token not found in indexer', async () => {
            const tokenId = 'token-id'

            mockPlaceRepository.getPlace.mockImplementation(() => ({
                id: tokenId,
                userId: 'user-id',
                created: 'creation-date'
            }))

            mockUserRepository.getUserById.mockImplementation(() => ({
                id: 'user-id'
            }))

            mockAlgoIndexer.callAlgonodeIndexerEndpoint.mockImplementation(() => {
                return Promise.resolve({
                    status: 404
                })
            })

            const response = await request(app.callback()).get(`/places/${tokenId}`)

            expect(mockPlaceRepository.getPlace).toHaveBeenCalledTimes(1)
            expect(mockPlaceRepository.getPlace).toHaveBeenCalledWith(tokenId)

            expect(mockUserRepository.getUserById).toHaveBeenCalledTimes(1)
            expect(mockUserRepository.getUserById).toHaveBeenCalledWith('user-id')

            expect(response.status).toBe(404)
            expect(response.body).toEqual({
                error: 'AssetNotFoundError',
                message: 'Asset specified not found'
            })
        })

        it('should return 200 when getting place and token deleted in indexer', async () => {
            const tokenId = 'token-id'

            mockPlaceRepository.getPlace.mockImplementation(() => ({
                id: tokenId,
                userId: 'user-id',
                created: 'creation-date'
            }))

            mockUserRepository.getUserById.mockImplementation(() => ({
                id: 'user-id'
            }))

            mockAlgoIndexer.callAlgonodeIndexerEndpoint.mockImplementation(() => {
                return Promise.resolve({
                    status: 200,
                    json: {
                        asset: {
                            index: tokenId,
                            deleted: true,
                            params: {
                                name: 'place name',
                                total: 1,
                                decimals: 0,
                                'unit-name': 'TRPLC',
                                url: 'place url',
                                reserve: 'place reserve'
                            }
                        }
                    }
                })
            })

            const response = await request(app.callback()).get(`/places/${tokenId}`)

            expect(mockPlaceRepository.getPlace).toHaveBeenCalledTimes(1)
            expect(mockPlaceRepository.getPlace).toHaveBeenCalledWith(tokenId)

            expect(mockUserRepository.getUserById).toHaveBeenCalledTimes(1)
            expect(mockUserRepository.getUserById).toHaveBeenCalledWith('user-id')

            expect(response.status).toBe(404)
            expect(response.body).toEqual({
                error: 'AssetNotFoundError',
                message: 'Asset specified not found'
            })
        })
    })

    describe('get places endpoint', function () {
        it('should return 200 when getting places and all is fine', async () => {
            mockPlaceRepository.getPlaces.mockImplementation(() => ({
                places: [
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

            const response = await request(app.callback()).get('/places?sort=asc&status=approved&pageSize=12&nextPageKey=page-key')

            expect(mockPlaceRepository.getPlaces).toHaveBeenCalledTimes(1)
            expect(mockPlaceRepository.getPlaces).toHaveBeenCalledWith({
                sort: 'asc',
                status: 'approved',
                nextPageKey: 'page-key',
                pageSize: '12'
            })

            expect(response.status).toBe(200)
            expect(response.body).toEqual({
                places: [
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

    describe('get projects by user endpoint', function () {
        it('should return 200 when getting projects and all is fine', async () => {
            mockPlaceRepository.getPlacesByUser.mockImplementation(() => ({
                places: [
                    {
                        id: 'token-id-1',
                        created: 'token-date-1'
                    },
                    {
                        id: 'token-id-2',
                        created: 'token-date-2'
                    }
                ]
            }))

            const response = await request(app.callback()).get('/users/user-id/places?sort=asc&status=approved&pageSize=12&nextPageKey=page-key')

            expect(mockPlaceRepository.getPlacesByUser).toHaveBeenCalledTimes(1)
            expect(mockPlaceRepository.getPlacesByUser).toHaveBeenCalledWith({
                userId: 'user-id',
                sort: 'asc',
                status: 'approved',
                nextPageKey: 'page-key',
                pageSize: '12'
            })

            expect(response.status).toBe(200)
            expect(response.body).toEqual({
                places: [
                    {
                        id: 'token-id-1',
                        created: 'token-date-1'
                    },
                    {
                        id: 'token-id-2',
                        created: 'token-date-2'
                    }
                ]
            })
        })
    })

    describe('delete place endpoint', function () {
        it('should return 204 when deleting place', async () => {
            const tokenId = 'token-id'

            mockPlaceRepository.deletePlace.mockImplementation(() => Promise.resolve())

            const response = await request(app.callback()).delete(`/places/${tokenId}`)

            expect(mockPlaceRepository.deletePlace).toHaveBeenCalledTimes(1)
            expect(mockPlaceRepository.deletePlace).toHaveBeenCalledWith('jwt_sub', tokenId)

            expect(response.status).toBe(204)
            expect(response.body).toEqual({})
        })
    })

    describe('delete project endpoint', function () {
        beforeEach(() => {
            process.env.ADMIN_WALLETS = 'admin_wallet,super_wallet'
            authHandler.mockImplementation(async (ctx, next) => {
                ctx.state.account = 'admin_wallet'
                await next()
            })
        })

        it('should return 200 when deleting project and can stop contract', async () => {
            const api = {
                Api: {
                    stop: jest.fn().mockImplementation(() => Promise.resolve())
                }
            }

            mockStdlib.newAccountFromMnemonic.mockImplementation(() => ({
                networkAccount: {},
                contract: () => ({
                    a: api
                })
            }))

            const response = await request(app.callback()).delete('/projects/eyJ0eXBlIjoiQmlnTnVtYmVyIiwiaGV4IjoiMHgwNmZkMmIzMyJ9')

            expect(mockPlaceRepository.deleteProject).toHaveBeenCalledTimes(1)
            expect(mockPlaceRepository.deleteProject).toHaveBeenCalledWith('eyJ0eXBlIjoiQmlnTnVtYmVyIiwiaGV4IjoiMHgwNmZkMmIzMyJ9', false)

            expect(api.Api.stop).toHaveBeenCalledTimes(1)

            expect(response.status).toBe(200)
            expect(response.body).toEqual({ contractDeleted: true })
        })

        it('should return 200 when permanently deleting project and can stop contract', async () => {
            const api = {
                Api: {
                    stop: jest.fn().mockImplementation(() => Promise.resolve())
                }
            }

            mockStdlib.newAccountFromMnemonic.mockImplementation(() => ({
                networkAccount: {},
                contract: () => ({
                    a: api
                })
            }))

            const response = await request(app.callback()).delete('/projects/eyJ0eXBlIjoiQmlnTnVtYmVyIiwiaGV4IjoiMHgwNmZkMmIzMyJ9?permanent=true')

            expect(mockPlaceRepository.deleteProject).toHaveBeenCalledTimes(1)
            expect(mockPlaceRepository.deleteProject).toHaveBeenCalledWith('eyJ0eXBlIjoiQmlnTnVtYmVyIiwiaGV4IjoiMHgwNmZkMmIzMyJ9', true)

            expect(api.Api.stop).toHaveBeenCalledTimes(1)

            expect(response.status).toBe(200)
            expect(response.body).toEqual({ contractDeleted: true })
        })

        it('should return 200 when deleting project and cannot stop contract', async () => {
            const api = {
                Api: {
                    stop: jest.fn().mockImplementation(() => Promise.reject())
                }
            }

            mockStdlib.newAccountFromMnemonic.mockImplementation(() => ({
                networkAccount: {},
                contract: () => ({
                    a: api
                })
            }))

            const response = await request(app.callback()).delete('/projects/eyJ0eXBlIjoiQmlnTnVtYmVyIiwiaGV4IjoiMHgwNmZkMmIzMyJ9')

            expect(mockPlaceRepository.deleteProject).toHaveBeenCalledTimes(1)
            expect(mockPlaceRepository.deleteProject).toHaveBeenCalledWith('eyJ0eXBlIjoiQmlnTnVtYmVyIiwiaGV4IjoiMHgwNmZkMmIzMyJ9', false)

            expect(api.Api.stop).toHaveBeenCalledTimes(1)

            expect(response.status).toBe(200)
            expect(response.body).toEqual({ contractDeleted: false })
        })

        it('should return 400 when deleting project and contract id is malformed', async () => {
            const api = {
                Api: {
                    stop: jest.fn().mockImplementation(() => Promise.resolve())
                }
            }

            mockStdlib.newAccountFromMnemonic.mockImplementation(() => ({
                networkAccount: {},
                contract: () => ({
                    a: api
                })
            }))

            const response = await request(app.callback()).delete('/projects/contract-id')

            expect(mockPlaceRepository.deleteProject).not.toHaveBeenCalled()
            expect(api.Api.stop).not.toHaveBeenCalled()

            expect(response.status).toBe(400)
            expect(response.body).toEqual({
                error: 'ContractIdMalformedError',
                message: 'The specified contract identifier is malformed'
            })
        })

        it('should return 403 when deleting project and user is not admin', async () => {
            authHandler.mockImplementation(async (ctx, next) => {
                ctx.state.account = 'bad_wallet'
                await next()
            })

            const api = {
                Api: {
                    stop: jest.fn().mockImplementation(() => Promise.resolve())
                }
            }

            mockStdlib.newAccountFromMnemonic.mockImplementation(() => ({
                networkAccount: {},
                contract: () => ({
                    a: api
                })
            }))

            const response = await request(app.callback()).delete('/projects/contract-id')

            expect(mockPlaceRepository.deleteProject).not.toHaveBeenCalled()
            expect(api.Api.stop).not.toHaveBeenCalled()

            expect(response.status).toBe(403)
            expect(response.body).toEqual({
                error: 'UserUnauthorizedError',
                message: 'The authenticated user is not authorized to perform this action'
            })
        })
    })
})
