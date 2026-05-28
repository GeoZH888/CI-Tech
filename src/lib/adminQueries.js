import { supabase } from './supabase'

// Admin reads/writes. These succeed only for a super_admin session because
// of the is_super_admin() RLS policies on ct_projects.

// Every project (published or not), in display order. The "admin read all
// projects" policy lets a super admin see unpublished rows too.
export async function getAllProjects() {
  const { data, error } = await supabase
    .from('ct_projects')
    .select('*')
    .order('sort_order', { ascending: true })
  if (error) throw error
  return data ?? []
}

export async function getProjectByIdAdmin(id) {
  const { data, error } = await supabase.from('ct_projects').select('*').eq('id', id).single()
  if (error) throw error
  return data
}

// `payload` already has the *_zh/_it/_en columns, category, external_url,
// logo_url, tech_stack (array), is_published, sort_order.
export async function createProject(payload) {
  const { data, error } = await supabase.from('ct_projects').insert(payload).select().single()
  if (error) throw error
  return data
}

export async function updateProject(id, payload) {
  const { data, error } = await supabase
    .from('ct_projects')
    .update(payload)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteProject(id) {
  const { error } = await supabase.from('ct_projects').delete().eq('id', id)
  if (error) throw error
}

export async function setPublished(id, isPublished) {
  return updateProject(id, { is_published: isPublished })
}

// Persist a new ordering. `orderedIds` is the full id list in display order;
// each row's sort_order is rewritten to its index * 10 (gaps for easy manual
// tweaks later). Updates run in parallel.
export async function reorderProjects(orderedIds) {
  const updates = orderedIds.map((id, i) =>
    supabase.from('ct_projects').update({ sort_order: i * 10 }).eq('id', id)
  )
  const results = await Promise.all(updates)
  const failed = results.find((r) => r.error)
  if (failed?.error) throw failed.error
}
