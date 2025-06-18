// global variable (STopic == null)
let toolboxHidden = true, showtag=true, showtagcloud=true, showglobalstream=false;
let hideBackground = false,fullsize=false;
// right virtual edge to the same year
let rightVirtualEdgeDict = {
    '2225733586': {1: ['2145655652']}
}

// subgraph variable (global / subgraph, the graph to render)


let svgWidth, svgHeight;
let contextEdgeWeight = 5;
let minCircleSize = 6;

let visType;
let adjacent_ids = [];
let extend_ids = [];
let lastMouseX, lastMouseY; // 上一个鼠标X坐标
let y_focus = 0.5;
let highlighted = [];

let arrangement = [], adjacentMatrix;
let originalCost, bestCost;
let bbox_padding_x=0, bbox_padding_y=50;
// let bbox_padding_x=10, bbox_padding_y=100;
let yearGrid = 2, alpha = 10;
let virtualOpacity = 0.3;
let topicOpacity = 0.25;


let isDetail = false;
let highlightOpacity = 1;
let backgroundOpacity = highlightOpacity * 2 / 3;
let polygenView = false;
let contextEdgeColor = 'lightblue';

// 在函数外部缓存选择结果

let chord_arcs = d3.selectAll(".chord-arc");
let chord_ribbons = d3.selectAll(".chord-ribbon");
let index2chord_element = {};
let activeArea=null;
let Tooltip, tip;

const bookPaths = [
    "M7839 2240c-925,-5 -2039,107 -2730,790l0 4524c695,-556 1874,-651 2730,-642l0 -4672z",
    "M2161 2240l0 4672c950,-10 1934,71 2730,642l0 -4524c-691,-683 -1806,-795 -2730,-790z",
    "M2052 7132c-60,0 -109,-49 -109,-110l0 -3905 -421 60 17 4469c1041,-233 2267,-363 3261,112 -765,-557 -1826,-674 -2748,-626z",
    "M8478 3200l-421 -77 0 3899c0,61 -49,110 -109,110 -908,-47 -2004,71 -2752,628 994,-469 2245,-315 3282,-79l0 -4481z"
];
const bookWidth = 10000;
const bookHeight = 12500;

const tanh = x => Math.tanh(x);
const sech2 = x => 1 / (Math.cosh(x) ** 2);
const inverse = r => Math.sign(r) * Math.acosh(0.5 * r * r + 1);

function update_chord_element() {
    chord_arcs = d3.selectAll(".chord-arc");
    chord_ribbons = d3.selectAll(".chord-ribbon");
    index2chord_element = {};
    chord_arcs.each(function() {
        const element = d3.select(this);
        const classes = element.attr("class").split(" ");
        classes.forEach(cls => {
            if (cls.startsWith('chord-arc-')) {
                const index = cls.split('-').pop();
                if (!index2chord_element[index]) {
                    index2chord_element[index] = [];
                }
                index2chord_element[index].push(element);
            }
        });
    });
    
    chord_ribbons.each(function() {
        const element = d3.select(this);
        const classes = element.attr("class").split(" ");
        classes.forEach(cls => {
            if (cls.startsWith('chord-ribbon-from-') || cls.startsWith('chord-ribbon-to-')) {
                const index = cls.split('-').pop();
                if (!index2chord_element[index]) {
                    index2chord_element[index] = [];
                }
                index2chord_element[index].push(element);
            }
        });
    });
}

function guidence() {
    if (!localStorage.getItem('guidanceShown')) {
        document.getElementById('overlay').style.display = 'block';
        document.getElementById('info').classList.add('highlight');
        document.getElementById('info-text').style.display = 'inline';

        document.getElementById('overlay').addEventListener('click', function() {
            this.style.display = 'none';
            document.getElementById('info').classList.remove('highlight');
            document.getElementById('info-text').style.display = 'none';

            // 在localStorage中设置标记
            localStorage.setItem('guidanceShown', 'true');
        });
    }
};

function checkScreenSize() {
    if (window.innerWidth <= 800) {
        document.getElementById('screen-size-warning').style.display = 'block';
    } else {
        document.getElementById('screen-size-warning').style.display = 'none';
    }
}

function addAllListeners() {
    $("#topic-slider").change(function () {
        var topic_r = $("#topic-slider").val();
        d3.selectAll(".topic-map")
            .transition()
            .duration(300)
            .attr("r", d => Math.sqrt(d.num) * 10 * topic_r);
        $("#topic-label").text(topic_r);
    });

    $("#vis-type").change(updateVisType);

    // 监听滑块值的变化
    rangeSlider.noUiSlider.on("update", function (values, handle) {
        const min = Math.round(values[0]);
        const max = Math.round(values[1]);
        rangeLabel.textContent = `${min}-${max}`;

        d3.selectAll(".topic-map")
        .transition()
        .duration(300)
        .style("opacity", d => {
            if (d.num >= min && d.num <= max) return 1;
            return 0;
        })
        .attr("pointer-events", d => {
            if (d.num >= min && d.num <= max) return "all";
            return "none";
        });
        
        draw_tagcloud(min, max);
        // visual_topics();
    });

    nodeSlider.noUiSlider.on("change", function () {
        $("#node-value").text("≥" + nodeSlider.noUiSlider.get());
        loadAndRender();
    });
    edgeSlider.noUiSlider.on("change", function () {
        $("#edge-value").text("≥" + edgeSlider.noUiSlider.get());
        loadAndRender();
    });
    topicSlider.noUiSlider.on("change", function () {
        $("#topic-value").text("≥" + topicSlider.noUiSlider.get());
        loadAndRender();
    });

    $("#save").click(function () {
        // var mainsvg = getZoomSvg('#mainsvg', '#maingroup');
        // var tagcloud = getZoomSvg('#tagcloud', null);
        // var fileName = `${name} (${fieldType}) GF profile.jpg`;
        // downloadSvg([mainsvg, tagcloud], fileName);
        if (STopic != null || visType=='GF' || visType=='GForiginal') {
            const svgElement = document.querySelector('#mainsvg svg');
            let svgData = new XMLSerializer().serializeToString(svgElement);
            const svgElement2 = document.querySelector('#tagcloud svg');
            let svgData2 = new XMLSerializer().serializeToString(svgElement2);

            combineAndDownloadSVG([svgData, svgData2], 'download.svg');
        } else {
            // 打开一个新的页面：
            // `/index?field=${fieldType}&id=${authorID}`;
            window.open(`/prism?field=${fieldType}&id=${authorID}&download=1`
                + (+nodeSlider.noUiSlider.get()!==config["node_prob"] ?`&node_prob=${nodeSlider.noUiSlider.get()}`: '')
                + (+edgeSlider.noUiSlider.get()!==config["edge_prob"] ?`&edge_prob=${edgeSlider.noUiSlider.get()}`: '')
            );
        }   
        
    });
    $("#saveall").click(saveall);
    $("#fullscreen").click(toggleFullscreen)
    $("#restore").click(render);
    

    // 初始设置，第一个按钮加粗，透明度为1，其他按钮透明度为0.5
    $(".address-text button:first").css({ 'font-weight': 'bold', 'opacity': 1 });

    // 点击按钮时的事件处理
    $(".address-text button").click(function () {
        // 将所有按钮的字体设为正常，透明度为0.5
        $(".address-text button").css({ 'font-weight': 'normal', 'opacity': 0.5 });

        // 将点击的按钮加粗，透明度为1
        $(this).css({ 'font-weight': 'bold', 'opacity': 1 });
    });

    window.addEventListener('resize', onFullscreenChange);
    window.onload = checkScreenSize;
    // guidence();

    $(document).click(function(event) {
        // console.log(event.target, $(event.target).parent().parent());
        let grandma = $(event.target).parent().parent();
        if (grandma.is('#draw-area') || $(event.target).is('#background'))
            reset_node(true);
    });

    document.getElementById('toggle-polygen').addEventListener('click', function() {
        polygenView = !polygenView;
        this.textContent = polygenView ? 'Chord View' : 'Polygen View';
        draw_chord();
    });

}

function drawYears() {
    var yearSlider = document.getElementById('yearSlider');

    var formatForSlider = {
        from: function (formattedValue) {
            return Number(formattedValue);
        },
        to: function(numericValue) {
            return Math.round(numericValue);
        }
    };

    noUiSlider.create(yearSlider, {
        start: [2000, 2020],
        step: 1,
        limit: 20,
        tooltips: true,
        orientation: 'vertical',
        direction: 'ltr',
        connect: true,
        range: {
            'min': 2000,
            'max': 2020
        },
        pips: { mode: 'steps', format: formatForSlider },
    });

}


function toggleFullscreen() {
    const container = document.getElementsByClassName("middle-column")[0];

    // 检查是否已经处于全屏状态
    const isFullscreen = document.fullscreenElement || document.webkitFullscreenElement;

    if (!isFullscreen) {
        // 进入全屏
        if (container.requestFullscreen) {
            container.requestFullscreen().then(() => {
                document.addEventListener("fullscreenchange", onFullscreenChange);
                document.addEventListener("keydown", onEscKeyPressed);
            }).catch(error => {
                console.error('Error entering fullscreen:', error);
            });
        } else if (container.webkitRequestFullscreen) {
            container.webkitRequestFullscreen().then(() => {
                document.addEventListener("webkitfullscreenchange", onFullscreenChange);
                document.addEventListener("keydown", onEscKeyPressed);
            }).catch(error => {
                console.error('Error entering fullscreen:', error);
            });
        }
    } else {
        // 退出全屏
        if (document.exitFullscreen) {
            document.exitFullscreen();
        } else if (document.webkitExitFullscreen) {
            document.webkitExitFullscreen();
        }
    }
}

function onFullscreenChange() {
    // 在这里执行其他操作
    checkScreenSize();

    $("#selector, #node-info, #node-info-blank, #up-line, #down-line, #edge-info").hide();
    render();
    draw_tagcloud();
    visual_topics();
    
    updateSider();
}

function onEscKeyPressed(event) {
    if (event.key === "Escape") {
        if (document.exitFullscreen) {
            document.exitFullscreen();
        } else if (document.webkitExitFullscreen) {
            document.webkitExitFullscreen();
        }
    }
}

function reset_graph() {
    image_status = image_data.length == 0 ? 0 : 2;
    $("#description").hide();
    $("#tagcloud").show();
    $("#mainsvg").show();
    d3.select('#mainsvg').transition().duration(500).call(zoom.transform, d3.zoomIdentity);
}

function getCookie(name) {
    var r = document.cookie.match("\\b" + name + "=([^;]*)\\b");
    return r ? r[1] : undefined;
}


function updateSider (nodes=global_nodes) {
    // feat: 在不选择话题的情况下，显示所有的节点
    $("#node-info").hide();
    $("#edge-content").hide();
    if (STopic == null) nodes = authorData['nodes'];
    let totalHeight = 0;
    $(".navigation").each(function() {
        totalHeight += $(this).outerHeight(true); // 包含 padding 和 margin
    });
    var height = ($("body").height() - totalHeight) * 0.9;
    $("#timeline").css("height", height);
    $("#timeline").empty();
    $("#timeline").append(content = `
        <div style="float: left;">
            <i style="width: 10px; height: 10px; border-radius: 50%; background-color: white; display: inline-block;"></i>
        </div>
        <div style="margin-left: 7%; margin-bottom: 2%; display: flex; justify-content: space-between;">
            <b style="margin-left: 0%; font-size:16px;">Paper Name</b>
            <b style="margin-right: 1%; margin-left: 5%; font-size:16px;">#Citation</b>
        </div>`
    );
    
    nodes = nodes.sort(op("citationCount"));
    for (let i = 0; i < nodes.length; i++) {
        const paperName = String(nodes[i].name);
        const paperVenu = String(nodes[i].venu);
        const paperYear = String(nodes[i].year);

        var authors = String(nodes[i].authors);
        if (authors == "") {
            authors = authorName;
        }
        var authorList = authors.split(", ");
        var paperAuthors = "";
        for (let i = 0; i < authorList.length; i++) {
            if (authorList[i] == authorName) 
                paperAuthors += "<span style=\"color: #00A78E\">" + authorList[i] + "</span>, ";
            else 
                paperAuthors += authorList[i] + ", ";
        }
        // hsvToHex(graph['nodes'][i].color[0], 0.7, graph['nodes'][i].color[2]);
        // var color = topic2color(nodes[i].topic, 0.7) 
        var color = topic2color(paperID2topic[nodes[i].id], 0.7)
        var nodeId = nodes[i].id;
        var citationCount = nodes[i].citationCount;
        if (nodes[i].citationCount == '-1') {
            citationCount = "not available";
        }
        var content = `
        <div style="float: left;">
            <i style="width: 10px; height: 10px; border-radius: 50%; background-color: ${color}; display: inline-block;"></i>
        </div>
        <div style="margin-left: 5%; margin-right: 3%; padding: 3%; margin-top: -3%; border-radius: 5px"; class="paperNode" onmouseover="highlight_node('${nodeId}', false, false)" onmouseleave="reset_node()">
            <div style="display: flex; justify-content: space-between; margin-bottom: 1%;">
                <span style="margin-left: 0%;">${paperName}</span>
                <span style="margin-right: 2%; margin-left: 5%;">${citationCount}</span>
            </div>
            <span style="color: #808080;">
                ${paperAuthors.slice(0, -2)}
            </span>
            <br>
            <span style="color: #808080;">${paperVenu} ${paperYear}</span>
        </div>
        `;
        
        $("#timeline").append(content);
    }
    $("#paper-list").show();
    $("#node-info").css("max-height", $("#paper-list").height() - $("#selector").innerHeight());
    $("#edge-content").css("max-height", $("#paper-list").height() - $("#edge-title").innerHeight());
}

// Function to convert HSV to RGB
function hsvToRgb(h, s, v) {
    const c = v * s;
    const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    const m = v - c;
    let r, g, b;

    if (h >= 0 && h < 60) {
        [r, g, b] = [c, x, 0];
    } else if (h >= 60 && h < 120) {
        [r, g, b] = [x, c, 0];
    } else if (h >= 120 && h < 180) {
        [r, g, b] = [0, c, x];
    } else if (h >= 180 && h < 240) {
        [r, g, b] = [0, x, c];
    } else if (h >= 240 && h < 300) {
        [r, g, b] = [x, 0, c];
    } else {
        [r, g, b] = [c, 0, x];
    }

    const rgbColor = [(r + m) * 255, (g + m) * 255, (b + m) * 255];
    return rgbColor;
}

function hsvToHex(h, s, v) {
    let rgbColor = hsvToRgb(h, s, v);
    let r = Math.round(rgbColor[0]);
    let g = Math.round(rgbColor[1]);
    let b = Math.round(rgbColor[2]);

    // 将RGB值转换为十六进制字符串
    const toHex = (value) => {
        const hex = value.toString(16);
        return hex.length === 1 ? "0" + hex : hex;
    };

    const red = toHex(r);
    const green = toHex(g);
    const blue = toHex(b);

    return "#" + red + green + blue;
}

function textSize(text, size) {
    let container = d3.select('body').append('svg');
    container.append('text')
      .style("font-size", size + "px")      // todo: these need to be passed to the function or a css style
      .style("font-family", "sans-serif")
      .text(text);
  
    let sel = container.selectAll('text').node();
    let width = sel.getComputedTextLength();
    let height = sel.getExtentOfChar(0).height;
    container.remove();
    return {width, height};
}

function calculateWordPosition(sortedData, maxFontSize) {
    let ele = d3.select("#tagcloud").node();
    let svgWidth = ele.getBoundingClientRect().width;
    let svgHeight = ele.getBoundingClientRect().height;
    let lineHeight = maxFontSize * 1.2;
    let emptySpace = maxFontSize * 0.1;
    let wordPosition = [];
    let currentLine = [];
    let currentLineWidth = 0;
    let currentLineHeight = 0;
    let minFontSize = 8;

    for (const d of sortedData) {
        let ratio = Math.sqrt(d.size / sortedData[0].size);
        if (ratio * maxFontSize < minFontSize) {
            ratio = minFontSize / maxFontSize;
        }
        let size = ratio * maxFontSize;
        let height = ratio * lineHeight;
        let opacity = ratio * 0.8 + 0.1;
        // let width = size * shortName.length * 0.5;
        let width = textSize(d.shortName, size).width * 0.88;
        // let width = d.shortName.length * size * 0.4;
        if (currentLineWidth + width > svgWidth) {
            if (currentLine.length == 0) return null
            for (const word of currentLine) {
                word.x += (svgWidth - currentLineWidth) / 2;
            }
            currentLineHeight += currentLine[0].height + emptySpace;
            if (currentLineHeight + height > svgHeight) return null;
            wordPosition.push(currentLine);
            currentLine = [];
            currentLineWidth = 0;
        }
        currentLine.push({
            id: d.id,
            size: size,
            width: width,
            height: height,
            name: d.name,
            ratio: ratio,
            shortName: d.shortName,
            opacity: opacity,
            x: currentLineWidth,
            y: currentLineHeight
        });
        currentLineWidth += width + emptySpace;
    }

    for (const word of currentLine) {
        word.x += (svgWidth - currentLineWidth) / 2;
    }
    wordPosition.push(currentLine);
    return wordPosition;
}

function topic2order(topic) {
    return topic;
}

function draw_chord() {
    // let ele = d3.select(".address-text").node();
    // d3.select("#chord-content").selectAll("*").remove();
    // let height = ele.getBoundingClientRect().width;
    // let width = ele.getBoundingClientRect().width;

    let svgElement = init_chord(polygenView, true);
    // set background to red
    d3.select("#chord-content").style("background-color", "#f5fafa");
    // "#chord-content" set size: width=width(#left-column), height=height(#left-column) - height(#basic-info)
    let chordContent = document.getElementById('chord-content');
    if (chordContent == null) return;
    chordContent.style.width = document.getElementsByClassName('left-column')[0].getBoundingClientRect().width + 'px';
    chordContent.style.height = document.getElementsByClassName('left-column')[0].getBoundingClientRect().height - document.getElementById('basic-info').getBoundingClientRect().height - document.getElementsByClassName('address-text')[0].getBoundingClientRect().height - 60 + 'px';
    bindSVG(svgElement, "#chord-content");
    update_chord_element();
}

function highlight_arc_with_cash(index, oldIndex) {
    // 有缓存的方法，能够节约一半的时间 
    // console.log('highlight arc', index);
    if (index2chord_element[oldIndex]) {
        index2chord_element[oldIndex].forEach(element => element.style("opacity", defaultOpacity / 3));
    }
    if (index2chord_element[index]) {
        index2chord_element[index].forEach(element => element.style("opacity", 1));
    }
}

function create_svg(viewBox=undefined, transform=undefined) {
    let ele = d3.select("#mainsvg").node();
    d3.select("#mainsvg").selectAll("*").remove();
    svgWidth = ele.getBoundingClientRect().width;
    svgHeight = ele.getBoundingClientRect().height;
    if (!viewBox) {
        viewBox = `0 0 ${svgWidth} ${svgHeight}`;
    }

    let viewBoxWidth = parseFloat(viewBox.split(' ')[2]);
    let viewBoxHeight = parseFloat(viewBox.split(' ')[3]);
    if (!transform) {
        transform = `translate(0,${viewBoxHeight})`;
    }

    svg = d3.select("#mainsvg").append("svg")
        .attr("width", svgWidth)
        .attr("height", svgHeight)
        .attr("viewBox", viewBox);

    //获取viewBox的宽度
    let moveDistance_r = Math.max(viewBoxWidth, viewBoxWidth / 2 +  svgWidth * viewBoxHeight / svgHeight / 2) * 0.95;
    let moveDistance_l = Math.min(0, viewBoxWidth / 2 -  svgWidth * viewBoxHeight / svgHeight / 2) * 0.95;

    let fixedXTranslation_r = "translate(" + moveDistance_r + ",0)"; // 将fixedX作为X方向的平移，Y方向保持为0
    let fixedXTranslation_l = "translate(" + moveDistance_l + ",0)"; // 将fixedX作为X方向的平移，Y方向保持为0

    matrixg = svg.append('g')
        .attr('transform', transform)
        .attr('id', 'maingroup');
    gr = svg.append('g')
        .attr('transform', transform + fixedXTranslation_r)
        .attr('id', 'fixedgroup_r');
    gl = svg.append('g')
        .attr('transform', transform + fixedXTranslation_l)
        .attr('id', 'fixedgroup_l');
    
    zoom = d3.zoom()
        .scaleExtent([0.05, 10])
        .on("zoom", function() {
        let currentTransform = d3.event.transform;
    
        // 应用当前的变换到主要元素组g
        matrixg.attr("transform", currentTransform.toString() + " " + transform);
    
        // 为了在Y方向上保持gf元素的同步移动，我们需要提取当前变换的平移和缩放值
        // 并仅将这些应用到Y坐标，而X坐标保持不变（假定fixedX为X坐标的固定值）
        
        let yTranslation = "translate(0," + currentTransform.y + ")"; // 应用当前Y方向的平移
        let yScale = "scale(1," + currentTransform.k + ")"; // 在Y方向上应用缩放，X方向保持1
    
        // 将上述变换组合并应用到gf
        // 注意这里我们使用了空格来分隔不同的变换指令
        gr.attr("transform", yTranslation + yScale + transform + fixedXTranslation_r);
        gl.attr("transform", yTranslation + yScale + transform + fixedXTranslation_l);
    });
    svg.call(zoom);
}


function mouseoverEdge(id, width=10, color='red') {
    d3.selectAll('#' + selectorById(id))
        .style("stroke", color)
        .style("stroke-width", d => width || d.width)
        .attr('cursor', 'pointer');
    d3.selectAll('#' + selectorById(id) + '_polygon')
        .style("fill", color)
        .attr('cursor', 'pointer');
}

function mouseoutEdge(id) {
    if (!highlighted.includes(id)) {
        // TODO: why d is undefined???
        d3.selectAll('#' + selectorById(id)).filter(d=>d !== undefined)
            .style("stroke", d=> d.color)   // {console.log(d); return
            .style("stroke-width", d=>d.width);
        d3.selectAll('#' + selectorById(id) + '_polygon').filter(d=>d !== undefined)
            .style("fill", d=>d.color);
    }
}

function clickEdge(id, width=10) {
    highlighted = [id];
    matrixg.selectAll('.epath')
        .style("stroke", d=> d.color)
        .style("stroke-width", d=>d.width)
        .style('opacity', virtualOpacity);
    matrixg.selectAll('.epath-polygon')
        .style("fill", d=>d.color)
        .style('opacity', virtualOpacity);
    d3.selectAll('#' + selectorById(id))
        .style("stroke", "red")
        .style("stroke-width", d => width || d.width)
        .style('opacity', 1);
    d3.selectAll('#' + selectorById(id) + '_polygon')
        .style("fill", "red")
        .style("opacity", 1);
}

function perceivedToActualArea(perceived) {
    return Math.pow(perceived, 1 / 0.7);
}

function resetElementAttr(svgElement) {
    requestAnimationFrame(() => {
        let svg = d3.select(svgElement);
        let bbox = svg.node().getBBox();
        let x = bbox.x;
        let y = bbox.y;
        let width = bbox.width;
        let height = bbox.height;

        let offsetX = -x;
        let offsetY = -y;

        console.log('reset', svg, x, y, width, height, offsetX, offsetY);

        // 重设 viewBox 和 transform
        svgElement.setAttribute('viewBox', `${x} ${y} ${width} ${height}`);
        svgElement.setAttribute('transform', `translate(${offsetX}, ${offsetY})`);
    });
}



function draw_context(graph) {
    // draw context bar

    context_l = {};
    context_r = {}; 
    // topicID: {"2011": [edge1, edge2, ...], "2012": [], "total": 50}

    
    if (hideBackground) {
        processDotContext(graph);
    }
    let bbox = graph['g'].node().getBBox();
    let all_years_l = [], all_years_r = [];
    let totalWidth = bbox.width;
    for (let edge of Object.values(graph['combinedContextEdges'])) {
        let years = edge.name.split('->');
        if (edge.name[0] == "l") {
            all_years_l.push(years[0].substring(1));
        } else {
            all_years_r.push(years[1].substring(1));
        }
    }
    all_years_l = Array.from(new Set(all_years_l));
    all_years_r = Array.from(new Set(all_years_r));
    console.log('all_years', all_years_l, all_years_r);


    for (let edge of Object.values(graph['combinedContextEdges'])) {
        if (edge.name[0] == "l") {
            let year = edge.name.split('->')[0].substring(1);
            for (let e of edge.edges) {
                let topic = paperID2topic[e.source];
                if (context_l[topic] == undefined) {
                    context_l[topic] = {"total": 0};
                    for (let y of all_years_l) context_l[topic][y] = [];
                }
                context_l[topic][year].push(e);
                context_l[topic]["total"] += 1;
            }
        } else {
            let year = edge.name.split('->')[1].substring(1);
            for (let e of edge.edges) {
                let topic = paperID2topic[e.target];
                if (context_r[topic] == undefined) {
                    context_r[topic] = {"total": 0};
                    for (let y of all_years_r) context_r[topic][y] = [];
                }
                context_r[topic][year].push(e);
                context_r[topic]["total"] += 1;
            }
        }
    }
    console.log('context l/r', context_l, context_r);

    let totalSize_l = Object.values(context_l).reduce((acc, val) => acc + val.total, 0);
    let totalSize_r = Object.values(context_r).reduce((acc, val) => acc + val.total, 0);
    // let width_l = totalSize_l * totalWidth / (totalSize_l + totalSize_r);
    // let width_r = totalSize_r * totalWidth / (totalSize_l + totalSize_r);

    // draw_context_bar(graph, context_l, totalSize_l * totalWidth / (totalSize_l + totalSize_r), 'l');
    // draw_context_bar(graph, context_r, totalSize_r * totalWidth / (totalSize_l + totalSize_r), 'r');
    
    let g = graph['g'];
    let id2attr = graph['id2attr'];
    let lx = bbox.x - bbox_padding_x;
    let rx = bbox.x + bbox.width + bbox_padding_x;

    // var y = d3.scaleLinear()
    //     .domain([minYear, maxYear])
    //     .range([id2attr['l' + minYear].y, id2attr['l' + maxYear].y]);
    // 避免未定义，延伸年份
    let prefix = id2attr['l' + maxYear]? 'l' : 'year';
    let maxY = id2attr[prefix + maxYear].y;
    for (let year = maxYear + 1; year < maxYear + yearGrid; year++) {
        maxY += id2attr[prefix + maxYear].y - id2attr[prefix + (maxYear-1)].y;
        id2attr[prefix + year] = {"y": maxY};
    }
    var y = d3.scaleOrdinal()
        .domain(d3.range(minYear, maxYear + yearGrid))
        .range(d3.range(minYear, maxYear + yearGrid).map(year => id2attr[prefix + year].y));
    
    // minYear, maxYear
    var years = d3.range(minYear, maxYear + 1);
    let miny = graph.nodes.reduce((acc, val) => Math.min(acc, val.year), maxYear);
    let maxy = graph.nodes.reduce((acc, val) => Math.max(acc, val.year), minYear);
    var tickValues = years.filter(year => year % yearGrid === 0 && year >= miny && year <= maxy);
    console.log('tickValues', tickValues, miny, maxy);

    let barHeight = Math.cbrt(bbox.width * bbox.height) / 2;
    let barWidth = bbox.width + barHeight * 2;
    let streamSize = barHeight * 2 + barWidth / 5;

    g.append("g")
        .call(d3.axisLeft(y).tickSize(- totalWidth - streamSize * 2).tickValues(tickValues))
        .select(".domain").remove();
    g.selectAll(".tick line")
        .attr("stroke", "#b8b8b8")
        // .attr("transform", `translate(${-width_l},0)`);
        .attr("transform", `translate(${-streamSize + barHeight},0)`);
    // font
    g.selectAll(".tick text")
        .attr("x", rx + streamSize + 20)
        .attr("dy", 10)
        .attr('font-family', 'Archivo Narrow')
        .style("font-size", 48)

    Tooltip = g
        .append("text")
        .attr("x", lx)
        .attr("y",  bbox.y - bbox_padding_y - barHeight)
        .attr('font-family', 'Archivo Narrow')
        .style("opacity", 0)
        .style("font-size", 48)
    
    let width_l = streamSize * totalSize_l / Math.max(totalSize_l, totalSize_r);
    let width_r = streamSize * totalSize_r / Math.max(totalSize_l, totalSize_r);
    drawStreamgraph(g, context_l, y, [lx, lx - width_l], 'l');
    drawStreamgraph(g, context_r, y, [rx, rx + width_r], 'r');
    let barHeight_l = barHeight * totalSize_l / Math.max(totalSize_l, totalSize_r);
    let barHeight_r = barHeight * totalSize_r / Math.max(totalSize_l, totalSize_r);
    draw_scrollbar(g, context_l, [lx - barHeight, bbox.y - barHeight_l], barWidth, barHeight_l, barHeight, 'l');
    draw_scrollbar(g, context_r, [lx - barHeight, bbox.y + bbox.height], barWidth, barHeight_r, barHeight, 'r');
}

function mouseoverFlux(dir, topic_id, context) {
    if(activeArea) return;
    // Tooltip.style("opacity", 1);
    let topic = getTopic(topic_id);
    let info = `${topic.shortName}, ${dir=='l'?'Influx': (dir == 'm'? 'Total': 'Efflux')}: ${context[topic_id].total}`;
    tip.show({name: info})
    Tooltip.text(info);
    d3.selectAll(".myArea").style("opacity", .2)
    d3.select(`.myArea${dir}T${topic_id}`)
        .style("stroke", "black")
        .style("opacity", 1)
    d3.selectAll(".scroll-segmentl, .scroll-segmentr" ).style("opacity", .2)
    d3.select(`.scroll-segment${dir}T${topic_id}`).style("opacity", 1)

    // highlightContextEdge(topic_id, dir)
    if (STopic != null && STopic != topic_id) {
        drawContextEdgesByTopic(topic2graph[STopic], topic_id, dir);
    }
}

function mouseOverFluxes(flux_pairs) {
    // 仅当mouseOverNode时，与该node所有相关的fluxes高亮
    if(activeArea) return;
    d3.selectAll(".myArea").style("opacity", .2)
    d3.selectAll(".scroll-segmentl, .scroll-segmentr" ).style("opacity", .2)
    flux_pairs.forEach(pair => {
        let [dir, topic_id] = pair;
        d3.select(`.myArea${dir}T${topic_id}`)
            .style("stroke", "black")
            .style("opacity", 1)
        d3.select(`.scroll-segment${dir}T${topic_id}`).style("opacity", 1)
    });
}

function getTopic(id) {
    ret = global_paper_field.find(field => field.id == id);
    if (ret == undefined) return {
        "shortName": "null",
        "name": "null"
    }
    return ret;
}

function mouseleaveFlux() {
    if(activeArea) return;
    tip.hide();
    Tooltip.style("opacity", 0)
    d3.selectAll(".myArea").style("opacity", 1).style("stroke", "none")
    d3.selectAll(".scroll-segmentl, .scroll-segmentr" ).style("opacity", 1)

    d3.selectAll(".egroup-context-topic").remove();
}

function drawStreamgraph(svg, context, y, xRange, dir='l', selected=null) {
    console.log('dir', dir, 'selected', selected);

    svg.selectAll(".myArea" + dir)
        .remove();

    let keys = Object.entries(context)
        .sort((a, b) => b[1].total - a[1].total)
        .map(entry => entry[0]);
    keys = JSON.parse(JSON.stringify(keys));
        let data = {};
    keys.forEach(function(key) {
        let details = context[key];
        for (var year in details) {
            if (year == 'total') continue;
            if (data[year] == undefined) data[year] = {};
            data[year][key] = details[year].length;
        }
    })
    // console.log('dataMap', JSON.parse(JSON.stringify(data)));
    data = Object.keys(data).map(function(year) {
        return {
            year: +year,
            ...data[year]
        };
    });
    if (data.length == 0) return;

    const years = data.map(d => d.year);
    const minYear = Math.min(...years);
    const maxYear = Math.max(...years);
    const dataKeys = Object.keys(data[0]).filter(key => key !== 'year');
    // 创建具有所有键和值为 0 的新对象
    const createZeroData = (year) => {
        let zeroData = { year: year };
        dataKeys.forEach(key => {
            zeroData[key] = 0;
        });
        return zeroData;
    };
    // 添加最小年份-1 和最大年份+1 的数据
    data.unshift(createZeroData(minYear - 1));
    data.push(createZeroData(maxYear + 1));
    

    var xScale = d3.scaleLinear()
        .domain([0, d3.max(data, function(d) {
        return d3.sum(keys, function(key) { return d[key]; });
        })])
        .range(xRange);

    var areaGenerator = d3.area()
        .curve(d3.curveBasis)
        .y(function(d) { return y(d.data.year); })
        .x0(function(d) { return xScale(d[0]); })
        .x1(function(d) { return xScale(d[1]); });

    console.log('data', data);
    let sortedKeys = JSON.parse(JSON.stringify(keys));
    if (selected) {
        sortedKeys = sortedKeys.filter(function(key) { return key != keys[selected]; });
        sortedKeys.unshift(keys[selected]);
    }
    
    var stackedData = d3.stack().keys(sortedKeys)(data);
    console.log('sortedKeys', sortedKeys, stackedData);
    
    
    var clickArea = function(d, i) {
        if (activeArea === dir && i == 0) {
            // 取消高亮
            activeArea = null;
            Tooltip.style("opacity", 0);
            // d3.selectAll(".myArea").style("opacity", 1).style("stroke", "none");
            // 移除点阵和连线
            svg.selectAll(".paperIcon").remove();
            drawStreamgraph(svg, context, y, xRange, dir);
        } else if(activeArea === null) {
            activeArea = dir;
            drawStreamgraph(svg, context, y, xRange, dir, selected=i);
        }
    }

    // var mousemove = function(d, i) {
    //     var grp = sortedKeys[i];
    //     // var year = y.invert(d3.mouse(this)[1]).toFixed(0);
    //     // 由于 d3.scaleOrdinal 不支持 invert 方法，你可以通过手动查找最近的年份来代替 y.invert。
    //     var mouseY = d3.mouse(this)[1];
    //     var closestYear = d3.range(minYear, maxYear + 1).reduce((prev, curr) => {
    //         return (Math.abs(y(curr) - mouseY) < Math.abs(y(prev) - mouseY) ? curr : prev);
    //     });

    //     var year = closestYear.toFixed(0);
    //     if (dir == 'l' && year % yearGrid == 0 || dir == 'r' && year % yearGrid == yearGrid-1 || year == minYear || year == maxYear || dir == 'm') {
    //         var value = d3.sum(stackedData[i], function(layer) {
    //             return layer.data.year === +year ? (layer[1] - layer[0]) : 0;
    //         }).toFixed(0);
    //         let info = `${getTopic(grp).shortName}, ${dir=='l'?'Influx': (dir == 'm'? 'Total': 'Efflux')}: ${context[grp].total}, Year: ${year}, Value: ${value}`
    //         tip.show({name: info});
    //         Tooltip.text(info);
    //     } else {
    //         tip.hide();
    //         Tooltip.style("opacity", 0);
    //     }
    // }

    // Show the areas
    svg.selectAll(".myArea" + dir)
        .data(stackedData)
        .enter()
        .append("path")
        .attr("class", d=>`myArea myArea${dir} myArea${dir}T${d.key}`)
        .style("fill", d=>topic2color(d.key))
        .style("fill-opacity", .8)
        .attr("d", areaGenerator)
        .on("mouseover", d=>mouseoverFlux(dir, d.key, context))
        // .on("mousemove", mousemove)
        .on("mouseleave", mouseleaveFlux)
        .on("click", clickArea);

    // Add X axis
    // svg.append("g")
    //     .call(d3.axisBottom(xScale))
    //     .select(".domain").remove();
    
    if (selected!==null) {
        d3.selectAll(".myArea").style("opacity", .2);
        d3.selectAll(`.myArea${dir}T${keys[selected]}`)
            .style("stroke", "black")
            .style("opacity", 1);
        // 显示点阵和连线

        if (dir == 'm') return;
        let selectedKey = keys[selected];
        var contextData = context[selectedKey];
        console.log('contextData', contextData);
        for (var year in contextData) {
            if(year == 'total') continue;
            var details = contextData[year];
            var value = stackedData[0].find(function(layer) {
                return layer.data.year === +year;
            });
            var yPosition = y(+year);
            // 计算每个点的x坐标，使其在 (0, maxXPosition) 内均匀分布
            let papers = {}
            details.forEach(d=>{
                let paper = dir=='l'? d.source: d.target
                papers[paper] = papers[paper] === undefined? 1: papers[paper] + 1;
            })
            // sort by value
            papers = Object.entries(papers).sort((a, b) => b[1] - a[1]);
            let sqrtSize = papers.map(d=>Math.sqrt(d[1])).reduce((acc, val) => acc + val, 0);
            let size = 0;
            var xPositions = papers.map(d => {
                size += Math.sqrt(d[1]) / 3; 
                let ret = xScale(value[1] * size / sqrtSize);
                size += Math.sqrt(d[1]) / 3;
                return ret;
            });
            // console.log('papers', year, value, sqrtSize, papers, xScale(0), xPositions);
            
            // 绘制图标
            svg.selectAll(`.paperIcon${year}`)
                .data(papers)
                .enter()
                .append("g")
                .attr("class", `paperIcon paperIcon${year}`)
                .each(function(d, i) {
                    let w = h = Math.sqrt(d[1]) * 56;
                    d = global_nodes.find(n=>n.id==d[0]); 
                    bookPaths.forEach(path => {
                        d3.select(this).append('path')
                            .attr('d', path)
                            .style('fill-opacity', 0.4)
                            .style('fill', 'red')    // updateOutlineColor(d.isKeyPaper, d.citationCount)
                            .attr('transform', `translate(${xPositions[i] - w / 2}, ${yPosition - h * 0.4}) scale(${w / bookWidth}, ${h / bookHeight})`);
                    });
                    d3.select(this).append('text')
                        .attr('x', xPositions[i])
                        .attr('y', yPosition + h * 0.1)
                        .attr('text-anchor', 'middle')
                        .attr('font-family', 'Archivo Narrow')
                        .attr('font-size', 30)
                        .attr('fill', 'black')
                        .attr("pointer-events", "none")
                        .text(d.citationCount);
                })
                .on("mouseover", function(d) {
                    tip.show({name: global_nodes.find(n=>n.id==d[0]).name + ' ' + d[1]});
                    // cursor
                    d3.select(this).attr('cursor', 'pointer');
                })
                .on("mouseout", function() {
                    tip.hide();
                })
                .on("click", d=>highlight_node(d[0]))
        }
    }
}

function draw_scrollbar(svg, context, startPoint, width, height, baseHeight, dir='l') {
    // scroll的宽和高
    // const width = 800;
    // const height = 50;
    let currentContext = JSON.parse(JSON.stringify(context));
    let keys = Object.entries(currentContext)
        .sort((a, b) => b[1].total - a[1].total)
        .map(entry => entry[0]);
    // 根据total排序，如果是右边的scrollbar，按照total降序排列
    if (dir == 'l') {
        keys = keys.reverse();
    } 
    const barWidth = width / 5;
    let segmentColors = [],  segmentPositionX = [], segmentWidth = [];
    let startX = 0;
    let totalSize = Object.values(currentContext).reduce((acc, val) => acc + val.total, 0);
    keys.forEach(function(key) {
        let c = topic2color(key);
        segmentColors.push(c); // hsvToColor([c.h, 0.4, 1])
        segmentPositionX.push(startX);
        segmentWidth.push(width * currentContext[key].total / totalSize);
        startX += width * currentContext[key].total / totalSize;
    });

    // Draw the end bars
    const endBarWidth = barWidth / 5;
    const endBarHeight = baseHeight * 2;
    const triangleHeight = baseHeight * 1.5;
    let radius = triangleHeight / 3;
    let rectRadius = 10;

    // console.log(barWidth, barWidth)
    // console.log('context', currentContext, segmentColors);

    const gradientDefinitions = svg.append("defs");
    // Create gradient for each segment
    segmentColors.forEach((color, i) => {
        const gradient = gradientDefinitions.append("linearGradient")
            .attr("id", `gradient${dir}${i}`)
            .attr("x1", "0%")
            .attr("x2", "0%")
            .attr("y1", "0%")
            .attr("y2", "100%");
        
        gradient.append("stop")
            .attr("offset", "0%")
            .attr("style", `stop-color:${color};stop-opacity:1`);

        gradient.append("stop")
            .attr("offset", "50%")
            .attr("style", `stop-color:white;stop-opacity:1`);

        gradient.append("stop")
            .attr("offset", "100%")
            .attr("style", `stop-color:${color};stop-opacity:1`);
    });

    svg.selectAll(".scroll-segment" + dir)
        .data(segmentColors)
        .enter()
        .append("rect")
        .attr("class", (d, i) => `scroll-segment${dir} scroll-segment${dir}T${keys[i]}`)
        .attr("x", (d, i) => startPoint[0] + segmentPositionX[i])
        .attr("y", startPoint[1])
        .attr("width", (d, i) => segmentWidth[i])
        .attr("height", height)
        // .attr("rx", 10)
        // .attr("ry", 10)
        .attr("fill", (d, i) => `url(#gradient${dir}${i})`)
        .on("mouseover", function () {
            d3.select(this).attr("opacity", 0.8);
        })
        .on("mouseout", function () {
            d3.select(this).attr("opacity", 1);
        })
        .on("mouseover", (d, i) => mouseoverFlux(dir, keys[i], context))
        .on("mouseleave", mouseleaveFlux)

    svg.selectAll(".scroll-count" + dir)
        .data(segmentColors)
        .enter()
        .append("text")
        .attr("class", `scroll-count${dir}`)
        .attr("x", (d, i) => startPoint[0] + segmentPositionX[i] + segmentWidth[i] / 2)
        .attr("y", startPoint[1] + height / 2)
        .attr("text-anchor", "middle")
        .attr("alignment-baseline", "middle")
        .attr("font-family", "Archivo Narrow")
        .attr("font-size", height)
        .attr("opacity", 0.7)
        .attr("fill", "black")
        .attr("dy", 5)
        .attr("pointer-events", "none")
        .text((d, i) => context[keys[i]].total == 1? '': context[keys[i]].total)
    
    svg.selectAll(".scroll-label" + dir)
        .data(segmentColors)
        .enter()
        .append("text")
        .attr("class", `scroll-label${dir}`)
        .attr("x", (d, i) => startPoint[0] + segmentPositionX[i] + segmentWidth[i] / 2)
        .attr("y", startPoint[1] + height / 2 + (dir=='l'? -height: height) * 1.5)
        .attr("transform", (d, i) => `rotate(${dir=='l'? -15: 15}, ${startPoint[0] + segmentPositionX[i] + segmentWidth[i] / 2}, ${startPoint[1] + height / 2 + (dir=='l'? -height: height)})`)
        .attr("text-anchor", "middle")
        .attr("alignment-baseline", "middle")
        .attr("font-family", "Archivo Narrow")
        .attr("font-size", height)
        .attr("opacity", 0.7)
        .attr("fill", "black")
        .attr("dy", 5)
        .attr("pointer-events", "none")
        .text((d, i) => context[keys[i]].total <= totalSize/15? '': getTopic(keys[i]).shortName.split(' ')[0].replace('null', 'misc.'))
        

    const createEndBarGradient = (id) => {
        const gradient = gradientDefinitions.append("linearGradient")
            .attr("id", id)
            .attr("x1", "0%")
            .attr("x2", "100%")
            .attr("y1", "0%")
            .attr("y2", "100%");
    
        gradient.append("stop")
            .attr("offset", "0%")
            .attr("style", "stop-color:#8B4513;stop-opacity:1"); // 左侧暗部
    
        gradient.append("stop")
            .attr("offset", "25%")
            .attr("style", "stop-color:#A0522D;stop-opacity:1"); // 左侧过渡
    
        gradient.append("stop")
            .attr("offset", "50%")
            .attr("style", "stop-color:#CD853F;stop-opacity:1"); // 中间亮部（哑光效果）
    
        gradient.append("stop")
            .attr("offset", "75%")
            .attr("style", "stop-color:#A0522D;stop-opacity:1"); // 右侧过渡
    
        gradient.append("stop")
            .attr("offset", "100%")
            .attr("style", "stop-color:#8B4513;stop-opacity:1"); // 右侧暗部
    };

    createEndBarGradient("leftBarGradient");
    createEndBarGradient("rightBarGradient");

    // Left trapezoid
    let centerHeight = startPoint[1] + height / 2;
    svg.append("path")
        .attr("d", `
            M${0},${centerHeight - triangleHeight/2 + radius}
            A${radius},${radius} 0 0 1 ${radius},${centerHeight - triangleHeight/2}
            L${barWidth},${centerHeight}
            L${radius},${centerHeight + triangleHeight/2}
            A${radius},${radius} 0 0 1 ${0},${centerHeight + triangleHeight/2 - radius}
            Z
        `)
        .attr("fill", "url(#leftBarGradient)")
        .attr('transform', `translate(${startPoint[0] - barWidth}, 0)`);

    // Right trapezoid
    svg.append("path")
        .attr("d", `
            M${width},${centerHeight - triangleHeight/2 + radius}
            A${radius},${radius} 0 0 0 ${width - radius},${centerHeight - triangleHeight/2}
            L${width - barWidth},${centerHeight}
            L${width - radius},${centerHeight + triangleHeight/2}
            A${radius},${radius} 0 0 0 ${width},${centerHeight + triangleHeight/2 - radius}
            Z
        `)
        .attr("fill", "url(#rightBarGradient)")
        .attr('transform', `translate(${startPoint[0] + barWidth}, 0)`);

    // Left end bar
    svg.append("rect")
        .attr("x", startPoint[0] - endBarWidth)
        .attr("y", centerHeight - endBarHeight/2)
        .attr("width", endBarWidth)
        .attr("height", endBarHeight)
        .attr("rx", rectRadius)
        .attr("ry", rectRadius)
        .attr("fill", "url(#leftBarGradient)");

    svg.append("rect")
        .attr("x", startPoint[0] - endBarWidth - endBarWidth / 4)
        .attr("y", centerHeight - baseHeight / 2)
        .attr("width", endBarWidth / 4)
        .attr("height", baseHeight)
        .attr("rx", rectRadius)
        .attr("ry", rectRadius)
            .attr("fill", "url(#leftBarGradient)");

    // Right end bar
    svg.append("rect")
        .attr("x", startPoint[0] + width)
        .attr("y", centerHeight - endBarHeight/2)
        .attr("width", endBarWidth)
        .attr("height", endBarHeight)
        .attr("rx", rectRadius)
        .attr("ry", rectRadius)
        .attr("fill", "url(#rightBarGradient)");

    svg.append("rect")
        .attr("x", startPoint[0] + width + endBarWidth)
        .attr("y", centerHeight - baseHeight/2)
        .attr("width", endBarWidth / 4)
        .attr("height", baseHeight)
        .attr("rx", rectRadius)
        .attr("ry", rectRadius)
        .attr("fill", "url(#rightBarGradient)");
}

function draw_context_bar(graph, context, width, dir='l') {
    let sorted_keys = Object.entries(context).sort((a, b) => b[1].total - a[1].total).map(entry => entry[0]);
    console.log('context for', dir,  context);
    let totalSize = sorted_keys.reduce((acc, key) => acc + context[key].total, 0);
    let bbox = graph['bbox'];
    let g = graph['g'];

    const squareSize = 50; // 正方形大小
    let processedData = [];
    let margin = 5; // 方块之间的间隔
    const xPositions = {};
    sorted_keys.forEach(topicID => {
        Object.keys(context[topicID]).forEach(year => {
            if (year === 'total') return;
            if (!xPositions[year]) xPositions[year] = (dir == 'l'? bbox.x - bbox_padding_x: bbox.x + bbox.width + bbox_padding_x);
            
            let nodeCount = 0;
            context[topicID][year].forEach((edge, index) => {
                let nodeID = dir == 'l'? edge.source: edge.target;
                let leftX = dir == 'l'? xPositions[year] - squareSize * (index + 1) - margin * nodeCount: 
                                        xPositions[year] + squareSize * index + margin * nodeCount;
                if (processedData.length > 0 && processedData[processedData.length - 1].id == nodeID) {
                    processedData[processedData.length - 1].edge.push(edge);
                    if (dir == 'l') processedData[processedData.length - 1].x = leftX + margin;
                } else {
                    nodeCount += 1;
                    processedData.push({
                        id: nodeID,
                        node: global_nodes.find(n => n.id == nodeID),
                        topic: topicID,
                        year: year,
                        y: graph['id2attr']['l' + year].y - squareSize / 2,
                        x: leftX,
                        edge: [edge]
                    });
                }
            });
            
            let tmp = xPositions[year];
            if (dir == 'l') xPositions[year] -= squareSize * context[topicID][year].length + margin * nodeCount;
            else xPositions[year] += squareSize * context[topicID][year].length + margin * nodeCount;
            context[topicID][year].m = Math.min(xPositions[year], tmp);
            context[topicID][year].M = Math.max(xPositions[year], tmp);
        });
    });

    console.log('processedData', processedData);

    // 创建多边形路径数据
    let topicPaths = {};
    let startX = (dir == 'l'? bbox.x - bbox_padding_x: bbox.x + bbox.width + bbox_padding_x);
    sorted_keys.forEach(topicID => {
        if (!topicPaths[topicID]) {
            topicPaths[topicID] = [];
        }

        // 添加顶部方块
        let tmp = startX + (dir == 'l'? - 1: 1) * context[topicID].total / totalSize  * width;
        // let tmp = startX + (dir == 'l'? - 1: 1) * context[topicID].total  * squareSize / 4;
        let m = Math.min(startX, tmp);
        let M = Math.max(startX, tmp);
        startX = tmp;

        topicPaths[topicID].m = m;
        topicPaths[topicID].M = M;
        if (dir == 'l') {
            topicPaths[topicID].r = (bbox.x - bbox_padding_x) - M;
            topicPaths[topicID].R = (bbox.x - bbox_padding_x) - m;
        } else {
            topicPaths[topicID].r = m - (bbox.x + bbox.width + bbox_padding_x);
            topicPaths[topicID].R = M - (bbox.x + bbox.width + bbox_padding_x);
        }

        let y = bbox.y - bbox_padding_y;
        topicPaths[topicID].push([M, y]); 
        topicPaths[topicID].unshift([m, y]); 

        Object.keys(context[topicID]).forEach(year => {
            if (year === 'total') return true;
            // 先添加右侧点
            topicPaths[topicID].push([context[topicID][year].M, graph['id2attr']['l' + year].y - squareSize /2]); // 右上
            topicPaths[topicID].push([context[topicID][year].M, graph['id2attr']['l' + year].y + squareSize /2]); // 右下
            
            // 然后添加左侧点
            topicPaths[topicID].unshift([context[topicID][year].m, graph['id2attr']['l' + year].y - squareSize /2]); // 左上
            topicPaths[topicID].unshift([context[topicID][year].m, graph['id2attr']['l' + year].y + squareSize /2]); // 左下
            
        })
    });

    console.log('topicPaths', topicPaths);

    let center = dir == 'l'? [bbox.x - bbox_padding_x, bbox.y - bbox_padding_y]
                            : [bbox.x + bbox.width + bbox_padding_x, bbox.y - bbox_padding_y];
    let suffix = dir=='l'? 'o': 'i';
    let resuffix  = dir=='l'? 'i': 'o';

    const arcGenerator = d3.arc()
        .innerRadius(d => d.r)
        .outerRadius(d => d.R)  // 控制厚度，使其看起来像一个填充的椭圆
        .startAngle(-Math.PI / 2)  // 开始角度
        .endAngle(Math.PI / 2)    // 结束角度
        .cornerRadius(0);

    // 绘制多边形
    Object.keys(topicPaths).forEach(topicID => {
        g.append("path")
           .datum(topicPaths[topicID])
           .attr("fill", topic2color(topicID))
           .attr("fill-opacity", topicOpacity)
           .attr("class", "context-polygon context-polygon_" + topicID)
        //    .attr("stroke", topic2color(topicID))
        //    .attr("stroke-width", 2)
           .attr("d", d3.line()
                        .x(d => d[0])
                        .y(d => d[1])
                        .curve(d3.curveLinearClosed))
            .on('mouseover', function() {
                let field = getTopic(topicID);
                highlight_field(topicID);
                tip.show({name: field.name + '\n' + context[topicID].total});
                d3.select(this).attr('cursor', 'pointer');
            })
            .on('mouseout', reset_field);

        let field = getTopic(topicID);
        
        g.append("path")
              .datum(topicPaths[topicID])
              .attr("fill", topic2color(topicID))
              .attr("fill-opacity", topicOpacity)
              .attr("class", "context-ellipse context-ellipse_" + topicID)
              .attr("d", d=> arcGenerator(d))
              .attr("transform", `translate(${center[0]}, ${center[1]})  scale(1, 0.5)`)
              .on('mouseover', function() {
                highlight_field(topicID);
                tip.show({name: field.name + ':\n' + context[topicID].total});
                d3.select(this).attr('cursor', 'pointer');
            })
            .on('mouseout', reset_field);
            
        let y = (topicPaths[topicID].r + topicPaths[topicID].R) / 4;
        g.append("text")
            .attr("x", center[0])
            .attr("y", center[1] - y)
            .attr("text-anchor", "middle")
            // 垂直居中
            .attr("dominant-baseline", "middle")
            .attr("font-family", "Archivo Narrow")
            .attr("font-size", Math.sqrt(context[topicID].total) * 20)
            .attr("class", "context-text context-text_" + topicID)
            // 逆时针旋转45度
            // .attr("transform", `rotate(-45, ${x}, ${center[1]})`)
            .text(field.shortName)
            .attr("pointer-events", "none");
    });

    g.append("rect")
        .attr("x", dir =='l'? center[0]: center[0] - width)
        .attr("y", center[1])
        .attr("width", width)
        .attr("height", squareSize)
        .attr("fill", topic2color(STopic))
        .attr("fill-opacity", topicOpacity)
        .attr("class", "context-polygon context-polygon_" + STopic)
        .on('mouseover', function() {
            highlight_field(STopic);
            tip.show({name: (dir=='l'? 'Influx': 'Efflux') + ':\n' + totalSize});
            d3.select(this).attr('cursor', 'pointer');
        })
        .on('mouseout', reset_field);

    g.append("text")
        .attr("x", dir == 'l'? center[0] + width / 2: center[0] - width / 2)
        .attr("y", center[1] + squareSize/2)
        .attr("text-anchor", "middle")
        .attr("dominant-baseline", "middle")
        .attr("font-family", "Archivo Narrow")
        .attr("font-size", Math.sqrt(totalSize) * 10)
        .attr("class", "context-text context-text_" + STopic)
        .text(dir=='l'? 'Influx': 'Efflux') // dir=='l'? STopic + '→': '→' + STopic
        .attr("pointer-events", "none");

    // 绘制方块
    g.selectAll("rect_" + dir)
       .data(processedData)
       .enter()
       .append("rect")
       .attr("x", d => d.x)
       .attr("y", d => d.y)
       .attr("width", d => squareSize * d.edge.length)
       .attr("height", squareSize)
       .attr('id', d => d.id)
       .attr('class', "rect_" + dir)
       .attr("fill", d => topic2color(d.topic))
       .on("mouseover", function(d) {  
            // 使用 function 关键字而不是箭头函数
            d3.select(this)
            .attr("cursor", "pointer")
            .style("stroke", "red")
            .style("stroke-width", 2);
            tip.show(d.node);
       })
        .on("mouseout", function(d) {
            d3.select(this)
            .attr("cursor", "default")
            .style("stroke", "none");

            tip.hide(d.node);
        })
        .on("click", d => {
            highlight_node(d.id);
        })
}

function distance(p1, p2) {
    return Math.sqrt((p1[0] - p2[0]) ** 2 + (p1[1] - p2[1]) ** 2);
}

function getStartPoints(key, id2attr) {
    // 如果有多个路径，确保第一个和第二个路径首位相接：修改第一个路径的终止点，使其与第二个路径的起始点相接
    let startPoint = [];
    id2attr[key].path.forEach(function(path) {
        startPoint.push(path.d.split('C')[0].split('M')[1]);  
        // 起始节点字符串，如：67.03,-810
    })
    if (startPoint.length > 1) {
        for (let i = 1; i < startPoint.length; i++) {
            let p1 = id2attr[key].path[i - 1].d.split(' ').pop();
            let p2 = startPoint[i];
            let d = distance(p1.split(','), p2.split(','));
            if (d > 10) {
                alert('Not connected!', d, p1, p2);
            }
            id2attr[key].path[i - 1].d = id2attr[key].path[i - 1].d.replace(p1, p2);
        }
    }
    return startPoint;
}

function startPointAdjustment(contextEdges, id2attr) {
    if (contextEdges.length <= 1) return;
    // console.log('startPointAdjustment', contextEdges)

    let point2key = {}  // 起始节点字符串到 (context edge key, index) 的反向映射
    let pointTree = {}  // 起始节点的层次树，指向父节点

    contextEdges.forEach(function(key) {
        let lastPoint = null;
        getStartPoints(key, id2attr).forEach(function(p, i) {
            if (point2key[p] == null) point2key[p] = [];
            if (pointTree[p] == null) pointTree[p] = lastPoint;
            point2key[p].push([key, i]);
            lastPoint = p;
        })
    })

    // 拓扑搜索，找到从下到上（pointTree指向）遍历的顺序
    let order = [];
    let allPoints = new Set(Object.keys(pointTree));
    let visited = new Set();
    function dfs(node) {
        if (visited.has(node)) return;
        visited.add(node);
        if (pointTree[node] != null) dfs(pointTree[node]);
        order.push(node);
    }
    for (let p of allPoints) dfs(p);
    order.reverse();
    console.log('[startPointAdjustment]', contextEdges, pointTree, point2key, order);

    // layout adjustment
    order.forEach(function(p) {
        let keys = point2key[p];
        let totalWidth = keys.map(([key, i]) => id2attr[key].path[i].width).reduce((acc, val) => acc + val, 0);
        let baseKey = keys.filter(([key, i]) => i != 0);
        if (baseKey.length == 0) baseKey = keys[0];
        else {
            // 更新baseKey的前驱路径的宽度
            baseKey = baseKey[0];
            id2attr[baseKey[0]].path[baseKey[1] - 1].width = totalWidth;
        }
        // 更新宽度之后再判断
        if (keys.length <= 1) return;   
        let basePath = id2attr[baseKey[0]].path[baseKey[1]].d;
        let [p0, p1, p2, p3] = parseBezierCurve(basePath);
        let tangent = bezierTangent(p0, p1, p2, p3, 0);
        let baseNormal = perpendicular(normalize(tangent));

        // console.log('point', p, keys, baseNormal, totalWidth)


        let pointX = parseFloat(p.split(',')[0]), pointY = parseFloat(p.split(',')[1]);
        // point -= baseNormal * totalWidth / 2
        pointX -= baseNormal.x * totalWidth / 2;
        pointY -= baseNormal.y * totalWidth / 2;

        // 计算每条曲线的加权角度
        let angles = keys.map(([key, i]) => {
            let [p0, p1, p2, p3] = parseBezierCurve(id2attr[key].path[i].d);
            let angle1 = getAngleBetweenPoints(p0, p1);
            let angle2 = getAngleBetweenPoints(p0, p2);
            let angle3 = getAngleBetweenPoints(p0, p3);
            // 这里采用加权平均法来计算总的角度
            let totalAngle = angle1 * 0.5 + angle2 * 0.3 + angle3 * 0.2;
            return {key: [key, i], angle: totalAngle};
        });

        // console.log('angles', angles);
        angles.sort((a, b) => a.angle - b.angle);

        angles.map(a => a.key).forEach(([key, i]) => {
            let w = id2attr[key].path[i].width;
            pointX += baseNormal.x * w / 2;
            pointY += baseNormal.y * w / 2;
            id2attr[key].path[i].d = id2attr[key].path[i].d.replace(p, `${pointX},${pointY}`);
            pointX += baseNormal.x * w / 2;
            pointY += baseNormal.y * w / 2;
        });
    });
}

function endPointAdjustment(contextEdges, id2attr) {
    if (contextEdges.length <= 1) return;
    // console.log('endPointAdjustment', contextEdges)

    point2key = {}
    contextEdges.forEach(function(key) {
        let paths = id2attr[key].path;
        let endPoint = paths[paths.length - 1].d.split(' ').pop();
        Object.keys(point2key).forEach(function(p) {
            let d = distance(p.split(','), endPoint.split(','));
            if (d < 10) {
                paths[paths.length - 1].d = paths[paths.length - 1].d.replace(endPoint, p);
                endPoint = p;
            }
        })
        if (point2key[endPoint] == null) point2key[endPoint] = [];
        point2key[endPoint].push(key);
    })
    // console.log(point2key)

    // layout adjustment
    Object.keys(point2key).forEach(function(p) {
        let keys = point2key[p];
        if (keys.length <= 1) return;
        let totalWidth = keys.map(key => id2attr[key].path[id2attr[key].path.length - 1].width).reduce((acc, val) => acc + val, 0);
        let baseNormal = {x: 0, y: -1};

        // console.log('point', p, keys, baseNormal, totalWidth)
        let pointX = parseFloat(p.split(',')[0]), pointY = parseFloat(p.split(',')[1]);
        // point -= baseNormal * totalWidth / 2
        pointX -= baseNormal.x * totalWidth / 2;
        pointY -= baseNormal.y * totalWidth / 2;

        // 计算每条曲线的加权角度
        let angles = keys.map(key => {
            let path = id2attr[key].path;
            // 注意这里是最后4个！！！！
            let [p0, p1, p2, p3] = parseBezierCurveReverse(path[path.length - 1].d);
            let angle1 = getAngleBetweenPoints(p3, p2);
            let angle2 = getAngleBetweenPoints(p3, p1);
            let angle3 = getAngleBetweenPoints(p3, p0); // 注意第端点应该在前面
            // 这里采用加权平均法来计算总的角度
            let totalAngle = angle1 * 0.5 + angle2 * 0.3 + angle3 * 0.2;
            return {key: key, angle: totalAngle, angle1: angle1, angle2: angle2, angle3: angle3, points: [p0, p1, p2, p3]};
        });

        // console.log('angles', angles);
        angles.sort((a, b) => a.angle - b.angle);

        angles.map(a => a.key).forEach(key => {
            let path = id2attr[key].path;
            let w = path[path.length - 1].width;
            pointX += baseNormal.x * w / 2;
            pointY += baseNormal.y * w / 2;
            path[path.length - 1].d = path[path.length - 1].d.replace(p, `${pointX},${pointY}`);
            pointX += baseNormal.x * w / 2;
            pointY += baseNormal.y * w / 2;
        });
    });
}

function searchBundling(context, id2attr) {
    // start point adjustment
    let year2context = {}, node2context = {};  // 从左边年份/中心节点出发的context边
    Object.keys(context).forEach(function(key) {
        if (key[0] == 'l') {
            let year = key.split('->')[0];
            if (year2context[year] == null) year2context[year] = [];
            year2context[year].push(key);
        } else {
            let node = key.split('->')[0];
            if (node2context[node] == null) node2context[node] = [];
            node2context[node].push(key);
        }
    })

    Object.keys(year2context).forEach(function(year) {
        startPointAdjustment(year2context[year], id2attr);
    })
    Object.keys(node2context).forEach(function(node) {
        startPointAdjustment(node2context[node], id2attr);
    })


    // end point adjustment
    year2context = {}, node2context = {};  // 到达右边年份/中心节点的context边
    Object.keys(context).forEach(function(key) {
        if (key[0] == 'l') {
            let node = key.split('->')[1];
            if (node2context[node] == null) node2context[node] = [];
            node2context[node].push(key);
        } else {
            let year = key.split('->')[1];
            if (year2context[year] == null) year2context[year] = [];
            year2context[year].push(key);
        }
    })
    // 只调节目标为年份的context边，确定normal为y方向
    Object.keys(year2context).forEach(function(year) {
        endPointAdjustment(year2context[year], id2attr);
    })
    // Object.keys(node2context).forEach(function(node) {
    //     endPointAdjustment(graph, node2context[node]);
    // })
}

function getAngle(tangent) {
    return Math.atan2(tangent.y, tangent.x);
}

function getAngleBetweenPoints(p1, p2) {
    ret = Math.atan2(p2.y - p1.y, p2.x - p1.x);
    return ret < 0? ret + Math.PI * 2: ret;
}

function bezierTangent(p0, p1, p2, p3, t = 0) {
    let x = 3 * (1 - t) * (1 - t) * (p1.x - p0.x) +
            6 * (1 - t) * t * (p2.x - p1.x) +
            3 * t * t * (p3.x - p2.x);
    
    let y = 3 * (1 - t) * (1 - t) * (p1.y - p0.y) +
            6 * (1 - t) * t * (p2.y - p1.y) +
            3 * t * t * (p3.y - p2.y);
    
    return {x: x, y: y};
}

function normalize(vector) {
    let length = Math.sqrt(vector.x * vector.x + vector.y * vector.y);
    return {x: vector.x / length, y: vector.y / length};
}

function perpendicular(vector) {
    return {x: -vector.y, y: vector.x};
}

function parseBezierCurve(curveStr) {
    let points = curveStr.match(/[-]?\d*\.\d+|\d+/g).map(Number);
    return [
        {x: points[0], y: points[1]},  // 起点
        {x: points[2], y: points[3]},  // 控制点1
        {x: points[4], y: points[5]},  // 控制点2
        {x: points[6], y: points[7]}   // 终点
    ];
}

function parseBezierCurveReverse(curveStr) {
    // 返回最后4个点
    let points = curveStr.match(/[-]?\d*\.\d+|\d+/g).map(Number);
    let l = points.length;
    return [
        {x: points[l - 8], y: points[l - 7]},  // 起点
        {x: points[l - 6], y: points[l - 5]},  // 控制点1
        {x: points[l - 4], y: points[l - 3]},  // 控制点2
        {x: points[l - 2], y: points[l - 1]}   // 终点
    ];
}

function drawContextEdgesByTopic(graph, topic_id, dir=null) {
    // 绘制与指定topic相关的context边
    console.log('[drawContextEdgesByTopic]', topic_id, dir)
    context = {}
    Object.entries(graph['combinedContextEdges']).forEach(([key, value]) => {
        if (dir == null || dir == 'l' && key[0] == 'l' || dir == 'r' && key[0] != 'l') {
            if (Object.keys(value.topics).includes(topic_id)) {
                context[key] = JSON.parse(JSON.stringify(value));
            }
        }
    })
    drawContextEdges(graph, context, 'egroup-context-topic');
}


function drawContextEdges(graph, context=null, classname='egroup-context') {
    if (context == null) context = graph['combinedContextEdges'];
    console.log('[drawContextEdges]', classname, context);
    let color = (classname == 'egroup-context-topic'? 'red': contextEdgeColor);

    // draw context graph['edges']:
    // - edge id in Object.keys(graph['contextEdges'])
    // - using graph['id2attr'][edge]  to get the Path
    // - using graph['contextEdges'][edge].length to get width
    // - using all graph['edges'] in graph['contextEdges'][edge], find the target and use topic of target to get color

    // make flowmap based on edge bundling
    id2attr = {}    // 保存一个新的id2attr，不改变原来的id2attr
    Object.keys(context).forEach(function(edge) {
        if (!Object.keys(graph['id2attr']).includes(edge)) {
            console.log('[drawContextEdges] context edge not found, maybe flat-edges, removing edge from context', edge, graph['id2attr'][edge], context[edge])
            delete context[edge];
            return true;    // continue
        } else {
            id2attr[edge] = JSON.parse(JSON.stringify(graph['id2attr'][edge]));
        }
        let obj = context[edge];
        id2attr[edge].path.forEach(d=>{
            d.width = obj.weight  * contextEdgeWeight;
            d.color = color;
        })
    })
    searchBundling(context, id2attr);


    const edgeGroups = graph['g'].selectAll('.' + classname)
        .data(Object.keys(context)) // 使用edges数组，每个元素代表一条边
        .enter()
        .append('g')
        .attr('class', classname);

    // 在每个group中为每条边添加path元素
    edgeGroups.each(function(edge) {
        // if (!Object.keys(id2attr).includes(edge)) return true;
        const edgeGroup = d3.select(this);

        // console.log(edgeGroup, id2attr[edge].path)
        let paths = id2attr[edge].path;
        edgeGroup.selectAll('.epath')
            .data(paths)
            .enter()
            .append('path')
            .attr('d', d=>d.d)
            .style("fill", 'none')
            .style("stroke", d=>d.color)
            .style('stroke-opacity', 0.5)
            .style('stroke-width', d=>d.width)
            .attr('class', 'epath')
            .attr('id', selectorById(edge))
            .on('mouseover', function () {
                mouseoverEdge(edge, width=null);
                tip.show({name: edge});
            })
            .on('click', function () {
                // if (context[edge].weight == 1) {
                let e = context[edge].edges[0];
                highlight_edge(`${e.source}->${e.target}`);
                // }
                clickEdge(edge, width=null);
            })
            .on('mouseout', function () {
                mouseoutEdge(edge);
                tip.hide(edge);
            });

        if (edge[0] != 'l') return true; 

        // Add arrowhead to the last path
        let lastPath = paths[paths.length - 1];
        let { endPoint, tangentVector } = calculateArrowheadParams(lastPath.d);
        let normalVector = perpendicular(tangentVector);
        let arrowLength = 20;
        let arrowWidth = lastPath.width;
        let arrowPoints = [
            { x: endPoint.x + arrowLength * tangentVector.x, y: endPoint.y + arrowLength * tangentVector.y},
            { x: endPoint.x + arrowWidth / 2 * normalVector.x, y: endPoint.y + arrowWidth / 2 * normalVector.y },
            { x: endPoint.x - arrowWidth / 2 * normalVector.x, y: endPoint.y - arrowWidth / 2 * normalVector.y }
        ];

        edgeGroup.append('polygon')
            // .attr('class', 'epath-polygon')
            // .attr('id', selectorById(edge) + '_polygon')
            .attr('points', arrowPoints.map(p => `${p.x},${p.y}`).join(' '))
            .style('fill', color)
            .style('fill-opacity', 0.5);
    });
}   

function calculateArrowheadParams(d) {
    let path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", d);
    let pathLength = path.getTotalLength();
    let endPoint = path.getPointAtLength(pathLength);
    let tangentPoint = path.getPointAtLength(pathLength - 1);
    let tangentVector = {
        x: endPoint.x - tangentPoint.x,
        y: endPoint.y - tangentPoint.y
    };
    let length = Math.sqrt(tangentVector.x * tangentVector.x + tangentVector.y * tangentVector.y);
    tangentVector.x /= length;
    tangentVector.y /= length;
    return { endPoint, tangentVector };
}

function draw_bbox(graph) {
    let g = graph['g'];
    let bbox = g.node().getBBox();
    graph['bbox'] = bbox;

    const defs = g.append('defs');
    const filter = defs.append('filter')
        .attr('id', 'drop-shadow')
        .attr('x', '-20%')
        .attr('y', '-20%')
        .attr('width', '140%') // 增大过滤器的尺寸以包含阴影
        .attr('height', '140%');

    filter.append('feGaussianBlur')
        .attr('in', 'SourceAlpha')
        .attr('stdDeviation', 10) // 增大模糊半径
        .attr('result', 'blur');

    filter.append('feOffset')
        .attr('in', 'blur')
        .attr('dx', 0) // 减少水平偏移
        .attr('dy', 0) // 减少垂直偏移
        .attr('result', 'offsetBlur');

    // 使用feFlood创建阴影颜色
    const feFlood = filter.append('feFlood')
        .attr('flood-color', 'black')
        .attr('flood-opacity', 0.5)
        .attr('result', 'color');

    // 使用feComposite将阴影颜色与模糊效果合并
    filter.append('feComposite')
        .attr('in', 'color')
        .attr('in2', 'offsetBlur')
        .attr('operator', 'in')
        .attr('result', 'shadow');

    // 使用feMerge将原图形与阴影效果合并显示
    const feMerge = filter.append('feMerge');
    feMerge.append('feMergeNode')
        .attr('in', 'shadow');
    feMerge.append('feMergeNode')
        .attr('in', 'SourceGraphic');

    // 绘制g元素的外框
    g.insert('rect', ':first-child')
        .attr('x', bbox.x - bbox_padding_x)
        .attr('y', bbox.y - bbox_padding_y)
        .attr('width', bbox.width + bbox_padding_x * 2)
        .attr('height', bbox.height + bbox_padding_y * 2)
        .style("fill", 'white')
        .style("stroke", topic2color(graph['topic'], sat=1))
        .style("stroke-width", 5)
        .attr('filter', 'url(#drop-shadow)')
        .attr('id', 'background');

    // 在外框底部中心添加标题
    let topic = global_paper_field.find(d => d.id == graph['topic'])
    let sqrtSize = Math.sqrt(bbox.width * bbox.height);
    textElement = g.append('text')
        .attr('x', bbox.x + bbox.width / 2)
        .attr('y', bbox.y + sqrtSize * 0.1)
        .attr('text-anchor', 'middle')
        .attr('dominant-baseline', 'text-before-edge')
        .style('font-family', 'Archivo Narrow')
        .style('font-size', sqrtSize * 0.06 + 'px')
        // .text(topicData.shortName)
        .attr('id', 'title')
        // .style('stroke', 'white')
        // .style('stroke-width', 1)
        .on('click', function() {
            // hide text
            d3.select(this).style('display', 'none');
        });

    textElement.append("tspan")
        .attr('x', bbox.x + bbox.width / 2)
        .attr("dy", "-1em")
        .text(topic.shortName.split(' ')[0]);
    textElement.append("tspan")
        .attr('x', bbox.x + bbox.width / 2)
        .attr("dy", "1em")
        .text(topic.shortName.split(' ')[1]);
}

function generateD3Path(points, curve = false) {
    // 使用D3的线条生成器，根据curve参数决定是否使用curveBasis
    const lineGenerator = d3.line();
    if (curve) {
        lineGenerator.curve(d3.curveBasis);
    }

    const pathData = lineGenerator(points);
    return pathData;
}

function convertToPointsArray(pathString) {
    // 从路径字符串中提取坐标点
    const points = pathString.split(' ')
        .slice(1) // 去除路径字符串开头的 "e," 或其他字符
        .map(pair => {
            const cleanedPair = pair.trim().replace(/ +/g, ',');
            const coords = cleanedPair.split(',');
            if (coords.length === 2 && !isNaN(parseFloat(coords[0])) && !isNaN(parseFloat(coords[1]))) {
                return [parseFloat(coords[0]), -parseFloat(coords[1])]; // 注意：转换y坐标为负值以适应SVG坐标系统
            }
            return null;
        })
        .filter(p => p !== null); // 过滤掉任何无效坐标点

    return points;
}




function transformNodeName(name) {
    // 根据yearGrid调整节点名称
    let match = /^([lr])(\d+)$/.exec(name);
    if (match) {
        let prefix = match[1];
        let number = parseInt(match[2]);
        if (prefix === 'l') {
            return `l${Math.max((Math.floor(number / yearGrid) * yearGrid), minYear)}`;
        } else if (prefix === 'r') {
            return `r${Math.min(((Math.floor(number / yearGrid) + 1) * yearGrid) - 1, maxYear)}`;
        }
    }
    return name;
}

function transfromEdgeName(name) {
    // 根据yearGrid调整边名称
    let [src, dst] = name.split('->');
    return `${transformNodeName(src)}->${transformNodeName(dst)}`;
}

function getEdgeBundlingStr() {
    return edgeBundling == 6? '': 
    `concentrate=true
concentrate_type=${edgeBundling}`;
}



function bindSVGToElement(graph, key, elementId) {
    let svgElement = graph[key];
    let {svg: svg, g: g} = bindSVG(svgElement, elementId);

    graph[key] = svg; // 更新 svgElement 为新的 SVG 元素
    if (key === 'svg') graph['g'] = g;
}

function adjustViewBox(originalViewBox, scaleFactor = 1.3) {
    try {
        // 解析 viewBox 属性
        let viewBoxValues = originalViewBox.split(' ').map(Number);
        let viewBoxX = viewBoxValues[0];
        let viewBoxY = viewBoxValues[1];
        let viewBoxWidth = viewBoxValues[2];
        let viewBoxHeight = viewBoxValues[3];

        // 增加 viewBox 的宽度和高度，使内容显示缩小
        let newViewBoxWidth = viewBoxWidth * scaleFactor;
        let newViewBoxHeight = viewBoxHeight * scaleFactor;

        // 调整 viewBox 的 x 和 y，使内容居中
        let newViewBoxX = viewBoxX - (newViewBoxWidth - viewBoxWidth) / 2;
        let newViewBoxY = viewBoxY - (newViewBoxHeight - viewBoxHeight) / 2;

        // 重新设置 viewBox 属性
        let newViewBox = `${newViewBoxX} ${newViewBoxY} ${newViewBoxWidth} ${newViewBoxHeight}`;
        
        return newViewBox;
    } catch (error) {
        console.error("Error adjusting viewBox:", error);
        return originalViewBox;
    }
}


function bindSVG(svgElement, elementId) {
    let ele = d3.select(elementId).node();
    d3.select(elementId).selectAll("*").remove();

    let wasHidden = $(ele).is(':hidden');
    if (wasHidden) $(ele).show();

    let svgWidth = ele.getBoundingClientRect().width || $(elementId).width();
    let svgHeight = ele.getBoundingClientRect().height || $(elementId).height();

    const svg = d3.select(elementId).append("svg")
        .attr("width", svgWidth)
        .attr("height", svgHeight)
        .attr("overflow", "visible");

    let g = svg.append("g");

    d3.select(svgElement).selectAll('*').filter(function() {
        return this.parentNode === svgElement;
    }).each(function() {
        g.node().appendChild(this);
    });

    let svgbbox = svgElement.getBBox();
    let svgViewBox = svgElement.getAttribute("viewBox");
    let x, y, width, height;
    let lis = svgViewBox.split(' ').map(Number);
    x = lis[0];
    y = lis[1];
    width = lis[2];
    height = lis[3];
    console.log('[bindSVG] svgbbox', svgbbox, svgViewBox, y);

    // 确保元素可见后计算包围盒
    // let rect = g.node().getBoundingClientRect();
    // let bbox = { x: rect.left, y: rect.top, width: rect.width, height: rect.height };
    let bbox = g.node().getBBox();
    let viewBox = `${bbox.x} ${bbox.y} ${bbox.width} ${bbox.height}`;
    console.log('[bindSVG] bbox', bbox, viewBox, bbox.y);

    // 超级难受的硬编码
    svg.attr("viewBox", 
        elementId == '#mainsvg' && STopic? 
            (download==0? adjustViewBox(viewBox): `${x} ${(y + bbox.y) / 2} ${width} ${height}`): 
            viewBox)
       .attr("preserveAspectRatio", "xMidYMid meet"); // 确保内容居中并等比缩放

    // 添加缩放和拖拽功能
    const zoom = d3.zoom()
        .scaleExtent([0.01, 100])
        .wheelDelta(() => -d3.event.deltaY * 0.001) 
        .on("zoom", () => {
            g.attr("transform", d3.event.transform);
        });

    svg.call(zoom);

    // 所有渲染完成后恢复原始隐藏状态
    if (wasHidden) $(ele).hide();

    return {svg, g};
}



function showDetail(topic) {
    STopic = topic;

    let graph = topic2graph[STopic];
    console.log('current graph:', graph);
        
    init_graph(graph);
    bindSVGToElement(graph, 'svg', "#prism-detail");
    console.log('context', graph)
    draw_bbox(graph);
    draw_context(graph);
}

function drawTopicPrism() {
    
    // Append the slider and label to the prism
    let TopicPrism = document.getElementById('TopicPrism');
    // if there's no element with id rotation-slider, append the slider and label
    if (!document.getElementById('rotation-slider')) {
        const sliderLabel = document.createElement('label');
        sliderLabel.innerText = 'Speed: ';
        sliderLabel.style.position = 'absolute';
        sliderLabel.style.top = '5px';
        sliderLabel.style.left = '50px';
        sliderLabel.setAttribute('id', 'rotation-label');

        // Create the rotation speed slider
        const rotationSlider = document.createElement('input');
        rotationSlider.type = 'range';
        rotationSlider.min = '0';
        rotationSlider.max = '10';
        rotationSlider.value = '5'; // Default rotation speed
        rotationSlider.style.position = 'absolute';
        rotationSlider.style.top = '10px';
        rotationSlider.style.left = '100px';
        rotationSlider.style.padding = '5px';
        rotationSlider.style.width = '150px';
        rotationSlider.setAttribute('id', 'rotation-slider');
        TopicPrism.appendChild(rotationSlider);
        TopicPrism.appendChild(sliderLabel);

        // Adjust rotationSpeed based on slider value
        rotationSlider.addEventListener('input', () => {
            rotationSpeed = parseFloat(rotationSlider.value);
        });
    }

    let container = document.getElementById('prism-container');
    // container.replaceWith(container.cloneNode(true));
    // container = document.getElementById('prism-container');

    let prism = document.getElementById('prism');

    let lastMouseX, lastMouseY;
    currentIndex = 0;
    // prism.style.transform = `scale(${scale})`
    
    // container.style
    prismHeight = container.offsetHeight;
    const prismWidth = container.offsetWidth;
    let prismUpperMargin = 100;
    const style = window.getComputedStyle(container);
    let perspectiveDistance = parseFloat(style.perspective);
    prism.style.transform = `scale(${prismScale}) rotateX(${rotationAngleX}deg)`;

    // const topics = [
    //   { name: "Topic 1", size: 120 },
    //   { name: "Topic 2", size: 96 },
    //   { name: "Topic 3", size: 72 },
    //   { name: "Topic 4", size: 48 },
    //   { name: "Topic 5", size: 24 }
    // ];
    let topics = JSON.parse(JSON.stringify(global_paper_field));

    // const totalSize = d3.sum(topics, d => d.size);
    let { rowSums: outdegree, colSums: indegree } = sumRowsAndColumns(adjacentMatrix);
    let weights = adjustWeight(outdegree);
    // let sizes = global_paper_field.map(d => d.size);
    // weights = adjustWeight(weights.map((d, ix) => Math.sqrt(d * sizes[ix])));
    const totalSize = d3.sum(weights);
    let currentAngle = 0;
    topicRanges = [];

    topics.forEach((topic, i) => {
        console.log('prism topic', topic)
        // const topicAngle = (topic.size / totalSize) * 360;
        const topicAngle = (weights[i] / totalSize) * 360;
        const startAngle = currentAngle;
        currentAngle += topicAngle / 2;
        // const theta = (topic.size / totalSize) * 2 * Math.PI;
        const theta = (weights[i] / totalSize) * 2 * Math.PI;
        
        const width = 2 * prismRadius * Math.sin(theta / 2);
        const distance = prismRadius * Math.cos(theta / 2);

        svgWrapper = d3.select("#prism").append("div")
            .attr("id", `svg-wrapper-${topic.id}`)
            .attr("class", "svg-wrapper")
            .style("transform", `rotateY(${currentAngle}deg) translateZ(${distance}px) translateX(${prismWidth/2}px)`);

        // height 与 svg-wrapper 的高度一致
        // const height = svgWrapper._groups[0][0].offsetHeight;

        let graph = topic2graph[topic.id];
        graph['width'] = width / 72;    // 英寸转为pt
        graph['height'] = (prismHeight - prismUpperMargin) / 72;
        init_graph(graph, false);   // 不绘制context信息
        let svgElement = graph['svg'];
        console.log(graph);

        const svg = svgWrapper.append("svg")
            .style("overflow", "visible")
            .attr('id', `svg-${topic.id}`);

        svg.append("rect")
            .attr("id", "rect_" + i)
            .attr("x", -width / 2)
            .attr("y", 0)
            .attr("width", width)
            .attr("height", prismHeight)
            .attr("fill", d3.hsv(topic2color(graph['topic']).h, 0.05, 1))
            // .attr("stroke", topic2color(graph['topic'], sat=1))
            .attr("fill-opacity", graph['topic'] == global_paper_field[0].id? highlightOpacity: backgroundOpacity)
            .attr("stroke", graph['topic'] == global_paper_field[0].id? topic2color(graph['topic'], sat=1): 'none')

        let textElement = svg.append("text")
            .attr("x", 0)
            .attr("y", prismHeight / 15) // - (i % 2) * prismHeight / 30
            .attr("text-anchor", "middle")
            .attr("dominant-baseline", "middle")
            .style("font-family", "Archivo Narrow")
            .attr("font-size", Math.cbrt(width) * 5 + "px")
            .attr("fill", "black")
        
        textElement.append("tspan")
            .attr("x", 0)
            .attr("dy", "0em")
            .text(topic.shortName.split(' ')[0]);
        textElement.append("tspan")
            .attr("x", 0)
            .attr("dy", "1.2em")
            .text(topic.shortName.split(' ')[1]);


        // 创建一个新的嵌套 svg 元素并设置 viewBox 和 transform
        let nestedSvg = svg.append("svg")
            .attr("x", -width / 2)
            .attr("y", prismUpperMargin)
            .attr("width", width)
            .attr("height", prismHeight - prismUpperMargin)
            .attr("viewBox", graph['viewBox']) // 设置 viewBox
            // .attr("transform", graph['transform'])
            .attr('id', `nestedSvg-${topic.id}`); // 设置 transform

        // 将 svgElement 的子元素移动到嵌套的 svg 元素中
        // d3.select(svgElement).selectAll('*').filter(function() {
        //     return this.parentNode === svgElement;
        // }).each(function() {
        //     nestedSvg.node().appendChild(this);
        // });
        
        // 好处是无法交互
        Array.from(svgElement.childNodes).forEach(node => {
            nestedSvg.node().appendChild(node.cloneNode(true));
        });

        currentAngle += topicAngle / 2;
        const endAngle = currentAngle;
        topicRanges.push({ startAngle, endAngle });
    });

    // 绘制topview弦图
    svgWrapper = d3.select("#prism").append("div")
        .attr("id", `svg-wrapper-chord`)
        .attr("class", "svg-wrapper")
        .style("transform", `rotateX(90deg) translateZ(${prismHeight/2}px) rotateZ(180deg) translate(${prismWidth/2}px, ${prismHeight/2}px)`);
    let svg = svgWrapper.append("svg")
        .style("overflow", "visible")
        .attr('id', `svg-chord`);

    let svgElement = init_chord(isPolygenView=true, allowInteraction=false);
    d3.select(svgElement).selectAll('*').filter(function() {
        return this.parentNode === svgElement;
    }).each(function() {
        svg.node().appendChild(this);
    });

    // 底部加一个一样的边框
    svgWrapper = d3.select("#prism").append("div")
        .attr("id", `svg-wrapper-chord-bottom`)
        .attr("class", "svg-wrapper")
        .style("transform", `rotateX(90deg) translateZ(${-prismHeight/2}px) rotateZ(180deg) translate(${prismWidth/2}px, ${prismHeight/2}px)`);
    svg = svgWrapper.append("svg")
        .style("overflow", "visible")
        .attr('id', `svg-chord-bottom`);
    svgElement = init_chord(isPolygenView=true, allowInteraction=false, drawRibbon=false);
    d3.select(svgElement).selectAll('*').filter(function() {
        return this.parentNode === svgElement;
    }).each(function() {
        svg.node().appendChild(this);
    });
    update_chord_element();
    // function rotate() {
    //     // 通过移除帧率限制，你可以让 requestAnimationFrame 在浏览器的自然刷新率下更好地同步，减少 dropped frames 和 partially presented frames 的问题。
    //     if (rotationSpeed>0) { // 控制旋转速度，每秒30帧  && elapsed > 1000 / 30
    //         rotationAngleY -= 0.04 * rotationSpeed;
    //         if (rotationAngleY <= 0) rotationAngleY += 360;
    //         prism.style.transform = `scale(${prismScale}) translate(${translationX}px, ${translationY}px) rotateX(${rotationAngleX}deg) rotateY(${rotationAngleY}deg)`
    //         // prism.style.transform = `rotateY(${rotationAngleY}deg)`; 
    //         updateOpacity();
    //         requestAnimationFrame(rotate);
    //     }
    // }

    // 通过控制动画的更新频率来“模拟”不同的帧率。虽然不能直接改变刷新率，但你可以让你的动画以较低的帧率运行，从而适应不同的显示器刷新率。
    let lastTime = 0;
    const fps = 30;  // 想要的帧率

    function rotate(timestamp) {
        if (rotationSpeed==0) {
            requestAnimationFrame(rotate);
            return;
        }
        if (!lastTime) lastTime = timestamp;
        const elapsed = timestamp - lastTime;

        // 只在达到目标帧率时才更新
        if (elapsed > 1000 / fps) {
            lastTime = timestamp;
            // 更新动画逻辑
            rotationAngleY -= 0.1 * rotationSpeed;
            if (rotationAngleY <= 0) rotationAngleY += 360;
            prism.style.transform = `scale(${prismScale}) translate(${translationX}px, ${translationY}px) rotateX(${rotationAngleX}deg) rotateY(${rotationAngleY}deg)`;
            updateOpacity();
        }

        requestAnimationFrame(rotate);
    }
    
    function startRotation() {
        chord_arcs.style("opacity", defaultOpacity / 3);
        chord_ribbons.style("opacity", defaultOpacity / 3);
        isRotating = true;
        requestAnimationFrame(rotate);
    }

    container.addEventListener('mousedown', function(event) {
        console.log('mousedown', event.button)
        if (event.button === 0) { // 左键
            lastMouseX = event.clientX;
            lastMouseY = event.clientY;
            document.addEventListener('mousemove', mouseMoveHandler);
            document.addEventListener('mouseup', function onMouseUp() {
                document.removeEventListener('mousemove', mouseMoveHandler);
                document.removeEventListener('mouseup', onMouseUp);
            });
        } else if (event.button === 2) { // 右键
            lastMouseX = event.clientX;
            lastMouseY = event.clientY;
            document.addEventListener('mousemove', rightMouseMoveHandler);
            document.addEventListener('mouseup', function onMouseUp() {
                document.removeEventListener('mousemove', rightMouseMoveHandler);
                document.removeEventListener('mouseup', onMouseUp);
            });
        }
    });

    container.addEventListener('contextmenu', function(event) {
        event.preventDefault();
    });

    function mouseMoveHandler(event) {
        const deltaX = event.clientX - lastMouseX;
        const deltaY = event.clientY - lastMouseY;
        lastMouseX = event.clientX;
        lastMouseY = event.clientY;
        rotationAngleY += deltaX / 5;
        rotationAngleX -= deltaY / 5;
        rotationAngleX = Math.max(-90, Math.min(90, rotationAngleX));
        requestAnimationFrame(() => {
            prism.style.transform = `scale(${prismScale}) translate(${translationX}px, ${translationY}px) rotateX(${rotationAngleX}deg) rotateY(${rotationAngleY}deg)`;
            updateOpacity()
        });
    }

    function rightMouseMoveHandler(event) {
        const deltaX = event.clientX - lastMouseX;
        const deltaY = event.clientY - lastMouseY;
        lastMouseX = event.clientX;
        lastMouseY = event.clientY;
        translationX += deltaX;
        translationY += deltaY;
        requestAnimationFrame(() => {
            prism.style.transform = `scale(${prismScale}) translate(${translationX}px, ${translationY}px)  rotateX(${rotationAngleX}deg) rotateY(${rotationAngleY}deg)`;
        });
    }
    

    container.addEventListener('wheel', function(event) {
    //   perspectiveDistance += event.deltaY * 2;
    //   container.style.perspective = `${perspectiveDistance}px`;
        prismScale = prismScale * 0.5 ** (event.deltaY / 1000);
        prism.style.transform = `scale(${prismScale}) translate(${translationX}px, ${translationY}px) rotateX(${rotationAngleX}deg) rotateY(${rotationAngleY}deg)`;
    });

    startRotation(); // 初始化时开始旋转
}

function updateOpacity() {
    if(Math.abs(rotationAngleX) > 80) {
        d3.selectAll('rect').attr("fill-opacity", highlightOpacity);
        currentIndex = -1;
        return;
    } else {
        if (currentIndex == -1)
            d3.selectAll('rect').attr("fill-opacity", backgroundOpacity);
    }

    const activeAngle = (720 - rotationAngleY) % 360;
    let newIndex = -1;
    for (let i = 0; i < topicRanges.length; i++) {
        const { startAngle, endAngle } = topicRanges[i];
        if (startAngle <= activeAngle && activeAngle < endAngle) {
        newIndex = i;
        break;
        }
    }

    if (newIndex !== currentIndex) {
        // console.time('highlight_arc');
        highlight_arc_with_cash(newIndex, currentIndex);
        d3.selectAll('rect').attr("fill-opacity", backgroundOpacity)
            .attr("stroke", 'none');

        if (newIndex !== -1) {
            d3.select('#rect_' + newIndex).attr("fill-opacity", highlightOpacity)
            .attr("stroke", topic2color(global_paper_field[newIndex].id, sat=1));
        }
        currentIndex = newIndex;
        // console.timeEnd('highlight_arc');
    }
}

function loadAndRender() {
    loadGlobalData();
    draw_tagcloud();
    render();
}


function rotateTo(index, callback=undefined) {
    const prism = document.getElementById('prism');
    if (prism == undefined || topicRanges[index] == undefined) {
        if (callback) callback();
        return;
    }
    let rotationSpeedBackup = rotationSpeed;
    rotationSpeed = 0;
    // 计算目标角度
    let targetAngle = 360 - (topicRanges[index].startAngle + topicRanges[index].endAngle) / 2;
    const startAngle = rotationAngleY;

    // 确保目标角度和当前角度在同一范围内
    if (targetAngle - startAngle > 180) {
        targetAngle -= 360;
    } else if (startAngle - targetAngle > 180) {
        targetAngle += 360;
    }
    console.log('targetAngle', targetAngle)
    console.log('startAngle', startAngle)

    // 缓动动画参数
    const duration = 800; // 动画时长 1s
    const startTime = performance.now();
    function easeInOut(t) {
        return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
    }

    // 动画帧更新函数
    function animate(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const easedProgress = easeInOut(progress);
        rotationAngleY = startAngle + (targetAngle - startAngle) * easedProgress;
        prism.style.transform = `scale(${prismScale}) translate(${translationX}px, ${translationY}px) rotateX(${rotationAngleX}deg) rotateY(${rotationAngleY}deg)`;
        updateOpacity();
        if (progress < 1) {
            requestAnimationFrame(animate);
        } else {
            rotationSpeed = rotationSpeedBackup;
            if (callback) callback();
        }
    }

    // 启动动画
    requestAnimationFrame(animate);
}

function render() {
    yearGrid = $("#yearGrid").val();
    // alpha = $("#alphaSlider").val();
    // $("#yearGridValue").text(yearGrid);
    // $("#alphaValue").text(alpha);

    if (visType == 'matrix') {
        hideAll();
        $('#matrixsvg').show();
        drawMatrix();
        topicIndex = 0;
        // shiftSubMatrix();
        return
    }
    
    if (STopic != null || visType=='GF' || visType=='GForiginal') {
        showGF()
        updateSider(graph.nodes);
        return
    }

    updateSider();
    rotationSpeed = defaultRotationSpeed;
    $('#rotation-slider').val(rotationSpeed);
    if (visType == 'prismWebGL') {
        hideAll()
        $('#prismWebGL').empty();
        $("#prismWebGL").show();

        const loading = document.createElement('div');
        loading.id = 'loading';
        loading.style.position = 'absolute';
        loading.style.top = '50%';
        loading.style.left = '50%';
        loading.style.transform = 'translate(-50%, -50%)';
        loading.style.fontSize = '24px';
        loading.style.color = 'white';
        loading.style.display = 'none';
        loading.textContent = 'Loading...';
        document.getElementById('prismWebGL').appendChild(loading);

        drawPrism(global_paper_field);
    } else if (visType=='prism') {
        hideAll()
        $("#TopicPrism").show();
        const centerMarker = document.createElement('div');
        centerMarker.className = 'center-marker';
        document.getElementById('prism').appendChild(centerMarker);
        
        if (!isRotating) drawTopicPrism();
    }
}

function highlight_field(topic_id) {
    if (image_status == 1)  return;
    let duration = 200;
    // tip.show(d);
    // d3.select(that).attr('cursor', 'pointer');
    // highlight_topic_forceChart(topic_id);

    d3.selectAll('.paper').style('opacity', virtualOpacity);
    d3.selectAll(`.paper-t${topic_id}`).style('opacity', 1);
    
    // =========================context-polygen=========================
    d3.selectAll(".context-polygon_" + topic_id)
        .style("fill-opacity", Math.min(1, topicOpacity * 2));
    d3.selectAll(".context-ellipse_" + topic_id)
        .style("fill-opacity", Math.min(1, topicOpacity * 2));

    // =========================tagcloud=========================
    highlight_tag(topic_id);

    // =========================arc & egroup=========================
    d3.selectAll(".arc")
        .attr("fill-opacity", virtualOpacity)
        .style("stroke", "none");
    d3.selectAll(`.arc_${topic_id}`)
        .attr("fill-opacity", 1)

    d3.selectAll(".egroup").style("opacity", virtualOpacity); // virtualOpacity
    egroup = d3.selectAll(`.egroup_${topic_id}`)
        .style("opacity", 1);
    egroup.selectAll('.epath').style('stroke', 'red');
    egroup.selectAll('.epath-polygon').style('fill', 'red');
    
    // =========================cell=========================
    d3.selectAll(".topic-string")
        .style("opacity", virtualOpacity);
    d3.selectAll(`.topic-string_${topic_id}`)
        .style("opacity", 1);


    // =========================topic map=========================
    // 有了duration之后，如果鼠标滑动较快，则没法恢复
    d3.selectAll(".topic-map")
        .attr("fill-opacity", 0.2)
        .style("stroke", "none");
    d3.select("#circle" + topic_id)
        // .transition()
        // .duration(duration)
        .attr("fill-opacity", 1)
        .style("stroke", "black");

    // =========================bar & bar_egroup=========================
    d3.selectAll(".bar")
        .style("opacity", virtualOpacity);
    d3.selectAll(`.bar_${topic_id}`)
        .style("opacity", 0.7);

    // $("#mainsvg").attr("style", "background-color: #FAFAFA;");
    // 在 Stopic 面上展示所有highlight 的 edge
    // highlightContextEdge(topic_id);
    // if (STopic != null && STopic != topic_id) {
    //     drawContextEdgesByTopic(topic2graph[STopic], topic_id);
    // }
}

function highlightContextEdge(topic_id, dir=null) {
    if (STopic == null) return;
    Object.entries(topic2graph[STopic]['combinedContextEdges']).forEach(([key, value]) => {
        if (dir == null || dir == 'l' && key[0] == 'l' || dir == 'r' && key[0] != 'l') {
            if (Object.keys(value.topics).includes(topic_id)) {
                mouseoverEdge(key, width=value.topics[topic_id] * contextEdgeWeight, color=topic2color(topic_id));
            }
        }
    })
}


function reset_field(d) {
    if (image_status == 1)  return;
    reset_tag();

    d3.selectAll('.egroup').style("opacity", 1);
    d3.selectAll('.paper').style('opacity', 1);

    d3.selectAll(".context-polygon")
        .style("fill-opacity", topicOpacity);
    d3.selectAll(".context-ellipse")
        .style("fill-opacity", topicOpacity);

    // =========================arc=========================
    d3.selectAll(".arc")
        .attr("fill-opacity", 1)
        .style("stroke", "none");
    d3.selectAll(`.topic-string`)
        .style("opacity", 1);
    
    // =========================topic map=========================
    tip.hide(d);

    d3.selectAll(".topic-map")
        // .transition()
        // .duration(200)
        .attr("fill-opacity", 0.6)
        .style("stroke", `rgba(0,0,0,0.5)`);

        
    // $("#mainsvg").attr("style", "background-color: white;");
    d3.selectAll(".bar").style("opacity", 0.7);
    // d3.selectAll(".bar_egroup").style("opacity", 1);

    matrixg.selectAll('.epath')
        .style("stroke", d=> d.color)
        .style("stroke-width", d=>d.width)
        .style('opacity', 1);
    matrixg.selectAll('.epath-polygon')
        .style("fill", d=>d.color)
        .style('opacity', 1);
}

function find_child_nodes(id, graph) { 
    var ids = [];
    for (let i = 0; i < graph['edges'].length; i++) {
        if (id == graph['edges'][i].source) {
            ids.push(graph['edges'][i].target);
        }
    }
    return ids;

}

function find_parent_nodes(id, graph) {
    var ids = [];
    for (let i = 0; i < graph['edges'].length; i++) {
        if (id == graph['edges'][i].target) {
            ids.push(graph['edges'][i].source);
        }
    }
    return ids;
}

function get_neighbor(ids, graph) {
    var neighbor_ids = [];
    for (let i = 0; i < ids.length; i++) {
        neighbor_ids = neighbor_ids.concat(find_child_nodes(ids[i], graph));
        neighbor_ids = neighbor_ids.concat(find_parent_nodes(ids[i], graph));
    }
    neighbor_ids = Array.from(new Set(neighbor_ids));
    return neighbor_ids;
}

function get_extend(ids, graph) {
    var parent_ids = [];
    var new_parent_ids = ids;
    while (new_parent_ids.length != parent_ids.length) {
        parent_ids = new_parent_ids;
        for (let i = 0; i < parent_ids.length; i++) {
            new_parent_ids = new_parent_ids.concat(find_parent_nodes(parent_ids[i], graph));
        }
        new_parent_ids = Array.from(new Set(new_parent_ids));
    }
    var child_ids = [];
    var new_child_ids = ids;
    while (new_child_ids.length != child_ids.length) {
        child_ids = new_child_ids;
        for (let i = 0; i < child_ids.length; i++) {
            new_child_ids = new_child_ids.concat(find_child_nodes(child_ids[i], graph));
        }
        new_child_ids = Array.from(new Set(new_child_ids));
    }
    var extend_ids = new_child_ids.concat(new_parent_ids);
    // console.log('extend_ids:', extend_ids)
    return extend_ids;
}



function drawTTM() {
    d3.select("#TTM-graph").html("");
    // 创建 SVG 画布
    const svgSize = 400;  // 画布宽度
    let margin = 30;
    const svg = d3.select("#TTM-graph")
                .append("svg")
                .attr("width", svgSize)
                .attr("height", svgSize);

    const cellSize = (svgSize - margin * 2) / arrangement.length;
    let maxTransition = 0;
    // 根据topicTransitionMatrix计算最大转移概率
    for (let src in TTM) {
        for (let tgt in TTM[src]) {
            maxTransition = Math.max(maxTransition, TTM[src][tgt]);
        }
    }
    arrangement.forEach((src, i) => {
        arrangement.forEach((tgt, j) => {
            svg.append('rect')
                .attr('x', i * cellSize + margin)
                .attr('y', j * cellSize + margin)
                .attr('width', cellSize - 1) // 留出一点空隙以分隔列
                .attr('height', cellSize - 1)
                .attr('class', `cell cell_${src} cell_${tgt}`)
                .style("fill", `rgba(0, 0, 255)`)// i === j? `gray`: `rgba(0, 0, 255)`)
                .style("opacity", _ => {
                    if (i == j) return 1
                    if (TTM[src] && TTM[src][tgt]) {
                        return TTM[src][tgt] / maxTransition;
                    }
                    return 0;
                })
                // .style("stroke", 'black');
        });
    });

    // 绘制横坐标轴
    const xAxisScale = d3.scaleBand()
        .domain(arrangement.map(d => `${topic2order(d)}`))
        .range([0, svgSize]);

    const xAxis = d3.axisBottom(xAxisScale);

    const xAxisGroup = svg.append('g')
        .attr('transform', `translate(${cellSize / 2}, ${svgSize - margin})`)
        .call(xAxis);

    // append text on the middle up of svg
    svg.append('text')
        .attr('x', svgSize / 2)
        .attr('y', margin)
        .attr('text-anchor', 'middle')
        .text('initial cost: ' + originalCost + ',  current cost: ' + bestCost);

    xAxisGroup.selectAll('text')
        .style('text-anchor', 'end')
        .attr('dx', '-.8em')
        .attr('dy', '.15em')
        // .attr('transform', 'rotate(-90)');
}

function highlight_node(id, show_node_info=true, append=false) {   // 输入：当前node的 id
    // if (image_switch == 0)  return;
    // reset_node();
    if (append) {
        if (highlighted.includes(id)) {
            highlighted = highlighted.filter(d => d != id);
        } else {
            highlighted.push(id);
        }
    } else {
        highlighted = [id];
    }
    
    // 仅仅显示当前所选topic的extend_ids
    // ids = get_extend(highlighted, topic2graph[STopic]);
    ids = get_neighbor(highlighted, topic2graph[STopic]);
    // console.log('highlighted:', highlighted, 'append:', append)
    ids = ids.concat(highlighted);

    // if (draw_hypertree) draw_hyper_tree(id);

    d3.selectAll('.paper').style('opacity', virtualOpacity).style('stroke', 'none');
    // d3.selectAll(`.paper-${id}`).style('opacity', 1);
    ids.forEach(id => {
        d3.selectAll(`.paper-${id}`).style('opacity', 1);
    });
    highlighted.forEach(id => {
        d3.selectAll(`.paper-${id}`).style('stroke', 'red').style('stroke-width', 5);
    });
    
    d3.selectAll('.egroup').style('opacity', virtualOpacity);
    highlighted.forEach(id => {
        egroup = d3.selectAll(`.egroup_${id}`).style('opacity', 1);
        egroup.selectAll('.epath').style('stroke', 'red');
        egroup.selectAll('.epath-polygon').style('fill', 'red');
    })
    d3.selectAll('.bar')
        .style("opacity", virtualOpacity)
    d3.selectAll(`.bar_${id}`)
        .style("opacity", 0.7)
        .style("stroke", "red")
        .style("stroke-width", 3);
    extend_ids.forEach(id => {
        d3.selectAll(`.bar_${id}`)
            .style("opacity", 0.7);
    });

    // if (STopic != null) {
    //     // highlight context edge and relevant stream
    //     let graph = topic2graph[STopic];
    //     console.log('node!!', id, graph['contextEdges'])
    //     Object.keys(graph['id2attr']).forEach(edgeId => {
    //         if (edgeId.indexOf('->') !== -1 && edgeId.indexOf(id) !== -1) {
    //             mouseoverEdge(edgeId);
    //         }
    //     });
    // }
    

    if (show_node_info) {
        $("#paper-list, #up-line, #down-line, #edge-info").hide();
        $("#selector, #node-info, #node-info-blank").show();

        // 初始设置，第一个按钮加粗，透明度为1，其他按钮透明度为0.5
        $(".address-text button").css({ 'font-weight': 'normal', 'opacity': 0.5 });
        $(".address-text button:first").css({ 'font-weight': 'bold', 'opacity': 1 });

        //更新node-info里的内容
        let fieldLevelVal = $("#field-level").val();
        let ns = global_nodes;
        for (let i = 0; i < ns.length; i++) {
            if (global_nodes[i].id == id) {
                $('#paper-id').text(ns[i].id);
                $('#paper-name').text(ns[i].name);
                $('#paper-year').text(ns[i].year);
                $('#paper-citation').text(ns[i].citationCount);
                if (ns[i].citationCount == '-1') {
                    $('#paper-citation').text("Not available");
                }
                $('#paper-authors').text(ns[i].authors);
                $('#paper-prob').text((parseFloat(ns[i].isKeyPaper)).toFixed(2));
                $('#paper-venue').text(ns[i].venu);
                
                let topic = getTopic(ns[i].topic);
                $('#paper-field').text(topic.name.split(' ').join(', '));
                $('#abstract').text(ns[i].abstract);
            }
        }
    }
}

function reset_node(reset_info=false) {
    // console.log('reset_node called')

    d3.selectAll('.bar')
        .style('opacity', 0.7)
        .style("stroke", "none");
        
    d3.selectAll('.egroup').style("opacity", 1);
    d3.selectAll('.paper').style('opacity', 1);
    d3.selectAll('.paper').style('stroke', 'none');

    matrixg.selectAll('.epath')
        .style("stroke", d=> d.color)
        .style("stroke-width", d=>d.width)
        .style('opacity', 1);
    matrixg.selectAll('.epath-polygon')
        .style("fill", d=>d.color)
        .style('opacity', 1);
    
    highlighted = [];
    extend_ids = [];
    if (reset_info) { 
        $("#selector, #node-info, #node-info-blank, #up-line, #down-line, #edge-info").hide();
        $("#paper-list").show();
    }
}

function visual_topics() {
    $("#topic-slider").val(0.5);
    $("#topic-slider").show();

    console.log('visual_topics');

    // let topic_width = $("#topic-map-graph").width();
    let ele = d3.select('.address-text').node();
    let topic_width = ele.getBoundingClientRect().width;
    let topic_height = topic_width - $("#topic-map-banner").height();
    const topic_margin1 = 35;
    const topic_margin2 = 20;

    d3.select("#topic-map-svg").remove();

    var maxNum = d3.max(global_paper_field, d => d.num);
    var topic_r = (4 / Math.sqrt(maxNum)).toFixed(2);
    if (topic_r > 2) {
        topic_r = 2;
    }
    $("#topic-label").text(topic_r);
    $("#topic-slider").val(topic_r);

    var xScale = d3.scaleLinear()
        .domain([d3.min(global_paper_field, d => d.x), d3.max(global_paper_field, d => d.x)])
        .range([0, topic_width - 2 * topic_margin1]);

    var yScale = d3.scaleLinear()
        .domain([d3.min(global_paper_field, d => d.y), d3.max(global_paper_field, d => d.y)])
        .range([topic_height * 0.85 - 2 * topic_margin2, 0]);

    const topic_map_svg = d3.select("#topic-distribution").append("svg")
        .attr("width", topic_width)
        .attr("height", topic_height * 0.85)
        .attr("id", "topic-map-svg");
        
    const topic_map_g = topic_map_svg.append('g')
        .attr("transform", `translate(${topic_margin1}, ${topic_margin2})`);
    
    const topics = topic_map_g.selectAll(".topic-map").data(global_paper_field).enter().append("circle")
        .attr("cx", d => xScale(d.x))
        .attr("cy", d => yScale(d.y))
        .attr("r", d => Math.sqrt(d.num) * 10 * topic_r)
        .style("fill", d => topic2color(d.id))
        .style("stroke", `rgba(0, 0, 0, 0.2)`)
        .style("stroke-width", 0.5)
        // .attr("filter", "url(#f1)")
        .style('fill-opacity', 0.6)
        .attr("id", d => 'circle' + d.id)
        .attr("class", "topic-map");

    topics
    .on('mouseover', function(d) {
        highlight_field(d.id);
        tip.show(d);
        d3.select(this).attr('cursor', 'pointer');
    })
    .on('mouseout', reset_field);
    
    if (global_paper_field.length == 0) {
        $("#topic-slider").hide();
    }

}

function highlight_edge(id, show_edge_info=true) {
    console.log('highlight_edge', id)
    let id_arr = id.split('->');
    var source = id_arr[0], target = id_arr[1];
    highlighted = [id];

    // g.selectAll('.epath').style('stroke', 'black').style('opacity', virtualOpacity);
    // g.select('#' + selectorById(id))
    //     .style('stroke', 'red')
    //     .style('fill', 'red')
    //     .style('opacity', 1);
    
    $("#paper-list, #selector, #node-info, #node-info-blank, #up-line, #down-line").hide();
    $("#edge-info").show();
    
    if (show_edge_info) {
        //更新edge-info中的内容
        let ns = global_nodes, es = global_edges;
        for (var i = 0; i < ns.length; i++) {
            if (ns[i].id == source) {
                $('#source-paper').text(ns[i].name);
                $('#source-paper-year').text(ns[i].year);
                $('#source-paper-venu').text(ns[i].venu);
                $('#source-paper-citation').text(ns[i].citationCount);
            }
            if (ns[i].id == target) {
                $('#target-paper').text(ns[i].name);
                $('#target-paper-year').text(ns[i].year);
                $('#target-paper-venu').text(ns[i].venu);
                $('#target-paper-citation').text(ns[i].citationCount);
            }
        }
        for (var i = 0; i < es.length; i++) {
            if (es[i].source == source && es[i].target == target) {
                $('#citation-context').text(es[i].citation_context);
                $('#extend-prob').text(String(es[i].extends_prob));
                break;
            }
        }
    }
}

function updateOutlineColor(isKeyPaper, citationCount) {
    let outlineColorVal = $("#outline-color").val();
    if (outlineColorVal == 0)  return 'black';
    if (outlineColorVal == 1)  return isKeyPaper >= 0.5? 'red': 'black';
    
    // outlineColorVal == 2
    if (citationCount < 50)   return '#2271E0'; // back
    else if (citationCount < 100) return 'DarkOrange';
    return 'red';
}


function updateVisType() {
    visType = $("#vis-type").val();
    STopic = null;
    render();
}


function downloadSVGElement(elementId) {
    // 获取 SVG 元素
    const svgElement = document.getElementById(elementId);

    // 确保元素存在
    if (svgElement) {
        // 将 SVG 元素序列化为字符串
        const serializer = new XMLSerializer();
        const source = serializer.serializeToString(svgElement);

        // 创建 Blob 对象
        const svgBlob = new Blob(['<?xml version="1.0" standalone="no"?>\r\n' + source], { type: 'image/svg+xml;charset=utf-8' });

        // 创建 URL 对象
        const url = URL.createObjectURL(svgBlob);

        // 创建临时下载链接
        const downloadegroup = document.createElement('a');
        downloadegroup.href = url;
        downloadegroup.download = elementId + '.svg';

        // 触发下载
        document.body.appendChild(downloadegroup);
        downloadegroup.click();

        // 清理临时链接和 URL 对象
        document.body.removeChild(downloadegroup);
        URL.revokeObjectURL(url);
    } else {
        console.error(`SVG element with id "${elementId}" not found.`);
    }
}