import { auth, db, isFirebaseConfigured } from "./firebase.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import { doc, getDoc, collection, query, where, getDocs, addDoc, updateDoc, deleteDoc, serverTimestamp, orderBy, limit } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import { safeText, ROLE_HOME, statusPill } from "./tenant-security.js";

const ROLE_META={
 admin:{label:"Administrator",subtitle:"Complete hostel operations and oversight",nav:[["Overview","overview","⌂"],["Students","students","♙"],["Rooms","rooms","▦"],["Fees & Payments","fees","₹"],["Mess Management","mess","♨"],["Inventory","inventory","▤"],["Expenses","expenses","↗"],["Staff & Approvals","users","♧"],["Complaints","complaints","✉"],["Reports","reports","▥"],["Hostel Settings","settings","⚙"]]},
 warden:{label:"Warden",subtitle:"Residents, room allocation and daily hostel operations",nav:[["Overview","overview","⌂"],["Students","students","♙"],["Rooms","rooms","▦"],["Complaints","complaints","✉"],["Announcements","announcements","◉"],["Reports","reports","▥"]]},
 accountant:{label:"Accountant",subtitle:"Fees, receipts, dues and financial reporting",nav:[["Overview","overview","⌂"],["Fees & Payments","fees","₹"],["Expenses","expenses","↗"],["Reports","reports","▥"]]},
 mess_manager:{label:"Mess Manager",subtitle:"Meal planning, stock and mess expenditure",nav:[["Overview","overview","⌂"],["Mess Menu","mess","♨"],["Inventory","inventory","▤"],["Expenses","expenses","↗"],["Reports","reports","▥"]]},
 student:{label:"Student",subtitle:"Your hostel information and student services",nav:[["Overview","overview","⌂"],["My Profile","profile","♙"],["My Fees","fees","₹"],["Mess Menu","mess","♨"],["Complaints","complaints","✉"],["Announcements","announcements","◉"]]},
 parent:{label:"Parent / Guardian",subtitle:"View your linked student's hostel information",nav:[["Overview","overview","⌂"],["Student Details","profile","♙"],["Fee Status","fees","₹"],["Mess Menu","mess","♨"],["Announcements","announcements","◉"]]}
};
const ICONS={students:"♙",rooms:"▦",fees:"₹",mess:"♨",inventory:"▤",expenses:"↗",users:"♧",complaints:"✉",announcements:"◉",reports:"▥",profile:"♙",settings:"⚙"};
const COLLECTIONS={students:"students",rooms:"rooms",fees:"fees",mess:"messMenu",inventory:"inventory",expenses:"expenses",users:"users",complaints:"complaints",announcements:"announcements"};
const FIELD_MAP={
 students:[["fullName","Full name","text"],["studentCode","Student ID","text"],["email","Email","email"],["phone","Phone","tel"],["roomNumber","Room number","text"],["course","Course / Class","text"],["guardianName","Guardian name","text"],["guardianPhone","Guardian phone","tel"],["status","Status","select:active,inactive"]],
 rooms:[["roomNumber","Room number","text"],["capacity","Capacity","number"],["occupied","Occupied beds","number"],["type","Room type","select:Standard,AC,Non-AC,VIP"],["monthlyFee","Monthly fee","number"],["status","Status","select:available,occupied,maintenance"]],
 fees:[["studentCode","Student ID","text"],["studentName","Student name","text"],["title","Fee title","text"],["amount","Amount","number"],["dueDate","Due date","date"],["status","Status","select:unpaid,paid,overdue"],["receiptNo","Receipt number","text"]],
 mess:[["day","Day","select:Monday,Tuesday,Wednesday,Thursday,Friday,Saturday,Sunday"],["meal","Meal","select:Breakfast,Lunch,Dinner,Snack"],["menu","Menu items","text"],["notes","Notes","text"]],
 inventory:[["itemName","Item name","text"],["category","Category","text"],["quantity","Quantity","number"],["unit","Unit","text"],["reorderLevel","Reorder level","number"],["supplier","Supplier","text"]],
 expenses:[["title","Expense title","text"],["category","Category","select:Mess,Utilities,Maintenance,Salaries,Other"],["amount","Amount","number"],["date","Date","date"],["notes","Notes","text"]],
 complaints:[["subject","Subject","text"],["details","Details","textarea"],["priority","Priority","select:Low,Normal,High"],["status","Status","select:open,in_progress,resolved"]],
 announcements:[["title","Title","text"],["message","Message","textarea"],["audience","Audience","select:All,Students,Parents,Staff"]]
};
const $=s=>document.querySelector(s);
let profile=null,role="",activeSection="overview",allRecords=[],toastTimer;
function toast(message){let el=$("#toast");if(!el){el=document.createElement("div");el.id="toast";el.className="toast";document.body.append(el);}el.textContent=message;el.classList.remove("hidden");clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.add("hidden"),3800);}
function initials(name="User"){return name.trim().split(/\s+/).slice(0,2).map(x=>x[0]).join("").toUpperCase();}
function money(v){return "Rs. "+Number(v||0).toLocaleString("en-PK");}
function canManage(section){if(role==="admin")return true;if(role==="warden")return ["students","rooms","complaints","announcements"].includes(section);if(role==="accountant")return ["fees","expenses"].includes(section);if(role==="mess_manager")return ["mess","inventory","expenses"].includes(section);if(role==="student")return ["complaints"].includes(section);return false;}
function sectionAllowed(section){return ROLE_META[role]?.nav.some(n=>n[1]===section);}
async function getCollection(section, limitNum=250){
 const name=COLLECTIONS[section];if(!name)return [];
 let q;
 if(section==="users"&&role==="admin") q=query(collection(db,"users"),where("hostelId","==",profile.hostelId),limit(limitNum));
 else if(role==="student"&&section==="profile") return [profile];
 else if(role==="parent"&&section==="profile"){
   const code=profile.linkedStudentCode;if(!code)return [];
   q=query(collection(db,"users"),where("hostelId","==",profile.hostelId),where("role","==","student"),where("studentCode","==",code),where("status","==","approved"),limit(2));
 } else q=query(collection(db,name),where("hostelId","==",profile.hostelId),limit(limitNum));
 const snap=await getDocs(q);return snap.docs.map(d=>({id:d.id,...d.data()}));
}
async function countRecords(section){try{return (await getCollection(section,500)).length;}catch{return 0;}}
function renderShell(){
 const meta=ROLE_META[role],nav=meta.nav;
 document.title=`${meta.label} • ${profile.hostelName||"HostelPro"}`;
 $("#app").innerHTML=`<div class="app-shell"><aside class="sidebar" id="sidebar"><div class="side-brand"><div class="brand-mark">HP</div><div><b>HostelPro</b><small>OPERATIONS SUITE</small></div></div><div class="side-hostel"><small>Your hostel</small><strong>${safeText(profile.hostelName||"Hostel workspace")}</strong>${role==="admin"?`<code>ID: ${safeText(profile.hostelId)}</code>`:""}</div><div class="nav-label">WORKSPACE</div><nav class="nav-list">${nav.map(([label,key,ico],i)=>`<button class="nav-item ${i===0?"active":""}" data-section="${key}"><span class="ico">${ico}</span>${label}</button>`).join("")}</nav><div class="side-bottom"><div class="user-mini"><div class="avatar">${safeText(initials(profile.displayName))}</div><div><b>${safeText(profile.displayName||"User")}</b><small>${safeText(meta.label)}</small></div></div><button class="nav-item" id="logout-btn"><span class="ico">↪</span>Sign out</button></div></aside><main class="main-area"><header class="topbar"><div style="display:flex;align-items:center;gap:12px"><button class="icon-btn mobile-menu" id="menu-btn">☰</button><div><div class="top-title" id="top-title">Overview</div><div class="top-sub">${safeText(profile.hostelName||"HostelPro workspace")}</div></div></div><div class="top-actions"><span class="pill green">${safeText(meta.label)}</span><button class="icon-btn desktop-only" id="refresh-btn" title="Refresh">↻</button><div class="avatar">${safeText(initials(profile.displayName))}</div></div></header><section class="content" id="content"></section><div class="footer-note">HostelPro • Secure multi-hostel workspace</div></main></div><div id="toast" class="toast hidden"></div><div id="modal-root"></div>`;
 document.querySelectorAll("[data-section]").forEach(b=>b.addEventListener("click",()=>navigate(b.dataset.section)));
 $("#logout-btn").addEventListener("click",async()=>{await signOut(auth);location.replace("index.html");});
 $("#refresh-btn").addEventListener("click",()=>navigate(activeSection,true));
 $("#menu-btn").addEventListener("click",()=>$("#sidebar").classList.toggle("open"));
}
function navigate(section,refresh=false){if(!sectionAllowed(section))return;activeSection=section;document.querySelectorAll("[data-section]").forEach(b=>b.classList.toggle("active",b.dataset.section===section));$("#top-title").textContent=ROLE_META[role].nav.find(n=>n[1]===section)?.[0]||"Overview";$("#sidebar").classList.remove("open");renderSection(section).catch(e=>{console.error(e);$("#content").innerHTML=`<div class="panel"><div class="empty-state"><strong>Could not load this section</strong>${safeText(e.message||"Check Firestore setup, indexes and rules.")}</div></div>`;});}
function heading(title,sub,button=""){return `<div class="section-heading"><div><h2>${title}</h2><p>${sub}</p></div>${button}</div>`;}
function stat(label,value,icon,note="From this hostel workspace"){return `<div class="stat-card"><div class="stat-top"><span>${label}</span><span class="stat-icon">${icon}</span></div><div class="stat-value">${value}</div><div class="stat-note">${note}</div></div>`;}
function panel(title,sub,body,extra=""){return `<div class="panel"><div class="panel-head"><div><h3>${title}</h3><p>${sub}</p></div>${extra}</div>${body}</div>`;}
function empty(title,sub){return `<div class="empty-state"><strong>${title}</strong>${sub}</div>`;}
function recordsTable(records,section){
 if(!records.length)return empty("No records yet","Add a record to start building your hostel workspace.");
 const fields=FIELD_MAP[section]||[];
 const cols=fields.slice(0,5);
 return `<div class="table-wrap"><table><thead><tr>${cols.map(f=>`<th>${safeText(f[1])}</th>`).join("")}<th>Status</th>${canManage(section)?"<th>Actions</th>":""}</tr></thead><tbody>${records.map(r=>`<tr>${cols.map(f=>`<td>${f[0]==="amount"||f[0]==="monthlyFee"?money(r[f[0]]):safeText(r[f[0]]??"—")}</td>`).join("")}<td>${statusPill(r.status||"active")}</td>${canManage(section)?`<td><button class="btn ghost" data-edit="${safeText(r.id)}" data-col="${section}">Edit</button> <button class="btn danger" data-delete="${safeText(r.id)}" data-col="${section}">Delete</button></td>`:""}</tr>`).join("")}</tbody></table></div>`;
}
function dashboardOverview(){
 const isAdmin=role==="admin", isStudent=role==="student",isParent=role==="parent";
 return Promise.all(["students","rooms","fees","inventory","complaints","users","expenses"].map(countRecords)).then(([students,rooms,fees,inventory,complaints,users,expenses])=>{
   const cards=isStudent||isParent?[
    stat("Account status",statusPill(profile.status),"♙","Your access status"),
    stat("Hostel",safeText(profile.hostelName),"⌂","Your registered workspace"),
    stat("Hostel ID",role==="admin"?safeText(profile.hostelId):"Hidden","▣","Only admins can view the ID"),
    stat("My fees","Open Fees","₹","Check your payment information")
   ]:[
    stat("Students",students,"♙","Students in this hostel"),
    stat("Rooms",rooms,"▦","Room records"),
    stat("Fee records",fees,"₹","Fee entries"),
    stat(role==="admin"?"Team accounts":"Complaints",role==="admin"?users:complaints,role==="admin"?"♧":"✉",role==="admin"?"Accounts linked to this hostel":"Records in this hostel")
   ];
   return `<div class="welcome-row"><div><h1>Good day, ${safeText(profile.displayName?.split(" ")[0]||"there")} 👋</h1><p>${safeText(ROLE_META[role].subtitle)}.</p></div>${role==="admin"?`<button class="btn secondary" data-section-jump="settings">⚙ Hostel settings</button>`:""}</div><div class="stats">${cards.join("")}</div><div class="panel-grid">${panel(isAdmin?"Workspace at a glance":"Your workspace","Quick view of the areas available to your role",`<div class="bar-list">${[["Students",students],["Rooms",rooms],["Fee records",fees],["Inventory items",inventory],["Complaints",complaints]].map(([n,v])=>`<div><div class="bar-label"><span>${n}</span><b>${v}</b></div><div class="bar"><span style="width:${Math.min(100,Number(v)*5)}%"></span></div></div>`).join("")}</div>`)}${panel("Quick actions","Common tasks for your role",`<div class="quick-grid">${ROLE_META[role].nav.slice(1,5).map(([n,k,i])=>`<button class="quick-action" data-section-jump="${k}"><span class="quick-icon">${i}</span><strong>${n}</strong><small>Open ${n.toLowerCase()}</small></button>`).join("")}</div>`)}</div>${panel("Recent activity","Latest records from your hostel",empty("Your workspace is ready","Use the sections to add students, rooms, fees, meals and more."))}`;
 });
}
function formFor(section,record={}){
 const fields=FIELD_MAP[section]||[];
 return `<form id="record-form" class="data-form">${fields.map(([key,label,type])=>`<label class="${type==="textarea"?"span-all":""}">${label}${type.startsWith("select:")?`<select name="${key}" ${key==="status"?"required":""}>${type.slice(7).split(",").map(v=>`<option ${String(record[key]||"")===v?"selected":""}>${v}</option>`).join("")}</select>`:type==="textarea"?`<textarea name="${key}" rows="3">${safeText(record[key]||"")}</textarea>`:`<input name="${key}" type="${type}" ${["fullName","roomNumber","studentCode","title","amount","itemName","subject","menu","day","meal"].includes(key)?"required":""} value="${safeText(record[key]??"")}" ${type==="number"?'min="0" step="any"':""}>`}</label>`).join("")}<div class="span-all help">This record will be saved under ${safeText(profile.hostelName)} (Hostel ID is attached automatically).</div></form>`;
}
function openModal(section,record=null){
 const title=(record?"Edit ":"Add ")+({students:"student",rooms:"room",fees:"fee/payment",mess:"mess menu",inventory:"inventory item",expenses:"expense",complaints:"complaint",announcements:"announcement"}[section]||"record");
 $("#modal-root").innerHTML=`<div class="modal-backdrop" id="backdrop"><div class="modal"><div class="modal-head"><h3>${safeText(title)}</h3><button class="icon-btn" id="close-modal">×</button></div>${formFor(section,record||{})}<div id="form-error" class="inline-error"></div><div class="modal-actions"><button class="btn ghost" id="cancel-modal">Cancel</button><button class="btn primary" id="save-record">Save record</button></div></div></div>`;
 const close=()=>$("#modal-root").innerHTML="";$("#close-modal").onclick=close;$("#cancel-modal").onclick=close;$("#backdrop").addEventListener("click",e=>{if(e.target.id==="backdrop")close();});
 $("#save-record").onclick=async()=>{
  const form=$("#record-form");if(!form.reportValidity())return;const data=Object.fromEntries(new FormData(form).entries());
  for(const [k,v] of Object.entries(data)){if(["amount","capacity","occupied","monthlyFee","quantity","reorderLevel"].includes(k))data[k]=Number(v||0);}
  $("#save-record").disabled=true;
  try{
   if(record)await updateDoc(doc(db,COLLECTIONS[section],record.id),{...data,updatedAt:serverTimestamp()});
   else await addDoc(collection(db,COLLECTIONS[section]),{...data,hostelId:profile.hostelId,createdBy:profile.uid,createdAt:serverTimestamp(),updatedAt:serverTimestamp()});
   close();toast("Record saved successfully.");navigate(section,true);
  }catch(e){$("#form-error").textContent=e.message||"Could not save record.";}
  finally{const b=$("#save-record");if(b)b.disabled=false;}
 };
}
async function renderCollectionSection(section){
 let records=[];
 if(section==="profile"&&role==="student")records=[profile];
 else if(section==="profile"&&role==="parent"){
  const code=profile.linkedStudentCode;
  if(code){const q=query(collection(db,"users"),where("hostelId","==",profile.hostelId),where("role","==","student"),where("studentCode","==",code),where("status","==","approved"),limit(1));const snap=await getDocs(q);records=snap.docs.map(d=>({id:d.id,...d.data()}));}
 }else records=await getCollection(section);
 allRecords=records;
 let title=ROLE_META[role].nav.find(n=>n[1]===section)?.[0]||section;
 const canAdd=canManage(section)&&FIELD_MAP[section];
 const extra=canAdd?`<button class="btn primary" id="add-record">+ Add new</button>`:"";
 $("#content").innerHTML=heading(title,`Manage ${title.toLowerCase()} for ${safeText(profile.hostelName)}`,extra)+`<div class="panel"><div class="toolbar"><input id="table-search" placeholder="Search records..."><button class="btn ghost" id="export-csv">Export CSV</button></div><div id="records-table">${recordsTable(records,section)}</div></div>`;
 if(canAdd)$("#add-record").onclick=()=>openModal(section);
 $("#export-csv").onclick=()=>exportCSV(records,section);
 $("#table-search").oninput=e=>{const term=e.target.value.toLowerCase();const filtered=records.filter(r=>Object.values(r).some(v=>String(v??"").toLowerCase().includes(term)));$("#records-table").innerHTML=recordsTable(filtered,section);bindRowActions(section,filtered);};
 bindRowActions(section,records);
}
function bindRowActions(section,records){
 document.querySelectorAll("[data-edit]").forEach(b=>b.onclick=()=>openModal(section,records.find(r=>r.id===b.dataset.edit)));
 document.querySelectorAll("[data-delete]").forEach(b=>b.onclick=async()=>{if(!confirm("Delete this record? This cannot be undone."))return;try{await deleteDoc(doc(db,COLLECTIONS[section],b.dataset.delete));toast("Record deleted.");navigate(section,true);}catch(e){toast(e.message||"Delete failed.");}});
}
function exportCSV(records,section){
 if(!records.length){toast("No records to export.");return;}
 const keys=[...new Set(records.flatMap(r=>Object.keys(r).filter(k=>!["id"].includes(k))))];
 const esc=v=>`"${String(v??"").replaceAll('"','""')}"`;
 const csv=[keys.map(esc).join(","),...records.map(r=>keys.map(k=>esc(r[k]?.toDate?r[k].toDate().toISOString():r[k])).join(","))].join("\r\n");
 const url=URL.createObjectURL(new Blob(["\ufeff"+csv],{type:"text/csv;charset=utf-8;"}));const a=document.createElement("a");a.href=url;a.download=`hostelpro-${section}-${new Date().toISOString().slice(0,10)}.csv`;a.click();URL.revokeObjectURL(url);
}
async function renderUsers(){
 const users=await getCollection("users");
 const rows=users.filter(u=>u.uid!==profile.uid);
 const body=rows.length?`<div class="table-wrap"><table><thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th>Action</th></tr></thead><tbody>${rows.map(u=>`<tr><td><b>${safeText(u.displayName)}</b><div class="td-sub">${safeText(u.phone||"")}</div></td><td>${safeText(u.email)}</td><td><select data-role="${safeText(u.uid)}">${["warden","accountant","mess_manager","student","parent"].map(r=>`<option value="${r}" ${u.role===r?"selected":""}>${r.replace("_"," ")}</option>`).join("")}</select></td><td>${statusPill(u.status)}</td><td><button class="btn primary" data-approve="${safeText(u.uid)}" data-status="approved">Approve</button> <button class="btn danger" data-approve="${safeText(u.uid)}" data-status="rejected">Reject</button></td></tr>`).join("")}</tbody></table></div>`:empty("No other accounts yet","New staff, student and parent registrations will appear here.");
 $("#content").innerHTML=heading("Staff & account approvals","Approve registrations and assign roles. All accounts are restricted to this hostel.")+`<div class="panel">${body}</div>`;
 document.querySelectorAll("[data-approve]").forEach(b=>b.onclick=async()=>{const uid=b.dataset.approve;const status=b.dataset.status;try{await updateDoc(doc(db,"users",uid),{status,updatedAt:serverTimestamp()});toast(`Account ${status}.`);navigate("users");}catch(e){toast(e.message||"Could not update account.");}});
 document.querySelectorAll("[data-role]").forEach(s=>s.onchange=async()=>{try{await updateDoc(doc(db,"users",s.dataset.role),{role:s.value,updatedAt:serverTimestamp()});toast("Role updated.");}catch(e){toast(e.message||"Could not change role.");}});
}
async function renderSettings(){
 $("#content").innerHTML=heading("Hostel settings","Only the hostel administrator can edit the workspace name or view the Hostel ID.")+`<div class="panel" style="max-width:700px"><div class="data-form"><label>Hostel name<input id="setting-hostel-name" value="${safeText(profile.hostelName)}" maxlength="100"></label><label>Hostel ID<input value="${safeText(profile.hostelId)}" readonly></label></div><p class="help">Hostel ID is generated once and is used during account registration. Users do not enter it during login.</p><button class="btn primary" id="save-hostel">Save hostel name</button><div id="setting-error" class="inline-error"></div></div>`;
 $("#save-hostel").onclick=async()=>{const name=$("#setting-hostel-name").value.trim();if(name.length<2){$("#setting-error").textContent="Enter a valid hostel name.";return;}try{await updateDoc(doc(db,"hostels",profile.hostelId),{name,updatedAt:serverTimestamp()});const q=query(collection(db,"users"),where("hostelId","==",profile.hostelId),limit(500));const snap=await getDocs(q);for(const d of snap.docs)await updateDoc(d.ref,{hostelName:name,updatedAt:serverTimestamp()});profile.hostelName=name;toast("Hostel name updated.");renderShell();navigate("settings");}catch(e){$("#setting-error").textContent=e.message||"Could not update hostel name.";}}
}
async function renderSection(section){
 if(section==="overview"){const html=await dashboardOverview();$("#content").innerHTML=html;document.querySelectorAll("[data-section-jump]").forEach(b=>b.onclick=()=>navigate(b.dataset.sectionJump));return;}
 if(section==="users"&&role==="admin")return renderUsers();
 if(section==="settings"&&role==="admin")return renderSettings();
 return renderCollectionSection(section);
}
export function startDashboard(expectedRole){
 if(!isFirebaseConfigured()){document.body.innerHTML=`<div class="auth-body"><div class="panel" style="max-width:650px"><h2>Firebase setup required</h2><p>Fill in <code>js/firebase-config.js</code>, enable Email/Password Authentication, create Firestore, and deploy the included security rules.</p><a class="btn primary" href="index.html">Back to login</a></div></div>`;return;}
 onAuthStateChanged(auth,async user=>{
  if(!user){location.replace("index.html");return;}
  try{
   const snap=await getDoc(doc(db,"users",user.uid));
   if(!snap.exists()){await signOut(auth);location.replace("index.html");return;}
   profile={uid:user.uid,...snap.data()};role=profile.role;
   if(profile.status!=="approved"){await signOut(auth);location.replace("index.html");return;}
   if(role!==expectedRole){const target=ROLE_HOME[role];if(target)location.replace(target);else{await signOut(auth);location.replace("index.html");}return;}
   renderShell();navigate("overview");
  }catch(e){document.body.innerHTML=`<div class="auth-body"><div class="panel" style="max-width:650px"><h2>Could not load dashboard</h2><p>${safeText(e.message||"Check Firestore rules and configuration.")}</p><a href="index.html">Return to login</a></div></div>`;}
 });
}
