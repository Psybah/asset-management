export type Role = 'admin' | 'manager' | 'staff'
export type Status = 'available' | 'assigned' | 'maintenance' | 'retired'
export type Condition = 'new' | 'good' | 'fair' | 'poor'

export interface User {
  id: number
  username: string
  name: string
  email: string
  role: Role
  department: number | null
  department_name: string | null
  initials: string
  asset_count?: number
}

export interface Category { id: number; name: string; icon: string; useful_life_years: number; asset_count: number }
export interface Location { id: number; name: string; floor: string; asset_count: number }
export interface Department { id: number; name: string; asset_count: number }

export interface Asset {
  id: number
  tag: string
  name: string
  category: number
  category_name: string
  category_icon: string
  serial_number: string
  vendor: string
  purchase_date: string
  purchase_cost: number
  salvage_value: number
  depreciation_method: 'straight_line' | 'declining_balance'
  useful_life_years: number
  location: number | null
  location_name: string | null
  department: number | null
  department_name: string | null
  status: Status
  condition: Condition
  assigned_to: number | null
  assigned_to_name: string | null
  assigned_since: string | null
  current_value: number
  accumulated_depreciation: number
  notes: string
  created_at: string
  updated_at: string
}

export interface DepRow { year: number; opening: number; depreciation: number; closing: number }

export interface TimelineItem {
  id: number | string
  type: 'created' | 'checkout' | 'checkin' | 'maintenance' | 'disposal' | 'update'
  title: string
  detail: string
  actor_name: string | null
  timestamp: string
}

export interface Assignment {
  id: number
  asset: number
  asset_tag: string
  asset_name: string
  user: number
  user_name: string
  checked_out_at: string
  due_date: string | null
  checked_in_at: string | null
  note: string
  return_condition: string | null
}

export interface Maintenance {
  id: number
  asset: number
  asset_tag: string
  asset_name: string
  kind: 'preventive' | 'corrective'
  title: string
  scheduled_date: string
  completed_date: string | null
  cost: number | null
  vendor: string
  status: 'scheduled' | 'in_progress' | 'done'
  notes: string
  overdue: boolean
}

export interface Audit {
  id: number
  actor_name: string | null
  action: string
  entity: string
  entity_id: number | null
  summary: string
  timestamp: string
}

export interface Dashboard {
  totals: {
    assets: number
    purchase_value: number
    current_value: number
    assigned: number
    available: number
    maintenance: number
    retired: number
    overdue_maintenance: number
  }
  by_category: { name: string; icon: string; count: number; value: number }[]
  by_department: { name: string; count: number; value: number }[]
  by_status: { status: Status; count: number }[]
  value_trend: { year: number; value: number }[]
  upcoming_maintenance: Maintenance[]
  recent_activity: Audit[]
}
