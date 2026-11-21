const test = require('node:test');
const assert = require('node:assert/strict');
const { validId, validateStoryInput } = require('../storyValidation');

const input = {
  title: ' Create task ',
  description: ' As a student, I want to create a task, so that I can plan. ',
  priority: 'High',
  assigned_user_id: null
};

test('new stories begin To Do', () => {
  const { story } = validateStoryInput({ ...input, status: 'Done' }, true);
  assert.equal(story.status, 'To Do');
});

test('title and description are required', () => {
  assert.ok(validateStoryInput({ ...input, title: '  ' }, true).message);
  assert.ok(validateStoryInput({ ...input, description: '' }, true).message);
  assert.equal(validateStoryInput(input, true).story.title, 'Create task');
});

test('priority must be High, Medium, or Low', () => {
  for (const priority of ['High', 'Medium', 'Low']) {
    assert.equal(validateStoryInput({ ...input, priority }, true).message, undefined);
  }
  assert.ok(validateStoryInput({ ...input, priority: 'Urgent' }, true).message);
});

test('all story statuses can be saved on edit', () => {
  for (const status of ['To Do', 'In Progress', 'Done']) {
    assert.equal(validateStoryInput({ ...input, status }).story.status, status);
  }
  assert.ok(validateStoryInput({ ...input, status: 'Active' }).message);
});

test('new stories cannot use an invalid status', () => {
  assert.ok(validateStoryInput({ ...input, status: 'Canceled' }, true).message);
});

test('unassigned stories use null', () => {
  assert.equal(validateStoryInput(input, true).story.assigned_user_id, null);
});

test('IDs must be 24 hex characters', () => {
  assert.equal(validId('507f1f77bcf86cd799439011'), true);
  assert.equal(validId('123'), false);
  assert.ok(validateStoryInput({ ...input, assigned_user_id: 'bad' }, true).message);
});

test('project and story IDs cannot be changed', () => {
  assert.ok(validateStoryInput({ ...input, project_id: '507f1f77bcf86cd799439011' }, true).message);
  assert.ok(validateStoryInput({ ...input, _id: '507f1f77bcf86cd799439011' }, true).message);
});

test('invalid requests are rejected', () => {
  assert.ok(validateStoryInput(null).message);
  assert.ok(validateStoryInput([]).message);
  assert.ok(validateStoryInput({ ...input }).message);
});
