'use strict';

namespace jwcl {

   const crypto = window.crypto.subtle;

   export namespace utils {

      export const btos = function(array: Uint8Array): string {
         let string: string = '';
         for (let i = 0 ; i < array.length; i++) {
            string += String.fromCharCode(array[i]);
         }
         return string; 
      };

      export const stob = function(string: string): Uint8Array {
         const array: Uint8Array = new Uint8Array(string.length);
         for (let i = 0; i < string.length; i++) {
            array[i] = string.charCodeAt(i);
         }
         return array;
      };

      export const itob = function(number: number): Uint8Array {
         const array: Uint8Array = new Uint8Array(16);
         for (let i = 3; i >= 0; i--) {
            const scale = Math.pow(2,(i*8));
            array[i] = Math.floor(number/scale);
            number = number % scale; 
         }
         return array;
      };

      export const btoi = function (array: Uint8Array) {
         let number = 0;
         for (let i = 3; i >=0; i--) {
            const scale = Math.pow(2,(i*8));
            number += array[i] * scale; 
         }
         return number;
      };

      export const btob64 = function(array: Uint8Array): string {
         return window.btoa(btos(array));
      };

      export const b64tob = function(string: string): Uint8Array {
         return stob(window.atob(string));
      };

      export const stob64 = function(string: string): string {
         return window.btoa(string);
      };

      export const b64tos = function(string: string): string {
         return window.atob(string);
      };

   };

   export const random = function(bytes: number): string {
      const array: Uint8Array = new Uint8Array(bytes);
      window.crypto.getRandomValues(array);
      return utils.btob64(array);
   };

   export namespace hash {
 
      const hash = async function(name: string, plaintext: string): Promise<string> {
         return utils.btob64(new Uint8Array(await crypto.digest({
            name: name
         }, utils.stob(plaintext))));
      };
 
      export const sha1 = async function(plaintext: string): Promise<string> {
         return hash('SHA-1', plaintext);
      };
      
      export const sha256 = async function(plaintext: string): Promise<string> {
         return hash('SHA-256', plaintext);
      };

      export class hmac {
      
         private _key: string;
     
         public constructor (key: string) {
            this._key = key;
         }

         public async sign(plaintext: string): Promise<string> {
            const key: CryptoKey = await crypto.importKey('raw', utils.b64tob(this._key), {
               name: 'HMAC',
               hash: {name: 'SHA-256'}
            }, true, ['sign']);
            return utils.btob64(new Uint8Array(await crypto.sign('HMAC', key, utils.stob(plaintext))));
         }
         
         public async verify(signature: string, plaintext: string): Promise<boolean> {
            const key: CryptoKey = await crypto.importKey('raw', utils.b64tob(this._key), {
               name: 'HMAC',
               hash: {name: 'SHA-256'}
            }, true, ['verify']); 
            return await crypto.verify('HMAC', key, utils.b64tob(signature), utils.stob(plaintext));
         }
      };
   };

   export namespace cipher {
      
      export class aes {
         
         private _key: string;
         private _counter: number;   
         private static _COUNTER_BYTES: number = 16;
         private static _BLOCK_SIZE_BYTES: number = 16;

         public constructor(key: string) {
            this._key = key;
            this._counter = 0;
         }
         
         public async encrypt(plaintext: string): Promise<string> {
            const plaintextArray = utils.stob(plaintext);
            const counter = utils.itob(this._counter);
            this._counter += Math.ceil(plaintextArray.length/aes._BLOCK_SIZE_BYTES);
            const key: CryptoKey = await crypto.importKey('raw', utils.b64tob(this._key), { 
               name: 'AES-CTR'
            }, true, ['encrypt']);
            const rawCiphertextArray: Uint8Array = new Uint8Array(await crypto.encrypt({
               name: 'AES-CTR',
               counter: counter,
               length: 128,
            }, key, plaintextArray));
            const ciphertextArray: Uint8Array = new Uint8Array(aes._COUNTER_BYTES + rawCiphertextArray.length);
            ciphertextArray.set(counter, 0);
            ciphertextArray.set(rawCiphertextArray, aes._COUNTER_BYTES);
            return utils.btob64(ciphertextArray);    
         }

         public async decrypt(ciphertext: string): Promise<string> {
            const ciphertextArray: Uint8Array = utils.b64tob(ciphertext);
            const counter: Uint8Array = ciphertextArray.slice(0, aes._COUNTER_BYTES);
            const rawCiphertextArray: Uint8Array = ciphertextArray.slice(aes._COUNTER_BYTES, ciphertextArray.length); 
            const key: CryptoKey = await crypto.importKey('raw', utils.b64tob(this._key), { 
               name: 'AES-CTR'
            }, true, ['decrypt']);
            const plaintextArray: Uint8Array = new Uint8Array(await crypto.decrypt({
               name: 'AES-CTR',
               counter: counter,
               length: 128,
            }, key, rawCiphertextArray));
            this._counter = Math.max(this._counter, utils.btoi(counter) + Math.ceil(plaintextArray.length/aes._BLOCK_SIZE_BYTES));
            return utils.btos(plaintextArray);
         }
      }  
   }
  
   export namespace ecc {

      export interface key {
         publicKey: string,
         privateKey: string
      }

      export class ecdh {
  
         private _publicKey: string;
         private _privateKey: string;

         public constructor(key: key) {
            this._publicKey = key.publicKey;
            this._privateKey = key.privateKey;
         }

         static async generate(): Promise<key> {
            const key =  await crypto.generateKey({
               name: 'ECDH',
               namedCurve: 'P-256'
            }, true, ['deriveBits']);
            return {
               publicKey: await utils.stob64(JSON.stringify(await crypto.exportKey('jwk', key.publicKey))),
               privateKey: await utils.stob64(JSON.stringify(await crypto.exportKey('jwk', key.privateKey)))
            };
         }

         async derive(publicKey: string): Promise<string> {
            return utils.btob64(new Uint8Array(await crypto.deriveBits({
               name: 'ECDH',
               public: await crypto.importKey('jwk', JSON.parse(utils.b64tos(publicKey)), {
                  name: 'ECDH',
                  namedCurve: 'P-256'
               }, true, [])
            }, await crypto.importKey('jwk', JSON.parse(utils.b64tos(this._privateKey)), {
               name: 'ECDH',
               namedCurve: 'P-256'
            }, true, ['deriveBits']), 128)));
         }
  
      }

      export class ecdsa {
         
         private _publicKey: string;
         private _privateKey: string;

         public constructor(key: key) {
            this._publicKey = key.publicKey;
            this._privateKey = key.privateKey;
         }

         static async generate(): Promise<key> {
            const key =  await crypto.generateKey({
               name: 'ECDSA',
               namedCurve: 'P-256'
            }, true, ['sign', 'verify']);
            return {
               publicKey: await utils.stob64(JSON.stringify(await crypto.exportKey('jwk', key.publicKey))),
               privateKey: await utils.stob64(JSON.stringify(await crypto.exportKey('jwk', key.privateKey)))
            };
         }

         async sign(plaintext: string): Promise<string> {
            return utils.btob64(new Uint8Array(await crypto.sign({
               name: 'ECDSA',
               hash: {name: 'SHA-256'}
            }, await crypto.importKey('jwk', JSON.parse(utils.b64tos(this._privateKey)), {
               name: 'ECDSA',
               namedCurve: 'P-256'
            }, true, ['sign']), utils.stob(plaintext)))); 
         }

         async verify(signature: string, plaintext: string): Promise<boolean> {
            return await crypto.verify({
               name: 'ECDSA',
               hash: {name: 'SHA-256'}
            }, await crypto.importKey('jwk', JSON.parse(utils.b64tos(this._publicKey)), {
               name: 'ECDSA',
               namedCurve: 'P-256'
            }, true, ['verify']), utils.b64tob(signature), utils.stob(plaintext));
         }
      }
   }
}
