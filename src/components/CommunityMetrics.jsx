import React, { useState, useEffect } from "react";
import { FaBullhorn, FaChartBar, FaUsers, FaExclamationTriangle, FaSyncAlt, FaCheckCircle, FaClock } from "react-icons/fa";

function CommunityMetrics({ session, setNotification }) {
  const [communityPosts, setCommunityPosts] = useState([]);
  const [loading, setLoading] = useState(true);

  // Announcements (mock-only, local state)
  const [isAnnouncementOpen, setIsAnnouncementOpen] = useState(false);
  const [announceTitle, setAnnounceTitle] = useState("");
  const [announceBody, setAnnounceBody] = useState("");
  const [announceBarangay, setAnnounceBarangay] = useState("All");
  const [announcements, setAnnouncements] = useState([
    { id: Date.now() - 30000, title: 'Neighborhood Alert: Water Cut', body: 'Water will be off from 9AM-3PM for pipe maintenance.', barangay: 'All', author: 'Admin', icon: <FaExclamationTriangle /> },
    { id: Date.now() - 20000, title: 'Neighborhood Watch Meetup', body: 'Meet at the plaza this Saturday at 4PM.', barangay: 'Barretto', author: 'Juan dela Cruz', icon: <FaUsers /> },
    { id: Date.now() - 10000, title: 'Road Repair Complete', body: 'The repair on Lopez Street has been completed.', barangay: 'Gordon Heights', author: 'Public Works', icon: <FaCheckCircle /> },
  ]);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setLoading(true);
      try {
        const res = await fetch("http://localhost:5000/api/community/posts");
        const data = await res.json().catch(() => ({}));
        if (mounted && Array.isArray(data.posts)) setCommunityPosts(data.posts);
        else if (mounted)
          setCommunityPosts([
            { id: 1, title: "Welcome", barangay: "All", author: "Admin" },
            { id: 2, title: "Meetup", barangay: "Barretto", author: "Juan dela Cruz" },
          ]);
      } catch {
        if (mounted)
          setCommunityPosts([
            { id: 1, title: "Welcome", barangay: "All", author: "Admin" },
            { id: 2, title: "Meetup", barangay: "Barretto", author: "Juan dela Cruz" },
          ]);
      } finally {
        if (mounted) setLoading(false);
      }
    };
    load();
    return () => {
      mounted = false;
    };
  }, []);

  const byBarangay = communityPosts.reduce((acc, p) => {
    const b = p.barangay || "Unspecified";
    acc[b] = (acc[b] || 0) + 1;
    return acc;
  }, {});

  const topPosters = Object.entries(
    communityPosts.reduce((acc, p) => {
      const a = p.author || "Unknown";
      acc[a] = (acc[a] || 0) + 1;
      return acc;
    }, {})
  )
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  return (
    <div style={{ padding: 16 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <h1 style={{ margin: 0, display: "flex", alignItems: "center", gap: 8, fontSize: '1.5rem' }}>
          <FaChartBar /> Community Metrics
        </h1>
        <div>
          <button
            className="admin-btn admin-btn-primary"
            onClick={() => setIsAnnouncementOpen(true)}
            title="New Announcement"
            style={{ display: "inline-flex", alignItems: "center", gap: 8 }}
          >
            <FaBullhorn /> Announce
          </button>
        </div>
      </div>

      {loading ? (
        <div>Loading metrics…</div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <div style={{ background: "#fff", padding: 12, borderRadius: 8 }}>
            <h3 style={{ marginTop: 0 }}>Total posts</h3>
            <p style={{ fontSize: 24, margin: 0 }}>{communityPosts.length}</p>
            <h4 style={{ marginTop: 12 }}>By Barangay</h4>
            <ul>
              {Object.entries(byBarangay).map(([b, c]) => (
                <li key={b}>{b}: {c}</li>
              ))}
            </ul>
          </div>

          <div style={{ background: "#fff", padding: 12, borderRadius: 8 }}>
            <h3 style={{ marginTop: 0 }}>Top posters</h3>
            <ul>
              {topPosters.length ? topPosters.map(([a, c]) => (
                <li key={a}>{a}: {c}</li>
              )) : <li>No posters yet</li>}
            </ul>
          </div>

          <div style={{ gridColumn: "1 / -1", background: "#fff", padding: 12, borderRadius: 8 }}>
            <h3 style={{ marginTop: 0 }}>Announcements (mock)</h3>
            {announcements.length ? (
              <ul>
                {announcements.map(a => (
                  <li key={a.id} style={{ marginBottom: 8, display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                    <div style={{ fontSize: 18, color: '#2d2d73' }}>{a.icon || <FaBullhorn />}</div>
                    <div>
                      <strong>{a.title}</strong> — <em style={{ fontSize: 12, color: '#666' }}>{a.author}</em>
                      <div style={{ fontSize: 12, color: '#666' }}>{a.body}</div>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p style={{ margin: 0, color: '#666' }}>No announcements yet.</p>
            )}
          </div>
        </div>
      )}

      {/* Announcement Modal (mock) */}
      {isAnnouncementOpen && (
        <div className="modal-overlay" onClick={() => setIsAnnouncementOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 720 }}>
            <h3>Create Announcement</h3>
            <p style={{ color: '#555' }}>This is a mock announcement editor (no server changes).</p>
            <div style={{ display: 'grid', gap: 10 }}>
              <label>Title</label>
              <input value={announceTitle} onChange={(e) => setAnnounceTitle(e.target.value)} />
              <label>Message</label>
              <textarea rows={6} value={announceBody} onChange={(e) => setAnnounceBody(e.target.value)} />
              <label>Barangay</label>
              <select value={announceBarangay} onChange={(e) => setAnnounceBarangay(e.target.value)}>
                <option>All</option>
                <option>Barretto</option>
                <option>East Bajac-Bajac</option>
                <option>East Tapinac</option>
                <option>Gordon Heights</option>
                <option>Kalaklan</option>
                <option>Mabayuan</option>
              </select>
            </div>
            <div className="modal-actions" style={{ marginTop: 12 }}>
              <div />
              <div>
                <button className="cancel-btn" onClick={() => setIsAnnouncementOpen(false)}>Cancel</button>
                <button className="confirm-btn" onClick={() => {
                  // choose an icon from Home-style icons based on keywords
                  const lower = (announceTitle + ' ' + announceBody).toLowerCase();
                  let icon = <FaBullhorn />;
                  if (lower.includes('alert') || lower.includes('water') || lower.includes('cut') || lower.includes('report')) icon = <FaExclamationTriangle />;
                  else if (lower.includes('meet') || lower.includes('meetup') || lower.includes('gather')) icon = <FaUsers />;
                  else if (lower.includes('repair') || lower.includes('complete') || lower.includes('fixed')) icon = <FaCheckCircle />;
                  else if (lower.includes('ongoing') || lower.includes('urgent')) icon = <FaSyncAlt />;

                  const a = { id: Date.now(), title: announceTitle || 'No title', body: announceBody, barangay: announceBarangay, author: `${session?.user?.firstname || 'Admin'} ${session?.user?.lastname || ''}`, created_at: new Date().toISOString(), icon };
                  setAnnouncements(prev => [a, ...prev]);
                  setIsAnnouncementOpen(false);
                  setAnnounceTitle(''); setAnnounceBody(''); setAnnounceBarangay('All');
                  setNotification && setNotification({ message: 'Announcement created (mock)', type: 'success' });
                }}>Publish</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default CommunityMetrics;
