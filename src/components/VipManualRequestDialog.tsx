import { useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Upload, X, Image as ImageIcon, Hand, Crown, Globe, Phone, MapPin, AlertCircle } from "lucide-react";

interface VipManualRequestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (note: string, imageUrls: string[], vipData: VipData) => Promise<void>;
  siteNames: string[];
  prompt: string;
}

export interface VipData {
  domain: string;
  address: string;
  phone: string;
}

const MAX_IMAGES = 5;
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

// Validation patterns
const DOMAIN_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9]?\.[a-zA-Z]{2,}$/;
const PHONE_PATTERN = /^[+]?[\d\s\-()]{7,20}$/;

export function VipManualRequestDialog({
  open,
  onOpenChange,
  onSubmit,
  siteNames,
  prompt
}: VipManualRequestDialogProps) {
  const { t } = useLanguage();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [note, setNote] = useState("");
  const [domain, setDomain] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [images, setImages] = useState<{ file: File; preview: string }[]>([]);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<{ domain?: string; address?: string; phone?: string }>({});

  const validateFields = (): boolean => {
    const newErrors: { domain?: string; address?: string; phone?: string } = {};
    
    // Domain validation
    if (!domain.trim()) {
      newErrors.domain = t("vipRequest.domainRequired") || "Домен обов'язковий";
    } else if (!DOMAIN_PATTERN.test(domain.trim())) {
      newErrors.domain = t("vipRequest.domainInvalid") || "Невірний формат домену (наприклад: example.com)";
    }
    
    // Address validation
    if (!address.trim()) {
      newErrors.address = t("vipRequest.addressRequired") || "Адреса обов'язкова";
    } else if (address.trim().length < 10) {
      newErrors.address = t("vipRequest.addressTooShort") || "Адреса занадто коротка (мін. 10 символів)";
    }
    
    // Phone validation
    if (!phone.trim()) {
      newErrors.phone = t("vipRequest.phoneRequired") || "Телефон обов'язковий";
    } else if (!PHONE_PATTERN.test(phone.trim())) {
      newErrors.phone = t("vipRequest.phoneInvalid") || "Невірний формат телефону";
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    
    for (const file of files) {
      if (!file.type.startsWith("image/")) {
        toast.error(t("vipRequest.onlyImages") || "Тільки зображення дозволені");
        continue;
      }
      
      if (file.size > MAX_FILE_SIZE) {
        toast.error(t("vipRequest.fileTooLarge") || "Файл занадто великий (макс. 5MB)");
        continue;
      }
      
      if (images.length >= MAX_IMAGES) {
        toast.error(t("vipRequest.maxImages") || `Максимум ${MAX_IMAGES} зображень`);
        break;
      }
      
      const preview = URL.createObjectURL(file);
      setImages(prev => [...prev, { file, preview }]);
    }
    
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const removeImage = (index: number) => {
    setImages(prev => {
      const newImages = [...prev];
      URL.revokeObjectURL(newImages[index].preview);
      newImages.splice(index, 1);
      return newImages;
    });
  };

  const uploadImages = async (): Promise<string[]> => {
    if (images.length === 0) return [];
    
    const urls: string[] = [];
    const userId = (await supabase.auth.getUser()).data.user?.id;
    
    if (!userId) throw new Error("Not authenticated");
    
    for (const { file } of images) {
      const ext = file.name.split(".").pop() || "jpg";
      const fileName = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      
      const { error } = await supabase.storage
        .from("manual-request-images")
        .upload(fileName, file);
      
      if (error) throw error;
      
      const { data: urlData } = supabase.storage
        .from("manual-request-images")
        .getPublicUrl(fileName);
      
      urls.push(urlData.publicUrl);
    }
    
    return urls;
  };

  const handleSubmit = async () => {
    // Validate before submit
    if (!validateFields()) {
      toast.error(t("vipRequest.fixErrors") || "Виправте помилки у формі");
      return;
    }
    
    setSubmitting(true);
    
    try {
      setUploading(true);
      const imageUrls = await uploadImages();
      setUploading(false);
      
      const vipData: VipData = {
        domain: domain.trim(),
        address: address.trim(),
        phone: phone.trim()
      };
      
      await onSubmit(note, imageUrls, vipData);
      
      // Clean up
      images.forEach(img => URL.revokeObjectURL(img.preview));
      setImages([]);
      setNote("");
      setDomain("");
      setAddress("");
      setPhone("");
      setErrors({});
      onOpenChange(false);
      
    } catch (error) {
      console.error("VIP request error:", error);
      toast.error(error instanceof Error ? error.message : "Помилка відправки");
    } finally {
      setSubmitting(false);
      setUploading(false);
    }
  };

  const handleClose = () => {
    if (!submitting) {
      images.forEach(img => URL.revokeObjectURL(img.preview));
      setImages([]);
      setNote("");
      setDomain("");
      setAddress("");
      setPhone("");
      setErrors({});
      onOpenChange(false);
    }
  };

  const hasErrors = Object.keys(errors).length > 0;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Crown className="h-5 w-5 text-purple-500" />
            {t("vipRequest.title") || "VIP Ручний запит"}
          </DialogTitle>
          <DialogDescription>
            {t("vipRequest.description") || "Заповніть обов'язкові поля та додайте зображення"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Site info */}
          <div className="p-3 bg-muted rounded-lg">
            <div className="flex flex-wrap gap-1 mb-2">
              {siteNames.map((name, i) => (
                <Badge key={i} variant="secondary" className="text-xs">
                  {name}
                </Badge>
              ))}
            </div>
            <p className="text-xs text-muted-foreground line-clamp-2">{prompt}</p>
          </div>

          {/* Validation error alert */}
          {hasErrors && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                {t("vipRequest.fillRequired") || "Заповніть всі обов'язкові поля коректно"}
              </AlertDescription>
            </Alert>
          )}

          {/* Domain field */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Globe className="h-4 w-4" />
              {t("vipRequest.domain") || "Домен"} <span className="text-destructive">*</span>
            </Label>
            <Input
              placeholder="example.com"
              value={domain}
              onChange={(e) => {
                setDomain(e.target.value);
                if (errors.domain) setErrors(prev => ({ ...prev, domain: undefined }));
              }}
              className={errors.domain ? "border-destructive" : ""}
            />
            {errors.domain && (
              <p className="text-xs text-destructive">{errors.domain}</p>
            )}
          </div>

          {/* Address field */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              {t("vipRequest.address") || "Адреса"} <span className="text-destructive">*</span>
            </Label>
            <Input
              placeholder="вул. Хрещатик 1, Київ, Україна"
              value={address}
              onChange={(e) => {
                setAddress(e.target.value);
                if (errors.address) setErrors(prev => ({ ...prev, address: undefined }));
              }}
              className={errors.address ? "border-destructive" : ""}
            />
            {errors.address && (
              <p className="text-xs text-destructive">{errors.address}</p>
            )}
          </div>

          {/* Phone field */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Phone className="h-4 w-4" />
              {t("vipRequest.phone") || "Телефон"} <span className="text-destructive">*</span>
            </Label>
            <Input
              placeholder="+380 44 123 4567"
              value={phone}
              onChange={(e) => {
                setPhone(e.target.value);
                if (errors.phone) setErrors(prev => ({ ...prev, phone: undefined }));
              }}
              className={errors.phone ? "border-destructive" : ""}
            />
            {errors.phone && (
              <p className="text-xs text-destructive">{errors.phone}</p>
            )}
          </div>

          {/* Note */}
          <div className="space-y-2">
            <Label>{t("vipRequest.note") || "Примітка до ТЗ"}</Label>
            <Textarea
              placeholder={t("vipRequest.notePlaceholder") || "Додаткові вимоги, побажання..."}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              className="resize-none"
            />
          </div>

          {/* Image upload */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <ImageIcon className="h-4 w-4" />
              {t("vipRequest.images") || "Зображення для сайту"}
              <span className="text-xs text-muted-foreground">
                ({images.length}/{MAX_IMAGES})
              </span>
            </Label>
            
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={handleFileSelect}
              className="hidden"
            />
            
            {/* Preview grid */}
            <div className="grid grid-cols-5 gap-2">
              {images.map((img, index) => (
                <div key={index} className="relative aspect-square group">
                  <img
                    src={img.preview}
                    alt={`Preview ${index + 1}`}
                    className="w-full h-full object-cover rounded-lg border"
                  />
                  <button
                    onClick={() => removeImage(index)}
                    className="absolute -top-1 -right-1 p-0.5 bg-destructive text-destructive-foreground rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
              
              {images.length < MAX_IMAGES && (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="aspect-square border-2 border-dashed rounded-lg flex items-center justify-center hover:bg-muted transition-colors"
                >
                  <Upload className="h-5 w-5 text-muted-foreground" />
                </button>
              )}
            </div>
            
            <p className="text-xs text-muted-foreground">
              {t("vipRequest.imageHint") || "Додайте фото логотипу, референсу або контенту для сайту"}
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={submitting}>
            {t("common.cancel") || "Скасувати"}
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={submitting}
            className="bg-purple-600 hover:bg-purple-700"
          >
            {submitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {uploading 
                  ? (t("vipRequest.uploading") || "Завантаження...") 
                  : (t("vipRequest.sending") || "Відправка...")}
              </>
            ) : (
              <>
                <Hand className="mr-2 h-4 w-4" />
                {t("vipRequest.send") || "Відправити запит"}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
