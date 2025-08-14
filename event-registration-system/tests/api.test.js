
const request = require('supertest');
const app = require('../server/index');

function futureISO(hours=1){ return new Date(Date.now()+hours*3600*1000).toISOString(); }

describe('Event API', () => {
  let eventId;

  test('rejects past date', async () => {
    const res = await request(app).post('/events').send({name:'Past', date: new Date(Date.now()-3600e3).toISOString(), capacity:10});
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/future/i);
  });

  test('creates event', async () => {
    const res = await request(app).post('/events').send({name:'Conf 2025', date: futureISO(2), capacity:2});
    expect(res.status).toBe(200);
    expect(res.body.id).toBeDefined();
    eventId = res.body.id;
  });

  test('lists events', async () => {
    const res = await request(app).get('/events?sort=date&order=asc&page=1&pageSize=5');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.items)).toBe(true);
  });

  test('register attendee', async () => {
    const res = await request(app).post(`/events/${eventId}/register`).send({name:'Alice', email:'a@example.com'});
    expect(res.status).toBe(200);
  });

  test('reject duplicate email', async () => {
    const res = await request(app).post(`/events/${eventId}/register`).send({name:'Alice', email:'a@example.com'});
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/already registered/i);
  });

  test('enforce capacity', async () => {
    await request(app).post(`/events/${eventId}/register`).send({name:'Bob', email:'b@example.com'});
    const res = await request(app).post(`/events/${eventId}/register`).send({name:'Carol', email:'c@example.com'});
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/full/i);
  });

  test('cancel event and block registration', async () => {
    const resCancel = await request(app).post(`/events/${eventId}/cancel`);
    expect(resCancel.status).toBe(200);
    const resReg = await request(app).post(`/events/${eventId}/register`).send({name:'Dan', email:'d@example.com'});
    expect(resReg.status).toBe(400);
    expect(resReg.body.error).toMatch(/cancelled/i);
  });

  test('stats endpoint', async () => {
    const res = await request(app).get(`/events/${eventId}/stats`);
    expect(res.status).toBe(200);
    expect(res.body.capacity).toBe(2);
    expect(res.body.totalRegistrations).toBe(2);
  });
});
