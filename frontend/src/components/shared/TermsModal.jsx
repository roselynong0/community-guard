import React from "react";
import "./TermsModal.css";

function TermsModal({ isOpen, onClose }) {
  if (!isOpen) return null;

  return (
    <div className="terms-overlay" onClick={onClose}>
      <div className="terms-content" onClick={(e) => e.stopPropagation()}>
        <h2>Terms & Conditions</h2>
        <div className="terms-body">
          <p>
            Welcome to <strong>Community Guard</strong>, a platform where residents can
            report unsafe activities, crime incidents, hazards, and accidents in
            their neighborhood. By using this service, you agree to the following
            terms:
          </p>

          <h3>1. Acceptance of Terms</h3>
          <p>
            By accessing or using Community Guard, you agree to comply with these
            Terms and Conditions. If you do not agree, please discontinue using
            the platform.
          </p>

          <h3>2. Eligibility</h3>
          <ul>
            <li>You must be a resident or member of the community to use this platform.</li>
            <li>
              You confirm that the information you provide is accurate and
              truthful.
            </li>
          </ul>

          <h3>3. User Responsibilities</h3>
          <ul>
            <li>Provide truthful and accurate reports.</li>
            <li>Respect other users; no harassment or offensive content.</li>
            <li>Do not misuse the app for spam or unrelated promotions.</li>
            <li>Follow all applicable laws when using the platform.</li>
          </ul>

          <h3>4. Reporting Features</h3>
          <p>
            Community Guard is <strong>not an emergency service</strong>. For
            urgent cases, please contact local authorities directly. Reports may
            be shared with community leaders or law enforcement to improve public
            safety.
          </p>

          <h3>5. Content Ownership</h3>
          <p>
            You retain ownership of content you post but grant Community Guard a
            license to display and share it for community safety purposes.
          </p>

          <h3>6. Privacy & Data Use</h3>
          <p>
            Your data will be handled according to our Privacy Policy and the{" "}
            <strong>Data Privacy Act of 2012 (RA 10173)</strong>. You have the
            right to be informed, access, correct, block, or erase your personal
            data.{" "}
            <a
              href="https://privacy.gov.ph/data-privacy-act/"
              target="_blank"
              rel="noreferrer"
            >
              Learn More
            </a>
          </p>

          <h3>7. Community Guidelines</h3>
          <ul>
            <li>Use respectful and constructive language.</li>
            <li>No defamation or spreading of unverified claims.</li>
            <li>Keep reports factual and relevant to community safety.</li>
          </ul>

          <h3>8. Limitation of Liability</h3>
          <p>
            Community Guard is a reporting tool and does not replace law
            enforcement. We are not responsible for the accuracy of user reports
            or any harm caused by reliance on such reports.
          </p>
        </div>

        <button className="terms-close-btn" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  );
}

export default TermsModal;
