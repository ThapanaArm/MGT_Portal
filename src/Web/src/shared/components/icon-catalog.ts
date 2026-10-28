
import {
  faFilter, faSliders, faTag, faMobileScreenButton, faCreditCard, faBox, faRobot, faChartColumn,
  faScrewdriverWrench, faBell, faChartLine, faReceipt, faIndustry,
  faTruck, faComment, faLock, faGlobe, faFlask, faGear, faClipboard,
  faMagnifyingGlass, faPlus, faCircleCheck, faRotate, faSitemap, faTrash,
  faWarehouse, faCalendarDays, faUsers, faCode, faArrowRight, faArrowUpRightFromSquare,
  faArrowLeft, faChevronDown, faChevronRight, faBars, faXmark, faCheck,
  faCircleInfo, faTriangleExclamation, faCircleExclamation, faSun, faMoon,
  faEye, faEyeSlash, faArrowRightFromBracket, faTableColumns, faPlay,
  faUpload, faHouse, faCircle, faEllipsis, faCopy, faShieldHalved,
} from "@fortawesome/free-solid-svg-icons";

export const ICON_OPTIONS = [
  ["sitemap", "Organization structure", faSitemap], ["mobile", "Phone", faMobileScreenButton],
  ["credit-card", "Credit card", faCreditCard], ["box", "Products", faBox],
  ["robot", "Automation", faRobot], ["chart-column", "Reports", faChartColumn],
  ["tools", "Tools", faScrewdriverWrench], ["bell", "Notifications", faBell],
  ["chart-line", "Analytics", faChartLine], ["receipt", "Receipt", faReceipt],
  ["industry", "Factory", faIndustry], ["truck", "Shipping", faTruck],
  ["comment", "Messages", faComment], ["lock", "Security", faLock],
  ["globe", "Website", faGlobe], ["flask", "Sandbox", faFlask],
  ["gear", "Settings", faGear], ["clipboard", "Requests", faClipboard],
  ["search", "Search", faMagnifyingGlass], ["plus", "Add", faPlus],
  ["check", "Approval", faCircleCheck], ["rotate", "Refresh", faRotate],
  ["trash", "Delete", faTrash], ["warehouse", "Inventory", faWarehouse],
  ["calendar", "Calendar", faCalendarDays], ["users", "People", faUsers],
  ["code", "API and code", faCode],
] as const;
const interfaceIcons = {
  filter: faFilter, sliders: faSliders, tag: faTag,
  "arrow-right": faArrowRight, "arrow-left": faArrowLeft, "external-link": faArrowUpRightFromSquare,
  "chevron-down": faChevronDown, "chevron-right": faChevronRight, bars: faBars, close: faXmark,
  tick: faCheck, info: faCircleInfo, warning: faTriangleExclamation, error: faCircleExclamation,
  sun: faSun, moon: faMoon, eye: faEye, "eye-slash": faEyeSlash, logout: faArrowRightFromBracket,
  sidebar: faTableColumns, play: faPlay, upload: faUpload, home: faHouse, circle: faCircle,
  ellipsis: faEllipsis, copy: faCopy, shield: faShieldHalved,
};
const legacyIcons: Record<string, string> = {
  "📱": "mobile", "💳": "credit-card", "📦": "box", "🤖": "robot", "📊": "chart-column",
  "🛠": "tools", "🔔": "bell", "📈": "chart-line", "🧾": "receipt", "🏭": "industry",
  "🚚": "truck", "💬": "comment", "🔒": "lock", "🔐": "lock", "🌐": "globe",
  "🧪": "flask", "⚙": "gear", "📋": "clipboard", "🔍": "search", "➕": "plus",
  "✅": "check", "🔄": "rotate", "🗑": "trash", "🏬": "warehouse", "🪪": "users",
  "🗓": "calendar", "💰": "credit-card", "👥": "users", "🏠": "home", "⚠": "warning",
};
export function iconKey(value: string) {
  return value.startsWith("fa:") ? value.slice(3) : legacyIcons[value.replace(/\uFE0F/g, "")] ?? "box";
}
export function resolveIcon(value: string) {
  const key = iconKey(value);
  return ICON_OPTIONS.find(([name]) => name === key)?.[2] ?? interfaceIcons[key as keyof typeof interfaceIcons] ?? faBox;
}