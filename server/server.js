require('dotenv').config();

const express = require('express');
const cors = require('cors');
const { MongoClient, ObjectId } = require('mongodb');
const bcrypt = require('bcryptjs');
const { validId, validRequiredText, validateStoryInput } = require('./storyValidation');

const app = express();
const client = new MongoClient(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017');
const db = client.db('pa2');
const users = db.collection('Users');
const projects = db.collection('Projects');
const memberships = db.collection('ProjectMemberships');
const stories = db.collection('UserStories');
const PORT = Number(process.env.PORT || 9000);

app.use(cors());
app.use(express.json());
const route = fn => (req, res, next) => Promise.resolve(fn(req, res)).catch(next);
const objectId = value => new ObjectId(value);

app.get('/', (req, res) => res.json({ message: 'Server is running' }));

app.post('/signup', route(async (req, res) => {
  const { f_name, l_name, username, password } = req.body || {};
  if (![f_name, l_name, username, password].every(validRequiredText)) {
    return res.status(400).json({ message: 'Please fill in all fields.' });
  }
  const name = username.trim();
  if (await users.findOne({ username: name })) {
    return res.status(409).json({ message: 'Username already exists.' });
  }
  const hashedPassword = await bcrypt.hash(password, 10);
  try {
    await users.insertOne({ f_name: f_name.trim(), l_name: l_name.trim(), username: name, password: hashedPassword });
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ message: 'Username already exists.' });
    throw error;
  }
  return res.status(201).json({ message: 'Account created successfully.' });
}));

app.post('/login', route(async (req, res) => {
  const { username, password } = req.body || {};
  if (![username, password].every(validRequiredText)) {
    return res.status(400).json({ message: 'Enter a username and password.' });
  }
  const user = await users.findOne({ username: username.trim() });
  if (!user || !(await bcrypt.compare(password, user.password))) {
    return res.status(401).json({ message: 'Invalid username or password.' });
  }
  return res.json({ message: 'Login successful.' });
}));

app.get('/users', route(async (req, res) => {
  res.json(await users.find({}, { projection: { password: 0 } }).toArray());
}));

app.post('/projects', route(async (req, res) => {
  const { name, description, status, project_lead_id } = req.body || {};
  if (![name, description, status, project_lead_id].every(validRequiredText)) {
    return res.status(400).json({ message: 'Please fill in all project fields.' });
  }
  if (!['Planning', 'Active', 'Completed'].includes(status)) {
    return res.status(400).json({ message: 'Invalid project status.' });
  }
  if (!validId(project_lead_id)) {
    return res.status(400).json({ message: 'Invalid Project Lead.' });
  }
  const leadId = objectId(project_lead_id);
  if (!(await users.findOne({ _id: leadId }))) {
    return res.status(404).json({ message: 'Project Lead does not exist.' });
  }
  const result = await projects.insertOne({
    name: name.trim(), description: description.trim(), status, project_lead_id: leadId
  });
  try {
    await memberships.insertOne({ project_id: result.insertedId, user_id: leadId });
  } catch (error) {
    await projects.deleteOne({ _id: result.insertedId });
    throw error;
  }
  return res.status(201).json({ message: 'Project created successfully.', project_id: result.insertedId });
}));

app.get('/projects', route(async (req, res) => {
  const result = await projects.find().toArray();
  const leadIds = result.map(project => project.project_lead_id).filter(Boolean);
  const leads = await users.find({ _id: { $in: leadIds } }, { projection: { username: 1 } }).toArray();
  const names = new Map(leads.map(user => [user._id.toString(), user.username]));
  for (const project of result) {
    project.project_lead = names.get(project.project_lead_id?.toString()) || 'User not found';
  }
  res.json(result);
}));

app.get('/projects/:projectId/members', route(async (req, res) => {
  if (!validId(req.params.projectId)) return res.status(400).json({ message: 'Invalid project ID.' });
  const projectId = objectId(req.params.projectId);
  const project = await projects.findOne({ _id: projectId });
  if (!project) return res.status(404).json({ message: 'Project does not exist.' });
  const rows = await memberships.find({ project_id: projectId }).toArray();
  const memberIds = [...new Set([...rows.map(row => row.user_id.toString()), project.project_lead_id.toString()])].map(objectId);
  const result = await users.find({ _id: { $in: memberIds } }, { projection: { password: 0 } }).toArray();
  res.json(result);
}));

app.post('/projects/:projectId/members', route(async (req, res) => {
  const { user_id } = req.body || {};
  if (!validId(user_id) || !validId(req.params.projectId)) {
    return res.status(400).json({ message: 'Select a valid project and user.' });
  }
  const projectId = objectId(req.params.projectId);
  const userId = objectId(user_id);
  const project = await projects.findOne({ _id: projectId });
  if (!project) return res.status(404).json({ message: 'Project does not exist.' });
  if (!(await users.findOne({ _id: userId }))) return res.status(404).json({ message: 'User does not exist.' });
  const existing = await memberships.findOne({ project_id: projectId, user_id: userId });
  if (existing || project.project_lead_id.equals(userId)) {
    return res.status(409).json({ message: 'User is already a member of this project.' });
  }
  try {
    await memberships.insertOne({ project_id: projectId, user_id: userId });
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ message: 'User is already a member of this project.' });
    throw error;
  }
  return res.status(201).json({ message: 'Member added successfully.' });
}));

app.delete('/projects/:projectId/members/:userId', route(async (req, res) => {
  if (!validId(req.params.projectId) || !validId(req.params.userId)) {
    return res.status(400).json({ message: 'Invalid project or user ID.' });
  }
  const projectId = objectId(req.params.projectId);
  const userId = objectId(req.params.userId);
  const project = await projects.findOne({ _id: projectId });
  if (!project) return res.status(404).json({ message: 'Project does not exist.' });
  if (!(await users.findOne({ _id: userId }))) {
    return res.status(404).json({ message: 'User does not exist.' });
  }
  if (project.project_lead_id.equals(userId)) {
    return res.status(400).json({ message: 'The Project Lead cannot be removed.' });
  }
  // Assigned stories must be changed before removing a member.
  if (await stories.findOne({ project_id: projectId, assigned_user_id: userId })) {
    return res.status(409).json({
      message: 'Cannot remove this member: they have assigned stories in this project (including Done stories). Reassign, unassign, or delete those stories first.'
    });
  }
  const result = await memberships.deleteOne({ project_id: projectId, user_id: userId });
  if (!result.deletedCount) return res.status(404).json({ message: 'User is not a member of this project.' });
  res.json({ message: 'Member removed successfully.' });
}));

async function requireProject(req, res) {
  if (!validId(req.params.projectId)) {
    res.status(400).json({ message: 'Invalid project ID.' });
    return null;
  }
  const project = await projects.findOne({ _id: objectId(req.params.projectId) });
  if (!project) {
    res.status(404).json({ message: 'Project does not exist.' });
    return null;
  }
  return project;
}

async function requireStory(req, res, projectId) {
  if (!validId(req.params.storyId)) {
    res.status(400).json({ message: 'Invalid story ID.' });
    return null;
  }
  const story = await stories.findOne({ _id: objectId(req.params.storyId), project_id: projectId });
  if (!story) {
    res.status(404).json({ message: 'Story does not exist in this project.' });
    return null;
  }
  return story;
}

async function verifyAssignment(project, assignment, res) {
  if (assignment === null) return { assigned_user_id: null };
  const userId = objectId(assignment);
  if (!(await users.findOne({ _id: userId }))) {
    res.status(400).json({ message: 'Assigned user does not exist.' });
    return null;
  }
  if (!project.project_lead_id.equals(userId) &&
      !(await memberships.findOne({ project_id: project._id, user_id: userId }))) {
    res.status(400).json({ message: 'Assigned user must be a current member of this project.' });
    return null;
  }
  return { assigned_user_id: userId };
}

async function withMemberNames(items) {
  const ids = [...new Set(items.filter(item => item.assigned_user_id)
    .map(item => item.assigned_user_id.toString()))].map(objectId);
  const assignedUsers = ids.length
    ? await users.find({ _id: { $in: ids } }, { projection: { username: 1, f_name: 1, l_name: 1 } }).toArray()
    : [];
  const names = new Map(assignedUsers.map(user => [user._id.toString(),
    [user.f_name, user.l_name].filter(Boolean).join(' ') || user.username]));
  return items.map(item => ({
    ...item,
    assigned_member_name: item.assigned_user_id
      ? names.get(item.assigned_user_id.toString()) || 'Unknown member'
      : 'Unassigned'
  }));
}

app.get('/projects/:projectId/stories', route(async (req, res) => {
  const project = await requireProject(req, res);
  if (!project) return;
  const result = await stories.find({ project_id: project._id }).sort({ _id: -1 }).toArray();
  res.json(await withMemberNames(result));
}));

app.post('/projects/:projectId/stories', route(async (req, res) => {
  const project = await requireProject(req, res);
  if (!project) return;
  const { story, message } = validateStoryInput(req.body, true);
  if (message) return res.status(400).json({ message });
  const assignment = await verifyAssignment(project, story.assigned_user_id, res);
  if (!assignment) return;
  const document = { project_id: project._id, ...story, ...assignment };
  const result = await stories.insertOne(document);
  return res.status(201).json({ message: 'Story created successfully.', story: (await withMemberNames([{ ...document, _id: result.insertedId }]))[0] });
}));

async function updateStory(req, res) {
  const project = await requireProject(req, res);
  if (!project) return;
  const existing = await requireStory(req, res, project._id);
  if (!existing) return;
  const { story, message } = validateStoryInput(req.body);
  if (message) return res.status(400).json({ message });
  const assignment = await verifyAssignment(project, story.assigned_user_id, res);
  if (!assignment) return;
  Object.assign(story, assignment);
  await stories.updateOne({ _id: existing._id, project_id: project._id }, { $set: story });
  const updated = await stories.findOne({ _id: existing._id, project_id: project._id });
  return res.json({ message: 'Story updated successfully.', story: (await withMemberNames([updated]))[0] });
}

app.put('/projects/:projectId/stories/:storyId', route(updateStory));

app.delete('/projects/:projectId/stories/:storyId', route(async (req, res) => {
  const project = await requireProject(req, res);
  if (!project) return;
  const existing = await requireStory(req, res, project._id);
  if (!existing) return;
  await stories.deleteOne({ _id: existing._id, project_id: project._id });
  res.json({ message: 'Story deleted successfully.' });
}));

app.use((error, req, res, next) => {
  console.error(error);
  if (res.headersSent) return next(error);
  return res.status(500).json({ message: 'Server error. Please try again.' });
});

async function connectDatabase() {
  await client.connect();
  const oldUsers = await db.listCollections({ name: 'users' }).toArray();
  const currentUsers = await db.listCollections({ name: 'Users' }).toArray();
  if (oldUsers.length && !currentUsers.length) await db.collection('users').rename('Users');
  await users.createIndex({ username: 1 }, { unique: true });
  await projects.createIndex({ project_lead_id: 1 });
  await memberships.createIndex({ project_id: 1, user_id: 1 }, { unique: true });
  await stories.createIndex({ project_id: 1, _id: -1 });
  await stories.createIndex({ project_id: 1, assigned_user_id: 1 });
  console.log('Connected to MongoDB');
  app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}

if (require.main === module) {
  connectDatabase().catch(error => {
    console.error('Could not connect to MongoDB:', error.message);
    process.exitCode = 1;
  });
}

module.exports = { app, connectDatabase };
