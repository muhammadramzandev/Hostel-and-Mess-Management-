import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js';
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, sendPasswordResetEmail, onAuthStateChanged, signOut, updateProfile } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';
import { getFirestore, doc, getDoc, runTransaction, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';
import { firebaseConfig, CONFIGURED } from './firebase-config.js';
const $=s=>document.querySelector(s), msg=$('#authMessage'); let auth,db,busy=false;
function message(t,type=''){ if(!msg)return; msg.textContent=t; msg.className='message '+type; }
function friendly(e){const c=e?.code||'';if(c.includes('email-already-in-use'))return 'This email already has an account. Please sign in.';if(c.includes('weak-password'))return 'Use a password with at least 8 characters.';if(c.includes('invalid-credential')||c.includes('user-not-found'))return 'Email or password is incorrect.';if(c.includes('permission-denied'))return 'Permission denied. Ask the system administrator to verify the deployed Firestore rules.';return e?.message||'Something went wrong. Please try again.';}
if(!CONFIGURED){message('Setup required: add Firebase Web App values in firebase-config.js, enable Email/Password Authentication, create Firestore, and publish firestore.rules.','error');}
else { initializeApp(firebaseConfig); auth=getAuth(); db=getFirestore(); onAuthStateChanged(auth,u=>{if(u)routeUser(u);}); }
const tabs=[...document.querySelectorAll('[data-tab]')];
tabs.forEach(b=>b.addEventListener('click',()=>{tabs.forEach(x=>x.classList.toggle('active',x===b));$('#loginForm').classList.toggle('hidden',b.dataset.tab!=='login');$('#registerForm').classList.toggle('hidden',b.dataset.tab!=='register');message('');}));
function roleFields(){const role=$('#regRole').value;$('#hostelIdWrap').classList.remove('hidden');$('#hostelId').required=true;$('#inviteWrap').classList.toggle('hidden',!['warden','accountant','messManager'].includes(role));$('#inviteCode').required=['warden','accountant','messManager'].includes(role);$('#studentIdWrap').classList.toggle('hidden',role!=='parent');$('#studentLink').required=role==='parent';}
$('#regRole').addEventListener('change',roleFields); roleFields();
$('#loginForm').addEventListener('submit',async e=>{e.preventDefault();if(!auth)return;const f=new FormData(e.currentTarget);try{message('Signing in…');await signInWithEmailAndPassword(auth,String(f.get('email')).trim().toLowerCase(),f.get('password'));}catch(err){message(friendly(err),'error');}});
$('#forgotBtn').addEventListener('click',async()=>{if(!auth)return;const email=$('#loginForm [name=email]').value.trim();if(!email)return message('Enter your email address first.','error');try{await sendPasswordResetEmail(auth,email);message('Password reset email sent. Check your inbox.','success');}catch(e){message(friendly(e),'error');}});
$('#registerForm').addEventListener('submit',async e=>{
 e.preventDefault();if(!auth||busy)return;const f=new FormData(e.currentTarget),role=String(f.get('role')||''),name=String(f.get('name')||'').trim(),email=String(f.get('email')||'').trim().toLowerCase(),password=String(f.get('password')||''),confirm=String(f.get('confirmPassword')||''),hostelId=String(f.get('hostelId')||'').trim().toUpperCase(),inviteCode=String(f.get('inviteCode')||'').trim(),studentLink=String(f.get('studentLink')||'').trim(),phone=String(f.get('phone')||'').trim();
 if(!['warden','accountant','messManager','student','parent'].includes(role))return message('This account type cannot be registered publicly.','error');
 if(password!==confirm)return message('Passwords do not match.','error');if(password.length<8)return message('Password must contain at least 8 characters.','error');if(!hostelId)return message('Enter the Hostel ID given by your hostel administrator.','error');
 busy=true;const submit=e.currentTarget.querySelector('[type=submit]');submit.disabled=true;let createdUser=null;
 try{
  message('Creating account…');const cred=await createUserWithEmailAndPassword(auth,email,password);createdUser=cred.user;await updateProfile(cred.user,{displayName:name});const uid=cred.user.uid;
  await runTransaction(db,async tx=>{
   const hRef=doc(db,'hostels',hostelId),uRef=doc(db,'users',uid),mirrorRef=doc(db,'hostels',hostelId,'users',uid);
   const hSnap=await tx.get(hRef);if(!hSnap.exists()||hSnap.data().status!=='active')throw new Error('Hostel ID not found or inactive. Check it with your hostel admin.');
   let invitationRef=null;
   if(['warden','accountant','messManager'].includes(role)){
    if(!inviteCode)throw new Error('Enter the invitation code from your hostel admin.');invitationRef=doc(db,'hostels',hostelId,'invitations',inviteCode);const inv=await tx.get(invitationRef);
    if(!inv.exists()||String(inv.data().email||'').toLowerCase()!==email||inv.data().role!==role||inv.data().used===true)throw new Error('Invalid, expired, or already-used invitation code. Ask your admin for a new one.');
    tx.update(invitationRef,{used:true,usedBy:uid,usedAt:serverTimestamp()});
   }
   let parentStudentUid=null;
   if(role==='parent'){
    if(!studentLink)throw new Error('Enter the student record ID provided by the hostel.');const stRef=doc(db,'hostels',hostelId,'students',studentLink);const st=await tx.get(stRef);if(!st.exists())throw new Error('Student record not found. Ask the warden for the exact student record ID.');parentStudentUid=studentLink;
   }
   const profile={uid,name,email,role,hostelId,hostelName:hSnap.data().hostelName,status:'pending',phone,parentStudentUid,invitationCode:inviteCode||'',createdAt:serverTimestamp()};
   tx.set(uRef,profile);tx.set(mirrorRef,profile);
  });
  await signOut(auth);message('Account created successfully. It is pending admin approval. You can sign in after approval.','success');e.currentTarget.reset();roleFields();
 }catch(err){if(createdUser&&auth.currentUser?.uid===createdUser.uid)await signOut(auth).catch(()=>{});message(friendly(err),'error');}
 finally{busy=false;submit.disabled=false;}
});
async function routeUser(u){try{const snap=await getDoc(doc(db,'users',u.uid));if(!snap.exists()){message('Account profile is missing. Contact the system administrator to provision or repair this account.','error');await signOut(auth);return;}const p=snap.data();if(p.status!=='active'){message('Your account is '+(p.status||'pending')+'. Ask your hostel admin to approve it.','error');await signOut(auth);return;}const pages={admin:'admin-dashboard.html',warden:'warden-dashboard.html',accountant:'accountant-dashboard.html',messManager:'mess-manager-dashboard.html',student:'student-dashboard.html',parent:'parent-dashboard.html'};if(pages[p.role])location.replace(pages[p.role]);else{message('Unrecognized account role. Contact the system administrator.','error');await signOut(auth);}}catch(e){message(friendly(e),'error');await signOut(auth).catch(()=>{});}}
