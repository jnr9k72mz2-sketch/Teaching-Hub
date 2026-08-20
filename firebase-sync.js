import {initializeApp} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import {getAuth,onAuthStateChanged,createUserWithEmailAndPassword,signInWithEmailAndPassword,signOut} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import {getFirestore,doc,getDoc,setDoc,onSnapshot,serverTimestamp} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import {firebaseConfig} from './firebase-config.js';

const $=selector=>document.querySelector(selector),configured=!firebaseConfig.apiKey.includes('PASTE_');
const dialog=$('#syncDialog'),button=$('#syncBtn'),error=$('#syncError'),signedOut=$('#syncSignedOut'),signedIn=$('#syncSignedIn');
let auth,db,user,unsubscribe,saveTimer,applyingRemote=false,localWriteInFlight=false;

function setStatus(text,state='ready'){$('#syncStatusText').textContent=text;button.dataset.syncState=state;$('#syncIcon').textContent=state==='saving'?'↻':state==='error'?'!':'☁'}
function showError(message='') {error.textContent=message}
function friendlyError(code){return ({'auth/email-already-in-use':'Этот email уже зарегистрирован','auth/invalid-email':'Проверьте email','auth/invalid-credential':'Неверный email или пароль','auth/weak-password':'Пароль должен содержать минимум 6 символов','auth/network-request-failed':'Нет соединения с интернетом'})[code]||'Не удалось подключиться к Firebase'}
function credentials(){return {email:$('#syncEmail').value.trim(),password:$('#syncPassword').value}}
async function loadCloud(currentUser){
  const reference=doc(db,'users',currentUser.uid,'teachingHub','state'),snapshot=await getDoc(reference);
  if(snapshot.exists()){applyingRemote=true;window.teachingHubCloud.apply(snapshot.data().data||{});applyingRemote=false}else await setDoc(reference,{data:window.teachingHubCloud.snapshot(),updatedAt:serverTimestamp()});
  unsubscribe?.();unsubscribe=onSnapshot(reference,next=>{if(!next.exists()||applyingRemote||localWriteInFlight)return;applyingRemote=true;window.teachingHubCloud.apply(next.data().data||{});applyingRemote=false;setStatus('Данные синхронизированы')},()=>setStatus('Ошибка синхронизации','error'));
}

button.addEventListener('click',()=>{showError(configured?'':'Сначала добавьте настройки Firebase-проекта');dialog.showModal()});
$('#closeSync').addEventListener('click',()=>dialog.close());
$('#syncForm').addEventListener('submit',async event=>{event.preventDefault();if(!configured)return showError('Firebase ещё не настроен');showError();try{const {email,password}=credentials();await signInWithEmailAndPassword(auth,email,password);dialog.close()}catch(problem){showError(friendlyError(problem.code))}});
$('#syncRegister').addEventListener('click',async()=>{if(!configured)return showError('Firebase ещё не настроен');showError();try{const {email,password}=credentials();await createUserWithEmailAndPassword(auth,email,password)}catch(problem){showError(friendlyError(problem.code))}});
$('#syncLogout').addEventListener('click',()=>signOut(auth));
$('#syncNow').addEventListener('click',()=>window.firebaseSyncSave?.(window.teachingHubCloud.snapshot(),true));

if(configured){
  const app=initializeApp(firebaseConfig);auth=getAuth(app);db=getFirestore(app);
  window.firebaseSyncSave=(data,immediate=false)=>{if(!user||applyingRemote)return;clearTimeout(saveTimer);const save=async()=>{localWriteInFlight=true;setStatus('Сохраняю…','saving');try{await setDoc(doc(db,'users',user.uid,'teachingHub','state'),{data,updatedAt:serverTimestamp()});setStatus('Данные сохранены')}catch{setStatus('Ошибка сохранения','error')}finally{localWriteInFlight=false}};if(immediate)save();else saveTimer=setTimeout(save,700)};
  onAuthStateChanged(auth,async currentUser=>{user=currentUser;signedOut.classList.toggle('hidden',!!user);signedIn.classList.toggle('hidden',!user);button.classList.toggle('connected',!!user);if(user){$('#syncUserEmail').textContent=user.email;setStatus('Загружаю данные…','saving');try{await loadCloud(user);setStatus('Данные синхронизированы')}catch{setStatus('Ошибка подключения','error')}}else{unsubscribe?.();setStatus('Войдите для синхронизации')}});
}else setStatus('Firebase не настроен','error');
