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

// ========== HELPER FUNCTIONS ==========
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
    
    if (!db.requestCounts[apiKey] || db.requestCounts[apiKey].date !== today) {
        return limit;
    }
    return limit - db.requestCounts[apiKey].count;
}

function checkKeyScope(key, endpoint) {
    const keyData = db.keys[key];
    if (!keyData) return { valid: false, error: '❌ Invalid API Key' };
    
    if (keyData.expiresAt && keyData.expiresAt < Date.now()) {
        return { valid: false, error: '❌ API Key Expired' };
    }
    
    if (keyData.scopes.includes('*')) return { valid: true, keyData };
    if (keyData.scopes.includes(endpoint)) return { valid: true, keyData };
    return { valid: false, error: `❌ This key cannot access '${endpoint}'. Allowed: ${keyData.scopes.join(', ')}` };
}

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

// ========== MIDDLEWARE ==========
app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'X-API-Key, Content-Type, Admin-Password');
    if (req.method === 'OPTIONS') return res.status(200).end();
    next();
});

app.use(express.json());
app.use(express.static('public'));

// ========== ADMIN API ==========
function checkAdmin(req, res, next) {
    const password = req.headers['admin-password'] || req.body?.adminPassword;
    if (password !== ADMIN_PASSWORD) {
        return res.status(401).json({ success: false, error: 'Unauthorized' });
    }
    next();
}

app.get('/admin/keys', checkAdmin, (req, res) => {
    const keys = {};
    const today = getIndiaDate();
    for (const [key, data] of Object.entries(db.keys)) {
        keys[key] = {
            ...data,
            usedToday: db.requestCounts[key]?.date === today ? db.requestCounts[key].count : 0
        };
    }
    res.json({ success: true, keys });
});

app.post('/admin/keys', checkAdmin, (req, res) => {
    const { keyName, scopes, expiresAt, dailyLimit, ownerName } = req.body;
    
    if (!keyName || !scopes) {
        return res.status(400).json({ success: false, error: 'Missing required fields' });
    }
    
    if (db.keys[keyName]) {
        return res.status(400).json({ success: false, error: 'Key already exists' });
    }
    
    db.keys[keyName] = {
        scopes: scopes.includes('*') ? ['*'] : scopes.split(',').map(s => s.trim()),
        name: ownerName || keyName,
        createdAt: Date.now(),
        expiresAt: expiresAt ? new Date(expiresAt).getTime() : null,
        dailyLimit: parseInt(dailyLimit) || 1000
    };
    res.json({ success: true, message: 'Key created successfully' });
});

app.put('/admin/keys/:keyName', checkAdmin, (req, res) => {
    const { keyName } = req.params;
    const { scopes, expiresAt, dailyLimit, ownerName } = req.body;
    
    if (!db.keys[keyName]) {
        return res.status(404).json({ success: false, error: 'Key not found' });
    }
    
    if (scopes !== undefined) {
        db.keys[keyName].scopes = scopes.includes('*') ? ['*'] : scopes.split(',').map(s => s.trim());
    }
    if (expiresAt !== undefined) db.keys[keyName].expiresAt = expiresAt ? new Date(expiresAt).getTime() : null;
    if (dailyLimit !== undefined) db.keys[keyName].dailyLimit = parseInt(dailyLimit);
    if (ownerName !== undefined) db.keys[keyName].name = ownerName;
    
    res.json({ success: true, message: 'Key updated successfully' });
});

app.delete('/admin/keys/:keyName', checkAdmin, (req, res) => {
    const { keyName } = req.params;
    if (!db.keys[keyName]) {
        return res.status(404).json({ success: false, error: 'Key not found' });
    }
    delete db.keys[keyName];
    res.json({ success: true, message: 'Key deleted successfully' });
});

app.get('/admin/endpoints', checkAdmin, (req, res) => {
    res.json({ success: true, endpoints: db.endpoints });
});

app.post('/admin/endpoints', checkAdmin, (req, res) => {
    const { name, param, category, example, desc, enabled } = req.body;
    
    if (!name || !param) {
        return res.status(400).json({ success: false, error: 'Missing required fields' });
    }
    
    db.endpoints[name] = {
        param,
        category: category || 'Custom',
        example: example || '',
        desc: desc || 'Custom API Endpoint',
        enabled: enabled !== false
    };
    res.json({ success: true, message: 'Endpoint added/updated successfully' });
});

app.delete('/admin/endpoints/:name', checkAdmin, (req, res) => {
    const { name } = req.params;
    if (!db.endpoints[name]) {
        return res.status(404).json({ success: false, error: 'Endpoint not found' });
    }
    delete db.endpoints[name];
    res.json({ success: true, message: 'Endpoint deleted successfully' });
});

app.get('/admin/stats', checkAdmin, (req, res) => {
    const today = getIndiaDate();
    let totalRequestsToday = 0;
    for (const [key, data] of Object.entries(db.requestCounts)) {
        if (data.date === today) {
            totalRequestsToday += data.count;
        }
    }
    res.json({
        success: true,
        stats: {
            totalKeys: Object.keys(db.keys).length,
            totalEndpoints: Object.keys(db.endpoints).length,
            totalRequestsToday,
            activeKeys: Object.keys(db.keys).filter(k => {
                const keyData = db.keys[k];
                if (keyData.expiresAt && keyData.expiresAt < Date.now()) return false;
                return true;
            }).length
        }
    });
});

// ========== API KEY CHECK ==========
function checkApiKey(req, res, next) {
    const key = req.query.key || req.headers['x-api-key'];
    if (!key) {
        return res.status(401).json({ success: false, error: "❌ API Key Required" });
    }
    if (!db.keys[key]) {
        return res.status(403).json({ success: false, error: "❌ Invalid API Key" });
    }
    
    if (db.keys[key].expiresAt && db.keys[key].expiresAt < Date.now()) {
        return res.status(403).json({ success: false, error: "❌ API Key Expired" });
    }
    
    if (!checkAndResetLimit(key)) {
        const remaining = getRemainingQuota(key);
        const limit = db.keys[key].dailyLimit || 1000;
        return res.status(429).json({
            success: false,
            error: `❌ Daily quota exceeded (${limit}/day)`,
            reset: "2:00 AM IST",
            limit: limit,
            used: limit - remaining
        });
    }
    
    req.apiKey = key;
    next();
}

// ========== PROXY ROUTES ==========
app.use('/api/key-bronx', checkApiKey);

app.get('/api/key-bronx/:endpoint', async (req, res) => {
    const { endpoint } = req.params;
    const query = req.query;
    const apiKey = req.apiKey;
    
    const ep = db.endpoints[endpoint];
    if (!ep || !ep.enabled) {
        return res.status(404).json({ success: false, error: `Endpoint not found: ${endpoint}` });
    }
    
    const scopeCheck = checkKeyScope(apiKey, endpoint);
    if (!scopeCheck.valid) {
        return res.status(403).json({ success: false, error: scopeCheck.error });
    }
    
    const paramValue = query[ep.param];
    if (!paramValue) {
        return res.status(400).json({
            success: false,
            error: `Missing parameter: ${ep.param}`,
            example: `?key=YOUR_KEY&${ep.param}=${ep.example}`
        });
    }
    
    try {
        const realUrl = `${REAL_API_BASE}/${endpoint}?key=${REAL_API_KEY}&${ep.param}=${encodeURIComponent(paramValue)}`;
        console.log(`📡 ${endpoint} -> ${paramValue}`);
        
        const response = await axios.get(realUrl, { timeout: 30000 });
        const used = incrementRequestCount(apiKey);
        const limit = db.keys[apiKey].dailyLimit || 1000;
        
        const cleanedData = cleanResponse(response.data);
        cleanedData.rate_limit = {
            limit: limit,
            used: used,
            remaining: limit - used,
            reset: "2:00 AM IST"
        };
        
        res.json(cleanedData);
    } catch (error) {
        console.error(`❌ ${endpoint} Error:`, error.message);
        if (error.response) {
            return res.status(error.response.status).json(cleanResponse(error.response.data));
        }
        res.status(500).json({ success: false, error: error.message });
    }
});

// ========== PUBLIC ROUTES ==========
app.get('/', (req, res) => {
    res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>BRONX OSINT API</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            background: #0a0a0a;
            font-family: 'Courier New', monospace;
            color: #00ff41;
            min-height: 100vh;
        }
        .container { max-width: 1200px; margin: 0 auto; padding: 20px; text-align: center; }
        h1 { font-size: 48px; margin: 50px 0; text-shadow: 0 0 10px #00ff41; }
        .status { color: #00ff41; font-size: 18px; margin: 20px 0; }
        .links { margin: 40px 0; }
        .links a {
            display: inline-block;
            margin: 10px;
            padding: 12px 24px;
            background: transparent;
            border: 1px solid #00ff41;
            color: #00ff41;
            text-decoration: none;
            border-radius: 8px;
            transition: 0.3s;
        }
        .links a:hover { background: #00ff41; color: #0a0a0a; box-shadow: 0 0 20px #00ff41; }
        .footer { margin-top: 60px; padding: 20px; border-top: 1px solid #00ff4133; color: #00ff4190; }
    </style>
</head>
<body>
    <div class="container">
        <h1>⚡ BRONX OSINT API</h1>
        <div class="status">✅ API is Running Successfully!</div>
        <div class="links">
            <a href="/admin">🔧 Admin Panel</a>
            <a href="/test">📡 Test API</a>
            <a href="/api/info">📚 API Info</a>
        </div>
        <div class="footer">
            <p>Created by @BRONX_ULTRA | Daily Limit: 1000 requests/key | Resets at 2:00 AM IST</p>
        </div>
    </div>
</body>
</html>
    `);
});

app.get('/admin', (req, res) => {
    res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Admin Login - BRONX OSINT</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            background: #0a0a0a;
            font-family: 'Courier New', monospace;
            color: #00ff41;
            min-height: 100vh;
            display: flex;
            justify-content: center;
            align-items: center;
        }
        .login-box {
            background: #111;
            border: 1px solid #00ff41;
            border-radius: 16px;
            padding: 40px;
            width: 350px;
            text-align: center;
        }
        h2 { margin-bottom: 20px; }
        input {
            width: 100%;
            padding: 12px;
            background: #0a0a0a;
            border: 1px solid #00ff41;
            color: #00ff41;
            border-radius: 8px;
            margin-bottom: 20px;
            font-size: 16px;
        }
        button {
            width: 100%;
            padding: 12px;
            background: #00ff41;
            color: #0a0a0a;
            border: none;
            border-radius: 8px;
            font-weight: bold;
            cursor: pointer;
            font-size: 16px;
        }
        .error { color: #ff4444; margin-top: 10px; }
    </style>
</head>
<body>
    <div class="login-box">
        <h2>🔐 ADMIN LOGIN</h2>
        <input type="password" id="password" placeholder="Enter Password">
        <button onclick="login()">Login</button>
        <div id="error" class="error"></div>
    </div>
    <script>
        async function login() {
            const password = document.getElementById('password').value;
            const res = await fetch('/admin/keys', {
                headers: { 'Admin-Password': password }
            });
            if (res.status === 200) {
                localStorage.setItem('adminPass', password);
                window.location.href = '/admin/dashboard';
            } else {
                document.getElementById('error').innerText = 'Invalid password!';
            }
        }
    </script>
</body>
</html>
    `);
});

app.get('/admin/dashboard', (req, res) => {
    res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Admin Dashboard</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            background: #0a0a0a;
            font-family: 'Courier New', monospace;
            color: #00ff41;
        }
        .container { max-width: 1200px; margin: 0 auto; padding: 20px; }
        h1 { color: #00ff41; margin-bottom: 20px; }
        .section {
            background: #111;
            border: 1px solid #00ff41;
            border-radius: 12px;
            padding: 20px;
            margin-bottom: 20px;
        }
        input, textarea {
            background: #0a0a0a;
            border: 1px solid #00ff41;
            color: #00ff41;
            padding: 8px;
            border-radius: 6px;
            width: 100%;
            margin-bottom: 10px;
        }
        button {
            background: #00ff41;
            color: #0a0a0a;
            border: none;
            padding: 8px 16px;
            border-radius: 6px;
            cursor: pointer;
            font-weight: bold;
        }
        table {
            width: 100%;
            border-collapse: collapse;
        }
        th, td {
            padding: 8px;
            text-align: left;
            border-bottom: 1px solid #00ff4133;
        }
        .delete-btn { background: #ff4444; color: white; }
        .logout { float: right; }
        @media (max-width: 768px) { table { display: block; overflow-x: auto; } }
    </style>
</head>
<body>
    <div class="container">
        <h1>🔧 Admin Dashboard <button class="logout" onclick="logout()">Logout</button></h1>
        
        <div class="section">
            <h3>➕ Create New Key</h3>
            <input type="text" id="keyName" placeholder="Key Name">
            <input type="text" id="scopes" placeholder="Scopes (comma separated or *)">
            <input type="number" id="dailyLimit" placeholder="Daily Limit" value="1000">
            <button onclick="createKey()">Create Key</button>
        </div>
        
        <div class="section">
            <h3>🗝️ All Keys</h3>
            <div id="keysList">Loading...</div>
        </div>
        
        <div class="section">
            <h3>➕ Add Custom Endpoint</h3>
            <input type="text" id="epName" placeholder="Endpoint Name">
            <input type="text" id="epParam" placeholder="Parameter Name">
            <input type="text" id="epCategory" placeholder="Category">
            <input type="text" id="epExample" placeholder="Example">
            <textarea id="epDesc" placeholder="Description"></textarea>
            <button onclick="addEndpoint()">Add Endpoint</button>
        </div>
        
        <div class="section">
            <h3>📡 All Endpoints</h3>
            <div id="endpointsList">Loading...</div>
        </div>
    </div>
    <script>
        const adminPass = localStorage.getItem('adminPass');
        if (!adminPass) window.location.href = '/admin';
        
        async function apiCall(url, method, body = null) {
            const res = await fetch(url, {
                method,
                headers: { 'Admin-Password': adminPass, 'Content-Type': 'application/json' },
                body: body ? JSON.stringify(body) : null
            });
            return res.json();
        }
        
        async function loadKeys() {
            const data = await apiCall('/admin/keys', 'GET');
            if (data.success) {
                let html = '<table><tr><th>Key</th><th>Scopes</th><th>Limit</th><th>Actions</th></tr>';
                for (const [key, info] of Object.entries(data.keys)) {
                    html += \`<tr>
                        <td>\${key}</td>
                        <td>\${info.scopes.join(', ')}</td>
                        <td>\${info.dailyLimit}</td>
                        <td><button onclick="deleteKey('\${key}')" class="delete-btn">Delete</button></td>
                    </tr>\`;
                }
                html += '</table>';
                document.getElementById('keysList').innerHTML = html;
            }
        }
        
        async function loadEndpoints() {
            const data = await apiCall('/admin/endpoints', 'GET');
            if (data.success) {
                let html = '<table><tr><th>Name</th><th>Param</th><th>Category</th><th>Example</th></tr>';
                for (const [name, info] of Object.entries(data.endpoints)) {
                    html += \`<tr><td>\${name}</td><td>\${info.param}</td><td>\${info.category}</td><td>\${info.example}</td></tr>\`;
                }
                html += '</table>';
                document.getElementById('endpointsList').innerHTML = html;
            }
        }
        
        async function createKey() {
            const keyName = document.getElementById('keyName').value;
            const scopes = document.getElementById('scopes').value;
            const dailyLimit = document.getElementById('dailyLimit').value;
            if (!keyName || !scopes) return alert('Fill all fields');
            await apiCall('/admin/keys', 'POST', { keyName, scopes, dailyLimit });
            alert('Key created!');
            loadKeys();
        }
        
        async function deleteKey(keyName) {
            if (!confirm('Delete this key?')) return;
            await apiCall(\`/admin/keys/\${keyName}\`, 'DELETE');
            loadKeys();
        }
        
        async function addEndpoint() {
            const name = document.getElementById('epName').value;
            const param = document.getElementById('epParam').value;
            const category = document.getElementById('epCategory').value;
            const example = document.getElementById('epExample').value;
            const desc = document.getElementById('epDesc').value;
            if (!name || !param) return alert('Name and param required');
            await apiCall('/admin/endpoints', 'POST', { name, param, category, example, desc });
            alert('Endpoint added!');
            loadEndpoints();
        }
        
        function logout() {
            localStorage.removeItem('adminPass');
            window.location.href = '/admin';
        }
        
        loadKeys();
        loadEndpoints();
    </script>
</body>
</html>
    `);
});

app.get('/test', (req, res) => {
    res.json({ status: '✅ BRONX OSINT API Running', credit: '@BRONX_ULTRA', time: new Date().toISOString() });
});

app.get('/api/info', (req, res) => {
    const endpointList = {};
    for (const [name, ep] of Object.entries(db.endpoints)) {
        if (ep.enabled) {
            endpointList[name] = {
                description: ep.desc,
                parameter: ep.param,
                example: ep.example,
                category: ep.category
            };
        }
    }
    res.json({
        success: true,
        name: "BRONX OSINT API",
        credit: "@BRONX_ULTRA",
        total_endpoints: Object.keys(endpointList).length,
        endpoints: endpointList,
        rate_limit: { limit: "Per key basis (default 1000/day)", reset_time: "2:00 AM IST" }
    });
});

app.get('/quota', (req, res) => {
    const key = req.query.key;
    if (!key) return res.status(400).json({ error: "Missing key parameter" });
    if (!db.keys[key]) return res.status(403).json({ error: "Invalid API Key" });
    
    const remaining = getRemainingQuota(key);
    const limit = db.keys[key].dailyLimit || 1000;
    res.json({
        success: true,
        apiKey: key.substring(0, 8) + "...",
        limit: limit,
        used: limit - remaining,
        remaining: remaining,
        reset: "2:00 AM IST",
        date: getIndiaDate()
    });
});

module.exports = app;
