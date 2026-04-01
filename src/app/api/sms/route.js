import twilio from 'twilio';
import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const { message } = await request.json();
    
    // Wake up the Twilio client using your secure environment variables
    const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
    
    // Fire the text message
    const smsResponse = await client.messages.create({
      body: message,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: process.env.YOUR_PERSONAL_PHONE_NUMBER
    });

    return NextResponse.json({ success: true, sid: smsResponse.sid });
  } catch (error) {
    console.error("Twilio API Error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}