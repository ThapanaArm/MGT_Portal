import { AppIcon } from "@/shared/components/Icon";
import type { PatternKind } from "./catalog";

/** Compact page-pattern previews adapted from the original Angular shell. */
export default function PatternPreview({ kind }: { kind: PatternKind }) {
  return <div className={`pattern-preview ${kind}`} aria-hidden="true">{body(kind)}</div>;
}

function Rail({ on }: { on: number }) {
  return (
    <div className="pp-sidebar">
      <b>M</b>
      {[0, 1, 2, 3].map((i) => <i key={i} className={i === on ? "on" : ""} />)}
    </div>
  );
}

function body(kind: PatternKind) {
  switch (kind) {
    case "dashboard":
      return (
        <>
          <Rail on={0} />
          <div className="pp-screen">
            <header><span>Dashboard</span><i /></header>
            <section className="pp-title"><div><small>OVERVIEW</small><b>Good morning, Alex</b></div><button tabIndex={-1}><AppIcon value="fa:plus"/> New report</button></section>
            <div className="pp-kpis">
              <i><small>Revenue</small><b>$84.2K</b><em>+12%</em></i>
              <i><small>Customers</small><b>1,429</b><em>+8%</em></i>
              <i><small>Tasks</small><b>32</b><em>6 due</em></i>
            </div>
            <div className="pp-chart">
              <span />
              <svg viewBox="0 0 300 70" preserveAspectRatio="none">
                <path d="M0 59 C45 62 43 28 83 39 S132 57 161 25 S218 43 252 12 S282 24 300 4" />
              </svg>
            </div>
          </div>
        </>
      );
    case "list":
      return (
        <>
          <Rail on={1} />
          <div className="pp-screen">
            <header><span>Projects</span><i /></header>
            <section className="pp-title"><div><small>MANAGEMENT</small><b>All projects</b></div><button tabIndex={-1}><AppIcon value="fa:plus"/> Add project</button></section>
            <div className="pp-toolbar"><span><AppIcon value="fa:search"/> Search projects</span><i>Status <AppIcon value="fa:chevron-down"/></i><i>Owner <AppIcon value="fa:chevron-down"/></i></div>
            <div className="pp-table">
              <b />
              {[1, 2, 3, 4].map((row) => <span key={row}><i /><strong /><em /><small /></span>)}
            </div>
          </div>
        </>
      );
    case "detail":
      return (
        <>
          <Rail on={1} />
          <div className="pp-screen">
            <header><span>Projects / Customer portal</span><i /></header>
            <section className="pp-title"><div><small>ACTIVE PROJECT</small><b>Customer portal</b></div><button tabIndex={-1}>Edit project</button></section>
            <nav className="pp-tabs"><b>Overview</b><span>Activity</span><span>Files</span></nav>
            <div className="pp-detail">
              <main><small>PROJECT SUMMARY</small><strong>Build a faster customer experience</strong><p /><p /><p className="short" /></main>
              <aside>
                <small>DETAILS</small>
                <span>Owner <b>Alex Morgan</b></span>
                <span>Status <em>Active</em></span>
                <span>Due date <b>24 Oct</b></span>
              </aside>
            </div>
          </div>
        </>
      );
    case "form":
      return (
        <>
          <Rail on={2} />
          <div className="pp-screen">
            <header><span>Customers / New customer</span><i /></header>
            <section className="pp-title"><div><small>CREATE RECORD</small><b>Add a customer</b></div></section>
            <div className="pp-form">
              <b>Contact information</b>
              <label>Full name<i>Alex Morgan</i></label>
              <label>Email address<i>alex@example.com</i></label>
              <label className="wide">Company<i>Northstar Labs</i></label>
              <label>Role<i>Product manager</i></label>
              <label>Status<i>Active⌄</i></label>
              <footer><button tabIndex={-1}>Cancel</button><button tabIndex={-1}>Save customer</button></footer>
            </div>
          </div>
        </>
      );
    case "login":
      return (
        <>
          <div className="pp-login-brand">
            <div className="login-motion">
              <i className="login-orb orb-a" />
              <i className="login-orb orb-b" />
              <i className="login-ring" />
              <span className="login-float float-lock"><AppIcon value="fa:tick"/> Secure access</span>
              <span className="login-float float-team"><AppIcon value="fa:circle"/> 24 teammates online</span>
            </div>
            <b className="login-logo">MGT</b>
            <strong>Build better systems.</strong>
            <span>One reliable foundation for every product team.</span>
            <i className="login-accent" />
          </div>
          <div className="pp-login-form">
            <small>WELCOME BACK</small>
            <b>Sign in to your workspace</b>
            <label>Email<i>name@company.com</i></label>
            <label>Password<i className="password-dots">••••••••</i></label>
            <button tabIndex={-1}>Sign in <em><AppIcon value="fa:arrow-right"/></em></button>
            <span>Forgot your password?</span>
          </div>
        </>
      );
    case "settings":
      return (
        <>
          <Rail on={3} />
          <div className="pp-screen">
            <header><span>Settings</span><i /></header>
            <section className="pp-title"><div><small>WORKSPACE</small><b>Settings</b></div><button tabIndex={-1}>Save changes</button></section>
            <div className="pp-settings">
              <nav><b>General</b><span>Members</span><span>Notifications</span><span>Security</span></nav>
              <main>
                <b>Workspace details</b>
                <label>Name<i>MGT Product Team</i></label>
                <label>Workspace URL<i>mgt-product</i></label>
                <hr />
                <div><span><b>Email notifications</b><small>Receive important workspace updates.</small></span><i /></div>
              </main>
            </div>
          </div>
        </>
      );
  }
}
