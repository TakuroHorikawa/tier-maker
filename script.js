/**
 * 定数と状態管理
 */
const K_FACTOR = 32; // Eloレーティングの変化係数
let items = []; // { id, data, score }
let db;

const screens = {
    setup: document.getElementById('setup-screen'),
    battle: document.getElementById('battle-screen'),
    result: document.getElementById('result-screen')
};

/**
 * IndexedDB の初期化 (画像保存用)
 */
const initDB = () => {
    return new Promise((resolve) => {
        const request = indexedDB.open('TierMakerDB', 1);
        request.onupgradeneeded = (e) => {
            db = e.target.result;
            db.createObjectStore('images', { keyPath: 'id' });
        };
        request.onsuccess = (e) => {
            db = e.target.result;
            resolve();
        };
    });
};

/**
 * 画像の保存と読み込み
 */
async function saveItemsToDB(itemsToSave) {
    const tx = db.transaction('images', 'readwrite');
    const store = tx.objectStore('images');
    for (const item of itemsToSave) {
        store.put(item);
    }
    localStorage.setItem('tier_items_meta', JSON.stringify(
        itemsToSave.map(item => ({ id: item.id, score: item.score }))
    ));
}

async function loadItemsFromDB() {
    return new Promise((resolve) => {
        const meta = JSON.parse(localStorage.getItem('tier_items_meta') || '[]');
        if (meta.length === 0) return resolve([]);

        const tx = db.transaction('images', 'readonly');
        const store = tx.objectStore('images');
        const getAll = store.getAll();
        getAll.onsuccess = () => resolve(getAll.result);
    });
}

/**
 * UI制御
 */
const fileInput = document.getElementById('file-input');
const fileCount = document.getElementById('file-count');
const startBtn = document.getElementById('start-btn');
const resumeBtn = document.getElementById('resume-btn');

fileInput.addEventListener('change', async (e) => {
    const files = Array.from(e.target.files).slice(0, 100);
    fileCount.innerText = `${files.length} 枚選択中`;
    
    if (files.length >= 2) {
        startBtn.disabled = false;
        items = await Promise.all(files.map((file, index) => {
            return new Promise((resolve) => {
                const reader = new FileReader();
                reader.onload = (ev) => resolve({
                    id: Date.now() + index,
                    data: ev.target.result,
                    score: 1500
                });
                reader.readAsDataURL(file);
            });
        }));
    }
});

startBtn.addEventListener('click', async () => {
    await saveItemsToDB(items);
    showScreen('battle');
    nextMatch();
});

resumeBtn.addEventListener('click', async () => {
    items = await loadItemsFromDB();
    showScreen('battle');
    nextMatch();
});

function showScreen(screenName) {
    Object.values(screens).forEach(s => s.classList.add('hidden'));
    screens[screenName].classList.remove('hidden');
}

/**
 * 比較ロジック (Elo Rating)
 */
let currentLeft, currentRight;

function nextMatch() {
    if (items.length < 2) return;
    
    // ランダムに2つ選ぶ
    let idx1 = Math.floor(Math.random() * items.length);
    let idx2 = Math.floor(Math.random() * items.length);
    while (idx1 === idx2) idx2 = Math.floor(Math.random() * items.length);

    currentLeft = items[idx1];
    currentRight = items[idx2];

    document.getElementById('left-img').src = currentLeft.data;
    document.getElementById('right-img').src = currentRight.data;
}

function updateRating(winner, loser) {
    const expectedWin = 1 / (1 + Math.pow(10, (loser.score - winner.score) / 400));
    
    winner.score += K_FACTOR * (1 - expectedWin);
    loser.score += K_FACTOR * (0 - (1 - expectedWin));

    saveItemsToDB(items);
    nextMatch();
}

document.getElementById('left-card').addEventListener('click', () => updateRating(currentLeft, currentRight));
document.getElementById('right-card').addEventListener('click', () => updateRating(currentRight, currentLeft));

/**
 * ティア表生成
 */
document.getElementById('show-results-btn').addEventListener('click', () => {
    showScreen('result');
    const sorted = [...items].sort((a, b) => b.score - a.score);
    const total = sorted.length;

    const tiers = [
        { label: 'S', class: 's-tier', limit: Math.ceil(total * 0.1) },
        { label: 'A', class: 'a-tier', limit: Math.ceil(total * 0.3) }, // 10% + 20%
        { label: 'B', class: 'b-tier', limit: Math.ceil(total * 0.7) }, // 30% + 40%
        { label: 'C', class: 'c-tier', limit: Math.ceil(total * 0.9) },
        { label: 'D', class: 'd-tier', limit: total }
    ];

    const tierListContainer = document.getElementById('tier-list');
    tierListContainer.innerHTML = '';

    let currentIndex = 0;
    tiers.forEach(tier => {
        const row = document.createElement('div');
        row.className = `tier-row ${tier.class}`;
        row.innerHTML = `<div class="tier-label">${tier.label}</div><div class="tier-items"></div>`;
        const itemsContainer = row.querySelector('.tier-items');

        while (currentIndex < tier.limit && currentIndex < total) {
            const img = document.createElement('img');
            img.src = sorted[currentIndex].data;
            img.className = 'tier-item-img';
            itemsContainer.appendChild(img);
            currentIndex++;
        }
        if (itemsContainer.children.length > 0) {
            tierListContainer.appendChild(row);
        }
    });
});

// リセット機能
document.getElementById('reset-btn').addEventListener('click', () => {
    if (confirm('全てのデータを削除して最初からやり直しますか？')) {
        localStorage.clear();
        const tx = db.transaction('images', 'readwrite');
        tx.objectStore('images').clear();
        location.reload();
    }
});

// 起動時
window.onload = async () => {
    await initDB();
    const saved = await loadItemsFromDB();
    if (saved.length > 0) {
        resumeBtn.style.display = 'inline-block';
        fileCount.innerText = `${saved.length} 枚の保存済みデータがあります`;
    }
};
