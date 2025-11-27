import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { FaEdit, FaSignOutAlt, FaTrashAlt, FaCheckCircle, FaTimesCircle, FaUserCheck } from "react-icons/fa";
import "./Profile.css"; // Ensure this file contains the new CSS
import "./Notifications.css"; // This is the file with the notif classes
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css"
import { format, parseISO } from "date-fns";
import axios from "axios";
import LoadingScreen from "./LoadingScreen";
import { API_CONFIG, getApiUrl } from "../utils/apiConfig";

function Profile({ token }) {
    const navigate = useNavigate();

    // ------------------- STATES -------------------
    const [user, setUser] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [profilePic, setProfilePic] = useState(null);
    const [fullScreenImage, setFullScreenImage] = useState(null);
    const [showModal, setShowModal] = useState(null); // "header", "about", "personal"
    const [showDeleteAccount, setShowDeleteAccount] = useState(false);
    const [notifications, setNotifications] = useState([]);
    const [reports, setReports] = useState([]);
    const [reportsSubmitted, setReportsSubmitted] = useState(0);
    const [reportsResolved, setReportsResolved] = useState(0);
    const [overlayExited, setOverlayExited] = useState(false);

    const [editProfileData, setEditProfileData] = useState({
        firstname: "",
        lastname: "",
        bio: "",
        phone: "",
        address_street: "",
        address_barangay: "",
        email: "",
        birthdate: "",
    });

    const API_URL = getApiUrl(API_CONFIG.endpoints.profile);
    const REPORTS_URL = getApiUrl(API_CONFIG.endpoints.reports);
    const STATS_URL = getApiUrl(API_CONFIG.endpoints.stats);
    const barangays = [
        "All", "Barretto", "East Bajac-Bajac", "East Tapinac", "Gordon Heights",
        "Kalaklan", "Mabayuan", "New Asinan", "New Banicain", "New Cabalan",
        "New Ilalim", "New Kababae", "New Kalalake", "Old Cabalan", "Pag-Asa",
        "Santa Rita", "West Bajac-Bajac", "West Tapinac",
    ];

    // Show empty string while loading, only show placeholder if loading finished and no data
    const displayField = (field, placeholder) => {
        if (isLoading) return "";
        return field || placeholder;
    };

    const getRoleBadgeClass = (role) => {
        switch (role) {
            case "Admin":
                return "admin";
            case "Barangay Official":
                return "barangay-official";
            case "Responder":
                return "responder";
            case "Resident":
            default:
                return "resident";
        }
    };

    // MODIFIED: Adjusting notification type logic to match CSS
    const addNotification = (message, type = "error") => {
        const id = Date.now();
        setNotifications((prev) => [...prev, { id, message, type }]);
        setTimeout(() => {
            setNotifications((prev) => prev.filter((n) => n.id !== id));
        }, 5000);
    };

    // ------------------- FETCH PROFILE -------------------
    useEffect(() => {
        if (!token) return;

        const fetchProfile = async () => {
            try {
                const res = await fetch(API_URL, {
                    headers: { Authorization: `Bearer ${token}` },
                });
                const data = await res.json();
                if (data.status === "success") {
                    const profile = data.profile;
                    setUser({
                        ...profile,
                        address_barangay: profile.address_barangay || "Barretto",
                        address_city: profile.address_city || "Olongapo",
                        role: profile.role || "Resident",
                        contact: profile.phone || "",
                        phone: profile.phone || "",
                    });
                    setEditProfileData({
                        firstname: profile.firstname || "",
                        lastname: profile.lastname || "",
                        bio: profile.bio || "",
                        phone: profile.phone || "",
                        address_street: profile.address_street || "",
                        address_barangay: profile.address_barangay || "Barretto",
                        email: profile.email || "",
                        birthdate: profile.birthdate || "",
                        role: profile.role || "Resident",
                    });
                }
            } catch (err) {
                console.error("Failed to fetch profile:", err);
                addNotification("Failed to load profile.", "error");
            } finally {
                setIsLoading(false);
            }
        };

        const fetchReports = async () => {
            try {
                const res = await fetch(`${REPORTS_URL}`, {
                    headers: { Authorization: `Bearer ${token}` },
                });
                const data = await res.json();
                if (data.status === "success") {
                    setReports(data.reports);
                } else {
                    addNotification("Failed to fetch reports.", "error");
                }
            } catch (err) {
                console.error("Failed to fetch reports:", err);
            }
        };

        const fetchUserStats = async () => {
            try {
                const res = await axios.get(`${STATS_URL}`, {
                    headers: { Authorization: `Bearer ${token}` },
                });
                if (res.data.status === "success") {
                    setReportsSubmitted(res.data.totalReports);
                    setReportsResolved(res.data.resolved);
                }
            } catch (err) {
                console.error("Failed to fetch user stats:", err);
            }
        };

        fetchProfile();
        fetchReports();
        fetchUserStats();
    }, [token, API_URL, REPORTS_URL, STATS_URL]);

    // ------------------- UPDATE REPORTS STATS -------------------
    useEffect(() => {
        if (!user) return;
        const userReports = reports.filter(r => String(r.user_id) === String(user.id));
        setReportsSubmitted(userReports.length);
        setReportsResolved(userReports.filter(r => (r.status || "").toLowerCase() === "resolved").length);
    }, [reports, user]);

    useEffect(() => {
        if (isLoading) {
            setOverlayExited(false);
        }
    }, [isLoading]);

    const loadingFeatures = useMemo(
        () => [
            {
                title: "Building your profile",
                description: "Loading personal details, activity stats, and preferences.",
            },
            {
                title: "Community insights",
                description: "Preparing your reports, verifications, and badges for review.",
            },
        ],
        []
    );

    // ------------------- PROFILE PICTURE -------------------
    const handlePicUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        setProfilePic(URL.createObjectURL(file));

        const formData = new FormData();
        formData.append("avatar", file);
        try {
            const res = await fetch(`${API_URL}/upload-avatar`, {
                method: "POST",
                headers: { Authorization: `Bearer ${token}` },
                body: formData,
            });
            const data = await res.json();
            if (data.status === "success") {
                setProfilePic(null);
                setUser(prev => ({ ...prev, avatar_url: data.url || data.avatar_url }));
            }
        } catch (err) {
            console.error("Failed to upload avatar:", err);
        }
    };

    // ------------------- DELETE ACCOUNT -------------------
    const handleDeleteAccount = async () => {
        try {
            const res = await fetch(API_URL, {
                method: "DELETE",
                headers: { Authorization: `Bearer ${token}` },
            });
            const data = await res.json();
            if (data.status === "success") {
                navigate("/login"); // cascades to info & reports
            } else {
                addNotification("Failed to delete account. Please try again.", "error");
            }
        } catch (err) {
            console.error("Failed to fetch profile:", err);
        }
    };

    // ------------------- UPDATE PROFILE -------------------
    const handleProfileUpdate = async () => {
        if (!user) return;

        let updateFields = {};

        // ---------------- HEADER MODAL ----------------
        if (showModal === "header") {
            const { firstname, lastname, address_barangay } = editProfileData;
            if (firstname !== user.firstname) updateFields.firstname = firstname;
            if (lastname !== user.lastname) updateFields.lastname = lastname;
            if (address_barangay !== user.address_barangay)
                updateFields.address_barangay = address_barangay;

            // Optional: fixed city, send only if it differs
            if ((editProfileData.address_city || "Olongapo City") !== (user.address_city || "Olongapo City"))
                updateFields.address_city = editProfileData.address_city || "Olongapo City";
        }

        // ---------------- ABOUT MODAL ----------------
        else if (showModal === "about") {
            if (editProfileData.bio !== user.bio) updateFields.bio = editProfileData.bio;
        }

        // ---------------- PERSONAL MODAL ----------------
        else if (showModal === "personal") {
            const { email, phone, address_street, birthdate } = editProfileData;
            if (email !== user.email) updateFields.email = email;
            if (phone !== user.phone) updateFields.phone = phone;
            if (address_street !== user.address_street) updateFields.address_street = address_street;
            if (birthdate !== user.birthdate) updateFields.birthdate = birthdate;
        }

        // ---------------- NO CHANGES ----------------
        if (Object.keys(updateFields).length === 0) {
            addNotification("No changes detected.", "info");
            setShowModal(null);
            return;
        }

        try {
            const res = await fetch(API_URL, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify(updateFields),
            });

            const data = await res.json();

            if (data.status === "success") {
                setUser((prev) => ({
                    ...prev,
                    ...data.profile,
                    avatar_url: data.profile.avatar_url || prev.avatar_url,
                    role: prev?.role || "Resident",
                    phone: data.profile.phone ?? prev.phone ?? "",      // main contact field
                    address_street: data.profile.address_street ?? prev.address_street ?? "",
                    address_barangay: data.profile.address_barangay ?? prev.address_barangay ?? "",
                    birthdate: data.profile.birthdate ?? prev.birthdate ?? "",
                    email: data.profile.email ?? prev.email ?? "",
                }));

                setEditProfileData((prev) => ({
                    ...prev,
                    ...data.profile,
                    phone: data.profile.phone ?? prev.phone ?? "",
                    address_street: data.profile.address_street ?? prev.address_street ?? "",
                    address_barangay: data.profile.address_barangay ?? prev.address_barangay ?? "",
                    birthdate: data.profile.birthdate ?? prev.birthdate ?? "",
                    email: data.profile.email ?? prev.email ?? "",
                }));

                setShowModal(null);
                addNotification("✓ Profile updated successfully!", "success");
            }
            else {
                addNotification("Failed to update profile.", "error");
                console.error(data);
            }
        } catch (err) {
            addNotification("Server error.", "error");
            console.error(err);
        }
    };

    // Prepare main page content then conditionally show inline loader
    const safeUser = user || {};

    const mainContent = (
        <div className={`profile-page ${overlayExited ? "overlay-exited" : ""}`}>
            {/* MODIFIED: Adjusted notification JSX to use provided CSS classes */}
            {notifications.map((notif) => (
                <div key={notif.id} className={`notif notif-${notif.type}`}>
                    {notif.message}
                </div>
            ))}

            {/* HEADER - Apply fade-in-up animation and stagger delay */}
            <div className="profile-header-card fade-in-up animate-up" style={{ animationDelay: '0s' }}>
                <button
                    type="button"
                    className="edit-card-button"
                    onClick={() => setShowModal("header")}
                    title="Edit basic profile details"
                    aria-label="Edit basic profile details"
                >
                    <FaEdit />
                    <span>Edit</span>
                </button>
                <div className="profile-header-info">
                    <div className="profile-avatar-frame">
                        <img
                            src={
                                isLoading 
                                    ? "" 
                                    : (profilePic ? profilePic : safeUser?.avatar_url || "/default-avatar.png")
                            }
                            alt="Profile"
                            className="profile-avatar"
                            style={{ visibility: isLoading ? 'hidden' : 'visible' }}
                        />
                    </div>
                    <div className="profile-name profile-header-details">
                        <div className="profile-header-top">
                            <h2>
                                {displayField(safeUser.firstname, "No Name")} {displayField(safeUser.lastname, "")}
                            </h2>
                        </div>
                        <p className="profile-location">
                            {displayField(safeUser.address_barangay, "No barangay selected")}, Olongapo City
                        </p>
                        <div className="profile-badges">
                            {isLoading ? (
                                <>
                                    <span className="admin-role-badge resident">Loading...</span>
                                    <span className="admin-verification-status email-verified">
                                        <FaCheckCircle />Loading...
                                    </span>
                                </>
                            ) : (
                                <>
                                    <span className={`admin-role-badge ${getRoleBadgeClass(safeUser.role)}`}>{safeUser.role}</span>
                                    <span
                                        className={`admin-verification-status ${
                                            safeUser.verified ? "fully-verified" : "email-verified"
                                        }`}
                                    >
                                        {safeUser.verified ? (
                                            <><FaCheckCircle />Verified</>
                                        ) : (
                                            <><FaCheckCircle />Email Verified</>
                                        )}
                                    </span>
                                </>
                            )}
                        </div>
                        <div className="profile-header-actions">
                            <label className="upload-btn" title="Change photo">
                                Change Photo
                                <input type="file" accept="image/*" onChange={handlePicUpload} hidden />
                            </label>
                            <button
                                className="icon-btn trash-btn"
                                onClick={() => setShowDeleteAccount(true)}
                                title="Delete Account"
                            >
                                <FaTrashAlt />
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* CONTENT */}
            <div className="profile-content">
                {/* SIDEBAR */}
                <div className="profile-sidebar">
                    {/* Card 1 - Apply stagger delay */}
                    <div className="profile-card fade-in-up animate-up" style={{ animationDelay: '0.1s' }}>
                        <div className="card-header">
                            <h3>About</h3>
                            <button
                                type="button"
                                className="edit-action"
                                onClick={() => setShowModal("about")}
                                title="Edit about section"
                                aria-label="Edit about section"
                            >
                                <FaEdit />
                            </button>
                        </div>
                        <p>{displayField(safeUser.bio, "No information added yet.")}</p>
                    </div>

                    {/* Card 2 - Apply stagger delay */}
                    <div className="profile-card fade-in-up animate-up" style={{ animationDelay: '0.2s' }}>
                        <div className="card-header">
                            <h3>Personal Info</h3>
                            <button
                                type="button"
                                className="edit-action"
                                onClick={() => setShowModal("personal")}
                                title="Edit personal information"
                                aria-label="Edit personal information"
                            >
                                <FaEdit />
                            </button>
                        </div>
                        <p>
                            <strong>Email:</strong> {displayField(safeUser.email, "No info")}
                        </p>
                        <p>
                            <strong>Phone:</strong> {displayField(safeUser.phone, "No info")}
                        </p>
                        <p>
                            <strong>Address:</strong> {displayField(safeUser.address_street, "No location")}
                        </p>
                        <p>
                            <strong>City:</strong> Olongapo City
                        </p>
                        <p>
                            <strong>Birthday:</strong>{" "}
                            {safeUser.birthdate
                                ? format(parseISO(safeUser.birthdate), "MMMM d, yyyy") // "1999-07-15" → "July 15, 1999"
                                : "No birthday set"}
                        </p>
                    </div>

                    {/* Profile Card */}
                    <div className="profile-card fade-in-up animate-up" style={{ animationDelay: '0.3s' }}>
                        <div className="card-header">
                            <h3>
                                Role & Status
                            </h3>
                        </div>
                        <p>
                            <strong>Role:</strong>{" "}
                            {isLoading ? (
                                <span className="admin-role-badge resident">Loading...</span>
                            ) : (
                                <span className={`admin-role-badge ${getRoleBadgeClass(safeUser.role)}`}>
                                    {safeUser.role}
                                </span>
                            )}
                        </p>
                        {safeUser.role === "Barangay Official" && safeUser.address_barangay && (
                            <p>
                                <strong>Assigned Barangay:</strong> {safeUser.address_barangay}
                            </p>
                        )}
                        <p>
                            <strong>Verification Status:</strong>{" "}
                            {isLoading ? (
                                <span className="admin-verification-status email-verified">
                                    <FaCheckCircle />Loading...
                                </span>
                            ) : (
                                <span
                                    className={`admin-verification-status ${
                                        safeUser.verified ? "fully-verified" : "email-verified"
                                    }`}
                                >
                                    {safeUser.verified ? (
                                        <><FaCheckCircle />Verified</>
                                    ) : (
                                        <><FaCheckCircle />Email Verified</>
                                    )}
                                </span>
                            )}
                        </p>
                    </div>

                    {/* Activity Card - Only show for Residents */}
                    {safeUser.role === "Resident" && (
                        <div className="profile-card fade-in-up animate-up" style={{ animationDelay: '0.4s' }}>
                            <h3>Activity</h3>
                            <p>📌 Reports Submitted: <strong>{reportsSubmitted}</strong></p>
                            <p>✅ Reports Resolved: <strong>{reportsResolved}</strong></p>
                        </div>
                    )}
                </div>
            </div>

            {/* ------------------- PROFILE MODAL ------------------- */}
            {showModal && (
                <div className="modal-overlay">
                    <div className="modal">
                        <h2>Edit Profile</h2>

                        {/* HEADER EDIT */}
                        {showModal === "header" && (
                            <div className="address-fields">
                                <label htmlFor="firstname">First Name:</label>
                                <input
                                    placeholder="First Name"
                                    value={editProfileData.firstname}
                                    onChange={(e) =>
                                        setEditProfileData({ ...editProfileData, firstname: e.target.value })
                                    }
                                />
                                <label htmlFor="lastname">Last Name:</label>
                                <input
                                    placeholder="Last Name"
                                    value={editProfileData.lastname}
                                    onChange={(e) =>
                                        setEditProfileData({ ...editProfileData, lastname: e.target.value })
                                    }
                                />
                                <label htmlFor="barangay">Barangay:</label>
                                <select
                                    value={editProfileData.address_barangay || "No barangay set"}
                                    onChange={(e) =>
                                        setEditProfileData({ ...editProfileData, address_barangay: e.target.value })
                                    }
                                >
                                    <option value="No barangay set" disabled>Select barangay</option>
                                    {barangays.filter((b) => b !== "All").map((b) => (
                                        <option key={b} value={b}>{b}</option>
                                    ))}
                                </select>
                                <label htmlFor="city">City:</label>
                                <input value="Olongapo City" disabled className="readonly-field" />
                            </div> 
                        )}

                        {/* ABOUT */}
                        {showModal === "about" && (
                            <textarea
                                placeholder="About Me"
                                value={editProfileData.bio}
                                onChange={(e) =>
                                    setEditProfileData({ ...editProfileData, bio: e.target.value })
                                }
                            />
                        )}

                        {/* PERSONAL */}
                        {showModal === "personal" && (
                            <div className="address-fields">
                                <label htmlFor="email">Email:</label>
                                <input
                                    placeholder="Email"
                                    value={editProfileData.email}
                                    onChange={(e) =>
                                        setEditProfileData({ ...editProfileData, email: e.target.value })
                                    }
                                />
                                <label htmlFor="phone">Phone:</label>
                                <input
                                    placeholder="Phone"
                                    value={editProfileData.phone}
                                    onChange={(e) =>
                                        setEditProfileData({ ...editProfileData, phone: e.target.value })
                                    }
                                />
                                <label htmlFor="address">Address:</label>
                                <input
                                    placeholder="Address"
                                    value={editProfileData.address_street}
                                    onChange={(e) =>
                                        setEditProfileData({ ...editProfileData, address_street: e.target.value })
                                    }
                                />
                                <label htmlFor="city">City</label>
                                <input value="Olongapo City" disabled className="readonly-field" />
                                <label>Birthdate:</label>
                                <DatePicker
                                    selected={
                                        editProfileData.birthdate
                                            ? parseISO(editProfileData.birthdate)
                                            : null
                                    }
                                    onChange={(date) =>
                                        setEditProfileData({
                                            ...editProfileData,
                                            birthdate: format(date, "yyyy-MM-dd"),
                                        })
                                    }
                                    dateFormat="yyyy-MM-dd"
                                    showYearDropdown
                                    scrollableYearDropdown
                                />
                            </div>
                        )}

                        {/* MODAL ACTIONS */}
                        <div className="modal-buttons">
                            <button onClick={() => setShowModal(null)}>Cancel</button>
                            <button onClick={handleProfileUpdate}>Save</button>
                        </div>
                    </div>
                </div>
            )}

            {/* ------------------- DELETE ACCOUNT MODAL ------------------- */}
            {showDeleteAccount && (
                <div className="modal-overlay">
                    <div className="modal-content">
                        <p>Are you sure you want to delete your account? This cannot be undone.</p>
                        <div className="modal-actions">
                            <button onClick={handleDeleteAccount} style={{ background: "#e74c3c", color: "#fff" }}>
                                Yes, Delete
                            </button>
                            <button onClick={() => setShowDeleteAccount(false)}>Cancel</button>
                        </div>
                    </div>
                </div>
            )}

            {/* ------------------- FULLSCREEN IMAGE MODAL ------------------- */}
            {fullScreenImage && (
                <div
                    className="fullscreen-modal"
                    onClick={() => setFullScreenImage(null)}
                >
                    <img src={fullScreenImage} alt="fullscreen" className="fullscreen-image" />
                </div>
            )}
        </div>
    );

    return (
        <LoadingScreen
            variant="inline"
            features={loadingFeatures}
            title={isLoading ? "Loading profile..." : undefined}
            subtitle={isLoading ? "Fetching your account details" : undefined}
            stage={isLoading ? "loading" : "exit"}
            successTitle="Profile Ready!"
            inlineOffset="22vh"
            onExited={() => setOverlayExited(true)}
        >
            {mainContent}
        </LoadingScreen>
    );
}

export default Profile;