"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/supabaseClient";
import { APIProvider, Map, AdvancedMarker, useMap, useMapsLibrary } from "@vis.gl/react-google-maps";
import { Shield, MapPin, X, History, FileText, Clock, CheckCircle2, Activity, Zap, Ambulance, Navigation, RadioTower } from "lucide-react";

const GOOGLE_MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;// <--- PUT YOUR KEY HERE

// --- HELPERS ---
const getCoords = (sublabel) => {
  if (!sublabel) return { lat: 19.0760, lng: 72.8777 }; // Default fallback
  const match = sublabel.match(/GPS:\s*(-?\d+\.\d+)°?,\s*(-?\d+\.\d+)°?/);
  if (match) return { lat: parseFloat(match[1]), lng: parseFloat(match[2]) };
  return { lat: 19.0760, lng: 72.8777 };
};

const getAssignedHospital = (id) => {
  const hospitals = ["Mercy General Hospital", "City Metro Med", "Central Trauma Center", "St. Jude Rescue"];
  const index = id ? String(id).charCodeAt(0) % hospitals.length : 0;
  return { name: hospitals[index], unit: `ALS-${String(id).slice(-3)}` };
};

// --- MAP CONTROLLER (Handles Auto-Zooming) ---
const MapController = ({ selectedIncident }) => {
  const map = useMap();
  useEffect(() => {
    if (!map) return;
    if (selectedIncident) {
      map.panTo(getCoords(selectedIncident.sublabel));
      map.setZoom(15); 
    } else {
      map.setZoom(13);
    }
  }, [map, selectedIncident]);
  return null;
};

// --- LIVE ROUTING ENGINE (Places + Traffic) ---
// --- LIVE ROUTING ENGINE (Real Places API Version) ---
const LiveRoute = ({ origin, incidentId, onRouteReady }) => {
  const map = useMap();
  const routesLibrary = useMapsLibrary('routes');
  const placesLibrary = useMapsLibrary('places'); 
  
  const [directionsService, setDirectionsService] = useState(null);
  const [directionsRenderer, setDirectionsRenderer] = useState(null);
  const [placesService, setPlacesService] = useState(null);
  const [realDestination, setRealDestination] = useState(null);

  // 🚀 THE FIX: WIPE THE OLD HOSPITAL WHEN A NEW CASE IS SELECTED
  useEffect(() => {
    setRealDestination(null);
  }, [incidentId]);

  useEffect(() => {
    if (!routesLibrary || !placesLibrary || !map) return;
    setDirectionsService(new routesLibrary.DirectionsService());
    setDirectionsRenderer(new routesLibrary.DirectionsRenderer({
      map,
      suppressMarkers: true, 
      polylineOptions: { strokeColor: '#3b82f6', strokeWeight: 6, strokeOpacity: 0.8 } 
    }));
    setPlacesService(new placesLibrary.PlacesService(map));
  }, [routesLibrary, placesLibrary, map]);

  // Find Nearest REAL Hospital once per incident
  useEffect(() => {
    if (!placesService || !origin || realDestination) return;
    
    placesService.nearbySearch({
      location: origin,
      radius: 5000, 
      type: 'hospital'
    }, (results, status) => {
      if (status === window.google.maps.places.PlacesServiceStatus.OK && results[0]) {
        setRealDestination(results[0].geometry.location);
      } else {
        setRealDestination({ lat: origin.lat + 0.015, lng: origin.lng + 0.015 });
      }
    });
  }, [placesService, origin, realDestination]);

  // Calculate & Draw Route
  useEffect(() => {
    if (!directionsService || !directionsRenderer || !origin || !realDestination) return;

    const destinationTarget = typeof realDestination.lat === 'function' 
      ? realDestination 
      : new window.google.maps.LatLng(realDestination.lat, realDestination.lng);

    directionsService.route({
      origin: origin,
      destination: destinationTarget,
      travelMode: window.google.maps.TravelMode.DRIVING,
      drivingOptions: { departureTime: new Date() } 
    }).then(response => {
      directionsRenderer.setDirections(response);
      const route = response.routes[0].legs[0];
      
      onRouteReady({
        distance: route.distance.text,
        duration: route.duration_in_traffic ? route.duration_in_traffic.text : route.duration.text,
        hospitalCoords: { 
          lat: typeof realDestination.lat === 'function' ? realDestination.lat() : realDestination.lat, 
          lng: typeof realDestination.lng === 'function' ? realDestination.lng() : realDestination.lng 
        }
      });
    }).catch(e => console.error("Routing failure:", e));

    return () => { if (directionsRenderer) directionsRenderer.setMap(null); };
  }, [directionsService, directionsRenderer, origin, realDestination]);

  return null;
};

// --- MAIN COMMAND PAGE ---
export default function CommandPage() {
  const [dbAlerts, setDbAlerts] = useState([]);
  const [view, setView] = useState("LIVE"); 
  const [selectedIncident, setSelectedIncident] = useState(null);
  const [noteInput, setNoteInput] = useState("");
  const [routeData, setRouteData] = useState(null); // Stores the Live ETA data

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
    const { data, error } = await supabase.from('incidents').update({ notes: noteInput }).eq('id', selectedIncident.id).select(); 
    if (error) {
      console.error("Save Error:", error.message);
      alert("Database error: " + error.message);
    } else {
      setSelectedIncident(data[0]); 
      setNoteInput(""); 
      fetchData(); 
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
    <APIProvider apiKey={GOOGLE_MAPS_API_KEY}>
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-mono uppercase text-[11px]">
        
        {/* HEADER */}
        <header className="px-6 py-4 border-b border-slate-800 bg-slate-900 flex justify-between items-center z-30">
          <div className="flex items-center gap-3">
            <Shield size={20} className="text-sky-400" />
            <h1 className="font-black tracking-[.2em]">CityGuard Forensic Command</h1>
          </div>
          <div className="flex bg-slate-950 p-1 rounded-lg border border-slate-800">
            <button onClick={() => {setView("LIVE"); setSelectedIncident(null);}} className={`px-6 py-1.5 rounded font-black transition-all ${view === "LIVE" ? "bg-sky-600 text-white" : "text-slate-500"}`}>LIVE OPS</button>
            <button onClick={() => {setView("ARCHIVE"); setSelectedIncident(null);}} className={`px-6 py-1.5 rounded font-black transition-all ${view === "ARCHIVE" ? "bg-slate-700 text-white" : "text-slate-500"}`}>ARCHIVE</button>
          </div>
        </header>

        <div className="flex-1 grid grid-cols-12 overflow-hidden">
          
          {/* LIST */}
          <div className="col-span-3 border-r border-slate-800 overflow-y-auto p-4 space-y-2 bg-slate-950">
            {dbAlerts.map(inc => (
              <div key={inc.id} onClick={() => {setSelectedIncident(inc); setNoteInput(inc.notes || "");}} 
                className={`p-3 rounded-lg border cursor-pointer transition-all ${selectedIncident?.id === inc.id ? 'border-sky-500 bg-sky-500/10' : 'border-slate-800 bg-slate-900/40 hover:bg-slate-900'}`}>
                <div className="flex justify-between items-center mb-1">
                  <span className={`text-[8px] font-black px-1.5 py-0.5 rounded ${inc.status === 'CODE_BLUE' || inc.status === 'EN_ROUTE' ? 'bg-red-600 text-white' : 'bg-slate-800 text-slate-500'}`}>{inc.status}</span>
                  <span className="text-[8px] text-slate-600 font-bold">{new Date(inc.created_at).toLocaleTimeString()}</span>
                </div>
                <h3 className="font-black text-slate-200 truncate">{inc.label}</h3>
              </div>
            ))}
          </div>

          {/* MAP */}
          <div className="col-span-4 relative bg-slate-900 border-r border-slate-800">
            <Map defaultZoom={13} defaultCenter={{ lat: 19.0760, lng: 72.8777 }} mapId={"bf51a91002e71d61"} disableDefaultUI={true} gestureHandling={'greedy'}>
              <MapController selectedIncident={selectedIncident} />
              
              {/* THE ROUTING ENGINE */}
              {selectedIncident && (selectedIncident.status === 'CODE_BLUE' || selectedIncident.status === 'EN_ROUTE') && (
                 <LiveRoute 
                   origin={selectedIncident.status === 'EN_ROUTE' && selectedIncident.staff_lat 
                      ? { lat: selectedIncident.staff_lat, lng: selectedIncident.staff_lng } 
                      : getCoords(selectedIncident.sublabel)
                   }
                   incidentId={selectedIncident.id}
                   onRouteReady={(data) => setRouteData(data)}
                 />
              )}

              {/* THE HOSPITAL DESTINATION PIN (Real Location, Dummy Name) */}
              {routeData && selectedIncident && (selectedIncident.status === 'CODE_BLUE' || selectedIncident.status === 'EN_ROUTE') && (
                 <AdvancedMarker position={routeData.hospitalCoords}>
                    <div className="flex flex-col items-center">
                      <div className="bg-emerald-500 text-white p-2 rounded-full shadow-xl border-2 border-white z-10">
                        <CheckCircle2 size={16} />
                      </div>
                      <div className="bg-slate-950 border border-slate-700 text-[9px] font-black tracking-widest text-emerald-400 px-2 py-1 mt-1 uppercase whitespace-nowrap shadow-xl">
                        {getAssignedHospital(selectedIncident.id).name}
                      </div>
                    </div>
                 </AdvancedMarker>
              )}

              {/* THE MOVING AMBULANCE PIN / SENSOR PINS */}
              {dbAlerts.filter(a => a.status !== 'RESOLVED').map((a) => {
                const isMoving = a.status === 'EN_ROUTE' && a.staff_lat;
                const pos = isMoving ? { lat: a.staff_lat, lng: a.staff_lng } : getCoords(a.sublabel);
                
                return (
                  <AdvancedMarker key={a.id} position={pos} onClick={() => {setSelectedIncident(a); setNoteInput(a.notes || "");}}>
                    <div className={`p-2 rounded-full border-2 shadow-xl z-20 ${
                      isMoving ? 'bg-blue-600 border-white shadow-[0_0_20px_rgba(37,99,235,0.8)]' : 
                      a.status === 'CODE_BLUE' ? 'bg-red-600 border-white animate-bounce' : 
                      'bg-orange-500 border-slate-900'
                    }`}>
                      {a.status === 'CODE_BLUE' || isMoving ? <Ambulance size={16} className="text-white"/> : <MapPin size={16} className="text-white"/>}
                    </div>
                  </AdvancedMarker>
                );
              })}
            </Map>
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

                {/* --- THE CAD ROUTING ETA BOX --- */}
                {(selectedIncident.status === 'CODE_BLUE' || selectedIncident.status === 'EN_ROUTE') && (
                  <div className="bg-sky-950/30 border border-sky-500/30 rounded-xl p-4 mb-6">
                    <div className="flex items-center gap-2 text-sky-400 mb-4 border-b border-sky-500/20 pb-2">
                      <RadioTower size={14} className="animate-pulse" />
                      <span className="font-black tracking-widest text-[10px]">CAD NETWORK LINK SECURED</span>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-[9px] text-slate-500 font-bold mb-1">RESPONDING FACILITY</p>
                        <p className="text-xs font-black text-white">{getAssignedHospital(selectedIncident.id).name}</p>
                      </div>
                      <div>
                        <p className="text-[9px] text-slate-500 font-bold mb-1">ASSIGNED UNIT</p>
                        <p className="text-xs font-black text-sky-400 flex items-center gap-1.5"><Ambulance size={12}/> {getAssignedHospital(selectedIncident.id).unit}</p>
                      </div>
                      <div className="col-span-2 bg-slate-950 p-3 rounded border border-slate-800 flex justify-between items-center">
                        <div>
                          <span className="text-[9px] text-slate-400 font-bold flex items-center gap-1"><MapPin size={10}/> ROUTE DISTANCE:</span>
                          <span className="text-white font-bold ml-4">{routeData?.distance || "CALCULATING..."}</span>
                        </div>
                        <div className="text-right">
                          <span className="text-[9px] text-slate-400 font-bold flex items-center justify-end gap-1"><Clock size={10}/> LIVE TRAFFIC ETA</span>
                          <span className="text-sm font-black text-red-400">{routeData?.duration || "CALCULATING..."}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

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
                    
                    {/* EN ROUTE / AMBULANCE ARRIVED */}
                    <div className={`relative pl-8 ${!selectedIncident.ambulance_arrived_at && 'opacity-30'}`}>
                      <div className="absolute -left-2.25 top-1 w-4 h-4 rounded-full bg-slate-800 border-2 border-slate-950 flex items-center justify-center"><Navigation size={8} className="text-blue-400"/></div>
                      <div className="flex justify-between">
                        <p className="font-black text-slate-200">4. AMBULANCE ARRIVED (EN ROUTE TO HOSP)</p>
                        <p className="text-slate-500 font-bold">{selectedIncident.ambulance_arrived_at ? new Date(selectedIncident.ambulance_arrived_at).toLocaleTimeString() : 'Awaiting...'}</p>
                      </div>
                    </div>

                    {/* RESOLVED */}
                    <div className={`relative pl-8 ${!selectedIncident.resolved_at && 'opacity-30'}`}>
                      <div className="absolute -left-2.25 top-1 w-4 h-4 rounded-full bg-slate-800 border-2 border-slate-950 flex items-center justify-center"><Clock size={8} className="text-emerald-400"/></div>
                      <div className="flex justify-between">
                        <p className="font-black text-slate-200">5. SYSTEM_RESOLVED</p>
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
    </APIProvider>
  );
}