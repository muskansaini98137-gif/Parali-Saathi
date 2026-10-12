
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";

const sampleListings = [
  {
    id: 1,
    farmer: "Local Farmer",
    village: "Nearby village",
    district: "Panipat",
    quantity: 5,
    price: 1800,
    unit: "ton",
    status: "Available",
  },
  {
    id: 2,
    farmer: "Agriculture Farmer",
    village: "Nearby village",
    district: "Karnal",
    quantity: 8,
    price: 2000,
    unit: "ton",
    status: "Available",
  },
  {
    id: 3,
    farmer: "Farm Owner",
    village: "Nearby village",
    district: "Sonipat",
    quantity: 3,
    price: 1700,
    unit: "ton",
    status: "Available",
  },
];

export default function BuyerMatching() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [search, setSearch] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [interest, setInterest] = useState({});
  const [notice, setNotice] = useState("");

  const listings = useMemo(() => {
    return sampleListings.filter((item) => {
      const text =
        `${item.village} ${item.district} ${item.farmer}`.toLowerCase();

      const matchesSearch = text.includes(search.toLowerCase());
      const matchesPrice =
        maxPrice === "" || item.price <= Number(maxPrice);

      return matchesSearch && matchesPrice;
    });
  }, [search, maxPrice]);

  function requestInterest(id) {
    setInterest((previous) => ({ ...previous, [id]: true }));
    setNotice(
      "Demo request marked. Database connection abhi configure nahi hui hai."
    );
  }

  return (
    <main className="marketplace-page">
      <header className="marketplace-page-header">
        <button className="secondary-btn" onClick={() => navigate(-1)}>
          ← {t("common.back", { defaultValue: "Back" })}
        </button>

        <p className="marketplace-eyebrow">PARALI SAATHI</p>
        <h1>Buyer Matching</h1>
        <p>
          Available parali listings dekho aur quantity, location
          aur price ke hisaab se suitable option dhoondo.
        </p>
      </header>

      <section className="marketplace-section">
        <h2>Find Parali</h2>

        <div className="buyer-filters">
          <label>
            Village ya district
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="e.g. Panipat"
            />
          </label>

          <label>
            Maximum price per ton (₹)
            <input
              type="number"
              min="0"
              value={maxPrice}
              onChange={(event) => setMaxPrice(event.target.value)}
              placeholder="Any price"
            />
          </label>
        </div>
      </section>

      <section className="marketplace-section">
        <div className="marketplace-heading">
          <h2>Available Listings</h2>
          <span>{listings.length} results</span>
        </div>

        <div className="buyer-listing-grid">
          {listings.map((item) => (
            <article className="buyer-listing-card" key={item.id}>
              <div className="buyer-card-top">
                <span className="buyer-status">{item.status}</span>
                <span>#{item.id}</span>
              </div>

              <h3>{item.quantity} tons of parali</h3>
              <p>{item.village}, {item.district}</p>
              <p>Seller: {item.farmer}</p>

              <div className="buyer-price">
                ₹{item.price.toLocaleString("en-IN")}
                <span> / ton</span>
              </div>

              <button
                className="primary-btn"
                onClick={() => requestInterest(item.id)}
                disabled={Boolean(interest[item.id])}
              >
                {interest[item.id] ? "Interest Marked" : "Express Interest"}
              </button>
            </article>
          ))}

          {listings.length === 0 && (
            <p>No matching listings. Search filters change karke dekho.</p>
          )}
        </div>

        {notice && <p className="marketplace-notice" role="status">{notice}</p>}
      </section>

      <p className="marketplace-demo-note">
        Demo data: ye sample listings hain, live farmer listings nahi.
      </p>
    </main>
  );
}