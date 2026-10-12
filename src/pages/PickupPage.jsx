
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";

export default function PickupPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();

  const [form, setForm] = useState({
    location: "",
    quantity: "",
    date: "",
    vehicle: "Tractor trolley",
    notes: "",
  });

  const [requests, setRequests] = useState([]);
  const [message, setMessage] = useState("");

  function updateField(event) {
    const { name, value } = event.target;
    setForm((previous) => ({ ...previous, [name]: value }));
  }

  function submitRequest(event) {
    event.preventDefault();

    const request = {
      id: `DEMO-${Date.now().toString().slice(-6)}`,
      ...form,
      status: "Requested",
    };

    setRequests((previous) => [request, ...previous]);
    setMessage(
      "Demo pickup request ban gayi hai. Abhi database mein save nahi hui."
    );

    setForm({
      location: "",
      quantity: "",
      date: "",
      vehicle: "Tractor trolley",
      notes: "",
    });
  }

  return (
    <main className="marketplace-page">
      <header className="marketplace-page-header">
        <button className="secondary-btn" onClick={() => navigate(-1)}>
          ← {t("common.back", { defaultValue: "Back" })}
        </button>

        <p className="marketplace-eyebrow">PARALI SAATHI</p>
        <h1>Pickup Management</h1>
        <p>
          Parali pickup ke liye location, quantity aur preferred
          date ki request taiyar karo.
        </p>
      </header>

      <section className="marketplace-section">
        <h2>Request a Pickup</h2>

        <form className="pickup-form" onSubmit={submitRequest}>
          <label>
            Pickup location *
            <input
              name="location"
              value={form.location}
              onChange={updateField}
              placeholder="Village, district"
              maxLength={200}
              required
            />
          </label>

          <label>
            Quantity (tons) *
            <input
              name="quantity"
              type="number"
              min="0.1"
              step="0.1"
              value={form.quantity}
              onChange={updateField}
              placeholder="e.g. 5"
              required
            />
          </label>

          <label>
            Preferred pickup date *
            <input
              name="date"
              type="date"
              min={new Date().toLocaleDateString("en-CA")}
              value={form.date}
              onChange={updateField}
              required
            />
          </label>

          <label>
            Transport preference
            <select
              name="vehicle"
              value={form.vehicle}
              onChange={updateField}
            >
              <option>Tractor trolley</option>
              <option>Truck</option>
              <option>Other transport</option>
            </select>
          </label>

          <label className="pickup-full-width">
            Additional details
            <textarea
              name="notes"
              value={form.notes}
              onChange={updateField}
              placeholder="Landmark ya pickup instructions"
              maxLength={500}
              rows={3}
            />
          </label>

          <button className="primary-btn" type="submit">
            Create Pickup Request
          </button>
        </form>

        {message && <p className="marketplace-notice" role="status">{message}</p>}
      </section>

      <section className="marketplace-section">
        <h2>Pickup Requests</h2>

        {requests.length === 0 ? (
          <p>Abhi koi demo pickup request nahi hai.</p>
        ) : (
          <div className="pickup-request-list">
            {requests.map((request) => (
              <article className="pickup-request-card" key={request.id}>
                <div className="marketplace-heading">
                  <h3>Request {request.id}</h3>
                  <span className="buyer-status">{request.status}</span>
                </div>

                <p><strong>Location:</strong> {request.location}</p>
                <p><strong>Quantity:</strong> {request.quantity} tons</p>
                <p><strong>Date:</strong> {request.date}</p>
                <p><strong>Transport:</strong> {request.vehicle}</p>

                {request.notes && (
                  <p><strong>Details:</strong> {request.notes}</p>
                )}
              </article>
            ))}
          </div>
        )}
      </section>

      <p className="marketplace-demo-note">
        Demo mode: page refresh karne par ye temporary requests hat jayengi.
      </p>
    </main>
  );
}