import { useCallback, useEffect, useState } from "react";
import { supabase, isSupabaseConfigured } from "../lib/supabase";

const TABLE = "personal_events";

function rowToEvent(r) {
  return {
    id:          r.id,
    userId:      r.user_id,
    title:       r.title,
    date:        r.date,
    endDate:     r.end_date ?? null,
    description: r.description ?? null,
    color:       r.color ?? "#6366F1",
    allDay:      r.all_day ?? true,
    createdAt:   r.created_at,
    type:        "personal",
  };
}

function eventToRow(data) {
  const row = {};
  if (data.title       !== undefined) row.title       = data.title;
  if (data.date        !== undefined) row.date        = data.date;
  if (data.endDate     !== undefined) row.end_date    = data.endDate;
  if (data.description !== undefined) row.description = data.description;
  if (data.color       !== undefined) row.color       = data.color;
  if (data.allDay      !== undefined) row.all_day     = data.allDay;
  return row;
}

export function usePersonalEvents({ userId } = {}) {
  const [events, setEvents]   = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId || !isSupabaseConfigured) { setLoading(false); return; }

    setLoading(true);
    supabase
      .from(TABLE)
      .select("*")
      .eq("user_id", userId)
      .order("date", { ascending: true })
      .then(({ data }) => {
        setEvents((data || []).map(rowToEvent));
        setLoading(false);
      });

    const channel = supabase
      .channel(`personal-events-${userId}`)
      .on("postgres_changes", {
        event:  "*",
        schema: "public",
        table:  TABLE,
        filter: `user_id=eq.${userId}`,
      }, payload => {
        if (payload.eventType === "INSERT") {
          setEvents(prev => [...prev, rowToEvent(payload.new)]);
        } else if (payload.eventType === "UPDATE") {
          setEvents(prev => prev.map(e => e.id === payload.new.id ? rowToEvent(payload.new) : e));
        } else if (payload.eventType === "DELETE") {
          setEvents(prev => prev.filter(e => e.id !== payload.old.id));
        }
      })
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [userId]);

  const createEvent = useCallback(async (data) => {
    if (!isSupabaseConfigured) return null;
    const { data: row, error } = await supabase
      .from(TABLE)
      .insert({ ...eventToRow(data), user_id: userId })
      .select()
      .single();
    if (error) throw error;
    return rowToEvent(row);
  }, [userId]);

  const updateEvent = useCallback(async (id, patch) => {
    if (!isSupabaseConfigured) return;
    const { data, error } = await supabase
      .from(TABLE)
      .update({ ...eventToRow(patch), updated_at: new Date().toISOString() })
      .eq("id", id)
      .select();
    if (error) throw error;
    // Zero linha = RLS barrou (UPDATE bloqueado volta error:null/data:[]).
    if (!data || data.length === 0) throw new Error("Não foi possível salvar o evento — verifique suas permissões.");
  }, []);

  const deleteEvent = useCallback(async (id) => {
    if (!isSupabaseConfigured) return;
    const { error } = await supabase.from(TABLE).delete().eq("id", id);
    if (error) throw error;
  }, []);

  return { events, loading, createEvent, updateEvent, deleteEvent };
}
