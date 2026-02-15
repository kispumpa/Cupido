let db,
    auth,
    currentUser = null,
    isAdmin = false;
let configData = {};

// Base minimal config (used to init Firebase so we can read Firestore config/app)
// These values are from your project (cupido-a4cb9) - modify if needed
const BASE_FIREBASE = {
    apiKey: "AIzaSyDhk87Q7giDXh6wKJq8D-VQGJRHSXKh1lk",
    authDomain: "cupido-a4cb9.firebaseapp.com",
    projectId: "cupido-a4cb9",
};

// Initialize Firebase (with base config) and then load real config from Firestore
async function initFirebase() {
    try {
        if (!firebase.apps.length) {
            firebase.initializeApp(BASE_FIREBASE);
        }
        db = firebase.firestore();
        auth = firebase.auth();

        // Load config from config/app
        const cfgSnap = await db.collection("config").doc("app").get();
        if (cfgSnap.exists) {
            configData = cfgSnap.data();
            applyAdventVisibility();
            console.log("Konfig betöltve:", configData);

            // If full firebase config is provided in configData, re-init app (optional)
            // Note: firebase.initializeApp can only be called once per page. If you want to use a different config,
            // you'd normally need to reload the page or use admin SDK on server side.
            // We'll assume BASE_FIREBASE is enough to access the project Firestore.
            if (configData.emailjs?.publicKey) {
                try {
                    emailjs.init(configData.emailjs.publicKey);
                } catch (e) {
                    console.warn("EmailJS init hiba", e);
                }
            }
        } else {
            console.warn("Nincs config/app dokumentum a Firestore-ban.");
        }

        // Auth listener
        auth.onAuthStateChanged((user) => {
            if (user) {
                currentUser = user;
                checkIfAdmin(user.email).then(() => {
                    showMainApp();
                    // Load lists once logged in
                    loadKuponok("elerheto");
                    loadKuponok("aktivalt");
                });
            } else {
                currentUser = null;
                isAdmin = false;
                showLoginScreen();
            }
        });
    } catch (e) {
        console.error("initFirebase hiba", e);
        alert("Hiba az inicializáláskor: " + e.message);
    }
}

function applyAdventVisibility() {
    const adventTab = document.querySelector(".advent-nav");
    if (!adventTab) return;

    if (configData.enableAdvent === true) {
        adventTab.style.display = "block";
    } else {
        adventTab.style.display = "none";
    }
}


// Show/hide screens
function showLoginScreen() {
    document.getElementById("login-screen").style.display = "block";
    document.getElementById("main-app").style.display = "none";
}
function showMainApp() {
    document.getElementById("login-screen").style.display = "none";
    document.getElementById("main-app").style.display = "block";
    document.getElementById("user-info").textContent = currentUser.email;
}

// Login handler
document.getElementById("login-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = document.getElementById("login-email").value;
    const password = document.getElementById("login-password").value;
    try {
        await auth.signInWithEmailAndPassword(email, password);
    } catch (err) {
        alert("Bejelentkezési hiba: " + err.message);
    }
});

async function logout() {
    if (auth) await auth.signOut();
}

async function checkIfAdmin(email) {
    // Determine admin by configData.adminEmail
    isAdmin = false;
    if (configData && configData.adminEmail) {
        isAdmin = email === configData.adminEmail;
    }
    document
        .querySelectorAll(".admin-only")
        .forEach((el) => (el.style.display = isAdmin ? "block" : "none"));
    return isAdmin;
}

async function loadAdvent() {
    const container = document.getElementById("advent");
    container.innerHTML =
        '<div class="text-center"><i class="fas fa-spinner fa-spin fa-2x"></i><div>Betöltés...</div></div>';

    try {
        const snap = await db.collection("adventi_kartyak").orderBy("nap").get();
        const today = new Date().getDate();
        
        // Összegyűjtjük a kártyákat
        let cards = "";
        let hasCards = false;

        snap.forEach((doc) => {
            const d = doc.data();
            // Csak az aktív kártyák jelennek meg
            if (d.aktiv !== true) return;
            
            hasCards = true;
            const isToday = d.nap === today;
            const disabledClass = isToday ? "" : "opacity-50";
            const btnDisabled = isToday ? "" : "disabled";

            cards += `
                <div class="col-md-3">
                    <div class="card kupon-card ${disabledClass}">
                        <div class="card-header text-center">${d.cim}</div>
                        <div class="card-body text-center">
                            <div class="icon-circle"><i class="fas ${d.icon}"></i></div>
                            <button class="btn btn-primary w-100" ${btnDisabled} onclick="showAdventMessage('${doc.id}', '${d.tartalom}')">Kinyitás</button>
                            <div id="msg-${doc.id}" class="mt-2" style="display:none;"></div>
                        </div>
                    </div>
                </div>`;
        });
        
        // Egyszerűen megjelenítjük a kártyákat, keret és lenyitó nélkül
        if (hasCards) {
            container.innerHTML = cards;
        } else {
            container.innerHTML = '<div class="empty-state text-center"><i class="fas fa-inbox fa-2x"></i><div class="mt-2">Nincs aktív adventi kártya</div></div>';
        }
    } catch (e) {
        container.innerHTML = `<div class="alert alert-danger">Hiba: ${e.message}</div>`;
    }
}

function toggleAdventMainCollapse() {
    const collapseElement = document.getElementById('advent-main-collapse');
    const icon = document.getElementById('advent-main-collapse-icon');
    
    if (collapseElement.style.display === 'none') {
        collapseElement.style.display = 'block';
        icon.classList.remove('fa-chevron-down');
        icon.classList.add('fa-chevron-up');
    } else {
        collapseElement.style.display = 'none';
        icon.classList.remove('fa-chevron-up');
        icon.classList.add('fa-chevron-down');
    }
}

function showAdventMessage(id, content) {
    const msgBox = document.getElementById(`msg-${id}`);
    msgBox.style.display = "block";
    msgBox.innerHTML = content;
}

async function addAdventCard(e) {
    e.preventDefault();
    if (!isAdmin) return alert("Nincs jogosultságod!");

    const cim = document.getElementById("advent-cim").value;
    const tart = document.getElementById("advent-tartalom").value;
    const icon = document.getElementById("advent-icon").value;
    const nap = parseInt(document.getElementById("advent-nap").value);

    await db
        .collection("adventi_kartyak")
        .add({ cim, tartalom: tart, icon, nap, aktiv: false });  // Alapértelmezetten inaktív
    alert("Adventi kártya hozzáadva!");
    document.getElementById("advent-form").reset();
    loadAdventAdmin();
}

async function loadAdventAdmin() {
    const cont = document.getElementById("admin-advent-lista");
    const snap = await db.collection("adventi_kartyak").orderBy("nap").get();

    cont.innerHTML = "";
    snap.forEach((doc) => {
        const d = doc.data();
        const aktiv = d.aktiv === true;
        const aktivBadge = aktiv 
            ? '<span class="badge bg-success ms-2">Aktív</span>' 
            : '<span class="badge bg-secondary ms-2">Inaktív</span>';
        const toggleBtn = aktiv
            ? `<button class="btn btn-warning btn-sm me-2" onclick="toggleAdventAktiv('${doc.id}', false)"><i class="fas fa-eye-slash"></i></button>`
            : `<button class="btn btn-success btn-sm me-2" onclick="toggleAdventAktiv('${doc.id}', true)"><i class="fas fa-eye"></i></button>`;
            
        cont.innerHTML += `
<div class="card mb-2 p-2">
    <div class="d-flex justify-content-between align-items-center">
        <div>
            <strong>${d.nap}. nap</strong> – ${d.tartalom} ${aktivBadge}
        </div>
        <div>
            ${toggleBtn}
            <button class="btn btn-danger btn-sm" onclick="deleteAdvent('${doc.id}')"><i class="fas fa-trash"></i></button>
        </div>
    </div>
</div>`;
    });
}

async function toggleAdventAktiv(id, newValue) {
    if (!isAdmin) return alert("Nincs jogosultságod!");
    try {
        await db.collection("adventi_kartyak").doc(id).update({ aktiv: newValue });
        loadAdventAdmin();
        alert(newValue ? "Adventi kártya aktiválva!" : "Adventi kártya inaktiválva!");
    } catch (e) {
        alert("Hiba: " + e.message);
    }
}

async function deleteAdvent(id) {
    if (!confirm("Biztosan törlöd?")) return;
    await db.collection("adventi_kartyak").doc(id).delete();
    loadAdventAdmin();
}

// Load kuponok (list for 'elerheto' or 'aktivalt')
async function loadKuponok(tipus) {
    const container = document.getElementById(`${tipus}-kuponok`);
    container.innerHTML =
        '<div class="text-center"><i class="fas fa-spinner fa-spin fa-2x"></i><div>Betöltés...</div></div>';

    if (!db) {
        container.innerHTML =
            '<div class="alert alert-warning">Firebase nincs inicializálva.</div>';
        return;
    }

    try {
        const snapshot = await db.collection("kuponok").get();
        const kuponok = [];
        snapshot.forEach((doc) => kuponok.push({ id: doc.id, ...doc.data() }));

        // Monthly reactivation check (optional)
        const now = new Date();
        for (const k of kuponok) {
            if (
                k.tipus === "havi" &&
                k.aktivalt &&
                k.aktivaltDatum &&
                k.aktivaltDatum.toDate
            ) {
                const d = k.aktivaltDatum.toDate();
                if (
                    d.getMonth() !== now.getMonth() ||
                    d.getFullYear() !== now.getFullYear()
                ) {
                    // reset in DB
                    await db
                        .collection("kuponok")
                        .doc(k.id)
                        .update({ aktivalt: false, aktivaltDatum: null });
                    k.aktivalt = false;
                    k.aktivaltDatum = null;
                }
            }
        }

        const filtered = kuponok.filter((k) => {
            if (tipus === "elerheto") {
                return !k.aktivalt || (k.tipus === "havi" && !k.aktivalt);
            } else {
                return k.aktivalt;
            }
        });

        // Töröljük a tartalmat az építkezés előtt
        container.innerHTML = "";

        // Ha aktivált kuponok oldalon vagyunk, adjuk hozzá az inaktív adventi kártyákat
        if (tipus === "aktivalt") {
            const adventSnap = await db.collection("adventi_kartyak").orderBy("nap").get();
            const inaktivAdvent = [];
            adventSnap.forEach((doc) => {
                const d = doc.data();
                if (d.aktiv !== true) {
                    inaktivAdvent.push({ ...d, id: doc.id });
                }
            });

            if (inaktivAdvent.length > 0) {
                // 1. Lépés: Generáljuk le a belső kártyák HTML-jét egy változóba
                let adventCardsHtml = "";
                inaktivAdvent.forEach((d) => {
                    // Ugyanaz a stílus, mint az advent oldalon (kupon-card), de gomb nélkül
                    // és fixen 'opacity-50' nélkül, hiszen itt már láthatóak/kinyitottak
                    adventCardsHtml += `
                        <div class="col-md-3">
                            <div class="card kupon-card">
                                <div class="card-header text-center">${d.cim}</div>
                                <div class="card-body text-center">
                                    <div class="icon-circle"><i class="fas ${d.icon}"></i></div>
                                    <div class="mt-2" style="font-weight: bold; color: #c2185b; background: #ffe9f2; border: 1px solid #ffb3ca; padding: 10px; border-radius: 8px;">
                                        ${d.tartalom}
                                    </div>
                                </div>
                            </div>
                        </div>
                    `;
                });

                // 2. Lépés: Egyetlen stringként fűzzük hozzá a keretet, benne a kártyákkal
                container.innerHTML += `
                    <div class="col-12 mb-4">
                        <div class="card kupon-card">
                            <div class="card-header" style="cursor: pointer; background: linear-gradient(135deg, #66bb6a 0%, #2e7d32 100%); color: white;" onclick="toggleAdventCollapse()">
                                <i class="fas fa-gifts"></i> 2025 advent
                                <i id="advent-collapse-icon" class="fas fa-chevron-down float-end"></i>
                            </div>
                            <div class="card-body" id="advent-collapse" style="display: none;">
                                <div class="row g-3">
                                    ${adventCardsHtml}
                                </div>
                            </div>
                        </div>
                    </div>
                `;
            }
        }

        if (filtered.length === 0 && (tipus === "elerheto" || container.innerHTML === "")) {
            container.innerHTML += `<div class="empty-state text-center"><i class="fas fa-inbox fa-2x"></i><div class="mt-2">Nincs ${tipus === "elerheto" ? "elérhető" : "aktivált"
                } kupon</div></div>`;
        } else {
            filtered.forEach((k) => (container.innerHTML += createKuponCard(k, tipus)));
        }
    } catch (e) {
        console.error("loadKuponok hiba", e);
        container.innerHTML =
            '<div class="alert alert-danger">Hiba a kuponok betöltésekor: ' +
            e.message +
            "</div>";
    }
}

function toggleAdventCollapse() {
    const collapseElement = document.getElementById('advent-collapse');
    const icon = document.getElementById('advent-collapse-icon');
    
    if (collapseElement.style.display === 'none') {
        collapseElement.style.display = 'block';
        icon.classList.remove('fa-chevron-down');
        icon.classList.add('fa-chevron-up');
    } else {
        collapseElement.style.display = 'none';
        icon.classList.remove('fa-chevron-up');
        icon.classList.add('fa-chevron-down');
    }
}

function createKuponCard(kupon, tipus) {
    const badge =
        kupon.tipus === "vip"
            ? '<span class="vip-badge">VIP</span>'
            : '<span class="monthly-badge">HAVI</span>';
    let extra = "";
    if (
        tipus === "aktivalt" &&
        kupon.aktivaltDatum &&
        kupon.aktivaltDatum.toDate
    ) {
        extra = `<p class="text-center"><small><i class="fas fa-calendar-check"></i> Aktiválva: ${kupon.aktivaltDatum
            .toDate()
            .toLocaleDateString("hu-HU")}</small></p>`;
    }

    const button =
        tipus === "elerheto"
            ? `<button class="btn btn-kupon btn-primary w-100" onclick="igenyelKupon('${kupon.id}')"><i class="fas fa-paper-plane"></i> Igénylés</button>`
            : "";

    return `
                <div class="col-md-6 col-lg-4">
                    <div class="card kupon-card">
                        <div class="card-header text-center">${kupon.nev
        } ${badge}</div>
                        <div class="card-body text-center">
                            <div class="icon-circle"><i class="fas ${kupon.icon
        }"></i></div>
                            <p>${kupon.leiras || ""}</p>
                            ${extra}
                            ${button}
                        </div>
                    </div>
                </div>
            `;
}

// Igényel kupon -> küld email adminnak activation linkkel
async function igenyelKupon(kuponId) {
    if (!db) {
        alert("Firebase nincs inicializálva.");
        return;
    }
    // Ensure emailjs initialized (from configData)
    if (!configData.emailjs || !configData.emailjs.publicKey) {
        alert("EmailJS nincs konfigurálva.");
        return;
    }
    try {
        const doc = await db.collection("kuponok").doc(kuponId).get();
        if (!doc.exists) {
            alert("Kupon nem található.");
            return;
        }
        const k = doc.data();
        const activationUrl = `${window.location.origin}${window.location.pathname}?activate=${kuponId}`;
        // Send email using EmailJS config stored in Firestore
        const params = {
            to_email: "matulamarton1@gmail.com" || "",
            kupon_nev: k.nev || "",
            kupon_leiras: k.leiras || "",
            activation_url: activationUrl,
        };
        await emailjs.send(
            configData.emailjs.service,
            configData.emailjs.template,
            params
        );
        alert("Igénylés elküldve az admin részére!");
    } catch (e) {
        console.error("igenyelKupon hiba", e);
        alert("Hiba az igénylés küldésekor: " + e.message);
    }
}

// URL alapján aktiválás (admin csak)
async function checkActivation() {
    const urlParams = new URLSearchParams(window.location.search);
    const activateId = urlParams.get("activate");
    if (!activateId) return;
    // only when user is admin and db defined
    if (!currentUser) return;
    if (!isAdmin) {
        alert("Csak admin aktiválhat!");
        window.history.replaceState({}, document.title, window.location.pathname);
        return;
    }
    try {
        await db.collection("kuponok").doc(activateId).update({
            aktivalt: true,
            aktivaltDatum: firebase.firestore.FieldValue.serverTimestamp(),
        });
        alert("Kupon aktiválva!");
        window.history.replaceState({}, document.title, window.location.pathname);
        loadKuponok("aktivalt");
        loadKuponok("elerheto");
    } catch (e) {
        console.error("Aktiválás hiba", e);
        alert("Hiba az aktiválás során: " + e.message);
    }
}

// Admin: hozzáadás
document.getElementById("kupon-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!db || !isAdmin) {
        alert("Nincs jogosultságod!");
        return;
    }
    try {
        await db.collection("kuponok").add({
            nev: document.getElementById("kupon-nev").value,
            leiras: document.getElementById("kupon-leiras").value,
            icon: document.getElementById("kupon-icon").value || "fa-gift",
            tipus: document.getElementById("kupon-tipus").value,
            aktivalt: false,
            letrehozva: firebase.firestore.FieldValue.serverTimestamp(),
        });
        alert("Kupon hozzáadva!");
        document.getElementById("kupon-form").reset();
        loadAdminKuponok();
        loadKuponok("elerheto");
    } catch (e) {
        alert("Hiba: " + e.message);
    }
});

async function loadAdminKuponok() {
    const container = document.getElementById("admin-kuponok-lista");
    container.innerHTML =
        '<div class="text-center"><i class="fas fa-spinner fa-spin"></i> Betöltés...</div>';
    if (!db) {
        container.innerHTML =
            '<div class="alert alert-warning">Firestore nincs inicializálva.</div>';
        return;
    }
    try {
        const snapshot = await db
            .collection("kuponok")
            .orderBy("letrehozva", "desc")
            .get();
        container.innerHTML = "";
        snapshot.forEach((doc) => {
            const d = doc.data();
            container.innerHTML += `
                        <div class="card mb-2">
                            <div class="card-body d-flex justify-content-between align-items-center">
                                <div>
                                    <strong>${d.nev}</strong>
                                    <span class="badge ms-2 ${d.tipus === "vip"
                    ? "bg-warning text-dark"
                    : "bg-success"
                }">${d.tipus}</span>
                                    <span class="badge ms-2 ${d.aktivalt ? "bg-danger" : "bg-secondary"
                }">${d.aktivalt ? "Aktivált" : "Elérhető"
                }</span>
                                </div>
                                <div>
                                    <button class="btn btn-danger btn-sm" onclick="deleteKupon('${doc.id
                }')"><i class="fas fa-trash"></i></button>
                                </div>
                            </div>
                        </div>
                    `;
        });
    } catch (e) {
        container.innerHTML =
            '<div class="alert alert-danger">Hiba: ' + e.message + "</div>";
    }
}

async function deleteKupon(id) {
    if (!confirm("Biztosan törlöd?")) return;
    try {
        await db.collection("kuponok").doc(id).delete();
        alert("Törölve!");
        loadAdminKuponok();
        loadKuponok("elerheto");
    } catch (e) {
        alert("Hiba: " + e.message);
    }
}

// Admin config load/save
async function loadAdminConfig() {
    try {
        const doc = await db.collection("config").doc("app").get();
        if (doc.exists) {
            const d = doc.data();
            document.getElementById("firebase-config").value = JSON.stringify(
                d.firebase || {},
                null,
                2
            );
            document.getElementById("emailjs-service").value =
                d.emailjs?.service || "";
            document.getElementById("emailjs-template").value =
                d.emailjs?.template || "";
            document.getElementById("emailjs-public").value =
                d.emailjs?.publicKey || "";
            
            // --- MÓDOSÍTÁS ITT ---
            // Ha true, akkor "true" string, ha false/undefined, akkor "false" string
            const isAdventEnabled = d.enableAdvent === true;
            document.getElementById("advent-switch").value = isAdventEnabled ? "true" : "false";
            // ---------------------

        } else {
            // Üres alapállapotok
            document.getElementById("firebase-config").value = "";
            document.getElementById("emailjs-service").value = "";
            document.getElementById("emailjs-template").value = "";
            document.getElementById("emailjs-public").value = "";
            document.getElementById("advent-switch").value = "false";
        }
        loadAdminKuponok();
        loadAdventAdmin();
    } catch (e) {
        alert("Hiba a config betöltésénél: " + e.message);
    }
}

async function saveFirebaseConfig() {
    try {
        const txt = document.getElementById("firebase-config").value.trim();
        const obj = txt ? JSON.parse(txt) : {};
        await db
            .collection("config")
            .doc("app")
            .set({ firebase: obj }, { merge: true });
        alert("Firebase konfiguráció elmentve Firestore-ba.");
    } catch (e) {
        alert("Hiba: " + e.message);
    }
}

async function saveEmailJSConfig() {
    try {
        const service = document.getElementById("emailjs-service").value.trim();
        const template = document.getElementById("emailjs-template").value.trim();
        const pub = document.getElementById("emailjs-public").value.trim();
        await db
            .collection("config")
            .doc("app")
            .set({ emailjs: { service, template, publicKey: pub } }, { merge: true });
        // update local configData and init emailjs
        const doc = await db.collection("config").doc("app").get();
        configData = doc.data() || configData;
        if (configData.emailjs?.publicKey)
            try {
                emailjs.init(configData.emailjs.publicKey);
            } catch (e) { }
        alert("EmailJS konfiguráció elmentve Firestore-ba.");
    } catch (e) {
        alert("Hiba: " + e.message);
    }
}

async function saveAdvent() {
    try {
        // A select értéke stringként jön ("true" vagy "false")
        const selectValue = document.getElementById("advent-switch").value;
        
        // Átalakítjuk valódi boolean-ra
        const isEnabled = (selectValue === "true");

        await db
            .collection("config")
            .doc("app")
            .set({ enableAdvent: isEnabled }, { merge: true });

        // Frissítjük a helyi config változót is, hogy ne kelljen újratölteni az oldalt
        configData.enableAdvent = isEnabled;
        applyAdventVisibility(); // Azonnal elrejti/megjeleníti a menüt
        
        alert(`Advent sikeresen ${isEnabled ? "BEKAPCSOLVA" : "KIKAPCSOLVA"}!`);
    } catch (e) {
        alert("Hiba: " + e.message);
    }
}

// On DOM ready
window.addEventListener("DOMContentLoaded", async () => {
    await initFirebase();
    // After init, check if URL contains activation id and if user already logged in -> activation handled in onAuthStateChanged
    // If user is already logged in and admin, check activation now:
    setTimeout(() => {
        checkActivation();
    }, 1000);
});

function showPage(page) {
    // Elrejt minden oldalt
    document.getElementById("elerheto-page").style.display = "none";
    document.getElementById("aktivalt-page").style.display = "none";
    document.getElementById("info-page").style.display = "none";
    document.getElementById("admin-page").style.display = "none";
    document.getElementById("advent-page").style.display = "none";

    if (window.snowAnimation) {
        window.snowAnimation.stop();
    }

    // Összes nav-linkről leveszi az 'active' osztályt
    document
        .querySelectorAll(".nav-link")
        .forEach((link) => link.classList.remove("active"));


    if (page === "advent" && configData.enableAdvent !== true) {
        alert("Az adventi naptár jelenleg kikapcsolva van.");
        return;
    }
    // Megjeleníti a kiválasztott oldalt
    if (page === "elerheto") {
        document.getElementById("elerheto-page").style.display = "block";
        loadKuponok("elerheto");
        document
            .querySelector('.nav-link[onclick*="elerheto"]')
            .classList.add("active");
    } else if (page == "advent" ) {
        document.getElementById("advent-page").style.display = "block";
        loadAdvent();
        if (window.snowAnimation) {
            window.snowAnimation.start();
        }
    } else if (page === "aktivalt") {
        document.getElementById("aktivalt-page").style.display = "block";
        loadKuponok("aktivalt");
        document
            .querySelector('.nav-link[onclick*="aktivalt"]')
            .classList.add("active");
    } else if (page === "info") {
        document.getElementById("info-page").style.display = "block";

        document
            .querySelector('.nav-link[onclick*="info"]')
            .classList.add("active");
    } else if (page === "admin") {
        if (!isAdmin) {
            alert("Nincs jogosultságod az Admin oldalhoz!");
            return;
        }
        document.getElementById("admin-page").style.display = "block";
        document
            .querySelector('.nav-link[onclick*="admin"]')
            .classList.add("active");
        loadAdminConfig();
    }

    // Ha mobil nézetben van lenyitva a navbar, zárja be kattintás után
    const navbarCollapse = document.querySelector(".navbar-collapse");
    if (navbarCollapse.classList.contains("show")) {
        new bootstrap.Collapse(navbarCollapse).toggle();
    }
}

// Admin panelek nyitása/csukása
function toggleAdminSection(id) {
    const section = document.getElementById(id);
    const icon = document.getElementById(id + '-icon');
    
    if (section.style.display === 'none') {
        section.style.display = 'block';
        icon.classList.remove('fa-chevron-down');
        icon.classList.add('fa-chevron-up');
    } else {
        section.style.display = 'none';
        icon.classList.remove('fa-chevron-up');
        icon.classList.add('fa-chevron-down');
    }
}