import { HandLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';

export interface TrackerOutput {
  cursorPos: { x: number; y: number };
  isClicked: boolean;
  isDetected: boolean;
  videoElement: HTMLVideoElement | null;
  landmarks: { x: number; y: number; z: number }[] | null;
  isCameraActive: boolean;
  showCameraPreview: boolean;
}

export class HandTracker {
  private videoElement: HTMLVideoElement;
  private pipCanvas: HTMLCanvasElement;
  private pipCtx: CanvasRenderingContext2D;
  private handLandmarker: HandLandmarker | null = null;

  private cursorPos = { x: 960, y: 540 };
  private isClicked = false;
  private isDetected = false;
  private landmarks: { x: number; y: number; z: number }[] | null = null;

  private width = 1920;
  private height = 1080;
  private isCameraActive = false;
  private showCameraPreview = false;
  private lastVideoTime = -1;

  constructor(width = 1920, height = 1080) {
    this.width = width;
    this.height = height;

    this.videoElement = document.createElement('video');
    this.videoElement.autoplay = true;
    this.videoElement.playsInline = true;

    const pipContainer = document.createElement('div');
    pipContainer.id = 'pip-camera-container';
    pipContainer.appendChild(this.videoElement);

    this.pipCanvas = document.createElement('canvas');
    this.pipCanvas.width = this.width;
    this.pipCanvas.height = this.height;
    this.pipCanvas.style.position = 'absolute';
    this.pipCanvas.style.top = '0';
    this.pipCanvas.style.left = '0';
    this.pipCanvas.style.width = '100%';
    this.pipCanvas.style.height = '100%';
    this.pipCanvas.style.pointerEvents = 'none';
    this.pipCtx = this.pipCanvas.getContext('2d')!;
    pipContainer.appendChild(this.pipCanvas);

    document.body.appendChild(pipContainer);
  }

  public async initialize(): Promise<boolean> {
    try {
      const vision = await FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
      );

      this.handLandmarker = await HandLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: `https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task`,
          delegate: 'GPU'
        },
        runningMode: 'VIDEO',
        numHands: 2
      });

      return await this.startWebcam();
    } catch (err) {
      console.warn("Camera / MediaPipe initialization error:", err);
      this.isCameraActive = false;
      return false;
    }
  }

  private async startWebcam(): Promise<boolean> {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      this.isCameraActive = false;
      return false;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: 'user'
        }
      });

      this.videoElement.srcObject = stream;
      await new Promise((resolve) => {
        this.videoElement.onloadedmetadata = () => {
          this.videoElement.play();
          resolve(true);
        };
      });

      this.isCameraActive = true;
      return true;
    } catch (err) {
      console.warn("Could not start webcam stream:", err);
      this.isCameraActive = false;
      return false;
    }
  }

  public update(useThumbPinch: boolean = false): TrackerOutput {
    if (this.handLandmarker && this.isCameraActive && this.videoElement.readyState >= 2) {
      if (this.videoElement.currentTime !== this.lastVideoTime) {
        this.lastVideoTime = this.videoElement.currentTime;
        const results = this.handLandmarker.detectForVideo(this.videoElement, performance.now());

        if (results.landmarks && results.landmarks.length > 0) {
          let cursorHand = null;
          let gestureHand = null;

          for (let i = 0; i < results.landmarks.length; i++) {
            // Unmirrored camera feed: "Right" category = physical left hand
            if (results.handednesses[i][0].categoryName === 'Right') {
              gestureHand = results.landmarks[i];
            } else {
              cursorHand = results.landmarks[i];
            }
          }
          if (!cursorHand) cursorHand = results.landmarks[0];

          const hand = cursorHand;
          this.landmarks = hand;

          // Landmark 4: Thumb Tip
          const thumbTip = hand[4];
          // Landmark 8: Index Finger Tip
          const indexTip = hand[8];
          // Landmark 12: Middle Finger Tip
          const middleTip = hand[12];

          const camCx = (1.0 - indexTip.x) * this.width;
          const camCy = indexTip.y * this.height;

          // Calculate palm size as a reference for depth-invariant pinch detection
          const wrist = hand[0];
          const middleMcp = hand[9];
          const palmSize = Math.hypot(wrist.x - middleMcp.x, wrist.y - middleMcp.y, wrist.z - middleMcp.z);

          let pinchDist3D = 0;
          if (useThumbPinch) {
            pinchDist3D = Math.hypot(indexTip.x - thumbTip.x, indexTip.y - thumbTip.y, indexTip.z - thumbTip.z);
          } else {
            pinchDist3D = Math.hypot(indexTip.x - middleTip.x, indexTip.y - middleTip.y, indexTip.z - middleTip.z);
          }

          // Depth-invariant relative pinch distance
          const pinchRatio = pinchDist3D / palmSize;

          // Apply hysteresis to prevent rapid flickering
          if (this.isClicked) {
            if (pinchRatio > 0.25) {
              this.isClicked = false;
            }
          } else {
            if (pinchRatio < 0.15) {
              this.isClicked = true;
            }
          }

          // Interaction boundaries
          const marginX = this.width * 0.15;
          const marginY = this.height * 0.15;

          // Map the camera coordinates into the interaction box
          let targetX = this.interp(camCx, marginX, this.width - marginX, 0, this.width);
          let targetY = this.interp(camCy, marginY, this.height - marginY, 0, this.height);

          // Use raw mapped coordinates (game loop now handles interpolation)
          this.cursorPos = { x: Math.round(targetX), y: Math.round(targetY) };

          // Strict Clamping to Virtual Viewport
          this.cursorPos.x = Math.max(0, Math.min(this.width, this.cursorPos.x));
          this.cursorPos.y = Math.max(0, Math.min(this.height, this.cursorPos.y));

          // Gesture Detection for Camera Preview Toggle (Left Hand Only)
          if (gestureHand) {
            const isIndexExt = gestureHand[8].y < gestureHand[6].y;
            const isMiddleExt = gestureHand[12].y < gestureHand[10].y;
            const isRingExt = gestureHand[16].y < gestureHand[14].y;
            const isPinkyExt = gestureHand[20].y < gestureHand[18].y;

            const isFist = !isIndexExt && !isMiddleExt && !isRingExt && !isPinkyExt;
            const isSpiderMan = isIndexExt && !isMiddleExt && !isRingExt && isPinkyExt;

            if (isSpiderMan) {
              this.showCameraPreview = true;
            } else if (isFist) {
              this.showCameraPreview = false;
            }
          }

          this.isDetected = true;
          this.drawPipOverlay(results.landmarks);
        } else {
          // Freeze-on-Loss: Keep last valid cursor position and do NOT reset filters
          // `isDetected` remains true so the cursor doesn't disappear, but it freezes in place.
          this.landmarks = null;
          // Purposely do not set filterX and filterY to null.
          this.drawPipOverlay(null);
        }
      }
    }

    return {
      cursorPos: this.cursorPos,
      isClicked: this.isClicked,
      isDetected: this.isDetected,
      videoElement: this.videoElement,
      landmarks: this.landmarks,
      isCameraActive: this.isCameraActive,
      showCameraPreview: this.showCameraPreview
    };
  }

  public setMousePosition(x: number, y: number, isDown: boolean) {
    this.cursorPos = { x, y };
    this.isClicked = isDown;
    this.isDetected = true;
  }

  private interp(x: number, inMin: number, inMax: number, outMin: number, outMax: number): number {
    const clamped = Math.max(inMin, Math.min(inMax, x));
    return outMin + ((clamped - inMin) / (inMax - inMin)) * (outMax - outMin);
  }

  private drawPipOverlay(allLandmarks: any[] | null) {
    if (!this.pipCtx) return;
    const ctx = this.pipCtx;
    ctx.clearRect(0, 0, this.width, this.height);

    // Draw interaction boundary
    const marginX = this.width * 0.15;
    const marginY = this.height * 0.15;
    
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.lineWidth = 4;
    ctx.setLineDash([15, 10]);
    ctx.strokeRect(marginX, marginY, this.width - marginX * 2, this.height - marginY * 2);
    
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.font = 'bold 36px Outfit, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('Tracking Boundary', marginX + 10, marginY + 40);

    // Draw hand tracers
    if (allLandmarks) {
      const connections = [
        [0, 1], [1, 2], [2, 3], [3, 4], // Thumb
        [0, 5], [5, 6], [6, 7], [7, 8], // Index
        [5, 9], [9, 10], [10, 11], [11, 12], // Middle
        [9, 13], [13, 14], [14, 15], [15, 16], // Ring
        [13, 17], [0, 17], [17, 18], [18, 19], [19, 20] // Pinky & Palm
      ];

      for (const hand of allLandmarks) {
        const mapped = hand.map((lm: any) => ({
          x: (1.0 - lm.x) * this.width,
          y: lm.y * this.height
        }));

        ctx.strokeStyle = 'rgba(137, 180, 250, 0.8)';
        ctx.lineWidth = 6;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        ctx.beginPath();
        for (const [startIdx, endIdx] of connections) {
          const start = mapped[startIdx];
          const end = mapped[endIdx];
          ctx.moveTo(start.x, start.y);
          ctx.lineTo(end.x, end.y);
        }
        ctx.stroke();

        ctx.fillStyle = '#a6e3a1';
        for (const p of mapped) {
          ctx.beginPath();
          ctx.arc(p.x, p.y, 8, 0, 2 * Math.PI);
          ctx.fill();
        }
      }
    }
    ctx.restore();
  }
}
