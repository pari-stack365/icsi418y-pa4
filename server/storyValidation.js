const PRIORITIES = ['High', 'Medium', 'Low'];
const STATUSES = ['To Do', 'In Progress', 'Done'];

function validId(value) {
  return typeof value === 'string' && /^[a-f0-9]{24}$/i.test(value);
}

function validRequiredText(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function validateStoryInput(body, creating = false) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { message: 'Invalid story data.' };
  }
  if ('project_id' in body || '_id' in body) {
    return { message: 'The story ID and project cannot be changed.' };
  }
  if (!validRequiredText(body.title)) return { message: 'Title is required.' };
  if (!validRequiredText(body.description)) return { message: 'Description is required.' };
  if (!PRIORITIES.includes(body.priority)) {
    return { message: 'Priority must be High, Medium, or Low.' };
  }
  if ((!creating || body.status !== undefined) && !STATUSES.includes(body.status)) {
    return { message: 'Status must be To Do, In Progress, or Done.' };
  }
  if (body.assigned_user_id !== undefined && body.assigned_user_id !== null && !validId(body.assigned_user_id)) {
    return { message: 'Invalid assigned member ID.' };
  }
  return {
    story: {
      title: body.title.trim(),
      description: body.description.trim(),
      priority: body.priority,
      // Every new story starts in To Do.
      status: creating ? 'To Do' : body.status,
      assigned_user_id: body.assigned_user_id ?? null
    }
  };
}

module.exports = { PRIORITIES, STATUSES, validId, validRequiredText, validateStoryInput };
