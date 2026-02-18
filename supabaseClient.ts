
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://bjahenpagmohqukmmonh.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJqYWhlbnBhZ21vaHF1a21tb25oIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEyOTQ3ODAsImV4cCI6MjA4Njg3MDc4MH0.x3iXkg218gJ-936ajqsrFwSbXOc3vv6as84Xl2jgIMo';

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false
  }
});
