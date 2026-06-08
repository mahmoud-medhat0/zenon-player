export interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  is_active: boolean;
  tenant: Tenant | null;
}

export interface Tenant {
  id: string;
  name: string;
  plan_tier: string;
  is_active: boolean;
  primary_color?: string;
  logo_url?: string;
  plan?: Plan;
}

export interface Plan {
  id: string;
  name: string;
  slug: string;
  max_users: number;
  max_storage_gb: number;
  features: string[];
  is_active: boolean;
}

export interface PageProps {
  auth: {
    user: User | null;
  };
  flash: {
    success: string | null;
    error: string | null;
  };
  activeTab?: string;
  [key: string]: unknown;
}
