
# Event Registration System

Features required by your brief:
- Create event with **future date** validation
- **Filter, sort, search** and **paginate** events
- Register attendees with **duplicate email** & **capacity** checks
- **Cancel event** and block new registrations
- **Event statistics** endpoint
- Responsive UI + basic tests

## Setup (VS Code)
```bash
npm install
npm start   # runs server at http://localhost:3000
```
Open `client/index.html` in a browser (or with the Live Server extension).

## Endpoints
- `POST /events` `{name, date, capacity, location?, description?}`
- `GET /events` query: `q,status,from,to,sort,order,page,pageSize`
- `POST /events/:id/register` `{name,email}`
- `POST /events/:id/cancel`
- `GET /events/:id/stats`

## Tests
```bash
npm test
```
