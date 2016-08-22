'use strict';
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator.throw(value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments)).next());
    });
};
var otr;
(function (otr) {
    const h2 = function (b, secbytes) {
        return __awaiter(this, void 0, void 0, function* () {
            const result = new Uint8Array(1 + secbytes.length);
            result.set([b], 0);
            result.set(secbytes, 1);
            return yield jwcl.hash.sha256(jwcl.utils.btos(result));
        });
    };
    const akek = function (s) {
        return __awaiter(this, void 0, void 0, function* () {
            let keys = {};
            const lens = new Uint8Array(4);
            lens.set([0, 0, 0, s.length]);
            const secbytes = new Uint8Array(4 + s.length);
            secbytes.set(lens, 0);
            secbytes.set(s, 4);
            keys.ssid = jwcl.utils.btob64(jwcl.utils.b64tob(yield h2(0, secbytes)).slice(0, 8));
            const tmp = yield h2(1, secbytes);
            keys.c = jwcl.utils.btob64(jwcl.utils.b64tob(tmp).slice(0, 16));
            keys.cprime = jwcl.utils.btob64(jwcl.utils.b64tob(tmp).slice(16, 32));
            keys.m1 = yield h2(2, secbytes);
            keys.m2 = yield h2(3, secbytes);
            keys.m1prime = yield h2(4, secbytes);
            keys.m2prime = yield h2(5, secbytes);
            return keys;
        });
    };
    const h1 = function (b, secbytes) {
        return __awaiter(this, void 0, void 0, function* () {
            const result = new Uint8Array(1 + secbytes.length);
            result.set([b], 0);
            result.set(secbytes, 1);
            return yield jwcl.hash.sha1(jwcl.utils.btos(result));
        });
    };
    const edk = function (dh, pdh) {
        return __awaiter(this, void 0, void 0, function* () {
            let keys = {};
            const ecdh = new jwcl.ecc.ecdh(dh);
            const key = yield ecdh.derive(pdh);
            const s = jwcl.utils.b64tob(key);
            const lens = new Uint8Array(4);
            lens.set([0, 0, 0, s.length]);
            const secbytes = new Uint8Array(4 + s.length);
            secbytes.set(lens, 0);
            secbytes.set(s, 4);
            let sendbyte, recvbyte;
            if (dh.publicKey > pdh) {
                sendbyte = 1;
                recvbyte = 2;
            }
            else {
                sendbyte = 2;
                recvbyte = 1;
            }
            keys.sendAesKey = jwcl.utils.btob64(jwcl.utils.b64tob(yield h1(sendbyte, secbytes)).slice(0, 16));
            keys.recvAesKey = jwcl.utils.btob64(jwcl.utils.b64tob(yield h1(recvbyte, secbytes)).slice(0, 16));
            keys.sendMacKey = yield jwcl.hash.sha1(keys.sendAesKey);
            keys.recvMacKey = yield jwcl.hash.sha1(keys.recvAesKey);
            return keys;
        });
    };
    otr.ake1 = function (local, network) {
        return __awaiter(this, void 0, void 0, function* () {
            const r = jwcl.random(16);
            const gx = yield jwcl.ecc.ecdh.generate();
            local.ourKeys[local.ourKeyId - 1] = gx;
            local.ourKeys[local.ourKeyId] = yield jwcl.ecc.ecdh.generate();
            const aes = new jwcl.cipher.aes(r);
            const aesGx = yield aes.encrypt(gx.publicKey);
            const hashGx = yield jwcl.hash.sha256(gx.publicKey);
            local.r = r;
            local.gx = gx;
            network.aesGx = aesGx;
            network.hashGx = hashGx;
        });
    };
    otr.ake2 = function (local, network) {
        return __awaiter(this, void 0, void 0, function* () {
            const gy = yield jwcl.ecc.ecdh.generate();
            local.ourKeys[local.ourKeyId - 1] = gy;
            local.ourKeys[local.ourKeyId] = yield jwcl.ecc.ecdh.generate();
            local.gy = gy;
            local.ourKey = gy;
            local.aesGx = network.aesGx;
            local.hashGx = network.hashGx;
            network.gy = gy.publicKey;
        });
    };
    otr.ake3 = function (local, network) {
        return __awaiter(this, void 0, void 0, function* () {
            const gy = network.gy;
            const ecdh = new jwcl.ecc.ecdh(local.gx);
            const s = yield ecdh.derive(gy);
            const keys = yield akek(s);
            const keyId = local.ourKeyId - 1;
            const hmac1 = new jwcl.hash.hmac(keys.m1);
            const mB = yield hmac1.sign(JSON.stringify({
                gx: local.gx.publicKey,
                gy: gy,
                pubB: local.B.publicKey,
                keyIdB: keyId
            }));
            const ecdsa = new jwcl.ecc.ecdsa(local.B);
            const xB = JSON.stringify({
                pubB: local.B.publicKey,
                keyIdB: keyId,
                sigMb: yield ecdsa.sign(mB)
            });
            const aes = new jwcl.cipher.aes(keys.c);
            const aesXb = yield aes.encrypt(xB);
            const hmac2 = new jwcl.hash.hmac(keys.m2);
            const macAesXb = yield hmac2.sign(aesXb);
            local.keys = keys;
            local.gy = gy;
            network.r = local.r;
            network.aesXb = aesXb;
            network.macAesXb = macAesXb;
        });
    };
    otr.ake4 = function (local, network) {
        return __awaiter(this, void 0, void 0, function* () {
            const r = network.r;
            const aesr = new jwcl.cipher.aes(r);
            const gx = yield aesr.decrypt(local.aesGx);
            const hashGx = yield jwcl.hash.sha256(gx);
            if (hashGx !== local.hashGx) {
                throw 'Error ake4: hashes do not match';
            }
            const ecdh = new jwcl.ecc.ecdh(local.gy);
            const s = yield ecdh.derive(gx);
            const keys = yield akek(s);
            const hmac2 = new jwcl.hash.hmac(keys.m2);
            const verifyMacM2 = yield hmac2.verify(network.macAesXb, network.aesXb);
            if (verifyMacM2 !== true) {
                throw 'Error ake4: mac does not verify';
            }
            const aesc = new jwcl.cipher.aes(keys.c);
            const xB = JSON.parse(yield aesc.decrypt(network.aesXb));
            const hmac1 = new jwcl.hash.hmac(keys.m1);
            const mB = yield hmac1.sign(JSON.stringify({
                gx: gx,
                gy: local.gy.publicKey,
                pubB: local.pubB,
                keyIdB: xB.keyIdB
            }));
            const key = { publicKey: local.pubB, privateKey: '' };
            const ecdsab = new jwcl.ecc.ecdsa(key);
            const verifySigMb = yield ecdsab.verify(xB.sigMb, mB);
            if (verifySigMb !== true) {
                throw 'Error ake4: signature does not verify';
            }
            const keyId = local.ourKeyId - 1;
            const hmac1p = new jwcl.hash.hmac(keys.m1prime);
            const mA = yield hmac1p.sign(JSON.stringify({
                gy: local.gy.publicKey,
                gx: gx,
                pubA: local.A.publicKey,
                keyIdA: keyId
            }));
            const ecdsaa = new jwcl.ecc.ecdsa(local.A);
            const xA = JSON.stringify({
                pubA: local.A.publicKey,
                keyIdA: keyId,
                sigMa: yield ecdsaa.sign(mA)
            });
            const aescp = new jwcl.cipher.aes(keys.cprime);
            const aesXa = yield aescp.encrypt(xA);
            const hmac2p = new jwcl.hash.hmac(keys.m2prime);
            const macAesXa = yield hmac2p.sign(aesXa);
            local.keys = keys;
            local.gx = gx;
            local.theirKeyId = xB.keyIdB;
            local.theirKeys[local.theirKeyId] = local.gx;
            network.aesXa = aesXa;
            network.macAesXa = macAesXa;
        });
    };
    otr.ake5 = function (local, network) {
        return __awaiter(this, void 0, void 0, function* () {
            const hmac2p = new jwcl.hash.hmac(local.keys.m2prime);
            const verifyMacM2p = yield hmac2p.verify(network.macAesXa, network.aesXa);
            if (verifyMacM2p !== true) {
                throw 'Error ake5: mac does not verify';
            }
            const aescp = new jwcl.cipher.aes(local.keys.cprime);
            const xA = JSON.parse(yield aescp.decrypt(network.aesXa));
            const hmac1p = new jwcl.hash.hmac(local.keys.m1prime);
            const mA = yield hmac1p.sign(JSON.stringify({
                gy: local.gy,
                gx: local.gx.publicKey,
                pubA: local.pubA,
                keyIdA: xA.keyIdA
            }));
            const key = { publicKey: local.pubA, privateKey: '' };
            const ecdsaa = new jwcl.ecc.ecdsa(key);
            const verifySigMa = yield ecdsaa.verify(xA.sigMa, mA);
            if (verifySigMa !== true) {
                throw 'Error ake5: signature does not verify';
            }
            local.theirKeyId = xA.keyIdA;
            local.theirKeys[local.theirKeyId] = local.gy;
        });
    };
    otr.ed1 = function (local, network) {
        return __awaiter(this, void 0, void 0, function* () {
            const sendKey = local.ourKeys[local.ourKeyId - 1];
            const recvKey = local.theirKeys[local.theirKeyId];
            const sendKeyId = local.ourKeyId - 1;
            const recvKeyId = local.theirKeyId;
            const nextDh = local.ourKeys[local.ourKeyId].publicKey;
            const message = local.message;
            const keys = yield edk(sendKey, recvKey);
            const aes = new jwcl.cipher.aes(keys.sendAesKey);
            const ciphertext = yield aes.encrypt(message);
            const ta = JSON.stringify({
                sendKeyId: sendKeyId,
                recvKeyId: recvKeyId,
                nextDh: nextDh,
                aesMessage: ciphertext
            });
            const hmac = new jwcl.hash.hmac(keys.sendMacKey);
            const macTa = yield hmac.sign(ta);
            network.ta = ta;
            network.macTa = macTa;
        });
    };
    otr.ed2 = function (local, network) {
        return __awaiter(this, void 0, void 0, function* () {
            const ta = JSON.parse(network.ta);
            const macTa = network.macTa;
            const sendKeyId = ta.sendKeyId;
            const recvKeyId = ta.recvKeyId;
            const sendKey = local.ourKeys[recvKeyId]; // TODO write about this as it is kinda weird
            const recvKey = local.theirKeys[sendKeyId];
            if (recvKeyId === local.ourKeyId) {
                delete local.ourKeys[local.ourKeyId - 1];
                local.ourKeyId++;
                local.ourKeys[local.ourKeyId] = yield jwcl.ecc.ecdh.generate();
            }
            if (sendKeyId === local.theirKeyId) {
                local.theirKeyId++;
                local.theirKeys[local.theirKeyId] = ta.nextDh;
            }
            const keys = yield edk(sendKey, recvKey);
            const hmac = new jwcl.hash.hmac(keys.recvMacKey);
            const verify = yield hmac.verify(macTa, network.ta);
            if (verify === false) {
                throw "ERROR ed2: mac does not verify";
            }
            const aes = new jwcl.cipher.aes(keys.recvAesKey);
            const plaintext = yield aes.decrypt(ta.aesMessage);
            local.message = plaintext;
        });
    };
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
        const testAll = function () {
            return __awaiter(this, void 0, void 0, function* () {
                let alice = {};
                let bob = {};
                let network = {};
                alice.A = yield jwcl.ecc.ecdsa.generate();
                bob.B = yield jwcl.ecc.ecdsa.generate();
                alice.pubB = bob.B.publicKey;
                bob.pubA = alice.A.publicKey;
                alice.ourKeys = {};
                alice.ourKeyId = 2;
                alice.theirKeys = {};
                bob.ourKeys = {};
                bob.ourKeyId = 2;
                bob.theirKeys = {};
                yield otr.ake1(bob, network);
                yield otr.ake2(alice, network);
                yield otr.ake3(bob, network);
                yield otr.ake4(alice, network);
                yield otr.ake5(bob, network);
                alice.message = 'this is a message';
                yield otr.ed1(alice, network);
                yield otr.ed2(bob, network);
                test('alice send', bob.message, alice.message);
                alice.message = 'this is two messages in a row';
                yield otr.ed1(alice, network);
                yield otr.ed2(bob, network);
                test('alice send two', bob.message, alice.message);
                bob.message = 'this is a response';
                yield otr.ed1(bob, network);
                yield otr.ed2(alice, network);
                test('bob response', bob.message, alice.message);
                for (let i = 0; i < 100; i++) {
                    alice.message = 'this is a message ' + i;
                    yield otr.ed1(alice, network);
                    yield otr.ed2(bob, network);
                    test('alice send normal ' + i, bob.message, alice.message);
                    bob.message = 'this is a response ' + i;
                    yield otr.ed1(bob, network);
                    yield otr.ed2(alice, network);
                    test('bob response normal ' + i, bob.message, alice.message);
                }
                for (let i = 0; i < 100; i++) {
                    alice.message = 'this is a message ' + i;
                    yield otr.ed1(alice, network);
                    yield otr.ed2(bob, network);
                    test('alice send in a row ' + i, bob.message, alice.message);
                }
                for (let i = 0; i < 100; i++) {
                    bob.message = 'this is a response ' + i;
                    yield otr.ed1(bob, network);
                    yield otr.ed2(alice, network);
                    test('bob response in a row ' + i, bob.message, alice.message);
                }
            });
        };
        test_1.run = function () {
            return __awaiter(this, void 0, void 0, function* () {
                yield testAll();
            });
        };
    })(test = otr.test || (otr.test = {}));
})(otr || (otr = {}));
//# sourceMappingURL=otr.js.map