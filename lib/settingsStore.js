import { defaultSettings } from './defaultData';

export async function loadSettings(supabase, userId) {
  const { data, error } = await supabase
    .from('app_settings')
    .select('data')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw new Error(error.message);

  if (!data) {
    const seed = defaultSettings();
    const { error: insErr } = await supabase
      .from('app_settings')
      .insert({ user_id: userId, data: seed });
    if (insErr) throw new Error(insErr.message);
    return seed;
  }
  return data.data;
}

export async function saveSettings(supabase, userId, settings) {
  const { error } = await supabase
    .from('app_settings')
    .upsert({ user_id: userId, data: settings, updated_at: new Date().toISOString() });
  if (error) throw new Error(error.message);
}
