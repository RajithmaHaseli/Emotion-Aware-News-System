import numpy as np
from transformers import pipeline
from sklearn.metrics import classification_report, accuracy_score

print("[INFO] Loading DistilRoBERTa Emotion Transformer Model...")
classifier = pipeline(
    task="text-classification",
    model="j-hartmann/emotion-english-distilroberta-base",
    top_k=None
)

# Test Dataset: Representative Sample of Real-World News Headlines
test_news = [
    # Joy / Positive News
    ("Sri Lanka experiences unprecedented economic recovery and tourist boom", "joy"),
    ("Local community plants 50,000 trees to restore national forest cover", "joy"),
    ("Young innovator wins prestigious global robotics championship", "joy"),
    ("Tech sector salaries see significant growth as new investments arrive", "joy"),

    # Fear / Anxiety News
    ("Severe flash flood warnings issued for low-lying western regions", "fear"),
    ("Global financial markets tumble amid rising geopolitical instability", "fear"),
    ("Health experts warn of emerging respiratory virus spread", "fear"),
    ("Cybersecurity alert: Large-scale phishing attack targets banking credentials", "fear"),

    # Anger / Outrage News
    ("Public protests erupt over sudden surge in municipal electricity tariffs", "anger"),
    ("Citizens demand immediate investigation into municipal corruption scandal", "anger"),
    ("Commuters express outrage following unannounced train schedule cancellations", "anger"),
    ("Consumer rights watchdog sues supermarket chain over price-fixing scheme", "anger"),

    # Sadness / Tragedy News
    ("Tragic road accident claims lives of three passengers on southern expressway", "sadness"),
    ("Historic botanical garden severely damaged after overnight storm", "sadness"),
    ("Endangered wildlife population hits record low due to habitat loss", "sadness"),
    ("Local library closure leaves community students without study facilities", "sadness"),

    # Neutral / Informational News
    ("Central Bank announces scheduled monetary policy meeting for next Tuesday", "neutral"),
    ("Department of Meteorology releases standard monthly rainfall summary", "neutral"),
    ("New traffic light system installed at major city junction", "neutral"),
    ("Government gazette publishes updated administrative boundary guidelines", "neutral"),

    # Surprise News
    ("Astronomers discover rare comet visible to the naked eye", "surprise"),
    ("Archaeologists unearth ancient subterranean complex beneath city center", "surprise"),
    ("Underdog team pulls off stunning last-minute victory in final tournament", "surprise")
]

texts = [item[0] for item in test_news]
ground_truth = [item[1] for item in test_news]

print(f"[INFO] Evaluating {len(texts)} test headlines across emotional dimensions...")

predictions = []
for headline in texts:
    scores = classifier(headline)[0]
    sorted_scores = sorted(scores, key=lambda x: x['score'], reverse=True)
    top_emotion = sorted_scores[0]['label']
    predictions.append(top_emotion)

# Performance Evaluation
acc = accuracy_score(ground_truth, predictions)

print("\n" + "="*50)
print("--- DISTILROBERTA NLP EMOTION CLASSIFICATION REPORT ---")
print("="*50)
print(f"Overall Accuracy: {acc * 100:.2f}%\n")
print(classification_report(ground_truth, predictions, zero_division=0))