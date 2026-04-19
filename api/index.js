const express = require('express');
const axios = require('axios');

const app = express();

// ========== CONFIG ==========
const REAL_API_BASE = 'https://ft-osint-api.onrender.com/api';
const REAL_API_KEY = 'nobita';
const ADMIN_PASSWORD = 'BRONX_ADMIN_2026';

// ========== IN-MEMORY DATABASE ==========
let db = {
    keys: {
        'BRONX_KEY_2026': { scopes: ['*'], name: 'Master Key', createdAt: Date.now(), expiresAt: null, dailyLimit: 1000 },
        'DEMO_KEY': { scopes: ['number', 'aadhar', 'pincode'], name: 'Demo User', createdAt: Date.now(), expiresAt: null, dailyLimit: 100 },
        'test123': { scopes: ['number'], name: 'Test User', createdAt: Date.now(), expiresAt: null, dailyLimit: 50 }
    },
    endpoints: {
        'number': { param: 'num', category: 'Phone Intelligence', example: '9876543210', desc: 'Indian Mobile Number Lookup', enabled: true },
        'aadhar': { param: 'num', category: 'Phone Intelligence', example: '393933081942', desc: 'Aadhaar Number Lookup', enabled: true },
        'name': { param: 'name', category: 'Phone Intelligence', example: 'abhiraaj', desc: 'Search by Name', enabled: true },
        'numv2': { param: 'num', category: 'Phone Intelligence', example: '6205949840', desc: 'Number Info v2', enabled: true },
        'adv': { param: 'num', category: 'Phone Intelligence', example: '9876543210', desc: 'Advanced Phone Lookup', enabled: true },
        'upi': { param: 'upi', category: 'Financial', example: 'example@ybl', desc: 'UPI ID Verification', enabled: true },
        'ifsc': { param: 'ifsc', category: 'Financial', example: 'SBIN0001234', desc: 'IFSC Code Details', enabled: true },
        'pan': { param: 'pan', category: 'Financial', example: 'AXDPR2606K', desc: 'PAN to GST Search', enabled: true },
        'pincode': { param: 'pin', category: 'Location', example: '110001', desc: 'Pincode Details', enabled: true },
        'ip': { param: 'ip', category: 'Location', example: '8.8.8.8', desc: 'IP Address Lookup', enabled: true },
        'vehicle': { param: 'vehicle', category: 'Vehicle', example: 'MH02FZ0555', desc: 'Vehicle Registration Info', enabled: true },
        'rc': { param: 'owner', category: 'Vehicle', example: 'UP92P2111', desc: 'RC Owner Details', enabled: true },
        'ff': { param: 'uid', category: 'Gaming', example: '123456789', desc: 'Free Fire Player Info', enabled: true },
        'bgmi': { param: 'uid', category: 'Gaming', example: '5121439477', desc: 'BGMI Player Info', enabled: true },
        'insta': { param: 'username', category: 'Social', example: 'cristiano', desc: 'Instagram Profile Data', enabled: true },
        'git': { param: 'username', category: 'Social', example: 'ftgamer2', desc: 'GitHub Profile', enabled: true },
        'tg': { param: 'info', category: 'Social', example: 'JAUUOWNER', desc: 'Telegram User Lookup', enabled: true },
        'pk': { param: 'num', category: 'Pakistan', example: '03331234567', desc: 'Pakistan Number v1', enabled: true },
        'pkv2': { param: 'num', category: 'Pakistan', example: '3359736848', desc: 'Pakistan Number v2', enabled: true }
    },
    requestCounts: {}
};

// ========== DATE FUNCTIONS ==========
function getIndiaDate() {
    const now = new Date();
    const istOffset = 5.5 * 60 * 60 * 1000;
    const istDate = new Date(now.getTime() + istOffset);
    return istDate.toISOString().split('T')[0];
}

function checkAndResetLimit(apiKey) {
    const today = getIndiaDate();
    const keyData = db.keys[apiKey];
    const limit = keyData?.dailyLimit || 1000;
    
    if (!db.requestCounts[apiKey]) {
        db.requestCounts[apiKey] = { count: 0, date: today };
        return true;
    }
    if (db.requestCounts[apiKey].date !== today) {
        db.requestCounts[apiKey] = { count: 0, date: today };
        return true;
    }
    return db.requestCounts[apiKey].count < limit;
}

function incrementRequestCount(apiKey) {
    const today = getIndiaDate();
    if (!db.requestCounts[apiKey] || db.requestCounts[apiKey].date !== today) {
        db.requestCounts[apiKey] = { count: 1, date: today };
    } else {
        db.requestCounts[apiKey].count++;
    }
    return db.requestCounts[apiKey].count;
}

function getRemainingQuota(apiKey) {
    const today = getIndiaDate();
    const keyData = db.keys[apiKey];
    const limit = keyData?.dailyLimit || 1000;
    if (!db.requestCounts[apiKey] || db.requestCounts[apiKey].date !== today) return limit;
    return limit - db.requestCounts[apiKey].count;
}

function cleanResponse(data) {
    if (!data) return data;
    let cleaned = JSON.parse(JSON.stringify(data));
    function removeFields(obj) {
        if (!obj || typeof obj !== 'object') return;
        if (Array.isArray(obj)) { obj.forEach(item => removeFields(item)); return; }
        delete obj.by;
        delete obj.channel;
        delete obj.BY;
        delete obj.CHANNEL;
        delete obj.developer;
        Object.keys(obj).forEach(key => {
            if (obj[key] && typeof obj[key] === 'object') removeFields(obj[key]);
        });
    }
    removeFields(cleaned);
    cleaned.by = "@BRONX_ULTRA";
    return cleaned;
}

// ========== MIDDLEWARE ==========
app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'X-API-Key, Content-Type, Admin-Password');
    if (req.method === 'OPTIONS') return res.status(200).end();
    next();
});
app.use(express.json());

// ========== ADMIN API ==========
function checkAdmin(req, res, next) {
    const password = req.headers['admin-password'];
    if (password !== ADMIN_PASSWORD) return res.status(401).json({ success: false, error: 'Unauthorized' });
    next();
}

app.get('/admin/keys', checkAdmin, (req, res) => {
    const keys = {};
    const today = getIndiaDate();
    for (const [key, data] of Object.entries(db.keys)) {
        keys[key] = { ...data, usedToday: db.requestCounts[key]?.date === today ? db.requestCounts[key].count : 0 };
    }
    res.json({ success: true, keys });
});

app.post('/admin/keys', checkAdmin, (req, res) => {
    const { keyName, scopes, expiresAt, dailyLimit, ownerName } = req.body;
    if (!keyName || !scopes) return res.status(400).json({ success: false, error: 'Missing required fields' });
    if (db.keys[keyName]) return res.status(400).json({ success: false, error: 'Key already exists' });
    db.keys[keyName] = {
        scopes: scopes.includes('*') ? ['*'] : scopes.split(',').map(s => s.trim()),
        name: ownerName || keyName,
        createdAt: Date.now(),
        expiresAt: expiresAt ? new Date(expiresAt).getTime() : null,
        dailyLimit: parseInt(dailyLimit) || 1000
    };
    res.json({ success: true, message: 'Key created successfully' });
});

app.delete('/admin/keys/:keyName', checkAdmin, (req, res) => {
    const { keyName } = req.params;
    if (!db.keys[keyName]) return res.status(404).json({ success: false, error: 'Key not found' });
    delete db.keys[keyName];
    res.json({ success: true, message: 'Key deleted successfully' });
});

app.get('/admin/endpoints', checkAdmin, (req, res) => {
    res.json({ success: true, endpoints: db.endpoints });
});

app.post('/admin/endpoints', checkAdmin, (req, res) => {
    const { name, param, category, example, desc } = req.body;
    if (!name || !param) return res.status(400).json({ success: false, error: 'Missing required fields' });
    db.endpoints[name] = { param, category: category || 'Custom', example: example || '', desc: desc || 'Custom API Endpoint', enabled: true };
    res.json({ success: true, message: 'Endpoint added successfully' });
});

app.delete('/admin/endpoints/:name', checkAdmin, (req, res) => {
    const { name } = req.params;
    if (!db.endpoints[name]) return res.status(404).json({ success: false, error: 'Endpoint not found' });
    delete db.endpoints[name];
    res.json({ success: true, message: 'Endpoint deleted successfully' });
});

app.get('/admin/stats', checkAdmin, (req, res) => {
    const today = getIndiaDate();
    let totalRequestsToday = 0;
    for (const [key, data] of Object.entries(db.requestCounts)) {
        if (data.date === today) totalRequestsToday += data.count;
    }
    res.json({ success: true, stats: { totalKeys: Object.keys(db.keys).length, totalEndpoints: Object.keys(db.endpoints).length, totalRequestsToday } });
});

// ========== API KEY CHECK ==========
function checkApiKey(req, res, next) {
    const key = req.query.key || req.headers['x-api-key'];
    if (!key) return res.status(401).json({ success: false, error: "❌ API Key Required" });
    if (!db.keys[key]) return res.status(403).json({ success: false, error: "❌ Invalid API Key" });
    if (db.keys[key].expiresAt && db.keys[key].expiresAt < Date.now()) return res.status(403).json({ success: false, error: "❌ API Key Expired" });
    if (!checkAndResetLimit(key)) return res.status(429).json({ success: false, error: "❌ Daily quota exceeded (1000/day). Resets at 2:00 AM IST" });
    req.apiKey = key;
    next();
}

app.use('/api/key-bronx', checkApiKey);

app.get('/api/key-bronx/:endpoint', async (req, res) => {
    const { endpoint } = req.params;
    const query = req.query;
    const apiKey = req.apiKey;
    
    const ep = db.endpoints[endpoint];
    if (!ep || !ep.enabled) return res.status(404).json({ success: false, error: `Endpoint not found: ${endpoint}` });
    
    const keyData = db.keys[apiKey];
    if (!keyData.scopes.includes('*') && !keyData.scopes.includes(endpoint)) {
        return res.status(403).json({ success: false, error: `This key cannot access '${endpoint}'. Allowed: ${keyData.scopes.join(', ')}` });
    }
    
    const paramValue = query[ep.param];
    if (!paramValue) {
        return res.status(400).json({ success: false, error: `Missing parameter: ${ep.param}`, example: `?key=YOUR_KEY&${ep.param}=${ep.example}` });
    }
    
    try {
        const realUrl = `${REAL_API_BASE}/${endpoint}?key=${REAL_API_KEY}&${ep.param}=${encodeURIComponent(paramValue)}`;
        console.log(`📡 ${endpoint} -> ${paramValue}`);
        const response = await axios.get(realUrl, { timeout: 30000 });
        const used = incrementRequestCount(apiKey);
        const limit = db.keys[apiKey].dailyLimit || 1000;
        const cleanedData = cleanResponse(response.data);
        cleanedData.rate_limit = { limit, used, remaining: limit - used, reset: "2:00 AM IST" };
        res.json(cleanedData);
    } catch (error) {
        console.error(error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ========== PUBLIC ROUTES ==========
app.get('/api/info', (req, res) => {
    const endpointList = {};
    for (const [name, ep] of Object.entries(db.endpoints)) {
        if (ep.enabled) endpointList[name] = { description: ep.desc, parameter: ep.param, example: ep.example, category: ep.category };
    }
    res.json({ success: true, credit: "@BRONX_ULTRA", total_endpoints: Object.keys(endpointList).length, endpoints: endpointList });
});

app.get('/test', (req, res) => {
    res.json({ status: '✅ BRONX OSINT API Running', credit: '@BRONX_ULTRA', time: new Date().toISOString() });
});

app.get('/quota', (req, res) => {
    const key = req.query.key;
    if (!key) return res.status(400).json({ error: "Missing key" });
    if (!db.keys[key]) return res.status(403).json({ error: "Invalid key" });
    const remaining = getRemainingQuota(key);
    const limit = db.keys[key].dailyLimit || 1000;
    res.json({ success: true, limit, used: limit - remaining, remaining, reset: "2:00 AM IST" });
});

// ========== ROOT ROUTE WITH FULL HTML UI ==========
app.get('/', (req, res) => {
    res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>FT OSINT | API Documentation</title>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Inter', sans-serif; background: #0a0a0a; color: #e0e0e0; line-height: 1.6; }
        :root { --neon: #00ff41; --neon-glow: 0 0 10px rgba(0,255,65,0.3); --bg-card: #111111; --border: #1a1a1a; }
        .container { max-width: 1400px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #0a0a0a 0%, #0d0d0d 100%); border-bottom: 2px solid var(--neon); padding: 30px 0; margin-bottom: 40px; }
        .header-content { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 20px; }
        .logo h1 { font-size: 32px; font-weight: 800; background: linear-gradient(135deg, #00ff41, #00cc33); -webkit-background-clip: text; background-clip: text; color: transparent; }
        .logo p { color: #666; font-size: 14px; }
        .stats { display: flex; gap: 30px; }
        .stat { text-align: center; }
        .stat-value { font-size: 28px; font-weight: 700; color: var(--neon); }
        .stat-label { font-size: 11px; color: #666; text-transform: uppercase; letter-spacing: 1px; }
        .hero { background: var(--bg-card); border: 1px solid var(--border); border-radius: 20px; padding: 50px; text-align: center; margin-bottom: 40px; }
        .hero h2 { font-size: 36px; margin-bottom: 15px; }
        .hero p { color: #888; max-width: 600px; margin: 0 auto 20px; }
        .badge { display: inline-block; background: rgba(0,255,65,0.1); color: var(--neon); padding: 5px 15px; border-radius: 20px; font-size: 12px; margin-bottom: 20px; }
        .feature-grid { display: flex; justify-content: center; gap: 40px; margin-top: 30px; flex-wrap: wrap; }
        .feature { text-align: center; }
        .feature-value { font-size: 32px; font-weight: 700; color: var(--neon); }
        .feature-label { font-size: 12px; color: #666; }
        .auth-section { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 40px; }
        .auth-card { background: var(--bg-card); border: 1px solid var(--border); border-radius: 16px; padding: 25px; }
        .auth-card h3 { color: var(--neon); margin-bottom: 15px; }
        .code { background: #0a0a0a; border: 1px solid #1a1a1a; border-radius: 8px; padding: 12px; font-family: monospace; font-size: 12px; overflow-x: auto; margin: 10px 0; }
        .rate-card { background: var(--bg-card); border: 1px solid var(--border); border-radius: 16px; padding: 25px; margin-bottom: 40px; }
        .rate-grid { display: flex; justify-content: space-around; margin: 20px 0; flex-wrap: wrap; gap: 20px; }
        .rate-item { text-align: center; }
        .rate-value { font-size: 36px; font-weight: 700; color: var(--neon); }
        .rate-label { font-size: 11px; color: #666; }
        .error-table { width: 100%; border-collapse: collapse; margin-top: 15px; }
        .error-table th, .error-table td { padding: 10px; text-align: left; border-bottom: 1px solid #1a1a1a; }
        .error-table th { color: var(--neon); }
        .category { font-size: 24px; font-weight: 700; margin: 40px 0 20px; padding-left: 15px; border-left: 4px solid var(--neon); }
        .endpoints-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 15px; margin-bottom: 30px; }
        .endpoint-card { background: var(--bg-card); border: 1px solid var(--border); border-radius: 12px; padding: 18px; transition: all 0.3s; cursor: pointer; }
        .endpoint-card:hover { border-color: var(--neon); transform: translateY(-2px); box-shadow: var(--neon-glow); }
        .method { display: inline-block; background: rgba(0,255,65,0.1); color: var(--neon); padding: 2px 8px; border-radius: 4px; font-size: 10px; font-weight: 600; }
        .endpoint-name { font-size: 18px; font-weight: 600; margin: 10px 0; }
        .endpoint-url { font-family: monospace; font-size: 10px; color: #666; word-break: break-all; }
        .param { font-size: 11px; color: #666; margin-top: 8px; }
        .footer { text-align: center; padding: 40px 0; border-top: 1px solid #1a1a1a; margin-top: 40px; color: #666; }
        .toast { position: fixed; bottom: 20px; right: 20px; background: var(--neon); color: #000; padding: 12px 24px; border-radius: 8px; font-weight: 600; animation: slideIn 0.3s; z-index: 1000; }
        @keyframes slideIn { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
        @media (max-width: 768px) { .auth-section { grid-template-columns: 1fr; } .hero h2 { font-size: 24px; } .category { font-size: 18px; } }
        .admin-link { position: fixed; bottom: 20px; left: 20px; background: #111; border: 1px solid var(--neon); padding: 8px 16px; border-radius: 20px; font-size: 12px; z-index: 100; }
        .admin-link a { color: var(--neon); text-decoration: none; }
    </style>
</head>
<body>
    <div class="admin-link"><a href="/admin">🔧 Admin Panel</a></div>
    <div class="header"><div class="container"><div class="header-content"><div class="logo"><h1>🔍 FT OSINT</h1><p>Private Intelligence API</p></div><div class="stats"><div class="stat"><div class="stat-value" id="endpointCount">0</div><div class="stat-label">ENDPOINTS</div></div><div class="stat"><div class="stat-value">JSON</div><div class="stat-label">RESPONSES</div></div><div class="stat"><div class="stat-value">KEY</div><div class="stat-label">ACCESS</div></div></div></div></div></div>
    <div class="container">
        <div class="hero"><span class="badge">⚡ Premium OSINT Infrastructure</span><h2>Private OSINT APIs for fast and reliable data intelligence.</h2><p>Optimized performance. Controlled access. Real results.</p><div class="feature-grid"><div class="feature"><div class="feature-value">20+</div><div class="feature-label">Endpoints</div></div><div class="feature"><div class="feature-value">JSON</div><div class="feature-label">Responses</div></div><div class="feature"><div class="feature-value">Key-Based</div><div class="feature-label">Access</div></div><div class="feature"><div class="feature-value">1000/Day</div><div class="feature-label">Daily Quota</div></div></div></div>
        <div class="auth-section"><div class="auth-card"><h3>🔐 AUTHENTICATION</h3><p>API Key Required — Pass via query param or header</p><div class="code">GET /api/key-bronx/number?key=YOUR_KEY&num=9876543210</div><div class="code">curl -H "X-API-Key: YOUR_KEY" https://your-domain.vercel.app/api/key-bronx/number?num=9876543210</div></div>
        <div class="auth-card"><h3>📋 RATE LIMITS</h3><div class="rate-grid"><div class="rate-item"><div class="rate-value">1000</div><div class="rate-label">Default Quota/Day</div></div><div class="rate-item"><div class="rate-value">25s</div><div class="rate-label">Max Response Time</div></div></div><p style="font-size: 12px; color: #666;">Quota resets at <strong style="color: #00ff41;">2:00 AM IST</strong> daily</p></div></div>
        <div class="rate-card"><h3>⚠️ ERROR CODES</h3><table class="error-table"><tr><th>Code</th><th>Meaning</th></tr><tr><td>400</td><td>Bad request — missing or invalid parameter</td></tr><tr><td>401</td><td>No API key provided</td></tr><tr><td>403</td><td>Invalid key, expired, or scope denied</td></tr><tr><td>429</td><td>Daily quota exceeded</td></tr><tr><td>503</td><td>Upstream timeout — retry in a moment</td></tr></table></div>
        <div id="endpoints-container"></div>
        <div class="footer"><p>✨ FT OSINT API | Powered by <strong style="color: #00ff41;">@BRONX_ULTRA</strong></p><p style="font-size: 11px;">⚡ Response se 'by', 'channel', 'developer' auto-hide | '@BRONX_ULTRA' added</p><p style="font-size: 11px;">🔄 Daily limit: 1000 requests/key | Resets at 2:00 AM IST</p></div>
    </div>
    <script>
        async function loadEndpoints() {
            try {
                const res = await fetch('/api/info');
                const data = await res.json();
                if (data.success) {
                    document.getElementById('endpointCount').innerText = data.total_endpoints;
                    const categories = {};
                    for (const [name, ep] of Object.entries(data.endpoints)) {
                        if (!categories[ep.category]) categories[ep.category] = [];
                        categories[ep.category].push({ name, ...ep });
                    }
                    const container = document.getElementById('endpoints-container');
                    container.innerHTML = '';
                    const order = ['Phone Intelligence', 'Financial', 'Location', 'Vehicle', 'Gaming', 'Social', 'Pakistan', 'Custom'];
                    for (const cat of order) {
                        if (categories[cat]) {
                            container.innerHTML += \`<div class="category">📱 \${cat}</div><div class="endpoints-grid" id="grid-\${cat.replace(/ /g, '')}"></div>\`;
                            const grid = document.getElementById(\`grid-\${cat.replace(/ /g, '')}\`);
                            categories[cat].forEach(ep => {
                                grid.innerHTML += \`<div class="endpoint-card" onclick="copyUrl('\${ep.name}', '\${ep.parameter}', '\${ep.example}')"><span class="method">GET</span><div class="endpoint-name">\${ep.name.toUpperCase()}</div><div class="endpoint-url">/api/key-bronx/\${ep.name}</div><div class="param">📌 \${ep.description}</div><div class="param">🔑 \${ep.parameter}=\${ep.example}</div><div style="margin-top:10px;color:#00ff41;font-size:11px;">📋 CLICK TO COPY URL →</div></div>\`;
                            });
                        }
                    }
                }
            } catch(e) { console.error(e); }
        }
        function copyUrl(endpoint, param, example) {
            const url = window.location.origin + '/api/key-bronx/' + endpoint + '?key=YOUR_KEY&' + param + '=' + example;
            navigator.clipboard.writeText(url);
            const toast = document.createElement('div'); toast.className = 'toast'; toast.innerHTML = '✅ URL Copied!'; document.body.appendChild(toast);
            setTimeout(() => toast.remove(), 2000);
        }
        loadEndpoints();
    </script>
</body>
</html>
    `);
});

// ========== ADMIN ROUTE WITH FULL HTML ==========
app.get('/admin', (req, res) => {
    res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Admin Panel | BRONX OSINT</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { background: #0a0a0a; font-family: 'Inter', monospace; color: #00ff41; }
        .container { max-width: 1400px; margin: 0 auto; padding: 20px; }
        .login-box { max-width: 400px; margin: 100px auto; background: #111; border: 1px solid #00ff41; border-radius: 16px; padding: 40px; text-align: center; }
        .login-box input { width: 100%; padding: 12px; background: #0a0a0a; border: 1px solid #00ff41; color: #00ff41; border-radius: 8px; margin: 20px 0; }
        .login-box button { width: 100%; padding: 12px; background: #00ff41; color: #0a0a0a; border: none; border-radius: 8px; font-weight: bold; cursor: pointer; }
        .dashboard { display: none; }
        .header { display: flex; justify-content: space-between; align-items: center; padding: 20px 0; border-bottom: 1px solid #00ff41; margin-bottom: 30px; flex-wrap: wrap; gap: 15px; }
        .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 30px; }
        .stat-card { background: #111; border: 1px solid #00ff41; border-radius: 12px; padding: 20px; text-align: center; }
        .stat-number { font-size: 36px; font-weight: bold; }
        .section { background: #111; border: 1px solid #00ff41; border-radius: 12px; padding: 20px; margin-bottom: 30px; }
        input, textarea, select { width: 100%; padding: 10px; background: #0a0a0a; border: 1px solid #00ff41; color: #00ff41; border-radius: 6px; margin-bottom: 10px; }
        button { background: #00ff41; color: #0a0a0a; border: none; padding: 10px 20px; border-radius: 6px; font-weight: bold; cursor: pointer; }
        .btn-danger { background: #ff4444; color: white; }
        table { width: 100%; border-collapse: collapse; }
        th, td { padding: 10px; text-align: left; border-bottom: 1px solid #00ff4133; }
        .actions button { padding: 5px 10px; margin: 0 5px; font-size: 11px; }
        @media (max-width: 768px) { table { display: block; overflow-x: auto; } }
        .toast { position: fixed; bottom: 20px; right: 20px; background: #00ff41; color: #0a0a0a; padding: 10px 20px; border-radius: 8px; animation: slideIn 0.3s; z-index: 1000; }
        @keyframes slideIn { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
        .back-link { margin-top: 20px; text-align: center; }
        .back-link a { color: #00ff41; text-decoration: none; }
    </style>
</head>
<body>
    <div id="loginScreen" class="login-box"><h2>🔐 ADMIN LOGIN</h2><input type="password" id="adminPass" placeholder="Enter Admin Password"><button onclick="login()">Login</button><div id="loginError" style="color: #ff4444; margin-top: 10px;"></div></div>
    <div id="dashboard" class="dashboard"><div class="container"><div class="header"><h1>🔧 BRONX OSINT - ADMIN PANEL</h1><button onclick="logout()">🚪 Logout</button></div>
    <div class="stats-grid" id="statsGrid"><div class="stat-card"><div class="stat-number" id="totalKeys">0</div><div>Total Keys</div></div><div class="stat-card"><div class="stat-number" id="totalEndpoints">0</div><div>Endpoints</div></div><div class="stat-card"><div class="stat-number" id="todayRequests">0</div><div>Today's Requests</div></div></div>
    <div class="section"><h3>➕ CREATE NEW API KEY</h3><input type="text" id="keyName" placeholder="Key Name (e.g., MY_CUSTOM_KEY)"><input type="text" id="ownerName" placeholder="Owner Name"><input type="text" id="scopes" placeholder="Scopes (comma separated or *)"><input type="number" id="dailyLimit" placeholder="Daily Limit" value="1000"><input type="datetime-local" id="expiresAt"><button onclick="createKey()">Create Key</button></div>
    <div class="section"><h3>🗝️ API KEYS</h3><div style="overflow-x: auto;"><table id="keysTable"><thead><tr><th>Key</th><th>Owner</th><th>Scopes</th><th>Limit</th><th>Used Today</th><th>Expires</th><th>Actions</th></tr></thead><tbody id="keysBody"></tbody></table></div></div>
    <div class="section"><h3>🔌 ADD CUSTOM ENDPOINT</h3><input type="text" id="epName" placeholder="Endpoint Name (e.g., whatsapp)"><input type="text" id="epParam" placeholder="Parameter Name (e.g., number)"><input type="text" id="epCategory" placeholder="Category (e.g., Social)"><input type="text" id="epExample" placeholder="Example Value"><textarea id="epDesc" rows="2" placeholder="Description"></textarea><button onclick="addEndpoint()">Add Endpoint</button></div>
    <div class="section"><h3>📡 ALL ENDPOINTS</h3><div style="overflow-x: auto;"><table id="endpointsTable"><thead><tr><th>Name</th><th>Param</th><th>Category</th><th>Example</th><th>Actions</th></tr></thead><tbody id="endpointsBody"></tbody></table></div></div>
    <div class="back-link"><a href="/">← Back to Main Page</a></div>
    </div></div>
    <script>
        let adminPassword = '';
        async function login() { const pass = document.getElementById('adminPass').value; const res = await fetch('/admin/keys', { headers: { 'admin-password': pass } }); if (res.status === 200) { adminPassword = pass; document.getElementById('loginScreen').style.display = 'none'; document.getElementById('dashboard').style.display = 'block'; loadAllData(); } else { document.getElementById('loginError').innerText = 'Invalid password!'; } }
        function logout() { adminPassword = ''; document.getElementById('loginScreen').style.display = 'block'; document.getElementById('dashboard').style.display = 'none'; document.getElementById('adminPass').value = ''; }
        async function apiCall(url, method, body = null) { const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json', 'admin-password': adminPassword }, body: body ? JSON.stringify(body) : null }); return res.json(); }
        async function loadAllData() { await loadStats(); await loadKeys(); await loadEndpoints(); }
        async function loadStats() { const data = await apiCall('/admin/stats', 'GET'); if (data.success) { document.getElementById('totalKeys').innerText = data.stats.totalKeys; document.getElementById('totalEndpoints').innerText = data.stats.totalEndpoints; document.getElementById('todayRequests').innerText = data.stats.totalRequestsToday; } }
        async function loadKeys() { const data = await apiCall('/admin/keys', 'GET'); if (data.success) { const tbody = document.getElementById('keysBody'); tbody.innerHTML = ''; for (const [key, info] of Object.entries(data.keys)) { const row = tbody.insertRow(); row.insertCell(0).innerText = key; row.insertCell(1).innerText = info.name || '-'; row.insertCell(2).innerText = info.scopes.join(', '); row.insertCell(3).innerText = info.dailyLimit || 1000; row.insertCell(4).innerText = info.usedToday || 0; row.insertCell(5).innerText = info.expiresAt ? new Date(info.expiresAt).toLocaleDateString() : 'Never'; row.insertCell(6).innerHTML = '<button class="btn-danger" onclick="deleteKey(\\'' + key + '\\')">Delete</button>'; } } }
        async function loadEndpoints() { const data = await apiCall('/admin/endpoints', 'GET'); if (data.success) { const tbody = document.getElementById('endpointsBody'); tbody.innerHTML = ''; for (const [name, info] of Object.entries(data.endpoints)) { const row = tbody.insertRow(); row.insertCell(0).innerText = name; row.insertCell(1).innerText = info.param; row.insertCell(2).innerText = info.category; row.insertCell(3).innerText = info.example; row.insertCell(4).innerHTML = '<button class="btn-danger" onclick="deleteEndpoint(\\'' + name + '\\')">Delete</button>'; } } }
        async function createKey() { const keyName = document.getElementById('keyName').value; const ownerName = document.getElementById('ownerName').value; const scopes = document.getElementById('scopes').value; const dailyLimit = document.getElementById('dailyLimit').value; const expiresAt = document.getElementById('expiresAt').value; if (!keyName || !scopes) return alert('Fill required fields'); const data = await apiCall('/admin/keys', 'POST', { keyName, ownerName, scopes, dailyLimit, expiresAt: expiresAt || null }); if (data.success) { showToast('Key created!'); document.getElementById('keyName').value = ''; document.getElementById('ownerName').value = ''; document.getElementById('scopes').value = ''; loadKeys(); loadStats(); } else alert(data.error); }
        async function deleteKey(keyName) { if (!confirm('Delete this key?')) return; await apiCall('/admin/keys/' + keyName, 'DELETE'); showToast('Key deleted!'); loadKeys(); loadStats(); }
        async function addEndpoint() { const name = document.getElementById('epName').value; const param = document.getElementById('epParam').value; const category = document.getElementById('epCategory').value; const example = document.getElementById('epExample').value; const desc = document.getElementById('epDesc').value; if (!name || !param) return alert('Name and param required'); const data = await apiCall('/admin/endpoints', 'POST', { name, param, category, example, desc }); if (data.success) { showToast('Endpoint added!'); document.getElementById('epName').value = ''; document.getElementById('epParam').value = ''; document.getElementById('epCategory').value = ''; document.getElementById('epExample').value = ''; document.getElementById('epDesc').value = ''; loadEndpoints(); loadStats(); } }
        async function deleteEndpoint(name) { if (!confirm('Delete this endpoint?')) return; await apiCall('/admin/endpoints/' + name, 'DELETE'); showToast('Endpoint deleted!'); loadEndpoints(); loadStats(); }
        function showToast(msg) { const toast = document.createElement('div'); toast.className = 'toast'; toast.innerText = msg; document.body.appendChild(toast); setTimeout(() => toast.remove(), 2000); }
    </script>
</body>
</html>
    `);
});

module.exports = app;
