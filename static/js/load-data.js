let global_nodes, global_edges, global_paper_field, minYear, maxYear;
let global_colors = {}; // 仅初始化一次，后续有相同不再更新
let global_coauthors = {};
let paperID2topic = {};
let global_keywords = {};
let mergeTopicDict = {
    '2225733586': [[4, 74, 36]],
    'graphdrawing': [[11, 6], [23, 13, 21, 29], [12, 18]]
}
let topic2graph = {};
let STopic = null;
let paperID2year = {};
let authorData;
let TTM = {}, TTMEdges = {};   // topicTransitionMatrix
let viz, vizContext;
let prismRadius;  // basePrismRadius * global_nodes.length / 100
let prismHeight;

let defaultRotationSpeed = 5;
let rotationSpeed = defaultRotationSpeed; // 每帧旋转的角度
let basePrismRadius = 400;
let prismScale;   // basePrismScale * 100 / global_nodes.length
let basePrismScale = 0.9;
let rotationAngleY = 0, rotationAngleX = -25, translationX = 0, translationY = 0;
let isRotating = false; // 用于控制旋转的状态
let download = 0;

let dot = '';
let edgeBundling = 1, nodeShape = 3;
let isCollapse = true, regular=true, enlarge=0;
let maxOpacity = 0.8;
let defaultOpacity = 0.9;
let currentIndex = -1;
let switchtagcloud = false;
let config;



function selectorById(id) {
    if (id.indexOf('->'))
        return 'e' + id.replace('->', '_');

    return 'n' + id;
}

function calculateRadiiSteven(perceivedAreas) {
    let actualAreas = perceivedAreas.map(perceivedToActualArea);
    let totalActualArea = actualAreas.reduce((a, b) => a + b, 0);
    let maxRadius = Math.sqrt(totalActualArea / Math.PI);

    let radii = [];
    let currentArea = totalActualArea;

    for (let i = 0; i < actualAreas.length; i++) {
        let radius = Math.sqrt(currentArea / Math.PI);
        radii.push(radius);
        currentArea -= actualAreas[i];
    }

    // Normalize radii so that the outermost radius is 1
    let normalizedRadii = radii.map(r => r / maxRadius);
    return normalizedRadii;
}

function calculateRadii(weigths) {
    // 最外圈为1，按照权重直接线性缩放
    //      如(1,1,1,1)，那么半径为(1,0.75,0.5,0.25)
    //      如(1,2,3,4)，那么半径为(1, 0.9, 0.7, 0.4)

    let total = weigths.reduce((a, b) => a + b, 0);
    let current = total;
    let radii = []
    weigths.forEach(w => {
        radii.push(current / total);
        current -= w;
    })
    return radii;
}

function hsvToColor(color, sat=0.4) {
    // return d3.hsv(d.color[0], d.color[1] * 0.5 + 0.5, d.color[2]);
    return d3.hsv(color[0], sat, color[2]) //  color[1]
}

function topic2color(topic, sat=undefined) {
    // console.log('Initial topic:', topic);    null
    // console.log('typeof topic:', typeof topic);  string

    let c = d3.hsv(d3.color("#d9d9d9"));
    if (!isNull(topic)) {
        topic = parseInt(topic);
        c = global_colors[topic];
    }
    c = [c.h, c.s, c.v];
    
    return sat == undefined? hsvToColor(c): hsvToColor(c, sat);
}

function createDot(graph) {
    /*
    Generates a DOT graph representation.

    Inputs:
        graph['nodes']: A list of node objects, each with 'id', 'citationCount', 'year' attributes.
        graph['edges']: A list of edge objects, each with 'source' and 'target' attributes.
        minYear: The minimum year among the graph['nodes'].
        maxYear: The maximum year among the graph['nodes'].
    */
    let size = '';
    if (graph['width']!=undefined && graph['height']!=undefined) {
        size = `size="${graph['width']},${graph['height']}"\nratio="fill"`;
    }

    // ${getEdgeBundlingStr()}\n
    let dot = `digraph G {\n${size}\n`; // \nnode [shape=circle]
    let yearDic = {};

    for (let year = minYear; year <= maxYear; year++) {
        dot += `year${year} [label="${year}"]\n`;
        yearDic[year] = [`year${year}`]
    }
    graph['nodes'].forEach(node => {
        // const label = node.name.replace(/"/g, '\\"'); // 转义名称中的双引号
        let suffix = '';
        // if (isCollapse && node.citationCount < 10) {
        //     suffix = 'shape=point';
        // } else {
        if (nodeShape == 1 || nodeShape == 2) suffix = 'shape=box';
        else if (nodeShape == 3) suffix = 'shape=hexagon';

        if (isCollapse) {
            if (node.citationCount < 50) suffix += ' fontsize=15';
            else if (node.citationCount < 100) suffix += ' fontsize=20';
            else suffix += ' fontsize=25';
        }
        if (regular) suffix += ' regular=true';

        dot += `${node.id} [label=${node.citationCount} ${suffix}]\n`;
        // 对于每个年份，收集节点ID
        yearDic[node.year].push(node.id);
    });
    // 对每个年份的节点使用rank=same来强制它们在同一层
    for (let year of Object.keys(yearDic)) 
        dot += `{ rank=same ${yearDic[year].join(' ')} }\n`;
    for (let year = minYear; year < maxYear; year++) 
        dot += `year${year}->year${year+1}\n`;

    graph['edges'].forEach(edge => {
        dot += `${edge.source}->${edge.target}\n`;
    });

    dot += '}';
    graph['dot'] = dot
}

function processDotContext(graph) {
    /*
    Processes a dot graph to adjust and filter graph['nodes'] and graph['edges'] based on context graph['edges'] and a yearGrid system.

    Inputs:
        dot: A string containing the dot graph.
        graph['contextEdges']: Dictionary where keys are 'lxxxx->rxxxx' edge strings and values are attributes like weight.
        yearGrid: Integer value representing the yearGrid size for adjusting years in node labels.
        graph['virtualEdges']: virtual graph['edges'] connecting the components 

    Returns:
        output: A string containing the processed dot graph with graph['nodes'] and graph['edges'] adjusted based on the context.
    */
    let l = minYear;
    let r = maxYear;
    let labels = '';
    let focusEdgesStr = '';
    ranks = '';

    // 解析 .dot 输入以分类行并更新年份
    graph['dot'].split('\n').forEach(line => {
        if (line.includes('year')) {
            if (line.includes('rank')) {
                ranks += line + '\n';
            }
        } else if (line.includes('label')) {
            labels += '\t' + line + '\n';
        } else if (line.includes('->')) {
            focusEdgesStr += '\t' + line + '\n';
        }
    });

    // 替换年份标签
    let newRanks = [];
    ranks.split('\n').forEach(line => {
        let match = /year(\d+)/.exec(line);
        if (match && parseInt(match[1], 10) >=l && parseInt(match[1], 10) <= r) {
            newRanks.push(line.replace(/year(\d+)/, (match, p1) => `l${p1} r${p1}`));
        }
    });
    ranks = newRanks.join('\n');

    // 生成左右节点的链
    let leftNodes = Array.from({ length: r - l + 1 }, (_, i) => `l${l + i}`).join('->');
    let rightNodes = Array.from({ length: r - l + 1 }, (_, i) => `r${l + i}`).join('->');

    // 处理并合并contextEdges，可能把多年合并到一年
    graph['combinedContextEdges'] = {};
    Object.entries(graph['contextEdges']).forEach(([edge, edgeList]) => {
        let weight = edgeList.length;
        let newEdge = transfromEdgeName(edge);
        graph['combinedContextEdges'][newEdge] = graph['combinedContextEdges'][newEdge] || 
            { topics:{}, name: newEdge, edges: [], weight: 0, penwidth: 0, port: newEdge[0] === 'l' ? 'tailport=e' : 'headport=w' };
        
        graph['combinedContextEdges'][newEdge].weight += weight;
        graph['combinedContextEdges'][newEdge].penwidth += weight;  // 假设 penwidth 是累积的
        for (let edge of edgeList) {
            graph['combinedContextEdges'][newEdge].edges.push(edge);
            let topic = newEdge[0] == 'l'? paperID2topic[edge.source]: paperID2topic[edge.target];
            graph['combinedContextEdges'][newEdge].topics[topic] = (graph['combinedContextEdges'][newEdge].topics[topic] || 0) + 1;
        }
    });

    // 生成上下文边字符串
    let contextEdgesStr = Object.entries(graph['combinedContextEdges']).map(([edge, data]) =>
        `${edge} [color="lightgray", ${data.port}, weight=${data.weight}, penwidth=${data.penwidth}]`
    ).join('\n');
    let virtualEdgesStr = graph['virtualEdges'] ? graph['virtualEdges'].map(edge => `${edge} [style="invis"]`).join('\n') : '';
    
    if (rightVirtualEdgeDict[authorID] && rightVirtualEdgeDict[authorID][graph['topic']]) {
        rightVirtualEdgeDict[authorID][graph['topic']].forEach(paperID => {
            // let year = graph['nodes'].find(node => node.id === paperID).year;
            let edge = `${paperID}->r${minYear}`;
            virtualEdgesStr += `${edge} [style="invis"]\n`;
        })
    }

    let size = '';
    if (graph['width']!=undefined && graph['height']!=undefined) {
        size = `size="${graph['width']},${graph['height']}"\nratio="fill"`;
        console.log('size', size);
    }

    // 生成最终输出 DOT 字符串 node [shape=circle]
    graph['dotContext'] = `digraph G {
${size}
crossing_type=1
${getEdgeBundlingStr()}

subgraph left {
    style=filled
    color=lightgrey
    node [style=filled,color=lightblue]
${leftNodes} [weight=10000]
    label = "left"
}

subgraph focus{
    edge [weight=${alpha}]
${labels}
${focusEdgesStr}
}

subgraph right {
    style=filled
    color=lightgrey
    node [style=filled,color=lightgrey]
${rightNodes} [weight=10000]
    label = "right"
}

${ranks}
${contextEdgesStr}
l${l}->r${l} [style="invis"]
${virtualEdgesStr}
}`;
}

function parseSVG(graph) {
    graph['id2attr'] = {};
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    // 解析节点
    graph['svgElement'].querySelectorAll('g.node').forEach(node => {
        const title = node.querySelector('title').textContent;
        const shape = node.querySelector('ellipse, polygon, rect'); // 支持椭圆或多边形
        const text = node.querySelector('text');

        let cx, cy, rx, ry;

        if (shape.tagName === 'ellipse') {
            cx = parseFloat(shape.getAttribute('cx'));
            cy = parseFloat(shape.getAttribute('cy'));
            rx = parseFloat(shape.getAttribute('rx'));
            ry = parseFloat(shape.getAttribute('ry'));
        } else if (shape.tagName === 'rect') {
            const x = parseFloat(shape.getAttribute('x'));
            const y = parseFloat(shape.getAttribute('y'));
            const width = parseFloat(shape.getAttribute('width'));
            const height = parseFloat(shape.getAttribute('height'));

            cx = x + width / 2;
            cy = y + height / 2;
            rx = width / 2;
            ry = height / 2;
        } else if (shape.tagName === 'polygon') {
            // 根据多边形的具体形状解析
            const points = shape.getAttribute('points').split(' ').map(point => point.split(',').map(Number));
            const xs = points.map(point => point[0]);
            const ys = points.map(point => point[1]);
            cx = (Math.min(...xs) + Math.max(...xs)) / 2;
            cy = (Math.min(...ys) + Math.max(...ys)) / 2;
            rx = (Math.max(...xs) - Math.min(...xs)) / 2;
            ry = (Math.max(...ys) - Math.min(...ys)) / 2;
        }

        minX = Math.min(minX, cx - rx);
        maxX = Math.max(maxX, cx + rx);
        minY = Math.min(minY, cy - ry);
        maxY = Math.max(maxY, cy + ry);
        
        graph['id2attr'][title] = {
            id: title,
            fill: shape.getAttribute('fill'),
            stroke: shape.getAttribute('stroke'),
            x: cx,
            y: cy,
            rx: rx,
            ry: ry,
            label: text ? text.textContent : ''
        };
    });

    // 解析边
    graph['svgElement'].querySelectorAll('g.edge').forEach(edge => {
        // dismiss port
        const title = edge.querySelector('title').textContent.replace(/:w|:e/g, '');;
        const paths = edge.querySelectorAll('path');
        const polygon = edge.querySelector('polygon');

        let edgePaths = Array.from(paths).map(path => ({
            fill: path.getAttribute('fill'),
            stroke: path.getAttribute('stroke'),
            d: path.getAttribute('d'),
            s: getEndPoint(path.getAttribute('d'), 's'),
            t: getEndPoint(path.getAttribute('d'), 't')
        })).sort((a, b) => {
            const distanceA = Math.sqrt(Math.pow(a.t.x - b.s.x, 2) + Math.pow(a.t.y - b.s.y, 2));
            const distanceB = Math.sqrt(Math.pow(b.t.x - a.s.x, 2) + Math.pow(b.t.y - a.s.y, 2));
            return distanceA - distanceB; // 排序，使得路径首位相连
        });

        graph['id2attr'][title] = {
            id: title,
            name: title,
            path: edgePaths,
            polygon: polygon ? {
                fill: polygon.getAttribute('fill'),
                stroke: polygon.getAttribute('stroke'),
                points: polygon.getAttribute('points')
            } : null
        };
    });
    // graph['viewBox'] = graph['svgElement'].getAttribute('viewBox');
    // let viewBoxHeight = parseFloat(graph['viewBox'].split(' ')[3]);
    // let transform = `translate(0,${viewBoxHeight})`;
    // graph['transform'] = graph['svgElement'].getAttribute('transform');

    graph['viewBox'] = `${minX} ${minY} ${maxX - minX} ${maxY - minY}`;
    graph['transform'] = `translate(0,${maxY - minY})`;

    graph['nodes'].forEach(node => {
        Object.assign(node, graph['id2attr'][node.id]);
    });
    graph['edges'].forEach(edge => {
        let edgeKey = edge.source + '->' + edge.target;
        Object.assign(edge, graph['id2attr'][edgeKey]);  // 合并边的属性
    });
}

// 获取路径的起点或终点
function getEndPoint(d, type) {
    let points = d.match(/([0-9.-]+),([0-9.-]+)/g);
    if (!points) return { x: 0, y: 0 };
    points = points.map(pt => {
        const coords = pt.split(',');
        return { x: parseFloat(coords[0]), y: parseFloat(coords[1]) };
    });
    return type === 's' ? points[0] : points[points.length - 1];
}

function probToOpacity(prob, a=0.2) {
    // 将透明度从[0.3, 0.8]映射到 [a, 1] 范围
    const opacity = Math.min(Math.max((prob - 0.3) / (0.8 - 0.3), 0), 1);
    return a + (maxOpacity - a) * opacity;
}

function probToWidth(prob, a=1, b=4) {
    const opacity = Math.min(Math.max((prob - 0.3) / (0.8 - 0.3), 0), 1);
    let ret = a + opacity * (b - a);
    return ret;
}

function init_graph(graph, context=true) {
    if (graph['topic'] == null) context = false;
    else {
        Object.keys(graph['contextEdges']).forEach(name => {
            edges = graph['contextEdges'][name];
            if (name[0] == 'l') {
                let nodeId = name.split('->')[1];
                let node = graph['nodes'].find(node => node.id == nodeId);
                let topics = edges.map(edge => paperID2topic[edge.source]); // context节点的话题
                topics.forEach(topic => {
                    if (node.topicDist[topic]) node.influx = topic;
                })
            } else {
                let nodeId = name.split('->')[0];
                let node = graph['nodes'].find(node => node.id == nodeId);
                let topics = edges.map(edge => paperID2topic[edge.target]); // context节点的话题
                topics.forEach(topic => {
                    if (node.topicDist[topic]) node.efflux = topic;
                })
            }
        })
    }

    createDot(graph);
    if (graph['topic'] !== null && context) {
        // subgraph + context
        processDotContext(graph);
        graph['svgElement'] = vizContext.renderSVGElement(graph['dotContext']);
    } else {
        graph['svgElement'] = viz.renderSVGElement(graph['dot']);
    }
    
    parseSVG(graph);
    // console.log(graph['svgElement'], graph);

    // 创建一个无主的SVG元素
    let svgElement = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    // let viewBoxHeight = parseFloat(graph['viewBox'].split(' ')[3]);
    // let transform = `translate(0,${viewBoxHeight})`;
    svgElement.setAttribute('viewBox', graph['viewBox']);
    // svgElement.setAttribute('transform', graph['transform']);

    let svg = d3.select(svgElement);
    matrixg = svg.append('g');
    graph['g'] = matrixg;

    if (context) drawContextEdges(graph);

    // 绘制每条边的所有路径
    // 为每条边创建一个独立的group元素
    const edgeGroups = matrixg.selectAll('.egroup')
        .data(graph['edges']) // 使用edges数组，每个元素代表一条边
        .enter()
        .append('g')
        .attr('class', d => `egroup egroup_${d.source} egroup_${d.target} 
            egroup_${paperID2topic[d.source]} egroup_${paperID2topic[d.target]}`);

    // 在每个group中为每条边添加path元素
    edgeGroups.each(function(edge) {
        const edgeGroup = d3.select(this);

        if (edge.path == undefined) {
            console.log('edge path undefined', edge);
            return true;
        }
        // console.log('draw edge', edge, probToOpacity(edge.extends_prob), probToWidth(edge.extends_prob))
        edgeGroup.selectAll('.epath')
            .data(edge.path) // 绑定每条边的路径数组
            .enter()
            .append('path')
            .attr('d', d=>{
                d.width = probToWidth(edge.extends_prob);
                d.color = 'black';
                return d.d
            })
            .style("fill", 'none')
            .style("stroke", 'black')
            .style('stroke-opacity', probToOpacity(edge.extends_prob))
            .style('stroke-width', probToWidth(edge.extends_prob))
            .attr('class', 'epath')
            .attr('id', selectorById(edge.name))
            .on('mouseover', function () {
                mouseoverEdge(edge.name);
                tip.show({name: edge.name});
            })
            .on('click', function () {
                highlight_edge(edge.name);
                clickEdge(edge.name);
            })
            .on('mouseout', function () {
                mouseoutEdge(edge.name);
                tip.hide({name: edge.name});
            });
            
        if (!edge.polygon) {
            return true;
        }
        edgeGroup.append('polygon')
            .attr('points', edge.polygon.points)
            .style('stroke', 'none')
            .style('fill', d=>{
                d.color = 'black';
                return 'black'
            })
            .style("fill-opacity", probToOpacity(edge.extends_prob))
            .attr('class', 'epath-polygon')
            .attr('id', selectorById(edge.name) + '_polygon')
            .on('mouseover', function () {
                mouseoverEdge(edge.name);
                tip.show(edge);
            })
            .on('click', function () {
                highlight_edge(edge.name);
                clickEdge(edge.name);
            })
            .on('mouseout', function () {
                mouseoutEdge(edge.name);
                tip.hide(edge);
            });
    });

    let circle;
    let enlarge_ratio = {0: 1, 1: 1.5, 2: 2}[enlarge % 3]
    if (nodeShape == 0)
        circle = matrixg.selectAll('paper').data(graph['nodes']).enter().append('g')
            .each(function(d) {
                let topics, radii;
                if (graph['topic'] == null) {
                    topics = [d.topic];
                    radii = [1];
                } else {
                    topics = [d.influx, graph['topic'], d.efflux].filter(t => t !== undefined);
                    radii = calculateRadii(topics.map(t => d.topicDist[t]));
                }
                // 从外向内绘制同心圆
                for (let i = 0; i < topics.length; i++) {
                    d3.select(this).append('ellipse')
                        .attr('cx', d.x)
                        .attr('cy', d.y)
                        .attr('rx', d.rx * radii[i] * enlarge_ratio)
                        .attr('ry', d.ry * radii[i] * enlarge_ratio)
                        .style("fill", topic2color(topics[i]));
                }
            });
    if(nodeShape == 1)
        circle = matrixg.selectAll('paper').data(graph['nodes']).enter().append('g')
            .each(function(d) {
                let topics, radii;
                if (graph['topic'] == null) {
                    topics = [d.topic];
                    radii = [1];
                } else {
                    topics = [d.influx, graph['topic'], d.efflux].filter(t => t !== undefined);
                    radii = calculateRadii(topics.map(t => d.topicDist[t]));
                }
                // 从外向内绘制同心矩形
                for (let i = 0; i < topics.length; i++) {
                    d3.select(this).append('rect')
                        .attr('x', d.x - d.rx * radii[i] * enlarge_ratio)
                        .attr('y', d.y - d.ry * radii[i] * enlarge_ratio)
                        .attr('width', d.rx * 2 * radii[i] * enlarge_ratio)
                        .attr('height', d.ry * 2 * radii[i] * enlarge_ratio)
                        .style("fill", topic2color(topics[i]));
                }
            });

    if (nodeShape == 2) 
        circle = matrixg.selectAll('paper').data(graph['nodes']).enter().append('g')
            .attr('transform', d => {
                let w = d.rx * 3;
                let h = d.ry * 5;
                return `translate(${d.x - w / 2}, ${d.y - h * 0.4}) scale(${w / bookWidth}, ${h / bookHeight})`;
            })
            .each(function(d) {
                bookPaths.forEach(path => {
                    d3.select(this).append('path')
                        .attr('d', path)
                        .style('fill-opacity', 0.4)
                        .style('fill', updateOutlineColor(d.isKeyPaper, d.citationCount));
                });
            })
    if (nodeShape == 3)
        circle = matrixg.selectAll('paper').data(graph['nodes']).enter().append('g')
            .each(function(d) {
                let topics, radii;
                if (graph['topic'] == null) {
                    topics = [d.topic];
                    radii = [1];
                } else {
                    topics = [d.influx, graph['topic'], d.efflux].filter(t => t !== undefined);
                    radii = calculateRadii(topics.map(t => d.topicDist[t]));
                }
                // 从外向内绘制同心多边形
                for (let i = 0; i < topics.length; i++) {
                    d3.select(this).append('polygon')
                        .attr('points', function(d) {
                            const rx = d.rx * radii[i] * enlarge_ratio;
                            const ry = d.ry * radii[i] * enlarge_ratio;
                            const x = d.x;
                            const y = d.y;
                            return [
                                [x + rx, y].join(','),
                                [x + rx / 2, y + ry].join(','),
                                [x - rx / 2, y + ry].join(','),
                                [x - rx, y].join(','),
                                [x - rx / 2, y - ry].join(','),
                                [x + rx / 2, y - ry].join(',')
                            ].join(' ');
                        })
                        .style("fill", topic2color(topics[i]));
                }
            });

    
    if (!isCollapse && (nodeShape == 0 || nodeShape == 1 || nodeShape == 3))
        circle.style("stroke", d => updateOutlineColor(d.isKeyPaper, d.citationCount))
            .style('stroke-width', d => d.citationCount >= 50? 5: 0);
    
    circle
        .attr('id', d => d.id)
        .attr('class', d => {
            let c = `paper paper-${d.id}`;
            global_paper_field.forEach(field => {
                if (hasTopic(d, field.id)) {
                    c += ` paper-t${field.id}`;
                }
            })
            return c;
        }).on('mouseover', function (d) {
            d3.select(this).attr('cursor', 'pointer');
            tip.show(d);
            if (!highlighted.includes(d.id)) {
                // console.log('node!', id, graph['contextEdges'])
                d3.selectAll(`.paper-${d.id}`).style('stroke', 'red').style('stroke-width', 5);
                
                let flux_pairs = [];
                Object.entries(graph['combinedContextEdges']).forEach(([edgeId, value]) => {
                    if (edgeId.indexOf(d.id) !== -1) {
                        mouseoverEdge(edgeId, width=null);
                        let dir = edgeId[0] == 'l'? 'l': 'r';
                        Object.keys(value['topics']).forEach(topic => {
                            flux_pairs.push([dir, topic]);
                        });
                    }
                });
                console.log('flux_pairs', flux_pairs);
                mouseOverFluxes(flux_pairs);
            }
        })
        .on('click', function (d) {
            console.log('click node', d.id);
            highlight_node(d.id, true, true);
        })
        .on('mouseout', function (d) {
            tip.hide(d);
            if (!highlighted.includes(d.id)) {
                d3.selectAll(`.paper-${d.id}`).style('stroke-width', 0);
                Object.keys(graph['combinedContextEdges']).forEach(edgeId => {
                    if (edgeId.indexOf(d.id) !== -1) {
                        mouseoutEdge(edgeId);
                    }
                });
                mouseleaveFlux();
            }
        });

    node2size = function(d) {
        if (!isCollapse) return 30;
        let ret = d.citationCount < 50? 30: (d.citationCount < 100? 40: 50);
        // return ret;
        return Math.sqrt(ret) * 7;
    }
    matrixg.selectAll('.text1')
        .data(graph['nodes'])
        .enter().append('text')
        .attr('x', d => d.x)
        .attr('y', d => d.y + node2size(d) / 3)
        .attr('text-anchor', 'middle')
        .attr('font-family', 'Archivo Narrow')
        .attr('font-size', d => node2size(d))
        .attr('class', 'text1')
        .attr("pointer-events", "none")
        .text(d => String(d.citationCount));
        // !isCollapse || d.citationCount>=10? String(d.citationCount): ''
        
        // .each(function(d) {
        //     // let text = d.text === undefined? d.text1 + '\n' + d.text2 : String(d.citationCount)
        //     let text = d.label;
        //     var lines = text.split('\n');
        //     for (var i = 0; i < lines.length; i++) {
        //         d3.select(this).append('tspan')
        //             .attr('x', d.x)
        //             .attr('dy', 10)  // Adjust dy for subsequent lines
        //             .text(lines[i]);
        //     }
        // });
    
    

    graph['svg'] = svgElement;
    if (graph['topic'] == null) {
        // 添加背景坐标轴
        let bbox = {};
        bbox.x = parseFloat(graph['viewBox'].split(' ')[0]);
        bbox.width = parseFloat(graph['viewBox'].split(' ')[2]);
        id2attr = graph['id2attr'];

        prefix = 'year';
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
        var tickValues = years.filter(year => year % yearGrid === 0);
        let streamSize = bbox.width / 3;

        Tooltip = matrixg
            .append("text")
            .attr("x", bbox.x + bbox.width + 80)
            .attr("y",  y(minYear))
            .attr('font-family', 'Archivo Narrow')
            .style("opacity", 0)
            .style("font-size", 48)
        matrixg.append("g")
            .call(d3.axisLeft(y).tickSize(- bbox.width - streamSize).tickValues(tickValues))
            .select(".domain").remove();
        matrixg.selectAll(".tick line")
            .attr("stroke", "#b8b8b8")
        matrixg.selectAll(".tick text")
            .attr("x", bbox.x + bbox.width + 60)
            .attr("dy", 10)
            .attr('font-family', 'Archivo Narrow')
            .style("font-size", 48)

        let context = {};
        graph['nodes'].forEach(d=>{
            if (context[d.topic] == undefined) {
                context[d.topic] = {"total": 0};
                for (let year of years) context[d.topic][year] = [];
            }
            context[d.topic][d.year].push(d);
            context[d.topic]["total"] += 1;
        graph['context'] = context;
        })
        drawStreamgraph(matrixg, context, y, [bbox.x + bbox.width + 80, bbox.x + bbox.width + streamSize], 'm');
    }
}


function countKeywords(text, keywords) {
    // 初始化一个对象来存储关键词的计数
    const keywordCount = {};
    
    // 将所有关键词初始化为0
    keywords.forEach(keyword => {
        keywordCount[keyword] = 0;
    });

    // 将输入的文本转换为小写并分割为单词数组
    const words = text.toLowerCase().split(/\W+/);

    // 遍历单词数组，统计每个关键词的出现次数
    words.forEach(word => {
        if (keywordCount.hasOwnProperty(word)) {
            keywordCount[word]++;
        }
    });

    return keywordCount;
}

function calculateTFIDF(text, keywords, allDocuments) {
    // 初始化一个对象来存储关键词的TF-IDF值
    const tfidfValues = {};
    
    // 初始化一个对象来存储关键词的计数
    const keywordCount = {};
    keywords.forEach(keyword => {
        keywordCount[keyword] = 0;
    });

    // 将输入的文本转换为小写并分割为单词数组
    const words = text.toLowerCase().split(/\W+/);
    const totalWords = words.length;

    // 计算TF（词频）
    words.forEach(word => {
        if (keywordCount.hasOwnProperty(word)) {
            keywordCount[word]++;
        }
    });

    const tfValues = {};
    keywords.forEach(keyword => {
        tfValues[keyword] = keywordCount[keyword] / totalWords;
    });

    // 计算每个文档中包含的关键词集合，用于计算IDF
    const docContainsKeyword = {};
    keywords.forEach(keyword => {
        docContainsKeyword[keyword] = 0;
    });

    allDocuments.forEach(doc => {
        // type doc is Set?
        if (typeof doc === 'string') doc = new Set(doc.toLowerCase().split(/\W+/));
        keywords.forEach(keyword => {
            if (doc.has(keyword)) {
                docContainsKeyword[keyword]++;
            }
        });
    });

    // 计算IDF（逆文档频率）
    const documentCount = allDocuments.length;
    const idfValues = {};
    keywords.forEach(keyword => {
        idfValues[keyword] = Math.log(documentCount / (docContainsKeyword[keyword] + 1));
    });

    // 计算TF-IDF
    keywords.forEach(keyword => {
        tfidfValues[keyword] = tfValues[keyword] * idfValues[keyword];
    });

    return tfidfValues;
}

function isNull(value) {
    return value == undefined || value == null || value == 'null' || value == '' || value == NaN;
}

function sortTopicsBy(topics, keywordCount) {
    // 将话题字符串分割为单词数组
    const topicArray = topics.split(' ');
    
    // 根据关键词计数进行排序
    topicArray.sort((a, b) => {
        const countA = keywordCount[a] || 0;
        const countB = keywordCount[b] || 0;
        return countB - countA; // 降序排列
    });

    // 将排序后的数组重新拼接成字符串
    return topicArray.join(' ');
}

function generateTTM() {
    TTM = {};
    TTMEdges = {};
    // 填充矩阵（因为是外部转移矩阵，不计相同话题的转移）
    // 注意，存在部分话题只有转入，没有转出，所以不再keys里面
    // 注意TTM相同的node只取一个，不是m*n，而是m+n

    function addEdge(src, tgt) {
        if (src == tgt) return;
        if(!TTM[src]) TTM[src] = {};
        if(!TTM[src][tgt]) TTM[src][tgt] = 0;
        TTM[src][tgt]++;
    }

    global_edges.forEach(edge => {
        let sourceNode = global_nodes.find(node => node.id === edge.source);
        let targetNode = global_nodes.find(node => node.id === edge.target);
        let sourceTopicList = getTopicList(sourceNode);
        let targetTopicList = getTopicList(targetNode);
        // 去除相同元素，不能相继filter
        let sourceTopicListCopy = [...sourceTopicList];
        sourceTopicList = sourceTopicList.filter(topic => !targetTopicList.includes(topic));
        targetTopicList = targetTopicList.filter(topic => !sourceTopicListCopy.includes(topic));
        
        // sourceTopicList.forEach(src => {
        //     targetTopicList.forEach(tgt => {
        //         if (!TTM[src]) TTM[src] = {};
        //         if (!TTM[src][tgt]) TTM[src][tgt] = 0;
        //         TTM[src][tgt]++;

        //         if (!TTMEdges[src]) TTMEdges[src] = {};
        //         if (!TTMEdges[src][tgt]) TTMEdges[src][tgt] = [];
        //         TTMEdges[src][tgt].push(edge);
        //     })
        // })
        sourceTopicList.forEach(src => {
            addEdge(src, targetNode.topic);
        })
        targetTopicList.forEach(tgt => {
            addEdge(sourceNode.topic, tgt);
        })
    });
}

function getAllTopics(matrix) {
    let topics = new Set();
    for (let src in matrix) {
        for (let tgt in matrix[src]) {
            topics.add(src);
            topics.add(tgt);
        }
    }
    let arr = Array.from(topics);
    arr.sort((a, b) => a - b);
    return arr;
}
    

function simulatedAnnealing(matrix) {
    let temperature = 100.0; // 初始温度
    const coolingRate = 0.995; // 冷却率
    const minTemperature = 1.0; // 最小温度
    // let currentSolution = getAllTopics(matrix); // 初始解决方案
    let currentSolution = global_paper_field.map(d => d.id);
    console.log('currentSolution', currentSolution);
    let bestSolution = [...currentSolution];
    bestCost = calculateCost(matrix, bestSolution);
    originalCost = bestCost;
    // console.log('initial cost', bestCost)

    while (temperature > minTemperature) {
        let newSolution = [...currentSolution];
        // 产生新的解决方案：随机交换两个话题
        const [idx1, idx2] = [Math.floor(Math.random() * newSolution.length), Math.floor(Math.random() * newSolution.length)];
        [newSolution[idx1], newSolution[idx2]] = [newSolution[idx2], newSolution[idx1]];

        // 计算新解决方案的成本
        const currentCost = calculateCost(matrix, currentSolution);
        const newCost = calculateCost(matrix, newSolution);

        // 计算接受概率
        if (acceptanceProbability(currentCost, newCost, temperature) > Math.random()) {
            currentSolution = [...newSolution];
        }

        // 更新最佳解决方案
        if (newCost < bestCost) {
            bestSolution = [...currentSolution];
            bestCost = newCost;
            // console.log('new best cost', bestCost)
        }

        // 冷却过程
        temperature *= coolingRate;
    }

    return bestSolution;
}

// 计算解决方案的成本
function calculateCost(matrix, solution) {
    let cost = 0;
    solution.forEach((topic, i) => {
        solution.forEach((innerTopic, j) => {
            const distance = Math.abs(i - j);
            if (matrix[topic] && matrix[topic][innerTopic])
                cost += matrix[topic][innerTopic] * distance; // 假设成本与距离成正比
        });
    });
    return cost;
}

// 接受概率
function acceptanceProbability(currentCost, newCost, temperature) {
    if (newCost < currentCost) {
        return 1.0;
    }
    return Math.exp((currentCost - newCost) / temperature);
}

function loadTopicGraph(STopic) {
    // global_nodes.map(d=>Object.keys(d.topicDist).length)
    // new Set(global_nodes.map(d=>d.topic)) // 有多少个topic
    // 1. 将所有topicDist = {}的节点设置为最后一个topic
    // 2. 将所有topic总数小的节点设置为最后一个topic
    graph = {}
    graph['topic'] = STopic;
    graph['nodes'] = JSON.parse(JSON.stringify(global_nodes));
    graph['edges'] = JSON.parse(JSON.stringify(global_edges));

    if (STopic !== null) {
        graph['nodes'] = graph['nodes'].filter(d => hasTopic(d, STopic));
        // global_paper_field.find(d => d.id == STopic).size = graph['nodes'].length;
        // if (graph['nodes'].length == 0) {
        //     console.log('No node found in the selected topic', STopic);
        //     return;
        // }

        nodeSet = new Set(graph['nodes'].map(node => node.id));
        graph['edges'] = graph['edges'].filter(edge => nodeSet.has(edge.source) && nodeSet.has(edge.target));
        edgeStrs = graph['edges'].map(edge => edge.source + '->' + edge.target); 

        let G = new Graph();
        graph['nodes'].forEach(node => {
            G.addNode(node.id, node);
        });
        graph['edges'].forEach(edge => {
            G.addEdge(edge.source, edge.target);
        });
        for (let year = minYear; year <= maxYear; year++) {
            G.addNode(`l${year}`, {year: year});
            G.addNode(`r${year}`, {year: year});
        }
        for (let year = minYear; year < maxYear; year++) {
            G.addEdge(`l${year}`, `l${year+1}`);
            G.addEdge(`r${year}`, `r${year+1}`);
        }

        // 处理上下文边
        graph['contextEdges'] = {};
        global_edges.forEach(edge => {
            if (!edgeStrs.includes(`${edge.source}->${edge.target}`)) {
                let sourceNode = global_nodes.find(node => node.id === edge.source);
                let targetNode = global_nodes.find(node => node.id === edge.target);

                if (hasTopic(sourceNode, STopic)) {
                    let key = `${sourceNode.id}->r${targetNode.year}`;
                    if (!graph['contextEdges'][key]) graph['contextEdges'][key] = [];
                    graph['contextEdges'][key].push(edge);
                    G.addEdge(sourceNode.id, `r${targetNode.year}`);
                }
                if (hasTopic(targetNode, STopic)) {
                    let key = `l${sourceNode.year}->${targetNode.id}`;
                    if (!graph['contextEdges'][key]) graph['contextEdges'][key] = [];
                    graph['contextEdges'][key].push(edge);
                    G.addEdge(`l${sourceNode.year}`, targetNode.id);
                }
            }
        });

        graph['virtualEdges'] = [];
        let components = G.findConnectedComponents();
        components.forEach(component => {
            let node = G.findLastNodeInComponent(component);
            if (node) {
                // console.log('findLastNodeInComponent', G.nodeProperties.get(node));
                let nodeYear = G.nodeProperties.get(node).year;
                graph['virtualEdges'].push(`${node}->r${nodeYear}`);
            }
        });
    }
    
    graph['paper_field'] = [];    //该学者个人的field信息
    graph['nodes'].forEach(node => {
        let topic = node.topic;
        if (isNull(topic)) return true;
        let ix = graph['paper_field'].findIndex(d => d.id == topic);
        if (ix == -1) {
            // 如果没有统计，在paper_field中新建k-v
            // console.log(topic)
            graph['paper_field'].push({
                id: topic,
                num: 1,
                name: fields[topic][2],
                x: parseFloat(fields[topic][3]),
                y: parseFloat(fields[topic][4]),
                label: parseInt(fields[topic][8])
            });
        } else {
            graph['paper_field'][ix].num += 1;
        }
    })

    topic2graph[STopic] = graph
}

function hasTopic(node, topic) {
    // if (node.hasOwnProperty('topicDist'))
    //     return Object.keys(node['topicDist']).includes(topic);
    // return node['topic'] == topic;
    // console.log('hasTopic: node', node, 'topic', topic)
    if (node == undefined) {
        console.log('hasTopic: node', node, 'topic', topic)
    }

    let threshold = topicSlider !== null? topicSlider.noUiSlider.get(): config["topic_prob"];
    if (parseInt(node.topic) == topic) return true;
    if (node.hasOwnProperty('topicDist') && node.topicDist[topic] >= threshold) return true;
    return false;
}

function loadGlobalData(node_p=-1, edge_p=-1) {
    let filteredNodes = [];
    let node_prob = nodeSlider !== null? nodeSlider.noUiSlider.get(): config["node_prob"]
    if (node_p !== -1) node_prob = node_p;
    let edge_prob = edgeSlider !== null? edgeSlider.noUiSlider.get(): config["edge_prob"]
    if (edge_p !== -1) edge_prob = edge_p;
    let filteredEdges = authorData['edges'].filter(d => d.extends_prob >= edge_prob);

    if (authorID=='graphdrawing') {
        let thresh = nodeSlider.noUiSlider.get();
        filteredNodes = authorData['nodes'].filter(d => Math.log2(d.citationCount) >= thresh - 2 && d.year >= 2017 || Math.log2(d.citationCount) >= thresh - 1 && d.year >= 2012 || Math.log2(d.citationCount) >= thresh);
    } else if (config['type'] == 'Domain') {
        idmapping = []
        let log2_citationCount = nodeSlider !== null? nodeSlider.noUiSlider.get(): config["log2_citationCount"]
        filteredNodes = authorData['nodes'].filter(d => Math.log2(d.citationCount) >= log2_citationCount && d.year > 1950);
        filteredNodes.forEach(node => {
            let ix = idmapping.length
            idmapping.push(node.id);
            node.id = String(ix);
        })
        filteredEdges.forEach(edge => {
            edge.source = String(idmapping.findIndex(d => d == edge.source));
            edge.target = String(idmapping.findIndex(d => d == edge.target));
        })
    } else {
        filteredNodes = authorData['nodes'].filter(d => d.isKeyPaper >= node_prob && d.year > 1900);
    }
    

    filteredNodes = JSON.parse(JSON.stringify(filteredNodes));
    filteredEdges = JSON.parse(JSON.stringify(filteredEdges));

    let topics = new Set(filteredNodes.map(d => d.topic));
    if (topics.length == 0) {
        console.log('No topics found in the data');
        return;
    }
    if (filteredNodes.length == 0) {
        print('No node found in the data! Try to adjust the node probability threshold');
        return;
    }
    
    let ln = filteredNodes.length, le = filteredEdges.length;
    let modeValue = document.getElementById('mode').value;
    let surveyValue = document.getElementById('remove-survey').value;
    
    if (surveyValue == '1') filteredNodes = filteredNodes.filter(node => !node.survey);
    let lnr = filteredNodes.length;
    // Compute indegree, outdegree, and total degree
    let indegree = {}, outdegree = {}, alldegree = {};
    // set other graph['nodes'] in filteredNodes outdegree/indegree =0
    filteredNodes.forEach(node => {
        outdegree[node.id] = 0;
        indegree[node.id] = 0;
        alldegree[node.id] = 0;
    })
    let nodeSet = new Set(filteredNodes.map(node => node.id));
    
    let connectedEdges = [];
    filteredEdges.forEach(edge => {
        src = String(edge.source);
        tgt = String(edge.target);
        if (nodeSet.has(src) && nodeSet.has(tgt)) {
            outdegree[src] += 1;
            indegree[tgt] += 1;
            alldegree[src] += 1;
            alldegree[tgt] += 1;
            connectedEdges.push(edge);
        }
    });

    if (modeValue == '1') {
        // remove isolated
        filteredNodes = filteredNodes.filter(node => alldegree[node.id] > 0);
    } else if (modeValue == '2') {
        // partially remove, high citationCount papers are not removed
        filteredNodes = filteredNodes.filter(node => alldegree[node.id] > 0 || node.citationCount >= 50);
    }
    filteredEdges = connectedEdges;

    // 注意year的计算在selectedTopic之前，但是在过滤之后
    minYear = Math.min(...filteredNodes.map(node => node.year));
    maxYear = Math.max(...filteredNodes.map(node => node.year));

    console.log('original data:', authorData, 
        '#node:', authorData['nodes'].length, ln, lnr, filteredNodes.length, 
        '#edge:', authorData['edges'].length, le, filteredEdges.length);
    console.log(filteredNodes, filteredEdges);
    
    //  / ${lnr}(rm survey)     rm isolated) / ${ln}(       rm unconnected) / ${le}(
    $('#node-num').text(`${filteredNodes.length} (filter) / ${authorData['nodes'].length}`);
    $('#edge-num').text(`${filteredEdges.length} (filter) / ${authorData['edges'].length}`);
    $("#node-value").text(filteredNodes.length);
    $("#edge-value").text(filteredEdges.length);
    
    global_nodes = filteredNodes;
    global_edges = filteredEdges.map(edge => {
        return {
            name: `${edge.source}->${edge.target}`,
            ...edge
        };
    });

    global_nodes = global_nodes.map(d=>{
        if (d.topicDist === undefined || Object.keys(d.topicDist)==0) {
            d.topic = fields.length - 1;
        }
        // 注意global_nodes的topic可能有更新，所以不能在这里更新paperID2topic
        // paperID2topic[d.id] = d.topic;
        paperID2year[d.id] = d.year;
        return d;
    });

    global_paper_field = {};    //该学者个人的field信息
    Object.values(fields).forEach(field => {
        global_paper_field[field[0]] = {
            id: field[0],
            num: 0,
            size: 0,
            name: field[2].replaceAll(' ', '-').replaceAll('_', ' '),
            x: parseFloat(field[3]),
            y: parseFloat(field[4]),
            label: parseInt(field[8])
        }
    });

    // 根据字典合并话题，将后面的话题合并到第一个话题上
    if (mergeTopicDict[authorID] != undefined) {
        mergeTopicDict[authorID].forEach(mergeList => {
            let mergeDict = {}
            mergeList.forEach(d => {
                if (d != mergeList[0]) mergeDict[d] = mergeList[0];
            });
            console.log('mergeDict:', mergeDict)
            global_nodes.forEach(node => {
                let topic = parseInt(node.topic);
                if (mergeDict[topic] != undefined) {
                    node.topic = mergeDict[topic];
                }
                Object.keys(node.topicDist).forEach(k => {
                    if (mergeDict[k] != undefined) {
                        node.topicDist[mergeDict[k]] = Math.max(node.topicDist[mergeDict[k]] || 0, node.topicDist[k]);
                        delete node.topicDist[k];
                    }
                })
            })
        })
    }

    global_nodes.forEach(node => {
        let topic = parseInt(node.topic || 0);
        let topicDist = Object.keys(node.topicDist || {});

        global_paper_field[topic].num += 1;
        topicDist.forEach(field => {
            if (hasTopic(node, field)) global_paper_field[field].size += 1;
        });
    })
    global_paper_field = Object.values(global_paper_field);
    
    global_paper_field.sort(op('size'));
    console.log('original global_paper_field', JSON.parse(JSON.stringify(global_paper_field)))
    let minSize = Math.max(5, (global_paper_field[10] || {size: 0}).size);    // 话题的最小值是5
    global_paper_field = global_paper_field.filter(item => item.size >= minSize);
    console.log('global_paper_field parse complete', JSON.parse(JSON.stringify(global_paper_field)), minSize);
    
    if (fieldType != 'domain') {
        let time = new Date().getTime();
        let all_documents = global_nodes.map(d=>[d.name,d.name,d.name, d.abstract].join(' '));
        let all_documents_set = all_documents.map(doc => new Set(doc.toLowerCase().split(/\W+/)))
        let text = all_documents.join(' ');
        let keywords = global_paper_field.map(d=>d.name).join(' ').split(' ');
        global_keywords = countKeywords(text, keywords);
        // global_paper_field.forEach(d=>d.name=sortTopicsBy(d.name, global_keywords))
        global_paper_field.forEach(d=> {
            d.text = global_nodes.filter(node => hasTopic(node, d.id)).map(d => [d.name,d.name,d.name, d.abstract].join(' ')).join(' ');
            d.tfidf = calculateTFIDF(d.text, d.name.split(' '), all_documents_set);
            d.name = sortTopicsBy(d.name, d.tfidf);
        })
        console.log('calculateTFIDF complete', new Date().getTime()-time);
    }

    if (global_paper_field.length == 0) {
        alert('No topic found in the data! Please change another scholar.');
        return;
    }
    let sizes = global_paper_field.map(d=>d.size);
    let totalSize = sizes.reduce((a, b) => a + b, 0);
    minSize = Math.min(...sizes);
    maxSize = Math.max(...sizes);
    // let colors = [];
    // let cumulativeSize = 0;
    
    // for (let i = 0; i < global_paper_field.length; i++) {
    //     let size = global_paper_field[i].size;
    //     let startHue = (cumulativeSize / totalSize) * 360;
    //     let endHue = ((cumulativeSize + size) / totalSize) * 360;
    //     cumulativeSize += size;
        
    //     let hue = (startHue * 2 + endHue) / 3;
    //     colors.push(hsvToColor([hue, 1, 1]));
    // }
    colors = [
        "#fdb462", // Orange
        "#b3de69", // Light Green
        "#fccde5", // Pink
        "#8dd3c7", // Teal
        "#ffffb3", // Yellow
        "#bebada", // Lavender
        "#fb8072", // Coral
        "#80b1d3", // Sky Blue
        "#bc80bd", // Purple
        "#ccebc5", // Light Teal
        
        "#a6cee3", // Light Blue
        "#33a02c", // Dark Green
        "#e31a1c", // Red
        "#fdbf6f", // Peach
        "#8c510a", // Dark Brown
        "#d73027", // Bright Red
    ];
    colors = colors.map(d=>d3.hsv(d3.color(d)));
    console.log(colors);

    // global_colors = {}
    
    global_paper_field.forEach((topic, i)=>{
        // let shortName = topic.name.split(' ').slice(0, 3).join(' ');
        // if (topic.size / maxSize < 0.2) {
        //     shortName = topic.name.split(' ').slice(0, 2).join(' ');
        // }
        let length = topic.size / maxSize < 0.2? 2: 3;
        let names = [];
        console.log('names', names)
        let ix = 0;
        while (names.length < length && ix < topic.name.split(' ').length) {
            let name = topic.name.split(' ')[ix];
            console.log(ix, name)
            let i=0;
            for (; i < names.length; i++) {
                if (names[i].includes(name)) break;
                else if (name.includes(names[i])) {names[i] = name; break;}
            }
            if (i == names.length) names.push(name);
            ix += 1;
        }

        topic.shortName = names.join(' ').replace('3d image', '3D graphics');
        
        if (!global_colors.hasOwnProperty(topic.id)) {
            ix = Object.entries(global_colors).length % colors.length;
            global_colors[topic.id] = colors[ix];
        }
        topic.color = global_colors[topic.id];
    
    })
    global_nodes.forEach(node => {
        // 由于最高topic可能已经不在global_paper_field中，所以需要重新计算
        let topics = [parseInt(node.topic), ...Object.keys(node.topicDist)];
        topics = topics.filter(topic => global_paper_field.find(d => d.id == topic));
        if (topics.length == 0) {
            // console.log('no topic found for node:', node);
            node.topic = null;
        } else {
            let topic = topics[0];
            node.topic = topic;
        }
        // 一定要更新paperID2topic
        paperID2topic[node.id] = node.topic;
    })

    let ratio = Math.pow(global_nodes.length / 10, 1/12);
    prismRadius = basePrismRadius * ratio;
    prismScale = basePrismScale / ratio;
    console.log('prismRadius:', prismRadius, 'prismScale:', prismScale);

    console.log('global_paper_field sort complete', JSON.parse(JSON.stringify(global_paper_field)));
    
    generateTTM();
    arrangement = simulatedAnnealing(TTM);
    adjacentMatrix = getAdjacentMatrix();
    console.log('arrangement:', arrangement);

    // 加载所有话题图
    loadTopicGraph(null);
    global_paper_field.forEach(d => {
        loadTopicGraph(d.id);
    })
    
    if (rangeSlider !== null) {
        rangeSlider.noUiSlider.updateOptions({
            range: {
                'min': minSize,
                'max': maxSize+1 // 'range' 'min' and 'max' cannot be equal.
            }
        });
        // *IMPORTANT*: 更新滑块的值，确保滑块的值也更新，你需要同时设置 set 选项
        rangeSlider.noUiSlider.set([minSize, maxSize+1]);
    }
}

function op(key){
    return function(value1, value2){
    // 对属性的访问，obj["key"]与obj.key都是可以的，不过，如果key值并不确定，而是一个变量的时候，则只能通过obj[key]的方式访问。
        var val1 = value1[key];//这块用.key数组没有发生变化
        var val2 = value2[key];
        return val2 - val1;
    }
}

function getTopicList(node) {
    if (node.hasOwnProperty('topicDist')) {
        let topicList = [];
        let threshold = topicSlider !== null? topicSlider.noUiSlider.get(): config["topic_prob"];
        for (let key in node.topicDist) {
            if (node.topicDist[key] >= threshold)  topicList.push(key);
        }
        if (!topicList.includes(node.topic))  topicList.push(node.topic);
        return topicList;
    }
    return [node.topic];
}

function getAdjacentMatrix(arrangement=null) {
    if (arrangement === null) {
        arrangement = global_paper_field.map(d => d.id);
    }
    let matrix = [];
    arrangement.forEach((src, i) => {
        matrix.push([]);
        arrangement.forEach((tgt, j) => {
            matrix[i].push(TTM[src] && TTM[src][tgt] ? TTM[src][tgt] : 0);
        });
    }
    );
    return matrix;
}

function polarToCartesian(radius, angle) {
    return {
        x: radius * Math.cos(angle - Math.PI / 2),
        y: radius * Math.sin(angle - Math.PI / 2)
    };
}

function lineIntersection(angle, point1, point2) {
    // console.log('intersect', angle, point1, point2);

    // 通过给定角度计算直线的斜率和截距
    const m1 = Math.tan(angle - Math.PI / 2);
    const b1 = 0;  // 给定角度的直线通过原点

    // 通过两个点计算另一条直线的斜率和截距
    const m2 = (point2.y - point1.y) / (point2.x - point1.x);
    const b2 = point1.y - m2 * point1.x;

    // 如果两条直线平行，则没有交点
    if (m1 === m2) {
        return null;
    }

    // 计算交点
    const intersectX = (b2 - b1) / (m1 - m2);
    const intersectY = m1 * intersectX;

    // console.log('intersect', intersectX, intersectY);

    return {
        x: intersectX,
        y: intersectY
    };
}

function sumRowsAndColumns(matrix) {
    let rowSums = matrix.map(row => row.reduce((a, b) => a + b, 0));
    let colSums = matrix[0].map((_, colIndex) => matrix.reduce((sum, row) => sum + row[colIndex], 0));

    return { rowSums, colSums }; // 返回一个对象
}

function adjustWeight(weights) {
    minimalRatio = 1 / weights.length / 2; // 最小比例
    // 定义一个函数来判断是否满足条件
    function satisfiesCondition(alpha) {
        let newWeights = weights.map(weight => weight + alpha);
        let newTotalWeight = d3.sum(newWeights);
        return newWeights.every(weight => (weight / newTotalWeight) > minimalRatio);
    }
    // 采用二分查找法找到满足条件的最小 alpha
    function findAlpha() {
        let left = 0, right = 1000; // 初始化搜索范围
        let precision = 1e-6;      // 精度设置

        while ((right - left) > precision) {
            let mid = (left + right) / 2;
            if (satisfiesCondition(mid)) right = mid;
            else left = mid;
        }
        return left; // 或者 return right，最终两者会趋近
    }
    let alpha = findAlpha();
    return weights.map(weight => weight + alpha);
}

function init_chord(isPolygenView=false, 
        allowInteraction=true, 
        drawRibbon=true,
        outonly=true,
        allowReaction=true
    ) {
    // 创建一个无主的SVG元素
    let width = prismRadius * 2;
    let height = width;
    let svgElement = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svgElement.setAttribute("width", width);
    svgElement.setAttribute("height", height);
    svgElement.setAttribute("viewBox", [-width / 2, -height / 2, width, height]);

    let svg = d3.select(svgElement)
        .attr("style", "width: 100%; height: auto; font: 10px Archivo Narrow;");


    let outerRadius = Math.min(width, height) * 0.5;
    if (!isPolygenView) outerRadius*=0.8
    let innerRadius = outerRadius - 20;
    let { rowSums: outdegree, colSums: indegree } = sumRowsAndColumns(adjacentMatrix); // 解构赋值
    console.log('init chord', adjacentMatrix, outdegree, indegree);

    let sizes = global_paper_field.map(d => d.size);
    let names = global_paper_field.map(d => d.shortName),
        colors = global_paper_field.map(d => topic2color(d.id));
    
    // 使用outdegree而不是size/num作为权重
    let originalWeights = outonly? outdegree: sizes;
    let weights = JSON.parse(JSON.stringify(originalWeights));
    if (isPolygenView) weights = adjustWeight(weights);

    let degree = outdegree.map((d, i) => d + indegree[i]);

    let totalWeight = d3.sum(weights);
    let interval = 0;
    if (!isPolygenView){
        interval = totalWeight / 100;
        totalWeight += interval * names.length;
    }
    console.log(weights, totalWeight, interval);

    console.log('degree', degree);
    const angleScale = d3.scaleLinear().domain([0, totalWeight]).range([0, 2 * Math.PI]);
    let cumulativeAngle = 2 * Math.PI;
    const nodeAngles = weights.map((weight, ix) => {
        const endAngle = cumulativeAngle;
        cumulativeAngle -= angleScale(weight);
        const startAngle = cumulativeAngle;
        cumulativeAngle -= angleScale(interval);
        return {
            index: ix,
            startAngle: startAngle,
            endAngle: endAngle,
            weight: weight
        };
    });

    const chords = [];
    let angles = JSON.parse(JSON.stringify(nodeAngles));
    adjacentMatrix.forEach((row, i) => {
        row.forEach((value, j) => {
            if (outonly) {
                let rvalue = adjacentMatrix[j][i]
                if (i < j && value + rvalue > 0) {
                    const source = nodeAngles[i];
                    const target = nodeAngles[j];
                    let sourceAngle = angleScale(value / originalWeights[i] * source.weight);
                    let targetAngle = angleScale(rvalue / originalWeights[j] * target.weight);
                    chords.push({
                        source: {
                            index: i,
                            startAngle: source.startAngle,
                            endAngle: source.startAngle + sourceAngle,
                            value: value
                        },
                        target: {
                            index: j,
                            startAngle: target.endAngle - targetAngle,
                            endAngle: target.endAngle,
                            value: rvalue
                        }
                    });
                    source.startAngle += sourceAngle;
                    target.endAngle -= targetAngle;
                }

            } else if (value > 0) {
                const source = nodeAngles[i];
                const target = nodeAngles[j];
                chords.push({
                    source: {
                        index: i,
                        startAngle: source.startAngle,
                        endAngle: source.startAngle + angleScale(value / degree[i] * source.weight),
                        value: value
                    },
                    target: {
                        index: j,
                        startAngle: target.endAngle - angleScale(value / degree[j] * target.weight),
                        endAngle: target.endAngle,
                        value: value
                    }
                });
                source.startAngle += angleScale(value / degree[i] * source.weight);
                target.endAngle -= angleScale(value / degree[j] * target.weight);
            }
        });
    });
    angles.forEach((d, i) => d.splitAngle = nodeAngles[i].startAngle)
    console.log('angles', angles)
    console.log('chords', chords)

    function highlight_arc(index) {
        chord_arcs.style("opacity", defaultOpacity / 3);
        chord_ribbons.style("opacity", defaultOpacity / 3);
    
        chord_arcs.filter(`.chord-arc-${index}`).style("opacity", 1);
        chord_ribbons.filter(`.chord-ribbon-from-${index}`).style("opacity", 1);
        chord_ribbons.filter(`.chord-ribbon-to-${index}`).style("opacity", 1);
    
        let s = `${names[index]}(#paper: ${sizes[index]}, out: ${outdegree[index]}, in: ${indegree[index]})`
        tip.show({name: s})
    }

    function highlight_ribbon(d) {
        const sourceIndex = d.source.index;
        const targetIndex = d.target.index;
        // 将所有元素透明度设为默认值的一半 .transition()
        chord_arcs.style("opacity", defaultOpacity / 3);
        chord_ribbons.style("opacity", defaultOpacity / 3);
    
        // 高亮特定元素
        chord_arcs.filter(`.chord-arc-${sourceIndex}, .chord-arc-${targetIndex}`)
            .style("opacity", 1);
        chord_ribbons.filter(`.chord-ribbon-${sourceIndex}-${targetIndex}`)
            .style("opacity", 1);

        let s = `${names[d.source.index]}(${d.source.value}) ⇒ ${names[d.target.index]}`
        if (outonly) s = `${names[d.source.index]}(${d.source.value}) ⇔ ${names[d.target.index]}(${d.target.value}) `
        tip.show({name: s})
    }
    
    function mouseout() {
        // 将所有元素的透明度恢复为默认值
        if (currentIndex != -1) {
            chord_arcs.style("opacity", defaultOpacity / 3);
            chord_ribbons.style("opacity", defaultOpacity / 3);
            chord_arcs.filter(`.chord-arc-${currentIndex}`).style("opacity", 1);
            chord_ribbons.filter(`.chord-ribbon-from-${currentIndex}, .chord-ribbon-to-${currentIndex}`).style("opacity", 1);
        } else {
            chord_arcs.style("opacity", defaultOpacity);
            chord_ribbons.style("opacity", defaultOpacity);
        }

        tip.hide()
    }

    if (outonly) {
        let defs = svg.append("defs");
        chords.forEach((d, i) => {
            let gradient = defs.append("linearGradient")
                .attr("id", `chordgradient-${i}`)
                .attr("gradientUnits", "userSpaceOnUse")
                .attr("x1", Math.cos(d.source.startAngle - Math.PI / 2) * innerRadius)
                .attr("y1", Math.sin(d.source.startAngle - Math.PI / 2) * innerRadius)
                .attr("x2", Math.cos(d.target.startAngle - Math.PI / 2) * innerRadius)
                .attr("y2", Math.sin(d.target.startAngle - Math.PI / 2) * innerRadius);
        
            gradient.append("stop")
                .attr("offset", "0%")
                .attr("stop-color", colors[d.source.index]);
        
            gradient.append("stop")
                .attr("offset", "100%")
                .attr("stop-color", colors[d.target.index]);
        });
    }

    if (isPolygenView) {
        // 计算多边形的顶点。添加多边形蒙版。
        const polygonPoints = angles.map(d => {
            const startPoint = polarToCartesian(innerRadius - 5, d.startAngle);
            const endPoint = polarToCartesian(innerRadius - 5, d.endAngle);
            return [endPoint, startPoint];
        }).flat();

        const polygonChunks = angles.map(d => {
            const innerStart = polarToCartesian(innerRadius, d.startAngle);
            const innerEnd = polarToCartesian(innerRadius, d.endAngle);
            const outerStart = polarToCartesian(outerRadius, d.startAngle);
            const outerEnd = polarToCartesian(outerRadius, d.endAngle);
            const intersect = lineIntersection(d.splitAngle, innerStart, innerEnd);
            ret = [innerStart, innerEnd, outerEnd, outerStart];

            Object.assign(ret, {
                radius: Math.sqrt(intersect.x ** 2 + intersect.y ** 2),
                splitAngle: d.splitAngle,
            })
            return ret;
        });
        
        // 创建蒙版
        const mask = svg.append("defs")
            .append("mask")
            .attr("id", "polygon-mask");
        
        mask.append("polygon")
            .attr("points", polygonPoints.map(d => `${d.x},${d.y}`).join(" "))
            .attr("fill", "white");
        
        // 给svg添加一个背景
        svg.append("rect")
            .attr("x", -width / 2)
            .attr("y", -height / 2)
            .attr("width", width)
            .attr("height", height)
            .attr("fill", "white")
            .attr("mask", "url(#polygon-mask)");
        // 应用蒙版到chords
        if (drawRibbon)
        svg.append("g")
            .attr("fill-opacity", defaultOpacity)
            .selectAll("path")
            .data(chords)
            .join("path")
            .attr("mask", "url(#polygon-mask)")  // 应用蒙版
            .style("mix-blend-mode", "multiply")
            // .attr("fill", d => colors[d.source.index])
            .attr("fill", (d, i) => outonly? `url(#chordgradient-${i})`: colors[d.source.index])
            .attr('class', d => `chord-ribbon chord-ribbon-from-${d.source.index} chord-ribbon-to-${d.target.index} chord-ribbon-${d.source.index}-${d.target.index}`)
            .attr("d", d3.ribbon()
                .radius(innerRadius - 5)
            )
            .on("mouseover", allowInteraction? highlight_ribbon: null)
            .on("mouseout", allowInteraction? mouseout: null)
            .append("title")
            .text(d => `\n${d.target.value} ${names[d.source.index]} → ${names[d.target.index]}`);
        
        polygonChunks.forEach((chunk, ix) => {
            // console.log('chunk', chunk)
            svg.append("polygon")
                .style("opacity", defaultOpacity)
                .attr('class', 'chord-arc chord-arc-' + ix)
                .attr("points", chunk.map(d => `${d.x},${d.y}`).join(" "))
                .attr("fill", d => {
                    let c = colors[ix];
                    return hsvToColor([c.h, c.s, c.v], 0.8)
                })
                .on("mouseover", allowInteraction? d=>highlight_arc(ix): null)
                .on("mouseout", allowInteraction? mouseout: null);
        });
    } else {
        const group = svg.append("g")
            .selectAll("g")
            .data(angles)
            .join("g");

        group.append("path")
            .attr("fill", d => {
                let c = colors[d.index];
                return hsvToColor([c.h, c.s, c.v], 0.8)
            })
            .attr("d", d3.arc()
                .innerRadius(innerRadius)
                .outerRadius(d=>{
                    if (!outonly) return outerRadius;
                    let size = global_paper_field.map(d => d.size)[d.index];
                    return innerRadius + size;
                })
                .startAngle(d => d.startAngle)
                .endAngle(d => d.endAngle)
            )
            .style("opacity", defaultOpacity)
            .attr('class', d => 'chord-arc chord-arc-' + d.index)
            .on("mouseover", allowInteraction? d=> highlight_arc(d.index): null)
            .on("mouseout", allowInteraction? mouseout: null);
        
        group.append("text")
            .each(d => { d.angle = (d.startAngle + d.endAngle) / 2; })
            .attr("dy", ".35em")
            .attr("transform", d => `
                rotate(${(d.angle * 180 / Math.PI - 90)})
                translate(${outerRadius})
                ${(d.angle > Math.PI ? "rotate(180)" : "")}
            `)
            .attr("text-anchor", d => d.angle > Math.PI ? "end" : "start")
            .text(d => names[d.index].split(' ')[0])
            .style("font-size", d=>Math.cbrt(sizes[d.index]) * 20 + 'px')
            .style("fill", "#000");


        if (!outonly)
        group.append("path")
            .attr("fill", d => {
                let c = colors[d.index];
                return hsvToColor([c.h, c.s, c.v], 0.8)
            })
            .attr("d", d3.arc()
                .innerRadius(innerRadius-10)
                .outerRadius(outerRadius+10)
                .startAngle(d => d.splitAngle - 0.003)
                .endAngle(d => d.splitAngle + 0.003)
            )
            .attr('class', d => 'chord-arc chord-arc-' + d.index)
            .on("mouseover", allowInteraction? d=> highlight_arc(d.index): null)
            .on("mouseout", allowInteraction? mouseout: null);
        
        if (drawRibbon)
        svg.append("g")
            .attr("opacity", defaultOpacity)
            .selectAll("path")
            .data(chords)
            .join("path")
            .style("mix-blend-mode", "multiply")
            .attr('class', d => `chord-ribbon chord-ribbon-from-${d.source.index} chord-ribbon-to-${d.target.index} chord-ribbon-${d.source.index}-${d.target.index}`)
            .attr("fill", (d, i) => outonly? `url(#chordgradient-${i})`: colors[d.source.index])
            .attr("d", d3.ribbon()
                .radius(innerRadius - 5)
            )
            .on("mouseover", allowInteraction? highlight_ribbon: null)
            .on("mouseout", allowInteraction? mouseout: null)
        
    }

    // 每次生成新的SVG元素时，我们都需要更新选择器
    return svgElement;
}


async function saveall() {
    let svgDataList = [];
    const svgElement2 = document.querySelector('#tagcloud svg');
    let svgData2 = new XMLSerializer().serializeToString(svgElement2);
    svgDataList.push(svgData2);

    // 创建一个带有文本的 SVG 元素，宽度与 svgElement2 一致
    const textSvgElement = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    textSvgElement.setAttribute("width", svgElement2.getAttribute("width"));
    textSvgElement.setAttribute("height", "100"); // 高度增加以适应两行文本

    // 创建 authorName 文本元素
    const authorNameElement = document.createElementNS("http://www.w3.org/2000/svg", "text");
    authorNameElement.setAttribute("x", textSvgElement.getAttribute("width") / 2);
    authorNameElement.setAttribute("y", "30"); // 第一行文本位置
    authorNameElement.setAttribute("text-anchor", "middle");
    authorNameElement.setAttribute("dominant-baseline", "middle");
    authorNameElement.setAttribute("font-size", "48px");
    authorNameElement.setAttribute("fill", "black");
    authorNameElement.setAttribute("font-family", "Archivo Narrow");
    authorNameElement.textContent = `${authorName}`; // 第一行显示 authorName

    // 创建 fieldType 文本元素
    const fieldTypeElement = document.createElementNS("http://www.w3.org/2000/svg", "text");
    fieldTypeElement.setAttribute("x", textSvgElement.getAttribute("width") / 2);
    fieldTypeElement.setAttribute("y", "80"); // 第二行文本位置
    fieldTypeElement.setAttribute("text-anchor", "middle");
    fieldTypeElement.setAttribute("dominant-baseline", "middle");
    fieldTypeElement.setAttribute("font-size", "36px");
    fieldTypeElement.setAttribute("fill", "black");
    fieldTypeElement.setAttribute("font-family", "Archivo Narrow");
    fieldTypeElement.textContent = `(${config.name})`; // 第二行显示 fieldType

    // 将文本元素添加到 SVG 中
    textSvgElement.appendChild(authorNameElement);
    textSvgElement.appendChild(fieldTypeElement);


    // 将生成的文字 SVG 序列化并加入列表
    let textSvgData = new XMLSerializer().serializeToString(textSvgElement);
    svgDataList.push(textSvgData);
    
    const sortedData = global_paper_field.sort((a, b) => b.size - a.size);
    sortedData.forEach(data => {
        topic = data.id;
        console.log('save topic', topic);
        STopic = topic;
        showGF()
        const svgElement = document.querySelector('#mainsvg svg');
        let svgData = new XMLSerializer().serializeToString(svgElement);
        svgDataList.push(svgData);
    })
    STopic = null;
    showGF()
    const svgElement = document.querySelector('#mainsvg svg');
    let svgData = new XMLSerializer().serializeToString(svgElement);
    svgDataList.push(svgData);
    // 在最底下重复一次tagcloud
    svgDataList.push(svgData2);

    combineAndDownloadSVG(svgDataList, getFilename().replace('.gif', '.svg'));
}

function getFilename() {
    return `${authorName.replace(/\s+/g, '_')}-${authorID}-${fieldType}.gif`
}


function draw_tagcloud() {
    let ele = d3.select("#tagcloud").node();
    d3.select("#tagcloud").selectAll("*").remove();
    let svg = d3.select("#tagcloud").append("svg")
        .attr("width", ele.getBoundingClientRect().width)
        .attr("height", ele.getBoundingClientRect().height) ;

    tip = d3.tip()
        .attr("class", "d3-tip")
        .html(d => d.name);
    svg.call(tip);

    // let paper_field_filter = global_paper_field.filter(item => item.size >= min && item.size <= max);
    let sortedData = global_paper_field.sort((a, b) => b.size - a.size);
    const wordCloud = svg.append("g");
        // .attr("transform", "translate(10, 10)");

    if (switchtagcloud) {
        if (Object.keys(global_coauthors).length == 0) {
            global_nodes.forEach(node => {
                node['authors'].split(', ').forEach(author => {
                    if (author == authorName) return;
                    global_coauthors[author] = (global_coauthors[author] || 0) + 1;
                })
            })
        }
        sortedData = Object.entries(global_coauthors).map(d => {return {name: d[0], shortName: d[0], size: d[1]}})
        sortedData = sortedData.sort((a, b) => b.size - a.size);
        let top10size = sortedData[10].size;
        sortedData = sortedData.filter((d, id) => {d.id = id; return d.size >= top10size});
    }
    console.log('[draw_tagcloud]sortedData', sortedData);

    let maxFontSize = 60;
    while ((wordPosition=calculateWordPosition(sortedData, maxFontSize)) === null) {
        maxFontSize *= 0.95;
    }

    /* TODO
     * 当nodes没有节点时，下面的wordPosition会因为访问了未知属性`.y`出错
     */
    if (Array.isArray(wordPosition) && wordPosition.length == 1 && Array.isArray(wordPosition[0]) && wordPosition[0].length == 0) {
        return;
    }
    
    const words = wordCloud.selectAll("g")
        .data(wordPosition)
        .enter()
        .append("g")
        .attr("transform", (d, i) => `translate(0, ${d[0].y})`);

    words.selectAll("rect")
        .data(d => d)
        .enter()
        .append("rect")
        .attr("class", "tag-rect")
        .attr("x", d => d.x)
        .attr("y", d => 0)
        .attr("id", d => `rect_${d.id}`)
        .attr("width", d => d.width)
        .attr("height", d => d.height)
        .attr("rx", d => maxFontSize * 0.1 * d.ratio)
        .attr("ry", d => maxFontSize * 0.1 * d.ratio)
        .style("fill", d => 
            switchtagcloud? colors[d.id % colors.length]: topic2color(d.id)) 
        //rgba(15, 161, 216, ${d.opacity})
        //`rgb(${d.rgb[0]}, ${d.rgb[1]}, ${d.rgb[2]})`
        .style("fill-opacity", 0.6)
        .on('mouseover', download>0? d=>highlight_tag(d.id, false): 
        function(d) {
            highlight_field(d.id);
            tip.show(d);
            d3.select(this).attr('cursor', 'pointer');
        })
        .on('mouseout',  download>0? reset_tag: reset_field)
        .on('click',  function(d) {
            let rotate = STopic == null;
            STopic = STopic == d.id? null: d.id
            tip.hide(d)
            highlight_STopic(rotate)
        })

    words.selectAll("text")
        .data(d => d)
        .enter()
        .append("text")
        .text(d => d.shortName)
        .attr("x", d => d.x + d.width * 0.5)  // Adjusted to the center of the rectangle
        .attr("y", d => d.height / 2) // Adjusted to the center of the rectangle
        .attr("dy", "0.35em")
        .attr("text-anchor", "middle")        // Center the text horizontally
        .style("font-family", "Archivo Narrow")
        // .attr("dominant-baseline", "middle")  // Center the text vertically
        .attr("class", "tag-text")
        .attr("id", d => `text_${d.id}`)
        .attr("font-size", d => d.size + "px")
        .style("fill", d => `rgb(0,0,0)`)
        .attr("pointer-events", "none");
        // .on('mouseout', reset_field);

    draw_chord();
    if (STopic != null) highlight_tag(STopic, true);
}

function highlight_STopic(rotate=true) {
    reset_tag();
    highlight_tag(STopic, true);
    if (download>0) {
        if (STopic==null) {
            $("#mainsvg").hide();
            $("#prismWebGL").show();
            rotationSpeed = defaultRotationSpeed;
            $('#rotation-slider').val(rotationSpeed);
        } else {
            showGF();
        }
        return;
    }
    let ix = global_paper_field.findIndex(d => d.id == STopic);
    // console.log('highlight_STopic', ix);
    if (rotate) rotateTo(ix, render); 
    else render();
}

function highlight_tag(topic_id, is_click) {
    if (is_click) {
        if (STopic != null) {
            d3.selectAll(".tag-text")
                .style("opacity", 0.5);
            d3.select(`#text_${topic_id}`)
                .style("opacity", 1);
        } else if (STopic == null) {
            d3.selectAll(".tag-text")
                .style("opacity", 1);
        }
    }
    d3.select(`#text_${topic_id}`)
        .attr('font-weight', 'bold')
        .attr('fill', 'red');
    if (STopic !== null && STopic != topic_id) {
        d3.select(`#rect_${STopic}`)
            .attr("fill-opacity", 1)
        d3.select(`#text_${STopic}`)
            .attr('font-weight', 'bold');
    }
}

function reset_tag() {
    // reset rect color
    // highlight_topic_forceChart(-1);
    // 将所有tag都置为初始状态
    d3.selectAll(".tag-rect")
        .attr("fill-opacity", 0.6)
    d3.selectAll(".tag-text")
        .attr('font-weight', 'normal')
        .attr('fill', 'black');
    if (STopic !== null) {
        d3.select(`#rect_${STopic}`)
            .attr("fill-opacity", 1)
        d3.select(`#text_${STopic}`)
            .attr('font-weight', 'bold')
            .attr('fill', 'red');
    }
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
        let width = textSize(d.shortName, size).width * 0.9;
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

function hideAll() {
    $("#mainsvg").hide();
    $("#TopicPrism").hide();
    $("#matrixsvg").hide();
    $('#prismWebGL').hide();
}

function showGF() {
    hideAll()
    rotationSpeed = 0;
    $("#mainsvg").show();
    graph = topic2graph[STopic];
    console.log('current graph:', graph);
    if (fullsize) {
        const svgElement = d3.select("#mainsvg").node();
        // 将宽度和高度从像素转换为英寸，然后再转换为pt
        graph['width'] = svgElement.clientWidth / 72;
        graph['height'] = svgElement.clientHeight / 72;
    } else {
        graph['width'] = graph['height'] = undefined
    }
    
    init_graph(graph, !hideBackground);
    bindSVGToElement(graph, visType=='GForiginal'?'svgElement': 'svg', "#mainsvg");
    
    if (graph['topic'] != null) {
        console.log('context', graph)
        draw_bbox(graph);
        draw_context(graph);
    }
}