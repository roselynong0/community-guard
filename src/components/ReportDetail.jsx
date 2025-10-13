import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { FaArrowLeft, FaMapMarkerAlt, FaClock, FaUser } from "react-icons/fa";
import "./ReportDetail.css";

const API_URL = "http://localhost:5000/api";

function ReportDetail({ token, session }) {
  const { reportId } = useParams();
  const navigate = useNavigate();
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [previewImage, setPreviewImage] = useState(null);

  useEffect(() => {
    const fetchReport = async () => {
      if (!token || !reportId) return;

      setLoading(true);
      try {
        const response = await fetch(`${API_URL}/reports/${reportId}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });

        if (!response.ok) {
          throw new Error('Failed to fetch report');
        }

        const data = await response.json();
        if (data.status === "success") {
          setReport(data.report);
        } else {
          throw new Error(data.message || 'Report not found');
        }
      } catch (err) {
        console.error('Error fetching report:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchReport();
  }, [token, reportId]);

  const handleBack = () => {
    const isAdmin = session?.user?.role === "Admin";
    navigate(isAdmin ? "/admin/reports" : "/reports");
  };

  if (loading) {
    return (
      <div className="report-detail-container">
        <div className="loading-overlay">
          <div className="spinner"></div>
          <p>Loading report...</p>
        </div>
      </div>
    );
  }

  if (error || !report) {
    return (
      <div className="report-detail-container">
        <div className="error-container">
          <h2>Report Not Found</h2>
          <p>{error || "The requested report could not be found."}</p>
          <button onClick={handleBack} className="back-btn">
            <FaArrowLeft /> Back to Reports
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="report-detail-container">
      <div className="report-detail-header">
        <button onClick={handleBack} className="back-btn">
          <FaArrowLeft /> Back to Reports
        </button>
        <span className={`status-badge status-${report.status?.toLowerCase() || 'pending'}`}>
          {report.status || 'Pending'}
        </span>
      </div>

      <div className="report-detail-card">
        <div className="report-header">
          <div className="report-user-info">
            <img 
              src={report.reporter?.avatar_url || "/src/assets/profile.png"} 
              alt="profile" 
              className="profile-pic" 
            />
            <div className="user-details">
              <p className="report-user">
                <FaUser className="icon" />
                {report.reporter ? (
                  <>
                    {`${report.reporter.firstname || ''} ${report.reporter.lastname || ''}`.trim()}
                    <span className={`user-verified-badge ${report.reporter.isverified ? "verified" : "unverified"}`}>
                      {report.reporter.isverified ? "Verified" : "Unverified"}
                    </span>
                  </>
                ) : (
                  <>
                    Unknown User
                    <span className="user-verified-badge unverified">Unverified</span>
                  </>
                )}
              </p>
              <p className="report-date">
                <FaClock className="icon" />
                {report.created_at ? new Date(report.created_at).toLocaleString() : "N/A"}
              </p>
              <p className="report-location">
                <FaMapMarkerAlt className="icon" />
                {report.address_street || ''}, {report.address_barangay || 'Unknown'}, Olongapo City
              </p>
            </div>
          </div>
        </div>

        <div className="report-content">
          <h1 className="report-title">{report.title}</h1>
          <div className="report-category">
            Category: <span className="category-tag">{report.category || 'Uncategorized'}</span>
          </div>
          <div className="report-description">
            <p>{report.description}</p>
          </div>

          {report.images && report.images.length > 0 && (
            <div className="report-images-section">
              <h3>Attached Images</h3>
              <div className={`report-images images-${report.images.length}`}>
                {report.images.map((imgObj, idx) => (
                  <img
                    key={idx}
                    src={`${API_URL}${imgObj.url}`}
                    alt={`Report attachment ${idx + 1}`}
                    className="report-image"
                    onClick={() => setPreviewImage(`${API_URL}${imgObj.url}`)}
                  />
                ))}
              </div>
            </div>
          )}

          {report.latitude && report.longitude && (
            <div className="report-map-section">
              <h3>Location</h3>
              <p>Coordinates: {report.latitude}, {report.longitude}</p>
              {/* You can add a map component here if needed */}
            </div>
          )}
        </div>
      </div>

      {/* Fullscreen Image Preview */}
      {previewImage && (
        <div className="fullscreen-modal" onClick={() => setPreviewImage(null)}>
          <img src={previewImage} alt="Full screen" className="fullscreen-image" />
        </div>
      )}
    </div>
  );
}

export default ReportDetail;