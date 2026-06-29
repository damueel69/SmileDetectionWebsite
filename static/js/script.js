const video = document.getElementById("video");
const canvas = document.getElementById("canvas");
const result = document.getElementById("result");
const faceCount = document.getElementById("faceCount");
const faceResults = document.getElementById("faceResults");
const context = canvas.getContext("2d");

// Cache untuk menyimpan elemen DOM thumbnail
let faceElements = new Map();

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
    result.innerHTML = "Gagal mengakses webcam!";
    faceResults.innerHTML = `<div class="no-face">Webcam tidak tersedia</div>`;
});

// ==========================
// Update atau Buat Elemen Face
// ==========================
function updateFaceElement(faceData) {
    const faceKey = faceData.face_key || `face_${faceData.face_id}`;
    
    // Cek apakah elemen sudah ada
    let element = faceElements.get(faceKey);
    
    if (!element) {
        // Buat elemen baru jika belum ada
        element = document.createElement('div');
        element.className = 'face-item';
        element.dataset.faceKey = faceKey;
        
        // Struktur HTML
        element.innerHTML = `
            <img src="data:image/jpeg;base64,${faceData.thumbnail}" 
                 alt="Face ${faceData.face_id}" 
                 class="face-thumbnail">
            <div class="face-info">
                <div class="face-id">Wajah ${faceData.face_id}</div>
                <div class="face-result ${faceData.status}">${faceData.result}</div>
                <div class="face-confidence">
                    Confidence: ${faceData.confidence}%
                    <div class="bar" style="width: ${faceData.confidence}%; background: ${faceData.status === 'smile' ? '#28a745' : '#dc3545'};"></div>
                </div>
            </div>
        `;
        
        // Simpan di cache
        faceElements.set(faceKey, element);
        faceResults.appendChild(element);
    } else {
        // Update elemen yang sudah ada (tanpa mengganti thumbnail)
        const faceId = element.querySelector('.face-id');
        const faceResult = element.querySelector('.face-result');
        const faceConfidence = element.querySelector('.face-confidence');
        const confidenceBar = element.querySelector('.bar');
        
        // Update teks saja, tanpa mengubah gambar
        if (faceId) faceId.textContent = `Wajah ${faceData.face_id}`;
        
        // Update status dan hasil dengan transisi halus
        if (faceResult) {
            faceResult.textContent = faceData.result;
            faceResult.className = `face-result ${faceData.status}`;
            // Tambahkan animasi halus
            faceResult.classList.add('status-update');
            setTimeout(() => {
                faceResult.classList.remove('status-update');
            }, 300);
        }
        
        // Update confidence
        if (faceConfidence) {
            faceConfidence.innerHTML = `
                Confidence: ${faceData.confidence}%
                <div class="bar" style="width: ${faceData.confidence}%; background: ${faceData.status === 'smile' ? '#28a745' : '#dc3545'};"></div>
            `;
        }
    }
    
    return element;
}

// ==========================
// Hapus elemen yang tidak terpakai
// ==========================
function cleanupFaceElements(currentKeys) {
    const keysToRemove = [];
    for (const [key, element] of faceElements) {
        if (!currentKeys.includes(key)) {
            if (element.parentNode) {
                element.parentNode.removeChild(element);
            }
            keysToRemove.push(key);
        }
    }
    keysToRemove.forEach(key => faceElements.delete(key));
}

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
                if (data.faces === 0) {
                    faceCount.innerHTML = `Jumlah Wajah: 0`;
                } else {
                    faceCount.innerHTML = `Jumlah Wajah: ${data.faces}`;
                }
            }
            
            // Update hasil deteksi dengan thumbnail
            if (data.face_results && data.face_results.length > 0) {
                // Kumpulkan semua face keys
                const currentKeys = data.face_results.map(f => f.face_key || `face_${f.face_id}`);
                
                // Update atau buat elemen untuk setiap wajah
                data.face_results.forEach(faceData => {
                    updateFaceElement(faceData);
                });
                
                // Hapus elemen yang tidak terpakai
                cleanupFaceElements(currentKeys);
                
                // Tampilkan ringkasan di result box
                const smileCount = data.total_smile || 0;
                const totalFaces = data.faces;
                
                if (smileCount === totalFaces && totalFaces > 0) {
                    result.innerHTML = `Semua ${totalFaces} wajah tersenyum`;
                    result.style.backgroundColor = '#d4edda';
                    result.style.color = '#155724';
                } else if (smileCount > 0) {
                    result.innerHTML = `${smileCount} dari ${totalFaces} wajah tersenyum`;
                    result.style.backgroundColor = '#fff3cd';
                    result.style.color = '#856404';
                } else if (totalFaces > 0) {
                    result.innerHTML = `Tidak ada yang tersenyum dari ${totalFaces} wajah`;
                    result.style.backgroundColor = '#f8d7da';
                    result.style.color = '#721c24';
                }
            } else {
                // Bersihkan semua elemen jika tidak ada wajah
                cleanupFaceElements([]);
                // Kosongkan faceResults tanpa menampilkan teks apapun
                faceResults.innerHTML = '';
                // Kosongkan result tanpa menampilkan teks apapun
                result.innerHTML = '';
                // Reset style result
                result.style.backgroundColor = 'transparent';
                result.style.color = '#6c757d';
            }
            
        } catch(error) {
            console.error("Error:", error);
            result.innerHTML = "Error saat memproses gambar";
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
    // Initial state - kosongkan semua
    faceResults.innerHTML = '';
    result.innerHTML = 'Menunggu deteksi...';
    faceCount.innerHTML = 'Jumlah Wajah: 0';
});