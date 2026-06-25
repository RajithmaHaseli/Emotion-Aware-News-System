import pandas as pd
import mysql.connector


conn = mysql.connector.connect(
    host     = "localhost",
    user     = "root",
    password = "root",  
    database = "news_emotions"
)
cursor = conn.cursor()

# CSV load 
df = pd.read_csv("nlp/news_emotion_data.csv")
print(f"Inserting {len(df)} articles...")

for _, row in df.iterrows():
    cursor.execute("""
        INSERT INTO articles
        (title, description, url, source_name,
         published_at, emotion_label, emotion_score, mood)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
    """, (
        str(row["title"]),
        str(row["description"]),
        str(row["url"]),
        str(row["source_name"]),
        str(row["published_at"]),
        str(row["emotion_label"]),
        float(row["emotion_score"]),
        str(row["mood"])
    ))

conn.commit()
conn.close()
print("✅ Done! Articles saved to MySQL.")