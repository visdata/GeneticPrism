from django.http import FileResponse, HttpResponse, JsonResponse
from django.shortcuts import render
import graphviz
import csv
import json
import os
import math
import pandas as pd
import numpy as np
import operator
import base64
from bs4 import BeautifulSoup
import re
from collections import defaultdict
from django.utils.safestring import mark_safe
from django.core import serializers
import logging
import shutil
import networkx as nx
from tqdm import tqdm
import re
import multiprocessing
import requests
from django.http import HttpResponse, HttpResponseNotFound
from thefuzz import fuzz, process

logger = logging.getLogger('log')

version_df = pd.read_csv("static/version.csv", sep=',')
versionID = version_df.iloc[-1]['versionID']
config = json.load(open('static/config.json', 'r'))

authorID2fellow = defaultdict(str)
fellow_df = pd.read_csv("static/award_authors.csv", sep=',', dtype={'MAGID': str})
for index, row in fellow_df.iterrows():
    authorID = row['MAGID']
    if authorID and authorID != 'NULL':
        authorID2fellow[authorID] += str(row['type']) + ':' + str(row['year']) + ','
# print('authorID2fellow', authorID2fellow)

field2top_authors = {}
field2topicDist = {}

def reference(request):
    client_ip = get_client_ip(request)
    logger.info("Request Parameters: [clientIP:%s]", client_ip)
    return render(request, 'reference.html')

def front(request):
    client_ip = get_client_ip(request)
    logger.info("Request Parameters: [clientIP:%s]", client_ip)
    analytic_json = {"activeUsers": "0", "newUsers": "0", "eventCount": "0"}
    try:
        with open("static/google_analytics.json", 'r') as f:
            analytic_json = json.load(f)
    except Exception as e:
        logger.error("google analytics读取错误: %s", e)
    return render(request, 'front.html', {'error': '', 'versionID': versionID,
                  'activeUsers': analytic_json['activeUsers'], 'eventCount': analytic_json['eventCount']})

def search(request):
    client_ip = get_client_ip(request)
    field = request.GET.get("field")
    logger.info("Request Parameters: [clientIP:%s] [field:%s]", client_ip, field)
    analytic_json = {"activeUsers": "0", "newUsers": "0", "eventCount": "0"}
    try:
        with open("static/google_analytics.json", 'r') as f:
            analytic_json = json.load(f)
    except Exception as e:
        logger.error("google analytics读取错误: %s", e)
    return render(request, 'search.html', {'error': '', 'fieldType': field, 'versionID': versionID,
                  'activeUsers': analytic_json['activeUsers'], 'eventCount': analytic_json['eventCount']})

def changelog(request):
    df_list = version_df.to_dict(orient='records')
    return render(request, 'changelog.html', {'changelogList': df_list})

def to_number(x):
    try:
        return float(x)
    except:
        return 0.0

def load_author(field, authorID):
    filename = f'static/json/{field}/{authorID}.json'
    if os.path.exists(filename):
        return
    edges = []
    if os.path.exists(f'csv/{field}/links/{authorID}.csv'):
        links_df = pd.read_csv(f'csv/{field}/links/{authorID}.csv', dtype={'childrenID': str, 'parentID': str})
        links_df['extendsProb'] = links_df['extendsProb'].replace('\\N', '0').astype(float)
        links_df = links_df.where(links_df.notnull(), None)
        for index, row in links_df.iterrows():
            edges.append({
                'source': row['parentID'],
                'target': row['childrenID'],
                'extends_prob': to_number(row['extendsProb']),
                'citation_context': row['citationContext']
            })

    # papers_df = pd.read_csv(f'csv/{field}/papers/{authorID}.csv', dtype={'paperID': str,
    #             'year': int, 'referenceCount': int, 'citationCount': int, 'isKeyPaper': float})
    papers_df = pd.read_csv(f'csv/{field}/papers/{authorID}.csv', dtype={
        'paperID': str,
        'year': float, 
        'referenceCount': float, 
        'citationCount': int, 
        'isKeyPaper': float
    })
    papers_df['referenceCount'] = papers_df['referenceCount'].fillna(0).astype(int)
    papers_df['year'] = papers_df['year'].fillna(0).astype(int)
    
    papers_df['survey'] = papers_df['title'].str.contains(r'survey|surveys', case=False, regex=True)
    
    
    if 'topic' in papers_df.columns:
        papers_df['topicDist'] = papers_df['topic'].apply(lambda x: {x: 1} if x else {})
    else:
        paperID2topicDist = getTopicDistribution(field)
        papers_df['topicDist'] = papers_df['paperID'].apply(lambda x: paperID2topicDist.get(x, {}))
        papers_df['topic'] = papers_df['topicDist'].apply(lambda x: max(x.items(), key=operator.itemgetter(1))[0] if x else 0) 
    
    # papers_df.fillna('', inplace=True)
    papers_df['topic'] = papers_df['topic'].astype(int)
    papers_df = papers_df.where(papers_df.notnull(), None)
    # drop unnamed columns
    papers_df = papers_df.loc[:, ~papers_df.columns.str.contains('^Unnamed')]
    papers_df = papers_df.rename(columns={
        'authorsName': 'authors',
        'paperID': 'id',
        'title': 'name',
    })
    # papers_df = papers_df[['paperID', 'year', 'referenceCount', 'citationCount', 'survey', 'isKeyPaper', 'topic']]
    
    papers_df.fillna('', inplace=True)
    dic = {
        'nodes': papers_df.to_dict(orient='records'),
        'edges': edges
    }

    os.makedirs(os.path.dirname(filename), exist_ok=True)
    with open(filename, 'w') as f:
        json.dump(dic, f, indent=4, sort_keys=True, ensure_ascii=False)


def load_domain(name):
    os.makedirs(f'static/json/domain', exist_ok=True)
    filename = f'static/json/domain/{name}.json'
    if os.path.exists(filename):
        return
    edges = []
    links_df = pd.read_csv(f'csv/domain/{name}/links.csv', dtype={'childrenID': str, 'parentID': str})
    links_df['extendsProb'] = links_df['extendsProb'].replace('\\N', '0').astype(float)
    links_df = links_df.where(links_df.notnull(), None)
    for index, row in links_df.iterrows():
        edges.append({
            'source': row['parentID'],
            'target': row['childrenID'],
            'extends_prob': to_number(row['extendsProb']),
            'citation_context': row['citationContext']
        })

    papers_df = pd.read_csv(f'csv/domain/{name}/papers.csv', dtype={'paperID': str,
                'year': int, 'referenceCount': int, 'citationCount': int, 'isKeyPaper': float})
    papers_df['survey'] = papers_df['title'].str.contains(r'survey|surveys', case=False, regex=True)
    if 'ConferenceID' in papers_df.columns:
        papers_df.drop(columns=['ConferenceID'], inplace=True)
    if "JournalID" in papers_df.columns:
        papers_df.drop(columns=['JournalID'], inplace=True)
    
    with open(f'csv/domain/{name}/paperIDTop3Distribution.json', 'r') as f:
        paperID2topicDist = json.load(f)
        
    papers_df['topicDist'] = papers_df['paperID'].apply(lambda x: paperID2topicDist.get(x, {}))
    papers_df['topic'] = papers_df['topicDist'].apply(lambda x: max(x.items(), key=operator.itemgetter(1))[0] if x else 0) 
    papers_df['topic'] = papers_df['topic'].astype(int)
    papers_df = papers_df.where(papers_df.notnull(), None)
    # drop unnamed columns
    papers_df = papers_df.loc[:, ~papers_df.columns.str.contains('^Unnamed')]
    papers_df = papers_df.rename(columns={
        'authorsName': 'authors',
        'paperID': 'id',
        'title': 'name',
    })
    # papers_df = papers_df[['paperID', 'year', 'referenceCount', 'citationCount', 'survey', 'isKeyPaper', 'topic']]
    
    dic = {
        'nodes': papers_df.to_dict(orient='records'),
        'edges': edges
    }

    os.makedirs(os.path.dirname(filename), exist_ok=True)
    with open(filename, 'w') as f:
        json.dump(dic, f, indent=4, sort_keys=True, ensure_ascii=False)


def create_graphs(field, authorID):
    # 假设已经加载了作者的数据
    filename = f'static/json/{field}/{authorID}.json'
    try:
        with open(filename, 'r') as f:
            dic = json.load(f)
    except:
        print(f"create_graphs: Failed to load author({authorID}) data")
        return

    path = f'static/json/{field}/graphs/{authorID[-1]}/{authorID}'
    # try:
    #     shutil.rmtree(path)
    # except:
    #     pass
    if os.path.exists(path):
        return
    os.makedirs(path, exist_ok=True)

    # 为每个话题创建一个图，包含当前话题的所有论文
    topics = set([paper['topic'] for paper in dic['nodes']])
    for topic in topics:
        G = nx.DiGraph()
        for paper in dic['nodes']:
            if str(topic) in paper['topicDist'].keys():
                node = paper.copy()
                node['topicSimilarity'] = node['topicDist'][str(topic)]
                del node['topicDist']
                del node['topic']
                G.add_node(paper['id'], **node)
        for edge in dic['edges']:
            if G.has_node(edge['source']) and G.has_node(edge['target']):
                G.add_edge(edge['source'], edge['target'], extends_prob=edge['extends_prob'], citation_context=edge['citation_context'])

        graph = nx.readwrite.json_graph.node_link_data(G)
        json.dump(graph, open(f'{path}/{topic}.json', 'w'), indent=4, ensure_ascii=False)
        
    # print(f"Successfully create graphs of author({authorID}) at {path}")


def create_dot(nodes, edges, minYear, maxYear):
    """
    Generates a DOT graph representation.

    Inputs:
        nodes: A list of node objects, each with 'id', 'citationCount', 'year' attributes.
        edges: A list of edge objects, each with 'source' and 'target' attributes.
        minYear: The minimum year among the nodes.
        maxYear: The maximum year among the nodes.
    """
    dot = 'digraph G {\n'
    year_dic = {}

    # Create subgraph clusters for each year
    for year in range(minYear, maxYear + 1):
        dot += f'year{year} [label="{year}"]\n'
        year_dic[year] = [f'year{year}']

    # Define nodes with citation counts as labels
    for node in nodes:
        dot += f'{node["id"]} [label="{node["citationCount"]}"]\n'
        year_dic[node['year']].append(node['id'])

    # Ensure nodes from the same year are on the same rank
    for year, items in year_dic.items():
        dot += f'{{ rank=same {" ".join(items)} }}\n'

    # Connect consecutive years
    for year in range(minYear, maxYear):
        dot += f'year{year}->year{year+1}\n'

    # Define edges between nodes
    for edge in edges:
        dot += f'{edge["source"]}->{edge["target"]}\n'

    dot += '}'
    return dot

def has_topic(node, topic):
    if 'topicDist' in node:
        return str(topic) in node['topicDist'].keys()
    return topic == node['topic']
    

def create_dot_graphs(field, authorID, node_thresh=0.5, edge_thresh=0.2, mode_value='2', survey_value='0', year_grid=2):
    """
    Filters and processes global data based on various criteria such as year, relevance, and importance metrics.

    Inputs:
        author_data: Dictionary containing 'nodes' and 'edges' from author data.
        node_thresh: Threshold value from a slider for filtering nodes based on 'isKeyPaper' attribute.
        edge_thresh: Threshold value from a slider for filtering edges based on 'extends_prob' attribute.
        mode_value: Mode for filtering nodes (1 for removing isolated, 2 for partially removing).
        survey_value: Value to determine if survey papers should be removed.
        year_grid: Integer value to adjust year calculations in grouping.
    
    Functionality:
        - Filters nodes and edges based on given threshold.
        - Adjusts node data based on the mode and survey options.
        - Calculates degree information for filtered nodes and updates global data structures.
        - Processes and adjusts field information based on filtered nodes.
    
    Outputs:
        Generate DOT graphs for each topic:
        - <topicID>.dot: with context
        - _<topicID>.dot: without context
    """
    filename = f'static/json/{field}/{authorID}.json'
    try:
        with open(filename, 'r') as f:
            author_data = json.load(f)
    except:
        print(f"create_dot_graphs: Failed to load author({authorID}) data")
        return

    path = f'static/json/{field}/dot/{authorID[-1]}/{authorID}'
    exmple_path = f'static/json/{field}/dot/exmample'
    os.makedirs(exmple_path, exist_ok=True)
    # try:
    #     shutil.rmtree(path)
    # except:
    #     pass
    if os.path.exists(path):
        return
    os.makedirs(path, exist_ok=True)

    # Filter nodes and edges based on threshold
    filtered_nodes = [node for node in author_data['nodes'] if node['isKeyPaper'] >= node_thresh and node['year'] > 1900]
    filtered_edges = [edge for edge in author_data['edges'] if edge['extends_prob'] >= edge_thresh]
    topics = set([node['topic'] for node in author_data['nodes']])
    if len(topics) == 0:
        print(f"create_dot_graphs: No topics for author({authorID})")
        return
    if len(filtered_nodes) == 0:
        print(f"create_dot_graphs: No nodes for author({authorID})")
        return

    # Update year range based on filtered nodes
    min_year = min(node['year'] for node in filtered_nodes)
    max_year = max(node['year'] for node in filtered_nodes)
    # print('minYear', min_year, 'maxYear', max_year)

    # Remove surveys from nodes if required
    if survey_value == '1':
        filtered_nodes = [node for node in filtered_nodes if not node['survey']]

    # Compute degree information
    indegree = {node['id']: 0 for node in filtered_nodes}
    outdegree = {node['id']: 0 for node in filtered_nodes}
    alldegree = {node['id']: 0 for node in filtered_nodes}
    node_set = set(node['id'] for node in filtered_nodes)

    # Connect only relevant edges
    connected_edges = []
    for edge in filtered_edges:
        if node_set.issuperset({edge['source'], edge['target']}):
            outdegree[edge['source']] += 1
            indegree[edge['target']] += 1
            alldegree[edge['source']] += 1
            alldegree[edge['target']] += 1
            connected_edges.append(edge)

    # Apply mode-specific filtering
    if mode_value == '1':  # Remove isolated nodes
        filtered_nodes = [node for node in filtered_nodes if alldegree[node['id']] > 0]
    elif mode_value == '2':  # Partially remove nodes
        filtered_nodes = [node for node in filtered_nodes if alldegree[node['id']] > 0 or node['citationCount'] >= 50]

    filtered_edges = connected_edges

    # Update global variables with processed data
    for topic in topics:
        nodes = [node for node in filtered_nodes if has_topic(node, topic)]
        if len(nodes) == 0:
            continue
        # print('topic', topic, 'nodes', len(nodes))
        node_set = set(node['id'] for node in nodes)
        edges = [edge for edge in filtered_edges if edge['source'] in node_set and edge['target'] in node_set]
        edges_str = [f'{edge["source"]}->{edge["target"]}' for edge in edges]
        G = nx.DiGraph()
        for node in nodes:
            G.add_node(node['id'], **node)
        for edge in edges:
            G.add_edge(edge['source'], edge['target'])
        for year in range(min_year, max_year + 1):
            G.add_node(f'l{year}', year=year)
            G.add_node(f'r{year}', year=year)
        for year in range(min_year, max_year):
            G.add_edge(f'l{year}', f'l{year+1}')
            G.add_edge(f'r{year}', f'r{year+1}')

        original_dot = create_dot(nodes, edges, min_year, max_year)
        with open(f'{path}/_{topic}.dot', 'w') as f:
            f.write(original_dot)
        # print(original_dot)

        context_edges = defaultdict(int)
        for edge in filtered_edges:
            if f'{edge["source"]}->{edge["target"]}' in edges_str:
                continue

            source_node = [node for node in filtered_nodes if node['id'] == edge['source']][0]
            target_node = [node for node in filtered_nodes if node['id'] == edge['target']][0]
            if has_topic(source_node, topic):
                # 出边，只记年份的数量，不记topic的数量
                context_edges[f'{source_node["id"]}->r{target_node["year"]}'] += 1
                G.add_edge(source_node['id'], f'r{target_node["year"]}')
            if has_topic(target_node, topic):
                context_edges[f'l{source_node["year"]}->{target_node["id"]}'] += 1
                G.add_edge(f'l{source_node["year"]}', target_node['id'])
            
        virtual_edges = []
        # 遍历每个连通块，找到具有最大year属性的节点（该节点最后添加），如果该连通块有l,r则略过
        for component in list(nx.weakly_connected_components(G)):
            node = find_last_node_in_component(G, component)
            if node:
                node_year = G.nodes[node]['year']
                virtual_edges.append(f'{node}->{f"r{node_year}"}')

        dot = process_dot_context(original_dot, context_edges, year_grid, virtual_edges)
        with open(f'{path}/{topic}.dot', 'w') as f:
            f.write(dot)

        if len(nodes) >= 20:
            with open(f'{exmple_path}/{authorID}_{topic}.dot', 'w') as f:
                f.write(dot)

def find_last_node_in_component(G, component):
    max_year_value = max(G.nodes[node]['year'] for node in component)
    last_node = None
    for node in component:
        if G.nodes[node]['year'] == max_year_value:
            if node[0] in ['l', 'r']:
                return None
            last_node = node
    return last_node

def process_dot_context(dot, context_edges, grid=2, virtual_edges=None):
    """
    Processes a dot graph to adjust and filter nodes and edges based on context edges and a grid system.

    Inputs:
        dot: A string containing the dot graph.
        context_edges: Dictionary where keys are 'lxxxx->rxxxx' edge strings and values are attributes like weight.
        grid: Integer value representing the grid size for adjusting years in node labels.

    Returns:
        output: A string containing the processed dot graph with nodes and edges adjusted based on the context.
    """
    l = float('inf')
    r = float('-inf')
    labels = ''
    focus_edges_str = ''
    ranks = ''

    # Parse the dot input to categorize lines and update years
    for line in dot.split('\n'):
        if 'year' in line:
            if 'rank' in line:
                ranks += line + '\n'
        elif 'label' in line:
            labels += '\t' + line + '\n'
        elif '->' in line:
            focus_edges_str += '\t' + line + '\n'

    # Extract minimum and maximum year from context_edges
    for edge in context_edges.keys():
        match = re.match(r'l(\d+)->(\d+)', edge)
        if match:
            value = int(match.group(1))
        else:
            match = re.match(r'(\d+)->r(\d+)', edge)
            if match:
                value = int(match.group(2))
            else:
                continue
        l = min(l, value)
        r = max(r, value)

    # Filter ranks and update valid year ranges
    valid_years = []
    for line in ranks.split('\n'):
        match = re.search(r'year(\d+) (\d+)', line)
        if match:
            valid_years.append(int(match.group(1)))

    if valid_years:
        l = min(l, valid_years[0])
        r = max(r, valid_years[-1])

    # print('valid year range:', l, r)

    # Filter ranks to include only relevant years
    ranks = '\n'.join([line for line in ranks.split('\n') if re.search(r'year(\d+)', line) and l <= int(re.search(r'year(\d+)', line).group(1)) <= r])

    # Generate chains of left and right nodes for each year
    left_nodes = [f'l{year}' for year in range(l, r + 1)]
    right_nodes = [f'r{year}' for year in range(l, r + 1)]
    left_chain = '->'.join(left_nodes)
    right_chain = '->'.join(right_nodes)

    # Replace year labels with l and r notation in text
    def replace_year_with_lr(text):
        return re.sub(r'year(\d+)', lambda match: f"l{match.group(1)} r{match.group(1)}", text)

    # Transform node names based on the grid
    # 注意从l节点的east 和 r节点的west端口
    def transform_node_name(name, grid):
        match = re.match(r'^([lr])(\d+)$', name)
        if match:
            prefix, number = match.groups()
            number = int(number)
            if prefix == 'l':
                ret = (number // grid) * grid
                # return f'l{max(ret, l)}:e'
                return f'l{max(ret, l)}'
            elif prefix == 'r':
                ret = (number // grid + 1) * grid - 1
                # return f'r{min(ret, r)}:w'
                return f'r{min(ret, r)}'
        return name
 
    # Process and merge context edges
    new_context_edges = {}
    for edge, weight in context_edges.items():
        src, dst = edge.split('->')
        new_src = transform_node_name(src, grid)
        new_dst = transform_node_name(dst, grid)
        new_edge = f'{new_src}->{new_dst}'
        if new_edge in new_context_edges:
            new_context_edges[new_edge]['weight'] += weight
            new_context_edges[new_edge]['penwidth'] += weight  # Assume penwidth is cumulative
        else:
            new_context_edges[new_edge] = {'weight': weight, 'penwidth': weight, 
                                           'port': 'tailport=e' if new_src[0] == 'l' else 'headport=w'}

    # Generate context edges string
    context_edges_str = '\n'.join([f'{edge} [color="lightgray", {data["port"]}, weight={data["weight"]}, penwidth={data["penwidth"]}]' for edge, data in new_context_edges.items()])
    virtual_edges_str = '\n'.join([f'{edge} [style="invis"]' for edge in virtual_edges]) if virtual_edges else ''

    # Generate final output dot string
    output = f"""
digraph G {{

crossing_type=0
    
subgraph left {{
    style=filled
    color=lightgrey
    node [style=filled,color=lightblue]
    {left_chain} [weight=10000]
    label = "left"
}}

subgraph focus{{
    edge [weight=10]
{labels}
{focus_edges_str}
}}

subgraph right {{
    style=filled
    color=lightgrey
    node [style=filled,color=lightgrey]
    {right_chain} [weight=10000]
    label = "right"
}}

{replace_year_with_lr(ranks)}
{context_edges_str}
l{l}->r{l} [style="invis"]
{virtual_edges_str}
}}    
"""
    
    # print(output)
    return output


 
def read_top_authors(field, subset=None):
    if field in field2top_authors:
        return field2top_authors[field]
    
    path = f'csv/{field}/top_field_authors.csv'
    if subset:
        path = f'csv/{field}/subset/{subset}.csv'
    df = pd.read_csv(path, sep=',', dtype={'authorID': str})
    df['fellow'] = df['authorID'].apply(lambda x: authorID2fellow.get(x, ''))

    if 'original' in df.columns and field in ['turing', 'fellowTuring', 'ACMfellow']:
        df['name'] = df['original']

    if 'PaperCount' in df.columns and 'PaperCount_field' in df.columns:
        df = df.drop(columns=['PaperCount'])
    if 'CitationCount' in df.columns and 'CitationCount_field' in df.columns:
        df = df.drop(columns=['CitationCount'])

    df = df.rename(columns={
        'PaperCount_field': 'PaperCount',
        'CitationCount_field': 'CitationCount',
        'hIndex_field': 'hIndex',
        'CorePaperCount_field': 'CorePaperCount',
        'CoreCitationCount_field': 'CoreCitationCount',
        'CorehIndex_field': 'CorehIndex'
    })

    # 选择需要的列
    df = df[['authorID', 'name', 'PaperCount', 'CitationCount', 'hIndex', 
             'CorePaperCount', 'CoreCitationCount', 'CorehIndex', 'fellow']]

    df = df.rename(columns={
        'PaperCount': 'paperCount',
        'CitationCount': 'citationCount',
        'hIndex': 'hIndex',
        'CorePaperCount': 'corePaperCount',
        'CoreCitationCount': 'coreCitationCount',
        'CorehIndex': 'corehIndex'
    })

    for col in ['paperCount', 'citationCount', 'hIndex', 'corePaperCount', 
                'coreCitationCount', 'corehIndex']:
        df[col] = df[col].astype(int)

    # 再次检查并删除重复的列，确保最终的 DataFrame 没有重复的列
    df = df.loc[:, ~df.columns.duplicated()]

    field2top_authors[field] = df
    return df


def degree(request):
    field = request.GET.get("field")
    topN = int(request.GET.get("topN", 200))

    df = read_top_authors(field)
    df = df[['authorID', 'name', 'paperCount', 'hIndex', 'fellow']]
    df = df.sort_values(by='hIndex', ascending=False)
    
    df = df.head(topN)
    for index, row in df.iterrows():
        authorID = row['authorID']
        load_author(field, authorID)
        # 这里防止报错删掉：turing/top_field_authors.csv中两行： 2058634616 3081858028

    # keys = list(topAuthors.keys())
    # print('load complete', df, keys, authorID2fellow)
    return render(request, 'degree.html', {
        'field': field,
        'versionID': versionID,
        'authorsData': mark_safe(json.dumps(df.values.tolist())),  # 直接传递 Python 对象
        # 'topAuthors': mark_safe(json.dumps(topAuthors)),
        'topN': topN
    })


def process_batch(pairs):
    field, authorID_list, order = pairs
    print(order, len(authorID_list))

    for authorID in tqdm(authorID_list):
        load_author(field, authorID)
        create_graphs(field, authorID)
        create_dot_graphs(field, authorID)


def graph(request):
    field = request.GET.get("field")
    authorID = request.GET.get("id", None)
    base_url = 'http://ye-sun.com:1401/sy/GFVis'

    print('graph', authorID)

    if authorID:
        load_author(field, authorID)
        create_graphs(field, authorID)
        create_dot_graphs(field, authorID)
    else:
        df = read_top_authors(field)
        df = df[['authorID', 'name', 'paperCount', 'hIndex', 'fellow']]
        df = df.sort_values(by='hIndex', ascending=False)
        # for index, row in tqdm(df.iterrows(), total=df.shape[0]):
        #     authorID = row['authorID']
        #     load_author(field, authorID)
        #     create_graphs(field, authorID)
        #     create_dot_graphs(field, authorID)
        authorID_list = df['authorID'].tolist()
        multiprocess_num = multiprocessing.cpu_count()
        with multiprocessing.Pool(processes=multiprocess_num) as pool:
            pool.map(process_batch, [(field, authorID_list[i::multiprocess_num], f'{i}/{multiprocess_num}') for i in range(multiprocess_num)])

    
    site = f'{base_url}/static/json/{field}'
    if not os.path.exists(f'static/json/{field}/topic.csv'):
        shutil.copy(f'csv/{field}/field_leaves.csv', f'static/json/{field}/topic.csv')
    if not os.path.exists(f'static/json/{field}/authors.csv'):
        shutil.copy(f'csv/{field}/top_field_authors.csv', f'static/json/{field}/authors.csv')

    return HttpResponse(f"Successfully create graphs of top authors at<br> <a href='{site}'>{site}</a>")


def topicflow(request):
    field = request.GET.get("field")
    topN = int(request.GET.get("topN", 200))

    df = read_top_authors(field)
    df = df[['authorID', 'name', 'paperCount', 'hIndex', 'fellow']]
    df = df.sort_values(by='hIndex', ascending=False)
    
    df = df.head(topN)
    for index, row in df.iterrows():
        authorID = row['authorID']
        load_author(field, authorID)

    # keys = list(topAuthors.keys())
    # print('load complete', df, keys, authorID2fellow)
    return render(request, 'topicflow.html', {
        'field': field,
        'versionID': versionID,
        'authorsData': mark_safe(json.dumps(df.values.tolist())),  # 直接传递 Python 对象
        # 'topAuthors': mark_safe(json.dumps(topAuthors)),
        'topN': topN,
        'fields': get_fields(field),
    })

def getTopicDistribution(field):
    if field in field2topicDist:
        return field2topicDist[field]
    if os.path.exists(f'csv/{field}/paperIDTop3Distribution.json'):
        with open(f'csv/{field}/paperIDTop3Distribution.json', 'r') as f:
            field2topicDist[field] = json.load(f)
            return field2topicDist[field]
        
    if os.path.exists(f'csv/{field}/paperID2topic.json'):
        with open(f'csv/{field}/paperID2topic.json', 'r') as f:
            paperID2topic = json.load(f)
            field2topicDist[field] = {paperID: {topic: 1} for paperID, topic in paperID2topic.items()}
            return field2topicDist[field]
    return {}


def index(request):
    fieldType = request.GET.get("field")
    authorID = request.GET.get("id")
    client_ip = get_client_ip(request)

    if fieldType == 'domain':
        logger.info("Request Parameters: [clientIP:%s] [field:%s] [name:%s]",
                client_ip, fieldType, authorID)
        load_domain(authorID)
        return render(request, "index.html",
                        {'authorID': authorID, 'name': authorID, 'paperCount': config[authorID]['papers'], 
                         'citationCount': config[authorID]['links'],  'hIndex': 0, 
                         'fields': pd.read_csv(f"csv/domain/{authorID}/field_leaves.csv", sep=',').values.tolist(), 'fieldType': fieldType})

    df = read_top_authors(fieldType)
    author = df[df["authorID"] == authorID]
    author = author.to_dict(orient='records')[0]
    logger.info("Request Parameters: [clientIP:%s] [field:%s] [authorID:%s] [scholar:%s]",
                client_ip, fieldType, authorID, author["name"])
    
    load_author(fieldType, authorID)
    return render(request, "index.html",
                  {'authorID': authorID, 'name': author["name"], 'paperCount': author["paperCount"], 
                   'citationCount': author["citationCount"], 'hIndex': author["hIndex"], 
                   'fields': get_fields(fieldType), 'fieldType': fieldType})


def prism(request):
    fieldType = request.GET.get("field")
    authorID = request.GET.get("id")
    client_ip = get_client_ip(request)
    download = request.GET.get("download", 0)
    # download=0: do not download
    # download=1: download all
    # download=2: download svg
    # download=3: download gif
    node_prob = request.GET.get("node_prob", -1)
    edge_prob = request.GET.get("edge_prob", -1)
    # 默认值为-1，表示使用默认概率

    if fieldType == 'domain':
        logger.info("Request Parameters: [clientIP:%s] [field:%s] [name:%s]",
                client_ip, fieldType, authorID)
        load_domain(authorID)
        return render(request, "prism.html",
                        {'authorID': authorID, 'name': authorID, 'paperCount': config[authorID]['papers'], 
                         'citationCount': config[authorID]['links'],  'hIndex': 0, 
                         'fields': pd.read_csv(f"csv/domain/{authorID}/field_leaves.csv", sep=',').values.tolist(), 'fieldType': fieldType})

    df = read_top_authors(fieldType)
    author = df[df["authorID"] == authorID]
    author = author.to_dict(orient='records')[0]
    logger.info("Request Parameters: [clientIP:%s] [field:%s] [authorID:%s] [scholar:%s]",
                client_ip, fieldType, authorID, author["name"])
    
    load_author(fieldType, authorID)
    return render(request, "prism.html",
                  {'authorID': authorID, 'name': author["name"], 'paperCount': author["paperCount"], 
                   'citationCount': author["citationCount"], 'hIndex': author["hIndex"], 
                   'fields': get_fields(fieldType), 'fieldType': fieldType, 'download': download, 
                   'node_prob': node_prob, 'edge_prob': edge_prob})

def clean(request):
    field = request.GET.get("field")
    authorID = request.GET.get("id")
    path = f"static/json/{field}"

    global field2top_authors
    global field2topicDist
    if field in field2top_authors:
        del field2top_authors[field]
    if field in field2topicDist:
        del field2topicDist[field]

    try:
        shutil.rmtree(path)
        return HttpResponse("Successfully deleted " + path)
    except Exception as e:
        return HttpResponse("Failed to delete " + path + " because: " + e.__str__())

def showlist(request):
    fieldType = request.GET.get("field", 0)
    name = request.GET.get("name", None)
    subset = request.GET.get("subset", None)
    client_ip = get_client_ip(request)
    logger.info("Request Parameters: [clientIP:%s] [field:%s] [scholar:%s]", client_ip, fieldType, name)

    if fieldType == 0:
        df_list = []
        config_field_list = list(config.keys())
        for field in list(os.listdir('csv')):
            if field not in config_field_list:
                continue
            if os.path.isdir(f'csv/{field}'):
                try:
                    df_field = read_top_authors(field)
                    df_field['field'] = field
                    df_list.append(df_field)
                except:
                    pass
            # print(field, len(df_field), df_field.columns)
        # 合并 DataFrame，并忽略原始索引
        df_list = [df_field for df_field in df_list if not df_field.empty]
        df = pd.concat(df_list, ignore_index=True)
    else:
        df = read_top_authors(fieldType, subset)

    if name:
        # TheFuzz 代替原先的简单模糊匹配
        names_in_db = df['name'].tolist()
        best_matches = process.extract(name, names_in_db, limit=10, scorer=fuzz.token_sort_ratio)
        matched_names = [match[0] for match in best_matches if match[1] > 80]
        fuzzy_df = df[df['name'].isin(matched_names)]
        raw_df = df[df['name'].apply(lambda x: name.lower() in x.lower())]
        filtered_df = pd.concat([fuzzy_df, raw_df], ignore_index=True)
        filtered_df = filtered_df.drop_duplicates(subset=['field', 'authorID'], keep='first')
        scholarList = filtered_df.to_dict(orient='records')
    else:
        scholarList = df.to_dict(orient='records')
    if len(scholarList) == 0:
        error = 'No author named ' + name               # 错误信息
        return render(request, 'search.html', {'error': error, 'fieldType': fieldType, 'versionID': versionID})
    else:
        return render(request, "list.html", {'scholarList': scholarList, 'fieldType': fieldType, 'name': name})

    
def get_fields(fieldType):
    path = f'csv/{fieldType}/'
    leaves_path = os.path.join(path, "field_leaves.csv")
    if os.path.exists(leaves_path) == False:
        return [[0,7406,"default",0,0,113.7,0.4438242822393499,1,1]]
    return pd.read_csv(leaves_path, sep=',').values.tolist()


def get_client_ip(request):
    x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
    if x_forwarded_for:
        ip = x_forwarded_for.split(',')[0]
    else:
        ip = request.META.get('REMOTE_ADDR')
    return ip

def dataset(request):
    fieldType = request.GET.get("field")
    if fieldType == None:
        return render(request, 'dataset.html')
    else:
        import tarfile
        from tempfile import TemporaryFile
        dataset_path = f'csv/{fieldType}'
        with TemporaryFile() as tmp:
            with tarfile.open(fileobj=tmp, mode='w:gz') as tar:
                tar.add(dataset_path, arcname=os.path.basename(dataset_path))

            # 将文件指针移动到文件的开始
            tmp.seek(0)

            response = HttpResponse(tmp.read(), content_type='application/gzip')
            response['Content-Disposition'] = f'attachment; filename="{fieldType}.tar.gz"'
            return response
