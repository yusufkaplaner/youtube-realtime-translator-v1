function getVideoPlayer() {
    return document.querySelector('video');
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.action === "controlVideo") {
        const video = getVideoPlayer();
        
        if (!video) {
            sendResponse({ success: false });
            return true;
        }

        switch (msg.command) {
            case "seekTo":
                // Direkt zamana git
                video.currentTime = msg.payload; 
                break;
            
            case "play":
                video.play();
                break;
            
            case "pause":
                video.pause();
                break;

            case "togglePlay":
                if (video.paused) video.play();
                else video.pause();
                break;

            case "skip":
                // İleri veya geri sar (msg.payload negatif veya pozitif olabilir)
                video.currentTime += msg.payload;
                break;
        }
        
        sendResponse({ success: true });
        return true;
    }
});