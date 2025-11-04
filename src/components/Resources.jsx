import React, { useState } from 'react';
import './Resources.css';

function Resources() {
  const [query, setQuery] = useState('');

  const tips = [
    { id: 1, title: 'Home Safety Checklist', excerpt: 'Lock doors, test smoke alarms, keep emergency numbers handy.' },
    { id: 2, title: 'Flood Preparedness', excerpt: 'Have sandbags, move valuables high, know evacuation routes.' }
  ];

  const filtered = tips.filter(t => t.title.toLowerCase().includes(query.toLowerCase()) || t.excerpt.toLowerCase().includes(query.toLowerCase()));

  return (
    <div className="resources-container">
      <div className="resources-header">
        <h2>Safety Tips & Resource Center</h2>
        <input placeholder="Search tips or resources..." value={query} onChange={(e) => setQuery(e.target.value)} />
      </div>

      <div className="resources-grid">
        {filtered.map(item => (
          <article key={item.id} className="resource-card">
            <h3>{item.title}</h3>
            <p>{item.excerpt}</p>
            <div className="resource-actions">
              <button className="btn-primary">Read</button>
              <button className="btn-secondary">Save</button>
            </div>
          </article>
        ))}
      </div>

      <section style={{ marginTop: 20 }}>
        <h3>External Resources</h3>
        <ul>
          <li><a href="#">Local emergency contacts</a></li>
          <li><a href="#">Disaster preparedness guide (PDF)</a></li>
        </ul>
      </section>
    </div>
  );
}

export default Resources;
