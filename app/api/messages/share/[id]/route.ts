import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { id } = await params;

    if (!id) {
      return NextResponse.json(
        { error: "id is required" },
        { status: 400 }
      );
    }

    // Get shared message from database
    // RLS policies will handle authorization
    const { data, error } = await supabase
      .from("shared_messages")
      .select("message_data")
      .eq("id", id)
      .single();

    if (error || !data) {
      return NextResponse.json(
        { error: "Shared message not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      message_data: data.message_data,
    });
  } catch (error) {
    console.error("Failed to fetch shared message:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

