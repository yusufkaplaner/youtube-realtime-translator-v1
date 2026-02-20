const output = document.getElementById("output");
const btnProcess = document.getElementById("btnProcess");
const btnStartStop = document.getElementById("btnStartStop");
const statusText = document.getElementById("currentStatus");
const blockSizeInput = document.getElementById("blockSizeInput");

// Hız Kontrolleri
const speedSlider = document.getElementById("speedSlider");
const speedValueLabel = document.getElementById("speedValue");
const autoSyncCheck = document.getElementById("autoSyncCheck");

// Navigasyon
const btnPrev = document.getElementById("btnPrev");
const btnNext = document.getElementById("btnNext");
const btnPlayVideoOnly = document.getElementById("btnPlayVideoOnly");

// --- GLOBAL DEĞİŞKENLER ---
let segmentsCache = [];
let currentIndex = 0;
let isSystemActive = false;
let synth = window.speechSynthesis;
let currentUtterance = null;

const urlParams = new URLSearchParams(window.location.search);
const targetTabId = urlParams.get('tabId');

// --- YARDIMCI FONKSİYONLAR ---

const timeStampToSeconds = (text) => {
    const match = text.match(/(\d+):(\d{2})/); 
    if (!match) return 0;
    return (parseInt(match[1]) * 60) + parseInt(match[2]);
};

function sendVideoControlMessage(command, payload = null) {
    if (!targetTabId) return;
    chrome.tabs.sendMessage(parseInt(targetTabId), { 
        action: "controlVideo", 
        command: command, 
        payload: payload 
    });
}

function calculateDynamicRate(text, duration) {
    if (!text || !duration || duration <= 0) return 1.0;
    const CHARS_PER_SECOND_BASE = 14; 
    let calculatedRate = (text.length / duration) / CHARS_PER_SECOND_BASE;
    // Hız limitini 5.0'a çıkardım
    return Math.min(Math.max(calculatedRate, 0.5), 5.0);
}

// ARTIK BLOK BOYUTUNU (blockSize) PARAMETRE OLARAK ALIYOR
function parseAndCombineTranscript(text, blockSize) {
    const segments = [];
    const fullText = text.replace(/\n/g, ' '); 
    const regex = /(\d+:\d{2})\s*(.*?)(?=\s*\d+:\d{2}|$)/gs; 
    let match;
    const rawSegments = [];

    // Ham veriyi çıkar
    while ((match = regex.exec(fullText)) !== null) {
        rawSegments.push({
            start: timeStampToSeconds(match[1]),
            text: match[2].trim(),
            timestamp: match[1]
        });
    }

    // Blokları Kullanıcının Seçtiği Sayıya Göre Birleştir
    // blockSizeInput'tan gelen değer burada kullanılıyor
    for (let i = 0; i < rawSegments.length; i += blockSize) {
        const block = rawSegments.slice(i, i + blockSize);
        if (block.length > 0) {
            const first = block[0];
            const combinedText = block.map(s => s.text).join(' ');
            
            segments.push({
                start: first.start,
                text: combinedText,
                timestamp: first.timestamp
            });
        }
    }

    // Süreleri Hesapla
    for (let i = 0; i < segments.length; i++) {
        const current = segments[i];
        const next = segments[i + 1];
        if (next) {
            current.duration = next.start - current.start;
        } else {
            current.duration = current.text.length / 10; 
        }
    }
    return segments.filter(s => s.text.length > 0);
}

// --- OYNATMA MANTIĞI ---

function playSegment(index) {
    // Sınır koruması
    if (index < 0) index = 0;
    if (index >= segmentsCache.length) {
        stopSystem();
        statusText.innerText = "Transkript Sonu.";
        return;
    }

    // Index'i güncelle
    currentIndex = index;
    const segment = segmentsCache[currentIndex];

    statusText.innerText = `[${segment.timestamp}] Okunuyor (${currentIndex + 1}/${segmentsCache.length})`;

    // 1. Önceki konuşmayı kesin olarak durdur
    synth.cancel();

    // 2. Videoyu o zamana çek
    sendVideoControlMessage("seekTo", segment.start);
    sendVideoControlMessage("play");

    // 3. Hızı belirle
    let rate = 1.0;
    if (autoSyncCheck.checked) {
        rate = calculateDynamicRate(segment.text, segment.duration);
    } else {
        rate = parseFloat(speedSlider.value);
    }

    // 4. Yeni konuşmayı oluştur
    currentUtterance = new SpeechSynthesisUtterance(segment.text);
    currentUtterance.lang = "tr-TR";
    currentUtterance.rate = rate;

    // 5. Konuşma bitince ne olacak?
    currentUtterance.onend = () => {
        // Sadece sistem aktifse devam et.
        // Eğer kullanıcı manuel olarak ileri/geri yaptıysa bu onend tetiklenmemeli 
        // ya da tetiklense bile sistem yeni index'e geçtiği için sorun olmamalı.
        if (isSystemActive && !synth.speaking) { 
             // Ufak bir kontrol: gerçekten konuşma bittiği için mi buradayız?
             // Yoksa cancel edildiği için mi? 
             // playSegment(currentIndex + 1) çağrısı sadece doğal akışta olmalı.
             playSegment(currentIndex + 1);
        }
    };

    currentUtterance.onerror = (e) => {
        // Hata durumunda (veya cancel edildiğinde) akışı bozma
        console.log("TTS Event:", e);
    };

    synth.speak(currentUtterance);
}

function startSystem() {
    if (segmentsCache.length === 0) return alert("Veri yok!");
    isSystemActive = true;
    btnStartStop.textContent = "DURDUR";
    btnStartStop.style.borderColor = "#ff4444";
    btnStartStop.style.color = "#ff4444";
    playSegment(currentIndex);
}

function stopSystem() {
    isSystemActive = false;
    synth.cancel();
    sendVideoControlMessage("pause");
    btnStartStop.textContent = "DEVAM ET";
    btnStartStop.style.borderColor = "#00ffcc";
    btnStartStop.style.color = "#00ffcc";
}

// --- BUTONLAR ---

btnProcess.onclick = () => {
    const text = output.value;
    // Kullanıcının girdiği blok sayısını al (Varsayılan 2)
    const blockSize = parseInt(blockSizeInput.value) || 2;

    if (!text) return alert("Veri girişi yok!");
    
    // Blok sayısını fonksiyona gönder
    segmentsCache = parseAndCombineTranscript(text, blockSize);
    
    output.value = segmentsCache.map(s => `${s.timestamp} | ${s.text.substring(0, 40)}...`).join('\n');
    statusText.innerText = `${segmentsCache.length} blok hazırlandı (Blok başı: ${blockSize} satır).`;
    currentIndex = 0;
    alert("Veriler hazır!");
};

btnStartStop.onclick = () => {
    if (isSystemActive) stopSystem();
    else startSystem();
};

// NAVİGASYON (Agresif Mod)
btnPrev.onclick = () => {
    if (segmentsCache.length === 0) return;
    
    // Sistemi durdurmadan direkt müdahale et
    // 1. Önce sus
    synth.cancel();
    // 2. Index'i geri çek (en az 0)
    let newIndex = currentIndex - 1;
    if (newIndex < 0) newIndex = 0;
    
    // 3. Oynat (Sistem kapalıysa bile aç)
    if (!isSystemActive) {
        isSystemActive = true;
        btnStartStop.textContent = "DURDUR";
    }
    
    // 4. Doğrudan çağır (Wait yok, delay yok)
    playSegment(newIndex);
};

btnNext.onclick = () => {
    if (segmentsCache.length === 0) return;
    
    synth.cancel();
    let newIndex = currentIndex + 1;
    
    if (!isSystemActive) {
        isSystemActive = true;
        btnStartStop.textContent = "DURDUR";
    }
    playSegment(newIndex);
};

btnPlayVideoOnly.onclick = () => sendVideoControlMessage("togglePlay");

speedSlider.oninput = (e) => {
    speedValueLabel.innerText = e.target.value;
};

autoSyncCheck.onchange = (e) => {
    speedSlider.disabled = e.target.checked;
    if(e.target.checked) speedValueLabel.innerText = "Oto";
    else speedValueLabel.innerText = speedSlider.value;
};