// ====== Голосовое взаимодействие (без текста на экране) ======
let recognition = null;
let isListening = false;
let isSpeakingEnabled = true;
let isProcessing = false;
let onFinalResult = null;
let currentUtterance = null;
let statusCallback = null;

export function setStatusCallback(cb) {
    statusCallback = cb;
}

function logStatus(text) {
    if (statusCallback) statusCallback(text);
}

// ====== Speech Recognition ======
function initRecognition() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
        console.warn('Speech Recognition not supported');
        return null;
    }
    const r = new SR();
    r.lang = 'ru-RU';
    r.continuous = true;
    r.interimResults = true;
    r.maxAlternatives = 3;

    r.onresult = (event) => {
        let final = '';
        let interim = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
            if (event.results[i].isFinal) {
                final += event.results[i][0].transcript;
            } else {
                interim += event.results[i][0].transcript;
            }
        }
        if (final) {
            if (onFinalResult) onFinalResult(final);
        }
    };

    r.onerror = (e) => {
        if (e.error !== 'no-speech') {
            console.warn('Recognition error:', e.error);
        }
    };

    r.onend = () => {
        if (isListening && !isProcessing) {
            try { r.start(); } catch(e) {}
        }
    };

    return r;
}

export function startListening(callback) {
    onFinalResult = callback;
    if (!recognition) {
        recognition = initRecognition();
        if (!recognition) return;
    }
    try {
        recognition.start();
        isListening = true;
    } catch(e) {}
}

export function stopListening() {
    if (recognition && isListening) {
        try { recognition.stop(); } catch(e) {}
    }
    isListening = false;
}

export function toggleListening(callback) {
    if (isListening) {
        stopListening();
    } else {
        startListening(callback);
    }
}

export function setProcessing(val) {
    isProcessing = val;
    if (val) {
        stopListening();
    }
}

// ====== Speech Synthesis ======
export function speakText(text, onDone) {
    if (!isSpeakingEnabled) {
        if (onDone) onDone();
        return;
    }

    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'ru-RU';
    utterance.rate = 0.92;
    utterance.pitch = 1.1;
    utterance.volume = 1;

    const voices = window.speechSynthesis.getVoices();
    const ruVoice = voices.find(v => v.lang.startsWith('ru') && /female|google|samantha/i.test(v.name))
        || voices.find(v => v.lang.startsWith('ru'))
        || voices.find(v => /google|samantha/i.test(v.name))
        || voices[0];
    if (ruVoice) utterance.voice = ruVoice;

    utterance.onstart = () => {
        logStatus('speaking');
    };

    utterance.onend = () => {
        logStatus('idle');
        if (onDone) onDone();
    };

    utterance.onerror = () => {
        logStatus('idle');
        if (onDone) onDone();
    };

    currentUtterance = utterance;
    window.speechSynthesis.speak(utterance);
}

export function stopSpeaking() {
    window.speechSynthesis.cancel();
    logStatus('idle');
}

export function toggleSpeaking() {
    isSpeakingEnabled = !isSpeakingEnabled;
    if (!isSpeakingEnabled) stopSpeaking();
}

export function isSpeechEnabled() {
    return isSpeakingEnabled;
}
