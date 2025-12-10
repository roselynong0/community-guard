import React, { useState, useEffect } from "react";
import "./HomePage.css";
import logo from "../../assets/logo.png";
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
    FaChartBar,
    FaChevronUp,
    FaExclamationTriangle,
    FaLifeRing
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
                { label: "FAQs", href: "#faq" }
            ]
        }
    ];

    const stats = [
        { value: "24/7", label: "Always Available", description: "Report incidents and check updates anytime, day or night." },
        { value: "12+", label: "Helpful Features", description: "Everything you need: reporting, maps, notifications, and more." },
        { value: "4", label: "User Types", description: "Residents, Barangay Officials, Responders, and Administrators." },
        { value: "100%", label: "Private & Secure", description: "Your information is protected and only shared with the right people." }
    ];

    const incidentFeatures = [
        {
            title: "Easy Report Submission",
            description: "Report crimes, hazards, or concerns with just a few taps. Add photos and pinpoint the exact location on a map.",
            icon: <FaClipboardList />
        },
        {
            title: "Live Safety Map",
            description: "See what's happening in your neighborhood with our real-time map showing recent incidents and safe zones.",
            icon: <FaMapMarkedAlt />
        },
        {
            title: "Instant Notifications",
            description: "Get alerted when something important happens nearby or when there's an update on your report.",
            icon: <FaBell />
        },
        {
            title: "Quick Response System",
            description: "Your reports go straight to the right people who can verify and respond to incidents faster.",
            icon: <FaCheckCircle />
        },
        {
            title: "Community Updates",
            description: "Stay connected with your neighbors through announcements, discussions, and safety tips.",
            icon: <FaComments />
        },
        {
            title: "Safety Resources",
            description: "Access helpful guides, emergency contacts, and tips to keep you and your family safe.",
            icon: <FaBookOpen />
        },
        {
            title: "Community Insights",
            description: "See trends and patterns to better understand safety in your area over time.",
            icon: <FaChartLine />
        },
        {
            title: "Hotspots",
            description: "Stay alert by identifying high-risk locations where critical incidents have been reported.",
            icon: <FaExclamationTriangle />
        },
        {
            title: "Verified Safe Zones",
            description: "Locate secure areas in your community that are free from reported incidents and disturbances.",
            icon: <FaLifeRing />
        }
    ];

    const roleHighlights = [
        {
            title: "Residents",
            icon: <FaUsers />,
            points: [
                "Report incidents easily with photos and location",
                "Track your report status and get updates",
                "Connect with your community through the feed"
            ]
        },
        {
            title: "Barangay Officials",
            icon: <FaShieldAlt />,
            points: [
                "View all reports in your barangay at a glance",
                "Approve reports and assign responders quickly",
                "Keep residents informed with announcements"
            ]
        },
        {
            title: "Responders",
            icon: <FaBolt />,
            points: [
                "See assigned incidents on your map",
                "Update report status from anywhere",
                "Coordinate with officials in real time"
            ]
        },
        {
            title: "Administrators",
            icon: <FaChartLine />,
            points: [
                "Manage user accounts and permissions",
                "Monitor system activity and reports",
                "View community safety trends and statistics"
            ]
        }
    ];

    const capabilityHighlights = [
        {
            title: "Smart Assistant",
            description: "Get helpful suggestions when filing reports to make sure your concern reaches the right people faster.",
            icon: <FaLightbulb />
        },
        {
            title: "Safety Insights",
            description: "Understand what's happening in your community with easy-to-read charts and trend summaries.",
            icon: <FaChartBar />
        },
        {
            title: "Safe & Secure",
            description: "Your data is protected with the same security used by banks and major organizations.",
            icon: <FaCloud />
        },
        {
            title: "Stay Connected",
            description: "Receive email updates and notifications so you never miss important community alerts.",
            icon: <FaNetworkWired />
        }
    ];

    // techHighlights removed as platform section was deleted

    const steps = [
        {
            title: "1. Submit Your Report",
            description: "Residents can quickly report incidents with details, photos, and location — all in one simple form."
        },
        {
            title: "2. Review & Verify",
            description: "Barangay officials review your report and verify the information before taking action."
        },
        {
            title: "3. Respond & Resolve",
            description: "Responders are notified and dispatched to handle the situation while you track progress."
        },
        {
            title: "4. Stay Informed",
            description: "Get updates as your report moves through the process until it's fully resolved."
        }
    ];

    const faqSections = [
        {
            title: "Getting Started",
            items: [
                { q: "How do I create an account?", a: "Click 'Create Account' on the homepage, fill in your details, verify your email, and you're all set!" },
                { q: "I forgot my password. How do I reset it?", a: "On the login page, click 'Forgot Password' and enter your email. You'll get a link to create a new password." },
                { q: "Why do I need to verify my email?", a: "It confirms your identity and ensures you receive important notifications about your reports and account." },
                { q: "What are the different account types?", a: "Residents submit reports. Responders handle emergencies. Barangay Officials verify and manage reports. Admins manage the whole system." }
            ]
        },
        {
            title: "Reporting Incidents",
            items: [
                { q: "How do I report an incident?", a: "Log in, post new report, describe what happened, mark the location on the map, attach photos if needed, then submit." },
                { q: "Can I attach photos to my report?", a: "Yes! Adding photos helps officials understand the situation better." },
                { q: "How do I track my report?", a: "Check your reports on the Reports tab and wait for further notifications if status changes." },
                { q: "What can I report?", a: "Crimes, safety hazards, suspicious activities, emergencies, or any community concern." }
            ]
        },
        {
            title: "Privacy & Safety",
            items: [
                { q: "Is my information safe?", a: "Yes. We use secure connections and only authorized staff can access your data." },
                { q: "Who can see my reports?", a: "Once approved, reports appear on the other Residents in your barangay feed and Safety Map without your personal details." },
                { q: "Is my identity kept private?", a: "Yes, your identity is confidential and not shown publicly." }
            ]
        },
        {
            title: "Using the App",
            items: [
                { q: "Can I use this on my phone?", a: "Yes! It works on any phone, tablet, or computer with internet." },
                { q: "What is the Community Feed?", a: "A place to see announcements, safety tips, and updates from your barangay." },
                { q: "What is the Safety Map?", a: "It shows incidents in your area so you know what's happening nearby." }
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
                        <span>Easy incident reporting</span>
                        <span>Real-time updates</span>
                        <span>Safer communities</span>
                    </div>
                    <h1>
                        "Your community safety partner"
                    </h1>
                    <p>
                        Community Guard makes it easy to report incidents, stay informed about what's happening in your barangay, 
                        and connect with officials and responders — all in one place. Together, we build safer neighborhoods.
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
                        <h2>Everything you need to report and track incidents</h2>
                        <p className="section-desc">
                            From the moment you submit a report to when it gets resolved, Community Guard keeps you informed every step of the way.
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
                        <h2>Built for your community's needs</h2>
                        <p className="section-desc">
                            Simple tools that help you report faster, stay informed, and keep your neighborhood safe.
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
                        <h2>Different roles, one goal: community safety</h2>
                        <p className="section-desc">
                            Everyone has a part to play in keeping our community safe. Here's how each user type contributes.
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
                        <h2>How it works</h2>
                        <p className="section-desc">A simple process from report to resolution — keeping you informed at every step.</p>
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