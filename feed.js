document.addEventListener('DOMContentLoaded', () => {
    console.log('Feed Script Loaded v2.1');
    // === AUTH CHECK ===
    const currentUser = JSON.parse(localStorage.getItem('currentUser'));
    if (!currentUser) {
        window.location.href = 'index.html';
        return;
    }

    // === UI INITIALIZATION ===
    updateProfileUI(currentUser);
    loadPosts();

    // === NAVIGATION LOGIC (SPA) ===
    const navItems = document.querySelectorAll('.nav-item[data-target]');
    const views = document.querySelectorAll('.view-section');

    function showView(viewId) {
        // Hide all views
        views.forEach(view => view.classList.add('hidden'));
        // Show target view
        const targetView = document.getElementById(viewId);
        if (targetView) targetView.classList.remove('hidden');

        // Logic for specific views
        if (viewId === 'profile-view') {
            loadProfileView();
        }
        if (viewId === 'messages-view') {
            loadMessagesView();
        }
        if (viewId === 'notifications-view') {
            loadNotificationsView();
        }
        if (viewId === 'reels-view') {
            loadReelsView();
        }
        if (viewId === 'explore-view') {
            loadExploreView('all');
        }

        // Update Nav Active State
        navItems.forEach(item => {
            const icon = item.querySelector('ion-icon');
            if (!icon) return; // Skip if no icon (e.g. profile img nav)

            if (item.getAttribute('data-target') === viewId) {
                const name = icon.getAttribute('name');
                if (name && name.slice(-8) === '-outline') {
                    icon.setAttribute('name', name.slice(0, -8));
                }
                item.classList.add('font-bold');
            } else {
                const name = icon.getAttribute('name');
                if (name && name.slice(-8) !== '-outline' && name !== 'home') icon.setAttribute('name', name + '-outline');
                if (name === 'home' && viewId !== 'home-view') icon.setAttribute('name', 'home-outline');

                item.classList.remove('font-bold');
            }
        });
    }
    // Expose globally
    window.showView = showView;

    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const target = item.getAttribute('data-target');
            if (target) showView(target);
        });
    });


    // === PROFILE VIEW LOGIC ===
    async function loadProfileView() {
        const username = currentUser.name.split(' ')[0].toLowerCase().replace(/\s/g, '_'); // Mock username logic
        console.log('Loading Profile for:', username);

        // Update Header
        document.getElementById('profile-header-username').textContent = username;
        document.getElementById('profile-header-name').textContent = currentUser.name;
        document.getElementById('profile-header-img').src = `https://ui-avatars.com/api/?name=${currentUser.name}&background=random`;

        // Get User Posts
        let allPosts = [];
        try {
            const res = await fetch('http://localhost:3000/api/posts?t=' + Date.now(), { cache: 'no-store' });
            if (res.ok) {
                allPosts = await res.json();
                localStorage.setItem('posts', JSON.stringify(allPosts)); // update backup
            } else {
                allPosts = JSON.parse(localStorage.getItem('posts') || '[]');
            }
        } catch(e) { 
            console.error('Backend offline... using localStorage', e);
            allPosts = JSON.parse(localStorage.getItem('posts') || '[]');
        }
        
        console.log('All Posts from Server:', allPosts);

        // We filter posts based on username (first name logic matching create post logic)
        // Note: In a real app we'd use IDs, but here we used 'username' in the post object
        const userPosts = allPosts.filter(p => p.username === username);
        console.log('Filtered User Posts:', userPosts);

        document.getElementById('profile-posts-count').textContent = userPosts.length;

        const grid = document.getElementById('profile-posts-grid');
        grid.innerHTML = '';

        if (userPosts.length === 0) {
            grid.innerHTML = `
                <div class="col-span-3 text-center py-12">
                    <div class="w-16 h-16 border-2 border-black rounded-full flex items-center justify-center mx-auto mb-4">
                        <ion-icon name="camera-outline" class="text-3xl"></ion-icon>
                    </div>
                    <h1 class="text-2xl font-bold">No Posts Yet</h1>
                </div>
            `;
        } else {
            userPosts.forEach(post => {
                const img = document.createElement('img');
                img.src = post.postImage;
                img.className = 'aspect-square object-cover cursor-pointer hover:opacity-90 transition';
                
                img.addEventListener('click', () => {
                    openViewPostModal(post);
                });
                
                grid.appendChild(img);
            });
        }

    }


    // === CREATE POST LOGIC ===
    const createModal = document.getElementById('create-modal');
    const fileInput = document.getElementById('file-input');
    const imagePreview = document.getElementById('image-preview');
    const uploadArea = document.getElementById('upload-preview-area');
    const shareBtn = document.getElementById('share-btn');
    const captionInput = document.getElementById('caption-input');

    // Open/Close Modal
    document.getElementById('create-btn').addEventListener('click', (e) => { e.preventDefault(); openCreateModal(); });
    window.openCreateModal = () => createModal.classList.remove('hidden');
    window.closeCreateModal = () => {
        createModal.classList.add('hidden');
        resetCreateForm();
    };

    // File Preview
    fileInput.addEventListener('change', function () {
        const file = this.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = function (e) {
                imagePreview.src = e.target.result;
                imagePreview.classList.remove('hidden');
                uploadArea.querySelector('div').classList.add('hidden'); // Hide text
            }
            reader.readAsDataURL(file);
        }
    });

    // Share Post
    shareBtn.addEventListener('click', async () => {
        if (!imagePreview.src || imagePreview.classList.contains('hidden')) {
            alert('Please select an image first.');
            return;
        }

        const newPost = {
            id: Date.now(),
            username: currentUser.name.split(' ')[0].toLowerCase().replace(/\s/g, '_'),
            userImage: `https://ui-avatars.com/api/?name=${currentUser.name}&background=random`,
            postImage: imagePreview.src,
            likes: 0,
            caption: captionInput.value,
            time: 'JUST NOW'
        };

        // Save to Server with fallback
        try {
            await fetch('http://localhost:3000/api/posts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newPost)
            });
        } catch(e) { 
            console.error('Backend offline, falling back to localStorage', e); 
        }
        
        // Always save to localStorage as backup
        const localPosts = JSON.parse(localStorage.getItem('posts') || '[]');
        localPosts.unshift(newPost);
        localStorage.setItem('posts', JSON.stringify(localPosts));

        // Render immediately
        renderPost(newPost, true);

        // Switch to home and close modal
        window.closeCreateModal();
        showView('home-view');
    });

    function resetCreateForm() {
        fileInput.value = '';
        imagePreview.src = '';
        imagePreview.classList.add('hidden');
        uploadArea.querySelector('div').classList.remove('hidden');
        captionInput.value = '';
    }


    // === SEARCH LOGIC ===
    const searchModal = document.getElementById('search-modal');
    const searchInput = document.getElementById('search-input');
    const searchResults = document.getElementById('search-results');

    document.getElementById('search-btn').addEventListener('click', (e) => { e.preventDefault(); openSearchModal(); });
    window.openSearchModal = () => searchModal.classList.remove('hidden');
    window.closeSearchModal = () => searchModal.classList.add('hidden');

    searchInput.addEventListener('input', async (e) => {
        const query = e.target.value.toLowerCase();
        searchResults.innerHTML = ''; // Clear

        if (query.length < 1) return;

        let allUsers = [];
        try {
            const res = await fetch('http://localhost:3000/api/users');
            if(res.ok) allUsers = await res.json();
        } catch(e) { console.error(e); }

        const filtered = allUsers.filter(u =>
            u.name.toLowerCase().includes(query) ||
            u.email.toLowerCase().includes(query)
        );

        if (filtered.length === 0) {
            searchResults.innerHTML = '<p class="text-gray-500 text-center mt-4">No users found.</p>';
        } else {
            filtered.forEach(user => {
                const div = document.createElement('div');
                div.className = 'flex items-center gap-3 p-3 hover:bg-gray-50 cursor-pointer rounded-lg mb-2 transition';
                div.onclick = () => {
                    closeSearchModal();
                    showView('messages-view');
                    openChat(user);
                };
                div.innerHTML = `
                    <div class="w-10 h-10 rounded-full bg-gray-200 overflow-hidden shrink-0">
                        <img src="https://ui-avatars.com/api/?name=${user.name}&background=random" class="w-full h-full object-cover">
                    </div>
                    <div>
                        <p class="font-bold text-sm">${user.name}</p>
                        <p class="text-xs text-gray-500">${user.email}</p>
                    </div>
                `;
                searchResults.appendChild(div);
            });
        }
    });

    // === EXPLORE LOGIC ===
    const categoryBtns = document.querySelectorAll('.category-btn');

    async function loadExploreView(category = 'all') {
        const exploreGrid = document.getElementById('explore-grid');
        if (!exploreGrid) return;

        // Update Active Category Button Styles
        categoryBtns.forEach(btn => {
            if (btn.getAttribute('data-category') === category) {
                btn.classList.add('bg-gray-900', 'text-white');
                btn.classList.remove('bg-gray-100', 'text-gray-800');
            } else {
                btn.classList.remove('bg-gray-900', 'text-white');
                btn.classList.add('bg-gray-100', 'text-gray-800');
            }
        });

        // Pre-defined realistic images for categories
        const exploreImages = {
            nature: [
                'https://images.unsplash.com/photo-1472214103451-9374bd1c798e?w=500&q=80',
                'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=500&q=80',
                'https://images.unsplash.com/photo-1433086966358-54859d0ed716?w=500&q=80'
            ],
            tech: [
                'https://images.unsplash.com/photo-1518770660439-4636190af475?w=500&q=80',
                'https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=500&q=80',
                'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=500&q=80'
            ],
            food: [
                'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=500&q=80',
                'https://images.unsplash.com/photo-1499028344343-cd173ffc68a9?w=500&q=80',
                'https://images.unsplash.com/photo-1476224203421-9ac39bcb3327?w=500&q=80'
            ],
            travel: [
                'https://images.unsplash.com/photo-1506748686214-e9df14d4d9d0?w=500&q=80',
                'https://images.unsplash.com/photo-1504150558240-0b4fd8946624?w=500&q=80',
                'https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?w=500&q=80'
            ],
            art: [
                'https://images.unsplash.com/photo-1513364776144-60967b0f800f?w=500&q=80',
                'https://images.unsplash.com/photo-1460661419201-fd4cecdf8a8b?w=500&q=80',
                'https://images.unsplash.com/photo-1547891654-e66ed7ebb968?w=500&q=80'
            ]
        };

        exploreImages.all = [
            ...exploreImages.nature, ...exploreImages.tech, 
            ...exploreImages.food, ...exploreImages.travel, ...exploreImages.art
        ].sort(() => 0.5 - Math.random()); // shuffle simple

        // Get live saved posts from users
        let savedPosts = [];
        try {
            const res = await fetch('http://localhost:3000/api/posts?t=' + Date.now(), { cache: 'no-store' });
            if (res.ok) savedPosts = await res.json();
            else savedPosts = JSON.parse(localStorage.getItem('posts') || '[]');
        } catch(e) {
            savedPosts = JSON.parse(localStorage.getItem('posts') || '[]');
        }

        const userImageUrls = savedPosts.map(p => p.postImage);
        let imagesToShow = exploreImages[category] || exploreImages.all;

        if (category === 'all') {
            imagesToShow = [...userImageUrls, ...imagesToShow];
        }

        exploreGrid.innerHTML = '';

        if (imagesToShow.length === 0) {
            exploreGrid.innerHTML = '<p class="text-gray-500 text-sm p-4 col-span-3">No content found.</p>';
            return;
        }

        imagesToShow.forEach(imgUrl => {
            const img = document.createElement('img');
            img.src = imgUrl;
            img.className = 'aspect-square object-cover cursor-pointer hover:opacity-90 transition rounded-sm';
            exploreGrid.appendChild(img);
        });
    }

    categoryBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const cat = btn.getAttribute('data-category');
            loadExploreView(cat);
        });
    });

    // === MESSAGING LOGIC ===
    const messagesSidebar = document.getElementById('messages-sidebar');
    const chatArea = document.getElementById('chat-area');
    const activeChatContainer = document.getElementById('active-chat-container');
    const noChatSelected = document.getElementById('no-chat-selected');
    const chatHeightPadding = 160; // Approximate height of header + input area

    let currentChatUser = null;

    async function loadMessagesView() {
        console.log('Loading Messages View');
        messagesSidebar.innerHTML = '';

        let allUsers = [];
        try {
            const res = await fetch('http://localhost:3000/api/users');
            if(res.ok) allUsers = await res.json();
        } catch(e) { console.error(e); }

        // Filter out current user
        const otherUsers = allUsers.filter(u => u.email !== currentUser.email);

        if (otherUsers.length === 0) {
            messagesSidebar.innerHTML = `
                <div class="p-4 text-center text-gray-500 text-sm">
                    <p>No other users found.</p>
                    <p class="mt-2">Create another account to test messaging!</p>
                </div>
            `;
            return;
        }

        otherUsers.forEach(user => {
            const div = document.createElement('div');
            div.className = 'p-4 hover:bg-gray-50 cursor-pointer flex items-center gap-3 border-b border-gray-100 transition';
            // Check if this is the active chat to highlight it
            if (currentChatUser && currentChatUser.email === user.email) {
                div.classList.add('bg-gray-100');
            }

            div.onclick = () => openChat(user);

            div.innerHTML = `
                <div class="w-12 h-12 rounded-full bg-gray-300 overflow-hidden border border-gray-200 shrink-0">
                    <img src="https://ui-avatars.com/api/?name=${user.name}&background=random" class="w-full h-full object-cover">
                </div>
                <div class="overflow-hidden">
                    <p class="font-bold text-sm truncate text-gray-900">${user.name}</p>
                    <p class="text-xs text-gray-500 truncate">Tap to chat</p>
                </div>
            `;
            messagesSidebar.appendChild(div);
        });
    }

    function openChat(user) {
        currentChatUser = user;
        noChatSelected.classList.add('hidden');
        activeChatContainer.classList.remove('hidden');

        // Update Header
        document.getElementById('chat-header-username').textContent = user.name;
        document.getElementById('chat-header-img').src = `https://ui-avatars.com/api/?name=${user.name}&background=random`;

        // Refresh sidebar to highlight active user
        loadMessagesView();

        // Load Messages
        renderMessages();
    }

    async function renderMessages() {
        if (!currentChatUser) return;

        const chatMessages = document.getElementById('chat-messages');
        chatMessages.innerHTML = '';

        let allMessages = [];
        try {
            const res = await fetch('http://localhost:3000/api/messages');
            if(res.ok) allMessages = await res.json();
        } catch(e) { console.error(e); }

        // Filter messages between current user and selected user
        const conversation = allMessages.filter(m =>
            (m.sender === currentUser.email && m.receiver === currentChatUser.email) ||
            (m.sender === currentChatUser.email && m.receiver === currentUser.email)
        );

        // Sort by timestamp
        conversation.sort((a, b) => a.timestamp - b.timestamp);

        conversation.forEach(msg => {
            const isMe = msg.sender === currentUser.email;

            const msgDiv = document.createElement('div');
            msgDiv.className = isMe
                ? 'self-end bg-purple-600 text-white p-3 rounded-2xl rounded-tr-sm max-w-[70%] shadow-sm text-sm'
                : 'self-start bg-white border border-gray-200 p-3 rounded-2xl rounded-tl-sm max-w-[70%] shadow-sm text-sm';

            msgDiv.textContent = msg.text;
            chatMessages.appendChild(msgDiv);
        });

        // Scroll to bottom
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    // Send Message Logic
    const messageInput = document.getElementById('message-input');
    const sendBtn = document.getElementById('send-message-btn');

    async function sendMessage() {
        const text = messageInput.value.trim();
        if (!text || !currentChatUser) return;

        const newMessage = {
            id: Date.now(),
            sender: currentUser.email,
            receiver: currentChatUser.email,
            text: text,
            timestamp: Date.now()
        };

        // Save
        try {
            await fetch('http://localhost:3000/api/messages', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newMessage)
            });
        } catch(e) { console.error('Error sending message', e); }

        // Clear input
        messageInput.value = '';

        // Render
        renderMessages();
    }

    if (sendBtn) {
        sendBtn.addEventListener('click', sendMessage);
    }

    if (messageInput) {
        messageInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') sendMessage();
        });
    }

    // Auto-refresh messages and notifications every few seconds
    setInterval(() => {
        if (!activeChatContainer.classList.contains('hidden') && currentChatUser) {
            renderMessages();
        }
        
        // Also poll notifications if notifications-view is active
        const notifView = document.getElementById('notifications-view');
        if (notifView && !notifView.classList.contains('hidden')) {
            loadNotificationsView();
        }
        
        // Poll for posts updates to handle real-time likes, comments, and shares counts
        const homeView = document.getElementById('home-view');
        if (homeView && !homeView.classList.contains('hidden')) {
            updateLivePostStats();
        }
    }, 3000);

    async function updateLivePostStats() {
        try {
            const res = await fetch('http://localhost:3000/api/posts?t=' + Date.now(), { cache: 'no-store' });
            if (res.ok) {
                const livePosts = await res.json();
                livePosts.forEach(post => {
                    const statsTag = document.getElementById(`post-stats-${post.id}`);
                    if (statsTag) {
                        statsTag.innerHTML = `${post.likes || 0} likes &bull; ${post.comments || 0} comments &bull; ${post.shares || 0} shares`;
                    }
                });

                // If Comments Modal is open, live update the comments!
                if (activeCommentPostId) {
                    const activePost = livePosts.find(p => p.id === activeCommentPostId);
                    if (activePost) {
                        renderCommentsList(activePost.commentsList || []);
                    }
                }
            }
        } catch(e) {}
    }

    // === NOTIFICATIONS LOGIC ===
    async function loadNotificationsView() {
        const container = document.getElementById('notifications-container');
        if (!container) return;

        let allNotifs = [];
        try {
            const res = await fetch('http://localhost:3000/api/notifications?t=' + Date.now(), { cache: 'no-store' });
            if (res.ok) {
                allNotifs = await res.json();
                localStorage.setItem('notifications', JSON.stringify(allNotifs));
            } else {
                allNotifs = JSON.parse(localStorage.getItem('notifications') || '[]');
            }
        } catch (e) {
            allNotifs = JSON.parse(localStorage.getItem('notifications') || '[]');
        }

        const username = currentUser.name.split(' ')[0].toLowerCase().replace(/\s/g, '_');
        const myNotifs = allNotifs.filter(n => n.to === username);

        container.innerHTML = '';
        if (myNotifs.length === 0) {
            container.innerHTML = '<div class="p-4 text-center text-gray-500">No notifications yet.</div>';
            return;
        }

        myNotifs.forEach(notif => {
            const div = document.createElement('div');
            div.className = 'p-4 flex items-center gap-3 hover:bg-gray-50 transition';
            div.innerHTML = `
                <div class="w-10 h-10 rounded-full bg-gray-200 overflow-hidden shrink-0">
                    <img src="https://ui-avatars.com/api/?name=${notif.from}&background=random" class="w-full h-full object-cover">
                </div>
                <div class="flex-1">
                    <p class="text-sm"><span class="font-bold">${notif.from}</span> ${notif.type === 'like' ? 'liked your photo.' : 'interacted with you.'}</p>
                    <p class="text-xs text-gray-500 mt-1">${notif.time || 'recent'}</p>
                </div>
            `;
            container.appendChild(div);
        });
    }


    // === EDIT PROFILE && ARCHIVE LOGIC ===
    const editProfileBtn = document.getElementById('edit-profile-btn');
    const viewArchiveBtn = document.getElementById('view-archive-btn');
    const editProfileModal = document.getElementById('edit-profile-modal');
    const archiveModal = document.getElementById('archive-modal');
    
    // Edit Profile View
    window.openEditProfileModal = () => {
        document.getElementById('edit-name-input').value = currentUser.name;
        document.getElementById('edit-profile-img-preview').src = `https://ui-avatars.com/api/?name=${currentUser.name}&background=random`;
        editProfileModal.classList.remove('hidden');
    };
    window.closeEditProfileModal = () => editProfileModal.classList.add('hidden');

    if (editProfileBtn) editProfileBtn.addEventListener('click', openEditProfileModal);

    const saveProfileBtn = document.getElementById('save-profile-btn');
    if (saveProfileBtn) {
        saveProfileBtn.addEventListener('click', () => {
            const newName = document.getElementById('edit-name-input').value.trim();
            if (newName) {
                currentUser.name = newName;
                localStorage.setItem('currentUser', JSON.stringify(currentUser));
                updateProfileUI(currentUser);
                loadProfileView(); // refresh profile view text
                closeEditProfileModal();
            }
        });
    }

    // Archive View
    window.openArchiveModal = () => archiveModal.classList.remove('hidden');
    window.closeArchiveModal = () => archiveModal.classList.add('hidden');

    if (viewArchiveBtn) viewArchiveBtn.addEventListener('click', openArchiveModal);


    // === VIEW POST MODAL LOGIC ===
    const viewPostModal = document.getElementById('view-post-modal');
    
    window.openViewPostModal = (post) => {
        document.getElementById('view-post-img').src = post.postImage;
        document.getElementById('view-post-user-img').src = post.userImage || `https://ui-avatars.com/api/?name=${post.username}&background=random`;
        document.getElementById('view-post-username').textContent = post.username;
        
        document.getElementById('view-post-caption-user-img').src = post.userImage || `https://ui-avatars.com/api/?name=${post.username}&background=random`;
        document.getElementById('view-post-caption-username').textContent = post.username;
        document.getElementById('view-post-caption').textContent = post.caption || '';
        document.getElementById('view-post-time').textContent = post.time || 'RECENT';
        document.getElementById('view-post-likes').innerHTML = `${post.likes || 0} likes &bull; ${post.comments || 0} comments &bull; ${post.shares || 0} shares`;
        
        viewPostModal.classList.remove('hidden');
    };
    
    window.closeViewPostModal = () => viewPostModal.classList.add('hidden');


    // === COMMENTS MODAL LOGIC ===
    const commentsModal = document.getElementById('comments-modal');
    const commentsContainer = document.getElementById('comments-list-container');
    const newCommentInput = document.getElementById('new-comment-input');
    const postCommentBtn = document.getElementById('post-comment-btn');
    let activeCommentPostId = null;

    function renderCommentsList(commentsArray) {
        commentsContainer.innerHTML = '';
        if (!commentsArray || commentsArray.length === 0) {
            commentsContainer.innerHTML = '<div class="text-center text-gray-500 mt-8 text-sm">No comments yet. Be the first to comment!</div>';
            return;
        }

        commentsArray.forEach(c => {
            const div = document.createElement('div');
            div.className = 'flex gap-3 mb-4';
            div.innerHTML = `
                <div class="w-8 h-8 rounded-full overflow-hidden shrink-0 border border-gray-200">
                    <img src="${c.userImage || `https://ui-avatars.com/api/?name=${c.username}&background=random`}" class="w-full h-full object-cover">
                </div>
                <div class="text-sm">
                    <span class="font-bold mr-1">${c.username}</span>
                    <span>${c.text}</span>
                    <p class="text-gray-500 text-xs mt-1 uppercase">${c.time || 'RECENT'}</p>
                </div>
            `;
            commentsContainer.appendChild(div);
        });
    }

    window.openCommentsModal = (post) => {
        activeCommentPostId = post.id;
        document.getElementById('comment-current-user-img').src = `https://ui-avatars.com/api/?name=${currentUser.name}&background=random`;
        newCommentInput.value = '';
        renderCommentsList(post.commentsList || []);
        commentsModal.classList.remove('hidden');
    };

    window.closeCommentsModal = () => {
        commentsModal.classList.add('hidden');
        activeCommentPostId = null;
    };

    if (postCommentBtn) {
        postCommentBtn.addEventListener('click', async () => {
            const text = newCommentInput.value.trim();
            if (!text || !activeCommentPostId) return;

            const username = currentUser.name.split(' ')[0].toLowerCase().replace(/\s/g, '_');
            const userImage = `https://ui-avatars.com/api/?name=${currentUser.name}&background=random`;

            // Optimistic prep
            newCommentInput.value = '';
            
            try {
                await fetch(`http://localhost:3000/api/posts/${activeCommentPostId}/comment`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ text, username, userImage })
                });
                updateLivePostStats(); // Trigger instant refresh of modal and feed counts
            } catch(e) {
                console.error('Backend offline, saving comment locally');
                const localPosts = JSON.parse(localStorage.getItem('posts') || '[]');
                const localP = localPosts.find(p => p.id === activeCommentPostId);
                if (localP) {
                    localP.commentsList = localP.commentsList || [];
                    localP.commentsList.push({ text, username, userImage, time: 'JUST NOW' });
                    localP.comments = localP.commentsList.length;
                    localStorage.setItem('posts', JSON.stringify(localPosts));
                }
            }
        });
    }

    async function loadPosts() {
        const feedContainer = document.getElementById('feed-container');
        if (!feedContainer) return;

        feedContainer.innerHTML = ''; // Clear existing

        const defaultPosts = [
            {
                id: 1,
                username: 'nature_lover',
                userImage: 'https://ui-avatars.com/api/?name=Nature+Lover&background=random',
                postImage: 'https://images.unsplash.com/photo-1472214103451-9374bd1c798e?ixlib=rb-4.0.3&auto=format&fit=crop&w=1000&q=80',
                likes: 1234,
                caption: 'Beautiful sunset! 🌅',
                time: '2 HOURS AGO'
            },
            {
                id: 2,
                username: 'tech_guru',
                userImage: 'https://ui-avatars.com/api/?name=Tech+Guru&background=random',
                postImage: 'https://images.unsplash.com/photo-1518770660439-4636190af475?ixlib=rb-4.0.3&auto=format&fit=crop&w=1000&q=80',
                likes: 890,
                caption: 'New setup is finally complete! 💻🏎️',
                time: '3 HOURS AGO'
            },
            {
                id: 3,
                username: 'foodie_adventures',
                userImage: 'https://ui-avatars.com/api/?name=Foodie&background=random',
                postImage: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?ixlib=rb-4.0.3&auto=format&fit=crop&w=1000&q=80',
                likes: 543,
                caption: 'Best pasta I ever had in Rome. 🍝🍷',
                time: '5 HOURS AGO'
            },
            {
                id: 4,
                username: 'travel_diaries',
                userImage: 'https://ui-avatars.com/api/?name=Travel&background=random',
                postImage: 'https://images.unsplash.com/photo-1506748686214-e9df14d4d9d0?ixlib=rb-4.0.3&auto=format&fit=crop&w=1000&q=80',
                likes: 2450,
                caption: 'City lights and late nights. ✨🌆',
                time: '7 HOURS AGO'
            },
            {
                id: 5,
                username: 'fitness_journey',
                userImage: 'https://ui-avatars.com/api/?name=Fitness&background=random',
                postImage: 'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?ixlib=rb-4.0.3&auto=format&fit=crop&w=1000&q=80',
                likes: 1120,
                caption: 'Morning run done! Feeling energized. 🏃‍♂️💪',
                time: '8 HOURS AGO'
            },
            {
                id: 6,
                username: 'art_corner',
                userImage: 'https://ui-avatars.com/api/?name=Art&background=random',
                postImage: 'https://images.unsplash.com/photo-1513364776144-60967b0f800f?ixlib=rb-4.0.3&auto=format&fit=crop&w=1000&q=80',
                likes: 875,
                caption: 'Just finished this abstract piece. What do you think? 🎨',
                time: '12 HOURS AGO'
            },
            {
                id: 7,
                username: 'pet_lovers',
                userImage: 'https://ui-avatars.com/api/?name=Pets&background=random',
                postImage: 'https://images.unsplash.com/photo-1517849845537-4d257902454a?ixlib=rb-4.0.3&auto=format&fit=crop&w=1000&q=80',
                likes: 3100,
                caption: 'Cutest doggo in the world! 🐶❤️',
                time: '14 HOURS AGO'
            },
            {
                id: 8,
                username: 'coffee_addict',
                userImage: 'https://ui-avatars.com/api/?name=Coffee&background=random',
                postImage: 'https://images.unsplash.com/photo-1497935586351-b67a49e012bf?ixlib=rb-4.0.3&auto=format&fit=crop&w=1000&q=80',
                likes: 420,
                caption: 'Starting the day right. ☕',
                time: '1 DAY AGO'
            },
            {
                id: 9,
                username: 'minimalist_design',
                userImage: 'https://ui-avatars.com/api/?name=Minimal&background=random',
                postImage: 'https://images.unsplash.com/photo-1449247709967-d4461a6a6103?ixlib=rb-4.0.3&auto=format&fit=crop&w=1000&q=80',
                likes: 1560,
                caption: 'Less is more. 🤍',
                time: '2 DAYS AGO'
            },
            {
                id: 10,
                username: 'music_vibes',
                userImage: 'https://ui-avatars.com/api/?name=Music&background=random',
                postImage: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?ixlib=rb-4.0.3&auto=format&fit=crop&w=1000&q=80',
                likes: 990,
                caption: 'Listening to classic vinyl records tonight. 🎶🎧',
                time: '2 DAYS AGO'
            }
        ];

        let savedPosts = [];
        try {
            const res = await fetch('http://localhost:3000/api/posts?t=' + Date.now(), { cache: 'no-store' });
            if (res.ok) {
                savedPosts = await res.json();
                localStorage.setItem('posts', JSON.stringify(savedPosts));
            } else {
                savedPosts = JSON.parse(localStorage.getItem('posts') || '[]');
            }
        } catch(e) { 
            console.error('Backend offline... fetching posts locally', e); 
            savedPosts = JSON.parse(localStorage.getItem('posts') || '[]');
        }

        const allPosts = [...savedPosts, ...defaultPosts];

        allPosts.forEach(post => renderPost(post));
    }

    function renderPost(post, prepend = false) {
        const feedContainer = document.getElementById('feed-container');
        if (!feedContainer) return;

        const postElement = document.createElement('div');
        postElement.className = 'bg-white border rounded-lg overflow-hidden mb-6 shadow-sm';
        postElement.innerHTML = `
            <div class="flex items-center justify-between p-3">
                <div class="flex items-center space-x-3">
                    <div class="w-8 h-8 rounded-full overflow-hidden border border-gray-200">
                        <img src="${post.userImage}" class="w-full h-full object-cover">
                    </div>
                    <span class="font-bold text-sm">${post.username}</span>
                </div>
                <ion-icon name="ellipsis-horizontal" class="text-xl cursor-pointer"></ion-icon>
            </div>
            <div class="w-full bg-gray-100 flex items-center justify-center">
                <img src="${post.postImage}" class="w-full h-auto object-cover max-h-[600px]">
            </div>
            <div class="p-3">
                <div class="flex justify-between items-center text-2xl mb-2">
                    <div class="flex space-x-4">
                        <ion-icon name="heart-outline" class="cursor-pointer hover:text-gray-500 transition-colors like-btn" data-liked="false"></ion-icon>
                        <ion-icon name="chatbubble-outline" class="cursor-pointer hover:text-gray-500 transition-colors comment-btn"></ion-icon>
                        <ion-icon name="paper-plane-outline" class="cursor-pointer hover:text-gray-500 transition-colors share-btn"></ion-icon>
                    </div>
                </div> 
                <p class="font-bold text-sm mb-1" id="post-stats-${post.id}">${post.likes || 0} likes &bull; ${post.comments || 0} comments &bull; ${post.shares || 0} shares</p>
                <div class="text-sm">
                    <span class="font-bold mr-1">${post.username}</span>
                    <span>${post.caption}</span>
                </div>
                <p class="text-gray-500 text-xs mt-2 uppercase">${post.time}</p>
            </div>
        `;

        async function triggerInteraction(action, extraBody = {}) {
            try {
                await fetch(`http://localhost:3000/api/posts/${post.id}/${action}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(extraBody)
                });
                updateLivePostStats(); // Trigger instant refresh
            } catch(e) { 
                console.error('Backend offline, updating interaction locally');
                const localPosts = JSON.parse(localStorage.getItem('posts') || '[]');
                const lp = localPosts.find(p => p.id === post.id);
                if (lp) { 
                    if (action === 'like') {
                        const increment = extraBody.liked ? 1 : -1;
                        lp.likes = Math.max(0, (lp.likes || 0) + increment);
                    } else if (action === 'comment') {
                        lp.comments = (lp.comments || 0) + 1;
                    } else if (action === 'share') {
                        lp.shares = (lp.shares || 0) + 1;
                    }
                    localStorage.setItem('posts', JSON.stringify(localPosts));
                }
                updateLivePostStats();
            }
        }

        const likeBtn = postElement.querySelector('.like-btn');
        likeBtn.addEventListener('click', async () => {
            const isLiked = likeBtn.getAttribute('name') === 'heart';
            if (!isLiked) {
                likeBtn.setAttribute('name', 'heart');
                likeBtn.classList.add('text-red-500', 'animate-bounce');
                setTimeout(() => likeBtn.classList.remove('animate-bounce'), 1000);
                triggerInteraction('like', { liked: true });
                
                // NOTIFICATION LOGIC
                // Only send notification if liking someone else's post
                const currentUsername = currentUser.name.split(' ')[0].toLowerCase().replace(/\s/g, '_');
                if (post.username !== currentUsername) {
                    const newNotif = {
                        id: Date.now(),
                        to: post.username,
                        from: currentUsername,
                        type: 'like',
                        time: 'JUST NOW',
                        timestamp: Date.now()
                    };
                    
                    try {
                        await fetch('http://localhost:3000/api/notifications', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(newNotif)
                        });
                    } catch(e) {
                        const localNotifs = JSON.parse(localStorage.getItem('notifications') || '[]');
                        localNotifs.unshift(newNotif);
                        localStorage.setItem('notifications', JSON.stringify(localNotifs));
                    }
                }
            } else {
                likeBtn.setAttribute('name', 'heart-outline');
                likeBtn.classList.remove('text-red-500');
                triggerInteraction('like', { liked: false });
            }
        });

        const commentBtn = postElement.querySelector('.comment-btn');
        commentBtn.addEventListener('click', () => {
            openCommentsModal(post);
        });

        const shareBtnAction = postElement.querySelector('.share-btn');
        shareBtnAction.addEventListener('click', () => {
            // Simulate sharing
            triggerInteraction('share');
        });

        if (prepend) {
            feedContainer.prepend(postElement);
        } else {
            feedContainer.appendChild(postElement);
        }
    }

    window.logout = () => {
        localStorage.removeItem('currentUser');
        window.location.href = 'index.html';
    };

    // === HELPER FUNCTIONS ===
    function updateProfileUI(user) {
        document.getElementById('sidebar-profile-name').textContent = user.name;
        const imgUrl = `https://ui-avatars.com/api/?name=${user.name}&background=random`;
        ['sidebar-profile-img', 'right-profile-img', 'mobile-profile-img'].forEach(id => {
             const el = document.getElementById(id);
             if (el) el.src = imgUrl;
        });

        const rpn = document.getElementById('right-profile-name');
        if (rpn) rpn.textContent = user.name;

        const rpu = document.getElementById('right-profile-username');
        if (rpu) rpu.textContent = user.email.split('@')[0];
    }

    // === REELS LOGIC ===
    const recordReelModal = document.getElementById('record-reel-modal');
    const startRecordBtn = document.getElementById('start-record-btn');
    const stopRecordBtn = document.getElementById('stop-record-btn');
    const recordVideoPreview = document.getElementById('record-video-preview');
    const playbackVideo = document.getElementById('playback-video');
    const cameraLoading = document.getElementById('camera-loading');
    const recordControls = document.getElementById('record-controls');
    const uploadReelControls = document.getElementById('upload-reel-controls');
    const retakeReelBtn = document.getElementById('retake-reel-btn');
    const shareReelBtn = document.getElementById('share-reel-btn');
    const reelCaptionInput = document.getElementById('reel-caption-input');
    const recordTimer = document.getElementById('record-timer');

    let mediaRecorder;
    let recordedChunks = [];
    let stream;
    let timerInterval;
    let secondsRecorded = 0;

    window.openRecordReelModal = async () => {
        if (!recordReelModal) return;
        recordReelModal.classList.remove('hidden');
        resetRecordModalUI();

        try {
            stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: true });
            recordVideoPreview.srcObject = stream;
            recordVideoPreview.classList.remove('hidden');
            cameraLoading.classList.add('hidden');
        } catch (err) {
            console.error('Error accessing camera:', err);
            alert('Could not access camera. Please allow permissions.');
            closeRecordReelModal();
        }
    };

    window.closeRecordReelModal = () => {
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
            stream = null;
        }
        clearInterval(timerInterval);
        if (recordReelModal) recordReelModal.classList.add('hidden');
    };

    function resetRecordModalUI() {
        recordVideoPreview.classList.add('hidden');
        playbackVideo.classList.add('hidden');
        playbackVideo.src = '';
        cameraLoading.classList.remove('hidden');
        uploadReelControls.classList.add('hidden');
        recordControls.classList.remove('hidden');
        startRecordBtn.classList.remove('hidden');
        stopRecordBtn.classList.add('hidden');
        recordTimer.classList.add('hidden');
        secondsRecorded = 0;
        recordTimer.textContent = '00:00';
        if (reelCaptionInput) reelCaptionInput.value = '';
        recordedChunks = [];
    }

    if (startRecordBtn) {
        startRecordBtn.addEventListener('click', () => {
            if (!stream) return;
            recordedChunks = [];
            // Use optimal mimetype if possible, fallback to standard webm
            let mimeType = 'video/webm;codecs=vp8,opus';
            if (!MediaRecorder.isTypeSupported(mimeType)) {
                mimeType = 'video/webm';
            }
            mediaRecorder = new MediaRecorder(stream, { mimeType });

            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    recordedChunks.push(event.data);
                }
            };

            mediaRecorder.onstop = () => {
                clearInterval(timerInterval);
                const blob = new Blob(recordedChunks, { type: mimeType });
                const videoUrl = URL.createObjectURL(blob);
                
                recordVideoPreview.classList.add('hidden');
                playbackVideo.src = videoUrl;
                playbackVideo.classList.remove('hidden');
                playbackVideo.play();

                recordControls.classList.add('hidden');
                uploadReelControls.classList.remove('hidden');
                
                // Stop camera stream since we are now in playback mode
                if (stream) {
                    stream.getTracks().forEach(track => track.stop());
                    stream = null;
                }
            };

            startRecordBtn.classList.add('hidden');
            stopRecordBtn.classList.remove('hidden');
            recordTimer.classList.remove('hidden');

            secondsRecorded = 0;
            recordTimer.textContent = '00:00';
            timerInterval = setInterval(() => {
                secondsRecorded++;
                const mins = String(Math.floor(secondsRecorded / 60)).padStart(2, '0');
                const secs = String(secondsRecorded % 60).padStart(2, '0');
                recordTimer.textContent = `${mins}:${secs}`;
            }, 1000);

            mediaRecorder.start();
        });
    }

    if (stopRecordBtn) {
        stopRecordBtn.addEventListener('click', () => {
            if (mediaRecorder && mediaRecorder.state !== 'inactive') {
                mediaRecorder.stop();
            }
        });
    }

    if (retakeReelBtn) {
        retakeReelBtn.addEventListener('click', async () => {
            resetRecordModalUI();
            try {
                stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: true });
                recordVideoPreview.srcObject = stream;
                recordVideoPreview.classList.remove('hidden');
                cameraLoading.classList.add('hidden');
            } catch(e) {
                console.error(e);
            }
        });
    }

    if (shareReelBtn) {
        shareReelBtn.addEventListener('click', () => {
            shareReelBtn.disabled = true;
            shareReelBtn.textContent = 'Sharing...';

            let type = 'video/webm';
            const blob = new Blob(recordedChunks, { type });
            const reader = new FileReader();

            reader.onloadend = async () => {
                const base64Data = reader.result;
                const newReel = {
                    id: Date.now(),
                    username: currentUser.name.split(' ')[0].toLowerCase().replace(/\s/g, '_'),
                    userImage: `https://ui-avatars.com/api/?name=${currentUser.name}&background=random`,
                    videoData: base64Data,
                    caption: reelCaptionInput ? reelCaptionInput.value : '',
                    likes: 0,
                    comments: 0
                };

                try {
                    await fetch('http://localhost:3000/api/reels', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(newReel)
                    });
                } catch(e) {
                    console.error('Backend offline, saving reel locally');
                    const localReels = JSON.parse(localStorage.getItem('reels') || '[]');
                    localReels.unshift(newReel);
                    localStorage.setItem('reels', JSON.stringify(localReels));
                }

                shareReelBtn.disabled = false;
                shareReelBtn.textContent = 'Share';
                closeRecordReelModal();
                showView('reels-view');
            };

            if (blob.size > 0) {
                reader.readAsDataURL(blob);
            } else {
                alert('Failed to process video.');
                shareReelBtn.disabled = false;
                shareReelBtn.textContent = 'Share';
            }
        });
    }

    async function loadReelsView() {
        const feedContainer = document.getElementById('reels-feed-container');
        if (!feedContainer) return;

        let allReels = [];
        try {
            const res = await fetch('http://localhost:3000/api/reels?t=' + Date.now(), { cache: 'no-store' });
            if (res.ok) {
                allReels = await res.json();
                localStorage.setItem('reels', JSON.stringify(allReels));
            } else {
                allReels = JSON.parse(localStorage.getItem('reels') || '[]');
            }
        } catch(e) { 
            allReels = JSON.parse(localStorage.getItem('reels') || '[]');
        }

        if (allReels.length === 0) {
            feedContainer.innerHTML = `
                <div class="w-full h-full snap-center relative flex items-center justify-center bg-gray-900 border-b border-gray-800">
                    <p class="text-white text-xl">No Reels Yet.</p>
                </div>
            `;
            return;
        }

        feedContainer.innerHTML = '';
        
        allReels.forEach(reel => {
            const div = document.createElement('div');
            div.className = 'w-full h-full snap-center relative flex items-center justify-center bg-black border-b border-gray-800';
            div.innerHTML = `
                <video src="${reel.videoData}" class="w-full h-full object-cover" loop playsinline></video>
                <div class="absolute bottom-6 left-4 right-16 text-white z-10 pointer-events-none">
                    <div class="flex items-center gap-2 mb-2">
                        <img src="${reel.userImage}" class="w-8 h-8 rounded-full border border-white">
                        <p class="font-bold text-sm">@${reel.username}</p>
                    </div>
                    <p class="text-sm line-clamp-2">${reel.caption}</p>
                </div>
                <div class="absolute bottom-10 right-4 flex flex-col items-center gap-6 z-10 text-white pointer-events-auto">
                    <div class="flex flex-col items-center">
                        <ion-icon name="heart-outline" class="text-3xl cursor-pointer hover:text-red-500 transition"></ion-icon>
                        <span class="text-xs mt-1 font-bold">${reel.likes}</span>
                    </div>
                    <div class="flex flex-col items-center">
                        <ion-icon name="chatbubble-outline" class="text-3xl cursor-pointer"></ion-icon>
                        <span class="text-xs mt-1 font-bold">${reel.comments}</span>
                    </div>
                    <div class="flex flex-col items-center">
                        <ion-icon name="paper-plane-outline" class="text-3xl cursor-pointer"></ion-icon>
                    </div>
                    <div class="flex flex-col items-center">
                        <ion-icon name="ellipsis-horizontal" class="text-xl cursor-pointer"></ion-icon>
                    </div>
                </div>
            `;
            const videoEl = div.querySelector('video');
            div.addEventListener('click', (e) => {
                if(e.target.tagName !== 'ION-ICON') {
                    if (videoEl.paused) videoEl.play();
                    else videoEl.pause();
                }
            });

            // IntersectionObserver to auto-play/pause based on scroll
            const observer = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        videoEl.play().catch(e => console.error("Autoplay prevented", e));
                    } else {
                        videoEl.pause();
                    }
                });
            }, { threshold: 0.6 });
            observer.observe(div);

            feedContainer.appendChild(div);
        });
    }

});
