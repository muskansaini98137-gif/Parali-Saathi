import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../auth/authContext.js";
import LanguageSwitcher from "../components/LanguageSwitcher.jsx";

const roles = [
  { value: "farmer", labelKey: "auth.roles.farmer.label", icon: "🌾", descriptionKey: "auth.roles.farmer.description" },
  { value: "organization", labelKey: "auth.roles.organization.label", icon: "🏭", descriptionKey: "auth.roles.organization.description" },
  { value: "services", labelKey: "auth.roles.services.label", icon: "🚜", descriptionKey: "auth.roles.services.description" },
];

const profileFields = {
  farmer: [
    { name: "full_name", labelKey: "auth.fields.fullName.label", placeholderKey: "auth.fields.fullName.placeholder" },
    { name: "phone", labelKey: "auth.fields.phone.label", type: "tel", placeholderKey: "auth.fields.phone.placeholder" },
    { name: "village", labelKey: "auth.fields.village.label", placeholderKey: "auth.fields.village.placeholder" },
    { name: "district", labelKey: "auth.fields.district.label", placeholderKey: "auth.fields.district.placeholder" },
    { name: "state", labelKey: "auth.fields.state.label", placeholderKey: "auth.fields.state.placeholder" },
  ],
  organization: [
    { name: "organization_name", labelKey: "auth.fields.organizationName.label", placeholderKey: "auth.fields.organizationName.placeholder" },
    { name: "contact_person", labelKey: "auth.fields.contactPerson.label", placeholderKey: "auth.fields.contactPerson.placeholder" },
    { name: "phone", labelKey: "auth.fields.phone.label", type: "tel", placeholderKey: "auth.fields.phone.placeholder" },
    { name: "organization_type", labelKey: "auth.fields.organizationType.label", placeholderKey: "auth.fields.organizationType.placeholder" },
    { name: "address", labelKey: "auth.fields.address.label", placeholderKey: "auth.fields.address.placeholder" },
    { name: "village", labelKey: "auth.fields.town.label", placeholderKey: "auth.fields.town.placeholder" },
    { name: "district", labelKey: "auth.fields.district.label", placeholderKey: "auth.fields.district.placeholder" },
    { name: "state", labelKey: "auth.fields.state.label", placeholderKey: "auth.fields.state.placeholder" },
  ],
  services: [
    { name: "provider_name", labelKey: "auth.fields.providerName.label", placeholderKey: "auth.fields.providerName.placeholder" },
    { name: "contact_person", labelKey: "auth.fields.contactPerson.label", placeholderKey: "auth.fields.contactPerson.placeholder" },
    { name: "phone", labelKey: "auth.fields.phone.label", type: "tel", placeholderKey: "auth.fields.phone.placeholder" },
    { name: "service_type", labelKey: "auth.fields.serviceType.label", placeholderKey: "auth.fields.serviceType.placeholder" },
    { name: "village", labelKey: "auth.fields.town.label", placeholderKey: "auth.fields.town.placeholder" },
    { name: "district", labelKey: "auth.fields.district.label", placeholderKey: "auth.fields.district.placeholder" },
    { name: "state", labelKey: "auth.fields.state.label", placeholderKey: "auth.fields.state.placeholder" },
  ],
};

function getAuthMessage(error, action) {
  const message = String(error?.message || "").toLowerCase();

  if (message.includes("already registered") || message.includes("already exists")) {
    return "auth.errors.duplicateEmail";
  }
  if (message.includes("invalid login credentials")) {
    return "auth.errors.invalidCredentials";
  }
  if (message.includes("email not confirmed")) {
    return "auth.errors.emailNotConfirmed";
  }
  if (message.includes("password") && message.includes("at least")) {
    return "auth.errors.passwordTooShort";
  }
  if (message.includes("failed to fetch") || message.includes("network")) {
    return "auth.errors.network";
  }
  if (message.includes("supabase_not_configured")) {
    return "auth.errors.notConfigured";
  }
  return action === "signup"
    ? "auth.errors.signupFailed"
    : "auth.errors.loginFailed";
}

function AuthFrame({ eyebrowKey, titleKey, descriptionKey, children }) {
  const { t } = useTranslation();

  return (
    <main className="auth-page">
      <section className="auth-panel">
        <div className="auth-panel-header">
          <Link className="auth-brand" to="/" aria-label={t("auth.brandHome")}>
            <span aria-hidden="true">🌾</span> Parali Saathi
          </Link>
          <LanguageSwitcher />
        </div>
        <p className="auth-eyebrow">{t(eyebrowKey)}</p>
        <h1>{t(titleKey)}</h1>
        <p className="auth-intro">{t(descriptionKey)}</p>
        {children}
        <p className="auth-footer">{t("auth.teamFooter")}</p>
      </section>
    </main>
  );
}

function SupabaseSetupNotice() {
  const { t } = useTranslation();

  return (
    <div className="auth-notice" role="status">
      <strong>{t("auth.setupTitle")}</strong>
      <span>{t("auth.setupText", {
        urlVariable: "VITE_SUPABASE_URL",
        keyVariable: "VITE_SUPABASE_PUBLISHABLE_KEY",
      })}</span>
    </div>
  );
}

function PasswordField({ id, labelKey, value, onChange, visible, onToggle, autoComplete }) {
  const { t } = useTranslation();
  const label = t(labelKey);

  return (
    <label className="auth-field" htmlFor={id}>
      <span>{label}</span>
      <span className="password-input-wrap">
        <input
          id={id}
          name={id}
          type={visible ? "text" : "password"}
          value={value}
          onChange={onChange}
          autoComplete={autoComplete}
          minLength={8}
          required
        />
        <button
          type="button"
          className="password-toggle"
          onClick={onToggle}
          aria-label={t(visible ? "auth.hidePassword" : "auth.showPassword", { field: label })}
          aria-pressed={visible}
        >
          {t(visible ? "auth.hidePasswordButton" : "auth.showPasswordButton")}
        </button>
      </span>
    </label>
  );
}

export function LoginPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { signIn, session, profile, loading, isConfigured } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (session && !loading && profile) navigate("/dashboard", { replace: true });
  }, [session, loading, profile, navigate]);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      await signIn({ email: email.trim().toLowerCase(), password });
      navigate("/dashboard", { replace: true });
    } catch (authError) {
      setError(getAuthMessage(authError, "login"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthFrame
      eyebrowKey="auth.loginEyebrow"
      titleKey="auth.loginTitle"
      descriptionKey="auth.loginDescription"
    >
      {!isConfigured && <SupabaseSetupNotice />}
      <form className="auth-form" onSubmit={handleSubmit}>
        <label className="auth-field" htmlFor="login-email">
          <span>{t("common.email")}</span>
          <input
            id="login-email"
            name="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
        </label>
        <PasswordField
          id="login-password"
          labelKey="common.password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          visible={passwordVisible}
          onToggle={() => setPasswordVisible((visible) => !visible)}
          autoComplete="current-password"
        />
        {error && <p className="auth-error" role="alert">{t(error)}</p>}
        <button className="auth-submit" type="submit" disabled={submitting || !isConfigured}>
          {submitting ? t("common.loggingIn") : t("common.login")}
        </button>
      </form>
      <p className="auth-switch">
        {t("auth.signupPrompt")} <Link to="/signup">{t("auth.signupLink")}</Link>
      </p>
    </AuthFrame>
  );
}

export function SignupPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { signUp, session, profile, loading, isConfigured } = useAuth();
  const [role, setRole] = useState("farmer");
  const [fields, setFields] = useState({});
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (session && !loading && profile) navigate("/dashboard", { replace: true });
  }, [session, loading, profile, navigate]);

  function selectRole(nextRole) {
    setRole(nextRole);
    setFields({});
    setError("");
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setSuccess(false);

    if (password !== confirmPassword) {
      setError("auth.passwordsDoNotMatch");
      return;
    }
    if (!acceptedTerms) {
      setError("auth.termsRequired");
      return;
    }

    setSubmitting(true);
    try {
      const result = await signUp({
        email: email.trim().toLowerCase(),
        password,
        role,
        profile: fields,
      });

      if (result.session) {
        navigate("/dashboard", { replace: true });
      } else {
        setSuccess(true);
      }
    } catch (authError) {
      setError(getAuthMessage(authError, "signup"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthFrame
      eyebrowKey="auth.signupEyebrow"
      titleKey="auth.signupTitle"
      descriptionKey="auth.signupDescription"
    >
      {!isConfigured && <SupabaseSetupNotice />}
      {success ? (
        <div className="auth-success" role="status">
          <h2>{t("auth.thanks")}</h2>
          <p>{t("auth.emailVerificationSuccess")}</p>
          <Link className="auth-submit auth-submit-link" to="/login">{t("auth.loginLink")}</Link>
        </div>
      ) : (
        <form className="auth-form" onSubmit={handleSubmit}>
          <fieldset className="role-fieldset">
            <legend>{t("auth.profileFieldsTitle")}</legend>
            <div className="role-options">
              {roles.map((item) => (
                <label
                  className={`role-option ${role === item.value ? "selected" : ""}`}
                  key={item.value}
                >
                  <input
                    type="radio"
                    name="role"
                    value={item.value}
                    checked={role === item.value}
                    onChange={() => selectRole(item.value)}
                  />
                  <span className="role-option-icon" aria-hidden="true">{item.icon}</span>
                  <span className="role-option-copy">
                    <strong>{t(item.labelKey)}</strong>
                    <small>{t(item.descriptionKey)}</small>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          <div className="profile-fields">
            {profileFields[role].map((field) => (
              <label className="auth-field" htmlFor={`signup-${field.name}`} key={field.name}>
                <span>{t(field.labelKey)}</span>
                <input
                  id={`signup-${field.name}`}
                  name={field.name}
                  type={field.type || "text"}
                  inputMode={field.type === "tel" ? "tel" : undefined}
                  autoComplete={field.type === "tel" ? "tel" : "on"}
                  maxLength={field.type === "tel" ? 20 : 120}
                  placeholder={t(field.placeholderKey)}
                  value={fields[field.name] || ""}
                  onChange={(event) =>
                    setFields((previous) => ({ ...previous, [field.name]: event.target.value }))
                  }
                  required
                />
              </label>
            ))}
          </div>

          <label className="auth-field" htmlFor="signup-email">
            <span>{t("common.email")}</span>
            <input
              id="signup-email"
              name="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </label>
          <PasswordField
            id="signup-password"
            labelKey="auth.passwordMinimum"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            visible={passwordVisible}
            onToggle={() => setPasswordVisible((visible) => !visible)}
            autoComplete="new-password"
          />
          <PasswordField
            id="signup-confirm-password"
            labelKey="auth.confirmPassword"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            visible={confirmVisible}
            onToggle={() => setConfirmVisible((visible) => !visible)}
            autoComplete="new-password"
          />
          <label className="terms-check">
            <input
              type="checkbox"
              checked={acceptedTerms}
              onChange={(event) => setAcceptedTerms(event.target.checked)}
              required
            />
            <span>{t("auth.termsText")}</span>
          </label>
          {error && <p className="auth-error" role="alert">{t(error)}</p>}
          <button className="auth-submit" type="submit" disabled={submitting || !isConfigured}>
            {submitting ? t("common.creatingAccount") : t("common.signup")}
          </button>
        </form>
      )}
      <p className="auth-switch">
        {t("auth.loginPrompt")} <Link to="/login">{t("auth.loginLink")}</Link>
      </p>
    </AuthFrame>
  );
}

export function AuthLoading() {
  const { t } = useTranslation();
  return (
    <main className="auth-loading">
      <LanguageSwitcher />
      <span role="status">{t("common.loading")}</span>
    </main>
  );
}

export function ProfileIssue({ message, onRetry, onSignOut }) {
  const { t } = useTranslation();
  const [error, setError] = useState("");
  const [working, setWorking] = useState(false);

  async function handleAction(action) {
    setError("");
    setWorking(true);
    try {
      await action();
    } catch {
      setError("auth.profileIssueActionFailed");
    } finally {
      setWorking(false);
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-panel">
        <div className="auth-panel-header">
          <Link className="auth-brand" to="/">🌾 Parali Saathi</Link>
          <LanguageSwitcher />
        </div>
        <h1>{t("auth.profileIssueTitle")}</h1>
        <p className="auth-intro">{t(message)}</p>
        {error && <p className="auth-error" role="alert">{t(error)}</p>}
        <div className="auth-actions">
          <button className="auth-submit" type="button" disabled={working} onClick={() => handleAction(onRetry)}>
            {t("auth.profileIssueRetry")}
          </button>
          <button className="auth-secondary" type="button" disabled={working} onClick={() => handleAction(onSignOut)}>
            {t("auth.profileIssueLogout")}
          </button>
        </div>
      </section>
    </main>
  );
}