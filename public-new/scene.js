import * as THREE from 'three';

// ====== Состояние аватара ======
export const avatarState = {
    isSpeaking: false,
    isListening: false,
    mouthOpen: 0,
    blinkTimer: 0,
    isBlinking: false,
    headTarget: new THREE.Vector3(0, 0, 0),
    faceDetected: false,
    faceX: 0,
    faceY: 0,
};

let scene, camera, renderer, clock = new THREE.Clock();
let avatarGroup, headGroup, jawGroup, bodyGroup;
let leftEye, rightEye, leftPupil, rightPupil;
let leftEyelidTop, leftEyelidBot, rightEyelidTop, rightEyelidBot;
let upperLip, lowerLip;
let mouthInterior;
let hairFront, hairBack, hairSideL, hairSideR;
let leftBrow, rightBrow;
let eyelashGroup;
let blazerGroup, blouseGroup;
let deskGroup;

const container = document.getElementById('canvas-container');

// ====== Инициализация сцены ======
function initScene() {
    const w = container.clientWidth;
    const h = container.clientHeight;

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x2c3e50);
    scene.fog = new THREE.FogExp2(0x2c3e50, 0.065);

    camera = new THREE.PerspectiveCamera(32, w / h, 0.1, 30);
    camera.position.set(0.15, 1.25, 2.6);
    camera.lookAt(0, 1.08, 0);

    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setSize(w, h);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(renderer.domElement);

    createOffice();
    createAvatar();

    window.addEventListener('resize', onResize);

    // Небольшая естественная пауза после загрузки
    setTimeout(() => {
        if (!avatarState.faceDetected) {
            // Лёгкое движение головой - осмотреться
            avatarState.headTarget.set(Math.sin(Date.now() * 0.001) * 0.05, 0, 0);
        }
    }, 3000);
}

function onResize() {
    const w = container.clientWidth;
    const h = container.clientHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
}

// ====== Создание кабинета ======
function createOffice() {
    // Пол - паркет
    const floorMat = new THREE.MeshStandardMaterial({
        color: 0x8B7355, roughness: 0.7, metalness: 0.0,
    });
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(8, 8), floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = 0;
    floor.receiveShadow = true;
    scene.add(floor);

    // Стены
    const wallMat = new THREE.MeshStandardMaterial({
        color: 0xf0ebe0, roughness: 0.95,
    });
    const backWall = new THREE.Mesh(new THREE.BoxGeometry(8, 3.5, 0.15), wallMat);
    backWall.position.set(0, 1.75, -2.8);
    scene.add(backWall);

    // Потолок
    const ceilMat = new THREE.MeshStandardMaterial({ color: 0xf5f0e8, roughness: 1 });
    const ceil = new THREE.Mesh(new THREE.BoxGeometry(8, 0.1, 5.5), ceilMat);
    ceil.position.set(0, 3.5, 0);
    scene.add(ceil);

    // Окно
    createWindow();

    // Стол
    createDesk();

    // Освещение
    createLighting();

    // Растение в углу
    createPlant();
}

function createWindow() {
    // Рама окна
    const frameMat = new THREE.MeshStandardMaterial({ color: 0x5D4037, roughness: 0.7 });
    const frameOuter = new THREE.Mesh(new THREE.BoxGeometry(2.4, 2.0, 0.10), frameMat);
    frameOuter.position.set(0, 1.75, -2.75);
    scene.add(frameOuter);

    // Стекло
    const glassMat = new THREE.MeshPhysicalMaterial({
        color: 0xb8d4e8, transparent: true, opacity: 0.15,
        roughness: 0.0, metalness: 0.0, envMapIntensity: 0.5,
        side: THREE.DoubleSide,
    });
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 1.8), glassMat);
    glass.position.set(0, 1.75, -2.73);
    scene.add(glass);

    // Переплёты оконные
    const frameInnerMat = new THREE.MeshStandardMaterial({ color: 0x6D4C41, roughness: 0.6 });
    for (let x of [-0.55, 0.55]) {
        const vDiv = new THREE.Mesh(new THREE.BoxGeometry(0.04, 1.8, 0.06), frameInnerMat);
        vDiv.position.set(x, 1.75, -2.73);
        scene.add(vDiv);
    }
    for (let y of [0.9, 2.6]) {
        const hDiv = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.04, 0.06), frameInnerMat);
        hDiv.position.set(0, y, -2.73);
        scene.add(hDiv);
    }

    // Вид из окна - город
    const buildingMat = new THREE.MeshStandardMaterial({ color: 0x4a6fa5, roughness: 0.9 });
    const buildingMat2 = new THREE.MeshStandardMaterial({ color: 0x5a7fa5, roughness: 0.9 });
    const windowLit = new THREE.MeshStandardMaterial({ color: 0xffd700, emissive: 0xffd700, emissiveIntensity: 0.5 });

    const positions = [
        { x: -0.9, h: 1.0 }, { x: -0.4, h: 0.7 }, { x: 0.1, h: 1.3 },
        { x: 0.6, h: 0.8 }, { x: 1.0, h: 0.95 },
    ];
    for (const b of positions) {
        const mat = Math.random() > 0.5 ? buildingMat : buildingMat2;
        const building = new THREE.Mesh(new THREE.BoxGeometry(0.3, b.h, 0.06), mat);
        building.position.set(b.x, 1.2 + b.h/2, -2.8);
        scene.add(building);

        for (let wy = 0; wy < Math.floor(b.h / 0.18); wy++) {
            for (let wx = -1; wx <= 1; wx++) {
                if (Math.random() > 0.3) {
                    const win = new THREE.Mesh(new THREE.PlaneGeometry(0.04, 0.05), windowLit);
                    win.position.set(wx * 0.08, 0.08 + wy * 0.18, 0.04);
                    win.rotation.y = Math.PI;
                    building.add(win);
                }
            }
        }
    }

    // Небо
    const skyMat = new THREE.MeshBasicMaterial({
        color: 0x87CEEB, transparent: true, opacity: 0.25,
        side: THREE.DoubleSide,
    });
    const sky = new THREE.Mesh(new THREE.PlaneGeometry(2.8, 2.2), skyMat);
    sky.position.set(0, 1.75, -2.75);
    scene.add(sky);
}

function createDesk() {
    deskGroup = new THREE.Group();

    // Столешница - массив дерева
    const matTop = new THREE.MeshStandardMaterial({ color: 0x5D4037, roughness: 0.35, metalness: 0.05 });
    const top = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.06, 0.75), matTop);
    top.position.set(0, 0.82, 0.35);
    top.castShadow = true;
    top.receiveShadow = true;
    deskGroup.add(top);

    // Покрытие стола
    const matSurface = new THREE.MeshStandardMaterial({ color: 0x8D6E63, roughness: 0.3, metalness: 0.02 });
    const surface = new THREE.Mesh(new THREE.BoxGeometry(1.75, 0.02, 0.70), matSurface);
    surface.position.set(0, 0.85, 0.35);
    deskGroup.add(surface);

    // Передняя панель
    const matFront = new THREE.MeshStandardMaterial({ color: 0x4E342E, roughness: 0.6 });
    const front = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.5, 0.03), matFront);
    front.position.set(0, 0.55, 0.72);
    deskGroup.add(front);

    // Боковины
    for (let x of [-0.82, 0.82]) {
        const side = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.5, 0.70), matFront);
        side.position.set(x, 0.55, 0.35);
        deskGroup.add(side);
    }

    // Ножки
    const matLeg = new THREE.MeshStandardMaterial({ color: 0x3E2723, roughness: 0.7, metalness: 0.2 });
    for (let x of [-0.75, 0.75]) {
        for (let z of [0.0, 0.65]) {
            const leg = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.2, 0.04), matLeg);
            leg.position.set(x, 0.1, z);
            deskGroup.add(leg);
        }
    }

    // Монитор
    const monMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.3, metalness: 0.5 });
    const screenMat = new THREE.MeshStandardMaterial({
        color: 0x1a3a5c, emissive: 0x0a1a3a, emissiveIntensity: 0.4,
    });
    const stand = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.04, 0.08, 8), monMat);
    stand.position.set(-0.25, 0.90, 0.18);
    deskGroup.add(stand);
    const monBody = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.18, 0.02), monMat);
    monBody.position.set(-0.25, 1.0, 0.18);
    deskGroup.add(monBody);
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.10, 0.15), screenMat);
    screen.position.set(-0.25, 1.0, 0.191);
    deskGroup.add(screen);

    // Клавиатура
    const kbMat = new THREE.MeshStandardMaterial({ color: 0x2a2a2a, roughness: 0.8 });
    const kb = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.01, 0.08), kbMat);
    kb.position.set(-0.20, 0.88, 0.42);
    deskGroup.add(kb);

    // Коврик для мыши
    const pad = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.005, 0.06), 
        new THREE.MeshStandardMaterial({ color: 0x1a1a2a, roughness: 0.9 }));
    pad.position.set(-0.08, 0.875, 0.48);
    deskGroup.add(pad);

    // Настольная лампа
    const lampBase = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.05, 0.01, 12),
        new THREE.MeshStandardMaterial({ color: 0x333333, metalness: 0.5, roughness: 0.3 }));
    lampBase.position.set(0.55, 0.87, 0.55);
    deskGroup.add(lampBase);
    const lampArm = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.15, 6),
        new THREE.MeshStandardMaterial({ color: 0x444444, metalness: 0.6, roughness: 0.2 }));
    lampArm.position.set(0.55, 0.95, 0.55);
    deskGroup.add(lampArm);
    const lampShade = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.06, 12, 1, true),
        new THREE.MeshStandardMaterial({ color: 0x555555, side: THREE.DoubleSide }));
    lampShade.position.set(0.55, 1.02, 0.55);
    lampShade.rotation.x = 0.3;
    deskGroup.add(lampShade);
    const lampLight = new THREE.Mesh(new THREE.SphereGeometry(0.015, 8, 8),
        new THREE.MeshBasicMaterial({ color: 0xffffcc }));
    lampLight.position.set(0.55, 0.98, 0.57);
    deskGroup.add(lampLight);

    scene.add(deskGroup);
}

function createPlant() {
    // Маленькое растение в углу
    const potMat = new THREE.MeshStandardMaterial({ color: 0x2d5a27, roughness: 0.8 });
    const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.06, 0.1, 8), potMat);
    pot.position.set(-0.9, 0.05, -1.2);
    scene.add(pot);
    
    const leafMat = new THREE.MeshStandardMaterial({ color: 0x3a7d33, roughness: 0.9 });
    for (let i = 0; i < 5; i++) {
        const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.04 + Math.random()*0.03, 6, 6), leafMat);
        leaf.scale.y = 2 + Math.random();
        leaf.position.set(-0.9 + (Math.random()-0.5)*0.08, 0.12 + Math.random()*0.1, -1.2 + (Math.random()-0.5)*0.08);
        leaf.rotation.z = Math.random() * 0.5;
        scene.add(leaf);
    }
}

function createLighting() {
    // Основной мягкий свет (окно)
    const windowLight = new THREE.DirectionalLight(0xb8d4e8, 1.2);
    windowLight.position.set(0, 2.5, -1.5);
    windowLight.castShadow = true;
    windowLight.shadow.mapSize.width = 1024;
    windowLight.shadow.mapSize.height = 1024;
    scene.add(windowLight);

    // Тёплый свет сверху (офисный)
    const fillLight = new THREE.DirectionalLight(0xffeedd, 0.8);
    fillLight.position.set(0, 4, 0);
    fillLight.castShadow = true;
    scene.add(fillLight);

    // Контровой свет сзади справа
    const rimLight = new THREE.DirectionalLight(0xccddff, 0.6);
    rimLight.position.set(1.5, 2, -1);
    scene.add(rimLight);

    // Мягкий заполняющий свет
    const ambient = new THREE.AmbientLight(0x404060, 0.4);
    scene.add(ambient);

    // Лампа на столе
    const deskLamp = new THREE.PointLight(0xffeedd, 0.3, 2);
    deskLamp.position.set(0.55, 0.9, 0.55);
    scene.add(deskLamp);
}

// ====== Создание аватара ======
function createAvatar() {
    avatarGroup = new THREE.Group();
    avatarGroup.position.set(0, 0, 0.05);

    createBody();
    createHead();
    createHair();
    makeEyelashes();

    // Доворот тела
    avatarGroup.rotation.y = 0.05;

    scene.add(avatarGroup);
}

// ====== ТЕЛО ======
function createBody() {
    bodyGroup = new THREE.Group();

    // === Плечи и торс ===
    const skinMat = new THREE.MeshStandardMaterial({
        color: 0xf5d6c6, roughness: 0.5, metalness: 0.0,
    });

    // Шея
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.10, 0.08, 16), skinMat);
    neck.position.set(0, 0.96, 0);
    neck.castShadow = true;
    bodyGroup.add(neck);

    // === Пиджак ===
    const jacketMat = new THREE.MeshStandardMaterial({
        color: 0x2c3e6b, roughness: 0.7, metalness: 0.05,
    });
    const jacketDark = new THREE.MeshStandardMaterial({
        color: 0x1a2a4a, roughness: 0.7, metalness: 0.05,
    });

    // Торс (пиджак)
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.38, 0.26), jacketMat);
    torso.position.set(0, 0.76, 0);
    torso.scale.set(1, 1, 0.85);
    torso.castShadow = true;
    bodyGroup.add(torso);

    // Воротник пиджака
    const collarMat = jacketDark;
    for (let side of [-1, 1]) {
        const lapel = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.10, 0.02), collarMat);
        lapel.position.set(side * 0.16, 0.94, 0.10);
        lapel.rotation.z = side * 0.15;
        bodyGroup.add(lapel);
    }

    // Блуза (видна в вырезе)
    const blouseMat = new THREE.MeshStandardMaterial({
        color: 0xfff8f0, roughness: 0.9, metalness: 0.0,
    });
    const blouse = new THREE.Mesh(new THREE.BoxGeometry(0.20, 0.06, 0.06), blouseMat);
    blouse.position.set(0, 0.90, 0.14);
    bodyGroup.add(blouse);

    // Пуговицы на блузе
    const btnMat = new THREE.MeshStandardMaterial({ color: 0xf0ead0, roughness: 0.3 });
    for (let y = 0.80; y <= 0.92; y += 0.06) {
        const btn = new THREE.Mesh(new THREE.SphereGeometry(0.008, 6, 6), btnMat);
        btn.position.set(0, y, 0.14);
        bodyGroup.add(btn);
    }

    // === Руки ===
    // Левая рука
    const armMat = jacketMat;
    const lArm = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.045, 0.28, 8), armMat);
    lArm.position.set(-0.26, 0.78, -0.02);
    lArm.rotation.z = 0.1;
    lArm.rotation.x = -0.2;
    bodyGroup.add(lArm);

    // Правая рука
    const rArm = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.045, 0.28, 8), armMat);
    rArm.position.set(0.26, 0.78, -0.02);
    rArm.rotation.z = -0.1;
    rArm.rotation.x = -0.2;
    bodyGroup.add(rArm);

    // Манжеты
    const cuffMat = new THREE.MeshStandardMaterial({ color: 0xfff8f0, roughness: 0.9 });
    for (let side of [-0.26, 0.26]) {
        const cuff = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.035, 0.025, 8), cuffMat);
        cuff.position.set(side, 0.65, -0.06);
        bodyGroup.add(cuff);
    }

    // Кисти рук
    const handMat = skinMat;
    const lHand = new THREE.Mesh(new THREE.SphereGeometry(0.032, 8, 8), handMat);
    lHand.position.set(-0.26, 0.62, -0.08);
    lHand.scale.set(1, 0.8, 0.7);
    bodyGroup.add(lHand);
    const rHand = new THREE.Mesh(new THREE.SphereGeometry(0.032, 8, 8), handMat);
    rHand.position.set(0.26, 0.62, -0.08);
    rHand.scale.set(1, 0.8, 0.7);
    bodyGroup.add(rHand);

    // === Плечи (подкладка пиджака) ===
    for (let side of [-1, 1]) {
        const shoulder = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 8), jacketMat);
        shoulder.position.set(side * 0.20, 0.94, 0.01);
        shoulder.scale.set(1, 0.5, 0.8);
        bodyGroup.add(shoulder);
    }

    bodyGroup.position.y = -0.10;
    avatarGroup.add(bodyGroup);
}
// ====== ГОЛОВА И ЛИЦО ======
function createHead() {
    headGroup = new THREE.Group();

    const skinMat = new THREE.MeshStandardMaterial({
        color: 0xf5d6c6, roughness: 0.45, metalness: 0.0,
    });
    const skinMatDark = new THREE.MeshStandardMaterial({
        color: 0xe8c8b8, roughness: 0.5, metalness: 0.0,
    });
    const skinMatLight = new THREE.MeshStandardMaterial({
        color: 0xfae8dc, roughness: 0.4, metalness: 0.0,
    });

    // === Основная форма головы ===
    const headBase = new THREE.Mesh(new THREE.SphereGeometry(0.105, 28, 28), skinMatLight);
    headBase.position.y = 1.02;
    headBase.scale.set(0.95, 1.05, 0.90);
    headBase.castShadow = true;
    headGroup.add(headBase);

    // Подбородок (вытяжение)
    const chin = new THREE.Mesh(new THREE.SphereGeometry(0.055, 16, 16), skinMat);
    chin.position.set(0, 0.935, 0.01);
    chin.scale.set(0.9, 0.7, 0.85);
    headGroup.add(chin);

    // Скулы
    for (let side of [-1, 1]) {
        const cheek = new THREE.Mesh(new THREE.SphereGeometry(0.04, 12, 12), skinMatDark);
        cheek.position.set(side * 0.10, 1.0, -0.02);
        cheek.scale.set(0.7, 0.6, 0.5);
        headGroup.add(cheek);
    }

    // Лоб
    const forehead = new THREE.Mesh(new THREE.SphereGeometry(0.08, 16, 16), skinMatLight);
    forehead.position.set(0, 1.09, 0.02);
    forehead.scale.set(0.9, 0.5, 0.7);
    headGroup.add(forehead);

    // === Глаза ===
    const eyeWhiteMat = new THREE.MeshStandardMaterial({
        color: 0xfff8f0, roughness: 0.1, metalness: 0.0,
    });
    const irisMat = new THREE.MeshStandardMaterial({
        color: 0x4a7a5c, roughness: 0.0, metalness: 0.3,
    });
    const pupilMat = new THREE.MeshStandardMaterial({
        color: 0x0a0a0a, roughness: 0.0, metalness: 0.0,
    });
    const corneaMat = new THREE.MeshPhysicalMaterial({
        color: 0xffffff, roughness: 0.0, metalness: 0.0,
        transparent: true, opacity: 0.15,
    });

    for (let side of [-1, 1]) {
        // Глазное яблоко
        const eyeball = new THREE.Mesh(new THREE.SphereGeometry(0.026, 16, 16), eyeWhiteMat);
        eyeball.position.set(side * 0.047, 1.032, 0.082);
        headGroup.add(eyeball);

        // Роговица (блеск)
        const cornea = new THREE.Mesh(new THREE.SphereGeometry(0.027, 16, 16), corneaMat);
        cornea.position.copy(eyeball.position);
        headGroup.add(cornea);

        // Радужка
        const iris = new THREE.Mesh(new THREE.CircleGeometry(0.015, 16), irisMat);
        iris.position.set(side * 0.047, 1.032, 0.108);
        headGroup.add(iris);

        // Зрачок
        const pupil = new THREE.Mesh(new THREE.CircleGeometry(0.007, 12), pupilMat);
        pupil.position.set(side * 0.047, 1.032, 0.109);
        headGroup.add(pupil);

        // Сохраняем ссылки на зрачки для движения глаз
        if (side === -1) { leftPupil = pupil; leftEye = eyeball; }
        else { rightPupil = pupil; rightEye = eyeball; }
    }

    // === Веки ===
    const eyelidMat = new THREE.MeshStandardMaterial({
        color: 0xf0d0c0, roughness: 0.6, metalness: 0.0,
    });
    const eyelidMatBot = new THREE.MeshStandardMaterial({
        color: 0xecc8b8, roughness: 0.6, metalness: 0.0,
    });

    for (let side of [-1, 1]) {
        const ex = side * 0.047;
        const ey = 1.032;
        const ez = 0.082;

        // Верхнее веко
        const lidT = new THREE.Mesh(new THREE.SphereGeometry(0.028, 12, 8, 0, Math.PI*2, 0, Math.PI*0.5), eyelidMat);
        lidT.position.set(ex, ey + 0.005, ez);
        lidT.scale.set(1, 0.4, 0.9);
        lidT.rotation.x = -0.1;
        headGroup.add(lidT);

        // Нижнее веко
        const lidB = new THREE.Mesh(new THREE.SphereGeometry(0.025, 12, 8, 0, Math.PI*2, Math.PI*0.5, Math.PI*0.5), eyelidMatBot);
        lidB.position.set(ex, ey - 0.005, ez);
        lidB.scale.set(1, 0.25, 0.8);
        lidB.rotation.x = 0.1;
        headGroup.add(lidB);

        // Сохраняем для анимации моргания
        if (side === -1) {
            leftEyelidTop = lidT;
            leftEyelidBot = lidB;
        } else {
            rightEyelidTop = lidT;
            rightEyelidBot = lidB;
        }
    }

    // === Брови ===
    const browMat = new THREE.MeshStandardMaterial({
        color: 0x3a2a1a, roughness: 0.8, metalness: 0.0,
    });

    for (let side of [-1, 1]) {
        const brow = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.006, 0.01), browMat);
        brow.position.set(side * 0.048, 1.06, 0.08);
        brow.rotation.z = side * 0.15;
        brow.rotation.x = -0.1;
        headGroup.add(brow);
        if (side === -1) leftBrow = brow;
        else rightBrow = brow;
    }

    // === Нос ===
    const noseMat = new THREE.MeshStandardMaterial({
        color: 0xf0c8b8, roughness: 0.5, metalness: 0.0,
    });
    // Носовая пирамида
    const nose = new THREE.Mesh(new THREE.BoxGeometry(0.024, 0.024, 0.015), noseMat);
    nose.position.set(0, 1.02, 0.105);
    headGroup.add(nose);
    // Кончик носа
    const tip = new THREE.Mesh(new THREE.SphereGeometry(0.012, 10, 10), noseMat);
    tip.position.set(0, 1.008, 0.118);
    tip.scale.set(1, 0.8, 1);
    headGroup.add(tip);
    // Ноздри
    const nostrilMat = new THREE.MeshStandardMaterial({ color: 0xc09880, roughness: 0.9 });
    for (let side of [-0.008, 0.008]) {
        const nostril = new THREE.Mesh(new THREE.SphereGeometry(0.004, 6, 6), nostrilMat);
        nostril.position.set(side, 1.002, 0.116);
        nostril.scale.set(1, 0.5, 0.7);
        headGroup.add(nostril);
    }

    // === Губы ===
    const lipMat = new THREE.MeshStandardMaterial({
        color: 0xd4687a, roughness: 0.3, metalness: 0.0,
    });
    const lipMatDark = new THREE.MeshStandardMaterial({
        color: 0xc05868, roughness: 0.4, metalness: 0.0,
    });

    // Верхняя губа
    upperLip = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.012, 0.015), lipMat);
    upperLip.position.set(0, 0.992, 0.108);
    upperLip.scale.set(1, 1, 0.8);
    headGroup.add(upperLip);

    // Нижняя губа
    lowerLip = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.014, 0.016), lipMatDark);
    lowerLip.position.set(0, 0.978, 0.108);
    lowerLip.scale.set(1, 1, 0.8);
    headGroup.add(lowerLip);

    // Контур губ
    const lipLine = new THREE.Mesh(new THREE.BoxGeometry(0.038, 0.003, 0.002), lipMatDark);
    lipLine.position.set(0, 0.992, 0.116);
    headGroup.add(lipLine);

    // Внутренняя часть рта
    const mouthMat = new THREE.MeshStandardMaterial({ color: 0x4a1a1a, roughness: 0.9 });
    mouthInterior = new THREE.Mesh(new THREE.BoxGeometry(0.020, 0.006, 0.012), mouthMat);
    mouthInterior.position.set(0, 0.984, 0.112);
    headGroup.add(mouthInterior);

    // === Челюсть (для анимации) ===
    jawGroup = new THREE.Group();
    jawGroup.position.set(0, 0.985, 0);
    
    // Нижняя часть лица (подвижная)
    const jawMesh = new THREE.Mesh(new THREE.SphereGeometry(0.06, 12, 12), skinMat);
    jawMesh.position.set(0, -0.01, 0.02);
    jawMesh.scale.set(0.9, 0.5, 0.7);
    jawGroup.add(jawMesh);
    
    // Переносим нижнюю губу в группу челюсти
    headGroup.remove(lowerLip);
    headGroup.remove(mouthInterior);
    jawGroup.add(lowerLip);
    jawGroup.add(mouthInterior);

    headGroup.add(jawGroup);

    // === Уши ===
    const earMat = new THREE.MeshStandardMaterial({ color: 0xf0c8b8, roughness: 0.5 });
    for (let side of [-1, 1]) {
        const ear = new THREE.Mesh(new THREE.SphereGeometry(0.025, 8, 8), earMat);
        ear.position.set(side * 0.098, 1.025, -0.01);
        ear.scale.set(0.4, 0.8, 0.5);
        headGroup.add(ear);
    }

    avatarGroup.add(headGroup);
}

// ====== РЕСНИЦЫ ======
function makeEyelashes() {
    eyelashGroup = new THREE.Group();
    const lashMat = new THREE.MeshStandardMaterial({ color: 0x1a0a0a, roughness: 0.9 });

    for (let side of [-1, 1]) {
        const baseX = side * 0.047;
        for (let i = 0; i < 5; i++) {
            const lash = new THREE.Mesh(new THREE.BoxGeometry(0.001, 0.008, 0.001), lashMat);
            lash.position.set(baseX + (i - 2) * 0.006, 1.04, 0.085 + Math.sin(i) * 0.005);
            lash.rotation.x = -0.3 + (i - 2) * 0.05;
            lash.rotation.z = side * (0.05 + Math.abs(i - 2) * 0.02);
            eyelashGroup.add(lash);
        }
    }
    headGroup.add(eyelashGroup);
}
// ====== ВОЛОСЫ ======
function createHair() {
    const hairMat = new THREE.MeshStandardMaterial({
        color: 0x3a2510, roughness: 0.7, metalness: 0.1,
    });
    const hairMatLight = new THREE.MeshStandardMaterial({
        color: 0x5a3a20, roughness: 0.6, metalness: 0.1,
    });
    const hairMatDark = new THREE.MeshStandardMaterial({
        color: 0x2a1808, roughness: 0.8, metalness: 0.05,
    });

    hairFront = new THREE.Group();
    hairBack = new THREE.Group();
    hairSideL = new THREE.Group();
    hairSideR = new THREE.Group();

    // === Основная масса волос ===
    const main = new THREE.Mesh(new THREE.SphereGeometry(0.115, 20, 20), hairMat);
    main.position.set(0, 1.08, -0.005);
    main.scale.set(0.95, 0.65, 0.95);
    hairFront.add(main);

    // Боковые объёмы
    for (let side of [-1, 1]) {
        const sideVol = new THREE.Mesh(new THREE.SphereGeometry(0.075, 16, 16), hairMatDark);
        sideVol.position.set(side * 0.10, 1.04, -0.02);
        sideVol.scale.set(0.7, 0.9, 0.8);
        hairFront.add(sideVol);
    }

    // Чёлка
    for (let i = 0; i < 7; i++) {
        const strand = new THREE.Mesh(new THREE.BoxGeometry(0.012 + Math.random()*0.005, 0.002, 0.002), hairMatLight);
        strand.position.set(-0.04 + i * 0.012, 1.10, 0.07 + Math.sin(i) * 0.01);
        strand.rotation.x = -0.3 - Math.random() * 0.1;
        strand.rotation.z = (i - 3) * 0.03;
        hairFront.add(strand);
    }

    // Объём на макушке
    const crown = new THREE.Mesh(new THREE.SphereGeometry(0.08, 16, 16), hairMat);
    crown.position.set(0, 1.13, -0.02);
    crown.scale.set(0.85, 0.5, 0.8);
    hairFront.add(crown);

    // === Задняя часть волос ===
    const back = new THREE.Mesh(new THREE.SphereGeometry(0.11, 16, 16), hairMatDark);
    back.position.set(0, 1.03, -0.09);
    back.scale.set(0.85, 0.7, 0.7);
    hairBack.add(back);

    // Нижняя часть (сзади)
    const below = new THREE.Mesh(new THREE.SphereGeometry(0.085, 12, 12), hairMat);
    below.position.set(0, 0.96, -0.09);
    below.scale.set(0.8, 0.6, 0.6);
    hairBack.add(below);

    // === Пряди с боков ===
    for (let side of [-1, 1]) {
        const group = side === -1 ? hairSideL : hairSideR;
        // Передняя прядь
        for (let i = 0; i < 3; i++) {
            const strand = new THREE.Mesh(new THREE.BoxGeometry(0.003, 0.04 + i*0.01, 0.003), hairMat);
            strand.position.set(side * 0.095, 1.01 - i * 0.02, 0.02 + i * 0.01);
            strand.rotation.z = side * (0.2 + i * 0.05);
            strand.rotation.x = -0.05 * i;
            group.add(strand);
        }
    }

    hairFront.position.y = -0.01;
    hairBack.position.y = -0.01;
    hairSideL.position.y = -0.01;
    hairSideR.position.y = -0.01;

    headGroup.add(hairFront);
    headGroup.add(hairBack);
    headGroup.add(hairSideL);
    headGroup.add(hairSideR);
}
// ====== АНИМАЦИЯ ======
export function animateAvatar() {
    const delta = clock.getDelta();
    const time = clock.getElapsedTime();

    if (!avatarGroup || !headGroup) return;

    // === Дыхание ===
    const breath = Math.sin(time * 1.1) * 0.002;
    avatarGroup.position.y = breath * 0.5;
    
    // Лёгкое покачивание плеч
    if (bodyGroup) {
        bodyGroup.rotation.x = Math.sin(time * 1.1) * 0.001;
    }

    // === Поворот головы к лицу посетителя ===
    if (headGroup) {
        let targetX, targetY;

        if (avatarState.faceDetected) {
            // Плавное слежение за лицом
            targetX = avatarState.faceX * 0.35;
            targetY = avatarState.faceY * 0.3;
        } else {
            // Естественное движение - осматривается
            targetX = Math.sin(time * 0.25) * 0.06;
            targetY = Math.sin(time * 0.15) * 0.02;
        }

        // Плавная интерполяция
        headGroup.rotation.x += (targetY - headGroup.rotation.x) * delta * 4;
        headGroup.rotation.y += (targetX - headGroup.rotation.y) * delta * 4;
        
        // Лёгкий наклон головы при слушании
        if (avatarState.isListening) {
            headGroup.rotation.z += (-0.03 - headGroup.rotation.z) * delta * 2;
        } else {
            headGroup.rotation.z += (0 - headGroup.rotation.z) * delta * 2;
        }

        // Движение глаз к лицу
        if (leftPupil && rightPupil) {
            const gazeX = avatarState.faceDetected ? avatarState.faceX * 0.15 : 0;
            const gazeY = avatarState.faceDetected ? avatarState.faceY * 0.1 : 0;
            
            leftPupil.position.x += (-0.047 + gazeX - leftPupil.position.x) * delta * 5;
            leftPupil.position.y += (1.032 + gazeY - leftPupil.position.y) * delta * 5;
            rightPupil.position.x += (0.047 + gazeX - rightPupil.position.x) * delta * 5;
            rightPupil.position.y += (1.032 + gazeY - rightPupil.position.y) * delta * 5;
        }

        // Движение бровей
        if (leftBrow && rightBrow) {
            const browRaise = avatarState.isSpeaking ? 0.003 : (avatarState.isListening ? 0.001 : 0);
            leftBrow.position.y += (1.06 + browRaise - leftBrow.position.y) * delta * 4;
            rightBrow.position.y += (1.06 + browRaise - rightBrow.position.y) * delta * 4;
        }
    }

    // === Синхронизация рта с речью ===
    if (jawGroup) {
        if (avatarState.isSpeaking) {
            const mouthVal = 0.08 + Math.sin(time * 18) * 0.06 + Math.sin(time * 7) * 0.02;
            jawGroup.position.y = -0.012 - mouthVal * 0.25;
            
            if (upperLip && lowerLip) {
                const lipMove = 0.003 + mouthVal * 0.015;
                lowerLip.position.y = 0.978 - lipMove;
            }
        } else {
            jawGroup.position.y += (-0.012 - jawGroup.position.y) * delta * 10;
            if (lowerLip) {
                lowerLip.position.y += (0.978 - lowerLip.position.y) * delta * 8;
            }
        }
    }

    // === Моргание ===
    avatarState.blinkTimer += delta;
    const blinkInterval = 3 + Math.random() * 4;
    
    if (avatarState.blinkTimer > blinkInterval && !avatarState.isBlinking) {
        avatarState.isBlinking = true;
        avatarState.blinkTimer = 0;
    }

    if (avatarState.isBlinking) {
        const progress = avatarState.blinkTimer * 25;
        if (progress < Math.PI) {
            const blinkY = Math.min(1, Math.abs(Math.cos(progress)) * 2);
            // Опускаем верхние веки
            if (leftEyelidTop) leftEyelidTop.scale.y = 0.4 * blinkY;
            if (rightEyelidTop) rightEyelidTop.scale.y = 0.4 * blinkY;
            if (leftEyelidBot) leftEyelidBot.scale.y = 0.25 * blinkY;
            if (rightEyelidBot) rightEyelidBot.scale.y = 0.25 * blinkY;
        } else {
            avatarState.isBlinking = false;
            if (leftEyelidTop) leftEyelidTop.scale.y = 0.4;
            if (rightEyelidTop) rightEyelidTop.scale.y = 0.4;
            if (leftEyelidBot) leftEyelidBot.scale.y = 0.25;
            if (rightEyelidBot) rightEyelidBot.scale.y = 0.25;
        }
    }

    // Лёгкое движение волос
    const hairSway = Math.sin(time * 0.5) * 0.002;
    if (hairFront) hairFront.rotation.z = hairSway;
    if (hairBack) hairBack.rotation.z = hairSway * 0.5;
    if (hairSideL) hairSideL.rotation.z = hairSway * 0.8;
    if (hairSideR) hairSideR.rotation.z = hairSway * 0.8;
}

// ====== ЭКСПОРТ ======
export function setSpeaking(val) {
    avatarState.isSpeaking = val;
    // Лёгкое движение бровями при речи
    if (leftBrow && rightBrow && val) {
        leftBrow.position.y = 1.063;
        rightBrow.position.y = 1.063;
    }
}

export function setListening(val) {
    avatarState.isListening = val;
}

export function updateFacePosition(x, y) {
    avatarState.faceDetected = true;
    avatarState.faceX = x;
    avatarState.faceY = y;
}

export function resetFacePosition() {
    avatarState.faceDetected = false;
}

// ====== РЕНДЕР ======
let running = false;

export function startRendering() {
    if (running) return;
    running = true;
    function render() {
        if (!running) return;
        requestAnimationFrame(render);
        animateAvatar();
        renderer.render(scene, camera);
    }
    render();
}

export function initScene3D() {
    initScene();
    startRendering();
    console.log('✅ 3D сцена с аватаром готова');
}
