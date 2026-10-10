export const PASSWORD_ITERATIONS=600000;
export const newPasswordSalt=()=>Array.from(crypto.getRandomValues(new Uint8Array(16)),v=>v.toString(16).padStart(2,'0')).join('');
// Standard PBKDF2 runs in Web Crypto; the plaintext password never enters storage.
export async function passwordProof(password,salt){
 if(typeof password!=='string'||!password||password.length>128||!/^[a-f0-9]{32}$/.test(salt))throw Error('Check your password and try again.');
 const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(password),'PBKDF2',false,['deriveBits']);
 const bits=await crypto.subtle.deriveBits({name:'PBKDF2',hash:'SHA-256',salt:Uint8Array.from(salt.match(/../g),v=>parseInt(v,16)),iterations:PASSWORD_ITERATIONS},key,256);
 return Array.from(new Uint8Array(bits),v=>v.toString(16).padStart(2,'0')).join('');
}
