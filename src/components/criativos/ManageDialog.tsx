import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Trash2, Plus } from "lucide-react";

interface Item {
  id: string;
  name: string;
}

interface ManageDialogProps {
  title: string;
  triggerLabel: string;
  items: Item[];
  onAdd: (name: string) => Promise<any>;
  onRemove: (id: string) => Promise<any>;
}

export function ManageDialog({ title, triggerLabel, items, onAdd, onRemove }: ManageDialogProps) {
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);

  const handleAdd = async () => {
    if (!name.trim()) return;
    setLoading(true);
    await onAdd(name.trim());
    setName("");
    setLoading(false);
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">{triggerLabel}</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="flex gap-2 mt-2">
          <Input
            placeholder="Nome..."
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
          />
          <Button size="sm" onClick={handleAdd} disabled={loading || !name.trim()}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        <div className="mt-4 space-y-2 max-h-60 overflow-y-auto">
          {items.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">Nenhum item cadastrado.</p>
          )}
          {items.map((item) => (
            <div key={item.id} className="flex items-center justify-between rounded-md border border-border px-3 py-2">
              <span className="text-sm">{item.name}</span>
              <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => onRemove(item.id)}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
