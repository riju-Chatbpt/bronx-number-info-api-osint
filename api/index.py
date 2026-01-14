from flask import Flask, request, jsonify, render_template_string
from faker import Faker
import random
import time
from datetime import datetime

app = Flask(__name__)
fake = Faker('en_IN')  # Indian Context (Names, Address etc)

# ----------------- 🔐 MASTER CONTROL ROOM (BRONX) 🔐 ----------------- #

# Yahan tumhari API Keys hain.
# Format: "KEY_NAME": "EXPIRY_DATE (YYYY-MM-DD)"

API_DATABASE = {
    "bronx_ultra": "2030-01-15", # Ye tumhari MAIN KEY hai (Valid till 2030)
    "bronx_free": "2026-01-15",  # Dosto ke liye key
    "test_user": "2024-01-01"    # Expired key (Testing ke liye)
}

OWNER_NAME = "@BRONX_ULTRA"

# ----------------- 🎨 HACKER UI V3.0 (BRONX EDITION) ----------------- #
HTML_TEMPLATE = """
<!DOCTYPE html>
<html>
<head>
    <title>BRONX SERVER V5.0 💀</title>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <style>
        body { background-color: #050505; color: #00ffea; font-family: 'Courier New', monospace; text-align: center; padding: 20px; }
        h1 { color: #fff; text-shadow: 0 0 15px #00ffea; text-transform: uppercase; }
        .container { border: 2px solid #00ffea; padding: 20px; max-width: 500px; margin: auto; background: #111; box-shadow: 0 0 25px #00ffea; border-radius: 10px; }
        input { background: #222; color: #fff; border: 1px solid #00ffea; padding: 12px; width: 90%; margin-bottom: 15px; border-radius: 5px; }
        button { background: #00ffea; color: #000; border: none; padding: 12px 30px; font-weight: bold; cursor: pointer; font-size: 16px; border-radius: 5px; }
        button:hover { background: #fff; box-shadow: 0 0 20px #fff; }
        .blink { animation: blinker 1s linear infinite; color: #ff3333; font-weight: bold; }
        @keyframes blinker { 50% { opacity: 0; } }
        .footer { margin-top: 30px; color: #888; font-size: 12px; letter-spacing: 1px; }
        .owner { color: #ffff00; font-weight: bold; text-decoration: none; }
    </style>
</head>
<body>
    <h1>💀 BRONX INTEL DATABASE</h1>
    <div class="container">
        <p class="blink">⚠ ACCESS RESTRICTED TO AUTHORIZED USERS ⚠</p>
        <p>Enter Target Information:</p>
        <form action="/api/mobile" method="get">
            <input type="text" name="api_key" value="bronx_ultra" placeholder="Enter API Key 🔑" required>
            <input type="number" name="mobile" placeholder="Target Mobile (98XXXXXXXX) 📱" required>
            <br><br>
            <button type="submit">SEARCH TARGET 🔍</button>
        </form>
    </div>
    <div class="footer">
        SERVER STATUS: ONLINE 🟢 <br><br>
        API OWNER: <a href="https://t.me/BRONX_ULTRA" class="owner">@BRONX_ULTRA</a>
    </div>
</body>
</html>
"""

# ----------------- ⚙️ LOGIC (UNLIMITED GENERATION) ----------------- #

@app.route('/')
def home():
    return render_template_string(HTML_TEMPLATE)

@app.route('/api/mobile', methods=['GET'])
def get_info():
    # 1. Get Parameters
    mobile = request.args.get('mobile')
    api_key = request.args.get('api_key')

    # 2. 🛡️ SECURITY CHECK
    if api_key not in API_DATABASE:
        return jsonify({
            "status": "failed",
            "error_code": "AUTH_FAIL",
            "message": "❌ Invalid API Key! Access Denied by BRONX Server."
        }), 401

    # Check Expiry
    expiry_str = API_DATABASE[api_key]
    expiry_date = datetime.strptime(expiry_str, "%Y-%m-%d")
    current_date = datetime.now()

    if current_date > expiry_date:
        return jsonify({
            "status": "expired",
            "error_code": "PLAN_EXPIRED",
            "message": f"❌ Your API Key has EXPIRED on {expiry_str}.",
            "contact_owner": OWNER_NAME
        }), 402

    # 3. Input Validation
    if not mobile or len(str(mobile)) < 10:
        return jsonify({"status": "error", "message": "❌ Invalid Mobile Number"}), 400

    # 4. 🎭 GENERATING NEW RANDOM DATA (Every Time)
    
    operators = ['Jio 5G True', 'Airtel 5G Plus', 'Vi Unlimited', 'BSNL 4G']
    circles = ['Delhi', 'Mumbai', 'UP East', 'UP West', 'Bihar', 'Kolkata', 'Punjab', 'Rajasthan']
    phones = ['iPhone 15 Pro Max', 'Samsung S24 Ultra', 'OnePlus 12R', 'Vivo X100 Pro', 'Pixel 8 Pro']
    
    # Faker library har baar naya naam generate karegi
    first_name = fake.first_name()
    last_name = fake.last_name()
    
    # Advanced Address Generation
    full_address = fake.address().replace("\n", ", ") + " - " + str(random.randint(110001, 890001))

    data = {
        "status": "success",
        "server": "BRONX_V5_SECURE",
        "request_id": f"BRX-{random.randint(100000,999999)}",
        "time": time.strftime("%d-%m-%Y %I:%M %p"),
        "key_owner": OWNER_NAME,
        "data": {
            "📱 Mobile Number": mobile,
            "👤 Full Name": f"{first_name} {last_name}",
            "👨 Father Name": f"{fake.first_name_male()} {last_name}",
            "🏠 Permanent Address": full_address,
            "📡 Telecom Circle": random.choice(circles),
            "📶 Network Type": random.choice(operators),
            "📱 Handset Model": random.choice(phones),
            "🆔 Aadhar Status": f"LINKED (XXXX-XXXX-{random.randint(1000, 9999)})",
            "🟢 Current Status": "Active"
        }
    }

    return jsonify(data)

# Local testing
if __name__ == '__main__':
    app.run(debug=True)
