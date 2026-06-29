const video = document.getElementById("video");
const canvas = document.getElementById("canvas");
const result = document.getElementById("result");
const faceCount = document.getElementById("faceCount");

const context = canvas.getContext("2d");

// ==========================
// Mengaktifkan Webcam
// ==========================
navigator.mediaDevices.getUserMedia({
    video: true
})
.then(stream => {
    video.srcObject = stream;
})
.catch(error => {
    console.error(error);
});

// ==========================
// Mengirim Frame ke Flask
// ==========================
async function detectSmile() {

    context.drawImage(
        video,
        0,
        0,
        canvas.width,
        canvas.height
    );

    canvas.toBlob(async function(blob){

        const formData = new FormData();

        formData.append(
            "image",
            blob,
            "frame.jpg"
        );

        try{

            const response = await fetch("/predict",{

                method:"POST",

                body:formData

            });

            const data = await response.json();

            result.innerHTML = data.result;

            if(data.faces !== undefined){

                faceCount.innerHTML =
                    "Jumlah Wajah : " + data.faces;

            }

        }

        catch(error){

            console.log(error);

        }

    },"image/jpeg");

}

// ==========================
// Jalankan setiap 200 ms
// ==========================
setInterval(detectSmile,200);