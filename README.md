# GeneticPrism: Scholarly Research Evolution Visualization

## Introduction  
This repository hosts the code for the TVCG paper:  
**[GeneticPrism: Multifaceted Visualization of Citation-based Scholarly Research Evolution](https://arxiv.org/abs/2408.08912)**  

🔗 **Online System**: https://genetic-flow.com  

### Abstract  
Understanding the evolution of scholarly research is essential for academic decision-making (e.g., research planning and frontier exploration). Existing platforms like Google Scholar rely on abstract numerical indicators lacking contextual depth, while visualization approaches rarely leverage curated self-citation data to depict individual scholars’ evolution.  

This work introduces:  
- A **novel 3D prism metaphor** visualizing scholars’ research profiles  
- Structured topic evolution via **streamgraphs** and **inter-topic flow maps**  
- **Six-degree-impact glyphs** highlighting interdisciplinary breakthroughs  
- Evaluations through case studies (Turing Award laureates, visualization venues) and user studies  

## Dataset  
Processed from the open-source **Academic Graph**:  
- **v1** (up to Sept. 2022): Based on [Microsoft Academic Graph (MAG)](https://github.com/sunieee/MAGProcessing)  
- **v2** (up to Oct. 2024): MAG fused with **[OpenAlex](https://openalex.org)** (KDD’23 paper: [MAGProcessing](https://dl.acm.org/doi/abs/10.1145/3580305.3599845))  

🔗 **Download v2 dataset**: [FigShare](https://figshare.com/)

## Deployment  

### Step 1: Data Preparation  
Place the extracted CSV files in the project root directory.

### Step 2: Install Dependencies  
```bash
pip install -r requirements.txt

# Install Graphviz (choose OS-specific command):
sudo apt-get install graphviz graphviz-dev     # Ubuntu/Debian
sudo yum install graphviz graphviz-devel       # CentOS/RHEL
```

### Step 3: Run the Server  
**Option A: Direct run**  
```bash
python manage.py runserver 0.0.0.0:9001
```

**Option B: Background run (persistent)**  
```bash
nohup python manage.py runserver 0.0.0.0:9001 2>&1 &
```

### Additional Notes  
- Access the system at: `http://<your-ip>:9001`  
- Use `ctrl + c` to terminate direct runs  
- Monitor background processes via `tail -f nohup.out`  
