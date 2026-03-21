/**
 * ========================================================================================
 * PROJECT         : NITESH TITAN - ULTRA QUANTUM EDITION
 * MODULE          : ENGINE.JS (CORE JAVASCRIPT LOGIC) - PART 1
 * AUTHOR          : NITESH WTR LAB & GEMINI AI
 * DESCRIPTION     : IndexedDB Local Storage, Firebase Sync, UI Controllers, API Engine.
 * ========================================================================================
 */

// ==========================================================================
// [01] FIREBASE ENTERPRISE INTEGRATION (MODULAR SDK v10+)
// ==========================================================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
    getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, 
    onAuthStateChanged, signOut 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { 
    getFirestore, doc, setDoc, getDoc, updateDoc, collection, query, 
    where, onSnapshot, getDocs, addDoc, serverTimestamp, deleteDoc, orderBy, limit
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// WTR LAB Master Configuration
const firebaseConfig = {
    apiKey: "AIzaSyBldLyB9d18ZGStroUC0-yjuUrp31DFQ28",
    authDomain: "online-tic-tac-toe-d919f.firebaseapp.com",
    projectId: "online-tic-tac-toe-d919f",
    storageBucket: "online-tic-tac-toe-d919f.firebasestorage.app",
    messagingSenderId: "644365665798",
    appId: "1:644365665798:web:f90b64bdc3aa6912032587"
};

// Initialize Quantum Services
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// ==========================================================================
// [02] GLOBAL STATE MANAGEMENT (SINGLE SOURCE OF TRUTH)
// ==========================================================================
const State = {
    user: null,          // Firebase Auth User object
    profile: null,       // Firestore User Profile data
    mode: 'online',      // 'online' or 'offline' (Simulation)
    gameId: null,        // Active Combat ID
    board: Array(9).fill(''), // Virtual Grid Memory
    mySym: 'X',          // Agent's symbol
    turn: 'X',           // Current turn tracker
    active: false,       // Is combat currently live?
    unsubGame: null,     // Firebase Realtime Listener (Game)
    unsubChat: null,     // Firebase Realtime Listener (Comms)
    unsubInvites: null   // Firebase Realtime Listener (Matchmaking)
};

// ==========================================================================
// [03] DOM ELEMENT CACHING (PREVENTS LAG FROM CONSTANT QUERYING)
// ==========================================================================
const DOM = {
    // Screens
    screens: document.querySelectorAll('.ui-screen'),
    screenBoot: document.getElementById('module-boot'),
    screenAuth: document.getElementById('module-auth'),
    screenLobby: document.getElementById('module-lobby'),
    screenArena: document.getElementById('module-arena'),

    // Modals
    modalResult: document.getElementById('modal-result'),
    modalChallenge: document.getElementById('modal-challenge'),
    modalSettings: document.getElementById('modal-settings'),
    modalHistory: document.getElementById('modal-history'),

    // Arena Grid & Comms
    combatGrid: document.getElementById('ui-combat-grid'),
    turnText: document.getElementById('ui-turn-text'),
    chatStream: document.getElementById('ui-chat-stream'),
    chatInput: document.getElementById('inp-chat-msg'),
    
    // HUD
    p1Name: document.getElementById('arena-p1-name'),
    p2Name: document.getElementById('arena-p2-name'),
    p1Score: document.getElementById('arena-p1-score'),
    p2Score: document.getElementById('arena-p2-score'),
    
    // Toasts
    toastContainer: document.getElementById('sys-toast-container')
};

// ==========================================================================
// [04] WHATSAPP-STYLE LOCAL DATABASE (INDEXED-DB ARCHITECTURE)
// Saves bandwidth, prevents server overload, loads history instantly.
// ==========================================================================
class QuantumLocalDB {
    constructor() {
        this.dbName = "TitanQuantumStorage";
        this.dbVersion = 1;
        this.db = null;
        this.init();
    }

    init() {
        const request = indexedDB.open(this.dbName, this.dbVersion);
        
        request.onupgradeneeded = (event) => {
            this.db = event.target.result;
            // Create History Store
            if (!this.db.objectStoreNames.contains("match_history")) {
                const store = this.db.createObjectStore("match_history", { keyPath: "id", autoIncrement: true });
                store.createIndex("date", "timestamp", { unique: false });
            }
        };

        request.onsuccess = (event) => {
            this.db = event.target.result;
            console.log(">> LOCAL DB SECURED [OK]");
        };

        request.onerror = (event) => {
            console.error("Local DB Error:", event.target.errorCode);
        };
    }

    // Save complete match to phone
    async saveCombatRecord(result, enemyName, movesCount) {
        if (!this.db) return;
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction("match_history", "readwrite");
            const store = tx.objectStore("match_history");
            const record = {
                result: result, // 'WIN', 'LOSS', 'DRAW'
                enemy: enemyName,
                moves: movesCount,
                timestamp: Date.now(),
                dateStr: new Date().toLocaleString()
            };
            const req = store.add(record);
            req.onsuccess = () => resolve();
            req.onerror = () => reject();
        });
    }

    // Purge Data (Settings option)
    async clearAllData() {
        if (!this.db) return;
        const tx = this.db.transaction("match_history", "readwrite");
        tx.objectStore("match_history").clear();
        UI.showToast("LOCAL DB PURGED SECURELY");
    }
}
const localDB = new QuantumLocalDB();

// ==========================================================================
// [05] DYNAMIC BACKGROUND ENGINE (API CONTROLLER)
// ==========================================================================
class BackgroundEngine {
    constructor() {
        this.layer = document.getElementById('fx-dynamic-image');
        // Cyberpunk/Hacker keywords for Unsplash API
        this.themes = ['cyberpunk', 'neon', 'dark technology', 'matrix', 'space', 'abstract dark'];
        
        // Start engine
        this.refreshBackground();
        // Auto-change every 2 minutes (120000ms) to keep UI fresh
        setInterval(() => this.refreshBackground(), 120000);
    }

    refreshBackground() {
        if (!this.layer) return;
        const keyword = this.themes[Math.floor(Math.random() * this.themes.length)];
        const randomSeed = new Date().getTime(); // Prevents browser caching
        const imageUrl = `https://source.unsplash.com/featured/1080x1920/?${keyword}&sig=${randomSeed}`;
        
        // Preload image before changing to prevent black screen flashes
        const img = new Image();
        img.onload = () => {
            this.layer.style.backgroundImage = `url('${imageUrl}')`;
            this.layer.style.opacity = '1';
        };
        img.src = imageUrl;
    }
}
// Init Background Engine
new BackgroundEngine();

// ==========================================================================
// [06] UI & ANIMATION CONTROLLER
// ==========================================================================
const UI = {
    // Navigate between screens smoothly
    switchScreen: (targetScreenId) => {
        DOM.screens.forEach(screen => {
            screen.classList.remove('is-active');
            // Slight delay before hiding completely allows CSS fade-out to finish
            setTimeout(() => { screen.setAttribute('aria-hidden', 'true'); }, 400);
        });
        
        const target = document.getElementById(targetScreenId);
        if (target) {
            target.setAttribute('aria-hidden', 'false');
            // Slight delay before adding active class allows display block to register
            setTimeout(() => { target.classList.add('is-active'); }, 50);
        }
    },

    // Modern Toast Notification System
    showToast: (message, duration = 3000) => {
        const toast = document.createElement('div');
        toast.className = 'toast-item';
        toast.innerText = message;
        DOM.toastContainer.appendChild(toast);
        
        // Auto remove after duration
        setTimeout(() => {
            toast.style.animation = 'toast-slide-up 0.4s reverse forwards';
            setTimeout(() => toast.remove(), 400);
        }, duration);
    },

    // Modal Controllers
    openModal: (modalElement) => {
        if(modalElement) modalElement.showModal();
    },
    closeModal: (modalElement) => {
        if(modalElement) modalElement.close();
    }
};

// Expose UI to window for inline HTML onclick events if needed
window.UI = UI;

