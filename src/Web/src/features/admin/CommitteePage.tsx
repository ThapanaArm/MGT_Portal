import CommitteeSettings from "./CommitteeSettings";

/** Administration > Committee: the five people who review every request. */
export default function CommitteePage() {
  return <div>
    <header className="portal-page-heading"><h1>Committee</h1></header>
    <CommitteeSettings />
  </div>;
}
