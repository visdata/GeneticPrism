// 全局变量
let topics;
// 初始化 Three.js 场景
let scene, camera, renderer, controls, materials, prism;
// 缓存 GIF Blob
let gifLabel, gifProgressBar;
let cachedGifBlob = null;
let fps = 12; // 每秒帧数
let delay = 1000 / fps; // 每帧间隔时间
let windowWidth = 900, windowHeight = 900;
let baseURL = 'https://n.genetic-flow.com'
let relativePath = '/gallery/GFVis'
let transparentOpacity = 0.8;
let chordElement = null;


// 生成随机 SVG 的函数
function init_svg(width, height, topic) {
    const svgNS = "http://www.w3.org/2000/svg";
    const svgElement = document.createElementNS(svgNS, "svg");
    svgElement.setAttribute("xmlns", svgNS);
    svgElement.setAttribute("width", width);
    svgElement.setAttribute("height", height);

    // 背景矩形
    const rect = document.createElementNS(svgNS, "rect");
    const { h, s, v } = topic.color;
    rect.setAttribute("x", 0);
    rect.setAttribute("y", 0);
    rect.setAttribute("width", width);
    rect.setAttribute("height", height);
    rect.setAttribute("fill", d3.hsv(h, 0.05, 1));
    svgElement.appendChild(rect);

    // 主题名称文本
    const textElement = document.createElementNS(svgNS, "text");
    textElement.setAttribute("x", width / 2);
    textElement.setAttribute("y", 50);
    textElement.setAttribute("text-anchor", "middle");
    textElement.setAttribute("dominant-baseline", "text-before-edge");
    textElement.setAttribute("font-size", `${Math.sqrt(width * height) * 0.06}px`);
    textElement.setAttribute("fill", "black");
    textElement.setAttribute("font-family", "Archivo Narrow");
    textElement.setAttribute("id", "title");

    const shortNameParts = topic.shortName.split(' ');
    if (shortNameParts.length >= 2) {
        const tspan1 = document.createElementNS(svgNS, "tspan");
        tspan1.setAttribute("x", width / 2);
        tspan1.setAttribute("dy", "0em");
        tspan1.textContent = shortNameParts[0];
        textElement.appendChild(tspan1);

        const tspan2 = document.createElementNS(svgNS, "tspan");
        tspan2.setAttribute("x", width / 2);
        tspan2.setAttribute("dy", "1em");
        tspan2.textContent = shortNameParts[1];
        textElement.appendChild(tspan2);
    } else {
        textElement.textContent = topic.shortName;
    }

    svgElement.appendChild(textElement);

    let graph = topic2graph[topic.id];
    graph['width'] = width / 72;
    graph['height'] = (height - 50) / 72;
    init_graph(graph, false);

    // 使用 D3 选择 svgElement 并附加子 SVG
    const svg = d3.select(svgElement)
        .append("svg")
        .style("overflow", "visible")
        .attr('id', `svg-${topic.id}`)
        .attr("y", 50)
        .attr("width", width)
        .attr("height", height - 50)
        .attr("viewBox", graph['viewBox'])
        // .attr("transform", graph['transform']);

    Array.from(graph['svg'].childNodes).forEach(node => {
        svg.node().appendChild(node.cloneNode(true));
    });

    return svgElement;
}


// 获取随机颜色的函数
function getRandomColor() {
    const letters = '89ABCDEF';
    let color = '#';
    for (let i = 0; i < 6; i++) {
        color += letters[Math.floor(Math.random() * letters.length)];
    }
    return color;
}


// 创建自定义棱柱的函数
function createCustomPrism(topics, radius, height) {
    console.log('topics', topics);
    // const totalSize = d3.sum(topics, d => d.size);
    const totalSize = d3.sum(weights);
    // const angles = topics.map(topic => (topic.size / totalSize) * Math.PI * 2); // 角度（弧度）
    const angles = weights.map((weight) => (weight / totalSize) * Math.PI * 2); // 角度（弧度）

    // 用于存储几何体数据的数组
    const positions = [];
    const indices = [];
    const uvs = [];
    const groups = [];

    let currentAngle = 0;
    let vertexCount = 0;
    let indexCount = 0;

    // 构建棱柱侧面
    for (let i = 0; i < topics.length; i++) {
        const angle = angles[i];
        const nextAngle = currentAngle + angle;

        // 计算顶点位置
        const x0 = Math.cos(currentAngle) * radius;
        const z0 = Math.sin(currentAngle) * radius;
        const x1 = Math.cos(nextAngle) * radius;
        const z1 = Math.sin(nextAngle) * radius;

        // 顶部顶点
        positions.push(x0, height / 2, z0); // v0
        positions.push(x1, height / 2, z1); // v1

        // 底部顶点
        positions.push(x0, -height / 2, z0); // v2
        positions.push(x1, -height / 2, z1); // v3

        // 侧面两个三角形的索引
        indices.push(
            vertexCount, vertexCount + 2, vertexCount + 1,
            vertexCount + 1, vertexCount + 2, vertexCount + 3
        );

        // UV 坐标（镜像翻转以确保纹理正确显示）
        uvs.push(
            1, 1,
            0, 1,
            1, 0,
            0, 0
        );

        // 添加组以支持多材质
        groups.push({
            start: indexCount,
            count: 6,  // 每个侧面有 6 个索引
            materialIndex: i
        });

        // 更新 currentAngle 和计数器
        currentAngle = nextAngle;
        vertexCount += 4; // 每个面添加 4 个顶点
        indexCount += 6;  // 每个面添加 6 个索引
    }

    // 添加顶面和底面的四个角顶点
    const topLeftIndex = vertexCount; // 顶面左上角
    const topRightIndex = vertexCount + 1; // 顶面右上角
    const bottomLeftIndex = vertexCount + 2; // 顶面左下角
    const bottomRightIndex = vertexCount + 3; // 顶面右下角

    const bottomTopLeftIndex = vertexCount + 4; // 底面左上角
    const bottomTopRightIndex = vertexCount + 5; // 底面右上角
    const bottomBottomLeftIndex = vertexCount + 6; // 底面左下角
    const bottomBottomRightIndex = vertexCount + 7; // 底面右下角

    // 添加顶面四个角的位置
    positions.push(
        -radius, height / 2, -radius, // 左上角
        radius, height / 2, -radius, // 右上角
        -radius, height / 2, radius, // 左下角
        radius, height / 2, radius // 右下角
    );

    // 添加底面四个角的位置
    positions.push(
        -radius, -height / 2, -radius, // 左上角
        radius, -height / 2, -radius, // 右上角
        -radius, -height / 2, radius, // 左下角
        radius, -height / 2, radius // 右下角
    );

    // 顶面UV坐标（顺时针旋转90度）
    uvs.push(
        1, 0, // 左上角 -> 右上角
        1, 1, // 右上角 -> 右下角
        0, 0, // 左下角 -> 左上角
        0, 1  // 右下角 -> 左下角
    );

    // 底面UV坐标（顺时针旋转90度）
    uvs.push(
        1, 0, // 左上角 -> 右上角
        1, 1, // 右上角 -> 右下角
        0, 0, // 左下角 -> 左上角
        0, 1  // 右下角 -> 左下角
    );

    // 顶面索引
    indices.push(
        topLeftIndex, topRightIndex, bottomLeftIndex,
        topRightIndex, bottomRightIndex, bottomLeftIndex
    );
    indexCount += 6;

    // 底面索引
    indices.push(
        bottomTopLeftIndex, bottomTopRightIndex, bottomBottomLeftIndex,
        bottomTopRightIndex, bottomBottomRightIndex, bottomBottomLeftIndex
    );
    indexCount += 6;

    // 为顶面创建材质组
    groups.push({
        start: indexCount - 12,
        count: 6,  // 顶面总索引数
        materialIndex: topics.length // 顶面材质索引
    });

    // 为底面创建材质组
    groups.push({
        start: indexCount - 6,
        count: 6,  // 底面总索引数
        materialIndex: topics.length + 1 // 底面材质索引
    });

    // 创建 BufferGeometry
    const geometry = new THREE.BufferGeometry();

    // 设置属性
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geometry.setIndex(indices);

    // 添加组以支持多材质
    groups.forEach(group => {
        geometry.addGroup(group.start, group.count, group.materialIndex);
    });

    // 计算法线
    geometry.computeVertexNormals();

    return geometry;
}


// 创建棱柱和顶面、底面的函数
function createPrism(topics) {
    const geometry = createCustomPrism(topics, prismRadius, prismHeight);

    // 使用几何体和材质创建棱柱
    prism = new THREE.Mesh(geometry, materials);
    // 应该设置相机的位置和朝向而不是棱柱的朝向
    // prism.rotation.x = 20 * Math.PI / 180;

    // 添加棱柱到场景中
    scene.add(prism);

    // 更新控件的目标位置
    controls.target.set(0, 0, 0);
    controls.update();

    // 开始渲染循环
    animate();
    document.getElementById('loading').style.display = 'none';
    checkGifExistence();
}

let lastTime = null; // 初始化为 null

function animate(time) {
    requestAnimationFrame(animate);
    let rotationAngle = Math.PI / 180 * rotationSpeed;  // 每帧旋转的弧度
    let totalFrames = 360 / rotationSpeed; // 总帧数

    // 如果 lastTime 为空，则初始化为当前时间
    if (lastTime === null) {
        lastTime = time;
    }

    // 计算时间间隔（以秒为单位）
    const deltaTime = (time - lastTime) / 1000 || 0;
    lastTime = time;

    // 根据时间间隔调整旋转速度
    if (isRotating) {
        prism.rotation.y = (prism.rotation.y + rotationAngle * deltaTime * 5) % (2 * Math.PI);
    }
    // 射线检测
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
    const intersects = raycaster.intersectObject(prism);

    if (intersects.length > 0) {
        const faceIndex = intersects[0].face.materialIndex;
        materials.forEach((material, index) => {
            currentIndex = index;
            // 顶面和底面的材质（假设最后两个材质是顶面和底面）
            if (index === materials.length - 1 || index === materials.length - 2) {
                material.opacity = index === faceIndex? 1: transparentOpacity;
                material.transparent = true;
                material.depthWrite = false;
            } else if (index === faceIndex) {
                material.opacity = 1;
                material.transparent = true;
                material.depthWrite = true;
            } else {
                material.opacity = transparentOpacity;
                material.transparent = true;
                material.depthWrite = false;
            }
        });
    }

    controls.update();  // 更新控件
    renderer.render(scene, camera);  // 渲染场景
}


function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();

    renderer.setSize(window.innerWidth, window.innerHeight);
}

function downloadExistingGif() {
    const timestamp = new Date().getTime(); // 获取当前时间戳
    const link = document.createElement('a');
    link.href = `${baseURL}${relativePath}/${getFilename()}?download=true&timestamp=${timestamp}`;
    // https://n.genetic-flow.com/gallery/GFVis/fellowV3-2104401652.gif?download=true&timestamp=123456789
    // 添加时间戳来防止缓存
    link.download = `${authorName}.gif`;
    link.click();
}


// function downloadExistingGif() {
//     fetch(url)
//         .then(response => {
//             if (!response.ok) {
//                 throw new Error('Network response was not ok');
//             }
//             return response.blob();
//         })
//         .then(blob => {
//             const link = document.createElement('a');
//             const objectURL = URL.createObjectURL(blob);
//             link.href = objectURL;
//             link.download = `${authorName}.gif`;
//             link.click();
//             URL.revokeObjectURL(objectURL); // 释放URL对象
//         })
//         .catch(error => {
//             console.error('There was a problem with the fetch operation:', error);
//         });
// }

function createTagCloudCanvas() {
    // 创建一个 canvas 元素
    const tagCloud = document.getElementById('tagcloud');
    const tagCloudCanvas = document.createElement("canvas");
    const tagCloudCtx = tagCloudCanvas.getContext("2d");
    // 设置 canvas 尺寸，通常可以根据外部容器尺寸来设置

    const wordHeight = 30;
    tagCloudCanvas.width = tagCloud.getBoundingClientRect().width;
    tagCloudCanvas.height = tagCloud.getBoundingClientRect().height + wordHeight;
    tagCloudCtx.fillStyle = "white"; // 设置背景颜色
    tagCloudCtx.fillRect(0, 0, tagCloudCanvas.width, tagCloudCanvas.height); // 填充整个 canvas
    tagCloudCtx.font = "36px Archivo Narrow";
    tagCloudCtx.fillStyle = "black";
    tagCloudCtx.textAlign = "center";  // 设置水平居中
    tagCloudCtx.textBaseline = "middle";  // 设置垂直居中
    tagCloudCtx.fillText(`made by genetic-flow.com`, tagCloudCanvas.width / 2, tagCloudCanvas.height - 20);

    // 绘制矩形和文本
    wordPosition.forEach(wordGroup => {
        wordGroup.forEach(word => {
            // 绘制矩形
            tagCloudCtx.fillStyle = topic2color(word.id); // 设置填充颜色
            tagCloudCtx.globalAlpha = 0.8; // 设置矩形透明度
            // tagCloudCtx.fillRect(word.x, word.y, word.width, word.height);

            const cornerRadius = 6 * word.ratio; // 计算圆角半径
            tagCloudCtx.beginPath();
            tagCloudCtx.moveTo(word.x + cornerRadius, word.y); // 左上角
            tagCloudCtx.arcTo(word.x + word.width, word.y, word.x + word.width, word.y + word.height, cornerRadius); // 右上角
            tagCloudCtx.arcTo(word.x + word.width, word.y + word.height, word.x, word.y + word.height, cornerRadius); // 右下角
            tagCloudCtx.arcTo(word.x, word.y + word.height, word.x, word.y, cornerRadius); // 左下角
            tagCloudCtx.arcTo(word.x, word.y, word.x + cornerRadius, word.y, cornerRadius); // 左上角
            tagCloudCtx.closePath();
            tagCloudCtx.fill(); // 填充矩形

            tagCloudCtx.font = `${word.size}px Archivo Narrow`; // 设置字体和大小
            tagCloudCtx.fillStyle = "black";
            tagCloudCtx.textAlign = "center";  // 设置水平居中
            tagCloudCtx.textBaseline = "middle";  // 设置垂直居中
            tagCloudCtx.fillText(word.shortName, word.x + word.width * 0.5, word.y + word.height / 2);
        });
    });
    return tagCloudCanvas;
}

function generateGifFromRotation(upload = false) {
    console.log('generateGifFromRotation');
    Array.from(document.getElementsByClassName('gif-progress')).forEach(el => el.style.display = 'block');

    const gif = new GIF({
        workers: 8,
        quality: 10,
        workerScript: '/src/js/gif.worker.js'
    });

    const tagCloudCanvas = createTagCloudCanvas();
    const tagCloudHeight = tagCloudCanvas.height;

    // 创建一个隐藏的 canvas 作为截图画布
    const screenshotCanvas = document.createElement("canvas");
    screenshotCanvas.width = windowWidth;
    screenshotCanvas.height = windowHeight + tagCloudHeight;
    const context = screenshotCanvas.getContext("2d");

    if (!context) {
        console.error("无法获取 2D 上下文，请检查 canvas 初始化。");
        return;
    }

    let frameCount = 0;
    let startTime = Date.now();

    gif.on('progress', function (progress) {
        const gifProgressPercent = (progress * 100).toFixed(2);
        const elapsedTime = (Date.now() - startTime) / 1000;
        const gifEta = ((elapsedTime / progress) * (1 - progress)).toFixed(1);
        gifProgressBar.value = gifProgressPercent;
        gifLabel.innerText = `Create GIF: ${gifProgressPercent}% ETA: ${gifEta}s`;
    });

    gif.on('finished', function (blob) {
        const elapsedTime = ((Date.now() - startTime) / 1000).toFixed(1);
        gifLabel.innerText = `Create GIF: 100% TIME: ${elapsedTime}s`;

        cachedGifBlob = blob;
        const link = document.createElement('a');
        const objectURL = URL.createObjectURL(cachedGifBlob);
        link.href = objectURL;
        // link.download = `${authorName}.gif`;
        link.download = getFilename();
        link.click();
        URL.revokeObjectURL(objectURL);

        if (upload) uploadBlob(blob, getFilename());
    });

    function captureFrame() {
        renderer.render(scene, camera);

        context.drawImage(renderer.domElement, 0, 0);

        // 添加文本到画布顶部
        context.font = "48px Archivo Narrow";
        context.fillStyle = "black";
        context.textAlign = "center";

        // 在第一行写入 authorName
        context.fillText(`${authorName}`, screenshotCanvas.width / 2, 45);

        // 设置第二行字体大小为 36px
        context.font = "36px Archivo Narrow";
        context.fillText(`(${config.name})`, screenshotCanvas.width / 2, 90);
        context.drawImage(tagCloudCanvas, 0, screenshotCanvas.height - tagCloudHeight);
        const dataURL = screenshotCanvas.toDataURL("image/png");

        const img = new Image();
        img.src = dataURL;
        let speed = rotationSpeed / 3;
        let lastRotation = prism.rotation.y;

        img.onload = () => {
            gif.addFrame(img, { delay: delay });

            const frameProgressPercent = ((frameCount + 1) / (360 / speed) * 100).toFixed(2);
            const elapsedTime = (Date.now() - startTime) / 1000;
            const frameEta = ((elapsedTime / (frameCount + 1)) * ((360 / speed) - frameCount - 1)).toFixed(1);
            gifProgressBar.value = frameProgressPercent;
            gifLabel.innerText = `Add Frame: ${frameProgressPercent}% ETA: ${frameEta}s`;
            
            lastRotation += Math.PI / 180 * speed;
            // console.log('lastRotation', lastRotation)
            prism.rotation.y = lastRotation;
            
            frameCount++;
            // if (frameCount < 360 / speed) {
            if (lastRotation < 2 * Math.PI - 0.05) {
                requestAnimationFrame(captureFrame);
            } else {
                gif.render();
            }
        };

        img.onerror = () => {
            console.error("Failed to load the image for GIF frame.");
        };
    }

    prism.rotation.y = 0;
    captureFrame();
}


// 检测 GIF 文件是否已存在
function checkGifExistence() {
    if (download == 0) return;
    if (download == 1 || download == 3) {
        if (node_prob !== -1 || edge_prob !== -1) {
            // 如果是存在参数调整，直接生成 GIF，不上传
            generateGifFromRotation(false);
        } else 
        fetch(`${baseURL}${relativePath}/${getFilename()}`, { method: 'HEAD' })
        .then(response => {
            if (response.status === 404) generateGifFromRotation(true)
            else downloadExistingGif();
        })
    }
    if (download == 1 || download == 2) saveall()
    $("#mainsvg").hide();
    $("#prismWebGL").show();
    rotationSpeed = defaultRotationSpeed;
    // .catch(error => {
    //     console.error('Error checking GIF existence:', error);
    // });
}

async function svgElementToTexture(svgElement) {
    return new Promise((resolve) => {
        const svgData = new XMLSerializer().serializeToString(svgElement);
        const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
        const url = URL.createObjectURL(svgBlob);

        const image = new Image();
        image.src = url;

        image.onload = function () {
            const texture = new THREE.Texture(image);
            texture.needsUpdate = true;
            resolve(texture); // 当纹理加载完成时，返回该纹理
            URL.revokeObjectURL(url);
        };
    });
}

async function loadTextures(topics) {
    materials = [];
    let texturesLoaded = 0;
    const totalSize = d3.sum(weights);

    // 等待所有纹理加载完成
    for (let i = 0; i < topics.length; i++) {
        const topic = topics[i];

        // 计算每个平面的宽度和高度
        const theta = (weights[i] / totalSize) * 2 * Math.PI;
        const width = 2 * prismRadius * Math.sin(theta / 2);

        // 调用 init_svg 生成 SVG
        const svgElement = init_svg(width, prismHeight, topic);

        // 将 SVG 转换为纹理并同步加载
        const texture = await svgElementToTexture(svgElement);
        const material = new THREE.MeshBasicMaterial({
            map: texture,
            side: THREE.DoubleSide,
            opacity: transparentOpacity,
            transparent: true,
            depthWrite: false
        });
        materials.push(material);
        texturesLoaded++;

        // 如果所有纹理都加载完成，处理顶面和底面材质
        if (texturesLoaded === topics.length) {
            const topMaterial = await svgElementToTexture(chordElement).then((texture) => {
                return new THREE.MeshBasicMaterial({
                    map: texture,
                    side: THREE.DoubleSide,
                    opacity: transparentOpacity,
                    transparent: true,
                    depthWrite: false
                });
            });

            const bottomMaterial = await svgElementToTexture(chordElement).then((texture) => {
                return new THREE.MeshBasicMaterial({
                    map: texture,
                    side: THREE.DoubleSide,
                    opacity: transparentOpacity,
                    transparent: true,
                    depthWrite: false
                });
            });

            materials.push(topMaterial, bottomMaterial);
            console.log('materials', materials);

            // 所有纹理加载完成，创建棱柱网格
            createPrism(topics);
        }
    }
}

function isTestEnv() {
    return fetch('/src/.test')
    .then(response => {
        return response.ok;
    })
    .catch(error => {
        return true
    });
}

function drawPrism(topics) {
    $('#prismWebGL').empty();
    // 将现有的 Three.js 元素删除
    if (scene) {
        renderer.dispose();
        controls.dispose();
    }

    isTestEnv().then(isTest => {
        if(isTest) {
            relativePath = '/gallery/GFVis_test'
            defaultRotationSpeed = 7;

            let size = '700px';
            $('#draw-area').css({
                'width': size,
                'height': size
            });
            $('#prismWebGL').css({
                'width': size,
                'height': size
            });
            drawPrismFunc(topics);
            gifProgressBar.style.width = size;
        } else {
            defaultRotationSpeed = 5;
            drawPrismFunc(topics);
        }
    })
}


// 入口点函数
function drawPrismFunc(topics) {
    let prism = document.getElementById('prismWebGL') || document.body;
    windowWidth = prism.clientWidth;
    windowHeight = prism.clientHeight;
    console.log('windowWidth', windowWidth, 'windowHeight', windowHeight)
    console.log('topics', topics)

    // <div id="loading" style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); font-size: 24px; color: #333; color: white; display: none;">Loading...</div>
    const loading = document.createElement('div');
    loading.id = 'loading';
    loading.style.position = 'absolute';
    loading.style.top = '50%';
    loading.style.left = '50%';
    loading.style.transform = 'translate(-50%, -50%)';
    loading.style.fontSize = '24px';
    loading.style.color = '#333';
    loading.style.color = 'white';
    loading.style.display = 'block';
    loading.innerText = 'Loading...';
    prism.appendChild(loading);
    let sizeSum = topics.reduce((sum, topic) => sum + topic.size, 0);
    // prismRadius = 500 * Math.sqrt(sizeSum / 100); // 将原始半径比例调整为总size的相对值
    prismHeight = 750;

    let { rowSums: outdegree, colSums: indegree } = sumRowsAndColumns(adjacentMatrix);
    weights = adjustWeight(outdegree);
    chordElement = init_chord(true);
    console.log('[drawPrism]chordElement', weights, global_paper_field.map(d => d.size))

    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(
        45, windowWidth / windowHeight, 1, 10000
    );
    // camera.position.set(0, 0, 2000);
    const distance = 1400; // 距离原点的距离
    let tiltAngle = 25;
    const angle = tiltAngle * Math.PI / 180; // 20度的倾斜角

    // 计算相机的位置
    const x = distance * Math.sin(angle);
    const y = distance * Math.sin(angle);
    const z = distance * Math.cos(angle);

    // 设置相机的位置和朝向
    camera.position.set(x, y, z);
    camera.lookAt(0, 0, 0);

    const container = document.getElementById('prismWebGL');
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setClearColor(0xffffff);
    renderer.setSize(windowWidth, windowHeight);
    container.appendChild(renderer.domElement); // 将 canvas 添加到 div 中

    controls = new THREE.OrbitControls(camera, renderer.domElement);

    // 设置光源
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight.position.set(0, 1, 1).normalize();
    scene.add(directionalLight);

    // 添加环境光
    const ambientLight = new THREE.AmbientLight(0x404040, 0.5); // 柔和的环境光
    scene.add(ambientLight);

    // 自定义鼠标按钮
    controls.mouseButtons = {
        LEFT: THREE.MOUSE.ROTATE,   // 左键旋转
        MIDDLE: THREE.MOUSE.DOLLY,  // 中键缩放
        RIGHT: THREE.MOUSE.PAN      // 右键平移
    };

    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.rotateSpeed = 0.5;
    controls.zoomSpeed = 1.2;
    controls.panSpeed = 0.8;
    loadTextures(topics);
    
    // Create a label for the slider
    const rotationLabel = document.createElement('label');
    rotationLabel.innerText = 'Speed: ';
    rotationLabel.style.position = 'absolute';
    rotationLabel.style.top = '10px';
    rotationLabel.style.left = '10px';

    // Create the rotation speed slider
    const rotationSlider = document.createElement('input');
    rotationSlider.type = 'range';
    rotationSlider.min = '0';
    rotationSlider.max = '10';
    rotationSlider.value = defaultRotationSpeed; // Default rotation speed
    rotationSlider.style.position = 'absolute';
    rotationSlider.style.top = '15px';
    rotationSlider.style.left = '100px';
    rotationSlider.style.padding = '2px';
    rotationSlider.style.width = '150px';

    const rotationValue = document.createElement('span');
    rotationValue.innerText = defaultRotationSpeed;
    rotationValue.style.position = 'absolute';
    rotationValue.style.top = '10px';
    rotationValue.style.left = '260px';

    // Append the slider and label to the prism
    prism.appendChild(rotationSlider);
    prism.appendChild(rotationLabel);
    prism.appendChild(rotationValue);

    // Adjust rotationSpeed based on slider value
    rotationSlider.addEventListener('input', () => {
        rotationSpeed = parseFloat(rotationSlider.value);
        rotationValue.innerText = rotationSpeed;
    });

    // 添加帧进度条标签
    gifLabel = document.createElement('div');
    gifLabel.setAttribute('class', 'gif-progress');
    gifLabel.innerText = 'Add Frame: 0% ETA: --s';
    gifLabel.style.position = 'absolute';
    gifLabel.style.top = '10px';
    gifLabel.style.left = '300px';
    gifLabel.style.width = '300px';
    gifLabel.style.display = 'none'; // 默认不显示
    prism.appendChild(gifLabel);

    // 添加帧进度条
    gifProgressBar = document.createElement('progress');
    gifProgressBar.setAttribute('class', 'gif-progress');
    gifProgressBar.style.position = 'absolute';
    gifProgressBar.style.top = '-5px';
    gifProgressBar.style.left = '0px';
    gifProgressBar.style.width = '900px';
    gifProgressBar.max = 100;
    gifProgressBar.value = 0;
    gifProgressBar.style.display = 'none'; // 默认不显示
    prism.appendChild(gifProgressBar);

    isRotating = true; // 用于控制旋转的状态
    draw_tagcloud()
    return prism;
}