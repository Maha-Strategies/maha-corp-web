declare module 'adilosjs' {
  export function fromHexString(hexString: string): Uint8Array
  export function toHexString(value: Uint8Array): string
  export function makeChallenge(sessionKey: Uint8Array): string
  export function makeResponse(challenge: string, privateKey: Uint8Array): string | null
  export function validateResponse(response: string, challenge: string): Uint8Array | null
}

declare module 'ecjsonrpc' {
  export type BlackMessage = { msghex: string; sighex: string; spkhex: string }
  export function blackToRed(privateKeyHex: string, message: BlackMessage): unknown
  export function redToBlack(privateKeyHex: string, publicKeyHex: string | Uint8Array, message: unknown): BlackMessage
}

declare module 'canonicalize' {
  export default function canonicalize(value: unknown): string | undefined
}

declare module 'secp256k1' {
  const secp256k1: {
    privateKeyVerify(privateKey: Uint8Array): boolean
    publicKeyCreate(privateKey: Uint8Array, compressed?: boolean): Uint8Array
    publicKeyConvert(publicKey: Uint8Array, compressed?: boolean): Uint8Array
    ecdsaSign(messageHash: Uint8Array, privateKey: Uint8Array): { signature: Uint8Array; recid: number }
    ecdsaVerify(signature: Uint8Array, messageHash: Uint8Array, publicKey: Uint8Array): boolean
  }
  export default secp256k1
}
