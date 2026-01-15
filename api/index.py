from flask import Flask, request, jsonify, render_template_string, session, redirect, url_for
import requests
import random
import os

app = Flask(__name__)
app.secret_key = "BRONX_ULTRA_SECRET_KEY_999"  # Session ke liye zaroori hai

# ----------------- 🔐 ADMIN CREDENTIALS 🔐 ----------------- #
# Yahan apna ID Password set karo
ADMIN_USERNAME = "Bronx"
ADMIN_PASSWORD = "Ultra123"

# ----------------- 🔑 API KEYS LIST (18 NEW KEYS) ----------------- #
API_KEYS = [
    "6Vn2VxxQYfgZuucGznsa8kPu38IfA082hxTeLMMj5jMoGgyvI0gUDaijJaAr",
    "N3pzbyzTo3wubdskihuSIGOQFaDAYd88u4vuMI1TX9heatLtxLOCK6dvkLNT",
    "rdzx20EHrdJyMOhVVz1bVaNnkFmVJWBUY0XXfKndK6g7Y1DjuXnP985Es7a0",
    "2B9ql7Ndg8HX8BBkYHRJgOH1mzUFFcW88eppcPrP4KCT5QN8D1aGQriLYZZG",
    "mt0hyIsAE3IFq1DllLdkG24REYPTyw8Mvn1G5oYxw5T3o1MaZEm1Kw2jjdCe",
    "pcReZ7EA0XRkUkFQDsoxkET4VEE2TaOlr2pD6M1rRYoq2M0RW4uIZeXMJKIZ",
    "wmaCZtT8xUinVsU67UGuyBwp02FeolCT9GqjtVZpzRmF2fp72iIRHqCE9YWC",
    "nEliaGbYoqBkR5lbDvpJCBz832VbxggSFE4j12OyYuLh4CoIDEGrgNMTc0Rl",
    "cG82UWfYg1pic6sj1Tr5Ep5Yj3X35tFLOva4VtWZUQQQHDwqN3mWZHgCvLCE",
    "Uv1v8NPRz73Tfi0c1Uod81cahBFJcawJsShzlrbv9OvvyJYSO5iGuTjfB5pk",
    "XFQEVnwACYJZG1t4MNz6TzjzjFrcuD3eQb8XGzI4Lu8cRt6Wr0qsgzFYMYBI",
    "4nt5eWEgAeX9oVjeIn3OC1CuWEysf40oT6f6u8RKXvh3UbClA54JeNVMnpCa",
    "WHbrzVf6C5gDAFEIoXUUemHyiTDYy3svq9BH9Y2BkmVoxs6P3vyzKKFrlJ60",
    "Pf7TS3RT5sXnQ1UIy7NWEfOPnkjNFGpTfUrLWSLmCcvMga9RjZSM3LiSnpNU",
    "Beob7L54xbyEw1CiA0vnMweUWF9wWmKhCxfOriQ1qykF50EocjieJhXADb3F",
    "geM0MSzDyOOrwBy5KmolDCRjcxTYwfTdowhsIBixeh5ysP1gvOafjNxiy6hY",
    "ba6A7oFkew6HloegEByuVytrJRghD0DWAu9ATOakEsq3ESILMywYQdLcrUjg",
    "QRpXdo9ipOX12Rwr63Td3DCGohfvmcYzWrjfcz9sdyk5sS7smHWX03TlPBS7"
]

SERVICES = {
    "views": 192,
    "reactions": 193
}

SMM_URL = "https://freefollower.net/api/v2"

# ----------------- 💀 LOGIN PAGE UI (HACKER STYLE) ----------------- #
LOGIN_HTML = """
<!DOCTYPE html>
<html>
<head>
    <title>SECURE LOGIN - BRONX</title>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <style>
        body { background: #000; color: #ff0000; font-family: 'Courier New', monospace; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; }
        .login-box { border: 2px solid #ff0000; padding: 30px; width: 300px; text-align: center; box-shadow: 0 0 20px #ff0000; background: #0a0a0a; }
        h2 { text-transform: uppercase; letter-spacing: 2px; text-shadow: 0 0 5px red; }
        input { width: 90%; padding: 10px; margin: 10px 0; background: #111; border: 1px solid #555; color: #fff; font-family: 'Courier New'; }
        button { width: 100%; padding: 10px; background: #ff0000; color: #000; border: none; font-weight: bold; cursor: pointer; margin-top: 10px; }
        button:hover { background: #fff; }
        .error { color: yellow; font-size: 12px; margin-top: 10px; }
    </style>
</head>
<body>
    <div class="login-box">
        <h2>⚠️ RESTRICTED AREA ⚠️</h2>
        <form method="post" action="/login">
            <input type="text" name="username" placeholder="USERNAME" required autocomplete="off">
            <input type="password" name="password" placeholder="PASSWORD" required>
            <button type="submit">AUTHENTICATE</button>
        </form>
        {% if error %}
        <p class="error">❌ ACCESS DENIED: Invalid Credentials</p>
        {% endif %}
    </div>
</body>
</html>
"""

# ----------------- 🚀 DASHBOARD UI (PRO VIBES) ----------------- #
DASHBOARD_HTML = """
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>BRONX COMMAND CENTER</title>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700&display=swap');
        body {
            background-color: #020202;
            color: #00ffea;
            font-family: 'Orbitron', sans-serif;
            display: flex;
            justify_content: center;
            align-items: center;
            min-height: 100vh;
            margin: 0;
            background-image: radial-gradient(circle, #0a0a0a 10%, #000000 90%);
        }
        .container {
            background: rgba(10, 10, 10, 0.95);
            border: 1px solid #00ffea;
            padding: 40px;
            border-radius: 10px;
            box-shadow: 0 0 40px rgba(0, 255, 234, 0.2);
            width: 380px;
            text-align: center;
        }
        h1 { margin-bottom: 5px; text-shadow: 0 0 10px #00ffea; }
        .status { font-size: 10px; color: #0f0; margin-bottom: 20px; }
        
        label { display: block; text-align: left; font-size: 12px; color: #888; margin-top: 15px; }
        input, select {
            width: 100%; padding: 12px; background: #0f0f0f; border: 1px solid #333;
            color: #fff; border-radius: 4px; font-family: 'Orbitron', sans-serif;
            outline: none; margin-top: 5px; box-sizing: border-box;
        }
        input:focus, select:focus { border-color: #00ffea; }

        button {
            width: 100%; padding: 15px; background: linear-gradient(45deg, #00ffea, #00aaaa);
            color: #000; border: none; border-radius: 4px; font-size: 16px; font-weight: bold;
            cursor: pointer; margin-top: 20px; text-transform: uppercase; letter-spacing: 1px;
        }
        button:hover { filter: brightness(1.2); box-shadow: 0 0 15px #00ffea; }
        
        .logout { background: transparent; border: 1px solid #ff3333; color: #ff3333; margin-top: 10px; padding: 10px; font-size: 12px; }
        .logout:hover { background: #ff3333; color: #000; box-shadow: 0 0 10px #ff3333; }

        #result { margin-top: 20px; padding: 10px; border-radius: 5px; font-size: 13px; display: none; }
        .success { border: 1px solid #0f0; color: #0f0; background: rgba(0,255,0,0.1); }
        .error { border: 1px solid #f00; color: #f00; background: rgba(255,0,0,0.1); }
    </style>
</head>
<body>
    <div class="container">
        <h1>⚡ BRONX ULTRA ⚡</h1>
        <div class="status">SYSTEM ONLINE | ADMIN LOGGED IN</div>
        
        <form id="boostForm">
            <label>TARGET SERVICE</label>
            <select id="service_type">
                <option value="views">👁️ TELEGRAM VIEWS</option>
                <option value="reactions">❤️ TELEGRAM REACTIONS</option>
            </select>

            <label>POST LINK</label>
            <input type="text" id="link" placeholder="https://t.me/xxx/123" required autocomplete="off">

            <label>QUANTITY (10 - 10000)</label>
            <input type="number" id="quantity" placeholder="100" required>

            <button type="submit">🚀 INITIATE BOOST</button>
        </form>

        <div id="result"></div>
        
        <form action="/logout" method="get">
             <button class="logout">❌ LOGOUT SESSION</button>
        </form>
    </div>

    <script>
        document.getElementById("boostForm").addEventListener("submit", async function(e) {
            e.preventDefault();
            const btn = document.querySelector("button[type='submit']");
            const resDiv = document.getElementById("result");
            
            btn.innerHTML = "⏳ CONNECTING SERVER...";
            btn.disabled = true;
            resDiv.style.display = "none";

            const data = {
                service_type: document.getElementById("service_type").value,
                link: document.getElementById("link").value,
                quantity: document.getElementById("quantity").value
            };

            try {
                const response = await fetch("/api/process", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(data)
                });
                const result = await response.json();
                resDiv.style.display = "block";
                
                if(result.order) {
                    resDiv.className = "success";
                    resDiv.innerHTML = "✅ SUCCESS! Order ID: " + result.order;
                } else {
                    resDiv.className = "error";
                    resDiv.innerHTML = "❌ ERROR: " + (result.error || JSON.stringify(result));
                }
            } catch (error) {
                resDiv.className = "error";
                resDiv.innerHTML = "❌ NETWORK FAIL!";
            }
            btn.innerHTML = "🚀 INITIATE BOOST";
            btn.disabled = false;
        });
    </script>
</body>
</html>
"""

# ----------------- ⚙️ ROUTES & LOGIC ----------------- #

@app.route('/', methods=['GET'])
def home():
    # Agar user login nahi hai, to Login page dikhao
    if not session.get('logged_in'):
        return render_template_string(LOGIN_HTML, error=False)
    # Agar login hai, to Dashboard dikhao
    return render_template_string(DASHBOARD_HTML)

@app.route('/login', methods=['POST'])
def login():
    username = request.form.get('username')
    password = request.form.get('password')
    
    # Check Credentials
    if username == ADMIN_USERNAME and password == ADMIN_PASSWORD:
        session['logged_in'] = True
        return redirect('/')
    else:
        return render_template_string(LOGIN_HTML, error=True)

@app.route('/logout')
def logout():
    session.clear()
    return redirect('/')

@app.route('/api/process', methods=['POST'])
def process_order():
    # API bhi secure hai, bina login ke kaam nahi karegi
    if not session.get('logged_in'):
        return jsonify({"error": "Unauthorized Access! Please Login."}), 403

    data = request.json
    link = data.get('link')
    quantity = data.get('quantity')
    service_type = data.get('service_type')

    if not link or "t.me" not in link: return jsonify({"error": "Invalid Link"})
    if not quantity or int(quantity) < 10: return jsonify({"error": "Min Quantity 10"})

    # Random API Key Picker (From 18 Keys)
    selected_key = random.choice(API_KEYS)
    service_id = SERVICES.get(service_type, 192)

    payload = {
        'key': selected_key,
        'action': 'add',
        'service': service_id,
        'link': link,
        'quantity': quantity
    }

    try:
        response = requests.post(SMM_URL, data=payload)
        return jsonify(response.json())
    except Exception as e:
        return jsonify({"error": str(e)})

# Local Run
if __name__ == '__main__':
    app.run(debug=True)
