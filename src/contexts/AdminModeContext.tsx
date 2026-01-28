import { createContext, useContext, useState, ReactNode } from "react";

interface AdminModeContextType {
  isAdminModeEnabled: boolean;
  setIsAdminModeEnabled: (enabled: boolean) => void;
}

const AdminModeContext = createContext<AdminModeContextType | undefined>(undefined);

export function AdminModeProvider({ children }: { children: ReactNode }) {
  const [isAdminModeEnabled, setIsAdminModeEnabled] = useState(true);

  return (
    <AdminModeContext.Provider value={{ isAdminModeEnabled, setIsAdminModeEnabled }}>
      {children}
    </AdminModeContext.Provider>
  );
}

export function useAdminMode() {
  const context = useContext(AdminModeContext);
  if (context === undefined) {
    throw new Error("useAdminMode must be used within an AdminModeProvider");
  }
  return context;
}
