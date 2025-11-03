import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export interface FuelRecord {
  id: string
  date: string
  time?: string
  region?: string
  station?: string
  price_per_liter: number
  fuel_amount: number
  distance: number
  total_cost: number
  created_at?: string
}

export interface TollRecord {
  id: string
  date: string
  section?: string
  amount: number
  created_at?: string
}

export interface Settings {
  id?: string
  key: string
  value: string
  year_month?: string
}
