import time
import statistics
import sys
from pathlib import Path
from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from main import app

client = TestClient(app)

endpoints = [
    ("Root Health Check", "GET", "/", None),
    ("News Delivery (Feed)", "GET", "/test-live-news/calm", None),
    ("Default News (Cached)", "GET", "/get-default-news", None),
    ("Track Click", "POST", "/track-click", {"user_id": 1, "article_id": 101, "action": "click"})
]

iterations = 50

print("\n" + "="*65)
print("--- FASTAPI ENDPOINT LATENCY BENCHMARK (50 ITERATIONS) ---")
print("="*65)
print(f"{'Endpoint Description':<25} | {'Mean (ms)':<10} | {'95th % (ms)':<12} | {'Max (ms)':<10}")
print("-" * 65)

for name, method, url, payload in endpoints:
    latencies = []
    for _ in range(iterations):
        t_start = time.perf_counter()
        if method == "GET":
            res = client.get(url)
        elif method == "POST":
            res = client.post(url, json=payload)
        t_end = time.perf_counter()
        latencies.append((t_end - t_start) * 1000.0) # convert to ms

    mean_lat = statistics.mean(latencies)
    p95_lat = statistics.quantiles(latencies, n=100)[94]
    max_lat = max(latencies)

    print(f"{name:<25} | {mean_lat:<10.2f} | {p95_lat:<12.2f} | {max_lat:<10.2f}")

print("="*65 + "\n")