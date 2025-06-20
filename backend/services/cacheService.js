import { supabase } from '../config/supabaseClient.js';

export const getFromCache = async (key) => {
  const { data, error } = await supabase
    .from('cache')
    .select('value, expires_at')
    .eq('key', key)
    .single();

  if (error || !data) return null;

  if (new Date(data.expires_at) < new Date()) {
    // Cache expired, let's clean it up asynchronously
    await supabase.from('cache').delete().eq('key', key);
    return null;
  }

  return data.value;
};

export const setInCache = async (key, value, ttl_seconds = 3600) => {
  const expires_at = new Date(Date.now() + ttl_seconds * 1000).toISOString();
  const { error } = await supabase
    .from('cache')
    .upsert({ key, value, expires_at });

  if (error) {
    console.error('Error setting cache:', error);
  }
};