import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/authContext.js";
import LanguageSwitcher from "../components/LanguageSwitcher.jsx";
import { supabase } from "../lib/supabase.js";
import Community from "./Community";

import ProfileEditor from "../components/ProfileEditor.jsx";
const DASHBOARD_REFERENCE_TIME = Date.now();

function errorKey(error, fallback = "marketplace.databaseError") {
    if (error?.code === "23505") return "dashboardErrors.duplicateRecord";
    if (error?.code === "23503") return "dashboardErrors.relatedRecordMissing";
    if (["42501", "PGRST301"].includes(error?.code)) return "dashboardErrors.permissionDenied";
    if (error?.message?.toLowerCase().includes("fetch")) return "marketplace.networkError";
    return fallback;
}

function cropLabel(crop, t) {
    const keys = { "Dhaan (paddy)": "common.paddy", "Gehun (wheat)": "common.wheat", "Doosri fasal": "common.otherCrop" };
    return keys[crop] ? t(keys[crop]) : crop;
}

function RequestDetails({ request }) {
    const { t, i18n } = useTranslation();
    const status = request.status === "in_progress" ? "common.inProgress" : `common.${request.status}`;
    return <>
        <h3>{cropLabel(request.crop, t)}</h3>
        <p><strong>{t("common.quantity")}:</strong> {request.quantity} {t(request.unit === "tonne" ? "common.tonne" : "common.quintal")}</p>
        <p><strong>{t("common.location")}:</strong> {[request.village, request.district, request.state].filter(Boolean).join(", ")}</p>
        <p><strong>{t("common.pickup")}:</strong> {request.pickup_location}</p>
        <p><strong>{t("common.status")}:</strong> {t(status)}</p>
        <p><strong>{t("common.request")}:</strong> {new Date(request.created_at).toLocaleDateString(i18n.resolvedLanguage === "hi" ? "hi-IN" : "en-IN")}</p>
        {request.expected_price != null && <p><strong>{t("farmer.expectedPrice")}:</strong> ₹{request.expected_price}</p>}
    </>;
}

function DashboardFrame({ role, title, intro, children }) {
    const [activeTab, setActiveTab] = useState("dashboard");
    const navigate = useNavigate();
    const { t } = useTranslation();
    const { profile, signOut } = useAuth();
    const [error, setError] = useState("");
    const [working, setWorking] = useState(false);
    async function logout() {
        setWorking(true);
        setError("");
        try { await signOut(); navigate("/login", { replace: true }); }
        catch { setError("errors.logout"); setWorking(false); }
    }
    return <main className="app-shell role-dashboard">
        <header className="topbar"><a className="brand" href="#/dashboard">🌾 Parali Saathi</a><div className="role-actions">
            <LanguageSwitcher /><span className="role-pill">{t(role === "organization" ? "navigation.organizationMode" : "navigation.servicesMode")}</span>
            <button className="auth-secondary" type="button" onClick={logout} disabled={working}>{working ? t("common.loggingOut") : t("common.logout")}</button>
            <button
                type="button"
                className="auth-secondary"
                onClick={() =>
                    setActiveTab((current) =>
                        current === "community" ? "dashboard" : "community"
                    )
                }
            >
                {activeTab === "community" ? "Dashboard" : "Community"}
            </button>
        </div></header>
        <section className="role-dashboard-intro"><p className="eyebrow">{profile.email}</p><h1>{title}</h1><p>{intro}</p></section>
        {error && <p className="listing-error" role="alert">{t(error)}</p>}

{activeTab === "community" ? (
  <Community />
) : (
  children
)}
        <footer className="app-footer">Parali Saathi · Team Zero Burn<p>{t("marketplace.footerPrivate")}</p></footer>
    </main>;
}

export function FarmerMarketplaceSections() {
    const { t } = useTranslation();
    const { session, profile } = useAuth();
    const [requests, setRequests] = useState([]);
    const [providers, setProviders] = useState([]);

    const [serviceOfferings, setServiceOfferings] = useState([]);
    const [servicesLoading, setServicesLoading] = useState(true);
    const [interests, setInterests] = useState([]);
    const [counts, setCounts] = useState({});
    const [form, setForm] = useState({ crop: "Dhaan (paddy)", quantity: "", unit: "quintal", pickup_location: "", expected_price: "" });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    const [notice, setNotice] = useState("");
    useEffect(() => {
        let active = true;
        async function load() {


            const [offers, rr, serviceJobs] = await Promise.all([
                supabase
                    .from("service_offerings")
                    .select("id, provider_id, name, description, service_area, price, pricing_unit, contact_phone, is_active")
                    .eq("is_active", true)
                    .order("created_at", { ascending: false }),


                supabase
                    .from("parali_requests")
                    .select("id, farmer_id, crop, quantity, unit, village, district, state, pickup_location, expected_price, status, created_at, updated_at")
                    .order("created_at", { ascending: false }),

                supabase
                    .from("service_requests")
                    .select("parali_request_id"),


            ]);

            if (!active) return;

            if (offers.error) {
                console.error("Farmer service offerings error:", offers.error);
            } else {
                setServiceOfferings(offers.data || []);
            }

            setServicesLoading(false);

            if (rr.error || serviceJobs.error) {
                console.error(
                    "Farmer requests load error:",
                    rr.error || serviceJobs.error
                );
                setError(errorKey(rr.error || serviceJobs.error));
            } else {
                setRequests(rr.data || []);
                setProviders([]);
                setInterests([]);

                const next = {};

                for (const item of serviceJobs.data || []) {
                    if (item.parali_request_id) {
                        next[item.parali_request_id] =
                            (next[item.parali_request_id] || 0) + 1;
                    }
                }

                setCounts(next);
            }

            setLoading(false);

        }
        void load();
        return () => { active = false; };
    }, [session.user.id]);

    async function createRequest(event) {
        event.preventDefault(); setSaving(true); setError(""); setNotice("");
        if (!profile.village || !profile.district || !profile.state) { setError("farmer.farmerRequired"); setSaving(false); return; }
        const price = form.expected_price === "" ? null : Number(form.expected_price);
        if (price !== null && (!Number.isFinite(price) || price < 0)) { setError("listings.validation.priceNonNegative"); setSaving(false); return; }

        const { data, error: insertError } = await supabase
            .from("parali_requests")
            .insert({
                farmer_id: session.user.id,
                crop: form.crop,
                quantity: Number(form.quantity),
                unit: form.unit,
                village: profile.village,
                district: profile.district,
                state: profile.state,
                pickup_location: form.pickup_location.trim(),
                expected_price: price,
                status: "open",
            })
            .select("id, farmer_id, crop, quantity, unit, village, district, state, pickup_location, expected_price, status, created_at, updated_at")
            .single();

        console.log("PARALI INSERT RESULT:", {
            data,
            error: insertError,
            userId: session?.user?.id,
        });
        if (insertError || !data) {
            console.error("PARALI REQUEST SAVE FAILED:", insertError);
            setError(insertError?.message || "Request save failed");
            window.alert(insertError?.message || "Request save failed");
        } else {
            setRequests((old) => [data, ...old]);
            setForm((old) => ({
                ...old,
                quantity: "",
                pickup_location: "",
                expected_price: "",
            }));

            setNotice("marketplace.requestSaved");
        }

        setSaving(false);
    }

    async function updateRequest(id, status) {
        const { data, error: updateError } = await supabase.from("parali_requests").update({ status }).eq("id", id).eq("farmer_id", session.user.id)
            .select("id, farmer_id, crop, quantity, unit, village, district, state, pickup_location, expected_price, status, created_at, updated_at").single();
        if (updateError || !data) setError(errorKey(updateError));
        else setRequests((old) => old.map((item) => item.id === id ? data : item));
    }

    async function updateInterest(id, status) {
        const { data, error: updateError } = await supabase.from("parali_organization_interests").update({ status }).eq("id", id)
            .select("id, request_id, organization_id, status, proposed_price, created_at").single();
        if (updateError || !data) setError(errorKey(updateError));
        else setInterests((old) => old.map((item) => item.id === id ? data : item));
    }

    return <section className="marketplace-section">
        <div className="marketplace-heading"><div><p className="eyebrow">{t("marketplace.sectionEyebrow")}</p><h2>{t("marketplace.pickupRequests")}</h2></div><span className="listing-status">{t("marketplace.databaseRequests")}</span></div>
        <form className="request-form" onSubmit={(event) => void createRequest(event)}>
            <label>{t("marketplace.crop")}<select value={form.crop} onChange={(event) => setForm({ ...form, crop: event.target.value })}><option value="Dhaan (paddy)">{t("common.paddy")}</option><option value="Gehun (wheat)">{t("common.wheat")}</option><option value="Doosri fasal">{t("common.otherCrop")}</option></select></label>
            <label>{t("marketplace.quantity")}<input type="number" min="0.1" step="0.1" required value={form.quantity} onChange={(event) => setForm({ ...form, quantity: event.target.value })} /></label>
            <label>{t("marketplace.unit")}<select value={form.unit} onChange={(event) => setForm({ ...form, unit: event.target.value })}><option value="quintal">{t("common.quintal")}</option><option value="tonne">{t("common.tonne")}</option></select></label>
            <label>{t("marketplace.pickupLocation")}<input maxLength={160} required placeholder={t("marketplace.pickupPlaceholder")} value={form.pickup_location} onChange={(event) => setForm({ ...form, pickup_location: event.target.value })} /></label>
            <label>{t("listings.priceLabel")}<input type="number" min="0" step="0.01" value={form.expected_price} onChange={(event) => setForm({ ...form, expected_price: event.target.value })} /></label>
            <button className="primary-btn" type="submit" disabled={saving}>{saving ? t("marketplace.savingRequest") : t("marketplace.createRequest")}</button>
        </form>
        {notice && <p className="marketplace-success" role="status">{t(notice)}</p>}{error && <p className="listing-error" role="alert">{t(error)}</p>}
        <div className="marketplace-columns">

            <section className="marketplace-subsection">
                <h3>Available Service Offers</h3>

                {servicesLoading ? (
                    <p>Loading services...</p>
                ) : serviceOfferings.length === 0 ? (
                    <p>Abhi koi active service offer available nahi hai.</p>
                ) : (
                    <div className="saved-listing-grid">
                        {serviceOfferings.map((service) => (
                            <article className="saved-listing-card" key={service.id}>
                                <h3>{service.name}</h3>
                                <p>{service.description || "No description"}</p>
                                <p>
                                    <strong>Service Area:</strong>{" "}
                                    {service.service_area || "Not specified"}
                                </p>
                                <p>
                                    <strong>Price:</strong>{" "}
                                    {service.price == null
                                        ? "Contact for price"
                                        : `₹${service.price} / ${service.pricing_unit || "quote"}`}
                                </p>
                                {service.contact_phone && (
                                    <p>
                                        <strong>Contact:</strong> {service.contact_phone}
                                    </p>
                                )}
                            </article>
                        ))}
                    </div>
                )}
            </section>
            <section><h3>{t("marketplace.myRequests", { count: requests.length })}</h3>{loading ? <p>{t("marketplace.loadingRequests")}</p> : requests.length === 0 ? <p>{t("marketplace.noFarmerRequests")}</p> : <div className="saved-listing-grid">{requests.map((item) => <article className="saved-listing-card" key={item.id}><RequestDetails request={item} /><p><strong>{t("marketplace.offersCount")}</strong> {counts[item.id] || 0}</p>{item.status === "open" && <button className="delete-listing-btn" type="button" onClick={() => void updateRequest(item.id, "cancelled")}>{t("marketplace.cancelRequest")}</button>}</article>)}</div>}</section>
            <section><h3>{t("marketplace.providers")}</h3>{loading ? <p>{t("marketplace.loadingDirectory")}</p> : providers.length === 0 ? <p>{t("marketplace.noProviders")}</p> : <div className="provider-list">{providers.map((item) => <article className="provider-row" key={item.id}><span className="provider-icon" aria-hidden="true">{item.role === "organization" ? "🏭" : "🚜"}</span><div><strong>{item.display_name}</strong><p>{t(item.role === "organization" ? "marketplace.organizationType" : "marketplace.serviceType")}{item.category ? ` · ${item.category}` : ""}</p><p>{[item.village, item.district, item.state].filter(Boolean).join(", ")}</p></div><span className="listing-status">{t("common.directory")}</span></article>)}</div>}<p className="marketplace-note">{t("marketplace.privateNote")}</p></section>
        </div>
        <section className="marketplace-subsection"><h3>{t("farmer.organizationRequestsTitle", { count: interests.length })}</h3>{interests.length === 0 ? <p>{t("farmer.noOrganizationRequests")}</p> : <div className="saved-listing-grid">{interests.map((item) => { const request = requests.find((row) => row.id === item.request_id); const organization = providers.find((row) => row.id === item.organization_id); return <article className="saved-listing-card" key={item.id}><h4>{organization?.display_name || t("common.organization")}</h4>{request && <p>{cropLabel(request.crop, t)} · {request.quantity} {t(request.unit === "tonne" ? "common.tonne" : "common.quintal")}</p>}{item.proposed_price != null && <p><strong>{t("farmer.proposedPrice")}</strong> ₹{item.proposed_price}</p>}<p><strong>{t("common.status")}:</strong> {t(`common.${item.status}`)}</p>{item.status === "pending" && <div className="request-actions"><button className="primary-btn" type="button" onClick={() => void updateInterest(item.id, "accepted")}>{t("farmer.acceptRequest")}</button><button className="delete-listing-btn" type="button" onClick={() => void updateInterest(item.id, "rejected")}>{t("farmer.rejectRequest")}</button></div>}{item.status === "accepted" && <button className="primary-btn" type="button" onClick={() => void updateInterest(item.id, "completed")}>{t("farmer.markCompleted")}</button>}</article>; })}</div>}</section>
    </section>;
}

export function OrganizationDashboard() {
    const { t, i18n } = useTranslation();
    const { session, profile, refreshProfile } = useAuth();
    const [listings, setListings] = useState([]); const [requests, setRequests] = useState([]);
    const [farmerContacts, setFarmerContacts] = useState({});
    const [loading, setLoading] = useState(true); const [workingId, setWorkingId] = useState(""); const [savingProfile, setSavingProfile] = useState(false);
    const [error, setError] = useState(""); const [notice, setNotice] = useState("");
    const [search, setSearch] = useState(""); const [village, setVillage] = useState(""); const [crop, setCrop] = useState(""); const [minimum, setMinimum] = useState(""); const [maximum, setMaximum] = useState("");
    const [unitFilter, setUnitFilter] = useState("");
    const [profileForm, setProfileForm] = useState(() => Object.fromEntries(["organization_name", "contact_person", "phone", "organization_type", "address", "village", "district", "state"].map((field) => [field, profile[field] || ""])));
    useEffect(() => {
        let active = true;
        async function load() {
            setLoading(true);
            const [lr, rr] = await Promise.all([
                supabase.from("parali_requests").select("id, farmer_id, crop, quantity, unit, village, district, state, pickup_location, expected_price, status, created_at, updated_at").eq("status", "open").order("created_at", { ascending: false }),
                supabase.from("parali_organization_interests").select("id, request_id, status, proposed_price, message, created_at").eq("organization_id", session.user.id).order("created_at", { ascending: false }),
            ]);

            if (!active) return;

            const failed = lr.error || rr.error;

            if (failed) {
                console.error("Organization dashboard load error:", failed);
                setError(errorKey(failed));
            } else {
                const nextListings = lr.data || [];
                const nextRequests = rr.data || [];

                setListings(nextListings);
                setRequests(nextRequests);

                const farmerIds = [
                    ...new Set(
                        nextListings
                            .map((item) => item.farmer_id)
                            .filter(Boolean)
                    ),
                ];

                if (farmerIds.length) {
                    const { data: contacts, error: contactError } =
                        await supabase
                            .from("profiles")
                            .select("id, full_name, phone, email")
                            .in("id", farmerIds);

                    if (contactError) {
                        console.error("Farmer contacts error:", contactError);
                        setError(errorKey(contactError));
                    } else {
                        setFarmerContacts(
                            Object.fromEntries(
                                (contacts || []).map((item) => [item.id, item])
                            )
                        );
                    }
                } else {
                    setFarmerContacts({});
                }
            }

            setLoading(false);
        }
        void load();
        return () => { active = false; };
    }, [session.user.id]);
    const now = DASHBOARD_REFERENCE_TIME;
    const newCount = listings.filter((item) => now - new Date(item.created_at).getTime() <= 7 * 86400000).length;
    const acceptedCount = requests.filter((item) => item.status === "accepted").length;
    const completedCount = requests.filter((item) => item.status === "completed").length;
    const shown = listings.filter((item) => {
        const text = [item.crop, item.village, item.district, item.state, item.pickup_location].join(" ").toLowerCase();
        return (!search || text.includes(search.trim().toLowerCase())) && (!village || item.village.toLowerCase().includes(village.toLowerCase())) && (!crop || item.crop === crop) && (!unitFilter || item.unit === unitFilter) && (minimum === "" || (unitFilter && item.quantity >= Number(minimum))) && (maximum === "" || (unitFilter && item.quantity <= Number(maximum)));
    });
    async function submitRequest(event, listingId) {
        event.preventDefault(); setWorkingId(listingId); setError(""); setNotice("");
        const fields = new FormData(event.currentTarget); const raw = String(fields.get("proposed_price") || "").trim(); const price = raw === "" ? null : Number(raw);
        if (price !== null && (!Number.isFinite(price) || price < 0)) { setError("organizationErrors.invalidPrice"); setWorkingId(""); return; }
        const { data, error: insertError } = await supabase.from("parali_organization_interests").insert({ request_id: listingId, organization_id: session.user.id, proposed_price: price, message: String(fields.get("message") || "").trim() }).select("id, request_id, status, proposed_price, message, created_at").single();

        if (insertError || !data) {
            console.error("Organization request insert error:", insertError);
            setError(errorKey(insertError, "organizationErrors.requestFailed"));
        } else {
            setRequests((old) => [data, ...old]);
            setNotice("organization.requestSubmitted");
        }

        setWorkingId("");


    }
    async function cancelRequest(id) {
        setWorkingId(id); setError("");
        const { data, error: updateError } = await supabase.from("parali_organization_interests").update({ status: "cancelled" }).eq("id", id).eq("organization_id", session.user.id).eq("status", "pending").select("id, request_id, status, proposed_price, message, created_at").single();
        if (updateError || !data) setError(errorKey(updateError, "organizationErrors.cancelFailed")); else { setRequests((old) => old.map((item) => item.id === id ? data : item)); setNotice("organization.requestCancelled"); }
        setWorkingId("");
    }
    async function updateProfile(event) {
        event.preventDefault(); setSavingProfile(true); setError("");
        const { error: updateError } = await supabase.from("profiles").update(Object.fromEntries(Object.entries(profileForm).map(([key, value]) => [key, value.trim()]))).eq("id", session.user.id);
        if (updateError) setError(errorKey(updateError, "organizationErrors.profileSaveFailed")); else { await refreshProfile(); setNotice("organization.profileSaved"); }
        setSavingProfile(false);
    }
    return <DashboardFrame role="organization" title={t("organization.greeting", { name: profile.organization_name || t("common.organization") })} intro={t("organization.intro")}>
        <nav className="dashboard-section-nav" aria-label={t("common.dashboardSections")}><a href="#organization-overview">{t("common.overview")}</a><a href="#organization-listings">{t("organization.listingsTitle")}</a><a href="#organization-requests">{t("organization.requestsTitle")}</a><a href="#organization-profile">{t("common.profile")}</a></nav>
        {notice && <p className="marketplace-success" role="status">{t(notice)}</p>}{error && <p className="listing-error" role="alert">{t(error)}</p>}
        <section className="dashboard-metrics" id="organization-overview">{[["organization.metrics.available", listings.length], ["organization.metrics.new", newCount], ["organization.metrics.requests", requests.length], ["organization.metrics.accepted", acceptedCount], ["organization.metrics.completed", completedCount]].map(([key, value]) => <article key={key}><span>{t(key)}</span><strong>{loading ? "—" : value}</strong></article>)}</section>
        <section className="marketplace-section" id="organization-listings"><div className="marketplace-heading"><div><p className="eyebrow">{t("marketplace.openRequests")}</p><h2>{t("organization.listingsTitle")}</h2></div><span className="listing-status">{t("organization.openCount", { count: listings.length })}</span></div>
            <div className="dashboard-filters">
                <label>{t("common.search")}<input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t("organization.searchPlaceholder")} /></label>
                <label>{t("common.village")}<input value={village} onChange={(event) => setVillage(event.target.value)} placeholder={t("organization.villageFilterPlaceholder")} /></label>
                <label>{t("common.crop")}<select value={crop} onChange={(event) => setCrop(event.target.value)}><option value="">{t("common.all")}</option>{[...new Set(listings.map((item) => item.crop))].map((item) => <option key={item} value={item}>{cropLabel(item, t)}</option>)}</select></label>
                <label>{t("common.unit")}<select value={unitFilter} onChange={(event) => setUnitFilter(event.target.value)}><option value="">{t("common.all")}</option><option value="quintal">{t("common.quintal")}</option><option value="tonne">{t("common.tonne")}</option></select></label>
                <label>{t("organization.minimumQuantity")}<input type="number" min="0" disabled={!unitFilter} value={minimum} onChange={(event) => setMinimum(event.target.value)} /></label>
                <label>{t("organization.maximumQuantity")}<input type="number" min="0" disabled={!unitFilter} value={maximum} onChange={(event) => setMaximum(event.target.value)} /></label>
                <label>{t("common.status")}<select value="open" disabled aria-label={t("organization.availableOnly")}><option value="open">{t("common.open")}</option></select></label>
            </div>
            {!unitFilter && <p className="marketplace-note">{t("organization.quantityUnitHint")}</p>}
            {loading ? <p>{t("common.loading")}</p> : shown.length === 0 ? <p className="empty-listings">{listings.length ? t("organization.noFilteredListings") : t("organization.noListings")}</p> : <div className="saved-listing-grid">{shown.map((listing) => {
                const contact = farmerContacts[listing.farmer_id];
                const existing = requests.find((item) => item.request_id === listing.id); const isNew = now - new Date(listing.created_at).getTime() <= 7 * 86400000; return <article className="saved-listing-card org-listing-card" key={listing.id}>
                    <div className="saved-listing-heading"><span className="card-emoji">🌾</span><span className="listing-status">{t(`common.${listing.status}`)}</span></div><h3>{cropLabel(listing.crop, t)}{isNew ? ` · ${t("organization.newBadge")}` : ""}</h3><RequestDetails request={listing} /><p><strong>{t("organization.posted")}:</strong> {new Date(listing.created_at).toLocaleDateString(i18n.resolvedLanguage === "hi" ? "hi-IN" : "en-IN")}</p><details className="listing-details"><summary>{t("organization.viewDetails")}</summary><p>{t("organization.detailsPrivacy")}</p></details>
                    {existing ? <div className="request-state"><p><strong>{t("organization.requestStatus")}:</strong> {t(`common.${existing.status}`)}</p>{existing.proposed_price != null && <p><strong>{t("organization.proposedPrice")}:</strong> ₹{existing.proposed_price}</p>}{existing.message && <p>{existing.message}</p>}{existing.status === "pending" && <button className="delete-listing-btn" type="button" disabled={workingId === existing.id} onClick={() => void cancelRequest(existing.id)}>{t("organization.cancelRequest")}</button>}</div> : <form className="collection-request-form" onSubmit={(event) => void submitRequest(event, listing.id)}><label>{t("organization.proposedPriceOptional")}<input name="proposed_price" type="number" min="0" step="0.01" placeholder={t("organization.pricePlaceholder")} /></label><label>{t("organization.messageOptional")}<textarea name="message" maxLength="500" rows="2" placeholder={t("organization.messagePlaceholder")} /></label><button className="primary-btn" type="submit" disabled={workingId === listing.id}>{workingId === listing.id ? t("common.submitting") : t("organization.submitRequest")}</button></form>}

                    return (
                    <article className="saved-listing-card org-listing-card" key={listing.id}>
                        <div className="saved-listing-heading">
                            <span className="card-emoji">🌾</span>
                            <span className="listing-status">
                                {t(`common.${listing.status}`)}
                            </span>
                        </div>

                        <h3>{cropLabel(listing.crop, t)}</h3>

                        <RequestDetails request={listing} />

                        {/* Farmer ka naam aur mobile number */}
                        <div className="farmer-contact-details">
                            <p>
                                <strong>Farmer Name:</strong>{" "}
                                {contact?.full_name || "Not available"}
                            </p>
                            <p>
                                <strong>Mobile Number:</strong>{" "}
                                {contact?.phone || "Not available"}
                            </p>
                        </div>

                        {/* Iske baad tumhara purana code waise hi rahega */}
                    </article>
                    ); </article>;
            })}</div>}<p className="marketplace-note">{t("organization.listingPrivacyNote")}</p>
        </section>
        <section className="marketplace-section" id="organization-requests"><h2>{t("organization.requestsTitle")}</h2>{loading ? <p>{t("common.loading")}</p> : requests.length === 0 ? <p className="empty-listings">{t("organization.noRequests")}</p> : <div className="saved-listing-grid">{requests.map((item) => { const listing = listings.find((row) => row.id === item.request_id); const contact = listing ? farmerContacts[listing.farmer_id] : null; return <article className="saved-listing-card" key={item.id}><h3>{cropLabel(listing?.crop || t("organization.listingUnavailable"), t)}</h3><p><strong>{t("organization.requestStatus")}:</strong> {t(`common.${item.status}`)}</p>{item.proposed_price != null && <p><strong>{t("organization.proposedPrice")}:</strong> ₹{item.proposed_price}</p>}<p><strong>{t("common.request")}:</strong> {new Date(item.created_at).toLocaleDateString(i18n.resolvedLanguage === "hi" ? "hi-IN" : "en-IN")}</p>{contact && ["accepted", "completed"].includes(item.status) && <div className="permitted-contact"><strong>{t("organization.farmerContact")}</strong><p>{contact.full_name || t("common.farmer")}</p>{contact.phone && <p>{contact.phone}</p>}{contact.email && <p>{contact.email}</p>}</div>}{item.status === "pending" && <button className="delete-listing-btn" type="button" disabled={workingId === item.id} onClick={() => void cancelRequest(item.id)}>{t("organization.cancelRequest")}</button>}</article>; })}</div>}</section>
        <section className="marketplace-section" id="organization-profile"><h2>{t("organization.profileTitle")}</h2><form className="profile-edit-form" onSubmit={(event) => void updateProfile(event)}>{[["organization_name", "organization.profileFields.name"], ["contact_person", "organization.profileFields.contact"], ["phone", "organization.profileFields.phone"], ["organization_type", "organization.profileFields.type"], ["address", "organization.profileFields.address"], ["village", "organization.profileFields.village"], ["district", "organization.profileFields.district"], ["state", "organization.profileFields.state"]].map(([field, label]) => <label key={field}>{t(label)}<input required type={field === "phone" ? "tel" : "text"} maxLength={field === "phone" ? 24 : 160} value={profileForm[field]} onChange={(event) => setProfileForm((old) => ({ ...old, [field]: event.target.value }))} /></label>)}<button className="primary-btn" type="submit" disabled={savingProfile}>{savingProfile ? t("common.saving") : t("organization.saveProfile")}</button></form></section>
    </DashboardFrame>;
}

export function ServicesDashboard() {
    const { t } = useTranslation();
    const { session, profile } = useAuth();
    const [offerings, setOfferings] = useState([]);
    const [paraliRequests, setParaliRequests] = useState([]);
    const [jobs, setJobs] = useState([]);
    const [farmerContacts, setFarmerContacts] = useState({});
    const [loading, setLoading] = useState(true);
    const [workingId, setWorkingId] = useState("");
    const [editingId, setEditingId] = useState("");
    const [selectedOffering, setSelectedOffering] = useState("");
    const [error, setError] = useState("");
    const [notice, setNotice] = useState("");
    const [offeringForm, setOfferingForm] = useState({
        name: "", description: "", service_area: "", price: "", pricing_unit: "quote", contact_phone: profile.phone || "",
    });

    useEffect(() => {
        let active = true;
        async function loadDashboard() {
            const [offeringResult, requestResult, jobResult] = await Promise.all([
                supabase.from("service_offerings").select("id, provider_id, name, description, service_area, price, pricing_unit, contact_phone, is_active, created_at, updated_at").eq("provider_id", session.user.id).order("created_at", { ascending: false }),
                supabase.from("parali_requests").select("id, farmer_id, crop, quantity, unit, village, district, state, pickup_location, expected_price, status, created_at, updated_at").order("created_at", { ascending: false }),
                supabase.from("service_requests").select("id, parali_request_id, offering_id, farmer_id, provider_id, status, message, created_at, updated_at").eq("provider_id", session.user.id).order("created_at", { ascending: false }),
            ]);
            if (!active) return;
            const failed = offeringResult.error || requestResult.error || jobResult.error;
            if (failed) {
                setError(errorKey(failed));
                setLoading(false);
                return;
            }

            const nextOfferings = offeringResult.data || [];
            const nextJobs = jobResult.data || [];
            setOfferings(nextOfferings);
            setParaliRequests(requestResult.data || []);
            setJobs(nextJobs);
            setSelectedOffering((current) => current || nextOfferings.find((item) => item.is_active)?.id || "");

            const farmerIds = [...new Set(nextJobs
                .filter((item) => ["accepted", "in_progress", "completed"].includes(item.status))
                .map((item) => item.farmer_id))];
            if (farmerIds.length) {
                const { data: contacts, error: contactError } = await supabase.from("profiles")
                    .select("id, full_name, phone, email")
                    .in("id", farmerIds);
                if (contactError) setError(errorKey(contactError));
                else setFarmerContacts(Object.fromEntries((contacts || []).map((item) => [item.id, item])));
            } else {
                setFarmerContacts({});
            }
            setLoading(false);
        }
        void loadDashboard();
        return () => { active = false; };
    }, [session.user.id]);

    const activeOfferings = offerings.filter((item) => item.is_active);
    const availableRequests = paraliRequests.filter((item) => item.status === "open" && !jobs.some((job) => job.parali_request_id === item.id && ["accepted", "in_progress", "completed"].includes(job.status)));
    const assignedJobs = jobs.filter((item) => ["accepted", "in_progress"].includes(item.status));
    const completedJobs = jobs.filter((item) => item.status === "completed");
    const jobByRequest = new Map(jobs.map((item) => [item.parali_request_id, item]));

    function resetOfferingForm() {
        setEditingId("");
        setOfferingForm({ name: "", description: "", service_area: "", price: "", pricing_unit: "quote", contact_phone: profile.phone || "" });
    }

    function editOffering(offering) {
        setEditingId(offering.id);
        setOfferingForm({
            name: offering.name,
            description: offering.description || "",
            service_area: offering.service_area,
            price: offering.price == null ? "" : String(offering.price),
            pricing_unit: offering.pricing_unit,
            contact_phone: offering.contact_phone || "",
        });
    }

    async function saveOffering(event) {
        event.preventDefault();
        setWorkingId(editingId || "new-offering");
        setError("");
        setNotice("");
        const price = offeringForm.price === "" ? null : Number(offeringForm.price);
        if (price !== null && (!Number.isFinite(price) || price < 0)) {
            setError("servicesErrors.invalidPrice");
            setWorkingId("");
            return;
        }
        const values = {
            name: offeringForm.name.trim(),
            description: offeringForm.description.trim(),
            service_area: offeringForm.service_area.trim(),
            price,
            pricing_unit: offeringForm.pricing_unit,
            contact_phone: offeringForm.contact_phone.trim() || null,
        };
        const result = editingId
            ? await supabase.from("service_offerings").update(values).eq("id", editingId).eq("provider_id", session.user.id).select("id, provider_id, name, description, service_area, price, pricing_unit, contact_phone, is_active, created_at, updated_at").single()
            : await supabase.from("service_offerings").insert({ ...values, provider_id: session.user.id }).select("id, provider_id, name, description, service_area, price, pricing_unit, contact_phone, is_active, created_at, updated_at").single();
        if (result.error || !result.data) {
            console.error("Service offer save error:", result.error);
            setError(errorKey(result.error));
        }
        else {
            setOfferings((previous) => editingId
                ? previous.map((item) => item.id === editingId ? result.data : item)
                : [result.data, ...previous]);
            setNotice(editingId ? "services.offeringUpdated" : "services.offeringCreated");
            resetOfferingForm();
        }
        setWorkingId("");
    }

    async function toggleOffering(offering) {
        setWorkingId(offering.id);
        setError("");
        const { data, error: updateError } = await supabase.from("service_offerings")
            .update({ is_active: !offering.is_active }).eq("id", offering.id).eq("provider_id", session.user.id)
            .select("id, provider_id, name, description, service_area, price, pricing_unit, contact_phone, is_active, created_at, updated_at").single();
        if (updateError || !data) setError(errorKey(updateError));
        else setOfferings((previous) => previous.map((item) => item.id === offering.id ? data : item));
        setWorkingId("");
    }

    async function deleteOffering(offering) {
        if (!window.confirm(t("services.confirmDeleteOffering", { name: offering.name }))) return;
        setWorkingId(offering.id);
        setError("");
        const { data, error: deleteError } = await supabase.from("service_offerings").delete()
            .eq("id", offering.id).eq("provider_id", session.user.id).select("id").single();
        if (deleteError || !data) setError(errorKey(deleteError, "servicesErrors.deleteOfferingFailed"));
        else {
            setOfferings((previous) => previous.filter((item) => item.id !== offering.id));
            setNotice("services.offeringDeleted");
        }
        setWorkingId("");
    }

    async function respondToRequest(request, nextStatus) {
        if (nextStatus === "accepted" && !selectedOffering) {
            setError("servicesErrors.chooseOffering");
            return;
        }
        setWorkingId(request.id);
        setError("");
        setNotice("");
        const existing = jobByRequest.get(request.id);
        const result = existing
            ? await supabase.from("service_requests").update({ status: nextStatus }).eq("id", existing.id).eq("provider_id", session.user.id)
                .select("id, parali_request_id, offering_id, farmer_id, provider_id, status, message, created_at, updated_at").single()
            : await supabase.from("service_requests").insert({
                parali_request_id: request.id,
                offering_id: selectedOffering,
                farmer_id: request.farmer_id,
                provider_id: session.user.id,
                status: nextStatus,
            }).select("id, parali_request_id, offering_id, farmer_id, provider_id, status, message, created_at, updated_at").single();
        if (result.error || !result.data) setError(errorKey(result.error, "servicesErrors.respondFailed"));
        else {
            setJobs((previous) => existing
                ? previous.map((item) => item.id === existing.id ? result.data : item)
                : [result.data, ...previous]);
            setNotice(nextStatus === "declined" ? "services.requestDeclined" : "services.requestAccepted");
            if (nextStatus === "accepted") {
                const contactResult = await supabase.from("profiles").select("id, full_name, phone, email").eq("id", request.farmer_id).maybeSingle();
                if (!contactResult.error && contactResult.data) setFarmerContacts((previous) => ({ ...previous, [request.farmer_id]: contactResult.data }));
            }
        }
        setWorkingId("");
    }

    async function updateJob(job, status) {
        setWorkingId(job.id);
        setError("");
        const { data, error: updateError } = await supabase.from("service_requests").update({ status })
            .eq("id", job.id).eq("provider_id", session.user.id)
            .select("id, parali_request_id, offering_id, farmer_id, provider_id, status, message, created_at, updated_at").single();
        if (updateError || !data) setError(errorKey(updateError));
        else setJobs((previous) => previous.map((item) => item.id === job.id ? data : item));
        setWorkingId("");
    }

    return <DashboardFrame role="services" title={t("services.greeting", { name: profile.provider_name || t("common.services") })} intro={t("services.intro", { service: profile.service_type || t("services.notSet") })}>
        <nav className="dashboard-section-nav" aria-label={t("common.dashboardSections")}><a href="#services-overview">{t("common.overview")}</a><a href="#service-offerings">{t("services.offeringsTitle")}</a><a href="#service-requests">{t("services.requestsTitle")}</a><a href="#service-jobs">{t("services.jobsTitle")}</a></nav>
        {notice && <p className="marketplace-success" role="status">{t(notice)}</p>}{error && <p className="listing-error" role="alert">{t(error)}</p>}
        <section className="dashboard-metrics" id="services-overview">{[["services.metrics.activeOfferings", activeOfferings.length], ["services.metrics.availableRequests", availableRequests.length], ["services.metrics.assigned", assignedJobs.length], ["services.metrics.completed", completedJobs.length]].map(([key, value]) => <article key={key}><span>{t(key)}</span><strong>{loading ? "—" : value}</strong></article>)}</section>

        <section className="marketplace-section" id="service-offerings"><div className="marketplace-heading"><h2>{t("services.offeringsTitle")}</h2><span className="listing-status">{t("services.activeOfferingCount", { count: activeOfferings.length })}</span></div>
            <form className="profile-edit-form" onSubmit={(event) => void saveOffering(event)}>
                <label>{t("services.fields.name")}<input required maxLength="120" value={offeringForm.name} onChange={(event) => setOfferingForm({ ...offeringForm, name: event.target.value })} /></label>
                <label>{t("services.fields.serviceArea")}<input required maxLength="160" value={offeringForm.service_area} onChange={(event) => setOfferingForm({ ...offeringForm, service_area: event.target.value })} /></label>
                <label>{t("services.fields.description")}<textarea maxLength="1000" rows="3" value={offeringForm.description} onChange={(event) => setOfferingForm({ ...offeringForm, description: event.target.value })} /></label>
                <label>{t("services.fields.price")}<input type="number" min="0" step="0.01" value={offeringForm.price} onChange={(event) => setOfferingForm({ ...offeringForm, price: event.target.value })} /></label>
                <label>{t("services.fields.pricingUnit")}<select value={offeringForm.pricing_unit} onChange={(event) => setOfferingForm({ ...offeringForm, pricing_unit: event.target.value })}>{["per trip", "per hour", "per acre", "per tonne", "quote"].map((unit) => <option value={unit} key={unit}>{t(`services.pricingUnits.${unit.replaceAll(" ", "_")}`)}</option>)}</select></label>
                <label>{t("services.fields.contactPhone")}<input type="tel" maxLength="24" value={offeringForm.contact_phone} onChange={(event) => setOfferingForm({ ...offeringForm, contact_phone: event.target.value })} /></label>
                <div className="request-actions"><button className="primary-btn" type="submit" disabled={workingId !== ""}>{workingId ? t("common.saving") : editingId ? t("services.updateOffering") : t("services.createOffering")}</button>{editingId && <button className="auth-secondary" type="button" onClick={resetOfferingForm}>{t("common.cancel")}</button>}</div>
            </form>
            {loading ? <p>{t("common.loading")}</p> : offerings.length === 0 ? <p className="empty-listings">{t("services.noOfferings")}</p> : <div className="saved-listing-grid">{offerings.map((item) => <article className="saved-listing-card" key={item.id}>
                <div className="saved-listing-heading"><h3>{item.name}</h3><span className="listing-status">{t(item.is_active ? "services.active" : "services.inactive")}</span></div>
                <p>{item.description}</p><p><strong>{t("services.fields.serviceArea")}:</strong> {item.service_area}</p>
                {item.price != null && <p><strong>{t("services.fields.price")}:</strong> ₹{item.price} / {t(`services.pricingUnits.${item.pricing_unit.replaceAll(" ", "_")}`)}</p>}
                {item.contact_phone && <p><strong>{t("services.fields.contactPhone")}:</strong> {item.contact_phone}</p>}
                <div className="request-actions"><button className="text-btn" type="button" onClick={() => editOffering(item)}>{t("common.edit")}</button><button className="auth-secondary" type="button" disabled={workingId === item.id} onClick={() => void toggleOffering(item)}>{t(item.is_active ? "services.deactivate" : "services.activate")}</button><button className="delete-listing-btn" type="button" disabled={workingId === item.id} onClick={() => void deleteOffering(item)}>{t("common.delete")}</button></div>
            </article>)}</div>}
        </section>

        <section className="marketplace-section" id="service-requests"><div className="marketplace-heading"><h2>{t("services.requestsTitle")}</h2></div><label className="offering-choice">{t("services.chooseOffering")}<select value={selectedOffering} onChange={(event) => setSelectedOffering(event.target.value)}><option value="">{t("services.chooseOfferingPlaceholder")}</option>{activeOfferings.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.service_area}</option>)}</select></label>
            {loading ? <p>{t("common.loading")}</p> : availableRequests.length === 0 ? <p className="empty-listings">{t("services.noAvailableRequests")}</p> : <div className="saved-listing-grid">{availableRequests.map((request) => { const job = jobByRequest.get(request.id); return <article className="saved-listing-card" key={request.id}><RequestDetails request={request} />{job ? <p><strong>{t("services.yourResponse")}:</strong> {t(`common.${job.status === "in_progress" ? "inProgress" : job.status}`)}</p> : null}<div className="request-actions">{!job || job.status === "declined" ? <><button className="primary-btn" type="button" disabled={workingId === request.id || !activeOfferings.length} onClick={() => void respondToRequest(request, "accepted")}>{workingId === request.id ? t("services.responding") : t("services.acceptRequest")}</button><button className="delete-listing-btn" type="button" disabled={workingId === request.id} onClick={() => void respondToRequest(request, "declined")}>{t("services.declineRequest")}</button></> : <span className="listing-status">{t(`common.${job.status}`)}</span>}</div></article>; })}</div>}
        </section>

        <section className="marketplace-section" id="service-jobs"><div className="marketplace-heading"><h2>{t("services.jobsTitle")}</h2></div>
            {loading ? <p>{t("common.loading")}</p> : jobs.length === 0 ? <p className="empty-listings">{t("services.noJobs")}</p> : <div className="saved-listing-grid">{jobs.map((job) => { const request = paraliRequests.find((item) => item.id === job.parali_request_id); const contact = farmerContacts[job.farmer_id]; return <article className="saved-listing-card" key={job.id}>{request ? <RequestDetails request={request} /> : <p>{t("services.requestDetailsUnavailable")}</p>}<p><strong>{t("services.jobStatus")}:</strong> {t(`common.${job.status === "in_progress" ? "inProgress" : job.status}`)}</p>{contact && <div className="permitted-contact"><strong>{t("services.farmerContact")}</strong><p>{contact.full_name || t("common.farmer")}</p>{contact.phone && <p>{contact.phone}</p>}{contact.email && <p>{contact.email}</p>}</div>}{job.status === "accepted" && <button className="primary-btn" type="button" disabled={workingId === job.id} onClick={() => void updateJob(job, "in_progress")}>{t("services.startJob")}</button>}{job.status === "in_progress" && <button className="primary-btn" type="button" disabled={workingId === job.id} onClick={() => void updateJob(job, "completed")}>{t("services.completeJob")}</button>}</article>; })}</div>}
        </section>
    </DashboardFrame>;
}
