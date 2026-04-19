const express = require('express');
const axios = require('axios');
const path = require('path');

const app = express();

// ========== CONFIG ==========
const REAL_API_BASE = 'https://ft-osint-api.onrender.com/api';
const REAL_API_KEY = 'nobita';

// ========== DAILY LIMITS (India Time 2:00 AM Reset) ==========
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

// API Keys (Hidden - Not shown in UI)
const VALID_KEYS = ['BRONX_KEY_2026', 'DEMO_KEY', 'test123', 'BRONX_MASTER_KEY', 'NUMBER_ONLY_KEY', 'AADHAR_KEY_2026', 'SOCIAL_MASTER', 'VEHICLE_TRACKER', 'GAMING_KEY_2026', 'FINANCE_KEY', 'LOCATION_KEY'];

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
    cleaned.bronx_credit = "@BRONX_ULTRA";
    return cleaned;
}

// ========== API KEY CHECK ==========
function checkApiKey(req, res, next) {
    const key = req.query.key || req.headers['x-api-key'];
    if (!key) {
        return res.status(401).json({ success: false, error: "❌ API Key Required" });
    }
    if (!VALID_KEYS.includes(key)) {
        return res.status(403).json({ success: false, error: "❌ Invalid API Key" });
    }
    
    // Check daily limit
    if (!checkAndResetLimit(key)) {
        return res.status(429).json({ 
            success: false, 
            error: "❌ Daily quota exceeded (1000 requests/day)",
            resetTime: "2:00 AM IST",
            message: "Quota resets daily at 2:00 AM India time"
        });
    }
    
    next();
}

// ========== SERVE HTML UI ==========
function serveHTML(res) {
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=yes">
    <title>BRONX OSINT | Intelligence API</title>
    <link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@400;500;600;700;800;900&family=Share+Tech+Mono&display=swap" rel="stylesheet">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        
        body {
            background: #0a0a0a;
            font-family: 'Orbitron', monospace;
            color: #00ff41;
            min-height: 100vh;
            position: relative;
        }
        
        /* Animated Background */
        body::before {
            content: '';
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: 
                linear-gradient(#00ff4108 1px, transparent 1px),
                linear-gradient(90deg, #00ff4108 1px, transparent 1px);
            background-size: 40px 40px;
            pointer-events: none;
            animation: gridMove 15s linear infinite;
        }
        
        @keyframes gridMove {
            0% { transform: translate(0, 0); }
            100% { transform: translate(40px, 40px); }
        }
        
        .container {
            max-width: 1300px;
            margin: 0 auto;
            padding: 20px;
            position: relative;
            z-index: 1;
        }
        
        /* Header */
        .header {
            text-align: center;
            padding: 40px 20px;
            background: rgba(0, 0, 0, 0.85);
            border: 2px solid #00ff41;
            border-radius: 30px;
            margin-bottom: 30px;
            backdrop-filter: blur(10px);
            box-shadow: 0 0 40px rgba(0, 255, 65, 0.15);
        }
        
        .glow {
            font-size: 48px;
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
            background: #00ff4115;
            color: #00ff41;
            padding: 8px 24px;
            border-radius: 40px;
            font-size: 12px;
            margin-top: 15px;
            border: 1px solid #00ff41;
            letter-spacing: 2px;
        }
        
        /* Stats */
        .stats {
            display: flex;
            justify-content: center;
            gap: 25px;
            margin: 30px 0;
            flex-wrap: wrap;
        }
        
        .stat-card {
            background: rgba(0, 0, 0, 0.85);
            border: 1px solid #00ff41;
            border-radius: 16px;
            padding: 18px 35px;
            text-align: center;
            backdrop-filter: blur(5px);
            transition: all 0.3s;
        }
        
        .stat-card:hover {
            transform: translateY(-3px);
            box-shadow: 0 0 20px #00ff41;
        }
        
        .stat-num {
            font-size: 42px;
            font-weight: 900;
            font-family: 'Share Tech Mono', monospace;
        }
        
        .stat-label {
            font-size: 10px;
            letter-spacing: 2px;
            color: #00ff41aa;
            margin-top: 5px;
        }
        
        /* Limit Alert */
        .limit-alert {
            background: rgba(0, 0, 0, 0.9);
            border: 1px solid #00ff41;
            border-radius: 16px;
            padding: 18px;
            margin: 25px 0;
            text-align: center;
        }
        
        .limit-text { font-size: 14px; letter-spacing: 1px; }
        .reset-time { font-weight: bold; font-size: 20px; }
        
        /* Auth Box - No Keys Visible */
        .auth-box {
            background: rgba(0, 0, 0, 0.85);
            border: 1px solid #00ff41;
            border-radius: 16px;
            padding: 25px;
            margin: 25px 0;
            text-align: center;
        }
        
        .code-block {
            background: #0a0a0a;
            border: 1px solid #00ff41;
            border-radius: 10px;
            padding: 12px;
            font-family: 'Share Tech Mono', monospace;
            font-size: 11px;
            overflow-x: auto;
            margin: 12px 0;
        }
        
        /* Categories */
        .category {
            font-size: 22px;
            font-weight: 700;
            margin: 40px 0 20px;
            padding: 8px 15px;
            background: linear-gradient(90deg, #00ff4115, transparent);
            border-left: 4px solid #00ff41;
            letter-spacing: 2px;
        }
        
        .endpoints-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
            gap: 18px;
            margin-bottom: 30px;
        }
        
        .endpoint-card {
            background: rgba(0, 0, 0, 0.85);
            border: 1px solid #00ff4130;
            border-radius: 14px;
            padding: 18px;
            transition: all 0.3s;
            cursor: pointer;
        }
        
        .endpoint-card:hover {
            border-color: #00ff41;
            transform: translateY(-3px);
            box-shadow: 0 0 20px #00ff41;
        }
        
        .method {
            display: inline-block;
            background: #00ff4115;
            color: #00ff41;
            padding: 3px 12px;
            border-radius: 8px;
            font-size: 10px;
            font-weight: bold;
            letter-spacing: 1px;
        }
        
        .endpoint-name {
            font-size: 20px;
            font-weight: 700;
            margin: 12px 0 8px;
        }
        
        .endpoint-url {
            font-family: 'Share Tech Mono', monospace;
            font-size: 10px;
            color: #00ff4190;
            word-break: break-all;
            background: #0a0a0a;
            padding: 8px;
            border-radius: 8px;
            margin: 10px 0;
        }
        
        .param {
            font-size: 11px;
            color: #00ff4190;
            margin-top: 8px;
        }
        
        .example-link {
            display: inline-block;
            margin-top: 12px;
            color: #00ff41;
            text-decoration: none;
            font-size: 11px;
            border-bottom: 1px dashed #00ff41;
        }
        
        /* Extra APIs Section */
        .extra-apis {
            margin: 40px 0;
            padding: 20px;
            background: rgba(0, 0, 0, 0.85);
            border: 1px solid #00ff41;
            border-radius: 16px;
        }
        
        .extra-title {
            font-size: 20px;
            margin-bottom: 15px;
            text-align: center;
        }
        
        .extra-grid {
            display: flex;
            justify-content: center;
            gap: 15px;
            flex-wrap: wrap;
        }
        
        .extra-btn {
            background: transparent;
            border: 1px solid #00ff41;
            color: #00ff41;
            padding: 10px 20px;
            border-radius: 40px;
            cursor: pointer;
            font-family: 'Orbitron', monospace;
            transition: all 0.3s;
        }
        
        .extra-btn:hover {
            background: #00ff41;
            color: #0a0a0a;
            box-shadow: 0 0 15px #00ff41;
        }
        
        .footer {
            text-align: center;
            padding: 40px 0;
            margin-top: 50px;
            border-top: 1px solid #00ff4130;
            font-size: 11px;
            color: #00ff4190;
        }
        
        ::-webkit-scrollbar { width: 8px; }
        ::-webkit-scrollbar-track { background: #0a0a0a; }
        ::-webkit-scrollbar-thumb { background: #00ff41; border-radius: 4px; }
        
        @media (max-width: 768px) {
            .container { padding: 15px; }
            .glow { font-size: 28px; letter-spacing: 2px; }
            .stat-num { font-size: 28px; }
            .stat-card { padding: 12px 20px; }
            .category { font-size: 16px; }
            .endpoint-name { font-size: 16px; }
        }
        
        .toast {
            position: fixed;
            bottom: 20px;
            right: 20px;
            background: #00ff41;
            color: #0a0a0a;
            padding: 12px 24px;
            border-radius: 10px;
            font-weight: bold;
            z-index: 1000;
            animation: slideIn 0.3s ease;
        }
        
        @keyframes slideIn {
            from { transform: translateX(100%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
        }
        
        input, button { background: none; border: none; color: inherit; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="glow">⚡ BRONX OSINT</div>
            <div class="badge">🔐 PRIVATE INTELLIGENCE API | NEON EDITION</div>
            <div class="stats">
                <div class="stat-card"><div class="stat-num">${endpoints.length}</div><div class="stat-label">ENDPOINTS</div></div>
                <div class="stat-card"><div class="stat-num">JSON</div><div class="stat-label">RESPONSE</div></div>
                <div class="stat-card"><div class="stat-num">KEY</div><div class="stat-label">ACCESS</div></div>
            </div>
        </div>
        
        <div class="limit-alert">
            <div class="limit-text">⚡ DAILY LIMIT: <strong style="font-size: 22px;">1000</strong> REQUESTS PER KEY</div>
            <div class="limit-text" style="margin-top: 8px;">🔄 RESET TIME: <span class="reset-time">🇮🇳 2:00 AM IST</span></div>
        </div>
        
        <div class="auth-box">
            <h3 style="margin-bottom: 15px;">🔐 AUTHENTICATION</h3>
            <div class="code-block">GET /api/key-bronx/number?key=YOUR_KEY&num=9876543210</div>
            <div class="code-block">curl -H "X-API-Key: YOUR_KEY" https://your-domain.vercel.app/api/key-bronx/number?num=9876543210</div>
            <p style="margin-top: 15px; font-size: 12px;">💡 Contact <strong style="color: #00ff41;">@BRONX_ULTRA</strong> on Telegram to get API keys</p>
        </div>
        
        ${(() => {
            const categories = {};
            endpoints.forEach(ep => {
                if (!categories[ep.category]) categories[ep.category] = [];
                categories[ep.category].push(ep);
            });
            return Object.entries(categories).map(([cat, eps]) => `
                <div class="category">📱 ${cat}</div>
                <div class="endpoints-grid">
                    ${eps.map(ep => `
                        <div class="endpoint-card" onclick="copyUrl('${ep.path.replace('/', '')}', '${ep.param}', '${ep.example}')">
                            <span class="method">GET</span>
                            <div class="endpoint-name">${ep.path.replace('/', '').toUpperCase()}</div>
                            <div class="endpoint-url">/api/key-bronx${ep.path}</div>
                            <div class="param">📌 ${ep.desc}</div>
                            <div class="param">🔑 ${ep.param}=${ep.example}</div>
                            <span class="example-link">📋 CLICK TO COPY URL →</span>
                        </div>
                    `).join('')}
                </div>
            `).join('');
        })()}
        
        <!-- Extra APIs Addition Section -->
        <div class="extra-apis">
            <div class="extra-title">🔌 ADD MORE APIS (Contact @BRONX_ULTRA)</div>
            <div class="extra-grid">
                <button class="extra-btn" onclick="alert('Contact @BRONX_ULTRA on Telegram to add new APIs')">➕ Add New Endpoint</button>
                <button class="extra-btn" onclick="alert('Contact @BRONX_ULTRA on Telegram for custom API integration')">🔧 Custom API Integration</button>
                <button class="extra-btn" onclick="alert('Contact @BRONX_ULTRA on Telegram for premium keys')">⭐ Premium Keys</button>
            </div>
        </div>
        
        <div class="footer">
            <p>✨ BRONX OSINT API | POWERED BY @BRONX_ULTRA</p>
            <p style="font-size: 9px; margin-top: 8px;">⚡ Response se 'by', 'channel', 'developer' auto-hide | '@BRONX_ULTRA' added</p>
            <p style="font-size: 9px;">🔄 Daily limit: 1000 requests/key | Resets at 2:00 AM IST</p>
        </div>
    </div>
    
    <script>
        function copyUrl(endpoint, param, example) {
            const url = window.location.origin + '/api/key-bronx/' + endpoint + '?key=YOUR_KEY&' + param + '=' + example;
            navigator.clipboard.writeText(url);
            const toast = document.createElement('div');
            toast.className = 'toast';
            toast.innerHTML = '✅ URL Copied! Use YOUR_KEY from @BRONX_ULTRA';
            document.body.appendChild(toast);
            setTimeout(() => toast.remove(), 2500);
        }
    </script>
</body>
</html>`;
    res.setHeader('Content-Type', 'text/html');
    res.send(html);
}

// ========== ROUTES ==========
app.use(cors());

// Proxy routes with API key check
app.use('/api/key-bronx', checkApiKey);

endpoints.forEach(ep => {
    app.get(`/api/key-bronx${ep.path}`, async (req, res) => {
        const paramValue = req.query[ep.param];
        const apiKey = req.query.key || req.headers['x-api-key'];
        
        if (!paramValue) {
            return res.status(400).json({
                success: false,
                error: `Missing ${ep.param}`,
                example: `/api/key-bronx${ep.path}?key=YOUR_KEY&${ep.param}=${ep.example}`
            });
        }
        
        try {
            const realUrl = `${REAL_API_BASE}${ep.path}?key=${REAL_API_KEY}&${ep.param}=${paramValue}`;
            console.log(`📡 ${ep.path} -> called by ${apiKey}`);
            
            const response = await axios.get(realUrl, { timeout: 30000 });
            
            // Increment request count
            const used = incrementRequestCount(apiKey);
            const remaining = 1000 - used;
            
            const cleanedData = cleanResponse(response.data);
            cleanedData.rate_limit = {
                limit: 1000,
                used: used,
                remaining: remaining,
                reset: "2:00 AM IST"
            };
            
            res.json(cleanedData);
        } catch (error) {
            console.error(`❌ ${ep.path} Error:`, error.message);
            res.status(500).json({ success: false, error: error.message });
        }
    });
});

// Root route - HTML UI
app.get('/', (req, res) => serveHTML(res));

// JSON API info (without keys)
app.get('/api/info', (req, res) => {
    const endpointList = {};
    endpoints.forEach(ep => {
        endpointList[ep.path.replace('/', '')] = {
            description: ep.desc,
            parameter: ep.param,
            example: ep.example
        };
    });
    res.json({
        success: true,
        name: "BRONX OSINT API",
        credit: "@BRONX_ULTRA",
        total_endpoints: endpoints.length,
        endpoints: endpointList,
        rate_limit: {
            limit: 1000,
            reset_time: "2:00 AM IST"
        }
    });
});

// Test route
app.get('/test', (req, res) => {
    res.json({
        status: '✅ BRONX OSINT API Running',
        credit: '@BRONX_ULTRA',
        time: new Date().toISOString()
    });
});

// Quota check
app.get('/quota', (req, res) => {
    const key = req.query.key;
    if (!key) return res.status(400).json({ error: "Missing key parameter" });
    if (!VALID_KEYS.includes(key)) return res.status(403).json({ error: "Invalid API Key" });
    
    const remaining = getRemainingQuota(key);
    res.json({
        success: true,
        apiKey: key.substring(0, 8) + "...",
        limit: 1000,
        used: 1000 - remaining,
        remaining: remaining,
        resetTime: "2:00 AM IST",
        date: getIndiaDate()
    });
});

// ========== EXPORT FOR VERCEL ==========
module.exports = app;
