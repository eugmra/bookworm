import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { useFetch } from '../hooks.js';
import { Loading, Message } from '../components.jsx';

export default function Writers() {
  const { data, error, loading, reload } = useFetch(() => api.writers(), []);
  const [msg, setMsg] = useState('');

  const toggle = async (w) => {
    try {
      if (w.followed) await api.unfollow(w.id);
      else await api.follow(w.id);
      reload();
    } catch (err) {
      setMsg(err.message);
    }
  };

  if (loading) return <Loading />;
  return (
    <div className="page">
      <h1>My Writers</h1>
      <Message>{error || msg}</Message>
      <ul className="writers">
        {data?.writers.map((w) => (
          <li key={w.id} className="panel">
            <div className="grow">
              <h3>
                <Link to={`/?author=${w.id}`}>{w.name}</Link>
              </h3>
              <p className="small muted">{w.bio}</p>
              <p className="small">{w.bookCount} book(s)</p>
            </div>
            <button className={w.followed ? 'btn btn-secondary btn-small' : 'btn btn-small'} onClick={() => toggle(w)}>
              {w.followed ? 'Unfollow' : 'Follow'}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
