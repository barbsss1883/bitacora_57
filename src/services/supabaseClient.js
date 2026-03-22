import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://afbozpnoudjyyvegktzu.supabase.co'
const supabaseKey = 'sb_publishable_lFh6JAYuRIO2ToS7j-c-hA_ManF_PMO'

export const supabase = createClient(supabaseUrl, supabaseKey)
