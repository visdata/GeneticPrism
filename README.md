# GeneticPrism: Scholarly Research Evolution Visualization

![logo-search](https://github.com/user-attachments/assets/1793b109-d9bb-44c9-b72d-58958219b3ef)

## Introduction  
This repository hosts the code for the paper:  
**[GeneticPrism: Multifaceted Visualization of Citation-based Scholarly Research Evolution](https://arxiv.org/abs/2408.08912)**  

🔗 **Online System**: https://genetic-flow.com / https://geneticflow.ye-sun.com/

🎞️ **Demo Video**: https://youtu.be/zVbM7lgA6Ig

See [User Manual](https://github.com/visdata/GeneticPrism/wiki/User-Manual) and [Appendix](https://github.com/visdata/GeneticPrism/wiki/Appendix) in Wiki pages.

### Abstract  
Understanding the evolution of scholarly research is essential for academic decision-making (e.g., research planning and frontier exploration). Existing platforms like Google Scholar rely on abstract numerical indicators lacking contextual depth, while visualization approaches rarely leverage curated self-citation data to depict individual scholars’ evolution.  

This work introduces:  
- A **3D prism metaphor** visualizing scholars’ research profiles  
- A **scroll metaphor** visualizing structured topic evolution via **streamgraphs** and **inter-topic flow maps**  
- **Six-degree-impact glyphs** highlighting interdisciplinary breakthroughs  
- Evaluations through case studies (Turing Award laureates, visualization venues) and user studies  

## Dataset  
Processed from the open-source **Academic Graph**:  
- **v1** (up to Sept. 2022): process Microsoft Academic Graph (MAG) to construct GF Graph  (from [KDD’23 paper](https://dl.acm.org/doi/abs/10.1145/3580305.3599845), [github repo](https://github.com/sunieee/MAGProcessing))
- **v2** (up to Oct. 2024): MAG fused with [OpenAlex](https://openalex.org)

🔗 **Download v2 dataset**: [Hugging Face](https://huggingface.co/datasets/yesun/GeneticPrism)​. Due to the dataset's size, it is divided into two compressed archives.
- The ​`csv.tar.gz`​ contains CSV files covering all research fields ​except Artificial Intelligence (AI)​. After extraction, place these CSV files directly in your ​project root directory. 
- The ​`AI.tar.gz`​ contains ​only AI-related data​ – extract its CSV files into the project's ​`csv/`.

The system remains fully functional if only one archive (either AI or Non-AI) is installed, enabling flexible data management based on research needs.

## Deployment  

### Step 1: Data Preparation  
Place the extracted CSV files in the project root directory.

### Step 2: Install Dependencies  
```bash
pip install -r requirements.txt
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

- Access the system at: `http://<your-ip>:9001`  
- Use `ctrl + c` to terminate direct runs  
- Monitor background processes via `tail -f nohup.out`
