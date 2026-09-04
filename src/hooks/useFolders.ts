import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useProjectContext } from "@/contexts/ProjectContext";
import { toast } from "sonner";

export interface Folder {
  id: string;
  name: string;
  parent_id: string | null;
  project_id: string;
  created_by: string;
  created_at: string;
  color: string;
}

export function useFolders(parentId: string | null = null) {
  const { currentProject } = useProjectContext();
  const queryClient = useQueryClient();
  const projectId = currentProject?.id;

  const { data: folders = [], isLoading } = useQuery({
    queryKey: ["folders", projectId, parentId],
    queryFn: async () => {
      if (!projectId) return [];
      let query = supabase
        .from("folders")
        .select("*")
        .eq("project_id", projectId)
        .is("deleted_at", null)
        .order("created_at", { ascending: true });

      if (parentId) {
        query = query.eq("parent_id", parentId);
      } else {
        query = query.is("parent_id", null);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as Folder[];
    },
    enabled: !!projectId,
  });

  const createFolder = useMutation({
    mutationFn: async ({ name, color, parentId: pid }: { name: string; color: string; parentId?: string | null }) => {
      if (!projectId) throw new Error("No project");
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase.from("folders").insert({
        name,
        color,
        parent_id: pid || null,
        project_id: projectId,
        created_by: user.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["folders", projectId] });
      toast.success("Pasta criada!");
    },
    onError: () => toast.error("Erro ao criar pasta."),
  });

  const deleteFolder = useMutation({
    mutationFn: async (folderId: string) => {
      const { error } = await supabase.from("folders").update({ deleted_at: new Date().toISOString() }).eq("id", folderId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["folders", projectId] });
      toast.success("Pasta movida para a lixeira!");
    },
    onError: () => toast.error("Erro ao excluir pasta."),
  });

  // Trash: list deleted folders
  const { data: trashedFolders = [], isLoading: isLoadingTrash } = useQuery({
    queryKey: ["folders-trash", projectId],
    queryFn: async () => {
      if (!projectId) return [];
      const { data, error } = await supabase
        .from("folders")
        .select("*")
        .eq("project_id", projectId)
        .not("deleted_at", "is", null)
        .order("deleted_at", { ascending: false });
      if (error) throw error;
      return data as (Folder & { deleted_at: string })[];
    },
    enabled: !!projectId,
  });

  const restoreFolder = useMutation({
    mutationFn: async (folderId: string) => {
      const { error } = await supabase.from("folders").update({ deleted_at: null }).eq("id", folderId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["folders", projectId] });
      queryClient.invalidateQueries({ queryKey: ["folders-trash", projectId] });
      toast.success("Pasta restaurada!");
    },
    onError: () => toast.error("Erro ao restaurar pasta."),
  });

  const permanentDeleteFolder = useMutation({
    mutationFn: async (folderId: string) => {
      const { error } = await supabase.from("folders").delete().eq("id", folderId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["folders-trash", projectId] });
      toast.success("Pasta excluída permanentemente!");
    },
    onError: () => toast.error("Erro ao excluir pasta."),
  });

  const renameFolder = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const { error } = await supabase.from("folders").update({ name }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["folders", projectId] });
      toast.success("Pasta renomeada!");
    },
    onError: () => toast.error("Erro ao renomear pasta."),
  });

  return { folders, isLoading, createFolder, deleteFolder, renameFolder, trashedFolders, isLoadingTrash, restoreFolder, permanentDeleteFolder };
}
