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
// ==========================================================================
// [07] THE QUANTUM COMBAT ENGINE (ZERO-LATENCY LOGIC)
// ==========================================================================

// SVG Symbols for instant DOM Injection
const SYMBOL_X = `<svg class="hud-icon color-x" viewBox="0 0 100 100"><path class="draw-path-x" d="M 20 20 L 80 80 M 80 20 L 20 80" stroke="currentColor" stroke-width="12" stroke-linecap="round" fill="none"/></svg>`;
const SYMBOL_O = `<svg class="hud-icon color-o" viewBox="0 0 100 100"><circle class="draw-path-o" cx="50" cy="50" r="35" stroke="currentColor" stroke-width="12" fill="none" stroke-linecap="round"/></svg>`;

// Initialize Grid Interactivity (The 0ms Trick)
const initCombatGrid = () => {
    const cells = DOM.combatGrid.querySelectorAll('.grid-cell');
    cells.forEach((cell, idx) => {
        // CRITICAL: 'pointerdown' triggers before 'click' and 'touchstart'.
        // This is the secret to 0ms perceived latency.
        cell.addEventListener('pointerdown', (e) => {
            e.preventDefault(); 
            executeCombatMove(idx);
        });
    });
};

// Render current state to screen
const renderGrid = () => {
    const cells = DOM.combatGrid.querySelectorAll('.grid-cell');
    cells.forEach((cell, idx) => {
        const val = State.board[idx];
        if (val === 'X' && !cell.innerHTML.includes('path-x')) cell.innerHTML = SYMBOL_X;
        else if (val === 'O' && !cell.innerHTML.includes('path-o')) cell.innerHTML = SYMBOL_O;
        else if (!val) cell.innerHTML = '';
    });
};

// 8 Winning Combinations
const checkWinCondition = (boardState) => {
    const lines = [
        [0,1,2], [3,4,5], [6,7,8], // Horizontal
        [0,3,6], [1,4,7], [2,5,8], // Vertical
        [0,4,8], [2,4,6]           // Diagonal
    ];
    for (let p of lines) {
        if (boardState[p[0]] && boardState[p[0]] === boardState[p[1]] && boardState[p[0]] === boardState[p[2]]) {
            return 'win';
        }
    }
    return boardState.includes('') ? 'continue' : 'draw';
};

// Execute Move Logic (Optimistic UI)
const executeCombatMove = async (idx) => {
    // Prevent move if game is over, cell is filled, or it's not our turn
    if (!State.active || State.board[idx] !== '') return;
    if (State.mode === 'online' && State.turn !== State.mySym) {
        UI.showToast("WAIT FOR TARGET'S MOVE", 2000);
        return;
    }

    // 1. OPTIMISTIC UI: Update screen instantly locally (0ms Latency)
    State.board[idx] = State.mySym;
    renderGrid();
    
    // Play SFX/Haptic if enabled
    if (document.getElementById('toggle-haptic')?.checked && navigator.vibrate) navigator.vibrate(40);

    const result = checkWinCondition(State.board);
    const nextTurn = State.mySym === 'X' ? 'O' : 'X';

    if (State.mode === 'offline') {
        // Offline Simulation Logic
        if (result === 'win') processCombatResult(State.mySym);
        else if (result === 'draw') processCombatResult('draw');
        else {
            State.turn = nextTurn;
            updateTurnAnnouncer();
        }
    } else {
        // Online Sync: Compress array into string for minimal packet size ('X  O X   ')
        const boardStr = State.board.join('');
        const gRef = doc(db, 'games', State.gameId);
        
        try {
            if (result === 'win') {
                await updateDoc(gRef, { b: boardStr, s: 'win', w: State.mySym });
            } else if (result === 'draw') {
                await updateDoc(gRef, { b: boardStr, s: 'draw' });
            } else {
                await updateDoc(gRef, { b: boardStr, t: nextTurn });
            }
        } catch (error) {
            console.error("Quantum Sync Error:", error);
            UI.showToast("SYNC ERROR. RECONNECTING...");
        }
    }
};

const processCombatResult = (winner) => {
    State.active = false;
    
    // Save to Local IndexedDB (WhatsApp Style)
    if (State.mode === 'online') {
        const resultType = (winner === 'draw') ? 'DRAW' : (winner === State.mySym ? 'WIN' : 'LOSS');
        const enemyName = DOM.p2Name.innerText;
        const totalMoves = State.board.filter(cell => cell !== '').length;
        localDB.saveCombatRecord(resultType, enemyName, totalMoves);
    }

    setTimeout(() => {
        const title = document.getElementById('ui-result-title');
        const subtitle = document.getElementById('ui-result-subtitle');
        const resModal = document.getElementById('modal-result');

        document.getElementById('res-val-turns').innerText = State.board.filter(c => c !== '').length;

        if (winner === 'draw') {
            title.innerText = "DRAW";
            title.className = "result-mega-text font-marker";
            subtitle.innerText = "NO AGENT TERMINATED";
        } else {
            const isMe = (State.mode === 'online' && winner === State.mySym) || (State.mode === 'offline');
            title.innerText = isMe ? "VICTORY" : "DEFEAT";
            title.className = `result-mega-text font-marker ${isMe ? 'color-o' : 'color-x'}`;
            subtitle.innerText = isMe ? "TARGET ANNIHILATED" : "YOU WERE TERMINATED";
            
            if (isMe) {
                // Trigger Confetti
                canvasConfetti({ particleCount: 200, spread: 120, origin: { y: 0.6 } });
            }
        }
        
        resModal.showModal();
    }, 600);
};

const updateTurnAnnouncer = () => {
    if (!State.active) return;
    const isMyTurn = (State.turn === State.mySym);
    
    DOM.turnText.innerText = isMyTurn ? "YOUR TURN" : "TARGET MOVING...";
    DOM.turnText.className = `turn-status-text blink ${isMyTurn ? 'color-o' : 'text-muted'}`;
    
    // Dim inactive player card
    document.getElementById('hud-p1').classList.toggle('is-active-turn', isMyTurn);
    document.getElementById('hud-p2').classList.toggle('is-active-turn', !isMyTurn);
};

// ==========================================================================
// [08] CLOUD MULTIPLAYER LINK (FIREBASE REALTIME LISTENERS)
// ==========================================================================
const establishOnlineLink = (gameId, mySymbol, enemyData) => {
    State.gameId = gameId; 
    State.mySym = mySymbol; 
    State.mode = 'online'; 
    State.active = true;
    
    UI.switchScreen('module-arena');

    // Update HUD Profiles
    DOM.p1Name.innerText = State.profile.name;
    DOM.p2Name.innerText = enemyData ? enemyData.name : "ENEMY";

    // 1. GAME STATE LISTENER (Lightweight Document Sync)
    if (State.unsubGame) State.unsubGame();
    State.unsubGame = onSnapshot(doc(db, 'games', gameId), (snap) => {
        if (!snap.exists()) {
            UI.showToast("TARGET DISCONNECTED / MISSION SEVERED");
            abortMission();
            return;
        }
        
        const data = snap.data();
        
        // Decompress board string 'X O      ' back to Array
        State.board = data.b ? data.b.split('') : Array(9).fill('');
        State.turn = data.t || 'X';
        State.active = (data.s === 'playing');
        
        renderGrid();
        
        if (data.s === 'win') processCombatResult(data.w);
        else if (data.s === 'draw') processCombatResult('draw');
        else updateTurnAnnouncer();
    });

    // 2. COMMS (CHAT) LISTENER
    if (State.unsubChat) State.unsubChat();
    State.unsubChat = onSnapshot(
        query(collection(db, `games/${gameId}/chat`), orderBy('time', 'asc'), limit(50)), 
        (snap) => {
            DOM.chatStream.innerHTML = '';
            snap.forEach(docSnap => {
                const msg = docSnap.data();
                const isMe = msg.uid === State.user.uid;
                
                // HTML Injection via Template
                const tpl = document.getElementById('tpl-chat-msg').content.cloneNode(true);
                const row = tpl.querySelector('.chat-message-row');
                
                if (isMe) row.classList.add('self');
                row.querySelector('.chat-sender').innerText = msg.snd;
                row.querySelector('.chat-text').innerText = msg.txt;
                row.querySelector('.chat-time').innerText = msg.time ? new Date(msg.time.toDate()).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '...';
                
                DOM.chatStream.appendChild(row);
            });
            DOM.chatStream.scrollTop = DOM.chatStream.scrollHeight;
        }
    );
};

// ==========================================================================
// [09] AUTHENTICATION & BOOTSTRAP LOGIC
// ==========================================================================

// Terminal Boot Animation Sequence
const runTerminalBoot = () => {
    setTimeout(() => {
        document.getElementById('boot-log-1').innerHTML = '> SECURING LOCAL DB... <span class="t-success">[OK]</span>';
    }, 800);
    setTimeout(() => {
        document.getElementById('boot-log-2').innerHTML = '> ESTABLISHING SOCKET... <span class="t-success">[OK]</span>';
    }, 1500);
    setTimeout(() => {
        document.getElementById('boot-log-3').classList.remove('blink-cursor');
        document.getElementById('boot-log-3').innerHTML = '> SYSTEM READY. REDIRECTING...';
        document.getElementById('ui-boot-bar').style.width = '100%';
    }, 2200);
};
runTerminalBoot();

// Listen to Firebase Auth State
onAuthStateChanged(auth, async (user) => {
    setTimeout(async () => { // Allow boot animation to finish
        if (user) {
            State.user = user;
            
            // Fetch or create user profile
            const pSnap = await getDoc(doc(db, 'users', user.uid));
            if (pSnap.exists()) {
                State.profile = pSnap.data();
            } else {
                State.profile = { 
                    uid: user.uid, 
                    name: user.email ? user.email.split('@')[0].toUpperCase() : 'GUEST_' + Math.random().toString(36).substring(2,6).toUpperCase(), 
                    code: Math.random().toString(36).substring(2,6).toUpperCase() 
                };
                await setDoc(doc(db, 'users', user.uid), State.profile);
            }
            
            // Populate Lobby UI
            document.getElementById('ui-agent-name').innerText = State.profile.name;
            document.getElementById('ui-agent-code').innerText = State.profile.code;
            
            UI.switchScreen('module-lobby');
            listenForInvites();
            UI.showToast("ACCESS GRANTED");
        } else {
            UI.switchScreen('module-auth');
        }
    }, 2500);
});

// Login Handler
document.getElementById('form-auth').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('btn-auth-submit');
    const email = document.getElementById('inp-auth-email').value;
    const pass = document.getElementById('inp-auth-pass').value;
    
    btn.innerHTML = '<div class="small-spinner"></div> SYNCING...';
    
    try {
        await signInWithEmailAndPassword(auth, email, pass);
    } catch (err) {
        // If account doesn't exist, create it auto-magically
        if (err.code === 'auth/user-not-found' || err.code === 'auth/invalid-credential') {
            try {
                await createUserWithEmailAndPassword(auth, email, pass);
            } catch (err2) {
                UI.showToast(err2.message.toUpperCase());
                btn.innerHTML = 'INITIALIZE LINK';
            }
        } else {
            UI.showToast(err.message.toUpperCase());
            btn.innerHTML = 'INITIALIZE LINK';
        }
    }
});

// Guest Login Handler
document.getElementById('btn-auth-guest').onclick = async () => {
    UI.showToast("GUEST PROTOCOL NOT CONFIGURED YET");
};

// ==========================================================================
// [10] MATCHMAKING & INVITE PROTOCOL
// ==========================================================================

// Send Challenge
document.getElementById('btn-engage-target').onclick = async () => {
    const codeInp = document.getElementById('inp-target-id');
    const targetCode = codeInp.value.toUpperCase().trim();
    
    if (!targetCode) return UI.showToast("ENTER TARGET ID");
    if (targetCode === State.profile.code) return UI.showToast("CANNOT ENGAGE YOURSELF");
    
    const btn = document.getElementById('btn-engage-target');
    btn.innerHTML = '<div class="small-spinner"></div> SCANNING...';

    const q = query(collection(db, 'users'), where('code', '==', targetCode));
    const snap = await getDocs(q);
    
    if (snap.empty) {
        btn.innerHTML = '<svg class="btn-prefix-icon"><use href="#icon-swords"></use></svg> INITIATE QUANTUM SYNC';
        return UI.showToast("TARGET NOT FOUND ON NETWORK");
    }
    
    const targetData = snap.docs[0].data();
    
    // Create invite document
    const invRef = await addDoc(collection(db, 'invites'), {
        sUid: State.user.uid,
        sName: State.profile.name,
        rUid: targetData.uid,
        status: 'pending'
    });
    
    btn.innerHTML = 'CHALLENGE TRANSMITTED...';
    
    // Listen for response
    const unsubInv = onSnapshot(doc(db, 'invites', invRef.id), (docSnap) => {
        const d = docSnap.data();
        if (d?.status === 'accepted') {
            establishOnlineLink(d.gId, 'X', targetData);
            deleteDoc(doc(db, 'invites', invRef.id));
            unsubInv();
            btn.innerHTML = '<svg class="btn-prefix-icon"><use href="#icon-swords"></use></svg> INITIATE QUANTUM SYNC';
            codeInp.value = '';
        } else if (d?.status === 'rejected') {
            UI.showToast("TARGET EVADED CHALLENGE");
            deleteDoc(doc(db, 'invites', invRef.id));
            unsubInv();
            btn.innerHTML = '<svg class="btn-prefix-icon"><use href="#icon-swords"></use></svg> INITIATE QUANTUM SYNC';
        }
    });
};

// Listen for Incoming Challenges
const listenForInvites = () => {
    if (State.unsubInvites) State.unsubInvites();
    
    const q = query(collection(db, 'invites'), where('rUid', '==', State.user.uid), where('status', '==', 'pending'));
    
    State.unsubInvites = onSnapshot(q, (snapshot) => {
        snapshot.docChanges().forEach(change => {
            if (change.type === 'added') {
                const inv = change.doc.data();
                const invId = change.doc.id;
                
                document.getElementById('ui-challenger-id').innerText = inv.sName;
                UI.openModal(DOM.modalChallenge);
                
                // Accept Button
                document.getElementById('btn-accept-sync').onclick = async () => {
                    // Create new game instance (1ms compress format)
                    const gRef = await addDoc(collection(db, 'games'), {
                        b: '         ', // 9 empty spaces string
                        t: 'X',
                        s: 'playing',
                        p: [inv.sUid, State.user.uid]
                    });
                    
                    await updateDoc(doc(db, 'invites', invId), { status: 'accepted', gId: gRef.id });
                    UI.closeModal(DOM.modalChallenge);
                    establishOnlineLink(gRef.id, 'O', { name: inv.sName });
                };
                
                // Decline Button
                document.getElementById('btn-decline-sync').onclick = async () => {
                    await updateDoc(doc(db, 'invites', invId), { status: 'rejected' });
                    UI.closeModal(DOM.modalChallenge);
                };
            }
        });
    });
};

// ==========================================================================
// [11] EVENT BINDINGS (BUTTONS & CHAT)
// ==========================================================================

// Init Grid Call
initCombatGrid();

// Offline Simulation Trigger
document.getElementById('btn-play-offline').onclick = () => {
    State.mode = 'offline';
    State.active = true;
    State.board = Array(9).fill('');
    State.turn = 'X';
    State.mySym = 'X';
    
    DOM.p1Name.innerText = "PLAYER X";
    DOM.p2Name.innerText = "PLAYER O";
    
    UI.switchScreen('module-arena');
    renderGrid();
    updateTurnAnnouncer();
};

// Chat Send Handler
document.getElementById('btn-send-msg').onclick = async () => {
    const val = DOM.chatInput.value.trim();
    if (val && State.gameId) {
        await addDoc(collection(db, `games/${State.gameId}/chat`), {
            uid: State.user.uid,
            snd: State.profile.name,
            txt: val,
            time: serverTimestamp()
        });
        DOM.chatInput.value = '';
    }
};

// Allow 'Enter' key to send chat
DOM.chatInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') document.getElementById('btn-send-msg').click();
});

// Abort/Exit Mission logic
const abortMission = async () => {
    if (State.gameId) {
        try { await deleteDoc(doc(db, 'games', State.gameId)); } catch(e){}
    }
    if (State.unsubGame) State.unsubGame();
    if (State.unsubChat) State.unsubChat();
    
    State.active = false;
    State.gameId = null;
    UI.closeModal(DOM.modalResult);
    UI.switchScreen('module-lobby');
};

document.getElementById('btn-abort-match').onclick = () => {
    if (confirm("ABORT MISSION? This will sever the connection.")) abortMission();
};
document.getElementById('btn-result-lobby').onclick = abortMission;

// Rematch Button
document.getElementById('btn-result-rematch').onclick = async () => {
    UI.closeModal(DOM.modalResult);
    if (State.mode === 'online' && State.gameId) {
        await updateDoc(doc(db, 'games', State.gameId), { b: '         ', t: 'X', s: 'playing' });
    } else {
        document.getElementById('btn-play-offline').click();
    }
};

// Modal Close Triggers
document.getElementById('btn-close-settings').onclick = () => UI.closeModal(DOM.modalSettings);
document.getElementById('btn-close-history').onclick = () => UI.closeModal(DOM.modalHistory);
document.getElementById('btn-close-leaderboard').onclick = () => UI.closeModal(document.getElementById('modal-leaderboard'));

// Settings Triggers
document.getElementById('nav-btn-settings').onclick = () => UI.openModal(DOM.modalSettings);

// History Trigger (IndexedDB read logic)
document.getElementById('nav-btn-history').onclick = () => {
    UI.openModal(DOM.modalHistory);
    const listUI = document.getElementById('ui-history-list');
    
    if (!localDB.db) {
        listUI.innerHTML = '<div class="empty-state-message"><p>LOCAL DB NOT CONNECTED</p></div>';
        return;
    }

    const tx = localDB.db.transaction("match_history", "readonly");
    const store = tx.objectStore("match_history");
    const req = store.getAll();

    req.onsuccess = () => {
        const records = req.result;
        if (records.length === 0) {
            listUI.innerHTML = '<div class="empty-state-message"><p>NO COMBAT DATA FOUND</p></div>';
            return;
        }

        listUI.innerHTML = '';
        // Sort newest first
        records.sort((a,b) => b.timestamp - a.timestamp).forEach(rec => {
            const tpl = document.getElementById('tpl-history-card').content.cloneNode(true);
            const badge = tpl.querySelector('.hc-result-badge');
            
            badge.innerText = rec.result === 'WIN' ? 'W' : (rec.result === 'LOSS' ? 'L' : 'D');
            badge.className = `hc-result-badge font-marker ${rec.result.toLowerCase()}`;
            
            tpl.querySelector('.hc-enemy-name').innerText = rec.enemy;
            tpl.querySelector('.hc-date').innerText = rec.dateStr;
            tpl.querySelector('.hc-moves-val').innerText = rec.moves;
            
            listUI.appendChild(tpl);
        });
    };
};

// Logout
document.getElementById('btn-logout').onclick = async () => {
    await signOut(auth);
    UI.closeModal(DOM.modalSettings);
    window.location.reload();
};

// Copy ID Function
document.getElementById('btn-copy-id').onclick = () => {
    navigator.clipboard.writeText(State.profile.code);
    UI.showToast("FREQUENCY ID COPIED TO CLIPBOARD");
};

