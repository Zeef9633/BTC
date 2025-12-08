import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, setDoc, collection, query, onSnapshot, addDoc, getDoc, setLogLevel } from 'firebase/firestore';
import { CheckCircle, Zap, Globe, HardHat, Phone, Mail, MapPin, Loader, Info, Server, Cpu, Layers, FileText, LayoutGrid } from 'lucide-react';

// --- Global Variable Setup ---
// These variables are provided by the canvas environment for Firebase interaction.
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : null;
const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;

// Utility to implement exponential backoff for API calls
const withRetry = async (fn, retries = 5, delay = 1000) => {
    try {
        return await fn();
    } catch (error) {
        if (retries === 0) throw error;
        await new Promise(resolve => setTimeout(resolve, delay));
        return withRetry(fn, retries - 1, delay * 2);
    }
};

// --- CORE FIREBASE HOOK & CONTEXT ---

function useFirebaseSetup() {
    const [db, setDb] = useState(null);
    const [auth, setAuth] = useState(null);
    const [userId, setUserId] = useState(null);
    const [isAuthReady, setIsAuthReady] = useState(false);

    useEffect(() => {
        if (!firebaseConfig) {
            console.error("Firebase config is missing.");
            // Set ready state even on failure to avoid infinite loading, but with null DB
            setIsAuthReady(true); 
            return;
        }

        // Set Firebase logging level to debug
        setLogLevel('debug');
        
        try {
            const app = initializeApp(firebaseConfig);
            const firestore = getFirestore(app);
            const authInstance = getAuth(app);
            
            setDb(firestore);
            setAuth(authInstance);

            const unsubscribe = onAuthStateChanged(authInstance, async (user) => {
                let currentUserId = authInstance.currentUser?.uid || crypto.randomUUID();
                
                if (!user) {
                    // If no user is present, attempt initial sign-in
                    console.log("No user signed in. Attempting sign-in...");
                    try {
                        if (initialAuthToken) {
                            await withRetry(() => signInWithCustomToken(authInstance, initialAuthToken));
                        } else {
                            await withRetry(() => signInAnonymously(authInstance));
                        }
                        currentUserId = authInstance.currentUser?.uid;
                    } catch (e) {
                         console.warn("Sign-in failed after retry. Proceeding with unauthenticated ID.", e.message);
                    }
                }
                
                setUserId(currentUserId);
                setIsAuthReady(true);
                console.log("Auth State Confirmed. User ID:", currentUserId);
            });
            
            // Clean up the listener when the component unmounts
            return () => unsubscribe();
        } catch (error) {
            console.error("Firebase initialization failed:", error);
            setIsAuthReady(true);
        }
    }, []);

    return { db, auth, userId, isAuthReady };
}


// --- DATA FETCHING AND MUTATION (Firestore) ---

// Paths
const getCmsDocRef = (db) => doc(db, 'artifacts', appId, 'public', 'data', 'zorix_cms_config', 'metrics');
const getLeadsCollectionRef = (db, userId) => collection(db, 'artifacts', appId, 'users', userId, 'zorix_leads');

/**
 * Hook to manage CMS config/metrics (Shared Public Data)
 */
function useCmsConfig(db, isAuthReady) {
    const defaultData = { years: '5+', countries: '15+', projects: '500+', customers: '300+' };
    const [config, setConfig] = useState(defaultData);

    useEffect(() => {
        // CRITICAL GUARD: Do not attempt Firestore operations until DB is initialized AND authentication is complete.
        if (!db || !isAuthReady) return;

        const docRef = getCmsDocRef(db);
        
        // 1. Attempt to seed default data if it doesn't exist (using setDoc with merge for safety)
        const initializeDoc = async () => {
             try {
                await withRetry(() => setDoc(docRef, defaultData, { merge: true }));
             } catch (e) {
                 console.warn("Could not seed CMS config (initial write permission denied).", e.message);
             }
        };
        initializeDoc();

        // 2. Set up the read listener
        const unsubscribe = onSnapshot(docRef, (docSnap) => {
            if (docSnap.exists()) {
                setConfig(docSnap.data());
            } else {
                setConfig(defaultData);
            }
        }, (error) => {
            // CRITICAL FIX: Fallback to local default state on read failure due to permissions
            console.error("Critical Read Error (CMS Config): Missing or insufficient permissions. Defaulting to local state.", error.message);
            setConfig(defaultData); 
        });

        return () => unsubscribe();
    }, [db, isAuthReady]);

    return config;
}

/**
 * Function to submit a lead (Private User Data for storage)
 */
const submitLead = async (db, userId, formData) => {
    if (!db || !userId) {
        console.error("Database or User ID not ready for lead submission.");
        return { success: false, message: "System not ready. Please try again later." };
    }

    try {
        const leadsCollectionRef = getLeadsCollectionRef(db, userId);
        await withRetry(() => addDoc(leadsCollectionRef, {
            ...formData,
            timestamp: new Date().toISOString(),
            status: 'New'
        }));
        return { success: true, message: "Thank you! Your inquiry has been successfully submitted." };
    } catch (error) {
        console.error("Failed to submit lead:", error);
        return { success: false, message: "Submission failed. Please check your network connection." };
    }
};

// --- UI COMPONENTS ---

const NavItem = ({ name, currentPage, setPage }) => (
    <button
        onClick={() => setPage(name.toLowerCase().replace(/\s/g, ''))}
        className={`px-4 py-2 text-sm font-medium transition-all duration-300 rounded-md
            ${currentPage === name.toLowerCase().replace(/\s/g, '')
            ? 'text-yellow-400 border-b-2 border-yellow-400'
            : 'text-gray-300 hover:text-yellow-400 hover:bg-gray-800'
        }`}
    >
        {name}
    </button>
);

const Header = ({ currentPage, setPage }) => (
    <header className="bg-gray-900 shadow-xl fixed w-full z-50">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
            
            {/* START: UPDATED CLICKABLE LOGO BLOCK - Professional, unique design combining Global Reach and Structured Logistics */}
            <button
                onClick={() => setPage('home')}
                className="text-2xl font-extrabold text-white flex items-center focus:outline-none hover:opacity-80 transition-opacity duration-200"
                aria-label="Go to Home Page"
            >
                {/* Custom Logo Design: LayoutGrid (Structure) as background, Globe (Global) as centerpiece */}
                <span className="relative inline-block mr-2">
                    <LayoutGrid className="w-6 h-6 text-yellow-400 rotate-45" />
                    <Globe className="w-3 h-3 text-white absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 opacity-90" />
                </span>
                ZORIX <span className="text-yellow-400 ml-1">GLOBAL</span>
            </button>
            {/* END: UPDATED CLICKABLE LOGO BLOCK */}

            <nav className="hidden md:flex space-x-2">
                {['Home', 'About Us', 'Services', 'Products', 'Contact Us'].map(name => (
                    <NavItem key={name} name={name} currentPage={currentPage} setPage={setPage} />
                ))}
            </nav>
            <button
                onClick={() => setPage('contactus')}
                className="md:hidden p-2 text-yellow-400 hover:text-white transition-colors duration-300"
                aria-label="Contact Us"
            >
                <Phone className="w-6 h-6" />
            </button>
        </div>
    </header>
);

const Footer = ({ userId, setPage }) => {
    const legalPages = [
        { name: 'Privacy Policy', page: 'privacypolicy' },
        { name: 'Terms of Trade', page: 'termsoftrade' },
        { name: 'Sitemap', page: 'sitemap' }
    ];

    return (
        <footer className="bg-gray-900 text-gray-400 py-8 mt-12">
            <div className="container mx-auto px-4 grid grid-cols-1 md:grid-cols-4 gap-8">
                <div>
                    <h3 className="text-lg font-bold text-white mb-4">ZORIX GLOBAL</h3>
                    <p className="text-sm">Global Reach, Smart Solutions in IT & Electronics Trading.</p>
                    <p className="text-xs mt-4">SAIF Zone, Sharjah, UAE.</p>
                </div>
                {/* Services Links */}
                <div>
                    <h3 className="text-lg font-bold text-white mb-4">Services</h3>
                    <ul className="space-y-2 text-sm">
                        {[{ name: 'IT Equipment Trading', page: 'services' },
                        { name: 'Electronics Distribution', page: 'services' },
                        { name: 'Global Sourcing & Logistics', page: 'services' }].map(item => (
                            <li key={item.name}>
                                <button
                                    onClick={() => setPage(item.page)}
                                    className="text-gray-400 hover:text-yellow-400 transition-colors duration-200 text-left w-full"
                                >
                                    {item.name}
                                </button>
                            </li>
                        ))}
                    </ul>
                </div>
                {/* Legal Links (Now functional) */}
                <div>
                    <h3 className="text-lg font-bold text-white mb-4">Legal</h3>
                    <ul className="space-y-2 text-sm">
                        {legalPages.map(item => (
                            <li key={item.name}>
                                <button
                                    onClick={() => setPage(item.page)}
                                    className="text-gray-400 hover:text-yellow-400 transition-colors duration-200 text-left w-full"
                                >
                                    {item.name}
                                </button>
                            </li>
                        ))}
                    </ul>
                </div>
                <div>
                    <h3 className="text-lg font-bold text-white mb-4">Connect</h3>
                    <p className="text-sm flex items-center mb-2"><Mail className="w-4 h-4 mr-2 text-yellow-400" /> info@zorixglobal.com</p>
                    <p className="text-sm flex items-center"><Phone className="w-4 h-4 mr-2 text-yellow-400" /> +971 50 XXX XXXX</p>
                </div>
            </div>
            <div className="mt-8 pt-4 border-t border-gray-700 text-center text-xs">
                &copy; {new Date().getFullYear()} Zorix Global. All rights reserved. | User ID: {userId}
            </div>
        </footer>
    );
};


// --- PAGE COMPONENTS ---

const PageLayout = ({ title, children, icon: Icon }) => (
    <div className="container mx-auto px-4 py-32 text-gray-300 min-h-screen">
        <h2 className="text-5xl font-extrabold text-white mb-10 border-b border-yellow-400 pb-4 flex items-center">
            {Icon && <Icon className="w-8 h-8 text-yellow-400 mr-4" />}
            {title}
        </h2>
        <div className="prose prose-invert max-w-none text-gray-300 space-y-6">
            {children}
        </div>
    </div>
);


const ServiceCard = ({ icon: Icon, title, description }) => (
    <div className="bg-gray-800 p-6 rounded-xl shadow-2xl transition-transform duration-300 hover:scale-[1.02] hover:shadow-yellow-500/20 flex flex-col items-start h-full">
        <Icon className="w-10 h-10 text-yellow-400 mb-4 p-1 border-2 border-yellow-400 rounded-full" />
        <h3 className="text-xl font-semibold text-white mb-3">{title}</h3>
        <p className="text-gray-400 text-sm flex-grow">{description}</p>
    </div>
);

const HomePage = ({ setPage, cmsConfig }) => (
    <>
        {/* Hero Section */}
        <div className="relative bg-gray-900 pt-20 h-screen flex items-center justify-center overflow-hidden">
            <div className="absolute inset-0 bg-cover bg-center opacity-30" style={{ backgroundImage: "url(https://placehold.co/1920x1080/1a202c/6b46c1?text=Digital+Network)" }}></div>
            <div className="relative z-10 text-center max-w-4xl px-4">
                <h2 className="text-5xl md:text-7xl font-extrabold text-white leading-tight mb-4">
                    GLOBAL REACH, <span className="text-yellow-400">SMART SOLUTIONS</span>
                </h2>
                <p className="text-xl md:text-2xl text-gray-300 mb-8">
                    Your trusted partner in high-volume IT Equipment and Electronics Trading from the heart of the UAE.
                </p>
                <button
                    onClick={() => setPage('contactus')}
                    className="bg-yellow-500 hover:bg-yellow-600 text-gray-900 font-bold py-3 px-8 rounded-full text-lg shadow-lg transition-all duration-300 transform hover:scale-105"
                >
                    Request a Quote Today
                </button>
            </div>
        </div>

        {/* Key Metrics/Trust Indicators */}
        <div className="bg-gray-800 py-12">
            <div className="container mx-auto px-4 grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
                <div className="text-white">
                    <p className="text-4xl font-extrabold text-yellow-400">{cmsConfig.years}</p>
                    <p className="text-gray-400 mt-1">Years of Expertise</p>
                </div>
                <div className="text-white">
                    <p className="text-4xl font-extrabold text-yellow-400">{cmsConfig.countries}</p>
                    <p className="text-gray-400 mt-1">Countries Served</p>
                </div>
                <div className="text-white">
                    <p className="text-4xl font-extrabold text-yellow-400">{cmsConfig.projects}</p>
                    <p className="text-gray-400 mt-1">Successful Projects</p>
                </div>
                <div className="text-white">
                    <p className="text-4xl font-extrabold text-yellow-400">{cmsConfig.customers}</p>
                    <p className="text-gray-400 mt-1">Satisfied Customers</p>
                </div>
            </div>
        </div>

        {/* Featured Services */}
        <section className="container mx-auto px-4 py-16">
            <h2 className="text-4xl font-bold text-white text-center mb-12">Our Core Trading Expertise</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <ServiceCard
                    icon={Server}
                    title="IT Equipment Trading"
                    description="Source and supply high-grade networking gear, servers, data center components, and professional workstations globally."
                />
                <ServiceCard
                    icon={Cpu}
                    title="Electronics Distribution"
                    description="Wholesale distribution of consumer electronics, specialized industrial components, and cutting-edge digital devices across markets."
                />
                <ServiceCard
                    icon={Globe}
                    title="Global Sourcing & Logistics"
                    description="End-to-end supply chain management, ensuring fast, reliable, and compliant delivery of complex IT assets worldwide."
                />
            </div>
            <div className="text-center mt-12">
                <button onClick={() => setPage('services')} className="text-yellow-400 hover:text-yellow-300 font-semibold text-lg flex items-center mx-auto">
                    View All Services <span className="ml-2">&rarr;</span>
                </button>
            </div>
        </section>
    </>
);

const AboutUsPage = () => (
    <div className="container mx-auto px-4 py-32 text-gray-300">
        <h2 className="text-5xl font-extrabold text-white mb-10 border-b border-yellow-400 pb-4">
            About <span className="text-yellow-400">Zorix Global</span>
        </h2>

        <div className="grid md:grid-cols-2 gap-12">
            <div className="space-y-6">
                <p className="text-lg font-light">
                    Established as a dynamic general trading entity, Zorix Global is strategically positioned in the **Sharjah Airport International Free Zone (SAIF Zone), UAE**. Our prime location provides unparalleled access to global shipping routes, enabling us to execute seamless import and export operations across the Middle East, Africa, and Asia. We leverage the UAE's robust logistics infrastructure to deliver speed and efficiency.
                </p>
                <p className="text-lg font-light">
                    Our primary focus is the high-volume trading and distribution of **IT Equipment and Consumer Electronics**. We don't just trade—we act as a critical supply chain link, ensuring our B2B clients receive authenticated, high-quality products exactly when and where they are needed.
                </p>
                <div className="p-6 bg-gray-800 rounded-xl border-l-4 border-yellow-400">
                    <h3 className="text-xl font-bold text-white mb-2">Our Commitment</h3>
                    <p className="text-gray-400">We adhere to the highest international standards of quality control and compliance, backed by the credibility of the SAIF Zone regulatory framework.</p>
                </div>
            </div>
            <div className="space-y-6">
                <h3 className="text-3xl font-bold text-white mb-4">Mission & Vision</h3>
                <div className="flex items-start">
                    <CheckCircle className="w-6 h-6 text-yellow-400 mt-1 flex-shrink-0" />
                    <p className="ml-4 text-gray-300">
                        **Mission:** To streamline the global procurement and supply of technological assets, providing reliable, cost-effective trading solutions to our partners.
                    </p>
                </div>
                <div className="flex items-start">
                    <Zap className="w-6 h-6 text-yellow-400 mt-1 flex-shrink-0" />
                    <p className="ml-4 text-gray-300">
                        **Vision:** To be the most trusted and efficient global trading hub for cutting-edge IT and electronics across emerging markets.
                    </p>
                </div>
                <h3 className="text-3xl font-bold text-white mb-4 pt-6 border-t border-gray-700">Core Values</h3>
                <ul className="list-disc list-inside text-gray-400 space-y-2 ml-4">
                    <li>**Integrity:** Absolute transparency in all transactions.</li>
                    <li>**Efficiency:** Optimized logistics and swift execution.</li>
                    <li>**Reliability:** Delivering on promises, every time.</li>
                </ul>
            </div>
        </div>
    </div>
);

const ServicesPage = () => (
    <div className="container mx-auto px-4 py-32 text-gray-300">
        <h2 className="text-5xl font-extrabold text-white mb-10 text-center">
            Integrated <span className="text-yellow-400">Trading Services</span>
        </h2>
        <p className="text-center text-xl mb-16 max-w-3xl mx-auto">
            Our specialized services cover the full spectrum of high-value goods, backed by robust logistics to ensure your supply chain operates without interruption.
        </p>

        <div className="space-y-16">
            {/* IT Equipment Trading */}
            <div className="grid md:grid-cols-3 gap-8 items-center bg-gray-800 p-8 rounded-xl shadow-xl">
                <div className="md:col-span-2">
                    <div className="flex items-center mb-4">
                        <Server className="w-8 h-8 text-yellow-400 mr-3" />
                        <h3 className="text-3xl font-bold text-white">IT Equipment Trading</h3>
                    </div>
                    <p className="mb-4 text-lg">
                        We specialize in the procurement and distribution of mission-critical IT infrastructure for enterprises, data centers, and large-scale projects.
                    </p>
                    <ul className="space-y-2 text-gray-400">
                        <li className="flex items-center"><Layers className="w-4 h-4 mr-2 text-yellow-400" /> **Networking Gear:** Routers, Switches, Firewalls (Cisco, Juniper, etc.)</li>
                        <li className="flex items-center"><Cpu className="w-4 h-4 mr-2 text-yellow-400" /> **Servers & Storage:** Rack servers, blade systems, SAN/NAS solutions.</li>
                        <li className="flex items-center"><Info className="w-4 h-4 mr-2 text-yellow-400" /> **End-user Devices:** Professional laptops, desktops, and peripherals (Bulk B2B orders only).</li>
                    </ul>
                </div>
                <div className="hidden md:block">
                     <img src="https://placehold.co/300x200/27303c/fff?text=IT+Equipment" alt="IT Equipment" className="rounded-lg shadow-lg" />
                </div>
            </div>

            {/* Electronics Trading */}
            <div className="grid md:grid-cols-3 gap-8 items-center bg-gray-800 p-8 rounded-xl shadow-xl">
                <div className="hidden md:block">
                    <img src="https://placehold.co/300x200/27303c/fff?text=Consumer+Electronics" alt="Electronics Trading" className="rounded-lg shadow-lg" />
                </div>
                <div className="md:col-span-2">
                    <div className="flex items-center mb-4">
                        <Zap className="w-8 h-8 text-yellow-400 mr-3" />
                        <h3 className="text-3xl font-bold text-white">Electronics Trading & Distribution</h3>
                    </div>
                    <p className="mb-4 text-lg">
                        Our electronics division manages the distribution of general electronics, ensuring market access for both manufacturers and high-volume retailers.
                    </p>
                    <ul className="space-y-2 text-gray-400">
                        <li className="flex items-center"><CheckCircle className="w-4 h-4 mr-2 text-yellow-400" /> **Consumer Goods:** Audio/Visual equipment, smart home devices.</li>
                        <li className="flex items-center"><HardHat className="w-4 h-4 mr-2 text-yellow-400" /> **Industrial Components:** Specialized sensors, control units, and electronic modules.</li>
                        <li className="flex items-center"><Globe className="w-4 h-4 mr-2 text-yellow-400" /> **OEM/ODM Sourcing:** Connecting businesses with reliable original component manufacturers.</li>
                    </ul>
                </div>
            </div>
            
            {/* Logistics & Sourcing */}
            <div className="grid md:grid-cols-3 gap-8 items-center bg-gray-800 p-8 rounded-xl shadow-xl">
                <div className="md:col-span-3">
                    <div className="flex items-center mb-4">
                        <Globe className="w-8 h-8 text-yellow-400 mr-3" />
                        <h3 className="text-3xl font-bold text-white">Global Sourcing and Supply Chain</h3>
                    </div>
                    <p className="mb-4 text-lg">
                        Located in the SAIF Zone, our logistics team manages customs clearance, secure warehousing, and final-mile delivery for cross-border transactions, reducing your operational overhead.
                    </p>
                </div>
            </div>
        </div>
    </div>
);

const ProductCatalogPage = ({ setPage }) => (
    <div className="container mx-auto px-4 py-32 text-gray-300">
        <h2 className="text-5xl font-extrabold text-white mb-10 text-center">
            Our <span className="text-yellow-400">Product Showcase</span>
        </h2>
        <p className="text-center text-xl mb-16 max-w-3xl mx-auto">
            A snapshot of the high-demand categories we handle. For full inventory, please submit a formal inquiry.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {
                [
                    { name: "Enterprise Servers", img: "Server", desc: "High-density compute and storage solutions." },
                    { name: "Networking Switches", img: "Switch", desc: "Layer 2/3 managed and unmanaged switches." },
                    { name: "4K Displays", img: "Display", desc: "Bulk procurement of professional 4K monitors." },
                    { name: "Industrial IoT Kits", img: "IoT", desc: "Specialized electronic modules for automation." }
                ].map((product, index) => (
                    <div key={index} className="bg-gray-800 rounded-xl overflow-hidden shadow-lg hover:shadow-yellow-500/30 transition-shadow duration-300">
                        <img src={`https://placehold.co/400x250/374151/fff?text=${product.img}`} alt={product.name} className="w-full h-40 object-cover" />
                        <div className="p-4">
                            <h4 className="text-xl font-semibold text-white mb-2">{product.name}</h4>
                            <p className="text-gray-400 text-sm mb-4">{product.desc}</p>
                            <button
                                onClick={() => setPage('contactus')}
                                className="text-yellow-400 hover:text-yellow-300 font-medium text-sm flex items-center"
                            >
                                Inquire about this category &rarr;
                            </button>
                        </div>
                    </div>
                ))
            }
        </div>
    </div>
);

const ContactUsPage = ({ db, userId }) => {
    const [formData, setFormData] = useState({ name: '', company: '', email: '', phone: '', inquiry: 'Quote Request' });
    const [status, setStatus] = useState({ message: null, type: null });
    const [isLoading, setIsLoading] = useState(false);

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsLoading(true);
        setStatus({ message: null, type: null });

        // CRITICAL CHECK: Ensure DB and userId are ready before submitting lead
        if (!db || !userId) {
             const message = "System initialization pending. Please wait for the 'Initializing secure connection' message to clear.";
             setStatus({ message: message, type: 'error' });
             setIsLoading(false);
             return;
        }

        const result = await submitLead(db, userId, formData);
        
        if (result.success) {
            setStatus({ message: result.message, type: 'success' });
            setFormData({ name: '', company: '', email: '', phone: '', inquiry: 'Quote Request' }); // Clear form
        } else {
            setStatus({ message: result.message, type: 'error' });
        }

        setIsLoading(false);
    };

    return (
        <div className="container mx-auto px-4 py-32 text-gray-300">
            <h2 className="text-5xl font-extrabold text-white mb-10 text-center">
                Get In <span className="text-yellow-400">Touch</span>
            </h2>
            <p className="text-center text-xl mb-12 max-w-3xl mx-auto">
                We are ready to handle your global sourcing and trading needs. Fill out the form below or contact us directly.
            </p>

            <div className="grid md:grid-cols-2 gap-12">
                {/* Contact Form */}
                <div className="bg-gray-800 p-8 rounded-xl shadow-2xl">
                    <form onSubmit={handleSubmit} className="space-y-6">
                        <h3 className="text-2xl font-bold text-white mb-4">Submit an Inquiry</h3>
                        
                        {status.message && (
                            <div className={`p-4 rounded-lg ${status.type === 'success' ? 'bg-green-500/20 text-green-300' : 'bg-red-500/20 text-red-300'}`}>
                                {status.message}
                            </div>
                        )}

                        {['name', 'company', 'email', 'phone'].map(field => (
                            <input
                                key={field}
                                type={field === 'email' ? 'email' : 'text'}
                                name={field}
                                placeholder={field.charAt(0).toUpperCase() + field.slice(1) + (field === 'phone' ? ' (Optional)' : ' *')}
                                required={field !== 'phone'}
                                value={formData[field]}
                                onChange={handleChange}
                                className="w-full bg-gray-900 border border-gray-700 text-white p-3 rounded-lg focus:ring-yellow-500 focus:border-yellow-500 transition duration-200"
                            />
                        ))}

                        <select
                            name="inquiry"
                            value={formData.inquiry}
                            onChange={handleChange}
                            className="w-full bg-gray-900 border border-gray-700 text-white p-3 rounded-lg focus:ring-yellow-500 focus:border-yellow-500 transition duration-200"
                            required
                        >
                            <option value="Quote Request">Quote Request</option>
                            <option value="Partnership Inquiry">Partnership Inquiry</option>
                            <option value="General Question">General Question</option>
                        </select>

                        <button
                            type="submit"
                            disabled={isLoading}
                            className="w-full bg-yellow-500 hover:bg-yellow-600 text-gray-900 font-bold py-3 px-4 rounded-lg text-lg transition-colors duration-300 flex items-center justify-center disabled:opacity-50"
                        >
                            {isLoading ? <Loader className="w-5 h-5 animate-spin mr-2" /> : <Mail className="w-5 h-5 mr-2" />}
                            {isLoading ? 'Sending...' : 'Send Message'}
                        </button>
                    </form>
                </div>

                {/* Contact Details and Map */}
                <div className="space-y-8">
                    <div className="bg-gray-800 p-6 rounded-xl shadow-2xl">
                        <h3 className="text-2xl font-bold text-white mb-4 border-b border-gray-700 pb-2">Our Office</h3>
                        <div className="space-y-4">
                            <p className="flex items-center text-lg">
                                <MapPin className="w-6 h-6 text-yellow-400 mr-3 flex-shrink-0" />
                                <span className="font-semibold text-white">Address:</span> SAIF Zone, P.O. Box XXXX, Sharjah, UAE
                            </p>
                            <p className="flex items-center text-lg">
                                <Mail className="w-6 h-6 text-yellow-400 mr-3 flex-shrink-0" />
                                <span className="font-semibold text-white">Email:</span> info@zorixglobal.com
                            </p>
                            <p className="flex items-center text-lg">
                                <Phone className="w-6 h-6 text-yellow-400 mr-3 flex-shrink-0" />
                                <span className="font-semibold text-white">Phone:</span> +971 50 XXX XXXX
                            </p>
                        </div>
                    </div>
                    
                    {/* Embedded Google Map Simulation */}
                    <div className="bg-gray-800 p-2 rounded-xl shadow-2xl h-96">
                        <iframe
                            title="SAIF Zone Location Map"
                            src="https://maps.google.com/maps?q=Sharjah+Airport+International+Free+Zone&t=&z=13&ie=UTF8&iwloc=&output=embed"
                            width="100%"
                            height="100%"
                            allowFullScreen=""
                            loading="lazy"
                            referrerPolicy="no-referrer-when-downgrade"
                            className="rounded-lg border-0"
                        ></iframe>
                    </div>
                </div>
            </div>
        </div>
    );
};

// --- NEW LEGAL/INFORMATIONAL PAGES ---

const PrivacyPolicyPage = () => (
    <PageLayout title="Privacy Policy" icon={FileText}>
        <p><strong>Effective Date: 1 Jan 2024</strong></p>
        
        <h3>1. Introduction</h3>
        <p>Zorix Global is committed to protecting the privacy of its clients and users. This policy outlines how we collect, use, and protect your personal and company information.</p>

        <h3>2. Information We Collect</h3>
        <p>We collect information necessary for B2B transactions and communication, primarily through the Contact Us form:</p>
        <ul>
            <li>**Contact Data:** Name, Company name, Email address, Phone number.</li>
            <li>**Usage Data (Platform):** Your unique User ID generated by the Canvas environment for Firestore access (`userId`). We use this ID solely for securing and segmenting the data you submit (e.g., leads), and we do not use it to personally identify you outside of our transaction records.</li>
        </ul>

        <h3>3. How We Use Your Information</h3>
        <p>Your information is used solely for legitimate business purposes:</p>
        <ul>
            <li>To respond to quotation requests and partnership inquiries.</li>
            <li>To process and manage your lead submissions (stored securely in a private collection in Firestore, accessible only to Zorix Global's authenticated Firebase user).</li>
            <li>To improve our website functionality and service offerings.</li>
        </ul>

        <h3>4. Data Security</h3>
        <p>We use Firebase Firestore for secure data storage. Data submitted via the Contact form is stored in a private collection linked to your unique user ID, ensuring it remains isolated from other user data.</p>
        
        <h3>5. Contacting Us</h3>
        <p>If you have questions regarding this Privacy Policy, please contact us at info@zorixglobal.com.</p>
    </PageLayout>
);

const TermsOfTradePage = () => (
    <PageLayout title="Terms of Trade" icon={FileText}>
        <p><strong>Effective Date: 1 Jan 2024</strong></p>
        
        <h3>1. Applicability</h3>
        <p>These Terms of Trade govern all transactions, sales, and supply agreements between Zorix Global (The Seller) and the client (The Buyer) concerning IT equipment and consumer electronics.</p>

        <h3>2. Quotations and Orders</h3>
        <p>All quotations are valid for 7 days unless otherwise specified. A binding contract is formed only upon The Seller’s written acceptance of a formal Purchase Order (PO) from The Buyer.</p>

        <h3>3. Payment Terms</h3>
        <p>Standard payment terms are 100% advance T/T (Telegraphic Transfer), or as mutually agreed and specified in the Proforma Invoice (PI). Goods will not be shipped until full cleared payment is received.</p>

        <h3>4. Shipment and Delivery</h3>
        <ul>
            <li>**Incoterms:** Unless specified, all sales are EXW (Ex Works) our warehouse in SAIF Zone, UAE. If DDP, CIF, or FOB terms are required, they will be explicitly stated in the PI.</li>
            <li>**Risk:** Risk of loss or damage passes to The Buyer upon handover to the carrier, regardless of the Incoterm used.</li>
            <li>**Customs and Duties:** The Buyer is responsible for all import duties, taxes, customs clearance, and associated fees in the destination country unless DDP terms are explicitly agreed upon.</li>
        </ul>

        <h3>5. Warranty and Liability</h3>
        <p>The Seller guarantees that products are new and authentic upon shipment. Warranty claims are subject to the original manufacturer's warranty policies. The Seller's liability is strictly limited to the purchase price of the goods.</p>
    </PageLayout>
);

const SitemapPage = ({ setPage }) => {
    const mainPages = [
        { name: 'Home', page: 'home', icon: Zap, desc: 'The entry point to Zorix Global, highlighting core strengths and metrics.' },
        { name: 'About Us', page: 'aboutus', icon: Info, desc: 'Information on Zorix Global’s location, mission, vision, and values.' },
        { name: 'Services', page: 'services', icon: Layers, desc: 'Detailed breakdown of IT Trading, Electronics Distribution, and Logistics services.' },
        { name: 'Products', page: 'products', icon: Server, desc: 'Showcase of key product categories and inquiry link.' },
        { name: 'Contact Us', page: 'contactus', icon: Phone, desc: 'Inquiry form and all contact and location details.' },
    ];
    const legalPages = [
        { name: 'Privacy Policy', page: 'privacypolicy', icon: FileText, desc: 'Details on how personal and company data is collected, stored, and used.' },
        { name: 'Terms of Trade', page: 'termsoftrade', icon: FileText, desc: 'Official B2B terms covering payment, shipment, and warranty.' },
        { name: 'Sitemap', page: 'sitemap', icon: LayoutGrid, desc: 'This structured directory of all pages on the website.' },
    ];

    return (
        <PageLayout title="Site Map" icon={LayoutGrid}>
            <p>This map provides a structured overview of all content accessible on the Zorix Global website.</p>

            <h3 className="text-3xl font-bold text-white mt-8 mb-6">Primary Pages</h3>
            <div className="grid md:grid-cols-2 gap-6">
                {mainPages.map((item, index) => (
                    <button
                        key={index}
                        onClick={() => setPage(item.page)}
                        className="p-4 bg-gray-800 rounded-xl text-left hover:bg-gray-700 transition-colors duration-200 shadow-lg flex items-center"
                    >
                        <item.icon className="w-6 h-6 text-yellow-400 mr-4 flex-shrink-0" />
                        <div>
                            <p className="text-lg font-semibold text-white">{item.name}</p>
                            <p className="text-sm text-gray-400">{item.desc}</p>
                        </div>
                    </button>
                ))}
            </div>

            <h3 className="text-3xl font-bold text-white mt-12 mb-6 border-t border-gray-700 pt-8">Legal & Information</h3>
            <div className="grid md:grid-cols-2 gap-6">
                {legalPages.map((item, index) => (
                    <button
                        key={index}
                        onClick={() => setPage(item.page)}
                        className="p-4 bg-gray-800 rounded-xl text-left hover:bg-gray-700 transition-colors duration-200 shadow-lg flex items-center"
                    >
                        <item.icon className="w-6 h-6 text-yellow-400 mr-4 flex-shrink-0" />
                        <div>
                            <p className="text-lg font-semibold text-white">{item.name}</p>
                            <p className="text-sm text-gray-400">{item.desc}</p>
                        </div>
                    </button>
                ))}
            </div>
        </PageLayout>
    );
};


// --- MAIN APP COMPONENT ---

const App = () => {
    // This hook manages the authentication and DB connection safely.
    const { db, userId, isAuthReady } = useFirebaseSetup();
    const cmsConfig = useCmsConfig(db, isAuthReady);

    const [currentPage, setCurrentPage] = useState('home');

    const renderPage = useMemo(() => {
        if (!isAuthReady) {
            return (
                <div className="min-h-screen flex items-center justify-center bg-gray-900 text-yellow-400">
                    <Loader className="w-10 h-10 animate-spin mr-3" />
                    <span className="text-xl">Initializing secure connection...</span>
                </div>
            );
        }

        switch (currentPage) {
            case 'home':
                return <HomePage setPage={setCurrentPage} cmsConfig={cmsConfig} />;
            case 'aboutus':
                return <AboutUsPage />;
            case 'services':
                return <ServicesPage />;
            case 'products':
                return <ProductCatalogPage setPage={setCurrentPage} />;
            case 'contactus':
                return <ContactUsPage db={db} userId={userId} />;
            case 'privacypolicy':
                return <PrivacyPolicyPage />;
            case 'termsoftrade':
                return <TermsOfTradePage />;
            case 'sitemap':
                return <SitemapPage setPage={setCurrentPage} />;
            default:
                return <HomePage setPage={setCurrentPage} cmsConfig={cmsConfig} />;
        }
    }, [currentPage, isAuthReady, cmsConfig, db, userId]);

    return (
        <div className="min-h-screen bg-gray-900 font-sans">
            <Header currentPage={currentPage} setPage={setCurrentPage} />
            <main className="pt-16">
                {renderPage}
            </main>
            <Footer userId={userId} setPage={setCurrentPage} />
        </div>
    );
};

export default App;
