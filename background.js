// background.js dosyasını tamamen bu kodla değiştirin

// Aktif YouTube sekmesinin ID'sini tutacak değişken
let youtubeTabId = null;

// Eklenti ikonuna tıklandığında tetiklenir
chrome.action.onClicked.addListener((tab) => {
    // 1. O anda aktif olan sekmenin ID'sini kaydet
    // Bu, popup.js'in hangi sekmeyi kontrol edeceğini bilmesini sağlar.
    youtubeTabId = tab.id;

    // 2. Yeni pencereyi aç ve sekme ID'sini parametre olarak gönder
    chrome.windows.create({
        url: `popup.html?tabId=${youtubeTabId}`, // Sekme ID'si parametre olarak eklendi
        type: 'popup',     
        width: 330,        
        height: 600        
    });
});

// fetchTranscript listener'ı, yeni pencere açma mantığı nedeniyle artık gereksizdir. 
// Ancak content.js'e komut göndermek için kullanılan ana mesaj dinleyiciyi koruyalım.
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.action === "fetchTranscript") {
        // Bu kısım artık kullanılmıyorsa da genel yapıyı koruyalım
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            chrome.tabs.sendMessage(tabs[0].id, { action: "getTranscript" }, (response) => {
                sendResponse(response);
            });
        });
        return true;
    }
});