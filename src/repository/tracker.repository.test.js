import TrackerRepository from './tracker.repository.js'
import DynamoDbRepository from './dynamodb.repository.js'

jest.mock('./dynamodb.repository.js')
const realDate = Date.now

describe('tracker.repository', function () {
    beforeAll(() => {
        global.Date.now = jest.fn(() => new Date('2023-09-19T10:20:30Z').getTime())
    })

    beforeEach(() => {
        DynamoDbRepository.mockClear()
    })

    afterAll(() => {
        global.Date.now = realDate
    })

    describe('create readings', function () {
        it('should not make transaction with no readings', async () => {
            const repository = new TrackerRepository()
            await repository.createReadings({
                trackerId: 'tracker-id',
                placeId: 'place-id',
                userId: 'user-id',
                isAdmin: true,
                readings: []
            })

            expect(DynamoDbRepository.mock.instances[0].transactWrite).not.toHaveBeenCalled()
        })

        it('should make transaction with readings', async () => {
            const repository = new TrackerRepository()
            await repository.createReadings({
                trackerId: 'tracker-id',
                placeId: 'place-id',
                userId: 'user-id',
                isAdmin: true,
                readings: [
                    {
                        id: 'reading-1',
                        type: 'consumption',
                        cycle: 'weekly',
                        value: 100,
                        start: 1,
                        end: 2,
                        encryptionIV: 'encryption-iv'
                    },
                    {
                        id: 'reading-2',
                        type: 'consumption',
                        cycle: 'weekly',
                        value: 101,
                        start: 3,
                        end: 4,
                        encryptionIV: 'encryption-iv'
                    },
                    {
                        id: 'reading-3',
                        type: 'consumption',
                        cycle: 'daily',
                        value: 102,
                        start: 5,
                        end: 6,
                        encryptionIV: 'encryption-iv'
                    },
                    {
                        id: 'reading-4',
                        type: 'absolute',
                        encryptionIV: 'encryption-iv'
                    },
                    // no cycle
                    {
                        id: 'reading-5',
                        type: 'consumption',
                        value: 100,
                        start: 1,
                        end: 2,
                        encryptionIV: 'encryption-iv'
                    },
                    // no value
                    {
                        id: 'reading-6',
                        type: 'consumption',
                        cycle: 'daily',
                        start: 1,
                        end: 2,
                        encryptionIV: 'encryption-iv'
                    },
                    // no start
                    {
                        id: 'reading-7',
                        type: 'consumption',
                        cycle: 'daily',
                        value: 55,
                        end: 2,
                        encryptionIV: 'encryption-iv'
                    },
                    // no end
                    {
                        id: 'reading-8',
                        type: 'consumption',
                        cycle: 'daily',
                        value: 55,
                        start: 2,
                        encryptionIV: 'encryption-iv'
                    },
                    // unknown type
                    {
                        id: 'reading-9',
                        type: 'unknown',
                        cycle: 'daily',
                        value: 55,
                        start: 2,
                        end: 3,
                        encryptionIV: 'encryption-iv'
                    }
                ]
            })

            expect(DynamoDbRepository.mock.instances[0].transactWrite).toHaveBeenCalledTimes(1)
            expect(DynamoDbRepository.mock.instances[0].transactWrite).toHaveBeenCalledWith({
                items: [
                    {
                        command: 'Put',
                        data: {
                            created: {
                                N: '1695118830000'
                            },
                            data: {
                                S: 'reading|active|weekly|1'
                            },
                            gsi1pk: {
                                S: 'tracker|tracker-id'
                            },
                            gsi2pk: {
                                S: 'type|reading|consumption'
                            },
                            hash: {
                                S: 'encryption-iv'
                            },
                            pk: {
                                S: 'reading|reading-1'
                            },
                            placeId: {
                                S: 'place-id'
                            },
                            userId: {
                                S: 'user-id'
                            }
                        }
                    },
                    {
                        command: 'Put',
                        data: {
                            created: {
                                N: '1695118830000'
                            },
                            data: {
                                S: 'reading|active|weekly|3'
                            },
                            gsi1pk: {
                                S: 'tracker|tracker-id'
                            },
                            gsi2pk: {
                                S: 'type|reading|consumption'
                            },
                            hash: {
                                S: 'encryption-iv'
                            },
                            pk: {
                                S: 'reading|reading-2'
                            },
                            placeId: {
                                S: 'place-id'
                            },
                            userId: {
                                S: 'user-id'
                            }
                        }
                    },
                    {
                        command: 'Put',
                        data: {
                            created: {
                                N: '1695118830000'
                            },
                            data: {
                                S: 'reading|active|daily|5'
                            },
                            gsi1pk: {
                                S: 'tracker|tracker-id'
                            },
                            gsi2pk: {
                                S: 'type|reading|consumption'
                            },
                            hash: {
                                S: 'encryption-iv'
                            },
                            pk: {
                                S: 'reading|reading-3'
                            },
                            placeId: {
                                S: 'place-id'
                            },
                            userId: {
                                S: 'user-id'
                            }
                        }
                    },
                    {
                        command: 'Put',
                        data: {
                            created: {
                                N: '1695118830000'
                            },
                            data: {
                                S: 'reading|active|absolute|1695118830000'
                            },
                            gsi1pk: {
                                S: 'tracker|tracker-id'
                            },
                            gsi2pk: {
                                S: 'type|reading|absolute'
                            },
                            hash: {
                                S: 'encryption-iv'
                            },
                            pk: {
                                S: 'reading|reading-4'
                            },
                            placeId: {
                                S: 'place-id'
                            },
                            userId: {
                                S: 'user-id'
                            }
                        }
                    },
                    {
                        command: 'Put',
                        data: {
                            data: {
                                S: 'imp-ts|1'
                            },
                            gsi1pk: {
                                S: 'tracker|tracker-id'
                            },
                            gsi2pk: {
                                S: 'type|imp-ts'
                            },
                            pk: {
                                S: 'consumption|tracker-id|1|2'
                            }
                        }
                    },
                    {
                        command: 'Put',
                        data: {
                            data: {
                                S: 'imp-ts|3'
                            },
                            gsi1pk: {
                                S: 'tracker|tracker-id'
                            },
                            gsi2pk: {
                                S: 'type|imp-ts'
                            },
                            pk: {
                                S: 'consumption|tracker-id|3|4'
                            }
                        }
                    },
                    {
                        command: 'Put',
                        data: {
                            data: {
                                S: 'imp-ts|5'
                            },
                            gsi1pk: {
                                S: 'tracker|tracker-id'
                            },
                            gsi2pk: {
                                S: 'type|imp-ts'
                            },
                            pk: {
                                S: 'consumption|tracker-id|5|6'
                            }
                        }
                    },
                    {
                        command: 'UpdateCounter',
                        counters: [
                            {
                                name: 'consumptionReadingCount',
                                change: 3
                            },
                            {
                                name: 'consumptionWeeklyReadingCount',
                                change: 2
                            },
                            {
                                name: 'consumptionDailyReadingCount',
                                change: 1
                            },
                            {
                                change: 201,
                                name: 'consumptionWeeklyReadingTotal'
                            },
                            {
                                change: 102,
                                name: 'consumptionDailyReadingTotal'
                            }
                        ],
                        key: {
                            pk: {
                                S: 'tracker|tracker-id'
                            }
                        }
                    },
                    {
                        command: 'UpdateCounter',
                        counters: [
                            {
                                change: 3,
                                name: 'consumptionReadingCount'
                            }
                        ],
                        key: {
                            pk: {
                                S: 'place|place-id'
                            }
                        }
                    },
                    {
                        command: 'UpdateCounter',
                        counters: [
                            {
                                change: 1,
                                name: 'absoluteReadingCount'
                            }
                        ],
                        key: {
                            pk: {
                                S: 'tracker|tracker-id'
                            }
                        }
                    },
                    {
                        command: 'UpdateCounter',
                        counters: [
                            {
                                change: 1,
                                name: 'absoluteReadingCount'
                            }
                        ],
                        key: {
                            pk: {
                                S: 'place|place-id'
                            }
                        }
                    }
                ],
                conditions: []
            })
        })
    })
})
