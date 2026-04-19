const axios = require('axios');

// ========== CONFIG ==========
const REAL_API_BASE = 'https://ft-osint.onrender.com/api';
const REAL_API_KEY = 'nobita';

// ========== API KEYS WITH SCOPES (Per-Endpoint Access Control) ==========
// Scope names = endpoint names (number, aadhar, name, numv2, adv, upi, ifsc, pan, pincode, ip, vehicle, rc, ff, bgmi, insta, git, tg, pk, pkv2)
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
  if (!keyData) return { valid: false, reason: 'Invalid API Key' };
  if (keyData.scopes.includes('*')) return { valid: true, keyData };
  if (keyData.scopes.includes(endpoint)) return { valid: true, keyData };
  return { valid: false, reason: `This key does not have access to '${endpoint}' endpoint. Allowed: ${keyData.scopes.join(', ')}` };
}

// ========== HTML UI (Beautiful Documentation) ==========
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
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>BRONX OSINT API - Private Intelligence API</title>
    <link href="https://fonts.googleapis.com/css2?family=Inter:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400&display=swap" rel="stylesheet">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: 'Inter', sans-serif;
            background: #0a0c10;
            color: #e4e6eb;
            line-height: 1.6;
        }
        .container { max-width: 1400px; margin: 0 auto; padding: 20px; }
        
        /* Header */
        .header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 20px 0;
            border-bottom: 1px solid #2a2e35;
            flex-wrap: wrap;
            gap: 20px;
        }
        .logo h1 {
            background: linear-gradient(135deg, #ff6b35, #f7931e);
            -webkit-background-clip: text;
            background-clip: text;
            color: transparent;
            font-size: 28px;
        }
        .logo p { color: #8e95a5; font-size: 14px; }
        .stats {
            display: flex;
            gap: 30px;
            background: #13161c;
            padding: 12px 24px;
            border-radius: 16px;
            border: 1px solid #2a2e35;
        }
        .stat-item { text-align: center; }
        .stat-value { font-size: 28px; font-weight: 700; color: #f7931e; }
        .stat-label { font-size: 12px; color: #8e95a5; }
        .mode-toggle {
            background: #13161c;
            padding: 8px 16px;
            border-radius: 40px;
            cursor: pointer;
            border: 1px solid #2a2e35;
        }
        
        /* Theme Switch */
        body.light-mode {
            background: #f5f7fb;
            color: #1a1a2e;
        }
        body.light-mode .stats, body.light-mode .mode-toggle, body.light-mode .card, 
        body.light-mode .endpoint-card, body.light-mode .auth-box, body.light-mode .code-block {
            background: #ffffff;
            border-color: #e0e4e8;
        }
        body.light-mode .stat-label, body.light-mode .desc-text { color: #5a6070; }
        body.light-mode .endpoint-url { color: #1a73e8; }
        
        /* Cards */
        .hero {
            background: linear-gradient(135deg, #13161c 0%, #0d0f14 100%);
            border-radius: 24px;
            padding: 40px;
            margin: 30px 0;
            border: 1px solid #2a2e35;
            text-align: center;
        }
        body.light-mode .hero { background: linear-gradient(135deg, #e8ecf2 0%, #dfe4ec 100%); border-color: #d0d5dc; }
        
        .badge {
            display: inline-block;
            background: #f7931e20;
            color: #f7931e;
            padding: 6px 14px;
            border-radius: 40px;
            font-size: 12px;
            margin-bottom: 20px;
        }
        .feature-grid {
            display: flex;
            justify-content: center;
            gap: 40px;
            margin-top: 30px;
            flex-wrap: wrap;
        }
        .feature { text-align: center; }
        .feature-value { font-size: 32px; font-weight: 700; color: #f7931e; }
        
        .auth-section {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 20px;
            margin: 30px 0;
        }
        .auth-box {
            background: #13161c;
            border-radius: 16px;
            padding: 24px;
            border: 1px solid #2a2e35;
        }
        .code-block {
            background: #0a0c10;
            padding: 16px;
            border-radius: 12px;
            font-family: 'Monaco', monospace;
            font-size: 13px;
            overflow-x: auto;
            margin-top: 12px;
            border: 1px solid #2a2e35;
        }
        body.light-mode .code-block { background: #f0f2f5; }
        
        .category {
            margin: 40px 0 20px;
            font-size: 24px;
            font-weight: 600;
            padding-left: 12px;
            border-left: 4px solid #f7931e;
        }
        .endpoints-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
        }
        .endpoint-card {
            background: #13161c;
            border-radius: 16px;
            padding: 20px;
            border: 1px solid #2a2e35;
            transition: all 0.2s;
        }
        .endpoint-card:hover { border-color: #f7931e; transform: translateY(-2px); }
        .method { 
            display: inline-block;
            background: #f7931e20;
            color: #f7931e;
            padding: 4px 10px;
            border-radius: 8px;
            font-size: 11px;
            font-weight: 600;
        }
        .endpoint-name {
            font-size: 20px;
            font-weight: 600;
            margin: 12px 0 8px;
        }
        .endpoint-url {
            font-family: monospace;
            font-size: 12px;
            color: #6c9bd4;
            word-break: break-all;
            background: #0a0c10;
            padding: 8px;
            border-radius: 8px;
            margin: 10px 0;
        }
        body.light-mode .endpoint-url { background: #eef2f7; }
        .param { font-size: 12px; color: #8e95a5; margin-top: 8px; }
        .example-link {
            display: inline-block;
            margin-top: 12px;
            color: #f7931e;
            text-decoration: none;
            font-size: 12px;
        }
        .footer {
            text-align: center;
            padding: 40px 0;
            border-top: 1px solid #2a2e35;
            margin-top: 40px;
            color: #8e95a5;
        }
        button { background: none; border: none; color: inherit; cursor: pointer; }
        @media (max-width: 768px) {
            .auth-section { grid-template-columns: 1fr; }
            .header { flex-direction: column; text-align: center; }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="logo">
                <h1>🔍 BRONX OSINT API</h1>
                <p>Private Intelligence API · Fast & Reliable Data Intelligence</p>
            </div>
            <div class="stats">
                <div class="stat-item"><div class="stat-value">${Object.keys(endpoints).length}</div><div class="stat-label">ENDPOINTS</div></div>
                <div class="stat-item"><div class="stat-value">JSON</div><div class="stat-label">RESPONSES</div></div>
                <div class="stat-item"><div class="stat-value">KEY</div><div class="stat-label">ACCESS</div></div>
            </div>
            <button class="mode-toggle" onclick="toggleMode()">🌓 LIGHT MODE</button>
        </div>

        <div class="hero">
            <span class="badge">⚡ Premium OSINT Infrastructure</span>
            <h2 style="font-size: 32px; margin-bottom: 16px;">Private OSINT APIs for fast and reliable data intelligence.</h2>
            <p style="color: #8e95a5; max-width: 600px; margin: 0 auto;">Optimized performance. Controlled access. Real results.</p>
            <div class="feature-grid">
                <div class="feature"><div class="feature-value">20+</div><div>Endpoints</div></div>
                <div class="feature"><div class="feature-value">JSON</div><div>Responses</div></div>
                <div class="feature"><div class="feature-value">Key-Based</div><div>Access</div></div>
            </div>
        </div>

        <div class="auth-section">
            <div class="auth-box">
                <h3>🔐 AUTHENTICATION</h3>
                <p style="color: #8e95a5; margin: 8px 0;">API Key Required — Pass via query param or header</p>
                <div class="code-block">GET /api/key-bronx/number?key=YOUR_KEY&num=9876543210</div>
                <div class="code-block" style="margin-top: 8px;">curl -H "X-API-Key: YOUR_KEY" https://bronx-osint.onrender.com/api/key-bronx/number?num=9876543210</div>
            </div>
            <div class="auth-box">
                <h3>📋 AVAILABLE KEYS</h3>
                ${Object.entries(VALID_KEYS).map(([key, data]) => `
                    <div style="margin-bottom: 12px; border-bottom: 1px solid #2a2e35; padding-bottom: 8px;">
                        <strong>${key}</strong> <span style="color: #8e95a5; font-size: 12px;">(${data.type})</span>
                        <div style="font-size: 12px; color: #6c9bd4;">→ ${data.scopes.includes('*') ? 'All Endpoints' : data.scopes.join(', ')}</div>
                    </div>
                `).join('')}
                <p style="font-size: 12px; color: #f7931e; margin-top: 12px;">💡 Contact @BRONX_ULTRA on Telegram to get keys</p>
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
                    <div class="endpoint-card">
                        <span class="method">GET</span>
                        <div class="endpoint-name">${ep.name.toUpperCase()}</div>
                        <div class="endpoint-url">/api/key-bronx/${ep.name}?key=KEY&${ep.param}=${ep.example}</div>
                        <p class="param">📌 ${ep.desc}</p>
                        <p class="param">🔑 Parameter: <strong>${ep.param}</strong> | Example: ${ep.example}</p>
                        <a href="#" onclick="return false;" class="example-link" data-endpoint="${ep.name}" data-param="${ep.param}" data-example="${ep.example}">📋 Copy Example URL →</a>
                    </div>
                `).join('')}
            </div>
        `).join('')}

        <div class="footer">
            <p>© 2026 BRONX OSINT API | Created by @BRONX_ULTRA</p>
            <p style="font-size: 12px;">⚡ Response se 'by', 'channel', 'developer' fields auto-hide ho jayenge aur '@BRONX_ULTRA' lagega</p>
        </div>
    </div>
    <script>
        function toggleMode() {
            document.body.classList.toggle('light-mode');
        }
        document.querySelectorAll('.example-link').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const ep = link.dataset.endpoint;
                const param = link.dataset.param;
                const example = link.dataset.example;
                const url = window.location.origin + '/api/key-bronx/' + ep + '?key=BRONX_MASTER_KEY&' + param + '=' + example;
                navigator.clipboard.writeText(url);
                alert('✅ URL copied!\\n\\n' + url);
            });
        });
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
    console.log(`📡 [${scopeCheck.keyData?.name || apiKey}] ${endpointName} -> ${paramValue}`);
    const response = await axios.get(realUrl, { timeout: 30000 });
    res.json(cleanResponse(response.data, endpointName));
  } catch (error) {
    console.error(`❌ ${endpointName} Error:`, error.message);
    if (error.response) {
      return res.status(error.response.status).json(cleanResponse(error.response.data, endpointName));
    }
    res.status(500).json({ success: false, error: error.message });
  }
};
