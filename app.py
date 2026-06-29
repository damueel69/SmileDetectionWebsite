from flask import Flask, render_template, request, jsonify
import cv2
import numpy as np
import os
import base64
import logging

app = Flask(__name__)

# ==========================================
# PATH
# ==========================================
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# ==========================================
# LOAD HAAR CASCADE
# ==========================================
CASCADE_PATH = os.path.join(BASE_DIR, "haarcascade_frontalface_default.xml")

# Download jika tidak ada
if not os.path.exists(CASCADE_PATH):
    import urllib.request
    url = "https://raw.githubusercontent.com/opencv/opencv/master/data/haarcascades/haarcascade_frontalface_default.xml"
    urllib.request.urlretrieve(url, CASCADE_PATH)
    print("✅ Haar Cascade downloaded")

face_cascade = cv2.CascadeClassifier(CASCADE_PATH)

# ==========================================
# SIMPLE SMILE DETECTION
# ==========================================
def detect_smile_simple(face):
    try:
        hsv = cv2.cvtColor(face, cv2.COLOR_BGR2HSV)
        
        lower_skin = np.array([0, 48, 80], dtype=np.uint8)
        upper_skin = np.array([20, 255, 255], dtype=np.uint8)
        mask = cv2.inRange(hsv, lower_skin, upper_skin)
        
        skin_area = cv2.countNonZero(mask)
        total_area = face.shape[0] * face.shape[1]
        skin_ratio = skin_area / total_area
        
        height, width = face.shape[:2]
        mouth_y_start = int(height * 0.6)
        mouth_y_end = height
        mouth_x_start = int(width * 0.2)
        mouth_x_end = int(width * 0.8)
        
        mouth_roi = face[mouth_y_start:mouth_y_end, mouth_x_start:mouth_x_end]
        
        if mouth_roi.size > 0:
            hsv_mouth = cv2.cvtColor(mouth_roi, cv2.COLOR_BGR2HSV)
            mask_mouth = cv2.inRange(hsv_mouth, lower_skin, upper_skin)
            mouth_ratio = cv2.countNonZero(mask_mouth) / (mouth_roi.shape[0] * mouth_roi.shape[1])
        else:
            mouth_ratio = 0
        
        if skin_ratio > 0.35 and mouth_ratio > 0.3:
            confidence = min(70 + (skin_ratio + mouth_ratio) * 20, 95)
            return "Smile 😊", round(confidence, 2)
        elif skin_ratio > 0.25 and mouth_ratio > 0.2:
            confidence = min(55 + (skin_ratio + mouth_ratio) * 25, 80)
            return "Possible Smile 🙂", round(confidence, 2)
        else:
            confidence = min(50 + (0.5 - skin_ratio) * 40, 85)
            return "Non Smile 😐", round(confidence, 2)
            
    except Exception as e:
        print(f"Error in detection: {e}")
        return "Non Smile 😐", 50.0

# ==========================================
# ROUTE
# ==========================================
@app.route("/")
def index():
    return render_template("index.html")

# ==========================================
# PREDICT
# ==========================================
@app.route("/predict", methods=["POST"])
def predict():
    image = request.files.get("image")
    if image is None:
        return jsonify({
            "status": "error",
            "message": "Tidak ada gambar."
        })

    try:
        image_bytes = image.read()
        np_array = np.frombuffer(image_bytes, np.uint8)
        frame = cv2.imdecode(np_array, cv2.IMREAD_COLOR)
        
        if frame is None:
            return jsonify({
                "status": "error",
                "message": "Gambar tidak valid"
            })
        
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        faces = face_cascade.detectMultiScale(
            gray, 
            scaleFactor=1.1,
            minNeighbors=5, 
            minSize=(60,60)
        )

        if len(faces) == 0:
            return jsonify({
                "status": "success",
                "faces": 0,
                "face_results": []
            })

        face_results = []
        
        for idx, (x, y, w, h) in enumerate(faces):
            face = frame[y:y+h, x:x+w]
            result_text, confidence = detect_smile_simple(face)
            
            if "Smile" in result_text:
                status = "smile"
            elif "Possible" in result_text:
                status = "possible"
            else:
                status = "non_smile"
            
            face_rgb = cv2.cvtColor(face, cv2.COLOR_BGR2RGB)
            face_thumbnail = cv2.resize(face_rgb, (120, 120))
            
            if status == "smile":
                border_color = (0, 255, 0)
            elif status == "possible":
                border_color = (255, 255, 0)
            else:
                border_color = (0, 0, 255)
                
            face_thumbnail_with_border = cv2.copyMakeBorder(
                face_thumbnail, 
                5, 5, 5, 5, 
                cv2.BORDER_CONSTANT, 
                value=border_color
            )
            
            _, buffer = cv2.imencode('.jpg', cv2.cvtColor(face_thumbnail_with_border, cv2.COLOR_RGB2BGR))
            thumbnail_base64 = base64.b64encode(buffer).decode('utf-8')
            
            face_results.append({
                "face_id": idx + 1,
                "result": result_text,
                "status": status,
                "confidence": confidence,
                "thumbnail": thumbnail_base64
            })
        
        total_smile = sum(1 for f in face_results if f["status"] == "smile")
        total_possible = sum(1 for f in face_results if f["status"] == "possible")
        
        return jsonify({
            "status": "success",
            "faces": len(faces),
            "total_smile": total_smile,
            "total_possible": total_possible,
            "face_results": face_results
        })
        
    except Exception as e:
        print(f"Error in predict: {e}")
        return jsonify({
            "status": "error",
            "message": str(e)
        })

# ==========================================
# MAIN
# ==========================================
if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(debug=False, host='0.0.0.0', port=port)