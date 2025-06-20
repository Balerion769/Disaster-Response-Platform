// const API_URL = 'http://localhost:3001/api';
https://disaster-response-platform-6p4e.onrender.com
const socket = io('http://localhost:3001');

// --- DOM Elements ---
const userSelector = document.getElementById('user');
const disasterForm = document.getElementById('disaster-form');
const disastersList = document.getElementById('disasters-list');
const detailsTitle = document.getElementById('details-title');
const officialUpdatesList = document.getElementById('official-updates');
const socialMediaFeed = document.getElementById('social-media-feed');
const resourcesList = document.getElementById('resources-list');
const reportForm = document.getElementById('report-form');
const clearFormBtn = document.getElementById('clear-form-btn');


// --- State ---
let currentUser = userSelector.value;
let selectedDisasterId = null;
let disastersData = {};

// --- API Helpers ---
const getHeaders = () => ({
    'Content-Type': 'application/json',
    'x-user-id': currentUser,
});

async function apiRequest(endpoint, method = 'GET', body = null) {
    try {
        const options = {
            method,
            headers: getHeaders(),
        };
        if (body) {
            options.body = JSON.stringify(body);
        }
        const response = await fetch(`${API_URL}${endpoint}`, options);
        if (!response.ok) {
            const errData = await response.json();
            throw new Error(errData.error || 'API request failed');
        }
        return response.status === 204 ? null : response.json();
    } catch (error) {
        alert(`Error: ${error.message}`);
        console.error('API Error:', error);
        return null;
    }
}

// --- Render Functions ---
function renderDisasters() {
    disastersList.innerHTML = '';
    const sortedDisasters = Object.values(disastersData).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    if (sortedDisasters.length === 0) {
        disastersList.innerHTML = '<p>No disasters reported yet.</p>';
        return;
    }

    sortedDisasters.forEach(disaster => {
        const card = document.createElement('div');
        card.className = 'card';
        card.classList.toggle('selected', disaster.id === selectedDisasterId);
        card.dataset.id = disaster.id;

        const tagsHtml = disaster.tags.map(tag => `<span class="card-tag">${tag}</span>`).join(' ');

        card.innerHTML = `
            <h4 class="card-title">${disaster.title}</h4>
            <div class="card-content">
                <strong>Location:</strong> ${disaster.location_name}<br>
                <small>${disaster.description}</small>
            </div>
            <div>${tagsHtml}</div>
            <div class="card-controls">
                <button class="control-btn edit-btn" data-id="${disaster.id}">Edit</button>
                <button class="control-btn delete-btn" data-id="${disaster.id}">Delete</button>
            </div>
        `;

        card.addEventListener('click', () => {
            selectDisaster(disaster.id);
        });

        disastersList.appendChild(card);
    });
}

function renderDetails(listElement, items, renderFunc) {
    listElement.innerHTML = '';
    if (!items || items.length === 0) {
        listElement.innerHTML = '<p>No data available.</p>';
        return;
    }
    items.forEach(item => {
        listElement.appendChild(renderFunc(item));
    });
}


// --- Event Handlers & Logic ---
async function loadInitialData() {
    const disasters = await apiRequest('/disasters');
    if (disasters) {
        disasters.forEach(d => disastersData[d.id] = d);
        renderDisasters();
    }
    loadOfficialUpdates();
}

async function loadOfficialUpdates() {
    const updates = await apiRequest('/official-updates');
    renderDetails(officialUpdatesList, updates, item => {
        const card = document.createElement('div');
        card.className = 'card';
        card.innerHTML = `<h5 class="card-title"><a href="${item.link}" target="_blank">${item.title}</a></h5><p class="card-content">${item.summary}</p>`;
        return card;
    });
}

async function selectDisaster(id) {
    if (selectedDisasterId === id) return;
    
    selectedDisasterId = id;
    renderDisasters();

    const disaster = disastersData[id];
    if (!disaster) return;

    detailsTitle.textContent = disaster.title;

    // Load social media
    const socialPosts = await apiRequest(`/disasters/${id}/social-media`);
    renderDetails(socialMediaFeed, socialPosts, item => {
        const card = document.createElement('div');
        card.className = 'card';
        card.innerHTML = `<p class="card-content"><strong>@${item.user}:</strong> ${item.post}</p>`;
        return card;
    });
    
    // Load nearby resources
    // The disaster location format is "POINT(-73.9861 40.7183)"
    const coordsMatch = disaster.location.match(/POINT\(([-\d.]+) ([-\d.]+)\)/);
    if(coordsMatch) {
        const [_, lon, lat] = coordsMatch;
        const resources = await apiRequest(`/resources?lat=${lat}&lon=${lon}`);
        renderDetails(resourcesList, resources, item => {
            const card = document.createElement('div');
            card.className = 'card';
            card.innerHTML = `<h5 class="card-title">${item.name} (${item.type})</h5><p class="card-content">${item.location_name}</p>`;
            return card;
        });
    } else {
        resourcesList.innerHTML = '<p>Location data is invalid for this disaster.</p>'
    }
}

function clearDisasterForm() {
    disasterForm.reset();
    document.getElementById('disaster-id').value = '';
}

disasterForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('disaster-id').value;
    const body = {
        title: document.getElementById('title').value,
        description: document.getElementById('description').value,
        location_name: document.getElementById('location').value,
        tags: document.getElementById('tags').value,
    };

    if (id) {
        // Update
        await apiRequest(`/disasters/${id}`, 'PUT', body);
    } else {
        // Create
        await apiRequest('/disasters', 'POST', body);
    }
    clearDisasterForm();
});

reportForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!selectedDisasterId) {
        alert('Please select a disaster first.');
        return;
    }
    const body = {
        disaster_id: selectedDisasterId,
        content: document.getElementById('report-content').value,
        image_url: document.getElementById('report-image-url').value,
    };
    
    const newReport = await apiRequest('/reports', 'POST', body);
    if (newReport) {
        alert('Report submitted successfully!');
        reportForm.reset();
        // Here, an admin could trigger verification
        if (currentUser === 'reliefAdmin' && newReport.image_url) {
            console.log('Admin detected. Triggering image verification...');
            const verification = await apiRequest('/verify-image', 'POST', {
                reportId: newReport.id,
                imageUrl: newReport.image_url,
            });
            alert(`Image verification result: ${verification.status}. Analysis: ${verification.analysis}`);
        }
    }
});

disastersList.addEventListener('click', (e) => {
    if (e.target.classList.contains('edit-btn')) {
        const id = e.target.dataset.id;
        const disaster = disastersData[id];
        if (disaster) {
            document.getElementById('disaster-id').value = disaster.id;
            document.getElementById('title').value = disaster.title;
            document.getElementById('description').value = disaster.description;
            document.getElementById('location').value = disaster.location_name;
            document.getElementById('tags').value = disaster.tags.join(', ');
        }
    } else if (e.target.classList.contains('delete-btn')) {
        const id = e.target.dataset.id;
        if (confirm('Are you sure you want to delete this disaster? This can only be done by an admin.')) {
            apiRequest(`/disasters/${id}`, 'DELETE');
        }
    }
});

userSelector.addEventListener('change', (e) => {
    currentUser = e.target.value;
    console.log(`Switched user to: ${currentUser}`);
});

clearFormBtn.addEventListener('click', clearDisasterForm);


// --- WebSocket Listeners ---
socket.on('connect', () => {
    console.log('Connected to WebSocket server!', socket.id);
});

socket.on('disaster_updated', ({ action, disaster, disasterId }) => {
    console.log('Socket event: disaster_updated', { action, disaster, disasterId });
    if (action === 'create' || action === 'update') {
        disastersData[disaster.id] = disaster;
    } else if (action === 'delete') {
        delete disastersData[disasterId];
        if (selectedDisasterId === disasterId) {
            selectedDisasterId = null;
            detailsTitle.textContent = 'Select a disaster to see details';
            socialMediaFeed.innerHTML = '';
            resourcesList.innerHTML = '';
        }
    }
    renderDisasters();
});

socket.on('social_media_updated', ({ disasterId, posts }) => {
    if (disasterId === selectedDisasterId) {
        console.log('Socket event: social_media_updated for current disaster');
        renderDetails(socialMediaFeed, posts, item => {
            const card = document.createElement('div');
            card.className = 'card';
            card.innerHTML = `<p class="card-content"><strong>@${item.user}:</strong> ${item.post}</p>`;
            return card;
        });
    }
});

socket.on('resources_updated', ({ resources }) => {
    console.log('Socket event: resources_updated');
     renderDetails(resourcesList, resources, item => {
        const card = document.createElement('div');
        card.className = 'card';
        card.innerHTML = `<h5 class="card-title">${item.name} (${item.type})</h5><p class="card-content">${item.location_name}</p>`;
        return card;
    });
});


// --- Initial Load ---
document.addEventListener('DOMContentLoaded', loadInitialData);