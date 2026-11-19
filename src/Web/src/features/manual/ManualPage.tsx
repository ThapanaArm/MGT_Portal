import "./manual.css";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { AppIcon } from "@/shared/components/Icon";

/**
 * MGT Portal user manual. Opens in its own tab from Getting Started (/manual), so it has its own
 * simple layout instead of the portal sidebar. Keep it in step with the real workflow:
 * ApplicationWorkflow.cs (approval rules), DevelopmentRequestPanel.tsx (stages), AppShowcase.tsx (states).
 */
interface Section { id: string; title: string; body: ReactNode }

const SECTIONS: Section[] = [
  {
    id: "start", title: "1. Getting around",
    body: <>
      <p>Sign in with your company email and password. After sign-in you land on the <strong>MGT Ecosystem</strong>.</p>
      <ul>
        <li><strong>MGT Ecosystem</strong>: every approved company app in one place.</li>
        <li><strong>My application requests</strong>: the requests you created and their progress.</li>
        <li><strong>Getting Started</strong>: a short guide to the request steps and tiers, with a link to this manual.</li>
        <li><strong>Web APIs</strong>: the API Catalog and one page per API category (Sales, Purchase, ...).</li>
        <li><strong>App Management</strong> (IT) or <strong>Requests and reviews</strong> (committee members): review work.</li>
      </ul>
      <p>The sun and moon switch at the top changes between light and dark theme. The menu button (three lines) at the top left opens or hides the sidebar.</p>
    </>,
  },
  {
    id: "ecosystem", title: "2. MGT Ecosystem: find and open apps",
    body: <>
      <p>Search by name or filter by API category, then select an app to see its page.</p>
      <ul>
        <li><strong>Open</strong> goes to the app's company domain (<code>https://&lt;name&gt;.megachem.co.th</code>) in a new tab. It is grey when the app cannot be opened yet; point at it to see why.</li>
        <li><strong>Share</strong> copies the link to the app's page in the Portal.</li>
        <li>The chips show the app's state, its owner and its tier.</li>
        <li>Below are screenshots (select one to view it large) and the app's description and categories.</li>
      </ul>
      <p>The apps themselves run outside the Portal and keep their own data. The Portal is the catalogue that links to them.</p>
    </>,
  },
  {
    id: "tiers", title: "3. Choose the right tier",
    body: <>
      <table>
        <thead><tr><th>Tier</th><th>For</th><th>Company APIs</th><th>Approval</th></tr></thead>
        <tbody>
          <tr><td><strong>Register</strong></td><td>A personal or small tool</td><td>No</td><td>3 of 5 committee approvals. No IT code review.</td></tr>
          <tr><td><strong>Verify</strong></td><td>An internal business app</td><td>Yes</td><td>All 5 committee approvals and an IT code review.</td></tr>
          <tr><td><strong>Official</strong></td><td>An official IT system (IT only)</td><td>Yes</td><td>All 5 committee approvals and an IT code review.</td></tr>
        </tbody>
      </table>
      <p>Selecting any company API service moves a request from Register to Verify, because Register cannot use company APIs.</p>
    </>,
  },
  {
    id: "request", title: "4. Create an application request",
    body: <>
      <ol>
        <li>Go to <strong>My application requests</strong> and choose <strong>Register your application</strong>.</li>
        <li><strong>Application details</strong>: name, purpose, the subdomain you want, logo or icon, and screenshots (optional but recommended).</li>
        <li><strong>Audience and tier</strong>: who can use the app (only me, my department, entire company), the tier and the company services (API categories) it needs.</li>
        <li><strong>Review summary</strong>: check everything, then save. Saving creates a draft; nothing is sent yet.</li>
      </ol>
      <p>Open the draft to continue. While it is a draft, <strong>Edit request</strong> at the top changes everything in one form, including the development accounts.</p>
    </>,
  },
  {
    id: "development", title: "5. Development access and IT preparation",
    body: <>
      <ol>
        <li>In the draft, check <strong>Development mode</strong> and the <strong>company Microsoft accounts</strong> of the developers: Solo is one account, Collaboration is two or more. Change them with <strong>Edit request</strong>.</li>
        <li>Choose <strong>Request development access</strong>. The request moves to <strong>IT preparation</strong>.</li>
        <li>IT creates the GitHub repository, gives each developer Git access and prepares API access when the app uses company APIs.</li>
        <li>When IT finishes, the request moves to <strong>Development</strong> and Sandbox API keys are issued for the requested categories.</li>
      </ol>
    </>,
  },
  {
    id: "build", title: "6. Develop and request deployment",
    body: <>
      <ul>
        <li>Build the app in the GitHub repository. Use the <strong>Sandbox</strong> keys from <em>API credentials</em> on the request page; Sandbox calls reach test systems.</li>
        <li>Add screenshots of the real screens while you develop; they appear on the app page in the Ecosystem.</li>
        <li>When your code is pushed to Git, choose <strong>Request deployment</strong>. IT records the branch and commit to deploy.</li>
        <li>Book a deployment date or a meeting with IT in the <strong>IT Calendar</strong>.</li>
        <li>The request goes to the committee (and to IT code review for Verify and Official).</li>
      </ul>
    </>,
  },
  {
    id: "review", title: "7. Committee review",
    body: <>
      <p>One committee of five people, chosen by IT, reviews every request. If the requester is on the committee, they sit out their own request and the other four decide (Register then needs 3 of 4, Verify and Official all 4). Each member decides with their own account:</p>
      <ul>
        <li><strong>Approve</strong>: an optional comment.</li>
        <li><strong>Request changes</strong>: a reason is required. The request goes back to the requester, who fixes it and requests deployment again; a new review round starts.</li>
        <li><strong>Reject</strong>: a reason is required. For Verify and Official one rejection closes the request. For Register the request closes once three members reject, because 3 approvals are then impossible.</li>
      </ul>
      <p>A rejected request is closed: it cannot be edited or sent again, its API keys are revoked and the reasons are shown at the top of the request page. IT can reopen it for development with a reason (Review queue, Rejected tab); it then comes back to you to fix and request deployment again, and the committee reviews it in a new round. Otherwise, create a new request to try again.</p>
      <p>The request is approved when it has the approvals it needs (and a passed IT code review for Verify and Official).</p>
    </>,
  },
  {
    id: "live", title: "8. After approval: deployment and updates",
    body: <>
      <ul>
        <li><strong>Deploying</strong>: IT deploys the approved version. The app appears in the Ecosystem; it may not be ready to use yet.</li>
        <li><strong>Deployed</strong>, then <strong>Live</strong>: IT confirms the deployment and the go-live. <strong>Open</strong> works from now on.</li>
        <li><strong>Request update</strong> (on a live app): describe the new version, branch and commit. The update goes through review again while the current version stays live.</li>
        <li><strong>Suspended</strong>: IT can suspend an approved app. All its API keys stop working at once. When IT reactivates it, new keys are issued and must be put into the app again.</li>
      </ul>
    </>,
  },
  {
    id: "catalog", title: "9. API Catalog",
    body: <>
      <ul>
        <li><strong>Business view</strong>: what each API does, a live try for read-only APIs and your access status. <strong>Request access</strong> takes you to your application requests.</li>
        <li><strong>Developer view</strong>: Sandbox / Production switch, base URL, cURL and JSON examples, and <strong>Copy for AI</strong> to paste the API contract into Claude.</li>
        <li>An API marked <strong>Documentation only</strong> is described in the catalogue but cannot be called yet.</li>
        <li>What you can read or change through an API also depends on your own data permissions (for example, sales staff see their own data).</li>
      </ul>
    </>,
  },
  {
    id: "keys", title: "10. API keys and personal tokens",
    body: <>
      <table>
        <thead><tr><th>Who</th><th>Sandbox key</th><th>Production key</th></tr></thead>
        <tbody>
          <tr><td>App owner and listed developers</td><td>View and copy</td><td>Hidden; IT adds it at deployment</td></tr>
          <tr><td>IT administrators</td><td>View and copy</td><td>View, copy, regenerate, revoke</td></tr>
        </tbody>
      </table>
      <p>Each API category has its own key per environment. Keep secrets in the app's backend, never in browser code. Personal tokens in <strong>My tokens</strong> are shown once when created, so copy them straight away.</p>
    </>,
  },
  {
    id: "it", title: "11. For IT administrators",
    body: <>
      <ul>
        <li><strong>App Management</strong> in the sidebar:
          <ul>
            <li><strong>Review queue</strong>: follow committee decisions and do the IT code review. The Rejected tab lists requests closed by the committee; reopen one for development with a reason.</li>
            <li><strong>IT preparation</strong>: requests waiting for GitHub and API access, oldest first.</li>
            <li><strong>Deployment</strong>: approved apps to deploy and take live.</li>
          </ul>
        </li>
        <li><strong>Committee</strong> (Administration): choose the five committee members used for every request. Changes apply to requests in review right away.</li>
        <li><strong>Manage APIs</strong>: <em>Categories</em> to add, edit or delete API categories (a category can be deleted only when it has no APIs); <em>APIs</em> to add, edit or delete APIs, filtered by category, method and source platform.</li>
        <li><strong>Access control</strong>: which APIs each person can use and what they can do.</li>
        <li><strong>User management</strong>: sync accounts from the company user directory and set levels.</li>
        <li><strong>Audit &amp; work summary</strong>: who changed what, with before and after values.</li>
      </ul>
    </>,
  },
  {
    id: "states", title: "12. Request states",
    body: <>
      <table>
        <thead><tr><th>State</th><th>Meaning</th></tr></thead>
        <tbody>
          <tr><td>Draft</td><td>Being prepared by the requester; can be edited.</td></tr>
          <tr><td>IT preparation</td><td>IT is setting up GitHub and API access.</td></tr>
          <tr><td>Development</td><td>The requester is building the app with Sandbox keys.</td></tr>
          <tr><td>Changes requested</td><td>The committee or IT asked for changes; fix and request deployment again.</td></tr>
          <tr><td>In review</td><td>Waiting for committee decisions (and IT code review).</td></tr>
          <tr><td>Deploying</td><td>Approved; IT is deploying it.</td></tr>
          <tr><td>Deployed / Live</td><td>Deployed by IT / confirmed live and ready to use.</td></tr>
          <tr><td>Suspended</td><td>Stopped by IT; API keys disabled.</td></tr>
          <tr><td>Rejected</td><td>Closed by the committee. IT can reopen it for development; otherwise create a new request.</td></tr>
        </tbody>
      </table>
    </>,
  },
  {
    id: "calendar", title: "13. IT Calendar",
    body: <>
      <ul>
        <li>The calendar shows when IT is available, scheduled deployments, meetings and freeze periods (no deployments).</li>
        <li>Choose a day, then <strong>Book</strong> inside an IT available slot: a meeting, or a deployment for one of your approved apps.</li>
        <li>IT confirms or declines with a reason. You can cancel your own booking. Other people's bookings show only as Booked.</li>
        <li>Your app's request page lists its booked dates.</li>
      </ul>
    </>,
  },
  {
    id: "help", title: "14. Help",
    body: <p>Contact IT support at <a href="mailto:it@megachem.co.th">it@megachem.co.th</a>, Monday to Friday, 08:00–17:00.</p>,
  },
];

/** Card icon, one-line summary and extra search words for each topic (the article text is in SECTIONS). */
const META: Record<string, { icon: string; summary: string; keywords: string }> = {
  start: { icon: "fa:home", summary: "Sign in, the sidebar menu, theme and where everything is.", keywords: "sign in login menu sidebar theme dark" },
  ecosystem: { icon: "fa:globe", summary: "Find company apps, open them and share their page.", keywords: "apps open share screenshots catalogue" },
  tiers: { icon: "fa:sitemap", summary: "Register, Verify or Official: what each needs to be approved.", keywords: "tier register verify official approval" },
  request: { icon: "fa:clipboard", summary: "Prepare your request in three steps and save it as a draft.", keywords: "create request form draft edit subdomain logo" },
  development: { icon: "fa:tools", summary: "Ask for GitHub and API access for your developers.", keywords: "git github developers solo collaboration it preparation" },
  build: { icon: "fa:code", summary: "Build with Sandbox keys, then request deployment.", keywords: "sandbox branch commit deployment request" },
  review: { icon: "fa:users", summary: "How the committee approves, asks for changes or rejects.", keywords: "committee approve reject changes votes 3 of 5" },
  live: { icon: "fa:upload", summary: "Deploying, going live, updates and suspension.", keywords: "deploy live update version suspend reactivate" },
  catalog: { icon: "fa:search", summary: "Explore company APIs in business or developer view.", keywords: "api catalog business developer curl json claude" },
  keys: { icon: "fa:lock", summary: "Who can see and copy Sandbox and Production keys.", keywords: "credentials token secret production sandbox copy" },
  it: { icon: "fa:gear", summary: "App Management, APIs, access, users and audit.", keywords: "admin it review queue deployment manage apis access users audit" },
  states: { icon: "fa:info", summary: "What every request state means.", keywords: "status state draft review deploying live rejected" },
  calendar: { icon: "fa:calendar", summary: "Book IT time for a deployment or a meeting.", keywords: "calendar book schedule deploy date meeting freeze available" },
  help: { icon: "fa:comment", summary: "Contact IT support.", keywords: "contact support email hours" },
};
const POPULAR = ["request", "review", "keys"];

const currentId = () => decodeURIComponent(window.location.hash.replace(/^#/, ""));

export default function ManualPage() {
  const [active, setActive] = useState(currentId);
  const [query, setQuery] = useState("");

  useEffect(() => {
    const onHash = () => { setActive(currentId()); window.scrollTo({ top: 0 }); };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return SECTIONS;
    return SECTIONS.filter(section => `${section.title} ${META[section.id]?.summary} ${META[section.id]?.keywords}`.toLowerCase().includes(q));
  }, [query]);

  const index = SECTIONS.findIndex(section => section.id === active);
  const article = index >= 0 ? SECTIONS[index] : null;
  const title = (section: Section) => section.title.replace(/^\d+\.\s*/, "");

  return (
    <div className="help-page">
      <header className="help-nav">
        <a href="/ecosystem" className="help-brand" aria-label="MGT Ecosystem">
          <img src="/mgt-logo.png" alt="" />
          <span>MGT Portal</span>
        </a>
        <a href="#" className="help-home" aria-current={article ? undefined : "page"}>Help Center</a>
        <div className="help-nav-actions">
          {article && <button type="button" className="help-print" onClick={() => window.print()}><AppIcon value="fa:clipboard" /> Print</button>}
          <a href="/ecosystem" className="help-portal"><AppIcon value="fa:globe" /> Open MGT Ecosystem</a>
        </div>
      </header>

      {!article ? <>
        <section className="help-hero">
          <h1>Help Center</h1>
          <p>Explore the <strong>MGT Portal</strong> guide for answers on requesting, building and opening company apps.</p>
          <label className="help-search">
            <AppIcon value="fa:search" />
            <input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Search your keyword" aria-label="Search the user manual" />
          </label>
          <div className="help-popular">
            <span>Popular topics:</span>
            {POPULAR.map(id => { const section = SECTIONS.find(item => item.id === id)!; return <a key={id} href={`#${id}`}>{title(section)}</a>; })}
          </div>
        </section>

        <section className="help-grid" aria-label="Topics">
          {results.map(section => (
            <a key={section.id} href={`#${section.id}`} className="help-card">
              <span className="help-card-icon"><AppIcon value={META[section.id]?.icon ?? "fa:info"} /></span>
              <strong>{title(section)}</strong>
              <p>{META[section.id]?.summary}</p>
              <span className="help-card-more">Learn more <AppIcon value="fa:arrow-right" /></span>
            </a>
          ))}
          {!results.length && <p className="help-empty">No topics match “{query}”. Try another keyword.</p>}
        </section>
      </> : (
        <div className="help-article-layout">
          <nav className="help-topics" aria-label="Topics">
            <a href="#" className="help-back"><AppIcon value="fa:arrow-left" /> All topics</a>
            <ol>{SECTIONS.map(section => <li key={section.id}><a href={`#${section.id}`} aria-current={section.id === article.id ? "page" : undefined}><AppIcon value={META[section.id]?.icon ?? "fa:info"} />{title(section)}</a></li>)}</ol>
          </nav>
          <article className="help-article">
            <p className="help-crumb"><a href="#">Help Center</a> / {title(article)}</p>
            <h1><span className="help-card-icon"><AppIcon value={META[article.id]?.icon ?? "fa:info"} /></span>{title(article)}</h1>
            <div className="manual-content">{article.body}</div>
            <footer className="help-pager">
              {index > 0 ? <a href={`#${SECTIONS[index - 1].id}`}><AppIcon value="fa:arrow-left" /><span><small>Previous</small>{title(SECTIONS[index - 1])}</span></a> : <span />}
              {index < SECTIONS.length - 1 && <a href={`#${SECTIONS[index + 1].id}`} className="is-next"><span><small>Next</small>{title(SECTIONS[index + 1])}</span><AppIcon value="fa:arrow-right" /></a>}
            </footer>
          </article>
        </div>
      )}
    </div>
  );
}
