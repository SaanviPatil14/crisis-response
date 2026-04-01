"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/supabaseClient";
import { Shield, MapPin, X, History, FileText, Clock, CheckCircle2, Activity, Zap, Ambulance } from "lucide-react";

export default function CommandPage() {
  const [dbAlerts, setDbAlerts] = useState([]);
  const [view, setView] = useState("LIVE"); 
  const [selectedIncident, setSelectedIncident] = useState(null);
  const [noteInput, setNoteInput] = useState("");

  useEffect(() => {
    fetchData();
    const channel = supabase.channel('incidents_sync').on('postgres_changes', { event: '*', schema: 'public', table: 'incidents' }, () => fetchData()).subscribe();
    return () => supabase.removeChannel(channel);
  }, [view]);

  const fetchData = async () => {
    const query = supabase.from('incidents').select('*').order('created_at', { ascending: false });
    const { data } = view === "LIVE" ? await query.neq('status', 'RESOLVED') : await query.eq('status', 'RESOLVED');
    if (data) setDbAlerts(data);
  };

  const handleSaveNote = async () => {
    if (!selectedIncident || !noteInput) return;

    const { data, error } = await supabase
      .from('incidents')
      .update({ notes: noteInput }) // Make sure the column name in DB is exactly 'notes'
      .eq('id', selectedIncident.id)
      .select(); // This returns the updated row so we can update the UI

    if (error) {
      console.error("Save Error:", error.message);
      alert("Database error: " + error.message);
    } else {
      // Success: Update the local state so the note appears instantly
      setSelectedIncident(data[0]); 
      setNoteInput(""); // Clear the box
      fetchData(); // Refresh the list
      alert("Record updated.");
    }
  };

  const handleResolve = async (id) => {
    await supabase.from('incidents').update({ 
      status: 'RESOLVED',
      resolved_at: new Date().toISOString() 
    }).eq('id', id);
    setSelectedIncident(null);
  };

  const getDuration = (start, end) => {
    if (!start || !end) return "Pending...";
    const diff = new Date(end) - new Date(start);
    const sec = Math.floor(diff / 1000);
    return sec > 60 ? `${Math.floor(sec/60)}m ${sec%60}s` : `${sec}s`;
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-mono uppercase text-[11px]">
      {/* HEADER */}
      <header className="px-6 py-4 border-b border-slate-800 bg-slate-900 flex justify-between items-center z-30">
        <div className="flex items-center gap-3">
          <Shield size={20} className="text-sky-400" />
          <h1 className="font-black tracking-[.2em]">CityGuard Forensic Command</h1>
        </div>
        <div className="flex bg-slate-950 p-1 rounded-lg border border-slate-800">
          <button onClick={() => setView("LIVE")} className={`px-6 py-1.5 rounded font-black transition-all ${view === "LIVE" ? "bg-sky-600 text-white" : "text-slate-500"}`}>LIVE OPS</button>
          <button onClick={() => setView("ARCHIVE")} className={`px-6 py-1.5 rounded font-black transition-all ${view === "ARCHIVE" ? "bg-slate-700 text-white" : "text-slate-500"}`}>ARCHIVE</button>
        </div>
      </header>

      <div className="flex-1 grid grid-cols-12 overflow-hidden">
        {/* LIST */}
        <div className="col-span-3 border-r border-slate-800 overflow-y-auto p-4 space-y-2 bg-slate-950">
          {dbAlerts.map(inc => (
            <div key={inc.id} onClick={() => {setSelectedIncident(inc); setNoteInput(inc.notes || "");}} 
              className={`p-3 rounded-lg border cursor-pointer transition-all ${selectedIncident?.id === inc.id ? 'border-sky-500 bg-sky-500/10' : 'border-slate-800 bg-slate-900/40 hover:bg-slate-900'}`}>
              <div className="flex justify-between items-center mb-1">
                <span className={`text-[8px] font-black px-1.5 py-0.5 rounded ${inc.status === 'CODE_BLUE' ? 'bg-red-600 text-white' : 'bg-slate-800 text-slate-500'}`}>{inc.status}</span>
                <span className="text-[8px] text-slate-600 font-bold">{new Date(inc.created_at).toLocaleTimeString()}</span>
              </div>
              <h3 className="font-black text-slate-200 truncate">{inc.label}</h3>
            </div>
          ))}
        </div>

        {/* MAP */}
        <div className="col-span-4 relative bg-slate-900 border-r border-slate-800">
           <div className="absolute inset-0 opacity-10"><svg width="100%" height="100%"><defs><pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse"><path d="M 40 0 L 0 0 0 40" fill="none" stroke="white" strokeWidth="1"/></pattern></defs><rect width="100%" height="100%" fill="url(#grid)" /></svg></div>
           {dbAlerts.map((a, i) => (
             <div key={a.id} className="absolute" style={{ top: `${20 + (i*12)}%`, left: `${30 + (i*10)}%` }}>
                <MapPin className={a.status === 'CODE_BLUE' ? "text-red-500 animate-pulse" : "text-orange-500"} size={20} />
             </div>
           ))}
        </div>

        {/* FULL AUDIT LOG PANEL */}
        <div className="col-span-5 bg-slate-950 overflow-y-auto p-8 space-y-8">
          {selectedIncident ? (
            <div className="animate-in fade-in duration-300">
              <div className="flex justify-between items-start border-b border-slate-800 pb-6 mb-8">
                <div>
                  <p className="text-sky-400 font-black mb-1 tracking-widest">Incident Intelligence</p>
                  <h2 className="text-2xl font-black italic">CASE ID: #{selectedIncident.id.toString().slice(-4)}</h2>
                </div>
                <button onClick={() => setSelectedIncident(null)} className="p-2 bg-slate-800 rounded-full"><X size={16}/></button>
              </div>

              {/* THE FULL AUDIT LOG TIMELINE */}
              <div className="space-y-6">
                <h4 className="text-slate-500 font-black tracking-widest flex items-center gap-2"><History size={14}/> DETAILED RESPONSE TELEMETRY</h4>
                <div className="border-l-2 border-slate-800 ml-2 space-y-8">
                  
                  {/* SENSOR TRIGGER */}
                  <div className="relative pl-8">
                    <div className="absolute -left-2.25 top-1 w-4 h-4 rounded-full bg-slate-800 border-2 border-slate-950 flex items-center justify-center"><Zap size={8} className="text-violet-400"/></div>
                    <div className="flex justify-between">
                      <p className="font-black text-slate-200 uppercase tracking-wide">1. SENSOR_TRIGGERED</p>
                      <p className="text-slate-500 font-bold">{new Date(selectedIncident.created_at).toLocaleTimeString()}</p>
                    </div>
                    <p className="text-slate-600 mt-1 italic">IoT Edge Node detected anomaly at {selectedIncident.sublabel}</p>
                  </div>

                  {/* IDENTIFIED (Confirmed by Staff) */}
                  <div className={`relative pl-8 ${!selectedIncident.confirmed_at && 'opacity-30'}`}>
                    <div className="absolute -left-2.25 top-1 w-4 h-4 rounded-full bg-slate-800 border-2 border-slate-950 flex items-center justify-center"><CheckCircle2 size={8} className="text-sky-400"/></div>
                    <div className="flex justify-between">
                      <p className="font-black text-slate-200">2. INCIDENT_IDENTIFIED</p>
                      <p className="text-slate-500 font-bold">{selectedIncident.confirmed_at ? new Date(selectedIncident.confirmed_at).toLocaleTimeString() : 'Awaiting...'}</p>
                    </div>
                    <p className="text-sky-600 mt-1 font-bold">Identification Lag: {getDuration(selectedIncident.created_at, selectedIncident.confirmed_at)}</p>
                  </div>

                  {/* DISPATCHED (Ambulance) */}
                  <div className={`relative pl-8 ${!selectedIncident.dispatched_at && 'opacity-30'}`}>
                    <div className="absolute -left-2.25 top-1 w-4 h-4 rounded-full bg-slate-800 border-2 border-slate-950 flex items-center justify-center"><Ambulance size={8} className="text-red-500"/></div>
                    <div className="flex justify-between">
                      <p className="font-black text-slate-200">3. AMBULANCE_DISPATCHED</p>
                      <p className="text-slate-500 font-bold">{selectedIncident.dispatched_at ? new Date(selectedIncident.dispatched_at).toLocaleTimeString() : 'Awaiting...'}</p>
                    </div>
                  </div>

                  {/* RESOLVED */}
                  <div className={`relative pl-8 ${!selectedIncident.resolved_at && 'opacity-30'}`}>
                    <div className="absolute -left-2.25 top-1 w-4 h-4 rounded-full bg-slate-800 border-2 border-slate-950 flex items-center justify-center"><Clock size={8} className="text-emerald-400"/></div>
                    <div className="flex justify-between">
                      <p className="font-black text-slate-200">4. SYSTEM_RESOLVED</p>
                      <p className="text-slate-500 font-bold">{selectedIncident.resolved_at ? new Date(selectedIncident.resolved_at).toLocaleTimeString() : 'Active...'}</p>
                    </div>
                    <p className="text-emerald-500 mt-1 font-bold uppercase tracking-tighter">Total Lifecycle: {getDuration(selectedIncident.created_at, selectedIncident.resolved_at)}</p>
                  </div>

                </div>
              </div>

              {/* INTEGRATED NOTES */}
              <div className="pt-8 space-y-3">
                <p className="text-slate-500 font-black tracking-widest flex items-center gap-2"><FileText size={14}/> FINAL REPORT / EXCEPTIONS</p>
                <textarea value={noteInput} onChange={(e) => setNoteInput(e.target.value)} placeholder="Type forensic notes..." className="w-full h-24 bg-slate-900 border border-slate-800 rounded-xl p-3 text-slate-300 focus:outline-none focus:border-sky-500 transition-colors resize-none" />
                <div className="flex gap-4">
                  <button onClick={handleSaveNote} className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-sky-400 font-black rounded-xl border border-slate-700 transition-all uppercase">Save Notes</button>
                  {view === "LIVE" && <button onClick={() => handleResolve(selectedIncident.id)} className="flex-1 py-3 bg-red-600 hover:bg-red-500 text-white font-black rounded-xl shadow-xl transition-all uppercase">Resolve & Seal</button>}
                </div>
              </div>
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center opacity-10">
              <Shield size={60} className="mb-4" />
              <p className="font-black tracking-[.5em]">SELECT CASE</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}