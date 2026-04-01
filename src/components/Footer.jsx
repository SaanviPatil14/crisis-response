"use client";

import { usePathname } from "next/navigation";
import { Shield, Server, Database, Map, Circle } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/supabaseClient";

export default function Footer() {
  const pathname = usePathname();
  const [dbStatus, setDbStatus] = useState("connecting");

  // Real-time Database Health Check
  useEffect(() => {
    async function checkStatus() {
      const { error } = await supabase.from('incidents').select('id').limit(1);
      setDbStatus(error ? "offline" : "online");
    }
    checkStatus();
  }, []);

  // HIDE FOOTER ON STAFF PAGE (It ruins the mobile app feel)
  if (pathname === "/staff") return null;

  return (
    <footer className="border-t border-slate-800 bg-slate-950/80 backdrop-blur-md py-4 px-6 z-30 font-mono">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
        
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-slate-500 text-[10px] tracking-widest uppercase font-bold">
            <Shield size={14} className="text-sky-500" />
            <span>CITYGUARD PROTOCOL v1.0.4</span>
          </div>
          
          {/* LIVE SYSTEM STATUS INDICATOR */}
          <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded border text-[9px] font-black tracking-tighter uppercase 
            ${dbStatus === "online" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30" : "bg-red-500/10 text-red-400 border-red-500/30"}`}>
            <Circle size={8} fill="currentColor" className={dbStatus === "online" ? "animate-pulse" : ""} />
            {dbStatus === "online" ? "POSTGRES: ACTIVE" : "POSTGRES: DISCONNECTED"}
          </div>
        </div>
        
        <div className="flex items-center gap-6 text-[10px] font-black tracking-widest text-slate-500">
          <div className="flex items-center gap-1.5 hover:text-slate-300 transition-colors">
            <Server size={14} className="text-slate-400"/> NEXT.JS
          </div>
          <div className="flex items-center gap-1.5 hover:text-emerald-400 transition-colors">
            <Database size={14} className="text-emerald-500/70"/> SUPABASE
          </div>
          <div className="flex items-center gap-1.5 hover:text-blue-400 transition-colors">
            <Map size={14} className="text-blue-500/70"/> POSTGIS
          </div>
        </div>
      </div>
    </footer>
  );
}