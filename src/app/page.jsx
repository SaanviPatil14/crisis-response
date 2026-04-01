import Link from "next/link";
import { Shield, Cpu, LayoutDashboard, Smartphone, ArrowRight } from "lucide-react";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 font-mono text-slate-100">
      
      {/* Decorative Background Glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-150 h-96 bg-sky-900/20 blur-[120px] rounded-full pointer-events-none" />

      <div className="max-w-4xl w-full space-y-12 relative z-10">
        
        {/* Header Section */}
        <div className="text-center space-y-6">
          <div className="w-24 h-24 bg-sky-500/10 rounded-4xl flex items-center justify-center mx-auto border border-sky-500/30 shadow-[0_0_50px_rgba(14,165,233,0.2)]">
            <Shield size={48} className="text-sky-400" />
          </div>
          <div>
            <h1 className="text-4xl md:text-6xl font-black tracking-widest text-white mb-4">CITYGUARD</h1>
            <p className="text-sky-400 font-bold tracking-widest text-sm uppercase mb-4">Smart City Emergency Response Architecture</p>
            <p className="text-slate-400 text-base md:text-lg max-w-2xl mx-auto leading-relaxed">
              A distributed, real-time platform bridging IoT hardware, municipal transit officers, and hospital CAD dispatch. 
            </p>
          </div>
        </div>

        {/* Navigation Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4">
          
          {/* Module 1: Simulator */}
          <Link href="/simulator" className="group flex flex-col p-8 bg-slate-900/50 backdrop-blur-sm border border-slate-800 rounded-3xl hover:border-violet-500/50 hover:bg-slate-800/50 transition-all cursor-pointer">
            <div className="w-14 h-14 bg-violet-500/10 rounded-2xl flex items-center justify-center mb-6 border border-violet-500/20 group-hover:scale-110 transition-transform">
              <Cpu size={28} className="text-violet-400" />
            </div>
            <h2 className="text-xl font-black text-white mb-2 flex items-center gap-2">
              1. Edge IoT Node
            </h2>
            <p className="text-sm text-slate-500 flex-1 mb-6 leading-relaxed">
              Hardware simulator. Injects live physical GPS data and sensor payloads into the PostGIS database.
            </p>
            <div className="flex items-center gap-2 text-violet-400 text-sm font-bold mt-auto group-hover:translate-x-2 transition-transform">
              LAUNCH MODULE <ArrowRight size={16} />
            </div>
          </Link>

          {/* Module 2: Staff App */}
          <Link href="/staff" className="group flex flex-col p-8 bg-slate-900/50 backdrop-blur-sm border border-slate-800 rounded-3xl hover:border-sky-500/50 hover:bg-slate-800/50 transition-all cursor-pointer">
            <div className="w-14 h-14 bg-sky-500/10 rounded-2xl flex items-center justify-center mb-6 border border-sky-500/20 group-hover:scale-110 transition-transform">
              <Smartphone size={28} className="text-sky-400" />
            </div>
            <h2 className="text-xl font-black text-white mb-2 flex items-center gap-2">
              2. Staff Terminal
            </h2>
            <p className="text-sm text-slate-500 flex-1 mb-6 leading-relaxed">
              Progressive Web App (PWA) for transit officers. Features Supabase Auth and a live 5km GPS geofence.
            </p>
            <div className="flex items-center gap-2 text-sky-400 text-sm font-bold mt-auto group-hover:translate-x-2 transition-transform">
              LAUNCH MODULE <ArrowRight size={16} />
            </div>
          </Link>

          {/* Module 3: Command Center */}
          <Link href="/command" className="group flex flex-col p-8 bg-slate-900/50 backdrop-blur-sm border border-slate-800 rounded-3xl hover:border-red-500/50 hover:bg-slate-800/50 transition-all cursor-pointer">
            <div className="w-14 h-14 bg-red-500/10 rounded-2xl flex items-center justify-center mb-6 border border-red-500/20 group-hover:scale-110 transition-transform">
              <LayoutDashboard size={28} className="text-red-400" />
            </div>
            <h2 className="text-xl font-black text-white mb-2 flex items-center gap-2">
              3. Command Center
            </h2>
            <p className="text-sm text-slate-500 flex-1 mb-6 leading-relaxed">
              Municipal dispatch dashboard. Real-time audit trails, live map tracking, and Twilio API routing.
            </p>
            <div className="flex items-center gap-2 text-red-400 text-sm font-bold mt-auto group-hover:translate-x-2 transition-transform">
              LAUNCH MODULE <ArrowRight size={16} />
            </div>
          </Link>

        </div>
      </div>
    </div>
  );
}