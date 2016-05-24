'use strict';

const crypto = new Crypto();

// Emulate Network
let bob = {};
let alice = {};
let network = {};

//Alice and Bob's long term authentication keys
Promise.all([
   crypto.generateKey({algo: {name:'ECDSA'}}),
   crypto.generateKey({algo: {name:'ECDSA'}})
]).then(function (result) {
   bob.pubB = result[0];
   alice.pubA = result[1];
   network.pubB = bob.pubB.publicKey;
   network.pubA = alice.pubA.publicKey;
});


// Helpers
let computeKeys = function (s) {
   let promise = new Promise (function (resolve, reject) {
      crypto.importKey({
         keyData: s,
         algo: {name: 'AES-GCM'}
      }).then(function (result) {
         return crypto.exportKey({
            format: 'raw',
            key: result
         });
      }).then(function (result) {
         let s = new Uint8Array(result); 
         let lens = new Uint8Array(4);
         lens.set([0, 0, 0, s.length]);
         let secbytes = new Uint8Array(4 + s.length); 
         secbytes.set(lens, 0); 
         secbytes.set(s, 4);
         let h2 = function (b) {
            let result = new Uint8Array(1 + 4 + s.length);
            result.set([b], 0);
            result.set(secbytes, 1);
            return result;
         };
         let promises = [];
         for (let i = 0; i < 6; i++) {
            promises.push(crypto.digest({buffer: Utils.toString(h2(i))}));
         }
         return Promise.all(promises);
      }).then(function (result) {
         let promises = [];
         promises.push(Utils.toString(Utils.toArray(result[0]).slice(0,8)));
         promises.push(crypto.importKey({
            format: 'raw',
            keyData: Utils.toArray(result[1]).slice(0,16),
            algo: {name: 'AES-GCM'},
            usages: ['encrypt', 'decrypt']
         }));
         promises.push(crypto.importKey({
            format: 'raw',
            keyData: Utils.toArray(result[1]).slice(16,32),
            algo: {name: 'AES-GCM'},
            usages: ['encrypt', 'decrypt']
         }));
         for (let i = 2; i < 6; i++) {
            promises.push( crypto.importKey({
               format: 'raw',
               keyData: Utils.toArray(result[i]),
               algo: {name: 'HMAC'},
               usages: ['sign', 'verify']
            }));
         }
         return Promise.all(promises);
      }).then(function (result) {
         let promises = [];
         promises.push(result[0]);
         for (let i = 1; i < 7; i++) {
            promises.push(crypto.exportKey({
               format: 'jwk',
               key: result[i]
            }));
         }
         return Promise.all(promises);
      }).then(function (result) {
         resolve({
            ssid: result[0],
            c1: result[1],
            c1prime: result[2],
            m1: result[3],
            m2: result[4],
            m1prime: result[5],
            m2prime: result[6],
         });
      });
   });
   return promise;
}

let ake1 = function* () {
   
   // Picks a random value r (128 bits)
   let r = yield crypto.generateKey({
      algo: {name: 'AES-GCM'}
   }); 

   // Picks a random value x (at least 320 bits)
   let gx = yield crypto.generateKey({
      algo: {name: 'ECDH'}
   }); 

   //Sends Alice AESr(gx), HASH(gx)  
   let encryptedGx = yield crypto.encrypt({
      key: r,
      cleartext: JSON.stringify(gx.publicKey) 
   });
   let digestGx = yield crypto.digest({
      buffer: JSON.stringify(gx.publicKey)
   });
        
   // Emulate storage and network
   bob.r = r;
   bob.gx = gx;
   network.encryptedGx = encryptedGx;
   network.digestGx = digestGx;
   
   // Print the results 
   console.log('r', r);
   console.log('gx', gx);
   console.log('encryptedGx', encryptedGx);
   console.log('digestGx', digestGx);
   console.log('done with ake1');
};

let ake2 = function* () {
   
   // Picks a random value y (at least 320 bits)
   // Sends Bob gy
   let gy = yield crypto.generateKey({
      algo: {name: 'ECDH'}
   });

   // Emulate storage and network
   alice.encryptedGx = network.encryptedGx;
   alice.digestGx = network.digestGx;
   alice.gy = gy;
   network.gy = gy.publicKey;
  
    // Print the results 
   console.log('gy', gy);
   console.log('done with ake2'); 
};



let ake3 = function* () {
   // verfies that Alice's gy is a legal value
   let gy = network.gy;
   let gx = bob.gx;
   let pubB = bob.pubB;
   // compute s = (gy)x
   let s = yield crypto.deriveKey({
      algo: {
         public: gy
      },
      masterKey: gx.privateKey
   });
   // Computes two AES keys c, c' and four MAC keys m1, m1', m2, m2' by hashing s in various ways
   let keys = yield computeKeys(s);
   // Picks keyidB, a serial number for his D-H key gx
   let keyidB = 1;
   // Computes MB = MACm1(gx, gy, pubB, keyidB)
   let mB = yield crypto.sign({
      algo: {name: 'HMAC'},
      key: keys.m1,
      text2sign: JSON.stringify(gx.publicKey) +
                 JSON.stringify(gy) + 
                 JSON.stringify(pubB.publicKey) +
                 keyidB
   });  
   // Computes XB = pubB, keyidB, sigB(MB)
   let sigBmB = yield crypto.sign({
      algo: {name: 'ECDSA'},
      key: pubB.privateKey,
      text2sign: mB 
   });
   let xB = {
      pubB: pubB.publicKey,
      keyidB: keyidB,
      sigBmB: sigBmB 
   }; 
   //Sends Alice r, AESc(XB), MACm2(AESc(XB))
   let aesMacM2xB = yield crypto.encrypt({
      algo: {
         additionalData: keys.m2
      },
      key: keys.c1,
      cleartext: JSON.stringify(xB)
   });  
 
   // Emulate storage and network
   network.r = bob.r;
   network.aesMacM2xB = aesMacM2xB;
   bob.keys = keys;
   
   // Print the results
   console.log('s', s);
   console.log('keys', keys);
   console.log('mB', mB);
   console.log('xB', xB);
   console.log('done with ake3'); 
};


let ake4 = function* () {

   console.log('AKE4', alice);

   let r = network.r;
   let aesMacM2xB = network.aesMacM2xB;
   let pubB = network.pubB;
   let gy = alice.gy;
   let encryptedGx = alice.encryptedGx;
   let digestGx = alice.digestGx;
   let pubA = alice.pubA;

   // Uses r to decrypt the value of gx sent earlier
   let gx = yield crypto.decrypt({
      key: r,
      ciphertext: encryptedGx
   });

   gx = JSON.parse(gx);
   
   // Verifies that HASH(gx) matches the value sent earlier
   let computedDigestGx = yield crypto.digest({
      buffer: JSON.stringify(gx)
   }) 

   if (computedDigestGx !== digestGx) {
      throw 'OTR: hashes not equal aborting ake4';
   }
   //Verifies that Bob's gx is a legal value (2 <= gx <= modulus-2)
   //Computes s = (gx)y 
   //(note that this will be the same as the value of s Bob calculated)
   let s = yield crypto.deriveKey({
      algo: {
         public: gx
      },
      masterKey: gy.privateKey
   });

   // Computes two AES keys c, c' and four MAC keys m1, m1', m2, m2' by hashing s in various ways (the same as Bob)
   let keys = yield computeKeys(s);

   // Uses m2 to verify MACm2(AESc(XB))
   // Uses c to decrypt AESc(XB) to obtain XB = pubB, keyidB, sigB(MB)
   let xB = yield crypto.decrypt({
      algo: {
         additionalData: keys.m2
      },
      key: keys.c1,
      ciphertext: aesMacM2xB
   });
   xB = JSON.parse(xB); 

    // Computes MB = MACm1(gx, gy, pubB, keyidB)
   let mB = yield crypto.sign({
      algo: {name: 'HMAC'},
      key: keys.m1,
      text2sign: JSON.stringify(gx) +
                 JSON.stringify(gy.publicKey) +
                 JSON.stringify(pubB) +
                 xB.keyidB
   });

   //Uses pubB to verify sigB(MB)
   let verifySigBmB = yield crypto.verify({
      algo: {
         name: 'ECDSA'
      },
      key: pubB,
      signature: xB.sigBmB,
      text2verify: mB   
   });  

   // Picks keyidA, a serial number for her D-H key gy
   let keyidA = 1;
   
   // Computes MA = MACm1'(gy, gx, pubA, keyidA)
   let mA = yield crypto.sign({
      algo: {name: 'HMAC'},
      key: keys.m1prime,
      text2sign: JSON.stringify(gy.publicKey) + 
                 JSON.stringify(gx) +
                 JSON.stringify(pubA.publicKey) +
                 keyidA
   });
   
   // Computes XA = pubA, keyidA, sigA(MA)
   let sigAmA = yield crypto.sign({
      algo: {name: 'ECDSA'},
      key: pubA.privateKey,
      text2sign: mA 
   });
   let xA = {
      pubA: pubA.publicKey,
      keyidA: keyidA,
      sigAmA: sigAmA 
   };

   // Sends Bob AESc'(XA), MACm2'(AESc'(XA))
   let aesMacM2primexA = yield crypto.encrypt({
      algo: {
         additionalData: keys.m2prime
      },
      key: keys.c1prime,
      cleartext: JSON.stringify(xA)
   });

   // Emulate storage and network
   network.aesMacM2primexA = aesMacM2primexA;
   
   console.log('s', s);
   console.log('keys', keys);
   console.log('xB', xB);
   console.log('verifySigBmB', verifySigBmB);
   console.log('mA', mA);
   console.log('xA', xA);
   console.log('done with ake4'); 
};

let ake5 = function* () {

   let gx = bob.gx;
   let keys = bob.keys;
   let gy = network.gy;
   let pubA = network.pubA;
   let aesMacM2primexA = network.aesMacM2primexA;

   //Uses m2' to verify MACm2'(AESc'(XA))
   //Uses c' to decrypt AESc'(XA) to obtain XA = pubA, keyidA, sigA(MA)
   let xA = yield crypto.decrypt({
      algo: {
         additionalData: keys.m2prime
      },
      key: keys.c1prime,
      ciphertext: aesMacM2primexA
   });
   xA = JSON.parse(xA); 

   //Computes MA = MACm1'(gy, gx, pubA, keyidA)
   let mA = yield crypto.sign({
      algo: {name: 'HMAC'},
      key: keys.m1prime,
      text2sign: JSON.stringify(gy)+ 
                 JSON.stringify(gx.publicKey) +
                 JSON.stringify(pubA) +
                 xA.keyidA
   });

   //Uses pubA to verify sigA(MA)
   let verifySigAmA = yield crypto.verify({
      algo: {
         name: 'ECDSA'
      },
      key: pubA,
      signature: xA.sigAmA,
      text2verify: mA  
   });

   console.log('xA', xA);
   console.log('mA', mA);
   console.log('verifySigAmA', verifySigAmA);
   console.log('done with ake5'); 
};


let de1 = function* () {

}

let de2 = function* () {

}

Utils.run(ake1).then(function (result) {
   return Utils.run(ake2);
}).then(function (result) {
   return Utils.run(ake3);
}).then(function (result) {
   return Utils.run(ake4);
}).then(function (result) {
   return Utils.run(ake5);
}).then(function (result) {
   return Utils.run(de1);
}).then(function (result) {
   return Utils.run(de2);
}).then(function (result) {
   console.log('ALICE', alice);
   console.log('BOB', bob);
   console.log('NETWORK', network);
});
