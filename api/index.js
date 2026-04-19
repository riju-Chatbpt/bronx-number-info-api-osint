const express = require('express');
const axios = require('axios');

const app = express();

// CONFIG
const REAL_API_BASE = 'https://ft-osint.onrender.com/api';
const REAL_API_KEY = 'nobita';

// VALID API KEYS
const VALID_KEYS = ['BRONX_KEY_2026', 'DEMO_KEY', 'test123', 'BRONX_MASTER_KEY'];

// Request limits storage (memory)
let requestCounts = {};

function getIndiaDate() {
    const now = new Date();
    const istOffset = 5.5 * 60 * 60 * 1000;
    const istDate = new Date(now.getTime() + istOffset);
    return istDate.toISOString().split('T')[0];
}

function checkLimit(key) {
    const today = getIndiaDate();
    if (!requestCounts[key]) {
        requestCounts[key] = { count: 0, date: today };
        return true;
    }
    if (requestCounts[key].date !== today) {
        requestCounts[key] = { count: 0, date: today };
        return true;
    }
    return requestCounts[key].count < 1000;
}

function incrementCount(key) {
    const today = getIndiaDate();
    if (!requestCounts[key] || requestCounts[key].date !== today) {
        requestCounts[key] = { count: 1, date: today };
    } else {
        requestCounts[key].count++;
    }
    return requestCounts[key].count;
}

// Clean response
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

// CORS
app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'X-API-Key, Content-Type');
    if (req.method === 'OPTIONS') return res.status(200).end();
    next();
});

app.use(express.json());

// API Key Middleware
function checkApiKey(req, res, next) {
    const key = req.query.key || req.headers['x-api-key'];
    if (!key) {
        return res.status(401).json({ success: false, error: "❌ API Key Required" });
    }
    if (!VALID_KEYS.includes(key)) {
        return res.status(403).json({ success: false, error: "❌ Invalid API Key" });
    }
    if (!checkLimit(key)) {
        return res.status(429).json({ success: false, error: "❌ Daily quota exceeded (1000/day). Resets at 2:00 AM IST" });
    }
    req.apiKey = key;
    next();
}

// Endpoints
const endpoints = [
    { path: '/number', param: 'num', example: '9876543210', desc: 'Indian Mobile Number Lookup' },
    { path: '/aadhar', param: 'num', example: '393933081942', desc: 'Aadhaar Number Lookup' },
    { path: '/name', param: 'name', example: 'abhiraaj', desc: 'Search by Name' },
    { path: '/numv2', param: 'num', example: '6205949840', desc: 'Number Info v2' },
    { path: '/adv', param: 'num', example: '9876543210', desc: 'Advanced Phone Lookup' },
    { path: '/upi', param: 'upi', example: 'example@ybl', desc: 'UPI ID Verification' },
    { path: '/ifsc', param: 'ifsc', example: 'SBIN0001234', desc: 'IFSC Code Details' },
    { path: '/pan', param: 'pan', example: 'AXDPR2606K', desc: 'PAN to GST Search' },
    { path: '/pincode', param: 'pin', example: '110001', desc: 'Pincode Details' },
    { path: '/ip', param: 'ip', example: '8.8.8.8', desc: 'IP Address Lookup' },
    { path: '/vehicle', param: 'vehicle', example: 'MH02FZ0555', desc: 'Vehicle Registration Info' },
    { path: '/rc', param: 'owner', example: 'UP92P2111', desc: 'RC Owner Details' },
    { path: '/ff', param: 'uid', example: '123456789', desc: 'Free Fire Player Info' },
    { path: '/bgmi', param: 'uid', example: '5121439477', desc: 'BGMI Player Info' },
    { path: '/insta', param: 'username', example: 'cristiano', desc: 'Instagram Profile Data' },
    { path: '/git', param: 'username', example: 'ftgamer2', desc: 'GitHub Profile' },
    { path: '/tg', param: 'info', example: 'JAUUOWNER', desc: 'Telegram User Lookup' },
    { path: '/pk', param: 'num', example: '03331234567', desc: 'Pakistan Number v1' },
    { path: '/pkv2', param: 'num', example: '3359736848', desc: 'Pakistan Number v2' }
];

// Proxy routes
app.use('/api/key-bronx', checkApiKey);

endpoints.forEach(ep => {
    app.get(`/api/key-bronx${ep.path}`, async (req, res) => {
        const paramValue = req.query[ep.param];
        const apiKey = req.apiKey;
        
        if (!paramValue) {
            return res.status(400).json({
                success: false,
                error: `Missing ${ep.param}`,
                example: `/api/key-bronx${ep.path}?key=YOUR_KEY&${ep.param}=${ep.example}`
            });
        }
        
        try {
            const realUrl = `${REAL_API_BASE}${ep.path}?key=${REAL_API_KEY}&${ep.param}=${paramValue}`;
            console.log(`📡 ${ep.path} -> ${paramValue}`);
            
            const response = await axios.get(realUrl, { timeout: 30000 });
            const used = incrementCount(apiKey);
            
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
            res.status(500).json({ success: false, error: error.message });
        }
    });
});

// Root route
app.get('/', (req, res) => {
    res.json({
        success: true,
        message: "✅ BRONX OSINT API is running!",
        credit: "@BRONX_ULTRA",
        base_url: "https://your-domain.vercel.app",
        endpoints: endpoints.map(ep => ({
            name: ep.path.replace('/', ''),
            url: `/api/key-bronx${ep.path}?key=YOUR_KEY&${ep.param}=${ep.example}`,
            description: ep.desc
        })),
        rate_limit: {
            limit: 1000,
            reset: "2:00 AM IST",
            per: "key/day"
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
    if (!key) return res.status(400).json({ error: "Missing key" });
    if (!VALID_KEYS.includes(key)) return res.status(403).json({ error: "Invalid key" });
    
    const today = getIndiaDate();
    const used = requestCounts[key] && requestCounts[key].date === today ? requestCounts[key].count : 0;
    res.json({
        success: true,
        key: key.substring(0, 8) + '...',
        limit: 1000,
        used: used,
        remaining: 1000 - used,
        reset: "2:00 AM IST",
        date: today
    });
});

module.exports = app;
