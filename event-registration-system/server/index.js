
const express = require('express');
const cors = require('cors');
const Database = require('better-sqlite3');

const app = express();
app.use(cors());
app.use(express.json());

// DB setup
const db = new Database('events.db');
db.pragma('journal_mode = WAL');
db.exec(`
CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT,
  location TEXT,
  date TEXT NOT NULL,
  capacity INTEGER NOT NULL,
  cancelled INTEGER DEFAULT 0,
  createdAt TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS registrations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  eventId INTEGER NOT NULL,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  createdAt TEXT DEFAULT (datetime('now')),
  UNIQUE(eventId, email),
  FOREIGN KEY(eventId) REFERENCES events(id)
);
`);

function isFuture(dateStr){
  const d = new Date(dateStr);
  const now = new Date();
  return d.getTime() > now.getTime();
}

// Create event (future-date + capacity validation)
app.post('/events', (req, res) => {
  try {
    const { name, description='', location='', date, capacity } = req.body || {};
    if(!name || !date || capacity === undefined) return res.status(400).json({error:'name, date, capacity are required'});
    if(!isFuture(date)) return res.status(400).json({error:'Event date must be in the future'});
    const cap = parseInt(capacity,10);
    if(!(cap>0)) return res.status(400).json({error:'capacity must be a positive integer'});
    const info = db.prepare('INSERT INTO events (name, description, location, date, capacity) VALUES (?,?,?,?,?)')
      .run(name.trim(), description.trim(), location.trim(), new Date(date).toISOString(), cap);
    const created = db.prepare('SELECT * FROM events WHERE id=?').get(info.lastInsertRowid);
    res.json(created);
  } catch(e){ res.status(500).json({error:e.message}); }
});

// List events (filter, sort, search, pagination)
app.get('/events', (req,res)=>{
  try{
    const { sort='date', order='asc', q='', status='', from='', to='', page='1', pageSize='5' } = req.query;
    const allowedSort=['date','name','createdAt'];
    const s = allowedSort.includes(sort) ? sort : 'date';
    const ord = (order||'').toLowerCase()==='desc'?'DESC':'ASC';
    const p = Math.max(parseInt(page,10)||1,1);
    const ps = Math.min(Math.max(parseInt(pageSize,10)||5,1),50);

    let where=[]; let params={};
    if(q){ where.push('name LIKE @q'); params.q = `%${q}%`; }
    if(status==='active') where.push('cancelled = 0');
    if(status==='cancelled') where.push('cancelled = 1');
    if(from){ where.push('date >= @from'); params.from = new Date(from).toISOString(); }
    if(to){ where.push('date <= @to'); params.to = new Date(to).toISOString(); }
    const whereSql = where.length?`WHERE ${where.join(' AND ')}`:'';

    const total = db.prepare(`SELECT COUNT(*) as c FROM events ${whereSql}`).get(params).c;
    const items = db.prepare(`SELECT * FROM events ${whereSql} ORDER BY ${s} ${ord} LIMIT @limit OFFSET @offset`)
      .all({...params, limit: ps, offset:(p-1)*ps});
    res.json({items,total,page:p,pageSize:ps});
  }catch(e){ res.status(500).json({error:e.message}); }
});

// Register attendee (capacity + duplicate + cancel checks)
app.post('/events/:id/register', (req,res)=>{
  try{
    const id = parseInt(req.params.id,10);
    const {name, email} = req.body || {};
    if(!name || !email) return res.status(400).json({error:'name and email are required'});
    const event = db.prepare('SELECT * FROM events WHERE id=?').get(id);
    if(!event) return res.status(404).json({error:'Event not found'});
    if(event.cancelled) return res.status(400).json({error:'Event is cancelled'});
    const count = db.prepare('SELECT COUNT(*) as c FROM registrations WHERE eventId=?').get(id).c;
    if(count >= event.capacity) return res.status(400).json({error:'Event is full'});
    try{
      const info = db.prepare('INSERT INTO registrations (eventId,name,email) VALUES (?,?,?)')
        .run(id, name.trim(), email.trim().toLowerCase());
      const reg = db.prepare('SELECT * FROM registrations WHERE id=?').get(info.lastInsertRowid);
      res.json(reg);
    }catch(er){
      if(String(er).includes('UNIQUE')) return res.status(400).json({error:'This email is already registered for the event'});
      throw er;
    }
  }catch(e){ res.status(500).json({error:e.message}); }
});

// Cancel event
app.post('/events/:id/cancel',(req,res)=>{
  try{
    const id = parseInt(req.params.id,10);
    const event = db.prepare('SELECT * FROM events WHERE id=?').get(id);
    if(!event) return res.status(404).json({error:'Event not found'});
    if(event.cancelled) return res.status(400).json({error:'Event already cancelled'});
    db.prepare('UPDATE events SET cancelled=1 WHERE id=?').run(id);
    const updated = db.prepare('SELECT * FROM events WHERE id=?').get(id);
    res.json(updated);
  }catch(e){ res.status(500).json({error:e.message}); }
});

// Event stats
app.get('/events/:id/stats',(req,res)=>{
  try{
    const id = parseInt(req.params.id,10);
    const event = db.prepare('SELECT * FROM events WHERE id=?').get(id);
    if(!event) return res.status(404).json({error:'Event not found'});
    const total = db.prepare('SELECT COUNT(*) as c FROM registrations WHERE eventId=?').get(id).c;
    const remaining = Math.max(event.capacity - total, 0);
    res.json({eventId:id, capacity:event.capacity, cancelled:!!event.cancelled, totalRegistrations:total, remaining, isFull: remaining===0});
  }catch(e){ res.status(500).json({error:e.message}); }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, ()=>console.log(`Server running on http://localhost:${PORT}`));
module.exports = app;
