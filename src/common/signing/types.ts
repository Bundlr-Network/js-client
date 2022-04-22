import { Signer } from "./Signer";
export interface JWKInterface extends JWKPublicInterface {
    d?: string;
    p?: string;
    q?: string;
    dp?: string;
    dq?: string;
    qi?: string;
}


export interface JWKPublicInterface {
    kty: string;
    e: string;
    n: string;
}

// export interface IndexToPackage {
//     [key: number]: string
// }

export interface IndexToType {
    [key: number]: {
        new(...args: any[]): Signer;
        readonly signatureLength: number;
        readonly ownerLength: number;
        verify(
            pk: string | Uint8Array,
            message: Uint8Array,
            signature: Uint8Array,
        ): Promise<boolean>;
    };
}