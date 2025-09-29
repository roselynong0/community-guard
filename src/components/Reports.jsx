import React, { useState, useEffect } from "react";
import "./Reports.css";
import { FaEdit, FaTrashAlt } from "react-icons/fa";

function Reports() {
  const [reports, setReports] = useState([]);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [barangay, setBarangay] = useState("All");
  const [sort, setSort] = useState("latest");
  const [showHistory, setShowHistory] = useState(false);
  const [previewImage, setPreviewImage] = useState(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);

  const [newReport, setNewReport] = useState({
    title: "",
    description: "",
    category: "Concern",
    barangay: "Barretto",
    addressStreet: "",
    images: [],
    date: new Date().toISOString(),
    user: "user1",
  });

  const [editReportId, setEditReportId] = useState(null);

  // Mock user
  const currentUser = "user1";
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [expandedPosts, setExpandedPosts] = useState([]);

  useEffect(() => {
    const dummyReports = [
      {
        id: 1,
        title: "Pickpocket Incident Near Market",
        category: "Crime",
        barangay: "East Tapinac",
        addressStreet: "Public Market St",
        date: "2025-09-09T14:20:00",
        description:
          "A pickpocketing incident happened near the market. Multiple residents reported losing wallets and phones around 2PM. Please be vigilant in crowded areas.",
        user: "user2",
        status: "Resolved", 
        images: [
          "https://picsum.photos/id/401/400/300",
          "https://picsum.photos/id/402/400/300",
        ],
      },
      {
        id: 2,
        title: "Fallen Electric Post",
        category: "Hazard",
        barangay: "Santa Rita",
        addressStreet: "45 Rizal Avenue",
        date: "2025-09-08T22:00:00",
        description:
          "An electric post fell after the heavy rains last night, blocking the main road and posing danger to vehicles and pedestrians. Avoid the area until cleared.",
        user: "user1",
        status: "Ongoing", 
        images: ["https://picsum.photos/id/403/400/300"],
      },
      {
        id: 3,
        title: "Garbage Overflowing Bins",
        category: "Concern",
        barangay: "New Cabalan",
        addressStreet: "Corner of Magsaysay St",
        date: "2025-09-08T18:40:00",
        description:
          "The garbage bins along the main street have been overflowing for days, causing a foul smell and attracting stray animals. Requesting immediate clean-up.",
        user: "user1",
        status: "Pending",
        images: [
          "https://picsum.photos/id/404/400/300",
          "https://picsum.photos/id/405/400/300",
          "https://picsum.photos/id/406/400/300",
          "https://picsum.photos/id/407/400/300",
        ],
      },
      {
        id: 4,
        title: "Lost Wallet",
        category: "Lost&Found",
        barangay: "Barretto",
        addressStreet: "Near St. Joseph Church",
        date: "2025-09-07T10:15:00",
        description:
          "A black leather wallet was lost near the church. Contains IDs and some cash. Please return if found.",
        user: "user2",
        status: "Pending", 
        images: [
          "https://picsum.photos/id/404/400/300",
          "https://picsum.photos/id/405/400/300",
          "https://picsum.photos/id/406/400/300",
        ],
      },
    ];
    setReports(dummyReports);
  }, []);

  const barangays = [
    "All",
    "Barretto",
    "East Bajac-Bajac",
    "East Tapinac",
    "Gordon Heights",
    "Kalaklan",
    "Mabayuan",
    "New Asinan",
    "New Banicain",
    "New Cabalan",
    "New Ilalim",
    "New Kababae",
    "New Kalalake",
    "Old Cabalan",
    "Pag-Asa",
    "Santa Rita",
    "West Bajac-Bajac",
    "West Tapinac",
  ];

  const filteredReports = reports
    .filter(
      (r) =>
        r.title.toLowerCase().includes(search.toLowerCase()) ||
        r.description.toLowerCase().includes(search.toLowerCase())
    )
    .filter((r) => (category === "All" ? true : r.category === category))
    .filter((r) => (barangay === "All" ? true : r.barangay === barangay))
    .filter((r) => (showHistory ? r.user === currentUser : true))
    .sort((a, b) =>
      sort === "latest"
        ? new Date(b.date) - new Date(a.date)
        : new Date(a.date) - new Date(b.date)
    );

  const handleAddOrUpdateReport = () => {
    if (editReportId) {
      setReports(
        reports.map((r) =>
          r.id === editReportId ? { ...r, ...newReport } : r
        )
      );
    } else {
      const newId = reports.length + 1;
      const report = {
        id: newId,
        ...newReport,
        date: new Date().toISOString(),
        user: currentUser,
        status: "Pending", 
      };
      setReports([report, ...reports]);
    }

    setIsModalOpen(false);
    setEditReportId(null);
    resetNewReport();
  };

  const resetNewReport = () => {
    setNewReport({
      title: "",
      description: "",
      category: "Concern",
      barangay: "Barretto",
      addressStreet: "",
      images: [],
      date: new Date().toISOString(),
      user: currentUser,
    });
  };

  const handleEdit = (report) => {
    setNewReport(report);
    setEditReportId(report.id);
    setIsModalOpen(true);
  };

  const handleDelete = () => {
    setReports(reports.filter((r) => r.id !== deleteTarget.id));
    setDeleteTarget(null);
    setIsDeleteConfirmOpen(false);
  };

  const toggleExpand = (id) => {
    setExpandedPosts((prev) =>
      prev.includes(id) ? prev.filter((reportId) => reportId !== id) : [...prev, id]
    );
  };

  return (
    <div className="reports-container">
      <div className="header-row">
        <h2>Community Reports</h2>
        <button
          className="history-btn"
          onClick={() => setShowHistory(!showHistory)}
        >
          {showHistory ? "All Reports" : "My Reports"}
        </button>
      </div>

      <div className="top-controls">
        <input
          type="text"
          placeholder="Search reports..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="search-input"
        />

        <select value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="All">All Categories</option>
          <option value="Concern">Concern</option>
          <option value="Crime">Crime</option>
          <option value="Hazard">Hazard</option>
          <option value="Lost&Found">Lost &amp; Found</option>
          <option value="Others">Others</option>
        </select>

        <select value={barangay} onChange={(e) => setBarangay(e.target.value)}>
          {barangays.map((b) => (
            <option key={b} value={b}>
              {b}
            </option>
          ))}
        </select>

        <select value={sort} onChange={(e) => setSort(e.target.value)}>
          <option value="latest">Latest → Oldest</option>
          <option value="oldest">Oldest → Latest</option>
        </select>

        <button
          className="add-btn"
          onClick={() => {
            resetNewReport();
            setEditReportId(null);
            setIsModalOpen(true);
          }}
        >
          + Add Report
        </button>
      </div>

      <div className="reports-list">
        {filteredReports.length > 0 ? (
          filteredReports.map((report) => {
            const isExpanded = expandedPosts.includes(report.id);
            const displayDescription = isExpanded
                  ? report.description
                  : `${report.description.slice(0, 130)}${
                      report.description.length > 130 ? "..." : ""
                    }`;

            return (
              <div key={report.id} className="report-card">
                <div className="report-header">
                  <div className="report-header-left">
                    <img
                      src="/src/assets/profile.png"
                      alt="profile"
                      className="profile-pic"
                    />
                    <div className="report-header-text">
                      <p className="report-user">{report.user}</p>

                      <p className="report-subinfo">
                        {new Date(report.date).toLocaleString()} · {report.category}
                      </p>

                      <p className="report-address-info">
                        {report.addressStreet}, {report.barangay}, Olongapo City
                      </p>
                    </div>
                  </div>

                  <div className="report-header-actions">
                    <span className={`status-badge status-${report.status.toLowerCase()}`}>
                      {report.status}
                    </span>

                    {report.user === currentUser && (
                      <>
                        <button
                          className="icon-btn edit-btn"
                          onClick={() => handleEdit(report)}
                        >
                          <FaEdit />
                        </button>
                        <button
                          className="icon-btn delete-btn"
                          onClick={() => {
                            setDeleteTarget(report);
                            setIsDeleteConfirmOpen(true);
                          }}
                        >
                          <FaTrashAlt />
                        </button>
                      </>
                    )}
                  </div>
                </div>

                <div className="report-caption">
                  <strong>{report.title}</strong>

                  <p className="report-description-text">
                    {displayDescription}

                    {report.description.length > 130 && (
                      <span
                        className="more-link"
                        onClick={() => toggleExpand(report.id)}
                      >
                        {isExpanded ? " Show less" : " ...more"}
                      </span>
                    )}
                  </p>
                </div>

                {report.images && report.images.length > 0 && (
                  <div className={`report-images images-${report.images.length}`}>
                    {report.images.map((img, idx) => (
                      <img
                        key={idx}
                        src={img}
                        alt={`report-${idx}`}
                        className="report-collage-img"
                        onClick={() => setPreviewImage(img)}
                      />
                    ))}
                  </div>
                )}

                <div className="report-actions">
                  <button className="like-btn">Like</button>
                </div>
              </div>
            );
          })
        ) : (
          <p>No reports found.</p>
        )}
      </div>

      {isModalOpen && (
        <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>{editReportId ? "Edit Report" : "Add New Report"}</h3>

            <p>
              <strong>Resident:</strong> {currentUser}
            </p>
            <p>
              <strong>Date:</strong>{" "}
              {new Date(newReport.date).toLocaleDateString()}
            </p>

            <label>Title:</label>
            <input
              type="text"
              placeholder="Title"
              value={newReport.title}
              onChange={(e) =>
                setNewReport({ ...newReport, title: e.target.value })
              }
            />

            <label>Description:</label>
            <textarea
              placeholder="Description"
              value={newReport.description}
              onChange={(e) =>
                setNewReport({ ...newReport, description: e.target.value })
              }
            />

            <div className="address-fields">
              <label>Street Address:</label>
              <input
                type="text"
                placeholder="e.g. 45 Rizal Avenue"
                value={newReport.addressStreet}
                onChange={(e) =>
                  setNewReport({ ...newReport, addressStreet: e.target.value })
                }
              />
              <label>Barangay:</label>
              <select
                value={newReport.barangay}
                onChange={(e) =>
                  setNewReport({ ...newReport, barangay: e.target.value })
                }
              >
                {barangays
                  .filter((b) => b !== "All")
                  .map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
              </select>
            </div>

            <label>Category:</label>
            <select
              value={newReport.category}
              onChange={(e) =>
                setNewReport({ ...newReport, category: e.target.value })
              }
            >
              <option value="Concern">Concern</option>
              <option value="Crime">Crime</option>
              <option value="Hazard">Hazard</option>
              <option value="Lost&Found">Lost &amp; Found</option>
              <option value="Others">Others</option>
            </select>

            <label className="upload-btn">
                Upload Image(s)
                <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={(e) => {
                        const files = Array.from(e.target.files).slice(0, 5); // limit to 5
                        const urls = files.map((file) => URL.createObjectURL(file));
                        setNewReport({ ...newReport, images: urls });
                    }}
                    hidden
                />
            </label>

            <div className="modal-buttons">
              <button
                onClick={() => {
                  setIsModalOpen(false);
                  setEditReportId(null);
                }}
              >
                Cancel
              </button>
              <button onClick={handleAddOrUpdateReport}>
                {editReportId ? "Update" : "Submit"}
              </button>
            </div>
          </div>
        </div>
      )}

      {isDeleteConfirmOpen && (
        <div className="modal-overlay">
          <div className="modal">
            <h3>Delete Report</h3>
            <p>Are you sure you want to delete "{deleteTarget?.title}"?</p>
            <div className="delete-actions">
              <button onClick={handleDelete}>Yes, Delete</button>
              <button onClick={() => setIsDeleteConfirmOpen(false)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {previewImage && (
        <div className="fullscreen-modal" onClick={() => setPreviewImage(null)}>
          <img src={previewImage} alt="Full screen" className="fullscreen-image" />
        </div>
      )}
    </div>
  );
}

export default Reports;