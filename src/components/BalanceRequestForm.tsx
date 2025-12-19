import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Loader2, Send, Wallet } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface BalanceRequestFormProps {
  userId: string;
  teamId: string;
  onSuccess?: () => void;
}

export function BalanceRequestForm({ userId, teamId, onSuccess }: BalanceRequestFormProps) {
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [sending, setSending] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const amountNum = parseFloat(amount);
    if (!amountNum || amountNum <= 0) {
      toast.error("Введіть коректну суму");
      return;
    }

    if (!note.trim()) {
      toast.error("Введіть примітку з посиланням на квитанцію");
      return;
    }

    setSending(true);
    try {
      const { error } = await supabase.from("balance_requests").insert({
        user_id: userId,
        team_id: teamId,
        amount: amountNum,
        note: note.trim(),
        status: "pending"
      });

      if (error) throw error;

      toast.success("Запит на поповнення відправлено");
      setAmount("");
      setNote("");
      onSuccess?.();
    } catch (error) {
      console.error("Error submitting balance request:", error);
      toast.error("Помилка відправки запиту");
    } finally {
      setSending(false);
    }
  };

  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 mb-4">
        <Wallet className="h-4 w-4 text-primary" />
        <h3 className="font-medium text-sm">Поповнити баланс</h3>
      </div>
      
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="amount" className="text-xs">Сума ($) *</Label>
          <Input
            id="amount"
            type="number"
            step="0.01"
            min="0.01"
            placeholder="Введіть суму"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="h-9"
          />
        </div>
        
        <div className="space-y-1.5">
          <Label htmlFor="note" className="text-xs">Примітка / Посилання на квитанцію *</Label>
          <Textarea
            id="note"
            placeholder="Вставте посилання на квитанцію або опишіть деталі платежу"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="min-h-[80px] text-sm resize-none"
          />
        </div>
        
        <Button 
          type="submit" 
          className="w-full h-9" 
          disabled={sending || !amount || !note.trim()}
        >
          {sending ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : (
            <Send className="h-4 w-4 mr-2" />
          )}
          Відправити запит
        </Button>
      </form>
    </Card>
  );
}
