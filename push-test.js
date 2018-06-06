const USB = require('usb')
const { performance } = require('perf_hooks');
const Canvas = require('canvas')
const fs = require('fs')
const PUSH_VID = 0x2982
const PUSH_PID = 0x1967
const PUSH_FRAME_SIZE = 327680
const PUSH_LINE_SIZE = 2048
const PUSH_BUFFER_SIZE = PUSH_FRAME_SIZE
const PUSH_XOR_PATTERN = 0xFFE7F3E7
const PUSH_BUFFER_COUNT = PUSH_FRAME_SIZE / PUSH_BUFFER_SIZE
const PUSH_FRAME_HEADER = [0xFF, 0xCC, 0xAA, 0x88, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 ]

const canvas = new Canvas(960, 160)
const ctx = canvas.getContext('2d')
var endpoint;
const frameData = new ArrayBuffer(327680)

function convertImage(image, frame) {
  var y,h,x,w;
  for(y=0;y<160;y++) {
    const frameLineStart = PUSH_LINE_SIZE * y
    const frameLine = new Uint16Array(frame, frameLineStart, PUSH_LINE_SIZE / 2)
    for(x=0;x<1024;x++) {
      var word = 0
      if (x < 960) {
        const off = (y * 3840) + x * 4
        const r = image[off + 2] >> 3
        const g = image[off + 1] >> 2
        const b = image[off    ] >> 3
        word = (r & 0b11111) | ((g & 0b111111) << 5) | ((b & 0b11111) << 11)
      }
      var mask = 0xF3E7
      if (x & 1 > 0) {
        mask = 0xFFE7
      }
      frameLine[x] = word ^ mask
    }
  }
}


function initPush(callback) {
  var push = USB.findByIds(PUSH_VID, PUSH_PID)
  if (push == null) {
    callback(new Error("Push not found"))
  }
  push.open()
  const pushInterface = push.interface(0)
  pushInterface.claim()
  endpoint = pushInterface.endpoint(1)
  callback()
}


function sendFrame(callback) {
  if (!endpoint) { callback(new Error("No Push available")) } // push not available
  convertImage(canvas.toBuffer('raw'), frameData)
  endpoint.transfer(Buffer.from(PUSH_FRAME_HEADER), function (error) {
    if (!error) {
      endpoint.transfer(Buffer.from(frameData), function (error) {
        if (!error) {
          callback()
        } else {
          callback(error)
        }
      })
    } else {
      callback(error)
    }
  })
}






function drawFrame(frameNum) {
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  ctx.strokeStyle = "#ff0"
  // ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.fillStyle = "hsl(" + frameNum % 360 +",100%,50%)"
  ctx.lineWidth = 4
  ctx.fillRect((frameNum * 2) % 960, (frameNum * 2) % 160, 20, 20)
  ctx.beginPath()
  ctx.arc(100, 100, 50, 0, (frameNum / 20.0) % (2 * Math.PI))
  ctx.lineTo(100, 100)
  ctx.stroke()

  ctx.font = '800 20px "SF Pro Display"';
  ctx.fillStyle = '#fff'
  ctx.fillText("Awesome!", 50, 100);

  //return canvas.toBuffer('raw')
}

var fn = 0
function sendNextFrame() {
  drawFrame(fn++)
  sendFrame((err) => {
    if (!err) {
      process.nextTick(sendNextFrame)
    } else {
      console.log("ERR", err)
    }
  })
}

initPush((err) => {
  if (err) {
    console.log("Push not found", err)
  } else {
    sendNextFrame()
  }
})
