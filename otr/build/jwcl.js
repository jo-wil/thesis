'use strict';
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator.throw(value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments)).next());
    });
};
var jwcl;
(function (jwcl) {
    const crypto = window.crypto.subtle;
    var utils;
    (function (utils) {
        utils.btos = function (array) {
            let string = '';
            for (let i = 0; i < array.length; i++) {
                string += String.fromCharCode(array[i]);
            }
            return string;
        };
        utils.stob = function (string) {
            const array = new Uint8Array(string.length);
            for (let i = 0; i < string.length; i++) {
                array[i] = string.charCodeAt(i);
            }
            return array;
        };
        utils.itob = function (number) {
            const array = new Uint8Array(16);
            for (let i = 3; i >= 0; i--) {
                const scale = Math.pow(2, (i * 8));
                array[i] = Math.floor(number / scale);
                number = number % scale;
            }
            return array;
        };
        utils.btoi = function (array) {
            let number = 0;
            for (let i = 3; i >= 0; i--) {
                const scale = Math.pow(2, (i * 8));
                number += array[i] * scale;
            }
            return number;
        };
        utils.btob64 = function (array) {
            return window.btoa(utils.btos(array));
        };
        utils.b64tob = function (string) {
            return utils.stob(window.atob(string));
        };
        utils.stob64 = function (string) {
            return window.btoa(string);
        };
        utils.b64tos = function (string) {
            return window.atob(string);
        };
    })(utils = jwcl.utils || (jwcl.utils = {}));
    ;
    jwcl.random = function (bytes) {
        const array = new Uint8Array(bytes);
        window.crypto.getRandomValues(array);
        return utils.btob64(array);
    };
    var hash;
    (function (hash_1) {
        const hash = function (name, plaintext) {
            return __awaiter(this, void 0, void 0, function* () {
                return utils.btob64(new Uint8Array(yield crypto.digest({
                    name: name
                }, utils.stob(plaintext))));
            });
        };
        hash_1.sha1 = function (plaintext) {
            return __awaiter(this, void 0, void 0, function* () {
                return hash('SHA-1', plaintext);
            });
        };
        hash_1.sha256 = function (plaintext) {
            return __awaiter(this, void 0, void 0, function* () {
                return hash('SHA-256', plaintext);
            });
        };
        class hmac {
            constructor(key) {
                this._key = key;
            }
            sign(plaintext) {
                return __awaiter(this, void 0, void 0, function* () {
                    const key = yield crypto.importKey('raw', utils.b64tob(this._key), {
                        name: 'HMAC',
                        hash: { name: 'SHA-256' }
                    }, true, ['sign']);
                    return utils.btob64(new Uint8Array(yield crypto.sign('HMAC', key, utils.stob(plaintext))));
                });
            }
            verify(signature, plaintext) {
                return __awaiter(this, void 0, void 0, function* () {
                    const key = yield crypto.importKey('raw', utils.b64tob(this._key), {
                        name: 'HMAC',
                        hash: { name: 'SHA-256' }
                    }, true, ['verify']);
                    return yield crypto.verify('HMAC', key, utils.b64tob(signature), utils.stob(plaintext));
                });
            }
        }
        hash_1.hmac = hmac;
        ;
    })(hash = jwcl.hash || (jwcl.hash = {}));
    ;
    var cipher;
    (function (cipher) {
        class aes {
            constructor(key) {
                this._key = key;
                this._counter = 0;
            }
            encrypt(plaintext) {
                return __awaiter(this, void 0, void 0, function* () {
                    const plaintextArray = utils.stob(plaintext);
                    const counter = utils.itob(this._counter);
                    this._counter += Math.ceil(plaintextArray.length / aes._BLOCK_SIZE_BYTES);
                    const key = yield crypto.importKey('raw', utils.b64tob(this._key), {
                        name: 'AES-CTR'
                    }, true, ['encrypt']);
                    const rawCiphertextArray = new Uint8Array(yield crypto.encrypt({
                        name: 'AES-CTR',
                        counter: counter,
                        length: 128,
                    }, key, plaintextArray));
                    const ciphertextArray = new Uint8Array(aes._COUNTER_BYTES + rawCiphertextArray.length);
                    ciphertextArray.set(counter, 0);
                    ciphertextArray.set(rawCiphertextArray, aes._COUNTER_BYTES);
                    return utils.btob64(ciphertextArray);
                });
            }
            decrypt(ciphertext) {
                return __awaiter(this, void 0, void 0, function* () {
                    const ciphertextArray = utils.b64tob(ciphertext);
                    const counter = ciphertextArray.slice(0, aes._COUNTER_BYTES);
                    const rawCiphertextArray = ciphertextArray.slice(aes._COUNTER_BYTES, ciphertextArray.length);
                    const key = yield crypto.importKey('raw', utils.b64tob(this._key), {
                        name: 'AES-CTR'
                    }, true, ['decrypt']);
                    const plaintextArray = new Uint8Array(yield crypto.decrypt({
                        name: 'AES-CTR',
                        counter: counter,
                        length: 128,
                    }, key, rawCiphertextArray));
                    this._counter = utils.btoi(counter) + Math.ceil(plaintextArray.length / aes._BLOCK_SIZE_BYTES);
                    return utils.btos(plaintextArray);
                });
            }
        }
        aes._COUNTER_BYTES = 16;
        aes._BLOCK_SIZE_BYTES = 16;
        cipher.aes = aes;
    })(cipher = jwcl.cipher || (jwcl.cipher = {}));
    var ecc;
    (function (ecc) {
        class ecdh {
            constructor(key) {
                this._publicKey = key.publicKey;
                this._privateKey = key.privateKey;
            }
            static generate() {
                return __awaiter(this, void 0, void 0, function* () {
                    const key = yield crypto.generateKey({
                        name: 'ECDH',
                        namedCurve: 'P-256'
                    }, true, ['deriveBits']);
                    return {
                        publicKey: yield utils.stob64(JSON.stringify(yield crypto.exportKey('jwk', key.publicKey))),
                        privateKey: yield utils.stob64(JSON.stringify(yield crypto.exportKey('jwk', key.privateKey)))
                    };
                });
            }
            derive(publicKey) {
                return __awaiter(this, void 0, void 0, function* () {
                    return utils.btob64(new Uint8Array(yield crypto.deriveBits({
                        name: 'ECDH',
                        public: yield crypto.importKey('jwk', JSON.parse(utils.b64tos(publicKey)), {
                            name: 'ECDH',
                            namedCurve: 'P-256'
                        }, true, [])
                    }, yield crypto.importKey('jwk', JSON.parse(utils.b64tos(this._privateKey)), {
                        name: 'ECDH',
                        namedCurve: 'P-256'
                    }, true, ['deriveBits']), 128)));
                });
            }
        }
        ecc.ecdh = ecdh;
        class ecdsa {
            constructor(key) {
                this._publicKey = key.publicKey;
                this._privateKey = key.privateKey;
            }
            static generate() {
                return __awaiter(this, void 0, void 0, function* () {
                    const key = yield crypto.generateKey({
                        name: 'ECDSA',
                        namedCurve: 'P-256'
                    }, true, ['sign', 'verify']);
                    return {
                        publicKey: yield utils.stob64(JSON.stringify(yield crypto.exportKey('jwk', key.publicKey))),
                        privateKey: yield utils.stob64(JSON.stringify(yield crypto.exportKey('jwk', key.privateKey)))
                    };
                });
            }
            sign(plaintext) {
                return __awaiter(this, void 0, void 0, function* () {
                    return utils.btob64(new Uint8Array(yield crypto.sign({
                        name: 'ECDSA',
                        hash: { name: 'SHA-256' }
                    }, yield crypto.importKey('jwk', JSON.parse(utils.b64tos(this._privateKey)), {
                        name: 'ECDSA',
                        namedCurve: 'P-256'
                    }, true, ['sign']), utils.stob(plaintext))));
                });
            }
            verify(signature, plaintext) {
                return __awaiter(this, void 0, void 0, function* () {
                    return yield crypto.verify({
                        name: 'ECDSA',
                        hash: { name: 'SHA-256' }
                    }, yield crypto.importKey('jwk', JSON.parse(utils.b64tos(this._publicKey)), {
                        name: 'ECDSA',
                        namedCurve: 'P-256'
                    }, true, ['verify']), utils.b64tob(signature), utils.stob(plaintext));
                });
            }
        }
        ecc.ecdsa = ecdsa;
    })(ecc = jwcl.ecc || (jwcl.ecc = {}));
    var test;
    (function (test_1) {
        const test = function (name, result, expected) {
            const p = document.createElement('p');
            if (expected !== result) {
                p.innerText =
                    name + ' ... fail\n' +
                        '   result: ' + result + '\n' +
                        '   expected: ' + expected;
            }
            else {
                p.innerText = name + ' ... pass';
            }
            document.body.appendChild(p);
        };
        const testno = function (name, result, notexpected) {
            const p = document.createElement('p');
            if (notexpected === result) {
                p.innerText =
                    name + '... fail\n' +
                        '   result: ' + result + '\n' +
                        '   notexpected: ' + notexpected;
            }
            else {
                p.innerText = name + '... pass';
            }
            document.body.appendChild(p);
        };
        const random = function () {
            const key = jwcl.random(16);
            test('jwcl.random 1', Math.ceil(16 / 3) * 4, key.length);
            test('jwcl.random 2', 'string', typeof key);
        };
        const hash = function () {
            return __awaiter(this, void 0, void 0, function* () {
                const sha1 = yield jwcl.hash.sha1('abc');
                test('jwcl.hash.sha1 1', sha1, 'qZk+NkcGgWq6PiVxeFDCbJzQ2J0=');
                const sha256 = yield jwcl.hash.sha256('abc');
                test('jwcl.hash.sha256 1', sha256, 'ungWv48Bz+pBQUDeXa4iI7ADYaOWF3qctBD/YfIAFa0=');
                const key = jwcl.random(16);
                const hmac = new jwcl.hash.hmac(key);
                const signature = yield hmac.sign('important message');
                const verifyTrue = yield hmac.verify(signature, 'important message');
                const verifyFalse = yield hmac.verify(signature, 'important message changed');
                test('jwcl.hash.hmac 1', verifyTrue, true);
                test('jwcl.hash.hmac 2', verifyFalse, false);
            });
        };
        const cipher = function () {
            return __awaiter(this, void 0, void 0, function* () {
                const key = jwcl.random(16);
                const aes = new jwcl.cipher.aes(key);
                const ciphertext = yield aes.encrypt('secret message');
                const ciphertext2 = yield aes.encrypt('secret message');
                const plaintext = yield aes.decrypt(ciphertext);
                test('jwcl.cipher.aes 1', plaintext, 'secret message');
                testno('jwcl.cipher.aes 2', ciphertext, ciphertext2);
            });
        };
        const ecc = function () {
            return __awaiter(this, void 0, void 0, function* () {
                const key1 = yield jwcl.ecc.ecdh.generate();
                const key2 = yield jwcl.ecc.ecdh.generate();
                const ecc1 = new jwcl.ecc.ecdh(key1);
                const publicKey = key2.publicKey;
                const derivedKey = yield ecc1.derive(publicKey);
                test('jwcl.ecc.ecdh 1', Math.ceil(16 / 3) * 4, derivedKey.length);
                test('jwcl.ecc.ecdh 2', 'string', typeof derivedKey);
                const key3 = yield jwcl.ecc.ecdsa.generate();
                const ecdsa = new jwcl.ecc.ecdsa(key3);
                const signature = yield ecdsa.sign('important message');
                const verifyTrue = yield ecdsa.verify(signature, 'important message');
                const verifyFalse = yield ecdsa.verify(signature, 'important message changed');
                test('jwcl.ecc.ecdsa 1', verifyTrue, true);
                test('jwcl.ecc.ecdsa 2', verifyFalse, false);
            });
        };
        test_1.run = function () {
            return __awaiter(this, void 0, void 0, function* () {
                random();
                hash();
                cipher();
                ecc();
            });
        };
    })(test = jwcl.test || (jwcl.test = {}));
})(jwcl || (jwcl = {}));
//# sourceMappingURL=jwcl.js.map