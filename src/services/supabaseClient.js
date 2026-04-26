import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://sbpyojhuihdpzxgrgmid.supabase.co'
const supabaseKey = 'sb_publishable_1Us4K-L7oNn7YeMtXCihpA_Ej1a9eQg'

export const supabase = createClient(supabaseUrl, supabaseKey)
