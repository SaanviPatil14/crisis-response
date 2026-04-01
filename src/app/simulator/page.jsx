"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/supabaseClient"; 
import { Cpu, HeartPulse, RefreshCw, TriangleAlert, CircleDot, MapPin, Flame, CarFront, Users } from "lucide-react";

const now = () => new Date().toLocaleTimeString("en-IN", { hour12: false });

export default function SimulatorPage() {
  const [sending, setSending] = useState(null);
  const [activeAlerts, setActiveAlerts] = useState([]);
  
  const [realLocation, setRealLocation] = useState("Fetching Live GPS...");
  const [gpsActive, setGpsActive] = useState(false);

  useEffect(() => {
    const fetchIncidents = async () => {
      const { data } = await supabase.from('incidents').select('*').order('created_at', { ascending: false });
      if (data) setActiveAlerts(data);
    };
    fetchIncidents();

    const channel = supabase.channel('public:incidents')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'incidents' }, (payload) => {
        if (payload.eventType === 'INSERT') setActiveAlerts(prev => [payload.new, ...prev]);
      })
      .subscribe();

    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const lat = position.coords.latitude.toFixed(4);
          const lng = position.coords.longitude.toFixed(4);
          setRealLocation(`GPS: ${lat}°, ${lng}°`);
          setGpsActive(true);
        },
        (error) => {
          console.error("GPS Error:", error);
          setRealLocation("GPS: Permission Denied (Using Fallback)");
          setGpsActive(false);
        }
      );
    } else {
      setRealLocation("GPS: Not supported");
    }

    return () => supabase.removeChannel(channel);
  }, []);

  // --- THE EXPANDED SMART CITY SENSORS ---
  const SENSORS = [
    { 
      type: "MEDICAL_FALL", label: "LiDAR Medical Fall Detection", dbLabel: "Suspected Medical Emergency", 
      severity: "CRITICAL", icon: HeartPulse, useGps: true, 
      color: "red", border: "border-red-500/30", bg: "bg-red-500/5", button: "bg-red-600 hover:bg-red-500"
    },
    { 
      type: "FIRE_SMOKE", label: "Optical Smoke & Thermal Anomaly", dbLabel: "Class A Fire / Thermal Event", 
      severity: "CRITICAL", icon: Flame, useGps: true, 
      color: "orange", border: "border-orange-500/30", bg: "bg-orange-500/5", button: "bg-orange-600 hover:bg-orange-500"
    },
    { 
      type: "VEHICLE_CRASH", label: "Acoustic Intersection Collision", dbLabel: "High-Impact Vehicle Crash", 
      severity: "CRITICAL", icon: CarFront, useGps: true, 
      color: "rose", border: "border-rose-500/30", bg: "bg-rose-500/5", button: "bg-rose-600 hover:bg-rose-500"
    },
    { 
      type: "CROWD_CRUSH", label: "AI Crowd Density Analytics", dbLabel: "Abnormal Crowd Surge Detected", 
      severity: "HIGH", icon: Users, useGps: false, fallbackLoc: "Hardware ID: CAM-404 (Transit Hub Entry)", 
      color: "violet", border: "border-violet-500/30", bg: "bg-violet-500/5", button: "bg-violet-600 hover:bg-violet-500"
    },
    { 
      type: "GLASS_BREAK", label: "Acoustic Glass Break Sensor", dbLabel: "Vandalism / Glass Break", 
      severity: "HIGH", icon: TriangleAlert, useGps: false, fallbackLoc: "Hardware ID: GL-892 (Sector 4 Bus Shelter)", 
      color: "amber", border: "border-amber-500/30", bg: "bg-amber-500/5", button: "bg-amber-500 hover:bg-amber-400"
    }
  ];

  const fireSensor = async (sensor) => {
    setSending(sensor.type);
    
    const payload = {
      type: sensor.type,
      label: sensor.dbLabel,
      sublabel: sensor.useGps ? `${realLocation} (Live Data)` : sensor.fallbackLoc,
      severity: sensor.severity,
      status: "ALERT"
    };

    const { error } = await supabase.from('incidents').insert([payload]);
    if (error) {
      console.error("Error firing sensor:", error);
      alert("Failed to send data!");
    }
    
    setSending(null);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-mono">
      <div className="border-b border-slate-800 px-6 py-4 flex items-center gap-3 bg-slate-900 sticky top-0 z-10">
        <div className="w-8 h-8 rounded-lg bg-violet-600/30 flex items-center justify-center border border-violet-500/40">
          <Cpu size={16} className="text-violet-400" />
        </div>
        <div>
          <h2 className="text-sm font-bold text-slate-100 tracking-wider">SMART CITY IOT NODE</h2>
          <p className="text-xs text-slate-500">Live Production Database Connected</p>
        </div>
        <div className="ml-auto flex flex-col items-end gap-1">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs text-emerald-400">POSTGRES LINK ACTIVE</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-sky-400 bg-sky-500/10 px-2 py-0.5 rounded border border-sky-500/20">
            <MapPin size={10} />
            <span>{realLocation}</span>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 max-w-4xl mx-auto w-full grid grid-cols-1 md:grid-cols-2 gap-8">
        
        {/* SENSOR INJECTION PANEL */}
        <div className="space-y-4">
          <h3 className="text-xs text-slate-500 tracking-widest uppercase mb-4">Inject Live Sensor Payload</h3>

          <div className="space-y-3">
            {SENSORS.map((sensor) => {
              const Icon = sensor.icon;
              return (
                <div key={sensor.type} className={`rounded-xl border ${sensor.border} ${sensor.bg} p-4 transition-all hover:bg-slate-900`}>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Icon size={16} className={`text-${sensor.color}-400`} />
                      <span className={`font-bold text-${sensor.color}-300 text-sm`}>{sensor.label}</span>
                    </div>
                    <span className={`text-[10px] font-bold tracking-widest bg-${sensor.color}-500/20 text-${sensor.color}-400 border border-${sensor.color}-500/30 px-2 py-0.5 rounded`}>
                      {sensor.severity}
                    </span>
                  </div>
                  <button 
                    onClick={() => fireSensor(sensor)} 
                    disabled={sending === sensor.type || (sensor.useGps && !gpsActive)} 
                    className={`w-full py-3 rounded-lg ${sensor.button} text-white text-sm font-bold tracking-wider transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg`}
                  >
                    {sending === sensor.type ? (
                      <><RefreshCw size={16} className="animate-spin" /> WRITING TO DB...</>
                    ) : sensor.useGps && !gpsActive ? (
                      "AWAITING GPS SIGNAL..."
                    ) : (
                      <><Icon size={16} /> SIMULATE EVENT</>
                    )}
                  </button>
                </div>
              )
            })}
          </div>
        </div>

        {/* DATABASE QUEUE PANEL */}
        <div>
          <h3 className="text-xs text-slate-500 tracking-widest uppercase mb-4">Live Database Queue ({activeAlerts.length})</h3>
          <div className="bg-slate-900/50 rounded-2xl border border-slate-800 p-2 h-[calc(100vh-200px)] overflow-y-auto">
            {activeAlerts.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-6">
                <CircleDot size={24} className="text-slate-700 mx-auto mb-3" />
                <p className="text-sm text-slate-500">Database is empty</p>
                <p className="text-xs text-slate-600 mt-1">Awaiting sensor injection...</p>
              </div>
            ) : (
              <div className="space-y-2">
                {activeAlerts.map(a => (
                  <div key={a.id} className={`rounded-xl border p-3 flex items-start gap-3 ${a.severity === "CRITICAL" ? "border-red-500/30 bg-red-500/5" : "border-slate-700 bg-slate-800/50"}`}>
                    <div className={`mt-1 w-2 h-2 rounded-full shrink-0 ${a.severity === "CRITICAL" ? "bg-red-500 animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.8)]" : "bg-orange-400"}`} />
                    <div className="flex-1 min-w-0">
                      <p className={`text-xs font-bold truncate ${a.severity === "CRITICAL" ? "text-red-300" : "text-orange-300"}`}>{a.label}</p>
                      <p className="text-[10px] text-slate-500 mt-0.5 truncate">{new Date(a.created_at).toLocaleTimeString()} · {a.sublabel}</p>
                    </div>
                    <span className="px-2 py-1 bg-slate-950 text-slate-300 text-[9px] font-black tracking-widest rounded border border-slate-700">{a.status}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}