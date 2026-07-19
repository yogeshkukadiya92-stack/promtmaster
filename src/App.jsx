import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  Bell,
  Books,
  BracketsCurly,
  Briefcase,
  Archive,
  CaretDown,
  ChatCircleDots,
  ChartLineUp,
  Check,
  CirclesFour,
  Cpu,
  ClockCounterClockwise,
  Code,
  Database,
  DownloadSimple,
  EnvelopeSimple,
  Flask,
  Flag,
  Funnel,
  Gavel,
  Gear,
  House,
  Lightbulb,
  Key,
  ListChecks,
  Moon,
  Money,
  MagnifyingGlass,
  PaperPlaneTilt,
  Play,
  PencilSimple,
  PlusSquare,
  Question,
  Robot,
  Sparkle,
  ShareNetwork,
  ShoppingBagOpen,
  ShieldCheck,
  Star,
  Storefront,
  UserCircle,
  Target,
  Trash,
  UserPlus,
  UserCheck,
  UserMinus,
  UsersThree,
  Wrench,
  Warning,
  Wallet,
  X,
} from "@phosphor-icons/react";
import { authConfigured, authMode, getInitialSession, sendMagicLink, signOut, subscribeToSession } from "./lib/auth.js";
import { compareModels, evaluateAsset, improveAsset, recommendRoute, runProviderEvaluation, runTestSuite } from "./lib/evaluator.js";
import { generateAsset, getProviderStatus } from "./lib/generator.js";
import { marketplaceAssets, marketplaceCategories } from "./lib/marketplace.js";
import { loadListings, newListing, saveListings, scanListing } from "./lib/publishing.js";
import { averageRating, loadReports, loadReviews, saveReports, saveReviews } from "./lib/community.js";
import { createCheckoutSession, loadCloudEntitlements, loadPurchases, money, PLATFORM_FEE_RATE, savePurchases } from "./lib/commerce.js";
import { cancelCloudExecution, cancelExecution, createAgentSchedule, createCloudExecution, createExecution, decideActionCloudExecution, decideCloudExecution, deleteAgentMemory, deleteAgentSchedule, finishExecution, loadAgentExecutions, loadAgentMemories, loadAgentOperations, loadAgentSchedules, loadCloudAgentExecutions, retryCloudExecution, saveAgentExecutions, setAgentScheduleActive } from "./lib/execution.js";
import { acceptCloudInvitation, deleteCloudAsset, exportAsset, inviteCloudMember, loadAssets, loadCloudAssets, loadCloudWorkspace, loadCollaboration, loadRunHistory, loadTestSuites, loadVersionHistory, removeCloudMember, resendCloudInvitation, saveAssets, saveCloudAsset, saveCollaboration, saveRunHistory, saveTestSuites, saveVersionHistory, shareCloudAsset, updateCloudMember } from "./lib/storage.js";
import { downloadAuditExport, loadGovernance, saveGovernance } from "./lib/governance.js";
import { loadIdentity, rotateScimToken, saveIdentity } from "./lib/identity.js";
import { decidePromotion, loadReleases, requestPromotion, rollbackRelease } from "./lib/releases.js";
import { loadInfrastructure, revokeInfrastructureKey, runRecoveryDrill, saveInfrastructure } from "./lib/infrastructure.js";
import { downloadEnterpriseUsage, loadEnterpriseUsage, updateEnterpriseFlag } from "./lib/enterprise-usage.js";
import { downloadRecoveryManifest, loadRecoveryVerifications, loadSla, runRecoveryVerification } from "./lib/operations.js";
import { loadActivationReport, trackActivation } from "./lib/activation.js";
import { createBetaAccess, loadLaunchCenter, redeemBetaAccess, revokeBetaAccess, saveLaunchControl } from "./lib/launch.js";
import { assignGrowthVariant, createExperiment, loadGrowthOperations, loadInAppLifecycle, setExperimentStatus, updateLifecycle } from "./lib/growth.js";
import { clearAdminToken, createAdminAccess, createAdminBackup, exportAdminUser, getAdminToken, loadAdminOverview, updateAdminUser } from "./lib/admin.js";

const modes = [
  { id: "auto", label: "Auto detect", icon: Sparkle },
  { id: "prompt", label: "Prompt", icon: ChatCircleDots },
  { id: "skill", label: "Skill", icon: Wrench },
  { id: "agent", label: "Agent", icon: Briefcase },
];

const recentItems = [
  { title: "Create a launch campaign for a sustainable skincare brand", type: "Agent", time: "2m ago", icon: Sparkle },
  { title: "Write onboarding flow copy for a productivity app", type: "Prompt", time: "1h ago", icon: ChatCircleDots },
  { title: "Customer research synthesis skill", type: "Skill", time: "3h ago", icon: Wrench },
  { title: "Summarize competitor positioning", type: "Prompt", time: "Yesterday", icon: ChatCircleDots },
  { title: "Lead qualification agent for SaaS inbound", type: "Agent", time: "2d ago", icon: Briefcase },
];

const outline = [
  {
    title: "Goal",
    icon: Target,
    tone: "prompt",
    body: "Drive awareness and sign-ups for the new sustainable skincare brand launch.",
  },
  {
    title: "Audience",
    icon: UsersThree,
    tone: "blue",
    body: "Eco-conscious consumers, ages 20–35, interested in clean beauty.",
  },
  {
    title: "Strategy",
    icon: ListChecks,
    tone: "skill",
    bullets: ["Positioning & messaging", "Content & channel plan", "Influencer & PR outreach", "Launch timeline", "Measurement & optimization"],
  },
  {
    title: "Execution Plan",
    icon: ArrowRight,
    tone: "agent",
    steps: ["Pre-launch: Tease & build community", "Launch: Multi-channel campaign", "Post-launch: UGC & reviews", "Optimize & scale"],
  },
  {
    title: "Deliverables",
    icon: Database,
    tone: "prompt",
    checks: ["Campaign brief", "Content calendar", "Email sequences", "Social posts", "Influencer outreach list", "Performance dashboard"],
  },
];

function Brand() {
  return (
    <div className="brand" aria-label="IntentOS home">
      <div className="brand-name">Intent<span>OS</span></div>
      <div className="brand-subtitle">AI Capability Builder</div>
    </div>
  );
}

function NavItem({ icon: Icon, children, active = false, onClick, count }) {
  return (
    <button type="button" className={`nav-item ${active ? "active" : ""}`} onClick={onClick}>
      <Icon size={26} weight="regular" aria-hidden="true" />
      <span>{children}</span>
      {count ? <span className="nav-count">{count}</span> : null}
    </button>
  );
}

function Sidebar({ mobileOpen, onClose, view, setView, assetCount, session, onOpenAuth }) {
  const navigate = (nextView) => {
    setView(nextView);
    onClose();
  };
  return (
    <aside className={`sidebar ${mobileOpen ? "mobile-open" : ""}`}>
      <div>
        <Brand />
        <nav aria-label="Primary navigation">
          <NavItem icon={House} active={view === "home"} onClick={() => navigate("home")}>Home</NavItem>
          <NavItem icon={PlusSquare} active={view === "create"} onClick={() => navigate("create")}>Create</NavItem>
          <NavItem icon={Books} active={view === "library"} onClick={() => navigate("library")} count={assetCount}>Library</NavItem>
          <NavItem icon={ShoppingBagOpen} active={view === "marketplace"} onClick={() => navigate("marketplace")}>Marketplace</NavItem>
          <NavItem icon={UserCircle} active={view === "creators"} onClick={() => navigate("creators")}>Creators</NavItem>
          <NavItem icon={Storefront} active={view === "publishing"} onClick={() => navigate("publishing")}>Publishing</NavItem>
          <NavItem icon={Gavel} active={view === "moderation"} onClick={() => navigate("moderation")}>Moderation</NavItem>
          <NavItem icon={Flag} active={view === "reports"} onClick={() => navigate("reports")}>Reports</NavItem>
          <NavItem icon={Wallet} active={view === "earnings"} onClick={() => navigate("earnings")}>Earnings</NavItem>
          <NavItem icon={Flask} active={view === "playground"} onClick={() => navigate("playground")}>Playground</NavItem>
          <NavItem icon={Robot} active={view === "execution"} onClick={() => navigate("execution")}>Execution</NavItem>
          <NavItem icon={ChartLineUp} active={view === "analytics"} onClick={() => navigate("analytics")}>Analytics</NavItem>
          <NavItem icon={UsersThree} active={view === "workspace"} onClick={() => navigate("workspace")}>Workspace</NavItem>
        </nav>
      </div>

      <div className="sidebar-bottom">
        <div className="utility-nav">
          <NavItem icon={ShieldCheck} active={view === "admin"} onClick={() => navigate("admin")}>Admin</NavItem>
          <NavItem icon={Gear} active={view === "settings"} onClick={() => navigate("settings")}>Settings</NavItem>
          <NavItem icon={Question}>Help</NavItem>
          <button type="button" className="workspace-switcher" onClick={onOpenAuth}>
            <span className="workspace-avatar">{session?.user?.email?.slice(0, 2).toUpperCase() || "YP"}</span>
            <span>{session?.user?.email || "Sign in to sync"}</span>
            <CaretDown size={15} aria-hidden="true" />
          </button>
        </div>
        <div className="sidebar-date">
          <span>July 19, 2026</span>
          <Moon size={20} weight="regular" aria-label="Dark theme" />
        </div>
      </div>
    </aside>
  );
}

function AuthDialog({ open, onClose, session }) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState("idle");
  const [message, setMessage] = useState("");

  if (!open) return null;

  const submit = async (event) => {
    event.preventDefault();
    setStatus("loading");
    setMessage("");
    try {
      await sendMagicLink(email);
      setStatus("success");
      setMessage("Check your email for the secure sign-in link.");
    } catch (error) {
      setStatus("error");
      setMessage(error.message || "Sign-in could not be started.");
    }
  };

  const logOut = async () => {
    setStatus("loading");
    try { await signOut(); onClose(); } catch (error) { setStatus("error"); setMessage(error.message); }
  };

  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="auth-dialog" role="dialog" aria-modal="true" aria-labelledby="auth-title">
        <button type="button" className="dialog-close" onClick={onClose} aria-label="Close sign in"><X size={20} /></button>
        <div className="auth-icon"><EnvelopeSimple size={28} weight="duotone" /></div>
        <h2 id="auth-title">{session ? "Cloud sync is active" : "Sign in to sync"}</h2>
        <p>{session ? (authMode === "mongodb" ? "Your assets sync to MongoDB using a private session stored on this device." : `Your assets can sync securely as ${session.user.email}.`) : "Use a secure email link to access your Prompt, Skill, and Agent library on any device."}</p>
        {!authConfigured ? <div className="auth-notice">Cloud authentication is not configured in this environment.</div> : session ? <button type="button" className="auth-primary" onClick={logOut} disabled={status === "loading"}>Reset device session</button> : authMode === "mongodb" ? <button type="button" className="auth-primary" onClick={() => window.location.reload()}>Create private workspace</button> : (
          <form onSubmit={submit}>
            <label htmlFor="auth-email">Email address</label>
            <input id="auth-email" type="email" required autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@company.com" />
            <button type="submit" className="auth-primary" disabled={status === "loading"}>{status === "loading" ? "Sending link…" : "Send secure sign-in link"}</button>
          </form>
        )}
        {message ? <div className={`auth-message ${status}`} role={status === "error" ? "alert" : "status"}>{message}</div> : null}
      </section>
    </div>
  );
}

function ModeSelector({ selected, onChange }) {
  return (
    <div className="mode-row" role="radiogroup" aria-label="Build as">
      <span className="build-label">Build as</span>
      <div className="mode-options">
        {modes.map(({ id, label, icon: Icon }) => (
          <button
            type="button"
            key={id}
            role="radio"
            aria-checked={selected === id}
            className={`mode-button mode-${id} ${selected === id ? "selected" : ""}`}
            onClick={() => onChange(id)}
          >
            <Icon size={21} weight="regular" aria-hidden="true" />
            <span>{label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function Composer({ value, onChange, mode, onModeChange, isGenerating, onGenerate, generateLabel="Generate" }) {
  return (
    <section className="composer" aria-label="AI capability composer">
      <label className="sr-only" htmlFor="intent-input">Describe what you want to build</label>
      <textarea
        id="intent-input"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        maxLength={500}
        placeholder="Describe the outcome you want..."
      />
      <span className="character-count">{value.length} / 500</span>
      <div className="composer-footer">
        <ModeSelector selected={mode} onChange={onModeChange} />
        <button
          type="button"
          className="generate-button"
          onClick={onGenerate}
          disabled={!value.trim() || isGenerating}
        >
          {isGenerating ? <span className="spinner" aria-hidden="true" /> : null}
          <span>{isGenerating ? "Generating" : generateLabel}</span>
          {!isGenerating ? <ArrowRight size={21} weight="bold" aria-hidden="true" /> : null}
        </button>
      </div>
    </section>
  );
}

function RecentWork({ items, onViewAll }) {
  return (
    <section className="recent-section">
      <header className="section-heading">
        <h2>Recent</h2>
        <button type="button" onClick={onViewAll}>View all <ArrowRight size={15} aria-hidden="true" /></button>
      </header>
      <div className="recent-list">
        {items.map(({ title, type, time, icon: Icon }, index) => (
          <button type="button" className={`recent-row type-${type.toLowerCase()}`} key={`${title}-${index}`}>
            <Icon className="recent-icon" size={24} weight="regular" aria-hidden="true" />
            <span className="recent-title">{title}</span>
            <span className="recent-type">{type}</span>
            <time>{time}</time>
            <span className="row-menu" aria-label={`More options for ${title}`}>•••</span>
          </button>
        ))}
      </div>
    </section>
  );
}

function OutlineItem({ item }) {
  const Icon = item.icon;
  return (
    <section className={`outline-item tone-${item.tone}`}>
      <Icon size={28} weight="regular" className="outline-icon" aria-hidden="true" />
      <div>
        <h3>{item.title}</h3>
        {item.body ? <p>{item.body}</p> : null}
        {item.bullets ? (
          <ul>{item.bullets.map((bullet) => <li key={bullet}>{bullet}</li>)}</ul>
        ) : null}
        {item.steps ? (
          <ol>{item.steps.map((step) => <li key={step}>{step}</li>)}</ol>
        ) : null}
        {item.checks ? (
          <ul className="check-list">{item.checks.map((check) => <li key={check}><Check size={15} weight="bold" aria-hidden="true" />{check}</li>)}</ul>
        ) : null}
      </div>
    </section>
  );
}

function Inspector({ tab, setTab, asset }) {
  return (
    <aside className="inspector" aria-label="Generated capability preview">
      <div className="inspector-tabs" role="tablist">
        {['outline', 'result'].map((item) => (
          <button
            type="button"
            role="tab"
            aria-selected={tab === item}
            key={item}
            onClick={() => setTab(item)}
            className={tab === item ? "active" : ""}
          >
            {item[0].toUpperCase() + item.slice(1)}
          </button>
        ))}
      </div>

      {tab === "outline" ? (
        <div className="inspector-content">
          <p className="inspector-intro">Live outline of the AI asset to be generated.</p>
          <p className="detected">Auto-detected as: <strong>{asset?.type || "Agent"}</strong></p>
          <div className="outline-list">{outline.map((item) => <OutlineItem item={item} key={item.title} />)}</div>
          <button type="button" className="configuration-row"><BracketsCurly size={22} aria-hidden="true" />Configuration<CaretDown size={17} aria-hidden="true" /></button>
        </div>
      ) : (
        <div className="result-content">
          <div className="result-icon"><Robot size={32} weight="duotone" aria-hidden="true" /></div>
          <span className="result-label">Generated {asset?.type || "agent"}</span>
          <h3>{asset?.title || "Sustainable Skincare Launch Strategist"}</h3>
          <p>{asset?.summary || "Plans and coordinates a focused multi-channel product launch for eco-conscious beauty audiences."}</p>
          {(asset?.sections || []).slice(0, 3).map((section, index) => (
            <div className="result-block" key={section.label}>
              {index === 0 ? <Lightbulb size={20} /> : <CirclesFour size={20} />}
              <div><strong>{section.label}</strong><span>{section.content}</span></div>
            </div>
          ))}
          {asset ? <button type="button" className="open-agent-button" onClick={() => exportAsset(asset)}>Export JSON <ArrowRight size={18} /></button> : null}
        </div>
      )}
    </aside>
  );
}

function LibraryView({ assets, onOpen, onDelete, onShare, accessToken }) {
  const [filter, setFilter] = useState("All");
  const filters = ["All", "Prompt", "Skill", "Agent"];
  const visibleAssets = filter === "All" ? assets : assets.filter((asset) => asset.type === filter);

  return (
    <section className="library-view">
      <header className="library-header">
        <div><h1>Your Library</h1><p>Saved prompts, skills, and agents stay available in this browser.</p></div>
        <div className="library-count"><strong>{assets.length}</strong><span>saved assets</span></div>
      </header>
      <div className="filter-tabs" role="tablist" aria-label="Library asset type">
        {filters.map((item) => <button type="button" role="tab" aria-selected={filter === item} className={filter === item ? "active" : ""} onClick={() => setFilter(item)} key={item}>{item}</button>)}
      </div>
      <ReleasePromotionPanel assets={assets} accessToken={accessToken} />
      {visibleAssets.length ? (
        <div className="asset-list">
          {visibleAssets.map((asset) => (
            <article className={`asset-row asset-${asset.type.toLowerCase()}`} key={asset.id}>
              <div className="asset-type-icon">{asset.type === "Prompt" ? <ChatCircleDots size={22} /> : asset.type === "Skill" ? <Wrench size={22} /> : <Briefcase size={22} />}</div>
              <div className="asset-copy"><span>{asset.type} · v{asset.version}</span><h2>{asset.title}</h2><p>{asset.summary}</p></div>
              <div className="asset-actions"><button type="button" onClick={() => onOpen(asset)}>Open</button><button type="button" onClick={() => onShare(asset)}><ShareNetwork size={14} /> Share</button><button type="button" onClick={() => exportAsset(asset)}>Export</button><button type="button" className="danger" onClick={() => onDelete(asset.id)}>Delete</button></div>
            </article>
          ))}
        </div>
      ) : (
        <div className="empty-library"><Books size={38} weight="duotone" /><h2>No {filter === "All" ? "saved assets" : `${filter.toLowerCase()}s`} yet</h2><p>Generate a capability and it will appear here automatically.</p></div>
      )}
    </section>
  );
}

function ReleasePromotionPanel({assets,accessToken}) {
  const [releases,setReleases]=useState([]);const [assetId,setAssetId]=useState(assets[0]?.id||"");const [busy,setBusy]=useState(false);
  useEffect(()=>{if(accessToken)loadReleases(accessToken).then(setReleases);else setReleases([]);},[accessToken]);
  useEffect(()=>{if(!assets.some((item)=>item.id===assetId))setAssetId(assets[0]?.id||"");},[assets,assetId]);
  const act=async(action)=>{setBusy(true);const updated=await action();if(updated)setReleases(updated);setBusy(false);};
  const pending=releases.filter((item)=>item.status==="pending");const production=releases.filter((item)=>item.status==="approved");const rollback=releases.find((item)=>item.status==="superseded");
  return <section className="release-panel"><header><div><h2>Environment promotion</h2><p>Submit an immutable staging snapshot, approve production, or restore a previous release.</p></div><span>{production.length} production</span></header>{accessToken?<><div className="release-compose"><select value={assetId} onChange={(event)=>setAssetId(event.target.value)}>{assets.map((asset)=><option value={asset.id} key={asset.id}>{asset.title} · v{asset.version}</option>)}</select><button type="button" disabled={busy||!assetId||pending.some((item)=>item.assetId===assetId)} onClick={()=>act(()=>requestPromotion(accessToken,assetId))}><Flag size={14}/> Submit to staging</button>{rollback?<button type="button" className="release-rollback" disabled={busy} onClick={()=>act(()=>rollbackRelease(accessToken,rollback.id))}><ClockCounterClockwise size={14}/> Roll back v{rollback.version}</button>:null}</div>{pending.map((release)=>{const asset=assets.find((item)=>item.id===release.assetId);return <article className="release-review" key={release.id}><div><strong>{asset?.title||"Asset"} · v{release.version}</strong><span>Staging snapshot awaiting owner approval</span></div><button type="button" onClick={()=>act(()=>decidePromotion(accessToken,release.id,"reject"))}>Reject</button><button type="button" className="release-approve" onClick={()=>act(()=>decidePromotion(accessToken,release.id,"approve"))}><Check size={13}/> Promote</button></article>;})}</>:<div className="release-empty"><ShieldCheck size={21}/><span>Sign in to manage controlled production releases.</span></div>}</section>;
}

const buildCommunityCatalog = (publishedListings) => [...publishedListings.map((listing) => ({ id: `published-${listing.id}`, type: listing.type, category: listing.category, title: listing.title, summary: listing.description, creator: "Community Creator", rating: 5, installs: 0, price: listing.cost === "Paid" ? 999 : 0, version: 1, sourceIntent: listing.description, sections: [{ label: "Permissions", content: listing.permissions.join(", ") }, { label: "Platform", content: listing.platform }, { label: "Cost", content: listing.cost }] })), ...marketplaceAssets].map((asset) => ({ ...asset, price: asset.price ?? ({ "cinematic-storyboard": 899, "product-spec": 1499 }[asset.id] || 0) }));

function MarketplaceView({ installedAssets, publishedListings, reviews, purchases, accessToken, onReview, onReport, onPurchase, onInstall, onOpenInstalled, onOpenCreator }) {
  const [query, setQuery] = useState("");
  const [type, setType] = useState("All");
  const [category, setCategory] = useState("All categories");
  const [selected, setSelected] = useState(null);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewText, setReviewText] = useState("");
  const [reportReason, setReportReason] = useState("");
  const [communityMode, setCommunityMode] = useState("reviews");
  const [checkoutAsset, setCheckoutAsset] = useState(null);
  const [checkoutError, setCheckoutError] = useState("");
  const catalog = buildCommunityCatalog(publishedListings).map((asset) => ({ ...asset, rating: averageRating(asset, reviews) }));
  const installedIds = new Set(installedAssets.map((asset) => asset.marketplaceSourceId).filter(Boolean));
  const visible = catalog.filter((asset) => {
    const searchable = `${asset.title} ${asset.summary} ${asset.creator} ${asset.category}`.toLowerCase();
    return (type === "All" || asset.type === type) && (category === "All categories" || asset.category === category) && searchable.includes(query.trim().toLowerCase());
  });
  const featured = catalog[0];

  const install = (asset) => {
    if (asset.price && !purchases.some((item) => item.assetId === asset.id)) {
      setCheckoutAsset(asset);
      return;
    }
    const installed = onInstall(asset);
    setSelected({ ...asset, installedAsset: installed });
  };

  return <section className="marketplace-view">
    <header className="marketplace-header"><div><h1>Capability Marketplace</h1><p>Discover proven Prompts, Skills, and Agents. Fork any capability into your workspace.</p></div><div className="marketplace-total"><strong>{catalog.length}</strong><span>live capabilities</span></div></header>
    <article className="marketplace-featured">
      <div><span className="featured-label"><Sparkle size={15} weight="fill" /> Editor’s choice</span><h2>{featured.title}</h2><p>{featured.summary}</p><div className="marketplace-meta"><span>{featured.type}</span><span>{featured.category}</span><span><Star size={14} weight="fill" /> {featured.rating}</span></div><button type="button" onClick={() => setSelected(featured)}>Explore capability <ArrowRight size={17} /></button></div>
      <div className="featured-orbit" aria-hidden="true"><Robot size={56} weight="duotone" /><i /><i /></div>
    </article>
    <div className="marketplace-toolbar">
      <label className="marketplace-search"><span className="sr-only">Search marketplace</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search capabilities, creators, or categories…" /></label>
      <select aria-label="Category" value={category} onChange={(event) => setCategory(event.target.value)}><option>All categories</option>{marketplaceCategories.map((item) => <option key={item}>{item}</option>)}</select>
    </div>
    <div className="filter-tabs marketplace-tabs" role="tablist" aria-label="Marketplace asset type">{["All", "Prompt", "Skill", "Agent"].map((item) => <button type="button" role="tab" aria-selected={type === item} className={type === item ? "active" : ""} onClick={() => setType(item)} key={item}>{item}</button>)}</div>
    <div className="marketplace-result-heading"><h2>{query ? `Results for “${query}”` : "Curated for you"}</h2><span>{visible.length} results</span></div>
    {visible.length ? <div className="marketplace-grid">{visible.map((asset) => {
      const installed = installedIds.has(asset.id);
      const Icon = asset.type === "Prompt" ? ChatCircleDots : asset.type === "Skill" ? Wrench : Briefcase;
      return <article className={`marketplace-card market-${asset.type.toLowerCase()}`} key={asset.id}><div className="marketplace-card-top"><div className="marketplace-icon"><Icon size={24} weight="duotone" /></div><span>{asset.price ? money(asset.price) : asset.type}</span></div><div className="marketplace-card-copy"><span>{asset.category}</span><h3>{asset.title}</h3><p>{asset.summary}</p></div><div className="marketplace-card-stats"><span><Star size={14} weight="fill" /> {asset.rating}</span><span>{asset.installs.toLocaleString()} installs</span></div><footer><span>by {asset.creator}</span><button type="button" onClick={() => setSelected(asset)}>{installed ? "Installed" : purchases.some((item) => item.assetId === asset.id) ? "Purchased" : "View details"}</button></footer></article>;
    })}</div> : <div className="empty-marketplace"><Funnel size={34} weight="duotone" /><h2>No matching capabilities</h2><p>Try another keyword or remove a filter.</p></div>}
    {selected ? <div className="dialog-backdrop marketplace-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelected(null); }}><section className="marketplace-detail" role="dialog" aria-modal="true" aria-labelledby="marketplace-detail-title"><button type="button" className="dialog-close" onClick={() => setSelected(null)} aria-label="Close marketplace details"><X size={20} /></button><div className="detail-type"><span>{selected.type}</span><span>{selected.category}</span></div><h2 id="marketplace-detail-title">{selected.title}</h2><p>{selected.summary}</p><div className="detail-author"><button type="button" onClick={() => onOpenCreator(selected.creator)}>{selected.creator} <ArrowRight size={13} /></button><span><Star size={14} weight="fill" /> {selected.rating} · {selected.installs.toLocaleString()} installs</span></div><div className="detail-sections">{selected.sections.map((section) => <article key={section.label}><strong>{section.label}</strong><p>{section.content}</p></article>)}</div>{installedIds.has(selected.id) || selected.installedAsset ? <button type="button" className="marketplace-install installed" onClick={() => onOpenInstalled(selected.installedAsset || installedAssets.find((asset) => asset.marketplaceSourceId === selected.id))}><Check size={18} weight="bold" /> Open installed capability</button> : <button type="button" className="marketplace-install" onClick={() => install(selected)}><PlusSquare size={18} weight="bold" /> Install & fork to Library</button>}<small>Creates your own editable copy. The original template stays unchanged.</small><section className="community-panel"><div className="community-tabs"><button type="button" className={communityMode === "reviews" ? "active" : ""} onClick={() => setCommunityMode("reviews")}>Ratings & reviews</button><button type="button" className={communityMode === "report" ? "active" : ""} onClick={() => setCommunityMode("report")}>Report</button></div>{communityMode === "reviews" ? <><div className="rating-input">{[1,2,3,4,5].map((value) => <button type="button" aria-label={`${value} stars`} onClick={() => setReviewRating(value)} key={value}><Star size={18} weight={value <= reviewRating ? "fill" : "regular"} /></button>)}</div><textarea aria-label="Review" value={reviewText} onChange={(event) => setReviewText(event.target.value)} placeholder="Share a useful experience with this capability…" /><button type="button" className="community-submit" disabled={reviewText.trim().length < 12} onClick={() => { onReview(selected.id, reviewRating, reviewText); setReviewText(""); }}>Publish review</button><div className="review-list">{reviews.filter((item) => item.assetId === selected.id).slice(0,3).map((review) => <article key={review.id}><span><Star size={12} weight="fill" /> {review.rating}.0</span><p>{review.text}</p><small>Verified workspace user</small></article>)}</div></> : <><select aria-label="Report reason" value={reportReason} onChange={(event) => setReportReason(event.target.value)}><option value="">Select a reason</option><option>Unsafe behavior</option><option>Misleading description</option><option>Copyright concern</option><option>Spam or low quality</option></select><button type="button" className="community-submit report" disabled={!reportReason} onClick={() => { onReport(selected.id, reportReason); setReportReason(""); setCommunityMode("reviews"); }}>Submit confidential report</button></>}</section></section></div> : null}
    {checkoutAsset ? <div className="dialog-backdrop marketplace-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setCheckoutAsset(null); }}><section className="checkout-dialog" role="dialog" aria-modal="true" aria-labelledby="checkout-title"><button type="button" className="dialog-close" onClick={() => setCheckoutAsset(null)} aria-label="Close checkout"><X size={20} /></button><Wallet size={30} weight="duotone" /><span>Secure checkout</span><h2 id="checkout-title">Complete your purchase</h2><div className="checkout-product"><strong>{checkoutAsset.title}</strong><span>{checkoutAsset.type} by {checkoutAsset.creator}</span></div><div className="checkout-total"><span>Total</span><strong>{money(checkoutAsset.price)}</strong></div><p>Payment opens in Stripe-hosted Checkout. Verified purchases unlock from your secure account entitlement.</p>{checkoutError ? <div className="auth-notice">{checkoutError}</div> : null}<button type="button" className="checkout-pay" onClick={async () => { setCheckoutError(""); try { const checkoutSession = await createCheckoutSession(checkoutAsset.id, accessToken); if (checkoutSession?.url) window.location.assign(checkoutSession.url); else { onPurchase(checkoutAsset); setCheckoutAsset(null); } } catch (error) { setCheckoutError(error.message); } }}>Continue to secure checkout <ArrowRight size={16} /></button></section></div> : null}
  </section>;
}

function CreatorsView({ publishedListings, reviews, selectedCreator, onOpenMarketplace }) {
  const catalog = buildCommunityCatalog(publishedListings).map((asset) => ({ ...asset, rating: averageRating(asset, reviews) }));
  const creators = Array.from(new Set(catalog.map((asset) => asset.creator))).map((name) => { const assets = catalog.filter((asset) => asset.creator === name); return { name, assets, installs: assets.reduce((sum, asset) => sum + asset.installs, 0), rating: Number((assets.reduce((sum, asset) => sum + asset.rating, 0) / assets.length).toFixed(1)), verified: ["IntentOS Studio", "DevFoundry", "Community Creator"].includes(name) }; }).sort((a,b) => Number(b.name === selectedCreator) - Number(a.name === selectedCreator));
  return <section className="creators-view"><header className="creators-header"><div><h1>Creator Network</h1><p>Discover trusted builders behind the Marketplace’s most useful AI capabilities.</p></div><div><strong>{creators.length}</strong><span>active creators</span></div></header><div className="creator-grid">{creators.map((creator) => <article className={creator.name === selectedCreator ? "selected" : ""} key={creator.name}><header><div className="creator-avatar">{creator.name.split(" ").map((item) => item[0]).slice(0,2).join("")}</div><div><h2>{creator.name}</h2><span>{creator.verified ? <><ShieldCheck size={13} weight="fill" /> Verified creator</> : "Independent creator"}</span></div></header><p>Building practical, production-minded capabilities for modern AI workflows.</p><div className="creator-metrics"><span><strong>{creator.assets.length}</strong> capabilities</span><span><strong>{creator.rating}</strong> rating</span><span><strong>{creator.installs.toLocaleString()}</strong> installs</span></div><div className="creator-assets">{creator.assets.slice(0,2).map((asset) => <span key={asset.id}>{asset.type} · {asset.title}</span>)}</div><button type="button" onClick={onOpenMarketplace}>Browse capabilities <ArrowRight size={15} /></button></article>)}</div></section>;
}

const permissionOptions = ["User-provided input", "Workspace data", "External API access", "File access"];

function PublishingView({ assets, listings, onChange, accessToken }) {
  const [editingId, setEditingId] = useState(null);
  const [assetId, setAssetId] = useState(assets[0]?.id || "");
  const editing = listings.find((item) => item.id === editingId) || null;

  const createDraft = () => {
    const asset = assets.find((item) => item.id === assetId);
    if (!asset) return;
    const draft = newListing(asset);
    onChange([draft, ...listings]);
    setEditingId(draft.id);
  };
  const update = (changes) => onChange(listings.map((item) => item.id === editingId ? { ...item, ...changes, scan: changes.scan === undefined ? null : changes.scan, status: item.status === "Submitted" ? "Submitted" : "Draft", updatedAt: new Date().toISOString() } : item));
  const runScan = () => {
    const asset = assets.find((item) => item.id === editing.assetId);
    update({ scan: scanListing(editing, asset) });
  };
  const submit = () => {onChange(listings.map((item) => item.id === editingId ? { ...item, status: "Submitted", submittedAt: new Date().toISOString(), updatedAt: new Date().toISOString() } : item));trackActivation(accessToken,"asset_published",{assetId:editing.assetId,properties:{assetType:editing.type,source:"publishing"}});};

  return <section className="publishing-view">
    <header className="publishing-header"><div><h1>Creator Publishing</h1><p>Prepare trustworthy marketplace listings, run safety checks, and submit capabilities for review.</p></div><div className="publishing-stats"><div><strong>{listings.length}</strong><span>Total listings</span></div><div><strong>{listings.filter((item) => item.status === "Submitted").length}</strong><span>In review</span></div></div></header>
    <div className="publish-pipeline" aria-label="Publishing workflow"><div className="active"><PencilSimple size={18} /><span><strong>1. Draft</strong><small>Listing details</small></span></div><i /><div className={editing?.scan?.passed ? "active" : ""}><ShieldCheck size={18} /><span><strong>2. Safety scan</strong><small>Schema & risk</small></span></div><i /><div className={editing?.status === "Submitted" ? "active" : ""}><PaperPlaneTilt size={18} /><span><strong>3. Review</strong><small>Moderation queue</small></span></div></div>
    {!assets.length ? <div className="empty-library"><Storefront size={40} weight="duotone" /><h2>Create an asset before publishing</h2><p>Your Prompt, Skill, or Agent needs to be saved in Library first.</p></div> : <>
      <section className="new-listing-bar"><div><strong>Publish from your Library</strong><span>Select an editable capability to create a marketplace draft.</span></div><select aria-label="Capability to publish" value={assetId} onChange={(event) => setAssetId(event.target.value)}>{assets.map((asset) => <option value={asset.id} key={asset.id}>{asset.type} · {asset.title}</option>)}</select><button type="button" onClick={createDraft}><PlusSquare size={17} /> Create draft</button></section>
      <div className="publishing-layout">
        <section className="listing-queue"><header><h2>Your listings</h2><span>{listings.length}</span></header>{listings.length ? listings.map((listing) => <button type="button" className={editingId === listing.id ? "active" : ""} onClick={() => setEditingId(listing.id)} key={listing.id}><span className={`listing-status ${listing.status.toLowerCase()}`}>{listing.status}</span><strong>{listing.title}</strong><small>{listing.type} · Updated {new Date(listing.updatedAt).toLocaleDateString()}</small></button>) : <div className="listing-empty"><Storefront size={28} /><p>No listing drafts yet.</p></div>}</section>
        {editing ? <section className="listing-editor"><header><div><span>{editing.type} listing</span><h2>{editing.title}</h2></div><span className={`listing-status ${editing.status.toLowerCase()}`}>{editing.status}</span></header>
          <label>Description<textarea value={editing.description} disabled={editing.status === "Submitted"} onChange={(event) => update({ description: event.target.value })} /><small>{editing.description.length} characters · Minimum 40</small></label>
          <div className="editor-grid"><label>Category<select value={editing.category} disabled={editing.status === "Submitted"} onChange={(event) => update({ category: event.target.value })}>{marketplaceCategories.map((item) => <option key={item}>{item}</option>)}</select></label><label>Cost expectation<select value={editing.cost} disabled={editing.status === "Submitted"} onChange={(event) => update({ cost: event.target.value })}><option>Free</option><option>Free with external costs</option><option>Paid</option></select></label><label>Supported platform<select value={editing.platform} disabled={editing.status === "Submitted"} onChange={(event) => update({ platform: event.target.value })}><option>OpenAI-compatible</option><option>Provider agnostic</option><option>IntentOS only</option></select></label><label>Visibility<select value={editing.visibility} disabled={editing.status === "Submitted"} onChange={(event) => update({ visibility: event.target.value })}><option>Public</option><option>Unlisted</option></select></label></div>
          <fieldset disabled={editing.status === "Submitted"}><legend>Permissions and data access</legend><p>Select everything this capability may access.</p><div className="permission-grid">{permissionOptions.map((permission) => <label key={permission}><input type="checkbox" checked={editing.permissions.includes(permission)} onChange={(event) => update({ permissions: event.target.checked ? [...editing.permissions, permission] : editing.permissions.filter((item) => item !== permission) })} /><span><Check size={13} weight="bold" />{permission}</span></label>)}</div></fieldset>
          {editing.scan ? <section className={`scan-result ${editing.scan.passed ? "passed" : "failed"}`}><header>{editing.scan.passed ? <ShieldCheck size={22} /> : <Warning size={22} />}<div><strong>{editing.scan.passed ? "Ready for review" : "Action required"}</strong><span>{editing.scan.risk} permission risk · {editing.scan.checks.filter((check) => check.passed).length}/{editing.scan.checks.length} checks passed</span></div></header><div>{editing.scan.checks.map((check) => <span className={check.passed ? "passed" : "failed"} key={check.id}>{check.passed ? <Check size={13} /> : <X size={13} />}{check.label}</span>)}</div></section> : <div className="scan-placeholder"><ShieldCheck size={22} /><div><strong>Automated trust scan</strong><span>Validate schema, disclosures, permissions, platform, and cost information.</span></div></div>}
          <footer className="editor-actions">{editing.status === "Submitted" ? <div className="submitted-message"><ClockCounterClockwise size={18} /><span><strong>Review in progress</strong><small>Changes are locked while moderators review this listing.</small></span></div> : <><button type="button" className="scan-button" onClick={runScan}><ShieldCheck size={17} /> Run safety scan</button><button type="button" className="submit-listing" disabled={!editing.scan?.passed} onClick={submit}><PaperPlaneTilt size={17} /> Submit for review</button></>}</footer>
        </section> : <section className="editor-empty"><PencilSimple size={32} weight="duotone" /><h2>Select a listing to edit</h2><p>Or create a new draft from one of your Library assets.</p></section>}
      </div>
    </>}
  </section>;
}

function ModerationView({ listings, onChange, onOpenMarketplace }) {
  const reviewable = listings.filter((item) => ["Submitted", "Approved", "Changes requested", "Rejected"].includes(item.status));
  const [filter, setFilter] = useState("Queue");
  const filtered = filter === "Queue" ? reviewable.filter((item) => item.status === "Submitted") : filter === "All" ? reviewable : reviewable.filter((item) => item.status === filter);
  const [selectedId, setSelectedId] = useState(reviewable.find((item) => item.status === "Submitted")?.id || reviewable[0]?.id || null);
  const [note, setNote] = useState("");
  const selected = listings.find((item) => item.id === selectedId) || null;
  const decide = (status) => {
    if ((status === "Changes requested" || status === "Rejected") && note.trim().length < 10) return;
    onChange(listings.map((item) => item.id === selectedId ? { ...item, status, reviewNote: note.trim(), reviewedAt: new Date().toISOString(), updatedAt: new Date().toISOString() } : item));
  };
  return <section className="moderation-view">
    <header className="moderation-header"><div><h1>Moderation Console</h1><p>Review trust disclosures, assess permission risk, and make accountable publishing decisions.</p></div><div className="moderation-summary"><article><strong>{reviewable.filter((item) => item.status === "Submitted").length}</strong><span>Waiting</span></article><article><strong>{reviewable.filter((item) => item.status === "Approved").length}</strong><span>Approved</span></article><article><strong>{reviewable.filter((item) => item.status === "Rejected").length}</strong><span>Rejected</span></article></div></header>
    <div className="moderation-tabs filter-tabs" role="tablist" aria-label="Moderation status">{["Queue", "All", "Approved", "Changes requested", "Rejected"].map((item) => <button type="button" role="tab" aria-selected={filter === item} className={filter === item ? "active" : ""} onClick={() => setFilter(item)} key={item}>{item}</button>)}</div>
    <div className="moderation-layout"><section className="review-queue"><header><h2>Review queue</h2><span>{filtered.length}</span></header>{filtered.length ? filtered.map((listing) => <button type="button" className={selectedId === listing.id ? "active" : ""} onClick={() => { setSelectedId(listing.id); setNote(listing.reviewNote || ""); }} key={listing.id}><div><span className={`listing-status ${listing.status.toLowerCase().replace(" ", "-")}`}>{listing.status}</span><small>{listing.scan?.risk || "unknown"} risk</small></div><strong>{listing.title}</strong><p>{listing.description}</p><small>{listing.type} · {listing.category}</small></button>) : <div className="moderation-empty"><ShieldCheck size={32} weight="duotone" /><h3>Queue is clear</h3><p>No listings match this status.</p></div>}</section>
      {selected ? <section className="review-inspector"><header><div><span>{selected.type} · {selected.category}</span><h2>{selected.title}</h2></div><span className={`listing-status ${selected.status.toLowerCase().replace(" ", "-")}`}>{selected.status}</span></header><p className="review-description">{selected.description}</p>
        <div className="risk-overview"><div className={`risk-badge ${selected.scan?.risk}`}><ShieldCheck size={21} /><span><strong>{selected.scan?.risk || "Unknown"} risk</strong><small>Automated assessment</small></span></div><div><span>Visibility<strong>{selected.visibility}</strong></span><span>Cost<strong>{selected.cost}</strong></span><span>Platform<strong>{selected.platform}</strong></span></div></div>
        <section className="review-disclosures"><h3>Permissions & data access</h3><div>{selected.permissions.map((permission) => <span key={permission}><Check size={13} />{permission}</span>)}</div></section>
        <section className="review-checks"><h3>Automated checks</h3>{selected.scan?.checks.map((check) => <div key={check.id}>{check.passed ? <Check size={14} /> : <X size={14} />}<span>{check.label}</span><strong>{check.passed ? "Passed" : "Failed"}</strong></div>)}</section>
        {selected.status === "Submitted" ? <><label className="review-note">Reviewer note<textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="Explain required changes or rejection rationale…" /><small>Required for changes requested or rejection · minimum 10 characters</small></label><footer className="decision-actions"><button type="button" className="reject" disabled={note.trim().length < 10} onClick={() => decide("Rejected")}><X size={16} /> Reject</button><button type="button" className="request-changes" disabled={note.trim().length < 10} onClick={() => decide("Changes requested")}><Warning size={16} /> Request changes</button><button type="button" className="approve" onClick={() => decide("Approved")}><Check size={16} /> Approve & publish</button></footer></> : <div className={`decision-result ${selected.status.toLowerCase().replace(" ", "-")}`}><Gavel size={21} /><div><strong>{selected.status}</strong><span>{selected.reviewNote || (selected.status === "Approved" ? "Listing is now live in Marketplace." : "Moderation decision recorded.")}</span></div>{selected.status === "Approved" ? <button type="button" onClick={onOpenMarketplace}>View live listing <ArrowRight size={15} /></button> : null}</div>}
      </section> : <section className="editor-empty"><Gavel size={34} weight="duotone" /><h2>Select a listing to review</h2><p>Submitted creator listings will appear in the queue.</p></section>}
    </div>
  </section>;
}

function ReportTriageView({ reports, publishedListings, onChange }) {
  const catalog = buildCommunityCatalog(publishedListings);
  const [filter, setFilter] = useState("Open");
  const visible = filter === "All" ? reports : reports.filter((report) => report.status === filter);
  const [selectedId, setSelectedId] = useState(reports.find((report) => report.status === "Open")?.id || reports[0]?.id || null);
  const [note, setNote] = useState("");
  const selected = reports.find((report) => report.id === selectedId) || null;
  const asset = selected ? catalog.find((item) => item.id === selected.assetId) : null;
  const decide = (status) => onChange(reports.map((report) => report.id === selectedId ? { ...report, status, resolutionNote: note.trim(), reviewedAt: new Date().toISOString() } : report));
  return <section className="report-triage-view"><header className="report-header"><div><h1>Report Triage</h1><p>Investigate confidential community reports and record consistent, auditable outcomes.</p></div><div className="report-summary"><article><strong>{reports.filter((item) => item.status === "Open").length}</strong><span>Open</span></article><article><strong>{reports.filter((item) => item.status === "Escalated").length}</strong><span>Escalated</span></article><article><strong>{reports.filter((item) => item.status === "Resolved").length}</strong><span>Resolved</span></article></div></header>
    <div className="filter-tabs report-tabs" role="tablist" aria-label="Report status">{["Open","All","Escalated","Resolved","Dismissed"].map((item) => <button type="button" role="tab" aria-selected={filter === item} className={filter === item ? "active" : ""} onClick={() => setFilter(item)} key={item}>{item}</button>)}</div>
    <div className="report-layout"><section className="report-queue"><header><h2>Community reports</h2><span>{visible.length}</span></header>{visible.length ? visible.map((report) => { const item = catalog.find((entry) => entry.id === report.assetId); return <button type="button" className={selectedId === report.id ? "active" : ""} onClick={() => { setSelectedId(report.id); setNote(report.resolutionNote || ""); }} key={report.id}><div><span className={`report-status ${report.status.toLowerCase()}`}>{report.status}</span><small>{new Date(report.createdAt).toLocaleDateString()}</small></div><strong>{report.reason}</strong><p>{item?.title || "Marketplace capability"}</p><small>Confidential community report</small></button>; }) : <div className="moderation-empty"><ShieldCheck size={32} weight="duotone" /><h3>Queue is clear</h3><p>No reports match this status.</p></div>}</section>
      {selected ? <section className="report-inspector"><header><div><span>Report case</span><h2>{selected.reason}</h2></div><span className={`report-status ${selected.status.toLowerCase()}`}>{selected.status}</span></header><section className="reported-asset"><div className="marketplace-icon"><Flag size={23} weight="duotone" /></div><div><span>{asset?.type || "Capability"} · {asset?.category || "Marketplace"}</span><h3>{asset?.title || "Unavailable capability"}</h3><p>by {asset?.creator || "Unknown creator"}</p></div></section><div className="report-facts"><span>Reported<strong>{new Date(selected.createdAt).toLocaleString()}</strong></span><span>Reason<strong>{selected.reason}</strong></span><span>Visibility<strong>Confidential</strong></span></div><section className="triage-guidance"><Warning size={21} /><div><strong>Investigation checklist</strong><p>Compare the listing description with actual behavior, inspect permissions and prior moderation history, then record the least disruptive justified outcome.</p></div></section>
        {selected.status === "Open" ? <><label className="triage-note">Internal resolution note<textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="Record evidence reviewed and decision rationale…" /><small>Minimum 12 characters required for a final decision.</small></label><footer className="triage-actions"><button type="button" className="dismiss" disabled={note.trim().length < 12} onClick={() => decide("Dismissed")}><X size={16} /> Dismiss</button><button type="button" className="escalate" disabled={note.trim().length < 12} onClick={() => decide("Escalated")}><Warning size={16} /> Escalate</button><button type="button" className="resolve" disabled={note.trim().length < 12} onClick={() => decide("Resolved")}><Check size={16} /> Resolve</button></footer></> : <div className={`triage-result ${selected.status.toLowerCase()}`}><Flag size={21} /><div><strong>{selected.status}</strong><span>{selected.resolutionNote || "Decision recorded."}</span></div></div>}
      </section> : <section className="editor-empty"><Flag size={34} weight="duotone" /><h2>Select a report</h2><p>Open community reports will appear in this queue.</p></section>}
    </div></section>;
}

function EarningsView({ purchases }) {
  const gross = purchases.reduce((sum,item) => sum + item.amount, 0);
  const fees = Math.round(gross * PLATFORM_FEE_RATE);
  const net = gross - fees;
  return <section className="earnings-view"><header className="earnings-header"><div><h1>Creator Earnings</h1><p>Track paid capability sales, platform fees, and creator payout readiness.</p></div><span><ShieldCheck size={17} /> Stripe Connect ready</span></header><div className="earnings-metrics"><article><span>Gross sales</span><strong>{money(gross)}</strong><small>{purchases.length} successful purchases</small></article><article><span>Platform fee · 15%</span><strong>{money(fees)}</strong><small>Marketplace operations and trust</small></article><article className="net"><span>Creator net</span><strong>{money(net)}</strong><small>Available after payment settlement</small></article></div><section className="connect-banner"><div className="connect-icon"><Wallet size={27} weight="duotone" /></div><div><h2>Creator payout account</h2><p>Production onboarding uses Stripe Accounts v2 with explicit responsibility, dashboard, and capability settings.</p></div><button type="button">Configure payout account <ArrowRight size={15} /></button></section><section className="transaction-panel"><header><div><h2>Sales ledger</h2><p>Completed Checkout Session entitlements.</p></div><span>{purchases.length} transactions</span></header>{purchases.length ? <div className="transaction-list">{purchases.map((purchase) => <article key={purchase.id}><div className="sale-icon"><Money size={19} /></div><div><strong>{purchase.title}</strong><span>{purchase.creator} · {purchase.mode}</span></div><time>{new Date(purchase.createdAt).toLocaleDateString()}</time><strong>{money(purchase.amount)}</strong><span className="paid-status">Paid</span></article>)}</div> : <div className="moderation-empty"><Wallet size={34} weight="duotone" /><h3>No paid sales yet</h3><p>Test purchases from Marketplace will appear here.</p></div>}</section><footer className="payment-architecture"><ShieldCheck size={19} /><div><strong>Secure payment architecture</strong><span>Stripe-hosted Checkout Sessions · destination charges · Accounts v2 creator onboarding · webhook-verified entitlements</span></div></footer></section>;
}

function ScoreRing({ score }) {
  return <div className="score-ring" style={{ "--score": `${score * 3.6}deg` }}><strong>{score}</strong><span>/100</span></div>;
}

function PlaygroundView({ assets, versions, testSuites, runHistory, onTestSuitesChange, onRunRecorded, onImprove, accessToken }) {
  const [selectedId, setSelectedId] = useState(assets[0]?.id || "");
  const [testInput, setTestInput] = useState("Create a concise launch plan for a premium eco-friendly product aimed at young professionals.");
  const [run, setRun] = useState(null);
  const [running, setRunning] = useState(false);
  const [improving, setImproving] = useState(false);
  const [comparison, setComparison] = useState(null);
  const [labMode, setLabMode] = useState("suite");
  const selectedAsset = assets.find((asset) => asset.id === selectedId) || assets[0] || null;
  const evaluation = evaluateAsset(selectedAsset);

  const execute = async () => {
    if (!selectedAsset || !testInput.trim()) return;
    setRunning(true);
    const result = await runProviderEvaluation(selectedAsset, testInput);
    setRun(result);
    onRunRecorded(selectedAsset.id, { id: crypto.randomUUID(), input: testInput.trim(), quality: evaluation.overall, ...result });
    setRunning(false);
  };

  const improve = async () => {
    if (!selectedAsset) return;
    setImproving(true);
    const improved = await improveAsset(selectedAsset);
    onImprove(selectedAsset, improved);
    setComparison({ before: selectedAsset, after: improved });
    setImproving(false);
  };

  if (!selectedAsset) return <section className="playground-view"><div className="empty-library"><Flask size={40} weight="duotone" /><h2>Create an asset before testing</h2><p>Your saved Prompt, Skill, or Agent will become available here.</p></div></section>;

  return (
    <section className="playground-view">
      <header className="playground-header"><div><h1>Test Playground</h1><p>Run realistic inputs, improve assets, and compare versions before production use.</p></div><ScoreRing score={evaluation.overall} /></header>
      <div className="playground-grid">
        <div className="test-console">
          <label htmlFor="asset-select">Asset</label>
          <select id="asset-select" value={selectedAsset.id} onChange={(event) => { setSelectedId(event.target.value); setRun(null); }}>
            {assets.map((asset) => <option value={asset.id} key={asset.id}>{asset.type} · {asset.title}</option>)}
          </select>
          <label htmlFor="test-input">Sample input</label>
          <textarea id="test-input" value={testInput} onChange={(event) => setTestInput(event.target.value)} />
          <button type="button" className="run-test-button" onClick={execute} disabled={running || !testInput.trim()}>{running ? <span className="spinner" /> : <Flask size={19} />}{running ? "Running test…" : "Run test"}</button>
        </div>
        <aside className="quality-panel">
          <h2>Quality profile</h2>
          <div className="quality-bars">{evaluation.dimensions.map((item) => <div className="quality-row" key={item.label}><span>{item.label}</span><div><i style={{ width: `${item.score}%` }} /></div><strong>{item.score}</strong></div>)}</div>
          <h3>Recommended improvements</h3>
          <ul>{evaluation.suggestions.map((suggestion) => <li key={suggestion}>{suggestion}</li>)}</ul>
          <button type="button" className="improve-button" onClick={improve} disabled={improving}>{improving ? <span className="spinner" /> : <Sparkle size={18} />}{improving ? "Improving…" : "Auto improve"}</button>
        </aside>
      </div>
      <div className={`test-output ${run ? "has-result" : ""}`}>
        <div className="test-output-heading"><div><span>Test output</span><strong>{run ? (run.live ? "Live provider" : "Local fallback") : "Waiting to run"}</strong></div>{run ? <span>{run.model}</span> : null}</div>
        <p>{run?.output || "Run the selected asset with a realistic sample input to inspect its response and quality profile."}</p>
      </div>
      <RunHistory runs={runHistory[selectedAsset.id] || []} />
      <EvaluationLab asset={selectedAsset} input={testInput} cases={testSuites[selectedAsset.id] || []} onCasesChange={(cases) => onTestSuitesChange(selectedAsset.id, cases)} mode={labMode} setMode={setLabMode} onTested={(assetId)=>trackActivation(accessToken,"asset_tested",{assetId,properties:{assetType:selectedAsset.type,source:"playground"}})} />
      {comparison ? <VersionComparison before={comparison.before} after={comparison.after} /> : <VersionHistory asset={selectedAsset} versions={versions[selectedAsset.id] || [selectedAsset]} />}
    </section>
  );
}

function RunHistory({ runs }) {
  if (!runs.length) return null;
  return <section className="run-history"><header><div><h2>Run history</h2><p>Recent executions are stored for traceability.</p></div><span>{runs.length} run{runs.length === 1 ? "" : "s"}</span></header><div>{runs.slice(0, 5).map((run) => <div className="run-row" key={run.id}><ClockCounterClockwise size={17} /><div><strong>{run.live ? "Live provider" : "Local fallback"} · {run.model}</strong><p>{run.input}</p></div><span>{run.latency}ms</span><time>{new Date(run.executedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</time></div>)}</div></section>;
}

function EvaluationLab({ asset, input, cases, onCasesChange, mode, setMode, onTested }) {
  const [draft, setDraft] = useState("");
  const [suiteResults, setSuiteResults] = useState([]);
  const [models, setModels] = useState([]);
  const [busy, setBusy] = useState(false);
  const [priority, setPriority] = useState("balanced");
  const recommendation = recommendRoute(models, priority);

  const addCase = () => {
    if (!draft.trim()) return;
    onCasesChange([...cases, { id: crypto.randomUUID(), name: `Case ${cases.length + 1}`, input: draft.trim() }]);
    setDraft("");
  };

  const runSuite = async () => {
    if (!cases.length) return;
    setBusy(true);
    setSuiteResults(await runTestSuite(asset, cases));
    onTested?.(asset.id);
    setBusy(false);
  };

  const runModels = async () => {
    if (!input.trim()) return;
    setBusy(true);
    const [profiles, providerRun] = await Promise.all([compareModels(asset, input), runProviderEvaluation(asset, input)]);
    setModels(providerRun.live
      ? profiles.map((profile, index) => index === 0 ? { ...profile, name: providerRun.model, latency: providerRun.latency, live: true } : profile)
      : profiles);
    setBusy(false);
  };

  return <section className="evaluation-lab">
    <header><div><h2>Evaluation lab</h2><p>Regression-test this asset or benchmark model profiles.</p></div><div className="lab-tabs"><button type="button" className={mode === "suite" ? "active" : ""} onClick={() => setMode("suite")}><ListChecks size={15} /> Test suite</button><button type="button" className={mode === "models" ? "active" : ""} onClick={() => setMode("models")}><Cpu size={15} /> Models</button></div></header>
    {mode === "suite" ? <div className="suite-panel">
      <div className="case-composer"><input aria-label="New test case" value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") addCase(); }} placeholder="Add a real-world test input…" /><button type="button" onClick={addCase} disabled={!draft.trim()}><PlusSquare size={16} /> Add case</button></div>
      {cases.length ? <div className="case-list">{cases.map((testCase) => { const result = suiteResults.find((item) => item.id === testCase.id); return <div className="case-row" key={testCase.id}><div><strong>{testCase.name}</strong><p>{testCase.input}</p></div>{result ? <span className={`case-status ${result.status.toLowerCase()}`}>{result.status} · {result.score}</span> : <span className="case-status idle">Not run</span>}<button type="button" aria-label={`Delete ${testCase.name}`} onClick={() => onCasesChange(cases.filter((item) => item.id !== testCase.id))}><Trash size={15} /></button></div>; })}</div> : <div className="lab-empty"><ListChecks size={25} /><p>Add representative inputs to create a reusable regression suite.</p></div>}
      <div className="lab-footer"><span>{cases.length} saved case{cases.length === 1 ? "" : "s"}</span><button type="button" className="lab-run" onClick={runSuite} disabled={busy || !cases.length}>{busy ? <span className="spinner" /> : <Flask size={16} />}{busy ? "Running suite…" : "Run all cases"}</button></div>
    </div> : <div className="model-panel">
      <div className="model-intro"><p>Benchmark the current sample input across speed, estimated cost, and response quality.</p><button type="button" className="lab-run" onClick={runModels} disabled={busy || !input.trim()}>{busy ? <span className="spinner" /> : <Cpu size={16} />}{busy ? "Comparing…" : "Compare models"}</button></div>
      {models.length ? <><div className="routing-bar"><label htmlFor="routing-priority">Optimize for</label><select id="routing-priority" value={priority} onChange={(event) => setPriority(event.target.value)}><option value="balanced">Balanced</option><option value="quality">Quality</option><option value="speed">Speed</option><option value="cost">Cost</option></select><p><Sparkle size={15} /><span>Recommended route</span><strong>{recommendation?.name}</strong></p></div><div className="model-table"><div className="model-table-head"><span>Model</span><span>Quality</span><span>Latency</span><span>Est. cost</span></div>{models.map((model) => <div className={`model-row ${model.id === recommendation?.id ? "best" : ""}`} key={model.id}><div><strong>{model.name}</strong><span>{model.provider}{model.live ? " · Live result" : " · Estimate"}</span></div><strong>{model.quality}</strong><span>{model.latency}ms</span><span>{model.cost}</span></div>)}</div></> : <div className="lab-empty"><Cpu size={25} /><p>Run a comparison to rank available model profiles.</p></div>}
    </div>}
  </section>;
}

function AgentExecutionView({ assets, accessToken }) {
  const agents = assets.filter((asset) => asset.type === "Agent");
  const fallbackAgent = { id: "market-research-agent", title: "Market Research Agent" };
  const availableAgents = agents.length ? agents : [fallbackAgent];
  const [agentId, setAgentId] = useState(availableAgents[0].id);
  const [mission, setMission] = useState("Research emerging AI startups and summarize the strongest market signals.");
  const [permissions, setPermissions] = useState({ web: true, workspace: true, external: false });
  const [runs, setRuns] = useState(() => loadAgentExecutions());
  const [activeRun, setActiveRun] = useState(null);
  const [busy, setBusy] = useState(false);
  const agent = availableAgents.find((item) => item.id === agentId) || availableAgents[0];

  useEffect(() => saveAgentExecutions(runs), [runs]);
  useEffect(() => {
    if (!accessToken) return;
    let active = true;
    loadCloudAgentExecutions(accessToken).then((cloudRuns) => {
      if (!active || !cloudRuns.length) return;
      setRuns(cloudRuns);
      const awaiting = cloudRuns.find((run) => run.stage === "approval");
      if (awaiting) setActiveRun(awaiting);
    });
    return () => { active = false; };
  }, [accessToken]);
  useEffect(() => {
    if (!accessToken || !activeRun?.cloud || !["running","tool_approval"].includes(activeRun.stage)) return;
    const interval = window.setInterval(() => loadCloudAgentExecutions(accessToken).then((cloudRuns) => {
      const refreshed = cloudRuns.find((run) => run.id === activeRun.id);
      if (!refreshed) return;
      setRuns(cloudRuns);
      setActiveRun(refreshed);
    }), 1500);
    return () => window.clearInterval(interval);
  }, [accessToken, activeRun?.id, activeRun?.stage, activeRun?.cloud]);
  const start = async () => {
    if (mission.trim().length < 12) return;
    setBusy(true);
    const key = crypto.randomUUID();
    const cloudRun = await createCloudExecution(accessToken, agent, mission.trim(), permissions, key).catch(() => null);
    setActiveRun(cloudRun || createExecution(agent, mission.trim(), permissions));
    setBusy(false);
  };
  const decide = async (approved) => {
    setBusy(true);
    const cloudRun = activeRun.cloud ? await decideCloudExecution(accessToken, activeRun.id, approved).catch(() => null) : null;
    const completed = cloudRun || finishExecution(activeRun, approved);
    setActiveRun(completed);
    setRuns((current) => [completed, ...current.filter((run) => run.id !== completed.id)].slice(0, 20));
    setBusy(false);
  };
  const cancel = async () => {
    if (!activeRun || !["approval", "tool_approval", "running"].includes(activeRun.stage)) return;
    setBusy(true);
    const cloudRun = activeRun.cloud ? await cancelCloudExecution(accessToken, activeRun.id).catch(() => null) : null;
    const cancelled = cloudRun || cancelExecution(activeRun);
    setActiveRun(cancelled);
    setRuns((current) => [cancelled, ...current.filter((run) => run.id !== cancelled.id)].slice(0, 20));
    setBusy(false);
  };
  const retry = async (run) => {
    setBusy(true);
    let resumed = run.cloud ? await retryCloudExecution(accessToken, run.id).catch(() => null) : null;
    if (!resumed && run.cloud) resumed = await createCloudExecution(accessToken, { id: run.agentId, title: run.agentTitle }, run.mission, run.permissions, crypto.randomUUID()).catch(() => null);
    if (!resumed) resumed = createExecution({ id: run.agentId, title: run.agentTitle }, run.mission, run.permissions);
    setActiveRun(resumed);
    setRuns((current) => resumed.id === run.id ? [resumed, ...current.filter((item) => item.id !== run.id)].slice(0, 20) : current);
    setBusy(false);
  };
  const decideAction = async (approved) => {
    if (!activeRun?.actionApproval) return;
    setBusy(true);
    const updated = await decideActionCloudExecution(accessToken, activeRun.actionApproval.id, approved).catch(() => null);
    if (updated) {
      setActiveRun(updated);
      setRuns((current) => [updated, ...current.filter((run) => run.id !== updated.id)].slice(0, 20));
    }
    setBusy(false);
  };
  const stage = activeRun?.stage || "idle";
  const steps = [
    { id: "understand", label: "Understand request", detail: activeRun ? "Mission parsed and constraints identified" : "Waiting for a mission" },
    { id: "plan", label: "Build plan", detail: activeRun ? "Five-step execution plan prepared" : "Not started" },
    { id: "approval", label: "Human approval", detail: stage === "approval" ? "Review permissions and proposed actions" : stage === "rejected" ? "Reviewer rejected execution" : ["running","completed"].includes(stage) ? "Approved" : stage === "cancelled" ? "Run cancelled" : "Required before external action" },
    { id: "execute", label: "Execute actions", detail: stage === "tool_approval" ? "A scoped write action needs your decision" : stage === "running" ? "Worker claimed the approved job" : stage === "completed" ? "Approved tools executed" : stage === "failed" ? "Worker stopped after bounded retries" : stage === "cancelled" ? "Execution stopped safely" : "Blocked by approval gate" },
    { id: "verify", label: "Verify outcome", detail: stage === "completed" ? "Quality and completion checks passed" : "Pending" },
  ];
  const stepState = (id) => {
    if (!activeRun) return "pending";
    if (["understand", "plan"].includes(id)) return "complete";
    if (id === "approval") return stage === "approval" ? "active" : ["rejected","cancelled"].includes(stage) ? "failed" : "complete";
    if (id === "execute" && stage === "running") return "active";
    if (id === "execute" && stage === "tool_approval") return "active";
    if (id === "execute" && stage === "failed") return "failed";
    if (["execute", "verify"].includes(id) && stage === "completed") return "complete";
    return "pending";
  };

  return <section className="execution-view">
    <header className="execution-header"><div><h1>Agent Execution</h1><p>Run trusted agent workflows with explicit permissions, approval gates, and a complete audit trail.</p></div><div className="execution-header-actions">{["approval","running","tool_approval"].includes(stage) ? <button type="button" onClick={cancel} disabled={busy}><X size={14} /> Cancel run</button> : null}<span className={`execution-status ${stage}`}>{stage === "approval" ? "Awaiting approval" : stage === "tool_approval" ? "Action approval" : stage === "running" ? "Worker running" : stage === "completed" ? "Completed" : stage === "failed" ? "Failed · retry ready" : stage === "rejected" ? "Rejected" : stage === "cancelled" ? "Cancelled" : "Ready"}</span></div></header>
    <div className="execution-controls"><label><span>Selected agent</span><select value={agentId} onChange={(event) => setAgentId(event.target.value)}>{availableAgents.map((item) => <option value={item.id} key={item.id}>{item.title}</option>)}</select></label><label className="mission-field"><span>Mission</span><input value={mission} onChange={(event) => setMission(event.target.value)} placeholder="Give this agent a clear outcome…" /></label><button type="button" onClick={start} disabled={busy || mission.trim().length < 12 || ["approval","tool_approval"].includes(stage)}>{busy ? <span className="spinner" /> : <Play size={16} weight="fill" />} {busy ? "Saving run…" : "Run agent"}</button></div>
    <div className="execution-grid">
      <section className="timeline-panel"><header><h2>Execution timeline</h2><span>{activeRun ? activeRun.id.slice(0, 8) : "No active run"}</span></header><div className="execution-steps">{steps.map((step, index) => { const state = stepState(step.id); return <article className={`${state} ${step.id === "approval" || (step.id === "execute" && stage === "tool_approval") ? "approval-step" : ""}`} key={step.id}><div className="step-marker">{state === "complete" ? <Check size={16} weight="bold" /> : index + 1}</div><div><strong>{step.label}</strong><p>{step.detail}</p>{step.id === "approval" && stage === "approval" ? <div className="approval-actions"><button type="button" className="reject" onClick={() => decide(false)}><X size={15} /> Reject</button><button type="button" className="approve" onClick={() => decide(true)}><Check size={15} weight="bold" /> Approve & execute</button></div> : null}{step.id === "execute" && stage === "tool_approval" && activeRun.actionApproval ? <div className="scoped-approval"><span>{activeRun.actionApproval.toolName} · {activeRun.actionApproval.riskLevel}</span><code>{activeRun.actionApproval.input?.content || JSON.stringify(activeRun.actionApproval.input)}</code><div className="approval-actions"><button type="button" className="reject" onClick={() => decideAction(false)}><X size={15} /> Reject action</button><button type="button" className="approve" onClick={() => decideAction(true)}><Check size={15} weight="bold" /> Approve once</button></div></div> : null}</div></article>; })}</div></section>
      <aside className="run-inspector"><header><h2>Run inspector</h2><ShieldCheck size={18} /></header><section><h3>Tool permissions</h3>{[["web","Web research"],["workspace","Workspace read"],["external","External actions"]].map(([id,label]) => <label className="permission-row" key={id}><span><Robot size={15} /> {label}</span><input type="checkbox" checked={permissions[id]} onChange={() => setPermissions((current) => ({ ...current, [id]: !current[id] }))} disabled={["approval","tool_approval"].includes(stage)} /><i>{permissions[id] ? "Allowed" : "Blocked"}</i></label>)}</section><section><h3>Run budget</h3><div className="budget-line"><span>Token limit</span><strong>100,000</strong></div><div className="budget-meter"><i style={{ width: activeRun ? "18%" : "0%" }} /></div><div className="budget-line"><span>Maximum cost</span><strong>₹40</strong></div></section>{activeRun?.plan ? <section className="plan-evidence"><h3>Execution intelligence</h3><div><span>PLAN · {activeRun.plan.engine}</span><p>{activeRun.plan.summary}</p><strong>{activeRun.plan.calls.length} tool action{activeRun.plan.calls.length === 1 ? "" : "s"}</strong></div>{activeRun.verification ? <div className={activeRun.verification.passed ? "passed" : "failed"}><span>{activeRun.verification.passed ? "VERIFIED" : "CHECK FAILED"} · {activeRun.verification.engine}</span><p>{activeRun.verification.summary}</p></div> : null}</section> : null}<section className="event-log"><h3>Event log</h3>{activeRun ? activeRun.events.slice(0, 6).map((event) => <div key={event.id}><i className={event.tone} /><span>{event.text}</span><time>{new Date(event.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</time></div>) : <p>Events appear when a run starts.</p>}</section></aside>
    </div>
    <section className="recent-executions"><header><div><h2>Recent runs</h2><p>{accessToken ? "Cloud-backed audit history for authenticated execution decisions." : "Local audit history · sign in for durable cloud runs."}</p></div><span>{runs.length} runs</span></header>{runs.length ? <div className="execution-table"><div className="execution-table-head"><span>Agent</span><span>Status</span><span>Duration</span><span>Cost</span><span>Started</span><span>Recovery</span></div>{runs.slice(0, 6).map((run) => <div className="execution-row" key={run.id}><div><strong>{run.agentTitle}</strong><span>{run.mission}</span></div><span className={`run-status ${run.status.toLowerCase()}`}>{run.status}</span><span>{run.duration}</span><span>{run.cost}</span><time>{new Date(run.startedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</time>{["failed","cancelled"].includes(run.stage) ? <button type="button" className="retry-run" onClick={() => retry(run)} disabled={busy}><ClockCounterClockwise size={13} /> Retry</button> : <span>—</span>}</div>)}</div> : <div className="execution-empty"><Robot size={30} weight="duotone" /><p>Run your first agent to create an auditable execution record.</p></div>}</section>
    <AgentSchedules agents={availableAgents} accessToken={accessToken} />
    <AgentMemoryPanel accessToken={accessToken} refreshKey={activeRun?.finishedAt} />
    <AgentOperationsPanel accessToken={accessToken} refreshKey={activeRun?.updatedAt || activeRun?.finishedAt} />
  </section>;
}

function AgentOperationsPanel({ accessToken, refreshKey }) {
  const [operations, setOperations] = useState(null);
  useEffect(() => {
    let active = true;
    if (!accessToken) { setOperations(null); return undefined; }
    const refresh = () => loadAgentOperations(accessToken).then((value) => { if (active && value) setOperations(value); });
    refresh(); const timer = setInterval(refresh, 30000);
    return () => { active = false; clearInterval(timer); };
  }, [accessToken, refreshKey]);
  const healthy = operations?.activeWorkers > 0 && !operations?.alerts?.length;
  return <section className="operations-panel"><header><div><h2>Execution operations</h2><p>Live worker availability, queue pressure, failures, and capacity signals.</p></div><span className={healthy ? "healthy" : "attention"}>{operations ? healthy ? "Healthy" : "Needs attention" : accessToken ? "Sampling…" : "Sign in required"}</span></header>{accessToken && operations ? <><div className="operations-metrics"><article><Cpu size={18} /><div><span>Active workers</span><strong>{operations.activeWorkers}</strong></div><small>{operations.staleWorkers} stale</small></article><article><ListChecks size={18} /><div><span>Queue depth</span><strong>{operations.queueDepth}</strong></div><small>{operations.processing} processing</small></article><article><ChartLineUp size={18} /><div><span>Completed · 24h</span><strong>{operations.completed24h}</strong></div><small>{operations.failed24h} failed</small></article><article><Robot size={18} /><div><span>Suggested capacity</span><strong>{operations.recommendedWorkers}</strong></div><small>worker{operations.recommendedWorkers === 1 ? "" : "s"}</small></article></div>{operations.alerts?.length ? <div className="operations-alerts">{operations.alerts.map((alert) => <div key={alert}><Warning size={15} /><span>{alert}</span></div>)}</div> : <div className="operations-clear"><ShieldCheck size={15} /><span>No operational alerts. Queue and heartbeats are within thresholds.</span></div>}</> : <div className="operations-empty"><Cpu size={24} /><span>{accessToken ? "Collecting the first operations sample…" : "Sign in to inspect your execution queue and platform worker health."}</span></div>}</section>;
}

function AgentMemoryPanel({ accessToken, refreshKey }) {
  const [memories, setMemories] = useState([]);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    let active = true;
    if (!accessToken) { setMemories([]); return undefined; }
    setLoading(true);
    loadAgentMemories(accessToken).then((items) => { if (active) setMemories(items); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [accessToken, refreshKey]);
  const remove = async (id) => { if (await deleteAgentMemory(accessToken, id)) setMemories((current) => current.filter((item) => item.id !== id)); };
  return <section className="memory-panel"><header><div><span className="memory-kicker"><Database size={13} /> GOVERNED MEMORY</span><h2>Memory governance</h2><p>Only explicitly approved facts are retained. Every memory expires automatically and can be deleted now.</p></div><strong>{memories.length} active</strong></header>{accessToken ? loading ? <div className="memory-empty"><span className="spinner" /> Loading governed memory…</div> : memories.length ? <div className="memory-list">{memories.map((memory) => <article key={memory.id}><div className="memory-icon"><Books size={18} weight="duotone" /></div><div><p>{memory.content}</p><span>Run {memory.runId.slice(0,8)} · retained {memory.retentionDays} days</span></div><time>Expires {new Date(memory.expiresAt).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" })}</time><button type="button" onClick={() => remove(memory.id)} aria-label="Delete memory"><Trash size={15} /></button></article>)}</div> : <div className="memory-empty"><Database size={25} weight="duotone" /><div><strong>No retained memories</strong><span>Run an agent with External actions enabled and add “remember: …” to its mission.</span></div></div> : <div className="memory-empty"><ShieldCheck size={25} /><div><strong>Sign in to manage durable memory</strong><span>Authenticated storage keeps memories private, expiring, and auditable.</span></div></div>}</section>;
}

function AgentSchedules({ agents, accessToken }) {
  const tomorrow = () => { const date = new Date(Date.now() + 24 * 60 * 60 * 1000); date.setSeconds(0,0); return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0,16); };
  const [schedules, setSchedules] = useState([]);
  const [agentId, setAgentId] = useState(agents[0].id);
  const [mission, setMission] = useState("Create a concise daily research brief with the most important changes.");
  const [cadence, setCadence] = useState("daily");
  const [nextRun, setNextRun] = useState(tomorrow);
  const [status, setStatus] = useState("idle");
  useEffect(() => { if (accessToken) loadAgentSchedules(accessToken).then(setSchedules); else setSchedules([]); }, [accessToken]);
  const create = async () => {
    const agent = agents.find((item) => item.id === agentId) || agents[0];
    setStatus("loading");
    const schedule = await createAgentSchedule(accessToken, { agentId: agent.id, agentTitle: agent.title, mission: mission.trim(), permissions: { web: true, workspace: true, external: false }, cadence, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC", nextRunAt: new Date(nextRun).toISOString() }).catch(() => null);
    if (schedule) { setSchedules((current) => [schedule, ...current]); setStatus("idle"); } else setStatus("error");
  };
  const toggle = async (schedule) => {
    const updated = await setAgentScheduleActive(accessToken, schedule.id, !schedule.active).catch(() => null);
    if (updated) setSchedules((current) => current.map((item) => item.id === schedule.id ? { ...item, active: updated.active } : item));
  };
  const remove = async (id) => { if (await deleteAgentSchedule(accessToken, id)) setSchedules((current) => current.filter((item) => item.id !== id)); };
  return <section className="schedule-panel"><header><div><h2>Scheduled triggers</h2><p>Queue safe, read-only agent runs on a recurring cadence.</p></div><span>{schedules.filter((item) => item.active).length} active</span></header>{accessToken ? <><div className="schedule-composer"><select aria-label="Schedule agent" value={agentId} onChange={(event) => setAgentId(event.target.value)}>{agents.map((item) => <option value={item.id} key={item.id}>{item.title}</option>)}</select><input aria-label="Schedule mission" value={mission} onChange={(event) => setMission(event.target.value)} /><select aria-label="Schedule cadence" value={cadence} onChange={(event) => setCadence(event.target.value)}><option value="daily">Daily</option><option value="weekly">Weekly</option></select><input aria-label="First run" type="datetime-local" value={nextRun} onChange={(event) => setNextRun(event.target.value)} /><button type="button" onClick={create} disabled={status === "loading" || mission.trim().length < 12}>{status === "loading" ? <span className="spinner" /> : <ClockCounterClockwise size={14} />} Schedule</button></div>{status === "error" ? <div className="schedule-error">Schedule could not be created. Confirm the first run is in the future.</div> : null}<div className="schedule-list">{schedules.map((schedule) => <article key={schedule.id}><div><strong>{schedule.agentTitle}</strong><span>{schedule.mission}</span></div><span>{schedule.cadence}</span><time>{new Date(schedule.nextRunAt).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}</time><button type="button" onClick={() => toggle(schedule)}>{schedule.active ? "Pause" : "Resume"}</button><button type="button" className="schedule-delete" onClick={() => remove(schedule.id)} aria-label={`Delete ${schedule.agentTitle} schedule`}><Trash size={14} /></button></article>)}</div></> : <div className="schedule-signin"><ShieldCheck size={23} /><div><strong>Sign in to schedule durable runs</strong><span>Schedules require authenticated cloud persistence and the worker service.</span></div></div>}</section>;
}

function AnalyticsView({ assets, runHistory }) {
  const runs = Object.entries(runHistory).flatMap(([assetId, items]) => items.map((run) => ({ ...run, assetId }))).sort((a, b) => new Date(a.executedAt) - new Date(b.executedAt));
  const totalTokens = runs.reduce((sum, run) => sum + (run.totalTokens || 0), 0);
  const averageLatency = runs.length ? Math.round(runs.reduce((sum, run) => sum + (run.latency || 0), 0) / runs.length) : 0;
  const liveRuns = runs.filter((run) => run.live).length;
  const trackedCost = runs.reduce((sum, run) => sum + (typeof run.estimatedCost === "number" ? run.estimatedCost : 0), 0);
  const points = (runs.length ? runs : [{ quality: 0 }]).slice(-12).map((run, index, list) => {
    const quality = run.quality || 0;
    const x = list.length === 1 ? 50 : 8 + (index / (list.length - 1)) * 84;
    const y = 90 - quality * .72;
    return { x, y, quality };
  });
  const modelCounts = runs.reduce((counts, run) => ({ ...counts, [run.model || "unknown"]: (counts[run.model || "unknown"] || 0) + 1 }), {});
  const maxModelCount = Math.max(1, ...Object.values(modelCounts));

  return <section className="analytics-view">
    <header className="analytics-header"><div><h1>Usage Analytics</h1><p>Monitor execution volume, token usage, latency, and quality trends.</p></div><span>{runs.length ? `Updated ${new Date(runs[runs.length - 1].executedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : "No runs yet"}</span></header>
    <div className="metric-strip">
      <article><span>Total runs</span><strong>{runs.length}</strong><p>{liveRuns} live provider</p></article>
      <article><span>Tokens tracked</span><strong>{totalTokens.toLocaleString()}</strong><p>Input + output</p></article>
      <article><span>Avg. latency</span><strong>{averageLatency}<small>ms</small></strong><p>Across all executions</p></article>
      <article><span>Tracked cost</span><strong>${trackedCost.toFixed(3)}</strong><p>Unknown live pricing excluded</p></article>
    </div>
    <div className="analytics-grid">
      <article className="trend-panel"><header><div><h2>Quality over time</h2><p>Last {Math.min(12, runs.length)} executions</p></div><strong>{points[points.length - 1].quality || "—"}</strong></header>{runs.length ? <svg className="trend-chart" viewBox="0 0 100 100" role="img" aria-label={`Quality trend ending at ${points[points.length - 1].quality} out of 100`} preserveAspectRatio="none"><line x1="8" y1="18" x2="92" y2="18" /><line x1="8" y1="54" x2="92" y2="54" /><line x1="8" y1="90" x2="92" y2="90" /><polyline points={points.map((point) => `${point.x},${point.y}`).join(" ")} />{points.map((point, index) => <circle key={`${point.x}-${index}`} cx={point.x} cy={point.y} r="1.7" />)}</svg> : <AnalyticsEmpty /> }<div className="chart-scale"><span>100</span><span>50</span><span>0</span></div></article>
      <article className="usage-panel"><header><h2>Model usage</h2><p>Execution share by route</p></header>{Object.keys(modelCounts).length ? <div className="model-bars">{Object.entries(modelCounts).sort((a, b) => b[1] - a[1]).map(([model, count]) => <div key={model}><div><strong>{model}</strong><span>{count} run{count === 1 ? "" : "s"}</span></div><i><span style={{ width: `${(count / maxModelCount) * 100}%` }} /></i></div>)}</div> : <AnalyticsEmpty />}</article>
    </div>
    <article className="analytics-table"><header><div><h2>Recent executions</h2><p>Latest activity across {assets.length} saved assets.</p></div></header>{runs.length ? <div><div className="analytics-table-head"><span>Capability</span><span>Route</span><span>Tokens</span><span>Latency</span><span>Quality</span></div>{[...runs].reverse().slice(0, 8).map((run) => { const asset = assets.find((item) => item.id === run.assetId); return <div className="analytics-row" key={run.id}><div><strong>{asset?.title || "Removed asset"}</strong><span>{run.input}</span></div><span>{run.model}</span><span>{run.totalTokens || "—"}</span><span>{run.latency}ms</span><strong>{run.quality || "—"}</strong></div>; })}</div> : <AnalyticsEmpty />}</article>
  </section>;
}

function AnalyticsEmpty() {
  return <div className="analytics-empty"><ChartLineUp size={25} /><p>Run an asset in the Playground to populate analytics.</p></div>;
}

const adminDate = (value) => value ? new Date(value).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "Never";

function AdminUserRow({ user, busy, onStatus, onBackup, onExport, onRename }) {
  const [editing, setEditing] = useState(false), [label, setLabel] = useState(user.label || "Private device workspace");
  const saveLabel = async () => { const clean = label.trim(); if (clean.length < 2 || clean === user.label) return setEditing(false); await onRename(user.id, clean); setEditing(false); };
  return <div className="admin-user-row">
    <div className="admin-user-identity"><span>{(user.label || "PW").slice(0, 2).toUpperCase()}</span><div>{editing ? <input autoFocus value={label} maxLength={80} onChange={event => setLabel(event.target.value)} onBlur={saveLabel} onKeyDown={event => { if (event.key === "Enter") saveLabel(); if (event.key === "Escape") setEditing(false); }} /> : <button type="button" onClick={() => setEditing(true)}><strong>{user.label || "Private device workspace"}</strong><small>{user.id}</small></button>}</div></div>
    <span className={`admin-user-status ${user.status}`}>{user.status}</span>
    <div className="admin-user-data"><strong>{user.assetCount}</strong><small>assets</small></div>
    <div className="admin-user-data"><strong>{user.activationEvents}</strong><small>events</small></div>
    <div className="admin-user-data"><strong>{user.backupCount}</strong><small>backups</small></div>
    <div className="admin-user-seen"><strong>{adminDate(user.lastSeenAt)}</strong><small>Last saved {adminDate(user.lastSavedAt)}</small></div>
    <div className="admin-user-actions"><button type="button" title="Create data backup" disabled={busy === user.id} onClick={() => onBackup(user.id)}><Archive size={16} /></button><button type="button" title="Export user data" disabled={busy === user.id} onClick={() => onExport(user.id)}><DownloadSimple size={16} /></button><button type="button" className={user.status === "active" ? "suspend" : "activate"} disabled={busy === user.id} onClick={() => onStatus(user.id, user.status === "active" ? "suspended" : "active")}>{user.status === "active" ? <UserMinus size={16} /> : <UserCheck size={16} />} {user.status === "active" ? "Suspend" : "Activate"}</button></div>
  </div>;
}

function AdminPanel({ configured }) {
  const [accessKey, setAccessKey] = useState(""), [authenticated, setAuthenticated] = useState(Boolean(getAdminToken())), [overview, setOverview] = useState(null), [query, setQuery] = useState(""), [filter, setFilter] = useState("all"), [busy, setBusy] = useState(""), [notice, setNotice] = useState("");
  const refresh = async () => { if (!getAdminToken()) return; const data = await loadAdminOverview({ query, status: filter }); if (!data) { setAuthenticated(false); setOverview(null); return; } setOverview(data); };
  useEffect(() => { if (!authenticated) return; const timer = window.setTimeout(refresh, 220); return () => window.clearTimeout(timer); }, [authenticated, query, filter]);
  const login = async event => { event.preventDefault(); setBusy("login"); setNotice(""); try { await createAdminAccess(accessKey); setAuthenticated(true); setAccessKey(""); } catch (error) { setNotice(error.message); } setBusy(""); };
  const update = async (id, input, success) => { setBusy(id); const changed = await updateAdminUser(id, input); if (changed) { setNotice(success); await refresh(); } else setNotice("Admin action could not be completed."); setBusy(""); };
  const backup = async id => { setBusy(id); const result = await createAdminBackup(id); setNotice(result ? `Backup created · ${result.checksum.slice(0, 12)}…` : "Backup could not be created."); await refresh(); setBusy(""); };
  const exportUser = async id => { setBusy(id); const ok = await exportAdminUser(id); setNotice(ok ? "User data export downloaded." : "Export could not be created."); setBusy(""); };
  const logout = () => { clearAdminToken(); setAuthenticated(false); setOverview(null); setNotice(""); };
  if (!authenticated) return <section className="admin-login-view"><div className="admin-login-card"><div className="admin-lock"><ShieldCheck size={32} weight="duotone" /></div><h1>Administrator access</h1><p>Control user access and protect MongoDB workspace data. The access key is exchanged for an eight-hour signed session and is never stored in the browser.</p>{configured === false ? <div className="admin-config-warning"><Warning size={16} /> Set <code>ADMIN_ACCESS_KEY</code> on the server to enable this panel.</div> : null}<form onSubmit={login}><label htmlFor="admin-access-key">Admin access key</label><div><Key size={17} /><input id="admin-access-key" type="password" required minLength={24} autoComplete="current-password" value={accessKey} onChange={event => setAccessKey(event.target.value)} placeholder="Enter server-managed access key" /></div><button type="submit" disabled={busy === "login"}>{busy === "login" ? <span className="spinner" /> : <ShieldCheck size={17} />} Open admin control</button></form>{notice ? <div className="admin-notice error" role="alert">{notice}</div> : null}</div></section>;
  return <section className="admin-view"><header className="admin-header"><div><h1>Auth & data control</h1><p>Manage private device users, access state, MongoDB assets and recoverable snapshots.</p></div><div><button type="button" onClick={refresh}><ClockCounterClockwise size={16} /> Refresh</button><button type="button" className="admin-logout" onClick={logout}>Lock panel</button></div></header>{overview ? <><div className="admin-metrics">{[["Registered users", overview.metrics.totalUsers, UsersThree], ["Active · 24h", overview.metrics.active24h, UserCheck], ["Saved assets", overview.metrics.totalAssets, Books], ["Data backups", overview.metrics.totalBackups, Archive]].map(([label, value, Icon]) => <article key={label}><Icon size={21} weight="duotone" /><span>{label}</span><strong>{value}</strong></article>)}</div><section className="admin-directory"><header><div><h2>User directory</h2><p>{overview.pagination.total} matching workspace{overview.pagination.total === 1 ? "" : "s"} · {overview.metrics.suspendedUsers} suspended</p></div><div className="admin-filters"><label><MagnifyingGlass size={15} /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search label or user ID" /></label><select value={filter} onChange={event => setFilter(event.target.value)} aria-label="Filter users by status"><option value="all">All users</option><option value="active">Active</option><option value="suspended">Suspended</option></select></div></header><div className="admin-table-head"><span>User workspace</span><span>Status</span><span>Assets</span><span>Events</span><span>Backups</span><span>Activity</span><span>Controls</span></div>{overview.users.length ? overview.users.map(user => <AdminUserRow key={user.id} user={user} busy={busy} onStatus={(id, status) => update(id, { status }, status === "active" ? "User access restored." : "User suspended; existing data was preserved.")} onRename={(id, label) => update(id, { label }, "User label updated.")} onBackup={backup} onExport={exportUser} />) : <div className="admin-empty"><UsersThree size={28} /><p>No users match this filter.</p></div>}</section></> : <div className="admin-loading"><span className="spinner" /><p>Loading protected user records…</p></div>}{notice ? <div className="admin-notice" role="status"><Check size={15} /> {notice}<button type="button" onClick={() => setNotice("")} aria-label="Dismiss"><X size={13} /></button></div> : null}</section>;
}

function SettingsView({ status, session, onRefresh }) {
  const integrations = [
    { id: "ai", name: "OpenAI generation", icon: Robot, ready: Boolean(status?.ai?.enabled), detail: status?.ai?.enabled ? status.ai.model : "Local structured fallback", variables: "OPENAI_API_KEY · OPENAI_MODEL" },
    { id: "database", name: status?.database?.provider === "mongodb" ? "MongoDB workspace" : "Supabase workspace", icon: Database, ready: Boolean(status?.database?.enabled), detail: status?.database?.enabled ? "Cloud persistence enabled" : "Browser storage active", variables: status?.database?.provider === "mongodb" ? "MONGODB_URI · MONGODB_DATABASE" : "SUPABASE_URL · SUPABASE_SERVICE_ROLE_KEY" },
    { id: "auth", name: authMode === "mongodb" ? "Private device authentication" : "Supabase authentication", icon: ShieldCheck, ready: authConfigured, detail: session ? (authMode === "mongodb" ? "Private MongoDB session active" : `Signed in as ${session.user.email}`) : authConfigured ? "Ready for sign-in" : "Authentication not configured", variables: authMode === "mongodb" ? "AUTH_SECRET · VITE_AUTH_MODE" : "VITE_SUPABASE_URL · VITE_SUPABASE_PUBLISHABLE_KEY" },
    { id: "email", name: "Invitation email", icon: EnvelopeSimple, ready: Boolean(status?.email?.enabled), detail: status?.email?.enabled ? `${status.email.provider} delivery enabled` : "Secure manual links active", variables: "RESEND_API_KEY · INVITE_EMAIL_FROM · APP_URL" },
  ];
  const readyCount = integrations.filter((item) => item.ready).length;
  const readiness = Math.round((readyCount / integrations.length) * 100);
  return <section className="settings-view"><header className="settings-header"><div><h1>System Settings</h1><p>Review integrations and production deployment readiness.</p></div><button type="button" onClick={onRefresh}><ClockCounterClockwise size={16} /> Refresh checks</button></header><div className="readiness-panel"><div className="readiness-score" style={{ "--readiness": `${readiness * 3.6}deg` }}><strong>{readiness}%</strong><span>ready</span></div><div><h2>{readiness === 100 ? "Production integrations ready" : `${integrations.length - readyCount} integration${integrations.length - readyCount === 1 ? "" : "s"} need configuration`}</h2><p>The product remains fully usable with local fallbacks while providers are configured.</p></div></div><div className="integration-list">{integrations.map(({ icon: Icon, ...integration }) => <article key={integration.id}><div className={`integration-icon ${integration.ready ? "ready" : "local"}`}><Icon size={21} /></div><div><h2>{integration.name}</h2><p>{integration.detail}</p><code>{integration.variables}</code></div><span className={integration.ready ? "ready" : "local"}>{integration.ready ? "Configured" : "Fallback"}</span></article>)}</div><GovernancePanel accessToken={session?.access_token} /><IdentityPanel accessToken={session?.access_token} /><InfrastructurePanel accessToken={session?.access_token} /><EnterpriseControlCenter accessToken={session?.access_token} /><ReliabilityCenter accessToken={session?.access_token} /><ActivationPanel accessToken={session?.access_token} /><LaunchCommandCenter accessToken={session?.access_token} /><GrowthOperationsPanel accessToken={session?.access_token} /><section className="deployment-checklist"><header><h2>Deployment checklist</h2><p>Phase 6 production launch and growth controls are complete.</p></header><div>{(authMode === "mongodb" ? ["MongoDB service linked with MONGODB_URI", "Set ENTERPRISE_KEY_ENCRYPTION_SECRET server-side", "Set APP_URL to the public HTTPS origin", "Keep AUTH_SECRET private and backed up", "Configure optional OpenAI, Resend and Stripe providers"] : ["Apply migrations through 021_lifecycle_growth_experiments.sql", "Set ENTERPRISE_KEY_ENCRYPTION_SECRET server-side", "Set APP_URL to the public HTTPS origin", "Configure Supabase authentication redirects", "Run API and worker as separate production processes"]).map((item, index) => <div key={item}><span>{index + 1}</span><p>{item}</p></div>)}</div></section></section>;
}

function EnterpriseControlCenter({accessToken}){const[usage,setUsage]=useState(null);const[busy,setBusy]=useState("");useEffect(()=>{if(accessToken)loadEnterpriseUsage(accessToken).then(setUsage);else setUsage(null);},[accessToken]);const toggle=async(key)=>{setBusy(key);const updated=await updateEnterpriseFlag(accessToken,key,!usage.flags[key]);if(updated)setUsage(updated);setBusy("");};const labels={agent_execution:["Agent execution","Allow approved agent runs"],production_promotion:["Production promotion","Allow staged assets to reach production"],marketplace_publish:["Marketplace publishing","Allow public capability submissions"]};return <section className="enterprise-center"><header><div><h2>Enterprise control center</h2><p>30-day organization usage and server-enforced runtime capabilities.</p></div><ChartLineUp size={22} weight="duotone"/></header>{accessToken&&usage?<><div className="enterprise-metrics">{[["Assets",usage.report.assets],["Agent runs",usage.report.runs],["Tool calls",usage.report.toolCalls],["Tracked cost",`₹${(usage.report.costPaise/100).toFixed(2)}`]].map(([label,value])=><article key={label}><span>{label}</span><strong>{value}</strong></article>)}</div><div className="enterprise-flags">{Object.entries(labels).map(([key,[title,detail]])=><label key={key}><span><strong>{title}</strong><small>{detail}</small></span><input type="checkbox" checked={usage.flags[key]} disabled={busy===key} onChange={()=>toggle(key)}/><i>{usage.flags[key]?"Enabled":"Disabled"}</i></label>)}</div><div className="enterprise-actions"><span>{usage.report.completedRuns} completed · {usage.report.failedRuns} failed · last {usage.report.periodDays} days</span><button type="button" onClick={()=>downloadEnterpriseUsage(accessToken)}><BracketsCurly size={14}/> Export JSON</button></div></>:<div className="governance-empty"><ChartLineUp size={23}/><span>{accessToken?"Workspace owner usage is unavailable.":"Sign in as a workspace owner to open enterprise controls."}</span></div>}</section>;}

function ReliabilityCenter({accessToken}){const[sla,setSla]=useState(null);const[verifications,setVerifications]=useState([]);const[busy,setBusy]=useState(false);const refresh=()=>{if(!accessToken){setSla(null);setVerifications([]);return;}Promise.all([loadSla(accessToken),loadRecoveryVerifications(accessToken)]).then(([nextSla,nextVerifications])=>{setSla(nextSla);setVerifications(nextVerifications);});};useEffect(refresh,[accessToken]);useEffect(()=>{if(!accessToken)return;const timer=setInterval(()=>loadSla(accessToken).then(setSla),30000);return()=>clearInterval(timer);},[accessToken]);const verify=async()=>{setBusy(true);const result=await runRecoveryVerification(accessToken);if(result)setVerifications(current=>[result,...current]);setBusy(false);};const latest=verifications[0];return <section className="reliability-center"><header><div><h2>Reliability & recovery</h2><p>24-hour SLA telemetry, error budget, and checksum-backed recovery manifests.</p></div><ShieldCheck size={22} weight="duotone"/></header>{accessToken&&sla?<><div className="reliability-metrics">{[["Availability",`${sla.availability}%`],["P95 latency",`${sla.p95LatencyMs} ms`],["Requests",sla.requestCount],["Error budget",`${sla.errorBudgetRemainingPercent}%`]].map(([label,value])=><article key={label}><span>{label}</span><strong>{value}</strong></article>)}</div><div className="reliability-status"><div className={sla.alerts.some(x=>x.severity==="critical")?"attention":"healthy"}><ChartLineUp size={18}/><span><strong>{sla.alerts.length?sla.alerts[0].message:"All SLA targets are healthy."}</strong><small>Target {sla.targets.availabilityPercent}% · P95 under {sla.targets.p95LatencyMs} ms · refreshes every 30s</small></span></div><div><Database size={18}/><span><strong>{latest?`${latest.status} recovery point`:"No verified recovery point"}</strong><small>{latest?`${new Date(latest.createdAt).toLocaleString()} · ${latest.checksum.slice(0,12)}…`:"Create a workspace-scoped integrity manifest."}</small></span></div></div><div className="reliability-actions"><span>Payload-free telemetry · 30-day retention · request IDs enabled</span>{latest?<button type="button" onClick={()=>downloadRecoveryManifest(accessToken,latest.id)}><BracketsCurly size={14}/> Export manifest</button>:null}<button className="verify-recovery" type="button" disabled={busy} onClick={verify}><ShieldCheck size={14}/>{busy?" Verifying…":" Verify recovery"}</button></div></>:<div className="governance-empty"><ShieldCheck size={23}/><span>{accessToken?"Reliability data is unavailable.":"Sign in as a workspace owner to view SLA and recovery controls."}</span></div>}</section>;}

function ActivationPanel({accessToken}){const[report,setReport]=useState(null);useEffect(()=>{if(accessToken)loadActivationReport(accessToken).then(setReport);else setReport(null);},[accessToken]);return <section className="activation-panel"><header><div><h2>Launch activation funnel</h2><p>30-day progression from first intent to a tested and published capability.</p></div><ChartLineUp size={22} weight="duotone"/></header>{accessToken&&report?<><div className="activation-summary"><div><span>Primary KPI</span><strong>{report.primaryKpi.valuePercent}%</strong><small>Tested activation rate</small></div><div><span>Active users</span><strong>{report.activeUsers}</strong><small>{report.trackedSessions} tracked sessions</small></div><div><span>Events</span><strong>{report.totalEvents}</strong><small>Content-free analytics</small></div></div><div className="activation-funnel">{report.stages.map((stage,index)=><article key={stage.name}><div><span>{index+1}</span><strong>{stage.label}</strong></div><b>{stage.sessions}</b><small>{index?`${stage.stepConversionPercent}% from prior step`:"Funnel entry"}</small><i style={{width:`${Math.max(4,Math.min(100,stage.stepConversionPercent))}%`}}/></article>)}</div><footer><ShieldCheck size={14}/><span>No prompt text or generated content is stored in product analytics.</span></footer></>:<div className="governance-empty"><ChartLineUp size={23}/><span>{accessToken?"Activation data is unavailable.":"Sign in as a workspace owner to view launch analytics."}</span></div>}</section>;}

function LaunchCommandCenter({accessToken}){const[data,setData]=useState(null);const[busy,setBusy]=useState(false);const[link,setLink]=useState("");const refresh=()=>accessToken?loadLaunchCenter(accessToken).then(setData):setData(null);useEffect(refresh,[accessToken]);const change=(key,value)=>setData(current=>({...current,control:{...current.control,[key]:value}}));const save=async()=>{setBusy(true);const next=await saveLaunchControl(accessToken,data.control);if(next)setData(next);setBusy(false);};const create=async()=>{setBusy(true);const result=await createBetaAccess(accessToken,"Founding beta");if(result){setLink(result.url);await refresh();}setBusy(false);};const revoke=async(id)=>{setBusy(true);await revokeBetaAccess(accessToken,id);await refresh();setBusy(false);};return <section className="launch-center"><header><div><h2>Launch command center</h2><p>Release health, controlled rollout and single-use beta access.</p></div><Flag size={22} weight="duotone"/></header>{accessToken&&data?<><div className="launch-health">{data.health.map(item=><article className={item.status} key={item.name}><span>{item.name}</span><strong>{item.value}</strong><small>{item.status}</small></article>)}<article className={data.control.launchPaused?"attention":"healthy"}><span>Rollout</span><strong>{data.control.rolloutMode}</strong><small>{data.control.launchPaused?"paused":"active"}</small></article></div><div className="launch-controls"><label><span>Rollout mode</span><select value={data.control.rolloutMode} onChange={e=>change("rolloutMode",e.target.value)}><option value="internal">Internal</option><option value="beta">Beta</option><option value="public">Public</option></select></label><label><span>Beta capacity</span><input type="number" min="1" max="10000" value={data.control.betaCapacity} onChange={e=>change("betaCapacity",Number(e.target.value))}/></label><label><span>Activation target</span><input type="number" min="1" max="100" value={data.control.activationTargetPercent} onChange={e=>change("activationTargetPercent",Number(e.target.value))}/></label><label className="launch-pause"><span><strong>Pause new access</strong><small>Existing members remain available</small></span><input type="checkbox" checked={data.control.launchPaused} onChange={e=>change("launchPaused",e.target.checked)}/></label></div><div className="cohort-row"><div><strong>{data.cohort.redeemed} / {data.cohort.capacity} beta seats</strong><span>{data.cohort.remaining} remaining · links expire after 7 days</span></div>{link?<button type="button" onClick={()=>navigator.clipboard?.writeText(link)}><BracketsCurly size={14}/> Copy new link</button>:null}<button type="button" disabled={busy||data.control.rolloutMode!=="beta"||data.control.launchPaused} onClick={create}><UserPlus size={14}/> Create access link</button><button className="launch-save" type="button" disabled={busy} onClick={save}><Check size={14}/> Save rollout</button></div>{data.accessTokens.some(x=>x.status==="active")?<div className="access-links">{data.accessTokens.filter(x=>x.status==="active").slice(0,3).map(item=><div key={item.id}><ShieldCheck size={14}/><span><strong>{item.cohortName}</strong><small>Expires {new Date(item.expiresAt).toLocaleDateString()}</small></span><button type="button" onClick={()=>revoke(item.id)}>Revoke</button></div>)}</div>:null}</>:<div className="governance-empty"><Flag size={23}/><span>{accessToken?"Launch controls are unavailable.":"Sign in as a workspace owner to manage rollout."}</span></div>}</section>;}

function GrowthOperationsPanel({accessToken}){const[data,setData]=useState(null);const[busy,setBusy]=useState("");useEffect(()=>{if(accessToken)loadGrowthOperations(accessToken).then(setData);else setData(null);},[accessToken]);const labels={complete_first_test:["Complete first test","Generated but not tested"],publish_ready_asset:["Publish ready asset","Tested but not published"]};const update=async automation=>{setBusy(automation.key);const next=await updateLifecycle(accessToken,automation.key,automation);if(next)setData(next);setBusy("");};const create=async()=>{setBusy("create");const next=await createExperiment(accessToken);if(next)setData(next);setBusy("");};const status=async(id,nextStatus)=>{setBusy(id);const next=await setExperimentStatus(accessToken,id,nextStatus);if(next)setData(next);setBusy("");};const experiment=data?.experiments?.[0];return <section className="growth-ops"><header><div><h2>Lifecycle & growth lab</h2><p>Activation nudges and trustworthy experiments with conversion guardrails.</p></div><Flask size={22} weight="duotone"/></header>{accessToken&&data?<><div className="lifecycle-grid">{data.automations.map(item=><article key={item.key}><div><strong>{labels[item.key][0]}</strong><small>{labels[item.key][1]}</small></div><label><span>Delay</span><select value={item.delayHours} onChange={e=>setData(current=>({...current,automations:current.automations.map(a=>a.key===item.key?{...a,delayHours:Number(e.target.value)}:a)}))}><option value="24">24 hours</option><option value="48">48 hours</option><option value="72">72 hours</option><option value="168">7 days</option></select></label><label><span>Channel</span><select value={item.channel} onChange={e=>setData(current=>({...current,automations:current.automations.map(a=>a.key===item.key?{...a,channel:e.target.value}:a)}))}><option value="email">Email</option><option value="in_app">In-app</option></select></label><label className="automation-toggle"><input type="checkbox" checked={item.enabled} onChange={e=>setData(current=>({...current,automations:current.automations.map(a=>a.key===item.key?{...a,enabled:e.target.checked}:a)}))}/><span>{item.enabled?"Enabled":"Paused"}</span></label><button type="button" disabled={busy===item.key} onClick={()=>update(item)}>Save</button></article>)}</div><div className="growth-summary"><article><span>Queued</span><strong>{data.deliveries.queued}</strong></article><article><span>Sent</span><strong>{data.deliveries.sent}</strong></article><article><span>Failed</span><strong>{data.deliveries.failed}</strong></article><div><strong>Frequency guardrail</strong><small>One delivery per user, asset and lifecycle step.</small></div></div><div className="experiment-lab"><header><div><strong>Creator CTA experiment</strong><span>Primary metric · tested activation</span></div>{!experiment?<button type="button" disabled={busy==="create"} onClick={create}><PlusSquare size={14}/> Create A/B test</button>:<div className="experiment-actions"><span className={experiment.status}>{experiment.status}</span>{experiment.status!=="completed"?<button type="button" disabled={busy===experiment.id} onClick={()=>status(experiment.id,experiment.status==="running"?"paused":"running")}>{experiment.status==="running"?"Pause":"Start"}</button>:null}{experiment.status==="running"?<button type="button" onClick={()=>status(experiment.id,"completed")}>Complete</button>:null}</div>}</header>{experiment?<><div className="variant-results">{experiment.results.map(result=><article key={result.key}><div><strong>{result.label}</strong><span>Variant {result.key}</span></div><b>{result.conversionPercent}%</b><small>{result.converted} converted / {result.assigned} assigned</small><i style={{width:`${Math.max(3,result.conversionPercent)}%`}}/></article>)}</div><footer><ShieldCheck size={14}/><span>Deterministic assignment · minimum sample shown · prompt content excluded</span></footer></>:<div className="experiment-empty"><Flask size={22}/><span>Create a controlled Generate vs Build capability experiment.</span></div>}</div></>:<div className="governance-empty"><Flask size={23}/><span>{accessToken?"Growth operations are unavailable.":"Sign in as a workspace owner to manage lifecycle and experiments."}</span></div>}</section>;}

function InfrastructurePanel({accessToken}){const[data,setData]=useState(null);const[apiKey,setApiKey]=useState("");const[busy,setBusy]=useState(false);useEffect(()=>{if(accessToken)loadInfrastructure(accessToken).then(setData);else setData(null);},[accessToken]);const update=(key,value)=>setData(current=>({...current,controls:{...current.controls,[key]:value}}));const run=async(fn)=>{setBusy(true);const result=await fn();if(result)setData(result);setBusy(false);};return <section className="infra-panel"><header><div><h2>Data & recovery controls</h2><p>Residency policy, encrypted provider credentials, and honest recovery readiness.</p></div><Database size={22} weight="duotone"/></header>{accessToken&&data?<><div className="infra-grid"><label><span>Residency policy</span><select value={data.controls.region} onChange={e=>update("region",e.target.value)}><option value="in">India</option><option value="eu">European Union</option><option value="us">United States</option><option value="apac">Asia Pacific</option></select></label><label><span>Model provider</span><select value={data.controls.provider} onChange={e=>update("provider",e.target.value)}><option value="">Platform default</option><option value="openai">OpenAI</option><option value="azure_openai">Azure OpenAI</option><option value="anthropic">Anthropic</option></select></label><label><span>Rotate provider key</span><input type="password" value={apiKey} onChange={e=>setApiKey(e.target.value)} placeholder={data.controls.keyLastFour?`Configured ••••${data.controls.keyLastFour}`:"Vaulted key"}/></label><div><strong>Recovery readiness</strong><small>{data.controls.drills[0]?`${data.controls.drills[0].status} · restore not verified`:"No drill recorded"}</small></div></div><div className="infra-actions"><span>{data.vaultReady?"Encryption vault ready":"Encryption vault needs server secret"}</span>{data.controls.keyLastFour?<button onClick={()=>run(()=>revokeInfrastructureKey(accessToken))}>Revoke key</button>:null}<button disabled={busy} onClick={()=>run(()=>runRecoveryDrill(accessToken,{rpoTargetMinutes:60,rtoTargetMinutes:240}))}><ClockCounterClockwise size={14}/> Run readiness drill</button><button className="infra-save" disabled={busy||Boolean(apiKey)&&!data.vaultReady} onClick={()=>run(async()=>{const result=await saveInfrastructure(accessToken,{region:data.controls.region,provider:data.controls.provider,apiKey});if(result)setApiKey("");return result;})}><Check size={14}/> Save controls</button></div></>:<div className="governance-empty"><Database size={23}/><span>Sign in as a workspace owner to manage infrastructure controls.</span></div>}</section>;}

function IdentityPanel({accessToken}) {
  const [identity,setIdentity]=useState(null);const [secret,setSecret]=useState("");const [busy,setBusy]=useState(false);
  useEffect(()=>{if(accessToken)loadIdentity(accessToken).then(setIdentity);else setIdentity(null);},[accessToken]);
  const change=(key,value)=>setIdentity((current)=>({...current,[key]:value}));
  const save=async()=>{setBusy(true);const updated=await saveIdentity(accessToken,{ssoEnabled:identity.ssoEnabled,verifiedDomain:identity.verifiedDomain,samlMetadataUrl:identity.samlMetadataUrl,scimEnabled:identity.scimEnabled});if(updated)setIdentity(updated);setBusy(false);};
  const rotate=async()=>{setBusy(true);const result=await rotateScimToken(accessToken);if(result){setSecret(result.token);setIdentity((current)=>({...current,scimEnabled:true,tokenLastFour:result.lastFour,tokenRotatedAt:result.rotatedAt}));}setBusy(false);};
  return <section className="identity-panel"><header><div><h2>Enterprise identity</h2><p>Domain-bound SSO readiness and bearer-protected SCIM lifecycle sync.</p></div><UsersThree size={22} weight="duotone" /></header>{accessToken&&identity?<><div className="identity-grid"><label><span>Verified domain</span><input value={identity.verifiedDomain} onChange={(event)=>change("verifiedDomain",event.target.value.toLowerCase())} placeholder="company.com" /></label><label><span>SAML metadata URL</span><input value={identity.samlMetadataUrl} onChange={(event)=>change("samlMetadataUrl",event.target.value)} placeholder="https://idp.example.com/metadata" /></label><label className="identity-switch"><span><strong>SSO policy</strong><small>Configuration ready; provider handshake required</small></span><input type="checkbox" checked={identity.ssoEnabled} onChange={(event)=>change("ssoEnabled",event.target.checked)} /></label><label className="identity-switch"><span><strong>SCIM provisioning</strong><small>{identity.activeDirectoryUsers} active directory users</small></span><input type="checkbox" checked={identity.scimEnabled} onChange={(event)=>change("scimEnabled",event.target.checked)} /></label></div>{secret?<div className="identity-secret"><Warning size={15}/><div><strong>Copy this token now — it will not be shown again.</strong><code>{secret}</code></div><button type="button" onClick={()=>navigator.clipboard?.writeText(secret)}>Copy</button><button type="button" onClick={()=>setSecret("")}><X size={13}/></button></div>:null}<div className="identity-actions"><span>{identity.tokenLastFour?`SCIM token ••••${identity.tokenLastFour}`:"No SCIM token issued"}</span><button type="button" onClick={rotate} disabled={busy}><ShieldCheck size={14}/> Rotate token</button><button type="button" className="identity-save" onClick={save} disabled={busy}>{busy?<span className="spinner"/>:<Check size={14}/>} Save identity</button></div></>:<div className="governance-empty"><UsersThree size={23}/><span>{accessToken?"Workspace owner access is required.":"Sign in as a workspace owner to configure enterprise identity."}</span></div>}</section>;
}

function GovernancePanel({ accessToken }) {
  const [governance, setGovernance] = useState(null); const [saving, setSaving] = useState(false);
  useEffect(() => { if (accessToken) loadGovernance(accessToken).then(setGovernance); else setGovernance(null); }, [accessToken]);
  const change = (key, value) => setGovernance((current) => ({ ...current, policy: { ...current.policy, [key]: value } }));
  const save = async () => { setSaving(true); const updated = await saveGovernance(accessToken, governance.policy); if (updated) setGovernance(updated); setSaving(false); };
  return <section className="governance-panel"><header><div><h2>Enterprise governance</h2><p>Owner-controlled policy defaults and append-only organization audit export.</p></div><ShieldCheck size={22} weight="duotone" /></header>{accessToken && governance ? <><div className="governance-controls"><label><span>Audit retention</span><select value={governance.policy.auditRetentionDays} onChange={(event) => change("auditRetentionDays", Number(event.target.value))}><option value={90}>90 days</option><option value={365}>1 year</option><option value={1095}>3 years</option><option value={2555}>7 years</option></select></label><label className="governance-toggle"><span><strong>Production approval</strong><small>Require review before production promotion</small></span><input type="checkbox" checked={governance.policy.requireProductionApproval} onChange={(event) => change("requireProductionApproval", event.target.checked)} /></label><label className="governance-toggle"><span><strong>External agent actions</strong><small>Organization-level default permission</small></span><input type="checkbox" checked={governance.policy.allowExternalAgentActions} onChange={(event) => change("allowExternalAgentActions", event.target.checked)} /></label></div><div className="governance-actions"><span>{governance.events.length} recent audit events</span><button type="button" onClick={() => downloadAuditExport(accessToken,"csv")}><Books size={14} /> Export CSV</button><button type="button" onClick={() => downloadAuditExport(accessToken,"json")}><BracketsCurly size={14} /> Export JSON</button><button type="button" className="governance-save" onClick={save} disabled={saving}>{saving ? <span className="spinner" /> : <Check size={14} />} Save policy</button></div></> : <div className="governance-empty"><ShieldCheck size={23} /><span>{accessToken ? "Workspace owner access is required." : "Sign in as a workspace owner to manage enterprise policies."}</span></div>}</section>;
}

function WorkspaceView({ workspace, assets, onInvite, onRoleChange, onRemove, onResend, onMarkAllRead }) {
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [activityFilter, setActivityFilter] = useState("All");
  const sharedAssets = workspace.shares.map((share) => ({ ...share, asset: assets.find((asset) => asset.id === share.assetId) })).filter((share) => share.asset);
  const readIds = workspace.readActivityIds || [];
  const unreadActivity = workspace.activity.filter((item) => !readIds.includes(item.id));
  const activityType = (message) => /role/i.test(message) ? "Roles" : /shar/i.test(message) ? "Sharing" : /invit|member|removed/i.test(message) ? "Members" : "Other";
  const visibleActivity = activityFilter === "All" ? workspace.activity : workspace.activity.filter((item) => activityType(item.message) === activityFilter);
  return <section className="workspace-view">
    <header className="workspace-header"><div><h1>{workspace.name}</h1><p>Manage members, access levels, and shared AI capabilities.</p></div><div className="workspace-header-actions"><button type="button" className="notification-button" aria-label="Open notifications" onClick={() => setNotificationsOpen((open) => !open)}><Bell size={17} />{unreadActivity.length ? <i>{unreadActivity.length}</i> : null}</button><span className={workspace.cloud ? "cloud-live" : "cloud-local"}>{workspace.cloud ? "Cloud synced" : "Local workspace"}</span><button type="button" onClick={onInvite}><UserPlus size={17} /> Invite member</button></div></header>
    {notificationsOpen ? <aside className="notification-panel" aria-label="Workspace notifications"><header><div><h2>Notifications</h2><p>{unreadActivity.length} unread update{unreadActivity.length === 1 ? "" : "s"}</p></div><button type="button" onClick={onMarkAllRead}><Check size={14} /> Mark all read</button></header>{workspace.activity.length ? workspace.activity.slice(0, 5).map((item) => <div className={`notification-row ${readIds.includes(item.id) ? "read" : "unread"}`} key={item.id}><i /><div><strong>{activityType(item.message)}</strong><p>{item.message}</p></div><time>{new Date(item.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</time></div>) : <div className="workspace-empty"><p>You’re all caught up.</p></div>}</aside> : null}
    <div className="permission-summary"><ShieldCheck size={28} weight="duotone" /><div><strong>Role-based access is active</strong><p>Owners manage workspace access, Editors can modify shared assets, and Viewers have read-only access.</p></div></div>
    <section className="members-panel"><header><div><h2>Members</h2><p>{workspace.members.length} workspace member{workspace.members.length === 1 ? "" : "s"}</p></div></header><div>{workspace.members.map((member) => <div className="member-row" key={member.id}><div className="member-avatar">{member.name === "You" ? "YO" : member.email.slice(0, 2).toUpperCase()}</div><div><strong>{member.name || member.email.split("@")[0]}</strong><span>{member.email}</span></div><span className={`member-status ${member.status.toLowerCase()}`}>{member.status}</span><select aria-label={`Role for ${member.email}`} value={member.role} disabled={member.role === "Owner"} onChange={(event) => onRoleChange(member.id, event.target.value)}><option>Owner</option><option>Editor</option><option>Viewer</option></select>{member.role === "Owner" ? <span className="owner-lock"><ShieldCheck size={15} /> Protected</span> : member.status === "Pending" ? <div className="invite-actions"><button type="button" onClick={() => onResend(member.id)}>Resend</button><button type="button" onClick={() => onRemove(member.id)}>Revoke</button></div> : <button type="button" className="remove-member" onClick={() => onRemove(member.id)}>Remove</button>}</div>)}</div></section>
    <section className="shared-assets-panel"><header><div><h2>Shared capabilities</h2><p>Assets available to this workspace.</p></div><span>{sharedAssets.length}</span></header>{sharedAssets.length ? <div>{sharedAssets.map((share) => <div className="shared-asset-row" key={share.assetId}><ShareNetwork size={18} /><div><strong>{share.asset.title}</strong><span>{share.asset.type} · v{share.asset.version}</span></div><span>{share.access}</span><time>{new Date(share.sharedAt).toLocaleDateString()}</time></div>)}</div> : <div className="workspace-empty"><ShareNetwork size={28} /><p>Share an asset from the Library to make it available here.</p></div>}</section>
    <section className="activity-panel"><header><div><h2>Audit log</h2><p>Filter workspace security and collaboration events.</p></div><div className="audit-filters"><Funnel size={14} />{["All", "Members", "Sharing", "Roles"].map((filter) => <button type="button" className={activityFilter === filter ? "active" : ""} onClick={() => setActivityFilter(filter)} key={filter}>{filter}</button>)}</div></header>{visibleActivity.length ? visibleActivity.slice(0, 10).map((item) => <div className="activity-row" key={item.id}><ClockCounterClockwise size={16} /><div><strong>{activityType(item.message)}</strong><p>{item.message}</p></div><time>{new Date(item.createdAt).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</time></div>) : <div className="workspace-empty"><p>No {activityFilter.toLowerCase()} activity yet.</p></div>}</section>
  </section>;
}

function CollaborationDialog({ mode, asset, open, onClose, onSubmit }) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState(mode === "share" ? "Viewer" : "Editor");
  useEffect(() => { if (open) { setEmail(""); setRole(mode === "share" ? "Viewer" : "Editor"); } }, [open, mode]);
  if (!open) return null;
  const submit = (event) => { event.preventDefault(); if (!email.trim()) return; onSubmit({ email: email.trim().toLowerCase(), role }); onClose(); };
  return <div className="auth-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><div className="auth-dialog collaboration-dialog" role="dialog" aria-modal="true" aria-labelledby="collaboration-title"><button type="button" className="auth-close" onClick={onClose} aria-label="Close"><X size={18} /></button><ShareNetwork size={28} className="collaboration-icon" /><h2 id="collaboration-title">{mode === "share" ? `Share ${asset?.type}` : "Invite member"}</h2><p>{mode === "share" ? asset?.title : "Invite someone to collaborate in this workspace."}</p><form onSubmit={submit}><label htmlFor="collab-email">Email address</label><input id="collab-email" type="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="teammate@company.com" /><label htmlFor="collab-role">Access role</label><select id="collab-role" value={role} onChange={(event) => setRole(event.target.value)}>{mode === "invite" ? <option>Editor</option> : null}<option>Viewer</option></select><div className="role-explainer"><ShieldCheck size={16} /><span>{role === "Editor" ? "Can view, edit, test, and improve shared assets." : "Can view and test shared assets without changing them."}</span></div><button type="submit">{mode === "share" ? "Share capability" : "Send invitation"}</button></form></div></div>;
}

function VersionHistory({ asset, versions }) {
  const ordered = [...versions].sort((a, b) => b.version - a.version);
  return <section className="version-history"><header><div><h2>Version history</h2><p>Every improvement is preserved.</p></div><span>{ordered.length} version{ordered.length === 1 ? "" : "s"}</span></header><div>{ordered.map((version) => <div className="version-row" key={`${version.id}-${version.version}`}><strong>v{version.version}</strong><span>{version.version === asset.version ? "Active" : "Archived"}</span><p>{version.summary}</p><time>{new Date(version.createdAt).toLocaleString()}</time></div>)}</div></section>;
}

function VersionComparison({ before, after }) {
  const beforeScore = evaluateAsset(before).overall;
  const afterScore = evaluateAsset(after).overall;
  return <section className="version-comparison"><header><div><h2>Version comparison</h2><p>Review what changed before using the active version.</p></div><span className="score-change">+{afterScore - beforeScore} points</span></header><div className="comparison-grid"><article><span>Before · v{before.version}</span><h3>{before.title}</h3><p>{before.summary}</p><strong>{beforeScore}/100</strong><ul>{before.sections.map((section) => <li key={section.label}>{section.label}</li>)}</ul></article><article className="improved"><span>Active · v{after.version}</span><h3>{after.title}</h3><p>{after.summary}</p><strong>{afterScore}/100</strong><ul>{after.sections.map((section) => <li key={section.label}>{section.label}</li>)}</ul></article></div></section>;
}

export function App() {
  const [intent, setIntent] = useState("Create a launch campaign for a sustainable skincare brand");
  const [mode, setMode] = useState("auto");
  const [tab, setTab] = useState("outline");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generated, setGenerated] = useState(false);
  const [activeAsset, setActiveAsset] = useState(null);
  const [assets, setAssets] = useState(() => loadAssets());
  const [versions, setVersions] = useState(() => loadVersionHistory());
  const [testSuites, setTestSuites] = useState(() => loadTestSuites());
  const [runHistory, setRunHistory] = useState(() => loadRunHistory());
  const [listings, setListings] = useState(() => loadListings());
  const [reviews, setReviews] = useState(() => loadReviews());
  const [reports, setReports] = useState(() => loadReports());
  const [purchases, setPurchases] = useState(() => loadPurchases());
  const [selectedCreator, setSelectedCreator] = useState("");
  const [workspace, setWorkspace] = useState(() => loadCollaboration());
  const [view, setView] = useState("home");
  const [providerStatus, setProviderStatus] = useState(null);
  const [session, setSession] = useState(null);
  const [authOpen, setAuthOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [collaborationDialog, setCollaborationDialog] = useState({ open: false, mode: "invite", asset: null });
  const [invitationResult, setInvitationResult] = useState(null);
  const [inviteAcceptStatus, setInviteAcceptStatus] = useState("idle");
  const inviteToken = useMemo(() => new URLSearchParams(window.location.search).get("invite"), []);
  const [launchAccessStatus,setLaunchAccessStatus]=useState("idle");
  const launchAccessToken=useMemo(()=>new URLSearchParams(window.location.search).get("launch_access"),[]);
  const[growthAssignment,setGrowthAssignment]=useState(null);
  const[lifecycleMessages,setLifecycleMessages]=useState([]);

  useEffect(() => saveAssets(assets), [assets]);
  useEffect(() => saveVersionHistory(versions), [versions]);
  useEffect(() => saveTestSuites(testSuites), [testSuites]);
  useEffect(() => saveRunHistory(runHistory), [runHistory]);
  useEffect(() => saveListings(listings), [listings]);
  useEffect(() => saveReviews(reviews), [reviews]);
  useEffect(() => saveReports(reports), [reports]);
  useEffect(() => savePurchases(purchases), [purchases]);
  useEffect(() => saveCollaboration(workspace), [workspace]);

  useEffect(() => {
    let active = true;
    getProviderStatus().then((status) => { if (active) setProviderStatus(status); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    let unsubscribe = () => {};
    getInitialSession().then((nextSession) => { if (active) setSession(nextSession); });
    subscribeToSession((nextSession) => setSession(nextSession)).then((cleanup) => {
      if (active) unsubscribe = cleanup;
      else cleanup();
    });
    return () => { active = false; unsubscribe(); };
  }, []);

  useEffect(() => {
    const accessToken = session?.access_token;
    if (!accessToken) return;
    let active = true;
    loadCloudAssets(accessToken).then((cloudAssets) => {
      if (!active || !cloudAssets.length) return;
      setAssets((localAssets) => {
        const byId = new Map(localAssets.map((asset) => [asset.id, asset]));
        cloudAssets.forEach((asset) => byId.set(asset.id, asset));
        return Array.from(byId.values()).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      });
    });
    return () => { active = false; };
  }, [session?.access_token]);

  useEffect(() => {
    const accessToken = session?.access_token;
    if (!accessToken) return;
    let active = true;
    loadCloudEntitlements(accessToken).then((cloudPurchases) => {
      if (!active || !cloudPurchases.length) return;
      setPurchases((localPurchases) => {
        const byAsset = new Map(localPurchases.map((purchase) => [purchase.assetId, purchase]));
        cloudPurchases.forEach((purchase) => byAsset.set(purchase.assetId, purchase));
        return Array.from(byAsset.values()).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      });
    });
    return () => { active = false; };
  }, [session?.access_token]);

  useEffect(() => {
    if (!inviteToken || !session?.access_token || inviteAcceptStatus !== "idle") return;
    setInviteAcceptStatus("loading");
    acceptCloudInvitation(session.access_token, inviteToken).then((acceptedWorkspace) => {
      if (!acceptedWorkspace) return setInviteAcceptStatus("error");
      applyCloudWorkspace(acceptedWorkspace);
      setView("workspace");
      setInviteAcceptStatus("accepted");
      window.history.replaceState({}, "", window.location.pathname);
    });
  }, [inviteToken, session?.access_token, inviteAcceptStatus]);

  useEffect(()=>{if(!launchAccessToken||!session?.access_token||launchAccessStatus!=="idle")return;setLaunchAccessStatus("loading");redeemBetaAccess(session.access_token,launchAccessToken).then(joined=>{if(!joined)return setLaunchAccessStatus("error");applyCloudWorkspace(joined);setView("workspace");setLaunchAccessStatus("accepted");window.history.replaceState({},"",window.location.pathname);});},[launchAccessToken,session?.access_token,launchAccessStatus]);
  useEffect(()=>{if(!session?.access_token){setGrowthAssignment(null);return;}assignGrowthVariant(session.access_token).then(setGrowthAssignment);},[session?.access_token]);
  useEffect(()=>{if(!session?.access_token){setLifecycleMessages([]);return;}loadInAppLifecycle(session.access_token).then(setLifecycleMessages);},[session?.access_token]);

  useEffect(() => {
    const accessToken = session?.access_token;
    if (!accessToken) return;
    let active = true;
    loadCloudWorkspace(accessToken).then((cloudWorkspace) => { if (active && cloudWorkspace) setWorkspace((current) => ({ ...cloudWorkspace, readActivityIds: current.readActivityIds || [] })); });
    return () => { active = false; };
  }, [session?.access_token]);

  useEffect(() => {
    if (!generated) return undefined;
    const timeout = window.setTimeout(() => setGenerated(false), 3200);
    return () => window.clearTimeout(timeout);
  }, [generated]);

  const recentSaved = useMemo(() => assets.slice(0, 5).map((asset) => ({
    title: asset.title,
    type: asset.type,
    time: "Saved",
    icon: asset.type === "Prompt" ? ChatCircleDots : asset.type === "Skill" ? Wrench : Briefcase,
  })), [assets]);

  const generate = async () => {
    setIsGenerating(true);
    setGenerated(false);
    trackActivation(session?.access_token,"intent_submitted",{properties:{mode,source:"creator"}});
    try {
      const asset = await generateAsset({ intent, mode, accessToken: session?.access_token });
      saveCloudAsset(asset, session?.access_token).catch(() => {});
      trackActivation(session?.access_token,"asset_generated",{assetId:asset.id,properties:{assetType:asset.type,mode,source:"creator"}});
      trackActivation(session?.access_token,"asset_saved",{assetId:asset.id,properties:{assetType:asset.type,source:"library"}});
      setActiveAsset(asset);
      setAssets((current) => [asset, ...current.filter((item) => item.id !== asset.id)]);
      setIsGenerating(false);
      setGenerated(true);
      setTab("result");
    } catch {
      setIsGenerating(false);
    }
  };

  const openAsset = (asset) => {
    setActiveAsset(asset);
    setIntent(asset.sourceIntent);
    setMode(asset.type.toLowerCase());
    setTab("result");
    setView("home");
  };

  const deleteAsset = (id) => {
    setAssets((current) => current.filter((asset) => asset.id !== id));
    deleteCloudAsset(id, session?.access_token).catch(() => {});
  };

  const persistImprovement = (previous, improved) => {
    setAssets((current) => current.map((asset) => asset.id === improved.id ? improved : asset));
    setVersions((current) => {
      const existing = current[improved.id] || [];
      const byVersion = new Map(existing.map((asset) => [asset.version, asset]));
      byVersion.set(previous.version, previous);
      byVersion.set(improved.version, improved);
      return { ...current, [improved.id]: Array.from(byVersion.values()) };
    });
    setActiveAsset(improved);
  };

  const installMarketplaceAsset = (templateAsset) => {
    const existing = assets.find((asset) => asset.marketplaceSourceId === templateAsset.id);
    if (existing) return existing;
    const installed = { ...templateAsset, id: crypto.randomUUID(), marketplaceSourceId: templateAsset.id, createdAt: new Date().toISOString(), provider: `marketplace:${templateAsset.creator}`, sourceIntent: templateAsset.summary };
    setAssets((current) => [installed, ...current]);
    setGenerated(true);
    setActiveAsset(installed);
    return installed;
  };
  const addReview = (assetId, rating, reviewText) => setReviews((current) => [{ id: crypto.randomUUID(), assetId, rating, text: reviewText.trim(), createdAt: new Date().toISOString() }, ...current]);
  const addReport = (assetId, reason) => setReports((current) => [{ id: crypto.randomUUID(), assetId, reason, status: "Open", createdAt: new Date().toISOString() }, ...current]);
  const completePurchase = (asset) => setPurchases((current) => current.some((item) => item.assetId === asset.id) ? current : [{ id: crypto.randomUUID(), assetId: asset.id, title: asset.title, creator: asset.creator, amount: asset.price, mode: "Stripe test", createdAt: new Date().toISOString() }, ...current]);

  const updateTestSuite = (assetId, cases) => setTestSuites((current) => ({ ...current, [assetId]: cases }));
  const recordRun = (assetId, run) => setRunHistory((current) => ({ ...current, [assetId]: [run, ...(current[assetId] || [])].slice(0, 20) }));
  const logWorkspaceActivity = (message) => ({ id: crypto.randomUUID(), message, createdAt: new Date().toISOString() });
  const applyCloudWorkspace = (cloudWorkspace) => setWorkspace((current) => ({ ...cloudWorkspace, readActivityIds: current.readActivityIds || [] }));
  const inviteMember = async ({ email, role }) => {
    const cloudResult = await inviteCloudMember(session?.access_token, email, role);
    if (cloudResult?.workspace) {
      applyCloudWorkspace(cloudResult.workspace);
      setInvitationResult(cloudResult.invitation);
      return;
    }
    setWorkspace((current) => ({ ...current, members: [...current.members.filter((member) => member.email !== email), { id: crypto.randomUUID(), email, name: "", role, status: "Pending" }], activity: [logWorkspaceActivity(`Invited ${email} as ${role}.`), ...current.activity] }));
  };
  const shareAsset = async ({ email, role }) => {
    const asset = collaborationDialog.asset;
    const cloudWorkspace = await shareCloudAsset(session?.access_token, asset.id, email, role);
    if (cloudWorkspace) return applyCloudWorkspace(cloudWorkspace);
    setWorkspace((current) => ({ ...current, members: current.members.some((member) => member.email === email) ? current.members : [...current.members, { id: crypto.randomUUID(), email, name: "", role, status: "Pending" }], shares: [...current.shares.filter((share) => share.assetId !== asset.id), { assetId: asset.id, email, access: role, sharedAt: new Date().toISOString() }], activity: [logWorkspaceActivity(`Shared ${asset.title} with ${email} as ${role}.`), ...current.activity] }));
  };
  const changeMemberRole = async (id, role) => {
    const cloudWorkspace = await updateCloudMember(session?.access_token, id, role);
    if (cloudWorkspace) return applyCloudWorkspace(cloudWorkspace);
    setWorkspace((current) => ({ ...current, members: current.members.map((member) => member.id === id ? { ...member, role } : member), activity: [logWorkspaceActivity(`Updated a member role to ${role}.`), ...current.activity] }));
  };
  const removeMember = async (id) => {
    const cloudWorkspace = await removeCloudMember(session?.access_token, id);
    if (cloudWorkspace) return applyCloudWorkspace(cloudWorkspace);
    setWorkspace((current) => { const member = current.members.find((item) => item.id === id); return { ...current, members: current.members.filter((item) => item.id !== id), shares: current.shares.filter((share) => share.email !== member?.email), activity: [logWorkspaceActivity(`Removed ${member?.email || "a member"} from the workspace.`), ...current.activity] }; });
  };
  const resendInvitation = async (id) => {
    const result = await resendCloudInvitation(session?.access_token, id);
    if (result?.workspace) {
      applyCloudWorkspace(result.workspace);
      setInvitationResult(result.invitation);
      return;
    }
    setInvitationResult({ delivery: "cloud-required", url: "" });
  };

  return (
    <div className={`app-shell ${view === "execution" ? "execution-layout" : ""}`}>
      <Sidebar mobileOpen={menuOpen} onClose={() => setMenuOpen(false)} view={view} setView={setView} assetCount={assets.length} session={session} onOpenAuth={() => setAuthOpen(true)} />
      {menuOpen ? <button className="mobile-scrim" aria-label="Close navigation" onClick={() => setMenuOpen(false)} /> : null}

      <main className="main-workspace">
        <header className="mobile-header">
          <Brand />
          <button type="button" className="mobile-menu-button" onClick={() => setMenuOpen(true)} aria-label="Open navigation">
            <Code size={24} />
          </button>
        </header>
        <div className="ambient-light" aria-hidden="true" />
        <div className={`workspace-content ${["library", "marketplace", "creators", "publishing", "moderation", "reports", "earnings", "playground", "execution", "analytics", "workspace", "settings", "admin"].includes(view) ? "library-content" : ""}`}>
          {view === "library" ? <LibraryView assets={assets} accessToken={session?.access_token} onOpen={openAsset} onDelete={deleteAsset} onShare={(asset) => setCollaborationDialog({ open: true, mode: "share", asset })} /> : view === "marketplace" ? <MarketplaceView installedAssets={assets} publishedListings={listings.filter((item) => item.status === "Approved")} reviews={reviews} purchases={purchases} accessToken={session?.access_token} onReview={addReview} onReport={addReport} onPurchase={completePurchase} onInstall={installMarketplaceAsset} onOpenInstalled={(asset) => { if (asset) openAsset(asset); }} onOpenCreator={(creator) => { setSelectedCreator(creator); setView("creators"); }} /> : view === "creators" ? <CreatorsView publishedListings={listings.filter((item) => item.status === "Approved")} reviews={reviews} selectedCreator={selectedCreator} onOpenMarketplace={() => setView("marketplace")} /> : view === "publishing" ? <PublishingView assets={assets} listings={listings} onChange={setListings} accessToken={session?.access_token} /> : view === "moderation" ? <ModerationView listings={listings} onChange={setListings} onOpenMarketplace={() => setView("marketplace")} /> : view === "reports" ? <ReportTriageView reports={reports} publishedListings={listings.filter((item) => item.status === "Approved")} onChange={setReports} /> : view === "earnings" ? <EarningsView purchases={purchases} /> : view === "playground" ? <PlaygroundView assets={assets} versions={versions} testSuites={testSuites} runHistory={runHistory} onTestSuitesChange={updateTestSuite} onRunRecorded={recordRun} onImprove={persistImprovement} accessToken={session?.access_token} /> : view === "execution" ? <AgentExecutionView assets={assets} accessToken={session?.access_token} /> : view === "analytics" ? <AnalyticsView assets={assets} runHistory={runHistory} /> : view === "workspace" ? <WorkspaceView workspace={workspace} assets={assets} onInvite={() => setCollaborationDialog({ open: true, mode: "invite", asset: null })} onRoleChange={changeMemberRole} onRemove={removeMember} onResend={resendInvitation} onMarkAllRead={() => setWorkspace((current) => ({ ...current, readActivityIds: current.activity.map((item) => item.id) }))} /> : view === "settings" ? <SettingsView status={providerStatus} session={session} onRefresh={() => getProviderStatus().then(setProviderStatus)} /> : view === "admin" ? <AdminPanel configured={providerStatus?.admin?.enabled} /> : <>
            <header className="page-header">
              <div><h1>What do you want to build?</h1><p>Type one idea. We’ll turn it into a professional Prompt, Skill, or Agent.</p></div>
              <div className={`provider-status ${providerStatus?.ai?.enabled ? "live" : "local"}`} title={providerStatus?.ai?.enabled ? providerStatus.ai.model : "Local structured generator"}>
                <span aria-hidden="true" />
                {providerStatus?.ai?.enabled ? "AI live" : "Local mode"}
              </div>
            </header>
            <Composer value={intent} onChange={setIntent} mode={mode} onModeChange={setMode} isGenerating={isGenerating} onGenerate={generate} generateLabel={growthAssignment?.label||"Generate"} />
            <RecentWork items={recentSaved.length ? recentSaved : recentItems} onViewAll={() => setView("library")} />
          </>}
        </div>
      </main>

      {view !== "execution" ? <Inspector tab={tab} setTab={setTab} asset={activeAsset} /> : null}
      {generated ? <div className="toast" role="status"><Check size={18} weight="bold" /> {activeAsset?.type} saved to your Library</div> : null}
      <AuthDialog open={authOpen} onClose={() => setAuthOpen(false)} session={session} />
      <CollaborationDialog open={collaborationDialog.open} mode={collaborationDialog.mode} asset={collaborationDialog.asset} onClose={() => setCollaborationDialog((current) => ({ ...current, open: false }))} onSubmit={collaborationDialog.mode === "share" ? shareAsset : inviteMember} />
      {inviteToken && !session ? <div className="invitation-banner"><ShieldCheck size={20} /><div><strong>Workspace invitation</strong><span>Sign in with the invited email address to accept access.</span></div><button type="button" onClick={() => setAuthOpen(true)}>Sign in to accept</button></div> : null}
      {launchAccessToken&&!session?<div className="invitation-banner"><Flag size={20}/><div><strong>Private beta access</strong><span>Sign in to redeem this secure single-use link.</span></div><button type="button" onClick={()=>setAuthOpen(true)}>Sign in to join</button></div>:null}
      {launchAccessStatus==="loading"?<div className="invitation-banner"><span className="spinner"/><div><strong>Joining beta…</strong><span>Checking rollout availability and cohort capacity.</span></div></div>:null}
      {launchAccessStatus==="error"?<div className="invitation-banner error"><X size={20}/><div><strong>Beta access unavailable</strong><span>The link is expired, full, revoked, or rollout is paused.</span></div></div>:null}
      {lifecycleMessages[0]?<div className="invitation-banner lifecycle-nudge"><Sparkle size={20}/><div><strong>{lifecycleMessages[0].title}</strong><span>{lifecycleMessages[0].detail}</span></div><button type="button" onClick={()=>{setView(lifecycleMessages[0].destination);setLifecycleMessages(current=>current.slice(1));}}>Open</button><button type="button" className="dismiss-invite" aria-label="Dismiss lifecycle message" onClick={()=>setLifecycleMessages(current=>current.slice(1))}><X size={15}/></button></div>:null}
      {inviteAcceptStatus === "loading" ? <div className="invitation-banner"><span className="spinner" /><div><strong>Accepting invitation…</strong><span>Verifying the secure one-time link.</span></div></div> : null}
      {inviteAcceptStatus === "error" ? <div className="invitation-banner error"><X size={20} /><div><strong>Invitation unavailable</strong><span>This link is expired, invalid, or belongs to another email.</span></div></div> : null}
      {invitationResult ? <div className="invitation-banner"><ShareNetwork size={20} /><div><strong>{invitationResult.delivery === "sent" ? "Invitation email sent" : invitationResult.delivery === "failed" ? "Email delivery failed" : invitationResult.delivery === "cloud-required" ? "Cloud delivery unavailable" : "Secure invite link created"}</strong><span>{invitationResult.delivery === "sent" ? "A new one-time link was delivered." : invitationResult.delivery === "cloud-required" ? "Connect Supabase to generate secure invitation links." : "Link expires in 7 days · Manual delivery available"}</span></div>{invitationResult.url ? <button type="button" onClick={() => navigator.clipboard.writeText(invitationResult.url)}>Copy link</button> : null}<button type="button" className="dismiss-invite" onClick={() => setInvitationResult(null)} aria-label="Dismiss invitation result"><X size={15} /></button></div> : null}
    </div>
  );
}
