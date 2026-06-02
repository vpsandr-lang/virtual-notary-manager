import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { VRMLoaderPlugin, VRMUtils } from '@pixiv/three-vrm';

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
let vrm = null;
let isVRMLoaded = false;

// Procedural avatar parts
let avatarGroup = null;
let headGroup = null;
let leftEye, rightEye;
let leftEyelid, rightEyelid;
let mouth, jawGroup;
let hairGroup;
let bodyGroup;

const container = document.getElementById('canvas-container');

// ====== Инициализация ======
function initScene() {
    const w = container.clientWidth;
    const h = container.clientHeight;

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x2c3e50);
    scene.fog = new THREE.Fog(0x2c3e50, 5, 12);

    camera = new THREE.PerspectiveCamera(38, w / h, 0.1, 30);
    camera.position.set(0, 1.2, 2.8);
    camera.lookAt(0, 1.0, 0);

    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setSize(w, h);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(renderer.domElement);

    createOffice();
    tryLoadVRM();

    window.addEventListener('resize', onResize);
    return { scene, camera, renderer };
}

function onResize() {
    const w = container.clientWidth;
    const h = container.clientHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
}

// ====== Загрузка VRM ======
async function tryLoadVRM() {
    try {
        const resp = await fetch('avatar.vrm');
        const blob = await resp.blob();
        if (blob.size < 1000 || blob.type === 'text/html') {
            console.log('VRM не найден или невалиден, использую procedural аватар');
            createProceduralAvatar();
            return;
        }
        const url = URL.createObjectURL(blob);
        const loader = new GLTFLoader();
        loader.register(plugin => new VRMLoaderPlugin(plugin));
        
        const gltf = await loader.loadAsync(url);
        vrm = gltf.userData.vrm;
        if (!vrm) throw new Error('VRM parse failed');
        
        isVRMLoaded = true;
        scene.add(vrm.scene);
        vrm.scene.position.set(0, 0, -0.05);
        vrm.scene.scale.set(1, 1, 1);
        
        // Настройка VRM
        VRMUtils.rotateVRM0(vrm);
        vrm.scene.rotation.y = Math.PI;
        
        // Анимация blink если есть
        if (vrm.blendShapeProxy) {
            setInterval(() => {
                if (vrm.blendShapeProxy) {
                    vrm.blendShapeProxy.setValue('blink', 1);
                    setTimeout(() => {
                        if (vrm.blendShapeProxy) vrm.blendShapeProxy.setValue('blink', 0);
                    }, 100);
                }
            }, 3000 + Math.random() * 2000);
        }
        
        URL.revokeObjectURL(url);
        console.log('✅ VRM загружен:', vrm);
    } catch (err) {
        console.log('VRM загрузка не удалась, использую procedural:', err.message);
        createProceduralAvatar();
    }
}

// ====== Создание кабинета (реалистичный) ======
function createOffice() {
    // Пол (паркетная доска)
    const floorMat = new THREE.MeshStandardMaterial({
        color: 0x8B7355, roughness: 0.6, metalness: 0.05,
    });
    const floorGeo = new THREE.PlaneGeometry(8, 8);
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(0, 0, 0);
    floor.receiveShadow = true;
    scene.add(floor);

    // Стены
    const wallMat = new THREE.MeshStandardMaterial({
        color: 0xf0ebe0, roughness: 0.95,
    });
    // Задняя стена
    const backWall = new THREE.Mesh(new THREE.BoxGeometry(8, 3.5, 0.15), wallMat);
    backWall.position.set(0, 1.75, -2.5);
    scene.add(backWall);
    
    // Левая стена
    const leftWall = new THREE.Mesh(new THREE.BoxGeometry(0.15, 3.5, 5.5), wallMat);
    leftWall.position.set(-4, 1.75, 0);
    scene.add(leftWall);
    
    // Правая стена
    const rightWall = new THREE.Mesh(new THREE.BoxGeometry(0.15, 3.5, 5.5), wallMat);
    rightWall.position.set(4, 1.75, 0);
    scene.add(rightWall);

    // Потолок (светлый)
    const ceilMat = new THREE.MeshStandardMaterial({ color: 0xf5f0e8, roughness: 1 });
    const ceil = new THREE.Mesh(new THREE.BoxGeometry(8, 0.1, 5.5), ceilMat);
    ceil.position.set(0, 3.5, 0);
    scene.add(ceil);

    // Плинтус
    const plinthMat = new THREE.MeshStandardMaterial({ color: 0x6d4c41, roughness: 0.8 });
    for (let x = -3.8; x <= 3.8; x += 0.5) {
        const pl = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.08, 0.04), plinthMat);
        pl.position.set(x, 0.04, -2.43);
        scene.add(pl);
    }

    // Окно с видом
    createWindow();

    // Стол ресепшн
    createReceptionDesk();

    // Стул
    createChair();

    // Освещение
    createLighting();

    // Декор
    createDecor();
}

function createWindow() {
    // Оконный проем
    const frameMat = new THREE.MeshStandardMaterial({ color: 0x5D4037, roughness: 0.7 });
    const frameOuter = new THREE.Mesh(new THREE.BoxGeometry(2.6, 2.2, 0.12), frameMat);
    frameOuter.position.set(0, 1.8, -2.45);
    frameOuter.castShadow = true;
    scene.add(frameOuter);

    // Рамы внутренние
    const frameInnerMat = new THREE.MeshStandardMaterial({ color: 0x8B7355, roughness: 0.6 });
    // Вертикальная рама
    const vFrame = new THREE.Mesh(new THREE.BoxGeometry(0.05, 2.0, 0.08), frameInnerMat);
    vFrame.position.set(0, 1.8, -2.4);
    scene.add(vFrame);
    // Горизонтальные рамы
    for (let y of [1.0, 2.6]) {
        const hFrame = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.05, 0.08), frameInnerMat);
        hFrame.position.set(0, y, -2.4);
        scene.add(hFrame);
    }

    // Стекло
    const glassMat = new THREE.MeshPhysicalMaterial({
        color: 0xadd8e6, transparent: true, opacity: 0.2,
        roughness: 0.0, metalness: 0.0, envMapIntensity: 0.5,
    });
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 2.0), glassMat);
    glass.position.set(0, 1.8, -2.38);
    scene.add(glass);

    // Вид из окна - городской пейзаж
    const buildingMat = new THREE.MeshStandardMaterial({ color: 0x4a6fa5, roughness: 0.9 });
    const buildingMat2 = new THREE.MeshStandardMaterial({ color: 0x5a7fa5, roughness: 0.9 });
    const windowLit = new THREE.MeshBasicMaterial({ color: 0xffd700 });
    
    const positions = [
        { x: -1.0, h: 1.2, c: buildingMat },
        { x: -0.5, h: 0.8, c: buildingMat2 },
        { x: 0, h: 1.5, c: buildingMat },
        { x: 0.5, h: 0.9, c: buildingMat2 },
        { x: 1.0, h: 1.1, c: buildingMat },
    ];
    
    for (const b of positions) {
        const building = new THREE.Mesh(new THREE.BoxGeometry(0.35, b.h, 0.08), b.c);
        building.position.set(b.x, 1.2 + b.h/2, -2.7);
        scene.add(building);
        
        // Окна на зданиях
        for (let wy = 0; wy < Math.floor(b.h / 0.2); wy++) {
            for (let wx = -1; wx <= 1; wx++) {
                if (Math.random() > 0.3) {
                    const win = new THREE.Mesh(new THREE.PlaneGeometry(0.04, 0.06), windowLit);
                    win.position.set(wx * 0.1, 0.1 + wy * 0.2, 0.05);
                    building.add(win);
                }
            }
        }
    }

    // Небо
    const skyMat = new THREE.MeshBasicMaterial({
        color: 0x87CEEB, transparent: true, opacity: 0.3,
    });
    const sky = new THREE.Mesh(new THREE.PlaneGeometry(3.0, 2.5), skyMat);
    sky.position.set(0, 1.8, -2.6);
    scene.add(sky);
}

function createReceptionDesk() {
    const deskGroup = new THREE.Group();

    // Столешница основная (красное дерево/коричневый)
    const topMat = new THREE.MeshStandardMaterial({
        color: 0x5D4037, roughness: 0.4, metalness: 0.1,
    });
    const top = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.06, 0.7), topMat);
    top.position.set(0, 0.85, 0.3);
    top.castShadow = true;
    top.receiveShadow = true;
    deskGroup.add(top);

    // Верхняя поверхность (более светлая)
    const surfaceMat = new THREE.MeshStandardMaterial({
        color: 0x8D6E63, roughness: 0.3, metalness: 0.05,
    });
    const surface = new THREE.Mesh(new THREE.BoxGeometry(1.55, 0.02, 0.65), surfaceMat);
    surface.position.set(0, 0.88, 0.3);
    deskGroup.add(surface);

    // Передняя панель стола
    const frontMat = new THREE.MeshStandardMaterial({
        color: 0x4E342E, roughness: 0.6,
    });
    const front = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.6, 0.03), frontMat);
    front.position.set(0, 0.55, 0.65);
    deskGroup.add(front);

    // Боковые панели
    for (let x of [-0.72, 0.72]) {
        const side = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.6, 0.65), frontMat);
        side.position.set(x, 0.55, 0.3);
        deskGroup.add(side);
    }

    // Полка стола
    const shelfMat = new THREE.MeshStandardMaterial({ color: 0x5D4037, roughness: 0.5 });
    const shelf = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.03, 0.55), shelfMat);
    shelf.position.set(0, 0.25, 0.3);
    deskGroup.add(shelf);

    // Ножки стола
    const legMat = new THREE.MeshStandardMaterial({ color: 0x3E2723, roughness: 0.7, metalness: 0.3 });
    for (let x of [-0.65, 0.65]) {
        for (let z of [-0.0, 0.6]) {
            const leg = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.25, 0.04), legMat);
            leg.position.set(x, 0.125, z);
            deskGroup.add(leg);
        }
    }

    // Моноблок/терминал на столе
    const monitorMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.3, metalness: 0.5 });
    const screenMat = new THREE.MeshStandardMaterial({ color: 0x1a3a5c, emissive: 0x0a1a3a, emissiveIntensity: 0.3 });
    
    // Подставка монитора
    const monStand = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.04, 0.1, 8), monitorMat);
    monStand.position.set(-0.2, 0.93, 0.15);
    deskGroup.add(monStand);
    
    // Монитор
    const monBody = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.2, 0.02), monitorMat);
    monBody.position.set(-0.2, 1.03, 0.15);
    deskGroup.add(monBody);
    
    // Экран
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.13, 0.17), screenMat);
    screen.position.set(-0.2, 1.03, 0.16);
    deskGroup.add(screen);

    // Клавиатура
    const kbMat = new THREE.MeshStandardMaterial({ color: 0x2a2a2a, roughness: 0.8 });
    const kb = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.01, 0.08), kbMat);
    kb.position.set(-0.2, 0.91, 0.4);
    deskGroup.add(kb);

    // Лампа настольная
    const lampMat = new THREE.MeshStandardMaterial({ color: 0x3E2723, roughness: 0.5 });
    const lampShadeMat = new THREE.MeshStandardMaterial({ color: 0xc5a55a, emissive: 0xc5a55a, emissiveIntensity: 0.5 });
    
    const lampBase = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.06, 0.02, 12), lampMat);
    lampBase.position.set(0.4, 0.90, 0.1);
    deskGroup.add(lampBase);
    
    const lampArm = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.15, 6), lampMat);
    lampArm.position.set(0.4, 0.98, 0.1);
    deskGroup.add(lampArm);
    
    const lampShade = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.05, 12), lampShadeMat);
    lampShade.position.set(0.4, 1.05, 0.1);
    lampShade.rotation.x = 0.2;
    deskGroup.add(lampShade);

    // Подсветка от лампы
    const lampLight = new THREE.PointLight(0xc5a55a, 0.3, 2);
    lampLight.position.set(0.4, 0.95, 0.1);
    deskGroup.add(lampLight);

    // Табличка "РЕСЕПШН" на передней панели
    const signMat = new THREE.MeshStandardMaterial({
        color: 0xc5a55a, emissive: 0xc5a55a, emissiveIntensity: 0.2,
    });
    const sign = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.05, 0.005), signMat);
    sign.position.set(0, 0.65, 0.67);
    deskGroup.add(sign);

    // Маленькая табличка "НОТАРИУС+"
    const signMat2 = new THREE.MeshStandardMaterial({
        color: 0x8B4513, emissive: 0x8B4513, emissiveIntensity: 0.1,
    });
    const sign2 = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.03, 0.005), signMat2);
    sign2.position.set(0.4, 0.78, 0.67);
    deskGroup.add(sign2);

    deskGroup.position.set(0, 0, 0.5);
    scene.add(deskGroup);
}

function createChair() {
    const chairGroup = new THREE.Group();

    // Сиденье
    const seatMat = new THREE.MeshStandardMaterial({
        color: 0x2c2c2c, roughness: 0.8,
    });
    const seat = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.06, 0.35), seatMat);
    seat.position.set(0, 0.85, 1.2);
    seat.castShadow = true;
    chairGroup.add(seat);

    // Спинка
    const back = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.3, 0.04), seatMat);
    back.position.set(0, 0.98, 1.38);
    chairGroup.add(back);

    // Ножки
    const legMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.5, metalness: 0.7 });
    for (let x of [-0.12, 0.12]) {
        for (let z of [1.1, 1.3]) {
            const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.012, 0.8, 6), legMat);
            leg.position.set(x, 0.4, z);
            chairGroup.add(leg);
        }
    }

    // Колесики
    const wheelMat = new THREE.MeshStandardMaterial({ color: 0x333, roughness: 0.9 });
    for (let x of [-0.14, 0.14]) {
        for (let z of [1.08, 1.32]) {
            const wheel = new THREE.Mesh(new THREE.SphereGeometry(0.02, 6, 6), wheelMat);
            wheel.position.set(x, 0.02, z);
            chairGroup.add(wheel);
        }
    }

    chairGroup.position.set(0, 0, 0);
    scene.add(chairGroup);
}

function createLighting() {
    // Основной мягкий свет (сверху)
    const mainLight = new THREE.DirectionalLight(0xffeedd, 1.2);
    mainLight.position.set(2, 5, 3);
    mainLight.castShadow = true;
    mainLight.shadow.mapSize.width = 1024;
    mainLight.shadow.mapSize.height = 1024;
    mainLight.shadow.camera.near = 0.1;
    mainLight.shadow.camera.far = 10;
    scene.add(mainLight);

    // Заполняющий свет (сбоку из окна)
    const fillLight = new THREE.DirectionalLight(0x87CEEB, 0.6);
    fillLight.position.set(0, 2, -4);
    scene.add(fillLight);

    // Тёплый свет сзади (создает ореол)
    const rimLight = new THREE.DirectionalLight(0xffeedd, 0.4);
    rimLight.position.set(-2, 3, -3);
    scene.add(rimLight);

    // Точечный свет (лампа на столе)
    const pointLight = new THREE.PointLight(0xc5a55a, 0.2, 3);
    pointLight.position.set(0.4, 1.2, 0.3);
    scene.add(pointLight);

    // Верхний свет (люминесцентный)
    const ceilingLight = new THREE.PointLight(0xfff8f0, 0.5, 8);
    ceilingLight.position.set(0, 3.3, 0);
    scene.add(ceilingLight);

    // Ambient light
    const ambient = new THREE.AmbientLight(0x404060, 0.3);
    scene.add(ambient);
}

function createDecor() {
    // Картина на стене справа
    const paintingMat = new THREE.MeshStandardMaterial({
        color: 0x2c3e50, roughness: 0.5,
    });
    const painting = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.4, 0.02), paintingMat);
    painting.position.set(3.5, 1.8, -1);
    scene.add(painting);
    
    // Рамка картины
    const framePainting = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.45, 0.025), 
        new THREE.MeshStandardMaterial({ color: 0x8B4513, roughness: 0.6 }));
    framePainting.position.set(3.5, 1.8, -0.99);
    scene.add(framePainting);

    // Растение в углу
    const potMat = new THREE.MeshStandardMaterial({ color: 0x5D4037, roughness: 0.9 });
    const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 0.12, 8), potMat);
    pot.position.set(3.5, 0.06, -2.0);
    scene.add(pot);
    
    const plantMat = new THREE.MeshStandardMaterial({ color: 0x2d5a27, roughness: 0.9 });
    for (let i = 0; i < 5; i++) {
        const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.04 + Math.random() * 0.03, 6, 6), plantMat);
        leaf.position.set(
            3.5 + (Math.random() - 0.5) * 0.15,
            0.15 + Math.random() * 0.2,
            -2.0 + (Math.random() - 0.5) * 0.15
        );
        leaf.scale.set(1, 1.5 + Math.random(), 1);
        scene.add(leaf);
    }

    // Степлер, ручка, стакан с ручками на столе
    const desk = scene.children.find(c => c.position.x === 0 && c.position.y === 0 && c.position.z === 0.5);
    // Добавим на стол
    const metalMat = new THREE.MeshStandardMaterial({ color: 0x888888, roughness: 0.3, metalness: 0.8 });
    // Степлер
    const stapler = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.02, 0.04), metalMat);
    stapler.position.set(0.5, 0.91, 0.45);
    scene.add(stapler);
    
    // Стакан с ручками
    const cupMat = new THREE.MeshStandardMaterial({ color: 0x2c3e50, roughness: 0.5 });
    const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.02, 0.06, 8), cupMat);
    cup.position.set(0.55, 0.92, 0.2);
    scene.add(cup);

    // Коврик под столом
    const rugMat = new THREE.MeshStandardMaterial({ color: 0x1a3a5c, roughness: 0.95 });
    const rug = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.6), rugMat);
    rug.rotation.x = -Math.PI / 2;
    rug.position.set(0, 0.005, 0.3);
    scene.add(rug);
}

// ====== Procedural Avatar (ресепшионистка) ======
function createProceduralAvatar() {
    avatarGroup = new THREE.Group();

    // ====== Тело ======
    // Пиджак (красный, как на референсе)
    const jacketMat = new THREE.MeshStandardMaterial({
        color: 0xcc2222,
        roughness: 0.5,
        metalness: 0.05,
    });
    const jacket = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.35, 0.18), jacketMat);
    jacket.position.set(0, 0.9, -0.02);
    jacket.castShadow = true;
    avatarGroup.add(jacket);

    // Белая блуза (воротник)
    const blouseMat = new THREE.MeshStandardMaterial({
        color: 0xf8f8f8,
        roughness: 0.7,
    });
    const blouse = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.04, 0.06), blouseMat);
    blouse.position.set(0, 1.08, 0.06);
    avatarGroup.add(blouse);

    // Пуговицы на пиджаке
    const buttonMat = new THREE.MeshStandardMaterial({ color: 0xc5a55a, roughness: 0.3, metalness: 0.8 });
    for (let i = 0; i < 3; i++) {
        const btn = new THREE.Mesh(new THREE.CircleGeometry(0.005, 8), buttonMat);
        btn.position.set(0, 0.82 + i * 0.06, 0.08);
        avatarGroup.add(btn);
    }

    // Шея
    const skinMat = new THREE.MeshStandardMaterial({ color: 0xf0c0a8, roughness: 0.8 });
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.04, 12), skinMat);
    neck.position.set(0, 1.08, 0);
    avatarGroup.add(neck);

    // ====== Голова ======
    headGroup = new THREE.Group();
    headGroup.position.set(0, 1.1, 0);

    // Основная форма головы
    const headMat = new THREE.MeshStandardMaterial({ color: 0xf0c0a8, roughness: 0.7 });
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.07, 24, 24), headMat);
    head.scale.set(1, 1.15, 0.95);
    headGroup.add(head);

    // Подбородок
    const chin = new THREE.Mesh(new THREE.SphereGeometry(0.04, 16, 16), headMat);
    chin.position.set(0, -0.055, 0.02);
    chin.scale.set(1, 0.5, 0.8);
    headGroup.add(chin);

    // Лоб
    const foreheadMat = new THREE.MeshStandardMaterial({ color: 0xf0c0a8, roughness: 0.7 });
    const forehead = new THREE.Mesh(new THREE.SphereGeometry(0.065, 16, 16), foreheadMat);
    forehead.position.set(0, 0.05, -0.02);
    forehead.scale.set(1, 0.6, 0.8);
    headGroup.add(forehead);

    // ====== Глаза ======
    const eyeMat = new THREE.MeshStandardMaterial({ color: 0xf8f8f8, roughness: 0.2 });
    const irisMat = new THREE.MeshStandardMaterial({ color: 0x4a6741, roughness: 0.1 });
    const pupilMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.0 });

    for (let side = -1; side <= 1; side += 2) {
        // Белок глаза
        const eyeWhite = new THREE.Mesh(new THREE.SphereGeometry(0.025, 16, 16), eyeMat);
        eyeWhite.position.set(side * 0.025, 0.005, 0.072);
        headGroup.add(eyeWhite);

        // Роговица (прозрачная)
        const corneaMat = new THREE.MeshPhysicalMaterial({
            color: 0xffffff, transparent: true, opacity: 0.1,
            roughness: 0.0, metalness: 0.0,
        });
        const cornea = new THREE.Mesh(new THREE.SphereGeometry(0.026, 16, 16), corneaMat);
        cornea.position.set(side * 0.025, 0.005, 0.072);
        headGroup.add(cornea);

        // Радужка
        const iris = new THREE.Mesh(new THREE.CircleGeometry(0.015, 16), irisMat);
        iris.position.set(side * 0.025, 0.005, 0.075);
        headGroup.add(iris);

        // Зрачок
        const pupil = new THREE.Mesh(new THREE.CircleGeometry(0.007, 12), pupilMat);
        pupil.position.set(side * 0.025, 0.005, 0.075);
        headGroup.add(pupil);
    }

    // ====== Веки ======
    const eyelidMat = new THREE.MeshStandardMaterial({
        color: 0xf0c0a8, roughness: 0.8, side: THREE.DoubleSide,
    });
    leftEyelid = new THREE.Mesh(new THREE.PlaneGeometry(0.045, 0.02), eyelidMat);
    leftEyelid.position.set(-0.025, 0.015, 0.073);
    headGroup.add(leftEyelid);

    rightEyelid = new THREE.Mesh(new THREE.PlaneGeometry(0.045, 0.02), eyelidMat);
    rightEyelid.position.set(0.025, 0.015, 0.073);
    headGroup.add(rightEyelid);

    // ====== Брови ======
    const browMat = new THREE.MeshStandardMaterial({
        color: 0x3d2b1f, roughness: 0.9,
    });
    leftBrow = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.003, 0.002), browMat);
    leftBrow.position.set(-0.025, 0.032, 0.074);
    leftBrow.rotation.z = 0.1;
    headGroup.add(leftBrow);

    rightBrow = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.003, 0.002), browMat);
    rightBrow.position.set(0.025, 0.032, 0.074);
    rightBrow.rotation.z = -0.1;
    headGroup.add(rightBrow);

    // ====== Рот ======
    const lipMat = new THREE.MeshStandardMaterial({ color: 0xd44a4a, roughness: 0.4 });
    const lipMat2 = new THREE.MeshStandardMaterial({ color: 0xe06060, roughness: 0.4 });
    
    // Верхняя губа
    const upperLip = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.004, 0.01), lipMat);
    upperLip.position.set(0, -0.02, 0.075);
    headGroup.add(upperLip);

    // Нижняя губа
    const lowerLip = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.004, 0.01), lipMat2);
    lowerLip.position.set(0, -0.027, 0.075);
    headGroup.add(lowerLip);

    // Рот (отверстие)
    jawGroup = new THREE.Group();
    jawGroup.position.set(0, -0.023, 0.075);
    headGroup.add(jawGroup);
    
    mouth = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.002, 0.005),
        new THREE.MeshStandardMaterial({ color: 0x8b3a3a, roughness: 0.5 }));
    mouth.position.set(0, 0, 0);
    jawGroup.add(mouth);

    // ====== Нос ======
    const noseMat = new THREE.MeshStandardMaterial({ color: 0xf0c0a8, roughness: 0.8 });
    const nose = new THREE.Mesh(new THREE.ConeGeometry(0.008, 0.012, 6), noseMat);
    nose.position.set(0, 0.02, 0.08);
    nose.rotation.x = 0.3;
    headGroup.add(nose);

    // ====== Уши ======
    const earMat = new THREE.MeshStandardMaterial({ color: 0xf0c0a8, roughness: 0.8 });
    for (let side = -1; side <= 1; side += 2) {
        const ear = new THREE.Mesh(new THREE.SphereGeometry(0.015, 8, 8), earMat);
        ear.position.set(side * 0.075, -0.01, 0);
        ear.scale.set(1, 0.8, 0.4);
        headGroup.add(ear);
    }

    // ====== Волосы (каре/боб - как у девушки на референсе) ======
    createHair();

    // ====== Сборка ======
    avatarGroup.add(headGroup);

    // Позиция
    avatarGroup.position.set(0, 0, -0.05);
    scene.add(avatarGroup);
}

function createHair() {
    const hairMat = new THREE.MeshStandardMaterial({ color: 0x3d2b1f, roughness: 0.9 });
    const hairMatLight = new THREE.MeshStandardMaterial({ color: 0x4a3728, roughness: 0.9 });

    // Основной объем (короткая стрижка/каре)
    const hairMain = new THREE.Mesh(new THREE.SphereGeometry(0.075, 24, 24, 0, Math.PI*2, 0, Math.PI*0.55), hairMat);
    hairMain.position.set(0, 0.07, -0.01);
    hairMain.scale.set(1.1, 0.5, 1.0);
    headGroup.add(hairMain);

    // Чёлка
    const bangs = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.03, 0.03), hairMat);
    bangs.position.set(0, 0.082, 0.05);
    bangs.rotation.x = -0.4;
    headGroup.add(bangs);

    // Пряди сбоков
    for (let side = -1; side <= 1; side += 2) {
        const strand = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.08, 0.015), hairMatLight);
        strand.position.set(side * 0.075, 0.03, 0);
        strand.rotation.z = side * 0.2;
        headGroup.add(strand);
    }

    // Затылок
    const backHair = new THREE.Mesh(new THREE.SphereGeometry(0.06, 16, 16), hairMat);
    backHair.position.set(0, 0.05, -0.07);
    backHair.scale.set(1, 0.7, 0.8);
    headGroup.add(backHair);
}

// ====== Анимация ======
export function animateAvatar() {
    const delta = clock.getDelta();
    const time = clock.getElapsedTime();

    // Анимация VRM
    if (vrm && isVRMLoaded) {
        vrm.update(delta);
        
        // Поворот головы VRM к лицу
        if (vrm.humanoid) {
            const headRot = vrm.humanoid.getNormalizedBoneNode('head');
            if (headRot) {
                const targetX = avatarState.faceDetected ? avatarState.faceX * 0.3 : Math.sin(time * 0.3) * 0.05;
                const targetY = avatarState.faceDetected ? avatarState.faceY * 0.3 : Math.sin(time * 0.2) * 0.02;
                headRot.rotation.x += (targetY - headRot.rotation.x) * delta * 3;
                headRot.rotation.y += (targetX - headRot.rotation.y) * delta * 3;
            }
        }
        
        // Lip sync для VRM
        if (vrm.blendShapeProxy && avatarState.isSpeaking) {
            const mouthVal = 0.3 + Math.sin(time * 15) * 0.3;
            vrm.blendShapeProxy.setValue('aa', mouthVal);
            vrm.blendShapeProxy.setValue('oh', Math.sin(time * 12) * 0.1);
        } else if (vrm.blendShapeProxy) {
            vrm.blendShapeProxy.setValue('aa', 0);
            vrm.blendShapeProxy.setValue('oh', 0);
        }
        return;
    }

    // Анимация procedural аватара
    if (!avatarGroup) return;

    // Дыхание
    const breath = Math.sin(time * 1.2) * 0.002;
    avatarGroup.position.y = breath;
    avatarGroup.rotation.z = Math.sin(time * 0.6) * 0.001;

    // Поворот головы
    if (headGroup) {
        const targetX = avatarState.faceDetected ? avatarState.faceX * 0.3 : Math.sin(time * 0.3) * 0.05;
        const targetY = avatarState.faceDetected ? avatarState.faceY * 0.3 : Math.sin(time * 0.2) * 0.02;
        
        headGroup.rotation.x += (targetY - headGroup.rotation.x) * delta * 3;
        headGroup.rotation.y += (targetX - headGroup.rotation.y) * delta * 3;
    }

    // Рот (синхронизация с речью)
    if (jawGroup) {
        if (avatarState.isSpeaking) {
            const mouthVal = 0.1 + Math.sin(time * 15) * 0.08;
            jawGroup.position.y = -0.023 - mouthVal * 0.3;
            if (mouth) {
                mouth.scale.y = Math.max(0.3, Math.min(2.5, 1 + mouthVal * 25));
            }
        } else {
            jawGroup.position.y += (-0.023 - jawGroup.position.y) * delta * 10;
            if (mouth) {
                mouth.scale.y += (1 - mouth.scale.y) * delta * 8;
            }
        }
    }

    // Моргание
    avatarState.blinkTimer += delta;
    if (avatarState.blinkTimer > 3 + Math.random() * 4 && !avatarState.isBlinking) {
        avatarState.isBlinking = true;
        avatarState.blinkTimer = 0;
    }
    if (avatarState.isBlinking) {
        const progress = avatarState.blinkTimer * 20;
        if (progress < Math.PI) {
            const blinkScale = Math.abs(Math.cos(progress));
            if (leftEyelid) leftEyelid.scale.y = blinkScale * 0.3;
            if (rightEyelid) rightEyelid.scale.y = blinkScale * 0.3;
        } else {
            avatarState.isBlinking = false;
            if (leftEyelid) leftEyelid.scale.y = 0.3;
            if (rightEyelid) rightEyelid.scale.y = 0.3;
        }
    }
}

// ====== Экспорт ======
export function setSpeaking(val) { avatarState.isSpeaking = val; }
export function setListening(val) { avatarState.isListening = val; }
export function updateFacePosition(x, y) {
    avatarState.faceDetected = true;
    avatarState.faceX = x;
    avatarState.faceY = y;
}
export function resetFacePosition() { avatarState.faceDetected = false; }

// ====== Рендер ======
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
    console.log('3D сцена готова');
}
