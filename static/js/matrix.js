let showUnreferenced = false;  // 默认不显示无引用关系的论文
let showYearMatrix = false;    // 默认不显示年份矩阵
let svg = null, matrixg = null, subg = null;

function drawMatrix() {
    let nodes = global_nodes, edges = global_edges;
    var topicNodesMap = new Map();
    nodes.forEach(node => {
        const topicKey = node.topic === null? null: parseInt(node.topic);
        if (!topicNodesMap.has(topicKey)) {
            topicNodesMap.set(topicKey, []);
        }
        topicNodesMap.get(topicKey).push(node);
    });
    topicNodesMap.forEach((value, _) => {
        value.sort((a, b) => {
            if (a.year != b.year) return a.year - b.year;
            else return b.citationCount - a.citationCount;
        });
    });
    console.log('topicNodesMap', topicNodesMap);

    topicNodesList = Array.from(topicNodesMap).sort((a, b) => b[1].length - a[1].length);

    sortNodes = topicNodesList.reduce((accumulator, current) => {
        return accumulator.concat(current[1]);
    }, []);

    var adjacencyMatrix = Array(sortNodes.length).fill().map(() =>
            Array(sortNodes.length).fill().map(() => ({
                // "color": [0, 0, 0],         // 初始化为白色
                "source":"", "target":"",
                "sourceCitation": -1, "targetCitation": -1,
            })));

    const findIndexById = (id) => sortNodes.findIndex(node => node.id == id);

    edges.forEach(edge => {
        const source = findIndexById(edge.source);
        const target = findIndexById(edge.target);
        if (source != -1 && target != -1) {
            // adjacencyMatrix[source][target].color =
            //         sortNodes[source].topic == sortNodes[target].topic ? sortNodes[source].color : [0, 0, 0.5];
            adjacencyMatrix[source][target].source = `${sortNodes[source].name}(${sortNodes[source].year})(${sortNodes[source].citationCount})`;
            adjacencyMatrix[source][target].target = `${sortNodes[target].name}(${sortNodes[target].year})(${sortNodes[target].citationCount})`;
            adjacencyMatrix[source][target].sourceCitation = sortNodes[source].citationCount || 0;
            adjacencyMatrix[source][target].targetCitation = sortNodes[target].citationCount || 0;
        }
    });

    // const maxCitation = Math.max(...sortNodes.map(node => node.citationCount || 0));
    const maxCitation = 1000;

    console.log('adjacencyMatrix', adjacencyMatrix);

    var div = d3.select("#matrixsvg");
    var width = div.node().offsetWidth;
    var height = div.node().offsetHeight;

    var svg = div.append("svg")
        .attr("width", width)
        .attr("height", height);
    
    svg.append("g").attr("id", "matrixgroup");

    zoom = d3.zoom()
        .scaleExtent([0.05, 10])
        .on("zoom", _ => d3.select("#matrixgroup").attr("transform", d3.event.transform));
    svg.call(zoom);

    const ratioBar = 0.1;       // 矩阵上方引用柱所占高度的百分比
    const matrixHeight = height * (1 - ratioBar);
    const size = Math.min(width, matrixHeight) / nodes.length;    // 矩阵元素的大小
    var xOffset = 0, yOffset = height * ratioBar;
    if (width > matrixHeight) {
        xOffset += (width - matrixHeight) / 2;
    } else {
        yOffset += (matrixHeight - width) / 2;
    }

    d3.select("#matrixgroup").selectAll('.topicMatrix')
        .data(adjacencyMatrix.flat())
        .enter()
        .append('rect')
        .attr('x', (_, i) => (i % nodes.length) * size + xOffset)
        .attr('y', (_, i) => Math.floor(i / nodes.length) * size + yOffset)
        .attr('width', size)
        .attr('height', size)
        .attr('fill', d => {
            if (d.sourceCitation == -1 && d.targetCitation == -1) return "white";
            else if (d.sourceCitation >= 100 && d.targetCitation >= 100) return "red";
            else if (d.sourceCitation >= 100 && d.targetCitation < 100) return "orange";
            else if (d.sourceCitation < 100 && d.targetCitation >= 100) return "blue";
            else if (d.sourceCitation < 100 && d.targetCitation < 100) return d3.rgb(169,169,169);
        })
        .attr('stroke', d3.hsv(0, 0, 1))
        .attr('stroke-width', 0)
        .attr('class', 'topicMatrix');

    const tipMatrix = d3.tip()
        .attr("class", "d3-tip-matrix")
        .html(d => {
            if (d.source == '' && d.target == '') return "";
            return `<div>${d.source}</div><div>&#8595;</div><div>${d.target}</div>`;
        });

    d3.select("#matrixgroup").call(tipMatrix);
    d3.selectAll(".topicMatrix")
    .on('mouseover', function (d) {
        d3.select(this).attr('cursor', 'pointer');
        tipMatrix.show(d, this);
    })
    .on('mouseout', function (d) {
        tipMatrix.hide(d, this);
    });

    /* draw submatrix borders */
    var start = 0;
    topicNodesList.forEach(([topicId, topicNodes], index) => {
        const len = topicNodes.length;
        d3.select("#matrixgroup")
            .append('rect')
            .attr('x', start * size + xOffset)
            .attr('y', start * size + yOffset)
            .attr('width', len * size)
            .attr('height', len * size)
            .attr('fill', 'none')
            .attr('stroke', topic2color(topicId))
            .attr('stroke-width', size / 5);
        start += len;
    });

    /* draw citation bar */
    const barHeight = height * ratioBar;
    d3.select("#matrixgroup")
        .selectAll('.unknown')
        .data(sortNodes)
        .enter()
        .append('rect')
        .attr('x', node => xOffset - (Math.min(node.citationCount, maxCitation) / maxCitation * barHeight))
        .attr('y', (_, i) => i * size + yOffset)
        .attr('width', node => (Math.min(node.citationCount, maxCitation) / maxCitation * barHeight))
        .attr('height', size)
        .attr('fill', d3.rgb(169,169,169))
        .attr('class', 'matrixBar');
    d3.select("#matrixgroup")
        .selectAll('.unknown')
        .data(sortNodes)
        .enter()
        .append('rect')
        .attr('x', (_, i) => i * size + xOffset)
        .attr('y', node => yOffset - (Math.min(node.citationCount, maxCitation) / maxCitation * barHeight))
        .attr('width', size)
        .attr('height', node => Math.min(node.citationCount, maxCitation) / maxCitation * barHeight)
        .attr('fill', d3.rgb(169,169,169))
        .attr('class', 'matrixBar');

    const tipMatrixBar = d3.tip()
        .attr("class", "d3-tip-matrix")
        .html(d => {
            return `<div>${d.name}(${d.citationCount})</div>`;
        });
    matrixg.call(tipMatrixBar);
    d3.selectAll(".matrixBar")
    .on('mouseover', function (d) {
        d3.select(this).attr('cursor', 'pointer');
        tipMatrixBar.show(d, this);
    })
    .on('mouseout', function (d) {
        tipMatrixBar.hide(d, this);
    });

}
