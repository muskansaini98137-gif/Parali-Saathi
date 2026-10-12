
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase.js";

export default function ProfileEditor({ profile, onSaved }) {
  const [form, setForm] = useState({});
  const [photo, setPhoto] = useState(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    setForm({
      full_name: profile?.full_name || "",
      phone: profile?.phone || "",
      village: profile?.village || "",
      district: profile?.district || "",
      state: profile?.state || "Haryana",
      avatar_url: profile?.avatar_url || "",
    });
  }, [profile]);

  function changeField(event) {
    setForm((old) => ({
      ...old,
      [event.target.name]: event.target.value,
    }));
  }

  async function saveProfile(event) {
    event.preventDefault();
    if (!profile?.id || !supabase) {
      setMessage("Profile or database connection is unavailable.");
      return;
    }

    setSaving(true);
    setMessage("");

    try {
      let avatarUrl = form.avatar_url;

      if (photo) {
        if (!["image/jpeg", "image/png", "image/webp"].includes(photo.type)) {
          throw new Error("Choose a JPG, PNG, or WebP photo.");
        }
        if (photo.size > 2 * 1024 * 1024) {
          throw new Error("Photo must be 2 MB or smaller.");
        }

        const extension = photo.type === "image/png"
          ? "png"
          : photo.type === "image/webp" ? "webp" : "jpg";

        const path = `${profile.id}/${crypto.randomUUID()}.${extension}`;
        const { error: uploadError } = await supabase.storage
          .from("profile-photos")
          .upload(path, photo, { contentType: photo.type });

        if (uploadError) throw uploadError;

        avatarUrl = supabase.storage
          .from("profile-photos")
          .getPublicUrl(path).data.publicUrl;
      }

      const { error } = await supabase.from("profiles").update({
        full_name: form.full_name.trim(),
        phone: form.phone.trim(),
        village: form.village.trim(),
        district: form.district.trim(),
        state: form.state.trim(),
        avatar_url: avatarUrl,
        updated_at: new Date().toISOString(),
      }).eq("id", profile.id);

      if (error) throw error;

      setMessage("Profile saved successfully.");
      setPhoto(null);
      await onSaved?.();
    } catch (error) {
      setMessage(error.message || "Could not save profile.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="marketplace-section" id="profile">
      <h2>My Profile</h2>

      <form className="profile-edit-form" onSubmit={saveProfile}>
        <div className="profile-photo-editor">
          {form.avatar_url ? (
            <img
              src={form.avatar_url}
              alt="Profile"
              className="profile-avatar"
            />
          ) : (
            <div className="profile-avatar profile-avatar-placeholder">
              {form.full_name?.charAt(0)?.toUpperCase() || "👤"}
            </div>
          )}

          <label>
            Profile photo
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(event) =>
                setPhoto(event.target.files?.[0] || null)
              }
            />
          </label>
        </div>

        {[
          ["full_name", "Full name"],
          ["phone", "Phone"],
          ["village", "Village"],
          ["district", "District"],
          ["state", "State"],
        ].map(([name, label]) => (
          <label key={name}>
            {label}
            <input
              name={name}
              value={form[name] || ""}
              onChange={changeField}
              maxLength={120}
              required={name === "full_name"}
            />
          </label>
        ))}

        <button className="primary-btn" type="submit" disabled={saving}>
          {saving ? "Saving..." : "Save profile"}
        </button>

        {message && <p role="status">{message}</p>}
      </form>
    </section>
  );
}