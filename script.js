// --- 状態管理 ---
let items = [];
let db;
let currentMatchCount = 0;
let maxMatches = 0;
const K_FACTOR = 32;

// --- DOM要素 ---
const setupScreen = document.getElementById('setup-screen');
const battleScreen = document.getElementById('battle-screen');
const resultScreen = document.getElementById('result-screen');
const statusMsg = document.getElementById('status-message');
const settingsArea = document.getElementById('settings-area');
const maxMatchesInput = document.getElementById('max-matches-input');
const startBtn = document.getElementById('start-btn');
const matchCounter = document.getElementById('match-counter');
const progressBar = document.getElementById('progress-bar');

// --- 初期化 (IndexedDB) ---
const initDB = () => {
    return new Promise((resolve) => {
        const request = indexedDB.open('TierMakerProDB', 1);
        request.onupgradeneeded = (e) => {
            e.target.result.createObjectStore('images', { keyPath: 'id' });
        };
        request.onsuccess = (e) => {
            db = e.target.result;
            resolve();
        };
    });
};

// --- 画像読み込み時の処理 (新機能2) ---
function onImagesLoaded(count) {
    const recommended = count * 3;
    statusMsg.innerText = `読み込み完了：${count}枚（おすすめの比較回数は${recommended}回です）`;
    statusMsg.classList.remove('hidden');
    
    settingsArea.classList.remove('hidden');
    maxMatchesInput.value = recommended;
    startBtn.disabled = false;
}

// --- 手動アップロード ---
document.getElementById('file-input').addEventListener('change', async (e) => {
    const files = Array.from(e.target.files).slice(0, 100);
    if (files.length < 2) return;

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
    onImagesLoaded(items.length);
});

// --- 隠しコマンド機能 (新機能1) ---
const modal = document.getElementById('command-modal');
const cmdInput = document.getElementById('command-input');
document.getElementById('open-modal-btn').onclick = () => modal.classList.remove('hidden');
document.getElementById('modal-close').onclick = () => modal.classList.add('hidden');

document.getElementById('command-submit').onclick = () => {
    if (cmdInput.value === 'りんご') {
        alert('プリセット画像を読み込みました！');
        items = [];
        for (let i = 1928; i <= 2025; i++) {
            if ([1964, 1971, 2000, 2014, 2015, 2020].includes(i)) {
                continue;
            }
            items.push({ id: `preset-${i}`, data: `IMG_${i}.jpeg`, score: 1500 });
        }
        onImagesLoaded(items.length);
        modal.classList.add('hidden');

    } else if (cmdInput.value === 'ばなな') {
        alert('ばななの画像を読み込みました！');
        items = [];
        
        for (let i = 2061; i <= 2126; i++) {
            // 1. 存在しない6枚をスキップ
            if ([2075, 2086, 2087, 2088, 2090, 2098].includes(i)) {
                continue;
            }
            
            // 2. 拡張子が .webp になっている14枚をリスト化して判定
            const webpList = [2067, 2073, 2078, 2092, 2102, 2103, 2107, 2112, 2114, 2115, 2116, 2120, 2122, 2125];
            let ext = webpList.includes(i) ? 'webp' : 'jpeg';

            items.push({ id: `banana-${i}`, data: `IMG_${i}.${ext}`, score: 1500 });
        }
        
        onImagesLoaded(items.length);
        modal.classList.add('hidden');

    } else {
        alert('コードが正しくありません。');
    }
};

// --- 比較開始 ---
startBtn.onclick = async () => {
    maxMatches = parseInt(maxMatchesInput.value);
    currentMatchCount = 0;
    localStorage.setItem('tier_max_matches', maxMatches);
    await saveToDB();
    showBattle();
};

async function saveToDB() {
    const tx = db.transaction('images', 'readwrite');
    const store = tx.objectStore('images');
    for (const item of items) store.put(item);
    localStorage.setItem('tier_meta', JSON.stringify(items.map(i => ({id: i.id, score: i.score}))));
    localStorage.setItem('tier_curr_count', currentMatchCount);
}

function showBattle() {
    setupScreen.classList.add('hidden');
    battleScreen.classList.remove('hidden');
    updateProgressUI();
    nextMatch();
}

// --- バトルロジック (新機能3統合) ---
let leftItem, rightItem;

function nextMatch() {
    // 上限に達したら自動終了
    if (currentMatchCount >= maxMatches) {
        showResults();
        return;
    }

    let i1 = Math.floor(Math.random() * items.length);
    let i2 = Math.floor(Math.random() * items.length);
    while (i1 === i2) i2 = Math.floor(Math.random() * items.length);

    leftItem = items[i1];
    rightItem = items[i2];
    document.getElementById('left-img').src = leftItem.data;
    document.getElementById('right-img').src = rightItem.data;
}

function updateRating(winner, loser) {
    const expected = 1 / (1 + Math.pow(10, (loser.score - winner.score) / 400));
    winner.score += K_FACTOR * (1 - expected);
    loser.score += K_FACTOR * (0 - expected);

    currentMatchCount++;
    updateProgressUI();
    saveToDB();
    nextMatch();
}

function updateProgressUI() {
    matchCounter.innerText = `${currentMatchCount} / ${maxMatches}`;
    const percent = (currentMatchCount / maxMatches) * 100;
    progressBar.style.width = `${percent}%`;
}

document.getElementById('left-card').onclick = () => updateRating(leftItem, rightItem);
document.getElementById('right-card').onclick = () => updateRating(rightItem, leftItem);

// --- 結果表示 ---
function showResults() {
    battleScreen.classList.add('hidden');
    resultScreen.classList.remove('hidden');
    
    const sorted = [...items].sort((a, b) => b.score - a.score);
    const n = sorted.length;
    const tierConfig = [
        { label: 'S', cls: 's-tier', end: Math.ceil(n * 0.1) },
        { label: 'A', cls: 'a-tier', end: Math.ceil(n * 0.3) },
        { label: 'B', cls: 'b-tier', end: Math.ceil(n * 0.7) },
        { label: 'C', cls: 'c-tier', end: Math.ceil(n * 0.9) },
        { label: 'D', cls: 'd-tier', end: n }
    ];

    const container = document.getElementById('tier-list');
    container.innerHTML = '';
    let curr = 0;
    tierConfig.forEach(t => {
        if (curr >= n) return;
        const row = document.createElement('div');
        row.className = `tier-row ${t.cls}`;
        row.innerHTML = `<div class="tier-label">${t.label}</div><div class="tier-items"></div>`;
        const itemBox = row.querySelector('.tier-items');
        while (curr < t.end && curr < n) {
            const img = document.createElement('img');
            img.src = sorted[curr].data;
            img.className = 'tier-item-img';
            itemBox.appendChild(img);
            curr++;
        }
        if (itemBox.children.length > 0) container.appendChild(row);
    });
}

document.getElementById('show-results-btn').onclick = showResults;

document.getElementById('reset-btn').onclick = () => {
    if (confirm('リセットしますか？')) {
        localStorage.clear();
        location.reload();
    }
};

// --- 起動時の復元 ---
window.onload = async () => {
    await initDB();
    const meta = JSON.parse(localStorage.getItem('tier_meta'));
    if (meta) {
        const tx = db.transaction('images', 'readonly');
        const getAll = tx.objectStore('images').getAll();
        getAll.onsuccess = () => {
            items = getAll.result;
            currentMatchCount = parseInt(localStorage.getItem('tier_curr_count') || 0);
            maxMatches = parseInt(localStorage.getItem('tier_max_matches') || 0);
            document.getElementById('resume-btn').style.display = 'inline-block';
        };
    }
};

document.getElementById('resume-btn').onclick = () => showBattle();
