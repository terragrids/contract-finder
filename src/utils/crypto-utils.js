import crypto from 'crypto'

const AES_256 = 'aes-256-cbc'

export function aes256encrypt(text) {
    const iv = crypto.randomBytes(16)
    const key = new TextEncoder().encode(process.env.READINGS_CRYPTO_KEY)
    let cipher = crypto.createCipheriv(AES_256, Buffer.from(key), iv)
    let encrypted = cipher.update(text)
    encrypted = Buffer.concat([encrypted, cipher.final()])
    return { iv: iv.toString('hex'), encryptedData: encrypted.toString('hex') }
}

export function aes256decrypt(text, iv) {
    let encryptedText = Buffer.from(text, 'hex')
    const key = new TextEncoder().encode(process.env.READINGS_CRYPTO_KEY)
    let decipher = crypto.createDecipheriv(AES_256, Buffer.from(key), Buffer.from(iv, 'hex'))
    let decrypted = decipher.update(encryptedText)
    decrypted = Buffer.concat([decrypted, decipher.final()])
    return decrypted.toString()
}
