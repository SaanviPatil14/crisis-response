"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/supabaseClient";
import { Shield, Bell, HeartPulse, CheckCircle, RefreshCw, Radio, MapPin, User, TriangleAlert, LockKeyhole, Mail, LogOut, Compass, Mic, Map, Ambulance, Clock } from "lucide-react";

// --- HELPERS & MATH ---
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; 
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * Math.sin(dLon / 2) * Math.sin(dLon / 2); 
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)); 
  return R * c; 
}

function parseCoordinates(sublabel) {
  try {
    const match = sublabel?.match(/GPS:\s*(-?\d+\.\d+)°?,\s*(-?\d+\.\d+)°?/);
    if (match) return { lat: parseFloat(match[1]), lng: parseFloat(match[2]) };
    return null;
  } catch (e) {
    return null;
  }
}

const getAssignedHospital = (id) => {
  const hospitals = ["Mercy General Hospital", "City Metro Med", "Central Trauma Center", "St. Jude Rescue"];
  const index = id ? String(id).charCodeAt(0) % hospitals.length : 0;
  return { name: hospitals[index], unit: `ALS-${String(id).slice(-3)}` };
};

export default function StaffPage() {
  const [session, setSession] = useState(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);

  const [alerts, setAlerts] = useState([]);
  const [confirmingId, setConfirmingId] = useState(null);
  
  const [officerLocation, setOfficerLocation] = useState(null);
  const [liveEtas, setLiveEtas] = useState({});
  const RADIUS_LIMIT_KM = 5.0; 

  const [activeTab, setActiveTab] = useState("Alerts");

  // 1. Auth & Alerts Subscription
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => setSession(session));

    const fetchAlerts = async () => {
      const { data } = await supabase.from('incidents').select('*').neq('status', 'RESOLVED').order('created_at', { ascending: false });
      if (data) setAlerts(data);
    };
    fetchAlerts();

    const channel = supabase.channel('public:incidents_staff')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'incidents' }, (payload) => {
        if (payload.eventType === 'INSERT') setAlerts(prev => [payload.new, ...prev]);
        if (payload.eventType === 'UPDATE') {
          if (payload.new.status === 'RESOLVED') setAlerts(prev => prev.filter(a => a.id !== payload.new.id));
          else setAlerts(prev => prev.map(a => a.id === payload.new.id ? payload.new : a));
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      subscription.unsubscribe();
    };
  }, []);

  // 2. LIVE GPS TRACKER (Background Daemon)
  useEffect(() => {
    let watchId;
    if ("geolocation" in navigator) {
      watchId = navigator.geolocation.watchPosition(
        async (pos) => {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          setOfficerLocation({ lat, lng });

          // If escorting an ambulance, stream GPS to database!
          if (session?.user?.email) {
             const activeEscort = alerts.find(a => a.status === 'EN_ROUTE' && a.officer_email === session.user.email);
             if (activeEscort) {
               await supabase.from('incidents').update({ staff_lat: lat, staff_lng: lng }).eq('id', activeEscort.id);
             }
          }
        },
        (err) => console.error("GPS Error:", err),
        { enableHighAccuracy: true }
      );
    }
    return () => { if (watchId) navigator.geolocation.clearWatch(watchId); };
  }, [alerts, session]);

  // 3. LIVE ETA COUNTDOWN
  useEffect(() => {
    const timer = setInterval(() => {
      setLiveEtas(prev => {
        const newEtas = { ...prev };
        alerts.filter(a => a.status === 'CODE_BLUE').forEach(inc => {
           if (!newEtas[inc.id]) newEtas[inc.id] = Math.floor(Math.random() * 180) + 240; 
           if (newEtas[inc.id] > 0) newEtas[inc.id] -= 1;
        });
        return newEtas;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [alerts]);

  const localAlerts = alerts.filter(alert => {
    if (!officerLocation) return true; 
    const sensorCoords = parseCoordinates(alert.sublabel);
    if (!sensorCoords) return true; 
    const distance = calculateDistance(officerLocation.lat, officerLocation.lng, sensorCoords.lat, sensorCoords.lng);
    return distance <= RADIUS_LIMIT_KM;
  });

  const activeIncidents = localAlerts.filter(a => a.status === 'CODE_BLUE' || a.status === 'EN_ROUTE');
  const pendingAlerts = localAlerts.filter(a => a.status === 'ALERT');

  const handleAuth = async (e) => {
    e.preventDefault();
    setAuthLoading(true);
    setAuthError("");
    if (isSignUp) {
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) setAuthError(error.message);
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setAuthError("Invalid email or password.");
    }
    setAuthLoading(false);
  };

  const handleSignOut = async () => await supabase.auth.signOut();

  // --- ACTIONS ---
  const handleCodeBlue = async (incidentId) => {
    setConfirmingId(incidentId);
    const incident = alerts.find(a => a.id === incidentId);
    const timestamp = new Date().toISOString();

    const { error } = await supabase.from('incidents').update({ 
        status: 'CODE_BLUE',
        confirmed_at: timestamp,
        dispatched_at: timestamp,
        officer_email: session.user.email // LINKS OFFICER TO CAD
      }).eq('id', incidentId);

    if (!error && incident) {
      try {
        await fetch('/api/sms', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: `🚨 CITYGUARD DISPATCH: ${incident.label}. Location: ${incident.sublabel}.` })
        });
      } catch (e) { console.error("SMS Error", e); }
    }
    setConfirmingId(null);
  };

  const handleAmbulanceArrived = async (incidentId) => {
    await supabase.from('incidents').update({ 
      status: 'EN_ROUTE', 
      ambulance_arrived_at: new Date().toISOString() 
    }).eq('id', incidentId);
  };

  const handleReachedHospital = async (incidentId) => {
    await supabase.from('incidents').update({ 
      status: 'RESOLVED', 
      resolved_at: new Date().toISOString() 
    }).eq('id', incidentId);
  };

  const handleResolve = async (incidentId) => {
    await supabase.from('incidents').update({ status: 'RESOLVED' }).eq('id', incidentId);
  };

  // THE GOD-MODE MOVEMENT SIMULATOR
  const simulateMovement = (incidentId) => {
    if (!officerLocation) return alert("Need GPS lock first!");
    
    let currentLat = officerLocation.lat;
    let currentLng = officerLocation.lng;
    const destLat = currentLat + 0.015;
    const destLng = currentLng + 0.015;
    let step = 0;
    const totalSteps = 25;

    const interval = setInterval(async () => {
      step++;
      currentLat = currentLat + ((destLat - currentLat) * 0.1);
      currentLng = currentLng + ((destLng - currentLng) * 0.1);
      await supabase.from('incidents').update({ staff_lat: currentLat, staff_lng: currentLng }).eq('id', incidentId);
      if (step >= totalSteps) clearInterval(interval);
    }, 2000);

    alert("DEMO MODE: Initiating Live Escort Telemetry...");
  };

  const formatEta = (seconds) => {
    if (seconds === undefined) return "--:--";
    if (seconds <= 0) return "ARRIVED";
    return `${Math.floor(seconds / 60)}M ${(seconds % 60).toString().padStart(2, '0')}S`;
  };

  const navItems = [
    { id: "Alerts", icon: Bell },
    { id: "Comm", icon: Radio },
    { id: "Map", icon: MapPin },
    { id: "Profile", icon: User },
  ];

  return (
    <div className="min-h-screen bg-slate-100 flex font-mono overflow-hidden">
      
      {/* LOGIN SCREEN */}
      {!session ? (
        <div className="flex-1 bg-slate-950 flex flex-col items-center justify-center p-4 relative">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 p-8 rounded-3xl shadow-2xl flex flex-col items-center">
            <div className="w-16 h-16 rounded-2xl bg-sky-500/20 flex items-center justify-center mb-6 border border-sky-500/30">
              <Shield size={32} className="text-sky-400" />
            </div>
            <h1 className="text-2xl font-black text-white tracking-widest mb-1">CITYGUARD</h1>
            <p className="text-xs text-slate-400 mb-8 text-center">Encrypted Personnel Portal</p>
            
            <form onSubmit={handleAuth} className="w-full space-y-4">
              <div className="space-y-3">
                <div className="relative">
                  <Mail size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input type="email" required placeholder="Officer Email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full bg-slate-950 border border-slate-700 rounded-xl py-4 pl-12 pr-4 text-white text-sm focus:border-sky-500 transition-colors" />
                </div>
                <div className="relative">
                  <LockKeyhole size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input type="password" required placeholder="Secure Password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full bg-slate-950 border border-slate-700 rounded-xl py-4 pl-12 pr-4 text-white text-sm focus:border-sky-500 transition-colors" />
                </div>
                {authError && <p className="text-red-400 text-[10px] text-center font-bold">{authError}</p>}
              </div>
              <button type="submit" disabled={authLoading} className="w-full bg-sky-600 hover:bg-sky-500 text-white font-bold py-4 rounded-xl tracking-widest disabled:opacity-50 transition-colors">
                {authLoading ? "AUTHENTICATING..." : isSignUp ? "REGISTER" : "SECURE LOGIN"}
              </button>
            </form>
            <button onClick={() => { setIsSignUp(!isSignUp); setAuthError(""); }} className="mt-6 text-xs text-slate-400 hover:text-white transition-colors">
              {isSignUp ? "Already registered? Sign In" : "Need access? Register here"}
            </button>
          </div>
        </div>
      ) : (
        /* RESPONSIVE MAIN APP CONTENT */
        <div className="flex w-full h-screen">
          
          {/* LAPTOP: Left Sidebar */}
          <aside className="hidden md:flex flex-col w-72 bg-slate-900 border-r border-slate-800 shadow-2xl z-20 shrink-0">
            <div className="px-6 py-6 border-b border-slate-800 flex items-center gap-3">
              <Shield size={28} className="text-sky-400" />
              <div>
                <h1 className="text-white font-black text-xl tracking-wide">CityGuard</h1>
                <p className="text-xs text-slate-400 font-medium">District 4 Patrol</p>
              </div>
            </div>
            
            <nav className="flex-1 p-4 space-y-2">
              {navItems.map(({ id, icon: Icon }) => {
                const isActive = activeTab === id;
                return (
                  <button key={id} onClick={() => setActiveTab(id)} className={`w-full flex items-center gap-4 px-4 py-4 rounded-xl transition-all duration-200 ${isActive ? "bg-sky-500/10 text-sky-400 border border-sky-500/20" : "text-slate-400 hover:bg-slate-800 hover:text-white"}`}>
                    <Icon size={20} className={isActive ? "stroke-[2.5px]" : "stroke-[2px]"} />
                    <span className="font-bold tracking-wide text-sm">{id}</span>
                    {id === "Alerts" && (activeIncidents.length > 0 || pendingAlerts.length > 0) && (
                      <span className="ml-auto w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                    )}
                  </button>
                );
              })}
            </nav>

            <div className="p-4 border-t border-slate-800">
              <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
                <div className="flex items-center gap-2 text-sky-400 mb-2">
                  <Compass size={14} />
                  <span className="text-xs font-bold tracking-wider">GEOFENCE ACTIVE</span>
                </div>
                <p className="text-[10px] text-slate-400 leading-relaxed">
                  {officerLocation ? `Monitoring 5.0km radius from current GPS position.` : `Locating satellite link...`}
                </p>
              </div>
            </div>
          </aside>

          {/* RIGHT SIDE: Content Area */}
          <main className="flex-1 flex flex-col h-screen overflow-hidden bg-slate-50 relative">
            
            {/* MOBILE: Top Header */}
            <div className="md:hidden px-5 py-4 bg-slate-900 flex flex-col gap-2 shadow-md z-10 pt-safe">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Shield size={18} className="text-sky-400" />
                  <span className="text-white font-black text-lg tracking-wide">CityGuard</span>
                </div>
                {(activeIncidents.length > 0 || pendingAlerts.length > 0) && <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse shadow-[0_0_10px_rgba(239,68,68,0.6)]" />}
              </div>
              <div className="flex items-center gap-1.5 text-[10px] text-sky-400 bg-slate-800/50 py-1.5 px-3 rounded-lg border border-slate-700 w-fit mt-1">
                <Compass size={12} />
                <span className="font-bold tracking-wider">{officerLocation ? `GEOFENCE: DISTRICT 4` : `LOCATING GPS...`}</span>
              </div>
            </div>

            {/* LAPTOP: Top Header */}
            <header className="hidden md:flex items-center justify-between px-8 py-6 bg-white border-b border-slate-200 shadow-sm z-10">
              <h2 className="text-2xl font-black text-slate-800 uppercase tracking-wide">{activeTab} DASHBOARD</h2>
              <div className="flex items-center gap-4">
                <span className="text-sm font-bold text-slate-500">{session?.user?.email}</span>
                <button onClick={handleSignOut} className="p-2 text-slate-400 hover:text-red-500 transition-colors bg-slate-100 rounded-lg hover:bg-red-50 border border-transparent hover:border-red-200" title="Sign Out">
                  <LogOut size={18} />
                </button>
              </div>
            </header>

            {/* TAB CONTENT */}
            <div className="flex-1 overflow-y-auto p-4 md:p-8 relative">
              
              {activeTab === "Alerts" && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6 pb-24 md:pb-8">
                  
                  {activeIncidents.map(inc => {
                    const isEnRoute = inc.status === 'EN_ROUTE';
                    const hospital = getAssignedHospital(inc.id);

                    return (
                      <div key={inc.id} className={`rounded-2xl border-2 p-6 shadow-sm flex flex-col ${isEnRoute ? 'bg-blue-50 border-blue-300' : 'bg-red-50 border-red-300'}`}>
                        <div className="flex items-center gap-2 mb-3">
                          <div className={`w-3 h-3 rounded-full animate-pulse ${isEnRoute ? 'bg-blue-500' : 'bg-red-500'}`} />
                          <span className={`font-black text-sm tracking-widest ${isEnRoute ? 'text-blue-700' : 'text-red-700'}`}>
                            {isEnRoute ? 'ESCORTING AMBULANCE' : 'CODE BLUE ACTIVE'}
                          </span>
                        </div>
                        <p className={`font-bold text-xl mb-2 ${isEnRoute ? 'text-blue-900' : 'text-red-900'}`}>{inc.label}</p>
                        <p className={`text-sm font-medium mb-6 flex-1 ${isEnRoute ? 'text-blue-600' : 'text-red-600'}`}>{inc.sublabel}</p>

                        {!isEnRoute && (
                          <div className="bg-white rounded-xl border border-red-200 p-4 mb-4 flex items-center justify-between shadow-sm">
                            <div>
                              <p className="text-[10px] font-black text-slate-400 tracking-widest uppercase">Dispatched Unit</p>
                              <p className="text-sm font-bold text-slate-800 mt-0.5">{hospital.name}</p>
                              <p className="text-xs font-bold text-red-500 flex items-center gap-1 mt-0.5"><Ambulance size={14}/> Unit {hospital.unit}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-[10px] font-black text-slate-400 tracking-widest uppercase flex items-center justify-end gap-1"><Clock size={10}/> LIVE ETA</p>
                              <p className="text-2xl font-black text-red-600">{formatEta(liveEtas[inc.id])}</p>
                            </div>
                          </div>
                        )}

                        <div className="mt-auto space-y-3">
                          {!isEnRoute ? (
                            <button onClick={() => handleAmbulanceArrived(inc.id)} className="w-full py-4 rounded-xl bg-red-600 hover:bg-red-500 text-white font-black text-sm tracking-wide shadow-md flex items-center justify-center gap-2 transition-colors">
                              <Ambulance size={18}/> MARK AMBULANCE ARRIVED
                            </button>
                          ) : (
                            <>
                              <button onClick={() => handleReachedHospital(inc.id)} className="w-full py-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-black text-sm tracking-wide shadow-md flex items-center justify-center gap-2 transition-colors">
                                <CheckCircle size={18}/> PATIENT REACHED HOSPITAL
                              </button>
                              <button onClick={() => simulateMovement(inc.id)} className="w-full py-3 border-2 border-dashed border-blue-300 text-blue-500 font-bold text-[11px] uppercase tracking-widest rounded-xl hover:bg-blue-100 transition-colors">
                                [DEMO] SIMULATE ESCORT MOVEMENT
                              </button>
                            </>
                          )}
                          {!isEnRoute && (
                            <button onClick={() => handleResolve(inc.id)} className="w-full py-3 rounded-xl border-2 border-red-200 bg-white text-red-700 font-bold text-sm tracking-wide shadow-sm hover:bg-red-100 transition-colors">Stand Down / False Alarm</button>
                          )}
                        </div>
                      </div>
                    );
                  })}

                  {pendingAlerts.map(alert => (
                    <div key={alert.id} className={`rounded-2xl border-2 overflow-hidden shadow-sm flex flex-col ${alert.severity === "CRITICAL" ? "border-red-400 bg-red-50" : "border-orange-400 bg-orange-50"}`}>
                      <div className={`px-5 py-3 flex items-center justify-between ${alert.severity === "CRITICAL" ? "bg-red-500" : "bg-orange-500"}`}>
                        <div className="flex items-center gap-2">{alert.severity === "CRITICAL" ? <HeartPulse size={16} className="text-white"/> : <TriangleAlert size={16} className="text-white"/>}<span className="text-white text-xs font-black tracking-widest">{alert.severity === "CRITICAL" ? "MEDICAL ALERT" : "SECURITY ALERT"}</span></div>
                        <span className="text-white/90 text-xs font-mono font-bold">{new Date(alert.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                      </div>
                      <div className="p-6 flex flex-col flex-1">
                        <div className="mb-6 flex-1">
                          <p className={`font-black text-xl mb-2 ${alert.severity === "CRITICAL" ? "text-red-800" : "text-orange-800"}`}>{alert.label}</p>
                          <p className={`text-sm font-medium leading-relaxed ${alert.severity === "CRITICAL" ? "text-red-600" : "text-orange-600"}`}>{alert.sublabel}</p>
                        </div>
                        {alert.severity === "CRITICAL" ? (
                          <div className="space-y-3 mt-auto">
                            <button onClick={() => handleCodeBlue(alert.id)} disabled={confirmingId === alert.id} className="w-full py-4 rounded-xl bg-red-600 hover:bg-red-500 text-white font-black text-sm tracking-widest shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-50">
                              {confirmingId === alert.id ? <><RefreshCw size={18} className="animate-spin" /> DISPATCHING...</> : "CONFIRM CODE BLUE"}
                            </button>
                            <button onClick={() => handleResolve(alert.id)} className="w-full py-3 rounded-xl border-2 border-slate-200 bg-white text-slate-600 font-bold text-sm hover:bg-slate-50 transition-colors">Mark as False Alarm</button>
                          </div>
                        ) : (
                          <button onClick={() => handleResolve(alert.id)} className="w-full py-4 mt-auto rounded-xl border-2 border-orange-200 bg-white text-orange-700 font-bold text-sm shadow-sm hover:bg-orange-50 transition-colors">Acknowledge & Clear</button>
                        )}
                      </div>
                    </div>
                  ))}

                  {activeIncidents.length === 0 && pendingAlerts.length === 0 && (
                    <div className="md:col-span-2 lg:col-span-3 rounded-3xl bg-emerald-50 border border-emerald-200 p-12 flex flex-col items-center justify-center text-center shadow-sm">
                      <CheckCircle size={64} className="text-emerald-500 mb-6" />
                      <p className="text-2xl font-black text-emerald-800 tracking-wide">All Clear</p>
                      <p className="text-base text-emerald-600 mt-2 font-medium">No active incidents within the 5km geofence radius.</p>
                    </div>
                  )}
                </div>
              )}

              {activeTab === "Comm" && (
                <div className="flex flex-col items-center justify-center h-full text-center p-8 bg-white rounded-3xl border border-slate-200 shadow-sm max-w-2xl mx-auto">
                  <div className="w-24 h-24 bg-slate-100 rounded-full flex items-center justify-center mb-6">
                    <Mic size={40} className="text-slate-400" />
                  </div>
                  <h2 className="text-2xl font-black text-slate-800">Secure Dispatch Radio</h2>
                  <p className="text-slate-500 mt-3 max-w-md">Encrypted push-to-talk channel. Hold to broadcast to District 4 Central Command Center.</p>
                </div>
              )}

              {activeTab === "Map" && (
                <div className="flex flex-col items-center justify-center h-full text-center p-8 bg-white rounded-3xl border border-slate-200 shadow-sm max-w-2xl mx-auto">
                  <div className="w-24 h-24 bg-sky-50 rounded-full flex items-center justify-center mb-6 border-4 border-sky-100">
                    <Map size={40} className="text-sky-500" />
                  </div>
                  <h2 className="text-2xl font-black text-slate-800">Geospatial Overlay</h2>
                  <p className="text-slate-500 mt-3 max-w-md mb-6">You are actively monitoring a 5.0km radius relative to your physical location.</p>
                  <p className="text-sm font-bold text-sky-600 bg-sky-50 py-3 px-6 rounded-xl border border-sky-100">GPS: {officerLocation?.lat?.toFixed(4)}, {officerLocation?.lng?.toFixed(4)}</p>
                </div>
              )}

              {activeTab === "Profile" && (
                <div className="max-w-md mx-auto md:hidden space-y-6 pt-4">
                  <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm flex items-center gap-5">
                    <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center shrink-0">
                      <User size={24} className="text-white" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs text-slate-500 font-bold tracking-widest uppercase">Logged In As</p>
                      <p className="text-base font-bold text-slate-900 mt-1 truncate">{session?.user?.email}</p>
                    </div>
                  </div>
                  <button onClick={handleSignOut} className="w-full py-4 rounded-xl border-2 border-red-200 bg-red-50 text-red-600 font-bold text-sm tracking-widest shadow-sm flex items-center justify-center gap-2 active:bg-red-100 transition-colors">
                    <LogOut size={18} />
                    END SHIFT (LOGOUT)
                  </button>
                </div>
              )}

            </div>

            {/* MOBILE: Bottom Nav */}
            <nav className="md:hidden border-t border-slate-200 bg-white px-2 py-2 flex items-center justify-around z-20 pb-safe shadow-[0_-10px_30px_rgba(0,0,0,0.05)] fixed bottom-0 left-0 right-0">
              {navItems.map(({ id, icon: Icon }) => {
                const isActive = activeTab === id;
                return (
                  <button 
                    key={id} 
                    onClick={() => setActiveTab(id)}
                    className={`flex flex-col items-center gap-1.5 p-3 rounded-2xl transition-all duration-200 w-20 ${isActive ? "text-sky-600 bg-sky-50" : "text-slate-400 hover:bg-slate-50"}`}
                  >
                    <Icon size={22} className={isActive ? "stroke-[2.5px]" : "stroke-[2px]"} />
                    <span className={`text-[10px] tracking-wide ${isActive ? "font-black" : "font-semibold"}`}>{id}</span>
                  </button>
                );
              })}
            </nav>

          </main>
        </div>
      )}
    </div>
  );
}