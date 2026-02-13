// Dark Mode Toggle in Settings
const darkModeToggle = document.getElementById('dark-mode-toggle');
const body = document.body;

// Check for saved theme preference or default to light mode
const currentTheme = localStorage.getItem('theme') || 'light';
if (currentTheme === 'dark') {
    body.classList.add('dark-mode');
    darkModeToggle.classList.add('active');
}

// Seek by clicking/dragging
let isSeeking = false;
const progressBar = document.querySelector('.progress-bar');
function seekFromEvent(e) {
    const rect = progressBar.getBoundingClientRect();
    const clientX = e.clientX !== undefined ? e.clientX : (e.touches && e.touches[0] && e.touches[0].clientX);
    const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
    const percent = x / rect.width;
    if (audioPlayer.duration) {
        audioPlayer.currentTime = percent * audioPlayer.duration;
    }
}

progressBar.addEventListener('mousedown', (e) => { isSeeking = true; seekFromEvent(e); });
window.addEventListener('mousemove', (e) => { if (isSeeking) seekFromEvent(e); });
window.addEventListener('mouseup', (e) => { if (isSeeking) { seekFromEvent(e); isSeeking = false; } });
// Touch support
progressBar.addEventListener('touchstart', (e) => { isSeeking = true; seekFromEvent(e); });
window.addEventListener('touchmove', (e) => { if (isSeeking) seekFromEvent(e); });
window.addEventListener('touchend', (e) => { if (isSeeking) { seekFromEvent(e); isSeeking = false; } });
darkModeToggle.addEventListener('click', () => {
    body.classList.toggle('dark-mode');
    darkModeToggle.classList.toggle('active');
    
    if (body.classList.contains('dark-mode')) {
        localStorage.setItem('theme', 'dark');
    } else {
        localStorage.setItem('theme', 'light');
    }
});

// Home category switching
const categoryTabs = document.querySelectorAll('.category-tab');
const categoryContents = document.querySelectorAll('.category-content');

categoryTabs.forEach(tab => {
    tab.addEventListener('click', () => {
        const category = tab.dataset.category;
        
        // Update active tab
        categoryTabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        
        // Update active content
        categoryContents.forEach(c => c.classList.remove('active'));
        document.getElementById(category + '-content').classList.add('active');
    });
});

// Song library management
let songLibrary = [];
let currentSongIndex = -1;
let audioPlayer = null;
let playlists = [];
let selectionMode = false;
let selectedSongs = new Set();
let mainFavoriteBtn = null;
let editingPlaylistId = null;
let currentOpenPlaylistId = null;

// Initialize favorite button reference after DOM loads
document.addEventListener('DOMContentLoaded', () => {
    mainFavoriteBtn = document.getElementById('favorite-btn');
});

// Initialize audio player
function initAudioPlayer() {
    if (!audioPlayer) {
        audioPlayer = new Audio();
        audioPlayer.volume = 0.7;
        
        // Progress tracking
        audioPlayer.addEventListener('timeupdate', () => {
            if (audioPlayer.duration) {
                const progress = (audioPlayer.currentTime / audioPlayer.duration) * 100;
                progressFill.style.width = progress + '%';
                
                const currentMinutes = Math.floor(audioPlayer.currentTime / 60);
                const currentSeconds = Math.floor(audioPlayer.currentTime % 60);
                document.querySelector('.progress-time span:first-child').textContent = 
                    `${currentMinutes}:${currentSeconds.toString().padStart(2, '0')}`;
            }
        });

        audioPlayer.addEventListener('loadedmetadata', () => {
            const minutes = Math.floor(audioPlayer.duration / 60);
            const seconds = Math.floor(audioPlayer.duration % 60);
            document.querySelector('.progress-time span:last-child').textContent = 
                `${minutes}:${seconds.toString().padStart(2, '0')}`;
        });

        // Auto-play next song when current ends
        audioPlayer.addEventListener('ended', () => {
            if (document.getElementById('loop-btn').classList.contains('active')) {
                audioPlayer.currentTime = 0;
                audioPlayer.play();
            } else if (currentSongIndex < songLibrary.length - 1) {
                playSong(currentSongIndex + 1);
            } else {
                isPlaying = false;
                playPauseBtn.innerHTML = '<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>';
                playPauseBtn.classList.remove('active');
                albumCover.classList.add('paused');
                cassettePlayer.classList.add('paused');
            }
        });
        
        console.log('Audio player initialized');
    }
}

// Import songs functionality (from Home)
const homeAddSongBtn = document.getElementById('home-add-song-btn');
const homeFileInput = document.getElementById('home-file-input');
const songList = document.getElementById('song-list'); // Keep reference for compatibility
const emptyState = document.getElementById('empty-state'); // Keep reference for compatibility

homeAddSongBtn.addEventListener('click', () => {
    homeFileInput.click();
});

homeFileInput.addEventListener('change', (e) => {
    const files = Array.from(e.target.files);
    console.log('Files selected:', files.length);
    
    files.forEach((file, idx) => {
        console.log(`File ${idx + 1}:`, file.name, file.type, file.size);
        
        const song = {
            file: file,
            name: file.name.replace(/\.[^/.]+$/, ""),
            duration: '--:--',
            url: URL.createObjectURL(file),
            favorite: false,
            albumCover: null // Will store base64 image
        };
        
        songLibrary.push(song);
        
        // Try to get duration
        const tempAudio = new Audio();
        tempAudio.addEventListener('loadedmetadata', function() {
            if (tempAudio.duration && isFinite(tempAudio.duration)) {
                const minutes = Math.floor(tempAudio.duration / 60);
                const seconds = Math.floor(tempAudio.duration % 60);
                song.duration = `${minutes}:${seconds.toString().padStart(2, '0')}`;
                console.log(`Duration loaded for ${song.name}:`, song.duration);
                updateHomeSongsList();
            }
        });
        tempAudio.src = song.url;
    });
    
    console.log('Total songs in library:', songLibrary.length);
    updateHomeSongsList();
    homeFileInput.value = '';
});

function updateHomeSongsList() {
    const homeSongList = document.getElementById('home-song-list');
    const homeEmptyState = document.getElementById('home-empty-state');
    const editBtn = document.getElementById('edit-songs-btn');
    
    if (songLibrary.length > 0) {
        homeEmptyState.style.display = 'none';
        editBtn.style.display = 'flex';
    } else {
        homeEmptyState.style.display = 'block';
        editBtn.style.display = 'none';
        return;
    }

    // Clear the list but keep the empty state element
    const items = homeSongList.querySelectorAll('.song-item');
    items.forEach(item => item.remove());
    
    songLibrary.forEach((song, index) => {
        const songItem = document.createElement('div');
        songItem.className = 'song-item';
        if (index === currentSongIndex && isPlaying) {
            songItem.classList.add('playing');
        }
        
        songItem.innerHTML = `
            <div class="song-checkbox ${selectedSongs.has(index) ? 'checked' : ''}" data-index="${index}">
                <svg viewBox="0 0 24 24">
                    <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
                </svg>
            </div>
            <div class="song-thumbnail" data-index="${index}" title="Click to change cover">
                ${song.albumCover ? `<img src="${song.albumCover}" alt="Album cover">` : ''}
            </div>
            <div class="song-details">
                <div class="song-item-title">${song.name}</div>
                <div class="song-item-artist">Imported Song</div>
            </div>
            <div class="song-duration">${song.duration}</div>
            <button class="add-to-playlist-btn" data-index="${index}" title="Add to Playlist" style="background:transparent; border:none; cursor:pointer;">
                <svg viewBox="0 0 24 24" width="18" height="18"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>
            </button>
            <button class="favorite-btn ${song.favorite ? 'active' : ''}" data-index="${index}">
                <svg viewBox="0 0 24 24">
                    <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
                </svg>
            </button>
        `;
        
        // Thumbnail click to change cover
        const thumbnail = songItem.querySelector('.song-thumbnail');
        thumbnail.addEventListener('click', (e) => {
            e.stopPropagation();
            if (!selectionMode) {
                changeSongCover(index);
            }
        });
        
        // Checkbox click
        const checkbox = songItem.querySelector('.song-checkbox');
        checkbox.addEventListener('click', (e) => {
            e.stopPropagation();
            if (selectionMode) {
                toggleSongSelection(index);
            }
        });
        
        // Song click
        songItem.addEventListener('click', (e) => {
            if (!e.target.closest('.favorite-btn') && !e.target.closest('.song-checkbox')) {
                if (!selectionMode) {
                    console.log('Song clicked from Home:', song.name);
                    playSong(index);
                }
            }
        });
        
        homeSongList.appendChild(songItem);

        // Add to playlist handler
        const addToBtn = songItem.querySelector('.add-to-playlist-btn');
        if (addToBtn) {
            addToBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (playlists.length === 0) {
                    if (confirm('No playlists yet. Create one now?')) {
                        document.getElementById('create-playlist-btn').click();
                    }
                    return;
                }
                const choices = playlists.map((p, i) => `${i+1}: ${p.name} (${p.songs.length})`).join('\n');
                const input = prompt('Enter playlist numbers to add this song to (comma separated):\n' + choices);
                if (!input) return;
                input.split(',').map(s => parseInt(s.trim(), 10) - 1).filter(i => i >= 0 && i < playlists.length).forEach(pi => {
                    const pl = playlists[pi];
                    if (pl && !pl.songs.includes(index)) pl.songs.push(index);
                });
                updatePlaylistList();
            });
        }
    });

    // Add favorite button handlers for home list
    document.querySelectorAll('#home-song-list .favorite-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const index = parseInt(btn.dataset.index);
            songLibrary[index].favorite = !songLibrary[index].favorite;
            btn.classList.toggle('active');
            
            // Update Now Playing favorite button if this is the current song
            if (index === currentSongIndex && mainFavoriteBtn) {
                if (songLibrary[index].favorite) {
                    mainFavoriteBtn.classList.add('active');
                } else {
                    mainFavoriteBtn.classList.remove('active');
                }
            }
        });
    });
    
    // Update selection mode styling
    if (selectionMode) {
        homeSongList.classList.add('selection-mode');
    } else {
        homeSongList.classList.remove('selection-mode');
    }
}

// Album cover management
let currentCoverInput = null;

function changeSongCover(songIndex) {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
                songLibrary[songIndex].albumCover = event.target.result;
                updateHomeSongsList();
                // Update Now Playing if this is the current song
                if (songIndex === currentSongIndex) {
                    updateAlbumCoverDisplay();
                }
            };
            reader.readAsDataURL(file);
        }
    };
    input.click();
}

function updateAlbumCoverDisplay() {
    const albumCoverDisplay = document.getElementById('album-cover-display');
    const currentSong = songLibrary[currentSongIndex];
    const vinylRecord = albumCoverDisplay.querySelector('.vinyl-record');
    
    // Remove existing image if any
    const existingImg = albumCoverDisplay.querySelector('img');
    if (existingImg) {
        existingImg.remove();
    }
    
    // Add new image if song has album cover
    if (currentSong && currentSong.albumCover) {
        const img = document.createElement('img');
        img.src = currentSong.albumCover;
        img.style.width = '100%';
        img.style.height = '100%';
        img.style.objectFit = 'cover';
        img.style.position = 'absolute';
        img.style.top = '0';
        img.style.left = '0';
        img.style.borderRadius = '12px';
        img.style.zIndex = '1';
        albumCoverDisplay.insertBefore(img, albumCoverDisplay.firstChild);
        
        // Hide vinyl when album cover is present
        if (vinylRecord) {
            vinylRecord.style.display = 'none';
        }
    } else {
        // Show vinyl when no album cover
        if (vinylRecord) {
            vinylRecord.style.display = 'block';
        }
    }
}

// Click on Now Playing album cover to change
document.getElementById('album-cover-display').addEventListener('click', () => {
    if (currentSongIndex >= 0 && songLibrary[currentSongIndex]) {
        changeSongCover(currentSongIndex);
    }
});

// Selection Mode Functions
function toggleSelectionMode() {
    selectionMode = !selectionMode;
    selectedSongs.clear();
    document.getElementById('selection-header').classList.toggle('active', selectionMode);
    updateSelectedCount();
    updateHomeSongsList();
}

function toggleSongSelection(index) {
    if (selectedSongs.has(index)) {
        selectedSongs.delete(index);
    } else {
        selectedSongs.add(index);
    }
    updateSelectedCount();
    updateHomeSongsList();
}

function updateSelectedCount() {
    document.getElementById('selected-count').textContent = selectedSongs.size;
}

function selectAllSongs() {
    songLibrary.forEach((_, index) => selectedSongs.add(index));
    updateSelectedCount();
    updateHomeSongsList();
}

function deleteSelectedSongs() {
    if (selectedSongs.size === 0) return;
    
    if (confirm(`Delete ${selectedSongs.size} song(s)?`)) {
        // Sort indices in descending order to remove from end first
        const indicesToRemove = Array.from(selectedSongs).sort((a, b) => b - a);
        
        indicesToRemove.forEach(index => {
            URL.revokeObjectURL(songLibrary[index].url);
            songLibrary.splice(index, 1);
        });
        
        // Reset current song if it was deleted
        if (selectedSongs.has(currentSongIndex)) {
            currentSongIndex = -1;
            if (audioPlayer) {
                audioPlayer.pause();
                audioPlayer.src = '';
            }
            isPlaying = false;
        }
        
        selectedSongs.clear();
        toggleSelectionMode();
        updateHomeSongsList();
    }
}

// Edit button
document.getElementById('edit-songs-btn').addEventListener('click', toggleSelectionMode);
document.getElementById('cancel-selection-btn').addEventListener('click', toggleSelectionMode);
document.getElementById('select-all-btn').addEventListener('click', selectAllSongs);
document.getElementById('delete-selected-btn').addEventListener('click', deleteSelectedSongs);

// Playlist Functions
const createPlaylistModal = document.getElementById('create-playlist-modal');
const playlistNameInput = document.getElementById('playlist-name-input');
const songSelectionList = document.getElementById('song-selection-list');
let selectedPlaylistSongs = new Set();

document.getElementById('create-playlist-btn').addEventListener('click', () => {
    // creating a new playlist (not editing an existing one)
    editingPlaylistId = null;
    selectedPlaylistSongs.clear();
    playlistNameInput.value = '';
    updateSongSelectionList();
    createPlaylistModal.classList.add('active');
});

document.getElementById('cancel-playlist-btn').addEventListener('click', () => {
    createPlaylistModal.classList.remove('active');
});

document.getElementById('save-playlist-btn').addEventListener('click', () => {
    const name = playlistNameInput.value.trim();
    if (!name) {
        alert('Please enter a playlist name');
        return;
    }

    if (editingPlaylistId) {
        const p = playlists.find(pl => pl.id === editingPlaylistId);
        if (p) {
            p.name = name;
            p.songs = Array.from(selectedPlaylistSongs);
        }
    } else {
        const playlist = {
            id: Date.now(),
            name: name,
            songs: Array.from(selectedPlaylistSongs)
        };
        playlists.push(playlist);
    }

    editingPlaylistId = null;
    createPlaylistModal.classList.remove('active');
    updatePlaylistList();
    // if a playlist detail is open, refresh it
    if (currentOpenPlaylistId) {
        const open = playlists.find(pl => pl.id === currentOpenPlaylistId);
        if (open) openPlaylist(open);
    }
});

function updateSongSelectionList() {
    songSelectionList.innerHTML = '';
    
    if (songLibrary.length === 0) {
        songSelectionList.innerHTML = '<div style="text-align: center; color: var(--cyan-medium); padding: 20px;">No songs available</div>';
        return;
    }
    
    songLibrary.forEach((song, index) => {
        const item = document.createElement('div');
        item.className = 'song-select-item';
        item.innerHTML = `
            <div class="song-select-checkbox ${selectedPlaylistSongs.has(index) ? 'checked' : ''}"></div>
            <div class="song-select-name">${song.name}</div>
        `;
        
        item.addEventListener('click', () => {
            if (selectedPlaylistSongs.has(index)) {
                selectedPlaylistSongs.delete(index);
            } else {
                selectedPlaylistSongs.add(index);
            }
            updateSongSelectionList();
        });
        
        songSelectionList.appendChild(item);
    });
}

function updatePlaylistList() {
    const playlistList = document.getElementById('playlist-list');
    playlistList.innerHTML = '';
    
    playlists.forEach(playlist => {
        const item = document.createElement('div');
        item.className = 'playlist-item';
        item.innerHTML = `
            <div style="display:flex; align-items:center; justify-content:space-between; gap:12px;">
                <div>
                    <div class="playlist-item-name">${playlist.name}</div>
                    <div class="playlist-item-count">${playlist.songs.length} songs</div>
                </div>
                <div style="display:flex; gap:8px; align-items:center;">
                    <button class="add-btn open-playlist-btn" data-id="${playlist.id}" title="Open">
                        <svg viewBox="0 0 24 24"><path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/></svg>
                    </button>
                    <button class="add-btn delete-playlist-list-btn" data-id="${playlist.id}" title="Delete" style="background:#d90429;">
                        <svg viewBox="0 0 24 24"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
                    </button>
                </div>
            </div>
        `;

        // open when clicking main area
        item.addEventListener('click', (e) => {
            // if user clicked the delete or open button, those handlers will handle it
            const btn = e.target.closest('.delete-playlist-list-btn');
            if (btn) return;
            const openBtn = e.target.closest('.open-playlist-btn');
            if (openBtn) return;
            openPlaylist(playlist);
        });

        // open button
        item.querySelector('.open-playlist-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            openPlaylist(playlist);
        });

        // delete button
        item.querySelector('.delete-playlist-list-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            if (confirm(`Delete playlist "${playlist.name}"?`)) {
                playlists = playlists.filter(p => p.id !== playlist.id);
                if (currentOpenPlaylistId === playlist.id) {
                    document.getElementById('playlists-main-view').style.display = 'block';
                    document.getElementById('playlist-detail-view').style.display = 'none';
                    currentOpenPlaylistId = null;
                }
                updatePlaylistList();
            }
        });

        playlistList.appendChild(item);
    });
}

function openPlaylist(playlist) {
    document.getElementById('playlists-main-view').style.display = 'none';
    document.getElementById('playlist-detail-view').style.display = 'block';
    document.getElementById('playlist-detail-title').textContent = playlist.name;
    currentOpenPlaylistId = playlist.id;
    
    const playlistSongsList = document.getElementById('playlist-songs-list');
    playlistSongsList.innerHTML = '';
    
    playlist.songs.forEach(songIndex => {
        const song = songLibrary[songIndex];
        if (!song) return; // Skip if song was deleted
        
        const songItem = document.createElement('div');
        songItem.className = 'song-item';
        if (songIndex === currentSongIndex && isPlaying) {
            songItem.classList.add('playing');
        }
        
        songItem.innerHTML = `
            <div class="song-thumbnail">
                ${song.albumCover ? `<img src="${song.albumCover}" alt="Album cover">` : ''}
            </div>
            <div class="song-details">
                <div class="song-item-title">${song.name}</div>
                <div class="song-item-artist">Imported Song</div>
            </div>
            <div class="song-duration">${song.duration}</div>
            <div style="display:flex; gap:8px; align-items:center;">
                <button class="remove-from-playlist-btn" data-song="${songIndex}" title="Remove" style="background:transparent; border:none; cursor:pointer;">
                    <svg viewBox="0 0 24 24" width="18" height="18"><path d="M19 7L17.59 5.59 12 11.17 6.41 5.59 5 7l5.59 5.59L5 18.17 6.41 19.59 12 14l5.59 5.59L19 18.17l-5.59-5.59L19 7z"/></svg>
                </button>
                <button class="favorite-btn ${song.favorite ? 'active' : ''}" data-index="${songIndex}">
                    <svg viewBox="0 0 24 24">
                        <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
                    </svg>
                </button>
            </div>
        `;
        
        songItem.addEventListener('click', (e) => {
            if (!e.target.closest('.favorite-btn')) {
                playSong(songIndex);
            }
        });
        
        playlistSongsList.appendChild(songItem);
    });
    
    // Add favorite button handlers
    document.querySelectorAll('#playlist-songs-list .favorite-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const index = parseInt(btn.dataset.index);
            songLibrary[index].favorite = !songLibrary[index].favorite;
            btn.classList.toggle('active');
            
            if (index === currentSongIndex && mainFavoriteBtn) {
                if (songLibrary[index].favorite) {
                    mainFavoriteBtn.classList.add('active');
                } else {
                    mainFavoriteBtn.classList.remove('active');
                }
            }
            
            updateHomeSongsList();
        });
    });

    // hook remove-from-playlist buttons
    document.querySelectorAll('#playlist-songs-list .remove-from-playlist-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const songIndex = parseInt(btn.dataset.song);
            const pl = playlists.find(p => p.id === playlist.id);
            if (!pl) return;
            const idx = pl.songs.indexOf(songIndex);
            if (idx > -1) pl.songs.splice(idx, 1);
            updatePlaylistList();
            openPlaylist(pl);
        });
    });

    // hook add and delete playlist buttons
    const addBtn = document.getElementById('add-songs-to-playlist-btn');
    const deleteBtn = document.getElementById('delete-playlist-btn');
    if (addBtn) {
        addBtn.onclick = () => {
            editingPlaylistId = playlist.id;
            selectedPlaylistSongs = new Set(playlist.songs);
            playlistNameInput.value = playlist.name;
            updateSongSelectionList();
            createPlaylistModal.classList.add('active');
        };
    }
    if (deleteBtn) {
        deleteBtn.onclick = () => {
            if (confirm(`Delete playlist "${playlist.name}"?`)) {
                playlists = playlists.filter(p => p.id !== playlist.id);
                document.getElementById('playlists-main-view').style.display = 'block';
                document.getElementById('playlist-detail-view').style.display = 'none';
                currentOpenPlaylistId = null;
                updatePlaylistList();
            }
        };
    }
}

document.getElementById('back-to-playlists-btn').addEventListener('click', () => {
    document.getElementById('playlists-main-view').style.display = 'block';
    document.getElementById('playlist-detail-view').style.display = 'none';
});

/* updateHomeSongsList is defined earlier with full feature set */

function playSong(index) {
    console.log('playSong called with index:', index);
    initAudioPlayer();
    
    currentSongIndex = index;
    const song = songLibrary[index];
    console.log('Playing song:', song.name, 'URL:', song.url);
    
    audioPlayer.pause();
    audioPlayer.src = song.url;
    audioPlayer.load();
    
    audioPlayer.play().then(() => {
        console.log('Playback started successfully');
        console.log('Audio volume:', audioPlayer.volume);
        console.log('Audio muted:', audioPlayer.muted);
    }).catch(error => {
        console.error('Playback error:', error);
        alert('Error playing audio: ' + error.message);
    });
    
    document.querySelector('.song-title').textContent = song.name;
    document.querySelector('.song-artist').textContent = 'Imported Song';
    
    // Update album cover display
    updateAlbumCoverDisplay();
    
    isPlaying = true;
    playPauseBtn.innerHTML = '<svg viewBox="0 0 24 24"><path d="M6 4h4v16H6zm8 0h4v16h-4z"/></svg>';
    playPauseBtn.classList.add('active');
    albumCover.classList.remove('paused');
    albumCover.classList.add('playing');
    cassettePlayer.classList.remove('paused');
    cassettePlayer.classList.add('playing');
    
    if (song.favorite) {
        mainFavoriteBtn.classList.add('active');
    } else {
        mainFavoriteBtn.classList.remove('active');
    }
    
    navTabs.forEach(t => t.classList.remove('active'));
    views.forEach(v => v.classList.remove('active'));
    document.querySelector('[data-view="now-playing"]').classList.add('active');
    document.getElementById('now-playing').classList.add('active');
    
    updateHomeSongsList();
}

// Initialize
updateHomeSongsList();

// Navigation
const navTabs = document.querySelectorAll('.nav-tab');
const views = document.querySelectorAll('.view');

navTabs.forEach(tab => {
    tab.addEventListener('click', () => {
        const viewName = tab.dataset.view;
        
        navTabs.forEach(t => t.classList.remove('active'));
        views.forEach(v => v.classList.remove('active'));
        
        tab.classList.add('active');
        document.getElementById(viewName).classList.add('active');
    });
});

// Play/Pause functionality
const playPauseBtn = document.getElementById('play-pause-btn');
const albumCover = document.querySelector('.album-cover');
const cassettePlayer = document.querySelector('.cassette-player');
let isPlaying = false;

playPauseBtn.addEventListener('click', () => {
    console.log('Play/Pause clicked, isPlaying:', isPlaying, 'songLibrary length:', songLibrary.length);
    
    if (songLibrary.length === 0) {
        alert('Please import some songs first!');
        return;
    }

    if (!audioPlayer || !audioPlayer.src) {
        console.log('No audio loaded, playing first song');
        playSong(0);
        return;
    }

    isPlaying = !isPlaying;
    
    if (isPlaying) {
        audioPlayer.play().then(() => {
            console.log('Resumed playback');
        }).catch(err => {
            console.error('Resume error:', err);
        });
        playPauseBtn.innerHTML = '<svg viewBox="0 0 24 24"><path d="M6 4h4v16H6zm8 0h4v16h-4z"/></svg>';
        playPauseBtn.classList.add('active');
        albumCover.classList.remove('paused');
        albumCover.classList.add('playing');
        cassettePlayer.classList.remove('paused');
        cassettePlayer.classList.add('playing');
    } else {
        audioPlayer.pause();
        console.log('Paused playback');
        playPauseBtn.innerHTML = '<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>';
        playPauseBtn.classList.remove('active');
        albumCover.classList.add('paused');
        albumCover.classList.remove('playing');
        cassettePlayer.classList.add('paused');
        cassettePlayer.classList.remove('playing');
    }
});

// Loop button
const loopBtn = document.getElementById('loop-btn');
loopBtn.addEventListener('click', () => {
    loopBtn.classList.toggle('active');
});

// Shuffle button
const shuffleBtn = document.getElementById('shuffle-btn');
shuffleBtn.addEventListener('click', () => {
    shuffleBtn.classList.toggle('active');
});

// Next/Previous buttons
document.getElementById('next-btn').addEventListener('click', () => {
    console.log('Next button clicked');
    if (songLibrary.length === 0) return;
    
    if (shuffleBtn.classList.contains('active')) {
        const randomIndex = Math.floor(Math.random() * songLibrary.length);
        playSong(randomIndex);
    } else {
        const nextIndex = currentSongIndex >= 0 ? (currentSongIndex + 1) % songLibrary.length : 0;
        playSong(nextIndex);
    }
});

document.getElementById('prev-btn').addEventListener('click', () => {
    console.log('Previous button clicked');
    if (songLibrary.length === 0) return;
    
    if (shuffleBtn.classList.contains('active')) {
        const randomIndex = Math.floor(Math.random() * songLibrary.length);
        playSong(randomIndex);
    } else {
        const prevIndex = currentSongIndex >= 0 ? (currentSongIndex === 0 ? songLibrary.length - 1 : currentSongIndex - 1) : 0;
        playSong(prevIndex);
    }
});

// Fast forward and rewind
document.getElementById('forward-btn').addEventListener('click', () => {
    if (audioPlayer && audioPlayer.src) {
        audioPlayer.currentTime = Math.min(audioPlayer.currentTime + 10, audioPlayer.duration);
        console.log('Fast forward to:', audioPlayer.currentTime);
    }
});

document.getElementById('rewind-btn').addEventListener('click', () => {
    if (audioPlayer && audioPlayer.src) {
        audioPlayer.currentTime = Math.max(audioPlayer.currentTime - 10, 0);
        console.log('Rewind to:', audioPlayer.currentTime);
    }
});

// Favorite button in player handler
setTimeout(() => {
    const favBtn = document.getElementById('favorite-btn');
    if (favBtn) {
        favBtn.addEventListener('click', () => {
            if (songLibrary.length > 0 && currentSongIndex >= 0 && songLibrary[currentSongIndex]) {
                songLibrary[currentSongIndex].favorite = !songLibrary[currentSongIndex].favorite;
                favBtn.classList.toggle('active');
                updateHomeSongsList();
            }
        });
    }
}, 100);

// Favorite buttons in library
const favoriteBtns = document.querySelectorAll('.favorite-btn');
favoriteBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
        e.stopPropagation();
        btn.classList.toggle('active');
    });
});

// Progress fill element reference
const progressFill = document.querySelector('.progress-fill');

// Volume control
const volumeSlider = document.getElementById('volume-slider');
const volumeLevel = document.getElementById('volume-level');
const volumeIcon = document.querySelector('.volume-icon');

volumeSlider.addEventListener('input', (e) => {
    const value = e.target.value;
    volumeLevel.textContent = value + '%';
    
    if (audioPlayer) {
        audioPlayer.volume = value / 100;
        console.log('Volume set to:', audioPlayer.volume);
    }
    
    // Update icon based on volume level
    if (value == 0) {
        volumeIcon.innerHTML = '<path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/>';
    } else if (value < 30) {
        volumeIcon.innerHTML = '<path d="M7 9v6h4l5 5V4l-5 5H7z"/>';
    } else if (value < 70) {
        volumeIcon.innerHTML = '<path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z"/>';
    } else {
        volumeIcon.innerHTML = '<path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>';
    }
});

console.log('Music player ready! Import some songs to get started.');
