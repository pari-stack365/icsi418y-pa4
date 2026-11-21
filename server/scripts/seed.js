// Add demo data without deleting existing records.
require('dotenv').config();
const { MongoClient } = require('mongodb');
const bcrypt = require('bcryptjs');

const client = new MongoClient(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017');
const demoPassword = process.env.DEMO_PASSWORD || 'test123';

async function main() {
  await client.connect();
  const db = client.db('pa2');
  const users = db.collection('Users');
  const projects = db.collection('Projects');
  const memberships = db.collection('ProjectMemberships');
  const stories = db.collection('UserStories');

  const demoUsers = [
    { username: 'amy', f_name: 'Amy', l_name: 'Li' },
    { username: 'ben', f_name: 'Ben', l_name: 'Wu' },
    { username: 'sam', f_name: 'Sam', l_name: 'Kim' }
  ];
  const hashed = await bcrypt.hash(demoPassword, 10);
  const people = {};
  for (const info of demoUsers) {
    await users.updateOne({ username: info.username }, { $setOnInsert: { ...info, password: hashed } }, { upsert: true });
    people[info.username] = (await users.findOne({ username: info.username }))._id;
  }

  const projectDefinitions = [
    { name: 'Events', description: 'Manage campus events.', status: 'Active', project_lead_id: people.amy },
    { name: 'Tasks', description: 'Manage study tasks.', status: 'Planning', project_lead_id: people.sam }
  ];
  const [campus, planner] = await Promise.all(projectDefinitions.map(async project => {
    await projects.updateOne({ name: project.name }, { $setOnInsert: project }, { upsert: true });
    return (await projects.findOne({ name: project.name }))._id;
  }));

  const memberPairs = [
    [campus, people.amy], [campus, people.ben],
    [planner, people.sam], [planner, people.amy]
  ];
  for (const [project_id, user_id] of memberPairs) {
    await memberships.updateOne({ project_id, user_id }, { $setOnInsert: { project_id, user_id } }, { upsert: true });
  }

  const storyData = [
    [campus, 'View events', 'As a student, I want to view events, so that I can choose one to attend.', 'High', 'To Do', people.ben],
    [campus, 'Add event', 'As an organizer, I want to add an event, so that students can see it.', 'Medium', 'In Progress', people.amy],
    [campus, 'Remove event', 'As an organizer, I want to remove old events, so that the list stays current.', 'Low', 'Done', people.ben],
    [planner, 'Add task', 'As a student, I want to add a task, so that I can plan my work.', 'High', 'Done', people.sam],
    [planner, 'View tasks', 'As a student, I want to view tasks, so that I know what to do.', 'Medium', 'To Do', null]
  ];
  for (const [project_id, title, description, priority, status, assigned_user_id] of storyData) {
    await stories.updateOne(
      { project_id, title },
      { $setOnInsert: { project_id, title, description, priority, status, assigned_user_id } },
      { upsert: true }
    );
  }
  console.log('PA4 test data ready: 3 users, 2 projects, 5 stories.');
  console.log('Demo usernames: amy, ben, sam');
  console.log('Demo password (new demo users only):', demoPassword);
}

main().catch(error => { console.error(error); process.exitCode = 1; })
  .finally(() => client.close());
