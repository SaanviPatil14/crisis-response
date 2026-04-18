import { NextResponse } from 'next/server';

export async function POST(req) {
  try {
    const { message, context } = await req.json();
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return NextResponse.json({ error: "Gemini API key missing" }, { status: 500 });
    }

    const systemPrompt = `You are the CityGuard Tactical First-Aid AI. 
    You are assisting a field officer who is currently at an emergency scene.
    Current Scene Context: ${context}
    
    STRICT RULES:
    1. Keep responses under 3 sentences. The officer is in a high-stress situation.
    2. Use bullet points for steps.
    3. Remind them to keep the scene safe and that the ambulance is en route.
    4. Provide ONLY immediate, life-saving first aid advice (CPR, bleeding control, recovery position). 
    5. Do not diagnose.`;

    const payload = {
      contents: [
        { 
          role: "user", 
          parts: [{ text: `${systemPrompt}\n\nOfficer Question: ${message}` }] 
        }
      ]
    };

    // 🚀 THE FIX IS RIGHT HERE: Switched to gemini-1.5-flash-latest
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await response.json();
    
    // Check if Google sent an error back
    if (data.error) {
      console.error("🚨 GOOGLE AI ERROR:", data.error.message);
      return NextResponse.json({ reply: `API Error: ${data.error.message}` });
    }

    if (!data.candidates || data.candidates.length === 0) {
      console.error("🚨 WEIRD RESPONSE:", data);
      return NextResponse.json({ reply: "ERROR: Received empty response from Google AI." });
    }

    // Extract the AI's response text safely
    const aiText = data.candidates[0].content.parts[0].text;
    return NextResponse.json({ reply: aiText });

  } catch (error) {
    console.error("AI Medic Crash:", error);
    return NextResponse.json({ error: "Failed to connect to Google AI" }, { status: 500 });
  }
}