/** Component and page-pattern catalog shared with the original Angular explorer. Labels live in shared/lib/i18n.ts. */

export type CategoryKey =
  | "actions"
  | "forms"
  | "selection"
  | "navigation"
  | "menus"
  | "dataDisplay"
  | "status"
  | "people"
  | "content"
  | "feedback"
  | "loading"
  | "overlays"
  | "layout";

export type SpecimenType =
  | "filters"
  | "buttons"
  | "buttonstates"
  | "buttongroup"
  | "fields"
  | "inputtypes"
  | "fileupload"
  | "datetime"
  | "otp"
  | "slider"
  | "selection"
  | "tabs"
  | "navbar"
  | "pagination"
  | "stepper"
  | "menu"
  | "table"
  | "cards"
  | "list"
  | "areachart"
  | "stackedchart"
  | "combochart"
  | "horizontalchart"
  | "donutchart"
  | "piechart"
  | "barchart"
  | "linechart"
  | "stats"
  | "timeline"
  | "tree"
  | "badges"
  | "chips"
  | "avatars"
  | "accordion"
  | "alerts"
  | "toastdemo"
  | "progress"
  | "skeleton"
  | "overlay"
  | "popover"
  | "layout";

export interface ComponentGroup {
  category: CategoryKey;
  type: SpecimenType;
  selector: string;
}

export const COMPONENT_GROUPS: ComponentGroup[] = [
  { category: "selection", type: "filters", selector: "FilterToolbar / FilterChipGroup / ActiveFilterChips" },
  { category: "dataDisplay", type: "areachart", selector: "AreaChart" },
  { category: "dataDisplay", type: "stackedchart", selector: "StackedBarChart" },
  { category: "dataDisplay", type: "combochart", selector: "ComboChart" },
  { category: "dataDisplay", type: "horizontalchart", selector: "HorizontalBarChart" },
  { category: "dataDisplay", type: "donutchart", selector: "DonutChart" },
  { category: "dataDisplay", type: "piechart", selector: "PieChart" },
  { category: "dataDisplay", type: "barchart", selector: "BarChart" },
  { category: "dataDisplay", type: "linechart", selector: "LineChart" },
  { category: "actions", type: "buttons", selector: "mgt-button" },
  { category: "actions", type: "buttonstates", selector: "mgt-button-state" },
  { category: "actions", type: "buttongroup", selector: "mgt-button-group" },
  { category: "forms", type: "fields", selector: "mgt-field" },
  { category: "forms", type: "inputtypes", selector: "mgt-input" },
  { category: "forms", type: "fileupload", selector: "mgt-file-upload" },
  { category: "forms", type: "datetime", selector: "mgt-date-picker" },
  { category: "forms", type: "otp", selector: "mgt-otp" },
  { category: "forms", type: "slider", selector: "mgt-slider" },
  { category: "selection", type: "selection", selector: "mgt-selection" },
  { category: "navigation", type: "tabs", selector: "mgt-tabs" },
  { category: "navigation", type: "navbar", selector: "mgt-navigation" },
  { category: "navigation", type: "pagination", selector: "mgt-pagination" },
  { category: "navigation", type: "stepper", selector: "mgt-stepper" },
  { category: "menus", type: "menu", selector: "mgt-menu" },
  { category: "dataDisplay", type: "table", selector: "mgt-table" },
  { category: "dataDisplay", type: "cards", selector: "mgt-card" },
  { category: "dataDisplay", type: "list", selector: "mgt-list" },
  { category: "dataDisplay", type: "stats", selector: "mgt-stat" },
  { category: "dataDisplay", type: "timeline", selector: "mgt-timeline" },
  { category: "dataDisplay", type: "tree", selector: "mgt-tree" },
  { category: "status", type: "badges", selector: "mgt-badge" },
  { category: "status", type: "chips", selector: "mgt-chip" },
  { category: "people", type: "avatars", selector: "mgt-avatar" },
  { category: "content", type: "accordion", selector: "mgt-accordion" },
  { category: "feedback", type: "alerts", selector: "mgt-alert" },
  { category: "feedback", type: "toastdemo", selector: "mgt-toast" },
  { category: "feedback", type: "progress", selector: "mgt-progress" },
  { category: "loading", type: "skeleton", selector: "mgt-skeleton" },
  { category: "overlays", type: "overlay", selector: "mgt-dialog" },
  { category: "overlays", type: "popover", selector: "mgt-popover" },
  { category: "layout", type: "layout", selector: "mgt-page-layout" },
];

export type PatternKind = "dashboard" | "list" | "detail" | "form" | "login" | "settings";

export const PATTERNS: PatternKind[] = ["dashboard", "list", "detail", "form", "login", "settings"];

/** Brand colors resolve from active theme CSS variables. */
export const BRAND_COLORS = [
  { key: "blue", name: "MGT Blue", token: "--mgt-blue" },
  { key: "navy", name: "Deep Navy", token: "--mgt-navy" },
  { key: "green", name: "MGT Green", token: "--mgt-green" },
  { key: "sky", name: "Sky Tint", token: "--teal-soft" },
  { key: "canvas", name: "Canvas", token: "--mgt-canvas" },
] as const;

export const SPACES = [4, 8, 12, 16, 24, 32, 48];
