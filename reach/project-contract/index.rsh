'reach 0.1'
'use strict'

/**
 * The Project Contract owns data fields which represent a Terragrids Creator's project.
 * Data fields are:
 * 1/ name: the project name
 * 2/ url: a URL pointing to the IPFS location of the project metadata
 * 3/ hash: the project metadata integrity hash
 * 4/ creator: the creator wallet address
 * This is similar to the data stored in an ARC3 NFT.
 * Creators can update their project details by replacing the current name or URL with new values
 * using the API exposed by this smart contract.
 */

export const main = Reach.App(() => {
    const A = Participant('Admin', {
        ...hasConsoleLogger,
        onReady: Fun(true, Null),
        name: Bytes(128),
        url: Bytes(128),
        hash: Bytes(32),
        creator: Address
    })

    const ProjectView = View('View', {
        name: Bytes(128),
        url: Bytes(128),
        hash: Bytes(32),
        creator: Address
    })

    const Api = API('Api', {
        updateName: Fun([Bytes(128)], Null),
        updateMetadata: Fun([Bytes(128), Bytes(32)], Null),
        stop: Fun([], Bool)
    })

    init()

    A.only(() => {
        const [projectName, metadataUrl, metadataHash, creator] = declassify([interact.name, interact.url, interact.hash, interact.creator])
    })

    A.publish(projectName, metadataUrl, metadataHash, creator)

    A.interact.onReady(getContract())
    A.interact.log('The project contract is ready')

    const [done, name, url, hash] = parallelReduce([false, projectName, metadataUrl, metadataHash])
        .define(() => {
            ProjectView.name.set(name)
            ProjectView.url.set(url)
            ProjectView.hash.set(hash)
            ProjectView.creator.set(creator)
        })
        .invariant(balance() == 0)
        .while(!done)
        /**
         * Update project name
         */
        .api(Api.updateName, (newName, k) => {
            k(null)
            return [false, newName, url, hash]
        })
        /**
         * Update project metadata
         */
        .api(Api.updateMetadata, (newUrl, newHash, k) => {
            k(null)
            return [false, name, newUrl, newHash]
        })
        /**
         * Stops this contract
         */
        .api(
            Api.stop,
            () => {
                assume(this == A)
            },
            () => 0,
            k => {
                const isAdmin = this == A
                require(isAdmin)
                k(isAdmin)
                return [true, name, url, hash]
            }
        )
        .timeout(false)

    commit()
    A.interact.log('The project contract is closing down...')
    exit()
})
