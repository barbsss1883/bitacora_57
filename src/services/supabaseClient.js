import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://sbpyojhuihdpzxgrgmid.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNicHlvamh1aWhkcHp4Z3JnbWlkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY3MTM4MjEsImV4cCI6MjA5MjI4OTgyMX0.o_lux8lfEzkFAQMHJPa6WamZOzxvrBSHmU140FM48jQ'

export const supabase = createClient(supabaseUrl, supabaseKey)
