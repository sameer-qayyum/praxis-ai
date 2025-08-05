import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    // Get user session to ensure we're authenticated
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      );
    }
    
    // Get the body data
    const { invitationToken, email, appId } = await request.json();

    // Validate required fields
    if (!invitationToken || !email || !appId) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }
    
    // Verify the invitation exists
    const { data: invitation, error: invitationError } = await supabase
      .from("app_invites")
      .select("*")
      .eq("invitation_token", invitationToken)
      .eq("invited_email", email.toLowerCase())
      .eq("app_id", appId)
      .single();
    
    if (invitationError || !invitation) {
      return NextResponse.json(
        { error: "Invalid invitation" },
        { status: 400 }
      );
    }
    
    // Get app info
    const { data: app, error: appError } = await supabase
      .from("apps")
      .select("name, description")
      .eq("id", appId)
      .single();
    
    if (appError || !app) {
      return NextResponse.json(
        { error: "App not found" },
        { status: 404 }
      );
    }
    
    // Get sender user profile (the inviter)
    const { data: sender, error: senderError } = await supabase
      .from("profiles")
      .select("full_name, email")
      .eq("id", session.user.id)
      .single();
    
    if (senderError || !sender) {
      return NextResponse.json(
        { error: "Sender profile not found" },
        { status: 404 }
      );
    }
    
    // Construct email content
    const emailContent = {
      to: email,
      from: "no-reply@praxis-ai.com",
      subject: `You've been invited to ${app.name} on Praxis AI`,
      html: `
        <h2>You've been invited to ${app.name}</h2>
        <p>${sender.full_name} has invited you to collaborate on ${app.name} on Praxis AI.</p>
        <p>App description: ${app.description || "No description provided"}</p>
        <p><a href="${process.env.NEXT_PUBLIC_APP_URL}/api/invitations/accept?token=${invitationToken}">Accept Invitation</a></p>
        <p>If you don't want to accept this invitation, you can ignore this email.</p>
      `
    };
    
    // TODO: In a production environment, send the email using a service like SendGrid, AWS SES, etc.
    console.log("Would send email with content:", emailContent);
    
    // });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error sending invitation email:", error);
    return NextResponse.json(
      { error: "Failed to send invitation email" },
      { status: 500 }
    );
  }
}
