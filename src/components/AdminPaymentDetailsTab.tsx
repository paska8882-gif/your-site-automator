import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { Loader2, Save, History, Wallet } from "lucide-react";
import { format } from "date-fns";
import { uk } from "date-fns/locale";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";

interface PaymentAddress {
  id: string;
  network: string;
  address: string;
  is_active: boolean;
  updated_at: string;
}

interface AddressHistory {
  id: string;
  network: string;
  old_address: string | null;
  new_address: string;
  changed_by: string;
  changed_at: string;
  admin_name?: string;
}

export function AdminPaymentDetailsTab() {
  const { user } = useAuth();
  const [addresses, setAddresses] = useState<PaymentAddress[]>([]);
  const [history, setHistory] = useState<AddressHistory[]>([]);
  const [editedAddresses, setEditedAddresses] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    
    // Fetch addresses
    const { data: addressData, error: addressError } = await supabase
      .from("payment_addresses")
      .select("*")
      .order("network");

    if (addressError) {
      console.error("Error fetching addresses:", addressError);
      toast({
        title: "Помилка",
        description: "Не вдалося завантажити реквізити",
        variant: "destructive",
      });
    } else {
      setAddresses(addressData || []);
      const initialEdits: Record<string, string> = {};
      addressData?.forEach((addr) => {
        initialEdits[addr.id] = addr.address;
      });
      setEditedAddresses(initialEdits);
    }

    // Fetch history
    const { data: historyData, error: historyError } = await supabase
      .from("payment_address_history")
      .select("*")
      .order("changed_at", { ascending: false })
      .limit(50);

    if (historyError) {
      console.error("Error fetching history:", historyError);
    } else {
      // Fetch admin names
      const adminIds = [...new Set(historyData?.map((h) => h.changed_by) || [])];
      if (adminIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, display_name")
          .in("user_id", adminIds);

        const profileMap = new Map(
          profiles?.map((p) => [p.user_id, p.display_name]) || []
        );

        setHistory(
          historyData?.map((h) => ({
            ...h,
            admin_name: profileMap.get(h.changed_by) || "Невідомий",
          })) || []
        );
      } else {
        setHistory(historyData || []);
      }
    }

    setLoading(false);
  };

  const handleSave = async (addressId: string, network: string) => {
    if (!user) return;

    const currentAddress = addresses.find((a) => a.id === addressId);
    const newAddress = editedAddresses[addressId];

    if (!currentAddress || currentAddress.address === newAddress) {
      toast({
        title: "Без змін",
        description: "Адреса не змінилася",
      });
      return;
    }

    setSaving(true);

    // Update address
    const { error: updateError } = await supabase
      .from("payment_addresses")
      .update({ address: newAddress, updated_at: new Date().toISOString() })
      .eq("id", addressId);

    if (updateError) {
      console.error("Error updating address:", updateError);
      toast({
        title: "Помилка",
        description: "Не вдалося оновити адресу",
        variant: "destructive",
      });
      setSaving(false);
      return;
    }

    // Add to history
    const { error: historyError } = await supabase
      .from("payment_address_history")
      .insert({
        network,
        old_address: currentAddress.address,
        new_address: newAddress,
        changed_by: user.id,
      });

    if (historyError) {
      console.error("Error adding history:", historyError);
    }

    toast({
      title: "Збережено",
      description: `Адреса ${network} оновлена`,
    });

    fetchData();
    setSaving(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Wallet className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold">Реквізити для оплати</h1>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Edit Addresses */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Гаманці</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {addresses.map((addr) => (
              <div key={addr.id} className="space-y-2">
                <Label htmlFor={addr.id}>{addr.network}</Label>
                <div className="flex gap-2">
                  <Input
                    id={addr.id}
                    value={editedAddresses[addr.id] || ""}
                    onChange={(e) =>
                      setEditedAddresses((prev) => ({
                        ...prev,
                        [addr.id]: e.target.value,
                      }))
                    }
                    placeholder={`Введіть адресу ${addr.network}`}
                    className="font-mono text-sm"
                  />
                  <Button
                    size="icon"
                    onClick={() => handleSave(addr.id, addr.network)}
                    disabled={saving || editedAddresses[addr.id] === addr.address}
                  >
                    {saving ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* History */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <History className="h-5 w-5" />
              Історія змін
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[400px]">
              {history.length === 0 ? (
                <p className="text-muted-foreground text-sm text-center py-4">
                  Історія змін порожня
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Мережа</TableHead>
                      <TableHead>Адмін</TableHead>
                      <TableHead>Дата</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {history.map((h) => (
                      <TableRow key={h.id}>
                        <TableCell className="font-medium">{h.network}</TableCell>
                        <TableCell>{h.admin_name}</TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {format(new Date(h.changed_at), "dd MMM yyyy HH:mm", {
                            locale: uk,
                          })}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      {/* Full History Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Детальна історія</CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[300px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Мережа</TableHead>
                  <TableHead>Стара адреса</TableHead>
                  <TableHead>Нова адреса</TableHead>
                  <TableHead>Адмін</TableHead>
                  <TableHead>Дата</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {history.map((h) => (
                  <TableRow key={h.id}>
                    <TableCell className="font-medium">{h.network}</TableCell>
                    <TableCell className="font-mono text-xs max-w-[150px] truncate">
                      {h.old_address || "-"}
                    </TableCell>
                    <TableCell className="font-mono text-xs max-w-[150px] truncate">
                      {h.new_address}
                    </TableCell>
                    <TableCell>{h.admin_name}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {format(new Date(h.changed_at), "dd.MM.yyyy HH:mm", {
                        locale: uk,
                      })}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
