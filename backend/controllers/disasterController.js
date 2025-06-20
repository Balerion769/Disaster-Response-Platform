import { supabase } from '../config/supabaseClient.js';
import { logAction } from '../utils/logger.js';
import { extractLocationFromText } from '../services/geminiService.js';
import { getCoordinatesForLocation } from '../services/mappingService.js';

export const createDisaster = async (req, res) => {
  const { title, description, tags, location_name } = req.body;
  const user = req.user;

  if (!title || !description) {
    return res.status(400).json({ error: 'Title and description are required.' });
  }
  
  // 1. Determine location: use provided name or extract from description
  const locationNameToGeocode = location_name || await extractLocationFromText(description);
  
  if (!locationNameToGeocode) {
      return res.status(400).json({ error: 'Could not determine a location from the provided information.' });
  }

  // 2. Geocode to get lat/lng
  const coordinates = await getCoordinatesForLocation(locationNameToGeocode);
  if (!coordinates) {
      return res.status(400).json({ error: `Could not find coordinates for location: ${locationNameToGeocode}` });
  }

  const location = `POINT(${coordinates.lon} ${coordinates.lat})`;
  
  // 3. Create disaster record
  const newDisaster = {
    title,
    description,
    tags: tags ? tags.split(',').map(t => t.trim()) : [],
    owner_id: user.id,
    location_name: locationNameToGeocode,
    location,
    audit_trail: [{ action: 'create', user_id: user.id, timestamp: new Date().toISOString() }],
  };

  const { data, error } = await supabase
    .from('disasters')
    .insert(newDisaster)
    .select()
    .single();

  if (error) {
    logAction('DISASTER_CREATE_ERROR', { error: error.message });
    return res.status(500).json({ error: error.message });
  }

  logAction('DISASTER_CREATED', { id: data.id, title: data.title, owner: user.id });
  req.io.emit('disaster_updated', { action: 'create', disaster: data });
  res.status(201).json(data);
};

export const getDisasters = async (req, res) => {
  const { tag } = req.query;
  let query = supabase.from('disasters').select('*').order('created_at', { ascending: false });

  if (tag) {
    query = query.contains('tags', [tag]);
  }

  const { data, error } = await query;

  if (error) {
    return res.status(500).json({ error: error.message });
  }
  res.status(200).json(data);
};

export const updateDisaster = async (req, res) => {
    const { id } = req.params;
    const { title, description, tags } = req.body;
    const user = req.user;

    // Fetch existing to check ownership and get audit trail
    const { data: existing, error: fetchError } = await supabase.from('disasters').select('owner_id, audit_trail').eq('id', id).single();
    if (fetchError) return res.status(404).json({ error: 'Disaster not found' });

    if (user.role !== 'admin' && existing.owner_id !== user.id) {
        return res.status(403).json({ error: 'Forbidden: You can only update your own disasters.' });
    }

    const updatedFields = { title, description, tags: tags ? tags.split(',').map(t => t.trim()) : [] };
    const newAuditTrail = [...(existing.audit_trail || []), { action: 'update', user_id: user.id, timestamp: new Date().toISOString() }];

    const { data, error } = await supabase.from('disasters').update({ ...updatedFields, audit_trail: newAuditTrail }).eq('id', id).select().single();
    
    if (error) return res.status(500).json({ error: error.message });

    logAction('DISASTER_UPDATED', { id: data.id, user: user.id });
    req.io.emit('disaster_updated', { action: 'update', disaster: data });
    res.status(200).json(data);
};

export const deleteDisaster = async (req, res) => {
    const { id } = req.params;
    const user = req.user;

    const { data: existing, error: fetchError } = await supabase.from('disasters').select('owner_id').eq('id', id).single();
    if (fetchError) return res.status(404).json({ error: 'Disaster not found' });

    if (user.role !== 'admin' && existing.owner_id !== user.id) {
        return res.status(403).json({ error: 'Forbidden: You can only delete your own disasters.' });
    }

    const { error } = await supabase.from('disasters').delete().eq('id', id);

    if (error) return res.status(500).json({ error: error.message });
    
    logAction('DISASTER_DELETED', { id, user: user.id });
    req.io.emit('disaster_updated', { action: 'delete', disasterId: id });
    res.status(204).send();
};