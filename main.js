window.onload = () => {
    'use strict';

    if ('serviceWorker' in navigator) {
        navigator.serviceWorker
            .register('./sw.js');
    }
    camStart();
}

// Override the function with all the posibilities
navigator.getUserMedia ||
    (navigator.getUserMedia = navigator.mozGetUserMedia ||
        navigator.webkitGetUserMedia || navigator.msGetUserMedia);

var gl;
var canvas;
var colourF = [1., 1., 1.];
var colourB = [.5, .5, .5];
var Param1 = 0.0;
var Param2 = 0.0;
var Param3 = 0.0;
var Param4 = 0.0;
var mouseX = 0.5;
var mouseY = 0.5;
var colPick;

function initGL() {
    try {
        gl = canvas.getContext("experimental-webgl");
    } catch (e) {}
    if (!gl) {
        alert("Could not initialise WebGL, sorry :-(");
    }
}


function getShader(gl, id) {
    var shaderScript = document.getElementById(id);
    if (!shaderScript) {
        return null;
    }

    var str = "";
    var k = shaderScript.firstChild;
    while (k) {
        if (k.nodeType == 3) {
            str += k.textContent;
        }
        k = k.nextSibling;
    }

    var shader;
    if (shaderScript.type == "f") {
        shader = gl.createShader(gl.FRAGMENT_SHADER);
    } else if (shaderScript.type == "v") {
        shader = gl.createShader(gl.VERTEX_SHADER);
    } else {
        return null;
    }

    gl.shaderSource(shader, str);
    gl.compileShader(shader);

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        alert(gl.getShaderInfoLog(shader));
        return null;
    }

    return shader;
}

var programsArray = new Array();
var current_program;

function initShaders() {
    programsArray.push(createProgram("shader-vs", "shader-1-fs"));
    current_program = programsArray[0];
}

function createProgram(vertexShaderId, fragmentShaderId) {
    var shaderProgram;
    var fragmentShader = getShader(gl, fragmentShaderId);
    var vertexShader = getShader(gl, vertexShaderId);

    shaderProgram = gl.createProgram();
    gl.attachShader(shaderProgram, vertexShader);
    gl.attachShader(shaderProgram, fragmentShader);
    gl.linkProgram(shaderProgram);

    if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
        alert("Could not initialise shaders");
    }

    gl.useProgram(shaderProgram);

    shaderProgram.vertexPositionAttribute = gl.getAttribLocation(shaderProgram, "aVertexPosition");
    gl.enableVertexAttribArray(shaderProgram.vertexPositionAttribute);

    shaderProgram.textureCoordAttribute = gl.getAttribLocation(shaderProgram, "aTextureCoord");
    gl.enableVertexAttribArray(shaderProgram.textureCoordAttribute);

    shaderProgram.pMatrixUniform = gl.getUniformLocation(shaderProgram, "uPMatrix");
    shaderProgram.mvMatrixUniform = gl.getUniformLocation(shaderProgram, "uMVMatrix");
    shaderProgram.samplerUniform = gl.getUniformLocation(shaderProgram, "texture0");
    shaderProgram.resolutionUniform = gl.getUniformLocation(shaderProgram, "resolution");
    shaderProgram.mouse = gl.getUniformLocation(shaderProgram, "mouse");
    shaderProgram.indexUniform = gl.getUniformLocation(shaderProgram, "index");
    shaderProgram.time = gl.getUniformLocation(shaderProgram, "time");
    shaderProgram.Param1 = gl.getUniformLocation(shaderProgram, "Param1");
    shaderProgram.Param2 = gl.getUniformLocation(shaderProgram, "Param2");
    shaderProgram.Param3 = gl.getUniformLocation(shaderProgram, "Param3");
    shaderProgram.Param4 = gl.getUniformLocation(shaderProgram, "Param4");
    return shaderProgram;
}

var webcam;
var texture;

function initTexture() {
    texture = gl.createTexture();
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.bindTexture(gl.TEXTURE_2D, null);
}

var mvMatrix = mat4.create();
var mvMatrixStack = [];
var pMatrix = mat4.create();

function mvPushMatrix() {
    var copy = mat4.create();
    mat4.set(mvMatrix, copy);
    mvMatrixStack.push(copy);
}

function mvPopMatrix() {
    if (mvMatrixStack.length == 0) {
        throw "Invalid popMatrix!";
    }
    mvMatrix = mvMatrixStack.pop();
}

var ix = 0;
var frame_num = 0.0;
var end;
var st = new Date().getTime();

function setUniforms() {
    end = new Date().getTime();
    gl.uniformMatrix4fv(current_program.pMatrixUniform, false, pMatrix);
    gl.uniformMatrix4fv(current_program.mvMatrixUniform, false, mvMatrix);
    gl.uniform2f(current_program.resolutionUniform, canvas.width, canvas.height);
    gl.uniform2f(current_program.mouse, mouseX, mouseY);
    gl.uniform1i(current_program.indexUniform, ix);
    //        gl.uniform1f(current_program.time, performance.now()/1000.0);
    gl.uniform1f(current_program.time, ((end - st) % 1000000) / 1000.0);
    gl.uniform3fv(current_program.Param1, [colourF[0], colourF[1], colourF[2]]);
    gl.uniform3fv(current_program.Param2, [colourB[0], colourB[1], colourB[2]]);
    gl.uniform1f(current_program.Param3, Param3);
    gl.uniform1f(current_program.Param4, Param4);
}

var cubeVertexPositionBuffer;
var cubeVertexTextureCoordBuffer;
var cubeVertexIndexBuffer;

function initBuffers() {
    cubeVertexPositionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, cubeVertexPositionBuffer);
    vertices = [-1.0, -1.0, 1.0, -1.0, 1.0, 1.0, -1.0, 1.0];
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);
    cubeVertexPositionBuffer.itemSize = 2;
    cubeVertexPositionBuffer.numItems = 4;

    cubeVertexTextureCoordBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, cubeVertexTextureCoordBuffer);
    var textureCoords = [0.0, 1.0, 1.0, 1.0, 1.0, 0.0, 0.0, 0.0];
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(textureCoords), gl.STATIC_DRAW);
    cubeVertexTextureCoordBuffer.itemSize = 2;
    cubeVertexTextureCoordBuffer.numItems = 4;

    cubeVertexIndexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, cubeVertexIndexBuffer);
    var cubeVertexIndices = [0, 1, 2, 0, 2, 3];
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(cubeVertexIndices), gl.STATIC_DRAW);
    cubeVertexIndexBuffer.itemSize = 1;
    cubeVertexIndexBuffer.numItems = 6;
}

function drawScene() {
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    mat4.ortho(-1.0, 1.0, -1.0, 1.0, -1.0, 1.0, pMatrix);

    gl.useProgram(current_program);
    mat4.identity(mvMatrix);

    gl.bindBuffer(gl.ARRAY_BUFFER, cubeVertexPositionBuffer);
    gl.vertexAttribPointer(current_program.vertexPositionAttribute, cubeVertexPositionBuffer.itemSize, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, cubeVertexTextureCoordBuffer);
    gl.vertexAttribPointer(current_program.textureCoordAttribute, cubeVertexTextureCoordBuffer.itemSize, gl.FLOAT, false, 0, 0);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, webcam);
    gl.uniform1i(current_program.samplerUniform, 0);

    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, cubeVertexIndexBuffer);
    setUniforms();
    gl.drawElements(gl.TRIANGLES, cubeVertexIndexBuffer.numItems, gl.UNSIGNED_SHORT, 0);
    gl.bindTexture(gl.TEXTURE_2D, null);
}


var old_time = Date.now();
var count = 0;

function tick() {
    count++;
    if (count < 60) {
        requestAnimFrame(tick);
        return;
    }
    requestAnimFrame(tick);
    drawScene();
}

function webGLStart() {

    canvas = document.getElementById("webgl-canvas");
    canvas.width = 1024;
    canvas.height = 1024;
    initGL();
    initShaders();
    initBuffers();
    initTexture();

    gl.clearColor(0.0, 0.0, 0.0, 1.0);
    gl.enable(gl.DEPTH_TEST);

    tick();
}

function processing_changer() {

}


function Action(i) {
    switch (i) {
        case 1: // Colour Use Mandala code
            //            Param1 = Param1 + 1;
            //            if (Param1 > 3)
            //                Param1 = 0;
            break;
        case 2: // Colourb
            //            Param2 = Param2 + 1;
            //            if (Param2 > 3)
            //                Param2 = 0;
            break;
        case 3: // size
            Param3 = Param3 + 1;
            if (Param3 > 3)
                Param3 = 0;
            break;
        case 4: // style
            Param4 = Param4 + 1;
            if (Param4 > 2)
                Param4 = 0;
            break;
    }
}

function userMedia() {
    webcam = document.createElement('video'); //getElementById('webcam');
    var soundNotAllowed = function (error) {
        console.log(error);
        navigator.getUserMedia({
            video: {
                facingMode: 'environment'
            },
            audio: false,
        }, onSuccess, function (e) {
            alert('Error getting audio');
            console.log(e);
        });
    }

    navigator.mediaDevices.getUserMedia({
            video: {
                facingMode: 'environment'
            },
            audio: false,

        })
        .then(onSuccess)
        .catch(soundNotAllowed);
}

var buttonPicture;
var buttonColour;
var buttonColourb;
var buttonMenu;
var buttonFlip;
var buttonLight;
var buttonSize;
var buttonStyle;

function toggleButtons() {
    buttonPicture.hidden = !buttonPicture.hidden;
    buttonColour.hidden = !buttonColour.hidden;
    buttonColourb.hidden = !buttonColourb.hidden;
    buttonFlip.hidden = !buttonFlip.hidden;
    buttonLight.hidden = !buttonLight.hidden;
    buttonSize.hidden = !buttonSize.hidden;
    buttonStyle.hidden = !buttonStyle.hidden;
}

var colTimer;

function camStart() {
    var doingBackground = false;
    //      var button = document.querySelector('button');
    var splash = document.querySelector('splash');
    buttonPicture = document.querySelector('buttonPicture');
    buttonColour = document.querySelector('buttonColour');
    buttonColourb = document.querySelector('buttonColourb');
    buttonMenu = document.querySelector('buttonMenu');
    buttonFlip = document.querySelector('buttonFlip');
    buttonLight = document.querySelector('buttonLight');
    buttonSize = document.querySelector('buttonSize');
    buttonStyle = document.querySelector('buttonStyle');
    colPick = document.getElementById('myColor');
    splash.onclick = function (e) {
        userMedia();
        splash.hidden = true;
    }

    buttonMenu.onmousedown = function (e) {
        toggleButtons();
    }
    buttonColour.onmousedown = function (e) {
        doingBackground = false;
        colPick.color.showPicker();
        //        Action(1);
    }
    buttonColourb.onmousedown = function (e) {
        doingBackground = true;
        colPick.color.showPicker();
        //        Action(2);
    }
    buttonSize.onmousedown = function (e) {
        Action(3);
    }
    buttonStyle.onmousedown = function (e) {
        Action(4);
    }
    colPick.onchange = function (e) {
        if (doingBackground)
            colourB = colPick.color.rgb;
        else
            colourF = colPick.color.rgb;
        try {
            clearInterval(colTimer);
        } catch (e) {}
        colTimer = setTimeout(function () {
            colPick.color.hidePicker();
        }, 3000);
    }
}

function PlayIt() {
    webcam.play();
    webGLStart();
}

function onSuccess(stream) {
    //      var videoSource;
    //
    //      if (window.URL) {
    //         videoSource = window.URL.createObjectURL(stream);
    //      } else {
    //         videoSource = stream;
    //      }
    //      webcam.src = stream;
    webcam.srcObject = stream;
    PlayIt();

    const track = stream.getVideoTracks()[0];
    //    var facingBack = stream.getVideoTracks()[0].getSettings().facingMode ||
    //        stream.getVideoTracks()[0].label.indexOf("acing back") !== -1;
    //Create image capture object and get camera capabilities
    const imageCapture = new ImageCapture(track)
//    const photoCapabilities = imageCapture.getPhotoCapabilities().then(() => {
//
//        //todo: check if camera has a torch
//
//        //let there be light!
//        //        const btn = document.querySelector('.switch');
//        //        btn.addEventListener('click', function () {
//        track.applyConstraints({
//            advanced: [{
//                torch: true
//                    }]
//        });
//        //        });
//    });


}

function onError() {
    alert('Error');
}
