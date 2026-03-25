import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://nmykwpztvijkcuwmpmyw.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5teWt3cHp0dmlqa2N1d21wbXl3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg3ODU1OTIsImV4cCI6MjA4NDM2MTU5Mn0.7KaCkG7N9V32uYGGrnWbSdAmfC-oKYSM9eQ3fHcnUGg';
const supabase = createClient(supabaseUrl, supabaseKey);

async function testLeads() {
  console.log("Testing Leads...");
  
  let query = supabase
    .from('leads')
    .select('*', { count: 'exact' });
  
  const { data, error, count } = await query
    .order('created_at', { ascending: false })
    .range(0, 19);
    
  if (error) {
      console.log("Leads Error:", error);
  } else {
      console.log("Leads Success!", count);
  }
}

async function main() {
  await testLeads();
}

main();
