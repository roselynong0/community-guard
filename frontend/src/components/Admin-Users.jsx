import React, { useState, useEffect, useCallback, useMemo } from "react";
import { 
  FaUser, 
  FaCheckCircle, 
  FaTimesCircle, 
  FaSearch, 
  FaUserCheck, 
  FaUserTimes, 
  FaEdit,
  FaTrashAlt,
  FaPhone,
  FaCalendarAlt,
  FaMapMarkerAlt,
  FaInfoCircle,
  FaExclamationTriangle,
  FaBell
} from "react-icons/fa";
import { API_CONFIG, getApiUrl } from "../utils/apiConfig";
import "./Admin-Users.css";
import "./Notification.css";
import "./Admin-Users-Performance.css"; 

// Use getApiUrl(...) so VITE_API_URL from env is used in production (Railway) and localhost in dev

function AdminUsers({ token }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All"); 
  const [roleFilter, setRoleFilter] = useState("All");
  const [notification, setNotification] = useState(null);
  
  // Prevent multiple simultaneous fetches
  const [isFetching, setIsFetching] = useState(false);
  
  // Cache and real-time update states
  const [lastFetchTime, setLastFetchTime] = useState(null);
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);
  const [showInitialLoader, setShowInitialLoader] = useState(true); // New state for initial loading screen
  const CACHE_DURATION = 30000; // 30 seconds cache
  
  // Modal states for verification
  const [selectedUser, setSelectedUser] = useState(null);
  const [isVerificationModalOpen, setIsVerificationModalOpen] = useState(false);
  const [userInfo, setUserInfo] = useState(null);
  const [infoLoading, setInfoLoading] = useState(false);
  const [checkingFields, setCheckingFields] = useState(false);
  // Create User modal states
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createFirstname, setCreateFirstname] = useState("");
  const [createLastname, setCreateLastname] = useState("");
  const [createEmail, setCreateEmail] = useState("");
  const [createPassword, setCreatePassword] = useState("");
  const [createRole, setCreateRole] = useState("Account"); // Account | Barangay Official | Responder
  const [createBarangay, setCreateBarangay] = useState("");
  const [createAvatarFile, setCreateAvatarFile] = useState(null);
  const [createAvatarPreview, setCreateAvatarPreview] = useState(null);
  const [isCreating, setIsCreating] = useState(false);
  // Bulk delete / selection state
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  // User deletion reason modal states
  const [isDeleteReasonOpen, setIsDeleteReasonOpen] = useState(false);
  const [deleteReason, setDeleteReason] = useState("");
  const [deleteReasonOther, setDeleteReasonOther] = useState("");

  // Notification handler
  const showNotification = useCallback((message, type = "success") => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 4000);
  }, []);

  // Optimized fetch with caching and incremental loading
  const fetchUsers = useCallback(async (force = false) => {
    // Check cache validity
    const now = Date.now();
    if (!force && lastFetchTime && (now - lastFetchTime) < CACHE_DURATION && initialLoadComplete) {
      console.log('📋 Using cached user data');
      return;
    }

    if (!token || isFetching) {
      setLoading(false);
      return;
    }

    // Only show loading spinner on initial load or forced refresh
    if (!initialLoadComplete) {
      setLoading(true);
    }
    setIsFetching(true);
    
    console.log('🔄 Fetching users at:', new Date().toLocaleTimeString());
    
    try {
      const startTime = performance.now();
      
      const response = await fetch(getApiUrl('/api/users/verification'), {
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch users');
      }

      const data = await response.json();
      if (data.status === "success") {
        setUsers(data.users || []);
        setLastFetchTime(now);
        
        if (!initialLoadComplete) {
          setInitialLoadComplete(true);
        }
        
        const loadTime = Math.round(performance.now() - startTime);
        console.log(`✅ Users loaded in ${loadTime}ms`);
      } else {
        throw new Error(data.message || 'Failed to fetch users');
      }
    } catch (error) {
      console.error('Error fetching users:', error);
      // Show error notification without causing re-render
      setNotification({ message: 'Failed to load users. Please try again.', type: 'error' });
      setTimeout(() => setNotification(null), 4000);
      setUsers([]);
    } finally {
      setLoading(false);
      setIsFetching(false);
      setShowInitialLoader(false);
    }
  }, [token, isFetching, lastFetchTime, initialLoadComplete, CACHE_DURATION]);

  // Debounce search input to prevent excessive filtering
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, 300); // 300ms delay

    return () => clearTimeout(timer);
  }, [search]);

  // Real-time update function for individual user changes
  const updateUserInState = useCallback((updatedUser) => {
    setUsers(prevUsers => 
      prevUsers.map(user => 
        user.id === updatedUser.id ? { ...user, ...updatedUser } : user
      )
    );
  }, []);



  // Auto-refresh timer for real-time updates
  useEffect(() => {
    if (!initialLoadComplete) return;

    const interval = setInterval(() => {
      console.log('⏰ Auto-refreshing user data...');
      fetchUsers(false); // Soft refresh (respects cache)
    }, 60000); // Refresh every minute

    return () => clearInterval(interval);
  }, [fetchUsers, initialLoadComplete]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  // Note: Removed toggleUserVerification function as we now only use the modal for verification

  // Fetch user detailed info for verification modal
  const fetchUserInfo = async (userId) => {
    if (!token) return;

    setInfoLoading(true);
    try {
      const response = await fetch(getApiUrl(`/api/users/${userId}/info`), {
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch user info');
      }

      const data = await response.json();
      if (data.status === "success") {
        setUserInfo(data.info);
      } else {
        throw new Error(data.message || 'Failed to fetch user info');
      }
    } catch (error) {
      console.error('Error fetching user info:', error);
      showNotification('Failed to load user information.', 'error');
      setUserInfo(null);
    } finally {
      setInfoLoading(false);
    }
  };

  // Open verification modal
  const openVerificationModal = (user) => {
    setSelectedUser(user);
    setIsVerificationModalOpen(true);
    fetchUserInfo(user.id);
  };

  // --- Create User Modal Helpers ---
  const barangaysList = [
    "Barretto", "East Bajac-Bajac", "East Tapinac", "Gordon Heights",
    "Kalaklan", "Mabayuan", "New Asinan", "New Banicain", "New Cabalan",
    "New Ilalim", "New Kababae", "New Kalalake", "Old Cabalan", "Pag-Asa",
    "Santa Rita", "West Bajac-Bajac", "West Tapinac",
  ];

  const openCreateModal = () => setIsCreateModalOpen(true);
  const closeCreateModal = () => {
    setIsCreateModalOpen(false);
    setCreateFirstname(""); setCreateLastname(""); setCreateEmail(""); setCreatePassword("");
    setCreateRole("Account"); setCreateBarangay(""); setCreateAvatarFile(null); setCreateAvatarPreview(null);
  };

  const toggleSelectionMode = () => {
    if (selectionMode) {
      setSelectedIds(new Set());
      setSelectionMode(false);
    } else {
      setSelectionMode(true);
    }
  };

  const toggleSelectUser = (userId) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  };

  // Open confirmation modal (instead of immediate browser confirm)
  const confirmDeleteSelected = () => {
    if (!selectedIds || selectedIds.size === 0) return;
    // First open the reason modal instead of going directly to confirmation
    setIsDeleteReasonOpen(true);
  };

  const closeDeleteReason = () => {
    setIsDeleteReasonOpen(false);
    setDeleteReason("");
    setDeleteReasonOther("");
  };

  const proceedToConfirmDelete = () => {
    // Close reason modal and open confirmation modal
    setIsDeleteReasonOpen(false);
    setIsDeleteConfirmOpen(true);
  };

  const performDeleteSelected = async () => {
    if (!selectedIds || selectedIds.size === 0) {
      setIsDeleteConfirmOpen(false);
      return;
    }

    setIsDeleting(true);
    try {
      const ids = Array.from(selectedIds);
      const finalReason = deleteReason === 'Other' ? deleteReasonOther : deleteReason;
      
      for (const id of ids) {
        try {
          const res = await fetch(getApiUrl(`/api/users/${id}`), {
            method: 'DELETE',
            headers: { 
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              deletion_reason: finalReason
            })
          });
          if (!res.ok) console.error('Failed to delete user', id, await res.text());
        } catch (e) {
          console.error('Delete request failed for', id, e);
        }
      }

      // Refresh user list after deletions
      setSelectionMode(false);
      setSelectedIds(new Set());
      setDeleteReason("");
      setDeleteReasonOther("");
      fetchUsers(true);
      showNotification('Selected users deleted', 'success');
    } catch (err) {
      console.error('Error deleting users:', err);
      showNotification('Error deleting selected users', 'error');
    } finally {
      setIsDeleting(false);
      setIsDeleteConfirmOpen(false);
    }
  };

  const handleCreateAvatarSelect = (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    setCreateAvatarFile(file);
    setCreateAvatarPreview(URL.createObjectURL(file));
  };

  const handleCreateUser = async () => {
    if (isCreating) return;
    // basic validation
    if (!createFirstname.trim() || !createLastname.trim() || !createEmail.trim() || !createRole) {
      showNotification('Please fill required fields (first name, last name, email, role)', 'error');
      return;
    }

    setIsCreating(true);
    try {
      const formData = new FormData();
      formData.append('firstname', createFirstname.trim());
      formData.append('lastname', createLastname.trim());
      formData.append('email', createEmail.trim());
      if (createPassword) formData.append('password', createPassword);
      formData.append('role', createRole);
  if ((createRole === 'Barangay Official' || createRole === 'Responder') && createBarangay) formData.append('address_barangay', createBarangay);
      if (createAvatarFile) formData.append('avatar', createAvatarFile);

      const res = await fetch(getApiUrl('/api/users'), {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`
          // NOTE: do not set Content-Type for FormData
        },
        body: formData
      });

      const data = await res.json();
      if (!res.ok || data.status !== 'success') {
        throw new Error(data.message || 'Failed to create user');
      }

      // Add created user to local state if provided
      if (data.user) {
        setUsers(prev => [data.user, ...prev]);
      } else {
        // fallback: refresh list
        fetchUsers(true);
      }

      showNotification('User created successfully', 'success');
      closeCreateModal();
    } catch (err) {
      console.error('Create user error:', err);
      showNotification(`Failed to create user: ${err.message}`, 'error');
    } finally {
      setIsCreating(false);
    }
  };

  // Close verification modal
  const closeVerificationModal = () => {
    setIsVerificationModalOpen(false);
    setSelectedUser(null);
    setUserInfo(null);
  };

  // Verify user fully - only available when all required fields are completed
  const verifyUserFully = async () => {
    if (!selectedUser || !token) return;

    // Double-check that all required fields are completed before verification
    if (!userInfo || !isInfoComplete(userInfo)) {
      const missingFields = getMissingFields(userInfo);
      showNotification(`❌ Cannot verify - Missing: ${missingFields.join(', ')}`, 'error');
      return;
    }

    try {
      showNotification('🔄 Verifying user with complete profile...', 'info');
      
      const response = await fetch(getApiUrl(`/api/users/${selectedUser.id}/full-verification`), {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          verified: true, // Set verified status to true
          fully_verified: true // Also send the backend field name for compatibility
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to verify user');
      }

      const data = await response.json();
      if (data.status === "success") {
        console.log('✅ Verification successful, updating local state for user:', selectedUser.id);
        
        // Real-time update: immediately update the user in state
        const updatedUser = { 
          ...selectedUser, 
          verified: true, 
          fully_verified: true 
        };
        updateUserInState(updatedUser);
        console.log('🔄 Local state updated, user now verified:', updatedUser);
        
        showNotification(`✅ ${selectedUser.firstname} ${selectedUser.lastname} successfully verified!`, 'success');
        closeVerificationModal();
        
        // Real-time update complete - no need to fetch from server
      } else {
        throw new Error(data.message || 'Failed to verify user');
      }
    } catch (error) {
      console.error('Error verifying user:', error);
      showNotification(`❌ Failed to verify user: ${error.message}`, 'error');
    }
  };

  // Check if user info is complete and get missing fields
  const isInfoComplete = (info) => {
    if (!info) return false;
    return !!(
      info.birthdate &&
      info.phone &&
      info.address_barangay &&
      info.address_street &&
      info.address_city &&
      info.address_province
    );
  };

  // Get missing fields for better user feedback
  const getMissingFields = (info) => {
    if (!info) return ['All required information is missing'];
    
    const missing = [];
    if (!info.birthdate) missing.push('Birthdate');
    if (!info.phone) missing.push('Phone number');
    if (!info.address_street) missing.push('Street address');
    if (!info.address_barangay) missing.push('Barangay');
    if (!info.address_city) missing.push('City');
    if (!info.address_province) missing.push('Province');
    
    return missing;
  };

  // Manual check for missing fields
  const checkMissingFields = () => {
    setCheckingFields(true);
    
    setTimeout(() => {
      const missing = getMissingFields(userInfo);
      
      if (missing.length === 0) {
        showNotification('✅ All required information is complete!', 'success');
      } else {
        showNotification(`⚠️ Missing: ${missing.join(', ')}`, 'caution');
      }
      
      setCheckingFields(false);
    }, 500); // Small delay for better UX
  };

  // Send verification reminder to user
  const sendVerificationReminder = async () => {
    if (!selectedUser || !token) return;

    try {
      showNotification('📧 Sending verification reminder...', 'info');
      
      // This would be a new endpoint to send reminder emails
      const response = await fetch(getApiUrl(`/api/users/${selectedUser.id}/verification-reminder`), {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to send reminder');
      }

      showNotification('✅ Verification reminder sent successfully!', 'success');
    } catch (error) {
      console.error('Error sending reminder:', error);
      showNotification('❌ Failed to send verification reminder', 'error');
    }
  };

  // Memoized filtered users to prevent unnecessary re-renders
  const filteredUsers = useMemo(() => {
    return users
      .filter((u) => (statusFilter === "All" ? true : 
        statusFilter === "Verified" ? (u.isverified && u.verified) : !(u.isverified && u.verified)))
      .filter((u) => (roleFilter === "All" ? true : u.role === roleFilter))
      .filter(
        (u) =>
          `${u.firstname} ${u.lastname}`.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
          u.email.toLowerCase().includes(debouncedSearch.toLowerCase())
      );
  }, [users, statusFilter, roleFilter, debouncedSearch]);

  // Memoized stats to calculate counts including barangay officials and responders
  const stats = useMemo(() => ({
    totalUsers: users.length,
    fullyVerifiedUsers: users.filter(u => u.isverified && u.verified).length,
    emailVerifiedUsers: users.filter(u => u.isverified && !u.verified).length,
    adminUsers: users.filter(u => u.role === "Admin").length,
    barangayOfficials: users.filter(u => u.role === "Barangay Official").length,
    responders: users.filter(u => u.role === "Responder").length
  }), [users]);

  return (
    <div className="admin-container">
      <div className="admin-header-row">
        <h2>User Management</h2>
        <div className="admin-header-actions">
          <button
            className="refresh-btn"
            onClick={openCreateModal}
            title="Create a new user"
            style={{ marginRight: 8 }}
          >
            Create User
          </button>
          <button
            className="danger-icon-btn"
            onClick={toggleSelectionMode}
            title={selectionMode ? 'Exit delete mode' : 'Select users to delete'}
            style={{ background: selectionMode ? '#ef4444' : 'transparent', color: selectionMode ? '#fff' : '#ef4444', border: selectionMode ? 'none' : '1px solid #ef4444', padding: '8px 10px', borderRadius: 8 }}
          >
            <FaTrashAlt />
          </button>
        </div>
      </div>

      {/* Selection toolbar */}
      {selectionMode && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 12, alignItems: 'center' }}>
          <div style={{ fontSize: 14 }}>{selectedIds.size} selected</div>
          <button className="cancel-btn" onClick={() => { setSelectionMode(false); setSelectedIds(new Set()); }}>Cancel</button>
          <button className="verify-btn" onClick={confirmDeleteSelected} style={{ background: '#ef4444', color: '#fff', marginLeft: 8 }}>{isDeleting ? 'Deleting...' : 'Delete Selected'}</button>
        </div>
      )}

      {/* Stats Cards */}
      <div className="admin-stats-grid">
        {/* 1. Total Users */}
        <div className="admin-stat-card">
          <div className="admin-stat-content">
            <FaUser className="admin-stat-icon" style={{ color: '#2d2d73' }} />
            <div className="admin-stat-text">
              <h4>Total Users</h4>
              <p>{stats.totalUsers}</p>
            </div>
          </div>
        </div>

        {/* 2. Fully Verified */}
        <div className="admin-stat-card verified">
          <div className="admin-stat-content">
            <FaCheckCircle className="admin-stat-icon" style={{ color: '#10b981' }} />
            <div className="admin-stat-text">
              <h4>Fully Verified</h4>
              <p>{stats.fullyVerifiedUsers}</p>
            </div>
          </div>
        </div>

        {/* 3. Email Verified */}
        <div className="admin-stat-card email-verified">
          <div className="admin-stat-content">
            <FaUserCheck className="admin-stat-icon" style={{ color: '#f59e0b' }} />
            <div className="admin-stat-text">
              <h4>Email Verified</h4>
              <p>{stats.emailVerifiedUsers}</p>
            </div>
          </div>
        </div>

        {/* 4. Admins */}
        <div className="admin-stat-card admin">
          <div className="admin-stat-content">
            <FaUser className="admin-stat-icon" style={{ color: '#8b5cf6' }} />
            <div className="admin-stat-text">
              <h4>Admins</h4>
              <p>{stats.adminUsers}</p>
            </div>
          </div>
        </div>

        {/* 5. Barangay Officials */}
        <div className="admin-stat-card barangay-official">
          <div className="admin-stat-content">
            <FaUser className="admin-stat-icon" style={{ color: '#2563eb' }} />
            <div className="admin-stat-text">
              <h4>Barangay Officials</h4>
              <p>{stats.barangayOfficials}</p>
            </div>
          </div>
        </div>

        {/* 6. Responders */}
        <div className="admin-stat-card responder">
          <div className="admin-stat-content">
            <FaUser className="admin-stat-icon" style={{ color: '#ef4444' }} />
            <div className="admin-stat-text">
              <h4>Responders</h4>
              <p>{stats.responders}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Search & Filter Controls */}
      <div className="admin-top-controls">
        <div className="admin-search-container">
          <input
            type="text"
            placeholder="Search users by name or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="admin-search-input"
          />
          <FaSearch className="admin-search-icon" />
        </div>
        <select 
          value={statusFilter} 
          onChange={(e) => setStatusFilter(e.target.value)}
          className="admin-filter-select"
        >
          <option value="All">All Status</option>
          <option value="Verified">Verified</option>
          <option value="Unverified">Unverified</option>
        </select>
        <select 
          value={roleFilter} 
          onChange={(e) => setRoleFilter(e.target.value)}
          className="admin-filter-select"
        >
          <option value="All">All Roles</option>
          <option value="Admin">Admin</option>
          <option value="Resident">Resident</option>
          <option value="Barangay Official">Barangay Official</option>
          <option value="Responder">Responder</option>
        </select>
      </div>

      {/* Users List */}
      {(loading || showInitialLoader) ? (
        <div className="admin-loading-container">
          <div className="admin-spinner"></div>
          <p className="admin-loading-text">Loading users...</p>
        </div>
      ) : filteredUsers.length > 0 ? (
        <div className="admin-users-grid">
            {filteredUsers.map((user) => {
              const isSelected = selectedIds.has(user.id);
              return (
              <div
                key={user.id}
                onClick={(e) => {
                  // If in selection mode, toggle selection. Ignore clicks on buttons inside the card.
                  if (selectionMode) {
                    const tag = (e.target && e.target.tagName) || '';
                    if (tag.toLowerCase() !== 'button' && tag.toLowerCase() !== 'svg' && tag.toLowerCase() !== 'path') {
                      toggleSelectUser(user.id);
                    }
                  }
                }}
                className={`admin-user-card ${
                  (user.isverified && user.verified) ? 'fully-verified' :
                  user.isverified ? 'email-verified' : 'unverified'
                } ${isSelected ? 'selected-card' : ''}`}
                style={isSelected ? { outline: '3px solid rgba(239,68,68,0.15)' } : {}}
              >
                {selectionMode && (
                  <div style={{ position: 'absolute', left: 8, top: 8 }}>
                    <input type="checkbox" checked={isSelected} readOnly onClick={() => toggleSelectUser(user.id)} />
                  </div>
                )}
                <div className="admin-user-header">
                  <div className="admin-user-info">
                    <img 
                      src={user.avatar_url || "/src/assets/profile.png"} 
                      alt="profile" 
                      className="admin-user-avatar"
                    />
                    <div className="admin-user-details">
                      <h4>{user.firstname} {user.lastname}</h4>
                      <p>{user.email}</p>
                    </div>
                  </div>
                  <span className={`admin-role-badge ${user.role.toLowerCase().replace(/\s+/g, '-')}`}>
                    {user.role}
                  </span>
                </div>

                <div className="admin-user-body">
                  <div className="admin-user-meta">
                    <div className="admin-user-meta-item">
                      <strong>Joined:</strong> {new Date(user.created_at).toLocaleDateString()}
                    </div>
                    <div className="admin-user-meta-item">
                      <strong>Address:</strong> {user.address_barangay || 'Not specified'}, {user.address_city || 'Olongapo'}
                    </div>
                  </div>
                </div>

                <div className="admin-user-footer">
                  <div className={`admin-verification-status ${
                    (user.isverified && user.verified) ? 'fully-verified' :
                    user.isverified ? 'email-verified' : 'unverified'
                  }`}>
                    {(user.isverified && user.verified) ? (
                      <><FaCheckCircle />Fully Verified</>
                    ) : user.isverified ? (
                      <><FaUserCheck />Email Verified</>
                    ) : (
                      <><FaTimesCircle />Unverified</>
                    )}
                  </div>
                  
                  <div className="admin-user-actions">
                    {user.role !== 'Admin' && (
                      <button
                        onClick={() => openVerificationModal(user)}
                        className="admin-btn admin-btn-primary"
                        title="Update User Verification Status"
                      >
                        <FaEdit /> Update Status
                      </button>
                    )}
                  </div>
                </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="admin-no-users">
            <h3>No users found</h3>
            <p>No users match your current search criteria.</p>
          </div>
        )}

      {/* Create User Modal */}
      {isCreateModalOpen && (
        <div className="modal-overlay" onClick={closeCreateModal}>
          <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
            <div className="admin-modal-header">
              <h3>Create New Account</h3>
              <button className="admin-modal-close" onClick={closeCreateModal}>×</button>
            </div>

            <div className="admin-modal-content">
              <div style={{ display: 'grid', gap: 12 }}>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input type="text" placeholder="First name" value={createFirstname} onChange={(e) => setCreateFirstname(e.target.value)} style={{ flex: 1, padding: 10, borderRadius: 8, border: '1px solid #e2e8f0' }} />
                  <input type="text" placeholder="Last name" value={createLastname} onChange={(e) => setCreateLastname(e.target.value)} style={{ flex: 1, padding: 10, borderRadius: 8, border: '1px solid #e2e8f0' }} />
                </div>

                <input type="email" placeholder="Email" value={createEmail} onChange={(e) => setCreateEmail(e.target.value)} style={{ padding: 10, borderRadius: 8, border: '1px solid #e2e8f0' }} />

                <input type="password" placeholder="Password (optional)" value={createPassword} onChange={(e) => setCreatePassword(e.target.value)} style={{ padding: 10, borderRadius: 8, border: '1px solid #e2e8f0' }} />

                <div style={{ display: 'flex', gap: 8 }}>
                  <select value={createRole} onChange={(e) => setCreateRole(e.target.value)} style={{ padding: 10, borderRadius: 8, border: '1px solid #e2e8f0', flex: 1 }}>
                    <option value="Account">Account</option>
                    <option value="Barangay Official">Barangay Official</option>
                    <option value="Responder">Responder</option>
                  </select>

                  {(createRole === 'Barangay Official' || createRole === 'Responder') && (
                    <select value={createBarangay} onChange={(e) => setCreateBarangay(e.target.value)} style={{ padding: 10, borderRadius: 8, border: '1px solid #e2e8f0', flex: 1 }}>
                      <option value="">Select Barangay</option>
                      {barangaysList.map(b => <option key={b} value={b}>{b}</option>)}
                    </select>
                  )}
                </div>

                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <label style={{ fontSize: 13, color: '#334155' }}>Avatar (optional)</label>
                    <input type="file" accept="image/*" onChange={handleCreateAvatarSelect} />
                  </div>
                  {createAvatarPreview && (
                    <img src={createAvatarPreview} alt="avatar preview" style={{ width: 64, height: 64, borderRadius: '50%', objectFit: 'cover', border: '1px solid #e2e8f0' }} />
                  )}
                </div>
              </div>
            </div>

            <div className="admin-modal-actions" style={{ justifyContent: 'flex-end' }}>
              <button className="cancel-btn" onClick={closeCreateModal} style={{ padding: '10px 16px', borderRadius: 8 }}>Cancel</button>
              <button className="verify-btn" onClick={handleCreateUser} style={{ marginLeft: 8, padding: '10px 16px', borderRadius: 8 }} disabled={isCreating}>{isCreating ? 'Creating...' : 'Create Account'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {isDeleteConfirmOpen && (
        <div className="modal-overlay" onClick={() => setIsDeleteConfirmOpen(false)}>
          <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
            <div className="admin-modal-header">
              <h3>Confirm Delete</h3>
              <button className="admin-modal-close" onClick={() => setIsDeleteConfirmOpen(false)}>×</button>
            </div>

            <div className="admin-modal-content">
              <p>Are you sure you want to permanently delete <strong>{selectedIds.size}</strong> selected user(s)? This action cannot be undone.</p>
              {deleteReason ? (
                <div style={{ margin: '12px 0', padding: '12px', background: '#fff7f7', borderRadius: 6, border: '1px solid #ffe0e0' }}>
                  <strong>Deletion Reason:</strong> <br/>
                  {deleteReason === 'Other' ? deleteReasonOther : deleteReason}
                </div>
              ) : null}
            </div>

            <div className="admin-modal-actions" style={{ justifyContent: 'flex-end' }}>
              <button className="cancel-btn" onClick={() => setIsDeleteConfirmOpen(false)} style={{ padding: '10px 16px', borderRadius: 8 }} disabled={isDeleting}>Cancel</button>
              <button className="verify-btn" onClick={performDeleteSelected} style={{ marginLeft: 8, padding: '10px 16px', borderRadius: 8, background: '#ef4444', color: '#fff' }} disabled={isDeleting}>{isDeleting ? 'Deleting...' : 'Yes, Delete Permanently'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Reason Modal: ask admin why the users are being deleted */}
      {isDeleteReasonOpen && (
        <div
          className="modal-overlay"
          onClick={!isDeleting ? closeDeleteReason : undefined}
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-reason-title"
          tabIndex="-1"
        >
          <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
            <div className="admin-modal-header">
              <h3 id="delete-reason-title">User Deletion Reason</h3>
              <button className="admin-modal-close" onClick={closeDeleteReason} disabled={isDeleting}>×</button>
            </div>

            <div className="admin-modal-content">
              <p>Please select the reason why these user(s) should be deleted. This helps with auditing and prevents misuse.</p>

              <label htmlFor="delete-reason-select" style={{ display: 'block', marginBottom: 8, fontWeight: '600' }}>Select reason</label>
              <select
                id="delete-reason-select"
                value={deleteReason}
                onChange={(e) => setDeleteReason(e.target.value)}
                style={{ width: '100%', padding: 8, marginBottom: 12, borderRadius: 6, border: '1px solid #ddd' }}
                disabled={isDeleting}
              >
                <option value="">-- Select a reason --</option>
                <option value="Account Compromise / Hacking">Account Compromise / Hacking</option>
                <option value="Violation of Community Guidelines">Violation of Community Guidelines</option>
                <option value="Spam / Malicious Activity">Spam / Malicious Activity</option>
                <option value="Inactive Account">Inactive Account</option>
                <option value="Duplicate Account">Duplicate Account</option>
                <option value="User Request">User Request for Account Deletion</option>
                <option value="Other">Other (provide details)</option>
              </select>

              {deleteReason === 'Other' && (
                <div style={{ marginBottom: 12 }}>
                  <label htmlFor="delete-reason-other" style={{ display: 'block', marginBottom: 6 }}>Details</label>
                  <input
                    id="delete-reason-other"
                    type="text"
                    value={deleteReasonOther}
                    onChange={(e) => setDeleteReasonOther(e.target.value)}
                    placeholder="Provide brief details (required)"
                    style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #ddd' }}
                    disabled={isDeleting}
                  />
                </div>
              )}
            </div>

            <div className="admin-modal-actions" style={{ justifyContent: 'flex-end', gap: 10 }}>
              <button onClick={closeDeleteReason} disabled={isDeleting} style={{ padding: '10px 16px', borderRadius: 8 }}>Cancel</button>
              <button
                onClick={proceedToConfirmDelete}
                disabled={isDeleting || !deleteReason || (deleteReason === 'Other' && !deleteReasonOther.trim())}
                style={{ backgroundColor: '#ef4444', color: '#fff', padding: '10px 16px', borderRadius: 8, border: 'none', cursor: 'pointer' }}
              >
                Continue to Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Verification Modal */}
      {isVerificationModalOpen && selectedUser && (
        <div className="modal-overlay" onClick={closeVerificationModal}>
          <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
            <div className="admin-modal-header">
              <h3>User Verification Review</h3>
              <button 
                className="admin-modal-close" 
                onClick={closeVerificationModal}
              >×</button>
            </div>

            <div className="admin-modal-content">
              {/* User Basic Info */}
              <div className="user-profile-section">
                <img 
                  src={selectedUser.avatar_url || "/src/assets/profile.png"} 
                  alt="profile" 
                  style={{
                    width: '80px',
                    height: '80px',
                    borderRadius: '50%',
                    objectFit: 'cover',
                    border: '3px solid #e2e8f0'
                  }}
                />
                <div className="modal-user-info">
                  <div className="modal-user-header">
                    <div className="modal-user-details">
                      <h4 style={{ margin: '0 0 4px 0', color: '#1e293b', fontSize: '20px', fontWeight: 600 }}>
                        {selectedUser.firstname} {selectedUser.lastname}
                      </h4>
                      <p style={{ margin: '0', color: '#64748b', fontSize: '14px' }}>
                        {selectedUser.email}
                      </p>
                    </div>
                    <span className={`modal-role-badge admin-role-badge ${selectedUser.role.toLowerCase().replace(/\s+/g, '-')}`}>
                      {selectedUser.role}
                    </span>
                  </div>
                  <div className="current-verification-status" style={{ marginTop: '12px' }}>
                    {(selectedUser.isverified && selectedUser.verified) ? (
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '6px 12px',
                        borderRadius: '8px',
                        fontSize: '13px',
                        fontWeight: 500,
                        background: 'rgba(16, 185, 129, 0.1)',
                        color: '#059669'
                      }}>
                        <FaCheckCircle /> Fully Verified
                      </span>
                    ) : selectedUser.isverified ? (
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '6px 12px',
                        borderRadius: '8px',
                        fontSize: '13px',
                        fontWeight: 500,
                        background: 'rgba(245, 158, 11, 0.1)',
                        color: '#d97706'
                      }}>
                        <FaUserCheck /> Email Verified Only
                      </span>
                    ) : (
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '6px 12px',
                        borderRadius: '8px',
                        fontSize: '13px',
                        fontWeight: 500,
                        background: 'rgba(239, 68, 68, 0.1)',
                        color: '#dc2626'
                      }}>
                        <FaTimesCircle /> Unverified
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Extended Info */}
              <div className="user-extended-info" style={{
                border: '1px solid #e2e8f0',
                borderRadius: '12px',
                padding: '20px',
                marginBottom: '24px'
              }}>
                <h5 style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  margin: '0 0 20px 0',
                  color: '#1e293b',
                  fontSize: '16px',
                  fontWeight: 600
                }}>
                  <FaInfoCircle /> Extended Information
                </h5>
                {infoLoading ? (
                  <div className="info-loading" style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    padding: '40px',
                    color: '#64748b'
                  }}>
                    <div style={{
                      width: '24px',
                      height: '24px',
                      border: '3px solid #e2e8f0',
                      borderTop: '3px solid #3b82f6',
                      borderRadius: '50%',
                      animation: 'spin 1s linear infinite',
                      marginBottom: '8px'
                    }}></div>
                    <p>Loading user information...</p>
                  </div>
                ) : userInfo ? (
                  <div className="info-grid" style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                    gap: '16px'
                  }}>
                    <div className="info-item" style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '12px',
                      padding: '12px',
                      background: '#f8fafc',
                      borderRadius: '8px'
                    }}>
                      <FaCalendarAlt style={{ color: '#3b82f6', fontSize: '16px', marginTop: '2px', flexShrink: 0 }} />
                      <div>
                        <label style={{
                          display: 'block',
                          fontSize: '12px',
                          fontWeight: 600,
                          color: '#64748b',
                          textTransform: 'uppercase',
                          letterSpacing: '0.5px',
                          marginBottom: '4px'
                        }}>Birthdate</label>
                        <p style={{ margin: 0, color: '#1e293b', fontSize: '14px', lineHeight: 1.5 }}>
                          {userInfo.birthdate ? new Date(userInfo.birthdate).toLocaleDateString() : 'Not provided'}
                        </p>
                      </div>
                    </div>
                    <div className="info-item" style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '12px',
                      padding: '12px',
                      background: '#f8fafc',
                      borderRadius: '8px'
                    }}>
                      <FaPhone style={{ color: '#3b82f6', fontSize: '16px', marginTop: '2px', flexShrink: 0 }} />
                      <div>
                        <label style={{
                          display: 'block',
                          fontSize: '12px',
                          fontWeight: 600,
                          color: '#64748b',
                          textTransform: 'uppercase',
                          letterSpacing: '0.5px',
                          marginBottom: '4px'
                        }}>Phone</label>
                        <p style={{ margin: 0, color: '#1e293b', fontSize: '14px', lineHeight: 1.5 }}>
                          {userInfo.phone || 'Not provided'}
                        </p>
                      </div>
                    </div>
                    <div className="info-item" style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '12px',
                      padding: '12px',
                      background: '#f8fafc',
                      borderRadius: '8px',
                      gridColumn: '1 / -1'
                    }}>
                      <FaMapMarkerAlt style={{ color: '#3b82f6', fontSize: '16px', marginTop: '2px', flexShrink: 0 }} />
                      <div>
                        <label style={{
                          display: 'block',
                          fontSize: '12px',
                          fontWeight: 600,
                          color: '#64748b',
                          textTransform: 'uppercase',
                          letterSpacing: '0.5px',
                          marginBottom: '4px'
                        }}>Complete Address</label>
                        <p style={{ margin: 0, color: '#1e293b', fontSize: '14px', lineHeight: 1.5 }}>
                          {userInfo.address_street && `${userInfo.address_street}, `}
                          {userInfo.address_barangay}, {userInfo.address_city}, {userInfo.address_province}
                        </p>
                      </div>
                    </div>
                    {userInfo.bio && (
                      <div className="info-item" style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '12px',
                        padding: '12px',
                        background: '#f8fafc',
                        borderRadius: '8px',
                        gridColumn: '1 / -1'
                      }}>
                        <FaInfoCircle style={{ color: '#3b82f6', fontSize: '16px', marginTop: '2px', flexShrink: 0 }} />
                        <div>
                          <label style={{
                            display: 'block',
                            fontSize: '12px',
                            fontWeight: 600,
                            color: '#64748b',
                            textTransform: 'uppercase',
                            letterSpacing: '0.5px',
                            marginBottom: '4px'
                          }}>Bio</label>
                          <p style={{ margin: 0, color: '#1e293b', fontSize: '14px', lineHeight: 1.5 }}>
                            {userInfo.bio}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="no-info" style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    padding: '40px',
                    color: '#64748b'
                  }}>
                    <FaExclamationTriangle style={{ fontSize: '32px', marginBottom: '12px', color: '#9ca3af' }} />
                    <p>No extended information provided by user</p>
                  </div>
                )}

                {/* Information Completeness Check */}
                {userInfo && (
                  <div className="info-completeness" style={{
                    marginTop: '20px',
                    padding: '16px',
                    background: isInfoComplete(userInfo) ? '#f0fdf4' : '#fef3c7',
                    borderRadius: '8px',
                    border: `1px solid ${isInfoComplete(userInfo) ? '#bbf7d0' : '#fde68a'}`
                  }}>
                    <h6 style={{ margin: '0 0 12px 0', color: '#1e293b', fontSize: '14px', fontWeight: 600 }}>
                      Information Completeness Check:
                    </h6>
                    <div className="completeness-indicator" style={{ fontSize: '14px' }}>
                      {isInfoComplete(userInfo) ? (
                        <div style={{ color: '#059669', display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <FaCheckCircle />
                          <span style={{ fontWeight: '500' }}>All required information provided ✅</span>
                        </div>
                      ) : (
                        <div style={{ color: '#d97706' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                            <FaExclamationTriangle />
                            <span style={{ fontWeight: '500' }}>Missing required information:</span>
                          </div>
                          <ul style={{ 
                            margin: '0 0 0 24px', 
                            padding: 0, 
                            listStyle: 'disc',
                            color: '#b45309'
                          }}>
                            {getMissingFields(userInfo).map((field, index) => (
                              <li key={index} style={{ marginBottom: '4px' }}>{field}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="admin-modal-actions">
              {/* Left side - Check Fields button */}
              <div style={{ display: 'flex', gap: '8px' }}>
                {userInfo && (
                  <button 
                    className="check-fields-btn" 
                    onClick={checkMissingFields}
                    disabled={checkingFields}
                    style={{
                      padding: '10px 16px',
                      borderRadius: '6px',
                      fontSize: '13px',
                      fontWeight: 500,
                      cursor: checkingFields ? 'not-allowed' : 'pointer',
                      background: checkingFields ? '#f8fafc' : '#3b82f6',
                      color: checkingFields ? '#94a3b8' : 'white',
                      border: 'none',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      transition: 'all 0.3s ease'
                    }}
                    title="Check for missing required fields"
                  >
                    {checkingFields ? (
                      <>
                        <div style={{
                          width: '12px',
                          height: '12px',
                          border: '2px solid #e2e8f0',
                          borderTop: '2px solid #3b82f6',
                          borderRadius: '50%',
                          animation: 'spin 1s linear infinite'
                        }}></div>
                        Checking...
                      </>
                    ) : (
                      <>
                        <FaInfoCircle /> Check Fields
                      </>
                    )}
                  </button>
                )}
              </div>

              {/* Right side - Action buttons */}
              <div style={{ display: 'flex', gap: '12px' }}>
                <button 
                  className="cancel-btn" 
                  onClick={closeVerificationModal}
                  style={{
                    padding: '12px 24px',
                    borderRadius: '8px',
                    fontSize: '14px',
                    fontWeight: 500,
                    cursor: 'pointer',
                    background: '#f1f5f9',
                    color: '#64748b',
                    border: '1px solid #e2e8f0',
                    transition: 'all 0.3s ease'
                  }}
                >
                  Cancel
                </button>

                {/* Show appropriate action button based on user status */}
                {selectedUser.role !== 'Admin' && (
                  <>
                    {/* If user is fully verified - no action needed */}
                    {(selectedUser.isverified && selectedUser.verified) ? (
                      <div style={{
                        padding: '12px 24px',
                        borderRadius: '8px',
                        fontSize: '14px',
                        fontWeight: 500,
                        background: 'rgba(16, 185, 129, 0.1)',
                        color: '#059669',
                        border: '1px solid rgba(16, 185, 129, 0.3)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}>
                        <FaCheckCircle /> Already Verified
                      </div>
                    ) : userInfo && isInfoComplete(userInfo) ? (
                      /* User has complete info - show verify button */
                      <button 
                        className="verify-btn" 
                        onClick={verifyUserFully}
                        title="Mark user as fully verified - all required fields are complete"
                        style={{
                          width: 'auto',
                          padding: '12px 24px',
                          borderRadius: '8px',
                          fontSize: '14px',
                          fontWeight: 500,
                          cursor: 'pointer',
                          background: '#10b981',
                          color: 'white',
                          border: 'none',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          transition: 'all 0.3s ease'
                        }}
                        onMouseEnter={(e) => e.target.style.background = '#059669'}
                        onMouseLeave={(e) => e.target.style.background = '#10b981'}
                      >
                        <FaCheckCircle /> Verify
                      </button>
                    ) : (
                      /* User has incomplete info - show reminder button */
                      <button 
                        className="remind-btn" 
                        onClick={sendVerificationReminder}
                        style={{
                          width: 'auto',
                          padding: '12px 24px',
                          borderRadius: '8px',
                          fontSize: '14px',
                          fontWeight: 500,
                          cursor: 'pointer',
                          background: '#f59e0b',
                          color: 'white',
                          border: 'none',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          transition: 'all 0.3s ease'
                        }}
                        title="Send reminder to complete profile"
                        onMouseEnter={(e) => e.target.style.background = '#d97706'}
                        onMouseLeave={(e) => e.target.style.background = '#f59e0b'}
                      >
                        <FaBell style={{ fontSize: '12px' }} /> Notify User
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Notification with proper styling */}
      {notification && (
        <div className={`notif notif-${notification.type}`} style={{
          position: 'fixed',
          top: '20px',
          right: '20px',
          maxWidth: '400px',
          padding: '16px 20px',
          borderRadius: '8px',
          fontWeight: '500',
          boxShadow: '0 4px 12px rgba(0,0,0,0.25)',
          zIndex: 9999,
          animation: 'slideFadeIn 0.3s ease-in-out'
        }}>
          {notification.message}
        </div>
      )}


    </div>
  );
}

export default AdminUsers;