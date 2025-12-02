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
    
    FaChartLine,
    FaExternalLinkAlt,
    FaCheckCircle,
    FaComments,
    FaBookOpen,
    FaLightbulb,
    FaCloud,
    FaNetworkWired,
    FaChartBar
    , FaChevronUp
} from "react-icons/fa";
import { Link } from "react-router-dom";

const HomePage = () => {
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [openDropdown, setOpenDropdown] = useState(null);
    const [navHovered, setNavHovered] = useState(false);
    const [pinnedDropdown, setPinnedDropdown] = useState(null);
    const navLeaveTimerRef = React.useRef(null);
    const [openFAQs, setOpenFAQs] = useState(new Set());
    const [showScrollTop, setShowScrollTop] = useState(false);

    const toggleFAQ = (key) => {
        setOpenFAQs(prev => {
            const next = new Set(prev);
            if (next.has(key)) next.delete(key);
            else next.add(key);
            return next;
        });
    };

    const toggleMenu = () => {
        setIsMenuOpen((prev) => {
            const next = !prev;
            // When opening mobile menu, clear any open dropdowns so they don't overlay the nav,
            // and apply a body scroll lock.
            if (next) {
                setOpenDropdown(null);
                setPinnedDropdown(null);
                if (typeof document !== 'undefined' &&
                    document.body &&
                    document.body.classList &&
                    typeof document.body.classList.add === 'function') {
                    document.body.classList.add('no-scroll');
                }
            } else {
                if (typeof document !== 'undefined' &&
                    document.body &&
                    document.body.classList &&
                    typeof document.body.classList.remove === 'function') {
                    document.body.classList.remove('no-scroll');
                }
            }
            return next;
        });
    };

    const handleDropdownToggle = (key) => {
        // Click toggles pinned state: clicking will pin it open; clicking again unpins
        if (pinnedDropdown === key) {
            setPinnedDropdown(null);
            setOpenDropdown(null);
            return;
        }
        setPinnedDropdown(key);
        setOpenDropdown(key);
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

    // When nav hover state changes, close dropdown if not pinned
    useEffect(() => {
        if (!navHovered && !pinnedDropdown) {
            setOpenDropdown(null);
        }
    }, [navHovered, pinnedDropdown]);

    // Close dropdown when clicking outside nav if nothing pinned
    useEffect(() => {
        const handler = (e) => {
            if (!document.querySelector('.navbar')) return;
            const nav = document.querySelector('.navbar');
            if (nav && !nav.contains(e.target) && !pinnedDropdown) {
                setOpenDropdown(null);
            }
        };

        document.addEventListener('mousedown', handler);
        return () => {
            document.removeEventListener('mousedown', handler);
        };
    }, [pinnedDropdown]);

    // Ensure no-scroll class is removed when component unmounts
    useEffect(() => {
        return () => {
            if (typeof document !== 'undefined' &&
                document.body &&
                document.body.classList &&
                typeof document.body.classList.remove === 'function') {
                document.body.classList.remove('no-scroll');
            }
        };
    }, []);

    // Shared mouse-enter / mouse-leave handlers for nav items to provide
    // consistent hover sensitivity (delay before hiding) across all dropdowns.
    const handleNavMouseEnter = (key = null) => {
        if (navLeaveTimerRef.current) {
            clearTimeout(navLeaveTimerRef.current);
            navLeaveTimerRef.current = null;
        }
        setNavHovered(true);
        if (key) setOpenDropdown(key);
    };

    const handleNavMouseLeave = (delay = 180) => {
        // Delay hiding slightly to avoid flicker when moving between elements
        // Accept a custom delay so we can make login's sensitivity more forgiving.
        if (navLeaveTimerRef.current) {
            clearTimeout(navLeaveTimerRef.current);
            navLeaveTimerRef.current = null;
        }
        navLeaveTimerRef.current = setTimeout(() => {
            setNavHovered(false);
            // only close if nothing is pinned
            if (!pinnedDropdown) setOpenDropdown(null);
            navLeaveTimerRef.current = null;
        }, delay);
    };

    // Listen for scroll and show/hide scroll-to-top button
    useEffect(() => {
        const onScroll = () => {
            try {
                const shouldShow = window.scrollY > 220;
                setShowScrollTop(shouldShow);
            } catch {
                // SSR-safe guard
            }
        };
        window.addEventListener('scroll', onScroll, { passive: true });
        onScroll();
        return () => window.removeEventListener('scroll', onScroll);
    }, []);

    const dropdowns = [
        {
            key: "solutions",
            label: "Solutions",
            items: [
                { label: "Incident Reporting", href: "#reporting" },
                { label: "Core Capabilities", href: "#capabilities" },
                { label: "Community Engagement", href: "#roles" },
                { label: "Operations Workflow", href: "#workflow" }
            ]
        },
        // Platform dropdown removed - platform/deployment sections deleted
        // resources dropdown removed per request
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
        { value: "100%", label: "Role-Based Access Control", description: "Secure, permission-driven access tailored to each user’s responsibilities." }
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

    // techHighlights removed as platform section was deleted

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

    const faqSections = [
        {
            title: "Security & Account Protection",
            items: [
                { q: "How does Community Guard keep user and incident data secure?", a: "Role-based access, encrypted transport, and secure storage protect user and incident data. Access is limited to authorized roles and audit logs track important actions." },
                { q: "Is the system compliant with data privacy standards?", a: "The platform is designed to support common data privacy practices and can be configured to meet local requirements and retention policies." },
                { q: "Why is email verification required?", a: "Email verification confirms a valid contact and helps prevent abuse or fraudulent accounts while improving notification delivery." },
                { q: "Can users reset passwords without admin intervention?", a: "Yes — users can request a password reset via email." },
                { q: "How are uploaded photos stored?", a: "Uploads are stored securely with access controls and optional retention or redaction policies; admin settings decide how long media is retained." }
            ]
        },
        {
            title: "Core Functionality & User Roles",
            items: [
                { q: "What user roles does Community Guard support?", a: "The system supports Residents (submit & track reports), Responders (view and update assigned reports), Barangay Officials (verify reports and manage local workflows), and Administrators (manage users, policies, and system settings)." },
                { q: "Can responders and officials communicate with residents?", a: "Yes, the platform includes community feed/forums and notification features so officials and responders can coordinate with residents where appropriate." },
                { q: "What is Community Helper?", a: "The Smart Helper suggests categories, helpful resources, and guided inputs to improve report quality and speed up response workflows; it’s an assistant layer configured to respect privacy and local guidance." }
            ]
        },
        {
            title: "Analytics & Administration",
            items: [
                { q: "What analytics are available for admins?", a: "Built-in dashboards surface trends such as incident volumes, response times, and verification rates. Admins can filter by area, timeframe, and status." },
                { q: "Can we export data for LGU reporting?", a: "Yes — exports are available in common formats (CSV) to support local government reporting and analysis." }
            ]
        },
        {
            title: "Mobile Experience",
            items: [
                { q: "Is Community Guard mobile-friendly?", a: "Yes — the web frontend is responsive and includes PWA support for reliable mobile use in the field." }
            ]
        }
    ];

    // Flattened list of FAQ items (no categories) - keep `category` for potential future use
    const faqItems = faqSections.flatMap((s) => s.items.map((it) => ({ ...it, category: s.title })));

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
                <ul className={`nav-links ${isMenuOpen ? "open" : ""} ${openDropdown ? "has-dropdown" : ""}`} onMouseEnter={() => handleNavMouseEnter()} onMouseLeave={() => handleNavMouseLeave()}>
                    {dropdowns.map((item) => (
                        <li
                            key={item.key}
                            className={`nav-item dropdown ${openDropdown === item.key ? "open" : ""}`}
                            onMouseEnter={() => handleNavMouseEnter(item.key)}
                            onMouseLeave={() => handleNavMouseLeave()}
                        >
                            <button
                                type="button"
                                className={`dropdown-toggle ${pinnedDropdown === item.key ? 'pinned' : ''}`}
                                onClick={() => handleDropdownToggle(item.key)}
                                aria-expanded={openDropdown === item.key}
                            >
                                {item.label} <FaChevronDown />
                            </button>
                            <div className="dropdown-menu" onMouseEnter={() => handleNavMouseEnter(item.key)} onMouseLeave={() => handleNavMouseLeave()}>
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
                                        <a key={link.label} href={link.href} onClick={(e) => {
                                            e.preventDefault();
                                            // Smooth scroll to section
                                            const targetId = link.href.replace('#', '');
                                            const el = document.getElementById(targetId);
                                            if (el) {
                                                const navHeight = document.querySelector('.navbar')?.offsetHeight || 64;
                                                const top = el.getBoundingClientRect().top + window.scrollY - navHeight - 8;
                                                window.scrollTo({ top, behavior: 'smooth' });
                                            }
                                            // Close dropdown if not pinned
                                            if (!pinnedDropdown) setOpenDropdown(null);
                                            if (!pinnedDropdown) setNavHovered(false);
                                            closeMenu();
                                        }}>
                                            {link.label}
                                        </a>
                                    )
                                ))}
                            </div>
                        </li>
                    ))}
                    <li className="nav-divider" />
                    <li className={`nav-auth login-dropdown dropdown ${openDropdown === 'login' ? 'open' : ''}`}
                        onMouseEnter={() => handleNavMouseEnter('login')}
                        onMouseLeave={() => handleNavMouseLeave(300)}
                    >
                        <button
                            type="button"
                            className={`dropdown-toggle ${pinnedDropdown === 'login' ? 'pinned' : ''} login-btn`}
                            aria-haspopup="true"
                            aria-expanded={openDropdown === 'login'}
                            onClick={() => handleDropdownToggle('login')}
                        >
                            Log in <FaChevronDown />
                        </button>
                        <ul
                            className={`login-dropdown-menu ${openDropdown === 'login' ? 'open' : ''}`}
                            role="menu"
                            aria-label="Login as"
                            onMouseEnter={() => handleNavMouseEnter('login')}
                            onMouseLeave={() => handleNavMouseLeave(300)}
                        >
                            <li role="none"><Link role="menuitem" to="/login?role=resident" onClick={closeMenu}>Resident</Link></li>
                            <li role="none"><Link role="menuitem" to="/login?role=barangay" onClick={closeMenu}>Barangay Official</Link></li>
                            <li role="none"><Link role="menuitem" to="/login?role=responder" onClick={closeMenu}>Responder</Link></li>
                            <li role="none"><Link role="menuitem" to="/login?role=admin" onClick={closeMenu}>Administrator</Link></li>
                        </ul>
                    </li>
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
                        Community Guard is a full-stack, multi-role safety platform that empowers residents, barangay officials, responders, and administrators with transparent reporting, 
                        smart assistance, and an integrated command workflow. Designed for real-world deployment, it brings incident visibility, coordinated response, and actionable data into one seamless system.
                    </p>
                    <div className="hero-actions">
                        <Link to="/register" className="get-started-btn">Get Started</Link>
                        <a
                            href="#faq"
                            className="secondary-btn"
                            onClick={e => {
                                e.preventDefault();
                                const el = document.getElementById('faq');
                                if (el) {
                                    const navHeight = document.querySelector('.navbar')?.offsetHeight || 64;
                                    const top = el.getBoundingClientRect().top + window.scrollY - navHeight - 8;
                                    window.scrollTo({ top, behavior: 'smooth' });
                                }
                            }}
                        >
                            View Community FAQs
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
                    {/* Process note removed per request */}
                </section>

                {/* Platform section removed per request */}

                {/* Deployment section removed per request */}

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
                        <div className="faq-card">
                            <div className="faq-accordion">
                                {faqItems.map((it, idx) => {
                                    const key = `faq-${idx}`;
                                    const isOpen = openFAQs.has(key);
                                    return (
                                        <div key={key} className={`faq-item ${isOpen ? 'open' : ''}`}>
                                            <button type="button" className="faq-question" onClick={() => toggleFAQ(key)} aria-expanded={isOpen}>
                                                <span>{it.q}</span>
                                                <span className="faq-toggle">{isOpen ? '−' : '+'}</span>
                                            </button>
                                            <div className="faq-answer" aria-hidden={!isOpen}>
                                                <p>{it.a}</p>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
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
                    {/* Documentation column removed per request */}
                    <div className="footer-column">
                        <h3>Stay Connected</h3>
                        <ul>
                            <li><Link to="/login?role=admin">Admin Console</Link></li>
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
            <button
                className={`scroll-top-btn ${showScrollTop ? 'visible' : ''}`}
                onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                aria-label="Scroll to top"
                title="Scroll to top"
            >
                <FaChevronUp aria-hidden="true" />
            </button>
        </div>
    );
};

export default HomePage;