const video = document.getElementById("video");
const canvas = document.getElementById("canvas");
const result = document.getElementById("result");
const faceCount = document.getElementById("faceCount");
const faceResults = document.getElementById("faceResults");
const context = canvas.getContext("2d");

// ==========================
// Mengaktifkan Webcam
// ==========================
navigator.mediaDevices.getUserMedia({ 
    video: { 
        width: 640, 
        height: 480,
        facingMode: "user"
    } 
})
.then(stream => {
    video.srcObject = stream;
})
.catch(error => {
    console.error("Error accessing webcam:", error);
    result.innerHTML = "❌ Gagal mengakses webcam!";
    faceResults.innerHTML = `<div class="no-face">❌ Webcam tidak tersedia</div>`;
});

// ==========================
// Mengirim Frame ke Flask
// ==========================
async function detectSmile() {
    // Gambar frame dari video ke canvas
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    canvas.toBlob(async function(blob) {
        const formData = new FormData();
        formData.append("image", blob, "frame.jpg");
        
        try {
            const response = await fetch("/predict", {
                method: "POST",
                body: formData
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            
            // Update jumlah wajah
            if (data.faces !== undefined) {
                faceCount.innerHTML = `👤 Jumlah Wajah: ${data.faces}`;
            }
            
            // Update hasil deteksi dengan thumbnail
            if (data.face_results && data.face_results.length > 0) {
                let html = '';
                data.face_results.forEach(face => {
                    const isSmile = face.result === "Smile 😊";
                    const confidenceBar = face.confidence;
                    
                    html += `
                        <div class="face-item">
                            <img src="data:image/jpeg;base64,${face.thumbnail}" 
                                 alt="Face ${face.face_id}" 
                                 class="face-thumbnail">
                            <div class="face-info">
                                <div class="face-id">👤 Wajah ${face.face_id}</div>
                                <div class="face-result ${isSmile ? 'smile' : 'non-smile'}">
                                    ${face.result}
                                </div>
                                <div class="face-confidence">
                                    Confidence: ${face.confidence}%
                                    <div class="bar" style="
                                        width: ${confidenceBar}%; 
                                        background: ${isSmile ? '#28a745' : '#dc3545'};
                                    "></div>
                                </div>
                            </div>
                        </div>
                    `;
                });
                faceResults.innerHTML = html;
                
                // Tampilkan ringkasan di result box
                const smileCount = data.total_smile || 0;
                const totalFaces = data.faces;
                
                if (smileCount === totalFaces && totalFaces > 0) {
                    result.innerHTML = `😊 Semua ${totalFaces} wajah tersenyum!`;
                } else if (smileCount > 0) {
                    result.innerHTML = `😊 ${smileCount} dari ${totalFaces} wajah tersenyum`;
                } else {
                    result.innerHTML = `😐 Tidak ada yang tersenyum dari ${totalFaces} wajah`;
                }
            } else {
                faceResults.innerHTML = `<div class="no-face">😐 Tidak ada wajah terdeteksi</div>`;
                result.innerHTML = "Tidak ada wajah terdeteksi";
            }
            
        } catch(error) {
            console.error("Error:", error);
            result.innerHTML = "❌ Error saat memproses gambar";
        }
    }, "image/jpeg");
}

// ==========================
// Jalankan setiap 200 ms
// ==========================
setInterval(detectSmile, 200);

// ==========================
// Stop deteksi saat halaman ditutup
// ==========================
window.addEventListener('beforeunload', function() {
    if (video.srcObject) {
        video.srcObject.getTracks().forEach(track => track.stop());
    }
});

// ==========================
// Handle error jika fetch gagal
// ==========================
window.addEventListener('load', function() {
    // Initial state
    faceResults.innerHTML = '<div class="no-face">⏳ Menunggu deteksi...</div>';
});