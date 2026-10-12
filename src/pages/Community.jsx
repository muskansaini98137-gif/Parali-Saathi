
import { useEffect, useState } from "react";
import { supabase, isConfigured } from "../lib/supabase";
import "./Community.css";

const CATEGORIES = ["All", "Advice", "Machinery", "Parali", "Success Story", "General"];

export default function Community() {
  const [posts, setPosts] = useState([]);
  const [category, setCategory] = useState("All");
  const [search, setSearch] = useState("");
  const [content, setContent] = useState("");
  const [postCategory, setPostCategory] = useState("General");
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState("");
  const [user, setUser] = useState(null);

  async function loadPosts() {
    setLoading(true);
    setError("");

    if (!isConfigured) {
      setError("Supabase configured nahi hai. .env file check karein.");
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from("community_posts")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) setError(error.message);
    else setPosts(data || []);

    setLoading(false);
  }

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
    loadPosts();
  }, []);

  async function createPost(e) {
    e.preventDefault();
    if (!content.trim()) return;

    if (!user) {
      setError("Post karne ke liye pehle login karein.");
      return;
    }

    setPosting(true);
    setError("");

    const { error } = await supabase.from("community_posts").insert({
      user_id: user.id,
      content: content.trim(),
      category: postCategory,
    });

    if (error) setError(error.message);
    else {
      setContent("");
      await loadPosts();
    }

    setPosting(false);
  }

  const filteredPosts = posts.filter((post) => {
    const matchesCategory = category === "All" || post.category === category;
    const matchesSearch = (post.content || "")
      .toLowerCase()
      .includes(search.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <main className="community-page">
      <header className="community-header">
        <div>
          <p className="community-eyebrow">PARALI SAATHI</p>
          <h1>Community 🌱</h1>
          <p>Farmers aur service providers ke saath ideas share karein.</p>
        </div>
      </header>

      <form className="community-compose" onSubmit={createPost}>
        <h2>Apni baat share karein</h2>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Aaj aap kya share karna chahte hain?"
          maxLength={3000}
          required
        />
        <div className="community-compose-actions">
          <select
            value={postCategory}
            onChange={(e) => setPostCategory(e.target.value)}
          >
            {CATEGORIES.filter((c) => c !== "All").map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
          <button disabled={posting || !content.trim()}>
            {posting ? "Posting..." : "Share Post"}
          </button>
        </div>
      </form>

      <section className="community-tools">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Posts search karein..."
        />
        <div className="community-categories">
          {CATEGORIES.map((c) => (
            <button
              type="button"
              key={c}
              className={category === c ? "active" : ""}
              onClick={() => setCategory(c)}
            >
              {c}
            </button>
          ))}
        </div>
      </section>

      {error && <p className="community-error">{error}</p>}
      {loading && <p>Posts load ho rahe hain...</p>}

      {!loading && !error && filteredPosts.length === 0 && (
        <div className="community-empty">
          <h3>Abhi koi post nahi hai</h3>
          <p>Community ki pehli post aap share kar sakte hain.</p>
        </div>
      )}

      <section className="community-feed">
        {filteredPosts.map((post) => (
          <article className="community-post" key={post.id}>
            <div className="community-post-meta">
              <span>🌾 {post.category || "General"}</span>
              <time>
                {post.created_at
                  ? new Date(post.created_at).toLocaleString()
                  : ""}
              </time>
            </div>
            <p className="community-post-content">{post.content}</p>
          </article>
        ))}
      </section>

      <button className="community-refresh" onClick={loadPosts}>
        Refresh Posts
      </button>
    </main>
  );
}