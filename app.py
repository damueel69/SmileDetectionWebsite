from flask import Flask, render_template, request, jsonify
import cv2
import numpy as np
import os
from tensorflow.keras.models import load_model
from tensorflow.keras.applications.mobilenet_v2 import preprocess_input
import base64

app = Flask(__name__)

# ==========================================
# PATH
# ==========================================
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# ==========================================
# LOAD MODEL
# ==========================================
MODEL_PATH = os.path.join(BASE_DIR, "smile_model.keras")
model = load_model(MODEL_PATH)
print("Model berhasil dimuat")

# ==========================================
# LOAD HAAR CASCADE
# ==========================================
CASCADE_PATH = os.path.join(
    BASE_DIR, "haarcascade_frontalface_default.xml"
)
face_cascade = cv2.CascadeClassifier(CASCADE_PATH)
if face_cascade.empty():
    raise Exception("Haar Cascade gagal dimuat!")

# Cache untuk menyimpan thumbnail per wajah (face_id sebagai key)
thumbnail_cache = {}

# ==========================================
# ROUTE
# ==========================================
@app.route("/")
def index():
    return render_template("index.html")

# ==========================================
# PREDICT - MULTIPLE FACES WITH THUMBNAILS
# ==========================================
@app.route("/predict", methods=["POST"])
def predict():
    global thumbnail_cache
    
    image = request.files.get("image")
    if image is None:
        return jsonify({
            "status": "error",
            "message": "Tidak ada gambar."
        })

    image_bytes = image.read()
    np_array = np.frombuffer(image_bytes, np.uint8)
    frame = cv2.imdecode(np_array, cv2.IMREAD_COLOR)
    
    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    faces = face_cascade.detectMultiScale(
        gray, 
        scaleFactor=1.2, 
        minNeighbors=5, 
        minSize=(60,60)
    )

    if len(faces) == 0:
        # Reset cache jika tidak ada wajah
        thumbnail_cache = {}
        return jsonify({
            "status": "success",
            "faces": 0,
            "result": "Tidak ada wajah",
            "face_results": []
        })

    # Array untuk menyimpan hasil per wajah
    face_results = []
    
    # Proses setiap wajah
    for idx, (x, y, w, h) in enumerate(faces):
        # Ekstrak wajah
        face = frame[y:y+h, x:x+w]
        
        # Convert ke RGB untuk display
        face_rgb = cv2.cvtColor(face, cv2.COLOR_BGR2RGB)
        
        # Resize untuk prediksi (224x224)
        face_resized = cv2.resize(face_rgb, (224, 224))
        face_normalized = np.array(face_resized, dtype=np.float32)
        face_preprocessed = preprocess_input(face_normalized)
        face_preprocessed = np.expand_dims(face_preprocessed, axis=0)
        
        # Prediksi
        prediction = model.predict(face_preprocessed, verbose=0)[0][0]
        confidence = float(prediction)
        
        if confidence >= 0.5:
            result_text = "Smile 😊"
            confidence_percent = confidence * 100
            status = "smile"
        else:
            result_text = "Non Smile 😐"
            confidence_percent = (1 - confidence) * 100
            status = "non_smile"
        
        # Generate unique key untuk cache berdasarkan posisi wajah
        face_key = f"{x}_{y}_{w}_{h}"
        
        # Cek apakah thumbnail sudah ada di cache
        if face_key not in thumbnail_cache:
            # Buat thumbnail hanya jika belum ada di cache
            face_thumbnail = cv2.resize(face_rgb, (120, 120))
            border_color = (0, 255, 0) if result_text == "Smile 😊" else (0, 0, 255)
            face_thumbnail_with_border = cv2.copyMakeBorder(
                face_thumbnail, 
                5, 5, 5, 5, 
                cv2.BORDER_CONSTANT, 
                value=border_color
            )
            _, buffer = cv2.imencode('.jpg', cv2.cvtColor(face_thumbnail_with_border, cv2.COLOR_RGB2BGR))
            thumbnail_base64 = base64.b64encode(buffer).decode('utf-8')
            
            # Simpan di cache
            thumbnail_cache[face_key] = thumbnail_base64
        
        # Ambil thumbnail dari cache
        thumbnail_base64 = thumbnail_cache[face_key]
        
        # Simpan hasil per wajah
        face_results.append({
            "face_id": idx + 1,
            "face_key": face_key,
            "result": result_text,
            "status": status,
            "confidence": round(confidence_percent, 2),
            "thumbnail": thumbnail_base64,
            "position": {"x": int(x), "y": int(y), "w": int(w), "h": int(h)}
        })
    
    # Bersihkan cache yang tidak terpakai
    current_keys = [f["face_key"] for f in face_results]
    keys_to_remove = [k for k in thumbnail_cache.keys() if k not in current_keys]
    for k in keys_to_remove:
        del thumbnail_cache[k]
    
    # Hitung total smile
    total_smile = sum(1 for f in face_results if f["status"] == "smile")
    
    return jsonify({
        "status": "success",
        "faces": len(faces),
        "total_smile": total_smile,
        "face_results": face_results
    })

# ==========================================
# MAIN
# ==========================================
if __name__ == "__main__":
    app.run(debug=True, host='0.0.0.0', port=5000)