import { supabase } from '../config/supabaseClient.js';
import { getFromCache, setInCache } from '../services/cacheService.js';
import { fetchFemaUpdates } from '../services/scrapperService.js';
import { verifyImageWithGemini } from '../services/geminiService.js';
import { logAction } from '../utils/logger.js';


export const getSocialMediaFeed = (req, res) => {
  // Mock API - in a real scenario, this would hit Twitter/Bluesky API
  const mockData = [
    { user: 'citizen1', post: '#floodrelief Need food in Lower East Side' },
    { user: 'helper22', post: 'We have blankets and water at the community center. #NYCHelp' },
    { user: 'sos_alert', post: 'URGENT: Family trapped on rooftop at 123 Flood St. #SOS' },
  ];
  
  logAction('SOCIAL_MEDIA_FETCHED', { disasterId: req.params.id });
  req.io.emit('social_media_updated', { disasterId: req.params.id, posts: mockData });
  res.status(200).json(mockData);
};

export const getOfficialUpdates = async (req, res) => {
  const cacheKey = 'official_updates_fema';
  const cachedData = await getFromCache(cacheKey);

  if (cachedData) {
    logAction('OFFICIAL_UPDATES_CACHE_HIT', { key: cacheKey });
    return res.status(200).json(cachedData);
  }

  logAction('OFFICIAL_UPDATES_CACHE_MISS', { key: cacheKey });
  const updates = await fetchFemaUpdates();
  
  if (updates.length > 0) {
    await setInCache(cacheKey, updates, 3600); // Cache for 1 hour
  }

  res.status(200).json(updates);
};

export const getNearbyResources = async (req, res) => {
    const { lat, lon } = req.query;
    if (!lat || !lon) {
        return res.status(400).json({ error: 'Latitude and longitude are required.' });
    }

    // Using the RPC function we created in Supabase
    const { data, error } = await supabase.rpc('find_resources_near', {
        lat: parseFloat(lat),
        lon: parseFloat(lon),
        radius_meters: 10000 // 10km radius
    });

    if (error) {
        logAction('RESOURCES_QUERY_ERROR', { error: error.message });
        return res.status(500).json({ error: error.message });
    }

    logAction('RESOURCES_FETCHED', { count: data.length });
    req.io.emit('resources_updated', { resources: data });
    res.status(200).json(data);
};


export const verifyImage = async (req, res) => {
    const { reportId, imageUrl } = req.body;
    if (!reportId || !imageUrl) {
        return res.status(400).json({ error: 'reportId and imageUrl are required.' });
    }

    const cacheKey = `verify_image_${reportId}`;
    const cachedData = await getFromCache(cacheKey);
    if (cachedData) {
        return res.json({ reportId, status: cachedData.status, analysis: cachedData.analysis });
    }

    const analysis = await verifyImageWithGemini(imageUrl);
    const status = analysis.toLowerCase().includes('authentic') ? 'verified' : (analysis.toLowerCase().includes('manipulated') ? 'fake' : 'inconclusive');

    // Update the report in the database
    const { error } = await supabase.from('reports').update({ verification_status: status }).eq('id', reportId);
    if (error) {
        logAction('IMAGE_VERIFY_DB_ERROR', { reportId, error: error.message });
        // Don't block response if DB update fails, but log it
    }

    const responseData = { reportId, status, analysis };
    await setInCache(cacheKey, responseData, 86400); // Cache for 24 hours

    logAction('IMAGE_VERIFIED', { reportId, status });
    res.status(200).json(responseData);
};

// This controller function is for creating reports, a prerequisite for verification
export const createReport = async (req, res) => {
    const { disaster_id, content, image_url } = req.body;
    const user = req.user;

    if (!disaster_id || !content) {
        return res.status(400).json({ error: 'disaster_id and content are required' });
    }

    const { data, error } = await supabase
        .from('reports')
        .insert({ disaster_id, content, image_url, user_id: user.id })
        .select()
        .single();
    
    if (error) {
        logAction('REPORT_CREATE_ERROR', { error: error.message });
        return res.status(500).json({ error: error.message });
    }

    logAction('REPORT_CREATED', { reportId: data.id, disasterId: data.disaster_id });
    res.status(201).json(data);
}