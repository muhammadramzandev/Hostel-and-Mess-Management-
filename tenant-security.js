// Client-side convenience helpers. These are NOT a substitute for firestore.rules.
// Every data query should include hostelId; rules independently enforce tenant boundaries.
import { doc, getDoc, collection, query, where, getDocs, addDoc, updateDoc, deleteDoc, serverTimestamp, orderBy, limit } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
export const ROLE_HOME = {
  admin: "admin-dashboard.html", warden: "warden-dashboard.html",
  accountant: "accountant-dashboard.html", mess_manager: "mess-manager-dashboard.html",
  student: "student-dashboard.html", parent: "parent-dashboard.html"
};
export function safeText(v=""){return String(v).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
export async function getUserProfile(db, uid) {
  const snap = await getDoc(doc(db,"users",uid));
  return snap.exists() ? {uid:snap.id,...snap.data()} : null;
}
export function tenantQuery(db, collectionName, hostelId, extra=[]) {
  return query(collection(db,collectionName),where("hostelId","==",hostelId),...extra);
}
export async function listTenant(db, collectionName, hostelId, max=200) {
  const q = query(collection(db,collectionName),where("hostelId","==",hostelId),limit(max));
  const snap = await getDocs(q);
  return snap.docs.map(d=>({id:d.id,...d.data()}));
}
export async function createTenantRecord(db, collectionName, hostelId, payload) {
  return addDoc(collection(db,collectionName),{...payload,hostelId,createdAt:serverTimestamp(),updatedAt:serverTimestamp()});
}
export async function changeTenantRecord(db, collectionName, id, payload) {
  return updateDoc(doc(db,collectionName,id),{...payload,updatedAt:serverTimestamp()});
}
export async function removeTenantRecord(db, collectionName, id) {
  return deleteDoc(doc(db,collectionName,id));
}
export function statusPill(status="pending"){
  const s=String(status).toLowerCase(); const cls=s==="approved"||s==="paid"||s==="active"?"green":s==="rejected"||s==="overdue"?"red":"amber";
  return `<span class="pill ${cls}">${safeText(status)}</span>`;
}
