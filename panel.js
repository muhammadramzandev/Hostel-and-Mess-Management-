import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js';

import {
  getAuth,
  onAuthStateChanged,
  signOut
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';

import {
  getFirestore,
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';

import {
  firebaseConfig,
  CONFIGURED
} from './firebase-config.js';

const ROLE = document.body.dataset.role;
const $ = s => document.querySelector(s);

let app, auth, db, profile, uid;

const esc = v =>
  String(v ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[c]));

const configNotice = () => {
  if (!CONFIGURED) {
    $('#mainContent').innerHTML = `
      <div class="config-banner">
        <b>Firebase setup required.</b>
        Open <code>js/firebase-config.js</code>
        and fill the Web App configuration fields.
        Then enable Email/Password Authentication,
        create Firestore, and deploy
        <code>firestore.rules</code>.
      </div>`;
    return true;
  }

  return false;
};

const meta = {
  admin: {
    title: 'Admin Console',
    desc: 'Complete hostel operations and organization settings',
    nav: [
      ['overview', '▦', 'Overview'],
      ['users', '♙', 'User approvals'],
      ['students', '♟', 'Students'],
      ['rooms', '▤', 'Rooms'],
      ['fees', '＄', 'Fees & payments'],
      ['mess', '♨', 'Mess management'],
      ['inventory', '▣', 'Inventory'],
      ['expenses', '↗', 'Expenses'],
      ['staff', '♧', 'Staff & invitations'],
      ['complaints', '☏', 'Complaints'],
      ['announcements', '✦', 'Announcements'],
      ['reports', '▥', 'Reports'],
      ['settings', '⚙', 'Hostel settings']
    ]
  },

  warden: {
    title: 'Warden Panel',
    desc: 'Admissions, rooms, attendance and student welfare',
    nav: [
      ['overview', '▦', 'Overview'],
      ['students', '♟', 'Students'],
      ['rooms', '▤', 'Rooms'],
      ['attendance', '✓', 'Attendance'],
      ['complaints', '☏', 'Complaints'],
      ['announcements', '✦', 'Announcements']
    ]
  },

  accountant: {
    title: 'Accounts Desk',
    desc: 'Fee collection, balances and expense tracking',
    nav: [
      ['overview', '▦', 'Overview'],
      ['fees', '＄', 'Fees & payments'],
      ['expenses', '↗', 'Expenses'],
      ['reports', '▥', 'Financial reports']
    ]
  },

  messManager: {
    title: 'Mess Operations',
    desc: 'Menu, meal records, stock and food expenses',
    nav: [
      ['overview', '▦', 'Overview'],
      ['mess', '♨', 'Mess menu & meals'],
      ['inventory', '▣', 'Inventory'],
      ['expenses', '↗', 'Expenses']
    ]
  },

  student: {
    title: 'Student Portal',
    desc: 'Your room, fees, mess and hostel requests',
    nav: [
      ['overview', '▦', 'Overview'],
      ['myprofile', '♙', 'My profile'],
      ['myfees', '＄', 'My fees'],
      ['mess', '♨', 'Mess menu'],
      ['complaints', '☏', 'My complaints'],
      ['announcements', '✦', 'Announcements']
    ]
  },

  parent: {
    title: 'Parent Portal',
    desc: 'Stay updated on your linked student',
    nav: [
      ['overview', '▦', 'Overview'],
      ['myprofile', '♙', 'Student profile'],
      ['myfees', '＄', 'Fees & payments'],
      ['mess', '♨', 'Mess menu'],
      ['complaints', '☏', 'Contact warden'],
      ['announcements', '✦', 'Announcements']
    ]
  }
};

const tables = {
  students: {
    label: 'Students',
    fields: [
      ['name', 'Full name', 'text'],
      ['studentId', 'Admission / Student ID', 'text'],
      ['email', 'Email', 'email'],
      ['phone', 'Phone', 'text'],
      ['room', 'Room number', 'text'],
      ['guardianName', 'Parent / guardian', 'text'],
      ['guardianPhone', 'Guardian phone', 'text'],
      ['admissionDate', 'Admission date', 'date'],
      ['status', 'Status', 'select:active,inactive,pending']
    ]
  },

  rooms: {
    label: 'Rooms',
    fields: [
      ['roomNo', 'Room number', 'text'],
      ['block', 'Block / floor', 'text'],
      ['capacity', 'Capacity', 'number'],
      ['occupied', 'Occupied beds', 'number'],
      ['type', 'Room type', 'select:Standard,AC,Shared,Private'],
      ['monthlyRent', 'Monthly rent', 'number'],
      ['status', 'Status', 'select:Available,Full,Maintenance']
    ]
  },

  fees: {
    label: 'Fees & payments',
    fields: [
      ['studentUid', 'Student UID', 'text'],
      ['studentName', 'Student name', 'text'],
      ['feeType', 'Fee type', 'select:Tuition,Room,Mess,Admission,Other'],
      ['amount', 'Amount', 'number'],
      ['paid', 'Paid amount', 'number'],
      ['dueDate', 'Due date', 'date'],
      ['month', 'Month / period', 'text'],
      ['status', 'Status', 'select:Unpaid,Partial,Paid']
    ]
  },

  mess: {
    label: 'Mess menu & meals',
    fields: [
      ['date', 'Date', 'date'],
      ['breakfast', 'Breakfast', 'text'],
      ['lunch', 'Lunch', 'text'],
      ['dinner', 'Dinner', 'text'],
      ['notes', 'Notes / allergens', 'text']
    ]
  },

  inventory: {
    label: 'Inventory',
    fields: [
      ['item', 'Item name', 'text'],
      ['category', 'Category', 'text'],
      ['quantity', 'Quantity', 'number'],
      ['unit', 'Unit', 'text'],
      ['reorderLevel', 'Reorder level', 'number'],
      ['unitCost', 'Unit cost', 'number'],
      ['supplier', 'Supplier', 'text']
    ]
  },

  expenses: {
    label: 'Expenses',
    fields: [
      ['date', 'Date', 'date'],
      ['category', 'Category', 'select:Food,Maintenance,Utilities,Salary,Medical,Other'],
      ['description', 'Description', 'text'],
      ['amount', 'Amount', 'number'],
      ['paidTo', 'Paid to', 'text'],
      ['receiptNo', 'Receipt / reference', 'text']
    ]
  },

  complaints: {
    label: 'Complaints & requests',
    fields: [
      ['subject', 'Subject', 'text'],
      ['category', 'Category', 'select:Room,Maintenance,Mess,Fees,Security,Other'],
      ['description', 'Description', 'textarea'],
      ['priority', 'Priority', 'select:Low,Normal,High'],
      ['status', 'Status', 'select:Open,In progress,Resolved']
    ]
  },

  announcements: {
    label: 'Announcements',
    fields: [
      ['title', 'Title', 'text'],
      ['body', 'Message', 'textarea'],
      ['audience', 'Audience', 'select:Everyone,Students,Parents,Staff'],
      ['expiresAt', 'Expiry date', 'date']
    ]
  },

  attendance: {
    label: 'Attendance',
    fields: [
      ['studentUid', 'Student UID', 'text'],
      ['studentName', 'Student name', 'text'],
      ['date', 'Date', 'date'],
      ['status', 'Attendance', 'select:Present,Absent,Leave'],
      ['notes', 'Notes', 'text']
    ]
  },

  staff: {
    label: 'Staff & invitations',
    fields: [
      ['name', 'Staff name', 'text'],
      ['email', 'Staff email', 'email'],
      ['role', 'Role', 'select:warden,accountant,messManager'],
      ['inviteCode', 'Invitation code', 'text'],
      ['status', 'Status', 'select:active,pending,disabled']
    ]
  }
};

const permissions = {
  admin: Object.keys(tables),
  warden: [
    'students',
    'rooms',
    'attendance',
    'complaints',
    'announcements'
  ],
  accountant: ['fees', 'expenses'],
  messManager: ['mess', 'inventory', 'expenses'],
  student: ['complaints', 'announcements', 'mess'],
  parent: ['complaints', 'announcements', 'mess']
};