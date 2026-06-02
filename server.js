const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const initSqlJs = require('sql.js');
const fetch = require('node-fetch');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public-new')));

// ====== База данных ======
let db;
async function initDb() {
  const SQL = await initSqlJs();
  const dbPath = path.join(__dirname, 'data', 'appointments.db');
  if (fs.existsSync(dbPath)) {
    const buffer = fs.readFileSync(dbPath);
    db = new SQL.Database(buffer);
  } else {
    db = new SQL.Database();
  }
  db.run(`CREATE TABLE IF NOT EXISTS appointments (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    phone TEXT,
    email TEXT,
    date TEXT NOT NULL,
    time TEXT NOT NULL,
    service_type TEXT,
    notes TEXT,
    status TEXT DEFAULT 'pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS consultation_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT,
    question TEXT,
    answer TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
  saveDb();
}
function saveDb() {
  const dbPath = path.join(__dirname, 'data', 'appointments.db');
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(dbPath, buffer);
}

// ====== Ollama LLM ======
const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
const LLM_MODEL = process.env.LLM_MODEL || 'qwen2.5:3b';
const PREFERRED_MODELS = ['qwen2.5:3b', 'qwen2.5:7b', 'llama3.2:3b', 'llama3.1:8b', 'mixtral:8x7b'];

async function detectBestModel() {
  try {
    const response = await fetch(`${OLLAMA_URL}/api/tags`);
    const data = await response.json();
    const availableModels = (data.models || []).map(m => m.name);
    for (const preferred of PREFERRED_MODELS) {
      if (availableModels.includes(preferred)) {
        console.log(`📡 Используется модель: ${preferred}`);
        return preferred;
      }
    }
    if (availableModels.length > 0) {
      console.log(`📡 Используется доступная модель: ${availableModels[0]}`);
      return availableModels[0];
    }
    console.log('⚠️  Модели Ollama не найдены. Будут использованы fallback-ответы.');
    return LLM_MODEL;
  } catch (err) {
    console.log('⚠️  Ollama не отвечает. Будут использованы fallback-ответы.');
    return LLM_MODEL;
  }
}

// ====== ПОЛНАЯ БАЗА ЗНАНИЙ ======

// Системный промпт эксперта
const SYSTEM_PROMPT = `Ты — Елена, виртуальный офис-менеджер нотариальной конторы "Нотариус+" в Москве, РФ.

Твой тон: приветливый, профессиональный, уверенный. Ты говоришь на русском языке. 
Отвечай кратко (2-4 предложения), по делу и дружелюбно. 
Если нужно записать на приём, узнай: ФИО, дату, время, тип услуги, телефон.

Ты эксперт по следующим областям:

## 1. ОСНОВЫ ГРАЖДАНСКОГО КОДЕКСА РФ (ГК РФ)
- Часть 1 (общие положения): ст. 1-453 — лица, сделки, договоры, право собственности
- Часть 2 (отдельные виды обязательств): ст. 454-1109 — купля-продажа, аренда, подряд, займ
- Часть 3 (наследственное право): ст. 1110-1224 — наследование по завещанию и по закону
- Часть 4 (интеллектуальная собственность): ст. 1225-1551
- Сделки с недвижимостью требуют нотариального удостоверения в случаях, предусмотренных законом
- Доверенности: простая письменная форма или нотариальная (для сделок с недвижимостью)
- Наследство: срок принятия 6 месяцев, наследование по закону 8 очередей

## 2. ОСНОВЫ НОТАРИАТА (ФЗ "О нотариате")
- Нотариальные действия: удостоверение сделок, свидетельствование верности копий, выдача свидетельств о праве на наследство
- Нотариус обеспечивает законность и юридическую достоверность
- Нотариальная тайна: информация о совершённых действиях не подлежит разглашению
- Ответственность нотариуса: полная имущественная ответственность за вред, причинённый действиями
- Тарифы: государственная пошлина + услуги правового и технического характера (УПТХ)

## 3. УСЛУГИ НОТАРИАЛЬНОЙ КОНТОРЫ
- Заверение копий документов от 100 руб
- Удостоверение доверенностей от 1500 руб
- Составление и удостоверение завещаний от 3000 руб
- Оформление наследства (свидетельство о праве на наследство) — от 5000 руб
- Договоры купли-продажи недвижимости — от 8000 руб
- Брачные договоры — от 5000 руб
- Согласия на выезд детей — от 1000 руб
- Удостоверение договоров дарения — от 3000 руб
- Юридическое консультирование по нотариальным вопросам

## 4. КОРПОРАТИВНОЕ ОБЩЕНИЕ И ЭТИКЕТ
- Первое впечатление: приветствие с улыбкой, зрительный контакт
- Активное слушание: перефразирование вопроса клиента
- Конфиденциальность: никаких деталей дел других клиентов
- Стресс-менеджмент: при эмоциональных клиентах сохранять спокойствие и эмпатию
- Стандарты обслуживания: ответ на звонок до 3 гудков, ответ на ресепшн в течение 1 минуты

## 5. РЕЖИМ РАБОТЫ
- Пн-Пт: 9:00 - 18:00
- Сб: 10:00 - 15:00
- Вс: выходной
- Адрес: г. Москва, ул. Тверская, д. 15, офис 305
- Телефон: +7 (999) 123-45-67

Если вопрос не касается твоей компетенции, вежливо предложи связаться с нотариусом напрямую.`;

// ====== Fallback ответы (когда Ollama недоступен) ======
const FALLBACK_RESPONSES = [
  { 
    keywords: ['услуг', 'предоставляете', 'делаете', 'помощь', 'можно'],
    response: 'Наша контора предоставляет: заверение копий, удостоверение доверенностей, завещаний, договоров купли-продажи, дарения, брачных договоров, оформление наследства, согласий на выезд детей. Также мы консультируем по нотариальным вопросам.'
  },
  { 
    keywords: ['цен', 'стоим', 'сколько', 'дорого', 'плат'],
    response: 'Стоимость услуг: заверение копий — от 100 руб., доверенности — от 1500 руб., завещания — от 3000 руб., договоры купли-продажи — от 8000 руб., брачные договоры — от 5000 руб. Точная цена зависит от сложности работы. Для консультации запишитесь на приём.'
  },
  { 
    keywords: ['запись', 'записаться', 'приём', 'прием', 'попасть'],
    response: 'Для записи назовите ваше ФИО, желаемые дату и время, тип услуги и контактный телефон. Я зафиксирую заявку и передам администратору.'
  },
  { 
    keywords: ['адрес', 'найти', 'находитесь', 'где вы', 'проезд', 'метро'],
    response: 'Мы находимся по адресу: г. Москва, ул. Тверская, д. 15, офис 305. Ближайшие станции метро: Тверская, Пушкинская, Чеховская. Режим работы: Пн-Пт 9:00-18:00, Сб 10:00-15:00.'
  },
  { 
    keywords: ['наследств', 'наследник', 'завещание', 'завещател'],
    response: 'По наследственным делам: завещание удостоверяется нотариусом, срок принятия наследства — 6 месяцев. Наследование осуществляется по завещанию или по закону (8 очередей). Стоимость оформления — от 5000 руб.'
  },
  { 
    keywords: ['доверен', 'доверяю'],
    response: 'Доверенности: для сделок с недвижимостью требуется нотариальная форма. Простые доверенности можно составить в простой письменной форме. Стоимость — от 1500 руб. Необходим паспорт и данные доверителя/представителя.'
  },
  { 
    keywords: ['недвижим', 'квартир', 'купли', 'продаж', 'дарение'],
    response: 'Сделки с недвижимостью: договоры купли-продажи и дарения требуют нотариального удостоверения. Стоимость от 8000 руб. Для сделки потребуются паспорта сторон, правоустанавливающие документы, кадастровый паспорт.'
  },
  { 
    keywords: ['копи', 'документ'],
    response: 'Заверение копий документов: от 100 руб. за страницу. Потребуется оригинал документа. Заверяются копии паспортов, дипломов, свидетельств и других официальных бумаг.'
  },
  { 
    keywords: ['согласи', 'выезд', 'ребёнк', 'ребенк', 'дет'],
    response: 'Согласие на выезд ребенка за границу — от 1000 руб. Требуется присутствие обоих родителей или одного с предоставлением документов. Срок действия — до 3 лет.'
  },
  { 
    keywords: ['гк', 'гражданск', 'кодекс', 'статья', 'закон'],
    response: 'Гражданский кодекс РФ регулирует сделки, договоры, право собственности, наследование. Для конкретной консультации по применению норм права рекомендую обратиться к нотариусу на личном приёме.'
  },
  { 
    keywords: ['здравств', 'привет', 'добрый'],
    response: 'Здравствуйте! Я Елена, офис-менеджер нотариальной конторы "Нотариус+". Чем я могу вам помочь? Расскажу об услугах, запишу на приём или проконсультирую.'
  },
  { 
    keywords: ['спасиб', 'благодар'],
    response: 'Пожалуйста! Рада была помочь. Если появятся ещё вопросы — обращайтесь. Хорошего дня!'
  },
  { 
    keywords: ['нотариус', 'нотариат'],
    response: 'Нотариус — это юрист, уполномоченный совершать нотариальные действия: удостоверять сделки, свидетельствовать верность копий, выдавать свидетельства о праве на наследство. Нотариальная деятельность регулируется ФЗ "О нотариате".'
  },
  { 
    keywords: ['срок', 'долго', 'готов'],
    response: 'Сроки изготовления документов: доверенность — 1 день, завещание — 1 день, договоры — 1-3 дня, наследство — 6 месяцев после открытия наследства. Срочное оформление возможно.'
  },
];

function findFallbackResponse(message) {
  const msg = message.toLowerCase();
  for (const item of FALLBACK_RESPONSES) {
    if (item.keywords.some(k => msg.includes(k))) {
      return item.response;
    }
  }
  return null;
}

async function queryLLM(messages) {
  const model = global.LLM_MODEL || LLM_MODEL;
  const lastUserMsg = messages.filter(m => m.role === 'user').slice(-1)[0]?.content || '';
  const fallback = findFallbackResponse(lastUserMsg);
  
  try {
    const fullMessages = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...messages.slice(-10)
    ];
    
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    
    const response = await fetch(`${OLLAMA_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: model,
        messages: fullMessages,
        stream: false,
        options: { temperature: 0.7, top_p: 0.9 }
      }),
      signal: controller.signal
    });
    clearTimeout(timeout);
    
    const data = await response.json();
    
    if (data.error || !data.message?.content) {
      console.warn('Ollama error:', data.error || 'empty');
      return fallback || 'Извините, сейчас я не могу ответить. Пожалуйста, позвоните нам: +7 (999) 123-45-67 или зайдите в контору лично.';
    }
    
    return data.message.content;
  } catch (err) {
    console.error('LLM error:', err.message);
    return fallback || 'Извините, произошла ошибка. Пожалуйста, позвоните нам по телефону: +7 (999) 123-45-67.';
  }
}

// ====== API Routes ======
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', ollama_model: global.LLM_MODEL || LLM_MODEL });
});

app.post('/api/chat', async (req, res) => {
  const { message, history } = req.body;
  if (!message) return res.status(400).json({ error: 'Message required' });
  
  const messages = [...(history || []), { role: 'user', content: message }];
  const answer = await queryLLM(messages);
  
  const stmt = db.prepare('INSERT INTO consultation_log (session_id, question, answer) VALUES (?, ?, ?)');
  stmt.run([uuidv4(), message, answer]);
  saveDb();
  
  res.json({ answer });
});

app.get('/api/appointments', (req, res) => {
  const stmt = db.prepare('SELECT * FROM appointments ORDER BY date, time');
  const rows = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject());
  }
  res.json(rows || []);
});

app.post('/api/appointments', (req, res) => {
  const { name, phone, email, date, time, service_type, notes } = req.body;
  if (!name || !date || !time) {
    return res.status(400).json({ error: 'Name, date and time required' });
  }
  const id = uuidv4();
  const stmt = db.prepare(
    'INSERT INTO appointments (id, name, phone, email, date, time, service_type, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  );
  stmt.run([id, name, phone || '', email || '', date, time, service_type || '', notes || '']);
  saveDb();
  res.json({ id, message: 'Запись создана!' });
});

app.delete('/api/appointments/:id', (req, res) => {
  const stmt = db.prepare('DELETE FROM appointments WHERE id = ?');
  stmt.run([req.params.id]);
  saveDb();
  res.json({ message: 'Запись отменена' });
});

// ====== Socket.IO ======
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
  socket.on('visitor:detected', (data) => {
    console.log('Visitor detected:', data);
    io.emit('notary:notification', { type: 'visitor', message: 'Посетитель у стойки' });
  });
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// ====== Запуск ======
const PORT = process.env.PORT || 3000;

async function start() {
  await initDb();
  const detectedModel = await detectBestModel();
  global.LLM_MODEL = detectedModel;
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`✅ Виртуальный офис-менеджер запущен на порту ${PORT}`);
    console.log(`🔗 http://localhost:${PORT}`);
    console.log(`🤖 Модель LLM: ${LLM_MODEL}`);
  });
}

start().catch(err => {
  console.error('Startup error:', err);
  process.exit(1);
});
