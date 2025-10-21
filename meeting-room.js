// Enhanced Meeting Room JavaScript with PeerJS for Group Video Chat
class MeetingRoom {
    constructor() {
        this.localStream = null;
        this.remoteStreams = new Map();
        this.participants = new Map();
        this.isMuted = false;
        this.isVideoOn = true;
        this.isScreenSharing = false;
        this.meetingData = null;
        this.localVideo = null;
        this.videoGrid = null;
        this.participantsList = null;
        this.chatMessages = null;
        
        // PeerJS properties for group chat
        this.peer = null;
        this.connections = new Map(); // Media connections
        this.dataConnections = new Map(); // Data connections for chat
        this.participantConnections = new Map(); // Track all participant connections
        
        // Configuration
        this.iceServers = [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' }
        ];
        
        this.init();
    }
    
    async init() {
        // Get meeting data from localStorage
        this.meetingData = JSON.parse(localStorage.getItem('meetingData'));
        if (!this.meetingData) {
            alert('No meeting data found. Redirecting to home.');
            window.location.href = 'index.html';
            return;
        }
        
        // Initialize DOM elements
        this.initializeElements();
        
        // Display meeting information
        this.displayMeetingInfo();
        
        // Initialize PeerJS
        await this.initializePeerJS();
        
        // Initialize event listeners
        this.initializeEventListeners();
        
        // Start the meeting
        await this.startMeeting();
    }
    
    initializeElements() {
        this.localVideo = document.getElementById('local-video');
        this.videoGrid = document.getElementById('video-grid');
        this.participantsList = document.getElementById('participants-list');
        this.chatMessages = document.getElementById('chat-messages');
        
        // Control buttons
        this.muteBtn = document.getElementById('mute-btn');
        this.videoBtn = document.getElementById('video-btn');
        this.shareBtn = document.getElementById('share-btn');
        this.chatBtn = document.getElementById('chat-btn');
        this.endBtn = document.getElementById('end-btn');
        
        // Header elements
        this.participantsToggle = document.getElementById('participants-toggle');
        this.participantCount = document.getElementById('participant-count');
        this.connectedIpsEl = document.getElementById('connected-ips');
        
        // Sidebar elements
        this.participantsSidebar = document.getElementById('participants-sidebar');
        this.closeSidebar = document.getElementById('close-sidebar');
        
        // Chat elements
        this.chatPanel = document.getElementById('chat-panel');
        this.closeChat = document.getElementById('close-chat');
        this.chatInput = document.getElementById('chat-input');
        this.sendMessage = document.getElementById('send-message');
        
        // Loading screen
        this.loadingScreen = document.getElementById('loading-screen');
    }
    
    async initializePeerJS() {
        return new Promise((resolve) => {
            try {
                const peerId = this.meetingData.isHost ? 
                    this.meetingData.meetingID : 
                    (this.meetingData.peerId || 'participant_' + Math.random().toString(36).substr(2, 9));

                this.peer = new Peer(peerId, {
                    debug: 0,
                    config: {
                        iceServers: [
                            { urls: 'stun:stun.l.google.com:19302' },
                            { urls: 'stun:stun1.l.google.com:19302' }
                        ]
                    }
                });

                this.peer.on('open', (id) => {
                    console.log('PeerJS connected with ID:', id);
                    this.updatePeerStatus('Connected');
                    resolve();
                });

                this.peer.on('error', (err) => {
                    console.error('PeerJS error:', err);
                    this.updatePeerStatus('Error: ' + err.type);
                    resolve();
                });

                // Handle incoming calls (for video/audio)
                this.peer.on('call', (call) => {
                    console.log('Incoming call from:', call.peer);
                    this.handleIncomingCall(call);
                });

                // Handle incoming data connections (for chat and participant sync)
                this.peer.on('connection', (conn) => {
                    console.log('Incoming data connection from:', conn.peer);
                    this.handleIncomingDataConnection(conn);
                });

                // Set timeout for PeerJS initialization
                setTimeout(() => {
                    if (!this.peer || this.peer.disconnected) {
                        console.log('PeerJS initialization timeout');
                        this.updatePeerStatus('Offline');
                        resolve();
                    }
                }, 5000);

            } catch (error) {
                console.error('Failed to initialize PeerJS:', error);
                this.updatePeerStatus('Failed');
                resolve();
            }
        });
    }

    updatePeerStatus(status) {
        const statusElement = document.getElementById('peer-connection-status');
        if (statusElement) {
            statusElement.textContent = status;
            
            // Add color coding
            statusElement.className = '';
            if (status === 'Connected') {
                statusElement.style.color = '#4CAF50';
            } else if (status.includes('Error') || status.includes('Failed')) {
                statusElement.style.color = '#f44336';
            } else {
                statusElement.style.color = '#ff9800';
            }
        }
    }
    
    displayMeetingInfo() {
        document.getElementById('meeting-id-display').textContent = 
            `Meeting ID: ${this.meetingData.meetingID}`;
        document.getElementById('host-ip-display').textContent = 
            `Host IP: ${this.meetingData.hostIP}`;
        document.getElementById('local-username').textContent = this.meetingData.username;
        
        // Display scheduled meeting info if available
        if (this.meetingData.scheduledMeeting) {
            const scheduledInfo = this.meetingData.scheduledMeeting;
            console.log('Scheduled Meeting Details:', scheduledInfo);
            
            if (scheduledInfo.topic) {
                const header = document.querySelector('.meeting-header');
                const topicElement = document.createElement('div');
                topicElement.className = 'meeting-topic';
                topicElement.innerHTML = `<i class="fas fa-calendar"></i> ${scheduledInfo.topic}`;
                topicElement.style.cssText = `
                    color: #4CAF50;
                    font-size: 0.9rem;
                    font-weight: 600;
                    margin-left: 2rem;
                `;
                header.insertBefore(topicElement, header.querySelector('.header-controls'));
            }
        }
    }
    
    initializeEventListeners() {
        // Control buttons
        this.muteBtn.addEventListener('click', () => this.toggleMute());
        this.videoBtn.addEventListener('click', () => this.toggleVideo());
        this.shareBtn.addEventListener('click', () => this.toggleScreenShare());
        this.chatBtn.addEventListener('click', () => this.toggleChat());
        this.endBtn.addEventListener('click', () => this.endMeeting());
        
        // Header controls
        this.participantsToggle.addEventListener('click', () => this.toggleParticipants());
        this.closeSidebar.addEventListener('click', () => this.closeParticipants());
        
        // Chat controls
        this.closeChat.addEventListener('click', () => this.closeChatPanel());
        this.sendMessage.addEventListener('click', () => this.sendChatMessage());
        this.chatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.sendChatMessage();
            }
        });
        
        // Local video controls
        document.getElementById('local-mute').addEventListener('click', () => this.toggleMute());
        document.getElementById('local-video-toggle').addEventListener('click', () => this.toggleVideo());
        
        // Handle page visibility change
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                this.handlePageHidden();
            } else {
                this.handlePageVisible();
            }
        });
        
        // Handle window beforeunload
        window.addEventListener('beforeunload', () => this.endMeeting());
    }
    
    async startMeeting() {
        try {
            // Update loading message
            const loadingMessage = document.getElementById('loading-message');
            if (loadingMessage) {
                loadingMessage.textContent = 'Setting up group video chat...';
            }

            // Get user media
            await this.getUserMedia();
            
            // Add local participant
            this.addParticipant({
                id: 'local',
                peerId: this.peer.id,
                name: this.meetingData.username,
                ip: this.meetingData.hostIP,
                isHost: this.meetingData.isHost,
                stream: this.localStream
            });
            
            // Connect to existing participants
            if (!this.meetingData.isHost) {
                await this.connectToHostAndParticipants();
            }

            // Hide loading screen after a short delay
            setTimeout(() => {
                this.loadingScreen.classList.add('hidden');
            }, 2000);
            
        } catch (error) {
            console.error('Error starting meeting:', error);
            this.loadingScreen.classList.add('hidden');
            alert('Failed to start meeting. Please check your camera and microphone permissions.');
        }
    }

    async connectToHostAndParticipants() {
        if (!this.peer || !this.meetingData.hostPeerId) {
            console.log('No PeerJS connection available');
            return;
        }

        try {
            // Connect to host via data channel first
            const hostConn = this.peer.connect(this.meetingData.hostPeerId, {
                reliable: true
            });

            hostConn.on('open', () => {
                console.log('Connected to host via data channel');
                
                // Send join message to host
                hostConn.send({
                    type: 'participant-join',
                    participantId: this.peer.id,
                    username: this.meetingData.username,
                    ip: this.meetingData.hostIP
                });

                this.dataConnections.set(this.meetingData.hostPeerId, hostConn);

                // Request participant list from host
                hostConn.send({
                    type: 'request-participant-list'
                });
            });

            hostConn.on('data', (data) => {
                this.handleDataFromHost(data);
            });

            // Call host for media stream
            if (this.localStream) {
                const call = this.peer.call(this.meetingData.hostPeerId, this.localStream);
                this.setupCallHandlers(call, this.meetingData.hostPeerId);
            }

        } catch (error) {
            console.error('Error connecting to host:', error);
        }
    }

    handleIncomingCall(call) {
        console.log('Answering incoming call from:', call.peer);
        
        // Answer the call with our local stream
        call.answer(this.localStream);
        
        // Set up call handlers
        this.setupCallHandlers(call, call.peer);
    }

    setupCallHandlers(call, peerId) {
        call.on('stream', (remoteStream) => {
            console.log('Received remote stream from:', peerId);
            this.handleRemoteStream(remoteStream, peerId);
        });

        call.on('close', () => {
            console.log('Call closed with:', peerId);
            this.handleParticipantLeave(peerId);
        });

        call.on('error', (err) => {
            console.error('Call error with', peerId, ':', err);
        });

        this.connections.set(peerId, call);
    }

    handleIncomingDataConnection(conn) {
        conn.on('open', () => {
            console.log('Data connection opened with:', conn.peer);
            this.dataConnections.set(conn.peer, conn);

            // If we're the host, send welcome and participant list
            if (this.meetingData.isHost) {
                conn.send({
                    type: 'welcome',
                    message: 'Welcome to the group video chat!',
                    hostId: this.peer.id
                });

                // Send current participant list
                this.sendParticipantList(conn);
            }
        });

        conn.on('data', (data) => {
            console.log('Received data from', conn.peer, ':', data);
            this.handleDataFromParticipant(data, conn.peer);
        });

        conn.on('close', () => {
            console.log('Data connection closed with:', conn.peer);
            this.dataConnections.delete(conn.peer);
        });
    }

    handleRemoteStream(remoteStream, peerId) {
        // Create or update participant with remote stream
        const existingParticipant = this.participants.get(peerId);
        if (existingParticipant) {
            existingParticipant.stream = remoteStream;
            this.updateVideoTile(peerId, remoteStream);
        } else {
            // Get participant info from data or use default
            const participantName = `Participant ${peerId.substr(0, 6)}`;
            this.addParticipant({
                id: peerId,
                peerId: peerId,
                name: participantName,
                ip: 'Unknown',
                isHost: false,
                stream: remoteStream
            });
        }
    }

    handleDataFromHost(data) {
        if (data.type === 'welcome') {
            this.addChatMessage('System', data.message);
        } else if (data.type === 'participant-list') {
            // Connect to other participants for full mesh
            this.connectToOtherParticipants(data.participants);
        } else if (data.type === 'new-participant') {
            // Connect to new participant
            this.connectToParticipant(data.participant);
        }
    }

    handleDataFromParticipant(data, participantId) {
        if (data.type === 'participant-join') {
            // Add new participant
            this.addParticipant({
                id: participantId,
                peerId: participantId,
                name: data.username,
                ip: data.ip,
                isHost: false,
                stream: null
            });

            // If we're the host, broadcast new participant to others
            if (this.meetingData.isHost) {
                this.broadcastToParticipants({
                    type: 'new-participant',
                    participant: {
                        id: participantId,
                        peerId: participantId,
                        name: data.username,
                        ip: data.ip
                    }
                });

                // Call the new participant
                this.callParticipant(participantId);
            }

            this.addChatMessage('System', `${data.username} joined the meeting`);

        } else if (data.type === 'request-participant-list') {
            // Send participant list to requesting participant
            if (this.meetingData.isHost) {
                this.sendParticipantList(this.dataConnections.get(participantId));
            }
        } else if (data.type === 'chat-message') {
            this.addChatMessage(data.username, data.message);
        }
    }

    connectToOtherParticipants(participants) {
        participants.forEach(participant => {
            if (participant.peerId !== this.peer.id && !this.dataConnections.has(participant.peerId)) {
                this.connectToParticipant(participant);
            }
        });
    }

    connectToParticipant(participant) {
        if (participant.peerId === this.peer.id) return;

        try {
            // Establish data connection
            const conn = this.peer.connect(participant.peerId, { reliable: true });
            
            conn.on('open', () => {
                console.log('Connected to participant:', participant.peerId);
                this.dataConnections.set(participant.peerId, conn);
            });

            conn.on('data', (data) => {
                this.handleDataFromParticipant(data, participant.peerId);
            });

            // Establish media connection
            if (this.localStream) {
                const call = this.peer.call(participant.peerId, this.localStream);
                this.setupCallHandlers(call, participant.peerId);
            }

        } catch (error) {
            console.error('Error connecting to participant:', error);
        }
    }

    callParticipant(participantId) {
        if (!this.peer || !this.localStream || participantId === this.peer.id) return;

        try {
            const call = this.peer.call(participantId, this.localStream);
            this.setupCallHandlers(call, participantId);
        } catch (error) {
            console.error('Error calling participant:', error);
        }
    }

    sendParticipantList(conn) {
        const participants = Array.from(this.participants.values()).map(p => ({
            id: p.id,
            peerId: p.peerId,
            name: p.name,
            ip: p.ip,
            isHost: p.isHost
        }));

        conn.send({
            type: 'participant-list',
            participants: participants
        });
    }

    broadcastToParticipants(data) {
        this.dataConnections.forEach((conn, peerId) => {
            if (conn.open && peerId !== this.peer.id) {
                conn.send(data);
            }
        });
    }
    
    async getUserMedia() {
        try {
            const constraints = {
                video: {
                    width: { ideal: 1280 },
                    height: { ideal: 720 },
                    frameRate: { ideal: 30 }
                },
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true
                }
            };
            
            this.localStream = await navigator.mediaDevices.getUserMedia(constraints);
            this.localVideo.srcObject = this.localStream;
            
        } catch (error) {
            console.error('Error accessing media devices:', error);
            throw error;
        }
    }
    
    addParticipant(participant) {
        this.participants.set(participant.id, participant);
        
        if (participant.id !== 'local') {
            this.createVideoTile(participant);
        }
        
        this.updateParticipantsList();
        this.updateParticipantCount();
        this.updateConnectedIps();
    }
    
    createVideoTile(participant) {
        const videoTile = document.createElement('div');
        videoTile.className = 'video-tile fade-in';
        videoTile.id = `video-tile-${participant.id}`;
        
        const video = document.createElement('video');
        video.id = `video-${participant.id}`;
        video.autoplay = true;
        video.playsInline = true;
        
        if (participant.stream) {
            video.srcObject = participant.stream;
        }
        
        const overlay = document.createElement('div');
        overlay.className = 'video-overlay';
        
        const userInfo = document.createElement('div');
        userInfo.className = 'user-info';
        
        const username = document.createElement('span');
        username.className = 'username';
        username.textContent = participant.name + (participant.isHost ? ' (Host)' : '');
        
        const controls = document.createElement('div');
        controls.className = 'video-controls';
        
        const muteBtn = document.createElement('button');
        muteBtn.className = 'control-btn mute-btn';
        muteBtn.innerHTML = '<i class="fas fa-microphone"></i>';
        muteBtn.title = 'Mute/Unmute';
        
        const videoBtn = document.createElement('button');
        videoBtn.className = 'control-btn video-btn';
        videoBtn.innerHTML = '<i class="fas fa-video"></i>';
        videoBtn.title = 'Camera On/Off';
        
        controls.appendChild(muteBtn);
        controls.appendChild(videoBtn);
        
        userInfo.appendChild(username);
        userInfo.appendChild(controls);
        overlay.appendChild(userInfo);
        
        videoTile.appendChild(video);
        videoTile.appendChild(overlay);
        
        this.videoGrid.appendChild(videoTile);
    }

    updateVideoTile(participantId, stream) {
        const videoElement = document.getElementById(`video-${participantId}`);
        if (videoElement) {
            videoElement.srcObject = stream;
        }
    }
    
    updateParticipantsList() {
        this.participantsList.innerHTML = '';
        
        this.participants.forEach(participant => {
            const participantItem = document.createElement('div');
            participantItem.className = 'participant-item fade-in';
            
            const avatar = document.createElement('div');
            avatar.className = 'participant-avatar';
            avatar.textContent = participant.name.charAt(0).toUpperCase();
            
            const info = document.createElement('div');
            info.className = 'participant-info';
            
            const name = document.createElement('div');
            name.className = 'participant-name';
            name.textContent = participant.name + (participant.isHost ? ' (Host)' : '');
            
            const ip = document.createElement('div');
            ip.className = 'participant-ip';
            ip.textContent = participant.ip;
            
            info.appendChild(name);
            info.appendChild(ip);
            
            const status = document.createElement('div');
            status.className = 'participant-status';
            
            const mutedIcon = document.createElement('div');
            mutedIcon.className = 'status-icon status-muted';
            mutedIcon.innerHTML = '<i class="fas fa-microphone-slash"></i>';
            mutedIcon.style.display = participant.muted ? 'flex' : 'none';
            
            const videoOffIcon = document.createElement('div');
            videoOffIcon.className = 'status-icon status-video-off';
            videoOffIcon.innerHTML = '<i class="fas fa-video-slash"></i>';
            videoOffIcon.style.display = !participant.videoOn ? 'flex' : 'none';
            
            status.appendChild(mutedIcon);
            status.appendChild(videoOffIcon);
            
            participantItem.appendChild(avatar);
            participantItem.appendChild(info);
            participantItem.appendChild(status);
            
            this.participantsList.appendChild(participantItem);
        });
    }
    
    updateParticipantCount() {
        this.participantCount.textContent = this.participants.size;
    }

    updateConnectedIps() {
        if (!this.connectedIpsEl) return;
        const ips = [];
        this.participants.forEach(p => {
            if (p && p.ip && p.ip !== 'Unknown') {
                ips.push(p.ip);
            }
        });
        const uniqueIps = Array.from(new Set(ips));
        this.connectedIpsEl.textContent = uniqueIps.length ? `IPs: ${uniqueIps.join(', ')}` : 'IPs: -';
    }
    
    toggleMute() {
        this.isMuted = !this.isMuted;
        
        if (this.localStream) {
            this.localStream.getAudioTracks().forEach(track => {
                track.enabled = !this.isMuted;
            });
        }
        
        this.updateMuteButton();
        this.updateLocalMuteButton();
        
        // Update participant status
        const localParticipant = this.participants.get('local');
        if (localParticipant) {
            localParticipant.muted = this.isMuted;
            this.updateParticipantsList();
        }
    }
    
    toggleVideo() {
        this.isVideoOn = !this.isVideoOn;
        
        if (this.localStream) {
            this.localStream.getVideoTracks().forEach(track => {
                track.enabled = this.isVideoOn;
            });
        }
        
        this.updateVideoButton();
        this.updateLocalVideoButton();
        
        // Update participant status
        const localParticipant = this.participants.get('local');
        if (localParticipant) {
            localParticipant.videoOn = this.isVideoOn;
            this.updateParticipantsList();
        }
    }
    
    async toggleScreenShare() {
        if (this.isScreenSharing) {
            await this.stopScreenShare();
        } else {
            await this.startScreenShare();
        }
    }
    
    async startScreenShare() {
        try {
            const screenStream = await navigator.mediaDevices.getDisplayMedia({
                video: true,
                audio: true
            });
            
            // Replace video track in local stream
            const videoTrack = screenStream.getVideoTracks()[0];
            const sender = this.localStream.getVideoTracks()[0];
            
            if (sender) {
                this.localStream.removeTrack(sender);
            }
            
            this.localStream.addTrack(videoTrack);
            this.localVideo.srcObject = this.localStream;
            
            this.isScreenSharing = true;
            this.updateShareButton();
            
            // Update all active calls with new stream
            this.connections.forEach(call => {
                const sender = call.peerConnection.getSenders().find(s => 
                    s.track && s.track.kind === 'video'
                );
                if (sender) {
                    sender.replaceTrack(videoTrack);
                }
            });
            
            // Handle screen share end
            videoTrack.onended = () => {
                this.stopScreenShare();
            };
            
        } catch (error) {
            console.error('Error starting screen share:', error);
        }
    }
    
    async stopScreenShare() {
        try {
            // Get camera stream back
            const cameraStream = await navigator.mediaDevices.getUserMedia({
                video: true,
                audio: false
            });
            
            // Replace screen share track with camera track
            const videoTrack = cameraStream.getVideoTracks()[0];
            const sender = this.localStream.getVideoTracks()[0];
            
            if (sender) {
                this.localStream.removeTrack(sender);
            }
            
            this.localStream.addTrack(videoTrack);
            this.localVideo.srcObject = this.localStream;
            
            this.isScreenSharing = false;
            this.updateShareButton();
            
            // Update all active calls with camera stream
            this.connections.forEach(call => {
                const sender = call.peerConnection.getSenders().find(s => 
                    s.track && s.track.kind === 'video'
                );
                if (sender) {
                    sender.replaceTrack(videoTrack);
                }
            });
            
        } catch (error) {
            console.error('Error stopping screen share:', error);
        }
    }
    
    updateMuteButton() {
        const icon = this.muteBtn.querySelector('i');
        if (this.isMuted) {
            this.muteBtn.classList.add('active', 'muted');
            icon.className = 'fas fa-microphone-slash';
        } else {
            this.muteBtn.classList.remove('active', 'muted');
            icon.className = 'fas fa-microphone';
        }
    }
    
    updateVideoButton() {
        const icon = this.videoBtn.querySelector('i');
        if (!this.isVideoOn) {
            this.videoBtn.classList.add('active', 'video-off');
            icon.className = 'fas fa-video-slash';
        } else {
            this.videoBtn.classList.remove('active', 'video-off');
            icon.className = 'fas fa-video';
        }
    }
    
    updateShareButton() {
        if (this.isScreenSharing) {
            this.shareBtn.classList.add('active');
        } else {
            this.shareBtn.classList.remove('active');
        }
    }
    
    updateLocalMuteButton() {
        const icon = document.getElementById('local-mute').querySelector('i');
        if (this.isMuted) {
            document.getElementById('local-mute').classList.add('active', 'muted');
            icon.className = 'fas fa-microphone-slash';
        } else {
            document.getElementById('local-mute').classList.remove('active', 'muted');
            icon.className = 'fas fa-microphone';
        }
    }
    
    updateLocalVideoButton() {
        const icon = document.getElementById('local-video-toggle').querySelector('i');
        if (!this.isVideoOn) {
            document.getElementById('local-video-toggle').classList.add('active', 'video-off');
            icon.className = 'fas fa-video-slash';
        } else {
            document.getElementById('local-video-toggle').classList.remove('active', 'video-off');
            icon.className = 'fas fa-video';
        }
    }
    
    toggleParticipants() {
        this.participantsSidebar.classList.toggle('open');
        this.videoGrid.classList.toggle('sidebar-open');
    }
    
    closeParticipants() {
        this.participantsSidebar.classList.remove('open');
        this.videoGrid.classList.remove('sidebar-open');
    }
    
    toggleChat() {
        this.chatPanel.classList.toggle('open');
    }
    
    closeChatPanel() {
        this.chatPanel.classList.remove('open');
    }
    
    sendChatMessage() {
        const message = this.chatInput.value.trim();
        if (message) {
            // Add to local chat
            this.addChatMessage(this.meetingData.username, message);

            // Broadcast to all connected participants
            this.broadcastToParticipants({
                type: 'chat-message',
                username: this.meetingData.username,
                message: message,
                timestamp: new Date().toISOString()
            });

            this.chatInput.value = '';
        }
    }
    
    addChatMessage(sender, content) {
        const messageDiv = document.createElement('div');
        messageDiv.className = 'chat-message fade-in';
        
        const header = document.createElement('div');
        header.className = 'message-header';
        
        const senderSpan = document.createElement('span');
        senderSpan.className = 'message-sender';
        senderSpan.textContent = sender;
        
        const timeSpan = document.createElement('span');
        timeSpan.className = 'message-time';
        timeSpan.textContent = new Date().toLocaleTimeString();
        
        header.appendChild(senderSpan);
        header.appendChild(timeSpan);
        
        const contentDiv = document.createElement('div');
        contentDiv.className = 'message-content';
        contentDiv.textContent = content;
        
        messageDiv.appendChild(header);
        messageDiv.appendChild(contentDiv);
        
        this.chatMessages.appendChild(messageDiv);
        this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
    }
    
    endMeeting() {
        // Close all PeerJS connections
        if (this.peer && !this.peer.destroyed) {
            this.peer.destroy();
        }

        this.connections.forEach(call => {
            call.close();
        });

        this.dataConnections.forEach(conn => {
            conn.close();
        });
        
        // Stop all tracks
        if (this.localStream) {
            this.localStream.getTracks().forEach(track => track.stop());
        }
        
        // Clear data
        this.remoteStreams.clear();
        this.participants.clear();
        this.connections.clear();
        this.dataConnections.clear();
        this.participantConnections.clear();
        
        // Redirect to home
        localStorage.removeItem('meetingData');
        window.location.href = 'index.html';
    }
    
    handlePageHidden() {
        // Pause video when page is hidden to save bandwidth
        if (this.localStream) {
            this.localStream.getVideoTracks().forEach(track => {
                track.enabled = false;
            });
        }
    }
    
    handlePageVisible() {
        // Resume video when page is visible
        if (this.localStream && this.isVideoOn) {
            this.localStream.getVideoTracks().forEach(track => {
                track.enabled = true;
            });
        }
    }
    
    // Method to handle participants leaving
    handleParticipantLeave(participantId) {
        console.log('Participant leaving:', participantId);
        
        // Remove from participants map
        this.participants.delete(participantId);
        
        // Remove video tile
        const videoTile = document.getElementById(`video-tile-${participantId}`);
        if (videoTile) {
            videoTile.remove();
        }
        
        // Remove connections
        this.connections.delete(participantId);
        this.dataConnections.delete(participantId);
        this.participantConnections.delete(participantId);
        
        // Update UI
        this.updateParticipantsList();
        this.updateParticipantCount();
        this.updateConnectedIps();
    }
}

// Copy to clipboard function
function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
        const button = event.target.closest('.copy-btn');
        const originalIcon = button.innerHTML;
        button.innerHTML = '<i class="fas fa-check"></i>';
        button.style.background = '#4CAF50';
        
        setTimeout(() => {
            button.innerHTML = originalIcon;
            button.style.background = '';
        }, 2000);
    }).catch(err => {
        console.error('Failed to copy: ', err);
        alert('Failed to copy to clipboard');
    });
}

// Initialize the meeting room when the page loads
document.addEventListener('DOMContentLoaded', () => {
    new MeetingRoom();
});