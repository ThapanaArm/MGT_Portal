import { AppIcon } from "@/shared/components/Icon";
import type { ReactNode } from "react";
import "@/styles/feedback.css";
import { FEEDBACK_TITLES } from "./feedback-tokens";
import type { FeedbackTone } from "./feedback-tokens";
export type { FeedbackTone } from "./feedback-tokens";
export function FeedbackIcon({tone="info"}:{tone?:FeedbackTone}){return <span className={`mgt-feedback-icon ${tone}`} aria-hidden="true"><AppIcon value={tone === "success" ? "fa:tick" : tone === "danger" ? "fa:error" : tone === "warning" ? "fa:warning" : "fa:info"}/></span>;}
export function FeedbackClose({onClick,label="Dismiss notification"}:{onClick:()=>void;label?:string}){return <button type="button" className="mgt-feedback-close" aria-label={label} onClick={onClick}><AppIcon value="fa:close"/></button>;}
export function Alert({children,tone="info",title,onDismiss}:{children?:ReactNode;tone?:FeedbackTone;title?:string;onDismiss?:()=>void}){return <div className={`mgt-alert mgt-glass-alert ${tone}`} role={tone==="danger"?"alert":"status"}><FeedbackIcon tone={tone}/><div className="mgt-alert-copy"><strong>{title??FEEDBACK_TITLES[tone]}</strong>{children&&<div className="mgt-alert-description">{children}</div>}</div>{onDismiss&&<FeedbackClose onClick={onDismiss}/>}</div>;}
