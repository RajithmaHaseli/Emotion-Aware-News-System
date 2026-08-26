import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
import seaborn as sns
from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier
from sklearn.tree import DecisionTreeClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report, confusion_matrix, accuracy_score

# 1. Generate Synthetic Behavioral Dataset (MIND Statistics Grounded)
np.random.seed(42)
n_samples_per_class = 500

classes = ['Happy', 'Calm', 'Curious', 'Sad', 'Anxious', 'Angry']

data = []
labels = []

for c in classes:
    if c == 'Happy':
        dwell = np.random.normal(50, 10, n_samples_per_class)
        scroll = np.random.normal(120, 20, n_samples_per_class)
        skip = np.random.normal(0.15, 0.05, n_samples_per_class)
        ctr = np.random.normal(0.40, 0.08, n_samples_per_class)
    elif c == 'Calm':
        dwell = np.random.normal(90, 15, n_samples_per_class)
        scroll = np.random.normal(60, 10, n_samples_per_class)
        skip = np.random.normal(0.10, 0.04, n_samples_per_class)
        ctr = np.random.normal(0.25, 0.05, n_samples_per_class)
    elif c == 'Curious':
        dwell = np.random.normal(70, 12, n_samples_per_class)
        scroll = np.random.normal(140, 25, n_samples_per_class)
        skip = np.random.normal(0.20, 0.06, n_samples_per_class)
        ctr = np.random.normal(0.55, 0.10, n_samples_per_class)
    elif c == 'Sad':
        dwell = np.random.normal(120, 25, n_samples_per_class)
        scroll = np.random.normal(40, 10, n_samples_per_class)
        skip = np.random.normal(0.35, 0.08, n_samples_per_class)
        ctr = np.random.normal(0.12, 0.04, n_samples_per_class)
    elif c == 'Anxious':
        dwell = np.random.normal(25, 8, n_samples_per_class)
        scroll = np.random.normal(220, 35, n_samples_per_class)
        skip = np.random.normal(0.60, 0.10, n_samples_per_class)
        ctr = np.random.normal(0.18, 0.06, n_samples_per_class)
    elif c == 'Angry':
        dwell = np.random.normal(30, 10, n_samples_per_class)
        scroll = np.random.normal(180, 30, n_samples_per_class)
        skip = np.random.normal(0.50, 0.12, n_samples_per_class)
        ctr = np.random.normal(0.30, 0.08, n_samples_per_class)

    # 13 Feature engineering vectors
    for i in range(n_samples_per_class):
        d = max(1.0, dwell[i])
        s = max(1.0, scroll[i])
        sk = np.clip(skip[i], 0.0, 1.0)
        ct = np.clip(ctr[i], 0.0, 1.0)
        
        accel = s / (d + 1)
        dwell_len_ratio = d / 150.0
        interaction_freq = (ct * 10) / (d + 1)
        attention_ratio = max(0.1, 1.0 - sk)
        anxiety_idx = (s * sk) / np.log(d + 2)
        curiosity_idx = ct * 3.5
        norm_dwell = (d - 60) / 30
        norm_scroll = (s - 120) / 50
        history_len = np.random.randint(1, 20)

        feature_vector = [
            d, s, sk, ct, accel, dwell_len_ratio, 
            interaction_freq, attention_ratio, anxiety_idx, 
            curiosity_idx, norm_dwell, norm_scroll, history_len
        ]
        data.append(feature_vector)
        labels.append(c)

X = np.array(data)
y = np.array(labels)

# 2. Train-Test Split (80% Train, 20% Test)
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.20, random_state=42, stratify=y)

# 3. Model Benchmark Comparison
models = {
    "Logistic Regression": LogisticRegression(max_iter=1000),
    "Decision Tree": DecisionTreeClassifier(random_state=42),
    "Random Forest": RandomForestClassifier(n_estimators=100, max_depth=12, random_state=42),
    "Gradient Boosting": GradientBoostingClassifier(random_state=42)
}

print("\n" + "="*50)
print("--- MODEL BENCHMARK COMPARISON ---")
print("="*50)

for name, model in models.items():
    model.fit(X_train, y_train)
    preds = model.predict(X_test)
    acc = accuracy_score(y_test, preds)
    print(f"{name:22} : Accuracy = {acc*100:.2f}%")

# 4. Detailed Evaluation for Random Forest (Selected Model)
rf_model = models["Random Forest"]
y_pred = rf_model.predict(X_test)

print("\n" + "="*50)
print("--- RANDOM FOREST CLASSIFICATION REPORT ---")
print("="*50)
print(classification_report(y_test, y_pred, target_names=classes))

# 5. Generate and Save Confusion Matrix Plot
cm = confusion_matrix(y_test, y_pred, labels=classes)
plt.figure(figsize=(8, 6))
sns.heatmap(cm, annot=True, fmt='d', cmap='Blues', xticklabels=classes, yticklabels=classes)
plt.title('Confusion Matrix - Behavioral Mood Classifier (Random Forest)')
plt.ylabel('Actual Emotional State')
plt.xlabel('Predicted Emotional State')
plt.tight_layout()
plt.savefig('confusion_matrix.png', dpi=300)
print("\n[SUCCESS] Confusion matrix saved as 'confusion_matrix.png'!")