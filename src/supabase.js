import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://ihrxotvyvspnlwhcbvdq.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlocnhvdHZ5dnNwbmx3aGNidmRxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI1NjcyMTAsImV4cCI6MjA5ODE0MzIxMH0.Qhsd9eIF2qhUivIUndHr2bXbJaU_o6yJxVLK7enRe6c'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
