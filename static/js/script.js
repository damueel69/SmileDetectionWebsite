// DOM Elements
const video = document.getElementById('video');
const canvas = document.getElementById('canvas');
const context = canvas.getContext('2d');
const faceResults = document.getElementById('faceResults');
const faceCountDisplay = document.getElementById('faceCountDisplay');
const smileCountDisplay = document.getElementById('smileCount');
const nonSmileCountDisplay = document.getElementById('nonSmileCount');
const totalFacesBadge = document.getElementById('totalFacesBadge');
const notification = document.getElementById('notification');
const cameraStatus = document.getElementById('cameraStatus');
const videoOverlay = document.getElementById('videoOverlay');
const faceDetectionStatus = document.getElementById('faceDetectionStatus');

let isCameraActive = true;
let detectionInterval = null;
let notificationTimeout = null;
let previousFaces = [];
let animationFrame = null;

// ==========================================
// Webcam Setup
// ==========================================
async function startCamera() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            video: { 
                width: { ideal: 640 },
                height: { ideal: 480 },
                facingMode: 'user'
            }
        });
        video.srcObject = stream;
        isCameraActive = true;
        cameraStatus.className = 'camera-status';
        cameraStatus.textContent = '● Live';
        document.querySelector('.btn-control').classList.remove('off');
        
        showNotification('Camera activated successfully', 'success');
        startDetection();
    } catch (error) {
        console.error('Error accessing webcam:', error);
        showNotification('Failed to access camera', 'warning');
        faceResults.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">⚠️</div>
                <h3>Camera Unavailable</h3>
                <p>Please check your camera permissions</p>
            </div>
        `;
    }
}

function toggleCamera() {
    if (isCameraActive) {
        stopCamera();
    } else {
        startCamera();
    }
}

function stopCamera() {
    if (video.srcObject) {
        video.srcObject.getTracks().forEach(track => track.stop());
        video.srcObject = null;
    }
    isCameraActive = false;
    cameraStatus.className = 'camera-status off';
    cameraStatus.textContent = '● Off';
    document.querySelector('.btn-control').classList.add('off');
    
    if (detectionInterval) {
        clearInterval(detectionInterval);
        detectionInterval = null;
    }
    
    faceResults.innerHTML = `
        <div class="empty-state">
            <div class="empty-icon">📸</div>
            <h3>Camera Off</h3>
            <p>Click the camera button to start</p>
        </div>
    `;
    updateStats(0, 0, 0);
    showNotification('Camera stopped', 'warning');
}

// ==========================================
// Detection Loop
// ==========================================
function startDetection() {
    if (detectionInterval) {
        clearInterval(detectionInterval);
    }
    
    // Set canvas dimensions
    canvas.width = 640;
    canvas.height = 480;
    
    detectionInterval = setInterval(detectFaces, 250);
    showNotification('Detection started', 'success');
}

async function detectFaces() {
    if (!isCameraActive || !video.srcObject) return;
    
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    canvas.toBlob(async function(blob) {
        if (!blob) return;
        
        const formData = new FormData();
        formData.append('image', blob, 'frame.jpg');
        
        try {
            const response = await fetch('/predict', {
                method: 'POST',
                body: formData
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            updateUI(data);
            
        } catch (error) {
            console.error('Detection error:', error);
        }
    }, 'image/jpeg');
}

// ==========================================
// Update UI with smooth transitions
// ==========================================
function updateUI(data) {
    // Update face count with smooth transition
    const faceCount = data.faces || 0;
    animateNumber(faceCountDisplay, parseInt(faceCountDisplay.textContent) || 0, faceCount);
    totalFacesBadge.textContent = `${faceCount} face${faceCount !== 1 ? 's' : ''}`;
    
    // Update detection status
    if (faceCount > 0) {
        faceDetectionStatus.className = 'face-detection-status active';
        faceDetectionStatus.innerHTML = `
            <span class="pulse-dot"></span>
            ${faceCount} face${faceCount !== 1 ? 's' : ''} detected
        `;
        videoOverlay.style.display = 'block';
    } else {
        faceDetectionStatus.className = 'face-detection-status';
        videoOverlay.style.display = 'block';
    }
    
    // Update face results with smooth transitions
    if (data.face_results && data.face_results.length > 0) {
        let html = '';
        let smileCount = 0;
        let nonSmileCount = 0;
        
        data.face_results.forEach((face, index) => {
            const isSmile = face.status === 'smile';
            if (isSmile) smileCount++;
            else nonSmileCount++;
            
            const confidencePercent = face.confidence;
            
            // Check if this face already exists in previous results for smooth transition
            const existingFace = previousFaces.find(f => f.face_id === face.face_id);
            
            html += `
                <div class="face-item" data-face-id="${face.face_id}" style="animation-delay: ${index * 0.05}s">
                    <div class="face-thumbnail-wrapper">
                        <img src="data:image/jpeg;base64,${face.thumbnail}" 
                             alt="Face ${face.face_id}" 
                             class="face-thumbnail ${isSmile ? 'smile' : 'non-smile'} loaded"
                             loading="lazy"
                             onload="this.classList.add('loaded')"
                             onerror="this.classList.add('skeleton')">
                        <div class="face-thumbnail-status ${isSmile ? 'smile' : 'non-smile'} show">
                            ${isSmile ? '😊' : '😐'}
                        </div>
                    </div>
                    <div class="face-info">
                        <div class="face-id">Face #${face.face_id}</div>
                        <div class="face-result ${isSmile ? 'smile' : 'non-smile'}">
                            ${isSmile ? '😊 Smile!' : '😐 Not Smiling'}
                        </div>
                        <div class="face-confidence">
                            <span>${confidencePercent.toFixed(1)}% confidence</span>
                            <div class="bar-track">
                                <div class="bar ${isSmile ? 'smile' : 'non-smile'}" 
                                     style="width: ${confidencePercent}%"></div>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        });
        
        faceResults.innerHTML = html;
        
        // Update stats with animation
        animateNumber(smileCountDisplay, parseInt(smileCountDisplay.textContent) || 0, smileCount);
        animateNumber(nonSmileCountDisplay, parseInt(nonSmileCountDisplay.textContent) || 0, nonSmileCount);
        
        // Store current faces for future comparison
        previousFaces = data.face_results;
    } else {
        faceResults.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">🔍</div>
                <h3>No Faces Detected</h3>
                <p>Position yourself in front of the camera</p>
            </div>
        `;
        updateStats(0, 0, 0);
        previousFaces = [];
    }
}

// ==========================================
// Animation Helpers
// ==========================================
function animateNumber(element, start, end) {
    if (start === end) return;
    
    const duration = 500;
    const startTime = performance.now();
    
    function update(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        // Ease out cubic
        const eased = 1 - Math.pow(1 - progress, 3);
        const current = Math.round(start + (end - start) * eased);
        
        element.textContent = current;
        
        if (progress < 1) {
            requestAnimationFrame(update);
        }
    }
    
    requestAnimationFrame(update);
}

function updateStats(total, smile, nonSmile) {
    animateNumber(smileCountDisplay, parseInt(smileCountDisplay.textContent) || 0, smile);
    animateNumber(nonSmileCountDisplay, parseInt(nonSmileCountDisplay.textContent) || 0, nonSmile);
}

// ==========================================
// Notification System
// ==========================================
function showNotification(message, type = 'success') {
    if (notificationTimeout) {
        clearTimeout(notificationTimeout);
    }
    
    notification.textContent = message;
    notification.className = `notification ${type}`;
    
    // Trigger reflow to restart animation
    void notification.offsetWidth;
    
    notification.classList.add('show');
    
    notificationTimeout = setTimeout(() => {
        notification.classList.remove('show');
    }, 3000);
}

// ==========================================
// Image load handler for thumbnails
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    // Add skeleton loading for images
    const images = document.querySelectorAll('.face-thumbnail');
    images.forEach(img => {
        img.classList.add('skeleton');
        img.addEventListener('load', function() {
            this.classList.remove('skeleton');
            this.classList.add('loaded');
        });
        img.addEventListener('error', function() {
            this.classList.remove('skeleton');
            this.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 80 80"%3E%3Crect width="80" height="80" fill="%23222222"/%3E%3Ctext x="40" y="45" text-anchor="middle" fill="%23666666" font-size="14" font-family="Arial"%3E👤%3C/text%3E%3C/svg%3E';
        });
    });
});

// ==========================================
// Initialization
// ==========================================
window.addEventListener('load', () => {
    startCamera();
});

window.addEventListener('beforeunload', () => {
    if (detectionInterval) {
        clearInterval(detectionInterval);
    }
    if (video.srcObject) {
        video.srcObject.getTracks().forEach(track => track.stop());
    }
});

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
    if (e.key === ' ' || e.key === 'Space') {
        e.preventDefault();
        toggleCamera();
    }
});