# Programming Assignment 4

A project management app using React, Express, and MongoDB. It supports projects, project members, and user stories in a project backlog. The database is named `pa2`, as in the earlier assignments.

## Running the app

Use Node.js 22.12 or newer and a running MongoDB server or MongoDB Atlas.

In the `server` folder, install dependencies:

```bash
npm install
```

Create `server/.env` using `server/.env.example` and set `MONGO_URI` to your MongoDB connection string. For local MongoDB, use:

```env
MONGO_URI=mongodb://127.0.0.1:27017
```

Start the server:

```bash
npm start
```

In a second terminal, go to the `client` folder and run:

```bash
npm install
npm run dev
```

Open the localhost URL shown by Vite. The backend runs on port 9000.

## Test data

In the `server` folder, run:

```bash
npm run seed
```

This creates three demo users, two projects, and five user stories, including different priorities, statuses, and assignments. Existing data is not deleted.

Demo usernames: `amy`, `ben`, `sam`  
Password for newly created demo users: `test123`

Run backend validation tests from the `server` folder with `npm test`.
