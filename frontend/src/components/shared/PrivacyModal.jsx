import React from "react";
import "./TermsModal.css";

function PrivacyModal({ isOpen, onClose }) {
  if (!isOpen) return null;

  return (
    <div className="terms-overlay" onClick={onClose}>
      <div className="terms-content" onClick={(e) => e.stopPropagation()}>
        <h2>Privacy Policy</h2>
        <div className="terms-body">
          <p>
            This Privacy Policy describes how Community Guard collects, uses,
            and shares personal information. It incorporates the LGU community
            privacy guidelines and relevant barangay policies where applicable.
          </p>

          <h3>1. Data We Collect</h3>
          <ul>
            <li>Personal details you provide (name, email, contact information)</li>
            <li>Reports and content you submit (location, description, images)</li>
            <li>Usage data (device, IP address, timestamps)</li>
          </ul>

          <h3>2. How We Use Your Data</h3>
          <p>
            We use data to operate the platform, to share reports with
            authorized community leaders and responders, and to improve
            community safety services. We follow LGU guidance about data
            sharing and retention as applicable to each barangay.
          </p>

          <h3>3. Sharing and Disclosure</h3>
          <p>
            Reports may be shared with barangay officials, emergency
            responders, or law enforcement when necessary for public safety.
            We do not sell personal data. Specific barangay policies may
            apply; contact your barangay office for details.
          </p>

          <h3>4. Your Rights</h3>
          <p>
            You have the right to request access, correction, or deletion of
            your personal data in line with the Data Privacy Act and LGU
            procedures. To exercise these rights, contact the barangay data
            protection officer or the LGU representative.
          </p>

          <h3>5. Contact</h3>
          <p>
            For questions or requests about this policy, please contact your
            LGU or barangay office. You can also reach the platform team at
            the contact details provided on the website.
          </p>
          {/* Okay Again*/}

        </div>

        <button className="terms-close-btn" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  );
}

export default PrivacyModal;