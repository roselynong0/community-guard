import React, { useState, useEffect } from 'react';
import { FaUserFriends } from 'react-icons/fa';
import './CommunityFeed.css';

function CommunityFeed({ token }) {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    // Placeholder: fetch community posts when backend route is available
    const fetchPosts = async () => {
      setLoading(true);
      try {
        const res = await fetch('http://localhost:5000/api/community/posts', {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (!res.ok) throw new Error('Failed to load');
        const data = await res.json();
        setPosts(Array.isArray(data.posts) ? data.posts : []);
      } catch (err) {
        console.warn('Community posts fetch failed:', err);
        // fallback to sample posts
        setPosts([
          { id: 1, title: 'Welcome to the Community', body: 'Share updates, events, and help each other.' },
          { id: 2, title: 'Neighborhood Watch Meetup', body: 'Join us on Saturday at 4PM near the plaza.' }
        ]);
      } finally {
        setLoading(false);
      }
    };

    fetchPosts();
  }, [token]);

  return (
    <div className="community-container">
      <div className="community-header">
        <h1 className="title" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8, fontSize: '1.5rem' }}><FaUserFriends /> Community Feed</h1>
        <div className="community-controls">
          <input
            aria-label="Search community posts"
            placeholder="Search posts, topics, or users..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <button className="btn-primary">New Post</button>
        </div>
      </div>

      <div className="community-list">
        {loading ? (
          <div className="feed-loading">Loading posts...</div>
        ) : posts.length === 0 ? (
          <div className="feed-empty">No posts yet.</div>
        ) : (
          posts
            .filter(p => p.title.toLowerCase().includes(search.toLowerCase()) || p.body.toLowerCase().includes(search.toLowerCase()))
            .map(post => (
              <article key={post.id} className="feed-card">
                <header>
                  <h3>{post.title}</h3>
                </header>
                <p>{post.body}</p>
                <footer>
                  <span className="meta">{post.author || 'Community'}</span>
                  <span className="meta">{post.created_at ? new Date(post.created_at).toLocaleString() : ''}</span>
                </footer>
              </article>
            ))
        )}
      </div>
    </div>
  );
}

export default CommunityFeed;