import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-analytics.js";
import { getDatabase, ref, set, onValue } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-database.js";

const firebaseConfig = {
    apiKey: "AIzaSyD-5CPzp5iwNHUxloFkDBf3J8gRlUpbGVc",
    authDomain: "ton-not.firebaseapp.com",
    databaseURL: "https://ton-not-default-rtdb.firebaseio.com",
    projectId: "ton-not",
    storageBucket: "ton-not.appspot.com",
    messagingSenderId: "729333286761",
    appId: "1:729333286761:web:741fdeb1572cc1908bdff8",
    measurementId: "G-JKCWNWTLBT"
};

const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const db = getDatabase(app);

let balance = 2500;
let energy = 1000;
let maxEnergy = 1000;
let upgradeLevel = 0;
let rechargeLevel = 0;
let tapLevel = 0;
let energyRechargeRate = 1;
let tapMultiplier = 1;
let baseCost = 500;
let selectedBoost = null;
let lastUpdateTime = Date.now();

let telegramUserId = null;

function getTelegramUserId() {
    const tg = window.Telegram?.WebApp;
    const user = tg?.initDataUnsafe?.user;
    if (user) {
        telegramUserId = user.id;
        const resultElement = document.getElementById('result');
        if (resultElement) {
            resultElement.innerText = `Ваш Telegram ID: ${telegramUserId}`;
        }
    } else {
        const resultElement = document.getElementById('result');
        if (resultElement) {
            resultElement.innerText = 'Не вдалося отримати ваш Telegram ID.';
        }
    }
}

function saveDataToFirebase() {
    if (telegramUserId) {
        const userRef = ref(db, `users/${telegramUserId}`);
        set(userRef, {
            balance: balance,
            energy: energy,
            maxEnergy: maxEnergy,
            upgradeLevel: upgradeLevel,
            rechargeLevel: rechargeLevel,
            tapLevel: tapLevel,
            energyRechargeRate: energyRechargeRate,
            tapMultiplier: tapMultiplier,
            lastUpdateTime: Date.now(),
            boosts: {
                energyLimit: {
                    lvl: upgradeLevel,
                    cost: baseCost + (upgradeLevel * 500)
                },
                energyRechargeSpeed: {
                    lvl: rechargeLevel,
                    cost: 1000 + (rechargeLevel * 500)
                },
                multitap: {
                    lvl: tapLevel,
                    cost: baseCost + (tapLevel * 500)
                }
            }
        }).catch((error) => {
            console.error('Error saving data to Firebase:', error);
        });
    }
}

function loadDataFromFirebase() {
    if (telegramUserId) {
        const userRef = ref(db, `users/${telegramUserId}`);
        onValue(userRef, (snapshot) => {
            if (snapshot.exists()) {
                const data = snapshot.val();
                balance = data.balance || balance;
                energy = data.energy || energy;
                maxEnergy = data.maxEnergy || maxEnergy;
                upgradeLevel = data.upgradeLevel || upgradeLevel;
                rechargeLevel = data.rechargeLevel || rechargeLevel;
                tapLevel = data.tapLevel || tapLevel;
                energyRechargeRate = data.energyRechargeRate || energyRechargeRate;
                tapMultiplier = data.tapMultiplier || tapMultiplier;
                lastUpdateTime = data.lastUpdateTime || Date.now();

                if (data.boosts) {
                    if (data.boosts.energyLimit) {
                        upgradeLevel = data.boosts.energyLimit.lvl;
                        baseCost = data.boosts.energyLimit.cost - (upgradeLevel * 500);
                    }
                    if (data.boosts.energyRechargeSpeed) {
                        rechargeLevel = data.boosts.energyRechargeSpeed.lvl;
                    }
                    if (data.boosts.multitap) {
                        tapLevel = data.boosts.multitap.lvl;
                    }
                }

                updateEnergyInBackground();
                updateDisplay();
            }
        }, {
            onlyOnce: true
        });
    }
}

function processPurchase(item) {
    if (item.classList.contains('disabled')) {
        showMessage('Цей буст вже на максимальному рівні.');
        return;
    }
    const level = parseInt(item.querySelector('.boost-level')?.innerText) + 1;
    let cost;
    if (item.dataset.boost === 'energy-limit') {
        cost = baseCost + (level - 1) * 500;
    } else if (item.dataset.boost === 'energy-recharge-speed') {
        cost = 1000 + (level - 1) * 500;
    } else if (item.dataset.boost === 'multitap') {
        cost = baseCost + (level - 1) * 500;
    }
    if (balance >= cost) {
        balance -= cost;
        const boostLevelElement = item.querySelector('.boost-level');
        if (boostLevelElement) {
            boostLevelElement.innerText = `${level} lvl`;
        }

        if (item.dataset.boost === 'energy-limit') {
            maxEnergy += 500;
            upgradeLevel += 1;
        } else if (item.dataset.boost === 'energy-recharge-speed') {
            energyRechargeRate += 1;
            rechargeLevel += 1;
        } else if (item.dataset.boost === 'multitap') {
            tapMultiplier += 1;
            tapLevel += 1;
        }

        updateBoostCost();
        updateDisplay();
        showMessage(`${item.querySelector('.boost-name')?.innerText} (Level ${level}) активовано!`);
        saveDataToFirebase();
    } else {
        showInsufficientFundsModal();
    }
}

function updateBoostCost() {
    const energyLimitCost = baseCost + (upgradeLevel * 500);
    const energyLimitElement = document.querySelector('.boost-item[data-boost="energy-limit"] .boost-cost');
    if (energyLimitElement) {
        energyLimitElement.innerText = energyLimitCost.toLocaleString();
    }

    const rechargeSpeedCost = 1000 + (rechargeLevel * 500);
    const rechargeSpeedElement = document.querySelector('.boost-item[data-boost="energy-recharge-speed"] .boost-cost');
    if (rechargeSpeedElement) {
        rechargeSpeedElement.innerText = rechargeSpeedCost.toLocaleString();
    }

    const tapMultiplierCost = baseCost + (tapLevel * 500);
    const tapMultiplierElement = document.querySelector('.boost-item[data-boost="multitap"] .boost-cost');
    if (tapMultiplierElement) {
        tapMultiplierElement.innerText = tapMultiplierCost.toLocaleString();
    }
}

function showConfirmModal(boost) {
    selectedBoost = boost;
    const level = parseInt(boost.querySelector('.boost-level')?.innerText) + 1;
    let cost;
    if (boost.dataset.boost === 'energy-limit') {
        cost = baseCost + (level - 1) * 500;
    } else if (boost.dataset.boost === 'energy-recharge-speed') {
        cost = 1000 + (level - 1) * 500;
    } else if (boost.dataset.boost === 'multitap') {
        cost = baseCost + (level - 1) * 500;
    }
    const confirmTextElement = document.getElementById('confirmText');
    if (confirmTextElement) {
        confirmTextElement.innerText = `Ви впевнені, що хочете купити ${boost.querySelector('.boost-name')?.innerText} (Level ${level}) за ${cost.toLocaleString()} балів?`;
    }
    const confirmModalElement = document.getElementById('confirmModal');
    if (confirmModalElement) {
        confirmModalElement.style.display = 'block';
    }
}

function closeConfirmModal() {
    const confirmModalElement = document.getElementById('confirmModal');
    if (confirmModalElement) {
        confirmModalElement.style.display = 'none';
    }
    selectedBoost = null;
}

function showInsufficientFundsModal() {
    const insufficientFundsModalElement = document.getElementById('insufficientFundsModal');
    if (insufficientFundsModalElement) {
        insufficientFundsModalElement.style.display = 'block';
    }
}

document.getElementById('insufficientFundsOk')?.addEventListener('click', () => {
    const insufficientFundsModalElement = document.getElementById('insufficientFundsModal');
    if (insufficientFundsModalElement) {
        insufficientFundsModalElement.style.display = 'none';
    }
});

document.getElementById('confirmYes')?.addEventListener('click', () => {
    if (selectedBoost) {
        processPurchase(selectedBoost);
        closeConfirmModal();
    }
});

document.getElementById('confirmNo')?.addEventListener('click', () => {
    closeConfirmModal();
});

document.querySelectorAll('.boost-item').forEach((item) => {
    item.addEventListener('click', () => {
        if (item.classList.contains('disabled')) {
            showMessage('Цей буст вже на максимальному рівні.');
        } else {
            showConfirmModal(item);
        }
    });
});

document.getElementById('coin')?.addEventListener('click', () => {
    if (energy >= tapMultiplier) {
        balance += tapMultiplier;
        energy -= tapMultiplier;
        updateDisplay();
        saveDataToFirebase();
    } else {
        showMessage('Немає достатньо енергії для цього кліку!');
    }
});

setInterval(() => {
    if (energy < maxEnergy) {
        energy += energyRechargeRate;
        if (energy > maxEnergy) {
            energy = maxEnergy;
        }
        updateDisplay();
        saveDataToFirebase();
    }
}, 1000);

window.addEventListener('focus', updateEnergyInBackground);

window.addEventListener('blur', () => {
    lastUpdateTime = Date.now();
    saveDataToFirebase();
});

document.getElementById('boosts-btn')?.addEventListener('click', () => {
    const boostsModalElement = document.getElementById('boostsModal');
    if (boostsModalElement) {
        boostsModalElement.style.display = 'block';
    }
});

document.querySelector('.close')?.addEventListener('click', () => {
    const boostsModalElement = document.getElementById('boostsModal');
    if (boostsModalElement) {
        boostsModalElement.style.display = 'none';
    }
});

window.addEventListener('click', (event) => {
    const boostsModalElement = document.getElementById('boostsModal');
    if (event.target === boostsModalElement) {
        boostsModalElement.style.display = 'none';
    }
});

document.getElementById('frens-btn')?.addEventListener('click', () => {
    const gameScreenElement = document.getElementById('game-screen');
    const frensScreenElement = document.getElementById('frens-screen');
    if (gameScreenElement && frensScreenElement) {
        gameScreenElement.style.display = 'none';
        frensScreenElement.style.display = 'block';
    }
});

document.querySelector('.back-btn')?.addEventListener('click', () => {
    const gameScreenElement = document.getElementById('game-screen');
    const frensScreenElement = document.getElementById('frens-screen');
    if (gameScreenElement && frensScreenElement) {
        frensScreenElement.style.display = 'none';
        gameScreenElement.style.display = 'block';
    }
});

document.getElementById('get-id-btn')?.addEventListener('click', function() {
    const tg = window.Telegram?.WebApp;
    const user = tg?.initDataUnsafe?.user;
    if (user) {
        const resultElement = document.getElementById('result');
        if (resultElement) {
            resultElement.innerText = `Ваш Telegram ID: ${user.id}`;
        }
    } else {
        const resultElement = document.getElementById('result');
        if (resultElement) {
            resultElement.innerText = 'Не вдалося отримати ваш Telegram ID.';
        }
    }
});

window.onload = function() {
    getTelegramUserId();
    loadDataFromFirebase();
};

function updateDisplay() {
    const balanceElement = document.getElementById('balance');
    if (balanceElement) {
        balanceElement.innerText = `Баланс: ${balance.toLocaleString()}`;
    }
    const energyElement = document.getElementById('energy');
    if (energyElement) {
        energyElement.innerText = `Енергія: ${energy}/${maxEnergy}`;
    }
    const energyLimitElement = document.querySelector('.boost-item[data-boost="energy-limit"] .boost-level');
    if (energyLimitElement) {
        energyLimitElement.innerText = `${upgradeLevel} lvl`;
    }
    const rechargeSpeedElement = document.querySelector('.boost-item[data-boost="energy-recharge-speed"] .boost-level');
    if (rechargeSpeedElement) {
        rechargeSpeedElement.innerText = `${rechargeLevel} lvl`;
    }
    const multitapElement = document.querySelector('.boost-item[data-boost="multitap"] .boost-level');
    if (multitapElement) {
        multitapElement.innerText = `${tapLevel} lvl`;
    }
    updateBoostCost();
}

function updateEnergyInBackground() {
    const timePassed = (Date.now() - lastUpdateTime) / 1000;
    const energyToAdd = Math.floor(timePassed * energyRechargeRate);
    energy = Math.min(maxEnergy, energy + energyToAdd);
    lastUpdateTime = Date.now();
    updateDisplay();
    saveDataToFirebase();
}

function showMessage(message) {
    const messageBox = document.getElementById('messageBox');
    if (messageBox) {
        messageBox.innerText = message;
        messageBox.style.display = 'block';
        setTimeout(() => {
            messageBox.style.display = 'none';
        }, 3000);
    }
}