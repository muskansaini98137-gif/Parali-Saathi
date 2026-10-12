
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { HashRouter, Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { AuthProvider } from "./auth/AuthContext.jsx";
import { useAuth } from "./auth/authContext.js";
import { AuthLoading, LoginPage, ProfileIssue, SignupPage } from "./pages/AuthPages.jsx";
import BuyerMatching from "./pages/BuyerMatching.jsx";
import PickupPage from "./pages/PickupPage.jsx";

import {
  FarmerMarketplaceSections,
  OrganizationDashboard,
  ServicesDashboard,
} from "./pages/RoleDashboards.jsx";
import LanguageSwitcher from "./components/LanguageSwitcher.jsx";
import "./App.css";

const suggestions = [
  { id: "listing", labelKey: "assistant.suggestions.listing" },
  { id: "buyer", labelKey: "assistant.suggestions.buyer" },
  { id: "pickup", labelKey: "assistant.suggestions.pickup" },
  { id: "status", labelKey: "assistant.suggestions.status" },
];

const LISTINGS_KEY = "paraliListings";

function readSavedListings() {
  try {
    const saved = localStorage.getItem(LISTINGS_KEY);
    if (!saved) return { listings: [], error: "" };

    const parsed = JSON.parse(saved);
    if (
      !Array.isArray(parsed) ||
      parsed.some(
        (item) =>
          !item ||
          typeof item !== "object" ||
          typeof item.id !== "string" ||
          typeof item.quantity !== "string" ||
          typeof item.unit !== "string" ||
          typeof item.location !== "string" ||
          typeof item.crop !== "string" ||
          typeof item.pickup !== "string" ||
          (item.price !== undefined && typeof item.price !== "string") ||
          (item.phone !== undefined && typeof item.phone !== "string") ||
          (item.createdAt !== undefined && typeof item.createdAt !== "string")
      )
    ) {
      return {
        listings: [],
        error: "listings.errors.invalidStorage",
      };
    }

    return { listings: parsed, error: "" };
  } catch {
    return {
      listings: [],
      error: "listings.errors.storageRead",
    };
  }
}

function Dashboard() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { signOut } = useAuth();
  const [logoutError, setLogoutError] = useState("");
  const [loggingOut, setLoggingOut] = useState(false);

  async function handleLogout() {
    setLogoutError("");
    setLoggingOut(true);
    try {
      await signOut();
      navigate("/login", { replace: true });
    } catch {
      setLogoutError("errors.logout");
      setLoggingOut(false);
    }
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <a className="brand" href="#/">🌾 Parali Saathi</a>
        <div className="role-actions">
          <LanguageSwitcher />
          <span className="role-pill">{t("navigation.farmerMode")}</span>
          <button className="auth-secondary" type="button" onClick={handleLogout} disabled={loggingOut}>
            {loggingOut ? t("common.loggingOut") : t("common.logout")}
          </button>
        </div>
      </header>

      {logoutError && <p className="listing-error" role="alert">{t(logoutError)}</p>}

      <section className="welcome">
        <p className="eyebrow">{t("farmer.welcomeEyebrow")}</p>
        <h1>{t("farmer.welcomeTitle")}</h1>
        <p>{t("farmer.welcomeDescription")}</p>
        <button
          className="primary-btn"
          onClick={() => navigate("/assistant")}
        >
          <span aria-hidden="true">✦</span> {t("farmer.talkToAssistant")}
        </button>
      </section>

      <section className="dashboard-section">
        <h2>{t("farmer.dashboardTitle")}</h2>

        <div className="dashboard-grid">
          <article className="dashboard-card">
            <span className="card-emoji">🌾</span>
            <h3>{t("farmer.listingTitle")}</h3>
            <p>{t("farmer.listingDescription")}</p>
            <button
              className="text-btn"
              onClick={() => navigate("/listing")}
            >
              {t("farmer.startListing")}
            </button>
          </article>

          <article className="dashboard-card">
            <span className="card-emoji">🤝</span>
            <h3>{t("farmer.buyerTitle")}</h3>
            <p>{t("farmer.buyerDescription")}</p>
            <button
              className="text-btn"
              onClick={() => navigate("/buyer-matching")}
            >
              {t("farmer.findBuyers")}
            </button>
          </article>

          <article className="dashboard-card">
            <span className="card-emoji">🚜</span>
            <h3>{t("farmer.pickupTitle")}</h3>
            <p>{t("farmer.pickupDescription")}</p>
            <button
              className="text-btn"
              onClick={() => navigate("/pickup")}
            >
              {t("farmer.askAssistant")}
            </button>
          </article>
        </div>
      </section>

      <FarmerMarketplaceSections />

      <footer className="app-footer">
        Parali Saathi · Team Zero Burn
        <p>{t("farmer.footerNote")}</p>
      </footer>

      <button
        className="floating-assistant"
        onClick={() => navigate("/assistant")}
        aria-label={t("farmer.talkToAssistant")}
      >
        <span aria-hidden="true">✦</span>
        <span>{t("assistant.name")}</span>
      </button>
    </main>
  );
}

function translateUnit(value, t) {
  const unitKeys = { Quintal: "common.quintal", Tonne: "common.tonne" };
  return unitKeys[value] ? t(unitKeys[value]) : value;
}

function translateCrop(value, t) {
  const cropKeys = {
    "Dhaan (Paddy)": "common.paddy",
    "Dhaan (paddy)": "common.paddy",
    "Gehun (Wheat)": "common.wheat",
    "Gehun (wheat)": "common.wheat",
    "Doosri Fasal": "common.otherCrop",
    "Doosri fasal": "common.otherCrop",
  };
  return cropKeys[value] ? t(cropKeys[value]) : value;
}

function translatePickup(value, t) {
  const pickupKeys = {
    "Khet mein": "common.field",
    "Storage mein": "common.storage",
    "Road ke paas": "common.roadside",
  };
  return pickupKeys[value] ? t(pickupKeys[value]) : value;
}

/* NEW: Parali Listing Form */

function ListingForm() {
  const navigate = useNavigate();
  const { t } = useTranslation();

  const [form, setForm] = useState({
    quantity: "",
    unit: "Quintal",
    location: "",
    crop: "Dhaan (Paddy)",
    pickup: "Khet mein",
    price: "",
    phone: "",
  });

  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [listings, setListings] = useState(() => readSavedListings().listings);
  const [storageNotice, setStorageNotice] = useState(
    () => readSavedListings().error
  );
  const [saving, setSaving] = useState(false);

  function handleChange(event) {
    const { name, value } = event.target;
    setForm((previous) => ({
      ...previous,
      [name]: value,
    }));
  }

  function handleSubmit(event) {
    event.preventDefault();
    setError("");

    if (saving) return;

    const quantity = Number(form.quantity);
    const price = form.price === "" ? null : Number(form.price);
    if (!Number.isFinite(quantity) || quantity <= 0) {
      setError("listings.validation.quantityPositive");
      return;
    }
    if (price !== null && (!Number.isFinite(price) || price < 0)) {
      setError("listings.validation.priceNonNegative");
      return;
    }

    const newListing = {
      ...form,
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      createdAt: new Date().toLocaleDateString("en-IN"),
    };

    try {
      setSaving(true);
      const stored = readSavedListings();
      if (stored.error) {
        setStorageNotice(stored.error);
        setError("listings.errors.saveAfterRead");
        return;
      }

      const updated = [newListing, ...stored.listings];

      localStorage.setItem(LISTINGS_KEY, JSON.stringify(updated));

      setListings(updated);
      setStorageNotice("");
      setSaved(true);
    } catch {
      setError(
        "listings.errors.saveFailed"
      );
    } finally {
      setSaving(false);
    }
  }

  function deleteListing(id) {
    const confirmed = window.confirm(
      t("listings.deleteConfirm")
    );

    if (!confirmed) return;

    try {
      const stored = readSavedListings();
      if (stored.error) {
        setStorageNotice(stored.error);
        setError("listings.errors.deleteAfterRead");
        return;
      }

      const updated = stored.listings.filter((item) => item.id !== id);

      localStorage.setItem(LISTINGS_KEY, JSON.stringify(updated));
      setListings(updated);
      setStorageNotice("");
    } catch {
      setError("listings.errors.deleteFailed");
    }
  }

  function createAnother() {
    setForm({
      quantity: "",
      unit: "Quintal",
      location: "",
      crop: "Dhaan (Paddy)",
      pickup: "Khet mein",
      price: "",
      phone: "",
    });

    setSaved(false);
    setError("");
  }

  return (
    <main className="listing-page">
      <div className="listing-toolbar">
        <button type="button" className="back-btn" onClick={() => navigate("/")}>
          {t("listings.backDashboard")}
        </button>
        <LanguageSwitcher />
      </div>

      <section className="listing-card">
        <span className="card-emoji">🌾</span>
        <h1>{t("listings.title")}</h1>
        <p>{t("listings.intro")}</p>

        {saved ? (
          <div className="listing-success">
            <h2>✅ {t("listings.savedTitle")}</h2>
            <p>{t("listings.savedDescription")}</p>

            <button
              type="button"
              className="primary-btn"
              onClick={createAnother}
            >
              {t("listings.newListing")}
            </button>

            <button
              type="button"
              className="text-btn"
              onClick={() => setSaved(false)}
            >
              {t("listings.viewSaved")}
            </button>
          </div>
        ) : (
          <form className="listing-form" onSubmit={handleSubmit}>
            <label>
              {t("listings.quantityLabel")}
              <div className="quantity-row">
                <input
                  type="number"
                  name="quantity"
                  min="0.1"
                  step="any"
                  required
                  placeholder={t("listings.quantityPlaceholder")}
                  value={form.quantity}
                  onChange={handleChange}
                />

                <select
                  name="unit"
                  value={form.unit}
                  onChange={handleChange}
                >
                  <option value="Quintal">{t("common.quintal")}</option>
                  <option value="Tonne">{t("common.tonne")}</option>
                </select>
              </div>
            </label>

            <label>
              {t("listings.locationLabel")}
              <input
                type="text"
                name="location"
                required
                maxLength={100}
                placeholder={t("listings.locationPlaceholder")}
                value={form.location}
                onChange={handleChange}
              />
            </label>

            <label>
              {t("listings.cropLabel")}
              <select
                name="crop"
                value={form.crop}
                onChange={handleChange}
              >
                <option value="Dhaan (Paddy)">{t("common.paddy")}</option>
                <option value="Gehun (Wheat)">{t("common.wheat")}</option>
                <option value="Doosri Fasal">{t("common.otherCrop")}</option>
              </select>
            </label>

            <label>
              {t("listings.pickupLocationLabel")}
              <select
                name="pickup"
                value={form.pickup}
                onChange={handleChange}
              >
                <option value="Khet mein">{t("common.field")}</option>
                <option value="Storage mein">{t("common.storage")}</option>
                <option value="Road ke paas">{t("common.roadside")}</option>
              </select>
            </label>

            <label>
              {t("listings.priceLabel")}
              <input
                type="number"
                name="price"
                min="0"
                step="any"
                placeholder={t("listings.pricePlaceholder")}
                value={form.price}
                onChange={handleChange}
              />
            </label>

            <label>
              {t("listings.phoneLabel")}
              <input
                type="tel"
                name="phone"
                inputMode="tel"
                maxLength={20}
                placeholder={t("listings.phonePlaceholder")}
                value={form.phone}
                onChange={handleChange}
              />
            </label>

            {error && <p className="listing-error">{t(error)}</p>}

            <button className="primary-btn" type="submit" disabled={saving}>
              {saving ? t("listings.saving") : t("listings.saveButton")}
            </button>

            <p className="listing-disclaimer">
              {t("listings.requiredNote")}
            </p>
          </form>
        )}
      </section>

      <section className="saved-listings">
        <h2>📋 {t("listings.savedHeading", { count: listings.length })}</h2>

        {storageNotice && (
          <p className="listing-error" role="alert">{t(storageNotice)}</p>
        )}
        {error && saved && <p className="listing-error" role="alert">{t(error)}</p>}

        {listings.length === 0 ? (
          <p className="empty-listings">
            {storageNotice
              ? t("listings.unreadable")
              : t("listings.empty")}
          </p>
        ) : (
          <div className="saved-listing-grid">
            {listings.map((item) => (
              <article className="saved-listing-card" key={item.id}>
                <div className="saved-listing-heading">
                  <span className="card-emoji">🌾</span>
                  <span className="listing-status">{t("listings.browserSaved")}</span>
                </div>

                <h3>{translateCrop(item.crop, t)}</h3>

                <p>
                  <strong>{t("common.quantity")}:</strong> {item.quantity} {translateUnit(item.unit, t)}
                </p>

                <p>
                  <strong>{t("common.location")}:</strong> {item.location}
                </p>

                <p>
                  <strong>{t("common.pickup")}:</strong> {translatePickup(item.pickup, t)}
                </p>

                {item.price && (
                  <p>
                    <strong>{t("listings.expectedPrice")}</strong> ₹{item.price}
                    {t("listings.priceUnit")}
                  </p>
                )}

                {item.phone && (
                  <p>
                    <strong>{t("listings.privateContact")}</strong> {item.phone}
                  </p>
                )}

                <p>
                  <strong>{t("common.created")}:</strong> {item.createdAt || "—"}
                </p>

                <button
                  type="button"
                  className="delete-listing-btn"
                  onClick={() => deleteListing(item.id)}
                >
                  {t("listings.deleteButton")}
                </button>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

/* Existing Assistant: retained */

function Assistant() {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [listening, setListening] = useState(false);
  const [speechEnabled, setSpeechEnabled] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [voiceNotice, setVoiceNotice] = useState("");
  const recognitionRef = useRef(null);
  const speechEnabledRef = useRef(false);
  const speechUtteranceRef = useRef(null);
  const responseTimerRef = useRef(null);
  const responseLockRef = useRef(false);
  const [listing, setListing] = useState({
    step: null,
    quantity: "",
    location: "",
    crop: "",
    pickup: "",
  });

  const [messages, setMessages] = useState([
    {
      id: 1,
      from: "agent",
      translationKey: "assistant.welcome",
    },
  ]);

  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {
          // Recognition may already have stopped.
        }
      }

      if (responseTimerRef.current) {
        window.clearTimeout(responseTimerRef.current);
      }

      if ("speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  function stopVoiceInput() {
    const recognition = recognitionRef.current;
    if (!recognition) return;

    try {
      recognition.stop();
      setVoiceNotice("assistant.voice.stopped");
    } catch {
      setVoiceNotice("assistant.voice.stopError");
    }
  }

  function startVoiceInput() {
    if (listening) {
      stopVoiceInput();
      return;
    }

    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setVoiceNotice("assistant.voice.unsupportedInput");
      return;
    }

    if (recognitionRef.current || loading) return;

    try {
      const recognition = new SpeechRecognition();
      const recognitionLanguage = i18n.resolvedLanguage === "hi" ? "hi-IN" : "en-IN";
      recognition.lang = recognitionLanguage;
      recognition.continuous = false;
      recognition.interimResults = false;

      recognition.onstart = () => {
        setListening(true);
        setVoiceNotice("assistant.voice.listening");
      };

      recognition.onresult = (event) => {
        const transcript = Array.from(event.results)
          .map((result) => result[0]?.transcript || "")
          .join(" ")
          .trim();

        if (transcript) {
          setMessage(transcript);
          setVoiceNotice("assistant.voice.transcribed");
        } else {
          setVoiceNotice("assistant.voice.emptyTranscript");
        }
      };

      recognition.onerror = (event) => {
        const messagesByError = {
          "not-allowed": "assistant.voice.permissionDenied",
          "service-not-allowed": "assistant.voice.serviceDenied",
          "no-speech": "assistant.voice.noSpeech",
          "audio-capture": "assistant.voice.noMicrophone",
          network: "assistant.voice.network",
        };

        setListening(false);
        setVoiceNotice(
          messagesByError[event.error] ||
          "assistant.voice.inputError"
        );
      };

      recognition.onend = () => {
        setListening(false);
        if (recognitionRef.current === recognition) {
          recognitionRef.current = null;
        }
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch {
      recognitionRef.current = null;
      setListening(false);
      setVoiceNotice("assistant.voice.startError");
    }
  }

  function stopSpeech() {
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    speechUtteranceRef.current = null;
    setSpeaking(false);
  }

  function speakReply(reply) {
    if (!speechEnabledRef.current) return;

    if (
      !("speechSynthesis" in window) ||
      typeof window.SpeechSynthesisUtterance !== "function"
    ) {
      setVoiceNotice("assistant.voice.unsupportedOutput");
      return;
    }

    const synthesis = window.speechSynthesis;
    synthesis.cancel();

    const utterance = new window.SpeechSynthesisUtterance(reply);
    const desiredLanguage = i18n.resolvedLanguage === "hi" ? "hi-IN" : "en-IN";
    const voiceLanguagePrefix = desiredLanguage.slice(0, 2);
    const preferredVoice = synthesis
      .getVoices()
      .find((voice) => voice.lang.toLowerCase().startsWith(voiceLanguagePrefix));

    utterance.lang = desiredLanguage;
    if (preferredVoice) utterance.voice = preferredVoice;
    speechUtteranceRef.current = utterance;
    utterance.onend = () => {
      if (speechUtteranceRef.current === utterance) {
        speechUtteranceRef.current = null;
        setSpeaking(false);
      }
    };
    utterance.onerror = () => {
      if (speechUtteranceRef.current === utterance) {
        speechUtteranceRef.current = null;
        setSpeaking(false);
        setVoiceNotice("assistant.voice.speechError");
      }
    };

    try {
      synthesis.speak(utterance);
      setSpeaking(true);
    } catch {
      speechUtteranceRef.current = null;
      setSpeaking(false);
      setVoiceNotice("assistant.voice.speechError");
    }
  }

  function toggleSpeechReplies() {
    if (
      !("speechSynthesis" in window) ||
      typeof window.SpeechSynthesisUtterance !== "function"
    ) {
      setVoiceNotice("assistant.voice.unsupportedOutput");
      return;
    }

    if (speechEnabledRef.current) {
      stopSpeech();
      speechEnabledRef.current = false;
      setSpeechEnabled(false);
      return;
    }
    speechEnabledRef.current = true;
    setSpeechEnabled(true);
  }

  function getReply(text) {
    const lower = text.toLowerCase();
    const matchesIntent = (intent) =>
      t(`assistant.intent.${intent}`)
        .split("|")
        .some((keyword) => keyword && lower.includes(keyword.toLowerCase()));

    if (listing.step === "quantity") {
      setListing({ ...listing, quantity: text, step: "location" });
      return { key: "assistant.replies.listingLocation" };
    }

    if (listing.step === "location") {
      setListing({ ...listing, location: text, step: "crop" });
      return { key: "assistant.replies.listingCrop" };
    }

    if (listing.step === "crop") {
      setListing({ ...listing, crop: text, step: "pickup" });
      return { key: "assistant.replies.listingPickup" };
    }

    if (listing.step === "pickup") {
      const completed = {
        ...listing,
        pickup: text,
        step: "done",
      };

      setListing(completed);

      return { key: "assistant.replies.listingComplete", values: completed };
    }

    if (matchesIntent("list")) {
      setListing({
        step: "quantity",
        quantity: "",
        location: "",
        crop: "",
        pickup: "",
      });

      return { key: "assistant.replies.listingQuantity" };
    }

    if (matchesIntent("buyer")) {
      return { key: "assistant.replies.buyer" };
    }

    if (matchesIntent("pickup")) {
      return { key: "assistant.replies.pickup" };
    }

    if (matchesIntent("status")) {
      return { key: "assistant.replies.status" };
    }

    if (matchesIntent("rate")) {
      return { key: "assistant.replies.rate" };
    }

    if (matchesIntent("greeting")) {
      return { key: "assistant.replies.greeting" };
    }

    if (matchesIntent("crop")) {
      return { key: "assistant.replies.crop" };
    }

    if (matchesIntent("burn")) {
      return { key: "assistant.replies.burn" };
    }

    if (matchesIntent("help")) {
      return { key: "assistant.replies.help" };
    }

    return { key: "assistant.replies.fallback" };
  }

  function sendMessage(text) {
    const cleanText = text.trim();

    if (!cleanText || loading || responseLockRef.current) return;
    responseLockRef.current = true;
    stopVoiceInput();

    setMessages((previous) => [
      ...previous,
      {
        id: Date.now(),
        from: "farmer",
        text: cleanText,
      },
    ]);

    setMessage("");
    setLoading(true);

    responseTimerRef.current = window.setTimeout(() => {
      const reply = getReply(cleanText);

      setMessages((previous) => [
        ...previous,
        {
          id: Date.now() + 1,
          from: "agent",
          translationKey: reply.key,
          translationValues: reply.values,
        },
      ]);

      responseLockRef.current = false;
      responseTimerRef.current = null;
      setLoading(false);
      speakReply(t(reply.key, reply.values));
    }, 300);
  }

  return (
    <main className="chat-page">
      <header className="chat-header">
        <button
          className="back-btn"
          onClick={() => navigate("/")}
          aria-label={t("assistant.back")}
        >
          {t("common.back")}
        </button>

        <div className="agent-avatar">✦</div>

        <div className="agent-heading">
          <h1>{t("assistant.name")}</h1>
          <p>
            <span className="status-dot" />
            {t("assistant.offline")}
          </p>
        </div>

        <div className="chat-controls">
          <LanguageSwitcher />
          <button
            type="button"
            className={`voice-control ${speechEnabled ? "active" : ""}`}
            onClick={toggleSpeechReplies}
            aria-label={t(speechEnabled ? "assistant.voice.disableReplies" : "assistant.voice.enableReplies")}
            aria-pressed={speechEnabled}
            title={t(speechEnabled ? "assistant.voice.disableReplies" : "assistant.voice.enableReplies")}
          >
            <span aria-hidden="true">{speechEnabled ? "🔊" : "🔈"}</span>
          </button>
          {speaking && (
            <button
              type="button"
              className="voice-control"
              onClick={stopSpeech}
              aria-label={t("assistant.voice.stopSpeech")}
              title={t("assistant.voice.stopSpeech")}
            >
              <span aria-hidden="true">■</span>
            </button>
          )}
        </div>
      </header>

      <section className="chat-body" aria-live="polite">
        <div className="date-label">{t("assistant.dateLabel")}</div>

        {messages.map((item) => (
          <div
            key={item.id}
            className={`message-row ${item.from === "farmer" ? "farmer-row" : ""
              }`}
          >
            <div className={`message-bubble ${item.from}`}>
              {item.translationKey
                ? t(item.translationKey, item.translationValues)
                : item.text}
            </div>
          </div>
        ))}

        {loading && (
          <div className="message-row">
            <div className="message-bubble agent">
              {t("assistant.loading")}
            </div>
          </div>
        )}

        {messages.length === 1 && (
          <div className="suggestion-area">
            <p>{t("assistant.suggestionPrompt")}</p>

            <div className="suggestion-list">
              {suggestions.map((option) => (
                <button
                  key={option.id}
                  className="suggestion-chip"
                  onClick={() => sendMessage(t(option.labelKey))}
                  disabled={loading}
                >
                  {t(option.labelKey)} <span aria-hidden="true">→</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </section>

      {(voiceNotice || listening) && (
        <p className="voice-status" role="status" aria-live="polite">
          {listening ? `● ${t("assistant.voice.listening")}` : t(voiceNotice)}
        </p>
      )}

      <form
        className="chat-composer"
        onSubmit={(event) => {
          event.preventDefault();
          sendMessage(message);
        }}
      >
        <input
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          placeholder={t("assistant.inputPlaceholder")}
          aria-label={t("assistant.inputLabel")}
          disabled={loading}
        />

        <button
          type="button"
          className={`microphone-btn ${listening ? "listening" : ""}`}
          onClick={startVoiceInput}
          disabled={loading}
          aria-label={t(listening ? "assistant.voice.stopInput" : "assistant.voice.startInput", {
            language: i18n.resolvedLanguage === "hi" ? "हिंदी" : "English",
          })}
          aria-pressed={listening}
          title={t(listening ? "assistant.voice.stopInput" : "assistant.voice.startInput", {
            language: i18n.resolvedLanguage === "hi" ? "हिंदी" : "English",
          })}
        >
          <span aria-hidden="true">{listening ? "■" : "🎙"}</span>
        </button>

        <button
          type="submit"
          disabled={!message.trim() || loading}
          aria-label={t("assistant.send")}
        >
          ➤
        </button>
      </form>

      <p className="demo-note">
        {t("assistant.demoNote")}
      </p>
    </main>
  );
}

function NotFound() {
  const { t } = useTranslation();

  return (
    <main className="app-shell">
      <header className="topbar">
        <a className="brand" href="#/">🌾 Parali Saathi</a>
        <LanguageSwitcher />
      </header>
      <h1>{t("notFound.title")}</h1>
      <a href="#/">{t("notFound.back")}</a>
    </main>
  );
}

const roleDashboardPaths = {
  farmer: "/farmer-dashboard",
  organization: "/organization-dashboard",
  services: "/services-dashboard",
};

function ProtectedRoute({ children, allowedRoles }) {
  const location = useLocation();
  const { session, profile, loading, profileError, isConfigured, refreshProfile, signOut } = useAuth();

  if (!isConfigured) return <Navigate to="/login" replace />;
  if (loading) return <AuthLoading />;
  if (!session) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  if (profileError || !profile) {
    return <ProfileIssue message={profileError || "auth.errors.profileMissing"} onRetry={refreshProfile} onSignOut={signOut} />;
  }
  if (allowedRoles && !allowedRoles.includes(profile.role)) {
    return <Navigate to="/dashboard" replace />;
  }
  return children;
}

function GuestRoute({ children }) {
  const { session, profile, loading, profileError, refreshProfile, signOut } = useAuth();

  if (loading) return <AuthLoading />;
  if (session && profile) return <Navigate to="/dashboard" replace />;
  if (session && profileError) {
    return <ProfileIssue message={profileError} onRetry={refreshProfile} onSignOut={signOut} />;
  }
  return children;
}

function DashboardRedirect() {
  const { profile } = useAuth();
  return <Navigate to={roleDashboardPaths[profile.role] || "/login"} replace />;
}

export default function App() {
  return (
    <AuthProvider>
      <HashRouter>
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/login" element={<GuestRoute><LoginPage /></GuestRoute>} />
          <Route path="/signup" element={<GuestRoute><SignupPage /></GuestRoute>} />
          <Route path="/dashboard" element={<ProtectedRoute><DashboardRedirect /></ProtectedRoute>} />
          <Route path="/farmer-dashboard" element={<ProtectedRoute allowedRoles={["farmer"]}><Dashboard /></ProtectedRoute>} />
          <Route path="/organization-dashboard" element={<ProtectedRoute allowedRoles={["organization"]}><OrganizationDashboard /></ProtectedRoute>} />
          <Route path="/services-dashboard" element={<ProtectedRoute allowedRoles={["services"]}><ServicesDashboard /></ProtectedRoute>} />
          <Route path="/listing" element={<ProtectedRoute allowedRoles={["farmer"]}><ListingForm /></ProtectedRoute>} />
          <Route path="/assistant" element={<ProtectedRoute allowedRoles={["farmer"]}><Assistant /></ProtectedRoute>} />
          <Route path="/buyer-matching" element={<BuyerMatching />} />
          <Route path="/pickup" element={<PickupPage />} />
          <Route path="*" element={<NotFound />} />
          <Route
  path="/buyer-matching"
  element={
    <ProtectedRoute allowedRoles={["organization"]}>
      <BuyerMatching />
    </ProtectedRoute>
  }
/>

<Route
  path="/pickup"
  element={
    <ProtectedRoute allowedRoles={["farmer"]}>
      <PickupPage />
    </ProtectedRoute>
  }
/>
        </Routes>
      </HashRouter>
    </AuthProvider>
  );
}