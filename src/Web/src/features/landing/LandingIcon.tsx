// Lucide icon paths (ISC), kept local to the landing page.
const paths = {
  arrowRight: "M5 12h14m-7-7 7 7-7 7",
  fileText: "M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Zm-1 0v4a2 2 0 0 0 2 2h4M10 9H8m8 4H8m8 4H8",
  chartLine: "M3 3v16a2 2 0 0 0 2 2h16M7 14l4-4 4 4 6-6",
  warehouse: "M3 21V8a2 2 0 0 1 1.1-1.8l7-3.5a2 2 0 0 1 1.8 0l7 3.5A2 2 0 0 1 21 8v13M3 21h18M7 21V10h10v11M7 14h10M7 17h10",
  plus: "M5 12h14m-7-7v14",
  users: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2m20 0v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z",
  check: "m20 6-11 11-5-5",
  code: "m16 18 6-6-6-6M8 6l-6 6 6 6",
  box: "M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16ZM3.3 7l8.7 5 8.7-5M12 22V12",
};

export function LandingIcon({ name }: { name: keyof typeof paths }) {
  return (
    <svg aria-hidden="true" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d={paths[name]} />
    </svg>
  );
}
