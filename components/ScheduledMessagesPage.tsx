"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Calendar,
  Trash2,
  Edit,
  Pause,
  Play,
  Clock,
  AlertCircle,
} from "lucide-react";
import { format } from "date-fns";
import { ScheduleMessageModal } from "@/components/modals/ScheduleMessageModal";
import { toast } from "sonner";

interface ScheduledMessage {
  id: string;
  name: string;
  channel_id: string;
  saved_message_id: string | null;
  payload: any;
  send_at: string | null;
  recurrence_cron: string | null;
  timezone: string;
  status: "active" | "paused" | "completed" | "cancelled";
  last_run_at: string | null;
  next_run_at: string | null;
  max_runs: number | null;
  run_count: number;
  last_error: string | null;
  created_at: string;
}

interface Channel {
  id: string;
  name: string;
}

interface ScheduledMessagesPageProps {
  workspaceId: string;
  workspaceName?: string;
}

export function ScheduledMessagesPage({
  workspaceId,
  workspaceName,
}: ScheduledMessagesPageProps) {
  const [schedules, setSchedules] = useState<ScheduledMessage[]>([]);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<ScheduledMessage | null>(null);

  useEffect(() => {
    if (workspaceId) {
      fetchSchedules();
      fetchChannels();
    }
  }, [workspaceId]);

  const fetchSchedules = async () => {
    try {
      const response = await fetch(`/api/schedules?workspace_id=${workspaceId}`);
      if (response.ok) {
        const data = await response.json();
        setSchedules(data.schedules || []);
      }
    } catch (error) {
      console.error("Failed to fetch schedules:", error);
      toast.error("Failed to load scheduled messages");
    } finally {
      setLoading(false);
    }
  };

  const fetchChannels = async () => {
    try {
      const response = await fetch(`/api/channels?workspace_id=${workspaceId}`);
      if (response.ok) {
        const data = await response.json();
        setChannels(data.channels || []);
      }
    } catch (error) {
      console.error("Failed to fetch channels:", error);
    }
  };

  const handleDelete = async (scheduleId: string) => {
    if (!confirm("Are you sure you want to delete this scheduled message?")) {
      return;
    }

    try {
      const response = await fetch(`/api/schedules/${scheduleId}`, {
        method: "DELETE",
      });

      if (response.ok) {
        setSchedules(schedules.filter((s) => s.id !== scheduleId));
        toast.success("Scheduled message deleted");
      } else {
        const data = await response.json();
        toast.error(data.error || "Failed to delete scheduled message");
      }
    } catch (error) {
      console.error("Failed to delete schedule:", error);
      toast.error("Failed to delete scheduled message");
    }
  };

  const handlePause = async (scheduleId: string) => {
    try {
      const response = await fetch(`/api/schedules/${scheduleId}/pause`, {
        method: "POST",
      });

      if (response.ok) {
        await fetchSchedules();
        toast.success("Schedule paused");
      } else {
        const data = await response.json();
        toast.error(data.error || "Failed to pause schedule");
      }
    } catch (error) {
      console.error("Failed to pause schedule:", error);
      toast.error("Failed to pause schedule");
    }
  };

  const handleResume = async (scheduleId: string) => {
    try {
      const response = await fetch(`/api/schedules/${scheduleId}/resume`, {
        method: "POST",
      });

      if (response.ok) {
        await fetchSchedules();
        toast.success("Schedule resumed");
      } else {
        const data = await response.json();
        toast.error(data.error || "Failed to resume schedule");
      }
    } catch (error) {
      console.error("Failed to resume schedule:", error);
      toast.error("Failed to resume schedule");
    }
  };

  const handleRunNow = async (scheduleId: string) => {
    try {
      const response = await fetch(`/api/schedules/${scheduleId}/run-now`, {
        method: "POST",
      });

      if (response.ok) {
        await fetchSchedules();
        toast.success("Schedule executed successfully");
      } else {
        const data = await response.json();
        toast.error(data.error || "Failed to run schedule");
      }
    } catch (error) {
      console.error("Failed to run schedule:", error);
      toast.error("Failed to run schedule");
    }
  };

  const handleEdit = (schedule: ScheduledMessage) => {
    setEditingSchedule(schedule);
    setIsModalOpen(true);
  };

  const handleCreate = () => {
    setEditingSchedule(null);
    setIsModalOpen(true);
  };

  const handleModalClose = () => {
    setIsModalOpen(false);
    setEditingSchedule(null);
  };

  const handleModalSuccess = () => {
    fetchSchedules();
    handleModalClose();
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return (
          <Badge variant="default" className="bg-green-600 hover:bg-green-700">
            Active
          </Badge>
        );
      case "paused":
        return (
          <Badge variant="secondary" className="bg-yellow-600 hover:bg-yellow-700">
            Paused
          </Badge>
        );
      case "completed":
        return (
          <Badge variant="default" className="bg-blue-600 hover:bg-blue-700">
            Completed
          </Badge>
        );
      case "cancelled":
        return (
          <Badge variant="destructive">Cancelled</Badge>
        );
      default:
        return <Badge>{status}</Badge>;
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "—";
    try {
      return format(new Date(dateString), "M/d/yyyy, h:mm:ss a");
    } catch {
      return dateString;
    }
  };

  const getChannelName = (channelId: string) => {
    const channel = channels.find((c) => c.id === channelId);
    return channel ? `# ${channel.name}` : channelId;
  };

  const activeSchedules = schedules.filter(
    (s) => s.status === "active" || s.status === "paused"
  ).length;
  const maxSchedules = 5;

  if (loading) {
    return (
      <div className="p-8 text-center text-gray-400">Loading...</div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-discord-message-area text-white">
      <div className="p-6">
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-2xl font-bold">
            Scheduled Messages {activeSchedules}/{maxSchedules}
          </h1>
        </div>
        <p className="text-sm text-gray-400 mb-6">
          You can create scheduled messages to send a message at a specific time
          and date or periodically. This can be useful for announcements,
          reminders and a lot more.
        </p>

        {schedules.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <Calendar className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p className="mb-4">No scheduled messages yet</p>
            <Button onClick={handleCreate}>New Scheduled Message</Button>
          </div>
        ) : (
          <>
            <div className="space-y-4">
              {schedules.map((schedule) => (
                <Card
                  key={schedule.id}
                  className="bg-discord-channel-sidebar border-discord-hover p-4"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <Calendar className="w-5 h-5 text-gray-400" />
                        <span className="font-medium">{schedule.name}</span>
                        {getStatusBadge(schedule.status)}
                        {schedule.last_error && (
                          <AlertCircle className="w-4 h-4 text-yellow-500" />
                        )}
                      </div>
                      <div className="text-sm text-gray-400 space-y-1 ml-8">
                        <div>
                          <strong>Channel:</strong> {getChannelName(schedule.channel_id)}
                        </div>
                        {schedule.recurrence_cron ? (
                          <div>
                            <strong>Recurrence:</strong> {schedule.recurrence_cron}
                          </div>
                        ) : (
                          <div>
                            <strong>Send At:</strong> {formatDate(schedule.send_at)}
                          </div>
                        )}
                        {schedule.next_run_at && (
                          <div>
                            <strong>Next Run:</strong> {formatDate(schedule.next_run_at)}
                          </div>
                        )}
                        {schedule.last_run_at && (
                          <div>
                            <strong>Last Run:</strong> {formatDate(schedule.last_run_at)}
                          </div>
                        )}
                        {schedule.max_runs && (
                          <div>
                            <strong>Runs:</strong> {schedule.run_count} / {schedule.max_runs}
                          </div>
                        )}
                        {schedule.last_error && (
                          <div className="text-yellow-500">
                            <strong>Last Error:</strong> {schedule.last_error}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {schedule.status === "active" && (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleRunNow(schedule.id)}
                            title="Run Now"
                          >
                            <Clock className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handlePause(schedule.id)}
                            title="Pause"
                          >
                            <Pause className="w-4 h-4" />
                          </Button>
                        </>
                      )}
                      {schedule.status === "paused" && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleResume(schedule.id)}
                          title="Resume"
                        >
                          <Play className="w-4 h-4" />
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEdit(schedule)}
                        title="Edit"
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleDelete(schedule.id)}
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
            <div className="mt-6 flex justify-end">
              <Button onClick={handleCreate}>New Scheduled Message</Button>
            </div>
          </>
        )}
      </div>

      <ScheduleMessageModal
        open={isModalOpen}
        onOpenChange={handleModalClose}
        workspaceId={workspaceId}
        schedule={editingSchedule}
        channels={channels}
        onSuccess={handleModalSuccess}
      />
    </div>
  );
}

