1import AsyncStorage from '@react-native-async-storage/async-storage'
2import { createClient } from '@supabase/supabase-js'
3
4export const supabase = createClient(
5  process.env.EXPO_PUBLIC_SUPABASE_URL!,
6  process.env.EXPO_PUBLIC_SUPABASE_KEY!,
7  {
8    auth: {
9      storage: AsyncStorage,
10      autoRefreshToken: true,
11      persistSession: true,
12      detectSessionInUrl: false,
13    },
14  })

