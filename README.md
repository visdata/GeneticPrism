# GeneticPrism: Scholarly Research Evolution Visualization

![logo-search](https://github.com/user-attachments/assets/1793b109-d9bb-44c9-b72d-58958219b3ef)

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

🔗 **Download v2 dataset**: [Hugging Face](https://huggingface.co/datasets/yesun/GeneticPrism)​. Due to the dataset's size, it is divided into two compressed archives.
- The ​csv archive​ contains CSV files covering all research fields ​except Artificial Intelligence (AI)​. After extraction, place these CSV files directly in your ​project root directory. 
- The ​AI archive​ contains ​only AI-related data​ – extract its CSV files into the project's ​`csv/`.

The system remains fully functional if only one archive (either AI or Non-AI) is installed, enabling flexible data management based on research needs.

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

- Access the system at: `http://<your-ip>:9001`  
- Use `ctrl + c` to terminate direct runs  
- Monitor background processes via `tail -f nohup.out`

## User Manual

![SystemV14](https://github.com/user-attachments/assets/aff17e4c-bca4-474d-aea6-2ee5c14c26aa)

The GeneticFlow 2.0 system is an innovative academic visualization tool tailored for analyzing scholars' academic influence and their developmental trajectories. By integrating topic modeling with GF graph analysis,the system transforms intricate citation networks and academic dynamics into intuitive visual representations, enabling users to delve deeper into and better comprehend scholars' research contributions.  

The interface is organized into several functional sections: the control panel (Figure a), which allows users to customize system-wide display settings; the statisticalinformation panel(Figure b), which provides essential data about the selected scholar; the topic interaction panel (Figure c), which visualizes citation-based influence patterns across different research topics; the paper list panel (Figure e), which showcases the scholar's most influential publications; and the central visualization panel(Figure d).By default, the system launches in the GeneticPrism view, offering a high-level overview of alltopics. When a user selects a specific topic for closer examination, the main panel switches to the GeneticScroll view.This design effectively balances the need for a broad perspective with the ability to focus on granular details, delivering a rich, multi-layered interactive exploration experience.  

### GeneticPrism View  
![GeneticPrismV9](https://github.com/user-attachments/assets/1f056099-b9db-4a76-a65c-4fb289ab6731)


The design of GeneticPrism draws inspiration from the concept of a "prism," aiming to showcase the multi-dimensional characteristics and interconnections of scholars'research topics through a three-dimensional structure.At the heart of the view is a prism-shaped visualization (Figure a). Users can explore scholars'research contributions from various perspectives by rotating the view. The interface is divided into top and side sections, each revealing different layers of information.  

In the top view(Figure b),the system uses a chord diagram to illustrate the interactions between topics.The circular layout of the chord diagram places topics along the circumference,with each arc representing a specific topic. The length of the arc reflects the topic's influence (efflux), indicating how many influence edges it has on other topics.The thickness and color of the chords convey the strength and direction of citations between topics.This design alows users to quickly grasp the influence range of different topics and their dynamic relationships, such as identifying which topics are major influencers and which ones have strong interconnections.  

For instance, in the visualization of researcher Andrew Y. Ng, it's evident that the "DNN" topic exerts significant citation influence on topics like "semantic," "unlabeled," and "speech." At the same time, topics such as "unlabeled" and "language" also show a reciprocalinfluence on "DNN."  

The side view (Figure c) provides a more detailed breakdown of each topic. Each side displays a time-related GF sub-graph for the topic.The vertical axis represents the publication year of the papers, while the hierarchical layout clearly shows the citation patterns and evolutionary trajectories of papers within the topic over time.The varying widths of the sides correspond to the relative weight of each topic in the scholar's overall academic contributions. The prism's transparent design allows multiple topic sub-graphs to be displayed simultaneously, making it easier to conduct comparative analyses.  

To enhance usability, the GeneticPrism view supports a range of interactive features. Users can zoom in, rotate, and manipulate the prism to focus on specific topics of interest.The system also includes a dynamic rotation mode, which automatically rotates the prism around its center, helping users quickly capture an overview of the data. When users identify a topic they want to explore further, they can simply click on the topic label to switch to the GeneticScroll view for a deeper dive.  


### GeneticScroll View  
<img src="https://github.com/user-attachments/assets/3fbef45b-1707-4f74-830b-bb26de841140" style="zoom: 50%;" />

The design of GeneticScroll is inspired by the traditional concept of a scroll,aiming to provide an in-depth analysis of the academic evolution of a single topic in an unfolded, narrative format. Unlike the global perspective of GeneticPrism, GeneticScrollfocuses on presenting detailed insights, helping users understand the internal dynamics of a topic and its relationships with other topics through a more refined and granular design.  

Upon entering the GeneticScroll view, the central area displays the GF sub-graph of the target topic (Figure d), organized hierarchicaly with time as the axis. Each paper node is arranged vertically according to its publication year, reflecting the chronological sequence. Citation relationships are represented by smooth curves, clearly illustrating the flow of influence between papers.  

To emphasize the interdisciplinary nature of research, the system assigns a unique hexagonal icon to each node (Figure e).The concentric layers of the hexagon, from outer to inner, represent: the subject area influencing the current paper, the current topic, and the topic influenced by the paper.The size of the hexagon scales with the number of citations the paper has received.This design allows users to quickly identify high-impact papers and key nodes in interdisciplinary research.  

The flow graphs on the left and right sides (Figure b) provide additional context on topic interactions.Theleft flow graph shows how other topics influence the current topic, while the right flow graphillustrates how the current topic influences external topics.These flow graphs use a layered design, with each layer representing a related topic.The height of each layer corresponds to the strength of citation influence.Horizontal bars at the top and bottom (Figure a)summarize the overall citation dynamics between the current topic and external topics, helping users quickly grasp the broader relationships.For example, by examining the inflow graph of the "DNN"topic, it becomes clear that it was primarily influenced by the "unlabeled" topic from 2004 to 2008, while the "language" topic became a more significant source of citations from 20o9 to 2014.  

To highlight the details of citation influence, the flow graphs and the central GF sub-graph are connected by a blue citation influence flow(Figure c).Eachline in this flow represents a cross-topic citation relationship, with its width indicating the strength of the citation.To avoid visual clutter, this information is aggregated at an annual level rather than displaying every individual citation. This approach alows users to trace the origins and destinations of citations clearly, enabling a deeper understanding of the interaction patterns between topics.  

The GeneticScroll view also supports a variety of interactive features. Users can zoom and drag to focus on specific areas of interest, and clicking on a node reveals detailed information about the paper, such as its title, abstract, and citation context.The complementary designs of the flow graphs and the citation influence flow provide multiple perspectives, helping users navigate the complexity of academic citation networks with ease.  
