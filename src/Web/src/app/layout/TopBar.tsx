import { useNavigate } from "react-router";
import { useAuth } from "@/shared/lib/auth";
import { useLocale } from "@/shared/lib/locale-context";
import { AccountControls } from "@/shared/components/AccountControls";
export default function TopBar(){const {user,logout}=useAuth();const {t}=useLocale();const navigate=useNavigate();const role=user?t(`roles.${user.roleKey}`):"";return <header className="portal-topbar flex items-center justify-end"><AccountControls name={user?.displayName??""} email={user?.email??""} caption={user?.displayName===role?user?.email??"":role} items={[{label:"My Tokens",icon:"fa:lock",onSelect:()=>navigate("/tokens")},{label:t("common.logout"),icon:"fa:lock",danger:true,onSelect:()=>{logout();navigate("/login");}}]}/></header>;}
