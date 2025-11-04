import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const body = await request.json();
    const { message_data } = body;

    if (!message_data) {
      return NextResponse.json(
        { error: "message_data is required" },
        { status: 400 }
      );
    }

    // Get authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Save to database
    const { data, error } = await supabase
      .from("shared_messages")
      .insert({
        user_id: user.id,
        message_data: message_data,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      id: data.id,
      message: "Shareable link created successfully",
    });
  } catch (error) {
    console.error("Failed to create shareable link:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

