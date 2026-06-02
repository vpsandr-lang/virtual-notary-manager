import { initScene3D, setSpeaking, setListening, updateFacePosition, resetFacePosition } from './scene.js';
import { 
    speakText, setStatusCallback,
    startListening, stopListening, isSpeechEnabled
} from './voice.js';
import { startWebcam, detectFace } from './webcam.js';

let isProcessing = false;
let chatHistory = [];
let wakeTimeout = null;
let currentStatus = 'idle';

// ====== Инициализация ======
async function init() {
    console.log('🔄 Запуск виртуального офис-менеджера...');

    // 3D сцена с аватаром
    initScene3D();

    // Веб-камера
    await startWebcam();

    // Загружаем голоса
    window.speechSynthesis.getVoices();
    window.speechSynthesis.onvoiceschanged = () => window.speechSynthesis.getVoices();

    // Устанавливаем колбэк статуса
    setStatusCallback((status) => {
        currentStatus = status;
        if (status === 'speaking') {
            setSpeaking(true);
            setListening(false);
        } else if (status === 'idle') {
            setSpeaking(false);
            if (!isProcessing) {
                setListening(true);
            }
        }
    });

    // Приветствие через 1.5 секунды
    setTimeout(() => {
        const greeting = 'Здравствуйте! Я Елена, виртуальный офис-менеджер. Чем я могу вам помочь?';
        speakText(greeting, () => {
            setTimeout(() => startListening(handleUserSpeech), 500);
        });
    }, 1500);

    // Поиск лица каждые 300мс
    setInterval(() => {
        const face = detectFace();
        if (face) {
            updateFacePosition(face.x, face.y);
        } else {
            resetFacePosition();
        }
    }, 300);

    console.log('✅ Виртуальный офис-менеджер запущен');
}

// ====== Обработка речи пользователя ======
async function handleUserSpeech(text) {
    if (isProcessing || !text || !text.trim()) return;

    isProcessing = true;
    setProcessing(true);
    setListening(true);

    try {
        const response = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                message: text,
                history: chatHistory.slice(-10)
            })
        });

        if (!response.ok) throw new Error('Server error');

        const data = await response.json();
        const answer = data.answer;

        chatHistory.push({ role: 'user', content: text });
        chatHistory.push({ role: 'assistant', content: answer });

        // Озвучиваем ответ (speaking статус установится через колбэк)
        speakText(answer, () => {
            setSpeaking(false);
            isProcessing = false;
            setProcessing(false);
            
            // Снова начинаем слушать
            setTimeout(() => {
                if (!isProcessing) {
                    startListening(handleUserSpeech);
                }
            }, 300);
        });

    } catch (err) {
        console.error('Error:', err);
        isProcessing = false;
        setProcessing(false);
        setTimeout(() => startListening(handleUserSpeech), 2000);
    }
}

// ====== Запуск ======
document.addEventListener('DOMContentLoaded', init);
