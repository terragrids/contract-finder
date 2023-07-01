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
    makePaymentTxnWithSuggestedParamsFromObject: jest.fn().mockImplementation(() => jest.fn()),
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
                makePaymentTxnWithSuggestedParamsFromObject: mockStdlib.makePaymentTxnWithSuggestedParamsFromObject,
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
    approvePlace: jest.fn().mockImplementation(() => jest.fn())
}
jest.mock('./repository/place.repository.js', () =>
    jest.fn().mockImplementation(() => ({
        createPlace: mockPlaceRepository.createPlace,
        updatePlace: mockPlaceRepository.updatePlace,
        getPlace: mockPlaceRepository.getPlace,
        getPlaces: mockPlaceRepository.getPlaces,
        getPlacesByUser: mockPlaceRepository.getPlacesByUser,
        deletePlace: mockPlaceRepository.deletePlace,
        approvePlace: mockPlaceRepository.approvePlace
    }))
)

const mockTrackerRepository = {
    createTracker: jest.fn().mockImplementation(() => jest.fn()),
    getTrackers: jest.fn().mockImplementation(() => jest.fn()),
    getTracker: jest.fn().mockImplementation(() => jest.fn()),
    updateTracker: jest.fn().mockImplementation(() => jest.fn()),
    createReading: jest.fn().mockImplementation(() => jest.fn()),
    getReadings: jest.fn().mockImplementation(() => jest.fn()),
    getReading: jest.fn().mockImplementation(() => jest.fn())
}
jest.mock('./repository/tracker.repository.js', () =>
    jest.fn().mockImplementation(() => ({
        createTracker: mockTrackerRepository.createTracker,
        getTrackers: mockTrackerRepository.getTrackers,
        getTracker: mockTrackerRepository.getTracker,
        updateTracker: mockTrackerRepository.updateTracker,
        createReading: mockTrackerRepository.createReading,
        getReadings: mockTrackerRepository.getReadings,
        getReading: mockTrackerRepository.getReading
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

import { aes256encrypt, aes256decrypt } from './utils/crypto-utils.js'

jest.mock('./utils/crypto-utils.js', () => ({
    aes256encrypt: jest.fn().mockImplementation(() => ''),
    aes256decrypt: jest.fn().mockImplementation(() => '')
}))

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

    describe('get places by user endpoint', function () {
        it('should return 200 when getting places and all is fine', async () => {
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

    describe('approve place endpoint', function () {
        it('should return 204 when deleting place', async () => {
            const tokenId = 'token-id'

            mockPlaceRepository.approvePlace.mockImplementation(() => Promise.resolve())

            const response = await request(app.callback()).put(`/places/${tokenId}/approval`)

            expect(mockPlaceRepository.approvePlace).toHaveBeenCalledTimes(1)
            expect(mockPlaceRepository.approvePlace).toHaveBeenCalledWith('jwt_sub', tokenId, true)

            expect(response.status).toBe(204)
            expect(response.body).toEqual({})
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

    describe('post trackers endpoint', function () {
        it('should return 201 when posting new tracker and all is fine', async () => {
            mockStdlib.launchToken.mockImplementation(() => ({
                id: { toNumber: () => 1234 }
            }))

            algorandAddressFromCID.mockImplementation(() => ({ address: 'reserve_address', url: 'token_url' }))
            cidFromAlgorandAddress.mockImplementation(() => 'tracker cid')

            mockStdlib.newAccountFromMnemonic.mockImplementation(() => ({
                networkAccount: { addr: 'wallet_address' }
            }))

            mockUserRepository.getUserByOauthId.mockImplementation(() => ({
                id: 'user_id',
                permissions: [0]
            }))

            const response = await request(app.callback()).post('/trackers').send({
                name: 'tracker name',
                type: 'electricity-meter',
                cid: 'tracker cid',
                placeId: 'place id',
                offChainImageUrl: 'image url'
            })

            expect(mockStdlib.launchToken).toHaveBeenCalledTimes(1)
            expect(mockStdlib.launchToken).toHaveBeenCalledWith(expect.any(Object), 'tracker name', 'TRTRK', {
                decimals: 0,
                manager: 'wallet_address',
                clawback: 'wallet_address',
                freeze: 'wallet_address',
                reserve: 'reserve_address',
                supply: 1,
                url: 'token_url'
            })

            expect(mockTrackerRepository.createTracker).toHaveBeenCalledTimes(1)
            expect(mockTrackerRepository.createTracker).toHaveBeenCalledWith({
                userId: 'user_id',
                name: 'tracker name',
                type: 'electricity-meter',
                offChainImageUrl: 'image url',
                tokenId: 1234,
                placeId: 'place id',
                isAdmin: true
            })

            expect(response.status).toBe(201)
            expect(response.body).toEqual({
                tokenId: 1234
            })
        })

        it('should return 201 when posting new tracker with long name', async () => {
            mockStdlib.launchToken.mockImplementation(() => ({
                id: { toNumber: () => 1234 }
            }))

            algorandAddressFromCID.mockImplementation(() => ({ address: 'reserve_address', url: 'token_url' }))
            cidFromAlgorandAddress.mockImplementation(() => 'tracker cid')

            mockStdlib.newAccountFromMnemonic.mockImplementation(() => ({
                networkAccount: { addr: 'wallet_address' }
            }))

            mockUserRepository.getUserByOauthId.mockImplementation(() => ({
                id: 'user_id',
                permissions: [1]
            }))

            const response = await request(app.callback()).post('/trackers').send({
                name: 'Louisville and Nashville Railroad Office Building',
                type: 'gas-meter',
                cid: 'tracker cid',
                creator: 'tracker user',
                offChainImageUrl: 'image url',
                placeId: 'place id'
            })

            expect(mockStdlib.launchToken).toHaveBeenCalledTimes(1)
            expect(mockStdlib.launchToken).toHaveBeenCalledWith(expect.any(Object), 'Louisville and Nashville Rail…', 'TRTRK', {
                decimals: 0,
                manager: 'wallet_address',
                clawback: 'wallet_address',
                freeze: 'wallet_address',
                reserve: 'reserve_address',
                supply: 1,
                url: 'token_url'
            })

            expect(mockTrackerRepository.createTracker).toHaveBeenCalledTimes(1)
            expect(mockTrackerRepository.createTracker).toHaveBeenCalledWith({
                userId: 'user_id',
                name: 'Louisville and Nashville Railroad Office Building',
                type: 'gas-meter',
                offChainImageUrl: 'image url',
                tokenId: 1234,
                placeId: 'place id',
                isAdmin: false
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

            const response = await request(app.callback()).post('/trackers').send({
                name: 'tracker name',
                type: 'gas-meter',
                cid: 'tracker cid',
                offChainImageUrl: 'image url',
                placeId: 'place id'
            })

            expect(response.status).toBe(500)
            expect(response.body).toEqual({
                error: 'MintTokenError',
                message: 'Unable to mint token'
            })
        })

        it('should return 500 when cid verification fails', async () => {
            algorandAddressFromCID.mockImplementation(() => ({ address: 'reserve_address', url: 'token_url' }))
            cidFromAlgorandAddress.mockImplementation(() => 'tracker meh')

            const response = await request(app.callback()).post('/trackers').send({
                name: 'tracker name',
                type: 'electricity-meter',
                cid: 'tracker cid',
                offChainImageUrl: 'image url',
                placeId: 'place id'
            })

            expect(response.status).toBe(500)
            expect(response.body).toEqual({
                error: 'MintTokenError',
                message: 'Unable to mint token'
            })
        })

        it('should return 500 when saving tracker in repository fails', async () => {
            mockTrackerRepository.createTracker.mockImplementation(() => {
                throw new Error()
            })

            mockStdlib.launchToken.mockImplementation(() => ({
                id: { toNumber: () => 1234 }
            }))

            algorandAddressFromCID.mockImplementation(() => ({ address: 'reserve_address', url: 'token_url' }))
            cidFromAlgorandAddress.mockImplementation(() => 'tracker cid')

            mockStdlib.newAccountFromMnemonic.mockImplementation(() => ({
                networkAccount: { addr: 'wallet_address' }
            }))

            const response = await request(app.callback()).post('/trackers').send({
                name: 'tracker name',
                type: 'gas-meter',
                cid: 'tracker cid',
                offChainImageUrl: 'image url',
                placeId: 'place id'
            })

            expect(response.status).toBe(500)
            expect(response.body).toEqual({})
        })

        it('should return 400 when tracker name is missing', async () => {
            const response = await request(app.callback()).post('/trackers').send({
                type: 'tracker type',
                cid: 'tracker cid',
                offChainImageUrl: 'image url',
                placeId: 'place id'
            })

            expect(response.status).toBe(400)
            expect(response.body).toEqual({
                error: 'MissingParameterError',
                message: 'name must be specified'
            })
        })

        it('should return 400 when tracker type is missing', async () => {
            const response = await request(app.callback()).post('/trackers').send({
                name: 'tracker name',
                cid: 'tracker cid',
                offChainImageUrl: 'image url',
                placeId: 'place id'
            })

            expect(response.status).toBe(400)
            expect(response.body).toEqual({
                error: 'MissingParameterError',
                message: 'type must be specified'
            })
        })

        it('should return 400 when tracker type is invalid', async () => {
            const response = await request(app.callback()).post('/trackers').send({
                name: 'tracker name',
                type: 'tracker type',
                cid: 'tracker cid',
                offChainImageUrl: 'image url',
                placeId: 'place id'
            })

            expect(response.status).toBe(400)
            expect(response.body).toEqual({
                error: 'InvalidTrackerError',
                message: 'Invalid tracker type'
            })
        })

        it('should return 400 when tracker cid is missing', async () => {
            const response = await request(app.callback()).post('/trackers').send({
                type: 'tracker type',
                name: 'tracker name',
                offChainImageUrl: 'image url',
                placeId: 'place id'
            })

            expect(response.status).toBe(400)
            expect(response.body).toEqual({
                error: 'MissingParameterError',
                message: 'cid must be specified'
            })
        })

        it('should return 400 when tracker offChainImageUrl is missing', async () => {
            const response = await request(app.callback()).post('/trackers').send({
                type: 'tracker type',
                name: 'tracker name',
                cid: 'tracker cid',
                placeId: 'place id'
            })

            expect(response.status).toBe(400)
            expect(response.body).toEqual({
                error: 'MissingParameterError',
                message: 'offChainImageUrl must be specified'
            })
        })

        it('should return 400 when tracker place id is missing', async () => {
            const response = await request(app.callback()).post('/trackers').send({
                type: 'tracker type',
                name: 'tracker name',
                cid: 'tracker cid',
                offChainImageUrl: 'image url'
            })

            expect(response.status).toBe(400)
            expect(response.body).toEqual({
                error: 'MissingParameterError',
                message: 'placeId must be specified'
            })
        })

        it('should return 400 when tracker name is too long', async () => {
            const response = await request(app.callback())
                .post('/trackers')
                .send({
                    name: '#'.repeat(129),
                    type: 'tracker type',
                    cid: 'tracker cid',
                    offChainImageUrl: 'image url',
                    placeId: 'place id'
                })

            expect(response.status).toBe(400)
            expect(response.body).toEqual({
                error: 'ParameterTooLongError',
                message: 'name is too long'
            })
        })

        it('should return 400 when tracker type is too long', async () => {
            const response = await request(app.callback())
                .post('/trackers')
                .send({
                    name: 'tracker name',
                    type: '#'.repeat(129),
                    cid: 'tracker cid',
                    offChainImageUrl: 'image url',
                    placeId: 'place id'
                })

            expect(response.status).toBe(400)
            expect(response.body).toEqual({
                error: 'ParameterTooLongError',
                message: 'type is too long'
            })
        })

        it('should return 400 when tracker offChainImageUrl is too long', async () => {
            const response = await request(app.callback())
                .post('/trackers')
                .send({
                    name: 'tracker name',
                    type: 'tracker type',
                    cid: 'tracker cid',
                    offChainImageUrl: '#'.repeat(129),
                    placeId: 'place id'
                })

            expect(response.status).toBe(400)
            expect(response.body).toEqual({
                error: 'ParameterTooLongError',
                message: 'offChainImageUrl is too long'
            })
        })
    })

    describe('get trackers endpoint', function () {
        it('should return 200 when getting trackers and all is fine', async () => {
            mockTrackerRepository.getTrackers.mockImplementation(() => ({
                trackers: [
                    {
                        id: 'tracker-id-1',
                        created: 'tracker-date-1'
                    },
                    {
                        id: 'tracker-id-2',
                        created: 'tracker-date-2'
                    }
                ]
            }))

            const response = await request(app.callback()).get('/places/place-id/trackers?sort=asc&status=active&type=electricity-meter&pageSize=12&nextPageKey=page-key')

            expect(mockTrackerRepository.getTrackers).toHaveBeenCalledTimes(1)
            expect(mockTrackerRepository.getTrackers).toHaveBeenCalledWith({
                placeId: 'place-id',
                status: 'active',
                type: 'electricity-meter',
                sort: 'asc',
                nextPageKey: 'page-key',
                pageSize: '12'
            })

            expect(response.status).toBe(200)
            expect(response.body).toEqual({
                trackers: [
                    {
                        id: 'tracker-id-1',
                        created: 'tracker-date-1'
                    },
                    {
                        id: 'tracker-id-2',
                        created: 'tracker-date-2'
                    }
                ]
            })
        })
    })

    describe('get tracker endpoint', function () {
        it('should return 200 when getting tracker and user has wallet and has not opted in to the token', async () => {
            const tokenId = 'token-id'

            mockTrackerRepository.getTracker.mockImplementation(() => ({
                id: tokenId,
                userId: 'user-id',
                created: 'creation-date',
                name: 'tracker name'
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
                                        url: 'tracker url',
                                        reserve: 'tracker reserve'
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

            const response = await request(app.callback()).get(`/trackers/${tokenId}`)

            expect(mockTrackerRepository.getTracker).toHaveBeenCalledTimes(1)
            expect(mockTrackerRepository.getTracker).toHaveBeenCalledWith(tokenId)

            expect(mockUserRepository.getUserById).toHaveBeenCalledTimes(1)
            expect(mockUserRepository.getUserById).toHaveBeenCalledWith('user-id')

            expect(response.status).toBe(200)
            expect(response.body).toEqual({
                id: tokenId,
                userId: 'user-id',
                created: 'creation-date',
                name: 'tracker name',
                url: 'tracker url',
                reserve: 'tracker reserve',
                tokenCreatorOptIn: false,
                userWalletOwned: false
            })
        })

        it('should return 200 when getting tracker and user has wallet and has opted in to the token', async () => {
            const tokenId = 'token-id'

            mockTrackerRepository.getTracker.mockImplementation(() => ({
                id: tokenId,
                userId: 'user-id',
                created: 'creation-date',
                name: 'tracker name'
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
                                        url: 'tracker url',
                                        reserve: 'tracker reserve'
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

            const response = await request(app.callback()).get(`/trackers/${tokenId}`)

            expect(mockTrackerRepository.getTracker).toHaveBeenCalledTimes(1)
            expect(mockTrackerRepository.getTracker).toHaveBeenCalledWith(tokenId)

            expect(mockUserRepository.getUserById).toHaveBeenCalledTimes(1)
            expect(mockUserRepository.getUserById).toHaveBeenCalledWith('user-id')

            expect(response.status).toBe(200)
            expect(response.body).toEqual({
                id: tokenId,
                userId: 'user-id',
                created: 'creation-date',
                name: 'tracker name',
                url: 'tracker url',
                reserve: 'tracker reserve',
                tokenCreatorOptIn: true,
                userWalletOwned: false
            })
        })

        it('should return 200 when getting tracker and user has token in wallet', async () => {
            const tokenId = 'token-id'

            mockTrackerRepository.getTracker.mockImplementation(() => ({
                id: tokenId,
                userId: 'user-id',
                created: 'creation-date',
                name: 'tracker name'
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
                                        url: 'tracker url',
                                        reserve: 'tracker reserve'
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

            const response = await request(app.callback()).get(`/trackers/${tokenId}`)

            expect(mockTrackerRepository.getTracker).toHaveBeenCalledTimes(1)
            expect(mockTrackerRepository.getTracker).toHaveBeenCalledWith(tokenId)

            expect(mockUserRepository.getUserById).toHaveBeenCalledTimes(1)
            expect(mockUserRepository.getUserById).toHaveBeenCalledWith('user-id')

            expect(response.status).toBe(200)
            expect(response.body).toEqual({
                id: tokenId,
                userId: 'user-id',
                created: 'creation-date',
                name: 'tracker name',
                url: 'tracker url',
                reserve: 'tracker reserve',
                tokenCreatorOptIn: true,
                userWalletOwned: true
            })
        })

        it('should return 200 when getting tracker and user has registered wallet and asset not found in indexer', async () => {
            const tokenId = 'token-id'

            mockTrackerRepository.getTracker.mockImplementation(() => ({
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

            const response = await request(app.callback()).get(`/trackers/${tokenId}`)

            expect(mockTrackerRepository.getTracker).toHaveBeenCalledTimes(1)
            expect(mockTrackerRepository.getTracker).toHaveBeenCalledWith(tokenId)

            expect(mockUserRepository.getUserById).toHaveBeenCalledTimes(1)
            expect(mockUserRepository.getUserById).toHaveBeenCalledWith('user-id')

            expect(response.status).toBe(404)
            expect(response.body).toEqual({
                error: 'AssetNotFoundError',
                message: 'Asset specified not found'
            })
        })

        it('should return 200 when getting tracker and user does not have registered wallet', async () => {
            const tokenId = 'token-id'

            mockTrackerRepository.getTracker.mockImplementation(() => ({
                id: tokenId,
                userId: 'user-id',
                created: 'creation-date',
                name: 'tracker name'
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
                                url: 'tracker url',
                                reserve: 'tracker reserve'
                            }
                        }
                    }
                })
            })

            const response = await request(app.callback()).get(`/trackers/${tokenId}`)

            expect(mockTrackerRepository.getTracker).toHaveBeenCalledTimes(1)
            expect(mockTrackerRepository.getTracker).toHaveBeenCalledWith(tokenId)

            expect(mockUserRepository.getUserById).toHaveBeenCalledTimes(1)
            expect(mockUserRepository.getUserById).toHaveBeenCalledWith('user-id')

            expect(response.status).toBe(200)
            expect(response.body).toEqual({
                id: tokenId,
                userId: 'user-id',
                created: 'creation-date',
                name: 'tracker name',
                url: 'tracker url',
                reserve: 'tracker reserve'
            })
        })

        it('should return 200 when getting tracker and token not found in indexer', async () => {
            const tokenId = 'token-id'

            mockTrackerRepository.getTracker.mockImplementation(() => ({
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

            const response = await request(app.callback()).get(`/trackers/${tokenId}`)

            expect(mockTrackerRepository.getTracker).toHaveBeenCalledTimes(1)
            expect(mockTrackerRepository.getTracker).toHaveBeenCalledWith(tokenId)

            expect(mockUserRepository.getUserById).toHaveBeenCalledTimes(1)
            expect(mockUserRepository.getUserById).toHaveBeenCalledWith('user-id')

            expect(response.status).toBe(404)
            expect(response.body).toEqual({
                error: 'AssetNotFoundError',
                message: 'Asset specified not found'
            })
        })

        it('should return 200 when getting tracker and token deleted in indexer', async () => {
            const tokenId = 'token-id'

            mockTrackerRepository.getTracker.mockImplementation(() => ({
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
                                url: 'tracker url',
                                reserve: 'tracker reserve'
                            }
                        }
                    }
                })
            })

            const response = await request(app.callback()).get(`/trackers/${tokenId}`)

            expect(mockTrackerRepository.getTracker).toHaveBeenCalledTimes(1)
            expect(mockTrackerRepository.getTracker).toHaveBeenCalledWith(tokenId)

            expect(mockUserRepository.getUserById).toHaveBeenCalledTimes(1)
            expect(mockUserRepository.getUserById).toHaveBeenCalledWith('user-id')

            expect(response.status).toBe(404)
            expect(response.body).toEqual({
                error: 'AssetNotFoundError',
                message: 'Asset specified not found'
            })
        })
    })

    describe('update tracker endpoint', function () {
        it('should return 204 when admin updates trackers properties and all is fine', async () => {
            const tokenId = '1234'

            mockUserRepository.getUserByOauthId.mockImplementation(() => ({
                id: 'user-id-1',
                permissions: [0]
            }))

            mockTrackerRepository.getTracker.mockImplementation(() => ({
                id: tokenId,
                userId: 'user-id-2'
            }))

            const response = await request(app.callback()).put(`/trackers/${tokenId}`).send({
                utilityName: 'utility-name',
                utilityAccountId: 'account-id',
                utilityAccountApiKey: 'account-api-key',
                meterMpan: 'meter-mpan',
                meterMprn: 'meter-mprn',
                meterSerialNumber: 'meter-serial-number'
            })

            expect(mockUserRepository.getUserByOauthId).toHaveBeenCalledTimes(1)
            expect(mockUserRepository.getUserByOauthId).toHaveBeenCalledWith('jwt_sub')

            expect(mockTrackerRepository.getTracker).toHaveBeenCalledTimes(1)
            expect(mockTrackerRepository.getTracker).toHaveBeenCalledWith(tokenId)

            expect(mockTrackerRepository.updateTracker).toHaveBeenCalledTimes(1)
            expect(mockTrackerRepository.updateTracker).toHaveBeenCalledWith({
                tokenId: tokenId,
                utilityName: 'utility-name',
                utilityAccountId: 'account-id',
                utilityAccountApiKey: 'account-api-key',
                meterMpan: 'meter-mpan',
                meterMprn: 'meter-mprn',
                meterSerialNumber: 'meter-serial-number'
            })

            expect(response.status).toBe(204)
            expect(response.body).toEqual({})
        })

        it('should return 204 when non admin updates their own trackers properties', async () => {
            const tokenId = '1234'

            mockUserRepository.getUserByOauthId.mockImplementation(() => ({
                id: 'user-id-1',
                permissions: []
            }))

            mockTrackerRepository.getTracker.mockImplementation(() => ({
                id: tokenId,
                userId: 'user-id-1'
            }))

            const response = await request(app.callback()).put(`/trackers/${tokenId}`).send({
                utilityAccountId: 'account-id',
                utilityAccountApiKey: 'account-api-key'
            })

            expect(mockUserRepository.getUserByOauthId).toHaveBeenCalledTimes(1)
            expect(mockUserRepository.getUserByOauthId).toHaveBeenCalledWith('jwt_sub')

            expect(mockTrackerRepository.getTracker).toHaveBeenCalledTimes(1)
            expect(mockTrackerRepository.getTracker).toHaveBeenCalledWith(tokenId)

            expect(mockTrackerRepository.updateTracker).toHaveBeenCalledTimes(1)
            expect(mockTrackerRepository.updateTracker).toHaveBeenCalledWith({
                tokenId: tokenId,
                utilityAccountId: 'account-id',
                utilityAccountApiKey: 'account-api-key'
            })

            expect(response.status).toBe(204)
            expect(response.body).toEqual({})
        })

        it('should return 204 when non admin updates others trackers properties', async () => {
            const tokenId = '1234'

            mockUserRepository.getUserByOauthId.mockImplementation(() => ({
                id: 'user-id-1',
                permissions: []
            }))

            mockTrackerRepository.getTracker.mockImplementation(() => ({
                id: tokenId,
                userId: 'user-id-2'
            }))

            const response = await request(app.callback()).put(`/trackers/${tokenId}`).send({
                utilityAccountId: 'account-id',
                utilityAccountApiKey: 'account-api-key'
            })

            expect(mockUserRepository.getUserByOauthId).toHaveBeenCalledTimes(1)
            expect(mockUserRepository.getUserByOauthId).toHaveBeenCalledWith('jwt_sub')

            expect(mockTrackerRepository.getTracker).toHaveBeenCalledTimes(1)
            expect(mockTrackerRepository.getTracker).toHaveBeenCalledWith(tokenId)

            expect(mockTrackerRepository.updateTracker).not.toHaveBeenCalled()
            expect(response.status).toBe(403)
            expect(response.body).toEqual({
                error: 'UserUnauthorizedError',
                message: 'The authenticated user is not authorized to perform this action'
            })
        })
    })

    describe('post readings endpoint', function () {
        it('should return 201 when posting new reading and all is fine', async () => {
            mockStdlib.newAccountFromMnemonic.mockImplementation(() => ({
                networkAccount: { addr: 'wallet_address' }
            }))

            mockUserRepository.getUserByOauthId.mockImplementation(() => ({
                id: 'user_id',
                permissions: [0]
            }))

            aes256encrypt.mockImplementation(() => ({ iv: 'enc-iv', encryptedData: 'end-data' }))

            mockStdlib.getProvider.mockImplementation(() =>
                Promise.resolve({
                    algodClient: {
                        getTransactionParams: () => ({ do: async () => Promise.resolve({ param: 'txn_param' }) }),
                        sendRawTransaction: () => ({ do: async () => Promise.resolve({ txId: 'txn_id' }) })
                    }
                })
            )

            const mockSignedTnx = jest.fn().mockImplementation(() => 'signed_txn')

            mockStdlib.makePaymentTxnWithSuggestedParamsFromObject.mockImplementation(() => ({
                signTxn: mockSignedTnx
            }))

            const response = await request(app.callback()).post('/readings').send({
                trackerId: 'tracker_id',
                value: '12345',
                unit: 'kwh'
            })

            expect(aes256encrypt).toHaveBeenCalledTimes(1)
            expect(aes256encrypt).toHaveBeenCalledWith('12345')

            expect(mockTrackerRepository.createReading).toHaveBeenCalledTimes(1)
            expect(mockTrackerRepository.createReading).toHaveBeenCalledWith({
                encryptionIV: 'enc-iv',
                id: 'txn_id',
                isAdmin: true,
                trackerId: 'tracker_id',
                userId: 'user_id'
            })

            expect(response.status).toBe(201)
            expect(response.body).toEqual({
                id: 'txn_id'
            })
        })

        it('should return 400 when reading trackerId is missing', async () => {
            const response = await request(app.callback()).post('/readings').send({
                value: '12345',
                unit: 'kwh'
            })

            expect(response.status).toBe(400)
            expect(response.body).toEqual({
                error: 'MissingParameterError',
                message: 'trackerId must be specified'
            })
        })

        it('should return 400 when reading value is missing', async () => {
            const response = await request(app.callback()).post('/readings').send({
                trackerId: '12345',
                unit: 'kwh'
            })

            expect(response.status).toBe(400)
            expect(response.body).toEqual({
                error: 'MissingParameterError',
                message: 'value must be specified'
            })
        })

        it('should return 400 when reading unit is missing', async () => {
            const response = await request(app.callback()).post('/readings').send({
                trackerId: '12345',
                value: '14'
            })

            expect(response.status).toBe(400)
            expect(response.body).toEqual({
                error: 'MissingParameterError',
                message: 'unit must be specified'
            })
        })
    })

    describe('get readings endpoint', function () {
        it('should return 200 when getting readings with no encryption', async () => {
            mockTrackerRepository.getReadings.mockImplementation(() => ({
                readings: [
                    {
                        id: 'id-1',
                        created: 'reading-date-1'
                    },
                    {
                        id: 'id-2',
                        created: 'reading-date-2'
                    },
                    {
                        id: 'id-3',
                        created: 'reading-date-3'
                    }
                ]
            }))

            mockAlgoIndexer.callAlgonodeIndexerEndpoint.mockImplementation(params => {
                const txnId = params.replace('transactions/', '')
                if (txnId === 'id-1' || txnId == 'id-2') {
                    return Promise.resolve({
                        status: 200,
                        json: {
                            transaction: {
                                index: `txn-${txnId}`,
                                note: Buffer.from(JSON.stringify({ encryption: 'none', value: 1234, unit: 'kwh' })).toString('base64')
                            }
                        }
                    })
                } else {
                    return Promise.resolve({
                        status: 404
                    })
                }
            })

            const response = await request(app.callback()).get('/trackers/tracking-id/readings?sort=asc&status=active&pageSize=12&nextPageKey=page-key')

            expect(mockTrackerRepository.getReadings).toHaveBeenCalledTimes(1)
            expect(mockTrackerRepository.getReadings).toHaveBeenCalledWith({
                trackerId: 'tracking-id',
                nextPageKey: 'page-key',
                pageSize: '12',
                sort: 'asc',
                status: 'active'
            })

            expect(mockAlgoIndexer.callAlgonodeIndexerEndpoint).toHaveBeenCalledTimes(3)
            expect(mockAlgoIndexer.callAlgonodeIndexerEndpoint).toHaveBeenCalledWith('transactions/id-1')
            expect(mockAlgoIndexer.callAlgonodeIndexerEndpoint).toHaveBeenCalledWith('transactions/id-2')
            expect(mockAlgoIndexer.callAlgonodeIndexerEndpoint).toHaveBeenCalledWith('transactions/id-3')

            expect(response.status).toBe(200)
            expect(response.body).toEqual({
                readings: [
                    {
                        id: 'id-1',
                        value: 1234,
                        unit: 'kwh',
                        created: 'reading-date-1'
                    },
                    {
                        id: 'id-2',
                        value: 1234,
                        unit: 'kwh',
                        created: 'reading-date-2'
                    }
                ]
            })
        })

        it('should return 200 when getting readings with aes 256 encryption', async () => {
            mockTrackerRepository.getReadings.mockImplementation(() => ({
                readings: [
                    {
                        id: 'id-1',
                        created: 'reading-date-1'
                    },
                    {
                        id: 'id-2',
                        created: 'reading-date-2'
                    },
                    {
                        id: 'id-3',
                        created: 'reading-date-3'
                    }
                ]
            }))

            mockAlgoIndexer.callAlgonodeIndexerEndpoint.mockImplementation(params => {
                const txnId = params.replace('transactions/', '')
                if (txnId === 'id-1' || txnId == 'id-2') {
                    return Promise.resolve({
                        status: 200,
                        json: {
                            transaction: {
                                index: `txn-${txnId}`,
                                note: Buffer.from(JSON.stringify({ encryption: 'aes256', value: 1234, unit: 'kwh' })).toString('base64')
                            }
                        }
                    })
                } else {
                    return Promise.resolve({
                        status: 404
                    })
                }
            })

            aes256decrypt.mockImplementation(() => 'decrypted-value')

            const response = await request(app.callback()).get('/trackers/tracking-id/readings?sort=asc&status=active&pageSize=12&nextPageKey=page-key')

            expect(mockTrackerRepository.getReadings).toHaveBeenCalledTimes(1)
            expect(mockTrackerRepository.getReadings).toHaveBeenCalledWith({
                trackerId: 'tracking-id',
                nextPageKey: 'page-key',
                pageSize: '12',
                sort: 'asc',
                status: 'active'
            })

            expect(mockAlgoIndexer.callAlgonodeIndexerEndpoint).toHaveBeenCalledTimes(3)
            expect(mockAlgoIndexer.callAlgonodeIndexerEndpoint).toHaveBeenCalledWith('transactions/id-1')
            expect(mockAlgoIndexer.callAlgonodeIndexerEndpoint).toHaveBeenCalledWith('transactions/id-2')
            expect(mockAlgoIndexer.callAlgonodeIndexerEndpoint).toHaveBeenCalledWith('transactions/id-3')

            expect(aes256decrypt).toHaveBeenCalledTimes(2)

            expect(response.status).toBe(200)
            expect(response.body).toEqual({
                readings: [
                    {
                        id: 'id-1',
                        value: 'decrypted-value',
                        unit: 'kwh',
                        created: 'reading-date-1'
                    },
                    {
                        id: 'id-2',
                        value: 'decrypted-value',
                        unit: 'kwh',
                        created: 'reading-date-2'
                    }
                ]
            })
        })

        it('should return 200 when getting readings with no note', async () => {
            mockTrackerRepository.getReadings.mockImplementation(() => ({
                readings: [
                    {
                        id: 'id-1',
                        created: 'reading-date-1'
                    },
                    {
                        id: 'id-2',
                        created: 'reading-date-2'
                    },
                    {
                        id: 'id-3',
                        created: 'reading-date-3'
                    }
                ]
            }))

            mockAlgoIndexer.callAlgonodeIndexerEndpoint.mockImplementation(params => {
                const txnId = params.replace('transactions/', '')
                if (txnId === 'id-1' || txnId == 'id-2') {
                    return Promise.resolve({
                        status: 200,
                        json: {
                            transaction: {
                                index: `txn-${txnId}`,
                                ...(txnId === 'id-1' && { note: Buffer.from(JSON.stringify({ encryption: 'aes256', value: 1234, unit: 'kwh' })).toString('base64') })
                            }
                        }
                    })
                } else {
                    return Promise.resolve({
                        status: 404
                    })
                }
            })

            aes256decrypt.mockImplementation(() => 'decrypted-value')

            const response = await request(app.callback()).get('/trackers/tracking-id/readings?sort=asc&status=active&pageSize=12&nextPageKey=page-key')

            expect(mockTrackerRepository.getReadings).toHaveBeenCalledTimes(1)
            expect(mockTrackerRepository.getReadings).toHaveBeenCalledWith({
                trackerId: 'tracking-id',
                nextPageKey: 'page-key',
                pageSize: '12',
                sort: 'asc',
                status: 'active'
            })

            expect(mockAlgoIndexer.callAlgonodeIndexerEndpoint).toHaveBeenCalledTimes(3)
            expect(mockAlgoIndexer.callAlgonodeIndexerEndpoint).toHaveBeenCalledWith('transactions/id-1')
            expect(mockAlgoIndexer.callAlgonodeIndexerEndpoint).toHaveBeenCalledWith('transactions/id-2')
            expect(mockAlgoIndexer.callAlgonodeIndexerEndpoint).toHaveBeenCalledWith('transactions/id-3')

            expect(aes256decrypt).toHaveBeenCalledTimes(1)

            expect(response.status).toBe(200)
            expect(response.body).toEqual({
                readings: [
                    {
                        id: 'id-1',
                        value: 'decrypted-value',
                        unit: 'kwh',
                        created: 'reading-date-1'
                    },
                    {
                        id: 'id-2',
                        created: 'reading-date-2'
                    }
                ]
            })
        })

        it('should return 200 when getting readings with no base 64 note', async () => {
            mockTrackerRepository.getReadings.mockImplementation(() => ({
                readings: [
                    {
                        id: 'id-1',
                        created: 'reading-date-1'
                    },
                    {
                        id: 'id-2',
                        created: 'reading-date-2'
                    },
                    {
                        id: 'id-3',
                        created: 'reading-date-3'
                    }
                ]
            }))

            mockAlgoIndexer.callAlgonodeIndexerEndpoint.mockImplementation(params => {
                const txnId = params.replace('transactions/', '')
                if (txnId === 'id-1' || txnId == 'id-2') {
                    return Promise.resolve({
                        status: 200,
                        json: {
                            transaction: {
                                index: `txn-${txnId}`,
                                ...(txnId === 'id-1' && { note: Buffer.from(JSON.stringify({ encryption: 'aes256', value: 1234, unit: 'kwh' })).toString('base64') }),
                                ...(txnId === 'id-2' && { note: 'meh' })
                            }
                        }
                    })
                } else {
                    return Promise.resolve({
                        status: 404
                    })
                }
            })

            aes256decrypt.mockImplementation(() => 'decrypted-value')

            const response = await request(app.callback()).get('/trackers/tracking-id/readings?sort=asc&status=active&pageSize=12&nextPageKey=page-key')

            expect(mockTrackerRepository.getReadings).toHaveBeenCalledTimes(1)
            expect(mockTrackerRepository.getReadings).toHaveBeenCalledWith({
                trackerId: 'tracking-id',
                nextPageKey: 'page-key',
                pageSize: '12',
                sort: 'asc',
                status: 'active'
            })

            expect(mockAlgoIndexer.callAlgonodeIndexerEndpoint).toHaveBeenCalledTimes(3)
            expect(mockAlgoIndexer.callAlgonodeIndexerEndpoint).toHaveBeenCalledWith('transactions/id-1')
            expect(mockAlgoIndexer.callAlgonodeIndexerEndpoint).toHaveBeenCalledWith('transactions/id-2')
            expect(mockAlgoIndexer.callAlgonodeIndexerEndpoint).toHaveBeenCalledWith('transactions/id-3')

            expect(aes256decrypt).toHaveBeenCalledTimes(1)

            expect(response.status).toBe(200)
            expect(response.body).toEqual({
                readings: [
                    {
                        id: 'id-1',
                        value: 'decrypted-value',
                        unit: 'kwh',
                        created: 'reading-date-1'
                    }
                ]
            })
        })
    })

    describe('get reading endpoint', function () {
        it('should return 200 when getting reading with non encrypted value', async () => {
            mockTrackerRepository.getReading.mockImplementation(() => ({
                id: 'id-1',
                created: 'creation-date'
            }))

            mockAlgoIndexer.callAlgonodeIndexerEndpoint.mockImplementation(() => {
                return Promise.resolve({
                    status: 200,
                    json: {
                        transaction: {
                            index: 'txn-1',
                            note: Buffer.from(JSON.stringify({ encryption: 'none', value: 1234, unit: 'kwh' })).toString('base64')
                        }
                    }
                })
            })

            const response = await request(app.callback()).get('/readings/id-1')

            expect(mockTrackerRepository.getReading).toHaveBeenCalledTimes(1)
            expect(mockTrackerRepository.getReading).toHaveBeenCalledWith('id-1')

            expect(mockAlgoIndexer.callAlgonodeIndexerEndpoint).toHaveBeenCalledTimes(1)
            expect(mockAlgoIndexer.callAlgonodeIndexerEndpoint).toHaveBeenCalledWith('transactions/id-1')

            expect(aes256decrypt).not.toHaveBeenCalled()

            expect(response.status).toBe(200)
            expect(response.body).toEqual({
                id: 'id-1',
                value: 1234,
                unit: 'kwh',
                created: 'creation-date'
            })
        })

        it('should return 200 when getting reading with encrypted value', async () => {
            mockTrackerRepository.getReading.mockImplementation(() => ({
                id: 'id-1',
                created: 'creation-date'
            }))

            mockAlgoIndexer.callAlgonodeIndexerEndpoint.mockImplementation(() => {
                return Promise.resolve({
                    status: 200,
                    json: {
                        transaction: {
                            index: 'txn-1',
                            note: Buffer.from(JSON.stringify({ encryption: 'aes256', value: 1234, unit: 'kwh' })).toString('base64')
                        }
                    }
                })
            })

            aes256decrypt.mockImplementation(() => 'decrypted-value')

            const response = await request(app.callback()).get('/readings/id-1')

            expect(mockTrackerRepository.getReading).toHaveBeenCalledTimes(1)
            expect(mockTrackerRepository.getReading).toHaveBeenCalledWith('id-1')

            expect(mockAlgoIndexer.callAlgonodeIndexerEndpoint).toHaveBeenCalledTimes(1)
            expect(mockAlgoIndexer.callAlgonodeIndexerEndpoint).toHaveBeenCalledWith('transactions/id-1')

            expect(aes256decrypt).toHaveBeenCalledTimes(1)

            expect(response.status).toBe(200)
            expect(response.body).toEqual({
                id: 'id-1',
                value: 'decrypted-value',
                unit: 'kwh',
                created: 'creation-date'
            })
        })

        it('should return 404 when reading not found', async () => {
            mockTrackerRepository.getReading.mockImplementation(() => ({
                id: 'id-1',
                created: 'creation-date'
            }))

            mockAlgoIndexer.callAlgonodeIndexerEndpoint.mockImplementation(() => {
                return Promise.resolve({
                    status: 404
                })
            })

            const response = await request(app.callback()).get('/readings/id-1')

            expect(mockTrackerRepository.getReading).toHaveBeenCalledTimes(1)
            expect(mockTrackerRepository.getReading).toHaveBeenCalledWith('id-1')

            expect(mockAlgoIndexer.callAlgonodeIndexerEndpoint).toHaveBeenCalledTimes(1)
            expect(mockAlgoIndexer.callAlgonodeIndexerEndpoint).toHaveBeenCalledWith('transactions/id-1')

            expect(aes256decrypt).not.toHaveBeenCalled()

            expect(response.status).toBe(404)
            expect(response.body).toEqual({
                error: 'ReadingNotFoundError',
                message: 'Reading specified not found'
            })
        })
    })
})
