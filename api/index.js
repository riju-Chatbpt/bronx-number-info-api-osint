const express = require('express');
const axios = require('axios');

const app = express();

// ========== CONFIG ==========
const REAL_API_BASE = 'https://ft-osint-api.onrender.com/api';
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

// ========== API KEYS WITH SCOPES ==========
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

// ========== ENDPOINTS ==========
const endpoints = {
    number: { param: 'num', category: 'Phone Intelligence', example: '9876543210', desc: 'Indian Mobile Number Lookup' },
    aadhar: { param: 'num', category: 'Phone Intelligence', example: '393933081942', desc: 'Aadhaar Number Lookup' },
    name: { param: 'name', category: 'Phone Intelligence', example: 'abhiraaj', desc: 'Name to Records Search' },
    numv2: { param: 'num', category: 'Phone Intelligence', example: '6205949840', desc: 'Number Info v2' },
    adv: { param: 'num', category: 'Phone Intelligence', example: '9876543210', desc: 'Advanced Phone Lookup' },
    upi: { param: 'upi', category: 'Financial', example: 'example@ybl', desc: 'UPI ID Verification' },
    ifsc: { param: 'ifsc', category: 'Financial', example: 'SBIN0001234', desc: 'IFSC Code Details' },
    pan: { param: 'pan', category: 'Financial', example: 'AXDPR2606K', desc: 'PAN to GST Search' },
    pincode: { param: 'pin', category: 'Location', example: '110001', desc: 'Pincode Details' },
    ip: { param: 'ip', category: 'Location', example: '8.8.8.8', desc: 'IP Lookup' },
    vehicle: { param: 'vehicle', category: 'Vehicle', example: 'MH02FZ0555', desc: 'Vehicle Registration' },
    rc: { param: 'owner', category: 'Vehicle', example: 'UP92P2111', desc: 'RC Owner Details' },
    ff: { param: 'uid', category: 'Gaming', example: '123456789', desc: 'Free Fire Info' },
    bgmi: { param: 'uid', category: 'Gaming', example: '5121439477', desc: 'BGMI Info' },
    insta: { param: 'username', category: 'Social', example: 'cristiano', desc: 'Instagram Profile' },
    git: { param: 'username', category: 'Social', example: 'ftgamer2', desc: 'GitHub Profile' },
    tg: { param: 'info', category: 'Social', example: 'JAUUOWNER', desc: 'Telegram Lookup' },
    pk: { param: 'num', category: 'Pakistan', example: '03331234567', desc: 'Pakistan Number v1' },
    pkv2: { param: 'num', category: 'Pakistan', example: '3359736848', desc: 'Pakistan Number v2' }
};

// ========== CLEAN RESPONSE ==========
function cleanResponse(data) {
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
    if (!keyData) return { valid: false, error: '❌ Invalid API Key' };
    if (keyData.scopes.includes('*')) return { valid: true };
    if (keyData.scopes.includes(endpoint)) return { valid: true };
    return { valid: false, error: `❌ This key cannot access '${endpoint}'. Allowed: ${keyData.scopes.join(', ')}` };
}

// ========== SERVE HTML UI ==========
function serveHTML(res) {
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>BRONX OSINT | Neon API</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            background: #0a0a0a;
            font-family: 'Courier New', monospace;
            color: #00ff41;
            min-height: 100vh;
        }
        .container { max-width: 1200px; margin: 0 auto; padding: 20px; }
        
        /* Header */
        .header {
            text-align: center;
            padding: 30px;
            border: 2px solid #00ff41;
            border-radius: 20px;
            margin-bottom: 30px;
            background: #0a0a0a;
            box-shadow: 0 0 30px #00ff4133;
        }
        .header h1 {
            font-size: 48px;
            text-shadow: 0 0 10px #00ff41;
            letter-spacing: 3px;
        }
        .badge {
            display: inline-block;
            background: #00ff4120;
            padding: 8px 20px;
            border-radius: 30px;
            font-size: 12px;
            margin-top: 15px;
            border: 1px solid #00ff41;
        }
        
        /* Stats */
        .stats {
            display: flex;
            justify-content: center;
            gap: 30px;
            margin: 30px 0;
            flex-wrap: wrap;
        }
        .stat-card {
            background: #0a0a0a;
            border: 1px solid #00ff41;
            border-radius: 12px;
            padding: 15px 30px;
            text-align: center;
        }
        .stat-num { font-size: 36px; font-weight: bold; }
        .stat-label { font-size: 11px; letter-spacing: 2px; }
        
        /* Limit Alert */
        .limit-alert {
            background: #0a0a0a;
            border: 1px solid #00ff41;
            border-radius: 12px;
            padding: 15px;
            margin: 20px 0;
            text-align: center;
        }
        .reset-time { font-weight: bold; font-size: 18px; }
        
        /* Auth */
        .auth-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 20px;
            margin: 30px 0;
        }
        .auth-card {
            background: #0a0a0a;
            border: 1px solid #00ff41;
            border-radius: 12px;
            padding: 20px;
        }
        .code {
            background: #0a0a0a;
            border: 1px solid #00ff41;
            border-radius: 8px;
            padding: 10px;
            font-family: monospace;
            font-size: 11px;
            overflow-x: auto;
            margin: 10px 0;
        }
        
        /* Endpoints */
        .category {
            font-size: 22px;
            font-weight: bold;
            margin: 30px 0 15px;
            padding-left: 15px;
            border-left: 4px solid #00ff41;
        }
        .endpoint-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
            gap: 15px;
        }
        .endpoint {
            background: #0a0a0a;
            border: 1px solid #00ff4133;
            border-radius: 10px;
            padding: 15px;
            cursor: pointer;
            transition: all 0.3s;
        }
        .endpoint:hover {
            border-color: #00ff41;
            transform: translateY(-2px);
            box-shadow: 0 0 15px #00ff41;
        }
        .method {
            background: #00ff4120;
            padding: 2px 8px;
            border-radius: 5px;
            font-size: 10px;
        }
        .endpoint-name {
            font-size: 18px;
            font-weight: bold;
            margin: 10px 0;
        }
        .endpoint-url {
            font-family: monospace;
            font-size: 10px;
            color: #00ff4190;
            word-break: break-all;
        }
        .param { font-size: 11px; color: #00ff4190; margin-top: 8px; }
        
        .footer {
            text-align: center;
            padding: 30px;
            margin-top: 40px;
            border-top: 1px solid #00ff4133;
            font-size: 11px;
        }
        
        @media (max-width: 768px) {
            .header h1 { font-size: 28px; }
            .stat-num { font-size: 24px; }
        }
        
        .toast {
            position: fixed;
            bottom: 20px;
            right: 20px;
            background: #00ff41;
            color: #0a0a0a;
            padding: 10px 20px;
            border-radius: 8px;
            font-weight: bold;
            animation: slideIn 0.3s;
        }
        @keyframes slideIn {
            from { transform: translateX(100%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>⚡ BRONX OSINT</h1>
            <div class="badge">🔐 NEON INTELLIGENCE API</div>
            <div class="stats">
                <div class="stat-card"><div class="stat-num">${Object.keys(endpoints).length}</div><div class="stat-label">ENDPOINTS</div></div>
                <div class="stat-card"><div class="stat-num">JSON</div><div class="stat-label">RESPONSE</div></div>
                <div class="stat-card"><div class="stat-num">KEY</div><div class="stat-label">ACCESS</div></div>
            </div>
        </div>
        
        <div class="limit-alert">
            <div>⚡ DAILY LIMIT: <strong>1000</strong> REQUESTS PER KEY</div>
            <div style="margin-top: 5px;">🔄 RESET: <span class="reset-time">🇮🇳 2:00 AM IST</span> (Daily)</div>
        </div>
        
        <div class="auth-grid">
            <div class="auth-card">
                <h3>🔐 AUTHENTICATION</h3>
                <div class="code">GET /api/key-bronx/number?key=YOUR_KEY&num=9876543210</div>
            </div>
            <div class="auth-card">
                <h3>🗝️ MASTER KEY</h3>
                <div class="code">BRONX_MASTER_KEY</div>
                <div style="margin-top: 10px;">💡 Contact @BRONX_ULTRA on Telegram</div>
            </div>
        </div>
        
        ${Object.entries({
            '📱 Phone': 'Phone Intelligence',
            '💰 Financial': 'Financial',
            '📍 Location': 'Location',
            '🚗 Vehicle': 'Vehicle',
            '🎮 Gaming': 'Gaming',
            '🌐 Social': 'Social',
            '🇵🇰 Pakistan': 'Pakistan'
        }).filter(([_, cat]) => Object.values(endpoints).some(e => e.category === cat)).map(([display, cat]) => `
            <div class="category">${display}</div>
            <div class="endpoint-grid">
                ${Object.entries(endpoints).filter(([_, e]) => e.category === cat).map(([name, ep]) => `
                    <div class="endpoint" onclick="copyUrl('${name}', '${ep.param}', '${ep.example}')">
                        <span class="method">GET</span>
                        <div class="endpoint-name">${name.toUpperCase()}</div>
                        <div class="endpoint-url">/api/key-bronx/${name}</div>
                        <div class="param">${ep.desc}</div>
                        <div class="param">🔑 ${ep.param}=${ep.example}</div>
                    </div>
                `).join('')}
            </div>
        `).join('')}
        
        <div class="footer">
            <p>✨ BRONX OSINT API | @BRONX_ULTRA</p>
            <p>⚡ 1000 requests/day | Resets 2:00 AM IST</p>
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
    res.send(html);
}

// ========== EXPRESS ROUTES ==========
app.use(express.json());

app.get('/', (req, res) => serveHTML(res));

app.get('/test', (req, res) => {
    res.json({ status: '✅ BRONX OSINT API Running', credit: '@BRONX_ULTRA', time: new Date().toISOString() });
});

app.get('/keys', (req, res) => {
    const keyList = {};
    for (const [key, data] of Object.entries(VALID_KEYS)) {
        keyList[key] = { owner: data.name, scopes: data.scopes, type: data.type };
    }
    res.json({ success: true, keys: keyList });
});

app.get('/quota', (req, res) => {
    const apiKey = req.query.key;
    if (!apiKey) return res.status(400).json({ error: "Missing key" });
    const remaining = getRemainingQuota(apiKey);
    res.json({ apiKey, limit: 1000, used: 1000 - remaining, remaining, resetTime: "2:00 AM IST" });
});

app.get('/api/key-bronx/:endpoint', async (req, res) => {
    const { endpoint } = req.params;
    const query = req.query;
    const apiKey = query.key || req.headers['x-api-key'];
    
    if (!endpoints[endpoint]) {
        return res.status(404).json({ success: false, error: `Endpoint not found: ${endpoint}` });
    }
    
    if (!apiKey) {
        return res.status(401).json({ success: false, error: "❌ API Key Required" });
    }
    
    // Check daily limit
    if (!checkAndResetLimit(apiKey)) {
        return res.status(429).json({ success: false, error: "❌ Daily quota exceeded (1000/day). Resets at 2:00 AM IST" });
    }
    
    const scopeCheck = checkKeyScope(apiKey, endpoint);
    if (!scopeCheck.valid) {
        return res.status(403).json({ success: false, error: scopeCheck.error });
    }
    
    const ep = endpoints[endpoint];
    const paramValue = query[ep.param];
    
    if (!paramValue) {
        return res.status(400).json({ success: false, error: `Missing parameter: ${ep.param}`, example: `?key=YOUR_KEY&${ep.param}=${ep.example}` });
    }
    
    try {
        const realUrl = `${REAL_API_BASE}/${endpoint}?key=${REAL_API_KEY}&${ep.param}=${encodeURIComponent(paramValue)}`;
        console.log(`📡 ${endpoint} -> ${paramValue}`);
        
        const response = await axios.get(realUrl, { timeout: 30000 });
        const used = incrementRequestCount(apiKey);
        
        const cleanedData = cleanResponse(response.data);
        cleanedData.rate_limit = {
            limit: 1000,
            used: used,
            remaining: 1000 - used,
            reset: "2:00 AM IST"
        };
        
        res.json(cleanedData);
    } catch (error) {
        console.error(error.message);
        if (error.response) {
            return res.status(error.response.status).json(cleanResponse(error.response.data));
        }
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = app;
