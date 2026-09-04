import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Member {
  user_id: string;
  full_name?: string;
  avatar_url?: string | null;
}

interface AssignTaskDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (assignedTo: string) => void;
  members: Member[];
  columnLabel: string;
  loading?: boolean;
}

export function AssignTaskDialog({
  open,
  onClose,
  onConfirm,
  members,
  columnLabel,
  loading,
}: AssignTaskDialogProps) {
  const [selected, setSelected] = useState("");

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Atribuir responsável — {columnLabel}</DialogTitle>
        </DialogHeader>
        <div className="py-4">
          <Select value={selected} onValueChange={setSelected}>
            <SelectTrigger>
              <SelectValue placeholder="Selecionar membro" />
            </SelectTrigger>
            <SelectContent>
              {members.map((m) => (
                <SelectItem key={m.user_id} value={m.user_id}>
                  {m.full_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            disabled={!selected || loading}
            onClick={() => {
              onConfirm(selected);
              setSelected("");
            }}
          >
            {loading ? "Salvando..." : "Confirmar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
