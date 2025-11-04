"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TimezoneSelector, getUserTimezone } from "@/components/ui/timezone-selector";
import { toast } from "sonner";
import { cronPresets, validateCronExpression } from "@/lib/scheduler/time";

interface ScheduleMessage {
  id: string;
  name: string;
  channel_id: string;
  saved_message_id: string | null;
  payload: any;
  send_at: string | null;
  recurrence_cron: string | null;
  timezone: string;
  max_runs: number | null;
}

interface Template {
  id: string;
  name: string;
  content: string | null;
  embed_data: any;
  message_data: any;
}

interface Channel {
  id: string;
  name: string;
}

interface ScheduleMessageModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
  schedule?: ScheduleMessage | null;
  channels: Channel[];
  onSuccess: () => void;
}

export function ScheduleMessageModal({
  open,
  onOpenChange,
  workspaceId,
  schedule,
  channels,
  onSuccess,
}: ScheduleMessageModalProps) {
  const [name, setName] = useState("");
  const [channelId, setChannelId] = useState("");
  const [sendType, setSendType] = useState<"once" | "periodic">("once");
  const [sendAt, setSendAt] = useState("");
  const [recurrenceCron, setRecurrenceCron] = useState("");
  const [cronPreset, setCronPreset] = useState("");
  const [timezone, setTimezone] = useState(getUserTimezone());
  const [maxRuns, setMaxRuns] = useState("");
  const [messageSource, setMessageSource] = useState<"saved" | "snapshot">("saved");
  const [savedMessageId, setSavedMessageId] = useState("");
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [snapshotContent, setSnapshotContent] = useState("");
  const [snapshotEmbeds, setSnapshotEmbeds] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      if (schedule) {
        // Editing existing schedule
        setName(schedule.name);
        setChannelId(schedule.channel_id);
        setSendType(schedule.recurrence_cron ? "periodic" : "once");
        if (schedule.send_at) {
          // Convert UTC to local datetime-local format
          const localDate = new Date(schedule.send_at);
          const year = localDate.getFullYear();
          const month = String(localDate.getMonth() + 1).padStart(2, "0");
          const day = String(localDate.getDate()).padStart(2, "0");
          const hours = String(localDate.getHours()).padStart(2, "0");
          const minutes = String(localDate.getMinutes()).padStart(2, "0");
          setSendAt(`${year}-${month}-${day}T${hours}:${minutes}`);
        }
        setRecurrenceCron(schedule.recurrence_cron || "");
        setTimezone(schedule.timezone || getUserTimezone());
        setMaxRuns(schedule.max_runs?.toString() || "");
        setMessageSource(schedule.saved_message_id ? "saved" : "snapshot");
        setSavedMessageId(schedule.saved_message_id || "");
        if (schedule.payload) {
          setSnapshotContent(schedule.payload.content || "");
          setSnapshotEmbeds(schedule.payload.embeds || schedule.payload.embed_data || null);
        }
      } else {
        // Creating new schedule
        setName("");
        setChannelId(channels.length > 0 ? channels[0].id : "");
        setSendType("once");
        setSendAt("");
        setRecurrenceCron("");
        setCronPreset("");
        setTimezone(getUserTimezone());
        setMaxRuns("");
        setMessageSource("saved");
        setSavedMessageId("");
        setSnapshotContent("");
        setSnapshotEmbeds(null);
      }
      
      fetchTemplates();
    }
  }, [open, schedule, channels, channelId]);

  const fetchTemplates = async () => {
    setLoadingTemplates(true);
    try {
      const response = await fetch("/api/templates");
      if (response.ok) {
        const data = await response.json();
        setTemplates(data.templates || []);
      }
    } catch (error) {
      console.error("Failed to fetch templates:", error);
    } finally {
      setLoadingTemplates(false);
    }
  };

  const handleChannelChange = (newChannelId: string) => {
    setChannelId(newChannelId);
    // Templates are not channel-specific, so no need to refetch
  };

  const handleCronPresetChange = (preset: string) => {
    setCronPreset(preset);
    if (preset && cronPresets[preset as keyof typeof cronPresets]) {
      setRecurrenceCron(cronPresets[preset as keyof typeof cronPresets]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim()) {
      toast.error("Name is required");
      return;
    }

    if (!channelId) {
      toast.error("Channel is required");
      return;
    }

    if (sendType === "once" && !sendAt) {
      toast.error("Send date and time is required");
      return;
    }

    if (sendType === "periodic" && !recurrenceCron) {
      toast.error("Recurrence cron expression is required");
      return;
    }

    if (sendType === "periodic" && !validateCronExpression(recurrenceCron)) {
      toast.error("Invalid cron expression");
      return;
    }

    if (messageSource === "saved" && !savedMessageId) {
      toast.error("Please select a template");
      return;
    }

    if (messageSource === "snapshot" && !snapshotContent && !snapshotEmbeds) {
      toast.error("Please provide message content or embed");
      return;
    }

    setLoading(true);
    try {
      const payload: any = {
        workspace_id: workspaceId,
        channel_id: channelId,
        name: name.trim(),
        timezone,
      };

      if (sendType === "once") {
        // Convert datetime in selected timezone to UTC ISO string
        // The datetime-local input gives us a string like "2025-11-03T15:00"
        // We need to interpret this as being in the selected timezone, then convert to UTC
        try {
          const [datePart, timePart] = sendAt.split('T');
          const [year, month, day] = datePart.split('-').map(Number);
          const [hours, minutes] = timePart.split(':').map(Number);
          
          // Method: Find the UTC time that when formatted in the target timezone gives us our target time
          // We'll iterate through possible UTC times on that date and find the match
          // Start at midnight UTC on the target date and search forward
          const startUtc = new Date(Date.UTC(year, month - 1, day, 0, 0, 0));
          const endUtc = new Date(Date.UTC(year, month - 1, day + 1, 0, 0, 0));
          
          const formatter = new Intl.DateTimeFormat('en-CA', {
            timeZone: timezone,
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false,
          });
          
          const targetDateStr = datePart;
          const targetTimeStr = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
          
          // Search for the UTC time that when formatted in target timezone matches our target
          // Use a two-pass approach: coarse search then fine-tune
          let bestMatch = startUtc;
          let bestScore = Infinity;
          let bestOffset = 0;
          
          // First pass: search in 15-minute increments for the 48-hour window
          for (let offsetMs = -24 * 60 * 60 * 1000; offsetMs <= 24 * 60 * 60 * 1000; offsetMs += 15 * 60 * 1000) {
            const testUtc = new Date(startUtc.getTime() + offsetMs);
            const formatted = formatter.format(testUtc);
            
            // Parse formatted result: "YYYY-MM-DD, HH:MM" or "YYYY-MM-DDTHH:MM"
            const parts = formatted.replace(',', '').split(/[T ]/);
            if (parts.length >= 2) {
              const formattedDate = parts[0];
              const formattedTime = parts[1].substring(0, 5); // "HH:MM"
              
              if (formattedDate === targetDateStr && formattedTime === targetTimeStr) {
                bestMatch = testUtc;
                bestOffset = offsetMs;
                break; // Exact match found
              }
              
              // Score: how close are we? (date match + time difference)
              if (formattedDate === targetDateStr) {
                const [fh, fm] = formattedTime.split(':').map(Number);
                const timeDiff = Math.abs((fh - hours) * 60 + (fm - minutes));
                if (timeDiff < bestScore) {
                  bestScore = timeDiff;
                  bestMatch = testUtc;
                  bestOffset = offsetMs;
                }
              }
            }
          }
          
          // Second pass: fine-tune around the best match (within ±15 minutes)
          if (bestScore > 0) {
            for (let offsetMs = bestOffset - 15 * 60 * 1000; offsetMs <= bestOffset + 15 * 60 * 1000; offsetMs += 60 * 1000) {
              const testUtc = new Date(startUtc.getTime() + offsetMs);
              const formatted = formatter.format(testUtc);
              
              const parts = formatted.replace(',', '').split(/[T ]/);
              if (parts.length >= 2) {
                const formattedDate = parts[0];
                const formattedTime = parts[1].substring(0, 5);
                
                if (formattedDate === targetDateStr && formattedTime === targetTimeStr) {
                  bestMatch = testUtc;
                  break; // Exact match found
                }
              }
            }
          }
          
          payload.send_at = bestMatch.toISOString();
        } catch (error) {
          console.error('Error converting timezone:', error);
          // Fallback: treat as local browser time (may be incorrect but won't crash)
          const localDate = new Date(sendAt);
          payload.send_at = localDate.toISOString();
        }
      } else {
        payload.recurrence_cron = recurrenceCron;
        if (maxRuns) {
          const runs = parseInt(maxRuns);
          if (!isNaN(runs) && runs > 0) {
            payload.max_runs = runs;
          }
        }
      }

      if (messageSource === "saved") {
        payload.saved_message_id = savedMessageId;
      } else {
        payload.payload = {
          content: snapshotContent || null,
          embeds: snapshotEmbeds ? (Array.isArray(snapshotEmbeds) ? snapshotEmbeds : [snapshotEmbeds]) : null,
        };
      }

      const url = schedule
        ? `/api/schedules/${schedule.id}`
        : "/api/schedules";
      const method = schedule ? "PATCH" : "POST";

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        toast.success(
          schedule ? "Schedule updated successfully" : "Schedule created successfully"
        );
        onSuccess();
      } else {
        const data = await response.json();
        toast.error(data.error || "Failed to save schedule");
      }
    } catch (error) {
      console.error("Failed to save schedule:", error);
      toast.error("Failed to save schedule");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-discord-channel-sidebar text-white border-discord-hover">
        <DialogHeader>
          <DialogTitle>
            {schedule ? "Edit Scheduled Message" : "New Scheduled Message"}
          </DialogTitle>
          <DialogDescription className="text-discord-text-muted">
            {schedule
              ? "Update your scheduled message settings"
              : "Create a new scheduled message to send at a specific time or periodically"}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-6 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">NAME</Label>
              <Input
                id="name"
                placeholder="Schedule name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={32}
                className="bg-card border-discord-hover text-white"
              />
              <div className="text-xs text-discord-text-muted">
                {name.length}/32
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="messageSource">MESSAGE SOURCE</Label>
              <select
                id="messageSource"
                value={messageSource}
                onChange={(e) => setMessageSource(e.target.value as "saved" | "snapshot")}
                className="h-9 w-full rounded border border-discord-hover bg-card px-3 text-sm text-white"
              >
                <option value="saved">Use Saved Template</option>
                <option value="snapshot">Snapshot Message Content</option>
              </select>
            </div>

            {messageSource === "saved" ? (
              <div className="grid gap-2">
                <Label htmlFor="savedMessage">SAVED TEMPLATE</Label>
                <select
                  id="savedMessage"
                  value={savedMessageId}
                  onChange={(e) => setSavedMessageId(e.target.value)}
                  className="h-9 w-full rounded border border-discord-hover bg-card px-3 text-sm text-white"
                  disabled={loadingTemplates}
                >
                  <option value="">Select template</option>
                  {templates.map((template) => (
                    <option key={template.id} value={template.id}>
                      {template.name}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="grid gap-2">
                <Label htmlFor="snapshotContent">MESSAGE CONTENT</Label>
                <Textarea
                  id="snapshotContent"
                  placeholder="Enter message content (optional if using embed)"
                  value={snapshotContent}
                  onChange={(e) => setSnapshotContent(e.target.value)}
                  className="bg-card border-discord-hover text-white min-h-[100px]"
                />
                <div className="text-xs text-discord-text-muted">
                  Note: Embed snapshot not available in this modal. Use saved template for embeds or create the schedule with payload manually.
                </div>
              </div>
            )}

            <div className="grid gap-2">
              <Label htmlFor="channel">CHANNEL</Label>
              <select
                id="channel"
                value={channelId}
                onChange={(e) => handleChannelChange(e.target.value)}
                className="h-9 w-full rounded border border-discord-hover bg-card px-3 text-sm text-white"
              >
                <option value="">Select channel</option>
                {channels.map((channel) => (
                  <option key={channel.id} value={channel.id}>
                    # {channel.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid gap-2">
              <Label>SEND TYPE</Label>
              <Tabs value={sendType} onValueChange={(v) => setSendType(v as "once" | "periodic")}>
                <TabsList className="grid w-full grid-cols-2 bg-discord-hover p-1">
                  <TabsTrigger 
                    value="once"
                    className="text-discord-text-muted data-[state=active]:bg-discord-blurple dark:data-[state=active]:bg-discord-blurple data-[state=active]:hover:bg-discord-blurple/90 data-[state=active]:text-white dark:data-[state=active]:text-white data-[state=inactive]:bg-transparent"
                  >
                    Send Once
                  </TabsTrigger>
                  <TabsTrigger 
                    value="periodic"
                    className="text-discord-text-muted data-[state=active]:bg-discord-blurple dark:data-[state=active]:bg-discord-blurple data-[state=active]:hover:bg-discord-blurple/90 data-[state=active]:text-white dark:data-[state=active]:text-white data-[state=inactive]:bg-transparent"
                  >
                    Send Periodically
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>

            {sendType === "once" ? (
              <div className="grid gap-2">
                <Label htmlFor="sendAt">SEND AT</Label>
                <Input
                  id="sendAt"
                  type="datetime-local"
                  value={sendAt}
                  onChange={(e) => setSendAt(e.target.value)}
                  className="bg-card border-discord-hover text-white"
                />
              </div>
            ) : (
              <div className="grid gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="cronPreset">PRESET (OPTIONAL)</Label>
                  <select
                    id="cronPreset"
                    value={cronPreset}
                    onChange={(e) => handleCronPresetChange(e.target.value)}
                    className="h-9 w-full rounded border border-discord-hover bg-card px-3 text-sm text-white"
                  >
                    <option value="">Custom</option>
                    <option value="hourly">Hourly</option>
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                  </select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="recurrenceCron">CRON EXPRESSION</Label>
                  <Input
                    id="recurrenceCron"
                    placeholder="0 * * * * (every hour)"
                    value={recurrenceCron}
                    onChange={(e) => setRecurrenceCron(e.target.value)}
                    className="bg-card border-discord-hover text-white"
                  />
                  <div className="text-xs text-discord-text-muted">
                    Format: minute hour day month weekday (e.g., "0 0 * * *" for daily at midnight)
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="maxRuns">MAX RUNS (OPTIONAL)</Label>
                  <Input
                    id="maxRuns"
                    type="number"
                    min="1"
                    placeholder="Leave empty for unlimited"
                    value={maxRuns}
                    onChange={(e) => setMaxRuns(e.target.value)}
                    className="bg-card border-discord-hover text-white"
                  />
                </div>
              </div>
            )}

            <div className="grid gap-2">
              <Label htmlFor="timezone">TIMEZONE</Label>
              <TimezoneSelector
                value={timezone}
                onChange={setTimezone}
                className="bg-card border-discord-hover text-white"
              />
              <div className="text-xs text-discord-text-muted">
                Select your timezone or search by name or city
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Saving..." : schedule ? "Update Schedule" : "Create Schedule"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

