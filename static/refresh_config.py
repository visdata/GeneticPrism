# 读取config，更新每项中 papers, authors信息

import json
import os
import pandas as pd

config = json.load(open('config.json', 'r'))

# 读取papers信息
# fields = config.keys()
# fields = ['graphdrawing']
# fields = ['fellowV3', 'ACMfellow']
# fields = ['demo', 'demo_full', 'demo_top100']
# fields = ['CG', 'database', 'HCI', 'SE', 'fellowV5', 'NLP', 'Security','CA', 'CN', 'TA']
# fields = ['database', 'visualization', 'HCI', 'VCG', 'CG', 'NLP', 'SE']
fields = ['ACMFellow', 'turing']
# fields = ['Security', 'TA']
# fields = ['VCG']


def get_cfg(base_dir, author_path = 'top_field_authors.csv'):
    if not os.path.exists(os.path.join(base_dir, author_path)):
        return {}

    authors_df = pd.read_csv(os.path.join(base_dir, author_path), dtype={'authorID': str})
    authors_count = len(authors_df)
    # topic_count = len(open(base_dir + 'field_leaves.csv', 'r').readlines()) - 1   # 现在已经remove outlier了，所以不用减1. 20250106-XL
    topic_count = len(open(base_dir + 'field_leaves.csv', 'r').readlines())
    authors = set(authors_df['authorID'].to_list())

    if os.path.exists(f'{base_dir}/baseConfigs.json'):
        baseConfigs = json.load(open(f'{base_dir}/baseConfigs.json', 'r'))
        papersCount = baseConfigs['papersCount']
        linksCount = baseConfigs['linksCount']
    else:
        # papers_count 是 path/papers 中所有 csv 的 paperID列集合的大小，注意不是简单相加，用set去重
        paperIDs = set()
        for file in os.listdir(base_dir + 'papers'):
            if file.endswith('.csv') and file.replace('.csv', '') in authors:
                # df = pd.read_csv(base_dir + 'papers/' + file, dtype={'paperID': str})
                # # df = pd.read_csv(base_dir + 'papers/' + file, dtype={'paperID': str}, engine='python', chunksize=100000)

                # if len(df):
                #     try:
                #         paperIDs.update(df['paperID'].to_list())
                #     except Exception as e:
                #         print(field, file, e)
                
                # 按块读取 CSV 文件
                file_path = base_dir + 'papers/' + file
                df_chunks = pd.read_csv(file_path, dtype={'paperID': str}, chunksize=100000, engine='python') # 直接读AI不行，太大了，所以用这种方法。

                # 处理每个块
                for df in df_chunks:
                    if len(df):
                        try:
                            paperIDs.update(df['paperID'].to_list())
                        except Exception as e:
                            print(f"Error processing {file}: {e}")
        linkIDs = set()
        for file in os.listdir(base_dir + 'links'):
            if file.endswith('.csv') and file.replace('.csv', '') in authors:
                file_path = base_dir + 'links/' + file
                df_chunks = pd.read_csv(file_path, dtype={'childrenID': str, 'parentID': str}, chunksize=100000, engine='python')
                
                for df in df_chunks:
                    if len(df):
                        try:
                            df['pair'] = df['parentID'] + df['childrenID']
                            linkIDs.update(df['pair'].to_list())
                        except Exception as e:
                            print(f"Error processing {file}: {e}")
                # df = pd.read_csv(base_dir + 'links/' + file, dtype={'childrenID': str, 'parentID': str})
                # if len(df):
                #     try:
                #         df['pair'] = df['parentID'] + df['childrenID']
                #         linkIDs.update(df['pair'].to_list())
                #     except Exception as e:
                #         print(field, file, e)
        
        papersCount = len(paperIDs)
        linksCount = len(linkIDs)
        
    return {
        'papers': papersCount,
        'authors': authors_count,
        'links': linksCount,
        'topic': topic_count
    }

websiteStr = 'https://genetic-flow.com'
print(f"""
      ATTENTION PLEASE: 
      input {websiteStr}/clean/?field=<field> in a browser after run refresh_config.py
      Change Date: 2024/12/26 
      Author: XL
      """)
for field in fields:
    print(field)
    cfg = config[field]
    if field == 'default':
        continue
    
    print('Clean Cache WebSite:')
    print(f'{websiteStr}/clean/?field={field}')
    # print(f'https://genetic-flow.com/clean/?field={field}')
    # if os.path.isdir(f'./json/{field}'):
    #     print(f'rm -rf ./json/{field}')
    #     os.system(f'rm -rf ./json/{field}')
        
    if cfg['type'] == 'Domain':
        path = f'../csv/domain/{field}/'
        df = pd.read_csv(path + 'papers.csv', dtype={'paperID': str})
        authors = set()
        for i in range(len(df)):
            authors.update(df['authorsName'][i].split(', '))
        cfg['papers'] = len(df)
        cfg['authors'] = len(authors)
        cfg['topic'] = len(open(path + 'field_leaves.csv', 'r').readlines()) - 1
        cfg['links'] = len(open(path + 'links.csv', 'r').readlines()) - 1
        continue

    path = f'../csv/{field}/'
    cfg.update(get_cfg(path))

    if 'subset' in os.listdir(path):
        cfg['subset'] = {}
        for subset in os.listdir(path + 'subset'):
            cfg['subset'][subset.replace('.csv', '')] = get_cfg(path, f'subset/{subset}')


json.dump(config, open('config.json', 'w'), indent=4)
