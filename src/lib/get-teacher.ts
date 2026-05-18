// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabase = any;

/**
 * 查詢老師資料，先以 user_id 查；找不到時以 email fallback，
 * 並將 user_id 補寫回 DB，確保 Google OAuth 與 Email OTP 都能正常登入。
 */
export async function getTeacherByUser(
  supabase: AnySupabase,
  userId: string,
  userEmail: string | undefined,
  select = 'id, name'
): Promise<Record<string, any> | null> {
  const { data: teacher } = await supabase
    .from('teachers')
    .select(select)
    .eq('user_id', userId)
    .maybeSingle();

  if (teacher) return teacher as Record<string, any>;

  if (!userEmail) return null;

  const { data: teacherByEmail } = await supabase
    .from('teachers')
    .select(select)
    .ilike('email', userEmail.toLowerCase().trim())
    .maybeSingle();

  if (teacherByEmail) {
    // 補寫 user_id，讓下次直接走快速路徑
    await supabase
      .from('teachers')
      .update({ user_id: userId })
      .eq('id', (teacherByEmail as any).id);
  }

  return (teacherByEmail as Record<string, any>) ?? null;
}
