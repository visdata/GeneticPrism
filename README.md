# GeneticFlow Visual Analysis System

*注意*：为保证项目运行的稳定性，分离测试和正式环境，开发一律使用测试环境，在正式环境文件夹下不要修改代码，只能pull！

## 服务器环境
1. 数据准备：将现有csv同步到本文件夹中，如：`rsync -a root@ye-sun.com:/root/pyCode/GFVis/csv/ csv/ --progress=info2`

2. 增加新领域

   - 将数据传输至`csv/` 对应领域目录下，包括papers, links, top_field_authors.csv, paperIDDistribution.csv, field_leaves.csv

   - static/config.json 加入新领域说明
   - 运行static中的refresh_config.py，更新领域基础信息

   - 运行script中的update_version.py，加入新版本的说明
2. 环境搭建（在root的base环境下）
```
pip install -r requirements.txt
# 根据系统是Ubuntu/centos，选择包管理器安装Graphviz
sudo apt-get install graphviz graphviz-dev
```
3. 运行命令（在root的base环境下运行）

4套系统：
- V2N可视化，V2数据（正式服）：https://genetic-flow.com/
- V1可视化，V1数据：https://v1.genetic-flow.com/
- V2可视化，V1数据：https://v2.genetic-flow.com/
- V2N可视化，V2N数据：https://v2n.genetic-flow.com/

V2N数据是在V2基础上复制的新数据，用于测试服更新和查看。如果测试正常，再使用V2N数据更新正式服数据

```bash
#正式服
cd /root/pyCode/GFVis
git checkout v2n
pkill -f "runserver 0.0.0.0:9001"
nohup python manage.py runserver 0.0.0.0:9001 2>&1 &

cd /root/pyCode/v1
git checkout v1
pkill -f "runserver 0.0.0.0:9002"
nohup python manage.py runserver 0.0.0.0:9002 2>&1 &

cd /root/pyCode/v2
git checkout v2
pkill -f "runserver 0.0.0.0:9003"
nohup python manage.py runserver 0.0.0.0:9003 2>&1 &

# 测试服
cd /root/pyCode/v2n
git checkout v2n
pkill -f "runserver 0.0.0.0:9004"
nohup python manage.py runserver 0.0.0.0:9004 2>&1 &
```

## 个人环境

```
nohup python manage.py runserver 0.0.0.0:9050 2>&1 &
```


## 数据链接

在 Linux 系统中，可以使用符号链接（symbolic link）来实现路径的映射。符号链接是一种特殊的文件，它指向另一个文件或目录。这样，当访问符号链接时，实际上是访问它所指向的目标。可以使用 ln -s 命令来创建符号链接。以下是步骤：

删除原有目录（如果存在）：在创建符号链接之前，确保原有目录（如 ./csv）不存在，或者将其重命名或移动到其他地方。

创建符号链接：使用 ln -s 命令创建从 ./csv 到 /home/sy/GFVis/csv 的符号链接。

具体操作如下：

```bash
# 移动到目标目录
cd /your/working/directory

# 确保原有目录不存在
rm -rf ./csv

# 创建符号链接
ln -s /home/sy/GFVis/csv ./csv
```

这样，当程序访问 ./csv/XXX/paperIDDistribution.csv 时，实际上访问的是 /home/sy/GFVis/csv/XXX/paperIDDistribution.csv。

在相同服务器上，为了避免重复数据占用的空间，一律建立到统一的数据存放目录：
- 云服务器（v1数据）：`rm -rf ./csv && ln -s /root/pyCode/v1/csv ./csv`
- 云服务器（v2数据）：`rm -rf ./csv && ln -s /root/pyCode/GFVis/csv ./csv`
- 140服务器：`rm -rf ./csv && ln -s /home/sy/GFVis/csv ./csv`