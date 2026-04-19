const express = require('express');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

const app = express();

// ========== CONFIG ==========
const REAL_API_BASE = 'https://ft-osint.onrender.com/api';
const REAL_API_KEY = 'nobita';
const ADMIN_PASSWORD = 'BRONX_ADMIN_2026'; // Admin panel password

// ========== DATA FILE PATHS ==========
const DATA_DIR = path.join(__dirname, '..', 'data');
const DB_PATH = path.join(DATA_DIR, 'db.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

// ========== LOAD/SAVE DATA ==========
function loadData() {
    try {
        if (fs.existsSync(DB_PATH)) {
            return JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
        }
    } catch (e) {}
    return {
        keys: {
            'BRONX_KEY_2026': { scopes: ['*'], name: 'Master Key', createdAt: new Date().toISOString(), expiresAt: null, dailyLimit: 1000 },
            'DEMO_KEY': { scopes: ['number', 'aadhar', 'pincode'], name: 'Demo User', createdAt: new Date().toISOString(), expiresAt: null, dailyLimit: 100 },
            'test123': { scopes: ['number'], name: 'Test User', createdAt: new Date().toISOString(), expiresAt: null, dailyLimit: 50 }
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
}

function saveData(data) {
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
}

let db = loadData();

// ========== DAILY LIMITS (India Time 2:00 AM Reset) ==========
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
        saveData(db);
        return true;
    }
    if (db.requestCounts[apiKey].date !== today) {
        db.requestCounts[apiKey] = { count: 0, date: today };
        saveData(db);
        return true;
    }
    return db.requestCounts[apiKey].count < limit;
}

function incrementRequestCount(apiKey) {
    const today = getIndiaDate();
    const keyData = db.keys[apiKey];
    const limit = keyData?.dailyLimit || 1000;
    
    if (!db.requestCounts[apiKey] || db.requestCounts[apiKey].date !== today) {
        db.requestCounts[apiKey] = { count: 1, date: today };
    } else {
        db.requestCounts[apiKey].count++;
    }
    saveData(db);
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

// ========== CHECK KEY SCOPE & EXPIRY ==========
function checkKeyScope(key, endpoint) {
    const keyData = db.keys[key];
    if (!keyData) return { valid: false, error: '❌ Invalid API Key' };
    
    // Check expiry
    if (keyData.expiresAt) {
        const expiryDate = new Date(keyData.expiresAt);
        if (expiryDate < new Date()) {
            return { valid: false, error: '❌ API Key Expired' };
        }
    }
    
    if (keyData.scopes.includes('*')) return { valid: true, keyData };
    if (keyData.scopes.includes(endpoint)) return { valid: true, keyData };
    return { valid: false, error: `❌ This key cannot access '${endpoint}'. Allowed: ${keyData.scopes.join(', ')}` };
}

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

// ========== CORS ==========
app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'X-API-Key, Content-Type, Admin-Password');
    if (req.method === 'OPTIONS') return res.status(200).end();
    next();
});

app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

// ========== ADMIN API (Password Protected) ==========
function checkAdmin(req, res, next) {
    const password = req.headers['admin-password'] || req.body.adminPassword;
    if (password !== ADMIN_PASSWORD) {
        return res.status(401).json({ success: false, error: 'Unauthorized' });
    }
    next();
}

// Get all keys
app.get('/admin/keys', checkAdmin, (req, res) => {
    const keys = {};
    for (const [key, data] of Object.entries(db.keys)) {
        keys[key] = {
            ...data,
            usedToday: db.requestCounts[key]?.date === getIndiaDate() ? db.requestCounts[key].count : 0
        };
    }
    res.json({ success: true, keys });
});

// Create new key
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
        createdAt: new Date().toISOString(),
        expiresAt: expiresAt || null,
        dailyLimit: parseInt(dailyLimit) || 1000
    };
    saveData(db);
    res.json({ success: true, message: 'Key created successfully', key: db.keys[keyName] });
});

// Update key
app.put('/admin/keys/:keyName', checkAdmin, (req, res) => {
    const { keyName } = req.params;
    const { scopes, expiresAt, dailyLimit, ownerName, enabled } = req.body;
    
    if (!db.keys[keyName]) {
        return res.status(404).json({ success: false, error: 'Key not found' });
    }
    
    if (scopes !== undefined) {
        db.keys[keyName].scopes = scopes.includes('*') ? ['*'] : scopes.split(',').map(s => s.trim());
    }
    if (expiresAt !== undefined) db.keys[keyName].expiresAt = expiresAt || null;
    if (dailyLimit !== undefined) db.keys[keyName].dailyLimit = parseInt(dailyLimit);
    if (ownerName !== undefined) db.keys[keyName].name = ownerName;
    
    saveData(db);
    res.json({ success: true, message: 'Key updated successfully' });
});

// Delete key
app.delete('/admin/keys/:keyName', checkAdmin, (req, res) => {
    const { keyName } = req.params;
    if (!db.keys[keyName]) {
        return res.status(404).json({ success: false, error: 'Key not found' });
    }
    delete db.keys[keyName];
    saveData(db);
    res.json({ success: true, message: 'Key deleted successfully' });
});

// Get all endpoints
app.get('/admin/endpoints', checkAdmin, (req, res) => {
    res.json({ success: true, endpoints: db.endpoints });
});

// Add/Update endpoint
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
    saveData(db);
    res.json({ success: true, message: 'Endpoint added/updated successfully' });
});

// Delete endpoint
app.delete('/admin/endpoints/:name', checkAdmin, (req, res) => {
    const { name } = req.params;
    if (!db.endpoints[name]) {
        return res.status(404).json({ success: false, error: 'Endpoint not found' });
    }
    delete db.endpoints[name];
    saveData(db);
    res.json({ success: true, message: 'Endpoint deleted successfully' });
});

// Get stats
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
                if (keyData.expiresAt && new Date(keyData.expiresAt) < new Date()) return false;
                return true;
            }).length
        }
    });
});

// ========== API KEY CHECK MIDDLEWARE ==========
function checkApiKey(req, res, next) {
    const key = req.query.key || req.headers['x-api-key'];
    if (!key) {
        return res.status(401).json({ success: false, error: "❌ API Key Required" });
    }
    if (!db.keys[key]) {
        return res.status(403).json({ success: false, error: "❌ Invalid API Key" });
    }
    
    // Check expiry
    if (db.keys[key].expiresAt && new Date(db.keys[key].expiresAt) < new Date()) {
        return res.status(403).json({ success: false, error: "❌ API Key Expired" });
    }
    
    // Check daily limit
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

// Dynamic endpoint handler
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
        console.log(`📡 ${endpoint} -> ${paramValue} (Key: ${apiKey.substring(0, 8)}...)`);
        
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
    res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'public', 'admin.html'));
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
        rate_limit: {
            limit: "Per key basis (default 1000/day)",
            reset_time: "2:00 AM IST"
        }
    });
});

app.get('/test', (req, res) => {
    res.json({
        status: '✅ BRONX OSINT API Running',
        credit: '@BRONX_ULTRA',
        time: new Date().toISOString()
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
        date: getIndiaDate(),
        expiresAt: db.keys[key].expiresAt
    });
});

module.exports = app;
