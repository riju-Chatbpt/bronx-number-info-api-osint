from flask import Flask, request, jsonify, render_template_string
import requests
import time
import re
import json

app = Flask(__name__)

# --- CONFIGURATION ---
OWNER_TAG = "@BRONX_ULTRA"
CREDIT = "BRONX_ULTRA"
DEVELOPER = "BRONX_ULTRA"

# Trial API
BACKEND_API = "https://trial-api-ybh8.vercel.app/aadhaar/"

# --- DASHBOARD HTML ---
DASHBOARD_HTML = """
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>BRONX ULTRA AADHAAR API</title>
    <style>
        body { background: #050505; color: #ff0055; font-family: 'Courier New', Courier, monospace; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
        .container { border: 1px solid #ff0055; padding: 30px; border-radius: 10px; box-shadow: 0 0 15px #ff0055; text-align: center; max-width: 600px; }
        h1 { font-size: 24px; margin-bottom: 10px; color: #ff0055; }
        .status { color: #fff; background: #ff0055; padding: 5px 10px; border-radius: 5px; font-weight: bold; }
        .info { color: #ccc; font-size: 14px; margin: 20px 0; }
        .url { background: #111; padding: 10px; border-radius: 5px; color: #ffaa00; word-break: break-all; font-size: 13px; }
        footer { margin-top: 20px; font-size: 12px; color: #555; }
    </style>
</head>
<body>
    <div class="container">
        <h1>🆔 BRONX ULTRA AADHAAR API</h1>
        <span class="status">Status: ONLINE ✅</span>
        <p class="info">India's Fastest Aadhaar Lookup API</p>
        <div class="url">
            📌 <b>How to Use:</b><br>
            https://{{ host }}/api/aadhaar?num=533970021520
        </div>
        <footer>Developed by {{ owner }} | Privacy Protected ✅</footer>
    </div>
</body>
</html>
"""

def extract_json_from_text(text):
    """Extract JSON array from plain text response"""
    try:
        match = re.search(r'● Results:\s*(\[[\s\S]*?\](?=\s*$|\s*========================================))', text)
        if match:
            json_str = match.group(1)
            return json.loads(json_str)
    except:
        pass
    return []

@app.route('/')
def home():
    return render_template_string(DASHBOARD_HTML, host=request.host, owner=OWNER_TAG)

@app.route('/api/aadhaar')
def aadhaar_lookup():
    start_time = time.time()
    aadhaar_num = request.args.get('num', '').strip()
    
    if not aadhaar_num or len(aadhaar_num) != 12:
        return jsonify({
            "status": "error",
            "message": "Invalid Aadhaar Number! Must be 12 digits.",
            "credit": CREDIT
        }), 400

    try:
        backend_url = f"{BACKEND_API}{aadhaar_num}"
        
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept': '*/*'
        }
        
        resp = requests.get(backend_url, headers=headers, timeout=15)
        raw_text = resp.text
        
        results_data = extract_json_from_text(raw_text)
        count_match = re.search(r'● Count:\s*(\d+)', raw_text)
        count = int(count_match.group(1)) if count_match else len(results_data)
        time_match = re.search(r'● Search Time:\s*([\d.]+)ms', raw_text)
        search_time = float(time_match.group(1)) if time_match else round((time.time() - start_time) * 1000, 2)
        
        if results_data:
            formatted_results = []
            for item in results_data:
                formatted_item = {
                    "id": item.get("id", aadhaar_num),
                    "name": item.get("name", ""),
                    "fname": item.get("fname", ""),
                    "mobile": item.get("mobile", ""),
                    "circle": item.get("circle", ""),
                    "address": item.get("address", ""),
                    "email": item.get("email", ""),
                    "alt": item.get("alt", "")
                }
                formatted_results.append(formatted_item)
            
            output = {
                "status": "success",
                "credit": CREDIT,
                "developer": DEVELOPER,
                "search_type": "Aadhaar Number",
                "search_value": aadhaar_num,
                "count": count,
                "search_time_ms": search_time,
                "results": formatted_results
            }
            
            return jsonify(output)
        else:
            return jsonify({
                "status": "error",
                "message": "No data found for this Aadhaar number",
                "credit": CREDIT
            }), 404
        
    except requests.exceptions.Timeout:
        return jsonify({
            "status": "error",
            "message": "Request timeout",
            "credit": CREDIT
        }), 504
    except Exception as e:
        return jsonify({
            "status": "error",
            "message": f"Server error: {str(e)}",
            "credit": CREDIT
        }), 500

if __name__ == "__main__":
    app.run(host='0.0.0.0', port=5000)
