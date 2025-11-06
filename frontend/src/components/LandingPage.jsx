import React, { useState } from "react";
import "./LandingPage.css";
import logo from "../assets/logo.png"; 
import { FaClipboardList, FaMapMarkedAlt, FaCamera, FaSearch, FaBell, FaUsers, FaBars } from "react-icons/fa"; // FaBars imported
import { Link } from 'react-router-dom';

const LandingPage = () => {
    // State to control menu visibility
    const [isMenuOpen, setIsMenuOpen] = useState(false);

    const toggleMenu = () => {
        setIsMenuOpen(!isMenuOpen);
    };

    return (
        <div className="landing-container">
            {/* Navigation Bar */}
            <nav className="navbar">
                <div className="nav-left">
                    <img src={logo} alt="CommunityGuard Logo" className="nav-logo-img" />
                    <div className="nav-logo-text">CommunityGuard</div>
                </div>
                
                {/* Burger Icon: Only this button should toggle the state */}
                <button className="menu-toggle" onClick={toggleMenu}>
                    <FaBars />
                </button>

                {/* Navigation Links: Class is conditionally applied */}
                <ul className={`nav-links ${isMenuOpen ? 'open' : ''}`}>
                    {/* onClick handlers removed to prevent menu flashing on desktop */}
                    <li><a href="#about">About</a></li>
                    <li><a href="#contact">Contact</a></li>
                    <li>
                        <Link to="/login" className="login-btn">
                            Login
                        </Link>
                    </li>
                </ul>
            </nav>

            {/* Hero Section */}
            <header className="hero-section">
                <div className="hero-content">
                    <h1>
                        Welcome to <span>Community Guard</span>
                    </h1>
                    <p>
                        Empowering communities with transparency, safety, and collaboration.
                    </p>
                    <a href="#about" className="get-started-btn">Learn More</a>
                </div>
            </header>

            {/* About Section */}
            <section id="about" className="about-section">
                <h2>About Community Guard</h2>
                <p className="about-desc">
                    <strong>Community Guard</strong> provides an accessible, centralized platform where residents
                    can report, track, and visualize incidents within their communities. By organizing reports
                    into categorized listings and integrating them into a real-time map, CommunityGuard enhances
                    community transparency and cooperation. This website fosters accountability, enables better
                    response times, and strengthens the bond between citizens and their local authorities.
                </p>

                {/* Feature Grid */}
                <div className="feature-grid">
                    <div className="feature-card">
                        <FaClipboardList className="feature-icon" />
                        <h3>Reporting System</h3>
                        <p>Submit and manage reports with categorized listings and real-time updates.</p>
                    </div>
                    <div className="feature-card">
                        <FaMapMarkedAlt className="feature-icon" />
                        <h3>Map Integration</h3>
                        <p>Visualize all reports on an interactive map for location-based awareness.</p>
                    </div>
                    <div className="feature-card">
                        <FaCamera className="feature-icon" />
                        <h3>Photo Uploads</h3>
                        <p>Attach photos to provide clear context and enhance report accuracy.</p>
                    </div>
                    <div className="feature-card">
                        <FaSearch className="feature-icon" />
                        <h3>Filter & Search</h3>
                        <p>Find reports quickly through filters and keyword-based searches.</p>
                    </div>
                    <div className="feature-card">
                        <FaBell className="feature-icon" />
                        <h3>Alerts & Notifications</h3>
                        <p>Receive updates about community events and emergency alerts.</p>
                    </div>
                    <div className="feature-card">
                        <FaUsers className="feature-icon" />
                        <h3>Community Dashboard</h3>
                        <p>Monitor all activities through a transparent and interactive dashboard.</p>
                    </div>
                </div>
            </section>

            {/* Footer */}
            <footer id="contact" className="footer">
                <div className="footer-top">
                    <div className="footer-column">
                        <h3>Contact Us</h3>
                        <p>Email: <a href="mailto:communityguard@gmail.com">communityguard@gmail.com</a></p>
                        <p>
                            GitHub:{" "}
                            <a href="https://github.com/Roselynong/community-guard" target="_blank" rel="noopener noreferrer">
                                github.com/Roselynong/community-guard
                            </a>
                        </p>
                        <p>Developers: Roselyn Ong & Larissa Panganiban</p>
                    </div>

                    <div className="footer-column">
                        <h3>Quick Links</h3>
                        <ul>
                            <li><a href="#about">About</a></li>
                            <li><a href="#contact">Contact</a></li>
                            <li><Link to="/login">Login</Link></li>
                        </ul>
                    </div>
                </div>

                <div className="footer-bottom">
                    <p>© {new Date().getFullYear()} CommunityGuard. All rights reserved.</p>
                </div>
            </footer>
        </div>
    );
};

export default LandingPage;