const express = require('express');
const axios = require('axios');

const app = express();

// ========== CONFIG ==========
const REAL_API_BASE = 'https://ft-osint.onrender.com/api';
const REAL_API_KEY = 'nobita';

// ========== KEYS WITH SCOPES, LIMITS & EXPIRY ==========
const VALID_KEYS = {
    // Master Key - Unlimited, No Limit, All Access
    'BRONX_MASTER_KEY': { 
        scopes: ['*'], 
        name: 'Owner',
        dailyLimit: 999999,
        expiresAt: null,
        type: 'master'
    },
    // Demo Key - Limited
    'DEMO_KEY': { 
        scopes: ['number', 'aadhar', 'pincode'], 
        name: 'Demo User',
        dailyLimit: 50,
        expiresAt: null,
        type: 'demo'
    },
    // Test Key
    'test123': { 
        scopes: ['number'], 
        name: 'Test User',
        dailyLimit: 50,
        expiresAt: null,
        type: 'test'
    },
    // Public Demo Keys (Will be added dynamically)
    'PUBLIC_DEMO_001': { 
        scopes: ['number', 'tg'], 
        name: 'Public Demo 1',
        dailyLimit: 50,
        expiresAt: new Date('2026-04-25').getTime(),
        type: 'public'
    },
    'PUBLIC_DEMO_002': { 
        scopes: ['insta', 'git'], 
        name: 'Public Demo 2',
        dailyLimit: 50,
        expiresAt: new Date('2026-04-20').getTime(),
        type: 'public'
    }
};

// ========== REQUEST COUNTS (Daily Reset at 2AM IST) ==========
let requestCounts = {};

function getIndiaDate() {
    const now = new Date();
    const istOffset = 5.5 * 60 * 60 * 1000;
    const istDate = new Date(now.getTime() + istOffset);
    return istDate.toISOString().split('T')[0];
}

function getHourIST() {
    const now = new Date();
    const istOffset = 5.5 * 60 * 60 * 1000;
    const istDate = new Date(now.getTime() + istOffset);
    return istDate.getUTCHours();
}

function checkAndResetLimit(apiKey) {
    const today = getIndiaDate();
    const keyData = VALID_KEYS[apiKey];
    const limit = keyData?.dailyLimit || 1000;
    
    if (!requestCounts[apiKey]) {
        requestCounts[apiKey] = { count: 0, date: today };
        return true;
    }
    if (requestCounts[apiKey].date !== today) {
        requestCounts[apiKey] = { count: 0, date: today };
        return true;
    }
    return requestCounts[apiKey].count < limit;
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
    const keyData = VALID_KEYS[apiKey];
    const limit = keyData?.dailyLimit || 1000;
    
    if (!requestCounts[apiKey] || requestCounts[apiKey].date !== today) {
        return limit;
    }
    return limit - requestCounts[apiKey].count;
}

// Check key expiry
function isKeyExpired(keyData) {
    if (!keyData.expiresAt) return false;
    return Date.now() > keyData.expiresAt;
}

// ========== ENDPOINTS ==========
const endpoints = [
    { path: '/number', param: 'num', example: '9876543210', desc: 'Indian Mobile Number Lookup', category: 'Phone Intelligence' },
    { path: '/aadhar', param: 'num', example: '393933081942', desc: 'Aadhaar Number Lookup', category: 'Phone Intelligence' },
    { path: '/name', param: 'name', example: 'abhiraaj', desc: 'Search by Name', category: 'Phone Intelligence' },
    { path: '/numv2', param: 'num', example: '6205949840', desc: 'Number Info v2', category: 'Phone Intelligence' },
    { path: '/adv', param: 'num', example: '9876543210', desc: 'Advanced Phone Lookup', category: 'Phone Intelligence' },
    { path: '/upi', param: 'upi', example: 'example@ybl', desc: 'UPI ID Verification', category: 'Financial' },
    { path: '/ifsc', param: 'ifsc', example: 'SBIN0001234', desc: 'IFSC Code Details', category: 'Financial' },
    { path: '/pan', param: 'pan', example: 'AXDPR2606K', desc: 'PAN to GST Search', category: 'Financial' },
    { path: '/pincode', param: 'pin', example: '110001', desc: 'Pincode Details', category: 'Location' },
    { path: '/ip', param: 'ip', example: '8.8.8.8', desc: 'IP Address Lookup', category: 'Location' },
    { path: '/vehicle', param: 'vehicle', example: 'MH02FZ0555', desc: 'Vehicle Registration Info', category: 'Vehicle' },
    { path: '/rc', param: 'owner', example: 'UP92P2111', desc: 'RC Owner Details', category: 'Vehicle' },
    { path: '/ff', param: 'uid', example: '123456789', desc: 'Free Fire Player Info', category: 'Gaming' },
    { path: '/bgmi', param: 'uid', example: '5121439477', desc: 'BGMI Player Info', category: 'Gaming' },
    { path: '/insta', param: 'username', example: 'cristiano', desc: 'Instagram Profile Data', category: 'Social' },
    { path: '/git', param: 'username', example: 'ftgamer2', desc: 'GitHub Profile', category: 'Social' },
    { path: '/tg', param: 'info', example: 'JAUUOWNER', desc: 'Telegram User Lookup', category: 'Social' },
    { path: '/pk', param: 'num', example: '03331234567', desc: 'Pakistan Number v1', category: 'Pakistan' },
    { path: '/pkv2', param: 'num', example: '3359736848', desc: 'Pakistan Number v2', category: 'Pakistan' }
];

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

// ========== API KEY CHECK WITH SCOPE, LIMIT & EXPIRY ==========
function checkApiKey(req, res, next) {
    const key = req.query.key || req.headers['x-api-key'];
    
    if (!key) {
        return res.status(401).json({ success: false, error: "❌ API Key Required" });
    }
    
    const keyData = VALID_KEYS[key];
    if (!keyData) {
        return res.status(403).json({ success: false, error: "❌ Invalid API Key" });
    }
    
    // Check expiry
    if (isKeyExpired(keyData)) {
        return res.status(403).json({ 
            success: false, 
            error: "❌ Your Key Is Expired! Please Renew",
            message: "Contact @BRONX_ULTRA on Telegram to renew your key",
            expired_at: new Date(keyData.expiresAt).toLocaleDateString()
        });
    }
    
    // Check daily limit
    if (!checkAndResetLimit(key)) {
        const remaining = getRemainingQuota(key);
        return res.status(429).json({ 
            success: false, 
            error: `❌ Daily quota exceeded (${keyData.dailyLimit}/day)`,
            reset: "2:00 AM IST",
            limit: keyData.dailyLimit,
            used: keyData.dailyLimit - remaining
        });
    }
    
    req.apiKey = key;
    req.keyData = keyData;
    next();
}

// ========== CORS ==========
app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'X-API-Key, Content-Type');
    if (req.method === 'OPTIONS') return res.status(200).end();
    next();
});

app.use(express.json());

// Proxy routes
app.use('/api/key-bronx', checkApiKey);

endpoints.forEach(ep => {
    app.get(`/api/key-bronx${ep.path}`, async (req, res) => {
        const paramValue = req.query[ep.param];
        const apiKey = req.apiKey;
        const keyData = req.keyData;
        
        if (!paramValue) {
            return res.status(400).json({ 
                success: false, 
                error: `Missing ${ep.param}`,
                example: `/api/key-bronx${ep.path}?key=YOUR_KEY&${ep.param}=${ep.example}`
            });
        }
        
        // Check scope
        if (!keyData.scopes.includes('*') && !keyData.scopes.includes(ep.path.replace('/', ''))) {
            return res.status(403).json({ 
                success: false, 
                error: `This key cannot access '${ep.path.replace('/', '')}'. Allowed: ${keyData.scopes.join(', ')}` 
            });
        }
        
        try {
            const realUrl = `${REAL_API_BASE}${ep.path}?key=${REAL_API_KEY}&${ep.param}=${paramValue}`;
            console.log(`📡 ${ep.path} -> ${paramValue} (Key: ${apiKey.substring(0, 8)}...)`);
            
            const response = await axios.get(realUrl, { timeout: 30000 });
            const used = incrementRequestCount(apiKey);
            const limit = keyData.dailyLimit;
            
            const cleanedData = cleanResponse(response.data);
            cleanedData.rate_limit = {
                limit: limit,
                used: used,
                remaining: limit - used,
                reset: "2:00 AM IST"
            };
            
            // Add headers
            res.setHeader('X-RateLimit-Limit', limit);
            res.setHeader('X-RateLimit-Remaining', limit - used);
            res.setHeader('X-RateLimit-Reset', '2:00 AM IST');
            
            res.json(cleanedData);
        } catch (error) {
            console.error(error.message);
            res.status(500).json({ success: false, error: error.message });
        }
    });
});

// ========== CREATE NEW KEY (Admin Function) ==========
app.post('/admin/create-key', express.json(), (req, res) => {
    const { adminKey, keyName, scopes, dailyLimit, expiresAt, ownerName } = req.body;
    
    // Only master key can create new keys
    if (adminKey !== 'BRONX_MASTER_KEY') {
        return res.status(401).json({ success: false, error: "Unauthorized. Only master key can create new keys" });
    }
    
    if (!keyName || !scopes) {
        return res.status(400).json({ success: false, error: "Missing required fields" });
    }
    
    if (VALID_KEYS[keyName]) {
        return res.status(400).json({ success: false, error: "Key already exists" });
    }
    
    VALID_KEYS[keyName] = {
        scopes: scopes.includes('*') ? ['*'] : scopes.split(',').map(s => s.trim()),
        name: ownerName || keyName,
        dailyLimit: parseInt(dailyLimit) || 1000,
        expiresAt: expiresAt ? new Date(expiresAt).getTime() : null,
        type: 'custom'
    };
    
    res.json({ 
        success: true, 
        message: "Key created successfully",
        key: keyName,
        details: VALID_KEYS[keyName]
    });
});

// ========== GET ALL KEYS (Admin only) ==========
app.get('/admin/keys', (req, res) => {
    const adminKey = req.query.key;
    if (adminKey !== 'BRONX_MASTER_KEY') {
        return res.status(401).json({ success: false, error: "Unauthorized" });
    }
    
    const keys = {};
    const today = getIndiaDate();
    for (const [key, data] of Object.entries(VALID_KEYS)) {
        keys[key] = {
            ...data,
            usedToday: requestCounts[key]?.date === today ? requestCounts[key].count : 0,
            isExpired: isKeyExpired(data)
        };
    }
    res.json({ success: true, keys });
});

// ========== ROOT ROUTE - NEON GLOWING UI ==========
app.get('/', (req, res) => {
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>FT OSINT | API Documentation</title>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: 'Inter', sans-serif;
            background: linear-gradient(135deg, #0a0a0a 0%, #1a0a0a 50%, #0a0a1a 100%);
            color: #fff;
            min-height: 100vh;
        }
        .container { max-width: 1400px; margin: 0 auto; padding: 20px; }
        
        /* Neon Glow Effects */
        .neon-green { text-shadow: 0 0 5px #00ff41, 0 0 10px #00ff41, 0 0 20px #00ff41; color: #00ff41; }
        .neon-pink { text-shadow: 0 0 5px #ff00ff, 0 0 10px #ff00ff; color: #ff00ff; }
        .neon-yellow { text-shadow: 0 0 5px #ffff00, 0 0 10px #ffff00; color: #ffff00; }
        .neon-red { text-shadow: 0 0 5px #ff4444, 0 0 10px #ff4444; color: #ff4444; }
        .neon-blue { text-shadow: 0 0 5px #4444ff, 0 0 10px #4444ff; color: #4444ff; }
        
        /* Header */
        .header { text-align: center; padding: 50px 0; border-bottom: 2px solid #00ff41; margin-bottom: 40px; background: rgba(0,0,0,0.5); border-radius: 0 0 30px 30px; }
        .header h1 { font-size: 56px; font-weight: 800; background: linear-gradient(135deg, #00ff41, #ff00ff, #ffff00, #ff4444, #4444ff); -webkit-background-clip: text; background-clip: text; color: transparent; text-shadow: none; animation: rgbShift 3s infinite; }
        @keyframes rgbShift { 0% { filter: hue-rotate(0deg); } 100% { filter: hue-rotate(360deg); } }
        .badge { display: inline-block; background: rgba(0,255,65,0.2); padding: 8px 20px; border-radius: 30px; font-size: 12px; margin-top: 15px; border: 1px solid #00ff41; }
        
        /* Stats */
        .stats { display: flex; justify-content: center; gap: 30px; margin: 30px 0; flex-wrap: wrap; }
        .stat-card { background: rgba(0,0,0,0.7); border: 1px solid #00ff41; border-radius: 16px; padding: 20px 35px; text-align: center; backdrop-filter: blur(10px); transition: 0.3s; }
        .stat-card:hover { transform: translateY(-5px); box-shadow: 0 0 30px #00ff41; }
        .stat-num { font-size: 42px; font-weight: 800; }
        .stat-label { font-size: 11px; letter-spacing: 2px; opacity: 0.7; }
        
        /* Hero */
        .hero { background: rgba(0,0,0,0.7); border: 1px solid rgba(0,255,65,0.3); border-radius: 24px; padding: 50px; text-align: center; margin-bottom: 40px; backdrop-filter: blur(10px); }
        .hero h2 { font-size: 36px; margin-bottom: 15px; }
        .hero p { opacity: 0.7; max-width: 600px; margin: 0 auto; }
        .feature-grid { display: flex; justify-content: center; gap: 40px; margin-top: 30px; flex-wrap: wrap; }
        .feature { text-align: center; }
        .feature-value { font-size: 32px; font-weight: 800; }
        
        /* Auth */
        .auth-section { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 40px; }
        .auth-card { background: rgba(0,0,0,0.7); border: 1px solid rgba(0,255,65,0.3); border-radius: 16px; padding: 25px; backdrop-filter: blur(10px); }
        .auth-card h3 { margin-bottom: 15px; }
        .code { background: rgba(0,0,0,0.8); border: 1px solid #00ff41; border-radius: 8px; padding: 12px; font-family: monospace; font-size: 12px; overflow-x: auto; margin: 10px 0; color: #00ff41; }
        
        /* Rate Limits */
        .rate-card { background: rgba(0,0,0,0.7); border: 1px solid rgba(0,255,65,0.3); border-radius: 16px; padding: 25px; margin-bottom: 40px; backdrop-filter: blur(10px); }
        .rate-grid { display: flex; justify-content: space-around; margin: 20px 0; flex-wrap: wrap; gap: 20px; }
        .rate-item { text-align: center; }
        .rate-value { font-size: 36px; font-weight: 800; }
        .error-table { width: 100%; border-collapse: collapse; margin-top: 15px; }
        .error-table th, .error-table td { padding: 10px; text-align: left; border-bottom: 1px solid rgba(0,255,65,0.2); }
        .error-table th { color: #00ff41; }
        
        /* Categories */
        .category { font-size: 24px; font-weight: 700; margin: 40px 0 20px; padding-left: 15px; border-left: 4px solid #00ff41; }
        .endpoints-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 15px; margin-bottom: 30px; }
        .endpoint-card { background: rgba(0,0,0,0.7); border: 1px solid rgba(0,255,65,0.2); border-radius: 12px; padding: 18px; transition: all 0.3s; cursor: pointer; backdrop-filter: blur(5px); }
        .endpoint-card:hover { border-color: #00ff41; transform: translateY(-3px); box-shadow: 0 0 20px #00ff41; background: rgba(0,255,65,0.1); }
        .method { display: inline-block; background: rgba(0,255,65,0.2); color: #00ff41; padding: 2px 8px; border-radius: 4px; font-size: 10px; font-weight: 600; }
        .endpoint-name { font-size: 18px; font-weight: 600; margin: 10px 0; }
        .endpoint-url { font-family: monospace; font-size: 10px; opacity: 0.7; word-break: break-all; }
        .param { font-size: 11px; opacity: 0.6; margin-top: 8px; }
        
        /* Footer */
        .footer { text-align: center; padding: 40px 0; border-top: 1px solid rgba(0,255,65,0.2); margin-top: 40px; opacity: 0.7; }
        .toast { position: fixed; bottom: 20px; right: 20px; background: #00ff41; color: #000; padding: 12px 24px; border-radius: 8px; font-weight: 600; animation: slideIn 0.3s; z-index: 1000; }
        @keyframes slideIn { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
        @media (max-width: 768px) { .auth-section { grid-template-columns: 1fr; } .header h1 { font-size: 32px; } .hero h2 { font-size: 24px; } .category { font-size: 18px; } }
        
        .admin-link { position: fixed; bottom: 20px; left: 20px; background: rgba(0,0,0,0.8); border: 1px solid #00ff41; padding: 8px 16px; border-radius: 20px; font-size: 12px; z-index: 100; }
        .admin-link a { color: #00ff41; text-decoration: none; }
    </style>
</head>
<body>
    <div class="admin-link"><a href="/admin">🔧 Admin Panel</a></div>
    <div class="container">
        <div class="header">
            <h1>🔍 FT OSINT</h1>
            <div class="badge">⚡ PRIVATE INTELLIGENCE API | NEON EDITION</div>
            <div class="stats">
                <div class="stat-card"><div class="stat-num neon-green">${endpoints.length}</div><div class="stat-label">ENDPOINTS</div></div>
                <div class="stat-card"><div class="stat-num neon-yellow">JSON</div><div class="stat-label">RESPONSES</div></div>
                <div class="stat-card"><div class="stat-num neon-pink">KEY</div><div class="stat-label">ACCESS</div></div>
                <div class="stat-card"><div class="stat-num neon-red">1000</div><div class="stat-label">DAILY QUOTA</div></div>
            </div>
        </div>
        
        <div class="hero">
            <span class="badge">✨ PREMIUM OSINT INFRASTRUCTURE</span>
            <h2 class="neon-green">Private OSINT APIs for fast and reliable data intelligence.</h2>
            <p>Optimized performance. Controlled access. Real results.</p>
            <div class="feature-grid">
                <div class="feature"><div class="feature-value neon-green">20+</div><div>Endpoints</div></div>
                <div class="feature"><div class="feature-value neon-yellow">JSON</div><div>Responses</div></div>
                <div class="feature"><div class="feature-value neon-pink">Key-Based</div><div>Access</div></div>
                <div class="feature"><div class="feature-value neon-red">1000/Day</div><div>Daily Quota</div></div>
            </div>
        </div>
        
        <div class="auth-section">
            <div class="auth-card"><h3 class="neon-green">🔐 AUTHENTICATION</h3><p>API Key Required — Pass via query param or header</p><div class="code">GET /api/key-bronx/number?key=YOUR_KEY&num=9876543210</div><div class="code">curl -H "X-API-Key: YOUR_KEY" https://your-domain.vercel.app/api/key-bronx/number?num=9876543210</div><p style="margin-top: 15px;">💡 Contact <strong class="neon-green">@BRONX_ULTRA</strong> on Telegram</p></div>
            <div class="auth-card"><h3 class="neon-yellow">📋 RATE LIMITS</h3><div class="rate-grid"><div class="rate-item"><div class="rate-value neon-green">1000</div><div>Default Quota/Day</div></div><div class="rate-item"><div class="rate-value neon-red">25s</div><div>Max Response Time</div></div></div><p style="font-size: 12px;">Quota resets at <strong class="neon-green">2:00 AM IST</strong> daily</p></div>
        </div>
        
        <div class="rate-card"><h3 class="neon-red">⚠️ ERROR CODES</h3><table class="error-table"><tr><th>Code</th><th>Meaning</th></tr><tr><td class="neon-red">400</td><td>Bad request — missing or invalid parameter</td></tr><tr><td class="neon-yellow">401</td><td>No API key provided</td></tr><tr><td class="neon-pink">403</td><td>Invalid key, expired, or scope denied</td></tr><tr><td class="neon-red">429</td><td>Daily quota exceeded</td></tr><tr><td class="neon-blue">503</td><td>Upstream timeout — retry in a moment</td></tr></table></div>
        
        <div id="endpoints-container"></div>
        
        <div class="footer"><p>✨ FT OSINT API | Powered by <strong class="neon-green">@BRONX_ULTRA</strong></p><p style="font-size: 11px;">⚡ Response se 'by', 'channel', 'developer' auto-hide | '@BRONX_ULTRA' added</p><p style="font-size: 11px;">🔄 Daily limit: 1000 requests/key | Resets at 2:00 AM IST</p></div>
    </div>
    <script>
        const endpointsData = ${JSON.stringify(endpoints)};
        const categories = {};
        endpointsData.forEach(ep => {
            if (!categories[ep.category]) categories[ep.category] = [];
            categories[ep.category].push(ep);
        });
        
        const container = document.getElementById('endpoints-container');
        const order = ['Phone Intelligence', 'Financial', 'Location', 'Vehicle', 'Gaming', 'Social', 'Pakistan'];
        order.forEach(cat => {
            if (categories[cat]) {
                container.innerHTML += \`<div class="category">📱 \${cat}</div><div class="endpoints-grid" id="grid-\${cat.replace(/ /g, '')}"></div>\`;
                const grid = document.getElementById(\`grid-\${cat.replace(/ /g, '')}\`);
                categories[cat].forEach(ep => {
                    grid.innerHTML += \`<div class="endpoint-card" onclick="copyUrl('\${ep.path.replace('/', '')}', '\${ep.param}', '\${ep.example}')"><span class="method">GET</span><div class="endpoint-name">\${ep.path.replace('/', '').toUpperCase()}</div><div class="endpoint-url">/api/key-bronx\${ep.path}</div><div class="param">📌 \${ep.desc}</div><div class="param">🔑 \${ep.param}=\${ep.example}</div><div style="margin-top:10px;color:#00ff41;font-size:11px;">📋 CLICK TO COPY URL →</div></div>\`;
                });
            }
        });
        
        function copyUrl(endpoint, param, example) {
            const url = window.location.origin + '/api/key-bronx/' + endpoint + '?key=YOUR_KEY&' + param + '=' + example;
            navigator.clipboard.writeText(url);
            const toast = document.createElement('div'); toast.className = 'toast'; toast.innerHTML = '✅ URL Copied!'; document.body.appendChild(toast);
            setTimeout(() => toast.remove(), 2000);
        }
    </script>
</body>
</html>`;
    res.send(html);
});

// ========== ADMIN ROUTE ==========
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
        body { background: linear-gradient(135deg, #0a0a0a, #1a0a0a); font-family: 'Inter', monospace; color: #00ff41; }
        .container { max-width: 1200px; margin: 0 auto; padding: 20px; }
        .header { text-align: center; padding: 30px; border-bottom: 1px solid #00ff41; margin-bottom: 30px; }
        .header h1 { font-size: 36px; text-shadow: 0 0 10px #00ff41; }
        .section { background: rgba(0,0,0,0.7); border: 1px solid #00ff41; border-radius: 16px; padding: 20px; margin-bottom: 30px; backdrop-filter: blur(10px); }
        input, textarea { width: 100%; padding: 10px; background: #0a0a0a; border: 1px solid #00ff41; color: #00ff41; border-radius: 8px; margin-bottom: 10px; }
        button { background: #00ff41; color: #000; border: none; padding: 10px 20px; border-radius: 8px; font-weight: bold; cursor: pointer; }
        table { width: 100%; border-collapse: collapse; }
        th, td { padding: 10px; text-align: left; border-bottom: 1px solid rgba(0,255,65,0.3); }
        .expired { color: #ff4444; }
        .toast { position: fixed; bottom: 20px; right: 20px; background: #00ff41; color: #000; padding: 10px 20px; border-radius: 8px; animation: slideIn 0.3s; }
        @keyframes slideIn { from { transform: translateX(100%); } to { transform: translateX(0); } }
    </style>
</head>
<body>
    <div class="container">
        <div class="header"><h1>🔧 BRONX OSINT - ADMIN PANEL</h1><p>Master Key Only</p></div>
        
        <div class="section"><h3>➕ CREATE NEW API KEY</h3><input type="text" id="masterKey" placeholder="Master Key (BRONX_MASTER_KEY)"><input type="text" id="keyName" placeholder="Key Name"><input type="text" id="ownerName" placeholder="Owner Name"><input type="text" id="scopes" placeholder="Scopes (comma separated or *)"><input type="number" id="dailyLimit" placeholder="Daily Limit" value="1000"><input type="datetime-local" id="expiresAt"><button onclick="createKey()">Create Key</button></div>
        
        <div class="section"><h3>🗝️ ALL KEYS</h3><div id="keysList">Loading...</div></div>
    </div>
    <script>
        async function createKey() {
            const masterKey = document.getElementById('masterKey').value;
            const keyName = document.getElementById('keyName').value;
            const ownerName = document.getElementById('ownerName').value;
            const scopes = document.getElementById('scopes').value;
            const dailyLimit = document.getElementById('dailyLimit').value;
            const expiresAt = document.getElementById('expiresAt').value;
            if (!masterKey || !keyName || !scopes) return alert('Fill required fields');
            const res = await fetch('/admin/create-key', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ adminKey: masterKey, keyName, ownerName, scopes, dailyLimit, expiresAt })
            });
            const data = await res.json();
            if (data.success) { alert('Key created!'); loadKeys(); }
            else alert(data.error);
        }
        async function loadKeys() {
            const masterKey = document.getElementById('masterKey')?.value || 'BRONX_MASTER_KEY';
            const res = await fetch('/admin/keys?key=' + masterKey);
            const data = await res.json();
            if (data.success) {
                let html = '<table><tr><th>Key</th><th>Owner</th><th>Scopes</th><th>Limit</th><th>Used Today</th><th>Expires</th><th>Status</th></tr>';
                for (const [key, info] of Object.entries(data.keys)) {
                    const isExpired = info.isExpired;
                    html += \`<tr><td>\${key}</td><td>\${info.name}</td><td>\${info.scopes.join(', ')}</td><td>\${info.dailyLimit}</td><td>\${info.usedToday || 0}</td><td class="\${isExpired ? 'expired' : ''}">\${info.expiresAt ? new Date(info.expiresAt).toLocaleDateString() : 'Never'}</td><td class="\${isExpired ? 'expired' : 'neon-green'}">\${isExpired ? '❌ EXPIRED' : '✅ ACTIVE'}</td></tr>`;
                }
                html += '</table>';
                document.getElementById('keysList').innerHTML = html;
            }
        }
        loadKeys();
        setInterval(loadKeys, 5000);
    </script>
</body>
</html>
    `);
});

// ========== API INFO ==========
app.get('/api/info', (req, res) => {
    const endpointUrls = {};
    endpoints.forEach(ep => {
        endpointUrls[ep.path.replace('/', '')] = {
            description: ep.desc,
            example: `/api/key-bronx${ep.path}?key=YOUR_KEY&${ep.param}=${ep.example}`,
            category: ep.category
        };
    });
    res.json({
        success: true,
        credit: "@BRONX_ULTRA",
        total_endpoints: endpoints.length,
        endpoints: endpointUrls,
        rate_limit: "1000 requests/day, resets at 2:00 AM IST"
    });
});

// ========== TEST ROUTE ==========
app.get('/test', (req, res) => {
    res.json({ status: '✅ BRONX OSINT API Running', credit: '@BRONX_ULTRA', time: new Date().toISOString() });
});

// ========== QUOTA CHECK ==========
app.get('/quota', (req, res) => {
    const key = req.query.key;
    if (!key) return res.status(400).json({ error: "Missing key parameter" });
    if (!VALID_KEYS[key]) return res.status(403).json({ error: "Invalid API Key" });
    
    const remaining = getRemainingQuota(key);
    const limit = VALID_KEYS[key].dailyLimit;
    const isExpired = isKeyExpired(VALID_KEYS[key]);
    
    res.json({
        success: true,
        key: key.substring(0, 8) + '...',
        limit: limit,
        used: limit - remaining,
        remaining: remaining,
        reset: "2:00 AM IST",
        isExpired: isExpired,
        expiresAt: VALID_KEYS[key].expiresAt ? new Date(VALID_KEYS[key].expiresAt).toLocaleDateString() : 'Never'
    });
});

module.exports = app;
