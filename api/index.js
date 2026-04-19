const axios = require('axios');

// ========== CONFIG ==========
const REAL_API_BASE = 'https://ft-osint.onrender.com/api';
const REAL_API_KEY = 'nobita';

// ========== DAILY LIMITS STORAGE (India Time 2:00 AM Reset) ==========
let requestCounts = {};

function getIndiaDate() {
    const now = new Date();
    const istOffset = 5.5 * 60 * 60 * 1000;
    const istDate = new Date(now.getTime() + istOffset);
    return istDate.toISOString().split('T')[0];
}

function checkAndResetLimit(apiKey) {
    const today = getIndiaDate();
    if (!requestCounts[apiKey]) {
        requestCounts[apiKey] = { count: 0, date: today };
        return true;
    }
    if (requestCounts[apiKey].date !== today) {
        requestCounts[apiKey] = { count: 0, date: today };
        return true;
    }
    return requestCounts[apiKey].count < 1000;
}

function incrementRequestCount(apiKey) {
    const today = getIndiaDate();
    if (!requestCounts[apiKey] || requestCounts[apiKey].date !== today) {
        requestCounts[apiKey] = { count: 1, date: today };
    } else {
        requestCounts[apiKey].count++;
    }
    return requestCounts[apiKey].count;
}

function getRemainingQuota(apiKey) {
    const today = getIndiaDate();
    if (!requestCounts[apiKey] || requestCounts[apiKey].date !== today) {
        return 1000;
    }
    return 1000 - requestCounts[apiKey].count;
}

// ========== API KEYS WITH SCOPES (Per-Endpoint Access Control) ==========
const VALID_KEYS = {
    'BRONX_MASTER_KEY': { scopes: ['*'], name: 'BRONX_ULTRA', type: 'master' },
    'NUMBER_ONLY_KEY': { scopes: ['number', 'numv2', 'adv', 'pk', 'pkv2'], name: 'Number Hunter', type: 'restricted' },
    'AADHAR_KEY_2026': { scopes: ['aadhar'], name: 'Aadhar User', type: 'restricted' },
    'SOCIAL_MASTER': { scopes: ['insta', 'git', 'tg'], name: 'Social Seeker', type: 'restricted' },
    'VEHICLE_TRACKER': { scopes: ['vehicle', 'rc'], name: 'Vehicle Tracker', type: 'restricted' },
    'GAMING_KEY_2026': { scopes: ['ff', 'bgmi'], name: 'Gamer', type: 'restricted' },
    'FINANCE_KEY': { scopes: ['upi', 'ifsc', 'pan'], name: 'Finance User', type: 'restricted' },
    'LOCATION_KEY': { scopes: ['pincode', 'ip'], name: 'Location User', type: 'restricted' },
    'NAME_SEARCH_KEY': { scopes: ['name'], name: 'Name Search', type: 'restricted' },
    'DEMO_KEY': { scopes: ['number', 'aadhar', 'pincode'], name: 'Demo User', type: 'demo' },
    'test123': { scopes: ['number'], name: 'Test User', type: 'test' }
};

// ========== ALL ENDPOINTS WITH METADATA ==========
const endpoints = {
    number: { param: 'num', category: 'Phone Intelligence', example: '9876543210', desc: 'Indian Mobile Number Lookup with address, relatives, Aadhaar' },
    aadhar: { param: 'num', category: 'Phone Intelligence', example: '393933081942', desc: 'Aadhaar Number Lookup - linked records' },
    name: { param: 'name', category: 'Phone Intelligence', example: 'abhiraaj', desc: 'Name to Aadhaar/Linked Records Search' },
    numv2: { param: 'num', category: 'Phone Intelligence', example: '6205949840', desc: 'Number Info v2 - alternate database' },
    adv: { param: 'num', category: 'Phone Intelligence', example: '9876543210', desc: 'Advanced Phone Lookup - Aadhaar linked records' },
    upi: { param: 'upi', category: 'Financial', example: 'example@ybl', desc: 'UPI ID verification - name, bank, status' },
    ifsc: { param: 'ifsc', category: 'Financial', example: 'SBIN0001234', desc: 'IFSC Code - bank name, branch, payment modes' },
    pan: { param: 'pan', category: 'Financial', example: 'AXDPR2606K', desc: 'PAN to GSTIN - linked GST registration' },
    pincode: { param: 'pin', category: 'Location', example: '110001', desc: 'Pincode - area, district, post offices' },
    ip: { param: 'ip', category: 'Location', example: '8.8.8.8', desc: 'IP Geolocation - coordinates, ISP, timezone' },
    vehicle: { param: 'vehicle', category: 'Vehicle & Identity', example: 'MH02FZ0555', desc: 'Vehicle Registration - owner, insurance, RC status' },
    rc: { param: 'owner', category: 'Vehicle & Identity', example: 'UP92P2111', desc: 'RC to Owner - detailed ownership & vehicle info' },
    ff: { param: 'uid', category: 'Gaming', example: '123456789', desc: 'Free Fire - player info + ban status' },
    bgmi: { param: 'uid', category: 'Gaming', example: '5121439477', desc: 'BGMI - username by player UID' },
    insta: { param: 'username', category: 'Social', example: 'cristiano', desc: 'Instagram - profile + linked OSINT records' },
    git: { param: 'username', category: 'Social', example: 'ftgamer2', desc: 'GitHub Profile - repos, followers, bio' },
    tg: { param: 'info', category: 'Social', example: 'JAUUOWNER', desc: 'Telegram User - profile, phone, linked records' },
    pk: { param: 'num', category: 'Pakistan', example: '03331234567', desc: 'Pakistan Number - subscriber records with CNIC' },
    pkv2: { param: 'num', category: 'Pakistan', example: '3359736848', desc: 'Pakistan Number v2 - alternate database' }
};

// ========== CLEAN RESPONSE (Remove by/channel/developer, add @BRONX_ULTRA) ==========
function cleanResponse(data, endpointName) {
    if (!data) return data;
    let cleaned = JSON.parse(JSON.stringify(data));

    function removeFields(obj) {
        if (!obj || typeof obj !== 'object') return;
        if (Array.isArray(obj)) {
            obj.forEach(item => removeFields(item));
            return;
        }
        delete obj.by;
        delete obj.channel;
        delete obj.BY;
        delete obj.CHANNEL;
        delete obj.developer;
        delete obj.Developer;
        Object.keys(obj).forEach(key => {
            if (obj[key] && typeof obj[key] === 'object') {
                removeFields(obj[key]);
            }
        });
    }

    removeFields(cleaned);
    cleaned.by = "@BRONX_ULTRA";
    return cleaned;
}

// ========== CHECK KEY SCOPE ==========
function checkKeyScope(key, endpoint) {
    const keyData = VALID_KEYS[key];
    if (!keyData) return { valid: false, reason: '❌ Invalid API Key' };
    if (keyData.scopes.includes('*')) return { valid: true, keyData };
    if (keyData.scopes.includes(endpoint)) return { valid: true, keyData };
    return { valid: false, reason: `❌ This key cannot access '${endpoint}'. Allowed: ${keyData.scopes.join(', ')}` };
}

// ========== HTML UI (NEON BLACK & GREEN) ==========
function serveHTML(res) {
    const endpointCategories = {};
    Object.keys(endpoints).forEach(name => {
        const ep = endpoints[name];
        if (!endpointCategories[ep.category]) endpointCategories[ep.category] = [];
        endpointCategories[ep.category].push({ name, ...ep });
    });

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=yes">
    <title>BRONX OSINT | Neon Intelligence API</title>
    <link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@400;500;600;700;800;900&family=Share+Tech+Mono&display=swap" rel="stylesheet">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        
        body {
            background: #0a0a0a;
            font-family: 'Orbitron', monospace;
            color: #00ff41;
            min-height: 100vh;
            position: relative;
            overflow-x: hidden;
        }
        
        /* Animated Grid Background */
        body::before {
            content: '';
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background-image: linear-gradient(#00ff4110 1px, transparent 1px), linear-gradient(90deg, #00ff4110 1px, transparent 1px);
            background-size: 50px 50px;
            pointer-events: none;
            z-index: 0;
            animation: gridMove 20s linear infinite;
        }
        
        @keyframes gridMove {
            0% { transform: translate(0, 0); }
            100% { transform: translate(50px, 50px); }
        }
        
        .container { max-width: 1300px; margin: 0 auto; padding: 20px; position: relative; z-index: 1; }
        
        /* Header */
        .header {
            text-align: center;
            padding: 30px 20px;
            background: rgba(0, 0, 0, 0.8);
            border: 1px solid #00ff41;
            border-radius: 20px;
            margin-bottom: 30px;
            backdrop-filter: blur(10px);
            box-shadow: 0 0 30px rgba(0, 255, 65, 0.2);
        }
        
        .header h1 {
            font-size: 42px;
            font-weight: 900;
            letter-spacing: 4px;
            animation: pulse 2s ease-in-out infinite;
        }
        
        @keyframes pulse {
            0%, 100% { text-shadow: 0 0 10px #00ff41, 0 0 20px #00ff41; }
            50% { text-shadow: 0 0 20px #00ff41, 0 0 40px #00ff41, 0 0 60px #00ff41; }
        }
        
        .badge {
            display: inline-block;
            background: #00ff4120;
            color: #00ff41;
            padding: 8px 20px;
            border-radius: 30px;
            font-size: 12px;
            margin-top: 15px;
            border: 1px solid #00ff41;
            letter-spacing: 2px;
        }
        
        /* Stats Cards */
        .stats {
            display: flex;
            justify-content: center;
            gap: 20px;
            margin: 30px 0;
            flex-wrap: wrap;
        }
        
        .stat-item {
            background: rgba(0, 0, 0, 0.85);
            border: 1px solid #00ff41;
            border-radius: 12px;
            padding: 20px 35px;
            text-align: center;
            backdrop-filter: blur(5px);
            transition: all 0.3s;
        }
        
        .stat-item:hover { transform: translateY(-5px); box-shadow: 0 0 20px #00ff41; }
        .stat-value { font-size: 48px; font-weight: 900; color: #00ff41; font-family: 'Share Tech Mono', monospace; }
        .stat-label { font-size: 11px; letter-spacing: 2px; color: #00ff41cc; margin-top: 5px; }
        
        /* Limit Alert */
        .limit-alert {
            background: rgba(0, 0, 0, 0.9);
            border: 1px solid #00ff41;
            border-radius: 12px;
            padding: 15px 25px;
            margin: 20px 0;
            text-align: center;
        }
        
        .limit-text { color: #00ff41; font-size: 14px; letter-spacing: 1px; }
        .reset-time { color: #00ff41; font-weight: bold; font-size: 18px; }
        
        /* Auth Section */
        .auth-section {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 20px;
            margin: 30px 0;
        }
        
        .auth-box {
            background: rgba(0, 0, 0, 0.85);
            border: 1px solid #00ff41;
            border-radius: 12px;
            padding: 20px;
            backdrop-filter: blur(5px);
        }
        
        .auth-box h3 { color: #00ff41; margin-bottom: 15px; font-size: 18px; }
        
        .code-block {
            background: #0a0a0a;
            border: 1px solid #00ff41;
            border-radius: 8px;
            padding: 12px;
            font-family: 'Share Tech Mono', monospace;
            font-size: 11px;
            overflow-x: auto;
            margin: 10px 0;
            color: #00ff41;
        }
        
        /* Categories */
        .category {
            font-size: 24px;
            font-weight: 700;
            margin: 40px 0 20px;
            padding: 10px 15px;
            background: linear-gradient(90deg, #00ff4120, transparent);
            border-left: 4px solid #00ff41;
            letter-spacing: 2px;
        }
        
        .endpoints-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
        }
        
        .endpoint-card {
            background: rgba(0, 0, 0, 0.85);
            border: 1px solid #00ff4130;
            border-radius: 12px;
            padding: 18px;
            transition: all 0.3s;
            cursor: pointer;
        }
        
        .endpoint-card:hover { border-color: #00ff41; transform: translateY(-3px); box-shadow: 0 0 15px #00ff41; }
        
        .method {
            display: inline-block;
            background: #00ff4120;
            color: #00ff41;
            padding: 3px 10px;
            border-radius: 6px;
            font-size: 10px;
            font-weight: bold;
            letter-spacing: 1px;
        }
        
        .endpoint-name {
            font-size: 20px;
            font-weight: 700;
            margin: 12px 0 8px;
            color: #00ff41;
        }
        
        .endpoint-url {
            font-family: 'Share Tech Mono', monospace;
            font-size: 10px;
            color: #00ff4190;
            word-break: break-all;
            background: #0a0a0a;
            padding: 8px;
            border-radius: 6px;
            margin: 10px 0;
        }
        
        .param { font-size: 11px; color: #00ff4190; margin-top: 8px; }
        .example-link {
            display: inline-block;
            margin-top: 12px;
            color: #00ff41;
            text-decoration: none;
            font-size: 11px;
            border-bottom: 1px dashed #00ff41;
        }
        
        .footer {
            text-align: center;
            padding: 40px 0;
            margin-top: 50px;
            border-top: 1px solid #00ff4130;
            color: #00ff4190;
            font-size: 12px;
        }
        
        ::-webkit-scrollbar { width: 8px; height: 8px; }
        ::-webkit-scrollbar-track { background: #0a0a0a; }
        ::-webkit-scrollbar-thumb { background: #00ff41; border-radius: 4px; }
        
        @media (max-width: 768px) {
            .container { padding: 15px; }
            .header h1 { font-size: 28px; letter-spacing: 2px; }
            .stat-value { font-size: 32px; }
            .stat-item { padding: 12px 20px; }
            .category { font-size: 18px; }
            .endpoint-name { font-size: 16px; }
        }
        
        .toast {
            position: fixed;
            bottom: 20px;
            right: 20px;
            background: #00ff41;
            color: #0a0a0a;
            padding: 12px 20px;
            border-radius: 8px;
            font-size: 12px;
            font-weight: bold;
            z-index: 1000;
            animation: slideIn 0.3s ease;
        }
        
        @keyframes slideIn {
            from { transform: translateX(100%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
        }
        
        button { background: none; border: none; cursor: pointer; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>⚡ BRONX OSINT</h1>
            <div class="badge">🔐 PRIVATE INTELLIGENCE API | NEON EDITION</div>
            <div class="stats">
                <div class="stat-item"><div class="stat-value">${Object.keys(endpoints).length}</div><div class="stat-label">ENDPOINTS</div></div>
                <div class="stat-item"><div class="stat-value">JSON</div><div class="stat-label">RESPONSE</div></div>
                <div class="stat-item"><div class="stat-value">KEY</div><div class="stat-label">ACCESS</div></div>
            </div>
        </div>

        <div class="limit-alert">
            <div class="limit-text">⚡ DAILY LIMIT: <span style="font-weight: bold; font-size: 20px;">1000</span> REQUESTS PER KEY</div>
            <div class="limit-text" style="margin-top: 8px;">🔄 RESET TIME: <span class="reset-time">🇮🇳 2:00 AM IST</span> (Daily)</div>
            <div class="limit-text" style="margin-top: 5px; font-size: 11px;">⏰ Counters reset automatically at midnight India time</div>
        </div>

        <div class="auth-section">
            <div class="auth-box">
                <h3>🔐 AUTHENTICATION</h3>
                <p style="color: #00ff4190; margin: 8px 0;">API Key Required — Pass via query param or header</p>
                <div class="code-block">GET /api/key-bronx/number?key=YOUR_KEY&num=9876543210</div>
                <div class="code-block">curl -H "X-API-Key: YOUR_KEY" https://your-domain.vercel.app/api/key-bronx/number?num=9876543210</div>
            </div>
            <div class="auth-box">
                <h3>🗝️ AVAILABLE KEYS</h3>
                ${Object.entries(VALID_KEYS).map(([key, data]) => `
                    <div style="margin-bottom: 10px; border-bottom: 1px solid #00ff4130; padding-bottom: 8px;">
                        <strong style="color: #00ff41;">${key}</strong> <span style="color: #00ff4190; font-size: 11px;">(${data.type})</span>
                        <div style="font-size: 10px; color: #00ff4190;">→ ${data.scopes.includes('*') ? 'ALL ENDPOINTS' : data.scopes.join(', ')}</div>
                    </div>
                `).join('')}
                <p style="font-size: 11px; color: #00ff41; margin-top: 12px;">💡 Contact @BRONX_ULTRA on Telegram to get keys</p>
            </div>
        </div>

        ${Object.entries({
            '📱 Phone Intelligence': 'Phone Intelligence',
            '💰 Financial': 'Financial',
            '📍 Location': 'Location',
            '🚗 Vehicle & Identity': 'Vehicle & Identity',
            '🎮 Gaming': 'Gaming',
            '🌐 Social': 'Social',
            '🇵🇰 Pakistan': 'Pakistan'
        }).filter(([_, cat]) => endpointCategories[cat]).map(([displayCat, cat]) => `
            <div class="category">${displayCat}</div>
            <div class="endpoints-grid">
                ${endpointCategories[cat].map(ep => `
                    <div class="endpoint-card" onclick="copyUrl('${ep.name}', '${ep.param}', '${ep.example}')">
                        <span class="method">GET</span>
                        <div class="endpoint-name">${ep.name.toUpperCase()}</div>
                        <div class="endpoint-url">/api/key-bronx/${ep.name}?key=KEY&${ep.param}=${ep.example}</div>
                        <p class="param">📌 ${ep.desc}</p>
                        <p class="param">🔑 Parameter: <strong>${ep.param}</strong> | Example: ${ep.example}</p>
                        <span class="example-link">📋 CLICK TO COPY URL →</span>
                    </div>
                `).join('')}
            </div>
        `).join('')}

        <div class="footer">
            <p>✨ BRONX OSINT API | POWERED BY @BRONX_ULTRA</p>
            <p style="font-size: 10px; margin-top: 10px;">⚡ Response se 'by', 'channel', 'developer' auto-hide | '@BRONX_ULTRA' added</p>
            <p style="font-size: 10px;">🔄 Daily limit resets at 2:00 AM IST | 1000 requests per key per day</p>
        </div>
    </div>

    <script>
        function copyUrl(endpoint, param, example) {
            const url = window.location.origin + '/api/key-bronx/' + endpoint + '?key=BRONX_MASTER_KEY&' + param + '=' + example;
            navigator.clipboard.writeText(url);
            const toast = document.createElement('div');
            toast.className = 'toast';
            toast.innerHTML = '✅ URL Copied!';
            document.body.appendChild(toast);
            setTimeout(() => toast.remove(), 2000);
        }
    </script>
</body>
</html>`;
    res.setHeader('Content-Type', 'text/html');
    res.status(200).send(html);
}

// ========== MAIN SERVER HANDLER (Vercel Compatible) ==========
module.exports = async (req, res) => {
    // CORS Headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'X-API-Key, Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();

    const urlPath = req.url.split('?')[0];
    const query = req.query;

    // ========== ROOT ROUTE = HTML UI ==========
    if (urlPath === '/' || urlPath === '') {
        return serveHTML(res);
    }

    // ========== TEST ROUTE ==========
    if (urlPath === '/test') {
        return res.json({ status: '✅ BRONX OSINT API Running', credit: '@BRONX_ULTRA', time: new Date().toISOString() });
    }

    // ========== KEYS INFO ROUTE ==========
    if (urlPath === '/keys') {
        const keyList = {};
        for (const [key, data] of Object.entries(VALID_KEYS)) {
            keyList[key] = { owner: data.name, scopes: data.scopes, type: data.type };
        }
        return res.json({ success: true, message: "Available API Keys - Contact @BRONX_ULTRA", keys: keyList });
    }

    // ========== QUOTA CHECK ROUTE ==========
    if (urlPath === '/quota') {
        const apiKey = query.key;
        if (!apiKey) {
            return res.status(400).json({ success: false, error: "Missing key parameter" });
        }
        const remaining = getRemainingQuota(apiKey);
        const used = 1000 - remaining;
        return res.json({
            success: true,
            apiKey: apiKey,
            limit: 1000,
            used: used,
            remaining: remaining,
            resetTime: "2:00 AM IST",
            date: getIndiaDate()
        });
    }

    // ========== EXTRACT ENDPOINT ==========
    let endpointName = urlPath.replace('/api/key-bronx/', '').replace('/api/', '').replace(/^\//, '');

    if (!endpoints[endpointName]) {
        return res.status(404).json({ success: false, error: `Endpoint not found: ${endpointName}`, available: Object.keys(endpoints) });
    }

    // ========== API KEY AUTHENTICATION ==========
    const apiKey = query.key || req.headers['x-api-key'];
    if (!apiKey) {
        return res.status(401).json({ success: false, error: "❌ API Key Required. Use ?key=YOUR_KEY or X-API-Key header" });
    }

    // ========== CHECK DAILY LIMIT ==========
    if (!checkAndResetLimit(apiKey)) {
        const remaining = getRemainingQuota(apiKey);
        return res.status(429).json({
            success: false,
            error: "❌ Daily quota exceeded (1000 requests/day)",
            limit: 1000,
            used: 1000 - remaining,
            remaining: 0,
            resetTime: "2:00 AM IST",
            message: "Quota resets daily at 2:00 AM India time"
        });
    }

    const scopeCheck = checkKeyScope(apiKey, endpointName);
    if (!scopeCheck.valid) {
        return res.status(403).json({ success: false, error: scopeCheck.reason });
    }

    // ========== PARAMETER CHECK ==========
    const ep = endpoints[endpointName];
    const paramValue = query[ep.param];
    if (!paramValue) {
        return res.status(400).json({ success: false, error: `Missing parameter: ${ep.param}`, example: `?key=YOUR_KEY&${ep.param}=${ep.example}` });
    }

    // ========== PROXY REQUEST TO REAL API ==========
    try {
        const realUrl = `${REAL_API_BASE}/${endpointName}?key=${REAL_API_KEY}&${ep.param}=${encodeURIComponent(paramValue)}`;
        console.log(`📡 [${scopeCheck.keyData?.name || apiKey}] ${endpointName} -> ${paramValue} | Remaining: ${getRemainingQuota(apiKey) - 1}`);

        const response = await axios.get(realUrl, { timeout: 30000 });
        
        // Increment request count
        const used = incrementRequestCount(apiKey);
        const remaining = 1000 - used;

        // Add rate limit headers
        res.setHeader('X-RateLimit-Limit', '1000');
        res.setHeader('X-RateLimit-Remaining', remaining);
        res.setHeader('X-RateLimit-Reset', '2:00 AM IST');

        const cleanedData = cleanResponse(response.data, endpointName);
        cleanedData.rate_limit = {
            limit: 1000,
            used: used,
            remaining: remaining,
            reset_time: "2:00 AM IST (Daily)"
        };

        res.json(cleanedData);
    } catch (error) {
        console.error(`❌ ${endpointName} Error:`, error.message);
        if (error.response) {
            return res.status(error.response.status).json(cleanResponse(error.response.data, endpointName));
        }
        res.status(500).json({ success: false, error: error.message });
    }
};
