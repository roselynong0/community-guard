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

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);

  // Report being added/edited
  const [newReport, setNewReport] = useState({
    title: "",
    description: "",
    category: "Concern",
    barangay: "Barretto",
    image: null,
    date: new Date().toISOString(),
    user: "user1", // mock author
  });

  const [editReportId, setEditReportId] = useState(null); // track if editing

  // Mock user
  const currentUser = "user1";
  const [deleteTarget, setDeleteTarget] = useState(null);

  useEffect(() => {
    const dummyReports = [
      {
        id: 1,
        title: "Pickpocket Incident",
        category: "Crime",
        barangay: "East Tapinac",
        date: "2025-09-09T14:20:00",
        description:
          "A pickpocketing incident happened near the market. Multiple residents reported losing wallets and phones around 2PM.",
        user: "user2",
        image: "/src/assets/logo.png",
      },
      {
        id: 2,
        title: "Fallen Electric Post",
        category: "Hazard",
        barangay: "Santa Rita",
        date: "2025-09-08T22:00:00",
        description:
          "An electric post fell after the heavy rains last night, blocking the main road and posing danger to vehicles and pedestrians.",
        user: "user1",
        image: "/src/assets/logo.png",
      },
      {
        id: 3,
        title: "Garbage Overflowing",
        category: "Concern",
        barangay: "New Cabalan",
        date: "2025-09-08T18:40:00",
        description:
          "The garbage bins along the main street have been overflowing for days, causing a foul smell and attracting stray animals.",
        user: "user1",
        image: "/src/assets/logo.png",
      },
      {
        id: 4,
        title: "Lost Wallet",
        category: "Lost&Found",
        barangay: "Barretto",
        date: "2025-09-07T10:15:00",
        description:
          "A black leather wallet was lost near the church. Contains IDs and some cash. Please return if found.",
        user: "user2",
        image: "/src/assets/logo.png",
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
      // Update existing report
      setReports(
        reports.map((r) =>
          r.id === editReportId ? { ...r, ...newReport } : r
        )
      );
    } else {
      // Add new report
      const newId = reports.length + 1;
      const report = {
        id: newId,
        ...newReport,
        date: new Date().toISOString(),
        user: currentUser,
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
      image: null,
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

  return (
    <div className="reports-container">
      {/* Header with My Report History */}
      <div className="header-row">
        <h2>Community Reports</h2>
        <button
          className="history-btn"
          onClick={() => setShowHistory(!showHistory)}
        >
          {showHistory ? "All Reports" : "My Reports"}
        </button>
      </div>

      {/* Filters + Search + Add Report in one row */}
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

        {/* Add Report Button */}
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

      {/* Reports List */}
      <div className="reports-list">
        {filteredReports.length > 0 ? (
          filteredReports.map((report) => {
            const shortDesc =
              report.description.length > 100
                ? report.description.slice(0, 100) + "..."
                : report.description;

            return (
              <div key={report.id} className="report-card">
                <img
                  src={report.image}
                  alt={report.title}
                  className="report-image"
                />
                <div className="report-info">
                  <h3>{report.title}</h3>
                  <p>
                    <strong>Category:</strong> {report.category}
                  </p>
                  <p>
                    <strong>Barangay:</strong> {report.barangay}
                  </p>
                  <p>
                    <strong>Date:</strong>{" "}
                    {new Date(report.date).toLocaleString()}
                  </p>
                  <p>{shortDesc}</p>

                  <div className="report-actions">
                    <button className="readmore-btn">Read More</button>
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
              </div>
            );
          })
        ) : (
          <p>No reports found.</p>
        )}
      </div>

      {/* Add/Edit Modal */}
      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal">
            <h3>{editReportId ? "Edit Report" : "Add New Report"}</h3>

            <p>
              <strong>Resident:</strong> {currentUser}
            </p>
            <p>
              <strong>Date:</strong>{" "}
              {new Date(newReport.date).toLocaleDateString()}
            </p>

            <input
              type="text"
              placeholder="Title"
              value={newReport.title}
              onChange={(e) =>
                setNewReport({ ...newReport, title: e.target.value })
              }
            />

            <textarea
              placeholder="Description"
              value={newReport.description}
              onChange={(e) =>
                setNewReport({ ...newReport, description: e.target.value })
              }
            />

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

            <select
              value={newReport.barangay}
              onChange={(e) =>
                setNewReport({ ...newReport, barangay: e.target.value })
              }
            >
              {barangays.filter((b) => b !== "All").map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>

            <input
              type="file"
              accept="image/*"
              onChange={(e) => {
                const file = e.target.files[0];
                if (file) {
                  const imageUrl = URL.createObjectURL(file);
                  setNewReport({ ...newReport, image: imageUrl });
                }
              }}
            />

            <div className="edit-actions">
              <button onClick={handleAddOrUpdateReport}>
                {editReportId ? "Update" : "Submit"}
              </button>
              <button
                onClick={() => {
                  setIsModalOpen(false);
                  setEditReportId(null);
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
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
    </div>
  );
}

export default Reports;
