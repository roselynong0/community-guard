import React, { useState, useEffect } from "react";
import "./HomePage.css";
import logo from "../assets/logo.png";
import {
    FaClipboardList,
    FaMapMarkedAlt,
    FaBell,
    FaUsers,
    FaBars,
    FaChevronDown,
    FaShieldAlt,
    FaBolt,
    FaGlobe,
    FaServer,
    FaMobileAlt,
    FaQuestionCircle,
    FaChartLine,
    FaLaptopCode,
    FaExternalLinkAlt,
    FaCheckCircle,
    FaComments,
    FaBookOpen,
    FaLightbulb,
    FaCloud,
    FaNetworkWired,
    FaChartBar
} from "react-icons/fa";
import { Link } from "react-router-dom";

const HomePage = () => {
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [openDropdown, setOpenDropdown] = useState(null);

    const toggleMenu = () => {
        setIsMenuOpen((prev) => !prev);
        if (isMenuOpen) {
            setOpenDropdown(null);
        }
    };

    const handleDropdownToggle = (key) => {
        setOpenDropdown((prev) => (prev === key ? null : key));
    };

    const closeMenu = () => {
        setIsMenuOpen(false);
        setOpenDropdown(null);
    };

    useEffect(() => {
        try {
            const initialTargets = Array.from(document.querySelectorAll('.section, .hero-section')).filter(el => !el.classList.contains('reveal'));
            initialTargets.forEach(el => el.classList.add('reveal'));

            const observerOptions = {
                root: null,
                rootMargin: '0px 0px -10% 0px',
                threshold: 0.08
            };

            const observer = new IntersectionObserver((entries, obs) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        entry.target.classList.add('is-visible');
                        obs.unobserve(entry.target);
                    }
                });
            }, observerOptions);

            const elements = document.querySelectorAll('.reveal');
            elements.forEach(el => observer.observe(el));

            return () => {
                observer.disconnect();
            };
        } catch {
            // SSR-safe no-op
        }
    }, []);

    const dropdowns = [
        {
            key: "solutions",
            label: "Solutions",
            items: [
                { label: "Incident Reporting", href: "#reporting" },
                { label: "Core Capabilities", href: "#capabilities" },
                { label: "Operations Workflow", href: "#workflow" },
                { label: "Community Engagement", href: "#roles" }
            ]
        },
        {
            key: "platform",
            label: "Platform",
            items: [
                { label: "Architecture", href: "#platform" },
                { label: "Deployment", href: "#deployment" },
                { label: "Integrations", href: "#integrations" },
                { label: "FAQs", href: "#faq" }
            ]
        },
        {
            key: "resources",
            label: "Resources",
            items: [
                { label: "Product Tour", href: "#overview" },
                {
                    label: "Documentation",
                    href: "https://github.com/Roselynong/community-guard",
                    external: true
                },
                {
                    label: "Knowledge Base",
                    href: "https://github.com/Roselynong/community-guard/tree/main/master/MD%20Integrations",
                    external: true
                },
                { label: "Contact", href: "#contact" }
            ]
        },
        {
            key: "company",
            label: "About",
            items: [
                { label: "Mission", href: "#overview" },
                { label: "Team", href: "#team" },
                { label: "Contact", href: "#contact" },
                { label: "Documentation", href: "https://github.com/Roselynong/community-guard", external: true }
            ]
        }
    ];

    const stats = [
        { value: "24/7", label: "Incident Visibility", description: "Monitor barangay cases with transparent status updates." },
        { value: "12+", label: "Feature Modules", description: "Reporting, dashboards, messaging, mapping, and archives." },
        { value: "4", label: "Stakeholder Portals", description: "Residents, barangay officials, responders, administrators." },
        { value: "<60m", label: "Deployment Ready", description: "Scripts and docs streamline local or cloud setups." }
    ];

    const incidentFeatures = [
        {
            title: "Incident Reporting System",
            description: "Submit reports about crimes, hazards, or suspicious activity with mapped locations and supporting images.",
            icon: <FaClipboardList />
        },
        {
            title: "Interactive Safety Map",
            description: "Visualize community updates through live maps that surface hotspots, safety zones, and ongoing responses.",
            icon: <FaMapMarkedAlt />
        },
        {
            title: "Emergency Alert Notifications",
            description: "Send timely alerts to nearby residents, responders, and officials whenever incidents escalate.",
            icon: <FaBell />
        },
        {
            title: "Verification & Response Dashboard",
            description: "Give authorized teams a unified console to validate submissions, assign responders, and track resolution steps.",
            icon: <FaCheckCircle />
        },
        {
            title: "Community Feed & Forum",
            description: "Host neighborhood announcements, discussions, and safety coordination inside a moderated feed.",
            icon: <FaComments />
        },
        {
            title: "Safety Tips & Resource Center",
            description: "Share prevention guides, preparedness checklists, and partner resources to empower every household.",
            icon: <FaBookOpen />
        },
        {
            title: "Analytics & Trend Monitoring",
            description: "Review charts that reveal recurring issues, high-risk zones, and the impact of community-wide actions.",
            icon: <FaChartLine />
        }
    ];

    const roleHighlights = [
        {
            title: "Residents",
            icon: <FaUsers />,
            points: [
                "Report incidents with precise geolocation and media uploads",
                "Track statuses and receive adaptive notifications",
                "Engage with neighbors via the community feed"
            ]
        },
        {
            title: "Barangay Officials",
            icon: <FaShieldAlt />,
            points: [
                "Monitor barangay-specific dashboards and analytics",
                "Assign responders and track escalations from a single console",
                "Publish advisories and review closure notes for every case"
            ]
        },
        {
            title: "Responders",
            icon: <FaBolt />,
            points: [
                "Access prioritized queues with mapping overlays",
                "Log updates in the field using any device",
                "Sync outcomes back to administrators instantly"
            ]
        },
        {
            title: "Administrators",
            icon: <FaChartLine />,
            points: [
                "Verify accounts, manage sessions, and uphold policies",
                "Maintain data quality with audit tools and migrations",
                "Review trends to guide investments and community programs"
            ]
        }
    ];

    const capabilityHighlights = [
        {
            title: "Smart Community Helper",
            description: "Friendly guidance suggests categories, surfaces related resources, and keeps reports consistent for faster action.",
            icon: <FaLightbulb />
        },
        {
            title: "Insightful Trend Monitoring",
            description: "Dashboards spotlight recurring incidents, emerging hotspots, and response times to inform community planning.",
            icon: <FaChartBar />
        },
        {
            title: "Secure Cloud Infrastructure",
            description: "Supabase authentication, JWT security, and managed backups keep data protected, auditable, and ready to scale.",
            icon: <FaCloud />
        },
        {
            title: "Connected Safety Ecosystem",
            description: "Integrate alerts, email outreach, and external hotlines so every stakeholder works from the same command center.",
            icon: <FaNetworkWired />
        }
    ];

    const techHighlights = [
        {
            title: "Frontend",
            icon: <FaLaptopCode />,
            details: "React 19, Vite, React Router, Leaflet, Recharts, and modern UI tooling ensure fast, reliable experiences."
        },
        {
            title: "Backend",
            icon: <FaServer />,
            details: "Flask with Blueprint architecture, Supabase integration, JWT security, and Mailjet-powered communications."
        },
        {
            title: "Deployment",
            icon: <FaGlobe />,
            details: "Optimized for Vercel frontends and Railway full-stack rollouts with CLI or Git automations."
        },
        {
            title: "Mobility",
            icon: <FaMobileAlt />,
            details: "Responsive layouts, PWA support, and offline-aware patterns keep field teams connected."
        }
    ];

    const steps = [
        {
            title: "1. MVP Reporting App",
            description: "Launch core incident submissions, verification workflows, and resident-to-official communication."
        },
        {
            title: "2. Smart Mapping & Guidance",
            description: "Activate the smart helper experience, safety maps, and guided checklists for faster decision-making."
        },
        {
            title: "3. Connected Operations",
            description: "Link notifications, responders, and partner hotlines to keep every stakeholder informed in real time."
        },
        {
            title: "4. Citywide Expansion",
            description: "Introduce predictive analytics, optional sensor feeds, and sustainability programs as adoption grows."
        }
    ];

    const faqs = [
        {
            question: "How does Community Guard keep data secure?",
            answer: "Role-based JWT authentication, Supabase row-level policies, and encrypted transport safeguard every interaction."
        },
        {
            question: "How quickly can we go live?",
            answer: "Automated scripts, environment templates, and migration helpers make pilots possible within the first week."
        },
        {
            question: "Can we customize barangay or city branding?",
            answer: "Yes. Update assets, color palettes, and copy within the React theme while retaining component logic."
        },
        {
            question: "Do we need separate infrastructure for pilots?",
            answer: "No. Deploy to Vercel for web and Railway for backend in minutes, then graduate to your preferred cloud when ready."
        }
    ];

    return (
        <div className="landing-container">
            <nav className="navbar">
                <div className="nav-left">
                    <img src={logo} alt="CommunityGuard Logo" className="nav-logo-img" width={40} height={40} loading="eager" fetchpriority="high" decoding="async" />
                    <div className="nav-logo-text">CommunityGuard</div>
                </div>
                <button className="menu-toggle" onClick={toggleMenu} aria-label="Toggle navigation">
                    <FaBars />
                </button>
                <ul className={`nav-links ${isMenuOpen ? "open" : ""}`}>
                    {dropdowns.map((item) => (
                        <li
                            key={item.key}
                            className={`nav-item dropdown ${openDropdown === item.key ? "open" : ""}`}
                            onMouseEnter={() => setOpenDropdown(item.key)}
                            onMouseLeave={() => setOpenDropdown(null)}
                        >
                            <button
                                type="button"
                                className="dropdown-toggle"
                                onClick={() => handleDropdownToggle(item.key)}
                                aria-expanded={openDropdown === item.key}
                            >
                                {item.label} <FaChevronDown />
                            </button>
                            <div className="dropdown-menu">
                                {item.items.map((link) => (
                                    link.external ? (
                                        <a
                                            key={link.label}
                                            href={link.href}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            onClick={closeMenu}
                                        >
                                            {link.label} <FaExternalLinkAlt className="external-icon" />
                                        </a>
                                    ) : (
                                        <a key={link.label} href={link.href} onClick={closeMenu}>
                                            {link.label}
                                        </a>
                                    )
                                ))}
                            </div>
                        </li>
                    ))}
                    <li className="nav-divider" />
                    <li className="nav-auth"><Link to="/login" onClick={closeMenu}>Log in</Link></li>
                    <li>
                        <Link to="/register" className="signup-btn" onClick={closeMenu}>
                            Create Account
                        </Link>
                    </li>
                </ul>
            </nav>

            <header className="hero-section" id="overview">
                <div className="hero-content">
                    <div className="headline-badges">
                        <span>Incident reporting system</span>
                        <span>Smart community helper</span>
                        <span>Coordinated response workflow</span>
                    </div>
                    <h1>
                        A unified safety command center for every community.
                    </h1>
                    <p>
                        Community Guard empowers residents, officials, responders, and administrators with transparent reporting,
                        smart assistance, and actionable dashboards that keep every neighborhood ready to respond.
                    </p>
                    <div className="hero-actions">
                        <Link to="/register" className="get-started-btn">Launch Your Pilot</Link>
                        <a href="#workflow" className="secondary-btn">
                            Explore Response Workflow
                        </a>
                    </div>
                    <div className="stat-grid">
                        {stats.map((stat) => (
                            <div key={stat.label} className="stat-card">
                                <strong>{stat.value}</strong>
                                <span>{stat.label}</span>
                                <p>{stat.description}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </header>

            <main>
                <section id="reporting" className="section light">
                    <div className="section-heading">
                        <h2>Incident lifecycle management without compromise</h2>
                        <p className="section-desc">
                            From the moment a resident submits a concern to the instant a responder resolves it, Community Guard orchestrates the
                            entire journey. Capture structured data, enrich with maps and media, automate notifications, and close the loop with verifiable outcomes.
                        </p>
                    </div>
                    <div className="feature-grid">
                        {incidentFeatures.map((feature) => (
                            <div className="feature-card" key={feature.title}>
                                {React.cloneElement(feature.icon, { className: "feature-icon" })}
                                <h3>{feature.title}</h3>
                                <p>{feature.description}</p>
                            </div>
                        ))}
                    </div>
                </section>

                <section id="capabilities" className="section dark">
                    <div className="section-heading">
                        <h2>Core capabilities that scale with your barangay</h2>
                        <p className="section-desc">
                            Streamline incident handling, empower citizens, and deliver reliable insights without adding operational overhead.
                        </p>
                    </div>
                    <div className="capability-grid">
                        {capabilityHighlights.map((capability) => (
                            <article key={capability.title} className="capability-card">
                                {React.cloneElement(capability.icon, { className: "capability-icon" })}
                                <h3>{capability.title}</h3>
                                <p>{capability.description}</p>
                            </article>
                        ))}
                    </div>
                </section>

                <section id="roles" className="section light">
                    <div className="section-heading">
                        <h2>Role-based experiences tailored to your city</h2>
                        <p className="section-desc">
                            Purpose-built dashboards respect the responsibilities of every stakeholder while centralizing governance.
                        </p>
                    </div>
                    <div className="card-grid">
                        {roleHighlights.map((role) => (
                            <div className="role-card" key={role.title}>
                                <div className="role-icon">{role.icon}</div>
                                <h3>{role.title}</h3>
                                <ul>
                                    {role.points.map((point) => (
                                        <li key={point}>{point}</li>
                                    ))}
                                </ul>
                            </div>
                        ))}
                    </div>
                </section>

                <section id="workflow" className="section dark">
                    <div className="section-heading">
                        <h2>From report submission to measurable impact</h2>
                        <p className="section-desc">Every stage of the incident lifecycle stays coordinated—from resident outreach to performance reviews.</p>
                    </div>
                    <div className="process">
                        {steps.map((step) => (
                            <div key={step.title} className="process-step">
                                <span className="step-index">{step.title.split(".")[0]}</span>
                                <div>
                                    <h3>{step.title}</h3>
                                    <p>{step.description}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                    <div className="process-note">
                        <FaGlobe />
                        <p>Detailed playbooks live inside the MD Integrations knowledge base so teams stay aligned and proactive.</p>
                    </div>
                </section>

                <section id="platform" className="section light">
                    <div className="section-heading">
                        <h2>Modern architecture, proven stack</h2>
                        <p className="section-desc">
                            Engineered with a React + Flask foundation, Community Guard stays modular, testable, and cloud ready.
                        </p>
                    </div>
                    <div className="card-grid tech">
                        {techHighlights.map((tech) => (
                            <div key={tech.title} className="tech-card">
                                <div className="tech-icon">{tech.icon}</div>
                                <h3>{tech.title}</h3>
                                <p>{tech.details}</p>
                            </div>
                        ))}
                    </div>
                </section>

                <section id="deployment" className="section dark">
                    <div className="section-heading">
                        <h2>Deploy anywhere in minutes</h2>
                        <p className="section-desc">
                            Choose your path—Vercel for rapid web rollout or Railway for full-stack orchestration. Our scripts and documentation guide you through every environment variable and health check.
                        </p>
                    </div>
                    <div className="deployment-grid">
                        <div className="deployment-card">
                            <FaServer className="deployment-icon" />
                            <h3>Vercel Frontend</h3>
                            <p>One command deployment with auto-detected API URLs, environment injection, and zero-config CDN.</p>
                        </div>
                        <div className="deployment-card">
                            <FaGlobe className="deployment-icon" />
                            <h3>Railway Full Stack</h3>
                            <p>CI-friendly builds for Flask + React, Supabase connectivity, and CLI tooling for logs and rollbacks.</p>
                        </div>
                        <div className="deployment-card">
                            <FaLaptopCode className="deployment-icon" />
                            <h3>Local Development</h3>
                            <p>Run <code>python app.py</code> and <code>npm run dev</code> in tandem with live reload and proxying.</p>
                        </div>
                    </div>
                </section>

                <section id="integrations" className="section dark">
                    <div className="section-heading">
                        <h2>Integrations that extend your reach</h2>
                        <p className="section-desc">
                            Community Guard ties together location services, notification pipelines, smart helper services, and COTS tooling.
                        </p>
                    </div>
                    <div className="integration-banner">
                        <FaMapMarkedAlt />
                        <span>Leaflet &amp; React-Leaflet mapping • Supabase authentication &amp; storage • Mailjet email automation • JWT-secured APIs • PWA offline styling</span>
                    </div>
                </section>

                <section id="faq" className="section light">
                    <div className="section-heading">
                        <h2>Frequently asked questions</h2>
                        <p className="section-desc">Everything you need to brief stakeholders and accelerate approvals.</p>
                    </div>
                    <div className="faq-grid">
                        {faqs.map((faq) => (
                            <div key={faq.question} className="faq-card">
                                <FaQuestionCircle className="faq-icon" />
                                <h3>{faq.question}</h3>
                                <p>{faq.answer}</p>
                            </div>
                        ))}
                    </div>
                </section>

                <section id="team" className="section dark">
                    <div className="section-heading">
                        <h2>Built by community-first innovators</h2>
                        <p className="section-desc">Community Guard was created by Roselyn Lei B. Ong and Larissa Eunice T. Panganiban at Gordon College to strengthen barangay resilience.</p>
                    </div>
                    <div className="team-grid">
                        <div className="team-card">
                            <h3>Roselyn Lei B. Ong</h3>
                            <p>Full-stack engineer focused on end-to-end platform architecture, deployment automation, and QA readiness.</p>
                        </div>
                        <div className="team-card">
                            <h3>Larissa Eunice T. Panganiban</h3>
                            <p>UX strategist and data specialist shaping resident experiences, AI governance, and documentation clarity.</p>
                        </div>
                    </div>
                </section>
            </main>

            <footer id="contact" className="footer">
                <div className="footer-top">
                    <div className="footer-column">
                        <h3>Contact Us</h3>
                        <p>Email: <a href="mailto:communityguard@gmail.com">communityguard@gmail.com</a></p>
                        <p>
                            GitHub: <a href="https://github.com/Roselynong/community-guard" target="_blank" rel="noopener noreferrer">github.com/Roselynong/community-guard</a>
                        </p>
                        <p>Developers: Roselyn Ong &amp; Larissa Panganiban</p>
                    </div>
                    <div className="footer-column">
                        <h3>Documentation</h3>
                        <ul>
                            <li><a href="https://github.com/Roselynong/community-guard" target="_blank" rel="noopener noreferrer">Project README</a></li>
                            <li><a href="https://github.com/Roselynong/community-guard/tree/main/master/MD%20Integrations" target="_blank" rel="noopener noreferrer">Integration Playbooks</a></li>
                            <li><a href="#workflow">Operations Workflow</a></li>
                            <li><a href="#platform">Platform Overview</a></li>
                        </ul>
                    </div>
                    <div className="footer-column">
                        <h3>Stay Connected</h3>
                        <ul>
                            <li><Link to="/login">Admin Console</Link></li>
                            <li><Link to="/register">Create Community</Link></li>
                            <li><a href="#overview">Platform Tour</a></li>
                            <li><a href="#faq">FAQs</a></li>
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

export default HomePage;
