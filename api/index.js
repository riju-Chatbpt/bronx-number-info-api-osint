const express = require('express');
const axios = require('axios');

const app = express();

// ========== CONFIG ==========
const REAL_API_BASE = 'https://ft-osint-api.onrender.com/api';
const REAL_API_KEY = 'nobita';

// ========== KEYS WITH SCOPES, LIMITS & EXPIRY ==========
const VALID_KEYS = {
    'BRONX_MASTER_KEY': { 
        scopes: ['*'], 
        name: '👑 OWNER',
        dailyLimit: 999999,
        expiresAt: null,
        type: 'master'
    },
    'BRONX_KEY_2026': { 
        scopes: ['*'], 
        name: 'Premium User',
        dailyLimit: 1000,
        expiresAt: null,
        type: 'premium'
    },
    'DEMO_KEY': { 
        scopes: ['number', 'aadhar', 'pincode'], 
        name: 'Demo User',
        dailyLimit: 50,
        expiresAt: null,
        type: 'demo'
    },
    'test123': { 
        scopes: ['number'], 
        name: 'Test User',
        dailyLimit: 50,
        expiresAt: null,
        type: 'test'
    },
    'PUBLIC_NUMBER_KEY': { 
        scopes: ['number'], 
        name: 'Number Only',
        dailyLimit: 50,
        expiresAt: new Date('2026-04-25').getTime(),
        type: 'public'
    },
    'PUBLIC_TG_KEY': { 
        scopes: ['tg'], 
        name: 'Telegram Only',
        dailyLimit: 50,
        expiresAt: new Date('2026-04-20').getTime(),
        type: 'public'
    },
    'PUBLIC_VEHICLE_KEY': { 
        scopes: ['vehicle', 'rc'], 
        name: 'Vehicle Only',
        dailyLimit: 50,
        expiresAt: new Date('2026-04-28').getTime(),
        type: 'public'
    }
};

// ========== REQUEST COUNTS ==========
let requestCounts = {};

function getIndiaDate() {
    const now = new Date();
    const istOffset = 5.5 * 60 * 60 * 1000;
    const istDate = new Date(now.getTime() + istOffset);
    return istDate.toISOString().split('T')[0];
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
    if (!requestCounts[apiKey] || requestCounts[apiKey].date !== today) return limit;
    return limit - requestCounts[apiKey].count;
}

function isKeyExpired(keyData) {
    if (!keyData.expiresAt) return false;
    return Date.now() > keyData.expiresAt;
}

// ========== ENDPOINTS WITH EXAMPLE RESPONSES ==========
const endpoints = [
    { path: '/number', param: 'num', example: '7307841587', desc: 'Indian Mobile Number Lookup - SIM records, address, relatives, Aadhaar', category: 'Phone Intelligence',
      exampleResponse: {
        "success": true,
        "number": "7307841587",
        "total": 2,
        "results": [
          { "mobile": "7307841587", "name": "Nemsingh", "address": "j gram dabhaura simra post sarsava k tilhar Shahjahanpur Uttar Pradesh 242303", "circle": "JIO UPE", "alternate": "8542812624", "father_name": "jayram", "aadhar": "226010868980", "email": "akaShguptu@gmail.com" },
          { "mobile": "9219059191", "name": "Premraj", "address": "s/o itwari Tilhar dabhaura simra tilhar Shahjahanpur Uttar Pradesh 242307", "circle": "JIO UPE", "alternate": "7307841587", "father_name": "itwari", "aadhar": "619872770858" }
        ],
        "cached": true
      }
    },
    { path: '/aadhar', param: 'num', example: '393933081942', desc: 'Aadhaar Number Lookup - linked records', category: 'Phone Intelligence',
      exampleResponse: {
        "success": true,
        "aadhar": "393933081942",
        "total": 1,
        "results": [{ "name": "J Vinod", "phoneNumber": "9490160194", "age": "28", "gender": "Male", "address": "Hyderabad", "district": "HYDERABAD", "state": "TELANGANA" }]
      }
    },
    { path: '/name', param: 'name', example: 'abhiraaj', desc: 'Name - Linked Aadhaar records', category: 'Phone Intelligence',
      exampleResponse: {
        "success": true,
        "name": "abhiraaj",
        "total": 1,
        "results": [{ "name": "ABHIRAAJ BALASAHEB GAWADE", "phoneNumber": "9823796702", "age": "6", "gender": "Male", "address": "CHAMDGAD", "district": "KOLHAPUR", "state": "MAHARASHTRA" }]
      }
    },
    { path: '/numv2', param: 'num', example: '6205949840', desc: 'Number Info v2 - alternate database', category: 'Phone Intelligence',
      exampleResponse: {
        "success": true,
        "number": "6205949840",
        "total": 1,
        "results": [{ "mobile": "6205949840", "name": "Vikram Yadav", "fname": "Biran Yadav", "address": "Khagaria Bihar 851212", "circle": "BIHAR JIO" }]
      }
    },
    { path: '/adv', param: 'num', example: '9876543210', desc: 'Advanced - Aadhaar linked records', category: 'Phone Intelligence',
      exampleResponse: {
        "success": true,
        "number": "9876543210",
        "total": 17,
        "results": [{ "aadharNumber": "527034357255", "name": "RAHUL SHARMA", "address": "MUMBAI", "age": 24, "gender": "MALE", "state": "MAHARASHTRA" }]
      }
    },
    { path: '/upi', param: 'upi', example: 'example@ybl', desc: 'UPI ID verification - name, bank, status', category: 'Financial',
      exampleResponse: {
        "success": true,
        "upi_id": "example@ybl",
        "valid": true,
        "account_name": "MURENDRA SARABU",
        "bank": "Union Bank of India",
        "ifsc": "UBIN",
        "psp": "PhonePe"
      }
    },
    { path: '/ifsc', param: 'ifsc', example: 'SBIN0001234', desc: 'IFSC - bank name, branch, payment modes', category: 'Financial',
      exampleResponse: {
        "success": true,
        "ifsc": "SBIN0001234",
        "bank": "State Bank of India",
        "branch": "HAJIGANJ",
        "address": "PATNA, BIHAR",
        "city": "PATNA",
        "state": "BIHAR",
        "payment_modes": { "upi": true, "imps": true, "neft": true, "rtgs": true }
      }
    },
    { path: '/pan', param: 'pan', example: 'AXDPR2606K', desc: 'PAN to GSTIN - linked GST registration', category: 'Financial',
      exampleResponse: {
        "success": true,
        "pan": "AXDPR2606K",
        "result": { "gstins": [{ "gstin": "192500063179ES0", "status": "Active", "state": "WEST BENGAL" }] }
      }
    },
    { path: '/pincode', param: 'pin', example: '110001', desc: 'Pincode - area, district, post offices', category: 'Location',
      exampleResponse: {
        "success": true,
        "pincode": "110001",
        "state": "Delhi",
        "district": "Central Delhi",
        "country": "India",
        "total_offices": 21,
        "post_offices": [{ "name": "Connaught Place", "branch_type": "Sub Post Office" }]
      }
    },
    { path: '/ip', param: 'ip', example: '8.8.8.8', desc: 'IP geolocation - coordinates, ISP, timezone', category: 'Location',
      exampleResponse: {
        "success": true,
        "ip": "8.8.8.8",
        "country": "United States",
        "city": "Mountain View",
        "isp": "Google LLC",
        "latitude": 37.3860517,
        "longitude": -122.0838511
      }
    },
    { path: '/vehicle', param: 'vehicle', example: 'MH02FZ0555', desc: 'Vehicle registration - owner, insurance, RC status', category: 'Vehicle',
      exampleResponse: {
        "status": "success",
        "data": { "rc_number": "MH02FZ0555", "owner_name": "SHAH RUKH KHAN", "maker_model": "BLACK BADGE CULLINAN", "fuel_type": "PETROL", "registration_date": "2023-04-12", "rc_status": "ACTIVE" }
      }
    },
    { path: '/rc', param: 'owner', example: 'UP92P2111', desc: 'RC to Owner - detailed ownership & vehicle info', category: 'Vehicle',
      exampleResponse: {
        "success": true,
        "rc": "UP92P2111",
        "result": { "Owner Name": "SANJU SOLANKI", "Registration Number": "UP92P2111", "Model Name": "HERO MOTOCORP LTD" }
      }
    },
    { path: '/ff', param: 'uid', example: '123456789', desc: 'Free Fire - player info + ban status', category: 'Gaming',
      exampleResponse: {
        "success": true,
        "uid": "123456789",
        "info": { "Nickname": "Chfjdjs", "Level": "5", "Region": "Br" },
        "ban": { "ban_status": "BANNED", "ban_period": 6 }
      }
    },
    { path: '/bgmi', param: 'uid', example: '5121439477', desc: 'BGMI - username by player UID', category: 'Gaming',
      exampleResponse: {
        "success": true,
        "uid": "5121439477",
        "game": "BGMI",
        "region": "IND",
        "username": "Kūiūrūaūt"
      }
    },
    { path: '/insta', param: 'username', example: 'cristiano', desc: 'Instagram - profile + linked OSINT records', category: 'Social',
      exampleResponse: {
        "success": true,
        "username": "cristiano",
        "profile": { "name": "Cristiano Ronaldo", "followers": 672571267, "verified": true },
        "osint": { "records": [{ "id": "173560420", "email": null, "phone": null }] }
      }
    },
    { path: '/git', param: 'username', example: 'ftgamer2', desc: 'GitHub profile - repos, followers, bio', category: 'Social',
      exampleResponse: {
        "success": true,
        "username": "ftgamer2",
        "name": "FTGAMERV2",
        "bio": "Teen dev cooking cool stuff",
        "public_repos": 6,
        "followers": 1
      }
    },
    { path: '/tg', param: 'info', example: 'JAUUOWNER', desc: 'Telegram user - profile, phone, linked records', category: 'Social',
      exampleResponse: {
        "success": true,
        "username": "@JAUUOWNER",
        "data": { "profile": { "full_name": "JAUU OWNER OFFICIAL", "premium": true }, "phone_lookup": { "number": "8140827956", "country": "India" } }
      }
    },
    { path: '/pk', param: 'num', example: '03331234567', desc: 'Pakistan number - subscriber records with CNIC', category: 'Pakistan',
      exampleResponse: {
        "success": true,
        "number": "03331234567",
        "total": 3,
        "results": [{ "name": "ASIM ALI", "number": "3331234567", "cnic": "3430125586549", "address": "KARACHI, Sindh" }]
      }
    },
    { path: '/pkv2', param: 'num', example: '3359736848', desc: 'Pakistan number v2 - alternate database', category: 'Pakistan',
      exampleResponse: {
        "success": true,
        "number": "3359736848",
        "total": 2,
        "results": [{ "name": "SHAH NAWAZ KHAN", "mobile": "923359736848", "cnic": "1110189490683", "address": "MARDAN" }]
      }
    }
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

// ========== API KEY CHECK ==========
function checkApiKey(req, res, next) {
    const key = req.query.key || req.headers['x-api-key'];
    
    if (!key) {
        return res.status(401).json({ success: false, error: "❌ API Key Required" });
    }
    
    const keyData = VALID_KEYS[key];
    if (!keyData) {
        return res.status(403).json({ success: false, error: "❌ Invalid API Key" });
    }
    
    if (isKeyExpired(keyData)) {
        return res.status(403).json({ 
            success: false, 
            error: "❌ Your Key Is Expired! Please Renew",
            message: "Contact @BRONX_ULTRA on Telegram to renew your key"
        });
    }
    
    if (!checkAndResetLimit(key)) {
        const remaining = getRemainingQuota(key);
        return res.status(429).json({ 
            success: false, 
            error: `❌ Daily quota exceeded (${keyData.dailyLimit}/day)`,
            reset: "2:00 AM IST"
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
        
        if (!keyData.scopes.includes('*') && !keyData.scopes.includes(ep.path.replace('/', ''))) {
            return res.status(403).json({ 
                success: false, 
                error: `This key cannot access '${ep.path.replace('/', '')}'. Allowed: ${keyData.scopes.join(', ')}`
            });
        }
        
        try {
            const realUrl = `${REAL_API_BASE}${ep.path}?key=${REAL_API_KEY}&${ep.param}=${paramValue}`;
            console.log(`📡 ${ep.path} -> ${paramValue}`);
            
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

// ========== ROOT ROUTE - COMPLETE UI WITH ALL ENDPOINTS ==========
app.get('/', (req, res) => {
    // Generate endpoints HTML
    let endpointsHTML = '';
    const categories = {};
    endpoints.forEach(ep => {
        if (!categories[ep.category]) categories[ep.category] = [];
        categories[ep.category].push(ep);
    });
    
    const categoryOrder = ['Phone Intelligence', 'Financial', 'Location', 'Vehicle', 'Gaming', 'Social', 'Pakistan'];
    
    categoryOrder.forEach(cat => {
        if (categories[cat]) {
            endpointsHTML += `<div class="category">📱 ${cat}</div><div class="endpoints-grid">`;
            categories[cat].forEach(ep => {
                const exampleResponseJSON = JSON.stringify(ep.exampleResponse, null, 2);
                endpointsHTML += `
                    <div class="endpoint-card">
                        <span class="method">GET</span>
                        <div class="endpoint-name">${ep.path.replace('/', '').toUpperCase()}</div>
                        <div class="endpoint-url">/api/key-bronx${ep.path}</div>
                        <div class="param">📌 ${ep.desc}</div>
                        <div class="param">🔑 ${ep.param}=${ep.example}</div>
                        <div class="example-response">
                            <div class="example-title">📋 Example Response:</div>
                            <pre class="example-code">${escapeHtml(exampleResponseJSON.substring(0, 300))}${exampleResponseJSON.length > 300 ? '...' : ''}</pre>
                        </div>
                        <div class="copy-btn" onclick="copyUrl('${ep.path.replace('/', '')}', '${ep.param}', '${ep.example}')">📋 COPY URL →</div>
                    </div>
                `;
            });
            endpointsHTML += `</div>`;
        }
    });
    
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>BRONX OSINT | API Documentation</title>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: 'Inter', sans-serif;
            background: #0a0a0a;
            color: #e0e0e0;
            line-height: 1.6;
        }
        .container { max-width: 1400px; margin: 0 auto; padding: 20px; }
        
        .header { border-bottom: 1px solid #2a2a2a; padding: 30px 0; margin-bottom: 40px; }
        .header-content { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 20px; }
        .logo h1 { font-size: 28px; font-weight: 700; background: linear-gradient(135deg, #00ff41, #00cc33); -webkit-background-clip: text; background-clip: text; color: transparent; }
        .logo p { color: #666; font-size: 13px; }
        .stats { display: flex; gap: 30px; }
        .stat { text-align: center; }
        .stat-value { font-size: 24px; font-weight: 700; color: #00ff41; }
        .stat-label { font-size: 10px; color: #666; text-transform: uppercase; letter-spacing: 1px; }
        
        .hero { background: #111; border: 1px solid #222; border-radius: 20px; padding: 40px; text-align: center; margin-bottom: 40px; }
        .hero h2 { font-size: 28px; margin-bottom: 15px; }
        .hero p { color: #888; max-width: 600px; margin: 0 auto; }
        .badge { display: inline-block; background: rgba(0,255,65,0.1); color: #00ff41; padding: 5px 15px; border-radius: 20px; font-size: 11px; margin-bottom: 20px; }
        .feature-grid { display: flex; justify-content: center; gap: 40px; margin-top: 30px; flex-wrap: wrap; }
        .feature { text-align: center; }
        .feature-value { font-size: 28px; font-weight: 700; color: #00ff41; }
        .feature-label { font-size: 11px; color: #666; }
        
        .auth-section { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 40px; }
        .auth-card { background: #111; border: 1px solid #222; border-radius: 16px; padding: 25px; }
        .auth-card h3 { color: #00ff41; margin-bottom: 15px; font-size: 18px; }
        .code { background: #0a0a0a; border: 1px solid #222; border-radius: 8px; padding: 12px; font-family: monospace; font-size: 11px; overflow-x: auto; margin: 10px 0; color: #00ff41; }
        
        .rate-card { background: #111; border: 1px solid #222; border-radius: 16px; padding: 25px; margin-bottom: 40px; }
        .rate-grid { display: flex; justify-content: space-around; margin: 20px 0; flex-wrap: wrap; gap: 20px; }
        .rate-item { text-align: center; }
        .rate-value { font-size: 32px; font-weight: 700; color: #00ff41; }
        .rate-label { font-size: 10px; color: #666; }
        .error-table { width: 100%; border-collapse: collapse; margin-top: 15px; }
        .error-table th, .error-table td { padding: 10px; text-align: left; border-bottom: 1px solid #222; }
        .error-table th { color: #00ff41; }
        
        .category { font-size: 22px; font-weight: 700; margin: 40px 0 20px; padding-left: 15px; border-left: 4px solid #00ff41; }
        .endpoints-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(350px, 1fr)); gap: 20px; margin-bottom: 30px; }
        .endpoint-card { background: #111; border: 1px solid #222; border-radius: 12px; padding: 18px; transition: all 0.3s; }
        .endpoint-card:hover { border-color: #00ff41; transform: translateY(-2px); box-shadow: 0 0 15px rgba(0,255,65,0.2); }
        .method { display: inline-block; background: rgba(0,255,65,0.1); color: #00ff41; padding: 2px 8px; border-radius: 4px; font-size: 9px; font-weight: 600; }
        .endpoint-name { font-size: 16px; font-weight: 600; margin: 10px 0; }
        .endpoint-url { font-family: monospace; font-size: 10px; color: #666; word-break: break-all; }
        .param { font-size: 10px; color: #666; margin-top: 8px; }
        .example-response { margin-top: 12px; padding-top: 10px; border-top: 1px solid #222; }
        .example-title { font-size: 10px; color: #00ff41; margin-bottom: 5px; }
        .example-code { background: #0a0a0a; padding: 8px; border-radius: 6px; font-family: monospace; font-size: 9px; overflow-x: auto; color: #888; max-height: 150px; overflow-y: auto; }
        .copy-btn { margin-top: 12px; color: #00ff41; font-size: 10px; cursor: pointer; text-align: center; padding: 5px; border: 1px solid #00ff41; border-radius: 6px; transition: 0.3s; }
        .copy-btn:hover { background: #00ff41; color: #000; }
        
        .keys-section { background: #111; border: 1px solid #222; border-radius: 16px; padding: 25px; margin-bottom: 40px; }
        .key-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 15px; margin-top: 15px; }
        .key-card { background: #0a0a0a; border: 1px solid #222; border-radius: 10px; padding: 12px; }
        .key-name { font-size: 12px; font-weight: bold; color: #00ff41; word-break: break-all; }
        .key-scope { font-size: 9px; color: #666; margin-top: 5px; }
        .key-limit { font-size: 10px; color: #ffcc00; margin-top: 5px; }
        .key-expiry { font-size: 9px; color: #ff4444; margin-top: 3px; }
        
        .footer { text-align: center; padding: 30px 0; border-top: 1px solid #222; margin-top: 40px; color: #666; font-size: 11px; }
        .toast { position: fixed; bottom: 20px; right: 20px; background: #00ff41; color: #000; padding: 10px 20px; border-radius: 8px; font-weight: 600; animation: slideIn 0.3s; z-index: 1000; font-size: 12px; }
        @keyframes slideIn { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
        @media (max-width: 768px) { .auth-section { grid-template-columns: 1fr; } .header-content { flex-direction: column; text-align: center; } .hero h2 { font-size: 20px; } .category { font-size: 18px; } .endpoints-grid { grid-template-columns: 1fr; } }
        a { color: #00ff41; text-decoration: none; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="header-content">
                <div class="logo">
                    <h1>🔍 BRONX OSINT</h1>
                    <p>Private Intelligence API</p>
                </div>
                <div class="stats">
                    <div class="stat"><div class="stat-value">${endpoints.length}</div><div class="stat-label">ENDPOINTS</div></div>
                    <div class="stat"><div class="stat-value">JSON</div><div class="stat-label">RESPONSES</div></div>
                    <div class="stat"><div class="stat-value">KEY</div><div class="stat-label">ACCESS</div></div>
                </div>
            </div>
        </div>
        
        <div class="hero">
            <span class="badge">⚡ Premium OSINT Infrastructure</span>
            <h2>Private OSINT APIs for fast and reliable data intelligence.</h2>
            <p>Optimized performance. Controlled access. Real results.</p>
            <div class="feature-grid">
                <div class="feature"><div class="feature-value">20+</div><div class="feature-label">Endpoints</div></div>
                <div class="feature"><div class="feature-value">JSON</div><div class="feature-label">Responses</div></div>
                <div class="feature"><div class="feature-value">Key-Based</div><div class="feature-label">Access</div></div>
                <div class="feature"><div class="feature-value">1000/Day</div><div class="feature-label">Daily Quota</div></div>
            </div>
        </div>
        
        <div class="auth-section">
            <div class="auth-card">
                <h3>🔐 AUTHENTICATION</h3>
                <p>API Key Required — Pass via query param or header</p>
                <div class="code">GET /api/key-bronx/number?key=YOUR_KEY&num=9876543210</div>
                <div class="code">curl -H "X-API-Key: YOUR_KEY" https://your-domain.vercel.app/api/key-bronx/number?num=9876543210</div>
            </div>
            <div class="auth-card">
                <h3>📋 RATE LIMITS</h3>
                <div class="rate-grid">
                    <div class="rate-item"><div class="rate-value">1000</div><div class="rate-label">Default Quota/Day</div></div>
                    <div class="rate-item"><div class="rate-value">25s</div><div class="rate-label">Max Response Time</div></div>
                </div>
                <p style="font-size: 11px; color: #666;">Quota resets at <strong style="color: #00ff41;">2:00 AM IST</strong> daily</p>
            </div>
        </div>
        
        <div class="rate-card">
            <h3>⚠️ ERROR CODES</h3>
            <table class="error-table">
                <tr><th>Code</th><th>Meaning</th></tr>
                <tr><td style="color:#ff4444;">400</td><td>Bad request — missing or invalid parameter</td></tr>
                <tr><td style="color:#ffcc00;">401</td><td>No API key provided</td></tr>
                <tr><td style="color:#ff00ff;">403</td><td>Invalid key, expired, or scope denied</td></tr>
                <tr><td style="color:#ff4444;">429</td><td>Daily quota exceeded</td></tr>
                <tr><td style="color:#4444ff;">503</td><td>Upstream timeout — retry in a moment</td></tr>
            </table>
        </div>
        
        <div class="keys-section">
            <h3>🗝️ AVAILABLE API KEYS</h3>
            <div class="key-grid">
                <div class="key-card"><div class="key-name">⭐ BRONX_MASTER_KEY</div><div class="key-scope">✓ All Endpoints (*)</div><div class="key-limit">Unlimited Requests | Never Expires</div><div class="key-expiry">👑 Owner Only</div></div>
                <div class="key-card"><div class="key-name">🔑 BRONX_KEY_2026</div><div class="key-scope">✓ All Endpoints (*)</div><div class="key-limit">1000 requests/day | Never Expires</div></div>
                <div class="key-card"><div class="key-name">🎁 DEMO_KEY</div><div class="key-scope">✓ number, aadhar, pincode</div><div class="key-limit">50 requests/day | Never Expires</div></div>
                <div class="key-card"><div class="key-name">📞 PUBLIC_NUMBER_KEY</div><div class="key-scope">✓ number only</div><div class="key-limit">50 requests/day</div><div class="key-expiry">⚠️ Expires: 25 April 2026</div></div>
                <div class="key-card"><div class="key-name">✈️ PUBLIC_TG_KEY</div><div class="key-scope">✓ tg only</div><div class="key-limit">50 requests/day</div><div class="key-expiry">⚠️ Expires: 20 April 2026</div></div>
                <div class="key-card"><div class="key-name">🚗 PUBLIC_VEHICLE_KEY</div><div class="key-scope">✓ vehicle, rc</div><div class="key-limit">50 requests/day</div><div class="key-expiry">⚠️ Expires: 28 April 2026</div></div>
            </div>
            <p style="margin-top: 15px; font-size: 11px; color: #666;">💡 Contact <strong style="color: #00ff41;">@BRONX_ULTRA</strong> on Telegram to get keys</p>
        </div>
        
        ${endpointsHTML}
        
        <div class="footer">
            <p>✨ BRONX OSINT API | Powered by <strong style="color: #00ff41;">@BRONX_ULTRA</strong></p>
            <p style="margin-top: 8px;">⚡ Response se 'by', 'channel', 'developer' auto-hide | '@BRONX_ULTRA' added</p>
            <p>🔄 Daily limit: 1000 requests/key | Resets at 2:00 AM IST only</p>
            <p style="margin-top: 8px;"><a href="/test">📡 Test API</a> | <a href="/quota?key=BRONX_KEY_2026">📊 Check Quota</a> | <a href="/keys">🔑 View Keys</a></p>
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
            setTimeout(() => toast.remove(), 2000);
        }
    </script>
</body>
</html>`;
    
    function escapeHtml(str) {
        return str.replace(/[&<>]/g, function(m) {
            if (m === '&') return '&amp;';
            if (m === '<') return '&lt;';
            if (m === '>') return '&gt;';
            return m;
        });
    }
    
    res.send(html);
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
        rate_limit: "1000 requests/day, resets at 2:00 AM IST only"
    });
});

app.get('/test', (req, res) => {
    res.json({ status: '✅ BRONX OSINT API Running', credit: '@BRONX_ULTRA', time: new Date().toISOString() });
});

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

app.get('/keys', (req, res) => {
    const publicKeys = {};
    for (const [key, data] of Object.entries(VALID_KEYS)) {
        publicKeys[key] = {
            name: data.name,
            scopes: data.scopes,
            dailyLimit: data.dailyLimit,
            expiresAt: data.expiresAt ? new Date(data.expiresAt).toLocaleDateString() : 'Never',
            type: data.type
        };
    }
    res.json({ success: true, keys: publicKeys, contact: "@BRONX_ULTRA" });
});

module.exports = app;
