from flask import Flask, render_template, request, jsonify
import cv2
import numpy as np
import os

from tensorflow.keras.models import load_model
from tensorflow.keras.applications.mobilenet_v2 import preprocess_input

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
    BASE_DIR,
    "haarcascade_frontalface_default.xml"
)

face_cascade = cv2.CascadeClassifier(CASCADE_PATH)

if face_cascade.empty():
    raise Exception("Haar Cascade gagal dimuat!")

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

    image_bytes = image.read()

    np_array = np.frombuffer(
        image_bytes,
        np.uint8
    )

    frame = cv2.imdecode(
        np_array,
        cv2.IMREAD_COLOR
    )

    gray = cv2.cvtColor(
        frame,
        cv2.COLOR_BGR2GRAY
    )

    faces = face_cascade.detectMultiScale(
        gray,
        scaleFactor=1.2,
        minNeighbors=5,
        minSize=(60,60)
    )

    if len(faces) == 0:
        return jsonify({
            "status":"success",
            "faces":0,
            "result":"Tidak ada wajah"
        })

    x,y,w,h = faces[0]

    face = frame[y:y+h, x:x+w]

    face = cv2.cvtColor(
        face,
        cv2.COLOR_BGR2RGB
    )

    face = cv2.resize(
        face,
        (224,224)
    )

    face = np.array(
        face,
        dtype=np.float32
    )

    face = preprocess_input(face)

    face = np.expand_dims(face, axis=0)

    prediction = model.predict(
        face,
        verbose=0
    )[0][0]

    confidence = float(prediction)

    if confidence >= 0.5:
        result = "Smile 😊"
        confidence = confidence*100
    else:
        result = "Non Smile 😐"
        confidence = (1-confidence)*100

    return jsonify({

        "status":"success",

        "faces":len(faces),

        "result":result,

        "confidence":round(confidence,2)

    })


# ==========================================
# MAIN
# ==========================================
if __name__ == "__main__":
    app.run(debug=True)