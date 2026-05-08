#!/usr/bin/env node
// Generate a deterministic mock atlas.json with ~50 sources spread across 6 clusters.
// Run: node scripts/generate-mock-atlas.mjs
// Output: public/atlas.json

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outPath = path.join(__dirname, "..", "public", "atlas.json");

// ---- deterministic PRNG (mulberry32) ----
function rng(seed) {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = t;
    r = Math.imul(r ^ (r >>> 15), r | 1);
    r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = rng(42);
const randRange = (a, b) => a + (b - a) * rand();
const randInt = (a, b) => Math.floor(randRange(a, b + 1));
const pick = (arr) => arr[Math.floor(rand() * arr.length)];

// ---- feature metadata ----
const featureMetadata = {
  hype_score: { label: "Hype", description: "Density of hype words like 'revolutionary', 'must-read', 'game-changer' in titles.", min: 0, max: 1, higher_is: "more" },
  listicle_ratio: { label: "Listicles", description: "Share of posts whose titles match listicle patterns ('5 ways to…').", min: 0, max: 1, higher_is: "more" },
  question_ratio: { label: "Questions", description: "Share of posts with question-shaped titles.", min: 0, max: 1, higher_is: "more" },
  avg_read_time: { label: "Avg read time", description: "Average daily.dev-reported read time in minutes.", min: 0, max: 30, higher_is: "more" },
  summary_length_avg: { label: "Summary length", description: "Average summary length in characters.", min: 0, max: 800, higher_is: "more" },
  title_length_avg: { label: "Title length", description: "Average title length in characters.", min: 0, max: 200, higher_is: "more" },
  title_length_var: { label: "Title length variance", description: "Variance of title length — high = inconsistent style.", min: 0, max: 4000, higher_is: "more" },
  tag_entropy: { label: "Tag entropy", description: "Shannon entropy of tag distribution.", min: 0, max: 6, higher_is: "more" },
  tag_diversity: { label: "Tag diversity", description: "Number of distinct tags per post.", min: 0, max: 10, higher_is: "more" },
  top_tag_share: { label: "Top-tag share", description: "Share of posts that use the most common tag.", min: 0, max: 1, higher_is: "less" },
  avg_upvotes: { label: "Avg upvotes", description: "Average upvotes per post.", min: 0, max: 500, higher_is: "more" },
  median_upvotes: { label: "Median upvotes", description: "Median upvotes per post.", min: 0, max: 200, higher_is: "more" },
  avg_comments: { label: "Avg comments", description: "Average comments per post.", min: 0, max: 100, higher_is: "more" },
  comment_to_upvote_ratio: { label: "Comments / upvote", description: "Ratio of comments to upvotes — high = controversial/discussed.", min: 0, max: 2, higher_is: "more" },
  zero_engagement_share: { label: "Zero-engagement share", description: "Share of posts with zero upvotes and zero comments.", min: 0, max: 1, higher_is: "less" },
  viral_share: { label: "Viral share", description: "Share of posts in the top 5% by upvotes.", min: 0, max: 1, higher_is: "more" },
  posts_per_week: { label: "Cadence", description: "Average posts per week.", min: 0, max: 50, higher_is: "more" },
  non_article_ratio: { label: "Non-article ratio", description: "Share of posts that are videos/podcasts/etc, not articles.", min: 0, max: 1, higher_is: "more" },
  author_present_share: { label: "Author byline share", description: "Share of posts with an explicit byline.", min: 0, max: 1, higher_is: "more" },
  recency_skew: { label: "Recency skew", description: "Posts skew toward recency (1.0) vs evenly distributed (0).", min: 0, max: 1, higher_is: "more" },
};

// ---- clusters with personalities ----
const clusters = [
  { id: 0, label: "Corporate engineering blogs", color: "#3b82f6", center: [-3.0, 1.5], profile: "corp" },
  { id: 1, label: "Indie deep-dive newsletters", color: "#a855f7", center: [2.5, 2.0], profile: "indie" },
  { id: 2, label: "Tutorial mills", color: "#22c55e", center: [-2.0, -2.5], profile: "tutorial" },
  { id: 3, label: "News & aggregators", color: "#f59e0b", center: [0.5, 3.5], profile: "news" },
  { id: 4, label: "Hot-take essayists", color: "#ef4444", center: [3.0, -1.5], profile: "hottake" },
  { id: 5, label: "Niche community squads", color: "#06b6d4", center: [-1.0, -0.5], profile: "squad" },
];

const profiles = {
  corp: {
    hype_score: [0.05, 0.25], listicle_ratio: [0.03, 0.15], question_ratio: [0.05, 0.15],
    avg_read_time: [8, 18], summary_length_avg: [300, 600], title_length_avg: [50, 90],
    title_length_var: [200, 600], tag_entropy: [2.5, 4.0], tag_diversity: [3, 5],
    top_tag_share: [0.2, 0.4], avg_upvotes: [40, 150], median_upvotes: [20, 80],
    avg_comments: [5, 25], comment_to_upvote_ratio: [0.1, 0.3], zero_engagement_share: [0.05, 0.2],
    viral_share: [0.03, 0.1], posts_per_week: [1, 4], non_article_ratio: [0, 0.1],
    author_present_share: [0.7, 1.0], recency_skew: [0.4, 0.6],
  },
  indie: {
    hype_score: [0.1, 0.3], listicle_ratio: [0.05, 0.2], question_ratio: [0.15, 0.35],
    avg_read_time: [12, 25], summary_length_avg: [400, 750], title_length_avg: [60, 110],
    title_length_var: [400, 1200], tag_entropy: [3.0, 4.5], tag_diversity: [4, 7],
    top_tag_share: [0.15, 0.3], avg_upvotes: [60, 250], median_upvotes: [30, 120],
    avg_comments: [10, 50], comment_to_upvote_ratio: [0.15, 0.4], zero_engagement_share: [0.02, 0.1],
    viral_share: [0.05, 0.2], posts_per_week: [0.5, 2], non_article_ratio: [0, 0.05],
    author_present_share: [0.9, 1.0], recency_skew: [0.5, 0.7],
  },
  tutorial: {
    hype_score: [0.2, 0.5], listicle_ratio: [0.3, 0.6], question_ratio: [0.2, 0.4],
    avg_read_time: [4, 10], summary_length_avg: [150, 350], title_length_avg: [40, 80],
    title_length_var: [150, 400], tag_entropy: [2.0, 3.5], tag_diversity: [2, 4],
    top_tag_share: [0.25, 0.5], avg_upvotes: [10, 60], median_upvotes: [5, 25],
    avg_comments: [1, 8], comment_to_upvote_ratio: [0.05, 0.2], zero_engagement_share: [0.2, 0.5],
    viral_share: [0.01, 0.05], posts_per_week: [5, 25], non_article_ratio: [0, 0.15],
    author_present_share: [0.4, 0.8], recency_skew: [0.5, 0.8],
  },
  news: {
    hype_score: [0.3, 0.6], listicle_ratio: [0.05, 0.15], question_ratio: [0.05, 0.15],
    avg_read_time: [2, 6], summary_length_avg: [100, 280], title_length_avg: [50, 90],
    title_length_var: [200, 500], tag_entropy: [3.5, 5.0], tag_diversity: [4, 8],
    top_tag_share: [0.1, 0.25], avg_upvotes: [20, 120], median_upvotes: [10, 50],
    avg_comments: [3, 20], comment_to_upvote_ratio: [0.1, 0.3], zero_engagement_share: [0.1, 0.3],
    viral_share: [0.02, 0.08], posts_per_week: [10, 40], non_article_ratio: [0.05, 0.3],
    author_present_share: [0.3, 0.7], recency_skew: [0.7, 0.95],
  },
  hottake: {
    hype_score: [0.4, 0.8], listicle_ratio: [0.05, 0.2], question_ratio: [0.25, 0.5],
    avg_read_time: [6, 14], summary_length_avg: [250, 500], title_length_avg: [55, 100],
    title_length_var: [400, 1500], tag_entropy: [2.5, 4.0], tag_diversity: [3, 5],
    top_tag_share: [0.2, 0.4], avg_upvotes: [80, 400], median_upvotes: [30, 150],
    avg_comments: [20, 80], comment_to_upvote_ratio: [0.3, 0.8], zero_engagement_share: [0.02, 0.1],
    viral_share: [0.1, 0.3], posts_per_week: [0.3, 2], non_article_ratio: [0, 0.1],
    author_present_share: [0.95, 1.0], recency_skew: [0.5, 0.75],
  },
  squad: {
    hype_score: [0.15, 0.4], listicle_ratio: [0.1, 0.3], question_ratio: [0.2, 0.4],
    avg_read_time: [3, 9], summary_length_avg: [120, 300], title_length_avg: [40, 75],
    title_length_var: [200, 800], tag_entropy: [2.0, 3.5], tag_diversity: [2, 4],
    top_tag_share: [0.3, 0.6], avg_upvotes: [5, 40], median_upvotes: [2, 15],
    avg_comments: [2, 15], comment_to_upvote_ratio: [0.2, 0.5], zero_engagement_share: [0.15, 0.4],
    viral_share: [0.01, 0.05], posts_per_week: [2, 10], non_article_ratio: [0.1, 0.4],
    author_present_share: [0.2, 0.6], recency_skew: [0.6, 0.9],
  },
};

const sample = (range) => randRange(range[0], range[1]);

// ---- name pools ----
const handlePools = {
  corp: ["stripe_eng", "uber_engineering", "netflix_techblog", "shopify_eng", "airbnb_eng", "github_eng", "cloudflare_blog", "discord_eng", "linkedin_eng"],
  indie: ["pragmatic_engineer", "indie_skeptic", "byte_byte_go", "high_growth_eng", "ssr_substack", "kentcdodds", "maxrozen_dev", "joshwcomeau"],
  tutorial: ["tutorial_mill", "freecodecamp", "javascript_today", "css_tricks_clone", "react_recipes", "ten_minute_devops", "code_quickly", "snippet_factory"],
  news: ["the_register_alt", "hn_digest", "infoq_clone", "techcrunch_dev", "morning_brew_dev", "the_new_stack", "dev_news_daily"],
  hottake: ["hot_take_dev", "spicy_software", "contrarian_coder", "bigtech_critic", "no_silver_bullet", "frustrated_eng", "based_developer"],
  squad: ["webdev_squad", "rust_corner", "junior_devs", "ml_practitioners", "frontend_masters_squad", "devops_pros", "go_gophers"],
};

const namePools = {
  corp: ["Stripe Engineering", "Uber Engineering", "Netflix Tech Blog", "Shopify Engineering", "Airbnb Engineering", "GitHub Engineering", "Cloudflare Blog", "Discord Engineering", "LinkedIn Engineering"],
  indie: ["The Pragmatic Engineer", "Indie Skeptic", "ByteByteGo", "High Growth Engineer", "SSR Substack", "Kent C. Dodds", "Max Rozen", "Josh W. Comeau"],
  tutorial: ["Tutorial Mill", "freeCodeCamp", "JavaScript Today", "CSS Tricks Clone", "React Recipes", "Ten-Minute DevOps", "Code Quickly", "Snippet Factory"],
  news: ["The Register (alt)", "HN Digest", "InfoQ Clone", "TechCrunch Dev", "Morning Brew Dev", "The New Stack", "Dev News Daily"],
  hottake: ["Hot Take Dev", "Spicy Software", "Contrarian Coder", "Big Tech Critic", "No Silver Bullet", "Frustrated Engineer", "Based Developer"],
  squad: ["Web Dev Squad", "Rust Corner", "Junior Devs", "ML Practitioners", "Frontend Masters Squad", "DevOps Pros", "Go Gophers"],
};

const tagPools = {
  corp: ["engineering", "scalability", "infrastructure", "microservices", "kubernetes", "postgres", "observability", "platform"],
  indie: ["career", "leadership", "startup", "writing", "system-design", "interviews", "newsletter", "essays"],
  tutorial: ["tutorial", "javascript", "react", "css", "nodejs", "beginner", "guide", "snippet", "howto"],
  news: ["news", "ai", "startup", "funding", "release", "industry", "trends"],
  hottake: ["opinion", "controversial", "rant", "career", "remote-work", "ai-doom", "anti-pattern"],
  squad: ["community", "discussion", "question", "showcase", "help", "feedback"],
};

const titleTemplates = {
  corp: [
    "How we scaled {tech} to {n}M requests per second",
    "Migrating our monolith to {tech}: lessons learned",
    "Building a resilient {tech} pipeline at {company} scale",
    "Inside {company}'s observability stack",
    "Designing {tech} for the next decade",
  ],
  indie: [
    "Why senior engineers stop writing code",
    "The hidden cost of {tech} you should know about",
    "What I learned managing engineers for 10 years",
    "Are we overengineering {tech}?",
    "A pragmatic guide to {tech}",
  ],
  tutorial: [
    "10 {tech} tricks every developer should know",
    "How to build {tech} in 5 minutes",
    "{tech}: the complete beginner's guide",
    "5 ways to optimize your {tech} code",
    "Building a {tech} clone from scratch",
  ],
  news: [
    "{company} announces {tech} general availability",
    "Breaking: {company} acquires {company2} for $1B",
    "{tech} 2.0 released — here's what's new",
    "Why everyone is talking about {tech}",
    "{company} layoffs hit engineering teams",
  ],
  hottake: [
    "Stop using {tech}. You don't need it.",
    "{tech} is dead. Long live {tech2}.",
    "The {tech} hype is exhausting",
    "Why I quit {tech} after 5 years",
    "Unpopular opinion: {tech} was never good",
  ],
  squad: [
    "Anyone tried {tech} in production?",
    "What's your {tech} workflow like?",
    "Sharing my {tech} project — feedback welcome",
    "Help debugging this {tech} issue",
    "Best resources for learning {tech}?",
  ],
};

const techs = ["Kubernetes", "Postgres", "Kafka", "GraphQL", "Rust", "TypeScript", "React", "Next.js", "Redis", "gRPC", "Terraform", "Tailwind", "WebAssembly", "Vite", "esbuild"];
const companies = ["Stripe", "Netflix", "Discord", "Cloudflare", "Notion", "Linear", "Vercel", "Supabase", "Anthropic", "OpenAI", "Figma"];

function fillTemplate(t) {
  return t
    .replace("{tech}", pick(techs))
    .replace("{tech2}", pick(techs))
    .replace("{company}", pick(companies))
    .replace("{company2}", pick(companies))
    .replace("{n}", String(randInt(1, 100)));
}

function gen() {
  const sources = [];
  let idCounter = 1;
  const used = new Set();

  for (const cluster of clusters) {
    const profile = profiles[cluster.profile];
    const handlePool = [...handlePools[cluster.profile]];
    const namePool = [...namePools[cluster.profile]];
    const tagPool = tagPools[cluster.profile];
    const templatePool = titleTemplates[cluster.profile];

    // 7-9 sources per cluster
    const count = randInt(7, 9);
    for (let i = 0; i < count; i++) {
      let handle = handlePool[i % handlePool.length];
      if (used.has(handle)) handle = `${handle}_${i}`;
      used.add(handle);
      const name = namePool[i % namePool.length] + (i >= namePool.length ? ` ${i}` : "");

      const features = {};
      for (const key of Object.keys(featureMetadata)) {
        features[key] = +sample(profile[key]).toFixed(3);
      }

      // pick top tags from the cluster's pool
      const shuffledTags = [...tagPool].sort(() => rand() - 0.5).slice(0, randInt(3, 6));
      const top_tags = shuffledTags.map((t, idx) => [t, randInt(20, 200) - idx * 10]);

      const representative = Array.from({ length: 3 }, () => fillTemplate(pick(templatePool)));
      const outlier = Array.from({ length: 2 }, () => fillTemplate(pick(templatePool)));

      // scatter around centroid
      const x = +(cluster.center[0] + randRange(-1.2, 1.2)).toFixed(3);
      const y = +(cluster.center[1] + randRange(-1.2, 1.2)).toFixed(3);

      const postsCollected = randInt(20, 500);
      const newest = Date.now() - randInt(0, 14) * 86400000;
      const oldest = newest - postsCollected * randInt(1, 5) * 86400000;

      sources.push({
        id: `s_${idCounter++}`,
        handle,
        name,
        image: null,
        description: `${cluster.label.toLowerCase()} — ${name}.`,
        is_squad: cluster.profile === "squad",
        x, y,
        cluster_id: cluster.id,
        posts_collected: postsCollected,
        newest_post_at: new Date(newest).toISOString(),
        oldest_post_at: new Date(oldest).toISOString(),
        features,
        top_tags,
        sample_titles: { representative, outlier },
      });
    }
  }

  // recompute cluster sizes & centroids from actual sources
  const clusterOut = clusters.map((c) => {
    const members = sources.filter((s) => s.cluster_id === c.id);
    const cx = members.reduce((s, m) => s + m.x, 0) / members.length;
    const cy = members.reduce((s, m) => s + m.y, 0) / members.length;
    return {
      id: c.id,
      label: c.label,
      size: members.length,
      centroid: { x: +cx.toFixed(3), y: +cy.toFixed(3) },
      color: c.color,
    };
  });

  return {
    version: "1",
    generated_at: new Date().toISOString(),
    feature_metadata: featureMetadata,
    clusters: clusterOut,
    sources,
  };
}

const data = gen();
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(data, null, 2));
console.log(`Wrote ${data.sources.length} sources across ${data.clusters.length} clusters → ${outPath}`);
