function downloadSvg(svgList, fileName) {
    var totalWidth = 0;
    svgList.forEach(svg => {
        totalWidth += svg.width.baseVal.value;
    });
    var averageWidth = totalWidth / svgList.length;
    var maxWidth = Math.max(...svgList.map(svg => svg.width.baseVal.value));

    var imagesLoaded = 0;
    var canvasList = [];

    var ratio = 1;
    svgList.forEach((svg, index) => {
        const localCnt = index; // 为每个索引创建一个局部变量
        const svgString = new XMLSerializer().serializeToString(svg);
        var source = '<?xml version="1.0" standalone="no"?>\r\n' + svgString;

        var image = new Image();
        image.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(source);

        image.onload = function() {
            var canvas = document.createElement('canvas');
            var ctx = canvas.getContext('2d');
            canvas.width = maxWidth;

            var scale = maxWidth / svg.width.baseVal.value;
            canvas.height = svg.height.baseVal.value * scale;
            if (localCnt >= 1) ratio = ratio * 0.5;

            ctx.fillStyle = '#fff';
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            if (svg.width.baseVal.value < averageWidth) {
                // 放大并居中
                ctx.drawImage(image, 0, 0, svg.width.baseVal.value * scale, canvas.height);
            } else {
                // 直接居中
                ctx.drawImage(image, (maxWidth - svg.width.baseVal.value * scale) / 2, 0, svg.width.baseVal.value * scale, canvas.height);
            }

            canvasList.push(canvas);
            imagesLoaded++;

            if (imagesLoaded === svgList.length) {
                combineCanvases(canvasList, fileName);
            }
        };
    });
}

function combineCanvases(canvasList, fileName) {
    var totalHeight = canvasList.reduce((sum, canvas) => sum + canvas.height, 0);
    var maxWidth = Math.max(...canvasList.map(canvas => canvas.width));

    var finalCanvas = document.createElement('canvas');
    finalCanvas.width = maxWidth;
    finalCanvas.height = totalHeight;
    var ctx = finalCanvas.getContext('2d');

    var currentY = 0;
    canvasList.forEach(canvas => {
        ctx.drawImage(canvas, 0, currentY, canvas.width, canvas.height);
        currentY += canvas.height;
    });

    var imgSrc = finalCanvas.toDataURL("image/png");

    downloadFile(fileName, dataURLtoBlob(imgSrc));
}

function downloadFile(fileName, blob) {
    var a = document.createElement('a');
    var url = window.URL.createObjectURL(blob);
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    setTimeout(function() {
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
    }, 0);
}

function dataURLtoBlob(dataurl) {
    var arr = dataurl.split(','), mime = arr[0].match(/:(.*?);/)[1],
        bstr = atob(arr[1]), n = bstr.length, u8arr = new Uint8Array(n);
    while(n--){
        u8arr[n] = bstr.charCodeAt(n);
    }
    return new Blob([u8arr], {type:mime});
}


function getZoomSvg(svgIdName, groupIdName) {
    var svg = d3.select(svgIdName).node();
    //得到svg的真实大小
    var box = svg.getBBox(),
        x = box.x,
        y = box.y,
        width = box.width,
        height = box.height;
    if(groupIdName) {
        //查找group
        var group = d3.select(groupIdName).node();
        if(!group) {
            alert('svg中group不存在');
            return false;
        }
        /* 这里是处理svg缩放的 */
        var transformObj = group.getAttribute('transform');
        if(transformObj) {
            /* 下面捕获由d3.event自动引起的svg移动 */
            var translateObj = transformObj.match(/translate\((\d+\.?\d*) (\d+\.?\d*)\)/),
                scaleObj = transformObj.match(/scale\((\d+(\.\d+)?)(?:\s+|\s*,\s*)(\d+(\.\d+)?)\)/);
            if(translateObj && scaleObj) {               // 匹配到平移和缩放
                var translateX = translateObj[1],
                    translateY = translateObj[2],
                    scale = scaleObj[1];
                x = (box.x - translateX) / scale;
                y = (box.y - translateY) / scale;
                width = box.width / scale;
                height = box.height / scale;
            }
            /* 下面捕获初始时手动设置的translate */
            var translateManual = transformObj.match(/translate\(([^,]+),\s*([^\)]+)\)/);
            if (translateManual) {                      // 如果svg的移动不单靠d3.event捕获的，初始时也有一个手动translate，需要将它捕获并减掉
                x = x - parseFloat(translateManual[1]);
                y = y - parseFloat(translateManual[2]);
            }
        }
    }
    //克隆svg
    var cloneSvg = svg.cloneNode(true);
    //重新设置svg的width,height,viewbox
    cloneSvg.setAttribute('width', width);
    cloneSvg.setAttribute('height', height);
    cloneSvg.setAttribute('viewBox', [x, y, width, height]);
    if(group) {
        var cloneGroup = cloneSvg.getElementById(groupIdName.replace(/\#/g, ''));
        /*------清楚缩放元素的缩放--------*/
        cloneGroup.setAttribute('transform', 'translate(0,0) scale(1)');
    }
    return cloneSvg;
}

async function fetchFontAsBase64(url) {
    const response = await fetch(url);
    const blob = await response.blob();
    
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
}


function combineAndDownloadSVG(svgDataArray, fileName) {
// 嵌入 Base64 字体
fetchFontAsBase64('/src/css/font/ArchivoNarrow-Regular.ttf').then(base64Font => {
        // 创建一个新的 SVG 容器并开始拼接
    let yOffset = 0; // 用于累积每个 SVG 的 Y 轴偏移
    let combinedHeight = 0; // 用于计算所有 SVG 合并后的总高度
    let maxSvgWidth = 0; // 用于计算所有 SVG 中的最大宽度
    let combinedSvgContent = `
        <svg xmlns="http://www.w3.org/2000/svg" width="###WIDTH###" height="###HEIGHT###" viewBox="0 0 ###WIDTH### ###HEIGHT###">
            <style type="text/css">
                @font-face {
                    font-family: 'Archivo Narrow';
                    src: url('${base64Font}') format('truetype');
                }
                text {
                    font-family: 'Archivo Narrow';
                }
            </style>
    `;

    // 遍历所有 SVG 数据，依次拼接并平移
    svgDataArray.forEach((data, index) => {
        // 从 SVG 数据中提取宽度和高度
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = data;
        const svgElement = tempDiv.querySelector('svg');

        // 获取当前 SVG 的高度
        const svgHeight = svgElement.getAttribute('height');
        const svgWidth = svgElement.getAttribute('width');
        maxSvgWidth = Math.max(maxSvgWidth, parseFloat(svgWidth));

        // 添加到组合的 SVG 并平移
        combinedSvgContent += `
            <g id="svgGroup${index}" transform="translate(0, ${yOffset})">
                ${data}
            </g>
        `;
        
        // 更新 Y 轴的偏移量
        yOffset += parseFloat(svgHeight);
        combinedHeight += parseFloat(svgHeight);
    });

    // 闭合 SVG 标签，并将计算后的总高度应用到 SVG 的 viewBox 和高度属性中
    combinedSvgContent += `</svg>`;
    combinedSvgContent = combinedSvgContent.replace('###HEIGHT###', combinedHeight);
    combinedSvgContent = combinedSvgContent.replace('###WIDTH###', maxSvgWidth);
        
    // 转换为 Blob 并下载
    const blob = new Blob([combinedSvgContent], { type: 'image/svg+xml;charset=utf-8' });
    downloadFile(fileName, blob);

    if (baseURL && relativePath) {
        uploadBlob(blob, fileName);
    }
})
}


function uploadBlob(blob, fileName) {
    const formData = new FormData();
    formData.append('file', blob, fileName);

    fetch(baseURL + relativePath, {
        method: 'POST',
        body: formData
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            console.log('GIF uploaded successfully:', data.destination);
            // downloadExistingGif()
        } else {
            console.error('GIF upload failed:', data);
        }
    })
    .catch(error => {
        console.error('Error uploading GIF:', error);
    });
}
