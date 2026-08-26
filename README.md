# Emotion-Aware News Filtering System - EmotionSense

## 📌 Project Overview

The **Emotion-Aware News Filtering System** is a full-stack web application designed to provide a more personalised and emotionally aware news-reading experience. Unlike traditional news platforms that mainly rely on user preferences and past interactions, this system considers behavioural interaction patterns to infer a user's current mood.

Based on the inferred mood, the system analyses the emotional characteristics of news articles, applies mood-based filtering, and dynamically adapts the user interface to create a more suitable and personalised news consumption experience.

This project was developed as a final-year research project in Software Engineering.

---

## 🎯 Research Aim

The aim of this research is to design, implement, and evaluate an emotion-aware web-based news filtering system that infers user mood from behavioural interaction patterns, filters news articles based on their emotional characteristics, and dynamically adapts the user interface.

---

## ✨ Key Features

- User registration and login
- Behavioural interaction tracking
- Mood inference using Machine Learning
- Random Forest-based mood prediction
- Confidence-based rule fallback mechanism
- News emotion classification using DistilRoBERTa
- Mood-based news filtering
- Live news retrieval through NewsAPI
- Database-based news fallback
- Mood-adaptive user interface
- Dynamic colour themes and typography
- Adaptive news presentation
- Personalised wellbeing dashboard
- User interaction tracking, including clicks and skipped articles

---
## 🛠️ Technology Stack

The project is built using a modern full-stack architecture that combines web technologies, machine learning, natural language processing, and database technologies.

### 🎨 Frontend

<p>
  <img src="https://skillicons.dev/icons?i=react,js,html,css,vite" />
</p>

- **React** – User interface development
- **JavaScript** – Frontend application logic
- **HTML5 & CSS3** – Page structure and styling
- **Vite** – Frontend development and build tool

---

### ⚙️ Backend

<p>
  <img src="https://skillicons.dev/icons?i=python,fastapi" />
</p>

- **Python** – Backend and machine learning development
- **FastAPI** – REST API development and system integration

---

### 🧠 Machine Learning & NLP

<p>
  <img src="https://skillicons.dev/icons?i=python" />
</p>

- **Scikit-learn** – Machine learning model development
- **Random Forest** – Behaviour-based mood prediction
- **Joblib** – Model storage and loading
- **Pandas & NumPy** – Data processing and feature engineering
- **Hugging Face Transformers** – NLP model integration
- **DistilRoBERTa** – News article emotion classification
- **j-hartmann/emotion-english-distilroberta-base** – Pretrained emotion classification model

---

### 🗄️ Database

<p>
  <img src="https://skillicons.dev/icons?i=mysql" />
</p>

- **MySQL** – User, behavioural, and news-related data storage

---

### 📰 External Services

- **NewsAPI** – Live news content retrieval
- **Hugging Face** – Pretrained NLP model access

---

### 🧪 Testing & Evaluation

- **Pytest** – Backend and API testing
- **NASA-TLX** – Cognitive workload and usability evaluation
- **Functional Testing**
- **Integration Testing**
- **Performance Testing**

---

### 🔧 Development Tools

<p>
  <img src="https://skillicons.dev/icons?i=vscode,git,github,npm" />
</p>

- **Visual Studio Code**
- **Git**
- **GitHub**
- **npm**

---

### 📋 Technology Summary

| Layer | Technology |
|---|---|
| 🎨 Frontend | React, JavaScript, HTML5, CSS3, Vite |
| ⚙️ Backend | Python, FastAPI |
| 🧠 Machine Learning | Scikit-learn, Random Forest, Joblib |
| 🤖 NLP | Hugging Face Transformers, DistilRoBERTa |
| 📊 Data Processing | Pandas, NumPy |
| 🗄️ Database | MySQL |
| 📰 News Service | NewsAPI |
| 🧪 Testing | Pytest, Functional & Integration Testing |
| 📈 Evaluation | NASA-TLX, Performance Testing |
| 🔧 Tools | VS Code, Git, GitHub, npm |

## 🧠 System Workflow

```text
User Interacts with News
        ↓
Behavioural Data Collection
(CTR, Dwell Time, Skip Rate)
        ↓
Feature Processing
        ↓
Mood Inference Model
(Random Forest)
        ↓
Predicted User Mood
        ↓
News Retrieval
        ↓
Article Emotion Classification
(DistilRoBERTa)
        ↓
Mood-Based News Filtering
        ↓
Mood-Adaptive UI
        ↓
Personalized News Display


