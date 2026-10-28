import { AppIcon } from "@/shared/components/Icon";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { FeedbackIcon, FeedbackClose } from "@/shared/components/feedback";
import { FEEDBACK_TITLES } from "@/shared/components/feedback-tokens";
import type { FeedbackTone } from "@/shared/components/feedback-tokens";
export type ToastOptions={title?:string;message:string;tone?:FeedbackTone;duration?:number;action?:{label:string;onClick:()=>void}};
type ToastInput=string|ToastOptions;
type ToastRecord=ToastOptions&{id:number;tone:FeedbackTone;duration:number};
const ToastContext=createContext<(input:ToastInput)=>void>(()=>{});
function ToastCard({item,onDismiss}:{item:ToastRecord;onDismiss:(id:number)=>void}){
 const [hovered,setHovered]=useState(false);const [focused,setFocused]=useState(false);const paused=hovered||focused;
 const remaining=useRef(item.duration);
 useEffect(()=>{if(paused||item.duration===0)return;const start=Date.now();const timer=setTimeout(()=>onDismiss(item.id),remaining.current);return()=>{clearTimeout(timer);remaining.current=Math.max(0,remaining.current-(Date.now()-start));};},[paused,item.id,item.duration,onDismiss]);
 return <div className={`mgt-toast ${item.tone}`} role={item.tone==="danger"?"alert":"status"} aria-atomic="true" onPointerEnter={()=>setHovered(true)} onPointerLeave={()=>setHovered(false)} onFocusCapture={()=>setFocused(true)} onBlurCapture={e=>{if(!e.currentTarget.contains(e.relatedTarget as Node|null))setFocused(false);}}><FeedbackIcon tone={item.tone}/><div className="mgt-toast-copy"><strong>{item.title??FEEDBACK_TITLES[item.tone]}</strong><p>{item.message}</p>{item.action&&<button type="button" className="mgt-toast-action" onClick={()=>{item.action?.onClick();onDismiss(item.id);}}>{item.action.label} <span aria-hidden="true"><AppIcon value="fa:external-link"/></span></button>}</div><FeedbackClose onClick={()=>onDismiss(item.id)}/>{item.duration>0&&<span className="mgt-toast-progress" aria-hidden="true"><span style={{animationDuration:`${item.duration}ms`,animationPlayState:paused?"paused":"running"}}/></span>}</div>;
}
export function ToastProvider({children}:{children:React.ReactNode}){const [items,setItems]=useState<ToastRecord[]>([]);const sequence=useRef(0);const dismiss=useCallback((id:number)=>setItems(old=>old.filter(item=>item.id!==id)),[]);const show=useCallback((input:ToastInput)=>{const options=typeof input==="string"?{message:input}:input;const tone=options.tone??"info";const next:ToastRecord={...options,id:++sequence.current,tone,duration:options.duration??(tone==="danger"?8000:5000)};setItems(old=>[...old.slice(-2),next]);},[]);return <ToastContext.Provider value={show}>{children}<section className="mgt-toast-stack" aria-label="Notifications">{items.map(item=><ToastCard key={item.id} item={item} onDismiss={dismiss}/>)}</section></ToastContext.Provider>;}
export function useToast(){return useContext(ToastContext);}
