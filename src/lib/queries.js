import { supabase } from './supabase'

// Public reads. RLS allows anyone to select projects where is_published = true,
// so the anon client only ever sees published rows here.

const CARD_FIELDS =
  'id, name_zh, name_it, name_en, tagline_zh, tagline_it, tagline_en, ' +
  'category, external_url, logo_url, tech_stack, sort_order'

// All published projects, in the order set from the admin panel.
export async function getPublishedProjects() {
  const { data, error } = await supabase
    .from('ct_projects')
    .select(CARD_FIELDS)
    .eq('is_published', true)
    .order('sort_order', { ascending: true })
  if (error) throw error
  return data ?? []
}

// One project by id (detail page). RLS still requires it to be published.
// Joins the optional mascot variant so the chat widget can use it as Claudio's
// avatar without an extra round-trip.
export async function getProjectById(id) {
  const { data, error } = await supabase
    .from('ct_projects')
    .select('*, mascot_variant:ct_ip_variants(image_url, scene)')
    .eq('id', id)
    .single()
  if (error) throw error
  return data
}
