const express = require('express');
const axios = require('axios');
const cors = require('cors');
const mysql = require('mysql2/promise');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

// Project-root .env loader. API key values from this project's .env are
// authoritative so a stale Windows user-level placeholder cannot mask them.
// Secrets remain server-side and are never printed.
const envPath = path.join(__dirname, '.env');
const projectEnv = Object.create(null);
if (fs.existsSync(envPath)) {
  const envText = fs.readFileSync(envPath, 'utf8').replace(/^\uFEFF/, '');
  for (const rawLine of envText.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const match = line.match(/^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (!match) continue;
    let value = match[2].trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    } else {
      value = value.replace(/\s+#.*$/, '').trim();
    }
    projectEnv[match[1]] = value;
    // .env values win for this local project, avoiding stale environment values.
    process.env[match[1]] = value;
  }
}
const app = express();
app.disable('x-powered-by');
app.use(cors({ origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173', credentials: true }));
app.use(express.json({ limit: '4mb' }));
const PORT = Number(process.env.PORT || 3000);
const COOKIE = 'louf_session';
const SESSION_DAYS = 7;
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost', port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'root', password: process.env.DB_PASSWORD || '', database: process.env.DB_NAME || 'louf',
  waitForConnections: true, connectionLimit: 10, queueLimit: 0, charset: 'utf8mb4'
});
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
function cookies(header = '') {
  const result = {};
  for (const item of header.split(';')) { const i = item.indexOf('='); if (i > 0) { try { result[item.slice(0, i).trim()] = decodeURIComponent(item.slice(i + 1).trim()); } catch {} } }
  return result;
}
function setCookie(res, token, seconds) {
  const secure = process.env.COOKIE_SECURE === 'true' ? '; Secure' : '';
  res.setHeader('Set-Cookie', `${COOKIE}=${encodeURIComponent(token)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${seconds}${secure}`);
}
function publicUser(u) { return { id: u.id, fullName: u.full_name, username: u.username, email: u.email, role: u.role || 'user', bio: u.bio || '', phone: u.phone || '', location: u.location || '', website: u.website || '', profileImage: u.profile_image || '', createdAt: u.created_at }; }
function configuredKey(value) { const key = typeof value === 'string' ? value.trim() : ''; return Boolean(key && !/^(replace|your|put_|paste_|insert_|change_me|placeholder|set_a_new|sk-xxx|api_key_here)/i.test(key) && !/placeholder|your[_ -]?api[_ -]?key|replace[_ -]?with/i.test(key)); }
function sendDbError(res, e) { console.error('Database error:', e.message); return res.status(503).json({ success: false, error: 'Database unavailable. Check MySQL is running and .env credentials/database are correct.' }); }
function scrypt(password, salt) { return new Promise((resolve, reject) => crypto.scrypt(password, salt, 64, (e, key) => e ? reject(e) : resolve(key.toString('hex')))); }
function verifyPassword(password, stored) {
  if (!stored || !stored.startsWith('scrypt:')) return Promise.resolve(false);
  const [, salt, expectedHex] = stored.split(':');
  return new Promise((resolve, reject) => crypto.scrypt(password, salt, 64, (e, key) => {
    if (e) return reject(e); const actual = key; const expected = Buffer.from(expectedHex || '', 'hex');
    resolve(expected.length === actual.length && crypto.timingSafeEqual(expected, actual));
  }));
}
async function createSession(userId, res) {
  const token = crypto.randomBytes(32).toString('hex');
  const expires = new Date(Date.now() + SESSION_DAYS * 86400000);
  await pool.execute('INSERT INTO sessions (user_id, token_hash, expires_at) VALUES (?, ?, ?)', [userId, hash(token), expires]);
  setCookie(res, token, SESSION_DAYS * 86400);
}
async function sessionUser(req) {
  const token = cookies(req.headers.cookie)[COOKIE];
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
  const [rows] = await pool.execute(`SELECT u.id,u.full_name,u.username,u.email,u.role,u.bio,u.phone,u.location,u.website,u.profile_image,u.created_at FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>CURRENT_TIMESTAMP LIMIT 1`, [hash(token)]);
  return rows[0] || null;
}
async function requireUser(req, res, next) {
  try { const user = await sessionUser(req); if (!user) return res.status(401).json({ success: false, error: 'Please sign in first.' }); req.user = user; next(); }
  catch (e) { sendDbError(res, e); }
}
function requireAdmin(req, res, next) { if (req.user?.role !== 'admin') return res.status(403).json({ success: false, error: 'Administrator access required.' }); next(); }
async function ensureSchema() {
  const statements = [
    `CREATE TABLE IF NOT EXISTS users (id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY, full_name VARCHAR(100) NOT NULL, username VARCHAR(50) NOT NULL, email VARCHAR(255) NOT NULL, password_hash VARCHAR(255) NOT NULL, role ENUM('user','admin') NOT NULL DEFAULT 'user', bio VARCHAR(500) NOT NULL DEFAULT '', phone VARCHAR(30) NOT NULL DEFAULT '', location VARCHAR(120) NOT NULL DEFAULT '', website VARCHAR(255) NOT NULL DEFAULT '', profile_image MEDIUMTEXT NULL, created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE KEY uq_users_username(username), UNIQUE KEY uq_users_email(email)) ENGINE=InnoDB`,
    `CREATE TABLE IF NOT EXISTS sessions (id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY, user_id BIGINT UNSIGNED NOT NULL, token_hash CHAR(64) NOT NULL UNIQUE, expires_at DATETIME NOT NULL, created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, KEY idx_sessions_expiry(expires_at), CONSTRAINT fk_sessions_user FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE) ENGINE=InnoDB`,
    `CREATE TABLE IF NOT EXISTS conversations (id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY, user_id BIGINT UNSIGNED NOT NULL, title VARCHAR(255) NOT NULL DEFAULT 'New chat', provider VARCHAR(40) NOT NULL DEFAULT 'openai', created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, KEY idx_conv_user(user_id,updated_at), CONSTRAINT fk_conv_user FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE) ENGINE=InnoDB`,
    `CREATE TABLE IF NOT EXISTS messages (id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY, conversation_id BIGINT UNSIGNED NOT NULL, role ENUM('user','assistant','system') NOT NULL, content MEDIUMTEXT NOT NULL, created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, KEY idx_msg_conv(conversation_id,id), CONSTRAINT fk_msg_conv FOREIGN KEY(conversation_id) REFERENCES conversations(id) ON DELETE CASCADE) ENGINE=InnoDB`,
    `CREATE TABLE IF NOT EXISTS system_directives (id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY, directive TEXT NOT NULL, enabled BOOLEAN NOT NULL DEFAULT TRUE, updated_by BIGINT UNSIGNED NULL, created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT fk_directive_user FOREIGN KEY(updated_by) REFERENCES users(id) ON DELETE SET NULL) ENGINE=InnoDB`,
    `CREATE TABLE IF NOT EXISTS feature_flags (id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY, feature_key VARCHAR(100) NOT NULL UNIQUE, label VARCHAR(150) NOT NULL, enabled BOOLEAN NOT NULL DEFAULT TRUE, updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP) ENGINE=InnoDB`,
    `CREATE TABLE IF NOT EXISTS activity_logs (id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY, user_id BIGINT UNSIGNED NULL, action VARCHAR(150) NOT NULL, details VARCHAR(500) NULL, created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, KEY idx_activity_created(created_at), CONSTRAINT fk_activity_user FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE SET NULL) ENGINE=InnoDB`
  ];
  for (const sql of statements) await pool.query(sql);
  // Upgrade databases created by earlier versions without newer columns.
  const [roleCol] = await pool.query("SHOW COLUMNS FROM users LIKE 'role'");
  if (!roleCol.length) await pool.query("ALTER TABLE users ADD COLUMN role ENUM('user','admin') NOT NULL DEFAULT 'user'");
  // Profile fields for existing databases.
  const profileColumns = [
    ['bio', "VARCHAR(500) NOT NULL DEFAULT ''"],
    ['phone', "VARCHAR(30) NOT NULL DEFAULT ''"],
    ['location', "VARCHAR(120) NOT NULL DEFAULT ''"],
    ['website', "VARCHAR(255) NOT NULL DEFAULT ''"],
    ['profile_image', 'MEDIUMTEXT NULL']
  ];
  for (const [column, definition] of profileColumns) {
    const [found] = await pool.query(`SHOW COLUMNS FROM users LIKE '${column}'`);
    if (!found.length) await pool.query(`ALTER TABLE users ADD COLUMN ${column} ${definition}`);
  }

  // CREATE TABLE IF NOT EXISTS does not alter an existing conversations table.
  // Add provider safely when upgrading an older database.
  const [conversationProviderCol] = await pool.query("SHOW COLUMNS FROM conversations LIKE 'provider'");
  if (!conversationProviderCol.length) {
    await pool.query("ALTER TABLE conversations ADD COLUMN provider VARCHAR(40) NOT NULL DEFAULT 'openai' AFTER title");
  }

  // Some app versions store the selected provider on each message instead.
  const [messageProviderCol] = await pool.query("SHOW COLUMNS FROM messages LIKE 'provider'");
  if (!messageProviderCol.length) {
    await pool.query("ALTER TABLE messages ADD COLUMN provider VARCHAR(40) NULL AFTER role");
  }

  const defaults = [['chat_history','Chat history',1],['user_profiles','User profiles',1],['admin_dashboard','Admin dashboard',1],['global_directives','Global AI directives',1],['provider_switching','AI provider switching',1],['activity_logs','Activity logs',1]];
  for (const [key,label,enabled] of defaults) await pool.execute('INSERT IGNORE INTO feature_flags (feature_key,label,enabled) VALUES (?,?,?)',[key,label,enabled]);
  await bootstrapAdmin();
}
async function bootstrapAdmin() {
  const email = (process.env.ADMIN_EMAIL || 'umuhireobedfaustin1@gmail.com').toLowerCase();
  const username = process.env.ADMIN_USERNAME || 'umux';
  const name = process.env.ADMIN_NAME || 'umux';
  const password = process.env.ADMIN_PASSWORD;
  if (!password || password.length < 8) {
    console.warn('Admin bootstrap skipped: set ADMIN_PASSWORD (at least 8 characters) in .env.'); return;
  }
  const [rows] = await pool.execute('SELECT id FROM users WHERE email=? OR username=? LIMIT 1',[email,username]);
  const salt = crypto.randomBytes(16).toString('hex');
  const passwordHash = `scrypt:${salt}:${await scrypt(password,salt)}`;
  if (rows.length) await pool.execute("UPDATE users SET full_name=?,username=?,email=?,password_hash=?,role='admin' WHERE id=?",[name,username,email,passwordHash,rows[0].id]);
  else await pool.execute("INSERT INTO users(full_name,username,email,password_hash,role) VALUES(?,?,?,?,'admin')",[name,username,email,passwordHash]);
}

app.get('/api/health', async (_req,res) => {
  let database = 'disconnected'; try { await pool.query('SELECT 1'); database='connected'; } catch {}
  const provider = (process.env.AI_PROVIDER || 'openai').toLowerCase();
  const openaiConfigured = configuredKey(process.env.OPENAI_API_KEY);
  const deepseekConfigured = configuredKey(process.env.DEEPSEEK_API_KEY);
  const keyPresent = provider === 'deepseek' ? deepseekConfigured : openaiConfigured;
  res.json({success:true,message:'LOUF AI server is running',provider,model:process.env.AI_MODEL || (provider==='deepseek'?'deepseek-chat':'gpt-4o-mini'),keyConfigured:keyPresent,openaiConfigured,deepseekConfigured,envFileFound:fs.existsSync(envPath),envFilePath:envPath,database});
});
app.post('/api/auth/register', async (req,res) => {
  const fullName = typeof req.body.fullName==='string' ? req.body.fullName.trim():'';
  const username = typeof req.body.username==='string' ? req.body.username.trim():'';
  const email = typeof req.body.email==='string' ? req.body.email.trim().toLowerCase():'';
  const password = typeof req.body.password==='string' ? req.body.password:'';
  if (!fullName || fullName.length>100) return res.status(400).json({success:false,error:'Enter your name (up to 100 characters).'});
  if (!/^[A-Za-z0-9_.-]{3,50}$/.test(username)) return res.status(400).json({success:false,error:'Username must be 3–50 letters, numbers, dots, underscores, or hyphens.'});
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length>255) return res.status(400).json({success:false,error:'Enter a valid email address.'});
  if (password.length<8 || password.length>200) return res.status(400).json({success:false,error:'Password must be at least 8 characters.'});
  try {
    const [existing]=await pool.execute('SELECT id FROM users WHERE username=? OR email=? LIMIT 1',[username,email]);
    if(existing.length) return res.status(409).json({success:false,error:'That username or email is already registered.'});
    const salt=crypto.randomBytes(16).toString('hex'); const passwordHash=`scrypt:${salt}:${await scrypt(password,salt)}`;
    const [result]=await pool.execute('INSERT INTO users(full_name,username,email,password_hash) VALUES(?,?,?,?)',[fullName,username,email,passwordHash]);
    await createSession(result.insertId,res); await pool.execute('INSERT INTO activity_logs(user_id,action,details) VALUES(?,?,?)',[result.insertId,'account.register','New account registered']);
    const [users]=await pool.execute('SELECT id,full_name,username,email,role,created_at FROM users WHERE id=?',[result.insertId]);
    res.status(201).json({success:true,user:publicUser(users[0])});
  } catch(e) { if(e.code==='ER_DUP_ENTRY') return res.status(409).json({success:false,error:'That username or email is already registered.'}); sendDbError(res,e); }
});
app.post('/api/auth/login', async (req,res) => {
  const username=typeof req.body.username==='string'?req.body.username.trim():''; const password=typeof req.body.password==='string'?req.body.password:'';
  if(!username||!password) return res.status(400).json({success:false,error:'Enter your username and password.'});
  try {
    const [rows]=await pool.execute('SELECT * FROM users WHERE username=? OR email=? LIMIT 1',[username,username.toLowerCase()]); const user=rows[0];
    if(!user || !(await verifyPassword(password,user.password_hash))) return res.status(401).json({success:false,error:'Incorrect username/email or password.'});
    await createSession(user.id,res); await pool.execute('INSERT INTO activity_logs(user_id,action,details) VALUES(?,?,?)',[user.id,'account.login','Successful login']);
    res.json({success:true,user:publicUser(user)});
  } catch(e) { sendDbError(res,e); }
});
app.get('/api/auth/me', async (req,res) => { try { const user=await sessionUser(req); if(!user)return res.status(401).json({success:false,error:'Not signed in.'}); res.json({success:true,user:publicUser(user)}); } catch(e){sendDbError(res,e);} });
app.patch('/api/auth/profile', requireUser, async (req,res) => {
  const fullName=typeof req.body.fullName==='string'?req.body.fullName.trim():'';
  const email=typeof req.body.email==='string'?req.body.email.trim().toLowerCase():'';
  const bio=typeof req.body.bio==='string'?req.body.bio.trim():'';
  const phone=typeof req.body.phone==='string'?req.body.phone.trim():'';
  const location=typeof req.body.location==='string'?req.body.location.trim():'';
  const website=typeof req.body.website==='string'?req.body.website.trim():'';
  const profileImage=typeof req.body.profileImage==='string'?req.body.profileImage:'';
  if(!fullName||fullName.length>100||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({success:false,error:'Enter a valid name and email.'});
  if(bio.length>500||phone.length>30||location.length>120||website.length>255) return res.status(400).json({success:false,error:'One or more profile fields are too long.'});
  if(profileImage && (!/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(profileImage)||profileImage.length>2200000)) return res.status(400).json({success:false,error:'Profile image must be a PNG, JPG or WebP image smaller than 1.5 MB.'});
  try {
    await pool.execute('UPDATE users SET full_name=?,email=?,bio=?,phone=?,location=?,website=?,profile_image=? WHERE id=?',[fullName,email,bio,phone,location,website,profileImage||null,req.user.id]);
    const [r]=await pool.execute('SELECT id,full_name,username,email,role,bio,phone,location,website,profile_image,created_at FROM users WHERE id=?',[req.user.id]);
    res.json({success:true,user:publicUser(r[0])});
  } catch(e) { if(e.code==='ER_DUP_ENTRY') return res.status(409).json({success:false,error:'That email is already in use.'}); sendDbError(res,e); }
});
app.post('/api/auth/logout', async(req,res)=>{const token=cookies(req.headers.cookie)[COOKIE];try{if(token&&/^[a-f0-9]{64}$/.test(token))await pool.execute('DELETE FROM sessions WHERE token_hash=?',[hash(token)]);setCookie(res,'',0);res.json({success:true});}catch(e){setCookie(res,'',0);sendDbError(res,e);}});

async function ensureConversation(userId, conversationId, firstMessage, provider) {
  if (conversationId) {
    const [rows]=await pool.execute('SELECT id,title FROM conversations WHERE id=? AND user_id=?',[conversationId,userId]);
    if(!rows.length) throw Object.assign(new Error('Conversation not found.'),{status:404});
    return rows[0];
  }
  const title=firstMessage.trim().replace(/\s+/g,' ').slice(0,70)||'New chat';
  const [r]=await pool.execute('INSERT INTO conversations(user_id,title,provider) VALUES(?,?,?)',[userId,title,provider]);
  return {id:r.insertId,title};
}
async function activeDirective() {
  const [rows]=await pool.execute('SELECT directive FROM system_directives WHERE enabled=1 ORDER BY id DESC LIMIT 10');
  return rows.map(r=>r.directive).join('\n\n');
}
async function requestAI(messages, requestedProvider) {
  const provider = ['openai','deepseek'].includes(requestedProvider) ? requestedProvider : (process.env.AI_PROVIDER || 'openai').toLowerCase();
  const configs = {
    openai: { key: process.env.OPENAI_API_KEY, url: process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1/chat/completions', model: process.env.OPENAI_MODEL || process.env.AI_MODEL || 'gpt-4o-mini' },
    deepseek: { key: process.env.DEEPSEEK_API_KEY, url: process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com/chat/completions', model: process.env.DEEPSEEK_MODEL || 'deepseek-chat' }
  };
  const config=configs[provider];
  if(!configuredKey(config?.key)) throw Object.assign(new Error(`LOUF AI loaded its environment from: ${envPath}. The ${provider} key is not configured in that running server. Open that exact .env file and set ${provider==='openai'?'OPENAI_API_KEY':'DEEPSEEK_API_KEY'} to a valid key, without angle brackets or placeholder text. Save it, stop every old LOUF AI server, and start this project's START_LOUF_AI.bat again. The app cannot generate a provider key for you; never paste it into chat or frontend code.`),{status:503});
  const response=await axios.post(config.url,{model:config.model,messages,temperature:0.7}, {headers:{Authorization:`Bearer ${config.key}`,'Content-Type':'application/json'},timeout:90000});
  const reply=response.data?.choices?.[0]?.message?.content;
  if(typeof reply!=='string'||!reply.trim())throw Object.assign(new Error(`${provider} returned an empty response.`),{status:502});
  return {reply:reply.trim(),provider,model:config.model,usage:response.data?.usage||null};
}
app.post('/api/chat', requireUser, async(req,res)=>{
  const text=typeof req.body.message==='string'?req.body.message.trim():''; const requestedProvider=req.body.provider;
  if(!text)return res.status(400).json({success:false,error:'Write a message first.'});
  if(text.length>12000)return res.status(413).json({success:false,error:'Message is too long (maximum 12,000 characters).'});
  try {
    const provider=['openai','deepseek'].includes(requestedProvider)?requestedProvider:(process.env.AI_PROVIDER||'openai').toLowerCase();
    const conversation=await ensureConversation(req.user.id,req.body.conversationId,text,provider);
    await pool.execute('INSERT INTO messages(conversation_id,role,content) VALUES(?,?,?)',[conversation.id,'user',text]);
    const [history]=await pool.execute('SELECT role,content FROM messages WHERE conversation_id=? ORDER BY id DESC LIMIT 20',[conversation.id]);
    const directive=await activeDirective();
    const system=`You are LOUF AI, a helpful, accurate assistant. Answer the user's actual question directly, in a relevant and useful way. If unsure, say so.\n${directive?`Administrator instructions (follow unless they conflict with safety or higher-priority rules):\n${directive}`:''}`;
    const result=await requestAI([{role:'system',content:system},...history.reverse().map(m=>({role:m.role,content:m.content}))],provider);
    await pool.execute('INSERT INTO messages(conversation_id,role,content) VALUES(?,?,?)',[conversation.id,'assistant',result.reply]);
    await pool.execute('UPDATE conversations SET provider=? WHERE id=?',[result.provider,conversation.id]);
    res.json({success:true,reply:result.reply,conversationId:conversation.id,provider:result.provider,model:result.model});
  } catch(e) {
    console.error('Chat request failed:',e.response?.data?.error?.message||e.message);
    const status=e.status|| (e.response?.status===401?502:e.response?.status===429?429:502);
    const message=e.response?.data?.error?.message || e.message || 'AI provider request failed. Check API key, quota, provider and internet connection.';
    res.status(status).json({success:false,error:message});
  }
});
app.get('/api/conversations', requireUser, async(req,res)=>{try{const [rows]=await pool.execute('SELECT id,title,provider,created_at,updated_at FROM conversations WHERE user_id=? ORDER BY updated_at DESC LIMIT 100',[req.user.id]);res.json({success:true,conversations:rows});}catch(e){sendDbError(res,e);}});
app.patch('/api/conversations/:id', requireUser, async(req,res)=>{const title=typeof req.body.title==='string'?req.body.title.trim().replace(/\s+/g,' '):'';if(!title||title.length>255)return res.status(400).json({success:false,error:'Chat title must be 1–255 characters.'});try{const [r]=await pool.execute('UPDATE conversations SET title=? WHERE id=? AND user_id=?',[title,req.params.id,req.user.id]);if(!r.affectedRows)return res.status(404).json({success:false,error:'Conversation not found.'});res.json({success:true,title});}catch(e){sendDbError(res,e);}});
app.get('/api/conversations/:id/messages', requireUser, async(req,res)=>{try{const [owned]=await pool.execute('SELECT id FROM conversations WHERE id=? AND user_id=?',[req.params.id,req.user.id]);if(!owned.length)return res.status(404).json({success:false,error:'Conversation not found.'});const [messages]=await pool.execute('SELECT id,role,content,created_at FROM messages WHERE conversation_id=? ORDER BY id',[req.params.id]);res.json({success:true,messages});}catch(e){sendDbError(res,e);}});
app.delete('/api/conversations/:id', requireUser, async(req,res)=>{try{const [r]=await pool.execute('DELETE FROM conversations WHERE id=? AND user_id=?',[req.params.id,req.user.id]);if(!r.affectedRows)return res.status(404).json({success:false,error:'Conversation not found.'});res.json({success:true});}catch(e){sendDbError(res,e);}});

app.get('/api/admin/overview',requireUser,requireAdmin,async(_req,res)=>{try{const [[users]]=await pool.query('SELECT COUNT(*) count FROM users');const [[chats]]=await pool.query('SELECT COUNT(*) count FROM conversations');const [[msgs]]=await pool.query('SELECT COUNT(*) count FROM messages');const [[admins]]=await pool.query("SELECT COUNT(*) count FROM users WHERE role='admin'");res.json({success:true,stats:{users:users.count,chats:chats.count,messages:msgs.count,admins:admins.count}});}catch(e){sendDbError(res,e);}});
app.get('/api/admin/users',requireUser,requireAdmin,async(req,res)=>{try{const q=`%${String(req.query.q||'').slice(0,80)}%`;const [rows]=await pool.execute('SELECT id,full_name,username,email,role,created_at FROM users WHERE username LIKE ? OR email LIKE ? OR full_name LIKE ? ORDER BY created_at DESC LIMIT 200',[q,q,q]);res.json({success:true,users:rows.map(publicUser)});}catch(e){sendDbError(res,e);}});
app.patch('/api/admin/users/:id/role',requireUser,requireAdmin,async(req,res)=>{const role=req.body.role;if(!['user','admin'].includes(role))return res.status(400).json({success:false,error:'Role must be user or admin.'});if(Number(req.params.id)===Number(req.user.id)&&role!=='admin')return res.status(400).json({success:false,error:'You cannot remove your own administrator role.'});try{await pool.execute('UPDATE users SET role=? WHERE id=?',[role,req.params.id]);res.json({success:true});}catch(e){sendDbError(res,e);}});
app.delete('/api/admin/users/:id',requireUser,requireAdmin,async(req,res)=>{if(Number(req.params.id)===Number(req.user.id))return res.status(400).json({success:false,error:'You cannot delete your own account while signed in.'});try{const [r]=await pool.execute('DELETE FROM users WHERE id=?',[req.params.id]);if(!r.affectedRows)return res.status(404).json({success:false,error:'User not found.'});res.json({success:true});}catch(e){sendDbError(res,e);}});
app.get('/api/admin/directives',requireUser,requireAdmin,async(_req,res)=>{try{const [rows]=await pool.query('SELECT id,directive,enabled,created_at FROM system_directives ORDER BY id DESC');res.json({success:true,directives:rows});}catch(e){sendDbError(res,e);}});
app.post('/api/admin/directives',requireUser,requireAdmin,async(req,res)=>{const directive=typeof req.body.directive==='string'?req.body.directive.trim():'';if(!directive||directive.length>10000)return res.status(400).json({success:false,error:'Directive must be 1–10,000 characters.'});try{const [r]=await pool.execute('INSERT INTO system_directives(directive,updated_by) VALUES(?,?)',[directive,req.user.id]);res.status(201).json({success:true,id:r.insertId});}catch(e){sendDbError(res,e);}});
app.patch('/api/admin/directives/:id',requireUser,requireAdmin,async(req,res)=>{try{await pool.execute('UPDATE system_directives SET enabled=? WHERE id=?',[req.body.enabled?1:0,req.params.id]);res.json({success:true});}catch(e){sendDbError(res,e);}});
app.delete('/api/admin/directives/:id',requireUser,requireAdmin,async(req,res)=>{try{await pool.execute('DELETE FROM system_directives WHERE id=?',[req.params.id]);res.json({success:true});}catch(e){sendDbError(res,e);}});
app.get('/api/admin/features',requireUser,requireAdmin,async(_req,res)=>{try{const [rows]=await pool.query('SELECT * FROM feature_flags ORDER BY feature_key');res.json({success:true,features:rows});}catch(e){sendDbError(res,e);}});
app.patch('/api/admin/features/:id',requireUser,requireAdmin,async(req,res)=>{try{await pool.execute('UPDATE feature_flags SET enabled=? WHERE id=?',[req.body.enabled?1:0,req.params.id]);res.json({success:true});}catch(e){sendDbError(res,e);}});
app.get('/api/admin/activity',requireUser,requireAdmin,async(_req,res)=>{try{const [rows]=await pool.query('SELECT a.id,a.action,a.details,a.created_at,u.username,u.email FROM activity_logs a LEFT JOIN users u ON u.id=a.user_id ORDER BY a.id DESC LIMIT 200');res.json({success:true,activity:rows});}catch(e){sendDbError(res,e);}});
app.get('/api/admin/ai-config',requireUser,requireAdmin,async(_req,res)=>{const provider=(process.env.AI_PROVIDER||'openai').toLowerCase();res.json({success:true,provider,openaiConfigured:configuredKey(process.env.OPENAI_API_KEY),deepseekConfigured:configuredKey(process.env.DEEPSEEK_API_KEY),envFileFound:fs.existsSync(envPath),envFilePath:envPath,model:process.env.AI_MODEL||''});});
app.put('/api/admin/ai-config',requireUser,requireAdmin,async(req,res)=>{const provider=req.body.provider;if(!['openai','deepseek'].includes(provider))return res.status(400).json({success:false,error:'Choose openai or deepseek.'});try{await pool.execute("INSERT INTO system_directives(directive,enabled,updated_by) VALUES(?,0,?)",[`Admin selected default provider: ${provider}`,req.user.id]);res.json({success:true,message:'Selection saved as an admin note. To change the server default, set AI_PROVIDER in .env and restart the backend.',provider});}catch(e){sendDbError(res,e);}});
app.use((err,_req,res,_next)=>{console.error(err);res.status(500).json({success:false,error:'Unexpected server error.'});});
(async()=>{try{await ensureSchema();app.listen(PORT,()=>{const active=(process.env.AI_PROVIDER||'openai').toLowerCase();console.log(`LOUF AI backend running at http://localhost:${PORT}`);console.log(`Environment file: ${envPath} (${fs.existsSync(envPath)?'found':'MISSING'})`);console.log(`Default AI provider: ${active}; OpenAI key: ${configuredKey(process.env.OPENAI_API_KEY)?'configured':'missing/placeholder'}; DeepSeek key: ${configuredKey(process.env.DEEPSEEK_API_KEY)?'configured':'missing/placeholder'}`);});}catch(e){console.error('Startup failed:',e.message);process.exit(1);}})();
