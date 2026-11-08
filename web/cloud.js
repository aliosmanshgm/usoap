import {encodeSet,decodeSet,digest} from './cloud-codec.mjs';
let auth,db,F,A,user=null,allowedUid='',loading=false;
const $=s=>document.querySelector(s),key='usoap-pq-firebase-v1';
function status(text){$('#cloudStatus').textContent=text}
function errorText(e){const messages={'auth/unauthorized-domain':'Bu site alan adı Firebase Authentication > Settings > Authorized domains listesine eklenmeli.','auth/popup-blocked':'Tarayıcı giriş penceresini engelledi. Açılır pencerelere izin verip tekrar deneyin.','auth/popup-closed-by-user':'Giriş penceresi kapatıldı.','auth/operation-not-allowed':'Firebase Authentication bölümünde Google girişini etkinleştirin.','permission-denied':'Firestore erişimi reddedildi. UID ile güvenlik kurallarını kontrol edin.','unavailable':'Firebase bağlantısı kurulamadı. İnternet bağlantısını kontrol edin.'};return messages[e.code]||e.message||String(e)}
export function identity(){return isReady()?user.uid:null}
export function isReady(){return !!(user&&allowedUid&&user.uid===allowedUid)}
export const saveSet=set=>saveArchive(set,'pqSets');
export const saveCapArchive=set=>saveArchive(set,'capArchives');
export const saveSnapshot=set=>saveArchive(set,'stateSnapshots');
async function saveArchive(set,collectionName){
 if(!isReady())throw Error('Buluta kayıt için izin verilen Google hesabıyla giriş yapın.');
 const uid=user.uid,{text,chunks}=encodeSet(set),hash=await digest(text),ref=F.doc(db,'users',uid,collectionName,set.id);
 await F.runTransaction(db,async tx=>{
  const existing=await tx.get(ref);if(existing.exists()){if(existing.data().hash===hash)return;throw Error('Bu set kimliği bulutta farklı içerikle zaten var; mevcut sürüm değiştirilmedi.');}
  tx.set(ref,{id:set.id,label:set.label,recordCount:set.records.length,chunkCount:chunks.length,hash,schemaVersion:1,createdAt:F.serverTimestamp()});
  chunks.forEach((payload,index)=>tx.set(F.doc(ref,'chunks',String(index).padStart(3,'0')),{index,payload}));
 });
 status('Buluta kaydedildi · '+set.label);return hash;
}
export const loadSets=()=>loadArchives('pqSets');
export const loadCapArchives=()=>loadArchives('capArchives');
export const loadSnapshots=()=>loadArchives('stateSnapshots');
async function loadArchives(collectionName){
 if(!isReady())throw Error('İzin verilen hesapla giriş gerekli.');
 const uid=user.uid,docs=await F.getDocs(F.collection(db,'users',uid,collectionName)),sets=[];
 for(const doc of docs.docs){const meta=doc.data();if(meta.id!==doc.id)throw Error('Bulut set kimliği uyuşmuyor.');
 const chunks=await F.getDocs(F.collection(doc.ref,'chunks'));sets.push(await decodeSet(meta,chunks.docs.map(d=>d.data())));}
 return sets;
}
function showUser(u){
 user=u;$('#signIn').hidden=!!u;$('#signOut').hidden=!u;$('#cloudUid').textContent=u?'Google hesabınızın UID değeri: '+u.uid:'';
 $('#syncCloud').disabled=!isReady();$('#seedCloud').disabled=!isReady();
 status(!u?'Google ile giriş bekleniyor':!allowedUid?'Giriş yapıldı. UID bilgisini yapılandırmaya ve Firestore kurallarına ekleyin.':u.uid!==allowedUid?'Bu Google hesabı uygulama için yetkili değil.':'Google hesabı bağlı · Bulut kayıtları denetleniyor');
 if(isReady())document.dispatchEvent(new CustomEvent('pq-cloud-ready'));else document.dispatchEvent(new CustomEvent('pq-cloud-signed-out'));
}
async function connect(config,uid){
 if(loading)return;loading=true;
 try{
  if(!config||!['apiKey','authDomain','projectId','appId'].every(k=>typeof config[k]==='string'&&config[k].trim()))throw Error('apiKey, authDomain, projectId ve appId alanlarını doldurun.');
  if(config.private_key||config.type==='service_account')throw Error('Servis hesabı anahtarı kullanmayın. Firebase Web yapılandırması gerekli.');
  if(auth)throw Error('Yapılandırmayı değiştirdikten sonra sayfayı yenileyin.');
  status('Firebase bağlantısı hazırlanıyor…');
  const [App,Auth,Store]=await Promise.all([import('https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js'),import('https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js'),import('https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js')]);
  A=Auth;F=Store;allowedUid=uid.trim();const app=App.initializeApp(config);auth=A.getAuth(app);db=F.getFirestore(app);
  A.onAuthStateChanged(auth,showUser,e=>status(errorText(e)));$('#signIn').disabled=false;
 }catch(e){status('Bağlantı kurulamadı: '+errorText(e))}finally{loading=false}
}
export function initCloud(){
 $('#cloudSettings').onclick=()=>$('#cloudDialog').showModal();$('#closeCloud').onclick=()=>$('#cloudDialog').close();
 $('#signIn').onclick=async()=>{try{const provider=new A.GoogleAuthProvider();provider.setCustomParameters({prompt:'select_account'});await A.signInWithPopup(auth,provider)}catch(e){status(errorText(e))}};
 $('#signOut').onclick=async()=>{try{await A.signOut(auth);document.dispatchEvent(new CustomEvent('pq-cloud-signed-out'))}catch(e){status(errorText(e))}};
 $('#saveConfig').onclick=()=>{try{
  const config=JSON.parse($('#firebaseJson').value),uid=$('#ownerUid').value.trim();
  if(config.private_key||config.type==='service_account')throw Error('Servis hesabı anahtarı kullanmayın.');
  if(!['apiKey','authDomain','projectId','appId'].every(k=>typeof config[k]==='string'&&config[k].trim()))throw Error('Dört zorunlu Web yapılandırma alanını doldurun.');
  localStorage.setItem(key,JSON.stringify({config,uid}));$('#configResult').textContent='Yapılandırma kaydedildi. Uygulamak için sayfayı yenileyin.';
 }catch(e){$('#configResult').textContent='Kaydedilemedi: '+e.message}};
 let settings=null;try{settings=JSON.parse(localStorage.getItem(key)||'null')}catch{}
 if(!settings&&window.PQ_FIREBASE_CONFIG)settings={config:window.PQ_FIREBASE_CONFIG,uid:window.PQ_ALLOWED_UID||''};
 if(settings){$('#firebaseJson').value=JSON.stringify(settings.config,null,2);$('#ownerUid').value=settings.uid||'';connect(settings.config,settings.uid||'')}
 else status('Yerel kullanım · Firebase henüz yapılandırılmadı');
}
export {errorText};
