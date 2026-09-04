import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface FlowStep {
  id: string;
  flow_id: string;
  name: string;
  order_number: number;
}

export interface Flow {
  id: string;
  name: string;
  created_by: string;
  created_at: string;
  steps: FlowStep[];
}

export interface FlowInstance {
  id: string;
  flow_id: string;
  project_id: string;
  current_step_index: number;
  status: string;
  created_by: string;
  created_at: string;
  flow_name?: string;
  project_name?: string;
  steps?: FlowStep[];
}

export function useFlows() {
  const [flows, setFlows] = useState<Flow[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchFlows = useCallback(async () => {
    setLoading(true);
    const { data: flowsData } = await supabase
      .from("flows")
      .select("*")
      .order("created_at", { ascending: false });

    if (!flowsData) {
      setFlows([]);
      setLoading(false);
      return;
    }

    const flowIds = flowsData.map((f) => f.id);
    let stepsMap: Record<string, FlowStep[]> = {};

    if (flowIds.length > 0) {
      const { data: steps } = await supabase
        .from("flow_steps")
        .select("*")
        .in("flow_id", flowIds)
        .order("order_number", { ascending: true });

      if (steps) {
        for (const s of steps) {
          if (!stepsMap[s.flow_id]) stepsMap[s.flow_id] = [];
          stepsMap[s.flow_id].push(s);
        }
      }
    }

    setFlows(
      flowsData.map((f) => ({
        ...f,
        steps: stepsMap[f.id] || [],
      }))
    );
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchFlows();
  }, [fetchFlows]);

  return { flows, loading, refetch: fetchFlows };
}
