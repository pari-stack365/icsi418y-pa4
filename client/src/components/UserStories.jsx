import { useEffect, useState } from 'react';

const API_URL = 'http://localhost:9000';
const emptyForm = {
  title: '',
  description: '',
  priority: 'Medium',
  status: 'To Do',
  assigned_user_id: ''
};

async function request(path, options = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: options.body ? { 'Content-Type': 'application/json' } : undefined
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || 'Request failed.');
  return data;
}

function StoryList({ project }) {
  const [stories, setStories] = useState([]);
  const [members, setMembers] = useState([]);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const path = `/projects/${project._id}`;

  async function loadStories() {
    const data = await request(`${path}/stories`);
    setStories(data);
  }

  async function loadMembers() {
    const data = await request(`${path}/members`);
    setMembers(data);
  }

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const [nextStories, nextMembers] = await Promise.all([
          request(`${path}/stories`), request(`${path}/members`)
        ]);
        if (active) {
          setStories(nextStories);
          setMembers(nextMembers);
        }
      } catch (error) {
        if (active) setMessage(error.message);
      } finally {
        if (active) setLoading(false);
      }
    }
    async function updateMembers() {
      try {
        const data = await request(`${path}/members`);
        if (active) setMembers(data);
      } catch (error) {
        if (active) setMessage(error.message);
      }
    }
    load();
    window.addEventListener('membersChanged', updateMembers);
    return () => {
      active = false;
      window.removeEventListener('membersChanged', updateMembers);
    };
  }, [path]);

  function createStory() {
    setForm({ ...emptyForm });
    setEditingId(null);
    setShowForm(true);
    setMessage('');
  }

  function editStory(story) {
    setEditingId(story._id);
    setForm({
      title: story.title,
      description: story.description,
      priority: story.priority,
      status: story.status,
      assigned_user_id: story.assigned_user_id || ''
    });
    setShowForm(true);
    setMessage('');
  }

  function cancelEdit() {
    setShowForm(false);
    setEditingId(null);
    setForm({ ...emptyForm });
    setMessage('');
  }

  async function saveStory(event) {
    event.preventDefault();
    if (!form.title.trim() || !form.description.trim()) {
      setMessage('Title and description are required.');
      return;
    }
    if (form.assigned_user_id && !members.some(member => member._id === form.assigned_user_id)) {
      setMessage('Choose a member of this project.');
      return;
    }
    setBusy(true);
    try {
      const data = {
        title: form.title.trim(),
        description: form.description.trim(),
        priority: form.priority,
        assigned_user_id: form.assigned_user_id || null
      };
      if (editingId) data.status = form.status;
      const result = await request(`${path}/stories${editingId ? `/${editingId}` : ''}`, {
        method: editingId ? 'PUT' : 'POST',
        body: JSON.stringify(data)
      });
      await loadStories();
      cancelEdit();
      setMessage(result.message);
    } catch (error) {
      setMessage(error.message);
    } finally {
      setBusy(false);
    }
  }

  async function deleteStory(story) {
    if (!window.confirm(`Delete "${story.title}"?`)) return;
    setBusy(true);
    try {
      const result = await request(`${path}/stories/${story._id}`, { method: 'DELETE' });
      await loadStories();
      if (editingId === story._id) cancelEdit();
      setMessage(result.message);
    } catch (error) {
      setMessage(error.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <h3>{project.name}</h3>
      <button type="button" disabled={busy} onClick={createStory}>Create User Story</button>
      {loading ? <p>Loading stories...</p> : stories.length === 0 ? <p>No user stories for this project.</p> : (
        <ul className="story-list">
          {stories.map(story => (
            <li key={story._id}>
              <strong>{story.title}</strong>
              <p>{story.description}</p>
              <p>Priority: {story.priority} | Status: {story.status}</p>
              <p>Assigned Member: {story.assigned_member_name}</p>
              <button type="button" disabled={busy} onClick={() => editStory(story)}>Edit</button>
              <button type="button" disabled={busy} onClick={() => deleteStory(story)}>Delete</button>
            </li>
          ))}
        </ul>
      )}
      {showForm && (
        <form className="story-form" onSubmit={saveStory}>
          <h3>{editingId ? 'Edit User Story' : 'Create User Story'}</h3>
          <label>Title
            <input required value={form.title} onChange={event => setForm({ ...form, title: event.target.value })} />
          </label>
          <label>Description
            <textarea required rows="3" placeholder="As a [user], I want [goal], so that [benefit]."
              value={form.description} onChange={event => setForm({ ...form, description: event.target.value })} />
          </label>
          <label>Priority
            <select value={form.priority} onChange={event => setForm({ ...form, priority: event.target.value })}>
              <option>High</option><option>Medium</option><option>Low</option>
            </select>
          </label>
          {editingId && (
            <label>Status
              <select value={form.status} onChange={event => setForm({ ...form, status: event.target.value })}>
                <option>To Do</option><option>In Progress</option><option>Done</option>
              </select>
            </label>
          )}
          <label>Assigned Member
            <select value={form.assigned_user_id} onChange={event => setForm({ ...form, assigned_user_id: event.target.value })}>
              <option value="">Unassigned</option>
              {members.map(member => (
                <option key={member._id} value={member._id}>{member.username}</option>
              ))}
            </select>
          </label>
          {!editingId && <p>New stories start as To Do.</p>}
          <button type="submit" disabled={busy}>Save</button>
          <button type="button" disabled={busy} onClick={cancelEdit}>Cancel</button>
        </form>
      )}
      <p className="message" role="status">{message}</p>
    </div>
  );
}

export default function UserStories({ project }) {
  return (
    <section>
      <h2>Project Backlog</h2>
      {project ? <StoryList key={project._id} project={project} /> :
        <p>Select a project in Project Members to view its stories.</p>}
    </section>
  );
}
