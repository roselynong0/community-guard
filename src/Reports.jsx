import React, { useState, useEffect } from "react";
import "./Reports.css";

function Reports() {
  const [reports, setReports] = useState([]);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [barangay, setBarangay] = useState("All");
  const [sort, setSort] = useState("latest");

  // Dummy data for now (replace with API call)
  useEffect(() => {
    const dummyReports = [
      {
        id: 1,
        title: "Suspicious Activity",
        category: "Crime",
        barangay: "Barangay Barretto",
        date: "2025-09-09T08:30:00",
        description: "Unknown individuals loitering near the street.",
      },
      {
        id: 2,
        title: "Broken Streetlight",
        category: "Hazard",
        barangay: "Barangay East Tapinac",
        date: "2025-09-08T21:15:00",
        description: "Streetlight near the plaza is not working.",
      },
      {
        id: 3,
        title: "Minor Car Accident",
        category: "Accident",
        barangay: "Barangay New Cabalan",
        date: "2025-09-07T18:45:00",
        description: "Two cars collided near the intersection.",
      },
    ];
    setReports(dummyReports);
  }, []);

  // List of barangays in Olongapo City
  const barangays = [
    "All",
    "Barangay Barretto",
    "Barangay East Tapinac",
    "Barangay West Tapinac",
    "Barangay New Cabalan",
    "Barangay Old Cabalan",
    "Barangay Kalaklan",
    "Barangay Sta. Rita",
    "Barangay Pag-asa",
    "Barangay Gordon Heights",
    "Barangay Mabayuan",
    "Barangay Asinan",
    "Barangay Banicain",
  ];

  // Filtering logic
  const filteredReports = reports
    .filter((r) =>
      r.title.toLowerCase().includes(search.toLowerCase()) ||
      r.description.toLowerCase().includes(search.toLowerCase())
    )
    .filter((r) => (category === "All" ? true : r.category === category))
    .filter((r) => (barangay === "All" ? true : r.barangay === barangay))
    .sort((a, b) =>
      sort === "latest"
        ? new Date(b.date) - new Date(a.date)
        : new Date(a.date) - new Date(b.date)
    );

  return (
    <div className="reports-container">
      <h2>Community Reports</h2>

      {/* Filters */}
      <div className="filters">
        <input
          type="text"
          placeholder="Search reports..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        <select value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="All">All Categories</option>
          <option value="Crime">Crime</option>
          <option value="Hazard">Hazard</option>
          <option value="Accident">Accident</option>
        </select>

        <select value={barangay} onChange={(e) => setBarangay(e.target.value)}>
          {barangays.map((b, i) => (
            <option key={i} value={b}>
              {b}
            </option>
          ))}
        </select>

        <select value={sort} onChange={(e) => setSort(e.target.value)}>
          <option value="latest">Latest → Oldest</option>
          <option value="oldest">Oldest → Latest</option>
        </select>
      </div>

      {/* Reports List */}
      <div className="reports-list">
        {filteredReports.length > 0 ? (
          filteredReports.map((report) => (
            <div key={report.id} className="report-card">
              <h3>{report.title}</h3>
              <p className="report-meta">
                {report.category} | {report.barangay} |{" "}
                {new Date(report.date).toLocaleString()}
              </p>
              <p>{report.description}</p>
            </div>
          ))
        ) : (
          <p>No reports found.</p>
        )}
      </div>
    </div>
  );
}

export default Reports;
